// German — Grammar & Structures (A-level, Years 12 and 13). Original content aligned to the DfE GCE modern foreign languages subject content (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q12 = qb("degram5", 12);
const q13 = qb("degram5", 13);

export const TOPIC: CTopic = {
  key: "degram5",
  topic: "Grammar & Structures",
  subject: "German",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12",
      yearsCovered: [12],
      objectives: [
        "Form and use the subjunctive II in the present and the past for unreal conditions, wishes and polite requests.",
        "Use passive alternatives: statal passive, man, sich lassen + infinitive, sein + zu + infinitive and the modal passive.",
        "Use a range of connectors and place the verb correctly after subordinating conjunctions, adverbs and coordinating conjunctions.",
        "Use prepositions with the genitive (wegen, trotz, statt, während, aufgrund, innerhalb).",
        "Recognise and correct common errors in word order and case.",
      ],
      note: {
        title: "Year 12: Konjunktiv II, passive alternatives, connectors and genitive prepositions",
        body: `## Konjunktiv II

| | Present | Past |
| --- | --- | --- |
| Unreal condition | Wenn ich Zeit hätte, würde ich kommen. | Wenn ich Zeit gehabt hätte, wäre ich gekommen. |

Present forms: simple-past stem + -e (with umlaut): *hätte, wäre, käme, ginge*, modals *könnte, müsste, sollte, dürfte*; otherwise **würde + infinitive**. Past: **hätte / wäre + past participle**. Without *wenn* the verb comes first: *Hätte ich Zeit, würde ich kommen.* Polite: *Könnten Sie mir helfen?* Wish: *Wäre ich doch reicher!*

## Passive alternatives

| Type | Example |
| --- | --- |
| process passive | Die Tür wird geöffnet. |
| statal passive (state) | Die Tür ist geöffnet. |
| man + active | Man spricht hier Deutsch. |
| sich lassen + infinitive | Das Problem lässt sich lösen. |
| sein + zu + infinitive | Die Regeln sind zu beachten. |
| modal passive | Das Formular muss ausgefüllt werden. |

## Connectors and the verb

- **Verb last**: obwohl, indem, sodass, falls, bevor, nachdem, damit.
- **Verb second** (adverbs): deshalb, trotzdem, dennoch, folglich.
- **No change**: und, aber, oder, denn, sondern.

## Genitive prepositions

*wegen, trotz, statt/anstatt, während, aufgrund, innerhalb, außerhalb*: masculine and neuter nouns add -(e)s: *trotz des Sturms, während des Winters, innerhalb einer Woche.*

## Common errors

- *Wenn ich hätte gelernt* (the participle comes first: wenn ich gelernt hätte).
- *trotzdem ich müde bin* (use obwohl ich müde bin, or trotzdem bin ich müde).
- *wegen dem Sturm* (formal: wegen des Sturms).`,
      },
      quiz: {
        title: "Grammar & Structures: Year 12 quiz",
        questions: [
          q12.short("Complete with the subjunctive II of sein (one word): « Wenn ich reicher ______, würde ich mehr reisen. »", "wäre", "The subjunctive II of sein is wäre (from war + umlaut + -e).", 1, { na: true }),
          q12.single("Which preposition takes the genitive?", "trotz", ["mit", "nach", "aus"], "Trotz (despite) takes the genitive. Mit, nach and aus take the dative.", 1),
          q12.single("Choose the correct form: « Wenn es gestern nicht geregnet ___, wären wir gewandert. »", "hätte", ["hatte", "wäre", "würde"], "For an unreal past condition, use hätte/wäre + past participle. Regnen takes haben, so: geregnet hätte.", 2, true),
          q12.single("What does 'Das lässt sich leicht erklären' mean?", "That can easily be explained.", ["That easily explains itself.", "That is easily allowed.", "He is having it explained."], "Sich lassen + infinitive is a passive alternative meaning 'can be …-ed'.", 2),
          q12.single("Choose the correct connector: « Es hat stark geregnet; ___ ist das Fest ausgefallen. »", "deshalb", ["obwohl", "denn", "weil"], "Deshalb is an adverb: the verb follows directly (ist). Denn, weil and obwohl would put the subject or the verb in a different place.", 2),
          q12.single(
            "Read the text. What would the writer do first as Chancellor?\n\n« Wenn ich Bundeskanzlerin wäre, würde ich als Erstes die Schulen besser ausstatten. Viele Klassenzimmer sind heute so alt, dass man sich kaum konzentrieren kann. Hätte die Politik früher mehr investiert, wären die Gebäude heute in einem besseren Zustand. Außerdem würde ich mehr Lehrer einstellen, damit die Klassen kleiner werden. Natürlich wäre das teuer, aber ohne gute Bildung kann ein Land nicht bestehen. Manche Kritiker sagen, dass man das Geld lieber für Straßen ausgeben sollte. Meiner Meinung nach ist das kurzsichtig. »",
            "Give schools better equipment.",
            ["Build new roads.", "Hire more teachers.", "Lower taxes."],
            "The text says: würde ich als Erstes die Schulen besser ausstatten. Hiring more teachers comes second (Außerdem).",
            2, true,
          ),
          q12.single("Choose the correct article: « Während ___ Ferien fahren wir nach Wien. »", "der", ["des", "den", "die"], "Während takes the genitive; die Ferien is plural, so the genitive plural article is der: während der Ferien.", 2),
          q12.single("Which sentence means 'Instead of a taxi we took the bus'?", "Statt eines Taxis nahmen wir den Bus.", ["Statt ein Taxi nahmen wir den Bus.", "Statt eines Taxi nahmen wir den Bus.", "Statt eines Taxis wir nahmen den Bus."], "Statt takes the genitive: ein Taxi (neuter) becomes eines Taxis. The verb stays in second position: nahmen wir.", 2),
          q12.single("Which sentence means 'If I had known that, I would have called you'?", "Wenn ich das gewusst hätte, hätte ich dich angerufen.", ["Wenn ich das gewusst hatte, hätte ich dich angerufen.", "Wenn ich das gewusst hätte, würde ich dich angerufen.", "Wenn ich das wüsste, hätte ich dich angerufen."], "An unreal past condition needs the past subjunctive II in both clauses: hätte gewusst … hätte angerufen.", 3),
          q12.short("Translate into German using 'sein + zu + infinitive': 'The results cannot be ignored.'", "Die Ergebnisse sind nicht zu ignorieren.", "Sein + zu + infinitive with nicht expresses 'cannot be …-ed': sind nicht zu ignorieren.", 3, { acc: ["Die Resultate sind nicht zu ignorieren.", ...["Ergebnisse", "Resultate"].flatMap((n) => ["ignorieren", "übergehen", "missachten", "vernachlässigen"].map((v) => `Die ${n} sind nicht zu ${v}.`))] }),
          q12.multi("Which sentences are correct? Choose all that apply.", ["Er lernt viel, damit er die Prüfung besteht.", "Nachdem sie gegessen hatten, gingen sie nach Hause.", "Sie ist müde, deshalb geht sie früh schlafen."], ["Er lernt viel, damit er besteht die Prüfung.", "Sie ist müde, deshalb sie geht früh schlafen."], "Damit and nachdem send the verb to the end; deshalb is followed by the verb in second place (deshalb geht sie).", 3),
          q12.written(
            "Write about 100 words in German: what would you change at your school if you were the head teacher, and what should have been done differently in the past? Use at least two unreal conditions (one present, one past), one passive alternative and two genitive prepositions.",
            "Wenn ich Schulleiterin wäre, würde ich den Schulhof neu gestalten. Wegen des Lärms in den Pausen sollte es auch ruhigere Bereiche geben. Hätte man früher mehr Geld investiert, wäre das Gebäude heute in einem besseren Zustand. Die Probleme sind nicht mehr zu übersehen. Statt eines neuen Sportplatzes würde ich lieber mehr Lehrer einstellen, weil sich Lernen nicht durch Beton verbessern lässt. Innerhalb eines Jahres könnte sich vieles ändern.",
            "Marking guide (15): present unreal condition with wäre/hätte/würde (3); past unreal condition with hätte/wäre + participle (3); passive alternative (sein + zu, sich lassen, modal passive) (3); genitive prepositions with correct endings (3); word order, spelling and range (3).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["Wenn ich Zeit hätte, …", "If I had time, … (würde + infinitive in the main clause)"],
        ["Past unreal condition", "Wenn ich gewusst hätte, … hätte/wäre + past participle"],
        ["Könnten Sie mir helfen?", "Could you help me? (polite subjunctive II)"],
        ["Das Problem lässt sich lösen.", "The problem can be solved. (sich lassen + infinitive)"],
        ["Die Regeln sind zu beachten.", "The rules must be observed. (sein + zu + infinitive)"],
        ["Verb position after obwohl / deshalb / denn", "last / second / unchanged"],
        ["Prepositions with the genitive", "wegen, trotz, statt, während, aufgrund, innerhalb, außerhalb"],
        ["während der Ferien", "during the holidays (genitive plural: der)"],
        ["trotz des Sturms", "despite the storm (masculine genitive -s)"],
        ["Hätte ich Zeit, würde ich kommen.", "Wenn dropped: the verb goes first."],
      ]),
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13",
      yearsCovered: [13],
      objectives: [
        "Form and use the subjunctive I for indirect speech, and use the subjunctive II when the subjunctive I is identical to the indicative.",
        "Understand and produce extended participial attributes (der von den Schülern gelesene Text).",
        "Nominalise verbs, adjectives and whole clauses (die Entscheidung, die Möglichkeit, nach der Ankunft des Präsidenten).",
        "Use modal verbs subjectively (er soll reich sein, sie muss krank sein).",
        "Use formal registers accurately in written German.",
      ],
      note: {
        title: "Year 13: Konjunktiv I, extended attributes and nominalisation",
        body: `## Konjunktiv I (indirect speech)

Stem + **-e, -est, -e, -en, -et, -en** (sein: **sei, seist, sei, seien, seiet, seien**). The tense shows time: present = same time, *sei/habe + participle* = earlier.

| Direct speech | Indirect speech |
| --- | --- |
| Ich bin in Eile. | Sie sagt, sie sei in Eile. |
| Ich habe Hunger. | Er sagt, er habe Hunger. |
| Wir kommen später. | Sie sagen, sie kämen später. |
| Ich bin früh aufgestanden. | Er sagt, er sei früh aufgestanden. |

When the subjunctive I looks like the indicative (*sie haben, wir kommen*), use the **subjunctive II**: *hätten, kämen*.

## Extended attributes

A participle with its modifiers stands before the noun and takes an adjective ending: *das vor zwei Jahren eröffnete Museum* = *das Museum, das vor zwei Jahren eröffnet wurde*. Present participle: *die wachsende Zahl*.

## Nominalisation

| Verb or adjective | Noun |
| --- | --- |
| entscheiden | die Entscheidung |
| möglich | die Möglichkeit |
| gesund | die Gesundheit |
| erkennen | die Erkenntnis |

-ung, -keit and -heit nouns are feminine. Clause → noun phrase: *Nachdem der Präsident angekommen war* → *Nach der Ankunft des Präsidenten*.

## Subjective modals

*Sie soll früher Sängerin gewesen sein* (is said to have been); *Er muss krank sein* (must be, I conclude); *Sie will das nicht gewusst haben* (claims not to have known).

## Common errors

- *Er sagte, dass er sei müde* (after dass the verb is last: dass er müde sei).
- *der Entscheidung* as a subject (nominative: die Entscheidung).
- *der von die Schüler gelesene Text* (von den Schülern).`,
      },
      quiz: {
        title: "Grammar & Structures: Year 13 quiz",
        questions: [
          q13.single("Formal reported speech (subjunctive I): « Er sagt, er ___ müde. »", "sei", ["ist", "wurde", "bin"], "The subjunctive I of sein for er/sie/es is sei.", 1),
          q13.short("Form the noun from the verb 'entwickeln' (with article).", "die Entwicklung", "Verbs form nouns with -ung, which are feminine: die Entwicklung.", 1, { acc: ["Entwicklung"] }),
          q13.single("Formal reported speech (subjunctive I): « Sie sagt, sie ___ keine Zeit. »", "habe", ["hat", "hatte", "haben"], "The subjunctive I of haben (er/sie/es) is habe, which differs from the indicative hat.", 2, true),
          q13.single("Choose the correct form: « Die Politiker sagen, sie ___ keine Zeit. »", "hätten", ["haben", "hatten", "hätte"], "The subjunctive I plural (haben) is identical to the indicative, so the subjunctive II is used: sie hätten.", 2),
          q13.short("Form the noun from the adjective 'schwierig' (with article).", "die Schwierigkeit", "Adjectives form nouns with -keit or -heit, which are feminine: die Schwierigkeit.", 2, { acc: ["Schwierigkeit"] }),
          q13.single(
            "Read the text. What do the critics say about the money?\n\n« Die Bürgermeisterin erklärte gestern, die Stadt werde im nächsten Jahr zwei neue Radwege bauen. Der Verkehr sei in den letzten Jahren stark gewachsen, und viele Einwohner hätten sich über gefährliche Kreuzungen beschwert. Kritiker meinen allerdings, das Geld sei besser in den Nahverkehr investiert. Ein Sprecher des Radclubs sagte, man begrüße die Entscheidung, fordere aber weitere Maßnahmen. Die Bauarbeiten sollen im Frühjahr beginnen und rund acht Monate dauern. »",
            "It would be better spent on public transport.",
            ["The cycle paths are too dangerous.", "The building work will take too long.", "The town should employ more planners."],
            "The text says: Kritiker meinen allerdings, das Geld sei besser in den Nahverkehr investiert. The subjunctive I (sei) marks reported speech.",
            2, true,
          ),
          q13.single("Which relative clause means the same as 'die im letzten Jahr renovierte Schule'?", "die Schule, die im letzten Jahr renoviert wurde", ["die Schule, die im letzten Jahr renoviert", "die Schule, die im letzten Jahr renovieren wird", "die Schule, die im letzten Jahr renoviert hat"], "The past participle in an extended attribute has a passive meaning: renoviert → die … renoviert wurde.", 3),
          q13.single("What does 'Er soll sehr reich sein' mean?", "He is said to be very rich.", ["He should be very rich.", "He wants to be very rich.", "He must be very rich."], "Subjective sollen reports what others say: 'is said to be'. Subjective müssen would mean 'must be', and wollen means 'claims to be'.", 2),
          q13.single("Which phrase best replaces the clause 'Weil die Preise gestiegen sind'?", "Wegen der gestiegenen Preise", ["Wegen die gestiegenen Preise", "Wegen der gestiegenen Preisen", "Wegen der Preise gestiegen"], "Wegen takes the genitive plural: der gestiegenen Preise, with the participle as an adjective before the noun.", 3),
          q13.short("Complete with the subjunctive I of gehen (one word): « Sie erzählt, ihr Bruder ______ jeden Tag zu Fuß zur Arbeit. »", "gehe", "For er/sie/es the subjunctive I is the stem + -e: gehe (indicative: geht).", 2, {}),
          q13.multi("Which sentences are correct indirect speech? Choose all that apply.", ["Er sagte, er sei gestern gekommen.", "Sie sagen, sie seien müde."], ["Er sagte, er sei gestern kam.", "Sie sagen, sie seid müde."], "The subjunctive I of sein: er sei, sie seien. The past uses sei/seien + past participle (gekommen).", 3),
          q13.single("Which sentence is a nominal-style version of 'Man kann die Umwelt schützen, indem man weniger Plastik benutzt'?", "Durch die Verringerung des Plastikverbrauchs kann die Umwelt geschützt werden.", ["Durch weniger Plastik zu benutzen kann die Umwelt geschützt werden.", "Weil man weniger Plastik benutzt, kann man die Umwelt schützen.", "Mit die Verringerung des Plastikverbrauchs kann die Umwelt geschützt werden."], "Nominal style turns the verbal clause into a noun phrase: durch + die Verringerung + genitive (des Plastikverbrauchs).", 3),
          q13.written(
            "Write about 100 words in German reporting what an invented politician said in an interview. Use the subjunctive I for at least four statements (including one with the subjunctive II replacement), one extended attribute and two nominalisations.",
            "Die Ministerin erklärte in einem Interview, die Regierung habe die Lage lange unterschätzt. Man müsse jetzt schnell handeln, sagte sie, und die Schulen bekämen mehr Geld. Auf die Frage nach den Kosten antwortete sie, die Ausgaben seien notwendig. Nach der Veröffentlichung der Zahlen sei die Diskussion neu entstanden. Kritiker hätten dagegen bemängelt, dass die Maßnahmen zu spät kämen. Die im Frühjahr beschlossene Reform bedeute eine wichtige Entscheidung für die Zukunft.",
            "Marking guide (15): subjunctive I forms correct (sei, habe, müsse, bedeute) (4); subjunctive II where subjunctive I equals the indicative (hätten, bekämen, kämen) (3); extended attribute with correct endings (3); nominalisation and genitive (3); register, cohesion and spelling (2).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["Konjunktiv I of sein (er / sie)", "er sei, sie seien"],
        ["Konjunktiv I of haben (er)", "er habe"],
        ["Er sagt, er sei früh aufgestanden.", "He says he got up early. (sei + participle for earlier time)"],
        ["When is the subjunctive II used in indirect speech?", "When the subjunctive I equals the indicative: sie hätten, sie kämen"],
        ["das vor zwei Jahren eröffnete Museum", "the museum opened two years ago (extended attribute)"],
        ["die Möglichkeit / die Gesundheit", "possibility / health (adjective + -keit / -heit)"],
        ["Nach der Ankunft des Präsidenten", "After the President's arrival (nominal style)"],
        ["Er soll reich sein.", "He is said to be rich. (subjective sollen)"],
        ["Er muss krank sein.", "He must be ill. (subjective müssen)"],
        ["Sie will das nicht gewusst haben.", "She claims not to have known that. (subjective wollen)"],
      ]),
    },
  },
};
