"""
cluster_players.py - K-means player archetype clustering

Reads player_profiles + position data from .data/courtside.db, clusters
players into basketball-specific archetypes, and writes archetype +
archetype_label back to player_profiles.

Two-phase labeling:
  1. Cluster centroids get a base label from stat rules
  2. Individual players get position-adjusted labels
     (e.g., a LEAD_GUARD listed as F -> POINT_FORWARD)

Final archetypes:
  Guards:  LEAD_GUARD, SCORING_GUARD, OVERSIZED_PLAYMAKER, ROLE_GUARD,
           TWO_WAY_GUARD, 3_AND_D_GUARD
  Wings:   TWO_WAY_WING, SHOT_CREATING_WING, 3_AND_D_WING
  Bigs:    PAINT_BEAST, ANCHOR_BIG
  Hybrid:  POINT_FORWARD
  Other:   ROLE_PLAYER

Usage:
    python ml/cluster_players.py               # cluster + write to DB
    python ml/cluster_players.py --dry-run     # print results, don't write
    python ml/cluster_players.py --k 8         # override cluster count

Dependencies:
    pip install scikit-learn pandas numpy
"""

import argparse
import io
import sqlite3
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

# Fix Windows console encoding for accented player names
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

DB_PATH = Path(__file__).parent.parent / ".data" / "courtside.db"

# ---------------------------------------------------------------------------
# Feature sets
# ---------------------------------------------------------------------------

STAT_FEATURES = [
    "usg_pct",           # offensive role / ball dominance
    "ts_pct",            # shooting efficiency
    "ast_pct",           # playmaking
    "ast_to",            # passing quality (assist-to-turnover)
    "oreb_pct",          # offensive rebounding
    "dreb_pct",          # defensive rebounding
    "contested_shots",   # rim protection / contesting
    "deflections",       # defensive activity
    "screen_assists",    # screen-based play (big man indicator)
    "net_rating",        # overall impact
]

POSITION_FEATURES = ["is_guard", "is_wing", "is_big"]
ALL_FEATURES = STAT_FEATURES + POSITION_FEATURES

# ---------------------------------------------------------------------------
# Position encoding
# ---------------------------------------------------------------------------

POSITION_ENCODING = {
    "G":   {"is_guard": 1.0, "is_wing": 0.0, "is_big": 0.0},
    "G-F": {"is_guard": 0.7, "is_wing": 0.5, "is_big": 0.0},
    "F-G": {"is_guard": 0.5, "is_wing": 0.7, "is_big": 0.0},
    "F":   {"is_guard": 0.0, "is_wing": 1.0, "is_big": 0.0},
    "F-C": {"is_guard": 0.0, "is_wing": 0.5, "is_big": 0.5},
    "C-F": {"is_guard": 0.0, "is_wing": 0.3, "is_big": 0.7},
    "C":   {"is_guard": 0.0, "is_wing": 0.0, "is_big": 1.0},
}


def encode_position(pos_str, row=None):
    """Convert NBA position string to numeric features."""
    pos = (pos_str or "").strip().upper()
    if pos in POSITION_ENCODING:
        return POSITION_ENCODING[pos]
    # Infer from stats for empty/unknown positions
    if row is not None:
        dreb = row.get("dreb_pct", 0) or 0
        oreb = row.get("oreb_pct", 0) or 0
        ast = row.get("ast_pct", 0) or 0
        if dreb > 0.15 or oreb > 0.06:
            return {"is_guard": 0.0, "is_wing": 0.2, "is_big": 0.8}
        if ast > 0.25:
            return {"is_guard": 0.8, "is_wing": 0.2, "is_big": 0.0}
        return {"is_guard": 0.2, "is_wing": 0.6, "is_big": 0.2}
    return {"is_guard": 0.33, "is_wing": 0.34, "is_big": 0.33}


# ---------------------------------------------------------------------------
# Phase 1: Centroid-based archetype rules
# Evaluated in order against un-scaled centroids. First full match wins.
# ---------------------------------------------------------------------------

ARCHETYPE_RULES = [
    # Bigs (check first - most positionally distinct)
    ("PAINT_BEAST", {
        "is_big": (0.4, None),
        "contested_shots": (5.0, None),
    }),
    ("ANCHOR_BIG", {
        "is_big": (0.4, None),
        "contested_shots": (3.0, None),
    }),

    # Guards
    ("LEAD_GUARD", {
        "is_guard": (0.5, None),
        "ast_pct": (0.20, None),
    }),
    ("SCORING_GUARD", {
        "is_guard": (0.5, None),
        "usg_pct": (0.18, None),
    }),
    ("ROLE_GUARD", {
        "is_guard": (0.5, None),
    }),

    # Wings
    ("TWO_WAY_WING", {
        "is_wing": (0.4, None),
        "usg_pct": (0.18, None),
        "contested_shots": (3.5, None),
    }),
    ("3_AND_D_WING", {
        "is_wing": (0.4, None),
        "usg_pct": (None, 0.18),
    }),
    ("SHOT_CREATING_WING", {
        "is_wing": (0.3, None),
        "usg_pct": (0.18, None),
    }),
]


def label_centroid(centroid):
    """Assign a base archetype label to a cluster centroid."""
    for label, rules in ARCHETYPE_RULES:
        match = True
        for feat, (lo, hi) in rules.items():
            val = centroid.get(feat)
            if val is None:
                match = False
                break
            if lo is not None and val < lo:
                match = False
                break
            if hi is not None and val > hi:
                match = False
                break
        if match:
            return label
    return "ROLE_PLAYER"


# ---------------------------------------------------------------------------
# Phase 2: Per-player position overrides
# When a player's listed position doesn't match their cluster's archetype,
# re-label to a more accurate type.
#
# Example: Luka Doncic (F-G) clusters with guards due to high AST%/USG%
#          -> override from LEAD_GUARD to POINT_FORWARD
# ---------------------------------------------------------------------------

POSITION_OVERRIDES = {
    # Forwards/bigs who play like lead guards = Point Forward
    ("LEAD_GUARD", "F"):    "POINT_FORWARD",
    ("LEAD_GUARD", "F-G"):  "POINT_FORWARD",
    ("LEAD_GUARD", "F-C"):  "POINT_FORWARD",
    ("LEAD_GUARD", "C"):    "POINT_FORWARD",
    ("LEAD_GUARD", "C-F"):  "POINT_FORWARD",
    # Big guards (G-F) with elite playmaking = Oversized Playmaker
    ("LEAD_GUARD", "G-F"):  "OVERSIZED_PLAYMAKER",

    # Forwards with scoring-guard style = Shot Creating Wing
    ("SCORING_GUARD", "F"):    "SHOT_CREATING_WING",
    ("SCORING_GUARD", "F-G"):  "SHOT_CREATING_WING",
    ("SCORING_GUARD", "F-C"):  "SHOT_CREATING_WING",

    # Guards in wing-defined clusters
    ("TWO_WAY_WING", "G"):    "TWO_WAY_GUARD",
    ("TWO_WAY_WING", "G-F"):  "TWO_WAY_GUARD",
    ("3_AND_D_WING", "G"):    "3_AND_D_GUARD",
    ("3_AND_D_WING", "G-F"):  "3_AND_D_GUARD",
    ("SHOT_CREATING_WING", "G"):    "SCORING_GUARD",
    ("SHOT_CREATING_WING", "G-F"):  "SCORING_GUARD",
}


def apply_position_override(base_label, pos):
    """Adjust archetype label based on individual player position."""
    pos = (pos or "").strip().upper()
    return POSITION_OVERRIDES.get((base_label, pos), base_label)


# ---------------------------------------------------------------------------
# Clustering
# ---------------------------------------------------------------------------

def find_best_k(X_scaled, k_range):
    """Use silhouette score to pick best k."""
    scores = {}
    for k in k_range:
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = km.fit_predict(X_scaled)
        scores[k] = silhouette_score(X_scaled, labels)
        print(f"  k={k}  silhouette={scores[k]:.4f}")
    best_k = max(scores, key=scores.get)
    print(f"  -> Best k: {best_k} (silhouette={scores[best_k]:.4f})")
    return best_k


def main():
    parser = argparse.ArgumentParser(description="Cluster NBA players into positional archetypes")
    parser.add_argument("--dry-run", action="store_true", help="Print results, don't write to DB")
    parser.add_argument("--k", type=int, default=None, help="Number of clusters (default: auto 6-10)")
    args = parser.parse_args()

    if not DB_PATH.exists():
        print(f"ERROR: DB not found at {DB_PATH}", file=sys.stderr)
        sys.exit(1)

    # -- Load data ----------------------------------------------------------
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql("""
        SELECT pp.*, p.pos
        FROM player_profiles pp
        LEFT JOIN players p ON pp.player_id = p.player_id
        WHERE pp.updated_at IS NOT NULL
    """, conn)
    print(f"Loaded {len(df)} player profiles")

    if len(df) < 20:
        print("ERROR: Not enough profiles (need >= 20).", file=sys.stderr)
        sys.exit(1)

    # -- Encode positions ---------------------------------------------------
    pos_data = []
    for idx, row in df.iterrows():
        pos_data.append(encode_position(row.get("pos", ""), row))
    pos_df = pd.DataFrame(pos_data, index=df.index)
    df = pd.concat([df, pos_df], axis=1)

    # -- Feature matrix (skip columns with <10% non-null) -------------------
    available = []
    for f in ALL_FEATURES:
        if f not in df.columns:
            continue
        if df[f].notna().sum() < len(df) * 0.1:
            print(f"  Skipping {f}: insufficient data")
            continue
        available.append(f)
    print(f"Using {len(available)} features: {available}")

    X = df[available].copy()
    imputer = SimpleImputer(strategy="median")
    X_imp = imputer.fit_transform(X)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_imp)

    # -- Choose k -----------------------------------------------------------
    if args.k:
        k = args.k
        print(f"Using k={k} (user-specified)")
    else:
        print("Finding best k (silhouette method, k=6..10)...")
        k = find_best_k(X_scaled, range(6, 11))

    # -- Fit KMeans ---------------------------------------------------------
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    df.loc[:, "archetype"] = km.fit_predict(X_scaled)

    # -- Phase 1: Label clusters from centroids -----------------------------
    centroids_orig = scaler.inverse_transform(km.cluster_centers_)
    centroid_dicts = [dict(zip(available, row)) for row in centroids_orig]
    cluster_labels = {i: label_centroid(c) for i, c in enumerate(centroid_dicts)}

    # Reclassify garbage clusters (very low TS or very negative NET) as ROLE_PLAYER
    for cid, cd in enumerate(centroid_dicts):
        ts = cd.get("ts_pct", 0)
        net = cd.get("net_rating", 0)
        if ts < 0.30 or net < -20:
            cluster_labels[cid] = "ROLE_PLAYER"

    # Disambiguate remaining duplicate cluster labels with position suffix
    label_counts = {}
    for cid, label in sorted(cluster_labels.items()):
        label_counts[label] = label_counts.get(label, 0) + 1
    for cid, label in list(cluster_labels.items()):
        if label == "ROLE_PLAYER":
            continue  # don't disambiguate role players
        if label_counts.get(label, 0) > 1:
            c = centroid_dicts[cid]
            gs = c.get("is_guard", 0)
            ws = c.get("is_wing", 0)
            bs = c.get("is_big", 0)
            mx = max(gs, ws, bs)
            suffix = "_BIG" if mx == bs else ("_GUARD" if mx == gs else "_WING")
            cluster_labels[cid] = f"{label}{suffix}"

    # -- Phase 2: Per-player position overrides -----------------------------
    final_labels = []
    for _, row in df.iterrows():
        base = cluster_labels[row["archetype"]]
        final = apply_position_override(base, row.get("pos", ""))
        final_labels.append(final)
    df.loc[:, "archetype_label"] = final_labels

    # -- Print centroid details ---------------------------------------------
    print("\nCluster centroids:")
    for cid, cd in enumerate(centroid_dicts):
        usg = cd.get("usg_pct", 0) * 100
        ts = cd.get("ts_pct", 0) * 100
        ast = cd.get("ast_pct", 0) * 100
        cont = cd.get("contested_shots", 0)
        defl = cd.get("deflections", 0)
        scr = cd.get("screen_assists", 0)
        net = cd.get("net_rating", 0)
        ig = cd.get("is_guard", 0)
        iw = cd.get("is_wing", 0)
        ib = cd.get("is_big", 0)
        print(f"  C{cid} [{cluster_labels[cid]}]: USG={usg:.1f}% TS={ts:.1f}% AST={ast:.1f}% "
              f"CONT={cont:.1f} DEFL={defl:.1f} SCR={scr:.1f} NET={net:+.1f} "
              f"pos=[G={ig:.2f} W={iw:.2f} B={ib:.2f}]")

    # -- Print summary table ------------------------------------------------
    header = f"{'CL':<4} {'CLUSTER_TYPE':<22} {'N':<5} {'USG%':<7} {'TS%':<7} {'AST%':<7} {'NET':<7}"
    print(f"\n{'-' * len(header)}")
    print(header)
    print(f"{'-' * len(header)}")
    for cid in sorted(df["archetype"].unique()):
        group = df[df["archetype"] == cid]
        label = cluster_labels[cid]
        n = len(group)
        usg = group["usg_pct"].mean() * 100
        ts = group["ts_pct"].mean() * 100
        ast = group["ast_pct"].mean() * 100
        net = group["net_rating"].mean()
        print(f"{cid:<4} {label:<22} {n:<5} {usg:<7.1f} {ts:<7.1f} {ast:<7.1f} {net:<+7.1f}")

    # -- Print archetype distribution (after position overrides) ------------
    print(f"\nFinal archetype distribution (after position overrides):")
    for label in sorted(df["archetype_label"].unique()):
        group = df[df["archetype_label"] == label]
        top = ", ".join(
            f"{r['name']} ({r['team']}, {r.get('pos', '?')})"
            for _, r in group.sort_values("usg_pct", ascending=False).head(4).iterrows()
        )
        print(f"  {label:<24} ({len(group):>3} players)")
        print(f"    {top}")
    print()

    if args.dry_run:
        print("Dry run - no changes written to DB.")
        conn.close()
        return

    # -- Write back to DB ---------------------------------------------------
    cur = conn.cursor()
    for col, coltype in [("archetype", "INTEGER"), ("archetype_label", "TEXT")]:
        try:
            cur.execute(f"ALTER TABLE player_profiles ADD COLUMN {col} {coltype}")
        except sqlite3.OperationalError:
            pass

    for _, row in df.iterrows():
        cur.execute(
            "UPDATE player_profiles SET archetype = ?, archetype_label = ? WHERE player_id = ?",
            (int(row["archetype"]), row["archetype_label"], int(row["player_id"])),
        )
    conn.commit()
    conn.close()
    print(f"Written {len(df)} archetype assignments to player_profiles.")


if __name__ == "__main__":
    main()
