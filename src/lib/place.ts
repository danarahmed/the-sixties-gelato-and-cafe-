import "server-only";
/**
 * Where this device works (release AB): a branch or the central kitchen,
 * chosen on the stock screens and on the till, and kept on the device. A
 * delivery taken in without an order, a batch made, a loss, a correction, a
 * count or opening stock is recorded there, and the stock screens show that
 * place's stock; the till sells at it when it is a branch. With one place there
 * is nothing to choose, and the database takes the first branch, as it always
 * has. Someone who works at one place (0055) works there, whatever the device
 * says: the database refuses anything they record anywhere else.
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { getLocations } from "@/lib/db/read";
import { getSession } from "@/lib/auth/session";

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
export const getCafePlaces = cache(async (): Promise<Place[]> => {
  const all = (await getLocations()).filter((l) => l.isActive);
  const first = all.find((l) => l.kind === "branch");
  return [...(first ? [first] : []), ...all.filter((l) => l !== first)].map((l) => ({
    id: l.id,
    name: l.name,
    kind: l.kind,
  }));
});

/**
 * The places this person may work at: the one they work at, or all of the
 * café's when they work everywhere.
 */
export const getPlaces = cache(async (): Promise<Place[]> => {
  const [places, session] = await Promise.all([getCafePlaces(), getSession()]);
  const mine = session.profile?.worksAt ?? null;
  if (!mine) return places;
  const place = places.find((p) => p.id === mine);
  return place ? [place] : places;
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
  const [cafe, place] = await Promise.all([getCafePlaces(), getPlace()]);
  if (cafe.length < 2) return null;
  return place?.id ?? null;
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
  const [cafe, places, place] = await Promise.all([getCafePlaces(), getPlaces(), getPlace()]);
  return { places, place, at: cafe.length > 1 ? (place?.id ?? null) : null };
}

/**
 * The branch this device's till sells at (0055): the device's place when it
 * is a branch; the café's only branch when there is one; else none, and the
 * till asks which branch it is at. `branches` are those to choose from, and
 * `at` is what the till's reads and writes name: none when the café has one
 * place, as before.
 */
export async function tillChoice(): Promise<{
  branches: Place[];
  branch: Place | null;
  at: string | null;
}> {
  const [cafe, places, place] = await Promise.all([getCafePlaces(), getPlaces(), getPlace()]);
  const branches = places.filter((p) => p.kind === "branch");
  const branch =
    place?.kind === "branch" ? place : branches.length === 1 ? (branches[0] ?? null) : null;
  return { branches, branch, at: cafe.length > 1 ? (branch?.id ?? null) : null };
}

/**
 * The branch a till operation names: the till's when the café has more than
 * one place, else none. A till that has no branch to sell at names the first
 * of those this person may work at, and the database refuses what cannot be
 * done there.
 */
export async function tillForWrite(): Promise<string | null> {
  const { branches, at } = await tillChoice();
  const cafe = await getCafePlaces();
  if (cafe.length < 2) return null;
  return at ?? branches[0]?.id ?? null;
}
