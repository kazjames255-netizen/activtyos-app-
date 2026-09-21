// German — Holidays & Travel (Year 9). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q9 = qb("dehol", 9);

export const TOPIC: CTopic = {
  key: "dehol",
  topic: "Holidays & Travel",
  subject: "German",
  years: {
    9: {
      year: 9,
      objectives: [
        "Talk about holiday destinations, accommodation and ways of travelling.",
        "Buy tickets and book a room, using polite phrases.",
        "Describe a past holiday using war / hatte and the perfect tense, and say what you will do next year with werden.",
        "Use nach, in and mit correctly with places and transport, and keep the verb in second place.",
      ],
      note: {
        title: "Year 9: Ferien und Reisen",
        body: `## Where and how

| German | English |
| --- | --- |
| die Ferien (plural) | holidays |
| das Hotel / die Jugendherberge | hotel / youth hostel |
| der Campingplatz | campsite |
| die Ferienwohnung | holiday flat |
| das Einzelzimmer / das Doppelzimmer | single room / double room |
| die Fahrkarte / der Bahnsteig | ticket / platform |
| das Flugzeug / der Flughafen | plane / airport |
| der Koffer / das Gepäck | suitcase / luggage |

**nach** goes with towns and most countries (*nach Berlin, nach Griechenland*); feminine or plural countries take **in**: *in die Schweiz* (going), *in der Schweiz* (being there). Transport: *mit dem Zug, mit dem Flugzeug*.

## Booking and buying

- **Zweimal nach Bremen, bitte. Hin und zurück.** = Two tickets to Bremen, please. Return. (**einfach** = single, **hin und zurück** = return.)
- **Ich möchte ein Zimmer für drei Nächte.** = I'd like a room for three nights. **Mit Frühstück?** = With breakfast?

## Talking about the past and future

- **war / waren** (was / were) and **hatte** (had): *Letztes Jahr waren wir in Griechenland. Das Hotel war toll.*
- Perfect tense: **Ich bin nach Schottland gefahren** (movement → sein) and **Ich habe viele Fotos gemacht** (haben).
- Future with **werden**: *Nächstes Jahr werde ich nach Schweden reisen.* You can also use the present tense: *Im August fahre ich nach Wales.*

## Sound tip

**J** in *Jugendherberge* is said "y" (say "YOO-gent-hair-ber-guh"); **v** in *Ferien* is said "f" ("FAIR-ee-en"); **ü** in *Übernachtung* is a rounded "ee"; **eu** is "oy"; **z** in *Zimmer* is "ts"; **sch** in *Schiff* is "sh".

## Common mistakes

- Saying **Ich habe nach Spanien gefahren**: verbs of movement use **sein** (*ich bin gefahren*).
- Putting the verb third: **Letztes Jahr bin ich …**, not "Letztes Jahr ich bin …".
- Putting the infinitive in the wrong place: **werde ich … fliegen**, with the infinitive at the end.`,
      },
      quiz: {
        title: "Holidays & Travel: Year 9 quiz",
        questions: [
          q9.single("What does 'das Doppelzimmer' mean?", "double room", ["single room", "youth hostel", "waiting room"], "Doppel is double and Zimmer is room.", 1),
          q9.single("What does 'der Flughafen' mean?", "airport", ["railway station", "harbour", "flight ticket"], "Flug is flight and Hafen is harbour or port, so Flughafen is airport.", 1),
          q9.single("What does 'Eine Fahrkarte nach Köln, bitte' mean?", "A ticket to Cologne, please.", ["A map of Cologne, please.", "A room in Cologne, please.", "A train from Cologne, please."], "Fahrkarte is ticket and nach Köln is to Cologne.", 1),
          q9.single("What does 'Letztes Jahr war ich in Italien' mean?", "Last year I was in Italy.", ["Next year I will be in Italy.", "Last year I went to Italy by plane.", "Every year I am in Italy."], "Letztes Jahr is last year and war ich is I was.", 2, true),
          q9.short("Complete: Letzten Sommer ____ das Wetter heiß. (Last summer the weather was hot.)", "war", "Das Wetter is a singular thing, and the past of sein for it/he/she is war.", 2, { diag: true }),
          q9.single("What does 'Einfach oder hin und zurück?' mean?", "Single or return?", ["First or second class?", "Window or aisle?", "Cash or card?"], "Einfach is single and hin und zurück is there and back, so return.", 2),
          q9.single("Which sentence correctly says 'Next year I will fly to Spain'?", "Nächstes Jahr werde ich nach Spanien fliegen.", ["Nächstes Jahr ich werde nach Spanien fliegen.", "Nächstes Jahr werde ich fliegen nach Spanien.", "Nächstes Jahr wirst ich nach Spanien fliegen."], "The verb werde is second and the infinitive fliegen goes to the end.", 3),
          q9.single("Which sentence correctly says 'Last summer I travelled to France by train'?", "Letzten Sommer bin ich mit dem Zug nach Frankreich gefahren.", ["Letzten Sommer habe ich mit dem Zug nach Frankreich gefahren.", "Letzten Sommer ich bin mit dem Zug nach Frankreich gefahren.", "Letzten Sommer bin ich mit dem Zug nach Frankreich fahren."], "Fahren uses sein in the perfect tense, the auxiliary is second and the participle gefahren goes to the end.", 3),
          q9.multi("Which of these are types of accommodation? Choose all that apply.", ["das Hotel", "die Jugendherberge", "der Campingplatz"], ["der Bahnsteig", "die Fahrkarte"], "A hotel, a youth hostel and a campsite are places to stay. A platform and a ticket belong to train travel.", 2),
          q9.single("'Wir sind zwei Wochen in Österreich geblieben. Das Wetter war schön und das Hotel hatte einen Pool.' What did the hotel have?", "a swimming pool", ["a restaurant", "a sauna", "a garden"], "Hatte einen Pool means had a pool.", 2),
        ],
      },
      flashcards: cards([
        ["die Ferien", "holidays (plural)"],
        ["campsite", "der Campingplatz"],
        ["die Jugendherberge", "youth hostel"],
        ["suitcase", "der Koffer"],
        ["Ich möchte ein Zimmer für zwei Nächte.", "I would like a room for two nights."],
        ["einfach", "single (ticket)"],
        ["Ich bin nach Berlin gefahren.", "I travelled to Berlin."],
        ["We were in Greece.", "Wir waren in Griechenland."],
        ["Das Hotel hatte einen Pool.", "The hotel had a pool."],
        ["I will fly to Sweden.", "Ich werde nach Schweden fliegen."],
      ]),
    },
  },
};
