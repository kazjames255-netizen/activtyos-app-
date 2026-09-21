// KS1 Science — Everyday Materials (Years 1–2). Original content aligned to the DfE National Curriculum programme of study (OGL v3.0).
// Structural checks (answers in options, positions, pictogram sums) are in _check_s1.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";
import { IMG, multi, number, single } from "./_h";

export const TOPIC: CTopic = {
  key: "mats",
  topic: "Everyday Materials",
  subject: "Science",
  years: {
    1: {
      year: 1,
      objectives: [
        "Distinguish between an object and the material from which it is made.",
        "Identify and name a variety of everyday materials, including wood, plastic, glass, metal, water and rock.",
        "Describe the simple physical properties of a variety of everyday materials.",
        "Compare and group together a variety of everyday materials on the basis of their simple physical properties.",
      ],
      note: {
        title: "Year 1: objects, materials and their properties",
        body: `## Objects and materials

An **object** is a thing, like a spoon or a window. A **material** is what the object is made from, like metal or glass.

A spoon can be made of metal, plastic or wood. The spoon is the object. Metal is the material.

## Everyday materials

**wood**, **plastic**, **glass**, **metal**, **water** and **rock**

## Properties

A **property** tells us what a material is like.

| Property | Meaning | Example |
| --- | --- | --- |
| hard / soft | Hard does not squash easily | a metal bar is hard, a cushion is soft |
| rough / smooth | How it feels | sandpaper is rough |
| shiny / dull | Shiny reflects light | a new coin is shiny |
| see-through | You can see through it | clear plastic wrap |
| waterproof | Keeps water out | a plastic bowl |
| absorbent | Soaks up water | a towel |

## Sorting

We can **sort** materials into groups by a property. Hard things go in one hoop and soft things go in another.

**Worked example:** a window is see-through, hard and smooth. It is made of glass.`,
      },
      quiz: {
        title: "Everyday Materials: Year 1 quiz",
        questions: [
          single("mats-y1-01", "Which material do we get from trees?", ["Glass", "Metal", "Rock", "Wood"], 3, "Wood comes from trees. Glass, metal and rock do not.", 1),
          single("mats-y1-02", "Which one feels soft?", ["A rock", "A brick", "A woolly hat", "A nail"], 2, "A woolly hat is soft. Rocks, bricks and nails are hard.", 1),
          single("mats-y1-03", "Which one is a material, not an object?", ["Metal", "A bottle", "A bucket", "A comb"], 0, "Metal is a material. A bottle, a bucket and a comb are objects, and objects are made from materials.", 1),
          single("mats-y1-04", "Look at the picture.\nWhich material did the class find the MOST of?", ["Wood", "Metal", "Glass", "Plastic"], 3, "Plastic has the longest row, with 7 squares.", 2, { image: IMG.pictogram, diagnostic: true }),
          { ...number("mats-y1-05", "Look at the picture.\nHow many MORE plastic things than glass things?", 4, "Plastic has 7 squares and glass has 3. 7 − 3 = 4 more.", 2, { image: IMG.pictogram }), tolerance: 0 },
          single("mats-y1-06", "Which one soaks up water?", ["A sponge", "A plastic bag", "A metal spoon", "A glass jar"], 0, "A sponge is absorbent, so it soaks up water. The others do not.", 2),
          multi("mats-y1-07", "Which TWO things are shiny?", ["A metal spoon", "A woolly hat", "A piece of chalk", "A glass marble"], [0, 3], "Metal and glass are shiny. Wool and chalk are dull.", 2),
          single("mats-y1-08", "Which one is hard to bend?", ["A rubber band", "A sheet of paper", "A rock", "A piece of cloth"], 2, "A rock is hard and stiff, so it does not bend. Rubber, paper and cloth all bend.", 2, { diagnostic: true }),
          single("mats-y1-09", "Which material is hard AND see-through?", ["Rock", "Wood", "Glass", "Wool"], 2, "Glass is hard and you can see through it. Rock and wood are hard but not see-through.", 3),
          single("mats-y1-10", "Water soaks into A, runs off B and drips through C.\nWhich is waterproof?", ["Material A", "Material B", "Material C", "All of them"], 1, "A waterproof material keeps water out. The water runs off B, so B is waterproof.", 3),
        ],
      },
      flashcards: [
        { front: "Object", back: "A thing, like a spoon or a window." },
        { front: "Material", back: "What an object is made from, like wood, metal or glass." },
        { front: "Name six everyday materials", back: "Wood, plastic, glass, metal, water and rock." },
        { front: "Property", back: "A word that tells us what a material is like." },
        { front: "Hard", back: "Does not squash easily, like a metal bar. The opposite is soft." },
        { front: "See-through", back: "You can see through it, like clear plastic wrap." },
        { front: "Waterproof", back: "Keeps water out, like a plastic bowl." },
        { front: "Absorbent", back: "Soaks up water, like a towel." },
        { front: "Shiny", back: "Looks bright when the light hits it, like a new coin. The opposite is dull." },
        { front: "Name three objects made of wood", back: "For example a table, a pencil and a door." },
      ],
    },
    2: {
      year: 2,
      objectives: [
        "Identify and compare the suitability of a variety of everyday materials, including wood, metal, plastic, glass, brick, rock, paper and cardboard for particular uses.",
        "Find out how the shapes of solid objects made from some materials can be changed by squashing, bending, twisting and stretching.",
      ],
      note: {
        title: "Year 2: what materials are used for, and changing their shape",
        body: `## Choosing the right material

We choose a material for a job because of its properties.

| Object | Material | Why |
| --- | --- | --- |
| spade | metal | strong |
| cycle helmet | hard plastic | protects the head |
| bath mat | cloth | soaks up water |
| garden path | stone | hard and lasts a long time |
| oven glove | thick cloth | does not let heat through quickly |
| paper bag | paper | light and easy to fold |

Paper is a good material for a bag, but it would be a poor material for a bucket. It would go soggy!

## Changing shape

Some materials change shape when we push or pull them.
- **Squash**: push it smaller, like bread dough or modelling clay.
- **Bend**: curve it, like a plastic ruler or a wire.
- **Twist**: turn it, like a wet towel.
- **Stretch**: pull it longer, like a balloon.

A stone does not change shape easily.

## Working scientifically

Which balloon stretches the most? Blow each one up with the same number of breaths and **measure** how wide it gets. That is a fair test.`,
      },
      quiz: {
        title: "Everyday Materials: Year 2 quiz",
        questions: [
          single("mats-y2-01", "Why are windows made of glass?", ["You can see through it", "It is soft and squashy", "It is stretchy like elastic", "It is sticky to touch"], 0, "Glass is see-through, so we can look out of a window.", 1),
          single("mats-y2-02", "Which material makes a good raincoat?", ["Thin paper", "Waterproof plastic", "Soft tissue", "Fluffy cotton wool"], 1, "A raincoat must keep water out. Waterproof plastic does this. Paper and tissue go soggy.", 1),
          single("mats-y2-03", "Which one can you squash?", ["A rock", "A brick", "A glass jar", "A sponge"], 3, "A sponge is soft and squashy. Rock, brick and glass are hard.", 1),
          single("mats-y2-04", "Why do pan handles often have wood or plastic on them?", ["They do not get hot quickly", "They are see-through", "They are stretchy", "They are heavy"], 0, "Wood and plastic do not get hot as quickly as metal, so we can hold the handle safely.", 2),
          single("mats-y2-05", "Why are houses built from bricks?", ["They are soft and squashy", "They are hard and strong", "They are stretchy", "They are see-through"], 1, "Bricks are hard and strong, so a wall stands up and lasts a long time.", 2, { diagnostic: true }),
          single("mats-y2-06", "Ali pulls a rubber band to make it longer.\nWhat is this called?", ["Squashing", "Bending", "Twisting", "Stretching"], 3, "Pulling something to make it longer is stretching.", 2, { diagnostic: true }),
          single("mats-y2-07", "Sam wants to make a bridge that does not bend.\nWhich is best?", ["A wet paper strip", "A rubber band", "A thick metal bar", "A piece of string"], 2, "A thick metal bar is strong and stiff. The others bend or stretch.", 2),
          multi("mats-y2-08", "Which TWO are good for making wellington boots?", ["Rubber", "Paper", "Plastic", "Tissue"], [0, 2], "Boots must keep water out. Rubber and plastic are waterproof. Paper and tissue are not.", 2),
          single("mats-y2-09", "How can Jo find out which elastic band stretches the most?", ["Pull each one the same way and measure", "Look at which colour is brightest", "Pick the longest one without testing", "Guess which looks the stretchiest"], 0, "A fair test: pull each band in the same way and measure how far it stretches.", 3),
          single("mats-y2-10", "Which is the WRONG material for its job?", ["A rubber ball that bounces", "A paper umbrella", "A wooden spoon for stirring", "A metal saucepan"], 1, "Paper goes soggy in the rain, so it is the wrong material for an umbrella.", 3),
        ],
      },
      flashcards: [
        { front: "Why is a spade made of metal?", back: "Metal is strong." },
        { front: "Why is a cycle helmet made of hard plastic?", back: "It is hard, so it protects the head." },
        { front: "Why does a bath mat use cloth?", back: "Cloth soaks up water." },
        { front: "Why is a garden path made of stone?", back: "Stone is hard and lasts a long time." },
        { front: "Squash", back: "Push it to make it smaller, like bread dough or modelling clay." },
        { front: "Bend", back: "Curve it, like a plastic ruler or a wire." },
        { front: "Twist", back: "Turn it round, like a wet towel." },
        { front: "Stretch", back: "Pull it to make it longer, like a balloon." },
        { front: "Choosing a material", back: "We pick a material because its properties suit the job." },
        { front: "Why is cardboard fine for a box but not for a bucket?", back: "Cardboard goes soggy when it gets wet. It is not waterproof." },
      ],
    },
  },
};
