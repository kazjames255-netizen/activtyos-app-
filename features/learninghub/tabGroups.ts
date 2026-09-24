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
  /** "intent": opens an existing create dialog on arrival. "overlay": the in-person full-screen shell. Both are hidden for a view-only role. */
  action?: "intent" | "overlay";
  intent?: HubIntent;
}
export interface TopDef { id: string; label: string; emoji: string; subs: SubDef[] }

const s = (id: string, label: string, emoji: string, key: TabKey, action?: SubDef["action"], intent?: HubIntent): SubDef => ({ id, label, emoji, key, action, intent });

export const TUTOR_TOPS: TopDef[] = [
  { id: "home", label: "Home", emoji: "🏠", subs: [s("home", "Home", "🏠", "home")] },
  { id: "lessons", label: "Lessons", emoji: "📚", subs: [
    s("lessons", "Lessons & curriculum", "📖", "notes"),
    s("live", "Live lessons", "🎥", "live"),
    s("schedule", "Schedule video lesson", "📅", "live", "intent", { kind: "lesson", groupId: "" }),
    s("teach", "Teach in person", "🧑‍🏫", "notes", "overlay"),
    s("tools", "Tools", "🧰", "tools"),
    s("flashcards", "Flashcards", "🃏", "flashcards"),
  ] },
  { id: "students", label: "Students", emoji: "🧑‍🎓", subs: [
    s("students", "Students", "👥", "students"),
    s("enrol", "Enrol a student", "➕", "students", "intent", { kind: "enrol", groupId: "" }),
  ] },
  { id: "progress", label: "Progress", emoji: "📈", subs: [s("progress", "Progress", "📈", "dashboard")] },
  { id: "quizzes", label: "Quizzes", emoji: "📝", subs: [
    s("quizzes", "Quizzes", "📝", "quizzes"),
    s("starting", "Starting quizzes", "🎯", "diagnostic"),
    s("newquiz", "New quiz", "➕", "quizzes", "intent", { kind: "newQuiz", groupId: "" }),
  ] },
  { id: "homework", label: "Homework", emoji: "📓", subs: [
    s("mark", "To mark", "✅", "homework"),
    s("inbox", "Inbox", "📥", "homework"),
    s("set", "Set homework", "✏️", "homework", "intent", { kind: "homework", groupId: "" }),
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
/** Last plain (non-action) sub-tab used under a top tab, per device. */
export function rememberedSub(top: TopDef): SubDef {
  try {
    const d = subById(localStorage.getItem(LS(top.id)));
    if (d && !d.action && top.subs.some((x) => x.id === d.id)) return d;
  } catch { /* private mode */ }
  return top.subs.find((x) => !x.action)!;
}
export function rememberSub(top: TopDef, sub: SubDef) {
  if (sub.action) return;
  try { localStorage.setItem(LS(top.id), sub.id); } catch { /* ignore */ }
}
