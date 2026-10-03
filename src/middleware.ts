import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything except static files, which carry no data: the fonts among
  // them, so the sign-in page has its letters and a browser keeps them.
  matcher: [
    "/((?!_next/static|_next/image|fonts/|favicon.ico|icon.svg|icon-maskable.svg|manifest.webmanifest|sw.js|offline.html).*)",
  ],
};
