import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, ReferenceLine,
} from "recharts";
import { Layers, Search, ChevronDown, ChevronUp, TrendingUp, Shield, Filter, Users, Info } from "lucide-react";
import { fetchLineups } from "../nbaApi.js";
import { TEAMS } from "../data/teams.js";
import TeamLogo from "../components/TeamLogo.jsx";
import { useLiveData } from "../context/LiveDataContext.jsx";

export default function LineupAnalyzerPage() {
  const liveData = useLiveData();
  const [view, setView] = useState("explorer"); // "explorer" | "matchups"
  const [selectedTeam, setSelectedTeam] = useState("BOS");
  const [groupSize, setGroupSize] = useState(5);
  const [playerFilter, setPlayerFilter] = useState([]);
  const [sortKey, setSortKey] = useState("netRtg");
  const [sortDir, setSortDir] = useState("desc");
  const [minMinutes, setMinMinutes] = useState(10);
  const [lineups, setLineups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [matchupData, setMatchupData] = useState(null);
  const [matchupLoading, setMatchupLoading] = useState(false);

  const team = TEAMS[selectedTeam] || {};

  // Fetch matchup data when switching to that tab
  useEffect(() => {
    if (view !== "matchups" || matchupData) return;
    setMatchupLoading(true);
    fetch("/api/db/lineup-profiles/matchups")
      .then((r) => r.json())
      .then((d) => { setMatchupData(d); setMatchupLoading(false); })
      .catch(() => setMatchupLoading(false));
  }, [view, matchupData]);

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
    { key: "gp", label: "GP", width: 44 },
    { key: "min", label: "MIN", width: 50 },
    { key: "netRtg", label: "NET", width: 56 },
    { key: "ortg", label: "ORTG", width: 54 },
    { key: "drtg", label: "DRTG", width: 54 },
    { key: "plusMinus", label: "+/-", width: 54 },
    { key: "pts", label: "PPG", width: 50 },
    { key: "fgPct", label: "FG%", width: 50 },
  ];

  const singleColumns = [
    { key: "name", label: "Player", width: "1fr", align: "left" },
    { key: "gp", label: "GP", width: 44 },
    { key: "mpg", label: "MPG", width: 52 },
    { key: "ppg", label: "PPG", width: 52 },
    { key: "rpg", label: "RPG", width: 52 },
    { key: "apg", label: "APG", width: 52 },
    { key: "fgPct", label: "FG%", width: 54 },
    { key: "plusMinus", label: "+/-", width: 56 },
  ];

  const columns = groupSize === 1 ? singleColumns : multiColumns;
  const firstColKey = groupSize === 1 ? "name" : "players";
  const gridTemplate = columns.map((c) => (typeof c.width === "number" ? `${c.width}px` : c.width)).join(" ");

  const ARCHETYPE_SHORT = {
    TWIN_TOWERS:      "Twin Towers",
    DEATH_LINEUP:     "Death Lineup",
    STRETCH_LINEUP:   "Stretch",
    PLAYMAKER_HEAVY:  "Playmaker Heavy",
    DEFENSIVE_LINEUP: "Defensive",
    WING_DOMINANT:    "Wing Dominant",
    STAR_AND_SHOOTERS:"Star + Shooters",
    BALANCED:         "Balanced",
  };

  const renderMatchupsTab = () => {
    if (matchupLoading) return (
      <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
        <div className="loading-spinner" style={{ width: 28, height: 28, border: "3px solid var(--border-color)", borderTopColor: "var(--accent)", borderRadius: "50%", margin: "0 auto 12px", animation: "spin 0.8s linear infinite" }} />
        Loading archetype data...
      </div>
    );
    if (!matchupData || matchupData.archetypes.length === 0) return (
      <div className="card-hover" style={{ padding: 32, textAlign: "center" }}>
        <Info size={32} style={{ color: "var(--text-muted)", marginBottom: 12 }} />
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No lineup archetype data yet. Run the server to populate lineup profiles.</p>
      </div>
    );

    const { archetypes, matrix } = matchupData;
    const labels = archetypes.map((a) => a.label);

    // Color helper for net rating
    const netColor = (v) => {
      const n = parseFloat(v);
      if (isNaN(n)) return "var(--text-muted)";
      return n > 2 ? "var(--accent-green)" : n < -2 ? "#ef4444" : "var(--text-secondary)";
    };

    // Color helper for matchup cell diff
    const cellBg = (v) => {
      if (v == null) return "transparent";
      if (v > 8)  return "rgba(34,197,94,0.25)";
      if (v > 3)  return "rgba(34,197,94,0.12)";
      if (v < -8) return "rgba(239,68,68,0.25)";
      if (v < -3) return "rgba(239,68,68,0.12)";
      return "rgba(255,255,255,0.03)";
    };

    return (
      <>
        {/* Archetype stats summary */}
        <div className="card-hover" style={{ padding: 20, marginBottom: 24, borderRadius: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 0, marginBottom: 16 }}>Archetype Performance Summary</h3>
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "180px repeat(5, 80px)", gap: 0, minWidth: 580 }}>
              {/* Header */}
              {["Archetype", "Lineups", "ORtg", "DRtg", "NET", "PPG"].map((h) => (
                <div key={h} style={{ padding: "6px 10px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid var(--border-color)", textAlign: h === "Archetype" ? "left" : "center" }}>{h}</div>
              ))}
              {/* Rows */}
              {archetypes.map((a) => (
                <React.Fragment key={a.label}>
                  <div style={{ padding: "10px 10px", fontSize: 13, fontWeight: 600, borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", display: "inline-block", flexShrink: 0 }} />
                    {ARCHETYPE_SHORT[a.label] || a.label.replace(/_/g, " ")}
                  </div>
                  <div style={{ padding: "10px 10px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", textAlign: "center", borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)" }}>{a.count}</div>
                  <div style={{ padding: "10px 10px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", textAlign: "center", borderBottom: "1px solid var(--border-color)", color: "var(--accent-blue)" }}>{a.avgOrtg}</div>
                  <div style={{ padding: "10px 10px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", textAlign: "center", borderBottom: "1px solid var(--border-color)", color: "#f59e0b" }}>{a.avgDrtg}</div>
                  <div style={{ padding: "10px 10px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", textAlign: "center", borderBottom: "1px solid var(--border-color)", fontWeight: 700, color: netColor(a.avgNetRtg) }}>{parseFloat(a.avgNetRtg) >= 0 ? `+${a.avgNetRtg}` : a.avgNetRtg}</div>
                  <div style={{ padding: "10px 10px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", textAlign: "center", borderBottom: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>{a.avgPts}</div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Matchup matrix */}
        <div className="card-hover" style={{ padding: 20, borderRadius: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 0, marginBottom: 4 }}>Matchup Matrix</h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 0, marginBottom: 16 }}>
            Projected point differential per 100 possessions — offense (row) vs defense (column). Based on each archetype's average ORtg and DRtg.
          </p>
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: `140px repeat(${labels.length}, 90px)`, gap: 2, minWidth: 140 + labels.length * 92 }}>
              {/* Corner + column headers */}
              <div style={{ padding: "6px 8px", fontSize: 10, color: "var(--text-muted)", fontWeight: 700 }}>OFF ↓ / DEF →</div>
              {labels.map((l) => (
                <div key={l} style={{ padding: "6px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                  {ARCHETYPE_SHORT[l] || l.replace(/_/g, " ")}
                </div>
              ))}
              {/* Rows */}
              {labels.map((offLabel) => (
                <React.Fragment key={offLabel}>
                  <div style={{ padding: "8px 8px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center" }}>
                    {ARCHETYPE_SHORT[offLabel] || offLabel.replace(/_/g, " ")}
                  </div>
                  {labels.map((defLabel) => {
                    const val = matrix[offLabel]?.[defLabel];
                    const isDiag = offLabel === defLabel;
                    return (
                      <div
                        key={defLabel}
                        title={`${ARCHETYPE_SHORT[offLabel] || offLabel} offense vs ${ARCHETYPE_SHORT[defLabel] || defLabel} defense`}
                        style={{
                          padding: "8px 4px",
                          textAlign: "center",
                          fontSize: 12,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 600,
                          borderRadius: 4,
                          background: isDiag ? "rgba(255,255,255,0.06)" : cellBg(val),
                          color: val == null ? "var(--text-muted)" : parseFloat(val) > 0 ? "var(--accent-green)" : parseFloat(val) < 0 ? "#ef4444" : "var(--text-secondary)",
                          border: isDiag ? "1px solid var(--border-color)" : "none",
                        }}
                      >
                        {val == null ? "—" : parseFloat(val) > 0 ? `+${val}` : val}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 0, marginTop: 16 }}>
            Green = offense advantage · Red = defense advantage · Diagonal = archetype vs itself
          </p>
        </div>
      </>
    );
  };

  return (
    <div className="fade-in" style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px 60px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 16 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
          <Users size={24} style={{ color: "var(--accent-blue)" }} />
          Lineup Analyzer
        </h1>

        <div style={{ display: "flex", gap: 4, borderBottom: "none" }}>
          {[{ key: "explorer", label: "Lineup Explorer" }, { key: "matchups", label: "Archetype Matchups" }].map((t) => (
            <button key={t.key} onClick={() => setView(t.key)} style={{
              padding: "8px 16px", fontSize: 13, fontWeight: view === t.key ? 600 : 400,
              color: view === t.key ? "var(--accent)" : "var(--text-muted)",
              background: view === t.key ? "rgba(249,115,22,0.1)" : "transparent",
              border: view === t.key ? "1px solid rgba(249,115,22,0.3)" : "1px solid transparent",
              borderRadius: 8, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "all 0.15s",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {view === "matchups" ? renderMatchupsTab() : (
      <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28 }}>
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
      </>
      )}
    </div>
  );
}
