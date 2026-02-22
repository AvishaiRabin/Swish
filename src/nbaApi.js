// NBA API service — fetches data via our local proxy to avoid CORS issues
// All endpoints go through /api/nba/ which proxies to stats.nba.com
// Two-tier cache: in-memory Map (instant) → localStorage (survives reload) → proxy

const API_BASE = "/api/nba";

// Current season
const SEASON = "2024-25";

// ---------------------------------------------------------------------------
// TTL configuration per endpoint (milliseconds) — matches server.js
// ---------------------------------------------------------------------------
const CACHE_TTL = {
  leaguestandingsv3:     12 * 60 * 60 * 1000,  // 12 hours
  leagueleaders:         12 * 60 * 60 * 1000,  // 12 hours
  leaguedashplayerstats: 12 * 60 * 60 * 1000,  // 12 hours
  playergamelog:         12 * 60 * 60 * 1000,  // 12 hours
  scoreboardv3:           5 * 60 * 1000,        // 5 minutes
  commonteamroster:       7 * 24 * 60 * 60 * 1000, // 7 days
};
const DEFAULT_TTL = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Cache key builder (same convention as server.js)
// ---------------------------------------------------------------------------
function buildCacheKey(endpoint, params = {}) {
  const sorted = new URLSearchParams(
    Object.entries(params).sort(([a], [b]) => a.localeCompare(b))
  ).toString();
  return `${endpoint}__${sorted}`;
}

// ---------------------------------------------------------------------------
// localStorage cache helpers
// ---------------------------------------------------------------------------
const LS_PREFIX = "nba_cache_";

function readLocalCache(cacheKey) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + cacheKey);
    if (!raw) return null;
    const envelope = JSON.parse(raw);
    if (Date.now() - envelope.cachedAt > envelope.ttl) {
      localStorage.removeItem(LS_PREFIX + cacheKey);
      return null;
    }
    return envelope.data;
  } catch {
    try { localStorage.removeItem(LS_PREFIX + cacheKey); } catch {}
    return null;
  }
}

function writeLocalCache(cacheKey, endpoint, data) {
  const ttl = CACHE_TTL[endpoint] || DEFAULT_TTL;
  const envelope = { cachedAt: Date.now(), ttl, data };
  try {
    localStorage.setItem(LS_PREFIX + cacheKey, JSON.stringify(envelope));
  } catch {
    evictOldestEntries();
    try {
      localStorage.setItem(LS_PREFIX + cacheKey, JSON.stringify(envelope));
    } catch {}
  }
}

function evictOldestEntries() {
  const entries = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(LS_PREFIX)) {
      try {
        const env = JSON.parse(localStorage.getItem(key));
        entries.push({ key, cachedAt: env.cachedAt || 0 });
      } catch {
        localStorage.removeItem(key);
      }
    }
  }
  entries.sort((a, b) => a.cachedAt - b.cachedAt);
  const toRemove = Math.ceil(entries.length / 2);
  for (let i = 0; i < toRemove; i++) {
    localStorage.removeItem(entries[i].key);
  }
}

// ---------------------------------------------------------------------------
// Core fetch with two-tier cache: memCache → localStorage → network
// ---------------------------------------------------------------------------
const memCache = new Map();

async function fetchNba(endpoint, params = {}) {
  const cacheKey = buildCacheKey(endpoint, params);

  // 1. In-memory cache (instant, avoids JSON parse)
  if (memCache.has(cacheKey)) return memCache.get(cacheKey);

  // 2. localStorage (survives page reload)
  const localCached = readLocalCache(cacheKey);
  if (localCached) {
    memCache.set(cacheKey, localCached);
    return localCached;
  }

  // 3. Fetch from proxy server
  const query = new URLSearchParams(params).toString();
  const url = `${API_BASE}/${endpoint}?${query}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NBA API ${res.status}: ${res.statusText}`);
  const data = await res.json();

  // 4. Store in both caches
  memCache.set(cacheKey, data);
  writeLocalCache(cacheKey, endpoint, data);

  return data;
}

// Helper to parse NBA stats response (resultSets[index].rowSet with headers)
function parseResultSet(data, index = 0) {
  const rs = data.resultSets[index];
  const headers = rs.headers;
  return rs.rowSet.map((row) => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i]));
    return obj;
  });
}

// ============================================================================
// STANDINGS
// ============================================================================
export async function fetchStandings() {
  const data = await fetchNba("leaguestandingsv3", {
    LeagueID: "00",
    Season: SEASON,
    SeasonType: "Regular Season",
  });

  const rows = parseResultSet(data, 0);

  const standings = { East: [], West: [] };

  rows.forEach((r) => {
    const conf = r.Conference === "East" ? "East" : "West";
    const wins = r.WINS;
    const losses = r.LOSSES;
    const gp = wins + losses;

    standings[conf].push({
      team: r.TeamAbbreviation || r.TeamCity?.substring(0, 3).toUpperCase(),
      teamId: r.TeamID,
      wins,
      losses,
      pct: (wins / gp).toFixed(3),
      gb: r.ConferenceGamesBack || "-",
      home: r.HOME || `${r.HomeWins || 0}-${r.HomeLosses || 0}`,
      away: r.ROAD || `${r.RoadWins || 0}-${r.RoadLosses || 0}`,
      streak: r.strCurrentStreak || r.CurrentStreak || "—",
      last10: r.L10 || `${r.Last10Wins || 0}-${r.Last10Losses || 0}`,
      ppg: r.PointsPG ? +r.PointsPG.toFixed(1) : +(r.PointsFor / gp).toFixed(1),
      oppPpg: r.OppPointsPG ? +r.OppPointsPG.toFixed(1) : +(r.PointsAgainst / gp).toFixed(1),
      diff: r.DiffPointsPG
        ? (r.DiffPointsPG >= 0 ? "+" : "") + r.DiffPointsPG.toFixed(1)
        : ((r.PointsFor - r.PointsAgainst) / gp >= 0 ? "+" : "") + ((r.PointsFor - r.PointsAgainst) / gp).toFixed(1),
      division: r.Division || "",
    });
  });

  // Sort by win pct within each conference
  standings.East.sort((a, b) => b.wins / (b.wins + b.losses) - a.wins / (a.wins + a.losses));
  standings.West.sort((a, b) => b.wins / (b.wins + b.losses) - a.wins / (a.wins + a.losses));

  return standings;
}

// ============================================================================
// LEAGUE LEADERS
// ============================================================================
export async function fetchLeagueLeaders() {
  const categories = [
    { stat: "PTS", label: "points" },
    { stat: "REB", label: "rebounds" },
    { stat: "AST", label: "assists" },
    { stat: "STL", label: "steals" },
    { stat: "BLK", label: "blocks" },
    { stat: "FG3M", label: "threePointers" },
  ];

  const leaders = {};

  for (const cat of categories) {
    try {
      const data = await fetchNba("leagueleaders", {
        LeagueID: "00",
        PerMode: "PerGame",
        Scope: "S",
        Season: SEASON,
        SeasonType: "Regular Season",
        StatCategory: cat.stat,
      });
      const rows = parseResultSet(data, 0);
      leaders[cat.label] = rows.slice(0, 5).map((r) => ({
        name: r.PLAYER,
        team: r.TEAM_ABBREVIATION || r.TEAM,
        value: r[cat.stat]?.toFixed?.(1) || String(r[cat.stat]),
      }));
    } catch (e) {
      console.warn(`Failed to fetch leaders for ${cat.stat}:`, e.message);
      leaders[cat.label] = [];
    }
  }

  return leaders;
}

// ============================================================================
// PLAYER STATS (for browse page + detail)
// ============================================================================
export async function fetchPlayerStats() {
  const data = await fetchNba("leaguedashplayerstats", {
    Conference: "",
    DateFrom: "",
    DateTo: "",
    Division: "",
    GameScope: "",
    GameSegment: "",
    Height: "",
    LastNGames: 0,
    LeagueID: "00",
    Location: "",
    MeasureType: "Base",
    Month: 0,
    OpponentTeamID: 0,
    Outcome: "",
    PORound: 0,
    PaceAdjust: "N",
    PerMode: "PerGame",
    Period: 0,
    PlayerExperience: "",
    PlayerPosition: "",
    PlusMinus: "N",
    Rank: "N",
    Season: SEASON,
    SeasonSegment: "",
    SeasonType: "Regular Season",
    ShotClockRange: "",
    StarterBench: "",
    TeamID: 0,
    TwoWay: 0,
    VsConference: "",
    VsDivision: "",
    Weight: "",
  });

  const rows = parseResultSet(data, 0);

  // Return top 50 by PPG for the browse page
  return rows
    .sort((a, b) => b.PTS - a.PTS)
    .slice(0, 50)
    .map((r) => ({
      playerId: r.PLAYER_ID,
      name: r.PLAYER_NAME,
      team: r.TEAM_ABBREVIATION,
      gp: r.GP,
      mpg: r.MIN?.toFixed(1),
      ppg: r.PTS?.toFixed(1),
      rpg: r.REB?.toFixed(1),
      apg: r.AST?.toFixed(1),
      spg: r.STL?.toFixed(1),
      bpg: r.BLK?.toFixed(1),
      fgPct: (r.FG_PCT * 100)?.toFixed(1),
      tpPct: (r.FG3_PCT * 100)?.toFixed(1),
      ftPct: (r.FT_PCT * 100)?.toFixed(1),
      topg: r.TOV?.toFixed(1),
    }));
}

// ============================================================================
// PLAYER GAME LOG
// ============================================================================
export async function fetchPlayerGameLog(playerId) {
  const data = await fetchNba("playergamelog", {
    PlayerID: playerId,
    Season: SEASON,
    SeasonType: "Regular Season",
  });

  const rows = parseResultSet(data, 0);

  return rows.slice(0, 20).map((r) => {
    const matchup = r.MATCHUP || "";
    const oppMatch = matchup.match(/(?:vs\.|@)\s*(\w+)/);
    const opp = oppMatch ? oppMatch[1] : "???";
    const isWin = (r.WL || "").startsWith("W");

    return {
      date: r.GAME_DATE ? new Date(r.GAME_DATE).toLocaleDateString("en-US", { month: "numeric", day: "numeric" }) : "",
      opp,
      result: isWin ? "W" : "L",
      min: String(Math.round(r.MIN || 0)),
      pts: r.PTS || 0,
      reb: r.REB || 0,
      ast: r.AST || 0,
      stl: r.STL || 0,
      blk: r.BLK || 0,
      fgm: r.FGM || 0,
      fga: r.FGA || 0,
      tpm: r.FG3M || 0,
      tpa: r.FG3A || 0,
      ftm: r.FTM || 0,
      fta: r.FTA || 0,
      to: r.TOV || 0,
      plusMinus: r.PLUS_MINUS >= 0 ? `+${r.PLUS_MINUS}` : String(r.PLUS_MINUS),
    };
  });
}

// ============================================================================
// SCOREBOARD (today's games)
// ============================================================================
export async function fetchScoreboard() {
  const data = await fetchNba("scoreboardv3", {
    LeagueID: "00",
    GameDate: new Date().toISOString().split("T")[0],
  });

  // scoreboardv3 has a different response shape
  const games = data.scoreboard?.games || [];

  return games.map((g) => ({
    id: g.gameId,
    homeTeam: g.homeTeam?.teamTricode,
    awayTeam: g.awayTeam?.teamTricode,
    homeScore: g.homeTeam?.score || 0,
    awayScore: g.awayTeam?.score || 0,
    status: g.gameStatusText?.includes("Final")
      ? "FINAL"
      : g.period > 0
      ? "LIVE"
      : "UPCOMING",
    quarter: g.period || 0,
    timeRemaining: g.gameClock || "",
    scheduledTime: g.gameStatusText || "",
    broadcast: g.broadcasters?.nationalBroadcasters?.[0]?.broadcasterDisplay || "",
  }));
}

// ============================================================================
// TEAM ROSTER
// ============================================================================
export async function fetchTeamRoster(teamId) {
  const data = await fetchNba("commonteamroster", {
    TeamID: teamId,
    Season: SEASON,
  });

  return parseResultSet(data, 0).map((r) => ({
    playerId: r.PLAYER_ID,
    name: r.PLAYER,
    jersey: r.NUM,
    pos: r.POSITION,
    height: r.HEIGHT,
    weight: r.WEIGHT,
    age: r.AGE,
  }));
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================
export function clearCache() {
  memCache.clear();
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(LS_PREFIX)) toRemove.push(key);
  }
  toRemove.forEach(k => localStorage.removeItem(k));
}
