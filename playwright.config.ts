import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "@playwright/test";

// The inbound-email specs post to the API's webhook, which authenticates with
// INBOUND_EMAIL_SECRET. That value lives in server/.env (the API reads it via
// dotenv), and this process doesn't load it — so the suite would send the old
// dev fallback and get a 401 the moment a real secret is configured. Lift just
// that key across, without overriding anything already in the environment.
const serverEnv = path.join(process.cwd(), "server", ".env");
if (fs.existsSync(serverEnv)) {
  const lines = fs.readFileSync(serverEnv, "utf8").split("\n");
  for (const key of ["INBOUND_EMAIL_SECRET"]) {
    if (process.env[key]) continue;
    const line = lines.find((l) => l.startsWith(`${key}=`));
    if (line) process.env[key] = line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
  }
}

// E2E_STACK=test → the ISOLATED stack (web :3001 → API :4001, `npm run dev:test`): the suite's writes and cache churn then never touch
// the API/web a person is using on :3000/:4000 (see docs/hub-slow-loads.md). scripts/e2e-locked.sh sets the env for it.
const TEST_STACK = process.env.E2E_STACK === "test";
const WEB = process.env.E2E_BASE_URL || (TEST_STACK ? "http://localhost:3001" : "http://localhost:3000");
const API = process.env.NEXT_PUBLIC_API_URL || (TEST_STACK ? "http://localhost:4001" : "http://localhost:4000");

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
    baseURL: WEB,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/ },
    { name: "e2e", testMatch: /.*\.spec\.ts/, dependencies: ["setup"] },
  ],
  webServer: [
    {
      command: TEST_STACK ? "npm run dev:test:web" : "npm run dev",
      url: WEB,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // Swagger UI is the only unauthenticated 200 the API serves.
      command: TEST_STACK ? "npm run dev:test:api" : "npm run dev:server",
      url: `${API}/docs/`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
