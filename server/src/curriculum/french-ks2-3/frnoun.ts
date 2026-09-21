// French — Grammar: Nouns, Articles & Adjectives (Years 7–9). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q7 = qb("frnoun", 7);
const q8 = qb("frnoun", 8);
const q9 = qb("frnoun", 9);

export const TOPIC: CTopic = {
  key: "frnoun",
  topic: "Grammar — Nouns, Articles & Adjectives",
  subject: "French",
  years: {
    7: {
      year: 7,
      objectives: [
        "Use masculine and feminine nouns with the correct indefinite (un, une, des) and definite (le, la, l', les) articles.",
        "Form regular and common irregular plurals (-s, -x, -aux, unchanged).",
        "Use gender clues from noun endings and learn nouns with their article.",
        "Apply these rules in short sentences.",
      ],
      note: {
        title: "Year 7: gender, articles and plurals",
        body: `## Every noun has a gender

| | masculine | feminine | before a vowel | plural |
| --- | --- | --- | --- | --- |
| a / an / some | un | une | un / une | des |
| the | le | la | l' | les |

Always learn a noun **with its article**: *un garçon, une fille, l'ami, l'amie, les enfants*.

## Gender clues

Often **feminine**: -tion, -sion, -té, -ure, -ette (la station, la beauté, la voiture). Often **masculine**: -ment, -age, -eau, -isme (le moment, le bateau). There are exceptions (**la plage**, **l'image**), so check in a dictionary.

## Making plurals

| Rule | Singular → plural |
| --- | --- |
| add **-s** | un stylo → des stylos |
| **-eau** → **-eaux** | un bateau → des bateaux |
| **-al** → **-aux** | un animal → des animaux |
| **-eu** → **-eux** | un jeu → des jeux |
| already ends in **-s, -x, -z**: no change | un prix → des prix |

The plural **-s is silent**, so you hear the difference from the article: *le stylo* vs *les stylos*.

## Model sentences

- Il y a un garçon et une fille dans la cour.
- Les enfants ont des animaux à la maison.
- L'ami de ma sœur achète un chapeau.

## Common mistakes

- Using **le** or **la** before a plural: always **les**.
- Adding an -s to words ending in -s, -x or -z.
- Forgetting the **-x** on **-eau** words (*des chapeaus* is wrong).`,
      },
      quiz: {
        title: "Grammar — Nouns, Articles & Adjectives: Year 7 quiz",
        questions: [
          q7.single("Choose the right word: '___ table' (a table)", "une", ["un", "le", "les"], "Table is feminine, so 'a' is une.", 1),
          q7.single("Choose the right word: '___ école' (the school)", "l'", ["le", "la", "les"], "École starts with a vowel, so le/la shortens to l'.", 1),
          q7.single("What is the plural of 'livre'?", "livres", ["livrs", "livreaux", "livrex"], "Most nouns just add -s to the singular: livre becomes livres.", 1),
          q7.single("What is the plural of 'gâteau'?", "gâteaux", ["gâteaus", "gâteauxs", "gâtaux"], "Words ending in -eau add -x.", 2, true),
          q7.single("What is the plural of 'journal'?", "journaux", ["journals", "journales", "journaus"], "Words ending in -al change to -aux.", 2),
          q7.single("Which of these nouns is feminine?", "solution", ["village", "bureau", "gouvernement"], "The ending -tion usually shows a feminine noun (la solution). Village, bureau and gouvernement are masculine.", 2),
          q7.short("Write 'the apples' in French.", "les pommes", "Pomme is feminine, but every plural 'the' is les, and add -s to the noun.", 2, { na: true, diag: true }),
          q7.short("Complete with 'some': J'ai ____ amis.", "des", "The plural of un/une is des.", 2),
          q7.multi("Which are correct plurals? Choose all that apply.", ["les chevaux", "les jeux", "les nez"], ["les chevals", "les bureaus"], "Cheval → chevaux (-al → -aux), jeu → jeux (-eu → -eux), nez stays the same; bureau → bureaux.", 3),
          q7.single("Which sentence uses the articles correctly?", "J'ai un stylo et une gomme dans mon sac.", ["J'ai une stylo et un gomme dans mon sac.", "J'ai un stylo et des gomme dans mon sac.", "J'ai le stylo et la gommes dans mon sac."], "Stylo is masculine (un) and gomme is feminine (une).", 3),
        ],
      },
      flashcards: cards([
        ["un / une / des", "a (masc) / a (fem) / some"],
        ["le / la / l' / les", "the (masc) / the (fem) / the (before a vowel) / the (plural)"],
        ["Nouns ending in -tion are usually …", "feminine (la nation)"],
        ["Nouns ending in -ment are usually …", "masculine (le moment)"],
        ["plural of -eau nouns", "add -x: un bateau → des bateaux"],
        ["plural of -al nouns", "-aux: un animal → des animaux"],
        ["plural of un prix", "des prix (no change)"],
        ["the friends (girls)", "les amies"],
        ["a girl", "une fille"],
        ["the boy", "le garçon"],
      ]),
    },
    8: {
      year: 8,
      objectives: [
        "Make adjectives agree in gender and number, including common irregular patterns (-eux/-euse, -if/-ive, -il/-ille, blanc/blanche).",
        "Place adjectives correctly: most after the noun, short common ones (petit, grand, beau, joli, bon, nouveau, jeune, vieux) before.",
        "Use possessive adjectives (mon/ma/mes, ton/ta/tes, son/sa/ses, notre/nos, votre/vos, leur/leurs).",
        "Recognise invariable colours (marron, orange) and apply agreement in writing.",
      ],
      note: {
        title: "Year 8: adjectives and possessives",
        body: `## Agreement

An adjective matches its noun in **gender** and **number**.

| Rule | Masculine | Feminine |
| --- | --- | --- |
| add **-e** | grand | grande |
| ends in -e already | rapide | rapide |
| -eux → -euse | heureux | heureuse |
| -if → -ive | actif | active |
| -il → -ille | gentil | gentille |
| -c → -che | blanc | blanche |

Plural: add **-s** (grands, grandes). Adjectives ending in -s stay the same in the masculine plural (*gris*). **Marron** and **orange** never change (*des chaussettes marron*).

## Position

Most adjectives go **after** the noun (*un vélo rapide*, *une histoire intéressante*). A few short, common ones go **before**: petit, grand, gros, jeune, vieux, beau, joli, bon, mauvais, nouveau (*un nouveau vélo, une jolie robe*). **Beau** becomes **belle** (feminine), **beaux** and **belles** (plural): *un beau jardin, une belle plage*.

## Possessive adjectives

| | masc. | fem. | plural |
| --- | --- | --- | --- |
| my | mon | ma | mes |
| your (tu) | ton | ta | tes |
| his / her | son | sa | ses |
| our | notre | notre | nos |
| your (vous) | votre | votre | vos |
| their | leur | leur | leurs |

Before a feminine noun that starts with a vowel use **mon/ton/son**: **mon amie**. The possessive matches the *thing owned*, not the owner.

## Model sentences

- Mon oncle est gentil et ma tante est gentille.
- Elle porte une jolie robe et des chaussettes noires.
- Nos voisins ont un nouveau vélo.

## Sound tips

The feminine **-e** makes the last consonant sound: *grand* is "gron" but *grande* is "grond"; *petit* is "puh-TEE" but *petite* is "puh-TEET"; *blanc* is "blon" and *blanche* is "blonsh".

## Common mistakes

- Writing *une fille intelligent*: it must be **une fille intelligente**.
- Putting **petit** after the noun (*une maison petite*): say **une petite maison**.
- Using **ma** before a vowel: **mon amie**.`,
      },
      quiz: {
        title: "Grammar — Nouns, Articles & Adjectives: Year 8 quiz",
        questions: [
          q8.single("Choose the right word: '___ frère' (my brother)", "mon", ["ma", "mes", "ton"], "Frère is masculine singular, so 'my' is mon.", 1),
          q8.single("What is the feminine form of 'petit'?", "petite", ["petit", "petites", "petitte"], "Add -e to the masculine form to make the feminine: petite.", 1),
          q8.single("Choose the right form: 'Les garçons sont ___.' (tall)", "grands", ["grand", "grandes", "grande"], "The subject is masculine plural, so add -s.", 1),
          q8.single("Choose the right form: 'Ma cousine est ___.' (sporty)", "sportive", ["sportif", "sportifve", "sportives"], "-if changes to -ive in the feminine singular.", 2, true),
          q8.single("Which phrase is correct for 'a big house'?", "une grande maison", ["une maison grande", "un grande maison", "une grand maison"], "Grand goes before the noun and agrees with feminine maison.", 2),
          q8.single("Choose the right word: '___ amie' (my friend, a girl)", "mon", ["ma", "mes", "son"], "Before a feminine noun that starts with a vowel, use mon.", 2),
          q8.short("Write 'our house' in French.", "notre maison", "Notre is used for both masculine and feminine singular nouns.", 2, { na: true, diag: true }),
          q8.short("Complete: Ce sont des chaussures ____. (white)", "blanches", "Blanc becomes blanche (feminine) and then blanches (plural).", 3, { na: true }),
          q8.multi("Which phrases are correct? Choose all that apply.", ["une belle maison", "des filles intelligentes", "notre voiture"], ["un fille intelligente", "des chaussures blanc"], "Belle is the feminine of beau and comes before the noun; the plural noun needs plural adjectives.", 3),
          q8.single("Which adjective normally goes AFTER the noun?", "intéressant", ["petit", "grand", "joli"], "Petit, grand and joli are short common adjectives that go before; most others go after.", 2),
        ],
      },
      flashcards: cards([
        ["mon / ma / mes", "my (masc / fem / plural)"],
        ["son / sa / ses", "his or her"],
        ["notre / nos", "our (singular / plural)"],
        ["leur / leurs", "their (singular / plural)"],
        ["heureux → feminine", "heureuse"],
        ["gentil → feminine", "gentille"],
        ["blanc → feminine", "blanche"],
        ["a new bike", "un nouveau vélo"],
        ["une jolie robe", "a pretty dress"],
        ["my friend (girl)", "mon amie"],
      ]),
    },
    9: {
      year: 9,
      objectives: [
        "Use the partitive article (du, de la, de l', des) and de after negatives and quantities.",
        "Use direct object pronouns (le, la, l', les and me, te, nous, vous) in the right place.",
        "Form comparatives and superlatives (plus … que, moins … que, aussi … que, le plus …, meilleur).",
        "Understand where en and y fit and apply pronouns in short written and translated sentences.",
      ],
      note: {
        title: "Year 9: partitives, pronouns and comparatives",
        body: `## Partitive: some / any

**du** (m), **de la** (f), **de l'** (vowel), **des** (plural): **Elle boit du thé.** After a **negative** or a **quantity** it becomes **de / d'**: **Il n'y a pas de sucre. Beaucoup de gens.**

## Direct object pronouns

They replace a noun and go **before the verb**: **me, te, le, la, l', nous, vous, les**.

- Tu vois Marc ? Oui, je **le** vois.
- Il aime les chiens. Il **les** caresse.
- Negative: **ne** + pronoun + verb + **pas**: **Je ne le vois pas.**
- **En** = of it / some: **J'en veux deux.** **Y** = there: **J'y vais.**

## Comparatives and superlatives

- **plus** + adjective + **que** = more … than: **Ce sac est plus lourd que ce livre.**
- **moins … que** = less … than; **aussi … que** = as … as.
- **le / la / les plus** + adjective = the most: **la plus grande ville**; **le / la moins** = the least.
- Irregular: **bon → meilleur** (*a better idea*: **une meilleure idée**); **bien → mieux**.

## Model sentences

- Je prends du riz, mais je ne prends pas de pâtes.
- La glace, je l'adore ! Les épinards, je les déteste.
- Cette rue est moins longue que l'autre.

## Sound tips

*Meilleur* sounds like "may-YUR"; **le / la** before a vowel become **l'** (*je l'adore*).

## Common mistakes

- Saying *plus bon* instead of **meilleur**.
- Putting the pronoun after the verb (*je regarde le*): it goes before: **je le regarde**.
- Using **comme** or **de** instead of **que** after a comparative.`,
      },
      quiz: {
        title: "Grammar — Nouns, Articles & Adjectives: Year 9 quiz",
        questions: [
          q9.single("Choose the right word: 'Ce livre est ___ intéressant que l'autre.' (more)", "plus", ["moins", "aussi", "très"], "Plus … que means 'more … than'.", 1),
          q9.single("Choose the right word: 'Mon frère est aussi grand ___ moi.'", "que", ["de", "qui", "à"], "Aussi … que means 'as … as'.", 1),
          q9.single("Replace the noun: 'Je regarde le film.' → 'Je ___ regarde.'", "le", ["la", "les", "lui"], "Film is masculine singular, so the pronoun is le, and it goes before the verb.", 1),
          q9.single("Replace the noun: 'Elle mange les pommes.' → 'Elle ___ mange.'", "les", ["le", "la", "l'"], "Pommes is plural, so the pronoun is les.", 2, true),
          q9.single("Complete: 'Où est ma veste ? Je ___ cherche.'", "la", ["le", "les", "lui"], "Veste is feminine singular, so the pronoun is la.", 2),
          q9.single("Choose the correct form: 'Ce gâteau est ___ que l'autre.' (better)", "meilleur", ["plus bon", "plus bien", "meilleure"], "Bon has an irregular comparative: meilleur (masculine here because gâteau is masculine).", 2),
          q9.short("Rewrite 'Je mange les fruits' using a pronoun for 'les fruits'.", "je les mange", "The pronoun les goes before the verb: je les mange.", 2, { na: true, diag: true }),
          q9.short("Write 'She is less tall than me' in French.", "elle est moins grande que moi", "Use moins + adjective + que, and grande is feminine.", 2, { na: true }),
          q9.multi("Which sentences are correct? Choose all that apply.", ["Il est le plus rapide de la classe.", "Je les regarde tous les jours.", "Elle est moins timide que sa sœur."], ["Je regarde les tous les jours.", "Il est plus grand comme moi."], "Pronouns go before the verb, and comparatives take que.", 3),
          q9.written("Write four sentences in French: two comparing people or things (use plus/moins/aussi … que) and two that use a direct object pronoun (le, la, l' or les).", "Mon frère est plus grand que moi. Ma ville est moins animée que Paris. J'aime les bananes, je les mange tous les jours. Je regarde ce film, je le trouve drôle.", "Mark scheme (5 marks): 1 mark each for two correct comparatives (plus/moins/aussi + adjective + que with correct agreement), 1 mark each for two correct object pronouns in the right position, and 1 mark for overall accuracy.", 3),
        ],
      },
      flashcards: cards([
        ["plus … que", "more … than"],
        ["as … as", "aussi … que"],
        ["meilleur", "better (from bon)"],
        ["the most (adjective)", "le / la / les plus + adjective"],
        ["le, la, l', les (pronouns)", "him/it, her/it, him/her/it, them"],
        ["Je le vois.", "I see him / it."],
        ["I don't see her.", "Je ne la vois pas."],
        ["du / de la / de l' / des", "some (partitive)"],
        ["after a negative: du, de la, des →", "de (or d')"],
        ["beaucoup ___ gens", "de"],
      ]),
    },
  },
};
