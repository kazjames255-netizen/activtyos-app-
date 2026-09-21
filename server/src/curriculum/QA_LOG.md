# KS2 Maths curriculum: final independent QA sweep (K4)

Scope: all 10 topic files in `ks2maths/` (336 quiz questions after additions, 33 topic-years), every note and flashcard set, and every PNG
used by a question (66 images, each opened and checked against its prompt). Every question was re-solved from the prompt/options/image
as a Year-N teacher without trusting the stated answer; arithmetic-heavy keys were also recomputed in code. K4's own files (pos, stats) are
additionally verified by `ks2maths/_check_k4.ts`, which recomputes all 70 answers from `_k4data.ts`, the same data that draws the images.

## Result

| topic | questions re-solved | wrong keys | other defects fixed |
| --- | --- | --- | --- |
| npv | 42 | 0 | 1 (notation) + 2 questions added |
| as | 40 | 0 | 0 |
| md | 40 | 0 | 0 |
| frac | 42 | 0 | 2 questions added |
| rp | 10 | 0 | 0 |
| alg | 10 | 0 | 0 |
| meas | 40 | 0 | 0 |
| shape | 42 | 0 | 2 questions added |
| pos (K4) | 30 | 0 | notes de-duplicated from quiz items |
| stats (K4) | 40 | 0 | notes de-duplicated from quiz items |

No incorrect answer key, no ambiguous item, no two-correct-options item and no wrong explanation was found in any file. Image questions were
checked against the actual picture (counts, scale readings, angle sizes, nets, timetables).

## Changes made (file, key, what was wrong, what changed)

| file | key | problem | change |
| --- | --- | --- | --- |
| npv.ts | npv-y6-03 | Prompt, options, answer and explanation used "-4C", "5C", "-13C" (hyphen-minus, no degree sign), copied from the spec's PDF text | Now "−4°C", "5°C", "13°C", "−13°C", "4°C" (unicode minus and degree sign) in prompt, options, answer, explanation |
| pos.ts, stats.ts | note worked examples and flashcards | Worked examples in the notes repeated the same numbers as quiz items (e.g. the note solved the very translation asked in pos-y6-04) | Replaced with different numbers in every pos and stats note and matching flashcards |
| _k4 images | all grid images | Axis letters x/y clipped at the edge; axis numbers hidden under lines | Margins widened; numbers now drawn last |

## Coverage gaps found and filled (quiz kept to 12 questions or fewer)

| key added | objective that had no question |
| --- | --- |
| npv-y4-11 | Round to the nearest 1,000 (Y4) |
| npv-y4-12 | Count in multiples of 9 (Y4) |
| shape-y5-11 | Estimate angles (Y5) |
| shape-y5-12 | Recognise reflex angles by size (Y5) |
| frac-y5-11 | Order/compare decimals with up to three decimal places (Y5) |
| frac-y6-11 | Add mixed numbers with different denominators (Y6) |

## Remaining gaps (cannot be tested with the auto-marked kinds; covered in notes/flashcards only)

- shape Y3/Y6: drawing 2-D shapes and making 3-D shapes with given dimensions; shape Y5: drawing/measuring angles with a protractor.
- stats Y3/Y4: "present" data (drawing tables, bar charts, pictograms, time graphs), stats Y6: constructing a pie chart or line graph. A `written` tutor-marked task would be the right vehicle.
- pos Y4 "draw polygons on a grid": only the reading side is testable (pos-y4-04, -07).
- npv Y4: count in 1,000s (only by rounding/place-value items), npv Y5: years in Roman numerals. frac Y4: dividing by 100 (card only).

## Systemic observations (not changed in other agents' files: judgement call for the owner)

1. Note worked examples mirror quiz questions in npv, as, md, frac, alg, rp, meas, shape (a script flagged 133 prompts whose numbers all appear in the note, 34 of them
   diagnostic ones). Practice quizzes are fine with this, but for the year placement (diagnostic) papers a child who has read the note has seen the answer.
   Recommendation: in the seeder, either draw diagnostic papers only from questions whose numbers are not in the note, or ask for the note examples to be re-numbered.
   pos and stats notes were re-numbered by K4.
2. npv-y5-01: the place-value picture shows the digit 4 under a column headed "Ten thousands", so the picture states the answer's column name.
   It is a scaffold rather than a leak of the value, but a stricter reading of "image must not leak the answer" would remove the column headings.
3. as Y6 flashcard "Which words tell you to add?" lists "more than", which is ambiguous ("how much more than" subtracts). Minor.
4. Fractions in prompts/options are plain text "3/4" (consistent across files), while stats-y6-02 uses "¼". Consistent enough; the seeder should not assume either.
5. shape Y6 flashcard on the 2×2 block of squares says the squares "fold onto the same face"; more precisely four squares cannot meet at a cube corner. Wording is loose but not wrong.

## Verification commands

- `cd server && npx tsx src/curriculum/validate.ts ks2maths`: 10 topics, 33 topic-years, 336 questions, 0 problems.
- `cd server && npx tsx src/curriculum/ks2maths/_check_k4.ts`: 70 questions recomputed, 0 mismatches.
- Image regeneration: `cd server && npx tsx ../scratch/curriculum-images/gen-k4.ts` (draws pos-* and stats-* PNGs from `_k4data.ts`).

---

## German (german-ks2-3, german-ks4-5): independent native-level QA

Scope: every question, option, note, vocabulary table, model sentence and flashcard in both packs (16 + 8 topics, 395 quiz questions), re-read without reference to the authors' `_check` scripts (each item's correct answer decided before looking at the key).

**Result: no wrong or ambiguous answer keys found.** Genders, plurals, cases after prepositions, adjective endings, Konjunktiv I/II, auxiliaries (sein/haben), separable verbs, time expressions (halb neun = 8:30, Viertel nach/vor), umlauts/ß, noun capitalisation, and the desoc Y13 politics facts (Bundestag every 4 years, Erststimme/Zweitstimme, 5 % hurdle, Bundesrat = 16 Länder, Chancellor elected by the Bundestag) and Bauhaus 1919 Weimar were all correct. Fixes were to notes that pre-solved quiz items and to accepted-answer lists that were too narrow.

### Notes that duplicated or gave away a quiz item (note changed, quiz untouched)

| file | quiz item | change in the note |
| --- | --- | --- |
| german-ks2-3/denoun.ts (Y8) | denoun-y8-03 "Ich habe ___ Bruder" and denoun-y8-10 "ohne meinen Bruder" | common-mistake example now "einen Onkel"; possessive example now "mein Vater / meinen Vater" |
| denoun.ts (Y9) | denoun-y9-06 (weil ich müde bin), denoun-y9-10 (mit meinen Freunden) | now "weil wir Hunger haben"; "mit meinen Cousinen" |
| deverb.ts (Y7) | deverb-y7-07 (du arbeitest) | common mistake now "du findest, not du findst" |
| deverb.ts (Y8) | deverb-y8-03 (bin gegangen), deverb-y8-10 (Ich muss helfen) | "Ich bin geflogen"; "Ich muss aufräumen" |
| deverb.ts (Y9) | deverb-y9-08 (Wenn ich Zeit hätte) | now "Wenn es kalt wäre, …" |
| german-ks4-5/deide.ts (Y10) | deide-y10-08 (am liebsten) | model sentence now "am liebsten fahre ich Rad" |
| deide.ts (Y11) | deide-y11-05 (am Heiligabend), -08 (gegangen), -11 (dass er kein Handy hat; herunterladet) | "am Neujahrstag"; "ist angekommen"; "dass sie keine Zeit hat"; "heruntergeladet" |
| deloc.ts (Y10, Y11) | deloc-y10-03 (einen Supermarkt), deloc-y11-11 (hätte, würde) | "einen Flughafen"; "Wenn ich Geld hätte, würde ich …" |
| desoc.ts (Y13) | desoc-y13-09 (dass mehr Sprachkurse angeboten werden müssen) | note, common error and flashcard now use "Wohnungen gebaut werden müssen" |
| dework.ts (Y10, Y11) | dework-y10-05 (seit drei Jahren Deutsch), dework-y11-03 (Ärztin) | "Er spielt seit fünf Jahren Geige"; profession example now "Koch → Köchin" |
| degram4.ts (Y11) | degram4-y11-08 reported speech (Anna sagt, dass sie müde ist) | example and flashcard now "Ben … Hunger" |
| degram5.ts (Y12, Y13) | degram5-y12-06 (während der Ferien), -y12-09 (wenn ich hätte gewusst), degram5-y13-04 (sie hätten Durst) | "während des Winters"; "wenn ich gelernt hätte"; table row now "Wir kommen später → sie kämen später" |
| defilm.ts (Y12) | defilm-y12-11 (wie sich die Beziehung … verändert) | note example and common error now "wie ein Krieg eine Familie trennt" |

### Other content fixes

| file | key | problem | change |
| --- | --- | --- | --- |
| dework.ts | Y11 note | "add -in … often with doubling: Kaufmann → Kauffrau" contradicted itself (Kauffrau is not -in) | rewritten: -in with umlaut (Koch → Köchin), some use -frau |
| dehob.ts | Y5 note | listed "Ich spiele Fußball gern" as a mistake; it is grammatical, only less usual | reworded to "put gern straight after the verb at this level" |
| desoc.ts | desoc-y13-12 model answer | "wählen dürfen sollten" was awkward | "Ob Sechzehnjährige wählen dürfen, wird … diskutiert" |

### `short` answers: `accepted` widened (the marker is lowercase + trim + collapse-whitespace only; comma-less and trailing-full-stop variants are added by the builder)

| key | added |
| --- | --- |
| desl-y7-06 (weil) | "da" (valid conjunction, verb last) |
| deide-y10-11 | sich verstehen / auskommen variants, "sehr gut", gut-position, "Stiefmama" |
| deide-y11-02 | "am Silvesterabend" (kept zu Silvester) |
| deide-y11-10 (flagged) | Der Vorteil ist, dass ich meine Freunde / immer meine Freunde + immer / jederzeit / stets + erreichen / kontaktieren + kann (12 forms) |
| deloc-y10-10 | Es gibt … / liegt / befindet sich / ist word orders |
| deloc-y11-10 | junge Leute / Jugendliche / junge Menschen × arbeiten / engagieren sich ehrenamtlich / freiwillig / sind tätig × helfen wollen / möchten |
| desoc-y12-02 | "gleiche Rechte", "die gleichen Rechte" |
| desoc-y12-10 (flagged) | Menschen / Leute × im Homeoffice / zu Hause / von zu Hause aus / von daheim aus × stark / deutlich / erheblich × gestiegen / angestiegen / zugenommen |
| desoc-y13-11 | Wahlergebnis / Ergebnis der Wahl × bekannt gegeben / bekanntgegeben / verkündet / mitgeteilt / bekannt gemacht × three word orders (incl. "am Abend", fronted "Gestern Abend") |
| dework-y10-08 | unsere Handys / Smartphones × benutzen / nutzen / verwenden × four positions of nicht / im Unterricht |
| dework-y11-05 | gern / gerne, will / würde variants |
| dework-y11-10 (flagged) | eine Stelle / einen Job / eine Arbeit / eine Arbeitsstelle × bekomme / finde / kriege / werde … bekommen, with and without "dass" |
| degram4-y10-11 | zu Hause / zuhause / daheim × geblieben / blieb × weil … war / gewesen bin, fronted weil-clause |
| degram4-y11-12 | "In Leipzig werden die Bücher gedruckt." |
| degram5-y12-10 | Ergebnisse / Resultate × nicht zu ignorieren / übergehen / missachten / vernachlässigen |
| defilm-y12-10 | erzählt die Geschichte (von/genitive) / erzählt von / handelt von |
| defilm-y13-10 | Autor / Autorin / Schriftsteller(in) × will / möchte × Erinnerung(en) prägt / formt / gestaltet × with and without articles |
| deart-y12-11 | junge Menschen, überwiegend / meist, "Social Media" |
| deart-y13-11 | "Die Traditionen …", bewahrt / erhalten / gepflegt / beibehalten, and the man-active forms with or without article |

### Unresolved doubts for a human teacher

- deloc-y10-04 "Am Samstag fahren wir ___ Stadtmitte" (key: in die). "in der Stadtmitte" would be grammatical only for driving around within the centre; the natural reading is a destination, so the key stands, but it is the only item with a faint second reading.
- dework-y11-05 rejects "Ich möchte eine Ingenieurin werden" (article after werden). It is not strictly wrong German, but it contradicts the article rule taught in the note, so it is not accepted deliberately.
- deverb-y9-04 accepts only "Komm" for the du imperative; the archaic/formal "Komme" is not accepted.
- desoc Y13 note: Erststimme/Zweitstimme described as at the time of writing; after the 2023 electoral-law reform the Zweitstimme is decisive for seat allocation (the note's wording is still correct).
- Notes still say "das Handy / die Handys" (correct German; British learners may expect "mobile"), no change.

Verification: `cd server && npx tsx src/curriculum/validate.ts german-ks2-3` and `german-ks4-5` both end 0 problem(s); `_check_l5.ts` 0 problems (1 pre-existing flashcard-direction warning on deverb Y8), `_check_l6.ts` 0 problems.

---

## English packs (english-ks1 .. english-ks5): independent QA

Reviewer approach: every question re-read as a teacher and the answer decided BEFORE looking at the key; quotations checked against the standard texts; the authors' `_check_*` scripts were re-run afterwards but not relied on. Questions reviewed: KS1 120, KS2 200, KS3 210, KS4 181, KS5 157 = 868 (plus every note and flashcard deck).

Result: no wrong answer key was found in any of the 868 questions. Defects were in worked-example reuse, one misattributed/misquoted item, three cross-question giveaways, one factually loose claim in an option, and a systematically-longest-correct-option bias in KS2 reading/writing. All fixed in place, question ids and keys unchanged.

### english-ks1 (120 questions)
- Notes reused quiz items (fixed in the NOTES): phon Y1 (tables listed every quiz answer: tail/feet/night/boat/farm/boil/burn; worked examples were sheep and rain = phon-y1-07/-08); phon Y2 (hopping = phon-y2-10, jump+ing = -03, hopeless = -04, gate/hope lists); gp Y1 (I like cake, Where is my hat, cat+dog "and" example = gp-y1-01/-03/-06); gp Y2 (What a lovely day!, red/blue/green list, fluffy white cat, walked, Zoe's = gp-y2-06/-07/-09/-08/-10); rc Y1 (red kite, Ben's umbrella) and rc Y2 (picnic, Mina, "popped up" all verbatim); spell Y1 (dog/box/dish/bus plurals, walk+ing) and spell Y2 (their dog, don't, Sam's, hop/make/cry); vocab Y1 (hot/up, apple/cat-dog-rabbit, big/large, happy/kind/lock un- words) and vocab Y2 (happy/glad, shout/yell, loud/quiet, help family, careful, hopeless, famished); wc Y1 (cat sat on the mat, big brown dog) and wc Y2 (Ali/because, muddy brown dog, Kit's map plan).
- wc-y1-07: "I like cats ___ dogs." is defensible with "or"; prompt changed to "Tom ___ Mia are friends." (still "and").
- Unresolved/notes: correct option is the longest in about half of the wc items (5/9, 6/9); left, distractors are already 1-2 words shorter only.

### english-ks2 (200 questions)
- spell-y3-02 explanation was self-contradictory ("One s, then one p (appear has pp)"): rewritten.
- spell Y4 note listed "discussion" as its -ssion example, which is the spell-y4-06 answer: note changed to passion, mission.
- Answer-length bias fixed by lengthening distractors (answers unchanged): rc-y4-03/-04/-07, rc-y5-02/-04/-05/-06/-08/-09, rc-y6-03/-04/-06/-07/-09, wc-y3-02/-03/-04/-07, wc-y4-01/-05, wc-y5-01/-02/-03/-04/-09, wc-y6-01/-02/-06 (correct option had been 1.5x to 3x the length of the longest distractor). Single-word vocab items are left alone: length is intrinsic.
- No key errors. gp, rc, vocab keys all re-derived independently.

### english-ks3 (210 questions)
- shak-y8-09: Malvolio's letter quotation was "thrust upon 'em"; the text reads "thrust upon them" (prompt and registered quote fixed).
- prose-y7-03 vs prose-y7-10: the compare item labelled the extracts "(third person)" / "(first person)", giving away prose-y7-03: labels removed.
- vocab-y7-05 vs vocab-y7-10: both hinged on thrifty/stingy (the second gave away the first): second item's pair changed to curious/nosy. vocab Y8 flashcard gave "deafening silence" (the vocab-y9-04 answer): changed to "cruel kindness".
- poet-y7-08 (alliteration): "sibilance" added to accepted (repeated s sounds is a defensible answer to the wording).
- Notes reusing quiz content (fixed in the NOTES): prose Y9 (antithesis example "best of times, worst of times" = prose-y9-01), wc Y8 ("This decision" = wc-y8-04; "In my personal opinion I think" = wc-y8-09; a foreshadowing example built on the same "never guessing" pattern as wc-y8-03), wc Y9 ("No sound, no light, no hope" mirrored wc-y9-06).
- Answer-length bias reduced (distractors lengthened, answers unchanged): rc-y7-02/-03/-04/-08, rc-y8-03/-05/-06, rc-y9-06/-08/-09, prose-y7-02, wc-y8-02.
- All quotations (Tennyson, Wordsworth, Blake, Owen, Shakespeare, Keats, Shelley, Donne, Dickinson, Dickens, Stevenson, Poe, Austen, Bronte, Conan Doyle, Wells, Carroll, Grahame, Barrie, Burnett) verified; the Scrooge and Dickinson excerpts are trimmed but not misquoted.
- Gap (not an error): the taxonomy lists a KS3 Spelling topic (`spell`, Y7-9) but the pack has none, so Year 7-9 placement papers have no Spelling.

### english-ks4 (181 questions)
- nov4-y10-04: the prompt attributed "Are there no prisons? ... Are there no workhouses?" to Scrooge; in Stave 1 Scrooge says "Are there no prisons?" and "And the Union workhouses?" (the "no workhouses" line is the Spirit echoing him). Prompt corrected to Scrooge's own words.
- nov4-y11-04: "Why does Jane return to Rochester only after Thornfield has burnt" misstates the plot (she returns and finds it burnt): reworded to "Why can Jane marry Rochester only after..." (same answer).
- No wrong keys; all quotations checked (Owen, Tennyson, Browning, Rossetti, Donne, Shelley, Blake, Shakespeare, Dickens, Brontë, Shelley, Austen). Modern texts are not quoted, as required.

### english-ks5 (157 questions)
- litp-y13-11 (original poems A/B): the correct option claimed "A's ... end-stopped lines" but lines 1 and 3 of Poem A run on ("swings / on hinges", "rings / of thorn"). Option and explanation reworded to "complete, controlled sentences" (still the best-supported answer).
- langf Y13 note gave "Can you pass the salt?" (the langf-y13-10 answer) and "the closure of the library" (the langf-y13-08 answer) as its examples; note and flashcard now use "Do you know the time?" and "the demolition of the old pool".
- langc-y12-10: "I doubt she cometh not" was an unidiomatic Early Modern sentence; changed to "She cometh not" (key unchanged).
- No wrong keys; quotations (Yeats, Owen, Hardy, Dickinson, Thomas, Fitzgerald, Wilde, Conrad, Marlowe, Congreve, Shakespeare, Webster) and theorist attributions (Aitchison, Crystal, Labov, Trudgill, Milroy, Giles, Lakoff, Zimmerman and West, Tannen, Berko, Bruner, Halliday, Said, Bhabha, Greenblatt, Derrida, Lacan, Gilbert and Gubar, Achebe) checked.

### Residual doubts (judgement calls, unchanged)
- rc-y8-09 (KS3): "Hearing and Smell" for the Marrakech sentence; "thick with" could be read as touch and "cumin, mint" as taste. Answer remains best supported.
- nov4-y10-05 uses "all great Neptune's ocean" (Macbeth's line) inside a question about Lady Macbeth's "Out, damned spot!"; not misattributed, but a reader may assume it is hers.
- After the length fixes the correct option is still slightly the longest in about 40% of singles overall (282/708 strictly longest, ratio now mostly under 1.4); worst topic-years remaining: english-ks2 rc Y6, english-ks3 rc Y8, prose Y8.
- Dickinson lines are quoted with modern punctuation ("never stops at all") rather than her dashes: harmless.

### Verification
`cd server && npx tsx src/curriculum/validate.ts english-ks1|2|3|4|5` all end `0 problem(s)`; `_check_e1/e2/e3/e4/e5.ts` all pass after the edits.

---

# French and Spanish: independent native-level QA (packs french-ks2-3, french-ks4-5, spanish-ks2-3, spanish-ks4-5)

Scope: every question, option, key, explanation, note, vocabulary table, model sentence, flashcard, reading passage and `accepted` list in the four
packs (about 800 quiz questions: 200 + 192 + 200 + 204, 72 topic-years). Every item was re-read as a teacher and the right answer decided before the
key was looked at; the authors' `_check` scripts were NOT relied on (they were only re-run afterwards). Result: **no wrong or ambiguous answer keys
were found** in any of the four packs. Defects were in notes (wrong pronunciation claim, a misplaced table cell, notes that gave away quiz items),
in `accepted` lists (missing legitimate variants, one wrongly accepted variant, accent-stripping that accepted a wrong form) and in one prompt.

## french-ks2-3 (16 topics, 200 questions)
| id / place | defect | fix |
| --- | --- | --- |
| frtown-y6-07 explanation | said the c in *parc* is silent (it is pronounced: "park") | explanation now says "Say it 'park'" |
| frhob Y5 note (+ flashcard) | "verbs end in -er or -re" but the table has *lire* (-ire); *le vélo* glossed only as "cycling" | note says "-er, or -ire for lire"; *le vélo* = bike, *faire du vélo* = to go cycling (note + card) |
| frnoun Y7 note | plural table lacked -eu → -eux although frnoun-y7-09 tests *les jeux* | row `un jeu → des jeux` added |
| frft-y8-08 | "I sometimes watch TV": missing *télévision* and *quelquefois* variants | 6 accepted variants added |
| frverb-y8-08 | accent-stripped answer "nous avons regarde" (present-tense form for the participle) was accepted | `na` removed: the é of the participle is the point |

## french-ks4-5 (8 topics, 192 questions)
| id / place | defect | fix |
| --- | --- | --- |
| frwork-y10-02 | `accepted` contained "la matière" for "a school subject" (wrong article) | removed |
| frgram4 Y10 note | worked example *elle est partie* duplicated the diagnostic frgram4-y10-03 (key: est partie) | note now uses *elle est arrivée* |
| frgram4-y11-06 | accent-stripped "avait commence" (present-tense form) was accepted | `na` removed |
| fride-y11-09 | same problem ("regarde" for "regardé") | `na` removed; variants with *terminé* and the reversed clause order added |
| fride-y11-03 | *je vis à Lyon depuis cinq ans* (valid) not accepted | added (4 forms) |
| fride-y11-10 | *ce que j'admire en lui* not accepted | added |
| fride-y10-10 | *téléphone portable* / *mobile* not accepted | added |
| frwork-y11-08 | near future *je vais chercher* (valid for "will look") not accepted | added |
| frgram4-y11-09 | *a été excellent*, *était super/génial* not accepted | added |

## spanish-ks2-3 (16 topics, 200 questions)
| id / place | defect | fix |
| --- | --- | --- |
| esweather Y6 note | *el paraguas* (umbrella) sat in the "Cuerpo" (body-part) column of the table | removed from the table, added as a "Handy when it rains" line |
| esnoun Y8 note | "Common mistakes" example *mi hermana es alto* duplicated esnoun-y8-01 (key: alta) | now *mi prima es simpático* |
| essl Y7 note | worked example *las ciencias son interesantes* duplicated essl-y7-09 | now *las matemáticas son útiles* |
| esverb Y7 note | *mis padres vive* duplicated the mistake-spotting item esverb-y7-09; *somos en Madrid* mirrored esverb-y7-06 | now *nosotros habla* and *mi casa es en Madrid* |
| esverb Y8 note | *he escribido* duplicated the mistake in esverb-y8-09 | now *he ponido → he puesto* |
| esverb-y9-10 | prompt without a time cue: both *vivía* and *viví* defensible | prompt now starts "Antes yo ___" |
| esgreet-y3-06/-10, esfood-y5-10, essl-y7-06, esft-y8-10 | valid variants missing: *yo tengo…*, *soy Diego y…*, *yo como…*, *asignatura preferida / materia favorita*, *no toco nunca…* (the note itself teaches "no … nunca") | added |

## spanish-ks4-5 (8 topics, 204 questions)
| id / place | defect | fix |
| --- | --- | --- |
| essoc Y13 note | model sentence *Para que la integración funcione…* duplicated the diagnostic essoc-y13-05 | replaced by a sentence about newcomers feeling welcome |
| esgram4 Y11 note | three worked examples duplicated quiz items: pluperfect *ya había empezado* (-06), passive *fue construida* (-12), *si llueve mañana* (-09) | now *ya habíamos cenado…*, *La carta fue escrita por…*, *Si tengo tiempo, te ayudaré* |
| esgram5 Y13 note + card | *Ojalá tuviera más tiempo libre* (= esgram5-y13-08 key) and *si tendría* (= the wrong option in -12) were in the note/flashcard/common errors | replaced by *Ojalá viviera más cerca…* and *si vendría* |
| esgram5-y13-14 (written model) | *siempre he querido que mi vida fuera* (imperfect subjunctive after present perfect: doubtful) | *de pequeña quería que mi vida fuera…* |
| esart-y13-12 | accent-stripped "pinto" (present) accepted for *pintó* | `accents: true` |
| essoc-y13-12 | *un trabajo / empleo*, *castellano* variants missing | added |
| eswork Y11 note | paradigm *viviré, tendré* were also the answers of eswork-y11-08 | now *seré, iré* |

## Systemic fix to `accepted` (both French packs and Spanish KS4-5)
The marker lower-cases, trims and collapses whitespace only. The French `_h.ts` builders (both packs) and the Spanish KS4-5 builder now also add,
for every sentence answer, the variant **without commas** and the variant **with a final full stop** (French also `?`/`!` with or without the French
space). Before this, "Après avoir fini mes devoirs j'ai regardé une série" (no comma) or "Je regrette que tu ne sois pas venu." (full stop) was
marked wrong. The Spanish KS2-3 builder already did this. Accent-stripped variants are now excluded where the accent distinguishes a different
form (participle -é vs present, preterite -ó vs present -o).

## Unresolved doubts for a human teacher
- **esverb-y8-06** (*comí*) is `strict`: a typed "comi" is marked wrong. Deliberate (the note stresses that accents change the tense) but harsh for children without an accented keyboard; consider allowing it.
- **esverb Y9 note** keeps the paradigm *hablaría, comería, viviría* because `_check_l3.ts` requires the note to contain the diagnostic answer *comería*; a purist would remove the duplicate.
- **frid-y7-03**: *les cheveux bruns* for brown hair is textbook usage; many French speakers say *châtains* (bruns = dark brown). Not wrong at KS3.
- **esfam-y4-09**: "dos hermanos y una hermana" is read as 2 brothers + 1 sister = 3 (the note says *hermanos* can include sisters; here the list separates them). Unambiguous in context but worth a glance.
- **eside-y10-06** (reading): "The writer sometimes stays up late on the phone" is inferred from *a veces me quedo despierto hasta tarde* + the phone complaint; defensible, not literal.
- **esgram5 Y13 written model** uses a mixed conditional (*Si hubiera nacido… sería*): correct Spanish, but beyond the sequences taught in the note.
- **Register**: French uses *vous* for polite requests and *tu* for friends throughout; no item depends on tu/vous alone. Spanish is Spain-neutral (vosotros forms shown but not tested; *zumo, ordenador, móvil, coger* are Peninsular).
- Cultural/factual claims verified (no change needed): Fête de la musique 21 June, Journées du patrimoine in September, 14 juillet, Día de Muertos 1–2 Nov, flamenco UNESCO 2010, Alhambra 13th–14th c. Nasrid, Sagrada Família begun 1880s (Gaudí d. 1926), Guggenheim Bilbao 1997, Guernica 1937 (Paris Expo), Goya *3 de mayo* 1814, Día de los Reyes 6 Jan, Las Fallas (Valencia), Feria de Abril (Sevilla).

## Verification
- `cd server && npx tsx src/curriculum/validate.ts <pack>` for each of the four packs: 0 problem(s) (16 + 8 + 16 + 8 topics).
- Re-run: `_check_l1.ts` (0 problems), `_check_l2.ts` (ALL CHECKS PASSED), `_check_l3.ts` (0 failures), `_check_l4.ts` (0 errors; 18 pre-existing warnings, all reviewed and benign: shared 5-grams with note vocabulary or written model answers).

## Science packs (science-ks1, -ks2, -ks3, -ks4, -ks5-bio, -ks5-chem, -ks5-phys): independent QA

Scope: 1,290 quiz questions (80 + 200 + 210 + 389 + 196 + 238 + 177), every note and flashcard set. Method: every question was solved or judged
from the prompt/options/image as a science teacher BEFORE looking at the key; the authors' `_check_*`/`_chk_*` scripts were not relied on (they were
re-run only at the end). About 85 question PNGs were opened and the plotted/drawn values recomputed against prompt, alt text and key
(KS1 7, KS2 27, KS3 13, KS4 14, KS5 bio 7, chem 10, phys 7). No wrong answer key was found in any pack; every calculation re-solved to the stated key.
Defects were in notes, one image, prompt self-containment, tolerances and stated constants.

### Defects found and fixed (ids kept; validator 0 problems; author checkers re-run clean)

| pack | id / file | problem | fix |
| --- | --- | --- | --- |
| ks2 | living-y6-03/-04/-05 + `living-groups.png` (regenerated) | table column "Dry scales" was Yes for animal S, which is the FISH. Fish scales are not dry, so the picture contradicted the fish/reptile teaching | column renamed "Scales" in PNG, alt, options, prompt, explanation, `_s2data.ts`, `_check_s2.ts`, `gen-s2.ts` |
| ks2 | living.ts Y4 note, worked example 1 | leaf key was inverted ("smooth edge -> holly or oak; not smooth -> beech"): beech is the smooth-edged one, holly/oak are not | corrected |
| ks2 | living.ts Y6 note | viruses listed as "living things too small to see" (contested) | wording now says scientists disagree that viruses are alive |
| ks2 | evol.ts Y6 note | "fossil fern in a cold place shows it was warm and wet" (ferns grow in cool damp woods) | palm leaf / "much warmer" |
| ks2 | rocks.ts Y3 note | "shiny crystals you cannot scratch could be marble" (marble scratches with a nail) | granite / "with a coin" |
| ks2 | states.ts Y4 note | "boiling is fast evaporation" (boiling is bubbles forming throughout the liquid) | corrected |
| ks3 | bgen-y9-09 | human eye colour presented as a simple dominant/recessive pair (folklore; it is polygenic) | recast as black/white fur in guinea pigs; same answer, 1 in 4 |
| ks3 | becol.ts flashcard | quadrat formula garbled ("Mean per quadrat area x total area / area of one quadrat") | mean number per quadrat x (total area / quadrat area) |
| ks3 | cearth-y9-06 explanation | referred to "the fourth statement" (order-dependent) | rewritten order-independent |
| ks4 | b4org-y10-12 | graph-ratio tolerance 0.05 too tight for reading 16 and 5 off a graph | 0.15 |
| ks4 | c4quant-y11-06, -12 | key depends on molar gas volume 24 dm3 but prompt did not state it | constant added to both prompts |
| ks4 | c4bond.ts Y11 note | note example (5 nm vs 50 nm, "ten times bigger") gave away c4bond-y11-11 (10 nm vs 100 nm, factor 10) | note example changed to 50 nm vs 25 nm ("twice as big") |
| ks5-bio | b5inh-y13-07 | prompt said "for the same data": depended on another question (chi-squared value not stated) | value stated in the prompt (chi-squared = 1.04) |
| ks5-bio | b5inh-y13-11 | Bayesian purists could use II-3's two unaffected children | "ignore what you can tell from II-3's existing children" |
| ks5-bio | b5enz-y12-11 | tolerance 0.02 too tight for two graph readings | 0.05 |
| ks5-chem | c5anal.ts Y12 note | note's mass-spec example ([CH3CH2CO]+ = 57) was the answer to c5anal-y12-04 | example changed to [CH2OH]+ = 31 in an alcohol |
| ks5-chem | c5org-y12-06 explanation | "first option ... last two" (order-dependent) | rewritten |
| ks5-phys | p5nuc-y13-12 explanation | explanation said 4.16 but key is 4.15 (unrounded lambda) | explanation states both; tolerance already accepts both |

### A-level Biology: correct option systematically longest (lengthened distractors, key text untouched)

Before: correct option was the unique longest in 82 of 112 single-choice items (73%) and sat in position B in 65 of 112 (58%). After lengthening
the distractors of 77 questions (kept plausible but wrong; none turned into a second right answer) and re-ordering the options of the 104 text-option
single items (image-letter items left alone): key is the unique longest in 39 of 112 (35%), positions A/B/C/D = 26/29/28/29. The same distractor
edits are all in `science-ks5-bio/b5*.ts`; `_check_s5.ts` (76 checks) and `validate.ts` pass.

### Verified independently (samples of hand recomputation, all matched the keys)

KS5 chemistry: Ar/Mr, moles, pV=nRT (gas volumes, Mr from gas data), empirical/molecular formulae, hydrate x=5, atom economy, yields, Hess cycles, Born-Haber
(NaCl -787, MgCl2 -643), dG/T thresholds, Kc/Kp, pH of strong/weak acids and buffer, Ka from half-equivalence, order/k/Arrhenius (Ea = 60.0 kJ), oxidation numbers,
cell EMFs, redox titrations, isomer counts (C6H14 = 5), E/Z and chirality, IR/NMR/MS assignments. KS5 physics: astrophysics (Wien, Stefan, Hubble 14.0 Gyr),
SHM, capacitors (tau, ln V), fields (g, Coulomb, r = mv/Bq, escape speed), uncertainties, mechanics, decay (half-life from a background-corrected graph),
photoelectric effect, binding energy (D-T 17.6 MeV), gas laws, stationary waves. KS5 biology: Simpson D, chi-squared (1.04), Hardy-Weinberg, Spearman rs = -0.94,
SD 0.71, PCR 2^n, herd immunity 1-1/R0, Lincoln index, NPP/efficiency, cardiac output, Meselson-Stahl fraction, log-scale reading. KS4/KS3/KS2/KS1: all numeric items and every
graph reading (heating curves, distance-time, v-t, I-V, growth and pulse graphs, gestation, shadow scaling, gear ratios, pedigrees, Punnett squares).

### Unresolved doubts / observations for the owner (not changed)

1. Correct-option-longest rate outside A-level Biology (single-choice): KS2 48%, KS4 50% (b4cell 6/6, b4eco 6/7, b4org 11/16, b4bio 5/7, c4bond 10/19), KS5 chemistry 47% (c5gp 13/23),
   KS3 42%, KS5 physics 36%, KS1 32%. Not rebalanced (every item needs hand-written distractors); the same treatment as bio would be sensible for KS4 and KS5 chemistry.
2. Stylised graphs (deliberately idealised, all keys read correctly from them): states-heating (KS2) shows ice warming more slowly than water and a 4-minute melt against a
   10-minute boil; cpart-y7 (KS3) has equal heating slopes for all three states; the filament-lamp I-V curve (p5elec-y12) has an infinite slope at the origin. Fine for the questions asked.
3. Simplifications a specialist may still query: c4bond-y10 table "simple molecular: never conducts" (true of pure simple molecular substances; fine at GCSE), KS4 b4bio-y10-10 uses the AQA term "oxygen debt", KS2 "Food chains always start with a producer" (detritus chains ignored), b5resp-y13-05 (limiting factor read at a point where the blue curve is still creeping up).
4. Data-book dependence left as-is because the prompt or note states it: KS4 g = 9.8 N/kg and c = 4200 J/kg C (stated in prompts), KS5 physics constants (stated in prompts).


---

# Independent maths QA sweep (second reviewer): maths-ks1, ks2maths, maths-ks3, maths-ks4, maths-ks5

Scope: every quiz question in the five maths packs (KS1 150, KS2 336, KS3 180, KS4 158, KS5 306 = 1,130 questions), every note and flashcard set,
and 70+ of the PNGs (each opened and compared with the prompt, the alt text and the stored key). Every key was re-solved by hand from the prompt,
options or picture BEFORE looking at the stored answer; the authors' `_check_*` scripts were not used as evidence (they were only re-run afterwards
to confirm nothing regressed). Numeric keys with a rounding rule were re-derived to the stated decimal places, and tolerances were compared with the
true unrounded value.

## Result

| pack | questions re-solved | wrong / ambiguous keys | picture mismatches | notes/cards changed |
| --- | --- | --- | --- | --- |
| maths-ks1 | 150 | 0 | 0 (12 images opened) | 7 small edits |
| ks2maths | 336 | 0 | 0 (about 45 images opened) | all worked-example notes re-numbered (see below) |
| maths-ks3 | 180 | 0 | 0 (10 images opened) | 9 edits |
| maths-ks4 | 158 | 0 | 0 (9 images opened) | 3 edits |
| maths-ks5 | 306 | 0 | 0 (16 images opened) | 5 edits |

No incorrect answer key, no item with two defensible correct options, no item with none, and no picture that contradicts its prompt or key was found.
Spot checks that were done against the picture rather than the alt text: every coordinate/translation/reflection grid (pos), all clocks opened,
ruler, thermometer, both jugs, bar/line/pie/pictogram/tally/timetable charts, histograms (area = frequency, total 100), cumulative frequency and box
plots, cube nets (C really overlaps, D really is the 3-3 net), angle diagrams, Venn diagrams and tree diagrams, KS5 graphs (function transformations,
cubic roots and y-intercept, y = |x^2 - 4|, y = 3e^(-x), y = 2^x - 4, log/ln linear forms, tangent, R-form, v-t graph, beam, regression scatter).

## Defects found and fixed

### 1. Worked examples in notes that reuse the numbers of a quiz item (ks2maths: the ~133 flagged; plus KS1/3/4/5)

Fixed by changing the NOTE (and the flashcard that repeated the same example), never the quiz. Every new example was recomputed by hand, and
`validate.ts`, `verifyNpvAs.ts`, `_check_k2/k3/k4` all still pass. Files and what changed:

| file | notes changed | examples now used (old example that duplicated a quiz item) |
| --- | --- | --- |
| ks2maths/as.ts | Y3, Y4, Y5, Y6 (all worked examples, mental-method bullets, matching flashcards) | e.g. 358 + 165 = 523, 602 - 384 = 218; 3,486 + 2,547 = 6,033; 47,358 + 26,475 = 73,833; 8,000 - 3,998 = 4,002 |
| ks2maths/frac.ts | Y3, Y4, Y5, Y6 | e.g. 2/5 of 35 = 14; 5.86 to 1 d.p. = 5.9; 23/4 = 5 3/4; 3/5 + 7/10 = 1 3/10; 1/4 + 2/3 = 11/12; 7/8 = 0.875 |
| ks2maths/md.ts | Y3, Y4, Y5, Y6 | e.g. 32 x 4 = 128; 163 x 4 = 652; 42 x 37 = 1,554; 1,548 / 6 = 258; 418 x 27 = 11,286; 1,296 / 12 = 108 |
| ks2maths/meas.ts | Y3, Y4, Y5, Y6 | ruler 3 to 11 cm, change from £2.70, 7 x 3 perimeter, 4 km, 8:25 pm = 20:25, L-shape perimeter 32 cm, 9 m x 5.5 m = 49.5 m^2, 45 miles = 72 km, 60 x 30 x 20 cm = 36 litres |
| ks2maths/npv.ts | Y3, Y4, Y5, Y6 | place-value tables now 362, 6,317, 728,406, 4,718,205; rounding 2,764, 4,996, 538,614, 5,238,470, 7,395,820; -3 to 5 degrees; XLVII, DCCXL |
| ks2maths/rp.ts | Y6 | £54 in 2 : 7, 35% of 240 = 84, enlargement of a 4 by 6 rectangle |
| ks2maths/alg.ts | Y6 | C = 4t + 2, 4n + 6 = 30, 3, 8, 13, 18 |
| ks2maths/shape.ts | Y3, Y4, Y5, Y6 | square-based pyramid edges, "faces east" turn, 115 degrees on a line, 110/85/90 at a point, 41 degree diagonal, 52/71 triangle, decagon 144 degrees; the net sentence and flashcard no longer describe the exact net in shape-y5-07 |
| maths-ks1 | as Y2, md Y1, npv Y1, meas Y1/Y2, pos Y1, shape Y1 | e.g. "30 + 40" bullet, "double 4 / half of 10 / 12 sweets", "one more than 12 / one less than 20", "two 5p coins", "20p + 20p + 5p = 45p" card, "face the window" and "3 steps" examples |
| maths-ks3 | alg Y8, alg Y9, num Y8, num Y9, prob Y7, prob Y8, stats Y7, geo Y9 | "3(x + 4)" and "6x + 9 = 3(2x + 3)" bullets, "2x + 3 < 11", "4^3 and sqrt 144", "2^-3 = 1/8", the mutually-exclusive "2 and 5" example, the "7 (6 out of 36 ways)" card, the shoe-shop mode example, "(5, 12, 13)" triple card |
| maths-ks4 | alg Y10, num Y10 | "5, 9, 13, 17", "84 = 2^2 x 3 x 7" (was the key of num-y10-01), "27^(2/3)" |
| maths-ks5 | proof Y12, proof Y13, seq Y13, stat5 Y13 | flashcards that gave away keys: "n^2 - n + 11 ... not for n = 11" (key of proof-y12-11), "30 031 = 59 x 509" (key of proof-y13-06), "(1 + x)^-1 to x^3", continuity correction "P(X <= 45)" |

Pos and stats notes in ks2maths had already been re-numbered by K4 and were only re-read.

### 2. Typed-number questions whose correct answer would be marked wrong (comma problem)

`hubScoring.toNumber()` accepts only plain digits (plus standard form): a student who types "2,500" for a `number` question is marked wrong.
Nine prompts with answers of 1,000 or more did not say so (the as/npv items already did). Added "Type your answer as digits with no comma." to:
meas-y4-10, meas-y5-01, meas-y6-10 (ks2maths); geo-y11-10, num-y10-09, rp-y11-04, rp-y11-05, rp-y11-10 (maths-ks4); mech-y12-12 (maths-ks5).

### 3. Ambiguity

- stat5-y12-04 said only "standard deviation" (population sd from the data given is 3.317, a calculator sample sd would give 3.546). The prompt now states
  σ = √(Σx²/n − x̄²), matching the note.

### 4. Checkers brought in line (they were failing on questions added by the previous QA pass)

- ks2maths/_check_k2.ts: added expectations for frac-y5-11 and frac-y6-11 and allowed 10-12 questions per quiz (was hard-coded to 10; it reported 4 failures before).
- ks2maths/_check_k3.ts: added expectations for shape-y5-11 (80 degrees) and shape-y5-12 (reflex); it reported 2 mismatches before.

## Verification commands (all clean after the edits)

- `cd server && npx tsx src/curriculum/validate.ts <pack>` for maths-ks1, ks2maths, maths-ks3, maths-ks4, maths-ks5: 0 problem(s) each
  (8/10/6/6/12 topics; 150/336/180/158/306 questions).
- `_check_m1`, `_check_m2`, `_check_m3`, `_check_m4`, `_check_m4_a`, `_check_k2`, `_check_k3`, `_check_k4`, `verifyNpvAs`: 0 failures.

## Doubts / recommendations that were NOT changed

1. `server/src/lib/hubScoring.ts` `toNumber()` rejects "£", thousands commas, trailing units ("35 g") and the Unicode minus sign (U+2212). Every `number` question
   with a negative answer (npv-y6-10, rp-y11-08, diff-y12-07, algf-y13-11, explog-y12-09, coord-y13-07, vec-y12-07, vec-y13-03, numm-y13-01, diff-y13-08/12,
   seq-y13-05) needs an ASCII hyphen. A small tolerant normaliser (strip £ , and spaces, map U+2212 to "-", drop a trailing unit) would remove a whole class
   of "correct but marked wrong" cases without touching content. Owner: whoever owns hubScoring.
2. Placement papers: even after re-numbering, notes still contain the METHOD of the diagnostic items, which is unavoidable and intended. KS5 proof-y13-10 (the parity
   fact for a - b and a + b) and proof-y13-04 (a and b both even) are stated as flashcard facts and are also the keys of those questions: it is a conceptual, not a numeric,
   echo and was left.
3. The npv-y5-01 place-value picture (column heading "Ten thousands" over the 4) noted in the previous log is unchanged.
4. ks2maths shape flashcard about a 2 by 2 block of squares (previous log, item 5) unchanged.
5. explog-y12-12 key is 1.1 (true value ln 3 = 1.0986) with tolerance 0.005: it accepts 1.095 to 1.105, so 1.10 and 1.099 are both marked right; fine, listed only because the key looks under-rounded.
6. Fractions in KS2 prompts are plain text "3/4" while some KS1 items use unicode fractions; the seeder must not assume one form.
