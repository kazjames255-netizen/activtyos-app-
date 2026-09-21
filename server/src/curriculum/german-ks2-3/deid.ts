// German — Identity & Family (Year 7). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q7 = qb("deid", 7);

export const TOPIC: CTopic = {
  key: "deid",
  topic: "Identity & Family",
  subject: "German",
  years: {
    7: {
      year: 7,
      objectives: [
        "Give personal information: name, age, birthday, where you live and where you come from.",
        "Describe yourself and others: hair, eyes and personality.",
        "Talk about family members and their ages using haben and sein correctly, with mein / meine.",
        "Read a short personal profile and pick out the key details; write a short paragraph from memory.",
      ],
      note: {
        title: "Year 7: Wer bin ich? Identity and family",
        body: `## Personal information

- **Ich heiße Kofi. Ich bin vierzehn Jahre alt.** (Age uses **sein**, not haben.)
- **Ich habe am ersten Juni Geburtstag.** or **Mein Geburtstag ist am ersten Juni.** = My birthday is on 1 June.
- **Ich komme aus Wales. Ich wohne in Cardiff.** = I come from Wales. I live in Cardiff.

**Numbers 21+:** einundzwanzig (21), zweiundzwanzig (22) … dreißig (30), einunddreißig (31). The small number comes first: "one-and-twenty".
**Months (all der-words, capitalised):** Januar, Februar, März, April, Mai, Juni, Juli, August, September, Oktober, November, Dezember.
**Dates:** use **am** + ordinal + **-en**. Ordinals from 1 to 19 end in -te (der zweite, vierte, fünfte), from 20 in -ste (der zwanzigste, dreißigste). Irregular: erste, dritte, siebte, achte. So: *am zwanzigsten August*, *am siebten März*.

## Describing people

| Structure | Example |
| --- | --- |
| hair: **ich habe … Haare** (plural) | Ich habe lange blonde Haare. |
| eyes: **ich habe … Augen** | Sie hat blaue Augen. |
| character: **er / sie ist** + adjective | Er ist freundlich, lustig, schüchtern, sportlich, nett, streng. |

## Family

mein Vater, meine Mutter, meine Eltern, mein Bruder, meine Schwester, meine Geschwister (brothers and sisters), mein Halbbruder, mein Stiefvater, meine Großeltern, mein Cousin, meine Cousine. Use **mein** with der- and das-words and **meine** with die-words and plurals. *Ich bin Einzelkind* (das Einzelkind) = I am an only child.

## Sound tip

**ei** is "eye" (*heiße*, *Bein*); **ie** is "ee" (*Familie*, *lieb*); **eu**/**äu** is "oy" (*Freunde* = "FROYN-duh"); **v** in *Vater* is "f" but **w** in *Wales* is "v"; **z** is "ts"; the **ch** in *ich* is a soft hiss, but in *Buch* it is a rough sound at the back of the throat.

## Common mistakes

- Saying **Ich habe dreizehn Jahre**: use sein: *Ich bin dreizehn Jahre alt.*
- Using mein with a die-word: **meine** Cousine, not "mein Cousine".
- Writing months or family words in small letters: German nouns always start with a capital, so *der Mai*, *die Schwester*.`,
      },
      quiz: {
        title: "Identity & Family: Year 7 quiz",
        questions: [
          q7.single("Er ist fünfzehn. How old is he?", "15", ["5", "50", "14"], "Fünfzehn is 15. Fünfzig would be 50 and vierzehn is 14.", 1),
          q7.single("Which month is 'März'?", "March", ["May", "June", "July"], "März is March. Mai is May.", 1),
          q7.single("What does 'braune Haare und grüne Augen' mean?", "brown hair and green eyes", ["brown eyes and green hair", "black hair and grey eyes", "brown hair and blue eyes"], "Braun is brown and grün is green. Haare is hair and Augen is eyes.", 1),
          q7.single("'Mein Geburtstag ist am dritten Mai.' When is the birthday?", "3 May", ["3 March", "13 May", "30 May"], "Dritten is the ordinal 'third' and Mai is May. März would be March.", 2, true),
          q7.short("Complete: Ich ____ zwölf Jahre alt.", "bin", "Age in German uses sein, and with ich it is bin.", 2, { diag: true }),
          q7.single("Which sentence correctly says 'I have a brother and two sisters'?", "Ich habe einen Bruder und zwei Schwestern.", ["Ich habe ein Bruder und zwei Schwestern.", "Ich habe einen Bruder und zwei Schwester.", "Ich bin einen Bruder und zwei Schwestern."], "Bruder is a der-word, so after ich habe it takes einen. The plural of Schwester is Schwestern.", 2),
          q7.single("'Ich heiße Tara und ich bin vierzehn. Ich habe eine Schwester; sie heißt Nina und ist neun.' How old is Tara's sister?", "9", ["14", "10", "13"], "Sie ist neun: the sister Nina is nine. Tara herself is fourteen.", 2),
          q7.short("Complete: ____ Mutter heißt Sara. (My mother is called Sara.)", "Meine", "Mutter is a die-word, so the possessive is meine.", 2),
          q7.multi("Which sentences are correct German? Choose all that apply.", ["Ich bin zwölf Jahre alt.", "Er hat blaue Augen.", "Sie ist lustig."], ["Ich habe zwölf Jahre.", "Er ist blaue Augen."], "Age and character use sein (bin, ist); having features uses haben (hat). 'Ich habe zwölf Jahre' and 'Er ist blaue Augen' mix the verbs up.", 3),
          q7.written("Write 4–5 sentences in German introducing yourself or an imaginary friend. Include a name, an age, a birthday date, one family member and hair or eye colour.", "Ich heiße Nina. Ich bin zwölf Jahre alt und mein Geburtstag ist am siebten Juni. Ich habe einen Bruder; er heißt Sam. Ich habe lange braune Haare und grüne Augen.", "Mark scheme (5 marks): 1 mark each for a correct name sentence, age using sein, a birthday date with am + ordinal, a family member with mein/meine, and hair or eye colour with haben. Accept small spelling slips; capital letters on nouns expected.", 3),
        ],
      },
      flashcards: cards([
        ["Ich bin dreizehn Jahre alt.", "I am thirteen years old."],
        ["my birthday is on 5 June", "mein Geburtstag ist am fünften Juni"],
        ["die Haare", "hair (plural in German)"],
        ["eyes", "die Augen"],
        ["Sie hat blaue Augen.", "She has blue eyes."],
        ["He is shy.", "Er ist schüchtern."],
        ["lustig", "funny"],
        ["my brothers and sisters", "meine Geschwister"],
        ["only child", "das Einzelkind"],
        ["Ich komme aus Wales.", "I come from Wales."],
      ]),
    },
  },
};
