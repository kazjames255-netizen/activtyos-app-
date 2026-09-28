import type { HowScript } from "../types";
import { shot } from "../shot";

// PARENTS (the Learning Hub, /custdash/learninghub). Plain words a parent uses (see family/parentCopy.ts): no "mastery", "diagnostic" or "placement".
// Verified against StudentHome (verdict + week summary + Ask your tutor), HubHero (child switcher), FamilyInviteClaim, ProgressReport and KidMode.
const HUB = "/custdash/learninghub";

export const PARENT: HowScript = {
  role: "parent",
  slug: "parents",
  title: "Your child's Learning Hub",
  tagline: "See your child's lessons and homework, know at a glance how they're doing, and print a progress report.",
  audience: "Learning Hub for parents",
  scenes: [
    {
      id: "getting-in", chapter: "Getting started", title: "How your child gets in", layout: "flow",
      say: "Your child appears in the Learning Hub once your tutor has enrolled them. That happens when you book with your tutor, and they add your child. Or, your tutor can send you a private link, and you add your child yourself. Your tutor decides which subjects your child can see.",
      keys: ["Enrolled by your tutor::enrolled", "Book with your tutor::book with your tutor", "Or a private link::private link", "Your tutor picks the subjects::which subjects"],
      nodes: [
        { on: "when you book", icon: "🛒", title: "Book with your tutor", sub: "They add your child", tone: "a" },
        { on: "Or, your tutor", icon: "🔗", title: "Or use their private link", sub: "You add your child yourself", tone: "b" },
        { on: "Your tutor decides", icon: "🏫", title: "Learning Hub opens", sub: "With the subjects your tutor chose", tone: "c" },
      ],
    },
    {
      id: "invite", chapter: "Getting started", title: "If your tutor sent you a link",
      say: "If your tutor sends you a private link, open it while you're signed in to your parent account. Or sign up first. You'll see which tutor invited you. Choose which of your children to enrol, and they join straight away. The link works for one family, and lasts thirty days.",
      keys: ["Open the private link::private link", "Signed in as a parent::signed in", "Choose which children::choose which of your children", "Thirty days, one family::thirty days"],
      shot: shot("p-invite", `${HUB}?invite=…`),
      cam: [
        { on: "You'll see which tutor", el: "tag:h1", z: 2.2 },
        { on: "Choose which", el: "Enrol", z: 2.4 },
      ],
      rings: [
        { on: "You'll see which tutor", el: "tag:h1", off: "Choose which" },
        { on: "Choose which", el: "Enrol" },
      ],
      cursor: [{ on: "Choose which", el: "Enrol", click: true }],
    },
    {
      id: "home", chapter: "Your child's week", title: "Home: the one-line verdict",
      say: "Home starts with one line, the verdict. It says On track, All done this week, or how many homework tasks are overdue. Tap it to go straight to where you can help. Underneath, you see this week's quizzes done, homework handed in, and what's waiting to be marked. More than one child? Switch between them at the top.",
      keys: ["One line, the verdict::one line", "On track, or overdue::On track", "This week at a glance::Underneath", "Switch between children::Switch between them"],
      shot: shot("p-home", `${HUB}?tab=home`),
      cam: [
        { on: "Home starts", el: "#hub-parent-summary", z: 1.4 },
        { on: "It says", el: "#hub-parent-verdict", z: 2.4 },
        { on: "Underneath", el: "#hub-parent-summary-text", z: 2.4 },
        { on: "More than one child", el: "button~B Ben", z: 2.6 },
      ],
      rings: [
        { on: "It says", el: "#hub-parent-verdict", off: "Underneath" },
        { on: "Underneath", el: "#hub-parent-summary-text", off: "More than one child" },
        { on: "More than one child", el: "button~B Ben" },
      ],
      cursor: [{ on: "Tap it", el: "#hub-parent-verdict", click: true }],
    },
    {
      id: "lessons", chapter: "Your child's week", title: "Lessons",
      say: "Lessons shows what your tutor has shared. Open one and your child steps through it one idea at a time, with a quiz at the end.",
      keys: ["What your tutor shared::Lessons shows", "One idea at a time", "A quiz at the end::quiz at the end"],
      shot: shot("p-lessons", `${HUB}?tab=notes`),
      cam: [{ on: "Lessons shows", el: "#curriculum-sticker-book", z: 1.5 }, { on: "Open one", el: "button~Position and direction", z: 2.6 }],
      rings: [{ on: "Open one", el: "button~Position and direction" }],
      cursor: [{ on: "Open one", el: "button~Position and direction", click: true }],
    },
    {
      id: "live", chapter: "Your child's week", title: "Live lessons",
      say: "When your tutor has a live lesson coming up, it shows in Live lessons. When it opens, you check the camera and microphone first, then press Join. If your tutor shares a lesson to your child's own device, a banner appears so they can join it.",
      keys: ["Live lessons, coming up::Live lessons", "Camera and microphone check::camera and microphone", "Press Join", "A banner to join::banner"],
      shot: shot("p-live", `${HUB}?tab=live`),
      cam: [{ on: "When it opens", el: "tag:h2", z: 1.6 }],
    },
    {
      id: "progress", chapter: "Progress", title: "How they're doing",
      say: "The Progress tab shows how your child is doing. You see their level, on your tutor's own scale, and what it takes to reach the next one. Tap Where does this level come from, for a plain explanation. And My curriculum journey shows how far through each subject they are.",
      keys: ["How your child is doing::how your child is doing", "Their level, in plain words::their level", "Where does this level come from", "My curriculum journey"],
      shot: shot("p-progress", `${HUB}?tab=dashboard`),
      cam: [
        { on: "You see their level", el: "#hub-attainment", z: 1.9 },
        { on: "Tap Where does", el: "button~Where does this level", z: 3 },
        { on: "And My curriculum journey", el: "#curriculum-rings", z: 1.7 },
      ],
      rings: [
        { on: "You see their level", el: "#hub-attainment", off: "Tap Where does" },
        { on: "Tap Where does", el: "button~Where does this level", off: "And My curriculum" },
        { on: "And My curriculum journey", el: "#curriculum-rings" },
      ],
      cursor: [{ on: "Tap Where does", el: "button~Where does this level", click: true }],
    },
    {
      id: "report", chapter: "Progress", title: "A printable progress report",
      say: "Need something for a meeting, or the fridge? Press Progress report. You get a clean one-page summary for one child, with their subjects and next steps. Print it, or save it as a PDF from your browser's print window.",
      keys: ["Press Progress report", "A one-page summary::one-page summary", "Subjects and next steps::next steps", "Print, or save as PDF::Print it"],
      shots: [
        { on: "", ...shot("p-progress", `${HUB}?tab=dashboard`) },
        { on: "You get a clean", ...shot("p-report", `${HUB}?tab=dashboard`) },
      ],
      cam: [
        { on: "Press Progress report", el: "#hub-report-open", z: 3 },
        { on: "You get a clean", el: "tag:h1", z: 1.5 },
        { on: "with their subjects", el: "section~Subjects", z: 2.2 },
        { on: "and next steps", el: "section~Next steps", z: 2.2 },
      ],
      rings: [
        { on: "Press Progress report", el: "#hub-report-open", off: "You get a clean" },
        { on: "with their subjects", el: "section~Subjects", off: "and next steps" },
        { on: "and next steps", el: "section~Next steps" },
      ],
      cursor: [{ on: "Press Progress report", el: "#hub-report-open", click: true }],
    },
    {
      id: "ask", chapter: "Help", title: "Ask your tutor",
      say: "Got a question? Use Ask your tutor on Home, or the Messages tab. Your tutor's reply comes back to you there. And you can always press How it works, at the top, to watch this again.",
      keys: ["Ask your tutor", "Or the Messages tab::Messages", "How it works, any time::How it works"],
      shot: shot("p-home", `${HUB}?tab=home`),
      cam: [
        { on: "Use Ask your tutor", el: "Ask your tutor", z: 2.8 },
        { on: "How it works, at the top", el: "#hiw-open", z: 3 },
      ],
      rings: [
        { on: "Use Ask your tutor", el: "Ask your tutor", off: "How it works, at the top" },
        { on: "How it works, at the top", el: "#hiw-open" },
      ],
      cursor: [{ on: "Use Ask your tutor", el: "Ask your tutor", click: true }],
    },
    {
      id: "hand-over", chapter: "Your child's own space", title: "Hand over to your child",
      say: "When your child is ready to learn, press Hand over to them. The screen becomes their own simple space, with just their lessons, quizzes and homework. To come back to your portal, a grown-up answers a quick sum. To see exactly what your child sees, choose What your child sees, at the top of this window.",
      keys: ["Press Hand over", "Their own simple space", "A quick sum to return::quick sum", "What your child sees"],
      shot: shot("p-handover", `${HUB}?tab=home`),
      cam: [{ on: "press Hand over", el: "#hub-hand-over-toggle", z: 3 }],
      rings: [{ on: "press Hand over", el: "#hub-hand-over-toggle", off: "The screen becomes" }],
      cursor: [{ on: "press Hand over", el: "#hub-hand-over-toggle", click: true }],
    },
  ],
};
