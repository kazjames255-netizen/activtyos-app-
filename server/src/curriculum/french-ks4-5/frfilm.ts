// French — Film & Literature (A-level, Years 12 and 13). Original content aligned to the DfE GCE modern foreign languages subject content (OGL v3.0).
// All synopses, titles and extracts are INVENTED for this course: no copyrighted film or book is quoted.
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q12 = qb("frfilm", 12);
const q13 = qb("frfilm", 13);

export const TOPIC: CTopic = {
  key: "frfilm",
  topic: "Film & Literature",
  subject: "French",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12",
      yearsCovered: [12],
      objectives: [
        "Use vocabulary for analysing films: director, screenplay, plot, characters, flashback, close-up, soundtrack, ending.",
        "Identify and discuss themes such as family, memory, exile, injustice and coming of age.",
        "Use analytical structures in the present tense (le film met en scène, le réalisateur cherche à montrer que, ce qui frappe, c'est…).",
        "Read and summarise invented film synopses and give an opinion with reasons.",
        "Translate sentences about film into French.",
      ],
      note: {
        title: "Year 12: the language of film analysis",
        body: `## Film vocabulary

| French | English |
| --- | --- |
| un réalisateur / une réalisatrice | a director |
| un scénario | a screenplay |
| l'intrigue (f) | the plot |
| le dénouement | the resolution, the ending |
| un retour en arrière | a flashback |
| un gros plan | a close-up |
| la bande sonore | the soundtrack |
| la mise en scène | the staging, the direction |
| un roman / une nouvelle | a novel / a short story |

**Un personnage** is always masculine, even for a woman: *le personnage principal est une jeune femme*. Themes: *l'amitié, la famille, l'exil, la mémoire, l'injustice, le passage à l'âge adulte.*

## Analysing in the present tense

Describe and analyse a film in the **present tense**, even for events in the story.

- **Le film met en scène** … = The film portrays …
- **Le réalisateur cherche à montrer que** … = The director tries to show that …
- **Ce qui frappe, c'est** … = What is striking is …
- **On peut y voir une critique de** … = We can see a criticism of …
- **Le personnage évolue** … = The character develops …
- **Ce film traite de** … (not *traite* + direct object).

## Model analysis of an imaginary film

*« La Boulangerie de nuit »*: **Un apprenti boulanger découvre que son patron cache un secret. Le film met en scène l'amitié entre deux générations. Le réalisateur cherche à montrer que le travail peut créer des liens. Ce qui frappe, c'est la lumière chaude des scènes de nuit.**

## Common errors

- *Cette film* (wrong): **ce film**; the noun is masculine.
- Putting the analysis in the past: *le film a montré* → **le film montre**.
- Confusing *le scénario* (script) with *le scénariste* (scriptwriter).`,
      },
      quiz: {
        title: "Film & Literature: Year 12 quiz",
        questions: [
          q12.single("What does 'un réalisateur' mean?", "a film director", ["a film critic", "an actor", "a cinema owner"], "Un réalisateur directs films (réaliser = to make or direct).", 1),
          q12.short("Write in French: 'the main character' (masculine noun).", "le personnage principal", "Personnage is masculine even for a woman; principal is the adjective for 'main'.", 1, { na: true, acc: ["un personnage principal"] }),
          q12.single("What does 'un retour en arrière' mean in film analysis?", "a flashback", ["a rewind button", "a return ticket", "a sequel"], "Literally 'a return backwards': a scene that goes back in time.", 2, true),
          q12.single(
            "Read the synopsis of an invented film. What is its main theme?\n\n« Dans « Le Dernier Ferry », Anouk, dix-sept ans, vit sur une petite île avec son père, capitaine du seul bateau qui relie l'île au continent. Elle rêve de faire des études à Paris, mais elle n'ose pas quitter son père, resté seul depuis la mort de sa mère. Lorsqu'une tempête coupe l'île du monde pendant trois jours, Anouk découvre que son père, qui semblait si fort, a peur de la solitude. Le film se termine sur un plan large montrant le ferry qui s'éloigne, sans que l'on sache qui est à bord. »",
            "The tension between independence and loyalty to family.",
            ["The dangers of sailing in bad weather.", "The importance of a Paris education.", "The rivalry between two islands."],
            "Anouk dreams of leaving but does not dare abandon her father: independence versus family loyalty.",
            2, true,
          ),
          q12.multi("Which sentences are correct French? Choose all that apply.", ["Le réalisateur cherche à montrer que la solitude peut être une force.", "Ce qui frappe, c'est l'utilisation de la lumière dans cette scène.", "Le personnage évolue tout au long du film."], ["Cette film met en scène une famille d'artistes.", "Les personnages principaux est très bien joués."], "Film is masculine (ce film), and a plural subject needs a plural verb (sont) and agreeing participle (joués).", 2),
          q12.short("Complete with ce qui or ce que: ____ me frappe dans ce film, c'est la musique.", "Ce qui", "The pronoun is the subject of frappe, so ce qui (not ce que).", 2, { acc: ["ce qui"] }),
          q12.single("What does 'le dénouement' mean?", "the resolution of the story", ["the opening scene", "the soundtrack", "the cast list"], "Le dénouement is the final unravelling of the plot (from nouer, to tie).", 2),
          q12.short("Translate into French: 'The director uses close-ups to show the character's fear.'", "le réalisateur utilise des gros plans pour montrer la peur du personnage", "Utiliser + object, pour + infinitive for purpose; la peur du personnage (de + le = du).", 3, { na: true, acc: ["le cinéaste utilise des gros plans pour montrer la peur du personnage", "la réalisatrice utilise des gros plans pour montrer la peur du personnage", "le réalisateur utilise des plans rapprochés pour montrer la peur du personnage"] }),
          q12.single("Which is the best translation of 'What is striking is that the film never shows the accident'?", "Ce qui est frappant, c'est que le film ne montre jamais l'accident.", ["Ce que est frappant, c'est que le film ne montre pas jamais l'accident.", "Ce qui est frappant, c'est le film ne montre jamais l'accident.", "Ce qui est frappant, c'est que le film montre jamais l'accident."], "Ce qui + est (subject); after c'est we need que to introduce the clause; ne … jamais wraps the verb.", 3),
          q12.short("Give the subjunctive (one word): Le scénariste veut que le spectateur ____ le héros. (comprendre)", "comprenne", "Vouloir que takes the subjunctive; comprendre → que je comprenne, qu'il comprenne.", 3, {}),
          q12.single("In literary study, what is 'une nouvelle'?", "a short story", ["a novel", "a poem", "a play"], "Une nouvelle is a short story; a novel is un roman.", 2),
          q12.written(
            "Write 6–8 sentences in French analysing a film you know, or an imaginary one. Say what it portrays, name a theme, describe how a character develops, mention one technique (gros plan, bande sonore, retour en arrière…) and give your opinion with a reason.",
            "« Les Voisins du quatrième » est un film imaginaire qui met en scène une famille dans un vieil immeuble. Le réalisateur cherche à montrer que la solidarité est plus forte que la solitude. Le personnage principal, une jeune femme timide, évolue tout au long du film : elle apprend à demander de l'aide. Ce qui frappe, c'est l'utilisation des gros plans pour montrer ses émotions. La bande sonore, très simple, renforce l'atmosphère. À mon avis, c'est un film touchant parce que les personnages sont réalistes.",
            "Marking guide (/12): the film's subject and theme (3); analysis in the present tense with structures such as met en scène / cherche à montrer que / ce qui frappe (3); a named technique used correctly (1); opinion with reason (1); accuracy of gender, agreement and spelling (2); range of vocabulary (2).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["un réalisateur / une réalisatrice", "a director (m / f)"],
        ["l'intrigue (f)", "the plot"],
        ["un retour en arrière", "a flashback"],
        ["un gros plan", "a close-up"],
        ["la bande sonore", "the soundtrack"],
        ["Le film met en scène …", "The film portrays / depicts …"],
        ["Ce qui frappe, c'est …", "What is striking is …"],
        ["Which tense for analysis?", "the present, even for events in the story"],
        ["un roman / une nouvelle", "a novel / a short story"],
        ["Ce film traite de …", "This film deals with …"],
      ]),
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13",
      yearsCovered: [13],
      objectives: [
        "Use vocabulary for analysing literary texts: narrator, point of view, register, metaphor, symbol, structure, act, monologue.",
        "Analyse themes, characters and style in invented novel and play synopses.",
        "Structure an essay with an introduction, a developed argument and a conclusion, using formal linking phrases.",
        "Use the subjunctive, relative pronouns and dont in analytical writing.",
        "Translate sentences about literature into French.",
      ],
      note: {
        title: "Year 13: analysing novels and plays",
        body: `## Vocabulary for literary analysis

| French | English |
| --- | --- |
| un narrateur / une narratrice | a narrator |
| à la première personne | in the first person |
| un point de vue | a point of view |
| un registre (comique, tragique, lyrique) | a tone / register |
| une métaphore / un symbole | a metaphor / a symbol |
| un acte / un monologue | an act / a soliloquy |
| l'ironie (f) | irony |
| dénoncer / incarner | to denounce / to embody |

## Structures for analysis

- **L'auteur met en évidence** … = The author highlights …
- **À travers le personnage de …, l'écrivain dénonce** … = Through the character of …, the writer criticises …
- **Non seulement … mais aussi** … = Not only … but also …
- **Ce n'est pas … qui compte, mais** … = It is not … that matters, but …
- **dont** for relative clauses: *un héros dont le courage est mis à l'épreuve*.
- **Il s'agit de** + noun for the subject matter: *Il s'agit d'un roman sur l'exil.*

## Planning an essay

Introduction: hook, presentation of the work, problem question (*Dans quelle mesure …?*). Body: two or three arguments linked by *d'abord, ensuite, en outre, cependant*. Conclusion: answer the question and open a wider point (*autrement dit, en somme*). Analyse in the **present tense**.

## Model sentence

**Dans « Le Jardin de Yann », roman imaginaire, le jardin symbolise la mémoire, ce qui permet à l'auteur de dénoncer l'oubli.** = In "Le Jardin de Yann", an imaginary novel, the garden symbolises memory, which allows the author to criticise forgetting.

## Common errors

- *dénoncer* means to denounce or criticise, never "to announce" (*annoncer*).
- Forgetting the irregular present of *mourir* (*il meurt*) or *naître* (*il naît*).
- Writing a plot summary instead of analysing: always explain **why** the author chooses a technique.`,
      },
      quiz: {
        title: "Film & Literature: Year 13 quiz",
        questions: [
          q13.single("What does 'le narrateur' mean?", "the narrator", ["the traveller", "the novelist", "the reader"], "Le narrateur is the voice that tells the story, not necessarily the author.", 1),
          q13.short("Write in French: 'a metaphor'.", "une métaphore", "Métaphore is a feminine noun, so une métaphore.", 1, { na: true, acc: ["la métaphore"] }),
          q13.single("What does 'à la première personne' mean when describing a narrator?", "in the first person", ["for the first time", "in first place", "in the first act"], "A narrator 'à la première personne' says je (I).", 2, true),
          q13.single(
            "Read the synopsis of an invented novel. What does the sea symbolise?\n\n« Dans « Les Marées de Mathilde », la narratrice, âgée de soixante-dix ans, revient sur l'été de ses douze ans passé chez sa grand-mère, dans un village de pêcheurs. Le récit, écrit à la première personne, alterne souvenirs et commentaires ironiques. La mer, qui monte et descend, symbolise le passage du temps et la mémoire, qui efface et rapporte les souvenirs. À la fin, Mathilde découvre que sa grand-mère lui a caché un secret pendant toute sa vie. »",
            "The passing of time and memory.",
            ["The danger of the fishing trade.", "The distance between two countries.", "The narrator's fear of water."],
            "La mer … symbolise le passage du temps et la mémoire.",
            2, true,
          ),
          q13.multi("Which sentences are correct French? Choose all that apply.", ["L'auteur met en évidence les contradictions du héros.", "À travers ce personnage, l'écrivain dénonce l'hypocrisie sociale.", "Non seulement le récit est ironique, mais il est aussi émouvant."], ["L'auteur met en évidence de les contradictions du héros.", "Ce roman se caractérise à un style très poétique."], "Mettre en évidence takes a direct object with no preposition, and se caractériser par (not à) introduces the feature.", 2),
          q13.short("Complete with the correct relative pronoun: Le roman ____ je parle raconte la vie d'un pêcheur.", "dont", "Parler de: the relative pronoun replacing 'de + noun' is dont.", 2, {}),
          q13.single("In a play, what is 'un acte'?", "a main division of a play", ["an actor", "an action scene", "an audience"], "Un acte is one of the main sections of a play; smaller sections are des scènes.", 2),
          q13.short("Translate into French: 'The author uses irony to criticise society.'", "l'auteur utilise l'ironie pour critiquer la société", "Utiliser + object, then pour + infinitive for purpose; ironie and société are feminine.", 3, { na: true, acc: ["l'écrivain utilise l'ironie pour critiquer la société", "l'auteur se sert de l'ironie pour critiquer la société", "l'auteur emploie l'ironie pour critiquer la société", "l'autrice utilise l'ironie pour critiquer la société", "l'écrivaine utilise l'ironie pour critiquer la société"] }),
          q13.single("Which sentence best translates 'The play raises the question of whether individuals are free'?", "La pièce pose la question de savoir si les individus sont libres.", ["La pièce pose la question de savoir que les individus sont libres.", "La pièce pose la question de savoir si les individus être libres.", "La pièce pose la question quand les individus sont libres."], "Poser la question de savoir si + indicative introduces an indirect question ('whether').", 3),
          q13.short("Give the present tense (one word): À la fin du roman, le héros ____ dans un accident. (mourir)", "meurt", "Mourir is irregular: il meurt. In literary analysis we use the present tense.", 2, { na: true }),
          q13.single("Which sentence best translates 'It is not the plot that matters but the way it is told'?", "Ce n'est pas l'intrigue qui compte, mais la façon dont elle est racontée.", ["Ce n'est pas l'intrigue que compte, mais la façon que elle est racontée.", "Ce n'est pas l'intrigue qui compte, mais la façon dont elle raconte.", "Ce n'est pas l'intrigue qui compte, mais la façon où elle est racontée."], "Ce n'est pas … qui compte; la façon dont elle est racontée: dont + passive ('the way in which it is told').", 3),
          q13.written(
            "Read this invented synopsis: « Dans « L'Horloge », un vieil horloger refuse de vendre son atelier à un promoteur. Sa fille voudrait qu'il accepte pour qu'il puisse se reposer. Au troisième acte, l'horloge du village s'arrête, et personne ne sait qui l'a arrêtée. » Write 6–8 sentences in French analysing the play: its theme, two characters, one symbol and your view of the ending. Use at least one subjunctive and one relative pronoun.",
            "« L'Horloge » traite du conflit entre la tradition et le progrès. Le vieil horloger incarne l'attachement au passé, tandis que sa fille veut qu'il soit enfin tranquille. L'horloge du village symbolise le temps qui passe, mais aussi la mémoire de la communauté. Ce qui frappe, c'est que personne ne sait qui l'a arrêtée, ce qui laisse la fin ouverte. À mon avis, cette incertitude est une bonne idée, car elle oblige le spectateur à réfléchir. Il s'agit d'une pièce dont le message reste actuel.",
            "Marking guide (/14): analysis of theme and characters, not just plot summary (4); the symbol explained (2); a correct subjunctive (2); a relative pronoun (1); reasoned opinion on the ending (2); accuracy of spelling and agreement (3).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["un narrateur / une narratrice", "a narrator (m / f)"],
        ["à la première personne", "in the first person"],
        ["un registre", "a tone, a register (comic, tragic, lyrical)"],
        ["un symbole / une métaphore", "a symbol / a metaphor"],
        ["dénoncer", "to denounce, to criticise (not 'to announce')"],
        ["incarner", "to embody"],
        ["Non seulement … mais aussi …", "Not only … but also …"],
        ["L'auteur met en évidence …", "The author highlights …"],
        ["un acte / une scène", "an act / a scene (in a play)"],
        ["Il s'agit de …", "It is about … (impersonal)"],
      ]),
    },
  },
};
