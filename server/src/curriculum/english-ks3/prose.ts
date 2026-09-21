// KS3 English — Prose & Literary Heritage (Years 7–9). Quotations from public-domain texts are SHORT and checked; other extracts are ORIGINAL.
// Aligned to the DfE KS3 English programme of study (OGL v3.0). Quotations are checked in _check_e3.ts.
import type { CTopic } from "../types";
import { qb, cards } from "./_b";

const q7 = qb("prose", 7), q8 = qb("prose", 8), q9 = qb("prose", 9);

export const TOPIC: CTopic = {
  key: "prose",
  topic: "Prose & Literary Heritage",
  subject: "English",
  years: {
    7: {
      year: 7,
      objectives: [
        "Read a range of high-quality prose from the English literary heritage, including 19th-century and early 20th-century writers.",
        "Understand narrative voice (first and third person) and how it shapes a story.",
        "Explain how setting and character are created through language.",
        "Recognise genres such as adventure, gothic and detective fiction.",
        "Identify simple themes and support ideas with short quotations.",
      ],
      note: {
        title: "Year 7: narrators, settings and characters in classic prose",
        body: `## What you need to know

Classic novels are often 100 or more years old, but their storytelling techniques are still used today.

| Term | Meaning |
| --- | --- |
| Narrator | The voice that tells the story |
| First person | Narrated by a character using *I* (limited to what they know) |
| Third person | Narrated from outside using *he / she / they* |
| Setting | Where and when the story takes place; it often creates mood |
| Genre | A type of story: adventure, gothic, detective, fantasy |
| Theme | A big idea running through a story: friendship, growing up, greed |
| Characterisation | How a writer builds a character (description, speech, actions) |

**Gothic** fiction features gloomy, isolated settings and mysterious or frightening events. **Adventure** fiction features journeys, danger and daring.

**Context:** many of these books were written in the **Victorian** period (1837–1901), when readers enjoyed long, detailed descriptions.

## Model analysis (PEEL)

Original extract: *"The lighthouse stood alone on the rock, white as a bone, and every night its beam swept the dark sea like a slow, patient hand."*

- **Point:** The writer creates a lonely, watchful setting.
- **Evidence:** "white as a bone".
- **Explain:** The simile suggests something pale and lifeless, while "like a slow, patient hand" personifies the beam so the lighthouse seems to be searching.
- **Link:** This sets a mood of mystery that could lead into a gothic or adventure story.`,
      },
      quiz: {
        title: "Prose & Literary Heritage: Year 7 quiz",
        questions: [
          q7.single(
            `Read the opening of A Christmas Carol by Charles Dickens.\n\nMarley was dead: to begin with.\n\nWhich character is described as dead in this first sentence?`,
            "Marley",
            ["Scrooge", "Bob Cratchit", "Tiny Tim"],
            "The novella begins by stating that Marley (Scrooge's former partner) was dead. It is a blunt, attention-grabbing opening.",
            1,
            { q: ["Marley was dead: to begin with."] },
          ),
          q7.single(
            `Dickens describes Scrooge like this.\n\nOh! But he was a tight-fisted hand at the grindstone, Scrooge!\n\nHard and sharp as flint, from which no steel had ever struck out generous fire; secret, and self-contained, and solitary as an oyster.\n\nWhat effect do the similes “hard and sharp as flint” and “solitary as an oyster” create?`,
            "They show that Scrooge is cold, unfriendly and closed off from others",
            ["They show that Scrooge is a generous, warm and welcoming man", "They show that Scrooge enjoys eating oysters and other seafood", "They show that Scrooge is a fashionable man about town"],
            "Flint is hard and sharp, and an oyster stays shut up in its shell. Together the images make Scrooge seem unfeeling and lonely.",
            2,
            { q: ["Oh! But he was a tight-fisted hand at the grindstone, Scrooge!", "Hard and sharp as flint, from which no steel had ever struck out generous fire; secret, and self-contained, and solitary as an oyster."] },
          ),
          q7.single(
            `Read the first sentence of The Secret Garden by Frances Hodgson Burnett.\n\nWhen Mary Lennox was sent to Misselthwaite Manor to live with her uncle everybody said she was the most disagreeable-looking child ever seen.\n\nFrom which viewpoint is this narrated?`,
            "Third person",
            ["First person", "Second person", "The viewpoint of Mary's uncle"],
            "The narrator calls her “Mary Lennox” and “she”, standing outside the story, so it is third person.",
            1,
            { q: ["When Mary Lennox was sent to Misselthwaite Manor to live with her uncle everybody said she was the most disagreeable-looking child ever seen."] },
          ),
          q7.single(
            `In Treasure Island by Robert Louis Stevenson, the narrator, Jim Hawkins, recalls:\n\nI remember him as if it were yesterday, as he came plodding to the inn door.\n\nWhat is the effect of the first-person narration and this memory?`,
            "It makes the story feel personal and vivid, as if a real witness is telling us",
            ["It makes the story seem like a news report by someone who was not there", "It shows that the narrator has forgotten the event", "It tells us that the narrator is an animal"],
            "A first-person narrator such as Jim shares what he saw, and “as if it were yesterday” makes the memory feel immediate and trustworthy.",
            2,
            { d: true, q: ["I remember him as if it were yesterday, as he came plodding to the inn door"] },
          ),
          q7.single(
            `Read this original extract.\n\nThe village of Thornby clung to the cliff like a barnacle. Its cottages leaned inward, shoulders hunched against the wind, and every window was shuttered, as if the place were holding its breath.\n\nWhat mood does the setting create?`,
            "Uneasy and secretive, as if something is about to happen",
            ["Cheerful and welcoming, like a village ready for a party", "Busy and noisy, as if a market were about to open", "Calm and sleepy, as if nothing ever happened there"],
            "The hunched cottages, shuttered windows and “holding its breath” make the village seem tense and watchful.",
            2,
          ),
          q7.single(
            `In The Wind in the Willows by Kenneth Grahame, the Water Rat tells Mole:\n\nThere is nothing—absolutely nothing—half so much worth doing as simply messing about in boats.\n\nWhat does this reveal about Rat's character?`,
            "He loves the river and finds happiness in simple pleasures",
            ["He is afraid of the water and wishes to stay on land", "He is ambitious and wants to become rich and famous", "He is bored with river life and hopes to travel abroad"],
            "Rat declares that boating is worth more than anything else, showing his deep contentment with the river.",
            2,
            { d: true, q: ["There is nothing—absolutely nothing—half so much worth doing as simply messing about in boats."] },
          ),
          q7.multi(
            "Which TWO are typical features of Gothic fiction?",
            ["Gloomy, isolated settings such as old houses or moors", "Mysterious or frightening events"],
            ["Talking animals in bright meadows", "Realistic accounts of everyday school life"],
            "Gothic stories build fear and mystery through dark settings and strange events. The other options belong to different genres.",
            2,
          ),
          q7.single(
            `The novel Peter Pan begins:\n\nAll children, except one, grow up.\n\nWhich theme does this sentence introduce?`,
            "Childhood and growing up",
            ["The dangers of ocean voyages", "Life in Victorian factories", "The joy of winning wars"],
            "The opening sentence sets up the story's interest in the boy who never grows up and in what it means to leave childhood behind.",
            1,
            { q: ["All children, except one, grow up."] },
          ),
          q7.single(
            `In Alice's Adventures in Wonderland by Lewis Carroll, we read:\n\n“Curiouser and curiouser!” cried Alice (she was so much surprised, that for the moment she quite forgot how to speak good English).\n\nWhy does the narrator add the bracketed comment?`,
            "It adds humour by showing Alice is so astonished she forgets her grammar",
            ["It corrects a spelling mistake that was made by the printer", "It shows that Alice normally speaks a different foreign language", "It shows that the narrator is angry with Alice for her mistakes"],
            "“Curiouser” is not correct grammar, so the narrator jokes that Alice has forgotten how to speak properly, which shows how surprised she is.",
            3,
            { q: ["“Curiouser and curiouser!” cried Alice (she was so much surprised, that for the moment she quite forgot how to speak good English)."] },
          ),
          q7.single(
            `Compare the two narrators.\n\nExtract A: When Mary Lennox was sent to Misselthwaite Manor to live with her uncle everybody said she was the most disagreeable-looking child ever seen.\n\nExtract B: I remember him as if it were yesterday, as he came plodding to the inn door.\n\nWhich statement is most accurate?`,
            "A reports what others thought, while B gives one character's own memory",
            ["Both narrators are characters who take part in the story's events", "A is written in the first person and B is written in the third", "Neither extract has a narrator, since both are lines of dialogue"],
            "In A an outside narrator reports opinions (“everybody said”). In B the narrator is a character, Jim, sharing his own memory.",
            3,
            { q: ["When Mary Lennox was sent to Misselthwaite Manor to live with her uncle everybody said she was the most disagreeable-looking child ever seen.", "I remember him as if it were yesterday, as he came plodding to the inn door."] },
          ),
        ],
      },
      flashcards: cards([
        ["Narrator", "The voice that tells a story."],
        ["First-person narration", "Told by a character using “I”, so we only know what they know."],
        ["Third-person narration", "Told from outside the story with “he”, “she” and “they”."],
        ["Setting", "The place and time of a story; it can create mood."],
        ["Genre", "A category of story such as adventure, gothic or detective."],
        ["Theme", "A big idea explored in a text (friendship, greed, growing up)."],
        ["Characterisation", "How a writer builds a character: description, speech, actions, others' opinions."],
        ["Gothic fiction", "Gloomy settings and mysterious, frightening events."],
        ["Victorian period", "The reign of Queen Victoria, 1837–1901."],
        ["Who wrote Treasure Island?", "Robert Louis Stevenson."],
        ["Who wrote A Christmas Carol?", "Charles Dickens."],
      ]),
    },
    8: {
      year: 8,
      objectives: [
        "Read and analyse 19th-century novels and short stories, including gothic, detective and science fiction.",
        "Analyse how writers create tone, mood and character through language and structure.",
        "Explain how context (Victorian society, science, poverty) shapes texts.",
        "Recognise irony and unreliable narrators.",
        "Use accurate quotations to support interpretation.",
      ],
      note: {
        title: "Year 8: voice, genre and Victorian context",
        body: `## What you need to know

Nineteenth-century writers often used their stories to **comment on society** as well as to entertain.

| Term | Meaning |
| --- | --- |
| Social criticism | A story that shows what is unfair in society |
| Irony | A gap between what is said and what is meant |
| Unreliable narrator | A narrator whose account cannot be fully trusted |
| Retrospective narrator | A narrator looking back on past events |
| Genre: detective | A crime is solved through observation and reasoning |
| Genre: science fiction | Stories about science, technology or other worlds |
| Foreshadowing | A hint of later events |

**Context:** Victorian Britain was industrial and unequal. Many writers, such as **Dickens**, wrote about poverty. Rapid scientific discoveries also inspired writers such as **H. G. Wells** and **Mary Shelley** to imagine the consequences of new ideas.

**Character** can be revealed by description, dialogue, actions and what other characters say.

## Model analysis (PEEL)

Original extract: *"Mr Penhallow smiled at everyone, and everyone, somehow, found their hands tightening on their purses."*

- **Point:** The writer hints that Mr Penhallow is not trustworthy.
- **Evidence:** "found their hands tightening on their purses".
- **Explain:** The smile seems friendly, but the reaction of the crowd suggests they sense danger, so the reader infers he cannot be trusted.
- **Link:** This is a typical way of showing character through the reactions of others.`,
      },
      quiz: {
        title: "Prose & Literary Heritage: Year 8 quiz",
        questions: [
          q8.single(
            `In Oliver Twist by Charles Dickens, hungry Oliver holds up his empty bowl to the workhouse master and asks:\n\nPlease, sir, I want some more.\n\nWhat does this moment show about Oliver's situation?`,
            "He is desperately hungry, and brave enough to ask for more",
            ["He is greedy and spoiled, and is used to getting his own way", "He is a rich boy who is playing a game with the other boys", "He is unsure of what he wants, so he asks for anything"],
            "The boys in the workhouse are not given enough food. Oliver's polite request shows both his hunger and his courage.",
            1,
            { q: ["Please, sir, I want some more."] },
          ),
          q8.single(
            "Which social issue did Dickens especially criticise in Oliver Twist?",
            "The treatment of the poor in Victorian workhouses",
            ["The rising cost of holidays at the seaside in Victorian Britain", "The dangers caused by the invention of the telephone", "The rules and unfairness of the game of cricket"],
            "The novel exposes the harsh workhouse system and the neglect of poor children.",
            1,
          ),
          q8.single(
            `In Dr Jekyll and Mr Hyde by Robert Louis Stevenson, the lawyer Mr Utterson is described as:\n\nlean, long, dusty, dreary and yet somehow lovable.\n\nWhat is the effect of the words “and yet somehow lovable”?`,
            "They surprise us after a list of negatives, hinting at a warmer character",
            ["They show that the narrator dislikes Utterson and finds him boring", "They show that Utterson is a criminal hiding from the law", "They show that Utterson is a fashionable young man about town"],
            "The description lists dull qualities and then turns with “and yet”, hinting that Utterson has hidden warmth.",
            2,
            { d: true, q: ["lean, long, dusty, dreary and yet somehow lovable."] },
          ),
          q8.single(
            `Also in Dr Jekyll and Mr Hyde, Mr Utterson is described as:\n\ncold, scanty and embarrassed in discourse; backward in sentiment.\n\nWhat impression does this give?`,
            "A reserved, emotionally restrained man who finds it hard to express himself",
            ["A passionate, talkative man who enjoys sharing his feelings with all", "A cruel and violent man who is feared by the people he meets", "A young and carefree man who has never had to work"],
            "“Embarrassed in discourse” and “backward in sentiment” suggest he is awkward in speech and reluctant to show feelings.",
            2,
            { q: ["cold, scanty and embarrassed in discourse; backward in sentiment."] },
          ),
          q8.single(
            `In A Scandal in Bohemia, Sherlock Holmes tells Dr Watson:\n\nYou see, but you do not observe.\n\nWhat does Holmes mean?`,
            "Watson looks at things but does not notice or think about the important details",
            ["Watson cannot see clearly because he has very poor eyesight", "Holmes wishes that he could see the world as Watson does", "Watson has hidden an important clue from Holmes on purpose"],
            "Holmes distinguishes between merely seeing and paying careful attention, which is the basis of his detective method.",
            2,
            { d: true, q: ["You see, but you do not observe."] },
          ),
          q8.single(
            "H. G. Wells's The War of the Worlds is an example of which genre?",
            "Science fiction",
            ["Historical romance", "A book of poems", "A pantomime"],
            "The novel imagines an invasion from Mars, using scientific ideas of its time, so it is science fiction.",
            1,
          ),
          q8.single(
            `The War of the Worlds begins:\n\nNo one would have believed in the last years of the nineteenth century that this world was being watched keenly and closely by intelligences greater than man's and yet as mortal as his own.\n\nWhat effect does the opening create?`,
            "A looking-back, ominous tone suggesting humans were unaware of danger",
            ["A cheerful tone that welcomes visitors from another world", "A comic tone that mocks the Martians for their appearance", "A neutral tone that reads like a daily weather report"],
            "“No one would have believed” looks back on events, and “watched keenly and closely” suggests threatening, unseen observers.",
            2,
            { q: ["No one would have believed in the last years of the nineteenth century that this world was being watched keenly and closely by intelligences greater than man's and yet as mortal as his own"] },
          ),
          q8.single(
            `In Edgar Allan Poe's The Tell-Tale Heart, the narrator says:\n\nwhy will you say that I am mad?\n\nHearken! and observe how healthily—how calmly I can tell you the whole story.\n\nWhat effect does this create?`,
            "The narrator protests too much, making us doubt he is sane and reliable",
            ["It proves that the narrator is completely calm and truthful", "It shows that the narrator is a police officer", "It shows that the story is a comedy"],
            "His repeated insistence on calm and sanity, combined with his obsessive tone, suggests the opposite. He is an unreliable narrator.",
            3,
            { q: ["why will you say that I am mad?", "Hearken! and observe how healthily—how calmly I can tell you the whole story."] },
          ),
          q8.single(
            `Pride and Prejudice by Jane Austen begins:\n\nIt is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.\n\nWhat is the tone of this sentence?`,
            "Ironic: it sounds like a universal fact but mocks society's assumptions",
            ["Serious and scientific, as if stating a proven law of nature", "Angry and violent, as if attacking wealthy men and marriage", "Sad and mournful, as if grieving over a lost opportunity"],
            "Austen states an opinion as if it were a proven truth, gently mocking the idea that wealthy men must marry. The exaggerated formality signals irony.",
            3,
            { q: ["It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife."] },
          ),
          q8.single(
            `Near the end of Jane Eyre by Charlotte Brontë, the narrator says:\n\nReader, I married him.\n\nWhat is the effect of this short sentence?`,
            "It addresses the reader and states a long-awaited outcome calmly",
            ["It shows that Jane is still unsure whether to marry Rochester", "It introduces a new character who has arrived at the house", "It reveals that Jane was forced into the marriage by others"],
            "The direct address to the reader and the short, plain sentence give a strong, confident close to Jane's story, as she takes control of her life.",
            2,
            { q: ["Reader, I married him."] },
          ),
        ],
      },
      flashcards: cards([
        ["Social criticism", "Writing that exposes unfairness or problems in society."],
        ["Irony", "A gap between what is said and what is meant, or between expectation and reality."],
        ["Unreliable narrator", "A narrator whose account cannot be fully trusted."],
        ["Retrospective narrator", "A narrator looking back on past events."],
        ["Detective fiction", "A crime is solved through observation and reasoning (Sherlock Holmes)."],
        ["Science fiction", "Stories exploring science, technology and other worlds (The War of the Worlds)."],
        ["Who wrote Oliver Twist?", "Charles Dickens."],
        ["Who wrote Jane Eyre?", "Charlotte Brontë."],
        ["Who wrote Pride and Prejudice?", "Jane Austen."],
        ["Who wrote The Tell-Tale Heart?", "Edgar Allan Poe."],
      ]),
    },
    9: {
      year: 9,
      objectives: [
        "Analyse how narrative structure and voice (framing narratives, retrospective narrators) shape meaning.",
        "Explore themes such as ambition, identity, class and injustice in 19th-century novels.",
        "Analyse how writers use symbolism, setting and language for effect.",
        "Explain how historical, social and literary context influences texts.",
        "Compare texts and write critical, well-evidenced interpretations.",
      ],
      note: {
        title: "Year 9: structure, symbolism and critical interpretation",
        body: `## What you need to know

By Year 9 you interpret novels as **crafted arguments** about people and society.

| Term | Meaning |
| --- | --- |
| Framing narrative | A story wrapped inside another (Frankenstein's letters, then Victor's tale) |
| Symbolism | An object, setting or image that represents an idea (fog for confusion) |
| Duality | The idea that people have two sides (good and evil) |
| Antithesis | Balanced contrast (hard on the outside, soft on the inside) |
| Foil | A character who contrasts with another |
| Social context | The class, law and beliefs of the society the writer lived in |

**Victorian anxieties** included **science and religion**, **poverty and class**, and **respectability**, which many novels question. The **Gothic** genre explores fear, guilt and the unknown.

**How to write about a novel:** combine **quotation + technique + effect + context**.

## Model analysis (PEEL)

Original extract: *"The grand house wore its respectability like a coat, buttoned to the chin, and behind its curtains nobody ever quite told the truth."*

- **Point:** The writer criticises Victorian hypocrisy.
- **Evidence:** "wore its respectability like a coat, buttoned to the chin".
- **Explain:** The simile suggests that respectability is a covering hiding something, and "buttoned" implies restraint and secrecy, while the ending exposes the dishonesty inside.
- **Link:** This reflects real Victorian concerns about appearances and morality.`,
      },
      quiz: {
        title: "Prose & Literary Heritage: Year 9 quiz",
        questions: [
          q9.single(
            `A Tale of Two Cities by Charles Dickens begins:\n\nIt was the best of times, it was the worst of times,\n\nWhich technique is at the heart of this line?`,
            "Antithesis",
            ["Onomatopoeia", "Simile", "Personification"],
            "Antithesis places opposites (“best” and “worst”) in parallel phrases to suggest a time of extremes and contradiction.",
            1,
            { q: ["It was the best of times, it was the worst of times,"] },
          ),
          q9.single(
            `Great Expectations is narrated by the adult Pip, looking back on his childhood.\n\n...my infant tongue could make of both names nothing longer or more explicit than Pip.\n\nWhat does this reveal about the narrative voice?`,
            "An adult narrator looks back with gentle humour on his childhood self",
            ["A young child narrator is writing his story as it happens", "A stranger who never met Pip is describing his childhood", "A newspaper reporter is recording the details of Pip's birth"],
            "The phrase “my infant tongue” shows the older Pip remembering how he chose his own name as a baby, with amusement.",
            2,
            { d: true, q: ["my infant tongue could make of both names nothing longer or more explicit than Pip."] },
          ),
          q9.single(
            `In Great Expectations, Pip is alone in the churchyard when he hears:\n\n“Hold your noise!” cried a terrible voice, as a man started up from among the graves at the side of the church porch.\n\nWhat effect does this sudden event create?`,
            "Shock and fear, as a threatening figure appears in a lonely graveyard",
            ["Peace and comfort, as a friendly stranger offers kind help", "Amusement, as a neighbour makes a friendly joke in church", "Boredom, as the child goes through his usual daily routine"],
            "The convict appears suddenly, “from among the graves”, and the harsh command makes the scene frightening for the child.",
            1,
            { q: ["“Hold your noise!” cried a terrible voice, as a man started up from among the graves at the side of the church porch."] },
          ),
          q9.single(
            `In Frankenstein by Mary Shelley, Victor describes the moment his creation comes to life:\n\nIt was on a dreary night of November that I beheld the accomplishment of my toils.\n\nWhat mood is created?`,
            "A gloomy, uneasy mood that clashes with the idea of triumph",
            ["A cheerful, celebratory mood, as if the experiment was a joy", "A comic mood, as if the narrator is telling a funny story", "A calm, peaceful mood, as if the night is a restful one"],
            "“Dreary night of November” sets a bleak atmosphere, hinting that his “accomplishment” will not bring joy.",
            2,
            { q: ["It was on a dreary night of November that I beheld the accomplishment of my toils."] },
          ),
          q9.multi(
            "Which TWO statements about the structure of Frankenstein are accurate?",
            ["It begins with letters written by Captain Robert Walton", "The creature tells part of the story in his own words"],
            ["It is narrated only by the creature", "It has no framing narrator"],
            "The novel is a framing narrative: Walton's letters contain Victor's story, which in turn contains the creature's account.",
            2,
          ),
          q9.single(
            `In Dr Jekyll and Mr Hyde, Jekyll writes:\n\nMan is not truly one, but truly two.\n\nWhat idea does this express?`,
            "That human nature has both good and evil sides",
            ["That everyone should have a twin", "That science has solved all problems", "That people are all identical"],
            "The statement expresses the theme of duality, a concern for Victorians who valued respectability but feared hidden desires.",
            2,
            { d: true, q: ["Man is not truly one, but truly two."] },
          ),
          q9.single(
            `In Jane Eyre, Jane tells Rochester:\n\nI am no bird; and no net ensnares me: I am a free human being with an independent will.\n\nWhat is the effect of the bird and net imagery?`,
            "It shows Jane refusing to be controlled and asserting her freedom",
            ["It shows that Jane secretly wishes she could become a bird", "It shows that Jane spends her spare time hunting for food", "It shows that Jane is afraid of birds and animal traps"],
            "By denying she is a caged bird, Jane insists on equality and free choice. The metaphor of the net presents control as entrapment.",
            3,
            { q: ["I am no bird; and no net ensnares me: I am a free human being with an independent will"] },
          ),
          q9.single(
            `Bleak House by Charles Dickens opens with:\n\nFog everywhere. Fog up the river, where it flows among green aits and meadows;\n\nWhat does the fog symbolise?`,
            "Confusion and obscurity, especially in the legal system",
            ["Sunny prosperity, as the whole country grows richer and happier", "The joy of a festival, as crowds gather in the streets", "A healthy climate, which is good for the people of London"],
            "The fog covers everything, symbolising the muddle and lack of clarity in the Court of Chancery and in society.",
            3,
            { q: ["Fog everywhere.", "Fog up the river, where it flows among green aits and meadows;"] },
          ),
          q9.single(
            "Which genre or genres are typically associated with Frankenstein?",
            "Gothic fiction and early science fiction",
            ["Comic verse and nursery rhymes for young children", "Historical romance set during the Middle Ages", "Travel journalism about a journey through Europe"],
            "The novel has a gothic mood and explores a scientific experiment, so it is often called an early science-fiction novel.",
            1,
          ),
          q9.single(
            `Conan Doyle's stories about Sherlock Holmes are narrated by Dr Watson. Holmes says:\n\nwhen you have eliminated the impossible, whatever remains, however improbable, must be the truth.\n\nWhy might Conan Doyle choose Watson as narrator?`,
            "An ordinary viewpoint makes Holmes's brilliance more surprising to the reader",
            ["Because Watson solves every crime and gives Holmes the credit", "Because Holmes cannot read or write, and so needs an assistant", "To make the stories read like a dry lecture in science"],
            "Watson does not always understand what Holmes has worked out, so his puzzlement creates suspense and shows how brilliant Holmes is.",
            2,
            { q: ["when you have eliminated the impossible, whatever remains, however improbable, must be the truth."] },
          ),
        ],
      },
      flashcards: cards([
        ["Framing narrative", "A story told within another story (Frankenstein)."],
        ["Symbolism", "Using an object, setting or image to represent an idea."],
        ["Duality", "The idea that a person or world has two opposing sides."],
        ["Antithesis (in prose)", "Balanced opposites, e.g. “the best of times, the worst of times”."],
        ["Foil", "A character who contrasts with another to highlight qualities."],
        ["Social context", "The class, laws and beliefs of the society in which a text was written."],
        ["Gothic fiction", "Dark, mysterious stories exploring fear, guilt and the unknown."],
        ["Who wrote Frankenstein?", "Mary Shelley."],
        ["Who wrote Great Expectations?", "Charles Dickens."],
        ["“Reader, I married him.”", "Jane Eyre, in Charlotte Brontë's novel."],
        ["Who narrates the Sherlock Holmes stories?", "Dr Watson."],
      ]),
    },
  },
};
