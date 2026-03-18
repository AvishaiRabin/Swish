import React from "react";
import { TEAMS } from "../data/teams.js";
import TeamLogo from "./TeamLogo.jsx";

export default function ScoreCard({ game, onClick }) {
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
