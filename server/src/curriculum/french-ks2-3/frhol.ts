// French — Holidays & Travel (Year 9). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q9 = qb("frhol", 9);

export const TOPIC: CTopic = {
  key: "frhol",
  topic: "Holidays & Travel",
  subject: "French",
  years: {
    9: {
      year: 9,
      objectives: [
        "Talk about holiday destinations, accommodation and transport.",
        "Describe a past holiday using the perfect tense and a future holiday using aller + infinitive.",
        "Book a room and ask for information in a simple transaction.",
        "Read an account of a holiday and identify details, opinions and time references.",
      ],
      note: {
        title: "Year 9: holidays and travel",
        body: `## Where and how?

| French | English |
| --- | --- |
| en avion / en train / en voiture | by plane / by train / by car |
| en bateau / en car / à pied | by boat / by coach / on foot |
| un hôtel | a hotel |
| un camping | a campsite |
| une auberge de jeunesse | a youth hostel |
| un gîte | a holiday cottage |
| la plage / la mer | the beach / the sea |
| la randonnée | hiking |

**Countries:** **en** + feminine (en Espagne, en Italie), **au** + masculine (au Canada, au Portugal).

## Talking about the past

**Je suis allé(e)** = I went (add **-e** if you are a girl). **Nous avons acheté des souvenirs.** = We bought souvenirs. **J'ai mangé des crêpes.** = I ate crêpes. Verbs of movement like aller use **être** and agree with the subject: **Elles sont allées à Nice.**
To say what it was like: **C'était génial / magnifique / ennuyeux.**

## Talking about the future

**L'été prochain, je vais visiter Rome.** (Next summer I'm going to visit Rome.)

## Booking a room

**Je voudrais réserver une chambre pour trois personnes avec douche.** (I would like to book a room for three people with a shower.)

## Sound tips

*Gîte* sounds like "zheet"; *avion* is "a-vee-ON"; *camping* is "kon-PEENG"; the **-s** in *allés* is silent, so *allé* and *allés* sound identical.

## Common mistakes

- Using **avoir** with aller: *j'ai allé* is wrong; say **je suis allé**.
- Forgetting agreement: a group of girls says **nous sommes allées**.
- Saying **à France** instead of **en France**.`,
      },
      quiz: {
        title: "Holidays & Travel: Year 9 quiz",
        questions: [
          q9.single("What does 'en avion' mean?", "by plane", ["by train", "by car", "by boat"], "Avion is plane, so en avion is by plane.", 1),
          q9.single("What is 'une auberge de jeunesse'?", "a youth hostel", ["a hotel", "a campsite", "a holiday cottage"], "Auberge is inn/hostel and jeunesse is youth: a youth hostel.", 1),
          q9.single("What is 'la plage'?", "the beach", ["the sea", "the mountain", "the swimming pool"], "La plage is the beach (not the same as la mer, the sea).", 1),
          q9.single("What does 'Je suis allée à Paris' mean?", "I went to Paris", ["I am going to Paris", "I was born in Paris", "I would go to Paris"], "Je suis allée is the perfect tense of aller (I went). The extra -e shows the speaker is female.", 2, true),
          q9.single("Choose the right form: 'Nous ___ visité le château.'", "avons", ["sommes", "avez", "ont"], "Visiter takes avoir in the perfect tense: nous avons visité.", 2),
          q9.single("What does 'Je voudrais réserver une chambre pour deux personnes' mean?", "I would like to book a room for two people", ["I would like to eat a meal for two people", "I have a room for two people", "I would like to visit two rooms"], "Réserver means to book and une chambre is a bedroom.", 2),
          q9.short("Write 'by train' in French.", "en train", "With most transport use en: en train, en voiture, en avion.", 2, { na: true, diag: true }),
          q9.short("Complete: L'été prochain, je ____ aller en Espagne. (I am going to go)", "vais", "The near future is aller in the present + infinitive: je vais aller.", 2, { na: true }),
          q9.multi("Which sentences are correct French? Choose all that apply.", ["Je suis allé au Canada.", "Elle est allée en Italie.", "Nous avons visité un musée."], ["J'ai allé à la plage.", "Ils sont allé à Paris."], "Aller takes être and agrees with its subject (ils sont allés), while visiter takes avoir.", 3),
          q9.single("'L'année dernière, je suis allé en Écosse avec ma famille. Nous avons dormi dans un gîte à la campagne. C'était magnifique ! L'année prochaine, je vais aller en Grèce.' Which statement is TRUE?", "He went to Scotland last year.", ["He is going to Scotland next year.", "He slept in a hotel in Greece.", "He thought the holiday was boring."], "L'année dernière is last year; l'année prochaine is next year. C'était magnifique shows he loved it.", 3),
        ],
      },
      flashcards: cards([
        ["en voiture", "by car"],
        ["on foot", "à pied"],
        ["un camping", "a campsite"],
        ["a holiday cottage", "un gîte"],
        ["la randonnée", "hiking"],
        ["I went to Spain (a girl says).", "Je suis allée en Espagne."],
        ["Nous avons acheté des souvenirs.", "We bought souvenirs."],
        ["C'était génial.", "It was great."],
        ["next summer", "l'été prochain"],
        ["last year", "l'année dernière"],
      ]),
    },
  },
};
