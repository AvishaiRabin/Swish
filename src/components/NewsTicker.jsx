import React from "react";
import { TEAMS } from "../data/teams.js";

function tickerTeamColor(abbr) {
  const team = TEAMS[abbr];
  if (!team) return "var(--text-secondary)";

  const darken = (hex) => {
    const h = hex.replace("#", "");
    const r = Math.round(parseInt(h.slice(0, 2), 16) * 0.5);
    const g = Math.round(parseInt(h.slice(2, 4), 16) * 0.5);
    const b = Math.round(parseInt(h.slice(4, 6), 16) * 0.5);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  };

  const isColorful = (hex) => {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return (Math.max(r, g, b) - Math.min(r, g, b)) / 255 >= 0.15;
  };

  if (isColorful(team.color)) return darken(team.color);
  if (isColorful(team.secondaryColor)) return darken(team.secondaryColor);
  return "var(--text-primary)";
}

export default function NewsTicker({ items }) {
  if (!items || items.length === 0) return null;

  const renderItem = (game, i) => {
    const isFinal = game.status === "FINAL";
    const isLive = game.status === "LIVE";
    const homeWon = isFinal && game.homeScore > game.awayScore;
    const awayWon = isFinal && game.awayScore > game.homeScore;

    return (
      <span
        key={i}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
      >
        {/* Date/status label */}
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.6px",
          textTransform: "uppercase",
          fontFamily: "'JetBrains Mono', monospace",
          color: isLive ? "#22c55e" : isFinal ? "var(--text-secondary)" : "var(--accent)",
          minWidth: 52,
        }}>
          {isLive ? "LIVE" : game.dateLabel}
        </span>

        {/* Away team */}
        <span style={{
          fontWeight: awayWon ? 700 : 600,
          color: tickerTeamColor(game.awayTeam),
          fontSize: 13,
          fontFamily: "'JetBrains Mono', monospace",
          opacity: isFinal && !awayWon ? 0.75 : 1,
        }}>
          {game.awayTeam}
        </span>

        {/* Score or vs */}
        {(isFinal || isLive) ? (
          <span style={{ color: "var(--text-secondary)", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ fontWeight: awayWon ? 700 : 500, color: awayWon ? "var(--text-primary)" : "var(--text-secondary)" }}>{game.awayScore}</span>
            {" \u2013 "}
            <span style={{ fontWeight: homeWon ? 700 : 500, color: homeWon ? "var(--text-primary)" : "var(--text-secondary)" }}>{game.homeScore}</span>
          </span>
        ) : (
          <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>@</span>
        )}

        {/* Home team */}
        <span style={{
          fontWeight: homeWon ? 700 : 600,
          color: tickerTeamColor(game.homeTeam),
          fontSize: 13,
          fontFamily: "'JetBrains Mono', monospace",
          opacity: isFinal && !homeWon ? 0.75 : 1,
        }}>
          {game.homeTeam}
        </span>

        {/* Time for upcoming, clock for live */}
        {isLive && (
          <span style={{ fontSize: 11, color: "#22c55e", fontFamily: "'JetBrains Mono', monospace" }}>
            Q{game.quarter} {game.timeRemaining}
          </span>
        )}
        {!isFinal && !isLive && game.scheduledTime && (
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", fontFamily: "'JetBrains Mono', monospace" }}>
            {game.scheduledTime}
          </span>
        )}

        {/* Separator */}
        <span style={{ color: "var(--text-secondary)", margin: "0 10px", fontSize: 14 }}>{"\u00b7"}</span>
      </span>
    );
  };

  const doubled = [...items, ...items];

  return (
    <div
      style={{
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border-color)",
        borderBottom: "1px solid var(--border-color)",
        padding: "9px 0",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div className="ticker-track">
        {doubled.map((g, i) => renderItem(g, i))}
      </div>
    </div>
  );
}
