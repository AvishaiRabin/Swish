import React, { useState, useMemo, useRef, useEffect, createContext, useContext } from "react";
import {
  fetchStandings,
  fetchLeagueLeaders,
  fetchPlayerStats,
  fetchPlayerGameLog,
  fetchScoreboard,
  fetchBoxScore,
  fetchLineups,
  clearEndpointCache,
} from "./src/nbaApi.js";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  CartesianGrid,
} from "recharts";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Star,
  TrendingUp,
  Sparkles,
  X,
  Home,
  BarChart3,
  Users,
  Shield,
  Layers,
  Calendar,
  Trophy,
  Flame,
  ArrowRight,
  Info,
  Activity,
  Target,
} from "lucide-react";

// ============================================================================
// MOCK DATA — Mirrors nba_api response structures
// Swap this section for real API calls in the future
// ============================================================================

const TEAMS = {
  BOS: { name: "Celtics", city: "Boston", abbr: "BOS", conference: "East", division: "Atlantic", color: "#007A33", secondaryColor: "#BA9653", record: "42-12", teamId: 1610612738 },
  CLE: { name: "Cavaliers", city: "Cleveland", abbr: "CLE", conference: "East", division: "Central", color: "#6F263D", secondaryColor: "#FFB81C", record: "39-16", teamId: 1610612739 },
  NYK: { name: "Knicks", city: "New York", abbr: "NYK", conference: "East", division: "Atlantic", color: "#006BB6", secondaryColor: "#F58426", record: "36-19", teamId: 1610612752 },
  MIL: { name: "Bucks", city: "Milwaukee", abbr: "MIL", conference: "East", division: "Central", color: "#00471B", secondaryColor: "#EEE1C6", record: "34-20", teamId: 1610612749 },
  ORL: { name: "Magic", city: "Orlando", abbr: "ORL", conference: "East", division: "Southeast", color: "#0077C0", secondaryColor: "#000000", record: "33-22", teamId: 1610612753 },
  IND: { name: "Pacers", city: "Indiana", abbr: "IND", conference: "East", division: "Central", color: "#002D62", secondaryColor: "#FDBB30", record: "32-23", teamId: 1610612754 },
  MIA: { name: "Heat", city: "Miami", abbr: "MIA", conference: "East", division: "Southeast", color: "#98002E", secondaryColor: "#F9A01B", record: "30-24", teamId: 1610612748 },
  PHI: { name: "76ers", city: "Philadelphia", abbr: "PHI", conference: "East", division: "Atlantic", color: "#006BB6", secondaryColor: "#ED174C", record: "29-25", teamId: 1610612755 },
  CHI: { name: "Bulls", city: "Chicago", abbr: "CHI", conference: "East", division: "Central", color: "#CE1141", secondaryColor: "#000000", record: "27-28", teamId: 1610612741 },
  ATL: { name: "Hawks", city: "Atlanta", abbr: "ATL", conference: "East", division: "Southeast", color: "#E03A3E", secondaryColor: "#C1D32F", record: "26-29", teamId: 1610612737 },
  BKN: { name: "Nets", city: "Brooklyn", abbr: "BKN", conference: "East", division: "Atlantic", color: "#000000", secondaryColor: "#FFFFFF", record: "23-31", teamId: 1610612751 },
  TOR: { name: "Raptors", city: "Toronto", abbr: "TOR", conference: "East", division: "Atlantic", color: "#CE1141", secondaryColor: "#000000", record: "22-33", teamId: 1610612761 },
  DET: { name: "Pistons", city: "Detroit", abbr: "DET", conference: "East", division: "Central", color: "#C8102E", secondaryColor: "#1D42BA", record: "18-36", teamId: 1610612765 },
  CHA: { name: "Hornets", city: "Charlotte", abbr: "CHA", conference: "East", division: "Southeast", color: "#1D1160", secondaryColor: "#00788C", record: "15-39", teamId: 1610612766 },
  WAS: { name: "Wizards", city: "Washington", abbr: "WAS", conference: "East", division: "Southeast", color: "#002B5C", secondaryColor: "#E31837", record: "12-42", teamId: 1610612764 },
  OKC: { name: "Thunder", city: "Oklahoma City", abbr: "OKC", conference: "West", division: "Northwest", color: "#007AC1", secondaryColor: "#EF6020", record: "43-11", teamId: 1610612760 },
  DEN: { name: "Nuggets", city: "Denver", abbr: "DEN", conference: "West", division: "Northwest", color: "#0E2240", secondaryColor: "#FEC524", record: "38-17", teamId: 1610612743 },
  MIN: { name: "Timberwolves", city: "Minnesota", abbr: "MIN", conference: "West", division: "Northwest", color: "#0C2340", secondaryColor: "#236192", record: "37-18", teamId: 1610612750 },
  LAC: { name: "Clippers", city: "Los Angeles", abbr: "LAC", conference: "West", division: "Pacific", color: "#C8102E", secondaryColor: "#1D428A", record: "35-19", teamId: 1610612746 },
  DAL: { name: "Mavericks", city: "Dallas", abbr: "DAL", conference: "West", division: "Southwest", color: "#00538C", secondaryColor: "#002B5E", record: "34-21", teamId: 1610612742 },
  PHX: { name: "Suns", city: "Phoenix", abbr: "PHX", conference: "West", division: "Pacific", color: "#1D1160", secondaryColor: "#E56020", record: "33-21", teamId: 1610612756 },
  SAC: { name: "Kings", city: "Sacramento", abbr: "SAC", conference: "West", division: "Pacific", color: "#5A2D81", secondaryColor: "#63727A", record: "31-23", teamId: 1610612758 },
  LAL: { name: "Lakers", city: "Los Angeles", abbr: "LAL", conference: "West", division: "Pacific", color: "#552583", secondaryColor: "#FDB927", record: "30-24", teamId: 1610612747 },
  NOP: { name: "Pelicans", city: "New Orleans", abbr: "NOP", conference: "West", division: "Southwest", color: "#0C2340", secondaryColor: "#C8102E", record: "28-27", teamId: 1610612740 },
  GSW: { name: "Warriors", city: "Golden State", abbr: "GSW", conference: "West", division: "Pacific", color: "#1D428A", secondaryColor: "#FFC72C", record: "27-28", teamId: 1610612744 },
  HOU: { name: "Rockets", city: "Houston", abbr: "HOU", conference: "West", division: "Southwest", color: "#CE1141", secondaryColor: "#000000", record: "25-29", teamId: 1610612745 },
  MEM: { name: "Grizzlies", city: "Memphis", abbr: "MEM", conference: "West", division: "Southwest", color: "#5D76A9", secondaryColor: "#12173F", record: "24-30", teamId: 1610612763 },
  SAS: { name: "Spurs", city: "San Antonio", abbr: "SAS", conference: "West", division: "Southwest", color: "#C4CED4", secondaryColor: "#000000", record: "20-34", teamId: 1610612759 },
  UTA: { name: "Jazz", city: "Utah", abbr: "UTA", conference: "West", division: "Northwest", color: "#002B5C", secondaryColor: "#00471B", record: "18-36", teamId: 1610612762 },
  POR: { name: "Trail Blazers", city: "Portland", abbr: "POR", conference: "West", division: "Northwest", color: "#E03A3E", secondaryColor: "#000000", record: "14-40", teamId: 1610612757 },
};

const mockData = {
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

  // News ticker items
  headlines: [
    "Wembanyama records 30-point triple-double in Spurs victory",
    "Lakers exploring trade options ahead of deadline",
    "Celtics extend winning streak to 5 games",
    "Thunder's SGA named Western Conference Player of the Week",
    "Jokic posts 15th triple-double of the season",
    "Injury update: Embiid expected to return next week",
    "All-Star voting results: Giannis leads Eastern Conference",
  ],

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

// Helper to generate game log entries
function generateGameLog(basePts, baseReb, baseAst, games = 20) {
  const opponents = ["BOS", "NYK", "MIL", "LAL", "GSW", "DEN", "OKC", "PHX", "DAL", "CLE", "MIA", "PHI", "IND", "ORL", "MIN", "LAC", "SAC", "HOU", "MEM", "SAS"];
  const results = ["W", "L"];
  const log = [];
  for (let i = 0; i < games; i++) {
    const d = new Date(2025, 0, 15 + i * 2);
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

const PLAYERS = [
  {
    id: "luka-doncic",
    nbaId: 1629029,
    name: "Luka Doncic",
    team: "LAL",
    pos: "PG/SG",
    jersey: 77,
    height: "6'7\"",
    weight: "230 lbs",
    age: 26,
    college: "Overseas (Real Madrid)",
    draft: "2018 R1 Pick 3",
    seasonAvg: { pts: 33.8, reb: 9.2, ast: 9.6, stl: 1.4, blk: 0.5, fgPct: 48.7, tpPct: 36.2, ftPct: 78.4, per: 31.2, ts: 60.1, usg: 36.8, ortg: 118, drtg: 112, bpm: 9.4, vorp: 6.2, ws: 8.8 },
    gameLog: generateGameLog(34, 9, 10),
  },
  {
    id: "giannis-antetokounmpo",
    nbaId: 203507,
    name: "Giannis Antetokounmpo",
    team: "MIL",
    pos: "PF",
    jersey: 34,
    height: "6'11\"",
    weight: "243 lbs",
    age: 30,
    college: "Overseas (Greece)",
    draft: "2013 R1 Pick 15",
    seasonAvg: { pts: 31.2, reb: 11.8, ast: 5.8, stl: 1.2, blk: 1.4, fgPct: 54.2, tpPct: 27.4, ftPct: 65.8, per: 30.8, ts: 61.4, usg: 34.2, ortg: 120, drtg: 110, bpm: 8.8, vorp: 5.8, ws: 9.2 },
    gameLog: generateGameLog(31, 12, 6),
  },
  {
    id: "shai-gilgeous-alexander",
    nbaId: 1628983,
    name: "Shai Gilgeous-Alexander",
    team: "OKC",
    pos: "SG",
    jersey: 2,
    height: "6'6\"",
    weight: "195 lbs",
    age: 26,
    college: "Kentucky",
    draft: "2018 R1 Pick 11",
    seasonAvg: { pts: 30.8, reb: 5.4, ast: 6.2, stl: 2.0, blk: 0.8, fgPct: 51.0, tpPct: 34.8, ftPct: 87.4, per: 28.6, ts: 62.8, usg: 32.4, ortg: 122, drtg: 108, bpm: 8.2, vorp: 5.4, ws: 10.1 },
    gameLog: generateGameLog(31, 5, 6),
  },
  {
    id: "jayson-tatum",
    nbaId: 1628369,
    name: "Jayson Tatum",
    team: "BOS",
    pos: "SF/PF",
    jersey: 0,
    height: "6'8\"",
    weight: "210 lbs",
    age: 26,
    college: "Duke",
    draft: "2017 R1 Pick 3",
    seasonAvg: { pts: 27.4, reb: 8.2, ast: 4.8, stl: 1.1, blk: 0.6, fgPct: 47.2, tpPct: 37.8, ftPct: 83.6, per: 25.4, ts: 59.8, usg: 30.2, ortg: 116, drtg: 106, bpm: 6.8, vorp: 4.6, ws: 8.4 },
    gameLog: generateGameLog(27, 8, 5),
  },
  {
    id: "nikola-jokic",
    nbaId: 203999,
    name: "Nikola Jokic",
    team: "DEN",
    pos: "C",
    jersey: 15,
    height: "6'11\"",
    weight: "284 lbs",
    age: 29,
    college: "Overseas (Serbia)",
    draft: "2014 R2 Pick 41",
    seasonAvg: { pts: 26.4, reb: 12.4, ast: 9.2, stl: 1.4, blk: 0.7, fgPct: 56.8, tpPct: 33.6, ftPct: 81.2, per: 32.8, ts: 65.2, usg: 28.6, ortg: 128, drtg: 112, bpm: 12.4, vorp: 7.8, ws: 12.2 },
    gameLog: generateGameLog(26, 12, 9),
  },
  {
    id: "stephen-curry",
    nbaId: 201939,
    name: "Stephen Curry",
    team: "GSW",
    pos: "PG",
    jersey: 30,
    height: "6'2\"",
    weight: "185 lbs",
    age: 36,
    college: "Davidson",
    draft: "2009 R1 Pick 7",
    seasonAvg: { pts: 26.8, reb: 4.4, ast: 5.2, stl: 0.8, blk: 0.2, fgPct: 45.4, tpPct: 40.8, ftPct: 91.2, per: 23.6, ts: 62.4, usg: 30.8, ortg: 114, drtg: 114, bpm: 5.2, vorp: 3.4, ws: 6.8 },
    gameLog: generateGameLog(27, 4, 5),
  },
  {
    id: "lebron-james",
    nbaId: 2544,
    name: "LeBron James",
    team: "LAL",
    pos: "SF/PG",
    jersey: 23,
    height: "6'9\"",
    weight: "250 lbs",
    age: 40,
    college: "St. Vincent-St. Mary HS",
    draft: "2003 R1 Pick 1",
    seasonAvg: { pts: 25.2, reb: 7.8, ast: 8.4, stl: 1.2, blk: 0.6, fgPct: 52.4, tpPct: 38.2, ftPct: 75.0, per: 26.2, ts: 62.0, usg: 29.4, ortg: 118, drtg: 112, bpm: 7.4, vorp: 4.8, ws: 7.6 },
    gameLog: generateGameLog(25, 8, 8),
  },
  {
    id: "victor-wembanyama",
    nbaId: 1641705,
    name: "Victor Wembanyama",
    team: "SAS",
    pos: "C/PF",
    jersey: 1,
    height: "7'4\"",
    weight: "210 lbs",
    age: 21,
    college: "Overseas (France)",
    draft: "2023 R1 Pick 1",
    seasonAvg: { pts: 22.8, reb: 10.2, ast: 3.8, stl: 1.2, blk: 3.8, fgPct: 46.4, tpPct: 33.2, ftPct: 80.6, per: 24.8, ts: 57.6, usg: 28.2, ortg: 110, drtg: 104, bpm: 5.6, vorp: 3.6, ws: 5.2 },
    gameLog: generateGameLog(23, 10, 4),
  },
];

// Detailed team data for 3 teams
const TEAM_DETAILS = {
  BOS: {
    confRank: 1,
    roster: [
      { name: "Jayson Tatum", pos: "SF", jersey: 0, gp: 55, mpg: 36.2, ppg: 27.4, rpg: 8.2, apg: 4.8, spg: 1.1, bpg: 0.6, fgPct: 47.2, tpPct: 37.8, ftPct: 83.6 },
      { name: "Jaylen Brown", pos: "SG", jersey: 7, gp: 52, mpg: 34.0, ppg: 23.2, rpg: 5.6, apg: 3.4, spg: 1.2, bpg: 0.4, fgPct: 49.4, tpPct: 35.6, ftPct: 71.8 },
      { name: "Derrick White", pos: "PG", jersey: 9, gp: 54, mpg: 32.5, ppg: 15.8, rpg: 4.2, apg: 5.2, spg: 1.0, bpg: 1.2, fgPct: 46.8, tpPct: 39.4, ftPct: 88.2 },
      { name: "Kristaps Porzingis", pos: "C", jersey: 8, gp: 38, mpg: 28.4, ppg: 20.4, rpg: 7.4, apg: 1.8, spg: 0.6, bpg: 1.8, fgPct: 52.6, tpPct: 36.8, ftPct: 85.4 },
      { name: "Jrue Holiday", pos: "PG", jersey: 4, gp: 54, mpg: 33.2, ppg: 13.6, rpg: 5.8, apg: 4.6, spg: 0.8, bpg: 0.8, fgPct: 48.2, tpPct: 42.4, ftPct: 82.0 },
      { name: "Al Horford", pos: "C", jersey: 42, gp: 50, mpg: 22.8, ppg: 8.4, rpg: 5.4, apg: 2.6, spg: 0.6, bpg: 0.8, fgPct: 48.8, tpPct: 38.2, ftPct: 80.6 },
      { name: "Payton Pritchard", pos: "PG", jersey: 11, gp: 54, mpg: 18.6, ppg: 10.2, rpg: 2.2, apg: 2.8, spg: 0.4, bpg: 0.1, fgPct: 44.2, tpPct: 40.8, ftPct: 88.6 },
      { name: "Sam Hauser", pos: "SF", jersey: 30, gp: 48, mpg: 16.4, ppg: 7.6, rpg: 2.8, apg: 0.8, spg: 0.4, bpg: 0.2, fgPct: 46.0, tpPct: 42.6, ftPct: 82.0 },
    ],
    teamStats: { ortg: 120.8, drtg: 108.4, pace: 100.2, netRtg: 12.4, efgPct: 57.8, tovPct: 12.4, orbPct: 24.6, ftRate: 26.2 },
    homeRecord: "24-4", awayRecord: "18-8",
    homeSplits: { ppg: 122.4, oppPpg: 108.8, fgPct: 49.2, tpPct: 39.6 },
    awaySplits: { ppg: 117.6, oppPpg: 112.2, fgPct: 46.4, tpPct: 36.8 },
    ratingHistory: [
      { game: "G1-5", ortg: 118, drtg: 110 }, { game: "G6-10", ortg: 122, drtg: 106 },
      { game: "G11-15", ortg: 119, drtg: 109 }, { game: "G16-20", ortg: 124, drtg: 107 },
      { game: "G21-25", ortg: 121, drtg: 108 }, { game: "G26-30", ortg: 118, drtg: 112 },
      { game: "G31-35", ortg: 123, drtg: 106 }, { game: "G36-40", ortg: 120, drtg: 109 },
      { game: "G41-45", ortg: 122, drtg: 108 }, { game: "G46-50", ortg: 119, drtg: 110 },
      { game: "G51-54", ortg: 121, drtg: 107 },
    ],
    last10: [
      { date: "2/18", opp: "MIL", result: "W", score: "118-106" }, { date: "2/16", opp: "CLE", result: "W", score: "112-108" },
      { date: "2/14", opp: "NYK", result: "L", score: "104-110" }, { date: "2/12", opp: "MIA", result: "W", score: "122-98" },
      { date: "2/10", opp: "PHI", result: "W", score: "130-118" }, { date: "2/8", opp: "ORL", result: "W", score: "115-102" },
      { date: "2/6", opp: "BKN", result: "W", score: "128-104" }, { date: "2/4", opp: "TOR", result: "W", score: "116-100" },
      { date: "2/2", opp: "IND", result: "W", score: "124-118" }, { date: "1/31", opp: "CHI", result: "L", score: "108-112" },
    ],
    next5: [
      { date: "2/21", opp: "OKC", time: "7:30 PM", home: true }, { date: "2/23", opp: "DEN", time: "3:00 PM", home: true },
      { date: "2/25", opp: "DAL", time: "8:00 PM", home: false }, { date: "2/27", opp: "PHX", time: "9:00 PM", home: false },
      { date: "3/1", opp: "LAC", time: "10:00 PM", home: false },
    ],
  },
  OKC: {
    confRank: 1,
    roster: [
      { name: "Shai Gilgeous-Alexander", pos: "SG", jersey: 2, gp: 54, mpg: 34.2, ppg: 30.8, rpg: 5.4, apg: 6.2, spg: 2.0, bpg: 0.8, fgPct: 51.0, tpPct: 34.8, ftPct: 87.4 },
      { name: "Jalen Williams", pos: "SF", jersey: 8, gp: 54, mpg: 32.8, ppg: 20.4, rpg: 5.6, apg: 5.0, spg: 1.2, bpg: 0.6, fgPct: 48.6, tpPct: 36.2, ftPct: 80.8 },
      { name: "Chet Holmgren", pos: "C", jersey: 7, gp: 48, mpg: 30.2, ppg: 16.8, rpg: 8.2, apg: 2.4, spg: 0.8, bpg: 2.4, fgPct: 54.2, tpPct: 34.6, ftPct: 79.8 },
      { name: "Lu Dort", pos: "SG", jersey: 5, gp: 52, mpg: 28.6, ppg: 10.6, rpg: 3.8, apg: 1.8, spg: 1.4, bpg: 0.4, fgPct: 44.8, tpPct: 36.4, ftPct: 78.2 },
      { name: "Josh Giddey", pos: "PG", jersey: 3, gp: 50, mpg: 26.4, ppg: 12.2, rpg: 6.2, apg: 4.8, spg: 0.8, bpg: 0.2, fgPct: 47.2, tpPct: 32.8, ftPct: 72.4 },
      { name: "Isaiah Joe", pos: "SG", jersey: 11, gp: 54, mpg: 20.4, ppg: 9.8, rpg: 2.4, apg: 1.2, spg: 0.6, bpg: 0.2, fgPct: 44.6, tpPct: 40.2, ftPct: 86.4 },
      { name: "Kenrich Williams", pos: "PF", jersey: 34, gp: 48, mpg: 18.2, ppg: 5.4, rpg: 3.6, apg: 2.0, spg: 0.8, bpg: 0.4, fgPct: 50.2, tpPct: 38.4, ftPct: 74.0 },
      { name: "Cason Wallace", pos: "PG", jersey: 22, gp: 52, mpg: 16.8, ppg: 6.2, rpg: 2.2, apg: 2.4, spg: 1.0, bpg: 0.4, fgPct: 42.8, tpPct: 34.2, ftPct: 80.6 },
    ],
    teamStats: { ortg: 122.4, drtg: 106.2, pace: 99.4, netRtg: 16.2, efgPct: 56.4, tovPct: 11.8, orbPct: 26.2, ftRate: 24.8 },
    homeRecord: "24-3", awayRecord: "19-8",
    homeSplits: { ppg: 124.2, oppPpg: 106.4, fgPct: 50.8, tpPct: 37.6 },
    awaySplits: { ppg: 118.8, oppPpg: 111.4, fgPct: 47.2, tpPct: 34.8 },
    ratingHistory: [
      { game: "G1-5", ortg: 120, drtg: 108 }, { game: "G6-10", ortg: 124, drtg: 104 },
      { game: "G11-15", ortg: 122, drtg: 106 }, { game: "G16-20", ortg: 126, drtg: 105 },
      { game: "G21-25", ortg: 121, drtg: 107 }, { game: "G26-30", ortg: 123, drtg: 106 },
      { game: "G31-35", ortg: 118, drtg: 110 }, { game: "G36-40", ortg: 125, drtg: 104 },
      { game: "G41-45", ortg: 122, drtg: 106 }, { game: "G46-50", ortg: 120, drtg: 108 },
      { game: "G51-54", ortg: 124, drtg: 105 },
    ],
    last10: [
      { date: "2/19", opp: "GSW", result: "W", score: "128-112" }, { date: "2/17", opp: "LAL", result: "W", score: "118-104" },
      { date: "2/15", opp: "DEN", result: "W", score: "114-108" }, { date: "2/13", opp: "MIN", result: "W", score: "122-116" },
      { date: "2/11", opp: "DAL", result: "W", score: "110-102" }, { date: "2/9", opp: "PHX", result: "W", score: "132-118" },
      { date: "2/7", opp: "SAC", result: "W", score: "120-108" }, { date: "2/5", opp: "MEM", result: "W", score: "126-110" },
      { date: "2/3", opp: "HOU", result: "L", score: "108-112" }, { date: "2/1", opp: "LAC", result: "W", score: "116-104" },
    ],
    next5: [
      { date: "2/21", opp: "BOS", time: "7:30 PM", home: false }, { date: "2/23", opp: "NYK", time: "1:00 PM", home: true },
      { date: "2/25", opp: "MIL", time: "8:00 PM", home: true }, { date: "2/28", opp: "CLE", time: "7:00 PM", home: false },
      { date: "3/2", opp: "MIA", time: "7:30 PM", home: true },
    ],
  },
  LAL: {
    confRank: 8,
    roster: [
      { name: "LeBron James", pos: "SF", jersey: 23, gp: 54, mpg: 35.4, ppg: 25.2, rpg: 7.8, apg: 8.4, spg: 1.2, bpg: 0.6, fgPct: 52.4, tpPct: 38.2, ftPct: 75.0 },
      { name: "Anthony Davis", pos: "PF", jersey: 3, gp: 50, mpg: 34.8, ppg: 24.8, rpg: 12.2, apg: 3.4, spg: 1.2, bpg: 2.2, fgPct: 55.6, tpPct: 28.4, ftPct: 78.6 },
      { name: "Austin Reaves", pos: "SG", jersey: 15, gp: 54, mpg: 33.2, ppg: 16.4, rpg: 4.4, apg: 5.8, spg: 0.8, bpg: 0.2, fgPct: 48.2, tpPct: 38.6, ftPct: 86.4 },
      { name: "D'Angelo Russell", pos: "PG", jersey: 1, gp: 52, mpg: 28.6, ppg: 14.2, rpg: 2.8, apg: 5.6, spg: 0.8, bpg: 0.2, fgPct: 44.4, tpPct: 36.4, ftPct: 78.2 },
      { name: "Rui Hachimura", pos: "PF", jersey: 28, gp: 48, mpg: 24.8, ppg: 12.8, rpg: 4.6, apg: 1.2, spg: 0.4, bpg: 0.4, fgPct: 50.2, tpPct: 34.8, ftPct: 80.4 },
      { name: "Jarred Vanderbilt", pos: "PF", jersey: 2, gp: 32, mpg: 22.4, ppg: 5.4, rpg: 6.8, apg: 1.6, spg: 1.4, bpg: 0.6, fgPct: 52.8, tpPct: 24.2, ftPct: 62.4 },
      { name: "Taurean Prince", pos: "SF", jersey: 12, gp: 52, mpg: 18.2, ppg: 7.2, rpg: 2.8, apg: 1.0, spg: 0.4, bpg: 0.2, fgPct: 44.6, tpPct: 38.8, ftPct: 78.0 },
      { name: "Gabe Vincent", pos: "PG", jersey: 7, gp: 30, mpg: 14.6, ppg: 4.8, rpg: 1.6, apg: 2.2, spg: 0.4, bpg: 0.1, fgPct: 38.4, tpPct: 32.6, ftPct: 84.2 },
    ],
    teamStats: { ortg: 114.6, drtg: 113.2, pace: 101.8, netRtg: 1.4, efgPct: 53.4, tovPct: 13.2, orbPct: 23.8, ftRate: 28.4 },
    homeRecord: "18-9", awayRecord: "12-15",
    homeSplits: { ppg: 118.2, oppPpg: 112.0, fgPct: 49.4, tpPct: 37.8 },
    awaySplits: { ppg: 111.4, oppPpg: 116.2, fgPct: 45.2, tpPct: 34.6 },
    ratingHistory: [
      { game: "G1-5", ortg: 112, drtg: 114 }, { game: "G6-10", ortg: 116, drtg: 112 },
      { game: "G11-15", ortg: 110, drtg: 116 }, { game: "G16-20", ortg: 118, drtg: 110 },
      { game: "G21-25", ortg: 114, drtg: 113 }, { game: "G26-30", ortg: 116, drtg: 114 },
      { game: "G31-35", ortg: 112, drtg: 115 }, { game: "G36-40", ortg: 118, drtg: 112 },
      { game: "G41-45", ortg: 115, drtg: 113 }, { game: "G46-50", ortg: 113, drtg: 114 },
      { game: "G51-54", ortg: 116, drtg: 112 },
    ],
    last10: [
      { date: "2/18", opp: "GSW", result: "W", score: "116-108" }, { date: "2/16", opp: "SAC", result: "L", score: "104-112" },
      { date: "2/14", opp: "DEN", result: "L", score: "108-118" }, { date: "2/12", opp: "POR", result: "W", score: "128-106" },
      { date: "2/10", opp: "HOU", result: "W", score: "114-108" }, { date: "2/8", opp: "PHX", result: "L", score: "110-116" },
      { date: "2/6", opp: "UTA", result: "W", score: "122-104" }, { date: "2/4", opp: "SAS", result: "W", score: "118-108" },
      { date: "2/2", opp: "MIN", result: "L", score: "106-114" }, { date: "1/31", opp: "OKC", result: "L", score: "102-118" },
    ],
    next5: [
      { date: "2/21", opp: "MIL", time: "7:30 PM", home: true }, { date: "2/23", opp: "CLE", time: "3:30 PM", home: true },
      { date: "2/26", opp: "MIA", time: "7:30 PM", home: false }, { date: "2/28", opp: "ORL", time: "7:00 PM", home: false },
      { date: "3/1", opp: "ATL", time: "7:30 PM", home: false },
    ],
  },
};


// ============================================================================
// STYLE DEFINITIONS
// ============================================================================

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg-primary: #e8ddd0;
    --bg-secondary: #ddd1c2;
    --bg-tertiary: #d3c5b4;
    --bg-hover: #c9b9a7;
    --accent-blue: #e8590c;
    --accent-blue-dim: #c44a09;
    --accent-amber: #d97706;
    --accent-amber-dim: #b45309;
    --accent-green: #16a34a;
    --accent-red: #dc2626;
    --text-primary: #1c1309;
    --text-secondary: #5c4a35;
    --text-muted: #9e8878;
    --border-color: #d4c9bc;
    --border-hover: #b8ab9c;
  }

  body {
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: 'Inter', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .font-display { font-family: 'Outfit', sans-serif; }
  .font-mono { font-family: 'JetBrains Mono', monospace; }

  @keyframes pulse-live {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1); }
  }

  @keyframes glow {
    0%, 100% { box-shadow: 0 0 5px rgba(232, 89, 12, 0.3); }
    50% { box-shadow: 0 0 20px rgba(232, 89, 12, 0.6); }
  }

  @keyframes ticker-scroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .live-pulse { animation: pulse-live 1.5s ease-in-out infinite; }
  .ai-glow { animation: glow 2s ease-in-out infinite; }
  .fade-in { animation: fadeIn 0.3s ease-out; }
  .page-transition { animation: pageSlideIn 0.25s ease-out; }
  @keyframes pageSlideIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .ticker-track {
    animation: ticker-scroll 80s linear infinite;
    display: flex;
    gap: 24px;
    white-space: nowrap;
  }
  .ticker-track:hover { animation-play-state: paused; }

  .score-scroll {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .score-scroll::-webkit-scrollbar { display: none; }

  .card-hover {
    transition: all 0.2s ease;
    border: 1px solid var(--border-color);
  }
  .card-hover:hover {
    border-color: var(--border-hover);
    background: var(--bg-hover);
    transform: translateY(-1px);
  }

  .nav-link {
    position: relative;
    transition: color 0.2s ease;
    padding: 8px 0;
  }
  .nav-link::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 0;
    height: 2px;
    background: var(--accent-blue);
    transition: width 0.2s ease;
  }
  .nav-link:hover::after,
  .nav-link.active::after {
    width: 100%;
  }

  .stat-number {
    font-family: 'JetBrains Mono', monospace;
    font-variant-numeric: tabular-nums;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  /* ===== RESPONSIVE ===== */
  @media (max-width: 1024px) {
    .nav-links { gap: 16px !important; }
    .nav-label { display: none; }
    .nav-search-input { width: 160px !important; }
  }

  @media (max-width: 768px) {
    .nav-container {
      padding: 0 12px !important;
      height: 56px !important;
    }
    .nav-links { gap: 8px !important; }
    .nav-logo-text { display: none; }
    .nav-search-input { width: 120px !important; }
    .nav-link { padding: 4px !important; }
  }

  @media (max-width: 640px) {
    .nav-links { display: none !important; }
    .nav-search-input { width: 140px !important; }
  }

  /* Mobile bottom nav for small screens */
  @media (max-width: 640px) {
    .mobile-bottom-nav {
      display: flex !important;
    }
  }
`;

// ============================================================================
// COMPONENTS
// ============================================================================

// --- Navigation Bar ---
function NavBar({ currentPage, setCurrentPage, onAskAI, onPlayerSelect, onTeamSelect }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  const navItems = [
    { key: "home", label: "Home", icon: Home },
    { key: "standings", label: "Standings", icon: Trophy },
    { key: "players", label: "Players", icon: Users },
    { key: "teams", label: "Teams", icon: Shield },
    { key: "compare", label: "Compare", icon: Layers },
    { key: "lineups", label: "Lineups", icon: Activity },
    { key: "games", label: "Games", icon: Calendar },
  ];

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { players: [], teams: [] };
    const q = searchQuery.toLowerCase();
    const players = PLAYERS.filter(
      (p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q) || p.pos.toLowerCase().includes(q)
    ).slice(0, 5);
    const teams = Object.entries(TEAMS)
      .filter(([abbr, t]) => t.name.toLowerCase().includes(q) || t.city.toLowerCase().includes(q) || abbr.toLowerCase().includes(q))
      .map(([abbr, t]) => ({ abbr, ...t }))
      .slice(0, 5);
    return { players, teams };
  }, [searchQuery]);

  const hasResults = searchResults.players.length > 0 || searchResults.teams.length > 0;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <nav
      style={{
        background: "rgba(232, 221, 208, 0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border-color)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        className="nav-container"
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            flexShrink: 0,
          }}
          onClick={() => setCurrentPage("home")}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #e8590c, #c44a09)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
            }}
          >
            <BarChart3 size={18} color="white" />
          </div>
          <span
            className="font-display nav-logo-text"
            style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}
          >
            Courtside
          </span>
        </div>

        {/* Nav Links */}
        <div className="nav-links" style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`nav-link ${currentPage === item.key ? "active" : ""}`}
              onClick={() => setCurrentPage(item.key)}
              style={{
                background: "none",
                border: "none",
                color:
                  currentPage === item.key
                    ? "var(--accent-blue)"
                    : "var(--text-secondary)",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "'Inter', sans-serif",
                display: "flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
            >
              <item.icon size={15} />
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Search & AI */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div ref={searchRef} style={{ position: "relative" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
                zIndex: 1,
              }}
            />
            <input
              type="text"
              placeholder="Search players, teams..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              className="nav-search-input"
              style={{
                background: "var(--bg-secondary)",
                border: `1px solid ${searchOpen && hasResults ? "var(--accent-blue)" : "var(--border-color)"}`,
                borderRadius: searchOpen && hasResults ? "8px 8px 0 0" : 8,
                padding: "8px 14px 8px 36px",
                color: "var(--text-primary)",
                fontSize: 13,
                width: 220,
                outline: "none",
                fontFamily: "'Inter', sans-serif",
                transition: "border-color 0.2s",
              }}
            />
            {/* Search Dropdown */}
            {searchOpen && searchQuery.trim() && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--accent-blue)",
                  borderTop: "none",
                  borderRadius: "0 0 8px 8px",
                  maxHeight: 340,
                  overflowY: "auto",
                  zIndex: 100,
                  boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
                }}
              >
                {/* Players */}
                {searchResults.players.length > 0 && (
                  <>
                    <div style={{ padding: "8px 12px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Players</div>
                    {searchResults.players.map((p) => {
                      const t = TEAMS[p.team];
                      return (
                        <div
                          key={p.id}
                          onClick={() => { onPlayerSelect(p.id); setSearchQuery(""); setSearchOpen(false); }}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", transition: "background 0.15s" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <div style={{ width: 22, height: 22, borderRadius: 5, background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: "white", flexShrink: 0 }}>{p.team}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{t.city} {t.name} · {p.pos}</div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
                {/* Teams */}
                {searchResults.teams.length > 0 && (
                  <>
                    <div style={{ padding: "8px 12px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", borderTop: searchResults.players.length > 0 ? "1px solid var(--border-color)" : "none" }}>Teams</div>
                    {searchResults.teams.map((t) => (
                      <div
                        key={t.abbr}
                        onClick={() => { onTeamSelect(t.abbr); setSearchQuery(""); setSearchOpen(false); }}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", transition: "background 0.15s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <div style={{ width: 22, height: 22, borderRadius: 5, background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: "white", flexShrink: 0 }}>{t.abbr}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{t.city} {t.name}</div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{t.division} · {t.record}</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {!hasResults && (
                  <div style={{ padding: "16px 12px", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>No results for "{searchQuery}"</div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onAskAI}
            className="ai-glow"
            style={{
              background: "linear-gradient(135deg, #e8590c, #d97706)",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "'Inter', sans-serif",
              whiteSpace: "nowrap",
            }}
          >
            <Sparkles size={14} />
            <span className="nav-label">Ask AI</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

// --- AI Modal ---
function AIChatPanel({ onClose }) {
  const liveData = useLiveData();
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hey! I'm your NBA analytics assistant. Ask me anything about players, teams, matchups, stats, or strategy. I have access to all the current season data.\n\nTry asking:\n- \"Who's the best scorer this season?\"\n- \"Compare LeBron and Curry\"\n- \"Which teams have the best defense?\"\n- \"Explain what PER means\"",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Serialize relevant data as context
  const buildContext = () => {
    const standingsSummary = ["East", "West"].map((conf) => {
      const rows = liveData.standings[conf].map(
        (s, i) => `${i + 1}. ${TEAMS[s.team]?.city || s.team} ${TEAMS[s.team]?.name || ""} (${s.wins}-${s.losses}, ${s.pct}) Streak: ${s.streak} PPG: ${s.ppg} OPP: ${s.oppPpg} DIFF: ${s.diff}`
      );
      return `${conf}ern Conference:\n${rows.join("\n")}`;
    }).join("\n\n");

    const playerSummary = PLAYERS.map((p) => {
      const a = p.seasonAvg;
      return `${p.name} (${TEAMS[p.team]?.city || p.team} ${TEAMS[p.team]?.name || ""}, ${p.pos}, #${p.jersey}): ${a.pts} PPG, ${a.reb} RPG, ${a.ast} APG, ${a.stl} SPG, ${a.blk} BPG, FG% ${a.fgPct}, 3P% ${a.tpPct}, FT% ${a.ftPct}, PER ${a.per}, TS% ${a.ts}, USG% ${a.usg}, BPM ${a.bpm}, VORP ${a.vorp}, WS ${a.ws}`;
    }).join("\n");

    const leadersSummary = Object.entries(liveData.leaders).map(([cat, players]) => {
      return `${cat}: ${players.map((p) => `${p.name} (${p.team}) ${p.value}`).join(", ")}`;
    }).join("\n");

    return `CURRENT NBA SEASON DATA:\n\n--- STANDINGS ---\n${standingsSummary}\n\n--- PLAYER STATS ---\n${playerSummary}\n\n--- LEAGUE LEADERS ---\n${leadersSummary}`;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Build conversation history for the API (skip the initial greeting)
    const apiMessages = [...messages.slice(1), userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": window.__COURTSIDE_API_KEY || "",
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: `You are an expert NBA analytics assistant embedded in a basketball stats app called Courtside. You have deep knowledge of basketball strategy, statistics, and history. Be concise, insightful, and conversational. Use the season data provided to give data-driven answers. When comparing players or teams, cite specific stats. Format responses with short paragraphs. Do NOT use markdown headers — keep it conversational.\n\n${buildContext()}`,
          messages: apiMessages,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error ${response.status}`);
      }

      const data = await response.json();
      const assistantText =
        data.content?.[0]?.text || "Sorry, I couldn't generate a response.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: assistantText },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `I wasn't able to connect to the AI service. To enable the AI assistant, set your API key:\n\n\`window.__COURTSIDE_API_KEY = "your-key"\`\n\nin the browser console.\n\nError: ${err.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 998,
        }}
      />
      {/* Panel */}
      <div
        className="fade-in"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          maxWidth: "100vw",
          background: "var(--bg-primary)",
          borderLeft: "1px solid var(--border-color)",
          zIndex: 999,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-color)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "linear-gradient(135deg, #e8590c, #d97706)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={16} color="white" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>AI Assistant</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                NBA Analytics Expert
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: 6,
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--text-muted)",
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 16px 8px",
          }}
        >
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent:
                  msg.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  maxWidth: "85%",
                  padding: "10px 14px",
                  borderRadius:
                    msg.role === "user"
                      ? "14px 14px 4px 14px"
                      : "14px 14px 14px 4px",
                  background:
                    msg.role === "user"
                      ? "linear-gradient(135deg, #3b82f6, #8b5cf6)"
                      : "var(--bg-secondary)",
                  border:
                    msg.role === "user"
                      ? "none"
                      : "1px solid var(--border-color)",
                  color:
                    msg.role === "user" ? "white" : "var(--text-primary)",
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-start",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  padding: "12px 18px",
                  borderRadius: "14px 14px 14px 4px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <div className="typing-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-blue)", animation: "pulse 1.2s ease-in-out infinite" }} />
                <div className="typing-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-blue)", animation: "pulse 1.2s ease-in-out 0.2s infinite" }} />
                <div className="typing-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-blue)", animation: "pulse 1.2s ease-in-out 0.4s infinite" }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          style={{
            padding: "12px 16px 16px",
            borderTop: "1px solid var(--border-color)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: 10,
              padding: "4px 4px 4px 14px",
              alignItems: "flex-end",
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about players, teams, stats..."
              rows={1}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-primary)",
                fontSize: 13,
                fontFamily: "'Inter', sans-serif",
                resize: "none",
                padding: "8px 0",
                maxHeight: 100,
                lineHeight: 1.5,
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{
                background:
                  input.trim() && !loading
                    ? "linear-gradient(135deg, #3b82f6, #8b5cf6)"
                    : "var(--bg-tertiary)",
                border: "none",
                borderRadius: 8,
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: input.trim() && !loading ? "pointer" : "default",
                flexShrink: 0,
                transition: "all 0.2s",
              }}
            >
              <ArrowRight
                size={16}
                color={input.trim() && !loading ? "white" : "#9e8878"}
              />
            </button>
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              textAlign: "center",
              marginTop: 8,
              opacity: 0.6,
            }}
          >
            Powered by Claude · Enter to send · Shift+Enter for new line
          </div>
        </div>
      </div>
    </>
  );
}

// --- Team Logo ---
// Tries NBA CDN SVG first, falls back to colored div with abbreviation
function TeamLogo({ abbr, size = 36, style = {} }) {
  const team = TEAMS[abbr] || {};
  const [failed, setFailed] = useState(false);
  const radius = Math.round(size * 0.22);

  if (failed || !team.teamId) {
    return (
      <div style={{
        width: size, height: size, borderRadius: radius,
        background: team.color || "#333",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: Math.round(size * 0.27), fontWeight: 800, color: "white",
        flexShrink: 0, ...style,
      }}>
        {abbr}
      </div>
    );
  }

  return (
    <img
      src={`https://cdn.nba.com/logos/nba/${team.teamId}/global/L/logo.svg`}
      alt={abbr}
      style={{ width: size, height: size, objectFit: "contain", flexShrink: 0, borderRadius: radius, ...style }}
      onError={() => setFailed(true)}
    />
  );
}

function PlayerHeadshot({ nbaId, name, size = 64, teamColor = "#333", style = {} }) {
  const [failed, setFailed] = useState(false);
  const radius = Math.round(size * 0.22);
  if (failed || !nbaId) {
    return (
      <div style={{ width: size, height: size, borderRadius: radius, background: teamColor + "22", border: `2px solid ${teamColor}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...style }}>
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke={teamColor} strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </div>
    );
  }
  return (
    <img
      src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaId}.png`}
      alt={name}
      style={{ width: size, height: size, objectFit: "cover", objectPosition: "top center", borderRadius: radius, flexShrink: 0, ...style }}
      onError={() => setFailed(true)}
    />
  );
}

// --- Score Card (Ticker) ---
function ScoreCard({ game, onClick }) {
  const homeTeam = TEAMS[game.homeTeam];
  const awayTeam = TEAMS[game.awayTeam];
  const isLive = game.status === "LIVE";
  const isFinal = game.status === "FINAL";

  return (
    <div
      className="card-hover"
      onClick={onClick}
      style={{
        background: "var(--bg-secondary)",
        borderRadius: 10,
        padding: "14px 18px",
        minWidth: 220,
        cursor: "pointer",
        flexShrink: 0,
        position: "relative",
      }}
    >
      {/* Status Badge */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        {isLive ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              fontWeight: 700,
              color: "var(--accent-red)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            <div
              className="live-pulse"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--accent-red)",
              }}
            />
            Q{game.quarter} {game.timeRemaining}
          </div>
        ) : isFinal ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Final
          </span>
        ) : (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--accent-blue)",
              letterSpacing: "0.5px",
            }}
          >
            {game.scheduledTime}
          </span>
        )}
        {game.broadcast && (
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {game.broadcast}
          </span>
        )}
      </div>

      {/* Teams & Scores */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TeamLogo abbr={game.awayTeam} size={24} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>{awayTeam?.city || game.awayTeam}</span>
          </div>
          <span className="stat-number" style={{ fontSize: 18, fontWeight: 700, color: game.status !== "UPCOMING" ? game.awayScore > game.homeScore ? "var(--text-primary)" : "var(--text-secondary)" : "var(--text-muted)" }}>
            {game.status !== "UPCOMING" ? game.awayScore : "-"}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TeamLogo abbr={game.homeTeam} size={24} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>{homeTeam?.city || game.homeTeam}</span>
          </div>
          <span className="stat-number" style={{ fontSize: 18, fontWeight: 700, color: game.status !== "UPCOMING" ? game.homeScore > game.awayScore ? "var(--text-primary)" : "var(--text-secondary)" : "var(--text-muted)" }}>
            {game.status !== "UPCOMING" ? game.homeScore : "-"}
          </span>
        </div>
      </div>
    </div>
  );
}

// --- Scoreboard Ticker ---
function ScoreboardTicker({ games, onGameClick }) {
  const scrollRef = useRef(null);

  const scroll = (dir) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 260, behavior: "smooth" });
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          padding: "0 24px",
          maxWidth: 1400,
          margin: "0 auto 16px",
        }}
      >
        <h2
          className="font-display"
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          Scoreboard
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => scroll(-1)}
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: 6,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--text-secondary)",
              transition: "all 0.2s",
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => scroll(1)}
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: 6,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--text-secondary)",
              transition: "all 0.2s",
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="score-scroll"
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          padding: "0 24px 4px",
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        {games.map((game) => (
          <ScoreCard
            key={game.id}
            game={game}
            onClick={() => onGameClick(game.id)}
          />
        ))}
      </div>
    </div>
  );
}

// --- Detailed Game Card ---
function GameCard({ game, onClick }) {
  const homeTeam = TEAMS[game.homeTeam];
  const awayTeam = TEAMS[game.awayTeam];
  const isLive = game.status === "LIVE";
  const isFinal = game.status === "FINAL";
  const isUpcoming = game.status === "UPCOMING";

  return (
    <div
      className="card-hover"
      onClick={onClick}
      style={{
        background: "var(--bg-secondary)",
        borderRadius: 12,
        padding: 20,
        cursor: "pointer",
      }}
    >
      {/* Status */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        {isLive ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(239, 68, 68, 0.15)",
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              color: "var(--accent-red)",
            }}
          >
            <div
              className="live-pulse"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--accent-red)",
              }}
            />
            Q{game.quarter} {game.timeRemaining}
          </div>
        ) : isFinal ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              background: "var(--bg-tertiary)",
              padding: "4px 10px",
              borderRadius: 6,
            }}
          >
            Final
          </span>
        ) : (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--accent-blue)",
              background: "rgba(59, 130, 246, 0.1)",
              padding: "4px 10px",
              borderRadius: 6,
            }}
          >
            {game.scheduledTime}
          </span>
        )}
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {game.broadcast}
        </span>
      </div>

      {/* Matchup */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Away Team */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <TeamLogo abbr={game.awayTeam} size={36} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{awayTeam?.city} {awayTeam?.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{awayTeam?.record}</div>
            </div>
          </div>
          <span className="stat-number" style={{ fontSize: 24, fontWeight: 700, color: !isUpcoming ? game.awayScore >= game.homeScore ? "var(--text-primary)" : "var(--text-secondary)" : "var(--text-muted)" }}>
            {!isUpcoming ? game.awayScore : "-"}
          </span>
        </div>

        {/* Home Team */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <TeamLogo abbr={game.homeTeam} size={36} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{homeTeam?.city} {homeTeam?.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{homeTeam?.record}</div>
            </div>
          </div>
          <span className="stat-number" style={{ fontSize: 24, fontWeight: 700, color: !isUpcoming ? game.homeScore >= game.awayScore ? "var(--text-primary)" : "var(--text-secondary)" : "var(--text-muted)" }}>
            {!isUpcoming ? game.homeScore : "-"}
          </span>
        </div>
      </div>

      {/* Quarter-by-Quarter (if finished or live) */}
      {game.quarterScores && (
        <div
          style={{
            marginTop: 14,
            borderTop: "1px solid var(--border-color)",
            paddingTop: 12,
          }}
        >
          <table
            style={{
              width: "100%",
              fontSize: 11,
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                <th style={{ textAlign: "left", fontWeight: 500, padding: "2px 0" }}>
                  Team
                </th>
                {game.quarterScores.home.map((_, i) => (
                  <th
                    key={i}
                    className="stat-number"
                    style={{ textAlign: "center", fontWeight: 500, padding: "2px 4px" }}
                  >
                    Q{i + 1}
                  </th>
                ))}
                <th
                  className="stat-number"
                  style={{ textAlign: "center", fontWeight: 700, padding: "2px 4px" }}
                >
                  T
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600, padding: "2px 0" }}>
                  {game.awayTeam}
                </td>
                {game.quarterScores.away.map((s, i) => (
                  <td
                    key={i}
                    className="stat-number"
                    style={{ textAlign: "center", padding: "2px 4px", color: "var(--text-secondary)" }}
                  >
                    {s}
                  </td>
                ))}
                <td
                  className="stat-number"
                  style={{ textAlign: "center", fontWeight: 700, padding: "2px 4px" }}
                >
                  {game.awayScore}
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, padding: "2px 0" }}>
                  {game.homeTeam}
                </td>
                {game.quarterScores.home.map((s, i) => (
                  <td
                    key={i}
                    className="stat-number"
                    style={{ textAlign: "center", padding: "2px 4px", color: "var(--text-secondary)" }}
                  >
                    {s}
                  </td>
                ))}
                <td
                  className="stat-number"
                  style={{ textAlign: "center", fontWeight: 700, padding: "2px 4px" }}
                >
                  {game.homeScore}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Top Performers */}
      {game.topPerformers && (
        <div
          style={{
            marginTop: 12,
            borderTop: "1px solid var(--border-color)",
            paddingTop: 12,
            display: "flex",
            gap: 12,
          }}
        >
          {[
            { side: "away", team: game.awayTeam },
            { side: "home", team: game.homeTeam },
          ].map(({ side, team }) => {
            const p = game.topPerformers[side];
            return (
              <div
                key={side}
                style={{
                  flex: 1,
                  background: "var(--bg-tertiary)",
                  borderRadius: 8,
                  padding: "8px 10px",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted)",
                    marginBottom: 3,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Top — {team}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                  {p.name}
                </div>
                <div
                  className="stat-number"
                  style={{ fontSize: 11, color: "var(--text-secondary)" }}
                >
                  {p.pts} PTS · {p.reb} REB · {p.ast} AST
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Standings Table ---
function StandingsTable({ conference, teams, onViewFull }) {
  return (
    <div style={{ flex: 1 }}>
      <h3
        className="font-display"
        style={{
          fontSize: 15,
          fontWeight: 700,
          marginBottom: 12,
          color: "var(--text-primary)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Trophy size={14} style={{ color: "var(--accent-amber)" }} />
        {conference}ern Conference
      </h3>
      <div
        style={{
          background: "var(--bg-secondary)",
          borderRadius: 10,
          border: "1px solid var(--border-color)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "30px 1fr 40px 40px 52px 40px",
            padding: "8px 14px",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-muted)",
            borderBottom: "1px solid var(--border-color)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          <span>#</span>
          <span>Team</span>
          <span className="stat-number" style={{ textAlign: "center" }}>
            W
          </span>
          <span className="stat-number" style={{ textAlign: "center" }}>
            L
          </span>
          <span className="stat-number" style={{ textAlign: "center" }}>
            PCT
          </span>
          <span className="stat-number" style={{ textAlign: "center" }}>
            GB
          </span>
        </div>
        {/* Rows */}
        {teams.map((row, idx) => {
          const team = TEAMS[row.team] || { name: row.team, city: row.team, color: "#555", division: "" };
          const streak = row.streak || "—";
          const isStreaking =
            streak.startsWith("W") && parseInt(streak.slice(1)) >= 3;
          return (
            <div
              key={row.team}
              style={{
                display: "grid",
                gridTemplateColumns: "30px 1fr 40px 40px 52px 40px",
                padding: "10px 14px",
                fontSize: 13,
                borderBottom:
                  idx < teams.length - 1
                    ? "1px solid var(--border-color)"
                    : "none",
                alignItems: "center",
                transition: "background 0.15s",
                cursor: "default",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--bg-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <span
                className="stat-number"
                style={{ color: "var(--text-muted)", fontSize: 12 }}
              >
                {idx + 1}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    background: team.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 8,
                    fontWeight: 800,
                    color: "white",
                  }}
                >
                  {row.team}
                </div>
                <span style={{ fontWeight: 500, fontSize: 13 }}>
                  {team.name}
                </span>
                {isStreaking && (
                  <Flame
                    size={12}
                    style={{ color: "var(--accent-amber)" }}
                  />
                )}
              </div>
              <span
                className="stat-number"
                style={{
                  textAlign: "center",
                  fontWeight: 600,
                  color: "var(--accent-green)",
                  fontSize: 13,
                }}
              >
                {row.wins}
              </span>
              <span
                className="stat-number"
                style={{
                  textAlign: "center",
                  fontWeight: 600,
                  color: "var(--accent-red)",
                  fontSize: 13,
                }}
              >
                {row.losses}
              </span>
              <span
                className="stat-number"
                style={{
                  textAlign: "center",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                }}
              >
                {row.pct}
              </span>
              <span
                className="stat-number"
                style={{
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                {row.gb}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- League Leaders ---
function LeagueLeaders({ data, onPlayerClick }) {
  const liveData = useLiveData();
  const categories = Object.keys(data || {});
  const [activeCategory, setActiveCategory] = useState(categories[0] || "");

  // Build a name→team map from live player stats (always current-season teams)
  const liveTeamMap = useMemo(() => {
    const map = {};
    (liveData.livePlayers || []).forEach((lp) => { map[lp.name] = lp.team; });
    return map;
  }, [liveData.livePlayers]);

  // Keep activeCategory valid when data changes (e.g. live → mock switch)
  const validCategory = categories.includes(activeCategory) ? activeCategory : categories[0] || "";

  return (
    <div>
      <h2
        className="font-display"
        style={{
          fontSize: 20,
          fontWeight: 700,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <TrendingUp size={18} style={{ color: "var(--accent-blue)" }} />
        League Leaders
      </h2>

      {/* Category Tabs */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 16,
          overflowX: "auto",
        }}
      >
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              background: validCategory === cat ? "var(--accent-blue)" : "var(--bg-secondary)",
              border: validCategory === cat ? "1px solid var(--accent-blue)" : "1px solid var(--border-color)",
              borderRadius: 6,
              padding: "6px 14px",
              color: validCategory === cat ? "white" : "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: "'Inter', sans-serif",
              transition: "all 0.2s",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Leaders List */}
      <div style={{ background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border-color)", overflow: "hidden" }}>
        {!validCategory || !(data[validCategory]?.length > 0) ? (
          <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            Loading leaders…
          </div>
        ) : (
          data[validCategory].map((player, idx) => {
            const teamAbbr = liveTeamMap[player.name] || player.team;
            const team = TEAMS[teamAbbr];
            return (
              <div
                key={player.name}
                onClick={() => onPlayerClick(player.name)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "12px 16px",
                  borderBottom: idx < data[validCategory].length - 1 ? "1px solid var(--border-color)" : "none",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  gap: 12,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span className="stat-number" style={{ width: 24, textAlign: "center", fontSize: 14, fontWeight: 700, color: idx === 0 ? "var(--accent-amber)" : idx === 1 ? "var(--text-secondary)" : idx === 2 ? "#CD7F32" : "var(--text-muted)" }}>
                  {idx + 1}
                </span>
                <TeamLogo abbr={teamAbbr} size={24} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{player.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {team ? `${team.city} ${team.name}` : teamAbbr}
                  </div>
                </div>
                <span className="stat-number" style={{ fontSize: 18, fontWeight: 700, color: "var(--accent-blue)" }}>
                  {player.value}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// --- News Ticker ---
function NewsTicker({ headlines }) {
  return (
    <div
      style={{
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border-color)",
        borderBottom: "1px solid var(--border-color)",
        padding: "10px 0",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div className="ticker-track">
        {[...headlines, ...headlines].map((h, i) => (
          <span
            key={i}
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                color: "var(--accent-amber)",
                fontWeight: 700,
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Trending
            </span>
            {h}
            <span style={{ color: "var(--border-hover)", margin: "0 8px" }}>
              |
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// --- Footer ---
// --- Mobile Bottom Nav ---
function MobileBottomNav({ currentPage, setCurrentPage }) {
  const items = [
    { key: "home", label: "Home", icon: Home },
    { key: "standings", label: "Standings", icon: Trophy },
    { key: "players", label: "Players", icon: Users },
    { key: "teams", label: "Teams", icon: Shield },
    { key: "compare", label: "Compare", icon: Layers },
    { key: "games", label: "Games", icon: Calendar },
  ];
  return (
    <div
      className="mobile-bottom-nav"
      style={{
        display: "none",
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "rgba(232, 221, 208, 0.97)",
        borderTop: "1px solid var(--border-color)",
        zIndex: 50,
        justifyContent: "space-around",
        padding: "6px 0 env(safe-area-inset-bottom, 6px)",
      }}
    >
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => setCurrentPage(item.key)}
          style={{
            background: "none",
            border: "none",
            color: currentPage === item.key ? "var(--accent-blue)" : "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            fontSize: 9,
            fontWeight: 600,
            fontFamily: "'Inter', sans-serif",
            padding: "4px 8px",
          }}
        >
          <item.icon size={18} />
          {item.label}
        </button>
      ))}
    </div>
  );
}

function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border-color)",
        padding: "24px 0",
        textAlign: "center",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          className="font-display"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-muted)",
          }}
        >
          Courtside — NBA Analytics
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Powered by nba_api &middot; {new Date().getFullYear()}
        </span>
      </div>
    </footer>
  );
}

// --- Placeholder Page ---
// --- Games Page ---
function GamesPage({ onGameClick }) {
  const liveData = useLiveData();
  const sortedGames = useMemo(() => {
    const order = { LIVE: 0, FINAL: 1, UPCOMING: 2 };
    return [...liveData.scoreboard].sort((a, b) => order[a.status] - order[b.status]);
  }, [liveData.scoreboard]);

  return (
    <div className="fade-in" style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px 60px" }}>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <Calendar size={24} style={{ color: "var(--accent-blue)" }} />
        Today's Games
      </h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {sortedGames.map((game) => {
          const home = TEAMS[game.homeTeam];
          const away = TEAMS[game.awayTeam];
          const isLive = game.status === "LIVE";
          const isFinal = game.status === "FINAL";
          return (
            <div
              key={game.id}
              className="card-hover"
              onClick={() => onGameClick(game.id)}
              style={{ background: "var(--bg-secondary)", borderRadius: 14, padding: 20, cursor: "pointer", position: "relative", overflow: "hidden" }}
            >
              {isLive && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "var(--accent-red)" }} />}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                {isLive ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--accent-red)" }}>
                    <div className="live-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-red)" }} />
                    Q{game.quarter} {game.timeRemaining}
                  </span>
                ) : isFinal ? (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Final</span>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-blue)" }}>{game.scheduledTime}</span>
                )}
                {game.broadcast && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{game.broadcast}</span>}
              </div>
              {/* Teams */}
              {[{ t: away, score: game.awayScore, label: "away" }, { t: home, score: game.homeScore, label: "home" }].map(({ t, score, label }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: label === "away" ? 8 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "white" }}>{t.abbr}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.record}</div>
                    </div>
                  </div>
                  <span className="stat-number" style={{ fontSize: 22, fontWeight: 700, color: game.status !== "UPCOMING" && score >= (label === "away" ? game.homeScore : game.awayScore) ? "var(--text-primary)" : "var(--text-muted)" }}>
                    {game.status !== "UPCOMING" ? score : "-"}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlaceholderPage({ title }) {
  return (
    <div
      className="fade-in"
      style={{
        maxWidth: 1400,
        margin: "0 auto",
        padding: "80px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px",
        }}
      >
        <BarChart3 size={32} style={{ color: "var(--accent-blue)" }} />
      </div>
      <h1
        className="font-display"
        style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: 16,
          color: "var(--text-secondary)",
          maxWidth: 400,
          margin: "0 auto",
        }}
      >
        This section is coming soon. Stay tuned for in-depth analytics.
      </p>
      <div
        style={{
          marginTop: 24,
          padding: "10px 20px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          borderRadius: 8,
          display: "inline-block",
          fontSize: 13,
          color: "var(--accent-amber)",
          fontWeight: 500,
        }}
      >
        Coming soon
      </div>
    </div>
  );
}

// --- Breadcrumb Component ---
function Breadcrumb({ items }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20, fontSize: 13 }}>
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <ChevronRight size={12} style={{ color: "var(--text-muted)" }} />}
          {item.onClick ? (
            <button
              onClick={item.onClick}
              style={{ background: "none", border: "none", color: "var(--accent-blue)", cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "'Inter', sans-serif", padding: 0 }}
            >
              {item.label}
            </button>
          ) : (
            <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// --- Player Browse Page ---
const SORT_OPTIONS = [
  { value: "name",       label: "Name (A–Z)" },
  { value: "ppg",        label: "Points (PPG)" },
  { value: "rpg",        label: "Rebounds (RPG)" },
  { value: "apg",        label: "Assists (APG)" },
  { value: "plusMinus",  label: "Plus/Minus" },
];

// NBA bulk stats API returns generic position groups (G / F / C / G-F / F-G / F-C / C-F).
// Specific positions (PG/SG/SF/PF) only appear on mock-enriched players.
const POSITION_OPTIONS = [
  { value: "Guard",   label: "Guard",   matches: ["G",  "G-F", "PG", "SG"] },
  { value: "Forward", label: "Forward", matches: ["F",  "F-G", "F-C", "SF", "PF"] },
  { value: "Center",  label: "Center",  matches: ["C",  "C-F"] },
];

function PlayerBrowsePage({ onPlayerSelect }) {
  const liveData = useLiveData();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterPos, setFilterPos] = useState("");

  // Build merged player list: live API players enriched with mock data (nbaId match)
  const allPlayers = useMemo(() => {
    const live = liveData.livePlayers;
    if (live && live.length > 0) {
      return live.map((lp) => {
        const mock = PLAYERS.find((m) => m.nbaId === lp.playerId);
        return {
          id: mock ? mock.id : `live_${lp.playerId}`,
          nbaId: lp.playerId,
          name: lp.name,
          team: lp.team,
          pos: mock?.pos || lp.pos || "",
          jersey: mock?.jersey ?? null,
          ppg: lp.ppg,
          rpg: lp.rpg,
          apg: lp.apg,
          plusMinus: lp.plusMinus ?? null,
          isMock: !!mock,
          liveData: lp,
        };
      });
    }
    // Fallback: 8 mock players
    return PLAYERS.map((p) => ({
      id: p.id,
      nbaId: p.nbaId,
      name: p.name,
      team: p.team,
      pos: p.pos,
      jersey: p.jersey,
      ppg: String(p.seasonAvg.pts),
      rpg: String(p.seasonAvg.reb),
      apg: String(p.seasonAvg.ast),
      isMock: true,
      liveData: null,
    }));
  }, [liveData.livePlayers]);

  // Unique sorted team list for dropdown
  const teamOptions = useMemo(() => {
    const abbrs = [...new Set(allPlayers.map((p) => p.team).filter(Boolean))];
    return abbrs.sort((a, b) => {
      const nameA = TEAMS[a]?.name || a;
      const nameB = TEAMS[b]?.name || b;
      return nameA.localeCompare(nameB);
    });
  }, [allPlayers]);

  const displayPlayers = useMemo(() => {
    let list = allPlayers;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.team.toLowerCase().includes(q) ||
          TEAMS[p.team]?.city?.toLowerCase().includes(q) ||
          TEAMS[p.team]?.name?.toLowerCase().includes(q) ||
          p.pos.toLowerCase().includes(q)
      );
    }

    // Team filter
    if (filterTeam) list = list.filter((p) => p.team === filterTeam);

    // Position filter — map each label to its set of API position codes
    if (filterPos) {
      const opt = POSITION_OPTIONS.find((o) => o.value === filterPos);
      const allowed = opt ? opt.matches : [filterPos];
      list = list.filter((p) => allowed.includes(p.pos));
    }

    // Sort
    list = [...list];
    if (sortBy === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list.sort((a, b) => parseFloat(b[sortBy] || 0) - parseFloat(a[sortBy] || 0));
    }

    return list;
  }, [search, filterTeam, filterPos, sortBy, allPlayers]);

  const selectStyle = {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    borderRadius: 8,
    padding: "9px 32px 9px 12px",
    color: "var(--text-primary)",
    fontSize: 13,
    outline: "none",
    fontFamily: "'Inter', sans-serif",
    cursor: "pointer",
    appearance: "none",
    WebkitAppearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
  };

  const activeFilters = [filterTeam, filterPos].filter(Boolean).length;

  return (
    <div className="fade-in" style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px 60px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Users size={24} style={{ color: "var(--accent-blue)" }} />
          Players
          <span style={{ fontSize: 14, fontWeight: 400, color: "var(--text-muted)" }}>({displayPlayers.length}{displayPlayers.length !== allPlayers.length ? ` of ${allPlayers.length}` : ""})</span>
        </h1>

        {/* Controls row */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
            <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players..."
              style={{ ...selectStyle, padding: "9px 14px 9px 34px", width: "100%", appearance: "auto", WebkitAppearance: "auto", backgroundImage: "none" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent-blue)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border-color)")}
            />
          </div>

          {/* Sort */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap" }}>Sort by</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={selectStyle}>
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Team filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Team</span>
            <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} style={{ ...selectStyle, borderColor: filterTeam ? "var(--accent-blue)" : "var(--border-color)" }}>
              <option value="">All Teams</option>
              {teamOptions.map((abbr) => (
                <option key={abbr} value={abbr}>{TEAMS[abbr] ? `${TEAMS[abbr].city} ${TEAMS[abbr].name}` : abbr}</option>
              ))}
            </select>
          </div>

          {/* Position filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Position</span>
            <select value={filterPos} onChange={(e) => setFilterPos(e.target.value)} style={{ ...selectStyle, borderColor: filterPos ? "var(--accent-blue)" : "var(--border-color)" }}>
              <option value="">All Positions</option>
              {POSITION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Clear filters */}
          {activeFilters > 0 && (
            <button
              onClick={() => { setFilterTeam(""); setFilterPos(""); }}
              style={{ background: "transparent", border: "1px solid var(--border-color)", borderRadius: 8, padding: "9px 12px", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 5 }}
            >
              <X size={13} /> Clear ({activeFilters})
            </button>
          )}
        </div>
      </div>

      {/* Player Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {displayPlayers.map((player) => {
          const team = TEAMS[player.team] || { color: "#444", secondaryColor: "#666", city: player.team, name: "" };
          return (
            <div
              key={player.id}
              className="card-hover"
              onClick={() => onPlayerSelect(player.id, player)}
              style={{ background: "var(--bg-secondary)", borderRadius: 14, padding: 18, cursor: "pointer", position: "relative", overflow: "hidden" }}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${team.color}, ${team.secondaryColor})` }} />
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <PlayerHeadshot nbaId={player.nbaId} name={player.name} size={60} teamColor={team.color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {player.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <TeamLogo abbr={player.team} size={16} />
                    <span>{team.city} {team.name}</span>
                    {player.pos && <span style={{ color: "var(--text-muted)" }}>· {player.pos}</span>}
                    {player.jersey != null && <span style={{ color: "var(--text-muted)" }}>· #{player.jersey}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 14 }}>
                    {[
                      { label: "PTS", value: player.ppg },
                      { label: "REB", value: player.rpg },
                      { label: "AST", value: player.apg },
                    ].map((s) => (
                      <div key={s.label} style={{ textAlign: "center" }}>
                        <div className="stat-number" style={{ fontSize: 15, fontWeight: 700, color: "var(--accent-blue)" }}>{s.value}</div>
                        <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {displayPlayers.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>No players match your filters.</p>
          <button onClick={() => { setSearch(""); setFilterTeam(""); setFilterPos(""); }} style={{ marginTop: 12, background: "transparent", border: "1px solid var(--border-color)", borderRadius: 8, padding: "8px 16px", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Clear all filters</button>
        </div>
      )}
    </div>
  );
}

// --- Player Detail Page ---
function PlayerDetailPage({ playerId, livePlayerData, onBack }) {
  const liveData = useLiveData();
  const mockPlayer = PLAYERS.find((p) => p.id === playerId);
  const [liveGameLog, setLiveGameLog] = useState(null);
  const [rollingWindow, setRollingWindow] = useState(5);
  const [activeTooltip, setActiveTooltip] = useState(null);

  // For live-only players, fetch their game log
  useEffect(() => {
    if (mockPlayer || !livePlayerData?.nbaId) return;
    let cancelled = false;
    fetchPlayerGameLog(livePlayerData.nbaId).then((gl) => {
      if (!cancelled) setLiveGameLog(gl || []);
    }).catch(() => { if (!cancelled) setLiveGameLog([]); });
    return () => { cancelled = true; };
  }, [livePlayerData?.nbaId, mockPlayer]);

  // Build a synthetic player object for live-only players
  const player = mockPlayer || (livePlayerData ? {
    id: livePlayerData.id,
    nbaId: livePlayerData.nbaId,
    name: livePlayerData.name,
    team: livePlayerData.team,
    pos: livePlayerData.pos || "—",
    jersey: livePlayerData.jersey,
    height: "—", weight: "—", age: "—", college: "—", draft: "—",
    seasonAvg: {
      pts: parseFloat(livePlayerData.ppg) || 0,
      reb: parseFloat(livePlayerData.rpg) || 0,
      ast: parseFloat(livePlayerData.apg) || 0,
      stl: parseFloat(livePlayerData.liveData?.spg) || 0,
      blk: parseFloat(livePlayerData.liveData?.bpg) || 0,
      fgPct: parseFloat(livePlayerData.liveData?.fgPct) || 0,
      tpPct: parseFloat(livePlayerData.liveData?.tpPct) || 0,
      ftPct: parseFloat(livePlayerData.liveData?.ftPct) || 0,
      per: null, ts: null, usg: null, ortg: null, drtg: null, bpm: null, vorp: null, ws: null,
    },
    gameLog: [],
    isLiveOnly: true,
  } : null);

  if (!player) {
    return (
      <div className="fade-in" style={{ maxWidth: 1400, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: 16 }}>Player not found.</p>
        <button onClick={onBack} style={{ marginTop: 16, background: "var(--accent-blue)", border: "none", borderRadius: 8, padding: "8px 20px", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
          Back to Players
        </button>
      </div>
    );
  }

  const team = TEAMS[player.team] || { color: "#444", secondaryColor: "#666", city: player.team, name: "", teamId: null };
  const avg = player.seasonAvg;
  const log = mockPlayer ? player.gameLog : (liveGameLog || []);

  // Compute rolling averages
  const rollingData = useMemo(() => {
    return log.map((game, idx) => {
      const start = Math.max(0, idx - rollingWindow + 1);
      const window = log.slice(start, idx + 1);
      const avgPts = window.reduce((s, g) => s + g.pts, 0) / window.length;
      const avgReb = window.reduce((s, g) => s + g.reb, 0) / window.length;
      const avgAst = window.reduce((s, g) => s + g.ast, 0) / window.length;
      return {
        game: `G${idx + 1}`,
        date: game.date,
        pts: game.pts,
        rollingPts: +avgPts.toFixed(1),
        rollingReb: +avgReb.toFixed(1),
        rollingAst: +avgAst.toFixed(1),
      };
    });
  }, [log, rollingWindow]);

  // Shooting splits for bar chart
  const shootingSplits = [
    { stat: "FG%", value: avg.fgPct, league: 47.0 },
    { stat: "3P%", value: avg.tpPct, league: 36.0 },
    { stat: "FT%", value: avg.ftPct, league: 78.0 },
    { stat: "TS%", value: avg.ts ?? 0, league: 57.0 },
  ];

  // Radar chart data (normalized 0-100)
  const radarData = [
    { stat: "Scoring", value: Math.min(100, (avg.pts / 35) * 100) },
    { stat: "Rebounding", value: Math.min(100, (avg.reb / 14) * 100) },
    { stat: "Playmaking", value: Math.min(100, (avg.ast / 11) * 100) },
    { stat: "Defense", value: Math.min(100, ((avg.stl + avg.blk) / 4.5) * 100) },
    { stat: "Efficiency", value: Math.min(100, ((avg.ts ?? 0) / 68) * 100) },
    { stat: "Impact", value: Math.min(100, ((avg.per ?? 0) / 35) * 100) },
  ];

  // Advanced stats with descriptions (hidden for live-only players that lack them)
  const advancedStats = avg.per != null ? [
    { key: "PER", value: avg.per.toFixed(1), desc: "Player Efficiency Rating — a per-minute rating of a player's performance. League average is 15.0." },
    { key: "TS%", value: avg.ts.toFixed(1), desc: "True Shooting % — measures shooting efficiency including 2P, 3P, and FT. League average ~57%." },
    { key: "USG%", value: avg.usg.toFixed(1), desc: "Usage Rate — percentage of team plays used by the player while on court." },
    { key: "ORtg", value: avg.ortg, desc: "Offensive Rating — points produced per 100 possessions. Higher is better." },
    { key: "DRtg", value: avg.drtg, desc: "Defensive Rating — points allowed per 100 possessions. Lower is better." },
    { key: "BPM", value: avg.bpm.toFixed(1), desc: "Box Plus/Minus — box score estimate of points per 100 possessions above average." },
    { key: "VORP", value: avg.vorp.toFixed(1), desc: "Value Over Replacement Player — estimate of points contributed over a replacement-level player." },
    { key: "WS", value: avg.ws.toFixed(1), desc: "Win Shares — estimate of the number of wins contributed by a player." },
  ] : [];

  const ChartTooltipContent = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--text-primary)" }}>{label}</div>
          {payload.map((p) => (
            <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
              {p.name}: <span style={{ fontWeight: 600 }}>{p.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fade-in" style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 24px 60px" }}>
      {/* Back */}
      <Breadcrumb items={[
        { label: "Home", onClick: () => onBack("home") },
        { label: "Players", onClick: () => onBack("players") },
        { label: player.name },
      ]} />

      {/* ===== BIO SECTION ===== */}
      <div
        style={{
          background: "var(--bg-secondary)",
          borderRadius: 16,
          border: "1px solid var(--border-color)",
          padding: "28px 32px",
          marginBottom: 28,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Team color accent bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${team.color}, ${team.secondaryColor})` }} />

        <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
          {/* Player headshot */}
          <PlayerHeadshot nbaId={player.nbaId} name={player.name} size={120} teamColor={team.color} />

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800 }}>{player.name}</h1>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: team.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "white" }}>{player.team}</div>
            </div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>
              {team.city} {team.name} · {player.pos}{player.jersey != null ? ` · #${player.jersey}` : ""}
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {[
                { label: "Height", value: player.height },
                { label: "Weight", value: player.weight },
                { label: "Age", value: player.age },
                { label: "Draft", value: player.draft },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick stat badges */}
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: "PTS", value: avg.pts, color: "var(--accent-blue)" },
              { label: "REB", value: avg.reb, color: "var(--accent-amber)" },
              { label: "AST", value: avg.ast, color: "var(--accent-green)" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "var(--bg-tertiary)",
                  borderRadius: 12,
                  padding: "14px 16px",
                  textAlign: "center",
                  minWidth: 72,
                }}
              >
                <div className="stat-number" style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== SEASON AVERAGES TABLE ===== */}
      <div style={{ marginBottom: 28 }}>
        <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <Target size={18} style={{ color: "var(--accent-blue)" }} />
          Season Averages
        </h2>
        <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid var(--border-color)" }}>
            {["PTS", "REB", "AST", "STL", "BLK", "FG%", "3P%", "FT%", "PER", "TS%"].map((h) => (
              <span key={h} className="stat-number" style={{ textAlign: "center", padding: "10px 0" }}>{h}</span>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", fontSize: 15, fontWeight: 600 }}>
            {[avg.pts, avg.reb, avg.ast, avg.stl, avg.blk, avg.fgPct, avg.tpPct, avg.ftPct, avg.per, avg.ts].map((v, i) => (
              <span key={i} className="stat-number" style={{ textAlign: "center", padding: "14px 0", color: i < 5 ? "var(--text-primary)" : "var(--accent-blue)" }}>
                {typeof v === "number" ? v.toFixed(1) : v}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ===== CHARTS ROW ===== */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
        {/* Scoring Trend + Rolling Average */}
        <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              <Activity size={14} style={{ color: "var(--accent-blue)" }} />
              Scoring Trend
            </h3>
            {/* Rolling window toggle */}
            <div style={{ display: "flex", gap: 4 }}>
              {[5, 10, 15].map((w) => (
                <button
                  key={w}
                  onClick={() => setRollingWindow(w)}
                  style={{
                    background: rollingWindow === w ? "var(--accent-blue)" : "var(--bg-tertiary)",
                    border: rollingWindow === w ? "1px solid var(--accent-blue)" : "1px solid var(--border-color)",
                    borderRadius: 5,
                    padding: "4px 10px",
                    color: rollingWindow === w ? "white" : "var(--text-secondary)",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {w}G
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={rollingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="game" axisLine={false} tickLine={false} tick={{ fill: "#9e8878", fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9e8878", fontSize: 10 }} domain={["auto", "auto"]} />
              <Tooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="pts" stroke="#b8ab9c" strokeWidth={1} dot={{ r: 2, fill: "#b8ab9c" }} name="Points" />
              <Line type="monotone" dataKey="rollingPts" stroke="#e8590c" strokeWidth={2.5} dot={false} name={`${rollingWindow}G Avg`} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Shooting Splits */}
        <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", padding: "20px" }}>
          <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <Target size={14} style={{ color: "var(--accent-amber)" }} />
            Shooting Splits
          </h3>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 10, fontSize: 11, color: "var(--text-muted)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: team.color }} /> Player
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "var(--text-muted)" }} /> League Avg
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={shootingSplits} barGap={4} barCategoryGap="25%">
              <XAxis dataKey="stat" axisLine={false} tickLine={false} tick={{ fill: "#9e8878", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9e8878", fontSize: 10 }} domain={[0, 100]} />
              <Tooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" name="Player" radius={[4, 4, 0, 0]} maxBarSize={32}>
                {shootingSplits.map((_, i) => <Cell key={i} fill={team.color} />)}
              </Bar>
              <Bar dataKey="league" name="League Avg" radius={[4, 4, 0, 0]} maxBarSize={32} fill="#b8ab9c" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Radar Chart */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
        <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", padding: "20px" }}>
          <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <Star size={14} style={{ color: "var(--accent-amber)" }} />
            Player Profile
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="rgba(0,0,0,0.1)" />
              <PolarAngleAxis dataKey="stat" tick={{ fill: "#9e8878", fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name={player.name} dataKey="value" stroke={team.color} fill={team.color} fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Advanced Stats */}
        <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", padding: "20px" }}>
          <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <TrendingUp size={14} style={{ color: "var(--accent-green)" }} />
            Advanced Stats
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {advancedStats.map((stat) => (
              <div
                key={stat.key}
                style={{
                  background: "var(--bg-tertiary)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  position: "relative",
                  cursor: "default",
                }}
                onMouseEnter={() => setActiveTooltip(stat.key)}
                onMouseLeave={() => setActiveTooltip(null)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{stat.key}</span>
                    <Info size={11} style={{ color: "var(--text-muted)", opacity: 0.6 }} />
                  </div>
                  <span className="stat-number" style={{ fontSize: 16, fontWeight: 700, color: "var(--accent-blue)" }}>{stat.value}</span>
                </div>
                {/* Tooltip */}
                {activeTooltip === stat.key && (
                  <div
                    className="fade-in"
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 8px)",
                      left: 0,
                      right: 0,
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-hover)",
                      borderRadius: 8,
                      padding: "10px 12px",
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                      zIndex: 10,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                    }}
                  >
                    {stat.desc}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== GAME LOG ===== */}
      <div>
        <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <Calendar size={18} style={{ color: "var(--accent-blue)" }} />
          Game Log
          <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }}>({log.length} games)</span>
        </h2>
        <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", overflow: "hidden" }}>
          {/* Scrollable wrapper — shows 8 rows, scroll for the rest */}
          <div className="score-scroll" style={{ overflowX: "auto", overflowY: "auto", maxHeight: 330 }}>
            {/* Header — sticky so column labels stay visible while scrolling */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "52px 44px 38px 50px 38px 38px 38px 38px 38px 50px 50px 44px 32px 40px",
                padding: "8px 14px",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                borderBottom: "1px solid var(--border-color)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                minWidth: 680,
                position: "sticky",
                top: 0,
                background: "var(--bg-secondary)",
                zIndex: 1,
              }}
            >
              {["Date", "Opp", "W/L", "Min", "PTS", "REB", "AST", "STL", "BLK", "FG", "3P", "FT", "TO", "+/-"].map((h) => (
                <span key={h} className="stat-number" style={{ textAlign: h === "Date" || h === "Opp" || h === "W/L" ? "left" : "center" }}>{h}</span>
              ))}
            </div>
            {/* Rows */}
            {log.map((g, idx) => {
              const pm = parseInt(g.plusMinus);
              return (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "52px 44px 38px 50px 38px 38px 38px 38px 38px 50px 50px 44px 32px 40px",
                    padding: "8px 14px",
                    fontSize: 12,
                    borderBottom: idx < log.length - 1 ? "1px solid var(--border-color)" : "none",
                    alignItems: "center",
                    transition: "background 0.15s",
                    minWidth: 680,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span className="stat-number" style={{ color: "var(--text-muted)", fontSize: 11 }}>{g.date}</span>
                  <span style={{ fontWeight: 600, fontSize: 11 }}>{g.opp}</span>
                  <span style={{ fontWeight: 600, fontSize: 11, color: g.result === "W" ? "var(--accent-green)" : "var(--accent-red)" }}>{g.result}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 11 }}>{g.min}</span>
                  <span className="stat-number" style={{ textAlign: "center", fontWeight: 700, color: g.pts >= 30 ? "var(--accent-blue)" : "var(--text-primary)" }}>{g.pts}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: g.reb >= 10 ? "var(--accent-amber)" : "var(--text-secondary)" }}>{g.reb}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: g.ast >= 10 ? "var(--accent-amber)" : "var(--text-secondary)" }}>{g.ast}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{g.stl}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{g.blk}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 11 }}>{g.fgm}-{g.fga}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 11 }}>{g.tpm}-{g.tpa}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 11 }}>{g.ftm}-{g.fta}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: g.to >= 4 ? "var(--accent-red)" : "var(--text-muted)" }}>{g.to}</span>
                  <span className="stat-number" style={{ textAlign: "center", fontWeight: 600, color: pm > 0 ? "var(--accent-green)" : pm < 0 ? "var(--accent-red)" : "var(--text-secondary)" }}>{g.plusMinus}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Lineup Analyzer Page ---
function LineupAnalyzerPage() {
  const liveData = useLiveData();
  const [selectedTeam, setSelectedTeam] = useState("BOS");
  const [groupSize, setGroupSize] = useState(5);
  const [playerFilter, setPlayerFilter] = useState([]);
  const [sortKey, setSortKey] = useState("netRtg");
  const [sortDir, setSortDir] = useState("desc");
  const [minMinutes, setMinMinutes] = useState(10);
  const [lineups, setLineups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const team = TEAMS[selectedTeam] || {};

  // Fetch lineups from DB when team or groupSize changes (2-5 man only)
  useEffect(() => {
    if (groupSize === 1) {
      setLineups([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchLineups(selectedTeam, groupSize)
      .then((data) => {
        setLineups(data);
        setLoading(false);
        // Trim persisted player filter to only names present in the new group size
        const chipNames = new Set();
        data.forEach((l) => (l.players || "").split(" - ").forEach((n) => chipNames.add(n.trim())));
        setPlayerFilter((prev) => prev.filter((n) => chipNames.has(n)));
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [selectedTeam, groupSize]);

  // Reset filter when team changes (for 1-man view too)
  useEffect(() => { setPlayerFilter([]); }, [selectedTeam]);

  // 1-man: filter livePlayers by selected team
  const singlePlayers = useMemo(() => {
    if (groupSize !== 1) return [];
    return (liveData.livePlayers || [])
      .filter((p) => p.team === selectedTeam)
      .sort((a, b) => (parseFloat(b.ppg) || 0) - (parseFloat(a.ppg) || 0));
  }, [groupSize, selectedTeam, liveData.livePlayers]);

  // Unique abbreviated player names from lineup GROUP_NAME strings (filter chips)
  const allChipNames = useMemo(() => {
    if (groupSize === 1) return [];
    const set = new Set();
    lineups.forEach((l) => (l.players || "").split(" - ").forEach((n) => set.add(n.trim())));
    return Array.from(set).sort();
  }, [lineups, groupSize]);

  // Filter + sort multi-man lineups
  const filteredLineups = useMemo(() => {
    let rows = lineups.filter((l) => parseFloat(l.min) >= minMinutes);
    if (playerFilter.length > 0) {
      rows = rows.filter((l) =>
        playerFilter.every((pname) =>
          (l.players || "").split(" - ").map((s) => s.trim()).includes(pname)
        )
      );
    }
    return [...rows].sort((a, b) => {
      let av = parseFloat(a[sortKey]) ?? -Infinity;
      let bv = parseFloat(b[sortKey]) ?? -Infinity;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [lineups, playerFilter, sortKey, sortDir, minMinutes]);

  // Sort 1-man player rows
  const sortedSinglePlayers = useMemo(() => {
    if (groupSize !== 1) return [];
    return [...singlePlayers].sort((a, b) => {
      const av = parseFloat(a[sortKey]) || 0;
      const bv = parseFloat(b[sortKey]) || 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [singlePlayers, sortKey, sortDir, groupSize]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ colKey }) => {
    if (sortKey !== colKey) return null;
    return sortDir === "desc" ? <ChevronDown size={11} style={{ marginLeft: 2 }} /> : <ChevronUp size={11} style={{ marginLeft: 2 }} />;
  };

  // Column definitions
  const multiColumns = [
    { key: "players", label: "Lineup", width: "1fr", align: "left" },
    { key: "gp",        label: "GP",   width: 44 },
    { key: "min",       label: "MIN",  width: 50 },
    { key: "netRtg",    label: "NET",  width: 56 },
    { key: "ortg",      label: "ORTG", width: 54 },
    { key: "drtg",      label: "DRTG", width: 54 },
    { key: "plusMinus", label: "+/-",  width: 54 },
    { key: "pts",       label: "PPG",  width: 50 },
    { key: "fgPct",     label: "FG%",  width: 50 },
  ];

  const singleColumns = [
    { key: "name",       label: "Player", width: "1fr", align: "left" },
    { key: "gp",         label: "GP",  width: 44 },
    { key: "mpg",        label: "MPG", width: 52 },
    { key: "ppg",        label: "PPG", width: 52 },
    { key: "rpg",        label: "RPG", width: 52 },
    { key: "apg",        label: "APG", width: 52 },
    { key: "fgPct",      label: "FG%", width: 54 },
    { key: "plusMinus",  label: "+/-", width: 56 },
  ];

  const columns = groupSize === 1 ? singleColumns : multiColumns;
  const firstColKey = groupSize === 1 ? "name" : "players";
  const gridTemplate = columns.map((c) => (typeof c.width === "number" ? `${c.width}px` : c.width)).join(" ");

  return (
    <div className="fade-in" style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px 60px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
          <Users size={24} style={{ color: "var(--accent-blue)" }} />
          Lineup Analyzer
        </h1>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Team dropdown */}
          <select
            value={selectedTeam}
            onChange={(e) => { setSelectedTeam(e.target.value); setPlayerFilter([]); }}
            style={{
              background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 8,
              padding: "8px 34px 8px 12px", fontSize: 13, fontWeight: 600, fontFamily: "'Inter', sans-serif",
              color: "var(--text-primary)", cursor: "pointer", outline: "none",
              appearance: "none", WebkitAppearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239e8878' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat", backgroundPosition: "calc(100% - 10px) center",
            }}
          >
            <optgroup label="Western Conference">
              {["Northwest", "Pacific", "Southwest"].flatMap((div) =>
                Object.entries(TEAMS)
                  .filter(([, t]) => t.division === div)
                  .sort(([, a], [, b]) => a.name.localeCompare(b.name))
                  .map(([abbr, t]) => <option key={abbr} value={abbr}>{t.city} {t.name}</option>)
              )}
            </optgroup>
            <optgroup label="Eastern Conference">
              {["Atlantic", "Central", "Southeast"].flatMap((div) =>
                Object.entries(TEAMS)
                  .filter(([, t]) => t.division === div)
                  .sort(([, a], [, b]) => a.name.localeCompare(b.name))
                  .map(([abbr, t]) => <option key={abbr} value={abbr}>{t.city} {t.name}</option>)
              )}
            </optgroup>
          </select>

          {/* Group size tabs */}
          <div style={{ display: "flex", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-color)", overflow: "hidden" }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => { setGroupSize(n); setSortKey(n === 1 ? "ppg" : "netRtg"); setSortDir("desc"); }}
                style={{
                  padding: "8px 14px", fontSize: 12, fontWeight: 700, fontFamily: "'Inter', sans-serif",
                  cursor: "pointer", border: "none", transition: "all 0.15s",
                  background: groupSize === n ? (team.color || "var(--accent-blue)") : "transparent",
                  color: groupSize === n ? "white" : "var(--text-secondary)",
                  borderRight: n < 5 ? "1px solid var(--border-color)" : "none",
                }}
              >
                {n}-Man
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 1-Man view ── */}
      {groupSize === 1 && (
        <>
          <div style={{ marginBottom: 20, padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-color)", fontSize: 13, color: "var(--text-secondary)" }}>
            Individual player stats for <strong style={{ color: "var(--text-primary)" }}>{team.city} {team.name}</strong>
            {" — "}{singlePlayers.length} players
          </div>

          <div style={{ marginBottom: 28 }}>
            <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <Layers size={14} style={{ color: "var(--accent-blue)" }} />
              Player Stats
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)", marginLeft: 6 }}>({sortedSinglePlayers.length} players)</span>
            </h3>
            <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", overflow: "hidden", overflowX: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: gridTemplate, padding: "8px 14px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)", textTransform: "uppercase", letterSpacing: "0.5px", userSelect: "none", minWidth: 560 }}>
                {columns.map((col) => (
                  <span
                    key={col.key}
                    className={col.key !== "name" ? "stat-number" : ""}
                    onClick={() => col.key !== "name" && handleSort(col.key)}
                    style={{ textAlign: col.key === "name" ? "left" : "center", cursor: col.key !== "name" ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: col.key === "name" ? "flex-start" : "center", color: sortKey === col.key ? "var(--accent-blue)" : undefined }}
                  >
                    {col.label}{col.key !== "name" && <SortIcon colKey={col.key} />}
                  </span>
                ))}
              </div>
              {sortedSinglePlayers.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>No player data for this team.</div>
              )}
              {sortedSinglePlayers.map((p, idx) => {
                const pm = parseFloat(p.plusMinus) || 0;
                return (
                  <div
                    key={p.playerId || idx}
                    style={{ display: "grid", gridTemplateColumns: gridTemplate, padding: "10px 14px", fontSize: 12, borderBottom: idx < sortedSinglePlayers.length - 1 ? "1px solid var(--border-color)" : "none", alignItems: "center", transition: "background 0.15s", minWidth: 560 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</span>
                    <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.gp}</span>
                    <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{parseFloat(p.mpg).toFixed(1)}</span>
                    <span className="stat-number" style={{ textAlign: "center", fontWeight: 600, color: "var(--text-primary)" }}>{parseFloat(p.ppg).toFixed(1)}</span>
                    <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{parseFloat(p.rpg).toFixed(1)}</span>
                    <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{parseFloat(p.apg).toFixed(1)}</span>
                    <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.fgPct ? (parseFloat(p.fgPct) * 100).toFixed(1) : "—"}</span>
                    <span className="stat-number" style={{ textAlign: "center", fontWeight: 600, color: pm >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                      {pm >= 0 ? `+${Math.abs(pm).toFixed(1)}` : `-${Math.abs(pm).toFixed(1)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Multi-man (2-5) view ── */}
      {groupSize > 1 && (
        <>
          {loading && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: 14 }}>
              Loading {groupSize}-man lineup data…
            </div>
          )}
          {error && !loading && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--accent-red)", fontSize: 14 }}>
              Failed to load lineup data: {error}
            </div>
          )}
          {!loading && !error && (
            <>
              {/* Minutes minimum qualifier */}
              <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                  Min. Minutes:
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 180 }}>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    step={1}
                    value={minMinutes}
                    onChange={(e) => setMinMinutes(Number(e.target.value))}
                    style={{ flex: 1, accentColor: team.color || "var(--accent-blue)", cursor: "pointer" }}
                  />
                  <span className="stat-number" style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", minWidth: 36, textAlign: "right" }}>
                    {minMinutes === 20 ? "20+" : minMinutes}
                  </span>
                </div>
              </div>

              {/* Player filter chips */}
              {allChipNames.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Filter by player (up to {groupSize}):
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {allChipNames.map((name) => {
                      const active = playerFilter.includes(name);
                      return (
                        <button
                          key={name}
                          onClick={() => {
                            if (active) setPlayerFilter((f) => f.filter((n) => n !== name));
                            else if (playerFilter.length < groupSize) setPlayerFilter((f) => [...f, name]);
                          }}
                          style={{
                            background: active ? team.color : "var(--bg-secondary)",
                            border: `1px solid ${active ? team.color : "var(--border-color)"}`,
                            borderRadius: 6, padding: "5px 11px", cursor: "pointer",
                            color: active ? "white" : "var(--text-secondary)",
                            fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif",
                            transition: "all 0.2s", opacity: !active && playerFilter.length >= groupSize ? 0.4 : 1,
                          }}
                        >
                          {name}
                        </button>
                      );
                    })}
                    {playerFilter.length > 0 && (
                      <button onClick={() => setPlayerFilter([])} style={{ background: "none", border: "1px solid var(--border-color)", borderRadius: 6, padding: "5px 11px", cursor: "pointer", color: "var(--accent-red)", fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Lineup Table */}
              <div style={{ marginBottom: 28 }}>
                <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <Layers size={14} style={{ color: "var(--accent-blue)" }} />
                  {groupSize}-Man Lineup Combinations
                  <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)", marginLeft: 6 }}>
                    ({filteredLineups.length} lineup{filteredLineups.length !== 1 ? "s" : ""})
                  </span>
                </h3>
                <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", overflow: "hidden", overflowX: "auto" }}>
                  <div style={{ display: "grid", gridTemplateColumns: gridTemplate, padding: "8px 14px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)", textTransform: "uppercase", letterSpacing: "0.5px", userSelect: "none", minWidth: 620 }}>
                    {columns.map((col) => (
                      <span
                        key={col.key}
                        className={col.key !== firstColKey ? "stat-number" : ""}
                        onClick={() => col.key !== firstColKey && handleSort(col.key)}
                        style={{ textAlign: col.key === firstColKey ? "left" : "center", cursor: col.key !== firstColKey ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: col.key === firstColKey ? "flex-start" : "center", color: sortKey === col.key ? "var(--accent-blue)" : undefined, transition: "color 0.15s" }}
                      >
                        {col.label}{col.key !== firstColKey && <SortIcon colKey={col.key} />}
                      </span>
                    ))}
                  </div>
                  {filteredLineups.map((lineup, idx) => {
                    const nr = parseFloat(lineup.netRtg);
                    const pm = parseFloat(lineup.plusMinus);
                    const playerNames = (lineup.players || "").split(" - ").map((s) => s.trim());
                    return (
                      <div
                        key={idx}
                        style={{ display: "grid", gridTemplateColumns: gridTemplate, padding: "10px 14px", fontSize: 12, borderBottom: idx < filteredLineups.length - 1 ? "1px solid var(--border-color)" : "none", alignItems: "center", transition: "background 0.15s", minWidth: 620 }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {playerNames.map((p) => (
                            <span key={p} style={{ fontSize: 11, fontWeight: 600, background: playerFilter.includes(p) ? `${team.color}22` : "var(--bg-tertiary)", color: playerFilter.includes(p) ? team.color : "var(--text-primary)", padding: "2px 7px", borderRadius: 4 }}>
                              {p}
                            </span>
                          ))}
                        </div>
                        <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{lineup.gp}</span>
                        <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{lineup.min}</span>
                        <span className="stat-number" style={{ textAlign: "center", fontWeight: 700, color: nr > 0 ? "var(--accent-green)" : nr < 0 ? "var(--accent-red)" : "var(--text-secondary)" }}>
                          {nr > 0 ? "+" : ""}{lineup.netRtg}
                        </span>
                        <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{lineup.ortg}</span>
                        <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{lineup.drtg}</span>
                        <span className="stat-number" style={{ textAlign: "center", fontWeight: 600, color: pm >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>{lineup.plusMinus}</span>
                        <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{lineup.pts}</span>
                        <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{lineup.fgPct}</span>
                      </div>
                    );
                  })}
                  {filteredLineups.length === 0 && (
                    <div style={{ padding: "24px", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
                      {lineups.length === 0 ? "No lineup data available. Run the proxy server to populate." : "No lineups match the selected player filter."}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// --- Head-to-Head Comparison Page ---
function ComparisonPage() {
  const liveData = useLiveData();
  const [mode, setMode] = useState("player"); // "player" | "team"
  const [statMode, setStatMode] = useState("perGame"); // "perGame" | "per36" | "totals"
  const [leftId, setLeftId] = useState(null);
  const [rightId, setRightId] = useState(null);
  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const isPlayerMode = mode === "player";
  const items = useMemo(() => {
    if (!isPlayerMode) {
      return Object.entries(TEAMS).map(([abbr, t]) => ({ id: abbr, label: `${t.city} ${t.name}`, sub: `${t.division} · ${t.record}`, color: t.color, abbr }));
    }
    const live = liveData.livePlayers;
    if (live && live.length > 0) {
      return live.map((lp) => ({
        id: lp.playerId,
        label: lp.name,
        sub: `${TEAMS[lp.team]?.city || ""} ${TEAMS[lp.team]?.name || lp.team} · ${lp.pos || "—"}`,
        color: TEAMS[lp.team]?.color || "#888",
        abbr: lp.team,
      }));
    }
    return PLAYERS.map((p) => ({ id: p.id, label: p.name, sub: `${TEAMS[p.team]?.city} ${TEAMS[p.team]?.name} · ${p.pos}`, color: TEAMS[p.team]?.color, abbr: p.team }));
  }, [isPlayerMode, liveData.livePlayers]);

  const filterItems = (q) => {
    if (!q.trim()) return items;
    const lower = q.toLowerCase();
    return items.filter((i) => i.label.toLowerCase().includes(lower) || i.sub.toLowerCase().includes(lower));
  };

  const leftItem = items.find((i) => i.id === leftId);
  const rightItem = items.find((i) => i.id === rightId);

  // Reset selections on mode change
  const switchMode = (m) => {
    setMode(m);
    setLeftId(null);
    setRightId(null);
    setLeftSearch("");
    setRightSearch("");
    setStatMode("perGame");
  };

  // --- Stat computation helpers ---
  const getPlayerStats = (playerId) => {
    // Live DB players (all ~530 players)
    const lp = liveData.livePlayers?.find((p) => p.playerId === playerId);
    if (lp) {
      const pts = parseFloat(lp.ppg) || 0;
      const reb = parseFloat(lp.rpg) || 0;
      const ast = parseFloat(lp.apg) || 0;
      const stl = parseFloat(lp.spg) || 0;
      const blk = parseFloat(lp.bpg) || 0;
      const fgPct = parseFloat(lp.fgPct) || 0;
      const tpPct = parseFloat(lp.tpPct) || 0;
      const ftPct = parseFloat(lp.ftPct) || 0;
      const gp = lp.gp || 0;
      const mpg = parseFloat(lp.mpg) || 36;
      const per36Factor = 36 / mpg;
      if (statMode === "perGame") {
        return { gp, pts, reb, ast, stl, blk, fgPct, tpPct, ftPct };
      } else if (statMode === "per36") {
        return { gp, pts: +(pts * per36Factor).toFixed(1), reb: +(reb * per36Factor).toFixed(1), ast: +(ast * per36Factor).toFixed(1), stl: +(stl * per36Factor).toFixed(1), blk: +(blk * per36Factor).toFixed(1), fgPct, tpPct, ftPct };
      } else {
        return { gp, pts: +(pts * gp).toFixed(0), reb: +(reb * gp).toFixed(0), ast: +(ast * gp).toFixed(0), stl: +(stl * gp).toFixed(0), blk: +(blk * gp).toFixed(0), fgPct, tpPct, ftPct };
      }
    }
    // Fallback: mock PLAYERS (8 players, used if live data not loaded)
    const p = PLAYERS.find((pl) => pl.id === playerId);
    if (!p) return null;
    const a = p.seasonAvg;
    const gp = p.gameLog.length;
    const totalMin = p.gameLog.reduce((s, g) => { const [m, sec] = g.min.split(":").map(Number); return s + m + sec / 60; }, 0);
    const per36Factor = 36 / (totalMin / gp);
    if (statMode === "perGame") {
      return { gp, pts: a.pts, reb: a.reb, ast: a.ast, stl: a.stl, blk: a.blk, fgPct: a.fgPct, tpPct: a.tpPct, ftPct: a.ftPct };
    } else if (statMode === "per36") {
      return { gp, pts: +(a.pts * per36Factor).toFixed(1), reb: +(a.reb * per36Factor).toFixed(1), ast: +(a.ast * per36Factor).toFixed(1), stl: +(a.stl * per36Factor).toFixed(1), blk: +(a.blk * per36Factor).toFixed(1), fgPct: a.fgPct, tpPct: a.tpPct, ftPct: a.ftPct };
    } else {
      return { gp, pts: +(a.pts * gp).toFixed(0), reb: +(a.reb * gp).toFixed(0), ast: +(a.ast * gp).toFixed(0), stl: +(a.stl * gp).toFixed(0), blk: +(a.blk * gp).toFixed(0), fgPct: a.fgPct, tpPct: a.tpPct, ftPct: a.ftPct };
    }
  };

  const getTeamStats = (abbr) => {
    const t = TEAMS[abbr];
    if (!t) return null;
    const conf = t.conference === "East" ? "East" : "West";
    const st = liveData.standings[conf].find((s) => s.team === abbr);
    if (!st) return null;
    const d = TEAM_DETAILS[abbr];
    const gp = st.wins + st.losses;

    const base = {
      wins: st.wins, losses: st.losses,
      ppg: st.ppg, oppPpg: st.oppPpg,
      fgPct: d ? d.teamStats.efgPct : 50.0,
      pace: d ? d.teamStats.pace : 100.0,
      ortg: d ? d.teamStats.ortg : 110.0,
      drtg: d ? d.teamStats.drtg : 112.0,
      netRtg: d ? d.teamStats.netRtg : 0,
      reb: d ? (d.roster.reduce((s, p) => s + p.rpg, 0) / d.roster.length * 5) : 42,
      ast: d ? (d.roster.reduce((s, p) => s + p.apg, 0) / d.roster.length * 5) : 24,
    };

    if (statMode === "totals") {
      return { ...base, ppg: +(base.ppg * gp).toFixed(0), oppPpg: +(base.oppPpg * gp).toFixed(0), reb: +(base.reb * gp).toFixed(0), ast: +(base.ast * gp).toFixed(0) };
    }
    return base;
  };

  const leftStats = useMemo(() => leftId ? (isPlayerMode ? getPlayerStats(leftId) : getTeamStats(leftId)) : null, [leftId, isPlayerMode, statMode]);
  const rightStats = useMemo(() => rightId ? (isPlayerMode ? getPlayerStats(rightId) : getTeamStats(rightId)) : null, [rightId, isPlayerMode, statMode]);

  // Stat rows for comparison
  const playerStatRows = [
    { key: "gp", label: "Games Played" },
    { key: "pts", label: "Points" },
    { key: "reb", label: "Rebounds" },
    { key: "ast", label: "Assists" },
    { key: "stl", label: "Steals" },
    { key: "blk", label: "Blocks" },
    { key: "fgPct", label: "FG%", pct: true },
    { key: "tpPct", label: "3P%", pct: true },
    { key: "ftPct", label: "FT%", pct: true },
  ];

  const teamStatRows = [
    { key: "wins", label: "Wins" },
    { key: "losses", label: "Losses", invert: true },
    { key: "ppg", label: statMode === "totals" ? "Total Points" : "PPG" },
    { key: "oppPpg", label: statMode === "totals" ? "Opp Total Pts" : "Opp PPG", invert: true },
    { key: "reb", label: statMode === "totals" ? "Total Rebounds" : "Rebounds" },
    { key: "ast", label: statMode === "totals" ? "Total Assists" : "Assists" },
    { key: "fgPct", label: "eFG%" },
    { key: "pace", label: "Pace" },
    { key: "ortg", label: "Off Rating" },
    { key: "drtg", label: "Def Rating", invert: true },
    { key: "netRtg", label: "Net Rating" },
  ];

  const statRows = isPlayerMode ? playerStatRows : teamStatRows;

  // Radar data
  const radarData = useMemo(() => {
    if (!leftStats || !rightStats) return [];
    if (isPlayerMode) {
      const maxes = { pts: 35, reb: 14, ast: 11, stl: 2.5, blk: 4, fgPct: 65 };
      if (statMode === "per36") { maxes.pts = 40; maxes.reb = 16; maxes.ast = 13; }
      if (statMode === "totals") { maxes.pts = 700; maxes.reb = 280; maxes.ast = 220; maxes.stl = 50; maxes.blk = 80; }
      return [
        { stat: "Scoring", left: Math.min(100, (leftStats.pts / maxes.pts) * 100), right: Math.min(100, (rightStats.pts / maxes.pts) * 100) },
        { stat: "Rebounds", left: Math.min(100, (leftStats.reb / maxes.reb) * 100), right: Math.min(100, (rightStats.reb / maxes.reb) * 100) },
        { stat: "Assists", left: Math.min(100, (leftStats.ast / maxes.ast) * 100), right: Math.min(100, (rightStats.ast / maxes.ast) * 100) },
        { stat: "Steals", left: Math.min(100, (leftStats.stl / maxes.stl) * 100), right: Math.min(100, (rightStats.stl / maxes.stl) * 100) },
        { stat: "Blocks", left: Math.min(100, (leftStats.blk / maxes.blk) * 100), right: Math.min(100, (rightStats.blk / maxes.blk) * 100) },
        { stat: "FG%", left: Math.min(100, (leftStats.fgPct / maxes.fgPct) * 100), right: Math.min(100, (rightStats.fgPct / maxes.fgPct) * 100) },
      ];
    } else {
      return [
        { stat: "Offense", left: Math.min(100, ((leftStats.ortg - 95) / 35) * 100), right: Math.min(100, ((rightStats.ortg - 95) / 35) * 100) },
        { stat: "Defense", left: Math.min(100, ((130 - leftStats.drtg) / 35) * 100), right: Math.min(100, ((130 - rightStats.drtg) / 35) * 100) },
        { stat: "Scoring", left: Math.min(100, (leftStats.ppg / (statMode === "totals" ? 7000 : 130)) * 100), right: Math.min(100, (rightStats.ppg / (statMode === "totals" ? 7000 : 130)) * 100) },
        { stat: "Rebounds", left: Math.min(100, (leftStats.reb / (statMode === "totals" ? 3000 : 50)) * 100), right: Math.min(100, (rightStats.reb / (statMode === "totals" ? 3000 : 50)) * 100) },
        { stat: "Pace", left: Math.min(100, ((leftStats.pace - 90) / 20) * 100), right: Math.min(100, ((rightStats.pace - 90) / 20) * 100) },
        { stat: "eFG%", left: Math.min(100, (leftStats.fgPct / 65) * 100), right: Math.min(100, (rightStats.fgPct / 65) * 100) },
      ];
    }
  }, [leftStats, rightStats, isPlayerMode, statMode]);

  // H2H record for teams
  const h2hRecord = useMemo(() => {
    if (!isPlayerMode || !leftId || !rightId) return null;
    // Not applicable for players
    return null;
  }, [isPlayerMode, leftId, rightId]);

  const teamH2H = useMemo(() => {
    if (isPlayerMode || !leftId || !rightId) return null;
    // Generate mock H2H
    const seed = (leftId + rightId).length;
    const leftWins = (seed % 3) + 1;
    const rightWins = 4 - leftWins;
    return { left: leftWins, right: rightWins, total: leftWins + rightWins };
  }, [isPlayerMode, leftId, rightId]);

  // Dropdown component
  const renderSelector = (side, selectedId, setId, search, setSearch, open, setOpen) => {
    const selected = items.find((i) => i.id === selectedId);
    const results = filterItems(search);

    return (
      <div style={{ position: "relative", width: "100%" }}>
        {/* Selected or search */}
        <div
          onClick={() => setOpen(!open)}
          style={{
            background: "var(--bg-tertiary)",
            border: `1px solid ${open ? "var(--accent-blue)" : "var(--border-color)"}`,
            borderRadius: 10,
            padding: "12px 16px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
            transition: "border-color 0.2s",
          }}
        >
          {selected ? (
            <>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: selected.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "white", flexShrink: 0 }}>{selected.abbr}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{selected.label}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{selected.sub}</div>
              </div>
              <X size={14} style={{ color: "var(--text-muted)", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setId(null); setSearch(""); }} />
            </>
          ) : (
            <>
              <Search size={16} style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
                onClick={(e) => { e.stopPropagation(); setOpen(true); }}
                placeholder={`Search ${isPlayerMode ? "player" : "team"}...`}
                style={{ background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: 14, flex: 1, fontFamily: "'Inter', sans-serif" }}
              />
            </>
          )}
        </div>

        {/* Dropdown */}
        {open && !selected && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: 10,
              maxHeight: 280,
              overflowY: "auto",
              zIndex: 50,
              boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
            }}
          >
            {results.length === 0 && (
              <div style={{ padding: "16px", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>No results</div>
            )}
            {results.map((item) => (
              <div
                key={item.id}
                onClick={() => { setId(item.id); setOpen(false); setSearch(""); }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", transition: "background 0.15s", borderBottom: "1px solid var(--border-color)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ width: 24, height: 24, borderRadius: 5, background: item.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: "white", flexShrink: 0 }}>{item.abbr}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const ChartTooltipContent = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
          {payload.map((p) => (
            <div key={p.dataKey} style={{ color: p.stroke || p.fill, marginBottom: 2 }}>
              {p.name}: <span style={{ fontWeight: 600 }}>{typeof p.value === "number" ? p.value.toFixed(1) : p.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fade-in" style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px 60px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
          <Layers size={24} style={{ color: "var(--accent-blue)" }} />
          Head-to-Head
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          {/* Mode toggle */}
          <div style={{ display: "flex", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 8, overflow: "hidden" }}>
            {[{ key: "player", label: "Players" }, { key: "team", label: "Teams" }].map((opt) => (
              <button key={opt.key} onClick={() => switchMode(opt.key)} style={{ background: mode === opt.key ? "var(--accent-blue)" : "transparent", border: "none", padding: "8px 18px", color: mode === opt.key ? "white" : "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "all 0.2s" }}>
                {opt.label}
              </button>
            ))}
          </div>
          {/* Stat mode toggle */}
          <div style={{ display: "flex", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 8, overflow: "hidden" }}>
            {[{ key: "perGame", label: "Per Game" }, { key: "per36", label: "Per 36" }, { key: "totals", label: "Totals" }].map((opt) => (
              <button key={opt.key} onClick={() => setStatMode(opt.key)} style={{ background: statMode === opt.key ? "var(--accent-blue)" : "transparent", border: "none", padding: "8px 14px", color: statMode === opt.key ? "white" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "all 0.2s" }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selectors */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 48px 1fr", gap: 0, alignItems: "start", marginBottom: 32 }}>
        {renderSelector("left", leftId, setLeftId, leftSearch, setLeftSearch, leftOpen, setLeftOpen)}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 54 }}>
          <span className="font-display" style={{ fontSize: 18, fontWeight: 800, color: "var(--text-muted)" }}>VS</span>
        </div>
        {renderSelector("right", rightId, setRightId, rightSearch, setRightSearch, rightOpen, setRightOpen)}
      </div>

      {/* Content — only when both sides selected */}
      {leftStats && rightStats ? (
        <>
          {/* Team H2H record */}
          {teamH2H && (
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 16, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 10, padding: "12px 24px" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: leftItem?.color }}>{leftItem?.label.split(" ").pop()}</span>
                <span className="stat-number" style={{ fontSize: 24, fontWeight: 800 }}>
                  <span style={{ color: teamH2H.left > teamH2H.right ? "var(--accent-green)" : "var(--text-secondary)" }}>{teamH2H.left}</span>
                  <span style={{ color: "var(--text-muted)", margin: "0 6px" }}>-</span>
                  <span style={{ color: teamH2H.right > teamH2H.left ? "var(--accent-green)" : "var(--text-secondary)" }}>{teamH2H.right}</span>
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: rightItem?.color }}>{rightItem?.label.split(" ").pop()}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Season Series</span>
              </div>
            </div>
          )}

          {/* Stat Comparison Bars */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
            <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", padding: "20px 24px" }}>
              <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                <BarChart3 size={14} style={{ color: "var(--accent-blue)" }} />
                Stat Comparison
              </h3>
              {statRows.map((row) => {
                const lv = leftStats[row.key] ?? 0;
                const rv = rightStats[row.key] ?? 0;
                const max = Math.max(lv, rv, 1);
                const leftBetter = row.invert ? lv < rv : lv > rv;
                const rightBetter = row.invert ? rv < lv : rv > lv;
                const tied = lv === rv;
                return (
                  <div key={row.key} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span className="stat-number" style={{ fontSize: 14, fontWeight: 700, color: leftBetter && !tied ? "var(--accent-green)" : "var(--text-primary)" }}>{typeof lv === "number" ? (row.pct ? lv.toFixed(1) : Number.isInteger(lv) ? lv : lv.toFixed(1)) : lv}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{row.label}</span>
                      <span className="stat-number" style={{ fontSize: 14, fontWeight: 700, color: rightBetter && !tied ? "var(--accent-green)" : "var(--text-primary)" }}>{typeof rv === "number" ? (row.pct ? rv.toFixed(1) : Number.isInteger(rv) ? rv : rv.toFixed(1)) : rv}</span>
                    </div>
                    {/* Dual bar */}
                    <div style={{ display: "flex", gap: 3, height: 8, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
                        <div style={{ width: `${(lv / max) * 100}%`, height: "100%", borderRadius: "4px 0 0 4px", background: leftBetter && !tied ? (leftItem?.color || "var(--accent-green)") : "var(--bg-hover)", transition: "width 0.4s" }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ width: `${(rv / max) * 100}%`, height: "100%", borderRadius: "0 4px 4px 0", background: rightBetter && !tied ? (rightItem?.color || "var(--accent-green)") : "var(--bg-hover)", transition: "width 0.4s" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Radar Chart Overlay */}
            <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", padding: "20px 24px" }}>
              <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Star size={14} style={{ color: "var(--accent-amber)" }} />
                Profile Overlay
              </h3>
              {/* Legend */}
              <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 8, fontSize: 11, color: "var(--text-muted)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: leftItem?.color || "#e8590c" }} />
                  {leftItem?.label.split(" ").pop()}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: rightItem?.color || "#ef4444" }} />
                  {rightItem?.label.split(" ").pop()}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="stat" tick={{ fill: "#9e8878", fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name={leftItem?.label || "Left"} dataKey="left" stroke={leftItem?.color || "#e8590c"} fill={leftItem?.color || "#e8590c"} fillOpacity={0.2} strokeWidth={2} />
                  <Radar name={rightItem?.label || "Right"} dataKey="right" stroke={rightItem?.color || "#dc2626"} fill={rightItem?.color || "#dc2626"} fillOpacity={0.2} strokeWidth={2} />
                  <Tooltip content={<ChartTooltipContent />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Advantage Summary */}
          <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", padding: "20px 24px" }}>
            <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <TrendingUp size={14} style={{ color: "var(--accent-green)" }} />
              Advantage Summary
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { side: "left", item: leftItem, stats: leftStats },
                { side: "right", item: rightItem, stats: rightStats },
              ].map(({ side, item, stats }) => {
                const other = side === "left" ? rightStats : leftStats;
                const advantages = statRows.filter((r) => {
                  const mine = stats[r.key] ?? 0;
                  const theirs = other[r.key] ?? 0;
                  return r.invert ? mine < theirs : mine > theirs;
                });
                return (
                  <div key={side}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 4, background: item?.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: "white" }}>{item?.abbr}</div>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{item?.label}</span>
                      <span className="stat-number" style={{ fontSize: 13, color: "var(--accent-green)", fontWeight: 700 }}>
                        {advantages.length} advantage{advantages.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {advantages.map((r) => (
                        <span key={r.key} style={{ fontSize: 11, background: `${item?.color}20`, color: item?.color, padding: "3px 10px", borderRadius: 6, fontWeight: 600 }}>
                          {r.label}
                        </span>
                      ))}
                      {advantages.length === 0 && (
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No advantages</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        /* Empty state */
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Layers size={32} style={{ color: "var(--accent-blue)" }} />
          </div>
          <h3 className="font-display" style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Select two {isPlayerMode ? "players" : "teams"} to compare
          </h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 400, margin: "0 auto" }}>
            Use the search dropdowns above to pick a {isPlayerMode ? "player" : "team"} on each side and see how they stack up head-to-head.
          </p>
        </div>
      )}
    </div>
  );
}

// --- Team Browse Page ---
function TeamBrowsePage({ onTeamSelect }) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("conference"); // "conference" | "division"
  const [confTab, setConfTab] = useState("West"); // "West" | "East"
  const [divTab, setDivTab] = useState("Northwest");

  const allTeams = useMemo(() => {
    return Object.entries(TEAMS).map(([abbr, t]) => ({ abbr, ...t }));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return allTeams;
    const q = search.toLowerCase();
    return allTeams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q) ||
        t.abbr.toLowerCase().includes(q) ||
        t.conference.toLowerCase().includes(q) ||
        t.division.toLowerCase().includes(q)
    );
  }, [search, allTeams]);

  const renderCard = (t) => {
    const [w, l] = t.record.split("-").map(Number);
    const pct = (w / (w + l)).toFixed(3).slice(1);
    const hasDetail = !!TEAM_DETAILS[t.abbr];
    return (
      <div
        key={t.abbr}
        className="card-hover"
        onClick={() => onTeamSelect(t.abbr)}
        style={{
          background: "var(--bg-secondary)",
          borderRadius: 14,
          padding: 20,
          cursor: "pointer",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Team color bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${t.color}, ${t.secondaryColor})` }} />

        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <TeamLogo abbr={t.abbr} size={52} style={{ borderRadius: 12, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>
              {t.city} {t.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
              {t.division} · {t.conference}ern
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <span className="stat-number" style={{ fontSize: 16, fontWeight: 700 }}>
                {t.record}
              </span>
              <span className="stat-number" style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {pct}
              </span>
              {hasDetail && (
                <span style={{ fontSize: 9, background: "rgba(59,130,246,0.15)", color: "var(--accent-blue)", padding: "2px 6px", borderRadius: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Full Stats
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderConferenceGrid = (conf) => {
    const teams = filtered.filter((t) => t.conference === conf);
    if (teams.length === 0) return <div style={{ textAlign: "center", padding: "60px 0" }}><p style={{ fontSize: 15, color: "var(--text-secondary)" }}>No teams found.</p></div>;
    return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>{teams.map(renderCard)}</div>;
  };

  const renderDivisionGrid = (div) => {
    const teams = filtered.filter((t) => t.division === div);
    if (teams.length === 0) return <div style={{ textAlign: "center", padding: "60px 0" }}><p style={{ fontSize: 15, color: "var(--text-secondary)" }}>No teams found.</p></div>;
    return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>{teams.map(renderCard)}</div>;
  };

  return (
    <div className="fade-in" style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px 60px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
          <Shield size={24} style={{ color: "var(--accent-blue)" }} />
          Teams
        </h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teams..."
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "8px 14px 8px 36px", color: "var(--text-primary)", fontSize: 13, width: 220, outline: "none", fontFamily: "'Inter', sans-serif", transition: "border-color 0.2s" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent-blue)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border-color)")}
            />
          </div>
          {/* West / East tabs — conference mode only */}
          {viewMode === "conference" && (
            <div style={{ display: "flex", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 8, overflow: "hidden" }}>
              {["West", "East"].map((conf) => (
                <button
                  key={conf}
                  onClick={() => setConfTab(conf)}
                  style={{
                    background: confTab === conf ? "var(--accent-amber)" : "transparent",
                    border: "none",
                    padding: "8px 18px",
                    color: confTab === conf ? "white" : "var(--text-secondary)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Inter', sans-serif",
                    transition: "all 0.2s",
                  }}
                >
                  {conf}
                </button>
              ))}
            </div>
          )}
          {/* Division selector — division mode only */}
          {viewMode === "division" && (
            <div style={{ display: "flex", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 8, overflow: "hidden" }}>
              {["Northwest", "Pacific", "Southwest", "Atlantic", "Central", "Southeast"].map((d) => (
                <button
                  key={d}
                  onClick={() => setDivTab(d)}
                  style={{
                    background: divTab === d ? "var(--accent-amber)" : "transparent",
                    border: "none",
                    padding: "8px 12px",
                    color: divTab === d ? "white" : "var(--text-secondary)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Inter', sans-serif",
                    transition: "all 0.2s",
                    borderRight: "1px solid var(--border-color)",
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
          {/* Conference / Division toggle */}
          <div style={{ display: "flex", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 8, overflow: "hidden" }}>
            {[{ key: "conference", label: "Conference" }, { key: "division", label: "Division" }].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setViewMode(opt.key)}
                style={{
                  background: viewMode === opt.key ? "var(--accent-blue)" : "transparent",
                  border: "none",
                  padding: "8px 16px",
                  color: viewMode === opt.key ? "white" : "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                  transition: "all 0.2s",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      {viewMode === "conference"
        ? renderConferenceGrid(confTab)
        : renderDivisionGrid(divTab)
      }

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>No teams found matching "{search}"</p>
        </div>
      )}
    </div>
  );
}

// --- Team Detail Page ---
function TeamDetailPage({ teamAbbr, onBack }) {
  const liveData = useLiveData();
  const team = TEAMS[teamAbbr];
  const detail = TEAM_DETAILS[teamAbbr];

  if (!team) {
    return (
      <div className="fade-in" style={{ maxWidth: 1400, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: 16 }}>Team not found.</p>
        <button onClick={onBack} style={{ marginTop: 16, background: "var(--accent-blue)", border: "none", borderRadius: 8, padding: "8px 20px", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Back to Teams</button>
      </div>
    );
  }

  const [w, l] = team.record.split("-").map(Number);
  const pct = (w / (w + l)).toFixed(3);

  // Find streak from standings
  const conf = team.conference === "East" ? "East" : "West";
  const standing = liveData.standings[conf].find((s) => s.team === teamAbbr);
  const streak = standing?.streak || "—";
  const confRank = detail?.confRank || (liveData.standings[conf].findIndex((s) => s.team === teamAbbr) + 1);

  const ChartTooltipContent = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--text-primary)" }}>{label}</div>
          {payload.map((p) => (
            <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
              {p.name}: <span style={{ fontWeight: 600 }}>{p.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fade-in" style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 24px 60px" }}>
      <Breadcrumb items={[
        { label: "Home", onClick: () => onBack("home") },
        { label: "Teams", onClick: () => onBack("teams") },
        { label: `${team.city} ${team.name}` },
      ]} />

      {/* ===== TEAM OVERVIEW HEADER ===== */}
      <div style={{ background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border-color)", padding: "28px 32px", marginBottom: 28, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${team.color}, ${team.secondaryColor})` }} />

        <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
          <div style={{ width: 96, height: 96, borderRadius: 20, background: team.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, color: "white", flexShrink: 0 }}>
            {teamAbbr}
          </div>
          <div style={{ flex: 1 }}>
            <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{team.city} {team.name}</h1>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>{team.division} Division · {team.conference}ern Conference</div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {[
                { label: "Record", value: team.record },
                { label: "PCT", value: pct },
                { label: "Conf Rank", value: `#${confRank}` },
                { label: "Streak", value: streak, color: streak.startsWith("W") ? "var(--accent-green)" : streak.startsWith("L") ? "var(--accent-red)" : undefined },
              ].map((s) => (
                <div key={s.label}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>{s.label}</div>
                  <div className="stat-number" style={{ fontSize: 20, fontWeight: 700, color: s.color || "var(--text-primary)" }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {!detail ? (
        /* Fallback for teams without detailed data */
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Shield size={28} style={{ color: "var(--accent-blue)" }} />
          </div>
          <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>Detailed team stats not available yet.</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>Try BOS, OKC, or LAL for full team breakdowns.</p>
        </div>
      ) : (
        <>
          {/* ===== ROSTER TABLE ===== */}
          <div style={{ marginBottom: 28 }}>
            <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={18} style={{ color: "var(--accent-blue)" }} />
              Roster
            </h2>
            <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", overflow: "hidden", overflowX: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 36px 36px 36px 42px 42px 42px 42px 42px 42px 42px 42px", padding: "8px 14px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)", textTransform: "uppercase", letterSpacing: "0.5px", minWidth: 640 }}>
                {["Player", "Pos", "#", "GP", "MPG", "PPG", "RPG", "APG", "SPG", "BPG", "FG%", "3P%"].map((h) => (
                  <span key={h} className={h !== "Player" ? "stat-number" : ""} style={{ textAlign: h === "Player" ? "left" : "center" }}>{h}</span>
                ))}
              </div>
              {detail.roster.map((p, idx) => (
                <div
                  key={p.name}
                  style={{ display: "grid", gridTemplateColumns: "1fr 36px 36px 36px 42px 42px 42px 42px 42px 42px 42px 42px", padding: "9px 14px", fontSize: 12, borderBottom: idx < detail.roster.length - 1 ? "1px solid var(--border-color)" : "none", alignItems: "center", transition: "background 0.15s", minWidth: 640 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: "var(--text-muted)" }}>{p.pos}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: "var(--text-muted)" }}>{p.jersey}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.gp}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.mpg}</span>
                  <span className="stat-number" style={{ textAlign: "center", fontWeight: 700, color: p.ppg >= 20 ? "var(--accent-blue)" : "var(--text-primary)" }}>{p.ppg}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: p.rpg >= 8 ? "var(--accent-amber)" : "var(--text-secondary)" }}>{p.rpg}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: p.apg >= 5 ? "var(--accent-amber)" : "var(--text-secondary)" }}>{p.apg}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.spg}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.bpg}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.fgPct}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: p.tpPct >= 40 ? "var(--accent-green)" : "var(--text-secondary)" }}>{p.tpPct}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ===== STATS DASHBOARD: Ratings Chart + Four Factors ===== */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
            {/* Off/Def Rating Over Time */}
            <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", padding: 20 }}>
              <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                <Activity size={14} style={{ color: "var(--accent-blue)" }} />
                Rating Trend
              </h3>
              <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 10, fontSize: 11, color: "var(--text-muted)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 14, height: 3, borderRadius: 2, background: "var(--accent-green)" }} /> ORtg</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 14, height: 3, borderRadius: 2, background: "var(--accent-red)" }} /> DRtg</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={detail.ratingHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="game" axisLine={false} tickLine={false} tick={{ fill: "#9e8878", fontSize: 9 }} />
                  <YAxis domain={["auto", "auto"]} axisLine={false} tickLine={false} tick={{ fill: "#9e8878", fontSize: 10 }} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="ortg" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} name="ORtg" />
                  <Line type="monotone" dataKey="drtg" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} name="DRtg" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Four Factors + Pace */}
            <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", padding: 20 }}>
              <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                <BarChart3 size={14} style={{ color: "var(--accent-amber)" }} />
                Four Factors & Pace
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "eFG%", value: detail.teamStats.efgPct, desc: "Effective FG% adjusts for 3-pointers being worth more", avg: 53.0 },
                  { label: "TOV%", value: detail.teamStats.tovPct, desc: "Turnover rate — lower is better", avg: 13.0, invert: true },
                  { label: "ORB%", value: detail.teamStats.orbPct, desc: "Offensive rebound percentage", avg: 24.0 },
                  { label: "FT Rate", value: detail.teamStats.ftRate, desc: "Free throw attempts per FGA", avg: 25.0 },
                  { label: "Pace", value: detail.teamStats.pace, desc: "Possessions per 48 minutes", avg: 100.0 },
                  { label: "Net Rtg", value: detail.teamStats.netRtg, desc: "Point differential per 100 possessions", avg: 0 },
                ].map((f) => {
                  const better = f.invert ? f.value < f.avg : f.value > f.avg;
                  return (
                    <div key={f.label} style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: "14px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{f.label}</span>
                        <span className="stat-number" style={{ fontSize: 18, fontWeight: 700, color: better ? "var(--accent-green)" : "var(--accent-red)" }}>{f.value}</span>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.4 }}>{f.desc}</div>
                      {/* Mini bar */}
                      <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: "var(--bg-primary)", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 2, background: better ? "var(--accent-green)" : "var(--accent-red)", width: `${Math.min(100, (f.value / (f.avg * 1.3)) * 100)}%`, transition: "width 0.4s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ===== HOME VS AWAY SPLITS ===== */}
          <div style={{ marginBottom: 28 }}>
            <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Home size={18} style={{ color: "var(--accent-blue)" }} />
              Home vs. Away Splits
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { label: "Home", record: detail.homeRecord, splits: detail.homeSplits },
                { label: "Away", record: detail.awayRecord, splits: detail.awaySplits },
              ].map((s) => (
                <div key={s.label} style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", padding: "20px 24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{s.label}</span>
                    <span className="stat-number" style={{ fontSize: 18, fontWeight: 700, color: "var(--accent-blue)" }}>{s.record}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                    {[
                      { label: "PPG", value: s.splits.ppg },
                      { label: "Opp PPG", value: s.splits.oppPpg },
                      { label: "FG%", value: s.splits.fgPct },
                      { label: "3P%", value: s.splits.tpPct },
                    ].map((stat) => (
                      <div key={stat.label} style={{ textAlign: "center" }}>
                        <div className="stat-number" style={{ fontSize: 16, fontWeight: 700 }}>{stat.value}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ===== SCHEDULE: Last 10 & Next 5 ===== */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Last 10 */}
            <div>
              <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <Calendar size={18} style={{ color: "var(--accent-blue)" }} />
                Last 10 Games
              </h2>
              <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", overflow: "hidden" }}>
                {detail.last10.map((g, idx) => {
                  const opp = TEAMS[g.opp];
                  return (
                    <div
                      key={idx}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: idx < detail.last10.length - 1 ? "1px solid var(--border-color)" : "none", transition: "background 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="stat-number" style={{ fontSize: 11, color: "var(--text-muted)", width: 36 }}>{g.date}</span>
                        <div style={{ width: 20, height: 20, borderRadius: 4, background: opp.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: "white" }}>{g.opp}</div>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{opp.name}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: g.result === "W" ? "var(--accent-green)" : "var(--accent-red)" }}>{g.result}</span>
                        <span className="stat-number" style={{ fontSize: 13, color: "var(--text-secondary)" }}>{g.score}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Next 5 */}
            <div>
              <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <ArrowRight size={18} style={{ color: "var(--accent-amber)" }} />
                Next 5 Games
              </h2>
              <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", overflow: "hidden" }}>
                {detail.next5.map((g, idx) => {
                  const opp = TEAMS[g.opp];
                  return (
                    <div
                      key={idx}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: idx < detail.next5.length - 1 ? "1px solid var(--border-color)" : "none", transition: "background 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="stat-number" style={{ fontSize: 11, color: "var(--text-muted)", width: 36 }}>{g.date}</span>
                        <div style={{ width: 20, height: 20, borderRadius: 4, background: opp.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: "white" }}>{g.opp}</div>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{opp.name}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600, background: g.home ? "rgba(59,130,246,0.12)" : "rgba(245,158,11,0.12)", color: g.home ? "var(--accent-blue)" : "var(--accent-amber)" }}>
                          {g.home ? "HOME" : "AWAY"}
                        </span>
                        <span className="stat-number" style={{ fontSize: 12, color: "var(--text-muted)" }}>{g.time}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --- Game Detail Page ---
function GameDetailPage({ gameId, onBack }) {
  const liveData = useLiveData();
  const game = liveData.scoreboard.find((g) => g.id === gameId);
  const mockDetail = mockData.gameDetails[gameId];
  const [liveBoxScore, setLiveBoxScore] = useState(null);
  const [boxScoreLoading, setBoxScoreLoading] = useState(false);

  // Fetch live box score from NBA API when no mock detail exists
  useEffect(() => {
    if (!game || mockDetail || !liveData.isLive) return;
    if (game.status === "UPCOMING") return;
    let cancelled = false;
    setBoxScoreLoading(true);
    // Always bust the in-memory + localStorage cache so we never show stale
    // empty-player data that was cached while the game was still live.
    clearEndpointCache("boxscoretraditionalv3");
    fetchBoxScore(gameId)
      .then((data) => { if (!cancelled && data) setLiveBoxScore(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setBoxScoreLoading(false); });
    return () => { cancelled = true; };
  }, [gameId, game?.status, liveData.isLive, mockDetail]);

  const detail = mockDetail || liveBoxScore;

  if (!game) {
    return (
      <div className="fade-in" style={{ maxWidth: 1400, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: 16 }}>Game not found.</p>
        <button onClick={onBack} style={{ marginTop: 16, background: "var(--accent-blue)", border: "none", borderRadius: 8, padding: "8px 20px", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
          Back to Home
        </button>
      </div>
    );
  }

  const homeTeam = TEAMS[game.homeTeam];
  const awayTeam = TEAMS[game.awayTeam];
  const isLive = game.status === "LIVE";
  const isFinal = game.status === "FINAL";
  const hasDetail = !!detail;

  // Use tricodes from box score response (may differ from scoreboard tricodes)
  const homeKey = detail?.homeTricode || game.homeTeam;
  const awayKey = detail?.awayTricode || game.awayTeam;
  const homeStats = detail?.teamStats?.[homeKey];
  const awayStats = detail?.teamStats?.[awayKey];

  // Cumulative score line chart — built from per-period scores in the scoreboard data
  const PERIOD_LABELS = ["Q1", "Q2", "Q3", "Q4", "OT1", "OT2", "OT3"];
  const periodChartData = useMemo(() => {
    const hp = game.homePeriods || [];
    const ap = game.awayPeriods || [];
    if (!hp.length && !ap.length) return [];
    const len = Math.max(hp.length, ap.length);
    let homeRunning = 0, awayRunning = 0;
    // Start at 0 before Q1, then accumulate each period
    const points = [{ q: "Start", home: 0, away: 0 }];
    for (let i = 0; i < len; i++) {
      homeRunning += hp[i] ?? 0;
      awayRunning += ap[i] ?? 0;
      points.push({ q: PERIOD_LABELS[i] || `P${i + 1}`, home: homeRunning, away: awayRunning });
    }
    return points;
  }, [game.homePeriods, game.awayPeriods]);

  const boxScoreCols = [
    { key: "name", label: "Player", width: "1fr", align: "left" },
    { key: "pos", label: "Pos", width: 36, align: "center" },
    { key: "min", label: "Min", width: 46, align: "center" },
    { key: "pts", label: "PTS", width: 36, align: "center" },
    { key: "reb", label: "REB", width: 36, align: "center" },
    { key: "ast", label: "AST", width: 36, align: "center" },
    { key: "stl", label: "STL", width: 36, align: "center" },
    { key: "blk", label: "BLK", width: 36, align: "center" },
    { key: "fg", label: "FG", width: 48, align: "center" },
    { key: "tp", label: "3P", width: 48, align: "center" },
    { key: "ft", label: "FT", width: 42, align: "center" },
    { key: "to", label: "TO", width: 32, align: "center" },
    { key: "pf", label: "PF", width: 32, align: "center" },
    { key: "plusMinus", label: "+/-", width: 40, align: "center" },
  ];

  const boxGridTemplate = boxScoreCols
    .map((c) => (typeof c.width === "number" ? `${c.width}px` : c.width))
    .join(" ");

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--text-primary)" }}>{label}</div>
        {payload.map((p) => {
          const color = p.stroke || p.fill;
          const teamAbbr = p.dataKey === "home" ? game.homeTeam : game.awayTeam;
          const teamObj = TEAMS[teamAbbr];
          return (
            <div key={p.dataKey} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <div style={{ width: 20, height: 3, borderRadius: 2, background: color }} />
              <span style={{ color: "var(--text-secondary)" }}>
                {teamObj ? `${teamObj.city} ${teamObj.name}` : teamAbbr}:{" "}
                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{p.value}</span>
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderBoxScore = (teamAbbr, players) => {
    if (!players || players.length === 0) return null;
    const team = TEAMS[teamAbbr];
    return (
      <div style={{ marginBottom: 28 }}>
        <h3
          className="font-display"
          style={{
            fontSize: 15,
            fontWeight: 700,
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <TeamLogo abbr={teamAbbr} size={22} />
          {team.city} {team.name}
        </h3>
        <div
          style={{
            background: "var(--bg-secondary)",
            borderRadius: 10,
            border: "1px solid var(--border-color)",
            overflow: "hidden",
            overflowX: "auto",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: boxGridTemplate,
              padding: "8px 14px",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              borderBottom: "1px solid var(--border-color)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              minWidth: 700,
            }}
          >
            {boxScoreCols.map((col) => (
              <span
                key={col.key}
                className={col.key !== "name" ? "stat-number" : ""}
                style={{ textAlign: col.align }}
              >
                {col.label}
              </span>
            ))}
          </div>
          {/* Rows */}
          {players.map((p, idx) => {
            const pm = parseInt(p.plusMinus);
            return (
              <div
                key={p.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: boxGridTemplate,
                  padding: "8px 14px",
                  fontSize: 12,
                  borderBottom: idx < players.length - 1 ? "1px solid var(--border-color)" : "none",
                  alignItems: "center",
                  transition: "background 0.15s",
                  minWidth: 700,
                  background: idx < 5 ? "transparent" : "rgba(255,255,255,0.01)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = idx < 5 ? "transparent" : "rgba(255,255,255,0.01)")}
              >
                <span style={{ fontWeight: idx < 5 ? 600 : 400, fontSize: 13 }}>{p.name}</span>
                <span className="stat-number" style={{ textAlign: "center", color: "var(--text-muted)" }}>{p.pos}</span>
                <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.min}</span>
                <span className="stat-number" style={{ textAlign: "center", fontWeight: 700, color: p.pts >= 20 ? "var(--accent-blue)" : "var(--text-primary)" }}>{p.pts}</span>
                <span className="stat-number" style={{ textAlign: "center", color: p.reb >= 10 ? "var(--accent-amber)" : "var(--text-secondary)" }}>{p.reb}</span>
                <span className="stat-number" style={{ textAlign: "center", color: p.ast >= 8 ? "var(--accent-amber)" : "var(--text-secondary)" }}>{p.ast}</span>
                <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.stl}</span>
                <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.blk}</span>
                <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.fgm}-{p.fga}</span>
                <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.tpm}-{p.tpa}</span>
                <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.ftm}-{p.fta}</span>
                <span className="stat-number" style={{ textAlign: "center", color: p.to >= 4 ? "var(--accent-red)" : "var(--text-muted)" }}>{p.to}</span>
                <span className="stat-number" style={{ textAlign: "center", color: p.pf >= 4 ? "var(--accent-red)" : "var(--text-muted)" }}>{p.pf}</span>
                <span className="stat-number" style={{ textAlign: "center", fontWeight: 600, color: pm > 0 ? "var(--accent-green)" : pm < 0 ? "var(--accent-red)" : "var(--text-secondary)" }}>{p.plusMinus}</span>
              </div>
            );
          })}
          {/* Team totals */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: boxGridTemplate,
              padding: "10px 14px",
              fontSize: 12,
              borderTop: "2px solid var(--border-hover)",
              background: "var(--bg-tertiary)",
              fontWeight: 700,
              minWidth: 700,
            }}
          >
            <span style={{ fontSize: 13 }}>TOTALS</span>
            <span />
            <span />
            <span className="stat-number" style={{ textAlign: "center" }}>{players.reduce((s, p) => s + p.pts, 0)}</span>
            <span className="stat-number" style={{ textAlign: "center" }}>{players.reduce((s, p) => s + p.reb, 0)}</span>
            <span className="stat-number" style={{ textAlign: "center" }}>{players.reduce((s, p) => s + p.ast, 0)}</span>
            <span className="stat-number" style={{ textAlign: "center" }}>{players.reduce((s, p) => s + p.stl, 0)}</span>
            <span className="stat-number" style={{ textAlign: "center" }}>{players.reduce((s, p) => s + p.blk, 0)}</span>
            <span className="stat-number" style={{ textAlign: "center" }}>{players.reduce((s, p) => s + p.fgm, 0)}-{players.reduce((s, p) => s + p.fga, 0)}</span>
            <span className="stat-number" style={{ textAlign: "center" }}>{players.reduce((s, p) => s + p.tpm, 0)}-{players.reduce((s, p) => s + p.tpa, 0)}</span>
            <span className="stat-number" style={{ textAlign: "center" }}>{players.reduce((s, p) => s + p.ftm, 0)}-{players.reduce((s, p) => s + p.fta, 0)}</span>
            <span className="stat-number" style={{ textAlign: "center" }}>{players.reduce((s, p) => s + p.to, 0)}</span>
            <span className="stat-number" style={{ textAlign: "center" }}>{players.reduce((s, p) => s + p.pf, 0)}</span>
            <span />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in" style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 24px 60px" }}>
      <Breadcrumb items={[
        { label: "Home", onClick: () => onBack("home") },
        { label: `${awayTeam.name} vs ${homeTeam.name}` },
      ]} />

      {/* Scoreboard Header */}
      <div
        style={{
          background: "var(--bg-secondary)",
          borderRadius: 16,
          border: "1px solid var(--border-color)",
          padding: "28px 32px",
          marginBottom: 28,
        }}
      >
        {/* Status */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          {isLive ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(239, 68, 68, 0.15)", padding: "5px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "var(--accent-red)" }}>
              <div className="live-pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent-red)" }} />
              Q{game.quarter} — {game.timeRemaining}
            </span>
          ) : isFinal ? (
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", background: "var(--bg-tertiary)", padding: "5px 14px", borderRadius: 8 }}>Final</span>
          ) : (
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-blue)", background: "rgba(59, 130, 246, 0.1)", padding: "5px 14px", borderRadius: 8 }}>{game.scheduledTime}</span>
          )}
        </div>

        {/* Teams & Score */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 48 }}>
          {/* Away */}
          <div style={{ textAlign: "center", minWidth: 160 }}>
            <div style={{ margin: "0 auto 10px", width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TeamLogo abbr={game.awayTeam} size={56} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{awayTeam?.city}</div>
            <div style={{ fontSize: 15, color: "var(--text-secondary)" }}>{awayTeam?.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{awayTeam?.record}</div>
          </div>
          {/* Score */}
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <span className="stat-number" style={{ fontSize: 48, fontWeight: 800, color: game.awayScore >= game.homeScore ? "var(--text-primary)" : "var(--text-secondary)" }}>
                {game.status !== "UPCOMING" ? game.awayScore : "-"}
              </span>
              <span style={{ fontSize: 24, color: "var(--text-muted)", fontWeight: 300 }}>—</span>
              <span className="stat-number" style={{ fontSize: 48, fontWeight: 800, color: game.homeScore >= game.awayScore ? "var(--text-primary)" : "var(--text-secondary)" }}>
                {game.status !== "UPCOMING" ? game.homeScore : "-"}
              </span>
            </div>
            {game.broadcast && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{game.broadcast}</div>
            )}
          </div>
          {/* Home */}
          <div style={{ textAlign: "center", minWidth: 160 }}>
            <div style={{ margin: "0 auto 10px", width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TeamLogo abbr={game.homeTeam} size={56} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{homeTeam?.city}</div>
            <div style={{ fontSize: 15, color: "var(--text-secondary)" }}>{homeTeam?.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{homeTeam?.record}</div>
          </div>
        </div>

        {/* Quarter-by-Quarter */}
        {game.quarterScores && (
          <div style={{ marginTop: 24 }}>
            <table style={{ width: "100%", maxWidth: 480, margin: "0 auto", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--text-muted)" }}>
                  <th style={{ textAlign: "left", fontWeight: 500, padding: "6px 0" }}>Team</th>
                  {game.quarterScores.home.map((_, i) => (
                    <th key={i} className="stat-number" style={{ textAlign: "center", fontWeight: 500, padding: "6px 8px" }}>Q{i + 1}</th>
                  ))}
                  <th className="stat-number" style={{ textAlign: "center", fontWeight: 700, padding: "6px 8px", borderLeft: "1px solid var(--border-color)" }}>T</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderTop: "1px solid var(--border-color)" }}>
                  <td style={{ fontWeight: 600, padding: "8px 0", display: "flex", alignItems: "center", gap: 6 }}>
                    <TeamLogo abbr={game.awayTeam} size={18} />
                    {awayTeam?.name}
                  </td>
                  {game.quarterScores.away.map((s, i) => (
                    <td key={i} className="stat-number" style={{ textAlign: "center", padding: "8px 8px", color: s > game.quarterScores.home[i] ? "var(--text-primary)" : "var(--text-muted)" }}>{s}</td>
                  ))}
                  <td className="stat-number" style={{ textAlign: "center", fontWeight: 700, padding: "8px 8px", borderLeft: "1px solid var(--border-color)" }}>{game.awayScore}</td>
                </tr>
                <tr style={{ borderTop: "1px solid var(--border-color)" }}>
                  <td style={{ fontWeight: 600, padding: "8px 0", display: "flex", alignItems: "center", gap: 6 }}>
                    <TeamLogo abbr={game.homeTeam} size={18} />
                    {homeTeam?.name}
                  </td>
                  {game.quarterScores.home.map((s, i) => (
                    <td key={i} className="stat-number" style={{ textAlign: "center", padding: "8px 8px", color: s > game.quarterScores.away[i] ? "var(--text-primary)" : "var(--text-muted)" }}>{s}</td>
                  ))}
                  <td className="stat-number" style={{ textAlign: "center", fontWeight: 700, padding: "8px 8px", borderLeft: "1px solid var(--border-color)" }}>{game.homeScore}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Performers */}
      {game.topPerformers && (
        <div style={{ marginBottom: 28 }}>
          <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <Star size={18} style={{ color: "var(--accent-amber)" }} />
            Top Performers
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { side: "away", teamAbbr: game.awayTeam },
              { side: "home", teamAbbr: game.homeTeam },
            ].map(({ side, teamAbbr }) => {
              const p = game.topPerformers[side];
              const team = TEAMS[teamAbbr];
              return (
                <div
                  key={side}
                  style={{
                    background: "var(--bg-secondary)",
                    borderRadius: 12,
                    border: "1px solid var(--border-color)",
                    padding: "20px 24px",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <TeamLogo abbr={teamAbbr} size={48} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{team.city} {team.name}</div>
                    <div style={{ display: "flex", gap: 16 }}>
                      <div style={{ textAlign: "center" }}>
                        <div className="stat-number" style={{ fontSize: 20, fontWeight: 700, color: "var(--accent-blue)" }}>{p.pts}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>PTS</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div className="stat-number" style={{ fontSize: 20, fontWeight: 700 }}>{p.reb}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>REB</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div className="stat-number" style={{ fontSize: 20, fontWeight: 700 }}>{p.ast}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>AST</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Score Progression Line Chart */}
      {periodChartData.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <BarChart3 size={18} style={{ color: "var(--accent-blue)" }} />
            Score Progression
          </h2>
          <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", padding: "24px 20px" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                <div style={{ width: 24, height: 3, borderRadius: 2, background: homeTeam?.color }} />
                {homeTeam?.city} {homeTeam?.name} (Home)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                <div style={{ width: 24, height: 3, borderRadius: 2, background: awayTeam?.color }} />
                {awayTeam?.city} {awayTeam?.name} (Away)
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={periodChartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="q" axisLine={false} tickLine={false} tick={{ fill: "#9e8878", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9e8878", fontSize: 11 }} domain={["auto", "auto"]} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="home" name="home" stroke={homeTeam?.color} strokeWidth={2.5} dot={{ r: 5, fill: homeTeam?.color, strokeWidth: 0 }} activeDot={{ r: 7 }} />
                <Line type="monotone" dataKey="away" name="away" stroke={awayTeam?.color} strokeWidth={2.5} dot={{ r: 5, fill: awayTeam?.color, strokeWidth: 0 }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Box Scores */}
      {hasDetail && (
        <div>
          <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <Layers size={18} style={{ color: "var(--accent-blue)" }} />
            Box Score
          </h2>
          {renderBoxScore(game.awayTeam, detail.boxScore?.[awayKey])}
          {renderBoxScore(game.homeTeam, detail.boxScore?.[homeKey])}
        </div>
      )}

      {/* Loading / fallback for games without detailed data */}
      {!hasDetail && game.status !== "UPCOMING" && (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <BarChart3 size={28} style={{ color: "var(--accent-blue)" }} />
          </div>
          {boxScoreLoading ? (
            <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>Loading box score…</p>
          ) : (
            <>
              <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>Box score data not available for this game.</p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>Data may not yet be available from the NBA API.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// --- Standings Page ---
function StandingsPage() {
  const TOTAL_GAMES = 82;
  const liveData = useLiveData();
  const [viewMode, setViewMode] = useState("conference"); // "conference" | "division"
  const [confTab, setConfTab] = useState("West"); // "East" | "West"
  const [divTab, setDivTab] = useState("Atlantic"); // one of the 6 divisions
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === "desc") return { key, direction: "asc" };
        if (prev.direction === "asc") return { key: null, direction: null };
      }
      return { key, direction: "desc" };
    });
  };

  const sortTeams = (teams) => {
    if (!sortConfig.key) return teams;
    return [...teams].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      // Parse string numbers
      if (typeof aVal === "string" && !isNaN(parseFloat(aVal))) aVal = parseFloat(aVal);
      if (typeof bVal === "string" && !isNaN(parseFloat(bVal))) bVal = parseFloat(bVal);
      // Handle gb "-" as 0
      if (sortConfig.key === "gb") {
        aVal = aVal === "-" ? 0 : parseFloat(aVal);
        bVal = bVal === "-" ? 0 : parseFloat(bVal);
      }
      // Handle home/away records like "24-4"
      if (sortConfig.key === "home" || sortConfig.key === "away") {
        aVal = parseInt(String(a[sortConfig.key]).split("-")[0]);
        bVal = parseInt(String(b[sortConfig.key]).split("-")[0]);
      }
      // Handle diff strings like "+9.8"
      if (sortConfig.key === "diff") {
        aVal = parseFloat(aVal);
        bVal = parseFloat(bVal);
      }
      // Handle pace (computed)
      if (sortConfig.key === "pace") {
        aVal = Math.round((a.wins / (a.wins + a.losses)) * TOTAL_GAMES);
        bVal = Math.round((b.wins / (b.wins + b.losses)) * TOTAL_GAMES);
      }
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  };

  const SortIcon = ({ colKey }) => {
    if (sortConfig.key !== colKey) return null;
    return sortConfig.direction === "desc" ? (
      <ChevronDown size={12} style={{ marginLeft: 2, opacity: 0.8 }} />
    ) : (
      <ChevronUp size={12} style={{ marginLeft: 2, opacity: 0.8 }} />
    );
  };

  const columns = [
    { key: "rank", label: "#", width: 32, align: "center" },
    { key: "team", label: "Team", width: "1fr", align: "left" },
    { key: "wins", label: "W", width: 38, align: "center" },
    { key: "losses", label: "L", width: 38, align: "center" },
    { key: "pct", label: "PCT", width: 50, align: "center" },
    { key: "gb", label: "GB", width: 42, align: "center" },
    { key: "home", label: "Home", width: 50, align: "center" },
    { key: "away", label: "Away", width: 50, align: "center" },
    { key: "streak", label: "Strk", width: 44, align: "center" },
    { key: "last10", label: "L10", width: 44, align: "center" },
    { key: "ppg", label: "PPG", width: 48, align: "center" },
    { key: "oppPpg", label: "OPP", width: 48, align: "center" },
    { key: "diff", label: "DIFF", width: 50, align: "center" },
    { key: "pace", label: "Pace", width: 46, align: "center" },
  ];

  const gridTemplate = columns
    .map((c) => (typeof c.width === "number" ? `${c.width}px` : c.width))
    .join(" ");

  const renderConferenceTable = (conference, teams) => {
    const sorted = sortTeams(teams);
    return (
      <div key={conference} style={{ marginBottom: 32 }}>
        <h3
          className="font-display"
          style={{
            fontSize: 17,
            fontWeight: 700,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--text-primary)",
          }}
        >
          <Trophy size={16} style={{ color: "var(--accent-amber)" }} />
          {conference}ern Conference
        </h3>
        <div
          style={{
            background: "var(--bg-secondary)",
            borderRadius: 12,
            border: "1px solid var(--border-color)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: gridTemplate,
              padding: "10px 16px",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              borderBottom: "1px solid var(--border-color)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              userSelect: "none",
            }}
          >
            {columns.map((col) => (
              <span
                key={col.key}
                className={col.key !== "team" ? "stat-number" : ""}
                onClick={() => col.key !== "rank" && handleSort(col.key === "team" ? "wins" : col.key)}
                style={{
                  textAlign: col.align,
                  cursor: col.key !== "rank" ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: col.align === "left" ? "flex-start" : "center",
                  transition: "color 0.15s",
                  color:
                    sortConfig.key === col.key || (col.key === "team" && sortConfig.key === "wins")
                      ? "var(--accent-blue)"
                      : undefined,
                }}
              >
                {col.label}
                <SortIcon colKey={col.key === "team" ? "wins" : col.key} />
              </span>
            ))}
          </div>
          {/* Rows */}
          {sorted.map((row, idx) => {
            const team = TEAMS[row.team] || { name: row.team, city: row.team, color: "#555", division: "" };
            const streak = row.streak || "—";
            const gamesPlayed = row.wins + row.losses;
            const winPace = gamesPlayed > 0 ? Math.round((row.wins / gamesPlayed) * TOTAL_GAMES) : 0;
            const isPlayoffLine = idx === 5; // after 6th seed
            const isPlayInLine = idx === 9; // after 10th seed
            const isStreakHot =
              streak.startsWith("W") && parseInt(streak.slice(1)) >= 3;
            const isStreakCold =
              streak.startsWith("L") && parseInt(streak.slice(1)) >= 3;
            const diffNum = parseFloat(row.diff);

            return (
              <React.Fragment key={row.team}>
                {isPlayoffLine && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "4px 16px",
                      background: "rgba(59, 130, 246, 0.06)",
                      borderTop: "1px dashed rgba(59, 130, 246, 0.3)",
                      borderBottom: "1px dashed rgba(59, 130, 246, 0.3)",
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--accent-blue)",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--accent-blue)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Playoff Auto-Qualify Above — Play-In Below
                    </span>
                  </div>
                )}
                {isPlayInLine && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "4px 16px",
                      background: "rgba(239, 68, 68, 0.06)",
                      borderTop: "1px dashed rgba(239, 68, 68, 0.3)",
                      borderBottom: "1px dashed rgba(239, 68, 68, 0.3)",
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--accent-red)",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--accent-red)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Play-In Above — Lottery Below
                    </span>
                  </div>
                )}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: gridTemplate,
                    padding: "10px 16px",
                    fontSize: 13,
                    borderBottom:
                      idx < sorted.length - 1
                        ? "1px solid var(--border-color)"
                        : "none",
                    alignItems: "center",
                    transition: "background 0.15s",
                    cursor: "default",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  {/* Rank */}
                  <span
                    className="stat-number"
                    style={{
                      textAlign: "center",
                      color: "var(--text-muted)",
                      fontSize: 12,
                    }}
                  >
                    {idx + 1}
                  </span>
                  {/* Team */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <TeamLogo abbr={row.team} size={24} />
                    <span style={{ fontWeight: 500, fontSize: 13 }}>
                      {team.city} {team.name}
                    </span>
                    {isStreakHot && (
                      <Flame size={12} style={{ color: "var(--accent-amber)", flexShrink: 0 }} />
                    )}
                  </div>
                  {/* W */}
                  <span
                    className="stat-number"
                    style={{
                      textAlign: "center",
                      fontWeight: 600,
                      color: "var(--accent-green)",
                    }}
                  >
                    {row.wins}
                  </span>
                  {/* L */}
                  <span
                    className="stat-number"
                    style={{
                      textAlign: "center",
                      fontWeight: 600,
                      color: "var(--accent-red)",
                    }}
                  >
                    {row.losses}
                  </span>
                  {/* PCT */}
                  <span
                    className="stat-number"
                    style={{
                      textAlign: "center",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {row.pct}
                  </span>
                  {/* GB */}
                  <span
                    className="stat-number"
                    style={{
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    {row.gb}
                  </span>
                  {/* Home */}
                  <span
                    className="stat-number"
                    style={{
                      textAlign: "center",
                      color: "var(--text-secondary)",
                      fontSize: 12,
                    }}
                  >
                    {row.home}
                  </span>
                  {/* Away */}
                  <span
                    className="stat-number"
                    style={{
                      textAlign: "center",
                      color: "var(--text-secondary)",
                      fontSize: 12,
                    }}
                  >
                    {row.away}
                  </span>
                  {/* Streak */}
                  <span
                    className="stat-number"
                    style={{
                      textAlign: "center",
                      fontWeight: 600,
                      fontSize: 12,
                      color: isStreakHot
                        ? "var(--accent-green)"
                        : isStreakCold
                        ? "var(--accent-red)"
                        : "var(--text-secondary)",
                    }}
                  >
                    {row.streak}
                  </span>
                  {/* L10 */}
                  <span
                    className="stat-number"
                    style={{
                      textAlign: "center",
                      color: "var(--text-secondary)",
                      fontSize: 12,
                    }}
                  >
                    {row.last10}
                  </span>
                  {/* PPG */}
                  <span
                    className="stat-number"
                    style={{
                      textAlign: "center",
                      color: "var(--text-secondary)",
                      fontSize: 12,
                    }}
                  >
                    {row.ppg.toFixed(1)}
                  </span>
                  {/* OPP PPG */}
                  <span
                    className="stat-number"
                    style={{
                      textAlign: "center",
                      color: "var(--text-secondary)",
                      fontSize: 12,
                    }}
                  >
                    {row.oppPpg.toFixed(1)}
                  </span>
                  {/* DIFF */}
                  <span
                    className="stat-number"
                    style={{
                      textAlign: "center",
                      fontWeight: 600,
                      fontSize: 12,
                      color:
                        diffNum > 0
                          ? "var(--accent-green)"
                          : diffNum < 0
                          ? "var(--accent-red)"
                          : "var(--text-secondary)",
                    }}
                  >
                    {row.diff}
                  </span>
                  {/* Pace */}
                  <span
                    className="stat-number"
                    style={{
                      textAlign: "center",
                      fontWeight: 600,
                      fontSize: 12,
                      color:
                        winPace >= 50
                          ? "var(--accent-blue)"
                          : "var(--text-muted)",
                    }}
                  >
                    {winPace}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDivisionView = () => {
    const divisions = {};
    // Group all standings rows by division
    ["East", "West"].forEach((conf) => {
      liveData.standings[conf].forEach((row) => {
        const div = TEAMS[row.team]?.division || "Unknown";
        if (!divisions[div]) divisions[div] = [];
        divisions[div].push(row);
      });
    });

    const teams = sortTeams(divisions[divTab] || []);
    const div = divTab;
    // Render only the selected division
    return (
      <div key={div} style={{ marginBottom: 24 }}>
          <h3
            className="font-display"
            style={{
              fontSize: 15,
              fontWeight: 700,
              marginBottom: 10,
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Shield size={14} style={{ color: "var(--accent-blue)" }} />
            {div} Division
          </h3>
          <div
            style={{
              background: "var(--bg-secondary)",
              borderRadius: 10,
              border: "1px solid var(--border-color)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: gridTemplate,
                padding: "8px 16px",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                borderBottom: "1px solid var(--border-color)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                userSelect: "none",
              }}
            >
              {columns.map((col) => (
                <span
                  key={col.key}
                  className={col.key !== "team" ? "stat-number" : ""}
                  onClick={() =>
                    col.key !== "rank" &&
                    handleSort(col.key === "team" ? "wins" : col.key)
                  }
                  style={{
                    textAlign: col.align,
                    cursor: col.key !== "rank" ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      col.align === "left" ? "flex-start" : "center",
                    color:
                      sortConfig.key === col.key ||
                      (col.key === "team" && sortConfig.key === "wins")
                        ? "var(--accent-blue)"
                        : undefined,
                  }}
                >
                  {col.label}
                  <SortIcon colKey={col.key === "team" ? "wins" : col.key} />
                </span>
              ))}
            </div>
            {/* Rows */}
            {teams.map((row, idx) => {
              const team = TEAMS[row.team] || { name: row.team, city: row.team, color: "#555", division: "" };
              const streak = row.streak || "—";
              const gamesPlayed = row.wins + row.losses;
              const winPace = gamesPlayed > 0 ? Math.round(
                (row.wins / gamesPlayed) * TOTAL_GAMES
              ) : 0;
              const isStreakHot =
                streak.startsWith("W") &&
                parseInt(streak.slice(1)) >= 3;
              const isStreakCold =
                streak.startsWith("L") &&
                parseInt(streak.slice(1)) >= 3;
              const diffNum = parseFloat(row.diff);

              return (
                <div
                  key={row.team}
                  style={{
                    display: "grid",
                    gridTemplateColumns: gridTemplate,
                    padding: "9px 16px",
                    fontSize: 13,
                    borderBottom:
                      idx < teams.length - 1
                        ? "1px solid var(--border-color)"
                        : "none",
                    alignItems: "center",
                    transition: "background 0.15s",
                    cursor: "default",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <span
                    className="stat-number"
                    style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}
                  >
                    {idx + 1}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <TeamLogo abbr={row.team} size={24} />
                    <span style={{ fontWeight: 500, fontSize: 13 }}>
                      {team.city} {team.name}
                    </span>
                    {isStreakHot && (
                      <Flame size={12} style={{ color: "var(--accent-amber)", flexShrink: 0 }} />
                    )}
                  </div>
                  <span className="stat-number" style={{ textAlign: "center", fontWeight: 600, color: "var(--accent-green)" }}>{row.wins}</span>
                  <span className="stat-number" style={{ textAlign: "center", fontWeight: 600, color: "var(--accent-red)" }}>{row.losses}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{row.pct}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: "var(--text-muted)" }}>{row.gb}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>{row.home}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>{row.away}</span>
                  <span className="stat-number" style={{ textAlign: "center", fontWeight: 600, fontSize: 12, color: isStreakHot ? "var(--accent-green)" : isStreakCold ? "var(--accent-red)" : "var(--text-secondary)" }}>{row.streak}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>{row.last10}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>{row.ppg.toFixed(1)}</span>
                  <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>{row.oppPpg.toFixed(1)}</span>
                  <span className="stat-number" style={{ textAlign: "center", fontWeight: 600, fontSize: 12, color: diffNum > 0 ? "var(--accent-green)" : diffNum < 0 ? "var(--accent-red)" : "var(--text-secondary)" }}>{row.diff}</span>
                  <span className="stat-number" style={{ textAlign: "center", fontWeight: 600, fontSize: 12, color: winPace >= 50 ? "var(--accent-blue)" : "var(--text-muted)" }}>{winPace}</span>
                </div>
              );
            })}
          </div>
        </div>
    );
  };

  return (
    <div
      className="fade-in"
      style={{
        maxWidth: 1400,
        margin: "0 auto",
        padding: "32px 24px 60px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h1
          className="font-display"
          style={{
            fontSize: 28,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Trophy size={24} style={{ color: "var(--accent-amber)" }} />
          Standings
        </h1>
        {/* View Toggles */}
        <div style={{ display: "flex", gap: 8 }}>
          {/* East / West — only visible in conference mode */}
          {viewMode === "conference" && (
            <div style={{ display: "flex", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 8, overflow: "hidden" }}>
              {["West", "East"].map((conf) => (
                <button
                  key={conf}
                  onClick={() => setConfTab(conf)}
                  style={{
                    background: confTab === conf ? "var(--accent-amber)" : "transparent",
                    border: "none",
                    padding: "8px 18px",
                    color: confTab === conf ? "white" : "var(--text-secondary)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Inter', sans-serif",
                    transition: "all 0.2s",
                  }}
                >
                  {conf}
                </button>
              ))}
            </div>
          )}
          {/* Division selector — only visible in division mode */}
          {viewMode === "division" && (
            <div style={{ display: "flex", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 8, overflow: "hidden" }}>
              {["Atlantic", "Central", "Southeast", "Northwest", "Pacific", "Southwest"].map((d) => (
                <button
                  key={d}
                  onClick={() => setDivTab(d)}
                  style={{
                    background: divTab === d ? "var(--accent-amber)" : "transparent",
                    border: "none",
                    padding: "8px 14px",
                    color: divTab === d ? "white" : "var(--text-secondary)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Inter', sans-serif",
                    transition: "all 0.2s",
                    borderRight: "1px solid var(--border-color)",
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
          {/* Conference / Division */}
          <div style={{ display: "flex", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 8, overflow: "hidden" }}>
            {[
              { key: "conference", label: "Conference" },
              { key: "division", label: "Division" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  setViewMode(opt.key);
                  setSortConfig({ key: null, direction: null });
                }}
                style={{
                  background: viewMode === opt.key ? "var(--accent-blue)" : "transparent",
                  border: "none",
                  padding: "8px 20px",
                  color: viewMode === opt.key ? "white" : "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                  transition: "all 0.2s",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sort hint */}
      <p
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          marginBottom: 20,
        }}
      >
        Click any column header to sort. Click again to reverse. Click a third time to reset.
      </p>

      {/* Tables */}
      {viewMode === "conference" ? (
        renderConferenceTable(confTab, liveData.standings[confTab])
      ) : (
        renderDivisionView()
      )}
    </div>
  );
}

// --- Home Page ---
function HomePage({ onGameClick, onPlayerClick, onNavigate }) {
  const liveData = useLiveData();
  const sortedGames = useMemo(() => {
    const order = { LIVE: 0, FINAL: 1, UPCOMING: 2 };
    return [...liveData.scoreboard].sort(
      (a, b) => order[a.status] - order[b.status]
    );
  }, [liveData.scoreboard]);

  return (
    <div className="fade-in" style={{ paddingBottom: 40 }}>
      {/* News Ticker */}
      <NewsTicker headlines={mockData.headlines || []} />

      {/* Scoreboard Ticker */}
      <div style={{ padding: "24px 0" }}>
        <ScoreboardTicker games={sortedGames} onGameClick={onGameClick} />
      </div>

      {/* Main Content */}
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0 24px",
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 24,
        }}
      >
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {/* Today's Games */}
          <section>
            <h2
              className="font-display"
              style={{
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Calendar size={18} style={{ color: "var(--accent-blue)" }} />
              Today's Games
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 12,
              }}
            >
              {sortedGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  onClick={() => onGameClick(game.id)}
                />
              ))}
            </div>
          </section>

        </div>

        {/* Right Column — League Leaders */}
        <div>
          <LeagueLeaders
            data={liveData.leagueLeaders}
            onPlayerClick={onPlayerClick}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// LIVE DATA LAYER — fetches from NBA API, falls back to mock data
// ============================================================================

const LiveDataContext = createContext(null);

function useLiveData() {
  return useContext(LiveDataContext);
}

function LiveDataProvider({ children }) {
  const [liveStandings, setLiveStandings] = useState(null);
  const [liveLeaders, setLiveLeaders] = useState(null);
  const [livePlayers, setLivePlayers] = useState(null);
  const [liveScoreboard, setLiveScoreboard] = useState(null);
  const [dataSource, setDataSource] = useState("loading"); // "live" | "mock" | "loading"
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    let cancelled = false;
    let pollInterval = null;

    async function loadLiveData() {
      const errs = [];
      let anySuccess = false;

      // Quick check if the server is reachable
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        const ping = await fetch("/api/db/status", { signal: ctrl.signal }).catch(() => { throw new Error("Server unreachable"); });
        clearTimeout(timer);
        if (!ping.ok) throw new Error("Server error");
      } catch {
        console.warn("Courtside server not running — no data available");
        if (!cancelled) setDataSource("offline");
        return;
      }

      // Fetch in parallel
      const [standingsRes, leadersRes, playersRes, scoreboardRes] =
        await Promise.allSettled([
          fetchStandings(),
          fetchLeagueLeaders(),
          fetchPlayerStats(),
          fetchScoreboard(),
        ]);

      if (cancelled) return;

      if (standingsRes.status === "fulfilled") {
        setLiveStandings(standingsRes.value);
        anySuccess = true;
      } else {
        errs.push(`Standings: ${standingsRes.reason?.message}`);
      }

      if (leadersRes.status === "fulfilled") {
        setLiveLeaders(leadersRes.value);
        anySuccess = true;
      } else {
        errs.push(`Leaders: ${leadersRes.reason?.message}`);
      }

      if (playersRes.status === "fulfilled") {
        setLivePlayers(playersRes.value);
        anySuccess = true;
      } else {
        errs.push(`Players: ${playersRes.reason?.message}`);
      }

      if (scoreboardRes.status === "fulfilled" && scoreboardRes.value.length > 0) {
        setLiveScoreboard(scoreboardRes.value);
        anySuccess = true;

        // Start 30-second polling if any games are live
        const hasLive = scoreboardRes.value.some((g) => g.status === "LIVE");
        if (hasLive && !pollInterval) {
          pollInterval = setInterval(async () => {
            if (cancelled) return;
            try {
              clearEndpointCache("scoreboardv3");
              const fresh = await fetchScoreboard();
              if (!cancelled && fresh.length > 0) setLiveScoreboard(fresh);
            } catch {}
          }, 30000);
        }
      } else if (scoreboardRes.status === "rejected") {
        errs.push(`Scoreboard: ${scoreboardRes.reason?.message}`);
      }

      setErrors(errs);
      setDataSource(anySuccess ? "live" : "mock");
    }

    loadLiveData();
    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // Transform DB leaders keys (lowercase) to display keys (Title case)
  // DB returns: { points: [...], rebounds: [...], threePointers: [...] }
  // LeagueLeaders component expects: { Points: [...], Rebounds: [...], "3-Pointers": [...] }
  const leagueLeaders = useMemo(() => {
    if (!liveLeaders) return {};
    const keyMap = {
      points: "Points", rebounds: "Rebounds", assists: "Assists",
      steals: "Steals", blocks: "Blocks", threePointers: "3-Pointers",
    };
    const out = {};
    Object.entries(liveLeaders).forEach(([k, v]) => {
      if (Array.isArray(v) && v.length > 0) out[keyMap[k] || k] = v;
    });
    return out;
  }, [liveLeaders]);

  const value = useMemo(
    () => ({
      standings: liveStandings || { East: [], West: [] },
      leaders: liveLeaders || {},
      leagueLeaders,
      scoreboard: liveScoreboard || [],
      livePlayers,
      dataSource,
      errors,
      isLive: dataSource === "live",
    }),
    [liveStandings, liveLeaders, liveScoreboard, livePlayers, dataSource, errors]
  );

  return (
    <LiveDataContext.Provider value={value}>{children}</LiveDataContext.Provider>
  );
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("Courtside error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#e8ddd0", color: "#1c1309", fontFamily: "'Inter', sans-serif", padding: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Something went wrong</h1>
          <p style={{ color: "#9e8878", marginBottom: 20, maxWidth: 500, textAlign: "center" }}>{this.state.error?.message || "An unexpected error occurred."}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })} style={{ background: "#e8590c", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// MAIN APP
// ============================================================================

export default function CourtsideApp() {
  return (
    <ErrorBoundary>
      <LiveDataProvider>
        <CourtsideAppInner />
      </LiveDataProvider>
    </ErrorBoundary>
  );
}

function CourtsideAppInner() {
  const liveData = useLiveData();
  const [currentPage, setCurrentPage] = useState("home");
  const [showAIModal, setShowAIModal] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [selectedLivePlayer, setSelectedLivePlayer] = useState(null);
  const [selectedTeamAbbr, setSelectedTeamAbbr] = useState(null);

  const handleGameClick = (gameId) => {
    setSelectedGameId(gameId);
    setCurrentPage("gameDetail");
  };

  const handlePlayerClick = (playerIdOrName) => {
    // Try to match by id first, then by name
    const match = PLAYERS.find(
      (p) => p.id === playerIdOrName || p.name === playerIdOrName
    );
    if (match) {
      setSelectedPlayerId(match.id);
      setCurrentPage("playerDetail");
    } else {
      setCurrentPage("players");
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return (
          <HomePage
            onGameClick={handleGameClick}
            onPlayerClick={handlePlayerClick}
            onNavigate={setCurrentPage}
          />
        );
      case "standings":
        return <StandingsPage />;
      case "players":
        return (
          <PlayerBrowsePage
            onPlayerSelect={(id, playerObj) => {
              setSelectedPlayerId(id);
              setSelectedLivePlayer(playerObj?.isMock ? null : (playerObj || null));
              setCurrentPage("playerDetail");
            }}
          />
        );
      case "playerDetail":
        return (
          <PlayerDetailPage
            playerId={selectedPlayerId}
            livePlayerData={selectedLivePlayer}
            onBack={(page) => setCurrentPage(page || "players")}
          />
        );
      case "teams":
        return (
          <TeamBrowsePage
            onTeamSelect={(abbr) => {
              setSelectedTeamAbbr(abbr);
              setCurrentPage("teamDetail");
            }}
          />
        );
      case "teamDetail":
        return (
          <TeamDetailPage
            teamAbbr={selectedTeamAbbr}
            onBack={(page) => setCurrentPage(page || "teams")}
          />
        );
      case "compare":
        return <ComparisonPage />;
      case "lineups":
        return <LineupAnalyzerPage />;
      case "games":
        return (
          <GamesPage
            onGameClick={(gameId) => {
              setSelectedGameId(gameId);
              setCurrentPage("gameDetail");
            }}
          />
        );
      case "gameDetail":
        return (
          <GameDetailPage
            gameId={selectedGameId}
            onBack={(page) => setCurrentPage(page || "home")}
          />
        );
      default:
        return (
          <HomePage
            onGameClick={handleGameClick}
            onPlayerClick={handlePlayerClick}
            onNavigate={setCurrentPage}
          />
        );
    }
  };

  return (
    <>
      <style>{STYLES}</style>
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-primary)",
          color: "var(--text-primary)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <NavBar
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          onAskAI={() => setShowAIModal(true)}
          onPlayerSelect={(id) => { setSelectedPlayerId(id); setCurrentPage("playerDetail"); }}
          onTeamSelect={(abbr) => { setSelectedTeamAbbr(abbr); setCurrentPage("teamDetail"); }}
        />
        <main key={currentPage + (selectedPlayerId || "") + (selectedTeamAbbr || "") + (selectedGameId || "")} className="page-transition" style={{ flex: 1 }}>{renderPage()}</main>
        <Footer />
        <MobileBottomNav currentPage={currentPage} setCurrentPage={setCurrentPage} />
        {showAIModal && <AIChatPanel onClose={() => setShowAIModal(false)} />}
      </div>
    </>
  );
}
