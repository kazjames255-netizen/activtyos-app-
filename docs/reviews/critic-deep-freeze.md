# Critic review: Deep Freeze (campaign)

Artifact: https://claude.ai/artifact/1P2awBfs7GmchxSTDei4zL (version 2 after this pass)
Source: scratchpad `deep-freeze-campaign.html` (published copy `deep-freeze-campaign-pub.html`).
Method: Playwright (real mouse, touch context, keyboard) at 390 and 1280, console watched (0 errors throughout), all six arenas played with real pointer input, boss stages, defeat path, finale, Junior + Calm smoke.

## Verdict on the questions
- Quiz with skins? No. Six arenas each run a real rule (heat diffusion, friction/momentum/collisions, circuit loops, reflection angles, downhill flow, pendulum inertia). Answers are objects in the world and there are no number-key shortcuts (checked the key handlers). Weakest is Thaw: heat only gates *reading* the answers, it never shapes which answer is right.
- Stakes without timers: flames (3, Junior 5), no clocks anywhere. Good.
- Bosses: distinct pattern per world (frost breath re-freezes, curling stones, dark cave, fixed coil mirrors, split spring, all rules). Bosses have intro and defeat lines but are only a 56px portrait during play.
- Economy: crystals earned only, sinks are rule-specific tools, cosmetics, camp, Lens. Meaningful.
- Map with accuracy stars, Calm mode (auto for reduced motion), Junior/Explorer, weekly rest days, visits, daily challenge, ghost row: present and working.

## Top 10 flaws found
1. Finale was a text box: beating Frostcore showed the normal results card plus one line. No ending. (`#ovStory` existed but was never used.) FIXED.
2. Overlay cards taller than the stage had their top clipped and unreachable (`align-content:center` with overflow). FIXED (`safe center`).
3. Boss defeat card: portrait rendered ~30px (flex shrink), and a replay of a boss said just "Stage clear". FIXED.
4. First-run brief was a wall: story + rule + how-to + twist + fine print before the first touch. FIXED: how-to and keys fold into a "How to play" disclosure, fine print is one line.
5. Junior only removed one option. It kept Year 9 items and number generators. FIXED: Junior uses the easiest ~65% of a world's facts and no generators.
6. Frost Lens (paid wrong-answer removal) worked on bosses, undermining the boss stakes. FIXED: disabled in boss fights, stated in the brief and camp.
7. Locked worlds on the map said only "Locked", no teaser. FIXED: "Locked · Sweep/Flick/Turn..." verb shown on the node (full teaser card already existed on tap).
8. Save failures (private window, storage off) were silent, so a child could lose everything. FIXED: visible notice on the map.
9. No way to revisit the ending. FIXED: "Watch the finale again" in Camp once finished.
10. Thaw (world 1) is closest to a scratch card: rule is real but not consequential to the answer. OPEN.

## Still open
- Thaw consequence idea: dense ice that refreezes if left, or an answer that must be kept warm while carried.
- Boss presence in play is small; a large reacting portrait beside the arena on desktop would help.
- Crane crate at x=47 sits close to the left wall; tiny crate labels at 390 for long chemistry answers.
- Circuit generator always routes to the correct bulb; a sharp child could infer the answer from the path shape before reading. Consider decoy paths to wrong bulbs.
- Desktop play column is narrow (portrait canvas) with empty sides.
- Real touch feel and audio balance unverified on device. Keyboard heating in Thaw works but is slow by design of the step size.

## Re-critique (after fixes)
Regression at 390: stage 2 of worlds 1 to 5 played with pointer input, no console errors; finale, results, boss result, Junior/Calm smoke across all six arenas, flow ridge/rocks stages all pass. Nothing new blocking.
