// Spanish — Town & Region (Year 8). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q = qb("estr", 8);

export const TOPIC: CTopic = {
  key: "estr",
  topic: "Town & Region",
  subject: "Spanish",
  years: {
    8: {
      year: 8,
      objectives: [
        "Describe where you live and where it is (en el norte / sur / este / oeste de …).",
        "Say what there is and isn't with hay / no hay and muchos / pocos (agreeing with the noun).",
        "Give advantages and disadvantages (lo bueno es que …, lo malo es que …).",
        "Say what you can do with se puede + infinitive.",
      ],
      note: {
        title: "Year 8: Mi ciudad y mi región",
        body: `## What you need to know

**Where is it?** *Vivo en una ciudad / un pueblo …* + *en el norte / el sur / el este / el oeste de Inglaterra*. *En el centro de …* (in the centre of …), *cerca de la costa* (near the coast).

| Lugar | English | Descripción | English |
| --- | --- | --- | --- |
| el castillo | castle | tranquilo | quiet, peaceful |
| la catedral | cathedral | ruidoso | noisy |
| el centro comercial | shopping centre | histórico | historic |
| el polideportivo | sports centre | moderno | modern |
| el río / la playa | river / beach | industrial | industrial |
| la montaña / el lago | mountain / lake | turístico | touristy |
| el tráfico | traffic | bonito / feo | pretty / ugly |

**Quantities agree with the noun:** *muchos parques*, *muchas tiendas*, *pocos coches*, *pocas playas*, *demasiado ruido* (too much noise). **No hay** means there isn't / aren't: *no hay estadio*.

**Pros and cons:** *Lo bueno es que …* (The good thing is that …), *Lo malo es que …* (The bad thing is that …).

**What can you do?** *se puede* + infinitive: *se puede ir de compras*, *se puede pasear por el río*.

## Model sentences

- Vivo en una ciudad industrial en el este de Inglaterra.
- Hay pocos parques y muchos coches, y no hay playa.
- Lo malo es que hay demasiado ruido. Se puede ir de compras, pero no se puede nadar.

## Sound tip

**ll** is like y: *castillo* is "kas-TEE-yo". *Río* has two syllables, "RREE-o". **ci** and **ce** sound like "th" in Spain ("s" in Latin America): *ciudad* is "thyoo-DAD". *Catedral* is "ka-teh-DRAL".

## Common mistakes

- Making *mucho* / *poco* agree wrongly: it's **muchas** tiendas but **muchos** parques.
- Forgetting the **en** in *en el norte de*.
- Saying *hay* for one specific place you know. Use **está**: *el castillo está en el centro*.`,
      },
      quiz: {
        title: "Town & Region: Year 8 quiz",
        questions: [
          q.single("What does 'el norte' mean?", "the north", ["the south", "the east", "the west"], "El norte is the north; el sur is the south.", 1),
          q.single("What does 'No hay cine' mean?", "There isn't a cinema.", ["There is a cinema.", "There are two cinemas.", "The cinema is closed."], "No hay means 'there isn't / there aren't'.", 1),
          q.short("Write 'there is / there are' in Spanish (one word).", "hay", "Hay covers both there is and there are.", 1),
          q.single("Which sentence means 'There are lots of shops'?", "Hay muchas tiendas.", ["Hay mucho tiendas.", "Hay muchas tienda.", "Hay muchos tiendas."], "Tiendas is feminine and plural, so use muchas and keep the -s on tiendas.", 2, true),
          q.single("What does 'Lo malo es que hay mucho tráfico' mean?", "The bad thing is that there is a lot of traffic.", ["The good thing is that there is a lot of traffic.", "There is no traffic, which is bad.", "The bad thing is that there is no traffic."], "Lo malo = the bad thing. Mucho tráfico = a lot of traffic.", 2),
          q.short("Say in Spanish: 'You can visit the castle.'", "Se puede visitar el castillo.", "Se puede + infinitive means 'you can', and el castillo is the castle.", 2, { diag: true, acc: ["Puedes visitar el castillo."] }),
          q.multi("Which of these can describe a town? Choose all that apply.", ["tranquilo", "histórico", "moderno"], ["nunca", "porque"], "Tranquilo, histórico and moderno are adjectives. Nunca (never) and porque (because) are not.", 2),
          q.single("Which means 'in the north of England'?", "en el norte de Inglaterra", ["en la norte de Inglaterra", "a norte de Inglaterra", "en el norte en Inglaterra"], "Norte is masculine (el norte), and 'of' is de: en el norte de Inglaterra.", 2),
          q.single("Read: 'Vivo en un pueblo pequeño en el oeste de Gales. Es muy tranquilo. Hay un castillo, pero no hay cine.' Which is true about the town?", "It has a castle but no cinema.", ["It is in the east of Wales.", "It is big and noisy.", "It has a cinema but no castle."], "Hay un castillo = there is a castle; no hay cine = there is no cinema. Oeste is west and tranquilo is quiet.", 3),
          q.written("Write 3–4 sentences in Spanish about your town or village: where it is, what there is, one good thing and one bad thing.", "Vivo en una ciudad grande en el sur de Inglaterra. Hay muchas tiendas y un parque bonito. Lo bueno es que hay un cine. Lo malo es que hay demasiado tráfico.", "Tutor marks out of 4: 1 mark for saying where it is (vivo en … en el norte / sur / este / oeste de …); 1 mark for what there is with hay and a correct quantity word; 1 mark for lo bueno / lo malo with a reason; 1 mark for accurate spelling, accents and agreement.", 3),
        ],
      },
      flashcards: cards([
        ["el sur / el este / el oeste", "south / east / west"],
        ["en el norte de …", "in the north of …"],
        ["castle (Spanish)", "el castillo"],
        ["el polideportivo", "sports centre"],
        ["ruidoso", "noisy"],
        ["quiet, peaceful (Spanish)", "tranquilo"],
        ["muchos / muchas / pocos / pocas", "many (m/f) / few (m/f)"],
        ["Lo bueno es que …", "The good thing is that …"],
        ["The bad thing is that … (Spanish)", "Lo malo es que …"],
        ["se puede + infinitive", "you can …"],
      ]),
    },
  },
};
