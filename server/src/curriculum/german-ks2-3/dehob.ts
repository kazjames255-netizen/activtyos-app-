// German — Hobbies & Sports (Year 5). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q5 = qb("dehob", 5);

export const TOPIC: CTopic = {
  key: "dehob",
  topic: "Hobbies & Sports",
  subject: "German",
  years: {
    5: {
      year: 5,
      objectives: [
        "Name common hobbies, sports and musical instruments in German.",
        "Say what you (and others) like doing with ich … gern, and use the correct verb ending for ich, er/sie and wir.",
        "Say what you do not like doing with nicht gern.",
        "Say when you do something (am Montag …) with the verb in second place.",
      ],
      note: {
        title: "Year 5: Hobbys und Sport",
        body: `## Hobbies and sports

| German | English |
| --- | --- |
| schwimmen / tanzen | to swim / to dance |
| singen / malen | to sing / to paint |
| lesen / kochen | to read / to cook |
| spielen | to play |
| der Fußball / der Basketball | football / basketball |
| das Tennis / das Hockey | tennis / hockey |
| das Klavier / die Gitarre | piano / guitar |
| die Geige / die Trompete | violin / trumpet |
| das Schlagzeug | drums |

## Verb endings (regular verbs)

| ich | er / sie | wir |
| --- | --- | --- |
| spiele | spielt | spielen |
| singe | singt | singen |
| koche | kocht | kochen |

With a sport or instrument use **spielen** without an article: *Ich spiele Hockey. Sie spielt Geige.*

## Liking and not liking

- Put **gern** after the verb: *Ich singe gern.* Add **nicht** before it: *Ich singe nicht gern.*
- Put a time first and the verb stays second: **Am Montag spiele ich Gitarre.**

## Model sentences

- Ich male gern und ich koche gern.
- Mein Bruder spielt Basketball, aber er tanzt nicht gern.
- Am Mittwoch spielen wir Hockey.

## Sound tip

**sp** and **st** at the start of a word are said "shp" and "sht": *spielen* = "SHPEE-len". **ie** is "ee" and **ei** is "eye"; **z** is "ts"; the **-en** at the end of *spielen*, *tanzen* is said softly like "-n".

## Common mistakes

- Putting gern at the end: at this level put it straight after the verb, **Ich spiele gern Hockey.**
- Using the ich ending with everybody: it is **er spielt**, not "er spiele".
- Putting the verb third after a time word: *Am Mittwoch spielen wir*, not "Am Mittwoch wir spielen".`,
      },
      quiz: {
        title: "Hobbies & Sports: Year 5 quiz",
        questions: [
          q5.single("What does 'schwimmen' mean?", "to swim", ["to dance", "to sing", "to read"], "Schwimmen means to swim. Tanzen is to dance.", 1),
          q5.single("What does 'tanzen' mean?", "to dance", ["to cook", "to paint", "to run"], "Tanzen means to dance. Kochen is to cook and malen is to paint.", 1),
          q5.single("What does 'Ich spiele gern Fußball' mean?", "I like playing football.", ["I watch football on TV.", "I don't like football.", "I play tennis."], "Ich spiele gern means I like playing, and Fußball is football.", 1),
          q5.single("What does 'Er spielt Gitarre' mean?", "He plays the guitar.", ["I play the guitar.", "They play the guitar.", "She buys a guitar."], "Er is he, and spielt is the er/sie form of spielen: he plays.", 2),
          q5.short("Complete: Ich ____ gern. (I like swimming.)", "schwimme", "With ich a regular verb ends in -e: ich schwimme.", 2, { diag: true }),
          q5.short("Complete: Sie ____ Klavier. (She plays the piano.)", "spielt", "With er / sie / es a regular verb ends in -t: sie spielt.", 2, { diag: true }),
          q5.single("Which sentence correctly says 'On Saturday I play tennis'?", "Am Samstag spiele ich Tennis.", ["Am Samstag ich spiele Tennis.", "Am Samstag Tennis spiele ich.", "Ich am Samstag spiele Tennis."], "The verb must stay in second place, so after 'Am Samstag' comes spiele, then ich.", 3),
          q5.multi("Which of these are sports? Choose all that apply.", ["Fußball", "Tennis", "Basketball"], ["Gitarre", "Klavier"], "Football, tennis and basketball are sports. Guitar and piano are instruments.", 2),
          q5.single("'Wir tanzen gern.' Who likes dancing?", "we", ["I", "he", "they"], "Wir means we and the ending -en goes with wir.", 2),
          q5.single("Which sentence means 'I don't like reading'?", "Ich lese nicht gern.", ["Ich lese gern nicht.", "Ich nicht lese gern.", "Ich lese kein gern."], "Nicht goes before gern: Ich lese nicht gern.", 3),
        ],
      },
      flashcards: cards([
        ["singen", "to sing"],
        ["to paint", "malen"],
        ["to cook", "kochen"],
        ["die Gitarre", "guitar"],
        ["drums", "das Schlagzeug"],
        ["Ich singe gern.", "I like singing."],
        ["He plays basketball.", "Er spielt Basketball."],
        ["Wir spielen Hockey.", "We play hockey."],
        ["I don't like cooking.", "Ich koche nicht gern."],
        ["On Wednesday I play the violin.", "Am Mittwoch spiele ich Geige."],
      ]),
    },
  },
};
