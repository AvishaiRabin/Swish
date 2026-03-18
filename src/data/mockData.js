// ============================================================================
// MOCK DATA — Mirrors nba_api response structures
// Swap this section for real API calls in the future
// ============================================================================

export const mockData = {
  // Scoreboard: mix of live, final, and upcoming games
  scoreboard: [
    {
      id: "game-1",
      homeTeam: "BOS",
      awayTeam: "NYK",
      homeScore: 112,
      awayScore: 108,
      status: "FINAL",
      quarter: 4,
      timeRemaining: "0:00",
      quarterScores: { home: [28, 30, 25, 29], away: [32, 24, 28, 24] },
      topPerformers: {
        home: { name: "Jayson Tatum", pts: 34, reb: 8, ast: 5 },
        away: { name: "Jalen Brunson", pts: 29, reb: 3, ast: 7 },
      },
      broadcast: "ESPN",
    },
    {
      id: "game-2",
      homeTeam: "LAL",
      awayTeam: "GSW",
      homeScore: 98,
      awayScore: 95,
      status: "LIVE",
      quarter: 3,
      timeRemaining: "4:23",
      quarterScores: { home: [30, 28, 40], away: [25, 32, 38] },
      topPerformers: {
        home: { name: "LeBron James", pts: 28, reb: 9, ast: 7 },
        away: { name: "Stephen Curry", pts: 31, reb: 4, ast: 6 },
      },
      broadcast: "TNT",
    },
    {
      id: "game-3",
      homeTeam: "DEN",
      awayTeam: "DAL",
      homeScore: 88,
      awayScore: 91,
      status: "LIVE",
      quarter: 3,
      timeRemaining: "8:15",
      quarterScores: { home: [22, 30, 36], away: [28, 25, 38] },
      topPerformers: {
        home: { name: "Nikola Jokic", pts: 24, reb: 12, ast: 8 },
        away: { name: "Luka Doncic", pts: 27, reb: 6, ast: 9 },
      },
      broadcast: "ESPN",
    },
    {
      id: "game-4",
      homeTeam: "MIL",
      awayTeam: "CLE",
      homeScore: 105,
      awayScore: 99,
      status: "FINAL",
      quarter: 4,
      timeRemaining: "0:00",
      quarterScores: { home: [24, 28, 30, 23], away: [26, 22, 25, 26] },
      topPerformers: {
        home: { name: "Giannis Antetokounmpo", pts: 38, reb: 14, ast: 5 },
        away: { name: "Donovan Mitchell", pts: 26, reb: 5, ast: 4 },
      },
      broadcast: "NBA TV",
    },
    {
      id: "game-5",
      homeTeam: "PHX",
      awayTeam: "MIN",
      homeScore: 0,
      awayScore: 0,
      status: "UPCOMING",
      scheduledTime: "7:00 PM ET",
      broadcast: "ESPN",
    },
    {
      id: "game-6",
      homeTeam: "OKC",
      awayTeam: "LAC",
      homeScore: 0,
      awayScore: 0,
      status: "UPCOMING",
      scheduledTime: "8:00 PM ET",
      broadcast: "TNT",
    },
    {
      id: "game-7",
      homeTeam: "MIA",
      awayTeam: "PHI",
      homeScore: 118,
      awayScore: 110,
      status: "FINAL",
      quarter: 4,
      timeRemaining: "0:00",
      quarterScores: { home: [30, 32, 28, 28], away: [26, 28, 30, 26] },
      topPerformers: {
        home: { name: "Jimmy Butler", pts: 30, reb: 7, ast: 6 },
        away: { name: "Tyrese Maxey", pts: 28, reb: 3, ast: 5 },
      },
      broadcast: "NBA TV",
    },
    {
      id: "game-8",
      homeTeam: "SAC",
      awayTeam: "HOU",
      homeScore: 0,
      awayScore: 0,
      status: "UPCOMING",
      scheduledTime: "10:00 PM ET",
      broadcast: "League Pass",
    },
    {
      id: "game-9",
      homeTeam: "IND",
      awayTeam: "ORL",
      homeScore: 72,
      awayScore: 68,
      status: "LIVE",
      quarter: 2,
      timeRemaining: "1:45",
      quarterScores: { home: [34, 38], away: [30, 38] },
      topPerformers: {
        home: { name: "Tyrese Haliburton", pts: 18, reb: 3, ast: 10 },
        away: { name: "Paolo Banchero", pts: 22, reb: 6, ast: 4 },
      },
      broadcast: "League Pass",
    },
    {
      id: "game-10",
      homeTeam: "CHI",
      awayTeam: "ATL",
      homeScore: 0,
      awayScore: 0,
      status: "UPCOMING",
      scheduledTime: "8:30 PM ET",
      broadcast: "League Pass",
    },
  ],

  // Standings data — all 30 teams with extended stats
  standings: {
    East: [
      { team: "BOS", wins: 42, losses: 12, pct: ".778", gb: "-", home: "24-4", away: "18-8", streak: "W5", last10: "8-2", ppg: 120.2, oppPpg: 110.4, diff: "+9.8" },
      { team: "CLE", wins: 39, losses: 16, pct: ".709", gb: "3.5", home: "22-6", away: "17-10", streak: "W3", last10: "7-3", ppg: 114.8, oppPpg: 108.2, diff: "+6.6" },
      { team: "NYK", wins: 36, losses: 19, pct: ".655", gb: "6.5", home: "21-7", away: "15-12", streak: "L1", last10: "6-4", ppg: 113.6, oppPpg: 109.8, diff: "+3.8" },
      { team: "MIL", wins: 34, losses: 20, pct: ".630", gb: "8.0", home: "20-7", away: "14-13", streak: "W2", last10: "7-3", ppg: 118.4, oppPpg: 114.2, diff: "+4.2" },
      { team: "ORL", wins: 33, losses: 22, pct: ".600", gb: "9.5", home: "20-8", away: "13-14", streak: "L2", last10: "5-5", ppg: 108.6, oppPpg: 105.0, diff: "+3.6" },
      { team: "IND", wins: 32, losses: 23, pct: ".582", gb: "10.5", home: "19-8", away: "13-15", streak: "W1", last10: "6-4", ppg: 122.8, oppPpg: 120.4, diff: "+2.4" },
      { team: "MIA", wins: 30, losses: 24, pct: ".556", gb: "12.0", home: "18-9", away: "12-15", streak: "W4", last10: "8-2", ppg: 110.2, oppPpg: 108.6, diff: "+1.6" },
      { team: "PHI", wins: 29, losses: 25, pct: ".537", gb: "13.0", home: "18-9", away: "11-16", streak: "L3", last10: "4-6", ppg: 112.4, oppPpg: 111.8, diff: "+0.6" },
      { team: "CHI", wins: 27, losses: 28, pct: ".491", gb: "15.5", home: "17-11", away: "10-17", streak: "L1", last10: "5-5", ppg: 109.0, oppPpg: 111.2, diff: "-2.2" },
      { team: "ATL", wins: 26, losses: 29, pct: ".473", gb: "16.5", home: "16-12", away: "10-17", streak: "W1", last10: "4-6", ppg: 116.4, oppPpg: 118.8, diff: "-2.4" },
      { team: "BKN", wins: 23, losses: 31, pct: ".426", gb: "19.0", home: "14-14", away: "9-17", streak: "L2", last10: "4-6", ppg: 107.8, oppPpg: 112.0, diff: "-4.2" },
      { team: "TOR", wins: 22, losses: 33, pct: ".400", gb: "20.5", home: "14-14", away: "8-19", streak: "L4", last10: "3-7", ppg: 108.2, oppPpg: 113.4, diff: "-5.2" },
      { team: "DET", wins: 18, losses: 36, pct: ".333", gb: "24.0", home: "12-15", away: "6-21", streak: "W1", last10: "3-7", ppg: 106.4, oppPpg: 114.0, diff: "-7.6" },
      { team: "CHA", wins: 15, losses: 39, pct: ".278", gb: "27.0", home: "10-17", away: "5-22", streak: "L5", last10: "2-8", ppg: 104.6, oppPpg: 114.8, diff: "-10.2" },
      { team: "WAS", wins: 12, losses: 42, pct: ".222", gb: "30.0", home: "8-19", away: "4-23", streak: "L3", last10: "2-8", ppg: 103.2, oppPpg: 115.6, diff: "-12.4" },
    ],
    West: [
      { team: "OKC", wins: 43, losses: 11, pct: ".796", gb: "-", home: "24-3", away: "19-8", streak: "W8", last10: "9-1", ppg: 121.6, oppPpg: 108.8, diff: "+12.8" },
      { team: "DEN", wins: 38, losses: 17, pct: ".691", gb: "5.5", home: "22-6", away: "16-11", streak: "L1", last10: "6-4", ppg: 116.2, oppPpg: 110.6, diff: "+5.6" },
      { team: "MIN", wins: 37, losses: 18, pct: ".673", gb: "6.5", home: "21-7", away: "16-11", streak: "W2", last10: "7-3", ppg: 112.4, oppPpg: 106.8, diff: "+5.6" },
      { team: "LAC", wins: 35, losses: 19, pct: ".648", gb: "8.0", home: "20-7", away: "15-12", streak: "W1", last10: "6-4", ppg: 114.0, oppPpg: 110.2, diff: "+3.8" },
      { team: "DAL", wins: 34, losses: 21, pct: ".618", gb: "9.5", home: "19-8", away: "15-13", streak: "W3", last10: "7-3", ppg: 118.6, oppPpg: 114.4, diff: "+4.2" },
      { team: "PHX", wins: 33, losses: 21, pct: ".611", gb: "10.0", home: "19-8", away: "14-13", streak: "L1", last10: "5-5", ppg: 115.8, oppPpg: 113.2, diff: "+2.6" },
      { team: "SAC", wins: 31, losses: 23, pct: ".574", gb: "12.0", home: "18-9", away: "13-14", streak: "W2", last10: "6-4", ppg: 117.4, oppPpg: 115.6, diff: "+1.8" },
      { team: "LAL", wins: 30, losses: 24, pct: ".556", gb: "13.0", home: "18-9", away: "12-15", streak: "L2", last10: "5-5", ppg: 115.0, oppPpg: 114.0, diff: "+1.0" },
      { team: "NOP", wins: 28, losses: 27, pct: ".509", gb: "15.5", home: "17-10", away: "11-17", streak: "W1", last10: "5-5", ppg: 110.8, oppPpg: 111.6, diff: "-0.8" },
      { team: "GSW", wins: 27, losses: 28, pct: ".491", gb: "16.5", home: "17-11", away: "10-17", streak: "L1", last10: "4-6", ppg: 113.2, oppPpg: 114.8, diff: "-1.6" },
      { team: "HOU", wins: 25, losses: 29, pct: ".463", gb: "18.0", home: "15-12", away: "10-17", streak: "W2", last10: "5-5", ppg: 108.4, oppPpg: 110.6, diff: "-2.2" },
      { team: "MEM", wins: 24, losses: 30, pct: ".444", gb: "19.0", home: "15-12", away: "9-18", streak: "L3", last10: "4-6", ppg: 107.6, oppPpg: 111.2, diff: "-3.6" },
      { team: "SAS", wins: 20, losses: 34, pct: ".370", gb: "23.0", home: "13-14", away: "7-20", streak: "L1", last10: "3-7", ppg: 108.8, oppPpg: 115.4, diff: "-6.6" },
      { team: "UTA", wins: 18, losses: 36, pct: ".333", gb: "25.0", home: "12-15", away: "6-21", streak: "L2", last10: "3-7", ppg: 105.2, oppPpg: 113.0, diff: "-7.8" },
      { team: "POR", wins: 14, losses: 40, pct: ".259", gb: "29.0", home: "10-17", away: "4-23", streak: "L4", last10: "2-8", ppg: 104.0, oppPpg: 114.6, diff: "-10.6" },
    ],
  },

  // League leaders
  leagueLeaders: {
    Points: [
      { name: "Shai Gilgeous-Alexander", team: "OKC", value: "32.1" },
      { name: "Luka Doncic", team: "LAL", value: "28.6" },
      { name: "Giannis Antetokounmpo", team: "MIL", value: "27.9" },
      { name: "Victor Wembanyama", team: "SAS", value: "27.2" },
      { name: "Jayson Tatum", team: "BOS", value: "26.1" },
    ],
    Rebounds: [
      { name: "Victor Wembanyama", team: "SAS", value: "12.6" },
      { name: "Nikola Jokic", team: "DEN", value: "11.9" },
      { name: "Giannis Antetokounmpo", team: "MIL", value: "11.4" },
      { name: "Domantas Sabonis", team: "SAC", value: "10.8" },
      { name: "Anthony Davis", team: "LAL", value: "10.5" },
    ],
    Assists: [
      { name: "Nikola Jokic", team: "DEN", value: "9.8" },
      { name: "Tyrese Haliburton", team: "IND", value: "9.2" },
      { name: "Luka Doncic", team: "LAL", value: "8.4" },
      { name: "LeBron James", team: "LAL", value: "8.1" },
      { name: "Trae Young", team: "ATL", value: "7.9" },
    ],
    Steals: [
      { name: "Shai Gilgeous-Alexander", team: "OKC", value: "2.2" },
      { name: "De'Aaron Fox", team: "SAS", value: "1.9" },
      { name: "Anthony Edwards", team: "MIN", value: "1.8" },
      { name: "Cade Cunningham", team: "DET", value: "1.6" },
      { name: "Jrue Holiday", team: "BOS", value: "1.5" },
    ],
    Blocks: [
      { name: "Victor Wembanyama", team: "SAS", value: "4.3" },
      { name: "Chet Holmgren", team: "OKC", value: "2.5" },
      { name: "Anthony Davis", team: "LAL", value: "2.3" },
      { name: "Evan Mobley", team: "CLE", value: "2.0" },
      { name: "Brook Lopez", team: "MIL", value: "1.8" },
    ],
    "3PM": [
      { name: "Stephen Curry", team: "GSW", value: "4.5" },
      { name: "Damian Lillard", team: "MIL", value: "3.8" },
      { name: "Jayson Tatum", team: "BOS", value: "3.4" },
      { name: "Klay Thompson", team: "DAL", value: "3.2" },
      { name: "Buddy Hield", team: "PHI", value: "3.1" },
    ],
  },

  // Detailed game data keyed by game id — only game-2 (LAL vs GSW) is fully fleshed out
  gameDetails: {
    "game-2": {
      teamStats: {
        LAL: { fgPct: 47.8, threePct: 36.4, ftPct: 82.1, rebounds: 38, assists: 24, turnovers: 11, steals: 7, blocks: 5, pointsInPaint: 48, fastBreakPts: 14, benchPts: 32 },
        GSW: { fgPct: 45.2, threePct: 41.2, ftPct: 78.6, rebounds: 34, assists: 28, turnovers: 14, steals: 5, blocks: 3, pointsInPaint: 36, fastBreakPts: 18, benchPts: 28 },
      },
      boxScore: {
        LAL: [
          { name: "LeBron James", pos: "SF", min: "36:22", pts: 28, reb: 9, ast: 7, stl: 2, blk: 1, fgm: 11, fga: 21, tpm: 3, tpa: 7, ftm: 3, fta: 4, to: 3, pf: 2, plusMinus: "+8" },
          { name: "Anthony Davis", pos: "PF", min: "34:48", pts: 22, reb: 11, ast: 3, stl: 1, blk: 3, fgm: 9, fga: 18, tpm: 0, tpa: 1, ftm: 4, fta: 5, to: 2, pf: 3, plusMinus: "+6" },
          { name: "Austin Reaves", pos: "SG", min: "32:15", pts: 18, reb: 4, ast: 6, stl: 1, blk: 0, fgm: 7, fga: 14, tpm: 3, tpa: 6, ftm: 1, fta: 1, to: 1, pf: 2, plusMinus: "+5" },
          { name: "D'Angelo Russell", pos: "PG", min: "28:30", pts: 14, reb: 2, ast: 5, stl: 1, blk: 0, fgm: 5, fga: 12, tpm: 2, tpa: 5, ftm: 2, fta: 2, to: 2, pf: 1, plusMinus: "+3" },
          { name: "Jarred Vanderbilt", pos: "C", min: "24:10", pts: 4, reb: 7, ast: 1, stl: 2, blk: 1, fgm: 2, fga: 4, tpm: 0, tpa: 0, ftm: 0, fta: 0, to: 1, pf: 4, plusMinus: "+1" },
          { name: "Rui Hachimura", pos: "PF", min: "22:05", pts: 12, reb: 3, ast: 1, stl: 0, blk: 0, fgm: 5, fga: 9, tpm: 1, tpa: 3, ftm: 1, fta: 2, to: 1, pf: 2, plusMinus: "-2" },
          { name: "Taurean Prince", pos: "SF", min: "16:40", pts: 0, reb: 2, ast: 1, stl: 0, blk: 0, fgm: 0, fga: 3, tpm: 0, tpa: 2, ftm: 0, fta: 0, to: 0, pf: 1, plusMinus: "-4" },
          { name: "Gabe Vincent", pos: "PG", min: "12:10", pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fgm: 0, fga: 2, tpm: 0, tpa: 1, ftm: 0, fta: 0, to: 1, pf: 0, plusMinus: "-3" },
        ],
        GSW: [
          { name: "Stephen Curry", pos: "PG", min: "35:50", pts: 31, reb: 4, ast: 6, stl: 1, blk: 0, fgm: 10, fga: 22, tpm: 7, tpa: 14, ftm: 4, fta: 4, to: 3, pf: 2, plusMinus: "-3" },
          { name: "Klay Thompson", pos: "SG", min: "33:20", pts: 18, reb: 3, ast: 2, stl: 0, blk: 0, fgm: 7, fga: 16, tpm: 4, tpa: 9, ftm: 0, fta: 0, to: 1, pf: 3, plusMinus: "-5" },
          { name: "Andrew Wiggins", pos: "SF", min: "30:45", pts: 14, reb: 5, ast: 2, stl: 1, blk: 1, fgm: 6, fga: 13, tpm: 1, tpa: 4, ftm: 1, fta: 2, to: 2, pf: 2, plusMinus: "-2" },
          { name: "Draymond Green", pos: "PF", min: "28:15", pts: 8, reb: 7, ast: 8, stl: 2, blk: 1, fgm: 3, fga: 7, tpm: 1, tpa: 2, ftm: 1, fta: 2, to: 4, pf: 4, plusMinus: "-4" },
          { name: "Kevon Looney", pos: "C", min: "22:30", pts: 4, reb: 8, ast: 2, stl: 0, blk: 1, fgm: 2, fga: 4, tpm: 0, tpa: 0, ftm: 0, fta: 0, to: 1, pf: 3, plusMinus: "-1" },
          { name: "Jonathan Kuminga", pos: "PF", min: "18:20", pts: 10, reb: 3, ast: 1, stl: 0, blk: 0, fgm: 4, fga: 8, tpm: 1, tpa: 2, ftm: 1, fta: 2, to: 1, pf: 1, plusMinus: "+2" },
          { name: "Brandin Podziemski", pos: "SG", min: "14:50", pts: 6, reb: 2, ast: 4, stl: 1, blk: 0, fgm: 2, fga: 5, tpm: 0, tpa: 1, ftm: 2, fta: 2, to: 1, pf: 0, plusMinus: "+1" },
          { name: "Gary Payton II", pos: "SG", min: "10:10", pts: 4, reb: 2, ast: 3, stl: 0, blk: 0, fgm: 2, fga: 3, tpm: 0, tpa: 0, ftm: 0, fta: 0, to: 1, pf: 1, plusMinus: "-2" },
        ],
      },
    },
  },
};

// Helper to generate game log entries (most recent first)
export function generateGameLog(basePts, baseReb, baseAst, games = 20) {
  const opponents = ["BOS", "NYK", "MIL", "LAL", "GSW", "DEN", "OKC", "PHX", "DAL", "CLE", "MIA", "PHI", "IND", "ORL", "MIN", "LAC", "SAC", "HOU", "MEM", "SAS"];
  const results = ["W", "L"];
  const log = [];
  for (let i = 0; i < games; i++) {
    // Count backwards from today so most recent game is index 0
    const d = new Date();
    d.setDate(d.getDate() - i * 2);
    const pts = Math.max(0, basePts + Math.floor((Math.random() - 0.5) * 18));
    const reb = Math.max(0, baseReb + Math.floor((Math.random() - 0.5) * 8));
    const ast = Math.max(0, baseAst + Math.floor((Math.random() - 0.5) * 6));
    const fga = Math.floor(pts / 2.1 + Math.random() * 4);
    const fgm = Math.min(fga, Math.floor(fga * (0.38 + Math.random() * 0.2)));
    const tpa = Math.floor(fga * (0.25 + Math.random() * 0.2));
    const tpm = Math.min(tpa, Math.floor(tpa * (0.3 + Math.random() * 0.2)));
    const fta = Math.floor(Math.random() * 10);
    const ftm = Math.min(fta, Math.floor(fta * (0.7 + Math.random() * 0.25)));
    log.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      opp: opponents[i % opponents.length],
      result: results[Math.floor(Math.random() * 2)],
      min: `${28 + Math.floor(Math.random() * 10)}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`,
      pts, reb, ast,
      stl: Math.floor(Math.random() * 3),
      blk: Math.floor(Math.random() * 3),
      fgm, fga, tpm, tpa, ftm, fta,
      to: Math.floor(Math.random() * 5),
      plusMinus: `${Math.random() > 0.5 ? "+" : "-"}${Math.floor(Math.random() * 20)}`,
    });
  }
  return log;
}
