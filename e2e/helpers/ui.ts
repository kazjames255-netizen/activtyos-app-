import type { Locator, Page } from "@playwright/test";

/**
 * The one sound way to assert "THIS run's row reached state X" on pages that
 * accumulate rows across runs: find the card element (every shared-Card row
 * carries data-ui="card") whose text contains every anchor — one of which must
 * be run-unique — and assert on / within it.
 *
 * A bare `page.getByText("Cancelled").first()` passes on any older row and
 * proves nothing; a `div.filter({has}).filter({has}).last()` chain silently
 * matches a page-level wrapper when the two texts sit in DIFFERENT rows.
 * Card boundaries are what make the containment check meaningful.
 *
 * `.last()` picks the innermost card when cards nest (document order puts
 * ancestors first); unrelated cards can never match the run-unique anchor.
 */
export const cardWith = (page: Page, ...anchors: (string | RegExp)[]): Locator =>
  anchors
    .reduce((cards, anchor) => cards.filter({ hasText: anchor }), page.locator('[data-ui="card"]'))
    .last();

/**
 * The shared parent account may not have dismissed the one-time first-login
 * welcome modal yet (features/parent/ParentWelcome.tsx) — it sits on top of
 * the whole page and blocks every click/assertion until closed. Its open
 * condition depends on an async /api/me + /api/my/children fetch, so an
 * un-awaited isVisible() check can race ahead of it appearing — wait briefly
 * instead, and do nothing if it never shows.
 */
export const dismissParentWelcome = async (page: Page) => {
  const close = page.getByRole("dialog").getByRole("button", { name: "Close" });
  await close.waitFor({ state: "visible", timeout: 8_000 }).then(() => close.click()).catch(() => {});
};
