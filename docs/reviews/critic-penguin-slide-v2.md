# Penguin Slide v2: independent critic + fixer pass (27 Sep, overnight)

Scope: `features/learninghub/games/penguin/` at `/dev/games/penguin-slide?unlock=all` (demo mode). Screenshots: `docs/reviews/shots/penguin-slide-v2/`.
Method: headless Playwright with real keyboard (1280x800) and real mouse/touch drag (390x844, `isMobile`), reading the sim through a dev-only hook (`window.__psGame`, only when the URL has `?debugAnswers`, never in production). A bot played as (a) a competent kid and (b) a bored kid who never steers and only answers. I read the critique doc (Claude Docs "Penguin Slide, Critique & Master Plan") and checked each point against the running game.

Checks that stayed green after the changes: `core`, `journey`, `travel`, `mtc` selftests; root `tsc --noEmit` and `server` `tsc --noEmit` both clean (the two `StudentHome`/`StudentHomework` errors are no longer present). No console errors or page errors in any run (1280, 390, Arabic RTL, calm, Explorer). No mention of the forbidden word anywhere in the game, catalogue or this doc; no green theme colour.

## 1. Critique points: genuinely fixed?

| Critique point | Verdict now | Evidence |
| --- | --- | --- |
| Quiz with a moving background; steering optional | Fixed. Travel legs have real steering, fish trails, drifts, pads, ramps, rocks. Steering earns fish (skilled bot 220-400/stage vs 65-215 for a bored kid) and dodging saves 2 fish + a stun. Stars stay accuracy-only. | `ledge-1280.png`, travel selftest |
| Gate waits forever, no stakes | Fixed as designed: thinking is untimed on the ledge, travel has consequences (hit = stun, -2 fish; wrong answer = slower scenic detour + fact signpost; boss "caught" = gentle stop). No game over. | b1s3 bored kid: 16 answers, no fail state |
| World identity was paint only | Fixed. Glacier belly-flop smashes drifts; Aurora ramps launch and tricks pay (70+ tricks/stage for a skilled bot); Caves lantern dims, crystals relight; Storm wind + moving floes that hold still on the ledge; Summit forks. All in the sim, so the server replays them. | travel selftest asserts each |
| Stage 1.1 "x2" also asked 5x9 | Was NOT fixed. Plans still leaked off-table facts (x2 stage asked 5x5, x7 stage asked 2x10, x11 stage asked 2x7). Fixed here (see 3). | before/after plan dump |
| Boss in name only | Fixed. Five bosses with faces, 3 phases (brows, mouth, gem fill), defeat moment, attack waves. | `boss-*.png` |
| Serpent/Yeti have no attack | Partly. Waves existed (rings, snowballs) but the bosses did nothing visible. Fixed the visible part (see 3). Still no "division answer aims your counter-throw". | `boss-yeti-*.png`, `boss-serpent-1280.png` |
| Finale has no set piece or ending | Ending exists (5-panel story) but was hard to reach and easy to lose (see 2). Fixed. | `finale-*.png` |
| Duplicated instructions / question shown twice | Fixed. One in-world coach line the first time each thing appears; the question shows once (pill). | screenshots |
| Text-heavy feedback | Mostly fixed: world reactions + one fact signpost after a slip. Summary is one card (stars, answered, fish, one fact). Unlock reveals are a separate one-at-a-time step. | summary shot |
| 4 lanes between lanes at start | Non-issue in the travel model (lanes only matter on the ledge). 4 lanes still used for age 9+ (server rule in `run.ts`), so a 9-year-old sees 4 pads from stage 1.1. Left as is. | |
| Camera pull-back on jumps | Missing. Added (see 3). | `jump-pullback-1280.png` |
| Economy hollow | Fixed in shape (Igloo Village, 8 buildings, 4 shop items). See section 4 for balance. Wardrobe is 15 items, not 40+. | `village-1280.png` |
| Friends to rescue, per-stage secrets, authored tracks, track editor | Secrets: one stash per stage (works). Rescue friends: not built. Tracks are weighted-random patterns per world, not hand-authored; no editor. | open |

## 2. What I found wrong (top flaws) and what I did

1. Finale unverified and fragile (real bug). It only ran from the "See what happens" button on the last boss summary. Leaving via Map/Rest skipped it, and the "seen" flag was written when it started, so a closed tab lost it forever. There was no way to watch it again.
   Fix: the ending now plays whichever button leaves the summary, the flag is written when it ENDS, and a "Watch the ending again" button appears on the map once the last boss has stars. Verified end to end with real input: beat b5s4 (12/12, 3 hits), left via Map, 5 panels played, `story` pref became `["prologue","finale"]`, replay button present and working (`finale-panel-1280.png`, `finale-replay-map-1280.png`). Old flag semantics: clear the `finale` entry of `aos.games.penguin.prefs.v1` `story` to see it again.
2. Off-table facts in stage plans (the exact "1.1 x2 asks 5x9" complaint). `selectStagePlan` (journey.ts, shared with the server) now keeps only facts with a stage table as a factor and tops up from that table's own facts. Journey selftest passes.
3. Unfair hazards.
   - Cave rocks and the Stalagmite King's rocks were placed at random x, so a group could form a wall no penguin can cross in 0.25 s (steering tops out near 3 units/s). Rock groups now always leave a straight corridor (`rockAround`, core.ts). Perfect-info bot hits per Cave stage dropped from a mean of 3 to about 1; Stalagmite King 4.4 to 0.6.
   - Boss waves overlapped (next wave started before the last one's final object): Cave-in, Blizzard and Whiteout phase 3 were physically undodgeable in places. Waves now start after their real extent plus a recovery breath (`waveExtent`). Boss runs also no longer add random rocks/pairs/forks on top of the boss's own attacks, the Whiteout uses waves a little less often, and its second corridor is never more than 0.3 from the first. Perfect-info bot hits over 14 seeds: Grumble 5.1 to 0.9, Serpent 1.7 to 2.3 (unchanged noise), Yeti 6.1 to 3.2, Whiteout 12.0 to 4.4.
   - Real-input check: all five bosses were beaten with real keys at 1280 (hits 1, 5, 1, 3, 3) and real touch drag at 390 (see 5).
4. Serpent and Yeti were static pictures. The Yeti now winds up and leans/throws toward the side of the next snowball, and the Serpent slides her head over the next aurora ring (render-only, off in reduced motion/calm).
5. Camera pull-back on jumps: 5% (ramp) to 9% (big launch) ease-out around Percy while airborne, backgrounds oversized so no edges show, disabled for reduced motion/calm (`render.ts`).
6. English-only strings: 88 `hubgames` keys (coach, world rules/twists, boss lines, reveals, village, buildings, cosmetics, story, finale, screen-reader lines) were missing in all 10 other locales. Added translations for pl ro ur ar fr es pa bn pt cy, plus the new `finale_replay` key in all 11. Placeholders verified identical per key; character names Grumble/Pebble kept in Latin script. Ur/pa/bn/cy wording is model-translated and has had no native review.
7. Phone HUD overlap: the coach bubble (top 150px on phones) covered the fish counter. Bubble now sits at the top band (below the question pill), stats moved down 34px (`phone-coach-BEFORE` vs `phone-coach-AFTER`, `phone-tutorial-AFTER-390.png`).
8. Map header wrapped "Your journey" into a 2-line column at 1280 with the buttons squashed right; buttons now take their own row (`map-1280.png`).
9. "5 x 12 is the same as 12 x 5" used a letter x in the "one to look at" card; now a real multiplication sign.
10. Travel selftest: the "belly-flop smashes drifts" assertion depended on one seed; it now sums 5 seeds.

## 3. Player-experience notes (bored 9-year-old / picky designer)

- Steering is meaningful but only through fish. A kid who never steers still passes every stage (that is by design), earns about a third of the fish, and takes 8-13 hits in Caves/Storm. Good for calm, but it means dodging has no effect on stars or on the boss.
- A wrong answer costs about 10-15 s (detour) plus a requeued question. At 75% accuracy a 10-question stage took about 3.5 minutes. Intentional, worth watching for boredom.
- Ledge settle-to-lock: after any nudge, resting in a lane for 14 ticks (0.23 s) locks the answer, and the run-out is 0.2 s. A child who touches steering, then stops to read, can commit a lane by accident. Also, releasing an arrow key or lifting a finger commits the lane you glide to. This is inherited core behaviour; I did not change it (it would alter replay semantics). Suggest raising `LOCK_TICKS` for keyboard/touch or making the auto-lock need a deliberate tap.
- Rapid-guess "Take a breath" pause triggers after 3 quick wrong taps (worked as intended for my sloppy bot).
- Summary says "You answered 8 of 11" where 11 includes re-asked questions. Reads like a failure to a child; consider "8 right, 3 to try again".
- Village is a card grid with three near-identical dome icons, not a village scene; buildings are cosmetic only. Purchasing feels unrewarded (no build animation, no visible village).
- Explorer skin is barely distinguishable from Junior in play (goggles; the map is identical).
- Calm mode: only fish objects, 10/10 stages in 54-70 s, no hazards or ramps, no errors. Fine.
- RTL Arabic (390): whole HUD, map and flop button mirror correctly, maths notation stays LTR (`arabic-*.png`).

## 4. Economy: fish earned vs price

Skilled runs earn about 220-400 fish per 10-question stage (bosses 250-330 when steered, 20-40 when the boss is played passively). A bored kid earns 65-215. Prices: buildings 60/120/200/300/450/650/900/1200 (3,880 total) plus shop 120/200/320/480 (1,120), 5,000 in all. One skilled pass through 20 stages earns roughly 5,500-6,500, so a competent kid finishes the village around the end of the story, and the first stage alone (about 250) buys the first two buildings, a good hook. A bored kid needs 40-60 stage runs, so the top-end items are effectively replay grind. Balance feels right for engaged kids; cheap for nobody, too far for passive players.

## 5. Coverage

- All 20 stages entered and played at 1280 and 390 (keyboard and touch drag respectively), several twice as the fixes landed; every boss beaten with real input at both sizes; finale reached and shown; bored-kid runs on b1s3, b3s2, b4s2, b2s2 at 1280; calm (b2s1, b3s1) and Explorer (b4s1) runs; Arabic RTL map/village/play.
- Harness caveats: the first phone runs showed 9-22 hits per boss versus 1-5 on desktop. That was a bot bug (the harness never re-pressed the finger after a lane tap), not a game bug. After fixing it, phone touch b1s4/b4s4 averaged 0-2 hits, so hazards are dodgeable on touch. A drag-steering gain change I tried made no measurable difference and was reverted.
- Not run: the e2e suite (locked queue), live tenant mode, non-Arabic locales visually (catalogue completeness verified by script).

## 6. Fixed / open

Fixed: finale reachability + replay, off-table plan facts, cave and boss hazard fairness (corridors, non-overlapping waves), Serpent/Yeti attack visuals, jump pull-back, 88 keys x 10 locales + `finale_replay`, phone coach/HUD overlap, map header, x sign, flaky travel selftest, dev-only `__psGame` hook for automated play.

Open at the end of v2 (closed in section 7 below unless marked): ledge auto-lock on rest; "answered X of Y" wording; Yeti division-aim / Serpent ring-gating mechanics from the plan; hand-authored tracks and editor; friends to rescue; wardrobe 15 vs 40+; Village as a scene with build feedback; Explorer skin distinctness; native review for ur/pa/bn/cy strings; a Playwright spec for the ending and the replay button (not added: e2e queue locked).

Files changed: `PenguinJourney.tsx`, `ui/JourneyMap.tsx`, `ui/StageSummary.tsx`, `ui/styles.ts`, `journey.ts`, `core.ts` (`rockAround`, `waveExtent`, boss pattern mix), `engine/render.ts`, `engine/bosses.ts`, `travel.selftest.ts`, `lib/i18n/messages/areas/hubgames.ts`. Nothing committed.


## 7. v3 pass: closing the still-open items (27 Sep, overnight)

Screenshots: `docs/reviews/shots/penguin-slide-v3/`. Method: headless Playwright against the dev server at 1280x800 (real arrow keys / Space / clicks) and 390x844 (`isMobile`, real pointer drag + real `touchscreen.tap`), reading the sim through the same dev-only `?debugAnswers` hook. Nothing committed, no dev server stopped, no real tenant (demo mode, `localStorage` only).

### 7.1 Ledge auto-lock (fixed): commits are deliberate now (core v3)

- The bug as reported: after a nudge, resting on the ledge for 14 ticks (0.23 s) locked the lane; lifting a key or a finger committed the lane you glided to. A child who steered, then stopped to read, could commit by accident.
- `CORE_VERSION` is now 3. In v3 `step()` locks a lane ONLY on an explicit `act` on the ledge. Resting never locks (selftest: nudge, then 40 ticks of rest, then 600 more: still unanswered; `act` locks). The gate waits as long as the child reads.
- Old logs: a saved run keeps the `cfg.v` it was played under (the server re-simulates the STORED cfg, never a fresh `makeCfg`). `isV3(cfg)` gates every v3 rule (auto-lock removal, friends, ring gate, aim, set pieces, the extra RNG draws they need), so a v2 log replays with v2 rules bit for bit; a stored config with no `v` at all is treated as legacy. Selftests: a v2 log replays identically, a config with `v` deleted is legacy, a v2 run has 0 set pieces / no ring gate / no throws.
- Client (`engine/input.ts`): moving never answers. Ways to commit: tap an answer pad (glide there, lock on arrival); tap the lane the penguin already rests in (his answer block, or the ring around him); press Space or Enter once (held/repeated keys do nothing, and an act in the first 0.3 s after reaching the ledge is ignored so mashing Space to belly-flop can never answer). Releasing an arrow key or lifting a finger after a drag only glides him to the nearest lane centre. A tap on ANOTHER lane only moves him there. A melted lane (hint fish) is never a valid commit.
- Visible confirm: once a lane is picked and he is standing still, a gold dashed ring with a tick circles him on the ice, the pad of that lane turns gold with a "Lock in" badge, and a one-line hint says how to lock in; screen readers get "Answer N picked... tap it again or press Space". No number-key shortcuts exist any more (the old `1-4` handler and the digit labels on the pads were removed; `e2e/games-penguin-slide.spec.ts` now taps the pad).
- Real-input checks: 1280 keyboard: nudge, release, 2.5 s of reading: `locked=false`, answered 0, ring + gold pad shown; Space then locks (`ledge-pending-ring-1280.png`). 390 touch: real mouse drag then release, 2 s: glided to the new lane, unlocked, 0 answered; a tap on another lane only moved him; a tap on his own lane locked (`phone-drag-released-pending-390.png`).
- A regression I introduced and caught while testing (fixed): removing the release-to-commit also removed the release-to-recentre; a released key left him against the wall. Releasing now always glides him to the centre of the lane he would rest in.

### 7.2 Summary wording (fixed)

The summary counted re-asked questions ("answered 8 of 11"). It now says what a child can feel good about: "All 10 right first time!" or "8 right first time", plus a quiet "Still to practise: 3" when some came back. Numbers are the first-time answers only (`firstTry` / `firstTryCorrect`, added to the run result by `record.ts`; the same numbers feed the screen-reader line). Count-free wording, so no plural forms are needed in any locale (`summary-1280.png`).

### 7.3 The planned mechanics (built, in the sim so the server replays them)

| Mechanic | What it does | Evidence |
| --- | --- | --- |
| Yeti division-aim (Blizzard Yeti, Storm Pass boss) | A RIGHT division answer aims your counter-throw at the lane you stood in; the Yeti's next attack wave is built around that spot (its two flanking snowballs sit either side, gap centred on it, clamped to +-0.45). Multiplication answers do not aim. A snowball arcs from Percy to the Yeti and a line says what happened. | travel selftest replays a b4s4 run and checks the next wave's gap at every throw (all match); a real-keyboard run showed the toast and the aimed wave (`boss-yeti-aim-toast-1280.png`) |
| Serpent ring-gating (Aurora Serpent, Aurora Ridge boss) | Each stretch of ice has aurora rings. Slide through at least half of them and your right answer hits her weak spot fully; miss too many and her shield holds (half a hit). Stars are unchanged (answers only); a child who never steers can still clear the stage but cannot finish her. Rings 3/10 chip while travelling; a line after each answer says which. | selftest: skilled child beats her, the shield holds far more often when you do not steer (43 of 96 answers sealed vs 90 of 96), stars identical, v2 runs have no gate. `boss-serpent-rings-chip-1280.png`, `boss-serpent-shield-toast-1280.png` |
| Rescue friends | One friend per stage is frozen in ice on the track (a seal, fox, mole, puffin or snow hare by world). A belly-flop (or a landing) cracks it. The freed friend slides beside Percy for the rest of the run, reaches for fish farther and takes the first bump for him (never anything to do with the answers, so stars are untouched). A boss stage frees its friend when the boss is beaten. Freed friends are remembered on the device and move into the Igloo Village and count toward outfits. | selftest: a skilled child frees the stage friend in most runs, one who never flops rarely does, beating a boss always frees it; `friend-ice-1280.png`, `friend-helping-1280.png`; summary line "You freed a friend!" |
| Hand-authored set pieces | `config.ts` has a tiny authoring format: a piece is an array of 9-character strings, one per row across the ice (`o` fish, `R` rock, `B` snowball, `d` drift, `=` pad, `^` ramp, `*` sky fish, `c` crystal, `~` ring). 23 pieces, 4-5 per world, plus `STAGE_SCRIPT` naming the pieces each stage opens with (leg by leg). After the script the world's weighted mix (which now includes its own pool of pieces) takes over. `validateSetPiece` (run by the travel selftest) rejects unfair pieces: bad width, unknown characters, no way through with at most one column of sideways movement per row, fewer than 3 safe columns in a row with a rock. | selftest asserts all 23 valid, every scripted id exists in the stage's own world, and a Caves stage opens with authored pieces. Hazard fairness kept: skilled-bot hits per stage (12 seeds) stay 0.2-0.9 on ordinary stages (Caves 0.3-0.7, Storm 0.4-0.7, Summit 0.8-0.9; the v2 fairness pass had Caves at about 1), bosses 0.5-4.6. `setpiece-b1s3-1280.png` shows the Glacier belly-flop wall. |

Tuning notes: my first drafts of six pieces were unfair (a bot hit 12-52 rocks in them); the fairness rule above came from that. Piece rows are 3.4 world units apart (about 0.17 s of sliding).

### 7.4 Igloo Village (fixed): a real scene, with building and 40 outfits

- A side-view scene (SVG): night sky, drifting aurora, mountains, two rows of 12 plots on the snow, friends wandering between the buildings. 12 buildings (the old 8 plus Snug Hut, Ice School, Star Watch, Glacier Bridge), each with its own drawing (market stall with awning and fish, bakery with smoking chimney, sled shed with sleds, story igloo with books, school with flag, striped lighthouse with a sweeping beam, rink with a skater, observatory with telescope, steaming rose hot spring, lit bridge, town-square fountain with flags).
- Place-on-tap: choose a building in the strip (Build for N), the empty plots pulse gold, tap the one you want. Old saves that only had a list of built buildings are placed automatically. Build animation: it rises out of the snow with a squash-and-settle, dust puffs and gold sparkles (off in reduced motion / Calm). Plots and buildings are keyboard-reachable. 390: the scene scrolls sideways, the strip sits above it so pick and place fit on one screen (`village-*-1280.png`, `village-*-390.png`).
- Wardrobe: 15 to 40 items, in a new fifth slot (Back) as well as hat / scarf / trail / sled. Every item is EARNED: facts secured, stars, bosses, 3-star stages, friends freed, buildings built, or fish collected by playing (4 items). No random prizes and nothing is bought with money. Items unlocked by things only the device knows (friends, buildings, fish) are never handed out by the server. `wardrobe-contact-sheet-junior.png` / `-explorer.png` show all 40.

### 7.5 Explorer skin (fixed): clearly not Junior

Junior is unchanged. Explorer (Settings, "Look") now differs in every layer: palette (colour drained by about 40% and a steel-blue wash on the world, darker cards, amber instead of candy gold, topographic lines on the map), typography (condensed capitals for titles and buttons, condensed sans on the answer blocks), shapes (square corners, flat shadows, angular blocks instead of pillows), the mascot (a leaner expedition penguin: no blush, steadier narrowed eyes with a brow, no tongue, fur-trimmed hood with goggles pushed up, a pack; the mascot on the menu screens is the same penguin drawn standing, not the bouncy cartoon one) and copy tone (27 keys have an Explorer wording: "Run complete." instead of "Nice sliding!", "Base Camp", "Kit", "Expedition", "Go again"; the catalogue key `<key>__x` overrides `<key>` when Explorer is on). See `skin-junior-*` against `skin-explorer-*`.

### 7.6 Playwright spec (added, not run through the suite queue)

`e2e/games-penguin-ending.spec.ts` (demo mode, no accounts): (1) plays the last boss by tapping the right pad at each ledge (the last stage's blocks drift, so it waits for the ledge and reads the live lane), leaves by Map, and asserts the 5-panel finale plays, the `finale` flag is written only when it ENDS, and the replay button then exists; (2) the map's replay button plays the ending again, skip works, progress data in `localStorage` is byte-identical afterwards, and a second replay runs to the end. It is picked up by the suite (`*.spec.ts` in `e2e/`). I did NOT wait on the jammed queue: I ran the file directly with a throwaway config that has no setup project and reuses the running dev server: 2 passed (2.7 min).

### 7.7 Translations (fixed for the new strings)

97 keys in `lib/i18n/messages/areas/hubgames.ts`, all 11 locales (89 new, 8 existing lines reworded: controls, the catch mechanic line, the first coach line, the end-of-run screen-reader line, the two boss lines, the village subtitle, the wardrobe hint): lock-in, summary, friends, rings and boss lines, village text and 4 building names, 25 wardrobe item names + the new slot + 3 lock reasons + the count, toasts, and 27 Explorer wording overrides. Placeholders verified identical per key by script; no green colour word, no forbidden word. The wording is model-translated: ur, pa, bn and cy in particular have had no native review; a few coinages worth a glance are Welsh hats, Urdu earmuffs, the "Base Camp" word in Explorer, and the Star Watch / Glacier Bridge names. Checked in the browser in Arabic (RTL) and Welsh at 390: `i18n-ar-*`, `i18n-cy-*`.

### 7.8 Checks

`core`, `journey`, `travel`, `mtc` selftests pass (new assertions: v3 no auto-lock, v2 legacy, missing-version legacy, 40 wardrobe items and unlock rules, set-piece validity, friends, ring gate, aim). Root `tsc --noEmit` and `server` `tsc --noEmit` are clean. No console or page errors in any run.

### 7.9 Fixed / open

Fixed: ledge auto-lock and release-commit (core v3 + client + selftests + legacy logs), summary wording, Yeti division-aim, Serpent ring-gating, rescue friends who help and join the village, hand-authored set pieces with an authoring format and validator, Village as a scene with build animation, place-on-tap and 12 distinct buildings, wardrobe 15 to 40 earned items, Explorer skin, the ending spec, all new strings in 11 locales.

Open:
- Native review of the model-translated wording (ur, pa, bn, cy first).
- The new ending spec has not run inside the full e2e suite (queue jammed); it passes standalone. `games-penguin-slide.spec.ts` was edited (tap the pad instead of a number key) but not re-run.
- No graphical track editor: set pieces are authored as text in `config.ts` (validated by the selftest). Stage scripts cover the 16 non-boss stages; boss stages use their attack waves only.
- Villages and freed friends live on the device (like the fish spent), not on the server; a lost device loses them. Only the friend-freed flag per run reaches the run result.
- A child who never steers cannot finish the Aurora Serpent (the stage still clears and stars are unaffected). This is the intended meaning of "ring gate", but worth a look in playtest.
- Real v2 sessions already stored in Firestore were not replayed on the live server (only unit-tested for equivalence).
- Explorer text in Punjabi, Bengali and Urdu uses the same font stack fallback (the condensed capitals only apply to Latin script).
