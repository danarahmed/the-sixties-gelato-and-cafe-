/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The service worker and manifest are served from /public.
  async headers() {
    return [
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
