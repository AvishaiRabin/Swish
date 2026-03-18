import React, { useState, useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { TEAMS } from "../data/teams.js";
import { useLiveData } from "../context/LiveDataContext.jsx";
import TeamLogo from "./TeamLogo.jsx";

export default function LeagueLeaders({ data, onPlayerClick }) {
  const liveData = useLiveData();
  const categories = Object.keys(data || {});
  const [activeCategory, setActiveCategory] = useState(categories[0] || "");

  // Build a name->team map from live player stats (always current-season teams)
  const liveTeamMap = useMemo(() => {
    const map = {};
    (liveData.livePlayers || []).forEach((lp) => { map[lp.name] = lp.team; });
    return map;
  }, [liveData.livePlayers]);

  // Keep activeCategory valid when data changes (e.g. live -> mock switch)
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
            Loading leaders...
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
