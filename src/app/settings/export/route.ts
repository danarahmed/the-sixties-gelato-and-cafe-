import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * The business's data for its owner (0109), at any time, paid, read-only or
 * closed: one JSON file of its places, menu, stock items, suppliers,
 * customers, sales, stock movements and books. Asked as the signed-in person;
 * the database refuses anyone but the owner.
 */
export async function GET() {
  const s = await getSession();
  if (!s.profile) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const db = await createServerSupabase();
  const r = await db.rpc("export_business_data");
  if (r.error) return NextResponse.json({ error: r.error.message }, { status: 403 });
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(r.data), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="business-data-${day}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
