"""
NBA Elo Rating System
=====================
Computes Elo ratings for all 30 NBA teams using game results derived from
player_game_logs. Processes games chronologically, carries ratings across
seasons with a regression-to-mean reset at the start of each new season.

Features:
  - Home court advantage: +100 Elo points in win probability
  - Margin-of-victory multiplier: rewards dominant wins, reduces K for blowouts
  - Season-start regression: ratings regress 1/3 toward 1500 each new season
  - Outputs elo_ratings.json: current rating, history, rank, trend

Usage:
  python ml/elo_model.py           # Compute and save ratings
  python ml/elo_model.py --dry-run # Print ratings without saving
"""

import sys, json, argparse
from pathlib import Path
from datetime import datetime
import sqlite3
import math

DB_PATH = Path(__file__).resolve().parent.parent / ".data" / "courtside.db"
MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_DIR.mkdir(exist_ok=True)
OUTPUT_PATH = MODEL_DIR / "elo_ratings.json"

# Elo constants
INITIAL_ELO = 1500
K_FACTOR = 20            # How much ratings shift per game
HOME_ADVANTAGE = 100     # Elo points added to home team's expected score
SEASON_REGRESSION = 0.33 # Fraction to regress toward mean at season start


def mov_multiplier(margin, elo_diff):
    """
    Margin-of-victory multiplier (FiveThirtyEight formula).
    Larger wins are worth more, but diminishing returns prevent blowout inflation.
    Also accounts for whether the winning team was expected to win (Elo diff).
    """
    return math.log(abs(margin) + 1) * (2.2 / (elo_diff * 0.001 + 2.2))


def expected_win_prob(elo_a, elo_b):
    """Expected probability that team A beats team B."""
    return 1.0 / (1.0 + 10 ** ((elo_b - elo_a) / 400.0))


def season_sort_key(season):
    """Convert '2024-25' to sortable int 202425."""
    return int(season.replace("-", ""))


def load_games(conn):
    """
    Load head-to-head game results from team_game_results table.
    Each row is one team's record for one game (actual final scores from teamgamelog API).
    We iterate home-team rows and pair with the matching away-team row.
    Falls back to aggregating player_game_logs if team_game_results is empty.
    """
    count = conn.execute("SELECT COUNT(*) FROM team_game_results").fetchone()[0]

    if count > 0:
        print(f"[Elo] Using team_game_results ({count} rows)")
        cursor = conn.execute("""
            SELECT team, season, game_date, opponent, home, pts, opp_pts
            FROM team_game_results
            WHERE pts IS NOT NULL AND opp_pts IS NOT NULL AND opponent IS NOT NULL
            ORDER BY game_date ASC
        """)
        rows = [dict(zip([d[0] for d in cursor.description], r)) for r in cursor.fetchall()]
    else:
        print("[Elo] team_game_results empty — falling back to player_game_logs aggregation")
        cursor = conn.execute("""
            SELECT
                COALESCE(gl.team, p.team) AS team,
                gl.opponent, gl.game_date, gl.season, gl.home,
                SUM(gl.pts) AS pts,
                CAST(SUM(gl.pts) - AVG(gl.plus_minus) AS INTEGER) AS opp_pts
            FROM player_game_logs gl
            LEFT JOIN players p ON gl.player_id = p.player_id
            WHERE gl.pts IS NOT NULL
              AND (gl.team IS NOT NULL OR p.team IS NOT NULL)
              AND gl.opponent IS NOT NULL
            GROUP BY COALESCE(gl.team, p.team), gl.game_date
            ORDER BY gl.game_date ASC
        """)
        rows = [dict(zip([d[0] for d in cursor.description], r)) for r in cursor.fetchall()]

    # Build game pairs from home-team rows
    by_date_team = {(r["game_date"], r["team"]): r for r in rows}
    games = []
    seen = set()

    for row in rows:
        if row["home"] != 1:
            continue
        home_team = row["team"]
        away_team = row["opponent"]
        date = row["game_date"]
        key = (date, home_team, away_team)
        if key in seen:
            continue
        seen.add(key)
        away_row = by_date_team.get((date, away_team))
        if away_row is None:
            continue
        games.append({
            "date": date,
            "season": row["season"],
            "home": home_team,
            "away": away_team,
            "home_pts": row["pts"] or 0,
            "away_pts": away_row["pts"] or 0,
        })

    games.sort(key=lambda g: g["date"])
    return games


def compute_elo(games):
    """
    Process games in order and compute running Elo ratings.
    Returns:
      - ratings: dict of team -> current Elo
      - history: dict of team -> list of { date, elo, opponent, margin, home }
    """
    ratings = {}
    history = {}
    current_season = None

    for game in games:
        home = game["home"]
        away = game["away"]
        season = game["season"]

        # Initialise new teams
        for team in (home, away):
            if team not in ratings:
                ratings[team] = INITIAL_ELO
                history[team] = []

        # Season-start regression to the mean
        if season != current_season:
            if current_season is not None:
                for team in ratings:
                    ratings[team] = ratings[team] + SEASON_REGRESSION * (INITIAL_ELO - ratings[team])
            current_season = season

        home_elo = ratings[home] + HOME_ADVANTAGE
        away_elo = ratings[away]

        exp_home = expected_win_prob(home_elo, away_elo)
        exp_away = 1.0 - exp_home

        home_pts = game["home_pts"]
        away_pts = game["away_pts"]
        margin = home_pts - away_pts

        if margin > 0:
            home_won, away_won = 1.0, 0.0
        elif margin < 0:
            home_won, away_won = 0.0, 1.0
        else:
            home_won = away_won = 0.5  # tie (shouldn't happen in NBA)

        # Margin-of-victory multiplier (winner's perspective)
        winning_elo_diff = (ratings[home] - ratings[away]) if home_won else (ratings[away] - ratings[home])
        multiplier = mov_multiplier(margin, winning_elo_diff)

        delta_home = K_FACTOR * multiplier * (home_won - exp_home)
        delta_away = K_FACTOR * multiplier * (away_won - exp_away)

        ratings[home] = round(ratings[home] + delta_home, 1)
        ratings[away] = round(ratings[away] + delta_away, 1)

        history[home].append({
            "date": game["date"],
            "elo": ratings[home],
            "opponent": away,
            "margin": margin,
            "home": True,
            "win": home_won == 1.0,
        })
        history[away].append({
            "date": game["date"],
            "elo": ratings[away],
            "opponent": home,
            "margin": -margin,
            "home": False,
            "win": away_won == 1.0,
        })

    return ratings, history


def build_output(ratings, history):
    """Build the JSON output structure."""
    # Rank teams by current Elo
    ranked = sorted(ratings.items(), key=lambda x: -x[1])

    results = []
    for rank, (team, elo) in enumerate(ranked, 1):
        team_history = history.get(team, [])

        # Trend: change over last 10 games
        recent = team_history[-10:]
        trend = round(elo - recent[0]["elo"], 1) if len(recent) >= 2 else 0.0

        # Last 5 game results (W/L)
        last5 = [{"date": g["date"], "win": g["win"], "opponent": g["opponent"], "margin": g["margin"]}
                 for g in team_history[-5:]]

        # Peak Elo this season
        season_history = [g for g in team_history if g["date"] >= "2025-10-01"]
        peak = max((g["elo"] for g in season_history), default=elo)

        results.append({
            "team": team,
            "elo": elo,
            "rank": rank,
            "trend": trend,         # + = rising, - = falling
            "peak": peak,
            "last5": last5,
            "history": team_history[-40:],  # Last 40 games for chart
        })

    return {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "teams": results,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print results without saving")
    args = parser.parse_args()

    print("[Elo] Connecting to database...")
    conn = sqlite3.connect(DB_PATH)

    print("[Elo] Loading game results...")
    games = load_games(conn)
    print(f"[Elo] Loaded {len(games)} head-to-head games")

    if len(games) == 0:
        print("[Elo] ERROR: No games found. Is the DB populated?")
        sys.exit(1)

    print("[Elo] Computing Elo ratings...")
    ratings, history = compute_elo(games)

    output = build_output(ratings, history)

    # Print top 10
    print("\n=== Current Elo Rankings ===")
    for t in output["teams"][:10]:
        trend_str = f"+{t['trend']}" if t['trend'] >= 0 else str(t['trend'])
        print(f"  {t['rank']:2}. {t['team']:4}  {t['elo']:7.1f}  ({trend_str} last 10g)  peak: {t['peak']:.1f}")

    if not args.dry_run:
        OUTPUT_PATH.write_text(json.dumps(output, indent=2))
        print(f"\n[Elo] Saved to {OUTPUT_PATH}")
    else:
        print("\n[Elo] Dry run — not saving.")

    conn.close()


if __name__ == "__main__":
    main()
