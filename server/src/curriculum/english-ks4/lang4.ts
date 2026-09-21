// English GCSE — Language Analysis (Years 10–11). Original content aligned to the DfE GCSE English Language subject content
// (exam-board neutral). All extracts are ORIGINAL, written for ActivityOS.
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q10 = qb("lang4", 10);
const q11 = qb("lang4", 11);

const EXT_A = `Extract A
The market woke slowly. Shutters clattered up one by one, and the smell of frying onions crept along the alley like a hungry cat. Somewhere a radio crackled. Mira pulled her scarf tighter, stepped over a puddle the colour of weak tea, and joined the shuffling queue at the bread stall.`;
const EXT_B = `Extract B
Our town’s library is closing. Not because nobody uses it (forty thousand visits last year) but because a spreadsheet says its shelves are worth less than a car park. Once it has gone, where will the child without broadband do her homework? Where will the pensioner find a warm seat and a friendly face? We cannot let the numbers win.`;

export const TOPIC: CTopic = {
  key: "lang4",
  topic: "Language Analysis",
  subject: "English",
  years: {
    10: {
      year: 10,
      objectives: [
        "Identify and interpret explicit and implicit information and ideas in unseen non-fiction and literary texts (AO1).",
        "Explain, comment on and analyse how writers use language: word choice, imagery and sentence forms (AO2).",
        "Explain and analyse how writers use structure to achieve effects and influence readers (AO2).",
        "Use subject terminology accurately and support points with short, well-chosen quotations.",
        "Begin to evaluate texts critically, judging how far a statement about a text is supported (AO4).",
      ],
      note: {
        title: "Year 10: analysing writers’ methods in an unseen extract",
        body: `## The core skill

In Language analysis you say **what the writer does** and **what effect it has on the reader**. Read the extract twice: once for meaning, once with a pencil for methods.

| Term | Meaning |
| --- | --- |
| Connotation | An idea or feeling a word suggests beyond its literal meaning |
| Simile / metaphor | A comparison using “like” or “as” / saying one thing *is* another |
| Personification | Giving human qualities to something non-human |
| Simple / compound / complex | One clause / two main clauses joined by *and, but, or* / a main clause plus a subordinate clause |
| Minor sentence | A sentence with no main verb |
| Explicit / implicit | Stated directly / suggested, so the reader must infer it |
| Perspective | The viewpoint through which we see events |

## How to analyse: PEEL

- **Point:** make a clear statement about what the writer presents.
- **Evidence:** a short, exact quotation (a few words is enough).
- **Explain:** zoom in on one word or technique, then say what it suggests and how the reader responds.
- **Link:** connect back to the question or the writer’s purpose.

## Worked model paragraph

*The writer presents the cottage as unwelcoming. The verb in “the cottage sulked at the end of the lane” personifies the building, giving it a moody, childlike attitude. This suggests it is sullen and closed off, so the reader feels uneasy about approaching it. The mood matches the visitor’s reluctance and builds tension from the start.*

Notice how one word, “sulked”, carries the analysis. Always ask: *why this word, and not a neutral one?*`,
      },
      quiz: {
        title: "Language Analysis: Year 10 quiz",
        questions: [
          q10.single(`${EXT_A}\n\nWhich technique is used in the sentence “The market woke slowly.”?`, "Personification", ["Simile", "Onomatopoeia", "Alliteration"], "A market cannot wake up. Giving it a human action is personification, which makes it seem alive.", 1, true),
          q10.single(`${EXT_A}\n\nWhat is the effect of describing the puddle as “the colour of weak tea”?`, "It makes the puddle seem murky and dull, with a comparison the reader can picture", ["It suggests the puddle is warm and inviting, like a drink Mira could stop and enjoy", "It suggests that Mira is thirsty and longing for a cup of tea", "It tells us the puddle is very deep"], "The comparison picks out the puddle’s pale, brownish colour. Everyday images help the reader see it and feel its dullness.", 2),
          q10.single(`${EXT_A}\n\nHow would you describe the sentence “Somewhere a radio crackled.”?`, "A short simple sentence with one main clause", ["A compound sentence", "A complex sentence with a subordinate clause", "A minor sentence with no verb"], "It has one subject (“a radio”) and one verb (“crackled”), so it is a simple sentence. “Somewhere” is just an adverbial.", 1),
          q10.single(`${EXT_A}\n\nWhich of these is an inference (implicit) rather than something the extract states directly?`, "The morning is chilly", ["Shutters are being raised", "A radio is playing somewhere", "Mira steps over a puddle"], "The extract never says it is cold. We infer it from Mira pulling her scarf tighter. The other options are stated outright.", 2),
          q10.single(`${EXT_A}\n\nThe extract moves from the whole market to Mira in its last sentence. Which structural technique is this?`, "A zoom from a wide view to a single character", ["A flashback to earlier in the day", "A shift from past to present tense", "A cyclical structure returning to the opening"], "The writer starts with the market, then narrows to one person. This is a zoom (or focus shift). Nothing here changes time or tense.", 2),
          q10.single(`${EXT_A}\n\nWhy might the writer choose “shuffling” rather than “walking” for the queue?`, "It suggests slow, weary, small steps by people in no hurry", ["It suggests the people are dancing happily as they wait for the bread", "It suggests the queue is dangerous", "It suggests the queue is moving quickly because people are in a rush to work"], "Word choice works through connotation. “Shuffling” connotes dragging, tired feet, so it adds to the slow, early-morning mood.", 2),
          q10.short(`${EXT_A}\n\nWhat word class is “clattered” in “Shutters clattered up one by one”? (one word)`, "verb", ["a verb", "Verb", "verb.", "a verb.", "verbs"], "“Clattered” is a doing word, so it is a verb. It is also onomatopoeic, because it imitates the sound.", 1),
          q10.single(`${EXT_A}\n\nA student writes: “The writer makes the market seem lifeless.” Which response is best supported by the extract?`, "Only partly: “woke slowly” is quiet, but verbs like “clattered” and “crackled” add sound and life", ["Fully: “woke slowly” proves the market is empty and nothing happens there at all", "Not at all: the writer never mentions any sound, so the market cannot feel alive", "Fully: the whole extract is written in the past tense, so it must describe something lifeless and finished"], "A strong evaluation weighs the claim against evidence. Some words suggest quiet, but several sound verbs show a market slowly coming to life.", 3, true),
          q10.single(`${EXT_A}\n\nThe final sentence has one subject and three verbs (“pulled … stepped … joined”). What is the best explanation of its effect?`, "It links Mira’s actions in a smooth chain, suggesting a familiar, unhurried routine", ["It slows the pace with many short pauses, so that each action feels separate and tense", "It shows Mira is angry and rushing", "It shows that three different people are each doing one action in the queue"], "A long sentence with joined actions flows without stopping. That flow suggests habit and steady movement, not urgency.", 3),
          q10.single(`${EXT_B}\n\nWhat is the writer’s perspective on the closure?`, "Passionately opposed, and sympathetic to people who rely on the library", ["Neutral, calmly reporting the council’s plans without taking a side in the debate", "Supportive of the closure, seeing it as a sensible way to save the town money", "Amused by the council’s mistakes"], "Emotive images (the child, the pensioner) and “We cannot let the numbers win” show strong opposition and concern for vulnerable users.", 2),
          q10.single(`${EXT_B}\n\nWhy does the writer include “forty thousand visits last year”?`, "To use evidence to challenge the idea that nobody uses the library", ["To show that the library is far too crowded for everyone to use it", "To prove that the council has lied about the library’s budget and its costs", "To suggest the visits were all by children"], "The statistic is factual evidence that answers the “nobody uses it” argument. It makes the writer’s case seem credible.", 2),
          q10.single(`${EXT_B}\n\nWhich best explains the effect of the two rhetorical questions?`, "They invite the reader to picture specific people who would lose out, prompting sympathy and implying the answer is obvious", ["They show that the writer genuinely does not know the answers and is asking the council to supply the missing facts about who uses the library", "They give the reader factual information about the library’s opening hours and services, so that the reader can check the writer’s claims", "They make the tone humorous, so that the reader laughs at the council and forgets to take the closure seriously"], "Rhetorical questions do not need an answer. Here they make the reader imagine real people, and the implied answer is that no one would help them.", 3),
          q10.written(`${EXT_A}\n\nWrite ONE PEEL paragraph (about 100 words) explaining how the writer uses language in the first two sentences of Extract A to create an atmosphere.`, "A strong answer picks one or two precise quotations (e.g. “woke slowly”, “clattered”) and explains connotations, e.g. personification makes the market seem gently alive; the sound verb adds bustle.", "Mark scheme (8 marks, plain-language AO2): 1–2 marks for a relevant point about atmosphere; 2 marks for short, accurate quotation(s); 3 marks for explaining the effect of specific words or techniques (connotations, personification, sound verbs) rather than just naming them; 1 mark for a link back to atmosphere or the writer’s purpose. Terminology should be accurate.", 3, 8),
        ],
      },
      flashcards: cards([
        ["What is AO2 in English Language?", "Explaining and analysing how writers use language and structure to achieve effects, using subject terminology."],
        ["What does PEEL stand for?", "Point, Evidence, Explain, Link."],
        ["Connotation", "The idea or feeling a word suggests beyond its literal meaning (e.g. “shuffling” suggests weariness)."],
        ["Explicit vs implicit", "Explicit = stated directly. Implicit = suggested; you infer it from clues."],
        ["Simple sentence", "One main clause with a single subject and verb (e.g. “A radio crackled.”)."],
        ["Complex sentence", "A main clause plus at least one subordinate clause (e.g. “She left because it rained.”)."],
        ["Minor sentence", "A sentence with no main verb, used for emphasis (e.g. “Silence.”)."],
        ["Personification", "Giving human qualities or actions to something non-human."],
        ["Perspective (viewpoint)", "The position from which events are seen or opinions are held; in fiction, the narrator’s viewpoint."],
        ["Rhetorical question", "A question asked for effect that does not expect an answer."],
      ]),
    },
    11: {
      year: 11,
      objectives: [
        "Compare writers’ ideas and perspectives across two unseen texts, and how these are conveyed (AO3).",
        "Select and synthesise evidence from two texts to answer a question (AO1).",
        "Analyse how tone, register, tense and voice shape a reader’s response (AO2).",
        "Evaluate a statement about a text critically, weighing evidence for and against (AO4).",
        "Use comparative connectives and precise terminology in a developed, well-structured response.",
      ],
      note: {
        title: "Year 11: comparing and evaluating two extracts",
        body: `## Comparing writers’ perspectives

For a comparison, do not describe two extracts one after the other. Build each paragraph around **one idea** and place a quotation from **each text** in it.

| Term | Meaning |
| --- | --- |
| Tone | The attitude or mood of the writing (serious, wry, urgent) |
| Register | The level of formality of the language |
| Voice | The personality a narrator or writer projects |
| Irony | Saying or showing something different from what is meant |
| Hyperbole | Deliberate exaggeration |
| Understatement | Making something sound less serious than it is |

**Comparative connectives:** *similarly, likewise, whereas, in contrast, on the other hand, both … but*.

## Evaluating a statement

Build each paragraph with **PEEL** (point, evidence, explain, link), adding a comparative link.

“How far do you agree?” needs a judgement, not a list. Weigh the statement: **agree with part, challenge part**, and use evidence for each. Finish with a firm view.

## Worked model paragraph

*Both writers use humour to handle fear, but to different degrees. In Text A the “nervous laugh” in “I laughed, and it came out as a squeak” admits panic. Whereas in Text B the confident boast “I’ve done this a hundred times” hides it. The writers therefore suggest that jokes can reveal or disguise anxiety, and the contrast shows that the two narrators respond to danger in opposite ways.*

The connective “whereas” and the shared idea (humour and fear) hold the comparison together.`,
      },
      quiz: {
        title: "Language Analysis: Year 11 quiz",
        questions: [
          q11.single(`Extract A (a nineteenth-century-style travel diary) begins: “The sea rose against us as though it had a grievance.”\n\nWhich technique is used?`, "Personification, as the sea is given a human motive", ["Onomatopoeia, as the sea is loud", "Alliteration, as the same sound repeats", "A rhetorical question, as it asks something"], "A grievance is a human feeling. Giving it to the sea is personification, which makes the storm seem personal and threatening.", 1, true),
          q11.single(`Extract A describes a deck that is “a slope of black water” and a captain gripping the rail “with white hands”. Extract B describes a boat “rocking like a toddler on a sugar rush”.\n\nWhich is a valid similarity between the two extracts?`, "Both use figurative language to make the movement of the boat vivid", ["Both are written in the first person present tense, so events feel immediate", "Both use a formal, elevated register", "Both treat the crossing as calm and pleasant"], "A uses a metaphor and personification, and B uses a simile, so both use figurative language. A is in the past tense, and B is informal.", 2),
          q11.single(`Extract A: “I confess I prayed — I, who had scoffed at prayer in every port.” Extract B: “I’m fine. Totally fine. Please send crackers.”\n\nWhich describes the difference in tone?`, "A is serious and confessional; B is light-hearted and comic", ["A is comic and B is solemn", "Both are solemn and serious, but Extract B is much briefer than Extract A", "A is angry and B is calm"], "A admits fear in a formal, weighty way. B makes a joke of seasickness with short, chatty sentences.", 2),
          q11.single(`Extract B is written in the present tense: “The boat is rocking… A man near me has gone a shade of green.”\n\nWhat is the effect of the present tense?`, "It creates immediacy, as if the reader is following events as they happen", ["It shows the events are long past", "It makes the tone formal", "It makes the writer seem like a distant historian summing up long-ago events"], "Present tense makes the action feel live, which suits an informal blog update written during the crossing.", 2),
          q11.single(`Extract B: “I’m fine. Totally fine.”\n\nWhat is the effect of this short, repeated statement?`, "It is ironic and comic: the reader can tell the writer is not fine", ["It proves the writer is completely calm", "It shows that the writer has been ordered by someone else to keep speaking", "It gives factual details about the boat"], "Insistence that everything is fine, right after descriptions of chaos, works as ironic humour. The writer says one thing and shows another.", 3),
          q11.single(`Extract A: “the captain, a man I had thought immovable, gripped the rail with white hands.”\n\nWhat does this imply about the storm?`, "It is so severe that even a strong, experienced man is frightened", ["It is over and the captain is relieved", "The captain is angry with the passengers and wants them to leave the deck", "The captain is showing off his strength"], "“Immovable” builds up the captain’s strength, and “white hands” suggests fear or strain. If he is afraid, the danger must be serious.", 2),
          q11.short(`Extract A uses “I” and “my” to tell the story. What is this type of narrative viewpoint called? (two words)`, "first person", ["first-person", "1st person", "1st-person", "first person narrative", "first-person narrative", "first person narrator", "first-person narrator", "first person narration", "first-person narration", "first person viewpoint", "first-person viewpoint", "first person point of view", "first-person point of view", "the first person", "first person.", "first-person."], "The narrator uses “I”, so it is first person. This makes it personal and gives the reader direct access to fear.", 1),
          q11.multi(`Which THREE methods does the writer of Extract B use to create humour?\n\n(Extract B mentions a boat “rocking like a toddler on a sugar rush”, a man who has gone “a shade of green I’d call ‘pistachio’”, and ends “I’m fine. Totally fine. Please send crackers.”)`, ["A comic simile (“like a toddler on a sugar rush”)", "A chatty, colloquial register (“Please send crackers”)", "Ironic denial that the reader can see through"], ["Archaic vocabulary", "Long, complex, formal sentences"], "Humour comes from the simile, the casual chatty voice and the ironic denial. There is no archaic or formal language in B.", 3),
          q11.single(`A student claims: “Writer A makes the danger feel more real than Writer B.” Extract A has “black water” and “white hands”; Extract B jokes about a man going “pistachio” green.\n\nWhich is the strongest comparative point?`, "A conveys fear through concrete details, while B undercuts the danger with humour, so each suits its purpose", ["A is better because it is older, and nineteenth-century writing is always more serious and realistic than a modern blog written for entertainment", "B is better because it is shorter and funnier, and a writer who makes readers laugh must have described the crossing more accurately", "They are identical in purpose and tone, since both describe the same kind of rough sea crossing from a first-person viewpoint"], "A good evaluation compares methods and effects and links them to purpose. Age and length are not evidence of effect.", 3, true),
          q11.single(`Which phrase from Extract A shows a formal register?`, "“I confess I prayed”", ["“Totally fine”", "“Please send crackers”", "“day three of my ‘relaxing’ break”"], "“I confess” is an old-fashioned, formal admission. The other phrases come from the chatty modern blog.", 1),
          q11.single(`Extract B begins “day three of my ‘relaxing’ break”. Why are there quotation marks around “relaxing”?`, "To signal irony: the break is clearly not relaxing", ["To show that another character in the extract has said the word aloud", "To show it is a quotation from a book", "To show the word is misspelt"], "Scare quotes can signal that the word is not meant sincerely. Here they set up the comic contrast with the rough crossing.", 2),
          q11.written(`Extract A (a diary) describes a storm at sea: black water, a frightened captain and the writer praying. Extract B (a blog) describes a rough ferry crossing with humour: a boat “rocking like a toddler on a sugar rush”, a green-faced man and “Please send crackers”.\n\nCompare how the two writers present the experience of a rough crossing. Write two comparative paragraphs (about 150 words).`, "A strong answer builds paragraphs around ideas (e.g. fear versus comedy), quotes from both texts, uses connectives (whereas, similarly) and explains how method (personification, simile, register, tense) shapes the reader’s response.", "Mark scheme (8 marks, plain-language AO3 with AO2): 2 marks for clear comparison of ideas or perspectives (not two separate summaries); 2 marks for relevant quotations from BOTH texts; 3 marks for explaining how methods (imagery, tone, register, tense) create different effects; 1 mark for well-used comparative connectives and precise terminology.", 3, 8),
        ],
      },
      flashcards: cards([
        ["What is AO3?", "Comparing writers’ ideas and perspectives, and how these are conveyed across two texts."],
        ["Comparative connectives", "Similarly, likewise, whereas, in contrast, on the other hand."],
        ["Tone", "The attitude or mood of writing (e.g. wry, urgent, solemn)."],
        ["Register", "The level of formality of language (formal, informal, colloquial)."],
        ["Irony", "Saying or showing something different from what is meant, often for humour or criticism."],
        ["Hyperbole", "Deliberate exaggeration for effect."],
        ["Understatement", "Playing down how serious or important something is, often for humour or irony."],
        ["Effect of present tense", "Creates immediacy: the action seems to unfold as we read."],
        ["“How far do you agree?” tip", "Weigh the statement: agree with part, challenge part, and give a final judgement with evidence."],
        ["Colloquial language", "Informal, everyday speech-like language such as slang or chatty phrases."],
      ]),
    },
  },
};
