// French — Identity & Culture (GCSE, Years 10 and 11). Original content aligned to the DfE GCSE modern foreign languages subject content (OGL v3.0).
// Reading / writing / grammar / vocabulary only. Checked by _check_l2.ts.
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q10 = qb("fride", 10);
const q11 = qb("fride", 11);

export const TOPIC: CTopic = {
  key: "fride",
  topic: "Identity & Culture",
  subject: "French",
  years: {
    10: {
      year: 10,
      subtopic: "GCSE Year 10",
      yearsCovered: [10],
      objectives: [
        "Talk and write about family, friends and relationships, giving and justifying opinions.",
        "Discuss technology and social media in everyday life: advantages, disadvantages and online safety.",
        "Describe free-time activities and French and francophone customs and festivals.",
        "Read short authentic-style texts and answer comprehension questions in English.",
        "Translate short sentences from English into French, using a range of tenses.",
      ],
      note: {
        title: "Year 10: family, friends, technology and festivals",
        body: `## Opinions and reasons

At GCSE you must **give an opinion and justify it** (*parce que*, *car*, *puisque*). Add contrast with *mais* and *pourtant*, and structure with *d'un côté … de l'autre*.

| French | English |
| --- | --- |
| s'entendre bien avec | to get on well with |
| se disputer avec | to argue with |
| ma meilleure amie / mon meilleur ami | my best friend |
| quelqu'un qui sait m'écouter | someone who knows how to listen to me |
| les réseaux sociaux (m) | social media |
| télécharger / partager | to download / to share |
| le harcèlement en ligne | online bullying |
| un avantage / un inconvénient | an advantage / a disadvantage |

## Model sentences

- **Ma meilleure amie s'appelle Zoé ; elle est loyale et très drôle.** = My best friend is called Zoé; she is loyal and very funny.
- **Je m'entends bien avec ma sœur parce qu'elle sait m'écouter.** = I get on well with my sister because she knows how to listen to me.
- **D'un côté, les réseaux sociaux sont pratiques ; de l'autre, ils peuvent créer du stress.** = On the one hand, social media are practical; on the other, they can create stress.
- **Ce que j'apprécie chez mes amis, c'est leur honnêteté.** = What I appreciate about my friends is their honesty. (*ce que* + subject + verb; *ce qui* is the subject: *ce qui me plaît, c'est …*)
- **En France, on fête le quatorze juillet avec un défilé et des feux d'artifice.** = In France, people celebrate 14 July with a parade and fireworks.

## Common errors

- **mon amie**, not *ma amie*: feminine nouns beginning with a vowel take *mon / ton / son*.
- Adjectives agree: *ma sœur est sportive*, *mes amis sont sportifs*.
- Verbs after *parce que* still need the right person: *parce qu'il est* (elision before a vowel).`,
      },
      quiz: {
        title: "Identity & Culture: Year 10 quiz",
        questions: [
          q10.single("What does 'se disputer avec quelqu'un' mean?", "to argue with someone", ["to get on well with someone", "to meet someone by chance", "to make up with someone"], "Se disputer is to have an argument. Getting on well is s'entendre bien.", 1),
          q10.short("Write in French: 'social media'.", "les réseaux sociaux", "Réseau is masculine, so the plural is les réseaux; social becomes sociaux in the masculine plural.", 1, { na: true, acc: ["réseaux sociaux", "les médias sociaux"] }),
          q10.short("Complete with mon, ma or mes: ____ amie Sofia est très généreuse.", "mon", "Amie is feminine, but it begins with a vowel sound, so we use mon (not ma) to avoid two vowel sounds meeting.", 2, { diag: true }),
          q10.short("Translate into French: 'I get on well with my cousins.'", "je m'entends bien avec mes cousins", "S'entendre bien avec + noun; the reflexive pronoun is m' before a vowel, and cousins is plural so it takes mes.", 2, { na: true, acc: ["je m'entends bien avec mes cousines", "je m'entends très bien avec mes cousins", "je m'entends très bien avec mes cousines"] }),
          q10.single("Which pair of phrases means 'on the one hand … on the other hand'?", "d'un côté … de l'autre", ["d'abord … ensuite", "par exemple … donc", "hier … demain"], "Côté means side, so d'un côté … de l'autre contrasts two points of view.", 2),
          q10.multi("Which sentences are correct French? Choose all that apply.", ["Ma meilleure amie s'appelle Inès.", "Mes parents s'entendent bien.", "Mon grand-père est très sportif."], ["Ma sœur est très sportif.", "Mes amis est très drôles."], "Adjectives and verbs must agree with the subject: a feminine sœur needs sportive, and plural amis needs sont.", 2),
          q10.single(
            "Read the text. Why does the writer love this festival?\n\n« Chaque année, le vingt et un juin, ma ville organise la fête de la musique. Dans les rues, des groupes jouent du rock, du jazz ou de la musique traditionnelle, et tout le monde peut écouter gratuitement. L'année dernière, j'ai chanté avec ma chorale sur la place du marché. J'étais un peu nerveuse, mais mes parents et mes amis sont venus m'encourager. Après le concert, nous avons mangé des crêpes en écoutant un groupe de jeunes. J'adore cette fête parce qu'elle réunit toutes les générations. »",
            "It brings all the generations together.",
            ["It is the only day she is allowed to sing.", "The concerts are expensive but excellent.", "She wins a prize with her choir."],
            "The last sentence gives the reason: elle réunit toutes les générations. The concerts are free (gratuitement).",
            2, true,
          ),
          q10.single("Which sentence means 'Online bullying is a real problem for teenagers'?", "Le harcèlement en ligne est un vrai problème pour les adolescents.", ["La harcèlement en ligne est un vrai problème pour les adolescents.", "Le harcèlement en ligne sont un vrai problème pour les adolescents.", "Le harcèlement en ligne est une vrai problème pour les adolescents."], "Harcèlement and problème are both masculine, so le … un vrai …, and the singular subject takes est.", 2),
          q10.single("Which is the best translation of 'What matters to me is having loyal friends'?", "Ce qui compte pour moi, c'est d'avoir des amis fidèles.", ["Ce que compte pour moi, c'est d'avoir des amis fidèles.", "Ce qui compte pour moi, c'est d'avoir des amis fidèle.", "Ce qui compte moi, c'est avoir des amis fidèles."], "Ce qui is the subject of compte, and the plural amis needs the plural adjective fidèles.", 3),
          q10.short("Translate into French: 'I would like to spend less time on my phone.'", "je voudrais passer moins de temps sur mon portable", "Vouloir in the conditional (je voudrais) plus an infinitive; moins de temps takes de, not du.", 3, { na: true, acc: ["je voudrais passer moins de temps sur mon téléphone", "j'aimerais passer moins de temps sur mon portable", "j'aimerais passer moins de temps sur mon téléphone", "je voudrais passer moins de temps sur mon smartphone", "j'aimerais passer moins de temps sur mon smartphone", "je voudrais passer moins de temps sur mon téléphone portable", "j'aimerais passer moins de temps sur mon téléphone portable", "je voudrais passer moins de temps sur mon mobile", "j'aimerais passer moins de temps sur mon mobile"] }),
          q10.short("Give the correct verb phrase (two words): Le week-end dernier, nous ____ à un concert. (aller)", "sommes allés", "Aller takes être in the perfect tense, so the past participle agrees with nous: sommes allés (or allées if all are female).", 3, { na: true, acc: ["sommes allées"] }),
          q10.written(
            "Write 5–6 sentences in French about your best friend and how you keep in touch using technology. Give at least two opinions with reasons and use at least one past-tense verb.",
            "Ma meilleure amie s'appelle Lina. Je m'entends très bien avec elle parce qu'elle est drôle et elle sait m'écouter. Nous nous parlons tous les soirs sur notre portable, car c'est pratique. Le week-end dernier, nous avons regardé un film ensemble en ligne. À mon avis, les réseaux sociaux sont utiles, mais ils peuvent aussi être dangereux à cause du harcèlement.",
            "Marking guide (10): content and range of ideas (3); opinions with reasons using parce que / car (2); a past tense used correctly (2); accuracy of agreement, gender and verb forms (2); variety of vocabulary and linking words (1). Reward accurate French over length.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["se disputer avec quelqu'un", "to argue with someone"],
        ["to download", "télécharger"],
        ["le harcèlement en ligne", "online bullying"],
        ["un inconvénient", "a disadvantage / drawback"],
        ["Why 'mon amie' and not 'ma amie'?", "Feminine nouns that start with a vowel sound take mon / ton / son."],
        ["on the one hand … on the other hand", "d'un côté … de l'autre"],
        ["Ce que j'apprécie chez mes amis, c'est …", "What I appreciate about my friends is …"],
        ["la fête de la musique", "the music festival held on 21 June"],
        ["quelqu'un qui sait écouter", "someone who knows how to listen"],
        ["an app", "une appli / une application"],
      ]),
    },
    11: {
      year: 11,
      subtopic: "GCSE Year 11",
      yearsCovered: [11],
      objectives: [
        "Discuss role models, relationships and equality, explaining what you admire and why.",
        "Talk about culture in the francophone world: music, film, sport and festivals.",
        "Use depuis + present, après avoir / être + past participle and en + present participle accurately.",
        "Read longer texts and pick out opinions, reasons and changes over time.",
        "Translate and write extended answers with a range of tenses and linking words.",
      ],
      note: {
        title: "Year 11: role models, culture and richer structures",
        body: `## Structures that lift your French

| Structure | Example |
| --- | --- |
| **depuis** + present (still true now) | J'apprends le piano depuis trois ans. |
| **après avoir / être** + past participle | Après avoir lu le message, elle a téléphoné à sa mère. |
| **en** + present participle (by / while doing) | Il s'est détendu en écoutant du jazz. |
| **ce que … c'est** (what I … is) | Ce que j'admire chez ma prof de sport, c'est son énergie. |

- *Depuis* + **present** = "have been … for/since": *Nous étudions ici depuis septembre.* Do not use the perfect tense.
- The present participle is the *nous* form of the present with *-ons* changed to **-ant**: *finir → finissant*, *faire → faisant* (exceptions: être → étant, avoir → ayant).
- *Après avoir* + participle uses **avoir** verbs; for *aller, venir, arriver, sortir* and reflexives use **être**: *Après être arrivés, nous avons mangé.*

## Vocabulary

un modèle à suivre (a role model) · admirer · un influenceur / une influenceuse · l'égalité (f) · un stéréotype · le monde francophone · un abonnement · cependant (however) · pourtant (yet) · de plus (moreover)

## Common errors

- Writing *J'ai habité ici depuis deux ans* for "I have lived here for two years". Use **j'habite … depuis**.
- Using *en* + infinitive: it must be *en jouant*, not *en jouer*.
- Forgetting agreement with être: *Après être sortie, elle …*`,
      },
      quiz: {
        title: "Identity & Culture: Year 11 quiz",
        questions: [
          q11.single("What does 'un modèle à suivre' mean?", "a role model", ["a fashion show", "a shopping list", "a school rule"], "Un modèle à suivre is an example to follow, that is, a role model.", 1),
          q11.short("Write in French: 'the French-speaking world'.", "le monde francophone", "Monde is masculine, so le monde, and francophone is the adjective for French-speaking.", 1, { acc: ["le monde francophone."] }),
          q11.short("Translate into French: 'I have been living in Lyon for five years.'", "j'habite à Lyon depuis cinq ans", "Depuis with an action that is still going on takes the PRESENT tense in French, not the perfect.", 2, { na: true, diag: true, acc: ["j'habite Lyon depuis cinq ans", "j'habite à Lyon depuis 5 ans", "j'habite Lyon depuis 5 ans", "je vis à Lyon depuis cinq ans", "je vis à Lyon depuis 5 ans"] }),
          q11.single("What does 'Après avoir mangé, il a fait la vaisselle' mean?", "After eating, he did the washing-up.", ["Before eating, he did the washing-up.", "While eating, he did the washing-up.", "Instead of eating, he did the washing-up."], "Après avoir + past participle means 'after having done something'.", 2),
          q11.multi("Which sentences are correct French? Choose all that apply.", ["Il a appris l'espagnol en écoutant de la musique.", "Après avoir vu le film, ils sont sortis.", "Nous habitons ici depuis longtemps."], ["J'ai habité ici depuis deux ans.", "En regarder la télé, il s'endort."], "Depuis (still true) takes the present; en is followed by a present participle (-ant), never an infinitive.", 2),
          q11.single(
            "Read the text. What has the narrator changed their mind about?\n\n« Mon modèle, c'est ma tante Aïcha, qui habite à Dakar depuis vingt ans. Elle est infirmière dans un grand hôpital et elle donne aussi des cours de premiers secours aux jeunes de son quartier. Quand j'étais petit, je pensais que son travail était ennuyeux, mais maintenant je comprends qu'elle aide vraiment les gens. Ce que j'admire le plus chez elle, c'est sa patience. Cet été, je vais la voir à Dakar et l'accompagner à l'hôpital. »",
            "He used to find her job boring but now sees that it helps people.",
            ["He used to want to move to Dakar but now wants to stay at home.", "He used to admire her patience but now finds it annoying.", "He used to be afraid of hospitals but now wants to be a nurse."],
            "Quand j'étais petit, je pensais que son travail était ennuyeux, mais maintenant je comprends qu'elle aide vraiment les gens.",
            2, true,
          ),
          q11.single("Which is the best translation of 'By watching French series, I have improved my vocabulary'?", "En regardant des séries françaises, j'ai amélioré mon vocabulaire.", ["En regarder des séries françaises, j'ai amélioré mon vocabulaire.", "En regardé des séries françaises, j'ai amélioré mon vocabulaire.", "Par regardant des séries françaises, j'ai amélioré mon vocabulaire."], "'By doing' is en + present participle: regarder becomes regardant (nous regardons → regard- + -ant).", 2),
          q11.single("Which word means 'however'?", "cependant", ["donc", "car", "de plus"], "Cependant introduces a contrast. Donc is 'so', car is 'because' and de plus is 'moreover'.", 2),
          q11.short("Combine with 'après avoir': « J'ai fini mes devoirs. Ensuite, j'ai regardé une série. »", "Après avoir fini mes devoirs, j'ai regardé une série.", "Après avoir + past participle of the first action (fini), then the main clause in the perfect tense.", 3, { acc: ["Après avoir fini mes devoirs j'ai regardé une série.", "Après avoir fini mes devoirs, j'ai regardé une série", "après avoir fini mes devoirs, j'ai regardé une série", "après avoir terminé mes devoirs, j'ai regardé une série", "j'ai regardé une série après avoir fini mes devoirs", "j'ai regardé une série après avoir terminé mes devoirs"] }),
          q11.short("Translate into French: 'What I admire about him is his honesty.'", "ce que j'admire chez lui, c'est son honnêteté", "Ce que (object) + j'admire + chez + person, then c'est; honnêteté is feminine but begins with a vowel sound, so son.", 3, { na: true, acc: ["ce que j'admire chez lui c'est son honnêteté", "ce que j'admire chez lui, c'est son honnêteté.", "ce que j'admire en lui, c'est son honnêteté", "ce que j'admire chez lui, c'est son honnêteté"] }),
          q11.single("Which sentence contains a MISTAKE?", "Mes grands-parents habitent près de chez nous, mais ils se voit souvent.", ["Je suis abonné à cette chaîne depuis un an.", "Ma cousine est devenue influenceuse en publiant des vidéos.", "Nous avons regardé le match en mangeant des chips."], "The plural subject ils needs the plural verb: ils se voient. The other three sentences are correct.", 3),
          q11.written(
            "Write 6–8 sentences in French about a person you admire (real or imaginary). Say who they are, what you admire about them, how long you have known them (depuis) and one thing they did in the past. Use at least one en + present participle.",
            "Mon modèle, c'est mon entraîneur de basket, M. Diallo. Je le connais depuis quatre ans. Ce que j'admire chez lui, c'est sa patience, parce qu'il aide tout le monde. L'année dernière, il a organisé un tournoi pour l'école. Il est toujours positif, même en perdant un match. Cependant, il est très exigeant, et c'est pourquoi notre équipe progresse.",
            "Marking guide (12): task coverage, all bullet points addressed (3); depuis + present used correctly (2); en + present participle (1); a past tense used accurately (2); opinions and reasons with linking words such as cependant (2); accuracy of gender, agreement and spelling (2).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["J'apprends … depuis trois ans.", "I have been learning … for three years. (present + depuis)"],
        ["Après avoir lu …", "After having read …"],
        ["en jouant", "by / while playing (en + present participle)"],
        ["Present participle of finir", "finissant"],
        ["un modèle à suivre", "a role model"],
        ["l'égalité (f)", "equality"],
        ["however / yet", "cependant / pourtant"],
        ["un influenceur / une influenceuse", "an influencer (m / f)"],
        ["Après être arrivés, …", "After arriving, … (être verb: participle agrees)"],
        ["le monde francophone", "the French-speaking world"],
      ]),
    },
  },
};
