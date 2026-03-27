import React from "react";
import { TEAMS } from "../data/teams.js";
import TeamLogo from "./TeamLogo.jsx";

export default function GameCard({ game, onClick, prediction = null }) {
  const homeTeam = TEAMS[game.homeTeam];
  const awayTeam = TEAMS[game.awayTeam];
  const isLive = game.status === "LIVE";
  const isFinal = game.status === "FINAL";
  const isUpcoming = game.status === "UPCOMING";

  // Win probability — prefer XGBoost, fall back to Claude confidence
  const homeWinProb = isUpcoming && prediction
    ? prediction.home_win_prob != null
      ? prediction.home_win_prob
      : prediction.predictedWinner === game.homeTeam
        ? (prediction.confidence || 0.6)
        : 1 - (prediction.confidence || 0.6)
    : null;
  const awayWinProb = homeWinProb != null ? 1 - homeWinProb : null;

  return (
    <div
      className="card-hover"
      onClick={onClick}
      style={{
        background: "var(--bg-secondary)",
        borderRadius: 12,
        padding: 20,
        cursor: "pointer",
      }}
    >
      {/* Status */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        {isLive ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(239, 68, 68, 0.15)",
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              color: "var(--accent-red)",
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
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              background: "var(--bg-tertiary)",
              padding: "4px 10px",
              borderRadius: 6,
            }}
          >
            Final
          </span>
        ) : (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--accent-blue)",
              background: "rgba(59, 130, 246, 0.1)",
              padding: "4px 10px",
              borderRadius: 6,
            }}
          >
            {game.scheduledTime}
          </span>
        )}
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {game.broadcast}
        </span>
      </div>

      {/* Matchup */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Away Team */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <TeamLogo abbr={game.awayTeam} size={36} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{awayTeam?.city} {awayTeam?.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{awayTeam?.record}</div>
            </div>
          </div>
          <span className="stat-number" style={{ fontSize: 24, fontWeight: 700, color: !isUpcoming ? game.awayScore >= game.homeScore ? "var(--text-primary)" : "var(--text-secondary)" : "var(--text-muted)" }}>
            {!isUpcoming ? game.awayScore : "-"}
          </span>
        </div>

        {/* Home Team */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <TeamLogo abbr={game.homeTeam} size={36} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{homeTeam?.city} {homeTeam?.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{homeTeam?.record}</div>
            </div>
          </div>
          <span className="stat-number" style={{ fontSize: 24, fontWeight: 700, color: !isUpcoming ? game.homeScore >= game.awayScore ? "var(--text-primary)" : "var(--text-secondary)" : "var(--text-muted)" }}>
            {!isUpcoming ? game.homeScore : "-"}
          </span>
        </div>
      </div>

      {/* Prediction section — upcoming games only */}
      {isUpcoming && prediction && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--border-color)", paddingTop: 12 }}>
          {/* Win probability bar */}
          {homeWinProb != null && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: awayTeam?.color }}>{game.awayTeam} {Math.round(awayWinProb * 100)}%</span>
                <span style={{ fontWeight: 600, color: homeTeam?.color }}>{Math.round(homeWinProb * 100)}% {game.homeTeam}</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: "var(--bg-tertiary)", overflow: "hidden", display: "flex" }}>
                <div style={{ width: `${awayWinProb * 100}%`, background: awayTeam?.color || "var(--accent-blue)", transition: "width 0.4s" }} />
                <div style={{ flex: 1, background: homeTeam?.color || "var(--accent)" }} />
              </div>
            </div>
          )}

          {/* Pick + spread */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Pick:</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                {prediction.predictedWinner}
                {prediction.spread != null && (
                  <span style={{ fontWeight: 500, color: "var(--text-muted)", marginLeft: 4 }}>
                    {prediction.spread > 0 ? `+${prediction.spread}` : prediction.spread}
                  </span>
                )}
              </span>
            </div>
            <div style={{ display: "flex", gap: 2 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i < Math.round((prediction.confidence || 0.6) * 4) ? "var(--accent-blue)" : "var(--bg-tertiary)" }} />
              ))}
            </div>
          </div>

          {/* Predicted score */}
          {prediction.awayScorePred != null && prediction.homeScorePred != null && (
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
              {game.awayTeam} {prediction.awayScorePred} – {prediction.homeScorePred} {game.homeTeam} projected
            </div>
          )}

          {/* Upset alert */}
          {prediction.upsetAlert && (
            <div style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.12)", padding: "3px 8px", borderRadius: 4, display: "inline-block" }}>
              ⚡ UPSET WATCH
            </div>
          )}
        </div>
      )}

      {/* Quarter-by-Quarter (if finished or live) */}
      {game.quarterScores && (
        <div
          style={{
            marginTop: 14,
            borderTop: "1px solid var(--border-color)",
            paddingTop: 12,
          }}
        >
          <table
            style={{
              width: "100%",
              fontSize: 11,
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                <th style={{ textAlign: "left", fontWeight: 500, padding: "2px 0" }}>
                  Team
                </th>
                {game.quarterScores.home.map((_, i) => (
                  <th
                    key={i}
                    className="stat-number"
                    style={{ textAlign: "center", fontWeight: 500, padding: "2px 4px" }}
                  >
                    Q{i + 1}
                  </th>
                ))}
                <th
                  className="stat-number"
                  style={{ textAlign: "center", fontWeight: 700, padding: "2px 4px" }}
                >
                  T
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600, padding: "2px 0" }}>
                  {game.awayTeam}
                </td>
                {game.quarterScores.away.map((s, i) => (
                  <td
                    key={i}
                    className="stat-number"
                    style={{ textAlign: "center", padding: "2px 4px", color: "var(--text-secondary)" }}
                  >
                    {s}
                  </td>
                ))}
                <td
                  className="stat-number"
                  style={{ textAlign: "center", fontWeight: 700, padding: "2px 4px" }}
                >
                  {game.awayScore}
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, padding: "2px 0" }}>
                  {game.homeTeam}
                </td>
                {game.quarterScores.home.map((s, i) => (
                  <td
                    key={i}
                    className="stat-number"
                    style={{ textAlign: "center", padding: "2px 4px", color: "var(--text-secondary)" }}
                  >
                    {s}
                  </td>
                ))}
                <td
                  className="stat-number"
                  style={{ textAlign: "center", fontWeight: 700, padding: "2px 4px" }}
                >
                  {game.homeScore}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Top Performers */}
      {game.topPerformers && (
        <div
          style={{
            marginTop: 12,
            borderTop: "1px solid var(--border-color)",
            paddingTop: 12,
            display: "flex",
            gap: 12,
          }}
        >
          {[
            { side: "away", team: game.awayTeam },
            { side: "home", team: game.homeTeam },
          ].map(({ side, team }) => {
            const p = game.topPerformers[side];
            return (
              <div
                key={side}
                style={{
                  flex: 1,
                  background: "var(--bg-tertiary)",
                  borderRadius: 8,
                  padding: "8px 10px",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted)",
                    marginBottom: 3,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Top — {team}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                  {p.name}
                </div>
                <div
                  className="stat-number"
                  style={{ fontSize: 11, color: "var(--text-secondary)" }}
                >
                  {p.pts} PTS · {p.reb} REB · {p.ast} AST
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
