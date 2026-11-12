/**
 * The page's script policy (plan 7, item 7): a page runs only the app's own
 * scripts, each carrying the page's one-time nonce, and talks only to the
 * app's own address. A script slipped into a page (a name, a note, a
 * supplier's reference) is refused by the browser even if it ever got
 * through the screens. The browser talks to the app, and to Supabase's
 * storage alone for a document's file (a signed upload link, a signed link to
 * show it): nothing else is allowed.
 *
 * Styles stay inline-allowed: the screens set sizes and colours inline, and a
 * style runs nothing.
 */
export function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function pagePolicy(nonce: string, dev = false, supabaseUrl: string | null = null): string {
  let supabase = "";
  try {
    if (supabaseUrl) supabase = ` ${new URL(supabaseUrl).origin}`;
  } catch {
    supabase = "";
  }
  return [
    "default-src 'self'",
    // 'strict-dynamic': a script the page's own scripts load is trusted with
    // them (Next's chunks); nothing else. Development adds eval, for reloads.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // The receipt's logo is kept as data; a photo being made smaller, as a blob.
    `img-src 'self' data: blob:${supabase}`,
    "font-src 'self'",
    `connect-src 'self'${supabase}${dev ? " ws:" : ""}`,
    `media-src 'self' blob:${supabase}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}
