# Courtside — NBA Analytics App (SwishStats)

## Commands
- `npm run dev` — Vite dev server (port 3000, auto-opens browser)
- `npm run proxy` — Express backend + SQLite (port 3001)
- `npm run build` — Production build via Vite
- Run both `dev` and `proxy` in separate terminals for full-stack development

## Architecture

### Single-file frontend
All React components, mock data, constants, and styles live in `Courtside.jsx` (~6700 lines). Do NOT split this file without explicit permission.

### Key files
- `Courtside.jsx` — All 11 pages, 20+ components, mock data, CSS-in-JS styles
- `src/nbaApi.js` — All NBA API + server fetch functions with 3-tier cache (memory → localStorage → network)
- `server.js` — Express backend, SQLite DB, NBA API proxy, prediction engine
- `vite.config.js` — Dev server config, API proxy to port 3001
- `.env` — `ANTHROPIC_API_KEY` (never commit, never read in Claude Code)

### Module system
ES modules throughout (`"type": "module"` in package.json). Use `import`/`export`, never `require`.

### Routing
No react-router. Pages routed via `currentPage` state in `CourtsideAppInner`. To add a new page:
1. Add to `navItems` array in `NavBar`
2. Add to `items` array in `MobileBottomNav`
3. Add `case` to `renderPage()` switch in `CourtsideAppInner`

### State management
- `LiveDataContext` (React Context) provides real-time data globally
- Falls back to mock data in `mockData` object when API unavailable
- Page-level state: `selectedGameId`, `selectedPlayerId`, `selectedTeamAbbr`

### Database (SQLite via better-sqlite3)
Location: `.data/courtside.db` (auto-created, WAL mode)
Tables: `players`, `standings`, `league_leaders`, `lineups`, `predictions`, `prediction_results`, `meta`

### Predictions engine
- Calls Claude (`claude-sonnet-4-20250514`) to generate daily game predictions
- Cron: 30s after startup + every 6h
- Grades predictions against actual results, feeds accuracy back into future prompts
- Requires `ANTHROPIC_API_KEY` in `.env`; gracefully skips if missing/out of credits

## Code style
- 2-space indentation
- PascalCase for components (`NavBar`, `GameDetailPage`)
- camelCase for functions and variables (`fetchStandings`, `handleGameClick`)
- UPPER_CASE for constants (`TEAMS`, `PLAYERS`, `STYLES`)
- Functional React components with hooks only (no class components except ErrorBoundary)
- Event handlers prefixed with `handle` (`handleGameClick`, `handlePlayerClick`)

## Styling conventions
- CSS variables in `:root` inside `STYLES` template literal
- Accent color: `--accent` (coral-orange `#f97316`)
- Fonts: Inter (body), JetBrains Mono (stats/numbers)
- Responsive breakpoints: 1024px, 768px, 640px
- Use `.card-hover` class for card-style containers
- Inline styles for dynamic values, CSS classes for reusable patterns

## Data
- 30 NBA teams in `TEAMS` constant (name, city, colors, division, conference, teamId)
- 8 featured players in `PLAYERS` (Luka, Giannis, SGA, Tatum, Jokic, Curry, LeBron, Wemby)
- `TEAM_DETAILS` — all 30 teams; BOS/OKC/LAL have full data (ratingHistory, roster, schedule)
- Season: 2025-26

## NBA API notes
- `boxscoretraditionalv3` for box scores (v2 returns empty for completed games)
- Scoreboard fetches are sequential (not parallel) to avoid rate limits
- Past-date scoreboards cached for 7 days (immutable data)
- `normalizeAbbr()` in nbaApi.js handles non-standard abbreviations

## Pages (11)
home, standings, players, playerDetail, teams, teamDetail, compare, lineups, games, gameDetail, predictions

## Don'ts
- Don't split Courtside.jsx into multiple files
- Don't add react-router
- Don't commit .env or API keys
- Don't use `Promise.all` for multiple NBA API calls (use sequential to avoid rate limits)
- Don't use `boxscoretraditionalv2` (returns empty for finished games)
