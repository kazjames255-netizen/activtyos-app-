// KS3 English — Vocabulary (Years 7–9). Original content aligned to the DfE KS3 English programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_b";

const q7 = qb("vocab", 7), q8 = qb("vocab", 8), q9 = qb("vocab", 9);

export const TOPIC: CTopic = {
  key: "vocab",
  topic: "Vocabulary",
  subject: "English",
  years: {
    7: {
      year: 7,
      objectives: [
        "Extend vocabulary by studying etymology and the roots, prefixes and suffixes of words.",
        "Use context to work out the meaning of unfamiliar words.",
        "Understand denotation (literal meaning) and connotation (associated feeling).",
        "Recognise and name basic figurative and sound devices.",
        "Choose ambitious, precise vocabulary in writing.",
      ],
      note: {
        title: "Year 7: word roots, meaning in context and figurative language",
        body: `## What you need to know

Many English words are built from **roots**, **prefixes** (added to the front) and **suffixes** (added to the end). Knowing the parts helps you work out new words.

| Part | Origin | Meaning | Examples |
| --- | --- | --- | --- |
| tri- | Latin | three | tricycle, triplet |
| auto- | Greek | self | automatic, autobiography |
| graph | Greek | write | photograph, paragraph |
| port | Latin | carry | portable, porter |
| spect | Latin | look | inspect, spectator |
| un-, im-, in- | Old English / Latin | not | unfair, impatient |

**Denotation** is a word's dictionary meaning; **connotation** is the feeling attached to it. *Slim* and *skinny* both mean thin, but *skinny* can sound unkind.

## Figurative language

- **Simile:** compares using *like* or *as*. **Metaphor:** says one thing *is* another.
- **Personification:** human qualities given to non-human things.
- **Onomatopoeia:** a word that sounds like its meaning (*crackle*).

## Worked example (context)

*The explorers were **parched**; they had not found water for two days.* The clue "not found water" tells us **parched** means very dry or thirsty.

**Tip:** Say the sentence with the unknown word blanked out. What word would make sense?

## Model analysis (PEEL)

Sentence: *"The stream chuckled over the stones."*

- **Point:** The writer makes the stream seem cheerful.
- **Evidence:** "chuckled".
- **Explain:** "Chuckled" is both onomatopoeic (it sounds like a gentle bubbling) and personification, giving the water a human laugh.
- **Link:** This creates a friendly, playful mood in the setting.`,
      },
      quiz: {
        title: "Vocabulary: Year 7 quiz",
        questions: [
          q7.single(
            "The prefix “bi-” appears in “bicycle” and “bilingual”. What does “bi-” mean?",
            "two",
            ["one", "three", "half"],
            "“Bi-” comes from Latin and means two: a bicycle has two wheels and someone bilingual speaks two languages.",
            1,
          ),
          q7.single(
            "Which word is closest in meaning to the OPPOSITE of “generous”?",
            "miserly",
            ["charitable", "courteous", "wealthy"],
            "A generous person gives freely; a miserly person hates spending or giving. “Charitable” is a synonym, not an antonym.",
            1,
          ),
          q7.single(
            "The Greek root “graph” means “write”. Which word contains it?",
            "autograph",
            ["garden", "triangle", "porridge"],
            "An autograph is a person's own (auto = self) writing (graph). The other words only look similar.",
            2,
            { d: true },
          ),
          q7.single(
            "Which sentence contains a metaphor?",
            "The classroom was a zoo.",
            ["The classroom was as noisy as a zoo.", "The classroom was very noisy.", "The classroom was noisy, so we left."],
            "A metaphor says one thing IS another without using “like” or “as”. The second option is a simile.",
            1,
          ),
          q7.single(
            "A woman never spends money, even on gifts. Which word describing her has the most negative connotation?",
            "stingy",
            ["thrifty", "careful", "economical"],
            "All four mean “careful with money”, but “stingy” suggests meanness, so its connotation is negative.",
            2,
            { d: true },
          ),
          q7.single(
            "Read the sentence.\n\nThe teacher's explanation was lucid, so everyone understood the task.\n\nWhat does “lucid” mean?",
            "Clear and easy to understand",
            ["Long and complicated", "Loud and confident", "Dull and repetitive"],
            "The clue is “so everyone understood the task”. A good explanation that everyone follows is clear.",
            2,
          ),
          q7.short(
            "What is the term for a word that imitates the sound it describes, such as “sizzle” or “thud”?",
            "onomatopoeia",
            ["an onomatopoeia"],
            "Onomatopoeic words sound like what they mean. The word can be remembered as “name-making”.",
            2,
          ),
          q7.multi(
            "Which TWO days of the week are named after Anglo-Saxon or Norse gods (not the sun or the moon)?",
            ["Wednesday", "Thursday"],
            ["Monday", "Sunday"],
            "Wednesday comes from Woden's day and Thursday from Thor's day. Monday is “moon's day” and Sunday is “sun's day”.",
            3,
          ),
          q7.multi(
            "Which TWO words contain a prefix meaning “not”?",
            ["unhappy", "impossible"],
            ["reheat", "preview"],
            "“Un-” and “im-” both mean not. “Re-” means again and “pre-” means before.",
            2,
          ),
          q7.single(
            "Which pair of words have a similar denotation but different connotations?",
            "curious / nosy",
            ["hot / freezing", "quick / speedy", "cheerful / gloomy"],
            "“Curious” and “nosy” both describe wanting to find things out, but one is admiring and the other insulting. The other pairs are opposites or have the same feeling.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["Prefix", "A group of letters added to the start of a word to change its meaning (un-, re-, pre-)."],
        ["Suffix", "A group of letters added to the end of a word (-ful, -ness, -ment)."],
        ["Root word", "The core part of a word that carries its main meaning."],
        ["Etymology", "The study of where words come from and how their meanings have developed."],
        ["Denotation", "The literal, dictionary meaning of a word."],
        ["Connotation", "The feelings or associations a word carries beyond its literal meaning."],
        ["Simile", "A comparison using “like” or “as”: as brave as a lion."],
        ["Metaphor", "Saying one thing IS another to create an image: the classroom was a zoo."],
        ["Personification", "Giving human qualities to something non-human: the wind whispered."],
        ["Onomatopoeia", "A word that sounds like what it describes: buzz, splash."],
        ["Root “spect”", "Latin for “look”: inspect, spectator, spectacle."],
      ]),
    },
    8: {
      year: 8,
      objectives: [
        "Study the history of English: Anglo-Saxon, French and Latin influences.",
        "Explore connotation and register to choose words for effect.",
        "Understand and use idiom, hyperbole, euphemism and portmanteau words.",
        "Use roots and affixes to infer meaning.",
        "Recognise how word meanings change over time.",
      ],
      note: {
        title: "Year 8: word history, register and figurative language",
        body: `## What you need to know

English is a **mixed** language. Many everyday words come from **Old English** (Anglo-Saxon); after the **Norman Conquest of 1066** many more came from French, often for law, food and status. Latin and Greek gave us scientific and academic words.

| Animal (Old English) | Meat (French) |
| --- | --- |
| pig | pork |
| sheep | mutton |
| deer | venison |

**Register** is how formal a word is: *eat* (neutral), *dine* (formal), *scoff* (informal). Formal words often come from Latin and French; short blunt words often come from Old English.

## Figurative language and word-building

| Term | Meaning | Example |
| --- | --- | --- |
| Idiom | A fixed phrase whose meaning is not literal | break the ice |
| Hyperbole | Deliberate exaggeration | I'm so hungry I could eat a horse |
| Euphemism | Mild word replacing a blunt one | let go (for sacked) |
| Portmanteau | Two words blended | motel, smog |
| Oxymoron | Two contradictory words | cruel kindness |

## Model analysis (PEEL)

Sentence: *"The crowd **surged** through the gates."*

- **Point:** The writer makes the crowd seem powerful and hard to control.
- **Evidence:** "surged".
- **Explain:** "Surged" is a word normally used for waves, so the people become a single, unstoppable force.
- **Link:** This choice suggests excitement and a hint of danger.

**Tip:** Always ask "Why this word, not a neighbour like *walked* or *hurried*?"`,
      },
      quiz: {
        title: "Vocabulary: Year 8 quiz",
        questions: [
          q8.single(
            "“It's raining cats and dogs” is an example of what?",
            "An idiom",
            ["A simile", "Alliteration", "Onomatopoeia"],
            "The phrase is fixed and its meaning (very heavy rain) is not literal, so it is an idiom.",
            1,
          ),
          q8.single(
            "What is a euphemism?",
            "A mild or polite expression used instead of a blunt one",
            ["An exaggeration that is used for humorous effect", "A word that sounds just like the noise it describes", "A comparison that is made using “like” or “as”"],
            "“Passed away” softens the word “died”. Euphemisms are used to avoid upsetting or offending people.",
            1,
          ),
          q8.single(
            "Why does English have both “cow” and “beef”?",
            "“Cow” is Old English, while “beef” came from French after 1066",
            ["“Beef” is Old English, while “cow” came from French after 1066", "Both words came directly from Ancient Greek scholars", "“Cow” was invented by Shakespeare for one of his plays"],
            "Anglo-Saxon farmers used “cow” for the animal; French-speaking Normans ate the meat, so “beef” (from French “boeuf”) named the food.",
            2,
            { d: true },
          ),
          q8.single(
            "Which word is the most formal synonym for “buy”?",
            "purchase",
            ["grab", "get", "pick up"],
            "“Purchase” is a formal choice of Latin/French origin. The others are informal.",
            1,
          ),
          q8.single(
            "Which sentence contains hyperbole?",
            "I've told you a million times to tidy your room.",
            ["I have told you twice to tidy your room.", "Your room is as messy as a jungle.", "Please tidy your room."],
            "“A million times” is a deliberate exaggeration for emphasis. The jungle comparison is a simile.",
            2,
            { d: true },
          ),
          q8.single(
            "Which word for someone who will not change their mind has the most negative connotation?",
            "stubborn",
            ["persistent", "determined", "resolute"],
            "All four suggest not giving up, but “stubborn” implies unreasonable inflexibility, while the others sound admirable.",
            2,
          ),
          q8.single(
            "The Latin root “port” means carry and “trans” means across. What does “transport” literally mean?",
            "Carry across",
            ["Carry back", "Carry under", "Carry before"],
            "Add the parts together: trans (across) + port (carry) = carry across.",
            2,
          ),
          q8.single(
            "Which sentence contains BOTH personification and alliteration?",
            "The wind whispered wearily through the wood.",
            ["The wind was as cold as a January morning.", "Crash! The door slammed shut.", "The wind blew hard all night."],
            "The wind is given a human action (“whispered wearily”) and the “w” sound repeats. The other sentences use a simile, onomatopoeia or no device.",
            3,
          ),
          q8.short(
            "What is the term for a word made by blending two words, such as “brunch” (breakfast + lunch)?",
            "portmanteau",
            ["portmanteau word", "a portmanteau", "a portmanteau word", "blend", "a blend", "blend word", "a blend word"],
            "Lewis Carroll used “portmanteau” for words that pack two meanings together, like a suitcase.",
            2,
          ),
          q8.single(
            "Which statement about the word “nice” is true?",
            "It once meant foolish or ignorant before coming to mean pleasant",
            ["It has always meant pleasant and has never changed at all", "It began life as a piece of modern teenage slang", "It was borrowed unchanged from Ancient Greek long ago"],
            "“Nice” comes from Latin “nescius” (ignorant) via Old French; its meaning shifted over several centuries.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["Idiom", "A fixed phrase whose meaning is not literal (it's raining cats and dogs)."],
        ["Hyperbole", "Deliberate exaggeration for effect."],
        ["Euphemism", "A mild expression used instead of a blunt or upsetting one (passed away)."],
        ["Portmanteau word", "A word blended from two others: brunch, smog."],
        ["Oxymoron", "Two contradictory words together: cruel kindness."],
        ["Register", "How formal or informal a word or style is."],
        ["Norman Conquest", "1066: brought many French words into English, especially for food, law and status."],
        ["pig / pork", "Old English name for the animal / French-derived name for the meat."],
        ["Root “port”", "Latin for “carry”: portable, transport, import."],
        ["Semantic change", "When a word's meaning shifts over time (nice once meant ignorant)."],
      ]),
    },
    9: {
      year: 9,
      objectives: [
        "Analyse how a writer's word choices create connotation, mood and meaning.",
        "Use precise terminology: semantic field, archaism, neologism, colloquialism, metonymy.",
        "Explore etymology and how English borrows and adapts words.",
        "Recognise pathetic fallacy, oxymoron and other devices in context.",
        "Select ambitious, precise vocabulary for different audiences and purposes.",
      ],
      note: {
        title: "Year 9: connotation, semantic fields and precise terminology",
        body: `## What you need to know

At Year 9 you move from naming words to **explaining what a word choice does**.

| Term | Meaning | Example |
| --- | --- | --- |
| Semantic field | A group of words linked by topic | scalpel, incision, suture (surgery) |
| Archaism | An old word no longer in everyday use | thee, hither |
| Neologism | A newly coined word | podcast |
| Colloquialism | Informal, everyday spoken language | y'know, kinda |
| Jargon | Specialist vocabulary | bandwidth, incision |
| Metonymy | Naming something by something associated with it | "The Crown" for the monarchy |
| Pathetic fallacy | Weather or setting mirrors mood | Sunshine floods the room as a character celebrates |
| Oxymoron | Contradictory pair | living dead |

**Connotation** carries a positive or negative feeling: *slender* (admiring) vs *scrawny* (critical).

**Etymology** can add depth: *companion* comes from Latin *com* (with) + *panis* (bread), literally "bread-sharer".

## Worked example (PEEL)

- **Point:** The writer makes the prisoner seem defeated.
- **Evidence:** "shuffled across the yard".
- **Explain:** "Shuffled" suggests slow, dragging steps, so he has lost energy and hope.
- **Link:** This supports the writer's message that prison crushes the spirit.

**Tip:** Compare your chosen word with a neighbour (*strode*, *hurried*) to show why the writer's choice is precise.`,
      },
      quiz: {
        title: "Vocabulary: Year 9 quiz",
        questions: [
          q9.single(
            "Which of these is an archaism in modern English?",
            "thou",
            ["you", "them", "they"],
            "“Thou” (you, singular) was common in Shakespeare's time but is no longer used in everyday speech.",
            1,
          ),
          q9.single(
            "What do we call a newly coined word, such as “selfie”?",
            "A neologism",
            ["An archaism", "A euphemism", "A portmanteau"],
            "A neologism is a new word or expression. “Portmanteau” describes how a word is built, not whether it is new.",
            1,
          ),
          q9.single(
            "Which adjective suggests admiration for someone's innocence and wonder?",
            "childlike",
            ["childish", "infantile", "immature"],
            "“Childlike” has a positive connotation; the other three all imply criticism.",
            2,
            { d: true },
          ),
          q9.single(
            "Which phrase is an oxymoron?",
            "a deafening silence",
            ["a silent night", "a loud noise", "a sudden crash"],
            "An oxymoron joins contradictory ideas: “deafening” means very loud and “silence” means no sound.",
            1,
          ),
          q9.single(
            "“Innit”, “gonna” and “wanna” are examples of what?",
            "Colloquialisms",
            ["Archaisms", "Jargon", "Euphemisms"],
            "Colloquialisms are informal words and phrases typical of everyday speech.",
            2,
          ),
          q9.single(
            "The words “trench”, “barrage”, “skirmish” and “bayonet” belong to which semantic field?",
            "Conflict",
            ["Gardening", "Cookery", "Music"],
            "A semantic field is a set of words linked by topic. These all belong to war and conflict.",
            2,
            { d: true },
          ),
          q9.single(
            "In a story, a violent storm breaks just as a character hears terrible news. What technique is this?",
            "Pathetic fallacy",
            ["Onomatopoeia", "Hyperbole", "Euphemism"],
            "Pathetic fallacy is when the weather or setting reflects a character's emotions.",
            2,
          ),
          q9.single(
            "The English word “disaster” comes from Italian “dis” (bad) + “astro” (star). What is its literal meaning?",
            "Ill-starred, born under a bad star",
            ["Broken sky, after a violent storm", "A dark night without any moon", "A falling stone that hits the ground"],
            "People once believed stars influenced fate, so a disaster was literally a “bad star” event.",
            3,
          ),
          q9.single(
            "Read the sentence.\n\nThe soldiers went scuttling across the open field.\n\nWhat does the verb “scuttling” suggest about the soldiers?",
            "That they are frightened and move like small, panicked creatures",
            ["That they are marching proudly in perfect formation", "That they are moving slowly, calmly and with dignity", "That they are enjoying a pleasant walk through the field"],
            "“Scuttle” is used for insects and small animals moving quickly and nervously, so it strips the soldiers of dignity.",
            2,
          ),
          q9.single(
            "“The pen is mightier than the sword.” What technique is used for “pen” and “sword”?",
            "Metonymy",
            ["Simile", "Onomatopoeia", "Alliteration"],
            "Metonymy names something by an associated object: “pen” stands for writing and “sword” for military force.",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["Semantic field", "A group of words related by topic or theme (e.g. war: trench, barrage)."],
        ["Archaism", "An old word or phrase no longer used in everyday language (thou, wherefore)."],
        ["Neologism", "A newly invented word (selfie)."],
        ["Colloquialism", "Informal language typical of everyday speech (gonna)."],
        ["Jargon", "Specialist vocabulary of a particular group or profession."],
        ["Metonymy", "Naming something by an associated thing (“the Crown” for the monarchy)."],
        ["Pathetic fallacy", "Weather or setting that mirrors a character's mood."],
        ["Oxymoron", "Two contradictory terms placed together (living dead)."],
        ["childlike vs childish", "Childlike = positive (innocent); childish = negative (immature)."],
        ["“disaster” etymology", "Italian dis + astro: literally “ill-starred”."],
      ]),
    },
  },
};
