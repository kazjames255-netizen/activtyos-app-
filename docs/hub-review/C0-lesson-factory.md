# C0 — Lesson factory: design, throughput, results

Author: Builder C0 (overnight run, 2026-09-20). Scope: turn every Oak lesson into the same structure as the approved pilot
("Spelling words with the suffixes -tion and -cian"): interactive slide deck + warm-up/exit quiz + flashcards + worksheet.

## 1. How the pilot was made (what is hand-written, what is derived)

| Piece | Pilot source | Nature |
| --- | --- | --- |
| Slide deck (`server/src/oak/slides/<slug>.ts`, 25 slides, ~165 lines) | Hand-written by an agent/human from Oak's Google-Slides deck | Content is Oak's teaching text, re-authored as pupil-facing blocks; layout, emoji art, every interaction are ours |
| Flashcards + worksheet (`server/src/oak/extras/<slug>.ts`, 13 cards, 12 short-answer questions, PDF) | Hand-written | Worksheet PDF = Oak's worksheet exported to PDF; the interactive quiz is a re-authored short-answer version |
| Warm-up + exit quiz | Derived by the importer from Oak's starter/exit quiz (never hand-edited) | Deterministic |
| Wiring | `server/src/oak/import.ts` (`SLIDES_BY_LESSON`, `EXTRAS_BY_LESSON`) | Deterministic |

The pilot costs one careful authoring session per lesson: not scalable to 7,470 lessons. Findings that shaped the design:

* The video **transcript** is teacher chatter ("Hi, I'm Mr Tazzyman", "pause the video", "Jun says...") and Oak's **slide text**
  (Google Slides `export/txt`, publicly downloadable) merges animation builds, so right answers, **wrong multiple-choice
  distractors** and other pupils' incorrect statements sit next to true statements. Neither can be turned into pupil slides by a
  deterministic script without a real risk of showing a child a false statement.
* The structured facts (pupil outcome, key learning points, keywords + definitions, lesson outline) are clean, pupil-facing and
  consistent. Oak's own quiz answers are the ground truth.
* Everything Oak publishes can contain errors (measured: a wrong key learning point, typos in worksheet answers, contradicting
  figures, a wrong stave number in A Christmas Carol...). The authoring lane catches them; the generator cannot (see weaknesses).

## 2. Design: generator first, agents for enrichment

```
                  scratch/oak-raw (8,279 files -> 7,470 unique lessons)
                                   |
      server/src/oak/crawlSlides.mjs  (NEW: slide-deck text + worksheet text + worksheet PDFs from Oak's Google Slides; 7,470/7,470 fetched, 0 missing)
                                   |
        +--------------------------+---------------------------+
        |                                                      |
 (a) GENERATOR  server/src/oak/factory/generate.ts       (b) CURATED LANE  server/src/oak/curated/<unit>__<lesson>.json
     structured facts only, deterministic, no LLM             author agent -> independent reviewer agent -> validator
     every lesson gets a baseline deck (7 slides)             rich deck (14-17 slides) + 12 curated flashcards + ~10-question worksheet quiz
        |                                                      |
        +------------- validate.ts (schema + independent answer-key re-derivation) -------------+
                                   |
                     import.ts --slides  (precedence: hand-built > curated > generated)  ->  Firestore (staging first)
```

### (a) Generator (all 7,470 lessons)
Input = outcome, key learning points (KLP), keywords, lesson outline (nothing else: no transcript, no slide text, no teacher tips,
no misconceptions). Output per lesson (avg 7 slides, 4-11):

1. `intro` "Today's learning": outcome as lead, outline steps as emoji cards.
2. `intro` "Key words": tap-to-flip `define` cards (Oak's definitions verbatim; chunked in sixes).
3. one `explain` slide per part of the lesson: the KLPs allocated to the outline headings (monotone DP on word overlap with an even-spread prior), key words accented, "key words in this part" chips.
4. `check` slide after a teaching slide (max 3): a fill-the-gap `choice`, a KLP with one of ITS OWN keywords blanked.
5. `practice` "Key word practice": `match` keyword <-> its definition, plus "which key word matches this meaning?" `choices` (definition with the keyword masked).
6. `summary`.

Safety rules baked in (children's content; a wrong key is the worst bug):
* every interactive item is correct by construction from one Oak fact (keyword <-> its own definition, or the sentence Oak wrote);
* fair-item filters: keywords with identical/near-identical definitions are dropped from match/choice; wrong options are other
  keywords of the lesson/unit that are not related to the answer, not in the sentence, same "shape", and whose substitution does not
  reproduce another KLP; identical capitalisation across options; skipped when the sentence holds >= 2 keywords;
* Oak's quiz questions and answers are never touched (they remain the warm-up/exit quiz docs);
* the video transcript stays available to pupils/tutors (Done step "Read the full lesson script") for generated decks; hand-built and
  curated decks replace it (the slides ARE the lesson).

### `check` (validate.ts + `cli.ts check`)
Schema per block type (`normalizeSlides` drops nothing, non-empty text, balanced `{}`/`**` markup, kinds, art <= 4, first slide intro, has summary,
size caps) and an **independent re-derivation of every answer key from the raw lesson**: each `define`/`match` pair must be a real keyword/definition
pair of the lesson; each keyword `choice` is re-derived (the marked option must be the one keyword whose masked definition equals the question, and no
other option — lesson or unit keyword — may share it); each cloze filled with the marked option must reproduce a real KLP exactly, and no other option
may reproduce a KLP. Any problem rejects the WHOLE deck (the lesson falls back to the plain non-slide lesson). Current result: see section 4.
The importer's own `check <tenant> --deep` additionally decodes every quiz answer key with the real marking function (`hubScoring.markResponse`).

### (b) Curated lane (priority lessons)
`cli.ts dossier <key>` prints everything for one lesson (facts, Oak's quizzes WITH answers, deduplicated slide text, worksheet text, transcript).
An author agent writes `curated/<key>.json` = { slides (10-17, any block type), flashcards (8-14), worksheet (6-12 short-answer questions) };
`cli.ts curated` validates it (all block types, sort/match/choice index ranges, flashcard/worksheet shape, no case-only answers because the hub's
short-answer marker lower-cases, key must be a real lesson). A **separate reviewer agent** then re-derives every fact and key from the dossier and
edits/deletes defects. Briefs: `scratch/oak-factory/AUTHORING-BRIEF.md`, `scratch/oak-factory/REVIEW-BRIEF.md` (incl. lessons learned).
The importer writes the worksheet as the pilot does (note + PDF attachment when the PDF <= 700KB + short-answer quiz) and links it to the lesson.

## 3. Measured throughput (this machine, load average 250-400 while ~10 agents ran, so real numbers are somewhat better)

| Step | Measured |
| --- | --- |
| crawl slide-deck + worksheet text, 7,470 lessons | 20 min (10 parallel, 0 missing) |
| worksheet PDFs | avg 250KB, max ~440KB in the sample (Maths KS2): all 7,470 would be ~1.9GB (2.5GB base64 in Firestore) -> only fetched for curated lessons (`--pdf --curated`) |
| generate + validate all 7,470 decks | 7.5 min wall (91 s CPU) |
| import whole library to staging (151k docs, 7,470 lessons) | ~36 min (~70 docs per second, batched); e.g. Maths KS1 360 lessons/6.8k docs in 89 s |
| author agent | ~2-4 min per lesson wall clock, ~30k tokens/lesson (6-9 agents in parallel) |
| reviewer agent | ~1-2 min per lesson wall clock, ~22k tokens/lesson |
| pipeline total | ~52k tokens and ~5 min wall per lesson; 96 lessons in ~1 h of wall time with 9 agents in parallel |
| review yield | ~1.3 defects per 100 checked items (mostly ambiguous options / over-lenient accepted answers, some Oak errors); wrong answer keys found: 0 in slides across 96 lessons, 1 ambiguous-key item in Spanish; the hub's case-insensitive marker made 6 genotype worksheet answers unmarkable (reworded; validator now rejects case-only answers) |

Scaling the curated lane: 7,470 lessons x 52k tokens = ~390M tokens: not realistic for everything. Realistic: priority units (exam
years, KS2 Y6, KS4 core) at ~50 lessons per hour of wall time per 10 agents.

## 4. Results (final run, 2026-09-20 07:40; `cli.ts check` over all 7,470 lessons: 0 invalid, 0 without a deck)

| Subject / key stage | Lessons | Decks (all valid) | Avg slides (generated) | Curated lesson rows |
| --- | ---: | ---: | ---: | ---: |
| Maths KS1 / KS2 / KS3 / KS4 | 360 / 712 / 427 / 436 | 360 / 712 / 427 / 436 | 6.5 / 6.4 / 6.7 / 6.8 | 4 / 16 / 8 / 16 |
| English KS1 / KS2 / KS3 / KS4 | 417 / 1,172 / 464 / 618 | all | 7.1 / 7.2 / 7.0 / 7.2 | 4 / 12 (+1 hand-built pilot) / 8 / 8 |
| Science KS1 / KS2 / KS3 / KS4 | 76 / 314 / 289 / 819 | all | 7.5 / 7.4 / 7.7 / 7.7 | 4 / 8 / 12 / 33 |
| French KS2 / KS3 / KS4 | 105 / 208 / 179 | all | 7.6 / 7.3 / 6.6 | 4 / 4 / 4 |
| Spanish KS2 / KS3 / KS4 | 112 / 197 / 183 | all | 7.3 / 7.3 / 7.2 | 4 / 4 / 0 |
| German KS3 / KS4 | 203 / 179 | all | 7.5 / 7.1 | 4 / 0 |
| **Total** | **7,470** | **7,470** | ~7 (4-11) | **157 rows = 144 curated lesson files** (Biology/Chemistry/Physics/Combined-science rows share lessons) + 1 hand-built |

* Every lesson has: warm-up + exit quiz (importer), keyword + cloze flashcards (importer), and a slide deck (generated 7,3xx / curated 144 files / hand-built 1). Curated lessons additionally have ~12 curated flashcards and a ~10-question worksheet quiz (+ PDF attachment when <= 700KB): 36 units x 4 lessons = 144 lessons.
* Curated pipeline quality: 144 lessons author+reviewer checked; ~1.3 defects per 100 checked items; **0 wrong answer keys in slide items that survived review** (reviewers fixed ~120 ambiguity / over-lenient accepted-answer / picture-dependency / false-fact-in-Oak's-text issues; one genuine wrong worksheet key found and fixed: "practise/practice" where Oak's own key has the same fault).
* Whole-library dry run: 152,114 docs (7,568 notes = 296MB, median note 43KB, max 109KB; 88,237 questions; 8,491 quizzes; 47,740 flashcards; 78 worksheet PDFs/images = 31MB). Quiz questions the importer now refuses because the hub marker ignores case: 137 matches + 38 orders with case-only-different sides (e.g. genotypes EE/Ee/ee) — they would mark wrong pairings right.

## 5. Findings the lead must know (server side, outside the factory)

1. **`noteIndex` (server/src/lib/hubIndex.ts) read every note in full**: with the whole library on staging `GET /notes` returned 500 after ~130 s (Firestore query timeout) and the Lessons tab could not load (client gives up at 15 s). I made ONE surgical change (`.select(...)` of only the list fields, `lesson.slides/transcript` no longer read): cold load still took ~228 s on a loaded machine, warm calls 200-400 ms. Further fix recommended before loading a real tenant with the whole library: build the row from the stored `excerpt`/`readMinutes`/`hasBody` fields (the importer already writes them) and a stored search string instead of reading `body` (~17KB x 7.5k notes), or cap search to titles.
2. `import.ts check` used tenant-wide queries (time out at ~90k questions): now reads by id (fast). `check --deep` on Maths KS1: PASSED; whole library per subject/key stage: 15 of 20 passed at the time, the rest failed only on (a) worksheet PDF attachment shape (fixed in the check), (b) German `ß` upper-case self-test (fixed), (c) 2 Oak genotype match questions the hub marker cannot mark (now refused by the importer).
3. `hubScoring` short-answer / match normalisation lower-cases: worksheet answers that differ only by case cannot exist (validator rejects them).
