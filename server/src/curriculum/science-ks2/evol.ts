// KS2 Science — Evolution & Inheritance (Year 6). Original content aligned to the DfE National Curriculum (OGL v3.0).
// The moth counts are recomputed by _check_s2.ts from _s2data.ts (the data that draws the image).
import type { CTopic } from "../types";

const MOTH_ALT = "Bar chart of moths still alive after two days on pale birch bark, from 40 of each kind released. Pale moths: 30 alive. Dark moths: 10 alive.";

export const TOPIC: CTopic = {
  key: "evol",
  topic: "Evolution & Inheritance",
  subject: "Science",
  years: {
    6: {
      year: 6,
      objectives: [
        "Recognise that living things have changed over time and that fossils provide information about living things that inhabited the Earth millions of years ago.",
        "Recognise that living things produce offspring of the same kind, but normally offspring vary and are not identical to their parents.",
        "Identify how animals and plants are adapted to suit their environment in different ways and that adaptation may lead to evolution.",
        "Working scientifically: use data from a chart to support an explanation.",
      ],
      note: {
        title: "Year 6: fossils, variation, adaptation and evolution",
        body: `## Fossils tell a story
Fossils show that **living things have changed over time**. By studying fossils, scientists can work out what plants and animals looked like millions of years ago, and that many, such as dinosaurs, are now extinct.

## Inheritance and variation
Offspring are **the same kind** as their parents, but they are not identical. This difference between individuals is called **variation**. Some features are **inherited** (passed on from parents), such as eye colour or fur pattern. Other features are gained during life, such as a scar or big muscles from training, and are **not** passed on.

## Adaptation
An **adaptation** is a feature that helps a living thing survive in its habitat.

| Living thing | Adaptation | How it helps |
| --- | --- | --- |
| Camel | Wide, flat feet | Walks on soft sand without sinking |
| Fennec fox | Large ears, pale fur | Loses heat; blends into the desert |
| Cactus | Thick stem and spines | Stores water; protects itself |

## Evolution by natural selection
Because of variation, some individuals have features that suit their environment better. They are more likely to **survive** and **have offspring**, which inherit those features. Over **many generations** the whole group can change. This is **evolution**. It works over long periods, and animals do not change on purpose.

**Worked example 1:** Some beetles are green and some are brown, and birds find the brown ones easier to see on green leaves. More green beetles survive and have young. Over generations, more beetles are green.

**Worked example 2:** A weightlifter has huge muscles but her children are not born with them. That feature was not inherited.

**Worked example 3:** A fossil of a palm leaf is found in a rock in a cold place. Palms need warmth, so this tells us that the place was once much warmer.`,
      },
      quiz: {
        title: "Evolution & Inheritance: Year 6 quiz",
        questions: [
          { key: "evol-y6-01", kind: "single", prompt: "What can fossils tell scientists?", options: ["How to build a house", "What the weather will be like next week in that place","What living things were like millions of years ago", "How fast the Earth is moving"], answer: "What living things were like millions of years ago", explanation: "Fossils are evidence of living things from long ago, so they help us see how life has changed.", difficulty: 1 },
          { key: "evol-y6-02", kind: "single", prompt: "Look at the moth chart. Which kind of moth was better camouflaged on pale birch bark?", options: ["Dark moths", "Pale moths", "Both equally", "Neither"], answer: "Pale moths", explanation: "More pale moths were left alive, so birds found them harder to spot on pale bark.", difficulty: 1, image: { file: "evol-moths.png", alt: MOTH_ALT } },
          { key: "evol-y6-03", kind: "number", prompt: "Look at the moth chart. 40 dark moths were released. How many of them did NOT survive?", answer: 30, explanation: "10 dark moths were still alive out of 40. So 40 − 10 = 30 did not survive.", difficulty: 2, image: { file: "evol-moths.png", alt: MOTH_ALT } },
          { key: "evol-y6-04", kind: "single", prompt: "Why did more pale moths survive on the pale bark?", options: ["They were faster fliers, so they could escape from the birds","They were harder for birds to see, so fewer were eaten", "They were bigger", "Birds like dark food"], answer: "They were harder for birds to see, so fewer were eaten", explanation: "Pale moths match pale bark. Camouflage helped them avoid being eaten.", difficulty: 2, diagnostic: true, image: { file: "evol-moths.png", alt: MOTH_ALT } },
          { key: "evol-y6-05", kind: "single", prompt: "The trees stay pale for hundreds of years. Which is most likely to happen to the moths over many generations?", options: ["More of the moths will be pale", "More of the moths will be dark", "Every moth will turn white when it sees a bird", "The moths will not change at all"], answer: "More of the moths will be pale", explanation: "Pale moths survive better, so more of them have offspring. Over many generations pale moths become more common.", difficulty: 3, image: { file: "evol-moths.png", alt: MOTH_ALT } },
          { key: "evol-y6-06", kind: "short", prompt: "Two puppies from the same parents look slightly different. What word describes the differences between living things of the same kind? (one word)", answer: "variation", accepted: ["variations", "Variation", "variation.", "varation", "variaton", "varriation"], explanation: "Offspring are similar to their parents but not identical. These differences are called variation.", difficulty: 2 },
          { key: "evol-y6-07", kind: "single", prompt: "What is an adaptation?", options: ["A change one animal decides to make on purpose during its own life","A type of fossil", "A kind of food", "A feature that helps a living thing survive in its habitat"], answer: "A feature that helps a living thing survive in its habitat", explanation: "Adaptations, such as thick fur in the cold, help living things survive where they live.", difficulty: 1 },
          { key: "evol-y6-08", kind: "single", prompt: "Which adaptation helps a polar bear to survive in the Arctic?", options: ["Wide wings for flying away from the cold weather","Thick fur and a layer of fat to keep warm", "Gills for breathing", "Large thin leaves"], answer: "Thick fur and a layer of fat to keep warm", explanation: "The Arctic is very cold, so features that keep heat in help polar bears survive.", difficulty: 2, diagnostic: true },
          { key: "evol-y6-09", kind: "single", prompt: "Which adaptation helps a cactus to survive in a desert?", options: ["It has large thin leaves to catch the rain","It grows only in shade", "It stores water in its thick stem", "It has no roots"], answer: "It stores water in its thick stem", explanation: "Deserts have very little rain, so storing water helps the cactus survive dry spells.", difficulty: 2 },
          { key: "evol-y6-10", kind: "single", prompt: "Sam says: “Giraffes stretched their necks to reach leaves and their babies were born with longer necks.” What is wrong with this?", options: ["Giraffes did stretch their necks, but only the mothers passed the longer neck on, not the fathers", "Features gained during life are not passed on. Giraffes born with longer necks survived better and had more offspring", "Giraffes chose to grow longer necks so they could reach the leaves, and their babies copied them", "Nothing is wrong: a feature an animal gains during its life is always passed on to its babies"], answer: "Features gained during life are not passed on. Giraffes born with longer necks survived better and had more offspring", explanation: "Stretching does not change what is inherited. Variation and survival over many generations lead to longer necks.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Fossils", back: "Evidence of living things from millions of years ago." },
        { front: "Extinct", back: "No longer alive anywhere on Earth." },
        { front: "Inherited feature", back: "Passed from parents to offspring, e.g. eye colour." },
        { front: "Is a scar inherited?", back: "No. Features gained during life are not passed on." },
        { front: "Variation", back: "Differences between individuals of the same kind." },
        { front: "Adaptation", back: "A feature that helps a living thing survive in its habitat." },
        { front: "Camouflage", back: "Colours or patterns that help an animal hide." },
        { front: "Evolution", back: "Gradual change in living things over many generations." },
        { front: "How does evolution happen?", back: "Those best suited to the environment survive and have offspring that inherit their features." },
        { front: "Do animals change on purpose?", back: "No. Evolution is slow and works through variation and survival." },
      ],
    },
  },
};
