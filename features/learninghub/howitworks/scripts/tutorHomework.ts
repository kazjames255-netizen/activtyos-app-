import type { HowScript } from "../types";
import { shot } from "../shot";

// TUTORS: the Homework video. Checked against homework/HomeworkForm (Assign to, Title, Worksheet, Instructions, Videos, Due date — in
// that real order), hwPickers (Interactive / PDF only), TutorHomework (task cards: Waiting / To mark / Marked; views To mark, Inbox,
// Results), StudentHomework (hand-in text + photos / files, changeable until marked) and MarkDialog (score, out of, feedback, Mark &
// next, "The family is notified when you save"). Cues name real elements; their rectangles were recorded with each capture.
const HUB = "/freelancer/learninghub";
const KID = "/custdash/learninghub";

export const TUTOR_HOMEWORK: HowScript = {
  role: "tutor", slug: "tutors", audience: "For tutors", topic: "homework", emoji: "📓",
  title: "Homework: set it, collect it, mark it",
  blurb: "Set homework, attach a worksheet, see the hand-ins, and mark them.",
  tagline: "Set homework, and mark what comes back.",
  tryIt: { sub: "set" },
  scenes: [
    {
      id: "hw-set", chapter: "Set it", title: "Set homework",
      say: "In Homework, press Set homework. Choose a group, or tick individual children.",
      keys: ["Press Set homework", "Choose a group", "Or tick individual children"],
      shots: [
        { on: "", ...shot("t-hw-form-0", `${HUB}?tab=homework`) },
        { on: "Choose a group", ...shot("t-hw-form-who", `${HUB}?tab=homework`) },
      ],
      cam: [
        { on: "press Set homework", el: "#hub-homework-form", z: 1.25 },
        { on: "Choose a group", el: "Year 3-5", z: 2.4 },
      ],
      rings: [{ on: "Choose a group", el: "Year 3-5", off: "or tick individual" }],
      cursor: [{ on: "Choose a group", el: "Year 3-5", click: true }],
    },
    {
      id: "hw-add-details", chapter: "Set it", title: "Add the details",
      say: "Add a title, then write the instructions: what to do and what to hand in. Then pick the due date.",
      keys: ["Add a title", "Write the instructions", "What to hand in", "Pick the due date"],
      shots: [
        { on: "", ...shot("t-hw-form-a", `${HUB}?tab=homework`) },
        { on: "write the instructions", ...shot("t-hw-form-b", `${HUB}?tab=homework`) },
        { on: "Then pick the due date", ...shot("t-hw-due", `${HUB}?tab=homework`) },
      ],
      cam: [
        { on: "Add a title", el: "#hub-hw-title", z: 2.6 },
        { on: "write the instructions", el: "#hub-hw-instructions", z: 2.3 },
        { on: "Then pick the due date", el: "#hub-hw-due", z: 2.6 },
      ],
      rings: [
        { on: "Add a title", el: "#hub-hw-title", off: "write the instructions" },
        { on: "write the instructions", el: "#hub-hw-instructions", off: "Then pick" },
        { on: "Then pick the due date", el: "#hub-hw-due" },
      ],
      cursor: [{ on: "Add a title", el: "#hub-hw-title", click: true }, { on: "write the instructions", el: "#hub-hw-instructions", click: true }, { on: "Then pick the due date", el: "#hub-hw-due", click: true }],
    },
    {
      id: "hw-worksheet", chapter: "Set it", title: "Attach a worksheet",
      say: "Tick worksheets from your library. Interactive ones mark themselves. PDFs are answered in writing or with a photo.",
      keys: ["Tick worksheets", "From your library", "Interactive: mark themselves::mark themselves", "PDFs: writing or a photo::writing or with a photo"],
      shots: [
        { on: "", ...shot("t-hw-worksheet", `${HUB}?tab=homework`) },
        { on: "Interactive ones", ...shot("t-hw-worksheet-picked", `${HUB}?tab=homework`) },
      ],
      cam: [
        { on: "Tick worksheets", el: "#hub-hw-ws-picker", z: 1.8 },
        { on: "Interactive ones", el: "#hub-hw-ws-cards", z: 1.9 },
      ],
      cursor: [{ on: "Tick worksheets", el: "Choose Neurones and synapses", click: true }],
    },
    {
      id: "hw-assign", chapter: "Set it", title: "Send it",
      say: "Press Assign homework. Each child gets their own copy, and families are told straight away.",
      keys: ["Press Assign homework", "Their own copy", "Families told straight away::told straight away"],
      shot: shot("t-hw-assign", `${HUB}?tab=homework`),
      cam: [{ on: "press Assign homework", el: "Assign homework", z: 2.8 }],
      rings: [{ on: "press Assign homework", el: "Assign homework" }],
      cursor: [{ on: "press Assign homework", el: "Assign homework", click: true }],
    },
    {
      id: "hw-tasks", chapter: "Collect it", title: "Track it",
      say: "Each homework card shows who's still working, who's handed in and who's marked.",
      keys: ["Each homework card", "Still working", "Handed in", "Marked"],
      shot: shot("t-homework", `${HUB}?tab=homework`),
      cam: [{ on: "shows who's still working", el: "Waiting", z: 2 }],
    },
    {
      id: "hw-handin", chapter: "Collect it", title: "How children hand in",
      say: "Children do the worksheet on screen, or type, add a photo or PDF, then press Hand in homework.",
      keys: ["Do the worksheet on screen", "Or type, add a photo::or type, add a photo", "A photo or PDF", "Press Hand in homework"],
      shot: shot("k-hw-open", `${KID}?tab=homework`),
      cam: [
        { on: "Children do the worksheet", el: "#hub-hw-worksheet", z: 1.7 },
        { on: "then press Hand in homework", el: "#hub-hw-ws-steps", z: 2 },
      ],
      rings: [
        { on: "Children do the worksheet", el: "#hub-hw-worksheet", off: "or type" },
        { on: "then press Hand in homework", el: "#hub-hw-ws-steps" },
      ],
      cursor: [{ on: "Children do the worksheet", el: "#hub-hw-start-worksheet", click: true }],
    },
    {
      id: "hw-mark", chapter: "Mark it", title: "Mark it",
      say: "Everything to mark is in To mark, oldest first. Add a score and feedback, then press Mark and next.",
      keys: ["Everything to mark", "Oldest first", "Score and feedback", "Mark and next"],
      shots: [
        { on: "", ...shot("t-mark", `${HUB}?tab=homework&sub=mark`) },
        { on: "Add a score and feedback", ...shot("t-mark-open", `${HUB}?tab=homework`) },
      ],
      cam: [
        { on: "Everything to mark is in To mark", el: "#hub-mark-queue", z: 1.6 },
        { on: "Add a score", el: "#hub-mark-score", z: 2.4 },
        { on: "and feedback", el: "#hub-mark-feedback", z: 2.2 },
        { on: "press Mark and next", el: "Mark & next", z: 2.8 },
      ],
      rings: [
        { on: "Everything to mark is in To mark", el: "#hub-mark-queue", off: "Add a score" },
        { on: "Add a score", el: "#hub-mark-score", off: "and feedback" },
        { on: "and feedback", el: "#hub-mark-feedback", off: "then press Mark" },
        { on: "press Mark and next", el: "Mark & next" },
      ],
      cursor: [{ on: "Add a score", el: "#hub-mark-score", click: true }, { on: "press Mark and next", el: "Mark & next", click: true }],
    },
    {
      id: "hw-results", chapter: "Results", title: "Everyone sees it",
      say: "The child sees their score and your feedback. Their family sees it in the Learning Hub too.",
      keys: ["The child sees", "Score and your feedback::score and your feedback", "Their family sees it", "The Learning Hub"],
      shots: [
        { on: "", ...shot("k-homework-marked", `${KID}?tab=homework`) },
        { on: "Their family sees it", ...shot("p-homework-marked", `${KID}?tab=homework`) },
      ],
      cam: [{ on: "The child sees", el: "button~Fractions sheet", z: 2 }, { on: "Their family sees it", el: "h2~Homework for", z: 1.5 }],
      rings: [{ on: "The child sees", el: "button~Fractions sheet", off: "Their family" }, { on: "Their family sees it", el: "h2~Homework for" }],
    },
  ],
};
