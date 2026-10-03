import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: ".", testMatch: /zz-verify-rules\.spec\.ts/, fullyParallel: false, workers: 1, retries: 0, timeout: 1_800_000, reporter: [["line"]] });
