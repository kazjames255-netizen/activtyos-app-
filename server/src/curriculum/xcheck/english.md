# English cross-check against official DfE documents

Date: 2026-09-19. Scope: `server/src/curriculum/english-ks1 .. english-ks5` (read-only review; no content files were edited).
Method: every official document below was downloaded and its text extracted (curl + pypdf / gov.uk HTML). Official quotes below come from those extracts. Counts of "how many statutory words appear in our content" were computed by script over the exported TOPIC objects (objectives, notes, quiz prompts/answers, flashcards).

## 1. Sources fetched (all fetched successfully, none from memory)

| Source | URL actually used |
| --- | --- |
| National Curriculum in England: English programmes of study (KS1-KS4; spoken language, reading, writing, grammar). Fetched as gov.uk HTML (via WebFetch for the page map, curl for the full text) | https://www.gov.uk/government/publications/national-curriculum-in-england-english-programmes-of-study/national-curriculum-in-england-english-programmes-of-study (gov.uk content API: https://www.gov.uk/api/content/government/publications/national-curriculum-in-england-english-programmes-of-study) |
| English Appendix 1: Spelling (PDF, 26 pp) | https://assets.publishing.service.gov.uk/media/5a7ccc06ed915d63cc65ce61/English_Appendix_1_-_Spelling.pdf |
| English Appendix 2: Vocabulary, grammar and punctuation (PDF, 6 pp) | https://assets.publishing.service.gov.uk/media/5a7d913aed915d3fb959486f/English_Appendix_2_-_Vocabulary_grammar_and_punctuation.pdf |
| English Glossary (non-statutory PDF, used only for terminology checks) | https://assets.publishing.service.gov.uk/media/5a7c8e4ded915d48c24108e2/English_Glossary.pdf |
| Secondary national curriculum - English (KS3+KS4 PDF, cross-check of the HTML) | https://assets.publishing.service.gov.uk/media/5a7b8761ed915d4147620f6b/SECONDARY_national_curriculum_-_English2.pdf |
| GCSE English language and English literature (landing page) | https://www.gov.uk/government/publications/gcse-english-language-and-gcse-english-literature-new-content |
| GCSE English language subject content and assessment objectives (PDF, DFE-00232-2013) | https://assets.publishing.service.gov.uk/media/5a7bfd7640f0b63f7572aa8b/GCSE_English_language.pdf |
| GCSE English literature subject content and assessment objectives (PDF, DFE-00231-2013) | https://assets.publishing.service.gov.uk/media/5a7ca069e5274a29d8363d20/GCSE_English_literature.pdf |
| GCE AS and A level English language subject content (PDF, DFE-00362-2014) | https://assets.publishing.service.gov.uk/media/5a7ea47040f0b6230268a9be/A_level_English_language_subject_content.pdf (page: https://www.gov.uk/government/publications/gce-as-and-a-levels-for-english-language) |
| GCE AS and A level English literature subject content (PDF, DFE-00363-2014) | https://assets.publishing.service.gov.uk/media/5a7eb05740f0b6230268ae6b/A_level_English_literature_content.pdf (page: https://www.gov.uk/government/publications/gce-as-and-a-level-for-english-literature) |
| GCE AS and A level English language and literature subject content (PDF, DFE-00361-2014) | https://assets.publishing.service.gov.uk/media/5a75afd7e5274a545822d70b/A_level_English_language_and_literature_content.pdf (page: https://www.gov.uk/government/publications/gce-as-and-a-level-for-english-language-and-literature) |

**Could not fetch:** nothing. Caveats: (a) KS3/KS4 English PoS is high level (no per-year lists), so KS3 "wrong year" checks can only be made against KS1-2 Appendix 2 (which KS3 is told to "extend and apply") and against KS3's own headings; (b) the GCSE/A-level documents are subject criteria, not specifications. They contain no word lists/terminology lists, so "gaps" there are gaps against broad content headings; exam-board set-text choices are NOT DfE requirements. (c) Text extracted from PDFs is lightly garbled in places (IPA symbols); I quote only readable phrases.

Category key: **G** = official requirement with no (or thin) coverage, **M** = content in the wrong year/phase, **O** = out of scope / beyond the official document (harmless unless noted), **W** = wording / terminology mismatch.
Severity: H = should be fixed before launch, M = fix in next content pass, L = nice to have.

---

## 2. english-ks1 (Y1-Y2; 120 questions)

Topics present: phon, rc, spell, gp, vocab, wc.

### Gaps
| ID | Topic | Year | Official reference | What is missing | Recommended fix | Sev |
| --- | --- | --- | --- | --- | --- | --- |
| K1-G1 | spell | Y1 | App.1 Y1 statutory list: "The /ŋ/ sound spelt n before k"; "-tch"; "The /v/ sound at the end of words" (have, live, give); "Division of words into syllables"; "Adding -er/-est to adjectives"; "New consonant spellings ph and wh"; "Using k for the /k/ sound"; "Compound words"; "Adding the prefix un-" | Our Y1 spell covers days, -s/-es, -ing/-ed, ff/ll/ss/zz/ck and 5 named tricky words. None of nk, tch, v+e, syllable division, -er/-est on adjectives, ph/wh, k-for-/k/, compound words (football) appear in spell Y1 (un- is only in vocab). | Add 1-2 rules per quiz round to spell Y1 (or a new "Y1 spelling patterns" sub-set): nk/tch/ve, ph/wh, k before e/i/y, compound words, adjective -er/-est. | H |
| K1-G2 | spell | Y1 | App.1 Y1 "Common exception words": the, a, do, to, today, of, said, says, are, were, was, is, his, has, I, you, your, they, be, he, me, she, we, no, go, so, by, my, here, there, where, love, come, some, one, once, ask, friend, school, put, push, pull, full, house, our | Only school/friend/said/was/the are taught deliberately. Several statutory words are absent everywhere in KS1 (today, love, come, pull, our). The other ~22 that occur do so only incidentally in passages. | Add a flashcard/quiz set "Y1 common exception words" (45 words, e.g. 3 x 15). | H |
| K1-G3 | spell | Y2 | App.1 Y2 new work: "/dʒ/ spelt ge and dge"; "/s/ spelt c before e, i and y"; "/n/ spelt kn and gn"; "/r/ spelt wr"; "-le, -el, -al, -il at end of words"; "/aɪ/ spelt -y"; "Adding -es to nouns and verbs ending in -y"; "/ɔː/ spelt a before l and ll"; "/ʌ/ spelt o"; "/iː/ spelt -ey"; "/ɒ/ after w and qu"; "or after w"; "ar after w"; "/ʒ/ spelt s"; "-ment, -ness, -ful, -less, -ly"; "words ending -tion" | None of these ~16 statutory Y2 spelling patterns is taught in spell Y2 (which has homophones, y->i/doubling/e-drop and apostrophes only). c=/s/ and g=/j/ appear only in phon Y2 flashcards (as reading, not spelling). | Add a second Y2 spelling quiz/note section covering the patterns above (badge, huge, knock, write, table/camel/metal/pencil, cry/flies, all/walk, monkey, want, world, war, television, enjoyment, station). | H |
| K1-G4 | spell | Y2 | App.1 Y2 exception words (64 listed: door, floor, poor, because, find, kind, mind, behind, child, children, wild, climb, most, only, both, old, cold, gold, hold, told, every, everybody, even, great, break, steak, pretty, beautiful, after, fast, last, past, father, class, grass, pass, plant, path, bath, hour, move, prove, improve, sure, sugar, eye, could, should, would, who, whole, any, many, clothes, busy, people, water, again, half, money, Mr, Mrs, parents, Christmas) | 37 of the 64 do not appear anywhere in KS1 content (e.g. child/children, climb, mind, behind, great, steak, whole, busy, half, money, Mr, Mrs, parents, Christmas). | Add "Y2 common exception words" flashcard/quiz sets (e.g. 4 x 16). | H |
| K1-G5 | spell | Y2 | App.1 Y2 "Homophones and near-homophones" (quite/quiet, here/hear, one/won, sun/son, bare/bear, blue/blew, night/knight) | Only there/their/they're, to/too/two, see/sea. | Add 4-6 more pairs (hear/here, quite/quiet, one/won, sun/son, blue/blew, night/knight). | M |
| K1-G6 | gp | Y2 | App.2 Y2 Sentence: "Subordination (using when, if, that, because) and co-ordination (using or, and, but)" | Listed in objectives but the note has no section and none of the 10 quiz questions tests it; wc Y2 mentions and/but/because/when informally. | Add a note section "Joining sentences: and/but/or (co-ordination) and because/when/if/that (subordination)" plus 2 quiz questions. | H |
| K1-G7 | gp | Y2 | App.2 Y2 Text: "Use of the progressive form of verbs in the present and past tense to mark actions in progress [she is drumming, he was shouting]" | Absent (0 hits for "progressive"/"was shouting"). Tense coverage is only past vs present. First appears in KS3 Y8. | Add progressive form to gp Y2 note and 1-2 questions. | M |
| K1-G8 | gp / vocab | Y2 | App.2 Y2 Word: "Formation of nouns using suffixes such as -ness, -er and by compounding [whiteboard, superman]"; "Use of the suffixes -er, -est in adjectives and the use of -ly ... to turn adjectives into adverbs" | Compounding is absent everywhere (0 hits "compound"). -ness/-ly are in vocab Y2 but -er/-est adjectives and noun-forming -er are not. | Add compounding + -er/-est + -ly (adjective to adverb) to gp Y2 or vocab Y2. | M |
| K1-G9 | gp | Y2 | App.2 Y2 "Terminology for pupils": noun, noun phrase, statement, question, exclamation, command, compound, suffix, adjective, adverb, verb, tense (past, present), apostrophe, comma | Objective lists most terms but omits "compound" and "suffix" (suffix is used in phon/vocab but not listed in gp). | Add both terms to the gp Y2 objective/flashcards. | L |
| K1-G10 | phon | Y1 | PoS Y1 word reading: "respond speedily with the correct sound to graphemes ... for all 40+ phonemes, including ... alternative sounds for graphemes"; "read words containing taught GPCs and -s, -es, -ing, -ed, -er and -est endings"; "read words with contractions [I'm, I'll, we'll]" | Objective claims "all 40+ phonemes" but the note/quiz cover 10 graphemes (ai, ee, igh, oa, oo, ar, or, ur, ow, oi). No consonant digraphs (sh, ch, th, ng), no alternative sounds (ea, ie, ou, air, ear, er, ir...), no contractions, no -s/-es/-er/-est endings, no multi-syllable words at Y1. | Either reduce the objective wording to what is taught, or add consonant digraphs, "alternative sounds" and contractions (I'm, I'll, we'll) sections. | H |
| K1-G11 | phon | Y2 | PoS Y2 word reading: "read words containing common suffixes"; App.1 Y2 lists -ment, -ness, -ful, -less, -ly | phon Y2 covers -ing/-ed/-er/-est/-ful/-less/-ly but not -ment/-ness; "read most common exception words" is a single question. | Add -ment/-ness; add an exception-word reading set. | L |
| K1-G12 | rc | Y1, Y2 | PoS Y1: "learning to appreciate rhymes and poems, and to recite some by heart"; Y2: retelling key stories, fairy stories and traditional tales; "poems learnt by heart" | No coverage of poetry/rhyme, traditional tales or retelling (only 5 incidental mentions). | Add a short rhyme/poem passage and a "retell a familiar story in order" question type to each year. | M |
| K1-G13 | wc | Y2 | PoS Y2 writing: "writing about real events"; "writing poetry"; "read aloud what they have written" | Only narrative writing is covered. | Add one non-narrative (recount/instructions) and a simple poem item. | L |
| K1-G14 | (all) | Y1-2 | PoS "Spoken language" (statutory, all years) | No spoken-language content in any KS1 topic. | Out of scope for a text/quiz hub unless a speaking module is planned; note explicitly. | L |

### Misplaced (year / phase)
| ID | Topic | Year | Official reference | Issue | Recommended fix | Sev |
| --- | --- | --- | --- | --- | --- | --- |
| K1-M1 | phon | Y2 | App.1 Y1 vowel digraph table lists "a-e, e-e, i-e, o-e, u-e" (made, these, five, home, June) under Year 1 | Split digraphs (a-e, e-e, i-e, o-e, u-e) are taught first in Y2 phon but the DfE lists them in Y1. Y1 phon has no split digraphs at all. | Move split digraphs to phon Y1 (keep as revision in Y2) or at minimum add a-e, i-e, o-e to Y1. | M |
| K1-M2 | gp / vocab | Y2 | App.2: "word family" and "prefix" are Y3 terminology; "synonym, antonym" are Y6 terminology | vocab Y2 objective/flashcards use "Synonym" and "word family". Harmless but ahead of the official terminology schedule. | Optional: say "words that mean nearly the same" at KS1 and keep "synonym" for Y3+ where it already appears. | L |

### Out of scope
None found. All KS1 content maps to statutory KS1 headings.

### Wording / accuracy
| ID | Topic | Year | Official reference | Issue | Recommended fix | Sev |
| --- | --- | --- | --- | --- | --- | --- |
| K1-W1 | spell | Y2 | App.1 Y1/Y2: doubling applies to "words of one syllable ending in a single consonant letter after a single vowel letter" (patting, sadder) | Note rule "Short vowel + one consonant: double it" is over-general; it is wrong for multi-syllable words (visit -> visiting; taught explicitly in Y3-4: "doubled only if the last syllable is stressed") and for x (mixing). | Reword to "in one-syllable words with a short vowel and one final consonant" and add "never double x". | M |
| K1-W2 | wc | Y1-2 | App.2 uses "conjunction" from Y3; Y1-2 say "joining words ... and" | wc uses "joining words" (age-appropriate); gp Y1 correctly says "join ... using and". | No change; ensure Y3 links "joining words" to "conjunction". | L |

---

## 3. english-ks2 (Y3-Y6; 200 questions)

Topics present: gp, rc, spell, vocab, wc (no phon at KS2, correct).

### Gaps
| ID | Topic | Year | Official reference | What is missing | Recommended fix | Sev |
| --- | --- | --- | --- | --- | --- | --- |
| K2-G1 | spell | Y3-Y4 | App.1: "The word-lists for years 3 and 4 and years 5 and 6 are statutory" (Y3/4 list = 100 words: accident(ally), actual(ly), address, answer, appear, arrive, believe, bicycle, breath, breathe, build, busy/business, calendar, caught, centre, century, certain, circle ... woman/women) | Only about 22 of the ~100 Y3/4 list words appear in spell content (appear, believe, complete, different, disappear, famous, height, island, library, medicine, natural, notice, often, opposite, possible, regular, sentence, separate, special, surprise, though/although, through). About 45 do not appear anywhere in KS2 English (e.g. address, breathe, calendar, caught, century, circle, continue, earth, eight/eighth, exercise, experience, experiment, extreme, February, fruit, guard, guide, history, imagine, increase, material, mention, minute, naughty, ordinary, peculiar, popular, potatoes, pressure, probably, promise, quarter, recent, reign, strange, suppose, therefore, thought, various). | Add the full Y3/4 list as ~8 flashcard/quiz sets of 12-13 words (split Y3/Y4) with a memory hook each. | H |
| K2-G2 | spell | Y5-Y6 | App.1 Y5/6 word list (100 words: accommodate, accompany, according, achieve, aggressive, amateur, ancient, apparent, appreciate, attached, available, average, awkward, bargain, bruise, category, cemetery, committee, communicate, community, competition, conscience, conscious, controversy, convenience, correspond, criticise, curiosity, definite, desperate, determined, develop, dictionary, disastrous, embarrass, environment, equip, especially, exaggerate, excellent, existence, explanation, familiar, foreign, forty, frequently, government, guarantee, harass, hindrance, identity, immediate(ly), individual, interfere, interrupt, language, leisure, lightning, marvellous, mischievous, muscle, necessary, neighbour, nuisance, occupy, occur, opportunity, parliament, persuade, physical, prejudice, privilege, profession, programme, pronunciation, queue, recognise, recommend, relevant, restaurant, rhyme, rhythm, sacrifice, secretary, shoulder, signature, sincere(ly), soldier, stomach, sufficient, suggest, symbol, system, temperature, thorough, twelfth, variety, vegetable, vehicle, yacht) | Only about 8 of 100 are taught (accommodate, committee, conscience/conscious, embarrass, necessary, queue, rhythm, yacht). About 70 do not appear anywhere in KS2 English. This is the statutory content most tested at end of KS2. | Add the full Y5/6 list as ~8 sets (Y5: first half, Y6: second half) with hooks (e.g. "necessary: one collar, two sleeves"). | H |
| K2-G3 | spell | Y3-Y4 | App.1 Y3/4 new work: "Adding suffixes beginning with vowel letters to words of more than one syllable" (forgetting vs gardening); "/ɪ/ spelt y elsewhere" (myth, gym); "/ʌ/ spelt ou" (young, touch); "Endings /ʒə/ or /tʃə/" (-sure, -ture: treasure, creature); "-ly exceptions: -le->-ly (gently), -ic->-ally (basically), truly/duly/wholly"; "-ous with i/e (serious, courageous)"; "/k/ spelt ch" (scheme); "/ʃ/ spelt ch" (chef); "-gue/-que" (league, antique); "/s/ spelt sc" (science); "/eɪ/ spelt ei/eigh/ey" (vein, eight, obey) | None of these ~12 patterns has a note section or quiz. | Add two Y3/Y4 spelling-pattern sets: (a) -sure/-ture, sc, ch (x2), gue/que, ei/eigh/ey; (b) y/ou vowel spellings, -ly exceptions, multi-syllable doubling. | H |
| K2-G4 | spell | Y3-Y4 | App.1 Y3/4 "Homophones and near-homophones": accept/except, affect/effect, ball/bawl, berry/bury, brake/break, fair/fare, grate/great, groan/grown, here/hear, heel/heal/he'll, knot/not, mail/male, main/mane, meat/meet, medal/meddle, missed/mist, peace/piece, plain/plane, rain/rein/reign, scene/seen, weather/whether, whose/who's | Only ~6 pairs (hear/here, whose/who's, effect/affect, accept/except, weather/whether, their/there). | Add flashcards for the remaining ~17 pairs. | M |
| K2-G5 | spell | Y5-Y6 | App.1 Y5/6: "Use of the hyphen" (co-ordinate, re-enter, co-operate, co-own); exceptions "initial, financial, commercial, provincial" to -cial/-tial; "anxious" exception to -cious; "Exceptions: protein, caffeine, seize (and either and neither)" to ei; homophone list (aisle/isle, aloud/allowed, altar/alter, ascent/assent, bridal/bridle, cereal/serial, complement/compliment, descent/dissent, desert/dessert, draft/draught, farther/further, guessed/guest, heard/herd, led/lead, morning/mourning, past/passed, precede/proceed, principal/principle, profit/prophet, stationary/stationery, steal/steel, wary/weary, who's/whose) | Hyphenated prefix spelling absent (gp Y6 only teaches hyphens for ambiguity); the -cial/-tial and -cious rules are given without the official exceptions; only principal/principle and advice/advise-style pairs appear from the confused-words list; "seize/either/neither" missing. | Add these to spell Y5/Y6 notes and flashcards. | M |
| K2-G6 | gp | Y3 | App.2 Y3 Terminology: "preposition, conjunction; word family, prefix; clause, subordinate clause; direct speech; consonant, consonant letter, vowel, vowel letter; inverted commas (or 'speech marks')" | "clause" and "subordinate clause" are not taught in Y3 gp (0 hits for "subordinate" in gp at any KS2 year; "clause" only from Y5 relative clause). "Adverbs (then, next, soon, therefore)" appear only as one generic flashcard. Noun-forming prefixes super-/anti-/auto- (App.2 Y3) are delayed to Y4 (spell/vocab). | Add "clause / main clause / subordinate clause" with 2 questions in gp Y3; add adverbs of time/cause (then, next, soon, therefore); move super/anti/auto forward or note as Y3-4. | M |
| K2-G7 | gp | Y4 | App.2 Y4 Terminology: "determiner; pronoun, possessive pronoun; adverbial" | "determiner" and "possessive pronoun" appear nowhere in KS2 English (0 hits). Pronouns are used for cohesion but not named/taught as a word class. | Add a "pronouns, possessive pronouns (mine, hers, theirs) and determiners (the, a, this, my, some)" section + 2 quiz questions to gp Y4. | H |
| K2-G8 | gp | Y5 | App.2 Y5 Word: "Verb prefixes [dis-, de-, mis-, over- and re-]"; Sentence: "Relative clauses beginning with who, which, where, when, whose, that, or an omitted relative pronoun"; Text: "or tense choices [for example, he had seen her before]"; Terminology: "cohesion, ambiguity" | Verb prefixes: only over- (vocab Y5). Omitted relative pronoun (The book I read) not taught. Past perfect / tense choice for cohesion absent from KS2 (first appears KS3 Y8). "Ambiguity" is used in Y5 objective text but not defined. | Add all three to gp Y5 (or vocab Y5) with 1-2 questions each. | M |
| K2-G9 | gp | Y6 | App.2 Y6: "Terminology: subject, object; active, passive; synonym, antonym; ellipsis, hyphen, colon, semi-colon, bullet points"; Punctuation: "semi-colons within lists"; "Punctuation of bullet points"; Text: "ellipsis"; "cohesive devices ... repetition of a word or phrase ... on the other hand, in contrast, as a consequence" | "ellipsis" appears nowhere in KS2 (0 hits; first at KS3 Y9). "subject" and "object" as grammatical terms not in gp (passive is taught without naming subject/object). Semi-colons in lists absent from KS2 (KS3 Y7/Y9 fc only). Bullet-point punctuation consistency covered only as "same grammatical form". Question tags appear only as a worked example. | Add ellipsis; subject/object (needed to explain active/passive); semi-colons in lists; bullet punctuation; question tags as an explicit item with a quiz question. | H |
| K2-G10 | rc | Y3-Y4 | PoS lower KS2 comprehension: "predicting what might happen from details stated and implied"; "identifying themes and conventions in a wide range of books"; "using dictionaries to check the meaning of words"; "preparing poems and play scripts to read aloud and to perform"; "recognising some different forms of poetry [for example, free verse, narrative poetry]" | Prediction first appears in Y5 (0 hits in Y3/Y4/Y6). "theme", "convention", "dictionary", "play script" = 0 hits across KS2 rc. Poetry forms only via rhyme scheme AABB. | Add prediction to Y3/Y4, "theme" (Y4-Y6), dictionary skills, play-script/poem-performance items. | M |
| K2-G11 | rc | Y5-Y6 | PoS upper KS2 reading: "wide range of books, including myths, legends and traditional stories, modern fiction, fiction from our literary heritage, and books from other cultures and traditions"; "identifying and discussing themes and conventions in and across a wide range of writing"; "making comparisons within and across books"; "preparing poems and plays to read aloud and to perform" | No myth/legend/fable/literary-heritage passages (0 hits "myth", "legend", "traditional"); no theme/convention work; comparison only as a Y6 flashcard. | Include a myth/legend and a heritage-fiction passage in Y5/Y6 quizzes; add "theme" and "compare two texts" questions. | M |
| K2-G12 | wc | Y3-Y6 | PoS composition: "writing about real events"; "perform their own compositions, using appropriate intonation, volume, and movement"; "in writing narratives, considering how authors have developed characters and settings in what pupils have read" | Real-event writing (recounts), performance of own writing and author-modelled character/setting work not covered. | Low-priority additions (one recount model text; one "author's technique" question). | L |
| K2-G13 | (all) | Y3-6 | PoS "Spoken language" (statutory, all years) | No spoken-language coverage. | Note explicitly as out of scope for the hub. | L |

### Misplaced (year / phase)
| ID | Topic | Year | Official reference | Issue | Recommended fix | Sev |
| --- | --- | --- | --- | --- | --- | --- |
| K2-M1 | vocab / spell | Y4 | App.2 Y3 Word: "Formation of nouns using a range of prefixes [super-, anti-, auto-]" | These prefixes are taught in Y4 (spell and vocab), one year after the DfE grammar schedule. App.1 puts them in the Y3/4 band so spelling is fine; the vocab/grammar link is late. | Mention in vocab Y3 or accept Y3/4 band. | L |
| K2-M2 | gp | Y5 (past perfect) | App.2 Y5 Text "tense choices [he had seen her before]" | Not taught at KS2; first shown at KS3 Y8 (three years late). | See K2-G8. | M |
| K2-M3 | gp | Y6 (ellipsis, list semi-colons) | App.2 Y6 | First taught at KS3 Y9 (ellipsis) / KS3 fc only (semi-colon lists), i.e. a KS2 requirement met only in KS3. | See K2-G9. | M |

### Out of scope / beyond the statutory text
| ID | Topic | Year | Note | Recommended fix | Sev |
| --- | --- | --- | --- | --- | --- |
| K2-O1 | spell | Y6 | Prefixes semi-, trans-, mid-, non-, pre- are not in Appendix 1 or 2 (App.2 Y5 lists verb prefixes dis-, de-, mis-, over-, re-). Y6 spell also repeats -ify/-ise (App.2 Y5 word formation). | Harmless enrichment; keep only if the statutory word list (K2-G2) is not crowded out. | L |
| K2-O2 | vocab | Y4-Y6 | Latin/Greek root lists (aqua, auto, port, spect, dict, bio, chron, therm, tele, graph), loan words (karaoke, spaghetti...), connotation, idioms, portmanteau-type items are not in the KS2 PoS/appendices (App.1 uses only bicycle/medicine/opposite as etymology examples). | Acceptable non-statutory enrichment; keep after statutory items. | L |
| K2-O3 | vocab | Y3 | "Antonym/synonym" terms are Y6 terminology (App.2 Y6). Introduced at Y3 here. | Fine as early introduction; ensure Y6 revisits them formally. | L |

### Wording / accuracy
| ID | Topic | Year | Official reference | Issue | Recommended fix | Sev |
| --- | --- | --- | --- | --- | --- | --- |
| K2-W1 | spell | Y4 | App.1 Y3/4: "-tion ... used if the root word ends in t or te"; "-ssion is used if the root word ends in ss or -mit"; "-sion is used if the root word ends in d or se"; "If the ending sounds like /ʒən/, it is spelt as -sion"; "-cian ... root word ends in c or cs" | Note rule "-sion after a vowel, or after l, n or r" and "-ssion when you can hear a double s" are not the DfE root-word rules; (division/confusion are /ʒən/ = always -sion; expansion/extension derive from expand/extend). | Rewrite the /shun/ table using the root-word rules (invent -> invention; permit/express -> permission/expression; expand -> expansion; magic -> magician; /ʒən/ = -sion). | M |
| K2-W2 | spell | Y5 | App.1 Y5/6: "-cial is common after a vowel letter and -tial after a consonant letter ... Exceptions: initial, financial, commercial, provincial"; "-cious: if the root word ends in -ce, the /ʃ/ is usually spelt c (vice-vicious). Exception: anxious" | Rules given without exceptions or the root-word clue. | Add exceptions and the vice/vicious clue. | L |
| K2-W3 | gp | Y3 | App.2 Y3: "Use of the forms a or an according to whether the next word begins with a consonant or a vowel" | Our note says "vowel sound" (a more accurate rule, e.g. an hour); DfE wording is by letter. No fix needed; flagging only as a deliberate difference. | Keep; optionally add "an hour / a unicorn" example. | L |
| K2-W4 | gp | Y3 | Standard English | Worked example: "He have walked is not Standard English" is ungrammatical scaffolding (shows an error in a teaching sentence). | Replace by "He walked / He has walked (not: He have walked)". | L |
| K2-W5 | gp | Y3 | App.2 Y3 lists when, before, after, while, so, because | Y3 objectives, note and quiz include "although" (Y4+/Y5 subordinator in most schemes). | Keep, or move "although" to Y4. | L |
| K2-W6 | gp | Y4, Y6 | App.2 Y4: "preposition phrases"; Y6: "independent clauses" | We say "prepositional phrases" and "main clauses". Same meaning; glossary also uses "main clause". | No change needed; optionally add "(independent clause)" to the Y6 semi-colon flashcard. | L |

---

## 4. english-ks3 (Y7-Y9; 210 questions)

Topics present: gp, poet, prose, rc, shak, vocab, wc. **spell is unwritten** (known).

### Gaps
| ID | Topic | Year | Official reference | What is missing | Recommended fix | Sev |
| --- | --- | --- | --- | --- | --- | --- |
| K3-G1 | spell | Y7-Y9 | KS3 Writing: "paying attention to accurate grammar, punctuation and spelling; applying the spelling patterns and rules set out in English appendix 1 to the key stage 1 and 2 programmes of study" | Whole topic missing (known). Because KS2 covers only ~22% of the Y3/4 and ~8% of the Y5/6 word lists (see K2-G1/G2), KS3 spelling is also where those lists would otherwise be recovered. | Write spell Y7-Y9: Y7 = Y3/4 list + rules revisit; Y8 = Y5/6 list; Y9 = commonly confused words, Greek/Latin roots, apostrophes/homophones. Keep the topic name "Spelling" (merges with KS1/KS2). | H |
| K3-G2 | prose, poet, shak | Y7-Y9 | KS3 Reading: "high-quality works from English literature, both pre-1914 and contemporary, including prose, poetry and drama; Shakespeare (2 plays) and seminal world literature" | Prose is 19th/early-20th century only; poetry is heritage (Blake, Wordsworth, Tennyson, Owen, Kipling, Shelley, Dickinson); drama is Shakespeare only. No contemporary prose/poetry/drama and no non-Shakespeare play or world literature. | Add contemporary items in each topic (short original extracts or well-known modern works) and one non-Shakespeare play/world-literature extract per year. | H |
| K3-G3 | (all) | Y7-Y9 | KS3 "Spoken English": "using Standard English confidently ... giving short speeches and presentations ... participating in formal debates ... improvising, rehearsing and performing play scripts and poetry" | No spoken-English topic or items. | Out of scope for a text hub, or add a written "plan a speech / debate structure" item to wc. | L |
| K3-G4 | gp | Y7-Y9 | KS3 Grammar: "extending and applying the grammatical knowledge set out in English appendix 2 ... to analyse more challenging texts" | KS2 Appendix 2 items never revisited at KS3: subjunctive (1 hit only), hyphens (0), question tags (0), fronted adverbials (0), determiners/possessive pronouns (0), subject/object (0). | Add a mixed-review question set to gp Y7 (or Y7-Y9) covering the KS2 Appendix 2 list. | M |
| K3-G5 | rc / vocab | Y7 | KS3 Reading: "learning new vocabulary, relating it explicitly to known vocabulary and understanding it with the help of context and dictionaries"; "knowing the purpose, audience for and context of the writing" | Dictionary use not mentioned; context of writing appears in prose/shak but not rc Y7. | Add a dictionary/thesaurus skill item to vocab Y7 and a purpose-audience-context item to rc Y7. | L |

### Misplaced (year / phase)
| ID | Topic | Year | Official reference | Issue | Recommended fix | Sev |
| --- | --- | --- | --- | --- | --- | --- |
| K3-M1 | vocab | Y7 | KS2 Y3-Y6 vocab (same content) | Y7 vocab objective "Recognise and name basic figurative and sound devices", plus prefixes/suffixes definitions and roots (port, spect, auto, graph) and simile/metaphor/personification/onomatopoeia flashcards duplicate KS2 Y3-Y5 nearly item for item (about 7 of 11 flashcards). No progression from KS2. | Replace with KS3-level items (etymology, denotation/connotation, register); keep KS2 devices only as one revision card. | M |
| K3-M2 | gp | Y8 | App.2 Y2 (progressive), Y5 (past perfect) | Progressive and past perfect are first shown at Y8 ("Use a range of verb tenses and aspects"). They are KS1/KS2 requirements (see K1-G7, K2-G8). | Backfill KS1/2; keep Y8 as consolidation. | L |
| K3-M3 | gp | Y9 | App.2 Y6 (ellipsis; semi-colons in lists) | KS2 Y6 items appear only at Y9. | See K2-G9. | L |

### Out of scope / beyond the official text
| ID | Topic | Year | Note | Recommended fix | Sev |
| --- | --- | --- | --- | --- | --- |
| K3-O1 | gp | Y9 | "Nominalisation", "dangling modifier", "absolute phrase", "parallelism" are not in the DfE glossary (0 hits) or Appendix 2; nominalisation is also taught as A-level content (langf Y13 fc "Nominalisation"). | Acceptable stretch; consider keeping nominalisation for KS5 only and removing "absolute phrase". | L |
| K3-O2 | vocab | Y8-Y9 | Semantic field, archaism, neologism, metonymy, portmanteau, semantic change, Norman Conquest word history are not in KS3 PoS; PoS asks for "precise and confident use of linguistic and literary terminology" so this is within the spirit. | Keep. | L |
| K3-O3 | shak | Y9 | Hamartia/hubris/tragic hero and Twelfth Night/Much Ado/Tempest themes are GCSE-level analysis terms (they recur in shak4 Y10-11 and litd Y12). | Keep as stretch; ensure KS4 does not just repeat. | L |

### Wording / accuracy
| ID | Topic | Year | Official reference | Issue | Recommended fix | Sev |
| --- | --- | --- | --- | --- | --- | --- |
| K3-W1 | gp, wc, rc | Y7-Y9 | App.2/Glossary use "conjunction", "adverbial", "cohesion" (0 hits for "connective" in the Glossary) | "Connective(s)" used in gp Y7 objective, wc Y7-Y9, rc Y9 flashcards. | Use "conjunction/adverbial (connective)" on first mention; keep "cohesion" (official). | L |
| K3-W2 | gp | Y8 | Glossary (0 hits for "aspect") | "tenses and aspects" is linguistics-textbook terminology; App.2 says "present perfect", "progressive form". | Reword objective: "perfect and progressive forms". | L |
| K3-W3 | shak | Y7 | KS3 Reading: "Shakespeare (2 plays)" (across the key stage) | Y7 objective says "Study at least two plays by Shakespeare" but the Y7 note focuses on staging; Y8 names Macbeth/Much Ado, Y9 also cites Twelfth Night and The Tempest, i.e. up to 5 plays across KS3 while shak4 Y10-11 reuses Macbeth, Romeo and Juliet, The Tempest, Much Ado. | Fine as breadth, but state "2 plays across KS3" or avoid repeating Macbeth in Y8 and Y10. | L |
| K3-W4 | gp | Y8 | Internal consistency | Note says short/minor sentences "speed up the pace" but the worked example says the same device "slow[s] the pace and build[s] tension". | Reword the worked example ("slows the moment and builds tension") or the note. | L |

---

## 5. english-ks4 (Y10-Y11 GCSE; 181 questions)

Topics present: lang4, wr4, poet4, shak4, nov4, mod4, unseen4.
Official: GCSE English language (AO1-AO6, spoken AO7-AO9) and GCSE English literature (AO1-AO4) subject content; KS4 PoS.

### Gaps
| ID | Topic | Year | Official reference | What is missing | Recommended fix | Sev |
| --- | --- | --- | --- | --- | --- | --- |
| K4-G1 | lang4 | Y10-Y11 | GCSE Lang: "summary and synthesis: identifying the main theme or themes; summarising ideas and information from a single text; synthesising from more than one text" | "summar*" = 0 hits; "synthesise" appears once (Y11 objective). No summarising skill or question type. | Add a summary/synthesis note section and 2 questions per year (AO1: select and synthesise evidence from different texts). | H |
| K4-G2 | lang4 | Y10-Y11 | GCSE Lang: "identifying bias and misuse of evidence, including distinguishing between statements that are supported by evidence and those that are not"; "reading in different ways for different purposes, and comparing and evaluating the usefulness, relevance and presentation of content" | Bias appears once; "usefulness/relevance/presentation" not covered. KS3 rc Y9 teaches bias/generalisation, so KS4 regresses. | Add "supported vs unsupported claims / bias" and "usefulness of a source for a purpose" items to lang4 Y11 (AO4). | M |
| K4-G3 | lang4 | Y10-Y11 | GCSE Lang: "unseen texts will be drawn from each of the three centuries" (19th, 20th, 21st); all texts must be "high-quality, challenging" | lang4 mentions centuries once; there is no 19th-century unseen extract type. | Add at least one 19th-century-style original extract per year. | M |
| K4-G4 | wr4 | Y10-Y11 | GCSE Lang writing: "to describe, narrate, explain, instruct, give and respond to information, and argue"; "using information provided by others to write in different forms"; "maintaining a consistent point of view"; rhetorical devices "(such as rhetorical questions, antithesis, parenthesis)" | Content is descriptive/narrative/persuasive (letter, article, speech). No explain/instruct/give-information tasks; no "write from provided information"; antithesis and parenthesis absent (0 hits in KS4; antithesis only at KS3 wc Y9, parenthesis KS2 Y5). | Add an "explain / instruct / summarise information" form; add antithesis and parenthesis to the AFOREST/rhetoric list. | M |
| K4-G5 | poet4, unseen4 | Y10-Y11 | GCSE Lit: "using linguistic and literary terminology ... (such as, but not restricted to, phrase, metaphor, meter, irony and persona, synecdoche, pathetic fallacy)" | "synecdoche" appears nowhere in English KS1-5 (0 hits); "pathetic fallacy" not in KS4 (only KS3 vocab Y9 and KS5 litt Y12). | Add synecdoche and pathetic fallacy cards to poet4/unseen4 (or lang4). | M |
| K4-G6 | (all) | Y10-Y11 | GCSE Lang: spoken language AO7-AO9 (unweighted); KS4 PoS "Spoken language" | No spoken-language content. | Note as out of scope. | L |
| K4-G7 | mod4, nov4, shak4, poet4 | Y10-Y11 | KS4 PoS: "works from the 19th, 20th and 21st centuries" | No 21st-century text among set works (latest is Blood Brothers, 1983). GCSE Lit content only requires "fiction or drama from the British Isles from 1914 onwards", which is met. | Optional: add an original "21st-century" unseen extract. | L |

### Misplaced / labels
| ID | Topic | Year | Official reference | Issue | Recommended fix | Sev |
| --- | --- | --- | --- | --- | --- | --- |
| K4-M1 | unseen4 | Y11 | GCSE Lit AO1-AO4 (AO3 = "relationships between texts and the contexts in which they were written"); GCSE Lang AO3 = compare ideas, AO4 = evaluate | Y11 objectives tag comparison "(AO2, AO3 in the poetry context)" and evaluation "(AO1)". Under the Literature AOs, comparison is embedded across AO1-AO3 and evaluation is not an AO4 (AO4 = SPaG). The labels look borrowed from the Language AOs. | Relabel using Literature AOs: comparison = AO1/AO2 ("compare ... across texts" per Lit content), remove "AO3 ... context" tag unless context is discussed. | M |
| K4-M2 | lang4, wr4 | Y10-Y11 | App.2 / KS3 | Y10 lang4 re-teaches simple/compound/complex/minor sentences (KS3 Y7-Y8 gp); wr4 Y10 re-teaches comma splice, semicolon, apostrophes, its/it's (KS2 Y4-Y6, KS3 Y7). "Its vs it's" is duplicated as a flashcard in wr4 Y10 and Y11. | Fine as AO5/AO6 revision; remove the duplicate card. | L |

### Out of scope
| ID | Topic | Year | Note | Recommended fix | Sev |
| --- | --- | --- | --- | --- | --- |
| K4-O1 | nov4 | Y11 | Bildungsroman, free indirect discourse, "the sublime", frame narrative are A-level-style terms (also in litr Y12), beyond GCSE subject content wording. | Keep as stretch; make sure litr Y12 goes further rather than repeating. | L |

### Wording
None material. GCSE Lit set-text criteria are met: at least one Shakespeare (4 plays), one 19th-century novel (Dickens, Stevenson, Brontë, Shelley, Austen), poetry since 1789 including Romantic (Blake, Shelley, Wordsworth, Tennyson, Browning, Rossetti, Owen), fiction/drama from 1914 onwards (An Inspector Calls, Lord of the Flies, Animal Farm, Blood Brothers), and unseen poetry.

---

## 6. english-ks5 (Y12-Y13 A-level; 157 questions)

Topics present: langf, langc, litp, litr, litd, litt. No AS/A-level split (Y12/Y13 map to both).

### Gaps
| ID | Topic | Year | Official reference | What is missing | Recommended fix | Sev |
| --- | --- | --- | --- | --- | --- | --- |
| K5-G1 | (none) | Y12-Y13 | A-level English language and literature subject content: "develop students' ability to apply and integrate linguistic and literary approaches"; "a minimum of six substantial texts ... at least three further texts, one of which must be non-literary"; "use linguistic and literary approaches in their reading and interpretation of texts" | No topic/pack exists for this DfE-defined A-level (only langf/langc/litp/litr/litd/litt). Integrated analysis of a non-literary text is not covered. | Add a topic "English Language & Literature — Integrated Analysis" (Y12/Y13) or record the deliberate omission. | H |
| K5-G2 | langf | Y12 | A-level Lang para 7: "phonetics, phonology and prosodics: how speech sounds and effects are articulated and analysed" | "Phonetics" = 0 hits; there is no articulation/place-manner-voicing/IPA content; prosodics is a single table cell ("sounds and prosody"). langf Y12 objective names "phonology" only and adds graphology (not in the DfE list). | Add a phonetics/phonology/prosodics note section (articulation, IPA symbols, elision/assimilation, intonation/stress) and questions. | H |
| K5-G3 | langc / langf | Y12-Y13 | A-level Lang para 9: "historical, geographical, social and individual varieties of English"; "aspects of language and identity" | Historical, regional and social variation are covered; "language and identity" (including individual idiolect, group/national identity) has no dedicated section (only via gender, accommodation). | Add a language-and-identity section (idiolect, group identity, ethnicity, technology and identity). | M |
| K5-G4 | litd, litp, litr, litt | Y12-Y13 | A-level Lit para 10: "at least one work first published or performed after 2000" (and at least 3 pre-1900 texts incl. a Shakespeare play, at least two examples of each genre) | Pre-1900 and genre requirements are met (Shakespeare, Ibsen, Webster, Congreve, Wilde, Romantic/Victorian poetry, Brontë, Hardy, Conrad, Shelley, Stoker). There is no post-2000 text or reference at all (0 hits for dates 2000-2029). | Add a post-2000 novel/poem/play extract and question set (original text or a well-known modern work). | H |
| K5-G5 | litt / litr / litp | Y12-Y13 | A-level Lit para 17: "make appropriate use of the conventions of writing in literary studies, including accurate referencing and use of quotations"; "vary strategies for reading, including for detail, overview and gist" | Quotation use is taught; explicit referencing conventions and reading strategies ("gist/overview") are not. | Add a short note on referencing/bibliography conventions. | L |

### Misplaced (year / phase)
| ID | Topic | Year | Official reference | Issue | Recommended fix | Sev |
| --- | --- | --- | --- | --- | --- | --- |
| K5-M1 | langf, litt | Y12 | Content is KS2-KS4 (App.2 minor sentence, complex sentences; KS3 vocab Y9 pathetic fallacy, semantic field) | langf Y12 flashcards re-teach minor sentence, compound vs complex, four sentence moods, connotation/denotation; litt Y12 objective lists "pathetic fallacy, semantic field, juxtaposition, symbol, motif, syntax" as A-level terminology, but these are KS3/GCSE terms (poet4, vocab Y9). DfE says A-level must "build on the knowledge, understanding and skills established at GCSE". | Reframe as brief revision; add A-level level items (e.g. deixis, modality, lexical cohesion; register and genre theory). | L |

### Out of scope / board-specific
| ID | Topic | Year | Note | Recommended fix | Sev |
| --- | --- | --- | --- | --- | --- |
| K5-O1 | langc | Y13 | Child language acquisition (Skinner, Chomsky, Piaget, Bruner, Berko, Halliday) is not in the DfE A-level English Language subject content (it is in exam-board specs such as AQA/Eduqas). One of four Y13 objectives. | Label as "board-dependent"; keep. | L |
| K5-O2 | litt | Y13 | Deconstruction (Derrida), Lacan, new historicism, ecocriticism are beyond the DfE text, which asks only for "literary critical concepts and terminology ... with understanding and discrimination"; they are common in board specs. | Keep as stretch. | L |

### Wording
| ID | Topic | Year | Official reference | Issue | Recommended fix | Sev |
| --- | --- | --- | --- | --- | --- | --- |
| K5-W1 | langf | Y12 | A-level Lang para 7 levels: "phonetics, phonology and prosodics; lexis and semantics; grammar including morphology; pragmatics; discourse" | Our list is "phonology, lexis and semantics, grammar, pragmatics, discourse, graphology": drops phonetics/prosodics, drops "including morphology" (morphology is a flashcard only), adds graphology. | Align the objective wording to the DfE list; keep graphology as an extra. | L |

---

## 7. Counts by category

Counted from the tables above (one row = one finding).

| Pack | Gap | Misplaced | Out of scope | Wording | Total |
| --- | --- | --- | --- | --- | --- |
| english-ks1 | 14 | 2 | 0 | 2 | 18 |
| english-ks2 | 13 | 3 | 3 | 6 | 25 |
| english-ks3 | 5 | 3 | 3 | 4 | 15 |
| english-ks4 | 7 | 2 | 1 | 0 | 10 |
| english-ks5 | 5 | 1 | 2 | 1 | 9 |
| **Total** | **44** | **11** | **9** | **13** | **77** |

Severity H (should fix before launch): K1-G1, K1-G2, K1-G3, K1-G4, K1-G6, K1-G10, K2-G1, K2-G2, K2-G3, K2-G7, K2-G9, K3-G1, K3-G2, K4-G1, K5-G1, K5-G2, K5-G4 (17).

## 8. Top issues (ranked)

1. **Statutory KS2 spelling word lists are almost untaught** (K2-G1, K2-G2): ~22 of 100 Y3/4 words and ~8 of 100 Y5/6 words appear in spell content; the DfE calls both lists statutory. Add ~16 word-list sets.
2. **KS1 spelling and exception words** (K1-G1..G4): most Appendix 1 Y1/Y2 patterns (nk, tch, v+e, ph/wh, dge/ge, kn/wr, -le/-el/-al/-il, etc.) and 37 of 64 Y2 exception words are absent.
3. **KS3 Spelling (Y7-Y9) is unwritten** (K3-G1), which also leaves the KS2 word-list gap unrecovered.
4. **KS2 grammar terminology gaps** (K2-G6..G9): clause/subordinate clause, determiner, possessive pronoun, omitted relative pronoun, past perfect, subject/object, ellipsis, semi-colons in lists: appear late (KS3) or never; KS1 also lacks co-ordination/subordination teaching and the progressive form (K1-G6, K1-G7).
5. **Advanced-phase criteria not met**: GCSE Language lacks summary/synthesis and bias/evidence work (K4-G1/G2); A-level has no phonetics (K5-G2), no post-2000 text (K5-G4) and no English Language & Literature pack (K5-G1); KS3 has no contemporary/world literature (K3-G2).
