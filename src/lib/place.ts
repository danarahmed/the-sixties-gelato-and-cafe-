import "server-only";
/**
 * Where this device does its stock work (release AB): a branch or the central
 * kitchen, chosen on the stock screens and kept on the device. A delivery taken
 * in without an order, a batch made, a loss, a correction, a count or opening
 * stock is recorded there, and the stock screens show that place's stock. With
 * one place there is nothing to choose, and the database takes the first
 * branch, as it always has.
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { getLocations } from "@/lib/db/read";

/** The cookie that keeps the device's place, a year at a time. */
export const PLACE_COOKIE = "place";

export interface Place {
  id: string;
  name: string;
  kind: string;
}

/**
 * The café's active places: the first branch first — where the database keeps
 * stock when no place is named — then the others, as they were added.
 */
export const getPlaces = cache(async (): Promise<Place[]> => {
  const all = (await getLocations()).filter((l) => l.isActive);
  const first = all.find((l) => l.kind === "branch");
  return [...(first ? [first] : []), ...all.filter((l) => l !== first)].map((l) => ({
    id: l.id,
    name: l.name,
    kind: l.kind,
  }));
});

/** This device's place: the one it chose while that place is in use, else the first. */
export const getPlace = cache(async (): Promise<Place | null> => {
  const places = await getPlaces();
  const chosen = (await cookies()).get(PLACE_COOKIE)?.value;
  return places.find((p) => p.id === chosen) ?? places[0] ?? null;
});

/**
 * The place a stock operation names: this device's when the café has more than
 * one, else none, and the database takes its first branch.
 */
export async function placeForWrite(): Promise<string | null> {
  const places = await getPlaces();
  if (places.length < 2) return null;
  return (await getPlace())?.id ?? null;
}

/**
 * For a stock screen: the places to choose from, this device's, and the place
 * its reads narrow to — this device's when the café has more than one, else
 * none (all its stock, as before).
 */
export async function placeChoice(): Promise<{
  places: Place[];
  place: Place | null;
  at: string | null;
}> {
  const [places, place] = await Promise.all([getPlaces(), getPlace()]);
  return { places, place, at: places.length > 1 ? (place?.id ?? null) : null };
}
