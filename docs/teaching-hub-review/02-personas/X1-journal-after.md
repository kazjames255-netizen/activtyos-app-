# X1 journal, after (round 2 review): X1 accessibility (keyboard, screen reader, contrast)

Checked against code on branch teaching-hub-redesign and screenshots/after/. No browser run by the reviewer.

## Improved
- Tab switch moves focus to panel heading and sets document.title (X1-02, X1-09 partly: no h1 guarantee); Escape closes only the top layer (escapeLayer.ts) (X1-03); curriculum tablist roving (X1-10); child switch announced (X1-11); token contrast: --green #0b7a44 5.41, control borders #85849b (X1-05/06/08 partly).

## Still broken
- Board keyboard drawing (X1-01), timer aria (X1-04), 11px text 447 uses (X1-17), focus ring on dark (X1-15), form aria-invalid (X1-14), single-letter shortcuts (X1-16), MatchOrder/CoordGrid (X1-13/19), ParentGate (X1-18) untouched. `text-white` still occurs 287 times in features/learninghub, most on non-gradient fills: 'not done' per P-07.md, so X1-05 is partial. Nothing was run with a screen reader or in dark mode (13-verification 'Still unverified').

## New problems introduced
- Not verified: focus-to-heading on every tab switch may steal focus after arrow roving on some panels; only structurally asserted.
