import "server-only";
/**
 * The watch list (0094): only for the owner (and the general manager if the
 * owner allows it). None before 0094 is applied, or for anyone else.
 */
import { watchListFrom, type WatchList } from "@/lib/watch";
import { db } from "./client";

export async function watchMaySee(): Promise<boolean> {
  const c = await db();
  const r = await c.rpc("watch_may_see");
  return !r.error && r.data === true;
}

export async function getWatchList(): Promise<WatchList | null> {
  const c = await db();
  const r = await c.rpc("watch_list");
  if (r.error) return null;
  return watchListFrom(r.data as Record<string, unknown> | null);
}
