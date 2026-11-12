/**
 * The browser's safeguards (AN), as next.config.mjs gives them: every page
 * refuses to be shown inside another site, is never read as another type,
 * tells another site only where a link came from, and may not use the
 * camera, the microphone, the location, payments or USB. Pages also carry
 * their own policy (framed by no one, no <base> elsewhere, no plug-ins); a
 * product's photo keeps its stricter one. The browser suite (pages) reads
 * the headers the running app sends.
 */
import { describe, expect, it } from "vitest";
// @ts-expect-error: a plain module, read by Next itself
import nextConfig, { PAGE_POLICY, SAFEGUARDS } from "../next.config.mjs";

type Header = { key: string; value: string };
type Rule = { source: string; headers: Header[] };

const rules: Rule[] = await nextConfig.headers();
const on = (source: string) => rules.find((r) => r.source === source)?.headers ?? [];
const value = (headers: Header[], key: string) => headers.find((h) => h.key === key)?.value;

/** A rule's source as the regular expression Next matches a path with. */
const pattern = (source: string) =>
  new RegExp(`^${source.replace("/:path*", "(?:/.*)?").replace("/:path(", "/(")}$`);

describe("the browser's safeguards", () => {
  it("are on every page", () => {
    const every = on("/:path*");
    expect(every).toBe(SAFEGUARDS);
    expect(value(every, "X-Frame-Options")).toBe("DENY");
    expect(value(every, "X-Content-Type-Options")).toBe("nosniff");
    expect(value(every, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    const allowed = value(every, "Permissions-Policy") ?? "";
    for (const feature of ["camera", "microphone", "payment", "usb"])
      expect(allowed).toContain(`${feature}=()`);
    // Where the phone is, for clocking at the shop (0099): this site's own pages only.
    expect(allowed).toContain("geolocation=(self)");
    // The till goes full screen.
    expect(allowed).not.toContain("fullscreen");
  });

  it("give pages their own policy, and leave a product's photo its stricter one", () => {
    const rule = rules.find((r) => r.headers.some((h) => h.key === "Content-Security-Policy"))!;
    expect(value(rule.headers, "Content-Security-Policy")).toBe(PAGE_POLICY);
    expect(PAGE_POLICY).toContain("frame-ancestors 'none'");
    const pages = pattern(rule.source);
    for (const path of ["/", "/login", "/pos", "/accounting/bank", "/documents/bill/1"])
      expect(pages.test(path), path).toBe(true);
    expect(pages.test("/api/product-image/0f0e0d0c-0b0a-0908-0706-050403020100")).toBe(false);
  });
});

describe("the page's script policy (plan 7)", () => {
  it("runs only the page's own nonce'd scripts and talks only to the app", async () => {
    const { pagePolicy, makeNonce } = await import("../src/lib/csp");
    const a = makeNonce();
    const b = makeNonce();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(22);
    const p = pagePolicy(a);
    expect(p).toContain(`script-src 'self' 'nonce-${a}' 'strict-dynamic'`);
    expect(p).not.toContain("unsafe-eval");
    expect(p).toContain("connect-src 'self'");
    expect(p).not.toMatch(/connect-src[^;]*ws:/);
    expect(p).toContain("frame-ancestors 'none'");
    expect(p).toContain("object-src 'none'");
    expect(pagePolicy(a, true)).toContain("'unsafe-eval'");
  });
});
