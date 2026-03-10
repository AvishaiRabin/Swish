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
  teamgamelog:               4 * 60 * 60 * 1000,  // 4 hours
  scoreboardv3:              5 * 60 * 1000,        // 5 minutes
  commonteamroster:          7 * 24 * 60 * 60 * 1000, // 7 days
  boxscoretraditionalv2:    60 * 1000,             // 60 seconds (live games)
  boxscoretraditionalv3:    60 * 1000,             // 60 seconds (live games)
};

// ---------------------------------------------------------------------------
// NBA team ID lookup — required for team-specific endpoints
// ---------------------------------------------------------------------------
const TEAM_IDS = {
  ATL: 1610612737, BOS: 1610612738, BKN: 1610612751, CHA: 1610612766, CHI: 1610612741,
  CLE: 1610612739, DAL: 1610612742, DEN: 1610612743, DET: 1610612765, GSW: 1610612744,
  HOU: 1610612745, IND: 1610612754, LAC: 1610612746, LAL: 1610612747, MEM: 1610612763,
  MIA: 1610612748, MIL: 1610612749, MIN: 1610612750, NOP: 1610612740, NYK: 1610612752,
  OKC: 1610612760, ORL: 1610612753, PHI: 1610612755, PHX: 1610612756, POR: 1610612757,
  SAC: 1610612758, SAS: 1610612759, TOR: 1610612761, UTA: 1610612762, WAS: 1610612764,
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
// memCache stores { data, cachedAt } so TTL is respected within the session
const memCache = new Map();

async function fetchNba(endpoint, params = {}) {
  const cacheKey = buildCacheKey(endpoint, params);
  const ttl = CACHE_TTL[endpoint] || DEFAULT_TTL;

  // 1. In-memory cache — check TTL so live/scoreboard data actually refreshes
  if (memCache.has(cacheKey)) {
    const { data, cachedAt } = memCache.get(cacheKey);
    if (Date.now() - cachedAt <= ttl) return data;
    memCache.delete(cacheKey);
  }

  // 2. localStorage (survives page reload)
  const localCached = readLocalCache(cacheKey);
  if (localCached) {
    memCache.set(cacheKey, { data: localCached, cachedAt: Date.now() });
    return localCached;
  }

  // 3. Fetch from proxy server
  const query = new URLSearchParams(params).toString();
  const url = `${API_BASE}/${endpoint}?${query}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NBA API ${res.status}: ${res.statusText}`);
  const data = await res.json();

  // 4. Store in both caches
  memCache.set(cacheKey, { data, cachedAt: Date.now() });
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

// ============================================================================
// TEAM GAME LOG — last N completed games for a team
// ============================================================================
export async function fetchTeamGameLog(teamAbbr, count = 10) {
  const teamId = TEAM_IDS[teamAbbr];
  if (!teamId) return null;

  const data = await fetchNba("teamgamelog", {
    TeamID: teamId,
    Season: SEASON,
    SeasonType: "Regular Season",
  });

  const rows = parseResultSet(data, 0);

  return rows.slice(0, count).map((r) => {
    const matchup = r.MATCHUP || "";
    const oppMatch = matchup.match(/(?:vs\.|@)\s*(\w+)/);
    const opp = oppMatch ? normalizeAbbr(oppMatch[1]) : "???";
    const pts = r.PTS ?? 0;
    const oppPts = pts - (r.PLUS_MINUS ?? 0);
    return {
      date: r.GAME_DATE
        ? new Date(r.GAME_DATE).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })
        : "",
      opp,
      home: matchup.includes("vs."),
      result: (r.WL || "").startsWith("W") ? "W" : "L",
      score: `${pts}-${oppPts}`,
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
export async function fetchScoreboard(date = null) {
  // Use local calendar date — toISOString() returns UTC which rolls over to
  // "tomorrow" for US timezones during evening hours.
  const now = new Date();
  const localDate = date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

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
// homeTeamAbbr / awayTeamAbbr are passed from the scoreboard so we can
// correctly label which resultSet rows belong to home vs away.
export async function fetchBoxScore(gameId, homeTeamAbbr, awayTeamAbbr) {
  // v3 endpoint — v2 returns empty rowSets for completed games
  let data = await fetchNba("boxscoretraditionalv3", { GameID: gameId });
  let box = data.boxScoreTraditional;

  // v3 returns empty players for live games — fall back to CDN live feed
  if (box && (!box.homeTeam?.players?.length && !box.awayTeam?.players?.length)) {
    try {
      const liveRes = await fetch(`${API_BASE}-live/boxscore/${gameId}`);
      if (liveRes.ok) {
        const liveData = await liveRes.json();
        if (liveData.boxScoreTraditional?.homeTeam?.players?.length) {
          box = liveData.boxScoreTraditional;
        }
      }
    } catch { /* fall through to return null below */ }
  }

  if (!box) return null;

  function parseTeam(teamObj) {
    const tricode = normalizeAbbr(teamObj.teamTricode);
    // Filter out DNP players (comment has the reason, e.g. "DNP - Coach's Decision")
    // First 5 players with no comment are starters
    let starterCount = 0;
    const players = (teamObj.players || [])
      .filter((p) => p.statistics && !p.comment && p.status !== "INACTIVE")
      .map((p) => {
        const s = p.statistics;
        const pm = s.plusMinusPoints ?? 0;
        // CDN live feed has explicit starter field; v3 relies on order
        const isStarter = p.starter != null ? p.starter === "1" : starterCount < 5;
        starterCount++;
        return {
          name: `${p.firstName} ${p.familyName}`,
          pos: p.position || "",
          min: s.minutes || "0:00",    // v3 already returns "MM:SS"
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
          plusMinus: pm >= 0 ? `+${pm}` : String(pm),
          starter: isStarter,
        };
      });

    const teamStats = teamObj.statistics || {};
    const benchPts = players.filter((p) => !p.starter).reduce((s, p) => s + p.pts, 0);

    return {
      tricode,
      players,
      stats: {
        fgPct:  +((teamStats.fieldGoalsPercentage ?? 0) * 100).toFixed(1),
        threePct: +((teamStats.threePointersPercentage ?? 0) * 100).toFixed(1),
        ftPct:  +((teamStats.freeThrowsPercentage ?? 0) * 100).toFixed(1),
        rebounds:  teamStats.reboundsTotal ?? 0,
        assists:   teamStats.assists ?? 0,
        turnovers: teamStats.turnovers ?? 0,
        steals:    teamStats.steals ?? 0,
        blocks:    teamStats.blocks ?? 0,
        pointsInPaint: teamStats.pointsInThePaint ?? 0,
        fastBreakPts:  teamStats.pointsFastBreak ?? 0,
        benchPts,
      },
    };
  }

  const home = parseTeam(box.homeTeam);
  const away = parseTeam(box.awayTeam);

  if (!home.players.length && !away.players.length) return null;

  return {
    homeTricode: homeTeamAbbr ? normalizeAbbr(homeTeamAbbr) : home.tricode,
    awayTricode: awayTeamAbbr ? normalizeAbbr(awayTeamAbbr) : away.tricode,
    teamStats: {
      [home.tricode]: home.stats,
      [away.tricode]: away.stats,
    },
    boxScore: {
      [home.tricode]: home.players,
      [away.tricode]: away.players,
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

// ============================================================================
// SCORE TICKER — yesterday finals + upcoming (today + 2 days)
// ============================================================================
export async function fetchTickerData() {
  const toLocalStr = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const dayLabel = (d) =>
    d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();

  const today = new Date();
  const offsets = [-1, 0, 1, 2];
  const dateMeta = offsets.map((n) => {
    const d = new Date(today);
    d.setDate(today.getDate() + n);
    return {
      str: toLocalStr(d),
      label: n === -1 ? "YESTERDAY" : n === 0 ? "TODAY" : dayLabel(d),
      isPast: n === -1,
    };
  });

  // Sequential fetches — no Promise.all per NBA API rate limit rules
  const results = [];
  for (const meta of dateMeta) {
    const games = await fetchScoreboard(meta.str).catch(() => []);
    results.push({ ...meta, games });
  }

  // Yesterday's FINAL scores
  const finals = results[0].games
    .filter((g) => g.status === "FINAL")
    .map((g) => ({ ...g, dateLabel: "YESTERDAY" }));

  // Today + 2 days: UPCOMING and LIVE games
  const upcoming = [];
  for (const r of results.slice(1)) {
    for (const g of r.games) {
      if (g.status !== "FINAL") upcoming.push({ ...g, dateLabel: r.label });
    }
  }

  // Fallback: if no upcoming games, also include today's finals
  if (upcoming.length === 0) {
    const todayFinals = results[1].games
      .filter((g) => g.status === "FINAL")
      .map((g) => ({ ...g, dateLabel: "TODAY" }));
    return [...finals, ...todayFinals];
  }

  return [...finals, ...upcoming];
}

// ============================================================================
// PREDICTIONS — served from SQLite via /api/predictions/*
// ============================================================================
export async function fetchPredictionsToday() {
  const res = await fetch("/api/predictions/today");
  if (!res.ok) throw new Error(`Predictions today ${res.status}`);
  return res.json();
}

export async function fetchPredictionHistory(days = 7) {
  const res = await fetch(`/api/predictions/history?days=${days}`);
  if (!res.ok) throw new Error(`Prediction history ${res.status}`);
  return res.json();
}

export async function fetchPredictionAccuracy() {
  const res = await fetch("/api/predictions/accuracy");
  if (!res.ok) throw new Error(`Prediction accuracy ${res.status}`);
  return res.json();
}
