// NBA API service — fetches data via our local proxy to avoid CORS issues
// All endpoints go through /api/nba/ which proxies to stats.nba.com
// Two-tier cache: in-memory Map (instant) → localStorage (survives reload) → proxy

const API_BASE = "/api/nba";

// Current season
const SEASON = "2025-26";

// ---------------------------------------------------------------------------
// Abbreviation normalization — NBA API sometimes returns non-standard tricodes
// ---------------------------------------------------------------------------
const ABBR_REMAP = {
  NY:   "NYK",  // New York Knicks
  BRK:  "BKN",  // Brooklyn Nets
  BRO:  "BKN",  // Brooklyn Nets (city-substring fallback)
  NEW:  "NYK",  // New York Knicks (city-substring fallback)
  GS:   "GSW",  // Golden State Warriors
  GOL:  "GSW",  // Golden State (city-substring fallback)
  SA:   "SAS",  // San Antonio Spurs
  SAN:  "SAS",  // San Antonio (city-substring fallback)
  NO:   "NOP",  // New Orleans Pelicans
  PHO:  "PHX",  // Phoenix Suns
  OKL:  "OKC",  // Oklahoma City Thunder (city-substring fallback)
  LA:   "LAC",  // LA Clippers (short city name)
  LOS:  "LAL",  // Los Angeles Lakers (city-substring fallback)
  UTA:  "UTA",  // already correct, no-op
};

function normalizeAbbr(abbr) {
  if (!abbr) return abbr;
  return ABBR_REMAP[abbr] || abbr;
}

// ---------------------------------------------------------------------------
// TTL configuration per endpoint (milliseconds) — matches server.js
// ---------------------------------------------------------------------------
const CACHE_TTL = {
  leaguestandingsv3:        12 * 60 * 60 * 1000,  // 12 hours
  leagueleaders:            12 * 60 * 60 * 1000,  // 12 hours
  leaguedashplayerstats:    12 * 60 * 60 * 1000,  // 12 hours
  playergamelog:            12 * 60 * 60 * 1000,  // 12 hours
  scoreboardv3:              5 * 60 * 1000,        // 5 minutes
  commonteamroster:          7 * 24 * 60 * 60 * 1000, // 7 days
  boxscoretraditionalv3:    60 * 1000,             // 60 seconds (live games)
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
// STANDINGS  — served from SQLite via /api/db/standings
// ============================================================================
export async function fetchStandings() {
  const res = await fetch("/api/db/standings");
  if (!res.ok) throw new Error(`DB standings ${res.status}`);
  return res.json();
}

// ============================================================================
// LEAGUE LEADERS  — served from SQLite via /api/db/leaders
// ============================================================================
export async function fetchLeagueLeaders() {
  const res = await fetch("/api/db/leaders");
  if (!res.ok) throw new Error(`DB leaders ${res.status}`);
  return res.json(); // { points: [...], rebounds: [...], ... }
}

// ============================================================================
// PLAYER STATS  — served from SQLite via /api/db/players
// ============================================================================
export async function fetchPlayerStats() {
  const res = await fetch("/api/db/players");
  if (!res.ok) throw new Error(`DB players ${res.status}`);
  return res.json();
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

  return rows.map((r) => {
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

// Converts NBA ISO duration clock "PT04M17.00S" → "4:17"
function parseGameClock(clock) {
  if (!clock) return "";
  const match = clock.match(/PT(\d+)M([\d.]+)S/);
  if (!match) return clock;
  const mins = parseInt(match[1], 10);
  const secs = Math.floor(parseFloat(match[2]));
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ============================================================================
// SCOREBOARD (today's games)
// ============================================================================
export async function fetchScoreboard() {
  // Use local calendar date — toISOString() returns UTC which rolls over to
  // "tomorrow" for US timezones during evening hours.
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const data = await fetchNba("scoreboardv3", {
    LeagueID: "00",
    GameDate: localDate,
  });

  // scoreboardv3 has a different response shape
  const games = data.scoreboard?.games || [];

  return games.map((g) => ({
    id: g.gameId,
    homeTeam: g.homeTeam?.teamTricode,
    awayTeam: g.awayTeam?.teamTricode,
    homeScore: g.homeTeam?.score ?? 0,
    awayScore: g.awayTeam?.score ?? 0,
    // gameStatus: 1=pre, 2=live, 3=final (more reliable than period check)
    status: g.gameStatus === 3 || g.gameStatusText?.toLowerCase().includes("final")
      ? "FINAL"
      : g.gameStatus === 2
      ? "LIVE"
      : "UPCOMING",
    quarter: g.period || 0,
    timeRemaining: parseGameClock(g.gameClock || ""),
    scheduledTime: g.gameStatusText || "",
    broadcast: g.broadcasters?.nationalBroadcasters?.[0]?.broadcasterDisplay || "",
    // Per-period scores for the cumulative score line chart
    homePeriods: (g.homeTeam?.periods || []).map((p) => p.score ?? 0),
    awayPeriods: (g.awayTeam?.periods || []).map((p) => p.score ?? 0),
  }));
}

// ============================================================================
// BOX SCORE (live / final games)
// ============================================================================
export async function fetchBoxScore(gameId) {
  const data = await fetchNba("boxscoretraditionalv3", {
    GameID: gameId,
    LeagueID: "00",
    Season: SEASON,
    SeasonType: "Regular Season",
    RangeType: 0,
    StartPeriod: 0,
    EndPeriod: 0,
    StartRange: 0,
    EndRange: 0,
  });

  const game = data.boxScoreTraditional;
  if (!game) return null;

  // Parse "PT36M22.00S" → "36:22"
  function parseMins(m) {
    const match = (m || "").match(/PT(\d+)M([\d.]+)S/);
    if (!match) return "0:00";
    return `${match[1]}:${String(Math.floor(parseFloat(match[2]))).padStart(2, "0")}`;
  }

  function transformPlayers(teamData) {
    return (teamData.players || [])
      .filter((p) => p.played !== "0" && p.played !== 0 && p.played !== false)
      .map((p) => {
        const s = p.statistics || {};
        const pm = s.plusMinusPoints ?? 0;
        return {
          name: p.name || `${p.firstName} ${p.familyName}`,
          pos: p.position || "",
          min: parseMins(s.minutes),
          pts: s.points ?? 0,
          reb: s.reboundsTotal ?? 0,
          ast: s.assists ?? 0,
          stl: s.steals ?? 0,
          blk: s.blocks ?? 0,
          fgm: s.fieldGoalsMade ?? 0,
          fga: s.fieldGoalsAttempted ?? 0,
          tpm: s.threePointersMade ?? 0,
          tpa: s.threePointersAttempted ?? 0,
          ftm: s.freeThrowsMade ?? 0,
          fta: s.freeThrowsAttempted ?? 0,
          to: s.turnovers ?? 0,
          pf: s.foulsPersonal ?? 0,
          plusMinus: pm >= 0 ? `+${Math.round(pm)}` : String(Math.round(pm)),
          starter: p.starter === "1" || p.starter === 1,
        };
      })
      .sort((a, b) => (b.starter ? 1 : 0) - (a.starter ? 1 : 0)); // starters first
  }

  function teamStats(teamData) {
    const s = teamData.statistics || {};
    const made = s.fieldGoalsMade ?? 0;
    const att = s.fieldGoalsAttempted ?? 1;
    const tMade = s.threePointersMade ?? 0;
    const tAtt = s.threePointersAttempted ?? 1;
    const ftMade = s.freeThrowsMade ?? 0;
    const ftAtt = s.freeThrowsAttempted ?? 1;
    const benchPts = (teamData.players || [])
      .filter((p) => p.starter !== "1" && p.starter !== 1)
      .reduce((sum, p) => sum + (p.statistics?.points ?? 0), 0);
    return {
      fgPct: +((made / att) * 100).toFixed(1),
      threePct: +((tMade / tAtt) * 100).toFixed(1),
      ftPct: +((ftMade / ftAtt) * 100).toFixed(1),
      rebounds: s.reboundsTotal ?? 0,
      assists: s.assists ?? 0,
      turnovers: s.turnovers ?? 0,
      steals: s.steals ?? 0,
      blocks: s.blocks ?? 0,
      pointsInPaint: s.pointsInThePaint ?? 0,
      fastBreakPts: s.pointsFastBreak ?? 0,
      benchPts,
    };
  }

  // Team ID → tricode fallback for when teamTricode is null (live game stub data)
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

  const home = game.homeTeam;
  const away = game.awayTeam;

  // Return null when the API returns stub data (live games on some backends
  // return players: [] for both teams). This keeps hasDetail false so the UI
  // doesn't show an empty "Box Score" heading.
  if (!home.players?.length && !away.players?.length) return null;

  // Use tricode from team object; fall back to top-level team IDs if null (live game)
  const homeTricode = home.teamTricode || TEAM_ID_ABBR[game.homeTeamId] || "HOME";
  const awayTricode = away.teamTricode || TEAM_ID_ABBR[game.awayTeamId] || "AWAY";

  const homePlayers = transformPlayers(home);
  const awayPlayers = transformPlayers(away);

  // If both transformed player lists are empty, treat as no data
  if (!homePlayers.length && !awayPlayers.length) return null;

  return {
    homeTricode,
    awayTricode,
    teamStats: {
      [homeTricode]: teamStats(home),
      [awayTricode]: teamStats(away),
    },
    boxScore: {
      [homeTricode]: homePlayers,
      [awayTricode]: awayPlayers,
    },
  };
}

// ============================================================================
// CACHE UTILITIES
// ============================================================================

// Clears cache for a specific endpoint (e.g. "scoreboardv3") so the next
// fetchScoreboard() call goes to the network instead of returning stale data.
export function clearEndpointCache(endpoint) {
  for (const key of memCache.keys()) {
    if (key.startsWith(endpoint + "__")) memCache.delete(key);
  }
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LS_PREFIX + endpoint + "__")) toRemove.push(key);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
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
// ============================================================================
// LINEUPS  — served from SQLite via /api/db/lineups
// ============================================================================
export async function fetchLineups(team, groupSize) {
  const res = await fetch(`/api/db/lineups?team=${team}&groupSize=${groupSize}`);
  if (!res.ok) throw new Error(`DB lineups ${res.status}`);
  return res.json();
}

export function clearCache() {
  memCache.clear();
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(LS_PREFIX)) toRemove.push(key);
  }
  toRemove.forEach(k => localStorage.removeItem(k));
}
