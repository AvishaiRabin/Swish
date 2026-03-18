import React, { useState, useMemo } from "react";
import { Search, Shield } from "lucide-react";
import { TEAMS } from "../data/teams.js";
import TeamLogo from "../components/TeamLogo.jsx";

export default function TeamBrowsePage({ onTeamSelect }) {
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
