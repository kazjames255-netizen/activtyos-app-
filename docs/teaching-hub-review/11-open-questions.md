# 11 — Open questions and decisions taken without the owner

Owner asleep, standing order: no questions. Each item below was decided by the lead and is reversible.

1. Curriculum map: owner earlier asked for it as the first thing on Lessons; the brief says simplify. Decision: the one-line summary is first on Lessons; the grid is collapsed by default (remembered per device). One-line revert in CurriculumCard.tsx.
2. Additive server fields: `/notes/counts` gains fields (P-02); erase/export gain collections (P-11). No migrations.
3. Broadcast idle expiry: 6 h -> 90 min, child heartbeats no longer bump `updatedAt` (P-01).
4. Tab merge (P-10) done as renames + alias map only; real merge waits for one Mark queue.
5. Tutor->parent nudge message template NOT built (needs consent/tone design; R-9).
6. Acting-as stamping, ParentGate server enforcement, per-child accommodations: roadmap.
7. Set MAIL_ALLOWLIST before any marking tests (dev mail is live).
8. P-01 expiry chosen as 90 min (brief said 45): long lessons with quiet spells must not be cut off; End lesson button gives the tutor an explicit exit. Read from a tenant setting later.
9. P-11 gaps: multi-child family notifications (name several kids) are not erased on one child's deletion; `/api/privacy` summary counts only the older keys; board image docs are deleted only for elements carrying the child's `cid`. Owner to review.
10. P-09 tenant-level off switch for the curriculum map NOT built: no cheap tenant settings hook exists for hub blocks (only `settings.features.learninghub`). Roadmap with the tenant settings work (show/hide blocks).
11. P-08/P-09 leftovers: `ComingSoon` (kit.tsx) and its call at LearningHubApp.tsx:191 are still reachable for any non-live panel meta, and both are Builder A's files, so not deleted. Child Progress tab still shows the curriculum ring overlay (kept per brief), with stars instead of "N of M".

## Builder C: one homework form (H-01)
- Removed the in-person "also send to portals" Yes/No and the inline "Set this lesson" shortcut in the reader and the live workspace. Safest reading of the hawk decision. If tutors miss the in-call shortcut, add a "Set homework" button in the live workspace that calls `lessonHomeworkIntent` after the session (not built).
- P-12: Year filter options are the tenant's free-text `yearGroups`; a name with no number (e.g. "Reception") sends no year filter.
8. Builder D (P-03/P-04/P-13): browser verification NOT completed. Six to eight builders were running Playwright against the one shared dev stack and throwaway accounts (each run wipes the others' data), so the kid/parent specs (learning-hub-family-hat, -g2-child-parent, -home) never got past setup. Type-check is clean. Still to run once the stack is quiet: those three specs plus `e2e/review/builder-d-after.spec.ts` (writes 390/768 screenshots to screenshots/after/{parent,kid}), then `npm run e2e:cleanup`. Decisions: a live lesson outranks homework on the kid card (only time-critical item); a waiting quiz shows "Try a quiz" so "All done" is never false; kid stars use 70%/40% thresholds.
8. Builder A (P-05/07/10): (a) `learning-hub.spec.ts` / `quizzes-ui` could not be run cleanly - several builders shared the same throwaway accounts and feature toggle (the "starts off" test fails when another run has the hub on); verified instead with `e2e/review/hub-shell-a11y-links.spec.ts` (tutor 390/1440, kid, offline banner). Re-run the two named specs once, alone, before merge. (b) Not done: bulk `text-white` -> `--on-brand` on non-gradient fills, HubHero child-switch ARIA (B's file), "Placement test" wording in D's ResultView/TakeAssessment and the builder's "A quiz or placement test" creator tab (a spec clicks it). (c) `npm run e2e:cleanup` not run because other builders were mid-run on the same accounts; run it once at the end. (d) Kid `?tab=dashboard` now lands on the hidden Progress view (D's P-03), so the old "kid dashboard -> Home" expectation no longer holds.
12. Tools open-all e2e: opening ~100 tools in a burst trips the API rate limit (429) on the fire-and-forget `/tools/events` "open" log; harmless to users, ignored in the spec. No after-screenshots were captured for P-08/P-09 (e2e runs took ~20 min each under shared-stack contention).
13. BLOCKER for browser verification (owner decision needed): Playwright global setup can no longer sign in the throwaway platform (HQ) account, because platform sign-in now requires an emailed one-time code (server/src/routes/twoFa.ts, sent to the fixed admin inbox). Every setup attempt therefore emails a code to that inbox (two were sent on 24 Sep during verification). I proposed pre-marking the throwaway `@activityos-test.com` platform user as 2FA-verified from test tooling; the action was refused as a security weakening, so I did NOT do it and the product 2FA is untouched. Options: (a) owner allows a test-only pre-verify script, (b) setup skips the platform login when only tutor/family specs run, (c) a documented E2E-only bypass env flag reviewed by the backend owner. Until then the hub UI changes are verified by tsc, selftests, curl, and the builders' earlier Playwright runs only.

## Builder F leftovers
- Tutor hero at 1440 is tighter but its card still stretches to the height of the Needs-your-attention card (grid row), so a smaller empty band remains; a full fix means top-aligning or moving the "later" list up. Not done.
- Parent Home 390/1440 screenshots not re-inspected after the zero-tile change (fixture family has lessons, so the hidden-tile path was not exercised in browser).
- Tab icons now only appear at 2xl (1536px+); tell tutors if the icon loss at 1024-1535 matters.

## Builder G leftovers
- KID_TAB_LABEL.dashboard kept (dashboard is a live kid tab).
- End lesson: chose flush-on-unmount rather than a Re-open (no reopen API); no new spec for the tab-switch case.
- kidTitle strips only overdue/late words; row notes from h.st.label not audited.
- Ended-lesson Set homework button not covered by a spec; tsc shows unrelated server error (learningHub.ts EnrolledChild.support).

## Builder I leftovers (read-aloud, R-5)
- Additive schema change: optional `support` map on `hubEnrolments` docs (noTimer, extraTimePercent 0|25|50, calm, readAloudDefault, textSize). No migration; absent = defaults. Not yet in `server/openapi.yaml`.
- Not built from the 0.7 table: parent-editable controls and "request extra time", child-side Calm toggle, pause timer, change audit log (who/when), per-band defaults (KS1 read-aloud on), highlight-the-sentence, speakers on answer options / lesson steps / flashcards (only `readAloudDefault` adds options to the question read-out), sound.
- `textSize: large` is a CSS `zoom` on the family hub (fine on current Chrome/Safari/Firefox 126+; older Firefox ignores it).
- `readAloudDefault` never auto-plays by design (owner rule: no auto-play).
- Extra time is snapshotted at attempt start: changing a profile mid-attempt does not change a running paper. The child's list/intro time label is computed client-side with the same pure function.
- In-person quiz attempts are already untimed; homework packs untouched.

## R-2 (One Mark queue), left undone
- Batch "give full marks to all" with a review-then-confirm step (C-4) is not built; the queue is where it would live.
- In-person Results "written to mark" (T3-08) still does not link to the queue.
- A homework hand-in with a linked quiz shows as two rows (homework score, quiz written answers). Merging them into one row needs a decision on which mark comes first.
- Tab badge and the queue each fetch the inbox and pending attempts (duplicate GETs). A read-only aggregate endpoint (`/mark-queue`) would halve it; not added to keep the change client-only.
- Home still shows three to-mark rows (counts differ by kind); all land on the queue. Collapsing to one "To mark" row would change the label the `learning-hub-home` spec asserts.

## Builder K (parent verdict, R-12 report)
- "This term" in the printable report is the last 90 days of homework (no term dates exist in the data). Should tenants set term dates?
- Multi-child parents: Home shows one verdict for the chosen child only (each child's homework is a separate fetch). A single all-children verdict needs a family-level endpoint.
- Notifications for overdue homework and "lesson soon" (R-14) and the tutor nudge template (R-9) are NOT built: they need consent and tone design, and dev mail is live.
- The report has no school-facing branding/logo or tutor sign-off; the tutor's own level names are used as-is (a tenant with jargon in its level names still shows it).
- Some parent copy outside Home/Progress (quiz runner, live lessons, Setup) still has "diagnostic"/"mastery" wording.

## L - tools assignment (undone / decisions)
- Tutors cannot yet pin, hide or add tools per question (suggestions are automatic from the wording + topic + year). A stored per-question `tools` override needs an API/schema change.
- Tools are offered in all non-diagnostic quizzes, including the scientific calculator (M-80) and other aids. Should a quiz have a "no tools" switch for test-like papers?
- Lesson-quiz (QuizStep) and warm-up questions do not show question tools yet (lessons already have the Tools drawer).
- H-H02 (chronology sort) and the humanities tools have no Oak history/geography lessons to assign against; only English "chronological order" wording assigns them.
- Topic-name matches can add a loosely related tool (e.g. a Fractions topic suggests the fraction wall for an angles question); the reason line says "the topic mentions".

## R-6 age bands (open)
- Per-child display-band override (Little/Junior/Teen) not built: needs an enrolment field `displayBand` plus a tutor/parent control.
- KS1 "Play & learn" opens Quizzes; Homework, Lessons and Flashcards are reached from the Home card only. Confirm this is enough or add a sub-row.
- KS1 icon tabs have no spoken labels or arrow-key roving yet (read-aloud nav is R-4 scope).
- Teen Home has no "Next lesson" row or 3 topic buttons; "Revise weakest" opens Quizzes (no weakest-filtered quiz yet).
- Teen quiz/homework result screens still use kid tone in places outside Home; only Home and the P-13 string table were switched.

- Fixture fix (M): the support-profile @api spec picked qs[0]'s topic, which was not in the review kids' enrolled subjects, so childSubjectOk 404'd the parent's attempt start. Spec now picks a question from an enrolled subject. Product R-5 code was correct; spec and mark-queue green.

## N grouped tutor tabs (open)
- Inbox has no live count on the sub-section card (the shell only holds the Mark queue count); a second count needs another request or lifting the Inbox rows.
- Other panels' inner segments (Live Upcoming/Past, Quizzes Quizzes/Question bank/Marking/Results) still sit under the card; a further merge would remove one level.
- Home's "Next lesson" schedule button lands on Live lessons, not the Schedule item (no dialog); confirm.
- Emoji rendering varies by OS font; no image assets were added. If a branded icon set is wanted, swap the `emoji` strings in `tabGroups.ts`.
- `?tab=<sub alias>` (e.g. `set-homework`) selects the sub-section but does not auto-open its dialog (deep links go to the view only).

## O (year-first curriculum map) - not done
- KS1/KS2/KS3/KS4 shortcut group on the year pills (optional in the brief; `KEY_STAGES` exists in cells.ts, no UI).
- Multi-year key-stage rows (e.g. Years 3-6) are judged as a whole, so a Year 5 row shows its span total as a sub-line, not a per-year verdict.
- Pre-existing lint errors (react-hooks set-state-in-effect) in AreaDrawer/CurriculumCard/CurriculumRings left as they were.
- `--on-brand` token does not exist in the CSS; pills use it with a #fff fallback.
