import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Where the links in Supabase's emails land: confirming a new login, or
 * setting a new password. Supports both link styles — a one-time token hash
 * (works on any device) and a PKCE code (works in the browser that asked).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = url.searchParams.get("next") ?? "/";
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const supabase = await createServerSupabase();

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");

  let failed = true;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    failed = Boolean(error);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  }

  const target = new URL(failed ? "/login" : safe, request.url);
  if (failed) target.searchParams.set("error", "link");
  return NextResponse.redirect(target);
}
