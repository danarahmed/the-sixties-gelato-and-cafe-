/**
 * The browser's safeguards, on every page (AN). No other site may show these
 * pages inside its own, where a click on the till or the books could be
 * steered (clickjacking); a file is never read as another type than it says;
 * another site is told only where a link came from, never the page's
 * address; and nothing here may use the camera, the microphone, the
 * location, payments in the browser or USB. Full screen (the till) stays.
 */
export const SAFEGUARDS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

/**
 * The page's own policy: framed by no one, no <base> pointing elsewhere, no
 * plug-ins. A product's photo keeps its stricter one (it runs nothing).
 */
export const PAGE_POLICY = "frame-ancestors 'none'; base-uri 'self'; object-src 'none'";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Resolve explicit ".js" specifiers in the domain core to their ".ts" sources.
  webpack(config) {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
  async headers() {
    return [
      { source: "/:path*", headers: SAFEGUARDS },
      {
        source: "/:path((?!api/product-image/).*)",
        headers: [{ key: "Content-Security-Policy", value: PAGE_POLICY }],
      },
      // The fonts change only with a new file name: a browser keeps them a month.
      {
        source: "/fonts/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }],
      },
      // The service worker and manifest are served from /public.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
