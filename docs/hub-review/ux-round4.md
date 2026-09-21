# Learning Hub — UX round 4 (visual audit as a user)

Date: 2026-09-20, 21:18–22:15. Method: a throwaway Playwright script (scratchpad, not committed) signed in with the standing
e2e tenant accounts (`e2e-freelancer-…` as the tutor, `e2e-parent-…` as the family) and screenshotted every hub tab at
1440×900 (tutor: every tab, lesson reader, Teach-in-person; parent: every tab, lesson open + player). Evidence in
`docs/hub-review/ux-round4-shots/`.

**Coverage caveat.** The shared dev stack was under very heavy load for the whole window (page loads of 2–3 min, the API
restarting under another agent's server edits, other specs toggling the hub off on the shared tutor account). Mobile
390×844, kid mode, quiz taking/results, flashcard review, roster detail and the live lobby with data were NOT reached
before the lead called a stop on all Playwright work (machine load ~630). Those remain for round 5. On the plus side the
slow stack exercised every loading / error state, which is where most of the real defects turned out to be.

Theme note: the operator shell and custdash both render the hub on the light surface; there is no dark variant to audit.

## Defects found and fixed

| # | Screen | Defect (before) | Fix (after) | File |
|---|---|---|---|---|
| 1 | Tab strip, every tab (tutor) | When the green "live now" dot appears on **Live lessons**, every tab to its right shifts but the sliding pill did not re-measure: the pill sat ~12 px left of **Students**, clipping the label ("Student"). `before-tab-pill-misaligned.png` → `after-tab-pill-aligned.png`. | Re-measure on `liveNow` / badge changes and observe each tab button with the ResizeObserver (the `min-w-full` list never resized on a wide screen, so the observer stayed quiet). | `features/learninghub/HubTabs.tsx` |
| 2 | Teach in person (tutor) | Tapping **Teach in person** opened a full-screen layer that was blank while students loaded — no title, no spinner text, no way out. `before-inperson-blank.png`. | Loading card with the heading "Teach in person", "Loading your students…" and a **Cancel** button; `role=status aria-live`. | `features/learninghub/inperson/InPersonApp.tsx` |
| 3 | Hub shell (parent / kid) | A network blip showed lib/api's developer wording to a parent: "Couldn't reach the server at http://localhost:4000. Is the API running?" — and no way to retry. `before-offline-jargon.png`. | Detected in the hub's empty state → "We can't reach the Learning Hub right now. Check your connection, then try again." with a **Try again** button (calls the hub refresh). | `features/learninghub/LearningHubApp.tsx` |
| 4 | Lessons (tutor) | Header said "**0 lessons**" while the list was still loading (skeleton cards below it). `before-lessons-0-while-loading.png`. | Shows "Loading…" until the list has loaded, then the count. | `features/learninghub/NotesPanel.tsx` |
| 5 | Quizzes / Homework / Placement subject chips | The chip strip had a fixed 28 px right fade whether or not it scrolled, and never a left fade — scrolled right, the first chip was clipped hard with no hint; with everything fitting, the last chip was faded for no reason (visible in `tutor-desk-quizzes` etc., last chip "Board mu…" cut). | Same edge-aware fades as the tab strip (`useEdgeFade`: fade only on the side with more to scroll, re-read on scroll/resize). | `features/learninghub/TopicFilter.tsx` |

## Checked and fine

- Every tab shows a skeleton while loading (Home, Live, Students, Progress, Placement, Quizzes, Homework, Lessons, Flashcards).
- Hub-off state for a tutor: clear copy + "Open Setup → Features" CTA. Placement "How it works" 3-step explainer reads well.
- Student lesson player (parent hat): child chip + "Not Ava? Switch", step rail, Back/Next, "Getting ready…" disabled state on Start — no overflow at 1440.
- Empty states across panels all carry guidance and an action (audited in code: Students, Groups, Homework, Flashcards, Marking, Progress, Home).
- No hardcoded colours in scope beyond documented AA overrides in `kit.tsx`; all new code uses `var(--*)` tokens and `FOCUS`.

## Not done (round 5)

- Mobile 390×844 pass for all hats; kid mode (Hand over → tabs → parent gate); quiz taking → results; flashcard review;
  roster/student detail; groups sheet; live lobby with a scheduled lesson.
- `npx tsc --noEmit` was clean after fixes 1, 4, 5; the lead killed the re-run after fixes 2–3 (both are small JSX-only
  edits using in-scope imports: `FOCUS` was already imported in both files). Re-run tsc when the machine is free.
