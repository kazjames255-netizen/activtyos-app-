// KS3 Science — Biology: Nutrition, Digestion & Health (Year 7 nutrition/digestion, Year 8 health/drugs/disease).
// Original content aligned to the DfE KS3 science programme of study (OGL v3.0). Calculation keys are recomputed by _check_s3.ts.
import type { CTopic } from "../types";
import { IMG } from "./_img";
import { sg, mu, sh, nm, build } from "./_h";

export const TOPIC: CTopic = {
  key: "bfunc",
  topic: "Biology — Nutrition, Digestion & Health",
  subject: "Science",
  years: {
    7: {
      year: 7,
      subtopic: "Year 7: nutrition and digestion",
      objectives: [
        "Content of a healthy human diet: carbohydrates, lipids (fats and oils), proteins, minerals, vitamins, fibre and water, and why each is needed.",
        "Calculations of energy requirements in a healthy daily diet; the use of food tests.",
        "The tissues and organs of the human digestive system, including adaptations to function and how the digestive system digests food.",
        "The importance of bacteria in the human digestive system; the role of enzymes.",
      ],
      note: {
        title: "Year 7: what we eat and how we digest it",
        body: `## A balanced diet

| Nutrient | Why we need it |
| --- | --- |
| Carbohydrates | Main source of energy |
| Proteins | Growth and repair |
| Lipids (fats) | Energy store and insulation |
| Vitamins and minerals | Keep the body working (for example iron for red blood cells) |
| Fibre | Helps food move through the gut |
| Water | Needed for all reactions, and to transport substances |

**Food tests:** iodine turns blue-black with starch. Benedict's solution, heated, turns brick-red with sugars. Biuret solution turns purple with protein.

## Digestion

Food is broken down into small soluble molecules that can pass into the blood. **Enzymes** are biological catalysts: they speed up reactions, are not used up, and each works on one type of substance. Amylase breaks starch into sugars, protease breaks proteins into amino acids, and lipase breaks fats into fatty acids and glycerol. The food moves along the gut by **peristalsis**, waves of muscle squeezing.

## Worked example: energy from a label

A biscuit gives 16 kJ per gram. Eating 25 g gives 16 × 25 = **400 kJ**.

## Worked example: why chew?

Chewing cuts food into small pieces. That increases its **surface area**, so enzymes can reach more food and digestion is faster.`,
      },
      quiz: {
        title: "Nutrition & Digestion: Year 7 quiz",
        questions: build("bfunc", 7, [
          sg("Look at the diagram of the digestive system. Which letter shows the small intestine, where most food is absorbed into the blood?", "C", ["A", "B", "D", "E"], "The small intestine is the long, coiled tube where digested food is absorbed. The large intestine (D) frames it and absorbs water.", 1, { img: IMG.digestive }),
          sg("Look at the diagram. Which letter shows the liver, which makes bile?", "E", ["A", "B", "C", "D"], "The liver is the large brown organ. It makes bile, which helps to break up fat droplets.", 2, { img: IMG.digestive }),
          sg("Which nutrient is the body's main source of energy?", "Carbohydrates", ["Proteins", "Vitamins", "Fibre"], "Carbohydrates such as starch and sugars are broken down to release most of our energy. Protein is mainly for growth and repair.", 1),
          sg("A student adds iodine solution to a food sample. The brown colour turns blue-black. Which nutrient is in the food?", "Starch", ["Protein", "Fat (lipid)", "Glucose"], "Iodine solution turns blue-black when starch is present.", 1, { d: true }),
          mu("Which TWO statements about enzymes are true?", ["Enzymes speed up chemical reactions", "Enzymes are used up in the reactions they speed up", "Each enzyme works on a particular type of substance", "Enzymes work equally well at every temperature"], ["Enzymes speed up chemical reactions", "Each enzyme works on a particular type of substance"], "Enzymes are catalysts, so they are not used up. They are specific, and they work best at a certain temperature.", 3),
          sg("Which substances does the enzyme amylase break starch down into?", "Simple sugars", ["Amino acids", "Fatty acids and glycerol", "Vitamins"], "Amylase digests starch (a carbohydrate) into sugars. Protease makes amino acids and lipase makes fatty acids and glycerol.", 2),
          nm("A snack gives 20 kJ of energy in every 1 g. How many kJ of energy are in a 35 g serving?", 700, "Multiply the energy per gram by the mass: 20 × 35 = 700 kJ.", 2, { d: true }),
          sg("A student tests a food with Biuret solution. Which colour shows that protein is present?", "Purple", ["Blue-black", "Brick red", "Cloudy white"], "Biuret solution starts blue and turns purple with protein. Iodine (blue-black) tests for starch, and heated Benedict's (brick red) tests for sugars.", 2),
          sg("What is peristalsis?", "Waves of muscle contractions that push food along the gut", ["The breaking down of food by acid in the stomach", "The absorption of water from undigested food in the large intestine", "The chewing of food in the mouth"], "Circular muscles in the gut wall squeeze behind the food, pushing it along.", 2),
          sg("Why does chewing food thoroughly help digestion?", "It increases the surface area so enzymes can reach more food", ["It turns starch into protein", "It kills the enzymes in the food so they cannot break it down too early", "It warms the food up"], "Smaller pieces have a larger surface area for their volume, so enzymes work on more food at once.", 3),
        ]),
      },
      flashcards: [
        { front: "Which nutrient is needed for growth and repair?", back: "Protein." },
        { front: "Which nutrient is the main source of energy?", back: "Carbohydrates." },
        { front: "Test for starch", back: "Add iodine solution: brown turns blue-black." },
        { front: "Test for protein", back: "Add Biuret solution: blue turns purple." },
        { front: "Test for sugars", back: "Heat with Benedict's solution: blue turns brick red." },
        { front: "What is an enzyme?", back: "A biological catalyst: it speeds up a reaction and is not used up." },
        { front: "Amylase, protease, lipase: what does each break down?", back: "Starch → sugars; protein → amino acids; fats → fatty acids and glycerol." },
        { front: "Where is most food absorbed into the blood?", back: "The small intestine." },
        { front: "What does the large intestine do?", back: "Absorbs water from the undigested food that is left." },
        { front: "What does bile do?", back: "Made in the liver; breaks large fat droplets into smaller ones so lipase can act on them." },
      ],
    },
    8: {
      year: 8,
      subtopic: "Year 8: health, drugs and disease",
      objectives: [
        "The consequences of imbalances in the diet, including obesity, starvation and deficiency diseases.",
        "The effects of recreational drugs (including substance misuse) on behaviour, health and life processes.",
        "Pathogens, how they cause communicable disease, and how the body defends itself, including vaccination.",
        "Interpreting data on health and disease, and evaluating whether it shows cause.",
      ],
      note: {
        title: "Year 8: staying healthy",
        body: `## Diet and health

Too much energy in the diet can lead to **obesity**. Too little causes **starvation**. A lack of one nutrient causes a **deficiency disease**: vitamin C for **scurvy**, vitamin D for **rickets**, and iron for **anaemia**.

## Pathogens and defence

**Pathogens** are microorganisms that cause disease: bacteria, viruses, fungi and protists. The body has barriers: the **skin**, **stomach acid**, and sticky **mucus** in the airways. If pathogens get in, **white blood cells** engulf them or make **antibodies**.

A **vaccine** contains a harmless form of a pathogen. White blood cells make antibodies against it and remember, so a later infection is stopped faster.

## Drugs

Alcohol is a **depressant** (it slows the brain). Cigarette smoke contains **nicotine** (addictive), **tar** (a cause of cancer) and **carbon monoxide** (reduces oxygen carried by the blood).

## Worked example: reading data

A table shows measles cases fall from 120 to 15 per 100 000 as vaccination rises from 55% to 92%. There is a **link**, but to show vaccination is the **cause** we must control other factors such as hygiene and population density.`,
      },
      quiz: {
        title: "Health, Drugs & Disease: Year 8 quiz",
        questions: build("bfunc", 8, [
          sg("Look at the graph. As the percentage of children vaccinated increases, what happens to the number of cases?", "The number of cases falls", ["The number of cases rises", "The number of cases stays the same", "The number of cases rises then falls"], "The points slope downwards from top left to bottom right: more vaccination goes with fewer cases.", 1, { d: true, img: IMG.vacc }),
          nm("Look at the graph. How many cases per 100 000 people were there in the town where 70% of children were vaccinated?", 50, "Go up from 70 on the horizontal axis to the point, then across to the vertical axis to read 50.", 1, { img: IMG.vacc }),
          sg("A student says: \"The graph proves that vaccination alone caused the fall in cases.\" What is the best criticism?", "The graph shows a link, but other differences between the towns could also affect cases", ["Six towns is far too many to use", "Graphs cannot show any link between two things, so no conclusion at all can be drawn from a scatter graph", "The points should have been joined in a curve"], "A pattern shows correlation. To prove cause we would need to control other variables such as hygiene and population density.", 3, { img: IMG.vacc }),
          sg("Which disease is caused by a virus?", "Influenza (flu)", ["Athlete's foot", "Food poisoning caused by Salmonella", "Malaria"], "Flu is a virus. Athlete's foot is a fungus, Salmonella is a bacterium and malaria is caused by a protist.", 2),
          sg("How does a vaccine protect you?", "It contains a harmless form of a pathogen, so white blood cells learn to make antibodies quickly if you meet it later", ["It kills all the bacteria that are already in your blood, so there are none left to make you ill when you meet the pathogen later", "It gives you antibodies made by another person", "It stops you ever being exposed to the pathogen"], "Vaccination trains the immune system (memory) so that a real infection is stopped faster.", 2, { d: true }),
          mu("Which of these are ways the body defends itself against pathogens?", ["The skin acts as a barrier", "Stomach acid kills many bacteria", "White blood cells destroy pathogens", "Red blood cells engulf bacteria"], ["The skin acts as a barrier", "Stomach acid kills many bacteria", "White blood cells destroy pathogens"], "Red blood cells carry oxygen. White blood cells are the ones that engulf pathogens or make antibodies.", 2),
          sg("Which substance in cigarette smoke reduces the amount of oxygen the blood can carry?", "Carbon monoxide", ["Nicotine", "Tar", "Water vapour"], "Carbon monoxide binds to haemoglobin in place of oxygen. Nicotine is the addictive drug and tar causes cancer.", 2),
          sg("A lack of vitamin C in the diet causes which deficiency disease?", "Scurvy", ["Rickets", "Anaemia", "Obesity"], "Scurvy comes from too little vitamin C. Rickets is linked to vitamin D and anaemia to iron.", 1),
          sg("Alcohol is what type of drug?", "A depressant, because it slows down the brain and reactions", ["A stimulant, because it speeds up the brain and reactions", "A painkiller, because it acts on the stomach and gut", "A hallucinogen, because it only affects what you see"], "Alcohol slows down responses, which is why it affects reaction time and judgement.", 2),
          sh("What name is given to microorganisms that cause disease?", "pathogens", ["pathogen", "a pathogen", "pathogenic", "pathogenic microorganisms", "pathogens."], "Bacteria, viruses, fungi and protists that cause disease are called pathogens.", 1),
        ]),
      },
      flashcards: [
        { front: "What is a pathogen?", back: "A microorganism that causes disease." },
        { front: "Name four types of pathogen", back: "Bacteria, viruses, fungi, protists." },
        { front: "Three ways the body stops pathogens getting in", back: "Skin, mucus in the airways, stomach acid." },
        { front: "What do white blood cells do?", back: "Engulf pathogens, or make antibodies to destroy them." },
        { front: "How does a vaccine work?", back: "Harmless pathogen makes white blood cells produce antibodies and 'remember', so later infection is stopped quickly." },
        { front: "Nicotine: what does it do?", back: "It is the addictive substance in tobacco." },
        { front: "Carbon monoxide: what does it do?", back: "Reduces the oxygen carried by red blood cells." },
        { front: "Alcohol is a … drug", back: "Depressant: it slows the brain and reactions." },
        { front: "Vitamin C deficiency", back: "Scurvy." },
        { front: "Correlation versus cause", back: "A link in data does not prove one thing causes the other: other variables must be controlled." },
      ],
    },
  },
};
