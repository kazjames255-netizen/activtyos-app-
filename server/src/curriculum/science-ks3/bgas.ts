// KS3 Science — Biology: Gas Exchange, Respiration & Photosynthesis (Year 8). Original content aligned to the DfE KS3 programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { IMG } from "./_img";
import { sg, mu, nm, build } from "./_h";

export const TOPIC: CTopic = {
  key: "bgas",
  topic: "Biology — Gas Exchange, Respiration & Photosynthesis",
  subject: "Science",
  years: {
    8: {
      year: 8,
      objectives: [
        "The structure and functions of the gas exchange system in humans, including adaptations to function; the mechanism of breathing.",
        "The impact of exercise, asthma and smoking on the human gas exchange system.",
        "Aerobic and anaerobic respiration in living organisms, including the breakdown of organic molecules to enable all the other chemical processes necessary for life.",
        "Photosynthesis in plants: the reactants and products, adaptations of leaves, and the factors that limit its rate.",
      ],
      note: {
        title: "Year 8: breathing, respiration and photosynthesis",
        body: `## Gas exchange

In the lungs, air reaches tiny air sacs called **alveoli**. Oxygen diffuses into the blood and carbon dioxide diffuses out. Alveoli are efficient because they have a **large surface area**, **thin walls** (one cell thick) and a **rich blood supply**. When you breathe in, the diaphragm **contracts and flattens** and the ribs move up and out, so the chest volume increases and air flows in.

## Respiration

**Aerobic respiration** uses oxygen: glucose + oxygen → carbon dioxide + water (and energy is released). During hard exercise muscles may use **anaerobic respiration**: glucose → lactic acid (a little energy released). Yeast makes ethanol and carbon dioxide instead.

## Photosynthesis

carbon dioxide + water → glucose + oxygen (using light energy absorbed by chlorophyll). Gases enter and leave a leaf through the **stomata**. The rate can be limited by light, carbon dioxide or temperature.

## Worked example: a fair test

A student counts bubbles from pondweed at different water temperatures. **Independent variable:** temperature. **Dependent variable:** bubbles per minute. **Control variables:** the same lamp distance, the same piece of pondweed, the same time period.`,
      },
      quiz: {
        title: "Gas Exchange, Respiration & Photosynthesis: Year 8 quiz",
        questions: build("bgas", 8, [
          sg("Which is the word equation for photosynthesis?", "carbon dioxide + water → glucose + oxygen", ["glucose + oxygen → carbon dioxide + water", "oxygen + water → glucose + carbon dioxide", "carbon dioxide + glucose → water + oxygen"], "Plants take in carbon dioxide and water and, using light energy, make glucose and release oxygen.", 1, { d: true }),
          sg("Which is the word equation for aerobic respiration?", "glucose + oxygen → carbon dioxide + water", ["glucose → lactic acid", "carbon dioxide + water → glucose + oxygen", "glucose + carbon dioxide → oxygen + water"], "Aerobic respiration uses oxygen to release energy from glucose, making carbon dioxide and water.", 1),
          sg("Look at the graph. At what light intensity does the rate of photosynthesis first stop increasing?", "4", ["2", "6", "8"], "The line rises until light intensity 4, then becomes flat: more light makes no further difference.", 2, { img: IMG.photo }),
          nm("Look at the graph. What is the rate of photosynthesis when the light intensity is 3?", 6, "Find 3 on the horizontal axis, go up to the line and read across: 6 units.", 1, { d: true, img: IMG.photo }),
          sg("Look at the graph. The rate stays constant from light intensity 5 to 10. What is the most likely explanation?", "Another factor, such as carbon dioxide concentration or temperature, is now limiting the rate", ["The plant has stopped photosynthesising, because the light is now too bright for its chloroplasts", "Light is no longer needed for photosynthesis once the plant has made enough glucose", "The plant has run out of glucose, so it cannot release any more oxygen"], "When more light gives no extra effect, something else is in short supply. The rate is not zero, so the plant is still photosynthesising.", 3, { img: IMG.photo }),
          sg("Through which structures do gases enter and leave a leaf?", "Stomata", ["Xylem vessels", "Root hairs", "Chloroplasts"], "Stomata are tiny pores, mostly on the underside of a leaf, controlled by guard cells.", 1),
          sg("What happens when you breathe in?", "The diaphragm contracts and flattens, the ribs move up and out, and the chest volume increases", ["The diaphragm relaxes and domes upwards, the ribs move down and in, and the chest volume decreases", "The lungs contract like muscles and push air in through the trachea, so the chest gets smaller", "The chest volume decreases, so the pressure inside rises and pushes air in through the nose"], "Bigger chest volume means lower pressure inside, so air is pushed in from outside.", 2),
          sg("During hard exercise the muscles can respire anaerobically. What is made?", "Lactic acid", ["Carbon dioxide and water", "Ethanol and carbon dioxide", "Oxygen"], "Human muscles make lactic acid. Yeast makes ethanol and carbon dioxide.", 2),
          mu("Which features make the alveoli good for gas exchange?", ["Very thin walls", "A rich blood supply", "A large surface area from millions of alveoli", "Thick walls to protect them"], ["Very thin walls", "A rich blood supply", "A large surface area from millions of alveoli"], "Short diffusion distance, steep concentration gradient and large area all speed up diffusion.", 2),
          sg("A student counts bubbles of oxygen per minute from pondweed placed at different distances from a lamp. Which is the dependent variable?", "The number of bubbles per minute", ["The distance of the lamp from the pondweed", "The type of pondweed used", "The temperature of the water"], "The dependent variable is what you measure. Lamp distance is the independent variable, and the rest must be controlled.", 2),
        ]),
      },
      flashcards: [
        { front: "Photosynthesis word equation", back: "carbon dioxide + water → glucose + oxygen (light energy, chlorophyll)." },
        { front: "Aerobic respiration word equation", back: "glucose + oxygen → carbon dioxide + water (energy released)." },
        { front: "Anaerobic respiration in muscles", back: "glucose → lactic acid." },
        { front: "Anaerobic respiration in yeast", back: "glucose → ethanol + carbon dioxide." },
        { front: "What are stomata?", back: "Tiny pores in a leaf that let gases in and out." },
        { front: "Three limiting factors of photosynthesis", back: "Light intensity, carbon dioxide concentration, temperature." },
        { front: "What are alveoli?", back: "Tiny air sacs in the lungs where gas exchange happens." },
        { front: "Three features of good gas exchange surfaces", back: "Large surface area, thin walls, good blood supply." },
        { front: "Breathing in: diaphragm and ribs", back: "Diaphragm contracts and flattens; ribs move up and out; chest volume increases." },
        { front: "Independent, dependent, control variables", back: "You change the independent, measure the dependent, and keep the controls the same." },
      ],
    },
  },
};
