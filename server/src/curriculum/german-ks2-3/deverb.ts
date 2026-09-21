// German — Grammar: Verbs & Tenses (Years 7–9). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q7 = qb("deverb", 7);
const q8 = qb("deverb", 8);
const q9 = qb("deverb", 9);

export const TOPIC: CTopic = {
  key: "deverb",
  topic: "Grammar — Verbs & Tenses",
  subject: "German",
  years: {
    7: {
      year: 7,
      objectives: [
        "Conjugate regular verbs in the present tense, including verbs whose stem ends in -t or -d.",
        "Use the present tense of sein and haben accurately.",
        "Use common stem-changing verbs (a → ä, e → i, e → ie) in the du and er/sie/es forms.",
        "Form sentences with separable verbs and keep the verb in second place in statements.",
      ],
      note: {
        title: "Year 7: the present tense",
        body: `## Regular verbs: take off -en, add the ending

| | spielen (to play) | warten (to wait) |
| --- | --- | --- |
| ich | spiele | warte |
| du | spielst | wartest |
| er / sie / es / man | spielt | wartet |
| wir | spielen | warten |
| ihr | spielt | wartet |
| sie / Sie | spielen | warten |

If the stem ends in **-t** or **-d** (warten, finden, arbeiten) an extra **-e-** is added in the du, er/sie/es and ihr forms: *du findest, er findet, ihr findet.* If the stem ends in s, ß or z (heißen, tanzen), du just takes **-t**: *du heißt, du tanzt.*

## sein and haben (irregular, learn them!)

| | sein | haben |
| --- | --- | --- |
| ich | bin | habe |
| du | bist | hast |
| er / sie / es | ist | hat |
| wir | sind | haben |
| ihr | seid | habt |
| sie / Sie | sind | haben |

## Stem-changing verbs (du and er/sie/es only)

- **a → ä:** schlafen → du schläfst, er schläft; laufen → du läufst, er läuft (fahren → fährst, fährt)
- **e → i:** sprechen → du sprichst, er spricht; helfen → hilft; nehmen → du nimmst, er nimmt; geben → gibt; essen → du isst, er isst
- **e → ie:** sehen → du siehst, er sieht; lesen → liest

## Separable verbs and word order

The prefix jumps to the **end**: *einkaufen* → **Ich kaufe am Samstag ein.** *fernsehen* → **Er sieht abends fern.** Others: aufstehen, anrufen, ankommen, mitkommen. The conjugated verb is always in **second place**: *Am Samstag kaufe ich ein.*

## Sound tip

**ä** is like the "e" in "bed" (*läuft* = "loyft" with **äu** = "oy"); **ie** is "ee" (*siehst*); **ei** is "eye" (*heißen*); the **h** in *sieht* is silent and just lengthens the vowel.

## Common mistakes

- Forgetting the extra -e-: **du findest**, not "du findst".
- Using the stem change for ich: it is **ich esse**, **ich fahre**, but **er isst**, **er fährt**.
- Leaving the separable prefix attached: *Ich fernsehe* is wrong; it is **Ich sehe fern.**`,
      },
      quiz: {
        title: "Grammar — Verbs & Tenses: Year 7 quiz",
        questions: [
          q7.single("Which is the correct ich form of 'kochen'?", "koche", ["kochst", "kocht", "kochen"], "For ich, take off -en and add -e: ich koche.", 1),
          q7.single("Er ____ einen Hund. Which form of 'haben' fits?", "hat", ["habe", "hast", "haben"], "The er/sie/es form of haben is hat.", 1),
          q7.short("Complete with the correct form of 'essen': Meine Schwester ____ gern Pizza.", "isst", "Essen is a stem-changer (e → i): er/sie isst. The stem s + -t becomes just isst.", 2, { diag: true }),
          q7.single("Which is the du form of 'fahren' in: Du ____ mit dem Bus?", "fährst", ["fahrst", "fährt", "fahre"], "Fahren changes a → ä in the du and er/sie/es forms: du fährst.", 2),
          q7.short("Complete with the correct form of 'haben': Ihr ____ viel Zeit.", "habt", "The ihr form of haben is habt.", 2, { diag: true }),
          q7.single("Which sentence is correct?", "Ich stehe um sieben Uhr auf.", ["Ich aufstehe um sieben Uhr.", "Ich stehe aufstehen um sieben Uhr.", "Um sieben Uhr ich stehe auf."], "With a separable verb the conjugated verb is second and the prefix goes to the end.", 2),
          q7.single("Which is the du form of 'arbeiten'?", "arbeitest", ["arbeitst", "arbeitet", "arbeite"], "The stem ends in -t, so an extra -e- is needed: du arbeitest.", 2),
          q7.single("Which sentence is correct: 'On Friday we go swimming'?", "Am Freitag gehen wir schwimmen.", ["Am Freitag wir gehen schwimmen.", "Am Freitag gehen schwimmen wir.", "Wir am Freitag gehen schwimmen."], "The verb must be the second idea in the sentence, after 'Am Freitag'.", 3),
          q7.multi("Which verb forms are correct? Choose all that apply.", ["er liest", "du siehst", "sie nimmt"], ["er lest", "ich fährst"], "Lesen and sehen change e → ie (liest, siehst) and nehmen changes e → i (nimmt). 'Ich fährst' mixes up the ich and du endings.", 2),
          q7.written("Write 4 sentences in German about your daily routine. Use at least one separable verb, one stem-changing verb and the verb sein or haben.", "Ich stehe um sieben Uhr auf. Ich esse ein Brot zum Frühstück. Mein Bruder fährt mit dem Bus, aber ich laufe zur Schule. Wir haben um vier Uhr Schulschluss. Ich bin dann müde.", "Mark scheme (5 marks): 1 mark each for a correct separable verb with the prefix at the end, a correct stem-changing form (du/er/sie), a correct form of sein or haben, verb in second place after a time expression, and correct endings on the other verbs. Accept small spelling slips.", 3),
        ],
      },
      flashcards: cards([
        ["ich / du / er (spielen)", "ich spiele · du spielst · er spielt"],
        ["ich bin, du bist, er ...", "ist"],
        ["ihr habt", "you (plural) have"],
        ["du findest", "you find (extra -e- after a -d stem)"],
        ["er fährt", "he travels (fahren: a → ä)"],
        ["sie isst", "she eats (essen: e → i)"],
        ["du siehst", "you see (sehen: e → ie)"],
        ["Ich sehe abends fern.", "I watch TV in the evening. (separable: fernsehen)"],
        ["Where does the separable prefix go in a statement?", "To the end of the sentence"],
        ["Which place does the conjugated verb take in a statement?", "Second place"],
      ]),
    },
    8: {
      year: 8,
      objectives: [
        "Form the perfect tense of regular and irregular verbs with haben, and of movement verbs with sein.",
        "Form participles of separable verbs and verbs with inseparable prefixes.",
        "Use the modal verbs können, müssen, wollen, dürfen, sollen with an infinitive at the end.",
        "Talk about the future with werden + infinitive.",
      ],
      note: {
        title: "Year 8: perfect tense, modal verbs and the future",
        body: `## The perfect tense = haben / sein + past participle (at the end)

Most verbs use **haben**. Verbs of movement or change (gehen, fahren, kommen, fliegen, bleiben, aufstehen) use **sein**.

| Type | Rule | Examples |
| --- | --- | --- |
| regular | **ge- + stem + -t** | spielen → gespielt, arbeiten → gearbeitet, kaufen → gekauft |
| irregular | **ge- + stem + -en** (stem may change) | essen → gegessen, sehen → gesehen, trinken → getrunken, schreiben → geschrieben |
| with sein | movement or change | gehen → gegangen, fliegen → geflogen, bleiben → geblieben |
| separable | prefix + ge | einkaufen → eingekauft, anrufen → angerufen, aufstehen → aufgestanden |
| no ge- | be-, ver-, er-, ent- and -ieren | besuchen → besucht, verstehen → verstanden, telefonieren → telefoniert |

*Gestern habe ich einen Film gesehen.* *Am Sonntag bin ich zu Hause geblieben.* The participle goes to the **end**.

## Modal verbs (with an infinitive at the end)

| | können | müssen | wollen | dürfen | sollen |
| --- | --- | --- | --- | --- | --- |
| ich / er | kann | muss | will | darf | soll |
| du | kannst | musst | willst | darfst | sollst |
| wir / sie | können | müssen | wollen | dürfen | sollen |

*Ich kann gut singen.* *Wir müssen am Montag früh aufstehen.* **Careful:** *er muss nicht arbeiten* = he does **not have to** work; "must not" is **darf nicht**.

## The future with werden

ich **werde**, du **wirst**, er/sie/es **wird**, wir **werden**, ihr **werdet**, sie **werden** + infinitive at the end: *Morgen werde ich viel lernen.*

## Sound tip

**ge-** at the start of a participle is a short "guh" (*gespielt* = "guh-SHPEELT"); **ö** in *können*, *möchte* is a rounded "ay/uh"; **ü** in *müssen*, *dürfen* is a rounded "ee"; **ie** is "ee" (*gesehen*, *fliegen*).

## Common mistakes

- Using haben for movement: **Ich bin geflogen**, not "Ich habe geflogen".
- Putting the participle or the infinitive early: **Ich habe Tennis gespielt**, **Ich muss aufräumen**.
- Adding ge- to a verb with an inseparable prefix: **besucht**, not "gebesucht".`,
      },
      quiz: {
        title: "Grammar — Verbs & Tenses: Year 8 quiz",
        questions: [
          q8.single("What does 'Ich habe Fußball gespielt' mean?", "I played football.", ["I play football.", "I will play football.", "I like football."], "Haben + gespielt is the perfect tense: I played / I have played.", 1),
          q8.single("Which is the past participle of 'machen'?", "gemacht", ["gemachen", "gemachtet", "gemach"], "Machen is regular: ge- + stem + -t = gemacht.", 1),
          q8.short("Complete: Gestern ____ ich ins Kino gegangen.", "bin", "Gehen is a movement verb, so the perfect uses sein: ich bin gegangen.", 2, { diag: true }),
          q8.single("Wir ____ nach Berlin gefahren. Which auxiliary verb fits?", "sind", ["haben", "werden", "hat"], "Fahren is a movement verb, so it takes sein; the wir form is sind.", 2),
          q8.short("Complete: Ich ____ gut schwimmen. (I can swim well.)", "kann", "The ich form of können is kann, and the infinitive schwimmen goes to the end.", 2, { diag: true }),
          q8.single("What does 'Du musst nicht kommen' mean?", "You don't have to come.", ["You mustn't come.", "You can't come.", "You may not come."], "Nicht müssen means not having to. 'Mustn't' would be darf nicht.", 3),
          q8.single("Which sentence correctly says 'Tomorrow I will play tennis'?", "Morgen werde ich Tennis spielen.", ["Morgen ich werde Tennis spielen.", "Morgen werde ich spielen Tennis.", "Morgen wirst ich Tennis spielen."], "Werde is second and the infinitive spielen goes to the end.", 2),
          q8.single("Which is the perfect tense of 'Er sieht fern'?", "Er hat ferngesehen.", ["Er hat gefernsehen.", "Er ist ferngesehen.", "Er hat gesehen fern."], "For a separable verb ge- goes between prefix and stem: fern + ge + sehen. Fernsehen takes haben.", 3),
          q8.multi("Which past participles are correct? Choose all that apply.", ["gegessen", "getrunken", "gespielt"], ["geessen", "getrinkt"], "Essen and trinken are irregular (gegessen, getrunken). Spielen is regular (gespielt).", 2),
          q8.single("Which sentence correctly says 'At home I must help'?", "Zu Hause muss ich helfen.", ["Zu Hause ich muss helfen.", "Zu Hause muss ich zu helfen.", "Zu Hause muss helfen ich."], "After a modal verb the infinitive goes last, with no zu.", 2),
        ],
      },
      flashcards: cards([
        ["Perfect tense = ?", "haben / sein + past participle at the end"],
        ["gespielt", "played (spielen)"],
        ["participle of 'trinken'", "getrunken"],
        ["participle of 'besuchen'", "besucht (no ge- with be-)"],
        ["participle of 'aufstehen'", "aufgestanden (uses sein)"],
        ["ich kann, du kannst", "I can, you can"],
        ["Er muss nicht arbeiten.", "He does not have to work."],
        ["I am not allowed to swim.", "Ich darf nicht schwimmen."],
        ["du wirst", "you will (werden)"],
        ["Ich werde nach Hause gehen.", "I will go home."],
      ]),
    },
    9: {
      year: 9,
      objectives: [
        "Use the simple past (Präteritum) of sein, haben and the modal verbs.",
        "Form and use the imperative for du, ihr and Sie.",
        "Use würde + infinitive, hätte and wäre for wishes and the conditional.",
        "Keep the verb in the right place in a wenn-clause and the main clause after it.",
      ],
      note: {
        title: "Year 9: simple past, imperative and the conditional",
        body: `## The simple past (Präteritum) of sein, haben and modals

| | sein | haben | können | müssen |
| --- | --- | --- | --- | --- |
| ich | war | hatte | konnte | musste |
| du | warst | hattest | konntest | musstest |
| er / sie / es | war | hatte | konnte | musste |
| wir | waren | hatten | konnten | mussten |
| ihr | wart | hattet | konntet | musstet |
| sie / Sie | waren | hatten | konnten | mussten |

Modals lose their umlaut in the past: können → konnte, dürfen → durfte, wollen → wollte, sollen → sollte. Also: **es gab** = there was / there were. *Ich konnte nicht schlafen. Wir hatten viel Spaß.*

## The imperative (giving orders)

- **du:** the stem, no du and no -st: *Geh nach Hause! Mach die Tür zu!* Verbs with e → i / e → ie keep the change: *Sieh! Gib! Nimm!* (a → ä is dropped: *Fahr langsam!*)
- **ihr:** as the present: *Geht! Macht das Fenster zu!*
- **Sie:** verb + Sie: *Gehen Sie! Nehmen Sie Platz!*
- **sein:** *Sei ruhig! Seid ruhig! Seien Sie ruhig!*

## The conditional (would / wishes)

**würde** + infinitive at the end: *Ich würde gern Ski fahren.* Forms: ich würde, du würdest, er würde, wir würden, ihr würdet, sie würden. Also **hätte** (would have) and **wäre** (would be): *Ich hätte gern einen Hund.* A wenn-clause sends its verb to the end, and the main clause then starts with its verb: **Wenn ich reich wäre, würde ich ein Boot kaufen.**

## Sound tip

**ä** in *hätte* and *wäre* is like the "e" in "bed"; **ü** in *würde* is a rounded "ee"; **w** is "v" (*war*, *würde*); **ie** in *Sie* is "ee"; **au** in *Auto* is "ow".

## Common mistakes

- Using an umlaut in the past of modals: **er konnte**, not "er könnte" (that is the conditional).
- Adding du to the imperative: **Geh!**, not "Du geh!".
- Putting the verb second in a wenn-clause: **Wenn es kalt wäre, …**, not "Wenn es wäre kalt".`,
      },
      quiz: {
        title: "Grammar — Verbs & Tenses: Year 9 quiz",
        questions: [
          q9.single("What does 'ich war' mean?", "I was", ["I am", "I will be", "I have"], "War is the simple past of sein: I was.", 1),
          q9.single("What does 'wir hatten' mean?", "we had", ["we have", "we would have", "we will have"], "Hatten is the simple past of haben.", 1),
          q9.short("Complete in the past tense: Er ____ gestern nicht kommen. (können)", "konnte", "The simple past of können is konnte, without an umlaut.", 2, { diag: true }),
          q9.short("Write the du imperative of 'kommen': ____ bitte her!", "Komm", "The du imperative is the stem with no du and no -st: Komm!", 2, { diag: true }),
          q9.single("Which is the du imperative of 'lesen'?", "Lies!", ["Les!", "Lese!", "Lest!"], "Lesen changes e → ie, and the du imperative keeps the change: Lies!", 2),
          q9.single("Which sentence is the formal (Sie) imperative for 'Come here, please'?", "Kommen Sie bitte her!", ["Komm Sie bitte her!", "Kommt Sie bitte her!", "Sie kommen bitte her!"], "The formal imperative is the infinitive form + Sie, with the separable prefix at the end.", 2),
          q9.single("What does 'Ich würde gern nach Italien fahren' mean?", "I would like to travel to Italy.", ["I travelled to Italy.", "I will be in Italy.", "I was able to go to Italy."], "Würde + infinitive is 'would', and gern means with pleasure.", 2),
          q9.single("Which sentence correctly says 'If I had more time, I would read more'?", "Wenn ich mehr Zeit hätte, würde ich mehr lesen.", ["Wenn ich hätte mehr Zeit, würde ich mehr lesen.", "Wenn ich mehr Zeit hätte, ich würde mehr lesen.", "Wenn ich mehr Zeit hatte, würde ich mehr lesen."], "In the wenn-clause the verb hätte goes to the end, and the main clause then begins with its verb würde.", 3),
          q9.multi("Which are correct simple past forms? Choose all that apply.", ["ich hatte", "du warst", "wir konnten"], ["er warst", "ich sollest"], "Hatte, warst and konnten fit their subjects. Er needs war and ich needs sollte.", 2),
          q9.single("Which sentence means 'Don't be so loud!' (to one friend)?", "Sei nicht so laut!", ["Bist nicht so laut!", "Sein nicht so laut!", "Seid nicht so laut!"], "The du imperative of sein is sei. Seid is for several friends (ihr).", 3),
        ],
      },
      flashcards: cards([
        ["ich war / du warst", "I was / you were"],
        ["hatten", "had (wir, sie)"],
        ["he could (past of können)", "er konnte"],
        ["ich musste", "I had to"],
        ["es gab", "there was / there were"],
        ["Geh nach Hause!", "Go home! (du)"],
        ["Nehmen Sie Platz!", "Take a seat! (formal)"],
        ["Ich würde gern Ski fahren.", "I would like to go skiing."],
        ["Ich hätte gern einen Hund.", "I would like a dog."],
        ["Wenn ich reich wäre, ...", "If I were rich, ..."],
      ]),
    },
  },
};
