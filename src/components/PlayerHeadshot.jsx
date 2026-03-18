import React, { useState } from "react";

export default function PlayerHeadshot({ nbaId, name, size = 64, teamColor = "#333", style = {} }) {
  const [failed, setFailed] = useState(false);
  const radius = Math.round(size * 0.22);
  if (failed || !nbaId) {
    return (
      <div style={{ width: size, height: size, borderRadius: radius, background: teamColor + "22", border: `2px solid ${teamColor}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...style }}>
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke={teamColor} strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
      </div>
    );
  }
  return (
    <img
      src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaId}.png`}
      alt={name}
      style={{ width: size, height: size, objectFit: "cover", objectPosition: "top center", borderRadius: radius, flexShrink: 0, ...style }}
      onError={() => setFailed(true)}
    />
  );
}
