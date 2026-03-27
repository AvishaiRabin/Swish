"""
XGBoost NBA Game Outcome Prediction Model
==========================================
Trains on historical game logs + player profiles + standings to predict:
  1. Win probability (home team)
  2. Predicted point spread

Usage:
  python ml/xgboost_model.py              # Train + evaluate
  python ml/xgboost_model.py --predict    # Predict today's games
  python ml/xgboost_model.py --retrain    # Force retrain even if model exists
"""

import sys, os, json, argparse
from pathlib import Path
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import accuracy_score, mean_absolute_error, log_loss
import joblib
import sqlite3

DB_PATH = Path(__file__).resolve().parent.parent / ".data" / "courtside.db"
MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_DIR.mkdir(exist_ok=True)
WIN_MODEL_PATH = MODEL_DIR / "xgb_win.json"
SPREAD_MODEL_PATH = MODEL_DIR / "xgb_spread.json"
FEATURE_COLS_PATH = MODEL_DIR / "feature_cols.json"


# ---------------------------------------------------------------------------
# 1. Build game-level dataset from player game logs
# ---------------------------------------------------------------------------

def load_game_logs(conn):
    """Load all player game logs into a DataFrame.

    The `team` column in player_game_logs may be NULL (backfill bug).
    Fall back to the `players` table for current team assignment.
    """
    df = pd.read_sql_query(
        """SELECT gl.*, p.team as p_team
           FROM player_game_logs gl
           LEFT JOIN players p ON gl.player_id = p.player_id
           WHERE gl.season IN ('2024-25','2025-26')""",
        conn,
    )
    # Use game-log team if available, otherwise fall back to players table
    df["team"] = df["team"].fillna(df["p_team"])
    df.drop(columns=["p_team"], inplace=True)
    df["game_date"] = pd.to_datetime(df["game_date"])
    return df


def load_standings(conn):
    """Load current standings."""
    df = pd.read_sql_query("SELECT * FROM standings", conn)
    return df.set_index("team")


def load_profiles(conn):
    """Load player profiles with archetype scores."""
    df = pd.read_sql_query("SELECT * FROM player_profiles", conn)
    return df.set_index("player_id")


def load_elo(elo_path=None):
    """
    Load Elo ratings from elo_ratings.json.
    Returns dict: team -> { elo, trend }
    Returns empty dict if file missing.
    """
    if elo_path is None:
        elo_path = MODEL_DIR / "elo_ratings.json"
    if not Path(elo_path).exists():
        return {}
    with open(elo_path) as f:
        data = json.load(f)
    return {t["team"]: {"elo": t["elo"], "trend": t.get("trend", 0.0)}
            for t in data.get("teams", [])}


def build_team_game_stats(logs):
    """Aggregate player game logs into team-level stats per game."""
    # For each game, compute team-level totals
    team_games = logs.groupby(["game_date", "team", "opponent", "home"]).agg(
        pts=("pts", "sum"),
        reb=("reb", "sum"),
        ast=("ast", "sum"),
        stl=("stl", "sum"),
        blk=("blk", "sum"),
        tov=("tov", "sum"),
        fgm=("fgm", "sum"),
        fga=("fga", "sum"),
        fg3m=("fg3m", "sum"),
        fg3a=("fg3a", "sum"),
        ftm=("ftm", "sum"),
        fta=("fta", "sum"),
        plus_minus=("plus_minus", "sum"),
        n_players=("player_id", "nunique"),
    ).reset_index()

    # Compute percentages
    team_games = team_games.copy()
    team_games.loc[:, "fg_pct"] = team_games["fgm"] / team_games["fga"].clip(lower=1)
    team_games.loc[:, "fg3_pct"] = team_games["fg3m"] / team_games["fg3a"].clip(lower=1)
    team_games.loc[:, "ft_pct"] = team_games["ftm"] / team_games["fta"].clip(lower=1)

    return team_games.sort_values("game_date")


def compute_rolling_features(team_games, windows=(5, 10)):
    """Compute rolling averages for each team over recent games."""
    stat_cols = ["pts", "reb", "ast", "stl", "blk", "tov", "fg_pct", "fg3_pct", "ft_pct", "plus_minus"]
    team_games = team_games.sort_values(["team", "game_date"])
    rolling_feats = {}

    for team, grp in team_games.groupby("team"):
        grp = grp.sort_values("game_date").reset_index(drop=True)
        n = len(grp)
        team_roll = {"game_date": grp["game_date"].values}
        for w in windows:
            for col in stat_cols:
                team_roll[f"roll_{w}_{col}"] = (
                    grp[col].shift(1).rolling(w, min_periods=max(1, w // 2)).mean().values
                )
        # Recent win count (last 5)
        wins = (grp["plus_minus"].shift(1) > 0).astype(float)
        team_roll["win_streak"] = wins.rolling(5, min_periods=1).sum().values
        # Rest days
        team_roll["rest_days"] = grp["game_date"].diff().dt.days.fillna(3).clip(upper=7).values
        # Season win rate so far
        cum_wins = (grp["plus_minus"].shift(1) > 0).cumsum().values
        cum_games = np.arange(1, n + 1, dtype=float)
        team_roll["season_win_rate"] = cum_wins / cum_games

        rolling_feats[team] = pd.DataFrame(team_roll)

    return rolling_feats


def build_matchup_dataset(team_games, rolling_feats, standings, profiles, elo_ratings=None):
    """Pair home and away teams to create matchup-level training rows."""
    # Get home games
    home_games = team_games[team_games["home"] == 1].copy()
    away_games = team_games[team_games["home"] == 0].copy()

    # Build profile features per team (average of top players)
    profile_cols = [
        "usg_pct", "ts_pct", "ast_pct", "net_rating", "pie", "pace",
        "drives", "contested_shots", "deflections",
        "form_factor",
        "arch_floor_general", "arch_scoring_pg", "arch_combo_guard",
        "arch_large_playmaker", "arch_three_and_d_wing", "arch_two_way_wing",
        "arch_shot_creating_wing", "arch_point_wing", "arch_stretch_big",
        "arch_unicorn_big", "arch_rim_running_big", "arch_defensive_anchor",
        "arch_versatile_pf",
    ]
    team_profiles = {}
    if not profiles.empty:
        for team, grp in profiles.groupby("team"):
            means = {}
            for col in profile_cols:
                if col in grp.columns:
                    means[f"prof_{col}"] = grp[col].astype(float).mean()
            team_profiles[team] = means

    rows = []
    for _, hg in home_games.iterrows():
        date = hg["game_date"]
        home_team = hg["team"]
        away_team = hg["opponent"]

        # Find matching away game
        away_match = away_games[
            (away_games["game_date"] == date) & (away_games["team"] == away_team)
        ]
        if away_match.empty:
            continue

        ag = away_match.iloc[0]

        # Get rolling features
        h_roll = rolling_feats.get(home_team)
        a_roll = rolling_feats.get(away_team)
        if h_roll is None or a_roll is None:
            continue

        h_row = h_roll[h_roll["game_date"] == date]
        a_row = a_roll[a_roll["game_date"] == date]
        if h_row.empty or a_row.empty:
            continue

        h_row = h_row.iloc[0]
        a_row = a_row.iloc[0]

        feat = {"game_date": date, "home_team": home_team, "away_team": away_team}

        # Rolling features (prefixed h_ / a_)
        for col in h_row.index:
            if col == "game_date":
                continue
            feat[f"h_{col}"] = h_row[col]
        for col in a_row.index:
            if col == "game_date":
                continue
            feat[f"a_{col}"] = a_row[col]

        # Standings features
        for prefix, team in [("h", home_team), ("a", away_team)]:
            if team in standings.index:
                s = standings.loc[team]
                feat[f"{prefix}_win_pct"] = float(s.get("pct", 0.5))
                feat[f"{prefix}_ppg"] = float(s.get("ppg", 110))
                feat[f"{prefix}_opp_ppg"] = float(s.get("opp_ppg", 110))
                feat[f"{prefix}_net"] = feat[f"{prefix}_ppg"] - feat[f"{prefix}_opp_ppg"]
            else:
                feat[f"{prefix}_win_pct"] = 0.5
                feat[f"{prefix}_ppg"] = 110
                feat[f"{prefix}_opp_ppg"] = 110
                feat[f"{prefix}_net"] = 0

        # Profile features
        for prefix, team in [("h", home_team), ("a", away_team)]:
            tp = team_profiles.get(team, {})
            for k, v in tp.items():
                feat[f"{prefix}_{k}"] = v

        # Differentials (home - away for key stats)
        for stat in ["roll_5_pts", "roll_5_fg_pct", "roll_5_plus_minus",
                      "roll_10_pts", "roll_10_fg_pct", "win_pct", "net"]:
            h_key = f"h_{stat}"
            a_key = f"a_{stat}"
            if h_key in feat and a_key in feat:
                h_val = feat[h_key] if feat[h_key] is not None else 0
                a_val = feat[a_key] if feat[a_key] is not None else 0
                feat[f"diff_{stat}"] = h_val - a_val

        # Elo features (snapshot at time of game — use current ratings as proxy for training)
        if elo_ratings:
            for prefix, team in [("h", home_team), ("a", away_team)]:
                elo_info = elo_ratings.get(team, {})
                feat[f"{prefix}_elo"] = elo_info.get("elo", 1500.0)
                feat[f"{prefix}_elo_trend"] = elo_info.get("trend", 0.0)
            feat["diff_elo"] = feat.get("h_elo", 1500) - feat.get("a_elo", 1500)

        # Targets
        feat["home_pts"] = int(hg["pts"])
        feat["away_pts"] = int(ag["pts"])
        feat["home_win"] = 1 if hg["pts"] > ag["pts"] else 0
        feat["spread"] = int(hg["pts"]) - int(ag["pts"])

        rows.append(feat)

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# 2. Train XGBoost models
# ---------------------------------------------------------------------------

def get_feature_cols(df):
    """Return feature column names (everything except targets/metadata)."""
    exclude = {"game_date", "home_team", "away_team", "home_pts", "away_pts", "home_win", "spread"}
    return [c for c in df.columns if c not in exclude]


def train_models(df):
    """Train win classifier + spread regressor using time-series cross-validation."""
    feature_cols = get_feature_cols(df)

    # Save feature columns for inference
    with open(FEATURE_COLS_PATH, "w") as f:
        json.dump(feature_cols, f)

    X = df[feature_cols].fillna(0).values
    y_win = df["home_win"].values
    y_spread = df["spread"].values

    # Time-series split (respect temporal order)
    df_sorted = df.sort_values("game_date")
    X = df_sorted[feature_cols].fillna(0).values
    y_win = df_sorted["home_win"].values
    y_spread = df_sorted["spread"].values

    # Use last 20% as test set (most recent games)
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_win_train, y_win_test = y_win[:split_idx], y_win[split_idx:]
    y_spread_train, y_spread_test = y_spread[:split_idx], y_spread[split_idx:]

    print(f"\n[XGBoost] Training set: {len(X_train)} games")
    print(f"[XGBoost] Test set: {len(X_test)} games")
    print(f"[XGBoost] Features: {len(feature_cols)}")

    # --- Win probability classifier ---
    win_model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=3,
        reg_alpha=0.1,
        reg_lambda=1.0,
        eval_metric="logloss",
        random_state=42,
    )
    win_model.fit(
        X_train, y_win_train,
        eval_set=[(X_test, y_win_test)],
        verbose=False,
    )

    # Evaluate
    win_pred = win_model.predict(X_test)
    win_prob = win_model.predict_proba(X_test)[:, 1]
    win_acc = accuracy_score(y_win_test, win_pred)
    win_ll = log_loss(y_win_test, win_prob)
    print(f"\n[Win Model] Test accuracy: {win_acc:.3f}")
    print(f"[Win Model] Test log loss: {win_ll:.3f}")
    print(f"[Win Model] Home win rate in test: {y_win_test.mean():.3f}")

    # --- Spread regressor ---
    spread_model = xgb.XGBRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=3,
        reg_alpha=0.1,
        reg_lambda=1.0,
        eval_metric="mae",
        random_state=42,
    )
    spread_model.fit(
        X_train, y_spread_train,
        eval_set=[(X_test, y_spread_test)],
        verbose=False,
    )

    spread_pred = spread_model.predict(X_test)
    spread_mae = mean_absolute_error(y_spread_test, spread_pred)
    print(f"\n[Spread Model] Test MAE: {spread_mae:.1f} points")

    # Feature importance (top 15)
    importance = dict(zip(feature_cols, win_model.feature_importances_))
    top_feats = sorted(importance.items(), key=lambda x: x[1], reverse=True)[:15]
    print("\n[Win Model] Top 15 features:")
    for name, imp in top_feats:
        print(f"  {name:40s} {imp:.4f}")

    # Save models
    win_model.save_model(str(WIN_MODEL_PATH))
    spread_model.save_model(str(SPREAD_MODEL_PATH))
    print(f"\n[XGBoost] Models saved to {MODEL_DIR}")

    return win_model, spread_model, feature_cols


# ---------------------------------------------------------------------------
# 3. Predict today's games
# ---------------------------------------------------------------------------

def predict_games(conn, game_date=None):
    """Generate predictions for a specific date's games."""
    if game_date is None:
        game_date = datetime.now().strftime("%Y-%m-%d")

    # Load models
    if not WIN_MODEL_PATH.exists() or not SPREAD_MODEL_PATH.exists():
        print("[XGBoost] No trained model found. Run without --predict first.")
        return []

    win_model = xgb.XGBClassifier()
    win_model.load_model(str(WIN_MODEL_PATH))
    spread_model = xgb.XGBRegressor()
    spread_model.load_model(str(SPREAD_MODEL_PATH))

    with open(FEATURE_COLS_PATH) as f:
        feature_cols = json.load(f)

    # Load data
    logs = load_game_logs(conn)
    standings = load_standings(conn)
    profiles = load_profiles(conn)
    elo_ratings = load_elo()

    team_games = build_team_game_stats(logs)
    rolling_feats = compute_rolling_features(team_games)

    # Build profile features per team
    profile_cols = [
        "usg_pct", "ts_pct", "ast_pct", "net_rating", "pie", "pace",
        "drives", "contested_shots", "deflections", "form_factor",
        "arch_floor_general", "arch_scoring_pg", "arch_combo_guard",
        "arch_large_playmaker", "arch_three_and_d_wing", "arch_two_way_wing",
        "arch_shot_creating_wing", "arch_point_wing", "arch_stretch_big",
        "arch_unicorn_big", "arch_rim_running_big", "arch_defensive_anchor",
        "arch_versatile_pf",
    ]
    team_profiles = {}
    if not profiles.empty:
        for team, grp in profiles.groupby("team"):
            means = {}
            for col in profile_cols:
                if col in grp.columns:
                    means[f"prof_{col}"] = grp[col].astype(float).mean()
            team_profiles[team] = means

    # Get today's matchups: prefer matchups.json written by server.js, fall back to predictions table
    matchups_path = MODEL_DIR / "matchups.json"
    matchups = []
    if matchups_path.exists():
        with open(matchups_path) as f:
            mdata = json.load(f)
        if mdata.get("date") == game_date:
            matchups = [(m["home_team"], m["away_team"]) for m in mdata.get("matchups", [])]
            print(f"[XGBoost] Loaded {len(matchups)} matchups from matchups.json")

    if not matchups:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT home_team, away_team FROM predictions WHERE prediction_date = ?",
            (game_date,),
        )
        matchups = cursor.fetchall()

    if not matchups:
        print(f"[XGBoost] No matchups found for {game_date}")
        return []

    results = []
    for home_team, away_team in matchups:
        feat = {}

        # Rolling features
        for prefix, team in [("h", home_team), ("a", away_team)]:
            r = rolling_feats.get(team)
            if r is not None and len(r) > 0:
                last = r.iloc[-1]
                for col in last.index:
                    if col == "game_date":
                        continue
                    feat[f"{prefix}_{col}"] = last[col]

        # Standings
        for prefix, team in [("h", home_team), ("a", away_team)]:
            if team in standings.index:
                s = standings.loc[team]
                feat[f"{prefix}_win_pct"] = float(s.get("pct", 0.5))
                feat[f"{prefix}_ppg"] = float(s.get("ppg", 110))
                feat[f"{prefix}_opp_ppg"] = float(s.get("opp_ppg", 110))
                feat[f"{prefix}_net"] = feat[f"{prefix}_ppg"] - feat[f"{prefix}_opp_ppg"]
            else:
                feat[f"{prefix}_win_pct"] = 0.5
                feat[f"{prefix}_ppg"] = 110
                feat[f"{prefix}_opp_ppg"] = 110
                feat[f"{prefix}_net"] = 0

        # Profiles
        for prefix, team in [("h", home_team), ("a", away_team)]:
            tp = team_profiles.get(team, {})
            for k, v in tp.items():
                feat[f"{prefix}_{k}"] = v

        # Differentials
        for stat in ["roll_5_pts", "roll_5_fg_pct", "roll_5_plus_minus",
                      "roll_10_pts", "roll_10_fg_pct", "win_pct", "net"]:
            h_key, a_key = f"h_{stat}", f"a_{stat}"
            h_val = feat.get(h_key, 0) or 0
            a_val = feat.get(a_key, 0) or 0
            feat[f"diff_{stat}"] = h_val - a_val

        # Elo features
        if elo_ratings:
            for prefix, team in [("h", home_team), ("a", away_team)]:
                elo_info = elo_ratings.get(team, {})
                feat[f"{prefix}_elo"] = elo_info.get("elo", 1500.0)
                feat[f"{prefix}_elo_trend"] = elo_info.get("trend", 0.0)
            feat["diff_elo"] = feat.get("h_elo", 1500) - feat.get("a_elo", 1500)

        # Build feature vector in correct column order
        x = np.array([[feat.get(c, 0) or 0 for c in feature_cols]])

        win_prob = float(win_model.predict_proba(x)[0, 1])
        spread = float(spread_model.predict(x)[0])
        predicted_winner = home_team if win_prob > 0.5 else away_team

        result = {
            "home_team": home_team,
            "away_team": away_team,
            "home_win_prob": round(win_prob, 3),
            "predicted_winner": predicted_winner,
            "predicted_spread": round(spread, 1),
            "confidence": round(max(win_prob, 1 - win_prob), 3),
        }
        results.append(result)
        print(
            f"  {away_team} @ {home_team}: "
            f"{predicted_winner} by {abs(spread):.1f} "
            f"(win prob: {win_prob:.1%}, confidence: {result['confidence']:.1%})"
        )

    # Save predictions to JSON for server.js to read
    output_path = MODEL_DIR / "predictions.json"
    with open(output_path, "w") as f:
        json.dump({"date": game_date, "predictions": results}, f, indent=2)
    print(f"\n[XGBoost] Predictions saved to {output_path}")

    return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="XGBoost NBA Game Prediction")
    parser.add_argument("--predict", action="store_true", help="Predict today's games")
    parser.add_argument("--retrain", action="store_true", help="Force retrain")
    parser.add_argument("--date", type=str, default=None, help="Date for predictions (YYYY-MM-DD)")
    parser.add_argument("--matchups", type=str, default=None,
                        help="Manual matchups: 'HOME,AWAY;HOME,AWAY'")
    args = parser.parse_args()

    conn = sqlite3.connect(str(DB_PATH))

    if args.predict and not args.retrain:
        print(f"[XGBoost] Predicting games for {args.date or 'today'}...")
        if args.matchups:
            # Insert temp matchups for prediction
            pairs = [m.split(",") for m in args.matchups.split(";")]
            for home, away in pairs:
                print(f"  Matchup: {away.strip()} @ {home.strip()}")
        predict_games(conn, args.date)
    else:
        # Train
        print("[XGBoost] Loading game logs...")
        logs = load_game_logs(conn)
        standings = load_standings(conn)
        profiles = load_profiles(conn)

        print("[XGBoost] Building team game stats...")
        team_games = build_team_game_stats(logs)
        print(f"  {len(team_games)} team-game rows")

        print("[XGBoost] Computing rolling features...")
        rolling_feats = compute_rolling_features(team_games)

        elo_ratings = load_elo()
        if elo_ratings:
            print(f"[XGBoost] Loaded Elo ratings for {len(elo_ratings)} teams")
        else:
            print("[XGBoost] No Elo ratings found — run ml/elo_model.py first")

        print("[XGBoost] Building matchup dataset...")
        df = build_matchup_dataset(team_games, rolling_feats, standings, profiles, elo_ratings)
        print(f"  {len(df)} matchups built")

        if len(df) < 50:
            print("[XGBoost] Not enough matchup data to train. Need at least 50 games.")
            conn.close()
            return

        # Train
        train_models(df)

    conn.close()


if __name__ == "__main__":
    main()
