// German — Family & Pets (Year 4). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q4 = qb("defam", 4);

export const TOPIC: CTopic = {
  key: "defam",
  topic: "Family & Pets",
  subject: "German",
  years: {
    4: {
      year: 4,
      objectives: [
        "Name members of the family and common pets, with the right article (der, die, das).",
        "Say what family members and pets you have using ich habe ein / eine / einen.",
        "Introduce family members with mein / meine and give their names and ages.",
        "Say what you do not have with kein / keine, and notice how nouns change in the plural.",
      ],
      note: {
        title: "Year 4: Meine Familie und meine Haustiere",
        body: `## Family and pets

| German | English |
| --- | --- |
| die Mutter (Mama) | mother (mum) |
| der Vater (Papa) | father (dad) |
| die Eltern (plural) | parents |
| der Bruder (die Brüder) | brother |
| die Schwester (die Schwestern) | sister |
| die Großmutter (Oma) | grandmother |
| der Großvater (Opa) | grandfather |
| der Onkel / die Tante | uncle / aunt |
| der Hase / die Maus | rabbit / mouse |
| der Vogel / das Pferd | bird / horse |
| das Meerschweinchen | guinea pig |
| die Schildkröte | tortoise |

## Saying what you have

Use **ich habe** + ein-word. For a der-word the ein-word changes: **einen**. For die-words it is **eine**, for das-words **ein**.

- der Vogel → Ich habe **einen** Vogel.
- die Schildkröte → Ich habe **eine** Schildkröte.
- das Pferd → Ich habe **ein** Pferd.

To say "no / not any" use **kein / keine / keinen**: *Ich habe keinen Vogel.* To introduce someone: **Das ist mein** Onkel / **meine** Tante. Plurals often change the ending: zwei Hunde, drei Katzen, vier Brüder.

## Model sentences

- Das ist meine Tante. Sie heißt Petra und sie ist vierzig.
- Ich habe zwei Brüder und ein Meerschweinchen.
- Mein Onkel hat einen Vogel. Er heißt Piepmatz.

## Sound tip

**ü** in *Brüder* is a rounded "ee" (say "ee" with rounded lips); **ö** in *Schildkröte* is a rounded "ay"; **sch** is "sh"; **v** in *Vater* and *Vogel* is said "f"; **ie** in *Tiere* is "ee".

## Common mistakes

- Writing **ich habe ein Bruder**: for a der-word after "ich habe" you need **einen** (einen Bruder).
- Using **mein** with a die-word: it is **meine** Schwester, not "mein Schwester".
- Forgetting capitals on nouns: der Vogel, die Tante.`,
      },
      quiz: {
        title: "Family & Pets: Year 4 quiz",
        questions: [
          q4.single("What does 'die Schwester' mean?", "sister", ["brother", "mother", "aunt"], "Die Schwester is sister. Der Bruder is brother.", 1),
          q4.single("Which word means 'grandfather' (informal)?", "der Opa", ["die Oma", "der Onkel", "der Vater"], "Opa is grandad. Oma is grandma and Onkel is uncle.", 1),
          q4.single("What does 'der Hund' mean?", "dog", ["cat", "horse", "rabbit"], "Der Hund is a dog. Die Katze is a cat and das Pferd is a horse.", 1),
          q4.single("Which article goes with 'Mutter'?", "die", ["der", "das", "den"], "Mutter is a feminine word: die Mutter.", 2, true),
          q4.single("What does 'Ich habe einen Bruder' mean?", "I have a brother.", ["I am a brother.", "I have a sister.", "I have two brothers."], "Ich habe means I have, and einen Bruder means a brother.", 1),
          q4.short("Complete: Ich habe ____ Hund. (I have a dog.)", "einen", "Hund is a der-word, and after 'ich habe' the ein-word for der-words is einen.", 2, { diag: true }),
          q4.short("Write 'the cat' in German, with the article.", "die Katze", "Katze is feminine, so the article is die. Nouns have a capital letter.", 2),
          q4.multi("Which of these are pets? Choose all that apply.", ["das Pferd", "die Katze", "der Fisch"], ["die Tante", "der Onkel"], "Horse, cat and fish are animals. Tante and Onkel are family members.", 2),
          q4.single("Which sentence correctly says 'I don't have a sister'?", "Ich habe keine Schwester.", ["Ich habe nicht Schwester.", "Ich habe kein Schwester.", "Ich habe keinen Schwester."], "Schwester is a die-word, so 'no' is keine: keine Schwester.", 3),
          q4.single("'Mein Bruder heißt Ben. Er ist zehn. Er hat ein Meerschweinchen.' What pet does Ben have?", "a guinea pig", ["a rabbit", "a mouse", "a bird"], "Das Meerschweinchen is a guinea pig.", 3),
        ],
      },
      flashcards: cards([
        ["die Mutter", "mother"],
        ["father", "der Vater"],
        ["die Eltern", "parents (plural)"],
        ["brother", "der Bruder"],
        ["die Schwester", "sister"],
        ["rabbit", "der Hase"],
        ["das Pferd", "horse"],
        ["Ich habe ein Pferd.", "I have a horse."],
        ["Das ist meine Tante.", "That is my aunt."],
        ["I have no dog. (der Hund)", "Ich habe keinen Hund."],
      ]),
    },
  },
};
