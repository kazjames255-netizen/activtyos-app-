# T4 journal, after (round 2 review): T4 tutor of a child with additional needs

Checked against code on branch teaching-hub-redesign and screenshots/after/. No browser run by the reviewer.

## Improved
- Kid Home is now one card, no streak/level/countdown/animation (KidHome.tsx), 'Waiting for you' replaces red Overdue (T4-04, T4-07). Tools list honest (T4-09 partly).

## Still broken
- The core asks are all still open: no per-child accommodations, extra time, timer off, streak/XP/confetti off inside lessons, read-aloud (T4-01/02/03/05). No global text size. The 30-minute retake lock is unchanged (T4-08). Homework form still 8 fields (T4-06).

## New problems introduced
- Kid Home shows up to 4 rows under the card for Years 3-6 (KidHome.tsx:16), which the challenge log said NOT to do (09-challenge-log P-03: 'NO list under the card'). Minor.
