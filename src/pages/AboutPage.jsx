import React, { useState } from "react";
import { ABOUT } from "../data/about.js";

export default function AboutPage() {
  const activeLinks = ABOUT.links.filter((l) => l.href);

  return (
    <div className="fade-in" style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
      {/* Header */}
      <div
        className="card-hover"
        style={{
          padding: "36px 40px",
          borderRadius: 16,
          marginBottom: 24,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, var(--accent), var(--accent-amber))" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
          <img
            src="/2024profile.jpg"
            alt={ABOUT.name}
            style={{
              width: 80, height: 80, borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid rgba(249,115,22,0.35)",
              flexShrink: 0,
            }}
          />
          <div>
            <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{ABOUT.name}</h1>
            {ABOUT.title && (
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>{ABOUT.title}</div>
            )}
          </div>
        </div>

        {/* Bio paragraphs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {ABOUT.bio.map((para, i) => (
            <p key={i} style={{ margin: 0, fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.75 }}>
              {para}
            </p>
          ))}
        </div>

        {/* Links */}
        {activeLinks.length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
            {activeLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.href.startsWith("mailto") ? undefined : "_blank"}
                rel="noopener noreferrer"
                style={{
                  padding: "7px 18px",
                  borderRadius: 8,
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-color)"; e.currentTarget.style.color = "var(--text-primary)"; }}
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* About this app */}
      <div className="card-hover" style={{ padding: "28px 32px", borderRadius: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px" }}>About Courtside</h2>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.75 }}>
          Courtside is a personal NBA analytics dashboard built with React, Node.js, and SQLite.
          It pulls live data from the NBA Stats API, stores historical player profiles and game logs,
          and uses Claude (Anthropic) to generate daily game predictions with automated grading.
        </p>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.75 }}>
          Player archetypes (Floor General, Large Playmaker, Two-Way Wing, etc.) are derived nightly
          via fuzzy scoring across 13 archetype models — blending usage rate, true shooting, assist rate,
          drives, touches, defensive metrics, and position across all ~545 active NBA players.
        </p>
      </div>
    </div>
  );
}
