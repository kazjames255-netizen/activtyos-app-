// Spanish — Family & Pets (Year 4). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q = qb("esfam", 4);

export const TOPIC: CTopic = {
  key: "esfam",
  topic: "Family & Pets",
  subject: "Spanish",
  years: {
    4: {
      year: 4,
      objectives: [
        "Name family members and common pets, with el/la and un/una.",
        "Say what you have and don't have with tengo, tienes, tiene, tenemos, tienen.",
        "Use mi/mis, tu/tus and su/sus, and make simple plurals.",
        "Give simple descriptions, placing the adjective after the noun (un perro grande).",
      ],
      note: {
        title: "Year 4: Mi familia y mis mascotas",
        body: `## What you need to know

| Español | English | Español | English |
| --- | --- | --- | --- |
| la madre | mother | el perro | dog |
| el padre | father | el gato | cat |
| los padres | parents | el pez (los peces) | fish |
| el hermano | brother | el conejo | rabbit |
| la hermana | sister | el pájaro | bird |
| el abuelo | grandfather | el hámster | hamster |
| la abuela | grandmother | la tortuga | tortoise / turtle |
| el tío / la tía | uncle / aunt | el caballo | horse |
| el primo / la prima | cousin (boy / girl) | | |

**tener** (to have): tengo, tienes, tiene, tenemos, tienen. To say no, put **no** before it: *no tengo*.

- **mi / mis** = my, **tu / tus** = your, **su / sus** = his, her or their. Use the plural word with a plural noun: *mi gato, mis gatos*.
- Plurals: add **-s** after a vowel: *primo → primos*. **los hermanos** can mean "brothers" or "brothers and sisters"; **los abuelos** means "grandparents".
- Adjectives come after the noun and agree: *un perro pequeño*, *una tortuga pequeña*.

## Model sentences

- Mi madre se llama Rosa y mi padre se llama Iván.
- Mi abuela tiene un pájaro amarillo.
- Mis tíos tienen dos caballos.

## Sound tip

**h** is silent: *hermano* is "er-MAH-no". **rr** in *perro* is rolled, like a little engine. **j** in *pájaro* is a strong throaty h. **ll** is like y in "yes".

## Common mistakes

- Saying *mi hermanos* instead of **mis** hermanos.
- Using the wrong article: it is **la** tortuga but **el** hámster.
- Mixing up **tiene** (he/she has) and **tienen** (they have).`,
      },
      quiz: {
        title: "Family & Pets: Year 4 quiz",
        questions: [
          q.single("What does 'la madre' mean?", "the mother", ["the father", "the aunt", "the grandmother"], "Madre is mother and padre is father. La shows it is feminine.", 1),
          q.single("What is 'el perro'?", "the dog", ["the cat", "the rabbit", "the fish"], "Perro is dog and gato is cat.", 1),
          q.short("Write 'brother' in Spanish (one word, no article).", "hermano", "Brother is hermano (the h is silent). Sister is hermana.", 1, { acc: ["el hermano"] }),
          q.single("Which sentence means 'I have a cat'?", "Tengo un gato.", ["Tiene un gato.", "Tienes un gato.", "Tengo una gato."], "Tengo is 'I have'. Tiene is 'he/she has' and tienes is 'you have'. Gato is masculine so it takes un.", 2, true),
          q.single("Which means 'my brothers'?", "mis hermanos", ["mi hermanos", "mis hermano", "mi hermano"], "A plural noun needs the plural word mis and an -s on the noun: mis hermanos.", 2),
          q.short("Complete: Mi tío ___ un caballo. (has)", "tiene", "With mi tío (he) we use tiene: he has.", 2, { diag: true }),
          q.multi("Which of these are family members? Choose all that apply.", ["la tía", "el primo", "la abuela"], ["el perro", "la tortuga"], "Tía, primo and abuela are relatives. Perro and tortuga are pets.", 2),
          q.single("'No tengo hermanos.' What does this mean?", "I don't have any brothers or sisters.", ["I have brothers and sisters.", "He doesn't have any siblings.", "You don't have any siblings."], "No tengo means 'I don't have', and hermanos can mean brothers and sisters together.", 2),
          q.single("Read: 'Me llamo Sara. Tengo un hermano y dos hermanas. Mi hermana pequeña tiene seis años.' How many brothers and sisters does Sara have in total?", "3", ["2", "1", "6"], "One brother (un hermano) plus two sisters (dos hermanas) makes 3. The six is her little sister's age.", 3),
          q.short("Say in Spanish: 'My cousin (a boy) has a horse.'", "Mi primo tiene un caballo.", "Mi primo = my (male) cousin, tiene = he has, un caballo = a horse.", 3),
        ],
      },
      flashcards: cards([
        ["la madre / el padre", "mother / father"],
        ["sister (Spanish)", "la hermana"],
        ["el abuelo / la abuela", "grandfather / grandmother"],
        ["el primo", "cousin (boy)"],
        ["el conejo", "rabbit"],
        ["horse (Spanish)", "el caballo"],
        ["tengo / tiene", "I have / he or she has"],
        ["mi / mis", "my (one thing / several things)"],
        ["los hermanos", "brothers, or brothers and sisters"],
        ["Where does the adjective go? (un perro pequeño)", "After the noun, and it agrees with it."],
      ]),
    },
  },
};
