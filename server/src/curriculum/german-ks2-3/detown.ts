// German — Town & Directions (Year 6). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q6 = qb("detown", 6);

export const TOPIC: CTopic = {
  key: "detown",
  topic: "Town & Directions",
  subject: "German",
  years: {
    6: {
      year: 6,
      objectives: [
        "Name places in a town with the right article (der, die, das).",
        "Say what there is in your town with in meiner Stadt gibt es ein / eine / einen …",
        "Ask where a place is (Wo ist …?) and understand answers.",
        "Understand and give simple directions: geradeaus, links, rechts, die erste / zweite Straße.",
      ],
      note: {
        title: "Year 6: In der Stadt",
        body: `## Places in town

| German | English |
| --- | --- |
| die Stadt / das Dorf | town, city / village |
| die Straße / der Markt | street / market |
| der Bahnhof | station |
| das Kino / das Museum | cinema / museum |
| die Bibliothek / die Post | library / post office |
| die Bank / die Kirche | bank / church |
| der Park / das Schwimmbad | park / swimming pool |
| der Supermarkt / das Geschäft | supermarket / shop |
| das Rathaus | town hall |

## What is there? Asking and directions

- **In meiner Stadt gibt es** + ein-word: *einen* Markt (der), *eine* Bank (die), *ein* Geschäft (das). Add **keinen / keine / kein** for "there is no …".
- **Entschuldigung, wo ist die Post?** = Excuse me, where is the post office?
- **Gehen Sie** geradeaus (straight on), **links** (left), **rechts** (right). **Die erste Straße links** = the first street on the left; **die zweite** = the second; **die dritte** = the third.

## Model sentences

- Entschuldigung, wo ist die Bank? – Gehen Sie geradeaus, dann die erste Straße links.
- In meiner Stadt gibt es eine Kirche und einen Markt, aber es gibt kein Schwimmbad.
- Der Bahnhof ist dort rechts.

## Sound tip

**ß** in *Straße* is a sharp "ss"; **st** at the start of *Stadt* is "sht" and **sch** in *Schwimmbad* is "sh"; **ä** in *Geschäft* is like the "e" in "bed" (say "guh-SHEFT"); **ch** in *rechts* is a soft hiss; **ie** in *Bibliothek* is "ee".

## Common mistakes

- Saying **Gehen Sie links** as "Gehen Sie zu links": no extra word is needed.
- Writing "in meine Stadt": it is **in meiner Stadt** (learn it as a fixed phrase).
- Using ein for every word after *es gibt*: der-words become **einen** (einen Park).`,
      },
      quiz: {
        title: "Town & Directions: Year 6 quiz",
        questions: [
          q6.single("What does 'das Kino' mean?", "cinema", ["library", "market", "church"], "Das Kino is the cinema, where you watch films.", 1),
          q6.single("What does 'die Bibliothek' mean?", "library", ["bookshop", "bank", "school"], "Die Bibliothek is a library, the place you borrow books.", 1),
          q6.single("What does 'der Bahnhof' mean?", "station", ["airport", "hotel", "swimming pool"], "Der Bahnhof is the railway station.", 1),
          q6.single("What does 'geradeaus' mean?", "straight on", ["turn left", "turn right", "stop here"], "Geradeaus means straight ahead. Links is left and rechts is right.", 2, true),
          q6.short("Complete: Gehen Sie ____. (Go left.)", "links", "Links means left. Rechts means right.", 2, { diag: true }),
          q6.single("What does 'Wo ist der Park?' ask?", "Where is the park?", ["Who is in the park?", "Is there a park?", "When is the park open?"], "Wo means where, so this asks for the park's location.", 2),
          q6.multi("Which of these are places in a town? Choose all that apply.", ["der Supermarkt", "die Kirche", "das Schwimmbad"], ["die Katze", "der Apfel"], "A supermarket, a church and a swimming pool are places in town. A cat and an apple are not.", 2),
          q6.single("What does 'In meiner Stadt gibt es einen Park' mean?", "In my town there is a park.", ["My town is called Park.", "I go to the park in town.", "In my town there is no park."], "Es gibt means there is / there are, and einen Park means a park.", 2),
          q6.single("Which sentence correctly says 'In my town there is a cinema'?", "In meiner Stadt gibt es ein Kino.", ["In meiner Stadt gibt es einen Kino.", "In meiner Stadt gibt es eine Kino.", "In meiner Stadt ist es ein Kino."], "Kino is a das-word, so the ein-word is ein: ein Kino.", 3),
          q6.single("'Gehen Sie geradeaus, dann die zweite Straße rechts. Das Museum ist dort.' Where do you turn?", "Into the second street on the right", ["Into the first street on the right", "Into the second street on the left", "Into the third street on the right"], "Zweite is second and rechts is right, so it is the second street on the right.", 3),
        ],
      },
      flashcards: cards([
        ["die Stadt", "town, city"],
        ["village", "das Dorf"],
        ["die Post", "post office"],
        ["church", "die Kirche"],
        ["das Schwimmbad", "swimming pool"],
        ["rechts", "right"],
        ["Where is the bank?", "Wo ist die Bank?"],
        ["die erste Straße links", "the first street on the left"],
        ["In meiner Stadt gibt es einen Markt.", "In my town there is a market."],
        ["there is no cinema", "es gibt kein Kino"],
      ]),
    },
  },
};
