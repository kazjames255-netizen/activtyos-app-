import { defineConfig } from "@playwright/test";
// Private config for the CN agent run: no webServer (the shared :3000 dev server was wedged); points at an already-running web.
export default defineConfig({
  testDir: ".",
  testMatch: /zz-agent-cn\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["line"]],
  use: { baseURL: process.env.E2E_BASE_URL || "http://localhost:3055", trace: "off", screenshot: "off" },
});
