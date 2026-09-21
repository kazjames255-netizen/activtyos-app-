// Spanish — Aspects of Society (A-level, Years 12 and 13). Original content aligned to the DfE GCE modern foreign languages subject content (OGL v3.0).
// Reading / writing / grammar / vocabulary only. Checked by _check_l4.ts.
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q12 = qb("essoc", 12);
const q13 = qb("essoc", 13);

const cross = (...parts: string[][]) => parts.reduce<string[]>((acc, p) => acc.flatMap((a) => p.map((b) => a + b)), [""]);
const hoy12 = cross(["Hoy en día ", "Hoy en día, ", "Hoy día ", "Hoy día, ", "Actualmente ", "Actualmente, ", "En la actualidad ", "En la actualidad, "], ["cada vez más parejas "], ["deciden no casarse", "optan por no casarse", "prefieren no casarse", "eligen no casarse"]);
const sal13 = [
  ...cross(["No encontrarás "], ["trabajo ", "un trabajo ", "empleo ", "un empleo "], ["a menos que ", "a no ser que ", "salvo que "], ["hables español", "hables castellano"]),
  ...cross([""], ["A menos que ", "A no ser que ", "Salvo que "], ["hables español, ", "hables castellano, "], ["no encontrarás trabajo", "no encontrarás un trabajo", "no encontrarás empleo", "no encontrarás un empleo"]),
  "Si no hablas español, no encontrarás trabajo",
  "No encontrarás trabajo si no hablas español",
];

export const TOPIC: CTopic = {
  key: "essoc",
  topic: "Aspects of Society",
  subject: "Spanish",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12",
      yearsCovered: [12],
      objectives: [
        "Discuss changing family structures, modern and traditional values, and work-life balance in the Spanish-speaking world.",
        "Discuss cyberspace: social media, fake news, privacy, online safety and the digital divide.",
        "Express opinion, doubt and reaction using the subjunctive after impersonal expressions and verbs of doubt or emotion.",
        "Use linking words and formal connectors to structure a written argument.",
        "Read and translate authentic-style texts on social topics.",
      ],
      note: {
        title: "Year 12: changing families, values and cyberspace",
        body: `## Arguing about social change

A-level answers weigh evidence, not just opinion. Frame a point (*hoy en día, cada vez más, en las últimas décadas*), give an example, then evaluate it with a connector: *no obstante* (nevertheless), *por consiguiente* (therefore), *ahora bien* (however), *dado que* (given that), *a pesar de que* (despite the fact that).

| Spanish | English |
| --- | --- |
| la familia monoparental | single-parent family |
| la pareja de hecho | unmarried (registered) couple |
| el envejecimiento de la población | ageing population |
| la conciliación laboral y familiar | work-life balance |
| el teletrabajo | remote working |
| la brecha digital | digital divide |
| el bulo, la noticia falsa | hoax, fake news |
| el ciberacoso | cyberbullying |

## Opinion and doubt

After impersonal judgements, doubt and emotion, use the **subjunctive**: *es probable que, dudo que, no es de extrañar que, me alegra que*. After **creer que / es evidente que** use the **indicative**. **Aunque** takes the indicative for a known fact and the subjunctive for a hypothetical or a concession.

- **Cada vez más personas mayores viven solas.** = More and more older people live alone.
- **Aunque el teletrabajo ahorra tiempo, exige mucha disciplina.** = Although working from home saves time, it demands a lot of discipline.
- **Es posible que las redes sociales debiliten la conversación cara a cara.** = It is possible that social media weaken face-to-face conversation.

## Common errors

1. *El hecho que* → **el hecho de que**.
2. **False friend:** *actualmente* means "currently"; for "actually" use *en realidad*.
3. **Por lo tanto / por consiguiente** for results, **sino** after a negative (*no es un juego sino un negocio*).
4. **Los medios de comunicación** (the media) is plural.`,
      },
      quiz: {
        title: "Aspects of Society: Year 12 quiz",
        questions: [
          q12.single("What does *el teletrabajo* mean?", "working from home (remote working)", ["marketing by telephone and e-mail", "working overtime and at weekends", "sending messages by telegraph"], "*Tele-* means at a distance, so *el teletrabajo* is work done remotely, usually from home.", 1),
          q12.short("Translate into Spanish: social media.", "las redes sociales", "*Red* (network) is feminine, and the phrase is plural: *las redes sociales*.", 1, { acc: ["redes sociales"] }),
          q12.single("What does *la brecha digital* refer to?", "the gap between people with and without access to technology", ["a digital photograph taken with a phone", "a computer virus that spreads by e-mail", "a shop that sells computers and phones"], "*Brecha* means gap, so *la brecha digital* is the gap between people who have access and skills and those who do not.", 2, true),
          q12.single("Which connector best means «nevertheless»?", "no obstante", ["por consiguiente", "además", "es decir"], "*No obstante* introduces a contrast. *Por consiguiente* = therefore, *además* = moreover and *es decir* = that is to say.", 2, true),
          q12.single("Choose the correct form: «Es probable que los jóvenes ___ más tiempo en línea que sus padres.»", "pasen", ["pasan", "pasarán", "pasaron"], "*Es probable que* expresses possibility, so it takes the present subjunctive: *pasen*.", 2),
          q12.single(
            "Read the text, then answer.\n\n«En la España de hoy, el modelo de familia ya no es único. Las parejas tienen hijos más tarde que sus padres y cada vez hay más hogares con un solo adulto. Mi abuela se casó a los veinte años y tuvo cuatro hijos; mi madre tuvo a su primer hijo a los treinta y cinco. Ella dice que quería estabilidad económica antes de formar una familia. Mi abuela opina que esperar tanto es arriesgado, pero reconoce que las mujeres de su época tenían menos opciones.»\n\nWhy did the writer's mother wait until 35 to have a child?",
            "She wanted financial stability first.",
            ["She had fewer options than her mother.", "She was advised to wait by her doctor.", "She wanted a larger family."],
            "«Quería estabilidad económica antes de formar una familia.» It was the grandmother who had fewer options.",
            2,
          ),
          q12.multi("Choose the THREE expressions that are followed by the SUBJUNCTIVE.", ["Es una lástima que", "No creo que", "Es dudoso que"], ["Creo que", "Es evidente que"], "Regret, denied belief and doubt take the subjunctive. *Creo que* and *es evidente que* state a belief or fact, so they take the indicative.", 2),
          q12.single("What does *el envejecimiento de la población* mean?", "the ageing of the population", ["population growth", "the loss of old buildings", "the rise in birth rates"], "*Envejecer* means to grow old, so *el envejecimiento* is the process of ageing.", 2),
          q12.single(
            "Read the text, then answer.\n\n«Antes, un rumor tardaba días en llegar de un barrio a otro; hoy una noticia falsa da la vuelta al mundo en minutos. Las plataformas digitales prometieron democratizar la información, pero los algoritmos tienden a mostrarnos solo lo que ya pensamos, de modo que las opiniones se radicalizan. Algunos expertos piden que los colegios enseñen a verificar las fuentes; otros temen que ningún programa educativo pueda competir con la rapidez de un titular.»\n\nAccording to the writer, what is the effect of algorithms?",
            "People mostly see views they already hold, so opinions become more extreme.",
            ["News now travels more slowly between neighbourhoods.", "Schools no longer need to teach source checking.", "Platforms have made information more balanced."],
            "«Los algoritmos tienden a mostrarnos solo lo que ya pensamos, de modo que las opiniones se radicalizan.»",
            3,
          ),
          q12.single("Which sentence is correct?", "El hecho de que los jóvenes pasen horas en línea no significa que sean menos sociables.", ["El hecho de que los jóvenes pasen horas en línea no significa que son menos sociables.", "El hecho de que los jóvenes pasen horas en línea no significa que serán menos sociables.", "El hecho que los jóvenes pasen horas en línea no significa que sean menos sociables."], "After *no significa que* the subjunctive is needed (*sean*), and the phrase is *el hecho de que*, with *de*.", 3),
          q12.short("Complete with the correct form: «Aunque las redes sociales ___ (acercar) a las personas, también pueden aislarlas.» (a known fact)", "acercan", "*Aunque* takes the indicative when the speaker states a known fact, as here: *acercan*.", 3),
          q12.short("Translate into Spanish: Nowadays more and more couples decide not to get married.", "Hoy en día cada vez más parejas deciden no casarse.", "*Hoy en día* + *cada vez más parejas* + *deciden* + infinitive; *casarse* is reflexive and the pronoun attaches to the infinitive.", 3, { acc: hoy12 }),
          q12.written(
            "Write 90–110 words in Spanish. Discuss whether social media has improved or damaged relationships between people. Give two arguments, one counter-argument, and use at least two subjunctive constructions (for example es posible que, dudo que).",
            "Es posible que las redes sociales hayan mejorado la comunicación, pero dudo que hayan mejorado la calidad de las relaciones. Por un lado, permiten que amigos que viven lejos mantengan el contacto todos los días. Además, muchas personas tímidas encuentran comunidades que comparten sus intereses. No obstante, muchos jóvenes prefieren escribir a hablar, y eso puede provocar malentendidos. Aunque algunos defienden que las redes unen, creo que también pueden aislar, sobre todo cuando se sustituye el contacto real por una pantalla. Por consiguiente, lo ideal es que las usemos con moderación.",
            "Mark scheme (12 marks): argument and evidence 4 (two arguments, one counter-argument, a conclusion); use of the subjunctive and other complex structures 3; range of connectors and vocabulary 3; accuracy 2. Accept any defensible position.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["remote working", "el teletrabajo"],
        ["the digital divide", "la brecha digital"],
        ["family with one parent", "la familia monoparental"],
        ["nevertheless", "no obstante"],
        ["por consiguiente", "therefore, consequently"],
        ["es probable que + subjunctive", "it is likely that"],
        ["dudo que + subjunctive", "I doubt that"],
        ["hoax, fake news item", "el bulo"],
        ["el envejecimiento de la población", "the ageing of the population"],
        ["el hecho de que", "the fact that (never 'el hecho que')"],
      ]),
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13",
      yearsCovered: [13],
      objectives: [
        "Discuss equality and discrimination: gender, pay, race and other forms of inequality.",
        "Discuss immigration, integration and multicultural society in Spain and Latin America.",
        "Discuss regional identity, co-official languages and bilingualism in Spain.",
        "Use conjunctions that take the subjunctive (para que, a menos que, con tal de que) and subjunctive in relative clauses.",
        "Write a structured, evaluative argument and translate complex sentences.",
      ],
      note: {
        title: "Year 13: equality, migration and regional identity",
        body: `## Equality, migration and identity

At this level you should weigh causes and consequences and use precise vocabulary: *la igualdad de género, la brecha salarial* (pay gap), *el techo de cristal* (glass ceiling), *la discriminación, el racismo, la inmigración, el refugiado, la integración, la diversidad*. Be careful: *emigrar* = to leave a country; *inmigrar* = to arrive in one.

| Spanish | English |
| --- | --- |
| la desigualdad | inequality |
| los derechos humanos | human rights |
| el/la recién llegado/a | newcomer |
| las lenguas cooficiales | co-official languages |
| el bilingüismo | bilingualism |
| convivir | to live together |

## Conjunctions with the subjunctive

**Para que, a menos que, a no ser que, con tal de que, sin que, antes de que** ALWAYS take the subjunctive. **Cuando, en cuanto, hasta que** take it for the future. A **relative clause** takes the subjunctive when the person or thing is unknown or hypothetical: *Busco un piso que sea barato.*

- **Para que los recién llegados se sientan acogidos, la sociedad debe organizar actividades comunes.** = So that newcomers feel welcome, society must organise shared activities.
- **En España conviven varias lenguas cooficiales, como el catalán, el gallego y el euskera.** = Several co-official languages live side by side in Spain, such as Catalan, Galician and Basque.
- **A no ser que cambien las actitudes, las leyes no bastarán.** = Unless attitudes change, laws will not be enough.

## Common errors

1. **Realizar** means to carry out; "to realise" = **darse cuenta de** or *comprender*.
2. **Migrate** verbs: keep *emigrar / inmigrar* distinct.
3. **Sin que** takes the subjunctive: *sin que nadie lo sepa*.
4. Do not use a future after *cuando*: *cuando haya paz*.`,
      },
      quiz: {
        title: "Aspects of Society: Year 13 quiz",
        questions: [
          q13.single("What does *la desigualdad* mean?", "inequality", ["equality", "injustice in court", "the equator"], "The prefix *des-* reverses *igualdad* (equality), so *desigualdad* is inequality.", 1),
          q13.short("Translate into Spanish: immigrant.", "el inmigrante", "*Inmigrante* ends in -e, so it is the same for men and women: *el/la inmigrante*.", 1, { acc: ["la inmigrante", "inmigrante"] }),
          q13.single("What does *la brecha salarial* mean?", "the pay gap", ["the salary increase", "a wage cut", "the minimum wage"], "*Brecha* is gap and *salarial* is about pay: it is the pay gap, for example between men and women.", 2, true),
          q13.single("What does *el techo de cristal* mean in a discussion of equality?", "the glass ceiling", ["a glass roof", "a window cleaner", "a ceiling fan"], "It is a set expression for the invisible barrier that stops some groups (often women) from reaching top jobs.", 2),
          q13.single("Choose the correct form: «Para que la integración ___, es necesario que la sociedad participe.»", "funcione", ["funciona", "funcionará", "funcionó"], "*Para que* always takes the subjunctive. *Funcionar* → *funcione*.", 2, true),
          q13.single("Choose the correct form: «A menos que se ___ medidas, las tensiones aumentarán.»", "tomen", ["toman", "tomarán", "tomaron"], "*A menos que* always takes the subjunctive. The impersonal *se* agrees with the plural noun *medidas*: *se tomen*.", 2),
          q13.short("Complete with the correct form: «Es necesario que los recién llegados ___ el idioma.» (aprender)", "aprendan", "*Es necesario que* + present subjunctive. *Los recién llegados* is plural, so *aprendan*.", 2),
          q13.multi("Choose the THREE languages that have co-official status in some regions of Spain.", ["el catalán", "el gallego", "el euskera"], ["el portugués", "el quechua"], "Catalan, Galician and Basque (euskera) are co-official with Spanish in their regions. Portuguese and Quechua are not.", 2),
          q13.single(
            "Read the text, then answer.\n\n«En Cataluña, el País Vasco y Galicia, la lengua regional convive con el español en los colegios y en los medios. Para algunos padres, hablar dos lenguas desde niños es una ventaja; otros temen que sus hijos dominen peor el castellano. Los estudios sobre bilingüismo suelen señalar beneficios cognitivos, pero recuerdan que el resultado depende de cuánto contacto real tenga el niño con cada lengua.»\n\nWhat do the studies suggest?",
            "Results depend on how much real contact the child has with each language.",
            ["Bilingual children always do worse in Spanish than others.", "Bilingualism has no effect at all on the way the brain works.", "Children should study only one language until they are older."],
            "The studies point to «beneficios cognitivos» but stress that the outcome «depende de cuánto contacto real tenga el niño con cada lengua».",
            3,
          ),
          q13.single("Choose the correct form: «Buscamos una solución que ___ a todos los ciudadanos.»", "beneficie", ["beneficia", "beneficiará", "benefició"], "The solution is not yet known or guaranteed to exist, so the relative clause takes the subjunctive: *que beneficie*.", 3),
          q13.single("Which sentence means «I realised that inequality was growing»?", "Me di cuenta de que la desigualdad crecía.", ["Realicé que la desigualdad crecía.", "Me realicé que la desigualdad crecía.", "Realizé de que la desigualdad crecía."], "*Realizar* means to carry out, so it is a false friend. 'To realise' is *darse cuenta de*, and growth over time takes the imperfect.", 3),
          q13.short("Translate into Spanish: You will not find a job unless you speak Spanish.", "No encontrarás trabajo a menos que hables español.", "*A menos que* takes the subjunctive: *hables*. The main clause stays in the future: *no encontrarás*.", 3, { acc: sal13 }),
          q13.written(
            "Write 100–120 words in Spanish. Discuss whether immigration enriches society. Give two arguments and one counter-argument and use at least two conjunctions that take the subjunctive (para que, a menos que, con tal de que…).",
            "Creo que la inmigración enriquece a una sociedad siempre que se gestione bien. Por un lado, los inmigrantes aportan energía, trabajo y nuevas costumbres que hacen más rica la cultura. Por otro, muchos sectores, como la agricultura y los cuidados, dependen de ellos. No obstante, algunas personas temen que aumente la competencia por el empleo. Ahora bien, esto no ocurrirá con tal de que haya buenas políticas de formación. Para que la integración funcione, es necesario que los recién llegados aprendan el idioma y que los vecinos los acojan. A menos que se hagan esfuerzos por ambas partes, la desconfianza crecerá.",
            "Mark scheme (12 marks): argument and evidence 4; use of subjunctive after conjunctions 3; range of connectors and vocabulary 3; accuracy 2. Accept any well-argued position expressed respectfully.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["inequality", "la desigualdad"],
        ["the pay gap", "la brecha salarial"],
        ["the glass ceiling", "el techo de cristal"],
        ["emigrar / inmigrar", "to leave a country / to arrive in one"],
        ["para que + subjunctive", "so that, in order that"],
        ["a menos que + subjunctive", "unless"],
        ["darse cuenta de", "to realise (not realizar)"],
        ["las lenguas cooficiales", "co-official languages (catalán, gallego, euskera…)"],
        ["the newcomer", "el recién llegado"],
        ["to live together, coexist", "convivir"],
      ]),
    },
  },
};
