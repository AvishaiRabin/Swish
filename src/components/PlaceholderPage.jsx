import React from "react";
import { BarChart3 } from "lucide-react";

export default function PlaceholderPage({ title }) {
  return (
    <div
      className="fade-in"
      style={{
        maxWidth: 1400,
        margin: "0 auto",
        padding: "80px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px",
        }}
      >
        <BarChart3 size={32} style={{ color: "var(--accent-blue)" }} />
      </div>
      <h1
        className="font-display"
        style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: 16,
          color: "var(--text-secondary)",
          maxWidth: 400,
          margin: "0 auto",
        }}
      >
        This section is coming soon. Stay tuned for in-depth analytics.
      </p>
      <div
        style={{
          marginTop: 24,
          padding: "10px 20px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          borderRadius: 8,
          display: "inline-block",
          fontSize: 13,
          color: "var(--accent-amber)",
          fontWeight: 500,
        }}
      >
        Coming soon
      </div>
    </div>
  );
}
