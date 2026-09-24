# 13 - Verification report (browser, 24 Sep)

Environment: live dev stack (web :3000, API :4000), one agent, one Playwright worker. The standard `e2e/global.setup.ts` cannot run (platform sign-in needs an emailed 2FA code), and 2FA was NOT touched. Instead `playwright.review.config.ts` + `e2e/review/review.setup.ts` provision only throwaway `@activityos-test.com` freelancer, company, staff (invite) and parent accounts, make the tutor a live provider the parent follows, and write their own manifest to `e2e/review/.auth-suite` (via `E2E_AUTH_DIR`, a one-line override in `e2e/helpers/env.ts`). No platform account is created or signed in. All accounts were removed with `npm run e2e:cleanup` (14 auth users, 0 failures).

## Cleanup items (open-questions 8/11)
- HubHero child switcher: added a visually hidden `role="status" aria-live="polite"` announcing "Showing <child>" (parents with 2+ children).
- "Placement test" -> "Starting quiz" in `TakeAssessment.tsx` and `ResultView.tsx` (family-facing strings; tutor-only surfaces keep "placement test"). No spec asserted the old text.
- `ComingSoon` (kit.tsx) and its branch in `LearningHubApp.tsx` removed: every panel meta is `status: "live"`, so it was unreachable.
- Not done: the builder creator tab "A quiz or placement test" (a spec clicks it) and tutor-side "placement test" copy (WaiveCard, AssessmentBuilder etc.) left as tutor vocabulary.

## Spec results (final state; serial specs stop after the first failure, so each was re-run until clean)
| Spec | Result |
| --- | --- |
| learning-hub.spec.ts | PASS (after spec fix, below) |
| learning-hub-quizzes-ui.spec.ts | PASS (11/11) |
| learning-hub-home.spec.ts | PASS (3/3) |
| learning-hub-family-hat.spec.ts | PASS (after spec fixes) |
| learning-hub-g2-child-parent.spec.ts | PASS (after product fix + spec fix) |
| learning-hub-assign-lesson.spec.ts | PASS on a clean run; two tests are flaky on timing (see below) |
| learning-hub-inperson.spec.ts | PASS (8/8) |
| review/hub-shell-a11y-links.spec.ts | PASS (5/5) |
| review/builder-d-after.spec.ts | PASS 390 + 768 (after spec fix) |
| review/hub-screens.spec.ts | NOT RUN: it is the BEFORE sweep and writes to screenshots/before; running it would overwrite the baseline |
| review/hub-after-shots.spec.ts (new) | PASS 390/768/1440 |
Runs were split across several invocations because an early failure in a serial describe skips the rest; the last full pass of each file is the one counted. No single run had every file green at once.

## Real defects found and fixed
1. **Quizzes never showed "locked" behind a required starting quiz** (`server/src/routes/hub/assessments.ts`). The child overlay looked for a published diagnostic only in the type-filtered list, so `?type=quiz` never saw one. Not caused by the redesign (pre-existing), but it made `requireDiagnostic` invisible in the family Quizzes tab (server still refused the start). Fixed by passing the unfiltered visible list; commit `hub: fix a quiz list never showing 'locked'...`.

## Stale or environment test issues (specs updated, product unchanged)
- family-hat kid tabs: expected 6, strip has always carried Messages (7). Updated.
- g2 kid placement: the fixture title contained "placement", tripping the child-language assertion; renamed the fixture.
- assign-lesson (x2): a tenant with exactly one student now has them preselected in the homework form (redesign), so clicking toggled them off and hid the "whole year" shortcut. Specs now tick only if needed / untick first. Also the "no students" test opened the removed list icon; it now opens the reader (H-01).
- learning-hub.spec + family-hat deep link: a family's Lessons tab lists only lessons assigned via homework (server rule from before the redesign). Specs now assign the lesson via homework.
- builder-d-after: fixture homework is titled "Overdue reading", failing an "no overdue wording" check; title is stripped first.
- Env: the review setup had to make the tutor a live, followed provider (other specs did that implicitly in the full suite).
- Flaky, pre-existing timing: assign-lesson "plain lesson for a group" can fail when the family's assigned-lesson set is cached for 30 s (`TTL_ROSTER`) before the new homework; "Live lessons workspace wording" failed once in a batch and passed alone; "topic with subtopics can't be deleted" banner failed once and passed twice.

## Screenshots (`docs/teaching-hub-review/screenshots/after/`, 390/768/1440)
Note: `fullPage` captures only the viewport because the hub scrolls an inner container; long pages are cut at the fold.
- tutor/home: hero with the three counts, stat tiles, tab strip (scrolls sideways at 390), "Next lesson" card with countdown, "Needs your attention" (homework to mark 2, overdue 3) and quick-create tiles (P-06/P-12/P-02). Readable at all sizes.
- tutor/lessons: one-line curriculum summary first (P-09), then search/year filter and lesson card; at 390 the summary text is cut with an ellipsis ("1 thin ...").
- tutor/tools: search, subject chips with counts (102 live tools), key-stage chips, tool list (P-08). Fine at 390.
- parent/home: subject/lesson tiles, child switcher pills, hand-over bar, one verdict card ("1 homework task overdue"), then the hello card and next lesson.
- kid/home (P-03): one big "Your homework is ready / Go" card plus four plain rows; adult tabs gone; readable at all sizes.
- Also from builder-d-after: kid/parent homework and stars at 390/768.

Visual problems seen (none fixed; none are layout breaks caused by the redesign):
- Parent hero shows "0 lessons - 0 subjects" and 0/0 tiles when nothing is assigned as a lesson, which reads oddly beside a kid Home full of work (data-truth, follows the assigned-lessons rule). Suggest hiding the lesson tiles for families with 0.
- Tutor hero card at 1440 has a large empty band between the avatars and the countdown.
- 768 top bar clips "Families" (portal chrome, not hub).
- Next dev overlay button overlaps the bottom-left of every shot (dev only).

## Still unverified
- Full standard suite (`npm run e2e`) and every other hub spec (board, live-room, teaching, oak-journey...) were not run; only the requested ones.
- Platform/HQ flows (needs the 2FA decision in open-questions 13 - unchanged).
- Real email delivery, marking with MAIL_ALLOWLIST, P-01 90-minute expiry in a real long session, P-11 erase with multi-child families (open-questions 9).
- Dark mode, keyboard-only pass and screen-reader behaviour of the new status region (only asserted structurally by hub-shell-a11y-links).
- Tutor Home with zero data (first-run guide P-12) was not captured; the fixture always has data.
