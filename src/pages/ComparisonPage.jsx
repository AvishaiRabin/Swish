import React, { useState, useEffect, useMemo } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from "recharts";
import { Search, X, Layers, TrendingUp, Star, BarChart3 } from "lucide-react";
import { TEAMS } from "../data/teams.js";
import { fetchTeamStats } from "../nbaApi.js";
import { PLAYERS } from "../data/players.js";
import { useLiveData } from "../context/LiveDataContext.jsx";
import TeamLogo from "../components/TeamLogo.jsx";
import PlayerHeadshot from "../components/PlayerHeadshot.jsx";

export default function ComparisonPage() {
  const liveData = useLiveData();
  const [allTeamStats, setAllTeamStats] = useState({});
  useEffect(() => {
    fetchTeamStats().then((data) => {
      if (data?.length) {
        const map = {};
        data.forEach((t) => { map[t.team] = t; });
        setAllTeamStats(map);
      }
    }).catch(() => {});
  }, []);
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
    const d = allTeamStats[abbr];
    const gp = st.wins + st.losses;

    const base = {
      wins: st.wins, losses: st.losses,
      ppg: d?.ppg || st.ppg, oppPpg: d?.opp_ppg || st.oppPpg,
      fgPct: d?.efg_pct || 50.0,
      pace: d?.pace || 100.0,
      ortg: d?.ortg || 110.0,
      drtg: d?.drtg || 112.0,
      netRtg: d?.net_rtg || 0,
      reb: 42, ast: 24, // aggregate estimates; no roster dependency
    };

    if (statMode === "totals") {
      return { ...base, ppg: +(base.ppg * gp).toFixed(0), oppPpg: +(base.oppPpg * gp).toFixed(0), reb: +(base.reb * gp).toFixed(0), ast: +(base.ast * gp).toFixed(0) };
    }
    return base;
  };

  const leftStats = useMemo(() => leftId ? (isPlayerMode ? getPlayerStats(leftId) : getTeamStats(leftId)) : null, [leftId, isPlayerMode, statMode, allTeamStats]);
  const rightStats = useMemo(() => rightId ? (isPlayerMode ? getPlayerStats(rightId) : getTeamStats(rightId)) : null, [rightId, isPlayerMode, statMode, allTeamStats]);

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
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: leftItem?.color || "#f97316" }} />
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
                  <Radar name={leftItem?.label || "Left"} dataKey="left" stroke={leftItem?.color || "#f97316"} fill={leftItem?.color || "#f97316"} fillOpacity={0.2} strokeWidth={2} />
                  <Radar name={rightItem?.label || "Right"} dataKey="right" stroke={rightItem?.color || "#ef4444"} fill={rightItem?.color || "#ef4444"} fillOpacity={0.2} strokeWidth={2} />
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
