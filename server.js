import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

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
`);

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

async function refreshAll(force = false) {
  await Promise.allSettled([
    (force || isStale("players")   || isEmpty("players"))         ? refreshPlayers()  : Promise.resolve(),
    (force || isStale("standings") || isEmpty("standings"))       ? refreshStandings() : Promise.resolve(),
    (force || isStale("leaders")   || isEmpty("league_leaders"))  ? refreshLeaders()  : Promise.resolve(),
    (force || isStale("lineups")   || isEmpty("lineups"))         ? refreshLineups()  : Promise.resolve(),
  ]);
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
  const ttl = FILE_CACHE_TTL[endpoint] || DEFAULT_FILE_TTL;

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
});
