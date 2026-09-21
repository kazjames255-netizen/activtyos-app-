// Spanish — Current & Future Study and Employment (GCSE, Years 10 and 11). Original content aligned to the DfE GCSE modern foreign languages subject content (OGL v3.0).
// Reading / writing / grammar / vocabulary only. Checked by _check_l4.ts.
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q10 = qb("eswork", 10);
const q11 = qb("eswork", 11);

const cross = (...parts: string[][]) => parts.reduce<string[]>((acc, p) => acc.flatMap((a) => p.map((b) => (a + b))), [""]);
const subj10 = cross(["Mi asignatura ", "Mi materia "], ["favorita ", "preferida "], ["es la geografía porque "], ["el profesor ", "el profe "], ["es muy "], ["gracioso", "divertido", "simpático"]);
const fut11 = [
  ...cross(["En el futuro ", "En el futuro, ", "De mayor, "], ["me gustaría tener "], ["mi propia empresa", "mi propio negocio", "un negocio propio", "una empresa propia"]),
  ...cross(["Me gustaría tener "], ["mi propia empresa", "mi propio negocio", "un negocio propio", "una empresa propia"], [" en el futuro"]),
];

export const TOPIC: CTopic = {
  key: "eswork",
  topic: "Current & Future Study and Employment",
  subject: "Spanish",
  years: {
    10: {
      year: 10,
      subtopic: "GCSE Year 10",
      yearsCovered: [10],
      objectives: [
        "Describe school life: subjects, timetable, facilities, rules and uniform, with opinions and reasons.",
        "Talk about exams, homework and success at school.",
        "Express obligation with tener que, deber, hay que and poder.",
        "Use desde hace + present to say how long something has been happening.",
        "Read short texts about school and translate short sentences into Spanish.",
      ],
      note: {
        title: "Year 10: school life, rules and study plans",
        body: `## Talking about school

In Spain, *el colegio* is usually primary school and *el instituto* is secondary school. Give opinions with reasons: *porque el profesor lo explica bien / me parece útil / es demasiado difícil*. Subjects: *el inglés, la física, la historia, las matemáticas*.

| Spanish | English |
| --- | --- |
| la asignatura / la materia | school subject |
| el horario, el recreo | timetable, break |
| los deberes | homework |
| aprobar / suspender | to pass / to fail (an exam) |
| las notas | marks, grades |
| los apuntes | class notes |
| el uniforme, las normas | uniform, rules |
| tener que / deber / hay que + inf. | to have to / must / one must |

## Useful structures

- **Debo entregar los trabajos a tiempo.** = I must hand in my work on time.
- **En nuestro instituto no está permitido comer en clase.** = In our school it is not allowed to eat in class.
- **Voy a hacer un curso de fotografía en verano.** = I am going to do a photography course in the summer.
- **Vivo aquí desde hace tres años.** = I have lived here for three years. (*desde hace* + **present tense**)

## Common errors

1. **Suspender** means to fail, not "suspend".
2. **Asistir a** means to attend; *atender* means to serve or pay attention.
3. **Desde hace**: use the present: *estudio francés desde hace dos años*, not *he estudiado*.
4. Subjects with *el/la*: *me encanta la historia*, *estudio el inglés*.
5. **Hacer un examen** is fine, but *presentarse a un examen* sounds more formal.

**Tip:** *el profe* is the friendly short form of *el profesor*; use it in informal writing only.`,
      },
      quiz: {
        title: "Current & Future Study and Employment: Year 10 quiz",
        questions: [
          q10.single("What does *aprobar un examen* mean?", "to pass an exam", ["to fail an exam", "to approve of an exam", "to sit an exam"], "*Aprobar* means to pass an exam. It is not 'to approve of' something, although it looks like it.", 1),
          q10.short("Translate into Spanish: maths (the school subject).", "las matemáticas", "The subject is plural in Spanish: *las matemáticas*.", 1, { acc: ["matemáticas", "las mates", "mates"] }),
          q10.single("Complete: «Tengo que ___ muchos deberes hoy.»", "hacer", ["hago", "haciendo", "hice"], "*Tener que* is always followed by an infinitive: *hacer*.", 2, true),
          q10.single("Read: «Mi hermano ha suspendido el examen de física.» What has happened?", "He has failed the physics exam.", ["He has been suspended from school.", "He has passed the physics exam.", "The physics exam has been postponed."], "*Suspender* is 'to fail' an exam, a false friend of 'suspend'.", 2),
          q10.single(
            "Read the text, then answer.\n\n«En mi instituto no se puede usar el móvil durante las clases y hay que llevar uniforme: una camiseta blanca y un jersey azul. Pienso que el uniforme es buena idea porque todos somos iguales, pero no soporto el jersey: es demasiado grueso y da calor. Lo que más me gusta es el patio, donde jugamos al baloncesto durante el recreo, que dura veinte minutos.»\n\nWhat does the writer dislike?",
            "The blue jersey, because it is thick and hot.",
            ["The idea of wearing a uniform at all.", "The rule about mobile phones.", "The short break at school."],
            "The writer likes the idea of uniform («buena idea») but says «no soporto el jersey»: it is too thick and warm.",
            2, true,
          ),
          q10.multi("Choose the THREE sentences that express an obligation.", ["Hay que llevar uniforme.", "Tengo que estudiar más.", "Debo llegar puntual."], ["Puedo salir a las tres.", "Me gusta el inglés."], "*Hay que*, *tener que* and *deber* all say something must be done. *Puedo* means I am able or allowed to, and *me gusta* gives an opinion.", 2),
          q10.short("Complete with the correct verb form: «En clase no ___ (poder, nosotros) usar el móvil.»", "podemos", "*Poder* changes o → ue in the present (*puedo, puedes, puede*), but *nosotros* keeps the stem: *podemos*.", 2),
          q10.single("Which sentence means «I have to get good marks»?", "Tengo que sacar buenas notas.", ["Tengo que tomar buenos apuntes.", "Tengo que comprar buenos cuadernos.", "Tengo que pasar buenas horas."], "*Sacar buenas notas* means to get good marks; *apuntes* are class notes, which is a different thing.", 2),
          q10.single(
            "Read the message, then answer: which statement is TRUE?\n\n«Querida Ana: Este curso no va bien. Suspendí matemáticas en diciembre y, aunque estudio todas las tardes, no consigo entender los problemas. Mi profesora me ha ofrecido clases de refuerzo los miércoles y he decidido aceptar. Espero mejorar para el examen de junio.»",
            "She studies every afternoon but still finds maths hard.",
            ["She has stopped studying maths altogether this term.", "Her teacher refused to give her any extra help.", "She passed maths in December with a good mark."],
            "«Aunque estudio todas las tardes, no consigo entender»: she works hard but struggles. She failed in December and accepted extra classes.",
            3,
          ),
          q10.single("Which sentence means «I have been studying Spanish for five years»?", "Estudio español desde hace cinco años.", ["Estudio español desde cinco años.", "Estudié español desde hace cinco años.", "Estoy estudiando español para cinco años."], "For an action that started in the past and continues now, use the PRESENT tense with *desde hace*.", 3),
          q10.short("Translate into Spanish: My favourite subject is geography because the teacher is very funny.", "Mi asignatura favorita es la geografía porque el profesor es muy gracioso.", "*Asignatura favorita* (feminine), *la geografía*, *porque* for the reason, and *ser* for a quality of the teacher.", 3, { acc: subj10 }),
          q10.written(
            "Write 60–80 words in Spanish about your school. Describe what you study and what you think of it, mention one rule, and say what you are going to do next year.",
            "Estudio diez asignaturas y mi favorita es el arte porque la profesora es muy creativa. No me gusta la física porque es demasiado difícil. En mi instituto hay que llevar uniforme y no se puede usar el móvil, pero me parece justo. El año que viene voy a estudiar francés y música y pienso sacar buenas notas. También voy a hacer un curso de teatro.",
            "Mark scheme (10 marks): content 4 (subjects with opinions and reasons, a rule, a plan); structures 3 (hay que / se puede / tengo que, a near-future or future phrase); accuracy of agreement and spelling 2; connectors 1. Accept any sensible content.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["to pass (an exam)", "aprobar"],
        ["to fail an exam", "suspender un examen"],
        ["homework", "los deberes"],
        ["class notes", "los apuntes"],
        ["marks, grades", "las notas"],
        ["secondary school", "el instituto"],
        ["school subject", "la asignatura"],
        ["hay que llevar uniforme", "you have to wear a uniform"],
        ["desde hace + present", "for (a length of time) up to now: Estudio inglés desde hace tres años."],
        ["sacar buenas notas", "to get good marks"],
      ]),
    },
    11: {
      year: 11,
      subtopic: "GCSE Year 11",
      yearsCovered: [11],
      objectives: [
        "Talk about post-16 study options and future plans: bachillerato, vocational training, university, gap year.",
        "Discuss jobs and careers, work experience, applications and ambitions.",
        "Use the future tense and conditional to express plans and wishes.",
        "Use después de + infinitive and para + infinitive.",
        "Read adverts and personal statements and translate sentences into Spanish.",
      ],
      note: {
        title: "Year 11: careers, work experience and ambitions",
        body: `## Plans and ambitions

After *la ESO* (compulsory secondary school in Spain, to age 16), students choose *el bachillerato* (two years, leading to university) or *la formación profesional* (FP, vocational training). To talk about the future combine **querer + infinitive**, **me gustaría + infinitive**, **voy a + infinitive** and the **future tense** (*trabajaré, seré, iré*).

| Spanish | English |
| --- | --- |
| el sueldo, el paro | pay, unemployment |
| el puesto, el empleo | post, job |
| las prácticas | work experience, placement |
| a tiempo completo / parcial | full-time / part-time |
| el currículum, la entrevista | CV, interview |
| la carrera | degree course, career |
| un año sabático | a gap year |
| ganar dinero | to earn money |

## Key patterns

- **Después de acabar el bachillerato, empezaré un grado de cocina.** = After finishing the bachillerato, I will start a cooking course. (*después de* + **infinitive**)
- **Pasé dos semanas de prácticas en una biblioteca.** = I spent two weeks on work experience in a library.
- **Quiero ser ingeniera para diseñar puentes.** = I want to be an engineer in order to design bridges. (no *una* before a profession)

## Common errors

1. **No article** with professions: *soy médico*, *quiero ser abogada*.
2. **Trabajar de / como**: *trabajo como camarero* or *de camarero*.
3. **Después de** takes an infinitive, not a conjugated verb: *después de comer*.
4. **Carrera** means a degree course, not only a "career".
5. **Ambition** words: *el sueldo* is pay; *la sueldo* is wrong (it is masculine).`,
      },
      quiz: {
        title: "Current & Future Study and Employment: Year 11 quiz",
        questions: [
          q11.single("What does *el sueldo* mean?", "salary, pay", ["a suitcase", "the floor", "a job advert"], "*El sueldo* is the money you are paid for a job. Do not confuse it with *el suelo*, the floor.", 1),
          q11.short("Translate into Spanish: work experience.", "las prácticas", "*Las prácticas* is the usual word for a work placement.", 1, { acc: ["prácticas", "practicas", "la experiencia laboral", "experiencia laboral"] }),
          q11.single("Which sentence means «I would like to work abroad»?", "Me gustaría trabajar en el extranjero.", ["Me gusta trabajar en el extranjero.", "Me gustó trabajar en el extranjero.", "Me gustaría trabajado en el extranjero."], "*Me gustaría* (conditional) + infinitive expresses a wish. *Me gusta* is a present fact and *me gustó* a past one.", 2, true),
          q11.single("What does *el paro* mean?", "unemployment", ["the salary", "retirement", "a parade"], "In Spain *el paro* is unemployment, and *estar en paro* means to be out of work.", 2),
          q11.single(
            "Read the advert, then answer.\n\n«Se busca dependiente/a para tienda de deportes en el centro de Zaragoza. Jornada parcial: de martes a sábado por las tardes. Se ofrece contrato de seis meses y un sueldo de 900 euros al mes. Se valora experiencia previa y nivel medio de inglés. Enviar currículum antes del 30 de septiembre.»\n\nWhat does the shop offer?",
            "A six-month contract.",
            ["A full-time permanent post.", "A company car.", "Free sports clothing."],
            "«Se ofrece contrato de seis meses»: a six-month contract. The job is part-time («jornada parcial»), not full-time.",
            2, true,
          ),
          q11.short("Complete with the correct form of the verb: «El año pasado ___ (hacer, yo) las prácticas en una clínica.»", "hice", "*Hacer* is irregular in the preterite: *hice, hiciste, hizo, hicimos, hicisteis, hicieron*.", 2),
          q11.single("What does *trabajar a tiempo parcial* mean?", "to work part-time", ["to work full-time", "to work on time", "to work overtime"], "*A tiempo parcial* is part-time; full-time is *a tiempo completo*.", 2),
          q11.multi("Choose the THREE sentences in the FUTURE TENSE.", ["Estudiaré derecho.", "Viviré en el extranjero.", "Tendré mi propia casa."], ["Voy a estudiar derecho.", "Me gustaría estudiar derecho."], "*Estudiaré, viviré* and *tendré* are future-tense forms. *Voy a estudiar* is the near future (ir a) and *me gustaría* is the conditional.", 2),
          q11.single(
            "Read the text, then answer: which statement best sums up the writer's attitude to his parents' worries?\n\n«Después del bachillerato no quiero ir directamente a la universidad. Prefiero tomarme un año sabático para trabajar como voluntario en una escuela de Ecuador. Mis padres tienen dudas porque creen que perderé el ritmo de estudio. Yo pienso lo contrario: aprenderé a ser más independiente y mejoraré mi inglés.»",
            "He disagrees and thinks the gap year will help him.",
            ["He agrees and has cancelled the plan.", "He is angry and refuses to talk to them.", "He is unsure and has asked a teacher for advice."],
            "«Yo pienso lo contrario» = I think the opposite. He believes he will grow more independent and improve his English.",
            3,
          ),
          q11.single("Which sentence means «After finishing my studies, I will look for a job in Spain»?", "Después de terminar mis estudios, buscaré trabajo en España.", ["Después de terminé mis estudios, buscaré trabajo en España.", "Después terminar mis estudios, buscaré trabajo en España.", "Después de terminando mis estudios, buscaré trabajo en España."], "*Después de* is followed by an infinitive (*terminar*). The other options use the wrong verb form or drop *de*.", 3),
          q11.short("Translate into Spanish: In the future I would like to have my own business.", "En el futuro me gustaría tener mi propia empresa.", "*Me gustaría* + infinitive (*tener*); *propia* agrees with feminine *empresa* (or *propio* with *negocio*).", 3, { acc: fut11 }),
          q11.written(
            "Write 70–90 words in Spanish about your future plans. Say what you want to study or do after school, describe a job you would like and explain why, and mention any work experience you have done.",
            "Después del instituto quiero hacer el bachillerato de ciencias y luego estudiar medicina. Me gustaría ser médica porque me encanta ayudar a los demás. El año pasado pasé dos semanas de prácticas en un hospital y aprendí mucho, aunque el horario era muy duro. Creo que no ganaré mucho al principio, pero eso no es lo más importante. Trabajaré en un hospital público en España o quizás en el extranjero.",
            "Mark scheme (10 marks): content 4 (post-school plan, a job with a reason, work experience); tenses 3 (future or conditional, preterite or imperfect for the past, present); accuracy including no article before professions 2; range of connectors and opinions 1. Accept any sensible content.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["salary, pay", "el sueldo"],
        ["work experience", "las prácticas"],
        ["part-time", "a tiempo parcial"],
        ["unemployment", "el paro"],
        ["CV", "el currículum"],
        ["gap year", "un año sabático"],
        ["Quiero ser + profession", "I want to be a … (no article: quiero ser abogada)"],
        ["después de + infinitive", "after doing (después de comer = after eating)"],
        ["me gustaría + infinitive", "I would like to …"],
        ["la carrera", "degree course (also career)"],
      ]),
    },
  },
};
