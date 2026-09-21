// KS3 English — Reading Comprehension (Years 7–9). Original passages written for ActivityOS; aligned to the DfE KS3 English programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_b";

const q7 = qb("rc", 7), q8 = qb("rc", 8), q9 = qb("rc", 9);

export const TOPIC: CTopic = {
  key: "rc",
  topic: "Reading Comprehension",
  subject: "English",
  years: {
    7: {
      year: 7,
      objectives: [
        "Read a wide range of fiction and non-fiction texts closely, and understand increasingly challenging material.",
        "Retrieve, record and summarise information and ideas explicitly stated in a text.",
        "Make inferences and support them with evidence from the text.",
        "Identify how a writer's choice of words affects the reader.",
        "Compare two short texts on purpose and effect.",
      ],
      note: {
        title: "Year 7: reading closely, retrieving and inferring",
        body: `## What you need to know

Good readers do three things: **retrieve** what a text says, **infer** what it suggests, and **explain** how the writer's choices create an effect.

| Skill | What it means | Question starters |
| --- | --- | --- |
| Retrieval | Finding facts that are stated directly (**explicit**) | Where...? How many...? Who...? |
| Inference | Working out what is hinted at but not stated (**implicit**) | What does this suggest? How does he feel? |
| Language effect | Explaining why a word or image was chosen | What is the effect of...? |
| Comparison | Spotting similarities and differences between texts | How do the texts differ in purpose? |

A text's **purpose** is usually to **persuade, inform, entertain** or **describe**. Its **tone** is the writer's attitude (cheerful, sarcastic, anxious...).

## Worked example (PEE)

Extract: *"Tariq gripped the edge of the diving board and stared at the water far below. His knees felt like jelly."*

- **Point:** The writer shows that Tariq is frightened.
- **Evidence:** "gripped the edge of the diving board".
- **Explain:** "Gripped" suggests a tight, desperate hold, as if the board is the only thing keeping him safe, and "knees felt like jelly" shows his body will not obey him.

## Tips

- Always go back to the text: answers must be **supported by evidence**.
- Keep quotations short, and explain a key word rather than copying a whole sentence.
- Decide first whether the question asks you to **find** (retrieve) or to **work out** (infer).`,
      },
      quiz: {
        title: "Reading Comprehension: Year 7 quiz",
        questions: [
          q7.single(
            `Read the extract.\n\nMina pressed her nose against the cold glass of the bus window. Outside, the town she had known all her life shrank into a smudge of grey roofs. In her rucksack, wedged between a spare jumper and a packet of soggy sandwiches, lay the letter she had promised herself she would not open until she was far away. Her fingers kept drifting towards the zip. Not yet, she told herself. Not yet. The driver hummed along to the radio, cheerful and oblivious, and the bus rumbled on towards the hills.\n\nWhere was Mina keeping the letter?`,
            "In her rucksack",
            ["In her coat pocket", "Under her seat", "In the driver's cab"],
            "This is a retrieval question. The text says the letter lay in her rucksack, wedged between a jumper and sandwiches.",
            1,
          ),
          q7.single(
            `Read the extract.\n\nMina pressed her nose against the cold glass of the bus window. Outside, the town she had known all her life shrank into a smudge of grey roofs. In her rucksack, wedged between a spare jumper and a packet of soggy sandwiches, lay the letter she had promised herself she would not open until she was far away. Her fingers kept drifting towards the zip. Not yet, she told herself. Not yet. The driver hummed along to the radio, cheerful and oblivious, and the bus rumbled on towards the hills.\n\nWhat does the repeated “Not yet” suggest about Mina?`,
            "She is tempted to open the letter but is anxious about what it says",
            ["She has forgotten what the letter contains or who sent it", "She is bored and wants the long journey to end soon", "She is angry with the driver for going so slowly"],
            "Repeating “Not yet” shows she keeps wanting to open the letter but is holding herself back, which suggests nerves about its contents.",
            2,
            { d: true },
          ),
          q7.single(
            `Read the extract.\n\nMina pressed her nose against the cold glass of the bus window. Outside, the town she had known all her life shrank into a smudge of grey roofs.\n\nWhat effect does “shrank into a smudge of grey roofs” create?`,
            "It shows the town becoming small, blurred and distant as she leaves it",
            ["It shows that the town has been badly damaged by heavy rain", "It tells us that the roofs are all made of grey slate tiles", "It shows that Mina cannot see properly without glasses"],
            "“Shrank” and “smudge” make the town look tiny and unclear, so the reader feels her leaving her old life behind.",
            2,
          ),
          q7.single(
            `Read the sentence.\n\nThe driver hummed along to the radio, cheerful and oblivious, and the bus rumbled on towards the hills.\n\nWhat does “oblivious” mean here?`,
            "Unaware of what is going on around him",
            ["Unkind to the passengers on his bus", "Unwilling to drive any further that night", "Unhappy with the music on the radio"],
            "“Oblivious” means not noticing. The driver is cheerful because he does not know how tense Mina is.",
            1,
          ),
          q7.single(
            `Read the extract.\n\nWhen a honeybee finds a good patch of flowers, she flies back to the hive and performs a “waggle dance” on the honeycomb. She moves in a figure of eight, shaking her body along the middle stroke. The angle of that middle stroke, compared with straight up, shows the direction of the flowers relative to the sun. The longer she waggles, the further away the flowers are. Other bees crowd round, then fly off to find the food. In this way, a single scout can guide dozens of workers.\n\nAccording to the extract, what does the length of the waggle show?`,
            "How far away the flowers are",
            ["How many flowers there are", "Which direction the flowers lie in", "How sweet the nectar is"],
            "The text says “The longer she waggles, the further away the flowers are.” Direction is shown by the angle, not the length.",
            1,
          ),
          q7.multi(
            `Read the extract.\n\nWhen a honeybee finds a good patch of flowers, she flies back to the hive and performs a “waggle dance” on the honeycomb. She moves in a figure of eight, shaking her body along the middle stroke. The angle of that middle stroke, compared with straight up, shows the direction of the flowers relative to the sun. The longer she waggles, the further away the flowers are. Other bees crowd round, then fly off to find the food. In this way, a single scout can guide dozens of workers.\n\nWhich TWO statements are supported by the extract?`,
            ["The dance takes place on the honeycomb inside the hive", "One scout bee can help many workers find food"],
            ["Bees only dance in the evening", "The dance tells other bees how sweet the nectar is"],
            "The extract mentions the honeycomb and “dozens of workers”. It says nothing about evenings or nectar sweetness.",
            2,
          ),
          q7.single(
            `Read the blog post.\n\nDay 3 of my first ever camping trip, and I have learned three things. One: a tent is not “waterproof” just because the label says so. Two: sheep are louder than my little brother. Three: bacon tastes better outdoors, even when it is slightly burnt and slightly damp. Dad says this is “character-building”. I say it is soggy. But when the mist lifted this morning and the whole valley glowed gold, I forgot to complain for a full ten minutes — which, for me, is a record.\n\nHow does the writer feel about camping overall?`,
            "Mixed: she complains, but is won over by the beauty of the valley",
            ["Completely miserable from the start of the trip to the end", "Entirely delighted with every single part of the trip", "Indifferent, as though she has no real opinion at all"],
            "The jokes about the tent and sheep show frustration, but “glowed gold” and forgetting to complain show she is charmed too.",
            2,
            { d: true },
          ),
          q7.single(
            `Read the blog post.\n\nDay 3 of my first ever camping trip, and I have learned three things. One: a tent is not “waterproof” just because the label says so. Two: sheep are louder than my little brother. Three: bacon tastes better outdoors, even when it is slightly burnt and slightly damp. Dad says this is “character-building”. I say it is soggy.\n\nWhy might the writer have organised her post as “One... Two... Three...”?`,
            "It gives a clear, comic list in which each item adds to the humour",
            ["It gives the reader step-by-step instructions for camping safely", "It shows the writer is being bossy and rude with her father", "It proves that camping has exactly three problems"],
            "A numbered list gives a neat, chatty structure. Each short item is a joke, so the pattern builds humour and personality.",
            3,
          ),
          q7.short(
            `Read the extract.\n\nWhen a honeybee finds a good patch of flowers, she flies back to the hive and performs a “waggle dance” on the honeycomb.\n\nWhich single word in this sentence tells you the scout bee is female?`,
            "she",
            ["She", "\"she\"", "'she'", "“she”", "‘she’"],
            "The pronoun “she” refers to the bee, so it tells us the scout is female.",
            2,
          ),
          q7.single(
            `Compare the two extracts about rain.\n\nText A: Rain fell on Leeds on 22 days last October, according to the weather station, making it the wettest October in a decade.\n\nText B: The rain didn't fall so much as attack: it hammered the roofs, hurled itself at windows and left the streets running like rivers.\n\nWhich comparison is most accurate?`,
            "A uses figures to sound factual; B uses violent verbs to make rain menacing",
            ["Both texts use statistics in order to sound more convincing", "A uses a metaphor while B uses a simile to describe the rain", "B is more reliable than A because its verbs are stronger"],
            "Text A informs with figures. Text B entertains with vivid verbs (“attack”, “hammered”, “hurled”) that make the weather seem hostile.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["Retrieval", "Finding information that is stated directly in the text (it is explicit)."],
        ["Inference", "Working out what a text suggests but does not say, using clues as evidence."],
        ["Explicit vs implicit", "Explicit = stated outright. Implicit = hinted at, so the reader must infer."],
        ["What does PEE stand for?", "Point, Evidence, Explain: make a point, back it with a short quotation, then explain the effect."],
        ["Skimming", "Reading quickly to get the general idea of a text."],
        ["Scanning", "Running your eye over a text to find one specific fact, name or number."],
        ["The four main purposes of writing", "To persuade, to inform, to entertain and to describe."],
        ["Tone", "The writer's attitude to the subject, such as cheerful, sarcastic or anxious."],
        ["Synonym", "A word with the same or a very similar meaning to another word."],
        ["Why keep quotations short?", "Short quotations let you focus on the key word and explain its effect."],
      ]),
    },
    8: {
      year: 8,
      objectives: [
        "Read and analyse non-fiction such as news reports, speeches and travel writing.",
        "Recognise a range of rhetorical devices and their effect on an audience.",
        "Distinguish between fact and opinion, and the writer's purpose and audience.",
        "Make inferences and justify them with well-chosen evidence.",
        "Explain how structure (shifts, openings, endings) shapes meaning.",
      ],
      note: {
        title: "Year 8: non-fiction, rhetoric and structure",
        body: `## What you need to know

In Year 8 you read **newspaper reports, speeches and travel writing**, and explain **how** writers shape a reader's response.

| Text type | Typical features |
| --- | --- |
| Newspaper report | Headline, facts, quotations from people, formal tone, past tense |
| Speech | Direct address, rhetorical questions, repetition, lists of three |
| Travel writing | Sensory detail, figurative language, personal viewpoint |

**Rhetorical devices** you should know: **anaphora** (repeating the start of sentences), the **rule of three**, **rhetorical questions**, **direct address** ("you", "we"), and **emotive language**.

**Structure** means how a text is built: a **shift** in focus or tone (often signalled by *but*, *yet*, *however*) changes how we read what follows.

## Worked example (PEEL)

Extract: *"The market was silent. Then, without warning, the drums began."*

- **Point:** The writer uses a shift to create drama.
- **Evidence:** "Then, without warning, the drums began."
- **Explain:** "Then" marks a sudden change from silence to noise, and "without warning" makes the moment a shock.
- **Link:** This makes the reader feel as startled as the crowd.

## Tips

- **Fact** can be checked; **opinion** is a belief. A quotation from a person is often an opinion.
- Name the device *and* explain its effect on the audience; naming alone earns little.`,
      },
      quiz: {
        title: "Reading Comprehension: Year 8 quiz",
        questions: [
          q8.single(
            `Read the report.\n\nTOWN LIBRARY SAVED BY VOLUNTEERS\n\nResidents of Marlow Green have rescued their library from closure. The council announced last spring that the building would shut because of rising costs. Within a week, more than two hundred residents had signed up to run it themselves. “We couldn't imagine the town without it,” said retired teacher Ade Okoye, 68, who now runs the Saturday story club. The library reopens on Monday with a rota of forty volunteers and a new coffee corner. The council says it will continue to pay the building's heating bills.\n\nHow many residents signed up to run the library within a week?`,
            "More than two hundred",
            ["Forty", "Sixty-eight", "Exactly two hundred"],
            "The report says “more than two hundred residents had signed up”. Forty is the size of the rota, and 68 is Ade's age.",
            1,
          ),
          q8.single(
            `Read the report.\n\nTOWN LIBRARY SAVED BY VOLUNTEERS\n\nResidents of Marlow Green have rescued their library from closure. The council announced last spring that the building would shut because of rising costs.\n\nWhat effect does the word “SAVED” in the headline have?`,
            "It presents the library as being in danger and the volunteers as rescuers",
            ["It suggests that the council did all of the work to save it", "It shows that the library was completely destroyed by fire", "It suggests that the library had already closed for good"],
            "“Saved” implies a threat was overcome, casting the volunteers in a heroic light and framing the story positively.",
            2,
          ),
          q8.single(
            `Read the report.\n\nWithin a week, more than two hundred residents had signed up to run it themselves. “We couldn't imagine the town without it,” said retired teacher Ade Okoye, 68, who now runs the Saturday story club.\n\nWhy does the journalist include Ade Okoye's quotation?`,
            "To give a personal voice that shows how strongly local people feel",
            ["To prove that the council made the wrong decision", "To provide a statistic about how often the library is used", "To explain how the library will be funded in the future"],
            "Quotations from ordinary people add human, emotional evidence. Ade's words show attachment rather than giving facts or figures.",
            2,
            { d: true },
          ),
          q8.multi(
            `Read the speech.\n\nFriends, classmates, teachers: we are told that one person cannot change a school. But who told us that? Not the girl who started our recycling scheme with a single cardboard box. Not the boy who taught himself sign language so nobody in our year would sit alone at lunch. Small acts, repeated, become habits. Habits become culture. And culture — the kind you can feel the moment you walk through those gates — is what we will leave behind. So I ask you: what will you leave?\n\nWhich TWO techniques does the speaker use?`,
            ["Direct address to the audience", "Rhetorical questions"],
            ["Onomatopoeia", "Rhyming couplets"],
            "“Friends, classmates, teachers” addresses the audience directly, and “But who told us that?” and the final question are rhetorical. There is no rhyme or onomatopoeia.",
            1,
          ),
          q8.single(
            `Read the speech.\n\nSmall acts, repeated, become habits. Habits become culture. And culture is what we will leave behind.\n\nWhat is the effect of the way each sentence picks up the last word of the one before?`,
            "It builds a chain of ideas that seems logical and moves steadily to the conclusion",
            ["It makes the speech sound like a rhyming poem that is meant to be sung", "It shows that the speaker has completely run out of new things to say", "It confuses the audience so that they give up and stop arguing back"],
            "Repeating “habits” and “culture” links the ideas like steps in an argument, so the final claim feels earned and inevitable.",
            3,
          ),
          q8.single(
            `Read the speech.\n\nBut who told us that? Not the girl who started our recycling scheme with a single cardboard box. Not the boy who taught himself sign language so nobody in our year would sit alone at lunch.\n\nWhy does the speaker repeat “Not the...”?`,
            "It answers her own question with pupils as examples, building a persuasive pattern",
            ["It shows that she disagrees with what the girl and the boy have done", "It lists the rules that all pupils must follow at this school", "It warns the audience about the pupils who cause trouble in class"],
            "The repeated structure (anaphora) gives concrete examples that prove one person can make a difference, and the rhythm adds momentum.",
            2,
          ),
          q8.single(
            `Read the travel writing.\n\nMarrakech assaults the senses before you have even found your hotel. Scooters whine through alleys barely wider than a wheelbarrow; the air is thick with cumin, mint and woodsmoke; a chorus of stallholders calls out in three languages at once. Yet turn one corner and the noise drops away, as if someone had closed a door, and you are standing in a courtyard where a single fountain trickles into a tiled basin.\n\nWhat does the verb “assaults” suggest about the city?`,
            "That it is overwhelming, even aggressive, at first",
            ["That it is dangerous and should be avoided", "That it is quiet and peaceful", "That the writer has been attacked by a stallholder"],
            "“Assaults” is a metaphor: the sights, sounds and smells hit the visitor all at once. It is figurative, so the writer is not literally attacked.",
            2,
          ),
          q8.single(
            `Read the travel writing.\n\nScooters whine through alleys barely wider than a wheelbarrow; the air is thick with cumin, mint and woodsmoke. Yet turn one corner and the noise drops away, as if someone had closed a door, and you are standing in a courtyard where a single fountain trickles into a tiled basin.\n\nHow does the writer's structure create meaning?`,
            "“Yet” marks a sudden shift from noise to calm, surprising the reader",
            ["It repeats the same idea again so that the reader cannot lose focus", "It moves from the past to the future to show time passing", "It begins and ends with a list of prices in the market"],
            "The first half is crowded and loud; “Yet” signals a contrast. The short journey round a corner mimics how quickly the mood changes.",
            3,
          ),
          q8.multi(
            `Read the travel writing.\n\nScooters whine through alleys barely wider than a wheelbarrow; the air is thick with cumin, mint and woodsmoke; a chorus of stallholders calls out in three languages at once.\n\nWhich TWO senses does the writer mainly appeal to in this sentence?`,
            ["Hearing", "Smell"],
            ["Taste", "Touch"],
            "“Whine” and “chorus… calls out” are sounds; “cumin, mint and woodsmoke” are smells. There is no mention of taste or touch.",
            2,
            { d: true },
          ),
          q8.single(
            `Read the travel writing.\n\nMarrakech assaults the senses before you have even found your hotel. Scooters whine through alleys barely wider than a wheelbarrow. Yet turn one corner and the noise drops away, and you are standing in a courtyard where a single fountain trickles into a tiled basin.\n\nWhat is the main purpose of this extract?`,
            "To describe a place so vividly that the reader can imagine visiting it",
            ["To give step-by-step directions to the reader's hotel", "To argue that scooters should be banned from the old city", "To report the latest political news from the country"],
            "It uses sensory detail and figurative language to create atmosphere, which is typical of travel writing. It is descriptive, not instructional or argumentative.",
            1,
          ),
        ],
      },
      flashcards: cards([
        ["Anaphora", "Repeating the same word or phrase at the start of successive sentences for emphasis."],
        ["Rule of three", "Grouping three items or ideas together because it sounds rhythmic and memorable."],
        ["Rhetorical question", "A question asked for effect that does not need an answer."],
        ["Direct address", "Speaking straight to the audience using “you”, “we” or their names."],
        ["Emotive language", "Words chosen to stir strong feelings such as pity, anger or pride."],
        ["Fact vs opinion", "A fact can be checked and proved; an opinion is a belief or judgement."],
        ["Shift (in structure)", "A change of focus, tone or mood, often signalled by words like “but”, “yet” or “however”."],
        ["What does PEEL add to PEE?", "Link: connect the point back to the question or the writer's overall purpose."],
        ["Why quote people in a news report?", "To add human interest, opinion and credibility."],
        ["Audience", "The people a text is written for; it shapes tone, vocabulary and content."],
      ]),
    },
    9: {
      year: 9,
      objectives: [
        "Read critically: identify subtle inference, tone and implied attitudes.",
        "Evaluate a writer's viewpoint, spotting bias, generalisation and unsupported claims.",
        "Analyse how language and structure work together to create effects.",
        "Compare the ideas, attitudes and methods of two texts.",
        "Use precise terminology and well-chosen embedded quotations.",
      ],
      note: {
        title: "Year 9: inference, evaluation and comparison",
        body: `## What you need to know

In Year 9 the focus shifts from *what* a text says to *how far you should trust it* and *how two writers differ*.

| Skill | What to look for |
| --- | --- |
| Subtle inference | Small details (gestures, pauses, word choices) that reveal hidden feelings |
| Evaluating a viewpoint | **Bias**, **generalisation** ("everyone knows..."), personal anecdote presented as proof, loaded words |
| Tone | Wry, sardonic, ominous, wistful, detached... |
| Comparison | Use connectives such as *whereas*, *similarly*, *in contrast* |

A **generalisation** treats a few cases as if they were true of all. **Loaded language** hides a judgement inside a word ("scandal", "reasonable").

## Worked example (PEEL)

Invented line from an opinion piece on school uniform: *"Only a fool would defend the blazer, and every pupil I have ever met agrees."*

- **Point:** The writer uses loaded language and a sweeping claim to steer the reader.
- **Evidence:** "Only a fool would defend the blazer".
- **Explain:** "Fool" insults anyone who disagrees, and "every pupil I have ever met" is a generalisation from a small sample.
- **Link:** A critical reader should treat the piece as persuasive rather than balanced.

## Tips

- When comparing, keep both texts in view in the *same* paragraph.
- Ask: Who is speaking? What do they want me to feel? What is missing?`,
      },
      quiz: {
        title: "Reading Comprehension: Year 9 quiz",
        questions: [
          q9.single(
            `Read the extract.\n\nThe house on Coldharbour Lane had been empty for so long that the neighbours had stopped noticing it, the way you stop noticing a clock's tick. Then, one October morning, the curtains were open. Nobody had seen anyone arrive.\n\nWhat is the effect of the comparison “the way you stop noticing a clock's tick”?`,
            "It shows the house had faded into the background of everyday life",
            ["It shows that the house is extremely noisy at night", "It tells us that the neighbours are obsessed with time", "It suggests that the house used to be a clockmaker's shop"],
            "A ticking clock is a background sound we tune out. The comparison suggests the empty house was ignored, so the open curtains stand out sharply.",
            2,
          ),
          q9.single(
            `Read the extract.\n\nMrs Pryce, who noticed everything, swore afterwards that she had watched the lane all night from her kitchen window. “Nothing came,” she said, stirring her tea more slowly than tea needs stirring. “Nothing went. And yet.”\n\nWhat does the detail “stirring her tea more slowly than tea needs stirring” suggest?`,
            "She is uneasy and choosing her words carefully",
            ["She is calm and has nothing to hide", "She is annoyed that the tea is too hot", "She is bored by the conversation"],
            "Slow, unnecessary stirring is a nervous gesture that hints at tension. The writer shows her unease rather than stating it.",
            2,
          ),
          q9.single(
            `Read the extract.\n\n“Nothing came,” she said. “Nothing went. And yet.” She let the last two words hang there, like coats on a peg.\n\nWhat is the effect of the unfinished sentence “And yet.”?`,
            "It leaves the mystery open, hinting she knows more than she says",
            ["It shows that she has lost her train of thought", "It proves that a ghost has entered the house", "It makes the conversation feel finished and settled"],
            "The fragment stops before the explanation, so the reader is left to fill the gap. That builds suspense.",
            2,
          ),
          q9.single(
            `Read the extract.\n\nThe house on Coldharbour Lane had been empty for so long that the neighbours had stopped noticing it. Mrs Pryce, who noticed everything, swore afterwards that she had watched the lane all night.\n\nFrom which viewpoint is the extract narrated?`,
            "Third person, from outside the characters",
            ["First person, from Mrs Pryce's viewpoint", "Second person, addressing the reader as “you”", "First person, from a neighbour's viewpoint"],
            "The narrator refers to Mrs Pryce and the neighbours as “she” and “they”, so it is third person.",
            1,
          ),
          q9.short(
            `Read the sentence.\n\nShe let the last two words hang there, like coats on a peg.\n\nName the technique used in “like coats on a peg”.`,
            "simile",
            ["a simile"],
            "The comparison uses the word “like”, so it is a simile.",
            1,
          ),
          q9.single(
            `Read the column.\n\nHomework should be scrapped. Every evening, millions of teenagers slump over kitchen tables to finish tasks they barely understood in class. We are told this builds independence. It does not; it builds resentment, and, occasionally, a suspiciously neat piece of work by a parent. Surely no sensible person believes that a tired brain learns best at nine o'clock at night? Teachers will protest, of course. They always do. But the evidence of any household in the country — mine included — is plain: the homework battle has no winners.\n\nWhat is the effect of the question “Surely no sensible person believes...?”`,
            "It implies that anyone who disagrees is foolish, pressuring the reader to agree",
            ["It invites the reader to weigh both sides and give a balanced answer", "It gives the reader neutral evidence to consider before deciding", "It shows that the writer is unsure of her own opinion on homework"],
            "A rhetorical question with “surely” and “sensible” is loaded: it assumes there is only one reasonable answer.",
            2,
            { d: true },
          ),
          q9.single(
            `Read the column.\n\nHomework should be scrapped. Every evening, millions of teenagers slump over kitchen tables to finish tasks they barely understood in class. We are told this builds independence. It does not; it builds resentment, and, occasionally, a suspiciously neat piece of work by a parent.\n\nWhat is the tone of this column?`,
            "Wry and mocking",
            ["Neutral and scientific", "Sorrowful and defeated", "Fearful and anxious"],
            "Phrases such as “suspiciously neat piece of work by a parent” are humorous and critical, giving the piece a wry, mocking tone.",
            1,
          ),
          q9.single(
            `Read the column.\n\nTeachers will protest, of course. They always do. But the evidence of any household in the country — mine included — is plain: the homework battle has no winners.\n\nWhat weakness is there in the writer's use of “the evidence of any household in the country — mine included”?`,
            "It treats personal experience as if it were proof that applies to everyone",
            ["It gives far too many statistics for the reader to follow easily", "It shows that the writer has not read anything about the topic", "It contradicts the headline of the column that opens the piece"],
            "The claim is a generalisation. One household (or a feeling about many) is not real evidence, though it is made to sound like it.",
            3,
          ),
          q9.single(
            `Compare the two texts.\n\nText A: Council officers confirmed on Tuesday that Fairfield Park's tennis courts will close in March. The £48,000 saved will be spent on resurfacing the town's main road.\n\nText B: Those courts taught half this town to play. Closing them to patch a road is like selling the piano to pay for the stool.\n\nHow do the writers' attitudes differ?`,
            "A is neutral and factual, whereas B is critical and emotional",
            ["A is angry and critical, whereas B is calm and factual", "Both writers are equally critical of the council's decision", "A supports the closure, whereas B is still undecided about it"],
            "Text A reports the decision with figures and no judgement. Text B uses a strong claim and an analogy to show disapproval.",
            2,
            { d: true },
          ),
          q9.single(
            `Read Text B.\n\nThose courts taught half this town to play. Closing them to patch a road is like selling the piano to pay for the stool.\n\nWhat point is the writer making with the comparison “selling the piano to pay for the stool”?`,
            "That the council sacrifices something valuable for something minor",
            ["That the courts are shaped like a large grand piano", "That the council should buy musical instruments for the town", "That tennis is a more musical sport than driving is"],
            "The analogy says: the courts are the valuable piano, and the road is the minor stool. The council's choice looks foolish.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["Bias", "A one-sided view that favours one opinion and ignores or plays down others."],
        ["Generalisation", "Treating something true of a few cases as true of all cases (“everyone knows...”)."],
        ["Loaded language", "Words that carry a hidden judgement, such as “scandal” or “sensible”."],
        ["Analogy", "A comparison that explains an idea by likening it to something more familiar."],
        ["Wry tone", "Dry, mocking humour with a hint of irony."],
        ["Third-person narrator", "Tells the story about “he / she / they”, from outside the characters."],
        ["Implied meaning", "An idea suggested by details, gestures or word choices rather than stated."],
        ["Fragment sentence", "An incomplete sentence used deliberately for suspense or emphasis."],
        ["Comparison connectives", "Whereas, similarly, in contrast, however, both texts..."],
        ["What does “evaluate” mean?", "Judge how effective, convincing or reliable something is, giving reasons."],
        ["Persuasive vs informative", "Persuasive texts try to change your mind; informative texts explain neutrally."],
      ]),
    },
  },
};
