import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  Sparkles,
  Target,
  Info,
  Activity,
  Shield,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Flame,
} from "lucide-react";
import {
  fetchPredictionsToday,
  fetchPredictionHistory,
  fetchPredictionAccuracy,
  fetchXGBoostPredictions,
} from "../nbaApi.js";
import { TEAMS } from "../data/teams.js";
import TeamLogo from "../components/TeamLogo.jsx";

export default function PredictionsPage() {
  const [tab, setTab] = useState("today");
  const [todayData, setTodayData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [accuracyData, setAccuracyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [xgboostData, setXgboostData] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const fetcher =
      tab === "today"
        ? fetchPredictionsToday
        : tab === "results"
          ? () => fetchPredictionHistory(7)
          : tab === "xgboost"
            ? fetchXGBoostPredictions
            : fetchPredictionAccuracy;
    fetcher()
      .then((d) => {
        if (tab === "today") setTodayData(d);
        else if (tab === "results") setHistoryData(d);
        else if (tab === "xgboost") setXgboostData(d);
        else setAccuracyData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [tab]);

  const tabs = [
    { key: "today", label: "Today's Picks" },
    { key: "xgboost", label: "XGBoost Model" },
    { key: "results", label: "Yesterday's Results" },
    { key: "trend", label: "Accuracy Trend" },
  ];

  const renderConfidenceBar = (confidence) => (
    <div style={{ height: 6, borderRadius: 3, background: "var(--border-color)", width: "100%", marginTop: 6 }}>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          width: `${confidence}%`,
          background: confidence >= 75 ? "#22c55e" : confidence >= 50 ? "#f97316" : "#ef4444",
          transition: "width 0.5s ease",
        }}
      />
    </div>
  );

  const renderTodayTab = () => {
    if (!todayData) return null;
    const { predictions, accuracy, date } = todayData;

    if (!predictions || predictions.length === 0) {
      return (
        <div className="card-hover" style={{ padding: 32, textAlign: "center" }}>
          <Info size={40} style={{ color: "var(--text-muted)", marginBottom: 12 }} />
          <h3 style={{ margin: "0 0 8px" }}>No Predictions Available</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 400, margin: "0 auto" }}>
            Predictions are generated daily when ANTHROPIC_API_KEY is configured and there are upcoming games.
          </p>
        </div>
      );
    }

    const upsets = predictions.filter((p) => p.upsetAlert);
    const regular = predictions.filter((p) => !p.upsetAlert);

    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
            {date ? new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "Today"}
          </span>
          {accuracy != null && (
            <span
              style={{
                background: accuracy >= 60 ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.15)",
                color: accuracy >= 60 ? "#22c55e" : "#f97316",
                padding: "4px 10px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {accuracy.toFixed(1)}% accuracy (30d)
            </span>
          )}
        </div>

        {upsets.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <Flame size={16} style={{ color: "#f59e0b" }} /> Upset Watch
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {upsets.map((p, i) => renderPredictionCard(p, i, true))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {regular.map((p, i) => renderPredictionCard(p, i, false))}
        </div>
      </>
    );
  };

  const renderPredictionCard = (p, i, isUpset) => {
    const homeTeam = TEAMS[p.homeTeam] || {};
    const awayTeam = TEAMS[p.awayTeam] || {};
    // playerProps already parsed by server; handle both string and array
    let props = [];
    try { props = Array.isArray(p.playerProps) ? p.playerProps : JSON.parse(p.playerProps || "[]"); } catch { }
    const confidencePct = p.confidence <= 1 ? Math.round(p.confidence * 100) : p.confidence;

    return (
      <div
        key={i}
        className="card-hover"
        style={{
          padding: 20,
          border: isUpset ? "1px solid rgba(245,158,11,0.4)" : undefined,
          position: "relative",
        }}
      >
        {isUpset && (
          <div style={{ position: "absolute", top: 10, right: 10 }}>
            <Flame size={16} style={{ color: "#f59e0b" }} />
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 12 }}>
          <div style={{ textAlign: "center" }}>
            <TeamLogo abbr={p.awayTeam} size={36} />
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{p.awayTeam}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{awayTeam.city || ""}</div>
          </div>

          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700 }}>
              {p.awayScorePred ?? "?"} — {p.homeScorePred ?? "?"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>predicted</div>
          </div>

          <div style={{ textAlign: "center" }}>
            <TeamLogo abbr={p.homeTeam} size={36} />
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{p.homeTeam}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{homeTeam.city || ""}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
            {p.predictedWinner} wins
          </span>
          <span
            style={{
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              background: "var(--bg-secondary)",
              padding: "2px 8px",
              borderRadius: 6,
            }}
          >
            spread: {p.spread != null ? (p.spread > 0 ? `+${p.spread}` : p.spread) : "—"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11 }}>
          <span style={{ color: "var(--text-muted)" }}>Confidence</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{confidencePct}%</span>
        </div>
        {renderConfidenceBar(confidencePct)}

        {p.reasoning && (
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 10, lineHeight: 1.5 }}>
            {p.reasoning}
          </p>
        )}

        {props.length > 0 && (
          <div style={{ marginTop: 10, borderTop: "1px solid var(--border-color)", paddingTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>Player Props</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              {props.slice(0, 4).map((pp, j) => (
                <div key={j} style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{pp.playerName || pp.name}: </span>
                  <span style={{ fontWeight: 600 }}>
                    {pp.pts != null ? `${pp.pts}p` : ""} {pp.reb != null ? `${pp.reb}r` : ""} {pp.ast != null ? `${pp.ast}a` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderResultsTab = () => {
    if (!historyData) return null;
    // API returns { date: [results] } object — convert to sorted array
    const days = Object.entries(historyData)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, results]) => ({ date, results }));

    if (days.length === 0) {
      return (
        <div className="card-hover" style={{ padding: 32, textAlign: "center" }}>
          <Info size={40} style={{ color: "var(--text-muted)", marginBottom: 12 }} />
          <h3 style={{ margin: "0 0 8px" }}>No Graded Results Yet</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Results appear once games finish and predictions are graded.</p>
        </div>
      );
    }

    return (
      <>
        {days.map((day) => {
          const correct = day.results.filter((r) => r.correct).length;
          const total = day.results.length;
          const pct = total > 0 ? ((correct / total) * 100).toFixed(1) : 0;
          return (
            <div key={day.date} style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                  {new Date(day.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </h3>
                <span
                  style={{
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 600,
                    color: pct >= 60 ? "#22c55e" : pct >= 40 ? "#f97316" : "#ef4444",
                  }}
                >
                  {correct}/{total} correct ({pct}%)
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                {day.results.map((r, i) => (
                  <div
                    key={i}
                    className="card-hover"
                    style={{
                      padding: 16,
                      borderLeft: `3px solid ${r.correct ? "#22c55e" : "#ef4444"}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <TeamLogo abbr={r.awayTeam} size={24} />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{r.awayTeam}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>@</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{r.homeTeam}</span>
                        <TeamLogo abbr={r.homeTeam} size={24} />
                      </div>
                      <span style={{ fontSize: 16 }}>{r.correct ? "\u2713" : "\u2717"}</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                      <div>
                        <div style={{ color: "var(--text-muted)", fontSize: 10, marginBottom: 2 }}>Predicted</div>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                          {r.predictedWinner} · {r.awayScorePred}-{r.homeScorePred}
                        </span>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-muted)", fontSize: 10, marginBottom: 2 }}>Actual</div>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                          {r.actualWinner || "?"} · {r.awayScoreActual ?? "?"}-{r.homeScoreActual ?? "?"}
                        </span>
                      </div>
                    </div>

                    {r.spreadError != null && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>
                        Spread error: {Math.abs(r.spreadError).toFixed(1)} pts
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </>
    );
  };

  const renderTrendTab = () => {
    if (!accuracyData) return null;
    const { overall, daily } = accuracyData;

    return (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
          {[
            { label: "Total Predictions", value: overall?.total ?? 0 },
            { label: "Correct", value: overall?.correct ?? 0 },
            { label: "Win Rate", value: `${(overall?.winPct ?? 0).toFixed(1)}%` },
            { label: "Avg Spread Error", value: `${(overall?.avgSpreadError ?? 0).toFixed(1)} pts` },
          ].map((s, i) => (
            <div key={i} className="card-hover" style={{ padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {daily && daily.length > 0 ? (
          <div className="card-hover" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Daily Accuracy (30 days)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                  tickFormatter={(d) => {
                    const dt = new Date(d + "T12:00:00");
                    return `${dt.getMonth() + 1}/${dt.getDate()}`;
                  }}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`${v.toFixed(1)}%`, "Accuracy"]}
                  labelFormatter={(d) => new Date(d + "T12:00:00").toLocaleDateString()}
                />
                <Line type="monotone" dataKey="accuracy" stroke="#f97316" strokeWidth={2} dot={{ r: 3, fill: "#f97316" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="card-hover" style={{ padding: 32, textAlign: "center" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Not enough graded data for a trend chart yet.</p>
          </div>
        )}
      </>
    );
  };

  const renderXGBoostTab = () => {
    if (!xgboostData || !xgboostData.predictions || xgboostData.predictions.length === 0) {
      return (
        <div className="card-hover" style={{ padding: 32, textAlign: "center" }}>
          <Info size={40} style={{ color: "var(--text-muted)", marginBottom: 12 }} />
          <h3 style={{ margin: "0 0 8px" }}>No XGBoost Predictions</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 400, margin: "0 auto" }}>
            XGBoost predictions are generated after Claude predictions. The model needs game log data and a trained model to produce picks.
          </p>
        </div>
      );
    }

    const chartData = xgboostData.predictions.map((p) => ({
      matchup: `${p.away_team}@${p.home_team}`,
      away: parseFloat(((1 - (p.home_win_prob || 0.5)) * 100).toFixed(1)),
      home: parseFloat(((p.home_win_prob || 0.5) * 100).toFixed(1)),
      spread: parseFloat((p.predicted_spread || 0).toFixed(1)),
      winner: p.predicted_winner,
      home_team: p.home_team,
      away_team: p.away_team,
    }));

    const chartH = chartData.length * 44 + 24;

    return (
      <>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
            {xgboostData.date ? new Date(xgboostData.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "Today"}
          </span>
          <span style={{
            background: "rgba(99,102,241,0.15)", color: "#818cf8",
            padding: "4px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            XGBoost · 76% test accuracy
          </span>
        </div>

        {/* Summary charts */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          {/* Win probability stacked bar */}
          <div className="card-hover" style={{ flex: "1 1 280px", minWidth: 0, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: "var(--text-secondary)" }}>Win Probability</div>
            <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(99,102,241,0.45)", display: "inline-block" }} /> Away
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: "#818cf8", display: "inline-block" }} /> Home
              </span>
            </div>
            <ResponsiveContainer width="100%" height={chartH}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                <YAxis type="category" dataKey="matchup" width={88} tick={{ fontSize: 11, fill: "var(--text-secondary)" }} />
                <Tooltip
                  formatter={(value, name) => [`${value}%`, name === "home" ? "Home win %" : "Away win %"]}
                  contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border-color)", fontSize: 12 }}
                />
                <ReferenceLine x={50} stroke="var(--text-muted)" strokeDasharray="4 3" strokeWidth={1} />
                <Bar dataKey="away" stackId="a" fill="rgba(99,102,241,0.4)" name="away" radius={[3, 0, 0, 3]} />
                <Bar dataKey="home" stackId="a" fill="#818cf8" name="home" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Predicted spread */}
          <div className="card-hover" style={{ flex: "1 1 280px", minWidth: 0, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: "var(--text-secondary)" }}>Predicted Spread (home perspective)</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>Positive = home favored, negative = away favored</div>
            <ResponsiveContainer width="100%" height={chartH}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                <XAxis type="number" tickFormatter={(v) => (v > 0 ? `+${v}` : `${v}`)} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                <YAxis type="category" dataKey="matchup" width={88} tick={{ fontSize: 11, fill: "var(--text-secondary)" }} />
                <Tooltip
                  formatter={(value) => [value > 0 ? `Home by ${value}` : `Away by ${Math.abs(value)}`, "Predicted margin"]}
                  contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border-color)", fontSize: 12 }}
                />
                <ReferenceLine x={0} stroke="var(--text-muted)" strokeWidth={1} />
                <Bar dataKey="spread" name="spread" radius={3}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.spread >= 0 ? "#818cf8" : "rgba(99,102,241,0.45)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Per-game cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {xgboostData.predictions.map((p, i) => {
            const homeTeamInfo = TEAMS[p.home_team] || {};
            const awayTeamInfo = TEAMS[p.away_team] || {};
            const homePct = Math.round((p.home_win_prob || 0.5) * 100);
            const awayPct = 100 - homePct;
            const isHomeWin = p.predicted_winner === p.home_team;
            const margin = Math.abs(p.predicted_spread || 0).toFixed(1);

            return (
              <div key={i} className="card-hover" style={{ padding: "16px 20px" }}>
                {/* Teams row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: isHomeWin ? 0.5 : 1 }}>
                    <TeamLogo abbr={p.away_team} size={32} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{p.away_team}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{awayTeamInfo.city || "Away"}</div>
                    </div>
                  </div>

                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#818cf8" }}>{p.predicted_winner}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>by {margin} · conf {Math.round((p.confidence || 0.5) * 100)}%</div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: isHomeWin ? 1 : 0.5, flexDirection: "row-reverse" }}>
                    <TeamLogo abbr={p.home_team} size={32} />
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{p.home_team}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{homeTeamInfo.city || "Home"}</div>
                    </div>
                  </div>
                </div>

                {/* Split probability bar with team colors */}
                <div style={{ height: 10, borderRadius: 5, overflow: "hidden", display: "flex" }}>
                  <div style={{
                    width: `${awayPct}%`,
                    background: TEAMS[p.away_team]?.color || "#888",
                    opacity: isHomeWin ? 0.4 : 1,
                  }} />
                  <div style={{
                    width: `${homePct}%`,
                    background: TEAMS[p.home_team]?.color || "#888",
                    opacity: isHomeWin ? 1 : 0.4,
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 11 }}>
                  <span style={{ color: isHomeWin ? "var(--text-muted)" : (TEAMS[p.away_team]?.color || "var(--text-secondary)"), fontWeight: isHomeWin ? 400 : 600 }}>{awayPct}%</span>
                  <span style={{ color: isHomeWin ? (TEAMS[p.home_team]?.color || "var(--text-secondary)") : "var(--text-muted)", fontWeight: isHomeWin ? 600 : 400 }}>{homePct}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* About */}
        <div className="card-hover" style={{ marginTop: 24, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>About this model</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.7 }}>
            XGBoost (eXtreme Gradient Boosting) is a decision-tree ensemble trained on {">"}3,400 NBA games
            from the 2024-25 and 2025-26 seasons. Features include 5- and 10-game rolling averages (points,
            FG%, turnovers, +/-), team standings (win%, PPG, net rating), rest days, recent form,
            and player archetype composition (13 fuzzy archetype scores averaged across each team's roster).
            Win probability and predicted margin are generated independently, then passed to Claude as a
            quantitative baseline before its picks are made.
          </p>
        </div>
      </>
    );
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        <Target size={22} style={{ verticalAlign: "middle", marginRight: 8, color: "var(--accent)" }} />
        AI Predictions
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        Powered by Claude + XGBoost — game picks, spreads, player props & upset alerts
      </p>

      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--border-color)", paddingBottom: 0 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? "var(--accent)" : "var(--text-muted)",
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "2px solid var(--accent)" : "2px solid transparent",
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              transition: "all 0.15s ease",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <div className="loading-spinner" style={{ width: 28, height: 28, border: "3px solid var(--border-color)", borderTopColor: "var(--accent)", borderRadius: "50%", margin: "0 auto 12px", animation: "spin 0.8s linear infinite" }} />
          Loading predictions...
        </div>
      ) : error ? (
        <div className="card-hover" style={{ padding: 32, textAlign: "center" }}>
          <Info size={40} style={{ color: "#ef4444", marginBottom: 12 }} />
          <h3 style={{ margin: "0 0 8px" }}>Could not load predictions</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{error}</p>
        </div>
      ) : tab === "today" ? (
        renderTodayTab()
      ) : tab === "xgboost" ? (
        renderXGBoostTab()
      ) : tab === "results" ? (
        renderResultsTab()
      ) : (
        renderTrendTab()
      )}

      {/* ===== HOW IT WORKS ===== */}
      <div style={{ marginTop: 40 }}>
        <button
          onClick={() => setShowHowItWorks((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-secondary)",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "'Inter', sans-serif",
            padding: 0,
            marginBottom: showHowItWorks ? 16 : 0,
          }}
        >
          <Info size={14} />
          How predictions are generated
          <span style={{ fontSize: 10, marginLeft: 2 }}>{showHowItWorks ? "\u25B2" : "\u25BC"}</span>
        </button>

        {showHowItWorks && (
          <div
            className="card-hover"
            style={{ padding: "24px 28px", borderRadius: 12, lineHeight: 1.7 }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 0, marginBottom: 16 }}>
              ML Pipeline Overview
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Step 1 */}
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{
                  flexShrink: 0, width: 28, height: 28, borderRadius: "50%",
                  background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: "var(--accent)", fontFamily: "'JetBrains Mono', monospace",
                }}>1</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Player Profiles (nightly refresh)</div>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                    Each night the server pulls live data from the NBA Stats API across 7 endpoints — advanced stats
                    (usage rate, true shooting, assist-to-turnover, net rating), player tracking
                    (drives, paint touches, passes made), and hustle metrics (deflections, contested shots,
                    screen assists). It also computes a 15-game rolling window for PPG, USG%, and TS% to
                    capture recent form, and a <strong>form factor</strong> (L15 PPG ÷ season PPG) that flags
                    whether a player is running hot or cold.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{
                  flexShrink: 0, width: 28, height: 28, borderRadius: "50%",
                  background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: "var(--accent)", fontFamily: "'JetBrains Mono', monospace",
                }}>2</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Fuzzy Archetype Classification</div>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                    After every profile refresh, a Python script scores all ~545 active players across 13
                    archetypes: Floor General, Scoring PG, Combo Guard, Large Playmaker, 3-and-D Wing,
                    Two-Way Wing, Shot-Creating Wing, Point Wing, Stretch Big, Unicorn Big, Rim-Running Big,
                    Defensive Anchor, and Versatile PF. Each archetype has a dedicated scoring function that
                    blends position (soft 15-25% weight, used as a height proxy) with advanced stats —
                    USG%, TS%, AST%, drives, touches, contested shots, deflections, blocks, 3PA rate, and more.
                    Raw scores are normalized so they sum to ~1.0, giving each player a fuzzy profile rather
                    than a hard label. The top archetype becomes their display label, while secondary affinities
                    capture hybrid roles (e.g., Luka → Large Playmaker / Point Wing). Hover the badge on any
                    player's page to see their top 5 archetype scores.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{
                  flexShrink: 0, width: 28, height: 28, borderRadius: "50%",
                  background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: "var(--accent)", fontFamily: "'JetBrains Mono', monospace",
                }}>3</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Enriched Claude Prompt</div>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                    At prediction time, each player in a matchup is described with a rich context line, e.g.:
                  </p>
                  <pre style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                    background: "var(--bg-primary)", border: "1px solid var(--border-color)",
                    borderRadius: 6, padding: "10px 14px", margin: "8px 0 0",
                    color: "var(--text-secondary)", overflowX: "auto", whiteSpace: "pre-wrap",
                  }}>
                    {`SGA (OKC): 32.1ppg 5.1r 6.3a | L5: 35,29,38,31,27 avg 32.0 HOT rest:1d
USG:33.4% TS:64.2% NET:+11.3 FF:1.04 [LEAD_GUARD]`}
                  </pre>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "8px 0 0" }}>
                    Claude also receives current standings, each team's last-5 game results, and a rolling
                    accuracy summary from past predictions. It returns structured JSON with a predicted
                    winner, spread, confidence score, player props, and plain-English reasoning.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{
                  flexShrink: 0, width: 28, height: 28, borderRadius: "50%",
                  background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: "var(--accent)", fontFamily: "'JetBrains Mono', monospace",
                }}>4</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Automated Grading & Feedback</div>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                    Every 6 hours the server checks whether past predictions can be graded against final
                    scores. Correct picks, spread error, and a rolling 30-day accuracy are computed and
                    fed back into the next prediction prompt — so Claude is always aware of its recent
                    track record when generating new picks.
                  </p>
                </div>
              </div>

            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border-color)", fontSize: 12, color: "var(--text-muted)" }}>
              Data refreshes nightly at ~2 AM ET. Predictions are generated daily for upcoming games.
              Archetype labels update automatically after each profile refresh.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
