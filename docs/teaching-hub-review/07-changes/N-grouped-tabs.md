# N Grouped tutor tabs: seven top tabs, one horizontal card of sub-sections, no quick-action tiles

**What / why (owner request).** The tutor / operator hub had eleven flat tabs plus six quick-action tiles on Home. Now: seven top tabs (emoji + label) and, under each top tab that has more than one job, ONE full-width dark-blue gradient card (hero style: dotted texture, kicker, faint corner emoji) with every sub-section laid across it in a row. The chosen sub-section's live page sits directly underneath, full width. No landing page, no extra tap: opening a top tab shows the card AND a page at once. The six Home tiles are removed. Parents and children are untouched (flat strip, `KID_TABS`, `KID_STRIP_HIDDEN`, KS1 icon tabs).

| Top tab | Sub-sections (card items) | Opens on |
|---|---|---|
| 🏠 Home | none | Home (Today, attention, snapshot; tiles gone) |
| 📚 Lessons | 📖 Lessons & curriculum · 🎥 Live lessons · 📅 Schedule video lesson · 🧑‍🏫 Teach in person · 🧰 Tools · 🃏 Flashcards | last used (else Lessons & curriculum) |
| 🧑‍🎓 Students | 👥 Students · ➕ Enrol a student | last used (else Students) |
| 📈 Progress | none | Progress |
| 📝 Quizzes | 📝 Quizzes · 🎯 Starting quizzes · ➕ New quiz | last used (else Quizzes) |
| 📓 Homework | ✅ To mark · 📥 Inbox · ✏️ Set homework | To mark while anything waits, else last used, else Inbox |
| 💬 Messages | none | Messages |

Sub-sections map onto the EXISTING panel keys (`notes`, `live`, `tools`, `flashcards`, `students`, `quizzes`, `diagnostic`, `homework`, `dashboard`, `questions`, `home`); this is a presentation regrouping. Files: `features/learninghub/tabGroups.ts` (the map, remember-last), `SubMenuCard.tsx` (the card), `HubTabs.tsx` (top strip: emoji, badges), `LearningHubApp.tsx` (state, URL, wiring), `tabAlias.ts` (`resolveTarget`), `homework/TutorHomework.tsx` (view driven by the card), `home/TutorHome.tsx` (tiles + Teach overlay removed).

**Before -> after taps for the six old tiles** (from Home): New lesson 1 -> 2 (Lessons, then open the panel's own "New lesson" button, which stays inside the view); New quiz 1 -> 2 (Quizzes, New quiz item, builder opens); Set homework 1 -> 2 (Homework, Set homework item, form opens); Schedule video lesson 1 -> 2 (Lessons, Schedule video lesson item, dialog opens); Enrol student 1 -> 2 (Students, Enrol a student item, form opens); Teach in person 1 -> 2 (Lessons, Teach in person item, the in-person full-screen shell opens; closing returns to Lessons & curriculum). Daily job that stays ONE tap: Homework top tab lands on To mark when anything is waiting; Home's attention tiles and to-mark rows still deep-link straight to their view.

**How the action items work.** "Schedule video lesson", "Enrol a student", "New quiz", "Set homework" set the existing `hubIntent` and remount the panel, so the panel opens its own existing dialog with the previous view visible behind it; "Teach in person" renders the existing `InPersonApp` overlay (Lessons stays behind, `onClose` returns to Lessons & curriculum). Action items are never the "last used" one (no dialog on every visit) and are hidden for a view-only role.

**Card behaviour.** Horizontal `role=tablist` (left/right arrows, Home/End, roving tabindex), each item a `role=tab` with `aria-controls` on the shown panel; the selected item is a filled white tile with a check and bold type (not colour only). Every item shows a real colour emoji on a solid white 44px tile, 26px glyph (never a monochrome icon on the dark card). At 390 the row scrolls sideways with an edge fade and the active item is scrolled into view; from tablet up the items share the width (auto-fill columns, min 190px) and wrap to a second row only if they cannot fit (768 with six items). Items are >= 64px tall. Live numbers use data the hub already holds: `N to mark` (Mark queue), `Live now` (a lesson running), `N students` (roster), `Unsaved draft`. Top tabs keep the badges: Homework To-mark count, Messages unread, Lessons live dot + Unsaved.

**URL, links, aliases.** URL carries `?tab=<panel key>&sub=<sub id>`. Every old `?tab=<key>[&open=...]` resolves (each key belongs to exactly one top tab and has a default sub-section): `diagnostic` -> Quizzes/Starting quizzes, `tools` -> Lessons/Tools, `questions&open=doubt:x` -> Messages, `homework` -> Homework/To mark (the panel reports its real view back, so a Home overdue link still lands on Inbox), etc. `resolveTab` is unchanged and extended (`lessons`, `progress`, `live-lessons`); `resolveTarget` adds `?sub=` and a few sub aliases (`set-homework`, `enrol`, `new-quiz`...). `goTo`/`go()`, `hubIntent`, `family/link.ts`, notification links: no changes; they go straight to the target view.

**Remembered.** Last plain sub-section per top tab in localStorage `hub.sub.<top>` (try/catch), used when the top tab is clicked.

**Accessibility.** Top strip `role=tablist`; card `role=tablist` + `aria-controls`; focus stays on the top tab when a top tab with a card is chosen (next Tab reaches the card), moves to the panel heading after a card item is chosen (P-07); arrow keys keep focus in the strip; reduced motion respected (no smooth scroll / slide); `--on-brand` text on gradients.

**Not done / decisions.** Hub tab positions are unchanged (Home first and default). The Homework panel's own "To mark / Inbox / Set homework" segment is hidden in tutor mode (the card is the switch); other panels keep their inner segments (Live: Upcoming/Past; Quizzes: Quizzes / Question bank / Marking / Results). Inbox has no live count on the card (the shell only holds the Mark queue count). `HubTabs variant="sub"` (pill row) is unused now but kept for reuse.

**Revert.** `git revert` the commits `hub: grouped tabs with sub-tabs ...` (app code) and the e2e commit; nothing server-side or stored changed (localStorage keys `hub.sub.*` are inert).

**Tests.** `e2e/helpers/hubTabs.ts` (`openTab(page, oldName)` clicks the right top tab, then sub-item; `tabOf`); ~30 specs now navigate through it. New `e2e/review/tabs-subtabs.spec.ts` (every old deep link, no tiles, card layout at 390/1440, action items open dialogs / overlay, remember-last, arrows, parent + kid strips unchanged). Screenshots: `screenshots/after/tabs/` (`e2e/review/tabs-shots.spec.ts`).
