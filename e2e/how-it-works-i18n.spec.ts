import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";

// The translated explainer overlays (features/learninghub/howitworks/i18n/<locale>.json) must stay consistent with the English scripts:
// every cue / key phrase is found in the translated narration, lengths and placeholders match. Pure node, no browser.
test("every locale overlay of the How it works explainers passes the integrity check", () => {
  let out = "";
  try { out = execFileSync("node", [path.join(__dirname, "../scripts/how-i18n-template.cjs"), "--check"], { encoding: "utf8" }); }
  catch (e) { out = String((e as { stdout?: string }).stdout ?? e); expect.soft(out, "how-i18n check failed").toBe("ok"); }
  expect(out).not.toMatch(/problems|MISSING/);
});
