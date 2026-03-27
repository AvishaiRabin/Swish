export const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg-primary: #f9f8f6;
    --bg-secondary: #f1efec;
    --bg-tertiary: #e7e4e0;
    --bg-hover: #dfdbd6;
    --accent-blue: #f97316;
    --accent-blue-dim: #ea580c;
    --accent-amber: #f59e0b;
    --accent-amber-dim: #d97706;
    --accent-green: #22c55e;
    --accent-red: #ef4444;
    --text-primary: #1a1a1a;
    --text-secondary: #5c5956;
    --text-muted: #9c9996;
    --border-color: #e5e2de;
    --border-hover: #ccc8c3;
  }

  body {
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: 'Inter', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .font-display { font-family: 'Outfit', sans-serif; }
  .font-mono { font-family: 'JetBrains Mono', monospace; }

  @keyframes pulse-live {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1); }
  }

  @keyframes glow {
    0%, 100% { box-shadow: 0 0 5px rgba(249, 115, 22, 0.3); }
    50% { box-shadow: 0 0 20px rgba(249, 115, 22, 0.6); }
  }

  @keyframes ticker-scroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .live-pulse { animation: pulse-live 1.5s ease-in-out infinite; }
  .ai-glow { animation: glow 2s ease-in-out infinite; }
  .fade-in { animation: fadeIn 0.3s ease-out; }
  .page-transition { animation: pageSlideIn 0.25s ease-out; }
  @keyframes pageSlideIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .ticker-track {
    animation: ticker-scroll 80s linear infinite;
    display: flex;
    gap: 24px;
    white-space: nowrap;
  }
  .ticker-track:hover { animation-play-state: paused; }

  .score-scroll {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .score-scroll::-webkit-scrollbar { display: none; }

  .card-hover {
    transition: all 0.2s ease;
    border: 1px solid var(--border-color);
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .card-hover:hover {
    border-color: var(--border-hover);
    background: var(--bg-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.06);
  }

  .nav-link {
    position: relative;
    transition: color 0.2s ease;
    padding: 8px 0;
  }
  .nav-link::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 0;
    height: 2px;
    background: var(--accent-blue);
    transition: width 0.2s ease;
  }
  .nav-link:hover::after,
  .nav-link.active::after {
    width: 100%;
  }

  .stat-number {
    font-family: 'JetBrains Mono', monospace;
    font-variant-numeric: tabular-nums;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  /* ===== RESPONSIVE ===== */
  @media (max-width: 1024px) {
    .nav-links { gap: 16px !important; }
    .nav-label { display: none; }
    .nav-search-input { width: 160px !important; }
  }

  @media (max-width: 768px) {
    .nav-container {
      padding: 0 12px !important;
      height: 56px !important;
    }
    .nav-links { gap: 8px !important; }
    .nav-logo-text { display: none; }
    .nav-search-input { width: 120px !important; }
    .nav-link { padding: 4px !important; }
  }

  @media (max-width: 640px) {
    .nav-links { display: none !important; }
    .nav-search-input { width: 140px !important; }
  }

  /* Mobile bottom nav for small screens */
  @media (max-width: 640px) {
    .mobile-bottom-nav {
      display: flex !important;
    }
  }

  /* Home page responsive */
  @media (max-width: 1024px) {
    .home-grid { grid-template-columns: 1fr !important; }
  }
  @media (max-width: 768px) {
    .standings-grid { grid-template-columns: 1fr !important; }
    .picks-grid { grid-template-columns: 1fr !important; }
  }
`;
