# X2 journal, after (round 2 review): X2 safeguarding lead

Checked against code on branch teaching-hub-redesign and screenshots/after/. No browser run by the reviewer.

## Improved
- hubDoubts, liveAnswers, board images, notifications now erased and exported, with a self-test that fails on drift (hubPrivacy.ts, hubSelfTest5.ts): X2-04 fixed, X2-05 mostly. Kid mode hides streaks (X2-13 partly).

## Still broken
- Every other item is deliberately deferred: tutor->child thread rules and DSL view (X2-01/03), keyword scan (X2-02), acting-as stamping and audit (X2-08/09), access log (X2-07), ParentGate server-side (X2-10), early room entry (X2-11). Multi-child notifications survive erase (11-open-questions #9).

## New problems introduced
- LOW-MEDIUM: kid mode still offers the free-text Messages tab to any in-scope tutor, and now also a `dashboard` route; KidStars is child-scoped, so no new leak found, but the KID_TABS allow-list grew from 7 to 9.
