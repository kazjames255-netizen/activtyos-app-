import { defineConfig } from "@playwright/test";

// Used only to record how-to videos against a running site (no servers are started):
//   E2E_BASE_URL=<site> RECORD_VIDEOS=1 npx playwright test -c playwright.video.config.ts e2e/<video spec>
export default defineConfig({
  testDir: "./e2e",
  timeout: 1_500_000,
  workers: 1,
  reporter: [["line"]],
  use: { actionTimeout: 15_000, baseURL: process.env.E2E_BASE_URL || "http://localhost:3000", trace: "retain-on-failure", screenshot: "only-on-failure" },
});
