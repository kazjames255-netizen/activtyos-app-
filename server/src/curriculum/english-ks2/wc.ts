// KS2 English — Writing: Composition (Years 3–6). Original content aligned to the DfE National Curriculum, English writing composition (OGL v3.0).
// Auto-marked only (single/multi): each item asks about ORIGINAL sample sentences and paragraphs. No tutor-marked "written" questions at KS2.
import type { CTopic } from "../types";
import { build, mu, sg } from "./_h";

export const TOPIC: CTopic = {
  key: "wc",
  topic: "Writing — Composition",
  subject: "English",
  years: {
    3: {
      year: 3,
      objectives: [
        "Plan writing by discussing writing similar to that which they are planning to write, and by saying aloud their ideas.",
        "Organise paragraphs around a theme, and use headings and sub-headings in non-fiction.",
        "In narratives, create settings, characters and a simple plot with a beginning, a problem, a solution and an ending.",
        "Use simple conjunctions to join ideas, and propose changes to improve their writing.",
        "Proof-read for spelling and punctuation errors.",
      ],
      note: {
        title: "Year 3: plan it, write it, check it",
        body: `## What you need to know

Strong writers **plan** before they write and **check** afterwards.

- **A simple story** has four parts: **beginning** (meet the character and setting), **problem**, **solution**, **ending**.
- **A setting** sentence tells the reader where and what it is like: “The kitchen smelled of toast and warm butter.”
- **Paragraphs** group sentences about one idea. Start a new paragraph when the time, place, person or topic changes.
- **Non-fiction** uses **headings** and **subheadings** so readers can find facts quickly.
- **Checking:** read your work aloud. Look for capital letters, full stops, spellings and words that are missing.

## Worked example 1: a story plan

| Part | Idea |
| --- | --- |
| Beginning | Jas flies his new kite on the hill |
| Problem | A gust of wind snatches it away |
| Solution | A friendly farmer helps him get it down from a tree |
| Ending | Jas ties the string to his wrist for next time |

## Worked example 2: subheadings

A report on penguins could have the subheadings **Where They Live** and **What They Eat**. Each subheading tells you what the section is about.

## Worked example 3: joining ideas

“The kite got stuck. Jas was upset.” → “The kite got stuck, so Jas was upset.” The word **so** joins the two ideas.`,
      },
      quiz: {
        title: "Writing — Composition: Year 3 quiz",
        questions: build("wc", 3, [
          sg("Which is the best order for a simple story?", "beginning, problem, solution, ending", ["ending, beginning, problem, solution", "solution, problem, ending, beginning", "problem, ending, beginning, solution"], 0, "A simple story starts by introducing the character, then a problem happens, it is solved, and the story ends.", 1),
          sg("Which sentence describes a SETTING?", "The old cave was dark and damp, and water dripped from the roof.", ["Tom shouted for help as loudly as he could.", "Suddenly, the heavy rock fell from the roof.", "She felt scared and wanted to run home."], 0, "A setting sentence tells us where we are and what it is like. The other sentences describe actions or feelings.", 1),
          sg("When should a writer start a new paragraph?", "When the writing moves to a new time, place or topic", ["After every single sentence you write", "Only when you reach the end of the page", "When the pen runs out of ink or paper"], 2, "A paragraph holds sentences about one theme. A change of time, place or topic is the signal to start a new one.", 2, true),
          sg("A report about volcanoes has a section on what comes out of them. Which subheading fits best?", "What Erupts from a Volcano", ["My Summer Holiday in Spain", "Once Upon a Time There Was", "Dear Sir or Madam, I am writing"], 3, "A subheading tells the reader what the section is about. Only “What Erupts from a Volcano” matches the topic of the section.", 1),
          sg("Which sentence uses the wrong homophone?", "Can you sea the rainbow?", ["We sat by the sea.", "Please close the door.", "The bird flew over the hill."], 1, "“Sea” is the water. The sentence needs “see”, meaning to look at something with your eyes.", 2),
          sg("Which is the best way to join these two sentences? It was raining. We stayed inside.", "It was raining, so we stayed inside.", ["It was raining we stayed inside.", "It was raining and so but we stayed inside.", "It was raining. so we stayed inside."], 0, "The conjunction so shows that staying inside was the result of the rain. A comma goes before it.", 2, true),
          sg("A writer is planning a story about a lost puppy. Which idea would make the best PROBLEM?", "The puppy runs off in the park and cannot be found.", ["The puppy likes eating biscuits after every walk.", "It is a sunny day and the park is very busy.", "The puppy has a red collar with a little silver bell."], 3, "The problem is the thing that goes wrong. The puppy going missing is something the characters must solve.", 2),
          mu("Which TWO features would you find in a non-fiction leaflet?", ["Headings", "Once upon a time", "Facts", "Conversations between characters"], ["Headings", "Facts"], "Non-fiction texts give facts and use headings to organise them. Story openings and conversations belong in fiction.", 2),
          sg("Read: “Frogs lay their eggs in ponds. The eggs hatch into tadpoles. My cousin has a blue bike. The tadpoles grow legs and become frogs.” Which sentence does not belong in this paragraph?", "My cousin has a blue bike.", ["The eggs hatch into tadpoles.", "Frogs lay their eggs in ponds.", "The tadpoles grow legs and become frogs."], 1, "Every sentence in a paragraph should be about the same theme. The other sentences are all about the life of a frog.", 3),
          sg("Which sentence has TWO errors?", "we went too the beach.", ["The dogs barked loudly.", "It was cold, so we wore coats.", "She ran quickly."], 0, "It needs a capital letter at the start (We), and “too” should be “to”. That makes two mistakes.", 3),
        ]),
      },
      flashcards: [
        { front: "Four parts of a simple story", back: "Beginning, problem, solution, ending." },
        { front: "Setting", back: "Where and when the story happens, and what it is like." },
        { front: "When do you start a new paragraph?", back: "When the time, place, person or topic changes." },
        { front: "Heading vs subheading", back: "A heading names the whole text; a subheading names one section." },
        { front: "Which conjunction shows a result?", back: "so" },
        { front: "Proof-reading checklist", back: "Capital letters, full stops, spellings, missing words." },
        { front: "Why plan before writing?", back: "To organise your ideas so the writing has a clear order." },
        { front: "Reading your work aloud helps you...", back: "Hear mistakes and missing words." },
      ],
    },
    4: {
      year: 4,
      objectives: [
        "Plan writing by discussing models and identifying the structure, vocabulary and grammar used.",
        "Organise paragraphs around a theme; in narratives, create settings, characters and plot using a five-part structure.",
        "Use fronted adverbials, expanded noun phrases and pronouns to improve and link writing.",
        "Punctuate speech and start a new line for each new speaker.",
        "Keep tense consistent, and assess and improve the effectiveness of their own and others' writing.",
      ],
      note: {
        title: "Year 4: structure, detail and keeping it consistent",
        body: `## What you need to know

- **Five-part story:** **opening** (who and where), **build-up** (things start to happen), **problem** (the big moment), **resolution** (it is sorted out), **ending** (how things finish).
- **Dialogue:** start a new line every time a different person speaks.
- **Detail:** use **fronted adverbials** (Before dawn, ...) and **expanded noun phrases** (the rusty gate with the broken latch).
- **Cohesion:** use pronouns so you do not repeat names, and linking words such as **later** and **meanwhile**.
- **Tense:** choose past or present and stick to it.

## Worked example 1: pronouns

“Tom put on Tom's coat and Tom went out.” is clumsy. Better: “Tom put on his coat and went out.”

## Worked example 2: tense

“Yesterday, Ella walked to school. She waves to her friend.” The second sentence slips into the present tense. Fix: “She waved to her friend.”

## Worked example 3: dialogue

“Are you ready?” asked Ana.

“Nearly,” said Sam.

A different person speaks, so there is a new line.

| Story part | Job |
| --- | --- |
| Opening | Introduce character and setting |
| Problem | The moment things go wrong |
| Resolution | The problem is solved |`,
      },
      quiz: {
        title: "Writing — Composition: Year 4 quiz",
        questions: build("wc", 4, [
          sg("In a story, when should you start a new line for dialogue?", "When a different person starts speaking", ["After every full stop in the story", "Only at the very end of a chapter", "Whenever any character shouts loudly"], 0, "A new speaker gets a new line, which helps the reader follow who is talking.", 1),
          sg("Which is the best way to combine these? The dog was hungry. The dog was muddy. The dog was cold.", "The dog was hungry, muddy and cold.", ["The dog was hungry muddy and cold and.", "The dog, was hungry, muddy, and, cold.", "The dog was hungry. muddy and cold."], 0, "Listing the describing words with commas and “and” avoids repeating “The dog was” three times.", 2),
          sg("Which is the best rewrite of: Ben opened Ben's lunchbox and Ben ate Ben's sandwich.", "Ben opened his lunchbox and ate his sandwich.", ["Ben opened his lunchbox and he ate he sandwich.", "Ben opened Ben lunchbox and ate Ben sandwich.", "Him opened his lunchbox and ate him sandwich."], 3, "Pronouns such as his replace repeated names. Dropping the second “Ben” as the subject makes the sentence flow.", 2, true),
          sg("Which fronted adverbial tells the reader WHEN something happens?", "At midnight,", ["Under the bridge,", "With great care,", "In the cave,"], 2, "“At midnight” answers the question when. The others tell us where or how.", 1),
          sg("Which noun phrase best creates a SPOOKY setting?", "the crooked, creaking house on the hill", ["the house with a bright blue front door", "the very big house at the end of the road", "the house that we bought last summer"], 1, "Creaking and crooked are spooky words. The other phrases are neutral.", 3),
          sg("A report on Roman roads has three sections: who built them, how they were made and why they were useful. Which subheading fits the section on how they were made?", "How Roman Roads Were Built", ["Who Built Them?", "Why They Were Useful", "My Favourite Food"], 0, "A subheading should match what the section says. Only one option is about the way the roads were built.", 2, true),
          sg("Which part of a story is this sentence from? “Once upon a time, in a tiny village by the sea, lived a young fisherman called Kofi.”", "the opening", ["the problem", "the resolution", "the ending"], 3, "It introduces the character and the setting, which is what an opening does.", 1),
          sg("Which word would best replace “went” to show that a girl is nervous? The girl ___ into the hall.", "crept", ["bounced", "stomped", "strolled"], 2, "Crept suggests slow, quiet movement from someone who is unsure. Bounced, stomped and strolled show other moods.", 2),
          mu("Which TWO are good ways to make writing flow between sentences and paragraphs?", ["Using linking words such as Later and Meanwhile", "Repeating the same word in every sentence", "Using pronouns so that nouns are not repeated", "Starting every sentence the same way"], ["Using linking words such as Later and Meanwhile", "Using pronouns so that nouns are not repeated"], "Linking words and pronouns join ideas smoothly. Repeating words or openings makes writing dull.", 2),
          sg("Read: “Amir grabbed his coat. He runs out of the door. The rain soaked him.” Which sentence slips into the wrong tense?", "He runs out of the door.", ["Amir grabbed his coat.", "The rain soaked him.", "None; the tense is correct."], 1, "The story is in the past tense, so the second sentence should say “He ran out of the door”.", 3),
        ]),
      },
      flashcards: [
        { front: "Five parts of a story", back: "Opening, build-up, problem, resolution, ending." },
        { front: "When do you start a new line in dialogue?", back: "Every time a different person speaks." },
        { front: "Fronted adverbial", back: "An opening phrase saying when, where or how, followed by a comma." },
        { front: "Expanded noun phrase", back: "A noun plus description: the rusty gate with the broken latch." },
        { front: "Why use pronouns?", back: "So you do not repeat the same name or noun again and again." },
        { front: "Linking words across paragraphs", back: "Later, Meanwhile, The next day, Before long." },
        { front: "Consistent tense", back: "Choose past or present and keep to it, except for good reason." },
        { front: "Topic sentence", back: "The sentence that tells the reader what the paragraph is about." },
      ],
    },
    5: {
      year: 5,
      objectives: [
        "Identify the audience for and purpose of writing, and select the appropriate form and register.",
        "In narratives, describe settings, characters and atmosphere, and use dialogue to convey character and advance the action.",
        "Précis longer passages.",
        "Use a wide range of devices to build cohesion within and across paragraphs, and ensure correct subject and verb agreement.",
        "Assess the effectiveness of their own and others' writing and propose changes to vocabulary, grammar and punctuation.",
      ],
      note: {
        title: "Year 5: audience, atmosphere and showing not telling",
        body: `## What you need to know

Before you write, ask: **Who is this for? What is it for?** The answers decide your form (letter, report, story) and your tone.

- **Persuasive writing:** reasons, a **rule of three**, rhetorical questions, and a strong ending.
- **Explanations:** put steps in time order with words such as **first, next, as a result**.
- **Atmosphere:** choose details and sounds that create a mood.
- **Show, don't tell:** instead of “Ella was cold”, write “Ella's teeth chattered and she pulled her sleeves over her hands.”
- **Précis:** shorten a passage to its main points in your own words.
- **Dialogue** should reveal character or move the story on, not just say hello.

## Worked example 1: audience

For a letter to a museum you write: “I wish to enquire about school visits.” For a message to a friend: “Fancy a trip to the museum?”

## Worked example 2: dialogue that does a job

“Don't touch that,” Mia hissed, “it's hot.” It shows Mia is cautious and warns of danger.

## Worked example 3: subject-verb agreement

“The flowers in the vase **are** wilting.” The subject is flowers (plural), not vase.

| Purpose | Typical features |
| --- | --- |
| Persuade | opinion, reasons, rhetorical questions |
| Explain | time order, facts, technical words |
| Entertain | setting, character, dialogue |`,
      },
      quiz: {
        title: "Writing — Composition: Year 5 quiz",
        questions: build("wc", 5, [
          sg("A pupil is writing a persuasive letter to the head teacher. Which opening is the most suitable?", "Dear Mrs Patel, I am writing to ask you to consider buying a climbing frame for our playground.", ["Hi Mrs Patel! Get us a new climbing frame, it would be so cool for everyone!", "Once upon a time there was a playground that had no climbing frame at all.", "A climbing frame is a structure used for climbing, usually made of metal or wood."], 0, "A letter to a head teacher should be polite and clear about its purpose. The others are too casual, a story opening, or a definition.", 1),
          sg("Which line of dialogue BOTH shows character AND moves the story on?", "“Stay behind me,” whispered Nia, gripping the torch. “I think something moved.”", ["“Hello there, how is everybody today?” said Nia cheerfully.", "“It is a very nice day today,” said Nia, smiling.", "“Yes, I would like some more tea,” said Nia."], 2, "Nia's words and actions show she is careful and there is now a hint of danger, which pushes the story forward.", 2),
          sg("Which sentence builds a tense atmosphere?", "The floorboards groaned and a cold draught snuffed out the candle.", ["The room had a wooden table and four plain chairs.", "The sun shone brightly and the birds sang sweetly.", "It was a Tuesday afternoon in the middle of June."], 1, "Sound and movement details (groaned, snuffed out) create tension. The other sentences are calm or neutral.", 1),
          sg("Read: “The village of Marlow floods almost every spring. Water rises over the low fields, cutting off the only road for days. Farmers move their sheep to higher ground, and children row to school in small boats. Everyone agrees it is a nuisance, but nobody would live anywhere else.” Which is the best précis?", "Marlow floods every spring and the road is cut off, but the villagers cope and stay.", ["Children in Marlow row to school in small boats every day.", "Farmers in Marlow are very angry about moving their sheep.", "Marlow is a small village high up in the mountains."], 3, "A précis keeps the main points (the flooding, the effects, the villagers' attitude) in far fewer words.", 2, true),
          sg("Which sentence has correct subject-verb agreement?", "The books on the shelf are dusty.", ["The books on the shelf is dusty.", "The book on the shelves are dusty.", "The books on the shelf was dusty."], 0, "The subject is “books”, which is plural, so the verb must be “are”. The word “shelf” only tells us where.", 2, true),
          sg("Which sentence uses a “rule of three” to persuade?", "Our club is friendly, exciting and free.", ["Our club is friendly and free.", "Our club is friendly.", "Join our club, it is free."], 2, "A list of three points is a persuasive device that is easy to remember.", 1),
          sg("Which order matches how rain forms, in an explanation text?", "The sun heats water; the vapour rises and cools; clouds form; rain falls.", ["Rain falls; clouds form; the vapour cools; the sun heats water.", "Clouds form; the sun heats water; rain falls; the vapour rises.", "The vapour cools; rain falls; the sun heats water; clouds form."], 1, "An explanation follows the real order of events. Here that is heating, rising and cooling, cloud formation, then rain.", 2),
          mu("Which TWO are features of a formal letter?", ["Dear Mr Ahmed", "See ya soon!", "Yours sincerely", "lol, thanks"], ["Dear Mr Ahmed", "Yours sincerely"], "A formal letter opens with a polite greeting and closes with a formal ending. Casual phrases and slang do not belong.", 2),
          sg("Which sentence best SHOWS (rather than tells) that Omar is nervous?", "Omar's hands trembled as he gripped the edge of the stage.", ["Omar was very, very nervous about going on stage.", "Omar was a boy who was going to be on the stage.", "Omar was nervous, scared and worried about the show."], 3, "Showing uses details we can see. Trembling hands let the reader work out how he feels.", 3),
          sg("Read: “Seals rest on the beach between fishing trips. Their thick layer of blubber keeps them warm. My teacher lives near the harbour. A seal can dive for over twenty minutes.” Which sentence should be removed to keep the paragraph focused?", "My teacher lives near the harbour.", ["Seals rest on the beach between fishing trips.", "Their thick layer of blubber keeps them warm.", "A seal can dive for over twenty minutes."], 0, "The paragraph is about seals. The sentence about the teacher does not fit the topic.", 3),
        ]),
      },
      flashcards: [
        { front: "Two questions to ask before writing", back: "Who is my audience? What is my purpose?" },
        { front: "Four purposes for writing", back: "To entertain, inform, persuade and explain." },
        { front: "Show, don't tell", back: "Use details the reader can see or hear instead of naming the feeling." },
        { front: "Rule of three", back: "A list of three points for emphasis: fast, fun and free." },
        { front: "Précis", back: "A shortened version of a text that keeps the main points." },
        { front: "Job of dialogue", back: "To reveal character or to move the story on." },
        { front: "Explanation texts use...", back: "Time order, facts and linking words such as first, next, as a result." },
        { front: "Subject-verb agreement", back: "Match the verb to the subject: the flowers are, the flower is." },
        { front: "Formal letter greeting and ending", back: "Dear Ms Green ... Yours sincerely" },
      ],
    },
    6: {
      year: 6,
      objectives: [
        "Plan writing by identifying audience and purpose, selecting the appropriate form and noting and developing initial ideas.",
        "Select appropriate grammar, vocabulary and register, including the difference between spoken and written forms.",
        "Précis longer passages and use a wide range of devices to build cohesion within and across paragraphs.",
        "Use tense consistently, and use passive and active voice for effect.",
        "Evaluate and edit writing to enhance effects and clarify meaning; proof-read for accuracy.",
      ],
      note: {
        title: "Year 6: register, cohesion and editing for effect",
        body: `## What you need to know

At the top of KS2 you choose **form, register and structure** on purpose.

- **Register:** formal for reports and letters to adults, more relaxed for messages to friends.
- **Balanced argument:** points **for**, points **against**, then a **conclusion**.
- **Reports** often use the **passive** (“The water was measured”) and precise words.
- **Suspense:** short sentences, pauses and delayed reveals.
- **Cohesion:** connect paragraphs with phrases like “The following morning” or “Despite this,”.
- **Editing:** cut repetition, sharpen verbs, join short sentences and check tense.

## Worked example 1: register

Informal: “The trip was ace.” Formal: “The trip was extremely enjoyable.”

## Worked example 2: joining short sentences

“It rained. We waited. The bus came.” → “After we had waited in the rain, the bus finally came.”

## Worked example 3: a précis in four steps

Read the passage; underline key facts; delete examples and repetition; write your own short version.

| Audience | Style |
| --- | --- |
| Adult expert | formal, precise |
| Young child | short sentences, friendly words |
| Friend | relaxed, informal |`,
      },
      quiz: {
        title: "Writing — Composition: Year 6 quiz",
        questions: build("wc", 6, [
          sg("Before writing a report on the Romans, what should a writer do first?", "Plan the main sections and gather facts", ["Write out the conclusion of the report", "Proof-read the final copy of the report", "Publish it so that others can read it"], 0, "Planning and research come first. Proof-reading and publishing come at the end.", 1),
          sg("Paragraph 1 of an adventure ends: “The tunnel was finally clear.” Which opening best links Paragraph 2 to it?", "Once through the tunnel, the climbers faced a new danger: the ice.", ["Ice forms when water freezes below zero degrees.", "The climbers had sandwiches for lunch that day.", "Tunnels are often used by trains and by cars."], 1, "A good link refers back to the last paragraph and looks forward to what comes next.", 2),
          sg("Which sentence is most typical of the language of speech and not formal writing?", "Yeah, it was, like, really cool.", ["The event was highly successful.", "Attendance exceeded expectations.", "Pupils responded with enthusiasm."], 2, "Fillers such as yeah and like and vague words are typical of casual speech. Formal writing is precise.", 1),
          sg("Which sentence is written in the most formal register?", "Pupils are required to arrive by 8.45 a.m.", ["Kids must get here by 8.45.", "Get in by 8.45, yeah?", "You lot need to be here by 8.45."], 3, "“Pupils are required to” is polite and impersonal. The other options use slang or a casual tone.", 2, true),
          sg("Which sentence would a science report be most likely to use?", "The mixture was heated for two minutes.", ["We heated the stuff up for ages.", "I put it on the fire for two mins.", "Heat, heat, heat! Two minutes!"], 0, "Reports often use the passive voice and precise measurements to sound objective.", 2),
          sg("Read: “The library at Oakfield closed last year because the council needed to cut costs. Since then, a group of volunteers has opened a small reading room in the church hall on Saturday mornings. Books are donated by local families, and the children's corner is always busy. The volunteers hope the council will one day reopen the library.” Which is the best précis?", "After Oakfield library closed, volunteers began a small reading room using donated books.", ["The council has promised that it will soon reopen the library.", "Children in Oakfield like reading books in the church hall best.", "Families in Oakfield should give away all of their old books."], 2, "A précis states the main events in a shorter form. The other options are wrong or only mention a small detail.", 3),
          sg("Which technique builds suspense in: “The door creaked. Silence. Then, a footstep.”?", "Short sentences and pauses", ["Long descriptive sentences", "Rhetorical questions", "Lists of facts"], 1, "Very short sentences slow the moment down and make the reader wait for what happens next.", 2),
          sg("A leaflet for 7-year-olds is about recycling. Which sentence is the most suitable?", "Put your empty cans in the blue bin so they can be made into something new!", ["Recyclable aluminium receptacles should be deposited in the designated container.", "Recycling regulations vary between local authorities.", "Cans are a waste; stop littering, you fools."], 3, "Young readers need short, friendly, clear sentences. The others are too complex or unkind.", 2, true),
          sg("The sky darkened and thunder rolled. Aisha ___ the window. Which word keeps the tense consistent?", "slammed", ["slams", "will slam", "has slammed"], 2, "The first sentence is in the past tense, so the next verb must be past too: slammed.", 1),
          sg("Read: “Sam finished his homework. Sam went outside. Sam played football.” Which rewrite joins the ideas best?", "After finishing his homework, Sam went outside to play football.", ["Sam finished his homework, Sam went outside, Sam played football.", "Sam finished his homework and Sam went outside and Sam played football.", "Sam homework finished, went outside, football."], 0, "Combining the sentences with a link (after finishing...) removes repeated “Sam” and shows the order of events.", 3),
        ]),
      },
      flashcards: [
        { front: "Register", back: "How formal or informal your language is, chosen to suit the audience." },
        { front: "Balanced argument structure", back: "Points for, points against, then a conclusion." },
        { front: "Why do reports use the passive?", back: "To sound objective and focus on what was done, not who did it." },
        { front: "How to build suspense", back: "Short sentences, pauses and delaying the reveal." },
        { front: "Cohesion between paragraphs", back: "Link back and forward with phrases such as The following morning, Despite this." },
        { front: "Steps to write a précis", back: "Read, underline key points, cut examples, rewrite in your own words." },
        { front: "Editing checklist", back: "Cut repetition, sharpen verbs, join short sentences, check tense." },
        { front: "Writing for young children", back: "Short sentences, friendly words, clear instructions." },
      ],
    },
  },
};
