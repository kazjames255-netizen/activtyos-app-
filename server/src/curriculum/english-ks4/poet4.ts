// English GCSE — Poetry (Years 10–11). Original questions aligned to the DfE GCSE English Literature subject content
// (exam-board neutral). Quoted poems are PUBLIC DOMAIN (Blake, Wordsworth, Shelley, Tennyson, Browning, Owen, Rossetti,
// Donne, Shakespeare); quotations are short and were checked against the standard texts.
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q10 = qb("poet4", 10);
const q11 = qb("poet4", 11);

export const TOPIC: CTopic = {
  key: "poet4",
  topic: "Poetry",
  subject: "English",
  years: {
    10: {
      year: 10,
      objectives: [
        "Read, understand and respond to poems from the English literary heritage, including Romantic, Victorian and First World War poetry (AO1).",
        "Analyse the language, form and structure used by poets to create meanings and effects, using subject terminology (AO2).",
        "Identify and explain form: sonnet, dramatic monologue, stanza, rhyme, rhythm and enjambment.",
        "Support interpretations with short, precise quotations.",
        "Show understanding of the ideas, perspectives and contexts in which poems were written (AO3).",
      ],
      note: {
        title: "Year 10: analysing a poem’s form, structure, imagery and tone",
        body: `## The four lenses

For any poem ask: **What is it about? Who speaks? How is it built? What effect does it have?**

| Term | Meaning |
| --- | --- |
| Form | The type of poem (sonnet, ballad, dramatic monologue) |
| Structure | How the poem is organised and how it shifts (stanzas, the turn or **volta**) |
| Imagery | Language that appeals to the senses (simile, metaphor, personification) |
| Tone | The speaker’s attitude (bitter, reverent, playful) |
| Enjambment | A sentence running over the end of a line |
| Caesura | A pause within a line |
| Anaphora | Repetition at the start of successive lines |

## Analysing with PEEL

Make a **point** about meaning, embed a **short quotation**, **explain** the effect of a word or device (and the reader’s response), then **link** to the poet’s ideas or context.

## Worked model paragraph

*Tennyson presents the charge as both heroic and doomed. The phrase “Into the valley of Death / Rode the six hundred” places the soldiers in a landscape that echoes a familiar biblical image of danger. The capital letter on “Death” makes it seem like a looming presence, while the driving rhythm and repeated line pattern suggest the men’s unstoppable, obedient advance. This links to the poem’s theme of duty.*

## Context matters

Blake wrote in the late 1700s, an age of industry and unrest; Shelley and Wordsworth were Romantics; Tennyson wrote in the Victorian era; Owen wrote as a soldier in the First World War.`,
      },
      quiz: {
        title: "Poetry: Year 10 quiz",
        questions: [
          q10.single("What form is Shelley’s “Ozymandias”?", "A sonnet (fourteen lines)", ["A ballad of many short stanzas", "An ode of ten-line stanzas", "A poem in free verse with no set length"], "“Ozymandias” has fourteen lines, so it is a sonnet, although its rhyme scheme is unusual.", 1),
          q10.single("The inscription in “Ozymandias” reads: “Look on my Works, ye Mighty, and despair!” What is the irony?", "It was meant as a boast, but the ruined statue shows the king’s works have vanished", ["The king was in fact humble and kind, and the inscription was written as a joke", "The statue is perfectly preserved and mighty, so the boast is proved completely true", "The traveller wrote the inscription himself to make the king look powerful and wise"], "Irony is a gap between meaning and reality. The command to despair is overturned by the wreck around it.", 2, true),
          q10.short("Blake’s phrase “mind-forg’d manacles” in “London” is an example of which figurative technique? (one word)", "metaphor", ["a metaphor", "Metaphor", "metaphor.", "a metaphor.", "metaphorical"], "It says minds are chained without using “like” or “as”. That makes it a metaphor.", 1),
          q10.single("In “London”, Blake writes of “the mind-forg’d manacles I hear”. What does this suggest?", "People are trapped by mental restrictions such as fear, poverty and oppression", ["The speaker can hear prisoners in a real jail, banging on the walls at night", "Londoners are proud of their strong, disciplined minds and their busy city life every day", "The Thames is frozen and silent, so nobody can travel by boat"], "Manacles are chains. “Mind-forg’d” means the chains are made by minds, suggesting invisible, self-imposed or social control.", 2),
          q10.single("In Owen’s “Dulce et Decorum Est”, soldiers are “Bent double, like old beggars under sacks”. What is the effect?", "The simile strips away glory, presenting young men as worn-out and pitiful", ["It shows the soldiers are enjoying a cheerful march through the countryside", "It suggests they are rich, well dressed and proud of how they look in uniform", "It shows they are hiding from an enemy"], "Comparing young soldiers to old beggars shows exhaustion and poverty of spirit, undermining any romantic view of war.", 2, true),
          q10.single("In Owen’s poem, the line “Gas! GAS! Quick, boys!” uses capitals, exclamation marks and direct speech. What is the effect?", "It creates sudden panic and urgency, putting the reader in the moment of attack", ["It creates a calm, reflective tone, as if the speaker is thinking quietly", "It shows the soldiers are playing a game to pass the time while waiting", "It slows the poem right down, so the reader can relax and enjoy the moment"], "The shouted, repeated word and punctuation mimic urgent warnings, so the reader feels the immediacy of danger.", 2),
          q10.single("Tennyson’s “The Charge of the Light Brigade” repeats “Cannon to right of them, / Cannon to left of them, / Cannon in front of them”. Which best describes this?", "Anaphora: repeated line openings emphasise being surrounded", ["Alliteration: repeated vowel sounds in each line", "Onomatopoeia: the sounds of the guns", "Caesura: a strong pause in the middle of every line"], "Repeating the opening word across lines is anaphora. The pattern makes the danger seem to close in on all sides.", 2),
          q10.single("Browning’s “My Last Duchess” is a dramatic monologue. Why might he have chosen this form?", "It lets the Duke reveal his own arrogance and cruelty without meaning to", ["It allows two speakers to argue equally", "It lets an objective narrator explain the events fairly and without opinion", "It lets the Duchess defend herself"], "The Duke talks alone to a silent listener, so the reader judges him by what he unintentionally gives away.", 3),
          q10.single("In “My Last Duchess” the Duke says: “I gave commands; / Then all smiles stopped together.” What does this suggest?", "That the Duke ended the Duchess’s smiling, probably by having her killed, and speaks of it coldly", ["That the Duke told a joke and everyone at the court laughed together happily", "That the Duchess left the palace by choice because she was unhappy with him", "That the Duke was sad and wanted to forgive her and bring her back home"], "The calm, understated way he mentions “commands” and silence hints at something sinister, which is what makes it chilling.", 3),
          q10.multi("Which TWO statements are true of Shakespeare’s Sonnet 18 (“Shall I compare thee to a summer’s day?”)?", ["It has fourteen lines", "It ends with a rhyming couplet"], ["It is written in free verse", "It has an octave rhymed ABBAABBA"], "This is a Shakespearean sonnet: three quatrains and a final couplet (“So long as men can breathe or eyes can see, / So long lives this, and this gives life to thee”).", 2),
          q10.single("Wordsworth begins “I wandered lonely as a cloud”. Which technique does the opening use?", "A simile comparing the speaker to a cloud", ["A metaphor saying that the speaker actually is a cloud", "Onomatopoeia", "A rhetorical question"], "The word “as” shows this is a simile. Wordsworth compares his own wandering to a drifting cloud.", 1),
          q10.single("Wordsworth ends with the daffodils flashing upon “that inward eye / Which is the bliss of solitude”. What does this suggest?", "Memory and imagination bring joy long after the experience, even when the speaker is alone", ["The speaker has gone blind and can only remember the flowers", "The daffodils have been destroyed and the speaker feels lonely without them", "The speaker regrets being lonely and wishes for company more than the flowers"], "The “inward eye” is the mind’s eye. Recalling the flowers gives lasting happiness, so solitude becomes “bliss”.", 3),
          q10.written("How does Owen present the horror of war in “Dulce et Decorum Est”? Write ONE analytical PEEL paragraph (about 100–120 words), using the quotation “Bent double, like old beggars under sacks” or “He plunges at me, guttering, choking, drowning.”", "A strong answer makes a clear point about horror, embeds a short quotation, analyses a word or device (simile, verb choice, listing) and links to Owen’s purpose or context as a soldier.", "Mark scheme (8 marks, plain-language AO1/AO2/AO3): 2 marks for a clear, relevant point and a personal interpretation; 2 marks for an accurate, well-chosen quotation; 3 marks for analysing methods and their effect (simile, verbs, listing, sound) using terminology; 1 mark for a link to context (Owen’s experience of the First World War) or to the poem’s wider message.", 3, 8),
        ],
      },
      flashcards: cards([
        ["“Look on my Works, ye Mighty, and despair!”", "Ozymandias, Shelley: the irony of a king’s boast; pride and the transience of power."],
        ["“mind-forg’d manacles”", "London, Blake: metaphor for mental oppression and control by society."],
        ["“the old Lie”", "Dulce et Decorum Est, Owen: rejecting the myth that dying for your country is sweet and fitting."],
        ["“Theirs not to reason why, / Theirs but to do and die”", "The Charge of the Light Brigade, Tennyson: duty and obedience."],
        ["“Looking as if she were alive”", "My Last Duchess, Browning: the Duke’s desire to control and possess."],
        ["“A host, of golden daffodils”", "I wandered lonely as a cloud, Wordsworth: nature’s joy and lasting memory."],
        ["Dramatic monologue", "A poem in which one speaker addresses a silent listener and reveals their character."],
        ["Volta", "The turn in a poem where the argument, mood or perspective shifts."],
        ["Sonnet", "A fourteen-line poem, usually in iambic pentameter."],
        ["Enjambment", "A sentence or phrase running on from one line to the next without a pause."],
      ]),
    },
    11: {
      year: 11,
      objectives: [
        "Compare poems’ ideas, methods and effects in a sustained, well-structured response (AO2, AO3).",
        "Connect poems to their contexts (Romantic, Victorian, First World War) without over-relying on biography (AO3).",
        "Analyse how form, structure and voice contribute to meaning, including the volta.",
        "Select apt quotations and evaluate the effects of language choices (AO1).",
        "Use accurate terminology and plan a comparative argument.",
      ],
      note: {
        title: "Year 11: comparing poems and using context",
        body: `## Comparing well

Build each paragraph with **PEEL** (point, evidence, explain, link), adding a comparative link.

Find a shared **idea** (power, conflict, memory, nature, loss), then compare **methods** and **effects**. Structure paragraphs around ideas, not around one poem at a time.

| Term | Meaning |
| --- | --- |
| Volta | The turn in argument or mood (often line 9 of a sonnet) |
| Dramatic monologue | One speaker addressing a silent listener |
| Ode / elegy / ballad | Praise poem / poem of mourning / narrative poem in short stanzas |
| Iambic pentameter | Ten syllables, five unstressed–stressed pairs |
| Blank verse | Unrhymed iambic pentameter |
| Sibilance | Repeated “s” sounds |

## Useful pairings

- **Power:** “Ozymandias” and “My Last Duchess” both expose arrogant rulers, one through irony and one through self-revelation.
- **Conflict:** “The Charge of the Light Brigade” and “Dulce et Decorum Est” present war very differently.
- **Nature and memory:** “I wandered lonely as a cloud” celebrates nature’s power to console.

## Context, used wisely

Link context to **meaning**, not as a list of facts. Owen was a soldier writing from experience, and Tennyson was Poet Laureate responding to a newspaper report of the Crimean War battle.

## Worked comparative paragraph

*Both of Blake’s poems “A Poison Tree” and “The Tyger” explore power that seems beyond ordinary control, but from opposite angles. In “A Poison Tree”, hidden anger (“I told it not, my wrath did grow”) is imagined as a plant that flourishes, suggesting that unspoken feelings become dangerous. Whereas in “The Tyger”, the questions “What immortal hand or eye, / Could frame thy fearful symmetry?” wonder at a creator’s awesome, even frightening, power. Both use regular rhyme and a steady beat, so the controlled form contrasts with the unsettling ideas.*`,
      },
      quiz: {
        title: "Poetry: Year 11 quiz",
        questions: [
          q11.short("What is the term for a pause within a line of poetry, often shown by punctuation?", "caesura", ["Caesura", "a caesura", "caesurae", "caesuras", "cesura", "caesura.", "a caesura."], "A caesura is a break within a line. It can slow the rhythm or create emphasis.", 1),
          q11.single("What is enjambment?", "When a phrase runs on to the next line without a pause", ["A repeated word or phrase at the start of successive lines in a poem", "A pause in the middle of a line, usually shown by a comma or full stop", "A rhyme between the ends of two lines that are next to each other"], "Enjambment carries the sense over the line break, creating flow or, sometimes, a sense of spilling over or lack of control.", 1),
          q11.single("Why is Browning’s “My Last Duchess” described as a dramatic monologue?", "One speaker talks to a silent listener and unintentionally reveals his character", ["Two speakers argue back and forth about the meaning of a painting on a wall", "It is a play that was performed on stage before it was published as a poem", "It is a private diary that was written by the Duchess before her death and later found by the Duke"], "The Duke addresses an envoy, and his words expose his pride and possessiveness.", 2, true),
          q11.single("Which best sums up the contrast between “The Charge of the Light Brigade” and “Dulce et Decorum Est”?", "Tennyson largely celebrates the soldiers’ courage, while Owen exposes war’s horror", ["Both poems say that war is glorious and that dying for your country is a fine thing", "Tennyson describes gas attacks in the trenches and Owen describes a cavalry charge", "Both poems were written by soldiers who took part in the battles they describe"], "Tennyson’s poem honours duty and bravery (though it hints “Someone had blunder’d”). Owen writes from experience to challenge the myth of glory.", 2, true),
          q11.single("Which contextual fact best helps explain the tone of Owen’s “Dulce et Decorum Est”?", "Owen served in the First World War and wrote from first-hand experience of the trenches", ["Owen was Poet Laureate and was writing to celebrate a great victory for Britain", "Owen never left England, so he imagined the war from newspaper reports, letters and stories told by others", "Owen wrote it as a recruitment poem to encourage young men to join the army"], "Owen’s experience as a soldier lies behind the poem’s angry, painful tone. He was killed in November 1918, a week before the Armistice.", 1),
          q11.single("Which statement about Tennyson and “The Charge of the Light Brigade” is true?", "He was Poet Laureate and wrote it in 1854, responding to a report of a Crimean War battle", ["He fought in the charge himself and wrote the poem afterwards from his hospital bed in the Crimea after he was wounded", "He wrote it during the First World War to remember the soldiers who had died", "He wrote it to persuade people to join the army and fight in the Crimean War"], "The poem responds to a real event in 1854 during the Crimean War, and Tennyson wrote as a Victorian Poet Laureate, not as a participant.", 2),
          q11.multi("Which THREE of these poems are sonnets?", ["Ozymandias", "Remember", "Death be not proud"], ["The Charge of the Light Brigade", "I wandered lonely as a cloud"], "Shelley’s, Rossetti’s and Donne’s poems are all fourteen-line sonnets. Tennyson’s and Wordsworth’s poems use other stanza forms.", 2),
          q11.single("In Rossetti’s “Remember”, the sestet begins: “Yet if you should forget me for a while / And afterwards remember, do not grieve.” How does the volta change the tone?", "From asking to be remembered to gently freeing the loved one from grief", ["From joy at being remembered to bitter anger that the loved one might one day forget her", "From a factual report of a death to a sudden and comic joke about the speaker’s funeral", "From a gentle warning to a direct threat against the loved one if she should forget"], "The turn (“Yet…”) shifts from the speaker’s request to a generous permission to forget, revealing selfless love.", 3),
          q11.multi("Which TWO techniques does Donne use in “Death be not proud”?", ["Personification of Death", "Direct address to Death"], ["A regular ballad stanza", "Dialect spelling"], "Donne speaks to Death as if it were a person, mocking its power. The poem is a sonnet, not a ballad.", 2),
          q11.single("Which comparison of Blake’s “London” and Wordsworth’s “I wandered lonely as a cloud” is most precise?", "Blake’s regular ABAB quatrains and repeated “charter’d” suggest a trapped, mechanical city, whereas Wordsworth’s flowing stanzas and “dancing” daffodils mirror natural freedom", ["Both poems are set in busy cities and are written in free verse without a regular rhyme scheme, which lets each poet describe the crowded streets and the people in them in a loose, conversational style", "Blake celebrates the beauty of nature in the countryside outside London, whereas Wordsworth criticises the noise and misery of city life and its effect on the people he sees", "Neither poet uses imagery or figurative language; instead both rely on plain factual statements about what the speaker sees, so the poems are reports rather than descriptions"], "A strong comparison links form and language to meaning. Blake’s controlled pattern echoes restriction, and Wordsworth’s lively imagery evokes freedom.", 3),
          q11.single("Which is the best opening sentence for a comparative paragraph on “Ozymandias” and “My Last Duchess”?", "Both Shelley and Browning expose the arrogance of powerful men, but Shelley does so through irony while Browning lets his speaker condemn himself", ["Shelley wrote “Ozymandias” in 1817 and Browning wrote “My Last Duchess” in 1842, and both poets were English and are still very famous today.", "“Ozymandias” is about a broken statue of a king in the desert, and “My Last Duchess” is about a painting of a duke’s wife that hangs on a wall behind a curtain.", "I will now compare the two poems, first by writing about “Ozymandias” and then by writing about “My Last Duchess”, before giving my own opinion at the end."], "A strong topic sentence names a shared idea and compares the methods. The others describe or announce without analysing.", 3),
          q11.single("Blake wrote “London” in 1794. Which contextual point is most useful for interpreting it?", "Blake was a radical critic of the Church, the State and the poverty he saw in London", ["Blake wrote it as a cheerful tourist guide to the sights of London", "Blake was a soldier who was describing a battle he had fought in Europe", "Blake was celebrating the long, prosperous and successful reign of Queen Victoria in London"], "Blake’s images of misery and control criticise institutions, so knowing his radical outlook helps explain the poem’s anger.", 2),
          q11.written("Compare how the poets present power in “Ozymandias” and “My Last Duchess”. Write two comparative paragraphs (about 150 words), using at least one short quotation from each poem.", "A strong answer compares ideas (e.g. arrogance and its downfall), uses precise quotations from each poem, analyses methods (irony, dramatic monologue, form) and shows how they shape meaning.", "Mark scheme (8 marks, plain-language AO1/AO2/AO3): 2 marks for a clear comparative idea (not two separate summaries); 2 marks for accurate quotations from BOTH poems; 3 marks for analysing methods and effects (irony, voice, form) with terminology; 1 mark for a relevant, well-integrated point of context or a clear conclusion.", 3, 8),
        ],
      },
      flashcards: cards([
        ["Caesura", "A pause within a line of poetry, often shown by punctuation."],
        ["Iambic pentameter", "A line of ten syllables in five unstressed–stressed pairs."],
        ["Blank verse", "Unrhymed iambic pentameter."],
        ["Elegy", "A poem of mourning or reflection on loss."],
        ["“Someone had blunder’d”", "The Charge of the Light Brigade: Tennyson hints at a mistake in command while still honouring the men."],
        ["“Marks of weakness, marks of woe”", "London, Blake: repetition presents suffering as visible on every face."],
        ["“Nothing beside remains”", "Ozymandias, Shelley: the total loss of the king’s power; the theme of transience."],
        ["“Better by far you should forget and smile / Than that you should remember and be sad”", "Remember, Rossetti: selfless love; the loved one’s happiness matters most."],
        ["Comparative connectives", "Both … but, whereas, in contrast, similarly, by comparison."],
        ["How to use context", "Link it to meaning (why the poet writes this way), not as a list of facts."],
      ]),
    },
  },
};
