# Learning Hub game prototypes: shared brief

You are building ONE playable single-file HTML prototype game and publishing it as a private Artifact. The owner (Kaz) wants games that are genuinely amazing and incredibly interactive, not quizzes with a skin.

## Reference
Open `/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/9019c60e-ba39-4e52-8a1c-d81f4f3bd850/scratchpad/penguin-slide.html` first. It is a finished prototype (canvas, WebAudio, calm mode, overlays, adaptive fact weighting, results screen). Copy its scaffolding, audio helpers, palette and page structure, then build a very different mechanic. Also skim `docs/games-research/03-concepts.md` (30 concepts), `docs/games-research/deep/C-learning-science-uk.md` and `deep/D-tutors-parents-market.md`.

## Non-negotiables
1. **Direct manipulation.** The child does something with their hands every few seconds (drag, flick, steer, build, catch, place, tilt, balance, sort). Answers are things in the world, not a row of buttons. It must feel like a game: weight, momentum, feedback, rhythm, small surprises.
2. **Juice with restraint.** Easing, squash and stretch, particles, camera moves, layered WebAudio sounds (made in code, nothing downloaded), haptic pulse via `navigator.vibrate` where available. No flashing faster than 3 Hz.
3. **Learning is the mechanic.** Real, correct curriculum content for the stated subject and year band. At least 40 distinct items (or a generator that makes many). Weak items come back more often, a missed item is retested after 3 to 6 others, the correct answer is always shown after a miss, and distractors come from real misconceptions.
4. **No time pressure by default.** No countdown, no speed bonus, no public ranking. Reward personal bests and streaks with rest-friendly wording (no guilt). A **Calm mode** switch turns off shake, particles, music and motion, and switches on automatically for `prefers-reduced-motion`.
5. **Access.** Touch AND keyboard AND mouse. Targets at least 44px. Sensible `aria-live` announcements and labels. Colour is never the only signal. Text at least 16px equivalent for younger bands.
6. **Safe.** No free-text names, no chat, no ads, no external requests except Google Fonts. Never mention "Oak" anywhere. No green as a theme colour (semantic ticks only).
7. **Brand.** Our navy, royal blue, violet and gold palette. The navy penguin in a graduation cap is the mascot: reuse the penguin drawing from the reference (or a simplified version) somewhere as guide or player. Keep it friendly, calm and never scary.
8. **Session.** A run is about 3 to 5 minutes, ends with a results panel (score, accuracy, personal best via localStorage in try/catch, "Worth another go" list of missed items) and a one-tap replay. First playable moment within about 5 seconds of opening: no menus before the first interaction beyond one start button (needed for audio).
9. **Quality.** No console errors. Works at 390px wide and at desktop. One consistent art style drawn in canvas or SVG in code.

## Artifact format (important)
- Write the file to the scratchpad directory shown in the reference path (a new file named after your game).
- Call the Artifact tool with `action: "quickstart"`, `intent: "other"`, `design_systems: false` once, and follow its page contract exactly: write page content directly with no `<!DOCTYPE>`, `<html>`, `<head>` or `<body>` tags; put a `<title>` (2 to 4 words, the game name) at the top; load fonts only from Google Fonts; inline everything else; wrap `localStorage` in try/catch; the body needs an explicit background colour; keep a 16px side gutter.
- Test it once in a real browser: Playwright at `/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright/index.mjs` (see `scratchpad/shot2.mjs` for a working example that loads the file, clicks start, presses keys, screenshots and prints console errors). Look at one screenshot, fix what is wrong, then publish.
- Publish with `Artifact` (file_path, `icon: "game"`, a one-sentence `description`). Report the URL.

## Final report (keep it short)
The artifact URL; the game's name, subject, year band; the core mechanic in one sentence; what curriculum content it covers and how many items; how it adapts; anything you could not verify (for example real touch feel on a device).
