import type { HowScript } from "../types";
import { shot } from "../shot";

// CHILDREN (Year 3 upwards; kid mode). Short sentences, no jargon, read aloud by default once the child taps play. Only child-visible screens
// (the child's own Home, Lessons, Homework, Quizzes, Flashcards, Stars): nothing tutor- or parent-only, and no link that leaves the child area.
// Wording follows family/kidCopy.ts ("Nearly there. Have another go.", "Waiting for you").
const HUB = "/custdash/learninghub";

export const KID: HowScript = {
  role: "kid",
  slug: "children",
  title: "How it works",
  tagline: "Your very own learning space. Watch, listen, and have a go!",
  audience: "For children",
  viewLabel: "What your child sees",
  scenes: [
    {
      id: "hello", chapter: "Hello", title: "Hello!", layout: "title", emoji: "👋",
      say: "Hello! This is your very own learning space. It shows you what to do next, and it helps you learn. Let's take a quick look.",
      keys: ["Hello", "learning space", "what to do next"],
      nodes: [
        { on: "what to do next", icon: "👉", title: "What to do" },
        { on: "helps you learn", icon: "🌟", title: "Learn", tone: "b" },
      ],
    },
    {
      id: "home", chapter: "Home", title: "Your Home",
      say: "This is your Home. It shows one big thing to do next. Tap Go to start it. Tap the little speaker, and it reads it out loud to you.",
      keys: ["Your Home", "One big thing to do", "Tap Go::Tap Go to start", "Hear it read out::little speaker"],
      shot: shot("k-home", `${HUB}?tab=home`),
      cam: [{ on: "It shows one big thing", el: "#hub-kid-next", z: 1.3 }, { on: "Tap Go", el: "#hub-kid-go", z: 1.6 }, { on: "little speaker", el: "#hub-read-next", z: 1.8 }],
      rings: [
        { on: "one big thing", el: "#hub-kid-next", off: "Tap Go" },
        { on: "Tap Go", el: "#hub-kid-go", off: "little speaker" },
        { on: "little speaker", el: "#hub-read-next" },
      ],
      callouts: [
        { on: "one big thing", el: "#hub-kid-next", text: "Your next thing to do" },
        { on: "Tap Go", el: "#hub-kid-go", text: "Tap Go to start" },
        { on: "little speaker", el: "#hub-read-next", text: "Tap to hear it read out" },
      ],
      cursor: [{ on: "Tap Go", el: "#hub-kid-go", click: true }, { on: "little speaker", el: "#hub-read-next", click: true }],
    },
    {
      id: "lessons", chapter: "Learn", title: "Lessons",
      say: "Lessons help you learn something new. You go through one idea at a time. There are questions to try, and a quiz at the end.",
      keys: ["Learn something new", "One idea at a time", "Questions to try", "A quiz at the end::quiz at the end"],
      shot: shot("k-lessons", `${HUB}?tab=notes`),
      cam: [{ on: "learn something new", el: "#curriculum-sticker-book", z: 1.2 }, { on: "one idea at a time", el: "button~Position and direction", z: 1.9 }],
      rings: [{ on: "one idea at a time", el: "button~Position and direction" }],
      callouts: [
        { on: "learn something new", el: "#curriculum-sticker-book", text: "Pick a lesson" },
        { on: "one idea at a time", el: "button~Position and direction", text: "One idea at a time" },
        { on: "questions to try", el: "button~Properties of shapes", text: "Questions to try" },
      ],
      cursor: [{ on: "one idea at a time", el: "button~Position and direction", click: true }],
    },
    {
      id: "homework", chapter: "Learn", title: "Homework",
      say: "Your homework is here. Open it, do your best, and hand it in. Your tutor will look at it and tell you how you did.",
      keys: ["Your homework is here", "Open it", "Do your best", "Hand it in"],
      shots: [
        { on: "", ...shot("k-homework", `${HUB}?tab=homework`) },
        { on: "Open it", ...shot("k-hw-open", `${HUB}?tab=homework`) },
      ],
      cam: [{ on: "Your homework", el: "h2~Homework for", z: 1.6 }, { on: "do your best", el: "#hub-hw-worksheet", z: 1.7 }, { on: "hand it in", el: "#hub-hw-ws-steps", z: 2 }],
      rings: [
        { on: "do your best", el: "#hub-hw-worksheet", off: "hand it in" },
        { on: "hand it in", el: "#hub-hw-ws-steps" },
      ],
      callouts: [
        { on: "Open it", el: "#hub-hw-head", text: "Open it" },
        { on: "do your best", el: "#hub-hw-worksheet", text: "Do your best" },
        { on: "hand it in", el: "#hub-hw-ws-steps", text: "Hand it in" },
      ],
      cursor: [{ on: "do your best", el: "#hub-hw-start-worksheet", click: true }],
    },
    {
      id: "quizzes", chapter: "Play", title: "Quizzes",
      say: "Quizzes are short sets of questions. Read each one, and pick your answer. Not quite right? That's okay. You can have another go.",
      keys: ["Short sets of questions", "Pick your answer", "Not quite right? That's okay::That's okay", "Have another go::another go"],
      shot: shot("k-quizzes", `${HUB}?tab=quizzes`),
      cam: [{ on: "Quizzes are short", el: "#hub-quiz-list", z: 1.25 }, { on: "pick your answer", el: "#hub-open-assessment", z: 1.9 }],
      rings: [{ on: "pick your answer", el: "#hub-open-assessment" }],
      callouts: [
        { on: "Read each one", el: "#hub-quiz-list", text: "Read the question" },
        { on: "pick your answer", el: "#hub-open-assessment", text: "Pick your answer" },
        { on: "another go", el: "#hub-quiz-list", text: "Have another go!" },
      ],
      cursor: [{ on: "pick your answer", el: "#hub-open-assessment", click: true }],
    },
    {
      id: "tools", chapter: "Play", title: "Helper tools",
      say: "Some questions have a helper tool, like a ruler or a protractor. Tap the tool button, and it opens right there to help you work out the answer. And tap the speaker to hear the question read out.",
      keys: ["helper tool", "Tap the tool button", "speaker"],
      shots: [
        { on: "", ...shot("k-quiz-tool", `${HUB}?tab=quizzes`) },
        { on: "opens right there", ...shot("k-tool-open", `${HUB}?tab=quizzes`) },
      ],
      cam: [{ on: "Some questions", el: "#question-tools", z: 1.6 }, { on: "Tap the tool button", el: "#question-tool-M-02", z: 2 }, { on: "opens right there", el: "#geometry-board", z: 1.2 }],
      rings: [
        { on: "Some questions", el: "#question-tools", off: "Tap the tool button" },
        { on: "Tap the tool button", el: "#question-tool-M-02", off: "opens right there" },
      ],
      callouts: [
        { on: "Tap the tool button", el: "#question-tool-M-02", text: "The tool button" },
      ],
      cursor: [{ on: "Tap the tool button", el: "#question-tool-M-02", click: true }],
    },
    {
      id: "cards", chapter: "Play", title: "Flashcards",
      say: "Flashcards help you remember things. Tap a card to flip it. Then say how well you knew it. The cards you find tricky come back again soon.",
      keys: ["Remember things", "Tap a card to flip it::Tap a card", "How well you knew it", "Tricky ones come back::come back again"],
      shot: shot("k-flashcards", `${HUB}?tab=flashcards`),
      cam: [{ on: "Flashcards help", el: "#hub-fc-start", z: 1.4 }, { on: "Tap a card", el: "button~Start review", z: 2 }],
      rings: [{ on: "Tap a card", el: "button~Start review" }],
      callouts: [
        { on: "Tap a card", el: "button~Start review", text: "Tap the card to flip it" },
        { on: "how well you knew it", el: "#hub-fc-start", text: "How well did you know it?" },
        { on: "come back again", el: "#hub-fc-start", text: "Tricky ones come back" },
      ],
      cursor: [{ on: "Tap a card", el: "button~Start review", click: true }],
    },
    {
      id: "grown-up", chapter: "All done", title: "When you have finished", layout: "title", emoji: "🏡",
      say: "When you have finished, ask a grown-up to help you leave. They answer a little sum, and then you are all done. You can tap How it works any time to watch this again.",
      keys: ["ask a grown-up", "little sum", "How it works"],
      nodes: [
        { on: "ask a grown-up", icon: "🧑", title: "Ask a grown-up" },
        { on: "little sum", icon: "➗", title: "A little sum", tone: "b" },
        { on: "all done", icon: "✅", title: "All done!", tone: "c" },
      ],
    },
  ],
};
