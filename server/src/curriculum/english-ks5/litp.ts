// A-level English Literature — Poetry (Years 12–13). Original content aligned to the DfE GCE AS/A-level subject content for English Literature.
// Public-domain poems quoted briefly; unseen poems are ORIGINAL. Structural checks: _check_e5.ts
import type { CTopic } from "../types";
import { build, mu, sg, sh, wr } from "./_h";

export const TOPIC: CTopic = {
  key: "litp",
  topic: "English Literature — Poetry",
  subject: "English",
  years: {
    12: {
      year: 12,
      objectives: [
        "Analyse form, structure and voice in poetry: sonnet, ode, dramatic monologue, stanza, enjambment, caesura, volta, persona and tone.",
        "Read Romantic and Victorian poetry in the light of literary and social contexts.",
        "Explore how meaning is shaped by imagery, rhythm, sound and irony, using precise terminology.",
        "Write critically about an unseen poem with a controlled thesis and short embedded quotations.",
      ],
      note: {
        title: "Year 12: form, structure and voice; Romantic and Victorian approaches",
        body: `## Reading a poem

Ask three questions: what **form** is it, how is it **structured**, and whose **voice** speaks?

| Term | Meaning |
| --- | --- |
| Sonnet | 14 lines; often a **volta** (turn) in argument or mood |
| Ode | A formal address to a person, object or idea |
| Dramatic monologue | A speaker addresses a silent listener and reveals more than they intend |
| Enjambment | A sentence runs over a line break |
| Caesura | A pause within a line |
| Iambic pentameter | Five feet of unstressed then stressed syllables |
| Blank verse | Unrhymed iambic pentameter |
| Persona | A speaker distinct from the poet |
| Tone | The speaker's attitude |

## Approaches

**Romantic** poets (for example Wordsworth and Coleridge, whose *Lyrical Ballads* appeared in 1798) value emotion, imagination, the individual and nature; the **sublime** describes awe mixed with fear. Many Romantic poems also react to revolution and industry.

**Victorian** poets face industrial change, religious doubt and social questions, and often use dramatic monologue (Browning, Tennyson).

Always link a technique to an **effect** and a **context**.

## Model analytic paragraph

Data: *He clasps the crag with crooked hands; / Close to the sun in lonely lands* (Tennyson, 'The Eagle').

"Tennyson personifies the eagle through the verb 'clasps' and the noun 'hands', giving the bird a human grasp that suggests control and mastery. The alliteration of hard c sounds in 'clasps', 'crag' and 'crooked' makes the line sound rugged, mirroring the rock. The sibilant and long vowels of 'Close to the sun in lonely lands' widen the scene, so the eagle seems both powerful and isolated, an image that suits the poem's celebration of solitary strength."`,
      },
      quiz: {
        title: "Poetry: Year 12 quiz",
        questions: build("litp", 12, [
          sg("Which form is Shelley's 'Ozymandias'?", "A sonnet", ["An ode", "A ballad", "A dramatic monologue"], 0, "'Ozymandias' has 14 lines, with a volta around the description of the inscription and the ruined scene.", 1),
          sg("What is enjambment?", "A sentence or phrase continuing over the end of a line without a pause", ["A pause in the middle of a line, usually marked by a comma or a full stop", "The repetition of a consonant sound at the start of neighbouring words", "A line that is exactly ten syllables long, with five stressed beats"], 2, "Enjambment carries the sense on over the line break; a pause within a line is a caesura.", 1),
          sg("What is blank verse?", "Unrhymed iambic pentameter", ["Rhyming couplets in iambic tetrameter", "Poetry with no fixed rhythm at all", "A fourteen-line rhyming form"], 1, "Blank verse has a regular metre (iambic pentameter) but no end rhyme.", 1),
          sh("What is the term for a pause within a line of verse, often marked by punctuation?", "caesura", ["a caesura", "medial caesura", "caesurae", "caesuras", "cesura", "caesura.", "a caesura."], "A caesura breaks the line and can slow the pace or add emphasis.", 2),
          sg("Which Romantic idea is most clearly shown in 'A poet could not but be gay, / In such a jocund company' (Wordsworth)?", "Nature can inspire joy and imaginative feeling in the individual poet", ["A protest against industrial poverty and the exploitation of factory workers in the growing towns of the period", "Religious doubt about the afterlife", "The horror of modern warfare"], 3, "Wordsworth celebrates the emotional uplift he receives from nature, a central Romantic idea.", 2, true),
          sg("Blake's phrase 'mind-forg'd manacles' in 'London' most strongly suggests:", "People are trapped by attitudes and institutions they have internalised", ["Physical prisons and debtors' jails are common in London and the poem describes them literally throughout", "The speaker enjoys the city", "The River Thames has frozen"], 0, "The metaphor joins the mind (which makes the chains) to manacles (which imprison), suggesting mental oppression.", 2),
          sg("What effect does the dramatic monologue form have in Browning's 'My Last Duchess'?", "The speaker unintentionally reveals his own controlling character, so the reader reads against him", ["It presents the poet's own personal opinions directly to the reader, with the speaker acting as the poet's voice", "It offers an objective account of the Duchess's life", "It makes the poem a lyric celebration of beauty"], 1, "The Duke thinks he is displaying his art; the reader sees dramatic irony, since his words expose his jealousy and control.", 2),
          sg("In 'Ozymandias' the inscription 'Look on my Works, ye Mighty, and despair!' is placed beside a ruined statue. This creates:", "Irony, because the boast of power is undercut by the ruin around it", ["Pathos, because the king was loved by his people and is now mourned by the traveller", "Onomatopoeia, because the words imitate sounds", "Praise for the sculptor's skill alone"], 2, "The King's confident command is contradicted by the wreck and empty desert, ironically showing that power fades.", 2, true),
          sg("Which best describes Hopkins's 'sprung rhythm'?", "A rhythm based on counting stressed syllables, allowing the number of unstressed syllables to vary", ["A regular pattern of exactly ten syllables per line, with an unstressed then a stressed beat in each of five feet", "A rhythm with no stresses at all", "A rhythm that only appears in ballads"], 3, "Hopkins measured a line by its stresses, letting slack syllables vary to imitate speech.", 2),
          mu("Which of these are features of Keats's 'To Autumn'?", ["Address to a personified season", "Sensuous imagery drawn from several senses", "Three stanzas that move through ripening, harvest and the season's end", "A single fourteen-line sonnet form", "A dramatic monologue with a silent listener"], ["Address to a personified season", "Sensuous imagery drawn from several senses", "Three stanzas that move through ripening, harvest and the season's end"], "The poem is an ode in three stanzas of eleven lines. It is neither a sonnet nor a dramatic monologue.", 2),
          sg("In Hardy's 'Neutral Tones' the sun is described as 'white, as though chidden of God'. What is the most convincing reading?", "The simile presents a bleached, joyless sun, as if nature itself were punished, which mirrors the dead relationship", ["It shows a warm, nostalgic memory of a happy afternoon by a pond, with the sun blessed and approved by God as a sign of happiness in the relationship", "It celebrates religious faith", "It suggests the pond is crowded with people"], 1, "'Chidden' means scolded, so the sun seems reproved and colourless. That fits the poem's cold, disillusioned mood.", 3),
          sg("Read this original poem.\n\nThe gas-lamps stammer down the rain-black street;\nOne clerk walks home, his hunger in his stride.\nThe bells of commerce chime the hour complete,\nAnd every hour he sells leaves him outside.\n\nWhich reading is best supported?", "It criticises urban poverty and the clerk's insecurity: 'stammer' and 'hunger' show precarity, and 'bells of commerce' suggest his time is owned by others", ["It celebrates the peace of a country walk in which the clerk finds relief from his labour and the quiet countryside restores both his spirits and his hope for the future", "It is a war poem about a soldier returning home", "It praises the city's prosperity and the clerk's success"], 2, "'Stammer' and 'hunger' present hardship; the 'hour he sells' and being 'outside' suggest exclusion from the wealth around him. The setting is urban, not rural.", 3),
          mu("Using the same original poem (\"The gas-lamps stammer down the rain-black street; / One clerk walks home, his hunger in his stride. / The bells of commerce chime the hour complete, / And every hour he sells leaves him outside.\"), which statements are accurate?", ["The rhyme scheme is ABAB", "The lines are mostly regular iambic pentameter", "'Stammer' personifies the lamps", "It is a fourteen-line sonnet", "It relies heavily on enjambment"], ["The rhyme scheme is ABAB", "The lines are mostly regular iambic pentameter", "'Stammer' personifies the lamps"], "Street/complete and stride/outside give ABAB; each line has ten syllables in a rising rhythm; lamps cannot literally stammer. It is only four lines and each line is end-stopped.", 3),
          wr("Shelley, 'Ozymandias': \"And on the pedestal, these words appear: / My name is Ozymandias, King of Kings; / Look on my Works, ye Mighty, and despair!\" Write an analytical paragraph on how Shelley presents power in these lines and in the poem as a whole. (About 150 words.)", "Mark scheme (6): 2 marks for precise technique (the inscription as direct speech, the capitalised 'Works' and 'Mighty', imperative 'Look', the irony of 'despair', the sonnet form and volta, the ruined 'colossal Wreck'); 2 marks for interpretation of how power is presented as arrogant and impermanent, with irony and contrast of boast against decay; 1 mark for context (Romantic interest in the sublime, ruins and political power, revolutionary era); 1 mark for controlled, quotation-based writing. Do not credit a plot summary.", 3),
        ]),
      },
      flashcards: [
        { front: "Volta", back: "The 'turn' in a sonnet, where the argument, mood or perspective shifts." },
        { front: "Enjambment vs caesura", back: "Enjambment carries the sense over a line break; caesura is a pause inside a line." },
        { front: "Iambic pentameter", back: "A line of five iambs (unstressed then stressed): ten syllables in a rising rhythm." },
        { front: "Dramatic monologue", back: "A persona speaks to a silent listener and reveals more than intended, giving dramatic irony." },
        { front: "The sublime", back: "In Romantic writing, awe mixed with fear before vast or powerful nature." },
        { front: "Lyrical Ballads", back: "Collection by Wordsworth and Coleridge (1798), often seen as launching English Romanticism." },
        { front: "Ode", back: "A formal, often celebratory address to a subject, as in Keats's 'To Autumn'." },
        { front: "Sprung rhythm", back: "Hopkins's system: count the stresses in a line, with a variable number of unstressed syllables." },
        { front: "Persona", back: "The speaker of a poem, not to be assumed identical to the poet." },
        { front: "Analysis pattern", back: "Technique, short quotation, effect on meaning, then context." },
      ],
    },
    13: {
      year: 13,
      objectives: [
        "Compare poems by form, structure, voice and theme using integrated comparison.",
        "Explore modern poetry (Edwardian, First World War and Modernist) and its contexts.",
        "Apply critical concepts such as negative capability and the sublime to poems.",
        "Write a sustained comparative response, including on unseen poems.",
      ],
      note: {
        title: "Year 13: comparison, contexts and modern voices",
        body: `## Comparing poems

**Integrate** your comparison: build each paragraph around one idea and move between poems using connectives ('whereas', 'similarly', 'in contrast'). Do not write one poem then the other.

Compare on:
- **Ideas and themes** (loss, war, nature, power)
- **Voice and tone** (speaker, addressee, attitude)
- **Form and structure** (rhyme, rhythm, stanza, volta, free verse)
- **Language and imagery**
- **Context** (when and why it was written)

| Concept | Meaning |
| --- | --- |
| Modernism | Early twentieth-century writing that breaks with tradition: fragmentation, allusion, free verse |
| Pathos | Feeling of pity or sadness |
| Ekphrasis | Poetry that describes a work of art |
| Negative capability | Keats: being in uncertainty without reaching for certainty |
| Free verse | No fixed rhyme or metre |

Contexts matter, but bring them in only when they help the interpretation: for example, poems written in or after the First World War often question earlier patriotic or ordered visions.

## Model analytic comparison

Data: Blake, *I wander thro' each charter'd street*; Hardy, *I leant upon a coppice gate / When Frost was spectre-gray*.

"Both poems open with a solitary observer in a bleak setting, but locate the bleakness differently. Blake's 'charter'd' suggests that even the streets are commercially owned, so the misery is social, and his repeated 'each' makes the speaker's survey feel relentless. Hardy's 'spectre-gray' personifies frost as a ghost, so the desolation is elemental and elegiac, matching the death of a century. Whereas Blake sounds like an accuser, Hardy's relaxed posture, 'I leant', suggests a reflective witness."`,
      },
      quiz: {
        title: "Poetry: Year 13 quiz",
        questions: build("litp", 13, [
          sg("What is a volta?", "A turn in argument, tone or perspective, most often in a sonnet", ["A line or phrase that repeats at the end of every stanza to create a refrain or chorus effect", "A rhyme between the middle and end of a line", "A stanza of four lines"], 1, "Volta is Italian for 'turn': the poem shifts direction, often after the octave in a Petrarchan sonnet.", 1),
          sg("Which poem contains the line 'Things fall apart; the centre cannot hold'?", "Yeats, 'The Second Coming'", ["Yeats, 'Sailing to Byzantium'", "Shelley, 'Ozymandias'", "Edward Thomas, 'Adlestrop'"], 0, "The line is from Yeats's 'The Second Coming', which is often linked to the turmoil after the First World War.", 1),
          sh("What is the term for the speaker of a poem when they are a created voice, not the poet?", "persona", ["the persona", "speaker", "voice", "a persona", "persona.", "the speaker", "a speaker", "the voice", "a voice", "poetic persona", "the poetic persona", "poetic voice", "lyric speaker"], "A persona is a constructed speaker, so you should analyse 'the speaker' rather than assume 'the poet feels'.", 1),
          sg("How does the simile 'Bent double, like old beggars under sacks' (Owen, 'Dulce et Decorum Est') work?", "It makes young soldiers look aged and worn, undercutting a glorious image of war", ["It presents the soldiers as generous, cheerful men carrying gifts home to their families after a victory", "It suggests that the soldiers are enjoying the march", "It shows that the soldiers are wealthy"], 2, "Comparing soldiers to beggars and hags removes glamour and shows exhaustion, reinforcing the poem's anti-war message.", 2, true),
          sg("In Owen's poem the Latin line 'Dulce et decorum est / Pro patria mori' is called:", "The old Lie", ["A noble truth", "A sacred prayer", "A soldier's joke"], 3, "Owen names the patriotic slogan 'the old Lie', signalling his challenge to the idea that dying for one's country is sweet and fitting.", 2),
          sg("Edward Thomas's 'Adlestrop' begins: 'Yes. I remember Adlestrop—'. What is the effect?", "A conversational tone that sounds like a reply, suggesting the poem is a memory being recalled", ["A formal, ceremonial proclamation delivered to an audience, in the manner of a public announcement or speech", "A shout of anger", "A traditional ballad formula"], 1, "The one-word answer 'Yes.' and the dash imply speech mid-conversation, so the memory feels casual and intimate.", 2),
          sg("In Dickinson's 'Because I could not stop for Death –  / He kindly stopped for me –' the effect of personifying Death as a courteous driver is:", "A calm, polite tone that makes death seem unthreatening yet quietly unsettling", ["A violent and terrifying attack by a frightening figure, which makes the poem a horror story from the start", "A comic disguise for a joke", "A description of a real carriage business"], 0, "Death is a gentleman who offers a ride; the politeness contrasts with the finality of the subject.", 2),
          sg("Which is the strongest comparative approach?", "Integrate points, moving between poems within each paragraph using connectives", ["Analyse the first poem fully, then the second", "List every technique in each poem in turn, giving equal space to both without connecting the ideas", "Compare only the poets' biographies"], 2, "Integrated comparison shows how ideas and methods relate; separating the poems produces two essays.", 2, true),
          sg("Which is a typical feature of Modernist poetry?", "Fragmentation and a break from regular rhyme and traditional form", ["Strict regular quatrains celebrating nature and traditional order, in a confident and unbroken rhyme scheme", "Direct moralising in couplets", "Imitation of medieval romance"], 3, "Modernist poets often used fragments, allusions and free verse to reflect a disordered modern world.", 2),
          mu("Which of these pairings of poem and context are accurate?", ["Owen: written from experience of the First World War", "Yeats's 'The Second Coming': written in the aftermath of the First World War", "Hardy's 'The Darkling Thrush': dated 31 December 1900, at the turn of the century", "Shelley's 'Ozymandias': written during the Second World War", "Blake's 'London': written in the Victorian period"], ["Owen: written from experience of the First World War", "Yeats's 'The Second Coming': written in the aftermath of the First World War", "Hardy's 'The Darkling Thrush': dated 31 December 1900, at the turn of the century"], "Shelley's poem is from the Romantic period (published 1818) and Blake's 'London' is from 1794, both well before the Victorian and modern periods.", 3),
          sg("Read two original poems on leaving a home.\n\nPoem A: The house is sold. The garden gate still swings / on hinges that I oiled the summer through. / I leave the roses to their rusting rings / of thorn, and hand the keys to someone new.\n\nPoem B: I keep / the smell of the porch / (cut grass, warm rain) / as if a room / could be folded / small enough / for a coat pocket.\n\nWhich comparative point is best supported?", "Both explore leaving a home, but A's regular rhyme and complete, controlled sentences suggest measured acceptance, whereas B's short, enjambed free verse suggests memory as fragile and portable", ["A uses loose free verse with no rhyme, whereas B is a tightly rhymed sonnet, so A feels casual about the move and B feels formal and grieving", "Neither poem is really about memory or place; both are about the money raised by the sale, which is why A mentions the keys and B mentions a coat pocket", "Both poems use the same ABAB rhyme scheme and long, complete sentences to show the speakers' anger at being forced to sell, so they are alike in form and feeling"], 1, "A rhymes ABAB and closes each thought with a full stop; B has no rhyme and breaks the syntax across short lines, matching the idea of a room folded away.", 3),
          sg("Keats described 'negative capability' as being able to remain in uncertainties without irritable reaching after fact and reason. Which reading of a poem uses this idea?", "The poem holds contradictory feelings together without resolving them", ["The poem ends with a clear moral lesson that resolves every doubt raised earlier", "The poem is a list of verifiable facts presented with scientific certainty", "The poem rejects imagination in favour of reason and settled answers"], 0, "Negative capability values the ability to sustain ambiguity, so a poem that leaves tensions open is a strong example.", 3),
          wr("Compare how the poets present crisis in these two extracts. Owen: \"Bent double, like old beggars under sacks, / Knock-kneed, coughing like hags, we cursed through sludge, / Till on the haunting flares we turned our backs / And towards our distant rest began to trudge.\" Yeats: \"Turning and turning in the widening gyre / The falcon cannot hear the falconer; / Things fall apart; the centre cannot hold; / Mere anarchy is loosed upon the world,\" (About 200 words.)", "Mark scheme (6): 2 marks for integrated comparison of methods (Owen's similes, caesura and physical verbs 'cursed', 'trudge' versus Yeats's spiralling image 'Turning and turning', abstract nouns 'anarchy', the collapse of the falcon and falconer); 2 marks for interpretation (personal, physical suffering against a cosmic, political breakdown); 1 mark for context handled lightly (war experience; post-war upheaval); 1 mark for structured, quotation-based comparison. Do not credit separate summaries of each poem.", 3),
        ]),
      },
      flashcards: [
        { front: "Integrated comparison", back: "Each paragraph builds around one idea and moves between the poems using connectives." },
        { front: "Modernism", back: "Early twentieth-century movement using fragmentation, allusion and free verse to reflect a disordered modern world." },
        { front: "Negative capability", back: "Keats: the ability to stay in uncertainty and doubt without reaching for certainty." },
        { front: "Free verse", back: "Poetry without fixed rhyme or metre; the line breaks shape meaning." },
        { front: "Ekphrasis", back: "Poetry that describes and responds to a work of art." },
        { front: "Owen and context", back: "Wilfred Owen wrote from experience of the First World War, challenging patriotic myths." },
        { front: "Yeats, 'The Second Coming'", back: "Poem of disintegration linked to the turmoil after the First World War; 'Things fall apart; the centre cannot hold'." },
        { front: "Hardy, 'The Darkling Thrush'", back: "Dated 31 December 1900; a bleak winter landscape at the turn of the century with a note of faint hope." },
        { front: "Pathos", back: "A quality that evokes pity or sadness." },
        { front: "Comparing structure", back: "Look at rhyme, stanza, volta, line length, enjambment and how they enact meaning in each poem." },
      ],
    },
  },
};
