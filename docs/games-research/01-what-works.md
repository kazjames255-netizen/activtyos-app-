# Games research 01: what makes educational games work

Method note: searches this session verified the sources marked [V]. Everything marked [K] comes from background knowledge and should be spot-checked before it is quoted externally. Confidence: H / M / L.

## 1. Evidence base

- Digital games beat non-game instruction: g = 0.33 (k=57). Adding design "value" to a game gave another g = 0.34 (k=20). Effects depend on mechanics, narrative and study quality. [V] Clark, Tanner-Smith & Killingsworth 2016, https://journals.sagepub.com/doi/10.3102/0034654315582065 (H that the effect is positive and modest)
- Newer meta-analysis of school DGBL covers cognitive, metacognitive and affective outcomes. [V] Barz et al. 2024, https://journals.sagepub.com/doi/abs/10.3102/00346543231167795 (M on details; the headline is a small-to-moderate positive effect, larger for cognitive than for motivation outcomes) 
- Competition in DGBL: benefits are conditional. Competition helps most when it is between teams or is not the only mechanic. [V pointer] https://link.springer.com/article/10.1007/s11423-020-09794-1 (M)
- EEF Toolkit: feedback, metacognition and retrieval/spaced practice are consistently high-impact. Technology supports retrieval and self-quizzing when the attempt is effortful and feedback is given. [V] https://educationendowmentfoundation.org.uk/news/eef-launches-updated-teaching-and-learning-toolkit and https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit (H). Small group tuition and one-to-one tuition are also moderate-to-high impact (+4 / +5 months) [K] (M).
- Self-determination theory: autonomy, competence and relatedness drive intrinsic motivation; Ryan & Deci 2000 [K] (H). Extrinsic rewards for already interesting tasks can undermine intrinsic motivation, Deci, Koestner & Ryan 1999 meta-analysis [K] (H). Rewards for effort and progress, given unexpectedly, do least harm (M).
- Flow needs a challenge matched to skill, clear goals and immediate feedback; Csikszentmihalyi [K] (H). Desirable difficulty, spacing, interleaving: Bjork; Rohrer's interleaved maths studies [K] (H for spacing/retrieval, M for interleaving in young children).
- Mastery learning (Bloom) is a positive, moderate effect; the EEF lists +5 months [K] (M).
- "Chocolate-covered broccoli": Habgood & Ainsworth 2011 showed that integrating the learning into the core game mechanic beats bolting quizzes onto a game [K] (H).
- Leaderboards: they motivate top ranks and can demotivate low performers and raise anxiety; effects are strongest when ranking is public and permanent [K] (M).

## 2. Market teardown (all [K], M confidence unless said)

| Product | Why it works | Watch out |
|---|---|---|
| Times Tables Rock Stars | Single skill, daily short bursts, adaptive fact focus, rock-star avatars, school-wide battles, teacher heatmaps | Speed pressure and public rankings can stress anxious children |
| Numbots | Same studio; concrete-representation ladder (CPA), no time pressure early, gentle rewards | Narrow scope |
| Hit the Button, Top Marks | Zero friction, no login, 1-minute play, ideal for a tutor to project | No memory, no data |
| Sumdog | Adaptive, class contests, teacher analytics | Reward layers can dominate the maths |
| Prodigy | Huge pull (RPG); teachers get free curriculum tooling | Widely criticised: maths behind battles, membership pop-ups and pets as upsell pressure, a small share of time spent on maths. Do not copy. |
| Blooket, Gimkit, Kahoot, Quizlet Live | Live class modes, team play, varied game modes on one question bank, near-zero teacher setup; Gimkit's in-game economy keeps interest | Speed rewards guessers and fast readers; MCQ retrieval only; Kahoot-style podium leaderboards can sting |
| Duolingo | Streaks, tiny lessons, spaced review, immediate feedback, notifications | Streak anxiety, hearts and paywall friction; dark-pattern borderline for children |
| Educake, Seneca | Retrieval and spaced-review engines for KS3-5, teacher data, low gamification (Seneca: points, streaks, adaptive) | Dry for younger children; good template for KS4/5 |
| Wordwall, Boom Cards | Template-based authoring, flexible for tutors, self-marking | Quality depends on the author |
| Mathletics, Reading Eggs, Nessy, Lexia | Structured, adaptive paths; phonics-first (Nessy: dyslexia-friendly design, Lexia: strong evidence base for reading) | Reward inflation; subscription heavy |
| Minecraft Education, Legends of Learning | Open worlds and creativity; curriculum-aligned mini-games | Teacher effort; variable quality |

Pattern: the loved products share short sessions, instant feedback, a visible sense of progress, low setup for the adult, and one rich core loop. The trusted ones give the teacher data.

## 3. The 12 design principles (law)

1. The learning is the mechanic. Answering correctly IS the game action, never a toll gate to a separate game.
2. Retrieval over recognition. Prefer recall and production to multiple-choice where feasible.
3. Adaptive difficulty targeting about 80-85% success (flow; desirable difficulty).
4. Immediate, specific feedback; explain the wrong answer, then let the child retry.
5. Spaced and interleaved by default: bring back old facts automatically.
6. Mastery gating with a visible skill map (competence), not a grind.
7. Intrinsic first: reward effort, improvement and mastery; personal-best against yourself beats rank against others.
8. Autonomy: children choose the game mode, avatar and topic order within tutor-set bounds.
9. Sessions are short and end cleanly: natural stopping points, no "one more" traps.
10. Every game emits data a tutor can act on (misconceptions, speed vs accuracy, hesitation), not only scores.
11. Safe by default: no chat, no public leaderboards, no dark patterns, minimal data, calm mode available.
12. Accessible by default: WCAG 2.2 AA, reduced motion, dyslexia-friendly, colour-blind safe, keyboard/switch operable.

## 4. The 10 mechanics with the best evidence

1. Retrieval practice with feedback (H).
2. Spaced repetition and review scheduling (H).
3. Adaptive difficulty / mastery levels (M-H).
4. Immediate elaborated feedback and hints (H).
5. Integrated narrative/theme tied to the content (M; Habgood).
6. Personal progress: streaks with forgiveness, stars, personal bests (M).
7. Team/cooperative competition, class goals (M; the competition meta-analysis).
8. Interleaved mixed sets (M).
9. Concrete-to-abstract representations, manipulatives (H for maths; CPA).
10. Self-explanation and prediction prompts ("why do you think?") (M).
Also useful but weaker: avatars/customisation (M-L), timed fluency drills for fact recall after understanding (M, with an anxiety-safe option).

## 5. The 10 pitfalls

1. Chocolate-covered broccoli (game and content separate).
2. Reward overload and inflated currencies crowding out intrinsic interest.
3. Public leaderboards that shame low performers.
4. Paywalls and upsell inside the child's play loop (Prodigy).
5. Speed as the only skill signal (penalises slow readers, SEN, anxious children).
6. Streak guilt, loss aversion, push-notification nagging.
7. Endless play with no natural end; variable-ratio loot boxes.
8. Guessing exploited (MCQ spam) with no penalty or check.
9. Scores with no diagnostic value for the tutor.
10. Text-heavy or audio-only instructions that lock out young or dyslexic readers.

## 6. Age bands

- Reception-Y2 (4-7): 5-8 minute sessions. Touch/drag/tap; big targets (48px+). Almost no reading: audio-read every prompt, icons, a voice that names the answer. Bright, friendly characters; no timers; encouraging failure states. Do: concrete objects, counting, phonics, sorting. Don't: keyboard input, timers, competition, small text.
- Y3-6 (7-11): 10-15 minutes. Touch plus light keyboard; audio available on request. Playful art. Do: times-table fluency (with untimed mode), spelling, collectables, cooperative class goals, personal bests. Don't: public rank of individuals, pay-to-progress items.
- KS3 (11-14): 15-20 minutes. Keyboard plus touch. Art style: cooler, less childish, clean; customisation. Do: puzzle/strategy formats, retrieval quizzes, team modes, wagering/economy modes that reward knowledge, streaks with a grace day. Don't: babyish mascots, condescending praise.
- KS4/5 (14-18): 10-25 minutes, exam focused. Keyboard, maths-input support. Minimal art, a clean UI. Do: exam-style retrieval, spaced review queues, past-paper mistakes revisited, progress against a target grade, a tutor-set schedule. Don't: heavy cosmetics, childish reward chimes, wasted time.

## 7. Tutoring context

- 1:1 remote: games should be shareable on screen (tutor sees the child's screen state live), pausable mid-question, with tutor-side "assign this game" and "spot this misconception".
- Small group: cooperative team modes; no ranking that isolates the weakest child.
- In-person tablets: touch-first, robust offline-ish behaviour, one-tap hand-over.
- Feeding the tutor: per-skill accuracy, hesitation time, error patterns (e.g. 7x8=54), suggested next step, a two-minute post-session summary. Feeding parents: plain-English weekly progress (what improved, what to practise), never raw rank.
Confidence: M; this is design inference from tutoring evidence and product patterns.

## 8. Safeguarding and ethics (UK)

- ICO Children's Code: 15 standards; best interests of the child; nudge techniques must not push children to weaken privacy or extend use; default high privacy; data minimisation; DPIA required; age-appropriate design. [V] https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/ (H). The code also covers detrimental use of data, geolocation off, profiling off by default [K] (H).
- Defaults: no open chat; no public leaderboards; first names or avatars only, with tutor-scoped visibility; no third-party ad or analytics trackers; no cross-tenant data.
- No dark patterns: no fake urgency, no guilt copy, no loot-box randomness, no real-money links in play. The ICO and CMA/DMCC dark-pattern guidance point the same way [K] (M).
- Calm mode (SEN, autism, ADHD): no timers, no flashing, muted sound, fewer animated rewards, predictable layout, explicit "finish" button. Evidence is guidance-based (M).
- Accessibility: WCAG 2.2 AA (https://www.w3.org/TR/WCAG22/, H): 24px minimum target size (we go larger), no drag-only interactions (2.5.7, offer tap alternatives), focus visible, contrast 4.5:1, prefers-reduced-motion respected, screen-reader labels, no colour-only meaning, switch/keyboard operable. Dyslexia: sans-serif font choice, generous spacing, left-aligned, off-white background option, audio read-aloud (BDA style guide [K], M).
- Ranking fairness: rank against own baseline or a cohort of similar starting level; show effort and improvement metrics as well as raw scores; opt-in only.

## Sources
- Clark et al. 2016 https://journals.sagepub.com/doi/10.3102/0034654315582065
- Barz et al. 2024 https://journals.sagepub.com/doi/abs/10.3102/00346543231167795
- Competition meta-analysis https://link.springer.com/article/10.1007/s11423-020-09794-1
- EEF Toolkit https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit
- ICO Children's Code https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/
- WCAG 2.2 https://www.w3.org/TR/WCAG22/
- [K] items (not fetched this session): Ryan & Deci 2000; Deci, Koestner & Ryan 1999; Habgood & Ainsworth 2011; Csikszentmihalyi 1990; Bjork; Rohrer; Bloom 1984; vendor feature claims.
