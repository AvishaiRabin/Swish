import React, { useState, useEffect, createContext, useContext, useMemo } from "react";
import {
  fetchStandings,
  fetchLeagueLeaders,
  fetchPlayerStats,
  fetchScoreboard,
  clearEndpointCache,
} from "../nbaApi.js";

export const LiveDataContext = createContext(null);

export function useLiveData() {
  return useContext(LiveDataContext);
}

export function LiveDataProvider({ children }) {
  const [liveStandings, setLiveStandings] = useState(null);
  const [liveLeaders, setLiveLeaders] = useState(null);
  const [livePlayers, setLivePlayers] = useState(null);
  const [liveScoreboard, setLiveScoreboard] = useState(null);
  const [dataSource, setDataSource] = useState("loading"); // "live" | "mock" | "loading"
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    let cancelled = false;
    let pollInterval = null;

    async function loadLiveData() {
      const errs = [];
      let anySuccess = false;

      // Quick check if the server is reachable
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        const ping = await fetch("/api/db/status", { signal: ctrl.signal }).catch(() => { throw new Error("Server unreachable"); });
        clearTimeout(timer);
        if (!ping.ok) throw new Error("Server error");
      } catch {
        console.warn("Courtside server not running — no data available");
        if (!cancelled) setDataSource("offline");
        return;
      }

      // Fetch in parallel
      const [standingsRes, leadersRes, playersRes, scoreboardRes] =
        await Promise.allSettled([
          fetchStandings(),
          fetchLeagueLeaders(),
          fetchPlayerStats(),
          fetchScoreboard(),
        ]);

      if (cancelled) return;

      if (standingsRes.status === "fulfilled") {
        setLiveStandings(standingsRes.value);
        anySuccess = true;
      } else {
        errs.push(`Standings: ${standingsRes.reason?.message}`);
      }

      if (leadersRes.status === "fulfilled") {
        setLiveLeaders(leadersRes.value);
        anySuccess = true;
      } else {
        errs.push(`Leaders: ${leadersRes.reason?.message}`);
      }

      if (playersRes.status === "fulfilled") {
        setLivePlayers(playersRes.value);
        anySuccess = true;
      } else {
        errs.push(`Players: ${playersRes.reason?.message}`);
      }

      if (scoreboardRes.status === "fulfilled" && scoreboardRes.value.length > 0) {
        setLiveScoreboard(scoreboardRes.value);
        anySuccess = true;

        // Start 30-second polling if any games are live
        const hasLive = scoreboardRes.value.some((g) => g.status === "LIVE");
        if (hasLive && !pollInterval) {
          pollInterval = setInterval(async () => {
            if (cancelled) return;
            try {
              clearEndpointCache("scoreboardv3");
              const fresh = await fetchScoreboard();
              if (!cancelled && fresh.length > 0) setLiveScoreboard(fresh);
            } catch { }
          }, 30000);
        }
      } else if (scoreboardRes.status === "rejected") {
        errs.push(`Scoreboard: ${scoreboardRes.reason?.message}`);
      }

      setErrors(errs);
      setDataSource(anySuccess ? "live" : "mock");
    }

    loadLiveData();
    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // Transform DB leaders keys (lowercase) to display keys (Title case)
  // DB returns: { points: [...], rebounds: [...], threePointers: [...] }
  // LeagueLeaders component expects: { Points: [...], Rebounds: [...], "3-Pointers": [...] }
  const leagueLeaders = useMemo(() => {
    if (!liveLeaders) return {};
    const keyMap = {
      points: "Points", rebounds: "Rebounds", assists: "Assists",
      steals: "Steals", blocks: "Blocks", threePointers: "3-Pointers",
    };
    const out = {};
    Object.entries(liveLeaders).forEach(([k, v]) => {
      if (Array.isArray(v) && v.length > 0) out[keyMap[k] || k] = v;
    });
    return out;
  }, [liveLeaders]);

  const value = useMemo(
    () => ({
      standings: liveStandings || { East: [], West: [] },
      leaders: liveLeaders || {},
      leagueLeaders,
      scoreboard: liveScoreboard || [],
      livePlayers,
      dataSource,
      errors,
      isLive: dataSource === "live",
    }),
    [liveStandings, liveLeaders, liveScoreboard, livePlayers, dataSource, errors]
  );

  return (
    <LiveDataContext.Provider value={value}>{children}</LiveDataContext.Provider>
  );
}
