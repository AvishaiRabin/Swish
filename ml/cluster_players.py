"""
cluster_players.py — Fuzzy archetype classifier for NBA players

Assigns each player a membership score (0.0–1.0) across 13 archetypes.
Scores are normalised to sum ≈ 1.0.  The primary archetype is the one
with the highest score.

Data sources (SQLite):
  player_profiles  — advanced stats, touches, drives, hustle
  players          — position, ppg, rpg, apg, spg, bpg, tp_pct
  player_game_logs — fg3a/fga to derive 3PA rate

Usage:
    python ml/cluster_players.py              # classify + write to DB
    python ml/cluster_players.py --dry-run    # print results, don't write
"""

import argparse
import io
import json
import sqlite3
import sys
from pathlib import Path

# Windows UTF-8 fix
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

DB_PATH = Path(__file__).parent.parent / ".data" / "courtside.db"

# ── The 13 archetypes ────────────────────────────────────────────────────────

ARCHETYPES = [
    "floor_general",
    "scoring_pg",
    "combo_guard",
    "large_playmaker",
    "three_and_d_wing",
    "two_way_wing",
    "shot_creating_wing",
    "point_wing",
    "stretch_big",
    "unicorn_big",
    "rim_running_big",
    "defensive_anchor",
    "versatile_pf",
]

DISPLAY = {
    "floor_general":      "Floor General",
    "scoring_pg":         "Scoring PG",
    "combo_guard":        "Combo Guard",
    "large_playmaker":    "Large Playmaker",
    "three_and_d_wing":   "3-and-D Wing",
    "two_way_wing":       "Two-Way Wing",
    "shot_creating_wing": "Shot-Creating Wing",
    "point_wing":         "Point Wing",
    "stretch_big":        "Stretch Big",
    "unicorn_big":        "Unicorn Big",
    "rim_running_big":    "Rim-Running Big",
    "defensive_anchor":   "Defensive Anchor",
    "versatile_pf":       "Versatile PF",
}

# ── Helpers ──────────────────────────────────────────────────────────────────

def _v(x, default=0.0):
    """Return x if not None, else default."""
    return x if x is not None else default


def scale(x, lo, hi):
    """Linear scale x from [lo, hi] → [0, 1], clamped."""
    if x is None:
        return 0.0
    if hi <= lo:
        return 0.0
    return max(0.0, min(1.0, (x - lo) / (hi - lo)))


def inv(x, lo, hi):
    """Inverse scale: 1.0 at lo, 0.0 at hi."""
    return 1.0 - scale(x, lo, hi)


def pos_weights(pos):
    """Soft positional weights from listed NBA position."""
    pos = (pos or "").strip().upper()
    return {
        "G":   {"guard": 1.0, "big_guard": 0.0, "wing": 0.0, "forward": 0.0, "big": 0.0},
        "G-F": {"guard": 0.6, "big_guard": 1.0, "wing": 0.5, "forward": 0.0, "big": 0.0},
        "F-G": {"guard": 0.3, "big_guard": 0.7, "wing": 0.8, "forward": 0.5, "big": 0.0},
        "F":   {"guard": 0.0, "big_guard": 0.0, "wing": 0.8, "forward": 1.0, "big": 0.3},
        "F-C": {"guard": 0.0, "big_guard": 0.0, "wing": 0.2, "forward": 0.7, "big": 0.8},
        "C-F": {"guard": 0.0, "big_guard": 0.0, "wing": 0.1, "forward": 0.4, "big": 0.9},
        "C":   {"guard": 0.0, "big_guard": 0.0, "wing": 0.0, "forward": 0.1, "big": 1.0},
    }.get(pos, {"guard": 0.3, "big_guard": 0.3, "wing": 0.4, "forward": 0.3, "big": 0.3})


# ── Scoring functions ────────────────────────────────────────────────────────
# Each returns a raw 0-1 affinity. Position is a soft factor (~15-25% weight).

def _floor_general(p, w):
    pos   = w["guard"] * 0.7 + w["big_guard"] * 0.3
    ast   = scale(p["ast_pct"], 15, 40)
    pases = scale(p["passes_made"], 30, 65)
    pot   = scale(p["potential_ast"], 5, 15)
    usg   = inv(p["usg_pct"], 18, 32)     # moderate, not a volume scorer
    ppg   = inv(p["ppg"], 22, 33)
    return pos * 0.20 + ast * 0.25 + pases * 0.15 + pot * 0.15 + usg * 0.15 + ppg * 0.10


def _scoring_pg(p, w):
    pos   = w["guard"] * 0.8 + w["big_guard"] * 0.5
    usg   = scale(p["usg_pct"], 23, 35)
    ppg   = scale(p["ppg"], 20, 33)
    drv   = scale(p["drives"], 8, 20)
    ast   = scale(p["ast_pct"], 8, 28)     # secondary playmaking
    ts    = scale(p["ts_pct"], 52, 65)
    return pos * 0.15 + usg * 0.25 + ppg * 0.20 + drv * 0.15 + ast * 0.10 + ts * 0.15


def _combo_guard(p, w):
    pos   = w["guard"] * 0.7 + w["big_guard"] * 0.5
    usg_m = 1.0 - abs(scale(p["usg_pct"], 10, 35) - 0.4) * 2.0
    usg_m = max(0.0, min(1.0, usg_m))
    ast   = scale(p["ast_pct"], 8, 22)
    defen = scale(p["deflections"], 1.0, 3.5) * 0.4 + scale(p["contested_shots"], 3, 12) * 0.3 + scale(p["spg"], 0.8, 2.0) * 0.3
    mod   = inv(p["ppg"], 24, 33) * 0.5 + inv(p["ast_pct"], 28, 40) * 0.5
    return pos * 0.15 + usg_m * 0.15 + ast * 0.15 + defen * 0.35 + mod * 0.20


def _large_playmaker(p, w):
    # SGA / Luka / LeBron type: 6'5"+ primary handler, size + creation
    pos   = w["big_guard"] * 0.5 + w["wing"] * 0.5 + w["forward"] * 0.3 + w["big"] * 0.2 + w["guard"] * 0.3
    pos   = min(1.0, pos)
    usg   = scale(p["usg_pct"], 25, 35)
    ast   = scale(p["ast_pct"], 15, 38)
    ppg   = scale(p["ppg"], 20, 33)
    drv   = scale(p["drives"], 8, 18)
    touch = scale(p["touches"], 55, 90)
    return pos * 0.15 + usg * 0.20 + ast * 0.20 + ppg * 0.15 + drv * 0.15 + touch * 0.15


def _three_and_d_wing(p, w):
    pos   = w["wing"] * 0.5 + w["guard"] * 0.4 + w["forward"] * 0.3 + w["big_guard"] * 0.4
    pos   = min(1.0, pos)
    lo_u  = inv(p["usg_pct"], 12, 22)
    t3r   = scale(p["fg3a_rate"], 0.30, 0.60)
    t3p   = scale(p["tp_pct"], 33, 42)
    defen = scale(p["deflections"], 1.0, 3.5) * 0.4 + scale(p["contested_shots"], 3, 12) * 0.6
    lo_a  = inv(p["ast_pct"], 8, 20)
    return pos * 0.10 + lo_u * 0.20 + t3r * 0.20 + t3p * 0.10 + defen * 0.30 + lo_a * 0.10


def _two_way_wing(p, w):
    pos   = w["wing"] * 0.6 + w["big_guard"] * 0.5 + w["forward"] * 0.4
    pos   = min(1.0, pos)
    usg   = scale(p["usg_pct"], 20, 32)
    ppg   = scale(p["ppg"], 16, 28)
    defen = (scale(p["deflections"], 1.0, 3.5) * 0.3
           + scale(p["contested_shots"], 4, 12) * 0.3
           + scale(p["spg"], 0.8, 2.0) * 0.2
           + scale(p["bpg"], 0.3, 1.5) * 0.2)
    ts    = scale(p["ts_pct"], 54, 64)
    return pos * 0.10 + usg * 0.20 + ppg * 0.20 + defen * 0.35 + ts * 0.15


def _shot_creating_wing(p, w):
    pos   = w["wing"] * 0.6 + w["big_guard"] * 0.4 + w["forward"] * 0.4
    pos   = min(1.0, pos)
    usg   = scale(p["usg_pct"], 24, 34)
    ppg   = scale(p["ppg"], 18, 30)
    drv   = scale(p["drives"], 5, 15)
    ts    = scale(p["ts_pct"], 52, 63)
    lo_d  = inv(p["deflections"], 0.5, 2.5)
    return pos * 0.10 + usg * 0.25 + ppg * 0.20 + drv * 0.15 + ts * 0.15 + lo_d * 0.15


def _point_wing(p, w):
    pos   = w["forward"] * 0.5 + w["wing"] * 0.5 + w["big_guard"] * 0.3 + w["big"] * 0.2
    pos   = min(1.0, pos)
    ast   = scale(p["ast_pct"], 15, 35)
    pases = scale(p["passes_made"], 25, 55)
    drv   = scale(p["drives"], 5, 14)
    # moderate scoring, not elite
    ppg_m = 1.0 - abs(scale(p["ppg"], 5, 30) - 0.45) * 1.5
    ppg_m = max(0.0, min(1.0, ppg_m))
    return pos * 0.20 + ast * 0.30 + pases * 0.15 + drv * 0.15 + ppg_m * 0.20


def _stretch_big(p, w):
    pos   = w["big"] * 0.6 + w["forward"] * 0.4
    pos   = min(1.0, pos)
    t3r   = scale(p["fg3a_rate"], 0.25, 0.55)
    t3p   = scale(p["tp_pct"], 30, 40)
    lo_po = inv(p["post_touches"], 2, 8)
    lo_pa = inv(p["paint_touches"], 5, 12)
    lo_u  = inv(p["usg_pct"], 15, 25)
    return pos * 0.25 + t3r * 0.25 + t3p * 0.15 + lo_po * 0.15 + lo_pa * 0.10 + lo_u * 0.10


def _unicorn_big(p, w):
    pos   = w["big"] * 0.5 + w["forward"] * 0.4
    pos   = min(1.0, pos)
    usg   = scale(p["usg_pct"], 22, 33)
    ppg   = scale(p["ppg"], 18, 30)
    ast   = scale(p["ast_pct"], 8, 28)
    ts    = scale(p["ts_pct"], 55, 67)
    t3r   = scale(p["fg3a_rate"], 0.08, 0.30)
    return pos * 0.20 + usg * 0.20 + ppg * 0.15 + ast * 0.20 + ts * 0.15 + t3r * 0.10


def _rim_running_big(p, w):
    pos   = w["big"] * 0.6 + w["forward"] * 0.3
    pos   = min(1.0, pos)
    lo_t3 = inv(p["fg3a_rate"], 0.02, 0.15)
    paint = scale(p["paint_touches"], 5, 14)
    scrn  = scale(p["screen_assists"], 2, 8)
    lo_u  = inv(p["usg_pct"], 12, 22)
    rpg   = scale(p["rpg"], 5, 12)
    return pos * 0.20 + lo_t3 * 0.20 + paint * 0.20 + scrn * 0.15 + lo_u * 0.10 + rpg * 0.15


def _defensive_anchor(p, w):
    pos   = w["big"] * 0.6 + w["forward"] * 0.3
    pos   = min(1.0, pos)
    bpg   = scale(p["bpg"], 1.0, 3.5)
    cont  = scale(p["contested_shots"], 5, 14)
    lo_u  = inv(p["usg_pct"], 10, 20)
    lo_p  = inv(p["ppg"], 8, 18)
    rpg   = scale(p["rpg"], 6, 13)
    return pos * 0.15 + bpg * 0.25 + cont * 0.20 + lo_u * 0.15 + lo_p * 0.10 + rpg * 0.15


def _versatile_pf(p, w):
    pos   = w["forward"] * 0.5 + w["big"] * 0.4 + w["wing"] * 0.2
    pos   = min(1.0, pos)
    t3r   = scale(p["fg3a_rate"], 0.15, 0.40)
    bpg   = scale(p["bpg"], 0.5, 2.5)
    spg   = scale(p["spg"], 0.4, 1.5)
    dual  = bpg * 0.5 + spg * 0.5
    allrd = scale(p["ppg"], 8, 20) * 0.3 + scale(p["rpg"], 4, 10) * 0.4 + scale(p["apg"], 1, 4) * 0.3
    cont  = scale(p["contested_shots"], 3, 10)
    return pos * 0.15 + t3r * 0.15 + dual * 0.25 + allrd * 0.20 + cont * 0.25


SCORERS = {
    "floor_general":      _floor_general,
    "scoring_pg":         _scoring_pg,
    "combo_guard":        _combo_guard,
    "large_playmaker":    _large_playmaker,
    "three_and_d_wing":   _three_and_d_wing,
    "two_way_wing":       _two_way_wing,
    "shot_creating_wing": _shot_creating_wing,
    "point_wing":         _point_wing,
    "stretch_big":        _stretch_big,
    "unicorn_big":        _unicorn_big,
    "rim_running_big":    _rim_running_big,
    "defensive_anchor":   _defensive_anchor,
    "versatile_pf":       _versatile_pf,
}


# ── Classification ───────────────────────────────────────────────────────────

def classify(p):
    """Return (scores_dict, primary_key) for one player dict."""
    w = pos_weights(p.get("pos"))
    raw = {name: fn(p, w) for name, fn in SCORERS.items()}

    # Zero out noise
    for k in raw:
        if raw[k] < 0.02:
            raw[k] = 0.0

    total = sum(raw.values())
    if total > 0:
        norm = {k: round(v / total, 3) for k, v in raw.items()}
    else:
        norm = {k: 0.0 for k in raw}

    primary = max(norm, key=norm.get)
    return norm, primary


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Fuzzy NBA archetype classifier")
    parser.add_argument("--dry-run", action="store_true", help="Print results, don't write")
    args = parser.parse_args()

    if not DB_PATH.exists():
        print(f"ERROR: DB not found at {DB_PATH}", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # ── Load player profiles + basic stats + 3PA rate from game logs ─────
    rows = conn.execute("""
        SELECT
            pp.*,
            p.pos,
            p.ppg,
            p.rpg,
            p.apg,
            p.spg,
            p.bpg,
            p.tp_pct,
            p.fg_pct
        FROM player_profiles pp
        LEFT JOIN players p ON pp.player_id = p.player_id
        WHERE pp.updated_at IS NOT NULL
    """).fetchall()

    print(f"Loaded {len(rows)} player profiles")
    if len(rows) < 20:
        print("ERROR: Not enough profiles.", file=sys.stderr)
        sys.exit(1)

    # Compute 3PA rate from game logs (season aggregate)
    fg3a_rates = {}
    gl_rows = conn.execute("""
        SELECT player_id,
               SUM(fg3a) AS total_fg3a,
               SUM(fga)  AS total_fga
        FROM player_game_logs
        WHERE season = '2025-26' AND fga > 0
        GROUP BY player_id
    """).fetchall()
    for r in gl_rows:
        fga = r["total_fga"]
        if fga and fga > 0:
            fg3a_rates[r["player_id"]] = (r["total_fg3a"] or 0) / fga

    # ── Classify each player ─────────────────────────────────────────────
    results = []
    for row in rows:
        pid = row["player_id"]
        p = {
            "pos":             row["pos"],
            "usg_pct":         _v(row["usg_pct"], 0) * 100,     # stored as 0-1, convert to %
            "ts_pct":          _v(row["ts_pct"], 0) * 100,
            "ast_pct":         _v(row["ast_pct"], 0) * 100,
            "oreb_pct":        _v(row["oreb_pct"], 0),
            "dreb_pct":        _v(row["dreb_pct"], 0),
            "net_rating":      _v(row["net_rating"], 0),
            "touches":         _v(row["touches"], 0),
            "paint_touches":   _v(row["paint_touches"], 0),
            "post_touches":    _v(row["post_touches"], 0),
            "elbow_touches":   _v(row["elbow_touches"], 0),
            "passes_made":     _v(row["passes_made"], 0),
            "potential_ast":   _v(row["potential_ast"], 0),
            "drives":          _v(row["drives"], 0),
            "contested_shots": _v(row["contested_shots"], 0),
            "deflections":     _v(row["deflections"], 0),
            "screen_assists":  _v(row["screen_assists"], 0),
            "ppg":             _v(row["ppg"], 0),
            "rpg":             _v(row["rpg"], 0),
            "apg":             _v(row["apg"], 0),
            "spg":             _v(row["spg"], 0),
            "bpg":             _v(row["bpg"], 0),
            "tp_pct":          _v(row["tp_pct"], 0),
            "fg_pct":          _v(row["fg_pct"], 0),
            "fg3a_rate":       fg3a_rates.get(pid, 0.0),
        }
        scores, primary = classify(p)
        results.append({
            "player_id": pid,
            "name":      row["name"],
            "team":      row["team"],
            "pos":       row["pos"],
            "scores":    scores,
            "primary":   primary,
        })

    # ── Print results ────────────────────────────────────────────────────
    # Group by primary archetype
    by_arch = {}
    for r in results:
        by_arch.setdefault(r["primary"], []).append(r)

    print(f"\nArchetype distribution ({len(results)} players):")
    for arch in ARCHETYPES:
        players = by_arch.get(arch, [])
        print(f"\n  {DISPLAY[arch]:<22} ({len(players)} players)")
        # Show top 5 by primary score
        for pl in sorted(players, key=lambda x: x["scores"][arch], reverse=True)[:5]:
            s = pl["scores"]
            top3 = sorted(s.items(), key=lambda x: -x[1])[:3]
            top3_str = ", ".join(f"{DISPLAY[k]}:{v:.2f}" for k, v in top3 if v > 0)
            print(f"    {pl['name']:<24} ({pl['pos']:<3} {pl['team']}) → {top3_str}")

    if args.dry_run:
        print("\nDry run — no DB changes.")
        conn.close()
        return

    # ── Write to DB ──────────────────────────────────────────────────────
    # Add score columns if missing
    arch_cols = [f"arch_{a}" for a in ARCHETYPES]
    for col in arch_cols:
        try:
            conn.execute(f"ALTER TABLE player_profiles ADD COLUMN {col} REAL")
        except sqlite3.OperationalError:
            pass

    set_clause = ", ".join(f"arch_{a} = ?" for a in ARCHETYPES)
    sql = f"UPDATE player_profiles SET archetype_label = ?, {set_clause} WHERE player_id = ?"

    cur = conn.cursor()
    for r in results:
        label = DISPLAY[r["primary"]]
        vals  = [r["scores"][a] for a in ARCHETYPES]
        cur.execute(sql, [label] + vals + [r["player_id"]])

    conn.commit()
    conn.close()
    print(f"\nWritten {len(results)} fuzzy archetype profiles to DB.")


if __name__ == "__main__":
    main()
