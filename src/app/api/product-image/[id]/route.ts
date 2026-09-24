import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

const TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A product's photo, to signed-in members of its business only (row-level
 * security decides, as for every read). Only the three picture types the
 * database accepted are served, never sniffed as anything else, and the
 * address carries a version, so the browser may keep it for good.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const missing = () =>
    new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  if (!UUID.test(id)) return missing();
  const c = await db();
  const { data, error } = await c
    .from("product_image")
    .select("content_type,data")
    .eq("product_id", id)
    .maybeSingle();
  if (error || !data) return missing();
  const type = String((data as { content_type: unknown }).content_type);
  const hex = String((data as { data: unknown }).data);
  if (!TYPES.has(type) || !hex.startsWith("\\x")) return missing();
  return new Response(Buffer.from(hex.slice(2), "hex"), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
    },
  });
}
