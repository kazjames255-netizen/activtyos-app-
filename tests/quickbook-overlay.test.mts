import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Regression (parent Browse activities > Quick book looked BLANK on a phone, 9 Oct 2026): the panel was `absolute inset-0` inside a wrapper
// that was not `relative`, so it stretched over the WHOLE page (every card tall) and its content sat at the top, off-screen for anyone
// who had scrolled to a card. It must be a viewport-fixed overlay so it is always on screen.
const src = readFileSync(new URL("../features/parent/QuickBookModal.tsx", import.meta.url), "utf8");

test("Quick book panel is a viewport-fixed overlay, not positioned against the page", () => {
  assert.match(src, /className="fixed inset-0 z-\[\d+\]/);
  assert.doesNotMatch(src, /className="absolute inset-0/);
});

test("Quick book content is wrapped in the error boundary", () => {
  assert.match(src, /<ViewErrorBoundary name="Quick book">/);
});
