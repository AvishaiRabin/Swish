import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, BarChart, Bar, Cell, ReferenceLine,
} from "recharts";
import {
  ChevronLeft, ChevronDown, ChevronUp, TrendingUp, Activity,
  Star, Target, Shield, Info, Calendar,
} from "lucide-react";
import { fetchPlayerStats, fetchPlayerGameLog, fetchPlayerBio, fetchPlayerArchetypeMatchups } from "../nbaApi.js";
import { TEAMS } from "../data/teams.js";
import { PLAYERS } from "../data/players.js";
import TeamLogo from "../components/TeamLogo.jsx";
import PlayerHeadshot from "../components/PlayerHeadshot.jsx";
import Breadcrumb from "../components/Breadcrumb.jsx";
import { useLiveData } from "../context/LiveDataContext.jsx";

export default function PlayerDetailPage({ playerId, livePlayerData, onBack }) {
  const liveData = useLiveData();
  const mockPlayer = PLAYERS.find((p) => p.id === playerId);
  const [liveGameLog, setLiveGameLog] = useState(null);
  const [rollingWindow, setRollingWindow] = useState(5);
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [archetypeLabel, setArchetypeLabel] = useState(null);
  const [archetypeScores, setArchetypeScores] = useState(null);
  const [bioData, setBioData] = useState(null);
  const [profileData, setProfileData] = useState(null);

  const nbaId = mockPlayer?.nbaId || livePlayerData?.nbaId;

  // For live-only players, fetch their game log
  useEffect(() => {
    if (mockPlayer || !livePlayerData?.nbaId) return;
    let cancelled = false;
    fetchPlayerGameLog(livePlayerData.nbaId).then((gl) => {
      if (!cancelled) setLiveGameLog(gl || []);
    }).catch(() => { if (!cancelled) setLiveGameLog([]); });
    return () => { cancelled = true; };
  }, [livePlayerData?.nbaId, mockPlayer]);

  // Fetch player bio (height, weight, age, draft) from commonplayerinfo
  useEffect(() => {
    if (!nbaId) return;
    let cancelled = false;
    fetchPlayerBio(nbaId).then((bio) => {
      if (!cancelled && bio) setBioData(bio);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [nbaId]);

  // Fetch player profile (archetypes + advanced stats) from player_profiles DB
  useEffect(() => {
    if (!nbaId) return;
    let cancelled = false;
    fetch(`/api/db/player-profiles?playerId=${nbaId}`)
      .then((r) => r.json())
      .then((rows) => {
        if (cancelled || !rows?.[0]) return;
        const row = rows[0];
        setProfileData(row);
        if (row.archetypeLabel) {
          setArchetypeLabel(row.archetypeLabel);
          const scoreMap = {
            "Floor General": row.archFloorGeneral,
            "Scoring PG": row.archScoringPg,
            "Combo Guard": row.archComboGuard,
            "Large Playmaker": row.archLargePlaymaker,
            "3-and-D Wing": row.archThreeAndDWing,
            "Two-Way Wing": row.archTwoWayWing,
            "Shot-Creating Wing": row.archShotCreatingWing,
            "Point Wing": row.archPointWing,
            "Stretch Big": row.archStretchBig,
            "Unicorn Big": row.archUnicornBig,
            "Rim-Running Big": row.archRimRunningBig,
            "Defensive Anchor": row.archDefensiveAnchor,
            "Versatile PF": row.archVersatilePf,
          };
          const sorted = Object.entries(scoreMap)
            .filter(([, v]) => v != null && v > 0)
            .sort((a, b) => b[1] - a[1]);
          if (sorted.length > 0) setArchetypeScores(sorted);
        }
      })
      .catch(() => { });
    return () => { cancelled = true; };
  }, [nbaId]);

  // Fetch archetype matchup profile
  const [matchupProfile, setMatchupProfile] = useState(null);
  useEffect(() => {
    if (!nbaId) return;
    let cancelled = false;
    fetchPlayerArchetypeMatchups(nbaId).then((data) => {
      if (!cancelled && data) setMatchupProfile(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [nbaId]);

  // Build a synthetic player object for live-only players, enriched with bio + profile
  const player = mockPlayer || (livePlayerData ? (() => {
    const fgPct = parseFloat(livePlayerData.liveData?.fgPct) || 0;
    const tpPct = parseFloat(livePlayerData.liveData?.tpPct) || 0;
    const ftPct = parseFloat(livePlayerData.liveData?.ftPct) || 0;
    // Advanced stats from player_profiles if available
    const ts = profileData?.tsPct != null ? parseFloat(profileData.tsPct) : null;
    const usg = profileData?.usgPct != null ? parseFloat(profileData.usgPct) : null;
    const ortg = profileData?.offRating != null ? parseFloat(profileData.offRating) : null;
    const drtg = profileData?.defRating != null ? parseFloat(profileData.defRating) : null;
    const netRtg = profileData?.netRating != null ? parseFloat(profileData.netRating) : null;
    const pie = profileData?.pie != null ? parseFloat(profileData.pie) : null;
    const pace = profileData?.pace != null ? parseFloat(profileData.pace) : null;
    const astPct = profileData?.astPct != null ? parseFloat(profileData.astPct) : null;
    const astTo = profileData?.astTo != null ? parseFloat(profileData.astTo) : null;
    return {
      id: livePlayerData.id,
      nbaId: livePlayerData.nbaId,
      name: livePlayerData.name,
      team: livePlayerData.team,
      pos: livePlayerData.pos || "—",
      jersey: bioData?.jersey || livePlayerData.jersey,
      height: bioData?.height || "—",
      weight: bioData?.weight || "—",
      age: bioData?.age ?? "—",
      college: bioData?.college || "—",
      draft: bioData?.draft || "—",
      seasonAvg: {
        pts: parseFloat(livePlayerData.ppg) || 0,
        reb: parseFloat(livePlayerData.rpg) || 0,
        ast: parseFloat(livePlayerData.apg) || 0,
        stl: parseFloat(livePlayerData.liveData?.spg) || 0,
        blk: parseFloat(livePlayerData.liveData?.bpg) || 0,
        fgPct, tpPct, ftPct,
        per: null, ts, usg, ortg, drtg,
        netRtg, pie, pace, astPct, astTo,
        bpm: null, vorp: null, ws: null,
      },
      gameLog: [],
      isLiveOnly: true,
    };
  })() : null);

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
  // Enrich seasonAvg with profile data (fills in PIE, NET, PACE, AST%, ORtg, DRtg for all players)
  const avg = useMemo(() => {
    const base = { ...player.seasonAvg };
    if (profileData) {
      if (base.pie == null && profileData.pie != null) base.pie = parseFloat(profileData.pie);
      if (base.netRtg == null && profileData.netRating != null) base.netRtg = parseFloat(profileData.netRating);
      if (base.pace == null && profileData.pace != null) base.pace = parseFloat(profileData.pace);
      if (base.astPct == null && profileData.astPct != null) base.astPct = parseFloat(profileData.astPct);
      if (base.astTo == null && profileData.astTo != null) base.astTo = parseFloat(profileData.astTo);
      if (base.ts == null && profileData.tsPct != null) base.ts = parseFloat(profileData.tsPct);
      if (base.usg == null && profileData.usgPct != null) base.usg = parseFloat(profileData.usgPct);
      if (base.ortg == null && profileData.offRating != null) base.ortg = parseFloat(profileData.offRating);
      if (base.drtg == null && profileData.defRating != null) base.drtg = parseFloat(profileData.defRating);
    }
    // Estimate PER from PIE when PER isn't available (PIE×1.5 ≈ PER)
    if (base.per == null && base.pie != null) base.per = +(base.pie * 1.5).toFixed(1);
    return base;
  }, [player.seasonAvg, profileData]);
  // Normalize to descending order (most recent first) for the table
  // Live data from NBA API is already descending; mock data is generated descending too
  const log = mockPlayer ? player.gameLog : (liveGameLog || []);

  // Compute rolling averages on chronological (ascending) order so G1=oldest, GN=newest
  const rollingData = useMemo(() => {
    const chronoLog = [...log].reverse();
    return chronoLog.map((game, idx) => {
      const start = Math.max(0, idx - rollingWindow + 1);
      const window = chronoLog.slice(start, idx + 1);
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
  const impactVal = avg.pie ?? avg.per ?? 0;
  const effVal = avg.ts ?? 0;
  const radarData = [
    { stat: "Scoring", value: Math.min(100, (avg.pts / 35) * 100) },
    { stat: "Rebounding", value: Math.min(100, (avg.reb / 14) * 100) },
    { stat: "Playmaking", value: Math.min(100, (avg.ast / 11) * 100) },
    { stat: "Defense", value: Math.min(100, ((avg.stl + avg.blk) / 4.5) * 100) },
    { stat: "Efficiency", value: Math.min(100, (effVal / 68) * 100) },
    { stat: "Impact", value: Math.min(100, (impactVal / 20) * 100) },
  ];

  // Advanced stats — build from whatever data is available
  const advancedStats = [
    avg.per != null   && { key: "PER",   value: Number(avg.per).toFixed(1),  desc: "Player Efficiency Rating — a per-minute rating of a player's performance. League average is 15.0. Estimated from PIE when official PER is unavailable." },
    avg.ts != null    && { key: "TS%",   value: Number(avg.ts).toFixed(1),   desc: "True Shooting % — measures shooting efficiency including 2P, 3P, and FT. League average ~57%." },
    avg.usg != null   && { key: "USG%",  value: Number(avg.usg).toFixed(1),  desc: "Usage Rate — percentage of team plays used by the player while on court." },
    avg.ortg != null  && { key: "ORtg",  value: Number(avg.ortg).toFixed(1), desc: "Offensive Rating — points produced per 100 possessions. Higher is better." },
    avg.drtg != null  && { key: "DRtg",  value: Number(avg.drtg).toFixed(1), desc: "Defensive Rating — points allowed per 100 possessions. Lower is better." },
    avg.netRtg != null && { key: "NET",  value: (avg.netRtg >= 0 ? "+" : "") + Number(avg.netRtg).toFixed(1), desc: "Net Rating — point differential per 100 possessions (ORtg minus DRtg)." },
    avg.pace != null  && { key: "PACE",  value: Number(avg.pace).toFixed(1), desc: "Pace — number of possessions per 48 minutes the player's team uses." },
    avg.astPct != null && { key: "AST%", value: Number(avg.astPct).toFixed(1), desc: "Assist Percentage — percentage of teammate field goals assisted while on court." },
    avg.bpm != null   && { key: "BPM",   value: Number(avg.bpm).toFixed(1),  desc: "Box Plus/Minus — box score estimate of points per 100 possessions above average." },
    avg.vorp != null  && { key: "VORP",  value: Number(avg.vorp).toFixed(1), desc: "Value Over Replacement Player — estimate of points contributed over a replacement-level player." },
    avg.ws != null    && { key: "WS",    value: Number(avg.ws).toFixed(1),   desc: "Win Shares — estimate of the number of wins contributed by a player." },
  ].filter(Boolean);

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
              {archetypeLabel && (
                <div
                  title={archetypeScores
                    ? `Fuzzy archetype scores (top 5):\n${archetypeScores.slice(0, 5).map(([n, v]) => `${n}: ${(v * 100).toFixed(0)}%`).join("\n")}\n\nDerived from advanced metrics + position. Updated nightly.`
                    : "Player archetype derived from fuzzy scoring of advanced metrics. Updated nightly."}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "rgba(249,115,22,0.15)",
                    border: "1px solid rgba(249,115,22,0.4)",
                    borderRadius: 20,
                    padding: "3px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--accent)",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    fontFamily: "'JetBrains Mono', monospace",
                    cursor: "help",
                  }}
                >
                  {archetypeLabel}
                  {archetypeScores && archetypeScores.length > 1 && archetypeScores[0][0] !== archetypeScores[1][0] && (
                    <span style={{ opacity: 0.55, fontSize: 10 }}>/ {archetypeScores[1][0]}</span>
                  )}
                </div>
              )}
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
              <Line type="monotone" dataKey="rollingPts" stroke="#f97316" strokeWidth={2.5} dot={false} name={`${rollingWindow}G Avg`} />
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
          {advancedStats.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 16 }}>
              Advanced stats unavailable for this player
            </div>
          )}
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

      {/* ===== MATCHUP PROFILE: vs Opponent Offense + Defense ===== */}
      {(matchupProfile?.vsDefense?.length > 0 || matchupProfile?.vsOffense?.length > 0) && (() => {
        const baseline = matchupProfile.seasonBaseline;
        const deltaColor = (v) => v > 0 ? "#22c55e" : v < 0 ? "#ef4444" : "var(--text-muted)";
        const deltaStr = (v) => (v > 0 ? "+" : "") + v;

        const renderPlayerMatchupTable = (title, icon, data, bestLabel, worstLabel) => (
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>
              {icon} {title}
            </h3>
            {bestLabel && worstLabel && (() => {
              const best = data.find((d) => d.label === bestLabel);
              const worst = data.find((d) => d.label === worstLabel);
              return (
                <div style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  Most efficient vs <span style={{ fontWeight: 700, color: "#22c55e" }}>{bestLabel}</span>
                  {" "}({best?.ptsPer100} pts/100, {best?.tsPct}% TS),
                  least efficient vs <span style={{ fontWeight: 700, color: "#ef4444" }}>{worstLabel}</span>
                  {" "}({worst?.ptsPer100} pts/100, {worst?.tsPct}% TS)
                </div>
              );
            })()}
            <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 70px 60px 60px 55px 55px", padding: "8px 14px", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                <span>Archetype</span>
                <span className="stat-number" style={{ textAlign: "center" }}>GP</span>
                <span className="stat-number" style={{ textAlign: "center" }}>Pts/100</span>
                <span className="stat-number" style={{ textAlign: "center" }}>TS%</span>
                <span className="stat-number" style={{ textAlign: "center" }}>Usage</span>
                <span className="stat-number" style={{ textAlign: "center" }}>A/TO</span>
                <span className="stat-number" style={{ textAlign: "center" }}>3P%</span>
              </div>
              {baseline && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 70px 60px 60px 55px 55px", padding: "6px 14px", fontSize: 11, borderBottom: "1px solid var(--border-color)", background: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                  <span style={{ fontWeight: 600, fontStyle: "italic" }}>Season Avg</span>
                  <span className="stat-number" style={{ textAlign: "center" }}>{baseline.games}</span>
                  <span className="stat-number" style={{ textAlign: "center" }}>{baseline.ptsPer100}</span>
                  <span className="stat-number" style={{ textAlign: "center" }}>{baseline.tsPct}%</span>
                  <span className="stat-number" style={{ textAlign: "center" }}>{baseline.usage}</span>
                  <span className="stat-number" style={{ textAlign: "center" }}>{baseline.astTov}</span>
                  <span className="stat-number" style={{ textAlign: "center" }}>—</span>
                </div>
              )}
              {data.map((s, i) => {
                const isBest = s.label === bestLabel;
                const isWorst = s.label === worstLabel;
                return (
                  <div key={s.label} style={{
                    display: "grid", gridTemplateColumns: "1fr 40px 70px 60px 60px 55px 55px",
                    padding: "10px 14px", fontSize: 13,
                    borderBottom: i < data.length - 1 ? "1px solid var(--border-color)" : "none",
                    background: isBest ? "rgba(34,197,94,0.06)" : isWorst ? "rgba(239,68,68,0.06)" : "transparent",
                  }}>
                    <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                      {s.label}
                      {isBest && <span style={{ fontSize: 8, background: "rgba(34,197,94,0.15)", color: "#22c55e", padding: "1px 4px", borderRadius: 3, fontWeight: 700 }}>BEST</span>}
                      {isWorst && <span style={{ fontSize: 8, background: "rgba(239,68,68,0.15)", color: "#ef4444", padding: "1px 4px", borderRadius: 3, fontWeight: 700 }}>WORST</span>}
                    </span>
                    <span className="stat-number" style={{ textAlign: "center" }}>{s.games}</span>
                    <span className="stat-number" style={{ textAlign: "center" }}>
                      {s.ptsPer100}
                      {s.ptsPer100Delta !== 0 && <span style={{ fontSize: 9, marginLeft: 3, color: deltaColor(s.ptsPer100Delta) }}>{deltaStr(s.ptsPer100Delta)}</span>}
                    </span>
                    <span className="stat-number" style={{ textAlign: "center" }}>
                      {s.tsPct}%
                      {s.tsPctDelta !== 0 && <span style={{ fontSize: 9, marginLeft: 2, color: deltaColor(s.tsPctDelta) }}>{deltaStr(s.tsPctDelta)}</span>}
                    </span>
                    <span className="stat-number" style={{ textAlign: "center" }}>
                      {s.usage}
                      {s.usageDelta !== 0 && <span style={{ fontSize: 9, marginLeft: 2, color: deltaColor(s.usageDelta) }}>{deltaStr(s.usageDelta)}</span>}
                    </span>
                    <span className="stat-number" style={{ textAlign: "center" }}>{s.astTov}</span>
                    <span className="stat-number" style={{ textAlign: "center" }}>{s.fg3Pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        );

        return (
          <div style={{ marginBottom: 28 }}>
            <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Shield size={18} style={{ color: "var(--accent-blue)" }} />
              Matchup Profile
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {matchupProfile.vsDefense?.length > 0 && renderPlayerMatchupTable(
                "vs Opponent Defense",
                <Shield size={13} style={{ color: "var(--accent-blue)" }} />,
                matchupProfile.vsDefense,
                matchupProfile.bestVsDefense,
                matchupProfile.worstVsDefense,
              )}
              {matchupProfile.vsOffense?.length > 0 && renderPlayerMatchupTable(
                "vs Opponent Offense",
                <Target size={13} style={{ color: "var(--accent)" }} />,
                matchupProfile.vsOffense,
                matchupProfile.bestVsOffense,
                matchupProfile.worstVsOffense,
              )}
            </div>
          </div>
        );
      })()}

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
