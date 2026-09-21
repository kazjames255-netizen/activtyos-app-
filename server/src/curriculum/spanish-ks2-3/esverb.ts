// Spanish — Grammar: Verbs & Tenses (Years 7–9). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const a = qb("esverb", 7);
const b = qb("esverb", 8);
const c = qb("esverb", 9);

export const TOPIC: CTopic = {
  key: "esverb",
  topic: "Grammar — Verbs & Tenses",
  subject: "Spanish",
  years: {
    7: {
      year: 7,
      objectives: [
        "Form the present tense of regular -ar, -er and -ir verbs.",
        "Use the irregular present forms of ser, estar, tener and ir.",
        "Use reflexive verbs with their pronouns (me levanto, se llama).",
        "Understand that verb endings show the subject, so subject pronouns are often left out.",
      ],
      note: {
        title: "Year 7: The present tense",
        body: `## Regular verbs

Take off **-ar / -er / -ir** and add the endings:

| | hablar (to speak) | comer (to eat) | vivir (to live) |
| --- | --- | --- | --- |
| yo | hablo | como | vivo |
| tú | hablas | comes | vives |
| él / ella | habla | come | vive |
| nosotros | hablamos | comemos | vivimos |
| vosotros (Spain) | habláis | coméis | vivís |
| ellos / ellas | hablan | comen | viven |

Because the ending shows who is acting, Spanish usually drops the pronoun: *hablo* = I speak.

## Four key irregular verbs

| | ser (to be) | estar (to be) | tener (to have) | ir (to go) |
| --- | --- | --- | --- | --- |
| yo | soy | estoy | tengo | voy |
| tú | eres | estás | tienes | vas |
| él / ella | es | está | tiene | va |
| nosotros | somos | estamos | tenemos | vamos |
| vosotros | sois | estáis | tenéis | vais |
| ellos / ellas | son | están | tienen | van |

Use **ser** for who or what someone is and where they are from (*soy inglés*), **estar** for where something is and how someone feels (*estoy en casa*).

## Reflexive verbs

The pronoun goes before the verb: **levantarse** = me levanto, te levantas, se levanta, nos levantamos, os levantáis, se levantan. *Me llamo* is the same verb type: **llamarse**.

## Model sentences

- Mi padre trabaja en una oficina y habla tres idiomas.
- Vivimos en un piso pequeño y mis primos viven cerca.
- Voy a la piscina con mis amigos. Mi hermana se llama Inés.

## Sound tip

A word ending in a vowel, **n** or **s** is stressed on the second-last syllable, so *HA-blo*, *HA-blas*, *HA-blan* and *ha-BLA-mos*. An accent mark shows an exception: *ha-BLÁIS*, *es-TÁS*, *es-TÁ*. The **h** is silent (*hablo* is "AB-lo") and **ll** is like y (*me llamo*).

## Common mistakes

- Wrong ending for the subject: *nosotros habla* should be **hablamos**.
- Using *ser* for a place: *mi casa es en Madrid* should be **está** en Madrid.
- Forgetting accents in irregular forms such as **estás**, **está** and **estáis**.`,
      },
      quiz: {
        title: "Verbs & Tenses: Year 7 quiz",
        questions: [
          a.single("Complete: Yo ___ en Madrid. (vivir)", "vivo", ["vives", "vive", "viven"], "With yo (I), the -ir verb vivir ends in -o: vivo.", 1),
          a.short("Complete: Nosotros ___ pizza. (comer)", "comemos", "With nosotros the -er ending is -emos: comemos.", 1),
          a.single("Which sentence means 'They are from Peru'?", "Son de Perú.", ["Están de Perú.", "Es de Perú.", "Eres de Perú."], "Origin uses ser, and 'they' is son.", 1),
          a.short("Complete: Tú ___ doce años. (tener)", "tienes", "Tener is irregular: tengo, tienes, tiene. With tú the form is tienes.", 2, { diag: true }),
          a.single("Complete: Mis amigos ___ al parque. (ir)", "van", ["vamos", "va", "voy"], "Ir is irregular: with 'ellos / mis amigos' the form is van.", 2),
          a.single("Which sentence means 'We are in the library'?", "Estamos en la biblioteca.", ["Somos en la biblioteca.", "Estáis en la biblioteca.", "Están en la biblioteca."], "Location uses estar, and 'we' is estamos. Estáis is 'you (plural)' and están is 'they'.", 2, true),
          a.multi("Which of these are present tense forms of 'comer'? Choose all that apply.", ["como", "comes", "comen"], ["comar", "comimos"], "Como, comes and comen are present forms. Comar does not exist, and comimos is not a present tense form of comer.", 2),
          a.single("Which sentence means 'I get up at seven'?", "Me levanto a las siete.", ["Se levanta a las siete.", "Te levantas a las siete.", "Levanto me a las siete."], "Reflexive yo form: me levanto, with the pronoun before the verb.", 2),
          a.single("Which sentence contains a mistake?", "Mis padres vive en Madrid.", ["Tú hablas español.", "Mi madre trabaja en un banco.", "Ana y yo comemos juntos."], "Mis padres is plural, so the verb must be viven, not vive.", 3),
          a.short("Complete: Mi hermana y yo ___ por la noche. (ducharse)", "nos duchamos", "Ducharse is reflexive: for nosotros the pronoun is nos and the verb is duchamos.", 3),
        ],
      },
      flashcards: cards([
        ["hablar: yo / tú", "hablo / hablas"],
        ["comer: nosotros", "comemos"],
        ["vivir: ellos", "viven"],
        ["ser: yo / tú / él", "soy / eres / es"],
        ["estar: yo / nosotros", "estoy / estamos"],
        ["tener: tú / ellos", "tienes / tienen"],
        ["I go (ir), in Spanish", "voy"],
        ["we are (estar), in Spanish", "estamos"],
        ["ser or estar? Where something is", "estar"],
        ["levantarse: yo", "me levanto"],
      ]),
    },
    8: {
      year: 8,
      objectives: [
        "Talk about the near future with ir a + infinitive.",
        "Form the pretérito perfecto (he + past participle), including common irregular participles.",
        "Form the pretérito indefinido (simple past) of regular verbs and of ir/ser, hacer and tener.",
        "Choose between the tenses using time expressions (mañana, esta semana, ayer).",
      ],
      note: {
        title: "Year 8: Near future and two past tenses",
        body: `## Near future: ir a + infinitive

*voy a, vas a, va a, vamos a, vais a, van a* + infinitive: *voy a nadar* (I'm going to swim). Time words: mañana, este fin de semana, la semana que viene.

## Pretérito perfecto: "I have done"

**he, has, ha, hemos, habéis, han** + past participle. Participles: -ar → **-ado** (hablado), -er / -ir → **-ido** (comido, vivido). The participle never changes. Irregular: **hecho** (hacer), **visto** (ver), **escrito** (escribir), **puesto** (poner), **dicho** (decir), **abierto** (abrir). Use with *hoy, esta semana, ya*.

## Pretérito indefinido: a finished action in the past

| | hablar | comer / vivir |
| --- | --- | --- |
| yo | hablé | comí / viví |
| tú | hablaste | comiste / viviste |
| él / ella | habló | comió / vivió |
| nosotros | hablamos | comimos / vivimos |
| vosotros | hablasteis | comisteis / vivisteis |
| ellos | hablaron | comieron / vivieron |

Irregular forms:

| | ir / ser | hacer | tener |
| --- | --- | --- | --- |
| yo | fui | hice | tuve |
| tú | fuiste | hiciste | tuviste |
| él / ella | fue | hizo | tuvo |
| nosotros | fuimos | hicimos | tuvimos |
| ellos | fueron | hicieron | tuvieron |

**Ir** and **ser** share the same forms in this tense: *fui* = I went or I was.

## Model sentences

- Este verano voy a aprender a nadar.
- Esta mañana he visto una película muy buena.
- Ayer mi hermano comió en casa y yo cené con mis abuelos. El sábado pasado fuimos al parque y tuvimos mucho calor.

## Sound tip

The accent tells you where the stress is: *ha-BLÉ* (I spoke) has the stress at the end, but *HA-blo* (I speak) does not. *Ha-BLÓ* (he spoke) also ends on the stressed syllable. In *hicimos* the **h** is silent and **c** before i is "th" in Spain ("s" in Latin America): "ee-THEE-mos".

## Common mistakes

- Dropping the accent, which changes the tense: **hablé** (I spoke) but *hablo* (I speak); **habló** (he spoke).
- Writing *voy comer* without the **a**.
- Making the participle agree or using the wrong irregular one: **he puesto**, not *he ponido*.`,
      },
      quiz: {
        title: "Verbs & Tenses: Year 8 quiz",
        questions: [
          b.single("Which sentence means 'I am going to eat'?", "Voy a comer.", ["Como.", "Comí.", "Voy comer."], "Near future = a form of ir + a + infinitive: voy a comer.", 1),
          b.short("Complete: Mis amigos ___ a venir mañana. (are going)", "van", "Ir a + infinitive: with mis amigos (they) the form is van.", 1),
          b.single("What is the past participle of 'hablar'?", "hablado", ["hablando", "hablido", "hablar"], "-ar verbs form the participle with -ado: hablado.", 1),
          b.single("Which means 'I have eaten'?", "He comido.", ["Comí.", "Ha comido.", "Voy a comer."], "He + comido = I have eaten. Ha comido is 'he/she has eaten', and comí is 'I ate'.", 2, true),
          b.single("Complete: Ayer ___ al cine. (ir, yo)", "fui", ["fue", "voy", "fuimos"], "Preterite of ir for yo is fui; fue is he/she, fuimos is we, and voy is present.", 2),
          b.short("Complete: Ayer ___ (comer, yo) una paella.", "comí", "Comer is regular in the preterite: yo → comí, with an accent on the í (write it if you can; 'comi' is accepted here).", 2, { diag: true }),
          b.multi("Which of these are irregular past participles? Choose all that apply.", ["hecho", "escrito", "visto"], ["hablado", "comido"], "Hecho, escrito and visto are irregular. Hablado and comido follow the -ado / -ido rule.", 2),
          b.single("Which is the correct preterite of 'hablar' for 'ellos'?", "hablaron", ["hablan", "hablé", "habló"], "-ar preterite endings: é, aste, ó, amos, asteis, aron. Ellos takes -aron.", 2),
          b.single("Which sentence has the wrong verb form?", "Hemos escribido una carta.", ["Mis amigos han comido pizza.", "Mi madre ha abierto la ventana.", "He hablado con ella."], "The past participle of escribir is irregular: escrito (hemos escrito).", 3),
          b.short("Complete: Anoche ___ (hacer, nosotros) los deberes.", "hicimos", "Hacer is irregular in the preterite: hice, hiciste, hizo, hicimos, hicisteis, hicieron.", 3),
        ],
      },
      flashcards: cards([
        ["I am going to swim, in Spanish", "Voy a nadar."],
        ["he hablado", "I have spoken"],
        ["past participle of comer", "comido"],
        ["hecho / visto / escrito", "done / seen / written"],
        ["hablar (yo, preterite)", "hablé"],
        ["vivir (él, preterite)", "vivió"],
        ["I went, in Spanish", "fui (also means I was)"],
        ["hice / tuve", "I did or made / I had"],
        ["Do ir and ser share preterite forms?", "Yes: fui, fuiste, fue, fuimos, fuisteis, fueron"],
        ["ayer / esta semana", "yesterday (preterite) / this week (perfect)"],
      ]),
    },
    9: {
      year: 9,
      objectives: [
        "Form and use the imperfect for habits, descriptions and background events in the past.",
        "Contrast the imperfect with the preterite.",
        "Form the conditional (infinitive + -ía endings) and use me gustaría / quisiera.",
        "Use gustar-type verbs (gustar, encantar, interesar, molestar) with indirect object pronouns.",
      ],
      note: {
        title: "Year 9: Imperfect, conditional and gustar-type verbs",
        body: `## The imperfect: "used to / was doing"

| | hablar | comer / vivir | ser | ir |
| --- | --- | --- | --- | --- |
| yo | hablaba | comía / vivía | era | iba |
| tú | hablabas | comías / vivías | eras | ibas |
| él / ella | hablaba | comía / vivía | era | iba |
| nosotros | hablábamos | comíamos / vivíamos | éramos | íbamos |
| ellos | hablaban | comían / vivían | eran | iban |

Use it for **habits** (*de pequeño, jugaba en el parque*), **descriptions** (*hacía sol, era alto*) and **background** (*llovía cuando salí*). The preterite is for a single finished event (*salí a las ocho*).

## The conditional: "would"

Infinitive + **-ía, -ías, -ía, -íamos, -íais, -ían**: *hablaría, comería, viviría*. Irregular stems: **haría** (hacer), **tendría** (tener), **podría** (poder). **Me gustaría + infinitive** = I would like to.

## Gustar-type verbs

The thing liked is the subject, so the verb agrees with it: **me / te / le / nos / os / les** + **gusta / gustan**. Same pattern: encanta(n), interesa(n), molesta(n), fascina(n).
- *A mi hermano le interesan los coches.* (My brother is interested in cars.)
- *A mis padres les molesta el ruido.* (The noise annoys my parents.)
- *A mí me encanta cantar.*

## Model sentences

- De pequeño, mis abuelos vivían en el campo y pasábamos allí todos los veranos.
- Cuando tenía diez años, siempre veía dibujos animados.
- Tendría un perro grande en mi casa.

## Sound tip

In **-ía** the i and the a are two separate syllables: *comía* is "ko-MEE-a", *hablaría* is "a-bla-REE-a". Without the accent *comia* would be said with one blended sound. **h** is silent and **ll** is like y (*llovía*).

## Common mistakes

- Choosing the preterite for a habit: for repeated past actions use **jugaba**, not *jugué*.
- Using **gusta** with a plural thing: *me gustan los coches*.
- Forgetting the accent on **-ía** endings: write **comía**, not *comia*.`,
      },
      quiz: {
        title: "Verbs & Tenses: Year 9 quiz",
        questions: [
          c.single("Which is the imperfect of 'hablar' for 'yo'?", "hablaba", ["hablé", "hablo", "hablaría"], "-ar imperfect endings: aba, abas, aba, ábamos, abais, aban. Yo takes -aba.", 1),
          c.short("Complete: De pequeño, yo ___ en el parque. (jugar)", "jugaba", "A habit in the past uses the imperfect: yo jugaba.", 1),
          c.single("Complete: A mí me ___ los deportes.", "gustan", ["gusta", "gusto", "gustas"], "Los deportes is plural, so the verb is gustan.", 1),
          c.single("Which means 'I would eat'?", "Comería.", ["Comía.", "Comí.", "Como."], "Conditional = infinitive + -ía: comería. Comía is 'I used to eat'.", 2, true),
          c.single("Which sentence uses the imperfect for a past habit?", "Cuando era niño, iba a la playa cada verano.", ["Ayer fui a la playa.", "Voy a ir a la playa.", "Hoy voy a la playa."], "'Cada verano' shows repeated action, and era / iba are imperfect forms.", 2),
          c.short("Complete: A mi hermana le ___ los gatos. (encantar)", "encantan", "Los gatos is plural, so the gustar-type verb takes -n: encantan.", 2, { diag: true }),
          c.multi("Which of these are imperfect forms? Choose all that apply.", ["comíamos", "era", "iban"], ["fueron", "comieron"], "Comíamos, era and iban are imperfect. Fueron and comieron are preterite.", 2),
          c.single("Which sentence means 'I would like to travel'?", "Me gustaría viajar.", ["Me gusta viajar.", "Me gustó viajar.", "Me gustaba viajar."], "Me gustaría is the conditional: would like. Me gusta is 'I like', me gustaba is 'I used to like'.", 2),
          c.single("'Llovía cuando llegué a casa.' Why is 'llovía' in the imperfect?", "It describes the background situation at the time.", ["It is a completed action that happened once.", "It is a future plan.", "It is a polite request."], "The rain was the ongoing scene (imperfect) while a single event (llegué) happened.", 3),
          c.short("Complete: Antes yo ___ en una casa grande, pero ahora vivo en un piso. (vivir)", "vivía", "'Antes' and 'ahora' contrast past and present: the past situation uses the imperfect vivía.", 3),
        ],
      },
      flashcards: cards([
        ["imperfect: hablar (yo)", "hablaba"],
        ["imperfect: comer (nosotros)", "comíamos"],
        ["I used to speak, in Spanish", "hablaba"],
        ["Use of the imperfect", "habits, descriptions, background in the past"],
        ["Use of the preterite", "a single finished event"],
        ["I would eat, in Spanish", "comería"],
        ["haría / tendría", "I would do / I would have"],
        ["Me gustaría + infinitive", "I would like to …"],
        ["A él le gustan los coches.", "He likes cars."],
        ["encanta / encantan", "loves (one thing) / loves (several things)"],
      ]),
    },
  },
};
