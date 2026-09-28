# Critic: Teaching / Learning Hub translations — cy, ur, pa, bn, ar (+ RTL layout)

Scope reviewed: `lib/i18n/messages/areas/{hubshell,hublessons,hubtoolsa,hubtoolsb,hubfam,hublive,hubplan,hubmascot}.ts` (+ part files) and `server/src/lib/hubDigestEmail.ts`.
`hubhomework.ts` and `hubhow.ts` exist but hold **0 keys** (not landed), so nothing to review there.
Method: flattened every catalog (6,217 cy/ar keys; 6,189 ur/pa/bn), ran mechanical checks on ALL keys (placeholders, script, plural coverage, term consistency), then read ~215 sampled strings per language across all namespaces (kid copy, parent verdicts, empty states, errors, marks, plurals, tool names), plus all five digest-email locales.

## Mechanical results (all keys)

| Check | cy | ur | pa | bn | ar |
| --- | --- | --- | --- | --- | --- |
| Empty values | 0 | 0 | 0 | 0 | 0 |
| Placeholder mismatch vs en (excl. by-design plural forms) | 2 (`{first}` dropped once) | 2 | 2 | 2 | 0 real (43 are `_one/_two/_zero` forms that drop `{n}` on purpose) |
| Wrong script / Devanagari / Shahmukhi leaks | none | none (no Devanagari) | none (no Shahmukhi) | none | none |
| Identical to English (not placeholders/proper nouns) | ~35 (mostly code/emoji/keys) | 7 | 8 | 8 | 7 |
| Latin word glued to native suffix | – | – | – | 1 (`Learning Hubে`) | – |
| Tashkeel | n/a | n/a | n/a | n/a | 1,541 strings vocalised (good for child copy) |

Plural coverage: 51 plural groups. cy and ar have all six forms only for 5 groups; 26 groups have one/two/few/many/other but no `_zero`; **17 groups are `_one/_other` only** (e.g. `hublessons.tfCardsTotal`, `tfPublishDrafts`, `fcCardsToReview`, `hubfam.pgOfTopics`, `pgOfTopicsPract`, `pgAcrossSubjects`). For Arabic that is a real bug (see A-1).

---

## WELSH (cy) — Grade B

Overall: fluent, idiomatic, correct Key Stage / Year / Derbyn vocabulary, good soft mutation inside static phrases ("Cymhariaeth gyffredinol", "Cyn-diwtor", "Ffon fesur"). Problems are terminology drift, register drift, mutation around `{placeholders}`, and a few outright errors.

| Sev | Key | Current | Problem | Fix |
| --- | --- | --- | --- | --- |
| HIGH | `hublive.ePicAdded` | "llusgwch yr **onfedd** arno" | "onfedd" is not a Welsh word for protractor | "llusgwch yr **onglydd** arno" |
| HIGH | digest `cy.subject` (`hubDigestEmail.ts`) | "Yr wythnos hon yn nysgu {name}" | ungrammatical (an "yn + nasal mutation" fragment with no verb); reads as gibberish in an email subject | "Dysgu {name} yr wythnos hon" |
| HIGH | `hubshell.hm_startingHint` | "Mae atebion y cwis dechrau angen eich marciau" | wrong syntax ("angen" needs the object after; also "cwis dechrau" is a calque) | "Mae angen eich marciau ar atebion y cwis cychwynnol" |
| MED | `hubshell.hm_ctaStartingKid`, `hubfam.pgTrendT/Y`, `hubfam.pgNobody`, digests | "cwis dechrau / cwisiau dechrau" | same calque; the same product term is "cwisiau cychwynnol" in `hubfam.asNoForTopicKid` | one term everywhere: **cwis cychwynnol** |
| MED | `hubshell.st_enrolFail` | "Methwyd cofrestru'r plentyn" | missing "â" + aspirate mutation ("Methwyd **â chofrestru**"); other keys ("Methwyd â llwytho", "Methwyd â gorffen") get it right | "Methwyd â chofrestru'r plentyn" |
| MED | ~25 keys `st_setHwFor`, `st_setNewQuiz`, `st_messageName`, `st_ariaSetHw`… | "Gosod gwaith cartref **i {name}**", "Anfon neges **at {name}**" | "i", "at", "gan", "o" soft-mutate a following name (i Gareth, at Dafydd, i Megan…); a placeholder cannot mutate | rephrase to a mutation-free frame: "Gosod gwaith cartref — {name}", "Neges: {name}", or "ar gyfer {name}" (no mutation) |
| MED | student vs learner terms | "disgybl" (`studentsCount`), "myfyrwyr" (`pgSearchPh`, `pgSummary`, `qzQfExplNote`), "dysgwyr" (`cLoadStudentsFail`) | three words for one concept; "myfyriwr" = HE student, wrong for 4–16 | use **disgybl/disgyblion** throughout (or "dysgwyr" for the platform, but one only) |
| MED | topic vs subject | "pwnc" is used for both subject and topic (`hm_basedOn`, `hublive.aCd`), "testun" for topic (`pgOfTopics`, `qzAbNoQsTopics`) | inconsistent; "testun" also means "text" | subject = **pwnc**, topic = **testun** (or "thema") in every file |
| MED | Teaching Hub name | "Hyb Addysgu" (hubshell), "Y Ganolfan Addysgu" (`aPanel_unavailBody`, `hm_splashAria`), "Hyb Dysgu" / "Learning Hub" (Latin, in `hublive.cConfirmBody`, email CTA "Agor Learning Hub") | 3 names for the product | fix "Hyb Addysgu"/"Hyb Dysgu" everywhere; translate the email CTA and `cConfirmBody` |
| MED | kid register | kid strings mix "Rhowch gynnig arall arni", "Gadewch i ni drio eto" (chi) with "gelli di", "dy sêr", "aros amdanat ti", "Gad i mi ddangos … i ti" (ti) | a 6-year-old should get one register; ti is normal for children in Wales | make all kid-facing copy "ti": "Rho gynnig arall arni", "Gad i ni drio eto" |
| MED | `hubtoolsb.lang_shortcuts`, `lang_sub_type24` | "teipia", "gennyt" (ti) inside tools shown to tutors too | see above; adult/tutor copy is "chi" | decide per audience |
| LOW | `hubplan.sub_child` | "eu pynciau gwannaf" for a single named child | "eu" for one named person is unusual; and "ei/eu" in `st_enrolledFlash` "gall **ei** deulu" and digest `why` "a'**i** weithgarwch" assume a male child | use a gender-neutral rewrite: "… yn seiliedig ar y pynciau gwannaf" |
| LOW | `hubshell.hm_startingHint`… | "Dim man cychwyn eto" (`pgNoBaseline`) | baseline = "llinell sylfaen" | "Dim llinell sylfaen eto" |
| LOW | `hubtoolsa.gl_M_G02_angleBisector` | "Haneru ongl" | verbal noun as a label | "Haneriad ongl" |
| LOW | apostrophes | 1,252 straight `'` vs 205 curly `’` | typographic drift inside one catalogue | normalise to `’` |
| LOW | `hublive.cAllowAnyway` | "Caniatáu beth bynnag" | colloquial calque | "Caniatáu er hynny" |
| INFO | plural forms | `_many` "cerdyn i’w hadolygu" etc. | correct (singular noun after numerals) | none |

Strengths: "Cyfnod allweddol", "Blwyddyn 5", "Derbyn", "gwaith cartref", "cwis", "rhediad" for streak, kid cheers ("Ardderchog!", "Da iawn!", "Rho gynnig arall arni - gelli di!") are natural.

## URDU (ur) — Grade B-

Overall: accurate, formal-but-warm, mostly Urdu vocabulary (no Hindi loanwords found), good "براہِ کرم", "درست", "ابتدائی". Problems are a mis-transliteration, "بار" homographs, gendered/ambiguous "غیر محفوظ", missing Nastaliq font stack in the app, and inconsistent quotation marks.

| Sev | Key | Current | Problem | Fix |
| --- | --- | --- | --- | --- |
| HIGH | `hubshell.k_keyStage` | "**کی** اسٹیج" | "Key stage" transliterated literally: "کی" is the Urdu word "of"; meaningless | "مرحلۂ تعلیم" (as already used in `hubtoolsb.tp_keyStage`) |
| HIGH | `hubshell.su_yearsTitle` | "سالانہ جماعتیں" | "annual classes" | "سال/جماعت کے گروپ" |
| HIGH | `hubfam.pgTutorEmptyBody/Diag` | "ایک **بار** بھرے گا … استعمال کر کے ایک دیں" | "بار" = "time/once/load", not "bar"; final clause unintelligible; `{first}` given only once | "…یہاں موضوع بہ موضوع ایک **پٹی** بھرے گی۔ <b>کوئز</b> ٹیب کھولیں اور <b>بچوں کے لیے مقرر کریں</b> سے {first} کو ایک کوئز دیں۔" |
| MED | `hublive.eBarTip` | "**بار** اونچا کرنے" | uses "بار" while all other bars are "پٹی" | "پٹی اونچی کرنے کے لیے ٹیپ کریں" |
| MED | `hubfam.qzAbUnsavedQ` | "آپ کی **غیر محفوظ** تبدیلیاں" | "غیر محفوظ" = "unsafe/insecure" | "اس کوئز میں ایسی تبدیلیاں ہیں جو محفوظ نہیں کی گئیں۔" |
| MED | `hublive.ePicAdded` | "**چاند** کو اس پر کھینچ کر لائیں" | "چاند" = moon; protractor is "چاندہ" / "زاویہ پیما" | "چاندے کو…" |
| MED | Learning/Teaching Hub | "ٹیچنگ ہب", "لرننگ ہب" (hubshell) vs "سیکھنے کے مرکز" (`hubfam.invJoin`) vs Latin "Learning Hub" (`hublive.cConfirmBody`, email CTA) | 3 renderings | one form: "لرننگ ہب / ٹیچنگ ہب" (transliteration reads natural for UK Urdu speakers) everywhere, incl. email CTA |
| MED | `hubfam.qzAbCounts…`, `hubtoolsb.lang_ord_mainEnd` | «…» guillemets in some keys, “…” in others | inconsistent | pick “ ” (matches the rest) |
| MED | `hubtoolsb.eng_f_argument-16_against_prompt` | "اسی طرح خلاف دو یا تین وجوہات دیں" | telegraphic | "اسی طرح اس کے خلاف دو یا تین وجوہات دیں۔" |
| LOW | `hubfam.qzQfAddItem` | "+ شے شامل کریں" | "شے" is stiff | "+ ایک چیز شامل کریں" |
| LOW | `hubplan.empty_t` | "ابھی منصوبہ بنانے کو کچھ نہیں" | calque | "ابھی منصوبہ بندی کے لیے کچھ نہیں" |
| LOW | `hubplan.set` | "یہ دیں" | ambiguous ("give these") | "یہ مقرر کریں" |
| LOW | `hubshell.hm_streak…`/`hubmascot.streak` | "سلسلہ" vs "لگاتار" | ok but two words | keep "لگاتار {n} دن" for kid copy |
| LOW | `hubshell.hm_ctaStartingKid`, mascot | "آپ" to children, masculine mascot ("دکھاتا ہوں") | acceptable (respectful) but stiff for 6-year-olds | consider "تم/آؤ" for KS1 band |
| LOW | `hublive.bTk_starBadge…` | "بیج" for badge | reads as "seed" | "تمغہ" |
| LOW | `hubshell.hm_quietFor…` | "خاموش" | ok | – |

## PANJABI (pa, Gurmukhi) — Grade B-

Overall: correct Gurmukhi (no Shahmukhi), good kid tone ("ਕਮਾਲ!", "ਸ਼ਾਬਾਸ਼!"), correct mathematical terms (ਢਲਾਨ, ਧੁਰਾ, ਭਿੰਨ). Systemic issues: postposition spelling, ਕਵਿਜ਼/ਕੁਇਜ਼, topic/subject collision, mis-transliteration of Key stage.

| Sev | Key | Current | Problem | Fix |
| --- | --- | --- | --- | --- |
| HIGH | `hubshell.k_keyStage` | "**ਕੀ** ਸਟੇਜ" | "ਕੀ" = "what"; mis-transliteration of "key" | "ਸਿੱਖਿਆ ਦਾ ਪੜਾਅ" (as in `hubtoolsb.tp_keyStage`) |
| HIGH | `hubfam.pgTutorEmptyBody/Diag` | "ਵਿਸ਼ਾ-ਵਸਤੂ ਦਰ ਵਿਸ਼ਾ-ਵਸਤੂ ਇੱਕ ਪੱਟੀ … ਨਾਲ ਇੱਕ ਦਿਓ" | last clause unintelligible ("with [button] give one"); "ਵਿਸ਼ਾ-ਵਸਤੂ" = content, not topic | "ਹਰ ਵਿਸ਼ੇ-ਭਾਗ ਲਈ ਇੱਕ ਪੱਟੀ ਭਰੇਗੀ। … <b>ਬੱਚਿਆਂ ਲਈ ਦਿਓ</b> ਵਰਤ ਕੇ {first} ਨੂੰ ਇੱਕ ਕੁਇਜ਼ ਦਿਓ।" |
| HIGH | topic vs subject | "ਵਿਸ਼ਾ" is used for **subject** (`hm_swipe` "ਹੋਰ ਵਿਸ਼ਿਆਂ") AND **topic** (`hm_basedOn`, `asNoForTopicKid`); "ਟਾਪਿਕ" (`k_newTopicName`, `k_tutorNoTopics`), "ਵਿਸ਼ੇ-ਭਾਗ" (`qzAbNoQsTopics`), "ਵਿਸ਼ਾ-ਵਸਤੂ" also used | four words, one collision | subject = **ਵਿਸ਼ਾ**, topic = **ਟਾਪਿਕ/ਉਪ-ਵਿਸ਼ਾ** — pick one and apply |
| MED | ~100 keys | "ਉਸਦੀ / ਇਸਦਾ / ਇਸਨੂੰ / ਉਸਨੂੰ / ਇਹਨਾਂ" | postposition written joined; standard is separated: "ਉਸ ਦੀ, ਇਸ ਦਾ, ਇਸ ਨੂੰ, ਉਸ ਨੂੰ, ਇਨ੍ਹਾਂ" (and the catalogue also uses ਇਨ੍ਹਾਂ/ਉਨ੍ਹਾਂ elsewhere) | global find/replace |
| MED | 23 keys | "ਕਵਿਜ਼" (e.g. `st_tileQuiz`, `st_yearHelp`, `dErrStartQuiz`) vs "ਕੁਇਜ਼" (235 keys) | two spellings of the core word | use **ਕੁਇਜ਼** |
| MED | 36 vs 6 | "ਫਲੈਸ਼ਕਾਰਡ" vs "ਫ਼ਲੈਸ਼ਕਾਰਡ" | nukta inconsistent | **ਫਲੈਸ਼ਕਾਰਡ** |
| MED | 26 vs 50 | "ਜਮ੍ਹਾਂ" vs "ਜਮ੍ਹਾ" | inconsistent | **ਜਮ੍ਹਾ** for the verb form used most, or standardise on ਜਮ੍ਹਾਂ |
| MED | `'ਤੇ` vs `ਤੇ` | "ਸ਼ਬਦ 'ਤੇ ਟੈਪ", "ਕਿਸੇ ਸਵਾਲ ਤੇ ਟੈਪ" | apostrophe form and bare form mixed | use "’ਤੇ" consistently (or "ਉੱਤੇ") |
| MED | `hubshell.hm_quietFor_*` | "{n} ਦਿਨਾਂ ਤੋਂ **ਸ਼ਾਂਤ**" | "ਸ਼ਾਂਤ" = calm, not inactive | "{n} ਦਿਨਾਂ ਤੋਂ ਕੋਈ ਸਰਗਰਮੀ ਨਹੀਂ" |
| MED | streak | "ਲੜੀ" (`hm_dayStreak`) vs "ਸਟ੍ਰੀਕ" (`k_calmMode`) vs "ਲਗਾਤਾਰ" (mascot) | three words | "ਲਗਾਤਾਰ {n} ਦਿਨ" |
| LOW | Year groups | "ਸਾਲ ਸਮੂਹ", "ਸਾਲ {n}" vs "ਪੰਜਵੀਂ ਜਮਾਤ" | calque + mixed | "ਸਾਲ {n}" is right for UK Year; "ਜਮਾਤ" implies India/Pakistan class numbers (Year 5 ≠ Class 5) — keep "ਸਾਲ" everywhere |
| LOW | `hubmascot.tour` | "ਮੈਂ ਤੁਹਾਨੂੰ ਦਿਖਾਉਂਦਾ ਹਾਂ" | "Let me show you" is an offer | "ਆਓ, ਮੈਂ ਤੁਹਾਨੂੰ ਘੁੰਮਾ ਕੇ ਦਿਖਾਵਾਂ" |
| LOW | `hubshell.hm_ctaAria`, `hm_greetName` | "{greeting}, {name}।" | fine | – |
| LOW | `hubDigestEmail` `pa.hello` | "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ" | Sikh greeting sent to every Gurmukhi reader (Hindu/Christian Punjabi families exist) | acceptable; consider "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ" only where family faith is known, else "ਨਮਸਤੇ/ਹੈਲੋ" |

## BENGALI (bn) — Grade B-

Overall: readable and well-structured; the tumi/apni split is right in intent (kid = তুমি/করো, tutor/parent = আপনি/করুন). Issues: mis-transliteration, "বার" homograph, digit mix, terminology drift, a chemistry error.

| Sev | Key | Current | Problem | Fix |
| --- | --- | --- | --- | --- |
| HIGH | `hubshell.k_keyStage` | "**কি** স্টেজ" | "কি" = "what/?"; "key" transliterated as a question word | "শিক্ষার স্তর" (as `hubtoolsb.tp_keyStage`) |
| HIGH | `hubtoolsb.sc_eq_shown` | "সমতুল্য করা সমীকরণ" for "balanced equation" | "সমতুল্য" = equivalent, wrong concept | "সমতাকৃত সমীকরণ" ("এই হলো সমীকৃত রাসায়নিক সমীকরণ") |
| HIGH | `hubfam.pgTutorEmptyBody/Diag`, `hublive` bars | "একটি করে **বার** ভরবে", "ফাঁকা বার", "ভগ্নাংশ বার" | "বার" also = day/turn; ur/pa use پٹی/ਪੱਟੀ | "পট্টি"/"স্তম্ভ" ("ভগ্নাংশ পট্টি", "একটি করে পট্টি ভরবে"); keep "অ্যাড্রেস বার" only for browser chrome |
| HIGH | `hublive.cConfirmBody` | "**Learning Hubে** দেখেন" | Latin word + Bengali suffix without hyphen; also renders wrong in some fonts | "Learning Hub-এ" or "লার্নিং হাবে" |
| MED | `hubshell.k_yearN` | "**ইয়ার** {n}" vs `st_yearGroup` "শ্রেণি", `su_yearsTitle` "বছর গ্রুপ" | three terms for Year group; "বছর গ্রুপ" is a calque | "বর্ষ {n}" or "ইয়ার {n}" once + "শ্রেণি" only for generic "class" |
| MED | digits | 104 keys use ০-৯ (`st_yrIntro`, `pcFirst48`, `ruler ৩০`), 130 keys use 0-9 (`su_breakAfterAria`, `sub_type24`) | mixed numerals on one screen, runtime `{n}` is always Latin | use Latin digits throughout for UK use |
| MED | homework | "বাড়ির কাজ" (37: hubshell tabs) vs "হোমওয়ার্ক" (49: hubplan, hubfam, email) | tab label ≠ body text | pick one (বাড়ির কাজ for kids; হোমওয়ার্ক is fine for parents — but be consistent per tab) |
| MED | topic vs subject | "বিষয়" = subject (`hm_swipe`) and topic (`hm_basedOn`); "টপিক" also used | collision | subject = বিষয়, topic = টপিক |
| MED | `hubmascot.caught_up` | "সব শেষ!" | "It's all over/finished" — sounds ominous | "সব কাজ হয়ে গেছে!" |
| MED | `hublessons.pcFirst48` | "সংকীর্ণ করতে টাইপ করুন" | calque of "narrow it down" | "ছোট করে দেখতে টাইপ করুন" |
| MED | `hubtoolsb` eng | "মানবায়ন" (personification) | standard is "মানবীকরণ" | fix |
| MED | `hubtoolsa.title_E_13` | "কবিতা বিশ্লেষক" | poetry scanner = metre scanner | "ছন্দ-বিশ্লেষক" |
| MED | `hubshell.hm_quietFor_*` | "নিষ্ক্রিয়" | clinical/harsh toward a child | "{n} দিন কোনো কাজ নেই" |
| LOW | `hubshell.hm_handInsWaiting` | "{n}টি জমা অপেক্ষায়" | ambiguous | "{n}টি জমা দেওয়া কাজ অপেক্ষায় আছে" |
| LOW | tutor | "টিউটর" in app vs "শিক্ষক" in email | | "টিউটর" everywhere |
| LOW | email `strong` | "সবচেয়ে শক্তিশালী ক্ষেত্র" | calque | "সবচেয়ে ভালো করা বিষয়" |
| LOW | `hublive.ePicAdded` | "চাঁদা" (protractor) | also = "subscription/donation" | "কোণমাপক (চাঁদা)" |

## ARABIC (ar) — Grade B+

Overall: strongest catalogue. Correct MSA, fully vocalised child copy where needed (1,541 strings with tashkeel), UK terms handled well ("الصف", "الصف التمهيدي" = Reception, "المرحلة الدراسية" = key stage), warm kid copy. The big defect is plural machinery; second is verb/term drift.

| Sev | Key | Current | Problem | Fix |
| --- | --- | --- | --- | --- |
| HIGH | A-1: 17 plural groups (`hublessons.tfCardsTotal`, `tfCardsInTopic`, `tfPublishDrafts`, `fcCardsToReview`, `fcMoreScheduled`, `hubfam.pgOfTopics`, `pgOfTopicsPract`, `pgAcrossSubjects`, `pgQuizCount`, `pOverdue`, `kHwWaiting`, …) | only `_one` / `_other` | Arabic needs zero/one/two/few/many/other: `{n}` = 2 shows "2 بطاقات" (should be بطاقتان), 11–99 shows "{n} بطاقات" (should be بطاقة/موضوعًا/مسودة), `pgOfTopics` "{a} من {b} مواضيع" wrong for b ≥ 11 | add `_two` "بطاقتان", `_few` "{n} بطاقات", `_many` "{n} بطاقةً", `_zero` "لا بطاقات"; or use label style ("عدد البطاقات: {n}") as already done in `pOverdue` |
| HIGH | 26 groups | `_zero` missing | n=0 falls to `_other`: "0 طلاب" fine for students but "0 مواعيد" etc. read oddly | add `_zero` "لا …" |
| HIGH | digest `ar.c_streak`, `streak` | "يتعلّم {name} **منذ** {n} أيام متتالية", "{n} أيام متتالية" | "منذ" = "since"; wrong tense; "أيام" wrong for n ≥ 11 | "تعلّم {name} {n} يومًا متتاليًا" via count-aware forms, or "أيام التعلّم المتتالية: {n}" |
| MED | `hubshell.hm_quiet…` | "**خامل** منذ {n} أيام" | "خامل" = lazy/idle; harsh in a parent-facing status about a child | "لا نشاط منذ {n} أيام" |
| MED | tap verbs | انقر (37) / اضغط (54) / المس (few) for the same action | "انقر" = mouse click; kids on tablets | **المس / اضغط** consistently, "انقر" only for mouse-only tools |
| MED | tutor | "المعلّم" (`aVid`, digest, `hubfam`) vs "المدرّس" (`st_tutor…`) | two words | "المعلّم الخصوصي" first time, then "المعلّم" |
| MED | Teaching Hub | "مركز التدريس" (10) vs "مركز التعليم" (6) vs Learning "مركز التعلّم"; email CTA Latin "Learning Hub" | | one form each; translate CTA |
| MED | starting quiz | "اختبار البداية" vs "اختبارات تحديد المستوى" (`lbl_starting_quizzes`) | two names | **اختبار تحديد المستوى** everywhere |
| MED | `hubfam.qzAbDiscardNew` | "تجاهل وابدأ جديدًا" | "Discard" ≠ "تجاهل" (ignore) | "إلغاء المسودة وبدء اختبار جديد" |
| LOW | `hubshell.hm_ctaStartingKid` | "قم باختبار البداية" | stiff | "ابدأ اختبار تحديد المستوى" |
| LOW | tanween | "جزءاً" (`clNa`) vs "جزءًا" (`st_noMatchBody`) | two spelling conventions | prefer ـًا (tanween on the letter before alef) |
| LOW | `hubfam.qzQpWhereQ`, `qzAbChip` | «…» | fine | – |
| LOW | gender | masculine defaults ("أنت قادر", "أنجزت", "حصل") for kids | acceptable MSA; consider "أنت قادر/ـة" only if gender known | – |
| LOW | `pcFirst48` | "عرض أول 48" | missing noun | "عرض أول 48 نتيجة" |

## Cross-language systemic issues

1. **"Key stage" transliterated wrongly in ur/pa/bn** (`hubshell.k_keyStage`): same three-language machine-translation bug; `hubtoolsb.tp_keyStage` is correct in the same catalogues.
2. **Topic vs subject collision** in pa, bn, cy (one word for both concepts). Fix with a glossary.
3. **Hub product names** rendered 3 ways per language; email CTA and `cConfirmBody` leave "Learning Hub" in Latin while the UI transliterates/translates.
4. **"Bar"** = بار/বার/ਬਾਰ homograph in ur/bn/pa; use پٹی / পট্টি / ਪੱਟੀ.
5. **Quiz / flashcard / homework spellings** drift (pa ਕਵਿਜ਼/ਕੁਇਜ਼, ਫਲੈਸ਼/ਫ਼ਲੈਸ਼; bn হোমওয়ার্ক/বাড়ির কাজ).
6. **Placeholders with names** break in Welsh (mutation) and Arabic (ل + Latin name); design labels so a name never follows a mutating preposition.
7. **Plural forms**: Arabic needs full six-form groups (17 groups `_one/_other` only); Welsh is fine for its noun-singular-after-numeral pattern.
8. **UK education terms**: Year N is right in cy/ar/pa/bn "সাল/ইয়ার", but ur uses "سال" and elsewhere "جماعت" (class N) — Year 5 ≠ Class 5 in South Asian systems; keep "Year" vocabulary uniform.
9. **Punctuation**: ur/pa/bn correctly use "۔" / "।"; `{n}%` orders are fine; ar/ur guillemets vs curly quotes mixed.


---

## RTL (ar, ur) layout review

**Status:** browser pass DONE (4/4 passed, 1280 and 390 wide, ar + ur; standing e2e freelancer + parent sessions). 60+ screenshots and `{ar,ur}-*-metrics.json` are in `docs/reviews/shots/i18n-other/`. Screens: tutor Home, Lessons, Students, Homework, Progress, Quizzes, Messages, lesson reader, lesson player (start/learn/words/warm/quiz/done), tools catalogue + floating windows M-02 (protractor/ruler), M-21, H-H02; parent Home/Quizzes/Progress/Flashcards; kid Home/Quizzes. The Homework area was captured but is thin (hubhomework catalog empty). Nothing overflows horizontally (`overflowX` false everywhere); `dir=rtl` is set; sidebar, tab strip, step-progress fills (`ar-tutor-player-quiz.png`) and the header all mirror correctly.

**CORRECTION to R1 below:** the computed body font stack already includes "Noto Naskh Arabic" (ar) and "Noto Nastaliq Urdu" (ur) after Hanken Grotesk, and Arabic/Urdu render cleanly with no tofu in the screenshots (canvas probe widths differ from the notdef width for all five scripts). Only pa/bn remain unverified (no pa/bn pass was requested) — the language-specific stack is worth confirming there. Downgrade R1 to LOW/INFO.

**Confirmed by screenshot**
- C1 (HIGH) `ar-tutor-home.png`: the hero illustration has English text baked into the image ("…ing and …ing Hub", "activities and resources to support teaching", "Today's Learning", "Progress") overlapping the Arabic heading; the image is neither localised nor mirrored.
- C2 (MED) `ar-tutor-player-quiz.png`, `ur-tutor-students.png`, `ur-tutor-lessons.png`: "How it works" button and "Watch: lessons and the curriculum ▶" / "Watch: getting families on your roster ▶" links are hard-coded English (`howitworks/HowItWorksButton.tsx:34`, `HowItWorksPage.tsx:37`) and sit left-aligned in an RTL page.
- C3 (MED) `ar-390-kid-home.png`: intro line reads "دروس وتدريبات من E2E Freelance muhzomxs لـ." — a dangling "لـ" at the end (template ends with "لـ{name}" or similar and the value is on the wrong side; also the trailing full stop lands at the left). Bidi/placeholder bug (see R8).
- C4 (MED) `ar-tutor-students.png`, `ur-tutor-students.png`: enrolment dates show "27 Sept 2026" (en-GB Latin month) inside Arabic/Urdu sentences; and `Year 4` chip stays English in Urdu (`k_yearN` not used there).
- C5 (LOW) Urdu student cards: "پیش رفت ›" chevron points right (not mirrored) while Arabic "عرض التقدم ‹" is correct — inconsistent (R7).
- C6 (INFO) Floating tool window (`ur-tutor-tool-M-02.png`): window, title bar, toolbar and resize grip (bottom-right) look acceptable; the protractor/ruler stay LTR correctly. Title/toolbar order is mirrored. No overlap with the lesson panel seen at 1280.
- C7 (INFO) Sub-tab/pill strips at 390 clip the first/last pill (normal scroll) but `OFFSCREEN` text elements appear in the metrics (`إخفاء`, `الرئيسية`, `اسباق`) — they are horizontally scrolled-out tabs; confirm the active tab scrolls into view in RTL (R10).
- C8 (INFO) Card lists (Students grid, MarkQueue rows) are correctly right-anchored; text in those cards reads right-aligned despite `text-left` (they inherit flex order), so R2 is mostly visible only on multi-line buttons.

Infrastructure that is right: `lib/i18n/provider.tsx:52-55` sets `<html lang dir>` from `isRTL()`; the digest email sets `dir`/`text-align`, uses `<bdi>` for titles and `padding-inline-start` (`hubDigestEmail.ts:412-419,430`), and lists Noto Arabic / Nastaliq / Gurmukhi / Bengali in its font stack.

| # | Sev | Where | Bug (RTL) | Fix |
| --- | --- | --- | --- | --- |
| R1 | LOW (see correction) | `app/layout.tsx:8-16` | Fonts are `Bricolage_Grotesque` / `Hanken_Grotesk` with `subsets: ["latin"]`; there is no fallback for Arabic, Urdu (Nastaliq), Gurmukhi or Bengali, so glyphs come from whatever the OS supplies (on Windows/Android/Linux Urdu shows in Naskh, not Nastaliq; on a bare Linux/CI box Bengali/Gurmukhi can be tofu). No per-locale `font-family`. | Add `:lang(ar){font-family:var(--ff),"Noto Naskh Arabic","Noto Sans Arabic",…}`, `:lang(ur){…"Noto Nastaliq Urdu"…; line-height:2}`, `:lang(pa){…"Noto Sans Gurmukhi"}`, `:lang(bn){…"Noto Sans Bengali"}` (next/font/google subsets `arabic`, `bengali`, `gurmukhi`) and give Nastaliq extra line-height |
| R2 | HIGH | Tailwind `text-left` / `text-right` — 61 `text-left` in `features/learninghub/**` (e.g. `home/TutorHome.tsx:33,181,214`, `home/KidHome.tsx:46`, `home/StudentHome.tsx:163,255,377`, `TopicFilter.tsx:184-421`, `GroupsSection.tsx:79,247`, `quiz/AssessmentList.tsx:233`, `mark/MarkQueue.tsx:52`, `homework/StudentHomework.tsx:86`, `homework/TutorHomework.tsx:191`) | `text-left` is physical `text-align:left`; in RTL every multi-line Arabic/Urdu label inside these buttons/cards is left-aligned (ragged wrong edge). No `[dir=rtl]` override exists anywhere (`grep` of app/components/lib/features finds none). | replace with `text-start` (Tailwind 4) / `text-end`; grep `text-left|text-right` |
| R3 | HIGH | `home/ClassSnapshot.tsx:99` (`sticky left-0 … pr-2 text-left`), `:85` table `text-left` | Sticky first column pins to the LEFT while in RTL the first column is on the RIGHT — the subject/name column scrolls away or overlaps data cells; `pr-2` padding on the wrong side | `sticky start-0 pe-2 text-start` |
| R4 | HIGH | `remotesync/FloatingPanel.tsx:141` (`position:fixed; left:x`), `:148` (`text-left` title), `:174` resize handle `bottom-0 right-0 cursor-nwse-resize`, `⤡` glyph, `HelpTools.tsx:326` "new windows spawn from the lesson card's top-right corner" | Floating tool window: title is left-aligned inside the drag bar; resize handle pinned bottom-right (with dir=rtl the natural resize corner is bottom-left and the "grow" pointer maths `origW + (clientX-startX)` still grows rightwards, which is consistent but feels reversed); spawn logic assumes a LEFT lesson column, in RTL the lesson card is on the right so tool windows spawn over/behind the wrong panel (suspected) | make spawn/anchor direction-aware (`getComputedStyle(document.documentElement).direction`), `text-start` on title, put resize handle at `bottom-0 end-0` and flip the delta sign in RTL |
| R5 | MED | `HelpTools.tsx:511,760,863-866` (`pl-3.5 pr-3`, `mr-2`, `border-l-2 … pl-4`, `absolute -left-[21px]` timeline dot) | Timeline rule/dots and toolbar padding are physical: line stays on the left while text is right-aligned (dot detached from its text in RTL) | `ps-4 border-s-2`, `-start-[21px]`, `me-2` |
| R6 | MED | 124 physical `ml-/mr-/pl-/pr-/left-/right-/border-l/border-r/rounded-l/r` occurrences (worst: `HelpTools.tsx` 26, `TopicFilter.tsx` 16, `lesson/slides/CanvasSlide.tsx` 15, `kit.tsx` 14, `StudentsPanel.tsx` 10, `live/board/BoardUi.tsx` 10) vs only 19 `rtl:` variants in the whole hub | icon-then-label gaps, avatar spacing, badge corners and card accents land on the wrong side | codemod to logical utilities (`ms/me/ps/pe/start/end/border-s/e/rounded-s/e`) |
| R7 | MED | Text arrows/chevrons not mirrored: `TopicFilter.tsx:413` "subject › topic" breadcrumb, `TopicPicker.tsx:14` `join(" › ")`, `quiz/AssessmentList.tsx:229` (`" →"`) and `:320` (`→` after "to mark"), `students/YearReminderCard.tsx:168-171` (`{from} → {to}` year moves), `howitworks/HowItWorksPage.tsx:37` "← All videos", `howitworks/HowItWorksHost.tsx:73-75`/`HowItWorksButton.tsx:34` "▶" play glyphs, `remotesync/NumberLineTool.tsx:330` `a→b` jumps. (Already done correctly: `shared-assess/TakeAssessment.tsx:300-302` and `lesson/builder/SlideBuilder.tsx:328-329` use `rtl:rotate-180` / `rtl:-scale-x-100`.) | "Back" arrows point the wrong way; breadcrumbs/progressions read backwards in RTL. NOT a bug: `tools/science/equations/EquationBalancer.tsx:86` reaction arrow → (chemistry stays LTR — but the whole equation should be wrapped in `dir="ltr"`). | wrap in `<span className="inline-block rtl:rotate-180">`; for text separators use `‏`-aware `‹`/`›` swap or an SVG chevron with `rtl:-scale-x-100`; put chemical/maths expressions in `<bdi dir="ltr">` |
| R8 | MED | Bidi with `{placeholders}` / Latin in Arabic+Urdu strings: `hubtoolsb.lang_shortcuts` (`e' → é · a\` → à …` in an RTL sentence), `hubfam.qzQpWhereQ` (`{step} — «{q}»`), `hublive.eBarTip` (`Alt + ٹیپ`), `hubfam.pgValKid`, names after "لـ" (`hubplan.sub_child` "لـ {name}") and the digest `ar.why` "لـ{name}", `hublive.cConfirmBody` "Learning Hub" | Punctuation (`،` `.` `:` `?`) that follows a Latin run in an RTL sentence can visually jump to the wrong end; two adjacent LTR runs separated by neutral `·`/`→` reorder unpredictably; numerals next to `%` show as `%50` | wrap dynamic/Latin values in `<bdi>` (the email does this; the app rarely does) or emit `\u2068{name}\u2069` (FSI/PDI) inside message templates; keep `{n}%` unspaced in one `dir="ltr"` span |
| R9 | MED | Progress bars / meters | `ProgressBar` fill should anchor to the inline-start (right in RTL). Not verifiable without the run; the metrics JSON records `fillAlign` per bar. Mark `homework/MarkDialog.tsx:231` uses `text-right` for the score under the bar (physical). | use `transform-origin`/`margin-inline-start:0` or `flex` without physical `left`; `text-end` |
| R10 | MED | Tab strip / carousels (`HubTabs.tsx`, `SubMenuCard.tsx`, subject carousel with `hm_swipe`) | If they use `overflow-x:auto` + `scrollLeft`, RTL scroll origin differs per browser (negative scrollLeft) and "active tab into view" calls can scroll the wrong way (suspected; verify `scrollTo`/`scrollIntoView` in `HubTabs.tsx`) | use `scrollIntoView({inline:"nearest"})`, avoid absolute `scrollLeft` |
| R11 | LOW | Tables `w-full text-left` (`home/RhythmChart.tsx:55`, `homework/hwResults.tsx:96`, `progress/TrendChart.tsx:132`, `ClassSnapshot.tsx:85`) | headers left-aligned in RTL; numeric columns misaligned | `text-start` on th, `text-end` on numeric cells |
| R12 | LOW | Text-in-canvas tools/`CanvasSlide.tsx` (15 physical offsets), maths/number-line tools | maths tools are LTR by nature (number line, coordinate grid, ruler, protractor) — they should keep `dir="ltr"` on their canvas so they do not mirror, while their surrounding chrome does | add `dir="ltr"` to tool canvases only |
| R13 | LOW | `hubDigestEmail.ts` `ar.streak/c_streak`, `fmtDate(...)` with `loc` "ar" | `Intl.DateTimeFormat("ar")` yields Arabic-Indic digits while `{pct}`/`{n}` in the same email are Western digits: mixed numerals in one message | pass `"ar-u-nu-latn"` (and `"ur-u-nu-latn"`) to Intl |

Fonts/tofu: the canvas probe in the spec compares measured widths of Arabic/Urdu/Gurmukhi/Bengali samples against U+FFFF advance; results land in each metrics JSON under `tofu`. From source, the app font stack (R1) cannot render any of these scripts by itself; Playwright's Chromium on macOS falls back to system fonts, so a pass there does not prove correctness on Windows/Android/Linux family devices.

---

## Top 20 fixes (ordered by impact per effort)

1. **ar plural groups**: add `_zero/_two/_few/_many` to the 17 `_one/_other`-only groups (`tfCardsTotal`, `tfCardsInTopic`, `tfPublishDrafts`, `fcCardsToReview`, `fcMoreScheduled`, `pgOfTopics`, `pgOfTopicsPract`, `pgAcrossSubjects`, `pgQuizCount`, …) or switch them to label style; add `_zero` to the 26 groups that lack it.
2. **ur/pa/bn `hubshell.k_keyStage`** ("کی اسٹیج" / "ਕੀ ਸਟੇਜ" / "কি স্টেজ") → copy the correct `hubtoolsb.tp_keyStage` values (مرحلۂ تعلیم / ਸਿੱਖਿਆ ਦਾ ਪੜਾਅ / শিক্ষার স্তর).
3. **App fonts** (`app/layout.tsx`): load Arabic/Bengali/Gurmukhi subsets and per-`:lang` stacks incl. Nastaliq for Urdu (R1).
4. **Replace Tailwind `text-left`/`text-right` with `text-start`/`text-end`** across `features/learninghub` (R2, R11).
5. **`ClassSnapshot.tsx:99` sticky column** → `start-0` (R3).
6. **FloatingPanel/HelpTools** direction-aware spawn, title alignment, resize handle (R4, R5).
7. **Codemod physical margin/padding/border utilities to logical ones** in the six worst files (R6).
8. **Mirror text arrows and chevrons** (R7): AssessmentList, YearReminderCard, TopicFilter breadcrumb, HowItWorks back/play, NumberLine; keep chemistry LTR.
9. **cy `hublive.ePicAdded`** "onfedd" → "onglydd"; **ur** "چاند" → "چاندہ"; **bn** "চাঁদা" → "কোণমাপক (চাঁদা)".
10. **cy digest subject** "Yr wythnos hon yn nysgu {name}" → "Dysgu {name} yr wythnos hon".
11. **ur/pa/bn "bar" homograph** in `hubfam.pgTutorEmptyBody/Diag`, `hublive` bars: پٹی / ਪੱਟੀ / পট্টি, and rewrite the unintelligible last clause in all three.
12. **bn `hubtoolsb.sc_eq_shown`** "সমতুল্য করা সমীকরণ" → "সমতাকৃত (সমীকৃত) সমীকরণ".
13. **ur `hubfam.qzAbUnsavedQ`** "غیر محفوظ" → "محفوظ نہیں کی گئیں"; **ur `su_yearsTitle`** "سالانہ جماعتیں" → "سال/جماعت کے گروپ".
14. **Glossary + sweep for topic vs subject** (pa ਵਿਸ਼ਾ/ਟਾਪਿਕ/ਵਿਸ਼ੇ-ਭਾਗ/ਵਿਸ਼ਾ-ਵਸਤੂ, bn বিষয়/টপিক, cy pwnc/testun) and for the **Hub product names** (ur/pa/bn/cy/ar each render Teaching/Learning Hub 2-3 ways; email CTA and `hublive.cConfirmBody` still say "Learning Hub" in Latin; bn "Learning Hubে" → "Learning Hub-এ").
15. **cy terminology/register**: "cwis cychwynnol" (not "cwis dechrau"), one word for student (disgybl), one register ("ti") for kid copy, fix `hm_startingHint` syntax, "Methwyd â chofrestru".
16. **cy `{name}` after mutating prepositions** (25 keys `st_setHwFor`, `st_setNewQuiz`, `st_messageName`…): reword to avoid "i/at {name}" (use "ar gyfer" or a label form); remove male-only "ei deulu"/"a'i weithgarwch".
17. **pa spelling sweep**: ਕਵਿਜ਼→ਕੁਇਜ਼ (23), ਫ਼ਲੈਸ਼→ਫਲੈਸ਼ (6), separate postpositions (ਇਸ ਦਾ/ਉਸ ਦੀ/ਇਸ ਨੂੰ, ~100 keys), `'ਤੇ` vs `ਤੇ`, ਜਮ੍ਹਾ/ਜਮ੍ਹਾਂ.
18. **bn digits + homework term**: one numeral system (Latin recommended) — 104 keys use ০-৯; "বাড়ির কাজ" vs "হোমওয়ার্ক"; also "সব শেষ!" → "সব কাজ হয়ে গেছে!", "মানবায়ন" → "মানবীকরণ", "টিউটর" vs "শিক্ষক".
19. **ar verb/term drift**: tap verb (المس/اضغط, not انقر), tutor (المعلّم vs المدرّس), starting quiz name (اختبار تحديد المستوى), Teaching Hub (مركز التدريس vs التعليم), "خامل" → "لا نشاط", `qzAbDiscardNew` "تجاهل" → "إلغاء المسودة", digest streak "منذ".
20. **Bidi hygiene in message templates**: wrap `{name}`/Latin/`{n}%` in `<bdi>` or FSI/PDI, use `ar-u-nu-latn` in the digest date formatter, and add a Playwright RTL guard (page overflow-x, `text-align:left` count, arrow transform check) — the queued `zz-critic-rtl.spec.ts` metrics collector is a starting point.

## Grades

| Language | Grade | One-line verdict |
| --- | --- | --- |
| Welsh | B | Idiomatic and mostly correct; fix terminology drift, register mixing, placeholder mutation and 3 real errors (onfedd, digest subject, hm_startingHint). |
| Urdu | B- | Good vocabulary, but "کی اسٹیج", "بار", "غیر محفوظ", "سالانہ جماعتیں" are misleading and there is no Nastaliq font. |
| Panjabi | B- | Correct Gurmukhi; systemic spelling drift, topic/subject collision and mis-transliterated Key stage. |
| Bengali | B- | Readable and register-aware; several term errors, "বার" homograph, mixed digits. |
| Arabic | B+ | Best catalogue (vocalised, good UK terms); needs plural-group completion and term consistency. |
