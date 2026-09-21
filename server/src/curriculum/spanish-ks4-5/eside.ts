// Spanish — Identity & Culture (GCSE, Years 10 and 11). Original content aligned to the DfE GCSE modern foreign languages subject content (OGL v3.0).
// Reading / writing / grammar / vocabulary only. Checked by _check_l4.ts.
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q10 = qb("eside", 10);
const q11 = qb("eside", 11);

export const TOPIC: CTopic = {
  key: "eside",
  topic: "Identity & Culture",
  subject: "Spanish",
  years: {
    10: {
      year: 10,
      subtopic: "GCSE Year 10",
      yearsCovered: [10],
      objectives: [
        "Talk and write about family, friends and relationships, describing people and giving justified opinions.",
        "Discuss technology and social media in everyday life: advantages, dangers and online safety.",
        "Describe free-time activities using gustar-type verbs and soler + infinitive.",
        "Describe customs and festivals in Spain and Latin America.",
        "Read short texts in Spanish and translate short sentences from English into Spanish.",
      ],
      note: {
        title: "Year 10: family, friends, technology and festivals",
        body: `## Opinions and reasons

At GCSE you must **give an opinion and justify it**: *porque*, *ya que*, *dado que*. Verbs like *gustar* work "backwards": the thing you like is the subject, so it decides the verb ending: *me gusta el cine* but *me gustan las series*. Add *a mí*, *a mi hermana le* for emphasis or a third person.

| Spanish | English |
| --- | --- |
| mi mejor amigo / amiga | my best friend |
| llevarse bien / mal con | to get on well / badly with |
| discutir con | to argue with |
| los abuelos, los primos | grandparents, cousins |
| las redes sociales (f pl) | social media |
| el acoso en línea | online bullying |
| el desfile, el disfraz | parade, costume |
| soler + infinitivo | to usually (do) |

## Model sentences

- **Mi hermana mayor es simpática y muy generosa.** = My older sister is nice and very generous.
- **Me entiendo muy bien con mi primo porque tenemos los mismos gustos.** = I get on very well with my cousin because we have the same tastes.
- **Suelo pasar las tardes charlando con mis amigos.** = I usually spend the evenings chatting with my friends.
- **En Valencia, las Fallas terminan con la quema de enormes figuras.** = In Valencia, the Fallas end with the burning of huge figures.

## Common errors

1. **Agreement:** *Me gusta las redes* is wrong; the plural noun needs *me gustan*.
2. **Ser or estar:** *es aburrido* = boring by nature; *está aburrido* = bored now.
3. **Adjectives** agree in gender and number: *mi mejor amiga es graciosa*.
4. **False friend:** *actualmente* means "at the moment", not "actually".

**Pronunciation:** *ll* sounds like English "y", *h* is silent, *j* is a throaty "h", *ñ* is "ny", *v* sounds like *b*.`,
      },
      quiz: {
        title: "Identity & Culture: Year 10 quiz",
        questions: [
          q10.single("What does the phrase *los abuelos* mean?", "grandparents", ["uncles and aunts", "grandchildren", "step-parents"], "*Abuelo* is grandfather and *abuela* grandmother, so *los abuelos* = grandparents. Grandchildren are *los nietos*.", 1),
          q10.short("Translate into Spanish: my best friend (a girl).", "mi mejor amiga", "'Best' is *mejor* and it comes before the noun; the ending changes with the friend's gender, so a girl is *amiga*.", 1),
          q10.single("Choose the correct word: «Me ___ los videojuegos.»", "encantan", ["encanta", "encantas", "encantamos"], "*Encantar* works like *gustar*: the thing loved is the subject. *Los videojuegos* is plural, so the verb ends in -an.", 2, true),
          q10.single("Which sentence means «My brother is bored»?", "Mi hermano está aburrido.", ["Mi hermano es aburrido.", "Mi hermana está aburrida.", "Mis hermanos están aburridos."], "A temporary state takes *estar*: *está aburrido* = is bored. *Es aburrido* would mean he is boring.", 2, true),
          q10.single(
            "Read the text, then answer.\n\n«Me llamo Lucía y tengo quince años. Vivo con mi madre y mi hermano pequeño, Iker. Mi padre vive en Sevilla y lo veo en vacaciones. Me llevo bien con mi hermano, aunque a veces discutimos porque siempre quiere usar mi ordenador. Mi mejor amiga se llama Nora; es muy graciosa y siempre me escucha. Los fines de semana suelo salir con ella al parque.»\n\nWhy do Lucía and Iker sometimes argue?",
            "He always wants to use her computer.",
            ["He tells Nora her secrets.", "She never lets him go to the park.", "Their father lives in another city."],
            "The text says «discutimos porque siempre quiere usar mi ordenador»: he keeps wanting her computer. Their father living in Sevilla is not given as a cause of arguments.",
            2,
          ),
          q10.multi(
            "Read the text, then choose the THREE statements that are true.\n\n«Antes de acostarme siempre reviso mis redes sociales. Me parece divertido compartir fotos, pero también sé que hay peligros: algunas personas fingen ser otras y hay mucho acoso en línea. Por eso mi perfil es privado y no acepto a desconocidos. Mis padres dicen que paso demasiado tiempo con el móvil, y tienen razón, porque a veces me quedo despierto hasta tarde.»",
            ["The writer's profile is private.", "The writer does not accept requests from strangers.", "The writer admits sometimes staying up late."],
            ["The writer's parents have banned social media.", "The writer never shares photos."],
            "«Mi perfil es privado», «no acepto a desconocidos» and «a veces me quedo despierto hasta tarde» match the three true statements. The writer enjoys sharing photos and the parents only complain.",
            2,
          ),
          q10.short("Complete with the correct form of the verb: «Mis padres y yo ___ (llevarse) bien.»", "nos llevamos", "*Llevarse* is reflexive, so it needs the pronoun that matches *nosotros*: *nos llevamos*.", 2, { acc: ["nos llevamos"] }),
          q10.single("What does «Suelo cenar con mi familia» mean?", "I usually have dinner with my family.", ["I am about to have dinner with my family.", "I used to have dinner with my family once.", "I would love to have dinner with my family."], "*Soler* + infinitive expresses a habit: 'I usually...'. It is not a plan or a wish.", 2),
          q10.single("Which sentence is grammatically correct?", "A mi hermana le gustan los deportes acuáticos.", ["A mi hermana gusta los deportes acuáticos.", "Mi hermana le gusta los deportes acuáticos.", "A mi hermana le gusta los deportes acuáticos."], "'His/her' needs *le*, and the verb agrees with the plural noun *los deportes*, so *gustan*. The others miss *le*, the plural ending or both.", 3),
          q10.single("What is the main idea of the Mexican festival Día de Muertos (1–2 November)?", "Families remember and honour loved ones who have died, often with an altar (ofrenda).", ["People dress in scary costumes to frighten spirits away.", "It celebrates the end of the harvest with a giant food fight.", "It marks the day Mexico won its independence."], "Día de Muertos is a joyful remembrance: families make an *ofrenda* with photos, flowers and favourite foods. It is not a Spanish version of Halloween.", 3),
          q10.short("Translate into Spanish, using «amable»: I get on well with my grandparents because they are very kind.", "Me llevo bien con mis abuelos porque son muy amables.", "*Llevarse bien con* + *porque* + *son* (a permanent quality) + *muy amables* (plural, agrees with *abuelos*).", 3, {
            acc: ["Yo me llevo bien con mis abuelos porque son muy amables", "Me llevo bien con mis abuelos ya que son muy amables", "Yo me llevo bien con mis abuelos ya que son muy amables", "Me llevo muy bien con mis abuelos porque son muy amables"],
          }),
          q10.written(
            "Write 50–60 words in Spanish about your best friend or a family member. Say who the person is, describe him or her, say why you get on well and give one thing you do together. Include an opinion and a reason.",
            "Mi mejor amigo se llama Dani y lo conozco desde los diez años. Es alto, moreno y muy gracioso. Me llevo bien con él porque siempre me escucha y tenemos los mismos gustos. Los sábados solemos jugar al fútbol en el parque. Creo que es importante tener un amigo así, ya que me ayuda cuando tengo problemas.",
            "Mark scheme (10 marks): content 4 (who, description, why you get on, an activity); use of a reason with porque/ya que 2; correct agreement (gender and number, ser/estar) 2; range and accuracy of verbs and connectors 2. Accept any true, sensible details.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["mi mejor amiga", "my (female) best friend"],
        ["to get on well with", "llevarse bien con"],
        ["discutir con", "to argue with"],
        ["grandparents", "los abuelos"],
        ["social media (feminine plural)", "las redes sociales"],
        ["soler + infinitive", "to usually do (Suelo salir con mis amigos = I usually go out with my friends)"],
        ["costume, fancy dress", "el disfraz"],
        ["online bullying", "el acoso en línea"],
        ["ser aburrido / estar aburrido", "to be boring / to be bored"],
        ["el Día de los Reyes Magos", "Three Kings' Day, 6 January: children receive gifts"],
      ]),
    },
    11: {
      year: 11,
      subtopic: "GCSE Year 11",
      yearsCovered: [11],
      objectives: [
        "Discuss identity, heritage, traditions and how customs change between generations.",
        "Talk about relationships, role models, celebrities, sport and music.",
        "Present arguments for and against using contrast connectors and give justified opinions.",
        "Describe how life used to be using the imperfect tense.",
        "Read longer texts for gist and detail, and translate sentences into Spanish.",
      ],
      note: {
        title: "Year 11: heritage, role models and generations",
        body: `## Building an argument

Top-band answers **compare and contrast**. Use connectors to link ideas: *sin embargo* (however), *en cambio* (on the other hand), *a pesar de* (despite), *aunque* (although), *por un lado… por otro* (on the one hand… on the other), *desde mi punto de vista* (from my point of view).

| Spanish | English |
| --- | --- |
| la identidad, las raíces | identity, roots |
| la costumbre, la tradición | custom, tradition |
| un modelo a seguir | a role model |
| el ídolo, el/la famoso/a | idol, famous person |
| la pareja, casarse con | partner, to marry |
| la brecha generacional | generation gap |
| los jóvenes, la juventud | young people, youth |

## Then and now

Use the **imperfect** for habits in the past: *-aba / -ía* (*hablaba, vivía*), plus *era, iba, veía*.

- **Mi abuelo cuenta que, de joven, los vecinos se reunían en la plaza cada noche.** = My grandfather says that, when young, the neighbours met in the square every night.
- **A pesar de las redes, sigo prefiriendo quedar con mis amigos en persona.** = Despite social media, I still prefer to meet friends in person.
- **Por un lado, la música une a la gente; por otro, cada generación tiene sus gustos.** = On the one hand, music unites people; on the other, each generation has its own tastes.

## Common errors

1. **La gente** is singular: *la gente es amable*, never *son*.
2. **Mucha gente** (feminine!), not *mucho gente*.
3. **Pero** vs **sino**: after a negative, *no es rojo sino azul* (not X but Y).
4. **Aunque** takes the indicative for a real fact: *aunque llueve*.`,
      },
      quiz: {
        title: "Identity & Culture: Year 11 quiz",
        questions: [
          q11.single("What does *la juventud* mean?", "youth, young people", ["the elderly", "justice", "youthful clothing"], "*Joven* means young; *la juventud* is youth as a group or a stage of life.", 1),
          q11.short("Translate into Spanish: a role model.", "un modelo a seguir", "The set phrase is *un modelo a seguir*, literally 'a model to follow'.", 1, { acc: ["un modelo"] }),
          q11.single("Which connector means «however»?", "sin embargo", ["además", "por eso", "por ejemplo"], "*Sin embargo* introduces a contrast. *Además* adds, *por eso* gives a result and *por ejemplo* gives an example.", 2, true),
          q11.single("Choose the correct verb: «La gente ___ muy amable en mi barrio.»", "es", ["son", "está", "somos"], "*La gente* is grammatically singular, so it takes *es*. A permanent quality also needs *ser*, not *estar*.", 2),
          q11.single(
            "Read the text, then answer.\n\n«Mi abuela nació en un pueblo de Galicia. Cuando era joven, no tenía televisión ni móvil: por las tardes toda la familia se sentaba en la puerta de casa y los vecinos charlaban durante horas. Ahora vive en Madrid con nosotros y a veces se queja de que todos miramos el móvil en la mesa. Le he prometido que, los domingos, vamos a guardar los teléfonos y a comer sin pantallas.»\n\nWhat has the writer promised?",
            "That on Sundays nobody will use phones at lunch.",
            ["That the family will visit the village in Galicia.", "That they will buy a television for grandmother.", "That the writer will phone grandmother every evening."],
            "«Los domingos… vamos a guardar los teléfonos y a comer sin pantallas»: no phones at Sunday lunch.",
            2,
          ),
          q11.short("Put the verb in the imperfect: «Antes, mis abuelos ___ (vivir) en un pueblo pequeño.»", "vivían", "A habit or situation in the past uses the imperfect. *Vivir* → *vivía, vivías, vivía, vivíamos, vivíais, vivían*; *mis abuelos* = 'they'.", 2),
          q11.single("Which sentence means «Although I like sport, I prefer music»?", "Aunque me gusta el deporte, prefiero la música.", ["Por eso me gusta el deporte, prefiero la música.", "Desde que me gusta el deporte, prefiero la música.", "Además me gusta el deporte, prefiero la música."], "*Aunque* = although. The other openers (that is why, since, also) do not make sense in this contrast.", 2, true),
          q11.multi("Choose ALL the expressions that introduce a CONTRAST.", ["sin embargo", "en cambio", "a pesar de"], ["por lo tanto", "además"], "*Sin embargo*, *en cambio* and *a pesar de* contrast ideas. *Por lo tanto* gives a result and *además* adds a point.", 2),
          q11.single(
            "Read the text, then answer.\n\n«Mi ídolo es mi profesora de música, no un futbolista. Con veinte años se fue a Argentina con una guitarra y sin dinero, y allí formó un grupo con jóvenes del barrio. Hoy dirige una orquesta juvenil. Admiro su valentía, pero, sobre todo, su paciencia con los alumnos que tardan en aprender.»\n\nWhat does the writer admire MOST?",
            "Her patience with slow learners.",
            ["Her courage in going abroad with no money.", "Her fame as a professional footballer.", "Her success in forming a group at twenty."],
            "*Sobre todo* means 'above all': the writer admires her patience most. Courage is admired too, but the text ranks it second.",
            3,
          ),
          q11.single("Which sentence means «When I was a child, I used to go to my grandparents' village every summer»?", "Cuando era niño, iba al pueblo de mis abuelos todos los veranos.", ["Cuando fui niño, fui al pueblo de mis abuelos todos los veranos.", "Cuando era niño, fui al pueblo de mis abuelos todos los veranos.", "Cuando soy niño, voy al pueblo de mis abuelos todos los veranos."], "Being a child and the repeated summer trips are both habitual past, so both verbs take the imperfect: *era* and *iba*.", 3),
          q11.short("Translate into Spanish: However, young people today are more independent.", "Sin embargo, los jóvenes de hoy son más independientes.", "*Sin embargo* + *los jóvenes* + *de hoy* + *son* (a general quality) + *más independientes* (plural).", 3, {
            acc: ["Sin embargo, los jóvenes de hoy en día son más independientes", "Sin embargo, los jóvenes hoy son más independientes", "Sin embargo, los jóvenes de hoy día son más independientes", "Sin embargo, los jóvenes de ahora son más independientes", "Sin embargo, hoy los jóvenes son más independientes"],
          }),
          q11.written(
            "Write 60–80 words in Spanish about a role model or a family tradition that matters to you. Say how it has changed over time and give your opinion. Use at least two connectors from this unit (for example sin embargo, a pesar de, aunque).",
            "Para mí, la comida del domingo en casa de mis abuelos es una tradición muy importante. Antes, todos los primos comíamos en una mesa enorme y mi abuela cocinaba durante toda la mañana. Ahora somos más y vivimos lejos; sin embargo, seguimos reuniéndonos una vez al mes. Aunque a veces es cansado, desde mi punto de vista es la mejor manera de mantener unida a la familia.",
            "Mark scheme (10 marks): content and opinion 4 (a clear tradition or role model, a change over time, an opinion); connectors 2; tenses (imperfect for the past, present for now) 2; accuracy and range 2. Accept any sensible content.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["however", "sin embargo"],
        ["en cambio", "on the other hand / whereas"],
        ["despite (+ noun or infinitive)", "a pesar de"],
        ["desde mi punto de vista", "from my point of view"],
        ["a role model", "un modelo a seguir"],
        ["the generation gap", "la brecha generacional"],
        ["custom, habit", "la costumbre"],
        ["la gente ___ (es / son)", "es: la gente is singular in Spanish"],
        ["por un lado… por otro (lado)", "on the one hand… on the other (hand)"],
        ["Antes, la gente se reunía en la plaza.", "In the past, people used to meet in the square (imperfect for habits)."],
      ]),
    },
  },
};
