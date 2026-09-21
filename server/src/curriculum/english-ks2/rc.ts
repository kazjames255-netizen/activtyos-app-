// KS2 English — Reading Comprehension (Years 3–6). Original passages and questions aligned to the DfE National Curriculum (OGL v3.0).
// Passage word counts and answer positions are checked by _check_e2.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";
import { build, mu, sg } from "./_h";

const P = (title: string, text: string) => `Read the text.\n\n${title}\n${text}\n\n`;

export const PASSAGES: Record<string, string> = {
  A3: P("Hedgehog in the Allotment", "Mina crept along the muddy path behind her grandad's allotment. The wind rattled the old shed door, and something small moved beneath the cabbage leaves. She held her breath and knelt down. Two bright eyes stared back at her. It was a hedgehog, curled up like a spiky ball. “Hello, little one,” she whispered. She fetched a saucer of water and tiptoed away, careful not to disturb her new visitor."),
  B3: P("All About Honeybees", "Honeybees live together in a nest called a hive. Each hive has one queen, hundreds of male drones and thousands of female workers. The workers collect nectar from flowers and turn it into honey. When a worker finds good flowers, she dances to tell the others where to go. Bees are important because, as they travel between flowers, they carry pollen that helps plants to make seeds."),
  C3: P("The Moon's Night Shift", "When the sun goes to bed and the sky turns blue,\nthe moon puts on her silver shoe.\nShe tiptoes up the stairs of night\nand hangs the stars up, all alight.\nThe owls all hoot, “Well done, well done!”\nThen she yawns and waits for the morning sun.\nEvery cat and every mouse\nsleeps softly in their little house."),
  A4: P("The Lighthouse Keeper's Secret", "Old Mr Farrow had lived alone in the lighthouse for as long as anyone could remember. Every evening, as the sun sank into the sea, he climbed the two hundred steps to light the great lamp. The children of the village whispered that he never slept. But one stormy night, Priya, who had crept up the tower to shelter from the rain, found him fast asleep in his chair with a tiny kitten curled on his lap. The lamp, she noticed, was already shining brightly."),
  B4: P("Why Do Owls Hunt at Night?", "Owls are nocturnal, which means they are most active after dark. Their huge eyes let in as much light as possible, so they can see in gloomy woods. Their ears are just as useful: many owls can find a mouse by sound alone, even under a layer of snow. Soft-edged wing feathers make their flight almost silent, so prey rarely hears them coming. Because so many small animals come out at night, owls have plenty of food."),
  C4: P("Autumn Days", "Conkers tumble, crisp and brown,\nleaves float slowly, drifting down.\nScarves are wrapped and mittens found,\napples roll along the ground.\nSmoke curls up from chimney tops,\nwarm and sweet the toffee pops.\nFires crackle, windows glow,\nfrost paints patterns, silver, slow.\nOwls call out across the night,\nstars are pinpricks, cold and bright.\nEveryone hurries, bright and quick,\nhome for soup and stories thick."),
  A5: P("The Last Bus", "Zara pressed her forehead against the cold window as the bus shuddered away from the station. Behind her, the town shrank into a scatter of orange lights. She had never travelled alone before, and the ticket in her fist had gone limp and damp. Across the aisle, an old man was humming a tune she almost recognised. Every time the bus lurched, her stomach lurched with it. “Only forty minutes,” she told herself firmly. “Grandma will be waiting at the stop.” Then the driver glanced in his mirror, smiled, and gave her a small, encouraging nod."),
  B5: P("Should Our School Have a Garden?", "A school garden would transform our playground. Firstly, growing vegetables teaches pupils where food comes from, which is something many of us have never seen for ourselves. Secondly, working outdoors helps people to concentrate, so lessons would improve too. Some people argue that a garden would be expensive, but seeds cost pennies and local shops have offered to donate tools. Surely a small investment is worth it? Our school should plant the first seed today."),
  C5: P("The Sea at Night", "The sea is a restless sleeper,\nturning and tossing beneath its blanket of dark.\nIts breath is the hiss of the shingle,\nits dreams are the wrecks and the whales.\nA lighthouse blinks like a sleepy eye,\nand the moon, a pale nurse,\ntiptoes across the water\nto check that all is well.\nFar out, a ship's bell murmurs\nlike a lullaby."),
  A6: P("The Inheritance", "The letter had arrived on Tuesday, but Idris had not opened it until now, three days later, in the hush of the empty attic. Dust hung in the light like tiny stars. He turned the envelope over, hesitated, then slid a thumbnail beneath the flap. Inside lay a single brass key and a note in his grandmother's cramped handwriting: “For when you are ready. The blue trunk.” Idris glanced at the corner where the trunk crouched under a sheet, exactly where he had always avoided looking. His heart drummed. Was he ready? He honestly could not say, but the key was already warm in his palm."),
  B6: P("Plastic in the Ocean", "Every year, millions of tonnes of plastic end up in the sea. Some of it is easy to see, such as bottles and bags drifting on the surface, but much of it breaks down into microplastics: tiny fragments that are almost invisible. Marine animals often mistake these fragments for food, and scientists have found them in creatures from tiny plankton to the largest whales. Although many countries have banned single-use bags, campaigners argue that far more action is needed. Recycling helps, but it is not enough. The best solution, according to many experts, is to produce less plastic in the first place."),
  C6: P("Homework Night", "The clock ticks slow as a tortoise.\nThe lamp hums a tired old tune.\nMy pencil drags like an anchor\nthrough a sea of sums that never end.\nDownstairs, the kettle sighs and clicks off.\nOutside, a blackbird is singing,\nloud and careless and free,\nand I wish I could swap places\nwith the boy across the road\nwho is kicking a ball at the moon."),
};
const { A3, B3, C3, A4, B4, C4, A5, B5, C5, A6, B6, C6 } = PASSAGES;

export const TOPIC: CTopic = {
  key: "rc",
  topic: "Reading Comprehension",
  subject: "English",
  years: {
    3: {
      year: 3,
      objectives: [
        "Retrieve and record information from fiction and non-fiction texts.",
        "Draw simple inferences about characters' feelings, thoughts and motives from their actions, using evidence from the text.",
        "Check that a text makes sense and explain the meaning of words in context.",
        "Identify how language (such as similes and rhyme) contributes to meaning in stories and poems.",
      ],
      note: {
        title: "Year 3: finding, inferring and explaining",
        body: `## What you need to know

Good readers do three jobs at once: they **find** facts, they **work out** what is not said, and they **notice** how words are used.

- **Retrieval:** the answer is written in the text. Re-read and find the exact words.
- **Inference:** the answer is not written, but the text gives clues. Use "I think ... because the text says ..."
- **Words in context:** if you do not know a word, read the sentence around it and ask what would make sense.

## Worked example 1: retrieval

Text: "Sam packed a torch, a map and two sandwiches." Question: What did Sam pack to eat? Answer: **two sandwiches**. It is stated in the text.

## Worked example 2: inference

Text: "Ella kept looking at the clock and tapping her foot." Question: How did Ella feel? Clue words: looking at the clock, tapping her foot. Answer: **impatient**, because those actions show she wanted time to go faster.

## Worked example 3: a simile

"The snow was as white as paper" compares snow with paper using **as**. It helps the reader picture the snow.

| Question type | Where is the answer? |
| --- | --- |
| Retrieval | In the text, word for word |
| Inference | Between the lines: clues plus what you know |
| Vocabulary | Use the sentence around the word |`,
      },
      quiz: {
        title: "Reading Comprehension: Year 3 quiz",
        questions: build("rc", 3, [
          sg(A3 + "Where was Mina when she found the hedgehog?", "Behind her grandad's allotment", ["In the school playground", "In her bedroom", "On the beach"], 0, "The first sentence tells us she crept along a path behind her grandad's allotment.", 1),
          sg(A3 + "What did Mina fetch for the hedgehog?", "A saucer of water", ["A bowl of milk", "A bunch of cabbage leaves", "A woolly blanket"], 3, "The passage says she fetched a saucer of water.", 1),
          sg(A3 + "In the text, what does the word “disturb” most nearly mean?", "Bother or wake", ["Feed", "Photograph", "Follow"], 2, "Mina tiptoed away carefully so the hedgehog would be left in peace. To disturb something means to bother or wake it.", 2),
          sg(A3 + "Why did Mina hold her breath?", "She did not want to frighten the hedgehog.", ["She was out of breath from running.", "She could smell something horrible.", "She felt very cold."], 1, "She is being quiet and careful because she has noticed something small moving. Holding your breath helps you stay very still.", 2, true),
          sg(A3 + "The hedgehog is “curled up like a spiky ball”. What does this phrase help the reader to do?", "Picture what the hedgehog looked like", ["Learn the hedgehog's name", "Find out how old it is", "Understand where hedgehogs live"], 0, "A simile compares one thing with another using “like” or “as”. Here it helps us imagine a round, prickly shape.", 3),
          sg(B3 + "How does a worker bee tell the others where good flowers are?", "She dances.", ["She buzzes loudly at the hive door.", "She leaves a trail of pollen.", "She flies in a straight line home."], 1, "The text says that when a worker finds good flowers, she dances to tell the others where to go.", 1),
          mu(B3 + "Which TWO statements are true according to the text?", ["A hive has one queen.", "Drones are female.", "Workers turn nectar into honey.", "Workers never leave the hive."], ["A hive has one queen.", "Workers turn nectar into honey."], "The text says each hive has one queen and that workers turn nectar into honey. Drones are male, and workers collect nectar from flowers.", 2),
          sg(B3 + "Why are bees important to plants?", "They carry pollen that helps plants to make seeds.", ["They eat the leaves so new ones can grow.", "They turn nectar into honey.", "They build their hives inside the flowers."], 2, "The last sentence explains that bees carry pollen between flowers and this helps plants make seeds.", 2, true),
          sg(C3 + "Which word in the poem rhymes with “night”?", "alight", ["stairs", "silver", "hoot"], 3, "Rhyming words end with the same sound. “Night” and “alight” both end in -ight.", 1),
          sg(C3 + "The poem says the moon “puts on her silver shoe” and “tiptoes”. What is the poet doing?", "Making the moon act like a person", ["Telling us how big the moon is", "Explaining why the moon shines", "Describing a real woman"], 1, "The poet gives the moon human actions such as putting on shoes and tiptoeing. This is called personification and makes the poem playful.", 3),
        ]),
      },
      flashcards: [
        { front: "Retrieval question", back: "The answer is stated in the text. Re-read and find the exact words." },
        { front: "Inference", back: "Working out what the text does not say, using clues plus what you already know." },
        { front: "What should you say to justify an inference?", back: "“I think ... because the text says ...” (use evidence)." },
        { front: "How can you work out an unknown word?", back: "Read the sentence around it and ask what would make sense." },
        { front: "Simile", back: "A comparison using “like” or “as”, for example “as white as snow”." },
        { front: "Rhyming words", back: "Words with the same ending sound, such as night and alight." },
        { front: "Skimming", back: "Reading quickly to get the general idea of a text." },
        { front: "Scanning", back: "Looking quickly for a particular word or fact." },
      ],
    },
    4: {
      year: 4,
      objectives: [
        "Retrieve and record information from fiction and non-fiction, including multi-paragraph texts.",
        "Draw inferences about characters' feelings, thoughts and motives, and justify them with evidence.",
        "Discuss words and phrases that capture the reader's interest and imagination.",
        "Identify how language, structure and presentation contribute to meaning.",
        "Recognise different forms of poetry and explain simple figurative language.",
      ],
      note: {
        title: "Year 4: evidence, word choice and poetry",
        body: `## What you need to know

In Year 4 you back up every answer with **evidence** from the text, and you explain the **effect** of the writer's word choices.

- **Find and prove:** quote a short phrase to support your answer.
- **Word choice:** writers pick exact words on purpose. “Sank” is different from “dropped”.
- **Main idea:** in non-fiction, each paragraph usually has a main point.
- **Poetry:** look for rhyme, rhythm and images that help you see and feel the poem.

## Worked example 1: inference with evidence

Text: "Ravi's hands shook as he opened the door." Question: How did Ravi feel? Answer: **nervous**, because his hands shook.

## Worked example 2: word choice

"The dog **crept** towards the biscuit." “Crept” suggests slow, quiet, careful movement, so the dog may be sneaky or nervous.

## Worked example 3: personification

"The wind whispered through the trees." The wind cannot really whisper. The poet gives it a human action to make the sound gentle.

| Technique | Example | Effect |
| --- | --- | --- |
| Simile | as brave as a lion | Helps us picture it |
| Personification | the sun smiled | Brings nature to life |
| Rhyme | ground / found | Gives a musical sound |`,
      },
      quiz: {
        title: "Reading Comprehension: Year 4 quiz",
        questions: build("rc", 4, [
          sg(A4 + "How many steps did Mr Farrow climb to reach the lamp?", "two hundred", ["twenty", "one hundred", "two thousand"], 2, "The text says he climbed the two hundred steps to light the great lamp.", 1),
          sg(A4 + "In the passage, what does the word “crept” mean?", "moved slowly and quietly", ["crawled on hands and knees", "ran as fast as possible", "climbed using a rope"], 1, "Priya was sneaking up the tower to shelter from the rain. Crept means moving slowly and quietly so as not to be noticed.", 2),
          sg(A4 + "Why was the lamp already shining when Priya found Mr Farrow asleep?", "He had lit it earlier, as he did every evening.", ["Priya had lit it herself when she arrived.", "It never needed to be lit, as it shone on its own.", "The kitten had switched it on while curled up."], 3, "The text says he climbed the steps every evening to light the lamp. So he had done it before falling asleep.", 2, true),
          sg(A4 + "The writer says the sun “sank” into the sea. Why is “sank” a better choice than “went”?", "It shows the sun dropping slowly and steadily out of sight.", ["It tells us that the sea beneath the sun is very deep.", "It shows that the sun is in some kind of danger tonight.", "It tells us the exact time at which the sun went down."], 0, "“Sank” paints a picture of something lowering slowly, just as the sun does at sunset.", 3),
          sg(B4 + "In the text, what does the word “nocturnal” mean?", "most active at night", ["able to fly silently", "living in cold places", "hunting only mice"], 1, "The text explains it straight away: nocturnal means most active after dark.", 1),
          mu(B4 + "Which TWO things help owls to hunt in the dark, according to the text?", ["Huge eyes that let in lots of light", "Excellent hearing", "Bright feathers", "Webbed feet"], ["Huge eyes that let in lots of light", "Excellent hearing"], "The text describes their huge eyes and how they can find a mouse by sound. Feather colour and webbed feet are never mentioned.", 2, true),
          sg(B4 + "Why are owls' soft-edged wing feathers useful?", "They make flight almost silent, so prey rarely hears them coming.", ["They keep the owl warm during the coldest winter nights.", "They help the owl to see better in very dim light.", "They let the owl fly much faster than any other bird."], 2, "The text says soft-edged feathers make their flight almost silent so prey rarely hears them.", 2),
          sg(C4 + "Which line of the poem tells you that people are wrapping up warm?", "Scarves are wrapped and mittens found,", ["Apples roll along the ground.", "Leaves float slowly, drifting down.", "Smoke curls up from chimney tops,"], 0, "Scarves and mittens are what we wear to keep warm. The other lines describe things falling or rising.", 1),
          sg(C4 + "The poet writes that “frost paints patterns”. What is the poet doing?", "Giving the frost a human action", ["Telling us how to paint", "Describing an artist at work", "Warning us about the cold"], 3, "Frost cannot really paint. The poet gives it a human action to show how the ice makes pretty patterns. This is personification.", 3),
          sg(C4 + "Which word best describes the mood of the poem?", "cosy", ["scary", "angry", "lonely"], 2, "Warm fires, glowing windows, soup and stories make the poem feel snug and comfortable.", 2),
        ]),
      },
      flashcards: [
        { front: "Why do we use evidence in a comprehension answer?", back: "To prove our answer comes from the text, by quoting or pointing to the exact words." },
        { front: "Personification", back: "Giving human actions or feelings to something that is not human, for example “the wind whispered”." },
        { front: "Effect of a word choice", back: "How the exact word changes what we picture or feel, for example “crept” is quieter than “walked”." },
        { front: "How do you find the main idea of a paragraph?", back: "Ask: what is this whole paragraph mostly about? Often it is in the first sentence." },
        { front: "Mood of a poem", back: "The feeling the poem creates, such as cosy, spooky or cheerful." },
        { front: "Rhyme scheme", back: "The pattern of rhymes at the ends of lines, for example AABB." },
        { front: "Inference sentence starter", back: "“This suggests that ... because ...”." },
        { front: "Nocturnal", back: "Most active at night." },
      ],
    },
    5: {
      year: 5,
      objectives: [
        "Retrieve, record and present information from fiction, non-fiction and poetry.",
        "Draw inferences and justify them with evidence, and predict what might happen from details stated and implied.",
        "Distinguish between statements of fact and opinion.",
        "Identify how language, structure and presentation contribute to meaning, including figurative language.",
        "Explain the effect of a writer's choices and discuss viewpoints and purposes.",
      ],
      note: {
        title: "Year 5: purpose, opinion and the writer's craft",
        body: `## What you need to know

By Year 5 you are asked **why** a writer made a choice, not just what the text says.

- **Purpose:** to entertain, inform, persuade or explain.
- **Fact or opinion:** a fact can be checked. An opinion is what someone thinks or feels.
- **Figurative language:** a **metaphor** says one thing IS another; a **simile** says it is LIKE another.
- **Persuasive tricks:** rhetorical questions, lists of reasons, strong words such as “surely”.

## Worked example 1: fact or opinion

“The school has 300 pupils.” is a **fact** (you could count them). “Our school is the friendliest in town.” is an **opinion**.

## Worked example 2: metaphor

“The road was a ribbon of silver.” The road is not really a ribbon. The writer says it IS one to show how long and shiny it looks.

## Worked example 3: a whole-answer recipe

**Point** (what I think), **Evidence** (the words), **Explain** (why the words show this).

| Word or phrase | What it can show |
| --- | --- |
| “stomped” | anger |
| “Isn't it obvious?” | the writer thinks the answer is clear |
| “First of all, Next” | reasons are organised in order |`,
      },
      quiz: {
        title: "Reading Comprehension: Year 5 quiz",
        questions: build("rc", 5, [
          sg(A5 + "Where did Zara expect her grandma to be?", "At the bus stop", ["At the station", "On the bus", "At Zara's house"], 0, "Zara tells herself that Grandma will be waiting at the stop.", 1),
          sg(A5 + "Why had Zara's ticket “gone limp and damp”?", "She had been gripping it tightly because she was nervous.", ["It had rained heavily on the bus and soaked through it.", "She had spilled a drink over it while sitting down.", "It was a very old ticket that had been used before."], 2, "She had never travelled alone before and held the ticket in her fist. Sweaty, tight hands show how nervous she was.", 2, true),
          sg(A5 + "Which word is closest in meaning to “lurched” in this passage?", "jolted", ["glided", "slowed", "hummed"], 1, "A bus that lurches moves with a sudden, uneven jerk. “Jolted” has the same meaning.", 2),
          sg(A5 + "“Every time the bus lurched, her stomach lurched with it.” What is the effect of repeating “lurched”?", "It links the bus's movement to Zara's nerves, so we feel how anxious she is.", ["It shows the writer ran out of other words to use for the bus.", "It tells us the bus is about to crash into another vehicle.", "It shows that Zara is really enjoying the ride to her grandma's."], 3, "Repeating the word matches Zara's stomach to the bus. Her fear moves just like the bus does.", 3),
          sg(A5 + "What does the driver's small nod suggest?", "He noticed Zara was anxious and wanted to reassure her.", ["He wanted her to get off the bus at the next stop.", "He was checking that her ticket was still valid.", "He was telling her that the bus was running very late."], 0, "The nod is described as encouraging, and he smiled first. He seems kind and to have noticed she was nervous.", 2),
          sg(B5 + "What is the main purpose of this text?", "To persuade readers that the school should have a garden", ["To describe step by step how to grow vegetables", "To tell an exciting story about a school garden", "To explain scientifically how seeds grow into plants"], 2, "The writer gives reasons and ends with “Our school should plant the first seed today”. This is trying to change the reader's mind.", 1),
          sg(B5 + "Which of these is an OPINION?", "A school garden would transform our playground.", ["Local shops have offered to donate tools.", "Seeds cost pennies.", "Growing vegetables shows where food comes from."], 0, "“Would transform” is what the writer believes and cannot be checked. The other statements are facts that could be checked.", 2, true),
          sg(B5 + "Why does the writer ask, “Surely a small investment is worth it?”", "To make readers feel the answer is obvious, without needing a reply", ["Because the writer honestly does not know the answer", "To ask readers to write back with their own ideas", "To show that the writer is unsure about the point"], 3, "This is a rhetorical question. It is used to persuade, not to get an answer.", 3),
          sg(B5 + "What do “Firstly” and “Secondly” help the writer to do?", "Organise the reasons in order so the argument is clear", ["Show that a long time has passed in a story", "Tell readers to be quiet and listen carefully", "Introduce a list of school rules for pupils"], 2, "These words are signposts. They tell the reader that reason one and reason two are coming.", 1),
          sg(C5 + "The poet writes: “The sea is a restless sleeper.” Which technique is this?", "metaphor", ["simile", "alliteration", "rhyme"], 1, "It says the sea IS a sleeper without using “like” or “as”. That is a metaphor.", 2),
        ]),
      },
      flashcards: [
        { front: "Fact vs opinion", back: "A fact can be checked and proved. An opinion is what someone thinks or feels." },
        { front: "Metaphor", back: "Says one thing IS another, for example “the road is a ribbon of silver”." },
        { front: "Simile", back: "Says one thing is LIKE or AS another." },
        { front: "Rhetorical question", back: "A question asked for effect, not to get an answer." },
        { front: "Four writer's purposes", back: "To entertain, to inform, to persuade, to explain." },
        { front: "Signpost words", back: "Words like firstly, next and finally that show how a text is ordered." },
        { front: "PEE for a good answer", back: "Point, Evidence, Explain." },
        { front: "Predicting", back: "Using clues in the text to say what might happen next." },
        { front: "Viewpoint", back: "The attitude or opinion a writer or character has about something." },
      ],
    },
    6: {
      year: 6,
      objectives: [
        "Retrieve, record and present information from a range of texts, including summarising main ideas from more than one paragraph.",
        "Draw inferences and justify them with precise evidence from the text.",
        "Distinguish between fact and opinion and identify writers' viewpoints and tone.",
        "Explain how language, structure and presentation contribute to meaning, including figurative language.",
        "Discuss and evaluate how authors use language, considering the impact on the reader.",
      ],
      note: {
        title: "Year 6: reading between the lines with precision",
        body: `## What you need to know

Year 6 questions often have **more than one plausible answer** and ask you to choose the best one, using evidence.

- **Implicit meaning:** what a text suggests without saying it, through actions, description and word choice.
- **Tone and viewpoint:** how the writer or narrator feels, such as serious, concerned or amused.
- **Summarising:** put the main ideas of several paragraphs into a few words, leaving out detail.
- **Structure:** why a writer uses a word like “although” or ends a paragraph a certain way.

## Worked example 1: implicit meaning

“He checked his watch for the third time and sighed.” This suggests he is **impatient or worried**, and never says so.

## Worked example 2: personification

“The old wardrobe loomed in the corner.” Looming is what a tall figure does when it seems to threaten. It makes the wardrobe feel alive and slightly frightening.

## Worked example 3: the role of “although”

“**Although** the film was long, it was thrilling.” “Although” admits a small criticism, then moves to the writer's real opinion.

| Skill | Sentence starter |
| --- | --- |
| Inference | “This suggests ... because ...” |
| Effect | “The word ... makes the reader feel ...” |
| Summary | “Overall, the text explains that ...” |`,
      },
      quiz: {
        title: "Reading Comprehension: Year 6 quiz",
        questions: build("rc", 6, [
          sg(A6 + "How long did Idris leave the letter unopened?", "three days", ["one day", "a week", "all morning"], 1, "It arrived on Tuesday and he opened it “three days later”.", 1),
          sg(A6 + "Why did Idris hesitate before opening the letter?", "He was anxious about what it might mean.", ["He could not read his grandmother's handwriting.", "He was waiting for someone to help him.", "He was worried the envelope would tear."], 2, "He delayed for days, hesitated, avoided looking at the trunk and his heart drummed. All of these suggest anxiety.", 2, true),
          sg(A6 + "“The trunk crouched under a sheet.” What does this description suggest?", "The trunk seems alive and slightly threatening, like a hiding animal.", ["The trunk is very small and easy to carry.", "The trunk has been moved there quite recently.", "The trunk is made of animal skin or leather."], 0, "Crouching is what an animal or person does before they spring. It makes the trunk feel watchful and a little frightening.", 3),
          sg(A6 + "What does “the key was already warm in his palm” suggest?", "He had been gripping it for some time, so he was more ready than he admitted.", ["The attic was very hot in the afternoon sun.", "The key had just been made in a hot workshop.", "He was afraid of the key and did not touch it."], 3, "For the key to be warm, he must have held it tightly. This hints that he has already decided to go on.", 3),
          sg(B6 + "Which of these statements from the text is an OPINION?", "Far more action is needed.", ["Marine animals often mistake microplastics for food.", "Many countries have banned single-use bags.", "Microplastics have been found in creatures from plankton to whales."], 1, "The text says campaigners argue this. It is a view about what should be done, not something that can be measured. The others are statements that can be checked.", 2, true),
          sg(B6 + "Which is the best summary of the whole text?", "Plastic in the sea harms wildlife, and experts say making less plastic is the best answer.", ["Recycling on its own is the only way to solve plastic pollution in the seas.", "Plastic bags have already been banned in every country in the world.", "Microplastics are much bigger than most of the animals that live in the sea."], 0, "A summary includes the main ideas: the problem, the harm and the main solution. The other options are false or too narrow.", 2),
          sg(B6 + "In the text, what does “argue” mean in “campaigners argue that far more action is needed”?", "put forward a point of view", ["have a noisy quarrel", "shout at someone loudly", "ask a difficult question"], 2, "Campaigners are stating and defending their view, not having a row. Words can have more than one meaning, so check the context.", 2),
          sg(B6 + "Why does the writer begin a sentence with “Although many countries have banned single-use bags”?", "To admit some progress before arguing more is needed", ["To show that all countries have banned bags", "To ask the reader a question", "To give a list of countries"], 3, "“Although” sets up a contrast: something good has happened, but the writer wants to move on to what is still missing.", 3),
          sg(C6 + "“The clock ticks slow as a tortoise.” What does this simile suggest about how the poet feels?", "Time seems to pass very slowly because the poet is bored.", ["The poet keeps a pet tortoise in the house.", "The clock has broken and stopped working altogether.", "The poet is enjoying the quiet evening at home."], 2, "Tortoises are slow, so the simile shows how the clock seems to crawl. That only happens when you wish time would pass faster.", 2),
          sg(C6 + "What does the poet wish for?", "To be outside, free like the blackbird and the boy", ["To finish the sums quickly and win a prize", "To own a football", "To have a quieter house"], 1, "The poet wishes to swap places with the boy who is playing outside, and describes the blackbird as “free”.", 1),
        ]),
      },
      flashcards: [
        { front: "Implicit meaning", back: "Meaning that is suggested, not stated. Find it in actions, description and word choice." },
        { front: "Tone", back: "The attitude in the writing, such as serious, playful, concerned or angry." },
        { front: "How do you summarise?", back: "Give only the main ideas in your own words, and leave out detail and examples." },
        { front: "Why start a sentence with “Although”?", back: "To show contrast: it admits one point before the writer moves on to another." },
        { front: "Words with two meanings", back: "Use the context to choose, for example “argue” can mean quarrel or put forward a view." },
        { front: "Impact on the reader", back: "How the writing makes the reader feel or picture something." },
        { front: "Compare two texts", back: "Say how they are similar and different in purpose, language and viewpoint." },
        { front: "Precise evidence", back: "Quote the fewest words that prove your point." },
      ],
    },
  },
};
