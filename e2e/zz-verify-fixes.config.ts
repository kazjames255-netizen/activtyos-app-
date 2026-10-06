import { defineConfig } from "@playwright/test";
// Private config for the verify-fixes run: no webServer, no setup project; points at an already-running web.
export default defineConfig({
  testDir: ".",
  testMatch: /zz-verify-fixes\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 900_000,
  expect: { timeout: 15_000 },
  reporter: [["line"]],
  use: { baseURL: process.env.E2E_BASE_URL || "http://localhost:3056", trace: "off", screenshot: "off" },
});
