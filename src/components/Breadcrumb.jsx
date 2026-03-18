import React from "react";
import { ChevronRight } from "lucide-react";

export default function Breadcrumb({ items }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20, fontSize: 13 }}>
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <ChevronRight size={12} style={{ color: "var(--text-muted)" }} />}
          {item.onClick ? (
            <button
              onClick={item.onClick}
              style={{ background: "none", border: "none", color: "var(--accent-blue)", cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "'Inter', sans-serif", padding: 0 }}
            >
              {item.label}
            </button>
          ) : (
            <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
