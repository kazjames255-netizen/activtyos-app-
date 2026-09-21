// English GCSE — Writing: Creative & Transactional (Years 10–11). Original content aligned to the DfE GCSE English Language
// subject content (writing: audience/purpose/register, structure, technical accuracy). All sample writing is ORIGINAL.
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q10 = qb("wr4", 10);
const q11 = qb("wr4", 11);

export const TOPIC: CTopic = {
  key: "wr4",
  topic: "Writing — Creative & Transactional",
  subject: "English",
  years: {
    10: {
      year: 10,
      objectives: [
        "Write for different audiences and purposes, choosing appropriate register and Standard English where needed (AO5).",
        "Use descriptive and narrative techniques: sensory detail, showing not telling, varied sentences and controlled pace.",
        "Organise writing into coherent, well-shaped paragraphs and link ideas within and between them (AO5).",
        "Use vocabulary and sentence structures for effect, avoiding repetition and over-writing.",
        "Use accurate spelling, punctuation and grammar, including apostrophes, semicolons and sentence boundaries (AO6).",
      ],
      note: {
        title: "Year 10: crafting creative writing and getting the basics right",
        body: `## Purpose, audience, register

When you analyse a sample of writing, use **PEEL** (point, evidence, explain, link).

Before you write, ask: **Why** am I writing (purpose: to entertain, describe, inform, persuade, argue, advise)? **Who** for (audience)? Your **register**, the level of formality, follows from both.

| Term | Meaning |
| --- | --- |
| Show, don’t tell | Let details and actions reveal feelings instead of naming them |
| Sensory detail | Sight, sound, smell, taste, touch |
| Sentence variety | Mixing short, long, simple and complex sentences |
| Comma splice | Two main clauses wrongly joined by only a comma |
| Semicolon | Joins two closely related main clauses |
| Discourse marker | A word or phrase linking ideas (*however, meanwhile*) |

## Techniques that work

- **Zoom in** from a wide setting to one small detail.
- **Vary sentence length**: a short sentence after long ones adds impact.
- **Choose precise verbs** and nouns instead of piling up adjectives.
- Start a **new paragraph** when time, place, speaker or focus shifts.

## Worked model: showing, not telling

**Weaker:** *Priya was furious about the message.*

**Stronger:** *Priya folded the message into a tight square, then a smaller one, until her thumbnail whitened against the edge. She did not say a word.*

The stronger version uses an **action**, a **physical detail** and **silence** to make the reader feel her anger. Then **proofread**: check every sentence boundary, apostrophe and spelling before you finish.`,
      },
      quiz: {
        title: "Writing — Creative & Transactional: Year 10 quiz",
        questions: [
          q10.single("Which register is most suitable for a letter to a head teacher about a school trip?", "Formal Standard English, e.g. “I am writing to express my concern…”", ["Chatty slang and jokes, e.g. “Just wanted a moan about the trip, teachers are so annoying”", "Text-speak, e.g. “ur trip was gr8”", "Poetic imagery with no clear point"], "A letter to someone in authority calls for a formal, polite register with clear, Standard English.", 1),
          q10.short("What one word names the reason you are writing, such as to persuade, inform or entertain?", "purpose", ["Purpose", "the purpose", "purpose.", "the purpose.", "your purpose"], "Purpose is the reason for writing. It works together with audience to decide your form, tone and register.", 1),
          q10.single("Which sentence best SHOWS, rather than tells, that a character is nervous?", "Tom’s palms were slick on the exam paper, and he read the first question three times without taking it in.", ["Tom was so very nervous about the exam that he could not stop worrying.", "Tom felt nervous and scared and worried about how badly the whole exam might go.", "A huge wave of nervousness overcame Tom completely as the exam began, and he felt terrified of failing."], "Showing uses specific actions and details that let the reader infer the feeling. The other options name the emotion directly.", 2, true),
          q10.single("A student writes: “The rain hammered the roof, we could not hear each other speak.” What is the technical error?", "A comma splice: two main clauses joined by only a comma", ["A missing apostrophe", "A sentence fragment that has no main verb and cannot stand alone", "A shift from past to present tense in the middle of the sentence"], "Each half could stand alone as a sentence. Use a full stop, a semicolon, or a conjunction (e.g. “so”) to join them.", 2, true),
          q10.single("Which sentence uses an apostrophe correctly?", "The children’s coats were still wet.", ["The childrens’ coats were still wet.", "The childrens coats were still wet.", "The children coat’s were still wet."], "“Children” is an irregular plural that does not end in s, so the possessive adds ’s: children’s.", 2),
          q10.multi("Which THREE are effective ways to build suspense in a story opening?", ["Using short sentences to quicken the pace", "Holding back information so the reader wants to know more", "Using precise sensory detail such as a distant creak or a smell of smoke"], ["Explaining the ending straight away", "Giving a long list of facts about the setting’s history"], "Suspense grows from controlled pace, withheld information and vivid sensory detail. Revealing everything removes tension.", 2),
          q10.single("When should you normally begin a new paragraph in narrative writing?", "When there is a shift in time, place, speaker or focus", ["After every single sentence", "Only when you reach the bottom of a page and there is no more room", "Every time you use a semicolon"], "Paragraphs group related ideas. A change of time, place, speaker or focus signals a new one.", 2),
          q10.single("A student writes: “The magnificent, glittering, resplendent sun, blazing gloriously, shone brilliantly above the exquisite, glimmering, shimmering sea.” What is the main weakness?", "Too many adjectives and adverbs repeat one idea, so the description is cluttered, not precise", ["There are too many short sentences, which makes the description sound abrupt", "There are no adjectives at all, so the reader cannot picture the scene clearly", "The speech marks are missing, so the reader cannot tell who is speaking in this description"], "Piling on near-synonyms weakens description. One carefully chosen verb or image usually does more.", 3),
          q10.single("Which revision of “The old house was scary” is most effective?", "The old house loomed over the lane, its windows dark as closed eyes.", ["The old house was really, really scary and made me feel frightened.", "The old house was scary, spooky and creepy, a really frightening place to be.", "The old house, which was scary, stood in the lane, which was long."], "The verb “loomed” and the simile suggest menace and let the reader feel it. The others repeat or pad.", 2),
          q10.short("What technique is it when neighbouring words begin with the same sound, as in “silent, sinister shadows”?", "alliteration", ["Alliteration", "sibilance", "alliteration.", "sibilance.", "alliterative"], "Repeating an initial consonant sound is alliteration. The repeated “s” here is also sibilance.", 1),
          q10.single("You are writing an article for a teenage magazine to persuade readers that school uniform should change. Which opening best suits the audience and purpose?", "Who decided that a piece of polyester should tell the world who we are? It’s time to ask.", ["Dear Sir or Madam, I wish to make a formal complaint about the school’s uniform policy.", "School uniform is a type of clothing that is worn in many schools around the world.", "lol uniform is soooo annoying tbh"], "A magazine article for teens can be lively and direct. The letter opening is the wrong form, the third is flat, and the fourth is too slangy.", 3),
          q10.multi("Which TWO sentences use a semicolon correctly?", ["I wanted to leave; the party was dull.", "The storm had passed; the streets were silent."], ["I wanted to leave; because the party was dull.", "She packed three things; a torch, a map and a compass."], "A semicolon joins two complete, related clauses. It cannot precede a subordinate clause (“because…”) and is not used to introduce a list (use a colon).", 3),
          q10.written("Write the opening paragraph (about 120 words) of a story called “The Last Bus”. Use at least two techniques from this course (e.g. sensory detail, sentence variety, a zoom from wide view to a small detail) and make your writing technically accurate.", "A strong answer sets a clear setting and mood, uses precise verbs and at least one sensory detail, varies sentence lengths, and is accurately punctuated.", "Mark scheme (8 marks, plain-language AO5/AO6): up to 3 marks for engaging content and a clear atmosphere or viewpoint; up to 2 marks for crafted language (precise vocabulary, imagery, sentence variety); up to 1 mark for structure (a sense of purposeful opening, zoom or focus); up to 2 marks for technical accuracy (sentence boundaries, punctuation, spelling).", 3, 8),
        ],
      },
      flashcards: cards([
        ["Purpose vs audience", "Purpose = why you write (entertain, inform, persuade…). Audience = who you write for. Both shape register."],
        ["Register", "The level of formality of your language, chosen to suit audience and purpose."],
        ["Show, don’t tell", "Reveal feelings through actions, details and senses rather than naming the emotion."],
        ["Comma splice", "Two main clauses joined by only a comma. Fix with a full stop, semicolon or conjunction."],
        ["Semicolon rule", "Joins two related MAIN clauses; not used before “because”, “although” etc. or to start a list."],
        ["Apostrophe of possession", "Singular: the girl’s bag. Plural ending in s: the girls’ bags. Irregular plural: the children’s coats."],
        ["Its vs it’s", "Its = belonging to it. It’s = it is or it has."],
        ["When to start a new paragraph", "When time, place, speaker or focus changes."],
        ["Sentence variety", "Mix short and long sentences; a short one after long ones adds impact."],
        ["Discourse markers", "Words that link ideas across sentences and paragraphs (however, meanwhile, as a result)."],
      ]),
    },
    11: {
      year: 11,
      objectives: [
        "Adapt form, tone and register for letters, articles, speeches and reviews (AO5).",
        "Use rhetorical devices and persuasive techniques deliberately, for a specific audience.",
        "Structure writing effectively: openings, developed paragraphs, discourse markers and endings (AO5).",
        "Craft narrative structure, including flashback, cyclical structure and shifts in focus.",
        "Proofread for accuracy and evaluate sample writing against purpose and audience (AO5, AO6).",
      ],
      note: {
        title: "Year 11: transactional writing and rhetorical control",
        body: `## Choosing the form

When you analyse a sample of writing, use **PEEL** (point, evidence, explain, link).

| Form | Key features |
| --- | --- |
| Formal letter | Address and date, “Dear Mr Khan” … “Yours sincerely” (named person) or “Dear Sir or Madam” … “Yours faithfully”; formal register |
| Article | Headline, subheadings, engaging opening, direct address, balanced or persuasive voice |
| Speech | Spoken rhythm, direct address, rhetorical questions, memorable ending |

## Rhetorical devices: AFOREST

**A**lliteration, **F**acts, **O**pinion, **R**hetorical questions, **E**motive language, **S**tatistics, **T**riples (rule of three). Choose them for a reason; do not just tick them off.

## Structure and control

- Open with a hook, state your viewpoint, then develop **one idea per paragraph**: point, evidence, explanation.
- Use **discourse markers** to signpost: *firstly, however, consequently, above all*.
- End with a memorable call to action or a return to your opening idea (a **cyclical** ending).
- Proofread: sentence boundaries, apostrophes, spelling, tone consistency.

## Worked model paragraph

*It is tempting to dismiss a revision timetable as a burden. However, many teachers report that short, regular sessions help pupils remember more than a last-minute rush. Imagine walking into an exam armed with nothing but hope. A timetable, used well, is a plan, not a punishment.*

This model concedes an opposing view, signals the shift with “however”, uses a direct-address image and closes with a balanced, memorable line.`,
      },
      quiz: {
        title: "Writing — Creative & Transactional: Year 11 quiz",
        questions: [
          q11.single("A letter begins “Dear Sir or Madam”. How should it end?", "Yours faithfully", ["Yours sincerely", "Best wishes", "Love from"], "In formal British letters, “Dear Sir or Madam” is paired with “Yours faithfully”. “Yours sincerely” goes with a named recipient.", 1),
          q11.short("Name the technique of grouping three items or ideas for rhythm and emphasis, as in “safe, clean and fair”.", "rule of three", ["triple", "tricolon", "a triple", "list of three", "the rule of three", "three", "rule of 3", "the rule of 3", "list of 3", "a list of three", "the list of three", "triples", "triplet", "triplets", "tripling", "a tricolon", "triad", "power of three", "the power of three", "rule of three.", "triple.", "tricolon."], "A triple (rule of three) makes a point feel complete and memorable, so it is common in speeches.", 1),
          q11.single("You are giving a speech to parents about children playing outside. Which opening best engages a live audience?", "Good evening, everyone. Let me ask you one question: when did you last see a child playing outside?", ["I am going to talk about play today. First, I will define what play is, and then I will list some facts.", "Dear parents, as per the previous correspondence, please note the following.", "So basically this is a speech about stuff."], "A speech should hook listeners at once. Direct address and a rhetorical question do this. The others are dull, wrongly formal or careless.", 2, true),
          q11.single("Which feature belongs in a magazine article but NOT in a formal letter?", "A catchy headline and subheadings", ["Paragraphs", "Formal vocabulary", "A clear opening statement of purpose"], "Headlines and subheadings are conventions of articles. Letters use an address, a greeting and a sign-off instead.", 1),
          q11.single("A student writes: “Everyone knows that homework is pointless. Absolutely everyone. Why should we waste our evenings on it, when a night off would do more good than a mountain of worksheets?” Which device is NOT used?", "A statistic", ["A rhetorical question", "Repetition for emphasis", "A sweeping generalisation"], "There is a rhetorical question, repetition (“Absolutely everyone”) and a sweeping generalisation, but no number or statistic.", 3),
          q11.single("Which connective best signals a counter-argument in a persuasive article?", "However", ["Furthermore", "Similarly", "Consequently"], "“However” introduces a contrasting point. “Furthermore” and “similarly” add to a point, and “consequently” shows a result.", 2),
          q11.single("A student’s letter to the council says: “I think the park is rubbish and you lot are totally clueless about what young people want!” What is the main weakness for a letter meant to persuade?", "The register is too informal and insulting, which would alienate the reader rather than persuade", ["The letter is too long, and the council will not have time to read it", "It uses too many statistics and figures, which would confuse the council", "It does not have any opinion, so nobody could tell what the writer wants to say"], "Persuasion needs a respectful, reasoned tone. Insults and slang undermine the writer’s credibility.", 2, true),
          q11.single("A story opens at a graveside, moves back to a summer years earlier, then returns to the graveside at the end. Which structure is this?", "A cyclical structure that uses a flashback", ["A purely chronological structure", "A structure using only dialogue", "A structure with a changing narrator in every paragraph"], "Returning to the opening scene makes it cyclical, and the move back in time is a flashback.", 2),
          q11.multi("Which TWO sentences are correct?", ["It’s important that the council reviews its policy.", "There are three reasons: cost, safety and fairness."], ["The council should review it’s policy.", "Their are three reasons for this.", "Who’s bike is this?"], "“It’s” means “it is”, and “its” shows possession. “There are” uses the place-word spelling, and “whose” is needed for possession.", 3),
          q11.single("What is the effect of direct address in “You have the power to change this”?", "It involves the reader personally and makes the call to action feel urgent", ["It shows the writer is unsure", "It gives the reader factual evidence", "It makes the writing more formal and distant, as though the writer is a stranger"], "“You” speaks straight to the reader, which puts responsibility on them and creates urgency.", 2),
          q11.single("A student writes: “Firstly, plastic harms wildlife. Secondly, plastic harms wildlife because animals eat it. Thirdly, plastic is bad.” What is the main weakness?", "It repeats one point instead of developing distinct ideas with evidence and explanation", ["It uses too many complex sentences, so the paragraph is hard for a reader to follow", "It has no discourse markers", "It is written in the wrong person"], "The markers are there, but the argument does not develop. Each paragraph should add a new, supported idea.", 3),
          q11.multi("Which TWO are typical features of a formal letter?", ["The sender’s address and the date", "A formal register using Standard English"], ["Emojis to seem friendly", "Slang and text-speak"], "Formal letters use a set layout and formal language. Emojis and slang do not suit the audience.", 2),
          q11.written("Write the opening two paragraphs (about 150 words) of a speech to your school assembly persuading pupils to take part in a charity event. Use at least three rhetorical devices deliberately, address your audience directly, and check your accuracy.", "A strong answer has a hook, a clear viewpoint, three or more well-chosen devices (e.g. rhetorical question, triple, direct address), formal-but-lively register, and accurate punctuation.", "Mark scheme (8 marks, plain-language AO5/AO6): up to 3 marks for content matched to audience and purpose (clear persuasive point, hook); up to 2 marks for deliberate use of rhetorical devices; up to 1 mark for structure (paragraph shape, discourse markers); up to 2 marks for technical accuracy (punctuation, spelling, sentence boundaries).", 3, 8),
        ],
      },
      flashcards: cards([
        ["“Dear Sir or Madam” ends with…", "Yours faithfully."],
        ["“Dear Mr Khan” ends with…", "Yours sincerely."],
        ["AFOREST", "Alliteration, Facts, Opinion, Rhetorical questions, Emotive language, Statistics, Triples."],
        ["Rule of three (triple)", "Grouping three items or ideas for rhythm and emphasis."],
        ["Direct address", "Speaking straight to the audience (“you”, “we”) to involve them."],
        ["Discourse marker examples", "Firstly, however, consequently, above all, in conclusion."],
        ["Cyclical structure", "A text that ends by returning to its opening image or idea."],
        ["Flashback", "A shift back to an earlier time in the narrative."],
        ["Feature of a speech", "Spoken rhythm, direct address, rhetorical questions, memorable ending."],
        ["Its vs it’s", "Its = belonging to it. It’s = it is or it has."],
      ]),
    },
  },
};
