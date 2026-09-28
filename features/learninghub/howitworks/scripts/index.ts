import type { HowBand, HowRole, HowScript } from "../types";
import { TUTOR } from "./tutor";
import { TUTOR_TOPICS_BEFORE_HOMEWORK, TUTOR_TOPICS_AFTER_HOMEWORK, TOPIC_ALIAS } from "./tutorTopics";
import { TUTOR_HOMEWORK } from "./tutorHomework";
import { TUTOR_MESSAGES } from "./tutorMessages";
import { PARENT } from "./parent";
import { PARENT_HOMEWORK } from "./parentHomework";
import { PARENT_TOPICS_A, PARENT_TOPICS_B } from "./parentTopics";
import { KID } from "./kid";
import { KID_KS1 } from "./kidKs1";
import { KID_HOMEWORK } from "./kidHomework";

/** One entry per role: its heading / main video. Tutors' is only the library heading (the chooser); the videos are TOPICS below. */
export const SCRIPT_LIST: HowScript[] = [TUTOR, PARENT, KID];
/** The tutor library, in the order the chooser shows it — the same order as the Hub's own tabs: Home, Families, Students, Lessons, Live
 *  lessons, Tools, Quizzes & flashcards, Homework, Progress, Messages (10 videos). */
export const TUTOR_LIBRARY: HowScript[] = [...TUTOR_TOPICS_BEFORE_HOMEWORK, TUTOR_HOMEWORK, ...TUTOR_TOPICS_AFTER_HOMEWORK, TUTOR_MESSAGES];
/** The parent library, in the order the chooser shows it. */
export const PARENT_LIBRARY: HowScript[] = [...PARENT_TOPICS_A, PARENT_HOMEWORK, ...PARENT_TOPICS_B];
/** Children have one main video (with a Reception-Year 2 version) and a short homework one. */
export const EXTRA_TOPICS: Record<"parent" | "kid", HowScript[]> = { parent: PARENT_LIBRARY, kid: [KID_HOMEWORK] };
/** Tutors and parents pick a video from a chooser; a child goes straight to their video (homework is offered at the end). */
export const hasChooser = (role: HowRole): boolean => role !== "kid";
export const topicsFor = (role: HowRole): HowScript[] => (role === "tutor" ? TUTOR_LIBRARY : role === "parent" ? PARENT_LIBRARY : [KID_HOMEWORK]);
/** The role's own heading (title + tagline over the chooser). */
export const headingFor = (role: HowRole): HowScript => SCRIPT_LIST.find((s) => s.role === role) ?? TUTOR;
export const scriptFor = (role: HowRole, band?: HowBand | null, topic?: string | null): HowScript => {
  if (topic) { const wanted = (role === "tutor" && TOPIC_ALIAS[topic]) || topic; const t = topicsFor(role).find((s) => s.topic === wanted); if (t) return t; }
  if (role === "tutor") return TUTOR_LIBRARY[0];
  if (role === "parent") return PARENT_LIBRARY[0];
  return role === "kid" && band === "ks1" ? KID_KS1 : SCRIPT_LIST.find((s) => s.role === role) ?? TUTOR;
};
/** Year group text -> the child explainer band (Reception to Year 2 = ks1). */
export const bandFromYear = (yearGroup?: string | null): HowBand => (/reception|nursery/i.test(yearGroup ?? "") || (Number(/(\d{1,2})/.exec(yearGroup ?? "")?.[1]) <= 2 && /\d/.test(yearGroup ?? "")) ? "ks1" : "std");
/** Which explainers a viewer of `role` may open: their own; a parent may also see what their child sees. Tutors and children only see their own. */
export const ALLOWED: Record<HowRole, HowRole[]> = { tutor: ["tutor"], parent: ["parent", "kid"], kid: ["kid"] };
/** The topic (in role's library) that holds a scene id, so an old ?scene= link still lands somewhere sensible. */
export const topicOfScene = (role: HowRole, scene?: string | null): string | undefined => (scene ? topicsFor(role).find((s) => s.scenes.some((x) => x.id === scene))?.topic : undefined);
