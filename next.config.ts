import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // One id per build / dev-server start: versions the cached hub message catalogue URL (lib/i18n/hubMessages.ts).
  env: { NEXT_PUBLIC_BUILD_ID: Date.now().toString(36) },
};

export default nextConfig;
