# A4 Languages verification

Browser part NOT completed: the Chrome extension disconnected and the Teaching Hub page showed "We can't reach Teaching Hub" (API unreachable) so no tool could be opened. No screenshots. UI checks (phone width, accent bar, 44px targets, keyboard flow, console) remain UNVERIFIED.

Verified by code-level dump of generators (all real outputs read against native-level knowledge):
- Conjugation: 80 FR, 66 ES, 87 DE verbs, all tenses/persons (incl. reflexives, passe compose agreement, spelling changes, Konjunktiv II). No errors found.
- Sentence builder tables (FR/ES/DE) and German order clauses (verb-second, time-front inversion, weil/dass/wenn/obwohl verb-last, sub-first inversion, separable prefixes): all grammatical.
- Numbers/dates/times/prices (35 numbers x 3 languages, ordinals, dates, 10+ times x 3 languages, prices): correct (FR 71/80/91/99/200/201, ES 21/31/101/500, DE 21/101/1001 all right).
- Fixed: grammar/numbers.ts, Spanish 1st of month accepted "el primer de enero" (not valid Spanish); removed "primer" from accepted spoken forms.
- Selftests pass (conjugate 596, sentences 191, grammar 719, textmark 43); tsc grep on tools/languages prints nothing.
- Not reviewed: nouns.ts genders/articles, agreement.ts, accent policy in UI.
