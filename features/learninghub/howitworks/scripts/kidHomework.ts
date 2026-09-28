import type { HowScript } from "../types";
import { shot } from "../shot";

// CHILDREN: my homework. Plain words (KID_COPY): a child never sees "overdue". Cues name real elements on the phone screens.
const HUB = "/custdash/learninghub";
export const KID_HOMEWORK: HowScript = {
  role: "kid", slug: "children", audience: "For children", topic: "homework", emoji: "📓",
  title: "My homework", blurb: "Find your homework, do it and hand it in.", tagline: "Find it, do it, hand it in.",
  scenes: [
    {
      id: "hw-find", chapter: "Homework", title: "Find your homework",
      say: "Tap Homework to see what your tutor has set. Tap one to open it. It tells you what to do, and when it is due.",
      keys: ["Tap Homework", "Tap one to open it", "What to do", "When it is due::due"],
      shot: shot("k-homework", `${HUB}?tab=homework`),
      cam: [{ on: "Tap Homework", el: "h2~Homework for", z: 1.5 }, { on: "Tap one", el: "button~Do the worksheet", z: 1.9 }],
      rings: [{ on: "Tap one", el: "button~Do the worksheet" }],
      callouts: [{ on: "Tap Homework", el: "h2~Homework for", text: "Homework" }, { on: "Tap one", el: "button~Do the worksheet", text: "Tap one to open it" }],
      cursor: [{ on: "Tap one", el: "button~Do the worksheet", click: true }],
    },
    {
      id: "hw-do", chapter: "Homework", title: "Do it and hand it in",
      say: "Read what to do. Then do the worksheet, on the screen or on paper, and write your answer. When you are done, hand it in. You can change it until your tutor has looked at it.",
      keys: ["Read what to do", "Do the worksheet", "Hand it in", "Change it until marked::change it"],
      shot: shot("k-hw-open", `${HUB}?tab=homework`),
      cam: [{ on: "Read what to do", el: "#hub-hw-head", z: 1.6 }, { on: "Then do the worksheet", el: "#hub-hw-start-worksheet", z: 2.2 }, { on: "hand it in", el: "#hub-hw-ws-steps", z: 2 }],
      rings: [
        { on: "Then do the worksheet", el: "#hub-hw-start-worksheet", off: "When you are done" },
        { on: "When you are done", el: "#hub-hw-ws-steps" },
      ],
      callouts: [
        { on: "Then do the worksheet", el: "#hub-hw-start-worksheet", text: "Do the worksheet" },
        { on: "When you are done", el: "#hub-hw-ws-steps", text: "Hand it in" },
      ],
      cursor: [{ on: "Then do the worksheet", el: "#hub-hw-start-worksheet", click: true }],
    },
    {
      id: "hw-back", chapter: "Homework", title: "See how you did",
      say: "When your tutor has marked it, you will see your score and a message from them. Well done for trying!",
      keys: ["Your score", "A message from your tutor::message", "Well done!::Well done"],
      shot: shot("k-homework-marked", `${HUB}?tab=homework`),
      cam: [{ on: "When your tutor", el: "button~Fractions sheet", z: 2 }],
      rings: [{ on: "When your tutor", el: "button~Fractions sheet" }],
    },
  ],
};
