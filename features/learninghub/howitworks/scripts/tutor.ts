import type { HowScript } from "../types";
import { shot } from "../shot";

// TUTORS (freelancer / company / franchise / staff with edit access). Every sentence is true of the app as it is today — checked against
// the code (StudentsPanel, HubTabs/tabGroups, NotesPanel, LessonPlayer, ToolsPanel, live/workspace, MarkQueue, QuestionsPanel …) and the
// screens are real captures (e2e/review/how-it-works-shots.spec.ts). Coordinates are percentages of the screenshot. Scene ids here are the
// full bank; scripts/tutorTopics.ts, tutorHomework.ts and tutorMessages.ts each pick the scenes for their own topic video.
const HUB = "/freelancer/learninghub";

export const TUTOR: HowScript = {
  role: "tutor",
  slug: "tutors",
  title: "Run your Teaching Hub",
  tagline: "Get families onto your roster, teach in the way that suits you, and see how every child is doing.",
  audience: "For tutors",
  scenes: [
    // ---- Home (3 scenes) ----
    {
      id: "home-tour", chapter: "Home", title: "Your areas",
      say: "Across the top are your areas: Lessons, Students, Progress, Quizzes, Homework and Messages. Home is where you start.",
      keys: ["Your areas", "Lessons, Students, Progress", "Quizzes, Homework and Messages", "Home is where you start"],
      shot: shot("t-home", `${HUB}?tab=home`),
      cam: [{ on: "Across the top", el: "Sections", z: 1.9 }],
      rings: [{ on: "Across the top", el: "Sections", off: "Home is where" }],
      cursor: [{ on: "Home is where you start", el: "#hub-tab-home" }],
    },
    {
      id: "home-attention", chapter: "Home", title: "Needs your attention",
      say: "Needs your attention lists what to do next: homework to mark, written answers, and overdue work. Start at the top.",
      keys: ["Needs your attention", "What to do next", "Homework to mark", "Overdue work", "Start at the top"],
      shot: shot("t-home", `${HUB}?tab=home`),
      cam: [{ on: "Needs your attention lists", el: "section~Needs your attention", z: 1.5 }],
      rings: [{ on: "Needs your attention lists", el: "section~Needs your attention" }],
      cursor: [{ on: "Start at the top", el: "button~2 Homework to mark" }],
    },
    {
      id: "home-help", chapter: "Home", title: "Help is always here",
      say: "Your next lesson sits here. And How it works is on every page whenever you need a reminder.",
      keys: ["Your next lesson", "How it works", "On every page", "A reminder"],
      shot: shot("t-home", `${HUB}?tab=home`),
      cam: [
        { on: "Your next lesson sits here", el: "section~Next lesson", z: 1.6 },
        { on: "How it works is on every page", el: "#hiw-open", z: 3 },
      ],
      rings: [
        { on: "Your next lesson sits here", el: "section~Next lesson", off: "And How it works" },
        { on: "How it works is on every page", el: "#hiw-open" },
      ],
      cursor: [{ on: "How it works is on every page", el: "#hiw-open", click: true }],
    },

    // ---- Families (4 scenes: three ways in) ----
    {
      id: "fam-ways", chapter: "Families", title: "Three ways in", layout: "flow",
      say: "A family can join you three ways: they book with you, you send an invite link, or they find your public page.",
      keys: ["Three ways", "They book with you", "Send an invite link", "Your public page"],
      nodes: [
        { on: "they book with you", icon: "🛒", title: "They book with you", sub: "Their child appears in Enrol a student", tone: "a" },
        { on: "you send an invite link", icon: "🔗", title: "Send an invite link", sub: "Works once, for 30 days", tone: "b" },
        { on: "they find your public page", icon: "🌐", title: "Your public page", sub: "They sign up, then you enrol them", tone: "c" },
      ],
    },
    {
      id: "fam-book", chapter: "Families", title: "They booked with you",
      say: "When a parent books, their child appears in Enrol a student. Press Enrol, pick their subjects and year, then Enrol student.",
      keys: ["Enrol a student", "Press Enrol", "Subjects and year", "Enrol student"],
      shots: [
        { on: "", ...shot("t-enrol", `${HUB}?tab=students`) },
        { on: "pick their subjects", ...shot("t-enrol-pick", `${HUB}?tab=students`) },
      ],
      cam: [
        { on: "their child appears", el: "#hub-enrol-modal", z: 1.35 },
        { on: "Press Enrol", el: "Enrol", z: 2.6 },
        { on: "pick their subjects", el: "Which subjects can they see", z: 2.2 },
        { on: "and year", el: "Year group", z: 2.2 },
        { on: "then Enrol student", el: "Enrol student", z: 2.6 },
      ],
      rings: [
        { on: "Press Enrol", el: "Enrol", off: "pick their subjects" },
        { on: "pick their subjects", el: "Which subjects can they see", off: "and year" },
        { on: "and year", el: "Year group", off: "then Enrol student" },
        { on: "then Enrol student", el: "Enrol student" },
      ],
      cursor: [{ on: "Press Enrol", el: "Enrol", click: true }, { on: "then Enrol student", el: "Enrol student", click: true }],
    },
    {
      id: "fam-invite", chapter: "Families", title: "Send an invite link",
      say: "No booking? Type who it's for and press Create invite link. Send it to the parent. It works once, for 30 days.",
      keys: ["Type who it's for", "Create invite link", "Send it to the parent", "Once, for 30 days"],
      shot: shot("t-enrol-invite", `${HUB}?tab=students`),
      cam: [
        { on: "Type who it's for", el: "Who is it for", z: 2.4 },
        { on: "press Create invite link", el: "Create invite link", z: 2.6 },
        { on: "Send it to the parent", el: "#hub-family-invite-link", z: 2.4 },
      ],
      rings: [
        { on: "Type who it's for", el: "Who is it for", off: "press Create invite link" },
        { on: "press Create invite link", el: "Create invite link", off: "Send it to the parent" },
        { on: "Send it to the parent", el: "#hub-family-invite-link" },
      ],
      cursor: [{ on: "press Create invite link", el: "Create invite link", click: true }, { on: "Send it to the parent", el: "Copy link", click: true }],
      callouts: [{ on: "It works once", el: "#hub-family-invite-link", text: "Nothing is emailed for you: you send it", dir: "up" }],
    },
    {
      id: "fam-page", chapter: "Families", title: "Share your public page",
      say: "Or copy your page link and send it. Once the parent signs up, their children appear here, ready to enrol.",
      keys: ["Copy your page link", "Send it", "The parent signs up", "Ready to enrol"],
      shot: shot("t-enrol-link", `${HUB}?tab=students`),
      cam: [
        { on: "copy your page link", el: "Your page link for new families", z: 2.2 },
        { on: "their children appear here", el: "#hub-enrol-modal", z: 1.4 },
      ],
      rings: [{ on: "copy your page link", el: "Your page link for new families", off: "their children appear" }],
      cursor: [{ on: "copy your page link", el: "Copy link", click: true }],
    },

    // ---- Students (4 scenes) ----
    {
      id: "std-cards", chapter: "Students", title: "Every child has a card",
      say: "Each enrolled child gets a card showing their year, subjects and a progress ring.",
      keys: ["Each enrolled child", "A card", "Year, subjects", "A progress ring"],
      shot: shot("t-students-cards", `${HUB}?tab=students`),
      cam: [{ on: "Each enrolled child", el: "li~A Ava", z: 1.7 }],
      rings: [{ on: "Each enrolled child", el: "li~A Ava" }],
    },
    {
      id: "std-groups", chapter: "Students", title: "Make a group",
      say: "Put children in a group. Then you can set homework, a quiz or a lesson for the whole group in one click.",
      keys: ["Put children in a group", "Set homework", "A quiz or a lesson", "In one click"],
      shot: shot("t-students-cards", `${HUB}?tab=students`),
      cam: [
        { on: "Put children in a group", el: "#hub-groups", z: 1.6 },
        { on: "in one click", el: "button~Set new homework for Year 3-5", z: 2.2 },
      ],
      rings: [{ on: "Put children in a group", el: "#hub-groups", off: "Then you can" }],
      cursor: [{ on: "in one click", el: "button~Set new homework for Year 3-5", click: true }],
    },
    {
      id: "std-support", chapter: "Students", title: "Support settings",
      say: "Open Edit details to switch off quiz timers, turn on calm mode, add extra time, enlarge text or read answers aloud.",
      keys: ["Open Edit details", "Switch off quiz timers", "Calm mode", "Extra time", "Enlarge text", "Read answers aloud"],
      shot: shot("t-support", `${HUB}?tab=students`),
      cam: [
        { on: "switch off quiz timers", el: "#hub-support-section", z: 1.9 },
      ],
      rings: [
        { on: "switch off quiz timers", el: "#hub-support-section" },
      ],
      cursor: [{ on: "switch off quiz timers", el: "No timer on quizzes", click: true }, { on: "turn on calm mode", el: "Calm mode", click: true }],
    },
    {
      id: "std-owner", chapter: "Students", title: "Only you can change them",
      say: "Families can't change these settings. Use the three dots on a card to pause or un-enrol a child.",
      keys: ["Can't change these::can't change these", "The three dots", "Pause", "Un-enrol"],
      shot: shot("t-students-menu", `${HUB}?tab=students`),
      cam: [{ on: "Use the three dots", el: "role:menu", z: 2.4 }],
      rings: [{ on: "Use the three dots", el: "role:menu" }],
      cursor: [{ on: "Use the three dots", el: "Actions for Ava", click: true }],
    },

    // ---- Lessons (4 scenes) ----
    {
      id: "les-library", chapter: "Lessons", title: "Your lesson library",
      say: "Lessons holds thousands of ready-made lessons, laid out on a curriculum map. Pick a subject and a year.",
      keys: ["Thousands of ready-made lessons::thousands of ready-made", "A curriculum map", "Pick a subject", "And a year"],
      shots: [
        { on: "", ...shot("t-lessons", `${HUB}?tab=notes`) },
        { on: "Pick a subject", ...shot("t-area", `${HUB}?tab=notes`) },
      ],
      cam: [
        { on: "laid out on a curriculum map", el: "#curriculum-card", z: 1.4 },
        { on: "Pick a subject", el: "#hub-cur-tab-science", z: 2.4 },
        { on: "and a year", el: "#curriculum-years", z: 2.2 },
      ],
      rings: [
        { on: "Pick a subject", el: "#hub-cur-tab-science", off: "and a year" },
        { on: "and a year", el: "#curriculum-years" },
      ],
      cursor: [{ on: "Pick a subject", el: "#hub-cur-tab-science", click: true }, { on: "and a year", el: "#hub-cur-year-4", click: true }],
    },
    {
      id: "les-find", chapter: "Lessons", title: "Find a lesson",
      say: "Each topic shows how many lessons it has. Or type in Search to jump straight to one.",
      keys: ["How many lessons", "Type in Search", "Jump straight to one"],
      shots: [
        { on: "", ...shot("t-area", `${HUB}?tab=notes`) },
        { on: "type in Search", ...shot("t-search", `${HUB}?tab=notes`) },
      ],
      cam: [
        { on: "Each topic shows", el: "#curriculum-strands", z: 1.8 },
        { on: "type in Search", el: "Search lessons or curriculum areas", z: 2.6 },
      ],
      rings: [{ on: "type in Search", el: "Search lessons or curriculum areas" }],
      cursor: [{ on: "type in Search", el: "Search lessons or curriculum areas" }],
    },
    {
      id: "les-preview", chapter: "Lessons", title: "Preview it",
      say: "Open a lesson to see its plan. Press Preview lesson to click through exactly what a child will see.",
      keys: ["Open a lesson", "See its plan", "Press Preview lesson", "What a child will see"],
      shot: shot("t-lesson-reader", `${HUB}?tab=notes`),
      cam: [
        { on: "Open a lesson", el: "h2~Neurones and synapses", z: 1.6 },
        { on: "Press Preview lesson", el: "Preview lesson", z: 2.8 },
      ],
      rings: [{ on: "Press Preview lesson", el: "Preview lesson" }],
      cursor: [{ on: "Press Preview lesson", el: "Preview lesson", click: true }],
    },
    {
      id: "les-build", chapter: "Lessons", title: "Build your own",
      say: "Press Create new lesson. Add slides, key words, multiple choice, sorting or matching, then Save. It joins your library.",
      keys: ["Create new lesson", "Add slides, key words::Add slides, key words", "Multiple choice, sorting", "Then Save", "Joins your library"],
      shots: [
        { on: "", ...shot("t-builder", `${HUB}?tab=notes`) },
        { on: "Add slides", ...shot("t-builder-blocks", `${HUB}?tab=notes`) },
        { on: "multiple choice", ...shot("t-builder-question", `${HUB}?tab=notes`) },
        { on: "then Save", ...shot("t-builder-preview", `${HUB}?tab=notes`) },
      ],
      cam: [{ on: "Add slides", el: "#slide-builder", z: 1.25 }],
    },

    // ---- Live and in-person lessons (5 scenes) ----
    {
      id: "live-modes", chapter: "Live lessons", title: "Three ways to teach", layout: "flow",
      say: "Teach on a video call, share to each child's device, or teach in person. You choose each time.",
      keys: ["A video call", "Each child's device", "Teach in person", "You choose each time"],
      nodes: [
        { on: "a video call", icon: "🎥", title: "Video call", sub: "Join the call inside the Hub", tone: "a" },
        { on: "each child's device", icon: "📱", title: "Share with children", sub: "Each child follows on their own device", tone: "b" },
        { on: "teach in person", icon: "🧑‍🏫", title: "Teach in person", sub: "Children beside you, no video", tone: "c" },
      ],
    },
    {
      id: "live-join", chapter: "Live lessons", title: "Start a video lesson",
      say: "Schedule it for the children you pick. At lesson time, check your camera and mic, then press Join. No other app needed.",
      keys: ["Schedule it", "Children you pick", "Camera and mic", "Press Join", "No other app"],
      shot: shot("t-live", `${HUB}?tab=live`),
      cam: [
        { on: "Schedule it", el: "Schedule video lesson", z: 2.6 },
        { on: "check your camera and mic", el: "button~Test camera", z: 2.6 },
        { on: "then press Join", el: "button~Opens in", z: 2.6 },
      ],
      rings: [
        { on: "Schedule it", el: "Schedule video lesson", off: "At lesson time" },
        { on: "check your camera and mic", el: "button~Test camera", off: "then press Join" },
        { on: "then press Join", el: "button~Opens in" },
      ],
      cursor: [{ on: "Schedule it", el: "Schedule video lesson", click: true }, { on: "then press Join", el: "button~Opens in", click: true }],
    },
    {
      id: "live-incall", chapter: "Live lessons", title: "Inside the call", layout: "grid",
      say: "Beside the video are your tabs: Lessons, Quiz, Homework, Flashcards and a whiteboard. Press Teach and every screen follows yours.",
      keys: ["Beside the video", "Lessons, Quiz, Homework", "Flashcards and a whiteboard", "Press Teach"],
      nodes: [
        { on: "Lessons,", icon: "📖", title: "Lessons", sub: "Press Teach", tone: "b" },
        { on: "Quiz", icon: "📝", title: "Quiz", tone: "d" },
        { on: "Homework", icon: "📓", title: "Homework", tone: "c" },
        { on: "Flashcards", icon: "🃏", title: "Flashcards" },
        { on: "a whiteboard", icon: "✏️", title: "Whiteboard", tone: "b" },
      ],
    },
    {
      id: "live-share", chapter: "Live lessons", title: "Share with children",
      say: "No video? Press Share with children. Each child follows on their own device and answers for themselves.",
      keys: ["Press Share with children", "Their own device", "Answers for themselves"],
      shot: shot("t-lesson-choice", `${HUB}?tab=notes`),
      cam: [{ on: "Press Share with children", el: "#lesson-start-remote-sync", z: 2.6 }],
      rings: [{ on: "Press Share with children", el: "#lesson-start-remote-sync" }],
      cursor: [{ on: "Press Share with children", el: "#lesson-start-remote-sync", click: true }],
    },
    {
      id: "live-person", chapter: "Live lessons", title: "Teach in person",
      say: "In the room? Tick who's there and tap in each child's answers. Parents see the results afterwards.",
      keys: ["Tick who's there", "Tap in each child's answers::tap in each", "Parents see the results"],
      shot: shot("t-oneroom", `${HUB}?tab=notes`),
      cam: [
        { on: "Tick who's there", el: "h2~Who's here", z: 2.2 },
        { on: "tap in each child's answers", el: "#golive-start", z: 2.6 },
      ],
      rings: [
        { on: "Tick who's there", el: "h2~Who's here", off: "and tap in" },
        { on: "tap in each child's answers", el: "#golive-start" },
      ],
      cursor: [{ on: "tap in each child's answers", el: "#golive-start", click: true }],
    },

    // ---- Tools (2 scenes) ----
    {
      id: "tools-try", chapter: "Tools", title: "Try the tools",
      say: "Tools, inside Lessons, has rulers, protractors, number lines and science diagrams. Open any tool to try it.",
      keys: ["Inside Lessons", "Rulers, protractors", "Number lines and science diagrams::number lines and science", "Open any tool"],
      shots: [
        { on: "", ...shot("t-tools", `${HUB}?tab=tools`) },
        { on: "Open any tool", ...shot("t-tool-open", `${HUB}?tab=tools`) },
      ],
      cam: [
        { on: "has rulers, protractors", el: "#hub-subtab-tools", z: 2.4 },
        { on: "Open any tool", el: "#floating-panel-body", z: 1.3 },
      ],
      rings: [{ on: "has rulers, protractors", el: "#hub-subtab-tools", off: "Open any tool" }],
      cursor: [{ on: "Open any tool", el: "Mark", click: true }],
    },
    {
      id: "tools-give", chapter: "Tools", title: "Give a tool to children",
      say: "In Preview lesson, open Tools for this lesson. Press Add tool to this question, or Use it on all questions.",
      keys: ["In Preview lesson", "Tools for this lesson", "Add tool to this question", "Use it on all questions"],
      shots: [
        { on: "", ...shot("t-preview-pill", `${HUB}?tab=notes`) },
        { on: "Press Add tool", ...shot("t-preview-picker", `${HUB}?tab=notes`) },
        { on: "or Use it on all questions", ...shot("t-preview-added", `${HUB}?tab=notes`) },
      ],
      cam: [
        { on: "open Tools for this lesson", el: "Tools for this lesson", z: 2.8 },
        { on: "Press Add tool", el: "#tool-picker", z: 2.6 },
        { on: "or Use it on all questions", el: "#tool-add-all", z: 3 },
      ],
      rings: [
        { on: "open Tools for this lesson", el: "Tools for this lesson", off: "Press Add tool" },
        { on: "Press Add tool", el: "#tool-picker", off: "or Use it on all questions" },
        { on: "or Use it on all questions", el: "#tool-add-all" },
      ],
      cursor: [{ on: "open Tools for this lesson", el: "Tools for this lesson", click: true }, { on: "or Use it on all questions", el: "#tool-add-all", click: true }],
    },

    // ---- Quizzes and flashcards (4 scenes) ----
    {
      id: "quiz-make", chapter: "Quizzes", title: "Make a quiz",
      say: "In Quizzes, press New quiz, pick topics from your question bank, and choose the subject and pass mark.",
      keys: ["Press New quiz", "Topics from your question bank::your question bank", "Subject and pass mark"],
      shots: [
        { on: "", ...shot("t-quizzes", `${HUB}?tab=quizzes`) },
        { on: "pick topics", ...shot("t-quiz-new", `${HUB}?tab=quizzes`) },
      ],
      cam: [
        { on: "press New quiz", el: "+ New quiz", z: 2.6 },
        { on: "pick topics", el: "#hub-assessment-builder", z: 1.3 },
        { on: "choose the subject", el: "#ha-subject", z: 2 },
      ],
      cursor: [{ on: "press New quiz", el: "+ New quiz", click: true }],
    },
    {
      id: "quiz-marked", chapter: "Quizzes", title: "Marked for you",
      say: "Quizzes are marked instantly. Written answers go to Marking, in your one queue.",
      keys: ["Marked instantly", "Written answers", "Marking, your one queue::marking, in your one queue"],
      shot: shot("t-quizzes", `${HUB}?tab=quizzes`),
      cam: [{ on: "Marking, in your one queue", el: "Marking", z: 2.2 }],
      rings: [{ on: "Marking, in your one queue", el: "Marking" }],
    },
    {
      id: "quiz-starting", chapter: "Quizzes", title: "Starting quiz",
      say: "New students sit a starting quiz once. There's no pass mark, so you see where each child begins.",
      keys: ["A starting quiz", "No pass mark::There's no pass mark", "Where each child begins"],
      shot: shot("t-starting", `${HUB}?tab=diagnostic`),
      cam: [{ on: "There's no pass mark", el: "#hub-placement-guide", z: 1.9 }],
      rings: [{ on: "There's no pass mark", el: "#hub-placement-guide" }],
    },
    {
      id: "quiz-flash", chapter: "Quizzes", title: "Flashcards",
      say: "Flashcards bring back the cards a child finds tricky. In a live lesson, you can present a deck on screen.",
      keys: ["Flashcards", "Cards a child finds tricky", "Present a deck on screen"],
      shot: shot("t-flashcards", `${HUB}?tab=flashcards`),
      cam: [{ on: "Flashcards bring back", el: "h2~Flashcards", z: 2 }, { on: "in a live lesson", el: "section~Student progress", z: 1.7 }],
      rings: [{ on: "in a live lesson", el: "section~Student progress" }],
    },

    // ---- Progress (3 scenes) ----
    {
      id: "prog-class", chapter: "Progress", title: "Your whole class",
      say: "Each row is a child. Each subject shows a coloured score. Filter by year or group, or search for a name.",
      keys: ["Each row is a child", "A coloured score", "Filter by year or group", "Search for a name"],
      shot: shot("t-progress", `${HUB}?tab=dashboard`),
      cam: [
        { on: "Each row is a child", el: "#hub-overview", z: 1.1 },
        { on: "or search for a name", el: "Search students", z: 2.4 },
      ],
      rings: [
        { on: "Each row is a child", el: "#hub-overview", off: "Filter by year" },
        { on: "or search for a name", el: "Search students" },
      ],
    },
    {
      id: "prog-child", chapter: "Progress", title: "One child",
      say: "Click a child to see each topic, how it's trending and their latest results. It updates from their marked work.",
      keys: ["Click a child", "Each topic", "How it's trending", "Their latest results"],
      shot: shot("t-progress-child", `${HUB}?tab=dashboard`),
      cam: [{ on: "to see each topic", el: "#hub-progress", z: 1.1 }],
    },
    {
      id: "prog-levels", chapter: "Progress", title: "Your levels",
      say: "Press Edit levels to rename levels or change where they start. Scores re-band instantly and no marks change.",
      keys: ["Press Edit levels", "Rename levels", "Change where they start", "No marks change"],
      shot: shot("t-progress-levels", `${HUB}?tab=dashboard`),
      cam: [{ on: "Press Edit levels", el: "Edit levels", z: 2.4 }],
      rings: [{ on: "Press Edit levels", el: "Edit levels" }],
      cursor: [{ on: "Press Edit levels", el: "Edit levels", click: true }],
    },
  ],
};
