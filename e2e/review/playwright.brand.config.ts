import { defineConfig } from "@playwright/test";

// Standalone run of e2e/brand-theme.spec.ts against a private web+API pair (no shared setup project):
//   E2E_BASE_URL=http://localhost:3105 NEXT_PUBLIC_API_URL=http://localhost:4105 npx playwright test -c e2e/review/playwright.brand.config.ts
export default defineConfig({
  testDir: "..",
  testMatch: /brand-theme\.spec\.ts/,
  timeout: 240_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL || "http://localhost:3105", viewport: { width: 1280, height: 900 } },
});
