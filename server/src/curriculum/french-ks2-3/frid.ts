// French — Identity & Family (Year 7). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q7 = qb("frid", 7);

export const TOPIC: CTopic = {
  key: "frid",
  topic: "Identity & Family",
  subject: "French",
  years: {
    7: {
      year: 7,
      objectives: [
        "Give personal information: name, age, birthday, nationality and where you live.",
        "Describe yourself and others: hair, eyes and personality.",
        "Talk about family members and their ages using avoir and être correctly.",
        "Read a short personal profile and pick out the key details; write a short paragraph from memory.",
      ],
      note: {
        title: "Year 7: who am I? Identity and family",
        body: `## Personal information

- **Je m'appelle Kofi.** = My name is Kofi. **J'ai quatorze ans.** = I am 14. (Use **avoir** for age.)
- **Mon anniversaire est le trois octobre.** = My birthday is on 3 October. (For the 1st: *le premier octobre*.)
- **J'habite à Leeds.** = I live in Leeds. **Je suis anglais(e).** = I am English.

**Numbers 11–31:** onze, douze, treize, quatorze, quinze, seize, dix-sept, dix-huit, dix-neuf, vingt, vingt et un, vingt-deux … trente, trente et un.
**Months (no capital):** janvier, février, mars, avril, mai, juin, juillet, août, septembre, octobre, novembre, décembre.

## Describing people

| Structure | Example |
| --- | --- |
| hair: **il/elle a les cheveux** + courts / longs / bruns / noirs / blonds / roux | Elle a les cheveux courts et roux. |
| eyes: **il/elle a les yeux** + bleus / verts / marron | Il a les yeux marron. |
| personality: **il/elle est** + sympa / drôle / timide / sportif (sportive) / gentil (gentille) | Elle est gentille et drôle. |

## Family

mon père, ma mère, mes parents, mon frère, ma sœur, mon demi-frère, ma demi-sœur, mon oncle, ma tante, mon cousin, ma cousine, mes grands-parents.

## Sound tips

*Yeux* is "yuh"; *cheveux* is "shuh-VUH"; *treize* is "trez"; *quinze* is "kanz"; the **-s** and **-x** on the end of *yeux* and *cheveux* are silent.

## Common mistakes

- Saying **il est quinze ans**: age uses **avoir** (*il a quinze ans*), not être.
- Writing months or days with a capital letter.
- Forgetting that **cheveux** and **yeux** are plural, so the adjectives are plural too: les yeux bleus.`,
      },
      quiz: {
        title: "Identity & Family: Year 7 quiz",
        questions: [
          q7.single("What does 'Quel âge as-tu ?' ask?", "How old are you?", ["What is your name?", "Where do you live?", "When is your birthday?"], "Âge means age, so it asks about your age.", 1),
          q7.single("Il a quinze ans. How old is he?", "15", ["5", "14", "16"], "Quinze is 15. Cinq is 5, quatorze is 14 and seize is 16.", 1),
          q7.single("Which phrase means 'brown hair'?", "les cheveux bruns", ["les yeux marron", "les cheveux blonds", "les cheveux roux"], "Cheveux is hair and bruns is brown (for hair; many French speakers say châtains for lighter brown). Eyes are yeux.", 2),
          q7.single("Which sentence correctly says 'My sister is called Léa and she is 13'?", "Ma sœur s'appelle Léa et elle a treize ans.", ["Ma sœur s'appelle Léa et elle est treize ans.", "Mon sœur s'appelle Léa et elle a treize ans.", "Ma sœur m'appelle Léa et elle a treize ans."], "Sœur is feminine (ma), the verb is s'appeler (she is called) and age uses avoir (elle a).", 2, true),
          q7.single("What does 'sympa' mean?", "nice / friendly", ["shy", "sporty", "funny"], "Sympa (short for sympathique) means nice.", 1),
          q7.short("Write 'I am 12 years old' in French.", "j'ai douze ans", "Age uses avoir: j'ai + number + ans.", 2, { na: true, diag: true, acc: ["j'ai 12 ans"] }),
          q7.short("Complete with the correct verb form: Mon frère ____ les cheveux courts.", "a", "Describing hair uses avoir, and with il/elle/on it is a.", 2),
          q7.multi("Which sentences are correct French? Choose all that apply.", ["Elle a les yeux bleus.", "Il est timide.", "Il a douze ans."], ["Il est douze ans.", "Elle a les cheveux longue."], "Use avoir for age and for having features; use être with personality adjectives. Cheveux is plural, so 'longs'.", 3),
          q7.single("'Salut ! Je m'appelle Amir. J'ai treize ans et mon anniversaire est le vingt mai. J'ai deux sœurs, mais je n'ai pas de frère.' When is Amir's birthday?", "20 May", ["20 March", "13 May", "2 May"], "Vingt is 20 and mai is May. Mars is March and treize is 13.", 2),
          q7.written("Write 4–5 sentences in French introducing yourself or an imaginary friend. Include a name, an age, a birthday month, one family member and hair or eye colour.", "Je m'appelle Nina. J'ai douze ans et mon anniversaire est en juin. J'ai un frère; il s'appelle Sam. J'ai les cheveux bruns et les yeux verts.", "Mark scheme (5 marks): 1 mark each for a correct name sentence, age using avoir, a month, a family member with mon/ma, and hair or eye colour with les cheveux / les yeux. Accept small spelling slips.", 3),
        ],
      },
      flashcards: cards([
        ["J'ai treize ans.", "I am thirteen."],
        ["my birthday is on 5 June", "mon anniversaire est le cinq juin"],
        ["les cheveux", "hair (plural in French)"],
        ["eyes", "les yeux"],
        ["Il a les yeux verts.", "He has green eyes."],
        ["She is funny.", "Elle est drôle."],
        ["timide", "shy"],
        ["kind", "gentil (masculine) / gentille (feminine)"],
        ["mon demi-frère", "my half-brother"],
        ["my grandparents", "mes grands-parents"],
      ]),
    },
  },
};
