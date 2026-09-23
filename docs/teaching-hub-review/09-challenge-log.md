# 09 — Challenge log and final build list (v2)

Challengers: simplicity hawk, overloaded tutor, six-year-old, safeguarding, white-label owner, engineer (report in `09-challenges/`). Decisions were made by the lead without asking the owner (standing order: no questions until they wake). Every decision is reversible.

## Decisions per proposal

| P | Decision | Changes from v1 |
|---|---|---|
| P-01 End broadcast | BUILD | No confirm dialog, Undo toast instead (hawk); idle expiry 2 h not 45 min, and every child/tutor write bumps `updatedAt` (tutor + safeguarding); liveAnswer writes 409 after end; child sees "Your tutor has finished the lesson". Expiry constant read from tenant setting later. |
| P-02 Numbers | BUILD | Delete (not collapse) the topics/worksheets tiles; honour saved hero Hide/Show key; subjects shown = subjects with real lessons, tenant "subjects we teach" is roadmap. |
| P-03 Child Home | BUILD | One icon next-step card ≤6 words, ≥96px; hide streak/level/stats in kid mode; NO list under the card; "Join your lesson" appears only when live; `live` + `dashboard` added to KID_TABS as an explicit allow-list; kid Progress = stars only, child-scoped, no free text. |
| P-04 One truth homework | BUILD | Failed load = face + big Try again, never empty state; overdue/due-soon split in tutor/parent only. |
| P-05 Errors | BUILD, merged with P-13 as one copy pass | No tutor "Details" toggle; child: "Oops! Let's try again." + 56px Try again. |
| P-06 Tutor Today | BUILD reduced | Nudge preselects student (reuse `childIds` intent); Overdue opens overdue list; tiles removed via P-02. DROP parent message template (needs consent design → roadmap R-9), DROP duplicate Set homework button. |
| P-07 Accessibility | BUILD | Fix base tokens in globals.css; add `--on-brand` computed for tenant accents; focus to panel heading without scrolling; Escape = topmost layer only (fixes my ToolHost bug); tablist ARIA; aria-busy on skeletons. |
| P-08 Tools tab | BUILD | Ready-only by default; "coming soon" hidden outright (no fold) — all tools are being built so it should be empty. |
| P-09 Curriculum | BUILD | Grid behind the existing toggle, default closed, remembered per device; one summary line; child: row of stars; Progress-tab duplicate removed. Owner's earlier "first thing on Lessons" honoured as the FIRST element (summary line) — log in 11. |
| P-10 Tabs | BUILD as rename + alias map only | No merge that adds a tap tonight; Placement stays a tab but is renamed "Starting quizzes"; alias map for `?tab=` in both LearningHubApp:43/:109 and notification links (`doubtsApi.ts:56`, `family/link.ts`); Tools stays a tab (ready-only). Real merge waits for one Mark queue (R-2). |
| P-11 Safeguarding | BUILD widened | Erase + export cover hubDoubts, liveAnswers, board images, notifications, hubToolStates export, hubGroups, hubBoards, invites; test that fails if a child-keyed collection is missing from erase. |
| P-12 First-run | BUILD | Guide is the empty state and vanishes at 1 student; homework picker Year filter defaults only for a single student and uses tenant `yearGroups`. |
| P-13 Kind language | BUILD with P-05 | Child screens only, age-banded (not for 14+); icon + word; string table. |

## Extra deletions adopted (simplicity hawk)
1. One homework-setting form: remove HomeworkForLesson and in-person direct-post paths and the "Set for children" list icon.
2. Dead code: ComingSoon/"soon" styling, KID_TAB_LABEL.dashboard, regex DOM-click helpers, duplicate Home quick actions.
3. One curriculum view (remove duplicate in Progress for the tutor overview).

## Roadmap left (documented, not built tonight)
R-1 one Assign sheet (partly done via extra deletion 1), R-2 one Mark queue, R-3, R-4 (DROP for now), R-5 accommodations, R-6/R-7 age-banded navigation, R-8 acting-as stamping, R-9 messaging rules, tenant settings (subjects, show/hide blocks, terms/thresholds) from white-label.

## Tools workstream (owner's standing order, runs in parallel)
Phase 3: every tool built and assigned to questions by the selection engine; browser/Playwright verification of geometry, curriculum, tool-question flows, science/English/languages; fix ToolHost Escape.
