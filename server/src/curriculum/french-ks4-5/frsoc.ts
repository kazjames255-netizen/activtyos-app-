// French — Aspects of Society (A-level, Years 12 and 13). Original content aligned to the DfE GCE modern foreign languages subject content (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q12 = qb("frsoc", 12);
const q13 = qb("frsoc", 13);

export const TOPIC: CTopic = {
  key: "frsoc",
  topic: "Aspects of Society",
  subject: "French",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12",
      yearsCovered: [12],
      objectives: [
        "Discuss changing family structures and relationships in French-speaking society.",
        "Discuss the cyber-society: social media, privacy, screen time, online harassment and remote work.",
        "Discuss the role of volunteering and the voluntary sector.",
        "Use statistics language and structures of argument (certes … mais, bien que, alors que, ce qui).",
        "Read and summarise authentic-style texts about society, and translate into French.",
      ],
      note: {
        title: "Year 12: family, the cyber-society and volunteering",
        body: `## Discussing social trends

Use statistics language: *selon une enquête*, *la majorité / une minorité*, *un tiers, un quart, la moitié*, *en hausse / en baisse*, *de plus en plus de / de moins en moins de*. After *de plus en plus de* + plural noun the verb is **plural**: *De plus en plus d'enfants grandissent dans une famille recomposée.*

| French | English |
| --- | --- |
| une famille monoparentale / recomposée | a single-parent / blended family |
| le télétravail | working from home |
| la vie privée, les données personnelles | privacy, personal data |
| le cyberharcèlement | online harassment |
| le bénévolat, une ONG | volunteering, an NGO |

## Building an argument

- **Certes … mais** = admittedly … but: *Certes, les écrans facilitent la communication, mais ils isolent parfois.*
- **bien que** + subjunctive = although: *Bien qu'elle travaille beaucoup, elle trouve du temps pour le bénévolat.*
- **tandis que / alors que** + indicative = whereas: *Les grands-parents préfèrent le téléphone, tandis que les jeunes écrivent des messages.*
- **ce qui** refers back to a whole clause: *Le télétravail se développe, ce qui change la vie de famille.*
- **il est essentiel / important que** + subjunctive.

## Common errors

- Singular verb after *de plus en plus de* + plural noun: say *de plus en plus de familles sont …*.
- *Bien que* + indicative: it always takes the subjunctive.
- Confusing *ce qui* (subject) and *ce que* (object): *ce qui m'inquiète* but *ce que je pense*.`,
      },
      quiz: {
        title: "Aspects of Society: Year 12 quiz",
        questions: [
          q12.single("Which conjunction is followed by the subjunctive?", "bien que", ["parce que", "puisque", "pendant que"], "Bien que (although) always takes the subjunctive. The other three take the indicative.", 1),
          q12.short("Complete with ce qui, ce que or ce dont: Je ne comprends pas ____ tu veux dire.", "ce que", "Tu is the subject of veux dire, so the pronoun is the object: ce que.", 1, {}),
          q12.single("Which form completes the sentence? « De plus en plus de jeunes ____ leurs vacances à l'étranger. » (passer)", "passent", ["passe", "passons", "passer"], "The subject is the plural noun jeunes, so the verb is plural: passent.", 2),
          q12.short("Give the subjunctive of être (one word): Bien que les réseaux sociaux ____ pratiques, ils créent une dépendance.", "soient", "Bien que needs the subjunctive; être is irregular: qu'ils soient.", 2, { diag: true }),
          q12.single(
            "Read the text. According to some sociologists, what matters most?\n\n« Selon une enquête menée auprès des élèves d'un lycée de Rennes, près d'un élève sur quatre vit dans une famille monoparentale ou recomposée. Pour certains sociologues, ce n'est pas un signe de crise : ce qui compte, c'est la qualité des liens entre les membres de la famille. Pourtant, ces familles rencontrent souvent des difficultés financières, surtout quand un seul parent assure les revenus. Face à ce problème, plusieurs associations proposent une aide au logement et des services de garde d'enfants à prix réduit. »",
            "The quality of the relationships between family members.",
            ["The number of parents living at home.", "The family's total income.", "The size of the family home."],
            "Ce qui compte, c'est la qualité des liens entre les membres de la famille. Money worries are mentioned as a separate difficulty (pourtant …).",
            2, true,
          ),
          q12.multi("Which sentences are correct French? Choose all that apply.", ["De moins en moins de gens lisent le journal papier.", "La plupart des jeunes utilisent leur portable tous les jours.", "Certes, Internet est utile, mais il présente des dangers."], ["De plus en plus de familles est recomposée.", "Tandis que les enfants joue dehors, les parents parlent."], "The verb must agree with the plural noun (familles sont, enfants jouent), not with de plus en plus.", 2),
          q12.single("Which word means 'online harassment'?", "le cyberharcèlement", ["la cybercriminalité", "le cyberespace", "la cybersécurité"], "Harcèlement is harassment or bullying. Cybercriminalité is cybercrime, and cyberespace and cybersécurité mean cyberspace and cybersecurity.", 2),
          q12.short("Translate into French: 'Although young people are very connected, many of them feel lonely.'", "bien que les jeunes soient très connectés, beaucoup d'entre eux se sentent seuls", "Bien que + subjunctive (soient); beaucoup d'entre eux takes a plural verb (se sentent) and a plural adjective.", 3, { na: true, acc: ["bien que les jeunes soient très connectés, beaucoup se sentent seuls", "bien que les jeunes soient très connectés, beaucoup d'entre eux se sentent isolés", "bien que les jeunes soient très connectés, beaucoup se sentent isolés", "bien que les jeunes soient très connectés beaucoup d'entre eux se sentent seuls"] }),
          q12.short("Give the subjunctive of savoir (one word): Il est essentiel que les jeunes ____ protéger leurs données.", "sachent", "Il est essentiel que takes the subjunctive; savoir is irregular: que nous sachions, qu'ils sachent.", 3, {}),
          q12.short("Complete with en or y: Le bénévolat ? Beaucoup de jeunes ____ font le week-end.", "en", "Faire du bénévolat: en replaces du + noun, and it goes before the verb.", 2, {}),
          q12.single("Which sentence is the best translation of 'More and more young people volunteer, which shows that they care about others'?", "De plus en plus de jeunes font du bénévolat, ce qui montre qu'ils se soucient des autres.", ["De plus en plus de jeunes fait du bénévolat, ce qui montre qu'ils se soucient des autres.", "De plus en plus de jeunes font du bénévolat, ce que montre qu'ils se soucient des autres.", "De plus en plus de jeunes font du bénévolat, ce qui montre qu'il se soucient des autres."], "The verb agrees with the plural jeunes (font); ce qui refers back to the whole clause and is the subject of montre; qu'ils agrees with jeunes.", 3),
          q12.written(
            "Write 6–8 sentences in French giving your view on the following question: « Les réseaux sociaux rapprochent-ils ou éloignent-ils les familles ? » Include a statistic or trend phrase, certes … mais, bien que + subjunctive and ce qui.",
            "Certes, les réseaux sociaux permettent aux familles de rester en contact, mais ils peuvent aussi créer de la distance. De plus en plus de parents envoient des messages à leurs enfants au lieu de leur parler. Bien que les jeunes soient très connectés, beaucoup se sentent seuls, ce qui inquiète les psychologues. En revanche, les grands-parents qui habitent loin peuvent voir grandir leurs petits-enfants grâce aux appels vidéo. À mon avis, il est essentiel que chaque famille fixe des règles pour l'usage des écrans.",
            "Marking guide (/12): argument with balanced points (3); statistic or trend language used correctly (1); certes … mais (1); bien que + accurate subjunctive (2); ce qui used correctly (1); range and sophistication of vocabulary and structures (2); accuracy of agreement, verb forms and spelling (2).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["une famille monoparentale / recomposée", "a single-parent / blended family"],
        ["de plus en plus de + plural noun → verb ?", "plural: De plus en plus de jeunes … utilisent."],
        ["certes … mais", "admittedly … but"],
        ["bien que + ?", "the subjunctive"],
        ["tandis que / alors que", "whereas"],
        ["le télétravail", "working from home"],
        ["les données personnelles (f)", "personal data"],
        ["le bénévolat", "volunteering"],
        ["ce qui / ce que", "what (subject) / what (object)"],
        ["en hausse / en baisse", "rising / falling"],
      ]),
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13",
      yearsCovered: [13],
      objectives: [
        "Discuss diversity, immigration and integration in French-speaking society.",
        "Discuss marginalisation and exclusion: poverty, homelessness and discrimination.",
        "Discuss crime and punishment: prison, alternative sentences and reintegration.",
        "Discuss politics and citizenship: voting, abstention, demonstrations and strikes.",
        "Use formal structures (il s'agit de, il convient de, quant à, subjunctive after conjunctions) in extended writing.",
      ],
      note: {
        title: "Year 13: diversity, exclusion, justice and politics",
        body: `## Vocabulary

| French | English |
| --- | --- |
| l'immigration (f) / l'intégration (f) | immigration / integration |
| la diversité culturelle | cultural diversity |
| la discrimination | discrimination |
| la précarité | financial insecurity |
| la réinsertion, la récidive | reintegration, reoffending |
| une peine, un détenu | a sentence, a prisoner |
| une manifestation, une grève | a demonstration, a strike |
| l'abstention (f) | not voting |

## Formal structures

- **Il s'agit de** + noun or infinitive (impersonal only): *Il s'agit d'un problème complexe.* Never *Ce livre s'agit de …*
- **Il convient de** + infinitive = it is appropriate to: *Il convient de protéger les plus fragiles.*
- **En ce qui concerne … / Quant à …** = regarding: *Quant aux syndicats, ils refusent tout compromis.* (quant à + les → quant **aux**)
- Subjunctive after **à condition que, pourvu que, sans que, afin que, jusqu'à ce que**: *Il acceptera, pourvu que tu sois là.*
- Past subjunctive after *bien que* for an earlier action: *Bien que la loi ait été votée, elle reste contestée.*
- **dont** = of which: *la réforme dont les syndicats se plaignent*.

## Common errors

- *Ce reportage s'agit de …* (use **il s'agit de**).
- *à condition que* + indicative: it needs the subjunctive.
- *quant à les jeunes*: contract to **quant aux jeunes**.
- Using the indicative after *pourvu que*: it always takes the subjunctive.`,
      },
      quiz: {
        title: "Aspects of Society: Year 13 quiz",
        questions: [
          q13.single("What does 'l'abstention' mean in politics?", "not voting in an election", ["a public demonstration", "a change of government", "the counting of votes"], "L'abstention is the act of not voting. A demonstration is une manifestation.", 1),
          q13.short("Write in French: 'a strike' (industrial action).", "une grève", "Grève is a feminine noun, so une grève.", 1, { na: true, acc: ["la grève"] }),
          q13.single("Which sentence uses 'il s'agit de' correctly?", "Dans ce reportage, il s'agit de la réinsertion des détenus.", ["Ce reportage s'agit de la réinsertion des détenus.", "Dans ce reportage, s'agit la réinsertion des détenus.", "Dans ce reportage, il s'agit que la réinsertion des détenus."], "Il s'agit de is an impersonal expression: the subject is always il, followed by de + noun.", 2, true),
          q13.short("Give the subjunctive (one word): Ils accepteront à condition que nous ____ à l'heure. (arriver)", "arrivions", "À condition que takes the subjunctive. For nous and vous the forms match the imperfect: arrivions.", 2, { diag: true }),
          q13.multi(
            "Read the text. Which THREE statements are true?\n\n« Dans certains pays européens, on préfère aujourd'hui les peines alternatives à la prison pour les délits mineurs. Un condamné peut, par exemple, effectuer des travaux d'intérêt général au lieu de passer six mois derrière les barreaux. Les partisans de cette solution affirment qu'elle réduit la récidive, car le condamné garde son emploi et ses liens familiaux. En revanche, ses détracteurs estiment qu'elle manque de fermeté et qu'elle n'assure pas assez la protection de la société. Le débat reste ouvert. »",
            ["Supporters say alternative sentences reduce reoffending.", "Critics think alternative sentences are not firm enough.", "A convicted person can keep their job under this system."],
            ["Alternative sentences are used for all crimes.", "Every European country has abolished prison."],
            "The text says the sentences are for délits mineurs, so not all crimes, and it only says that some countries prefer them.",
            3,
          ),
          q13.multi("Which sentences are correct French? Choose all that apply.", ["Il convient de respecter la diversité culturelle.", "Quant aux jeunes, ils votent de moins en moins.", "En ce qui concerne le logement, la situation reste difficile."], ["Il convient que respecter la diversité culturelle.", "Quant à les jeunes, ils votent de moins en moins."], "Il convient de is followed by an infinitive, and quant à + les becomes quant aux.", 2),
          q13.single("What does 'la précarité' mean?", "financial insecurity", ["precision", "carelessness", "a prayer"], "La précarité is an unstable, insecure situation, usually financial (jobs, housing).", 2),
          q13.short("Translate into French: 'It is important that everyone can vote.'", "il est important que tout le monde puisse voter", "Il est important que takes the subjunctive; pouvoir is irregular: que je puisse, qu'il puisse.", 3, { na: true, acc: ["il est important que chacun puisse voter", "il est important que tous puissent voter", "il est important que tout le monde puisse voter."] }),
          q13.short("Give the subjunctive (one word): Les syndicats demandent que le gouvernement ____ des concessions. (faire)", "fasse", "Demander que takes the subjunctive; faire is irregular: qu'il fasse.", 2, {}),
          q13.short("Complete with qui, que, dont or où: Le problème ____ nous parlons est très grave.", "dont", "Parler de + noun: the relative pronoun replacing 'de + noun' is dont.", 2, {}),
          q13.single("Which sentence is the best translation of 'Although the sentence was short, the prisoner did not reoffend'?", "Bien que la peine ait été courte, le détenu n'a pas récidivé.", ["Bien que la peine a été courte, le détenu n'a pas récidivé.", "Bien que la peine était courte, le détenu n'a pas récidivé.", "Bien que la peine ait été courte, le détenu ne récidivera pas."], "Bien que needs the subjunctive, and the sentence was already served, so the perfect subjunctive ait été is used.", 3),
          q13.written(
            "Write 7–9 sentences in French answering: « La prison est-elle la meilleure solution pour punir les criminels ? » Include il s'agit de or il convient de, quant à, at least one subjunctive after a conjunction, and dont.",
            "Il s'agit d'une question complexe. Certes, la prison protège la société, mais elle ne prévient pas toujours la récidive. Quant aux peines alternatives, elles permettent au condamné de garder son travail, pourvu qu'il respecte ses obligations. Il convient donc de mieux préparer la réinsertion des détenus. C'est un débat dont les résultats dépendent de la manière dont on évalue la sécurité. Bien que la prison soit nécessaire pour certains crimes, elle ne devrait pas être la seule réponse.",
            "Marking guide (/14): balanced argument and clear conclusion (3); il s'agit de / il convient de and quant à used accurately (2); subjunctive after a conjunction (2); dont used accurately (1); range of topic vocabulary (2); accuracy of agreement, verb forms and spelling (2); linking and structure (2).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["il s'agit de", "it is about / it is a question of (impersonal)"],
        ["il convient de + infinitive", "it is appropriate to …"],
        ["quant à / quant aux", "as for, regarding"],
        ["pourvu que / à condition que", "provided that (+ subjunctive)"],
        ["la précarité", "financial insecurity"],
        ["la réinsertion / la récidive", "reintegration / reoffending"],
        ["une manifestation / une grève", "a demonstration / a strike"],
        ["l'abstention (f)", "not voting"],
        ["Bien que la loi ait été votée, …", "Although the law was passed, … (past subjunctive)"],
        ["la diversité culturelle", "cultural diversity"],
      ]),
    },
  },
};
