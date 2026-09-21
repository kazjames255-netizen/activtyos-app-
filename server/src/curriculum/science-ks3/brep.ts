// KS3 Science — Biology: Reproduction & Development (Year 8). Original content aligned to the DfE KS3 programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { IMG } from "./_img";
import { sg, build } from "./_h";

export const TOPIC: CTopic = {
  key: "brep",
  topic: "Biology — Reproduction & Development",
  subject: "Science",
  years: {
    8: {
      year: 8,
      objectives: [
        "Reproduction in humans (as an example of a mammal), including the structure and function of the male and female reproductive systems.",
        "Gametes, fertilisation, gestation and birth; the role of the placenta; the effect of maternal lifestyle on the foetus through the placenta.",
        "Reproduction in plants, including flower structure, wind and insect pollination, fertilisation, seed and fruit formation and dispersal, and germination.",
      ],
      note: {
        title: "Year 8: making new life",
        body: `## Human reproduction

**Gametes** are sex cells: **sperm** (male) and **egg** (female). **Fertilisation** is when the nucleus of a sperm fuses with the nucleus of an egg, usually in the **oviduct**. The fertilised egg divides and the ball of cells sinks into the **uterus** wall. During **gestation** the foetus grows. The **placenta** lets oxygen and nutrients pass from the mother's blood to the foetus and waste pass back, but the two bloods do not mix. Harmful substances such as alcohol, nicotine and some viruses can cross the placenta.

## Flowering plants

The male part is the **stamen** (**anther** on a filament, making pollen). The female part is the **carpel**: **stigma** (catches pollen), style and **ovary** (containing ovules). **Pollination** is the transfer of pollen from an anther to a stigma. Insect-pollinated flowers have brightly coloured petals and nectar. Wind-pollinated flowers are small and dull with light pollen and feathery stigmas.

After fertilisation an ovule becomes a **seed** and the ovary becomes a **fruit**. Seeds are spread by wind, animals, water or explosions, which reduces competition. A seed **germinates** if it has water, oxygen and a suitable temperature.

## Worked example: matching adaptation to job

Grass flowers hang out of the plant with huge, feathery stigmas. They are **wind pollinated**, because they need to catch pollen grains drifting through the air.`,
      },
      quiz: {
        title: "Reproduction & Development: Year 8 quiz",
        questions: build("brep", 8, [
          sg("Look at the flower diagram. Which letter shows the anther, where pollen is made?", "B", ["A", "C", "D", "E"], "The anther is the yellow-orange structure on top of a thin filament. Together they form the male stamen.", 1, { d: true, img: IMG.flower }),
          sg("Look at the flower diagram. Which letter shows the stigma, which catches pollen?", "A", ["B", "C", "D", "E"], "The stigma is at the top of the female carpel, and it is often sticky so pollen grains stay on it.", 2, { img: IMG.flower }),
          sg("Look at the flower diagram. Which letter shows the ovary, which contains the ovules and later becomes the fruit?", "D", ["A", "B", "C", "E"], "The ovary is the swollen base of the carpel. After fertilisation the ovules become seeds and the ovary becomes a fruit.", 2, { img: IMG.flower }),
          sg("What is pollination?", "The transfer of pollen from an anther to a stigma", ["The joining of a pollen nucleus with an egg nucleus", "The scattering of seeds away from the parent plant", "The growth of a seed into a new plant"], "Pollination is only the movement of pollen. The joining of nuclei is fertilisation.", 1, { d: true }),
          sg("Which set of features is typical of a wind-pollinated flower?", "Small, dull petals and long feathery stigmas", ["Large brightly coloured petals and nectar", "Sticky, heavy pollen grains and a scent", "Petals that form a landing platform for insects"], "Wind-pollinated flowers do not need to attract insects, so they have no bright petals or nectar.", 2),
          sg("Which is the male gamete (sex cell) in humans?", "Sperm cell", ["Egg cell", "Zygote", "Ovule"], "Sperm are the male gametes. The fertilised egg is called a zygote.", 1),
          sg("Where in the female reproductive system does fertilisation usually happen?", "In the oviduct", ["In the uterus", "In the ovary", "In the vagina"], "The egg travels along the oviduct where sperm may meet it. The embryo then implants in the uterus.", 2),
          sg("What is the job of the placenta?", "It lets oxygen and nutrients pass from the mother's blood to the foetus, and waste pass back", ["It mixes the mother's and the foetus's blood together so that the foetus shares the mother's circulation directly", "It holds fluid that protects the foetus from bumps", "It makes the egg cells for the next baby"], "The placenta lets substances diffuse across without the two bloods mixing. Fluid in the amnion protects against bumps.", 2),
          sg("Why are pregnant women advised not to drink alcohol or smoke?", "Harmful substances can pass across the placenta into the foetus's blood", ["They make the placenta detach from the ovary", "They stop the mother's own blood making antibodies to protect the foetus", "They change the sex of the foetus"], "Alcohol and chemicals in smoke can cross the placenta and harm the growth and development of the foetus.", 3),
          sg("Which conditions does a seed need in order to germinate?", "Water, oxygen and a suitable temperature", ["Light, soil and wind", "Water, light and carbon dioxide", "Soil, sunlight and cold"], "A seed has its own food store, so it does not need light or soil to start growing.", 2),
        ]),
      },
      flashcards: [
        { front: "What is a gamete?", back: "A sex cell: sperm (male) or egg (female)." },
        { front: "What is fertilisation?", back: "The nucleus of a male gamete fuses with the nucleus of a female gamete." },
        { front: "Job of the placenta", back: "Passes oxygen and nutrients to the foetus and waste away; the bloods do not mix." },
        { front: "Where does fertilisation usually happen in humans?", back: "The oviduct." },
        { front: "What is pollination?", back: "Pollen moves from an anther to a stigma." },
        { front: "Male parts of a flower", back: "Stamen: anther and filament." },
        { front: "Female parts of a flower", back: "Carpel: stigma, style and ovary." },
        { front: "After fertilisation in a flower: ovule and ovary become…", back: "Ovule becomes a seed; ovary becomes a fruit." },
        { front: "Three conditions for germination", back: "Water, oxygen, suitable temperature." },
        { front: "Why disperse seeds?", back: "To reduce competition with the parent and with each other for light, water and space." },
      ],
    },
  },
};
