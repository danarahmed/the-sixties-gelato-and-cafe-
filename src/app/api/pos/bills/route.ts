import { NextResponse } from "next/server";
import { getOpenBills } from "@/lib/db/pos";
import { tillChoice } from "@/lib/place";

export const dynamic = "force-dynamic";

/**
 * The open bills at this till's branch (0055), for tills keeping in step with each other. Read as the
 * signed-in person: the database decides what they may see (pos_open_bills
 * needs sale.create), exactly as it does for the page.
 */
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const { at } = await tillChoice();
    return NextResponse.json({ ok: true, bills: await getOpenBills(at) }, { headers });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers });
  }
}
