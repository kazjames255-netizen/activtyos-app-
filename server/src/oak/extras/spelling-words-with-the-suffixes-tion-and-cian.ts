// Flashcards + worksheet for "Spelling words with the suffixes -tion and -cian" (Y6). Worksheet tasks follow Oak's worksheet
// (Task A: -tion words, Task B: -cian words, Task C: curriculum words); in the interactive version each word is asked from a
// clue + its root word (Oak's teacher reads the words out, which a screen can't do).
import type { LessonExtras } from "./index";

export const EXTRAS: LessonExtras = {
  flashcards: [
    { front: "Name the four ways of spelling the /shun/ sound at the end of a word.", back: "-tion, -sion, -ssion and -cian." },
    { front: "Which spelling of /shun/ is the most common (the ‘best bet’)?", back: "-tion." },
    { front: "Words that end in -tion often have a root word ending in which letters?", back: "t or te.\n\ninvent → invention\nhesitate → hesitation" },
    { front: "What does the suffix -ation do to a verb?", back: "It turns the verb into a noun.\n\ninvite (verb) → invitation (noun)" },
    { front: "Add -ation to “inform”.", back: "information\n\nThe root word ends in a consonant, so just add the suffix." },
    { front: "Add -ation to “admire”.", back: "admiration\n\nThe root word ends in ‘e’: remove the ‘e’, then add -ation." },
    { front: "Add -ation to “vibrate”.", back: "vibration\n\nThe word ends in -ate: remove the -ate, then add -ation." },
    { front: "Which /shun/ suffix is used for professions (jobs)?", back: "-cian.\n\nmagician, electrician, technician" },
    { front: "Words that end in -cian often have a root word ending in which letters?", back: "c or cs.\n\nmusic → musician\npolitics → politician" },
    { front: "What is the root word of “mathematician”?", back: "mathematics (it ends in cs, so the /shun/ suffix is -cian)." },
    { front: "Spell the word for a contest where people try to win. (Root word: compete)", back: "competition\n\nSay it in chunks: comp-e-ti-tion." },
    { front: "Which little word can you spot inside “bargain” to help you spell it?", back: "gain.\n\nThe letters ‘ai’ make the ‘i’ sound in bargain." },
    { front: "Complete the spelling strategy: look, ___, write, check.", back: "Look, cover, write, check." },
  ],
  worksheet: {
    title: "Worksheet: Spelling words with the suffixes -tion and -cian",
    instructions: "Do Tasks A, B and C. Read the clue, think of the root word, sound the word out and use the spelling rules from the lesson. Then read the word back and check it.\n\nTask A: -tion words. Task B: -cian words. Task C: curriculum words (look, cover, write, check).",
    pdfFile: "spelling-words-with-the-suffixes-tion-and-cian.worksheet.pdf",
    questions: [
      { prompt: "Task A: Write the -tion word that means “a feeling of respect and liking for someone”. Its root word is “admire”.", answer: "admiration", explanation: "The root word ends in ‘e’: remove the ‘e’, then add -ation → admiration." },
      { prompt: "Task A: Write the -tion word that means “facts or details about something”. Its root word is “inform”.", answer: "information", explanation: "The root word ends in a consonant, so just add -ation → information." },
      { prompt: "Task A: Write the -tion word that means “a medical procedure, or the way a machine works”. Its root word is “operate”.", answer: "operation", explanation: "Remove the -ate, then add -ation → operation." },
      { prompt: "Task A: Write the -tion word that means “changing writing from one language into another”. Its root word is “translate”.", answer: "translation", explanation: "Remove the -ate, then add -ation → translation." },
      { prompt: "Task A: Write the -tion word for “harmful dirt in the air or water”. Its root word is “pollute”.", answer: "pollution", explanation: "The root word ends in ‘e’: remove the ‘e’, then add -ion → pollution (pollut + ion)." },
      { prompt: "Task B: Write the /shun/ word for “a person who fits and mends electrical wiring”. Its root word is “electric”.", answer: "electrician", explanation: "Jobs use -cian, and the root word ends in c → electrician." },
      { prompt: "Task B: Write the /shun/ word for “a person with special training in a practical skill, such as fixing machines”.", answer: "technician", explanation: "Jobs use -cian → technician." },
      { prompt: "Task B: Write the /shun/ word for “a person who works in politics”. Its root word is “politics”.", answer: "politician", explanation: "The root word ends in cs, so we use -cian → politician." },
      { prompt: "Task B: Write the /shun/ word for “a person who plays an instrument or sings”. Its root word is “music”.", answer: "musician", explanation: "The root word ends in c, so we use -cian → musician." },
      { prompt: "Task B: Write the /shun/ word for “a person who does tricks and makes things appear or disappear”.", answer: "magician", explanation: "Jobs use -cian → magician." },
      { prompt: "Task C (look, cover, write, check): Spell the word for “a contest where people try to win”. Its root word is “compete”.", answer: "competition", explanation: "Say it in chunks: comp-e-ti-tion." },
      { prompt: "Task C (look, cover, write, check): Spell the word for “something bought for less than its usual price, a good deal”.", answer: "bargain", explanation: "The letters ‘ai’ make the ‘i’ sound. You can see the word ‘gain’ inside it." },
    ],
  },
};
