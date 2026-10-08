# Chrome QA fixes - 8 Oct 2026

Branch: worktree-agent-a2d96e36ec8b23a5d (local only, nothing pushed).

## Fixed

1. **Wizard letters lost when typing (dbb1a724).** Real. Autosave finished and then put back an old copy of the form, wiping what you had typed during the save (typed "testing", saw "esting"). It now only takes the new id/status from the save and keeps your typing. Test: tests/regression/wizard-save-merge.test.mts.
2. **Free-trial card pop-up cut off on short windows (e867496a).** The pop-up now scrolls and fits the window height (also the "Update card" pop-up).
3. **Raw Stripe developer error (84f54b35).** Providers now see: "We couldn't reach Stripe to set up your payments just now. Nothing has been charged and your details are safe. Please try again shortly..." in all 11 languages. Also applied to the invoice payment route. The real error is still logged on the server.
4. **Cancellation wording (81fb4ac9).** Wizard step now says Setup & features -> Cancellations & refunds (all 11 languages). Parent-facing policy starts with a capital letter. "48 hours" / "24 hours" now read as hours in the parent wording (they said "2 days" / "1 day" while Setup said 48 hours). Test: tests/regression/policy-wording.test.mts.
5. **"Set up payments" opened the wrong tab (d28207c9).** The page now reads ?tab=paid after loading (and on back/forward). Checked in the browser: opens "Get paid by parents".
6. **Setup progress bar did not update after creating blocks (489950d9).** It was not listening for block changes at all (blocks live in "blockBundles"), and a change arriving mid-refresh was dropped. Both fixed.
7. **"Not yet" on the go-live pop-up (41ef7e3c).** Now says the listing is saved as a draft and not live, and what to do (start trial, choose how parents pay, press Publish again). It also saves the draft.
9. **Minor (871b2b02).** One-day listing shows one date; the yellow multi-day-pass banner only shows if a multi-day pass actually fits; "Save pricing" shows a green "Pricing saved".

## Not reproduced / needs your decision

- **Issue 1, "Maximum update depth exceeded" (steps 5+): NOT reproduced.** I walked every wizard step (with a venue, dates and a block chosen, typing at human speed) on a fresh account and got no loop. I found no render loop in the code. The letter-loss bug above is real and fixed. If it shows again, send me the browser console stack from step 5 (which component name appears) and what was filled in before it. Script to re-test: e2e/review/chrome-fixes-wizard.mjs.
- **Issue 3, does Stripe Connect really break? YES, with the current test key.** Creating the connected account fails with Stripe's "no longer recommends Accounts v1" error (I called the API directly and got it). So providers cannot connect Stripe on this key until you either (a) switch on "Accounts v1 support" in the Stripe Dashboard (Settings, Developers, API policies; Stripe's message links to it), or (b) we move the code to Stripe's new Accounts v2 (a bigger change). I did not touch any Stripe settings. Decision needed before go-live of card payments.
- **Issue 8, personal name on parent page: not a bug in the code.** Signup sends the business name as the display name when "My business name" is picked, and the parent page uses that display name first. The personal name only shows if the Display name in Setup was changed or the account was created another way. No change made.
- Free-trial pop-up fix was checked by code only (the throwaway account is unwalled, so the trial button does not show).
