# Overnight i18n sweep (30 Sep to 1 Oct 2026)

Goal: every piece of text on the platform switches into en, ar, ur, pl, ro, cy, bn, pa, pt, es, fr (ar and ur right-to-left) from one language selector.
This file is a running log. Numbers marked (measured) come from `e2e/i18n/overnight-sweep.spec.ts`; everything else is what the workers reported and was NOT proven by the sweep. Nothing here claims "fully translated".

## Mechanism added tonight
- Language is now stored in a cookie (`aos.locale`) as well as localStorage. `app/layout.tsx` reads it on the server, so the first paint already has the right text, `<html lang>` and `dir` (no English flash, RTL correct before hydration), and the meta description is translated (`p8pub.metaDescription`).
- A language selector is shown on every public page (`components/i18n/PublicLanguagePicker.tsx`, fixed to the inline-end corner, hidden inside the six portals which have their own in the header, and hidden on `?embed=1` and `/call-ended`). Signed-in users also get their choice saved to the account (`PUT /api/account`, pre-existing); a signed-out choice is browser-only. Restoring the account language on a new device is NOT done (the API does not return it on `/api/me`; not changed tonight).
- `BRAND` constant in `lib/i18n/config.ts` and a `{brand}` token filled automatically by `translate()`. 187 hard-coded product names in existing catalogue strings were replaced by `{brand}`. NOT done: hard-coded product name in non-catalogue code (about 130 places in TSX) and the "Activly" wordmark in `components/auth/AuthBrand.tsx`; the rename needs a decision.
- API error messages: `lib/api.ts` now passes server error text through `lib/i18n/apiErrors.ts` (catalogue area `p8api`, generated from `scripts/i18n/api-errors/*.json` by `scripts/i18n/build-api-errors.mjs`). Server responses are unchanged; the original English is kept on `ApiError.rawMessage`. Code that compares error text must use `rawMessage` (known: `features/listings/ListingWizard.tsx:1067` uses `e.message.includes("changed elsewhere")`).
- Tools: `scripts/i18n/find-english.mjs` (heuristic hard-coded English finder), `scripts/i18n/check-areas.mjs` (area catalogue checker), `scripts/i18n/extract-api-errors.mjs`, `e2e/i18n/overnight-sweep.spec.ts`.

