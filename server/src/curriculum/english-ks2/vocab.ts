// KS2 English — Vocabulary (Years 3–6). Original content aligned to the DfE National Curriculum (OGL v3.0).
// Word-part claims (prefix/root meanings, word membership) are checked by _check_e2.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";
import { build, mu, sg } from "./_h";

export const TOPIC: CTopic = {
  key: "vocab",
  topic: "Vocabulary",
  subject: "English",
  years: {
    3: {
      year: 3,
      objectives: [
        "Use synonyms and antonyms to widen and refine vocabulary.",
        "Understand how prefixes (un-) and suffixes (-less, -ful) change meaning; recognise word families.",
        "Work out the meaning of unfamiliar words from the sentence around them.",
        "Begin to understand figurative language, such as simple metaphors.",
      ],
      note: {
        title: "Year 3: synonyms, opposites and word parts",
        body: `## What you need to know

- **Synonyms** are words with a similar meaning: small and **tiny**. **Antonyms** are opposites: hot and **cold**.
- **Word families** share a root: play, **play**er, **play**ful, re**play**.
- **Prefixes** (start) and **suffixes** (end) change meaning. **un-** means not (unkind). **-less** means without (hopeless). **-ful** means full of (joyful).
- **Shades of meaning:** some synonyms are stronger than others. Chilly, cold and freezing show different strengths.

## Worked example 1: using context

“The **timid** rabbit hid when the fox appeared.” It hid, so timid must mean **shy and easily frightened**.

## Worked example 2: figurative language

“The bedroom was a jungle.” It is not really a jungle. It means things were **piled up and messy**.

## Worked example 3: word families

Care → careful (full of care), careless (without care), carefully (in a careful way).

| Word part | Meaning | Example |
| --- | --- | --- |
| un- | not | unkind |
| -less | without | hopeless |
| -ful | full of | joyful |`,
      },
      quiz: {
        title: "Vocabulary: Year 3 quiz",
        questions: build("vocab", 3, [
          sg("Which word means almost the same as “big”?", "enormous", ["tiny", "heavy", "quick"], 0, "Synonyms have a similar meaning. Enormous means very big.", 1),
          sg("Which word is the opposite of “ancient”?", "modern", ["old", "dusty", "historic"], 2, "An antonym is an opposite. Ancient means very old, and modern means new or up to date.", 1),
          sg("The prefix un- in “unhappy” means:", "not", ["again", "before", "under"], 3, "Un- means not, so unhappy means not happy.", 1),
          sg("Which word belongs to the same family as “help”?", "helpful", ["hello", "heap", "held"], 1, "Words in the same family share a root and a link in meaning. Helpful means full of help.", 2),
          sg("The suffix -less in “fearless” means:", "without", ["full of", "more", "able to"], 0, "Fearless means without fear. The suffix -less means without.", 2),
          sg("Read: “The weary walkers were glad to stop.” What does “weary” mean?", "tired", ["cheerful", "lost", "hungry"], 2, "They were glad to stop, so they must have been tired. Use the clues around a word to work it out.", 2, true),
          sg("Which word shows a LOUDER way of speaking than “said”?", "shouted", ["whispered", "murmured", "muttered"], 3, "Whispered, murmured and muttered are all quiet. Shouted is loud.", 2),
          mu("Which TWO words are synonyms of “happy”?", ["cheerful", "gloomy", "delighted", "furious"], ["cheerful", "delighted"], "Cheerful and delighted both describe being happy. Gloomy is sad and furious is very angry.", 2, true),
          sg("“The classroom was a zoo.” What does this mean?", "The classroom was noisy and chaotic.", ["There were animals in the classroom.", "The classroom was very clean.", "The class was visiting the zoo."], 1, "This is a metaphor. The class is not really a zoo, but it was as noisy and out of control as one.", 3),
          sg("Read: “Jo was reluctant to jump into the cold pool.” What does “reluctant” mean?", "unwilling", ["eager", "excited", "tired"], 2, "Reluctant means not wanting to do something. Eager and excited mean the opposite.", 3),
        ]),
      },
      flashcards: [
        { front: "Synonym", back: "A word with a similar meaning: small and tiny." },
        { front: "Antonym", back: "A word with the opposite meaning: hot and cold." },
        { front: "Prefix", back: "Letters added to the start of a word that change its meaning." },
        { front: "Suffix", back: "Letters added to the end of a word." },
        { front: "un- means...", back: "not (unkind)" },
        { front: "-less means...", back: "without (hopeless)" },
        { front: "-ful means...", back: "full of (joyful)" },
        { front: "Word family", back: "Words that share a root: play, player, playful." },
        { front: "How do you work out an unknown word?", back: "Use the sentence around it and ask what makes sense." },
      ],
    },
    4: {
      year: 4,
      objectives: [
        "Use prefixes (inter-, anti-, sub-, super-, in-/im-) and suffixes to work out word meanings.",
        "Explore word families and word roots from Latin and Greek.",
        "Choose precise verbs and adjectives (shades of meaning).",
        "Understand simple idioms, similes and metaphors and explain what they mean.",
      ],
      note: {
        title: "Year 4: roots, prefixes and word choice",
        body: `## What you need to know

Many English words are built from **roots** that come from Latin or Greek. If you know the root, you can guess the meaning of new words.

- **aqua** = water: **aqua**tic (living in water).
- **auto** = self: **auto**matic (working by itself).
- **inter-** = between: **inter**city. **sub-** = under: **sub**way. **anti-** = against: **anti**freeze.
- **Idioms** have a meaning that is not the same as the individual words: “It's a piece of cake” means it is very easy.

## Worked example 1: word families

Act, **act**or, **act**ion, re**act**. They share the root “act”, from a Latin word meaning do.

## Worked example 2: choosing the best verb

“Watch out!” **bellowed** the coach. “Watch out!” **murmured** the coach. Bellowed shows urgency; murmured would not be heard.

## Worked example 3: a metaphor

“The moon was a silver coin in the sky.” The moon looked round, bright and shiny.

| Root or prefix | Meaning | Word |
| --- | --- | --- |
| aqua | water | aquatic |
| inter- | between | intercity |
| anti- | against | antifreeze |`,
      },
      quiz: {
        title: "Vocabulary: Year 4 quiz",
        questions: build("vocab", 4, [
          sg("The prefix inter- in “international” means:", "between", ["under", "against", "above"], 0, "Inter- means between or among. International means between nations.", 1),
          sg("The root “aqua” means water. Which word is about water?", "aquarium", ["acrobat", "auditorium", "arithmetic"], 1, "An aquarium is a tank for water animals. Aqua is the giveaway.", 1),
          sg("Which word is closest in meaning to “brave”?", "courageous", ["foolish", "nervous", "cheerful"], 2, "Courageous means showing courage, which is the same as brave.", 1),
          sg("Which word is in the same family as “sign”?", "signature", ["single", "sinking", "sigh"], 3, "A signature is a name you sign. Family words share a root and a link in meaning.", 2, true),
          sg("Which word is the opposite of “polite”?", "impolite", ["mispolite", "dispolite", "inpolite"], 1, "Before p the prefix meaning not is im-, so the opposite of polite is impolite.", 2),
          sg("Choose the best word: “Help!” ___ the boy as the wave crashed over him.", "shrieked", ["whispered", "remarked", "mumbled"], 0, "The boy is in danger, so he would cry out loudly. Shrieked fits; the other words are too quiet or calm.", 2, true),
          sg("What does the idiom “It's raining cats and dogs” mean?", "It is raining very heavily.", ["Pets are falling from the sky.", "It is only drizzling.", "It has just stopped raining."], 2, "An idiom does not mean what the words say. This one means heavy rain.", 2),
          sg("“Auto” means self and “graph” means write. What is an autograph?", "A person's own handwritten signature", ["A machine that writes letters", "A picture of a car", "A book about someone's life"], 0, "Autograph literally means self-writing: your own signature.", 2),
          sg("“The snow was a white blanket over the town.” What does this metaphor suggest?", "The snow lay thick and soft, covering everything.", ["Someone had left bedding outside.", "The snow was made of wool.", "The town was going to sleep."], 3, "A blanket covers and is soft. The metaphor shows how the snow completely covered the town.", 3),
          mu("Which TWO words begin with a prefix meaning “against”?", ["antiseptic", "anticlockwise", "submarine", "international"], ["antiseptic", "anticlockwise"], "Anti- means against. Antiseptic works against germs and anticlockwise goes against the clock's direction. Sub- means under and inter- means between.", 3),
        ]),
      },
      flashcards: [
        { front: "inter- means...", back: "between (international)" },
        { front: "sub- means...", back: "under (submarine)" },
        { front: "anti- means...", back: "against (antiseptic)" },
        { front: "super- means...", back: "above or beyond (superstar)" },
        { front: "aqua", back: "water (aquatic)" },
        { front: "auto", back: "self (automatic)" },
        { front: "Idiom", back: "A phrase whose meaning is not the same as its words: “a piece of cake”." },
        { front: "Metaphor", back: "Says one thing IS another to describe it vividly." },
        { front: "Shades of meaning", back: "Similar words can be stronger or weaker: annoyed, angry, furious." },
      ],
    },
    5: {
      year: 5,
      objectives: [
        "Use knowledge of Latin and Greek roots to work out the meanings of new words.",
        "Distinguish between words of similar meaning by their strength or shade.",
        "Identify and explain figurative language, including personification, alliteration and idioms.",
        "Know that English has borrowed words from many other languages.",
        "Understand and use prefixes such as over- to change meaning.",
      ],
      note: {
        title: "Year 5: roots, figurative language and borrowed words",
        body: `## What you need to know

- **Latin and Greek roots:** **port** = carry (portable), **spect** = look (spectacles), **dict** = say (dictate), **bio** = life (biology).
- **Figurative language:** **personification** gives human actions to things (the clouds marched across the sky), **alliteration** repeats a starting sound (busy bees buzzed), an **idiom** is a fixed phrase (hit the nail on the head).
- **Borrowed words:** English collects words from other languages: **karaoke** (Japanese), **spaghetti** (Italian), **sofa** (Arabic), **bungalow** (Hindi).
- **Prefix over-:** can mean too much (overpriced, overloaded).

## Worked example 1: using a root

**Spectacles** help you to look at things. Spect means look.

## Worked example 2: idioms

“He hit the nail on the head” has nothing to do with a hammer. It means he was **exactly right**.

## Worked example 3: shades of meaning

pleased → happy → delighted → **ecstatic**. The strongest is ecstatic.

| Technique | Example |
| --- | --- |
| Personification | The clouds marched |
| Alliteration | busy bees buzzed |
| Idiom | under the weather |`,
      },
      quiz: {
        title: "Vocabulary: Year 5 quiz",
        questions: build("vocab", 5, [
          sg("The Latin root “port” means carry. Which word means to carry goods from one place to another?", "transport", ["portrait", "portion", "porch"], 0, "Trans- means across, and port means carry, so transport means carry across.", 2),
          sg("The root “spect” means look. A spectator is someone who:", "watches", ["sings", "builds", "cleans"], 3, "A spectator looks at, or watches, an event.", 1),
          sg("The root “dict” means say or speak. Which word contains it?", "predict", ["direct", "district", "dessert"], 1, "To predict is to say before (pre-) something happens.", 3),
          sg("Which word shows the STRONGEST feeling?", "furious", ["annoyed", "cross", "upset"], 2, "Annoyed and cross are mild. Furious means extremely angry.", 1),
          sg("Which word is the opposite of “generous”?", "selfish", ["kind", "wealthy", "thoughtful"], 0, "A generous person gives freely. The opposite is selfish, keeping things for oneself.", 1),
          sg("Which sentence uses personification?", "The wind whispered through the trees.", ["The wind was cold.", "The wind was as loud as a train.", "The wind blew at forty miles per hour."], 0, "Wind cannot really whisper. Giving it a human action is personification.", 2, true),
          sg("Which phrase contains alliteration?", "slippery snakes slithered", ["the old grey cat", "a warm, bright day", "a quiet, empty room"], 2, "Alliteration repeats the same starting sound. Slippery, snakes and slithered all begin with s.", 2),
          sg("What does “She let the cat out of the bag” mean?", "She revealed a secret.", ["She set a pet free.", "She was carrying shopping.", "She made a mistake at the shops."], 3, "It is an idiom, so it does not mean what the words say. It means she gave away a secret.", 2, true),
          sg("Which word came into English from Japanese?", "tsunami", ["pizza", "robot", "kayak"], 1, "Tsunami is Japanese (harbour wave). Pizza is Italian, robot is Czech and kayak comes from an Arctic language.", 2),
          mu("Which TWO words use the prefix over- to mean “too much”?", ["overeat", "overhead", "overcooked", "overture"], ["overeat", "overcooked"], "To overeat is to eat too much, and overcooked food has been cooked for too long. Overhead means above and an overture is a piece of music.", 3),
        ]),
      },
      flashcards: [
        { front: "port", back: "carry (portable)" },
        { front: "spect", back: "look (spectacles)" },
        { front: "dict", back: "say or speak (dictate)" },
        { front: "bio", back: "life (biology)" },
        { front: "Personification", back: "Giving human actions to non-human things." },
        { front: "Alliteration", back: "Repeating the same sound at the start of words." },
        { front: "Idiom", back: "A phrase with a fixed meaning that is not literal." },
        { front: "Loan words", back: "Words borrowed from other languages: karaoke, spaghetti, sofa." },
        { front: "Prefix over-", back: "too much (overloaded) or above (overhead)" },
      ],
    },
    6: {
      year: 6,
      objectives: [
        "Use Latin and Greek roots (chron, therm, photo, graph) to work out meanings.",
        "Choose vocabulary that is precise, and understand connotations (positive or negative feeling in a word).",
        "Know the difference between formal and informal synonyms.",
        "Identify multiple meanings of words in context and explain figurative language.",
        "Order words by strength or degree of meaning.",
      ],
      note: {
        title: "Year 6: precision, connotation and word roots",
        body: `## What you need to know

At the end of Year 6 you choose words with care and notice the **feeling** a word carries.

- **Connotation:** two words can mean nearly the same but feel different. **Confident** is positive; **arrogant** is negative. **Thrifty** is positive; **mean** is negative.
- **Formal and informal:** **assist** is formal, **help** is neutral, **lend a hand** is casual.
- **Multiple meanings:** a **bat** can be an animal or something you hit a ball with. Use the context.
- **Roots:** **chron** = time (synchronise), **therm** = heat (thermal), **tele** = far, **graph** = write (paragraph).

## Worked example 1: degree of meaning

warm, hot, boiling go from weakest to strongest.

## Worked example 2: word parts

Tele (far) + graph (write) = **telegraph**: writing sent from far away.

## Worked example 3: figurative

“His smile was sunshine.” It was warm and cheering.

| Word | Feeling |
| --- | --- |
| confident | positive |
| arrogant | negative |
| thrifty | positive |
| mean | negative |`,
      },
      quiz: {
        title: "Vocabulary: Year 6 quiz",
        questions: build("vocab", 6, [
          sg("The root “chron” means time. Which word means “arranged in order of time”?", "chronological", ["chemical", "character", "chorus"], 0, "A chronological account tells events in the order they happened.", 2),
          sg("The root “therm” means heat. A thermometer measures:", "temperature", ["distance", "weight", "time"], 3, "A thermometer measures how hot or cold something is.", 1),
          sg("Which word gives the most POSITIVE impression of someone who will not change their mind?", "determined", ["stubborn", "obstinate", "pig-headed"], 1, "Determined is admiring. Stubborn, obstinate and pig-headed are all criticisms.", 2, true),
          sg("Which word is the most formal way to say “buy”?", "purchase", ["grab", "get", "nab"], 2, "Purchase is formal. Get is neutral and grab and nab are casual.", 1),
          sg("In which sentence does “bank” mean the side of a river?", "We sat on the bank and watched the ducks.", ["I put my money in the bank.", "The bank closes at four o'clock.", "She banked her savings."], 0, "Only in the first sentence is bank a place beside the water. Context tells you which meaning is used.", 1),
          sg("Which word is the opposite of “scarce”?", "plentiful", ["rare", "limited", "tiny"], 3, "Scarce means not enough. Plentiful means more than enough.", 2),
          sg("Which list goes from the weakest to the strongest?", "annoyed, angry, furious", ["furious, angry, annoyed", "angry, annoyed, furious", "annoyed, furious, angry"], 1, "Annoyed is mild, angry is stronger and furious is extreme.", 2, true),
          sg("“Photo” means light and “graph” means write. What does “photograph” literally mean?", "writing or drawing with light", ["a picture of the sun", "a picture that lasts", "a person in a picture"], 2, "The parts of a word can give its literal meaning: light + writing.", 2),
          sg("Which word is closest in meaning to “ambiguous” in “The instructions were ambiguous”?", "unclear", ["precise", "lengthy", "ancient"], 0, "Ambiguous means open to more than one meaning, so it is unclear.", 3),
          sg("“Her words were daggers.” What does this metaphor suggest?", "Her words were sharp and hurtful.", ["She was carrying weapons.", "She spoke very quickly.", "Her words were made of metal."], 1, "A dagger cuts and hurts. The metaphor says her words caused pain.", 3),
        ]),
      },
      flashcards: [
        { front: "Connotation", back: "The positive or negative feeling that a word carries." },
        { front: "Which is positive: confident or arrogant?", back: "confident" },
        { front: "Formal word for “help”", back: "assist" },
        { front: "Words with more than one meaning", back: "Check the context: bat (animal) or bat (for hitting a ball)." },
        { front: "chron", back: "time (synchronise)" },
        { front: "therm", back: "heat (thermal)" },
        { front: "tele + graph", back: "far + write = telegraph" },
        { front: "Ordering words by strength", back: "warm, hot, boiling (weakest to strongest)" },
        { front: "Ambiguous", back: "Able to be understood in more than one way; unclear." },
      ],
    },
  },
};
