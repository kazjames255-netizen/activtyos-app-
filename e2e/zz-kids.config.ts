import { defineConfig, devices } from "@playwright/test";
// Private config for the children-step run. KIDS_MODE=phone -> WebKit iPhone 13, otherwise desktop Chromium 1280.
const phone = process.env.KIDS_MODE === "phone";
export default defineConfig({
  testDir: ".",
  testMatch: /zz-kids\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 900_000,
  expect: { timeout: 20_000 },
  reporter: [["line"]],
  use: { ...(phone ? devices["iPhone 13"] : { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } }), baseURL: process.env.E2E_BASE_URL || "http://localhost:3000", trace: "off", screenshot: "off" },
});
