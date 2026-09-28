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
  /** A secondary, utility-style entry (e.g. "Tools"): SubMenuCard shows it smaller and docked to the row's end, not as a peer
   *  destination card — everything else about it (selection, keyboard nav, scroll) works exactly like any other sub-tab. */
  minor?: boolean;
}
/** Top tab: its sub-sections. Opening it shows the side card AND a page at once (never a separate landing page): the sub-section last used
 *  (per device), else `first`. "mark": Homework opens on To mark while anything is waiting. Links and hub intents go straight to their target. */
export interface TopDef {
  id: string; label: string; emoji: string; subs: SubDef[]; entry?: "mark";
  /** This top tab's own accent when it's the ACTIVE tab in the tutor top-level strip (HubTabs `variant="top"` only) — a
   *  `var(--cat-N)` CSS custom-property NAME from app/globals.css's existing categorical palette (the same set
   *  `features/learninghub/games/quizArcade/games.ts` draws from), never a green one (content rule: no green as a
   *  persistent brand/chrome colour) and never gold/amber (that's already the "count" badge colour on these tabs). */
  accent?: string;
}

const s = (id: string, label: string, emoji: string, key: TabKey, short = "", action?: SubDef["action"], intent?: HubIntent, minor?: boolean): SubDef => ({ id, label, emoji, key, short, action, intent, minor });

export const TUTOR_TOPS: TopDef[] = [
  { id: "home", label: "Home", emoji: "🏠", accent: "--cat-4", subs: [s("home", "Home", "🏠", "home")] },
  // Kaz: "students goes before lessons" — order swapped (was Home / Lessons / Students).
  // Kaz: "students... is a distinctive colour" — magenta, deliberately the loudest accent on the strip and clearly
  // apart from its neighbours (blue Home, indigo Lessons).
  { id: "students", label: "Students", emoji: "🧑‍🎓", accent: "--cat-1", subs: [
    s("students", "Students", "👥", "students", "Roster and groups"),
    s("enrol", "Enrol a student", "➕", "students", "Add to your roster", "intent", { kind: "enrol", groupId: "" }),
  ] },
  { id: "lessons", label: "Lessons", emoji: "📚", accent: "--cat-3", subs: [
    s("lessons", "Lessons & curriculum", "📖", "notes", "Notes, worksheets, lessons"),
    // Kaz: "aint these simply the same thing? if so just combine it all on one tab and page" — "Schedule video
    // lesson" was a second nav entry pointing at this exact same "live" panel, only pre-opening its own create
    // dialog on arrival. That dialog is already one click away inside Live Lessons (its own header/empty-state
    // "Schedule video lesson" button), so the separate entry just doubled up the same destination. A stale
    // `sub=schedule` deep link (tabAlias.ts) still resolves fine — subFor() falls back to this "live" sub.
    //
    // Kaz (later): "i think you can combine these into one card and one area where at some point they simply
    // A) choose to go live now or schedule a lesson and B) choose a video lesson or non video lesson" — "Live
    // lessons" and "Teach in person" were two separate cards pointing at two separate destinations even though
    // they're the same underlying idea server-side (a hubLessons row; in-person is just `mode: "in_person"` on
    // the same document — see server/src/routes/hub/inPersonApi.ts). They are now ONE card ("Let's Teach") and
    // ONE panel (LiveLessonsPanel): its "New session" button asks when (now / later) and how (video / in
    // person) and routes to the right existing flow. In-person has no server concept of scheduling ahead (a
    // session is always created live), so "later" only applies to video — the chooser makes that plain rather
    // than offering a combination the backend can't honour. The old `sub=teach-in-person` deep link (tabAlias.ts)
    // now resolves here too.
    s("live", "Let's Teach", "🎥", "live", "Now or later, video or in person"),
    // Kaz: "progress needs to move to here and flashcards move from here to above" — Progress and Flashcards
    // swapped levels: Progress (previously its own top-level tab) now lives in this row, and Flashcards
    // (previously here) is promoted to Progress's old top-level slot below.
    s("progress", "Progress", "📈", "dashboard", "Mastery and results"),
    // Utility, not a destination like the ones above: a quick-access shortcut, so SubMenuCard docks it smaller at the row's end.
    s("tools", "Tools", "🧰", "tools", "Timers and classroom tools", undefined, undefined, true),
  ] },
  { id: "flashcards", label: "Flashcards", emoji: "🃏", accent: "--cat-6", subs: [s("flashcards", "Flashcards", "🃏", "flashcards")] },
  // Kaz: "plcement quiz change name to entry tests and this has its own tab above next to quizzes" — was a sub
  // under Quizzes ("Starting quizzes"); now its own top-level tab, renamed and placed right beside Quizzes.
  { id: "starting", label: "Entry tests", emoji: "🎯", accent: "--cat-11", subs: [s("starting", "Entry tests", "🎯", "diagnostic")] },
  { id: "quizzes", label: "Quizzes", emoji: "📝", accent: "--cat-2", subs: [
    s("quizzes", "Quizzes", "📝", "quizzes", "Build, mark, results"),
    s("newquiz", "New quiz", "➕", "quizzes", "Build a test", "intent", { kind: "newQuiz", groupId: "" }),
  ] },
  { id: "homework", label: "Homework", emoji: "📓", entry: "mark", accent: "--cat-12", subs: [
    s("mark", "To mark", "✅", "homework", "Hand-ins and written answers"),
    s("results", "Results", "📊", "homework", "Every child, every homework, and what needs marking"),
    s("set", "Set homework", "✏️", "homework", "Set the next task", "intent", { kind: "homework", groupId: "" }),
  ] },
  { id: "messages", label: "Messages", emoji: "💬", accent: "--cat-5", subs: [s("messages", "Messages", "💬", "questions")] },
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
