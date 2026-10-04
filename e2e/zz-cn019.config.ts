import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: ".", testMatch: /zz-cn019\.spec\.ts/, fullyParallel: false, workers: 1, retries: 0, timeout: 900_000, reporter: [["line"]] });
