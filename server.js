import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import Database from "better-sqlite3";

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

function isStale(key, ttlMs = 12 * 60 * 60 * 1000) {
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
    INSERT OR REPLACE INTO player_profiles VALUES
    (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
        Date.now()
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
    return;
  }
  const proc = spawn("python", [script], { cwd: __dirname });
  proc.stdout.on("data", (d) => console.log("[Clustering]", d.toString().trim()));
  proc.stderr.on("data", (d) => console.warn("[Clustering]", d.toString().trim()));
  proc.on("close", (code) => {
    if (code === 0) console.log("[Clustering] Archetypes updated successfully");
    else console.warn(`[Clustering] Exited with code ${code}`);
  });
  proc.on("error", (e) => console.warn("[Clustering] Failed to spawn python:", e.message));
}

async function refreshAll(force = false) {
  await Promise.allSettled([
    (force || isStale("players")   || isEmpty("players"))         ? refreshPlayers()  : Promise.resolve(),
    (force || isStale("standings") || isEmpty("standings"))       ? refreshStandings() : Promise.resolve(),
    (force || isStale("leaders")   || isEmpty("league_leaders"))  ? refreshLeaders()  : Promise.resolve(),
    (force || isStale("lineups")   || isEmpty("lineups"))         ? refreshLineups()  : Promise.resolve(),
  ]);
  // Player profiles run after — 7 sequential API calls, keep them separate
  if (force || isStale("player_profiles", 24 * 60 * 60 * 1000) || isEmpty("player_profiles")) {
    await refreshPlayerProfiles().catch((e) => console.error("[DB] Player profiles error:", e.message));
    // Re-cluster archetypes after profiles update
    runClustering();
  }
  // Current season game log update — runs once per day after players table is fresh
  if (force || isStale("game_logs_current", 24 * 60 * 60 * 1000)) {
    await updateCurrentSeasonLogs().catch((e) => console.error("[GameLogs] Update error:", e.message));
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
      await new Promise((r) => setTimeout(r, 150)); // rate limit
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
    await new Promise((r) => setTimeout(r, 150));
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
  const upcomingGames = games.filter((g) => g.gameStatus === 1);
  console.log(`[Predictions] ${dateStr}: ${games.length} total games, ${upcomingGames.length} upcoming (status=1)`);
  if (upcomingGames.length === 0) return { games: [], dateStr, context: "" };

  // Pull from local DB
  const standings = db.prepare("SELECT * FROM standings ORDER BY pct DESC").all();
  const topPlayers = db.prepare("SELECT * FROM players ORDER BY ppg DESC LIMIT 100").all();

  // Collect team abbreviations for today's games
  const teamAbbrs = new Set();
  for (const g of upcomingGames) {
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

  const gamesText = upcomingGames.map((g) => {
    const home = TEAM_ID_ABBR[g.homeTeam?.teamId] || g.homeTeam?.teamTricode;
    const away = TEAM_ID_ABBR[g.awayTeam?.teamId] || g.awayTeam?.teamTricode;
    const homeLog = (gameLogs[home] || []).map((l) => `${l.matchup} ${l.wl} ${l.pts}pts`).join(", ");
    const awayLog = (gameLogs[away] || []).map((l) => `${l.matchup} ${l.wl} ${l.pts}pts`).join(", ");
    return `${away}@${home} (${g.gameId}) | ${home} L3: ${homeLog} | ${away} L3: ${awayLog}`;
  }).join("\n\n");

  const relevantPlayers = topPlayers.filter((p) => teamAbbrs.has(p.team)).slice(0, 20);
  const profileMap = new Map();
  if (relevantPlayers.length > 0) {
    const placeholders = relevantPlayers.map(() => "?").join(",");
    const profileRows = db.prepare(
      `SELECT player_id, usg_pct, ts_pct, net_rating, form_factor, archetype_label FROM player_profiles WHERE player_id IN (${placeholders})`
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
      if (prof.archetype_label) profStr += ` [${prof.archetype_label}]`;
    }
    return `${base}${l5Str}${profStr}`;
  }).join("\n");

  const accuracyText = last30.total > 0
    ? `Your historical accuracy (last 30 days): ${last30.wins}/${last30.total} (${((last30.wins / last30.total) * 100).toFixed(1)}%). Adjust your approach based on past errors.`
    : "No historical predictions to reference yet.";

  return {
    games: upcomingGames,
    dateStr,
    context: `${accuracyText}\n\n--- STANDINGS ---\n${standingsText}\n\n--- TODAY'S GAMES ---\n${gamesText}\n\n--- KEY PLAYERS ---\n${playersText}`,
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

async function runPredictionJobs() {
  console.log("[PredictionJobs] Starting...");
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
    await runPredictionJobs();
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
function writeFileCache(key, endpoint, data) {
  try {
    fs.writeFileSync(
      getCachePath(key),
      JSON.stringify({ cachedAt: Date.now(), ttl: FILE_CACHE_TTL[endpoint] || DEFAULT_FILE_TTL, data })
    );
  } catch {}
}

app.get("/api/nba/:endpoint", async (req, res) => {
  const { endpoint } = req.params;
  const cacheKey = buildCacheKey(endpoint, req.query);
  // Past-date scoreboards are immutable — cache for 7 days instead of 5 minutes
  let ttl = FILE_CACHE_TTL[endpoint] || DEFAULT_FILE_TTL;
  if (endpoint === "scoreboardv3" && req.query.GameDate) {
    const today = new Date();
    const reqDate = new Date(req.query.GameDate);
    if (reqDate < today && reqDate.toDateString() !== today.toDateString()) {
      ttl = 7 * 24 * 60 * 60 * 1000; // 7 days
    }
  }

  const cached = readFileCache(cacheKey);
  if (cached) {
    res.set("Cache-Control", `public, max-age=${Math.floor(ttl / 1000)}`);
    res.set("X-Cache", "HIT");
    return res.json(cached);
  }

  const query = new URLSearchParams(req.query).toString();
  const url = `${NBA_BASE}/${endpoint}${query ? "?" + query : ""}`;
  try {
    const response = await fetch(url, { headers: NBA_HEADERS });
    if (!response.ok) return res.status(response.status).json({ error: `NBA API ${response.status}` });
    const data = await response.json();
    writeFileCache(cacheKey, endpoint, data);
    res.set("Cache-Control", `public, max-age=${Math.floor(ttl / 1000)}`);
    res.set("X-Cache", "MISS");
    res.json(data);
  } catch (err) {
    console.error(`Proxy error for ${endpoint}:`, err.message);
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
