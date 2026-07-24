import { defineConfig } from "@playwright/test";

// UI end-to-end suite. Runs against the real dev stack (web :3000, API :4000,
// live Firebase project) with throwaway @activityos-test.com accounts created
// in e2e/global.setup.ts and deleted by `npm run e2e:cleanup`.
//
// NB: every portal page holds an open SSE connection (lib/realtime.ts), so
// `networkidle` NEVER fires — wait for "load" or for specific elements.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/ },
    { name: "e2e", testMatch: /.*\.spec\.ts/, dependencies: ["setup"] },
  ],
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // Swagger UI is the only unauthenticated 200 the API serves.
      command: "npm run dev:server",
      url: "http://localhost:4000/docs/",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
