# LEARNING TOOLS — v2 PLAN (approved by Kaz 23 Sep 2026)

> **DECISION (Kaz, 23 Sep 2026): EVERY tool in the catalogue will be built — P1 ("In build") AND P2 ("Coming soon"), including humanities — regardless of click demand.** The Coming-soon click counts (`hubToolEvents`) only decide the ORDER within a phase, never whether a tool is built. Progress is committed and pushed to GitHub as it goes; independent review agents check each milestone.

(Original proposal text follows.)
Merged from six independent read-only reviews (maths, English, science, languages, humanities/other, architecture), each tested against the real 7,470-lesson library. Full reports: scratchpad/agent-*.md.

## 1. What the real library says
| Subject | Lessons | Notes |
|---|---|---|
| English | 2,671 (36%) | 60% primary (spelling, narrative/report writing, set texts) |
| Maths | 1,935 (26%) | KS1+KS2 = 55% |
| Science | 1,498 (20%) | KS4 = 55%; **plan v1.1 had no science at all** |
| French/Spanish/German | 1,366 (18%) | verbs/tenses dominate; KS3–4 |
| History/Geography/RE | **0** | humanities tools only serve tutor-supplied content |
- The `unit` column is empty for every lesson; the unit lives in `oak_url` (875 distinct unit slugs). The selector must parse it. The National Curriculum sheet gives each unit an NC area — an even stronger signal.
- Plan v1.1 was secondary-school- and geometry-shaped. Phase 2 geometry serves only ~5% (strict) to 11% (loose) of maths lessons.

## 2. Automatic tool choice (the new requirement) — agreed design
- Pure function `selectTools(signal, ruleset, registry, overrides)`, shared by client (render time) and server (authoring). No AI, no database writes, rules are git-reviewed JSON per subject.
- Rules emit weighted TAGS; a tag→tools map links them to tools. Signal = subject, year/KS, unit slug (from URL), title (weight 1.0), unit (0.8), objective (0.7), NC area (when the curriculum map exists), question stem (per question).
- Every suggestion carries a `why` ("title matches 'protractor'"). Max 3 chips, top 1 auto-attachable.
- Fallback ladder: curated unit-slug defaults → subject×KS defaults → universal tools (timer, whiteboard, read-aloud, card sort, retrieval starter). Never empty.
- Overrides: question > lesson > unit > tenant > rules. Pin beats rules; hide beats everything. Graded items freeze their tool list so a rules update never changes what a student saw.
- Tests: `selection.selftest.ts` = scoring/merge/fallback unit tests + ~150–200 hand-labelled golden lessons + a real-CSV coverage run. Gates: ≥85% coverage per subject, golden top-3 hit rate ≥90%.
- Tested coverage (reviewers' draft rules): Maths 92% (plan tools alone 85%), Science 98%, English 99.8% with new tools (59% with plan tools only, excluding 3 catch-alls), MFL 91–97%. Precision ~65–85% → treat as ranked suggestions, tutor can override. A hand-curated unit→tools table (~190 maths units) beats regexes alone.

## 3. What was wrong with plan v1.1 (agreed by several reviewers)
1. Engine is geometry-shaped. Text/form tools (spelling, verbs, annotator, dictation) have no canvas → tools need `surface: canvas | form | text`; stage optional; patch-based state for text; checkers for typed answers, spans, sequences, labels, units/sig figs.
2. No science. Added 28 tools (below) and three shared checkers.
3. Cheap universal tools (timer, TTS, dyslexia panel, card sort, command-word helper, retrieval starter) are P1 but scheduled late → pull forward.
4. Sentence builder (L-04) was in Phase 10 but serves 15–41% of language lessons → move up. Exam-skills tools (dictation, read-aloud, sound-symbol) serve only 1–3% → move later.
5. Do NOT create `hubToolAttempts`; store graded tool state inside existing `hubAttempts`/`hubSubmissions` (one source of truth for marking, erase, parent view). `hubToolStates` only for autosave (64 KB cap, debounced). Usage events as daily counters, no child identity.
6. Live sync over Daily needs snapshot-on-join, size caps and per-tool wire schemas (injection risk).
7. Kid mode / parent gate, keyboard + numeric alternatives for SEND, iOS two-finger-rotate spike, tool network calls (tiles, TTS) must go via server proxy.
8. Seeded regeneration needs a frozen PRNG + stored generator/checker versions.
9. Contradictions: ts-fsrs banned yet used (keep existing SM-2); L-13 in two phases; PDF import needs pdfjs (needs approval); settings live in `HubSettings.tools` not `tool_settings`; registry >118 (science + legacy).
10. Maps: public OSM tiles aren't allowed for production → self-hosted PMTiles or paid provider; keep own-SVG practice maps.
11. Timers/streaks/leaderboards are nudges under the Children's Code → off by default for KS1–2.
12. **Dev hazard:** the dev API's mail is LIVE; tool-question e2e tests could email real parents. Add a mail-allowlist guard BEFORE any assess-mode testing.

## 4. Tool additions (full tables in the agent reports)
- **Science (28: 17 P1, 11 P2):** S-01 label-diagram (206 lessons), S-02 data table→graph + line of best fit (~170), S-03 formula/calculator with units & s.f. (181), S-04 circuits (103), S-05 equation balancer (147), S-06 free-body diagrams (124), S-07 practical method + fair-test planner (~150), S-08 food webs (103), S-09 particle simulator (100), S-10 energy/Sankey (95), S-11 waves, S-12 rays, S-13 periodic table, S-14 atom/bonding (107), S-15 sort/key/materials (~250), S-16 lifecycle/sequence (105), S-17 Punnett (100). Build first: S-15, S-01, S-03, S-02, S-05, S-08, S-16 (~75% of science lessons).
- **English (12 new, 6 engines):** story mountain/narrative planner (594), report/letter/persuasive frames (540), drama/oracy cards (412), character/setting map (392), Shakespeare glossed annotator (197), GCSE Lang question trainer (146), read-aloud/fluency (145), handwriting trace (107), tense timeline, sentence combiner, phonics blender. Consolidate E-01..E-17 into TextWorkbench, TileBoard, FrameWriter, Parser/Tagger, TrainerDeck, TraceGuide. KS2 frames + spelling BEFORE the GCSE annotator.
- **Languages:** add ser/estar chooser (51), negation drill (48), perfect-tense auxiliary chooser, cloze/grammar drill, reading-comprehension checker, vocab CSV import. Rebuild the existing lang*.js widgets (~91 KB) rather than restart. MFL-lite early: accent bar, minimal marking policy, verb trainer, gender, numbers. Marking rules: ¿¡ are punctuation; si/sí, tu/tú and French parle/parlé change meaning → lenient mode must not auto-accept.
- **Maths (missing):** written-method/column scaffolds (104), rounding/bounds (71), percentages (45), sequences (37), surds/standard form/indices (40), similarity/scale (34), function machines (30), inequalities, vectors, histograms. Promote area/perimeter and ten-frame to P1. Park: M-81, M-26/27, M-53, M-49, M-08, M-11; fold set square/straight edge into the ruler.
- **Cross-subject (pull forward):** X-03 timer, X-08 read-aloud (browser TTS), X-09 dyslexia panel, X-05/X-07 card sort & Venn, X-11 command-word helper, X-14 marks-to-minutes timer, X-17 data-entry table; later X-12 mind map, X-13 revision planner/retrieval starter, X-16 glossary→flashcards, X-20 confidence rating. Other subjects (only if the business teaches them): 11+ reasoning kit, debate builder.
- **Humanities:** no lessons in the library → build last, gate on "Coming soon" click data; keep H-H01/03/05/09, H-R01, own-SVG map skills; defer MapLibre.

## 5. Revised phases (all subjects)
| Phase | Scope | Exit criteria |
|---|---|---|
| **1a** | Engine foundation: `surface` canvas/form/text, versioned state + undo, ToolHost with drawer/legacy-widget/native implementations, registry of ALL tools (incl. science, tags, dynamic loaders), Tools tab, drawer reads the registry, autosave API + counters, bundle-size gate | 20 drawer tools + ~50 legacy widgets host unchanged; tenant-isolation test; no regressions |
| **1b** | Selection engine: parse `oak_url` unit slugs, tag vocabulary, rules per subject, curated unit defaults, pins/hides, "why" UI, chips replace the hard-coded six; cheap universal tools (timer, read-aloud, dyslexia panel, card sort) | coverage + golden gates met; tutor override works |
| **2** | Assess foundation on existing `hubAttempts`: tool-question kind, per-question allowed tools, frozen PRNG + versions, review mode, mail-safety guard, shared checkers (numeric/unit/equivalence, label match, sequence, typed text). Prove it with cheap tools across subjects: number line, fractions, ten frame/bar model, times tables, coordinate grid + paper, spelling test, verb/accent MFL-lite | one tool per subject assessed end-to-end; identical seeded replay; e2e cannot email real parents |
| **3** | Geometry set (your pain point): ruler, protractor, compass, construction checker, angle facts (with reason picker), bearings, scale drawing — numeric/keyboard alternative, iOS spike | ~230 lessons served; keyboard-only + touch pass |
| **4** | Science core: S-15, S-01, S-03, S-02, S-05, S-08, S-16 | ~75% of science lessons have a working tool |
| **5** | English core: FrameWriter (KS2 frames) → spelling/tiles → parser → annotator | ~KS1–2 spelling & writing covered |
| **6** | Languages core: sentence builder, verbs, gender/agreement, vocab (SM-2 + CSV import), TTS cache | per-language coverage ≥90% |
| **7** | Live sync: snapshots, caps, wire schemas, live classroom controls | late joiner sees tool; bad ops rejected |
| **8** | Maths remainder in slices of ~8 tools | per-slice definition of done |
| **9** | Safeguarding + AI/STT: DPIA, consent, retention, AI rubric marking with tutor-confirm, read-aloud STT | erase covers all new collections |
| **10+** | Humanities, other subjects, P2 tools — by click data | — |
Parallel track: **Curriculum map** (NC coverage view from the NC sheet) — see chat proposal; also improves tool selection.
Effort (architect estimate): ~220 engineer-days ≈ 10 months for one developer for everything; phases 1a–3 ≈ 60–70 days.

## 6. Code already written (branch tools/phase-1)
Engine core (geometry kernel, seeded rng, undo/redo, marking types) — committed, 1,189 checks pass. Geometry model/instruments/checkers — written, not yet tested or committed; kept for Phase 3. Needs: add `surface`, keep tolerances in mm/degrees.

## 7. Decisions needed from Kaz
1. Approve the revised phase order, or keep geometry first (Option B: 1a → 1b → 3 → 2) since it is your visible pain point (the reviewers rank it by lessons served, not by your priority).
2. Confirm exam board = AQA (Oak KS4 lessons are AQA-targeted).
3. Approve storing graded tool state in existing attempt docs (no new attempts collection).
4. Approve the mail-safety guard before any assess-mode testing.
5. Keep SM-2 for spaced repetition (drop ts-fsrs).
6. Maps: paid tiles or self-hosted — decide before humanities.
7. Approve pdfjs-dist (Apache-2.0) for board PDF import, or defer.
8. Are 11+/other subjects in scope?
