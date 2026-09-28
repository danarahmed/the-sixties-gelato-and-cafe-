import { NextResponse } from "next/server";
import { getPosAddons, getPosCatalogue } from "@/lib/db/pos";

export const dynamic = "force-dynamic";

/**
 * The till's menu and its add-ons at today's prices, for a till left open
 * while prices change (0025, 0041). Read as the signed-in person: pos_catalogue needs
 * sale.create, exactly as the page does. Fetched rather than re-rendering the
 * page, so a till whose connection drops keeps its screen.
 */
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const [items, addons] = await Promise.all([getPosCatalogue(), getPosAddons()]);
    return NextResponse.json({ ok: true, items, addons }, { headers });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers });
  }
}
