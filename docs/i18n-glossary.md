# Teaching / Learning Hub: translation glossary (pl, ro, pt-PT, es, fr; cy, ur, pa, bn, ar below)

Source of truth for the hub catalogues (`lib/i18n/messages/areas/hub*`, `scripts/i18n-src/hublessons/*.txt`, `server/src/lib/hubDigestEmail.ts`).
Set after the independent native-level review in `docs/reviews/critic-i18n-eu.md`. When adding a string, use these words; when a reviewer proposes a
different word, change this table first, then run the catalogue rewrite in one pass.

## Terms

| Concept (EN) | pl | ro | pt (European) | es | fr |
| --- | --- | --- | --- | --- | --- |
| Learning Hub (family/kid side) | Centrum nauki | Centrul de învățare | Centro de Aprendizagem | Centro de aprendizaje | Espace d'apprentissage |
| Teaching Hub (tutor side) | Centrum nauczania | Centrul de predare | Centro de Ensino | Centro de enseñanza | Espace enseignant |
| tutor | korepetytor | profesor (never "tutore": legal guardian) | tutor | tutor | professeur (never "tuteur": legal guardian) |
| homework | praca domowa (verb: "zadaj pracę domową") | temă / teme (tab: "Teme pentru acasă") | trabalho de casa | deberes (plural noun; never "tarea(s)" for homework) | devoirs |
| set homework | Zadaj pracę domową | Dă temă | Atribuir trabalho de casa (not "passar") | Poner deberes | Donner des devoirs |
| lesson | lekcja | lecție | aula (live/class) / lição (content) | lección (content) / clase (live) | leçon (content) / cours (live) |
| quiz | quiz | **test** (tab "Teste"; never "chestionar" = survey) | **quiz** (never "questionário") | **quiz** (never "cuestionario") | quiz |
| starting quiz | Quiz startowy | Test inițial | Quiz inicial | Prueba inicial | Quiz de départ |
| placement test | test poziomujący | test de plasare | teste de nivelamento | prueba de nivel | test de positionnement |
| flashcards | fiszki | cartonașe (never "card/carduri": bank card) | cartões de memória | tarjetas de memoria | cartes mémoire (a deck = "jeu de cartes") |
| streak | seria / dni z rzędu | serie / zile la rând | sequência / dias seguidos | racha / días seguidos | série / jours d'affilée |
| stars | gwiazdki | stele | estrelas | estrellas | étoiles ("{n} sur 3 étoiles": no "(s)") |
| marks (points scored) | punkty | puncte | pontos (never "notas" for marks) | puntos | points |
| pass mark | próg zaliczenia | nota de trecere | nota mínima / nota de aprovação | nota para aprobar (never "nota de aprobado") | note de réussite |
| student | uczeń | elev | aluno | alumno (never "estudiante") | élève |
| year group (generic) | klasa | clasa | ano de escolaridade | curso | niveau scolaire |
| UK "Year N" labels | **Year {n}** | **Year {n}** | Ano {n} | Curso {n} | Année {n} |
| Key Stage | KS1–KS5 (kept) | KS1–KS5 (kept) | KS1–KS5 (kept) | KS1–KS5 (kept) | KS1–KS5 (kept) |
| worksheet | karta pracy | fișă de lucru | ficha | ficha | fiche |
| hand in | oddaj | predă | entregar | entregar | rendre |
| enrol | zapisz | înscrie | inscrever (not "matricular") | inscribir | inscrire |
| topic | temat | subiect | tema (not "tópico") | tema | thème |
| live lesson | lekcja na żywo | lecție live | aula em direto (not "ao vivo") | clase en directo (not "en vivo") | cours en direct |
| "the tab called ..." | zakładka (never "karta": also worksheet) | filă | separador | pestaña | onglet |

Rules behind the table:

- **UK Year N is not the local school class.** Polish "klasa 5" and Romanian "clasa a 5-a" are a different age from UK Year 5, so numeric year labels
  stay "Year N" in pl/ro (`k_yearN`, `yearN`, `cYearN`, `yearFor`, sticker-book titles). The generic word "klasa"/"clasa" is still used for "year group" as a
  filter/category noun. pt/es/fr use "Ano/Curso/Année {n}" as neutral labels.
- **One term per concept, everywhere**, including body text that names a tab: the tab is "Teste" (ro), "Quizzes" (pt/es), "Quizy" (pl) and the sentences that
  say "open the ... tab" (`hubfam.pgTutorEmptyBody*`, `hublive.aQz_noneBody`) use the same word.
- **No "(s)" / "(e)" hacks.** Use a plural key set (`_one/_few/_many/_other`), an invariant phrasing ("Jours actifs : {n}", "{n} sur 3 étoiles") or a
  neutral noun. Never split a gendered adjective with a slash in an aria label.
- **Keep "National Curriculum" English** ("Realizacja National Curriculum (Anglia)"): pl "podstawa programowa" and ro "curriculum național" mean the *local* one.
- pt is **European Portuguese** (guardar, ecrã, separador, em direto, ligação, trabalho de casa, "a guardar…", grelha). No "salvar", "tela", "você" as a subject,
  "lição de casa", "gerente", "conectado", "cadastrar".

## Register (tu / vous / você / Ty)

| | child-facing (kid mode, quiz-taking `hubfam.as*`, kid Home, lesson player) | parent / tutor / staff-facing (in app) | emails (digest, nudges) |
| --- | --- | --- | --- |
| pl | ty, lowercase ("ciebie", "twoja") | Ty, capitalised ("Twój", "Ci") | Ty/impersonal, warm |
| ro | tu | tu (app); the email may use formal "Vă/dumneavoastră" (email convention, documented) | formal |
| pt | **tu** (verbs in 2nd person: "Tenta outra vez", "Precisas de 60%") | formal, **no explicit "você"** (verb form or "o seu": "Inscreva", "guarde") | formal ("Agradecemos", "ignore") |
| es | tú | tú (never "vosotros/podéis": say "pueden") | usted ("Puede pedirle...") |
| fr | **tu everywhere the child is addressed** ("Réessaie quand tu veux !", never "Veuillez") | vous | vous |

Kid lines must not assume the child's gender ("prêt", "pronto", "mógł"): reword ("On rend ?", "Queres entregar?", "Quizy ... dla ucznia lub uczennicy").
Parent lines address a "child" neutrally ("l'enfant", "a criança"), not "il/ele".
Names in `{name}` are never declined: put them after a colon or in brackets ("Zadaj pracę domową: {name}", "Praca domowa ucznia ({name})").

## Plurals (runtime: `lib/i18n/plural.ts`, used by `usePlural`, `hubT.tp`, `homeI18n.pluralOf`)

`Intl.PluralRules(locale)` picks the CLDR category; the catalogue supplies only the forms the language needs and a missing form falls down a chain
(zero>other, one>other, two>few>other, few>many>other, many>other; unknown locale > other).

- **ro**: categories are `one` (1), `few` (0, 2-19, 101-119), `other` (20+). There is **no `many`**. `_other` carries the **"de"** form ("20 de zile"),
  `_few` the bare form ("5 zile"). Every ro plural base with a noun after `{n}` needs `_one`, `_few` and `_other`.
- **pl**: `one` (1), `few` (2-4, 22-24 ...), `many` (0, 5-21, 25 ...), `other` (fractions). Give `_one/_few/_many` wherever a noun follows `{n}`;
  a genitive-plural "Fiszek: {n}" phrasing is acceptable as an invariant.
- **pt/es/fr**: `_one` (fr: 0 and 1) and `_other`; `many` only fires at 1,000,000+ so `_many` is dead weight.
- **ar/cy**: full `zero/one/two/few/many/other` sets as before.
- Streaks: `hubshell.hm_dayStreak_*`, `hubmascot.streak_*` and the digest `c_streak*`/`streak*` all have one/(few)/other forms.

Checks: `node scripts/i18n-check-plurals.mjs` (n = 1, 2, 5, 19, 20, 21, 25, 100, 101 in the five languages + chain fallback for ar/cy).

---

# Second glossary: Welsh, Urdu, Panjabi, Bengali, Arabic

Set after `docs/reviews/critic-i18n-other.md`. Same rules as above: one term per concept everywhere (body text that names a tab uses the tab's word),
change this table first and then sweep the catalogues in one pass (value-level rewrite, then `node scripts/i18n-src/gen-hublessons.mjs`).

| Concept (EN) | cy | ur | pa (Gurmukhi) | bn | ar (MSA) |
| --- | --- | --- | --- | --- | --- |
| Teaching Hub (tutor side) | Hyb Addysgu (never "Y Ganolfan Addysgu") | ٹیچنگ ہب | ਟੀਚਿੰਗ ਹੱਬ | টিচিং হাব | مركز التدريس (never مركز التعليم) |
| Learning Hub (family/kid side) | Hyb Dysgu | لرننگ ہب | ਲਰਨਿੰਗ ਹੱਬ | লার্নিং হাব (suffix: লার্নিং হাবে) | مركز التعلّم |
| product name in email CTA / confirm text | translated, never Latin "Learning Hub" | same | same | same (never "Learning Hubে") | same |
| Key stage | Cyfnod allweddol | مرحلۂ تعلیم (never "کی اسٹیج") | ਸਿੱਖਿਆ ਦਾ ਪੜਾਅ (never "ਕੀ ਸਟੇਜ") | শিক্ষার স্তর (never "কি স্টেজ") | المرحلة الدراسية |
| subject | pwnc | مضمون | ਵਿਸ਼ਾ | বিষয় | مادة |
| topic | **testun** (never "pwnc"; "is-destun" for subtopic) | موضوع | **ਟਾਪਿਕ** (never ਵਿਸ਼ਾ / ਵਿਸ਼ਾ-ਵਸਤੂ / ਵਿਸ਼ੇ-ਭਾਗ) | **টপিক** (never বিষয় / বিষয়বস্তু) | موضوع |
| student / pupil | disgybl, disgyblion (never myfyriwr = HE student, never dysgwyr) | طالب علم | ਵਿਦਿਆਰਥੀ | শিক্ষার্থী | طالب |
| tutor | tiwtor | ٹیوٹر | ਟਿਊਟਰ | টিউটর (never শিক্ষক in app or email) | المعلّم (never المدرّس) |
| homework | gwaith cartref | ہوم ورک | ਹੋਮਵਰਕ | বাড়ির কাজ (never হোমওয়ার্ক) | الواجب المنزلي |
| quiz | cwis | کوئز | ਕੁਇਜ਼ (never ਕਵਿਜ਼) | কুইজ | اختبار |
| starting quiz / placement | cwis cychwynnol (never "cwis dechrau"); prawf lleoli = placement | ابتدائی کوئز / پلیسمنٹ ٹیسٹ | ਸ਼ੁਰੂਆਤੀ ਕੁਇਜ਼ / ਪਲੇਸਮੈਂਟ ਟੈਸਟ | শুরুর কুইজ / প্লেসমেন্ট টেস্ট | اختبار تحديد المستوى (one name, never اختبار البداية) |
| flashcards | cardiau fflach | فلیش کارڈز | ਫਲੈਸ਼ਕਾਰਡ (no nukta on ਫ) | ফ্ল্যাশকার্ড | بطاقات تعليمية |
| streak | rhediad | لگاتار {n} دن | ਲਗਾਤਾਰ {n} ਦਿਨ | টানা {n} দিন | سلسلة {n} يومًا / أيام متتالية |
| bar (fraction bar, progress bar) | bar | پٹی (never بار = time/turn) | ਪੱਟੀ (never ਬਾਰ) | পট্টি (never বার = day/turn) | شريط |
| protractor | onglydd (never onfedd) | چاندہ (never چاند = moon) | ਚਾਂਦਾ | কোণমাপক (never চাঁদা = moon/donation) | المنقلة |
| balanced (equation) | cytbwys | متوازن | ਸੰਤੁਲਿਤ | সমীকৃত (never সমতুল্য = equivalent) | موزونة |
| unsaved | heb ei gadw | محفوظ نہیں کیا گیا (never غیر محفوظ = unsafe) | ਸੰਭਾਲਿਆ ਨਹੀਂ / ਜਮ੍ਹਾਂ ਨਹੀਂ | সংরক্ষিত হয়নি | غير محفوظ (fine in ar) |
| no recent activity (child) | dim gweithgarwch | کوئی سرگرمی نہیں / (kid) | ਕੋਈ ਸਰਗਰਮੀ ਨਹੀਂ (never ਸ਼ਾਂਤ = calm) | কোনো কাজ নেই (never নিষ্ক্রিয়) | لا نشاط منذ … (never خامل = lazy) |
| tap | tapio | ٹیپ کریں | ਟੈਪ ਕਰੋ | ট্যাপ করুন | المس / اضغط (never انقر = mouse click, except mouse-only tools) |

Digits: **Latin 0-9 in every locale** (runtime `{n}`/`{pct}` are Latin, so native digits mixed on one screen were the bug). No ٠-٩ ۰-۹ ੦-੯ ০-৯ in catalogues; the digest date uses `ar-u-nu-latn` / `ur-u-nu-latn` / `bn-u-nu-latn` / `pa-u-nu-latn`.
Quotes: “ ” in ur/pa/bn/cy, « » only in ar. Apostrophe in Welsh is the curly ’. Panjabi postpositions are written apart (ਇਸ ਦਾ, ਉਸ ਨੂੰ, ਇਸ ਤੋਂ) and ਇਨ੍ਹਾਂ/ਉਨ੍ਹਾਂ; the “on” postposition is ’ਤੇ. Arabic tanween goes on the letter before alef (جزءًا).
UK “Year N” is not the South-Asian “class N”: pa/ur use ਸਾਲ / سال for Year, never ਜਮਾਤ/جماعت for a numeric Year label.

## Register

| | kid-facing (`hubfam.as*` quiz-taking, `hubfam.k*`, `hubmascot.*`, every `*Kid*` key) | parent / tutor / staff |
| --- | --- | --- |
| cy | **ti** everywhere (Rho gynnig arall arni; dy atebion; gelli di) | chi (Rhowch, eich, gallwch) |
| ur | آپ (respectful; a tum/آؤ pass for the KS1 band is deferred) | آپ |
| bn | তুমি (করো) | আপনি (করুন) |
| pa | ਤੁਸੀਂ (kids too; a ਤੂੰ/ਤੁਸੀਂ decision is deferred) | ਤੁਸੀਂ |
| ar | masculine MSA imperatives, no gender assumptions in labels | same, plural "كم" in emails |

Welsh: a placeholder cannot mutate, so **never put `{name}` / `{year}` / `{subject}` after i / at / gan / o / â / am / yn / gyda / wrth i**. Use a colon or a label frame
("Gosod gwaith cartref: {name}", "{name}: dim cwis wedi’i osod eto", "Tiwtor: {name}"). Avoid gendered "ei/eu" for a single child ("ei deulu" -> "y teulu").

## Plurals (ar, cy, pa, bn, ur)

- **ar**: CLDR `zero` (0), `one` (1), `two` (2), `few` (3-10), `many` (11-99), `other` (100+, decimals). Noun groups carry all six: 0 "لا طلاب", 1 "طالب واحد", 2 "طالبان",
  3-10 "{n} طلاب", 11-99 "{n} طالبًا", 100+ "{n} طالب". A label-style group ("الطلاب: {n}", "المواد: {n}") repeats one invariant text in every form. Forms an area does not
  carry live in `lib/i18n/messages/areas/hubplurals.ts` and fill gaps only (an area key always wins), merged in `lib/i18n/messages/hub.ts`.
- **cy**: `zero one two few many other`; Welsh puts a **singular** noun after a numeral, so the forms are usually identical except for mutation ("2 ddisgybl", "2 bwnc").
  A missing form falls back down the chain (zero>other, two>few>other, few>many>other), which is correct for Welsh.
- **pa / bn / ur**: `one | other` (CLDR); every plural base needs `_one` and `_other`; the extra `_few/_many/_two` rows some catalogues carry are unused copies.
- `node scripts/i18n-check-plurals.mjs` resolves every plural base in ar/cy/pa/bn/ur for n = 0, 1, 2, 3, 5, 11, 20, 21, 100, 101, requires all six forms on every ar group,
  and asserts the Arabic noun agreement examples above.

## RTL (ar, ur)

- Layout uses **logical** Tailwind utilities only: `ms-/me-/ps-/pe-/start-/end-/text-start/text-end/border-s/border-e/rounded-s/rounded-e`. Physical `ml/mr/pl/pr/left/right/text-left/border-l`
  are for code that positions by JS coordinates (a `left: x` window, a timeline axis) and for `left-1/2 -translate-x-1/2` centring. A physical class in a RTL locale is a bug unless it
  says why.
- `features/learninghub/rtl.tsx` is the shared helper: `scrollEdges` / `keepInView` (scrollLeft runs negative in RTL), `DirArrow` (a → / ← that mirrors), `isolate` / `<Bidi>`. `Icon` mirrors
  `chevronRight/Left` and `arrowRight/Left` automatically unless the caller already rotates them.
- Chemistry / maths arrows and tool canvases (number line, coordinate grid, ruler, protractor, fraction bars) stay left-to-right. Media "play" glyphs (▶) are not mirrored.
- Latin words, `{name}`-style placeholders and `{n}%` in ar/ur strings carry Unicode isolates (U+2068 … U+2069, U+2066 … U+2069) so neighbouring punctuation cannot jump to the wrong end.
- Fonts (`app/layout.tsx`): Noto Naskh Arabic (ar), Noto Nastaliq Urdu (ur, with `line-height: 1.9`), Noto Sans Gurmukhi (pa), Noto Sans Bengali (bn); `preload: false`, unicode-range subsets, applied per
  `<html lang>` by re-pointing `--ff` / `--ff-display`.
