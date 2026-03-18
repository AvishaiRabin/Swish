import React from "react";
import { Home, Trophy, Users, Shield, Layers, Calendar, Target, User } from "lucide-react";

export default function MobileBottomNav({ currentPage, setCurrentPage }) {
  const items = [
    { key: "home", label: "Home", icon: Home },
    { key: "standings", label: "Standings", icon: Trophy },
    { key: "players", label: "Players", icon: Users },
    { key: "teams", label: "Teams", icon: Shield },
    { key: "compare", label: "Compare", icon: Layers },
    { key: "games", label: "Games", icon: Calendar },
    { key: "predictions", label: "Predict", icon: Target },
    { key: "about", label: "About", icon: User },
  ];
  return (
    <div
      className="mobile-bottom-nav"
      style={{
        display: "none",
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "rgba(249, 248, 246, 0.95)",
        borderTop: "1px solid var(--border-color)",
        zIndex: 50,
        justifyContent: "space-around",
        padding: "6px 0 env(safe-area-inset-bottom, 6px)",
      }}
    >
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => setCurrentPage(item.key)}
          style={{
            background: "none",
            border: "none",
            color: currentPage === item.key ? "var(--accent-blue)" : "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            fontSize: 9,
            fontWeight: 600,
            fontFamily: "'Inter', sans-serif",
            padding: "4px 8px",
          }}
        >
          <item.icon size={18} />
          {item.label}
        </button>
      ))}
    </div>
  );
}
