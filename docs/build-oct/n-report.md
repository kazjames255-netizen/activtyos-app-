# Agent N report: remaining backend send flows

Test: `cd server && node_modules/.bin/tsx src/nSendsTest.mts` (live dev Firestore, throwaway tenant, @activityos-test.com addresses so the mailer never delivers; cleans up). 17 checks, ALL PASSED. `npm --prefix server run typecheck` and `npx tsc --noEmit` clean. No Playwright spec added (API-level tsx test chosen; no dev server needed).

New code: `server/src/lib/octSends.ts` (all logic). Hooks (single small edits): `routes/timetables.ts`, `routes/mealsShop.ts`, `routes/availability.ts`, `routes/rota.ts`, `lib/sweeps.ts` (one dynamic import in startSweeps).

| # | Item | Status |
|---|------|--------|
| 9 | cardFailed from payment_failed | ALREADY BUILT (`markCardFailed` in lib/settlePayment.ts, called from stripeWebhook; cleared on settle). Doc line is stale. |
| 29 | Merge fields, remaining paths | ALREADY BUILT (lib/mergeFields.ts used by routes/messages.ts for 1:1, from-booking, broadcast). Doc stale. |
| 43 | Listing auto-expire | ALREADY BUILT (`listingAutoExpire` sweep, hourly; existing `src/listingAutoExpireTest.mts`). |
| 22 | Timetable publish -> parents | BUILT. On publish to parents with notifyEmail/notifyPush: bell to the audience (booked = live bookings on the timetable's listing with a day in range; everyone = customers). Franchise timetable reaches only its own families. Email obeys family mute (category calendar) and emailSuppressions (unsubscribed get bell only). Cap 500. |
| 23 | Meal-order parent half | BUILT. Approve/decline of a change or removal request bells + emails the parent (category booking, honours mute). |
| 24 | Caterer digest cron | BUILT. Sweep `caterer-digest` (10 min). Daily = tomorrow's non-cancelled orders; weekly = Mondays, 7 days from today; sent after `catererAt` (default 08:00 UK), once per listing per day, skipped when no orders. Includes allergy flags. |
| 25 | Schedule sends | BUILT: availability-request EMAIL (sendEmail on create); notifyOnPublish (rota save diff: shift locked false->true -> one bell/email per staff member, mode email/push/off respected); shiftReminder 24h/2h (sweep, published shifts); autoRemindUnconfirmed 24h/48h (chases pending availability requests). SKIPPED: autoRequestAvailability (needs a product decision on which week/who; nothing else reads it). Note "push" = in-app bell; there is no mobile push. |
| 26 | Learning reminders | BUILT. Sweep (6h): due in 3 days, due today, overdue (Mondays), renewal due (30 days before, Mondays) per assignment/staff, plus Monday manager digest bell (key `learning-digest`). Honours Setup learning.trackTraining. SKIPPED: unread-policy chase (policy reads are not tracked server-side). Assignment `due` is free text ("30 Jun"); parser handles ISO and "D Mon [YYYY]", unparseable = no chase. Head-office assignments chase head-office staff only (locs ignored for franchise staff; franchise lists chase their own). |
| 16 | Setup money toggles | SKIPPED. Auto-refunds is irreversible money movement, and "credit note when no cash due"/dietary have no single small read point. Needs a product call. |

Configure: `MAIL_LIVE=1` (or MAIL_ALLOWLIST) for real delivery; otherwise everything is bell-only/suppressed. Sweeps start with the API (SCHEDULER_NAMESPACE keeps dev from claiming prod locks). Caterer needs `mealConfig.catererEmail/catererEvery/catererAt` on the listing (already in Setup UI). Optional Setup notification key `learning-digest` (off by setting false).
Not covered by an automated test: the route hooks themselves (publish, meal request, rota save) were typechecked but not exercised over HTTP; the helper functions they call are tested.
