import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything except static files, which carry no data.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-maskable.svg|manifest.webmanifest|sw.js|offline.html).*)",
  ],
};
