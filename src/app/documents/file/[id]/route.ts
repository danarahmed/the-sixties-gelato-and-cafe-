import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { documentLink } from "@/lib/db/documents";

export const dynamic = "force-dynamic";

/**
 * A document's file (0053), opened or downloaded: the person is sent to a link
 * to it that lasts a minute, made only if they may read it. The file itself is
 * never served from the app's own address.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.profile) return NextResponse.redirect(new URL("/login", req.url));
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const link = await documentLink(id, req.nextUrl.searchParams.get("download") === "1");
  if (!link) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(link, { headers: { "Cache-Control": "no-store" } });
}
