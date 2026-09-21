// German — Current & Future Study and Employment (GCSE, Years 10 and 11). Original content aligned to the DfE GCSE modern foreign languages subject content (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q10 = qb("dework", 10);
const q11 = qb("dework", 11);

export const TOPIC: CTopic = {
  key: "dework",
  topic: "Current & Future Study and Employment",
  subject: "German",
  years: {
    10: {
      year: 10,
      subtopic: "GCSE Year 10",
      yearsCovered: [10],
      objectives: [
        "Describe school life: subjects, timetable, rules, exams and the German school system.",
        "Use modal verbs (müssen, dürfen, können) in the present and the simple past (musste, durfte).",
        "Use seit + dative with the present tense to say how long something has been going on.",
        "Use separable verbs correctly in main clauses (Der Unterricht fängt um acht Uhr an).",
        "Give reasons with weil and denn, using the correct word order.",
      ],
      note: {
        title: "Year 10: school life, rules and studies",
        body: `## Vocabulary

| German | English |
| --- | --- |
| das Gymnasium | school leading to the Abitur |
| die Gesamtschule | comprehensive school |
| die Klassenarbeit | class test |
| die Note | grade |
| die Schulordnung | school rules |
| das Fach | subject |

German grades run from **1 (sehr gut)** to **6 (ungenügend)**, so a low number is a good result.

## Modal verbs

| | müssen | dürfen | können |
| --- | --- | --- | --- |
| ich / er | muss | darf | kann |
| wir / sie | müssen | dürfen | können |
| simple past (ich) | musste | durfte | konnte |

*man darf nicht* = you are not allowed to; *man muss nicht* = you don't have to. The infinitive goes to the end: *In der Bibliothek darf man nicht laut sprechen.*

## Seit and separable verbs

**seit + dative + present tense**: *Er spielt seit fünf Jahren Geige.* (He has been playing for five years.) In a main clause, the separable prefix goes to the end: *Ich stehe um sechs Uhr auf. Ich bringe mein Mittagessen mit.*

## weil or denn?

**weil** sends the verb to the end; **denn** does not change the order: *Ich bin müde, denn ich habe schlecht geschlafen.* / *Ich bin müde, weil ich schlecht geschlafen habe.*

## Model sentences

- **In der Grundschule durfte ich keinen Kaugummi kauen.** In primary school I was not allowed to chew gum.
- **Wir schreiben jede Woche eine Klassenarbeit, aber ich habe keine Angst.** We write a test every week but I am not afraid.

Sound tip: **sch** is "sh" (Schule), **ch** after i is soft (ich), and **pf** is a quick "p-f" (Pfeffer).

## Common errors

- *seit fünf Jahre* (dative plural needs -n: seit fünf Jahren).
- *Ich stehe auf um sechs Uhr* (the prefix goes to the very end).
- *weil ich habe keine Zeit* (weil sends the verb last).`,
      },
      quiz: {
        title: "Current & Future Study and Employment: Year 10 quiz",
        questions: [
          q10.single("What does 'das Zeugnis' mean at school?", "school report", ["timetable", "exam hall", "canteen"], "Das Zeugnis is the report with your grades that you receive at the end of a term or year.", 1),
          q10.short("Translate into German, including the article: 'the timetable'.", "der Stundenplan", "Der Stundenplan (Stunde = lesson, Plan = plan) is masculine.", 1, {}),
          q10.single("In the German school grading system, which grade is the BEST?", "1", ["6", "10", "A"], "German marks run from 1 (sehr gut) to 6 (ungenügend), so 1 is the best.", 2),
          q10.single("Choose the correct modal verb: « Man ___ im Unterricht nicht essen. » (You are not allowed to eat in lessons.)", "darf", ["muss", "will", "soll"], "Man darf nicht = one is not allowed to. Muss nicht would mean 'does not have to'.", 2, true),
          q10.single("Which word completes the sentence? « Ich lerne ___ drei Jahren Deutsch. » (I have been learning German for three years.)", "seit", ["für", "vor", "während"], "Seit + dative with the present tense says how long something has been happening. Vor would mean 'ago'.", 2),
          q10.single(
            "Read the text. Why does the writer like physics?\n\n« In Deutschland beginnt die Schule oft um acht Uhr, und die meisten Schüler haben um eins Schluss. Nachmittags gibt es normalerweise keinen Unterricht, außer in Ganztagsschulen. Ich gehe auf ein Gymnasium in Hamburg. Mein Lieblingsfach ist Physik, weil unser Lehrer die Experimente sehr spannend macht. Ich mag Kunst nicht so gern, denn ich kann nicht gut zeichnen. Jeden Tag machen wir zwei Pausen: eine kleine und eine große. In der großen Pause kaufe ich mir ein Brötchen. Nächstes Jahr schreiben wir viele Klassenarbeiten, deshalb muss ich mehr lernen. »",
            "The teacher makes the experiments exciting.",
            ["It is her best subject.", "She wants to become a scientist.", "The lessons finish early."],
            "The text says: weil unser Lehrer die Experimente sehr spannend macht. Spannend = exciting.",
            2, true,
          ),
          q10.single("Which word means 'favourite subject'?", "Lieblingsfach", ["Lieblingsessen", "Lieblingsbuch", "Lieblingslehrer"], "Fach = subject, so Lieblingsfach = favourite subject. Lieblingsessen = favourite food.", 2),
          q10.single("Which sentence is correct?", "Der Unterricht fängt um acht Uhr an.", ["Der Unterricht anfängt um acht Uhr.", "Der Unterricht fängt an um acht Uhr.", "Der Unterricht um acht Uhr fängt an."], "Anfangen is separable. In a main clause the verb is in second place and the prefix an goes to the very end.", 2),
          q10.short("Translate into German: 'We are not allowed to use our phones in lessons.'", "Wir dürfen unsere Handys im Unterricht nicht benutzen.", "Wir dürfen (modal in second place) … nicht benutzen (infinitive at the end).", 3, { na: true, acc: ["Wir dürfen im Unterricht unsere Handys nicht benutzen.", "Wir dürfen unsere Handys im Unterricht nicht nutzen.", "Wir dürfen im Unterricht unsere Handys nicht nutzen.", ...["unsere Handys", "unsere Smartphones"].flatMap((o) => ["benutzen", "nutzen", "verwenden"].flatMap((v) => [`Wir dürfen ${o} im Unterricht nicht ${v}.`, `Wir dürfen im Unterricht ${o} nicht ${v}.`, `Im Unterricht dürfen wir ${o} nicht ${v}.`, `Wir dürfen ${o} nicht im Unterricht ${v}.`]))] }),
          q10.short("Complete with the simple past of müssen (one word): « Als ich klein war, ______ ich früh ins Bett gehen. »", "musste", "The simple past of müssen has no umlaut and adds -te: ich musste.", 3, {}),
          q10.multi("Which sentences are correct? Choose all that apply.", ["Ich lerne viel, denn ich will das Abitur bestehen.", "Ich lerne viel, weil ich das Abitur bestehen will."], ["Ich lerne viel, denn ich das Abitur bestehen will.", "Ich lerne viel, weil ich will das Abitur bestehen."], "Denn does not change the word order (verb in second place), but weil sends the verb to the end of its clause.", 3),
          q10.written(
            "Write 5–6 sentences in German about your school. Include your favourite subject with a reason (weil or denn), one rule using 'man darf nicht' or 'man muss', and one sentence with 'seit'.",
            "Ich gehe auf eine große Schule in der Nähe von Leeds. Mein Lieblingsfach ist Geschichte, weil ich die Themen sehr interessant finde. Ich lerne seit vier Jahren Deutsch, aber ich mag Mathe nicht, denn es ist zu schwer für mich. In unserer Schule muss man eine Uniform tragen, und man darf im Unterricht nicht essen. Der Unterricht fängt um neun Uhr an.",
            "Marking guide (12): reason with weil (verb last) or denn (order unchanged) (3); modal + infinitive at the end (3); seit + dative + present tense (3); separable verbs, capitals and spelling (2); range and detail (1).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["das Zeugnis", "school report"],
        ["die Klassenarbeit", "class test"],
        ["Note 1 / Note 6 in Germany", "1 = sehr gut (best), 6 = ungenügend (worst)"],
        ["Man darf nicht …", "You are not allowed to … (Man muss nicht = you don't have to)"],
        ["seit + Dativ + Präsens", "Ich lerne seit zwei Jahren Spanisch. (have been learning)"],
        ["Simple past of müssen (ich)", "ich musste"],
        ["Ich stehe um sechs Uhr auf.", "I get up at six o'clock. (prefix at the end)"],
        ["Which conjunction does NOT change word order?", "denn (weil sends the verb to the end)"],
        ["die Schulordnung", "school rules"],
        ["die Gesamtschule", "comprehensive school"],
      ]),
    },
    11: {
      year: 11,
      subtopic: "GCSE Year 11",
      yearsCovered: [11],
      objectives: [
        "Talk about jobs, careers, work experience and ambitions.",
        "Use the future tense with werden + infinitive, and wenn + present with a future main clause.",
        "Use professions without an article and form feminine job titles with -in.",
        "Use zu + infinitive after hoffen, vorhaben and es ist wichtig.",
        "Understand and write simple formal messages about applying for a job.",
      ],
      note: {
        title: "Year 11: careers, work experience and the future",
        body: `## Vocabulary

| German | English |
| --- | --- |
| der Beruf | job, profession |
| der Lebenslauf | CV |
| die Bewerbung | application |
| das Vorstellungsgespräch | job interview |
| die Stelle | post, position |
| das Gehalt | salary |
| verdienen | to earn |

## Professions

No article after *sein* or *werden*: *Mein Bruder ist Elektriker. Sie wird Lehrerin.* Feminine titles usually add **-in**, often with an umlaut: *Koch → Köchin, Lehrer → Lehrerin*; plural *Lehrerinnen*. Some use -frau instead: *Kaufmann → Kauffrau*.

## The future tense

**werden + infinitive at the end**: *Ich werde nächsten Sommer bei einer Zeitung arbeiten.* Add **wenn**: the present tense is normal in the wenn-clause, and the main clause starts with its verb: *Wenn ich genug Geld spare, werde ich ein Jahr reisen.*

| ich | du | er/sie/es | wir | ihr | sie/Sie |
| --- | --- | --- | --- | --- | --- |
| werde | wirst | wird | werden | werdet | werden |

## Infinitive with zu

*Sie hofft, bald eine Lehrstelle zu finden. Es ist wichtig, pünktlich zu sein.* With a separable verb *zu* sits in the middle: *anzufangen*.

## Model sentences

- **Mein Onkel arbeitet als Koch und verdient gut.** My uncle works as a cook and earns well.
- **Ich habe vor, nach dem Abitur ein Jahr im Ausland zu arbeiten.** I intend to work abroad for a year after my Abitur.

Sound tip: **ö** is like the vowel in "bird" with rounded lips (Köln, Ökonom); **ü** like "ee" with rounded lips (Bürger).

## Common errors

- *Ich bin eine Lehrerin* for a plain job title (say Ich bin Lehrerin; the article only appears with an adjective: eine gute Lehrerin).
- *Ich werde arbeiten in Berlin* (the infinitive goes last: Ich werde in Berlin arbeiten).
- *Ich hoffe, zu die Prüfung bestehen* (zu goes directly before the infinitive: die Prüfung zu bestehen).`,
      },
      quiz: {
        title: "Current & Future Study and Employment: Year 11 quiz",
        questions: [
          q11.single("What does 'die Ausbildung' mean?", "apprenticeship, vocational training", ["exam", "gap year", "university course"], "Die Ausbildung is on-the-job vocational training, often three years in a company and a vocational school.", 1),
          q11.short("Translate into German, including the article: 'the work experience' (placement).", "das Praktikum", "Das Praktikum is neuter; the person doing it is der Praktikant or die Praktikantin.", 1, { acc: ["Praktikum"] }),
          q11.single("Which word completes the sentence? « Meine Mutter ist ___. » (a doctor, female)", "Ärztin", ["Arzt", "Ärzte", "Ärztinnen"], "After sein a job has no article. The feminine form adds -in to Arzt and takes an umlaut: Ärztin.", 2),
          q11.single("Which sentence is in the future tense?", "Ich werde Lehrerin werden.", ["Ich bin Lehrerin geworden.", "Ich wurde Lehrerin.", "Ich war Lehrerin."], "The future is formed with werden + infinitive at the end: Ich werde … werden.", 2, true),
          q11.short("Translate into German: 'I would like to become an engineer.' (female; remember that German uses no article before a job)", "Ich möchte Ingenieurin werden.", "Möchte + infinitive at the end; the job has no article; feminine adds -in: Ingenieurin.", 2, { acc: ["Ich möchte gern Ingenieurin werden.", "Ich will Ingenieurin werden.", "Ich würde gern Ingenieurin werden.", "Ich möchte gerne Ingenieurin werden.", "Ich würde gerne Ingenieurin werden.", "Ich will gern Ingenieurin werden.", "Ich will gerne Ingenieurin werden."], na: true }),
          q11.single(
            "Read the message. What experience does Nora already have?\n\n« Sehr geehrte Frau Berger, ich interessiere mich für Ihre Stelle als Verkäuferin in Ihrer Buchhandlung. Ich bin sechzehn Jahre alt und gehe noch zur Schule, aber ich möchte in den Sommerferien arbeiten. Ich lese sehr gern und kenne viele Bücher für Jugendliche. Außerdem bin ich freundlich und zuverlässig. Letztes Jahr habe ich zwei Wochen in einer Bibliothek gearbeitet. Ich kann samstags und in den Ferien arbeiten. Ich würde mich freuen, wenn Sie mich zu einem Gespräch einladen. Mit freundlichen Grüßen, Nora Kaya »",
            "Two weeks in a library.",
            ["A year in a bookshop.", "A weekend job in a café.", "A summer at a newspaper."],
            "The text says: Letztes Jahr habe ich zwei Wochen in einer Bibliothek gearbeitet. She would like to work in a bookshop but has not done so yet.",
            2, true,
          ),
          q11.short("Fill the gap with one word: « Ich habe vor, nächstes Jahr Informatik ___ studieren. »", "zu", "After vorhaben the infinitive is introduced by zu, placed directly before the infinitive: … zu studieren.", 2, {}),
          q11.multi("Which words belong to applying for a job? Choose all that apply.", ["der Lebenslauf", "das Vorstellungsgespräch", "die Bewerbung"], ["der Stundenplan", "die Pause"], "Der Lebenslauf = CV, das Vorstellungsgespräch = interview, die Bewerbung = application. The others belong to school.", 2),
          q11.single("Which sentence means 'If I pass my exams, I will start an apprenticeship'?", "Wenn ich die Prüfungen bestehe, werde ich eine Ausbildung anfangen.", ["Wenn ich die Prüfungen bestehe, ich werde eine Ausbildung anfangen.", "Wenn ich die Prüfungen bestehe, anfangen werde ich eine Ausbildung.", "Wenn ich die Prüfungen bestehen werde, ich eine Ausbildung anfange."], "The wenn-clause sends the verb to the end (bestehe); the main clause then starts with its verb: werde ich … anfangen.", 3),
          q11.short("Translate into German: 'I hope that I will get a job.'", "Ich hoffe, dass ich eine Stelle bekomme.", "Hoffen + dass sends the verb to the end. The present tense (bekomme) often expresses the future.", 3, { acc: ["Ich hoffe, dass ich einen Job bekomme.", "Ich hoffe, dass ich eine Stelle finde.", "Ich hoffe, dass ich eine Stelle bekommen werde.", "Ich hoffe, dass ich einen Job finde.", "Ich hoffe, ich bekomme eine Stelle.", "Ich hoffe, ich bekomme einen Job.", ...["eine Stelle", "einen Job", "eine Arbeit", "eine Arbeitsstelle"].flatMap((o) => [...["bekomme", "finde", "kriege", "bekommen werde", "finden werde"].flatMap((v) => [`Ich hoffe, dass ich ${o} ${v}.`, ...(v.includes("werde") ? [] : [`Ich hoffe, ich ${v} ${o}.`])]), `Ich hoffe, ich werde ${o} bekommen.`, `Ich hoffe, ich werde ${o} finden.`])] }),
          q11.single("Choose the correct preposition: « Ich freue mich schon ___ mein Praktikum im Sommer. »", "auf", ["über", "für", "an"], "Sich freuen auf + accusative looks forward to something in the future; sich freuen über is pleasure about something present or past.", 3),
          q11.written(
            "Write 5–6 sentences in German about your plans after school. Include a future tense with 'werden', a 'wenn' sentence, a job (without an article) and one 'zu' + infinitive.",
            "Nach der Schule werde ich wahrscheinlich eine Ausbildung machen. Ich möchte Krankenpflegerin werden, weil ich gern mit Menschen arbeite. Wenn ich die Prüfungen bestehe, werde ich mich bei einem Krankenhaus bewerben. Ich hoffe, im Sommer ein Praktikum zu bekommen. Meine Schwester ist schon Ärztin, und sie sagt, dass der Beruf schwer, aber schön ist.",
            "Marking guide (12): future with werden + infinitive at the end (3); wenn clause with correct verb order in both clauses (3); job without article, feminine/masculine form correct (2); zu + infinitive correctly placed (2); spelling, capitals and range (2).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["die Ausbildung", "apprenticeship, vocational training"],
        ["das Praktikum", "work experience, placement"],
        ["der Lebenslauf", "CV"],
        ["das Vorstellungsgespräch", "job interview"],
        ["Ärztin", "female doctor (Arzt → Ärztin)"],
        ["Future tense: ich …", "werden + infinitive at the end: Ich werde arbeiten."],
        ["Wenn ich fertig bin, werde ich …", "When/if I am finished, I will … (wenn + present, then verb first)"],
        ["Ich habe vor, … zu + infinitive", "I intend to … (Ich habe vor, zu reisen.)"],
        ["Ich bin Lehrer.", "I am a teacher. (no article before the job)"],
        ["sich freuen auf + Akk.", "to look forward to (something in the future)"],
      ]),
    },
  },
};
