import type { HowScript } from "../types";
import { shot } from "../shot";

// CHILDREN, Reception to Year 2 (KS1). Even simpler and icon-led: the three big buttons (Today, Play & learn, Stars), one idea per scene,
// very short sentences. The same child-only screens; nothing tutor- or parent-only.
const HUB = "/custdash/learninghub";

export const KID_KS1: HowScript = {
  role: "kid",
  slug: "children",
  band: "ks1",
  title: "How it works",
  tagline: "Watch and listen. It is short!",
  audience: "For children",
  viewLabel: "What your child sees",
  scenes: [
    {
      id: "hello", chapter: "Hello", title: "Hello!", layout: "title", emoji: "👋",
      say: "Hello! This is your space. Let's see how it works.",
      keys: ["Hello", "your space"],
      nodes: [
        { on: "your space", icon: "🏠", title: "Today" },
        { on: "Let's see", icon: "🎮", title: "Play & learn", tone: "b" },
        { on: "how it works", icon: "⭐", title: "Stars", tone: "c" },
      ],
    },
    {
      id: "today", chapter: "Today", title: "Today",
      say: "This is Today. It shows one thing to do. Tap the big Go button. Tap the speaker to hear it.",
      keys: ["Today", "One thing to do::one thing", "Tap the big Go", "Hear it::speaker"],
      shot: shot("k-ks1-home", `${HUB}?tab=home`),
      cam: [{ on: "It shows one thing", el: "#hub-kid-next", z: 1.3 }, { on: "Tap the big Go", el: "#hub-kid-go", z: 1.7 }, { on: "the speaker", el: "#hub-read-next", z: 1.9 }],
      rings: [
        { on: "It shows one thing", el: "#hub-kid-next", off: "Tap the big Go" },
        { on: "Tap the big Go", el: "#hub-kid-go", off: "Tap the speaker" },
        { on: "Tap the speaker", el: "#hub-read-next" },
      ],
      callouts: [
        { on: "one thing", el: "#hub-kid-next", text: "One thing to do" },
        { on: "big Go button", el: "#hub-kid-go", text: "Tap Go" },
        { on: "the speaker", el: "#hub-read-next", text: "Hear it" },
      ],
      cursor: [{ on: "Tap the big Go", el: "#hub-kid-go", click: true }, { on: "Tap the speaker", el: "#hub-read-next", click: true }],
    },
    {
      id: "play", chapter: "Play", title: "Play and learn",
      say: "Tap Play and learn. Here are your quizzes. Tap one. Have a go!",
      keys: ["Play and learn", "Your quizzes::quizzes", "Have a go!"],
      shot: shot("k-ks1-play", `${HUB}?tab=quizzes`),
      cam: [{ on: "Tap Play", el: "#kid-tab-play", z: 2 }, { on: "Here are your quizzes", el: "#hub-quiz-list", z: 1.2 }],
      rings: [{ on: "Tap Play", el: "#kid-tab-play", off: "Here are" }, { on: "Tap one", el: "#hub-open-assessment" }],
      callouts: [
        { on: "Tap Play", el: "#kid-tab-play", text: "Play and learn" },
        { on: "quizzes", el: "#hub-quiz-list", text: "Quizzes" },
      ],
      cursor: [{ on: "Tap Play", el: "#kid-tab-play", click: true }, { on: "Tap one", el: "#hub-open-assessment", click: true }],
    },
    {
      id: "stars", chapter: "Stars", title: "Stars",
      say: "Tap Stars. Do a quiz, and your stars shine here. Well done!",
      keys: ["Stars", "Your stars shine here::stars shine here", "Well done!::Well done"],
      shot: shot("k-ks1-stars", `${HUB}?tab=dashboard`),
      cam: [{ on: "Tap Stars", el: "#kid-tab-stars", z: 2 }, { on: "Do a quiz", el: "#kid-icon-tabs", z: 1.6 }],
      rings: [{ on: "Tap Stars", el: "#kid-tab-stars", off: "Do a quiz" }, { on: "Do a quiz", el: "#kid-icon-tabs" }],
      callouts: [
        { on: "Tap Stars", el: "#kid-tab-stars", text: "Stars" },
        { on: "your stars shine", el: "#kid-icon-tabs", text: "Your stars" },
      ],
      cursor: [{ on: "Tap Stars", el: "#kid-tab-stars", click: true }],
    },
    {
      id: "grown-up", chapter: "All done", title: "All done", layout: "title", emoji: "🧑",
      say: "All done? Ask a grown-up to help you. Bye for now!",
      keys: ["grown-up", "Bye"],
      nodes: [
        { on: "Ask a grown-up", icon: "🧑", title: "Ask a grown-up" },
        { on: "Bye for now", icon: "👋", title: "Bye!", tone: "b" },
      ],
    },
  ],
};
