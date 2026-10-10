import test from "node:test";
import assert from "node:assert/strict";
import { manualEntries } from "../scripts/manual-entries.mts";

// The Manual is a quick reference, not a bible (owner rule, 10 Oct 2026): every entry stays short.
// Entries are read straight from the real source (features/platform/ManualApp.tsx), nothing is duplicated here.
// Page3 ("Food for thought at launch") is an owner-decision memo, not a reference entry, so it is left out.
const MAX_WORDS = 80;

test("manual: every entry is at most 80 words (title included)", () => {
  const entries = manualEntries(new URL("../features/platform/ManualApp.tsx", import.meta.url).pathname, ["Page3"]);
  assert.ok(entries.length > 100, `expected to find the Manual entries, found ${entries.length}`);
  const long = entries.filter((e) => e.words > MAX_WORDS);
  assert.deepEqual(
    long.map((e) => `${e.title} (${e.words} words, line ${e.line})`),
    [],
    `Manual entries over ${MAX_WORDS} words. Rewrite them as 2 to 4 short bullets or sentences, about 60 words:\n${long.map((e) => `  - ${e.title}: ${e.words}`).join("\n")}`,
  );
});
