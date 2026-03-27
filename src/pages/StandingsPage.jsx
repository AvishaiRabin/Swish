import React, { useState, useMemo, useEffect } from "react";
import { Trophy, ChevronDown, ChevronUp, Flame, Shield, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { TEAMS } from "../data/teams.js";
import { useLiveData } from "../context/LiveDataContext.jsx";
import TeamLogo from "../components/TeamLogo.jsx";
import { fetchEloRatings } from "../nbaApi.js";

export default function StandingsPage() {
  const TOTAL_GAMES = 82;
  const liveData = useLiveData();
  const [viewMode, setViewMode] = useState("conference"); // "conference" | "division" | "power"
  const [confTab, setConfTab] = useState("West"); // "East" | "West"
  const [divTab, setDivTab] = useState("Atlantic"); // one of the 6 divisions
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [eloData, setEloData] = useState(null);

  useEffect(() => {
    fetchEloRatings().then((d) => { if (d?.teams?.length) setEloData(d); }).catch(() => {});
  }, []);

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
            const streak = row.streak || "\u2014";
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
            const streak = row.streak || "\u2014";
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

  const renderPowerRankings = () => {
    if (!eloData?.teams?.length) {
      return (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
          <TrendingUp size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontSize: 14 }}>Elo ratings not yet computed.</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Run <code>python ml/elo_model.py</code> to generate.</p>
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 110px 110px 110px 140px", gap: 0, padding: "10px 16px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}>
          {["RK", "TEAM", "ELO", "TREND (L10)", "PEAK", "LAST 5"].map((h) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }}>{h}</span>
          ))}
        </div>
        {eloData.teams.map((t, i) => {
          const teamInfo = TEAMS[t.team];
          const trendColor = t.trend > 5 ? "var(--accent-green)" : t.trend < -5 ? "var(--accent-red)" : "var(--text-secondary)";
          const TrendIcon = t.trend > 5 ? TrendingUp : t.trend < -5 ? TrendingDown : Minus;
          return (
            <div
              key={t.team}
              style={{
                display: "grid",
                gridTemplateColumns: "48px 1fr 110px 110px 110px 140px",
                gap: 0,
                padding: "12px 16px",
                borderBottom: i < eloData.teams.length - 1 ? "1px solid var(--border-color)" : "none",
                background: i % 2 === 0 ? "var(--bg-primary)" : "var(--bg-secondary)",
                alignItems: "center",
              }}
            >
              {/* Rank */}
              <span style={{ fontSize: 14, fontWeight: 700, color: i < 3 ? "var(--accent-amber)" : "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>
                #{t.rank}
              </span>
              {/* Team */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <TeamLogo abbr={t.team} size={28} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{teamInfo?.city || t.team} {teamInfo?.name || ""}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.team}</div>
                </div>
              </div>
              {/* Elo */}
              <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: "var(--text-primary)" }}>
                {t.elo.toFixed(0)}
              </span>
              {/* Trend */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, color: trendColor }}>
                <TrendIcon size={14} />
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                  {t.trend >= 0 ? "+" : ""}{t.trend.toFixed(1)}
                </span>
              </div>
              {/* Peak */}
              <span style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "'JetBrains Mono', monospace" }}>
                {t.peak?.toFixed(0) ?? "—"}
              </span>
              {/* Last 5 W/L dots */}
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {(t.last5 || []).map((g, gi) => (
                  <div
                    key={gi}
                    title={`vs ${g.opponent}: ${g.win ? "W" : "L"} ${g.margin > 0 ? "+" : ""}${g.margin}`}
                    style={{
                      width: 20, height: 20,
                      borderRadius: "50%",
                      background: g.win ? "var(--accent-green)" : "var(--accent-red)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 800, color: "white",
                    }}
                  >
                    {g.win ? "W" : "L"}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
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
          {viewMode === "conference" && viewMode !== "power" && (
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
          {/* Conference / Division / Power */}
          <div style={{ display: "flex", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 8, overflow: "hidden" }}>
            {[
              { key: "conference", label: "Conference" },
              { key: "division", label: "Division" },
              { key: "power", label: "Power Rankings" },
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
      {viewMode !== "power" && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
          Click any column header to sort. Click again to reverse. Click a third time to reset.
        </p>
      )}

      {/* Tables */}
      {viewMode === "conference" ? (
        renderConferenceTable(confTab, liveData.standings[confTab])
      ) : viewMode === "division" ? (
        renderDivisionView()
      ) : (
        renderPowerRankings()
      )}
    </div>
  );
}
