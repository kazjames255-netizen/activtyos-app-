# Publisher-name purge report (internal)

Owner rule: the publisher's name / licence credit / links must never be visible on any portal or in any stored lesson content.

## 1. UI / code sweep (app/ features/ lib/ components/ public/)
- Before: 123 raw `\boak\b` hits (excl. server). After: `node scripts/check-no-oak.mjs` = clean (comments, import paths, test ids, id prefixes, provenance flags are allow-listed as internal).
- User-visible (b), all removed/reworded: `attrOak` string in all 11 locales of `lib/i18n/messages/areas/hublessons.ts` + `scripts/i18n-src/hublessons/01-player-small.txt`; `features/learninghub/lesson/Attribution.tsx` (was never rendered; deleted) + `OGL_URL`/`isOak` in `lesson/types.ts`; `Oak tree` sample word in `tools/common/packs.ts` -> `Pine tree`; `9 Oak Avenue` demo address in `features/team/ApplicationsApp.tsx` -> `Elm Avenue`; `lib/testing/backlog.ts` venue names; server: `createdByName: "Oak worksheet"` -> `"Worksheet library"` (worksheetQuiz.ts); `server/openapi.yaml` descriptions made neutral.
- (a) internal, left: comments, `oak-…` doc-id prefixes / question-id keys, `data-testid="oak-deck-*"`, `lesson.oakDeck` field name, `source.provider:"oak"`, storage path `oak-worksheets/`, import paths `server/src/oak/*`.
- No hits in public/, emails or notification templates.

## 2. Source fix
`server/src/oak/noOak.ts` (detector, sentence/link scrubber, slide dropper, `assertNoOak`, `sanitiseForImport`). Wired as the final step before every write in `import.ts`, `worksheetQuiz.ts`, `deckImport.ts`, `deckBulk.ts`: scrub, then throw on any remaining mention. Selftest: `cd server && npx tsx src/oak/noOakSelftest.ts`. A lone botanical "oak" (oak tree/leaf/wood…) is not treated as the name.

## 3. Migration `server/src/oak/purgeOakText.ts`
Dry by default. `--apply` writes; any tenant other than staging additionally needs `--real`. Resumable (scratch/purge-oak-progress-*), idempotent, only changed fields are updated (`lesson.<key>`), ids/provenance untouched. Drops guidance/credit slides (text mentions the name, or guidance titles), removes brand sentences and publisher links elsewhere, rewrites `createdByName`. `--shard k/n`, `--chunk N`, `--collections`, `--report file`.

### Staging tenant pnH8zTuvYlb7yJbvcanr (APPLIED)
| collection | scanned | docs with mention | changed |
|---|---|---|---|
| hubNotes | 7,470 | 13 (deckSlides 6, teacherTips 6, misconceptions 1) | 13 |
| hubQuestions | 89,345 | 67 (86 strings) | 67 |
| hubAssessments | 8,585 | 0 | 0 |
| hubFlashcards | 48,811 | 0 | 0 |
| hubTopics | 1,850 | 0 | 0 |
| hubHomework | 1 | 0 | 0 |
Caveat: the first staging pass predated the slide-drop fix, so the guidance slide was text-emptied instead of dropped in 6 notes; a second pass with `--drop-blank` (drops guidance-titled slides) was run (see log scratch/purge-staging-apply-b2.log).

### Real tenants 7jG2XO3cOD3VtoL8YfFY, jYp5XNZGT7bgSUMuEgHN, shared-library (DRY ONLY, nothing written)
Partial (scan of hubNotes still running, ~46% done when this was written): the three have identical numbers; ~62% of notes carry a mention (1,120+1,138 of 3,616 scanned per tenant), almost all the "Oak's lessons are structured around..." Teacher-Guidance slide still stored in `lesson.deckSlides` (hidden at read time by learningHub.ts, but stored). Projection: ~4,900 of 7,894 notes per tenant. Final exact numbers: `scratch/purge-real-dry-<tenant>-<0|1>.log` (last lines) / `.json` reports, summed over the two shards. hubQuestions / hubAssessments / hubFlashcards / hubTopics for the real tenants have NOT yet been scanned (staging: 67 questions, 0 elsewhere).
Note: those dry-run processes were started before the slide-drop fix, so their "slides dropped" column reads 0; re-running dry after the notes pass gives the true slide count.

### Command for the real migration (needs the owner's approval)
```
cd server
for k in 0 1 2 3; do npx tsx src/oak/purgeOakText.ts --tenants 7jG2XO3cOD3VtoL8YfFY,jYp5XNZGT7bgSUMuEgHN,shared-library --apply --real --drop-blank --shard $k/4 --chunk 8 --report ../scratch/purge-real-apply-$k.json & done
```
(Use `--chunk 8` on real notes: 25+ large canvas docs per read stalls.)

## 4. Guard
`scripts/check-no-oak.mjs` (static) and `e2e/no-oak.spec.ts` (static + live crawl of every hub tab as tutor and parent; run with `scripts/e2e-locked.sh e2e/no-oak.spec.ts`). Kid view not crawled.
