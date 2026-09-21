// KS1 Science — Animals, including Humans (Years 1–2). Original content aligned to the DfE National Curriculum programme of study (OGL v3.0).
// Structural checks (answers in options, positions, counts) are in _check_s1.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";
import { IMG, multi, short, single } from "./_h";

export const TOPIC: CTopic = {
  key: "animals",
  topic: "Animals, including Humans",
  subject: "Science",
  years: {
    1: {
      year: 1,
      objectives: [
        "Identify and name a variety of common animals, including fish, amphibians, reptiles, birds and mammals.",
        "Identify and name a variety of common animals that are carnivores, herbivores and omnivores.",
        "Describe and compare the structure of a variety of common animals.",
        "Identify, name, draw and label the basic parts of the human body and say which part is associated with each sense.",
      ],
      note: {
        title: "Year 1: animal groups, what animals eat and our senses",
        body: `## Animal groups

Scientists sort animals into groups by what they are like.

| Group | What they are like | Examples |
| --- | --- | --- |
| **Fish** | Live in water, have fins | goldfish, cod, trout |
| **Amphibians** | Start life in water, have damp skin | frog, toad |
| **Reptiles** | Dry scaly skin | snake, lizard, crocodile |
| **Birds** | Feathers, wings and a beak | penguin, eagle, hen |
| **Mammals** | Fur or hair, babies drink milk | cat, dog, human, **dolphin** |

A dolphin lives in the sea like a fish, but it has warm blood, breathes air and feeds its babies milk. So a dolphin is a **mammal**, not a fish.

## What animals eat

- **Herbivores** eat only plants, like a sheep or a giraffe.
- **Carnivores** eat only other animals, like a tiger or a shark.
- **Omnivores** eat both plants and animals, like people.

## Our five senses

| Sense | Body part |
| --- | --- |
| sight | eyes |
| hearing | ears |
| smell | nose |
| taste | tongue (in the mouth) |
| touch | skin (like our hands) |

**Worked example:** a swan has feathers, wings and a beak. That means it is a bird.`,
      },
      quiz: {
        title: "Animals, including Humans: Year 1 quiz",
        questions: [
          single("animals-y1-01", "Which animal is a fish?", ["A frog", "A snake", "A bat", "A salmon"], 3, "A salmon lives in water and has scales and fins, so it is a fish.", 1),
          short("animals-y1-02", "What do we hear with?\nType one word.", "ears", ["ear", "Ears", "our ears", "the ears", "my ears", "the ear", "an ear", "two ears", "ears.", "our ears."], "We hear sounds with our ears. Our ears are the part of the body for hearing.", 1),
          single("animals-y1-03", "Which animal eats only meat?", ["A cow", "A rabbit", "A lion", "A horse"], 2, "A lion is a carnivore. It eats only other animals. Cows, rabbits and horses eat plants.", 1),
          single("animals-y1-04", "Look at the picture.\nWhich letter shows the part we use to smell?", ["A", "B", "C", "D"], 1, "We smell with our nose. That is letter B.", 2, { image: IMG.facesenses }),
          single("animals-y1-05", "Which group is a newt in?", ["Amphibians", "Fish", "Reptiles", "Birds"], 0, "A newt starts life in water and has damp skin. It is an amphibian.", 2, { diagnostic: true }),
          single("animals-y1-06", "Some animals eat plants AND meat.\nWhat are they called?", ["Herbivores", "Carnivores", "Omnivores", "Insects"], 2, "Omnivores eat both plants and animals. People are omnivores.", 2, { diagnostic: true }),
          single("animals-y1-07", "Which animal is a reptile?", ["A frog", "A sparrow", "A hedgehog", "A tortoise"], 3, "A tortoise has dry, scaly skin, so it is a reptile. A frog is an amphibian.", 2),
          multi("animals-y1-08", "Which TWO animals eat only plants?", ["A cow", "A lion", "A rabbit", "A crocodile"], [0, 2], "Cows and rabbits are herbivores. Lions and crocodiles eat meat.", 2),
          single("animals-y1-09", "A bat has fur and feeds its babies milk.\nIt can fly. What is a bat?", ["A bird", "A mammal", "A reptile", "A fish"], 1, "Mammals have fur and feed babies milk. A bat can fly but it is still a mammal.", 3),
          single("animals-y1-10", "Which group has ONLY birds?", ["Owl, moth, robin", "Duck, frog, owl", "Robin, duck, owl", "Owl, robin, butterfly"], 2, "Robins, ducks and owls are all birds. A moth and a butterfly are insects, and a frog is an amphibian.", 3),
        ],
      },
      flashcards: [
        { front: "Name the 5 animal groups", back: "Fish, amphibians, reptiles, birds and mammals." },
        { front: "Mammal", back: "An animal with fur or hair that feeds its babies milk, like a cat, a dolphin or a person." },
        { front: "Bird", back: "An animal with feathers, wings and a beak." },
        { front: "Fish", back: "An animal that lives in water and has scales and fins." },
        { front: "Amphibian", back: "An animal that starts life in water and has soft, damp skin, like a frog or a toad." },
        { front: "Reptile", back: "An animal with dry, scaly skin, like a snake or a lizard." },
        { front: "Herbivore", back: "An animal that eats only plants." },
        { front: "Carnivore", back: "An animal that eats only other animals." },
        { front: "Omnivore", back: "An animal that eats plants and animals, like people." },
        { front: "Which body part do we use to see, hear, smell, taste and touch?", back: "Eyes, ears, nose, tongue and skin." },
      ],
    },
    2: {
      year: 2,
      objectives: [
        "Notice that animals, including humans, have offspring which grow into adults.",
        "Find out about and describe the basic needs of animals, including humans, for survival (water, food and air).",
        "Describe the importance for humans of exercise, eating the right amounts of different types of food, and hygiene.",
      ],
      note: {
        title: "Year 2: growing up and staying alive and healthy",
        body: `## Young animals grow into adults

Animals have babies, called **offspring**. The babies grow up into adults.

| Adult | Baby |
| --- | --- |
| dog | puppy |
| cow | calf |
| horse | foal |
| duck | duckling |
| goat | kid |

Some animals change a lot as they grow. This is a **life cycle**. A duck goes from egg, to duckling, to duck. A person goes from baby, to child, to teenager, to adult.

Some animals, like frogs and butterflies, look very different when they are young. They change a lot before they are adults.

## What animals need to survive

All animals, including people, need **water**, **food** and **air**.

## Staying healthy

- **Exercise** keeps our heart and body strong.
- Eat **different types of food** in the **right amounts**. Too many sugary foods are not healthy.
- **Hygiene**: wash your hands before eating and after using the toilet. This stops germs spreading.

**Worked example:** a duckling needs food, water and air. As it grows, it becomes a duck.`,
      },
      quiz: {
        title: "Animals, including Humans: Year 2 quiz",
        questions: [
          single("animals-y2-01", "What is a baby cat called?", ["A kitten", "A puppy", "A calf", "A lamb"], 0, "A baby cat is a kitten. A puppy is a baby dog.", 1),
          single("animals-y2-02", "What is a baby sheep called?", ["A cub", "A foal", "A calf", "A lamb"], 3, "A baby sheep is a lamb. A calf is a baby cow.", 1),
          single("animals-y2-03", "Which one helps keep us clean and healthy?", ["Eating only sweets", "Washing your hands", "Sitting still all day", "Never drinking water"], 1, "Washing your hands stops germs spreading. This is good hygiene.", 1),
          single("animals-y2-04", "Which is a healthy way to eat?", ["Only crisps and chips every day", "Lots of different foods, in the right amounts", "Sweets and cake at every meal", "The same one food every day"], 1, "Our bodies need different types of food, not too much of any one type.", 2),
          single("animals-y2-05", "Frogspawn is a jelly of eggs.\nWhat do the eggs turn into first?", ["A frog straight away", "A caterpillar", "A tadpole", "A chrysalis"], 2, "Frog eggs hatch into tadpoles. Later the tadpoles grow into frogs.", 2, { diagnostic: true }),
          single("animals-y2-06", "Egg, then caterpillar, then chrysalis.\nWhat comes next?", ["A tadpole", "A worm", "A spider", "A butterfly"], 3, "A butterfly's life cycle goes egg, caterpillar, chrysalis, butterfly.", 2),
          multi("animals-y2-07", "Which THREE do people need to stay alive?", ["Water", "Air", "Toys", "Food"], [0, 1, 3], "All animals, including people, need water, air and food. Toys are fun but we do not need them to live.", 2, { diagnostic: true }),
          single("animals-y2-08", "Why is exercise good for us?", ["It makes us shorter and smaller", "It means we do not need water", "It keeps our heart and body strong", "It stops us from growing taller"], 2, "Exercise, like running and playing, keeps our heart and body strong.", 2),
          single("animals-y2-09", "Tom says: 'People do not need air.'\nIs he right?", ["Yes, he is right", "No, people need air to live", "No, only birds need air", "Yes, only babies need air"], 1, "All animals, including people, need air to live. Tom is wrong.", 3),
          single("animals-y2-10", "Which shows a hen growing up, in order?", ["Chick, egg, hen", "Hen, chick, egg", "Egg, hen, chick", "Egg, chick, hen"], 3, "A hen starts as an egg. The egg hatches into a chick. The chick grows into a hen.", 3),
        ],
      },
      flashcards: [
        { front: "Offspring", back: "The young (babies) of an animal." },
        { front: "Baby dog, cow, horse, duck", back: "Puppy, calf, foal, duckling." },
        { front: "Life cycle of a frog", back: "Frogspawn (eggs), tadpole, frog." },
        { front: "Life cycle of a butterfly", back: "Egg, caterpillar, chrysalis, butterfly." },
        { front: "Life cycle of a duck", back: "Egg, duckling, duck." },
        { front: "What do all animals, including people, need to survive?", back: "Water, food and air." },
        { front: "Why do we exercise?", back: "It keeps our heart and body strong and healthy." },
        { front: "Healthy eating", back: "Eat lots of different types of food, in the right amounts." },
        { front: "Hygiene", back: "Keeping clean, like washing your hands, to stop germs spreading." },
        { front: "Life cycle", back: "The stages an animal goes through as it grows up." },
      ],
    },
  },
};
