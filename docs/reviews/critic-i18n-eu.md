# Translation critic: Hub i18n for pl / ro / pt / es / fr

Scope: `lib/i18n/messages/areas/{hubshell,hublessons,hubtoolsa,hubtoolsb,hubfam,hublive,hubplan,hubmascot}.ts` (+ parts, `hublive_a-e`) and `server/src/lib/hubDigestEmail.ts` (pl/ro/pt/es/fr blocks). `hubhomework.ts` and `hubhow.ts` are EMPTY in every locale (nothing to review; nothing is translated there).
Method: all 6,189 EN keys were loaded programmatically for each language. Mechanics were checked on all keys. About 400 keys per language were read side by side (all tabs and labels, kid Home, hubfam kid/parent/assessment copy, marks and score phrases, plurals, digest email, and random samples of hublive, hublessons, hubtools and hubplan).

## Mechanics (automated, all 6,189 keys x 5 languages)
- Placeholders: intact everywhere (0 mismatches). HTML/markup tags: intact (0). Leading/trailing-space fragments (`invNoKidsA/B`, `st_partialSaved`, `qzAutoMarked`): preserved. No missing keys. No untranslated English (only proper nouns/loanwords such as Start, Tutor, Normal, Indigo, Emoji).
- Plural runtime (`features/learninghub/family/hubT.ts`) uses `Intl.PluralRules(locale)` and falls back to `_other`. Consequences:
  - **Romanian has NO `many` category in CLDR** (1=one; 0 and 2-19 = few; 20+ = other). In `hubshell` the correct "de" form ("20 de elevi") was put under `_many`, which is never selected, so 20+ renders WITHOUT "de" (grammatically wrong). Details in ro findings.
  - Polish has one/few/many/other, and the prefix-style keys (hubshell.hm_*) are done correctly. But 5 keys are `one/other` only (see pl).
  - pt/es/fr carry `few/many/two` variants that are harmless dead weight (`many` only fires for 1,000,000+).

---

## POLISH — Grade A-
Warm, natural, idiomatic; the best of the five. Kid copy is properly informal ("ty", lowercase "ciebie/twoja"). The parent/tutor register uses capitalised "Twój/Ci" (polite-written, consistent). Plurals in hubshell are fully done (one/few/many).

Systematic issues
1. **Tutor has two words**: "korepetytor" (hubshell/hublive/hublessons, 47x) vs "nauczyciel" (hubfam/digest, 44x). A parent sees both for the same person.
2. **Homework has two words**: "praca domowa" (46x, hubshell) vs "zadanie domowe" (12x, tab `lbl_homework` and hubfam). "Zadanie domowe" is the standard school term; pick one (recommend zadanie domowe).
3. **Name declension**: `{name}` is never declined. The team mostly dodged it with colons (good), but a few remain wrong.
4. **"Year group"** is rendered as "klasa" (65x) AND "grupa wiekowa" (15x). "Klasa 5" in Poland means age 11 (UK Year 7) - risk of confusion for parents; consider "Year 5" kept in English or "rok" plus a note.
5. Some `one/other`-only plural keys: n=2-4 wrong.

| Sev | Key | Current | Problem | Fix |
|---|---|---|---|---|
| High | hublessons.fcCardsToReview_other (also `_few/_many` missing) | "kart do powtórki" | n=2-4 needs "karty", n=5+ "kart"; only one/other exist | add `_few` "karty do powtórki", `_many` "kart do powtórki" |
| High | hublessons.fcMoreScheduled, tfCardsInTopic, tfCardsTotal, tfPublishDrafts | one/other only, e.g. "Fiszek w tym temacie: {n}" | invariant "Fiszek: {n}" form dodges the issue and is OK, but `fcCardsToReview` and tfPublishDrafts ("Opublikuj wersje robocze: {n}") are stilted | acceptable; add few/many where a noun follows {n} |
| High | hubtoolsb.lang_endExpl | "w wzorcu" | wrong preposition form | "we wzorcu" |
| Med | hublessons.scTitle | "Album naklejek {name} — klasa {year}" | bare nominative name after a genitive noun | "Album naklejek — {name}, klasa {year}" |
| Med | hublessons.rgCoverage | "Pokrycie podstawy programowej" | calque, and "podstawa programowa" = the POLISH core curriculum, not England's National Curriculum | "Realizacja National Curriculum (Anglia)" |
| Med | hubfam.bandDeveloping | "Idzie mi coraz lepiej" (21 chars) | long for a chip; ok in meaning | "Coraz lepiej" |
| Med | hubshell.lbl_inbox | "Odebrane" | email-ish ("received"); this is a hand-ins inbox | "Oddane prace" |
| Med | hubmascot.streak, hubshell.hm_dayStreak, digest c_streak | "{n} dni z rzędu" / "Seria: {n} dni" | n=1 gives "1 dni" (no plural keys) | add `_one` "{n} dzień" |
| Med | hubshell.hm_nudgeAriaHw | "Zadaj mu/jej pracę domową" | slash-gender in an aria label | "Zadaj pracę domową: {name}" |
| Med | hubfam.qzWaiveModalBody | "będzie mógł... nie będzie miał" | assumes male | "uczeń/uczennica" or rephrase impersonally |
| Low | hubfam.pNoResults | "Pierwszy wynik quizu — {first} — pojawi się tutaj." | stilted | "Tutaj pojawi się pierwszy wynik quizu ({first})." |
| Low | hubfam.invJoin | "Dołącz do: {provider} w Centrum Nauki" | colon is awkward | "Dołącz w Centrum Nauki: {provider}" |
| Low | hubtoolsb.sc_fc_showIn | "Pokaż wynik w" | source says "answer" | "Pokaż odpowiedź w" |
| Low | hublive.dShade | "Zaznacz" | shading a fraction = colouring in | "Zamaluj" |
| Low | hubtoolsb.lang_polHint_lenient | "Przyjęte po cichu" | calque of "accepted quietly" | "Przyjmowane bez uwag" |
| Low | hubfam.qzQbLoadingList | "Wczytuję pytania" | first person, rest are noun forms | "Wczytywanie pytań" |
| Low | hubfam.tabX vs hublive | "kartę <b>Quizy</b>" vs "zakładce Quizy" | "karta" also = worksheet (karta pracy) | "zakładkę" everywhere |

Digest email (pl): correct, warm, good subject line. Nits: uses English "Learning Hub" in the button (the app says "Centrum nauki"); "{name}" in accusative/dative slots ("Miło było zobaczyć {name}", "Praca domowa {name}") is undeclined - rewrite as "Miło nam było widzieć na lekcji: {name}" and "Praca domowa ucznia: {name}".

---

## ROMANIAN — Grade B
Fluent and friendly, tu-form throughout (fine for a parent-child app). Real problems are the plural rule, one wrong key term, and three competing words for quiz and flashcard.

Systematic issues
1. **Plural bug (functional)**: CLDR ro = one/few/other. 26 keys hold the "de" form in `_many` (dead) and a bare form in `_other` (used for 20+): e.g. `hubshell.hm_handIns_other` "{n} predări" -> for 25 shows "25 predări" (must be "25 de predări"). Same for `hm_things, hm_quietFor, hm_moreStudents, hm_moreSubjects, hm_hwDueSoon, hm_cardsReady, hm_cardsToReview, hm_quizzesDone, hm_hwHandedIn, hm_activeIn2, hm_nQuestions, hm_daysAgo ("acum 20 zile"), hm_nStudents, hm_nLessons, hm_nSubjects, studentsCount, hublessons.tfCardsInTopic/Total/PublishDrafts, hubfam.qzQuestions/qzMarks/qzAttempts/qzStudents` (the last four also lack any "de"), plus `hubmascot.streak` ("20 zile la rând"). `hubfam.as*` keys already do it right (`_other` "{n} de zile"). **Fix: copy each `_many` string into `_other`.** Also `hm_dayStreak`/`Serie de {n} zile`: n=1 gives "1 zile".
2. **"Tutore" is wrong**: in Romanian *tutore* = legal guardian (67 occurrences: `hm_tutor` "Tutore", `hm_yourTutor` "tutorele tău", `hublive.aTeach_offer`, `hubshell.st_*`). Meanwhile hubfam uses "profesor" (39x). Use "profesor particular" (short: "profesor") or "meditator" everywhere.
3. **"Card/carduri" for flashcards** (49x, e.g. `hm_kidCards` "Joacă-te cu cardurile"): to a Romanian ear "card" = bank card. Also flashcards are "Flashcard-uri" (hm), "Flashcarduri" (lbl), "Cartonașe" (hublessons) - three names. Standardise on **cartonașe** ("Cartonașe de învățat").
4. **Quiz has three names**: "Chestionare" (tab `lbl_quizzes`, `lbl_new_quiz`, digest), "Test/Teste" (311x) and "Test de start" vs "Test inițial". "Chestionar" = survey; the tab is called Chestionare but body text says "fila Teste" (`hubfam.pgTutorEmptyBody`, `hublive.aQz_noneBody`) - a user cannot find the tab. Use **Teste** (or "Chestionar" nowhere).
5. **Hub/Centru**: "Hub de învățare" / "Hubul de predare" (hubshell) vs "Centrul de învățare" (hubfam, `k_theHub` "Centrul de predare"). Pick one ("Centrul de învățare" reads better).
6. Homework: "Teme" everywhere but the tab is "Teme pentru acasă"; ok but longest tab in the row.

| Sev | Key | Current | Problem | Fix |
|---|---|---|---|---|
| High | hubshell.hm_tutor / hm_yourTutor / hm_yourTutorCap | "Tutore" / "tutorele tău" | legal guardian | "Profesor" / "profesorul tău" |
| High | hubshell.hm_kidCards | "Joacă-te cu cardurile" | bank-card connotation | "Joacă-te cu cartonașele" |
| High | hubshell.lbl_quizzes, lbl_new_quiz | "Chestionare", "Chestionar nou" | survey, and not what other strings call it | "Teste", "Test nou" |
| High | hubshell.k_cantOpen | "Nu poate deschide asta" | missing subject | "Nu se poate deschide" |
| Med | hubfam.kWaitingSince | "Te așteaptă din {day}" | "din" wrong preposition | "Te așteaptă de {day}" (or "din {day}" only with a date) |
| Med | hubshell.hm_activeOn7 | "Activ în {n} din ultimele 7 zile" | assumes masculine | "{n} zile active din ultimele 7" |
| Med | hubfam.fmHandHint | "să lucreze singur" | masculine default | "să lucreze de unul singur/una singură" or "să lucreze independent" |
| Med | hubtoolsa/hubfam year strings | "Grupă de clasă nouă" (`qzYgNew`) | odd | "Clasă nouă" |
| Med | hubfam.pgTutorEmptyBody | "fila <b>Teste</b>" vs tab "Chestionare" | tab name mismatch | rename tab (see above) |
| Low | hubshell.k_col_indigo etc. | "Indigo", "Normal" | fine | - |
| Low | hublessons.bkGotIt | "Ai înțeles!" vs hubfam.bandSecure "Am înțeles!" | person/tense drift | align |

Digest: warm, fine. "Chestionare finalizate" should be "Teste terminate" (and "Efort excelent" -> "Bravo pentru efort"). "Cel mai puternic domeniu" -> "Domeniul la care stă cel mai bine". Uses "Vă/dumneavoastră" for the parent in the email but "tu" for the same parent in the app: pick one (email formal is fine; app tu is fine for UX, but note the switch).

---

## PORTUGUESE (European) — Grade B-
Clearly aimed at pt-PT (ecrã, separador, "a carregar", "trabalho de casa", "caderneta de cromos" - lovely). But it drifts to Brazilian in one block, and the register is inconsistent.

Systematic issues
1. **Brazilian Portuguese leaks in `hubshell.st_*` (student/roster section)**: "Salvar", "Salvando…", "Não foi possível salvar o aluno/grupo", "salvas", "confira", "você" (~15x), "lições de casa" (4x), "gerentes", "conectado", "Passe alguma". EP: "Guardar", "A guardar…", "guardadas", "verifique", drop "você" (use the verb form or "o seu"), "trabalhos de casa", "gestores", "com sessão iniciada". Also `hublive` uses "Você" as a standalone label (`aPanel_you`, `dYou`) and "meça na sua própria tela" (`eRulerNote`) -> "no seu próprio ecrã".
2. **Register split inside child-facing copy**: kid copy (hubfam.k*, hublessons, hubmascot, hubtoolsa/b) uses tu ("Tenta outra vez", "Volta quando estiveres pronto"), but the entire child assessment flow `hubfam.as*` (72 strings: "Já pode tentar novamente. Tente outra vez.", "Reveja a lição", "Precisa de {n}% para passar", "O seu tutor...") is formal você. A 7-year-old is told "Precisa de 60% para passar". Note it also assumes masculine "pronto". Use tu (or neutral) throughout `as*` where addressed to the student, keep formal only for parent-addressed lines (`asBaselineParent`, `asChooseChild`).
3. **Quiz = "questionário"** (208x; tab, buttons, kid "Experimenta um questionário") vs "quiz" (39x) vs "teste" (85x) - and the tab body text says "separador **Quizzes**" (`hubfam.pgTutorEmptyBody`) while the tab is "Questionários". A questionário is a survey/form; for children use **Quiz**. Since "quiz" is already used in half the app, make it the single term (tab: "Quizzes"; kid: "Faz um quiz").
4. **Marks = "notas"** in some keys (`qzMqSaveFail`, `qzMqMarksOutOf` "Notas (em {max})") but "pontos" elsewhere ("{n} pontos", "Pontos: {got} / {max}"). UK "marks" = pontos.
5. **Aulas ao vivo (42x) vs em direto (14x)**; pick "ao vivo" (or "em direto" for EP). "Tópico" (70x) vs "tema" (48x) in the same screens (`hubplan.chip_weak` "Tópico fraco" vs hubfam "Temas experimentados").
6. Year group: "ano de escolaridade" / "ano escolar" / "anos" three ways; enrol: "Matricular" (lbl_enrol) vs "Inscrever/Inscrito" (hubfam).
7. Masculine defaults: "Adicione o seu filho" (-> "a sua criança"/"o seu filho ou a sua filha"), "Quer que trabalhe sozinho?" ("sozinho/a"), "Obrigado" in digest -> "Agradecemos".

| Sev | Key | Current | Problem | Fix |
|---|---|---|---|---|
| High | hubshell.st_saveFail / st_save / st_saving / st_groupSaveFail / st_saveGroup | "Não foi possível salvar o aluno", "Salvar", "Salvando…" | Brazilian | "Não foi possível guardar o aluno", "Guardar", "A guardar…" |
| High | hubshell.st_partialSaved | "...podem ter sido salvas; confira os detalhes e tente de novo." | BR | "...podem ter sido guardadas; verifique os detalhes e tente de novo." |
| High | hubshell.st_ariaNoHw | "Nenhuma lição de casa para {name} ainda — passe alguma" | BR term | "Ainda não há trabalhos de casa para {name} — atribua um" |
| High | hubfam.asBlockedNow / asBlockedBreakDone | "Já pode tentar novamente. Tente outra vez." | formal to a child | "Já podes tentar outra vez." |
| High | hubfam.asBlurbNeed | "Precisa de {n}% para passar. Tente outra vez quando estiver pronto." | formal, masculine, cold | "Precisas de {n}% para passar. Tenta outra vez quando quiseres." |
| High | hubshell.hm_quiz / lbl_quizzes / hm_kidQuiz | "Questionário" / "Experimenta um questionário" | survey feel | "Quiz" / "Experimenta um quiz" |
| Med | hubshell.st_yearGroup etc. | "Ano escolar" vs "Ano de escolaridade" | inconsistent | one term |
| Med | hubfam.qzMqMarksOutOf | "Notas (em {max})" | grades, not marks | "Pontos (em {max})" |
| Med | hubfam.qzMqSaveFail | "guardar as notas" | same | "guardar os pontos" |
| Med | hubfam.pHowDoing / tabDash / lbl_how_i_m_doing | "Como está a correr" / "Como estou a ir" | second is a calque | "Como me está a correr" or "O meu progresso" |
| Med | hublive.cFollowUp | "Trabalho de casa de seguimento" | calque | "Trabalho de casa de continuação" |
| Med | hubshell.k_cantOpen | "Não consegue abrir isto" | missing subject | "Não é possível abrir isto" |
| Med | hublive.aPanel_you / dYou / eRulerNote | "Você", "tela" | BR | "Tu/Você" -> "Eu"/"Tu" per context; "ecrã" |
| Low | digest c_streak | "{name} tem aprendido há {n} dias seguidos" | calque | "{name} estuda há {n} dias seguidos" |
| Low | digest due / up | "Para: {date}", "Próximos passos" | ambiguous | "Entrega até {date}", "A seguir" |
| Low | hublessons.bkGotIt | "Conseguiste!" | means "You did it" | "Percebi!" |

Digest: mostly good EP ("Corrigido", "ligação", "Com os melhores cumprimentos"); fix "Questionários" -> "Quizzes", "Obrigado" -> "Agradecemos", and "Recebe" (ambiguous tu/você) -> "Recebe este e-mail" is acceptable, keep.

---

## SPANISH — Grade B+
Accurate, natural, warm; consistently tu (fine for parents and kids). Kid copy is charming ("¡Lo tengo!", "¡Vaya!"). Problems are terminology drift, not grammar.

Systematic issues
1. **Homework has two words**: "Deberes" (51x: hubshell hm/st, digest) vs "Tarea(s)" (50x: tab `lbl_homework` "Tareas", `lbl_set_homework` "Poner tarea", `kHwWaiting`, `pOverdue`, `vCouldnt`, `su_learninghubHint`). "Deberes" (Spain) is more natural for a UK/Spain audience but LatAm families say "tareas". Pick one (recommend Deberes for tab, buttons, kid copy; or Tareas throughout) - currently the tab says Tareas and the Home card says Deberes.
2. **Quiz has three names**: "Cuestionario" (210x, tab and buttons) vs "quiz" (39x, `pgTutorEmptyBody` even says "pestaña <b>Quizzes</b>" while the tab is "Cuestionarios") vs "Prueba" (107x: "Prueba inicial", "Prueba de nivel"). "Cuestionario" is a survey/form and cold for kids. Recommend **Quiz** for kid/tab, **Prueba inicial** ok for the starting quiz; but hubshell says "Cuestionario inicial" while hubfam says "Prueba inicial".
3. **Student**: "Alumno" (228x) vs "Estudiante" (17x, incl. tab `lbl_students`, `lbl_enrol_a_student`).
4. Flashcards: "Tarjetas de memoria" (lbl) vs "Tarjetas de estudio" (hm) vs "Tarjetas" (fca).
5. Try again: "Volver a intentar" / "Intentar de nuevo" / "Inténtalo de nuevo" (buttons differ by file).
6. Spain-isms (vale, vídeo, "podéis" x2 = vosotros in `hublessons.npOneRoomBody`, `hublive.aStage_endBody`) while everything else is tu/usted-neutral; for UK LatAm families use "pueden".
7. `Aprobado` for Passed and "Nota de aprobado %"/"Nota para aprobar %" are inconsistent.

| Sev | Key | Current | Problem | Fix |
|---|---|---|---|---|
| High | hubshell.lbl_homework vs hm_homework | "Tareas" vs "Deberes" | two terms for the main tab/card | one term |
| High | hubshell.lbl_quizzes, hm_quiz, hm_kidQuiz | "Cuestionarios", "Prueba un cuestionario" | survey, cold to a child | "Quiz", "Prueba un quiz" |
| High | hubfam.pgTutorEmptyBody, hublive.aQz_noneBody | "pestaña <b>Quizzes</b>" vs tab "Cuestionarios" | tab name mismatch | align |
| Med | hubshell.k_cantOpen | "No puede abrir esto" | missing subject | "No se puede abrir esto" |
| Med | hubshell.lbl_students | "Estudiantes" | vs "Alumnos" everywhere | "Alumnos" |
| Med | hubshell.hm_tutor* | "Tutor" | fine but "tutor/tutora" gender | keep "Tutor" (loan) |
| Med | hubfam.kHwWaiting_one | "{n} tarea te está esperando" | "Tienes {n} deberes esperándote" more natural | "Tienes {n} deberes por hacer" |
| Med | hubfam.asMissedGap | "Sacaste {pct}%" | ok, slightly LatAm/colloquial | "Has sacado un {pct}%" |
| Low | hubshell.hm_activeOn7 (fr sibling) | fine | - | - |
| Low | hublive.aStage_endBody | "podéis volver a entrar" | vosotros | "pueden volver a entrar" |
| Low | hubshell.hm_allClear / hm_allCaughtUp | both "Todo al día" | identical, no nuance | ok |
| Low | hubfam.pgTutorEmptyBody | "<b>Asignar a niños</b>" | UI says "Set for children" | fine |

Digest: excellent tone. "Cuestionarios completados" -> "Quizzes completados"; "Deberes" ok. "Hola:" vs "Hola," fine.

---

## FRENCH — Grade B+
Accurate, elegant, correct typography (narrow spaces before ! ? : ; %, guillemets with spaces). Kid copy uses tu ("Essaie encore", "Ça t'attend"); tutor copy vous.

Systematic issues
1. **Register split inside child-facing assessment copy**: `hubfam.as*` is 57 vous vs 38 tu, including the SAME screen: asMissedGap "Tu as obtenu {pct} %" but asBlockedNow "Vous pouvez réessayer maintenant. Veuillez recommencer." and asBlurbNeed "Il faut {n} % pour réussir. Réessayez quand vous serez prêt." The kid should get tu everywhere in `as*` where the student is addressed; keep vous only for `asBaselineParent` and parent-addressed lines. (Also "prêt" is masculine.)
2. **"Tuteur"** (100x) has a legal-guardian reading in French ("tuteur légal"), a real risk in a parents-and-children product. Prefer "professeur particulier" (short: "professeur") or "répétiteur"; at minimum avoid it in the parent-facing invite line ("Votre tuteur a invité...").
3. **Hub name drifts**: "Espace enseignant" / "Espace d'apprentissage" (hubshell) vs "le Centre d'enseignement" (`k_theHub`) vs the digest "Learning Hub" left in English.
4. **"(s)" hacks**: `hm_activeOn7` "Actif {n} jour(s)", `pgStarsOf`/`pgStarsN` "{n} étoile(s) sur 3" while `hublessons.starsOutOf3` / `scStars` say "{n} étoiles sur 3" (wrong for 1). Use `_one`/`_other` (in French `one` covers 0 and 1).
5. Masculine defaults for the child: `pHowDoing` "Où il en est", `pBuildsBody` "où il réussit le mieux", `fmHandHint` "Envie qu'il travaille seul ?". Suggest neutral: "Sa progression", "la matière où l'enfant réussit le mieux", "Envie de le/la laisser travailler en autonomie ?".
6. "Year group" is rendered "niveau", "classe" and "année scolaire" in different keys.

| Sev | Key | Current | Problem | Fix |
|---|---|---|---|---|
| High | hubfam.qzAlHeadTitle | "l'attribuer et l'aperçevoir" | non-word | "l'attribuer et en voir un aperçu" |
| High | hubfam.asBlockedNow / asBlockedBreakDone | "Vous pouvez réessayer maintenant. Veuillez recommencer." | vous + "veuillez" to a child | "Tu peux réessayer maintenant. Essaie encore !" |
| High | hubfam.asBlurbNeed | "Il faut {n} % pour réussir. Réessayez quand vous serez prêt." | vous, masculine | "Il faut {n} % pour réussir. Réessaie quand tu veux !" |
| High | hubfam.asBlockedBreak | "Relisez la leçon, puis réessayez" | vous | "Relis la leçon, puis réessaie" |
| Med | hublessons.starsOutOf3 / scStars | "{n} étoiles sur 3" | n=1 | one/other plurals |
| Med | hubshell.hm_activeOn7 | "Actif {n} jour(s) sur les 7 derniers" | (s) hack | "Actif {n} jour{s}..." via plural key |
| Med | hubshell.k_cantOpen | "Ne peut pas l'ouvrir" | subject missing | "Impossible d'ouvrir" |
| Med | hubshell.k_theHub vs lbl_teaching_hub | "le Centre d'enseignement" vs "Espace enseignant" | inconsistent | "l'Espace enseignant" |
| Med | hubfam.pHowDoing | "Où il en est" | masculine | "Sa progression" |
| Low | hubshell.lbl_flashcards | "Cartes mémoire" | fine; hublive "paquet" | "jeu de cartes" for deck |
| Low | hubfam.fmNotThem | "l'enfant" | fine | - |

Digest: very good ("Rendu", "Corrigé : x/y", "Pour le {date}"). Fix the "Learning Hub" button and consider "professeur" for "tuteur".

---

## Cross-language systematic issues
1. **Quiz naming is inconsistent in pt, es, ro** (survey-words "questionário/cuestionario/chestionar" in tabs while other strings say quiz/test/prueba). Tab names referenced by body text no longer match (`hubfam.pgTutorEmptyBody`, `hublive.aQz_noneBody`).
2. **Tutor**: ro "tutore" (wrong meaning), pl korepetytor/nauczyciel split, fr "tuteur" (guardian overtone).
3. **Homework term** split: pl praca/zadanie, es deberes/tarea.
4. **Register in child assessment flow** (`hubfam.as*`): pt and fr are formal to the child; pl/ro/es are correct.
5. **Streak plurals** are non-plural keys (`hubmascot.streak`, `hubshell.hm_dayStreak`, digest `c_streak`): wrong at n=1 in pl/ro (and 20+ in ro).
6. **Year group**: every language uses 2-3 words; pl "klasa" and ro "clasa" map to a different age than UK Year N.
7. Digest email keeps "Learning Hub" in English while the app translates it. Decide on one brand rendering.
8. `hubhomework.ts` / `hubhow.ts` are empty shells (no translations for any locale).
9. UK "National Curriculum" is translated as if it were the local one (pl podstawa programowa, ro curriculum național).

## Top 20 corrections (priority order)
1. ro: move every "de"-form from `_many` to `_other` (26 keys incl. `hubshell.hm_handIns`, `hm_daysAgo`, `studentsCount`, `hubfam.qzQuestions/qzMarks/qzAttempts/qzStudents`, `hublessons.tf*`).
2. ro: replace "tutore/tutorele" (`hm_tutor`, `hm_yourTutor`, `hm_yourTutorCap`, all `hubshell.st_*`, `hublive.aTeach_offer`) with "profesor (particular)".
3. ro: `lbl_quizzes` "Chestionare" -> "Teste"; `lbl_new_quiz` "Chestionar nou" -> "Test nou"; digest "Chestionare" -> "Teste".
4. ro: `hm_kidCards` "Joacă-te cu cardurile" (and all "carduri") -> "cartonașe".
5. pt: `hubshell.st_*` Brazilianisms: "Salvar/Salvando/salvas/confira/você/lição de casa/gerente" -> "Guardar/A guardar/guardadas/verifique/(omit)/trabalho de casa/gestor".
6. pt: whole `hubfam.as*` block from você to tu for child lines (e.g. `asBlurbNeed` -> "Precisas de {n}% para passar. Tenta outra vez quando quiseres.").
7. fr: same for `hubfam.as*` (`asBlockedNow` -> "Tu peux réessayer maintenant. Essaie encore !").
8. fr: `hubfam.qzAlHeadTitle` "l'aperçevoir" -> "en voir un aperçu".
9. pt/es: "Questionário/Cuestionario" -> "Quiz" (tab, `hm_quiz`, `hm_kidQuiz`, `lbl_starting_quiz`, digest "Quizzes e aulas").
10. es: unify "Deberes" vs "Tareas" (`lbl_homework`, `lbl_set_homework`, `kHwWaiting`, `pOverdue`...).
11. pt/es/ro: fix tab-name cross-references in `hubfam.pgTutorEmptyBody` and `hublive.aQz_noneBody` so they match the real tab label.
12. pl: `hubtoolsb.lang_endExpl` "w wzorcu" -> "we wzorcu".
13. pl: add `_few/_many` to `hublessons.fcCardsToReview` ("karty/kart do powtórki").
14. pl: unify tutor -> one word (recommend "korepetytor" in hub UI or "nauczyciel" everywhere) and "praca domowa" -> "zadanie domowe".
15. pl: `hublessons.scTitle` "Album naklejek {name} — klasa {year}" -> "Album naklejek — {name}, klasa {year}".
16. pl/ro/pt/es/fr: `hubshell.k_cantOpen` -> impersonal ("Nie można tego otworzyć" is already fine; ro "Nu se poate deschide", pt "Não é possível abrir isto", es "No se puede abrir esto", fr "Impossible d'ouvrir").
17. fr: replace "étoile(s)" and "jour(s)" hacks with `_one/_other` plural keys (`pgStarsOf`, `pgStarsN`, `hm_activeOn7`, `hublessons.starsOutOf3`, `scStars`).
18. pl/ro/pt/es/fr: add `_one` forms for streak strings (`hubmascot.streak`, `hm_dayStreak`, digest `c_streak`), and ro "de" for 20+.
19. pt: `qzMqMarksOutOf`/`qzMqSaveFail` "Notas" -> "Pontos"; unify "ao vivo" vs "em direto", "tópico" vs "tema".
20. Digest emails (all): translate or consistently keep the "Learning Hub" button label as in-app; pl rephrase declined-name slots; pt "Obrigado" -> "Agradecemos"; fr/ro reconsider "tuteur/tutore".

## Grades
- Polish A- (few but real: tutor/homework term split, `w wzorcu`, plural gaps, undeclined names)
- Romanian B (plural "de" bug affecting 26 keys, "tutore", "carduri", quiz naming)
- Portuguese B- (Brazilian block in the roster UI, formal tone to children, questionário)
- Spanish B+ (deberes/tarea and cuestionario drift; otherwise natural)
- French B+ (tu/vous split in the child flow, one non-word, "(s)" hacks, "tuteur")
