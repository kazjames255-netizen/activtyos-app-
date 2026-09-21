// Spanish — Artistic Culture (A-level, Years 12 and 13). Original content aligned to the DfE GCE modern foreign languages subject content (OGL v3.0).
// Reading / writing / grammar / vocabulary only. Checked by _check_l4.ts.
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q12 = qb("esart", 12);
const q13 = qb("esart", 13);

const cross = (...parts: string[][]) => parts.reduce<string[]>((acc, p) => acc.flatMap((a) => p.map((b) => a + b)), [""]);
const pal12 = [
  ...cross(["El palacio "], ["fue construido ", "fue edificado ", "se construyó ", "se edificó ", "fue levantado "], ["en el siglo XIV", "en el siglo catorce", "en el siglo 14"]),
  ...cross(["Se construyó el palacio ", "Se edificó el palacio "], ["en el siglo XIV", "en el siglo catorce"]),
];
const pic13 = cross(
  ["Picasso pintó "],
  ["el Guernica ", "Guernica ", "el cuadro Guernica ", "el «Guernica» "],
  ["en 1937 "],
  ["para protestar contra ", "para protestar por ", "para denunciar ", "como protesta contra ", "como protesta por "],
  ["el bombardeo", "los bombardeos", "el bombardeo de la ciudad"],
);

export const TOPIC: CTopic = {
  key: "esart",
  topic: "Artistic Culture",
  subject: "Spanish",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12",
      yearsCovered: [12],
      objectives: [
        "Discuss music and dance traditions of the Spanish-speaking world, such as flamenco, mariachi and tango.",
        "Discuss architecture and heritage sites in Spain and Latin America.",
        "Discuss festivals, museums and the role of culture in society.",
        "Use the passive with ser, the se passive and relative clauses with cuyo to describe works of art.",
        "Give evaluative opinions about cultural works and events.",
      ],
      note: {
        title: "Year 12: music, architecture and cultural heritage",
        body: `## Describing culture

To talk about the arts at A-level you need factual anchors and evaluative language. Useful facts: **flamenco**, born in Andalusia, was recognised by UNESCO as Intangible Cultural Heritage in 2010; **mariachi** is Mexican; **tango** grew up around the Río de la Plata (Argentina and Uruguay); the **Alhambra** in Granada is a Nasrid palace-fortress from the 13th and 14th centuries; **Gaudí** (modernismo catalán) began work on the Sagrada Família in Barcelona in the 1880s.

| Spanish | English |
| --- | --- |
| el cante / el baile / el toque | singing / dance / guitar playing |
| la fachada, la cúpula, la bóveda | façade, dome, vault |
| el patrimonio | heritage |
| la exposición, el cuadro | exhibition, painting |
| la obra de arte | work of art |
| conmover, impresionar | to move, to impress |

## Structures for describing works

- **Passive:** *ser* + participle agreeing with the subject, plus *por*: *El puente fue diseñado por una ingeniera catalana.* Alternative: **se**: *Se construyó en el siglo XV.*
- **Cuyo** agrees with the thing possessed.
- **Evaluation:** *cabe destacar que…, lo que más llama la atención es…, vale la pena + infinitive.*

- **Gaudí diseñó edificios de formas onduladas que recuerdan a la naturaleza.** = Gaudí designed buildings with wavy shapes that recall nature.
- **Vale la pena visitar una iglesia cuyo campanario se ve desde toda la ciudad.** = It is worth visiting a church whose bell tower can be seen from the whole city.

## Common errors

1. *La obra fue diseñado* → **diseñada**: the participle agrees.
2. *El arte* is masculine singular, but *las artes* is feminine plural.
3. **Impresionar** = to impress; "to print" is *imprimir*.`,
      },
      quiz: {
        title: "Artistic Culture: Year 12 quiz",
        questions: [
          q12.single("What does *el cuadro* mean?", "painting", ["square", "table", "chair"], "*Un cuadro* is a painting or picture. The shape 'square' is *el cuadrado*.", 1),
          q12.short("Translate into Spanish: concert.", "el concierto", "The Spanish word is almost the same: *el concierto*.", 1, { acc: ["concierto"] }),
          q12.single("Flamenco is the traditional art form of which region of Spain?", "Andalusia", ["Galicia", "Catalonia", "Navarre"], "Flamenco (singing, dance and guitar) originated in Andalusia and was recognised by UNESCO in 2010.", 2, true),
          q12.single("Which architect is most closely associated with the Sagrada Família in Barcelona?", "Antoni Gaudí", ["Frank Gehry", "Santiago Calatrava", "Diego Rivera"], "Gaudí, a leading figure of Catalan modernism, worked on the church from the 1880s until his death in 1926.", 2),
          q12.single("Choose the correct form: «El Museo Guggenheim de Bilbao fue ___ por Frank Gehry.»", "diseñado", ["diseñada", "diseñó", "diseñar"], "In the passive, the participle agrees with the subject: *el museo* is masculine singular, so *diseñado*.", 2),
          q12.single(
            "Read the text, then answer.\n\n«El sábado fuimos a la Feria de Abril en Sevilla. Las casetas estaban llenas de gente vestida con trajes de flamenca y de corto, y por todas partes se oía música y se bailaban sevillanas. Yo, que nunca había bailado, acepté la invitación de una señora mayor que me enseñó los pasos con una paciencia infinita. Al final de la noche tenía los pies destrozados, pero no recuerdo una fiesta más divertida.»\n\nWho taught the writer to dance?",
            "An older woman at the fair.",
            ["A professional flamenco teacher.", "The writer's grandmother.", "A group of friends from school."],
            "The writer accepted the invitation of «una señora mayor» who taught the steps. Nothing says she was a professional or a relative.",
            2, true,
          ),
          q12.multi("Choose the THREE musical traditions from the Spanish-speaking world.", ["el flamenco", "el mariachi", "el tango"], ["el fado", "el reggae"], "Flamenco is Spanish, mariachi Mexican and tango comes from Argentina and Uruguay. Fado is Portuguese and reggae is Jamaican.", 2),
          q12.single("Choose the correct verb form: «Vale la pena ___ el Museo del Prado.»", "visitar", ["visitamos", "visitando", "visitó"], "*Valer la pena* is followed by an infinitive: *vale la pena visitar*.", 2),
          q12.single(
            "Read the text, then answer.\n\n«Cuando se inauguró en 1997, el museo Guggenheim de Bilbao cambió la imagen de una ciudad industrial en crisis. Miles de turistas llegaron atraídos por su fachada de titanio, y otras ciudades quisieron copiar la fórmula. Sin embargo, hay quienes critican que se invierta tanto dinero en un edificio espectacular mientras hacen falta escuelas y viviendas. Los defensores responden que el «efecto Guggenheim» ha creado empleo y orgullo local.»\n\nWhat is the critics' main objection?",
            "Too much was spent on a spectacular building while schools and housing are needed.",
            ["The museum is too small to attract enough visitors from other cities.", "The building spoils the industrial character and history of the city.", "Other cities have copied the idea without asking for permission."],
            "The critics object that «se invierta tanto dinero en un edificio espectacular mientras hacen falta escuelas y viviendas».",
            3,
          ),
          q12.single("Choose the correct word: «El museo, ___ colección incluye obras de Goya, está en Madrid.»", "cuya", ["cuyo", "cuyas", "que"], "*Cuyo* agrees with the noun that follows, not with the owner: *colección* is feminine singular, so *cuya*.", 3),
          q12.single("Which sentence contains a passive with *ser*?", "La catedral fue diseñada por un arquitecto local.", ["Se venden entradas en la puerta.", "La catedral está cerrada hoy.", "El arquitecto diseñó la catedral."], "The passive is *ser* + participle (agreeing) + *por* the agent. *Está cerrada* describes a state, and *se venden* is the reflexive passive.", 3),
          q12.short("Translate into Spanish: The palace was built in the fourteenth century.", "El palacio fue construido en el siglo XIV.", "Passive: *fue construido* (masculine, agrees with *el palacio*). Centuries are written in Roman numerals after *siglo*.", 3, { acc: pal12 }),
          q12.written(
            "Write 100–120 words in Spanish about a cultural event or place you have visited or would like to visit (a flamenco show, festival, museum or building). Describe it, give your evaluation, and use at least one passive or se construction and one relative clause with que or cuyo.",
            "El año pasado visité la Alhambra en Granada, un palacio que fue construido por la dinastía nazarí. Lo que más me impresionó fueron los patios, cuyos arcos parecen encajes de piedra. Se dice que cada rincón tiene un significado, y aunque no lo entendí todo, me sentí en otro mundo. Cabe destacar que se conserva muy bien, a pesar de tantos siglos. Creo que vale la pena visitarla despacio y sin prisas, porque el edificio se entiende mejor cuando uno se detiene a mirar los detalles. Me gustaría volver en invierno.",
            "Mark scheme (12 marks): content and evaluation 4 (description, opinion with justification); structures 3 (passive or se, relative clause, evaluative phrase); range of vocabulary and tenses 3; accuracy including agreement 2. Accept any sensible event or place.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["painting", "el cuadro"],
        ["heritage", "el patrimonio"],
        ["façade", "la fachada"],
        ["exhibition", "la exposición"],
        ["vale la pena + infinitive", "it is worth (doing)"],
        ["fue diseñado por", "was designed by (passive: participle agrees)"],
        ["cuyo / cuya", "whose (agrees with what follows)"],
        ["flamenco: home region", "Andalucía"],
        ["it is worth pointing out that", "cabe destacar que"],
        ["lo que más llama la atención", "what stands out most"],
      ]),
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13",
      yearsCovered: [13],
      objectives: [
        "Discuss painting, muralism and visual art of Spain and Latin America, and the artists' historical context.",
        "Discuss art as a vehicle for protest, memory and identity.",
        "Analyse and evaluate works using precise critical vocabulary.",
        "Use evaluative and comparative structures such as no solo… sino también and relative clauses with cuyo.",
        "Write a structured, evaluative response about a work of art.",
      ],
      note: {
        title: "Year 13: painting, muralism and art as protest",
        body: `## Reading a work of art

Discuss **subject, technique and effect**: *retratar* (to portray), *plasmar* (to capture), *denunciar* (to condemn), *conmemorar* (to commemorate). Key names: **Velázquez** (*Las Meninas*, 17th-century court painter), **Goya** (*El 3 de mayo de 1808 en Madrid*, painted in 1814, about the violence of the Napoleonic occupation), **Dalí** (surrealism), **Frida Kahlo** and **Diego Rivera** (Mexican; Rivera is a leading figure of **muralismo**).

| Spanish | English |
| --- | --- |
| el lienzo, la pincelada | canvas, brushstroke |
| el retrato, el autorretrato | portrait, self-portrait |
| el paisaje, el bodegón | landscape, still life |
| el mural | mural |
| el surrealismo, el cubismo | surrealism, cubism |
| el realismo mágico | magical realism |
| la obra maestra | masterpiece |

## Critical language

- **Goya plasmó el horror de la guerra en un cuadro que sigue conmoviendo dos siglos después.** = Goya captured the horror of war in a painting that still moves people two centuries later.
- **La obra no solo refleja la realidad, sino que también la cuestiona.** = The work not only reflects reality but also questions it.
- **Tanto los críticos como el público reconocieron su talento.** = Both critics and the public recognised his talent.

Use **no solo… sino (que) también** for "not only… but also", **tanto… como** for "both… and", and **lo que** for a summary: *lo que más me llama la atención es la luz.*

## Common errors

1. Use **sino que** before a conjugated verb: *no solo pinta, sino que también escribe*.
2. **Retratar** (to portray) is not the same as *retirar* (to withdraw).
3. Keep past tenses clear: **preterite** for the year a work was painted, **imperfect** for the context.`,
      },
      quiz: {
        title: "Artistic Culture: Year 13 quiz",
        questions: [
          q13.single("What does *el autorretrato* mean?", "self-portrait", ["landscape", "still life", "mural"], "*Auto-* means self and *retrato* means portrait, so it is a self-portrait.", 1),
          q13.short("Translate into Spanish: landscape (in painting).", "el paisaje", "The noun is *paisaje*, masculine: *el paisaje*.", 1, { acc: ["paisaje"] }),
          q13.single("Which artist painted *Guernica* (1937)?", "Pablo Picasso", ["Francisco de Goya", "Salvador Dalí", "Frida Kahlo"], "*Guernica* is Picasso's large anti-war painting, made for the Spanish Republic's pavilion at the 1937 Paris International Exposition.", 2, true),
          q13.single("What event inspired Picasso's *Guernica*?", "The bombing of the Basque town of Guernica during the Spanish Civil War", ["The French army's occupation of Madrid in 1808, in the Peninsular War", "The death of a famous bullfighter, mourned by his artist friends", "The struggle for Mexican independence in the early nineteenth century"], "Picasso reacted to the aerial bombing of Guernica in April 1937. The 1808 occupation inspired Goya, not Picasso.", 2),
          q13.single("What is Frida Kahlo best known for?", "Her striking self-portraits", ["Her buildings in Barcelona", "Her flamenco songs", "Her sculptures of horses"], "The Mexican painter Frida Kahlo is famous for intense self-portraits that express her life, health and identity.", 2),
          q13.single("What does *el realismo mágico* describe?", "A style in which magical events appear in an ordinary, realistic setting", ["A theatre style that uses real magicians and stage illusions", "A painting technique that uses very small, precise brushstrokes", "A political movement that demanded more state support for artists"], "Magical realism, associated with Latin American writers and artists, blends the fantastic with everyday reality.", 2),
          q13.single(
            "Read the text, then answer.\n\n«En muchas ciudades de América Latina, los murales cubren las paredes de barrios enteros. No cuelgan en un museo silencioso: están en la calle, donde cualquiera puede verlos sin pagar entrada. Muchos artistas los pintan para que la gente recuerde su historia o defienda una causa. Cuando llueve, los colores se desgastan, y algunos vecinos organizan colectas para restaurarlos, porque sienten que esas imágenes son suyas.»\n\nHow are murals different from paintings in a museum?",
            "They are in the street and anyone can see them for free.",
            ["They are always painted by children from the neighbourhood.", "They are made from more durable materials than museum works.", "They can only be seen on a guided tour with a ticket."],
            "«Están en la calle, donde cualquiera puede verlos sin pagar entrada.» The colours fade in the rain, so durability is not an advantage.",
            2, true,
          ),
          q13.multi("Choose the THREE painters who were born in Spain.", ["Velázquez", "Goya", "Dalí"], ["Frida Kahlo", "Diego Rivera"], "Velázquez (Seville), Goya (Aragon) and Dalí (Catalonia) were born in Spain. Kahlo and Rivera were Mexican.", 2),
          q13.single(
            "Read the review, then answer.\n\n«La exposición reúne cuarenta retratos de mujeres pintadas entre 1900 y 1950. Lo que más llama la atención no es la técnica, aunque es impecable, sino las miradas: ninguna de las retratadas sonríe para agradar al espectador. La comisaria explica que muchas de ellas eran artistas que, en su época, no recibieron el reconocimiento que merecían. Salí de la sala con la sensación de haber conocido a personas reales y no a simples modelos.»\n\nWhat impressed the reviewer most?",
            "The sitters' expressions and gazes.",
            ["The technical skill of the painters.", "The number of paintings on show.", "The price of the exhibition."],
            "The reviewer says that what stands out «no es la técnica… sino las miradas». Technique is praised but ranked second.",
            3,
          ),
          q13.single("Which sentence uses *no solo… sino también* correctly?", "El artista no solo pintaba paisajes, sino también retratos.", ["El artista no solo pintaba paisajes, pero también retratos.", "El artista no solo pintaba paisajes, aunque también retratos.", "El artista no solo pintaba paisajes, sin embargo también retratos."], "The correct pair is *no solo… sino también* ('not only… but also'). *Pero, aunque* and *sin embargo* do not form this structure.", 3),
          q13.short("Complete with one word: «Este pintor, ___ obras cuelgan en el Prado, nació en Sevilla.»", "cuyas", "*Cuyo* agrees with the noun it introduces: *obras* is feminine plural, so *cuyas*.", 3),
          q13.short("Translate into Spanish: Picasso painted Guernica in 1937 to protest against the bombing.", "Picasso pintó el Guernica en 1937 para protestar contra el bombardeo.", "Preterite of *pintar* for a completed action; *para* + infinitive for purpose; *contra* or *por* after *protestar*.", 3, { accents: true, acc: pic13 }),
          q13.written(
            "Write 100–120 words in Spanish about a work of art (real or one you have seen). Explain what it represents, how it makes you feel and why it still matters. Use at least two of these: cuyo, no solo… sino también, tanto… como, a passive or se construction.",
            "Una obra que me impresionó es «El 3 de mayo de 1808 en Madrid», de Goya. No solo muestra un momento de violencia, sino que también nos obliga a pensar en las víctimas. Lo que más me llama la atención es la luz que cae sobre el hombre de la camisa blanca, cuyos brazos abiertos parecen pedir compasión. Se pintó en 1814, pero sigue emocionando porque habla de cualquier guerra. Tanto los historiadores como el público lo consideran una obra maestra. Para mí demuestra que el arte puede denunciar la injusticia sin necesitar palabras.",
            "Mark scheme (12 marks): content and evaluation 4 (what the work represents, personal response, relevance today); structures 3 (at least two of those listed); range of critical vocabulary 3; accuracy 2. Accept any appropriate work and a clear, justified response.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["self-portrait", "el autorretrato"],
        ["canvas", "el lienzo"],
        ["masterpiece", "la obra maestra"],
        ["el mural", "mural"],
        ["retratar / plasmar", "to portray / to capture (in art)"],
        ["to condemn, to expose", "denunciar"],
        ["no solo… sino también", "not only… but also"],
        ["tanto… como", "both… and"],
        ["el realismo mágico", "magical realism"],
        ["Guernica, 1937", "Picasso's anti-war painting about the bombing of a Basque town"],
      ]),
    },
  },
};
