import path from "node:path";
import { defineConfig } from "@playwright/test";

// Review config: provisions only tutor/company/staff/parent throwaways (no platform, no 2FA). Accounts live in e2e/review/.auth-suite.
process.env.E2E_AUTH_DIR = path.join(process.cwd(), "e2e/review/.auth-suite");
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "setup", testMatch: /review\.setup\.ts/ },
    { name: "e2e", testMatch: /.*\.spec\.ts/, dependencies: ["setup"] },
  ],
});
