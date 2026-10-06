import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: ".", testMatch: /zz-cn033\.spec\.ts/, workers: 1, retries: 0, timeout: 300_000, expect: { timeout: 20_000 }, reporter: [["line"]], use: { baseURL: process.env.E2E_BASE_URL || "http://localhost:3000", trace: "off", screenshot: "off" } });
