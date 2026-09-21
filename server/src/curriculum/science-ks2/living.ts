// KS2 Science — Living Things & Their Habitats (Years 4, 5 and 6). Original content aligned to the DfE National Curriculum (OGL v3.0).
// Graph/number/key answers are recomputed by _check_s2.ts from _s2data.ts (the data that draws the images).
import type { CTopic } from "../types";

const KEY_ALT = "A branching key. Start: Does it have legs? No leads to: Does it have a shell? Yes gives Snail, no gives Earthworm. Yes leads to: Does it have 6 legs? Yes leads to: Does it have wings? Yes gives Ladybird, no gives Ant. No leads to: Does it have 8 legs? Yes gives Spider, no gives Woodlouse.";
const CYCLE_ALT = "A circular diagram of a butterfly life cycle with arrows going clockwise: egg at the top, caterpillar on the right, a box with a question mark at the bottom, and adult butterfly on the left.";
const GEST_ALT = "Bar chart of about how many days baby mammals grow before birth. Mouse: 20 days. Cat: 65. Sheep: 150. Human: 270. Elephant: 660.";
const GROUPS_ALT = "A table for five animals P to T. Columns: backbone, feathers, hair or fur, damp smooth skin, scales, gills as an adult, feeds babies milk. P has a backbone and feathers only. Q has a backbone, hair or fur and feeds babies milk. R has a backbone and damp smooth skin. S has a backbone, scales and gills as an adult. T has a backbone and scales but no gills.";

export const TOPIC: CTopic = {
  key: "living",
  topic: "Living Things & Their Habitats",
  subject: "Science",
  years: {
    // ───────────────────────── YEAR 4 ─────────────────────────
    4: {
      year: 4,
      objectives: [
        "Recognise that living things can be grouped in a variety of ways.",
        "Explore and use classification keys to help group, identify and name a variety of living things in their local and wider environment.",
        "Recognise that environments can change and that this can sometimes pose dangers to living things.",
      ],
      note: {
        title: "Year 4: grouping living things and changing habitats",
        body: `## Grouping living things
Scientists **classify** (group) living things by what they look like and what they do. Two big groups of animals are **vertebrates** (with a backbone) and **invertebrates** (without a backbone). Plants can be grouped as **flowering** (like daisies) and **non-flowering** (like ferns and mosses).

## Classification keys
A **key** is a set of yes/no questions that helps you identify a living thing. Each answer sends you to another question or to a name. Good questions are about features you can see, such as "Does it have wings?".

**Worked example 1: using a key to sort leaves.** Question 1: "Is the leaf edge smooth?" If yes, it is a beech (its edge is smooth). If no, go to the holly-or-oak question (holly is spiky and oak is wavy-lobed). Keep following your answers until you reach a name.

**Worked example 2: writing a question.** To separate a bee from a worm, ask "Does it have legs?". It is a good question because every animal gives a clear answer.

## Environments can change
A **habitat** is the place where a plant or animal lives. Habitats can change naturally (a flood, a hot summer) or because of people (building on a field, cutting down trees, pollution, litter). Changes can be dangerous when animals lose food or shelter.

**Worked example 3:** A hedge is cut down. Birds lose nesting places and insects lose shelter, so fewer of them may live in that place. Volunteers who plant new hedges help wildlife return.

| Habitat change | Possible effect |
| --- | --- |
| A wood is cut down for a car park | Loss of homes for birds and mammals |
| A river is polluted | Fish and insects may die |
| Wildflower verges are planted | More insects and birds |`,
      },
      quiz: {
        title: "Living Things & Their Habitats: Year 4 quiz",
        questions: [
          { key: "living-y4-01", kind: "single", prompt: "Look at the key. An animal has legs, does not have 6 legs and does not have 8 legs. Which animal is it?", options: ["Snail", "Woodlouse", "Spider", "Ant"], answer: "Woodlouse", explanation: "Follow the key: legs = yes, 6 legs = no, 8 legs = no. That leads to the woodlouse.", difficulty: 3, image: { file: "living-key.png", alt: KEY_ALT } },
          { key: "living-y4-02", kind: "single", prompt: "Look at the key. An animal has legs, has 6 legs and has no wings. Which animal is it?", options: ["Ladybird", "Earthworm", "Ant", "Spider"], answer: "Ant", explanation: "Legs = yes, 6 legs = yes, wings = no. The key leads to the ant.", difficulty: 2, diagnostic: true, image: { file: "living-key.png", alt: KEY_ALT } },
          { key: "living-y4-03", kind: "single", prompt: "Look at the key. Which question separates the ladybird from the ant?", options: ["Does it have legs?", "Does it have wings?", "Does it have a shell?", "Does it have 8 legs?"], answer: "Does it have wings?", explanation: "Both have 6 legs. The ladybird has wings and the ant does not, so the wings question tells them apart.", difficulty: 2, image: { file: "living-key.png", alt: KEY_ALT } },
          { key: "living-y4-04", kind: "multi", prompt: "Look at the key. Which TWO animals have no legs?", options: ["Snail", "Earthworm", "Ant", "Spider"], answer: ["Snail", "Earthworm"], explanation: "Answering “no” to “Does it have legs?” leads to the snail and the earthworm.", difficulty: 1, image: { file: "living-key.png", alt: KEY_ALT } },
          { key: "living-y4-05", kind: "single", prompt: "What are animals with a backbone called?", options: ["Invertebrates", "Insects", "Mammals", "Vertebrates"], answer: "Vertebrates", explanation: "Vertebrates have a backbone. Animals without one are invertebrates.", difficulty: 1 },
          { key: "living-y4-06", kind: "single", prompt: "Which of these plants does NOT make flowers?", options: ["Fern", "Daisy", "Buttercup", "Tulip"], answer: "Fern", explanation: "Ferns are non-flowering plants. They make tiny spores instead of flowers and seeds.", difficulty: 2 },
          { key: "living-y4-07", kind: "single", prompt: "Why do scientists classify living things into groups?", options: ["It helps us to identify and compare them", "It makes them grow bigger", "It changes their colour", "It keeps them safe from all danger in the wild"], answer: "It helps us to identify and compare them", explanation: "Grouping things by their features makes it easier to identify them and to see how they are similar and different.", difficulty: 1 },
          { key: "living-y4-08", kind: "single", prompt: "A meadow is dug up to build houses. What is most likely to happen to the wildflowers and insects that lived there?", options: ["Their numbers fall because their habitat has gone", "Their numbers rise because the new gardens give them more space", "Nothing changes", "They turn into trees"], answer: "Their numbers fall because their habitat has gone", explanation: "When a habitat is destroyed, living things lose their food and shelter, so their numbers usually fall.", difficulty: 2, diagnostic: true },
          { key: "living-y4-09", kind: "multi", prompt: "Which TWO could harm the living things in a pond?", options: ["Chemicals washing in from a road", "Filling the pond in with soil", "Fresh rainwater topping it up", "Planting extra pond plants"], answer: ["Chemicals washing in from a road", "Filling the pond in with soil"], explanation: "Pollution poisons pond life and filling the pond destroys the habitat. Rainwater and new plants usually help.", difficulty: 3 },
          { key: "living-y4-10", kind: "short", prompt: "What is the word for the place where a plant or animal lives?", answer: "habitat", accepted: ["Habitat", "a habitat", "the habitat", "habitat.", "habitats", "habbitat", "habitatt"], explanation: "A habitat is a living thing's home, where it finds food, water and shelter.", difficulty: 2 },
        ],
      },
      flashcards: [
        { front: "Classify", back: "To sort living things into groups by their features." },
        { front: "Vertebrates", back: "Animals with a backbone." },
        { front: "Invertebrates", back: "Animals without a backbone." },
        { front: "Flowering plants", back: "Plants that make flowers and seeds (e.g. daisy)." },
        { front: "Non-flowering plants", back: "Plants that do not flower, e.g. ferns and mosses." },
        { front: "What is a classification key?", back: "A set of yes/no questions used to identify living things." },
        { front: "A good key question", back: "One about a visible feature that gives a clear yes or no." },
        { front: "Habitat", back: "The place where a plant or animal lives." },
        { front: "Two ways people can harm habitats", back: "Building on them and pollution (also cutting down trees)." },
        { front: "A way people can help habitats", back: "Plant hedges and wildflowers; protect nature reserves." },
      ],
    },
    // ───────────────────────── YEAR 5 ─────────────────────────
    5: {
      year: 5,
      objectives: [
        "Describe the differences in the life cycles of a mammal, an amphibian, an insect and a bird.",
        "Describe the life process of reproduction in some plants and animals.",
        "Working scientifically: read and compare data in a bar chart.",
      ],
      note: {
        title: "Year 5: life cycles and reproduction",
        body: `## Life cycles
A **life cycle** is the series of changes a living thing goes through from the start of its life until it can reproduce.

| Animal group | How the young begin | Main stages |
| --- | --- | --- |
| **Mammal** | Grows inside its mother and is born; drinks milk | Baby, child/juvenile, adult |
| **Bird** | Hatches from a hard-shelled egg | Egg, chick, adult |
| **Amphibian** (frog) | Hatches from jelly-covered eggs in water | Spawn, tadpole, froglet, adult |
| **Insect** (butterfly) | Hatches from an egg | Egg, larva (caterpillar), pupa (chrysalis), adult |

An insect such as a butterfly changes body shape completely. This is called **metamorphosis**. Mammals look like small adults when they are born.

## Reproduction in plants and animals
Animals reproduce by having young. Many flowering plants make **seeds** after pollination. Some plants can also make new plants **without seeds**: strawberry plants send out **runners**, potatoes grow from **tubers**, daffodils grow from **bulbs**, and pieces cut from a plant (**cuttings**) can grow roots.

**Worked example 1:** A ladybird lays eggs. A larva hatches, grows, then makes a pupa. An adult ladybird comes out. It is an insect life cycle, with four stages.

**Worked example 2:** A hen sits on eggs and chicks hatch after about three weeks. A hen is a bird.

**Worked example 3: comparing.** If a chart shows an animal with a gestation of 100 days and another with 400 days, the second one takes 4 times as long.

Gestation is the time a mammal's baby grows inside its mother before birth. In general, bigger mammals have longer gestation periods.`,
      },
      quiz: {
        title: "Living Things & Their Habitats: Year 5 quiz",
        questions: [
          { key: "living-y5-01", kind: "single", prompt: "Look at the butterfly life cycle. What is the stage marked with a question mark?", options: ["Grub (larva)", "Pupa (chrysalis)", "Tadpole", "Nymph (young insect)"], answer: "Pupa (chrysalis)", explanation: "A butterfly goes egg, caterpillar (larva), pupa (chrysalis), then adult.", difficulty: 2, diagnostic: true, image: { file: "living-cycle.png", alt: CYCLE_ALT } },
          { key: "living-y5-02", kind: "single", prompt: "Which of these animals has a tadpole stage in its life cycle?", options: ["Cat", "Chicken", "Butterfly", "Frog"], answer: "Frog", explanation: "A frog is an amphibian. Its life cycle goes spawn, tadpole, froglet, adult.", difficulty: 1 },
          { key: "living-y5-03", kind: "single", prompt: "How does a bird begin its life?", options: ["It hatches from an egg with a hard shell", "It is born live from its mother, like a mammal", "It grows from a seed", "It splits from its parent"], answer: "It hatches from an egg with a hard shell", explanation: "Birds lay eggs with hard shells. The chick hatches from the egg.", difficulty: 1 },
          { key: "living-y5-04", kind: "single", prompt: "Which sentence best describes how most mammals begin life?", options: ["They lay eggs with hard shells and sit on them until they hatch","They grow inside their mother, are born, and drink her milk", "They start as larvae", "They start as seeds"], answer: "They grow inside their mother, are born, and drink her milk", explanation: "Most mammals are born live and fed on milk. A few, like the platypus, lay eggs.", difficulty: 2, diagnostic: true },
          { key: "living-y5-05", kind: "single", prompt: "Look at the chart. Which of these animals has the longest gestation period?", options: ["Sheep", "Human", "Mouse", "Elephant"], answer: "Elephant", explanation: "The tallest bar is the longest time. An elephant grows before birth for about 660 days.", difficulty: 1, image: { file: "living-gestation.png", alt: GEST_ALT } },
          { key: "living-y5-06", kind: "number", prompt: "Look at the chart. How many more days is a human’s gestation than a cat’s?", answer: 205, explanation: "Human: 270 days. Cat: 65 days. Subtract: 270 − 65 = 205.", difficulty: 2, image: { file: "living-gestation.png", alt: GEST_ALT } },
          { key: "living-y5-07", kind: "single", prompt: "Doubling a cat’s gestation (65 days) gives 130 days. Which animal in the chart has a gestation closest to that?", options: ["Mouse", "Human", "Elephant", "Sheep"], answer: "Sheep", explanation: "Double 65 to get 130. Sheep (150 days) is the closest. Mouse is 20, human 270 and elephant 660.", difficulty: 3, image: { file: "living-gestation.png", alt: GEST_ALT } },
          { key: "living-y5-08", kind: "single", prompt: "Which list shows the stages in the life cycle of a frog in the right order?", options: ["Tadpole, spawn, adult, froglet", "Adult, spawn, froglet, tadpole", "Spawn, froglet, tadpole, adult", "Spawn, tadpole, froglet, adult"], answer: "Spawn, tadpole, froglet, adult", explanation: "The eggs (spawn) hatch into tadpoles, which grow legs to become froglets, then adult frogs.", difficulty: 2 },
          { key: "living-y5-09", kind: "single", prompt: "Which of these is a way that some plants make new plants WITHOUT seeds?", options: ["Pollination", "Seed dispersal", "Runners", "Germination"], answer: "Runners", explanation: "A strawberry plant grows runners (stems) that root and become new plants. Pollination, dispersal and germination all involve seeds.", difficulty: 3 },
          { key: "living-y5-10", kind: "multi", prompt: "Which TWO stages does a butterfly go through?", options: ["Caterpillar (larva)", "Pupa (chrysalis)", "Tadpole", "Puppy"], answer: ["Caterpillar (larva)", "Pupa (chrysalis)"], explanation: "A butterfly’s life cycle has egg, caterpillar, pupa and adult. Tadpole belongs to frogs and puppy to dogs.", difficulty: 2 },
        ],
      },
      flashcards: [
        { front: "Life cycle", back: "The stages a living thing goes through from birth to reproducing." },
        { front: "Mammal life cycle", back: "Born live, drinks milk, grows into an adult." },
        { front: "Bird life cycle", back: "Egg, chick, adult." },
        { front: "Frog life cycle", back: "Spawn, tadpole, froglet, adult." },
        { front: "Butterfly life cycle", back: "Egg, caterpillar (larva), pupa (chrysalis), adult." },
        { front: "Metamorphosis", back: "A complete change of body shape during a life cycle, as in a butterfly." },
        { front: "Gestation", back: "How long a mammal’s baby grows inside its mother before birth." },
        { front: "Plants making new plants without seeds", back: "Runners, bulbs, tubers and cuttings." },
        { front: "Are amphibians’ young born on land?", back: "No. Frogs lay eggs in water; tadpoles live in water." },
        { front: "Generally, bigger mammals have…", back: "Longer gestation periods." },
      ],
    },
    // ───────────────────────── YEAR 6 ─────────────────────────
    6: {
      year: 6,
      objectives: [
        "Describe how living things are classified into broad groups according to common observable characteristics and based on similarities and differences, including micro-organisms, plants and animals.",
        "Give reasons for classifying plants and animals based on specific characteristics.",
      ],
      note: {
        title: "Year 6: classifying plants, animals and micro-organisms",
        body: `## Big groups of living things
**Vertebrates** (animals with a backbone) are sorted into five groups.

| Group | Key features |
| --- | --- |
| Fish | Scales, gills, fins, live in water |
| Amphibians | Damp smooth skin, young live in water, adults on land and water |
| Reptiles | Dry scaly skin, lay eggs on land |
| Birds | Feathers, wings, lay eggs with hard shells |
| Mammals | Hair or fur, feed young on milk |

**Invertebrates** have no backbone: insects (6 legs), spiders (8 legs), snails, worms and many more.

**Plants** can be **flowering** (seeds made in flowers) or **non-flowering** (ferns and mosses use tiny **spores**; conifers make seeds in cones).

**Micro-organisms** are living things too small to see without a microscope. They include **bacteria** and **fungi** such as **yeast** and moulds. (Viruses are even tinier germs, but scientists do not all agree that they count as living things.) Many are helpful (yeast makes bread rise; some bacteria make yoghurt) and some cause disease or make food go off.

## Using features to classify
Pick the features that best separate one group from another. A whale looks like a fish, but it breathes air and feeds its young milk, so it is a mammal.

**Worked example 1:** An animal has feathers and a beak, and lays eggs. It is a bird.

**Worked example 2:** A creature has six legs, no backbone and three body parts. It is an invertebrate (an insect).

**Worked example 3:** Moss has no flowers and reproduces with spores, so it is a non-flowering plant.`,
      },
      quiz: {
        title: "Living Things & Their Habitats: Year 6 quiz",
        questions: [
          { key: "living-y6-01", kind: "single", prompt: "Look at the table. Which animal is the bird?", options: ["Q", "P", "R", "T"], answer: "P", explanation: "Feathers are the feature that only birds have. Animal P has feathers.", difficulty: 1, image: { file: "living-groups.png", alt: GROUPS_ALT } },
          { key: "living-y6-02", kind: "single", prompt: "Look at the table. Which animal is an amphibian?", options: ["P", "T", "R", "S"], answer: "R", explanation: "Amphibians have damp, smooth skin. Only animal R has that feature.", difficulty: 2, image: { file: "living-groups.png", alt: GROUPS_ALT } },
          { key: "living-y6-03", kind: "single", prompt: "Look at the table. Which animal is a fish?", options: ["P", "Q", "R", "S"], answer: "S", explanation: "Fish have scales and breathe with gills as adults. S has both. T has scales but no gills, so it is a reptile.", difficulty: 2, diagnostic: true, image: { file: "living-groups.png", alt: GROUPS_ALT } },
          { key: "living-y6-04", kind: "single", prompt: "Look at the table. Which feature shows that animal Q is a mammal?", options: ["Has scales", "Has feathers", "Feeds its babies milk", "Has a backbone"], answer: "Feeds its babies milk", explanation: "All the animals in the table have a backbone. Feeding babies milk (and having hair or fur) is what marks out mammals.", difficulty: 2, image: { file: "living-groups.png", alt: GROUPS_ALT } },
          { key: "living-y6-05", kind: "multi", prompt: "Look at the table. Which TWO animals have scales?", options: ["P", "Q", "S", "T"], answer: ["S", "T"], explanation: "The scales column says Yes only for S and T.", difficulty: 2, image: { file: "living-groups.png", alt: GROUPS_ALT } },
          { key: "living-y6-06", kind: "short", prompt: "What word do we use for animals that have no backbone? (one word)", answer: "invertebrates", accepted: ["invertebrate", "Invertebrates", "invertebrates.", "invertabrates", "invertabrate", "invertibrates", "invertibrate", "an invertebrate"], explanation: "Vertebrates have a backbone. Animals without one are invertebrates, like insects, spiders and snails.", difficulty: 1 },
          { key: "living-y6-07", kind: "single", prompt: "Which micro-organism is used to make bread rise?", options: ["Yeast", "Moss", "Fern", "Algae on a pond"], answer: "Yeast", explanation: "Yeast is a tiny fungus. It makes gas that puffs up the dough.", difficulty: 1 },
          { key: "living-y6-08", kind: "single", prompt: "Which statement about micro-organisms is correct?", options: ["All of them are harmful", "They are all plants", "Some are helpful and some can cause disease", "They can all be seen easily without using a microscope"], answer: "Some are helpful and some can cause disease", explanation: "Yeast and some bacteria are useful to us. Other bacteria and moulds cause illness or spoil food.", difficulty: 2, diagnostic: true },
          { key: "living-y6-09", kind: "single", prompt: "Ferns and mosses do not have flowers. What do they use to reproduce?", options: ["Eggs", "Spores", "Bulbs only", "Seeds in fruits"], answer: "Spores", explanation: "Ferns and mosses release tiny spores, not seeds from flowers.", difficulty: 3 },
          { key: "living-y6-10", kind: "single", prompt: "A whale lives in the sea. Which group does it belong to, and why?", options: ["Mammal, because it breathes air and feeds its young milk", "Fish, because it lives in the sea and swims with fins and a tail","Reptile, because it is large", "Amphibian, because it swims"], answer: "Mammal, because it breathes air and feeds its young milk", explanation: "Where an animal lives is not how we classify it. Whales have lungs and feed their young milk, like all mammals.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Five groups of vertebrates", back: "Fish, amphibians, reptiles, birds, mammals." },
        { front: "Feature of fish", back: "Scales, gills and fins." },
        { front: "Feature of amphibians", back: "Damp, smooth skin; young live in water." },
        { front: "Feature of reptiles", back: "Dry scaly skin; lay eggs on land." },
        { front: "Feature of birds", back: "Feathers, wings and hard-shelled eggs." },
        { front: "Feature of mammals", back: "Hair or fur; feed their young on milk." },
        { front: "Invertebrates", back: "Animals with no backbone (insects, spiders, snails, worms)." },
        { front: "Micro-organisms", back: "Living things too small to see without a microscope, e.g. bacteria, yeast and moulds." },
        { front: "Yeast", back: "A micro-organism (a fungus) used to make bread rise." },
        { front: "Non-flowering plants", back: "Ferns and mosses reproduce with spores; conifers make seeds in cones." },
      ],
    },
  },
};
