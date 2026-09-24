import { NextResponse } from "next/server";
import { getOpenBills } from "@/lib/db/pos";

export const dynamic = "force-dynamic";

/**
 * The open bills, for tills keeping in step with each other. Read as the
 * signed-in person: the database decides what they may see (pos_open_bills
 * needs sale.create), exactly as it does for the page.
 */
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    return NextResponse.json({ ok: true, bills: await getOpenBills() }, { headers });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers });
  }
}
