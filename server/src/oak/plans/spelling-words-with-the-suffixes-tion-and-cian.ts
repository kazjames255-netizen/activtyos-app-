// Hand-written lesson plan for the pilot lesson "Spelling words with the suffixes -tion and -cian" (English, KS2, Year 6).
// Every fact below was re-checked against `cli.ts dossier homophones-and-tense__spelling-words-with-the-suffixes-tion-and-cian`
// (key learning points, keywords, Oak's slide text, the quiz answers and the video narration).
import type { LessonPlan } from "../../../../features/learninghub/lesson/plan";

export const PLAN: LessonPlan = {
  v: 1,
  source: "curated",
  steps: [
    {
      kind: "warmup", title: "Warm-up, goal and key words", minutes: 5,
      doThis: ["Start with the warm-up questions.", "Read the goal together, then look at the four key words: root word, suffix, verb, noun.", "Ask what each key word means before you show the meaning."],
      say: "I can spell words with the suffix -tion and -cian.",
      keywords: [
        { term: "root word", meaning: "the base word from which other words are formed often by adding prefixes or suffixes" },
        { term: "suffix", meaning: "a letter or group of letters added to the end of a word to change its meaning" },
        { term: "verb", meaning: "a doing, being or having word" },
        { term: "noun", meaning: "a naming word for people, places or things" },
      ],
      checkFor: { ask: "What is a suffix?", lookFor: "A letter or group of letters added to the end of a word to change its meaning." },
      recap: ["Our goal: I can spell words with the suffix -tion and -cian.", "A suffix is a letter or group of letters added to the end of a word to change its meaning."],
    },
    {
      kind: "teach", title: "The /shun/ sound and the suffix -tion", minutes: 6,
      doThis: [
        "Explain that the /shun/ sound at the end of a word can be spelt -tion, -sion, -ssion or -cian. The most common spelling is -tion, so it is the best bet.",
        "Show that adding -tion to a verb makes a noun: create becomes creation, and distribute becomes distribution.",
        "Ask which root words invention, hesitation and education come from (invent, hesitate, educate). Point out that they end in t or te.",
      ],
      keyIdeas: ["The /shun/ sound spelt -tion is the most common spelling.", "The /shun/ sound spelt -tion is used when the root word ends with 't' or 'te'."],
      checkFor: { ask: "Words spelt with -tion often have a root word ending in which letters: d, s or e; t or te; or c or cs?", lookFor: "t or te." },
      recap: ["The /shun/ sound at the end of a word is most often spelt -tion.", "Adding -tion to a verb makes a noun, like create and creation.", "Words that end in -tion often have a root word ending in t or te, like invent and invention."],
    },
    {
      kind: "teach", title: "Adding -ation to make nouns", minutes: 6,
      doThis: [
        "Show that the suffix -ation turns verbs into nouns: separate becomes separation, invite becomes invitation, calculate becomes calculation.",
        "Teach the three rules: if the root word ends in a consonant, just add the suffix; if it ends in e, remove the e then add the suffix; if it ends in -ate, remove -ate then add -ation.",
        "Sort these root words into the three rules: determine, inform, organise, translate, found, operate.",
      ],
      keyIdeas: [
        "Just add the suffix: inform becomes information, found becomes foundation.",
        "Remove the e, then add the suffix: admire becomes admiration, determine becomes determination, organise becomes organisation.",
        "Remove -ate, then add -ation: vibrate becomes vibration, donate becomes donation, translate becomes translation, operate becomes operation.",
        "Words ending in -otion, -ution and -etion usually have root words with the final vowel clearly pronounced, which helps you spell the new word.",
      ],
      checkFor: { ask: "What happens to the word translate when we add -ation?", lookFor: "Remove -ate, then add -ation: translation." },
      recap: ["The suffix -ation turns verbs into nouns, like invite and invitation.", "If the root word ends in a consonant, just add the suffix: inform, information.", "If it ends in e, remove the e first: admire, admiration.", "If it ends in -ate, remove -ate and add -ation: translate, translation."],
    },
    {
      kind: "teach", title: "Spelling words using the suffix -cian", minutes: 6,
      doThis: [
        "Read these words together: magician, technician, physician, electrician, beautician and mathematician. They all end in -cian.",
        "Explain that -cian is used for professions, which means jobs.",
        "Find the root words: music becomes musician, politics becomes politician, electric becomes electrician. These root words end in c or cs.",
      ],
      keyIdeas: ["The /shun/ sound spelt -cian is used for jobs, e.g. politician, mathematician.", "The /shun/ sound spelt -cian is used when the root words ends in 'c' or 'cs' e.g. politics-politician."],
      checkFor: { ask: "Is mathematician spelt with -tion or -cian, and how do you know?", lookFor: "-cian. Its root word, mathematics, ends in cs, and a mathematician does maths for a living, which is a profession." },
      recap: ["The /shun/ sound spelt -cian is used for jobs, like magician and electrician.", "Words with -cian often have a root word ending in c or cs, like music and musician, politics and politician."],
    },
    {
      kind: "teach", title: "Spelling curriculum words: competition and bargain", minutes: 5,
      doThis: [
        "Read the two words in a sentence each: competition (“I entered the competition and finished second.”) and bargain (“I got a really good bargain when I went to the shops.”).",
        "Competition has the root word compete and the suffix -tion. You can hear the e and the i clearly, which helps: comp-e-ti-tion.",
        "Bargain has a tricky middle: look at the letters ai, and notice that the word gain is hiding inside it.",
      ],
      keyIdeas: ["How to spell the curriculum words: competition and bargain."],
      checkFor: { ask: "Practise with look, cover, write, check. Can you now spell competition and bargain from memory?", lookFor: "competition and bargain, both spelt correctly." },
      recap: ["Competition comes from the root word compete plus -tion.", "Bargain has the word gain hiding inside it.", "Practise tricky words with look, cover, write, check."],
    },
    {
      kind: "guided", title: "Practise -tion words together", minutes: 7,
      doThis: [
        "Dictate these words one at a time: operation, admiration, pollution, information, translation.",
        "For each word, the student sounds it out, thinks of the root word, remembers the rule, writes it, then reads it back and checks.",
        "Check each root word together: operate, admire, pollute, inform, translate.",
      ],
      examples: [
        "operate becomes operation: remove -ate, then add -ation.",
        "admire becomes admiration: remove the e, then add -ation.",
        "pollute becomes pollution: remove the e, then add -ion.",
        "inform becomes information: just add -ation.",
        "translate becomes translation: remove -ate, then add -ation.",
      ],
      recap: ["Spell operation, admiration, pollution, information and translation.", "Think of the root word and the rule before you write."],
    },
    {
      kind: "guided", title: "Practise -cian words together", minutes: 7,
      doThis: [
        "Try a rhythm for a tricky word: clap or rap it in chunks, for example politician = pol-it-i-c-i-a-n and magician = ma-gi-c-i-a-n. Breaking a word into chunks helps you focus on the tricky parts.",
        "Dictate musician, electrician, politician, technician and magician. They are all professions, so the student knows the ending is -cian.",
        "Try optician too (someone who works on people's eyes).",
      ],
      examples: ["music becomes musician.", "electric becomes electrician.", "politics becomes politician.", "magic becomes magician."],
      recap: ["Clap or rap a word in chunks to remember it.", "Spell musician, electrician, politician, technician and magician."],
    },
    {
      kind: "independent", title: "Try it on your own", minutes: 8,
      doThis: ["Ask the student to do the lesson quiz on their own. It asks them to match root words to nouns ending in -tion and -cian, to choose the rule for imagine and imagination, and to correct three misspelt words.", "Mark it together and talk through any answer they got wrong."],
      recap: ["Do the quiz questions on your own.", "Look again at any you got wrong."],
    },
    {
      kind: "plenary", title: "Recap and finish", minutes: 3,
      doThis: [
        "Ask the student to explain when to use -tion and when to use -cian.",
        "Finish with the summary: the /shun/ suffix can be spelt -tion, -sion, -ssion or -cian; -tion is the most common; words with -tion often have a root word ending in t or te; words with -cian often have a root word ending in c or cs and are used for professions.",
      ],
      checkFor: { ask: "How do you decide between -tion and -cian?", lookFor: "-tion: the root word often ends in t or te. -cian: the root word often ends in c or cs, and it is used for professions." },
      recap: ["Can you do it now? I can spell words with the suffix -tion and -cian.", "Remember: -tion is the best bet, and -cian is for jobs."],
    },
  ],
  commonMistakes: [
    {
      mistake: "Children may struggle to know which /shun/ spelling to use.",
      fix: "If needed, refer back to the Year 4 content where the /shun/ spellings are introduced initially. Emphasise that -tion is the 'best bet' and most common spelling and use that as the focus for the lesson.",
    },
  ],
  watchOut: ["Allow pupils to investigate the spelling patterns. Give them word cards with a range of /shun/ spellings on them, ask pupils to decide how to group the words and explain the rationale for it. Ask them to say the word in a full sentence and identify the root word to support."],
};
