"use client";

import type React from "react";
import { useT } from "@/lib/i18n/I18nProvider";

export const inputStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 8,
  padding: "0 12px",
  fontSize: "1rem",
  background: "var(--surface)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  width: "100%",
  boxSizing: "border-box",
};

export function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <label style={{ display: "block", ...style }}>
      <div className="muted" style={{ fontSize: ".85rem", marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </label>
  );
}

/**
 * Small inline success/error banner for form actions. What it says comes from
 * the server or the database in English, and is shown in the reader's language.
 */
export function Notice({ msg }: { msg: { ok: boolean; text: string } | null }) {
  const { msg: say } = useT();
  if (!msg) return null;
  return (
    <div
      className={`badge ${msg.ok ? "ok" : "err"}`}
      style={{ alignSelf: "start", whiteSpace: "normal" }}
    >
      {msg.ok ? "✅ " : "⚠️ "}
      {say(msg.text)}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div
      className="card"
      style={{ textAlign: "center", padding: "28px 16px", color: "var(--muted, #888)" }}
    >
      <div style={{ fontSize: "1.5rem", marginBottom: 6 }}>🗒️</div>
      <strong>{title}</strong>
      {hint && (
        <p className="muted" style={{ fontSize: ".9rem", margin: "6px 0 0" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
