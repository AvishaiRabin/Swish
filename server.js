import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, ".data");

// Ensure cache directory exists on startup
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// TTL configuration per endpoint (milliseconds)
// ---------------------------------------------------------------------------
const CACHE_TTL = {
  leaguestandingsv3:     12 * 60 * 60 * 1000,  // 12 hours
  leagueleaders:         12 * 60 * 60 * 1000,  // 12 hours
  leaguedashplayerstats: 12 * 60 * 60 * 1000,  // 12 hours
  playergamelog:         12 * 60 * 60 * 1000,  // 12 hours
  scoreboardv3:           5 * 60 * 1000,        // 5 minutes
  commonteamroster:       7 * 24 * 60 * 60 * 1000, // 7 days
};
const DEFAULT_TTL = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Disk cache helpers
// ---------------------------------------------------------------------------
function buildCacheKey(endpoint, params = {}) {
  const sorted = new URLSearchParams(
    Object.entries(params).sort(([a], [b]) => a.localeCompare(b))
  ).toString();
  return `${endpoint}__${sorted}`;
}

function sanitizeKey(key) {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 200);
}

function getCachePath(cacheKey) {
  return path.join(CACHE_DIR, `${sanitizeKey(cacheKey)}.json`);
}

function readCache(cacheKey) {
  const filePath = getCachePath(cacheKey);
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    const envelope = JSON.parse(raw);
    const age = Date.now() - envelope.cachedAt;
    if (age > envelope.ttl) return null; // expired
    return envelope.data;
  } catch {
    try { fs.unlinkSync(filePath); } catch {}
    return null;
  }
}

function writeCache(cacheKey, endpoint, data) {
  const filePath = getCachePath(cacheKey);
  const ttl = CACHE_TTL[endpoint] || DEFAULT_TTL;
  const envelope = { cachedAt: Date.now(), ttl, endpoint, data };
  try {
    fs.writeFileSync(filePath, JSON.stringify(envelope));
  } catch (err) {
    console.warn("Cache write failed:", err.message);
  }
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();
app.use(cors());

const NBA_BASE = "https://stats.nba.com/stats";
const NBA_HEADERS = {
  "User-Agent": "Mozilla/5.0",
  Referer: "https://www.nba.com/",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://www.nba.com",
  Host: "stats.nba.com",
  Connection: "keep-alive",
};

// Proxy route with disk cache
app.get("/api/nba/:endpoint", async (req, res) => {
  const { endpoint } = req.params;
  const cacheKey = buildCacheKey(endpoint, req.query);
  const ttl = CACHE_TTL[endpoint] || DEFAULT_TTL;
  const maxAge = Math.floor(ttl / 1000);

  // 1. Check disk cache
  const cached = readCache(cacheKey);
  if (cached) {
    res.set("Cache-Control", `public, max-age=${maxAge}`);
    res.set("X-Cache", "HIT");
    return res.json(cached);
  }

  // 2. Cache miss — fetch from NBA
  const query = new URLSearchParams(req.query).toString();
  const url = `${NBA_BASE}/${endpoint}${query ? "?" + query : ""}`;

  try {
    const response = await fetch(url, { headers: NBA_HEADERS });
    if (!response.ok) {
      return res.status(response.status).json({ error: `NBA API returned ${response.status}` });
    }
    const data = await response.json();

    // 3. Write to disk cache
    writeCache(cacheKey, endpoint, data);

    res.set("Cache-Control", `public, max-age=${maxAge}`);
    res.set("X-Cache", "MISS");
    res.json(data);
  } catch (err) {
    console.error(`Proxy error for ${endpoint}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Clear cache endpoint (dev use)
app.post("/api/cache/clear", (req, res) => {
  try {
    const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith(".json"));
    files.forEach(f => {
      try { fs.unlinkSync(path.join(CACHE_DIR, f)); } catch {}
    });
    console.log(`Cache cleared: ${files.length} files removed`);
    res.json({ cleared: files.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`NBA API proxy running on http://localhost:${PORT}`);
  console.log(`Disk cache directory: ${CACHE_DIR}`);
});
