import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SESSION_COOKIE, supabaseConfig } from "./config";
import { isPublicPath } from "@/lib/auth/routes";

/**
 * Runs before every page: refreshes the person's session cookie and sends
 * anyone who is not signed in to the sign-in page. Nothing in the app is
 * reachable anonymously except signing in itself (audit C-01).
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;
  const cfg = supabaseConfig();
  if (!cfg) {
    if (path === "/setup") return NextResponse.next({ request });
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(cfg.url, cfg.anonKey, {
    cookieOptions: SESSION_COOKIE,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Verifies the session token (never trusts the cookie as-is) and refreshes
  // it if it is about to expire. Must run before the response is produced.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  // Pages carry the books: never let a shared cache or proxy keep a copy.
  // Product photos are the one exception: private to the browser, and their
  // address changes with every new picture, so the till need not fetch them
  // again on every visit.
  if (!path.startsWith("/api/product-image/")) {
    response.headers.set("Cache-Control", "private, no-store");
  }

  if (!signedIn && !isPublicPath(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (path !== "/") url.searchParams.set("next", path);
    return withCookies(NextResponse.redirect(url), response);
  }
  if (signedIn && path === "/login") {
    return withCookies(NextResponse.redirect(new URL("/", request.url)), response);
  }
  return response;
}

/** Carry any refreshed or cleared session cookies onto a redirect. */
function withCookies(target: NextResponse, source: NextResponse): NextResponse {
  for (const c of source.cookies.getAll()) target.cookies.set(c);
  target.headers.set("Cache-Control", "private, no-store");
  return target;
}
