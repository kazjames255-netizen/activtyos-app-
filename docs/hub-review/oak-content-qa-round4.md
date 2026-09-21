# Oak content QA — round 4 (generated decks + derived plans, all subjects Y1–Y13)

Date: 2026-09-20. Scope: `server/src/oak/factory/{generate,quality,plan,index}.ts`. No Firestore, no imports, no commits.

## Method

Script `sample120.ts` (session scratchpad) builds a stratified random sample of 120 lessons (proportional over subject × year,
at least one per stratum; seed 4), generates the deck (`deckFor`) and the plan (`planFor`) for each with the real unit keyword
pools, dumps both as readable text and runs a machine checklist. The full dump was then read as a teacher would (all 120 decks,
~40 plans in full). Before/after dumps: `scratchpad/before.txt`, `scratchpad/after.txt`.

Sample: 120/120 decks valid (2 curated, 118 generated), 120/120 plans valid, before and after.

## Defect classes found (root cause → fix)

| # | Class | Root cause | Before (sample) | After | Fix |
|---|---|---|---|---|---|
| 1 | Phoneme notation mangled: `/shun/` shown as `/ shun/` (86 KLPs corpus-wide use `/x/`) | `tidy` slash-spacing rule | 4 strings | 0 | `quality.ts` PHONEME guard in `tidy` |
| 2 | Teacher objectives shown to children as "key ideas": "Know that…", "Know the ordinal number names are…", "Understand how…", "How to spell the curriculum words…", "Following an appropriate method to…", "Interpreting and describing the results" (a whole deck whose only idea was that line), "Estimating populations using…", "Record results in an appropriate table", "The common features of the cells of…" | `usablePoint`: FINITE matched nouns ("results", "measure", "increase"); no rewrite of "Know that" wrappers | 13 slides | 2 | `cleanPoints`: KNOW_THAT / KNOW_THE unwrap (validators re-derive from `cleanPoints`, so deck + plan stay traceable); `DIRECTIVE` + `OBJECTIVE_OPEN` extended; gerund-led objectives need a STRONG_FINITE verb |
| 3 | Proper-name keyword offered as a wrong option and lower-cased: "nanny of the Maroons" next to "discrimination" | `isProperName` only knew a fixed list | 6 items | 0 | `isProperName`: a capital inside the phrase = a name |
| 4 | Answer leaks through a derived form: "If you are vexed, … → Vexation" | `sameStem` misses vexed/vexation | 1 (+ 4 in match/define, which is fine) | 0 in questions | `derivedForm` (suffix-stripped root) used in `maskDefinition` and `leaks` |
| 5 | Oak text errors: `tion' is` (lost quote), "in note-form, out of full sentences" | Oak data | 2 lessons | 0 | PHRASE_FIXES |
| 6 | Slide titles / intro cards / plan step titles ending with a full stop ("Practising vocabulary.") | outline headings shown raw | 6 | 0 | `cleanOutline` (index.ts + plan.ts, so plan validator sees the same text) |
| 7 | Key ideas cut off at ";" | Oak data | 2 | 0 | `tidy`: trailing `;`/`,` → `.` |

Machine-checklist totals (heuristics, incl. template false positives): 544 → 539; the classes above are the ones a teacher
would object to. No factual error, transcript phrase ("in this video", "Miss X says"), broken/empty slide or unsafe content
was found in the 120 generated decks; plans contain no transcript text by construction (only true arithmetic).

## What remains (not fixed this round)

* **Generic headings "Key idea N"** on ~1 explain slide in 3 (132 in the sample). Cause: an outline heading is only used when it
  shares a content word with its points, and words of the outcome do not count. Often the heading would have been right
  ("Reading Scene Two of 'Leave Taking'"). Needs a better linking rule, not a quick regex.
* **Silly wrong options from the unit pool** in fill-the-gap: "Access | Bioplastic | Rust", "ear drum | standing wave",
  "similar | enlargement | hypotenuse", "million" for "theory". Never unfair (the guards hold) but they make the check trivial.
  A part-of-speech / same-kind filter on pool distractors is the next step.
* Objective-style points that still pass: "Identify if regrouping will occur", "Understand how ordinal numbers are different"
  is now dropped but imperative practical steps ("Record…", "Identify…") remain in some science practicals.
* Oak definitions that are tautologies ("Taste is the ability to taste things") or teacher-facing ("task in which the student
  responds to several prompts") are shown verbatim.
* Plan tips ("watch out") are teacher-facing by design and sometimes mention whiteboards / printing; acceptable for a tutor.

## Validation status

`tsc --noEmit` was clean after the first batch of edits. The final edit (STRONG_FINITE gate in `usablePoint`) and the full
`cli.ts check` / `plancli.ts check` runs over 7,470 lessons were interrupted by the lead's stop order (machine load); the lead
is to re-run `npx tsc --noEmit`, `npx tsx src/oak/factory/cli.ts check`, `plancli.ts check`, `cli.ts curated` (was 144/0 invalid)
and `plancli.ts plans` (was 11/0 invalid) on a quiet machine. Baseline before edits: decks and plans 7,470/7,470 valid, 0 invalid.
The edits only drop or rewrite points inside `cleanPoints` (which every validator re-derives from), so the expected effect is a
small rise in "not enough source facts" no-deck lessons, not invalid decks.
