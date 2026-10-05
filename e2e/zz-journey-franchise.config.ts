import { defineConfig } from "@playwright/test";
// Private config: no webServer, points at the already-running local stack.
export default defineConfig({
  testDir: ".",
  testMatch: /zz-journey-franchise\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 1_800_000,
  expect: { timeout: 20_000 },
  reporter: [["line"]],
  use: { actionTimeout: 30_000, navigationTimeout: 90_000, baseURL: process.env.E2E_BASE_URL || "http://localhost:3000", trace: "off", screenshot: "off" },
});
