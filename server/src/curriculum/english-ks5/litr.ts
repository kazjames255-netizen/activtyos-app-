// A-level English Literature — Prose (Years 12–13). Original content aligned to the DfE GCE AS/A-level subject content for English Literature.
// Public-domain novels (Austen, Brontë, Dickens, Shelley, Hardy, Conrad, Woolf, Stoker, Wilde, Fitzgerald) quoted briefly; unseen extracts are ORIGINAL.
import type { CTopic } from "../types";
import { build, mu, sg, sh, wr } from "./_h";

export const TOPIC: CTopic = {
  key: "litr",
  topic: "English Literature — Prose",
  subject: "English",
  years: {
    12: {
      year: 12,
      objectives: [
        "Analyse narrative methods: first-person and third-person narration, free indirect discourse, framing, irony and retrospective voice.",
        "Explore how genre and structure (bildungsroman, Gothic, realism, serialisation) shape meaning.",
        "Consider the contexts of production and reception of nineteenth-century prose.",
        "Write a controlled analytical response with short accurate quotations, including on an unseen prose extract.",
      ],
      note: {
        title: "Year 12: narrative methods, genre and context in prose",
        body: `## Narrative methods

Ask: who tells the story, how much do they know, when do they tell it and why should we trust them?

| Term | Meaning |
| --- | --- |
| First-person narrator | 'I' tells the story; limited to what one person sees and understands |
| Omniscient narrator | Third-person narrator who knows characters' thoughts |
| Free indirect discourse | A character's thoughts blend into third-person narration without 'she thought' |
| Retrospective narration | An older narrator looks back on earlier events |
| Frame or nested narrative | A story told inside another story |
| Unreliable narrator | A narrator whose account may be biased or mistaken |
| Bildungsroman | A novel tracing a protagonist's growth |
| Irony | A gap between what is said and what is meant or known |

**Genre and context:** Gothic fiction explores fear, transgression and the supernatural; realist fiction presents everyday society. Many Victorian novels were published in **instalments**, which shaped their structure through cliffhangers and episodes. Social contexts such as class, gender, empire and industrial change matter when they help explain a text's choices.

## Model analytic paragraph

Data: *Mrs Dalloway said she would buy the flowers herself.* (Woolf's opening sentence)

"Woolf opens with reported speech in the third person, but the plain, confident statement blends Clarissa's viewpoint with the narrator's, an early sign of free indirect discourse. The reflexive pronoun 'herself' asserts independence and self-sufficiency, and the domestic subject matter promises a novel that finds significance in ordinary moments. The immediacy of the past tense without preamble plunges the reader into her consciousness."`,
      },
      quiz: {
        title: "Prose: Year 12 quiz",
        questions: build("litr", 12, [
          sg("Which term describes a novel that follows a protagonist's growth from youth to maturity?", "Bildungsroman", ["Epistolary novel", "Picaresque satire", "Gothic romance"], 0, "A bildungsroman (novel of formation) traces a protagonist's development, as in Great Expectations and Jane Eyre.", 1),
          sg("What is the effect of the opening of Pride and Prejudice: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.'?", "It is an ironic generalisation that gently mocks society's assumptions about marriage and money", ["It is a sincere moral law that the narrator endorses without irony, as a statement of fact about all society", "It is a line of dialogue spoken by Mr Darcy", "It is a first-person confession by Elizabeth"], 2, "The pompous, sweeping tone ('universally acknowledged') is undermined by the self-interested content, so the narrator's irony exposes the marriage market.", 1),
          sh("What is the term for a narrator whose account cannot be fully trusted?", "unreliable narrator", ["unreliable", "an unreliable narrator", "the unreliable narrator", "unreliable narration", "unreliable narrators", "unreliable narrator.", "an unreliable narrator."], "An unreliable narrator's bias, limited knowledge or self-deception invites readers to question their version of events.", 1),
          sg("What is the main effect of 'Reader, I married him.' in Jane Eyre?", "Direct address and a strong active verb assert Jane's agency in the retrospective first-person voice", ["It shifts the narrative into third person for a moment, so that Jane's marriage is reported by a detached narrator", "It shows that Jane has no choice", "It introduces a comic secondary narrator"], 3, "The address to the reader and 'I married him' (Jane is the subject) present marriage as her decision, reversing conventional expectations.", 2, true),
          sg("Wuthering Heights is narrated mainly through Lockwood and Nelly Dean. What is a likely effect of this nested structure?", "It creates layers of interpretation and partial viewpoints, so readers must weigh how far to trust each account", ["It guarantees a single objective truth, because a reliable narrator supervises and confirms every other account in the book", "It removes the need for dialogue", "It makes the story purely comic"], 1, "Each narrator filters events, so the reader questions their reliability and bias.", 2),
          sg("In Great Expectations an older Pip tells the story of his younger self. Which effect does this retrospective narration create?", "Two perspectives: the naive experiencing child and the wiser, sometimes ironic, adult narrator", ["A neutral third-person perspective in which the narrator never uses 'I' and knows nothing of the child's feelings", "A story told entirely as letters", "A narrator who knows nothing of later events"], 2, "The gap between what young Pip understood and what older Pip now knows produces irony and self-criticism.", 2, true),
          sg("Great Expectations was first published in weekly instalments in 1860–61. What is a likely effect on its structure?", "Chapters often end on suspense or revelation to keep readers returning", ["It had to be written as a single continuous scene", "It could not contain subplots or many characters, because each instalment had to follow a single scene", "It was written without a narrator"], 0, "Serial publication encouraged cliffhangers, episodic scenes and memorable images.", 2),
          mu("Which features describe the narrative structure of Frankenstein?", ["Multiple narrators (Walton, Victor and the Creature)", "Nested narratives with an outer frame of letters", "An opening in the form of letters", "A single omniscient narrator throughout", "A story taking place within a single day"], ["Multiple narrators (Walton, Victor and the Creature)", "Nested narratives with an outer frame of letters", "An opening in the form of letters"], "Walton's letters frame Victor's story, which in turn frames the Creature's account. No omniscient narrator controls the whole book.", 2),
          sg("In 'the President of the Immortals ... had ended his sport with Tess' (Hardy), what is suggested?", "Human lives are toyed with by a remote, indifferent or cruel fate", ["Tess has been fairly rewarded for her virtue by a just and benevolent higher power at last", "Justice has been done by a fair legal system", "Tess has escaped her destiny"], 3, "Hardy's image of a supreme power at 'sport' conveys fatalism and cosmic irony. The word 'Justice' in quotation marks is bitter.", 3),
          sg("Read this original extract.\n\n\"Mrs Alder considered the invitation for the third time. It was, of course, out of the question that she should go; and yet what was one to do when the Fairfaxes had called in person? Certainly the Fairfaxes were vulgar. But then their dinners were excellent.\"\n\nHow are the last two sentences best described?", "Free indirect discourse: Mrs Alder's self-justifying thoughts blend with the narrator's ironic tone", ["A first-person confession in which Mrs Alder tells the reader directly that she is a snob", "Objective third-person description of the invitation, with no evaluation of Mrs Alder or the Fairfaxes", "Direct speech that Mrs Alder addresses to the Fairfaxes when they call in person"], 1, "There is no 'she thought', but the judgemental tone and the abrupt 'But then' reveal her rationalisations, which the narrator gently mocks.", 3),
          sg("Chinua Achebe's essay 'An Image of Africa' criticises Heart of Darkness mainly because it:", "Presents Africa and Africans as a backdrop and as dehumanised, serving a European story", ["Praises the colonial administrators of the Congo Free State for bringing civilisation to the region", "Is written entirely in a Congolese dialect that European readers cannot follow", "Is not set in Africa"], 2, "Achebe argued that the novel reduces Africa to a setting for a European's psychological crisis and denies Africans humanity.", 3),
          sg("Read this original extract.\n\n\"The train was late, which was the sort of thing one noticed (Marian noticed) the way the platform seemed to lean towards the empty track, and someone's umbrella, dripping, and the memory (absurd) of her mother's gloves.\"\n\nWhich analysis is best?", "Stream of consciousness and free indirect discourse: parentheses and shifting associations mimic the flow and self-correction of thought", ["A neutral timetable report with no personal viewpoint, written by the railway company to explain why the train was late", "A traditional omniscient overview of the town's history and its railway, told in long, orderly sentences", "A dramatic monologue that Marian delivers aloud to a silent listener standing beside her on the platform"], 1, "The parenthetical asides, the accumulation of impressions and the sudden memory reflect a consciousness, a Modernist technique.", 3),
          wr("Charles Dickens, Great Expectations: \"My father's family name being Pirrip, and my christian name Philip, my infant tongue could make of both names nothing longer or more explicit than Pip.\" Analyse how Dickens establishes narrative voice in this sentence. (About 150 words.)", "Mark scheme (6): 2 marks for precise methods (first-person retrospective voice, long periodic sentence with the delayed 'Pip', formal register 'my infant tongue' with gentle humour, self-naming); 2 marks for effects (an older Pip looking back with irony at the child, the idea that identity and name are shaped by others and by childish limitation, sets up a bildungsroman); 1 mark for context (serial publication, Victorian autobiographical novel); 1 mark for controlled writing with short quotations. Do not credit plot summary.", 3),
        ]),
      },
      flashcards: [
        { front: "Bildungsroman", back: "A novel tracing a protagonist's growth from youth to maturity." },
        { front: "Free indirect discourse", back: "Third-person narration that blends into a character's thoughts without 'she thought'." },
        { front: "Retrospective narration", back: "An older narrator recounts earlier events, giving two perspectives: then and now." },
        { front: "Frame narrative", back: "A story within a story, as in Frankenstein and Wuthering Heights." },
        { front: "Unreliable narrator", back: "A narrator whose account is biased, limited or mistaken." },
        { front: "Serial publication", back: "Novels released in instalments, encouraging cliffhangers and episodic structure (Dickens)." },
        { front: "Jane Eyre, 'Reader, I married him.'", back: "Direct address and active verb signal Jane's agency in a retrospective first-person voice." },
        { front: "Hardy's fatalism", back: "Tess of the d'Urbervilles ends with the image of the President of the Immortals ending his sport with Tess." },
        { front: "Achebe on Conrad", back: "In 'An Image of Africa' he argues Heart of Darkness dehumanises Africans." },
        { front: "Woolf's opening to Mrs Dalloway", back: "'Mrs Dalloway said she would buy the flowers herself.' A Modernist novel set in one day with shifting consciousness." },
      ],
    },
    13: {
      year: 13,
      objectives: [
        "Analyse narrative time and reliability (analepsis, prolepsis, unreliable narration) across nineteenth- and early twentieth-century texts.",
        "Compare texts by genre and form: Gothic, epistolary, realist and Modernist fiction.",
        "Relate texts to their contexts (late-Victorian anxieties, aestheticism, empire, the First World War) and to critical readings.",
        "Construct a sustained comparative argument with well-chosen quotations.",
      ],
      note: {
        title: "Year 13: time, reliability, genre and comparison across prose texts",
        body: `## Advanced narrative concepts

| Term | Meaning |
| --- | --- |
| Analepsis | A flashback |
| Prolepsis | A flash-forward |
| Epistolary form | A story told through letters, diaries and documents |
| Stream of consciousness | A flow of thoughts and impressions |
| Realism | Detailed, plausible presentation of ordinary life |
| Modernism | Early twentieth-century experiment with time, viewpoint and form |
| Aestheticism | 'Art for art's sake' |
| Reverse colonisation | A late-Victorian fear of invasion of the centre from the margins |

**Comparison:** choose a controlling idea (ambition, class, gender, power, guilt). Compare **methods** (narrator, structure, genre) as well as themes, and use contexts only where they sharpen a point.

**Reliability:** ask what a narrator gains from telling it this way. A participant narrator may be selective; a frame narrator may filter another voice.

**Context and criticism:** late-Victorian Gothic reflects concerns about science, sexuality and empire; Modernism responds to a world altered by the First World War. Critics disagree, so treat readings as arguments to weigh.

## Model analytic paragraph

Data: Dickens, *Bleak House*: "Fog everywhere." and "Implacable November weather."

"Dickens opens with minor sentences, and the verbless 'Fog everywhere.' places the reader in an atmosphere before any character appears. The blunt, clipped rhythm makes the fog feel total, and the adjective 'Implacable' gives the weather a will that cannot be appeased, which prepares for a novel about a legal system that will not yield. The present-tense narration is detached and omniscient, so the fog acts as both setting and symbol of confusion."`,
      },
      quiz: {
        title: "Prose: Year 13 quiz",
        questions: build("litr", 13, [
          sg("What is analepsis?", "A flashback to earlier events", ["A flash-forward to later events", "A summary of a character's thoughts", "A change of narrator"], 0, "Analepsis interrupts the present narrative with past events; prolepsis jumps forward.", 1),
          sg("Which term describes a novel told through letters, diary entries and documents?", "Epistolary", ["Picaresque", "Pastoral", "Bildungsroman"], 3, "Epistolary fiction is made of letters and documents, which can create intimacy and multiple viewpoints.", 1),
          sh("What is the term for a narrator who knows all the characters' thoughts and events?", "omniscient", ["an omniscient narrator", "omniscient narrator", "the omniscient narrator", "omniscient.", "omniscient narration", "omniscience", "third-person omniscient", "third person omniscient", "third-person omniscient narrator", "third person omniscient narrator", "an omniscient third-person narrator", "omniscient third-person narrator"], "An omniscient narrator has unlimited knowledge, unlike a limited or participant narrator.", 1),
          sg("How does the final line of The Great Gatsby, 'So we beat on, boats against the current, borne back ceaselessly into the past', work?", "The plural 'we' widens the experience to everyone, and the nautical metaphor suggests a struggle that returns to the past", ["It suggests the narrator has escaped his past and moved forward, using 'we' to mean only himself and Gatsby, in a triumphant and confident ending", "It offers a literal description of a boat race", "It is a comic anecdote in dialogue"], 2, "The shift to 'we' generalises, while the metaphor of rowing against the current and being pushed back conveys futility and nostalgia.", 2, true),
          sg("Why can Nick Carraway be considered a potentially unreliable narrator?", "He claims to reserve judgement but is involved, admires Gatsby and shapes the reader's view", ["He is an omniscient narrator who knows every character's thoughts and so cannot make mistakes", "He never appears in the story himself and only reports what others have told him", "He tells the story as a series of letters to Gatsby that were never sent"], 1, "As a participant and observer, he is selective and partial despite claiming neutrality.", 2),
          sg("Wilde's preface to The Picture of Dorian Gray states: 'There is no such thing as a moral or an immoral book. Books are well written, or badly written. That is all.' This is most closely linked to:", "Aestheticism ('art for art's sake')", ["Realism", "Social protest fiction ('art with a purpose')", "Epistolary fiction"], 3, "Wilde claims art should be judged by style and beauty, not morality.", 2),
          sg("Dracula is told through journal entries, letters, newspaper cuttings and phonograph recordings. What is a likely effect?", "The patchwork of documents lends the supernatural events an air of authenticity while offering many viewpoints", ["It reveals the vampire's own private thoughts and motives throughout, so that the reader shares his point of view", "It removes any sense of suspense", "It turns the story into a comedy of manners"], 0, "Documentary form pretends to be evidence, making the improbable seem credible.", 2),
          mu("Which of these are Modernist techniques in Mrs Dalloway?", ["Stream of consciousness", "Free indirect discourse", "A single-day time frame that moves into memory", "A linear plot told by a moral omniscient narrator", "Chapters ending in cliffhangers for weekly serialisation"], ["Stream of consciousness", "Free indirect discourse", "A single-day time frame that moves into memory"], "Woolf explores consciousness and time, unlike the linear, instalment-driven structure of many Victorian novels.", 2),
          sg("In Heart of Darkness, Kurtz's last words are 'The horror! The horror!' Which reading is best?", "They are ambiguous: a judgement on his own conduct and perhaps on the colonial enterprise", ["They are a plain description of the storm that struck the steamer as it left the Inner Station", "They are a dying man's joke, meant to lighten the ending and reassure Marlow", "They clearly praise the Company's methods and confirm that Kurtz died a loyal agent"], 2, "The repeated phrase resists a single meaning, and Marlow calls it 'a moral victory' of a kind, which invites debate.", 2, true),
          sg("Read two original extracts.\n\nA: The mill stood at the river's bend, and around it the terraces crouched in rows, each door opening on to the same grey slope. Nobody in Coalpit Row would have said they were unhappy; they would have said there was work.\n\nB: Work (there was work) she said it to the window, or thought she said it, the bell going somewhere below, and Tom's boots, and the river doing what it always did, which was not to matter.\n\nWhich comparison is best supported?", "A uses a distanced omniscient narrator who generalises about a community, whereas B uses free indirect discourse and fragmented syntax to render one consciousness", ["A is a first-person confession by a mill worker, whereas B is an omniscient overview of the whole town told from a distance", "Both use an epistolary form, presenting the mill and the river through letters exchanged between the narrator and Tom", "A shows Modernist fragmentation in its broken clauses, whereas B is a realist survey of the community that generalises about everyone in Coalpit Row"], 1, "A's confident collective generalisation ('Nobody... would have said') is realist and omniscient; B's parentheses, repetitions and drifting attention represent thought.", 3),
          sg("Which contextual reading of Dracula is best supported by the text and period?", "The threat arrives from the East into London, reflecting late-Victorian anxieties about invasion and 'reverse colonisation'", ["It was written to celebrate the Romantic view of nature and the sublime, and has no interest in the fears and anxieties of its own period", "It reflects the trauma of the Second World War", "It is a satire on Restoration manners"], 3, "Published in 1897, its plot of a foreign count entering England is often read as reflecting fears about empire and foreignness, alongside anxieties about science and sexuality.", 3),
          mu("Which are valid points of comparison between Heart of Darkness and Frankenstein?", ["Both use nested or framed narration", "Both explore the consequences of unchecked ambition or pursuit of power", "Both were first published in the twentieth century", "Both are told by a single omniscient narrator", "Both are set entirely in one English town"], ["Both use nested or framed narration", "Both explore the consequences of unchecked ambition or pursuit of power"], "Marlow frames Kurtz's story as Walton frames Victor's. The novels were published in 1899/1902 and 1818, and neither is omniscient or set in one town.", 3),
          wr("Plan a comparative response to: 'Compare how two prose texts you have studied present ambition and its consequences.' Use Frankenstein and Heart of Darkness (or two texts of your choice). Give a thesis, three paragraph topics, and two short quotations you would analyse. (About 150 words.)", "Mark scheme (6): 2 marks for a clear, arguable thesis that compares (not lists); 2 marks for three integrated paragraph focuses combining method and theme (e.g. framed narration and reliability; setting and the natural or colonial world; the fate of the ambitious figure); 1 mark for two accurate short quotations, each with a technique and an effect; 1 mark for a contextual link that sharpens the argument (Romantic science and the Gothic for Frankenstein; empire and Modernist doubt for Conrad). Do not credit two separate summaries.", 3),
        ]),
      },
      flashcards: [
        { front: "Analepsis vs prolepsis", back: "Analepsis is a flashback; prolepsis is a flash-forward." },
        { front: "Epistolary form", back: "A narrative told through letters, diaries or documents, as in Dracula." },
        { front: "Stream of consciousness", back: "Narrative that imitates the flow of thoughts and impressions, typical of Woolf." },
        { front: "Aestheticism", back: "'Art for art's sake': art is judged by beauty and style, not morality (Wilde's preface)." },
        { front: "Nick Carraway", back: "Participant narrator of The Great Gatsby, who says he reserves judgement but shapes the reader's view." },
        { front: "Kurtz's last words", back: "'The horror! The horror!' in Heart of Darkness: an ambiguous judgement." },
        { front: "Reverse colonisation", back: "Late-Victorian fear that the colonised or foreign will invade the imperial centre, often linked to Dracula." },
        { front: "Mrs Dalloway", back: "Woolf's 1925 novel set in one day in London, moving between characters' consciousness and memory." },
        { front: "Realism vs Modernism", back: "Realism presents ordinary society in detail; Modernism experiments with time, viewpoint and fragmentation." },
        { front: "Comparing prose", back: "Compare methods (narrator, structure, genre) as well as themes, and use context to sharpen a point." },
      ],
    },
  },
};
