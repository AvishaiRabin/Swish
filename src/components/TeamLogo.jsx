import React, { useState } from "react";
import { TEAMS } from "../data/teams.js";

export default function TeamLogo({ abbr, size = 36, style = {} }) {
  const team = TEAMS[abbr] || {};
  const [failed, setFailed] = useState(false);
  const radius = Math.round(size * 0.22);

  if (failed || !team.teamId) {
    return (
      <div style={{
        width: size, height: size, borderRadius: radius,
        background: team.color || "#333",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: Math.round(size * 0.27), fontWeight: 800, color: "white",
        flexShrink: 0, ...style,
      }}>
        {abbr}
      </div>
    );
  }

  return (
    <img
      src={`https://cdn.nba.com/logos/nba/${team.teamId}/global/L/logo.svg`}
      alt={abbr}
      style={{ width: size, height: size, objectFit: "contain", flexShrink: 0, borderRadius: radius, ...style }}
      onError={() => setFailed(true)}
    />
  );
}
