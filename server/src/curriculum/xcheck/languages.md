# Languages cross-check (French, Spanish, German) against the official DfE documents

Report only. No content files were edited. Reviewed 2026-09-19 by reading every notes file and all KS4-5 question files, the
Grammar quizzes in the KS2-3 packs, and keyword-scanning the rest (KS2-3 non-grammar quizzes and flashcards were only sampled).

## 1. Sources

### Fetched and read (Open Government Licence documents, saved to the scratchpad `lang/` folder, text-extracted with pypdf)

| # | Document | Landing page | File actually read |
| --- | --- | --- | --- |
| 1 | National curriculum in England: languages programmes of study, KS2 (Sept 2013) | https://www.gov.uk/government/publications/national-curriculum-in-england-languages-progammes-of-study (the slug really is spelled "progammes") | https://assets.publishing.service.gov.uk/media/5a7b9246e5274a7318b8f889/PRIMARY_national_curriculum_-_Languages.pdf |
| 2 | Same, KS3 | same page | https://assets.publishing.service.gov.uk/media/5a7c5afae5274a7ee501a69e/SECONDARY_national_curriculum_-_Languages.pdf |
| 3 | French, German and Spanish GCSE subject content, Sept 2025 version (first teaching Sept 2024, first exam summer 2026), incl. Annexes A-C grammar and the Annex E "required vocabulary" tables | https://www.gov.uk/government/publications/gcse-french-german-and-spanish-subject-content | https://assets.publishing.service.gov.uk/media/68da4b56dadf7616351e4b48/French_German_and_Spanish_GCSE_subject_content_2025.pdf |
| 4 | Table of changes to that GCSE content (Sept 2025) | same page | https://assets.publishing.service.gov.uk/media/68c2a331838e7712ea2bfe98/Table_of_changes_made_to_the_GCSE_subject_content_for_French_German_and_Spanish_September_2025.pdf (read; nothing changes the findings below) |
| 5 | GCSE modern foreign languages subject content (legacy version, now current only for languages other than F/G/S). Used only because it is the DfE text that names the three GCSE themes | https://www.gov.uk/government/publications/gcse-modern-foreign-languages | https://assets.publishing.service.gov.uk/media/6389fb628fa8f569f55c9833/GCSE_subject_content_modern_foreign_languages.pdf |
| 6 | GCE AS and A level subject content for modern foreign languages (July 2023), incl. the Annex of grammar lists for French, German and Spanish (AS and A level) | https://www.gov.uk/government/publications/gce-as-and-a-level-modern-foreign-languages | https://assets.publishing.service.gov.uk/media/64aebaa0fe36e0000d6fa848/GCE_AS_and_A_level_subject_content_for_modern_foreign_languages.pdf |

How they were found: my first WebFetch guesses at gov.uk slugs returned 404, so I used the gov.uk search API and content API
(`https://www.gov.uk/api/search.json`, `https://www.gov.uk/api/content/...`) via curl to get the real landing pages and PDF URLs.

Secondary sources used only for language or fact checks (fetched, but NOT official DfE): duden.de/rechtschreibung/Hase, duden.de/rechtschreibung/Vogel,
larousse.fr (châtain), en.wikipedia.org/wiki/2025_German_federal_election.

### Could not fetch, or does not exist (stated plainly)

- **The 1,200 / 1,700 word lists are not published by the DfE.** The GCSE content only sets the parameters (1,200 foundation + 500 higher lexical items, at least 85% from the
  2,000 most frequent words, para 13-19) and Annex E lists the words the *grammar* requires. The full lists are written by the exam boards (AQA, Pearson, Eduqas) and I did
  not fetch them. Every vocabulary comment below is therefore an unverified judgement, marked as such.
- **The DfE GCSE content no longer prescribes themes.** Para 12 says only that "specifications should identify a limited number of broad themes". The three themes we use
  (identity and culture; local, national, international and global areas of interest; current and future study and employment) come from the legacy DfE document (#5) and
  from the boards. Our three GCSE topics match them, so there is no theme gap. Nothing in the DfE text can be quoted to prove a theme is missing.
- **The DfE A-level content does not prescribe themes or works either.** It only requires "one theme at AS and two themes at A level" from each of (i) social issues and trends and
  (ii) political and/or intellectual and/or artistic culture (para 7), plus prescribed literary works / films chosen by the boards (paras 9-13). Board lists were not fetched.
- The Annex D (.ods) and Annex E (.xlsx) spreadsheets were downloaded but not parsed; I used the identical Annex E text inside the PDF.
- bundestag.de and bundeswahlleiterin.de pages returned 404, so the German electoral point rests on the Wikipedia article (secondary) plus my own knowledge; treat as
  "verify before editing".

## 2. Headline findings

Counts of distinct findings in the tables below (the three "see cross-cutting rows" pointer rows are not counted): gap 17, misplaced/wrong stage 19, out of scope 2,
vocabulary/wording 3 (all unverified), language accuracy 9. Total 50. No hard language errors (wrong keys, misspellings, wrong forms) were found in the French or Spanish
KS4-5 packs or in the KS2-3 Grammar quizzes; the accuracy rows are mostly marking-policy, stale-fact or ambiguity points, plus two real errors in German `defam`.

The most important five:

1. **GCSE "Grammar — Advanced" Year 11 (all three languages) teaches AS-level grammar the DfE GCSE lists do not contain, while real GCSE list items are missing.** Present subjunctive, pluperfect, general
   passive, si-clauses, dont / cuyo / quien, productive genitive (German) are AS or A-level items; GCSE items with no coverage include French être en train de / venir de,
   Spanish acabar de and present continuous, and imperatives (French/Spanish grammar).
2. **A-level grammar lists (DfE annex) are only partly covered**, and AS items (future perfect, conditional perfect, passé simple recognition, si-clauses with imperfect subjunctive, German pluperfect) are
   deferred to Year 13, while perfect subjunctive (A-level only for French) is taught in Year 12.
3. **German desoc Y13 electoral note and question `desoc-y13-04` are stale** after the 2023 electoral reform (fixed 630 seats; a constituency win via the Erststimme no longer guarantees a seat).
4. **German KS2 (`defam` Y4): "der Hase = rabbit" is wrong** (Duden: Hase = hare; rabbit is das Kaninchen) and the model sentence "Mein Onkel hat einen Vogel" is the idiom for "is mad".
5. **Programme-of-study skills with no coverage anywhere**: KS2 songs, rhymes, stories, dictionary use; KS3 literary texts; A-level research project, mediation, and real prescribed works
   (only invented synopses exist, which is deliberate for copyright, but it leaves the DfE "works" requirement untouched).

Also worth acting on: Spanish `esverb-y8-06` strict accent marking, French `frid-y7-03` (châtains).

## 3. Cross-cutting (all three languages)

| Type | Topic key / year | Official reference | Finding and fix |
| --- | --- | --- | --- |
| gap | all KS2 topics (Y3-6) | KS2: "explore the patterns and sounds of language through songs and rhymes"; "appreciate stories, songs, poems and rhymes"; "broaden their vocabulary ... including through using a dictionary" | No song, rhyme, story or dictionary-skills item exists in any KS2 note, quiz or flashcard (the few keyword hits are incidental). Add one short rhyme/song/story extract card and one dictionary-skills question per language in Y5/Y6. Listening/speaking items are out of format by design (brief). |
| gap | all KS3 topics (Y7-9) | KS3: "read literary texts in the language [such as stories, songs, poems and letters]" | No literary-text reading in any KS3 quiz. Add a short original poem/letter/story extract question in Y8 and Y9 (original or public domain only, per brief). |
| gap | A-level `*film` Y12/13, `*soc`, `*art` | A-level para 14: "develop research skills ... initiate and conduct individual research"; para 8: "mediate between cultures"; "translating an unseen passage" both directions | No topic covers the individual research project, summarising/mediation, or extended unseen translation (only sentence translation). Add a short "research and mediation skills" note plus 2-3 questions in Y13 of each `*soc` topic. |
| gap | A-level `*film` Y12/13 | Paras 9-13: AS one work, A level two works, from the specification's prescribed list | Only invented films/novels are used. Fine for copyright, but there is no coverage of any real set text; state this in the topic description so operators do not assume board-work coverage. |

## 4. French

### french-ks2-3 (KS2 Y3-6, KS3 Y7-9)

| Type | Topic key / year | Official reference | Finding and fix |
| --- | --- | --- | --- |
| gap | `frverb` Y7-9, `frnoun` Y7-9 | GCSE Foundation: "Imperative (2nd person singular and plural only, including aller and faire ...)"; KS3: "voices and moods" | The imperative is never taught as grammar (only classroom instructions in `frschool` Y4 and directions in `frtown` Y6). Add an imperative section to `frverb` Y8 (tu / vous forms, aller, faire, negative). |
| gap | `frverb` Y7 | GCSE Foundation: "nine high frequency verbs (boire, connaître, courir, croire, écrire, recevoir, rire, suivre, voir)"; anchor verbs partir, venir, ouvrir, prendre, entendre, traduire | Y7 covers être/avoir/aller/faire only; devoir and savoir have no table anywhere (pouvoir and vouloir appear in `frgram4` Y10). Add prendre/venir/partir/voir and devoir/savoir to `frverb` Y8 or `frgram4` Y10. |
| gap | `frtown`, `frtr`, KS2 all | see cross-cutting rows | songs/rhymes/dictionary (KS2), literary text (KS3). |
| language accuracy | `frid` Y7, question `frid-y7-03` and the note "les cheveux ... bruns" | Larousse: châtain = "brun clair" | Correct textbook usage, but many French speakers say *châtains* for mid brown hair. Add "châtains" to the note and accept it; keep `bruns`. Low priority (QA_LOG already flagged it). |

### french-ks4-5 (GCSE Y10-11, A-level Y12-13)

| Type | Topic key / year | Official reference | Finding and fix |
| --- | --- | --- | --- |
| gap | `frgram4` Y10-11 | Higher: "Periphrastic time expressions être en train de ... and venir de" | Neither appears in any French note or quiz. Add both to `frgram4` Y10 with a "just / in the middle of" question each. |
| gap | `frgram4` Y10-11 | Higher: "Perfect tense of modals (devoir, pouvoir, savoir, vouloir)" | No coverage (j'ai dû / j'ai pu / j'ai voulu). Add to `frgram4` Y11 replacing part of the AS content flagged below. |
| gap | `frgram4` Y10 | Higher: negation "ne...plus, ne...ni...(ni...), ne...pas encore, ne...que"; "personne ne / rien ne + verb"; "aucun(e)"; impersonals "il vaut mieux / il manque / il vaut la peine de" | Only ne...pas/jamais/rien/plus/personne are taught. No hits for ne...que, pas encore, aucun, personne ne / rien ne subjects, il vaut mieux. Add a short block to `frgram4` Y10 or `frwork` Y11. |
| gap | `frgram4` Y10-11 | Foundation/Higher inflectional list: irregular presents (see above), future stems "aurai, ferai, irai, serai", conditional "aurais, ferais, irais, serais" | Partly covered. Missing: the nine irregular presents and devoir/savoir tables (see KS2-3 row). |
| gap | `frgram5` Y12-13 vs A-level annex (French) | AS list includes: "inversion after speech", "possessive (le mien)", "demonstrative (celui, celle ...; celui-ci/celui-là)", "adverbs in -ment, comparative and superlative", "ordinal numerals", "imperative", "ne...que", "Personne n'est venu", "indefinite (quelqu'un, quelque chose)", "quantifiers (assez, plusieurs, tant, trop ...)", "present participle (en arrivant)", "faire réparer"; A level adds "Passive voice: all tenses", "Subjunctive perfect / imperfect (R)", "Inversion after adverbs" | Keyword scan of all four A-level French topics found no coverage of inversion, possessive pronouns, celui/celle, -ment adverbs, ordinals, imperative, ne...que, quantifiers, imperfect subjunctive (R). Present participle appears only at GCSE (`fride` Y11). Add a `frgram5` Y12 note section "pronouns and adverbs" and Y13 "inversion, passive in all tenses, faire + infinitive". |
| misplaced | `frgram4` Y11 (objective 1, note, `y11-01`, `-03`, `-07`, `-12`; flashcards) | GCSE annex A lists no subjunctive at either tier. AS list: "Subjunctive mood: present (common uses ... after il faut que, bien que)" | Present subjunctive is AS content. Move to Y12 (`frgram5`) or label the Y11 section "extension, not required for the DfE GCSE". Keep as enrichment only if GCSE items are added first. |
| misplaced | `frgram4` Y11 (pluperfect: objective, `y11-06`, `y11-08`) | No pluperfect in GCSE lists. AS list: "Pluperfect" | AS content. Move to Y12 or label as extension. |
| misplaced | `frgram4` Y11 (`y11-05`, `y11-10`, `y11-08`; note "Ce pont a été construit en 1890") | Higher: "Passive voice in the present (full form only i.e., with par)". AS: present; other tenses (R). A level: "all tenses" | The note and quiz use passive perfect / pluperfect passive (a été construite, avait été détruit). GCSE allows the present only. Rewrite examples in the present (Ce pont est construit par ...) or move to A-level. |
| misplaced | `frgram4` Y11 (`y11-11`, `y11-09`, objective 5) | Higher: "Relative clauses (with où and que)"; Foundation: "relative pronoun qui". AS: "Relative (including qui, que, dont, lequel ...)" | `dont` is AS. Keep qui/que/où at GCSE; move dont to `frgram5` Y12. |
| misplaced | `frgram4` Y11 (si-clauses: `y11-04`, `y11-07`, `y11-12`) | Higher conditional: regular -er forms plus aurais/ferais/irais/serais only; voudrais at Foundation | Si + imperfect + conditional is not a listed structure, and the conditional is listed only for regular -er verbs plus aurais/ferais/irais/serais (Higher). `y11-04` (ferais) is inside the list; `y11-07` and the note are enrichment. Flag as beyond the list. |
| misplaced | `frgram5` Y12 (`y12-08`, objective 1, note "The past subjunctive") and `y13-11` | A-level additions: "Subjunctive mood: perfect tense; imperfect tense (R)". AS: present only | Perfect subjunctive is A-level (Y13) only in the DfE lists, but is taught in Y12. Move to Y13 or accept the early placement knowingly. |
| misplaced | `frgram5` Y13 (future perfect `y13-09`, past conditional `y13-03`, passé simple recognition `y13-01/-02/-04/-08/-10`) | AS list already includes "Future perfect", "Conditional perfect", "Past historic (R)" | AS items deferred to Y13. If Y12 = AS, add a short future perfect / conditional perfect / passé simple recognition block in Y12 or note the sequencing choice. |
| misplaced | `frloc` Y11, `frwork` Y10 (on devrait / on pourrait / il faudrait / tu devrais) | Foundation conditional: "vouloir (voudrais, voudrait)" only; Higher: regular -er + four irregulars | Conditionals of devoir/pouvoir/falloir are not listed. Extremely common and useful; keep, but they count as beyond the list. |
| out of scope | `frgram4` Y10 note ("Other irregular future stems: pouvoir → pourr-, voir → verr-, venir → viendr-") | Annex: irregular future stems listed only for avoir, être, faire, aller | Beyond the list (harmless enrichment). Mark as extra. |
| vocabulary | `fride`, `frloc`, `frwork` Y10-11 vocabulary tables (e.g. le harcèlement en ligne, le règlement intérieur, un(e) sans-abri, gaspiller, le bénévolat, une association caritative, un influenceur) | GCSE para 19: at least 85% from the 2,000 most frequent words; boards publish the lists | UNVERIFIED (board lists not fetched). These are plausible enrichment beyond the 1,700 but cannot be confirmed either way. Check against the AQA/Pearson list you target before promising "GCSE vocabulary". |
| language accuracy | all French KS4-5 notes and quizzes | n/a | No errors found on a full read (accents, gender, agreement, subjunctive forms, passé simple forms, pronoun order all checked). |

## 5. Spanish

### spanish-ks2-3

| Type | Topic key / year | Official reference | Finding and fix |
| --- | --- | --- | --- |
| gap | `esverb` Y7-9 | GCSE Foundation: "Present continuous (e.g., estar + present participle)"; "Imperfect continuous" | estar + gerund is not taught at KS3 or GCSE (it first appears in the A-level `esgram5` Y12 note). Add a present continuous section to `esverb` Y8 and an imperfect continuous line in Y9. |
| gap | `esverb` Y7-9, `esschool` Y4 | Foundation: "Imperative (affirmative, 2nd singular only); irregular tú commands (sé, ve, ten, ven, haz, di, pon and sal)"; KS3 "voices and moods" | The imperative is never taught as grammar (only classroom commands in `esschool` Y4 and the single translation `esgram5-y12-12`). Add an imperative block to `esverb` Y9 (regular + the eight irregular tú commands). |
| gap | all KS2/KS3 | see cross-cutting rows | songs/rhymes/dictionary (KS2), literary text (KS3). |
| language accuracy | `esverb` Y8, `esverb-y8-06` ("Ayer ___ (comer, yo) una paella", key *comí*, `strict: true`) | GCSE annex: no general accent-tolerance rule; it only excuses "small changes to preterite stems or inflections (e.g., vi, vio (no accent) ...)" for foundation | The strictness is defensible because the note stresses the accent, but *comi* is not another valid form (unlike hablo/habló), so marking it wrong penalises keyboards without accented input. Recommend: accept *comi* in Y8 (drop `strict`), keep strict only where the accent separates two real forms (hablé/habló, `esgram4-y10-12` llegó). |

### spanish-ks4-5

| Type | Topic key / year | Official reference | Finding and fix |
| --- | --- | --- | --- |
| gap | `esgram4` Y10-11 | Higher: "Acabar de + infinitive (as equivalent of 'HAVE just done + verb')"; "aquel ... aquello"; "(no) tampoco, (no)...ni..., ya no"; "el que, el cual, lo que"; "possessive pronouns el mío ..."; "Impersonal: parece, basta, falta, hace falta, vale la pena" | Keyword scan: acabar de and aquel/aquello have no coverage at all; el que / el cual absent from GCSE (lo que present). Add a short "Higher extras" block to `esgram4` Y11 replacing part of the AS content. |
| gap | `esgram5` Y12-13 vs A-level annex (Spanish) | AS list: "El with feminine nouns beginning with stressed a (el agua)", "Lo + adjective", "Affective suffixes (R)", "Plural of male/female pairs (los Reyes)", "Agreement (cuatrocientas chicas)", "Ordinal 1-10", "acabar de / estar para / llevar + gerund / ir + gerund (R)", "'Personal' a", "Verbs of perception (Vi asfaltar la calle)", "'Nuance' reflexive verbs (caerse, pararse)", "'redundant' indirect object (Dale un beso a tu papá)", "possession by indirect object (Le rompió el brazo)", "Cleft sentences (Fue en Madrid donde ...)", "Focalisation (R)", "Tiene más dinero de lo que creía", "que to introduce a clause (¡Cuidado, que ...!)", "usted / vos (R)", "hay que in all tenses", "por muy / por mucho que (R)" | Keyword scan of the four A-level Spanish topics found no coverage of these (only `lo que`, llevar + gerund, cuyo and the subjunctive ones are covered). Add a `esgram5` Y12 "structures list" note with one example each, and 6-8 questions across Y12-13. |
| misplaced | `esgram4` Y11 (subjunctive: objective 1, note, `y11-02/-03/-04/-05/-11/-13`) | Higher: present subjunctive "for singular persons only, with five high frequency verbs: hacer, ser, ir, venir, tener" with cuando (future), after wishing/command/request/emotion + que, para que | Our note teaches all persons plus saber, dar, estar, haber, hablar, comer, salir and "es importante / necesario / posible que" (`y11-04`, `y11-11` sepan). Beyond the GCSE list. Either restrict the note and quiz to the five verbs / singular / the listed triggers, or label the rest "extension". |
| misplaced | `esgram4` Y11 pluperfect (`y11-01`, `y11-06`) | No pluperfect in GCSE lists; AS list has "Pluperfect" | AS content; move to `esgram5` Y12 or label as extension. |
| misplaced | `esgram4` Y11 relative pronouns quien / cuyo (`y11-10`) | Foundation: que only; Higher: lo que, el que, el cual, cuando/donde. "cuyo" appears in the A-level list ("Relative (cuyo) (R)" at AS, full at A level) | cuyo (and quien) belong to A-level. Move `y11-10` to Y12 (`esart` Y12 already teaches cuyo). |
| misplaced | `esgram5` Y12 objective 5 and `y12-09` (subjunctive after emotion / doubt / negation) | AS list: "With verbs ... of wishing, commanding, influencing, emotional reaction, doubt, denial, possibility, probability (R)"; A level: productive | Receptive at AS, productive at A level. Fine if Y12 is treated as recognition; note it, or move production tasks to Y13. |
| misplaced | `esgram5` Y13 (imperfect subjunctive, si-clauses, sequence of tenses) | AS list already has "Use of the subjunctive: Commands, Conditional sentences, After conjunctions of time, After para que, sin que; Sequence of tense in indirect speech" | Conditional sentences and tense sequence are AS content; Y12 students will not have met them. Add a Y12 introduction. |
| out of scope | `eside` Y10 objective 3 and `eside-y10-08` (soler + infinitive) | Foundation modals listed: "deber, poder, querer, tener que, saber + infinitive", plus quisiera and me gustaría | soler is not in the modal list. Useful, but beyond the list. |
| vocabulary | `eside`, `esloc`, `eswork` Y10-11 tables (e.g. el disfraz, la brecha generacional, los apuntes, un año sabático, el casco antiguo, el polideportivo, el albergue) | see French row | UNVERIFIED against board lists; plausible enrichment. |
| language accuracy | `esgram5-y13-10` ("Si hubieras estudiado más, ___ el examen", key *habrías aprobado*, distractor *aprobarías*) | A-level list: conditional sentences | *aprobarías* is a defensible mixed conditional (unreal past condition, present result). Rephrase the stem ("...habrías aprobado el examen del año pasado") or replace the distractor. Related QA_LOG flag: `esgram5` Y13 written model uses a mixed conditional; correct but not taught. |
| language accuracy | `esloc` Y10 note "Hay is invariable: había, hubo in the past" | GCSE Foundation: "hay", "había" listed | Wording is self-contradictory (invariable in number, but changes with tense). Rewrite: "hay never takes a plural: hay muchos parques". |

Otherwise clean: preterite, gerund, subjunctive, ser/estar, por/para, passive/se forms, cuyo agreement, absolute participle, orthographic changes all checked.

## 6. German

### german-ks2-3

| Type | Topic key / year | Official reference | Finding and fix |
| --- | --- | --- | --- |
| gap | all KS2/KS3 | see cross-cutting rows | songs/rhymes/dictionary (KS2), literary text (KS3). |
| misplaced | `defam` Y4 (KS2) | KS2: "speak in sentences, using familiar vocabulary, phrases and basic language structures"; "focused on familiar and routine matters" | Y4 already teaches accusative masculine (ich habe **einen** Vogel, keinen) with case contrast, and `denoun` Y8 then teaches it again as new. Low severity: consider presenting einen as a chunk in Y4, as `detr` Y8 does for "mit dem". |
| language accuracy | `defam` Y4 vocabulary table "der Hase / die Maus | rabbit / mouse" and flashcard "rabbit :: der Hase" | Duden "Hase": a wild mammal (hare); Kaninchen is listed only as a regional fourth sense | Wrong for standard German. Change to "das Kaninchen (rabbit)" or "der Hase = hare". Fix note and flashcard. |
| language accuracy | `defam` Y4 note: "Mein Onkel hat einen Vogel. Er heißt Piepmatz." and "Ich habe keinen Vogel" | Duden: *einen Vogel haben* = colloquial, "nicht recht bei Verstand sein" | The idiom means "is mad"; in a children's note it reads as an insult. Replace with a different pet ("Mein Onkel hat einen Hund. Er heißt Piepmatz.") and use a different der-word for the "keinen" example (e.g. keinen Hamster). |

### german-ks4-5

| Type | Topic key / year | Official reference | Finding and fix |
| --- | --- | --- | --- |
| gap | `degram4` Y10-11 | Higher: "Add -(e)n to pluralise some masculine people nouns and weak masculine nouns"; "bei / am + nominalised verb infinitive ('while doing')"; "Passive avoidance structure man + active verb"; "Word order 3 with separable verbs" | No weak-noun (N-Deklination), beim + nominalised infinitive or man + active coverage at GCSE (man + active appears only in `degram5` Y12). Add to `degram4` Y10-11. |
| gap | `degram5` Y12-13 vs A-level annex (German) | AS: "Weak masculine nouns", "Case marking on nouns", "Modal Particles / Discourse Markers e.g. ja, doch, wohl", "Adjectives with the dative (es ist mir klar)", "Adjectives with prepositions (stolz auf)", "Direction (e.g. hin, heraus)", "Perfect (modal verbs)", "Position of pronouns / adverbials / nicht", "Word order variation to change emphasis", "Word formation: compound nouns, verbs from nouns / adjectives, separable and inseparable prefixes", "Comparative and superlative"; A level: "Future perfect", "Conditional perfect", "Conditional sentence with omitted wenn (R)", "Passive with sein", "Use of the prepositional adverb (da(r)+prep) to anticipate dass clauses (R)" | Keyword scan of all A-level German topics: no coverage of weak masculine nouns, modal particles, adjectives + dative / prepositions, hin/her, future perfect, conditional perfect, imperative, comparative/superlative, pronoun / nicht / adverbial position, compounding. Covered well: Konjunktiv II past, Konjunktiv I, nominalisation, extended attributes, genitive prepositions, sich lassen, sein + zu. |
| misplaced | `degram4` Y11 (passive: `y11-01`, `-04`, `-08`, `-12`; pluperfect `y11-03`, `-08`; objectives 1-2) | GCSE German annex: no passive and no pluperfect at either tier. AS list: "Pluperfect", "Passive with werden" | AS content taught at GCSE Y11. Move to `degram5` Y12 or label as extension. |
| misplaced | `degram4` Y11 (genitive: `y11-02`, `y11-10`, note table, "Dat. / Gen." row) | Higher: "Use of the genitive for possession and following certain prepositions (e.g., trotz) ... in Listening and Reading only" | The DfE says receptive only. Quiz items that require production (`des`, `wegen des Regens`) go beyond it; rephrase as recognition ("What does ... mean?") or accept as extension. |
| misplaced | `degram4` Y10 (relative clauses, objective 5, table with den/dem/denen, `y10-08`, `y10-09`) | Foundation: "relative pronouns (der, die, das, die) in subject relative clauses"; Higher: "Subject and object relative clauses using wh- pronouns (wo and was)" | Accusative/dative relative pronouns (den, dem, der, denen) are not on the GCSE lists. Restrict the note to subject relatives, or label the rest as extension. |
| misplaced | `degram4` Y11 reported speech / Konjunktiv I recognition (objective 3, `y11-09`) | AS: "Subjunctive in indirect speech (R)"; A level: "All forms of indirect speech" | Konjunktiv I is AS-receptive/A-level. `y11-09` itself (dass + indicative) is fine at GCSE; the "sei/habe" recognition line is beyond. |
| misplaced | `degram5` Y12 (statal passive, sein + zu + infinitive, `y12-10`; flashcard) | A level: "Passive with sein"; AS: "Passive with werden". sein + zu is not listed | Statal passive is A-level (Y13) in the DfE list; fine as early enrichment, just note it. |
| vocabulary | `deide`, `deloc`, `dework` Y10-11 tables (e.g. eingebildet, hilfsbereit, der Zwilling, süchtig, die Sehenswürdigkeit, die Gesamtschule, ehrenamtlich) | see French row | UNVERIFIED against board lists. Note `das Einzelkind`, `ehrenamtlich` likely beyond the 1,700; plausible enrichment. |
| language accuracy | `desoc` Y13 note "How elections work" and `desoc-y13-04` ("Zweitstimme ... for a party (its list)") | Wikipedia (secondary): after the 2023 reform the Bundestag is fixed at 630 seats; a constituency winner is "no longer automatically guaranteed" a seat; seats are set by the Zweitstimme; the 5% threshold stays and the three-constituency (Grundmandat) exception was kept after the Constitutional Court's ruling (verify) | The note still says nothing wrong about the two votes' purpose, but omits the key change and reads as pre-2023. QA_LOG already said "still correct". Add one sentence: "Since the 2023 reform there are exactly 630 seats and a candidate who wins a constituency only gets the seat if their party's Zweitstimme result covers it". Also note the 2025 election (23 Feb) was an early election, "every four years" is the normal term. Verify against bundestag.de before editing. |
| language accuracy | `deloc-y10-04` ("Am Samstag fahren wir ___ Stadtmitte", key *in die*) | Foundation: dual-case prepositions "an, auf, in" | Key is correct (wohin?). *in der Stadtmitte* would be grammatical for "drive around within the centre". Add a cue to the stem, e.g. prefix "Wir wollen einkaufen." or add "(Where to?)". Low priority. |
| language accuracy | `dework-y11-05` (rejects "Ich möchte eine Ingenieurin werden") | Foundation: "möcht- in all persons + infinitive" | The article-less form is the standard one for a plain job title; *eine Ingenieurin werden* is heard and not strictly wrong (QA_LOG says the same). Rejection is defensible; consider accepting it as tolerance. Low. |

Otherwise clean: cases, adjective endings, Konjunktiv I/II forms, separable verbs, verb-final clauses, weak/strong past participles all checked.

## 7. Notes on the four items flagged in QA_LOG

| QA_LOG item | Verdict |
| --- | --- |
| Spanish `esverb-y8-06` "comí" strict | Recommend relaxing (see Spanish table). Not an error, a usability issue. |
| German electoral note post-2023 | Stale in emphasis; add the reform sentence (see German table). |
| French `frid-y7-03` "châtains" | Harmless; add "châtains" as accepted alternative. |
| German `deloc-y10-04` die / in der | Key is right; stem has a faint second reading; add a "wohin?" cue. |
