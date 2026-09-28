import type { HowScript } from "../types";
import { shot } from "../shot";

// PARENTS: the short Homework video. Checked against homework/StudentHomework (due / handed in / marked chips, instructions, worksheet,
// hand-in) and the Home verdict. Coordinates are percentages of the screenshot.
const HUB = "/custdash/learninghub";
export const PARENT_HOMEWORK: HowScript = {
  role: "parent", slug: "parents", audience: "Learning Hub for parents", topic: "homework", emoji: "📓",
  title: "Homework in the Learning Hub", blurb: "What has been set, when it's due, how your child hands it in, and where the marks appear.", tagline: "See what's set, what's due and how it went.",
  scenes: [
    {
      id: "hw-list", chapter: "Homework", title: "What's been set",
      say: "The Homework tab lists everything your child's tutor has set. Each piece shows when it's due, and whether it's been handed in or marked. If something is overdue, you'll see it here, and on the Home verdict. New homework appears here as soon as it's set.",
      keys: ["Everything that's been set::has set", "When it's due", "Handed in, or marked::handed in", "Overdue shows here::overdue"],
      shot: shot("p-homework", `${HUB}?tab=homework`),
      cam: [{ on: "The Homework tab", el: "h2~Homework for", z: 1.5 }, { on: "Each piece shows", el: "button~Overdue reading", z: 1.9 }],
      rings: [{ on: "Each piece shows", el: "button~Overdue reading", off: "New homework" }],
      cursor: [{ on: "Each piece shows", el: "button~Overdue reading", click: true }],
    },
    {
      id: "hw-open", chapter: "Homework", title: "Open a piece of homework",
      say: "Open one to see the instructions, and any worksheet or lesson to do first. Your child can type an answer, or add a photo or a PDF, then press Hand in homework. They can change it until the tutor marks it.",
      keys: ["Instructions and worksheet::the instructions", "Type, or add a photo::type an answer", "Hand in homework", "Change it until marked::until the tutor marks it"],
      shot: shot("k-hw-open", `${HUB}?tab=homework`),
      cam: [{ on: "Open one", el: "#hub-hw-head", z: 1.6 }, { on: "any worksheet", el: "#hub-hw-worksheet", z: 1.7 }],
      rings: [{ on: "any worksheet", el: "#hub-hw-worksheet", off: "Your child can" }],
      callouts: [
        { on: "Open one", el: "#hub-hw-head", text: "Instructions" },
        { on: "any worksheet", el: "#hub-hw-worksheet", text: "Worksheet to do" },
        { on: "Your child can type", el: "#hub-hw-ws-steps", text: "Type, photo or PDF" },
      ],
    },
    {
      id: "hw-marks", chapter: "Homework", title: "Marks and feedback",
      say: "When the tutor has marked it, the score and their feedback appear under the homework, and you're told. Your child's progress picks it up too, so you can see how they're getting on.",
      keys: ["The score and feedback::score", "You're told", "Progress picks it up::progress"],
      shot: shot("p-homework-marked", `${HUB}?tab=homework`),
      cam: [{ on: "the score", el: "h2~Homework for", z: 1.5 }],
      rings: [{ on: "the score", el: "h2~Homework for" }],
    },
  ],
};
