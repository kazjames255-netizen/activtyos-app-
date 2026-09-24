import type { HubIntent } from "./hubIntent";
import type { PanelMeta } from "./panelTypes";

// The tutor / operator hub's grouped navigation: seven top tabs, most with a row of sub-tabs under them. This is a PRESENTATION
// regrouping over the existing panel keys (home, live, students, dashboard, diagnostic, quizzes, homework, notes, tools, flashcards,
// questions): every old `?tab=<key>` link still resolves (each key belongs to exactly one top tab and has a default sub-tab), and
// the "action" sub-tabs open an EXISTING flow (the dialog / overlay the old Home quick-action tiles opened). Parents and children
// keep the flat strip and KID_TABS; nothing in here is used for them.
export type TabKey = PanelMeta["key"];

export interface SubDef {
  id: string; label: string; emoji: string; key: TabKey;
  /** One short line under the title in the side card. */
  short: string;
  /** "intent": opens an existing create dialog on arrival. "overlay": the in-person full-screen shell. Both are hidden for a view-only role. */
  action?: "intent" | "overlay";
  intent?: HubIntent;
}
/** Top tab: its sub-sections. Opening it shows the side card AND a page at once (never a separate landing page): the sub-section last used
 *  (per device), else `first`. "mark": Homework opens on To mark while anything is waiting. Links and hub intents go straight to their target. */
export interface TopDef { id: string; label: string; emoji: string; subs: SubDef[]; entry?: "mark" }

const s = (id: string, label: string, emoji: string, key: TabKey, short = "", action?: SubDef["action"], intent?: HubIntent): SubDef => ({ id, label, emoji, key, short, action, intent });

export const TUTOR_TOPS: TopDef[] = [
  { id: "home", label: "Home", emoji: "🏠", subs: [s("home", "Home", "🏠", "home")] },
  { id: "lessons", label: "Lessons", emoji: "📚", subs: [
    s("lessons", "Lessons & curriculum", "📖", "notes", "Notes, worksheets, lessons"),
    s("live", "Live lessons", "🎥", "live", "Start, join, look back"),
    s("schedule", "Schedule video lesson", "📅", "live", "Pick a time", "intent", { kind: "lesson", groupId: "" }),
    s("teach", "Teach in person", "🧑‍🏫", "notes", "Children beside you, no video", "overlay"),
    s("tools", "Tools", "🧰", "tools", "Timers and classroom tools"),
    s("flashcards", "Flashcards", "🃏", "flashcards", "Quick recall decks"),
  ] },
  { id: "students", label: "Students", emoji: "🧑‍🎓", subs: [
    s("students", "Students", "👥", "students", "Roster and groups"),
    s("enrol", "Enrol a student", "➕", "students", "Add to your roster", "intent", { kind: "enrol", groupId: "" }),
  ] },
  { id: "progress", label: "Progress", emoji: "📈", subs: [s("progress", "Progress", "📈", "dashboard")] },
  { id: "quizzes", label: "Quizzes", emoji: "📝", subs: [
    s("quizzes", "Quizzes", "📝", "quizzes", "Build, mark, results"),
    s("starting", "Starting quizzes", "🎯", "diagnostic", "Where a new student is"),
    s("newquiz", "New quiz", "➕", "quizzes", "Build a test", "intent", { kind: "newQuiz", groupId: "" }),
  ] },
  { id: "homework", label: "Homework", emoji: "📓", entry: "mark", subs: [
    s("mark", "To mark", "✅", "homework", "Hand-ins and written answers"),
    s("inbox", "Inbox", "📥", "homework", "Everything handed in"),
    s("set", "Set homework", "✏️", "homework", "Set the next task", "intent", { kind: "homework", groupId: "" }),
  ] },
  { id: "messages", label: "Messages", emoji: "💬", subs: [s("messages", "Messages", "💬", "questions")] },
];

const ALL = TUTOR_TOPS.flatMap((t) => t.subs.map((sub) => ({ top: t, sub })));
export const subById = (id: string | null | undefined) => ALL.find((x) => x.sub.id === id)?.sub ?? null;
export const topOfSub = (id: string) => ALL.find((x) => x.sub.id === id)?.top ?? null;
export const topOfKey = (key: TabKey): TopDef | null => ALL.find((x) => x.sub.key === key)?.top ?? null;

/** The sub-tab that shows for panel `key`: the one the URL / state names when it belongs to that panel, else the key's first plain sub. */
export function subFor(key: TabKey, sub?: string | null): SubDef | null {
  const named = subById(sub);
  if (named && named.key === key) return named;
  return ALL.find((x) => x.sub.key === key && !x.sub.action)?.sub ?? null;
}

/** The sub-tab id (from ?sub=) only when it is valid for `key`. */
export const validSub = (key: TabKey | null, sub: string | null | undefined): string | null => {
  const d = subById(sub);
  return d && key && d.key === key ? d.id : null;
};

const LS = (top: string) => `hub.sub.${top}`;
/** Last plain (non-action) sub-tab used under a top tab, per device; null when none was stored. */
export function recalledSub(top: TopDef): SubDef | null {
  try {
    const d = subById(localStorage.getItem(LS(top.id)));
    if (d && !d.action && top.subs.some((x) => x.id === d.id)) return d;
  } catch { /* private mode */ }
  return null;
}
export function rememberSub(top: TopDef, sub: SubDef) {
  if (sub.action) return;
  try { localStorage.setItem(LS(top.id), sub.id); } catch { /* ignore */ }
}
