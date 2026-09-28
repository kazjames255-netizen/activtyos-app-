import type { HowScript } from "../types";
import { shot } from "../shot";

// TUTORS: Messages. Checked against QuestionsPanel.tsx (New message, one folder per child, a General folder for a plain message, the
// thread pane and its Reply / Send) and doubtsApi.ts (a hand-in or a mark never needs its own message — the family is told automatically).
const HUB = "/freelancer/learninghub";

export const TUTOR_MESSAGES: HowScript = {
  role: "tutor", slug: "tutors", audience: "For tutors", topic: "messages", emoji: "💬",
  title: "Messages",
  blurb: "Every conversation with a family, and how a reply reaches them.",
  tagline: "Talk with families, one thread per child.",
  tryIt: { sub: "messages" },
  scenes: [
    {
      id: "msg-all", chapter: "Messages", title: "All in one place",
      say: "Messages keeps every conversation with families in one place, grouped by child.",
      keys: ["Every conversation", "One place", "Grouped by child"],
      shot: shot("t-messages", `${HUB}?tab=questions`),
      cam: [{ on: "grouped by child", el: "#question-folder-child", z: 1.6 }],
      rings: [{ on: "grouped by child", el: "#question-folder-child" }],
    },
    {
      id: "msg-reply", chapter: "Messages", title: "Reply",
      say: "Open a conversation, type your reply and press Send. The parent gets a notification.",
      keys: ["Open a conversation", "Type your reply", "Press Send", "A notification"],
      shots: [
        { on: "", ...shot("t-messages", `${HUB}?tab=questions`) },
        { on: "type your reply", ...shot("t-msg-reply", `${HUB}?tab=questions`) },
      ],
      cam: [
        { on: "Open a conversation", el: "#question-thread-open", z: 1.8 },
        { on: "type your reply", el: "#question-thread-reply", z: 2.4 },
        { on: "press Send", el: "#question-thread-send", z: 2.8 },
      ],
      rings: [
        { on: "type your reply", el: "#question-thread-reply", off: "and press Send" },
        { on: "press Send", el: "#question-thread-send" },
      ],
      cursor: [{ on: "type your reply", el: "#question-thread-reply" }, { on: "press Send", el: "#question-thread-send", click: true }],
    },
    {
      id: "msg-auto", chapter: "Messages", title: "Updates are automatic",
      say: "You don't need to message about homework or marks. Families are told automatically.",
      keys: ["No need to message::You don't need to message", "Homework or marks", "Told automatically"],
      shot: shot("t-msg-new", `${HUB}?tab=questions`),
      cam: [{ on: "Families are told automatically", el: "#question-new-message", z: 1.6 }],
    },
  ],
};
