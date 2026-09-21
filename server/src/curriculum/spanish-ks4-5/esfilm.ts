// Spanish — Film & Literature (A-level, Years 12 and 13). Original content aligned to the DfE GCE modern foreign languages subject content (OGL v3.0).
// All films, novels and plays in this file are INVENTED for practice. Reading / writing / grammar / vocabulary only. Checked by _check_l4.ts.
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q12 = qb("esfilm", 12);
const q13 = qb("esfilm", 13);

const cross = (...parts: string[][]) => parts.reduce<string[]>((acc, p) => acc.flatMap((a) => p.map((b) => a + b)), [""]);
const cuy12 = cross(
  ["La película, "],
  ["cuyo director es uruguayo, ", "cuya directora es uruguaya, "],
  ["fue rodada ", "se rodó ", "fue filmada "],
  ["en blanco y negro"],
);
const sil13 = cross(
  ["El autor ", "La autora ", "El escritor ", "La escritora "],
  ["usa ", "utiliza ", "emplea "],
  ["el silencio para "],
  ["mostrar ", "reflejar ", "expresar "],
  ["lo difícil que resulta ", "lo difícil que es ", "cuán difícil es "],
  ["hablar del pasado"],
);

export const TOPIC: CTopic = {
  key: "esfilm",
  topic: "Film & Literature",
  subject: "Spanish",
  years: {
    12: {
      year: 12,
      subtopic: "A-level Year 12",
      yearsCovered: [12],
      objectives: [
        "Use the vocabulary of film analysis: plot, characters, setting, cinematography, sound, editing and reception.",
        "Summarise the plot of a film and identify its themes, such as memory, identity, exile and injustice.",
        "Analyse how directors use technique to create meaning and evaluate a film with justified opinions.",
        "Use structures such as ambientada en, verse obligado a and relative clauses with cuyo in film discussion.",
        "Read and translate short synopses and reviews.",
      ],
      note: {
        title: "Year 12: talking about film",
        body: `## A structure for film writing

1. **Present** the film: title, director, year, genre, setting (*está ambientada en…*).
2. **Summarise** the plot in the **present tense**: *cuenta la historia de…, trata de…, sigue a…*.
3. **Analyse** technique: *el plano general / el primer plano* (wide shot / close-up), *el montaje* (editing), *la fotografía* (cinematography), *la banda sonora* (soundtrack).
4. **Identify themes**: *la memoria, la identidad, el exilio, la injusticia, la amistad*.
5. **Evaluate**: *En mi opinión…, lo que más destaca es…, resulta conmovedor / previsible / lento.*

| Spanish | English |
| --- | --- |
| el argumento, la trama | plot |
| el guion | script |
| el protagonista / el antagonista | main character / opposing character |
| el reparto | cast |
| rodar (o → ue) | to shoot (a film) |
| el desenlace | ending, outcome |
| el estreno, la taquilla | release, box office |
| los subtítulos | subtitles |
| verse obligado a + infinitive | to be forced to do |

## Model sentences

- **La película, ambientada en la Barcelona de los años treinta, cuenta la historia de dos hermanas separadas por la guerra.** = The film, set in 1930s Barcelona, tells the story of two sisters separated by war.
- **El primer plano permite que el espectador vea las emociones del protagonista.** = The close-up lets the viewer see the main character's emotions.
- **En mi opinión, el ritmo es lento, pero la fotografía es impecable.** = In my opinion, the pace is slow, but the cinematography is flawless.

## Common errors

1. **El personaje** is always masculine, even for a woman: *el personaje femenino*.
2. **El escenario** is the stage or setting, while **la escena** is a scene.
3. *Sensible* means sensitive; "sensible" in English is *sensato*.
4. Keep the plot in the **present tense**.`,
      },
      quiz: {
        title: "Film & Literature: Year 12 quiz",
        questions: [
          q12.single("What does *el guion* mean in film?", "script", ["soundtrack", "director's chair", "trailer"], "*El guion* is the written text of a film: dialogue and directions.", 1),
          q12.short("Translate into Spanish: the plot (of a film).", "el argumento", "*El argumento* or *la trama* both mean the plot or storyline.", 1, { acc: ["la trama", "argumento", "trama"] }),
          q12.single("What does *rodar una película* mean?", "to shoot a film", ["to release a film", "to dub a film", "to roll up a poster"], "*Rodar* has the special meaning of filming: *el rodaje* is the shoot.", 2, true),
          q12.single("What does *el antagonista* mean?", "the opposing character", ["the main character", "the film critic", "an extra in a crowd scene"], "The *protagonista* is the main character. The *antagonista* opposes or challenges him or her.", 2),
          q12.single("Which phrase means «is set in» (a film set in a city)?", "está ambientada en", ["está basada en", "está dirigida por", "está subtitulada en"], "*Ambientada en* describes the setting. *Basada en* means based on, and *dirigida por* means directed by.", 2, true),
          q12.single(
            "Read the synopsis, then answer.\n\n«Ambientada en 1965 en un pueblo minero de Chile, la película sigue a Elena, una maestra de treinta años que descubre que la mina que da trabajo a todos los vecinos va a cerrar. Elena decide organizar a las familias para pedir una solución, pero su propio hermano, capataz de la empresa, se opone. El director utiliza planos generales del desierto para mostrar la soledad de los personajes. El desenlace, abierto y esperanzador, deja al espectador con una pregunta: ¿qué estamos dispuestos a perder por defender lo nuestro?»\n\nWhere and when is the film set?",
            "In a mining village in Chile in the 1960s.",
            ["In a fishing village in Chile in the 1980s.", "In a Spanish city in the 1960s.", "In a mining village in Peru in the 1990s."],
            "«Ambientada en 1965 en un pueblo minero de Chile.»",
            2,
          ),
          q12.multi(
            "Read the synopsis again and choose the TWO true statements.\n\n«Ambientada en 1965 en un pueblo minero de Chile, la película sigue a Elena, una maestra de treinta años que descubre que la mina que da trabajo a todos los vecinos va a cerrar. Elena decide organizar a las familias para pedir una solución, pero su propio hermano, capataz de la empresa, se opone. El director utiliza planos generales del desierto para mostrar la soledad de los personajes. El desenlace, abierto y esperanzador, deja al espectador con una pregunta: ¿qué estamos dispuestos a perder por defender lo nuestro?»",
            ["Elena is a teacher.", "The ending is open and hopeful."],
            ["Elena's brother supports her campaign.", "The mine closes for good in the last scene.", "The director uses close-ups of the desert."],
            "Elena is «una maestra», and the ending is «abierto y esperanzador». Her brother opposes her, and the director uses wide shots («planos generales»), not close-ups.",
            2,
          ),
          q12.single("Choose the correct preposition: «La protagonista se ve obligada ___ abandonar su país.»", "a", ["de", "para", "en"], "*Verse obligado a* + infinitive means 'to be forced to'. The adjective agrees with the subject.", 2),
          q12.single("What does *el reparto* mean in the context of a film?", "the cast", ["the release", "the distribution of prizes", "the subtitles"], "*El reparto* is the list of actors and their roles. It can also mean distribution of things, but in film it is the cast.", 2),
          q12.single(
            "Read the text, then choose the statement that is FALSE.\n\n«Cuando Nicolás hereda la casa de su abuelo en Uruguay, encuentra cien cartas sin remitente escritas por una mujer que él nunca conoció. A lo largo de la película, los recuerdos del abuelo, presentados en blanco y negro, se mezclan con el presente, en color, hasta que resulta difícil saber qué es real. La directora no explica nada: deja que el espectador reconstruya la historia como si fuera un detective. Algunos críticos la consideran lenta; otros, hipnótica.»",
            "The director explains the whole mystery at the end.",
            ["Nicolás inherits his grandfather's house.", "Memories appear in black and white.", "Critics disagree about the film."],
            "«La directora no explica nada»: the viewer must reconstruct the story. The other statements match the text.",
            3,
          ),
          q12.single("Which sentence is the most suitable formal evaluation of a film?", "A mi juicio, el guion carece de profundidad, aunque las interpretaciones son notables.", ["Me mola el guion, aunque la verdad es que es un poco flojillo y ya está.", "El guion es guay, pero no me convence mucho, y los actores son majos.", "Yo digo que el guion no está muy bien, pero lo demás sí que está bien."], "A formal evaluation uses precise, neutral language (*a mi juicio, carece de profundidad, notables*). The other options are colloquial or vague.", 3),
          q12.short("Translate into Spanish: The film, whose director is Uruguayan, was shot in black and white.", "La película, cuyo director es uruguayo, fue rodada en blanco y negro.", "*Cuyo* agrees with *director*; the passive *fue rodada* agrees with *la película* (feminine).", 3, { acc: cuy12 }),
          q12.written(
            "Write 100–120 words in Spanish: review a film (real or invented, or the film in the Elena synopsis). Give the setting and plot in the present tense, comment on the characters and on one technique (the shots, sound or editing), and give your own evaluation with a reason.",
            "«El último tren a Mariana» está ambientada en un pueblo minero de Chile y cuenta la historia de Elena, una maestra que intenta salvar la mina de su pueblo. Su hermano, que trabaja para la empresa, se opone a ella, y esto crea un conflicto familiar muy emotivo. El director utiliza planos generales del desierto para mostrar la soledad de los personajes, y la guitarra de la banda sonora subraya la tristeza. En mi opinión, el ritmo es un poco lento, pero el desenlace es muy conmovedor. Recomiendo la película porque plantea preguntas importantes sobre la comunidad.",
            "Mark scheme (12 marks): content and organisation 4 (setting, plot, characters, technique, evaluation); use of film vocabulary 3; range of structures (present tense narration, relative clauses, opinion) 3; accuracy 2. Accept any film, real or invented.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["el argumento / la trama", "plot"],
        ["script", "el guion"],
        ["cast", "el reparto"],
        ["to shoot a film", "rodar una película"],
        ["ending, outcome", "el desenlace"],
        ["está ambientada en", "is set in"],
        ["close-up", "el primer plano"],
        ["soundtrack", "la banda sonora"],
        ["the main character / the opposing character", "el protagonista / el antagonista"],
        ["verse obligado a + infinitive", "to be forced to do something"],
      ]),
    },
    13: {
      year: 13,
      subtopic: "A-level Year 13",
      yearsCovered: [13],
      objectives: [
        "Use the vocabulary of literary analysis: narrator, point of view, symbol, motif, tone, structure and theme.",
        "Analyse how authors use language, structure and symbolism to create meaning in novels, plays and poems.",
        "Discuss themes such as memory, identity, exile, freedom and the family.",
        "Use analytical structures with the subjunctive and relative clauses (es probable que, lo cual, aunque).",
        "Write an evaluative response to a literary text.",
      ],
      note: {
        title: "Year 13: analysing novels, plays and poems",
        body: `## Analysing literature

Discuss **what** the author does, **how**, and **why it matters**. The author *emplea, utiliza, recurre a* (uses, turns to) a technique *para* + infinitive (in order to), which *refleja, sugiere, simboliza, contrasta con* an idea.

| Spanish | English |
| --- | --- |
| el narrador, la voz narrativa | narrator, narrative voice |
| el punto de vista | point of view |
| el símbolo, el motivo | symbol, motif |
| el tono, el ambiente | tone, atmosphere |
| la metáfora, la imagen | metaphor, image |
| el verso, la estrofa | line of verse, stanza |
| el acto, el telón | act, curtain |
| un final abierto | an open ending |
| el tema (m) | theme |

## Model sentences

- **El autor emplea el contraste entre luz y sombra para simbolizar la duda.** = The author uses the contrast between light and shadow to symbolise doubt.
- **La voz narrativa, en tercera persona, se mantiene distante, lo cual crea un efecto de frialdad.** = The narrative voice, in the third person, stays distant, which creates an effect of coldness.
- **Aunque el protagonista parece tranquilo, su silencio revela miedo.** = Although the protagonist seems calm, his silence reveals fear.

Use the **subjunctive** for interpretation and possibility (*es posible que el título sugiera dos lecturas*), and the imperfect subjunctive after past tenses (*el director quería que el público reflexionara…*). Narrate plot in the present.

## Common errors

1. *El tema, el poema, el problema* are masculine despite ending in -a.
2. *La novela trata de…* (not *trata en*).
3. **Sugerir** changes: *sugiere*, but *sugirió*.
4. **Spelling:** *sugerir* has one *g*, unlike English "suggest".`,
      },
      quiz: {
        title: "Film & Literature: Year 13 quiz",
        questions: [
          q13.single("What does *el narrador* mean?", "the narrator", ["the narrow path", "the reader", "the publisher"], "*Narrar* means to tell a story, so *el narrador* is the person or voice who tells it.", 1),
          q13.short("Translate into Spanish: metaphor.", "la metáfora", "The Spanish word is almost the same and is feminine: *la metáfora*.", 1, { acc: ["metáfora", "metafora"] }),
          q13.single("What does *la estrofa* mean in poetry?", "stanza", ["a line of verse", "a rhyme", "the poet's signature"], "*La estrofa* is a group of lines, a stanza. A single line is *el verso*.", 2, true),
          q13.single("What does *un final abierto* mean?", "an ending that leaves the outcome unresolved", ["an ending filmed or set in the open air", "a happy ending in which everyone is reunited", "a very short ending of a few lines"], "An open ending leaves questions unanswered so that readers reach their own conclusions.", 2),
          q13.single(
            "Read the synopsis, then answer.\n\n«Narrada en primera persona por Inés, una anciana que vive sola en un pueblo costero de Argentina, la novela alterna entre sus recuerdos de infancia y sus paseos actuales por la orilla. Los objetos (un abanico roto, una carta sin abrir) funcionan como símbolos de lo que ella nunca se atrevió a decir. El tono es melancólico pero sereno, y el lenguaje, sencillo y lleno de metáforas del mar.»\n\nWho narrates the novel?",
            "Inés, an elderly woman, in the first person.",
            ["A young sailor, in the third person.", "Inés's daughter, in the first person.", "An unnamed narrator, in the third person."],
            "«Narrada en primera persona por Inés, una anciana.»",
            2,
          ),
          q13.single(
            "Read the synopsis again, then answer: what do the broken fan and unopened letter symbolise?\n\n«Narrada en primera persona por Inés, una anciana que vive sola en un pueblo costero de Argentina, la novela alterna entre sus recuerdos de infancia y sus paseos actuales por la orilla. Los objetos (un abanico roto, una carta sin abrir) funcionan como símbolos de lo que ella nunca se atrevió a decir. El tono es melancólico pero sereno, y el lenguaje, sencillo y lleno de metáforas del mar.»",
            "Things Inés never dared to say.",
            ["Things Inés has lost at sea.", "Her wealth and social position.", "The end of her friendship with a neighbour."],
            "The text states the objects are symbols «de lo que ella nunca se atrevió a decir».",
            2, true,
          ),
          q13.multi(
            "Read the synopsis again and choose the TWO true statements about its style.\n\n«Narrada en primera persona por Inés, una anciana que vive sola en un pueblo costero de Argentina, la novela alterna entre sus recuerdos de infancia y sus paseos actuales por la orilla. Los objetos (un abanico roto, una carta sin abrir) funcionan como símbolos de lo que ella nunca se atrevió a decir. El tono es melancólico pero sereno, y el lenguaje, sencillo y lleno de metáforas del mar.»",
            ["The tone is melancholic but calm.", "The language is simple, with sea metaphors."],
            ["The tone is humorous and light.", "The language is technical and full of jargon."],
            "The text describes the tone as «melancólico pero sereno» and the language as «sencillo y lleno de metáforas del mar».",
            2,
          ),
          q13.single("Choose the correct word: «El autor emplea metáforas ___ transmitir la tristeza.»", "para", ["por", "de", "a"], "*Para* + infinitive expresses purpose: 'in order to convey'.", 2),
          q13.single("Choose the correct form: «Es probable que el autor ___ transmitir una sensación de espera.»", "quiera", ["quiere", "querrá", "quería"], "*Es probable que* expresses possibility and takes the present subjunctive: *quiera*.", 2),
          q13.single(
            "Read the synopsis, then answer: what is the effect of the ending?\n\n«En esta obra de teatro en tres actos, una familia espera durante toda la noche la llegada de un pariente que vive en el extranjero. Casi no ocurre nada: los personajes discuten, recuerdan y callan. El autor usa diálogos entrecortados y largos silencios para mostrar cuánto cuesta comunicarse en una familia. Cuando por fin suena el timbre, el telón cae antes de que se abra la puerta.»",
            "It leaves the arrival unresolved, reinforcing the theme of missed communication.",
            ["It reveals that the relative never existed and was imagined.", "It gives the play a comic, surprising twist that lightens the mood.", "It ends the family's long argument with a peaceful reconciliation."],
            "The curtain falls before the door opens, so we never see the arrival. This open ending echoes the difficulty of communication shown through the silences.",
            3,
          ),
          q13.single("Choose the correct form: «El autor quería que el lector ___ la soledad del personaje.»", "sintiera", ["sienta", "siente", "sentía"], "After *quería que* (a past tense) the imperfect subjunctive is needed: *sintieron → sintiera*.", 3),
          q13.short("Translate into Spanish: The author uses silence to show how hard it is to talk about the past.", "El autor usa el silencio para mostrar lo difícil que resulta hablar del pasado.", "*Usar… para* + infinitive gives the purpose; *lo difícil que resulta* + infinitive translates 'how hard it is to…'.", 3, { acc: sil13 }),
          q13.written(
            "Write 100–120 words in Spanish analysing the novel about Inés or the play about the waiting family (or a text you have studied). Explain the theme, one technique the author uses and its effect on the reader, and give your own interpretation.",
            "En la novela sobre Inés, el tema principal es el peso de los recuerdos. La autora emplea objetos como el abanico roto y la carta sin abrir para simbolizar lo que la protagonista nunca se atrevió a decir. Además, la voz narrativa en primera persona nos acerca a sus emociones, lo cual crea un tono íntimo y melancólico. Es posible que el mar represente el paso del tiempo, ya que aparece en todas las metáforas. En mi opinión, aunque la trama es sencilla, el texto conmueve porque nos recuerda que todos tenemos cosas que no hemos dicho.",
            "Mark scheme (12 marks): analysis and interpretation 4 (theme, technique, effect, personal view); analytical vocabulary 3; range of structures (subjunctive, relative clauses, connectors) 3; accuracy 2. Accept any text and any well-supported reading.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["narrator", "el narrador"],
        ["point of view", "el punto de vista"],
        ["symbol", "el símbolo"],
        ["stanza / line of verse", "la estrofa / el verso"],
        ["un final abierto", "an open ending"],
        ["tone", "el tono"],
        ["el tema", "theme (masculine)"],
        ["emplear… para + infinitive", "to use… in order to"],
        ["sugerir", "to suggest (sugiere, sugirió)"],
        ["lo cual", "which (referring to the whole previous clause)"],
      ]),
    },
  },
};
