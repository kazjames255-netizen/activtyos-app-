// French — Grammar: Verbs & Tenses (Years 7–9). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q7 = qb("frverb", 7);
const q8 = qb("frverb", 8);
const q9 = qb("frverb", 9);

export const TOPIC: CTopic = {
  key: "frverb",
  topic: "Grammar — Verbs & Tenses",
  subject: "French",
  years: {
    7: {
      year: 7,
      objectives: [
        "Conjugate regular -er, -ir and -re verbs in the present tense.",
        "Use the present tense of être, avoir, aller and faire accurately.",
        "Choose the correct subject pronoun (including tu/vous and on) and make spelling changes such as -ger verbs.",
        "Read and write short sentences in the present tense with correct verb endings.",
      ],
      note: {
        title: "Year 7: the present tense",
        body: `## Regular verbs: remove the ending, add new endings

| | -er (écouter) | -ir (grandir) | -re (attendre) |
| --- | --- | --- | --- |
| je | écoute | grandis | attends |
| tu | écoutes | grandis | attends |
| il / elle / on | écoute | grandit | attend |
| nous | écoutons | grandissons | attendons |
| vous | écoutez | grandissez | attendez |
| ils / elles | écoutent | grandissent | attendent |

Before a vowel, **je** becomes **j'**: **j'écoute**, **j'habite**.

## Four irregular verbs you must know

| | être (to be) | avoir (to have) | aller (to go) | faire (to do/make) |
| --- | --- | --- | --- | --- |
| je | suis | ai | vais | fais |
| tu | es | as | vas | fais |
| il / elle / on | est | a | va | fait |
| nous | sommes | avons | allons | faisons |
| vous | êtes | avez | allez | faites |
| ils / elles | sont | ont | vont | font |

## Tu or vous?

**Tu** for a friend, family member or child. **Vous** for an adult you don't know, or for more than one person. **On** = "we / people" and takes the **il** form.

## Spelling changes

Verbs ending **-ger** add an **e** in the **nous** form: **nous mangeons** (to keep the soft g). **-cer** verbs take **ç**: **nous commençons**.

## Model sentences

- J'habite à Lyon et j'écoute de la musique.
- Elle attend le bus. Nous grandissons vite !
- On va au parc et on fait du vélo.

## Sound tips

The endings **-e, -es and -ent** are silent, so *il parle*, *tu parles* and *ils parlent* all sound the same. The **-ons** in *nous* forms sounds like "on" through your nose.

## Common mistakes

- Adding the **-s** to **il/elle** (*elle parles*).
- Using the wrong -ir ending: **-ir verbs** add **-iss-** in the plural (*nous grandissons*).
- Saying *vous faisez* instead of **vous faites**.`,
      },
      quiz: {
        title: "Grammar — Verbs & Tenses: Year 7 quiz",
        questions: [
          q7.single("Choose the right form of être: 'Nous ___ contents.'", "sommes", ["êtes", "sont", "suis"], "The nous form of être is nous sommes.", 1),
          q7.single("Choose the right form of avoir: 'Tu ___ un chien.'", "as", ["a", "ai", "avons"], "The tu form of avoir is tu as.", 1),
          q7.single("What is the 'je' form of the verb parler?", "je parle", ["je parles", "je parlons", "je parlent"], "For je with an -er verb, drop -er and add -e: je parle.", 1),
          q7.single("Choose the right form of aller: 'Elle ___ au cinéma.'", "va", ["vas", "vont", "allons"], "The il/elle/on form of aller is va.", 2, true),
          q7.single("What is the 'nous' form of the verb finir?", "nous finissons", ["nous finons", "nous finit", "nous finissez"], "-ir verbs add -iss- in the plural: nous finissons.", 2),
          q7.single("Choose the right form of faire: 'Ils ___ leurs devoirs.'", "font", ["faisent", "faites", "fait"], "The ils/elles form of faire is font.", 2),
          q7.short("Complete with the right form of jouer: 'Vous ____ au basket.'", "jouez", "The vous form of an -er verb ends in -ez.", 2, { diag: true }),
          q7.short("Write the 'nous' form of the verb manger.", "nous mangeons", "Add an e before -ons so the g stays soft: nous mangeons.", 3, { acc: ["mangeons"] }),
          q7.multi("Which sentences are correct? Choose all that apply.", ["Il vend sa bicyclette.", "Ils choisissent un film.", "Vous faites du sport."], ["Elle finis ses devoirs.", "Ils est contents."], "Il/elle takes no -s (vend, finit); vous faites is irregular; ils takes sont, not est.", 2),
          q7.written("Write five short sentences in French using the present tense: one with être, one with avoir, one with aller, one with faire and one with a regular -er verb.", "Je suis content. J'ai un chien. Nous allons au parc. Elle fait du sport. Ils jouent au foot.", "Mark scheme (5 marks): 1 mark for each sentence that uses the required verb in a correct present-tense form for its subject. Accept any sensible content; deduct nothing for spelling of nouns.", 3),
        ],
      },
      flashcards: cards([
        ["je / tu / il (être)", "suis / es / est"],
        ["nous avons", "we have"],
        ["they go (ils …)", "ils vont"],
        ["vous faites", "you do / make"],
        ["-er verbs: je … (ending)", "-e (je parle)"],
        ["-ir verbs: nous … (ending)", "-issons (nous finissons)"],
        ["elle attend", "she waits"],
        ["we eat (manger)", "nous mangeons"],
        ["on", "we / people (uses the il form)"],
        ["tu vs vous", "tu = friend/child; vous = adult stranger or more than one person"],
      ]),
    },
    8: {
      year: 8,
      objectives: [
        "Form and use the near future (aller + infinitive) to talk about plans.",
        "Form the perfect tense (passé composé) with avoir, including regular and common irregular past participles.",
        "Use être as the auxiliary with verbs of movement and make the past participle agree with the subject.",
        "Make the perfect tense negative and use time expressions (hier, la semaine dernière, demain).",
      ],
      note: {
        title: "Year 8: talking about the future and the past",
        body: `## Near future: aller + infinitive

Use the present of **aller** followed by an infinitive: **Je vais visiter le musée.** **Nous allons regarder un film.** Time words: demain (tomorrow), la semaine prochaine (next week).

## Perfect tense (passé composé)

Present of **avoir** (or **être**) + **past participle**.

| Infinitive | Past participle | Example |
| --- | --- | --- |
| -er → **-é** | regarder → regardé | J'ai regardé la télé. |
| -ir → **-i** | choisir → choisi | Tu as choisi un livre. |
| -re → **-u** | attendre → attendu | Il a attendu le bus. |
| irregular | faire → **fait**, avoir → **eu**, être → **été**, prendre → **pris**, voir → **vu**, boire → **bu**, lire → **lu** | Nous avons pris le train. |

## Verbs that use être

Movement verbs such as **aller, venir, arriver, partir, sortir, entrer, rentrer, rester, tomber** use **être**, and the past participle **agrees** with the subject: **Elle est partie. Ils sont arrivés. Elles sont restées.**

## Negative and time words

Put **ne … pas** round the auxiliary: **Je n'ai pas fini.** Time words: hier (yesterday), la semaine dernière (last week), hier soir (last night).

## Model sentences

- Hier soir, j'ai lu un livre et j'ai bu du thé.
- Ma sœur est sortie, mais je suis resté à la maison.
- Demain, nous allons prendre le bus.

## Sound tips

*Regardé* sounds like "ruh-gar-DAY"; *fini* like "fee-NEE"; *pris* like "pree"; the -s in *pris* is silent.

## Common mistakes

- Saying *j'ai allé*: aller uses **être**, so **je suis allé(e)**.
- Forgetting to agree with être: **elle est partie**, not *elle est parti*.
- Writing the infinitive after avoir (*j'ai manger*): it must be **j'ai mangé**.`,
      },
      quiz: {
        title: "Grammar — Verbs & Tenses: Year 8 quiz",
        questions: [
          q8.single("Complete the near future: 'Demain, je ___ jouer au foot.'", "vais", ["suis", "ai", "fais"], "Near future = present of aller + infinitive: je vais jouer.", 1),
          q8.single("What does 'Nous allons manger' mean?", "We are going to eat", ["We ate", "We would eat", "We must eat"], "Aller + infinitive talks about the near future: we are going to eat.", 1),
          q8.single("What is the past participle of 'jouer'?", "joué", ["jouer", "jouez", "jouons"], "-er verbs form the past participle by changing -er to -é.", 1),
          q8.single("Choose the right word: 'Hier, j'___ mangé une pizza.'", "ai", ["suis", "as", "a"], "Manger takes avoir. With je the form is j'ai.", 2, true),
          q8.single("What is the past participle of 'finir'?", "fini", ["finit", "finu", "finé"], "-ir verbs form the past participle by dropping the r: fini.", 2),
          q8.single("Choose the right word: 'Elle ___ arrivée à midi.'", "est", ["a", "as", "sont"], "Arriver is a movement verb, so it uses être, with agreement: elle est arrivée.", 2),
          q8.short("Write the past participle of 'vendre'.", "vendu", "-re verbs change to -u: vendu.", 2, { diag: true }),
          q8.short("Write in French: 'We watched a film.'", "nous avons regardé un film", "Perfect tense: avoir (nous avons) + regardé. Sentences with on a regardé are also fine.", 2, { acc: ["on a regardé un film"] }),
          q8.multi("Which sentences are correct? Choose all that apply.", ["Elles sont parties hier.", "J'ai fait mes devoirs.", "Il n'a pas mangé."], ["J'ai allé au parc.", "Elle est mangé."], "Aller and partir use être and agree; faire uses avoir (fait); negatives go round the auxiliary.", 3),
          q8.written("Write four sentences in French: three about what you did last weekend (perfect tense, at least one with être) and one about what you are going to do next weekend (near future).", "Samedi, j'ai joué au foot. Dimanche, je suis allé au cinéma. J'ai vu un film drôle. Le week-end prochain, je vais visiter mes grands-parents.", "Mark scheme (5 marks): 1 mark per correct perfect-tense sentence with avoir or être (up to 3, including correct auxiliary and participle), 1 mark for a correct near future, 1 mark for correct agreement or negation if attempted. Accept small spelling errors.", 3),
        ],
      },
      flashcards: cards([
        ["je vais + infinitive", "I am going to …"],
        ["yesterday", "hier"],
        ["la semaine prochaine", "next week"],
        ["mangé / fini / vendu", "past participles of manger / finir / vendre"],
        ["faire → past participle", "fait"],
        ["prendre → past participle", "pris"],
        ["boire → past participle", "bu"],
        ["Which auxiliary for aller?", "être: je suis allé(e)"],
        ["Elle est partie.", "She left. (partie agrees with elle)"],
        ["I haven't finished.", "Je n'ai pas fini."],
      ]),
    },
    9: {
      year: 9,
      objectives: [
        "Form and use the imperfect tense for habits, descriptions and 'used to' in the past.",
        "Choose between the perfect and imperfect tenses (event versus background).",
        "Recognise and use the conditional for wishes and polite requests (j'aimerais, je voudrais, je jouerais).",
        "Read and write sentences that combine present, past and conditional forms.",
      ],
      note: {
        title: "Year 9: the imperfect tense and an introduction to the conditional",
        body: `## The imperfect tense (l'imparfait)

Use it for **habits in the past** ("I used to …"), **descriptions** ("it was …") and **background** actions.

**Formation:** take the **nous** form of the present tense, remove **-ons**, add **-ais, -ais, -ait, -ions, -iez, -aient**.

| | finir (nous finissons → finiss-) | faire (nous faisons → fais-) | être (irregular stem ét-) |
| --- | --- | --- | --- |
| je | finissais | faisais | étais |
| tu | finissais | faisais | étais |
| il / elle / on | finissait | faisait | était |
| nous | finissions | faisions | étions |
| vous | finissiez | faisiez | étiez |
| ils / elles | finissaient | faisaient | étaient |

Perfect vs imperfect: **Il faisait nuit quand nous sommes arrivés.** The imperfect gives the background; the perfect gives the event.

## The conditional (le conditionnel): would

Formed with the **infinitive** + **-ais, -ais, -ait, -ions, -iez, -aient**: **je visiterais** (I would visit), **nous mangerions** (we would eat). Important irregular stems: **être → ser-**, **avoir → aur-**, **aller → ir-**, **faire → fer-**. Useful chunks: **j'aimerais** (I would like), **je voudrais**, **on pourrait** (we could), **il faudrait** (it would be necessary).

## Model sentences

- Quand j'avais huit ans, j'habitais à Marseille.
- Chaque été, nous allions à la plage.
- Si j'avais du temps, j'irais en Italie.

## Sound tips

The endings **-ais, -ait, -aient** all sound the same ("eh"), so spelling is what you must learn. *Étais* sounds like "ay-TEH".

## Common mistakes

- Using the perfect tense for habits: for "we used to go" say **nous allions**, not *nous sommes allés*.
- Forgetting spelling changes: **je mangeais** (keep the e) and **je commençais** (keep the ç).
- Mixing up the future (**-erai**) and conditional (**-erais**).`,
      },
      quiz: {
        title: "Grammar — Verbs & Tenses: Year 9 quiz",
        questions: [
          q9.single("Choose the right form: 'Quand j'étais petit, je ___ au foot.' (I used to play)", "jouais", ["joue", "jouerai", "ai joué"], "The imperfect for je is stem + -ais: jouais.", 2),
          q9.single("What does 'il était' mean?", "he was", ["he is", "he will be", "he has been"], "Était is the imperfect of être: he was.", 1),
          q9.single("What does 'j'aimerais' mean?", "I would like", ["I like", "I liked", "I will like"], "The conditional ending -erais means 'would'.", 1),
          q9.single("Choose the right form: 'Nous ___ à Paris quand j'avais dix ans.' (habiter)", "habitions", ["habitons", "habitaient", "habitiez"], "Imperfect nous: stem habit- + -ions.", 2, true),
          q9.single("Which sentence describes something that used to happen regularly in the past?", "Le samedi, je jouais au foot.", ["Samedi dernier, j'ai joué au foot.", "Samedi prochain, je vais jouer au foot.", "Je joue au foot le samedi."], "The imperfect (jouais) is for habits in the past; the perfect is for one event.", 2),
          q9.single("In 'Il pleuvait quand je suis sorti', which verb gives the background situation?", "pleuvait", ["suis sorti", "quand", "je"], "Imperfect (pleuvait) = background; perfect (suis sorti) = the event.", 2),
          q9.short("Write the imperfect 'nous' form of avoir.", "nous avions", "Take nous avons, drop -ons: av-, and add -ions.", 2, { diag: true, acc: ["avions"] }),
          q9.short("Write 'I would play' in French.", "je jouerais", "Conditional = infinitive + imperfect endings: jouer + -ais.", 3, { na: true, acc: ["jouerais"] }),
          q9.multi("Which sentences are correct? Choose all that apply.", ["Nous étions fatigués.", "Elle habitait à Nice.", "Je mangerais une pizza."], ["Vous étions contents.", "Ils habitais à Nice."], "Étions goes with nous, habitait with elle and mangerais with je; vous is étiez and ils is habitaient.", 3),
          q9.written("Write four sentences in French: two about what you used to do when you were younger (imperfect) and two about what you would do if you had lots of money (conditional).", "Quand j'avais sept ans, je jouais dans le jardin. Le soir, je regardais la télé. Si j'avais beaucoup d'argent, j'achèterais un chien. Je voyagerais en Asie.", "Mark scheme (5 marks): 1 mark each for two correct imperfect forms with sensible content, 1 mark each for two correct conditional forms, and 1 mark for accurate spelling and verb endings overall.", 3),
        ],
      },
      flashcards: cards([
        ["imperfect endings", "-ais, -ais, -ait, -ions, -iez, -aient"],
        ["j'étais", "I was / I used to be"],
        ["nous faisions", "we used to do / we were doing"],
        ["they used to play", "ils jouaient"],
        ["conditional ending for je", "-ais (added to the infinitive): je jouerais"],
        ["je voudrais", "I would like"],
        ["on pourrait", "we could"],
        ["il faudrait", "it would be necessary / we should"],
        ["conditional stem of aller", "ir- (j'irais)"],
        ["Perfect or imperfect for background?", "imperfect (il pleuvait)"],
      ]),
    },
  },
};
