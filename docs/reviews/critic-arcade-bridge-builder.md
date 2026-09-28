# Critic: Bridge Builder / Convoy Rush (independent playtest)

Method: Playwright, 375x812 touch and 1280x800 mouse. Scripts and screenshots in scratchpad/ax/bb/critic/ (c1, c2, boss runs). Played as a bored 9-year-old: idle, random-tap spam, lay-every-plank, let lives run out, fought boss at 70% accuracy.
Console: zero errors or warnings across all runs.

## Top 10 flaws (ranked)
1. Mobile wastes the bottom ~30% of the screen. Canvas is 343x610 in a 812px viewport (m_p0.png, cheat.png). Belt is cramped and planks are small; dead navy band below.
   Fix: size the canvas to visible height (100dvh minus safe area) or add belt row height; use the space for larger planks.
2. Planks clip off the right edge of the belt on mobile (7/8, 6/8 cut off in m_p0.png; 4/5 laid plank runs past canvas in cheat.png). A child cannot read the fraction on a plank it must choose.
   Fix: clamp belt spawn so the label centre is always visible, or scale plank widths to fit; keep label sticky to the visible part of the plank.
3. Stacked overlapping "Too long!" popups (cheat.png shows two copies overprinting). Looks like a bug.
   Fix: one popup at a time; debounce or replace the previous one.
4. Idle at tutorial: 40s with no input, nothing happens and no nudge beyond the hand icon. Then in the real game a round timed out and 3 timeouts ended the game with 0 taps (score 0, "0 of 3 right"). Bored kids just leave. No mercy or "still there?" prompt.
   Fix: after 6s idle in tutorial, pulse the correct plank and speak the hint; auto-pause after 2 consecutive no-tap timeouts.
5. Cheating is trivial and free: lay any plank, watch the live "Total x of y" readout, lift and retry (planks can be taken back). Trial and error solves every round; the readout effectively shows the answer. Score is not penalised for lift-and-retry.
   Fix: from world 2, hide the running total (show only over/under colour), or charge a combo break / -score per lift after the first.
6. Game-over screen: the "Worth another go" explanation list is a clipped scroll area sitting behind the Play Again button; second card is cut mid-sentence (over.png). Not obvious it scrolls. Long text for a 9-year-old.
   Fix: show one explanation card, "See more" link; add a fade-out mask on the scroll edge.
7. Title screen: subtitle and Endless button are low contrast; "Endless (beat World 1)" is greyed and wraps to two lines, "Daily challenge" wraps; button labels collide with the truck art behind them (m_title.png). Buttons are 48px high (fine) but Grown-ups is 44x93.
   Fix: single-line labels ("Daily", "Endless" + lock icon), darken the scrim, min 48px for Grown-ups.
8. Boss fight is charming (troll, smash bar, HP bar) but tough: at ~70% accuracy a player lost all 3 lives in 90s with the boss at 4/40 HP. The "next smash" timer and the prompt compete for attention; with a drag-in tutorial hand still visible in my forced run the overlay copy "Tap the plank that fits the gap exactly" is mid-screen and distracting during boss (boss1.png).
   Fix: grant a free heart on boss entry or a heart back at phase 2; hide tutorial copy during boss; add a continue option at boss HP < 15%.
9. Goal clarity is good (prompt pill, gold gap marker, hand) but the top-of-screen sentence "Fill the gap: a plank exactly 3/4 long" is 100+ chars wide at small font, near edge of pill. A pre-reader cannot use it.
   Fix: lead with the big fraction bubble only; drop the sentence after round 3; add audio read-out.
10. Desktop 1280x800: the game is a 432px-wide portrait column in an empty screen with side text; playable but small, belt planks hard to click with low hit height. Keyboard hints good (1-8, arrows, space) but not shown in game.
   Fix: scale the column up to the viewport height on desktop; show key numbers on planks only (already there) and larger.

## Things that work
- Clear goal in under 5 seconds on round one; animated hand.
- Good juice: combo counter, floating text, boss shake and smash effects, truck falling animation.
- Wrong-answer feedback is instructive (names the misconception).
- Tap target: plank height about 40px CSS at mobile, buttons 48-64px; acceptable but plank width clipping (flaw 2) breaks it.
- No text overflow horizontally (page scrollWidth = viewport in both sizes); only h1 subtitle is clipped by design.

## Scores /10
Fun 7 | Goal clarity 8 | Pressure 6 | Juice 8 | Fairness 6 | Boss 7 | End screen 5 | Exploit resistance 3 | Layout/touch 5 | Stability 10
