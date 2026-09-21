// KS3 Science — Biology: Ecosystems & Interdependence (Year 9). Original content aligned to the DfE KS3 programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { IMG } from "./_img";
import { sg, mu, nm, build } from "./_h";

export const TOPIC: CTopic = {
  key: "becol",
  topic: "Biology — Ecosystems & Interdependence",
  subject: "Science",
  years: {
    9: {
      year: 9,
      objectives: [
        "The interdependence of organisms in an ecosystem, including food webs and insect pollinators.",
        "The importance of plant reproduction through insect pollination in human food security.",
        "How organisms affect, and are affected by, their environment, including the accumulation of toxic materials.",
        "Sampling an ecosystem, including using quadrats, to estimate population size.",
      ],
      note: {
        title: "Year 9: food webs and interdependence",
        body: `## Food chains and webs

A **food chain** starts with a **producer** (a plant that makes food by photosynthesis) and shows who eats whom. **Consumers** eat other organisms: **primary consumers** eat producers, **secondary consumers** eat primary consumers. A **food web** joins many food chains. In food webs the **arrows point in the direction of energy transfer**, from the organism eaten to the one that eats it.

## Interdependence

If one population changes, others change too. Killing all the predators of a species makes the prey population rise (at first). Insect **pollinators** are essential for crops such as apples and beans, so losing them threatens **food security**.

## Toxic chemicals

A poison such as a pesticide can **accumulate**. Small amounts in producers build up in the bodies of the animals that eat them, so top predators can receive a large dose.

## Worked example: estimating a population

A student places 8 quadrats (each 1 m²) at random in a lawn and counts an average of 4 clovers per quadrat. The lawn is 60 m². Estimate = 4 × 60 = **240 clover plants**. Random placement avoids bias, and more quadrats make the estimate more reliable.`,
      },
      quiz: {
        title: "Ecosystems & Interdependence: Year 9 quiz",
        questions: build("becol", 9, [
          sg("Look at the food web. Which organism is the producer?", "Grass", ["Grasshopper", "Mouse", "Owl"], "The producer makes its own food by photosynthesis. Grass is the only plant in this web.", 1, { d: true, img: IMG.foodweb }),
          sg("In the food chain Grass → Grasshopper → Frog → Owl, what is the frog?", "A secondary consumer", ["A producer", "A primary consumer", "A tertiary consumer"], "The grasshopper (first consumer) eats the producer. The frog eats the grasshopper, so it is the second consumer.", 2, { img: IMG.foodweb }),
          mu("Look at the food web. Which organisms eat mice?", ["Fox", "Owl", "Rabbit", "Frog", "Grasshopper"], ["Fox", "Owl"], "Follow the arrows that leave Mouse: they go to Fox and to Owl.", 1, { img: IMG.foodweb }),
          sg("Disease kills all the frogs. What is the most likely immediate effect on the grasshopper population?", "It increases", ["It decreases", "It stays the same", "It disappears"], "Frogs are the only predator of grasshoppers in this web, so fewer are eaten and their numbers rise.", 2, { d: true, img: IMG.foodweb }),
          nm("Look at the food web. How many different food chains go from Grass to Owl?", 2, "Grass → Mouse → Owl, and Grass → Grasshopper → Frog → Owl. There are 2.", 2, { img: IMG.foodweb }),
          sg("What do the arrows in a food web show?", "The direction in which energy is transferred, from the organism eaten to the one that eats it", ["Which organism is bigger, with the arrow always pointing from the smaller organism towards the larger one", "Which organism lives longest", "The organism that hunts by day"], "An arrow means 'is eaten by' and shows energy moving along the chain.", 1),
          sg("A farmer sprays an insecticide that kills most of the insects that pollinate a bean crop. What is the most likely result?", "Fewer flowers are pollinated so fewer beans are produced", ["More beans because there are fewer pests", "No change, because plants can photosynthesise", "More flowers open to attract insects"], "Insect pollinators are needed for many crops. Less pollination gives less fertilisation and fewer seeds and fruit.", 2),
          sg("A pesticide is present in tiny amounts in grass. Why might an owl at the end of the food chain contain a high concentration?", "The chemical builds up in the bodies of organisms along the chain, so the top predator eats many contaminated animals", ["Owls drink more water than other animals, and the pesticide is washed off the grass into the streams and ponds they drink from", "The owl makes the pesticide in its own body", "The pesticide dissolves out of the owl's food"], "Toxic substances that are not broken down accumulate as they pass up the food chain.", 3),
          sg("In a predator–prey relationship, what usually happens to the predator population soon after the prey population increases?", "It increases a little later, because there is more food", ["It decreases straight away, because the extra prey compete with the predators for space", "It stays exactly the same", "It disappears"], "More prey means more food, so predators survive and breed more, after a short delay.", 2),
          nm("A student places 10 quadrats (each 1 m²) at random in a field and finds a mean of 6 daisies per quadrat. The field has an area of 500 m². Estimate the number of daisies in the field.", 3000, "Mean per m² × total area = 6 × 500 = 3000.", 2),
        ]),
      },
      flashcards: [
        { front: "What is a producer?", back: "An organism (a plant) that makes its own food by photosynthesis." },
        { front: "What does a primary consumer eat?", back: "Producers (plants)." },
        { front: "What do arrows in a food web mean?", back: "Direction of energy transfer: 'is eaten by'." },
        { front: "What is a predator? What is prey?", back: "Predator hunts and eats other animals; prey is the animal that is hunted." },
        { front: "Why does removing a predator raise the prey population at first?", back: "Fewer are eaten." },
        { front: "Why are insect pollinators important?", back: "Many crops need pollination to make fruit and seeds: they protect food security." },
        { front: "What is bioaccumulation?", back: "Toxic chemicals building up in the bodies of organisms along a food chain." },
        { front: "What is a quadrat?", back: "A square frame used to sample the number of organisms in a small area." },
        { front: "Estimating a population from quadrats", back: "Mean number per quadrat × (total area ÷ area of one quadrat); place quadrats at random." },
        { front: "What is interdependence?", back: "Organisms in an ecosystem depend on each other for food, pollination and shelter." },
      ],
    },
  },
};
