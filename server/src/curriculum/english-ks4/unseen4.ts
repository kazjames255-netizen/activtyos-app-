// English GCSE — Unseen Poetry (Years 10–11). Every poem below is ORIGINAL, written for ActivityOS, in the style of a GCSE
// unseen-poetry task. Aligned to the DfE GCSE English Literature subject content (exam-board neutral).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q10 = qb("unseen4", 10);
const q11 = qb("unseen4", 11);

const POEM_A = `Poem A: “Night Bus”

The driver’s mirror holds a stranger’s yawn,
the windows hold the city upside down.
A phone-glow blooms in every seat, then dies.
We are a lit-up aquarium of the tired,
each fish nudging its own small screen,
while streetlamps count us out, one by one,
as though we might not all get home.`;

const POEM_B = `Poem B: “Grandmother’s Kitchen”

The kettle sings the same low note it always did.
Flour dust hangs in a slant of morning light,
and I, taller now, stoop under the doorway
that once seemed a great arch to me.
Nothing here has moved; only I have grown,
and the clock, patient as a nurse,
keeps ticking past her empty chair.`;

const POEM_C = `Poem C: “Harbour Wall”

The harbour wall is stubborn as a mule,
its back bent to the weather, cold and grey.
It never asks the sea to change its rule;
it simply stays, and lets the waves give way.

Each winter takes a little of its stone;
each summer children sit along its spine.
It holds them all, and holds them as its own,
a patient shelter where the tides decline.`;

const POEM_D = `Poem D: “Service Station”

Strip-lit and humming, the forecourt never sleeps.
Strangers queue for coffee the colour of tarmac,
nod at each other like passing ships,
and leave. Nobody stays long enough
to be anyone. A child presses her nose
to the glass of the toy machine,
the only person here who has stopped to wonder.`;

export const TOPIC: CTopic = {
  key: "unseen4",
  topic: "Unseen Poetry",
  subject: "English",
  years: {
    10: {
      year: 10,
      objectives: [
        "Read and respond to a previously unseen poem, forming an informed personal response (AO1).",
        "Analyse the poet’s methods: form, structure, imagery, sound, and word choice, using terminology (AO2).",
        "Identify tone, mood and shifts in a poem, and explain how they are created.",
        "Support ideas with short embedded quotations and explain their effects.",
        "Approach an unseen poem with a clear routine: title, first read, structure, methods, ending.",
      ],
      note: {
        title: "Year 10: a routine for analysing an unseen poem",
        body: `## Stay calm: use a routine

You do not need to have seen the poem. You need a **method**.

1. **Title and first read:** what is it about? Who speaks? What is the mood?
2. **Structure and form:** how many stanzas? Is there rhyme or free verse? Where does it shift (the **volta**)?
3. **Language:** underline images, striking verbs and sound patterns.
4. **Ending:** how does the final line change or sharpen the meaning?
5. **Write:** PEEL paragraphs that move through the poem.

| Term | Meaning |
| --- | --- |
| Free verse | No regular rhyme scheme or metre |
| Stanza | A group of lines (a “verse”) |
| Enjambment | A sentence running on past the line end |
| Extended metaphor | A comparison developed over several lines |
| Volta | A turning point in mood or idea |
| Tone | The speaker’s attitude |

## Worked model paragraph (on invented lines)

*Lines: “The last swimmer leaves the pool; / the water keeps her shape a moment, then forgets.”*

*The poet suggests how quickly people are forgotten. The personification of the water “forgets” gives the pool a human memory, while the pause created by the semicolon makes the reader linger on the moment of her absence. The gentle, melancholy tone leaves the reader thoughtful about how temporary each presence can be.*

**Tip:** always comment on **effect**, not just technique.`,
      },
      quiz: {
        title: "Unseen Poetry: Year 10 quiz",
        questions: [
          q10.single(`${POEM_A}\n\nWhat form does Poem A take?`, "Free verse: no regular rhyme scheme or metre", ["A Shakespearean sonnet of fourteen lines with a final couplet", "A ballad with rhyming couplets and a repeated chorus line", "A limerick with a bouncy rhythm and a comic final line"], "The lines do not follow a rhyme scheme or fixed rhythm, which is a mark of free verse.", 1),
          q10.single(`${POEM_A}\n\n“We are a lit-up aquarium of the tired, / each fish nudging its own small screen.” What is the effect of this image?`, "Passengers seem like silent fish behind glass, each alone in a glowing world", ["It shows that the bus is a lively tourist attraction full of curious visitors", "It shows the passengers are hungry and looking for something to eat on the bus", "It suggests that the passengers are swimming home through a flooded city"], "The extended metaphor presents people as fish in a tank, quiet and separate, each drawn to a small light.", 2, true),
          q10.single(`${POEM_A}\n\n“while streetlamps count us out, one by one.” Which technique is used, and what is the effect?`, "Personification: the lamps seem to watch over the passengers, adding an uneasy mood", ["Alliteration: the repeated ‘s’ sound makes a comic effect that lightens the poem", "Onomatopoeia: the lamps make a loud buzzing sound as the bus goes past", "A rhetorical question: it asks the reader to reply and count the lamps too"], "A lamp cannot count. Giving it this action makes the city seem watchful, which supports the quiet unease.", 2),
          q10.single(`${POEM_A}\n\nWhat is the effect of the final line, “as though we might not all get home”?`, "It adds a note of quiet anxiety, shifting from calm observation to uncertainty", ["It proves that everyone reaches home safely and that the journey was calm", "It introduces a joke to end the poem on a light, cheerful and playful note", "It changes the setting to a different city where the passengers are heading"], "The closing thought hints at vulnerability. The reader is left with a sense of worry rather than resolution.", 3),
          q10.single(`${POEM_A}\n\nWhich adjectives best describe the overall tone of Poem A?`, "Weary, reflective and a little uneasy", ["Cheerful, boastful and full of excitement about the journey", "Furious, aggressive and ready to argue with the other passengers", "Playful and silly, like a children’s poem about a journey"], "The images of tired passengers, dim screens and watchful streetlamps create a weary, quietly uneasy mood.", 2),
          q10.single(`${POEM_B}\n\n“The kettle sings the same low note it always did.” What is the effect of “sings”?`, "It personifies the kettle, making the kitchen feel familiar and comforting", ["It shows that the kettle is broken and making a strange noise when it boils", "It suggests that the kettle is being sung to by the speaker’s grandmother", "It proves that someone is singing in the next room while the kettle boils"], "Giving the kettle a voice gives the kitchen warmth. “Always” stresses the sense of continuity.", 2),
          q10.single(`${POEM_B}\n\nWhat does “the doorway / that once seemed a great arch to me” show?`, "How the speaker’s perspective has changed: what once seemed huge now looks small", ["That the doorway has been rebuilt and is now much lower than it was before", "That the speaker dislikes archways and old houses with low doorways", "That the speaker is still a small child and is looking up at the arch"], "The contrast between “once” and “taller now” shows growing up and the way memories look bigger than reality.", 2),
          q10.single(`${POEM_B}\n\nThe line “Nothing here has moved; only I have grown” marks a turning point in the poem. How does the focus shift?`, "From describing the kitchen to reflecting on the speaker’s own change and loss", ["From the past to a plan for the future that the speaker has decided to make", "From sadness about the past to a joke about the speaker’s height", "From the kitchen to a journey that the speaker is about to make"], "The poem begins with details of the room, then this line turns to the speaker’s feelings, so it acts as the volta.", 2, true),
          q10.single(`${POEM_B}\n\n“the clock, patient as a nurse, / keeps ticking past her empty chair.” What is implied?`, "The grandmother is absent or has died, and time continues without her", ["The grandmother is asleep in the chair and does not notice the clock", "The clock is broken and no longer tells the correct time in the kitchen", "The speaker is late for an appointment and keeps glancing at the clock"], "The “empty chair” is an image of absence, and the ticking clock shows that time carries on.", 3),
          q10.short(`${POEM_B}\n\nWhat technique is “patient as a nurse”? (one word)`, "simile", ["a simile", "Simile", "simile.", "a simile."], "It compares the clock to a nurse using “as”, which is a simile.", 1),
          q10.short(`${POEM_B}\n\nWhat is the term for a sentence that runs over the end of a line, as in “I, taller now, stoop under the doorway / that once seemed a great arch to me”? (one word)`, "enjambment", ["Enjambment", "run-on line", "enjambement", "enjambment.", "enjambement.", "run-on", "run on line", "run-on lines", "enjambed"], "The sense flows on without a stop, and this makes the reading smooth and conversational.", 1),
          q10.single(`${POEM_A}\n\n${POEM_B}\n\nWhat do the final lines of the two poems share?`, "Both end on a quiet note of unease or loss rather than a firm resolution", ["Both end with a joke that lightens the mood after the sadness of the poem", "Both end with a triumphant celebration of the people that they describe", "Both end with a direct question to the reader that demands a clear answer"], "Poem A ends on worry about getting home, and Poem B ends with an empty chair. Neither closes with a resolution.", 3),
          q10.written(`${POEM_A}\n\nHow does the poet present the feelings of people travelling through a city at night in Poem A? Write ONE analytical PEEL paragraph (about 100–120 words), using a short quotation.`, "A strong answer offers an interpretation (isolation, tiredness, unease), embeds a short quotation (e.g. “aquarium of the tired”), analyses imagery or personification, and comments on the effect on the reader.", "Mark scheme (8 marks, plain-language AO1/AO2): 2 marks for a clear, relevant interpretation; 2 marks for a well-chosen, accurate quotation; 3 marks for analysing methods (extended metaphor, personification, tone) using terminology and explaining effect; 1 mark for a link to the poem’s ending or wider meaning.", 3, 8),
        ],
      },
      flashcards: cards([
        ["First step with an unseen poem", "Read the title and read the poem twice: what is it about, who speaks, what is the mood?"],
        ["Free verse", "Poetry with no regular rhyme scheme or metre."],
        ["Stanza", "A group of lines in a poem, like a paragraph."],
        ["Volta", "A turn in mood or idea within a poem."],
        ["Extended metaphor", "A comparison developed across several lines."],
        ["Personification", "Giving human qualities to something non-human."],
        ["Enjambment", "A sentence running over the end of a line without a pause."],
        ["Tone", "The speaker’s attitude or feeling, such as nostalgic, bitter or wry."],
        ["Why does the ending matter?", "It often changes or sharpens the meaning; always comment on how the final lines affect the reader."],
        ["PEEL for poetry", "Point about meaning, short quotation, explain the effect of the method, link to the poem’s wider idea."],
      ]),
    },
    11: {
      year: 11,
      objectives: [
        "Compare two unseen poems, connecting ideas, attitudes and methods (AO2, AO3 in the poetry context).",
        "Analyse how form, structure, imagery and sound contribute to different effects.",
        "Evaluate a claim about two poems, weighing evidence for and against (AO1).",
        "Use comparative language and embed short quotations from both poems.",
        "Plan a response that moves fluently between the two poems.",
      ],
      note: {
        title: "Year 11: comparing two unseen poems",
        body: `## Comparing well

Build each paragraph with **PEEL** (point, evidence, explain, link), adding a comparative link.

Do not write about Poem 1 then Poem 2. Choose an **idea** they share or contrast (e.g. time, place, people, loss) and write paragraphs that hold both poems together.

| Term | Meaning |
| --- | --- |
| Quatrain | A four-line stanza |
| Rhyme scheme | The pattern of end rhymes, e.g. ABAB |
| Juxtaposition | Placing contrasting things side by side |
| Sibilance | Repeated “s” sounds |
| Imagery | Descriptive language that creates pictures or sensations |
| Comparative connectives | Similarly, whereas, in contrast, by comparison |

## Plan

1. Note the **subject** of each poem in a few words.
2. Find **two or three** shared or contrasting ideas.
3. For each idea, find a **method** in each poem (form, image, word choice) and its **effect**.
4. Write a short judgement at the end.

## Worked model paragraph (on invented lines)

*Poem 1: “The bells rang the village awake.” Poem 2: “The alarm clock coughed the city to life.”*

*Both poets personify a wake-up sound, but with contrasting effects. In Poem 1, “rang the village awake” suggests a warm, communal ritual, whereas in Poem 2 the harsher verb “coughed” makes the city seem sickly and mechanical. The poets therefore use similar techniques to present opposing attitudes to community and modern life.*

**Tip:** compare the *effect* of each method, not just the fact that it exists.`,
      },
      quiz: {
        title: "Unseen Poetry: Year 11 quiz",
        questions: [
          q11.single(`${POEM_C}\n\nWhat is the form of Poem C?`, "Two four-line stanzas (quatrains) rhyming ABAB", ["A fourteen-line sonnet with a final rhyming couplet", "Free verse with no rhyme and lines of very different lengths", "Six rhyming couplets with a repeated line at the end of each"], "Each quatrain rhymes alternately (mule/rule, grey/way and stone/own, spine/decline).", 1),
          q11.single(`${POEM_C}\n\n${POEM_D}\n\nWhich is a difference in form between Poem C and Poem D?`, "Poem C uses a regular rhyme scheme, whereas Poem D is free verse", ["Poem C is free verse with no rhyme, whereas Poem D is a fourteen-line sonnet", "Both use the same regular rhyme scheme of ABAB in every stanza", "Poem D is written in quatrains and Poem C is one long stanza"], "C’s regular rhyme suggests steadiness, and D’s free verse feels looser and more transient.", 2, true),
          q11.single(`${POEM_C}\n\nWhat is the effect of the simile “stubborn as a mule”?`, "It presents the wall as determined and resistant, a homely image of resilience", ["It shows that the wall is a living animal that breathes and walks along the sea", "It suggests that the wall is about to collapse under the force of the storm", "It shows that the poet dislikes the wall and wishes that it would fall down"], "A mule is famous for its stubbornness, so the comparison shows the wall’s firm endurance in a homely way.", 2),
          q11.single(`${POEM_D}\n\nWhat is the effect of “nod at each other like passing ships”?`, "It suggests brief, impersonal contact between strangers", ["It suggests that the strangers are sailors who are travelling together by sea", "It suggests the strangers are close friends", "It shows the forecourt is next to a harbour"], "Passing ships briefly meet and then part, so the simile shows fleeting, distant human contact.", 2),
          q11.single(`${POEM_C}\n\n${POEM_D}\n\nWhich statement best compares the ideas of the two poems?`, "Poem C values endurance and shelter, whereas Poem D presents transience", ["Both poems celebrate a busy, crowded city full of interesting people and lively streets", "Both poems are about a family reunion after many years apart", "Poem C is about danger at sea, whereas Poem D is about safety on land"], "The wall stays and shelters, and the service station is a place people only pass through.", 2, true),
          q11.single(`${POEM_D}\n\nThe final line describes the child as “the only person here who has stopped to wonder.” What is its effect?`, "It contrasts the adults’ hurry with a child’s curiosity, ending on a note of hope", ["It shows that the child is lost and is looking for her parents in the crowd of people", "It shows that the child is annoying the strangers by pressing on the glass", "It shows that the toy machine is broken and that the child is disappointed"], "After the poem’s cold, transient imagery, the child’s wonder brings warmth and suggests what the adults have lost.", 3),
          q11.single(`${POEM_C}\n\nThe wall “simply stays, and lets the waves give way.” Which interpretation is most convincing?`, "Its strength lies in staying firm, not fighting; it has power through patience", ["The wall attacks the waves and pushes them back out to sea with great force and anger", "The waves are afraid of the children who sit along the top of the wall", "The wall wants to leave the harbour and to travel to a calmer place"], "The verbs “stays” and “lets” show quiet endurance rather than aggression, and this gives the wall dignity.", 3),
          q11.short(`${POEM_C}\n\nWhat one-word term describes giving the wall human qualities in “It never asks the sea to change its rule”?`, "personification", ["Personification", "personified", "personification.", "personifying", "personifies"], "The wall is treated as if it could ask, so the poet personifies it.", 1),
          q11.multi(`${POEM_D}\n\nWhich THREE features does Poem D contain?`, ["Free verse without a regular rhyme scheme", "A simile", "Sentences that run on across line endings (enjambment)"], ["A rhyming couplet ending", "A refrain repeated in every stanza"], "Poem D has no rhyme scheme, includes “like passing ships”, and runs sentences across lines (e.g. “Nobody stays long enough / to be anyone”).", 1),
          q11.multi(`${POEM_C}\n\n${POEM_D}\n\nWhich TWO are valid similarities between the poems?`, ["Both use personification", "Both use similes"], ["Both use a regular rhyme scheme", "Both are set beside the sea"], "C personifies the wall and D says the forecourt “never sleeps”. C has “stubborn as a mule” and D has “like passing ships”.", 2),
          q11.single(`${POEM_C}\n\n${POEM_D}\n\nWhich best compares the tone of the poems?`, "Poem C is admiring and comforting, whereas Poem D is detached, softening at the end", ["Both are angry and bitter about the way that people treat the places they use", "Poem C is cold and unfriendly, whereas Poem D is warm and welcoming throughout", "Both are humorous throughout and are meant to make the reader laugh out loud"], "C praises the wall’s endurance, and D observes strangers coldly before the child brings warmth.", 2),
          q11.single(`A student claims: “Poem C is more hopeful than Poem D.” (Poem C ends on a patient shelter where the tides decline; Poem D ends on a child who “has stopped to wonder”.)\n\nWhich response is best supported?`, "Partly: C offers steady shelter, but D ends on a child’s wonder, so both hold hope", ["Fully: Poem D contains no hope of any kind and ends in a cold, empty place", "Not at all: Poem C is entirely bleak and gives no comfort to anyone in it", "Fully: only the regular rhyme in Poem C can be hopeful, since D has no rhyme"], "A good evaluation weighs the claim. Both poems end with quiet positives: shelter in C and wonder in D.", 3),
          q11.written(`${POEM_C}\n\n${POEM_D}\n\nCompare how the poets present places and the people who use them in Poems C and D. Write two comparative paragraphs (about 150 words), using short quotations from both poems.`, "A strong answer compares an idea (e.g. permanence versus transience), uses quotations from both poems, analyses methods (simile, personification, form) and effects, and uses comparative connectives.", "Mark scheme (8 marks, plain-language AO1/AO2/AO3): 2 marks for a clear comparison of ideas (not two separate summaries); 2 marks for accurate quotations from BOTH poems; 3 marks for analysing methods and effects (imagery, form, tone) with terminology; 1 mark for fluent comparative connectives and a concluding judgement.", 3, 8),
        ],
      },
      flashcards: cards([
        ["Quatrain", "A four-line stanza."],
        ["Rhyme scheme", "The pattern of end rhymes, written as letters (ABAB)."],
        ["Juxtaposition", "Placing contrasting ideas or images side by side."],
        ["Sibilance", "Repeated “s” sounds, often creating a hushing or sinister effect."],
        ["Comparative connectives", "Similarly, likewise, whereas, in contrast, by comparison."],
        ["Comparing poems: plan", "Find a shared idea, then compare methods and effects; avoid writing about each poem separately."],
        ["Form and meaning", "Regular rhyme can suggest order or steadiness; free verse can suggest freedom or unease."],
        ["Speaker vs poet", "The speaker is the voice in the poem; the poet is the writer, so say “the poet suggests…”."],
        ["Effect of a simile", "Explain what the comparison makes the reader see or feel, not only that it exists."],
        ["Evaluating a claim", "Weigh the statement with evidence for and against, then give a judgement."],
      ]),
    },
  },
};
