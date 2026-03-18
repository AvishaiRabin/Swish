import React, { useState, useEffect, useMemo } from "react";
import { Calendar } from "lucide-react";
import { useLiveData } from "../context/LiveDataContext.jsx";
import { fetchTickerData } from "../nbaApi.js";
import ScoreboardTicker from "../components/ScoreboardTicker.jsx";
import LeagueLeaders from "../components/LeagueLeaders.jsx";
import NewsTicker from "../components/NewsTicker.jsx";
import GameCard from "../components/GameCard.jsx";

export default function HomePage({ onGameClick, onPlayerClick, onNavigate }) {
  const liveData = useLiveData();
  const [tickerItems, setTickerItems] = useState([]);

  useEffect(() => {
    fetchTickerData().then(setTickerItems).catch(() => { });
  }, []);

  const sortedGames = useMemo(() => {
    const order = { LIVE: 0, FINAL: 1, UPCOMING: 2 };
    return [...liveData.scoreboard].sort(
      (a, b) => order[a.status] - order[b.status]
    );
  }, [liveData.scoreboard]);

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
          {/* Today's Games */}
          <section>
            <h2
              className="font-display"
              style={{
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Calendar size={18} style={{ color: "var(--accent-blue)" }} />
              Today's Games
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 12,
              }}
            >
              {sortedGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  onClick={() => onGameClick(game.id, game)}
                />
              ))}
            </div>
          </section>

        </div>

        {/* Right Column — League Leaders */}
        <div>
          <LeagueLeaders
            data={liveData.leagueLeaders}
            onPlayerClick={onPlayerClick}
          />
        </div>
      </div>
    </div>
  );
}
