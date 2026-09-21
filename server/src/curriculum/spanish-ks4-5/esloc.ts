// Spanish — Local, National & Global Areas of Interest (GCSE, Years 10 and 11). Original content aligned to the DfE GCSE modern foreign languages subject content (OGL v3.0).
// Reading / writing / grammar / vocabulary only. Checked by _check_l4.ts.
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q10 = qb("esloc", 10);
const q11 = qb("esloc", 11);

export const TOPIC: CTopic = {
  key: "esloc",
  topic: "Local, National & Global Areas of Interest",
  subject: "Spanish",
  years: {
    10: {
      year: 10,
      subtopic: "GCSE Year 10",
      yearsCovered: [10],
      objectives: [
        "Describe home, neighbourhood, town and region, giving opinions on what there is and what is missing.",
        "Talk and write about weather and the natural environment.",
        "Discuss holidays and travel: accommodation, transport, booking and past holidays using the preterite.",
        "Read short texts such as emails, adverts and blogs, and translate short sentences into Spanish.",
      ],
      note: {
        title: "Year 10: home, town, region and holidays",
        body: `## Describing where you live

Use *hay* (there is / are) for what exists; it never changes, even with plurals: *hay muchos parques*. Use *estar* for location: *el museo está cerca del río*. Prepositions: *a* + *el* = **al**, *de* + *el* = **del**.

| Spanish | English |
| --- | --- |
| el barrio, las afueras | neighbourhood, outskirts |
| el casco antiguo | old town |
| el ayuntamiento | town hall |
| el polideportivo | sports centre |
| el alojamiento, el albergue | accommodation, hostel |
| alquilar, reservar | to hire, to book |
| el billete, el vuelo | ticket, flight |
| hace sol / llueve / nieva / hay niebla | it is sunny / rains / snows / it is foggy |

## Holidays in the past

Use the **preterite** for completed actions: *fui, fuimos, visité, me quedé, comimos*. *Ir* and *ser* share the same forms: *fui, fuiste, fue, fuimos, fuisteis, fueron*.

- **Mis padres y yo pasamos las vacaciones en Cuba y visitamos La Habana.** = My parents and I spent the holidays in Cuba and visited Havana.
- **Lo mejor de mi región es la comida.** = The best thing about my region is the food.
- **Este año pienso ir a la montaña porque prefiero la naturaleza.** = This year I plan to go to the mountains because I prefer nature.

## Common errors

1. **Spending:** *pasar* = spend time, *gastar* = spend money.
2. **Article:** no article with most cities: *vivo en Sevilla*, not *en la Sevilla*.
3. **Time phrases:** say *el año pasado* and *el verano pasado* with no preposition, not *en el año pasado*.
4. **Hay** is invariable: *había, hubo* in the past.

**Pronunciation:** *z* and *c* before *e/i* sound like "th" in Spain, "s" in Latin America; *gu* before *e/i* keeps a hard *g*.`,
      },
      quiz: {
        title: "Local, National & Global Areas of Interest: Year 10 quiz",
        questions: [
          q10.single("What does *el ayuntamiento* mean?", "town hall", ["swimming pool", "bus station", "old town"], "*El ayuntamiento* is the building where the town's council works, so it is the town hall.", 1),
          q10.short("Translate into Spanish: It is snowing.", "nieva", "Weather verbs have no subject: *nieva* (it snows). *Está nevando* is also possible.", 1, { acc: ["está nevando", "esta nevando"] }),
          q10.single("Choose the correct verb: «El verano pasado ___ a Perú con mis tíos.»", "fuimos", ["íbamos", "vamos", "iremos"], "*El verano pasado* signals a single, completed trip, so use the preterite of *ir*: *fuimos*.", 2, true),
          q10.single("Complete the sentence: «Lo mejor de mi barrio es que ___ muchos parques.»", "hay", ["están", "son", "tienen"], "*Hay* says that something exists. *Están* and *son* need a subject and do not mean 'there are'.", 2),
          q10.single(
            "Read the email, then answer.\n\n«Estimados señores: Quisiera reservar una habitación doble para tres noches, del 12 al 15 de julio. Preferimos una habitación con vistas al mar y aire acondicionado. También querría saber si el desayuno está incluido en el precio y si hay aparcamiento. Muchas gracias por su ayuda. Atentamente, Marta Ríos.»\n\nWhat does Marta want to find out?",
            "Whether breakfast is included and whether there is parking.",
            ["Whether pets are allowed and how far the beach is.", "Whether the hotel has a swimming pool and a gym.", "Whether the room has a balcony and free Wi-Fi."],
            "Marta asks «si el desayuno está incluido en el precio y si hay aparcamiento»: breakfast and parking.",
            2, true,
          ),
          q10.single("Which sentence means «We stayed in a small hostel near the station»?", "Nos quedamos en un albergue pequeño cerca de la estación.", ["Nos quedaremos en un albergue pequeño cerca de la estación.", "Nos quedamos en un albergue pequeño lejos de la estación.", "Nos quedamos en un albergue grande cerca del aeropuerto."], "A finished stay uses the preterite (*nos quedamos*); *cerca de la estación* = near the station; *albergue* = hostel.", 2),
          q10.short("Complete with a single word: «Voy ___ cine con mis amigos.»", "al", "*A* + *el* always contracts to *al*.", 2),
          q10.multi("Choose ALL the words that are places or buildings in a town.", ["el ayuntamiento", "la estación", "el polideportivo"], ["la maleta", "el billete"], "The town hall, the station and the sports centre are places. A suitcase and a ticket are things a traveller carries.", 2),
          q10.multi(
            "Read the blog, then choose the TWO statements that are true.\n\n«El año pasado pasamos una semana en Costa Rica. Al principio hizo buen tiempo y visitamos un parque natural donde vimos monos y tucanes. Sin embargo, el quinto día empezó a llover sin parar y no pudimos hacer excursiones. Nos aburrimos un poco en el hotel, pero por las noches probamos platos deliciosos. Volveremos, pero esta vez en la estación seca.»",
            ["They saw wild animals at the start of the trip.", "They plan to go back in the dry season."],
            ["It rained from the first day.", "They were bored for the whole week.", "They stayed in a tent in the park."],
            "They saw «monos y tucanes» early on and say «Volveremos… en la estación seca». The rain began on day five, and they were only «un poco» bored, at the hotel.",
            3,
          ),
          q10.single("Which sentence contains a mistake?", "Vivo en el Madrid.", ["Fuimos a España el verano pasado.", "El año pasado visité Cuba.", "Hay muchos museos en mi ciudad."], "City names take no article here: *vivo en Madrid*. The other three sentences are correct.", 3),
          q10.short("Translate into Spanish: Last summer we went to a village in the mountains and stayed in a small hotel.", "El verano pasado fuimos a un pueblo en la montaña y nos quedamos en un hotel pequeño.", "Preterite of *ir* (*fuimos*) and of *quedarse* (*nos quedamos*), joined by *y*. *Pequeño* and *pueblo* are both masculine.", 3, {
            acc: [
              "El verano pasado fuimos a un pueblo de montaña y nos quedamos en un hotel pequeño",
              "El verano pasado fuimos a un pueblo en las montañas y nos quedamos en un hotel pequeño",
              "El verano pasado fuimos a un pueblo en la montaña y nos quedamos en un pequeño hotel",
              "El verano pasado fuimos a un pueblo de montaña y nos quedamos en un pequeño hotel",
              "El verano pasado fuimos a un pueblo en las montañas y nos quedamos en un pequeño hotel",
              "El verano pasado fuimos a un pueblo en la montaña y nos alojamos en un hotel pequeño",
            ],
          }),
          q10.written(
            "Write 60–80 words in Spanish. Describe your town or region (what there is and what you like or dislike), say where you went on a past holiday and what you did, and say where you would like to go next.",
            "Vivo en una ciudad mediana en el norte de Inglaterra. Hay un centro comercial, un parque grande y un polideportivo, pero no hay mucha vida nocturna. El verano pasado fui a Mallorca con mi familia. Nos quedamos en un hotel cerca de la playa, nadamos todos los días y visitamos un pueblo muy bonito. El año que viene pienso ir a Perú porque me interesa mucho la historia.",
            "Mark scheme (10 marks): content 4 (town with opinion, past holiday, future plan); tenses 3 (present with hay/estar, preterite, a future expression such as pienso ir or voy a); accuracy of agreement and spelling 2; connectors and reasons 1. Accept any true, sensible details.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["town hall", "el ayuntamiento"],
        ["the outskirts", "las afueras"],
        ["the old town", "el casco antiguo"],
        ["to book a room", "reservar una habitación"],
        ["to hire, to rent", "alquilar"],
        ["hace sol / llueve / nieva", "it is sunny / it rains / it snows"],
        ["it is foggy", "hay niebla"],
        ["fui / fuimos", "I went / we went (also I was / we were)"],
        ["pasar / gastar", "to spend time / to spend money"],
        ["a + el / de + el", "al / del"],
      ]),
    },
    11: {
      year: 11,
      subtopic: "GCSE Year 11",
      yearsCovered: [11],
      objectives: [
        "Discuss social issues: charity, volunteering, poverty, homelessness and healthy living.",
        "Discuss global issues: the environment, climate change, energy and recycling.",
        "Talk about the effects of tourism and natural disasters on places.",
        "Express obligation and advice with hay que, deber and the conditional, and make predictions with the future tense.",
      ],
      note: {
        title: "Year 11: social and global issues",
        body: `## Talking about problems and solutions

To say what must be done, use **hay que + infinitive** (impersonal: one must), **tener que / deber + infinitive** (a personal duty) and the conditional for polite advice: **deberíamos**, **sería mejor**. To predict, use the **future**: *habrá, subirá, desaparecerán*.

| Spanish | English |
| --- | --- |
| el medio ambiente | the environment |
| la contaminación | pollution |
| el calentamiento global | global warming |
| reciclar, ahorrar | to recycle, to save |
| la basura | rubbish |
| ser voluntario/a | to volunteer |
| las personas sin hogar | homeless people |
| la pobreza, el desempleo | poverty, unemployment |
| cada vez más / menos | more and more / less and less |

## Model sentences

- **Hay que apagar las luces para ahorrar energía.** = We must switch off the lights to save energy.
- **Deberíamos usar más el transporte público y menos el coche.** = We should use public transport more and the car less.
- **Cada vez hay más turistas y los precios suben.** = There are more and more tourists and prices are rising.
- **Dentro de veinte años, muchas ciudades tendrán más zonas verdes.** = Within twenty years, many cities will have more green areas.

## Common errors

1. **Hay que** never changes: *hay que comer bien*, not *hay que comemos*.
2. After *para* you need an infinitive: *para reducir*, not *para reduciendo*.
3. **Más de** with numbers, **más que** in comparisons: *más de cien*; *más alto que yo*.
4. **Sequía** (drought) has an accent, as do *contaminación* and *energía*.`,
      },
      quiz: {
        title: "Local, National & Global Areas of Interest: Year 11 quiz",
        questions: [
          q11.single("What does *el cambio climático* mean?", "climate change", ["weather forecast", "changing rooms", "a change of season"], "*Cambio* is change and *climático* is climate-related, so *el cambio climático* is climate change.", 1),
          q11.short("Translate into Spanish (one word): to recycle.", "reciclar", "*Reciclar* is a regular -ar verb, close to the English word.", 1),
          q11.single("Complete: «Hay que ___ la basura en el contenedor correcto.»", "tirar", ["tiramos", "tirando", "tiró"], "*Hay que* is always followed by the infinitive, so *tirar* (to throw away).", 2, true),
          q11.single("What does «Deberíamos ayudar más» mean?", "We should help more.", ["We had to help more.", "We used to help more.", "We must always help more."], "*Deberíamos* is the conditional of *deber* and gives advice: 'we should'.", 2, true),
          q11.single(
            "Read the text, then answer.\n\n«Todos los sábados por la mañana trabajo como voluntaria en un comedor social de mi barrio. Servimos comida caliente a personas sin hogar y también a familias que no llegan a fin de mes. Al principio me daba vergüenza, pero ahora estoy muy orgullosa porque he aprendido que cualquiera puede necesitar ayuda. Mis amigos dicen que es una pérdida de tiempo; yo pienso que no hay nada más útil.»\n\nWhat has the writer learned?",
            "That anyone can need help.",
            ["That homeless people do not want her help.", "That volunteering wastes time.", "That she prefers cooking to serving."],
            "«He aprendido que cualquiera puede necesitar ayuda» = anyone can need help. Her friends think volunteering is a waste of time, but she disagrees.",
            2,
          ),
          q11.short("Complete with one word: «Uso la bicicleta ___ reducir la contaminación.»", "para", "*Para* + infinitive expresses purpose ('in order to').", 2),
          q11.single("Which sentence means «In future there will be fewer forests»?", "En el futuro habrá menos bosques.", ["En el futuro hay menos bosques.", "En el futuro hubo menos bosques.", "En el futuro había menos bosques."], "A prediction uses the future tense: *habrá* is the future of *hay*.", 2),
          q11.multi("Choose ALL the renewable sources of energy.", ["la energía solar", "la energía eólica", "la energía hidráulica"], ["el carbón", "el petróleo"], "Sun, wind and moving water renew themselves. Coal and oil are fossil fuels that will run out.", 2),
          q11.multi(
            "Read the text, then choose the TWO statements that are true.\n\n«Mi pueblo costero recibe cada verano diez veces más visitantes que habitantes. Por un lado, los turistas traen dinero y empleo a los restaurantes y hoteles. Por otro, el agua escasea, las playas se llenan de basura y los vecinos ya no pueden alquilar una vivienda porque los precios han subido mucho. Algunos proponen limitar el número de visitantes; otros creen que sería mejor cobrar una pequeña tasa y usar ese dinero para limpiar.»",
            ["In summer there are far more visitors than residents.", "Rising prices make it hard for locals to rent a home."],
            ["Hotels have closed because there are too few tourists.", "Everybody agrees that visitor numbers should be limited.", "The town has too much water in summer."],
            "«Diez veces más visitantes que habitantes» and «los vecinos ya no pueden alquilar una vivienda» are true. Opinions on limiting visitors are divided («algunos… otros»).",
            3,
          ),
          q11.single("Which sentence means «It would be better to use public transport»?", "Sería mejor usar el transporte público.", ["Será mejor usar el transporte público.", "Sería mejor usando el transporte público.", "Es mejor usaría el transporte público."], "*Sería* is the conditional of *ser* ('would be') followed by an infinitive. *Será* means 'will be'.", 3),
          q11.short("Translate into Spanish: We must protect the environment.", "Hay que proteger el medio ambiente.", "*Hay que* + infinitive is the impersonal 'one must'; *tener que* or *deber* also work with a personal subject.", 3, {
            acc: ["Tenemos que proteger el medio ambiente", "Debemos proteger el medio ambiente", "Hemos de proteger el medio ambiente", "Es necesario proteger el medio ambiente"],
          }),
          q11.written(
            "Write 70–80 words in Spanish about an environmental or social problem in your area. Describe the problem, suggest two solutions using hay que and deberíamos, and make a prediction using the future tense.",
            "En mi ciudad hay demasiado tráfico y la contaminación del aire es un problema grave. Hay que usar más el transporte público y deberíamos construir más carriles bici para ir al instituto sin coche. Además, se podría cobrar una tasa a los coches en el centro. Si no hacemos nada, habrá más enfermedades respiratorias y las calles estarán aún más sucias. Creo que los jóvenes podemos cambiar las cosas.",
            "Mark scheme (10 marks): content 4 (problem, two solutions, a prediction); structures 3 (hay que + infinitive, deberíamos + infinitive, a future tense); accuracy 2; opinion or connector 1. Accept any sensible content.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["the environment", "el medio ambiente"],
        ["pollution", "la contaminación"],
        ["global warming", "el calentamiento global"],
        ["hay que + infinitive", "one must / we must (impersonal)"],
        ["deberíamos + infinitive", "we should (conditional of deber)"],
        ["to volunteer", "ser voluntario"],
        ["homeless people", "las personas sin hogar"],
        ["cada vez más", "more and more"],
        ["habrá", "there will be (future of hay)"],
        ["drought", "la sequía"],
      ]),
    },
  },
};
