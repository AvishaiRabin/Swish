import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchScoreboard } from "../nbaApi.js";
import { TEAMS } from "../data/teams.js";
import TeamLogo from "../components/TeamLogo.jsx";
import { useLiveData } from "../context/LiveDataContext.jsx";

function fmtDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function GamesPage({ onGameClick }) {
  const liveData = useLiveData();
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekGames, setWeekGames] = useState(null); // array of 7 game arrays, null while loading
  const [weekLoading, setWeekLoading] = useState(false);

  const todayStr = useMemo(() => fmtDateStr(new Date()), []);

  // Mon–Sun for the viewed week
  const weekDates = useMemo(() => {
    const now = new Date();
    const dow = now.getDay();
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(now);
    mon.setDate(now.getDate() + diffToMon + weekOffset * 7);
    mon.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      return d;
    });
  }, [weekOffset]);

  // Stable string key for the week (avoids referential instability in useEffect)
  const weekKey = useMemo(() => weekDates.map(fmtDateStr).join(","), [weekDates]);

  const todayIdx = weekDates.findIndex((d) => fmtDateStr(d) === todayStr);
  const [selectedDayIdx, setSelectedDayIdx] = useState(() => (todayIdx >= 0 ? todayIdx : 2));

  // When the week changes, auto-select today (if visible) or the closest relevant day
  useEffect(() => {
    const idx = weekDates.findIndex((d) => fmtDateStr(d) === todayStr);
    setSelectedDayIdx(idx >= 0 ? idx : weekOffset < 0 ? 6 : 0);
  }, [weekOffset]); // eslint-disable-line

  // Fetch all 7 days sequentially to avoid NBA API rate-limiting on batch requests
  useEffect(() => {
    let cancelled = false;
    setWeekLoading(true);
    setWeekGames(null);
    const dateStrs = weekKey.split(",");
    (async () => {
      const results = [];
      for (const ds of dateStrs) {
        if (cancelled) return;
        const games = await fetchScoreboard(ds).catch(() => []);
        results.push(games);
      }
      if (!cancelled) { setWeekGames(results); setWeekLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [weekKey]);

  // Games for the selected day — fall back to live scoreboard while loading today
  const selGames = useMemo(() => {
    if (weekGames) return weekGames[selectedDayIdx] || [];
    if (weekOffset === 0 && selectedDayIdx === todayIdx) return liveData.scoreboard;
    return [];
  }, [weekGames, selectedDayIdx, weekOffset, todayIdx, liveData.scoreboard]);

  const sortedSelGames = useMemo(() => {
    const order = { LIVE: 0, FINAL: 1, UPCOMING: 2 };
    return [...selGames].sort((a, b) => order[a.status] - order[b.status]);
  }, [selGames]);

  // Bar chart data — one entry per day
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const chartData = useMemo(() => weekDates.map((d, i) => {
    const games = weekGames?.[i] || [];
    return {
      dayLabel: DAYS[d.getDay()],
      dateLabel: `${MONTHS[d.getMonth()]} ${d.getDate()}`,
      final: games.filter((g) => g.status === "FINAL").length,
      live: games.filter((g) => g.status === "LIVE").length,
      upcoming: games.filter((g) => g.status === "UPCOMING").length,
      total: games.length,
      isToday: fmtDateStr(d) === todayStr,
      idx: i,
    };
  }), [weekGames, weekDates, todayStr]);

  const weekLabel = useMemo(() => {
    const s = weekDates[0], e = weekDates[6];
    return s.getMonth() === e.getMonth()
      ? `${MONTHS[s.getMonth()]} ${s.getDate()}\u2013${e.getDate()}, ${e.getFullYear()}`
      : `${MONTHS[s.getMonth()]} ${s.getDate()} \u2013 ${MONTHS[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  }, [weekDates]);

  const selDate = weekDates[selectedDayIdx] ?? weekDates[0];
  const selDayLabel = selDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const isViewingToday = fmtDateStr(selDate) === todayStr;

  const ChartTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
      <div style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.dateLabel}{d.isToday ? " · Today" : ""}</div>
        {d.live > 0 && <div style={{ color: "var(--accent-red)" }}>Live: {d.live}</div>}
        {d.final > 0 && <div style={{ color: "var(--accent-green)" }}>Final: {d.final}</div>}
        {d.upcoming > 0 && <div style={{ color: "var(--accent-amber)" }}>Upcoming: {d.upcoming}</div>}
        {d.total === 0 && <div style={{ color: "var(--text-muted)" }}>No games</div>}
      </div>
    );
  };

  const navBtn = { background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "var(--text-primary)", display: "flex", alignItems: "center" };

  return (
    <div className="fade-in" style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px 60px" }}>

      {/* -- Header -- */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
          <Calendar size={24} style={{ color: "var(--accent-blue)" }} />
          Games
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} style={{ ...navBtn, fontSize: 12, fontWeight: 600, padding: "6px 14px", background: "var(--accent-blue)", color: "white", border: "none", fontFamily: "'Inter', sans-serif" }}>
              This Week
            </button>
          )}
          <button onClick={() => setWeekOffset((w) => w - 1)} style={navBtn}><ChevronLeft size={16} /></button>
          <span style={{ fontSize: 14, fontWeight: 600, minWidth: 200, textAlign: "center" }}>{weekLabel}</span>
          <button onClick={() => setWeekOffset((w) => w + 1)} style={navBtn}><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* -- Weekly bar chart -- */}
      <div style={{ background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border-color)", padding: "20px 16px 10px", marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart
            data={chartData}
            barCategoryGap="30%"
            onClick={(e) => { if (e?.activePayload?.[0]) setSelectedDayIdx(e.activePayload[0].payload.idx); }}
            style={{ cursor: "pointer" }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis
              dataKey="dayLabel"
              axisLine={false}
              tickLine={false}
              height={44}
              tick={(props) => {
                const { x, y, index } = props;
                const d = chartData[index];
                const isSel = index === selectedDayIdx;
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text dy={12} textAnchor="middle" fontSize={12} fontWeight={isSel ? 700 : 500}
                      fill={isSel ? "var(--accent-blue)" : d.isToday ? "var(--text-primary)" : "var(--text-muted)"}>
                      {d.dayLabel}
                    </text>
                    <text dy={26} textAnchor="middle" fontSize={10} fill="var(--text-muted)">{d.dateLabel}</text>
                    {d.isToday && <circle cx={0} cy={32} r={2.5} fill="var(--accent-blue)" />}
                  </g>
                );
              }}
            />
            <YAxis hide domain={[0, "auto"]} />
            <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(0,0,0,0.04)", radius: 4 }} />
            <Bar dataKey="final" stackId="a" name="Final">
              {chartData.map((_, i) => <Cell key={i} fill={i === selectedDayIdx ? "#22c55e" : "rgba(34,197,94,0.35)"} />)}
            </Bar>
            <Bar dataKey="live" stackId="a" name="Live">
              {chartData.map((_, i) => <Cell key={i} fill={i === selectedDayIdx ? "#ef4444" : "rgba(239,68,68,0.35)"} />)}
            </Bar>
            <Bar dataKey="upcoming" stackId="a" name="Upcoming" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={i === selectedDayIdx ? "#f59e0b" : "rgba(245,158,11,0.3)"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", justifyContent: "center", gap: 20, fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: "var(--accent-green)" }} />Final</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: "var(--accent-red)" }} />Live</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: "var(--accent-amber)" }} />Upcoming</span>
        </div>
      </div>

      {/* -- Selected day header -- */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          {selDayLabel}
          {isViewingToday && (
            <span style={{ fontSize: 11, background: "var(--accent-blue)", color: "white", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>Today</span>
          )}
        </h2>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {weekLoading ? "Loading\u2026" : `${sortedSelGames.length} game${sortedSelGames.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* -- Game cards -- */}
      {weekLoading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)", fontSize: 14 }}>Loading games\u2026</div>
      ) : sortedSelGames.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No games scheduled</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {sortedSelGames.map((game) => {
            const home = TEAMS[game.homeTeam];
            const away = TEAMS[game.awayTeam];
            const isLive = game.status === "LIVE";
            const isFinal = game.status === "FINAL";
            if (!home || !away) return null;
            return (
              <div
                key={game.id}
                className="card-hover"
                onClick={() => onGameClick(game.id, game)}
                style={{ background: "var(--bg-secondary)", borderRadius: 14, padding: 20, cursor: "pointer", position: "relative", overflow: "hidden" }}
              >
                {isLive && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "var(--accent-red)" }} />}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  {isLive ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--accent-red)" }}>
                      <div className="live-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-red)" }} />
                      Live{game.quarter > 0 ? ` · Q${game.quarter} ${game.timeRemaining}` : ""}
                    </span>
                  ) : isFinal ? (
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Final</span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-blue)" }}>{game.scheduledTime}</span>
                  )}
                  {game.broadcast && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{game.broadcast}</span>}
                </div>
                {[{ t: away, score: game.awayScore, label: "away" }, { t: home, score: game.homeScore, label: "home" }].map(({ t, score, label }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: label === "away" ? 8 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "white" }}>{t.abbr}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.record}</div>
                      </div>
                    </div>
                    <span className="stat-number" style={{ fontSize: 22, fontWeight: 700, color: game.status !== "UPCOMING" && score >= (label === "away" ? game.homeScore : game.awayScore) ? "var(--text-primary)" : "var(--text-muted)" }}>
                      {game.status !== "UPCOMING" ? score : "-"}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
