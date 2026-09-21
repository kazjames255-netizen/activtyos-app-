// German — School Life (Year 7). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q7 = qb("desl", 7);

export const TOPIC: CTopic = {
  key: "desl",
  topic: "School Life",
  subject: "German",
  years: {
    7: {
      year: 7,
      objectives: [
        "Name school subjects and give opinions with Ich finde … + adjective.",
        "Give a reason with denn or weil and understand that weil sends the verb to the end.",
        "Tell the time (um acht Uhr, Viertel nach, Viertel vor, halb) and talk about a timetable.",
        "Describe a school day: lessons, breaks and routines, using montags / am Montag.",
      ],
      note: {
        title: "Year 7: Das Schulleben",
        body: `## Subjects and opinions

| German | English |
| --- | --- |
| das Fach (die Fächer) | subject |
| der Stundenplan | timetable |
| die Stunde / die Pause | lesson / break |
| die Hausaufgaben (plural) | homework |
| die Naturwissenschaften (plural) | science |
| Informatik / Geschichte / Erdkunde (no article) | computing / history / geography |
| interessant / toll / nützlich | interesting / great / useful |
| langweilig / schwierig / einfach | boring / difficult / easy |

**Ich finde Erdkunde interessant.** = I find geography interesting.

## Giving reasons

- With **denn** (= because) the word order does not change: *Ich mag Sport, denn er ist lustig.*
- With **weil** (= because) the verb goes to the **end**: *Ich mag Erdkunde nicht, weil das Fach schwierig ist.* Learn it as a chunk now; the full rule follows in Year 9.

## Telling the time

**Um acht Uhr** = at 8 o'clock. **Viertel nach** = quarter past (*Viertel nach sieben* = 7:15). **Viertel vor** = quarter to (*Viertel vor sieben* = 6:45). **zehn nach / zehn vor** = ten past / ten to. **halb** means half **to** the next hour: *halb drei* = 2:30, not 3:30!

## Model sentences

- Die Schule beginnt um Viertel nach acht.
- Montags haben wir Informatik, aber am Freitag haben wir Musik.
- Ich finde Geschichte toll, weil die Stunden lustig sind.

## Sound tip

**ch** in *nach* is a rough sound at the back of the throat; **sch** in *Schule* is "sh"; **st** at the start of *Stunde* is "sht"; **au** in *Pause* is "ow"; **ie** in *Viertel* is "ee" and the **v** is said "f" ("FEER-tel").

## Common mistakes

- Reading **halb drei** as 3:30. It is half **to** three, so 2:30.
- Writing "montags" with a capital: the adverb *montags* (on Mondays) is small, but the noun **der Montag** in *am Montag* is capital.
- Putting the verb second after **weil**: it belongs at the end of its clause.`,
      },
      quiz: {
        title: "School Life: Year 7 quiz",
        questions: [
          q7.single("What does 'langweilig' mean?", "boring", ["difficult", "useful", "funny"], "Langweilig means boring; schwierig is difficult.", 1),
          q7.single("What does 'um acht Uhr' mean?", "at eight o'clock", ["at eight minutes", "after eight days", "eight times"], "Um is 'at' with a time, and Uhr is o'clock.", 1),
          q7.single("What does 'Naturwissenschaften' mean?", "science", ["nature walks", "natural history", "computing"], "Naturwissenschaften is the school subject science.", 1),
          q7.single("Um halb neun beginnt die Stunde. What time does the lesson start?", "8:30", ["9:30", "8:45", "9:15"], "Halb neun means half to nine, which is 8:30.", 2, true),
          q7.single("Um Viertel nach zehn. What time is this?", "10:15", ["10:45", "9:45", "10:30"], "Viertel nach means quarter past, so 10:15.", 2),
          q7.short("Complete: Ich finde Mathe interessant, ____ der Lehrer nett ist. (because)", "weil", "Weil means because. It sends the verb (ist) to the end of its clause.", 2, { diag: true, acc: ["da"] }),
          q7.single("What does 'Ich finde Geschichte nützlich' mean?", "I find history useful.", ["I find history difficult.", "I find history funny.", "I find history tiring."], "Nützlich means useful, so Ich finde … nützlich means I find it useful.", 2),
          q7.single("Which sentence is written correctly in German (capitals and word order)?", "Montags haben wir Deutsch.", ["Montags wir haben Deutsch.", "Am montag haben wir Deutsch.", "Montags Deutsch haben wir."], "The verb stays second, and nouns such as Montag and Deutsch start with capitals.", 3),
          q7.multi("Which adjectives give a POSITIVE opinion? Choose all that apply.", ["interessant", "toll", "nützlich"], ["langweilig", "schrecklich"], "Interesting, great and useful are positive. Boring and terrible are negative.", 2),
          q7.written("Write 4–5 sentences in German about your school day. Include two subjects with opinions (use denn or weil), a time and one day of the week.", "Montags habe ich Mathe um neun Uhr. Ich finde Mathe interessant, weil Mathe logisch ist. Ich mag Sport nicht, denn er ist anstrengend. Meine Pause ist um Viertel nach zehn.", "Mark scheme (5 marks): 1 mark each for a subject with Ich finde/mag + a correct adjective, a reason with denn (verb not moved), a reason with weil (verb at the end) or a second reason, a time with um, and a day with montags/am Montag. Accept small spelling slips.", 3),
        ],
      },
      flashcards: cards([
        ["der Stundenplan", "timetable"],
        ["lesson", "die Stunde"],
        ["die Pause", "break"],
        ["homework", "die Hausaufgaben"],
        ["Ich finde Sport toll.", "I find PE great."],
        ["interesting", "interessant"],
        ["Viertel vor sieben", "quarter to seven (6:45)"],
        ["halb drei", "half past two (2:30)"],
        ["montags", "on Mondays"],
        ["Ich mag Musik, denn sie ist schön.", "I like music because it is lovely."],
      ]),
    },
  },
};
