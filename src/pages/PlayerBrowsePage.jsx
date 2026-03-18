import React, { useState, useMemo } from "react";
import { Search, X, ChevronDown, Star, Users } from "lucide-react";
import { PLAYERS, SORT_OPTIONS, POSITION_OPTIONS } from "../data/players.js";
import { TEAMS } from "../data/teams.js";
import PlayerHeadshot from "../components/PlayerHeadshot.jsx";
import TeamLogo from "../components/TeamLogo.jsx";
import { useLiveData } from "../context/LiveDataContext.jsx";

export default function PlayerBrowsePage({ onPlayerSelect }) {
  const liveData = useLiveData();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterPos, setFilterPos] = useState("");

  // Build merged player list: live API players enriched with mock data (nbaId match)
  const allPlayers = useMemo(() => {
    const live = liveData.livePlayers;
    if (live && live.length > 0) {
      return live.map((lp) => {
        const mock = PLAYERS.find((m) => m.nbaId === lp.playerId);
        return {
          id: mock ? mock.id : `live_${lp.playerId}`,
          nbaId: lp.playerId,
          name: lp.name,
          team: lp.team,
          pos: mock?.pos || lp.pos || "",
          jersey: mock?.jersey ?? null,
          ppg: lp.ppg,
          rpg: lp.rpg,
          apg: lp.apg,
          plusMinus: lp.plusMinus ?? null,
          isMock: !!mock,
          liveData: lp,
        };
      });
    }
    // Fallback: 8 mock players
    return PLAYERS.map((p) => ({
      id: p.id,
      nbaId: p.nbaId,
      name: p.name,
      team: p.team,
      pos: p.pos,
      jersey: p.jersey,
      ppg: String(p.seasonAvg.pts),
      rpg: String(p.seasonAvg.reb),
      apg: String(p.seasonAvg.ast),
      isMock: true,
      liveData: null,
    }));
  }, [liveData.livePlayers]);

  // Unique sorted team list for dropdown
  const teamOptions = useMemo(() => {
    const abbrs = [...new Set(allPlayers.map((p) => p.team).filter(Boolean))];
    return abbrs.sort((a, b) => {
      const nameA = TEAMS[a]?.name || a;
      const nameB = TEAMS[b]?.name || b;
      return nameA.localeCompare(nameB);
    });
  }, [allPlayers]);

  const displayPlayers = useMemo(() => {
    let list = allPlayers;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.team.toLowerCase().includes(q) ||
          TEAMS[p.team]?.city?.toLowerCase().includes(q) ||
          TEAMS[p.team]?.name?.toLowerCase().includes(q) ||
          p.pos.toLowerCase().includes(q)
      );
    }

    // Team filter
    if (filterTeam) list = list.filter((p) => p.team === filterTeam);

    // Position filter — map each label to its set of API position codes
    if (filterPos) {
      const opt = POSITION_OPTIONS.find((o) => o.value === filterPos);
      const allowed = opt ? opt.matches : [filterPos];
      list = list.filter((p) => allowed.includes(p.pos));
    }

    // Sort
    list = [...list];
    if (sortBy === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list.sort((a, b) => parseFloat(b[sortBy] || 0) - parseFloat(a[sortBy] || 0));
    }

    return list;
  }, [search, filterTeam, filterPos, sortBy, allPlayers]);

  const selectStyle = {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    borderRadius: 8,
    padding: "9px 32px 9px 12px",
    color: "var(--text-primary)",
    fontSize: 13,
    outline: "none",
    fontFamily: "'Inter', sans-serif",
    cursor: "pointer",
    appearance: "none",
    WebkitAppearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
  };

  const activeFilters = [filterTeam, filterPos].filter(Boolean).length;

  return (
    <div className="fade-in" style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px 60px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Users size={24} style={{ color: "var(--accent-blue)" }} />
          Players
          <span style={{ fontSize: 14, fontWeight: 400, color: "var(--text-muted)" }}>({displayPlayers.length}{displayPlayers.length !== allPlayers.length ? ` of ${allPlayers.length}` : ""})</span>
        </h1>

        {/* Controls row */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
            <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players..."
              style={{ ...selectStyle, padding: "9px 14px 9px 34px", width: "100%", appearance: "auto", WebkitAppearance: "auto", backgroundImage: "none" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent-blue)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border-color)")}
            />
          </div>

          {/* Sort */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap" }}>Sort by</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={selectStyle}>
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Team filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Team</span>
            <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} style={{ ...selectStyle, borderColor: filterTeam ? "var(--accent-blue)" : "var(--border-color)" }}>
              <option value="">All Teams</option>
              {teamOptions.map((abbr) => (
                <option key={abbr} value={abbr}>{TEAMS[abbr] ? `${TEAMS[abbr].city} ${TEAMS[abbr].name}` : abbr}</option>
              ))}
            </select>
          </div>

          {/* Position filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Position</span>
            <select value={filterPos} onChange={(e) => setFilterPos(e.target.value)} style={{ ...selectStyle, borderColor: filterPos ? "var(--accent-blue)" : "var(--border-color)" }}>
              <option value="">All Positions</option>
              {POSITION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Clear filters */}
          {activeFilters > 0 && (
            <button
              onClick={() => { setFilterTeam(""); setFilterPos(""); }}
              style={{ background: "transparent", border: "1px solid var(--border-color)", borderRadius: 8, padding: "9px 12px", color: "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 5 }}
            >
              <X size={13} /> Clear ({activeFilters})
            </button>
          )}
        </div>
      </div>

      {/* Player Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {displayPlayers.map((player) => {
          const team = TEAMS[player.team] || { color: "#444", secondaryColor: "#666", city: player.team, name: "" };
          return (
            <div
              key={player.id}
              className="card-hover"
              onClick={() => onPlayerSelect(player.id, player)}
              style={{ background: "var(--bg-secondary)", borderRadius: 14, padding: 18, cursor: "pointer", position: "relative", overflow: "hidden" }}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${team.color}, ${team.secondaryColor})` }} />
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <PlayerHeadshot nbaId={player.nbaId} name={player.name} size={60} teamColor={team.color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {player.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <TeamLogo abbr={player.team} size={16} />
                    <span>{team.city} {team.name}</span>
                    {player.pos && <span style={{ color: "var(--text-muted)" }}>· {player.pos}</span>}
                    {player.jersey != null && <span style={{ color: "var(--text-muted)" }}>· #{player.jersey}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 14 }}>
                    {[
                      { label: "PTS", value: player.ppg },
                      { label: "REB", value: player.rpg },
                      { label: "AST", value: player.apg },
                    ].map((s) => (
                      <div key={s.label} style={{ textAlign: "center" }}>
                        <div className="stat-number" style={{ fontSize: 15, fontWeight: 700, color: "var(--accent-blue)" }}>{s.value}</div>
                        <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {displayPlayers.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>No players match your filters.</p>
          <button onClick={() => { setSearch(""); setFilterTeam(""); setFilterPos(""); }} style={{ marginTop: 12, background: "transparent", border: "1px solid var(--border-color)", borderRadius: 8, padding: "8px 16px", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Clear all filters</button>
        </div>
      )}
    </div>
  );
}
