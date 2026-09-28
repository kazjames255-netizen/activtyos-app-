# Worksheet → interactive quiz: method and QA (pilot, staging tenant pnH8zTuvYlb7yJbvcanr)

Converter: `server/src/oak/worksheetQuiz.ts` (stages `select → extract → draft → verify → load`, plus `blind`, `compare`, `validate`, `report`, `project`).
State/work files: `scratch/oak-worksheet-quiz/` (`state.json`, `work/<lesson>/{worksheet.pdf,text.txt,page-pN.png,context.json}`, `drafts/`, `blind/`, `blind-solved/`, `disagreements.json`).

## Method

1. **Extract**: worksheet PDF (`<worksheetUrl>/export/pdf`) → text (`pdftotext`, else `pypdf`) + page PNGs (swift PDFKit). Publisher credit/licence lines are scrubbed from the text before any model or author sees it.
2. **Draft** (one quiz per lesson): keep the worksheet title, instructions and order; one question per answerable item; kinds single / multi / short / number / order / match / written. An answer is only auto-marked when it comes from the worksheet itself, from the lesson's own content (key learning points, its exit/starter quiz answers, transcript) or from certain calculation/knowledge. Open-ended, drawing, discussion, extended writing and picture-dependent items become `written` (tutor-marked, model answer in the explanation; picture items point to the printable page). Worksheets with nothing to mark (handwriting, drama/role-play) are skipped with a reason and keep only the PDF. `--draft` uses the Anthropic API (`ANTHROPIC_API_KEY`, model `claude-sonnet-5`); **no key exists in this repo, so the 40 pilot drafts were authored by hand by Claude** (page images read where layout mattered) and the tool's LLM path is untested against the live API.
3. **Verify (mandatory)**: every auto-marked question is solved a second time WITHOUT the key (`blind/` sheets contain no answers; order items and match definitions are shuffled) and the solver's answers are marked with the platform's real `markResponse`. Any disagreement, or a lesson with no verify file, downgrades that question to `written` (never silently kept).
4. **Load**: hub assessment `ws-<tenantId>-<lessonSlug>` (type quiz, `yearGroups` from the lesson, topic from the note) + questions `ws-<tenantId>-<lessonSlug>-qN`; `note.worksheetQuizId` is set. Idempotent (`state.json`), `--dry`, `--limit`, `--tenants`, `--retry-failed`, `--redo`. The real tenants need `--real`.
5. **Owner rule (no source branding)**: validator rejects any draft whose title, instructions, prompts, options, accepted answers, items, pairs or explanations match `/\b(oak|national academy|ogl|open government licence)\b|thenational.academy|©/i`; loaded docs go through `sanitiseForImport` (noOak.ts) and carry no `source`/URL/licence, `createdByName` is "Worksheet". Rejections in the pilot: **0** (checked on drafts and on the 38 stored quizzes and 361 stored questions: 0 hits).

## Pilot results

| | |
|---|---|
| Lessons selected | 40 (maths KS1–KS4, science KS2/KS3/GCSE bio, English KS1/KS2/KS3, French, Spanish) |
| Quizzes loaded | 38 (2 skipped: handwriting joins, drama role-play) |
| Questions | 361: single 115, number 78, short 34, multi 6, written 128, order 0, match 0 |
| Auto-marked | 233 / 361 = 64.5 % (written 35.5 %) |
| Quizzes with ≥1 auto question | 23; 15 are tutor-marked only (open writing, discussion, picture-dependent) |
| Notes linked (`worksheetQuizId`) | 38 |

## QA

* **Independent blind solve**: a separate reviewer agent (no access to drafts/keys) solved all 233 auto-marked questions from the answer-free sheets + worksheet text/images; a second run re-solved the 3 lessons revised after review. Marked with the real `markResponse`: **agreement 233/233 = 100 %, 0 disagreements, 0 wrong keys**. Deterministic maths (mental arithmetic, fractions, means, energy, pressure, volume) was also re-derived by code (`author/resolve.py`, reads only the blind sheets): 100 % agreement.
* Caveat on independence: the drafter and the reviewer are the same model family; the plan for 4 reviewers (one per 10 quizzes) hit the environment's concurrent-agent cap, so one reviewer covered all 38.
* **Defects found and fixed by the review** (before the final 0-disagreement run): -er verbs matching had two plural endings so a single-choice key was ambiguous (now multi "all that agree"); Spanish reading questions referred to a passage the child could not see (now quote the sentence); a specific-information list missed a sentence (options fixed); Paddington station and six Spanish sentence translations were typed answers with punctuation/accent risk (now single-choice); chemistry formula answers gained state-symbol/subscript variants; units/word forms added (`70 cm`, `thirty-three`, `zero`, `0.7`, `- 1/6`).
* **False-negative risk** (correct child answer marked wrong; the marker only forgives case/whitespace): the reviewer proposed 86 alternative typed answers for short questions. Before fixes 39 would have been marked wrong; after adding accepted variants 23 remain, all deliberately wrong or out of spec: un-simplified fractions where "simplest form" was asked (9/6, 0/6, 10/6…), stems instead of the full plural (autor), a wrong article (un consejo), extra sentence text. Residual risk sits in `short` questions; the converter's rule is single word/number/short formula only, long or accent-heavy free text goes to single-choice or `written`.
* Known limits: a picture/diagram question is `written` (not auto-marked) with a pointer to the printable page; pictures are not cropped into the quiz. Listening tasks (audio) are left out. 5 quizzes contain a `written` question worth several marks.

## Child experience (staging)

Throwaway parent + child (`@activityos-test.com`, Year 2) enrolled through a family invite; tutor set the worksheet quiz as homework. In the parent hub the homework card shows "Quiz"; opening it shows the intro (33 questions, 33 marks, 70 % pass) and the quiz player (screenshots in `scratch/oak-worksheet-quiz/shots/`). Scoring through the real attempts API: all answers right → 32/32 auto, 1 written pending (`pending_marking`); half deliberately wrong → 16/32. The full click-through of all 33 questions in the UI was reached to question 6 (numeric answers typed, progress "6 answered"); the rest hit shared-dev-server slowness/restarts.
