import React, { useState, useEffect, useMemo } from "react";
import { TrendingUp, Trophy, Target, ChevronRight } from "lucide-react";
import { useLiveData } from "../context/LiveDataContext.jsx";
import { fetchTickerData, fetchPredictionsToday, fetchXGBoostPredictions, fetchPredictionAccuracy, fetchPredictionHistory } from "../nbaApi.js";
import ScoreboardTicker from "../components/ScoreboardTicker.jsx";
import LeagueLeaders from "../components/LeagueLeaders.jsx";
import NewsTicker from "../components/NewsTicker.jsx";
import { TEAMS } from "../data/teams.js";
import TeamLogo from "../components/TeamLogo.jsx";

export default function HomePage({ onGameClick, onPlayerClick, onNavigate }) {
  const liveData = useLiveData();
  const [tickerItems, setTickerItems] = useState([]);
  const [claudePreds, setClaudePreds] = useState([]);
  const [xgbPreds, setXgbPreds] = useState([]);
  const [accuracy, setAccuracy] = useState(null);
  const [predHistory, setPredHistory] = useState(null);

  useEffect(() => {
    fetchTickerData().then(setTickerItems).catch(() => { });
  }, []);

  useEffect(() => {
    Promise.allSettled([
      fetchPredictionsToday(),
      fetchXGBoostPredictions(),
      fetchPredictionAccuracy(),
      fetchPredictionHistory(2),
    ]).then(([cp, xp, ap, hp]) => {
      if (cp.status === "fulfilled") setClaudePreds(cp.value?.predictions || []);
      if (xp.status === "fulfilled") setXgbPreds(xp.value?.predictions || []);
      if (ap.status === "fulfilled") setAccuracy(ap.value?.overall ?? null);
      if (hp.status === "fulfilled") setPredHistory(hp.value);
    });
  }, []);

  const sortedGames = useMemo(() => {
    const order = { LIVE: 0, FINAL: 1, UPCOMING: 2 };
    return [...liveData.scoreboard].sort(
      (a, b) => order[a.status] - order[b.status]
    );
  }, [liveData.scoreboard]);

  // Merge Claude + XGBoost predictions keyed by homeTeam-awayTeam
  const predMap = useMemo(() => {
    const map = {};
    for (const p of claudePreds) {
      const key = `${p.homeTeam}-${p.awayTeam}`;
      map[key] = { ...p };
    }
    for (const p of xgbPreds) {
      // XGBoost uses snake_case: home_team / away_team
      const ht = p.homeTeam || p.home_team;
      const at = p.awayTeam || p.away_team;
      const key = `${ht}-${at}`;
      if (map[key]) {
        map[key].home_win_prob = p.home_win_prob;
        map[key].xgb_spread = p.predicted_spread;
      } else {
        map[key] = { homeTeam: ht, awayTeam: at, ...p };
      }
    }
    return map;
  }, [claudePreds, xgbPreds]);

  // Yesterday's prediction results — find the most recent date with graded picks
  const yesterdayPicks = useMemo(() => {
    if (!predHistory) return null;
    const dates = Object.keys(predHistory).sort((a, b) => b.localeCompare(a));
    if (!dates.length) return null;
    const date = dates[0];
    const picks = predHistory[date];
    if (!picks?.length) return null;
    const correct = picks.filter((p) => p.correct).length;
    return { date, picks, correct, total: picks.length };
  }, [predHistory]);

  // Most competitive upcoming game (win prob closest to 0.5)
  const gameOfTheNight = useMemo(() => {
    const upcoming = sortedGames.filter((g) => g.status === "UPCOMING");
    if (!upcoming.length) return null;
    const withProb = upcoming.map((g) => {
      const pred = predMap[`${g.homeTeam}-${g.awayTeam}`];
      const prob = pred?.home_win_prob ?? 0.5;
      return { game: g, pred, dist: Math.abs(prob - 0.5) };
    });
    withProb.sort((a, b) => a.dist - b.dist);
    return withProb[0];
  }, [sortedGames, predMap]);

  return (
    <div className="fade-in" style={{ paddingBottom: 40 }}>
      {/* Score Ticker */}
      <NewsTicker items={tickerItems} />

      {/* Scoreboard Ticker */}
      <div style={{ padding: "24px 0" }}>
        <ScoreboardTicker games={sortedGames} onGameClick={onGameClick} />
      </div>

      {/* Main Content */}
      <div
        className="home-grid"
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0 24px",
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 24,
        }}
      >
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

          {/* Game of the Night hero */}
          {gameOfTheNight && (() => {
            const { game, pred } = gameOfTheNight;
            const home = TEAMS[game.homeTeam];
            const away = TEAMS[game.awayTeam];
            const homeProb = pred?.home_win_prob ?? 0.5;
            const awayProb = 1 - homeProb;
            return (
              <section>
                <h2
                  className="font-display"
                  style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}
                >
                  <span style={{ color: "#f59e0b" }}>★</span>
                  Game of the Night
                </h2>
                <div
                  className="card-hover"
                  onClick={() => onGameClick(game.id, game)}
                  style={{
                    borderRadius: 16,
                    padding: 24,
                    cursor: "pointer",
                    background: `linear-gradient(135deg, ${away?.color}22 0%, var(--bg-secondary) 45%, ${home?.color}22 100%)`,
                    border: "1px solid var(--border-color)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ position: "absolute", top: 12, right: 14, fontSize: 11, color: "var(--accent-blue)", fontWeight: 600 }}>
                    {game.scheduledTime}
                    {game.broadcast && <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>{game.broadcast}</span>}
                  </div>

                  {/* Teams */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <TeamLogo abbr={game.awayTeam} size={56} />
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{away?.city}</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{away?.record}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>@</div>
                      {pred?.awayScorePred != null && (
                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>
                          {pred.awayScorePred} – {pred.homeScorePred}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>projected</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <TeamLogo abbr={game.homeTeam} size={56} />
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{home?.city}</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{home?.record}</div>
                      </div>
                    </div>
                  </div>

                  {/* Big win probability bar */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: away?.color }}>{game.awayTeam} {Math.round(awayProb * 100)}%</span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)", alignSelf: "center" }}>win probability</span>
                      <span style={{ fontWeight: 700, color: home?.color }}>{Math.round(homeProb * 100)}% {game.homeTeam}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: "var(--bg-tertiary)", overflow: "hidden", display: "flex" }}>
                      <div style={{ width: `${awayProb * 100}%`, background: away?.color || "var(--accent-blue)", transition: "width 0.5s" }} />
                      <div style={{ flex: 1, background: home?.color || "var(--accent)" }} />
                    </div>
                  </div>

                  {/* Pick + upset badge */}
                  {pred?.predictedWinner && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>AI Pick:</span>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>
                        {pred.predictedWinner}
                        {pred.spread != null && (
                          <span style={{ fontWeight: 500, color: "var(--text-muted)", marginLeft: 4 }}>
                            {pred.spread > 0 ? `+${pred.spread}` : pred.spread}
                          </span>
                        )}
                      </span>
                      {pred.upsetAlert && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.12)", padding: "2px 8px", borderRadius: 4 }}>
                          ⚡ UPSET WATCH
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </section>
            );
          })()}

          {/* Standings Snapshot */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2
                className="font-display"
                style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}
              >
                <Trophy size={18} style={{ color: "#f59e0b" }} />
                Playoff Picture
              </h2>
              <button
                onClick={() => onNavigate("standings")}
                style={{ background: "none", border: "none", color: "var(--accent-blue)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}
              >
                Full Standings <ChevronRight size={14} />
              </button>
            </div>
            <div className="standings-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {["East", "West"].map((conf) => {
                const teams = (liveData.standings?.[conf] || []).slice(0, 10);
                return (
                  <div key={conf} style={{ background: "var(--bg-secondary)", borderRadius: 12, padding: 16, border: "1px solid var(--border-color)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
                      {conf}ern Conference
                    </div>
                    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ color: "var(--text-muted)", fontSize: 10 }}>
                          <th style={{ textAlign: "left", fontWeight: 500, padding: "0 0 6px" }}>#</th>
                          <th style={{ textAlign: "left", fontWeight: 500, padding: "0 0 6px" }}>Team</th>
                          <th className="stat-number" style={{ textAlign: "right", fontWeight: 500, padding: "0 0 6px" }}>W-L</th>
                          <th className="stat-number" style={{ textAlign: "right", fontWeight: 500, padding: "0 0 6px" }}>GB</th>
                          <th className="stat-number" style={{ textAlign: "right", fontWeight: 500, padding: "0 0 6px" }}>Diff</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teams.map((row, i) => {
                          const team = TEAMS[row.team];
                          const diffNum = parseFloat(row.diff);
                          const isPlayIn = i >= 6 && i < 10;
                          const isPlayoffLine = i === 5;
                          return (
                            <tr
                              key={row.team}
                              onClick={() => onNavigate("teamDetail", row.team)}
                              style={{
                                cursor: "pointer",
                                borderTop: isPlayoffLine ? "2px solid var(--accent-blue)" : isPlayIn && i === 6 ? "1px dashed var(--border-color)" : "none",
                              }}
                              onMouseOver={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"}
                              onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                            >
                              <td style={{ padding: "5px 4px 5px 0", color: i < 6 ? "var(--accent-blue)" : "var(--text-muted)", fontWeight: 600, fontSize: 10 }}>
                                {i + 1}
                              </td>
                              <td style={{ padding: "5px 0", display: "flex", alignItems: "center", gap: 6 }}>
                                <TeamLogo abbr={row.team} size={18} />
                                <span style={{ fontWeight: 600, fontSize: 12 }}>{team?.name || row.team}</span>
                                {row.streak && row.streak.startsWith("W") && parseInt(row.streak.slice(1)) >= 5 && (
                                  <span style={{ fontSize: 9, color: "var(--accent-green)", fontWeight: 700 }}>{row.streak}</span>
                                )}
                              </td>
                              <td className="stat-number" style={{ textAlign: "right", padding: "5px 0", fontSize: 11 }}>
                                {row.wins}-{row.losses}
                              </td>
                              <td className="stat-number" style={{ textAlign: "right", padding: "5px 0", fontSize: 11, color: "var(--text-muted)" }}>
                                {row.gb}
                              </td>
                              <td className="stat-number" style={{ textAlign: "right", padding: "5px 0", fontSize: 11, color: diffNum > 0 ? "var(--accent-green)" : diffNum < 0 ? "var(--accent-red)" : "var(--text-muted)" }}>
                                {row.diff}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {teams.length > 6 && (
                      <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 6, textAlign: "center", fontStyle: "italic" }}>
                        — play-in tournament —
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Yesterday's Picks */}
          {yesterdayPicks && (
            <section>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2
                  className="font-display"
                  style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}
                >
                  <Target size={18} style={{ color: "var(--accent-blue)" }} />
                  Yesterday's Picks
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="stat-number" style={{ fontSize: 14, fontWeight: 700, color: yesterdayPicks.correct / yesterdayPicks.total >= 0.6 ? "var(--accent-green)" : "var(--text-primary)" }}>
                    {yesterdayPicks.correct}/{yesterdayPicks.total}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>correct</span>
                </div>
              </div>
              <div className="picks-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                {yesterdayPicks.picks.map((pick, i) => {
                  const home = TEAMS[pick.homeTeam];
                  const away = TEAMS[pick.awayTeam];
                  return (
                    <div
                      key={i}
                      style={{
                        background: "var(--bg-secondary)",
                        borderRadius: 10,
                        padding: "12px 14px",
                        border: `1px solid ${pick.correct ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.2)"}`,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      {/* Hit/Miss indicator */}
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                        background: pick.correct ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.12)",
                        color: pick.correct ? "var(--accent-green)" : "var(--accent-red)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700,
                      }}>
                        {pick.correct ? "\u2713" : "\u2717"}
                      </div>

                      {/* Matchup */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <TeamLogo abbr={pick.awayTeam} size={16} />
                          <span style={{ fontSize: 12, fontWeight: pick.actualWinner === pick.awayTeam ? 700 : 400, color: pick.actualWinner === pick.awayTeam ? "var(--text-primary)" : "var(--text-secondary)" }}>
                            {away?.name || pick.awayTeam}
                          </span>
                          <span className="stat-number" style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
                            {pick.awayScoreActual}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <TeamLogo abbr={pick.homeTeam} size={16} />
                          <span style={{ fontSize: 12, fontWeight: pick.actualWinner === pick.homeTeam ? 700 : 400, color: pick.actualWinner === pick.homeTeam ? "var(--text-primary)" : "var(--text-secondary)" }}>
                            {home?.name || pick.homeTeam}
                          </span>
                          <span className="stat-number" style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
                            {pick.homeScoreActual}
                          </span>
                        </div>
                      </div>

                      {/* AI Pick label */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Pick</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: pick.correct ? "var(--accent-green)" : "var(--accent-red)" }}>
                          {pick.predictedWinner}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Model Performance widget */}
          {accuracy && (
            <div style={{ background: "var(--bg-secondary)", borderRadius: 14, padding: 20, border: "1px solid var(--border-color)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <h3
                    className="font-display"
                    style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}
                  >
                    <TrendingUp size={15} style={{ color: "var(--accent-blue)" }} />
                    AI Predictions
                  </h3>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Claude Sonnet picks graded vs. actual results
                  </div>
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 700, color: "var(--accent-blue)",
                  background: "rgba(59,130,246,0.1)", padding: "3px 8px",
                  borderRadius: 4, letterSpacing: "0.5px", whiteSpace: "nowrap",
                }}>
                  CLAUDE
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                {[
                  { label: "Win Rate", value: accuracy.pct != null ? `${accuracy.pct}%` : "—" },
                  { label: "Record", value: accuracy.correct != null ? `${accuracy.correct}-${accuracy.total - accuracy.correct}` : "—" },
                  { label: "Total Picks", value: accuracy.total ?? "—" },
                  { label: "Spread Error", value: accuracy.avgSpreadError != null ? `${accuracy.avgSpreadError} pts` : "—" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
                    <div className="stat-number" style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
                  </div>
                ))}
              </div>
              {accuracy.pct != null && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>
                    <span>Accuracy</span>
                    <span>{accuracy.pct}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--bg-tertiary)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${accuracy.pct}%`, background: "var(--accent-blue)", borderRadius: 3, transition: "width 0.5s" }} />
                  </div>
                </>
              )}
            </div>
          )}

          {/* XGBoost Model card */}
          <div style={{ background: "var(--bg-secondary)", borderRadius: 14, padding: 20, border: "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <h3
                  className="font-display"
                  style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}
                >
                  <TrendingUp size={15} style={{ color: "var(--accent-green)" }} />
                  Statistical Model
                </h3>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  XGBoost trained on 3,400+ games
                </div>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, color: "var(--accent-green)",
                background: "rgba(34,197,94,0.1)", padding: "3px 8px",
                borderRadius: 4, letterSpacing: "0.5px", whiteSpace: "nowrap",
              }}>
                XGBOOST
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {[
                { label: "Features", value: "107" },
                { label: "Today's Picks", value: xgbPreds.length || "—" },
                { label: "Test Accuracy", value: "76.4%" },
                { label: "Spread MAE", value: "22 pts" },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
                  <div className="stat-number" style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Uses rolling team stats, Elo ratings, rest days, and archetype composition to predict win probability and spread.
            </div>
          </div>

          {/* League Leaders */}
          <LeagueLeaders
            data={liveData.leagueLeaders}
            onPlayerClick={onPlayerClick}
          />
        </div>
      </div>
    </div>
  );
}
