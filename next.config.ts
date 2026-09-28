import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second dev server (the isolated e2e stack, `npm run dev:test`) needs its own build dir: two `next dev` in one dir fight over .next/dev/lock.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  /* config options here */
  // One id per build / dev-server start: versions the cached hub message catalogue URL (lib/i18n/hubMessages.ts).
  env: { NEXT_PUBLIC_BUILD_ID: Date.now().toString(36) },
};

export default nextConfig;
