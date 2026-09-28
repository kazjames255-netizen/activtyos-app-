# 03 - Game concepts for the Learning Hub (30 originals, ranking, launch line-up, #1 spec)

Author: designer/researcher pass. No code changed. Repo facts used: 23 curriculum packs / 4,679 questions (`server/src/curriculum/*`, kinds single/multi/short/number/written, plus order/match/tool in the bank), 102 catalogued tools (`features/learninghub/tools/registryData.ts`; runnable ones: ruler/protractor/grid, geometry board, angle facts, graph/DataGraph, equation balancer, formula calculator, periodic table, label diagrams, FrameWriter/TimedWriting, VerbTrainer/SentenceBuilder/Agreement/Gender/Numbers trainers, CardSort/Sequencer/VennSort), SM-2 flashcards (`hubFlashcardReviews`: easeFactor, intervalDays, repetitions, nextDueAt), mastery (`hubMastery` from `hubAttempts.byTopic{topicId:{got,max}}`, last 5 slices weighted 0.5^i), live rooms + whiteboard (`live/board`), in-person shared-tablet class (`inperson/`), kid mode + stars/streak (`family/`), mascot penguin (`mascot/`).

Evidence base (used in the "why it teaches" lines):
- Retrieval practice beats restudy for multiplication-fact fluency, short and long term: https://onlinelibrary.wiley.com/doi/10.1002/acp.4141 ; overview https://my.chartered.college/impact_article/learning-using-and-applying-multiplication-facts-insights-from-research/
- Retrieval + spacing + interleaving (EEF cognitive-science review): https://www.sec-ed.co.uk/content/best-practice/a-teacher-s-guide-to-retrieval-practice-interleaving ; https://evidencebased.education/resource/retrieval-and-spaced-practice-study-strategies-that-must-be-combined/
- Game-based arithmetic fluency training: https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2019.00118/full
- Worked examples and guidance fading (cognitive load; Rosenshine): https://thirdspacelearning.com/blog/rosenshine-principles/ ; https://www.innerdrive.co.uk/blog/guide-rosenshine-10-principles/

## 0. Shared platform contract (applies to every concept unless overridden)

**Game session record (new, small).** One `hubGameSessions` doc per play: `{tenantId, franchiseId, childId, gameId, mode, startedAt, endedAt, items[{itemId, source:"bank"|"gen"|"card", questionId|cardId|genSeed, topicId, difficulty, response, correct, latencyMs, hintsUsed, attempt#}], byTopic{topicId:{got,max}}, calm:boolean}`. Server-side only marking/generation (repo rule: domain logic never in the browser); the browser asks `POST /api/learning-hub/games/session` for a seeded item list and `POST .../games/session/:id/submit` with responses.
**Mastery reporting.** On submit the server writes a `hubAttempts` row with `assessmentType:"game"` and `byTopic` from the session so existing `computeTopicMastery` picks it up. Proposal to protect data quality: game slices count at reduced weight (e.g. x0.5) and speed never enters `got` (latency is stored separately for the tutor, never scored into mastery). Diagnostic/baseline logic ignores `"game"`.
**Item sources.** (a) bank `hubQuestions` by `topicId` + `difficulty` + year (`CQuestion.key`, e.g. `npv-y4-11`); (b) generators (extend `tools/problems.ts`, `tools/engine/rng.ts` seeded RNG, `fractions/bars.ts`, `languages/verbs/conjugate.ts`, `grammar/nouns.ts`, `science/equations/bank.ts`, `science/data/experiments.ts`); (c) flashcards (`hubFlashcards` + SM-2).
**Modes (default matrix).** Solo (kid mode) | 1:1 with tutor (tutor sees live item stream in the board sidebar, can pin a topic or freeze) | Live class (host starts, kids join with the code; results to host) | Pair | In-person shared tablet (`inperson/` pass-and-play, teacher captures) | Homework 5-min (a `hubHomework` item pointing at gameId + topic set; completion = N items or 5 min).
**Input.** Touch first, full keyboard equivalents (number keys, arrows, Enter). No drag-only interactions; every drag has a tap alternative.
**Art/theme.** Penguin mascot (from `mascot/`) on navy (`--surface`), blue accents, gold for success; never hardcoded colours; friendly, slow easing; sound off by default with a toggle.
**Difficulty adaptation (default).** Item difficulty 1-3 from the bank; a "staircase": 3 correct at level -> up, 1 wrong -> stay, 2 wrong in a row -> down plus a worked-example card. Fast-and-right advances faster; slow-and-right stays (this separates fluency from reasoning).
**Rewards (intrinsic, no dark patterns).** Mastery-visible progress (a fact "thaws" from ice to gold when secure), a personal-best against your own past self, cosmetic-free collection of learned things (sticker book already exists: `503c14af`). No loot boxes, no streak-loss punishment (streak freezes automatically), no countdown scarcity, no leaderboards among strangers, no ads, no notifications begging return.
**Calm variant (default).** Timer removed (accuracy-only), motion reduced (respects `prefers-reduced-motion`), sound off, one item on screen, no score flashes, "take a breath" pause button always visible, gentler wrong-answer copy.
**Complexity key.** S = 1 sprint on existing components; M = 2-3 sprints; L = a quarter-part with new server model; XL = multi-quarter / realtime.

---

## A. Fluency games (5)

### 1. Penguin Slide (times tables ice slide)
- **Hook:** Pip slides down an ice run and the answer you pick steers which lane she takes; right lanes pick up fish, wrong lanes just slow her a little.
- **Core loop (5 s):** read `7 x 8`, tap one of 3 lanes labelled with answers (or press 1/2/3); Pip glides; next fact.
- **Learning mechanic:** retrieval practice with immediate correct-answer display; facts drawn from a per-child "thaw map" so weak facts recur sooner (spacing, per fact) and tables are interleaved once each is 70 percent secure; distractors are misconception-targeted (adjacent-table answers 7x7=49 for 7x8, off-by-one-group, digit swaps). Trains automaticity, not reasoning. Evidence: retrieval > restudy for multiplication facts (Wiley link above).
- **Curriculum:** Maths KS2 Y3-Y4 `md` (Multiplication & Division, `ks2maths/md.ts`, e.g. tables 2,3,4,5,6,7,8,9,10,11,12 and division facts), KS1 `md` (2,5,10), reversed for Y5-Y6 `md` (factors/multiples). Related `npv` counting in multiples (npv-y4-12 count in 9s).
- **Data:** generator `facts(table set, a, b)` server-side (bank md questions used for word-problem "story lane" every 8th item). Reports `byTopic["md"]`; per-fact `{a,b,latencyMs,correct}` in items; writes into the child's thaw map (`hubFactState`: per fact easeFactor/intervalDays reused from SM-2 shape).
- **Modes:** solo; 1:1 (tutor pins tables); live class "Slide-Along" (all kids same seed, individual pace, host sees heat map of hard facts); pair (alternate runs); in-person tablet pass-and-play; homework 5-min (20 facts).
- **Session:** 3-5 min, 20-30 facts.
- **Input:** tap lane / keys 1-3 / typed answer mode for Y5+ (no options, harder).
- **Art:** snow-slope side view, gold fish, Pip leans into turns; quiet arctic ambient.
- **Adaptation:** table set expands only as previous tables reach thaw threshold; time-to-answer target starts generous (6 s) and tightens to a personal 3 s only once accuracy > 90 percent.
- **Reward:** facts visibly thaw ice -> gold on a table grid; personal best "fish in one run"; end screen shows "3 facts you got faster on".
- **Calm:** no timer, lanes stationary, no speed bonus, 12 facts.
- **Tutor insight:** which SPECIFIC facts are slow-but-correct (retrieval by counting) vs wrong (misconception), e.g. "7x8 correct but 5.8 s, uses skip counting".
- **Complexity:** M. Fact generator + thaw map + one canvas/CSS view. **Risks:** speed pressure/anxiety (mitigated by calm mode and never showing time to child as a failure); one-hour cap suggestion; accidental gamed lane-guessing (3 lanes = 33 percent; use 4 lanes for Y5+ and require typed for review runs).

### 2. Bond Igloos (number bonds)
- **Hook:** Fit the missing block: each igloo needs blocks that make exactly 10 (or 20, 100).
- **Loop:** an igloo shows 6 blocks, tap/drag the number of blocks (or a numeral) that completes the wall to 10.
- **Mechanic:** retrieval of bonds with concrete-pictorial-abstract fading: Y1 shows blocks, later shows only numerals, then bonds within 100 (25+75). Interleaves add and subtract complements (10-4).
- **Curriculum:** Maths KS1 `as` (Addition & Subtraction, Y1-Y2), `npv`; KS2 `as` (Y3-Y4 bonds to 100/1000 via `npv`, `as`).
- **Data:** generator bonds(n in {10,20,100,1000}); bank `as` questions for word-problem igloos. `byTopic["as"]`.
- **Modes:** solo; 1:1 (tutor sets target sum); pair (build one igloo together); in-person tablet; homework (15 igloos); live "Igloo Village" (class fills a village).
- **Session:** 3-4 min. **Input:** tap/drag with tap alternative; number pad.
- **Art:** stacking ice blocks, warm gold window lights appear per completed igloo.
- **Adaptation:** fade blocks -> numerals; bonds not yet fluent returned via SM-2 style intervals.
- **Reward:** village grows; "all bonds to 10 lit" badge based on mastery not time.
- **Calm:** untimed, one igloo at a time, gentle chime.
- **Tutor insight:** whether the child counts up from the given number (latency scaled by size of missing part) vs recalls; does 10-6 differ from 6+?=10.
- **Complexity:** S. **Risks:** low ceiling for older pupils; keep to Y1-Y4.

### 3. Sound Fishing (phonics and spelling)
- **Hook:** Pip fishes for the letter groups that spell the sound she hears.
- **Loop:** hear the word (TTS `speak.tsx`), see a pond of grapheme "fish" (ai, ay, a-e), tap the ones that fit; complete the word.
- **Mechanic:** retrieval of grapheme-phoneme choices with contrastive minimal pairs (rain/rane/rayn) - targets the spelling misconception "which spelling of this sound"; interleaves phase sets.
- **Curriculum:** English KS1 `phon` (Phonics & Word Reading), `spell` (Y1-Y2); KS2 `spell` (Y3-Y4 statutory lists, prefixes/suffixes).
- **Data:** bank `phon`/`spell` short/single items; generator builds foils from confusable grapheme sets. `byTopic["phon"|"spell"]`; item stores chosen foil for error type.
- **Modes:** solo; 1:1 (tutor reads the word aloud - important for the youngest); in-person tablet; homework 5-min (10 words); pair (one hears, one spells).
- **Session:** 4 min. **Input:** tap; keyboard for KS2 typing mode.
- **Art:** pond with ripples; fish wobble slowly.
- **Adaptation:** reveals the word's morphology hint after 2 misses; drops back to fewer foils.
- **Reward:** "word collection" of secured words in the sticker book.
- **Calm:** two foils only, unlimited replay of sound, no scoring flash.
- **Tutor insight:** error pattern (e.g. always picks `ay` mid-word) is a phonics gap, not a random slip.
- **Complexity:** M (TTS quality, foil generator). **Risks:** TTS pronunciation accuracy of UK phonemes; need recorded audio for pure phonemes; licence checks.

### 4. Tide Clock (telling the time and durations)
- **Hook:** Tide times decide when the penguins can fish: set the clock hands to match.
- **Loop:** given a time in words or a digital clock, drag the hands (or tap +5/+1 buttons) to match; next asks "how long until".
- **Mechanic:** retrieval + interleaving of analogue/digital/24-hour/durations; misconception targeting (hour hand between numbers, "quarter to" read as quarter past).
- **Curriculum:** Maths KS1 `meas` Y1-Y2 (o'clock, half past, quarter), KS2 `meas` Y3-Y4 (24-hour, Roman numerals - `npv` Y5 roman note), Y5 timetables.
- **Data:** generator `clockFaces()` + bank `meas` questions with images. `byTopic["meas"]`.
- **Modes:** solo; 1:1; pair; in-person tablet (physical clocks + digital match); homework.
- **Session:** 4 min. **Input:** drag hand with +/- tap alternative; keyboard arrows.
- **Art:** harbour clock tower; sea level rises/falls on the fish-bar.
- **Adaptation:** o'clock -> half -> quarter -> 5-min -> minute.
- **Reward:** clock shows gold hour markers as each type is secure.
- **Calm:** untimed, snap-to-5 assist, no red.
- **Tutor insight:** which hand the child reads first; whether errors are hour-hand vs minute-hand.
- **Complexity:** M (interactive clock). **Risks:** dragging hands on touch precision; snap assist needed.

### 5. Deep Freeze (flashcard spaced-repetition made playful)
- **Hook:** Facts that are wobbling get "frozen" in a glacier by remembering them at just the right moment.
- **Loop:** card front appears, child answers (tap to flip or type), self-grades Again/Hard/Good/Easy or is auto-marked for typed cards; card slides into a glacier layer.
- **Mechanic:** SM-2 spacing + retrieval; adds a "confidence before reveal" tap (sure/not sure) so hypercorrection (confidently wrong) is highlighted. Works for any subject: vocab, science definitions, language words.
- **Curriculum:** every pack has flashcards (8-12 per topic-year); e.g. `science-ks4` `c4atom`, `french-ks2-3` `frnum`, `english-ks3` `vocab`.
- **Data:** reuses `hubFlashcards` and `hubFlashcardReviews` via existing `flashcardsApi.ts` (`quality` 1/3/4/5) - so no new marking; adds `confidence` field to review. Maps card topic to `byTopic` (card correct = quality>=4 counts got).
- **Modes:** solo; 1:1 (tutor sees which cards hypercorrected); homework 5-min (`flashcardTopicId` already in `hubHomework`); pair "quiz each other"; in-person (paper-like cards).
- **Session:** 5 min, <=20 cards. **Input:** tap/keys 1-4.
- **Art:** layers of blue glacier; each card sinks deeper when interval grows.
- **Adaptation:** SM-2 does it; daily cap prevents overload.
- **Reward:** glacier depth = total days of durable memory (a genuine metric); "cards that will be fine for a month".
- **Calm:** default calm-ish; no timers ever.
- **Tutor insight:** confidently-wrong cards = misconceptions; cards repeatedly Again = re-teach.
- **Complexity:** S-M (uses existing API). **Risks:** self-grading honesty for young children; use auto-mark for typed answers.

## B. Reasoning / problem-solving games (6)

### 6. Fraction Ferry
- **Hook:** Load the ferry so both banks are fair: share the cargo into equal parts, compare, and balance.
- **Loop:** drag fraction bars (from `fractions/bars.ts`) onto scales; choose the bar that makes the ferry level; then equivalent/compare/add.
- **Mechanic:** concrete-pictorial-abstract with fading: bars shown -> partially shown -> numerals only. Targets misconception "bigger denominator means bigger fraction" and "add numerators and denominators".
- **Curriculum:** Maths KS1 `frac` (Y1-Y2 halves/quarters), KS2 `frac` Y3-Y6 (equivalence, add mixed numbers frac-y6-11, decimals frac-y5-11), KS3 `num`.
- **Data:** bank `frac` items + bar generator; misconception tag on distractors. `byTopic["frac"]`.
- **Modes:** solo; 1:1 (tutor manipulates same bars in shared board); pair; in-person tablet with physical fraction wall; homework.
- **Session:** 6-8 min. **Input:** drag with tap-to-place alternative.
- **Art:** ferry on level fjord; balance bar glows gold.
- **Adaptation:** bars visible -> hidden; denominators up.
- **Reward:** ferry route map unlocked by topic mastery (map = curriculum coverage view).
- **Calm:** no ferry sway.
- **Tutor insight:** which representation the child needs (bars vs number line vs numerals).
- **Complexity:** M-L (new interactive; bar generator exists). **Risks:** touch dragging on small screens.

### 7. Balance the Floe (equation solving as balance)
- **Hook:** Keep the ice floe level while you do the same thing to both sides.
- **Loop:** an equation as a two-pan balance; choose an operation ("subtract 3 from both sides"), watch it stay level, aim for `x = ?`.
- **Mechanic:** worked-example fading: first the game solves a level with the child choosing only the operation, then the child chooses operation and value, then types the solution with the balance hidden. Targets "change sign when crossing" misconception; teaches inverse operations.
- **Curriculum:** Maths KS3 `alg` (linear equations Y7-Y9), KS4 `alg` (unknowns both sides, brackets, rearranging), KS2 `alg` (Y6 simple formulae, one/two step).
- **Data:** generator of equations by structure (ax+b=c, ax+b=cx+d, brackets), bank `alg` items for the final "typed" phase. `byTopic["alg"]`; item stores the operation sequence chosen (process data).
- **Modes:** solo; 1:1 (tutor lets the child drive, tutor watches step choices); pair; homework; live "Floe Race" cooperative (class solves one equation in rounds).
- **Session:** 8 min. **Input:** tap operation buttons; keyboard for values.
- **Art:** pans as ice slabs, penguins as weights.
- **Adaptation:** scaffold ladder above; hidden after 3 clean solves.
- **Reward:** "solved with fewer steps" is a reasoning metric, shown privately.
- **Calm:** no timer; balance tilt animation reduced.
- **Tutor insight:** actual reasoning steps chosen; wrong operation types reveal the specific misconception.
- **Complexity:** M-L. **Risks:** equation generator must guarantee integer solutions and uniqueness (use server-side checks; `tools/science/equations` and `tools/engine/marking.ts` patterns).

### 8. Iceberg Detective (find the error in a worked solution)
- **Hook:** Pip's homework is wrong somewhere; tap the exact line where the mistake begins.
- **Loop:** read a 4-6 line worked solution, tap the first wrong line, then pick what should have happened.
- **Mechanic:** erroneous-example effect (misconception targeting + retrieval of the correct method); strong transfer because learners must generate the rule. Errors are sourced from the bank's distractors (each distractor is a real misconception) so the "wrong solution" is the path to a wrong option.
- **Curriculum:** any maths pack: KS2 `frac`, `as`, `md`; KS3/KS4 `alg`, `num`, `geo`; KS5 `algf`, `diff`, `proof`; science calculations `c4quant`, `p4energy`.
- **Data:** generator builds solutions from bank item + its explanation + a distractor -> a faulty chain; requires an authored `steps[]` field (new optional on `CQuestion`; start with 300 authored solutions, LLM-assisted then QA'd per QA_LOG discipline). `byTopic` counts found-error-line correctness and repaired-step correctness separately (two marks).
- **Modes:** solo; 1:1 (best: tutor discusses); pair; live class (whole class votes the line, results as bar chart on the host screen); in-person; homework 5-min (5 detectives).
- **Session:** 5-8 min. **Input:** tap line; keyboard arrows.
- **Art:** iceberg cross-section: the visible tip is the answer, the mistake lurks below the waterline; magnifier tool.
- **Adaptation:** subtle errors (sign slip) at higher levels; obvious ones lower; interleaves topics.
- **Reward:** case-file notebook of "mistakes I can now spot" (each one linked to a misconception name).
- **Calm:** one case at a time, no timer.
- **Tutor insight:** highest-value: which misconception the child fails to detect and which they detect only in others' work (self-blindness).
- **Complexity:** M (content authoring is the cost). **Risks:** QA of faulty steps (must be unambiguous, single first error); avoid teaching the wrong method by memorability - always end with the correct worked line.

### 9. Shape Riddle Cave (deduction with yes/no questions)
- **Hook:** A hidden shape sits in the cave; ask Pip yes/no questions about its properties to identify it in as few questions as possible.
- **Loop:** choose a question ("has parallel sides?", "all angles equal?"), see yes/no, shapes fade from the candidate grid; name the shape.
- **Mechanic:** reasoning with properties/classification (Venn-style elimination); vocabulary retrieval; a scoring incentive for information gain, not guessing.
- **Curriculum:** Maths KS1 `shape` Y1-Y2, KS2 `shape` Y3-Y6 (2-D/3-D properties, quadrilaterals), KS3 `geo`.
- **Data:** shape property table (small static data, server-side) + bank `shape` items for the follow-ups. `byTopic["shape"]`.
- **Modes:** solo; 1:1 (tutor is the cave keeper: hides a shape, answers questions); pair (one hides, one asks); in-person with physical shapes; homework; live (class vote on next question).
- **Session:** 5 min. **Input:** tap; keyboard.
- **Art:** cave with torch beams; shapes as ice carvings.
- **Adaptation:** more shapes/properties; 3-D added.
- **Reward:** "fewest questions" personal record only.
- **Calm:** no question limit.
- **Tutor insight:** what property vocabulary the child actually uses vs recognises; do they ask discriminating questions.
- **Complexity:** S-M. **Risks:** subtle property definitions (e.g. is a square a rectangle) must match KS2 spec wording.

### 10. Krill Kitchen (ratio and proportion scaling)
- **Hook:** The recipe feeds 4 penguins, but 10 are coming: scale it and do not run out of krill.
- **Loop:** adjust an ingredient tile; a ratio table updates as you change one column; find the missing amounts.
- **Mechanic:** proportional reasoning through the ratio table (worked-example fading: table given -> table half empty -> blank). Contrasts scaling (multiplicative) with additive misconception ("add 6 to everything").
- **Curriculum:** Maths KS2 `rp` Y6, KS3 `rp` Y7-Y9, KS4 `rp` (best-buy, direct/inverse proportion); `frac`.
- **Data:** bank `rp` items + recipe generator; `byTopic["rp"]`; stores chosen strategy (unit method, scale factor, additive - the last is flagged).
- **Modes:** solo; 1:1; pair; homework; in-person with real recipe cards.
- **Session:** 6 min. **Input:** typed numbers; tap.
- **Art:** kitchen counter, cosy warm gold lights.
- **Adaptation:** whole-number scale factors -> fractional -> inverse.
- **Reward:** cookbook page of recipes solved.
- **Calm:** no plate-timer.
- **Tutor insight:** which strategy the child uses; additive-misconception flagged immediately.
- **Complexity:** M. **Risks:** rp bank is small (rp KS2 has 10 items), needs generator.

### 11. Proof Ladder (KS5 proof/argument construction)
- **Hook:** Rebuild a broken ladder of reasoning: order and justify the rungs of the proof.
- **Loop:** drag proof steps into order, then pick the justification for each (given, definition, previous line).
- **Mechanic:** worked-example-based learning for proof; discriminates valid vs invalid deduction; exposes "assume what is to be proven".
- **Curriculum:** Maths KS5 `proof` (Y12-Y13), `seq`, `algf`; KS4 `alg` (algebraic proof).
- **Data:** uses `order` kind (Sequencer.tsx exists); authored proofs in bank as `order` items with justifications; `byTopic["proof"]`.
- **Modes:** solo; 1:1 (very good with tutor); homework; live class (compare orderings).
- **Session:** 8-10 min. **Input:** drag with tap-to-move alternative.
- **Art:** ladder into a starlit sky; each rung glows on being justified.
- **Adaptation:** fewer given rungs.
- **Reward:** proof "library" of techniques (direct, contradiction, counter-example).
- **Calm:** untimed.
- **Tutor insight:** whether the child holds the logical structure or is pattern-matching layout.
- **Complexity:** M (Sequencer exists; content is authoring). **Risks:** small audience; multiple valid orders must be accepted.

## C. Live-class competitive / cooperative (4)

### 12. Penguin Relay (team fluency relay)
- **Hook:** Teams of 3-4 pass a baton by answering in turn; a team only advances when the current runner is correct.
- **Loop:** the current runner sees a question and answers; correct -> baton to teammate; wrong -> a teammate can "coach" once with a hint chip.
- **Mechanic:** retrieval in a low-stakes team context; peer explanation; per-child items are individual, so mastery attribution is per child. Interleaves difficulty so no one is starved.
- **Curriculum:** any pack topic set chosen by host (e.g. Maths KS2 `md`, `frac`; French `frnum`).
- **Data:** live room join code (existing live-lesson infra: `hubLessons.roomName`, presence) + a game channel over existing SSE realtime (`lib/realtime.ts`); items from bank by topics and difficulty; results written per child.
- **Modes:** live class primary; also in-person tablet (teams share tablets).
- **Session:** 10-15 min. **Input:** touch/keys.
- **Art:** arctic track, baton = gold fish.
- **Adaptation:** each child's item difficulty individually adapted; team pace balanced by "runner difficulty" not by rank.
- **Reward:** team "distance" only against the class's own previous best; everyone sees the same finish line; no rankings of individuals.
- **Calm:** relay with no timer, "steady walk" variant.
- **Tutor insight:** who coaches, who defers; who is silent in a team (soft signal).
- **Complexity:** L (realtime room, teams). **Risks:** competitive shame for slow children (mitigate: team-only score, anonymous stats), connectivity, cheating (server-side answer checks).

### 13. Colony Quest (whole-class cooperative boss)
- **Hook:** The whole class builds one huge ice colony before the storm arrives; every correct answer places a block.
- **Loop:** each child solves their own item; the shared colony grows on the host's big screen; storm meter rises only when several answers are wrong at once.
- **Mechanic:** collective goal-setting removes rivalry; hint-ability; retrieval at scale. Host can drop a "help card" (worked example) when the class struggles.
- **Curriculum:** any; strongest in Maths KS2 `as`, `md`; Science KS2 `states`, `forces`.
- **Data:** SSE room; per-child answers -> per-child attempts; class aggregate heat map by topic.
- **Modes:** live class; in-person (teacher screen).
- **Session:** 15 min. **Input:** touch/keys.
- **Art:** big-screen colony that gains detail.
- **Adaptation:** items adapt per child; storm thresholds scale to class size.
- **Reward:** colony saved -> a persistent "class colony" that gains a house per finished lesson (class-level, not a streak).
- **Calm:** storm is a slow sunset dimming, no urgency.
- **Tutor insight:** live class heat map: which subtopic needs re-teach right now.
- **Complexity:** XL. **Risks:** realtime scale, latency, fairness for non-readers.

### 14. Impostor Ice (spot the wrong answer among the class)
- **Hook:** Five answers from classmates appear (anonymous); one is wrong; explain why.
- **Loop:** read the question, see 4-5 anonymous answers with method snippets, tap the flawed one; then pick the misconception.
- **Mechanic:** error analysis at class scale + social learning; grounded in each child having first answered the same question (they generate the retrieval, then evaluate).
- **Curriculum:** Maths KS3/KS4 `alg`, `num`; English KS2/KS3 `gp` (which sentence is punctuated wrongly); Science KS3 `pforce`.
- **Data:** phase 1 answers stored; phase 2 uses real anonymous answers plus seeded bank distractors to guarantee a wrong one and avoid exposing individuals; scoring `byTopic`.
- **Modes:** live class; in-person tablets.
- **Session:** 10 min. **Input:** tap.
- **Art:** ice cubes, one cracked.
- **Adaptation:** subtler errors; class-selected topics.
- **Reward:** "class detectives cleared N cases."
- **Calm:** no timer, no reveal of author.
- **Tutor insight:** the class's real (not hypothetical) misconception distribution.
- **Complexity:** L. **Risks:** anonymity leaks (handwriting-style, small classes), pupils mocking; use seeded answers when class < 8.

### 15. Pass the Puck (shared-tablet in-person duel)
- **Hook:** Two children share one tablet and slide a puck back and forth; each correct answer sends it further to the other's goal.
- **Loop:** it is your turn; answer; tablet rotates (screen shows whose turn with the pupil's name and colour).
- **Mechanic:** retrieval with turn-taking; forces observation of a peer's method; pair discussion optional "assist" once.
- **Curriculum:** any; especially KS1 `as`, `npv`, KS2 `md`, French vocab `frnum`.
- **Data:** in-person class session (`inperson/` `CaptureGrid`, `useClassState`); each pupil's answers write to their own row.
- **Modes:** in-person shared tablet; pair.
- **Session:** 6 min. **Input:** touch.
- **Art:** rink from above, two colour puck trails.
- **Adaptation:** each player's questions individually levelled so a stronger pupil does not always win (handicap by difficulty, transparently "each gets their own level").
- **Reward:** shared rally length record (cooperative).
- **Calm:** rally mode: cooperative only, no goals.
- **Tutor insight:** who defers, who dominates the tablet.
- **Complexity:** S-M. **Risks:** fairness perception; keep handicap transparent.

## D. Exam-technique games (4)

### 16. Mark Hunter (be the examiner)
- **Hook:** Mark three anonymous answers against the mark scheme, then see how the real examiner marked them.
- **Loop:** read the answer, tick the mark-scheme points it earns, get feedback per point.
- **Mechanic:** assessment-literacy: students internalise what earns marks (evidence: examiner-role tasks); retrieval of subject content in the marking judgement; targets "waffle earns marks" misconception.
- **Curriculum:** English KS4 `lang4`, `wr4`, `mod4`; Science KS4 6-mark questions (`b4org`, `c4chem`); Maths KS4 method marks; `written` kind in our packs already carries a mark scheme in `explanation`.
- **Data:** uses existing `written` items with authored sample answers (needs 3 exemplars per item: full/partial/poor) - new field `exemplars[]`; `byTopic` counts mark-agreement.
- **Modes:** solo; 1:1 (tutor debrief on disagreements); live class (class marks the same answer, spread shown); homework 5-min (1 answer).
- **Session:** 8 min. **Input:** tap ticks.
- **Art:** examiner's desk, Pip with magnifier and gold stamp.
- **Adaptation:** subtler answers, more mark points.
- **Reward:** "examiner accuracy" personal rating.
- **Calm:** untimed, one answer at a time.
- **Tutor insight:** whether the student can recognise a top-band answer, the gap between "knows" and "can write".
- **Complexity:** M (authoring exemplars). **Risks:** exam-board copyright: original exemplars only; marking judgment ambiguity.

### 17. Command Post (command-word sorting and sentence-starters)
- **Hook:** Match each command word (describe, explain, evaluate, compare) to the response it actually asks for.
- **Loop:** an exam question appears; drag it to the right response-type post, then build the first sentence with a starter chip.
- **Mechanic:** discrimination learning; interleaving of question types; short retrieval of the structure (point-evidence-explain).
- **Curriculum:** Science KS4 all Biology/Chemistry/Physics topics (`b4inf`, `c4rate`), English KS4 `lang4`, `unseen4`, Maths KS4 (show that/prove).
- **Data:** command-word tagging of existing bank prompts (script) + CardSort tool; `byTopic` correct sort.
- **Modes:** solo; 1:1; live class; homework 5-min.
- **Session:** 5 min. **Input:** drag/tap (CardSort exists).
- **Art:** signposts on an ice road.
- **Adaptation:** more subtle command words.
- **Reward:** signpost map.
- **Calm:** untimed.
- **Tutor insight:** which command word the student mis-reads (e.g. explain as describe) - the classic mark-loser.
- **Complexity:** S. **Risks:** low delight; pair with Mark Hunter.

### 18. Method Marks Ladder (show-your-working builder)
- **Hook:** Climb rungs of marks: each correct working step earns a rung; even a wrong final answer can reach the top.
- **Loop:** multi-step question; enter step lines in order; each line validated and earns a method mark.
- **Mechanic:** teaches that working earns marks; worked-example fading (steps shown as placeholders -> blank); trains sequencing of multi-step reasoning.
- **Curriculum:** Maths KS4 `alg`, `geo` (Pythagoras/trig), `rp`, `prob`; KS5 `diff`, `integ`, `trig`.
- **Data:** requires authored step-templates and a server-side step checker (equivalence checking through `tools/engine/marking.ts`/textmark; algebraic equivalence engine needed) - new marking type `steps`. `byTopic` marks split M/A style.
- **Modes:** solo; 1:1 (tutor sees the steps); homework.
- **Session:** 8-10 min. **Input:** typed/keyboard; maths input support.
- **Art:** ladder with gold rungs.
- **Adaptation:** fewer prompts.
- **Reward:** "marks earned even when answer wrong" summary, reframing mistakes.
- **Calm:** untimed.
- **Tutor insight:** where the process breaks; whether accuracy vs method is the gap.
- **Complexity:** L (algebraic step checker). **Risks:** equivalence checking false negatives; frustrating if strict.

### 19. Practical Expedition (required-practicals)
- **Hook:** Plan and run a virtual experiment: choose variables, equipment, and fix errors.
- **Loop:** pick independent/dependent/control variables, set up (labelled diagram), take readings, plot graph, evaluate.
- **Mechanic:** teaches practical skills (variables, reliability, anomalous results) via the DataGraph tool and `experiments.ts`; retrieval of method terms.
- **Curriculum:** Science KS3 `pforce`, `creact`; KS4 `c4rate`, `p4elec`, `b4bio` (required practicals), tools `science/data/experiments.ts`, `labels`.
- **Data:** experiments data (exists) + questions in the bank tagged practical; `byTopic`.
- **Modes:** solo; 1:1; live class (one experiment, pooled data - very good); homework.
- **Session:** 12 min. **Input:** touch/drag/typing.
- **Art:** lab under the aurora; Pip in goggles.
- **Adaptation:** hidden hints.
- **Reward:** lab notebook entries.
- **Calm:** no timers, no messy-lab hazards.
- **Tutor insight:** where experimental reasoning fails (control variables vs fair test).
- **Complexity:** L. **Risks:** simulation fidelity; scope creep.

## E. Creative / build games (3)

### 20. Problem Foundry (write questions for answers)
- **Hook:** The answer is 24 - forge a word problem whose answer is 24, then a friend solves it.
- **Loop:** pick a given answer + operation chips, write/assemble the problem, check it with the solver.
- **Mechanic:** generation effect + problem posing (deep understanding of structure); the check confirms the child's problem yields the target.
- **Curriculum:** Maths KS2 `as`, `md`, `rp` Y5-Y6; KS3 `alg` (write an equation for a story).
- **Data:** child-authored items stored `hubGameItems` (private); solver is a deterministic parser for structured templates (not free text), free text marked `written` by tutor. `byTopic` on solvable-structure check.
- **Modes:** solo; 1:1 (tutor solves the child's problems!); pair swap; live class swap; homework.
- **Session:** 8-10 min. **Input:** template chips + keyboard.
- **Art:** forge, cold-flame gold.
- **Adaptation:** more constraints ("must use fractions").
- **Reward:** gallery of own problems; friend-solved counter.
- **Calm:** private only.
- **Tutor insight:** which structure the child can only recognise vs create.
- **Complexity:** M-L. **Risks:** free-text moderation (child safety), unsolvable posed problems.

### 21. Sentence Forge (grammar power-ups in writing)
- **Hook:** Forge a sentence, then sharpen it with grammar tools (fronted adverbial, subordinate clause, semi-colon) that unlock as you master them.
- **Loop:** pick a base sentence prompt; add a tool chip; the game checks structure and highlights.
- **Mechanic:** sentence combining (evidence-backed writing intervention) and explicit grammar retrieval; connects `gp` to composition.
- **Curriculum:** English KS1 `gp`, `wc`; KS2 `gp` Y3-Y6; KS3 `gp`, `wc`; tools `english/FrameWriter.tsx`, `TimedWriting`, `frames.ts`, `textstats.ts`.
- **Data:** marking via `textmark.ts`; rubric checks structural features only, tutor marks quality; `byTopic["gp"|"wc"]`.
- **Modes:** solo; 1:1 (tutor reads the forge); pair (co-write); live class (best sentences anonymously shown); homework.
- **Session:** 8 min. **Input:** keyboard.
- **Art:** anvil, sparks gold.
- **Adaptation:** chips unlock; less scaffold.
- **Reward:** portfolio of finest sentences.
- **Calm:** no unlock counters.
- **Tutor insight:** what structures the child uses spontaneously vs when prompted.
- **Complexity:** M. **Risks:** heuristic parsing errors; false negative on creative sentences.

### 22. Ice Sculptor (geometry construction studio)
- **Hook:** Carve symmetrical ice sculptures by constructing shapes precisely with compasses and rulers.
- **Loop:** follow a challenge ("construct an equilateral triangle side 5 cm"); use tools; checker validates.
- **Mechanic:** procedural knowledge with immediate exact feedback (`checkers.ts`); fades scaffolds.
- **Curriculum:** Maths KS3 `geo` Y7-Y9, KS4 `geo` constructions/loci, KS2 `shape`; tools M-01..M-09 (ruler, protractor, compass, construction checker).
- **Data:** geometry `generators.ts`/`checkers.ts` (exist); `byTopic["geo"]`.
- **Modes:** solo; 1:1; live (class reveals a shared gallery); homework.
- **Session:** 10 min. **Input:** touch/mouse (precision).
- **Art:** ice block carved to sculpture.
- **Adaptation:** hints.
- **Reward:** gallery.
- **Calm:** no timers, undo unlimited.
- **Tutor insight:** procedural fluency with instruments.
- **Complexity:** L-XL (touch precision). **Risks:** accuracy on touch; tools maturity.

## F. Language games (3)

### 23. Verb Tides (conjugation in the flow)
- **Hook:** The tide carries verb boats; catch the one with the right ending to complete the sentence.
- **Loop:** a sentence with a gap and a subject pronoun; choose or type the conjugated verb; regular and irregular interleaved.
- **Mechanic:** retrieval + interleaving of tense/person; contrastive sets (mange/manges/mangeons); pattern noticing then production; irregular verbs return by SM-2 spacing.
- **Curriculum:** French KS2-3 `frverb`, KS4-5 `frgram4`, `frgram5`; Spanish `esverb`; German `deverb` (same structure), tools `languages/verbs/conjugate.ts`, `VerbTrainer.tsx`.
- **Data:** conjugation generator (exists) + bank `frverb` items; `byTopic["frverb"|"esverb"|"deverb"]`; item records ending error type.
- **Modes:** solo; 1:1; pair; live class "tide relay"; homework 5-min.
- **Session:** 5 min. **Input:** tap or typed with AccentBar.
- **Art:** harbour boats, gold lanterns.
- **Adaptation:** options -> typing -> free-text sentence.
- **Reward:** verb harbour: each verb family docks when secure.
- **Calm:** untimed, replay audio.
- **Tutor insight:** which person/tense endings are unstable; whether errors are agreement or stem.
- **Complexity:** M. **Risks:** accent input, TTS for non-English; irregular data QA.

### 24. Market Stall (role-play dialogue)
- **Hook:** Run a market stall in French/Spanish/German: greet, ask, order, pay.
- **Loop:** customer speaks (text + audio), choose or build the reply with SentenceBuilder chips; the dialogue branches.
- **Mechanic:** chunk learning of functional phrases; retrieval in context; scaffolds fade (chips -> sentence starters -> free typing).
- **Curriculum:** French `frfood`, `frnum`, `frtown`, `frhol`; Spanish `esfood`, `esnum`, `estown`; German `defood`, `denum`, `detown`.
- **Data:** authored branching dialogues (new content, 15 per language) + `SentenceBuilder`/`sentences.ts`; `byTopic`.
- **Modes:** solo; 1:1 (tutor voices the customer); pair (child A shopkeeper, B customer); live class; homework.
- **Session:** 6 min. **Input:** tap/typing/voice optional.
- **Art:** stall with awning, penguins as customers.
- **Adaptation:** fading scaffolds.
- **Reward:** phrasebook.
- **Calm:** no time pressure, slow audio.
- **Tutor insight:** can the child produce phrases, not just recognise.
- **Complexity:** L (content). **Risks:** speech recognition quality and privacy (do not record kids by default).

### 25. Snowdrift Genders (noun gender and agreement sorting)
- **Hook:** Sort nouns into gender drifts (le/la, el/la, der/die/das) before the snow settles, then check agreement.
- **Loop:** noun appears; tap the drift; then choose the matching adjective.
- **Mechanic:** discrimination learning with immediate corrective feedback; cues learned by ending patterns (-tion, -ción, -ung); spaced.
- **Curriculum:** French `frnoun`; Spanish `esnoun`; German `denoun` (KS2-3); tools `GenderTrainer`, `AgreementTrainer`, `nouns.ts`.
- **Data:** noun lists + generator; `byTopic`.
- **Modes:** solo; 1:1; pair; live; homework.
- **Session:** 4 min. **Input:** tap/keys.
- **Art:** snowdrifts, falling nouns.
- **Adaptation:** exceptions returned more.
- **Reward:** drifts melt to grass as gender rules are learned.
- **Calm:** snow does not fall (nouns appear), no timer.
- **Tutor insight:** which endings/patterns the child relies on.
- **Complexity:** S-M. **Risks:** German three-gender difficulty; exceptions.

## G. Tutor + child together (3)

### 26. Teach Pip (teach-back)
- **Hook:** Pip does not understand yet; the child explains the method step by step and Pip tries to follow (and gets confused when steps are missing).
- **Loop:** child picks step chips / types an explanation; Pip "executes" it on a worked problem and either succeeds or goes wrong at the missing/incorrect step.
- **Mechanic:** protege effect / self-explanation: explaining forces retrieval and organising; visible failures reveal gaps; tutor stays as co-teacher.
- **Curriculum:** Maths KS2 `as` (column method), `frac`; KS3 `alg`; Science KS3 `becol`, `creact` (explain a process); English KS2 `gp`.
- **Data:** structured step chips (authored per skill) with an interpreter (server) that runs them; free text goes to tutor as `written`; `byTopic` on step-order correctness.
- **Modes:** 1:1 with tutor (primary); solo (structured only); pair; homework.
- **Session:** 8 min. **Input:** tap/typing/voice optional.
- **Art:** Pip with thought bubble.
- **Adaptation:** fewer scaffold chips; from chips to free text.
- **Reward:** "things I can teach" list - explicit skill portfolio.
- **Calm:** Pip gentle, no failure sounds.
- **Tutor insight:** genuine understanding versus procedure recall (most valuable): what the child omits when explaining.
- **Complexity:** L. **Risks:** interpreter scope; ensure explanation feels natural.

### 27. Predict & Peek (calibration game)
- **Hook:** Before the answer is revealed, the child and tutor each bet how sure they are; the gap becomes the conversation.
- **Loop:** question appears; child picks a confidence (star scale); answers; tutor optionally predicts too; reveal and compare.
- **Mechanic:** metacognitive calibration and hypercorrection; confident errors are the most learnable moments; feedback strengthens.
- **Curriculum:** any pack; particularly Science KS3/KS4 (misconception heavy), Maths KS2/KS3.
- **Data:** attaches `confidence` (1-3) to each item in a normal quiz/homework attempt; new column in `hubAttempts.answers`; mastery unaffected; tutor overview computes calibration per topic.
- **Modes:** 1:1 primary, solo; homework version (confidence tap); live class (poll).
- **Session:** 6-10 min. **Input:** tap.
- **Art:** binoculars, penguins peering.
- **Adaptation:** picks misconception-prone items where confidence errors occurred.
- **Reward:** calibration "sharpness" shown as trend, privately.
- **Calm:** no score, only reflection.
- **Tutor insight:** unique: confidently-wrong (misconception) vs unsure-right (fragile) map by topic - a quiz cannot show this.
- **Complexity:** S. **Risks:** children reading it as being judged; keep the tone curious.

### 28. Pip's Homework Clinic (tutor-authored misconceptions)
- **Hook:** The tutor secretly plants a mistake in Pip's "homework" that mirrors what this child got wrong last week; the child becomes the teacher who fixes it.
- **Loop:** child reviews Pip's page, finds and fixes the error; tutor sees which planted mistakes they caught.
- **Mechanic:** erroneous-example + personalisation: the errors are derived from the child's own past wrong answers (distractor chosen), so it is targeted misconception repair, but framed as helping Pip, reducing shame.
- **Curriculum:** any auto-marked pack (uses attempts `answers[]` with `correct:false` + chosen distractor); best in Maths `alg`, `frac`, Science `c4quant`.
- **Data:** server builds "Pip's page" from the child's last N wrong answers (`hubAttempts.answers`) transformed into a step chain (shares engine with #8); tutor can edit; results to `byTopic`.
- **Modes:** 1:1 with tutor (creates and debriefs), solo/homework (auto-generated), live (tutor prepares a class-level page from aggregated errors).
- **Session:** 5-8 min. **Input:** tap/typing.
- **Art:** classroom desk, red-pen gold.
- **Adaptation:** repeats until the misconception is resolved (two successes over a week).
- **Reward:** "Pip learnt it" mascot progression; repaired misconceptions listed.
- **Calm:** default friendly tone.
- **Tutor insight:** proof that a misconception is really repaired (transfer to a fresh page).
- **Complexity:** M (on top of #8 engine). **Risks:** privacy (only that child's own data), authoring cost if fully manual.

## H. Calm / low-stimulation (2)

### 29. Slow Snowfall (untimed sort and match garden)
- **Hook:** Gently sort or match falling snowflakes into little snow-globe groups at your own pace.
- **Loop:** pick up one card, place it in the group it belongs to (odd/even, noun/verb, solid/liquid/gas, equivalent fractions).
- **Mechanic:** categorisation retrieval with zero time pressure; errors gently return to the flake with a hint; good for anxious or sensory-sensitive pupils.
- **Curriculum:** Maths KS1-KS2 `npv`, `frac`, `shape`; English KS1-KS3 `gp`; Science KS1-KS3 `states`, `mats`, `living`, `bcell`; tools CardSort, VennSort.
- **Data:** bank `match`/`order` and Card/Venn sorts; `byTopic`.
- **Modes:** solo; 1:1 (regulation-friendly start-of-session); homework; in-person.
- **Session:** 5-10 min. **Input:** tap-to-place.
- **Art:** pale navy sky, slow snow, no flashing; optional soft music.
- **Adaptation:** categories grow slowly.
- **Reward:** the snow globe fills with a quiet scene per group.
- **Calm:** it is the calm variant; also high-contrast, dyslexia-friendly font option.
- **Tutor insight:** categorisation logic and where boundaries are fuzzy.
- **Complexity:** S. **Risks:** low excitement; do not replace fluency practice.

### 30. Lantern Garden (quiet read-and-notice)
- **Hook:** Read a short passage slowly; light lanterns by finding words, clues and feelings.
- **Loop:** tap a word/phrase to light a lantern (vocab clue, inference evidence), answer one gentle question.
- **Mechanic:** vocabulary in context + inference with evidence retrieval; text-marking strategy; no time.
- **Curriculum:** English KS1-KS3 `rc`, `vocab`, KS4 `unseen4`, `lang4`; tools `english/readingOptions.tsx`.
- **Data:** bank `rc` passages with prompts; add evidence-span field; `byTopic["rc"]`.
- **Modes:** solo; 1:1 (shared reading, tutor lights lanterns too); homework 5-min; in-person.
- **Session:** 8 min. **Input:** tap/highlight.
- **Art:** night garden, warm gold lanterns.
- **Adaptation:** passage complexity by Lexile-style band and year.
- **Reward:** lanterns become a garden of read passages.
- **Calm:** it is calm; read-aloud toggle.
- **Tutor insight:** which evidence the child cites vs guesses; inference vs retrieval gap.
- **Complexity:** M. **Risks:** need enough original passages; highlight UX on touch.

---

## Ranking (Learning impact x Delight x Feasibility on our stack; each 1-5, max 125)

| # | Concept | Learn | Delight | Feasible | Score |
|---|---|---|---|---|---|
| 1 | Penguin Slide | 5 | 4 | 5 | 100 |
| 2 | Bond Igloos | 4 | 4 | 5 | 80 |
| 8 | Iceberg Detective | 5 | 4 | 4 | 80 |
| 23 | Verb Tides | 5 | 4 | 4 | 80 |
| 28 | Pip's Homework Clinic | 5 | 4 | 4 | 80 |
| 5 | Deep Freeze | 5 | 3 | 5 | 75 |
| 3 | Sound Fishing | 4 | 4 | 4 | 64 |
| 7 | Balance the Floe | 5 | 4 | 3 | 60 |
| 12 | Penguin Relay | 4 | 5 | 3 | 60 |
| 14 | Impostor Ice | 4 | 5 | 3 | 60 |
| 16 | Mark Hunter | 5 | 3 | 4 | 60 |
| 17 | Command Post | 4 | 3 | 5 | 60 |
| 26 | Teach Pip | 5 | 4 | 3 | 60 |
| 27 | Predict & Peek | 5 | 3 | 4 | 60 |
| 6 | Fraction Ferry | 4 | 4 | 3 | 48 |
| 9 | Shape Riddle Cave | 3 | 4 | 4 | 48 |
| 10 | Krill Kitchen | 4 | 3 | 4 | 48 |
| 15 | Pass the Puck | 3 | 4 | 4 | 48 |
| 20 | Problem Foundry | 4 | 4 | 3 | 48 |
| 21 | Sentence Forge | 4 | 4 | 3 | 48 |
| 25 | Snowdrift Genders | 4 | 3 | 4 | 48 |
| 18 | Method Marks Ladder | 5 | 3 | 3 | 45 |
| 29 | Slow Snowfall | 3 | 3 | 5 | 45 |
| 4 | Tide Clock | 3 | 3 | 4 | 36 |
| 11 | Proof Ladder | 4 | 3 | 3 | 36 |
| 24 | Market Stall | 3 | 4 | 3 | 36 |
| 30 | Lantern Garden | 3 | 3 | 4 | 36 |
| 19 | Practical Expedition | 4 | 4 | 2 | 32 |
| 13 | Colony Quest | 3 | 5 | 2 | 30 |
| 22 | Ice Sculptor | 3 | 5 | 2 | 30 |

Scores are judgement, not measurement; feasibility reflects reuse of existing tools/API (e.g. #5 reuses SM-2 API wholesale; #13 needs new realtime).

## Top-5 launch line-up (breadth of subject, age, mode, and one shared engine)
1. **Penguin Slide** - the flagship fluency game (KS1-KS2 maths; score 100).
2. **Iceberg Detective** - reasoning/misconception game for KS2-KS5 maths and science calculations (80); shares an engine with #28.
3. **Verb Tides** - languages (French/Spanish/German, KS2-KS5), uses existing conjugation generator (80).
4. **Pip's Homework Clinic** - the tutor + child personalised misconception loop (80); the strongest tutor-value differentiator.
5. **Deep Freeze** - spaced-repetition for every subject; near-zero new backend (75). Bond Igloos (80) is the natural fast-follow because it reuses the Slide engine; Penguin Relay is the first live-class add-on once the Slide engine and room channel exist.

## Top-3 first vertical slice
1. **Penguin Slide** solo + homework 5-min + tutor pin (proves item server, session record, mastery write, thaw map, kid-mode UI).
2. **Deep Freeze** (proves the same session record over existing SM-2 API; low effort, ships in the same sprint).
3. **Iceberg Detective** with ~60 authored cases in Maths KS2 `frac`/`as` and KS3 `alg` (proves the content pipeline and the tutor insight panel).
Then add live-class "Slide-Along" and Pip's Homework Clinic.

---

## One-page spec: #1 Penguin Slide

**Goal.** Build automatic recall of multiplication and division facts (Y2-Y4 core, Y5-Y6 review) without anxiety, measuring fluency separately from mastery.

**Screens.**
1. *Launch card (kid mode / hub / homework link).* Title, Pip, "Choose tables" chips (2,5,10 / 3,4,8 / 6,7,9 / 11,12 / Mixed / "Pip's picks" default = weakest facts), Play, Calm toggle (remembered per child).
2. *Run screen.* Top: progress dots (20 facts). Middle: fact prompt large (`7 x 8 = ?`), 3 or 4 lane buttons at bottom (numbers). Pip slides; fish icons collect. Pause (breathe) button. Typed mode shows a number pad.
3. *Between-facts feedback (0.8 s).* Correct: lane glows gold, quick sparkle; wrong: correct lane briefly highlights with the full fact `7 x 8 = 56` shown for 1.5 s (retrieval feedback), Pip shrugs kindly; the fact is re-queued 3-6 items later.
4. *Run summary.* "You answered 24 of 26. 3 facts got faster: 6x7, 8x4, 9x6." Thaw grid mini-view. One "fact to look at" with a worked strategy card (e.g. 7x8 = 5x8 + 2x8). Buttons: Again, Done.
5. *Thaw map (progress).* Tables grid 1-12 x 1-12; cell colour ice -> gold by state; tap cell to see history.
6. *Tutor panel (board sidebar / student page).* Slow-but-correct list, wrong list, tables pinned, session history.

**State machine.** `idle -> loading(seed) -> asking(item) -> answered(correct|wrong) -> feedback -> asking | summary -> done`. Extra: `paused` (timer stops), `offline` (queue answers; submit later), `abandoned` (partial submit on unload).

**Item selection (server).** Pool = facts a x b (a,b in 2..12 plus 1x,10x variants by year) and inverse division `56 / 7`. Each fact has state `{ef=2.5, intervalDays, reps, nextDueAt, avgLatencyMs, lastCorrect}` initialised per child. Run of N=20: 60 percent due/weak facts, 30 percent facts from selected tables at random, 10 percent interleaved "stretch" (next table). Every 8th item is a bank word problem (`md` topic, matching year) presented as 4 options. Distractors (server): a x (b+-1), (a+-1) x b, a+b, digit swap, and the product of the adjacent table.

**Timing and scoring (privacy-safe).** Score = correct answers; there is no visible per-question timer. Speed bands (for tutor only): fast <=3 s, ok <=6 s, slow >6 s (Y3+ thresholds; +50 percent for Y1-Y2, none in calm mode). Fluency "thaw" level 0-4: 0 unseen, 1 wrong recently, 2 correct slow, 3 correct ok, 4 correct fast on two separate days. Mastery reporting: `byTopic["md"]={got,max}` from correctness only, at game weight 0.5.

**Feedback text (child-facing, kind).** Correct: "Yes! 56." / "Got it - that one is thawing." / after streak of 5: "Pip is flying!" (no streak-loss language ever). Wrong: "Nearly. 7 x 8 = 56. We'll see it again soon." Slow-correct: none shown. Timeout (only in non-calm): "No rush - take your time." Summary: "You practised 26 facts. 3 got faster." Tutor-facing: "6x7: correct 4/6, median 7.2 s; often answers 48 (6x8)".

**Adaptation.** Lane count 3 (Y2-Y3), 4 (Y4+), typed mode auto-offered when accuracy >90 percent over 3 runs. Table set expands when >=70 percent of facts in the current tables have thaw >=3. If 3 wrong in a row: lower to easier facts and show a strategy card.

**Data model.**
- `hubFactState` id `${tenantId}__${childId}__${op}_${a}x${b}`: `{childId, a, b, op, ef, intervalDays, reps, nextDueAt, medianLatencyMs, attempts, correct, thaw, updatedAt}`.
- `hubGameSessions` (see section 0) with `gameId:"penguin-slide"`, `settings{tables[], lanes, typed, calm}`.
- `hubAttempts` row `assessmentType:"game"` for mastery.
- `hubHomework` gains optional `gameId`, `gameConfig`, `minItems`.
All with `tenantId`, `franchiseId`, `createdBy`, `createdAt`; registered in `e2eCleanup.ts` TENANT_SCOPED.

**API.** `POST /games/penguin-slide/session {childId, tables?, calm?, n?}` -> `{sessionId, items[{id, kind, prompt, options[], factKey?}]}` (answers stripped). `POST /games/session/:id/answers {answers[{itemId, response, latencyMs}]}` -> streamed feedback correctness (or per-item `POST` for immediacy). `POST /games/session/:id/submit` -> summary + mastery write. `GET /games/penguin-slide/map?childId=` -> thaw grid. Parent/kid access via `resolveCtx`/`canSee` as with existing hub routes.

**Telemetry events.** `game_open`, `game_config_change {tables, calm}`, `session_start {mode, calm}`, `item_shown {itemId, factKey, source}`, `item_answered {correct, latencyMs, lane, typed}`, `item_requeued`, `strategy_card_shown/dismissed`, `pause_tap`, `session_end {completed|abandoned, n, correct, thawGained}`, `homework_completion`, `tutor_pin_topics`. Never send free-text or names; child id hashed if exported.

**Edge cases.** Repeated fast wrong taps (guessing): if 3 answers <600 ms and wrong, show "Take a breath" and pause the timer; do not count those as data for thaw. Double-tap on lane: ignore second. Tab hidden: pause. Offline: queue up to 50 answers, resubmit on reconnect; if session expired, accept as new attempt. Child changes tables mid-run: apply next run. Two devices: last submit wins, fact states merged by max attempts. Zero due facts: show "Pip's ice is all gold today" and offer a stretch table. Reduced motion or calm: no sliding, instant highlight. Screen readers: lanes are buttons with `aria-label="Answer 56"`; fact announced with `aria-live=polite`. Reception/Y1 kids: audio read-aloud of the fact. Tutor override: pinned tables win. Very slow devices: pre-fetch next 5 items. Data deletion: `e2e:cleanup` removes fact states.

**Acceptance.** 20-fact run completes with keyboard only; a wrong answer re-queues within 3-6 items; thaw map updates after summary; calm mode has no timers or motion; mastery row for `md` appears with game weight; tutor panel lists the slow/wrong facts; e2e spec anchored to this run's session name per repo rule.

**Risks and mitigations.** Anxiety (calm default for first run, never show latency); lane guessing (typed mode, 4 lanes); over-practice (daily 3-run soft cap, framed as "your ice is done for today", no lock-in); content correctness (generated facts are trivially checkable, unit-tested).
