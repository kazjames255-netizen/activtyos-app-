// Spanish — Holidays & Travel (Year 9). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q = qb("eshol", 9);

export const TOPIC: CTopic = {
  key: "eshol",
  topic: "Holidays & Travel",
  subject: "Spanish",
  years: {
    9: {
      year: 9,
      objectives: [
        "Talk about past holidays using the preterite (fui, viajé, me alojé, visité, comí).",
        "Talk about future plans with ir a + infinitive.",
        "Name types of transport and accommodation and book a room politely with quisiera.",
        "Understand and pick out details from short texts about holidays.",
      ],
      note: {
        title: "Year 9: De vacaciones",
        body: `## What you need to know

| Español | English | Español | English |
| --- | --- | --- | --- |
| el avión | plane | el hotel | hotel |
| el tren | train | el camping | campsite |
| el autobús | bus | el albergue juvenil | youth hostel |
| el barco | boat | la habitación doble / individual | double / single room |
| el coche | car | con vistas al mar | with a sea view |
| el aeropuerto | airport | el billete | ticket |
| la maleta | suitcase | el pasaporte | passport |

**Talking about the past (preterite):** *el verano pasado* (last summer), *el año pasado* (last year), *ayer* (yesterday). Useful forms: **fui** (I went), **viajé** (I travelled), **me alojé** (I stayed), **visité** (I visited), **nadé**, **compré**, **comí**. *Fui a Grecia en avión* = I went to Greece by plane.

**Talking about the future:** **voy a + infinitive**: *voy a viajar*, *voy a tomar el sol*. Time phrases: *mañana, este verano, el verano que viene* (next summer).

**Booking a room:** *Quisiera reservar una habitación doble para tres noches.* (I'd like to book a double room for three nights.) *¿Cuánto cuesta?* (How much is it?) *¿Hay wifi?* (Is there wifi?)

## Model sentences

- El año pasado fui a Grecia con mi familia.
- Mis padres se alojaron en un camping cerca de la playa.
- Este verano voy a viajar a Portugal en coche.

## Sound tip

Watch the accents that change meaning: **viajé** (I travelled) is stressed on the last syllable, unlike **viaja** (he/she travels). **v** and **b** sound the same. **j** is a throaty h: *viajar* is "bee-a-HAR". **ll** is like y. *Aeropuerto* is "a-eh-ro-PWER-to".

## Common mistakes

- Using a present verb after a past time phrase: not *el año pasado voy*, but **el año pasado fui**.
- Forgetting the **a** in *voy a viajar*.
- Dropping the accent on preterite forms such as **viajé** and **visité**.`,
      },
      quiz: {
        title: "Holidays & Travel: Year 9 quiz",
        questions: [
          q.single("What does 'el aeropuerto' mean?", "the airport", ["the station", "the port", "the bus stop"], "Aeropuerto is airport; aero- refers to air and puerto to a port.", 1),
          q.single("What is 'la maleta'?", "the suitcase", ["the passport", "the ticket", "the room"], "La maleta is a suitcase. El billete is the ticket.", 1),
          q.short("Write 'train' in Spanish (one word).", "tren", "Train is tren, masculine: el tren.", 1, { acc: ["el tren"] }),
          q.single("Which sentence means 'I stayed in a hotel'?", "Me alojé en un hotel.", ["Me alojo en un hotel.", "Voy a alojarme en un hotel.", "Quiero alojarme en un hotel."], "Me alojé is the preterite (I stayed). Me alojo is present, voy a alojarme is future and quiero alojarme means 'I want to stay'.", 2, true),
          q.single("'Quisiera reservar una habitación doble.' What does the speaker want?", "to book a double room", ["to cancel a single room", "to find the airport", "to buy a ticket"], "Quisiera reservar = I would like to book, and habitación doble is a double room.", 2),
          q.short("Complete: El verano pasado ___ a Escocia. (I went)", "fui", "Fui is the preterite of ir (I went), which goes with a past time phrase.", 2, { diag: true }),
          q.multi("Which of these are means of transport? Choose all that apply.", ["el avión", "el barco", "el autobús"], ["la maleta", "el pasaporte"], "Plane, boat and bus are transport. A suitcase and a passport are things you take with you.", 2),
          q.single("What does '¿Cuánto cuesta una habitación con vistas al mar?' ask?", "How much is a room with a sea view?", ["Is there a room by the sea?", "How many rooms have sea views?", "When can I arrive?"], "Cuánto cuesta = how much does it cost. Con vistas al mar = with a view of the sea.", 2),
          q.single("Elena writes: 'Este año voy a viajar a Italia en tren. El año pasado fui a Francia en avión.' Which is correct?", "She flew to France last year and will take the train to Italy this year.", ["She took the train to France last year and flew to Italy.", "She is in Italy now, and went to France by train.", "She will fly to France this year and took the train to Italy."], "El año pasado fui … en avión is past (flew to France); este año voy a viajar … en tren is future (train to Italy).", 3),
          q.single("Which sentence contains a tense error?", "El año pasado voy a Italia.", ["Ayer visité un museo.", "Mañana voy a nadar en el mar.", "Este verano viajo en tren."], "'El año pasado' (last year) needs a past verb: fui, not voy. The other sentences match their time words.", 3),
        ],
      },
      flashcards: cards([
        ["el avión / el barco", "plane / boat"],
        ["la habitación doble", "double room"],
        ["airport (Spanish)", "el aeropuerto"],
        ["el billete", "ticket"],
        ["fui", "I went"],
        ["I stayed (Spanish)", "me alojé"],
        ["voy a viajar", "I am going to travel"],
        ["el verano pasado", "last summer"],
        ["Quisiera reservar …", "I would like to book …"],
        ["con vistas al mar", "with a sea view"],
      ]),
    },
  },
};
