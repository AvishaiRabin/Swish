import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, LineChart, Line,
} from "recharts";
import { ChevronLeft, Activity, Star, Trophy, BarChart3, Layers } from "lucide-react";
import { fetchBoxScore, fetchScoreboard, clearEndpointCache } from "../nbaApi.js";
import { TEAMS } from "../data/teams.js";
import TeamLogo from "../components/TeamLogo.jsx";
import PlayerHeadshot from "../components/PlayerHeadshot.jsx";
import Breadcrumb from "../components/Breadcrumb.jsx";
import { useLiveData } from "../context/LiveDataContext.jsx";

export default function GameDetailPage({ gameId, onBack, fallbackGame = null }) {
  const liveData = useLiveData();
  const liveGame = liveData.scoreboard.find((g) => g.id === gameId);
  const [fetchedGame, setFetchedGame] = useState(null);
  const game = liveGame ?? fallbackGame ?? fetchedGame;
  const mockDetail = null; // mockData.gameDetails not available in extracted version
  const [liveBoxScore, setLiveBoxScore] = useState(null);
  const [boxScoreLoading, setBoxScoreLoading] = useState(false);
  const [boxScoreTeam, setBoxScoreTeam] = useState("away"); // "away" | "home"

  // If we have no game object (e.g. direct navigation without fallback),
  // try to find it by scanning recent scoreboards (today + yesterday).
  useEffect(() => {
    if (liveGame || fallbackGame || !gameId) return;
    let cancelled = false;
    const today = new Date();
    const dates = [0, -1, -2].map((offset) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });
    (async () => {
      for (const date of dates) {
        if (cancelled) return;
        const games = await fetchScoreboard(date).catch(() => []);
        const found = games.find((g) => g.id === gameId);
        if (found && !cancelled) { setFetchedGame(found); return; }
      }
    })();
    return () => { cancelled = true; };
  }, [gameId, liveGame, fallbackGame]);

  // Fetch live box score from NBA API when no mock detail exists.
  useEffect(() => {
    if (!game || mockDetail) return;
    if (game.status === "UPCOMING") return;
    let cancelled = false;
    setBoxScoreLoading(true);
    clearEndpointCache("boxscoretraditionalv3");
    fetchBoxScore(gameId, game.homeTeam, game.awayTeam)
      .then((data) => { if (!cancelled && data) setLiveBoxScore(data); })
      .catch(() => { })
      .finally(() => { if (!cancelled) setBoxScoreLoading(false); });
    return () => { cancelled = true; };
  }, [gameId, game?.status, mockDetail]);

  const detail = mockDetail || liveBoxScore;

  if (!game) {
    return (
      <div className="fade-in" style={{ maxWidth: 1400, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: 16 }}>Game not found.</p>
        <button onClick={onBack} style={{ marginTop: 16, background: "var(--accent-blue)", border: "none", borderRadius: 8, padding: "8px 20px", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
          Back to Home
        </button>
      </div>
    );
  }

  const homeTeam = TEAMS[game.homeTeam];
  const awayTeam = TEAMS[game.awayTeam];
  const isLive = game.status === "LIVE";
  const isFinal = game.status === "FINAL";
  const hasDetail = !!detail;

  // Use tricodes from box score response (may differ from scoreboard tricodes)
  const homeKey = detail?.homeTricode || game.homeTeam;
  const awayKey = detail?.awayTricode || game.awayTeam;
  const homeStats = detail?.teamStats?.[homeKey];
  const awayStats = detail?.teamStats?.[awayKey];

  // Cumulative score line chart — built from per-period scores in the scoreboard data
  const PERIOD_LABELS = ["Q1", "Q2", "Q3", "Q4", "OT1", "OT2", "OT3"];
  const periodChartData = useMemo(() => {
    const hp = game.homePeriods || [];
    const ap = game.awayPeriods || [];
    if (!hp.length && !ap.length) return [];
    const len = Math.max(hp.length, ap.length);
    let homeRunning = 0, awayRunning = 0;
    // Start at 0 before Q1, then accumulate each period
    const points = [{ q: "Start", home: 0, away: 0 }];
    for (let i = 0; i < len; i++) {
      homeRunning += hp[i] ?? 0;
      awayRunning += ap[i] ?? 0;
      points.push({ q: PERIOD_LABELS[i] || `P${i + 1}`, home: homeRunning, away: awayRunning });
    }
    return points;
  }, [game.homePeriods, game.awayPeriods]);

  const boxScoreCols = [
    { key: "name", label: "Player", width: "1fr", align: "left" },
    { key: "pos", label: "Pos", width: 36, align: "center" },
    { key: "min", label: "Min", width: 46, align: "center" },
    { key: "pts", label: "PTS", width: 36, align: "center" },
    { key: "reb", label: "REB", width: 36, align: "center" },
    { key: "ast", label: "AST", width: 36, align: "center" },
    { key: "stl", label: "STL", width: 36, align: "center" },
    { key: "blk", label: "BLK", width: 36, align: "center" },
    { key: "fg", label: "FG", width: 48, align: "center" },
    { key: "tp", label: "3P", width: 48, align: "center" },
    { key: "ft", label: "FT", width: 42, align: "center" },
    { key: "to", label: "TO", width: 32, align: "center" },
    { key: "pf", label: "PF", width: 32, align: "center" },
    { key: "plusMinus", label: "+/-", width: 40, align: "center" },
  ];

  const boxGridTemplate = boxScoreCols
    .map((c) => (typeof c.width === "number" ? `${c.width}px` : c.width))
    .join(" ");

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--text-primary)" }}>{label}</div>
        {payload.map((p) => {
          const color = p.stroke || p.fill;
          const teamAbbr = p.dataKey === "home" ? game.homeTeam : game.awayTeam;
          const teamObj = TEAMS[teamAbbr];
          return (
            <div key={p.dataKey} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <div style={{ width: 20, height: 3, borderRadius: 2, background: color }} />
              <span style={{ color: "var(--text-secondary)" }}>
                {teamObj ? `${teamObj.city} ${teamObj.name}` : teamAbbr}:{" "}
                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{p.value}</span>
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderBoxScore = (teamAbbr, players) => {
    if (!players || players.length === 0) return null;
    return (
      <div>
        <div
          style={{
            background: "var(--bg-secondary)",
            borderRadius: 10,
            border: "1px solid var(--border-color)",
            overflow: "hidden",
            overflowX: "auto",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: boxGridTemplate,
              padding: "8px 14px",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              borderBottom: "1px solid var(--border-color)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              minWidth: 700,
            }}
          >
            {boxScoreCols.map((col) => (
              <span
                key={col.key}
                className={col.key !== "name" ? "stat-number" : ""}
                style={{ textAlign: col.align }}
              >
                {col.label}
              </span>
            ))}
          </div>
          {/* Rows */}
          {players.map((p, idx) => {
            const pm = parseInt(p.plusMinus);
            return (
              <div
                key={p.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: boxGridTemplate,
                  padding: "8px 14px",
                  fontSize: 12,
                  borderBottom: idx < players.length - 1 ? "1px solid var(--border-color)" : "none",
                  alignItems: "center",
                  transition: "background 0.15s",
                  minWidth: 700,
                  background: idx < 5 ? "transparent" : "rgba(255,255,255,0.01)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = idx < 5 ? "transparent" : "rgba(255,255,255,0.01)")}
              >
                <span style={{ fontWeight: idx < 5 ? 600 : 400, fontSize: 13 }}>{p.name}</span>
                <span className="stat-number" style={{ textAlign: "center", color: "var(--text-muted)" }}>{p.pos}</span>
                <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.min}</span>
                <span className="stat-number" style={{ textAlign: "center", fontWeight: 700, color: p.pts >= 20 ? "var(--accent-blue)" : "var(--text-primary)" }}>{p.pts}</span>
                <span className="stat-number" style={{ textAlign: "center", color: p.reb >= 10 ? "var(--accent-amber)" : "var(--text-secondary)" }}>{p.reb}</span>
                <span className="stat-number" style={{ textAlign: "center", color: p.ast >= 8 ? "var(--accent-amber)" : "var(--text-secondary)" }}>{p.ast}</span>
                <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.stl}</span>
                <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.blk}</span>
                <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.fgm}-{p.fga}</span>
                <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.tpm}-{p.tpa}</span>
                <span className="stat-number" style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.ftm}-{p.fta}</span>
                <span className="stat-number" style={{ textAlign: "center", color: p.to >= 4 ? "var(--accent-red)" : "var(--text-muted)" }}>{p.to}</span>
                <span className="stat-number" style={{ textAlign: "center", color: p.pf >= 4 ? "var(--accent-red)" : "var(--text-muted)" }}>{p.pf}</span>
                <span className="stat-number" style={{ textAlign: "center", fontWeight: 600, color: pm > 0 ? "var(--accent-green)" : pm < 0 ? "var(--accent-red)" : "var(--text-secondary)" }}>{p.plusMinus}</span>
              </div>
            );
          })}
          {/* Team totals */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: boxGridTemplate,
              padding: "10px 14px",
              fontSize: 12,
              borderTop: "2px solid var(--border-hover)",
              background: "var(--bg-tertiary)",
              fontWeight: 700,
              minWidth: 700,
            }}
          >
            <span style={{ fontSize: 13 }}>TOTALS</span>
            <span />
            <span />
            <span className="stat-number" style={{ textAlign: "center" }}>{players.reduce((s, p) => s + p.pts, 0)}</span>
            <span className="stat-number" style={{ textAlign: "center" }}>{players.reduce((s, p) => s + p.reb, 0)}</span>
            <span className="stat-number" style={{ textAlign: "center" }}>{players.reduce((s, p) => s + p.ast, 0)}</span>
            <span className="stat-number" style={{ textAlign: "center" }}>{players.reduce((s, p) => s + p.stl, 0)}</span>
            <span className="stat-number" style={{ textAlign: "center" }}>{players.reduce((s, p) => s + p.blk, 0)}</span>
            <span className="stat-number" style={{ textAlign: "center" }}>{players.reduce((s, p) => s + p.fgm, 0)}-{players.reduce((s, p) => s + p.fga, 0)}</span>
            <span className="stat-number" style={{ textAlign: "center" }}>{players.reduce((s, p) => s + p.tpm, 0)}-{players.reduce((s, p) => s + p.tpa, 0)}</span>
            <span className="stat-number" style={{ textAlign: "center" }}>{players.reduce((s, p) => s + p.ftm, 0)}-{players.reduce((s, p) => s + p.fta, 0)}</span>
            <span className="stat-number" style={{ textAlign: "center" }}>{players.reduce((s, p) => s + p.to, 0)}</span>
            <span className="stat-number" style={{ textAlign: "center" }}>{players.reduce((s, p) => s + p.pf, 0)}</span>
            <span />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in" style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 24px 60px" }}>
      <Breadcrumb items={[
        { label: "Home", onClick: () => onBack("home") },
        { label: `${awayTeam.name} vs ${homeTeam.name}` },
      ]} />

      {/* Scoreboard Header */}
      <div
        style={{
          background: "var(--bg-secondary)",
          borderRadius: 16,
          border: "1px solid var(--border-color)",
          padding: "28px 32px",
          marginBottom: 28,
        }}
      >
        {/* Status */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          {isLive ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(239, 68, 68, 0.15)", padding: "5px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "var(--accent-red)" }}>
              <div className="live-pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent-red)" }} />
              Q{game.quarter} — {game.timeRemaining}
            </span>
          ) : isFinal ? (
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", background: "var(--bg-tertiary)", padding: "5px 14px", borderRadius: 8 }}>Final</span>
          ) : (
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-blue)", background: "rgba(59, 130, 246, 0.1)", padding: "5px 14px", borderRadius: 8 }}>{game.scheduledTime}</span>
          )}
        </div>

        {/* Teams & Score */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 48 }}>
          {/* Away */}
          <div style={{ textAlign: "center", minWidth: 160 }}>
            <div style={{ margin: "0 auto 10px", width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TeamLogo abbr={game.awayTeam} size={56} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{awayTeam?.city}</div>
            <div style={{ fontSize: 15, color: "var(--text-secondary)" }}>{awayTeam?.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{awayTeam?.record}</div>
          </div>
          {/* Score */}
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <span className="stat-number" style={{ fontSize: 48, fontWeight: 800, color: game.awayScore >= game.homeScore ? "var(--text-primary)" : "var(--text-secondary)" }}>
                {game.status !== "UPCOMING" ? game.awayScore : "-"}
              </span>
              <span style={{ fontSize: 24, color: "var(--text-muted)", fontWeight: 300 }}>—</span>
              <span className="stat-number" style={{ fontSize: 48, fontWeight: 800, color: game.homeScore >= game.awayScore ? "var(--text-primary)" : "var(--text-secondary)" }}>
                {game.status !== "UPCOMING" ? game.homeScore : "-"}
              </span>
            </div>
            {game.broadcast && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{game.broadcast}</div>
            )}
          </div>
          {/* Home */}
          <div style={{ textAlign: "center", minWidth: 160 }}>
            <div style={{ margin: "0 auto 10px", width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TeamLogo abbr={game.homeTeam} size={56} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{homeTeam?.city}</div>
            <div style={{ fontSize: 15, color: "var(--text-secondary)" }}>{homeTeam?.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{homeTeam?.record}</div>
          </div>
        </div>

        {/* Quarter-by-Quarter */}
        {game.quarterScores && (
          <div style={{ marginTop: 24 }}>
            <table style={{ width: "100%", maxWidth: 480, margin: "0 auto", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--text-muted)" }}>
                  <th style={{ textAlign: "left", fontWeight: 500, padding: "6px 0" }}>Team</th>
                  {game.quarterScores.home.map((_, i) => (
                    <th key={i} className="stat-number" style={{ textAlign: "center", fontWeight: 500, padding: "6px 8px" }}>Q{i + 1}</th>
                  ))}
                  <th className="stat-number" style={{ textAlign: "center", fontWeight: 700, padding: "6px 8px", borderLeft: "1px solid var(--border-color)" }}>T</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderTop: "1px solid var(--border-color)" }}>
                  <td style={{ fontWeight: 600, padding: "8px 0", display: "flex", alignItems: "center", gap: 6 }}>
                    <TeamLogo abbr={game.awayTeam} size={18} />
                    {awayTeam?.name}
                  </td>
                  {game.quarterScores.away.map((s, i) => (
                    <td key={i} className="stat-number" style={{ textAlign: "center", padding: "8px 8px", color: s > game.quarterScores.home[i] ? "var(--text-primary)" : "var(--text-muted)" }}>{s}</td>
                  ))}
                  <td className="stat-number" style={{ textAlign: "center", fontWeight: 700, padding: "8px 8px", borderLeft: "1px solid var(--border-color)" }}>{game.awayScore}</td>
                </tr>
                <tr style={{ borderTop: "1px solid var(--border-color)" }}>
                  <td style={{ fontWeight: 600, padding: "8px 0", display: "flex", alignItems: "center", gap: 6 }}>
                    <TeamLogo abbr={game.homeTeam} size={18} />
                    {homeTeam?.name}
                  </td>
                  {game.quarterScores.home.map((s, i) => (
                    <td key={i} className="stat-number" style={{ textAlign: "center", padding: "8px 8px", color: s > game.quarterScores.away[i] ? "var(--text-primary)" : "var(--text-muted)" }}>{s}</td>
                  ))}
                  <td className="stat-number" style={{ textAlign: "center", fontWeight: 700, padding: "8px 8px", borderLeft: "1px solid var(--border-color)" }}>{game.homeScore}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Performers */}
      {game.topPerformers && (
        <div style={{ marginBottom: 28 }}>
          <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <Star size={18} style={{ color: "var(--accent-amber)" }} />
            Top Performers
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { side: "away", teamAbbr: game.awayTeam },
              { side: "home", teamAbbr: game.homeTeam },
            ].map(({ side, teamAbbr }) => {
              const p = game.topPerformers[side];
              const team = TEAMS[teamAbbr];
              return (
                <div
                  key={side}
                  style={{
                    background: "var(--bg-secondary)",
                    borderRadius: 12,
                    border: "1px solid var(--border-color)",
                    padding: "20px 24px",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <TeamLogo abbr={teamAbbr} size={48} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{team.city} {team.name}</div>
                    <div style={{ display: "flex", gap: 16 }}>
                      <div style={{ textAlign: "center" }}>
                        <div className="stat-number" style={{ fontSize: 20, fontWeight: 700, color: "var(--accent-blue)" }}>{p.pts}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>PTS</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div className="stat-number" style={{ fontSize: 20, fontWeight: 700 }}>{p.reb}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>REB</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div className="stat-number" style={{ fontSize: 20, fontWeight: 700 }}>{p.ast}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>AST</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Score Progression Line Chart */}
      {periodChartData.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <BarChart3 size={18} style={{ color: "var(--accent-blue)" }} />
            Score Progression
          </h2>
          <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border-color)", padding: "24px 20px" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                <div style={{ width: 24, height: 3, borderRadius: 2, background: homeTeam?.color }} />
                {homeTeam?.city} {homeTeam?.name} (Home)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                <div style={{ width: 24, height: 3, borderRadius: 2, background: awayTeam?.color }} />
                {awayTeam?.city} {awayTeam?.name} (Away)
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={periodChartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="q" axisLine={false} tickLine={false} tick={{ fill: "#9e8878", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9e8878", fontSize: 11 }} domain={["auto", "auto"]} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="home" name="home" stroke={homeTeam?.color} strokeWidth={2.5} dot={{ r: 5, fill: homeTeam?.color, strokeWidth: 0 }} activeDot={{ r: 7 }} />
                <Line type="monotone" dataKey="away" name="away" stroke={awayTeam?.color} strokeWidth={2.5} dot={{ r: 5, fill: awayTeam?.color, strokeWidth: 0 }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Box Scores */}
      {hasDetail && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
            <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <Layers size={18} style={{ color: "var(--accent-blue)" }} />
              Box Score
            </h2>
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { key: "away", abbr: game.awayTeam },
                { key: "home", abbr: game.homeTeam },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setBoxScoreTeam(t.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border-color)",
                    background: boxScoreTeam === t.key ? (TEAMS[t.abbr]?.color || "var(--accent)") : "transparent",
                    color: boxScoreTeam === t.key ? "#fff" : "var(--text-secondary)",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    fontFamily: "'Inter', sans-serif",
                    transition: "all 0.15s",
                  }}
                >
                  <TeamLogo abbr={t.abbr} size={16} />
                  {t.abbr}
                </button>
              ))}
            </div>
          </div>
          {boxScoreTeam === "away"
            ? renderBoxScore(game.awayTeam, detail.boxScore?.[awayKey])
            : renderBoxScore(game.homeTeam, detail.boxScore?.[homeKey])}
        </div>
      )}

      {/* Loading / fallback for games without detailed data */}
      {!hasDetail && game.status !== "UPCOMING" && (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <BarChart3 size={28} style={{ color: "var(--accent-blue)" }} />
          </div>
          {boxScoreLoading ? (
            <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>Loading box score…</p>
          ) : (
            <>
              <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>Box score data not available for this game.</p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>Data may not yet be available from the NBA API.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
