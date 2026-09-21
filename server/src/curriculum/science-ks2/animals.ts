// KS2 Science — Animals, including Humans (Years 3–6). Original content aligned to the DfE National Curriculum (OGL v3.0).
// Graph/number keys are recomputed by _check_s2.ts from _s2data.ts (the data that draws the images).
import type { CTopic } from "../types";

const SKEL_ALT = "A simplified drawing of a human skeleton with four bones marked by lettered circles. A points to the skull, B to the ribs, C to the thigh bone in the leg and D to the backbone running down the middle.";
const DIG_ALT = "A simplified drawing of the human digestive system with five parts marked by lettered circles. A points to the mouth at the top, B to the long food pipe below it, C to the bean-shaped stomach, D to the wide tube framing the lower body, and E to the narrow coiled tube inside that frame.";
const CHAIN_ALT = "A food chain drawn as four boxes joined by arrows pointing left to right: nettle leaf, caterpillar, blue tit, sparrowhawk. A note says each arrow means is eaten by.";
const GROW_ALT = "Line graph of typical height against age. At birth 50 centimetres; age 2: 87; age 4: 102; age 6: 115; age 8: 128; age 10: 138; age 12: 149; age 14: 163; age 16: 171; age 18: 173. The line is steepest in the first two years and again around ages 12 to 14.";
const CIRC_ALT = "A simple diagram of blood circulation. A is the heart in the middle, B is the lungs above it and C is the rest of the body below it. A blue arrow carries blood from the heart to the lungs and a red arrow carries it back. A red arrow carries blood from the heart to the rest of the body and a blue arrow carries it back. A key says red means oxygen-rich and blue means oxygen-poor.";
const PULSE_ALT = "Line graph of pulse in beats per minute against time in minutes. It is 70 at minutes 0 and 1, 72 at minute 2, then climbs to 110 at minute 3, 130 at minute 4 and 140 at minutes 5 and 6. After that it falls to 118 at minute 7, 95 at minute 8, 80 at minute 9 and 72 at minute 10.";

export const TOPIC: CTopic = {
  key: "animals",
  topic: "Animals, including Humans",
  subject: "Science",
  years: {
    // ───────────────────────── YEAR 3 ─────────────────────────
    3: {
      year: 3,
      objectives: [
        "Identify that animals, including humans, need the right types and amount of nutrition, and that they cannot make their own food; they get nutrition from what they eat.",
        "Identify that humans and some other animals have skeletons and muscles for support, protection and movement.",
      ],
      note: {
        title: "Year 3: nutrition, skeletons and muscles",
        body: `## Nutrition
Plants make their own food, but **animals cannot**. Animals, including humans, get the nutrition they need from the food they eat. A balanced diet has the right **types** and the right **amounts** of food.

| Nutrient | What it does | Foods |
| --- | --- | --- |
| Carbohydrates | Give energy | Rice, potatoes, pasta |
| Protein | Helps you grow and repair | Fish, eggs, lentils |
| Fats | Store energy, keep you warm | Oils, nuts (only a little) |
| Vitamins and minerals | Keep you healthy | Fruit and vegetables |
| Fibre | Keeps food moving through you | Wholegrain foods |
| Water | Needed by every part of the body | Drinks and fruit |

## Skeletons
A skeleton does three jobs: **support** (holds the body up), **protection** (the skull protects the brain, the ribs protect the heart and lungs) and **movement** (with muscles).

Some animals have a hard skeleton **inside** their body. Others, like beetles, have a hard case on the **outside**. Some, like worms, have no skeleton.

## Muscles
Muscles are joined to bones. A muscle can only **pull** by getting shorter (contracting). Muscles work in pairs: when your arm muscle at the front shortens, your elbow bends. The muscle at the back then shortens to straighten it.

**Worked example 1:** Kai eats pasta before a swimming race. Pasta is a carbohydrate, so it gives energy.

**Worked example 2:** A tortoise's shell protects its soft body. It is part of its skeleton.

**Worked example 3:** You bend your knee. The muscles on the back of your thigh get shorter and pull the lower leg bone.`,
      },
      quiz: {
        title: "Animals, including Humans: Year 3 quiz",
        questions: [
          { key: "animals-y3-01", kind: "single", prompt: "Look at the skeleton. Which letter shows the ribs?", options: ["A", "B", "C", "D"], answer: "B", explanation: "The ribs curve around the middle of the body. That is letter B.", difficulty: 1, image: { file: "animals-skeleton.png", alt: SKEL_ALT } },
          { key: "animals-y3-02", kind: "single", prompt: "Which parts of the body do the ribs protect?", options: ["The heart and lungs", "The brain inside the skull", "The knees", "The eyes"], answer: "The heart and lungs", explanation: "The ribs make a cage around the chest, protecting the heart and lungs. The skull protects the brain.", difficulty: 1 },
          { key: "animals-y3-03", kind: "single", prompt: "Which letter shows the bone that protects the brain?", options: ["D", "C", "B", "A"], answer: "A", explanation: "The skull is the hard case around the brain. It is letter A.", difficulty: 1, image: { file: "animals-skeleton.png", alt: SKEL_ALT } },
          { key: "animals-y3-04", kind: "single", prompt: "How does a muscle make a bone move?", options: ["It gets longer and pushes the bone", "It turns into bone", "It gets shorter and pulls on the bone", "It stays the same and the blood pushes the bone"], answer: "It gets shorter and pulls on the bone", explanation: "Muscles can only pull. When a muscle gets shorter it pulls on the bone it is joined to.", difficulty: 2, diagnostic: true },
          { key: "animals-y3-05", kind: "single", prompt: "Which of these can animals, including humans, NOT do?", options: ["Get nutrition by eating", "Make their own food from sunlight", "Move using muscles", "Grow and repair themselves"], answer: "Make their own food from sunlight", explanation: "Only plants make food using light. Animals must eat plants or other animals to get their nutrition.", difficulty: 2 },
          { key: "animals-y3-06", kind: "multi", prompt: "Which TWO jobs does a skeleton do?", options: ["Supports the body", "Protects soft parts inside", "Digests the food we eat", "Pumps blood around the body"], answer: ["Supports the body", "Protects soft parts inside"], explanation: "A skeleton supports the body and protects organs. Digesting food and pumping blood are done by other organs.", difficulty: 2 },
          { key: "animals-y3-07", kind: "single", prompt: "Which food type mainly helps your body to grow and repair itself?", options: ["Fat", "Fibre", "Protein", "Sugar"], answer: "Protein", explanation: "Protein, found in foods like fish, eggs and beans, is used for growing and repairing the body.", difficulty: 2, diagnostic: true },
          { key: "animals-y3-08", kind: "short", prompt: "Rice, pasta and bread mainly give us energy. What is the name of this type of food? (one word)", answer: "carbohydrates", accepted: ["carbohydrate", "carbs", "carb", "carbohidrates", "carbohidrate", "carbohydrates.", "carbs.", "starch", "starchy foods"], explanation: "Starchy foods such as rice, pasta and bread are carbohydrates. They are the body's main energy source.", difficulty: 2 },
          { key: "animals-y3-09", kind: "single", prompt: "A crab has a hard skeleton on the outside of its body. Why is this useful?", options: ["It supports and protects the soft body inside", "It lets the crab fly", "It makes food for the crab to eat when it cannot find any", "It is used for hearing"], answer: "It supports and protects the soft body inside", explanation: "An outside skeleton is like armour. It holds the body's shape and protects the soft parts.", difficulty: 3 },
          { key: "animals-y3-10", kind: "single", prompt: "Jo says: “Muscles push bones to make them move.” What is wrong with what Jo says?", options: ["Bones push muscles instead", "Nothing, muscles push and pull", "Muscles are joined to the skin, not bones", "Muscles can only pull, by getting shorter"], answer: "Muscles can only pull, by getting shorter", explanation: "A muscle only pulls when it gets shorter. To move a bone back, a different muscle pulls the other way.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Can animals make their own food?", back: "No. They get nutrition from the food they eat." },
        { front: "Three jobs of a skeleton", back: "Support, protection and movement." },
        { front: "What do the ribs protect?", back: "The heart and the lungs." },
        { front: "What does the skull protect?", back: "The brain." },
        { front: "How do muscles move bones?", back: "By getting shorter (contracting) and pulling. They cannot push." },
        { front: "Carbohydrates", back: "Give energy (rice, pasta, potatoes, bread)." },
        { front: "Protein", back: "Helps the body grow and repair (fish, eggs, beans)." },
        { front: "Vitamins and minerals", back: "Keep the body healthy (fruit and vegetables)." },
        { front: "What is a balanced diet?", back: "The right types and amounts of food." },
        { front: "Exoskeleton", back: "A hard skeleton on the outside of the body, like a beetle's or a crab's." },
      ],
    },
    // ───────────────────────── YEAR 4 ─────────────────────────
    4: {
      year: 4,
      objectives: [
        "Describe the simple functions of the basic parts of the digestive system in humans.",
        "Identify the different types of teeth in humans and their simple functions.",
        "Construct and interpret a variety of food chains, identifying producers, predators and prey.",
      ],
      note: {
        title: "Year 4: digestion, teeth and food chains",
        body: `## The digestive system
Digestion breaks food into tiny pieces the body can use.

1. **Mouth:** teeth cut and grind food. Saliva makes it wet.
2. **Food pipe (oesophagus):** squeezes food down to the stomach.
3. **Stomach:** churns food with digestive juices.
4. **Small intestine:** the useful nutrients pass into the blood.
5. **Large intestine:** water is taken back into the body. What is left is waste and leaves the body.

## Teeth
| Type | Job |
| --- | --- |
| Incisors | Cut and bite |
| Canines | Tear and grip |
| Premolars and molars | Crush and grind |

Adults usually have up to 32 teeth. Brush twice a day and limit sugary food and drinks to prevent decay.

## Food chains
A food chain shows what eats what. The arrow means “is eaten by” (or “gives energy to”). It always starts with a **producer**, a plant that makes its own food.

- **Producer:** makes food.
- **Consumer:** eats other living things.
- **Predator:** hunts and eats other animals. **Prey** is the animal that is hunted.

**Worked example 1:** Pondweed → water snail → duck → fox. The producer is pondweed. The duck is a predator of the snail and prey of the fox.

**Worked example 2:** A tooth that is flat and wide at the back of the mouth is a molar. It grinds food.

**Worked example 3:** Grass → rabbit → hawk. If rabbits vanished, hawks would go hungry. The number of hawks would fall.`,
      },
      quiz: {
        title: "Animals, including Humans: Year 4 quiz",
        questions: [
          { key: "animals-y4-01", kind: "single", prompt: "Look at the picture of the digestive system. Which letter shows the stomach?", options: ["E", "C", "B", "D"], answer: "C", explanation: "The stomach is the bean-shaped bag where food is churned. It is letter C.", difficulty: 1, image: { file: "animals-digestive.png", alt: DIG_ALT } },
          { key: "animals-y4-02", kind: "single", prompt: "Look at the picture. In which part do most of the useful nutrients pass from digested food into the blood?", options: ["A", "B", "D", "E"], answer: "E", explanation: "The nutrients pass through the wall of the small intestine into the blood. The small intestine is the long coiled tube, letter E.", difficulty: 3, image: { file: "animals-digestive.png", alt: DIG_ALT } },
          { key: "animals-y4-03", kind: "single", prompt: "Look at the picture. Which letter shows the tube that carries swallowed food down to the stomach?", options: ["B", "A", "D", "E"], answer: "B", explanation: "After you swallow, the food pipe (oesophagus) squeezes the food down to the stomach. It is letter B.", difficulty: 1, image: { file: "animals-digestive.png", alt: DIG_ALT } },
          { key: "animals-y4-04", kind: "single", prompt: "Which type of tooth is pointed and used to tear food?", options: ["Incisor", "Canine", "Molar", "Premolar"], answer: "Canine", explanation: "Canines are pointed for tearing and gripping. Incisors cut and molars grind.", difficulty: 2, diagnostic: true },
          { key: "animals-y4-05", kind: "single", prompt: "Look at the food chain. Which living thing is the producer?", options: ["Sparrowhawk", "Blue tit", "Nettle leaf", "Caterpillar"], answer: "Nettle leaf", explanation: "A producer is a plant that makes its own food. Every food chain starts with one.", difficulty: 2, diagnostic: true, image: { file: "animals-foodchain.png", alt: CHAIN_ALT } },
          { key: "animals-y4-06", kind: "single", prompt: "In the food chain, which animal is both a predator and prey?", options: ["Blue tit", "Nettle leaf", "Caterpillar", "Sparrowhawk"], answer: "Blue tit", explanation: "The blue tit hunts the caterpillar, so it is a predator. The sparrowhawk hunts the blue tit, so the blue tit is also prey.", difficulty: 2, image: { file: "animals-foodchain.png", alt: CHAIN_ALT } },
          { key: "animals-y4-07", kind: "single", prompt: "In this food chain the blue tits only have caterpillars to eat. What would probably happen to the blue tits if almost all the caterpillars died?", options: ["There would be more blue tits", "There would be fewer blue tits", "The nettles would all die at once as well", "Nothing would change"], answer: "There would be fewer blue tits", explanation: "Less food means some blue tits would starve or move away, so their numbers would fall.", difficulty: 3, image: { file: "animals-foodchain.png", alt: CHAIN_ALT } },
          { key: "animals-y4-08", kind: "multi", prompt: "Which TWO statements about the digestive system are true?", options: ["The stomach mixes food with digestive juices", "The large intestine takes water from the food that is left", "Digestion begins in the large intestine", "Teeth are part of the food pipe"], answer: ["The stomach mixes food with digestive juices", "The large intestine takes water from the food that is left"], explanation: "The stomach churns food with juices, and the large intestine takes back water. Digestion begins in the mouth, and teeth are not part of the food pipe.", difficulty: 2 },
          { key: "animals-y4-09", kind: "short", prompt: "What do we call an animal that hunts and eats other animals?", answer: "predator", accepted: ["a predator", "predators", "predator.", "preditor", "predater", "a preditor"], explanation: "A predator hunts other animals for food. The animal it hunts is the prey.", difficulty: 1 },
          { key: "animals-y4-10", kind: "number", prompt: "An adult can have 32 teeth. A child has 20 baby teeth. How many more teeth can the adult have?", answer: 12, explanation: "Subtract the smaller number from the larger: 32 − 20 = 12.", difficulty: 2 },
        ],
      },
      flashcards: [
        { front: "Digestion", back: "Breaking food into tiny pieces the body can use." },
        { front: "Job of the stomach", back: "Churns food with digestive juices." },
        { front: "Job of the small intestine", back: "Nutrients from food pass into the blood." },
        { front: "Job of the large intestine", back: "Takes water back into the body; the rest is waste." },
        { front: "Incisors", back: "Front teeth that cut and bite." },
        { front: "Canines", back: "Pointed teeth that tear and grip." },
        { front: "Molars", back: "Wide back teeth that crush and grind." },
        { front: "Producer", back: "A plant that makes its own food; the start of a food chain." },
        { front: "Predator and prey", back: "A predator hunts; the prey is hunted." },
        { front: "What does an arrow in a food chain mean?", back: "“Is eaten by”: the energy goes to the next living thing." },
      ],
    },
    // ───────────────────────── YEAR 5 ─────────────────────────
    5: {
      year: 5,
      objectives: [
        "Describe the changes as humans develop to old age.",
        "Working scientifically: read and interpret a line graph of growth; compare growth over different age ranges.",
      ],
      note: {
        title: "Year 5: growing up and growing old",
        body: `## Stages of human life
Humans grow and change through life. Before birth a baby grows inside its mother; this is called **gestation**. After birth the main stages are:

| Stage | What happens |
| --- | --- |
| Baby | Grows very fast, drinks milk, needs lots of care |
| Toddler | Learns to walk and talk |
| Child | Keeps growing and learning; baby teeth are replaced |
| Teenager (adolescence) | **Puberty**: the body changes and grows quickly, and feelings can change too |
| Adult | Fully grown; the body is able to have children |
| Older adult | Muscles and joints can weaken, hair goes grey, skin gets thinner |

Everyone changes at a different speed, and that is normal.

## Reading a growth graph
A line graph shows how height changes with age. **Steep** parts of the line mean fast growth. A **flat** part means slow growth.

**Worked example 1:** A girl is 92 cm at age 3 and 118 cm at age 7. She grew 118 − 92 = 26 cm in 4 years.

**Worked example 2:** A boy is 0.6 m tall at age 1 and 1.2 m tall at age 6. He is twice as tall, so his height has doubled in five years.

**Worked example 3:** Two graphs show the same person. The line that goes up most steeply between two ages shows the time of fastest growth.

**Tip:** always find both ages on the bottom axis first, then read the heights from the line, then subtract.`,
      },
      quiz: {
        title: "Animals, including Humans: Year 5 quiz",
        questions: [
          { key: "animals-y5-01", kind: "single", prompt: "Look at the graph. About how tall is the person at age 10?", options: ["138 cm", "128 cm", "149 cm", "115 cm"], answer: "138 cm", explanation: "Find 10 on the bottom axis, go up to the line, then across to the height scale. It reads 138 cm.", difficulty: 1, image: { file: "animals-growth.png", alt: GROW_ALT } },
          { key: "animals-y5-02", kind: "number", prompt: "Look at the graph. How many centimetres did the person grow between age 6 and age 10?", answer: 23, explanation: "Height at 10 is 138 cm and at 6 is 115 cm. Subtract: 138 − 115 = 23.", difficulty: 2, image: { file: "animals-growth.png", alt: GROW_ALT } },
          { key: "animals-y5-03", kind: "single", prompt: "Look at the graph. During which two-year period did the person grow the most?", options: ["Age 6 to 8", "Age 12 to 14", "Age 0 to 2", "Age 16 to 18"], answer: "Age 0 to 2", explanation: "Work out each gain. Age 0 to 2 is 87 − 50 = 37 cm, much more than any other two-year gap.", difficulty: 2, diagnostic: true, image: { file: "animals-growth.png", alt: GROW_ALT } },
          { key: "animals-y5-04", kind: "single", prompt: "What is the name for the time in the teenage years when the body changes as a person grows towards adulthood?", options: ["Gestation", "Infancy", "Old age", "Puberty"], answer: "Puberty", explanation: "Puberty is when a child’s body changes and starts to become an adult’s body.", difficulty: 1 },
          { key: "animals-y5-05", kind: "single", prompt: "Which list shows the human life stages in the correct order?", options: ["Baby, child, toddler, teenager, adult", "Toddler, baby, child, adult, teenager", "Baby, toddler, child, teenager, adult", "Child, baby, toddler, adult, teenager"], answer: "Baby, toddler, child, teenager, adult", explanation: "We grow from baby to toddler, then child, then teenager, then adult.", difficulty: 1 },
          { key: "animals-y5-06", kind: "single", prompt: "Which of these is a change people often notice in old age?", options: ["Baby teeth start to grow", "Muscles and joints can become weaker", "The body grows very quickly in height", "The voice breaks"], answer: "Muscles and joints can become weaker", explanation: "In old age the body slows down. Muscles and joints can weaken and skin becomes thinner.", difficulty: 2 },
          { key: "animals-y5-07", kind: "multi", prompt: "Which TWO things happen during puberty?", options: ["The body grows quickly and changes shape", "Feelings and moods can change more", "Milk teeth begin to grow for the first time", "The body stops needing food"], answer: ["The body grows quickly and changes shape", "Feelings and moods can change more"], explanation: "Puberty brings a growth spurt and emotional changes. Baby teeth grow in infancy, and everyone always needs food.", difficulty: 2, diagnostic: true },
          { key: "animals-y5-08", kind: "single", prompt: "Look at the graph. Which is the best conclusion about ages 16 to 18?", options: ["Growth is fastest of all between the ages of 16 and 18","Most people are close to their adult height by 18", "Growth stopped at age 10", "The person shrank"], answer: "Most people are close to their adult height by 18", explanation: "The line is almost flat from 16 (171 cm) to 18 (173 cm). That means growth has nearly stopped.", difficulty: 3, image: { file: "animals-growth.png", alt: GROW_ALT } },
          { key: "animals-y5-09", kind: "short", prompt: "What is the name for the time before birth when a baby develops inside its mother? (one word)", answer: "gestation", accepted: ["pregnancy", "the gestation", "gestation.", "gestation period", "jestation", "pregnancy."], explanation: "Gestation is the time a baby grows inside its mother before it is born.", difficulty: 2 },
          { key: "animals-y5-10", kind: "number", prompt: "A baby weighs 3 kg. By the age of 2 she weighs 12 kg. She now weighs how many times her birth weight?", answer: 4, explanation: "Divide the new weight by the old weight: 12 ÷ 3 = 4.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "Gestation", back: "The time a baby develops inside its mother before birth." },
        { front: "Order of human life stages", back: "Baby, toddler, child, teenager, adult, older adult." },
        { front: "Puberty", back: "When the body changes and becomes an adult’s body (usually ages 9–14); feelings can change too." },
        { front: "A steep line on a growth graph means…", back: "Fast growth." },
        { front: "A flat line on a growth graph means…", back: "Growth has slowed or stopped." },
        { front: "When is human growth fastest?", back: "As a baby, and again in the teenage growth spurt." },
        { front: "A change in old age", back: "Muscles and joints may weaken; skin gets thinner; hair goes grey." },
        { front: "How do you find how much someone grew?", back: "Read both heights from the graph, then subtract." },
        { front: "Is it normal for people to grow at different rates?", back: "Yes. Everyone develops at their own speed." },
      ],
    },
    // ───────────────────────── YEAR 6 ─────────────────────────
    6: {
      year: 6,
      objectives: [
        "Identify and name the main parts of the human circulatory system, and describe the functions of the heart, blood vessels and blood.",
        "Recognise the impact of diet, exercise, drugs and lifestyle on the way their bodies function.",
        "Describe the ways in which nutrients and water are transported within animals, including humans.",
        "Working scientifically: record data (pulse) and interpret a line graph to support a conclusion.",
      ],
      note: {
        title: "Year 6: the circulatory system and staying healthy",
        body: `## The circulatory system
The **heart** is a muscle that pumps **blood** around the body through **blood vessels**.

| Part | Job |
| --- | --- |
| Heart | Pumps blood |
| Arteries | Carry blood **away** from the heart |
| Veins | Carry blood **back to** the heart |
| Capillaries | Tiny vessels that let oxygen and nutrients pass into the body’s cells, and take waste away |
| Blood | Carries oxygen, nutrients, water and waste |

Blood travels to the **lungs** to pick up oxygen and to the rest of the body to deliver it. Nutrients from digested food and water are also carried by the blood.

## Keeping healthy
- **Exercise** makes the heart stronger.
- A **balanced diet** gives the right nutrients.
- **Drugs** can harm the body. Medicines help when used as directed, but tobacco, alcohol and other drugs can damage the heart, lungs and brain.

## Investigating pulse
Your pulse shows how fast your heart beats. When you exercise your muscles need more oxygen, so the heart beats faster.

**Worked example 1:** A pupil counts 18 beats in 15 seconds. In one minute (4 lots of 15 seconds): 18 × 4 = 72 beats per minute.

**Worked example 2:** After a sprint her pulse rose from 68 to 150. That is a rise of 82 beats per minute.

**Worked example 3:** A fitter heart gets back to its resting rate faster after exercise, because it pumps more blood with each beat.`,
      },
      quiz: {
        title: "Animals, including Humans: Year 6 quiz",
        questions: [
          { key: "animals-y6-01", kind: "single", prompt: "Look at the diagram. Which part is where the blood picks up oxygen?", options: ["A (heart)", "B (lungs)", "C (rest of the body)", "None of them"], answer: "B (lungs)", explanation: "Air is breathed into the lungs, where oxygen passes into the blood.", difficulty: 1, image: { file: "animals-circulation.png", alt: CIRC_ALT } },
          { key: "animals-y6-02", kind: "single", prompt: "Look at the diagram. The blood leaving the lungs is shown in red. Why?", options: ["It is carrying oxygen it picked up in the lungs", "It is full of waste that the body needs to get rid of", "It has stopped moving", "It has lost all its water"], answer: "It is carrying oxygen it picked up in the lungs", explanation: "The key says red means oxygen-rich. Blood that has just passed through the lungs has taken in oxygen.", difficulty: 2, image: { file: "animals-circulation.png", alt: CIRC_ALT } },
          { key: "animals-y6-03", kind: "single", prompt: "What do arteries do?", options: ["Carry blood back to the heart", "Carry blood away from the heart", "Pump the blood", "Make new blood"], answer: "Carry blood away from the heart", explanation: "Arteries take blood away from the heart. Veins bring it back.", difficulty: 2, diagnostic: true },
          { key: "animals-y6-04", kind: "short", prompt: "What are the tiny blood vessels called that let oxygen and nutrients pass into the body’s cells? (one word)", answer: "capillaries", accepted: ["capillary", "the capillaries", "capillaries.", "capilaries", "capilary", "capillarys", "cappillaries"], explanation: "Capillaries are so thin that oxygen and nutrients can pass through their walls into the cells.", difficulty: 3 },
          { key: "animals-y6-05", kind: "single", prompt: "Look at the graph. What was the pupil’s highest pulse?", options: ["130", "140", "118", "110"], answer: "140", explanation: "The highest point on the line is at minutes 5 and 6 and reads 140 beats per minute.", difficulty: 1, image: { file: "animals-pulse.png", alt: PULSE_ALT } },
          { key: "animals-y6-06", kind: "number", prompt: "Look at the graph. By how many beats per minute did the pulse rise from the resting pulse (minute 0) to the highest pulse?", answer: 70, explanation: "Resting pulse is 70 and the highest is 140. Subtract: 140 − 70 = 70.", difficulty: 2, image: { file: "animals-pulse.png", alt: PULSE_ALT } },
          { key: "animals-y6-07", kind: "single", prompt: "Why does the pulse rise during exercise?", options: ["The heart gets tired, so it slows down to have a rest", "The lungs stop working while the muscles are moving", "Blood stops moving round the body during exercise", "The muscles need more oxygen, so the heart beats faster"], answer: "The muscles need more oxygen, so the heart beats faster", explanation: "Working muscles use more oxygen. The heart pumps faster to deliver it.", difficulty: 2, diagnostic: true },
          { key: "animals-y6-08", kind: "number", prompt: "The pupil stopped exercising at minute 6. How many minutes after that did it take for the pulse to fall to 80?", answer: 3, explanation: "The pulse first reads 80 at minute 9. Minute 9 minus minute 6 is 3 minutes.", difficulty: 2, image: { file: "animals-pulse.png", alt: PULSE_ALT } },
          { key: "animals-y6-09", kind: "multi", prompt: "Which TWO habits help keep the heart and blood vessels healthy?", options: ["Regular exercise", "A balanced diet", "Smoking", "Sitting still all day"], answer: ["Regular exercise", "A balanced diet"], explanation: "Exercise strengthens the heart and a balanced diet protects it. Smoking and being inactive harm it.", difficulty: 1 },
          { key: "animals-y6-10", kind: "single", prompt: "Lee did the same exercise as the pupil. At minute 10 his pulse was still 95. What could this suggest?", options: ["Lee is much fitter than the pupil, so his pulse stayed high for longer","Lee’s heart takes longer to recover, so he may be less fit", "Lee did no exercise", "Pulse cannot be measured after exercise"], answer: "Lee’s heart takes longer to recover, so he may be less fit", explanation: "A fitter heart returns to its resting rate faster. The pupil was back to 72 at minute 10, so Lee’s slower recovery suggests he is less fit.", difficulty: 3, image: { file: "animals-pulse.png", alt: PULSE_ALT } },
        ],
      },
      flashcards: [
        { front: "What does the heart do?", back: "It is a muscle that pumps blood around the body." },
        { front: "Arteries", back: "Blood vessels that carry blood away from the heart." },
        { front: "Veins", back: "Blood vessels that carry blood back to the heart." },
        { front: "Capillaries", back: "Tiny vessels where oxygen and nutrients pass into the cells." },
        { front: "What does blood carry?", back: "Oxygen, nutrients, water and waste." },
        { front: "Where does blood pick up oxygen?", back: "In the lungs." },
        { front: "Why does your pulse rise in exercise?", back: "Muscles need more oxygen, so the heart pumps faster." },
        { front: "How to find beats per minute from a 15-second count", back: "Multiply by 4." },
        { front: "Two ways to keep the heart healthy", back: "Regular exercise and a balanced diet." },
        { front: "A fitter heart…", back: "Gets back to its resting rate faster after exercise." },
      ],
    },
  },
};
