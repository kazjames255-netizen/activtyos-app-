// Spanish — Identity & Family (Year 7). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q = qb("esid", 7);

export const TOPIC: CTopic = {
  key: "esid",
  topic: "Identity & Family",
  subject: "Spanish",
  years: {
    7: {
      year: 7,
      objectives: [
        "Give personal details: name, age, nationality, birthday and where you live.",
        "Describe appearance and personality using ser, tener and adjectives that agree.",
        "Talk about family members, including half- and step-relatives and only children.",
        "Read short personal texts and write a few connected sentences about yourself.",
      ],
      note: {
        title: "Year 7: Mi identidad y mi familia",
        body: `## What you need to know

**Personal details:** *Me llamo …* (name), *Tengo … años* (age), *Soy inglés / inglesa* (nationality), *Vivo en …* (I live in …), *Mi cumpleaños es el … de …* (My birthday is on the … of …).

**Nationalities agree with the person:** inglés / inglesa, escocés / escocesa, galés / galesa, irlandés / irlandesa, español / española. (Note that the accent disappears in the feminine form.)

**Months** (small letters): enero, febrero, marzo, abril, mayo, junio, julio, agosto, septiembre, octubre, noviembre, diciembre.

| Appearance | English | Personality | English |
| --- | --- | --- | --- |
| tengo el pelo largo / corto | I have long / short hair | simpático / simpática | nice, friendly |
| … rubio / castaño / negro | blond / brown / black | divertido / divertida | funny |
| … pelirrojo | red (hair) | tímido / tímida | shy |
| tengo los ojos verdes / azules / marrones | I have green / blue / brown eyes | trabajador / trabajadora | hard-working |
| soy alto / alta, bajo / baja | I am tall, short | perezoso / perezosa | lazy |
| soy delgado / delgada | I am slim | inteligente | intelligent |

**Family:** mi padre, mi madre, mis padres, mi hermanastro / hermanastra (stepbrother / stepsister), mi hermano mayor / menor (older / younger). *Soy hijo único / hija única* means I am an only child. *Somos cuatro en mi familia* means There are four of us.

## Model sentences

- Me llamo Elena, tengo doce años y soy inglesa.
- Mi cumpleaños es el cinco de agosto.
- Tengo el pelo largo y castaño y los ojos verdes. Soy bastante tímida pero muy trabajadora.

## Sound tip

**ñ** is like "ny": *español* is "es-pa-NYOL". **j** is a throaty h: *julio* is "HOO-lyo". **ll** is like y. **z** and **c** before e or i are "th" in Spain and "s" in Latin America.

## Common mistakes

- Forgetting to make the adjective agree: a girl says **soy simpática**, a boy says **soy simpático**.
- Using *soy* for age. Say **tengo** doce años.
- Writing months with a capital letter, as English does.`,
      },
      quiz: {
        title: "Identity & Family: Year 7 quiz",
        questions: [
          q.single("A boy says 'Soy hijo único.' What does this tell you?", "He is an only child.", ["He is the youngest child.", "He has one brother.", "He is the eldest child."], "Hijo único (or hija única for a girl) means only child: a son with no brothers or sisters.", 1),
          q.single("What does 'el pelo' mean?", "hair", ["eyes", "height", "family"], "El pelo is hair. Ojos would be eyes.", 1),
          q.short("Write the Spanish month for January (one word).", "enero", "January is enero. Months have a small letter in Spanish.", 1),
          q.single("Which sentence means 'I have blue eyes'?", "Tengo los ojos azules.", ["Soy los ojos azules.", "Tengo los ojos azul.", "Tengo el pelo azules."], "Use tener for appearance features, and azules agrees with the plural ojos.", 2, true),
          q.single("Ana es de Edimburgo. Complete: Ana es ___.", "escocesa", ["escocés", "escoceso", "escocesas"], "For a girl the nationality ends in -esa and loses the accent: escocesa.", 2),
          q.short("Say in Spanish: 'My birthday is on the 3rd of June.'", "Mi cumpleaños es el tres de junio.", "Say el + the number + de + the month: el tres de junio. The number can also be written as 3.", 2, { diag: true, acc: ["Mi cumpleaños es el 3 de junio."] }),
          q.multi("Which of these describe personality, not looks? Choose all that apply.", ["simpático", "tímido", "divertido"], ["rubio", "alto"], "Simpático, tímido and divertido are personality words. Rubio (blond) and alto (tall) describe appearance.", 2),
          q.single("Carla (a girl) says she is funny. Which sentence does she say?", "Soy divertida.", ["Soy divertido.", "Soy divertidas.", "Es divertida."], "Carla is female and singular so the adjective ends in -a, and 'I am' is soy.", 2),
          q.single("Mateo writes: 'Somos cinco en mi familia: mis padres, mi hermana, mi hermanastro y yo.' Which person does he NOT mention?", "a grandmother", ["his parents", "a sister", "a stepbrother"], "He lists mis padres, mi hermana, mi hermanastro and himself. There is no abuela.", 3),
          q.written("Write 3–4 sentences in Spanish introducing yourself: your name, age, where you live, and one person in your family.", "Me llamo Sam. Tengo doce años y vivo en Bristol. Tengo un hermano mayor que se llama Leo. Mi madre es muy simpática.", "Tutor marks out of 4: 1 mark for name and age with me llamo / tengo … años; 1 mark for where you live (vivo en); 1 mark for a family member with mi / tengo; 1 mark for accurate spelling, accents and agreement of adjectives.", 3),
        ],
      },
      flashcards: cards([
        ["Me llamo …", "My name is …"],
        ["Tengo doce años.", "I am twelve years old."],
        ["Soy inglés / inglesa.", "I am English (boy / girl)."],
        ["Mi cumpleaños es el … de …", "My birthday is on the … of …"],
        ["long hair (Spanish)", "el pelo largo"],
        ["Tengo los ojos azules.", "I have blue eyes."],
        ["shy (Spanish, girl)", "tímida"],
        ["hard-working (Spanish, girl)", "trabajadora"],
        ["hijo único / hija única", "only child (boy / girl)"],
        ["mi hermanastro", "my stepbrother"],
      ]),
    },
  },
};
