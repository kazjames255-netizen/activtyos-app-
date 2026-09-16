# Amir — backend to-do, meeting brief (15 Sept 2026)

Full detail for every item: `docs/amir-backend-outstanding.md` (verified against the code 12 Sept 2026). This is the short version to work from in the room. Last commit from Amir was 9 Aug — over 5 weeks ago — so treat all of §0 as "hasn't been started."

---

## Do these first — everything else is stuck behind them

1. **Move Firestore to the Blaze plan.** Free-tier daily read cap is already being hit *in a single day* — it's blanking registers/bookings live. Add backoff so schedulers stop hammering reads while quota's blown.
2. **Enable Firebase Storage + a real upload endpoint.** Right now images/PDFs are stuffed into Firestore docs (900KB cap), and **video upload is flatly impossible**. Blocks: certificates, LMS video, injury photos, moments, docs.
3. **Stripe: test AND live keys, plus the missing webhooks.** No `payment_intent.succeeded` handler exists at all — a booking paid with the tab closed never settles. No Connect webhook either. This is the single biggest reason test steps keep coming back "blocked."
4. **Deploy something.** Zero staging, zero production. `DEPLOY.md` is ready (Railway/Vercel/secrets/Firebase authorized domain/Stripe webhook/DNS) — it just needs him to actually run it. This is also why "over HTTPS," load-time, and volume-tenant tests can't run.
5. **Load a volume tenant** — ~1,500 bookings / 2 years of payments. DB currently has 343 bookings total across everything, so performance/scale can't be tested at all.

---

## Money & payments
- Customer memberships: no recurring Stripe charge wired (benefits deliver on join with **no money collected** — real risk if this is live anywhere)
- TFC/HMRC EPP reconciliation — not started, tab deliberately blank
- `cardFailed` banner has no trigger (needs the Stripe webhook)
- Split payments (card + voucher on one booking) — not built
- Add-on refunds miscalculate (add-ons aren't structured per-day yet)
- Rota labour cost never reaches Money/Dashboard/Payroll — still display-only

## Notifications & schedulers (biggest theme — most flows send nothing)
- Timetable publish → parent notify: silently does nothing
- Meal-order approve/decline → parent never told (provider side is done)
- Caterer digest cron doesn't exist — kitchen gets told nothing
- Shift reminders, publish-notify, auto-availability-request — none of the 4 scheduling keys are read server-side
- Learning Centre: overdue/renewal-due chasing + manager digest not built
- 1:1 messages and family broadcasts don't fill in merge tokens properly

## Staff, RBAC & identity
- Server-side capability enforcement per area (`role_id`, resolved caps) — not done, this is a real permissions gap
- No `staff_assignments` collection — franchise staff scoping and location assignment can't work without it
- My certificates / My payslips / My learning still hardcoded to "Marcus Bell"

## Big unbuilt collections (all front-end complete, waiting on him)
- **Learning Centre (LMS)** — courses, quizzes, completions, certificate store, public `/v/<ref>` verification page
- **Payroll** — RTI, P60/P45, real tax codes, QuickBooks/Xero/Sage posting, real payslips — currently must never touch real bank/NI data
- **Holiday & absence** — year-end carryover, gov.uk bank holidays feed, SSP from sickness

## Smaller / quick-ish items
- Booking postcode not captured at checkout (already captured at signup — just needs threading through)
- Listing auto-expire scheduled job
- Newsletter: real file attachments, click tracking (open tracking already done)
- HQ churn % drifts — needs an append-only `subscriptionEvents` collection instead of reading live subscription state

---

## One-line ask for tomorrow
**Priority order: Blaze plan → Storage → Stripe webhooks → deploy to staging.** Everything above the line is a config/infra afternoon, not new code, and unblocks the largest chunk of QA that's currently stuck.
