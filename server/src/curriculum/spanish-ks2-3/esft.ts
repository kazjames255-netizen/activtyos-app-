// Spanish — Free Time (Year 8). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q = qb("esft", 8);

export const TOPIC: CTopic = {
  key: "esft",
  topic: "Free Time",
  subject: "Spanish",
  years: {
    8: {
      year: 8,
      objectives: [
        "Talk about what you do in your free time using jugar, tocar, hacer, ir and salir.",
        "Say how often you do things with frequency phrases and position nunca correctly.",
        "Give and justify preferences with prefiero … a … and porque.",
        "Understand short texts about leisure and pick out who does what and when.",
      ],
      note: {
        title: "Year 8: Mi tiempo libre",
        body: `## What you need to know

| Español | English |
| --- | --- |
| tocar la guitarra / el piano / el violín | to play an instrument |
| jugar al fútbol / al ajedrez / a los videojuegos | to play a sport or game |
| hacer deporte | to do sport |
| salir con mis amigos | to go out with my friends |
| quedar con mis amigos | to meet up with my friends |
| ir al cine / de compras | to go to the cinema / shopping |
| navegar por internet | to surf the internet |

**Two verbs for "to play":** use **jugar a** for sports and games (*juego al ajedrez*) and **tocar** for instruments (*toco la guitarra*, with no *a*).

**How often?** siempre (always), todos los días (every day), a menudo (often), a veces (sometimes), una vez a la semana (once a week), los fines de semana (at weekends), nunca (never). *Nunca* goes before the verb: *nunca hago deporte*. You can also say *no hago deporte nunca*.

**Preferences:** *prefiero + infinitive + a + infinitive* (I prefer … to …). Give reasons with **porque**: *es relajante* (relaxing), *emocionante* (exciting), *aburrido* (boring).

**Useful "I" forms:** juego, toco, hago, salgo, voy.

## Model sentences

- Los fines de semana quedo con mis amigos y vamos al cine.
- Siempre hago deporte, pero nunca juego al ajedrez.
- Prefiero navegar por internet a leer libros porque es emocionante.

## Sound tip

**j** is a throaty h: *juego* is "HWEH-go". **gu** before i or e is a hard g: *guitarra* is "gee-TA-rra". **rr** is rolled. *Ajedrez* is "a-heh-DRETH" (or "a-heh-DRES" in Latin America).

## Common mistakes

- Saying *juego la guitarra*. Instruments take **tocar**.
- Forgetting the **a** in *juego a los videojuegos* (and *a + el = al*).
- Leaving out the **a** in *prefiero leer a ver la tele*.`,
      },
      quiz: {
        title: "Free Time: Year 8 quiz",
        questions: [
          q.single("What does 'tocar la guitarra' mean?", "to play the guitar", ["to sing with a guitar", "to listen to the guitar", "to buy a guitar"], "Tocar is the verb 'to play' for instruments (it also means to touch).", 1),
          q.single("What does 'a veces' mean?", "sometimes", ["always", "often", "never"], "A veces is 'at times', so sometimes. Siempre is always and a menudo is often.", 1),
          q.short("Write 'never' in Spanish (one word).", "nunca", "Nunca means never. It can go before the verb: nunca juego.", 1),
          q.single("Which sentence means 'I play the piano'?", "Toco el piano.", ["Juego el piano.", "Juego al piano.", "Toco al piano."], "Use tocar for instruments, with no a: toco el piano.", 2, true),
          q.single("Which phrase means 'every day'?", "todos los días", ["una vez a la semana", "a menudo", "nunca"], "Todos los días is 'all the days', so every day. Una vez a la semana is once a week.", 2),
          q.short("Say in Spanish: 'I often go to the cinema.'", "A menudo voy al cine.", "A menudo (often) + voy (I go, from ir) + al cine. You can also put a menudo at the end.", 2, { diag: true, acc: ["Voy al cine a menudo."] }),
          q.multi("Which of these go with 'juego ___'? Choose all that apply.", ["al fútbol", "a los videojuegos", "al ajedrez"], ["la guitarra", "el violín"], "Jugar a is for sports and games. Instruments (la guitarra, el violín) go with tocar.", 2),
          q.single("What does 'Prefiero leer a ver la tele' mean?", "I prefer reading to watching TV.", ["I prefer TV to reading.", "I like reading and TV.", "I have to read and watch TV."], "Prefiero X a Y means 'I prefer X to Y', so here reading comes first and TV second.", 2),
          q.single("Marta says: 'Nunca juego al tenis porque es aburrido, pero siempre bailo los sábados.' Which is true?", "She always dances on Saturdays and never plays tennis.", ["She always plays tennis on Saturdays.", "She never dances but she plays tennis.", "She sometimes plays tennis because it is fun."], "Nunca juego al tenis = I never play tennis; siempre bailo los sábados = I always dance on Saturdays.", 3),
          q.short("Say in Spanish: 'I never play the violin because it is difficult.'", "Nunca toco el violín porque es difícil.", "Nunca before the verb, tocar (not jugar) for an instrument, and porque es difícil for the reason.", 3, { acc: ["No toco nunca el violín porque es difícil.", "No toco el violín nunca porque es difícil.", "Yo nunca toco el violín porque es difícil."] }),
        ],
      },
      flashcards: cards([
        ["tocar el piano", "to play the piano"],
        ["to play chess (Spanish)", "jugar al ajedrez"],
        ["hacer deporte", "to do sport"],
        ["to meet up with friends (Spanish)", "quedar con amigos"],
        ["a menudo", "often"],
        ["once a week (Spanish)", "una vez a la semana"],
        ["los fines de semana", "at weekends"],
        ["nunca", "never (goes before the verb)"],
        ["Prefiero X a Y", "I prefer X to Y"],
        ["jugar a … or tocar …?", "jugar a for sports and games, tocar for instruments"],
      ]),
    },
  },
};
