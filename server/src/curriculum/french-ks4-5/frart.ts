// French — Artistic Culture (A-level, Years 12 and 13). Original content aligned to the DfE GCE modern foreign languages subject content (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q12 = qb("frart", 12);
const q13 = qb("frart", 13);

export const TOPIC: CTopic = {
  key: "frart",
  topic: "Artistic Culture",
  subject: "French",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12",
      yearsCovered: [12],
      objectives: [
        "Discuss cultural heritage, regional culture and traditions in French-speaking countries.",
        "Discuss contemporary francophone music and the role of festivals.",
        "Use vocabulary for heritage, festivals and music, and avoid common false friends.",
        "Use permettre à, il s'agit de, the passive and the subjunctive after expressions of feeling in short arguments.",
        "Read authentic-style texts about culture and translate sentences into French.",
      ],
      note: {
        title: "Year 12: heritage, regional culture, music and false friends",
        body: `## Heritage, festivals and music

| French | English |
| --- | --- |
| le patrimoine | heritage |
| un monument historique | a listed historic building |
| restaurer / préserver | to restore / to preserve |
| une langue régionale (le breton, l'occitan, le corse) | a regional language |
| la chanson française, le rap | French song, rap |
| un groupe, un chanteur / une chanteuse | a band, a singer (m / f) |

*Les Journées du patrimoine* are held each September: historic buildings normally closed to the public open their doors.

## Structures for short arguments

- **permettre à quelqu'un de** + infinitive: *Ce festival permet aux artistes de rencontrer leur public.*
- **il s'agit de** + noun: *Il s'agit d'une tradition très ancienne.*
- **passive + grâce à**: *Le château a été sauvé grâce à une association.*
- **il est dommage / triste que** + subjunctive: *Il est dommage que ce théâtre soit si peu connu.*

## False friends

| French | Means | Not |
| --- | --- | --- |
| assister à | to attend | to assist |
| actuellement | currently | actually (= en fait) |
| éventuellement | possibly | eventually (= finalement) |
| la lecture | reading | a lecture (= une conférence) |

Model sentences: **Des milliers de personnes assistent au défilé.** = Thousands of people attend the parade. **Actuellement, la bibliothèque est en travaux.** = At the moment the library is being renovated.

## Common errors

- *assister* without **à** (*assister un concert*).
- Mixing up *un concert* (performance) and *un concours* (competition).
- Forgetting that *patrimoine* is masculine: *le patrimoine culturel*.`,
      },
      quiz: {
        title: "Artistic Culture: Year 12 quiz",
        questions: [
          q12.single("What does 'le patrimoine' mean?", "heritage", ["patrimony (money)", "a monument", "the countryside"], "Le patrimoine is a country's or community's cultural heritage: buildings, traditions and art.", 1),
          q12.short("Write in French: 'the singer' (a woman).", "la chanteuse", "The feminine of chanteur is chanteuse.", 1, { na: true }),
          q12.single("What does 'Nous avons assisté à un concert' mean?", "We attended a concert.", ["We helped organise a concert.", "We performed at a concert.", "We bought tickets for a concert."], "Assister à means to attend, not to assist. It is a false friend.", 2, true),
          q12.short("Complete with one word: Beaucoup de touristes assistent ____ la fête.", "à", "Assister is followed by à: assister à la fête (attend the festival).", 2, {}),
          q12.single("What does 'Actuellement, le musée est fermé' mean?", "At the moment, the museum is closed.", ["Actually, the museum is closed.", "Eventually, the museum will close.", "Sometimes the museum is closed."], "Actuellement means currently. 'Actually' is en fait, and 'eventually' is finalement.", 2),
          q12.multi("Which sentences are correct French? Choose all that apply.", ["Le théâtre a été rénové grâce à une subvention de la région.", "Cette chanson permet aux jeunes de découvrir la culture bretonne.", "Il s'agit d'un festival qui attire des milliers de visiteurs."], ["Cette chanson permet les jeunes de découvrir la culture bretonne.", "Nous avons assisté un concert en plein air."], "Permettre takes à + person + de + infinitive, and assister requires à.", 2),
          q12.single(
            "Read the text. What problem did some visitors point out?\n\n« Chaque année, en septembre, les Journées du patrimoine permettent au public de visiter gratuitement des monuments habituellement fermés. Cette année, dans notre petite ville, la mairie a ouvert le vieux moulin, restauré grâce aux dons des habitants. Un guide, lui-même fils de meunier, a expliqué comment on fabriquait la farine autrefois. Certains visiteurs ont regretté que l'entrée de l'atelier soit trop étroite pour les fauteuils roulants. La mairie a promis d'installer une rampe avant l'année prochaine. »",
            "The entrance to the workshop was too narrow for wheelchairs.",
            ["The visit was too expensive.", "The guide spoke too quickly.", "The mill was closed to the public."],
            "Certains visiteurs ont regretté que l'entrée de l'atelier soit trop étroite pour les fauteuils roulants. The visit was free (gratuitement).",
            3,
          ),
          q12.single("Which sentence means 'Regional languages are part of our heritage'?", "Les langues régionales font partie de notre patrimoine.", ["Les langues régionales fait partie de notre patrimoine.", "Les langues régionales sont partie de notre patrimoine.", "Les langues régionales font parti de notre patrimoine."], "Faire partie de is 'to be part of'; the plural subject takes font, and partie is a feminine noun.", 2, true),
          q12.short("Translate into French: 'This festival allows young musicians to make themselves known.'", "ce festival permet aux jeunes musiciens de se faire connaître", "Permettre à + person + de + infinitive; se faire connaître is 'to make oneself known'.", 3, { na: true, acc: ["ce festival permet à de jeunes musiciens de se faire connaître"] }),
          q12.single("Which is the best translation of 'a folk song that everyone knows'?", "une chanson populaire que tout le monde connaît", ["une chanson populaire qui tout le monde connaît", "une chanson populaire dont tout le monde connaît", "une chanson populaire que tout le monde connaissent"], "The song is the object of connaît, so we use que; tout le monde takes a singular verb.", 3),
          q12.short("Give the subjunctive of être (one word): Il est dommage que ce monument ____ fermé.", "soit", "Il est dommage que expresses a feeling and takes the subjunctive: qu'il soit.", 2, {}),
          q12.written(
            "Write 6–8 sentences in French about the importance of preserving local traditions or heritage. Use permettre à … de, il s'agit de, one passive construction and one subjunctive after a feeling (il est dommage que…).",
            "Il s'agit d'un sujet essentiel pour notre avenir. Les traditions locales permettent aux jeunes de comprendre d'où ils viennent. Le vieux marché de notre ville a été sauvé grâce à une association, et c'est une bonne chose. Il est dommage que tant de bâtiments historiques soient abandonnés. À mon avis, les mairies devraient investir davantage dans la restauration du patrimoine. Actuellement, beaucoup de gens assistent à des fêtes traditionnelles, ce qui montre que le public s'y intéresse.",
            "Marking guide (/12): clear argument with an opinion (3); permettre à … de and il s'agit de used accurately (2); a passive with correct agreement (1); subjunctive after a feeling (2); use of vocabulary from the topic and avoidance of false friends (2); accuracy of spelling and agreement (2).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["le patrimoine", "heritage"],
        ["assister à", "to attend (false friend of 'to assist')"],
        ["actuellement", "currently (not 'actually')"],
        ["éventuellement", "possibly (not 'eventually')"],
        ["permettre à quelqu'un de + infinitive", "to allow someone to …"],
        ["une langue régionale", "a regional language"],
        ["un concours", "a competition"],
        ["se faire connaître", "to become known / make oneself known"],
        ["faire partie de", "to be part of"],
        ["Il est dommage que + ?", "the subjunctive: Il est dommage qu'il soit fermé."],
      ]),
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13",
      yearsCovered: [13],
      objectives: [
        "Discuss visual arts, architecture, museums and street art.",
        "Discuss public and private funding of the arts and access to culture.",
        "Structure an argument (d'une part … d'autre part, certes, en effet, par conséquent) about the arts.",
        "Use the subjunctive after vouloir que and il faut que, and relative pronouns, in extended writing.",
        "Read and translate texts about art and culture.",
      ],
      note: {
        title: "Year 13: visual arts, museums and funding culture",
        body: `## Vocabulary

| French | English |
| --- | --- |
| un tableau / un peintre | a painting / a painter |
| une œuvre (d'art) | a work (of art): feminine |
| un chef-d'œuvre (pl. des chefs-d'œuvre) | a masterpiece |
| une exposition | an exhibition |
| l'art de rue | street art |
| le mécénat | private sponsorship |
| une subvention / subventionner | public funding / to fund |
| démocratiser la culture | to make culture accessible to all |

## Arguing about the arts

A typical essay question: *L'État doit-il financer la culture ?* Build the answer with connectors:

- **d'une part … d'autre part** = on the one hand … on the other
- **certes … mais**, **en effet** (indeed), **par conséquent** (therefore), **à mon sens** (in my view)
- **il faut que** + subjunctive: *Il faut que la culture reste accessible aux familles modestes.*
- **vouloir que** + subjunctive: *L'artiste veut que le public réagisse.*
- **relative pronouns**: *La sculpture que les habitants ont d'abord critiquée est devenue un symbole.* (the participle agrees with the preceding object *que* = la sculpture)

## Model paragraph

**D'une part, l'entrée gratuite démocratise la culture ; d'autre part, elle oblige les musées à trouver d'autres ressources. Par conséquent, le mécénat joue un rôle de plus en plus important.** = On the one hand, free entry makes culture accessible; on the other, it forces museums to find other income. Consequently, sponsorship plays an ever more important role.

## Common errors

- *un œuvre* (wrong): **une œuvre**.
- *des chefs-d'œuvres*: only *chef* takes -s, so **des chefs-d'œuvre**.
- Using the indicative after *il faut que* or *vouloir que*.`,
      },
      quiz: {
        title: "Artistic Culture: Year 13 quiz",
        questions: [
          q13.single("What does 'un tableau' mean in an art gallery?", "a painting", ["a tablet", "a poster", "a stage"], "Un tableau is a painting. A poster is une affiche.", 1),
          q13.short("Write in French: 'an exhibition'.", "une exposition", "Exposition is a feminine noun, so une exposition.", 1, { na: true, acc: ["l'exposition", "une exposition d'art"] }),
          q13.single("Which is correct for 'a work of art'?", "une œuvre d'art", ["un œuvre d'art", "une œuvres d'art", "un œuvres d'art"], "Œuvre is feminine, so une œuvre; it is singular here, so no -s.", 2, true),
          q13.short("Write the plural: un chef-d'œuvre → des ____", "chefs-d'œuvre", "Only the first word takes the -s, because d'œuvre is a fixed phrase: des chefs-d'œuvre.", 2, { na: true, acc: ["chefs d'œuvre", "des chefs-d'œuvre"], diag: true }),
          q13.single(
            "Read the text. According to the artist, what gives street art its value?\n\n« Autrefois considéré comme du vandalisme, l'art de rue attire aujourd'hui un public de plus en plus large. Dans notre ville, la mairie a invité des artistes à décorer les murs d'un ancien entrepôt. Certains habitants s'en réjouissent, car le quartier est devenu plus vivant. D'autres, en revanche, trouvent que ces fresques, qui disparaîtront un jour, ne méritent pas d'être subventionnées. Pour l'un des artistes, c'est précisément cette fragilité qui fait la valeur de son travail. »",
            "The fact that it does not last.",
            ["The fact that it is paid for by the town hall.", "The size of the paintings.", "The approval of the neighbours."],
            "C'est précisément cette fragilité qui fait la valeur de son travail: the works will disappear one day.",
            3,
          ),
          q13.multi("Which sentences are correct French? Choose all that apply.", ["Ce musée a organisé une exposition dont on parle beaucoup.", "Cette sculpture, que les habitants ont d'abord critiquée, est devenue un symbole de la ville.", "Certes, la culture coûte cher, mais elle est indispensable."], ["Ce musée a organisé une exposition que on parle beaucoup.", "Il faut que l'art est accessible à tous."], "Parler de needs dont, and il faut que needs the subjunctive: soit accessible.", 2),
          q13.single("What does 'subventionner' mean?", "to fund with public money", ["to sell at a discount", "to survive", "to organise an event"], "Une subvention is public funding, so subventionner is to subsidise or fund.", 2),
          q13.short("Translate into French: 'Museums should be free for everyone.'", "les musées devraient être gratuits pour tout le monde", "Devraient (conditional of devoir) + infinitive; the adjective gratuits agrees with the plural musées.", 2, { na: true, acc: ["les musées devraient être gratuits pour tous", "les musées devraient être gratuits"] }),
          q13.single("Which sentence means 'The artist wants people to discover his work'?", "L'artiste veut que les gens découvrent son œuvre.", ["L'artiste veut que les gens découvrir son œuvre.", "L'artiste veut les gens découvrent son œuvre.", "L'artiste veut de faire les gens découvrir son œuvre."], "Vouloir que + subjunctive: que les gens découvrent (the subjunctive of découvrir).", 2),
          q13.short("Give the subjunctive of avoir (one word): Il faut que les musées ____ plus d'argent.", "aient", "Il faut que takes the subjunctive; avoir is irregular: qu'ils aient.", 3, {}),
          q13.short("Translate into French: 'Public subsidies allow young artists to work freely.'", "les subventions publiques permettent aux jeunes artistes de travailler librement", "Permettre à + person + de + infinitive; permettent is plural to agree with subventions.", 3, { na: true, acc: ["les subventions permettent aux jeunes artistes de travailler librement", "les subventions publiques permettent aux jeunes artistes de travailler en toute liberté", "les aides publiques permettent aux jeunes artistes de travailler librement"] }),
          q13.written(
            "Write 7–9 sentences in French answering: « Faut-il subventionner l'art de rue ? » Use d'une part … d'autre part, certes … mais, par conséquent, one subjunctive (il faut que / vouloir que) and one relative pronoun.",
            "D'une part, l'art de rue rend la ville plus vivante et permet aux habitants de découvrir des artistes. D'autre part, ces œuvres, qui disparaîtront un jour, ne durent pas comme les tableaux d'un musée. Certes, il faut que les artistes soient payés pour leur travail, mais l'argent public devrait aussi servir à d'autres besoins. Par conséquent, la mairie pourrait choisir quelques projets et laisser le mécénat financer le reste. Je veux que les jeunes puissent s'exprimer, mais je pense qu'un équilibre est nécessaire.",
            "Marking guide (/14): balanced argument with a clear conclusion (3); connectors (d'une part … d'autre part, certes … mais, par conséquent) (3); subjunctive used accurately (2); relative pronoun used accurately (1); topic vocabulary (2); accuracy of spelling and agreement (3).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["une œuvre d'art (gender?)", "feminine: une œuvre d'art"],
        ["des chefs-d'œuvre", "masterpieces (only chef takes -s)"],
        ["une subvention", "public funding, a grant"],
        ["le mécénat", "private sponsorship (of the arts)"],
        ["d'une part … d'autre part", "on the one hand … on the other hand"],
        ["par conséquent", "therefore, as a result"],
        ["en effet", "indeed, in fact (giving evidence)"],
        ["l'art de rue", "street art"],
        ["démocratiser la culture", "to make culture accessible to all"],
        ["L'artiste veut que le public …", "The artist wants the public to … (+ subjunctive)"],
      ]),
    },
  },
};
