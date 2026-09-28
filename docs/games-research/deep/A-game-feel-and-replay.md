# A. Game feel, replay, difficulty: research for Penguin Slide

Researcher pass, 2026-09-26. About 45 WebSearch queries and 20 WebFetch attempts.

## Evidence tags

- **[V]** = Verified: I fetched the page and read the claim in it. Tool errors and 403s are listed below.
- **[U]** = Unverified: seen only in a search-result excerpt, or a secondary or blog summary, or from my own knowledge.
- **[D]** = Design proposal: my recommendation. It is not a sourced fact. Tune it in playtest.

Every number in the rules in section A is a starting value for tuning, not a finding, unless it carries a [V] tag on a specific source.

### Honest limits of this research

- **The primary talks were not read.** The Vlambeer talk, "Juice it or lose it", and Swink's book are video or paywalled. I could not extract their numbers. Only one number from Vlambeer was confirmed: about 0.2 s of "sleep" (hit-stop) on an enemy hit. It came from a student blog summary, and the tool read it back as a single specific figure ([victorweidar](https://victorweidar.wordpress.com/2016/10/06/the-art-of-screenshake/), [V] for the blog's wording, [U] for the talk itself). Watch the talk before locking values.
- **Fetch failures.** nature.com redirected to a login. Several PMC URLs returned the wrong article. The Pelánek PDF came back as binary. Blow's latency paper hit an SSL error. Kahoot's ScienceDirect review returned 403. Where these failed, I fell back to the bioRxiv full text or search excerpts, and I say so.
- **Coyote-time and buffer numbers** (5 to 6 frames, 100 to 150 ms) came from search excerpts of hobbyist blogs. The one fetched hobbyist page was an empty landing page. They are [U].

---

## (a) The 20 rules of juice for Penguin Slide

The game is a lane-runner or slider: swipe or tap, the penguin changes lanes, and answers are physical objects in the world.

### Input and responsiveness

1. **Respond on the same frame.** Start the lane-change animation on `pointerdown` or the swipe start, not on `pointerup` or after the answer resolves. Target under 50 ms from input to first visible change.
   - Support: an excerpt says platform-style performance is consistent up to about 50 ms latency and degrades beyond it ([Wikipedia: Game feel](https://en.wikipedia.org/wiki/Game_feel), [U]). Swink's own numbers were not verified.
2. **Use `pointerdown` and `touch-action: none` on the play surface.** This removes tap-delay and scroll ambiguity. [D]
3. **Add input buffering of 100 ms.** If the player swipes just before a lane change becomes legal (mid-slide or during a hit-recovery), queue it and fire it on the first legal frame.
   - Excerpts give 100 to 150 ms ([GameJuice](https://www.gamejuice.co.uk/articles/coyote-time-input-buffering) landing page, [U]). Search excerpts credit Celeste with 5 frames of coyote time ([U]).
   - For a times-tables game the child is thinking, not twitching, so lean generous: 120 ms. [D]
4. **Add coyote time of about 100 ms for lane commits.** If the child commits to the correct answer's lane just as it passes, still credit it. A wrong "miss" caused by timing, not knowledge, corrupts the fluency data and feels unfair. [D]
5. **Separate motor error from knowledge error in the log.** Log input timestamps and lane, and flag "late by under 150 ms" separately from "wrong answer". [D]

### Motion and easing

6. **Use easing on every move and none on nothing.** Snap 90% of the way in ease-out, over 120 to 180 ms for a lane change: `cubic-bezier(0.22, 1, 0.36, 1)` or equivalent. Do not use linear. [D]
7. **Add slide inertia.** The penguin overshoots the lane centre by 3 to 6% of lane width and settles in 100 to 150 ms with a critically damped spring. This makes ice feel like ice. [D]
8. **Squash and stretch.** On lane change: stretch 1.10 in the movement axis for about 80 ms, then squash 0.92 on landing for about 100 ms. Keep the total volume roughly constant. On a correct hit, use one 1.15 pulse of about 120 ms. [D]
   - Background: "Juice it or lose it" is the canonical reference for tweening, squash-and-stretch and particles on a plain game ([GDC Vault](https://gdcvault.com/play/1016789/Juice-It-or-Lose), [V] that the talk exists and its topic; the specific numbers above are mine).
9. **Add anticipation.** A 60 to 80 ms wind-up lean before the lane change on a keyboard or tap input. Do not add it to swipe, where the finger already supplied the anticipation. [D]

### Impact and feedback

10. **Hit-stop.** On the correct-answer collect, freeze the world for 50 to 80 ms while the penguin and the answer object keep animating. Vlambeer's talk used about 200 ms for a shooter's enemy hit ([blog summary](https://victorweidar.wordpress.com/2016/10/06/the-art-of-screenshake/), [U] for the talk). For a calm game, 60 ms is enough. Do not hit-stop on wrong answers. [D]
11. **Screen shake, small.** Correct: 2 to 3 px at a 1440 px width, 80 to 120 ms, decaying. Wrong: none, or a soft 4 px nudge with no rotation. Add a setting to turn it off (rule 18). Never shake the question text. [D]
12. **Camera.** Add gentle lookahead of 5 to 8% of the viewport in the movement direction and smooth it at about 0.15 s. Do not add camera zoom pulses. Zoom is a vestibular trigger. [D]
    - See MDN on vestibular triggers such as "scaling or panning large objects" ([MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion), [U] from the search excerpt).
13. **Particles that match the world.** Snow puffs on lane change (6 to 10 particles, 300 to 500 ms), ice-chip bursts on collect, and a fish or star pop on a streak milestone. They need to be visible but must never cover the answer objects. [D]
14. **Object-level feedback on answers.** The answer objects are physical things in the world, so the correct one reacts physically. It bumps and bounces, and a wrong one wobbles, cracks, or dulls. Do not use red X icons or buzzers. [D]

### Audio

15. **Audio latency budget: aim for under 40 ms.** Use the Web Audio API with `latencyHint: "interactive"`, preloaded and decoded buffers, not `<audio>` elements. Read `baseLatency` and `outputLatency` at start-up and log them. Compensate visuals by `outputLatency` where available ([MDN AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext), [U] from the excerpt). Some Android and Chromebook devices add about 10 ms of fixed DSP delay ([U]).
16. **Layer 3 sounds per event and keep them within 3 to 4 dB of each other.** Correct collect: a short transient tick at 0 ms, a tonal note on a scale at 0 to 30 ms, and a soft sparkle tail at 40 to 400 ms. Wrong: a low, soft "thud", 60 to 120 ms, with no buzzer and no sad trombone. Make the note pitch climb through the streak on a pentatonic scale, so any combination sounds fine. [D]
    - Pattern precedent: Tetris Effect adds pitch-varied vocal sounds to the music on each move so that inputs "play" the music ([Game Developer audio analysis](https://www.gamedeveloper.com/audio/game-audio-analysis---tetris-effect), [U] from the excerpt).
17. **Randomise slightly.** Two or three sample variants per sound and a pitch jitter of plus or minus 3%, so repetition does not fatigue. [D]

### Safety, calm and accessibility

18. **Reduced motion is a first-class mode.** Honour `prefers-reduced-motion: reduce` by default. In it, remove shake, parallax and zoom, cut particles by about 80%, replace squash and stretch with a colour or scale pulse of at most 1.05, and keep all information (a correct/wrong shape, a sound). Add an in-game toggle that overrides the OS setting in both directions. Baseline browser support since January 2020 ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion), [U] from the excerpt).
19. **No flashing over 3 per second, ever.** WCAG 2.3.1 says content passes if there are no more than 3 general flashes and 3 red flashes in any one-second period, or if the flashing area is small enough (a combined area under 0.006 steradians, about 25% of a 10-degree field, which the spec renders as 341 x 256 px on a 1024 x 768 reference). A "general flash" is a pair of opposing luminance changes of 10% or more of maximum where the darker image is below 0.80 relative luminance ([W3C Understanding 2.3.1](https://w3c.github.io/wcag21/understanding/three-flashes-or-below-threshold.html), [V]).
    - Applied to us: no strobe on streak milestones, and no full-screen white flashes. Confetti and fireworks must be sparse enough that no 341 x 256 patch flickers more than 3 times per second. Also test rapid-fire correct answers, which can stack effects into a flash. [D]
20. **Calm by default.** Use no timers that shout, no countdown beeps, no rising-tension music. Let speed pressure live in the lane speed, not in alarms. Alto's Adventure treats calm as a design goal: a "Zen Mode" with no game-over and no score ([Game Developer case study](https://www.gamedeveloper.com/design/alto-s-adventure-case-study), [V]). Offer a comparable no-fail practice mode for slower or anxious children. [D]

---

## (b) Why it will be replayed: the loop we should build

### What the teardowns actually tell us

| Game | What drives replay | Evidence |
| --- | --- | --- |
| Flappy Bird | Instant restart with no loading or penalty; the gap looks easier than it is; "just one more try" | Popular-press and blog explanations ([The Week](https://theweek.com/articles/450939/what-makes-games-like-flappy-bird-addictive), [U]). The creator withdrew it over addiction concerns ([U]). |
| Crossy Road | A game-over screen with randomised prizes, called "the most important system in the game, outside of the game itself". Cosmetic-only characters bought at 1 USD each. "Try" option and bonus coins raised IAP-to-ad ratio from 1:6 to 1:2. | [Thumbsticks interview with Matt Hall](https://www.thumbsticks.com/crossy-road-how-hipster-whale-reinvented-free-to-play/) [V] |
| Alto's Adventure | Three objectives per run, procedurally generated mountain, changing weather and time of day, characters and upgrades for in-game currency. It deliberately omits social leaderboards and daily login rewards. About a two-minute tutorial. | [Game Developer case study](https://www.gamedeveloper.com/design/alto-s-adventure-case-study) [V] |
| Monument Valley | No real failure, no stars, no leaderboards. Levels added only when they had something new to say. | [Search excerpt of Ustwo interviews](https://architizer.com/blog/practice/materials/an-interview-with-ken-wong-of-monument-valley/) [U] |
| Subway Surfers / Temple Run | Three-lane swipe, missions and daily challenges, "just one more" runs | [Game World Observer](https://gameworldobserver.com/2016/06/24/subway-surfers-gameplay-analysis) [U] |
| Wordle | One puzzle a day for everyone (scarcity, shared moment), and a shareable spoiler-free result grid | [Slate](https://slate.com/culture/2022/01/wordle-game-creator-wardle-twitter-scores-strategy-stats.html), [TechCrunch](https://techcrunch.com/2022/01/12/josh-wardle-interview-wordle/) [U] |
| Threes / 2048 | Threes was designed for depth; 2048 was cloned and simpler and spread faster. Lesson: virality and depth are different goals. | [GamesBeat](https://gamesbeat.com/threes-vs-2048-when-rip-offs-do-better-than-the-original-game/) [U] |
| Candy Crush | Near-misses (failing by 1 to 3 moves) were the most frustrating outcome and produced the strongest urge to continue, in 57 avid players in a lab. | [Candy Crush near-miss study, PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5445157/) [V] |
| Tetris | Flow: challenge matched to skill. Tetris Effect adds music tied to input. | [Game Developer](https://www.gamedeveloper.com/design/the-flow-applied-to-game-design) [U] |
| Duolingo | Streaks are "the most important lever in driving DAUs"; leagues; forgiveness features. | See below. |
| Times Tables Rock Stars | See below. |
| Kahoot, Gimkit, Blooket | See below. |

### Duolingo: research and criticism

- Streak wager A/B: Day-7 retention +14%, with statistically significant Day-1, Day-7 and Day-14 gains ([Duolingo blog](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals/), [V], company-reported, not independent).
- Weekend Amulet: 4% more likely to return a week later, 5% less likely to lose the streak. Even Duolingo added forgiveness to a loss-averse mechanic ([same source], [V]).
- The company frames streaks as helping learners "pace themselves" over binging ([same source], [V]).
- Criticism: parent and clinician commentary says children do the easiest possible lesson to keep the number alive, and report anxiety ([Screenwise](https://screenwiseapp.com/guides/duolingo-streaks-and-anxiety-in-kids), [Dr Rachel Taylor substack](https://drracheltaylor.substack.com/p/why-my-daughter-quit-duolingo-the), [U], anecdotal, not peer-reviewed).
- Streak and leagues context ([Deconstructor of Fun](https://www.deconstructoroffun.com/blog/2025/4/14/duolingo-how-the-15b-app-uses-gaming-principles-to-supercharge-dau-growth), [V] for the quoted claims, third-party analysis).

### Times Tables Rock Stars (the direct competitor)

- **Rock Status is speed-based.** It is the mean answer time over the last 10 Studio games, in 12 tiers: Rock Hero at 1 s or less (60+ per minute), Rock Legend at 2 s, Rock Star at 3 s, down to Wannabe over 10 s. There is a "New Artist" tier before 10 Studio games ([TTRS Help](https://intercom.help/times-tables-rock-stars/en/articles/2028839-rock-status-ttrs), [V]).
- Coins customise the avatar; there is a leaderboard-style status ladder and live multiplayer; Soundcheck simulates the UK Multiplication Tables Check ([TTRS Schools](https://ttrockstars.com/schools/), [V] that these are claimed features).
- Usage claims of 15,000 or 16,000+ schools and about 1 million students are marketing figures that differ between pages ([U]).
- One search excerpt reports that year-4 pupils who played over 13 minutes per school week scored 22/25 or more on the check ([excerpt from school pages], [U]). It is a correlation.
- Why kids love it (avatar, coins, competition, "doesn't feel like work") comes from review sites and schools ([U]).
- Independent effect evidence: I found none. Treat as unproven.

### Kahoot, Gimkit, Blooket

- Kahoot: a 2025 meta-analysis of 43 studies reportedly found a moderate effect on reducing anxiety ([Kahoot blog citing it](https://kahoot.com/blog/2025/07/17/kahoot-impact-research-academic-stress/), [U], vendor-hosted). In one biology-course survey, 4 of 112 comments called music, competition or time pressure negative ([CBE Life Sciences Education](https://www.lifescied.org/doi/10.1187/cbe.20-08-0187), [U] from the excerpt; the ScienceDirect review returned 403 and was not read).
- Gimkit: an earn-and-spend in-session economy where slower students stay in play ([Gimkit's own blog](https://www-gimkit.com/gimkits-economy-vs-new-casino-reward-systems/), [U]). Currency resets each session (per one review, [U]).
- Blooket: varied game modes over quizzes (comparison articles only, [U]).

### Prodigy (criticisms)

- A 2021 complaint to the FTC by a 22-group coalition alleged manipulative upselling to children, a "free" claim contradicted by membership marketing, benefits that carry into school play, up to four times as many ads as math battles at home, and inadequate substantiation of learning claims ([Fairplay press release](https://fairplayforkids.org/feb-19-2021-advocates-to-ftc-prodigy-math-game-preys-on-kids-and-families/), [EdWeek](https://www.edweek.org/technology/popular-interactive-math-game-prodigy-is-target-of-complaint-to-federal-trade-commission/2021/02), [U] from excerpts; these are allegations, not findings).
- Efficacy: there is a company-partnered Johns Hopkins study with 577 K-5 students ([U]). I found no large independent RCT.

### Near-miss psychology

- In gambling research, near-misses recruit win-related striatal circuitry more than full misses ([Clark et al. 2009 via PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC2861872), [U] from the excerpt).
- Candy Crush players found near-misses the most frustrating outcome and had the greatest urge to continue ([PMC5445157](https://pmc.ncbi.nlm.nih.gov/articles/PMC5445157/), [V]). Limitations: 57 adults, mostly young women, in a lab, tablet, no lockouts.
- **Implication for children:** near-miss urgency is a compulsion lever. We should not engineer near-misses (for example, "so close!" messages tied to re-play prompts). We may keep natural closeness cues that inform learning, such as "3 more to beat your best".

### The loop to build (the "Rehearse, Play, Reveal, Rest" loop)

1. **Core run (60 to 90 s).** One lane-run of 10 to 12 facts. Instant restart, no menu between runs.
2. **Reveal.** At the end, show what improved: "You answered 7 x 8 in 1.9 s. Last week: 3.4 s." Mastery framing first, score second.
3. **Personal-best ghost.** Show a faint penguin ghost of the child's own best run on the same fact set. It is a mastery comparison and needs no leaderboard.
4. **Collection.** Cosmetic hats and scarves for the penguin, and small items for a den, unlocked by practice milestones (facts moved to "quick", tables completed), not by time played or by streak length. Crossy Road shows cosmetic collectibles carry replay ([V] above).
5. **Small variety.** A daily "special" (a different ice course or weather) that changes look, not difficulty, and does not expire in a way that punishes absence. Alto's shows procedural variety plus 3 objectives works without login rewards ([V]).
6. **A natural stop.** After roughly 5 to 8 minutes, a friendly "penguin needs a rest" screen with a clear save. This is sound learning design (spaced practice; see below) and fits the ICO's pause-without-loss guidance.

### Ethical guard-rails (UK ICO Children's Code)

What I read in the ICO text:

- Standard 13 (nudge techniques): do not use nudge techniques to lead children to provide unnecessary personal data or weaken privacy settings; pro-privacy and wellbeing nudges (breaks, pauses) are explicitly acceptable. The page I fetched does not mention streaks or reward loops ([ICO Standard 13](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/13-nudge-techniques/), [V]).
- Standard 5 (detrimental use of data): the ICO names "reward loops, continuous scrolling, notifications and auto-play" as engagement-extending features. It says not to use personal data to offer children personalised in-game rewards for extended play, not to present continuation choices that imply they will "lose out" if they stop, to avoid data-driven autoplay, and to let children pause or take breaks without losing progress. It cites the UK Chief Medical Officers' precautionary approach ([ICO Standard 5](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/5-detrimental-use-of-data/), [V]).

Note: the ICO's concern is mostly personal-data-driven engagement. A fixed, non-personalised cosmetic reward is a grey area under the text, not clearly banned. Get a data-protection review before launch. [D]

Guard-rails I recommend. [D] unless noted:

- **No loss-framed streaks.** Do not show a "streak lost" state and do not send guilt notifications. If we show a run of days at all, use "days practised this month" (cumulative, cannot reset to zero).
- **No streak-shaming leagues; no public rankings of children.** Research on leaderboards finds low-ranked users can experience repeated failure and embarrassment ([search excerpts on leaderboard research](https://link.springer.com/article/10.1007/s11423-023-10337-7), [U]). Use personal-best ghosts and opt-in class leaderboards that show progress, not rank.
- **No variable-ratio (slot-machine) rewards, and no near-miss engineering.** If we randomise, randomise flavour (which cosmetic appears), never whether a reward arrives, and make the outcome free of purchase links.
- **No real-money purchases, no premium-only rewards, no ads.** Prodigy's alleged pattern is the anti-example ([U]).
- **No "lose out" messages** on stopping, and never punish a pause.
- **Rewards attach to learning behaviour (facts moved to fast), not to time on task.** This blunts the "performative learning" problem reported for streaks ([U]).
- **Parent and teacher visibility of session length,** and a hard daily soft cap.
- **Mastery goals over performance goals.** Mastery-oriented learners persist and learn from mistakes; performance-approach goals correlate with anxiety ([Goal orientation overview](https://en.wikipedia.org/wiki/Goal_orientation) and [Dweck 1986](https://gwern.net/doc/psychology/personality/1986-dweck.pdf), [U] from excerpts).

---

## (c) Difficulty and adaptivity spec

### What the evidence says about target success rate

- **The 85% rule (Wilson et al. 2019).** For gradient-descent learners on binary classification with Gaussian noise, the optimal training error rate is about 15.87%, i.e. about 85% accuracy ([bioRxiv full text](https://www.biorxiv.org/content/10.1101/255182v1.full), [V]). Authors' own caveats: it "remains to be generalized" to multi-choice tasks and other algorithms, and Bayesian learners would not benefit in the same way ([V]). Wilson said in interview that he "won't go so far as to say that students should aim for a B average", and that it would mostly apply to perceptual learning ([ScienceDaily](https://www.sciencedaily.com/releases/2019/11/191105113457.htm), [V]).
- **Verdict:** 85% is a reasonable prior, not a law for retrieving times-table facts. It is an argument against both easy grinding and constant failure.
- **Math Garden** (a widely used adaptive practice system) selects items so mean success is 0.75, using an Elo-style update that includes response time ([Klinkenberg et al. 2011 excerpt](https://www.sciencedirect.com/science/article/abs/pii/S0360131511000418), [U]).
- **Bjork's desirable difficulties:** spacing, interleaving and retrieval improve long-term retention even when they feel harder; blocked drilling inflates short-term fluency ([Durrington Research School](https://researchschool.org.uk/durrington/news/bjorks-desirable-difficulties), [U]).
- **Tension to design around:** the runs should feel about 80 to 90% winnable (flow), while the schedule of facts must include harder, spaced, interleaved items. Solve it by mixing item types within a run.

### Algorithm choice

| Option | Use it for | Why / why not |
| --- | --- | --- |
| **Elo-style rating per (child, fact)** | Choosing which fact to ask next and estimating difficulty | Simple, fast, works online per answer, and is widely used for adaptive fact practice ([Pelánek 2016 abstract](https://www.sciencedirect.com/science/article/abs/pii/S036013151630080X), [U]; PDF not readable). It updates item difficulty from all children, which suits 144 facts. |
| **Bayesian knowledge tracing (BKT)** | Skip for now | Has an identifiability problem: the same data can be fit by different slip, guess, learn parameters ([Baker, Corbett and Aleven 2008 excerpt](https://learninganalytics.upenn.edu/ryanbaker/BCA2008W.pdf), [U]). Better suited to multi-step problem-solving tutors than to 144 recall facts. |
| **IRT (Rasch)** | Offline calibration of fact difficulty | Use it to seed initial fact difficulties from the first few thousand answers. |
| **FSRS (spaced repetition scheduler)** | Deciding when a mastered fact returns | A memory model with difficulty, stability and retrievability; desired retention of 0.9 is a common default, with 0.70 to 0.97 seen as reasonable ([FSRS ABC wiki](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/ABC-of-FSRS), [U]). Built for flashcards with a review each session; fine for later phases. |

**Recommendation (confidence: medium).** Elo-style per-fact rating including response time for the in-run "which fact next" choice, plus a simple Leitner-style spacing rule for the "when does it return", moving to FSRS only if logging shows the simple rule underperforms. Reason: it is the least code, explainable to teachers, and consistent with published adaptive-practice work.

### Parameters (starting values, all [D])

- **Ability update (Elo):** `p = 1 / (1 + exp(-(theta - b)))`, then `theta += K_theta * (s - p)`, `b -= K_b * (s - p)`, where s is 1 for correct and fast, 0.5 for correct but slow, 0 for wrong. Start K around 0.4 for new items or children, shrinking as answers accumulate (an uncertainty-decay pattern, which the excerpt attributes to the Elo-in-education literature, [U]).
- **Target success probability:** 0.80 to 0.85 within a run for children aged 5 to 9, and 0.75 for ages 10 and over. Cap at 0.90 for anyone who had two failed runs in a row. Use the Wilson number as a prior only.
- **Speed scoring:** "fast" means faster than the child's own rolling median for that fact. Do not use a global cutoff. TTRS's 1 s to 10 s bands are a reference for tier labels, not for a 5-year-old ([V] for their bands).
- **Item selection per run of 12:** about 6 items at the target, 3 slightly easy (confidence), 2 slightly hard (stretch), 1 spaced review of an old mastered fact. Interleave tables.
- **Lane speed:** adapts to the child's median answer time for the current items plus a margin. Never speed up after a wrong answer.
- **Session-level DDA guard:** after 2 wrong answers in 3, lengthen answer time and reduce lanes from 3 to 2 for a few items, without announcing it.
- **Mastery rule:** a fact is "quick" after 3 correct answers under the child's target time across 2 different days. Demote after 2 misses.

### What to log

Per answer: child ID (pseudonymised), fact, options offered (including distractors and their type), lane chosen, time from object visible to commit, input-to-commit latency, correct or wrong, run seed, lane speed, effect settings (reduced motion on or off), device class, `baseLatency`, `outputLatency`. Per run: length, restarts, quit point, ghost beaten or not. Per session: start and stop reason (natural stop, closed, timeout). Data minimisation and retention limits apply under UK GDPR and the Children's Code. [D]

Success metrics to watch: fact-level median time trending down over 2+ weeks, retention of "quick" facts at 7 and 28 days, accuracy of about 80 to 85% across runs, and voluntary return without prompts. Do not optimise raw session length or daily active minutes.

### Tutorials without text

Alto's onboarding is a short (about two minute) guided first run ([V]). For Penguin Slide: a first run with one fact and two lanes, the correct object glows and the penguin auto-leans a little toward it, swipe hint via a ghost hand, and text only as a spoken-and-visible label for readers. Fade all hints after 3 correct actions. [D]

---

## (d) Myths versus evidence

| Myth | What the evidence says |
| --- | --- |
| "85% is the proven optimal success rate for children's learning." | The result covers binary classification with gradient-descent learners; the authors say generalisation is open ([V]). Use it as a prior. |
| "Screen shake and juice always improve games." | The sources are talks; I did not find controlled studies in the material I read. Juice needs restraint for accessibility ([U]). |
| "Coyote time and buffering are exactly 5 to 6 frames / 100 ms." | Numbers vary across hobbyist blogs ([U]). Treat as a starting range and playtest. |
| "Streaks are a healthy habit builder for kids." | Duolingo's own experiments show streaks raise retention, and that it needed freezes to soften the loss ([V]). The child-anxiety claims are anecdotal ([U]). Not proven either way for children; the precautionary route is to avoid loss framing. |
| "Leaderboards motivate everyone." | Reports say low-ranked users are harmed and top ranks motivate mostly the top ([U]). |
| "Near-misses make games fun." | In Candy Crush they were the most frustrating outcome and raised urge to continue ([V]). That is compulsion, not learning. |
| "Time pressure makes fluency practice better." | Kahoot studies are mixed. Some students report timer and music as stressful ([U]). Fluency needs speed eventually, but it can be trained with pace and not alarms. |
| "TTRS is proven to work." | Marketing and school reports show correlations ([U]). I found no independent causal study. |
| "Prodigy's approach is fine because it's free." | Alleged manipulative upselling to children per an advocacy complaint ([U]); efficacy evidence is mostly vendor-partnered ([U]). |
| "Cosmetic-only monetisation is harmless." | Crossy Road is a real case of transparent 1 USD cosmetics ([V]), but for us the safer route is no purchases at all. |
| "Reduced motion means a boring game." | Alto's showed calm can be the point ([V]). |
| "WCAG only cares about flashing red." | Both general and red flash thresholds apply, with a 3-per-second rule and an area rule ([V]). |

---

## (e) Age bands (question 4) and platform realities (question 5)

### Age bands

The evidence I could verify is thin. What I have:

- Interaction ability: ages 3 to 5 manage tapping, swiping and dragging on touch; ages 6 to 8 add mouse and trackpad clicking; ages 9 to 12 handle drag, scroll and keyboard-mouse coordination. Target size for young children at least 2 cm x 2 cm, four times the adult 1 cm ([NN/g](https://www.nngroup.com/articles/children-ux-physical-development/), [V]).
- Preferences: preferences shift quickly with age up to about 14, then broaden; a 4-year-old likes nurturing a pet, a 6-year-old a fantasy island, and a 13-year-old wants real competition ([Game Developer, developmental look at game aesthetics](https://www.gamedeveloper.com/business/children-and-their-desired-game-experiences-a-developmental-look-at-game-aesthetics), [U] from the excerpt; the page fetch timed out).
- Teen media use is a broad, heavy habit; teen boys average 56 min/day gaming and girls 7 min/day in one US census ([Common Sense Census](https://www.commonsensemedia.org/research/the-common-sense-census-media-use-by-tweens-and-teens-2019), [U] from excerpt, US data).

Proposed treatment by band. [D], based on the above and on my judgement:

| Band | Art and pace | Humour and autonomy | Social | Difficulty |
| --- | --- | --- | --- | --- |
| Reception to Y2 (5 to 7) | Big soft shapes, slow lane speed, voice-over, large 2+ cm targets, 2 lanes | Silly sounds, a pet-like penguin, dress-up | None or teacher-led; no ranking | 90% target, very forgiving buffers |
| Y3 to Y6 (7 to 11) | Brighter, more world detail, 3 lanes, missions with 3 objectives | Jokes, collection and choice of hats and worlds | Class goals, ghosts | 85%, faster pace, TTRS-style speed tiers with own-best framing |
| Y7 to Y9 (11 to 14) | Cooler, less babyish art; sleek UI; stronger sound design | Dry humour, customisation, control over settings | Optional friend or class challenges, opt-in only | 80 to 85%, real speed pressure by choice |
| Y10 to Y13 (14 to 18) | Restrained, "game-like not kid-like" visual style; do not brand as a kids' game | Autonomy: choose mode, difficulty, length | Optional, private personal bests | Use the engine for fact fluency in other subjects |

The same engine can be re-skinned per band. Note that Penguin Slide's mascot is a risk for older bands. Offer a skin choice at 11+. [D]

### Mobile, tablet and Chromebook

- **Audio unlock:** Safari on iOS only honours creating and resuming an `AudioContext` inside a live user gesture. Use a "tap to start" button. iOS also mutes Web Audio when the ringer switch is off ([MDN Autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay), [Matt Montag](https://www.mattmontag.com/web/unlock-web-audio-in-safari-for-ios-and-macos), [U] from excerpts). Tell users when sound is off. Never encode information in sound only.
- **Latency:** read `baseLatency` and `outputLatency`; Android and Chromebook have extra fixed DSP delay of about 10 ms on some devices ([U]).
- **Touch:** targets at least 2 cm for 5 to 7s ([V]); support one-thumb use; use Pointer Events; lock scrolling on the play surface; avoid edge swipes that trigger OS gestures.
- **Chromebooks:** school devices are often low-end with touchpads, no touchscreen, and shared or filtered audio. Support keyboard (left/right arrows, or 1 to 3) and trackpad as first-class. Budget for 30 fps floors and test on a low-end device. Do not tie effects to frame rate: use time-based animation. [D]
- **Battery and heat:** cap particle counts, and prefer CSS and canvas over heavy WebGL unless needed. [D]
- **Headphones:** many classrooms have none, so effects must work at low volume. [D]

---

## (f) So what for us: 10 prioritised decisions

| # | Decision | Confidence |
| --- | --- | --- |
| 1 | Ship `prefers-reduced-motion` support plus an in-game motion and sound toggle from day one; no flashing above 3 Hz and no full-screen flashes (WCAG 2.3.1). | High ([V] for WCAG text) |
| 2 | Instant restart, no menu between runs; runs of 60 to 90 s with 10 to 12 facts. | Medium (supported by teardowns [U]/[V]; the run length is my proposal) |
| 3 | Respond on `pointerdown` with under 50 ms visible reaction; add 100 to 120 ms input buffer and about 100 ms coyote window for lane commits, and log late-input separately from wrong answers. | Medium (numbers [U]/[D]) |
| 4 | Elo-style per-fact rating with response time, target success 0.80 to 0.85 (0.90 for young or struggling), one interleaved spaced review item per run; defer FSRS. | Medium |
| 5 | Reward mastery, not time: cosmetic unlocks (hats, den items) tied to facts moving to "quick"; no purchases, no ads, no premium rewards. | High for the principle (ICO text [V], Prodigy allegations [U]); medium for the details |
| 6 | Personal-best ghost and a progress reveal at the end of each run instead of public leaderboards; any class comparison is opt-in and progress-based. | Medium ([U] on leaderboard harm) |
| 7 | No loss-framed streaks, no guilt notifications, no near-miss engineering, no variable reward for whether a reward arrives; use a cumulative "days practised" count. | Medium to high (ICO Standard 5 [V]; Duolingo forgiveness [V]; near-miss study [V]) |
| 8 | Natural stop after about 5 to 8 min with a saved state and no "you'll lose out" copy; parents and teachers see session lengths. | Medium (ICO wording [V]; the timing is my proposal) |
| 9 | A calm, no-fail practice mode plus per-band skins, with 2 cm targets and 2 lanes at ages 5 to 7 and a less childish skin from about 11. | Medium ([V] for target size; the rest is [D]) |
| 10 | Build for Chromebook and iOS realities: tap-to-start audio unlock, keyboard and trackpad controls, time-based animation, low-end-device testing, and log `baseLatency` and `outputLatency`. | High for audio unlock ([U] but consistent across sources); medium for the rest |

### Open items before locking values

1. Watch "The Art of Screenshake" and "Juice it or lose it" and record actual amplitudes and durations.
2. Read Swink's *Game Feel* chapters on response and polish.
3. Get the Pelánek Elo paper text for K schedules.
4. Read the ICO's games-specific guidance directly.
5. Run a real playtest with children in each band. Everything tagged [D] should be treated as a hypothesis until then.

---

## Sources

Verified by fetch [V]:

- Wilson et al. 2019, bioRxiv: https://www.biorxiv.org/content/10.1101/255182v1.full
- ScienceDaily on the 85% rule: https://www.sciencedaily.com/releases/2019/11/191105113457.htm
- W3C Understanding 2.3.1: https://w3c.github.io/wcag21/understanding/three-flashes-or-below-threshold.html
- ICO Standard 13: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/13-nudge-techniques/
- ICO Standard 5: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/5-detrimental-use-of-data/
- Candy Crush near-miss study: https://pmc.ncbi.nlm.nih.gov/articles/PMC5445157/
- Duolingo streaks blog: https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals/
- Deconstructor of Fun on Duolingo: https://www.deconstructoroffun.com/blog/2025/4/14/duolingo-how-the-15b-app-uses-gaming-principles-to-supercharge-dau-growth
- Alto's Adventure case study: https://www.gamedeveloper.com/design/alto-s-adventure-case-study
- Crossy Road, Thumbsticks: https://www.thumbsticks.com/crossy-road-how-hipster-whale-reinvented-free-to-play/
- TTRS Rock Status: https://intercom.help/times-tables-rock-stars/en/articles/2028839-rock-status-ttrs
- TTRS for schools: https://ttrockstars.com/schools/
- NN/g on physical development: https://www.nngroup.com/articles/children-ux-physical-development/
- Art of Screenshake student summary: https://victorweidar.wordpress.com/2016/10/06/the-art-of-screenshake/
- Wiggin on ICO games tips (read; it did not cover streaks): https://www.wiggin.co.uk/insight/a-closer-look-at-the-icos-top-tips-for-games-designers-for-childrens-code-compliance/

Seen only in search excerpts [U]:

- Art of Screenshake: https://www.youtube.com/watch?v=AJdEqssNZ-U and https://archive.org/details/the-art-of-screenshake
- Juice it or lose it: https://gdcvault.com/play/1016789/Juice-It-or-Lose and https://www.youtube.com/watch?v=Fy0aCDmgnxg
- Game feel: https://en.wikipedia.org/wiki/Game_feel
- Blow on latency: http://number-none.com/blow/papers/latency.pdf (fetch failed)
- Coyote time: https://www.gamejuice.co.uk/articles/coyote-time-input-buffering, https://gamerant.com/celeste-coyote-time-mechanic-platforming-impact-hidden-mechanics/
- MDN prefers-reduced-motion: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- MDN AudioContext: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext; MDN autoplay: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay; https://www.mattmontag.com/web/unlock-web-audio-in-safari-for-ios-and-macos
- Tetris Effect audio: https://www.gamedeveloper.com/audio/game-audio-analysis---tetris-effect; flow: https://www.gamedeveloper.com/design/the-flow-applied-to-game-design
- Flappy Bird: https://theweek.com/articles/450939/what-makes-games-like-flappy-bird-addictive
- Wordle: https://slate.com/culture/2022/01/wordle-game-creator-wardle-twitter-scores-strategy-stats.html, https://techcrunch.com/2022/01/12/josh-wardle-interview-wordle/
- Threes and 2048: https://gamesbeat.com/threes-vs-2048-when-rip-offs-do-better-than-the-original-game/
- Subway Surfers: https://gameworldobserver.com/2016/06/24/subway-surfers-gameplay-analysis
- Monument Valley: https://architizer.com/blog/practice/materials/an-interview-with-ken-wong-of-monument-valley/
- Near-miss neuroscience: https://pmc.ncbi.nlm.nih.gov/articles/PMC2861872
- Duolingo criticism: https://screenwiseapp.com/guides/duolingo-streaks-and-anxiety-in-kids, https://drracheltaylor.substack.com/p/why-my-daughter-quit-duolingo-the
- Prodigy: https://fairplayforkids.org/feb-19-2021-advocates-to-ftc-prodigy-math-game-preys-on-kids-and-families/, https://www.edweek.org/technology/popular-interactive-math-game-prodigy-is-target-of-complaint-to-federal-trade-commission/2021/02, https://eric.ed.gov/?id=ED611319
- Kahoot: https://kahoot.com/blog/2025/07/17/kahoot-impact-research-academic-stress/, https://www.lifescied.org/doi/10.1187/cbe.20-08-0187, https://www.sciencedirect.com/science/article/pii/S0360131520300208
- Gimkit: https://www-gimkit.com/gimkits-economy-vs-new-casino-reward-systems/
- Elo in education: https://www.sciencedirect.com/science/article/abs/pii/S036013151630080X; Math Garden: https://www.sciencedirect.com/science/article/abs/pii/S0360131511000418
- BKT: https://learninganalytics.upenn.edu/ryanbaker/BCA2008W.pdf
- FSRS: https://github.com/open-spaced-repetition/awesome-fsrs/wiki/ABC-of-FSRS
- Desirable difficulties: https://researchschool.org.uk/durrington/news/bjorks-desirable-difficulties
- Goal orientation: https://en.wikipedia.org/wiki/Goal_orientation, https://gwern.net/doc/psychology/personality/1986-dweck.pdf
- Gamification meta-analysis: https://link.springer.com/article/10.1007/s11423-023-10337-7
- Age and game aesthetics: https://www.gamedeveloper.com/business/children-and-their-desired-game-experiences-a-developmental-look-at-game-aesthetics
- Common Sense Census: https://www.commonsensemedia.org/research/the-common-sense-census-media-use-by-tweens-and-teens-2019
