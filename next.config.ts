import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second dev server (the isolated e2e stack, `npm run dev:test`) needs its own build dir: two `next dev` in one dir fight over .next/dev/lock.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  /* config options here */
  // One id per build / dev-server start: versions the cached hub message catalogue URL (lib/i18n/hubMessages.ts).
  env: { NEXT_PUBLIC_BUILD_ID: Date.now().toString(36) },
  // Build-only tsconfig: leaves out e2e/, whose server-side helpers can't resolve firebase-admin on Vercel.
  typescript: { tsconfigPath: "tsconfig.build.json" },
  // The public product videos (tour + how-to) are marketing files: let other sites read them (e.g. importing the tour into a video tool
  // such as HeyGen) instead of the browser blocking the request. Nothing private lives under /v2/video/.
  // The old root-level copies of the marketing pages are superseded by /v2/ (and still carried claims the product does not support): send anyone who has
  // a bookmark or link to the current page.
  async redirects() {
    const legacy = ["activly", "companies", "dpa", "franchises", "freelancers", "mockups", "mockups2", "mockups3", "mockups4", "mockups5", "mockups6", "mockups7", "platform-bookings", "platform-comms", "platform-finance", "platform-safeguarding", "platform-staff", "pricing", "privacy", "security", "terms", "tour"];
    return legacy.map((n) => ({ source: `/${n}.html`, destination: `/v2/${n}.html`, permanent: false }));
  },
  async headers() {
    return [{ source: "/v2/video/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }];
  },
};

export default nextConfig;
