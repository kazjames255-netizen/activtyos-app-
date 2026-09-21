# Board review 04 — Non-maths subject packs

Scope: English, Languages, Geography, History, Science packs (`features/learninghub/live/board/toolkit/*`), ToolkitPop.tsx, and the code they lean on (kit.ts, render.ts, render-stamps.ts, controller.ts, BoardUi.tsx).
Method: read all pack files; ran `toolkit.selftest.ts` (6/6 pass, 101 templates); built every non-maths template through `B` + `place()` in a scratch script to count element kinds and sizes. **Not verified visually** (no browser render). Findings on layout are from coordinates.

Basis for "levels": `LEVEL_LABEL` = Early (KS1-2) / Standard (KS3) / Advanced (KS4-5); `levelFromYears`: Reception-Y6 = Early, Y7-9 = Standard, Y10-13 = Advanced. The level only FILTERS the list (`forLevel`, packs.ts:53) and changes pen/text size (controller.ts:816). No template draws differently per level.

## 1. Inventory

Item kinds: `make` (group of shapes/text/stickies/strokes), `bg` (page background), `action` (picture/import), or a data-driven stamp inside `make`. Counts = shown at Early / Standard / Advanced (all = total).

| Pack | Total | E / S / A | Items |
| --- | --- | --- | --- |
| English | 15 | 11 / 13 / 9 | Handwriting lines (bg, Early), Lined (bg), Two-column (bg); Phonics cards (12 cap); Word bank (stickies, 24 cap); Sentence builder (stickies); Word-class colour key (7 classes); Story mountain; PEE/PEEL/PEEL-History frame; Essay plan grid (1-6 paras); Poetry annotation frame; Text to annotate (`textblock` stamp); Venn (unlabelled); Characterisation grid; 5W frame |
| Languages | 11 | 11 / 11 / 7 | Verb conjugation table (French, Spanish, German, Italian, Portuguese, Latin, English pronouns; up to 4 tenses); Vocabulary grid; Flashcard tiles; Dialogue frame; Sentence frame (`___` gaps); Gender/article colour key (fr/es/de/it); Translation two-column; Tian zi ge (bg); Genko yoshi; Stroke-order guide; Two-column (bg) |
| Geography | 14 | 4 / 14 / 13 | Outline map stamp (8 regions, names toggle, letter-number grid); Own map (picture); Compass rose; 4-fig and 6-fig grid ref; Contours; Climate graph frame; River long profile; V-valley; Water cycle; Rock cycle; Plate boundaries; Population pyramid; Fieldwork table + graph axes |
| History | 9 | 5 / 9 / 9 | Timeline stamp (start/end/events); Source analysis (OPCVL / PCCU); Cause chain; Significance ladder; Family tree; PEEL (re-uses English item); Venn; Similarity/difference grid; Map for movements (Europe map stamp) |
| Science | 22 | 12 / 22 / 20 | Bio: animal cell, plant cell, body outline, food chain, food web, Punnett square, life-cycle wheel. Chem: periodic table stamp (118, click to highlight, colour by group), particle diagrams, Bohr atom stamp, equation balancing frame, lab apparatus stamp (8 kinds) + set, dot-and-cross frame. Phys: circuit symbol stamp (14 kinds) + set, force arrows, lens ray diagram stamp, wave frame, Sankey, results table, squared graph paper (bg) |

Special characters (`symbols.ts`): French, Spanish, German, Italian/Portuguese, English punctuation, maths, Greek, science (sub/superscripts, arrows). `PACK_SYMBOLS` maps packs to sets; geography gets "maths" and history gets "eng" only.

Data-driven stamps (edited through the options bar, BoardUi.tsx:205-225): timeline, textblock, map, periodic, bohr, symbol, apparatus, lens. Everything else is a flat group of `rect`/`line`/`text`.

Child-appropriateness: no issues in content. Stickers, badges, colour keys are fine. One caution: `h-tree` (history.ts:12) is a fixed binary hierarchy named "Family tree"; for KS1 "my family" work it presumes two-parent branching. Rename "Hierarchy" or offer free boxes.

## 2. What works (checked)
- All 101 templates build finite, in-range, reducer-accepted elements (selftest). Sizes are small (largest is the 120-shape Genko sheet).
- Search, level filter, "show every style", param form, group headings (Science) behave as coded. Pack guessed from subject (packs.ts:26-39).
- Stamps carry their state in `opts` and sync as ordinary `upd` ops; periodic table, map, timeline, Bohr, lens are genuinely interactive/data-driven and are the strongest items.
- Accent palettes work while a text box is open (onMouseDown preventDefault keeps focus, ToolkitPop.tsx:47).

## 3. Bugs (file:line)

**Critical: the owner's complaint is structural (see section 5)**

1. **No way to ungroup or select one template member.** kit.ts:7 and docs/learning-hub.md:195 say templates "can be ungrouped by Shift-selecting a member". Actual code: `controller.ts:384-385` expands EVERY click (including Shift) to the whole `grp` family. Only a marquee that fully encloses a member picks it alone (controller.ts:449-452). Consequences: "drag-and-drop word tiles" (english.ts:19), sentence-builder tiles (english.ts:21), flashcards, food chain boxes cannot be dragged individually; a tile drags the whole bank. Handles appear only when exactly one element is selected (controller.ts:375), so a whole template never gets a resize handle either.
2. **Students cannot rearrange tutor tiles.** Template elements are owned by the tutor; students may edit only their own (`reducer.ts:31`, `controller.ts:mayEditEl`). The word bank / sentence builder can only be moved by the tutor. A student-movable flag does not exist on `El`.
3. **Boxes and cells are not typeable.** `rect` shapes carry no text and cells in tables (`kit.ts:70-81`) are just lines. Double-click only edits `text`/`sticky` (controller.ts:364, 383). The Text tool drops a free, left-anchored, unwrapped text at the pointer at the tutor's text size (controller.ts:365). It does not centre in the cell, wrap, or clip; long entries run over the cell lines.

**Wrong output**

4. `english.ts:22` Sentence builder scramble is the identity for 2, 4, 5 and 10-word sentences: order is `(i*5) % n`, which is 0..n-1 in order when n divides 5 or n=2,4 (verified by hand: n=5 gives [0,0,0,0,0] then the "seen" walk yields 0,1,2,3,4). Default (6 words) scrambles, so it is missed in demos. Fix: seeded shuffle, reject identity.
5. `english.ts:19` Word bank stickies 164x64 with 24px bold text. `wrapLines` (render.ts:279-290) never breaks a long word and `drawSticky` clips (render.ts:301). "unfortunately", "beautifully", "Preposition" are cut off. Same for Sentence-builder tiles (english.ts:22) and the word-class key box.
6. `english.ts:31` "Text to annotate" is fixed 760x400. `drawTextBlock` (render-stamps.ts:227-232) grows the drawn card to fit, but `boundsOf`/hit-test/resize handle/export use `e.h`=400. A 200-word comprehension passage draws ~1000 tall: lower part cannot be selected, the handle floats mid-text, PNG/PDF export can clip it. `e-poem` (english.ts:29) computes h but ignores wrapping of long lines.
7. `BoardUi.tsx:218` (textblock Text field) is a single-line `<input defaultValue=...>`. Browsers strip newlines from that value, and `onBlur` commits with no "changed" check (`set` at BoardUi.tsx:192 always issues a patch). Result: selecting a poem or multi-paragraph text and merely clicking in/out of the field flattens all line breaks and paragraphs; pasting a paragraph loses breaks. Needs a `<textarea>` and a changed-guard.
8. `languages.ts:18` Flashcard tiles: the typed translation (`t`) is discarded (`void t`), and `b.tc(..., "", ...)` emits an empty text element per card (selftest script shows EMPTYTEXT=4). The "translation under" box is blank with no reveal. A tutor who typed "chat = cat" sees only "chat".
9. `languages.ts:25` Genko yoshi label says "20 x 10 squares"; it draws 12 x 10 = 120 separate `rect` shapes (heavy: 120 elements, all in one group; cannot be resized or scaled).
10. `geography.ts:21` Water cycle: the four process names (`t`) are discarded (`void t`), leaving four empty dashed boxes with no word bank. Box 1 (-470,-60,200x44) sits on the end of the evaporation arrow (-330,-30).
11. `geography.ts:11` + `render-stamps.ts:270-273,288`: "Names on the map: Yes" does nothing for 5 of 8 regions. `MAP_LABELS` exists only for world, europe, uk. Africa, Asia, North America, South America, Oceania show no names. Only continents are drawn (Eurasia is one polygon): no country borders, so "label the countries of Europe" needs the tutor to place text by hand.
12. `science.ts:30` Equation frame only splits on the `→` character; typing `->` or `=` (what a child or tutor on a normal keyboard types) yields one blob and no right-hand side (`r` undefined). The param help says "use →" but there is no insert button in the form.
13. `render-stamps.ts:209-220` Timeline: (a) negative years print as "-500", not "500 BC" (range allows -5000); (b) fonts are 12-14px fixed px and do not scale with the stamp (other templates use 20-28); on a shared screen they are tiny for KS1-2; (c) label boxes are a fixed 150px, alternating up/down: more than ~6 events or two close dates overlap; (d) events outside the range are silently dropped.
14. `languages.ts:15` Conjugation title is centred on `(t+1)*105 - 20` but the table width is `230 + 260t`; the heading sits left of centre (about 55px off with 1 tense, 80px with 2).
15. `languages.ts:21` Sentence-frame gap x-position uses `p.length*15.5` instead of `measureText`; wide letters (m, w, accented capitals) mis-space, so the underline can overlap text.
16. `ToolkitPop.tsx:47,81` + `controller.ts:790-796` Character palette inserts only into an open board text box. The template forms (Verb heading "écouter", Flashcard pairs, Sentence frame "Je m'appelle", Translation headings "Français") are plain `<input>`s in the popover; the palette cannot reach them and `Characters` hides the form. With no text box open, every tap creates a NEW single-character text at the same spot, stacking them (`insertChars`, controller.ts:793).
17. Templates are placed at fixed world size at the view centre (`controller.ts:751-762`), not fitted to the view. A periodic table (1120x640) at 100% zoom on a laptop overflows; a small template on a zoomed-out board is tiny.
18. Hard-coded hex fills/inks (`#eaf0fc`, `#5b6b8c`, `#2f6bd8`, `#e21d27`) in Venn/tables/frames ignore `Ctx` brand/danger. Fine on the default white paper, wrong if a tenant rebrand or a dark paper is used (theme.ts:reads `--surface`).
19. `packs.ts:41-47` Y5-Y6 map to "Early" (chunky, KS1-style list, PEE/essay/source frames hidden). UK 11+/SATs tutoring lives here; the level names in the UI say KS1-2 but the owner's brief is KS1 / KS2-3 / KS4-5. "Advanced" is the same list as "Standard" minus 2-5 items: nothing is actually KS4-5-specific.

## 4. Missing items, ranked by teaching value (per subject)

### English
1. Typeable PEE/PEEL/quotation frames (exists but not typeable; see 5). Add Quote-Technique-Effect, AO grids, quotation bank.
2. Comprehension: VIPERS/retrieval-inference frame; cloze (paste a passage, `[word]` becomes a gap + word bank) — 11+/SATs staple.
3. Spelling: Look-Say-Cover-Write-Check grid; word family/root-prefix-suffix builder; syllable splitter; alphabet strip; letter-formation / dotted tracing for KS1 (handwriting bg only).
4. Writing scaffolds: persuasive (AFOREST), sentence types, main/subordinate clause, time-connective and fronted-adverbial banks, dialogue/speech-mark frame, letter/newspaper layouts, editing checklist (CUPS).
5. Grammar: word-class key lacks Determiner (KS2 grammar), modal verb, subordinating conjunction.
6. Story planning beyond the mountain: setting/5-senses grid, character profile.
7. GCSE/A-level: comparative essay grid, themes-characters-context grid, language-paper question structure, rhyme-scheme tagger.

### Languages
1. Pre-filled high-frequency verbs: être/avoir/aller/faire; ser/estar/tener/ir; sein/haben/gehen. Today the pronouns are filled and every form is typed by hand.
2. Regular-ending tables with coloured stem/ending (-er/-ir/-re, -ar/-er/-ir, German weak verbs), plus a typeable version.
3. Topic vocab sets (numbers, days/months, colours, family, school, food, weather, time) that fill the grid/flashcards in one tap.
4. Adjective agreement (m/f/pl) table; German case table (nom/acc/dat/gen) and word-order tiles (verb-second, TMP); Latin noun declension table (Latin is in the verb list but has no noun tables).
5. Opinion/connective/question-word banks; tense timeline (past/present/future); role-play cards.
6. Sentence-builder and word-bank tiles live only in the English pack; MFL tutors do not see them (no cross-pack listing).
7. Character sets: pinyin tone marks, Cyrillic, Polish, Arabic (RTL is unsupported in the text box), Japanese kana. Greek is defined but not mapped to languages.

### Geography
1. Working outline maps for the rest of the world (labels for the 5 regions, country borders for Europe/UK counties/US states, rivers, mountains).
2. Early (KS1-2) has only 4 items: weather symbols and a simple weather chart, key/legend maker, local-area sketch map, 8-point compass (compass draws 8 points but labels 4), continents/oceans labelling, habitats/biomes, seasons.
3. Typeable/label-bank versions of cycles (water, rock) and diagrams.
4. Physical: coasts (spit, wave-cut platform), glacial landforms, hydrograph, meander/oxbow, tectonic cross-sections (currently arrows only).
5. Human/GCSE: settlement/land-use models (Burgess, Hoyt), urban zones, development indicators, greenhouse effect, climate zones, OS map symbols, scale bar, lat/long labelled graticule (graticule is drawn but unlabelled).

### History
1. BC/AD timeline (negative years), bigger fonts, parallel timelines (two strands), overlap-safe labels.
2. KS1: then/now sorting, sequence 3-4 pictures with arrows, artefact detective (What is it? made of? used for?), "Who/What/When/Why" (exists only in English pack).
3. Cause frames: long-term/short-term/trigger; factors web; consequence wheel; diamond-9 ranking; interpretations/utility-reliability grid; change/continuity graph (living graph).
4. Living-conditions grid with typed rows (compare has "Life / Power / Beliefs" fixed); "narrative account" planner for GCSE.

### Science
1. Working scientifically (all KS): Aim/Prediction/Variables (independent-dependent-control)/Method/Results/Conclusion/Evaluation frame and a fair-test planner. Nothing exists; this is the most reused science aid.
2. Biology: plant parts + pollination + plant life cycle; digestive and circulatory/heart/lungs systems; skeleton and muscles; classification key/branching tree; microscope + magnification formula frame; photosynthesis/respiration equations; reflex arc; food tests table. Body outline exists but has no organs.
3. Chemistry: reactivity series ladder; pH scale strip; change-of-state arrows on the particle diagram; separation techniques (filtration, distillation set-up); ionic and covalent bonding (dot-cross is two blank circles); mole triangle; energy profile (exo/endo); word-equation frame; test-for-gases; alkane homologous series. Apparatus set is 8 items (no gauze, thermometer, condenser, burette, pipette, evaporating dish, clamp stand, petri dish, balance).
4. Physics: series/parallel circuit frames with symbols pre-placed; speed-distance-time and velocity-time graph frames; EM spectrum strip; reflection/refraction ray diagram (lens only today); magnetic field lines; moments/levers; longitudinal waves; atomic structure/decay; energy stores; Earth-Sun-Moon (KS1-3 space) — none present. Circuit symbols missing thermistor, LDR, capacitor, junction, AC supply, transformer, loudspeaker.
5. Punnett accepts only 2-letter alleles (`science.ts:24`, `slice(0,2)`); a single allele gives a broken 1-column table.

## 5. "Empty boxes that cannot be typed into or resized" — how typeable templates could work

Why it happens today: `B.rect()` / `B.table()` (kit.ts:58, 70) emit `shape` rect + `line` shapes; only `text` and `sticky` accept typing; text has no box (no wrap, no clipping, no auto-fit); a group has no scale handle; there is no ungroup (bug 1).

Options (they compose; cheapest first):

A. **Frame box = sticky variant (recommended core, M).** Add a `frame` look to the existing `sticky` element (e.g. `opts:{frame:1, hint:"Point: make your point clearly", head:"P"}`, or a `variant` field). Renders as an outlined/filled box, no shadow, top-left aligned wrapped text, shrink-to-fit or grow, hint drawn as a placeholder when empty (never exported). Double-click already edits stickies (controller.ts:383) and the resize handle already exists for stickies (render.ts:499). Add `B.box(x,y,w,h,{hint,fill,label})` in kit.ts and migrate PEEL/essay/source/characterisation/Punnett labels, dialogue bubbles, cause chain, food chain, significance ladder, KWL, T-chart. Keeps the existing reducer, sync and wire formats (a sticky is already legal).

B. **Grid stamp for tables (L).** One stamp element `grid` with `opts:{cols:"200,200,200", rows:"56,64,64", head:1, cells:"a|b|c\n…"}`; click a cell to type it in place (cell editor over the canvas like TextEditor), options bar for + row / + col / remove, drag column edges, resize the whole grid with the corner handle (text scales). Replaces every `table()` template (conjugation, vocab, results, fieldwork, compare, T-chart, KWL, translation) with ONE element instead of ~15-30 shapes; syncs as one `upd` of `opts.cells`; much lighter than 120-rect Genko.

C. **Select-inside-group + ungroup (S).** Alt-click or double-click to enter a group and select one member (controller.ts:384-386), an "Ungroup" chip in the selection bar, plus scale handle for a selected group (apply factor to x/y/w/h/size/stroke w). Fixes tile dragging (bug 1) and gives resize for all remaining flat templates.

D. **Student-editable flag (M).** `El.open?: boolean` set on cells/tiles by templates ("student may type/move here"); `mayEdit` in reducer.ts:31 and `controller.mayEditEl` allow students to `upd` only `text`/`x`/`y` on `open` elements (perm rules unchanged). Needed for real "student arranges the sentence / fills the frame".

E. **Prefill through the form.** Params already exist (words, headings). Add "Leave blank / prefill" choices and pass typed values into the box text instead of `void t` (flashcards, water cycle, equation).

## 6. Prioritised build list

| # | Item | Size | Files |
| --- | --- | --- | --- |
| 1 | Ungroup + select-one + group scale handle; fix Shift toggling only whole family | S-M | `controller.ts` (selectDown/handleMove), `render.ts` (handlesOf, drawSelection), `BoardUi.tsx` (Ungroup chip), `controller.selftest.ts` |
| 2 | Frame box (sticky variant) + `B.box`; migrate frames (PEEL, essay, source, char grid, KWL, T-chart, dialogue, cause, food chain, ladder) | M | `model.ts`, `render.ts` (drawSticky), `BoardCanvas.tsx` (TextEditor style), `toolkit/kit.ts`, `english.ts`, `history.ts`, `general.ts`, `science.ts`, `toolkit.selftest.ts` |
| 3 | Fix scramble, sticky clipping/word-break, textblock height, textblock textarea + change guard, flashcard/water-cycle dropped text, equation `->`, Punnett single allele | S | `english.ts:19-22,31`, `render.ts:279-304`, `render-stamps.ts:227`, `BoardUi.tsx:218`, `languages.ts:18`, `geography.ts:21`, `science.ts:24,30` |
| 4 | Grid stamp for tables (typeable cells, add/remove rows/cols) | L | `model.ts` (StampKind, stampDef), `render-stamps.ts`, `controller.ts` (cell hit + editor), `BoardCanvas.tsx`, `BoardUi.tsx`, `kit.ts` `table()`, all table templates |
| 5 | Working-scientifically frame + fair-test planner; reflective results/graph frame | S | `science.ts` (uses #2) |
| 6 | Timeline: BC/AD, larger fonts, parallel strand, overlap avoidance; KS1 sequence + then/now templates | M | `render-stamps.ts:199-225`, `BoardUi.tsx:217`, `history.ts` |
| 7 | Language pre-fills: irregular verb sets, regular endings, topic vocab sets; German cases/Latin declension; adjective agreement | M | `languages.ts` (data tables), `ToolkitPop.tsx` (preset select) |
| 8 | Map labels for all regions + country/county borders for Europe/UK; label banks for cycles | M | `render-stamps.ts` (LAND data, MAP_LABELS), `geography.ts` |
| 9 | English writing/spelling set: cloze generator, VIPERS, LSCWC, AFOREST, QTE/AO grids, clause/sentence-type sorts, extra word classes | M | `english.ts`, uses #2/#4 |
| 10 | Character palette reachable from the template form; append repeat taps to the last char text; add pinyin tones, kana, Cyrillic, Polish; degree/minute marks for geography | S | `ToolkitPop.tsx`, `controller.ts:790`, `symbols.ts` |
| 11 | Student-editable flag (open cells/tiles) | M | `model.ts`, `reducer.ts:31`, `controller.ts mayEditEl`, `kit.ts` |
| 12 | Science content: bio systems (digestive, heart, plant), chem (reactivity, pH, change of state, bonding), physics (series/parallel, s-d-t graphs, EM spectrum, reflection), more apparatus and circuit symbols | L | `science.ts`, `render-stamps.ts` (SYMBOL_KINDS, APPARATUS_KINDS) |
| 13 | Real KS-specific variants: Early = bigger type + sentence starters; Advanced = exam-board content; map Y5-6 to a "KS2" middle option; fit-to-view on placement | M | `kit.ts` (Ctx.level), `packs.ts:41`, `controller.ts placeTemplate` |
| 14 | Theme the hard-coded fills/inks from `Ctx` | S | all pack files, `kit.ts` |

Suggested order: 1, 3, 2, 4, 5, 6, 10, then content packs (7, 8, 9, 12) built on the typeable boxes so the new items are usable from day one.
