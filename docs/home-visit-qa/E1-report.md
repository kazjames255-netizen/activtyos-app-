# QA E1: online sessions in "ActivityOS room" (Daily video) mode, 7 Oct 2026

**Stack:** my own isolated stack from `origin/main` `ff0425e7` (web :3011, API :4011, started with `next dev --webpack` because Turbopack rejects a symlinked `node_modules`), Stripe TEST keys, mail not live, throwaway accounts only (`hvqa-e1-*@activityos-test.com`). Real Daily rooms were created from the local `DAILY_API_KEY` (valid, status 200) and deleted (see the end). APF and real people were not touched. The two servers have been stopped.
**Script:** `e2e/review/e1-online.ts` (phases a to e). **Raw results:** `E1/results.json`. **Screenshots:** `E1/` (11).

## Result: 56 of 58 checks pass. The 2 "fails" are explained below (one is a real bug, FIXED; one was a faulty test of mine).

| # | Check | Result |
|---|---|---|
| 1a-b | Provider publishes an online listing with hosting = ActivityOS room; stored explicitly | PASS |
| 1c | A listing saved with NO hosting choice stores the choice explicitly | **FAIL, FIXED** (D1) |
| 1d-e | Own-link mode refused with no link / a non-https link | PASS |
| 1f | A live listing with only 2006 dates is accepted locally (server rule is production-only by design) | info |
| 2a-c | Card parent books a session starting in 12 minutes, pays with the Stripe test card 4242, booking Confirmed + Paid | PASS |
| 3a-d | Bank-transfer parent: unpaid, panel says pay to unlock, join refused (404, no token); provider "Mark paid" unlocks | PASS |
| 4a-e | Paid but early: real opening time shown, window opens exactly 10 min before start; early join 409; other family 404; signed out 401 | PASS |
| 5a | Provider cancels a booking | PASS |
| 6a | Parent list returns today + 3 later sessions | PASS |
| 7a-b | Inside the window, host not started: refused with `waiting_for_host`, panel says waiting | PASS |
| 8a-f | Host starts: real Daily room, owner token, room is PRIVATE with expiry and a participant cap (8); family joins the same room (not owner, first name only); bank family (marked paid) joins; unrelated family 404 | PASS |
| 9a-b | Attendance call accepted; child marked present on the provider's register (`by: online-session`) | PASS |
| 10 | Provider "today" list: booked 2, joined 1, live | PASS |
| 11a | Host extends +15 min | PASS |
| 12 | A CANCELLED booking cannot get a token (404) | PASS |
| 13 | Host ends: family cannot rejoin until the host returns (`waiting_for_host`); the Daily room is deleted on end | PASS |
| 14 | "Finished session drops from the list" | **my test was invalid** (I edited a stored time that the window logic doesn't read); replaced by 15 and 16 |
| 15-16 | A session that finished earlier today (06:00-07:00 UK) is NOT in the parent's list, and joining it is refused (`outside_join_window`) | PASS |
| UI-1..4 | Phone: "Your online sessions · 4" with a "1 of 4" counter, nearest (today) first, arrow shows the next day with "A Join button appears here at HH:MM" | PASS |
| UI-5..6 | After the host starts, a green **Join session** button appears (live refresh), and it opens the real video page with a Daily iframe | PASS |
| UI-7..8 | Same panel on the home page; no sideways scroll on a 390px phone | PASS |
| UI-9..10 | Provider dashboard "Online sessions today" card; provider session page opens the room | PASS |
| 17a-f | **No Daily key (simulated):** status says `videoReady:false`; host start gives a clean 503; family sees "waiting for host" (no dead end); provider page says "ActivityOS video rooms aren't switched on yet" with "Edit this listing"; the wizard shows the "not switched on" note | PASS |
| 18 | After fix D3: with the browser set to Dubai (+4) the panel shows UK clock times | PASS (after fix) |

## Defects found and fixed (commit in the worktree, not pushed)
- **D1 (low) hosting choice not stored when none given.** Saving an online listing without a hosting choice left `videoMode` empty (it only worked by accident of the join code). Now an online listing always stores `platform` when nothing was chosen (`videoModeDefault`, used on create and edit). Verified on the stack.
- **D2 (low-medium) wording.** Booking-confirmed / payment-received emails for an ONLINE session ended "See you there!". They now say "See you online!" (the How to join block was already there).
- **D3 (medium for anyone outside the UK) times in the wrong zone.** The online sessions panel formatted the start and "Join button appears at" times in the viewer's browser time zone while the booking, register and emails use UK time (Kaz's browser is in Dubai: the panel said 17:52 for a 14:52 session). Now always UK time. Verified with a Dubai browser.
- Tests: `tests/regression/online-e1-fixes.test.mts` (4). Manual (Online sessions row) and assistant knowledge updated. Full pure suite 856 pass, 0 fail.

## Observations (not changed)
- A host can start the room BEFORE the 10-minute window (200); families still cannot enter until the window opens. Looks intentional (host gets a head start).
- Bells for an online booking still end "See you there!" in the parent bell text (the bell has no online flag); emails are fixed.
- The provider's "session unavailable" page has a "Back to My bookings" button (parent wording).
- Browser media (camera/mic) was faked in headless Chrome: the video frame loads but real audio/video between two people was not exercised.

## Daily rooms and accounts
- Rooms created: `hub-6d70bfc1fc954a9d1e0d` (host start, twice). Deleted by "End session" (a later DELETE returned 404 = already gone). The only room left on the Daily account is `activly-stevejonescoaching-7fb87a`, not mine, left alone.
- Throwaway accounts (still in the database; `npm run e2e:cleanup` deletes ALL `@activityos-test.com` accounts, so Kaz should run it only when every QA run is finished): the four in `E1/state.json` (provider tenant `D6MlQDuP6dSPKxIFnZ10`).
