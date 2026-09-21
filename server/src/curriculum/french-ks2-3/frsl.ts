// French — School Life (Year 7). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q7 = qb("frsl", 7);

export const TOPIC: CTopic = {
  key: "frsl",
  topic: "School Life",
  subject: "French",
  years: {
    7: {
      year: 7,
      objectives: [
        "Talk about school subjects, giving opinions with reasons (parce que c'est …).",
        "Tell the time in French and say when lessons start (à neuf heures et demie).",
        "Describe the school day: timetable, break, canteen and uniform.",
        "Read a short text about a school day and extract information; use connectives such as mais, ensuite and parce que.",
      ],
      note: {
        title: "Year 7: school life and opinions",
        body: `## School vocabulary

| French | English |
| --- | --- |
| l'emploi du temps (m) | timetable |
| la matière préférée | favourite subject |
| la cantine | canteen |
| la récréation | break time |
| l'uniforme (m) | uniform |
| le professeur / la prof | teacher |
| le collège | secondary school (ages 11–15) |

## Opinions and reasons

**J'aime la géographie parce que c'est intéressant.** (… because it's interesting.)
**Je déteste l'histoire parce que c'est inutile.** (… because it's useless.)

Positive: intéressant (interesting), facile (easy), utile (useful), amusant (fun). Negative: difficile (difficult), ennuyeux (boring), nul (rubbish, informal), inutile (useless).

## Telling the time

| French | Time |
| --- | --- |
| Il est trois heures. | 3:00 |
| Il est trois heures et quart. | 3:15 |
| Il est trois heures et demie. | 3:30 |
| Il est quatre heures moins le quart. | 3:45 |
| Il est midi / minuit. | 12 noon / midnight |

Say **à** + time for *at*: **J'ai musique à onze heures.** (I have music at eleven o'clock.) Use **ensuite** for "then".

## Sound tips

*Heure* sounds like "ur". *Matière* is "mat-YAIR". The **h** in *heure* and *huit* is never pronounced.

## Common mistakes

- Writing **quatre heure**: with any number above one, *heures* takes an -s.
- Using **parce que** with a verb: **parce que c'est utile**, not *parce que utile*.
- Forgetting the article before subjects: **j'aime la musique**.`,
      },
      quiz: {
        title: "School Life: Year 7 quiz",
        questions: [
          q7.single("What is 'la matière préférée'?", "the favourite subject", ["the uniform", "the timetable", "the playground"], "Matière is subject and préférée means favourite.", 1),
          q7.single("What is 'l'emploi du temps'?", "the timetable", ["the uniform", "the canteen", "the break"], "L'emploi du temps is your timetable (literally the use of time).", 1),
          q7.single("What does 'difficile' mean?", "difficult", ["easy", "boring", "useful"], "Difficile looks like the English word difficult.", 1),
          q7.single("What does 'ennuyeux' mean?", "boring", ["interesting", "fun", "useful"], "Ennuyeux means boring; intéressant means interesting.", 2, true),
          q7.single("What time is 'Il est huit heures et demie'?", "8:30", ["8:15", "7:30", "8:45"], "Et demie means 'and a half', so half past eight.", 2, true),
          q7.single("What does 'Je n'aime pas le français parce que c'est difficile' mean?", "I don't like French because it's difficult", ["I like French because it's difficult", "I don't like French because it's boring", "I don't like French but it's easy"], "Je n'aime pas = I don't like; parce que = because; difficile = difficult.", 2),
          q7.short("Write 'the canteen' in French.", "la cantine", "Cantine is feminine, so it is la cantine.", 2, { na: true }),
          q7.short("Complete: J'aime les maths ____ c'est facile. (because)", "parce que", "Parce que means because and is followed by a full clause.", 2),
          q7.multi("Which sentences are correct French? Choose all that apply.", ["J'aime les maths parce que c'est facile.", "Je déteste le sport parce que c'est ennuyeux.", "J'ai anglais à neuf heures."], ["J'aime les maths parce que je suis facile.", "Il est neuf heure et demie."], "Use c'est + adjective for a reason about a subject, and remember heures takes an -s after neuf.", 3),
          q7.single("'Le lundi, j'ai anglais à neuf heures. Ensuite, j'ai sport à dix heures et demie. J'adore le sport parce que c'est amusant, mais je déteste l'anglais parce que c'est ennuyeux.' At what time is sport?", "10:30", ["10:00", "9:00", "10:15"], "Dix heures et demie is half past ten.", 3),
        ],
      },
      flashcards: cards([
        ["la récréation", "break time"],
        ["uniform", "l'uniforme (m)"],
        ["facile", "easy"],
        ["useful", "utile"],
        ["parce que", "because"],
        ["then / next", "ensuite"],
        ["Il est midi.", "It is noon (12 o'clock)."],
        ["quarter past three", "trois heures et quart"],
        ["J'ai sport à dix heures.", "I have PE at ten o'clock."],
        ["la matière préférée", "favourite subject"],
      ]),
    },
  },
};
