import "server-only";
/** Where people get stuck (0097), for the owner; null before 0097 or for anyone else. */
import { db } from "./client";

export interface StuckScreen {
  path: string;
  refused: number;
  help: number;
  practice: number;
  people: number;
  roles: string[];
  messages: { message: string; times: number }[];
}

export async function getStuckReport(days: number): Promise<StuckScreen[] | null> {
  const c = await db();
  const r = await c.rpc("stuck_report", { p_days: days });
  if (r.error) return null;
  const screens = (r.data as { screens?: unknown } | null)?.screens;
  return (Array.isArray(screens) ? (screens as Record<string, unknown>[]) : []).map((s) => ({
    path: String(s.path),
    refused: Number(s.refused) || 0,
    help: Number(s.help) || 0,
    practice: Number(s.practice) || 0,
    people: Number(s.people) || 0,
    roles: Array.isArray(s.roles) ? s.roles.map(String) : [],
    messages: Array.isArray(s.messages)
      ? (s.messages as Record<string, unknown>[]).map((m) => ({
          message: String(m.message ?? ""),
          times: Number(m.times) || 0,
        }))
      : [],
  }));
}
