# P1 journal, after (round 2 review): P1 parent, checks on the phone

Checked against code on branch teaching-hub-redesign and screenshots/after/. No browser run by the reviewer.

## Improved
- Verdict line 'N homework task(s) overdue' / 'On track. Nothing is overdue' at the top of the summary (StudentHome.tsx:143-145) (P1-01 fixed). But at 390px it sits below hero, child bar, hand-over bar and tab strip (parent/home-verdict-390.png), so P1-02 only partly.

## Still broken
- No new notifications: overdue, lesson soon, only-first-reply (P1-03/04/06) untouched (roadmap R-14). Hand-over gate without confirm/explanation (P1-09), two inboxes (P1-05), 'Ava and Leo has' grammar (P1-07) untouched.

## New problems introduced
- Parent hero says '0 lessons - 0 subjects' with 0/0 tiles beside a kid with work (13-verification, screenshot parent/home-390.png; the tiles also clip 'Av'). Verification report flagged it; nothing fixed. LOW-MEDIUM: contradicts the verdict card directly below.
