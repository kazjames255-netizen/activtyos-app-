// Spanish — Grammar & Structures (A-level, Years 12 and 13). Original content aligned to the DfE GCE modern foreign languages subject content (OGL v3.0).
// Reading / writing / grammar / vocabulary only. Checked by _check_l4.ts.
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q12 = qb("esgram5", 12);
const q13 = qb("esgram5", 13);

const cross = (...parts: string[][]) => parts.reduce<string[]>((acc, p) => acc.flatMap((a) => p.map((b) => a + b)), [""]);
const dam12 = ["Dámelo", "¡Dámelo!", "Dámelo."];
const sab13 = cross(["Si "], ["lo ", ""], ["hubiera ", "hubiese "], ["sabido, "], ["habría ", "hubiera ", "hubiese "], ["venido"]);

export const TOPIC: CTopic = {
  key: "esgram5",
  topic: "Grammar & Structures",
  subject: "Spanish",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12",
      yearsCovered: [12],
      objectives: [
        "Use direct, indirect and reflexive pronouns accurately, including order, le → se and position with infinitives, gerunds and imperatives.",
        "Use ser, estar and haber accurately, including adjectives whose meaning changes.",
        "Use por and para in a range of contexts.",
        "Form and use the gerund and the past participle, including estar/seguir/llevar + gerund and absolute participles.",
        "Use the present and perfect subjunctive after verbs of emotion, doubt and negation.",
      ],
      note: {
        title: "Year 12: pronouns, ser/estar/haber, gerund and participle, subjunctive",
        body: `## Object pronouns

Order: **indirect before direct** (*me lo, te la, nos los*). When *le/les* meets *lo/la/los/las*, it becomes **se**: *Le mostré la casa a Luis → Se la mostré.* Pronouns go **before** a conjugated verb, but are **attached** to an infinitive, a gerund and an affirmative command, often needing a written accent: *Quiero explicártelo despacio*, *dándomelo*, *Dímelo*. In a negative command they go before: *No me lo digas.*

## Ser, estar, haber

**Ser:** identity, job, origin, material, time, passive. **Estar:** location, state, result (*la puerta está cerrada*), progressive. **Haber:** existence (*hay*) and auxiliary (*he comido*). Some adjectives change meaning:

| With ser | With estar |
| --- | --- |
| listo = clever | listo = ready |
| malo = bad (character) | malo = ill |
| aburrido = boring | aburrido = bored |
| rico = wealthy | rico = tasty |

**Por:** duration, means, cause, exchange, on behalf of. **Para:** purpose, recipient, deadline, opinion, destination.

## Gerund and participle

The gerund ends -ando/-iendo (irregular: *leyendo, durmiendo, diciendo, yendo*). Use it with *estar, seguir, ir* and **llevar**: *Llevo dos años aprendiendo alemán.* A participle can be an adjective (*las ventanas abiertas*) or start a clause: **Hecha la maleta, se fueron al aeropuerto.** = Once the suitcase was packed, they left for the airport.

## Perfect subjunctive

*Haya + participle* after a present main verb, for a completed action: **No creo que hayan llegado todavía.**

## Common errors

*Le lo di* (should be *se lo di*); *estoy aburrido* vs *soy aburrido*; **position:** *no quiero lo hacer* is wrong; say *no quiero hacerlo* or *no lo quiero hacer*.`,
      },
      quiz: {
        title: "Grammar & Structures: Year 12 quiz",
        questions: [
          q12.single("Which pronoun replaces *el libro* (masculine singular) as a direct object?", "lo", ["la", "le", "los"], "*El libro* is masculine and singular, so the direct object pronoun is *lo*. *Le* is an indirect pronoun.", 1),
          q12.short("Give the gerund of *leer*.", "leyendo", "*Leer* is one of the verbs where -iendo becomes -yendo: *leyendo* (also *oyendo, creyendo*).", 1),
          q12.single("Complete: «Les enseñé las fotos a mis padres → ___ enseñé.»", "Se las", ["Les las", "Las se", "Se les"], "Two third-person pronouns cannot appear together, so *les* becomes *se*, and the direct object *las* follows it: *se las*.", 2, true),
          q12.single("Which sentence means «I am going to send it to him tomorrow»?", "Voy a mandárselo mañana.", ["Voy a mandarle lo mañana.", "Voy a se lo mandar mañana.", "Voy a mandar se lo mañana."], "Pronouns attach to the infinitive: *mandar* + *se* + *lo*, and a written accent keeps the stress: *mandárselo*.", 2),
          q12.single("Choose the correct verb: «Mi hermano ___ muy listo, por eso siempre saca buenas notas.»", "es", ["está", "son", "estaba"], "*Listo* with *ser* means clever (a lasting quality). With *estar* it would mean 'ready'.", 2, true),
          q12.single("Choose the correct verb: «___ dos bancos en la plaza.»", "Hay", ["Están", "Son", "Es"], "*Hay* introduces what exists and never changes for singular or plural. *Están* needs a definite subject: *los bancos están…*", 2),
          q12.short("Complete with the gerund: «Los niños están ___ (dormir).»", "durmiendo", "In the gerund of -ir stem-changing verbs o becomes u: *durmiendo*.", 2),
          q12.single("Choose the correct form: «Llevo tres años ___ chino.»", "estudiando", ["estudio", "estudiar", "estudiado"], "*Llevar* + time + gerund means 'I have been doing something for…'.", 2),
          q12.single("Choose the correct form: «Me alegro de que Marta ___ aprobado el examen.»", "haya", ["ha", "había", "hubiera"], "Emotion (*me alegro de que*) takes the subjunctive. A completed action uses the perfect subjunctive: *haya aprobado*.", 2),
          q12.single("Choose the correct pair: «Pagué veinte euros ___ el libro, que es ___ mi hermana.»", "por … para", ["para … por", "por … por", "para … para"], "*Por* is used for an exchange (paying for something) and *para* for the recipient.", 2),
          q12.single("Which sentence means «Once the work was finished, we went out to dinner»?", "Terminado el trabajo, salimos a cenar.", ["Terminando el trabajo, salimos a cenar.", "Terminó el trabajo, salimos a cenar.", "Terminar el trabajo, salimos a cenar."], "The absolute participle *terminado* (agreeing with *el trabajo*) means 'once finished'. The gerund *terminando* would mean 'while finishing'.", 3),
          q12.short("Translate into Spanish (informal, one word): Give it to me!", "Dámelo", "The command *da* + *me* + *lo*: the pronouns attach in the order indirect, direct. The accent keeps the stress on *dá-*.", 3, { accents: true, acc: dam12 }),
          q12.written(
            "Translate into Spanish (use tú for 'you'; watch pronouns and accents):\n1. I have been living in Madrid for two years.\n2. I am glad that you have come.\n3. She gave it to them yesterday.",
            "1. Llevo dos años viviendo en Madrid. (or: Vivo en Madrid desde hace dos años.) 2. Me alegro de que hayas venido. 3. Ella se lo dio ayer.",
            "Mark scheme (6 marks, 2 per sentence): 1. llevar + time + gerund, or desde hace + present; 2. me alegro de que + perfect subjunctive (hayas/haya venido); 3. se lo dio (le → se before lo; preterite of dar without accent). Award 1 mark for a correct structure with one error.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["le + lo / la / los / las", "se lo / se la / se los / se las"],
        ["I'm going to buy it for you", "Voy a comprártelo (pronouns attach to the infinitive)"],
        ["Dímelo / No me lo digas", "Tell me it / Don't tell me it"],
        ["to be clever / to be ready", "ser listo / estar listo"],
        ["ser malo / estar malo", "to be bad / to be ill"],
        ["hay vs están", "hay = there is/are (indefinite); están = they are (located)"],
        ["gerund of leer / dormir / decir", "leyendo / durmiendo / diciendo"],
        ["llevar + time + gerund", "to have been doing something for (a period)"],
        ["por vs para: purpose", "para (para ayudar); por = cause, exchange, duration"],
        ["me alegro de que + haya + participle", "I'm glad that (something) has happened"],
      ]),
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13",
      yearsCovered: [13],
      objectives: [
        "Form and use the imperfect subjunctive (-ra and -se forms) and the pluperfect subjunctive.",
        "Use the sequence of tenses (concordancia de tiempos) between main and subordinate clauses.",
        "Use si-clauses with the imperfect subjunctive and conditional, and with the pluperfect subjunctive and conditional perfect.",
        "Use como si, ojalá and subjunctive in relative clauses with an indefinite or hypothetical antecedent.",
        "Translate complex sentences accurately.",
      ],
      note: {
        title: "Year 13: the imperfect subjunctive, si-clauses and tense sequence",
        body: `## The imperfect subjunctive

Take the **ellos form of the preterite**, remove -ron and add **-ra, -ras, -ra, -ramos, -rais, -ran** (or the -se forms: -se, -ses, -se, -semos…). *Hablaron → hablara; tuvieron → tuviera; dijeron → dijera; fueron → fuera; pidieron → pidiera.* The *nosotros* form has an accent: *habláramos*.

## Sequence of tenses

| Main verb | Subordinate verb |
| --- | --- |
| present, future, perfect, imperative | present or perfect subjunctive: *Quiero que vengas; Dudo que haya venido.* |
| preterite, imperfect, conditional, pluperfect | imperfect or pluperfect subjunctive: *Quería que vinieras; Dudaba que hubiera venido.* |

## Conditional sentences

- **Si + present, future** (real): *Si llueve, me quedaré en casa.*
- **Si + imperfect subjunctive, conditional** (unlikely or unreal now): *Si viviera en la costa, iría a la playa cada día.*
- **Si + pluperfect subjunctive, conditional perfect** (unreal past): *Si hubiera salido antes, habría llegado a tiempo.* (*habría* + participle)

**Never** use *-ría* after *si*: *Si vendría* is wrong.

## Other uses

- **Ojalá viviera más cerca de mis amigos.** = If only I lived closer to my friends.
- **Se comporta como si nada hubiera pasado.** = He behaves as if nothing had happened. (*como si* takes the imperfect or pluperfect subjunctive)
- **Mis abuelos querían que viviéramos cerca.** = My grandparents wanted us to live nearby.
- **Relative clause** with an unknown person or thing: *Busco un piso que tenga terraza.* / *Buscaba un piso que tuviera terraza.*

## Common errors

*Quería que vienes* (use *vinieras*); *si vendría* (use *viniera*); *Ojalá vivo* (use *viva* or *viviera*).`,
      },
      quiz: {
        title: "Grammar & Structures: Year 13 quiz",
        questions: [
          q13.single("Which verb form is the imperfect subjunctive built from?", "the ellos form of the preterite", ["the yo form of the present", "the infinitive", "the nosotros form of the imperfect"], "Take *hablaron*, remove -ron and add -ra: *hablara*. This is why irregular preterites give irregular subjunctives.", 1),
          q13.short("Give the imperfect subjunctive (-ra form) of *hablar* for *yo*.", "hablara", "*Hablar* → preterite *hablaron* → drop -ron → *habla-* + *-ra* = *hablara*.", 1, { acc: ["hablase"] }),
          q13.single("Complete: «Si tuviera dinero, ___ por el mundo.»", "viajaría", ["viajaré", "viajo", "viajaba"], "*Si* + imperfect subjunctive expresses an unlikely condition, so the result is in the conditional: *viajaría*.", 2, true),
          q13.single("Choose the correct form: «Mi madre quería que yo ___ piano en el conservatorio.» (estudiar)", "estudiara", ["estudie", "estudiaba", "estudiaría"], "The main verb *quería* is in a past tense, and *querer que* needs the subjunctive, so the imperfect subjunctive *estudiara* follows.", 2, true),
          q13.single("Choose the correct form: «Dudaba que Marta ___ llegar a tiempo.» (poder)", "pudiera", ["pueda", "podía", "podrá"], "*Dudaba* is a past tense, so the subordinate verb is the imperfect subjunctive: *pudieron → pudiera*.", 2),
          q13.short("Complete with the imperfect subjunctive: «Si yo ___ (ser) tú, hablaría con el jefe.»", "fuera", "*Ser* uses the same preterite as *ir*: *fueron* → *fuera* (or *fuese*).", 2, { acc: ["fuese"] }),
          q13.single("Which is the imperfect subjunctive (-ra) of *hacer* for *ellos*?", "hicieran", ["hacieran", "hicieron", "harían"], "*Hacer* has the irregular preterite *hicieron*, so the subjunctive is *hicieran*, not *hacieran*.", 2),
          q13.single("Choose the correct form: «Ojalá ___ más tiempo libre.» (I wish I had…)", "tuviera", ["tengo", "tendría", "tenía"], "*Ojalá* + imperfect subjunctive expresses a wish that is unlikely to come true now.", 2),
          q13.single("Choose the correct form: «Habla como si ___ el dueño de la empresa.»", "fuera", ["es", "será", "sea"], "*Como si* always takes the imperfect (or pluperfect) subjunctive.", 2),
          q13.single("Choose the correct form: «Si hubieras estudiado más, ___ el examen.»", "habrías aprobado", ["aprobarías", "aprobabas", "habías aprobado"], "*Si* + pluperfect subjunctive is answered by the conditional perfect: *habrías aprobado*.", 3),
          q13.single("Choose the correct form: «Necesitábamos un profesor que ___ chino.»", "hablara", ["hablaba", "habla", "hablaría"], "The teacher is not yet identified, so the relative clause takes the subjunctive, in the imperfect after *necesitábamos*.", 3),
          q13.single("Which sentence is INCORRECT?", "Si tendría tiempo, iría al cine.", ["Si tuviera tiempo, iría al cine.", "Si hubiera tenido tiempo, habría ido al cine.", "Si tengo tiempo, iré al cine."], "The conditional is never used after *si*: it should be *si tuviera*. The other sentences are correct.", 2),
          q13.short("Translate into Spanish: If I had known, I would have come.", "Si lo hubiera sabido, habría venido.", "*Si* + pluperfect subjunctive (*hubiera sabido*), then the conditional perfect (*habría venido*).", 3, { acc: sab13 }),
          q13.written(
            "Write 100–120 words in Spanish about how your life would be different if you lived in another country or had a different job. Use at least three imperfect-subjunctive constructions (for example si + imperfect subjunctive + conditional, ojalá, como si, quería que…).",
            "Si viviera en Chile, hablaría español todos los días y conocería mejor la cultura. Ojalá pudiera pasar un año allí, porque de pequeña quería que mi vida fuera más aventurera. Mis padres preferirían que estudiara aquí, pero si tuviera la oportunidad, me iría sin dudarlo. Sé que echaría de menos a mi familia, aunque hablaríamos por videollamada como si estuviéramos en la misma habitación. Si hubiera nacido en otro país, quizá habría tenido una vida muy diferente, pero no cambiaría a mis amigos por nada.",
            "Mark scheme (12 marks): at least three correct subjunctive constructions with the right sequence of tenses 5; use of the conditional 2; content and coherence 3; accuracy including accents 2. Accept any sensible content.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["hablaron → …", "hablara (imperfect subjunctive: drop -ron, add -ra)"],
        ["tuvieron → …", "tuviera"],
        ["fueron → …", "fuera (ser and ir)"],
        ["dijeron → …", "dijera"],
        ["si + imperfect subjunctive → …", "conditional (si tuviera tiempo, viajaría)"],
        ["si + pluperfect subjunctive → …", "conditional perfect (si hubiera sabido, habría venido)"],
        ["como si + …", "imperfect or pluperfect subjunctive"],
        ["quería que + …", "imperfect subjunctive (quería que vinieras)"],
        ["If only I had… (an unlikely wish)", "ojalá tuviera…"],
        ["Correct or wrong: «si vendría pronto»?", "Wrong: never use the conditional after si (si viniera pronto)"],
      ]),
    },
  },
};
