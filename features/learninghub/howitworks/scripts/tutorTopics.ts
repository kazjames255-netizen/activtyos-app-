import type { HowScript, Scene } from "../types";
import { TUTOR } from "./tutor";

// The tutor explainer is a LIBRARY of short topic videos (a chooser lists them), in the same order as the Hub's own tabs: Home, Families,
// Students, Lessons, Live lessons, Tools, Quizzes & flashcards, Homework, Progress, Messages. The scenes are written once in tutor.ts;
// each topic picks the ones it needs. Homework and Messages have their own files (tutorHomework.ts, tutorMessages.ts) because they are
// the longest / newest and change most often with the app.
const pick = (ids: string[]): Scene[] => ids.map((id) => TUTOR.scenes.find((s) => s.id === id) ?? (() => { throw new Error(`tutor scene ${id} missing`); })());
const base = { role: "tutor" as const, slug: "tutors" as const, audience: "For tutors" };

export const TUTOR_TOPICS_BEFORE_HOMEWORK: HowScript[] = [
  { ...base, topic: "home", emoji: "🏠", title: "Your Home screen", blurb: "Your areas, Needs your attention, and How it works.", tagline: "Where you start every day.", tryIt: { sub: "home" }, scenes: pick(["home-tour", "home-attention", "home-help"]) },
  { ...base, topic: "families", emoji: "👨‍👩‍👧", title: "Getting families on your roster", blurb: "The three ways a family joins you: booking, an invite link, or your public page.", tagline: "Bring families onto your roster.", tryIt: { sub: "enrol" }, scenes: pick(["fam-ways", "fam-book", "fam-invite", "fam-page"]) },
  { ...base, topic: "students", emoji: "🧑", title: "Your students", blurb: "Each child's card, groups, and the support settings only you can change.", tagline: "Look after your roster.", tryIt: { sub: "students" }, scenes: pick(["std-cards", "std-groups", "std-support", "std-owner"]) },
  { ...base, topic: "lessons", emoji: "📚", title: "Lessons and the curriculum", blurb: "Find a ready-made lesson, open it, or build your own with the slide builder.", tagline: "Find, open and build lessons.", tryIt: { sub: "lessons" }, scenes: pick(["les-library", "les-find", "les-preview", "les-build"]) },
  { ...base, topic: "live", emoji: "🎥", title: "Live and in-person lessons", blurb: "Three ways to teach, video lessons, what is inside the call, and teaching in person.", tagline: "Teach live, online or in the room.", tryIt: { sub: "live" }, scenes: pick(["live-modes", "live-join", "live-incall", "live-share", "live-person"]) },
  { ...base, topic: "tools", emoji: "🧰", title: "Tools", blurb: "The Tools area, and giving a tool to your children.", tagline: "Tools for your children to use.", tryIt: { sub: "tools" }, scenes: pick(["tools-try", "tools-give"]) },
  { ...base, topic: "quizzes", emoji: "📝", title: "Quizzes and flashcards", blurb: "Build a quiz, marking, starting quizzes and flashcards.", tagline: "Check what children know.", tryIt: { sub: "quizzes" }, scenes: pick(["quiz-make", "quiz-marked", "quiz-starting", "quiz-flash"]) },
];
// Homework (tutorHomework.ts) and Messages (tutorMessages.ts) slot in after this, then Progress: the full order is set in scripts/index.ts.
export const TUTOR_TOPICS_AFTER_HOMEWORK: HowScript[] = [
  { ...base, topic: "progress", emoji: "📈", title: "Progress", blurb: "Your whole class at a glance, one child in detail, and your own levels.", tagline: "See how each child is doing.", tryIt: { sub: "progress" }, scenes: pick(["prog-class", "prog-child", "prog-levels"]) },
];
/** Old topic slugs that were renamed, so an existing link / bookmark still lands somewhere sensible. */
export const TOPIC_ALIAS: Record<string, string> = { roster: "families", diagnostic: "quizzes", starting: "quizzes" };
