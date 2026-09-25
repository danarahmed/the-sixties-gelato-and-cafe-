import "server-only";
/**
 * The alerts and the daily brief (0029, the audit's P1-8). Each call brings
 * the alerts up to date first, in the database: new conditions open an alert,
 * cleared ones resolve themselves. The functions check the person's
 * permission themselves.
 */
import { db, one, rows, str, strOrNull } from "./client";
import {
  parseBrief,
  parseThresholds,
  type Alert,
  type Confidence,
  type DailyBrief,
  type Threshold,
} from "@/lib/alerts";

/** The alerts now, red first, answered ones included. */
export async function getCurrentAlerts(): Promise<Alert[]> {
  const c = await db();
  return rows(await c.rpc("current_alerts"), "the alerts").map((r: Record<string, unknown>) => ({
    id: str(r.id),
    rule: str(r.rule),
    subject: str(r.subject),
    urgency: r.urgency === "red" ? "red" : "orange",
    title: str(r.title),
    why: strOrNull(r.why),
    action: strOrNull(r.action),
    confidence: (["high", "medium", "low"].includes(str(r.confidence))
      ? str(r.confidence)
      : "medium") as Confidence,
    link: strOrNull(r.link),
    firstSeenAt: str(r.first_seen_at),
    lastSeenAt: str(r.last_seen_at),
    acknowledgedAt: strOrNull(r.acknowledged_at),
    acknowledgedBy: strOrNull(r.acknowledged_by),
    ackNote: strOrNull(r.ack_note),
    snoozedUntil: strOrNull(r.snoozed_until),
    snoozedBy: strOrNull(r.snoozed_by),
    snoozeReason: strOrNull(r.snooze_reason),
  }));
}

/** A day's brief: its facts, the calculations made from them, and what needs doing. */
export async function getDailyBrief(day: string): Promise<DailyBrief> {
  const c = await db();
  return parseBrief(one(await c.rpc("daily_brief", { p_day: day }), "the daily brief"));
}

/** Every threshold the alert rules use, with its default and limits (Settings). */
export async function getAlertThresholds(): Promise<Threshold[]> {
  const c = await db();
  return parseThresholds(one(await c.rpc("alert_thresholds"), "the alert thresholds"));
}
