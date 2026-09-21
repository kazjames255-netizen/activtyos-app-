// French — Grammar & Structures (A-level, Years 12 and 13). Original content aligned to the DfE GCE modern foreign languages subject content (OGL v3.0).
// Conjugation rows in the notes and gap-fill answers are verified by _check_l2.ts.
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q12 = qb("frgram5", 12);
const q13 = qb("frgram5", 13);

export const TOPIC: CTopic = {
  key: "frgram5",
  topic: "Grammar & Structures",
  subject: "French",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12",
      yearsCovered: [12],
      objectives: [
        "Use the subjunctive (present and perfect) after expressions of necessity, wish, emotion, doubt and after conjunctions; know when the indicative or infinitive is needed.",
        "Apply past participle agreement rules (être, avoir with a preceding direct object, reflexive verbs).",
        "Use relative and demonstrative pronouns: lequel and its forms, ce qui / ce que / ce dont.",
        "Order double object pronouns correctly.",
        "Manipulate structures in translation and in extended writing.",
      ],
      note: {
        title: "Year 12: subjunctive uses, participle agreement and advanced pronouns",
        body: `## The subjunctive: when and when not

Use it after necessity (*il faut que*), wish (*vouloir que*), emotion (*regretter que*), doubt (*douter que*, *ne pas penser que*) and conjunctions (*bien que, pour que, avant que, sans que, jusqu'à ce que*). Keep the **indicative** after certainty: *je pense que* (affirmative), *il est clair que, espérer que*. If the subject does not change, use the **infinitive**: *Je veux partir*, not *que je parte*. The **past subjunctive** = subjunctive of avoir / être + participle: *Je doute qu'il ait compris.*

| Verb | que je, tu, il, nous, vous, ils |
| --- | --- |
| pouvoir (subjunctive) | puisse, puisses, puisse, puissions, puissiez, puissent |
| savoir (subjunctive) | sache, saches, sache, sachions, sachiez, sachent |
| venir (subjunctive) | vienne, viennes, vienne, venions, veniez, viennent |
| prendre (subjunctive) | prenne, prennes, prenne, prenions, preniez, prennent |

## Past participle agreement

- **être** verbs agree with the subject: *elles sont parties*.
- **avoir** verbs agree only with a **preceding direct object**: *Les photos que j'ai prises* ; *je les ai vus*. No agreement with *en* or when the object follows.
- **Reflexives** agree if the pronoun is the direct object (*elle s'est coupée*), not if another object follows (*elle s'est coupé le doigt*) or if it is indirect (*elles se sont parlé*).

## Advanced pronouns

- **lequel, laquelle, lesquels, lesquelles** after prepositions (*auquel, duquel* merge with à / de): *le projet auquel je pense*, *la raison pour laquelle il part*.
- **ce qui / ce que / ce dont**: *Je sais ce qui s'est passé, ce que tu veux, ce dont il parle.*
- **Order of two pronouns**: me / te / nous / vous → le / la / les → lui / leur → y → en: *Elle nous les a envoyés ; il y en a.*`,
      },
      quiz: {
        title: "Grammar & Structures: Year 12 quiz",
        questions: [
          q12.single("Which conjunction is followed by the subjunctive?", "avant que", ["parce que", "pendant que", "après que"], "Avant que (before) takes the subjunctive; the other three take the indicative.", 1),
          q12.short("Complete with ce qui, ce que or ce dont: Je ne sais pas ____ tu as besoin.", "ce dont", "Avoir besoin de: the pronoun stands for 'de + thing', so ce dont.", 1, {}),
          q12.short("Give the subjunctive of savoir (one word): Je ne crois pas qu'il ____ la réponse.", "sache", "Ne pas croire que expresses doubt and takes the subjunctive; savoir → qu'il sache.", 2, { diag: true }),
          q12.single("Complete with the correct past participle: « Les lettres qu'elle a ____ sont sur la table. » (écrire)", "écrites", ["écrit", "écrite", "écrits"], "The direct object les lettres comes before the verb (que), so the participle agrees: feminine plural, écrites.", 2, true),
          q12.single("Which sentence is correct?", "Je veux partir plus tôt.", ["Je veux que je parte plus tôt.", "Je veux de partir plus tôt.", "Je veux que partir plus tôt."], "When the subject of both verbs is the same, use vouloir + infinitive, with no que and no de.", 2),
          q12.multi("Which sentences are correct French? Choose all that apply.", ["Bien qu'elle soit arrivée en retard, elle a gagné.", "Voilà ce qui m'inquiète le plus.", "Il me le donne."], ["Il le me donne.", "Je pense qu'il vienne demain."], "Pronoun order is me/te/nous/vous before le/la/les, and je pense que (affirmative) takes the indicative: il vient.", 2),
          q12.single(
            "Read the letter. Why will Malik send the next invitation a month early?\n\n« Chère Nadia, je suis désolé que tu n'aies pas pu venir à ma fête samedi dernier. Tout le monde a regretté que tu sois malade ! Ma cousine, que tu n'as jamais rencontrée, a apporté un gâteau aux poires dont tout le monde parle encore. Pour que tu ne rates pas la prochaine fête, je t'enverrai l'invitation un mois à l'avance. J'espère que tu te sentiras mieux bientôt et que nous pourrons nous voir avant que je parte en vacances. Bises, Malik »",
            "So that Nadia does not miss the next party.",
            ["Because his cousin is coming from abroad.", "Because the party has been postponed.", "So that Nadia can bring a cake."],
            "Pour que tu ne rates pas la prochaine fête: pour que + subjunctive expresses purpose.",
            2,
          ),
          q12.short("Translate into French (tu, masculine): 'I regret that you did not come.'", "je regrette que tu ne sois pas venu", "Regretter que takes the subjunctive, and for an earlier action the perfect subjunctive: sois venu (venir takes être, so the participle agrees).", 3, { na: true, acc: ["je regrette que tu ne sois pas venu."] }),
          q12.single("Complete with the correct pronoun: « C'est le projet ____ je travaille depuis un an. »", "sur lequel", ["duquel", "dont", "que"], "Travailler sur takes a preposition, so we need a preposition + lequel: sur lequel. Dont replaces de + noun.", 3),
          q12.short("Complete with two pronouns: Tu donnes les clés à Paul ? — Oui, je ____ donne.", "les lui", "Double pronouns: le / la / les come before lui / leur: je les lui donne.", 2, {}),
          q12.single("Which sentence has the correct participle agreement?", "Elle s'est lavé les mains.", ["Elle s'est lavée les mains.", "Elle s'est lavés les mains.", "Elle est lavé les mains."], "Les mains is the direct object and comes after the verb, so se is indirect and the participle does not agree.", 3),
          q12.written(
            "Write 6–8 sentences in French about a school trip or event that you regret missing or that went badly. Include one subjunctive after an emotion or doubt, one pour que / avant que / bien que + subjunctive, one past participle agreeing with a preceding direct object, and one relative pronoun with a preposition (lequel / dont).",
            "Je regrette que nous n'ayons pas pu visiter le musée, car c'était le but principal du voyage. Bien que le guide soit arrivé en retard, il a fait une visite passionnante. Les photos que j'ai prises sont assez floues, mais mes amis les ont aimées. Nous avons quitté la ville avant que la nuit tombe. Le projet auquel notre professeur tenait le plus n'a finalement pas pu être réalisé. Il faut que l'année prochaine nous organisions mieux la journée.",
            "Marking guide (/14): correct subjunctive after emotion or doubt (2); conjunction + subjunctive (2); participle agreement (2); relative pronoun with preposition (2); coherent, relevant account (2); range of vocabulary (2); accuracy of spelling and verb forms (2).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["Je veux partir. Why no 'que je parte'?", "Same subject: use an infinitive after vouloir."],
        ["que je puisse / que je sache", "subjunctive of pouvoir / savoir"],
        ["que je vienne / que je prenne", "subjunctive of venir / prendre"],
        ["Past subjunctive = ?", "subjunctive of avoir / être + past participle"],
        ["Les photos que j'ai prises", "participle agrees with the preceding direct object (photos)"],
        ["Elle s'est coupé le doigt.", "No agreement: le doigt is the direct object, after the verb."],
        ["ce dont j'ai besoin", "what I need (avoir besoin de)"],
        ["auquel / duquel", "à + lequel / de + lequel (masculine singular)"],
        ["Order of double pronouns", "me/te/nous/vous → le/la/les → lui/leur → y → en"],
        ["Je pense que + ?", "the indicative when affirmative"],
      ]),
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13",
      yearsCovered: [13],
      objectives: [
        "Recognise and understand the passé simple in literary texts.",
        "Use concordance des temps: si-clauses with the pluperfect and past conditional, the future perfect and the sequence of tenses in reported speech.",
        "Use the perfect subjunctive after emotion and doubt.",
        "Rewrite literary narrative in the perfect tense and vice versa.",
        "Manipulate advanced structures accurately in translation and extended writing.",
      ],
      note: {
        title: "Year 13: passé simple, concordance des temps and complex sentences",
        body: `## The passé simple (recognition)

The **passé simple** narrates completed past events in literature and formal writing; it replaces the perfect. The imperfect still gives the background: *Il pleuvait quand elle arriva.* You must recognise it, especially the third person.

| Verb | je, tu, il/elle, nous, vous, ils/elles |
| --- | --- |
| parler (passé simple) | parlai, parlas, parla, parlâmes, parlâtes, parlèrent |
| finir (passé simple) | finis, finis, finit, finîmes, finîtes, finirent |
| être (passé simple) | fus, fus, fut, fûmes, fûtes, furent |
| avoir (passé simple) | eus, eus, eut, eûmes, eûtes, eurent |

Common irregular third persons: faire → *fit / firent*, voir → *vit / virent*, venir → *vint / vinrent*, dire → *dit / dirent*, prendre → *prit / prirent*, pouvoir → *put / purent*. All -er verbs, including aller, are regular: *il alla, ils allèrent*.

## Concordance des temps

- **si + pluperfect → past conditional**: *Si nous avions pris un taxi, nous serions arrivés à l'heure.* Never *si … aurait*.
- **Future perfect** (future of avoir / être + participle) after *quand, lorsque, dès que*: *Lorsqu'il aura reçu la lettre, il répondra.*
- **Reported speech**, main verb in the past: present → imperfect, perfect → pluperfect, future → conditional: *Elle a dit qu'elle partirait plus tard.*
- **Perfect subjunctive** for an earlier action: *Je doute qu'il ait compris.*

## Common errors

Reading *il fit* as an imperfect, using the conditional after *si*, and forgetting that **venir, aller, partir** take **être** in compound tenses.`,
      },
      quiz: {
        title: "Grammar & Structures: Year 13 quiz",
        questions: [
          q13.single("What does 'Elle fut très surprise' mean?", "She was very surprised.", ["She will be very surprised.", "She would be very surprised.", "She is very surprised."], "Fut is the passé simple of être, a literary past tense: 'was'.", 1),
          q13.single("Which tense is 'ils parlèrent'?", "passé simple", ["imparfait", "conditional", "subjunctive"], "The ending -èrent is the third person plural passé simple of -er verbs.", 1),
          q13.single("Complete: « Si j'avais su la vérité, je ____ venu plus tôt. »", "serais", ["suis", "aurais", "étais"], "Si + pluperfect is followed by the past conditional: je serais venu (venir takes être).", 2, true),
          q13.short("Give the passé simple (one word): Ils ____ à la mairie. (aller)", "allèrent", "Aller is a regular -er verb in the passé simple: stem all- + -èrent.", 2, { diag: true, na: true }),
          q13.single("Complete the reported speech: « Il a dit : « Je viendrai demain. » » → Il a dit qu'il ____ le lendemain.", "viendrait", ["viendra", "vient", "viendrais"], "After a past main verb, the future becomes the conditional: il viendrait.", 2),
          q13.multi("Which sentences are correct French? Choose all that apply.", ["Quand il aura fini, il partira.", "Elle a dit qu'elle était fatiguée.", "Si elle avait su, elle serait restée."], ["Si nous aurions eu le temps, nous aurions visité le musée.", "Dès qu'elle aura fini, elle est partie."], "Never use the conditional after si, and the future perfect matches a future main verb, not a past one.", 2),
          q13.single(
            "Read the text. Why could Élise not travel that night?\n\n« Il pleuvait sur la ville quand Élise arriva à la gare. Elle posa sa valise, regarda l'horloge et comprit que le dernier train était parti depuis dix minutes. Un vieil homme, qui balayait le quai, lui sourit. « Il n'y en a plus avant demain matin, dit-il. » Élise hésita, puis elle sortit dans la rue. Elle n'avait pas de parapluie, mais elle avait une adresse dans sa poche : celle d'une amie qu'elle n'avait pas vue depuis dix ans. »",
            "The last train had already left.",
            ["Her suitcase had been lost.", "The station was closed for the night.", "She had forgotten her ticket."],
            "Comprit que le dernier train était parti depuis dix minutes: passé simple for the event, pluperfect for what had happened before.",
            2,
          ),
          q13.short("Rewrite in the perfect tense: « Il fit ses valises et partit. »", "Il a fait ses valises et il est parti.", "Passé simple fit → perfect a fait; partit → est parti (partir takes être).", 3, { acc: ["Il a fait ses valises et est parti.", "il a fait ses valises et il est parti", "il a fait ses valises et est parti", "Il a fait ses valises et il est parti"] }),
          q13.short("Give the future perfect (two words): Quand j'____ mes devoirs, je sortirai. (finir)", "aurai fini", "Future perfect = future of avoir (aurai) + past participle (fini).", 2, { acc: ["aurai fini"] }),
          q13.single("Which infinitive does 'ils virent' come from?", "voir", ["venir", "vivre", "vouloir"], "Voir: il vit, ils virent. Venir gives il vint, ils vinrent.", 3),
          q13.single("Complete with the correct form: « Elle regrette que son frère ____ arrivé trop tard. »", "soit", ["est", "serait", "fût"], "Regretter que takes the subjunctive, and for an earlier action the perfect subjunctive: soit arrivé.", 3),
          q13.written(
            "Write a short passage (6–8 sentences) in French in the style of a novel, using the passé simple for the main events and the imperfect for the background. Finish with one sentence that contains a si-clause with the pluperfect and a past conditional.",
            "Il faisait nuit quand Marc arriva au village. La lune éclairait les toits et une odeur de pain flottait dans l'air. Il frappa à la porte de la vieille maison et attendit. Une femme ouvrit et le regarda longuement, puis elle sourit. Ce fut ainsi que commença leur amitié. Si Marc était arrivé plus tôt, il aurait vu le marché.",
            "Marking guide (/14): passé simple formed correctly in at least four verbs (4); imperfect for description (2); a correct si + pluperfect + past conditional sentence (3); narrative coherence (2); accuracy of endings, accents and spelling (3).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["The passé simple is used …", "for completed events in literature and formal writing"],
        ["il parla / ils parlèrent", "he spoke / they spoke (passé simple)"],
        ["il fut / ils furent", "he was / they were (passé simple of être)"],
        ["il fit / il vit / il vint", "he did (faire) / he saw (voir) / he came (venir)"],
        ["si + pluperfect →", "past conditional: Si j'avais su, je serais venu."],
        ["Future perfect: formed with?", "future of avoir / être + past participle"],
        ["Reported speech: future →", "conditional (Il a dit qu'il viendrait.)"],
        ["Reported speech: perfect →", "pluperfect (Elle a dit qu'elle avait fini.)"],
        ["Dès qu'elle aura fini, …", "As soon as she has finished, … (future perfect + future)"],
        ["Je doute qu'il ait compris.", "I doubt that he has understood. (perfect subjunctive)"],
      ]),
    },
  },
};
