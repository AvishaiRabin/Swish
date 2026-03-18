import React from "react";
import { Trophy, Flame } from "lucide-react";
import { TEAMS } from "../data/teams.js";

export default function StandingsTable({ conference, teams, onViewFull }) {
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
          const streak = row.streak || "\u2014";
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
