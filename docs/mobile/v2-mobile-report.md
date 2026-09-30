# Activly v2 marketing site: phone and tablet report (1 Oct 2026, overnight agent)

Branch `worktree-agent-a8b06c0f3ba036940`. Nothing pushed. Scope: `public/v2/**` plus `scripts/mobile-v2/**` and this report.

## How the work was done
- New files: `public/v2/responsive.css` (all fixes) and `public/v2/responsive.js` (burger drawer, tap-to-toggle dropdowns, hero-slider swipe, 12px text floor).
- Each of the 18 public pages got exactly one edit: `<link rel="stylesheet" href="/v2/responsive.css"><script src="/v2/responsive.js" defer></script>` immediately before the first `</head>`. No inline style, markup or copy was edited. `mockups*.html` and `companies.prehero.html` are not linked from the navigation and were not touched.
- Every rule is inside a `max-width`, `hover:none` or `pointer:coarse` query, so laptops (1280/1440, mouse) are unchanged. Specificity is raised (`html body .wrap ...`) because page inline `<style>` blocks load after the link.
- Engine: real WebKit (Playwright `webkit-2311`) with iPhone-13 UA, `hasTouch`/`isMobile`. Chromium was not used. It is WebKit on macOS, not iOS Safari: see the real-device checklist.
- Matrix: 320x568, 390x844, 430x932, 844x390, 744x1133, 820x1180, 834x1194, 1024x1366, 1194x834, 1180x820, 1366x1024, plus 1280x800 and 1440x900 regression. 18 pages x 13 viewports, all screenshotted and viewed (contact sheets) for the key pages.
- Lighthouse is not installed; skipped (per brief, no heavy tooling).

## Laptop regression (must be identical)
A/B method: same code state, WebKit, animations/rAF/timers frozen, once with `responsive.*` blocked (= the original pages) and once with it loaded; pixel diff of full-page shots at 1280x800 and 1440x900 for all 18 pages (36 pairs).
Result: 35 of 36 byte-identical; `schools` 1280 differs only by image resampling noise in one photo tile (visually identical at 3x zoom; the earlier run showed the same kind of noise on other pages and it moved around). Nothing layout-related changed at laptop size.
Scripts: `scripts/mobile-v2/audit.mjs` (BLOCK=1 FREEZE=1), `diff.py`.

## Detector counts (before > after)
Detectors: horizontal overflow (scrollWidth>innerWidth), elements wider than viewport (excluding ones clipped inside an in-viewport overflow container), text <12px, tap targets <44x44, inputs <16px, images wider than viewport, vh usage, background-attachment:fixed.
- Horizontal page overflow and elements wider than the viewport: 0 before and 0 after on every page and viewport. Caveat: the site clips overflow in wrappers, so those detectors under-report; the real breakage (clipped rota columns, squashed columns, cut-off orbit chips, header covering 180px) was found by eye and is listed per page below.
- `vh`/`background-attachment:fixed`: none in the site CSS (one `max-height:min(70vh,520px)` dropdown cap that is now a static drawer on phones). Inputs under 16px: only the two range sliders on the home calculator (not text inputs, no iOS focus zoom).
- Text <12px and taps <44px (visible elements, excluding inline text links). Note: "after" excludes SVG-internal text (scales with the SVG); "before" included it, so the small-text drop is slightly flattered. Non-SVG small text really did go to 0 via the 12px floor.

| page | 390 small-text | 390 taps | 820 small | 820 taps | 1024 taps | 844 land taps |
|---|---|---|---|---|---|---|
| activly | 152 > 0 | 46 > 6 | 152 > 0 | 46 > 6 | 51 > 6 | 46 > 6 |
| parents | 94 > 0 | 16 > 0 | 94 > 0 | 16 > 0 | 17 > 2 | 16 > 0 |
| companies | 201 > 0 | 39 > 14 | 201 > 0 | 39 > 14 | 44 > 14 | 39 > 14 |
| franchises | 82 > 0 | 25 > 0 | 82 > 0 | 25 > 0 | 30 > 0 | 25 > 0 |
| freelancers | 46 > 0 | 35 > 10 | 46 > 0 | 35 > 10 | 40 > 10 | 35 > 10 |
| schools | 62 > 0 | 24 > 0 | 62 > 0 | 24 > 0 | 29 > 0 | 24 > 0 |
| pricing | 13 > 0 | 29 > 0 | 13 > 0 | 30 > 0 | 35 > 0 | 30 > 0 |
| tour | 5 > 0 | 24 > 0 | 5 > 0 | 24 > 0 | 29 > 0 | 24 > 0 |
| safeguarding | 8 > 0 | 24 > 0 | 8 > 0 | 24 > 0 | 29 > 0 | 24 > 0 |
| security | 5 > 0 | 24 > 0 | 5 > 0 | 24 > 0 | 29 > 0 | 24 > 0 |
| platform-bookings | 17 > 0 | 24 > 0 | 17 > 0 | 24 > 0 | 29 > 0 | 24 > 0 |
| platform-comms | 77 > 0 | 24 > 0 | 77 > 0 | 24 > 0 | 29 > 0 | 24 > 0 |
| platform-finance | 127 > 0 | 24 > 0 | 133 > 0 | 24 > 0 | 29 > 0 | 24 > 0 |
| platform-safeguarding | 95 > 0 | 25 > 1 | 95 > 0 | 25 > 1 | 30 > 1 | 25 > 1 |
| platform-staff | 147 > 0 | 24 > 0 | 147 > 0 | 24 > 0 | 29 > 0 | 24 > 0 |
| privacy | 26 > 0 | 41 > 0 | 26 > 0 | 41 > 0 | 46 > 0 | 41 > 0 |
| terms | 23 > 0 | 48 > 0 | 23 > 0 | 48 > 0 | 53 > 0 | 48 > 0 |
| dpa | 21 > 0 | 40 > 0 | 21 > 0 | 40 > 0 | 45 > 0 | 40 > 0 |

Remaining "tap" hits are not real misses: carousel dots (home, companies, freelancers; visually 9px but each has a 30x44 invisible hit area via `::before`/`::after`), and decorative buttons drawn inside product mock-ups (`bk-manage` 76x27 and `reg-btn` 64x25 are fake UI in screenshots-as-HTML). The parents 1024 taps (2) were fixed after the final matrix (`.pa-auth a` min-height 44) and re-verified: 0.

## Site-wide decisions (what was wrong, what changed, why)
1. **Navigation.** Below 960px the nav was a 3-row sticky header (about 180px tall on a phone: brand, then sign in/sign up, then a wrapped link row) and the Platform/Built-for dropdowns opened only via `:focus-within`/`:hover`, which iOS Safari does not trigger on tap (buttons don't take focus on tap). "For parents" was dropped below 1100px. Now: compact 60px bar (logo, "Provider sign up" CTA kept in the bar, 44px burger), drawer with large rows, accordion dropdowns (tap to open, one at a time), "For parents" and "Provider sign in" restored in the drawer, Esc closes, `aria-expanded`/`aria-controls`, background scroll lock, drawer scrolls itself in landscape. The drawer is the ORIGINAL nav DOM restyled (no cloned markup), so the other agent's `data-i18n` translations keep working. Parents page header (different markup: `.pa-auth` pill) handled the same way (Parent sign up in bar, Parent sign in + For providers in the drawer). Touch tablets on the desktop-width nav (>=960, `hover:none`) get tap-to-toggle dropdowns and 44px items.
2. **Hero product mock-up ("pw" window).** The 164px sidebar was forced back on at phone width (a later rule beat the 860px hide rule), squeezing the main area to a sliver with vertical one-letter text. Sidebar hidden under 860 everywhere, and under 1200 in the hero (1024 iPad showed "INCOME COLLECTE/D"). `overflow-wrap:anywhere` switched to `break-word` under 1100. Reason logged: sidebar is mock chrome, not content.
3. **Micro-copy in mock-ups.** 9-11px text inside mock UIs (inherent to the desktop art) is raised to 12px by `responsive.js` on touch or <=1024 only, restored if the window grows. Laptops untouched. Risk: a few chips are slightly tighter.
4. **Touch targets/iOS:** 44px buttons, FAQ summaries, footer links, footer social icons, legal TOC links, billing toggle, carousel dots (extended hit area), `touch-action:manipulation` (no 300ms delay), grey tap highlight tuned.
5. **Dev "Live - auto-updates as changes ship" badge** (fixed bottom-left, `#liveflag`) covered content on touch screens; hidden at <=1024 and on coarse pointers only. It looks like a development indicator that probably should not be on the production site at all: Kaz, decide. (Logged as a hide, not a deletion.)
6. **Backdrop blur** removed from the sticky header under 960px (scroll performance); reduced-motion already handled by the earlier pass in `activly.css`.

## Per page
- **activly (home):** nav (above); hero mock (above); "orbit" diagram (chips absolutely positioned on an animated ellipse, cut off and overlapping at 390 and 820) becomes the laptop graphic with the same chips wrapped underneath up to 900px (nothing dropped; the JS still writes transforms but `!important` static rules win; wasted rAF work is paused off-screen by the page's own observer); comparison table fitted to the screen instead of clipping the Activly column behind a hidden sideways scroll; trust row separators hidden where they wrapped alone. Not changed: marquee, feature carousel (already scroll-snap), calculator.
- **parents:** nav variant; otherwise already good on phones. Kept.
- **companies:** hero slider content was centred inside a fixed 540/600px slide and the top of the headline was clipped; heights released under 900px; swipe gestures added (it was mouse/autoplay only); parent-app block had an inline `minmax(0,1fr) 340px` grid that put the text in a 40px-wide column: single column under 640, original two columns kept on tablets. Not changed: slider autoplay every 3s (page's own decision; flagged).
- **freelancers:** hero stage (330px phone inside a 4:3 box) spilled over the CTAs and hid the three floating proof cards; now phone plus the three cards stacked beneath it (content restored, previously `display:none`).
- **franchises, schools, tour, safeguarding, security, privacy, terms, dpa:** fine after nav + touch-target + text floor; no layout redesign needed.
- **pricing:** plan cards stacked fine on phone; on iPad they were a 440px column leaving half the screen empty: now 2 columns (franchise card full width below). Comparison table fits the screen (was clipped to the Freelancer column). Website add-on card title was squeezed into a 100px column: head now wraps with price under the title.
- **platform-bookings:** `#booking .bk-top` stayed 2-column on phones (copy in a 117px column): forced to one column under 860.
- **platform-finance:** the reconciliation ledger's six cells per row stacked as six lines; now a compact 2-column card (date/amount, reference/status, source, person).
- **platform-staff:** the 7-column rota grid clipped Thursday/Friday/total with no cue; it now scrolls horizontally inside its card (edge of the next column peeks).
- **platform-comms, platform-safeguarding:** nav, text floor, taps only.

## Deliberately not changed
- Desktop anything; copy; the hero slider autoplay; the marquee; orbit animation on laptops/landscape iPads; the hover mega-menu on mouse devices.
- `viewport-fit=cover` was NOT added: it needs a markup edit in every page head (forbidden by the merge rules) and, without it, Safari already letterboxes around the notch in landscape. So `env(safe-area-inset-*)` rules are only used in the drawer header and currently resolve to 0.
- The pricing page's large plan prices render faint/small in WebKit on desktop too (looks like a count-up/reveal or gradient-text effect: `£29/mo` as a small grey pill). Identical before/after, so left alone: Kaz should check it in real Safari.

## Known remaining issues (honest list)
- Headless WebKit showed a white 130x95px block at the top-left of the home page at 320x568 in viewport screenshots (not in full-page captures, nothing at that point in the DOM). Could be a capture artefact; check on an iPhone SE-size device.
- Reduced-motion users and the hero slider: slider still auto-advances (page JS forces it).
- Very long product mock-ups (home calculator, finance hub) are tall on phones by design.
- The 12px floor in JS runs on `load`; if another script injects new mock text later it will not be raised until the next resize/breakpoint change.
- Lighthouse not measured.
- Pages with the most residual risk: **companies** (hero slider plus nested carousels), **platform-staff** (horizontal rota scroll), **home** (longest page, 20,900px on a phone).

## Fully clean vs. not
"Clean" here means: zero real detector hits on phone/tablet (besides documented invisible-hit-area dots and fake mock buttons) AND I looked at the screenshots and saw no broken layout.
- Clean by detectors and eye: parents, franchises, schools, pricing, tour, safeguarding, security, platform-bookings, platform-comms, platform-finance, platform-staff, platform-safeguarding, privacy, terms, dpa.
- Clean by detectors, but I have less eyes-on at odd sizes (only 390/820/1024 viewed closely; 320, 430 and 744 by detectors plus spot checks): activly, companies, freelancers.
- Not claimed: "fully mobile-friendly". That needs real devices.

## Screenshots
`docs/mobile/shots/before/*.jpg` and `docs/mobile/shots/after/*.jpg` (JPEG q50, full-page). Every page at 390; 820 for activly, pricing, companies, parents, platform-staff. About 16 MB. Full matrix PNGs are in the session scratchpad (not committed).

## Scripts (scripts/mobile-v2/)
`audit.mjs` + `run.sh` (matrix, detectors), `summ.mjs`, `merge.mjs`, `probe.mjs` (narrow columns/grids), `rects.mjs`, `shot.mjs`, `drawer.mjs` (burger behaviour test), `at.mjs`, `view.sh`/`contact.py` (contact sheets; needs PIL, run via `arch -x86_64 python3` here), `diff.py` (pixel A/B), `pack.py`. Static server: `python3 -m http.server 8123 --directory public`.

## Morning checklist for Kaz (real iPhone and iPad)
1. Home, Companies, Pricing, Parents in Safari on an iPhone: open the burger, expand Platform and Built for (tap twice), tap a link, tap outside, rotate. Watch for the page jumping when the address bar collapses.
2. iPad portrait: pricing (2 + 1 cards), companies hero, home hero mock-up.
3. iPad landscape (1180/1366): nav dropdowns open on tap and close on second tap; no stuck hover.
4. Rubber-banding with the drawer open (background scroll lock uses `overflow:hidden` on `<html>`; iOS sometimes still scrolls).
5. Companies hero slider: swipe left/right; autoplay does not fight the swipe.
6. Staff page: rota scrolls sideways smoothly inside its card.
7. iPhone SE size: header fits (logo + Provider sign up + burger).
8. Decide on the "Live - auto-updates" badge, and look at pricing prices in Safari (see above).
9. Merge note: the other agent adds `data-i18n` and a language selector to the same pages; conflicts should only be the one line before `</head>`. The language selector may need a slot in the drawer (not placed by me).
