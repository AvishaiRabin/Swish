import React, { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Home,
  BarChart3,
  Users,
  Shield,
  Layers,
  Calendar,
  Trophy,
  Activity,
  Target,
  User,
} from "lucide-react";
import { TEAMS } from "../data/teams.js";
import { PLAYERS } from "../data/players.js";

export default function NavBar({ currentPage, setCurrentPage, onPlayerSelect, onTeamSelect }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  const navItems = [
    { key: "home", label: "Home", icon: Home },
    { key: "standings", label: "Standings", icon: Trophy },
    { key: "players", label: "Players", icon: Users },
    { key: "teams", label: "Teams", icon: Shield },
    { key: "compare", label: "Compare", icon: Layers },
    { key: "lineups", label: "Lineups", icon: Activity },
    { key: "games", label: "Games", icon: Calendar },
    { key: "predictions", label: "Predictions", icon: Target },
    { key: "about", label: "About", icon: User },
  ];

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { players: [], teams: [] };
    const q = searchQuery.toLowerCase();
    const players = PLAYERS.filter(
      (p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q) || p.pos.toLowerCase().includes(q)
    ).slice(0, 5);
    const teams = Object.entries(TEAMS)
      .filter(([abbr, t]) => t.name.toLowerCase().includes(q) || t.city.toLowerCase().includes(q) || abbr.toLowerCase().includes(q))
      .map(([abbr, t]) => ({ abbr, ...t }))
      .slice(0, 5);
    return { players, teams };
  }, [searchQuery]);

  const hasResults = searchResults.players.length > 0 || searchResults.teams.length > 0;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <nav
      style={{
        background: "rgba(249, 248, 246, 0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border-color)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        className="nav-container"
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            flexShrink: 0,
          }}
          onClick={() => setCurrentPage("home")}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #f97316, #ea580c)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
            }}
          >
            <BarChart3 size={18} color="white" />
          </div>
          <span
            className="font-display nav-logo-text"
            style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}
          >
            Courtside
          </span>
        </div>

        {/* Nav Links */}
        <div className="nav-links" style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`nav-link ${currentPage === item.key ? "active" : ""}`}
              onClick={() => setCurrentPage(item.key)}
              style={{
                background: "none",
                border: "none",
                color:
                  currentPage === item.key
                    ? "var(--accent-blue)"
                    : "var(--text-secondary)",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "'Inter', sans-serif",
                display: "flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
            >
              <item.icon size={15} />
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Search & AI */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div ref={searchRef} style={{ position: "relative" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
                zIndex: 1,
              }}
            />
            <input
              type="text"
              placeholder="Search players, teams..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              className="nav-search-input"
              style={{
                background: "var(--bg-secondary)",
                border: `1px solid ${searchOpen && hasResults ? "var(--accent-blue)" : "var(--border-color)"}`,
                borderRadius: searchOpen && hasResults ? "8px 8px 0 0" : 8,
                padding: "8px 14px 8px 36px",
                color: "var(--text-primary)",
                fontSize: 13,
                width: 220,
                outline: "none",
                fontFamily: "'Inter', sans-serif",
                transition: "border-color 0.2s",
              }}
            />
            {/* Search Dropdown */}
            {searchOpen && searchQuery.trim() && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--accent-blue)",
                  borderTop: "none",
                  borderRadius: "0 0 8px 8px",
                  maxHeight: 340,
                  overflowY: "auto",
                  zIndex: 100,
                  boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
                }}
              >
                {/* Players */}
                {searchResults.players.length > 0 && (
                  <>
                    <div style={{ padding: "8px 12px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Players</div>
                    {searchResults.players.map((p) => {
                      const t = TEAMS[p.team];
                      return (
                        <div
                          key={p.id}
                          onClick={() => { onPlayerSelect(p.id); setSearchQuery(""); setSearchOpen(false); }}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", transition: "background 0.15s" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <div style={{ width: 22, height: 22, borderRadius: 5, background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: "white", flexShrink: 0 }}>{p.team}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{t.city} {t.name} · {p.pos}</div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
                {/* Teams */}
                {searchResults.teams.length > 0 && (
                  <>
                    <div style={{ padding: "8px 12px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", borderTop: searchResults.players.length > 0 ? "1px solid var(--border-color)" : "none" }}>Teams</div>
                    {searchResults.teams.map((t) => (
                      <div
                        key={t.abbr}
                        onClick={() => { onTeamSelect(t.abbr); setSearchQuery(""); setSearchOpen(false); }}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", transition: "background 0.15s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <div style={{ width: 22, height: 22, borderRadius: 5, background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: "white", flexShrink: 0 }}>{t.abbr}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{t.city} {t.name}</div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{t.division} · {t.record}</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {!hasResults && (
                  <div style={{ padding: "16px 12px", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>No results for "{searchQuery}"</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
