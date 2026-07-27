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
