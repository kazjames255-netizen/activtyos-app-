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
  async headers() {
    return [{ source: "/v2/video/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }];
  },
};

export default nextConfig;
