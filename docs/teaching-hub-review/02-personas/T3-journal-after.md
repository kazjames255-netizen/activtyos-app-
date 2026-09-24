# T3 journal, after (round 2 review): T3 in-person / remote lesson

Checked against code on branch teaching-hub-redesign and screenshots/after/. No browser run by the reviewer.

## Improved
- Tutor banner has 'End lesson' with a 6 s Undo (TutorLiveBanner.tsx:30-40); expiry 6 h -> 90 min (remoteSyncApi.ts:70); child heartbeat no longer keeps a session alive. T3-01, T3-11 fixed: cannot end -> 1 tap.

## Still broken
- No register (T3-02/18), per-child capture scroll, offline/retry states (T3-03/04/05/13/14), enrol+group flow (T3-07), bulk marking (T3-09) all untouched. Teach in person is still the 6th Home tile.

## New problems introduced
- MEDIUM: the End call is sent only after the 6 s timer, and the unmount cleanup clears that timer (TutorLiveBanner.tsx:26 `useEffect(() => () => clearTimeout)`). The banner is mounted separately on Home and Lessons, so switching tab inside the Undo window silently cancels the End while the tutor believes it ended. Fix: send /end immediately and make Undo re-open, or flush on unmount.
- 'Send to class' homework in in-person removed (H-01): the tutor must remember to Set homework afterwards.
