# Session log, Tuesday 6 October 2026

Written so nothing is lost if the terminal closes. Product name is still "Name TBC". Everything below is pushed to `main` unless it says otherwise.
Live site: Vercel (web) and Railway (API) both deploy from `main` (GitHub Actions). Deploys are watched at
https://github.com/kazjames255-netizen/activtyos-app-/actions

## Real phone and card tests (provider: APF Activity Camps, parent: kazjames80@gmail.com)

All on the October half term listing. Booking refs and results (all checked with `server/tools/assure/pilot-check.ts`):

| Ref | What | Result |
| --- | --- | --- |
| APF-10312 | Card booking, Mon 26 Oct, £0.30. First attempt blocked by Stripe's own protection (not our bug), second paid. Parent moved date 28 Oct to 26 Oct (setting "Let parents move their own dates" is ON by default). Later cancelled by provider and refunded to card. | pass |
| APF-10313 | iPhone card booking, then parent cancel, provider approve, Stripe refund £0.30. | pass: 12 pass, 0 fail |
| APF-10314 | Bank transfer booking, Mark paid, "Payment received" email, then parent cancel with bank details, provider Reveal, refund recorded. | pass |
| APF-10315 to 10318 | Jack's waiting-list entries made and cancelled while testing screens. | cancelled, nothing owed |
| APF-10319 | Waiting list, provider pressed Offer place, email "A place is yours if you want it", parent accepted and paid £0.30. | pass: 10 pass, 0 fail |

Not yet run: the **automatic** offer test (switch the waiting list to automatic, free a place, check the offer goes out with no button), a second child on one booking, home visit and online bookings, the 10 to 20 booking pilot, and the HMRC end to end sandbox test.

Stripe: APF live account is `acct_1UNGYjFOxwOtOU0V`. Both £0.30 payments landed there. Dashboard shows "Verify your email address" for APF's owner: do it. Apple Pay domain check still to do (gear icon, Payment methods).

## Built or changed today

**Booking and payment flow**
- Signed-out visitors on a shared booking link (WhatsApp) get a Sign in / Create account popup.
- Card declined: checkout says nothing was charged, try again or another card.
- Cancelled, never-paid bookings say "Cancelled - nothing owed", not "Unpaid".
- Bank transfer: provider email and bell say "awaiting bank transfer payment" with a Pending payment box; big green Mark paid on the booking card and inside it; sub-filter chips (Bank transfer, Card, Cash, vouchers) under Unpaid/invoiced and Unreconciled; appears in Reconciliation.
- Cancel screen (parent): refund choice says "Back to my bank account" for bank-paid bookings, and the parent types name, sort code and account number. Those details are kept in a separate `refundBanks` record (never on the booking, never in an email), the provider presses Reveal bank details once (30 second countdown, deleted on reveal), deleted on approve or decline, and a daily sweep purges anything unread after 30 days.
- Provider cancel panel: a booking nothing was paid on shows "nothing to refund", no refund buttons.
- Provider cancellation notice: short wording, only the parent's own reason.
- Cancel and refund timestamps now in UK time.
- Reply-To on all parent emails is the provider's contact email (APF: support@apfactivitycamps.com). The visible sender address is still `no-reply@activityos.uk` until the rename.
- Top bar has a Listings tab.

**Waiting list**
- Joining says "Nothing to pay now, offered at £0.30 if a place opens", never "free / £0.00".
- Parent home page shows an amber "1 on the waiting list" card that opens that waiting-list place on its own.
- Provider booking page shows a big box at the top: green "A PLACE IS FREE... press Offer place" or amber "NO free place yet... nothing to do now".
- Waiting-list settings moved to the **Capacity step** (step 3) of the listing builder, separate from "Do you approve each booking?" on the last step. One Yes/No: automatic offer (the new-listing default) or "you choose". A Yes/No under it turns the free-place alert on or off for ALL listings, with a warning.
- Manual waiting list: provider gets a bell and email when a place frees up and a family is waiting (`waitlist.ts` `triggerWaitlist`), linking to that booking. Setting `waitlistFreeAlert`, default on.
- Email to the provider on every join is now OFF by default (`waitlistJoinAlert`, bell still shows). One "You now have a waiting list" email per listing the first time anyone joins (`waitlistStartAlert`, default on).
- A family that misses an offered place (2 hour hold runs out) is told "Sorry, you missed out, you are back on the waiting list" (email and bell), put back at the back of the queue, nothing charged.
- Provider and parent emails fixed: "ActivityOS" header replaced by the brand name; the offer email shows UK time.

**Reminders:** a multi-day booking now gets one session reminder, not one per day (regression test `tests/regression/session-reminder-once.test.mts`). The user also reported endless event reminders but has not yet sent a sample subject line.

**Manual and AI assistant:** both updated for the above (`features/platform/ManualApp.tsx`, `server/src/lib/setupKnowledge.ts`, `server/src/routes/ai.ts`). The 8 new assistant eval questions in `server/tools/zz_assist_eval.ts` have NOT been run (needs the Groq key).

**CI:** `assure` workflow now generates Next route types before type checking, so the failure emails should stop.

## HMRC Tax-Free Childcare (sandbox)
- HMRC enabled the Tax-Free Childcare Payments API v1.2 for the application "Activityos" (sandbox). Client ID `knqOahLXzg2SW4FyM2MZsb896Xes` (public). Redirect URIs saved on the Developer Hub: `http://localhost:4000/api/tfc/callback` and `https://activtyos-app-production.up.railway.app/api/tfc/callback`.
- Locally: client ID and secret are in `server/.env` (secret never shared in chat), HMRC accepted them (token request returned 200). The local API was restarted.
- Live (Railway): NOT set. The developer (Amir) must add `HMRC_TFC_CLIENT_ID`, `HMRC_TFC_CLIENT_SECRET` (sent separately by Kaz, never in chat or git), `HMRC_TFC_BASE_URL=https://test-api.service.hmrc.gov.uk`, `HMRC_TFC_REDIRECT_URI` (railway address above), `API_URL`, `HMRC_TFC_EPP_UNIQUE_CUSTOMER_ID` (any 11 digits starting 1 in sandbox), `HMRC_TFC_EPP_REG_REFERENCE`, `HMRC_TFC_TOKEN_KEY` (`openssl rand -base64 32`). Then redeploy and run the sandbox journey.
- Later: production credentials need sandbox testing, a Developer Hub application, HMRC paperwork, and NS&I External Payment Provider approval.
- The HMRC Developer Hub password was pasted into chat once: change it.

## Open decisions and to-dos
- Home page redesign: Kaz picked **mockup 3, "Week strip"** (PDF on the Desktop: `Parent-home-10-mockups.pdf`; the canvas is https://claude.ai/artifact/LduZcSZNHUvBF4w4jFeKxE). Not built yet.
- Scheduled routine "Refresh manual and assistant" created at https://claude.ai/code/routines (runs 08:00, 12:00, 17:00 UTC; opens a pull request when something relevant changed). "Run now" not pressed yet. Clocks go back 25 Oct: adjust to keep 9am, 1pm, 6pm UK.
- Kaz's own data to fix: venue name "Lloughton Manor First School ›" (extra L and a stray ›), bank name "barclays" lowercase.
- Sender domain: `no-reply@activityos.uk` until the rename. `MAIL_PER_TENANT_FROM=1` on Railway only changes the part before the @.
- Existing listings keep their saved waiting-list mode. October half term is still saved as manual until Kaz switches it.
- Cleanup: roughly 75 throwaway `@activityos-test.com` accounts plus today's test bookings need deleting by Kaz or Amir (this assistant cannot delete accounts).
- Coverage grid HTML, 500 seed clean fuzz run, assistant accuracy score and the remaining tracker items from `.unlazy/bookings-assurance/GATES.md` are still open.

## Where else this is recorded
- `.unlazy/bookings-assurance/PHONE-LOG.md`: timestamped log of each real test.
- `server/tools/assure/grid-data.ts`: the combination grid (waiting list and bank transfer rows included).
- `lib/testTracker/catalogue.ts` and `docs/test-tracker/catalogue-notes.md`: 345 hand checks.
- `tests/regression/`: permanent tests that run on every push.
- Git history: https://github.com/kazjames255-netizen/activtyos-app-/commits/main
