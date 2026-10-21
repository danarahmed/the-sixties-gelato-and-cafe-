"use server";
/** Find anything (E4): one box for every screen and record a person may see. */
import { findAnything, type Found } from "@/lib/db/findAnything";

export async function findAnythingAction(q: string): Promise<Found[]> {
  if (typeof q !== "string") return [];
  return findAnything(q);
}
