import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/**
 * Test your devices (G4): whether the app reaches the database, and how long
 * the database took, as the signed-in person. Nothing is read but whether
 * an answer came.
 */
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const started = Date.now();
  try {
    const c = await db();
    const { error } = await c.from("business").select("id").limit(1);
    return NextResponse.json({ ok: !error, dbMs: Date.now() - started }, { headers });
  } catch {
    return NextResponse.json({ ok: false, dbMs: null }, { status: 503, headers });
  }
}
