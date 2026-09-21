// German — Aspects of Society (A-level, Years 12 and 13). Original content aligned to the DfE GCE modern foreign languages subject content (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q12 = qb("desoc", 12);
const q13 = qb("desoc", 13);

export const TOPIC: CTopic = {
  key: "desoc",
  topic: "Aspects of Society",
  subject: "German",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12",
      yearsCovered: [12],
      objectives: [
        "Discuss changing family structures and demographic change in German-speaking countries.",
        "Discuss education and training (Bildungssystem, duale Ausbildung, Studium) and the world of work (Teilzeit, Homeoffice, Gleichberechtigung).",
        "Describe and compare trends and statistics (steigen, sinken, der Anteil, im Vergleich zu).",
        "Build an argument with connectors (einerseits … andererseits, zwar … aber, trotzdem, während).",
        "Use (an)statt … zu + infinitive and word order after adverbial connectors.",
      ],
      note: {
        title: "Year 12: family, education and the world of work",
        body: `## Vocabulary

| German | English |
| --- | --- |
| die Patchworkfamilie | blended family |
| die Alleinerziehenden (pl.) | single parents |
| der demografische Wandel | demographic change |
| die Vereinbarkeit von Beruf und Familie | balancing work and family |
| das Homeoffice | working from home |
| die duale Ausbildung | apprenticeship combining company and college |
| die Bevölkerung | population |

## Describing trends

| Verb | Meaning |
| --- | --- |
| steigen – stieg – ist gestiegen | to rise |
| sinken – sank – ist gesunken | to fall |
| zunehmen / abnehmen | to increase / to decrease |
| zurückgehen | to decline |

Useful frames: *der Anteil (m.) der Frauen*, *um zehn Prozent*, *im Vergleich zu + dative*, *die Zahl der Studierenden*. After a number, **Prozent** does not take an -e.

## Building an argument

- **Subordinating** (verb last): *obwohl, während, weil, dass*.
- **Adverbs** (verb second, right after): *trotzdem, deshalb, dennoch, außerdem*.
- **Pairs**: *einerseits … andererseits, zwar … aber*.
- **(an)statt … zu + infinitive**: *Er bleibt zu Hause, statt zur Schule zu gehen.*

## Model sentences

- **Der Anteil der Beschäftigten im Homeoffice ist in den letzten Jahren gestiegen.** The proportion of employees working from home has risen in recent years.
- **Zwar bietet das Homeoffice Flexibilität, aber es fördert auch die Isolation.** Admittedly working from home offers flexibility, but it also encourages isolation.
- **In unserer Firma nimmt die Zahl der Bewerbungen zu, während die der Kündigungen sinkt.** In our firm the number of applications is increasing while that of resignations is falling.

## Common errors

- *der Anteil ist gestiegt* (the participle is gestiegen).
- *mehr wie* (use mehr als).
- *Trotzdem sie sind müde* (after trotzdem the verb is second: trotzdem sind sie müde).`,
      },
      quiz: {
        title: "Aspects of Society: Year 12 quiz",
        questions: [
          q12.single("Which word means 'part-time (work)'?", "Teilzeit", ["Vollzeit", "Überstunden", "Urlaub"], "Teilzeit is part-time (Teil = part, Zeit = time). Vollzeit is full-time.", 1),
          q12.short("Translate into German, with the article: 'equal rights'.", "die Gleichberechtigung", "Gleich (equal) + Berechtigung (entitlement) gives die Gleichberechtigung, which is feminine.", 1, { acc: ["Gleichberechtigung", "gleiche Rechte", "die gleichen Rechte", "gleiche Rechte für alle"] }),
          q12.single("Choose the correct perfect tense: « Der Anteil der Einpersonenhaushalte ___ in den letzten Jahrzehnten. »", "ist gestiegen", ["hat gestiegen", "ist gesteigt", "wurde gestiegen"], "Steigen is a strong verb of change of state: it takes sein and the participle is gestiegen.", 2, true),
          q12.single("Which sentence has the correct word order?", "Während früher die meisten Frauen zu Hause blieben, arbeiten heute viele in Vollzeit.", ["Während früher die meisten Frauen blieben zu Hause, arbeiten heute viele in Vollzeit.", "Während früher die meisten Frauen zu Hause blieben, heute arbeiten viele in Vollzeit.", "Während die meisten Frauen früher zu Hause blieben, heute viele arbeiten in Vollzeit."], "Während sends the verb (blieben) to the end. The main clause then begins with the verb after the time word heute: arbeiten heute viele.", 2),
          q12.multi("Which words mean 'to decrease'? Choose all that apply.", ["abnehmen", "zurückgehen", "sinken"], ["zunehmen", "steigen"], "Abnehmen, zurückgehen and sinken all express a decrease; zunehmen and steigen express an increase.", 2),
          q12.single(
            "Read the text. How does the company plan to respond to the problems mentioned?\n\n« Seit einigen Jahren arbeiten viele Beschäftigte mindestens einen Tag pro Woche im Homeoffice. In einer Umfrage unserer Firma bevorzugen zwei Drittel der Mitarbeiter ein gemischtes Modell. Der große Vorteil ist, dass man Zeit spart, weil der Weg zur Arbeit entfällt. Außerdem kann man Beruf und Familie besser vereinbaren. Allerdings fühlen sich manche Kollegen einsam, und die Grenze zwischen Arbeit und Freizeit verschwimmt. Deshalb plant die Firma feste Bürotage, an denen das ganze Team zusammenkommt. Ob das alle Probleme löst, bleibt abzuwarten. »",
            "By introducing fixed office days for the whole team.",
            ["By banning working from home altogether.", "By paying home workers a higher salary.", "By moving the team to a larger office."],
            "The text says: Deshalb plant die Firma feste Bürotage, an denen das ganze Team zusammenkommt. The firm keeps a mixed model.",
            2, true,
          ),
          q12.single("What does 'der demografische Wandel' mean?", "demographic change", ["democratic reform", "economic growth", "urban development"], "Demografisch relates to population structure (age, birth rate), and Wandel means change.", 2),
          q12.short("Fill the gap with one word: « Im Vergleich ___ 1990 sind die Preise stark gestiegen. »", "zu", "Im Vergleich zu takes the dative and means 'compared with'.", 2, {}),
          q12.single("Choose the correct connector: « Immer mehr Väter nehmen Elternzeit. ___ bleiben die meisten Mütter länger zu Hause. »", "Trotzdem", ["Obwohl", "Weil", "Dass"], "Trotzdem is an adverb, so the verb follows straight away (second position). Obwohl, weil and dass would send bleiben to the end.", 3),
          q12.short("Translate into German: 'The proportion of people who work from home has risen sharply.'", "Der Anteil der Menschen, die im Homeoffice arbeiten, ist stark gestiegen.", "Der Anteil is masculine; the relative clause has its verb last; steigen forms the perfect with sein: ist gestiegen.", 3, { acc: ["Der Anteil der Menschen, die zu Hause arbeiten, ist stark gestiegen.", "Der Anteil der Menschen, die von zu Hause aus arbeiten, ist stark gestiegen.", "Der Anteil der Menschen, die im Homeoffice arbeiten, ist deutlich gestiegen.", "Der Anteil der Menschen, die im Homeoffice arbeiten, ist stark angestiegen.", "Der Anteil der Leute, die im Homeoffice arbeiten, ist stark gestiegen.", ...["Menschen", "Leute"].flatMap((p) => ["im Homeoffice", "zu Hause", "von zu Hause aus", "von daheim aus"].flatMap((w) => ["stark", "deutlich", "erheblich"].flatMap((a) => [`Der Anteil der ${p}, die ${w} arbeiten, ist ${a} gestiegen.`, `Der Anteil der ${p}, die ${w} arbeiten, ist ${a} angestiegen.`, `Der Anteil der ${p}, die ${w} arbeiten, hat ${a} zugenommen.`])))] }),
          q12.single("Which sentence means 'Many young people study instead of doing an apprenticeship'?", "Viele junge Leute studieren, anstatt eine Ausbildung zu machen.", ["Viele junge Leute studieren, anstatt zu eine Ausbildung machen.", "Viele junge Leute studieren, anstatt eine Ausbildung machen zu.", "Viele junge Leute studieren, anstatt dass eine Ausbildung machen."], "Anstatt … zu + infinitive: the infinitive clause is separated by a comma and zu stands directly before the infinitive (zu machen).", 3),
          q12.written(
            "Write about 100 words in German: is working from home better than working in an office? Give arguments for and against, using 'einerseits … andererseits' or 'zwar … aber', one trend verb (steigen/sinken/zunehmen) and one 'trotzdem' or 'deshalb'.",
            "Meiner Meinung nach ist das Homeoffice weder ganz gut noch ganz schlecht. Einerseits spart man Zeit, weil man nicht zur Arbeit fahren muss, und man kann Beruf und Familie leichter vereinbaren. Andererseits fühlen sich viele Beschäftigte einsam. Die Zahl der Menschen, die von zu Hause arbeiten, ist in den letzten Jahren stark gestiegen. Trotzdem glaube ich, dass Firmen feste Bürotage einführen sollten, damit das Team zusammenarbeiten kann.",
            "Marking guide (15): argument structure with einerseits/andererseits or zwar/aber (3); correct verb-final order in subordinate clauses and verb-second after adverbs (4); trend vocabulary and correct participle/auxiliary (3); range, accuracy of cases and endings (3); clear opinion and conclusion (2).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["die Patchworkfamilie", "blended family"],
        ["die Alleinerziehenden", "single parents"],
        ["das Homeoffice", "working from home"],
        ["die Vereinbarkeit von Beruf und Familie", "balancing work and family life"],
        ["to rise (past participle)", "steigen: ist gestiegen"],
        ["sinken – sank – …", "ist gesunken (to fall)"],
        ["im Vergleich zu + which case?", "Dative: im Vergleich zu früheren Generationen"],
        ["trotzdem / deshalb: verb position?", "Verb second, straight after: Trotzdem bleiben sie."],
        ["anstatt … zu + infinitive", "instead of … -ing: Er ruft an, anstatt zu schreiben."],
        ["der Anteil", "proportion, share (masculine)"],
      ]),
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13",
      yearsCovered: [13],
      objectives: [
        "Explain how migration and integration are discussed in German-speaking society, using balanced language.",
        "Describe the German political system: Bundestag, Bundesrat, Bundeskanzler, Grundgesetz, coalitions and the two-vote system.",
        "Discuss political participation, voter turnout and young people's engagement.",
        "Present arguments and concessions (zwar … aber, allerdings, dennoch) and report others' views (Kritiker behaupten, dass …).",
        "Use passive and modal passive in formal descriptions (muss angeboten werden).",
      ],
      note: {
        title: "Year 13: migration, integration and political life",
        body: `## Vocabulary

| German | English |
| --- | --- |
| der Bundestag | federal parliament |
| der Bundesrat | chamber representing the 16 Länder |
| der Bundeskanzler / die Bundeskanzlerin | federal chancellor (head of government) |
| der Bundespräsident | federal president (head of state) |
| das Grundgesetz | Basic Law (constitution) |
| die Koalition | coalition |
| die Wahlbeteiligung | turnout |
| die Fachkraft | skilled worker |
| die Einwanderung / die Integration | immigration / integration |

## How elections work

Voters have two votes: the **Erststimme** for a local candidate and the **Zweitstimme** for a party list. A party needs five per cent (*Fünf-Prozent-Hürde*) to enter the Bundestag, which is elected every four years and elects the Chancellor. Since the 2023 electoral reform (first used in 2025) the Bundestag has a fixed 630 seats and the Zweitstimme alone decides how many seats each party gets. The voting age is 18 for the Bundestag, but 16 for the European Parliament election and for local or Land elections in several Länder.

## Balanced argument

- Concession: *Zwar … aber …, einerseits … andererseits …, allerdings, dennoch.*
- Reporting others: *Kritiker behaupten, dass …; Befürworter argumentieren, dass …*
- Passive with a modal: *Mehr Wohnungen müssen gebaut werden.* In a subordinate clause the verb chain goes last: *…, dass mehr Wohnungen gebaut werden müssen.*

## Model sentences

- **Der Bundeskanzler wird vom Bundestag gewählt.** The Chancellor is elected by the Bundestag.
- **Bei einer Koalition muss jede Partei Kompromisse eingehen.** In a coalition every party has to compromise.
- **Zwar gilt Deutschland als Einwanderungsland, aber darüber wird weiterhin lebhaft diskutiert.** Admittedly Germany counts as a country of immigration, but it is still discussed keenly.

## Common errors

- *die Bundeskanzler* (masculine: der Bundeskanzler; feminine: die Bundeskanzlerin).
- *…, dass mehr Wohnungen müssen gebaut werden* (chain last: gebaut werden müssen).
- *Zwar ist es teuer, aber ist es wichtig* (aber does not change the order: aber es ist wichtig).`,
      },
      quiz: {
        title: "Aspects of Society: Year 13 quiz",
        questions: [
          q13.single("What does 'der Bundeskanzler' mean?", "federal chancellor", ["federal president", "mayor", "speaker of parliament"], "Der Bundeskanzler is the head of government. The head of state is der Bundespräsident.", 1),
          q13.short("Translate into German, with the article: 'the election'.", "die Wahl", "Die Wahl (plural die Wahlen) means the election, and also 'the choice'.", 1, { acc: ["Wahl"] }),
          q13.single("Complete: « Der Bundestag wird alle ___ Jahre gewählt. »", "vier", ["drei", "fünf", "sechs"], "The Bundestag is elected every four years.", 2),
          q13.single("What is the 'Zweitstimme' used for in a federal election?", "for a party (its list)", ["for a local candidate", "for the Chancellor directly", "for a second choice if the first fails"], "The Erststimme elects a local candidate; the Zweitstimme is for a party list and mainly decides the party strengths in the Bundestag.", 2, true),
          q13.multi("Which words belong to migration and integration? Choose all that apply.", ["die Einwanderung", "die Willkommenskultur", "der Integrationskurs"], ["der Wahlkampf", "die Koalition"], "Einwanderung = immigration, Willkommenskultur = welcoming culture, Integrationskurs = integration course. Wahlkampf and Koalition belong to elections and government.", 2),
          q13.single(
            "Read the text. Why did the city start the project?\n\n« In unserer Stadt dürfen Jugendliche ab sechzehn bei der Kommunalwahl wählen. Für viele ist das eine wichtige Chance, denn Entscheidungen über Schulen und Verkehr betreffen sie direkt. Trotzdem war die Wahlbeteiligung der jungen Wähler bei der letzten Wahl gering. Die Stadt hat deshalb ein Projekt gestartet: In Schulen erklären Politiker, wie eine Wahl funktioniert, und die Schüler stellen Fragen. Viele sagen danach, dass sie sich mehr für Politik interessieren als früher. Ein Schüler erklärt: „Wenn ich nicht wähle, entscheiden andere für mich.“ »",
            "Few young people had voted in the last election.",
            ["Politicians wanted to lower the voting age.", "Schools had asked for more lessons in politics.", "Fewer schools were being built in the city."],
            "The text says: Trotzdem war die Wahlbeteiligung der jungen Wähler bei der letzten Wahl gering. The project (Deshalb) is the response.",
            2, true,
          ),
          q13.single("Which institution represents the 16 federal states (Länder)?", "der Bundesrat", ["der Bundestag", "das Bundesverfassungsgericht", "der Bundespräsident"], "Der Bundesrat consists of members of the Länder governments. The Bundestag is elected directly by the people.", 2),
          q13.short("Fill the gap with one word: « Die Regierung besteht aus einer ______ von zwei Parteien. »", "Koalition", "A coalition is a government formed by two or more parties; the word is feminine: eine Koalition.", 2, {}),
          q13.single("Which sentence is correct?", "Kritiker sagen, dass mehr Sprachkurse angeboten werden müssen.", ["Kritiker sagen, dass mehr Sprachkurse müssen angeboten werden.", "Kritiker sagen, dass mehr Sprachkurse werden angeboten müssen.", "Kritiker sagen, dass müssen mehr Sprachkurse angeboten werden."], "In a dass-clause all verbs go to the end, with the finite modal last: angeboten werden müssen.", 3),
          q13.single("Which sentence uses 'zwar … aber' correctly?", "Zwar ist die Wahlbeteiligung gestiegen, aber sie bleibt niedrig.", ["Zwar ist die Wahlbeteiligung gestiegen, aber bleibt sie niedrig.", "Zwar die Wahlbeteiligung ist gestiegen, aber sie bleibt niedrig.", "Zwar ist die Wahlbeteiligung gestiegen, deshalb sie bleibt niedrig."], "Zwar is followed by a normal main clause (verb second). Aber is a coordinating conjunction and does not change the word order of the next clause.", 3),
          q13.short("Translate into German: 'The election result was announced yesterday evening.'", "Das Wahlergebnis wurde gestern Abend bekannt gegeben.", "Past passive: wurde + past participle at the end. The participle of bekannt geben is bekannt gegeben (or bekanntgegeben); verkündet also works.", 3, { acc: ["Das Wahlergebnis wurde gestern Abend bekanntgegeben.", "Das Wahlergebnis wurde gestern Abend verkündet.", "Das Wahlergebnis wurde gestern Abend mitgeteilt.", "Das Ergebnis der Wahl wurde gestern Abend bekannt gegeben.", "Das Ergebnis der Wahl wurde gestern Abend bekanntgegeben.", ...["Das Wahlergebnis", "Das Ergebnis der Wahl"].flatMap((s) => ["bekannt gegeben", "bekanntgegeben", "verkündet", "mitgeteilt", "bekannt gemacht"].flatMap((v) => [`${s} wurde gestern Abend ${v}.`, `${s} wurde gestern am Abend ${v}.`, `Gestern Abend wurde ${s.replace(/^Das/, "das")} ${v}.`]))] }),
          q13.written(
            "Write about 100 words in German on whether 16-year-olds should be allowed to vote. Give arguments for and against, use 'zwar … aber' or 'einerseits … andererseits', report one opinion with 'Kritiker behaupten, dass …' and use one passive.",
            "Ob Sechzehnjährige wählen dürfen, wird in Deutschland heftig diskutiert. Einerseits betreffen politische Entscheidungen die Jugendlichen direkt, andererseits fehlt vielen noch die Erfahrung. Kritiker behaupten, dass junge Menschen sich zu wenig für Politik interessieren. Zwar ist die Wahlbeteiligung dieser Gruppe niedrig, aber das könnte sich ändern, wenn sie früher beteiligt würden. Meiner Meinung nach sollte das Wahlalter gesenkt werden, weil Demokratie geübt werden muss.",
            "Marking guide (15): balanced argument with a concession structure (3); reporting opinions with dass and correct verb-final order (3); passive (also modal passive) used correctly (3); political vocabulary and correct cases (3); clear personal conclusion, register and spelling (3).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["der Bundestag", "federal parliament (elected every four years)"],
        ["der Bundesrat", "chamber representing the 16 Länder"],
        ["das Grundgesetz", "Basic Law (the German constitution)"],
        ["die Erststimme / die Zweitstimme", "vote for a local candidate / vote for a party list"],
        ["die Koalition", "coalition"],
        ["die Wahlbeteiligung", "turnout"],
        ["die Fachkraft", "skilled worker"],
        ["Kritiker behaupten, dass …", "Critics claim that … (verb last)"],
        ["zwar … aber …", "admittedly … but … (aber does not change word order)"],
        ["…, dass mehr Wohnungen gebaut werden müssen.", "…, that more flats must be built. (verb chain last)"],
      ]),
    },
  },
};
