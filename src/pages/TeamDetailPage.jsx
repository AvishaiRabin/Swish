import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import {
  ChevronLeft, ChevronDown, ChevronUp, Home, Activity, Shield,
  Target, BarChart3, Users, Calendar,
} from "lucide-react";
import { fetchTeamGameLog, fetchTeamArchetypeMatchups, fetchTeamArchetypes, fetchTeamRatingHistory, fetchTeamStats, fetchEloRatings } from "../nbaApi.js";
import { TEAMS } from "../data/teams.js";
import TeamLogo from "../components/TeamLogo.jsx";
import PlayerHeadshot from "../components/PlayerHeadshot.jsx";
import Breadcrumb from "../components/Breadcrumb.jsx";
import { useLiveData } from "../context/LiveDataContext.jsx";

export default function TeamDetailPage({ teamAbbr, onBack }) {
  const liveData = useLiveData();
  const team = TEAMS[teamAbbr];

  // Fetch live team stats from DB
  const [liveStats, setLiveStats] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchTeamStats(teamAbbr).then((data) => {
      if (!cancelled && data?.[0]) setLiveStats(data[0]);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [teamAbbr]);

  // Build roster from live player data
  const roster = useMemo(() => {
    if (liveData.livePlayers?.length) {
      const teamPlayers = liveData.livePlayers
        .filter((p) => p.team === teamAbbr)
        .map((p) => ({ ...p, jersey: p.jersey ?? "—" }));
      if (teamPlayers.length > 0) return teamPlayers;
    }
    return [];
  }, [liveData.livePlayers, teamAbbr]);

  // Roster sort state (must be before early return — React hooks rules)
  const [rosterSort, setRosterSort] = useState("ppg");
  const [rosterSortAsc, setRosterSortAsc] = useState(false);

  // Fetch live team game log (must be before early return — React hooks rules)
  const [liveGameLog, setLiveGameLog] = useState(null);
  useEffect(() => {
    if (!liveData.isLive) return;
    let cancelled = false;
    fetchTeamGameLog(teamAbbr)
      .then((data) => { if (!cancelled && data) setLiveGameLog(data); })
      .catch(() => { });
    return () => { cancelled = true; };
  }, [teamAbbr, liveData.isLive]);

  // Fetch archetype matchup data
  const [archetypeMatchups, setArchetypeMatchups] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchTeamArchetypeMatchups(teamAbbr)
      .then((data) => { if (!cancelled && data) setArchetypeMatchups(data); })
      .catch(() => { });
    return () => { cancelled = true; };
  }, [teamAbbr]);

  // Fetch team offensive/defensive archetypes (all teams for league ranking)
  const [teamArchetypes, setTeamArchetypes] = useState(null);
  const [allTeamArchetypes, setAllTeamArchetypes] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchTeamArchetypes().then((data) => {
      if (!cancelled && data?.length) {
        setAllTeamArchetypes(data);
        const mine = data.find((t) => t.team === teamAbbr);
        if (mine) setTeamArchetypes(mine);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [teamAbbr]);

  // Fetch Elo rating for this team
  const [eloInfo, setEloInfo] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchEloRatings().then((data) => {
      if (!cancelled && data?.teams?.length) {
        const mine = data.teams.find((t) => t.team === teamAbbr);
        if (mine) setEloInfo(mine);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [teamAbbr]);

  // Fetch live rating history from DB (replaces static ratingHistory)
  const [ratingHistory, setRatingHistory] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchTeamRatingHistory(teamAbbr).then((data) => {
      if (!cancelled && data?.length) setRatingHistory(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [teamAbbr]);

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
  const confRank = liveData.standings[conf].findIndex((s) => s.team === teamAbbr) + 1 || "—";
  const homeRecord = standing?.home || "—";
  const awayRecord = standing?.away || "—";

  const last10 = liveGameLog || [];

  const ChartTooltipContent = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const net = payload[0]?.payload?.net;
      return (
        <div style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--text-primary)" }}>{label}</div>
          {payload.map((p) => (
            <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
              {p.name}: <span style={{ fontWeight: 600 }}>{p.value}</span>
            </div>
          ))}
          {net != null && (
            <div style={{ color: "var(--accent)", marginTop: 4, borderTop: "1px solid var(--border-color)", paddingTop: 4 }}>
              Net Rtg: <span style={{ fontWeight: 600 }}>{net > 0 ? "+" : ""}{net}</span>
            </div>
          )}
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
                ...(eloInfo ? [{
                  label: "Elo",
                  value: eloInfo.elo.toFixed(0),
                  sub: eloInfo.trend >= 0 ? `+${eloInfo.trend.toFixed(1)}` : eloInfo.trend.toFixed(1),
                  color: eloInfo.trend > 5 ? "var(--accent-green)" : eloInfo.trend < -5 ? "var(--accent-red)" : undefined,
                }] : []),
              ].map((s) => (
                <div key={s.label}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>{s.label}</div>
                  <div className="stat-number" style={{ fontSize: 20, fontWeight: 700, color: s.color || "var(--text-primary)" }}>{s.value}</div>
                  {s.sub && <div style={{ fontSize: 11, color: s.color || "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>{s.sub} L10</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== TEAM IDENTITY: Offensive + Defensive Archetypes ===== */}
      {teamArchetypes && (() => {
        const allTeams = allTeamArchetypes || [];
        const leagueRank = (key) => {
          if (allTeams.length < 2) return null;
          const sorted = [...allTeams].sort((a, b) => (b[key] || 0) - (a[key] || 0));
          return sorted.findIndex((t) => t.team === teamAbbr) + 1;
        };
        const rankLabel = (r) => r ? `#${r}` : "";
        const offStyles = [
          { key: "off_pace_space", label: "Pace & Space" },
          { key: "off_paint_beast", label: "Paint Beast" },
          { key: "off_motion", label: "Motion" },
          { key: "off_iso_heavy", label: "ISO Heavy" },
          { key: "off_transition", label: "Transition" },
          { key: "off_pick_roll", label: "Pick & Roll" },
        ];
        const defStyles = [
          { key: "def_perimeter_lock", label: "Perimeter Lock" },
          { key: "def_rim_protection", label: "Rim Protection" },
          { key: "def_switchable", label: "Switchable" },
          { key: "def_blitz_press", label: "Blitz/Press" },
          { key: "def_pack_paint", label: "Pack Paint" },
          { key: "def_help_zone", label: "Help/Zone" },
        ];
        const maxOff = Math.max(...offStyles.map((s) => teamArchetypes[s.key] || 0), 0.01);
        const maxDef = Math.max(...defStyles.map((s) => teamArchetypes[s.key] || 0), 0.01);

        const renderBar = (style, max, accentColor, bgColor) => {
          const val = teamArchetypes[style.key] || 0;
          const pct = (val / max) * 100;
          const rank = leagueRank(style.key);
          const isTop = rank && rank <= 5;
          return (
            <div key={style.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
              <span style={{ width: 100, fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textAlign: "right", flexShrink: 0 }}>{style.label}</span>
              <div style={{ flex: 1, height: 18, background: "var(--bg-tertiary)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
                <div style={{
                  height: "100%", borderRadius: 4,
                  background: isTop ? accentColor : bgColor,
                  width: `${pct}%`, transition: "width 0.4s",
                  minWidth: pct > 0 ? 4 : 0,
                }} />
              </div>
              <span className="stat-number" style={{ width: 36, fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textAlign: "right" }}>
                {(val * 100).toFixed(0)}
              </span>
              {rank && (
                <span className="stat-number" style={{
                  width: 28, fontSize: 10, fontWeight: 700, textAlign: "center",
                  color: rank <= 5 ? accentColor : rank <= 15 ? "var(--text-secondary)" : "var(--text-muted)",
                }}>
                  {rankLabel(rank)}
                </span>
              )}
            </div>
          );
        };

        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
            {/* Offensive Identity */}
            <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", padding: 20 }}>
              <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <Target size={14} style={{ color: "var(--accent)" }} />
                Offensive Identity
              </h3>
              <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "rgba(249,115,22,0.12)", color: "var(--accent)", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                  {teamArchetypes.off_archetype?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {offStyles.map((s) => renderBar(s, maxOff, "var(--accent)", "rgba(249,115,22,0.35)"))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border-color)" }}>
                {[
                  { label: "Pace", value: teamArchetypes.pace?.toFixed(1) },
                  { label: "3PA Rate", value: teamArchetypes.fg3a_rate ? (teamArchetypes.fg3a_rate * 100).toFixed(1) + "%" : "—" },
                  { label: "AST Rate", value: teamArchetypes.ast_rate ? (teamArchetypes.ast_rate * 100).toFixed(1) + "%" : "—" },
                ].map((s) => (
                  <div key={s.label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</div>
                    <div className="stat-number" style={{ fontSize: 16, fontWeight: 700 }}>{s.value || "—"}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Defensive Identity */}
            <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", padding: 20 }}>
              <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <Shield size={14} style={{ color: "var(--accent-blue)" }} />
                Defensive Identity
              </h3>
              <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "rgba(59,130,246,0.12)", color: "var(--accent-blue)", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                  {teamArchetypes.def_archetype?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {defStyles.map((s) => renderBar(s, maxDef, "var(--accent-blue)", "rgba(59,130,246,0.35)"))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border-color)" }}>
                {[
                  { label: "STL/G", value: teamArchetypes.stl_rate?.toFixed(1) },
                  { label: "BLK/G", value: teamArchetypes.blk_rate?.toFixed(1) },
                  { label: "Deflections", value: teamArchetypes.deflection_rate?.toFixed(1) },
                ].map((s) => (
                  <div key={s.label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</div>
                    <div className="stat-number" style={{ fontSize: 16, fontWeight: 700 }}>{s.value || "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== STATS DASHBOARD: Ratings Chart + Four Factors ===== */}
      {liveStats && (
        <div style={{ display: "grid", gridTemplateColumns: ratingHistory?.length ? "1fr 1fr" : "1fr", gap: 20, marginBottom: 28 }}>
          {/* Off/Def Rating Over Time — only shown when history data exists */}
          {ratingHistory?.length > 0 && (
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
                <LineChart data={ratingHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="game" axisLine={false} tickLine={false} tick={{ fill: "#9e8878", fontSize: 9 }} />
                  <YAxis domain={["auto", "auto"]} axisLine={false} tickLine={false} tick={{ fill: "#9e8878", fontSize: 10 }} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="ortg" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} name="ORtg" />
                  <Line type="monotone" dataKey="drtg" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} name="DRtg" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Four Factors + Pace */}
          <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", padding: 20 }}>
            <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <BarChart3 size={14} style={{ color: "var(--accent-amber)" }} />
              Four Factors & Pace
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "eFG%", value: liveStats.efg_pct, desc: "Effective FG% adjusts for 3-pointers being worth more", avg: 53.0 },
                { label: "TOV%", value: liveStats.tov_pct, desc: "Turnover rate — lower is better", avg: 13.0, invert: true },
                { label: "ORB%", value: liveStats.orb_pct, desc: "Offensive rebound percentage", avg: 24.0 },
                { label: "FT Rate", value: liveStats.ft_rate, desc: "Free throw attempts per FGA", avg: 25.0 },
                { label: "Pace", value: liveStats.pace, desc: "Possessions per 48 minutes", avg: 100.0 },
                { label: "Net Rtg", value: liveStats.net_rtg, desc: "Point differential per 100 possessions", avg: 0 },
              ].map((f) => {
                const better = f.invert ? f.value < f.avg : f.value > f.avg;
                const barWidth = f.avg !== 0
                  ? Math.min(100, Math.max(0, (f.value / (f.avg * 1.3)) * 100))
                  : Math.min(100, Math.max(0, (f.value + 20) * 2.5));
                return (
                  <div key={f.label} style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: "14px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{f.label}</span>
                      <span className="stat-number" style={{ fontSize: 18, fontWeight: 700, color: better ? "var(--accent-green)" : "var(--accent-red)" }}>{f.value}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.4 }}>{f.desc}</div>
                    {/* Mini bar */}
                    <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: "var(--bg-primary)", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 2, background: better ? "var(--accent-green)" : "var(--accent-red)", width: `${barWidth}%`, transition: "width 0.4s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== HOME VS AWAY SPLITS ===== */}
      {liveStats && (
        <div style={{ marginBottom: 28 }}>
          <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <Home size={18} style={{ color: "var(--accent-blue)" }} />
            Home vs. Away Splits
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { label: "Home", record: homeRecord, splits: { ppg: liveStats.home_ppg, oppPpg: liveStats.home_opp_ppg, fgPct: liveStats.home_fg_pct, tpPct: liveStats.home_tp_pct } },
              { label: "Away", record: awayRecord, splits: { ppg: liveStats.away_ppg, oppPpg: liveStats.away_opp_ppg, fgPct: liveStats.away_fg_pct, tpPct: liveStats.away_tp_pct } },
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
      )}

      {/* ===== ARCHETYPE MATCHUPS: vs Opponent Offense + vs Opponent Defense ===== */}
      {(archetypeMatchups?.vsOffense?.length > 0 || archetypeMatchups?.vsDefense?.length > 0) && (() => {
        const deltaColor = (v) => v > 0 ? "#22c55e" : v < 0 ? "#ef4444" : "var(--text-muted)";
        const deltaStr = (v) => (v > 0 ? "+" : "") + v;

        const renderMatchupSection = (title, icon, iconColor, data, bestLabel, worstLabel) => {
          const maxAbs = Math.max(...data.map((d) => Math.abs(d.oRtgDelta || 0)), 3);
          return (
            <div>
              {/* Diverging bar chart — ORtg delta from season avg */}
              <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", padding: "20px 24px", marginBottom: 12 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>
                  {icon}
                  {title}
                </h3>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 12 }}>ORtg vs season average</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.map((d) => {
                    const delta = d.oRtgDelta || 0;
                    const pct = Math.min(Math.abs(delta) / maxAbs * 50, 50);
                    const isPos = delta >= 0;
                    const isBest = d.label === bestLabel;
                    const isWorst = d.label === worstLabel;
                    return (
                      <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 120, fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textAlign: "right", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                          {d.label}
                          {isBest && <span style={{ fontSize: 8, background: "rgba(34,197,94,0.15)", color: "#22c55e", padding: "1px 4px", borderRadius: 3, fontWeight: 700 }}>BEST</span>}
                          {isWorst && <span style={{ fontSize: 8, background: "rgba(239,68,68,0.15)", color: "#ef4444", padding: "1px 4px", borderRadius: 3, fontWeight: 700 }}>WORST</span>}
                        </span>
                        <div style={{ flex: 1, height: 22, position: "relative", background: "var(--bg-tertiary)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--text-muted)", opacity: 0.3 }} />
                          <div style={{
                            position: "absolute", top: 2, bottom: 2, borderRadius: 3,
                            background: isPos ? "rgba(34,197,94,0.75)" : "rgba(239,68,68,0.75)",
                            ...(isPos ? { left: "50%", width: `${pct}%` } : { right: "50%", width: `${pct}%` }),
                          }} />
                        </div>
                        <span className="stat-number" style={{ width: 50, fontSize: 13, fontWeight: 700, color: isPos ? "#22c55e" : "#ef4444", textAlign: "right" }}>
                          {deltaStr(delta)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Insight blurb */}
              {bestLabel && worstLabel && (() => {
                const best = data.find((d) => d.label === bestLabel);
                const worst = data.find((d) => d.label === worstLabel);
                return (
                  <div style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    Most efficient vs <span style={{ fontWeight: 700, color: "#22c55e" }}>{bestLabel}</span>
                    {" "}({best?.record}, {best?.oRtg} ORtg), least efficient vs
                    {" "}<span style={{ fontWeight: 700, color: "#ef4444" }}>{worstLabel}</span>
                    {" "}({worst?.record}, {worst?.oRtg} ORtg)
                  </div>
                );
              })()}
              {/* Detail table — per-possession metrics */}
              <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 40px 65px 55px 55px 55px 50px", padding: "8px 14px", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  <span>Archetype</span>
                  <span className="stat-number" style={{ textAlign: "center" }}>Record</span>
                  <span className="stat-number" style={{ textAlign: "center" }}>GP</span>
                  <span className="stat-number" style={{ textAlign: "center" }}>ORtg</span>
                  <span className="stat-number" style={{ textAlign: "center" }}>eFG%</span>
                  <span className="stat-number" style={{ textAlign: "center" }}>TOV%</span>
                  <span className="stat-number" style={{ textAlign: "center" }}>3P%</span>
                  <span className="stat-number" style={{ textAlign: "center" }}>A/TO</span>
                </div>
                {data.map((d, i) => {
                  const isBest = d.label === bestLabel;
                  const isWorst = d.label === worstLabel;
                  return (
                    <div key={d.label} style={{
                      display: "grid", gridTemplateColumns: "1fr 60px 40px 65px 55px 55px 55px 50px",
                      padding: "10px 14px", fontSize: 13,
                      borderBottom: i < data.length - 1 ? "1px solid var(--border-color)" : "none",
                      background: isBest ? "rgba(34,197,94,0.06)" : isWorst ? "rgba(239,68,68,0.06)" : "transparent",
                    }}>
                      <span style={{ fontWeight: 600 }}>{d.label}</span>
                      <span className="stat-number" style={{ textAlign: "center", fontWeight: 600 }}>{d.record}</span>
                      <span className="stat-number" style={{ textAlign: "center" }}>{d.games}</span>
                      <span className="stat-number" style={{ textAlign: "center" }}>
                        {d.oRtg}
                        {d.oRtgDelta !== 0 && <span style={{ fontSize: 9, marginLeft: 2, color: deltaColor(d.oRtgDelta) }}>{deltaStr(d.oRtgDelta)}</span>}
                      </span>
                      <span className="stat-number" style={{ textAlign: "center" }}>
                        {d.efgPct}%
                        {d.efgDelta !== 0 && <span style={{ fontSize: 9, marginLeft: 2, color: deltaColor(d.efgDelta) }}>{deltaStr(d.efgDelta)}</span>}
                      </span>
                      <span className="stat-number" style={{ textAlign: "center" }}>
                        {d.tovPct}%
                        {d.tovDelta !== 0 && <span style={{ fontSize: 9, marginLeft: 2, color: deltaColor(-d.tovDelta) }}>{deltaStr(d.tovDelta)}</span>}
                      </span>
                      <span className="stat-number" style={{ textAlign: "center" }}>{d.tpPct}%</span>
                      <span className="stat-number" style={{ textAlign: "center" }}>{d.astTov}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        };

        return (
          <div style={{ marginBottom: 28 }}>
            <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Shield size={18} style={{ color: "var(--accent-blue)" }} />
              Performance vs Opponent Archetypes
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {archetypeMatchups.vsOffense?.length > 0 && renderMatchupSection(
                "vs Opponent Offense",
                <Target size={13} style={{ color: "var(--accent)" }} />,
                "var(--accent)",
                archetypeMatchups.vsOffense,
                archetypeMatchups.bestVsOffense,
                archetypeMatchups.worstVsOffense,
              )}
              {archetypeMatchups.vsDefense?.length > 0 && renderMatchupSection(
                "vs Opponent Defense",
                <Shield size={13} style={{ color: "var(--accent-blue)" }} />,
                "var(--accent-blue)",
                archetypeMatchups.vsDefense,
                archetypeMatchups.bestVsDefense,
                archetypeMatchups.worstVsDefense,
              )}
            </div>
          </div>
        );
      })()}

      {/* ===== ROSTER TABLE ===== */}
      {roster.length > 0 && (() => {
        const ROSTER_COLS = [
          { key: "name", label: "Player", numeric: false },
          { key: "pos", label: "Pos", numeric: false },
          { key: "jersey", label: "#", numeric: true },
          { key: "gp", label: "GP", numeric: true },
          { key: "mpg", label: "MPG", numeric: true },
          { key: "ppg", label: "PPG", numeric: true },
          { key: "rpg", label: "RPG", numeric: true },
          { key: "apg", label: "APG", numeric: true },
          { key: "spg", label: "SPG", numeric: true },
          { key: "bpg", label: "BPG", numeric: true },
          { key: "fgPct", label: "FG%", numeric: true },
          { key: "tpPct", label: "3P%", numeric: true },
        ];
        const sortedRoster = [...roster].sort((a, b) => {
          const av = parseFloat(a[rosterSort] ?? 0);
          const bv = parseFloat(b[rosterSort] ?? 0);
          const isNum = !isNaN(av) && !isNaN(bv);
          const cmp = isNum ? av - bv : String(a[rosterSort] ?? "").localeCompare(String(b[rosterSort] ?? ""));
          return rosterSortAsc ? cmp : -cmp;
        });
        const gridTpl = "1fr 36px 36px 36px 42px 42px 42px 42px 42px 42px 42px 42px";
        const ROW_H = 37; // px per row
        const VISIBLE = 8;
        return (
          <div style={{ marginBottom: 28 }}>
            <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={18} style={{ color: "var(--accent-blue)" }} />
              Roster
            </h2>
            <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", overflow: "hidden" }}>
              {/* Sticky header — outside the scrollable area */}
              <div style={{ overflowX: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: gridTpl, padding: "8px 14px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)", textTransform: "uppercase", letterSpacing: "0.5px", minWidth: 640 }}>
                  {ROSTER_COLS.map((col) => {
                    const active = rosterSort === col.key;
                    return (
                      <span
                        key={col.key}
                        className={col.numeric ? "stat-number" : ""}
                        onClick={() => {
                          if (active) setRosterSortAsc((a) => !a);
                          else { setRosterSort(col.key); setRosterSortAsc(false); }
                        }}
                        style={{ textAlign: col.key === "name" ? "left" : "center", cursor: "pointer", userSelect: "none", color: active ? "var(--accent-blue)" : "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 3, justifyContent: col.key === "name" ? "flex-start" : "center" }}
                      >
                        {col.label}
                        {active && <span style={{ fontSize: 9 }}>{rosterSortAsc ? "▲" : "▼"}</span>}
                      </span>
                    );
                  })}
                </div>
                {/* Scrollable body — max 8 rows */}
                <div style={{ overflowY: "auto", maxHeight: ROW_H * VISIBLE, overflowX: "hidden" }}>
                  {sortedRoster.map((p, idx) => (
                    <div
                      key={p.name}
                      style={{ display: "grid", gridTemplateColumns: gridTpl, padding: "9px 14px", fontSize: 12, borderBottom: idx < sortedRoster.length - 1 ? "1px solid var(--border-color)" : "none", alignItems: "center", transition: "background 0.15s", minWidth: 640 }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                      <span className="stat-number" style={{ textAlign: "center", color: "var(--text-muted)" }}>{p.pos}</span>
                      <span className="stat-number" style={{ textAlign: "center", color: "var(--text-muted)" }}>{p.jersey ?? "—"}</span>
                      <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.gp}</span>
                      <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.mpg}</span>
                      <span className="stat-number" style={{ textAlign: "center", fontWeight: 700, color: parseFloat(p.ppg) >= 20 ? "var(--accent-blue)" : "var(--text-primary)" }}>{p.ppg}</span>
                      <span className="stat-number" style={{ textAlign: "center", color: parseFloat(p.rpg) >= 8 ? "var(--accent-amber)" : "var(--text-secondary)" }}>{p.rpg}</span>
                      <span className="stat-number" style={{ textAlign: "center", color: parseFloat(p.apg) >= 5 ? "var(--accent-amber)" : "var(--text-secondary)" }}>{p.apg}</span>
                      <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.spg}</span>
                      <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.bpg}</span>
                      <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.fgPct}</span>
                      <span className="stat-number" style={{ textAlign: "center", color: parseFloat(p.tpPct) >= 40 ? "var(--accent-green)" : "var(--text-secondary)" }}>{p.tpPct}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== LAST 10 GAMES — fetched live from NBA API ===== */}
      {last10.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <Calendar size={18} style={{ color: "var(--accent-blue)" }} />
            Last 10 Games
          </h2>
          <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", overflow: "hidden" }}>
            {last10.map((g, idx) => {
              const opp = TEAMS[g.opp];
              return (
                <div
                  key={idx}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: idx < last10.length - 1 ? "1px solid var(--border-color)" : "none", transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="stat-number" style={{ fontSize: 11, color: "var(--text-muted)", width: 36 }}>{g.date}</span>
                    <div style={{ width: 20, height: 20, borderRadius: 4, background: opp?.color || "#888", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: "white" }}>{g.opp}</div>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{opp?.name || g.opp}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{g.home ? "vs." : "@"}</span>
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
      )}
    </div>
  );
}
