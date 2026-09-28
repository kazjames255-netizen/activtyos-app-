# i18n browser pass: Teaching Hub / Learning Hub, 11 locales

Run 27 Sep 2026 against the dev stack, headless Chromium, own throwaway `@activityos-test.com` accounts (tutor freelancer, parent, 4 children, homework, quizzes, groups, a seeded lesson; no e2e-locked queue, no real tenants, nothing cleaned up that we did not create). Re-swept in full a second time the same day after the How-it-works overlay fix below (all 11 locales, both widths, one clean run each — see the per-locale table).

Harness: `e2e/review/i18n-browser-pass.spec.ts` + `playwright.i18n.config.ts` (set `REVIEW_AUTH_DIR`, `I18N_LOCALES=ar,ur`, optional `I18N_ONLY=remotesync`).
Raw data: `docs/reviews/shots/i18n/results.json`. Screenshots: `docs/reviews/shots/i18n/<locale>/<role>-<view>-<1440|390>.jpg`. A second, narrower harness (`e2e/review/i18n-hiw-visual.tmp.spec.ts`, not checked in — recreate from this doc's diff if needed) captured the How-it-works chooser/player/sheet specifically per locale into `docs/reviews/shots/i18n-hiw/<locale>/`.

Views per locale and width: tutor Home, Students, Homework inbox, Marking (to mark), Lessons, Live, Progress, Quizzes, Messages, Tools (+ tool windows: every tool in ar/ur at 1440, a sample of 6 elsewhere), Setup (hub tab), live-lesson start screen (remotesync); parent Home, Lessons, Homework, Progress, Quizzes, Messages, Report; kid Home, Lessons, Homework, Progress, Quizzes; public How-it-works (tutors, parents, children); games entry (`/dev/games/penguin-slide`, the only games entry that exists yet). The How-it-works visual pass additionally opened the tutor/parent/child chooser and player for `tutors`, `tutors/homework`, `parents`, `parents/start`, `children`, `children/homework`, plus the in-app "How it works" sheet, at both widths.

Detector (in the spec): visible text nodes and aria-label/title/placeholder/alt compared with the English hub catalogue (exact match to an English value where the locale's own value differs = runtime leak; equal = untranslated catalogue entry), raw `hubxxx.key`, `{placeholder}`/undefined/NaN, "oak", clipped text (ellipsis / line-clamp overflow), page horizontal overflow at 390, `html dir/lang`, RTL tab order, bidi controls in attributes, U+FFFD.

## Counts per locale — second (post-fix) sweep, 22/22 runs green, 0 views missed

| locale | shots | English runtime leaks | untranslated catalogue | raw keys | {placeholders} | "Oak" | x-overflow @390 | clipped (en baseline 72) | views not reached |
|---|---|---|---|---|---|---|---|---|---|
| en | 68 | 0 | 0 | 0 | 0 | 0 | 0 | 72 | 0 |
| pl | 68 | 53 | 2 | 0 | 0 | 0 | 0 | 87 | 0 |
| ro | 68 | 53 | 0 | 0 | 0 | 0 | 0 | 52 | 0 |
| ur | 164 | 57 | 1 | 0 | 0 | 0 | 0 | 96 | 0 |
| pa | 68 | 57 | 0 | 0 | 0 | 0 | 0 | 50 | 0 |
| bn | 68 | 53 | 0 | 0 | 0 | 0 | 0 | 63 | 0 |
| ar | 164 | 57 | 1 | 0 | 0 | 0 | 0 | 110 | 0 |
| pt | 68 | 53 | 2 | 0 | 0 | 0 | 0 | 74 | 0 |
| es | 68 | 53 | 2 | 0 | 0 | 0 | 0 | 80 | 0 |
| fr | 68 | 44 | 0 | 0 | 0 | 0 | 0 | 62 | 0 |
| cy | 68 | 53 | 0 | 0 | 0 | 0 | 0 | 61 | 0 |

The fr "report at 390" flake from the first sweep did not recur; this sweep has 0 views not reached in every locale. "English runtime leaks" are almost entirely DATA, not UI, confirmed by inspecting every unique string: the seeded lesson/quiz titles ("A Christmas Carol" quiz names), curriculum taxonomy names ("Geometry and measures" etc.), the fixture's own English child/subject names, and the two dev-only Setup-page recording notes ("Walkthrough — to record", "· aim for 2 min") — none are inside the How-it-works overlays this pass targeted. "Untranslated catalogue" is 1-2 trivial abbreviation labels ("1 · KS3") already identical to English by design (KS3 is a UK curriculum abbreviation, not translated in any locale). Raw keys, placeholders, undefined/NaN, "Oak" and x-overflow: all zero in every locale, both sweeps.

## Fixed in this pass

1. **How it works entry points were English in every locale** (`hubhow` area was empty). Added 17 keys x 11 locales in `lib/i18n/messages/areas/hubhow.ts` and wired `HowItWorksButton.tsx` (hero pill, title, aria, kid card, card), `TabHowTo.tsx` (the ten "Watch: ..." links) and `home/KidHome.tsx`. English text is unchanged. At the time of this fix the explainer sheet, chooser and player were still English; that gap is now closed too (see "How-it-works overlays finished", below).
2. **35 lesson-widget tool names English** on the Tools page, floating windows and "Close <tool>" labels (Area and perimeter builder, Balance the scales, ...). New gap-fill file `lib/i18n/messages/areas/hubwidgetnames.ts` (`title_w_<id>` in the `hubtoolsa` namespace, area keys win), merged in `lib/i18n/messages/hub.ts` next to `hubplurals`. Verified in ar: 21 -> 3 English names left.
3. **Raw key on the Human eye diagram** (`hubtoolsb.sc_dg_eye`, `sc_dgd_eye`, shown even in English): `features/learninghub/tools/science/labels/LabelDiagram.tsx` now falls back to the diagram's English title/description when the catalogue has no row (the eye diagram's part names/hints are still English in every locale, open).
4. **RTL punctuation glitch on the English-only How-it-works page**: trailing full stops jumped to the wrong side of English sentences in ar/ur. `HowItWorksPage.tsx` now lays the page out `lang="en" dir="ltr"` in RTL locales (the mascot bubble keeps `dir="auto"`). Replace this when the explainers are translated.
5. Harness only: `e2e/review/fixture.ts` `AUTH` dir is overridable with `REVIEW_AUTH_DIR` so a run never touches the shared `e2e/review/.auth` files.

## Checks that passed

- **Naming**: Teaching Hub / Learning Hub in every locale, consistent across all four catalogue keys (pl Centrum nauczania / Centrum nauki, ro Centrul de predare / de învățare, ur ٹیچنگ ہب / لرننگ ہب, pa ਟੀਚਿੰਗ ਹੱਬ / ਲਰਨਿੰਗ ਹੱਬ, bn টিচিং হাব / লার্নিং হাব, ar مركز التدريس / مركز التعلّم, pt Centro de Ensino / de Aprendizagem, es Centro de enseñanza / de aprendizaje, fr Espace enseignant / d'apprentissage, cy Hyb Addysgu / Hyb Dysgu). Only nit: fr "Learning Hub" uses a straight apostrophe in one key and a typographic one in another.
- **"Oak"**: 0 hits in visible text or attributes in any locale/view, 0 in the 11 hub catalogues, `scripts/check-no-oak.mjs` clean.
- **Raw keys / {placeholders} / undefined / NaN**: none (after fix 3 and the hubhow keys).
- **Fonts**: Arabic, Urdu (Nastaliq), Panjabi (Gurmukhi), Bengali all render real glyphs in screenshots (layout self-hosts Noto for them); no U+FFFD or tofu.
- **RTL (ar, ur)**: `html dir=rtl` and `lang` correct, hub shell, tab strip, side card, home dashboard, tables, floating tool windows (calculator), remotesync start screen, back/forward arrows all mirror correctly at 1440 and 390; no RTL tab-order flag.
- **Bidi isolates**: U+2066-2069 in visible text render invisibly (no boxes); 1,700 aria-labels (ar/ur) contain isolates around names, which is intended.
- **Page overflow at 390**: none in any locale.
- **Plurals**: static audit of every `_zero/_one/_two/_few/_many/_other` group in the 11 hub catalogues against `Intl.PluralRules`: ar and the plural-poor locales have no gap; the only categories that fall to `other` (pl few/many, ro few, cy zero) are label-style strings ("Zadania: {n}") where the number follows a colon. No wrong plural seen in screenshots.

## Open (not fixed)

| # | locale scope | issue |
|---|---|---|
| 1 | CLOSED (see "How-it-works overlays finished" below) | ~~How-it-works (page, in-app sheet, narration, chooser cards) is English only.~~ |
| 2 | all 10 | Curriculum taxonomy (strands and topic names such as "Geometry and measures", "Ratio and proportion", GCSE/National curriculum labels) and seeded lesson/quiz titles come from server data, English. |
| 3 | all 10 | Legacy lesson-widget internals (`lesson/widgets/legacy/*.gen.ts`) hard-code English inside the widget HTML (e.g. "masculine"/"feminine" chips, cell labels "Plant cell"/"Animal cell" in the Venn pack). |
| 4 | all 10 | Portal chrome outside the hub is English: sidebar group names (RUN THE DAY, MARKETING, MONEY, SETTINGS), "Contact — newsfeed, messages and email", "Notifications (n new)", sidebar footer tagline, Setup page "How it works". |
| 5 | pl, ro, bn, pa, ur, ar | Sub-section card one-liners under the top tabs (SubMenuCard) show one line with an ellipsis where the translation is longer than English (`line-clamp-2` is set but one line shows); full text is in the tooltip. File is under edit by others. |
| 6 | ar, ur | CLOSED (by design): the floating tool window is anchored by its physical left/top and grows right/down (FloatingPanel.tsx), so the grip must stay at the physical bottom-right in RTL too, since that is the corner the drag moves; mirroring it would put the handle on the wrong corner. |
| 7 | all | Science label diagrams added after the catalogue (Human eye) have English part names/hints. |
| 8 | all | Band names shown to a parent ("Secure", "Learning") are the tenant's level names (data); kid mode already maps them via `hubfam.band*`. |
| 9 | all | `/dev/games/penguin-slide` is a dev page; games are not linked from the hub yet, so only that was captured (the Penguin work is another agent's, tsc currently reports 2 errors in `games/penguin/ui` that are not from this pass). |

## E2E implications

- E2E runs in English, and every English string I touched is byte-identical (button label, aria, title, "Watch: ..." links, tool names, eye diagram fallback). No spec needs changing.
- `t("hubhow.*")` returns "" until the hub catalogue lands (first paint), same as every hub key, so name-based selectors such as `getByRole("button", { name: "How it works" })` rely on auto-wait, as they already do for other hub text.
- Non-English runs cannot use English name selectors. The existing `e2e/i18n/*-locales.spec.ts` only screenshot; this new spec adds asserting-style detection (findings in `results.json`), it does not fail the run.
- `results.json` merge: a full run of a locale replaces that locale/width's findings; `I18N_ONLY=remotesync` keeps them.

## Closed by the chrome pass (27 Sep)

- Portal chrome (open #4): sidebar group names, header Contact label and tooltip, Bell / PlatformBell titles, `Notifications (n new)`, sidebar `Powered by` and tagline, and the greyed item tooltip are now `chrome.*` keys (`lib/i18n/messages/areas/chrome.ts`, 11 locales).
- SubMenuCard one-liners (open #5): clamp raised from 2 to 3 lines so long pl/ro/bn/pa/ur/ar descriptions wrap instead of ellipsising.
- fr apostrophes: 665 lines across the fr catalogues now use the typographic apostrophe in prose.

## How-it-works overlays finished (27 Sep, this pass)

Verification found the overlay JSONs (`features/learninghub/howitworks/i18n/<locale>.json`) had gone stale against the English scripts: `tutorTopics.ts`/`tutorMessages.ts` had grown a new `home` topic (3 scenes), renamed `roster` to `families`, added a whole `messages` topic (3 scenes), and split students/lessons/live/tools/quizzes/progress into more, differently-named scenes (31 new scene ids, plus `hw-add-details`/`hw-mark` added and `hw-set`/`hw-worksheet`/`hw-tasks`/`hw-handin`/`hw-results` restructured) since the 11 overlays were last generated. `node scripts/how-i18n-template.cjs --check` failed with 61 problems in every one of the 10 non-English locales (missing scripts, missing scenes, keys-length/`::`-anchor mismatches).

Fixed: translated the 3 new/renamed scripts (`home`, `families`, `messages`) and all 31 new/changed scenes (title, chapter, narration, anchor keys) into all 10 locales, matching the exact anchor-substring and `::`-marker rules the integrity checker enforces; added the 2 new `ui.tryNow`/`ui.nextVideo` keys; rebuilt the `shots`/`cam`/`rings`/`cursor` cue arrays to the new lengths, and translated the visible `nodes`/`callouts` text (fam-ways ways-in diagram, fam-invite callout, live-modes and live-incall node labels) per locale. `node scripts/how-i18n-template.cjs --check` and the `e2e/how-it-works-i18n.spec.ts` overlay-integrity test are green in all 10 locales; `e2e/how-it-works.spec.ts`'s "scripts are internally consistent" describe block (17 tests, English source) is unaffected and green.

Verified in the browser (own runs, `docs/reviews/shots/i18n-hiw/`): the public chooser (`/how-it-works/tutors`) now shows all 10 cards translated in every locale, including the 3 that were still English before the fix (card 1 "Your Home screen", card 2 "Getting families on your roster", card 10 "Messages" — confirmed in ar: شاشتك الرئيسية / ضمّ العائلات إلى قائمتك / الرسائل, and pl: Twój ekran Start / Zapisywanie rodzin na listę / Wiadomości); the in-app "How it works" sheet (freelancer Home → "Jak to działa"/"كيف يعمل") likewise shows all 10 translated cards; the player's scene sidebar and narration for `tutors/homework` play through correctly in ar (RTL, Nastaliq/Arabic script, mascot bubble). No English leaks, clipped text, wrong `dir`, or broken cue phrases were seen in the chooser/player/sheet screenshots for pl, ar (RTL). `HowItWorksPage.tsx`'s `lang="en" dir="ltr"` fix for the still-English narration videos (see fix 4, above) is untouched and still correct.

Narration and captions ARE localized (the player speaks and displays the translated `say` text via `speechSynthesis`/`pickVoice(lang)`, falling back to captions-only where the device has no voice for that language — see `ui.noVoice`, already translated in all 10 locales). Still open, unchanged from before: the **recorded screen captures inside the video frame** (the actual app-UI screenshot/cursor animation behind the narration) were captured once against the English app and still show English UI text — re-recording them per locale is a separate, larger project, not a translation-catalogue fix. The science-diagram part names (Human eye, Plant/Animal cell) and legacy widget internals (masculine/feminine chips) remain English (open items 3 and 7).
