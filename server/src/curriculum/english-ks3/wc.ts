// KS3 English — Writing: Composition (Years 7–9). Original content aligned to the DfE KS3 English programme of study (OGL v3.0).
// Composition is assessed through analysis of ORIGINAL sample text; each quiz has one tutor-marked `written` task.
import type { CTopic } from "../types";
import { qb, cards } from "./_b";

const q7 = qb("wc", 7), q8 = qb("wc", 8), q9 = qb("wc", 9);

export const TOPIC: CTopic = {
  key: "wc",
  topic: "Writing — Composition",
  subject: "English",
  years: {
    7: {
      year: 7,
      objectives: [
        "Write for a wide range of purposes and audiences, choosing appropriate form and register.",
        "Plan, draft, edit and proof-read writing.",
        "Organise ideas into paragraphs with topic sentences and connectives.",
        "Use vivid description and show rather than tell in narrative.",
        "Proof-read for spelling, punctuation and grammar.",
      ],
      note: {
        title: "Year 7: audience, purpose, paragraphs and vivid description",
        body: `## What you need to know

Before you write, decide **audience** (who?), **purpose** (why?) and **form** (what?). Purposes are to **persuade, inform, entertain** and **describe** (PIE + D).

| Term | Meaning |
| --- | --- |
| Audience | The people who will read your writing |
| Form | The type of text: letter, article, story, leaflet, speech |
| Topic sentence | The first sentence of a paragraph that states its main idea |
| Connective | A word linking ideas: *however, therefore, meanwhile, for example* |
| Cohesion | How ideas are linked so the writing flows |
| Show, don't tell | Using actions and detail instead of naming an emotion |

## Editing and proofreading

Re-read aloud. Check **sense** first, then **sentences**, then **spelling and punctuation**. Common traps: *their / there / they're*, *its / it's*, missing capital letters.

## Model analysis (PEEL)

Sample: *"The harbour woke slowly. Gulls wheeled over the wet stones, crying like rusty gates, and the first boats nosed out into a sea the colour of pewter."*

- **Point:** The writer creates a gentle, slightly harsh morning atmosphere.
- **Evidence:** "crying like rusty gates".
- **Explain:** The simile compares the gulls' calls to a grating, creaking sound, so we can hear the harbour, and "woke" personifies the harbour as if it were slowly stirring.
- **Link:** This vivid detail lets the reader picture the scene without being told it is "early and cold".`,
      },
      quiz: {
        title: "Writing — Composition: Year 7 quiz",
        questions: [
          q7.single(
            "Which form is most suitable for advising new pupils how to survive their first week at secondary school?",
            "An information leaflet",
            ["A short ghost story", "A rhyming sonnet", "A shopping list"],
            "The purpose is to inform and advise, so a leaflet with clear headings and tips suits the audience.",
            1,
          ),
          q7.single(
            "What does a topic sentence do?",
            "It introduces the main idea of a paragraph",
            ["It concludes the whole essay", "It repeats the title of the text", "It lists all the evidence at once"],
            "A topic sentence usually opens a paragraph and tells the reader what it is about. The rest of the paragraph develops that idea.",
            1,
          ),
          q7.single(
            "Which connective best completes the sentence?\n\nThe play was very long; ______, the audience stayed until the end.",
            "nevertheless",
            ["therefore", "for example", "similarly"],
            "The second clause is a surprising contrast to the first, so a contrasting connective is needed: nevertheless (= in spite of that).",
            2,
            { d: true },
          ),
          q7.single(
            "Which sentence SHOWS that a character is nervous, rather than just telling us?",
            "Her pencil rattled against her teeth as she waited for the results.",
            ["She was nervous about the results, and she could not stop thinking.", "She felt very worried, and her mind was full of doubts.", "The results were coming soon, and everybody waited in the room."],
            "Showing uses a physical detail (the rattling pencil) from which the reader infers the feeling, instead of naming it.",
            2,
          ),
          q7.single(
            "Which sentence has NO spelling or punctuation errors?",
            "They're going to leave their bags over there.",
            ["Their going to leave there bags over they're.", "They're going to leave there bags over their.", "Their going to leave they're bags over there."],
            "“They're” = they are; “their” = belonging to them; “there” = a place. Only “They're going to leave their bags over there.” uses all three correctly.",
            2,
            { d: true },
          ),
          q7.short(
            "The purposes of writing can be remembered as PIE: Persuade, Inform and ______. Fill the gap.",
            "entertain",
            [],
            "PIE stands for Persuade, Inform, Entertain (with Describe often added).",
            1,
          ),
          q7.multi(
            "Which TWO features suit a formal letter to a headteacher?",
            ["Standard English with no slang", "A greeting such as “Dear Ms Patel” and an ending such as “Yours sincerely”"],
            ["Text-speak abbreviations such as “thx” and “u”", "Several exclamation marks in every line"],
            "A formal letter uses a polite structure and Standard English. Slang, abbreviations and excessive exclamation marks suit informal messages.",
            2,
          ),
          q7.single(
            "Which opening sentence would best hook a reader at the start of a story?",
            "The lift stopped between floors, and the lights went out.",
            ["This is a story about a lift.", "Lifts are machines that carry people between floors.", "Once there was a lift."],
            "A hook drops the reader straight into a tense moment. The other openings announce or explain rather than intrigue.",
            2,
          ),
          q7.single(
            "Read the paragraph.\n\nThe park was nice. It had trees. It had a pond. It had a bench. I liked it.\n\nWhich rewrite improves it best by varying the sentences and adding detail?",
            "Tucked behind the library, the park was a green surprise: oak trees leaned over a glassy pond, and beside it stood a lonely bench.",
            ["The park was nice. It had trees. It also had a pond and a bench. I liked it very much.", "The park was very, very nice and I really liked it a lot because it was nice.", "The park had trees, a pond and a bench, and the park was nice, and I liked the park."],
            "The best rewrite varies the opening, combines ideas in a long sentence and uses precise details. The others stay repetitive or vague.",
            3,
          ),
          q7.written(
            "Write the opening paragraph (about 80–100 words) of a story that begins on an empty beach at dawn. Use at least one simile, vary your sentence lengths, and show the character's feelings through action or detail rather than naming them.",
            "Model answer: The tide had left the beach as flat and grey as a sheet of slate. Ines stood at the edge of the water, her trainers sinking into the cold sand. Nothing moved. Somewhere far out, a bell clanged once and fell silent. She pulled her sleeves over her hands, then pushed them into her pockets, then pulled them out again. The note in her coat felt heavier than a stone. Behind her, the town was still asleep. Ahead, the sea kept its secrets. She took one long, shaky breath and began to walk.",
            "Tutor mark scheme (6 marks). 2 marks: engaging hook and setting that suits a dawn beach. 1 mark: at least one accurate simile or metaphor. 1 mark: varied sentence lengths (a mix of short and long). 1 mark: feelings shown through action or detail rather than named. 1 mark: accurate spelling, capital letters and full stops.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["Audience", "The people a piece of writing is intended for; it decides tone and vocabulary."],
        ["Purpose", "Why you are writing: to persuade, inform, entertain or describe."],
        ["Form", "The type of text, such as a letter, leaflet, speech or story."],
        ["Topic sentence", "The opening sentence of a paragraph that states its main idea."],
        ["Connective", "A word or phrase that links ideas (however, therefore, meanwhile)."],
        ["Cohesion", "How well the ideas and sentences of a text are linked so that it flows."],
        ["Show, don't tell", "Use actions and details to make the reader infer feelings, not just name them."],
        ["Proofreading order", "Check meaning first, then sentences, then spelling and punctuation."],
        ["Contrast connectives", "however, nevertheless, on the other hand, although."],
        ["Formal letter endings", "“Yours sincerely” after “Dear Ms Patel”; “Yours faithfully” after “Dear Sir or Madam”."],
      ]),
    },
    8: {
      year: 8,
      objectives: [
        "Write for different audiences and purposes, adapting register (formal to informal).",
        "Use rhetorical devices in persuasive writing.",
        "Structure and link paragraphs cohesively.",
        "Use narrative techniques: flashback, foreshadowing, pace.",
        "Edit for concision and precision.",
      ],
      note: {
        title: "Year 8: rhetoric, register and narrative craft",
        body: `## What you need to know

At Year 8 you **choose your techniques on purpose** and change **register** to suit your reader.

| Technique | What it is | Example |
| --- | --- | --- |
| Rule of three | Three items or ideas for rhythm | It was cold, dark and silent. |
| Anaphora | Repeating sentence openings | We will listen. We will learn. We will lead. |
| Rhetorical question | A question for effect | Who else will speak for the river? |
| Foreshadowing | A hint of what will happen later | The old clock struck three; it would be the last time anyone heard it. |
| Flashback | A scene from earlier in the story | Years before, Sam had stood here too. |
| Pace | Speed of the writing: short sentences = fast, long = slower | |

**Register:** informal writing uses slang and contractions (*gonna, loads*); formal writing uses precise words (*considerably, pupils*).

**Cohesion:** use pronouns and phrases such as *This change...* or *Such a view...* to link a sentence back to the one before.

## Editing for concision

Cut wordy padding: *"Due to the fact that it was raining"* can become *"Because it was raining"*.

## Model analysis (PEEL)

Sample: *"The ferry horn sounded once. Then twice. Then the harbour held its breath."*

- **Point:** The writer builds suspense.
- **Evidence:** "Then the harbour held its breath."
- **Explain:** Personification makes the whole place seem afraid, and the repeated "Then" gives a slow, growing rhythm.
- **Link:** The reader expects something dramatic to follow.`,
      },
      quiz: {
        title: "Writing — Composition: Year 8 quiz",
        questions: [
          q8.single(
            "Which sentence uses the rule of three?",
            "We need time, money and courage.",
            ["We need time and we need money.", "We need lots of time.", "Do we need money?"],
            "The rule of three groups three items (time, money, courage) to give a rhythmic, memorable effect.",
            1,
          ),
          q8.single(
            "Which opening is most appropriate for a formal letter of complaint?",
            "I am writing to complain about the faulty headphones I purchased from your store on 3 May.",
            ["Hi! You will not believe how rubbish these headphones are that I bought from you!", "Listen, your headphones are broken and I want all of my money back right now.", "OMG the headphones I got from your shop last week are a total joke, seriously."],
            "A formal complaint states the purpose clearly, gives details and avoids slang and aggression.",
            1,
          ),
          q8.single(
            "Read the sentence.\n\nMira laughed as she tied the rope around the old oak, never guessing how soon she would need it.\n\nWhat technique is used in the final clause?",
            "Foreshadowing",
            ["Flashback", "Onomatopoeia", "Alliteration"],
            "“Never guessing how soon she would need it” hints at a future event, building suspense.",
            2,
            { d: true },
          ),
          q8.single(
            "Read the sentences.\n\nThe council closed the pool. This decision angered parents.\n\nWhat does “This decision” do?",
            "It links back to the first sentence, making the text cohesive",
            ["It introduces a completely new topic that has no link", "It shows that the writer is unsure about the facts", "It makes the text sound informal and chatty in tone"],
            "A summarising phrase such as “This decision” refers back to what was just said, so the sentences connect.",
            2,
            { d: true },
          ),
          q8.multi(
            "The sentence “Kids should get loads more time to chill at school” is informal. Which TWO changes make it more formal?",
            ["Replace “kids” with “pupils”", "Replace “loads more” with “considerably more”"],
            ["Add several exclamation marks", "Add a joke at the end"],
            "Formal register uses precise, standard vocabulary. Exclamation marks and jokes do not make writing more formal.",
            2,
          ),
          q8.single(
            "Which sentence begins a flashback?",
            "Ten years earlier, on a night much like this, Ana had first climbed the tower.",
            ["Tomorrow, on a night much like this, Ana would climb the tower.", "Now, on this cold night, Ana climbs slowly up the tower.", "Suddenly, on the top step of the tower, Ana slipped."],
            "A flashback goes back to an earlier time. The first sentence moves the story ten years into the past.",
            2,
          ),
          q8.single(
            "Which technique will best speed up the pace of an action scene?",
            "Short sentences and strong active verbs",
            ["Long descriptive sentences full of adjectives", "Slow, detailed reflection on the past", "Lists of background facts"],
            "Short sentences and dynamic verbs create urgency and quick pace. Long descriptions slow a scene down.",
            1,
          ),
          q8.multi(
            "Read the sentence from a speech.\n\nWe shall not be silent; we shall not be still; we shall not be moved.\n\nWhich TWO devices does it use?",
            ["Anaphora (repeated openings)", "The rule of three"],
            ["Onomatopoeia", "A pun"],
            "“We shall not be...” is repeated three times: that is both anaphora and the rule of three.",
            2,
          ),
          q8.single(
            "Which is the most concise and precise rewrite of this sentence?\n\nIn my personal opinion, I think that the school should perhaps consider possibly changing its start time.",
            "In my view, the school should consider changing its start time.",
            ["I think in my opinion that the school might possibly consider a change to start time.", "The school start time, in my opinion, I think, should perhaps change.", "Personally I personally think the school should change."],
            "Good editing removes repeated ideas (“personal opinion”, “I think”, “perhaps”, “possibly”) while keeping the meaning.",
            3,
          ),
          q8.written(
            "Write a persuasive paragraph (about 80–100 words) urging Year 8 pupils to join a beach clean-up. Use at least TWO rhetorical devices (for example the rule of three, a rhetorical question or anaphora) and a suitable, engaging register.",
            "Model answer: Have you ever watched a wave wash a plastic bottle back onto the sand? Our beach deserves better. We can collect it, sort it and recycle it before the tide turns. We can care, we can act, we can change what our coastline looks like. It takes just one Saturday morning, a pair of gloves and a bag. Imagine walking on that shore in summer and knowing that you helped keep it clean. Join us. Bring a friend. Make the difference.",
            "Tutor mark scheme (6 marks). 2 marks: at least two rhetorical devices used deliberately and named or clearly identifiable. 1 mark: clear persuasive purpose with reasons or a call to action. 1 mark: register suited to Year 8 peers (engaging but not slangy). 1 mark: paragraph is cohesive with linking words or repeated patterns. 1 mark: accurate spelling and punctuation.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["Rule of three", "Grouping three items or ideas for rhythm and emphasis."],
        ["Anaphora", "Repeating the start of successive sentences or clauses."],
        ["Rhetorical question", "A question asked for effect, not for an answer."],
        ["Foreshadowing", "A hint in the narrative about what will happen later."],
        ["Flashback", "A scene showing events from earlier than the main story."],
        ["Pace", "The speed of a text: short sentences quicken it, long ones slow it."],
        ["Register", "The level of formality chosen for an audience and purpose."],
        ["Cohesion device", "A word or phrase that links back to earlier ideas: this decision, such a view."],
        ["Concision", "Saying what you mean in as few well-chosen words as possible."],
        ["Persuasive call to action", "A closing line that tells the reader what to do: Join us. Make the difference."],
      ]),
    },
    9: {
      year: 9,
      objectives: [
        "Write with control and sophistication for a range of audiences, purposes and forms.",
        "Use rhetoric and narrative techniques deliberately and analyse their effect.",
        "Structure extended writing with effective openings, shifts and endings.",
        "Vary register and sentence structure for effect.",
        "Edit and proof-read to improve precision, clarity and punctuation.",
      ],
      note: {
        title: "Year 9: crafting extended and sophisticated writing",
        body: `## What you need to know

At Year 9 the emphasis is on **control**: choosing structure, voice and language on purpose.

| Term | Meaning | Example |
| --- | --- | --- |
| Antithesis | Contrasting ideas in balanced phrases | Strong in mind, gentle in manner |
| Tricolon | A list of three parallel parts | Read it, question it, share it. |
| Anecdote | A short personal story to illustrate a point | Last winter, my neighbour... |
| Discourse marker | A word that guides the reader: *furthermore, admittedly, ultimately* | |
| Unreliable narrator | A narrator whose account cannot be fully trusted | |
| Structural shift | A change of focus, tone or time in a text | |

**Openings** should hook (a question, image or bold claim). **Endings** should resolve or provoke (a call to action, a circular return, a final image).

**Sentences for effect:** vary length and openings; use minor sentences and repetition for emphasis.

## Editing checklist

- Is each paragraph about **one main idea**?
- Are punctuation and commas around extra information correct?
- Have I replaced vague words (*nice, good, thing*) with precise ones?

## Model analysis (PEEL)

Sample: *"The corridor stretched away. Cold walls, cold floor, cold air. Just the drip of a tap somewhere behind him."*

- **Point:** The writer builds a bleak, tense mood.
- **Evidence:** "Cold walls, cold floor, cold air."
- **Explain:** The tricolon and the repeated "cold" strip the scene bare and make it feel lifeless, and the single drip of the tap adds a tense sound.
- **Link:** This prepares the reader for a character who feels trapped.`,
      },
      quiz: {
        title: "Writing — Composition: Year 9 quiz",
        questions: [
          q9.single(
            "Which sentence uses antithesis?",
            "United we thrive; divided we fail.",
            ["Fresh, fierce and free.", "Why should we wait?", "The tap dripped, drip, drip."],
            "Antithesis sets opposing ideas in balanced structures: “united / divided” and “thrive / fail”.",
            1,
          ),
          q9.single(
            "What is the main purpose of an anecdote in a persuasive article?",
            "To make a general point personal and relatable",
            ["To prove a scientific fact", "To provide a list of statistics", "To end the article with a question"],
            "A short personal story helps the reader connect emotionally with an argument.",
            1,
          ),
          q9.single(
            "Read the sample.\n\nRain drummed on the tin roof. Inside, Grandad wound the clock, as he had every night since 1974, and I counted the ticks, as I had every night since I was small. Tonight, the ticks seemed louder.\n\nWhat is the effect of the repeated pattern “as he had... as I had...”?",
            "It shows a comforting routine that continues across generations",
            ["It shows that the narrator is confused about dates", "It suggests that the roof is leaking", "It makes the passage sound like a formal report"],
            "The parallel phrases show two people repeating the same ritual, building a sense of family habit.",
            2,
          ),
          q9.single(
            "Read the sample.\n\nInside, Grandad wound the clock, as he had every night since 1974, and I counted the ticks, as I had every night since I was small. Tonight, the ticks seemed louder.\n\nWhat does the final sentence suggest?",
            "Something about tonight is different, hinting at tension",
            ["The narrator has become hard of hearing in one ear", "The old clock has been repaired by the grandfather", "Grandad has fallen asleep beside the clock tonight"],
            "The contrast word “Tonight” after a long routine signals a change and builds suspense.",
            2,
            { d: true },
          ),
          q9.multi(
            "Which TWO habits improve a formal article?",
            ["Opening each paragraph with a topic sentence", "Using discourse markers such as “furthermore” to link ideas"],
            ["Beginning every paragraph with the word “Also”", "Avoiding evidence so that it reads smoothly"],
            "Topic sentences and discourse markers help structure and link ideas. Repetitive openings and lack of evidence weaken writing.",
            2,
          ),
          q9.single(
            "Read the sample.\n\nNothing. No sound, no movement, no breath.\n\nWhich description best fits the technique?",
            "A minor sentence and repetition of “no” for emphasis",
            ["A long complex sentence full of subordinate clauses", "A simile comparing silence to an animal", "A list of five adjectives"],
            "“Nothing.” is a minor sentence, and repeating “no” three times emphasises emptiness.",
            2,
          ),
          q9.single(
            "Which sentence is punctuated correctly?",
            "The team, which had trained all winter, won the final.",
            ["The team which had trained all winter, won the final.", "The team, which had trained all winter won the final.", "The team; which had trained all winter, won the final."],
            "Extra, non-essential information must be enclosed by a matching pair of commas.",
            2,
            { d: true },
          ),
          q9.single(
            "Read the sample.\n\nI never lie. Everyone at the club says so, though I've noticed they say it quietly. I did not take the trophy; I merely borrowed it, permanently.\n\nWhat effect does the writer create?",
            "His claims contradict his own admissions, so he seems unreliable and comic",
            ["The narrator is shown to be completely honest and trustworthy", "The narrator is a child who has not yet learned to read", "The narrator is a police officer describing a serious crime"],
            "He claims honesty while admitting he kept the trophy “permanently”, so the reader must doubt him.",
            3,
          ),
          q9.single(
            "Which sentence would be LEAST appropriate in a formal speech to a governors' meeting?",
            "Honestly, it's a total nightmare for loads of us.",
            ["Many pupils have found the new timetable difficult.", "We would welcome the governors' guidance on this issue.", "I should like to outline three concerns."],
            "Formal speeches avoid slang and hyperbole such as “total nightmare” and “loads of us”.",
            1,
          ),
          q9.written(
            "Write the opening paragraph (about 80–120 words) of a speech to persuade your school council to create a wildlife garden. Use an anecdote or a rhetorical question, at least one of antithesis or tricolon, and a formal but engaging register.",
            "Model answer: Last spring, I watched a hedgehog cross our playground at lunchtime. Nobody chased it; nobody laughed. For once, everyone simply stopped and wondered. Why do we have to wait for a wild visitor to remember that nature belongs beside us? Our school has concrete in abundance but very little that grows. A wildlife garden would be small yet significant: a place to learn, to breathe and to belong. Ladies and gentlemen of the council, the choice before you is between a bare corner and a living classroom. I urge you to choose the classroom.",
            "Tutor mark scheme (8 marks). 2 marks: engaging opening (anecdote or rhetorical question). 2 marks: at least two devices used deliberately (antithesis, tricolon, direct address, etc.). 2 marks: formal but engaging register and clear persuasive purpose. 1 mark: cohesive paragraph with a clear line of argument. 1 mark: accurate spelling and punctuation, including commas and semicolons.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["Antithesis", "Placing opposite ideas in balanced phrases: united we thrive, divided we fail."],
        ["Tricolon", "A group of three parallel words, phrases or clauses."],
        ["Anecdote", "A short personal story used to illustrate a point."],
        ["Discourse marker", "A word or phrase that guides the reader through an argument (furthermore, admittedly)."],
        ["Unreliable narrator", "A narrator whose account is biased, mistaken or dishonest, so the reader must question it."],
        ["Structural shift", "A change in focus, tone or time within a text."],
        ["Effective openings", "Hook with a question, striking image, anecdote or bold claim."],
        ["Effective endings", "Resolve, provoke, return to the opening or end with a call to action."],
        ["Minor sentence", "A sentence without a main verb, used for emphasis (Nothing.)."],
        ["Commas for extra information", "Use a matching pair around non-essential clauses: The team, which had trained, won."],
      ]),
    },
  },
};
