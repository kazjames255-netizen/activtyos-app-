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
 * condition depends on a chained /api/me + /api/my/children fetch that can
 * resolve well after page load under a busy dev server, so it can pop up
 * *mid-test*, after an earlier one-shot dismiss already ran and moved on —
 * a fixed up-front wait-then-click races that and silently loses.
 *
 * addLocatorHandler is the correct primitive for this: Playwright re-checks
 * it during every subsequent action's own actionability retry (not just
 * once here), so it dismisses the dialog no matter when it appears —
 * including a second time — before letting the real action proceed.
 *
 * It can pop up *behind* one of our own later full-screen modals (e.g. the
 * add-child wizard) if its async open-check resolves after that modal's
 * already up — same DOM-order/z-index tie, later-mounted element paints on
 * top. addLocatorHandler blocks ALL further actions on the page — not just
 * ones it visually occludes — until this locator is confirmed hidden, so a
 * normal click that can't land through the occlusion leaves every later
 * action re-triggering the same failing handler for the rest of the test
 * (confirmed via trace: 200+ retries, one per subsequent action). `force`
 * bypasses the actionability/visibility check and dispatches the click at
 * the button's coordinates directly — correct here because we're
 * deliberately closing something sitting behind another layer, not
 * pretending a real user could see it.
 *
 * Prefer `markParentWelcomed` (tenantData.ts) before navigating at all —
 * it dismisses the popup server-side so it never opens. This handler is the
 * belt-and-braces fallback for callers that can't do that (or a fresh
 * account that hasn't been marked yet).
 */
const welcomeHandlerRegistered = new WeakSet<Page>();

export const dismissParentWelcome = async (page: Page) => {
  if (welcomeHandlerRegistered.has(page)) return;
  welcomeHandlerRegistered.add(page);
  const dialog = page.locator('[role="dialog"][aria-labelledby="welcome-title"]');
  await page.addLocatorHandler(dialog, async () => {
    await dialog.getByRole("button", { name: "Close" }).click({ force: true, timeout: 5_000 }).catch(() => {});
  });
};
