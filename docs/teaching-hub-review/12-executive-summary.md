# 12 — Executive summary (Teaching & Learning Hub redesign, 24 Sep)

**Branch:** `teaching-hub-redesign` (pushed; never merged to main). Review docs: this folder. Per-change notes: `07-changes/`.

## What was done
1. **Research:** 14 persona agents (5 tutor, 4 child, 2 parent, 3 specialist) walked the hub; 233 friction rows merged (`03-friction-log.csv`), synthesis (`04`), scorecard (`04b`), structure options (`05`), child-experience design (`08`).
2. **Challenge:** six challenger agents (simplicity, overloaded tutor, six-year-old, engineer, safeguarding, white-label) attacked the proposals; decisions in `09-challenge-log.md`.
3. **Built (46 commits, all with notes in `07-changes/`):** P-01…P-13 + H-01; visual fixes V-01..V-05 (tab strip fits at 1440, hero, curriculum wrap, Home 'More'); G-01..G-05 (End lesson can no longer be cancelled by a tab switch, hero collapsed, kid Home rows/kind titles, Set homework after a lesson); **R-2 One Mark queue** (~28 → ~18 taps to clear 8 items, derived from code); read-aloud; **R-5 per-child support profile** (no timer/extra time, calm mode, text size; additive optional field, tutor-only edit). Type-check clean (app + server); selftests pass (hubSelfTest5 erase-coverage, support).
4. **Tools:** all 102 live tools open cleanly at 1440 and 390 (`e2e/review/tools-open-all.spec.ts`); 17 tool selftest suites pass; Tools tab shows only working tools.
5. **Verified:** hub specs pass with a review-only Playwright config; after-screenshots at 390/768/1440 (`13-verification-report.md`); round-2 adversarial review (`14-round2-review.md`): 15% of friction fixed, 18% partly, rest = tutor marking/assign/quiz builder, parent comms, owner oversight (roadmap).

## Needs the owner
- **Blocker (11 #13):** the standard Playwright setup cannot sign in the platform account because HQ sign-in now emails a 2FA code to the admin inbox (two codes were sent during verification). A test-only pre-verify was refused as a security weakening and NOT done; decide how e2e should handle it.
- Curriculum map on Lessons: summary line first, grid collapsed (conflicts with your earlier "first thing" ask; one-line revert).
- Broadcast expiry 90 min (brief said 45); additive server fields; additive `support` enrolment field; teen/kid wording thresholds.
- Never merged to main; nothing touched real tenant data; set `MAIL_ALLOWLIST` before marking tests (dev mail is live).

## Not done (roadmap)
One Assign sheet, tenant settings (subjects/blocks/terms), teen mode, parent notifications, i18n, acting-as stamping, owner oversight views, enrol-by-name.
