import React from "react";

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border-color)",
        padding: "24px 0",
        textAlign: "center",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          className="font-display"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-muted)",
          }}
        >
          Courtside — NBA Analytics
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Powered by nba_api &middot; {new Date().getFullYear()}
        </span>
      </div>
    </footer>
  );
}
