// Spanish — Grammar: Advanced Verbs & Structures (GCSE, Years 10 and 11). Original content aligned to the DfE GCSE modern foreign languages subject content (OGL v3.0).
// Reading / writing / grammar / vocabulary only. Checked by _check_l4.ts.
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q10 = qb("esgram4", 10);
const q11 = qb("esgram4", 11);

const cross = (...parts: string[][]) => parts.reduce<string[]>((acc, p) => acc.flatMap((a) => p.map((b) => a + b)), [""]);
const tv10 = cross(["Veía", "Estaba viendo", "Miraba", "Estaba mirando"], [" la tele", " la televisión"], [" cuando llegó "], ["mi amigo", "mi amiga", "un amigo", "una amiga"]);
const par11 = cross(["Mis padres quieren que ", "Mis padres quieren que yo "], ["estudie medicina"]);

export const TOPIC: CTopic = {
  key: "esgram4",
  topic: "Grammar — Advanced Verbs & Structures",
  subject: "Spanish",
  years: {
    10: {
      year: 10,
      subtopic: "GCSE Year 10",
      yearsCovered: [10],
      objectives: [
        "Form and use the present, preterite, imperfect, perfect, future and conditional tenses, including common irregular verbs and stem-changing verbs.",
        "Use reflexive verbs in different tenses.",
        "Distinguish ser and estar.",
        "Distinguish por and para.",
        "Translate short sentences into Spanish with accurate verb forms and accents.",
      ],
      note: {
        title: "Year 10: the six tenses, ser/estar and por/para",
        body: `## The six tenses

| Tense | How to form it | Example |
| --- | --- | --- |
| Present | -o, -as/-es, -a/-e … | vivo, comes |
| Preterite | -é, -aste, -ó, -amos, -asteis, -aron / -í, -iste, -ió … | hablé, comió |
| Imperfect | -aba … / -ía … | hablaba, comía |
| Perfect | he / has / ha + participle | he hablado |
| Future | infinitive + -é, -ás, -á, -emos, -éis, -án | hablaré |
| Conditional | infinitive + -ía, -ías, -ía, -íamos, -íais, -ían | hablaría |

**Irregular preterites:** *fui* (ser/ir), *hice, tuve, estuve, dije, puse, pude, vine, quise, di, vi*. Note the single-syllable forms have no accent. **Stem-changing -ir verbs** change in the *él/ellos* forms: *pidió, durmieron*.

**Irregular stems** (future and conditional): *tendr-, har-, dir-, podr-, sabr-, pondr-, vendr-, saldr-, habr-*. **Irregular participles:** *hecho, dicho, visto, escrito, puesto, abierto, vuelto, roto*.

**Reflexives** put the pronoun before the verb: *me levanto, te duchas*; perfect: *me he despertado*.

## Ser or estar? Por or para?

- **Ser:** identity, origin, job, permanent traits, time. **Estar:** location, temporary states, feelings, *estar* + gerund. *Madrid es la capital y está en el centro de España.*
- **Por:** cause, exchange, through, duration. **Para:** purpose, destination, deadline, recipient. *Este regalo es para mi madre; lo compré por internet.*

## Model sentences

- **Esta mañana me he despertado a las seis.** = This morning I woke up at six.
- **Mañana saldré temprano y tendré que coger el autobús.** = Tomorrow I will leave early and will have to catch the bus.

## Common errors

*Yo prefero* (should be *prefiero*), *hací* (should be *hice*), *ha hacido* (should be *ha hecho*).`,
      },
      quiz: {
        title: "Grammar — Advanced Verbs & Structures: Year 10 quiz",
        questions: [
          q10.single("What is the *yo* form of *tener* in the present tense?", "tengo", ["tiengo", "teno", "tenzo"], "*Tener* is irregular in the *yo* form only: *tengo*. The other persons change the stem (*tienes, tiene*) but not this one.", 1),
          q10.short("Give the past participle of *escribir* (as used after *he*).", "escrito", "*Escribir* has an irregular participle: *he escrito*, not *escribido*.", 1),
          q10.single("Choose the correct form: «Ayer mis padres ___ una pizza.» (pedir)", "pidieron", ["pedieron", "pidían", "pedían"], "In the preterite, -ir stem-changing verbs change e → i in the *él* and *ellos* forms: *pidió, pidieron*.", 2, true),
          q10.short("Complete with the future tense: «Mañana ___ (yo, tener) que estudiar.»", "tendré", "*Tener* has an irregular future stem *tendr-*, then the usual endings: *tendré*.", 2),
          q10.single("Choose the correct pair: «Mi tío ___ ingeniero, pero hoy ___ enfermo.»", "es … está", ["está … es", "es … es", "está … está"], "*Ser* is used for jobs and *estar* for a temporary state, such as being ill today.", 2, true),
          q10.single("Which sentence uses the present tense of a stem-changing verb correctly?", "Yo prefiero el té y mis padres prefieren el café.", ["Yo prefero el té y mis padres prefieren el café.", "Yo prefiero el té y mis padres preferen el café.", "Yo prefiero el té y mis padres prefirien el café."], "*Preferir* changes e → ie in the present, except in *nosotros* and *vosotros*: *prefiero, prefieren*.", 2),
          q10.multi("Choose the THREE correct *yo* forms of the preterite.", ["tuve", "puse", "dije"], ["hací", "sabí"], "*Tuve, puse* and *dije* are the irregular preterites of *tener, poner* and *decir*. The forms *hací* and *sabí* do not exist (*hice, supe*).", 2),
          q10.single("Choose the correct form: «Ayer ___ temprano y no desayuné.»", "me levanté", ["me levanto", "se levantó", "levantaba"], "*Ayer* needs the preterite, and *levantarse* is reflexive, so *me levanté* (I got up).", 2),
          q10.single("Which form means «we would travel»?", "viajaríamos", ["viajaremos", "viajábamos", "viajamos"], "The conditional is the infinitive + -íamos: *viajar* + *íamos*. *Viajaremos* is 'we will travel'.", 2),
          q10.single("Which sentence is correct?", "Todavía no he hecho los deberes.", ["Todavía no he hacido los deberes.", "Todavía no he hago los deberes.", "Todavía no he haciendo los deberes."], "The perfect tense uses *he* + participle, and the participle of *hacer* is irregular: *hecho*.", 3),
          q10.single("Which sentence means «I was studying when the phone rang»?", "Estudiaba cuando sonó el teléfono.", ["Estudié cuando sonaba el teléfono.", "Estoy estudiando cuando sonó el teléfono.", "Estudiaré cuando sonó el teléfono."], "The longer, background action takes the imperfect (*estudiaba*); the interruption takes the preterite (*sonó*).", 3),
          q10.short("Translate into Spanish: I was watching TV when my friend arrived.", "Veía la tele cuando llegó mi amigo.", "Imperfect for the ongoing action (*veía* or *estaba viendo*) and preterite for the interruption (*llegó*). The accent on *llegó* matters: *llego* means 'I arrive'.", 3, { accents: true, acc: tv10 }),
          q10.single("Choose the correct pair: «Fui a la tienda ___ comprar pan y pagué dos euros ___ una barra.»", "para … por", ["por … para", "por … por", "para … para"], "*Para* + infinitive gives a purpose ('in order to buy'); *por* is used for an exchange (paying for something).", 3),
        ],
      },
      flashcards: cards([
        ["tengo / tienes / tiene", "I have / you have / he has (tener, present)"],
        ["preterite: hacer (yo)", "hice"],
        ["preterite: tener (yo)", "tuve"],
        ["preterite: pedir (ellos)", "pidieron"],
        ["future stem of hacer", "har- (haré, harás…)"],
        ["participle of escribir / ver / hacer", "escrito / visto / hecho"],
        ["I got up (reflexive, preterite)", "me levanté"],
        ["ser or estar? location and temporary feelings", "estar"],
        ["por or para? purpose (in order to)", "para"],
        ["I used to sing / I used to eat", "cantaba / comía (imperfect endings -aba / -ía)"],
      ]),
    },
    11: {
      year: 11,
      subtopic: "GCSE Year 11",
      yearsCovered: [11],
      objectives: [
        "Form and use the present subjunctive after querer que, esperar que, es importante que and cuando (future reference).",
        "Form and use the pluperfect tense.",
        "Use the passive (ser + participle) and the impersonal/reflexive passive with se.",
        "Use si-clauses (si + present + future) and recognise imperfect-subjunctive si-clauses.",
        "Use relative pronouns que, quien, lo que and cuyo.",
      ],
      note: {
        title: "Year 11: subjunctive, pluperfect, passive, si-clauses and relatives",
        body: `## The present subjunctive

To form it, take the *yo* form of the present, drop -o and add the "opposite" endings: -ar verbs take -e, -es, -e, -emos, -éis, -en; -er/-ir verbs take -a, -as, -a, -amos, -áis, -an. *Hablar* → *hable*; *tener* → *tenga*; *salir* → *salga*. Irregular: *ser* → **sea**, *ir* → **vaya**, *estar* → **esté**, *saber* → **sepa**, *dar* → **dé**, *haber* → **haya**.

Use it when the subject changes after **querer que, esperar que, es importante/necesario/posible que, para que** and **cuando** with future meaning:
- **Mi profesora quiere que leamos más novelas.**
- **Cuando llegue a casa, te llamaré.**

With the same subject use the infinitive: *quiero salir*, not *quiero que salgo*.

## Other structures

| Structure | Formation | Example |
| --- | --- | --- |
| Pluperfect | había + participle | Ya habíamos cenado cuando llamó Ana. |
| Passive | ser + participle (agrees) + por | La carta fue escrita por mi abuelo. |
| Impersonal *se* | se + verb (agrees with noun) | En esta región se cultivan naranjas. |
| *Si*-clause | si + present, future | Si tengo tiempo, te ayudaré. |

**Recognise:** *Si tuviera dinero, viajaría* (If I had money, I would travel): *tuviera* is the imperfect subjunctive, studied at A-level.

**Relative pronouns:** *que* (who, which, that), *quien(es)* (who, after a preposition or comma), *lo que* (what, which), *cuyo* (whose; agrees with the thing owned): *La chica que vive al lado es mi prima.*

## Common errors

*Quiero que voy* (use *vaya*), *si lloverá* (use *si llueve*), *la gente son* (use *es*).`,
      },
      quiz: {
        title: "Grammar — Advanced Verbs & Structures: Year 11 quiz",
        questions: [
          q11.single("Which auxiliary verb + participle forms the PLUPERFECT tense?", "había + participle", ["he + participle", "estaba + participle", "fui + participle"], "The pluperfect uses the imperfect of *haber*: *había, habías, había, habíamos, habíais, habían* + participle.", 1),
          q11.short("Complete with the present subjunctive: «Espero que él ___ pronto.» (hablar)", "hable", "*Hablar* is an -ar verb, so the subjunctive takes the 'opposite' -e ending: *hable*.", 1, { accents: true }),
          q11.single("Choose the correct form: «Quiero que tú ___ conmigo.»", "vengas", ["vienes", "venir", "vendrás"], "*Querer que* + a new subject needs the present subjunctive. *Venir* → *yo vengo* → *vengas*.", 2, true),
          q11.single("Which sentence means «It is important that we eat well»?", "Es importante que comamos bien.", ["Es importante que comemos bien.", "Es importante que comer bien.", "Es importante que comeremos bien."], "*Es importante que* + present subjunctive: *comer* → *coma, comas, coma, comamos…*", 2),
          q11.single("Choose the correct form: «Cuando ___ mis exámenes, iré de vacaciones.» (terminar)", "termine", ["termino", "terminaría", "terminaré"], "*Cuando* with a future meaning takes the subjunctive: *cuando termine* (when I finish).", 2),
          q11.single("Choose the correct form: «Cuando llegué a la estación, el tren ya ___ salido.»", "había", ["ha", "hubo", "estaba"], "The train left BEFORE another past event, so use the pluperfect: *había salido*.", 2, true),
          q11.single("Which sentence means «Spanish is spoken in Chile»?", "En Chile se habla español.", ["En Chile se hablan español.", "En Chile hablamos español.", "En Chile se habló español."], "The *se* passive uses the third person, agreeing with the thing spoken. *Español* is singular, so *se habla*.", 2),
          q11.short("Complete with the correct verb form: «En esta tienda se ___ zapatos de piel.» (vender)", "venden", "In the *se* passive, the verb agrees with the noun that follows: *zapatos* is plural, so *venden*.", 2),
          q11.single("Choose the correct form: «Si ___ mañana, no iremos a la playa.» (llover)", "llueve", ["lloverá", "lloviera", "llovería"], "For a real future possibility, use *si* + present + future. Never put a future tense after *si*.", 2),
          q11.single("Choose the correct word: «Mi amiga, ___ padre es médico, vive en Lima.»", "cuyo", ["cuya", "que", "quien"], "*Cuyo* means 'whose' and agrees with the thing owned (*padre*, masculine), not with the owner.", 3),
          q11.single("Choose the correct form: «Es importante que ellos ___ la verdad.» (saber)", "sepan", ["saben", "sabrán", "sepen"], "*Saber* has an irregular subjunctive stem *sep-*: *sepa, sepas, sepa, sepamos, sepáis, sepan*.", 3),
          q11.single("Choose the correct form: «La catedral fue ___ en el siglo XIII.»", "construida", ["construido", "construidas", "construyendo"], "In the passive with *ser*, the participle agrees with the subject: *la catedral* is feminine singular, so *construida*.", 3),
          q11.short("Translate into Spanish: My parents want me to study medicine.", "Mis padres quieren que estudie medicina.", "The subject changes (parents → me), so *querer que* takes the subjunctive: *estudie*. The accent matters: *estudié* would be the preterite.", 3, { accents: true, acc: par11 }),
          q11.written(
            "Write 70–90 words in Spanish about your ideal future. Say what you hope will happen (Espero que…), what your family wants you to do (Mis padres quieren que…), and include one si-clause with the present and future (Si… , …).",
            "Espero que el mundo sea más justo cuando termine mis estudios. Mis padres quieren que estudie medicina, pero yo prefiero ser profesora de música. Es importante que cada persona haga un trabajo que le guste. Si saco buenas notas en junio, podré elegir la universidad. Cuando tenga dinero, viajaré por América del Sur y aprenderé de otras culturas. Me han dicho que en Chile se cantan canciones preciosas en las calles.",
            "Mark scheme (10 marks): use of the present subjunctive accurately after espero que, quieren que, es importante que or cuando 4; a correct si + present + future 2; content and range (opinions, tenses, connectors) 2; overall accuracy including accents 2. Accept any sensible content.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["hablar → subjunctive (él)", "hable"],
        ["tener → subjunctive (yo)", "tenga"],
        ["ser / ir / estar → subjunctive (yo)", "sea / vaya / esté"],
        ["saber / dar / haber → subjunctive (yo)", "sepa / dé / haya"],
        ["quiero que + …", "subjunctive when the subject changes (quiero que vengas)"],
        ["cuando + future meaning", "subjunctive: cuando llegue"],
        ["pluperfect", "había + participle (ya había salido)"],
        ["Houses are sold / houses for sale (se passive)", "se venden casas (the verb agrees with the noun)"],
        ["si + present → …", "future: si estudias, aprobarás"],
        ["cuyo / cuya", "whose (agrees with the thing owned)"],
      ]),
    },
  },
};
