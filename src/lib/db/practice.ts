import "server-only";
/**
 * Practice (0096): the person's tasks, ticked from what they did in practice,
 * and for a manager the team's. Null before 0096.
 */
import { db } from "./client";
import {
  practiceStateFrom,
  practiceTeamFrom,
  type PracticeState,
  type TeamMember,
} from "@/lib/practice";

const missing = (code: string | undefined) => code === "PGRST202" || code === "42883";

export async function getPracticeState(): Promise<PracticeState | null> {
  const c = await db();
  const r = await c.rpc("practice_tasks");
  if (r.error) {
    if (missing(r.error.code)) return null;
    throw new Error(`Could not load practice_tasks: ${r.error.message}`);
  }
  return practiceStateFrom(r.data);
}

/** The team's practice, for those who keep the staff; null for anyone else or before 0096. */
export async function getPracticeTeam(): Promise<TeamMember[] | null> {
  const c = await db();
  const r = await c.rpc("practice_team");
  if (r.error) return null;
  return practiceTeamFrom(r.data);
}
