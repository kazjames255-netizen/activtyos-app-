// German — Numbers, Colours & Days (Year 3). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q3 = qb("denum", 3);

export const TOPIC: CTopic = {
  key: "denum",
  topic: "Numbers, Colours & Days",
  subject: "German",
  years: {
    3: {
      year: 3,
      objectives: [
        "Count from 1 to 20 and say simple sums in German.",
        "Name common colours and use them with 'ist' in a short sentence.",
        "Name the days of the week and say 'on Monday' with am.",
        "Notice patterns in spelling and sound, such as -zehn for the teens and the capital letters on days.",
      ],
      note: {
        title: "Year 3: Zahlen, Farben und Tage",
        body: `## Numbers 1–20

1 eins · 2 zwei · 3 drei · 4 vier · 5 fünf · 6 sechs · 7 sieben · 8 acht · 9 neun · 10 zehn
11 elf · 12 zwölf · 13 dreizehn · 14 vierzehn · 15 fünfzehn · 16 sechzehn · 17 siebzehn · 18 achtzehn · 19 neunzehn · 20 zwanzig

From 13 to 19 add **-zehn** to the small number. Watch out: sechs → sech**zehn** and sieben → sieb**zehn** lose letters. Sums: *Vier plus vier ist acht.* *Zehn minus drei ist sieben.*

## Colours (small letters, they are adjectives)

rot (red), blau (blue), gelb (yellow), grün (green), schwarz (black), weiß (white), braun (brown), orange (orange), rosa (pink), grau (grey), lila (purple).

## Days (all are der-words, always with a capital)

| German | English |
| --- | --- |
| der Montag / der Dienstag | Monday / Tuesday |
| der Mittwoch / der Donnerstag | Wednesday / Thursday |
| der Freitag / der Samstag | Friday / Saturday |
| der Sonntag | Sunday |

Say **am** + day for "on": *am Dienstag* = on Tuesday.

## Model sentences

- Die Banane ist gelb. Der Himmel ist blau.
- Ich habe zwei Katzen und vier Fische.
- Am Sonntag ist die Schule zu. (School is closed on Sunday.)

## Sound tip

**z** is said "ts" (*zwei* = "tsvy", *zehn* = "tsayn"); **w** is "v"; **ei** is "eye", **ie** is "ee": *vier* is "feer"; **ü** in *fünf* and *grün* is a rounded "ee"; **sch** in *schwarz* is "sh".

## Common mistakes

- Reading **zwei** as "zwee": it is "tsvy".
- Mixing up **sechzehn** (16) and **siebzehn** (17) with sechs/sieben.
- Writing days with a small letter: *montag* is wrong, it is **Montag**.`,
      },
      quiz: {
        title: "Numbers, Colours & Days: Year 3 quiz",
        questions: [
          q3.single("What does 'fünf' mean?", "5", ["4", "6", "15"], "Fünf is 5. Vier is 4, sechs is 6 and fünfzehn is 15.", 1),
          q3.single("Which German word means 'seven'?", "sieben", ["sechs", "siebzehn", "elf"], "Sieben is 7. Siebzehn is 17 and sechs is 6.", 1),
          q3.single("What does 'gelb' mean?", "yellow", ["blue", "green", "red"], "Gelb means yellow. Blau is blue, grün is green and rot is red.", 1),
          q3.single("Which day is 'Mittwoch'?", "Wednesday", ["Monday", "Thursday", "Tuesday"], "Mittwoch means 'mid-week', so it is Wednesday. Donnerstag is Thursday.", 2, true),
          q3.short("Write 'green' in German.", "grün", "Grün means green. Say it with a rounded ü sound.", 2, { na: true }),
          q3.short("Complete the sum: Zwei plus drei ist ____.", "fünf", "2 + 3 = 5, and 5 is fünf in German.", 2, { na: true, diag: true }),
          q3.single("Which colour do you get if you mix blue (blau) and yellow (gelb)?", "grün", ["rot", "braun", "lila"], "Blue and yellow make green, which is grün.", 2),
          q3.multi("Which of these are days of the week? Choose all that apply.", ["Montag", "Sonntag", "Dienstag"], ["sechs", "blau"], "Montag, Sonntag and Dienstag are days. Sechs is a number and blau is a colour.", 3),
          q3.single("Which day comes after Donnerstag?", "Freitag", ["Mittwoch", "Samstag", "Dienstag"], "Donnerstag is Thursday, and Friday (Freitag) comes next.", 2),
          q3.single("Tim has zwölf pencils and gives away drei. How many are left?", "9", ["8", "10", "15"], "Zwölf is 12 and drei is 3. 12 − 3 = 9.", 3),
        ],
      },
      flashcards: cards([
        ["eins, zwei, drei", "one, two, three"],
        ["10", "zehn"],
        ["zwölf", "twelve"],
        ["17", "siebzehn"],
        ["rot, blau", "red, blue"],
        ["black", "schwarz"],
        ["weiß", "white"],
        ["der Freitag", "Friday"],
        ["Saturday", "der Samstag"],
        ["on Tuesday", "am Dienstag"],
      ]),
    },
  },
};
