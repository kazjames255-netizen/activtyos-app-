import { defineConfig, devices } from "@playwright/test";
// Private config for the parent Home run: no webServer/setup project; WebKit on an iPhone 13 profile (the spec opens its own desktop contexts too).
export default defineConfig({
  testDir: ".",
  testMatch: /zz-parent-home\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 900_000,
  expect: { timeout: 20_000 },
  reporter: [["line"]],
  use: { ...devices["iPhone 13"], baseURL: process.env.E2E_BASE_URL || "http://localhost:3000", trace: "off", screenshot: "off" },
});
