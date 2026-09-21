// German — Grammar: Nouns, Articles & Adjectives (Years 7–9). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q7 = qb("denoun", 7);
const q8 = qb("denoun", 8);
const q9 = qb("denoun", 9);

export const TOPIC: CTopic = {
  key: "denoun",
  topic: "Grammar — Nouns, Articles & Adjectives",
  subject: "German",
  years: {
    7: {
      year: 7,
      objectives: [
        "Know that German nouns have three genders (der, die, das), always start with a capital letter, and are learnt with their article.",
        "Use endings and patterns to predict the gender of many nouns.",
        "Form the plural of common nouns and know the plural article die.",
        "Use ein / eine / ein and kein / keine / kein correctly in the nominative.",
      ],
      note: {
        title: "Year 7: genders, plurals and ein / kein",
        body: `## Three genders, one plural

Every noun is **masculine (der)**, **feminine (die)** or **neuter (das)**. The plural article is always **die**. **All nouns start with a capital letter.** Always learn a noun with its article: *der Tisch, die Lampe, das Fenster.*

## Clues to gender

| Clue | Gender | Examples |
| --- | --- | --- |
| days, months, seasons | der | der Freitag, der Mai, der Winter |
| -ung, -heit, -keit, -schaft, -ion, -tät, -in | die | die Zeitung, die Freiheit, die Möglichkeit, die Freundschaft, die Lehrerin |
| most nouns ending in -e | die | die Katze, die Tasche |
| -chen, -lein, -um, -ment | das | das Mädchen, das Museum, das Instrument |

## Plurals

| Pattern | Examples |
| --- | --- |
| add **-e** (sometimes with umlaut) | der Tag → die Tage; der Stuhl → die Stühle |
| add **-er** (with umlaut if possible) | das Kind → die Kinder; das Buch → die Bücher |
| add **-n / -en** | die Schule → die Schulen; die Frau → die Frauen |
| add **-s** | das Auto → die Autos; das Handy → die Handys |
| no ending (sometimes an umlaut) | der Lehrer → die Lehrer; der Bruder → die Brüder |

## ein and kein

**ein** (der, das) and **eine** (die). No plural of ein. **kein / keine / kein / keine (plural)** says "no": *Das ist kein Hund. Wir haben keine Stühle.*

## Model sentences

- Die Zeitung ist hier. (The newspaper is here.)
- Das ist ein Mädchen und das sind zwei Jungen.
- Im Sommer sind die Tage lang.

## Sound tip

**ä** is like the "e" in "bed" (*Mädchen*, *Väter*); **ü** is a rounded "ee" (*Stühle*, *Bücher*); **ch** in *Bücher* is a soft hiss but in *Buch* it is a rough sound at the back of the throat; **-chen** is "khen"; **ei** is "eye" (*Freiheit*).

## Common mistakes

- Writing nouns with small letters: **die Katze**, not "die katze".
- Guessing the plural from English: many nouns take **-e**, **-n** or an umlaut, not just -s.
- Using **ein** with a plural or with "no": **keine Stühle**, not "kein Stühle".`,
      },
      quiz: {
        title: "Grammar — Nouns, Articles & Adjectives: Year 7 quiz",
        questions: [
          q7.single("Which article goes with 'Montag'?", "der", ["die", "das", "den"], "Days of the week are masculine: der Montag.", 1),
          q7.single("What is the plural of 'die Blume' (flower)?", "die Blumen", ["die Blume", "die Blumer", "die Blumes"], "Feminine nouns ending in -e add -n in the plural: Blumen.", 1),
          q7.single("What is the plural of 'das Haus'?", "die Häuser", ["die Haus", "die Hausen", "die Häuse"], "Haus takes -er and an umlaut: Häuser.", 2),
          q7.single("Which article goes with 'Schwierigkeit' (difficulty)?", "die", ["der", "das", "ein"], "Nouns ending in -keit are feminine: die Schwierigkeit.", 2, true),
          q7.short("Complete: Das ist ____ Katze. (That is not a cat.)", "keine", "Katze is a die-word, so 'no' is keine.", 2, { diag: true }),
          q7.single("Which article goes with 'Mädchen' (girl)?", "das", ["die", "der", "eine"], "Nouns ending in -chen are neuter, even for a girl: das Mädchen.", 2),
          q7.single("What gender are nouns ending in -ung, such as 'Wohnung' (flat)?", "feminine (die)", ["masculine (der)", "neuter (das)", "it depends on the word"], "-ung nouns are always feminine: die Wohnung.", 1),
          q7.multi("Which nouns are feminine (take 'die')? Choose all that apply.", ["Gesundheit", "Wohnung", "Station"], ["Mädchen", "Museum"], "-heit, -ung and -ion are feminine endings. -chen and -um are neuter endings.", 2),
          q7.single("Which sentence is correct: 'The hotel has three rooms'?", "Das Hotel hat drei Zimmer.", ["Das Hotel hat drei Zimmers.", "Das Hotel hat drei Zimmern.", "Das Hotel hat drei Zimmere."], "Zimmer does not change in the plural: drei Zimmer.", 3),
          q7.single("Which sentence correctly says 'These are not cats'?", "Das sind keine Katzen.", ["Das sind kein Katzen.", "Das ist keine Katzen.", "Das sind keinen Katzen."], "The plural takes keine, the noun is Katzen and the verb is plural (sind).", 3),
        ],
      },
      flashcards: cards([
        ["der / die / das", "masculine / feminine / neuter"],
        ["plural article", "die"],
        ["-ung, -heit, -keit, -schaft", "always die (feminine)"],
        ["-chen, -lein", "always das (neuter)"],
        ["der Tag → plural", "die Tage"],
        ["das Kind → plural", "die Kinder"],
        ["das Auto → plural", "die Autos"],
        ["der Bruder → plural", "die Brüder"],
        ["Das ist kein Hund.", "That is not a dog. (kein + der-word)"],
        ["Wir haben keine Stühle.", "We have no chairs."],
      ]),
    },
    8: {
      year: 8,
      objectives: [
        "Recognise the nominative (subject) and the accusative (direct object) and change der / ein / kein / mein for masculine nouns.",
        "Use the accusative after für, durch, gegen, ohne and um.",
        "Use adjective endings after ein-words and der-words in the nominative and accusative.",
        "Use possessive adjectives (mein, dein, sein, ihr, unser, euer) with the right ending.",
      ],
      note: {
        title: "Year 8: accusative, adjective endings and possessives",
        body: `## Nominative and accusative

The **subject** is in the nominative; the **direct object** (what the verb acts on) is in the accusative. **Only masculine changes:** der → **den**, ein → **einen**, kein → **keinen**, mein → **meinen**.

| | masc. | fem. | neut. | plural |
| --- | --- | --- | --- | --- |
| nominative | der / ein | die / eine | das / ein | die |
| accusative | **den / einen** | die / eine | das / ein | die |

*Der Vogel sieht die Maus.* *Ich sehe den Vogel.* *Ich habe einen Cousin.* Prepositions that always take the accusative: **für, durch, gegen, ohne, um** — *für den Lehrer, durch die Stadt.*

## Adjective endings (the intro)

After **is / are** there is no ending: *Der Garten ist groß.* Before a noun the adjective needs an ending:

| | masc. | fem. | neut. |
| --- | --- | --- | --- |
| **ein-words**, nominative | ein groß**er** Baum | eine groß**e** Tür | ein groß**es** Haus |
| **ein-words**, accusative | einen groß**en** Baum | eine groß**e** Tür | ein groß**es** Haus |
| **der-words**, nominative | der groß**e** Baum | die groß**e** Tür | das groß**e** Haus |
| **der-words**, accusative | den groß**en** Baum | die groß**e** Tür | das groß**e** Haus |

Plural with no article: *große Bäume.* Example: *Ich habe ein altes Fahrrad.*

## Possessives

mein, dein, sein (his / its), ihr (her), unser, euer, ihr (their), Ihr (your, formal). They take the same endings as **ein**: *mein Vater, meine Mutter, meinen Vater (accusative).* **sein** and **ihr** depend on the **owner**, not the thing owned: *Kim und ihre Schwester; Jonas und seine Schwester.*

## Sound tip

**ü** in *für* and *Bäume* is a rounded "ee"; **äu** in *Bäume* is "oy"; **ei** in *mein*, *sein* is "eye"; **ie** in *sieht* is "ee"; **eu** in *neu* and *euer* is "oy".

## Common mistakes

- Forgetting the change for masculine objects: **Ich habe einen Onkel**, not "ein Onkel".
- Adding an ending after sein/is: **Der Garten ist groß**, not "ist große".
- Choosing sein/ihr by the noun: **Kim liebt ihren Bruder** (Kim is female), not "seinen".`,
      },
      quiz: {
        title: "Grammar — Nouns, Articles & Adjectives: Year 8 quiz",
        questions: [
          q8.single("Ich sehe ____ Hund. Which article fits (accusative masculine)?", "den", ["der", "dem", "das"], "Der Hund is the object here, and masculine der changes to den in the accusative.", 1),
          q8.single("Which gender changes between the nominative and the accusative?", "masculine", ["feminine", "neuter", "plural"], "Only masculine changes: der → den, ein → einen.", 1),
          q8.short("Complete: Ich habe ____ Bruder. (I have a brother.)", "einen", "Bruder is masculine and the direct object, so ein becomes einen.", 2, { diag: true }),
          q8.short("Complete: Sie kauft ____ Buch. (She buys the book.)", "das", "Das Buch is neuter. In the accusative neuter stays das.", 2, { diag: true }),
          q8.single("Das ist ein ____ Auto. (new)", "neues", ["neuer", "neue", "neuen"], "After ein, a neuter noun in the nominative needs the ending -es: ein neues Auto.", 2),
          q8.single("Which sentence is correct?", "Ich habe einen großen Hund.", ["Ich habe ein großen Hund.", "Ich habe einen große Hund.", "Ich habe einen großer Hund."], "Hund is masculine accusative, so einen and the adjective ending -en.", 2),
          q8.single("Which of these prepositions always takes the accusative?", "für", ["mit", "von", "bei"], "Für, durch, gegen, ohne and um take the accusative. Mit, von and bei take the dative.", 2),
          q8.single("Lena hat einen Bruder. ____ Bruder heißt Tom. (her)", "Ihr", ["Sein", "Seine", "Ihre"], "The owner is Lena (female), so ihr; Bruder is masculine, so no extra ending.", 2),
          q8.multi("Which sentences are correct? Choose all that apply.", ["Ich sehe den Lehrer.", "Er hat eine kleine Katze.", "Wir haben ein neues Haus."], ["Ich sehe der Lehrer.", "Sie kauft ein neue Hose."], "Der Lehrer becomes den Lehrer as an object. Hose is feminine, so eine neue Hose.", 3),
          q8.single("Which sentence correctly says 'I am going without my brother'?", "Ich gehe ohne meinen Bruder.", ["Ich gehe ohne mein Bruder.", "Ich gehe ohne meinem Bruder.", "Ich gehe ohne meiner Bruder."], "Ohne takes the accusative, and masculine mein becomes meinen.", 3),
        ],
      },
      flashcards: cards([
        ["nominative", "the subject case (who does it)"],
        ["accusative", "the direct-object case"],
        ["der → ? (accusative)", "den"],
        ["ein → ? (accusative masc.)", "einen"],
        ["für, durch, gegen, ohne, um", "prepositions that take the accusative"],
        ["ein großer Baum → accusative", "einen großen Baum"],
        ["das große Haus (nominative and accusative)", "same in both cases"],
        ["Der Garten ist groß.", "No ending after ist"],
        ["Jonas und ... Schwester", "seine (his)"],
        ["Kim und ... Bruder", "ihr (her)"],
      ]),
    },
    9: {
      year: 9,
      objectives: [
        "Use the dative case for indirect objects and after aus, bei, mit, nach, seit, von and zu.",
        "Choose accusative or dative after two-way prepositions (in, an, auf …) by asking wohin? or wo?.",
        "Use contractions such as im, am, zum, zur, beim and vom.",
        "Order words correctly in main clauses and in clauses with weil, dass, wenn and obwohl.",
        "Form comparatives and superlatives (schneller als, am schnellsten) including irregular ones.",
      ],
      note: {
        title: "Year 9: dative, word order and comparatives",
        body: `## The dative

| | masc. | fem. | neut. | plural |
| --- | --- | --- | --- | --- |
| nominative | der | die | das | die |
| accusative | den | die | das | die |
| **dative** | **dem** | **der** | **dem** | **den (+ -n)** |

ein-words: **einem, einer, einem** (*meinem, meiner, meinem, meinen*). Plural nouns add **-n**: *mit meinen Cousinen*. The dative is used for the **indirect object** (*Ich schenke meiner Mutter Blumen*) and after **aus, bei, mit, nach, seit, von, zu**: *bei meiner Tante, mit dem Zug, von dem Bahnhof.* Contractions: **zum, zur, im, am, beim, vom** (zu dem, zu der, in dem, an dem, bei dem, von dem).

## Two-way prepositions

**an, auf, hinter, in, neben, über, unter, vor, zwischen**. Ask **Wo?** (where, no movement) → **dative**; **Wohin?** (where to, movement) → **accusative**: *Das Bild hängt an der Wand.* *Ich hänge das Bild an die Wand.*

## Word order

- **Main clause:** the verb is second. *Time – manner – place*: *Ich fahre morgen mit dem Bus in die Stadt.*
- **und, aber, oder, denn** do not change the order.
- **weil, dass, wenn, obwohl** send the verb to the **end** (with a comma): *Ich bleibe zu Hause, weil ich krank bin.* *Obwohl es regnet, gehen wir spazieren.* If the subordinate clause comes first, the verb of the main clause follows it directly.

## Comparatives and superlatives

**-er + als**: schnell → schneller **als**; add an umlaut to many short adjectives: groß → größer, jung → jünger. Irregular: gut → besser, viel → mehr, gern → lieber, hoch → höher. Superlative: **am schnellsten**. *Equal:* **so … wie**: so alt wie ich.

## Sound tip

**ö** in *größer* is a rounded "ay"; **ü** in *jünger* is a rounded "ee"; **ß** is a sharp "ss"; **sch** in *schneller* is "sh"; **ei** in *weil* is "eye" and **w** is "v"; **ie** in *lieber* is "ee".

## Common mistakes

- Using the accusative after mit, von, zu: **mit dem Zug**, not "mit den Zug".
- Writing "wie" for comparatives: **schneller als**, not "schneller wie".
- Putting the verb second after weil: **weil wir Hunger haben**, not "weil wir haben Hunger".`,
      },
      quiz: {
        title: "Grammar — Nouns, Articles & Adjectives: Year 9 quiz",
        questions: [
          q9.single("Which of these prepositions always takes the DATIVE?", "mit", ["für", "ohne", "durch"], "Mit is one of the dative-only prepositions. Für, ohne and durch take the accusative.", 1),
          q9.single("What does 'zum' stand for?", "zu dem", ["zu den", "zu der", "zu das"], "Zum = zu + dem (masculine or neuter).", 1),
          q9.short("Complete: Ich gebe ____ Lehrerin das Heft. (to the teacher)", "der", "The indirect object is in the dative; the dative feminine article is der.", 2, { diag: true }),
          q9.single("Das Buch liegt auf ____ Tisch. (Where is it? It is not moving.)", "dem", ["den", "der", "das"], "Wo? (position) takes the dative after auf, so masculine der becomes dem.", 2, true),
          q9.single("Ich lege das Buch auf ____ Tisch. (Where to? There is movement.)", "den", ["dem", "der", "das"], "Wohin? (movement) takes the accusative after auf: den Tisch.", 2),
          q9.single("Which sentence correctly says 'I am going to bed because I am tired'?", "Ich gehe ins Bett, weil ich müde bin.", ["Ich gehe ins Bett, weil ich bin müde.", "Ich gehe ins Bett, weil bin ich müde.", "Ich gehe ins Bett, weil müde ich bin."], "After weil the verb goes to the end of the clause.", 2),
          q9.single("Which sentence correctly says 'If I have time, I will go to the cinema'?", "Wenn ich Zeit habe, gehe ich ins Kino.", ["Wenn ich Zeit habe, ich gehe ins Kino.", "Wenn ich habe Zeit, gehe ich ins Kino.", "Wenn ich Zeit habe, ins Kino gehe ich."], "The wenn-clause sends habe to the end, and then the main clause starts with its verb gehe.", 3),
          q9.single("Which sentence correctly says 'My brother is older than me'?", "Mein Bruder ist älter als ich.", ["Mein Bruder ist alter als ich.", "Mein Bruder ist älter wie ich.", "Mein Bruder ist mehr alt als ich."], "The comparative of alt is älter, and 'than' is als.", 2),
          q9.short("Complete: Ich trinke Milch ____ als Saft. (I prefer milk to juice.)", "lieber", "Lieber is the comparative of gern: I like milk more than juice.", 3),
          q9.multi("Which sentences are correct? Choose all that apply.", ["Ich spiele mit meinen Freunden.", "Sie geht mit ihrem Bruder ins Kino.", "Er kommt aus dem Haus."], ["Ich wohne bei meine Eltern.", "Er kommt aus den Schule."], "Mit, aus and bei take the dative. Plural: meinen Freunden (with -n). Meine Eltern and den Schule are not in the dative.", 3),
        ],
      },
      flashcards: cards([
        ["dative articles (m / f / n / pl)", "dem / der / dem / den (+ -n)"],
        ["aus, bei, mit, nach, seit, von, zu", "always take the dative"],
        ["zum, zur, im, am", "zu dem, zu der, in dem, an dem"],
        ["Wo? → which case?", "dative (position, no movement)"],
        ["Wohin? → which case?", "accusative (movement)"],
        ["weil ich müde bin", "verb goes to the end"],
        ["schnell → comparative", "schneller (als)"],
        ["gut / viel / gern → comparatives", "besser / mehr / lieber"],
        ["am schnellsten", "the fastest (superlative)"],
        ["so alt wie ich", "as old as me"],
      ]),
    },
  },
};
