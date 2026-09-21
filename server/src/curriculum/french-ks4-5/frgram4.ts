// French — Grammar: Advanced Verbs & Structures (GCSE, Years 10 and 11). Original content aligned to the DfE GCSE modern foreign languages subject content (OGL v3.0).
// Conjugation rows in the notes ("| aller (present) | vais, vas, … |") and gap-fill answers are verified by _check_l2.ts.
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q10 = qb("frgram4", 10);
const q11 = qb("frgram4", 11);

export const TOPIC: CTopic = {
  key: "frgram4",
  topic: "Grammar — Advanced Verbs & Structures",
  subject: "French",
  years: {
    10: {
      year: 10,
      subtopic: "GCSE Year 10",
      yearsCovered: [10],
      objectives: [
        "Form and use the present, perfect, imperfect, future and conditional tenses, including common irregular verbs.",
        "Use reflexive verbs in the present and the perfect tense, with correct agreement.",
        "Use the pronouns y and en and place them correctly before the verb.",
        "Use negatives (ne … pas, jamais, rien, plus, personne) including in the perfect tense.",
        "Recognise and correct common errors with auxiliaries, agreement and verb endings.",
      ],
      note: {
        title: "Year 10: the five core tenses, irregular verbs, pronouns and negatives",
        body: `## The tenses at a glance

| Tense | How to form it |
| --- | --- |
| perfect | avoir (or être) + past participle |
| imperfect | *nous* stem + -ais, -ais, -ait, -ions, -iez, -aient |
| future | infinitive (drop the -e of -re verbs) + -ai, -as, -a, -ons, -ez, -ont |
| conditional | future stem + imperfect endings |

Use **être** in the perfect for *aller, venir, arriver, partir, sortir, rentrer, naître, mourir* and **all reflexive verbs**. The participle agrees with the subject: *elle est arrivée*, *ils se sont couchés*.

## Irregular forms to learn

| Verb | je, tu, il/elle/on, nous, vous, ils/elles |
| --- | --- |
| aller (present) | vais, vas, va, allons, allez, vont |
| faire (present) | fais, fais, fait, faisons, faites, font |
| pouvoir (present) | peux, peux, peut, pouvons, pouvez, peuvent |
| vouloir (present) | veux, veux, veut, voulons, voulez, veulent |
| être (imperfect) | étais, étais, était, étions, étiez, étaient |
| aller (future) | irai, iras, ira, irons, irez, iront |
| faire (conditional) | ferais, ferais, ferait, ferions, feriez, feraient |

Other irregular future stems: avoir → **aur-**, être → **ser-**, pouvoir → **pourr-**, voir → **verr-**, venir → **viendr-**.

## Pronouns and negatives

- **y** replaces à + place: *Tu vas au marché ? — Oui, j'y vais.* **en** replaces de + noun or a quantity: *Il en a mangé trois.* Both go before the verb (before the auxiliary in the perfect: *elle y est restée*).
- Negatives wrap the verb: *ne … pas / jamais / rien / plus*. In the perfect they wrap the auxiliary (*je n'ai rien acheté*), but **personne** follows the participle: *je n'ai vu personne*.

## Model sentences

- **Hier, ma mère est rentrée tard et nous nous sommes couchés à minuit.**
- **Quand j'étais petit, je jouais au foot tous les jours.**

## Common errors

*j'ai allé* (say **je suis allé**), no agreement after être, and *je ne vois pas personne*.`,
      },
      quiz: {
        title: "Grammar — Advanced Verbs & Structures: Year 10 quiz",
        questions: [
          q10.single("Which is the correct present tense form? « Ils ____ leurs devoirs après le dîner. » (faire)", "font", ["fait", "faites", "faisent"], "Faire is irregular: ils font. Vous faites is the vous form, and 'faisent' does not exist.", 1),
          q10.short("Give the correct present tense form of pouvoir: « Vous ____ venir demain ? »", "pouvez", "The vous form of pouvoir is pouvez (peux, peux, peut, pouvons, pouvez, peuvent).", 1, { diag: false }),
          q10.single("Complete the sentence: « Marie ____ hier soir. » (partir)", "est partie", ["a parti", "est parti", "a partie"], "Partir takes être in the perfect, and the participle agrees with the feminine subject Marie: est partie.", 2, true),
          q10.short("Give the correct imperfect form (one word): « Quand j'étais enfant, nous ____ à Marseille. » (habiter)", "habitions", "Nous form of the present is habitons; drop -ons and add -ions for the imperfect: habitions.", 2, {}),
          q10.single("Which future form completes the sentence? « Demain, il ____ beau. » (faire)", "fera", ["fait", "faira", "ferait"], "Faire has the irregular future stem fer-; the future ending for il is -a. Ferait is conditional.", 2),
          q10.multi("Which sentences are correct French? Choose all that apply.", ["Elle s'est levée à sept heures.", "Je n'ai jamais visité l'Écosse.", "Ils ne sont pas venus."], ["Elle a allé au cinéma.", "Je n'ai personne vu."], "Aller needs être in the perfect, and personne comes after the past participle: je n'ai vu personne.", 2),
          q10.single(
            "Read the text. Why couldn't the writer's cousin talk on the phone?\n\n« Hier, je me suis réveillé tard parce que j'étais fatigué. Il pleuvait, alors je suis resté à la maison. J'ai téléphoné à ma cousine, mais elle n'était pas disponible : elle devait aider sa mère. L'après-midi, je suis allé au parc avec mon chien, même s'il pleuvait encore un peu. Je n'y suis pas resté longtemps ! Demain, j'irai au cinéma avec des amis. »",
            "She had to help her mother.",
            ["She was asleep.", "She was at the cinema.", "Her phone was broken."],
            "Elle n'était pas disponible : elle devait aider sa mère. Devait is the imperfect of devoir.",
            2, true,
          ),
          q10.single("Which is the correct reply? « Tu as des frères ? »", "Oui, j'en ai deux.", ["Oui, j'y ai deux.", "Oui, je les ai deux.", "Oui, j'ai en deux."], "En replaces des + noun and goes before the verb; the number stays after the verb: j'en ai deux.", 2),
          q10.short("Translate into French: 'I never go to the swimming pool on Sundays.'", "je ne vais jamais à la piscine le dimanche", "Aller (je vais) in the present; ne … jamais wraps the verb; le dimanche means 'on Sundays'.", 3, { na: true, acc: ["je ne vais jamais à la piscine les dimanches", "le dimanche, je ne vais jamais à la piscine"] }),
          q10.short("Complete with the conditional of avoir (one word): « Avec plus d'argent, nous ____ une plus grande maison. »", "aurions", "Conditional = future stem aur- + imperfect ending -ions: nous aurions.", 3, {}),
          q10.single("Which sentence means 'I went there last year'?", "J'y suis allé l'année dernière.", ["Je suis y allé l'année dernière.", "J'ai y allé l'année dernière.", "Je y suis allé l'année dernière."], "The pronoun y goes before the auxiliary, and aller takes être in the perfect: j'y suis allé.", 3),
          q10.written(
            "Write 5–6 sentences in French about last weekend and next weekend. Use at least one perfect tense verb with être, one reflexive verb in the perfect, one imperfect verb, one future verb and one negative (ne … jamais / rien / plus).",
            "Samedi dernier, je suis allée au cinéma avec ma cousine. Nous nous sommes bien amusées, mais le film était un peu long. Je n'ai rien mangé parce que je n'avais pas faim. Le week-end prochain, j'irai chez mes grands-parents et nous ferons une promenade. Je ne joue plus au tennis le dimanche, donc j'aurai du temps libre.",
            "Marking guide (10): perfect tense with être and agreement (2); reflexive verb in the perfect with agreement (2); imperfect used for a description (1); irregular future form (2); a correctly placed negative (1); accuracy of endings, spelling and gender (2).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["Future of faire, je …", "je ferai"],
        ["Conditional of aller, j'…", "j'irais"],
        ["ils font / ils vont", "they do / they go (irregular present)"],
        ["How to form the imperfect", "nous stem + -ais, -ais, -ait, -ions, -iez, -aient"],
        ["Which verbs take être in the perfect?", "aller, venir, arriver, partir, sortir, rentrer, naître, mourir… and all reflexives"],
        ["Elle s'est couchée tôt.", "She went to bed early. (participle agrees with the subject)"],
        ["Oui, j'y vais.", "Yes, I'm going there. (y replaces à + place)"],
        ["Il en a mangé trois.", "He ate three of them. (en replaces de + noun)"],
        ["Je n'ai vu personne.", "I saw nobody. (personne follows the participle)"],
        ["Future stems: avoir / être / pouvoir / venir", "aur- / ser- / pourr- / viendr-"],
      ]),
    },
    11: {
      year: 11,
      subtopic: "GCSE Year 11",
      yearsCovered: [11],
      objectives: [
        "Recognise and use the present subjunctive after il faut que, and after common triggers such as pour que and bien que.",
        "Form and use the pluperfect tense.",
        "Recognise and use the passive voice with être + past participle.",
        "Use si-clauses: si + present + future, and si + imperfect + conditional.",
        "Use the relative pronouns qui, que and dont.",
      ],
      note: {
        title: "Year 11: subjunctive, pluperfect, passive, si-clauses and relative pronouns",
        body: `## Present subjunctive (introduction)

Take the *ils/elles* present stem and add **-e, -es, -e, -ions, -iez, -ent**. It follows *il faut que*, *pour que*, *avant que*, *bien que* and *vouloir que*: **Il faut que tu finisses ton travail.**

| Verb | que je, que tu, qu'il/elle/on, que nous, que vous, qu'ils/elles |
| --- | --- |
| finir (subjunctive) | finisse, finisses, finisse, finissions, finissiez, finissent |
| être (subjunctive) | sois, sois, soit, soyons, soyez, soient |
| avoir (subjunctive) | aie, aies, ait, ayons, ayez, aient |
| aller (subjunctive) | aille, ailles, aille, allions, alliez, aillent |
| faire (subjunctive) | fasse, fasses, fasse, fassions, fassiez, fassent |

## Other structures

- **Pluperfect** = imperfect of avoir / être + past participle (what had already happened): *Nous étions partis avant la fin du match.*
- **Passive** = être + past participle, agreeing with the subject: *Ce pont a été construit en 1890.* The agent follows **par**.
- **Si-clauses**: si + present → future (*Si tu réussis, tes parents seront fiers.*); si + imperfect → conditional (*Si j'étais plus grand, je jouerais au basket.*). Never use the conditional straight after *si*.
- **Relative pronouns**: **qui** = subject (*La chanson qui passe à la radio*), **que** = object (*La chanson que j'écoute*), **dont** = of which / whose (*C'est l'auteur dont je t'ai parlé*).

## Common errors

Using the indicative after *il faut que* (*il faut que tu finis*), writing *si j'aurais*, and using *que* when the verb needs de (*dont*).`,
      },
      quiz: {
        title: "Grammar — Advanced Verbs & Structures: Year 11 quiz",
        questions: [
          q11.single("Which form completes the sentence? « Il faut que tu ____ à l'heure. » (arriver)", "arrives", ["arrivais", "arriveras", "arriver"], "After il faut que we need the subjunctive. For -er verbs the tu form looks like the present: arrives.", 1),
          q11.short("Complete with a relative pronoun: « C'est la voisine ____ habite au troisième étage. »", "qui", "The pronoun is the subject of habite, so we use qui.", 1, {}),
          q11.short("Give the subjunctive of être (one word): « Il faut que nous ____ à l'heure. »", "soyons", "The subjunctive of être is irregular: que nous soyons.", 2, { diag: true }),
          q11.single("Which verb form completes the sentence? « Si j'avais plus de temps, je ____ du sport. » (faire)", "ferais", ["ferai", "fais", "faisais"], "Si + imperfect is followed by the conditional: je ferais. Ferai is future.", 2, true),
          q11.single("What does 'La cathédrale a été construite au douzième siècle' mean?", "The cathedral was built in the twelfth century.", ["The cathedral built twelve houses.", "The cathedral is being restored this century.", "The cathedral will be built next century."], "A été construite is the passive perfect: 'was built'. Douzième is twelfth.", 2),
          q11.short("Give the pluperfect (two words): « Quand je suis arrivé, le film ____ déjà ____. » (commencer)", "avait commencé", "The pluperfect = imperfect of avoir (avait) + past participle (commencé).", 2, { acc: ["avait commencé"] }),
          q11.multi("Which sentences are correct French? Choose all that apply.", ["Si tu viens, nous irons au cinéma.", "Le livre que j'ai lu était passionnant.", "Bien qu'il soit fatigué, il continue."], ["Si je serais riche, j'achèterais une maison.", "Il faut que tu fais tes devoirs."], "Never use the conditional after si, and il faut que needs the subjunctive: que tu fasses.", 2),
          q11.single(
            "Read the text. What happened to the roof of the farm?\n\n« Ma grand-mère m'a raconté l'histoire de la maison où elle avait grandi. C'était une ferme dont le toit avait été détruit par une tempête en 1987. Avant que les voisins arrivent, elle avait déjà réussi à sauver les animaux. Elle dit que c'est un souvenir qu'elle n'oubliera jamais. Aujourd'hui, la ferme est un petit musée que les touristes visitent en été. »",
            "A storm had destroyed it.",
            ["The neighbours had repaired it.", "The tourists had painted it.", "It had been turned into a museum."],
            "Dont le toit avait été détruit par une tempête: pluperfect passive, 'had been destroyed by a storm'.",
            3,
          ),
          q11.short("Translate into French: 'The film that I saw yesterday was excellent.'", "le film que j'ai vu hier était excellent", "The film is the object of j'ai vu, so we use que (qu' before a vowel); the past participle agrees with the preceding object, but film is masculine singular, so vu does not change.", 2, { na: true, acc: ["le film que j'ai vu hier soir était excellent", "le film que j'ai vu hier a été excellent", "le film que j'ai vu hier était super", "le film que j'ai vu hier était génial"] }),
          q11.short("Rewrite in the passive: « Ma tante a écrit cette lettre. »", "Cette lettre a été écrite par ma tante.", "The object becomes the subject: a été écrite (feminine, agreeing with lettre) + par + the agent.", 3, { na: true, acc: ["cette lettre a été écrite par ma tante"] }),
          q11.single("Complete with the correct relative pronoun: « Le garçon ____ le père est médecin est mon ami. »", "dont", ["qui", "que", "où"], "Dont means 'whose' or 'of whom': the boy whose father is a doctor.", 3),
          q11.written(
            "Write 5–6 sentences in French about a school project or a trip. Use at least: one subjunctive after il faut que or pour que, one si-clause, one relative pronoun (qui, que or dont) and one pluperfect or passive verb.",
            "Pour que notre voyage réussisse, il faut que chacun fasse un effort. Si nous avons assez d'argent, nous irons à Rome en mai. C'est un endroit dont tout le monde parle. Notre professeur, qui adore l'histoire, avait déjà organisé une visite du Colisée. Le programme a été préparé par la classe entière.",
            "Marking guide (12): correct subjunctive form and trigger (3); a correct si-clause with matching tenses (3); relative pronoun chosen correctly (2); pluperfect or passive formed and agreed correctly (2); accuracy of spelling and agreement (2).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["Il faut que + ?", "the subjunctive: Il faut que tu sois là."],
        ["Subjunctive endings", "-e, -es, -e, -ions, -iez, -ent"],
        ["que je fasse / que j'aille", "subjunctive of faire / aller"],
        ["Pluperfect = ?", "imperfect of avoir / être + past participle"],
        ["Passive = ?", "être + past participle (agrees with the subject) + par + agent"],
        ["si + present → ?", "future: Si tu viens, on ira."],
        ["si + imperfect → ?", "conditional: Si j'avais le temps, je voyagerais."],
        ["qui / que / dont", "subject / object / 'of which, whose'"],
        ["Bien que + ?", "the subjunctive: bien qu'il soit fatigué"],
        ["Ce pont a été construit en 1890.", "This bridge was built in 1890."],
      ]),
    },
  },
};
