# Browser click-through script — steps no headless agent can run

## What this is

Plan 1 (`lib/testing/plan.ts`) and Plan 2 (`lib/testing/plan2.ts`) are the
acceptance-test plans tracked on the Testing page (HQ → Testing). Agents A–J
ran almost all of it headlessly (terminal `curl` calls, in-process API tests,
reading source). This document is the remainder: every step that a headless
agent explicitly marked `blocked` because it needs a real browser, a real
device, a real signed-in session, a specific viewport, RTL rendering, a
screen reader, or a second browser — plus every Plan 2 step whose `method`
field is literally `"browser"`.

**Who runs this:** a human, or a Claude-in-Chrome / computer-use session with
an actual browser.

**Before you start:**
```
npm run dev:all
```
Web is on `localhost:3000` (falls back to `:3001` if busy), API on `:4000`.
There is **no staging/production deployment** (backlog `b32`) — every step
below that says "the STAGING url" is being run against `localhost:3000`
instead as the closest available substitute; where that substitution changes
what the step can prove, it's noted inline.

**Record verdicts** the same way the agents did: open the step by id in HQ →
Testing (`localhost:3000/platform/testing`, or the operator/franchise/staff
Testing view) and log pass/fail/blocked there, or hand your notes back to
whoever asked you to run this.

## Accounts available (do not invent others)

Source: `docs/qa-test-plan.md` §1.4, `docs/qa-findings.md`, and the seed
scripts under `server/src/seed*.ts`. Passwords are **not** in the repo — the
tester already has them (password manager / prior session); this script
never guesses one.

| Email | Role / portal | Tenant | Portal home |
|---|---|---|---|
| `amircoaching@gmail.com` | Freelancer operator | `VOiiaTnDNd03MLbZaVcM` | `/freelancer/bookings` |
| `amirthedad@gmail.com` | Parent (same person, customer side of the tenant above) | — | `/custdash/browse` |
| `kazjames80@gmail.com` | Freelancer operator ("Kaz james freelancer" per `seedRegisterDemo.ts`) | `j2J95nc7F7xcLcrYkX1B` | `/freelancer/bookings` |
| `kazjames80@gmail.co.uk` | Company / head office ("SPORTS DIRECT COMPANY" per `seedCompanyDemo.ts`) | `x4goY84cslX4mBV4LNtG` | `/company/bookings` |
| `franchisetest@gmail.com` | Franchise (on the SPORTS DIRECT COMPANY tenant) | `x4goY84cslX4mBV4LNtG` | `/franchise/bookings` |

**Known discrepancy — check on sign-in, don't assume:** `docs/qa-findings.md`
line 58 labels `kazjames80@gmail.com` (`.com`) as the **Company** login,
while the seed-script comments (`seedRegisterDemo.ts`, `seedCompanyDemo.ts`)
say `.com` is the **freelancer** account and `.co.uk` is the **Company**
one. Sign in and read the portal you land in before trusting either table.

**Two-tenant work (Plan 1 "tenant A / tenant B", Plan 2 `$A`/`$B`):**
`amircoaching@gmail.com` (tenant `VOiiaTnDNd03MLbZaVcM`) and
`kazjames80@gmail.com` (tenant `j2J95nc7F7xcLcrYkX1B`) are two **separate,
unrelated freelancer tenants** — use this pair for every cross-tenant check
below instead of signing up a fresh throwaway account, unless a step
specifically needs a brand-new/empty account (noted per-step).

**Not documented anywhere in the repo — flag these steps `blocked: needs
account provisioning` rather than guessing:**
- A plain staff account (`$S`) on any tenant.
- A site-lead staff account (`$L`).
- A second franchise (`$F2`) alongside `franchisetest@gmail.com` (`$F1`).
- A parent account that belongs to tenant B (`kazjames80@gmail.com`'s
  tenant) — `amirthedad@gmail.com` is only tied to tenant A.
- The HQ/platform super-admin account (`$H`).

---

## 1. Desktop browser — real signed-in session, single window

General click-throughs needing nothing more exotic than a real browser and
a real account (no phone, no RTL, no second device).

1. **d1s1** — *Sign up on staging.* No staging exists, so run this at
   `localhost:3000/signup` instead: choose Freelancer, use an unused email.
   Expect: account created, no error banner, you land in `/freelancer/...`.
   Note in your verdict that the "over HTTPS on staging" half is untested —
   see §7.
2. **d1s7** — *Grab two tenant tokens.* Sign in as `amircoaching@gmail.com`.
   Open DevTools Console and run:
   ```js
   JSON.parse(Object.entries(localStorage).find(([k])=>k.startsWith('firebase:authUser'))[1]).stsTokenManager.accessToken
   ```
   Save as `$A`. Sign out, sign in as `kazjames80@gmail.com` (freelancer
   tenant), repeat, save as `$B`. Pass: you have two distinct, working
   bearer tokens.
3. **d5s6** — Open `localhost:3000/docs` and `localhost:3000/openapi.json`
   signed out. On localhost (dev mode) both will return 200 — that is
   *expected* here, not a pass/fail signal, because the gate only closes
   when `NODE_ENV=production`. Record the 200 as "unverifiable without
   staging" rather than a fail.
4. **d24s2** — *needs account provisioning* (no `$S` documented). If a staff
   account becomes available: sign in as staff, open DevTools Console, run
   the same token-grab one-liner as step 2, save as `$S`. Pass: a working
   token comes back.
5. **d25s7** — Sign in as `amircoaching@gmail.com` (tenant A). In a second
   tab/incognito window sign in as `kazjames80@gmail.com` (tenant B) and
   collect one real URL containing a tenant-B id (e.g. a booking or child
   detail page). Back in tenant A's tab, edit the URL bar to swap in that
   id. Pass: refused (redirected / not-found), not tenant B's data.
6. **d26s1** — *Lockout after repeated bad password.* Do **not** use
   `amircoaching@gmail.com` or any real account — create a fresh throwaway
   account at `/signup` first, sign out, then at `/login` enter the correct
   email with a wrong password 20 times in a row. Pass: you are slowed
   (increasing delay) or locked out with a clear message — not silently
   allowed to keep guessing.
7. **d26s2** — At `/login`, click "Forgot password", enter your email. Check
   the inbox: the reset link should arrive, open it once, set a new
   password, and then re-opening the *same* link a second time must be
   refused. Pass: link works once, second use refused.
8. **p2-m19** — As a parent, open Payments → the receipt for a booking that
   was paid part wallet, part card, and later part-refunded. Pass: the
   receipt itemises the card amount, the wallet portion, and the refund as
   separate lines, and the total matches what Stripe and the wallet ledger
   say (cross-check against Reconciliation as `$A`).
9. **p2-m32** — Sign in as `amircoaching@gmail.com`, open Subscription
   (`/freelancer/subscription`), add a card, then try to remove the only
   card on file while the subscription is active. **Caveat:** Stripe test
   keys are not configured on this stack per the last agent run — if the
   card UI itself won't load/save, log this as blocked on prereq q4 (Stripe
   keys), not as a UI failure.
9. **p2-s12** — Open a `/plan/<fileId>` link from a new-booking confirmation
   email (or any EHCP/SEND file link) in a **private/incognito window**
   while signed out. Expect: prompted to sign in, and the Network tab shows
   **no** file-byte request fired before auth. Then sign in as
   `kazjames80@gmail.com` (an unrelated tenant) and open the same link.
   Pass: refused.
10. **p2-p6** — Sign in as `franchisetest@gmail.com`, go to
    `/franchise/setup`, open the Features tab, switch Meals back on. Sign
    in as `kazjames80@gmail.co.uk` (head office), open the HQ/company
    feature-control matrix (`/company/setup` → Features, or
    `franchise-features` nav item). Pass: the matrix shows Meals on for
    that franchise — same underlying `settings.features` document.
11. **p2-f18** — Sign in as `kazjames80@gmail.co.uk` (head office). From the
    black HQ combined dashboard, drill into the franchise (blue theme),
    refresh the page, press the browser Back button, refresh again. Pass:
    scope survives refresh both times, Back returns to the combined HQ
    view, theme always matches which scope you're in.
12. **p2-h6** — Sign in as `kazjames80@gmail.co.uk` in **two separate
    browsers** (e.g. Chrome + Firefox, or two profiles). In browser 1, open
    Timeclock settings and set grace minutes to 15. In browser 2, open
    Payroll → Timesheets for a late clock-in. Pass condition is actually a
    **known fail**: expect different pay figures in each browser because
    the setting lives in `localStorage`, not the tenant — confirm and log
    it, don't try to "fix" it by refreshing.
13. **p2-h17** — Sign in as `kazjames80@gmail.co.uk`, go to Team →
    Onboarding, exempt "DBS" for the Volunteer role, then add an extra
    individual requirement to one specific person. Open "Cleared to start"
    for a Volunteer (should clear without DBS) and for the person with the
    extra requirement (should stay blocked until it's ticked).
14. **p2-l2 / p2-l3 / p2-l4** — *needs `$S` (staff) — needs account
    provisioning.* If available: Learning Centre as staff — fail a quiz (no
    certificate should issue), refresh mid-lesson (position lost — expected,
    it's per-device), switch a motion lesson to text mode, check
    captions sync with narration. Play the intro/mid videos on a couple of
    real courses and one course with no authored video (should show no
    empty player/error). p2-l4 additionally needs a phone: see §2.
15. **p2-l10** — Open `public/courses/safeguarding.html` directly in a
    browser tab (e.g. `localhost:3000/courses/safeguarding.html` if served,
    or open the file path from the repo). In DevTools set Network to
    Offline, then walk the lesson. Pass: zero network requests, no CDN
    fetches, narration text and animations still work.
16. **p2-l11** — As `kazjames80@gmail.co.uk` (HO), open Milestones, rename a
    phase in the HO template. Sign in as `franchisetest@gmail.com`, reload
    Franchise Milestones — pass: that franchise's progress is preserved
    through the rename. Then run the per-season reset from HO and confirm
    progress clears but the template itself doesn't.
17. **p2-c2** — Signed in as a parent of tenant A (`amirthedad@gmail.com`),
    open `/book/<listing id of tenant B>` (a listing belonging to
    `kazjames80@gmail.com`'s tenant). Pass: bookable, and afterwards
    tenant B's Families list gains this family while tenant A's data is
    untouched.
18. **p2-c4** — At checkout, try to add a second, different listing into
    the same basket. Pass: not supported (per code notes) but handled
    cleanly — a clear message, never a crash.
19. **p2-c9** — Signed in as a parent, visit `/store/<tenantId>` for one of
    the known "E2E Signup …" fixture tenants (search the public provider
    directory for one) and try Follow. Expect refused/absent. Then visit
    `/store/VOiiaTnDNd03MLbZaVcM` and Follow — read the text next to the
    button: it must state that following opts you into marketing
    (`marketingOptIn:true`).
20. **p2-c15** — Parent portal → My children → try "Add a second carer".
    Expected (per 13 Sept notes): unbuilt — record whatever the current UX
    is (absent control, or a refused/"coming soon" message). No crash is
    the only hard requirement.
21. **p2-c18** — Sign up a **brand-new** parent account at `/signup`, book
    nothing, open every item in the `custdash` sidebar. Pass: no crash, no
    leftover demo data, each empty screen has a clear call-to-action to
    browse listings.
22. **p2-q2 / p2-q5 / p2-q13 / p2-q15 / p2-q16** — *needs `$H` (HQ/platform
    account) — needs account provisioning.* If available: HQ → Leads
    (time first paint <3s, apply 3 filters, sort by region, export CSV —
    cells must be formula-safe, open a lead sheet); HQ → Sales pipeline
    (drag a lead's stage, confirm `PipelineSummaryCard` totals recompute,
    find a lead with no plan set and confirm it still renders — this is
    the direct regression check for the old `d28s2` bug); HQ → Testing
    (switch to Plan 2, log a verdict, reload to confirm it persisted,
    export and confirm `p2-` ids are in the file); HQ → Data & privacy
    (find the parent SAR deletion request from `p2-c13`, mark it handled,
    confirm the parent is notified); HQ → Email (send to all providers
    with one suppressed address — confirm it's excluded and the
    unsubscribe link is signed).
23. **p2-b4** — *needs `$A` or any operator account.* For each entry in
    `features/common/tourConfigs.ts` (33 pages), open "How it works" /
    the guided tour, click through to the very last step, watching the
    Network tab of the `/tour` iframe throughout. Pass per tour: no
    console errors, and **zero** live `/api/*` calls carrying a real
    bearer token (fixture data only).
24. **p2-b5** — Immediately after closing any tour from step 23, reload the
    real (non-tour) page and inspect `localStorage`. Pass: you see live
    data, not tour fixtures, and no leftover demo-mode keys —
    `enableDemoMode` should only ever have been called inside the `/tour`
    document.
25. **p2-b6** — On an operator account: go to Bookings, apply a filter,
    open a booking, press Back — filter and scroll position should be
    kept. Refresh on a URL like `/company/bookings?ref=X` — that booking
    should reopen. Open `/company/setup?tab=roles` — the Roles tab should
    be selected. Open `/company/setup?tab=nonsense` — should fall back to
    the first tab, not blank/error.
26. **p2-b7** — Half-fill a new listing in the wizard on this laptop, then
    open the same listing wizard from a phone or second browser profile.
    Expected (per code notes): the draft does **not** carry over — it's
    per-device `localStorage`. Confirm and log it.
27. **p2-b8** — Open the same listing's edit page in two browser tabs with
    autosave on. In tab 1 change the price, in tab 2 change the capacity,
    save both. Record the outcome precisely: does the second save silently
    overwrite the first field (fail), or is there a conflict prompt (pass)?
28. **p2-b11** — On an operator dashboard, collapse two different stat
    cards, note which sidebar item has the little indicator/notch, reload
    the page. Pass: both cards stay collapsed individually, the notch is
    still on the same item.
29. **p2-b13** — Open Print Preview (Cmd/Ctrl+P) on: a payslip, an invoice,
    an incident PDF, and a certificate. Pass on each: no sidebar/nav
    bleeding into the printout, nothing cut off, sensible page breaks.
30. **p2-r10** — On a **brand-new** tenant (fresh Freelancer signup) and a
    **brand-new** parent account, open: Payroll, Leave & absence, Clock
    in/out, Appraisals, Documents, Learning Centre, Milestones, Inventory,
    Task manager, and (HQ) Leads, Support, Reconciliation, Wallet,
    Memberships. Pass on each: no crash, no leftover demo/fixture names
    (the old "Marcus Bell" cast), a clear call-to-action instead of a
    blank table.

## 2. Mobile viewport — real phone or DevTools device emulation

Where a real phone isn't available, use Chrome DevTools → Toggle device
toolbar → iPhone 12 (390×844) for iOS-shaped checks, or a Pixel/Galaxy
preset for Android-shaped ones — note in your verdict which you used, since
several of these steps specifically call for a *real* phone (camera upload,
flight mode, a second physical device).

1. **d5s1** — On a phone (or 375–390px emulation), visit `/store/` and
   browse/filter the public listing directory signed out. Pass: readable,
   no horizontal scroll, filters work with touch.
2. **d24s9** — *needs `$S` — needs account provisioning.* If available: on
   a real phone, sign in as staff, clock in, take a register for your own
   session, log an incident, clock out. Pass: all four are comfortable
   one-handed, no cramped tap targets.
3. **p2-l4** — On a phone, scan a printed certificate's QR (or manually
   open the `/v/<ref>` URL it encodes, from Learning Centre → issue a
   certificate → print). Current expectation is **404** — the verification
   page is unbuilt (backlog item 38). Confirm the 404 and log it as owed,
   don't chase a fix.
4. **p2-c1** — On a phone, signed out, open `/store/VOiiaTnDNd03MLbZaVcM`.
   Confirm every live listing is bookable, nothing archived shows, and the
   page never scrolls sideways. Then, once `kazjames80@gmail.com` (or
   whichever account owns a second tenant) has closed their account,
   confirm that tenant's `/store/<id>` page still loads (regression `r5`).
5. **p2-i9** — On a phone at 375px, switch language to Welsh (see §3 for
   how) and check the sidebar and primary buttons for clipped/overflowing
   text (Welsh strings run long).
6. **p2-b1** — On a real iPhone (iOS Safari), signed in as an operator:
   Registers, Bookings list, the full Listing wizard (every step), the
   Schedule grid, Finance charts, every Setup tab, Team & invites, Payroll.
   Pass on each: body never scrolls sideways, the primary action button is
   reachable without pinch-zoom, any table scrolls inside its own
   container rather than pushing the page wide.
7. **p2-b2** — *needs `$S`.* On Android Chrome, staff portal: Clock,
   Register, "Report a concern", Payslips, Appraisals, and Onboarding —
   specifically try uploading a document from the camera on Onboarding.
   Pass: all completable one-handed; camera upload actually works.
8. **p2-b3** — *needs `$H`.* On a phone, HQ portal: open the Leads filter
   drawer, drag a card on the Sales board using touch, reply in the
   Support inbox. Pass: usable throughout; if drag doesn't work by touch
   there must be a non-drag fallback (e.g. a status dropdown).
9. **p2-b12** — On a phone, open a register, then switch the phone to
   flight mode and reload. Expected: offline mode is unbuilt — record
   exactly what shows (a clear "you're offline" message is the acceptable
   outcome; a blank white page is not).
10. **p2-h2** *(from §3 list, mobile half)* — n/a, no mobile component;
    listed here only if you also want to sanity-check Clock in/out on a
    phone while doing the Romanian pass in §3 (`p2-i2`).

## 3. RTL and other-language rendering

Use the language picker — the flag/globe button in the top bar of every
portal (near the account menu). Click it, pick a language from the list.
The Arabic and Urdu picks are the RTL cases; the rest are LTR
translation-completeness checks. Do these signed in as whichever account
fits the portal in question — `amircoaching@gmail.com` for operator views,
`amirthedad@gmail.com` for parent/custdash views.

1. **d20s12** — Parent portal, switch to Arabic (عربية). Check the sidebar,
   buttons, date pickers and any open form for anything overlapping or
   running off-screen now that the layout has mirrored.
2. **p2-c14** — Sign in as a parent, switch to Urdu, open
   `/custdash/timetable` where the tenant has one published and one draft
   timetable. Pass: only the published one appears; RTL layout is intact
   (no broken mirroring).
3. **p2-i1** — Operator portal, switch to Polish (Polski). Open Dashboard,
   Families, Meals, Registers, Schedule, Setup, Money — these are the
   translated areas per the code grep, so expect no English on primary
   labels. Then open Bookings, Listings, Incidents, Medication, Task
   manager, Payroll, Documents, Learning Centre — these are **not** yet
   translated; write down the rough % of each screen still in English.
   That list of untranslated pages is the actual deliverable of this step.
4. **p2-i2** — Staff portal, switch to Romanian (Română). Open My
   schedule, Clock, Register, and "Report a concern". The concern form is
   the one that matters most — confirm the safeguarding categories and
   protocol text are actually translated, not just the page chrome.
5. **p2-i3** — Operator portal, switch to Arabic. Check: the sidebar
   mirrors, a data table mirrors, a date picker mirrors, the register's
   in/out buttons swap order correctly, and a Finance chart — the chart's
   own axis should stay left-to-right even though everything around it
   flips.
6. **p2-i4** — Signed out, open `/store/<tenantId>` and `/book/<id>` with
   the language selector set to Welsh (Cymraeg). Pass: the public pages
   follow the selector (Welsh has a bilingual legal duty); if they stay in
   English regardless, record that as a gap, not a crash.
7. **p2-i5** — In any portal, cycle through all 11 available locales and
   read a price, a date and a time on the Bookings list each time. Pass:
   money always renders as `£1,234.56` (never the European
   `1.234,56` form), dates are `DD/MM/YYYY` or a consistent localised
   equivalent, times are 24-hour.
8. **p2-i7** — At checkout with items in the basket, change the language.
   Reload the page. Then open the same checkout URL in a fresh private
   window. Pass: basket contents survive the language change and the
   reload; the private window's default language is either the browser's
   language or English — record which.
9. **p2-i8** — Bookings list in Polish, find rows reading "1 child",
   "2 children", "5 children" (or the Polish equivalents). Polish plurals
   differ for counts of 2 vs 5 — confirm these are genuinely different
   strings, not one template with a number substituted in.
10. **p2-i11** — Parent portal → Medication → Authorise a medication, walk
    to the consent tick, in each of: Arabic, Bengali, Welsh, Spanish,
    French, Portuguese, Romanian, English. Pass: the legal meaning of the
    consent sentence is the same in every language, and none of them
    silently falls back to English on the tick text itself.
11. **p2-i12** — Parent portal in Arabic, open a PDF receipt and an
    incident PDF. Record which language the PDF actually renders in, and
    confirm Arabic text renders as real glyphs (not boxes/tofu) if it is
    in Arabic.
12. **p2-b1 (Welsh sub-check)** — while doing the mobile pass in §2,
    also flip to Welsh at 375px specifically for `p2-i9` above.

## 4. Keyboard-only navigation (no mouse)

1. **d27s7** — Unplug/ignore the mouse and trackpad. Using only Tab,
   Shift+Tab, Enter and arrow keys: complete a full booking as a parent at
   `/book/<some listing>`, then take a register as staff (or as operator if
   no staff account exists) at `/company/registers` or
   `/freelancer/registers`. Pass: every control is reachable and operable
   this way — flag any `div`/`onClick`-only control that Tab skips over,
   and any modal that traps or loses focus.

## 5. Screen reader and automated accessibility scans

`p2-b9`/`p2-b10` use axe DevTools (a Chrome extension performing an
automated scan), which is a different tool from VoiceOver but answers the
same "is this accessible" question, so they're grouped here.

1. **d27s8** — On macOS, turn on VoiceOver (Cmd+F5). Navigate to the
   booking page (`/book/<listing>`) and a register
   (`/company/registers`). Pass: buttons and fields are announced
   meaningfully (not "button", "button", "unlabeled").
2. **p2-b9** — Install/open axe DevTools. Run it on: Payroll, Leave &
   absence ("Holiday planner"), HQ Leads, Learning Centre, Documents. Then
   tab through each form by keyboard. Pass: 0 critical axe issues per
   page, focus is always visibly indicated, every input has an associated
   label.
3. **p2-b10** — Run axe DevTools on the HQ combined (black-theme)
   dashboard and its Finance charts. Pass: text and chart labels meet
   WCAG AA contrast against the black surface.

## 6. Cross-browser matrix

1. **d27s9** — Repeat one full booking (parent side) and one full register
   (staff/operator side) in each of: Safari, Firefox, Edge, and on an
   older Android phone's Chrome. Pass: all four complete the flow without
   errors — the rest of this whole test run has been done in one browser,
   so this is the only place browser-specific bugs would surface.
2. **p2-b14** — On Safari iOS 16, Chrome Android, and Firefox desktop:
   clock in/out, submit a leave request, and play a course video. Pass:
   all three actions work in all three browsers.

---

## 7. Not fixable by browser testing either

These are blocked on something no amount of clicking in a browser can
supply — a deployed staging/production environment, live Stripe keys, a
loaded "volume" tenant, or Amir's own backend/infra work. Don't spend time
trying to force these; log them as still open with the owner noted.

- **d1s1** (partial) — "created over HTTPS on staging" is unverifiable
  without prereq p1 (a real staging deployment, backlog `b32`). Localhost
  substitution covers the signup-flow half only.
- **d5s6** — Confirming `/docs` and `/openapi.json` are gated in
  production mode needs an actual production-mode deployment; `NODE_ENV`
  is always `development` on localhost.
- **d6s4** — "Booking stays Paid after closing the tab immediately" needs
  Stripe test keys (prereq p3) *and* the code fix for a missing
  `payment_intent.succeeded` webhook handler (confirmed absent in
  `server/src/routes/stripeWebhook.ts` — this is a real gap, not a config
  issue). No browser session can produce a pass here today.
- **d18s1 / d18s2 / d18s3** — Dashboard/list load-time and concurrent-user
  checks need the realistic "volume tenant" (prereq p4, ~1,500 bookings)
  that Amir hasn't loaded yet — the whole database currently holds 343
  bookings total. Re-run once that data exists.
- **d27s4** — Restoring the database to "yesterday" on staging needs both
  a staging environment and Amir to run the restore; there's no backup/PITR
  section in `DEPLOY.md` at all yet.
- **d28s5** — The go-live checklist (live Stripe keys,
  `STRIPE_PLATFORM_FALLBACK` off, Connect KYC, webhook endpoint
  registered, mail domain verified, backups on, monitoring on) is a
  conversation with Amir against production config — there is no
  production config to inspect locally.
- **d28s7** — Testing a real declined card and a real 3DS challenge needs
  live Stripe (not test mode) — genuinely cannot be simulated in a browser
  against this dev stack. (Test-mode cards `4000 0000 0000 0002` and
  `4000 0027 6000 3184` can rehearse the *UI* once staging exists, but
  that's a different, lesser check than this step asks for.)
- **p2-m32** (partial) — If Stripe test keys are still unset when you
  reach §1 step 8, this one folds into "not fixable" too until prereq q4
  lands.
