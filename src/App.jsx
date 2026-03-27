import React from "react";
import { BrowserRouter, Routes, Route, useNavigate, useParams, useLocation } from "react-router-dom";
import { LiveDataProvider, useLiveData } from "./context/LiveDataContext.jsx";
import { STYLES } from "./styles.js";
import { PLAYERS } from "./data/players.js";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import NavBar from "./components/NavBar.jsx";
import Footer from "./components/Footer.jsx";
import MobileBottomNav from "./components/MobileBottomNav.jsx";
import HomePage from "./pages/HomePage.jsx";
import StandingsPage from "./pages/StandingsPage.jsx";
import PlayerBrowsePage from "./pages/PlayerBrowsePage.jsx";
import PlayerDetailPage from "./pages/PlayerDetailPage.jsx";
import TeamBrowsePage from "./pages/TeamBrowsePage.jsx";
import TeamDetailPage from "./pages/TeamDetailPage.jsx";
import ComparisonPage from "./pages/ComparisonPage.jsx";
import LineupAnalyzerPage from "./pages/LineupAnalyzerPage.jsx";
import GamesPage from "./pages/GamesPage.jsx";
import GameDetailPage from "./pages/GameDetailPage.jsx";
import PredictionsPage from "./pages/PredictionsPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";

// Route-aware wrappers that convert URL params to props

function PlayerDetailRoute() {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const livePlayerData = location.state?.livePlayerData || null;
  return (
    <PlayerDetailPage
      playerId={playerId}
      livePlayerData={livePlayerData}
      onBack={() => navigate("/players")}
    />
  );
}

function TeamDetailRoute() {
  const { abbr } = useParams();
  const navigate = useNavigate();
  return (
    <TeamDetailPage
      teamAbbr={abbr}
      onBack={() => navigate("/teams")}
    />
  );
}

function GameDetailRoute() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fallbackGame = location.state?.fallbackGame || null;
  return (
    <GameDetailPage
      gameId={gameId}
      fallbackGame={fallbackGame}
      onBack={() => navigate("/games")}
    />
  );
}

function HomeRoute() {
  const navigate = useNavigate();
  return (
    <HomePage
      onGameClick={(gameId, gameData) => navigate(`/games/${gameId}`, { state: { fallbackGame: gameData } })}
      onPlayerClick={(playerIdOrName) => {
        const match = PLAYERS.find((p) => p.id === playerIdOrName || p.name === playerIdOrName);
        navigate(match ? `/players/${match.id}` : "/players");
      }}
      onNavigate={(page, param) => {
        if (page === "teamDetail" && param) navigate(`/teams/${param}`);
        else navigate(`/${page === "home" ? "" : page}`);
      }}
    />
  );
}

function PlayerBrowseRoute() {
  const navigate = useNavigate();
  return (
    <PlayerBrowsePage
      onPlayerSelect={(id, playerObj) => {
        navigate(`/players/${id}`, { state: { livePlayerData: playerObj?.isMock ? null : (playerObj || null) } });
      }}
    />
  );
}

function TeamBrowseRoute() {
  const navigate = useNavigate();
  return (
    <TeamBrowsePage
      onTeamSelect={(abbr) => navigate(`/teams/${abbr}`)}
    />
  );
}

function GamesRoute() {
  const navigate = useNavigate();
  return (
    <GamesPage
      onGameClick={(gameId, gameData) => navigate(`/games/${gameId}`, { state: { fallbackGame: gameData ?? null } })}
    />
  );
}

// Determine active page key from pathname for nav highlighting
function getPageKey(pathname) {
  if (pathname === "/") return "home";
  const seg = pathname.split("/")[1];
  const map = {
    standings: "standings",
    players: "players",
    teams: "teams",
    compare: "compare",
    lineups: "lineups",
    games: "games",
    predictions: "predictions",
    about: "about",
  };
  return map[seg] || "home";
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPage = getPageKey(location.pathname);

  const setCurrentPage = (page) => {
    navigate(`/${page === "home" ? "" : page}`);
  };

  return (
    <>
      <style>{STYLES}</style>
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-primary)",
          color: "var(--text-primary)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <NavBar
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          onPlayerSelect={(id) => navigate(`/players/${id}`)}
          onTeamSelect={(abbr) => navigate(`/teams/${abbr}`)}
        />
        <main className="page-transition" style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/standings" element={<StandingsPage />} />
            <Route path="/players" element={<PlayerBrowseRoute />} />
            <Route path="/players/:playerId" element={<PlayerDetailRoute />} />
            <Route path="/teams" element={<TeamBrowseRoute />} />
            <Route path="/teams/:abbr" element={<TeamDetailRoute />} />
            <Route path="/compare" element={<ComparisonPage />} />
            <Route path="/lineups" element={<LineupAnalyzerPage />} />
            <Route path="/games" element={<GamesRoute />} />
            <Route path="/games/:gameId" element={<GameDetailRoute />} />
            <Route path="/predictions" element={<PredictionsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<HomeRoute />} />
          </Routes>
        </main>
        <Footer />
        <MobileBottomNav currentPage={currentPage} setCurrentPage={setCurrentPage} />
      </div>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <LiveDataProvider>
          <AppShell />
        </LiveDataProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
