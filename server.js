import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { setDefaultResultOrder } from "dns";
import Database from "better-sqlite3";

// Force IPv4-first DNS resolution — IPv6 SSL handshake fails on this network
setDefaultResultOrder("ipv4first");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, ".data");
const DB_PATH = path.join(DATA_DIR, "courtside.db");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// SQLite setup
// ---------------------------------------------------------------------------
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    player_id   INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    team        TEXT,
    pos         TEXT,
    gp          INTEGER,
    mpg         REAL,
    ppg         REAL,
    rpg         REAL,
    apg         REAL,
    spg         REAL,
    bpg         REAL,
    fg_pct      REAL,
    tp_pct      REAL,
    ft_pct      REAL,
    topg        REAL,
    plus_minus  REAL
  );

  CREATE TABLE IF NOT EXISTS standings (
    team        TEXT PRIMARY KEY,
    conference  TEXT,
    division    TEXT,
    team_id     INTEGER,
    wins        INTEGER,
    losses      INTEGER,
    pct         REAL,
    gb          TEXT,
    home_rec    TEXT,
    away_rec    TEXT,
    streak      TEXT,
    last10      TEXT,
    ppg         REAL,
    opp_ppg     REAL,
    diff        TEXT
  );

  CREATE TABLE IF NOT EXISTS league_leaders (
    category    TEXT,
    rank_num    INTEGER,
    player_name TEXT,
    team        TEXT,
    value       REAL,
    PRIMARY KEY (category, rank_num)
  );

  CREATE TABLE IF NOT EXISTS lineups (
    team        TEXT NOT NULL,
    group_size  INTEGER NOT NULL,
    group_name  TEXT NOT NULL,
    gp          INTEGER,
    min         REAL,
    pts         REAL,
    fg_pct      REAL,
    ortg        REAL,
    drtg        REAL,
    net_rtg     REAL,
    plus_minus  REAL,
    PRIMARY KEY (team, group_size, group_name)
  );

  CREATE TABLE IF NOT EXISTS meta (
    key         TEXT PRIMARY KEY,
    updated_at  INTEGER
  );

  CREATE TABLE IF NOT EXISTS player_profiles (
    player_id         INTEGER PRIMARY KEY,
    name              TEXT,
    team              TEXT,
    -- Advanced metrics
    usg_pct           REAL,
    ts_pct            REAL,
    ast_pct           REAL,
    ast_to            REAL,
    oreb_pct          REAL,
    dreb_pct          REAL,
    net_rating        REAL,
    pie               REAL,
    pace              REAL,
    -- Touch / possession breakdown
    touches           REAL,
    time_of_poss      REAL,
    front_ct_touches  REAL,
    elbow_touches     REAL,
    post_touches      REAL,
    paint_touches     REAL,
    -- Passing / creation
    passes_made       REAL,
    potential_ast     REAL,
    ast_pts_created   REAL,
    -- Drives
    drives            REAL,
    drive_pts         REAL,
    drive_fg_pct      REAL,
    drive_ast         REAL,
    -- Hustle / defense
    contested_shots   REAL,
    deflections       REAL,
    screen_assists    REAL,
    charges_drawn     REAL,
    -- Recent form (last 15 games)
    l15_ppg           REAL,
    l15_usg_pct       REAL,
    l15_ts_pct        REAL,
    form_factor       REAL,
    updated_at        INTEGER
  );

  CREATE TABLE IF NOT EXISTS player_game_logs (
    player_id    INTEGER NOT NULL,
    player_name  TEXT,
    team         TEXT,
    season       TEXT NOT NULL,
    game_date    TEXT NOT NULL,
    opponent     TEXT,
    home         INTEGER,
    min_played   REAL,
    pts          INTEGER,
    reb          INTEGER,
    ast          INTEGER,
    stl          INTEGER,
    blk          INTEGER,
    fgm          INTEGER,
    fga          INTEGER,
    fg3m         INTEGER,
    fg3a         INTEGER,
    ftm          INTEGER,
    fta          INTEGER,
    tov          INTEGER,
    plus_minus   REAL,
    PRIMARY KEY (player_id, season, game_date)
  );

  CREATE TABLE IF NOT EXISTS predictions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    prediction_date TEXT NOT NULL,
    game_id         TEXT,
    home_team       TEXT NOT NULL,
    away_team       TEXT NOT NULL,
    predicted_winner TEXT NOT NULL,
    predicted_spread REAL,
    confidence      REAL,
    home_score_pred INTEGER,
    away_score_pred INTEGER,
    upset_alert     INTEGER DEFAULT 0,
    reasoning       TEXT,
    player_props    TEXT,
    raw_response    TEXT,
    created_at      INTEGER NOT NULL,
    UNIQUE(prediction_date, home_team, away_team)
  );

  CREATE TABLE IF NOT EXISTS lineup_profiles (
    lineup_id         TEXT PRIMARY KEY,
    team              TEXT,
    group_name        TEXT,
    player_archetypes TEXT,
    lineup_archetype  TEXT,
    gp                INTEGER,
    min               REAL,
    pts               REAL,
    fg_pct            REAL,
    ortg              REAL,
    drtg              REAL,
    net_rtg           REAL,
    plus_minus        REAL,
    updated_at        INTEGER
  );

  DROP TABLE IF EXISTS team_archetypes;
  CREATE TABLE IF NOT EXISTS team_archetypes (
    team              TEXT PRIMARY KEY,
    off_pace_space    REAL, off_paint_beast REAL, off_motion REAL,
    off_iso_heavy     REAL, off_transition REAL, off_pick_roll REAL,
    off_archetype     TEXT,
    def_perimeter_lock REAL, def_rim_protection REAL, def_switchable REAL,
    def_blitz_press   REAL, def_pack_paint REAL, def_help_zone REAL,
    def_archetype     TEXT,
    pace REAL, fg3a_rate REAL, paint_touch_rate REAL, ast_rate REAL,
    drive_rate REAL, stl_rate REAL, blk_rate REAL, deflection_rate REAL,
    updated_at        INTEGER
  );

  CREATE TABLE IF NOT EXISTS team_stats_cache (
    team           TEXT PRIMARY KEY,
    ortg           REAL, drtg REAL, pace REAL, net_rtg REAL,
    efg_pct        REAL, tov_pct REAL, orb_pct REAL, ft_rate REAL,
    ppg            REAL, opp_ppg REAL, fg_pct REAL, tp_pct REAL,
    home_ppg       REAL, home_opp_ppg REAL, home_fg_pct REAL, home_tp_pct REAL,
    away_ppg       REAL, away_opp_ppg REAL, away_fg_pct REAL, away_tp_pct REAL,
    games_played   INTEGER,
    home_games     INTEGER, away_games INTEGER,
    updated_at     INTEGER
  );

  CREATE TABLE IF NOT EXISTS team_game_results (
    team        TEXT NOT NULL,
    season      TEXT NOT NULL,
    game_date   TEXT NOT NULL,
    opponent    TEXT,
    home        INTEGER,
    pts         INTEGER,
    opp_pts     INTEGER,
    win         INTEGER,
    PRIMARY KEY (team, season, game_date)
  );

  CREATE TABLE IF NOT EXISTS prediction_results (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    prediction_date TEXT NOT NULL,
    game_id         TEXT,
    home_team       TEXT NOT NULL,
    away_team       TEXT NOT NULL,
    predicted_winner TEXT NOT NULL,
    actual_winner   TEXT,
    predicted_spread REAL,
    actual_spread   REAL,
    home_score_pred INTEGER,
    away_score_pred INTEGER,
    home_score_actual INTEGER,
    away_score_actual INTEGER,
    correct         INTEGER,
    spread_error    REAL,
    player_props    TEXT,
    graded_at       INTEGER,
    UNIQUE(prediction_date, home_team, away_team)
  );
`);

// Migrate existing player_profiles tables that predate the L15 columns
for (const col of ["l15_ppg", "l15_usg_pct", "l15_ts_pct", "form_factor"]) {
  try { db.exec(`ALTER TABLE player_profiles ADD COLUMN ${col} REAL`); } catch {}
}
// Archetype columns written by ml/cluster_players.py
try { db.exec("ALTER TABLE player_profiles ADD COLUMN archetype INTEGER"); } catch {}
try { db.exec("ALTER TABLE player_profiles ADD COLUMN archetype_label TEXT"); } catch {}
// 13 fuzzy archetype score columns (0.0–1.0 each, sum ≈ 1.0)
for (const a of [
  "floor_general", "scoring_pg", "combo_guard", "large_playmaker",
  "three_and_d_wing", "two_way_wing", "shot_creating_wing", "point_wing",
  "stretch_big", "unicorn_big", "rim_running_big", "defensive_anchor", "versatile_pf",
]) {
  try { db.exec(`ALTER TABLE player_profiles ADD COLUMN arch_${a} REAL`); } catch {}
}
// Off/Def rating columns (already fetched, were not being stored)
for (const col of ["off_rating", "def_rating"]) {
  try { db.exec(`ALTER TABLE player_profiles ADD COLUMN ${col} REAL`); } catch {}
}

// ---------------------------------------------------------------------------
// NBA API helpers
// ---------------------------------------------------------------------------
const SEASON = "2025-26";
const NBA_BASE = "https://stats.nba.com/stats";
const NBA_HEADERS = {
  "User-Agent": "Mozilla/5.0",
  Referer: "https://www.nba.com/",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://www.nba.com",
  Host: "stats.nba.com",
  Connection: "keep-alive",
};

async function fetchNBAEndpoint(endpoint, params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = `${NBA_BASE}/${endpoint}${query ? "?" + query : ""}`;
  const response = await fetch(url, { headers: NBA_HEADERS });
  if (!response.ok) throw new Error(`NBA API ${response.status} for ${endpoint}`);
  return response.json();
}

function parseResultSet(data, index = 0) {
  const rs = data.resultSets[index];
  return rs.rowSet.map((row) => {
    const obj = {};
    rs.headers.forEach((h, i) => (obj[h] = row[i]));
    return obj;
  });
}

const ABBR_REMAP = {
  NY: "NYK", BRK: "BKN", BRO: "BKN",
  // "NEW" removed — ambiguous between New York and New Orleans; use TeamID instead
  GS: "GSW", GOL: "GSW",
  SA: "SAS", SAN: "SAS",
  NO: "NOP", PHO: "PHX",
  OKL: "OKC", LA: "LAC", LOS: "LAL",
};
function normalizeAbbr(abbr) {
  if (!abbr) return abbr;
  return ABBR_REMAP[abbr] || abbr;
}

// Authoritative TeamID → abbreviation map (used as fallback when TeamAbbreviation is null/wrong)
const TEAM_ID_ABBR = {
  1610612737: "ATL", 1610612738: "BOS", 1610612739: "CLE",
  1610612740: "NOP", 1610612741: "CHI", 1610612742: "DAL",
  1610612743: "DEN", 1610612744: "GSW", 1610612745: "HOU",
  1610612746: "LAC", 1610612747: "LAL", 1610612748: "MIA",
  1610612749: "MIL", 1610612750: "MIN", 1610612751: "BKN",
  1610612752: "NYK", 1610612753: "ORL", 1610612754: "IND",
  1610612755: "PHI", 1610612756: "PHX", 1610612757: "POR",
  1610612758: "SAC", 1610612759: "SAS", 1610612760: "OKC",
  1610612761: "TOR", 1610612762: "UTA", 1610612763: "MEM",
  1610612764: "WAS", 1610612765: "DET", 1610612766: "CHA",
};
function teamAbbr(abbr, teamId) {
  if (abbr) return normalizeAbbr(abbr);
  return TEAM_ID_ABBR[teamId] || "???";
}

// Convert NBA date strings ("OCT 22, 2025" or any parseable) to "YYYY-MM-DD"
function toISODate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isStale(key, ttlMs = 24 * 60 * 60 * 1000) {
  const row = db.prepare("SELECT updated_at FROM meta WHERE key = ?").get(key);
  if (!row) return true;
  return Date.now() - row.updated_at > ttlMs;
}

function isEmpty(table) {
  return db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c === 0;
}

// ---------------------------------------------------------------------------
// Refresh functions — fetch from NBA API and persist in SQLite
// ---------------------------------------------------------------------------
async function refreshPlayers() {
  console.log("[DB] Refreshing players...");

  // leaguedashplayerstats has no position field — fetch positions separately from playerindex
  const [statsData, indexData] = await Promise.all([
    fetchNBAEndpoint("leaguedashplayerstats", {
      Conference: "", DateFrom: "", DateTo: "", Division: "",
      GameScope: "", GameSegment: "", Height: "", LastNGames: 0,
      LeagueID: "00", Location: "", MeasureType: "Base", Month: 0,
      OpponentTeamID: 0, Outcome: "", PORound: 0, PaceAdjust: "N",
      PerMode: "PerGame", Period: 0, PlayerExperience: "",
      PlayerPosition: "", PlusMinus: "N", Rank: "N", Season: SEASON,
      SeasonSegment: "", SeasonType: "Regular Season", ShotClockRange: "",
      StarterBench: "", TeamID: 0, TwoWay: 0, VsConference: "",
      VsDivision: "", Weight: "",
    }),
    fetchNBAEndpoint("playerindex", { LeagueID: "00", Season: SEASON, Active: 1 }),
  ]);

  const rows = parseResultSet(statsData, 0);
  const indexRows = parseResultSet(indexData, 0);

  // Build position map: PERSON_ID → POSITION
  const posMap = {};
  for (const r of indexRows) posMap[r.PERSON_ID] = r.POSITION || "";

  const ins = db.prepare(
    `INSERT OR REPLACE INTO players VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  db.transaction(() => {
    db.prepare("DELETE FROM players").run();
    for (const r of rows) {
      ins.run(
        r.PLAYER_ID, r.PLAYER_NAME,
        normalizeAbbr(r.TEAM_ABBREVIATION),
        posMap[r.PLAYER_ID] || "",
        r.GP, r.MIN, r.PTS, r.REB, r.AST, r.STL, r.BLK,
        r.FG_PCT, r.FG3_PCT, r.FT_PCT, r.TOV, r.PLUS_MINUS
      );
    }
    db.prepare("INSERT OR REPLACE INTO meta VALUES ('players',?)").run(Date.now());
  })();
  console.log(`[DB] Players: ${rows.length} rows saved (positions from playerindex)`);
}

async function refreshStandings() {
  console.log("[DB] Refreshing standings...");
  const data = await fetchNBAEndpoint("leaguestandingsv3", {
    LeagueID: "00", Season: SEASON, SeasonType: "Regular Season",
  });
  const rows = parseResultSet(data, 0);

  const ins = db.prepare(
    `INSERT OR REPLACE INTO standings VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  db.transaction(() => {
    db.prepare("DELETE FROM standings").run();
    for (const r of rows) {
      const wins = r.WINS || 0;
      const losses = r.LOSSES || 0;
      const gp = wins + losses || 1;
      const conf = r.Conference === "East" ? "East" : "West";
      const pf = r.PointsFor || 0;
      const pa = r.PointsAgainst || 0;
      ins.run(
        teamAbbr(r.TeamAbbreviation, r.TeamID),
        conf, r.Division || "", r.TeamID,
        wins, losses,
        +(wins / gp).toFixed(3),
        r.ConferenceGamesBack || "-",
        r.HOME || `${r.HomeWins || 0}-${r.HomeLosses || 0}`,
        r.ROAD || `${r.RoadWins || 0}-${r.RoadLosses || 0}`,
        r.strCurrentStreak || r.CurrentStreak || "—",
        r.L10 || `${r.Last10Wins || 0}-${r.Last10Losses || 0}`,
        r.PointsPG != null ? +r.PointsPG.toFixed(1) : +(pf / gp).toFixed(1),
        r.OppPointsPG != null ? +r.OppPointsPG.toFixed(1) : +(pa / gp).toFixed(1),
        r.DiffPointsPG != null
          ? (r.DiffPointsPG >= 0 ? "+" : "") + r.DiffPointsPG.toFixed(1)
          : ((pf - pa) / gp >= 0 ? "+" : "") + ((pf - pa) / gp).toFixed(1)
      );
    }
    db.prepare("INSERT OR REPLACE INTO meta VALUES ('standings',?)").run(Date.now());
  })();
  console.log("[DB] Standings saved");
}

async function refreshLeaders() {
  console.log("[DB] Refreshing league leaders...");
  const categories = [
    { stat: "PTS",  label: "points" },
    { stat: "REB",  label: "rebounds" },
    { stat: "AST",  label: "assists" },
    { stat: "STL",  label: "steals" },
    { stat: "BLK",  label: "blocks" },
    { stat: "FG3M", label: "threePointers" },
  ];
  const ins = db.prepare(`INSERT OR REPLACE INTO league_leaders VALUES (?,?,?,?,?)`);
  db.prepare("DELETE FROM league_leaders").run();

  for (const cat of categories) {
    try {
      const data = await fetchNBAEndpoint("leagueleaders", {
        LeagueID: "00", PerMode: "PerGame", Scope: "S",
        Season: SEASON, SeasonType: "Regular Season", StatCategory: cat.stat,
      });
      // leagueleaders uses resultSet (singular object) unlike most endpoints (resultSets array)
      const rs = data.resultSet ?? data.resultSets?.[0];
      if (!rs) throw new Error("Unexpected response shape from leagueleaders");
      const headers = rs.headers;
      const rows = rs.rowSet.slice(0, 5).map((row) => {
        const obj = {};
        headers.forEach((h, i) => (obj[h] = row[i]));
        return obj;
      });
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        ins.run(cat.label, i + 1, r.PLAYER, normalizeAbbr(r.TEAM_ABBREVIATION || r.TEAM), r[cat.stat]);
      }
      console.log(`[DB] Leaders ${cat.stat}: ${rows.length} rows`);
    } catch (e) {
      console.warn(`[DB] Leaders ${cat.stat} failed:`, e.message);
    }
  }
  db.prepare("INSERT OR REPLACE INTO meta VALUES ('leaders',?)").run(Date.now());
}

async function refreshLineups() {
  console.log("[DB] Refreshing lineups...");
  const groupSizes = [2, 3, 4, 5];

  const lineupParams = (gs, measureType) => ({
    Conference: "", DateFrom: "", DateTo: "", Division: "",
    GameID: "", GameSegment: "", GroupQuantity: gs,
    ISTRound: "", LastNGames: 0, LeagueID: "00", Location: "",
    MeasureType: measureType, Month: 0, OpponentTeamID: 0,
    Outcome: "", PORound: 0, PaceAdjust: "N", PerMode: "PerGame",
    Period: 0, PlusMinus: "N", Rank: "N", Season: SEASON,
    SeasonSegment: "", SeasonType: "Regular Season",
    ShotClockRange: "", TeamID: 0, VsConference: "", VsDivision: "",
  });

  // Fetch all 8 calls in parallel: [gs2-Base, gs2-Adv, gs3-Base, gs3-Adv, ...]
  const allResults = await Promise.all(
    groupSizes.flatMap((gs) => [
      fetchNBAEndpoint("leaguedashlineups", lineupParams(gs, "Base")),
      fetchNBAEndpoint("leaguedashlineups", lineupParams(gs, "Advanced")),
    ])
  );

  const ins = db.prepare(
    `INSERT OR REPLACE INTO lineups VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  );

  db.transaction(() => {
    db.prepare("DELETE FROM lineups").run();
    groupSizes.forEach((gs, idx) => {
      const baseRows = parseResultSet(allResults[idx * 2],     0);
      const advRows  = parseResultSet(allResults[idx * 2 + 1], 0);

      const advMap = new Map();
      for (const r of advRows) {
        advMap.set(`${r.TEAM_ABBREVIATION}||${r.GROUP_NAME}`, r);
      }

      for (const r of baseRows) {
        const adv = advMap.get(`${r.TEAM_ABBREVIATION}||${r.GROUP_NAME}`) || {};
        ins.run(
          normalizeAbbr(r.TEAM_ABBREVIATION),
          gs,
          r.GROUP_NAME,
          r.GP,
          r.MIN,
          r.PTS,
          r.FG_PCT,
          adv.E_OFF_RATING ?? adv.OFF_RATING,
          adv.E_DEF_RATING ?? adv.DEF_RATING,
          adv.E_NET_RATING ?? adv.NET_RATING,
          r.PLUS_MINUS
        );
      }
      console.log(`[DB] Lineups gs=${gs}: ${baseRows.length} rows`);
    });
    db.prepare("INSERT OR REPLACE INTO meta VALUES ('lineups',?)").run(Date.now());
  })();
  console.log("[DB] Lineups refresh complete");
}

async function refreshPlayerProfiles() {
  console.log("[DB] Refreshing player profiles...");

  // Params builder for leaguedashplayerstats (any MeasureType, any LastNGames)
  const advParams = (LastNGames = 0, MeasureType = "Advanced") => ({
    Conference: "", DateFrom: "", DateTo: "", Division: "",
    GameScope: "", GameSegment: "", Height: "", LastNGames,
    LeagueID: "00", Location: "", MeasureType, Month: 0,
    OpponentTeamID: 0, Outcome: "", PORound: 0, PaceAdjust: "N",
    PerMode: "PerGame", Period: 0, PlayerExperience: "",
    PlayerPosition: "", PlusMinus: "N", Rank: "N", Season: SEASON,
    SeasonSegment: "", SeasonType: "Regular Season", ShotClockRange: "",
    StarterBench: "", TeamID: 0, TwoWay: 0, VsConference: "",
    VsDivision: "", Weight: "",
  });

  // Params builder for leaguedashptstats
  // PlayerOrTeam: "Player" is required — without it the endpoint returns team-level rows
  const ptParams = (PtMeasureType) => ({
    College: "", Conference: "", Country: "", DateFrom: "", DateTo: "",
    Division: "", DraftPick: "", DraftYear: "", GameScope: "",
    GameSegment: "", Height: "", ISTRound: "", LastNGames: 0,
    LeagueID: "00", Location: "", Month: 0, OpponentTeamID: 0,
    Outcome: "", PORound: 0, PaceAdjust: "N", PerMode: "PerGame",
    Period: 0, PlayerExperience: "", PlayerOrTeam: "Player", PlayerPosition: "",
    PlusMinus: "N", PtMeasureType, Rank: "N",
    Season: SEASON, SeasonSegment: "", SeasonType: "Regular Season",
    StarterBench: "", TeamID: 0, VsConference: "", VsDivision: "", Weight: "",
  });

  // 7 sequential fetches — one at a time to avoid rate limits
  const advData     = await fetchNBAEndpoint("leaguedashplayerstats", advParams(0,  "Advanced"));
  const l15AdvData  = await fetchNBAEndpoint("leaguedashplayerstats", advParams(15, "Advanced"));
  const l15BaseData = await fetchNBAEndpoint("leaguedashplayerstats", advParams(15, "Base"));
  const possData    = await fetchNBAEndpoint("leaguedashptstats", ptParams("Possessions"));
  const passData    = await fetchNBAEndpoint("leaguedashptstats", ptParams("Passing"));
  const driveData   = await fetchNBAEndpoint("leaguedashptstats", ptParams("Drives"));
  const hustleData  = await fetchNBAEndpoint("leaguehustlestatsplayer", {
    College: "", Conference: "", Country: "", DateFrom: "", DateTo: "",
    Division: "", DraftPick: "", DraftYear: "", GameScope: "",
    Height: "", LastNGames: 0, LeagueID: "00", Location: "", Month: 0,
    OpponentTeamID: 0, Outcome: "", PerMode: "PerGame",
    PlayerExperience: "", PlayerPosition: "",
    Season: SEASON, SeasonSegment: "", SeasonType: "Regular Season",
    StarterBench: "", TeamID: 0, VsConference: "", VsDivision: "", Weight: "",
  });

  // Build lookup maps keyed by PLAYER_ID
  const advMap     = new Map(parseResultSet(advData,     0).map((r) => [r.PLAYER_ID, r]));
  const l15AdvMap  = new Map(parseResultSet(l15AdvData,  0).map((r) => [r.PLAYER_ID, r]));
  const l15BaseMap = new Map(parseResultSet(l15BaseData, 0).map((r) => [r.PLAYER_ID, r]));
  const possMap    = new Map(parseResultSet(possData,    0).map((r) => [r.PLAYER_ID, r]));
  const passMap    = new Map(parseResultSet(passData,    0).map((r) => [r.PLAYER_ID, r]));
  const driveMap   = new Map(parseResultSet(driveData,   0).map((r) => [r.PLAYER_ID, r]));
  const hustleMap  = new Map(parseResultSet(hustleData,  0).map((r) => [r.PLAYER_ID, r]));

  // Season PPG comes from the players table (already populated by refreshPlayers)
  const seasonPpgStmt = db.prepare("SELECT ppg FROM players WHERE player_id = ?");

  const ins = db.prepare(`
    INSERT OR REPLACE INTO player_profiles (
      player_id, name, team,
      usg_pct, ts_pct, ast_pct, ast_to, oreb_pct, dreb_pct, net_rating, pie, pace,
      touches, time_of_poss, front_ct_touches, elbow_touches, post_touches, paint_touches,
      passes_made, potential_ast, ast_pts_created,
      drives, drive_pts, drive_fg_pct, drive_ast,
      contested_shots, deflections, screen_assists, charges_drawn,
      l15_ppg, l15_usg_pct, l15_ts_pct, form_factor,
      updated_at, off_rating, def_rating
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  let count = 0;
  db.transaction(() => {
    db.prepare("DELETE FROM player_profiles").run();
    for (const [pid, adv] of advMap) {
      const poss    = possMap.get(pid)    || {};
      const pass    = passMap.get(pid)    || {};
      const drive   = driveMap.get(pid)   || {};
      const hustle  = hustleMap.get(pid)  || {};
      const l15Adv  = l15AdvMap.get(pid)  || {};
      const l15Base = l15BaseMap.get(pid) || {};

      const l15Ppg    = l15Base.PTS    ?? null;
      const l15UsgPct = l15Adv.USG_PCT ?? null;
      const l15TsPct  = l15Adv.TS_PCT  ?? null;
      const seasonPpg = seasonPpgStmt.get(pid)?.ppg ?? null;
      // form_factor > 1 = hot streak, < 1 = cold streak, null = insufficient data
      const formFactor = (l15Ppg != null && seasonPpg != null && seasonPpg > 0)
        ? +(l15Ppg / seasonPpg).toFixed(3)
        : null;

      ins.run(
        pid,
        adv.PLAYER_NAME,
        normalizeAbbr(adv.TEAM_ABBREVIATION),
        // Season advanced
        adv.USG_PCT      ?? null, adv.TS_PCT    ?? null,
        adv.AST_PCT      ?? null, adv.AST_TO    ?? null,
        adv.OREB_PCT     ?? null, adv.DREB_PCT  ?? null,
        adv.NET_RATING   ?? null, adv.PIE       ?? null, adv.PACE ?? null,
        // Possessions
        poss.TOUCHES          ?? null, poss.TIME_OF_POSS    ?? null,
        poss.FRONT_CT_TOUCHES ?? null, poss.ELBOW_TOUCHES   ?? null,
        poss.POST_TOUCHES     ?? null, poss.PAINT_TOUCHES   ?? null,
        // Passing
        pass.PASSES_MADE        ?? null, pass.POTENTIAL_AST     ?? null,
        pass.AST_POINTS_CREATED ?? null,
        // Drives
        drive.DRIVES       ?? null, drive.DRIVE_PTS    ?? null,
        drive.DRIVE_FG_PCT ?? null, drive.DRIVE_AST    ?? null,
        // Hustle
        hustle.CONTESTED_SHOTS ?? null, hustle.DEFLECTIONS   ?? null,
        hustle.SCREEN_ASSISTS  ?? null, hustle.CHARGES_DRAWN ?? null,
        // Recent form (L15)
        l15Ppg, l15UsgPct, l15TsPct, formFactor,
        Date.now(),
        // Off/Def rating
        adv.OFF_RATING ?? null, adv.DEF_RATING ?? null
      );
      count++;
    }
    db.prepare("INSERT OR REPLACE INTO meta VALUES ('player_profiles', ?)").run(Date.now());
  })();
  console.log(`[DB] Player profiles: ${count} rows saved`);
}

function runClustering() {
  const script = path.join(__dirname, "ml", "cluster_players.py");
  if (!fs.existsSync(script)) {
    console.warn("[Clustering] ml/cluster_players.py not found, skipping");
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const proc = spawn("python", [script], { cwd: __dirname });
    proc.stdout.on("data", (d) => console.log("[Clustering]", d.toString().trim()));
    proc.stderr.on("data", (d) => console.warn("[Clustering]", d.toString().trim()));
    proc.on("close", (code) => {
      if (code === 0) console.log("[Clustering] Archetypes updated successfully");
      else console.warn(`[Clustering] Exited with code ${code}`);
      resolve(); // always resolve so the chain continues
    });
    proc.on("error", (e) => {
      console.warn("[Clustering] Failed to spawn python:", e.message);
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Lineup profile classification
// ---------------------------------------------------------------------------
function classifyLineupArchetype(archetypes) {
  const a = archetypes.filter(Boolean);
  const isBig       = (x) => ["Rim-Running Big", "Defensive Anchor", "Unicorn Big", "Stretch Big", "Versatile PF"].includes(x);
  const isTrueBig   = (x) => ["Rim-Running Big", "Defensive Anchor", "Unicorn Big"].includes(x);
  const isGuard     = (x) => ["Floor General", "Scoring PG", "Combo Guard"].includes(x);
  const isPlaymaker = (x) => ["Floor General", "Scoring PG", "Large Playmaker", "Point Wing"].includes(x);
  const is3andD     = (x) => x === "3-and-D Wing" || x === "Stretch Big";
  const isTwoWay    = (x) => ["Two-Way Wing", "Combo Guard", "Versatile PF", "Defensive Anchor"].includes(x);
  const isWing      = (x) => ["3-and-D Wing", "Two-Way Wing", "Shot-Creating Wing", "Point Wing"].includes(x);

  const trueBigs   = a.filter(isTrueBig).length;
  const guards     = a.filter(isGuard).length;
  const playmakers = a.filter(isPlaymaker).length;
  const threeAndD  = a.filter(is3andD).length;
  const twoWay     = a.filter(isTwoWay).length;
  const wings      = a.filter(isWing).length;
  const bigs       = a.filter(isBig).length;

  if (trueBigs >= 2)                           return "TWIN_TOWERS";
  if (bigs === 0 && guards >= 3)               return "DEATH_LINEUP";
  if (threeAndD >= 3)                          return "STRETCH_LINEUP";
  if (playmakers >= 2)                         return "PLAYMAKER_HEAVY";
  if (twoWay >= 3)                             return "DEFENSIVE_LINEUP";
  if (wings >= 3)                              return "WING_DOMINANT";
  if (playmakers === 1 && threeAndD >= 2)      return "STAR_AND_SHOOTERS";
  return "BALANCED";
}

// ---------------------------------------------------------------------------
// Team archetype fingerprints & style classification
// ---------------------------------------------------------------------------
const ARCH_COLS = [
  "arch_floor_general", "arch_scoring_pg", "arch_combo_guard", "arch_large_playmaker",
  "arch_three_and_d_wing", "arch_two_way_wing", "arch_shot_creating_wing", "arch_point_wing",
  "arch_stretch_big", "arch_unicorn_big", "arch_rim_running_big", "arch_defensive_anchor", "arch_versatile_pf",
];
const ARCH_KEYS = [
  "floorGeneral", "scoringPg", "comboGuard", "largePlaymaker",
  "threeAndDWing", "twoWayWing", "shotCreatingWing", "pointWing",
  "stretchBig", "unicornBig", "rimRunningBig", "defensiveAnchor", "versatilePf",
];

function computeTeamFingerprints() {
  const selectCols = ARCH_COLS.map(
    (c) => `SUM(${c} * COALESCE(usg_pct, 20)) / SUM(COALESCE(usg_pct, 20)) AS wt_${c}`
  ).join(", ");
  const rows = db.prepare(
    `SELECT team, ${selectCols} FROM player_profiles WHERE team IS NOT NULL GROUP BY team`
  ).all();
  const result = {};
  for (const r of rows) {
    const fp = {};
    for (let i = 0; i < ARCH_COLS.length; i++) {
      fp[ARCH_KEYS[i]] = r[`wt_${ARCH_COLS[i]}`] ?? 0;
    }
    result[r.team] = fp;
  }
  return result;
}

function classifyTeamStyle(fp) {
  const scores = [
    ["Guard-Heavy",       (fp.floorGeneral || 0) + (fp.scoringPg || 0) + (fp.comboGuard || 0)],
    ["Wing-Dominant",     (fp.threeAndDWing || 0) + (fp.twoWayWing || 0) + (fp.shotCreatingWing || 0) + (fp.pointWing || 0)],
    ["Big-Heavy",         (fp.rimRunningBig || 0) + (fp.unicornBig || 0) + (fp.stretchBig || 0) + (fp.defensiveAnchor || 0)],
    ["Playmaker-Driven",  (fp.floorGeneral || 0) + (fp.scoringPg || 0) + (fp.largePlaymaker || 0) + (fp.pointWing || 0)],
    ["Defensive-Focused", (fp.twoWayWing || 0) + (fp.defensiveAnchor || 0) + (fp.threeAndDWing || 0)],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  // Always return the top-scoring style — never "Balanced"
  return scores[0][0];
}

// ---------------------------------------------------------------------------
// Team offensive & defensive archetype classification
// ---------------------------------------------------------------------------
function _scale(x, lo, hi) { return Math.max(0, Math.min(1, (x - lo) / (hi - lo))); }
function _inv(x, lo, hi) { return 1 - _scale(x, lo, hi); }

function scoreOffenseArchetypes(s) {
  // Thresholds calibrated to per-player-average data ranges
  const paceSpace   = _scale(s.pace, 99, 106) * 0.3 + _scale(s.fg3aRate, 0.36, 0.50) * 0.4 + _inv(s.paintTouchRate, 1.4, 2.3) * 0.3;
  const paintBeast  = _scale(s.paintTouchRate, 1.7, 2.5) * 0.35 + _scale(s.ftaRate, 0.24, 0.36) * 0.3 + _inv(s.fg3aRate, 0.30, 0.44) * 0.35;
  const motion      = _scale(s.astRate, 0.58, 0.80) * 0.4 + _scale(s.passRate, 2.5, 5.0) * 0.3 + _scale(s.potentialAst, 1.0, 3.0) * 0.3;
  const isoHeavy    = _scale(s.driveRate, 3.5, 5.5) * 0.4 + _inv(s.astRate, 0.50, 0.70) * 0.3 + _scale(s.usgTop3, 0.55, 0.80) * 0.3;
  const transition  = _scale(s.pace, 100, 107) * 0.35 + _scale(s.stlPerGame, 3.0, 6.0) * 0.35 + _scale(s.fg3aRate, 0.36, 0.46) * 0.3;
  // Pick & Roll — high paint touches + moderate assists + interior scoring
  const pickRoll    = _scale(s.paintTouchRate, 1.6, 2.4) * 0.3 + _scale(s.astRate, 0.55, 0.72) * 0.25 + _scale(s.ftaRate, 0.24, 0.34) * 0.25 + _inv(s.fg3aRate, 0.32, 0.44) * 0.2;
  return { paceSpace, paintBeast, motion, isoHeavy, transition, pickRoll };
}

function scoreDefenseArchetypes(s) {
  // Thresholds calibrated to per-player-average data ranges
  const perimeterLock = _scale(s.deflectionRate, 1.3, 1.9) * 0.4 + _scale(s.contestedRate, 3.0, 6.0) * 0.3 + _scale(s.stlPerGame, 3.0, 6.0) * 0.3;
  const rimProtection = _scale(s.blkPerGame, 1.5, 4.5) * 0.45 + _scale(s.contestedRate, 3.5, 6.0) * 0.3 + _scale(s.drebPct, 0.50, 0.56) * 0.25;
  const blitzPress    = _scale(s.stlPerGame, 3.5, 6.5) * 0.4 + _scale(s.deflectionRate, 1.3, 1.9) * 0.35 + _scale(s.pace, 100, 107) * 0.25;
  const packPaint     = _scale(s.blkPerGame, 1.5, 4.0) * 0.3 + _scale(s.drebPct, 0.51, 0.57) * 0.4 + _inv(s.stlPerGame, 2.0, 5.0) * 0.3;
  // Switchable = moderate across all categories, low variance
  const defScores = [perimeterLock, rimProtection, blitzPress, packPaint];
  const avg = defScores.reduce((a, b) => a + b, 0) / 4;
  const variance = defScores.reduce((a, v) => a + (v - avg) ** 2, 0) / 4;
  const switchable = _inv(variance, 0, 0.04) * 0.6 + _scale(avg, 0.2, 0.5) * 0.4;
  // Help/Zone — team rotation defense, high contested shots + high DReb% + moderate blocks
  const helpZone = _scale(s.contestedRate, 3.5, 6.0) * 0.35 + _scale(s.drebPct, 0.51, 0.57) * 0.3 + _scale(s.blkPerGame, 1.0, 3.5) * 0.2 + _inv(s.stlPerGame, 2.5, 5.5) * 0.15;
  return { perimeterLock, rimProtection, switchable, blitzPress, packPaint, helpZone };
}

function normalizeScores(raw) {
  const entries = Object.entries(raw);
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  const norm = {};
  for (const [k, v] of entries) norm[k] = v / total;
  return norm;
}

// ---------------------------------------------------------------------------
// Team stats cache — compute advanced + split stats from player_game_logs
// ---------------------------------------------------------------------------
function refreshTeamStats() {
  const teams = db.prepare("SELECT DISTINCT team FROM players WHERE team IS NOT NULL").pluck().all();
  if (!teams.length) { console.log("[TeamStats] No teams found"); return; }

  const gameStmt = db.prepare(`
    SELECT g.game_date, g.home,
           SUM(g.pts) AS pts, SUM(g.fga) AS fga, SUM(g.fgm) AS fgm,
           SUM(g.fg3a) AS fg3a, SUM(g.fg3m) AS fg3m,
           SUM(g.fta) AS fta, SUM(g.ftm) AS ftm,
           SUM(g.tov) AS tov, SUM(g.reb) AS reb,
           SUM(g.plus_minus) AS plus_minus,
           SUM(g.min_played) AS total_min
    FROM player_game_logs g
    LEFT JOIN players p ON g.player_id = p.player_id
    WHERE COALESCE(g.team, p.team) = ?
      AND g.season = ?
    GROUP BY g.game_date
    ORDER BY g.game_date ASC
  `);

  const ins = db.prepare(`
    INSERT OR REPLACE INTO team_stats_cache VALUES (
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    )
  `);

  let count = 0;
  db.transaction(() => {
    for (const team of teams) {
      const games = gameStmt.all(team, SEASON);
      if (games.length < 5) continue;

      // Overall totals
      let tPts = 0, tFga = 0, tFgm = 0, tFg3a = 0, tFg3m = 0;
      let tFta = 0, tFtm = 0, tTov = 0, tReb = 0, tPm = 0, tMin = 0;
      // Home/away splits
      let hPts = 0, hFga = 0, hFgm = 0, hFg3a = 0, hFg3m = 0, hFta = 0, hGames = 0, hOppPts = 0;
      let aPts = 0, aFga = 0, aFgm = 0, aFg3a = 0, aFg3m = 0, aFta = 0, aGames = 0, aOppPts = 0;

      for (const g of games) {
        tPts += g.pts; tFga += g.fga; tFgm += g.fgm;
        tFg3a += g.fg3a; tFg3m += g.fg3m;
        tFta += g.fta; tFtm += g.ftm;
        tTov += g.tov; tReb += g.reb;
        tPm += g.plus_minus; tMin += g.total_min;
        const oppPts = g.pts - g.plus_minus;
        if (g.home === 1) {
          hPts += g.pts; hFga += g.fga; hFgm += g.fgm;
          hFg3a += g.fg3a; hFg3m += g.fg3m; hFta += g.fta;
          hGames++; hOppPts += oppPts;
        } else {
          aPts += g.pts; aFga += g.fga; aFgm += g.fgm;
          aFg3a += g.fg3a; aFg3m += g.fg3m; aFta += g.fta;
          aGames++; aOppPts += oppPts;
        }
      }

      const gp = games.length;
      const oppPtsTotal = tPts - tPm;
      // Estimated possessions
      const poss = tFga + 0.44 * tFta + tTov;
      // Per-48 pace estimate: possessions per 48 min of team play
      // total_min is sum of all player minutes; divide by 5 for team minutes
      const teamMin = tMin / 5;
      const pace = teamMin > 0 ? (poss / teamMin) * 48 : 100;
      const ortg = poss > 0 ? (tPts / poss) * 100 : 0;
      const drtg = poss > 0 ? (oppPtsTotal / poss) * 100 : 0;
      const netRtg = ortg - drtg;
      // Four factors
      const efgPct = tFga > 0 ? ((tFgm + 0.5 * tFg3m) / tFga) * 100 : 0;
      const tovPct = poss > 0 ? (tTov / (tFga + 0.44 * tFta + tTov)) * 100 : 0;
      // ORB% — we don't have offensive rebounds split, estimate from total reb vs expected
      // Use a rough proxy: reb share compared to league average
      const orbPct = gp > 0 ? (tReb / gp) / 44 * 24 : 24; // rough normalization
      const ftRate = tFga > 0 ? (tFta / tFga) * 100 : 0;

      // Overall shooting
      const ppg = gp > 0 ? tPts / gp : 0;
      const oppPpg = gp > 0 ? oppPtsTotal / gp : 0;
      const fgPct = tFga > 0 ? (tFgm / tFga) * 100 : 0;
      const tpPct = tFg3a > 0 ? (tFg3m / tFg3a) * 100 : 0;

      // Home splits
      const homePpg = hGames > 0 ? hPts / hGames : 0;
      const homeOppPpg = hGames > 0 ? hOppPts / hGames : 0;
      const homeFgPct = hFga > 0 ? (hFgm / hFga) * 100 : 0;
      const homeTpPct = hFg3a > 0 ? (hFg3m / hFg3a) * 100 : 0;

      // Away splits
      const awayPpg = aGames > 0 ? aPts / aGames : 0;
      const awayOppPpg = aGames > 0 ? aOppPts / aGames : 0;
      const awayFgPct = aFga > 0 ? (aFgm / aFga) * 100 : 0;
      const awayTpPct = aFg3a > 0 ? (aFg3m / aFg3a) * 100 : 0;

      const r = (v) => Math.round(v * 10) / 10;
      ins.run(
        team,
        r(ortg), r(drtg), r(pace), r(netRtg),
        r(efgPct), r(tovPct), r(orbPct), r(ftRate),
        r(ppg), r(oppPpg), r(fgPct), r(tpPct),
        r(homePpg), r(homeOppPpg), r(homeFgPct), r(homeTpPct),
        r(awayPpg), r(awayOppPpg), r(awayFgPct), r(awayTpPct),
        gp, hGames, aGames,
        Date.now()
      );
      count++;
    }
    db.prepare("INSERT OR REPLACE INTO meta VALUES ('team_stats_cache', ?)").run(Date.now());
  })();
  console.log(`[TeamStats] Computed stats for ${count} teams`);
}

function refreshTeamArchetypes() {
  // Get all teams from player_profiles
  const teams = db.prepare("SELECT DISTINCT COALESCE(team, '') AS team FROM player_profiles WHERE team IS NOT NULL AND team != ''").all().map((r) => r.team);
  if (teams.length === 0) { console.log("[TeamArchetypes] No teams in player_profiles, skipping"); return; }

  // Aggregate game log stats per team per game, with recency weighting
  const now = Date.now();
  const gameLogStmt = db.prepare(`
    SELECT g.game_date,
           SUM(g.pts) AS pts, SUM(g.reb) AS reb, SUM(g.ast) AS ast,
           SUM(g.stl) AS stl, SUM(g.blk) AS blk, SUM(g.tov) AS tov,
           SUM(g.fgm) AS fgm, SUM(g.fga) AS fga,
           SUM(g.fg3m) AS fg3m, SUM(g.fg3a) AS fg3a,
           SUM(g.ftm) AS ftm, SUM(g.fta) AS fta,
           COUNT(DISTINCT g.player_id) AS n_players
    FROM player_game_logs g
    LEFT JOIN players p ON g.player_id = p.player_id
    WHERE COALESCE(g.team, p.team) = ?
    GROUP BY g.game_date
    ORDER BY g.game_date DESC
  `);

  // Player profile stats per team (possession-level data)
  const profileStmt = db.prepare(`
    SELECT AVG(pace) AS avg_pace,
           AVG(drives) AS avg_drives, AVG(paint_touches) AS avg_paint_touches,
           AVG(passes_made) AS avg_passes, AVG(potential_ast) AS avg_potential_ast,
           AVG(deflections) AS avg_deflections, AVG(contested_shots) AS avg_contested,
           AVG(ast_pct) AS avg_ast_pct, AVG(usg_pct) AS avg_usg_pct,
           AVG(dreb_pct) AS avg_dreb_pct,
           MAX(usg_pct) AS max_usg,
           -- Top 3 USG% concentration
           (SELECT SUM(sub.usg_pct) FROM (
             SELECT usg_pct FROM player_profiles WHERE team = pp.team AND usg_pct IS NOT NULL ORDER BY usg_pct DESC LIMIT 3
           ) sub) AS top3_usg_sum,
           (SELECT SUM(sub.usg_pct) FROM (
             SELECT usg_pct FROM player_profiles WHERE team = pp.team AND usg_pct IS NOT NULL
           ) sub) AS total_usg_sum
    FROM player_profiles pp
    WHERE pp.team = ? AND pp.usg_pct IS NOT NULL
  `);

  const ins = db.prepare(`
    INSERT OR REPLACE INTO team_archetypes VALUES (
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    )
  `);

  let count = 0;
  db.transaction(() => {
    for (const team of teams) {
      const games = gameLogStmt.all(team);
      const profile = profileStmt.get(team);
      if (games.length < 5) continue; // Need minimum games

      // Weighted averages with exponential decay (0.97^days_ago)
      let wSum = 0;
      let wFg3a = 0, wFga = 0, wFta = 0, wAst = 0, wFgm = 0;
      let wStl = 0, wBlk = 0, wReb = 0, wGameCount = 0;
      for (const g of games) {
        const daysAgo = Math.max(0, (now - new Date(g.game_date).getTime()) / (1000 * 60 * 60 * 24));
        const w = Math.pow(0.97, daysAgo);
        wSum += w;
        wFg3a += (g.fg3a || 0) * w;
        wFga += (g.fga || 0) * w;
        wFta += (g.fta || 0) * w;
        wAst += (g.ast || 0) * w;
        wFgm += (g.fgm || 0) * w;
        wStl += (g.stl || 0) * w;
        wBlk += (g.blk || 0) * w;
        wReb += (g.reb || 0) * w;
        wGameCount += w;
      }

      const fg3aRate = wFga > 0 ? wFg3a / wFga : 0.36;
      const ftaRate = wFga > 0 ? wFta / wFga : 0.28;
      const astRate = wFgm > 0 ? wAst / wFgm : 0.60;
      const stlPerGame = wGameCount > 0 ? wStl / wGameCount : 7;
      const blkPerGame = wGameCount > 0 ? wBlk / wGameCount : 4.5;
      const rebPerGame = wGameCount > 0 ? wReb / wGameCount : 43;

      const pace = profile?.avg_pace || 100;
      const paintTouchRate = profile?.avg_paint_touches || 30;
      const driveRate = profile?.avg_drives || 45;
      const passRate = profile?.avg_passes || 270;
      const potentialAst = profile?.avg_potential_ast || 10;
      const deflectionRate = profile?.avg_deflections || 14;
      const contestedRate = profile?.avg_contested || 48;
      const drebPct = profile?.avg_dreb_pct || 0.52;
      const usgTop3 = (profile?.top3_usg_sum && profile?.total_usg_sum)
        ? profile.top3_usg_sum / profile.total_usg_sum : 0.6;

      const stats = {
        pace, fg3aRate, ftaRate, astRate, paintTouchRate, driveRate,
        passRate, potentialAst, stlPerGame, blkPerGame, rebPerGame,
        deflectionRate, contestedRate, drebPct, usgTop3,
      };

      // Score and normalize
      const off = normalizeScores(scoreOffenseArchetypes(stats));
      const offLabel = Object.entries(off).sort((a, b) => b[1] - a[1])[0][0];

      const def = normalizeScores(scoreDefenseArchetypes(stats));
      const defLabel = Object.entries(def).sort((a, b) => b[1] - a[1])[0][0];

      const OFF_LABELS = { paceSpace: "Pace & Space", paintBeast: "Paint Beast", motion: "Motion Offense", isoHeavy: "ISO Heavy", transition: "Transition", pickRoll: "Pick & Roll" };
      const DEF_LABELS = { perimeterLock: "Perimeter Lock", rimProtection: "Rim Protection", switchable: "Switchable", blitzPress: "Blitz/Press", packPaint: "Pack the Paint", helpZone: "Help/Zone" };

      ins.run(
        team,
        off.paceSpace || 0, off.paintBeast || 0, off.motion || 0,
        off.isoHeavy || 0, off.transition || 0, off.pickRoll || 0,
        OFF_LABELS[offLabel] || offLabel,
        def.perimeterLock || 0, def.rimProtection || 0, def.switchable || 0,
        def.blitzPress || 0, def.packPaint || 0, def.helpZone || 0,
        DEF_LABELS[defLabel] || defLabel,
        pace, fg3aRate, paintTouchRate, astRate,
        driveRate, stlPerGame, blkPerGame, deflectionRate,
        Date.now()
      );
      count++;
    }
  })();
  db.prepare("INSERT OR REPLACE INTO meta VALUES ('team_archetypes', ?)").run(Date.now());
  console.log(`[TeamArchetypes] Classified ${count} teams`);
}

async function refreshLineupProfiles() {
  const lineups5 = db.prepare(
    "SELECT * FROM lineups WHERE group_size = 5 AND min >= 5"
  ).all();
  if (lineups5.length === 0) {
    console.log("[LineupProfiles] No 5-man lineups found, skipping");
    return;
  }

  // Build name → archetype lookup (lowercase for fuzzy match)
  const profileRows = db.prepare("SELECT name, archetype_label FROM player_profiles").all();
  const archetypeByName = new Map();
  for (const r of profileRows) {
    if (r.archetype_label) archetypeByName.set(r.name.toLowerCase(), r.archetype_label);
  }

  const ins = db.prepare(
    `INSERT OR REPLACE INTO lineup_profiles
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );

  let count = 0;
  db.transaction(() => {
    for (const lu of lineups5) {
      const players    = lu.group_name.split(" - ").map((s) => s.trim());
      const archetypes = players.map((n) => archetypeByName.get(n.toLowerCase()) || null);
      const lineupArch = classifyLineupArchetype(archetypes);
      ins.run(
        `${lu.team}||${lu.group_name}`,
        lu.team,
        lu.group_name,
        JSON.stringify(archetypes),
        lineupArch,
        lu.gp,
        lu.min,
        lu.pts,
        lu.fg_pct,
        lu.ortg,
        lu.drtg,
        lu.net_rtg,
        lu.plus_minus,
        Date.now()
      );
      count++;
    }
    db.prepare("INSERT OR REPLACE INTO meta VALUES ('lineup_profiles',?)").run(Date.now());
  })();
  console.log(`[LineupProfiles] Built ${count} lineup profiles`);
}

async function refreshTeamGameResults() {
  const seasons = ["2024-25", "2025-26"];
  const teams = Object.keys(TEAM_ID_ABBR).map((id) => ({ id: parseInt(id), abbr: TEAM_ID_ABBR[id] }));
  const ins = db.prepare(`
    INSERT OR IGNORE INTO team_game_results VALUES (?,?,?,?,?,?,?,?)
  `);

  let total = 0;
  for (const season of seasons) {
    for (const { id, abbr } of teams) {
      try {
        const data = await fetchNBAEndpoint("teamgamelogs", {
          TeamID: id, Season: season, SeasonType: "Regular Season",
          LeagueID: "00", DateFrom: "", DateTo: "",
        });
        const rows = parseResultSet(data, 0);
        db.transaction(() => {
          for (const r of rows) {
            const matchup = r.MATCHUP || "";
            const oppMatch = matchup.match(/(?:vs\.|@)\s*(\w+)/);
            const opponent = oppMatch ? normalizeAbbr(oppMatch[1]) : null;
            const isHome = matchup.includes("vs.") ? 1 : 0;
            const pts = r.PTS ?? null;
            // opp_pts derived from plus_minus: opp = pts - plus_minus
            const oppPts = pts != null && r.PLUS_MINUS != null ? Math.round(pts - r.PLUS_MINUS) : null;
            ins.run(
              abbr, season, toISODate(r.GAME_DATE),
              opponent, isHome,
              pts, oppPts,
              r.WL === "W" ? 1 : 0
            );
            total++;
          }
        })();
      } catch (e) {
        console.warn(`[TeamGameResults] ${abbr} ${season}: ${e.message}`);
      }
    }
  }
  db.prepare("INSERT OR REPLACE INTO meta VALUES ('team_game_results', ?)").run(Date.now());
  console.log(`[TeamGameResults] Stored ${total} team-game rows`);
}

// Lightweight refresh: only the last 14 days of the current season.
// Runs every 4 hours so last night's final scores are always available for the ticker.
async function refreshRecentGameResults() {
  const season = "2025-26";
  const teams = Object.keys(TEAM_ID_ABBR).map((id) => ({ id: parseInt(id), abbr: TEAM_ID_ABBR[id] }));
  const upsert = db.prepare(`
    INSERT OR REPLACE INTO team_game_results VALUES (?,?,?,?,?,?,?,?)
  `);
  const d = new Date();
  d.setDate(d.getDate() - 14);
  const dateFrom = `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}/${d.getFullYear()}`;

  let total = 0;
  for (const { id, abbr } of teams) {
    try {
      const data = await fetchNBAEndpoint("teamgamelogs", {
        TeamID: id, Season: season, SeasonType: "Regular Season",
        LeagueID: "00", DateFrom: dateFrom, DateTo: "",
      });
      const rows = parseResultSet(data, 0);
      db.transaction(() => {
        for (const r of rows) {
          const matchup = r.MATCHUP || "";
          const oppMatch = matchup.match(/(?:vs\.|@)\s*(\w+)/);
          const opponent = oppMatch ? normalizeAbbr(oppMatch[1]) : null;
          const isHome = matchup.includes("vs.") ? 1 : 0;
          const pts = r.PTS ?? null;
          const oppPts = pts != null && r.PLUS_MINUS != null ? Math.round(pts - r.PLUS_MINUS) : null;
          upsert.run(abbr, season, toISODate(r.GAME_DATE), opponent, isHome, pts, oppPts, r.WL === "W" ? 1 : 0);
          total++;
        }
      })();
    } catch (e) {
      console.warn(`[RecentResults] ${abbr}: ${e.message}`);
    }
  }
  db.prepare("INSERT OR REPLACE INTO meta VALUES ('recent_game_results', ?)").run(Date.now());
  console.log(`[RecentResults] Updated ${total} rows (last 14 days)`);
}

async function refreshAll(force = false) {
  await Promise.allSettled([
    (force || isStale("players")   || isEmpty("players"))         ? refreshPlayers()  : Promise.resolve(),
    (force || isStale("standings") || isEmpty("standings"))       ? refreshStandings() : Promise.resolve(),
    (force || isStale("leaders")   || isEmpty("league_leaders"))  ? refreshLeaders()  : Promise.resolve(),
    (force || isStale("lineups")   || isEmpty("lineups"))         ? refreshLineups()  : Promise.resolve(),
  ]);
  // Player profiles run after — 7 sequential API calls, keep them separate
  if (force || isStale("player_profiles", 7 * 24 * 60 * 60 * 1000) || isEmpty("player_profiles")) {
    await refreshPlayerProfiles().catch((e) => console.error("[DB] Player profiles error:", e.message));
    // Re-cluster archetypes after profiles update — await so lineup profiles get fresh labels
    await runClustering();
  }
  // Lineup profiles depend on both lineups and player_profiles (for archetypes)
  if (force || isStale("lineup_profiles", 24 * 60 * 60 * 1000) || isEmpty("lineup_profiles")) {
    await refreshLineupProfiles().catch((e) => console.error("[LineupProfiles] Error:", e.message));
  }
  // Current season game log update — runs once per day after players table is fresh
  if (force || isStale("game_logs_current", 24 * 60 * 60 * 1000)) {
    await updateCurrentSeasonLogs().catch((e) => console.error("[GameLogs] Update error:", e.message));
  }
  // Team stats cache — advanced stats + home/away splits from game logs
  if (force || isStale("team_stats_cache", 24 * 60 * 60 * 1000) || isEmpty("team_stats_cache")) {
    try { refreshTeamStats(); } catch (e) { console.error("[TeamStats] Error:", e.message); }
  }
  // Team offensive/defensive archetype classification — depends on game logs + player profiles
  if (force || isStale("team_archetypes", 24 * 60 * 60 * 1000) || isEmpty("team_archetypes")) {
    try { refreshTeamArchetypes(); } catch (e) { console.error("[TeamArchetypes] Error:", e.message); }
  }
  // Team game results — actual final scores for all 30 teams, used by Elo model
  if (force || isStale("team_game_results", 24 * 60 * 60 * 1000) || isEmpty("team_game_results")) {
    await refreshTeamGameResults().catch((e) => console.error("[TeamGameResults] Error:", e.message));
  }
  // Recent results (last 14 days) — runs every 4h so ticker always shows last night's scores
  if (force || isStale("recent_game_results", 4 * 60 * 60 * 1000)) {
    await refreshRecentGameResults().catch((e) => console.error("[RecentResults] Error:", e.message));
  }
}

// ---------------------------------------------------------------------------
// Game log collection — historical backfill + nightly current-season update
// ---------------------------------------------------------------------------

async function fetchAndStoreGameLogs(pid, name, season, skipIfFull = false) {
  if (skipIfFull) {
    const { c } = db.prepare(
      "SELECT COUNT(*) as c FROM player_game_logs WHERE player_id = ? AND season = ?"
    ).get(pid, season);
    if (c > 50) return 0;  // already have a full season, skip
  }

  const data = await fetchNBAEndpoint("playergamelog", {
    PlayerID: pid, Season: season, SeasonType: "Regular Season",
  });
  const rows = parseResultSet(data, 0);
  const ins = db.prepare(
    `INSERT OR IGNORE INTO player_game_logs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );

  let inserted = 0;
  db.transaction(() => {
    for (const r of rows) {
      const matchup = r.MATCHUP || "";
      const oppMatch = matchup.match(/(?:vs\.|@)\s*(\w+)/);
      const result = ins.run(
        pid, name, normalizeAbbr(r.TEAM_ABBREVIATION), season,
        toISODate(r.GAME_DATE),
        oppMatch ? normalizeAbbr(oppMatch[1]) : null,
        matchup.includes("vs.") ? 1 : 0,
        r.MIN ?? null,
        r.PTS ?? null, r.REB ?? null, r.AST ?? null,
        r.STL ?? null, r.BLK ?? null,
        r.FGM ?? null, r.FGA ?? null,
        r.FG3M ?? null, r.FG3A ?? null,
        r.FTM ?? null, r.FTA ?? null,
        r.TOV ?? null, r.PLUS_MINUS ?? null
      );
      if (result.changes > 0) inserted++;
    }
  })();
  return inserted;
}

// One-time backfill: 2023-24 and 2024-25 for top 150 players by MPG
async function backfillHistoricalLogs() {
  const players = db.prepare(
    "SELECT player_id, name FROM players WHERE mpg >= 20 ORDER BY mpg DESC LIMIT 150"
  ).all();
  if (players.length === 0) {
    console.log("[GameLogs] Players table empty, deferring backfill");
    return;
  }
  console.log(`[GameLogs] Backfilling 2 seasons for ${players.length} players...`);
  let total = 0;
  for (const { player_id: pid, name } of players) {
    for (const season of ["2023-24", "2024-25"]) {
      try {
        const n = await fetchAndStoreGameLogs(pid, name, season, true);
        total += n;
        if (n > 0) console.log(`[GameLogs] ${name} ${season}: +${n}`);
      } catch (e) {
        console.warn(`[GameLogs] ${name} ${season}: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 400)); // rate limit
    }
  }
  db.prepare("INSERT OR REPLACE INTO meta VALUES ('game_logs_backfill', ?)").run(Date.now());
  console.log(`[GameLogs] Historical backfill complete: ${total} rows`);
}

// Daily update: current season only, INSERT OR IGNORE handles duplicates
async function updateCurrentSeasonLogs() {
  console.log("[GameLogs] Updating current season logs...");
  const players = db.prepare(
    "SELECT player_id, name FROM players WHERE mpg >= 20 ORDER BY mpg DESC LIMIT 150"
  ).all();
  if (players.length === 0) return;
  let total = 0;
  for (const { player_id: pid, name } of players) {
    try {
      total += await fetchAndStoreGameLogs(pid, name, SEASON, false);
    } catch (e) {
      console.warn(`[GameLogs] ${name} current: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  db.prepare("INSERT OR REPLACE INTO meta VALUES ('game_logs_current', ?)").run(Date.now());
  console.log(`[GameLogs] Current season update complete: ${total} new rows`);
}

// ---------------------------------------------------------------------------
// AI Predictions — Claude-powered daily game predictions
// ---------------------------------------------------------------------------

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function callAnthropicWithRetry(systemPrompt, userPrompt, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (response.status === 429 || response.status === 529) {
        const backoff = Math.pow(2, attempt) * 5000 + Math.random() * 2000;
        console.warn(`[Predictions] Rate limited (${response.status}), retrying in ${Math.round(backoff / 1000)}s...`);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Anthropic API ${response.status}`);
      }

      const data = await response.json();
      return data.content?.[0]?.text || "";
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const backoff = Math.pow(2, attempt) * 3000;
      console.warn(`[Predictions] Attempt ${attempt + 1} failed: ${err.message}, retrying in ${Math.round(backoff / 1000)}s...`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
}

async function gatherPredictionContext() {
  const dateStr = todayDateStr();

  const scoreboardData = await fetchNBAEndpoint("scoreboardv3", {
    LeagueID: "00",
    GameDate: dateStr,
  });
  const games = scoreboardData.scoreboard?.games || [];
  // Include upcoming (1) and live (2) games — skip only if all are already final
  // This prevents stale predictions when the cron fires mid-day or late
  const upcomingGames = games.filter((g) => g.gameStatus === 1 || g.gameStatus === 2);
  const allGames = games.length > 0 ? games : [];
  const gamesToPredict = upcomingGames.length > 0 ? upcomingGames : allGames;
  console.log(`[Predictions] ${dateStr}: ${games.length} total games, ${upcomingGames.length} not-yet-final`);
  if (gamesToPredict.length === 0) return { games: [], dateStr, context: "" };

  // Pull from local DB
  const standings = db.prepare("SELECT * FROM standings ORDER BY pct DESC").all();
  const topPlayers = db.prepare("SELECT * FROM players ORDER BY ppg DESC LIMIT 100").all();

  // Collect team abbreviations for today's games
  const teamAbbrs = new Set();
  for (const g of gamesToPredict) {
    const home = TEAM_ID_ABBR[g.homeTeam?.teamId] || g.homeTeam?.teamTricode;
    const away = TEAM_ID_ABBR[g.awayTeam?.teamId] || g.awayTeam?.teamTricode;
    if (home) teamAbbrs.add(home);
    if (away) teamAbbrs.add(away);
  }

  // Fetch last 5 game logs per team
  const gameLogs = {};
  for (const abbr of teamAbbrs) {
    const tid = Object.entries(TEAM_ID_ABBR).find(([, a]) => a === abbr)?.[0];
    if (!tid) continue;
    try {
      const data = await fetchNBAEndpoint("teamgamelog", {
        TeamID: tid, Season: SEASON, SeasonType: "Regular Season",
      });
      gameLogs[abbr] = parseResultSet(data, 0).slice(0, 3).map((r) => ({
        matchup: r.MATCHUP, wl: r.WL, pts: r.PTS,
      }));
    } catch { /* skip if unavailable */ }
  }

  // Historical accuracy
  const last30 = db.prepare(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) as wins
    FROM prediction_results
    WHERE graded_at IS NOT NULL
      AND prediction_date >= date('now', '-30 days')
  `).get();

  // Build context
  // Only include standings for teams playing today
  const standingsText = standings
    .filter((s) => teamAbbrs.has(s.team))
    .map((s) => `${s.team}: ${s.wins}-${s.losses} DIFF:${s.diff} L10:${s.last10} Streak:${s.streak}`)
    .join("\n");

  const eloStr = (abbr) => {
    const e = eloMap[abbr];
    if (!e) return "";
    const trend = e.trend >= 0 ? `+${e.trend.toFixed(1)}` : e.trend.toFixed(1);
    return ` [Elo:${e.elo.toFixed(0)} ${trend} L10 #${e.rank}]`;
  };

  const gamesText = gamesToPredict.map((g) => {
    const home = TEAM_ID_ABBR[g.homeTeam?.teamId] || g.homeTeam?.teamTricode;
    const away = TEAM_ID_ABBR[g.awayTeam?.teamId] || g.awayTeam?.teamTricode;
    const homeLog = (gameLogs[home] || []).map((l) => `${l.matchup} ${l.wl} ${l.pts}pts`).join(", ");
    const awayLog = (gameLogs[away] || []).map((l) => `${l.matchup} ${l.wl} ${l.pts}pts`).join(", ");
    return `${away}${eloStr(away)}@${home}${eloStr(home)} (${g.gameId}) | ${home} L3: ${homeLog} | ${away} L3: ${awayLog}`;
  }).join("\n\n");

  const relevantPlayers = topPlayers.filter((p) => teamAbbrs.has(p.team)).slice(0, 20);
  const profileMap = new Map();
  if (relevantPlayers.length > 0) {
    const placeholders = relevantPlayers.map(() => "?").join(",");
    const profileRows = db.prepare(
      `SELECT player_id, usg_pct, ts_pct, net_rating, form_factor, archetype_label,
              arch_floor_general, arch_scoring_pg, arch_combo_guard, arch_large_playmaker,
              arch_three_and_d_wing, arch_two_way_wing, arch_shot_creating_wing, arch_point_wing,
              arch_stretch_big, arch_unicorn_big, arch_rim_running_big, arch_defensive_anchor, arch_versatile_pf
       FROM player_profiles WHERE player_id IN (${placeholders})`
    ).all(...relevantPlayers.map((p) => p.player_id));
    for (const r of profileRows) profileMap.set(r.player_id, r);
  }
  const l5Stmt = db.prepare(
    "SELECT pts, game_date FROM player_game_logs WHERE player_id = ? ORDER BY game_date DESC LIMIT 5"
  );
  const playersText = relevantPlayers.map((p) => {
    const base = `${p.name} (${p.team}): ${p.ppg}ppg ${p.rpg}r ${p.apg}a`;
    // L5 rolling form
    const l5 = l5Stmt.all(p.player_id);
    let l5Str = "";
    if (l5.length >= 3) {
      const l5Pts = l5.map((r) => r.pts).filter((x) => x != null);
      if (l5Pts.length > 0) {
        const l5Avg = l5Pts.reduce((a, b) => a + b, 0) / l5Pts.length;
        const seasonPpg = parseFloat(p.ppg) || 0;
        const formLabel = seasonPpg > 0
          ? l5Avg > seasonPpg * 1.1 ? " HOT" : l5Avg < seasonPpg * 0.9 ? " COLD" : ""
          : "";
        const lastGameDate = l5[0]?.game_date;
        const restDays = lastGameDate
          ? Math.round((new Date(dateStr) - new Date(lastGameDate)) / 86400000)
          : null;
        l5Str = ` | L${l5Pts.length}:${l5Pts.join(",")} avg ${l5Avg.toFixed(1)}${formLabel}${restDays != null ? ` rest:${restDays}d` : ""}`;
      }
    }
    // Advanced profile stats
    const prof = profileMap.get(p.player_id);
    let profStr = "";
    if (prof) {
      const parts = [];
      if (prof.usg_pct != null) parts.push(`USG:${(prof.usg_pct * 100).toFixed(1)}%`);
      if (prof.ts_pct != null) parts.push(`TS:${(prof.ts_pct * 100).toFixed(1)}%`);
      if (prof.net_rating != null) parts.push(`NET:${prof.net_rating > 0 ? "+" : ""}${prof.net_rating.toFixed(1)}`);
      if (prof.form_factor != null) parts.push(`FF:${prof.form_factor.toFixed(2)}`);
      if (parts.length > 0) profStr = ` | ${parts.join(" ")}`;
      // Show top 2 fuzzy archetypes
      if (prof.archetype_label) {
        const archScores = [
          ["Floor General", prof.arch_floor_general], ["Scoring PG", prof.arch_scoring_pg],
          ["Combo Guard", prof.arch_combo_guard], ["Large Playmaker", prof.arch_large_playmaker],
          ["3-and-D Wing", prof.arch_three_and_d_wing], ["Two-Way Wing", prof.arch_two_way_wing],
          ["Shot-Creating Wing", prof.arch_shot_creating_wing], ["Point Wing", prof.arch_point_wing],
          ["Stretch Big", prof.arch_stretch_big], ["Unicorn Big", prof.arch_unicorn_big],
          ["Rim-Running Big", prof.arch_rim_running_big], ["Defensive Anchor", prof.arch_defensive_anchor],
          ["Versatile PF", prof.arch_versatile_pf],
        ].filter(([, v]) => v != null && v > 0).sort((a, b) => b[1] - a[1]);
        const top = archScores.slice(0, 2).map(([n]) => n).join(" / ");
        if (top) profStr += ` [${top}]`;
      }
    }
    return `${base}${l5Str}${profStr}`;
  }).join("\n");

  const accuracyText = last30.total > 0
    ? `Your historical accuracy (last 30 days): ${last30.wins}/${last30.total} (${((last30.wins / last30.total) * 100).toFixed(1)}%). Adjust your approach based on past errors.`
    : "No historical predictions to reference yet.";

  // Load Elo ratings for today's teams
  const eloMap = {};
  try {
    const eloPath = path.join(__dirname, "ml", "models", "elo_ratings.json");
    if (fs.existsSync(eloPath)) {
      const eloData = JSON.parse(fs.readFileSync(eloPath, "utf8"));
      for (const t of (eloData.teams || [])) {
        if (teamAbbrs.has(t.team)) {
          eloMap[t.team] = { elo: t.elo, trend: t.trend, rank: t.rank };
        }
      }
    }
  } catch (e) { /* skip if unavailable */ }

  // Load XGBoost predictions if available, match by team abbrs
  let xgboostText = "";
  try {
    const xgPredPath = path.join(__dirname, "ml", "models", "predictions.json");
    if (fs.existsSync(xgPredPath)) {
      const xgPreds = JSON.parse(fs.readFileSync(xgPredPath, "utf8"));
      // Only use if predictions are from today
      const todayPreds = xgPreds.date === dateStr ? (xgPreds.predictions || []) : [];
      if (todayPreds.length > 0) {
        const lines = todayPreds.map((p) => {
          const winPct = p.home_win_prob != null ? `${(p.home_win_prob * 100).toFixed(1)}%` : "?%";
          const spread = p.predicted_spread != null ? (p.predicted_spread > 0 ? `+${p.predicted_spread.toFixed(1)}` : p.predicted_spread.toFixed(1)) : "?";
          const conf = p.confidence != null ? ` conf:${(p.confidence * 100).toFixed(0)}%` : "";
          return `${p.away_team}@${p.home_team}: ${p.predicted_winner} ${winPct} win prob, spread ${spread}${conf}`;
        });
        xgboostText = `\n\n--- QUANTITATIVE MODEL (XGBoost, 107 features) ---\n${lines.join("\n")}\nUse this as a statistical baseline. Note where your qualitative reasoning agrees or diverges, and explain why.`;
      }
    }
  } catch (e) {
    console.warn("[Predictions] Could not load XGBoost output:", e.message);
  }

  return {
    games: upcomingGames,
    dateStr,
    context: `${accuracyText}\n\n--- STANDINGS ---\n${standingsText}\n\n--- TODAY'S GAMES ---\n${gamesText}\n\n--- KEY PLAYERS ---\n${playersText}${xgboostText}`,
  };
}

async function generatePredictions() {
  if (!ANTHROPIC_API_KEY) {
    console.warn("[Predictions] No ANTHROPIC_API_KEY set, skipping");
    return;
  }

  const { games, dateStr, context } = await gatherPredictionContext();
  if (games.length === 0) {
    console.log("[Predictions] No upcoming games today, skipping");
    return;
  }

  const existing = db.prepare("SELECT COUNT(*) as c FROM predictions WHERE prediction_date = ?").get(dateStr);
  if (existing.c > 0) {
    console.log(`[Predictions] Already have ${existing.c} predictions for ${dateStr}`);
    return;
  }

  const systemPrompt = `You are an expert NBA analytics engine. Analyze the provided data — standings, recent form, player stats — and predict game outcomes. Be analytical and data-driven. Respond with ONLY valid JSON, no markdown fencing or extra text.`;

  const userPrompt = `${context}

Predict each game for ${dateStr}. Return JSON:
{
  "predictions": [
    {
      "game_id": "0022500xxx",
      "home_team": "BOS",
      "away_team": "LAL",
      "predicted_winner": "BOS",
      "home_score": 112,
      "away_score": 104,
      "spread": 8.0,
      "confidence": 0.75,
      "upset_alert": false,
      "reasoning": "1-2 sentences max",
      "player_props": [
        { "playerName": "Jayson Tatum", "team": "BOS", "pts": 28, "reb": 8, "ast": 5 },
        { "playerName": "LeBron James", "team": "LAL", "pts": 25, "reb": 7, "ast": 8 }
      ]
    }
  ]
}

Rules:
- "spread" = absolute margin of victory (always positive)
- "confidence" = 0.5 to 1.0
- "upset_alert" = true when the worse-record team is predicted to win OR confidence < 0.55
- Include 2-4 player props per game (best players from each team)
- "reasoning" = 1-2 sentences, cite specific stats`;

  console.log(`[Predictions] Generating for ${dateStr} (${games.length} games)...`);

  const rawResponse = await callAnthropicWithRetry(systemPrompt, userPrompt);

  let parsed;
  try {
    const cleaned = rawResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error("[Predictions] Failed to parse response:", e.message);
    return;
  }

  const ins = db.prepare(`
    INSERT OR REPLACE INTO predictions
    (prediction_date, game_id, home_team, away_team, predicted_winner, predicted_spread,
     confidence, home_score_pred, away_score_pred, upset_alert, reasoning, player_props,
     raw_response, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  db.transaction(() => {
    for (const p of parsed.predictions || []) {
      ins.run(
        dateStr, p.game_id || null, p.home_team, p.away_team,
        p.predicted_winner, p.spread || null, p.confidence || 0.5,
        p.home_score || null, p.away_score || null,
        p.upset_alert ? 1 : 0, p.reasoning || "",
        JSON.stringify(p.player_props || []), rawResponse, Date.now()
      );
    }
    db.prepare("INSERT OR REPLACE INTO meta VALUES ('predictions', ?)").run(Date.now());
  })();

  console.log(`[Predictions] Saved ${(parsed.predictions || []).length} predictions for ${dateStr}`);
}

async function gradePredictions() {
  const ungraded = db.prepare(`
    SELECT DISTINCT prediction_date FROM predictions
    WHERE prediction_date < date('now')
      AND prediction_date NOT IN (
        SELECT DISTINCT prediction_date FROM prediction_results WHERE graded_at IS NOT NULL
      )
    ORDER BY prediction_date DESC LIMIT 7
  `).all();

  if (ungraded.length === 0) return;

  for (const { prediction_date: dateStr } of ungraded) {
    const preds = db.prepare("SELECT * FROM predictions WHERE prediction_date = ?").all(dateStr);

    const scoreboardData = await fetchNBAEndpoint("scoreboardv3", {
      LeagueID: "00", GameDate: dateStr,
    });
    const games = scoreboardData.scoreboard?.games || [];

    const allFinal = games.length > 0 && games.every((g) => g.gameStatus === 3);
    if (!allFinal) {
      console.log(`[Grading] ${dateStr}: not all games final yet`);
      continue;
    }

    const resultMap = {};
    for (const g of games) {
      const home = TEAM_ID_ABBR[g.homeTeam?.teamId] || g.homeTeam?.teamTricode;
      const away = TEAM_ID_ABBR[g.awayTeam?.teamId] || g.awayTeam?.teamTricode;
      const hs = g.homeTeam?.score ?? 0;
      const as = g.awayTeam?.score ?? 0;
      resultMap[`${home}_${away}`] = {
        homeScore: hs, awayScore: as,
        winner: hs > as ? home : away,
        spread: Math.abs(hs - as),
      };
    }

    const ins = db.prepare(`
      INSERT OR REPLACE INTO prediction_results
      (prediction_date, game_id, home_team, away_team, predicted_winner, actual_winner,
       predicted_spread, actual_spread, home_score_pred, away_score_pred,
       home_score_actual, away_score_actual, correct, spread_error, player_props, graded_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    let graded = 0;
    db.transaction(() => {
      for (const p of preds) {
        const result = resultMap[`${p.home_team}_${p.away_team}`];
        if (!result) continue;
        ins.run(
          p.prediction_date, p.game_id, p.home_team, p.away_team,
          p.predicted_winner, result.winner,
          p.predicted_spread, result.spread,
          p.home_score_pred, p.away_score_pred,
          result.homeScore, result.awayScore,
          p.predicted_winner === result.winner ? 1 : 0,
          Math.abs((p.predicted_spread || 0) - result.spread),
          p.player_props, Date.now()
        );
        graded++;
      }
      db.prepare("INSERT OR REPLACE INTO meta VALUES ('prediction_grading', ?)").run(Date.now());
    })();

    console.log(`[Grading] ${dateStr}: graded ${graded} predictions`);
  }
}

async function runEloRatings() {
  const script = path.join(__dirname, "ml", "elo_model.py");
  if (!fs.existsSync(script)) {
    console.warn("[Elo] ml/elo_model.py not found, skipping");
    return;
  }
  const lastRun = db.prepare("SELECT value FROM meta WHERE key='elo_last_run'").get();
  if (lastRun && Date.now() - parseInt(lastRun.value) < 23 * 60 * 60 * 1000) {
    console.log("[Elo] Skipping — ran less than 23h ago");
    return;
  }
  return new Promise((resolve, reject) => {
    const proc = spawn("python", [script], { stdio: "inherit" });
    proc.on("close", (code) => {
      if (code === 0) {
        db.prepare("INSERT OR REPLACE INTO meta VALUES ('elo_last_run', ?)").run(Date.now());
        console.log("[Elo] Ratings updated.");
        resolve();
      } else {
        reject(new Error(`[Elo] Script exited with code ${code}`));
      }
    });
    proc.on("error", reject);
  });
}

async function runXGBoostPredictions() {
  const script = path.join(__dirname, "ml", "xgboost_model.py");
  const modelFile = path.join(__dirname, "ml", "models", "xgb_win.json");
  if (!fs.existsSync(script)) {
    console.warn("[XGBoost] ml/xgboost_model.py not found, skipping");
    return;
  }

  // Write today's matchups from scoreboard so XGBoost runs independently of Claude
  const dateStr = todayDateStr();
  try {
    const scoreboardData = await fetchNBAEndpoint("scoreboardv3", { LeagueID: "00", GameDate: dateStr });
    const upcoming = (scoreboardData.scoreboard?.games || []).filter((g) => g.gameStatus === 1);
    const matchups = upcoming.map((g) => ({
      home_team: TEAM_ID_ABBR[g.homeTeam?.teamId] || g.homeTeam?.teamTricode,
      away_team: TEAM_ID_ABBR[g.awayTeam?.teamId] || g.awayTeam?.teamTricode,
    })).filter((m) => m.home_team && m.away_team);
    const matchupsPath = path.join(__dirname, "ml", "models", "matchups.json");
    fs.writeFileSync(matchupsPath, JSON.stringify({ date: dateStr, matchups }, null, 2));
    console.log(`[XGBoost] Wrote ${matchups.length} matchups for ${dateStr}`);
  } catch (e) {
    console.warn("[XGBoost] Could not write matchups.json:", e.message);
  }

  // Train if no model exists, otherwise just predict
  const args = fs.existsSync(modelFile) ? ["--predict"] : [];
  return new Promise((resolve) => {
    const proc = spawn("python", [script, ...args], { cwd: __dirname });
    proc.stdout.on("data", (d) => console.log("[XGBoost]", d.toString().trim()));
    proc.stderr.on("data", (d) => console.warn("[XGBoost]", d.toString().trim()));
    proc.on("close", (code) => {
      if (code === 0) console.log("[XGBoost] Done");
      else console.warn(`[XGBoost] Exited with code ${code}`);
      resolve();
    });
    proc.on("error", (e) => {
      console.warn("[XGBoost] Failed to spawn python:", e.message);
      resolve();
    });
  });
}

async function runPredictionJobs(force = false) {
  // Skip if predictions already ran within the last 12 hours (avoid re-running on every restart)
  if (!force) {
    const last = db.prepare("SELECT updated_at FROM meta WHERE key = 'predictions'").get();
    if (last && Date.now() - last.updated_at < 24 * 60 * 60 * 1000) {
      console.log("[PredictionJobs] Skipping — last run was", Math.round((Date.now() - last.updated_at) / 3600000), "hours ago");
      // Still grade past predictions even if we skip generating new ones
      try { await gradePredictions(); } catch (e) { console.error("[Grading] Error:", e.message); }
      return;
    }
  }
  console.log("[PredictionJobs] Starting...");
  // Elo ratings updated daily from game logs
  try { await runEloRatings(); } catch (e) { console.error("[Elo] Error:", e.message); }
  // XGBoost runs first so its output can be included in Claude's context
  try { await runXGBoostPredictions(); } catch (e) { console.error("[XGBoost] Error:", e.message); }
  try { await generatePredictions(); } catch (e) { console.error("[Predictions] Error:", e.message, e.stack); }
  try { await gradePredictions(); } catch (e) { console.error("[Grading] Error:", e.message); }
  console.log("[PredictionJobs] Done.");
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// SQLite-backed routes  (bulk / season data — always real, always fast)
// ---------------------------------------------------------------------------
app.get("/api/db/players", (_req, res) => {
  const rows = db.prepare("SELECT * FROM players ORDER BY ppg DESC").all();
  res.json(rows.map((r) => ({
    playerId:  r.player_id,
    name:      r.name,
    team:      r.team,
    pos:       r.pos,
    gp:        r.gp,
    mpg:       r.mpg?.toFixed(1)  ?? null,
    ppg:       r.ppg?.toFixed(1)  ?? null,
    rpg:       r.rpg?.toFixed(1)  ?? null,
    apg:       r.apg?.toFixed(1)  ?? null,
    spg:       r.spg?.toFixed(1)  ?? null,
    bpg:       r.bpg?.toFixed(1)  ?? null,
    fgPct:     r.fg_pct != null ? (r.fg_pct * 100).toFixed(1) : null,
    tpPct:     r.tp_pct != null ? (r.tp_pct * 100).toFixed(1) : null,
    ftPct:     r.ft_pct != null ? (r.ft_pct * 100).toFixed(1) : null,
    topg:      r.topg?.toFixed(1) ?? null,
    plusMinus: r.plus_minus != null
      ? (r.plus_minus >= 0 ? `+${r.plus_minus.toFixed(1)}` : r.plus_minus.toFixed(1))
      : null,
  })));
});

app.get("/api/db/standings", (_req, res) => {
  const rows = db.prepare("SELECT * FROM standings").all();
  const result = { East: [], West: [] };
  rows.forEach((r) => {
    const conf = r.conference === "East" ? "East" : "West";
    result[conf].push({
      team:     r.team,
      teamId:   r.team_id,
      wins:     r.wins,
      losses:   r.losses,
      pct:      r.pct?.toFixed(3) ?? ".000",
      gb:       r.gb,
      home:     r.home_rec,
      away:     r.away_rec,
      streak:   r.streak,
      last10:   r.last10,
      ppg:      r.ppg,
      oppPpg:   r.opp_ppg,
      diff:     r.diff,
      division: r.division,
    });
  });
  result.East.sort((a, b) => parseFloat(b.pct) - parseFloat(a.pct));
  result.West.sort((a, b) => parseFloat(b.pct) - parseFloat(a.pct));
  res.json(result);
});

app.get("/api/db/leaders", (_req, res) => {
  const rows = db.prepare(
    "SELECT * FROM league_leaders ORDER BY category, rank_num"
  ).all();
  const result = {};
  rows.forEach((r) => {
    if (!result[r.category]) result[r.category] = [];
    result[r.category].push({
      name:  r.player_name,
      team:  r.team,
      value: r.value?.toFixed(1) ?? "0.0",
    });
  });
  res.json(result);
});

app.get("/api/db/lineups", (req, res) => {
  const team = req.query.team;
  const groupSize = parseInt(req.query.groupSize) || 5;
  if (!team) return res.status(400).json({ error: "team required" });
  const rows = db.prepare(
    "SELECT * FROM lineups WHERE team = ? AND group_size = ? ORDER BY net_rtg DESC LIMIT 200"
  ).all(team, groupSize);
  res.json(rows.map((r) => ({
    players:   r.group_name,
    gp:        r.gp,
    min:       r.min != null ? Math.round(r.min) : null,
    pts:       r.pts?.toFixed(1)  ?? null,
    fgPct:     r.fg_pct != null ? (r.fg_pct * 100).toFixed(1) : null,
    ortg:      r.ortg?.toFixed(1) ?? null,
    drtg:      r.drtg?.toFixed(1) ?? null,
    netRtg:    r.net_rtg?.toFixed(1) ?? null,
    plusMinus: r.plus_minus != null
      ? (r.plus_minus >= 0 ? `+${r.plus_minus.toFixed(1)}` : r.plus_minus.toFixed(1))
      : null,
  })));
});

app.get("/api/db/lineup-profiles", (req, res) => {
  const { team, archetype } = req.query;
  let query = "SELECT * FROM lineup_profiles WHERE 1=1";
  const params = [];
  if (team)      { query += " AND team = ?";             params.push(team); }
  if (archetype) { query += " AND lineup_archetype = ?"; params.push(archetype); }
  query += " ORDER BY net_rtg DESC LIMIT 500";
  const rows = db.prepare(query).all(...params);
  res.json(rows.map((r) => ({
    lineupId:        r.lineup_id,
    team:            r.team,
    players:         r.group_name,
    playerArchetypes: JSON.parse(r.player_archetypes || "[]"),
    lineupArchetype: r.lineup_archetype,
    gp:              r.gp,
    min:             r.min?.toFixed(1) ?? null,
    pts:             r.pts?.toFixed(1) ?? null,
    fgPct:           r.fg_pct != null ? +(r.fg_pct * 100).toFixed(1) : null,
    ortg:            r.ortg?.toFixed(1) ?? null,
    drtg:            r.drtg?.toFixed(1) ?? null,
    netRtg:          r.net_rtg?.toFixed(1) ?? null,
    plusMinus:       r.plus_minus?.toFixed(1) ?? null,
  })));
});

app.get("/api/db/lineup-profiles/matchups", (_req, res) => {
  const rows = db.prepare(`
    SELECT
      lineup_archetype,
      COUNT(*)       AS lineup_count,
      AVG(ortg)      AS avg_ortg,
      AVG(drtg)      AS avg_drtg,
      AVG(net_rtg)   AS avg_net_rtg,
      AVG(pts)       AS avg_pts,
      SUM(gp)        AS total_gp
    FROM lineup_profiles
    WHERE lineup_archetype IS NOT NULL AND ortg IS NOT NULL AND drtg IS NOT NULL
    GROUP BY lineup_archetype
    ORDER BY avg_net_rtg DESC
  `).all();

  // Projected matchup diff: offenseORtg - defenseORtg
  // Positive = offense-favored, negative = defense-favored
  const statsMap = {};
  for (const r of rows) statsMap[r.lineup_archetype] = r;

  const matrix = {};
  for (const off of Object.keys(statsMap)) {
    matrix[off] = {};
    for (const def of Object.keys(statsMap)) {
      const o = statsMap[off].avg_ortg;
      const d = statsMap[def].avg_drtg;
      matrix[off][def] = o != null && d != null ? +(o - d).toFixed(1) : null;
    }
  }

  res.json({
    archetypes: rows.map((r) => ({
      label:       r.lineup_archetype,
      count:       r.lineup_count,
      avgOrtg:     r.avg_ortg?.toFixed(1) ?? null,
      avgDrtg:     r.avg_drtg?.toFixed(1) ?? null,
      avgNetRtg:   r.avg_net_rtg?.toFixed(1) ?? null,
      avgPts:      r.avg_pts?.toFixed(1) ?? null,
      totalGp:     r.total_gp,
    })),
    matrix,
  });
});

// ---------------------------------------------------------------------------
// Team stats endpoint — live computed stats replacing hardcoded TEAM_DETAILS
// ---------------------------------------------------------------------------
app.get("/api/db/team-stats", (req, res) => {
  try {
    const team = req.query.team;
    const rows = team
      ? db.prepare("SELECT * FROM team_stats_cache WHERE team = ?").all(team)
      : db.prepare("SELECT * FROM team_stats_cache ORDER BY team").all();
    res.json(rows);
  } catch (e) {
    console.error("[TeamStats] endpoint error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// Archetype matchup analysis endpoints
// ---------------------------------------------------------------------------
app.get("/api/db/team-archetypes", (req, res) => {
  try {
    const team = req.query.team;
    const rows = team
      ? db.prepare("SELECT * FROM team_archetypes WHERE team = ?").all(team)
      : db.prepare("SELECT * FROM team_archetypes ORDER BY team").all();
    res.json(rows);
  } catch (e) {
    console.error("[TeamArchetypes] endpoint error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// Team rating history — 5-game rolling ORtg/DRtg from player_game_logs
// ---------------------------------------------------------------------------
app.get("/api/db/team-rating-history", (req, res) => {
  try {
    const team = req.query.team;
    if (!team) return res.status(400).json({ error: "team param required" });

    // Aggregate player_game_logs into team game totals
    const games = db.prepare(`
      SELECT g.game_date,
             SUM(g.pts) AS pts, SUM(g.fga) AS fga, SUM(g.fgm) AS fgm,
             SUM(g.fg3a) AS fg3a, SUM(g.fg3m) AS fg3m,
             SUM(g.fta) AS fta, SUM(g.ftm) AS ftm,
             SUM(g.tov) AS tov, SUM(g.reb) AS reb,
             SUM(g.plus_minus) AS plus_minus
      FROM player_game_logs g
      LEFT JOIN players p ON g.player_id = p.player_id
      WHERE COALESCE(g.team, p.team) = ?
        AND g.season = ?
      GROUP BY g.game_date
      ORDER BY g.game_date ASC
    `).all(team, SEASON);

    if (games.length < 5) return res.json([]);

    // Compute 5-game rolling windows
    const windowSize = 5;
    const result = [];
    for (let i = windowSize - 1; i < games.length; i++) {
      let tPts = 0, tFga = 0, tFta = 0, tTov = 0, tPm = 0;
      for (let j = i - windowSize + 1; j <= i; j++) {
        tPts += games[j].pts;
        tFga += games[j].fga;
        tFta += games[j].fta;
        tTov += games[j].tov;
        tPm  += games[j].plus_minus;
      }
      // Estimated possessions per game
      const poss = tFga + 0.44 * tFta + tTov;
      const ortg = poss > 0 ? (tPts / poss) * 100 : 0;
      // Opponent points = team points - plus_minus
      const oppPts = tPts - tPm;
      const drtg = poss > 0 ? (oppPts / poss) * 100 : 0;
      const net = ortg - drtg;
      const gameNum = i + 1;
      result.push({
        game: `G${gameNum - windowSize + 1}-${gameNum}`,
        gameDate: games[i].game_date,
        ortg: Math.round(ortg * 10) / 10,
        drtg: Math.round(drtg * 10) / 10,
        net: Math.round(net * 10) / 10,
      });
    }
    res.json(result);
  } catch (e) {
    console.error("[TeamRatingHistory] Error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/db/archetype-matchups/fingerprints", (_req, res) => {
  try {
    const fps = computeTeamFingerprints();
    const teams = Object.entries(fps).map(([team, fp]) => {
      const style = classifyTeamStyle(fp);
      const sorted = ARCH_KEYS.map((k, i) => [k, fp[k] || 0]).sort((a, b) => b[1] - a[1]);
      return {
        team,
        style,
        fingerprint: fp,
        topArchetypes: sorted.slice(0, 3).map(([k]) => k),
      };
    });
    res.json({ teams });
  } catch (e) {
    console.error("[ArchetypeMatchups] fingerprints error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/db/archetype-matchups/team", (req, res) => {
  const team = req.query.team;
  if (!team) return res.status(400).json({ error: "team param required" });

  try {
    // Get opponent archetypes from team_archetypes table
    const oppArchetypes = {};
    const archRows = db.prepare("SELECT team, off_archetype, def_archetype FROM team_archetypes").all();
    for (const r of archRows) {
      if (r.team !== team) oppArchetypes[r.team] = { off: r.off_archetype, def: r.def_archetype };
    }

    // Pull game logs for this team's players, grouped by game
    const logs = db.prepare(`
      SELECT g.player_id, g.game_date, g.opponent, g.home,
             g.pts, g.reb, g.ast, g.stl, g.blk, g.plus_minus,
             g.fgm, g.fga, g.fg3m, g.fg3a, g.ftm, g.fta, g.tov,
             COALESCE(g.team, p.team) AS player_team
      FROM player_game_logs g
      LEFT JOIN players p ON g.player_id = p.player_id
      WHERE COALESCE(g.team, p.team) = ?
      ORDER BY g.game_date DESC
    `).all(team);

    // Aggregate by game_date (team totals per game)
    const gameMap = new Map();
    for (const row of logs) {
      const opp = row.opponent;
      if (!opp || !oppArchetypes[opp]) continue;
      const key = row.game_date;
      if (!gameMap.has(key)) {
        gameMap.set(key, {
          date: key, opponent: opp,
          oppOffense: oppArchetypes[opp].off,
          oppDefense: oppArchetypes[opp].def,
          pts: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0,
          ftm: 0, fta: 0, ast: 0, tov: 0,
          plusMinus: 0, playerCount: 0,
        });
      }
      const g = gameMap.get(key);
      g.pts += row.pts || 0;
      g.fgm += row.fgm || 0;
      g.fga += row.fga || 0;
      g.fg3m += row.fg3m || 0;
      g.fg3a += row.fg3a || 0;
      g.ftm += row.ftm || 0;
      g.fta += row.fta || 0;
      g.ast += row.ast || 0;
      g.tov += row.tov || 0;
      g.plusMinus += row.plus_minus || 0;
      g.playerCount++;
    }

    // Normalize plus_minus (sum of individual +/- / player count)
    const games = [...gameMap.values()];
    for (const g of games) {
      g.plusMinus = g.playerCount > 0 ? g.plusMinus / g.playerCount : 0;
    }

    // Season baseline for deltas
    const seasonTotals = { fga: 0, fta: 0, tov: 0, pts: 0, fgm: 0, fg3m: 0, fg3a: 0, ast: 0 };
    for (const g of games) {
      seasonTotals.fga += g.fga; seasonTotals.fta += g.fta; seasonTotals.tov += g.tov;
      seasonTotals.pts += g.pts; seasonTotals.fgm += g.fgm;
      seasonTotals.fg3m += g.fg3m; seasonTotals.fg3a += g.fg3a; seasonTotals.ast += g.ast;
    }
    const seasonPoss = seasonTotals.fga + 0.44 * seasonTotals.fta + seasonTotals.tov;
    const seasonORtg = seasonPoss > 0 ? (seasonTotals.pts / seasonPoss * 100) : 0;
    const seasonEfg = seasonTotals.fga > 0
      ? ((seasonTotals.fgm + 0.5 * seasonTotals.fg3m) / seasonTotals.fga * 100) : 0;
    const seasonTovPct = seasonPoss > 0 ? (seasonTotals.tov / seasonPoss * 100) : 0;

    // Helper to bucket games and compute per-possession stats
    function bucketStats(games, keyFn) {
      const buckets = {};
      for (const g of games) {
        const k = keyFn(g);
        if (!k) continue;
        if (!buckets[k]) buckets[k] = [];
        buckets[k].push(g);
      }
      return Object.entries(buckets).map(([label, gs]) => {
        const n = gs.length;
        const totalPts = gs.reduce((s, g) => s + g.pts, 0);
        const totalFga = gs.reduce((s, g) => s + g.fga, 0);
        const totalFgm = gs.reduce((s, g) => s + g.fgm, 0);
        const totalFg3a = gs.reduce((s, g) => s + g.fg3a, 0);
        const totalFg3m = gs.reduce((s, g) => s + g.fg3m, 0);
        const totalFta = gs.reduce((s, g) => s + g.fta, 0);
        const totalTov = gs.reduce((s, g) => s + g.tov, 0);
        const totalAst = gs.reduce((s, g) => s + g.ast, 0);
        const avgPm = gs.reduce((s, g) => s + g.plusMinus, 0) / n;
        const wins = gs.filter((g) => g.plusMinus > 0).length;

        // Per-possession metrics
        const poss = totalFga + 0.44 * totalFta + totalTov;
        const oRtg = poss > 0 ? (totalPts / poss * 100) : 0;
        const efgPct = totalFga > 0 ? ((totalFgm + 0.5 * totalFg3m) / totalFga * 100) : 0;
        const tovPct = poss > 0 ? (totalTov / poss * 100) : 0;
        const tpPct = totalFg3a > 0 ? (totalFg3m / totalFg3a * 100) : 0;
        const astTov = totalTov > 0 ? (totalAst / totalTov) : 0;

        return {
          label, games: n, record: `${wins}-${n - wins}`,
          oRtg: +oRtg.toFixed(1),
          efgPct: +efgPct.toFixed(1),
          tovPct: +tovPct.toFixed(1),
          tpPct: +tpPct.toFixed(1),
          astTov: +astTov.toFixed(2),
          avgPlusMinus: +avgPm.toFixed(1),
          // Deltas vs season
          oRtgDelta: +(oRtg - seasonORtg).toFixed(1),
          efgDelta: +(efgPct - seasonEfg).toFixed(1),
          tovDelta: +(tovPct - seasonTovPct).toFixed(1),
        };
      }).filter((s) => s.games >= 2).sort((a, b) => b.oRtg - a.oRtg);
    }

    // Group by opponent's offensive archetype (how we defend against their offense)
    const vsOffense = bucketStats(games, (g) => g.oppOffense);
    // Group by opponent's defensive archetype (how we score against their defense)
    const vsDefense = bucketStats(games, (g) => g.oppDefense);

    res.json({
      team,
      vsOffense,
      bestVsOffense: vsOffense[0]?.label || null,
      worstVsOffense: vsOffense[vsOffense.length - 1]?.label || null,
      vsDefense,
      bestVsDefense: vsDefense[0]?.label || null,
      worstVsDefense: vsDefense[vsDefense.length - 1]?.label || null,
    });
  } catch (e) {
    console.error("[ArchetypeMatchups] team error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/db/archetype-matchups/player", (req, res) => {
  const playerId = parseInt(req.query.playerId);
  if (!playerId) return res.status(400).json({ error: "playerId param required" });

  try {
    // Use team_archetypes for opponent classification (offense + defense)
    const oppArchetypes = {};
    const archRows = db.prepare("SELECT team, off_archetype, def_archetype FROM team_archetypes").all();
    for (const r of archRows) oppArchetypes[r.team] = { off: r.off_archetype, def: r.def_archetype };

    const profile = db.prepare("SELECT name, team, archetype_label FROM player_profiles WHERE player_id = ?").get(playerId);

    const logs = db.prepare(`
      SELECT game_date, opponent, pts, reb, ast, stl, blk, plus_minus,
             fgm, fga, fg3m, fg3a, ftm, fta, tov, min_played
      FROM player_game_logs WHERE player_id = ? ORDER BY game_date DESC
    `).all(playerId);

    // Compute season-wide baseline for comparison
    const seasonTotals = { fga: 0, fta: 0, tov: 0, pts: 0, fgm: 0, fg3m: 0, fg3a: 0, ast: 0, min: 0, games: 0 };
    for (const row of logs) {
      seasonTotals.fga += row.fga || 0;
      seasonTotals.fta += row.fta || 0;
      seasonTotals.tov += row.tov || 0;
      seasonTotals.pts += row.pts || 0;
      seasonTotals.fgm += row.fgm || 0;
      seasonTotals.fg3m += row.fg3m || 0;
      seasonTotals.fg3a += row.fg3a || 0;
      seasonTotals.ast += row.ast || 0;
      seasonTotals.min += row.min_played || 0;
      seasonTotals.games++;
    }
    const seasonPoss = seasonTotals.fga + 0.44 * seasonTotals.fta + seasonTotals.tov;
    const seasonTsPct = (seasonTotals.fga + 0.44 * seasonTotals.fta) > 0
      ? (seasonTotals.pts / (2 * (seasonTotals.fga + 0.44 * seasonTotals.fta)) * 100) : 0;
    const seasonPtsPer100 = seasonPoss > 0 ? (seasonTotals.pts / seasonPoss * 100) : 0;
    const seasonUsage = seasonTotals.min > 0
      ? ((seasonTotals.fga + 0.44 * seasonTotals.fta + seasonTotals.tov) / seasonTotals.min * 36) : 0;
    const seasonAstTov = seasonTotals.tov > 0 ? (seasonTotals.ast / seasonTotals.tov) : 0;

    // Helper to bucket games and compute per-possession efficiency stats
    function playerBucketStats(logs, keyFn) {
      const buckets = {};
      for (const row of logs) {
        const opp = row.opponent;
        if (!opp || !oppArchetypes[opp]) continue;
        const key = keyFn(opp);
        if (!key) continue;
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(row);
      }
      return Object.entries(buckets).map(([label, gs]) => {
        const n = gs.length;
        const totalFga = gs.reduce((s, g) => s + (g.fga || 0), 0);
        const totalFgm = gs.reduce((s, g) => s + (g.fgm || 0), 0);
        const totalFta = gs.reduce((s, g) => s + (g.fta || 0), 0);
        const totalFtm = gs.reduce((s, g) => s + (g.ftm || 0), 0);
        const totalFg3a = gs.reduce((s, g) => s + (g.fg3a || 0), 0);
        const totalFg3m = gs.reduce((s, g) => s + (g.fg3m || 0), 0);
        const totalPts = gs.reduce((s, g) => s + (g.pts || 0), 0);
        const totalAst = gs.reduce((s, g) => s + (g.ast || 0), 0);
        const totalTov = gs.reduce((s, g) => s + (g.tov || 0), 0);
        const totalMin = gs.reduce((s, g) => s + (g.min_played || 0), 0);
        // Estimated possessions: FGA + 0.44*FTA + TOV
        const poss = totalFga + 0.44 * totalFta + totalTov;
        const ptsPer100 = poss > 0 ? (totalPts / poss * 100) : 0;
        const tsPct = (totalFga + 0.44 * totalFta) > 0
          ? (totalPts / (2 * (totalFga + 0.44 * totalFta)) * 100) : 0;
        // Usage per 36 min
        const usage = totalMin > 0 ? (poss / totalMin * 36) : 0;
        const astTov = totalTov > 0 ? (totalAst / totalTov) : 0;
        const fg3Pct = totalFg3a > 0 ? (totalFg3m / totalFg3a * 100) : 0;
        const avgPm = gs.reduce((s, g) => s + (g.plus_minus || 0), 0) / n;

        return {
          label, games: n,
          ptsPer100: +ptsPer100.toFixed(1),
          tsPct: +tsPct.toFixed(1),
          usage: +usage.toFixed(1),
          astTov: +astTov.toFixed(2),
          fg3Pct: +fg3Pct.toFixed(1),
          avgPlusMinus: +avgPm.toFixed(1),
          // Deltas vs season average
          ptsPer100Delta: +(ptsPer100 - seasonPtsPer100).toFixed(1),
          tsPctDelta: +(tsPct - seasonTsPct).toFixed(1),
          usageDelta: +(usage - seasonUsage).toFixed(1),
        };
      }).filter((s) => s.games >= 2).sort((a, b) => b.ptsPer100 - a.ptsPer100);
    }

    // How this player performs against different opponent defensive styles
    const vsDefense = playerBucketStats(logs, (opp) => oppArchetypes[opp]?.def);
    // How this player performs against different opponent offensive styles
    const vsOffense = playerBucketStats(logs, (opp) => oppArchetypes[opp]?.off);

    res.json({
      playerId,
      playerName: profile?.name || null,
      archetypeLabel: profile?.archetype_label || null,
      seasonBaseline: {
        ptsPer100: +seasonPtsPer100.toFixed(1),
        tsPct: +seasonTsPct.toFixed(1),
        usage: +seasonUsage.toFixed(1),
        astTov: +seasonAstTov.toFixed(2),
        games: seasonTotals.games,
      },
      vsDefense,
      bestVsDefense: vsDefense[0]?.label || null,
      worstVsDefense: vsDefense[vsDefense.length - 1]?.label || null,
      vsOffense,
      bestVsOffense: vsOffense[0]?.label || null,
      worstVsOffense: vsOffense[vsOffense.length - 1]?.label || null,
    });
  } catch (e) {
    console.error("[ArchetypeMatchups] player error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/db/player-profiles", (req, res) => {
  const team = req.query.team;
  const playerId = req.query.playerId ? parseInt(req.query.playerId) : null;
  const rows = playerId
    ? db.prepare("SELECT * FROM player_profiles WHERE player_id = ?").all(playerId)
    : team
      ? db.prepare("SELECT * FROM player_profiles WHERE team = ? ORDER BY usg_pct DESC").all(team)
      : db.prepare("SELECT * FROM player_profiles ORDER BY usg_pct DESC").all();
  res.json(rows.map((r) => ({
    playerId:        r.player_id,
    name:            r.name,
    team:            r.team,
    // Advanced
    usgPct:          r.usg_pct != null   ? +(r.usg_pct * 100).toFixed(1)  : null,
    tsPct:           r.ts_pct != null    ? +(r.ts_pct  * 100).toFixed(1)  : null,
    astPct:          r.ast_pct != null   ? +(r.ast_pct * 100).toFixed(1)  : null,
    astTo:           r.ast_to?.toFixed(2)   ?? null,
    orebPct:         r.oreb_pct != null  ? +(r.oreb_pct * 100).toFixed(1) : null,
    drebPct:         r.dreb_pct != null  ? +(r.dreb_pct * 100).toFixed(1) : null,
    netRating:       r.net_rating?.toFixed(1) ?? null,
    pie:             r.pie != null       ? +(r.pie * 100).toFixed(1)      : null,
    pace:            r.pace?.toFixed(1)  ?? null,
    offRating:       r.off_rating?.toFixed(1) ?? null,
    defRating:       r.def_rating?.toFixed(1) ?? null,
    // Touches
    touches:         r.touches?.toFixed(1)          ?? null,
    timeOfPoss:      r.time_of_poss?.toFixed(1)     ?? null,
    frontCtTouches:  r.front_ct_touches?.toFixed(1) ?? null,
    elbowTouches:    r.elbow_touches?.toFixed(1)    ?? null,
    postTouches:     r.post_touches?.toFixed(1)     ?? null,
    paintTouches:    r.paint_touches?.toFixed(1)    ?? null,
    // Passing
    passesMade:      r.passes_made?.toFixed(1)      ?? null,
    potentialAst:    r.potential_ast?.toFixed(1)    ?? null,
    astPtsCreated:   r.ast_pts_created?.toFixed(1)  ?? null,
    // Drives
    drives:          r.drives?.toFixed(1)           ?? null,
    drivePts:        r.drive_pts?.toFixed(1)        ?? null,
    driveFgPct:      r.drive_fg_pct != null ? +(r.drive_fg_pct * 100).toFixed(1) : null,
    driveAst:        r.drive_ast?.toFixed(1)        ?? null,
    // Hustle
    contestedShots:  r.contested_shots?.toFixed(1)  ?? null,
    deflections:     r.deflections?.toFixed(1)      ?? null,
    screenAssists:   r.screen_assists?.toFixed(1)   ?? null,
    chargesDrawn:    r.charges_drawn?.toFixed(1)    ?? null,
    // Recent form (L15)
    l15Ppg:          r.l15_ppg?.toFixed(1)          ?? null,
    l15UsgPct:       r.l15_usg_pct != null ? +(r.l15_usg_pct * 100).toFixed(1) : null,
    l15TsPct:        r.l15_ts_pct  != null ? +(r.l15_ts_pct  * 100).toFixed(1) : null,
    formFactor:      r.form_factor?.toFixed(3)      ?? null,
    archetypeLabel:  r.archetype_label              ?? null,
    // Archetype scores (fuzzy 0-1)
    archFloorGeneral:    r.arch_floor_general       ?? null,
    archScoringPg:       r.arch_scoring_pg          ?? null,
    archComboGuard:      r.arch_combo_guard         ?? null,
    archLargePlaymaker:  r.arch_large_playmaker     ?? null,
    archThreeAndDWing:   r.arch_three_and_d_wing    ?? null,
    archTwoWayWing:      r.arch_two_way_wing        ?? null,
    archShotCreatingWing:r.arch_shot_creating_wing  ?? null,
    archPointWing:       r.arch_point_wing          ?? null,
    archStretchBig:      r.arch_stretch_big         ?? null,
    archUnicornBig:      r.arch_unicorn_big         ?? null,
    archRimRunningBig:   r.arch_rim_running_big     ?? null,
    archDefensiveAnchor: r.arch_defensive_anchor    ?? null,
    archVersatilePf:     r.arch_versatile_pf        ?? null,
    updatedAt:       r.updated_at,
  })));
});

app.get("/api/db/game-logs", (req, res) => {
  const playerId = parseInt(req.query.playerId);
  if (!playerId) return res.status(400).json({ error: "playerId required" });
  const season = req.query.season;
  const rows = season
    ? db.prepare(
        "SELECT * FROM player_game_logs WHERE player_id = ? AND season = ? ORDER BY game_date DESC"
      ).all(playerId, season)
    : db.prepare(
        "SELECT * FROM player_game_logs WHERE player_id = ? ORDER BY game_date DESC"
      ).all(playerId);
  res.json(rows.map((r) => ({
    season:    r.season,
    date:      r.game_date,
    opponent:  r.opponent,
    home:      !!r.home,
    min:       r.min_played?.toFixed(1) ?? null,
    pts:       r.pts,
    reb:       r.reb,
    ast:       r.ast,
    stl:       r.stl,
    blk:       r.blk,
    fgm:       r.fgm,
    fga:       r.fga,
    fg3m:      r.fg3m,
    fg3a:      r.fg3a,
    ftm:       r.ftm,
    fta:       r.fta,
    tov:       r.tov,
    plusMinus: r.plus_minus,
  })));
});

app.get("/api/db/game-logs/summary", (_req, res) => {
  const s = db.prepare(`
    SELECT COUNT(*) as totalRows,
           COUNT(DISTINCT player_id) as players,
           COUNT(DISTINCT season) as seasons,
           MIN(game_date) as earliest,
           MAX(game_date) as latest
    FROM player_game_logs
  `).get();
  res.json(s);
});

app.get("/api/db/status", (_req, res) => {
  const status = {};
  ["players", "standings", "leaders"].forEach((k) => {
    const row = db.prepare("SELECT updated_at FROM meta WHERE key = ?").get(k);
    const table = k === "leaders" ? "league_leaders" : k;
    status[k] = {
      updatedAt: row?.updated_at ?? null,
      stale: isStale(k),
      empty: isEmpty(table),
    };
  });
  res.json(status);
});

// Force-refresh all tables
app.post("/api/db/refresh", async (_req, res) => {
  try {
    await refreshAll(true);
    res.json({ success: true, ts: Date.now() });
  } catch (e) {
    console.error("[DB] Refresh failed:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/predictions/generate", async (_req, res) => {
  try {
    // Clear today's existing predictions so it reruns even if already saved
    const dateStr = todayDateStr();
    db.prepare("DELETE FROM predictions WHERE prediction_date = ?").run(dateStr);
    await runPredictionJobs(true);
    const rows = db.prepare("SELECT COUNT(*) as c FROM predictions WHERE prediction_date = ?").get(dateStr);
    res.json({ success: true, count: rows.c });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// Predictions API
// ---------------------------------------------------------------------------

app.get("/api/predictions/today", (_req, res) => {
  const dateStr = todayDateStr();
  let rows = db.prepare(
    "SELECT * FROM predictions WHERE prediction_date = ? ORDER BY confidence DESC"
  ).all(dateStr);

  // Fall back to most recent available predictions
  if (rows.length === 0) {
    rows = db.prepare(
      "SELECT * FROM predictions WHERE prediction_date = (SELECT MAX(prediction_date) FROM predictions) ORDER BY confidence DESC"
    ).all();
  }

  const metaRow = db.prepare("SELECT updated_at FROM meta WHERE key = 'predictions'").get();

  res.json({
    date: rows[0]?.prediction_date || dateStr,
    generatedAt: metaRow?.updated_at || null,
    predictions: rows.map((r) => ({
      gameId:          r.game_id,
      homeTeam:        r.home_team,
      awayTeam:        r.away_team,
      predictedWinner: r.predicted_winner,
      spread:          r.predicted_spread,
      confidence:      r.confidence,
      homeScorePred:   r.home_score_pred,
      awayScorePred:   r.away_score_pred,
      upsetAlert:      !!r.upset_alert,
      reasoning:       r.reasoning,
      playerProps:     JSON.parse(r.player_props || "[]"),
    })),
  });
});

// Returns actual final scores for a given date from team_game_results.
// Used by the client to supplement scoreboardv3 which returns score=0 for past dates.
app.get("/api/db/game-results", (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date required (YYYY-MM-DD)" });
  // Each game has two rows (one per team). Keep only home-team rows to deduplicate.
  const rows = db.prepare(`
    SELECT team, opponent, home, pts, opp_pts, win
    FROM team_game_results
    WHERE game_date = ? AND home = 1
  `).all(date);
  const games = rows.map((r) => ({
    homeTeam: r.team,
    awayTeam: r.opponent,
    homeScore: r.pts,
    awayScore: r.opp_pts,
  }));
  res.json({ games });
});

app.get("/api/db/elo-ratings", (_req, res) => {
  const eloPath = path.join(__dirname, "ml", "models", "elo_ratings.json");
  try {
    if (!fs.existsSync(eloPath)) return res.json({ teams: [] });
    const data = JSON.parse(fs.readFileSync(eloPath, "utf-8"));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/predictions/xgboost", (_req, res) => {
  const predPath = path.join(__dirname, "ml", "models", "predictions.json");
  try {
    if (!fs.existsSync(predPath)) return res.json({ predictions: [] });
    const data = JSON.parse(fs.readFileSync(predPath, "utf-8"));
    // Flag as stale if the predictions aren't from today
    if (data.date && data.date !== todayDateStr()) data.stale = true;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/predictions/history", (req, res) => {
  const limit = parseInt(req.query.days) || 7;
  const rows = db.prepare(`
    SELECT * FROM prediction_results
    WHERE graded_at IS NOT NULL
    ORDER BY prediction_date DESC, home_team
    LIMIT ?
  `).all(limit * 15);

  const grouped = {};
  for (const r of rows) {
    if (!grouped[r.prediction_date]) grouped[r.prediction_date] = [];
    grouped[r.prediction_date].push({
      gameId:          r.game_id,
      homeTeam:        r.home_team,
      awayTeam:        r.away_team,
      predictedWinner: r.predicted_winner,
      actualWinner:    r.actual_winner,
      predictedSpread: r.predicted_spread,
      actualSpread:    r.actual_spread,
      homeScorePred:   r.home_score_pred,
      awayScorePred:   r.away_score_pred,
      homeScoreActual: r.home_score_actual,
      awayScoreActual: r.away_score_actual,
      correct:         !!r.correct,
      spreadError:     r.spread_error,
      playerProps:     JSON.parse(r.player_props || "[]"),
    });
  }
  res.json(grouped);
});

app.get("/api/predictions/accuracy", (_req, res) => {
  const overall = db.prepare(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) as correct,
           AVG(spread_error) as avgSpreadError
    FROM prediction_results WHERE graded_at IS NOT NULL
  `).get();

  const daily = db.prepare(`
    SELECT prediction_date as date,
           COUNT(*) as total,
           SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) as correct
    FROM prediction_results
    WHERE graded_at IS NOT NULL
    GROUP BY prediction_date
    ORDER BY prediction_date DESC
    LIMIT 30
  `).all();

  res.json({
    overall: {
      total:          overall.total,
      correct:        overall.correct || 0,
      pct:            overall.total > 0 ? +((overall.correct / overall.total) * 100).toFixed(1) : 0,
      avgSpreadError: overall.avgSpreadError != null ? +overall.avgSpreadError.toFixed(1) : null,
    },
    daily: daily.map((d) => ({
      date:    d.date,
      total:   d.total,
      correct: d.correct,
      pct:     +((d.correct / d.total) * 100).toFixed(1),
    })),
  });
});

// ---------------------------------------------------------------------------
// File-cache proxy for real-time endpoints (scoreboard, boxscore, gamelogs)
// ---------------------------------------------------------------------------
const FILE_CACHE_TTL = {
  scoreboardv3:          5 * 60 * 1000,
  teamgamelog:           4 * 60 * 60 * 1000,  // 4 hours
  boxscoretraditionalv2: 60 * 1000,
  boxscoretraditionalv3: 60 * 1000,
  playergamelog:         12 * 60 * 60 * 1000,
  commonteamroster:      7 * 24 * 60 * 60 * 1000,
};
const DEFAULT_FILE_TTL = 5 * 60 * 1000;

function buildCacheKey(endpoint, params = {}) {
  const sorted = new URLSearchParams(
    Object.entries(params).sort(([a], [b]) => a.localeCompare(b))
  ).toString();
  return `${endpoint}__${sorted}`;
}
function sanitizeKey(key) { return key.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 200); }
function getCachePath(key) { return path.join(DATA_DIR, `${sanitizeKey(key)}.json`); }

function readFileCache(key) {
  const fp = getCachePath(key);
  try {
    if (!fs.existsSync(fp)) return null;
    const env = JSON.parse(fs.readFileSync(fp, "utf-8"));
    if (Date.now() - env.cachedAt > env.ttl) return null;
    return env.data;
  } catch { try { fs.unlinkSync(fp); } catch {} return null; }
}
function writeFileCache(key, endpoint, data, ttlOverride) {
  try {
    const ttl = ttlOverride ?? FILE_CACHE_TTL[endpoint] ?? DEFAULT_FILE_TTL;
    fs.writeFileSync(getCachePath(key), JSON.stringify({ cachedAt: Date.now(), ttl, data }));
  } catch {}
}

app.get("/api/nba/:endpoint", async (req, res) => {
  const { endpoint } = req.params;
  const cacheKey = buildCacheKey(endpoint, req.query);
  // Past-date scoreboards are immutable — cache for 7 days instead of 5 minutes.
  // Use string comparison (YYYY-MM-DD) to avoid UTC vs local timezone bugs where
  // the server (UTC) treats the client's "today" as "yesterday" during late evenings.
  let ttl = FILE_CACHE_TTL[endpoint] || DEFAULT_FILE_TTL;
  let isPastScoreboard = false;
  if (endpoint === "scoreboardv3" && req.query.GameDate) {
    const todayStr = new Date().toISOString().split("T")[0]; // e.g. "2026-03-22" UTC
    // Only apply 7-day TTL for dates that are strictly 2+ days in the past —
    // the 1-day buffer handles timezone offsets (e.g. EST user at 11 PM = next UTC day).
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    if (req.query.GameDate < yesterdayStr) {
      ttl = 7 * 24 * 60 * 60 * 1000; // 7 days
    } else if (req.query.GameDate < todayStr) {
      // Yesterday: use 4-hour TTL once all games are final, 5 min while still in progress
      ttl = 4 * 60 * 60 * 1000;
      isPastScoreboard = true;
    }
  }

  const cached = readFileCache(cacheKey);
  if (cached) {
    // For past-date scoreboards (yesterday): bypass cache if any game is not final.
    // This prevents serving mid-game scores after games have ended.
    if (isPastScoreboard) {
      const games = cached.scoreboard?.games || [];
      const allFinal = games.length > 0 && games.every((g) => g.gameStatus === 3);
      if (!allFinal) {
        // Fall through to re-fetch fresh data from NBA API
      } else {
        res.set("Cache-Control", `public, max-age=${Math.floor(ttl / 1000)}`);
        res.set("X-Cache", "HIT");
        return res.json(cached);
      }
    } else {
      // NOTE: Do NOT mutate cached game statuses here. The client already forces
      // past-date games to FINAL using its local timezone (more accurate than server UTC).
      res.set("Cache-Control", `public, max-age=${Math.floor(ttl / 1000)}`);
      res.set("X-Cache", "HIT");
      return res.json(cached);
    }
  }

  const query = new URLSearchParams(req.query).toString();
  const url = `${NBA_BASE}/${endpoint}${query ? "?" + query : ""}`;
  try {
    const response = await fetch(url, { headers: NBA_HEADERS });
    if (!response.ok) return res.status(response.status).json({ error: `NBA API ${response.status}` });
    const data = await response.json();
    // For past-date scoreboards, only use the long TTL if all games are final —
    // if any game is still live/pre-game, keep re-fetching every 5 minutes.
    let writeTtl = ttl;
    if (endpoint === "scoreboardv3" && ttl > FILE_CACHE_TTL.scoreboardv3) {
      const games = data.scoreboard?.games || [];
      const allFinal = games.length > 0 && games.every((g) => g.gameStatus === 3);
      if (!allFinal) writeTtl = FILE_CACHE_TTL.scoreboardv3; // 5 min — keep re-fetching
    }
    // Don't cache boxscoretraditionalv3 when players are empty — game may be live
    // and the CDN fallback (client-side) needs a fresh v3 call each time to trigger.
    if (endpoint === "boxscoretraditionalv3") {
      const bt = data.boxScoreTraditional;
      const hasPlayers = bt?.homeTeam?.players?.length || bt?.awayTeam?.players?.length;
      if (!hasPlayers) {
        res.set("Cache-Control", "no-cache");
        res.set("X-Cache", "MISS");
        return res.json(data);
      }
    }
    writeFileCache(cacheKey, endpoint, data, writeTtl);
    res.set("Cache-Control", `public, max-age=${Math.floor(writeTtl / 1000)}`);
    res.set("X-Cache", "MISS");
    res.json(data);
  } catch (err) {
    console.error(`Proxy error for ${endpoint}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// CDN live box score proxy — stats.nba.com v3 returns empty for in-progress games,
// but the CDN feed at cdn.nba.com has live data in the same format.
app.get("/api/nba-live/boxscore/:gameId", async (req, res) => {
  const { gameId } = req.params;
  const url = `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${gameId}.json`;
  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).json({ error: `CDN ${response.status}` });
    const data = await response.json();
    // Reshape cdn response (data.game) to match v3 format (data.boxScoreTraditional)
    res.json({ boxScoreTraditional: data.game });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/cache/clear", (_req, res) => {
  try {
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
    files.forEach((f) => { try { fs.unlinkSync(path.join(DATA_DIR, f)); } catch {} });
    res.json({ cleared: files.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Courtside proxy running on http://localhost:${PORT}`);
  console.log(`SQLite DB: ${DB_PATH}`);
  // One-time migration: remove stale "Balanced" labels so team_archetypes refreshes with correct labels
  try {
    const stale = db.prepare("SELECT COUNT(*) AS c FROM team_archetypes WHERE off_archetype = 'Balanced' OR def_archetype = 'Balanced'").get();
    if (stale?.c > 0) {
      db.prepare("DELETE FROM team_archetypes").run();
      db.prepare("DELETE FROM meta WHERE key = 'team_archetypes'").run();
      console.log(`[Migration] Cleared ${stale.c} stale 'Balanced' team archetype rows — will re-classify on next refresh`);
    }
  } catch {}
  // Seed DB on startup; re-check every 6 hours
  refreshAll().catch((e) => console.error("[DB] Initial refresh error:", e.message));
  setInterval(
    () => refreshAll().catch((e) => console.error("[DB] Scheduled refresh:", e.message)),
    6 * 60 * 60 * 1000
  );
  // Predictions: run 30s after startup (let DB populate first), then every 6 hours
  setTimeout(() => runPredictionJobs(), 30_000);
  // Historical game log backfill — runs once ever, 90s after startup
  const backfillDone = db.prepare("SELECT updated_at FROM meta WHERE key = 'game_logs_backfill'").get();
  if (!backfillDone) {
    console.log("[GameLogs] Scheduling one-time historical backfill in 90s...");
    setTimeout(
      () => backfillHistoricalLogs().catch((e) => console.error("[GameLogs] Backfill error:", e.message)),
      90_000
    );
  }
  setInterval(
    () => runPredictionJobs().catch((e) => console.error("[PredictionJobs]", e.message)),
    6 * 60 * 60 * 1000
  );
});
