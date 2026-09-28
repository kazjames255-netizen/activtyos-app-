# C. Learning science and UK curriculum evidence for Learning Hub games

Researched 2026-09-26. About 45 web searches plus fetches of primary sources. Tag convention:
- [V: url] = confirmed this session in the source text or in a search result that quoted it. Where the primary page was blocked (403/paywall) and I only saw a snippet or secondary summary, I say "(snippet)".
- [U] = not confirmed this session (from memory, secondary-only, or my own design proposal). Do not present [U] items to customers as fact.

Fetch failures to be aware of: EEF Toolkit pages (403), Nature 85% paper (auth redirect), BPS TTRS critique (403), gov.uk MTC assessment framework HTML page (404; I read the official PDF instead, which parsed).

---

## 0. Headline findings (read this first)

1. The MTC is exactly as described: 25 questions, 6 s each, 3 s pause, Year 4, tables 2 to 12 (no 1x), but with important detail below (weighting toward 6,7,8,9,12; no reversals; 121 item pool; no pass mark; explicitly "not a diagnostic tool"). [V: https://assets.publishing.service.gov.uk/media/62384958e90e0779a5e700c3/2018_MTC_assessment_framework_PDFA_updated_for_2022.pdf ; https://www.gov.uk/government/publications/multiplication-tables-check-administration-guidance/multiplication-tables-check-administration-guidance]
2. Retrieval practice and spacing are the best-supported levers for fact fluency; both have solid meta-analytic and multiplication-specific classroom evidence. Speed pressure is the contested part: the MTC itself is timed by design, but timed drill as the *learning* mode has no strong trial support and has plausible anxiety costs for some pupils.
3. The "85% rule" is a theoretical result for a narrow class of learners/tasks (binary classification, gradient-descent learners). It is a useful default target, not a law for human fact learning. Use ~80-90% in-session accuracy as a tunable range and validate on our own data.
4. Game evidence is modest: digital games beat non-game conditions by about g = 0.33 on average, and design (not "being a game") is what matters. Games must therefore embed retrieval, spacing and feedback, not decorate them.
5. Game telemetry is a formative signal, not a mastery certificate. See section 5 for weights.

---

## 1. What the evidence says (question 1)

### 1.1 Retrieval practice (testing effect)
- Roediger and Karpicke 2006: repeated testing beat restudy on delayed tests (2 days, 1 week) even though restudy won at 5 minutes and felt more confidence-building. [V: https://journals.sagepub.com/doi/10.1111/j.1467-9280.2006.01693.x (snippet)]
- Adesope et al. 2017 meta-analysis: practice testing vs other activities g ≈ 0.61 (CI 0.58-0.65). Rowland 2014 reports ~0.50; effect grows with retention interval. [V: https://journals.sagepub.com/doi/abs/10.3102/0034654316689306 (snippet)]. Caveat: mostly lab and classroom text/vocabulary tasks, mixed ages; effect sizes are not guaranteed for Y3-4 multiplication.
- Multiplication-specific: Ophuis-Cox et al. 2023, 48 second-graders, flashcard retrieval beat chanting (restudy) with three spaced sessions. Small sample, short-term. [V: https://onlinelibrary.wiley.com/doi/10.1002/acp.4141 (snippet)]
- Dunlosky et al. 2013 rated practice testing and distributed practice as the "high utility" techniques of ten. [V for existence/scope: https://journals.sagepub.com/doi/abs/10.1177/1529100612453266 ; the "high utility" ratings themselves are [U] this session; widely reported]
- Ofsted maths review: "Frequent, low-stakes testing of taught content can help prepare pupils for summative tests." [V: https://www.gov.uk/government/publications/research-review-series-mathematics/research-review-series-mathematics]

### 1.2 Spacing
- Cepeda et al. 2008 (1,350 people, gaps up to 3.5 months, tests up to 1 year): optimal gap rises with retention interval; as a proportion of the retention interval optimal gap was about 20-40% at a 1-week test delay and 5-10% at 1 year. Too-short gaps are the common error. [V: https://files.eric.ed.gov/fulltext/ED505660.pdf]. Caveat: trivia facts in adults, not tables in children.
- Rosenshine: daily review (5-8 min at lesson start) plus weekly and monthly review. [V (secondary summary): https://www.innerdrive.co.uk/blog/guide-rosenshine-10-principles/ ; original https://www.aft.org/sites/default/files/Rosenshine.pdf listed]

### 1.3 Interleaving
- Rohrer et al. 2020, preregistered cluster RCT, 787 grade-7 students, 54 classes: interleaved maths practice d ≈ 0.83 on an unannounced test at least one month later (61% vs 38%). Teachers reported interleaving took more time. [V: https://gwern.net/doc/psychology/spaced-repetition/2019-rohrer.pdf (snippet)]. Caveat: this is *problem-type* (strategy selection) interleaving in secondary maths. For raw fact recall, interleaving mainly adds spacing and reduces operand-interference risk; the effect on tables is [U]. It also raises errors during practice, so pupils need to be told.
- Bjork "desirable difficulties": conditions that depress in-session performance can enhance long-term retention/transfer; performance is an unreliable guide to learning. [V: https://journals.sagepub.com/doi/10.1177/1745691615569000 (snippet)]. Design consequence: in-game accuracy/streaks are not learning. Do not optimise them.

### 1.4 Feedback timing and content
- EEF: feedback +6 months average; slightly more for primary (+7) than secondary (+5) per a search summary of the Toolkit page. [V (snippet, page 403 to fetch): https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/feedback]. Toolkit effects are cross-study averages of varying quality.
- Timing: Kulik and Kulik 1988 (53 studies): applied classroom studies favoured immediate feedback; lab list-learning studies favoured delayed; delayed feedback helped in most retention studies over ~1 week. Effect size 0.34 overall. [V: https://journals.sagepub.com/doi/abs/10.3102/00346543058001079 (snippet)]. Bangert-Drowns 1991: 0.26 for feedback in test-like events. [V snippet]. A 2023 study reports immediate and delayed equally beneficial in formative MCQ. [V snippet: https://asmepublications.onlinelibrary.wiley.com/doi/full/10.1111/medu.15287]. Practical reading: for novice fact learners, immediate corrective feedback showing the correct answer is safe; the important part is that the item is retested later after a gap.
- Hypercorrection: high-confidence errors are more likely to be corrected when feedback is given, but they can return after a week, so re-test them. [V: https://link.springer.com/article/10.3758/s13423-011-0173-y (snippet)]. This makes confidence ratings genuinely useful for both learning and tutor insight.

### 1.5 Worked examples and fading
- Worked-example effect on maths performance: g ≈ 0.48 (meta-analysis, Educational Psychology Review 2023). Self-explanation prompts moderated results (in that meta-analysis, negative vs plain worked examples). [V: https://link.springer.com/article/10.1007/s10648-023-09745-1 (snippet)]
- Faded worked examples beat full worked examples for later post-test performance (Renkl, Atkinson and Maier 2000). [V (snippet): https://link.springer.com/article/10.1023/B:TRUC.0000021815.74806.f6]
- Expertise reversal: worked examples help novices and can hurt those with prior knowledge, so fading should be tailored to individual expertise. [V (secondary): https://link.springer.com/article/10.1007/s11251-009-9102-0]
- Ofsted: "pupils can learn from worked examples, particularly if teachers help pupils to make sense of worked examples." [V: Ofsted maths review URL above]
- Kirschner, Sweller and Clark 2006: minimally guided instruction is inferior for novices; guidance recedes in value as prior knowledge rises. [V: https://www.tandfonline.com/doi/abs/10.1207/s15326985ep4102_1]. Applies to games: discovery-only mechanics are a risk for novices.

### 1.6 Time pressure, speed and maths anxiety (the contested one)
What is solid:
- Automaticity matters: Ofsted says pupils lacking automatic recall struggle because "working memory [is] overloaded"; many basic facts must be automatic. [V: Ofsted maths review URL]
- The MTC designers chose 6 s to allow recall while limiting working-out, after trialling 3 time limits with 1,124 pupils. [V: MTC framework PDF above]
- EEF KS2/3 maths guidance lists developing fluent recall of number and multiplication facts as a recommendation. [V (snippet): https://educationendowmentfoundation.org.uk/education-evidence/guidance-reports/maths-ks-2-3]
- IES practice guide (struggling students): about 10 minutes per intervention session on fact retrieval; evidence rated Moderate. [V (snippet): https://ies.ed.gov/ncee/wwc/practiceguide/26]
- Ofsted: anxiety is rooted in failure to acquire knowledge; building core knowledge and success is the route out. [V: Ofsted maths review URL]

What is contested:
- Boaler/YouCubed and others claim timed tests cause maths anxiety and block working memory, especially in high-working-memory pupils. Ramirez et al. 2013 does find maths anxiety hurts achievement in higher-working-memory children. [V: https://sites.temple.edu/cognitionlearning/files/2013/09/Ramirez-et-al-2013.pdf (listed); the "one third begin anxiety at timed tests" number is a Boaler assertion, [U]/weak evidence]. The claim that timed tests *cause* maths anxiety is correlational-heavy; I found no RCT in this session. Ramirez, Shaw and Maloney 2018 and NCTM position advocate avoiding timed tests as fluency measures. [V (snippet): https://www.nctm.org/Standards-and-Positions/Position-Statements/Procedural-Fluency-in-Mathematics/]
- Counter: speed is part of what "fluent" means in England (MTC). TTRS-style timed play has no formal effectiveness study; the BPS critique says the same. [V (snippet, page 403): https://explore.bps.org.uk/content/bpsdeb/1/189/14 ; https://en.wikipedia.org/wiki/Times_Tables_Rock_Stars states no formal studies]

Evidence-based synthesis (my inference, [U] as a package): use timing for *measurement* of fluency and for a clearly labelled, opt-in speed mode; keep *learning* mode untimed or with generous, soft, adaptive time; never show public leaderboards of speed to pupils with slow profiles; and offer a per-pupil "no timer" option (also needed for SEND).

### 1.7 Cognitive load, multimedia and games
- Sweller cognitive load and Mayer: coherence principle (remove extraneous material) supported in 23/23 experiments, median d 0.86. [V (snippet): https://pmc.ncbi.nlm.nih.gov/articles/PMC9762622/ or https://www.digitallearninginstitute.com/blog/mayers-principles-multimedia-learning]. Design consequence: penguin theming, sound, and particle effects must not sit on the question stem or answer input during a trial.
- Digital games vs non-game conditions g = 0.33 (57 studies); value-added game designs g = 0.34. [V: https://journals.sagepub.com/doi/10.3102/0034654315582065]. Heterogeneous and often short studies; publication bias likely.
- EEF digital technology guidance: how technology is used matters; use to supplement not replace teaching; MathsFlip trial ~+1 month. [V (snippet): https://files.eric.ed.gov/fulltext/ED612112.pdf]

### 1.8 Fluency, strategies and derived facts
- Baroody: development runs counting strategies to reasoning strategies to mastery; teach reasoning strategies (use known facts to derive unknown), not drill in isolation; guided-strategy software beat comparison groups on unpracticed combinations. [V (snippet): https://experts.illinois.edu/en/publications/why-children-have-difficulties-mastering-the-basic-number-combina/]
- Error patterns: operand-related errors (answer belongs to the table of one operand, e.g. 7 x 4 = 24) are about 76% of children's errors; problem-size effect; tables with 6, 7, 8 are hardest. [V (snippet): https://link.springer.com/chapter/10.1007/978-3-319-22017-8_3 and https://pmc.ncbi.nlm.nih.gov/articles/PMC9716515/]. Consistent with the MTC weighting of 6,7,8,9,12. [V: MTC PDF]
- Meta-analysis of fact fluency interventions for maths difficulties exists (2026) but I only saw a title. [V title only: https://pubmed.ncbi.nlm.nih.gov/41787952]. Cover-copy-compare, flashcards, performance feedback and self-monitoring are the standard components in the component analysis. [V (snippet): https://www.researchgate.net/publication/230048534]

### 1.9 EEF headline effects (context)
- Metacognition and self-regulation +8 months (+8 primary, +7 secondary), high security. [V (snippet): https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/metacognition-and-self-regulation]. Confidence ratings and "I think I know it" prompts in games are cheap ways to build this, and doubly useful for calibration insight.
- Mastery learning: about +6 months average; a US study found six months or more in maths for 13-14 year olds. [V (snippet): same search]

---

## 2. Design spec from evidence (numbered requirements)

Each requirement cites the evidence tag above (section reference plus source).

Structure and content
R1. Learning mode is retrieval-first: every fact is attempted (not shown) before feedback, except a brief first-exposure study/strategy card. Source: 1.1 Roediger and Karpicke; Ophuis-Cox.
R2. Include a short strategy card before practising a table (e.g. 9x = 10x minus x; 4x = double double; 6x = 5x plus x; 11x pattern; 12x = 10x plus 2x). Practice then requires recall, not the strategy. Source: 1.8 Baroody; Ofsted "rather than rely on derivation" [V: Ofsted] means strategies scaffold and then fade, they are not the endpoint.
R3. Fade the scaffold: full strategy card, then partial (blank step), then none, driven per pupil by accuracy and response time. Source: 1.5 Renkl; expertise reversal (Kalyuga).
R4. Introduce facts in curriculum order: Y2 (2,5,10), Y3 (3,4,8), Y4 (6,7,9,11,12). Source: National Curriculum programme of study. [V: https://www.gov.uk/government/publications/national-curriculum-in-england-mathematics-programmes-of-study ; year splits confirmed via search results https://assets.publishing.service.gov.uk/media/5a7da548ed915d2ac884cb07/PRIMARY_national_curriculum_-_Mathematics_220714.pdf (snippet)]. Note the NC lists 6, 7, 9, 11, 12 as the remainder for Y4 by inference, [U] on the exact wording for 6/7/9/11.
R5. Treat a x b and b x a as the same underlying fact strength ("66 unordered facts" 2..12), but present both orders and cover both mental images. (Fact strength shared across orders is [U]; the order effect exists per [V] Campbell-type literature snippet, so check with data whether commuted pairs really transfer.) MTC never shows both orders in the same form. [V: MTC PDF]
R6. Fact families: after both x facts of a pair are secure, interleave the two division facts and a missing-number form (? x 7 = 42). Source: NC Y4 says "multiplication and division facts" [V: MTC PDF quoting NC].

Practice schedule
R7. Spaced by default. Minimum intra-session gap of at least ~3 other items before a retest; the first cross-day retest within 1 day; expanding gaps thereafter, proportional to the desired retention interval (see 3.2). Source: 1.2 Cepeda.
R8. Errors: show the correct fact for at least 2 s, have the child re-type or tap it once (generation), then re-test it within the session after 3-6 intervening items, and again the next day. Source: 1.4 feedback, hypercorrection (retest returns of errors).
R9. Session length 5-10 minutes; 10 minutes maximum of pure fact retrieval per session for intervention contexts. Source: IES. Short daily sessions over long weekly ones (1.2).
R10. Interleave tables in practice after the initial introduction of each table (mix at least 2 tables); block only the first-exposure phase. Source: 1.3 Rohrer (for the general direction; for tables [U]).

Difficulty and success
R11. Target in-session accuracy between 80% and 90% (default ~85%), adjust by pupil; do not tune to 100% and do not show the pupil this number. Source: Wilson 2019 (theory, [V snippet: https://www.nature.com/articles/s41467-019-12552-4]); Rosenshine "obtain a high success rate" [V secondary]. Validate empirically (section 6).
R12. Timing is off during learning by default, but response time is always recorded (see 3.3). Optional soft timer ("beat your own time") after a fact reaches "accurate". Source: 1.6.
R13. Offer a per-pupil "no timer, no speed feedback" setting for SEND, anxiety and any tutor override. Source: 1.6; section 4.

Distractors and answer input
R14. Prefer free-numeric-entry over multiple choice for fact-strength measurement, because MCQ inflates recognition and enables guessing. Use MCQ only in the Penguin Slide *motion* mechanic if needed, then require typed entry for the mastery-eligible item. (Evidence base: testing effect is larger for recall than recognition, [U] this session: Adesope moderators not read.)
R15. Any multiple-choice distractors are misconception-based, drawn from actual error types. Source: 1.8 error-type literature. Types: (a) operand-table neighbours (7 x 4 -> 24, 21, 35), (b) adjacent multiples of one operand (±b or ±a), (c) digit reversal (42 -> 24), (d) addition instead of multiplication (7+4 = 11), (e) off-by-one/two, (f) the 10x pattern error (9 x 6 = 45/64). Each distractor tagged with its error type so tutors can see misconception mix.
R16. Distractor number must never make the correct answer identifiable by surface (e.g. only even numbers, or only one in the correct table). Source: general test design, [U].

Feedback and metacognition
R17. Ask an occasional confidence rating ("sure / not sure") on ~20% of trials (not every trial) to build metacognition and to detect confident errors; prioritise re-teaching of confident errors. Source: 1.4 hypercorrection; 1.9 EEF metacognition.
R18. Feedback language is about the fact and strategy, never the child. Source: EEF feedback; anxiety pathway in Ofsted.

Motivation without harm
R19. Reward practice quality and improvement (fact-strength gains, retrieval streaks across days, "revived a fading fact"), not raw speed or raw score. Source: 1.3 Bjork (performance is not learning).
R20. No public speed leaderboards for pupils; tutor/parent can see private progress. Source: 1.6 anxiety concern (contested, therefore precautionary).

Design of the interface
R21. Nothing decorative on the question stem or answer while the item is live; animations occur between items. Source: 1.7 Mayer coherence.
R22. Keyboard/tap targets large, number-pad layout consistent with the MTC (standard layout so muscle memory transfers). Source: MTC PDF (onscreen number pad, keyboard/touch/mouse).

MTC and curriculum alignment
R23. Provide an "MTC practice" mode that mirrors the official spec (section 4). R24. Do not present MTC-mode results as a predictor of the pupil's actual MTC score without local calibration (section 6). R25. Never store or display "pass/fail": the MTC has no expected standard. [V: MTC admin guidance]

---

## 3. Fact scheduling and difficulty algorithm (proposal)

### 3.1 Data model per pupil per fact (66 unordered facts, 2..12 x 2..12; 1x optional, tables to 12)
- `S` stability estimate (days for recall probability to fall to ~90%, FSRS-style [V: https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler ; DSR definitions confirmed in search snippets]).
- `D` difficulty (prior from table and problem size: 6,7,8,9,12 harder; large products harder; Campbell/problem-size [V snippet]).
- `lastSeen`, `nAttempts`, `nCorrect`, `rtEwma` (log-RT EWMA), `errTypes` counts, `confidentErrors`.
- `state` in {new, learning, accurate, fluent, retained}.

### 3.2 Scheduling rule (proposed defaults; tunable, all [U] until calibrated)
Use an FSRS-lite update (do not implement full FSRS; we do not have review-log volume to fit 19+ parameters. FSRS itself needs fitting on review history and is designed for adult flashcards [V snippet]; Elo/Pelánek is the low-data alternative [V: https://link.springer.com/article/10.1007/s11257-016-9185-7]).

Grade each trial to a score g:
- 0 = wrong; 1 = correct but slow or hinted or low confidence-plus-wrong-pattern; 2 = correct within the pupil's own reference RT; 3 = correct and fast (see 3.3).

Update:
```
R  = exp(-t_since / S)              # retrievability estimate, t_since in days
if g == 0:   S = max(S_min, 0.4*S);  relearn_soon = true; enqueue in-session retest after 3-6 items; also next day
if g == 1:   S = S * (1 + 0.3*(1-R)/D)
if g == 2:   S = S * (1 + 1.0*(1-R)/D + 0.3)
if g == 3:   S = S * (1 + 1.6*(1-R)/D + 0.3)     # desirable-difficulty term: lower R -> bigger gain
next_due = now + S * ln(1/target_R)   # target_R default 0.85-0.90 per Cepeda proportionality
```
Constraints: S_min = 5 minutes (so a wrong fact returns in-session); first interval after first success 10-20 minutes in-session then next day; cap interval at 30 days for Y2-Y4 pupils in a term; never exceed the next MTC window date minus 3 days when MTC prep is active (Cepeda: optimal gap depends on retention interval [V]).

### 3.3 Response-time bands (fluency thresholds)
No official response-time norm exists apart from the MTC 6 s cap (which includes input time). Proposed bands (all [U], calibrate):
- Personal baseline: median RT on the pupil's own "known easy" facts (2x, 10x, 5x) = `rt0`. Speed relative to `rt0` controls for typing/motor speed, EAL reading time and SEND. Fluent = RT ≤ ~1.5-2 x `rt0` on the correct answer, and within 3.0 s for pupils without input difficulties.
- Retrieval vs calculation heuristic: RT under ~3 s is treated as retrieval, 3-6 s as "reconstructed / derived", over 6 s or with visible counting as "calculated". The 6 s MTC limit is designed to exclude working-out [V: MTC PDF], so the 3-6 s band is the "MTC risk zone".
- Discard RT for trials under ~0.4 s (rapid guessing / mis-taps) from fluency estimates and flag as low-effort. Rapid-guess RT threshold approaches: Wise and Kong response-time effort; methods give similar results [V (snippet): https://eric.ed.gov/?id=ED490202].

### 3.4 When is a fact "learned"? (mastery criteria)
Proposed states (need calibration):
- `accurate`: ≥ 3 correct across ≥ 2 separate days, no error in last 3 attempts, unaided.
- `fluent`: `accurate` and RT ≤ fluent band on ≥ 3 of last 4 attempts.
- `retained`: `fluent` and correctly recalled after a gap ≥ 7 days (Cepeda-style ridgeline: spacing proportional to test delay [V]).
A fact regresses one state on an error after a gap; demote confident errors more strongly.

### 3.5 Introducing new facts and session composition
- Session of ~24-40 trials (5-8 min). Composition: ~50% due reviews (lowest R first), ~20% "fragile" recent errors, ~20% new/learning facts, ~10% mixed-table interleaved checks and division/missing-number variants for `fluent` facts.
- Introduce a new table only when ≥ 80% of the current curriculum-stage table's facts are `accurate` and rolling accuracy ≥ ~85% (Wilson-style adjustment: if rolling accuracy > 92%, introduce sooner and reduce scaffolds; if < 75%, slow introduction, add strategy cards, reduce interleaving).
- Order within a table: 2,5,10 first (KS1), then 3,4,8, then 6,7,9,11,12 (NC). Within a table, anchor facts first (x1 not tested in MTC; x2, x5, x10 anchors), then derived neighbours with the strategy card. Ordering by NC year: [V snippet]. Ordering within a table is [U].

### 3.6 Pseudo-code
```
function nextItem(pupil, session):
  candidates = facts in curriculumScope(pupil)   # year band or tutor-set scope
  due   = [f for f in candidates if f.state != new and f.nextDue <= now and f not in recentlySeen(3)]
  fragile = [f for f in candidates if f.lastWasError and minGapMet(f, 3 items)]
  new_ok = allowNewFact(pupil)                    # accuracy and accurate-fraction gates (3.5)
  choose by weights: 0.5 due (min R), 0.2 fragile, 0.2 new (if new_ok else due), 0.1 mixed/variant
  avoid same table 3 times in a row after phase-1 blocking
  format = choose_format(f)                       # recall > cued > strategy card, per fade level
  return f, format

function onAnswer(f, answer, rt, confidence):
  correct = answer == f.product
  errType = classifyError(f, answer) if not correct   # operand-neighbour, add-instead, reversal, etc
  g = grade(correct, rt, rtBaseline(pupil), confidence, hintUsed)
  updateStability(f, g); f.rtEwma = update(f.rtEwma, log(rt)) if rt > 0.4s
  if not correct: show correct fact >= 2s, require re-entry, enqueue retest at +3..6 items and next day
  log(event)   # section 6 schema
  adapt(pupil.difficulty, rollingAccuracy(30 trials), targetRange=[0.80, 0.90])
```

### 3.5 Toy simulation (throwaway, not evidence)
Script: `scratch` dir at `/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/9019c60e-ba39-4e52-8a1c-d81f4f3bd850/scratchpad/sim.py`. Simulated a simple forgetting learner (exp decay with stability that grows more when retrievability is low), 6 weeks, 40 trials/day, weekdays only, then a 25-item delayed check 3 days later, 30 runs. Results: random 5.6/25, blocked-by-table 5.5/25, adaptive-due-first 7.0/25 (facts above 90% recall at test: random 12.5, blocked 10.4, adaptive 2.7). Interpretation: the adaptive scheduler is modestly ahead on the MTC-like score in this toy model, but the toy learner's parameters are invented, absolute numbers are meaningless, and the "facts > 90%" metric favours random because the adaptive policy introduces new facts continuously and leaves fragile ones at borderline retrieval. It shows only that the pipeline works and that "high success rate" targets and expanding gaps are worth testing on real data. It is NOT validation. [U]

---

## 4. MTC-mode spec

Official spec (verified):
- Year 4 statutory, delivered online/onscreen. Under 5 minutes. 25 questions, 1 mark each, form n1 x n2 = ?, 6 s per question starting when it appears, 3 s pause after answer, answers by keyboard, mouse+onscreen number pad or touch+onscreen number pad; can press Enter to proceed early. 3 practice questions in the "try it out" mode, unlimited retakes there. [V: framework PDF and https://www.gov.uk/government/publications/multiplication-tables-check-administration-guidance/multiplication-tables-check-administration-guidance]
- Items drawn from the 121 items of tables 2 to 12; 1x excluded from the check. Table limits per form (by first factor): 2: 0-2; 3: 1-3; 4: 1-3; 5: 1-3; 6: 2-4; 7: 2-4; 8: 2-4; 9: 2-4; 10: 0-2; 11: 1-3; 12: 2-4; second factor is monitored to stay within ±1 of those limits. KS1 tables (2,5,10) minimised. No form repeats an item; no reversals in the same form (3x8 excludes 8x3); no more than 30% overlap between forms; items not ordered by difficulty. [V: framework PDF]. (Two extractions of the 10/11/12 rows were garbled in the parsed PDF, the values above match a secondary source [V snippet: https://thirdspacelearning.com/blog/year-4-multiplication-times-tables-check-new-assessment-framework/]; re-verify against the PDF before shipping.)
- No expected standard/pass mark; score /25; "not intended as a diagnostic tool"; results not published at school level. [V: framework PDF; admin guidance]
- 6 s limit came from STA research with 1,124 pupils and 3 tested limits. [V: framework PDF]
- Access arrangements: colour contrast, font size, extra-long pauses with a Next button, audio, input assistance, audible time alerts, removal of the number pad; NO extra answer time (would defeat fluent recall). [V: admin guidance page; snippet from search: "Pupils cannot have additional time"]
- Room: no calculators, no wall displays. [V: framework PDF]

Our MTC mode:
M1. "Try it out" (3 items, unlimited) and "Full practice" (25 items) exactly as above with generated forms obeying the table limits, no reversals, no 1x, and no more than 30% overlap with the previous form for that pupil.
M2. 6 s countdown per item started at item render (visible timer by default, with the option to hide for anxiety, tutor-controlled) and 3 s inter-item pause; count a timed-out empty answer as incorrect. Accept early submission with Enter.
M3. Number pad layout same as the official (3x4 grid style is [U], verify against the "try it out" screen).
M4. Access arrangements mirrored: high contrast, larger text, extended pause with Next button, audio question (text-to-speech), audible time alerts. No extra answer time inside the labelled MTC mode. A separate "untimed diagnostic" mode with the same items is available for pupils who need it, clearly labelled as not MTC-like.
M5. Output: score /25, plus the per-fact record (facts missed, timed-out vs wrong answer, RT). Do NOT label as pass/fail or "expected standard"; label as "practice score" and show a confidence-interval-style note: a 25-item form has a large measurement error. [U on exact SE; local calibration in section 6]
M6. Tutor view: which tables/facts caused misses, and "timed-out but would-have-been-right" (answered correctly in untimed follow-up) vs "did not know". Suggested follow-up: retest missed facts untimed for diagnosis.
M7. Cadence: not more than 1 full MTC-mode per week per pupil, since repeated timed testing risks anxiety (contested, [V discussion in 1.6]) and the game would be teaching to the test.
M8. Do not use MTC mode for pupils outside Y4 by default; allow tutors to set it for Y3/Y5+ as "fluency check".

---

## 5. Curriculum alignment by year (England)

| Year | Statutory times tables content | Game scope | Source |
|---|---|---|---|
| Y2 | 2, 5, 10 tables, connecting them | Penguin Slide stage 1 | [V (snippet): NC programme of study via search result] |
| Y3 | 3, 4, 8 tables | stage 2 | [V snippet] |
| Y4 | tables up to and including 12; "recall multiplication and division facts up to 12 x 12" | stages 3 to 4 + MTC mode | [V: MTC framework PDF quotes NC] |
| Y5+ | fluency maintained; factors, multiples, then use in fractions, ratio, algebra | retention, mixed and division/missing-number variants | [V general: EEF KS2/3 fluency recommendation snippet] |

Tutors may also tag Reception/Y1 number bonds and Y5-Y13 retention, but I did not verify NC wording for those in this session. [U]

Transfer to division, fractions and algebra: Ofsted: unless pupils know facts to automaticity, problem solving overloads working memory. [V: Ofsted maths review]. Direct evidence that game-based table fluency transfers to fractions/algebra is [U] and we should measure it (section 6).

---

## 6. Tutor insight and telemetry

### 6.1 Event schema (privacy-safe)
One event per trial. No free text from children, no device IDs beyond a pseudonymous learner id scoped to a tenant, no precise timestamps beyond ms deltas plus a coarse date. Store server-side via the API only.
```
game_trial {
  tenantId, learnerId(pseudonymous), sessionId, gameId, gameVersion,
  itemId (e.g. "mul:7x6"), skillTags [table:7, table:6, year:4, family:x42],
  presented_at_bucket (hour), mode (learn|review|mtc|untimed|challenge),
  timerMode (none|soft|hard6s), responseFormat (typed|mcq|tap),
  answer (numeric), correct (bool), errorType (operand_neighbour|add_instead|reversal|off_by_1|off_by_2|table_confusion|timeout|blank|other),
  rt_ms, inputTime_ms (first key to submit), firstKey_ms,
  hintUsed, scaffoldLevel(0-3), attemptIndexOnItem, gapSinceLastSeen_s,
  confidence (null|sure|unsure), distractorTypes (for MCQ) , focusLost(bool),
  accessibility {ttsOn, contrast, noTimer}   # aggregate use only, never used for ranking pupils
}
session_summary { sessionId, duration_s, nTrials, accuracy, tablesCovered, quitEarly(bool) }
```
Data-protection note: UK children's data => ICO Age Appropriate Design Code applies [U: not verified this session]; minimise data, no third-party analytics on child events, retention limit, tutor/parent access only, no profiling for advertising.

### 6.2 Tutor metrics (all computed server-side)
1. Fact-strength heatmap: 11x11 grid (first factor by second), colour = state (new/learning/accurate/fluent/retained), shading = recency-weighted P(recall now). Symmetric pairs merged or shown with a note when the two orders differ.
2. Response-time profile: median log RT by table and by fact, with pupil's own `rt0` baseline; "retrieval / reconstruct / calculate" band split.
3. Misconception report: error-type mix per pupil, top confusable pairs (e.g. answered 24 for 7x4), "adds instead of multiplies" flag (only when ≥ 3 events), operand-neighbour errors by table.
4. Confidence calibration: proportion of "sure" answers that were wrong (confident-error rate), and "unsure but correct". Confidently wrong facts get priority. [V for the learning use: hypercorrection snippet above]
5. Retention: recall after ≥ 7-day gaps by fact and table; forgetting rate.
6. Practice quality: number of spaced days in the last 14, session length, trials per day, and the share of trials in the 80-90% band.
7. MTC readiness (practice only): expected MTC-like score with an interval, split by tables; tagged "indicative".
8. Effort flags: rapid-guess share (RT < ~0.4 s), timeouts, focus loss, quit early; shown as "engagement notes", not judgements.
9. Cohort view for tutors: which facts are weakest across their pupils, and suggested small-group focus.
10. Transfer probes: quarterly untimed division/missing-number/fractions items, reporting whether fact strength correlates with those.

### 6.3 What NOT to infer from game data
- Do not infer maths anxiety, dyscalculia, ADHD, dyslexia or any diagnosis (the MTC framework itself says it is not a diagnostic tool [V]; Ofsted notes SEND heterogeneity [V]).
- Do not infer understanding or conceptual knowledge from fact-recall accuracy (Ofsted separates declarative/procedural/conditional knowledge [V]).
- Do not infer effort or honesty from RT alone (motor speed, reading speed, EAL, input device).
- Do not compare pupils by raw speed across devices or input methods.
- Do not treat in-session accuracy as learning (Bjork [V]); use delayed retention.
- Do not infer ability from a single session or one 25-item MTC-mode run.
- Do not infer school-level performance or Ofsted-facing measures.

---

## 7. Generalising to the other launch games (question 3)

Common principle: every game needs (a) a retrieval trial, (b) a scoreable response, (c) an item id mapped to a skill/tag, (d) delay/gap tracking, (e) an optional confidence rating, (f) an error-type label. The reference schema in 6.1 fits all four with per-game `errorType` vocabularies and `itemId` conventions.

### Iceberg Detective (error-finding)
- Measures: detection accuracy, false alarms (flagging correct text as wrong), diagnosis accuracy (correct type of error), and correction quality; plus confidence.
- Signal-detection framing: hit rate vs false-alarm rate separate real detection from "flag everything" gaming (this is [U] as an educational claim but standard in measurement).
- Tutor insight: per-error-type detection (e.g. punctuation, subject-verb, decimal place-value), and which mistakes the pupil accepts as correct (a misconception in itself).
- Evidence: error-based/worked-example-with-errors research exists but I did not verify effect sizes this session. [U]. Note Kirschner et al.: novices need guidance; do not use error detection for first exposure. [V: 1.5]
- Not to infer: that finding errors implies the pupil produces correct work.

### Verb Tides (conjugation)
- Measures: accuracy by person/tense/verb class (regular, irregular, stem-changers), RT, error types (wrong ending, wrong stem, wrong person, wrong tense, English interference), confidence, spacing.
- Evidence: Ofsted MFL research review exists (7 June 2021) and covers progress-oriented curriculum, assessment, and pedagogy; I could not verify its wording about retrieval or spacing this session. [V for existence: https://www.tandfonline.com/doi/full/10.1080/09571736.2022.2045681 (snippet); wording [U]]. Retrieval practice in language-learning children: studies with typical and language-impaired children exist [V snippet: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8084525/]; effect sizes not verified.
- Tutor insight: heatmap verb x person, error mix (ending vs stem), which irregulars are secure, retention across gaps.
- Not to infer: speaking or listening competence from typed conjugation.
- Accents/keyboard: never mark an accent error as wrong for a pupil with a non-Spanish/French keyboard in the same category as a stem error; log separately.

### Deep Freeze (flashcards)
- This is the purest retrieval/spacing engine; use the section 3 scheduler directly. Measures: recall accuracy, RT, self-rated confidence, forgetting rate by deck and tag, retrieval before reveal (do not allow flip-without-attempt to count).
- Guess-avoidance: require a committed answer (type or select) before reveal to get credit; self-grading "I knew it" is an unreliable mastery signal (illusion of knowing: Roediger and Karpicke restudy confidence effect [V]).
- Tutor insight: weakest cards, cards that are repeatedly forgotten (leeches), cards where confidence and accuracy diverge.

### Pip's Homework Clinic
- Measures depend on the clinic design (diagnose a "patient's" wrong answer?). If it is error diagnosis + correction: same as Iceberg. If it is help-seeking: hint usage and help-seeking patterns are a metacognition signal (EEF metacognition +8 months [V snippet]) but be careful not to penalise help-seeking.
- Tutor insight: which topics generate most hint use; misconception library coverage.
- Not to infer: that the pupil did their own homework.

Cross-game insight layer: a per-learner concept/skill graph with fact/skill strength (0-1 P(recall now)), last seen, evidence weight. Tutors see the same heatmap idiom across games.

---

## 8. SEND and accessibility (question 4)

Caution up front: the evidence for game-specific adaptations is thin; most items are drawn from general guidelines. Every recommendation below is a setting or option, never an auto-applied label.

- Dyscalculia / maths difficulties: Ofsted says pupils with SEND benefit from "explicit, systematic instruction and systematic rehearsal" and that many autistic pupils have strong declarative memory and algorithmic thinking [V: Ofsted maths review]. Working-memory supports (external aids such as multiplication charts, reducing load, chunking, embedding WM support in maths context) are recommended; general WM training transfers poorly. [V (snippet): https://pmc.ncbi.nlm.nih.gov/articles/PMC9342852/ ; https://www.ldatschool.ca/evidence-based-interventions-for-math/]. Adaptations: smaller fact sets per session (start with 3 to 4 new facts), longer spacing steps, more strategy cards and visual arrays, no timer by default, show the table chart on request with usage logged (aid use is information, not cheating, outside MTC mode), longer inter-item delays. Fluency interventions for maths difficulty: cover-copy-compare, flashcards, performance feedback, self-monitoring [V snippet: ResearchGate component analysis above]; intervention exists in a meta-analysis (2026) [V title only].
- Dyslexia: BDA style guide: sans-serif (Arial, Verdana, Tahoma, Calibri, Open Sans), 12-14pt, 1.5 line spacing, off-white/pastel backgrounds instead of pure white, avoid italics/underline/all caps, use bold. [V: https://www.thedyslexia-spldtrust.org.uk/media/downloads/69-bda-style-guide-april14.pdf (snippet); https://cdn.bdadyslexia.org.uk/uploads/documents/Advice/style-guide/BDA-Style-Guide-2023.pdf (listed)]. Add: text-to-speech for any word problem; digit-reversal tolerant misconception labelling (reversal 42/24 is an error type to report, but do not treat as "dyslexia"). Avoid dyslexia-specific fonts as a "fix" (evidence weak, [U]); offer a font choice instead.
- ADHD: keep sessions short (5 min blocks), immediate feedback, visible progress, minimal distracting animation (coherence [V]), self-monitoring prompts, optional break reminder. Technology-based interventions show small effects on inattention/executive function in a meta-analysis; nothing in that search was maths-fact specific. [V (snippet): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10698651/]. Do not add timers or sudden-death loss mechanics.
- Autism: Ofsted notes strong declarative memory. [V] Provide predictable structure (same session flow), literal wording, no ambiguous idiom in prompts, option to turn off sound/music and celebratory animations, sensory-safe mode. Evidence for specific game features: [U].
- Visual impairments: WCAG 2.2 requires ≥ 4.5:1 contrast for normal text, resizable text, keyboard operability, and (SC 2.2.1) adjustable time limits. [V for 4.5:1: https://www.audioeye.com/post/10-best-fonts-for-dyslexia/ (snippet, secondary); the full WCAG SC list [U] this session, verify at w3.org]. Screen-reader friendly DOM (game canvas must have an accessible equivalent), audio question option, high-contrast mode. The MTC itself supports colour contrast, font size, audio, and number pad options [V: admin guidance].
- EAL: word problems and mathematical vocabulary add language load; dense sentences hurt performance more; visual and linguistic supports and home-language use help. [V (snippet): https://www.bell-foundation.org.uk/resources/guidance/curriculum-subject/teaching-eal-learners-in-maths/ ; https://www.cambridgemaths.org/Images/espresso_26_eal_students_in_mathematics_classrooms.pdf]. Times-table facts are largely language-light, so they are a good confidence-builder, but avoid idiom and theme text in the stem; offer icons/audio. RT should be interpreted against `rt0`.
- Universal: per-pupil profile flags (no timer, TTS, contrast, reduced motion, reduced sound) settable by tutor/parent; use of aids logged but not used to lower a pupil's status. Access-arrangement parity with MTC: no extra answer time inside MTC mode but a separate untimed mode.

---

## 9. Assessment validity (question 5)

Question: can game data count toward mastery?

Position: yes as *supporting* evidence, not sole evidence, and only under conditions; the weights below are my proposals [U] and must be set by the calibration plan.

Suggested policy:
- Mastery decision inputs (for tutor-visible "secure" status): tutor-set assessment or observed tutor check (weight highest), delayed game retention evidence (e.g. correct after ≥ 7 days with typed entry, unaided, ≥ 3 distinct days), and one-off untimed check. Game evidence alone can move a fact to "likely secure"; a tutor confirmation or a delayed check moves it to "secure".
- Starting weights (proposal): tutor-verified check 0.5; game delayed-retention evidence 0.35; in-session accuracy/RT 0.15. Session-only performance gets least weight (Bjork: performance is unreliable for learning [V]).
- Only typed-entry, unaided, non-rapid-guess, non-timeout trials count towards mastery. MCQ trials count at ≤ 0.5 weight. [U]
- Guessing control: typed entry; ≥ 4-6 option MCQ if used; RT < 0.4 s flagged (rapid-guessing literature [V snippet: https://onlinelibrary.wiley.com/doi/10.1111/emip.12165]); pattern checks (same answer key spam, random tap, non-numeric burst); require ≥ 3 successes on separate days. BKT-style models are vulnerable to guess/slip identifiability problems, with Corbett and Anderson originally proposing guess < 0.3 and slip < 0.1. [V: snippet from https://link.springer.com/chapter/10.1007/978-3-540-69132-7_44]. For free-entry numeric answers the guess probability is near zero, which is a real advantage of typed entry.
- Elo/Pelánek-style ratings for item difficulty and learner ability are reasonable for a small-data system, and have been used in adaptive fact practice, but were evaluated on geography facts, not multiplication. [V: https://link.springer.com/article/10.1007/s11257-016-9185-7]. Start with problem-size priors (6,7,8,9,12 hard) plus per-pupil Elo update.
- Speed thresholds should be pupil-relative (`rt0`), not absolute.
- Do not report "MTC pass" and do not convert practice scores into a predicted official score without calibration; the official check has no expected standard. [V]

Calibration and validation plan (using our own data)
1. Instrumentation first: ship the section 6.1 schema before any mastery claims.
2. Cohorts: recruit tutors with Y3-Y5 pupils; each pupil does (a) 4 weeks of Penguin Slide, (b) a tutor-administered untimed oral check of all 66 facts (gold standard, mixed order) at weeks 0, 4, 8, and (c) our MTC-mode practice at week 4 and 8.
3. Fit and validate: predict the oral-check outcome per fact from game features (last N results, gap, RT band, confidence) using logistic regression first; report AUC and calibration curve (predicted vs observed) on held-out pupils. Compare Elo, FSRS-lite, and BKT baselines. Choose the simplest model within 0.01-0.02 AUC of the best.
4. Threshold setting: choose fluent RT thresholds to maximise agreement with the oral check for "known" facts, separately by device/input mode.
5. Weighting: regress oral-check outcomes on the three evidence tiers to set the weights empirically.
6. MTC alignment: compare our MTC-mode score with the pupils' actual MTC score where schools/parents share it (voluntary, consented) to estimate error. Note: the official MTC's psychometric properties are in a separate handbook that I did not access. [U] (framework says the handbook follows the first live administration).
7. Gaming audit: measure rapid-guess prevalence, help-seeking, and whether achievement badges cause speed-over-accuracy behaviours; A/B test reward designs.
8. A/B tests of the key parameters: target accuracy (75/85/92%), first-interval length, in-session retest gap (3-6 items vs 1-2), timer on vs off in learning mode, confidence prompts on vs off, on delayed retention at 7 and 28 days; not on in-session accuracy.
9. Fairness: check calibration by device, input method, EAL and SEND flag (opt-in), age. Report disparities before using data for tutors' decisions.
10. Refresh calibration termly.

---

## 10. Claims table

| # | Claim | Verdict | Source |
|---|---|---|---|
| 1 | MTC: 25 questions, 6 s each, 3 s pause, Year 4 | Confirmed | [V: MTC framework PDF; admin guidance page] |
| 2 | MTC covers tables 2 to 12; 1x excluded; 121-item pool | Confirmed | [V: framework PDF] |
| 3 | MTC weights 6,7,8,9,12 (2-4 items), 3,4,5,11 (1-3), 2 and 10 (0-2); no reversals; ≤30% form overlap | Confirmed (10/11/12 rows cross-checked with secondary) | [V: framework PDF; https://thirdspacelearning.com/blog/year-4-multiplication-times-tables-check-new-assessment-framework/] |
| 4 | MTC has a pass mark | False: "no expected standard" | [V: admin guidance; framework] |
| 5 | MTC is a diagnostic tool | False: "not intended as a diagnostic tool" | [V: framework PDF] |
| 6 | 6 s chosen to permit recall not calculation (1,124 pupils, 3 limits) | Confirmed | [V: framework PDF] |
| 7 | Extra time is allowed via access arrangements | False: no extra answer time; pauses can be extended | [V: admin guidance] |
| 8 | NC: Y2 2/5/10, Y3 3/4/8, Y4 to 12x12 | Confirmed | [V (snippet): NC PoS URLs above] |
| 9 | Practice testing beats restudy (d/g about 0.5-0.6) | Supported, with lab-heavy caveat | [V: Adesope 2017 snippet; Roediger and Karpicke 2006] |
| 10 | Retrieval practice works for multiplication facts in primary classrooms | Supported by one small study | [V: Ophuis-Cox 2023] |
| 11 | Spacing beats massing; optimal gap scales with retention interval | Confirmed | [V: Cepeda 2008 ERIC PDF] |
| 12 | Optimal gap ~ 20-40% of a 1-week delay, 5-10% of 1 year | Confirmed (adult trivia) | [V: same] |
| 13 | Interleaving d ≈ 0.83 | Confirmed for grade-7 problem-type interleaving; not verified for table facts | [V: Rohrer 2020 gwern PDF snippet] |
| 14 | 85% rule is optimal for human learning | Overstated: theoretical/ML-based, narrow assumptions | [V snippet: Nature Comms; full text not fetched]; [U] for human fact learning |
| 15 | Digital games improve learning (g ≈ 0.33) | Supported, heterogeneous | [V: Clark et al. 2016] |
| 16 | Timed tests cause maths anxiety | Contested, mostly correlational; no RCT found here | [V snippets: YouCubed, Ramirez 2013, NCTM]; claim of "1/3 of students" [U] |
| 17 | TTRS has an independent evaluation showing impact | Not found: no formal studies | [V (snippet): https://en.wikipedia.org/wiki/Times_Tables_Rock_Stars ; BPS critique 403] |
| 18 | Feedback +6 months; primary bigger | Supported (Toolkit average) | [V snippet: EEF feedback] |
| 19 | Metacognition +8 months | Supported (Toolkit average) | [V snippet: EEF metacognition] |
| 20 | Immediate vs delayed feedback: delayed is better | Mixed: immediate better in applied classroom studies, delayed better in lab | [V: Kulik and Kulik 1988] |
| 21 | Worked examples g ≈ 0.48 in maths; fade for expertise | Supported | [V: Educ Psychol Rev 2023; Renkl et al.; Kalyuga] |
| 22 | Minimal guidance fails for novices | Supported | [V: Kirschner, Sweller and Clark 2006] |
| 23 | Coherence principle d ≈ 0.86 | Supported (23/23) | [V snippet: Mayer summaries] |
| 24 | Operand errors are majority of children's multiplication errors (~76%) | Supported | [V snippet: Springer chapter] |
| 25 | Drill without strategies is best | Not supported; strategy-based guided learning better on untrained facts | [V snippet: Baroody 2006] |
| 26 | IES: 10 min/session fact fluency, Moderate evidence | Confirmed | [V snippet: IES practice guide 26] |
| 27 | Ofsted: automaticity needed to free working memory | Confirmed | [V: Ofsted maths review] |
| 28 | Ofsted: anxiety is rooted in failure to acquire knowledge | Confirmed | [V: same] |
| 29 | Dunlosky 2013: practice testing and distributed practice "high utility" | Widely reported; ratings not re-read here | [U for ratings; V for paper existence] |
| 30 | FSRS DSR model (difficulty, stability, retrievability) | Confirmed | [V: FSRS repo snippet] |
| 31 | FSRS is validated for children's fact learning | Not verified; designed and benchmarked on adult flashcards | [U] |
| 32 | BKT guess/slip identifiability problems | Confirmed | [V: Baker, Corbett and Aleven snippet] |
| 33 | Elo works for adaptive fact practice | Supported for geography facts | [V: Pelánek/Papoušek] |
| 34 | Confident errors are hypercorrected but may return | Confirmed | [V: Psychon Bull Rev snippet] |
| 35 | Rapid-guess RT threshold methods agree | Supported | [V: ERIC ED490202] |
| 36 | Ofsted MFL review says X about spacing | Not verified | [U] |
| 37 | Dyslexia-specific fonts improve reading | Not verified; BDA recommends common sans-serifs | [V BDA snippets; font claim U] |
| 38 | EAL learners suffer more with dense word problems | Supported | [V snippet: Bell Foundation / Cambridge Maths] |

---

## 11. Top 10 things the game team must not get wrong

1. Treat in-game accuracy, streaks and speed as performance, not learning. Optimise for delayed retention (7 and 28 days), not session scores. (Bjork; Roediger and Karpicke.)
2. Make every trial a retrieval attempt with committed typed entry before feedback. Flip-to-reveal and multiple choice inflate apparent mastery.
3. Do not massed-drill one table until it is "done". Space and interleave after first exposure; retest errors after a few items and again next day.
4. Do not make speed the learning mechanic. Timers are for measurement and an optional labelled mode; keep a no-timer setting; no public speed leaderboards. (Contested anxiety evidence; MTC is timed but not a learning design.)
5. Do not mistake the 85% rule for a law. Use an 80-90% target as a tunable default and validate it on our data.
6. Copy the MTC spec exactly in MTC mode (25 x 6 s + 3 s pause, tables 2-12 without 1x, table weighting, no reversals, no extra answer time) and never show pass/fail or a promised MTC score; the check has no standard and is not diagnostic.
7. Do not build distractors at random. Use misconception-tagged distractors (operand-table neighbours, adding-not-multiplying, digit reversal, off-by-one) and log which one was picked; that is the tutor insight.
8. Do not infer conditions (dyscalculia, ADHD, anxiety) or "effort" from telemetry; use pupil-relative RT baselines and flag, don't judge.
9. Do not let theming/animation load the question screen (coherence principle) or add sudden-death/loss mechanics that punish errors; errors are data and learning events.
10. Ship telemetry and a calibration study before making mastery claims; game data are supporting evidence (weight to be fitted, start ≤ 0.35-0.5 alongside tutor checks). Keep child data minimal and pseudonymous.

---

## 12. Limitations of this research pass
- EEF pages, the Nature paper, the BPS critique and some publisher sites blocked fetches; those claims rely on search-result snippets and are marked accordingly.
- I did not read the full text of Dunlosky, Roediger, Cepeda (ERIC PDF listed but not opened), Rohrer or Adesope; effect sizes come from search-quoted abstracts.
- The Ofsted Science/English/MFL reviews were not read in detail; only maths was fetched and quoted.
- The simulation is a toy and provides no evidence about real learners.
- The response-time bands, scheduler parameters, mastery criteria and evidence weights are design proposals to be calibrated, not findings.
