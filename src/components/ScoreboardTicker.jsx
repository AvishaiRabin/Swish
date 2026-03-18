import React, { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ScoreCard from "./ScoreCard.jsx";

export default function ScoreboardTicker({ games, onGameClick }) {
  const scrollRef = useRef(null);

  const scroll = (dir) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 260, behavior: "smooth" });
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          padding: "0 24px",
          maxWidth: 1400,
          margin: "0 auto 16px",
        }}
      >
        <h2
          className="font-display"
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          Scoreboard
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => scroll(-1)}
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: 6,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--text-secondary)",
              transition: "all 0.2s",
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => scroll(1)}
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: 6,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--text-secondary)",
              transition: "all 0.2s",
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="score-scroll"
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          padding: "0 24px 4px",
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        {games.map((game) => (
          <ScoreCard
            key={game.id}
            game={game}
            onClick={() => onGameClick(game.id, game)}
          />
        ))}
      </div>
    </div>
  );
}
