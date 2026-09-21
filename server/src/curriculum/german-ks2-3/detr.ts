// German — Town & Region (Year 8). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q8 = qb("detr", 8);

export const TOPIC: CTopic = {
  key: "detr",
  topic: "Town & Region",
  subject: "German",
  years: {
    8: {
      year: 8,
      objectives: [
        "Describe your town and region: where it is, what there is and what it is like.",
        "Give opinions about a place with adjectives and give advantages and disadvantages.",
        "Ask for and give directions using zum / zur and the polite imperative.",
        "Say how you travel (mit dem Bus, zu Fuß) and understand basic facts about German-speaking regions.",
      ],
      note: {
        title: "Year 8: Meine Stadt und meine Region",
        body: `## Describing a place

| German | English |
| --- | --- |
| die Kleinstadt / die Großstadt | small town / city |
| die Gegend | area, region |
| der Verkehr | traffic |
| die Umwelt | environment |
| der Norden / der Süden / der Osten / der Westen | north / south / east / west |
| laut / ruhig | noisy / quiet |
| sauber / schmutzig | clean / dirty |
| lebendig / langweilig | lively / boring |

- **Ich wohne in einer Kleinstadt im Westen von England.** (*im* = *in dem*)
- **Es gibt** + accusative: *einen* Flughafen, *eine* Bibliothek, *ein* Museum. **Es gibt nichts für Jugendliche** = there is nothing for teenagers.
- **Es gibt zu viele Autos** = too many cars.

## Directions

**Wie komme ich zum Museum / zur Bibliothek?** = How do I get to the museum / the library? Use **zum** with der- and das-words (zu + dem) and **zur** with die-words (zu + der). Answer: **Gehen Sie geradeaus, dann nehmen Sie die zweite Straße links.**

## Getting around

**mit dem Bus / Zug / Rad / Auto**, **mit der U-Bahn**, **zu Fuß** (on foot). Learn *mit dem* as a chunk; the reason is the dative case in Year 9.

## German-speaking places

Deutschland (Berlin is the capital), Österreich (Wien) and die Schweiz (Bern). *Hamburg liegt im Norden von Deutschland*, *München liegt im Süden.*

## Model sentences

- Meine Stadt ist ziemlich sauber, aber es gibt viel Verkehr.
- Ich fahre jeden Tag mit dem Rad in die Schule.
- Wie komme ich zur Bibliothek? – Gehen Sie hier rechts.

## Sound tip

**ü** in *Süden* is a rounded "ee"; **ö** in *Österreich* is a rounded "ay"; **ei** in *Österreich* and *Schweiz* is "eye"; **ch** at the end of *Österreich* is a soft hiss; **v** in *Verkehr* is "f" ("fer-KAIR"); **z** in *zum* and *Schweiz* is "ts".

## Common mistakes

- Saying "zu der Museum". Combine and choose by gender: **zum Museum**, **zur Bibliothek**.
- Using **ein** after *es gibt* for der-words: it is **einen Park**.
- Writing directions with a small letter: **der Norden**, **der Süden** are nouns and take capitals.`,
      },
      quiz: {
        title: "Town & Region: Year 8 quiz",
        questions: [
          q8.single("What does 'sauber' mean?", "clean", ["dirty", "quiet", "old"], "Sauber means clean. Schmutzig is dirty.", 1),
          q8.single("What does 'im Norden' mean?", "in the north", ["in the south", "on the north side of the road", "to the north of Germany"], "Im is in dem, so im Norden is in the north.", 1),
          q8.single("What does 'Die Stadt ist laut' mean?", "The town is noisy.", ["The town is small.", "The town is quiet.", "The town is expensive."], "Laut means loud or noisy, so the town is noisy.", 1),
          q8.single("What does 'Es gibt zu viel Verkehr' mean?", "There is too much traffic.", ["There is not enough traffic.", "There are too many shops.", "There is a lot of pollution."], "Zu viel means too much and Verkehr is traffic.", 2, true),
          q8.short("Complete: In meiner Stadt ____ es viele Geschäfte. (there are many shops)", "gibt", "Es gibt means there is / there are.", 2, { diag: true }),
          q8.single("What does 'Wie komme ich zum Bahnhof?' ask?", "How do I get to the station?", ["When does the train leave?", "Where is the ticket office?", "How far is the airport?"], "Wie komme ich zu … asks how to get somewhere, and zum Bahnhof is to the station.", 2),
          q8.single("What does 'Ich fahre mit dem Bus' mean?", "I travel by bus.", ["I wait for the bus.", "I work on a bus.", "I like buses."], "Mit dem Bus is by bus.", 2),
          q8.multi("Which of these are points of the compass? Choose all that apply.", ["der Norden", "der Süden", "der Westen"], ["der Markt", "der Bahnhof"], "Norden, Süden and Westen are compass points. Markt and Bahnhof are places in a town.", 2),
          q8.single("Which sentence correctly says 'In my town there is a big park'?", "In meiner Stadt gibt es einen großen Park.", ["In meiner Stadt gibt es einen große Park.", "In meiner Stadt gibt es ein großen Park.", "In meiner Stadt gibt es einen großer Park."], "Es gibt takes the accusative: einen (masculine) and the adjective ends in -en: einen großen Park.", 3),
          q8.single("'Ich wohne in einer Kleinstadt im Norden von England. Es gibt einen Markt und ein Kino, aber es gibt nichts für Jugendliche. Es gibt auch zu viel Verkehr.' What does the writer dislike?", "Nothing for teenagers to do and too much traffic", ["No shops, and too many cinemas in the town", "Too many teenagers and far too much noise", "The market and the cinema, because both are old"], "Nichts für Jugendliche means nothing for teenagers, and zu viel Verkehr means too much traffic.", 3),
        ],
      },
      flashcards: cards([
        ["die Großstadt", "city"],
        ["quiet", "ruhig"],
        ["der Verkehr", "traffic"],
        ["im Süden von Deutschland", "in the south of Germany"],
        ["zu Fuß", "on foot"],
        ["Es gibt nichts für Jugendliche.", "There is nothing for teenagers."],
        ["Wie komme ich zur Post?", "How do I get to the post office?"],
        ["by train", "mit dem Zug"],
        ["die Umwelt", "environment"],
        ["lively", "lebendig"],
      ]),
    },
  },
};
