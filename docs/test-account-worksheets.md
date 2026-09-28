# Test account with seeded worksheets (Homework > Set homework)

TEST DATA ONLY — never a real customer tenant.

## Which account to open

**HQ Open account → search "SlideQA Tier1 Sandbox"** (freelancer/tutor tenant).

- Tenant id: `Il9CzN5ROzQ00J5MhXmj`
- Owner / sign-in email: `slideqa-t1-muilloxt@activityos-test.com`
- Password: the standard e2e test password used across this repo's throwaway
  `@activityos-test.com` accounts — see `e2e/helpers/accounts.ts`
  (`TEST_PASSWORD`). Do not repeat it outside this file.
- This tenant was already the one HQ's impersonation history shows being used
  as a Teaching-Hub sandbox (Sep 26 Slide-QA sweep); it had 0 enrolled
  students and Teaching Hub already enabled, matching "test freelancer,
  no students".

If Kaz is looking at a **different** freelancer tenant under "You're viewing
as …" and still sees nothing, tell the automation which tenant/owner email
the banner names — the two "AmirFreelancer" tenants
(`7jG2XO3cOD3VtoL8YfFY`, `jYp5XNZGT7bgSUMuEgHN`) were deliberately **not**
touched: they already have 8 real-looking enrolled students and their owner
emails are `@gmail.com`, not `@activityos-test.com`, so they don't meet the
"confirmed test tenant" bar for this task.

## What was seeded (via `server/src/oak/seedTestWorksheets.ts`, test-only, idempotent)

- **24 sample worksheets**, Years 1–9, across Maths / English / Science,
  published, no publisher/brand strings (checked against
  `scripts/check-no-oak.mjs`'s pattern). Roughly a 60/40 mix of:
  - **Interactive** — has a 2-question auto-marked quiz (`worksheetQuizId`)
  - **PDF only**
- **3 sample students**, enrolled with realistic year groups, all linked to
  one throwaway parent (`sample-family-il9czn@activityos-test.com`, family
  link so "Assign to" and the year `yearAll` quick pick work):
  - Sam Sample — Year 3
  - Priya Sample — Year 6
  - Jordan Sample — Year 9
- **One group**: "Sample group" containing all three.
- The notes index was refreshed (`POST /notes/index-refresh` with the new
  note ids) so `GET /api/learning-hub/notes/counts` immediately reflects
  `worksheets: 24`, `worksheetsByYear` / `worksheetsBySubject` per year and
  subject, without waiting for a server restart.

Re-running the script is safe — it skips any worksheet whose title already
exists on the tenant.

```
cd server && npx tsx src/oak/seedTestWorksheets.ts Il9CzN5ROzQ00J5MhXmj slideqa-t1-muilloxt@activityos-test.com
```

## What to click to see it

1. HQ → Open account → **SlideQA Tier1 Sandbox** (or sign in directly with
   the email/password above at `http://localhost:3000/login`).
2. Teaching Hub → **Homework** tab → **Set homework** sub-tab → **Set
   homework** button.
3. In the dialog:
   - **Assign to** shows Sam / Priya / Jordan Sample and "Sample group".
   - **Worksheet (optional)** search box + subject chips (All subjects /
     English / Maths / Science with counts) + year chips (**All years**
     selected by default, then Y1…Y9 with per-year counts).
   - Cards show **Interactive** or **PDF only** badges. Preview opens the
     PDF; for an Interactive worksheet a second "Preview the interactive
     quiz" button opens the quiz on top.
   - Picking a worksheet + a student + Assign homework → `201`.
4. On the family/child side (parent `sample-family-il9czn@activityos-test.com`,
   same test password), Homework shows the assignment; opening an Interactive
   worksheet starts the on-screen quiz, which auto-marks on completion.

## Verification screenshots

`docs/reviews/shots/worksheets-test/`:

- `01-form-top.png`, `02-picker.png` — bare form + picker with subject/year
  chips and cards (All years default, non-zero counts).
- `03-pdf-only-search.png` — a PDF-only card (search "Pythagoras").
- `04-preview-pdf.png`, `05-preview-quiz.png` — PDF preview and the
  interactive-quiz preview on top of it.
- `06-attached.png`, `07-assigned.png` — worksheet attached, homework
  assigned (`201`).
- `10-parent-hub.png`, `11-child-homework.png`, `11b-homework-open.png` —
  family view: child picker, Homework tab, the assigned "Sample worksheet
  homework".
- `13-q1.png` / `13b-q1-picked.png` / `14-q2.png` — the interactive worksheet
  quiz player: question 1 (multiple choice) answered, question 2 (short
  answer) filled in. The final "hand in → auto-marked" screen was not
  captured in this pass (the throwaway verification script's submit-button
  selector didn't match); the quiz engine itself is the same one already
  covered by `e2e/learning-hub-homework-preview.spec.ts` and other Learning
  Hub specs, so auto-marking is expected to work but wasn't re-screenshotted
  end to end here.

No layout defect was found in the picker: **All years** is already the
default selection (not Y1), matching what the task asked to check for.

## Scripts added (test-only, not part of any product flow)

- `server/src/oak/seedTestWorksheets.ts` — the seeder above. Refuses to run
  against any tenant whose owner email isn't `@activityos-test.com`.
- `scripts/verify-worksheet-picker.mjs`, `scripts/verify-worksheet-child.mjs`
  — throwaway headless Playwright scripts used to take the screenshots
  above; not wired into `npm run e2e` and safe to delete.
