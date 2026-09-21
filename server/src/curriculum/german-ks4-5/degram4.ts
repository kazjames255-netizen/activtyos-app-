// German — Grammar: Advanced Verbs & Structures (GCSE, Years 10 and 11). Original content aligned to the DfE GCSE modern foreign languages subject content (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q10 = qb("degram4", 10);
const q11 = qb("degram4", 11);

export const TOPIC: CTopic = {
  key: "degram4",
  topic: "Grammar — Advanced Verbs & Structures",
  subject: "German",
  years: {
    10: {
      year: 10,
      subtopic: "GCSE Year 10",
      yearsCovered: [10],
      objectives: [
        "Form and use the present, perfect, simple past (esp. sein, haben and modals), future (werden) and the subjunctive II (würde + infinitive, hätte, wäre).",
        "Use modal verbs with an infinitive at the end.",
        "Use separable and reflexive verbs in the present and perfect tenses.",
        "Use subordinate clauses with weil, dass, wenn and obwohl, with the verb at the end and inversion in the following main clause.",
        "Form relative clauses with der, die, das, den, dem, denen.",
      ],
      note: {
        title: "Year 10: tenses, modals, separable and reflexive verbs, subordinate and relative clauses",
        body: `## The tenses

| Tense | How to form it | Example |
| --- | --- | --- |
| Präsens | stem + -e, -st, -t, -en, -t, -en | Sie fährt jeden Tag mit dem Bus. |
| Perfekt | haben / sein + past participle | Er hat Tee getrunken. Sie ist nach Hamburg geflogen. |
| Präteritum | weak: stem + -te; strong: new stem | Es war kalt. Wir hatten Hunger. |
| Futur I | werden + infinitive | Ich werde bald Auto fahren lernen. |
| Konjunktiv II | würde + infinitive; hätte, wäre | Ich würde gern in Wien wohnen. |

Speak in the Perfekt; use the Präteritum for *war, hatte* and the modals (*musste, konnte*) and in stories.

## Modals, separable and reflexive verbs

- After a modal the infinitive goes last: *Du musst leise sein.*
- Separable verbs split in main clauses: *Der Zug kommt um acht Uhr an.* Perfekt: *Er ist angekommen.*
- Reflexive pronouns: mich, dich, sich, uns, euch, sich: *Er hat sich verspätet.*

## Verb-final clauses

**weil, dass, wenn, obwohl** send the finite verb to the end. If that clause comes first, the next verb follows the comma: *Wenn es kalt ist, bleibe ich zu Hause.*

## Relative clauses

The pronoun takes its gender and number from the noun and its case from its job in the clause. The verb is last.

| | masc. | fem. | neut. | plural |
| --- | --- | --- | --- | --- |
| Nom. | der | die | das | die |
| Acc. | den | die | das | die |
| Dat. | dem | der | dem | denen |

*Das Buch, das ich lese, ist spannend.*

## Common errors

- *Ich habe nach Hamburg gefahren* (movement: bin gefahren).
- *Ich freue auf das Wochenende* (the reflexive pronoun is missing: Ich freue mich auf …).
- *Wenn es kalt ist, ich bleibe zu Hause* (verb first after the comma: bleibe ich).`,
      },
      quiz: {
        title: "Grammar — Advanced Verbs & Structures: Year 10 quiz",
        questions: [
          q10.single("Choose the correct participle: « Ich habe meine Hausaufgaben ______. »", "gemacht", ["gemachen", "gemachte", "machen"], "Machen is a weak verb, so the past participle is ge- + stem + -t: gemacht.", 1),
          q10.short("Complete with the simple past of sein (one word): « Gestern ______ ich krank. »", "war", "Sein is very often used in the simple past: ich war, du warst, er war.", 1, {}),
          q10.single("Choose the correct auxiliary: « Wir ___ gestern ins Kino gegangen. »", "sind", ["haben", "werden", "wurden"], "Gehen is a verb of movement, so the perfect tense uses sein: wir sind gegangen.", 2, true),
          q10.single("Choose the correct participle: « Ich bin heute früh ______. » (aufstehen)", "aufgestanden", ["aufgestehen", "aufgestandet", "gestanden auf"], "Aufstehen is separable and strong: ge goes between the prefix and the stem, and the participle is standen: aufgestanden.", 2),
          q10.single("Which sentence means 'We met yesterday'?", "Wir haben uns gestern getroffen.", ["Wir sind uns gestern getroffen.", "Wir haben gestern getroffen uns.", "Wir haben uns gestern treffen."], "Sich treffen is reflexive and takes haben. The participle goes to the end: haben uns gestern getroffen.", 2),
          q10.single(
            "Read the text. What is the writer going to do tomorrow?\n\n« Gestern war ein anstrengender Tag. Ich bin um sechs Uhr aufgestanden, denn ich hatte um halb acht einen Test. Nach der Schule habe ich mit meiner Freundin Pizza gegessen, und dann sind wir ins Schwimmbad gegangen. Dort haben wir zwei Stunden trainiert, weil wir im Juli an einem Wettbewerb teilnehmen möchten. Am Abend war ich so müde, dass ich schon um neun Uhr eingeschlafen bin. Morgen werde ich ausschlafen, denn wir haben keine Schule. Ich werde wahrscheinlich Freunde treffen und im Park Fußball spielen. »",
            "Sleep in, then probably meet friends and play football.",
            ["Take a test at half past seven.", "Train for the swimming competition.", "Go to school early."],
            "Morgen werde ich ausschlafen … Ich werde wahrscheinlich Freunde treffen und im Park Fußball spielen. Both verbs use the future with werden.",
            2, true,
          ),
          q10.single("Choose the correct conjunction: « Ich gehe spazieren, ___ es regnet. » (although)", "obwohl", ["weil", "denn", "deshalb"], "Obwohl introduces a contrast (although) and sends the verb to the end: obwohl es regnet.", 2),
          q10.single("Choose the correct pronoun: « Der Mann, ___ neben mir wohnt, ist Arzt. »", "der", ["den", "dem", "die"], "The pronoun is masculine singular (Mann) and is the subject of the relative clause (wohnt), so nominative: der.", 2),
          q10.single("Choose the correct pronoun: « Die Frau, ___ ich gestern geholfen habe, heißt Anna. »", "der", ["die", "den", "deren"], "The antecedent Frau is feminine, and helfen takes the dative, so the pronoun is dative feminine: der.", 3),
          q10.short("Complete with the subjunctive II of haben (one word): « Wenn wir mehr Zeit ______, würden wir dich besuchen. »", "hätten", "Wenn + hätte/wäre expresses an unreal condition: wir hätten. The main clause uses würde + infinitive.", 3, { na: true }),
          q10.short("Translate into German: 'I stayed at home because I was ill.'", "Ich bin zu Hause geblieben, weil ich krank war.", "Bleiben takes sein in the perfect; weil sends the verb to the end: weil ich krank war.", 3, { acc: ["Ich blieb zu Hause, weil ich krank war.", "Ich bin zuhause geblieben, weil ich krank war.", "Ich blieb zuhause, weil ich krank war.", ...["zu Hause", "zuhause", "daheim"].flatMap((h) => [`Ich bin ${h} geblieben, weil ich krank war.`, `Ich bin ${h} geblieben, weil ich krank gewesen bin.`, `Ich blieb ${h}, weil ich krank war.`, `Weil ich krank war, bin ich ${h} geblieben.`, `Weil ich krank war, blieb ich ${h}.`])] }),
          q10.written(
            "Write 5–6 sentences in German about yesterday and tomorrow. Include a perfect tense with sein, war or hatte, a future with werden, a weil or wenn clause, a relative clause and one würde/hätte/wäre sentence.",
            "Gestern war ich sehr müde, weil ich spät ins Bett gegangen bin. Ich bin trotzdem in die Schule gegangen und habe zwei Klassenarbeiten geschrieben. Am Nachmittag habe ich mich mit meiner Freundin getroffen, die in der Nähe wohnt. Morgen werde ich früh aufstehen und lernen. Wenn ich mehr Zeit hätte, würde ich öfter Sport machen.",
            "Marking guide (12): correct auxiliary and participle in the perfect (2); simple past of sein/haben or a modal (1); werden + infinitive at the end (2); subordinate clause with the verb last and inversion after it (3); relative pronoun with correct gender/case (2); würde/hätte/wäre used correctly (1); spelling and capitals (1).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["Perfekt of machen: er …", "er hat gemacht"],
        ["Perfekt of gehen: sie …", "sie ist gegangen"],
        ["Simple past of sein: ich / wir", "ich war / wir waren"],
        ["Simple past of haben: ich / wir", "ich hatte / wir hatten"],
        ["Future tense formation", "werden + infinitive at the end: Ich werde gehen."],
        ["Konjunktiv II of haben / sein (ich)", "ich hätte / ich wäre"],
        ["Ich wasche mich. (what is 'mich'?)", "the reflexive pronoun (accusative)"],
        ["Where does the verb go after weil, dass, wenn, obwohl?", "To the end of the clause"],
        ["Relative pronoun, dative plural", "denen"],
        ["Wenn es regnet, … (what follows the comma?)", "the verb: Wenn es regnet, bleibe ich zu Hause."],
      ]),
    },
    11: {
      year: 11,
      subtopic: "GCSE Year 11",
      yearsCovered: [11],
      objectives: [
        "Form and use the pluperfect (hatte/war + past participle).",
        "Form and use the present and simple past passive (werden + past participle), with von + dative for the agent.",
        "Report what someone says with dass, and recognise the subjunctive I (er sei, sie habe) in reported speech.",
        "Use um … zu and da-/wo-compounds (darauf, worauf).",
        "Use the genitive (des Mannes, wegen des Wetters) and adjective endings in the nominative, accusative, dative and genitive.",
      ],
      note: {
        title: "Year 11: pluperfect, passive, reported speech, genitive and adjective endings",
        body: `## Pluperfect

**hatte / war + past participle** for an action before another past action: *Nachdem ich geduscht hatte, habe ich gefrühstückt.* *Sie war schon gegangen, als ich ankam.*

## Passive

**werden + past participle** (last): *Die Brücke wird repariert. Der Brief wurde gestern geschickt.* The doer is **von + dative**: *von meiner Tante.*

## Reported speech

*Ben sagt: „Ich habe Hunger." → Ben sagt, dass er Hunger hat.* Pronouns change and dass sends the verb last. Newspapers use the subjunctive I: *sie sei müde, er habe Hunger.*

## da- and wo- compounds

Preposition + thing or idea: **da(r)-** (statement), **wo(r)-** (question). Add -r- before a vowel: *Ich denke oft daran. Woran denkst du? Worüber sprecht ihr?*

## Genitive

| masc. | fem. | neut. | plural |
| --- | --- | --- | --- |
| des Mannes | der Frau | des Kindes | der Kinder |

Masculine and neuter nouns add **-(e)s**. Used after *wegen, trotz, während*: *trotz des Wetters; das Haus meiner Eltern.*

## Adjective endings

| after der/die/das | masc. | fem. | neut. | plural |
| --- | --- | --- | --- | --- |
| Nom. | -e | -e | -e | -en |
| Acc. | -en | -e | -e | -en |
| Dat. / Gen. | -en | -en | -en | -en |

After *ein*: masculine nominative **-er**, neuter nominative and accusative **-es**: *ein alter Mann, ein kleines Kind.* After **um … zu** the infinitive is last: *Ich spare, um ein Rad zu kaufen.*

## Common errors

- *wegen dem Wetter* (standard: wegen des Wetters).
- *Ich denke an es* (say: daran).
- *ein neuer Auto* (das Auto: ein neues Auto).`,
      },
      quiz: {
        title: "Grammar — Advanced Verbs & Structures: Year 11 quiz",
        questions: [
          q11.single("Choose the correct verb form: « Das Haus ___ gerade gebaut. » (is being built)", "wird", ["wirst", "wurden", "haben"], "The present passive is werden + past participle; das Haus is third person singular: wird gebaut.", 1),
          q11.short("Complete with one word: « Das ist das Auto ___ Lehrers. »", "des", "The genitive of masculine and neuter nouns uses des and adds -s: des Lehrers.", 1, {}),
          q11.single("Choose the correct auxiliary: « Nachdem wir gegessen ___, gingen wir spazieren. »", "hatten", ["haben", "hätten", "waren"], "The pluperfect uses the simple past of the auxiliary: wir hatten gegessen (essen takes haben).", 2, true),
          q11.single("Choose the correct form: « Das Museum ___ 1998 eröffnet. »", "wurde", ["wird", "hat", "würde"], "For a passive in the past use wurde + past participle: wurde eröffnet.", 2),
          q11.single("Choose the correct ending: « Ich kaufe einen ___ Mantel. »", "warmen", ["warme", "warmer", "warmes"], "Mantel is masculine, and after einen (accusative masculine) the adjective ends in -en: einen warmen Mantel.", 2),
          q11.single("Choose the correct ending: « Ich helfe der ___ Frau. »", "alten", ["alte", "alter", "altes"], "Helfen takes the dative, and after der (dative feminine) the adjective always ends in -en: der alten Frau.", 3),
          q11.short("Complete with one word: « Nächste Woche fahren wir nach Italien. Ich freue mich ______. »", "darauf", "Sich freuen auf refers to something in the future. Reference to a thing or idea uses da- + preposition: darauf.", 2, { na: false }),
          q11.single(
            "Read the text. What is the building used for today?\n\n« Das alte Rathaus unserer Stadt wurde im Jahr 1650 gebaut. Nachdem es im Krieg zerstört worden war, wurde es in den fünfziger Jahren wieder aufgebaut. Heute wird es als Museum genutzt. Die Ausstellung zeigt das Leben der Menschen im 17. Jahrhundert. Besonders beliebt ist der große Saal, in dem früher der Bürgermeister seine Gäste empfing. Wegen der hohen Kosten wird das Dach im Moment nicht repariert, aber im nächsten Jahr soll es erneuert werden. »",
            "As a museum.",
            ["As the town hall.", "As the mayor's home.", "As a school."],
            "The text says: Heute wird es als Museum genutzt. The mayor received guests there in the past (früher).",
            2, true,
          ),
          q11.single("Which sentence correctly reports: Anna sagt: „Ich bin müde.“?", "Anna sagt, dass sie müde ist.", ["Anna sagt, dass ich müde bin.", "Anna sagt, dass sie ist müde.", "Anna sagt, dass sie müde bin."], "In reported speech the pronoun changes (ich → sie), the verb agrees with it (ist) and dass sends the verb to the end.", 2),
          q11.single("Which phrase means 'because of the rain'?", "wegen des Regens", ["wegen des Regen", "wegen der Regens", "wegen den Regens"], "Wegen takes the genitive; der Regen is masculine, so des Regens (noun + -s).", 2),
          q11.single("Which is the correct question? 'What are you afraid of?'", "Wovor hast du Angst?", ["Wofür hast du Angst?", "Wodurch hast du Angst?", "Womit hast du Angst?"], "Angst haben vor + dative: the question word is wo(r) + vor = wovor.", 3),
          q11.short("Translate into German: 'The books are printed in Leipzig.'", "Die Bücher werden in Leipzig gedruckt.", "Present passive = werden + past participle at the end; the subject die Bücher is plural, so werden.", 3, { na: true, acc: ["In Leipzig werden die Bücher gedruckt."] }),
          q11.multi("Which phrases have the correct adjective endings? Choose all that apply.", ["mit dem kleinen Hund", "ein interessantes Buch", "die neue Lehrerin"], ["mit dem kleine Hund", "ein interessanter Buch"], "After mit dem (dative) the ending is -en. Buch is neuter, so ein interessantes Buch; die neue Lehrerin is nominative feminine.", 3),
          q11.written(
            "Write 5–6 sentences in German about a place in your town. Include one passive sentence, one pluperfect sentence with 'nachdem', one genitive phrase, one da- or wo- compound and adjective endings after ein/der.",
            "Das Freibad in unserer Stadt wurde vor vielen Jahren gebaut. Nachdem es geschlossen worden war, wurde es wieder renoviert. Heute ist es der beliebteste Treffpunkt der Jugendlichen. Ich denke oft daran, wie schön die Sommertage dort waren. Wegen des schlechten Wetters ist das Bad im Winter leider geschlossen. Trotzdem freue ich mich schon auf einen warmen Julitag.",
            "Marking guide (12): passive with werden and a correct participle (2); pluperfect with hatte/war + participle (2); genitive article and noun ending, e.g. wegen des …s (2); da-/wo- compound (2); adjective endings (2); word order, spelling and capitals (2).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["Pluperfect formation", "hatte / war + past participle: Ich hatte gegessen."],
        ["Present passive: das Haus …", "wird gebaut (werden + participle)"],
        ["Past passive: das Haus …", "wurde gebaut"],
        ["Agent in the passive: 'by my aunt'", "von meiner Tante (von + dative)"],
        ["Genitive masculine / feminine", "des Mannes / der Frau"],
        ["wegen, trotz, während + which case?", "Genitive: wegen des Wetters"],
        ["daran / woran", "on it, about it / what … of? (an + da-/wo-)"],
        ["darüber / worüber", "about it / what about? (add -r- before a vowel)"],
        ["ein alter Mann / ein kleines Kind", "-er in the masc. nominative, -es in the neut. nom./acc. after ein"],
        ["Ben sagt, dass er Hunger hat.", "Ben says (that) he is hungry. (reported speech: verb last)"],
      ]),
    },
  },
};
