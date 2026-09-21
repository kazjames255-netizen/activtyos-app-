// Spanish — Hobbies & Sports (Year 5). Original content aligned to the DfE KS2 foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q = qb("eshob", 5);

export const TOPIC: CTopic = {
  key: "eshob",
  topic: "Hobbies & Sports",
  subject: "Spanish",
  years: {
    5: {
      year: 5,
      objectives: [
        "Name common hobbies and sports.",
        "Express opinions with me gusta / me encanta / no me gusta followed by an infinitive.",
        "Say which sport you play with juego al … and when with los sábados.",
        "Understand short texts about free time and pick out key details.",
      ],
      note: {
        title: "Year 5: Mis pasatiempos y deportes",
        body: `## What you need to know

| Español | English | Español | English |
| --- | --- | --- | --- |
| nadar | to swim | el fútbol | football |
| bailar | to dance | el tenis | tennis |
| cantar | to sing | el baloncesto | basketball |
| leer | to read | el voleibol | volleyball |
| dibujar | to draw | la natación | swimming |
| correr | to run | el atletismo | athletics |
| ver la tele | to watch TV | montar en bici | to ride a bike |
| escuchar música | to listen to music | el tiempo libre | free time |

**Opinions:** *me gusta* / *me encanta* / *no me gusta* + an **infinitive** (the -ar/-er/-ir form): *me encanta dibujar* (I love drawing), *no me gusta correr* (I don't like running).

**Playing a sport:** **jugar a** + the sport: *juego al fútbol*. **a + el = al**: *juego al tenis*, but *a la* with feminine words.

**When:** *los sábados* (on Saturdays, every Saturday), *el sábado* (this Saturday), *en mi tiempo libre* (in my free time).

## Model sentences

- Los domingos juego al voleibol con mi primo.
- Me encanta dibujar pero no me gusta correr.
- En mi tiempo libre monto en bici y escucho música.

## Sound tip

**v** and **b** sound the same, a soft b: *voleibol* is "bo-lay-BOL". **c** before e or i sounds like "th" in most of Spain and like "s" in Latin America: *baloncesto* is "ba-lon-THES-to". *Fútbol* is "FOOT-bol" and *tenis* is "TEH-nees".

## Common mistakes

- Saying *juego el fútbol*. You need **a**: **juego al** fútbol.
- Using -ing: Spanish says **me gusta nadar** (I like to swim), with the infinitive.
- Mixing up **los sábados** (every Saturday) and **el sábado** (one Saturday).`,
      },
      quiz: {
        title: "Hobbies & Sports: Year 5 quiz",
        questions: [
          q.single("What does 'nadar' mean?", "to swim", ["to sing", "to read", "to dance"], "Nadar is to swim, and la natación is swimming as a sport.", 1),
          q.single("Which verb means 'to read'?", "leer", ["dibujar", "bailar", "cantar"], "Leer is to read, dibujar is to draw, bailar is to dance and cantar is to sing.", 1),
          q.short("Write 'football' in Spanish (the sport).", "fútbol", "Football is fútbol, with the accent on the u, and it is masculine: el fútbol.", 1, { acc: ["el fútbol"] }),
          q.single("Which sentence is correct?", "Juego al baloncesto.", ["Juego el baloncesto.", "Juego a la baloncesto.", "Juego en baloncesto."], "Use jugar + a + el, which joins to al: juego al baloncesto.", 2, true),
          q.single("What does 'Me encanta cantar' mean?", "I love singing.", ["I hate singing.", "I am learning to sing.", "I would like to sing."], "Me encanta is a stronger 'I like': I love. It is followed by the infinitive cantar.", 2),
          q.short("Complete: Me gusta ___ la tele. (to watch)", "ver", "Ver is to watch or to see; after me gusta we use the infinitive.", 2, { diag: true }),
          q.multi("Which of these are sports? Choose all that apply.", ["el tenis", "el baloncesto", "la natación"], ["la música", "el libro"], "Tennis, basketball and swimming are sports. Music and a book are not.", 2),
          q.single("What does 'los sábados' mean?", "on Saturdays", ["this Saturday", "every day", "last Saturday"], "Los + a day means 'on' that day every week: on Saturdays.", 2),
          q.single("Luis writes: 'Me gusta nadar y leer, pero no me gusta cantar. Los viernes juego al fútbol.' Which is true?", "Luis plays football on Fridays.", ["Luis likes singing.", "Luis doesn't like reading.", "Luis swims on Fridays."], "Los viernes juego al fútbol = on Fridays I play football. He likes swimming and reading but not singing.", 3),
          q.short("Say in Spanish: 'I love reading and I don't like swimming.'", "Me encanta leer y no me gusta nadar.", "Me encanta + leer, then y and no me gusta + nadar, both with the infinitive.", 3),
        ],
      },
      flashcards: cards([
        ["nadar", "to swim"],
        ["to dance (Spanish)", "bailar"],
        ["dibujar", "to draw"],
        ["el baloncesto", "basketball"],
        ["Me encanta …", "I love …"],
        ["I play football (Spanish)", "Juego al fútbol."],
        ["a + el", "al (juego al tenis)"],
        ["los domingos", "on Sundays"],
        ["free time (Spanish)", "el tiempo libre"],
        ["What form follows me gusta?", "The infinitive: me gusta correr"],
      ]),
    },
  },
};
