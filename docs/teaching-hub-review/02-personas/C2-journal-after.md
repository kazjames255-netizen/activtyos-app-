# C2 journal, after (round 2 review): C2 Year 3-4 child

Checked against code on branch teaching-hub-redesign and screenshots/after/. No browser run by the reviewer.

## Improved
- Home leads with the next step; Join lesson and See progress no longer dead (live/dashboard added to KID_TABS, stripped from the strip: KidMode.tsx:16-17). 'My stars' progress (KidStars.tsx) shows 1-3 stars, no %. C2-01/02/03 fixed.

## Still broken
- Kid can ask the tutor free text with no 'who reads this' line (C2-07); 7 text tabs remain (C2-09); ring/contradictory numbers are hidden in kid mode rather than reconciled (C2-04 partly).

## New problems introduced
- 'Stars' thresholds 70/40 are invented (P-03 notes). A subject at 39% shows one star; fine, but Progress tab in kid mode has no other route to weak topics.
