# X3 journal, after (round 2 review): X3 information architect, whole-hub map

Checked against code on branch teaching-hub-redesign and screenshots/after/. No browser run by the reviewer.

## Improved
- Naming agrees: Starting quizzes, Messages, Set homework, alias map for ?tab= (tabAlias.ts) (X3-11/22/25 partly). Header numbers agree (X3-06). Home vs Homework truth (X3-28 fixed). Broadcast endable (X3-16). Duplicate curriculum removed (X3-20). Child Lessons opens on stars, not grid (X3-31). Three direct-post homework paths removed (X3-02 partly).

## Still broken
- Structure is unchanged: still 11 tabs (panels.tsx:31 TAB_ORDER), three marking queues (X3-03/04), no student profile (X3-13), 23-click enrol->start (X3-12), Groups above students, Tools tab kept, question bank duplicated (X3-09). The redesign is a rename + declutter, not a re-organisation; the two biggest X3 findings (tabs by data type, three marking queues) are untouched.

## New problems introduced
- Alias `lessons`->notes and `progress`->dashboard are new vocabulary that no UI label uses yet: harmless.
