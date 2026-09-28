import { defineConfig } from "@playwright/test";

// i18n browser pass config: no setup project (the spec provisions its own throwaway accounts).
export default defineConfig({
  testDir: "./e2e/review",
  testMatch: /i18n-browser-pass\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 1_500_000,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3000" },
});
