// French — Free Time (Year 8). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q8 = qb("frft", 8);

export const TOPIC: CTopic = {
  key: "frft",
  topic: "Free Time",
  subject: "French",
  years: {
    8: {
      year: 8,
      objectives: [
        "Talk about free-time activities: sport, music, screens, reading and going out.",
        "Use jouer à + game/sport, jouer de + instrument and faire du/de la/de l'/des + activity.",
        "Say how often you do things using souvent, parfois, toujours, rarement and ne … jamais.",
        "Make and reply to invitations; read a short text about weekend activities and extract detail.",
      ],
      note: {
        title: "Year 8: what do you do in your free time?",
        body: `## Jouer à or jouer de?

- **jouer à** + game or sport: **je joue au basket**, **elle joue aux cartes**, **ils jouent à la pétanque**.
- **jouer de** + instrument: **je joue de la flûte**, **il joue du piano**, **elle joue de la batterie**.

## Faire du / de la / de l' / des

**Je fais du judo** (judo), **de la natation** (swimming), **de la danse**, **de l'équitation** (horse riding), **du vélo**, **des courses** (shopping for food).

## Other activities

regarder la télé / des films, écouter de la musique, lire des BD (comics), sortir avec mes amis, jouer aux jeux vidéo, aller sur les réseaux sociaux.

## How often?

| Word | Meaning |
| --- | --- |
| toujours | always |
| souvent | often |
| parfois | sometimes |
| rarement | rarely |
| ne … jamais | never |

**Je lis souvent des BD.** **Je ne sors jamais le lundi.** (The ne … jamais goes round the verb.)

## Invitations

**Tu veux aller au cinéma ?** = Do you want to go to the cinema? **Oui, d'accord !** = Yes, OK! **Désolé(e), je ne peux pas.** = Sorry, I can't.

## Sound tips

*Guitare* sounds like "gee-TAR"; *jeux* is "zhuh"; *équitation* is "ay-kee-ta-SYON". The final **-s** in *jeux vidéo* and **-nt** in *ils jouent* are silent.

## Common mistakes

- Using **jouer à** for an instrument: **je joue de la flûte**, not *je joue à la flûte*.
- Forgetting the **ne** in **ne … jamais**.
- Writing **je joue de le piano**: de + le always joins to make **du** (je joue du piano).`,
      },
      quiz: {
        title: "Free Time: Year 8 quiz",
        questions: [
          q8.single("What does 'toujours' mean?", "always", ["never", "sometimes", "often"], "Toujours means always; jamais means never.", 1),
          q8.single("What does 'je fais du vélo' mean?", "I go cycling", ["I go swimming", "I do judo", "I ride a horse"], "Faire du vélo is 'to go cycling'.", 1),
          q8.single("What does 'souvent' mean?", "often", ["rarely", "always", "never"], "Souvent means often, as in je joue souvent au foot.", 1),
          q8.single("Choose the right words: 'Je joue ___ guitare.'", "de la", ["à la", "au", "du"], "With instruments use jouer de; guitare is feminine, so de la.", 2, true),
          q8.single("Choose the right words: 'Je fais ___ natation.'", "de la", ["du", "des", "à la"], "Natation is feminine, so faire de la natation.", 2),
          q8.single("What does 'Je ne joue jamais aux jeux vidéo' mean?", "I never play video games", ["I always play video games", "I don't like video games", "I sometimes play video games"], "Ne … jamais wraps round the verb and means never.", 2),
          q8.short("Complete: Je fais ____ vélo le samedi.", "du", "Vélo is masculine, so faire du vélo.", 2, { diag: true }),
          q8.short("Write 'I sometimes watch TV' in French.", "je regarde parfois la télé", "Parfois goes after the verb. Regarder + la télé.", 3, { na: true, acc: ["je regarde la télé parfois", "parfois, je regarde la télé", "parfois je regarde la télé", "je regarde parfois la télévision", "je regarde la télévision parfois", "parfois, je regarde la télévision", "parfois je regarde la télévision", "je regarde quelquefois la télé", "je regarde quelquefois la télévision"] }),
          q8.single("'Le week-end, je joue souvent au foot avec mes amis, mais je ne regarde jamais la télé. Le dimanche, je fais du vélo ou je joue de la guitare.' What does the speaker never do?", "watch TV", ["play football", "go cycling", "play the guitar"], "Ne … jamais means never, and it goes with je ne regarde jamais la télé.", 2),
          q8.written("Write 3–4 sentences in French about your free time. Include one activity with jouer à or jouer de, one with faire, a frequency word and one opinion.", "Le week-end, je joue souvent au foot avec mes amis. Je joue aussi de la guitare. Je fais parfois du vélo. J'adore la musique parce que c'est amusant.", "Mark scheme (5 marks): 1 mark each for correct jouer à/de use, correct faire du/de la, a frequency word in the right place, an opinion with a reason, and overall accuracy of verbs and spelling.", 3),
        ],
      },
      flashcards: cards([
        ["jouer de la guitare", "to play the guitar"],
        ["to play football", "jouer au football"],
        ["faire de la danse", "to do dance / to go dancing"],
        ["rarely", "rarement"],
        ["parfois", "sometimes"],
        ["ne … jamais", "never"],
        ["Tu veux aller au cinéma ?", "Do you want to go to the cinema?"],
        ["Yes, OK!", "Oui, d'accord !"],
        ["Désolé, je ne peux pas.", "Sorry, I can't."],
        ["comics (BD)", "les BD (bandes dessinées)"],
      ]),
    },
  },
};
