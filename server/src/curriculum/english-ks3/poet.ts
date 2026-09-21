// KS3 English — Poetry (Years 7–9). Poems quoted are public domain (Blake, Wordsworth, Tennyson, Owen, Keats, Shakespeare, Shelley, Donne, Dickinson, Coleridge, Kipling); others are ORIGINAL.
// Aligned to the DfE KS3 English programme of study (OGL v3.0). Quotations are checked in _check_e3.ts.
import type { CTopic } from "../types";
import { qb, cards } from "./_b";

const q7 = qb("poet", 7), q8 = qb("poet", 8), q9 = qb("poet", 9);

const EAGLE = `He clasps the crag with crooked hands;
Close to the sun in lonely lands,
Ring'd with the azure world, he stands.

The wrinkled sea beneath him crawls;
He watches from his mountain walls,
And like a thunderbolt he falls.`;
const DAFF = `I wandered lonely as a cloud
That floats on high o'er vales and hills,
When all at once I saw a crowd,
A host, of golden daffodils;`;
const LONDON = `I wander thro' each charter'd street,
Near where the charter'd Thames does flow.
And mark in every face I meet
Marks of weakness, marks of woe.`;
const CHARGE = `Half a league, half a league,
Half a league onward,
All in the valley of Death
Rode the six hundred.`;
const ANTHEM = `What passing-bells for these who die as cattle?
Only the monstrous anger of the guns.
Only the stuttering rifles' rapid rattle
Can patter out their hasty orisons.`;
const S18 = `Shall I compare thee to a summer's day?
Thou art more lovely and more temperate:
Rough winds do shake the darling buds of May,
And summer's lease hath all too short a date;`;
const OZY = `And on the pedestal, these words appear:
My name is Ozymandias, King of Kings;
Look on my works, ye Mighty, and despair!
Nothing beside remains. Round the decay
Of that colossal wreck, boundless and bare
The lone and level sands stretch far away.`;

export const TOPIC: CTopic = {
  key: "poet",
  topic: "Poetry",
  subject: "English",
  years: {
    7: {
      year: 7,
      objectives: [
        "Read and appreciate a range of poetry, including poems from the English literary heritage.",
        "Identify form: stanza, line, rhyme scheme, couplet and quatrain.",
        "Explain the effect of imagery: simile, metaphor and personification.",
        "Recognise sound devices: alliteration, onomatopoeia and rhyme.",
        "Identify tone and compare two poems.",
      ],
      note: {
        title: "Year 7: reading poems for form, imagery and sound",
        body: `## What you need to know

A poem is built from **lines**, grouped into **stanzas**. Notice its **form** (shape), its **imagery** (pictures made with words), its **sound**, and its **tone** (the speaker's attitude).

| Term | Meaning |
| --- | --- |
| Stanza | A group of lines in a poem (like a paragraph) |
| Quatrain / couplet / triplet | A stanza of 4 / 2 / 3 lines |
| Rhyme scheme | The pattern of end rhymes, labelled with letters (abab) |
| Imagery | Descriptive language that appeals to the senses |
| Simile / metaphor | Comparison with *like/as* / saying one thing *is* another |
| Personification | Giving human qualities to a non-human thing |
| Alliteration | Repeated consonant sounds at the start of nearby words |
| Onomatopoeia | A word that sounds like its meaning |
| Tone | The attitude or mood, such as joyful, sad or wistful |

## Model analysis (PEEL)

Blake's lines: *"Tyger Tyger, burning bright, / In the forests of the night;"*

- **Point:** Blake presents the tiger as both dazzling and mysterious.
- **Evidence:** "burning bright".
- **Explain:** The fire imagery makes the tiger seem glowing and dangerous, and the alliteration of "b" gives a strong, pulsing rhythm.
- **Link:** "forests of the night" adds darkness, so the tiger is a creature of both light and shadow.

**Tip:** Read every poem aloud twice: once for sense, once for sound.`,
      },
      quiz: {
        title: "Poetry: Year 7 quiz",
        questions: [
          q7.single(
            `Read the first stanza of “The Eagle” by Alfred, Lord Tennyson.\n\n${EAGLE.split("\n\n")[0]}\n\nWhat is the rhyme scheme of this stanza?`,
            "aaa (all three lines rhyme)",
            ["aba (first and third lines rhyme)", "aab (first two lines rhyme)", "abc (no lines rhyme)"],
            "“hands”, “lands” and “stands” all rhyme, so every line is labelled a. A three-line stanza is a triplet.",
            1,
            { q: ["He clasps the crag with crooked hands;"] },
          ),
          q7.single(
            `Read the final line of “The Eagle”.\n\nAnd like a thunderbolt he falls.\n\nWhat technique is used in “like a thunderbolt”?`,
            "Simile",
            ["Metaphor", "Onomatopoeia", "Alliteration"],
            "It compares the eagle's dive to a thunderbolt using the word “like”, so it is a simile.",
            1,
            { q: ["And like a thunderbolt he falls."] },
          ),
          q7.single(
            `Read these lines from “The Eagle”.\n\n${EAGLE.split("\n\n")[0]}\n\nWhat is the effect of describing the eagle's claws as “crooked hands”?`,
            "It compares the talons to hands, showing them curved and gripping like human fingers",
            ["It suggests the eagle has been injured and can no longer fly", "It shows that the eagle is dishonest and untrustworthy by nature", "It hints that the eagle is friendly towards the humans nearby"],
            "The image of “hands” gives the bird a human, grasping quality, while “crooked” makes the talons look curved and strong.",
            2,
            { d: true, q: ["He clasps the crag with crooked hands;"] },
          ),
          q7.single(
            `Read these lines from “The Eagle”.\n\n${EAGLE.split("\n\n")[1]}\n\nWhat does “The wrinkled sea beneath him crawls” suggest?`,
            "From high above, the waves look small, wrinkled and slow-moving",
            ["The sea is stormy and dangerous, about to flood the land below", "The eagle is swimming across the water towards the distant shore", "The sea has frozen solid, so that it looks cracked and still"],
            "From the eagle's great height the sea looks like a wrinkled surface that barely moves. It shows how high up he is.",
            2,
            { q: ["The wrinkled sea beneath him crawls;"] },
          ),
          q7.short(
            `Read the first four lines of “I wandered lonely as a cloud” by William Wordsworth.\n\n${DAFF}\n\nWhat is the rhyme scheme of these four lines? (Use letters, e.g. abcd.)`,
            "abab",
            ["a b a b", "a-b-a-b", "a,b,a,b", "a, b, a, b", "a/b/a/b", "a b a b."],
            "“cloud” rhymes with “crowd” (a) and “hills” with “daffodils” (b), so the pattern is abab.",
            2,
            { q: ["I wandered lonely as a cloud", "A host, of golden daffodils;"] },
          ),
          q7.multi(
            `Read the opening line of Wordsworth's poem.\n\nI wandered lonely as a cloud\n\nWhich TWO statements are true?`,
            ["It contains a simile", "It is written in the first person"],
            ["It contains onomatopoeia", "It is addressed to a friend"],
            "“as a cloud” is a simile, and “I wandered” shows the speaker uses “I”. There is no sound word or named listener.",
            2,
            { d: true, q: ["I wandered lonely as a cloud"] },
          ),
          q7.multi(
            `Read this original poem.\n\nThe kettle hissed and hiccuped,\nthe toaster popped and spat,\nand Dad, still half-asleep, just stared\nat where the marmalade sat.\n\nWhich TWO words are onomatopoeic?`,
            ["hissed", "popped"],
            ["marmalade", "asleep"],
            "“Hissed” and “popped” imitate the sounds they describe. “Marmalade” and “asleep” do not.",
            1,
          ),
          q7.short(
            "Read this original line.\n\nThe silver stream slid silently by.\n\nWhat is the term for the repeated “s” sound at the start of nearby words?",
            "alliteration",
            ["an alliteration", "sibilance"],
            "Repeating the same consonant sound at the start of nearby words is alliteration. Here it gives a smooth, hushed sound.",
            2,
          ),
          q7.single(
            `Read this original poem.\n\nThey tell me it is only rain.\nI watch it hammer on the pane\nand think of you, and think again,\nand wish that it were only rain.\n\nWhat is the effect of repeating “only rain” at the start and end?`,
            "It changes meaning: first dismissive, then a symbol of the speaker's pain",
            ["It shows that the speaker enjoys wet weather and repeats it happily", "It is repeated only because the poet could not think of another rhyme", "It proves that it is raining heavily throughout the whole poem"],
            "The repetition frames the poem. At the start the rain seems unimportant, but the speaker's longing reveals it is not “only” rain.",
            3,
          ),
          q7.single(
            `Compare the two extracts.\n\nText A (Tennyson): ${"He clasps the crag with crooked hands; / Close to the sun in lonely lands,"}\n\nText B (Wordsworth): ${"I wandered lonely as a cloud / That floats on high o'er vales and hills,"}\n\nWhich comparison is most accurate?`,
            "A shows a fierce, watchful creature, whereas B shows a speaker drifting peacefully",
            ["Both are spoken by a first-person speaker who describes his feelings", "A is written in stanzas but B is written as one unbroken block", "Both extracts describe a busy city street and the people in it"],
            "Tennyson describes an eagle in the third person with strong verbs; Wordsworth uses first person and a gentle, floating simile.",
            3,
            { q: ["He clasps the crag with crooked hands;", "I wandered lonely as a cloud"] },
          ),
        ],
      },
      flashcards: cards([
        ["Stanza", "A group of lines in a poem, like a paragraph in prose."],
        ["Quatrain", "A four-line stanza."],
        ["Couplet", "Two rhyming lines, one after the other."],
        ["Rhyme scheme", "The pattern of end rhymes, shown with letters (abab, aabb)."],
        ["Simile", "A comparison using “like” or “as”."],
        ["Metaphor", "Describing something as if it IS something else."],
        ["Personification", "Giving human qualities to something non-human."],
        ["Alliteration", "Repeating the same consonant sound at the start of nearby words."],
        ["Onomatopoeia", "A word that sounds like the noise it describes."],
        ["Tone", "The speaker's attitude or mood in a poem (joyful, wistful, angry)."],
        ["Who wrote “The Eagle”?", "Alfred, Lord Tennyson."],
        ["Who wrote “I wandered lonely as a cloud”?", "William Wordsworth."],
      ]),
    },
    8: {
      year: 8,
      objectives: [
        "Read and analyse poems from different periods, including Romantic and First World War poetry.",
        "Explain the effect of rhythm, repetition, enjambment and caesura.",
        "Recognise sonnet form and explain how structure supports meaning.",
        "Analyse the effect of imagery, personification and sound devices.",
        "Compare poets' attitudes to a subject.",
      ],
      note: {
        title: "Year 8: rhythm, structure, imagery and attitude",
        body: `## What you need to know

At Year 8 you explain **how** a poet's choices of **structure**, **rhythm** and **language** create meaning.

| Term | Meaning |
| --- | --- |
| Rhythm / metre | The pattern of stressed and unstressed syllables |
| Enjambment | A sentence running over the end of a line without a pause |
| Caesura | A pause inside a line, often marked by punctuation |
| Sonnet | A 14-line poem; a Shakespearean sonnet has three quatrains and a final couplet |
| Volta | The turn in argument or mood in a poem |
| Sibilance | Repeated *s* sounds |
| Assonance | Repeated vowel sounds |
| Attitude | The poet's feelings towards the subject |

**Poets' attitudes** can differ even when the topic is the same: for example, two war poems may celebrate courage or expose suffering.

## Model analysis (PEEL)

Rudyard Kipling: *"If you can keep your head when all about you / Are losing theirs and blaming it on you,"*

- **Point:** The speaker gives calm, fatherly advice.
- **Evidence:** "If you can keep your head".
- **Explain:** The conditional "If" repeated through the poem builds a pattern of challenges, and the direct address "you" makes the advice personal.
- **Link:** The steady rhythm suggests self-control, matching the message.

**Tip:** For a sonnet, always ask: where does the argument *turn*, and why?`,
      },
      quiz: {
        title: "Poetry: Year 8 quiz",
        questions: [
          q8.single(
            `Read this stanza from “London” by William Blake.\n\n${LONDON}\n\nWhat is the rhyme scheme?`,
            "abab",
            ["aabb", "abba", "aaaa"],
            "“street” rhymes with “meet” and “flow” rhymes with “woe”, giving abab.",
            1,
            { q: ["I wander thro' each charter'd street,", "Marks of weakness, marks of woe."] },
          ),
          q8.multi(
            `Read this line from “London”.\n\nMarks of weakness, marks of woe.\n\nWhich TWO devices does it use?`,
            ["Repetition", "Alliteration"],
            ["Onomatopoeia", "Simile"],
            "“Marks of” is repeated, and “weakness” and “woe” share the w sound. There is no sound-word or comparison with “like”.",
            1,
            { q: ["Marks of weakness, marks of woe."] },
          ),
          q8.single(
            `Read the opening of “The Charge of the Light Brigade” by Tennyson.\n\n${CHARGE}\n\nWhat is the effect of the repetition and rhythm in “Half a league, half a league”?`,
            "They create a galloping beat, like horses advancing",
            ["They make the poem sound quiet and peaceful", "They show that the soldiers are lost", "They show that the speaker is confused"],
            "The rhythm falls in groups of one strong beat and two weak ones, giving a rolling, galloping feel. The repetition makes the advance feel relentless.",
            2,
            { d: true, q: ["Half a league, half a league,"] },
          ),
          q8.single(
            `Read these lines.\n\nAll in the valley of Death\nRode the six hundred.\n\nWhat does “the valley of Death” suggest about the soldiers' mission?`,
            "That they are riding towards almost certain death",
            ["That they are returning safely home", "That the valley is a peaceful holiday spot", "That they are going to a funeral"],
            "Naming the place “Death” (with a capital letter) makes the ground itself deadly. It signals extreme danger.",
            2,
            { q: ["All in the valley of Death", "Rode the six hundred."] },
          ),
          q8.single(
            `Read the opening of “Anthem for Doomed Youth” by Wilfred Owen.\n\n${ANTHEM}\n\nWhat does “die as cattle” suggest about the soldiers?`,
            "They are killed in large numbers, like animals, without dignity",
            ["They are proud farmers who are returning from a market", "They die peacefully in their sleep after a long, happy life", "They are protected by their leaders and kept far from danger"],
            "Cattle are herded and slaughtered. The simile suggests soldiers are treated as if their deaths do not matter.",
            2,
            { d: true, q: ["What passing-bells for these who die as cattle?"] },
          ),
          q8.multi(
            `Read these lines from Owen's poem.\n\nOnly the stuttering rifles' rapid rattle\nCan patter out their hasty orisons.\n\nWhich TWO techniques does Owen use?`,
            ["Onomatopoeic sounds such as “rattle” and “patter”", "Personification: the rifles “stutter”"],
            ["A simile using the word “like”", "A rhetorical question"],
            "“Rattle” and “patter” imitate gunfire, and “stuttering” gives the rifles a human speech problem. The lines contain no simile or question.",
            2,
            { q: ["Only the stuttering rifles' rapid rattle", "Can patter out their hasty orisons."] },
          ),
          q8.short(
            "How many lines does a sonnet have? (Write the number.)",
            "14",
            ["fourteen", "14 lines", "fourteen lines"],
            "Both Shakespearean and Petrarchan sonnets have 14 lines.",
            1,
          ),
          q8.single(
            `Read the opening of Shakespeare's Sonnet 18.\n\n${S18}\n\nWhat point do lines 3–4 make about summer?`,
            "Summer has faults: it can be windy and it ends too quickly",
            ["Summer is always perfect, so nothing can be compared to it", "Summer is colder than winter and lasts far too long", "Summer lasts longer than any other season in the year"],
            "“Rough winds” shake the buds and “all too short a date” means summer's lease ends soon. The speaker uses these faults to argue his beloved is better.",
            2,
            { q: ["Rough winds do shake the darling buds of May,", "And summer's lease hath all too short a date;"] },
          ),
          q8.multi(
            `Read the opening of “To Autumn” by John Keats.\n\nSeason of mists and mellow fruitfulness,\nClose bosom-friend of the maturing sun;\n\nWhich TWO techniques does Keats use?`,
            ["Personification: autumn is called a “friend” of the sun", "Alliteration of the “m” sound"],
            ["Onomatopoeia", "A rhetorical question"],
            "Autumn is addressed as a close friend, which is personification, and “mists and mellow” repeats the m sound.",
            3,
            { q: ["Season of mists and mellow fruitfulness,", "Close bosom-friend of the maturing sun;"] },
          ),
          q8.single(
            `Compare these extracts.\n\nExtract A (Tennyson): Half a league, half a league, / Half a league onward, / All in the valley of Death / Rode the six hundred.\n\nExtract B (Owen): What passing-bells for these who die as cattle? / Only the monstrous anger of the guns.\n\nWhich comparison is most accurate?`,
            "A suggests heroic, driving movement; B stresses suffering and lost dignity",
            ["Both poems celebrate war as a glorious adventure for the young", "A is about a voyage at sea and B is about life on a farm", "Both extracts are complete Shakespearean sonnets of fourteen lines"],
            "Tennyson's rhythm and repetition make the ride feel epic. Owen's language of cattle and monstrous guns exposes the horror.",
            3,
            { q: ["Half a league, half a league,", "What passing-bells for these who die as cattle?"] },
          ),
        ],
      },
      flashcards: cards([
        ["Enjambment", "A sentence or phrase running over the end of a line without a pause."],
        ["Caesura", "A pause in the middle of a line, often created by punctuation."],
        ["Sonnet", "A 14-line poem with a fixed structure."],
        ["Shakespearean sonnet structure", "Three quatrains and a concluding rhyming couplet."],
        ["Volta", "The “turn” in a poem's argument or mood."],
        ["Sibilance", "Repeated s or sh sounds."],
        ["Assonance", "Repeated vowel sounds in nearby words."],
        ["Rhythm (metre)", "The pattern of stressed and unstressed syllables in a line."],
        ["Who wrote “Anthem for Doomed Youth”?", "Wilfred Owen (First World War poet)."],
        ["Who wrote “The Charge of the Light Brigade”?", "Alfred, Lord Tennyson."],
        ["Who wrote “London” (about the city's misery)?", "William Blake."],
      ]),
    },
    9: {
      year: 9,
      objectives: [
        "Read and analyse poems of increasing complexity from the literary heritage.",
        "Analyse irony, paradox, extended metaphor and structure (volta).",
        "Explain the effect of tone and attitude.",
        "Compare the ideas, forms and methods of two poems.",
        "Write analytical paragraphs that link technique, effect and context.",
      ],
      note: {
        title: "Year 9: irony, paradox, structure and comparison",
        body: `## What you need to know

By Year 9 you read poems as **arguments** and explore how form, language and structure work together.

| Term | Meaning |
| --- | --- |
| Irony | A gap between what is said and what is meant or what happens |
| Paradox | A statement that seems contradictory but reveals a truth |
| Extended metaphor | A metaphor developed over several lines |
| Volta | A turn in argument or tone (especially in sonnets) |
| Apostrophe | Addressing a person or thing directly (*Death, thou...*) |
| Comparison | Linking two poems by theme, attitude, form and language |

**Form and meaning:** a poem with strict rhyme can suggest control, while breaking the pattern can suggest disruption.

**Context:** knowing when and why a poem was written (Romantic, Victorian, war) helps explain the poet's attitude.

## Model analysis (PEEL)

Coleridge: *"Water, water, every where, / Nor any drop to drink."*

- **Point:** The poet creates a sense of cruel irony.
- **Evidence:** "Water, water, every where".
- **Explain:** The repetition stresses how much water surrounds the sailors, while the next line reveals they cannot drink it, so abundance becomes torment.
- **Link:** The rhythm of the repeated word feels like the endless ocean.

**Tip:** In comparisons, use connectives (*whereas, similarly, in contrast*) and compare *methods*, not just topics.`,
      },
      quiz: {
        title: "Poetry: Year 9 quiz",
        questions: [
          q9.single(
            `Read these lines from “Ozymandias” by Percy Bysshe Shelley.\n\n${OZY}\n\nWho speaks the words “Look on my works, ye Mighty, and despair!”?`,
            "Ozymandias, in the words carved on the statue's base",
            ["The traveller who describes the statue", "The poet, speaking directly to readers", "The people who live in the desert"],
            "The line is part of the inscription: “My name is Ozymandias, King of Kings”. The poem is a story told through a traveller.",
            1,
            { q: ["My name is Ozymandias, King of Kings;", "Look on my works, ye Mighty, and despair!"] },
          ),
          q9.single(
            `Read the lines.\n\n${OZY}\n\nWhat is ironic about the king's command “Look on my works, ye Mighty, and despair!”?`,
            "His boast of lasting power is undercut by the ruined, empty desert",
            ["He asks people to despair even though he is a kind, friendly ruler", "He gives a command which all of his subjects gladly obey today", "He praises the desert for being a beautiful place for his statue"],
            "The king expects rivals to despair at his greatness, but “Nothing beside remains”. Time has destroyed his empire.",
            2,
            { d: true, q: ["Look on my works, ye Mighty, and despair!", "Nothing beside remains."] },
          ),
          q9.multi(
            `Read these lines.\n\nOf that colossal wreck, boundless and bare\nThe lone and level sands stretch far away.\n\nWhich TWO statements are accurate?`,
            ["“boundless and bare” uses alliteration", "The lines contrast a huge statue with an empty landscape"],
            ["The lines use onomatopoeia", "The lines address the reader directly"],
            "“boundless and bare” repeats the b sound, and “colossal” (huge) is set against “bare” sands stretching away.",
            2,
            { q: ["Of that colossal wreck, boundless and bare", "The lone and level sands stretch far away."] },
          ),
          q9.single(
            `Read the final line of John Donne's Holy Sonnet.\n\nDeath, thou shalt die.\n\nWhat technique is used?`,
            "Paradox",
            ["Simile", "Onomatopoeia", "Alliteration"],
            "A paradox seems impossible: how can Death die? The poet means that after death comes eternal life, so death is defeated.",
            3,
            { q: ["Death, thou shalt die."] },
          ),
          q9.single(
            `Read the lines by Emily Dickinson.\n\nHope is the thing with feathers\nThat perches in the soul,\n\nWhat is hope compared to?`,
            "A bird",
            ["A cloud", "A soldier", "A ship"],
            "“Feathers” and “perches” show that hope is presented as a bird living in the soul. This is a metaphor.",
            1,
            { q: ["Hope is the thing with feathers", "That perches in the soul,"] },
          ),
          q9.single(
            `Read the continuation.\n\nAnd sings the tune without the words\nAnd never stops at all,\n\nWhat does “sings the tune without the words” suggest about hope?`,
            "That hope is felt rather than explained, and it never gives up",
            ["That hope is only meant for musicians and other performing artists", "That hope is loud, irritating and hard to ignore for very long", "That hope disappears completely whenever the speaker falls silent"],
            "A tune without words is felt, not explained, and “never stops at all” shows hope keeps going.",
            2,
            { q: ["And sings the tune without the words", "And never stops at all,"] },
          ),
          q9.single(
            `Read these lines from “Composed upon Westminster Bridge” by William Wordsworth.\n\nEarth has not anything to show more fair:\nDull would he be of soul who could pass by\nA sight so touching in its majesty;\n\nWhat attitude does the speaker show?`,
            "Awe and admiration, believing anyone unmoved would be spiritually dull",
            ["Boredom with a familiar view that the speaker sees every day", "Anger at the noise and dirt of the crowded modern city below", "Fear of the large crowds of people who gather on the bridge"],
            "The speaker praises the sight above anything on Earth and suggests only a dull soul could ignore it.",
            2,
            { d: true, q: ["Earth has not anything to show more fair:", "Dull would he be of soul who could pass by", "A sight so touching in its majesty;"] },
          ),
          q9.single(
            `Read the lines from “The Tyger” by William Blake.\n\nWhat immortal hand or eye\nCould frame thy fearful symmetry?\n\nWhat is the effect of this rhetorical question?`,
            "It shows awe and unease at the power of the creature's maker",
            ["It shows the poet is asking a passer-by for directions to the forest", "It shows the poet is bored and cannot think of another question", "It proves that the tiger is a friendly and harmless animal"],
            "The question is not answered; it makes the speaker seem overwhelmed by wonder and fear. “Fearful” suggests both frightening and awe-inspiring.",
            2,
            { q: ["What immortal hand or eye", "Could frame thy fearful symmetry?"] },
          ),
          q9.single(
            "In poetry, what is a volta?",
            "A turn in the argument or mood, often in a sonnet",
            ["A repeated line at the end of every stanza", "A pause in the middle of a line", "A poem written to be sung"],
            "“Volta” is Italian for “turn”. It marks a shift such as from problem to solution or from praise to doubt.",
            1,
          ),
          q9.single(
            `Compare these poems.\n\nPoem A: “Ozymandias” includes the line “Nothing beside remains.”\nPoem B: “Composed upon Westminster Bridge” includes the line “Earth has not anything to show more fair”.\n\nWhich comparison is most accurate?`,
            "Both are sonnets; A shows the decay of power, B celebrates peaceful beauty",
            ["Both poems criticise the modern city as ugly, noisy and crowded", "A is about a voyage at sea, while B is about a mountain walk", "Both poems are light-hearted nonsense verses written for children"],
            "Ozymandias warns that great power is temporary. Wordsworth praises a city at dawn. Both are 14-line poems.",
            3,
            { q: ["Nothing beside remains.", "Earth has not anything to show more fair"] },
          ),
        ],
      },
      flashcards: cards([
        ["Irony", "A gap between what is expected or said and what actually happens or is meant."],
        ["Paradox", "A statement that seems to contradict itself but contains a truth (Death, thou shalt die)."],
        ["Extended metaphor", "A metaphor developed across several lines."],
        ["Volta", "The turn in a poem's argument or mood."],
        ["Apostrophe (device)", "Addressing an absent person or thing directly (Death, thou...)."],
        ["Who wrote “Ozymandias”?", "Percy Bysshe Shelley."],
        ["Who wrote “Hope is the thing with feathers”?", "Emily Dickinson."],
        ["Who wrote “The Tyger”?", "William Blake."],
        ["Who wrote “Composed upon Westminster Bridge”?", "William Wordsworth."],
        ["Comparing poems", "Compare ideas, attitudes and methods using connectives such as whereas and similarly."],
      ]),
    },
  },
};
