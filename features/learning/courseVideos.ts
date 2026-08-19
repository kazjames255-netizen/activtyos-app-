import type { CourseDoc, Lesson, MotionScene } from "./courseContent";
import { GENERATED_COURSE_VIDEOS } from "./courseVideos.generated";
import { NEW_COURSE_VIDEOS } from "./courseContent.newcourses";

/*
 * Animated videos embedded into every course: one at the start (intro) and one
 * in the middle. Authored as scene DATA against the generic templates in
 * motionKit (visual = gtitle/gspot/gcards/gcheck/gsteps/gstat/galert/gcompare/
 * gquote/gclose) with a topical icon. `withVideos(course)` splices them in at
 * view time, so the giant generated course file stays untouched.
 *
 * Scene schema:
 *   { visual, seconds, narration, keys[], props? }
 *   keys  = short phrases (substrings of narration, in order) that pop up in sync
 *   props = { icon, icons?[], items?[], value?, sub?, good?[], bad?[] }
 * Icons: shield shield-tick alert heart cross document clipboard people child
 *   brain lock phone food flame pill droplet sun germ hand globe chat book box
 *   lift puzzle eye bell clock tick exit extinguisher lungs wave handshake
 */
export type MotionBlock = { k: "motion"; title?: string; voice?: boolean; accent?: string; scenes: MotionScene[] };
type Sc = { visual: string; seconds: number; narration: string; keys: string[]; props?: Record<string, unknown> };
const mk = (title: string, scenes: Sc[]): MotionBlock => ({
  k: "motion", title, scenes: scenes.map((s, i) => ({ id: `v${i}`, ...s })),
});

export const COURSE_VIDEOS: Record<string, { intro?: MotionBlock; mid?: MotionBlock }> = {
  // ————— KCSIE 2026 — What's Changed (c40) — from the NSPCC CASPAR briefing —————
  c40: {
    intro: mk("KCSIE 2026 in two minutes", [
      { visual: "gtitle", seconds: 6, narration: "Keeping Children Safe in Education. Here's what's new for 2026.", keys: ["Keeping Children Safe", "new for 2026"], props: { icon: "book" } },
      { visual: "gstat", seconds: 7, narration: "The 2026 guidance replaces the old edition on the first of September.", keys: ["replaces the old edition", "first of September"], props: { value: "1 Sept", sub: "KCSIE 2026 comes into force" } },
      { visual: "gspot", seconds: 7, narration: "It's the statutory framework for schools. We're not a school, but we borrow the best of it.", keys: ["statutory framework", "borrow the best"], props: { icon: "shield" } },
      { visual: "gcards", seconds: 9, narration: "Four big areas changed: child-on-child abuse, online safety, recruitment, and facilities.", keys: ["child-on-child abuse", "online safety", "recruitment", "facilities"], props: { items: ["Child-on-child", "Online & AI", "Recruitment", "Facilities"], icons: ["people", "phone", "document", "shield"] } },
      { visual: "galert", seconds: 7, narration: "The biggest one: supervised staff and volunteers can now be in regulated activity.", keys: ["supervised staff", "regulated activity"], props: { icon: "document" } },
      { visual: "gclose", seconds: 6, narration: "New guidance, same job: notice, record, report.", keys: ["notice", "record", "report"], props: { icon: "shield-tick" } },
    ]),
    mid: mk("The changes that matter for us", [
      { visual: "gtitle", seconds: 6, narration: "The 2026 changes that actually matter for camps and clubs.", keys: ["2026 changes", "camps and clubs"], props: { icon: "clipboard" } },
      { visual: "gsteps", seconds: 11, narration: "Volunteering that teaches or supervises over three days, or overnight, now needs an enhanced DBS with a barred-list check.", keys: ["over three days", "overnight", "enhanced DBS", "barred-list check"], props: { items: ["Teaches", "3+ days", "Overnight", "Barred-list DBS"] } },
      { visual: "gcheck", seconds: 10, narration: "Online safety adds three things: a mobile-phone policy, AI-use guidance, and a yearly filtering review.", keys: ["mobile-phone policy", "AI-use guidance", "yearly filtering review"], props: { items: ["Mobile-phone policy", "AI-use guidance", "Yearly filtering review"] } },
      { visual: "galert", seconds: 8, narration: "Every nude-image incident needs a safeguarding response — even if it was consensual.", keys: ["nude-image incident", "safeguarding response", "consensual"], props: { icon: "phone" } },
      { visual: "gcards", seconds: 9, narration: "Also new: spotting young carers, medical-condition risks, and cover when your DSL is away.", keys: ["young carers", "medical-condition risks", "DSL is away"], props: { items: ["Young carers", "Medical risk", "DSL cover"], icons: ["heart", "pill", "people"] } },
      { visual: "gclose", seconds: 6, narration: "Check your checks, set your policies, keep noticing.", keys: ["Check your checks", "set your policies", "keep noticing"], props: { icon: "shield-tick" } },
    ]),
  },
  // ————— Safeguarding L2 (c1) — intro is the bespoke l0 video; this is the mid —————
  c1: {
    mid: mk("Responding to a disclosure", [
      { visual: "gtitle", seconds: 5, narration: "When a child chooses to tell you something.", keys: ["chooses to tell you"], props: { icon: "shield" } },
      { visual: "gcheck", seconds: 10, narration: "If a child discloses: stay calm, listen, and don't interrogate them.", keys: ["stay calm", "listen", "don't interrogate"], props: { items: ["Stay calm", "Listen", "Don't interrogate"] } },
      { visual: "gcompare", seconds: 12, narration: "Use their own words and open questions. Never lead them or promise secrecy.", keys: ["their own words", "open questions", "promise secrecy"], props: { good: ["Their own words", "Open questions", "Reassure"], bad: ["Leading questions", "Promise secrecy", "React with shock"] } },
      { visual: "gsteps", seconds: 10, narration: "Afterwards: note the facts, then report to your DSL the same day.", keys: ["note the facts", "report to your DSL", "the same day"], props: { items: ["Notice", "Record", "Report"] } },
      { visual: "galert", seconds: 6, narration: "If a child is in immediate danger, call 999. Don't wait.", keys: ["immediate danger", "call 999", "Don't wait"], props: { icon: "phone" } },
      { visual: "gclose", seconds: 6, narration: "Listen, record, report. That's how you respond.", keys: ["Listen", "record", "report"], props: { icon: "shield-tick" } },
    ]),
  },
  // ————— Fire Safety Awareness (c10) —————
  c10: {
    intro: mk("Fire safety in two minutes", [
      { visual: "gtitle", seconds: 5, narration: "Fire safety. Two minutes that could save lives.", keys: ["Fire safety", "save lives"], props: { icon: "flame" } },
      { visual: "gspot", seconds: 6, narration: "At a busy camp, fire spreads fast. Seconds matter.", keys: ["fire spreads fast", "Seconds matter"], props: { icon: "flame" } },
      { visual: "gsteps", seconds: 12, narration: "If you discover a fire: raise the alarm, get everyone out, stay out, and call 999.", keys: ["raise the alarm", "get everyone out", "stay out", "call 999"], props: { items: ["Raise alarm", "Get out", "Stay out", "Call 999"] } },
      { visual: "gcheck", seconds: 11, narration: "Before every session: know your exits, keep escape routes clear, and know the meeting point.", keys: ["know your exits", "escape routes clear", "meeting point"], props: { items: ["Know your exits", "Keep routes clear", "Know the meeting point"] } },
      { visual: "galert", seconds: 7, narration: "Never fight a fire that's bigger than you. People first, always.", keys: ["Never fight", "People first"], props: { icon: "flame" } },
      { visual: "gclose", seconds: 6, narration: "Raise, evacuate, call. That's fire safety.", keys: ["Raise", "evacuate", "call", "fire safety"], props: { icon: "shield-tick" } },
    ]),
    mid: mk("Prevent, respond, evacuate", [
      { visual: "gtitle", seconds: 5, narration: "Prevention, and the right response.", keys: ["Prevention", "right response"], props: { icon: "extinguisher" } },
      { visual: "gsteps", seconds: 11, narration: "To use an extinguisher, remember PASS: pull, aim, squeeze, sweep.", keys: ["pull", "aim", "squeeze", "sweep"], props: { items: ["Pull", "Aim", "Squeeze", "Sweep"] } },
      { visual: "gcompare", seconds: 12, narration: "Only tackle a fire if you're trained, it's small, and your exit is behind you.", keys: ["you're trained", "it's small", "exit is behind you"], props: { good: ["Trained", "Small fire", "Exit behind you"], bad: ["It's spreading", "Blocks your exit", "Any doubt"] } },
      { visual: "gcheck", seconds: 10, narration: "Prevent fires: test the alarms, clear rubbish away, and don't overload sockets.", keys: ["test the alarms", "clear rubbish", "overload sockets"], props: { items: ["Test alarms", "Clear rubbish", "Don't overload sockets"] } },
      { visual: "galert", seconds: 7, narration: "When the alarm sounds, go — even for a drill. Never assume it's false.", keys: ["go", "Never assume"], props: { icon: "bell" } },
      { visual: "gclose", seconds: 6, narration: "Prevent, respond, evacuate. Every time.", keys: ["Prevent", "respond", "evacuate"], props: { icon: "extinguisher" } },
    ]),
  },

  // ————— Paediatric First Aid Refresher (c2) —————
  c2: {
    intro: mk("First aid in two minutes", [
      { visual: "gtitle", seconds: 5, narration: "Paediatric first aid. Calm, clear, quick.", keys: ["first aid", "Calm, clear, quick"], props: { icon: "cross" } },
      { visual: "gsteps", seconds: 12, narration: "In any emergency: check for danger, check response, shout for help, then act.", keys: ["check for danger", "check response", "shout for help", "act"], props: { items: ["Danger", "Response", "Shout", "Act"] } },
      { visual: "gcheck", seconds: 11, narration: "For an unresponsive child: open the airway, check breathing, and call 999.", keys: ["open the airway", "check breathing", "call 999"], props: { items: ["Open the airway", "Check breathing", "Call 999"] } },
      { visual: "gstat", seconds: 7, narration: "Give thirty chest compressions to two rescue breaths. Keep going.", keys: ["thirty", "two rescue breaths", "Keep going"], props: { value: "30:2", sub: "compressions to breaths" } },
      { visual: "galert", seconds: 6, narration: "You can't make it worse by trying. Doing nothing is the only mistake.", keys: ["can't make it worse", "Doing nothing"], props: { icon: "heart" } },
      { visual: "gclose", seconds: 6, narration: "Danger, response, shout, act. You've got this.", keys: ["Danger", "response", "shout", "act"], props: { icon: "cross" } },
    ]),
    mid: mk("Everyday injuries, handled", [
      { visual: "gtitle", seconds: 5, narration: "The everyday injuries you'll actually see.", keys: ["everyday injuries"], props: { icon: "cross" } },
      { visual: "gcards", seconds: 12, narration: "Bumps, bleeds, burns, and choking — each has a simple first response.", keys: ["Bumps", "bleeds", "burns", "choking"], props: { items: ["Bumps", "Bleeds", "Burns", "Choking"], icons: ["heart", "droplet", "flame", "lungs"] } },
      { visual: "gcheck", seconds: 11, narration: "For a burn: cool under running water for twenty minutes, then cover loosely.", keys: ["cool under running water", "twenty minutes", "cover loosely"], props: { items: ["Cool with water", "20 minutes", "Cover loosely"] } },
      { visual: "gsteps", seconds: 10, narration: "Choking: five back blows, then five abdominal thrusts. Repeat, and call 999.", keys: ["five back blows", "five abdominal thrusts", "call 999"], props: { items: ["5 back blows", "5 thrusts", "Repeat", "999"] } },
      { visual: "galert", seconds: 6, narration: "Always record what happened and tell the parents. Every time.", keys: ["record what happened", "tell the parents"], props: { icon: "document" } },
      { visual: "gclose", seconds: 6, narration: "Stay calm, act early, write it down.", keys: ["Stay calm", "act early", "write it down"], props: { icon: "cross" } },
    ]),
  },

  // ————— Data Protection & Confidentiality / GDPR (c9) —————
  c9: {
    intro: mk("Data protection in two minutes", [
      { visual: "gtitle", seconds: 5, narration: "Data protection. Handle children's information with care.", keys: ["Data protection", "with care"], props: { icon: "lock" } },
      { visual: "gspot", seconds: 6, narration: "Every register, photo and medical note is personal data. Protect it.", keys: ["personal data", "Protect it"], props: { icon: "document" } },
      { visual: "gcheck", seconds: 12, narration: "Collect only what you need, keep it accurate, and delete it when you're done.", keys: ["only what you need", "keep it accurate", "delete it"], props: { items: ["Only what you need", "Keep it accurate", "Delete when done"] } },
      { visual: "gcompare", seconds: 12, narration: "Share on a need-to-know basis — never in a group chat or on your own phone.", keys: ["need-to-know", "group chat", "your own phone"], props: { good: ["Need-to-know", "Locked away", "Work systems"], bad: ["Group chats", "Personal phone", "Left on show"] } },
      { visual: "galert", seconds: 6, narration: "A lost list or a wrong email is a breach. Report it the same day.", keys: ["a breach", "Report it"], props: { icon: "alert" } },
      { visual: "gclose", seconds: 6, narration: "Minimise, secure, report. That's data protection.", keys: ["Minimise", "secure", "report"], props: { icon: "lock" } },
    ]),
    mid: mk("Safeguarding always wins", [
      { visual: "gtitle", seconds: 5, narration: "When safety and privacy meet.", keys: ["safety and privacy"], props: { icon: "shield" } },
      { visual: "gquote", seconds: 8, narration: "You can always share information to protect a child. Safeguarding overrides confidentiality.", keys: ["protect a child", "Safeguarding overrides"], props: { icon: "shield" } },
      { visual: "gcards", seconds: 12, narration: "Children have rights too: to see their data, to have it corrected, and to be kept safe.", keys: ["to see their data", "have it corrected", "kept safe"], props: { items: ["See it", "Correct it", "Stay safe"], icons: ["eye", "document", "shield"] } },
      { visual: "gcheck", seconds: 10, narration: "Strong passwords, locked screens, and no sharing logins. Small habits, big protection.", keys: ["Strong passwords", "locked screens", "no sharing logins"], props: { items: ["Strong passwords", "Lock your screen", "Never share logins"] } },
      { visual: "galert", seconds: 6, narration: "Unsure whether to share? Ask your DSL — don't guess.", keys: ["Ask your DSL", "don't guess"], props: { icon: "chat" } },
      { visual: "gclose", seconds: 6, narration: "Protect the data. Protect the child. Both matter.", keys: ["Protect the data", "Protect the child"], props: { icon: "shield-tick" } },
    ]),
  },
};

// The 35 agent-authored courses (hand-authored c1/c2/c9/c10 above take precedence).
for (const [id, v] of Object.entries(GENERATED_COURSE_VIDEOS)) {
  if (!COURSE_VIDEOS[id]) COURSE_VIDEOS[id] = v as { intro?: MotionBlock; mid?: MotionBlock };
}
// the 20 new courses' videos
for (const [id, v] of Object.entries(NEW_COURSE_VIDEOS)) {
  if (!COURSE_VIDEOS[id]) COURSE_VIDEOS[id] = v as { intro?: MotionBlock; mid?: MotionBlock };
}

// Insert the intro video as a new first lesson and the mid video before the
// middle lesson. Non-destructive: returns a shallow copy.
export function withVideos(course: CourseDoc): CourseDoc {
  const v = COURSE_VIDEOS[course.id];
  if (!v || (!v.intro && !v.mid)) return course;
  const lessons: Lesson[] = [...course.lessons];
  if (v.mid) {
    const midIdx = Math.max(1, Math.floor(lessons.length / 2));
    lessons.splice(midIdx, 0, { id: "v-mid", title: v.mid.title || "Watch", mins: 2, blocks: [{ k: "text", t: "A short animated recap — press play (sound on, or read the key words)." }, v.mid] });
  }
  if (v.intro) {
    lessons.unshift({ id: "v-intro", title: v.intro.title || "Watch first", mins: 2, blocks: [{ k: "text", t: "Start here — a two-minute animated overview. Press play." }, v.intro] });
  }
  return { ...course, lessons };
}
