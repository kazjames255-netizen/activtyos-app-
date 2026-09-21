// French — Local, National & Global Areas of Interest (GCSE, Years 10 and 11). Original content aligned to the DfE GCSE modern foreign languages subject content (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q10 = qb("frloc", 10);
const q11 = qb("frloc", 11);

export const TOPIC: CTopic = {
  key: "frloc",
  topic: "Local, National & Global Areas of Interest",
  subject: "French",
  years: {
    10: {
      year: 10,
      subtopic: "GCSE Year 10",
      yearsCovered: [10],
      objectives: [
        "Describe your home, town, neighbourhood and region, with advantages and disadvantages.",
        "Compare places using plus / moins / aussi … que and the superlative.",
        "Talk about holidays and travel in the past, present and future, including accommodation and transport.",
        "Choose the correct preposition with towns, countries and regions (à, en, au, aux).",
        "Read and translate short texts about places and holidays.",
      ],
      note: {
        title: "Year 10: town, region, travel and tourism",
        body: `## Describing where you live

| French | English |
| --- | --- |
| il y a / il n'y a pas de | there is, there are / there isn't, there aren't any |
| près de / loin de / à côté de | near / far from / next to |
| pas assez de + noun | not enough … (no article after *de*) |
| un quartier, des transports en commun | a neighbourhood, public transport |
| un séjour, un billet, un camping | a stay, a ticket, a campsite |

- **J'habite dans une petite ville dans le nord de l'Angleterre.** = I live in a small town in the north of England.
- **L'avantage, c'est que tout est près de chez moi ; l'inconvénient, c'est qu'il n'y a pas assez de transports en commun.** = The advantage is that everything is near my house; the disadvantage is that there is not enough public transport.

## Little words with places

| Place | Use | Example |
| --- | --- | --- |
| city | **à** | à Paris |
| feminine country (or one starting with a vowel) | **en** | en Espagne, en Irlande |
| masculine country | **au** | au Portugal |
| plural country | **aux** | aux États-Unis |

## Comparing

Use **plus / moins / aussi + adjective + que**: *Ma ville est plus calme que Londres, mais moins animée.* For "the best" use **meilleur(e)**, never *plus bon*: *Ce sont les meilleures plages de la région.*

## Holidays in three tenses

- Past: **L'été dernier, nous sommes allés au Portugal. Il faisait chaud et nous avons visité la vieille ville.**
- Future: **L'année prochaine, je voudrais découvrir la Belgique.**

## Common errors

- *à Espagne* (wrong): use **en Espagne**.
- *il n'y a pas un parc*: after a negative use **de**, so *il n'y a pas de parc*.`,
      },
      quiz: {
        title: "Local, National & Global Areas of Interest: Year 10 quiz",
        questions: [
          q10.single("What does 'le quartier' mean?", "the neighbourhood", ["the station", "the quarter of an hour", "the countryside"], "Un quartier is a district or neighbourhood of a town.", 1),
          q10.short("Write in French: 'near the station'.", "près de la gare", "Près de means near, followed by the noun with its article: la gare (feminine).", 1, { na: true }),
          q10.short("Complete with en, au or aux: Nous allons ____ Japon cet été.", "au", "Japon is a masculine country, so we use au (à + le).", 2, { diag: true }),
          q10.single("Which sentence means 'There are not enough activities for young people'?", "Il n'y a pas assez d'activités pour les jeunes.", ["Il n'y a pas assez des activités pour les jeunes.", "Il n'y a pas assez activités pour les jeunes.", "Il n'y a pas assez de les activités pour les jeunes."], "Assez de + noun: de (d' before a vowel) stays with no article.", 2),
          q10.multi(
            "Read the text. Which THREE statements are true?\n\n« En août, nous avons passé une semaine dans un camping près de la mer, en Bretagne. Le premier jour, il pleuvait, alors nous avons visité un petit musée sur les bateaux. Les jours suivants, il faisait beau et nous nous sommes baignés tous les matins. Mon frère a fait de la voile, mais moi, j'ai préféré lire sur la plage. Le camping était bruyant la nuit, mais c'était l'endroit idéal pour rencontrer d'autres jeunes. »",
            ["The family stayed on a campsite in Brittany.", "They visited a museum because it rained on the first day.", "The writer's brother went sailing."],
            ["The writer went sailing every morning.", "The campsite was quiet at night."],
            "Camping … en Bretagne, il pleuvait → musée, and mon frère a fait de la voile. The writer preferred reading and the campsite was noisy (bruyant).",
            2, true,
          ),
          q10.single("Which sentence means 'This is the best restaurant in the town'?", "C'est le meilleur restaurant de la ville.", ["C'est le plus bon restaurant de la ville.", "C'est le mieux restaurant de la ville.", "C'est meilleur le restaurant de la ville."], "The superlative of bon is le meilleur (masculine here). Plus bon is never used, and mieux is an adverb.", 2),
          q10.multi("Which sentences are correct French? Choose all that apply.", ["L'été dernier, nous sommes allés en Écosse.", "Il faisait très chaud à Nice.", "Je voudrais habiter dans une grande ville."], ["Je vais à Portugal en juillet.", "Nous avons allé à la plage."], "Aller takes être in the perfect tense, and a masculine country such as le Portugal needs au (not à).", 2),
          q10.short("Translate into French: 'There is nothing to do for young people in my village.'", "il n'y a rien à faire pour les jeunes dans mon village", "Il n'y a rien à + infinitive is 'there is nothing to …'. The subject il is impersonal.", 3, { na: true, acc: ["dans mon village il n'y a rien à faire pour les jeunes", "dans mon village, il n'y a rien à faire pour les jeunes"] }),
          q10.short("Complete with the imperfect tense of faire (one word): Hier, il ____ très froid à Lille.", "faisait", "Weather descriptions in the past use the imperfect: il faisait froid.", 2, {}),
          q10.single("Which is the best translation of 'Last summer we stayed in a small hotel near the beach'?", "L'été dernier, nous avons logé dans un petit hôtel près de la plage.", ["L'été dernier, nous sommes logés dans un petit hôtel près de la plage.", "L'été dernier, nous avons logé dans un hôtel petit près la plage.", "L'été dernier, nous logeons dans un petit hôtel près de la plage."], "Loger takes avoir in the perfect; petit goes before the noun; near is près de + article.", 3),
          q10.short("Translate into French: 'I would like to visit Canada next year.'", "l'année prochaine, je voudrais visiter le Canada", "Voudrais + infinitive; visiter takes a direct object (le Canada); the time phrase can go first or last.", 3, { na: true, acc: ["je voudrais visiter le Canada l'année prochaine", "l'année prochaine, j'aimerais visiter le Canada", "j'aimerais visiter le Canada l'année prochaine", "l'année prochaine je voudrais visiter le Canada", "l'année prochaine j'aimerais visiter le Canada"] }),
          q10.written(
            "Write 5–6 sentences in French about your town or region and a holiday you have taken. Include one advantage, one disadvantage, one comparison and one sentence about last summer or next year.",
            "J'habite dans une ville moyenne dans le sud de l'Angleterre. L'avantage, c'est qu'il y a un grand parc et une belle piscine. L'inconvénient, c'est qu'il n'y a pas assez de magasins pour les jeunes. Ma ville est plus tranquille que Brighton, mais moins animée. L'été dernier, je suis allé en Grèce avec ma famille et il faisait très chaud. L'année prochaine, je voudrais visiter l'Italie.",
            "Marking guide (10): all four required elements covered (4); accurate town vocabulary and il y a / il n'y a pas de (2); a correct comparison with plus / moins … que (1); accurate past tense and a future or conditional form (2); spelling, gender and agreement (1).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["il n'y a pas assez de …", "there isn't / aren't enough …"],
        ["près de / loin de", "near / far from"],
        ["to Spain / to Portugal / to the USA", "en Espagne / au Portugal / aux États-Unis"],
        ["Why 'meilleur' and not 'plus bon'?", "Bon has an irregular comparative and superlative: meilleur(e)."],
        ["un séjour", "a stay"],
        ["les transports en commun", "public transport"],
        ["il pleuvait / il faisait beau", "it was raining / the weather was nice"],
        ["un quartier", "a neighbourhood / district"],
        ["l'avantage, c'est que …", "the advantage is that …"],
        ["un billet", "a ticket"],
      ]),
    },
    11: {
      year: 11,
      subtopic: "GCSE Year 11",
      yearsCovered: [11],
      objectives: [
        "Discuss social issues: charity and voluntary work, healthy living, homelessness and poverty.",
        "Discuss global issues: the environment, pollution, climate change and what we can do.",
        "Express obligation, advice and purpose (il faut, on devrait, on pourrait, pour / afin de + infinitive).",
        "Use the future and conditional to talk about solutions and future plans.",
        "Give reasons with à cause de, grâce à and malgré.",
      ],
      note: {
        title: "Year 11: the environment, charity and social issues",
        body: `## Saying what should be done

| Structure | Example |
| --- | --- |
| **il faut** + infinitive | Il faut réduire les déchets. |
| **on devrait / on pourrait** + infinitive | On pourrait acheter des produits locaux. |
| **il faudrait** (it would be necessary) | Il faudrait agir plus vite. |
| **pour / afin de** + infinitive (in order to) | Afin d'économiser l'énergie, je prends des douches courtes. |

After *il faut*, *on devrait*, *pour* and *afin de*, the verb stays in the **infinitive**.

## Giving reasons

- **à cause de** = because of (usually bad): *À cause de la circulation, l'air est pollué en ville.*
- **grâce à** = thanks to (good): *Grâce aux énergies renouvelables, on peut réduire la pollution.*
- **malgré** = despite: *Malgré le froid, les bénévoles distribuent des repas.*

## Vocabulary

le réchauffement climatique (global warming) · les déchets (m) (waste) · gaspiller (to waste) · protéger l'environnement · un(e) sans-abri (a homeless person) · le bénévolat / faire du bénévolat (voluntary work) · une association caritative (a charity) · la pauvreté (poverty) · mondial(e) (worldwide)

## Model sentences

- **Je fais du bénévolat dans une association qui aide les sans-abri.** = I volunteer for a charity that helps homeless people.
- **À l'avenir, j'irai à l'école à vélo pour réduire la pollution.** = In future I will cycle to school to reduce pollution.

## Common errors

- Writing *il faut que réduire* or *il faut de réduire*: use **il faut réduire**.
- Using *grâce à* for something negative: use *à cause de*.`,
      },
      quiz: {
        title: "Local, National & Global Areas of Interest: Year 11 quiz",
        questions: [
          q11.single("What does 'les déchets' mean?", "waste, rubbish", ["decisions", "dishes", "deserts"], "Les déchets are waste or rubbish. Gaspiller is to waste, which is a verb.", 1),
          q11.short("Write in French: 'a homeless person' (masculine).", "un sans-abri", "Sans-abri means 'without shelter' and does not change in the plural: des sans-abri.", 1, { na: true, acc: ["un sans abri", "un sdf", "un SDF"] }),
          q11.single("Which word completes the sentence? « ____ la pollution, beaucoup d'enfants ont de l'asthme. »", "À cause de", ["Grâce à", "Malgré", "Sans"], "The pollution is the cause of a bad result, so à cause de. Grâce à is used for good results.", 2, true),
          q11.short("Complete with the correct form of the verb: Il faut ____ (protéger) les forêts.", "protéger", "After il faut we use the infinitive, so the verb stays as protéger.", 2, { na: true }),
          q11.single(
            "Read the text. What does the writer plan to do next year?\n\n« Depuis deux ans, je fais du bénévolat le samedi dans une association qui aide les personnes sans domicile fixe. Nous préparons des repas chauds et nous les distribuons près de la gare. Au début, j'avais un peu peur de parler aux gens, mais ils sont très sympathiques. Ce qui me motive, c'est de me sentir utile. L'année prochaine, je voudrais organiser une collecte de vêtements dans mon école, parce que l'hiver est très dur pour les sans-abri. »",
            "Organise a collection of clothes at school.",
            ["Serve hot meals at the station.", "Stop volunteering to concentrate on school.", "Travel abroad to help other charities."],
            "L'année prochaine, je voudrais organiser une collecte de vêtements dans mon école. Serving hot meals is what the writer does now.",
            2, true,
          ),
          q11.multi("Which sentences are correct French? Choose all that apply.", ["On devrait éteindre les lumières en sortant.", "Grâce à cette association, beaucoup de familles ont un toit.", "Malgré la pluie, ils ont ramassé les déchets."], ["Il faut de réduire les déchets.", "On devrait recyclé plus de verre."], "After on devrait the verb is an infinitive (recycler, not recyclé), and il faut is followed directly by the infinitive.", 2),
          q11.single("Which sentence means 'Global warming is a worldwide problem'?", "Le réchauffement climatique est un problème mondial.", ["La réchauffement climatique est un problème mondial.", "Le réchauffement climatique est une problème mondial.", "Le réchauffement climatique est un problème monde."], "Réchauffement is masculine (le) and mondial is the adjective; monde is a noun.", 2),
          q11.short("Translate into French: 'In order to protect the environment, we should use less plastic.'", "afin de protéger l'environnement, on devrait utiliser moins de plastique", "Afin de / pour + infinitive for purpose; on devrait + infinitive for 'we should'; moins de + noun.", 3, { na: true, acc: ["pour protéger l'environnement, on devrait utiliser moins de plastique", "afin de protéger l'environnement, nous devrions utiliser moins de plastique", "pour protéger l'environnement, nous devrions utiliser moins de plastique", "afin de protéger l'environnement, il faudrait utiliser moins de plastique", "pour protéger l'environnement, il faudrait utiliser moins de plastique", "on devrait utiliser moins de plastique afin de protéger l'environnement", "on devrait utiliser moins de plastique pour protéger l'environnement", "nous devrions utiliser moins de plastique pour protéger l'environnement", "nous devrions utiliser moins de plastique afin de protéger l'environnement"] }),
          q11.single("Which sentence means 'In the future, I will volunteer for an animal charity'?", "À l'avenir, je ferai du bénévolat pour une association qui protège les animaux.", ["À l'avenir, je fairai du bénévolat pour une association qui protège les animaux.", "À l'avenir, je fait du bénévolat pour une association qui protège les animaux.", "À l'avenir, j'ai fait du bénévolat pour une association qui protège les animaux."], "Faire has an irregular future stem: fer- + ai. Je ferai is the future; j'ai fait is past.", 3),
          q11.short("Complete with one word: Il ____ planter plus d'arbres en ville. (falloir, conditional)", "faudrait", "The conditional of falloir is il faudrait: future stem faudr- + the imperfect ending -ait.", 3, {}),
          q11.single("Which word means 'to waste'?", "gaspiller", ["gagner", "garder", "gâter"], "Gaspiller is to waste. Gagner is to win or earn, garder is to keep, and gâter is to spoil.", 2),
          q11.written(
            "Write 6–8 sentences in French about an environmental or social problem in your area or the world. Explain the problem, say what should be done (il faut / on devrait) and what you personally will do in the future.",
            "Le plus grand problème, c'est la pollution de l'air dans les grandes villes. À cause de la circulation, beaucoup de gens ont des problèmes respiratoires. Il faut réduire le nombre de voitures et on devrait construire plus de pistes cyclables. Grâce aux transports en commun, on peut aussi économiser de l'énergie. Pour ma part, j'irai à l'école à pied plus souvent, et je ferai du bénévolat dans une association qui plante des arbres.",
            "Marking guide (12): explanation of the problem with reasons (3); il faut / on devrait + infinitive used correctly (2); à cause de / grâce à or similar connective (1); future tense used accurately (2); range of vocabulary (2); accuracy of gender, agreement and spelling (2).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["Il faut + ?", "the infinitive: Il faut recycler."],
        ["on devrait / on pourrait", "we should / we could (+ infinitive)"],
        ["à cause de / grâce à", "because of (bad) / thanks to (good)"],
        ["malgré", "despite"],
        ["le réchauffement climatique", "global warming"],
        ["les déchets (m)", "waste, rubbish"],
        ["faire du bénévolat", "to do voluntary work"],
        ["une association caritative", "a charity"],
        ["pour / afin de + infinitive", "in order to"],
        ["Future of faire (je …)", "je ferai"],
      ]),
    },
  },
};
