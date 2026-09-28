import type { PanelMeta } from "./panelTypes";

// The FAMILY (parent) hub's grouped navigation: (was max 4 top-level sections; Flashcards and Games are now top-level too) (owner correction on top of the
// original 5-max brief: no standalone Tools destination — "no need for a tools tab, it can just be that they use
// the tools in the appropriate lesson"; Tools is DROPPED here, not folded in as a sub-section, since the
// per-question help tools already live inside the lesson/question itself). Most tops carry a row of sub-sections.
// Pure presentation regrouping over the existing panel keys — every old `?tab=<key>` link (including `?tab=tools`)
// still resolves via tabAlias.ts, so a stale bookmark still opens the Tools panel even though nothing in this nav
// points to it any more. Tutor mode uses tabGroups.ts (TUTOR_TOPS) instead, and Tools stays a full top-level
// section there — this file only ever affects the family/parent strip. Kid mode keeps its own flat KID_TABS strip.
export type TabKey = PanelMeta["key"];

export interface FamSubDef { id: string; label: string; emoji: string; key: TabKey }
export interface FamTopDef { id: string; label: string; emoji: string; subs: FamSubDef[] }

const fs = (id: string, label: string, emoji: string, key: TabKey): FamSubDef => ({ id, label, emoji, key });

export const FAMILY_TOPS: FamTopDef[] = [
  { id: "today", label: "Today", emoji: "🏠", subs: [fs("today", "Home", "🏠", "home")] },
  { id: "homework", label: "Homework", emoji: "📝", subs: [fs("homework", "Homework", "📝", "homework")] },
  { id: "learn", label: "Learn", emoji: "📚", subs: [
    fs("lessons", "Lessons", "📖", "notes"),
    fs("live", "Live lessons", "🎥", "live"),
    fs("quizzes", "Quizzes", "🎯", "quizzes"),
    fs("starting", "Starting quizzes", "🧭", "diagnostic"),
  ] },
  // Flashcards is its own top-level tab (owner: "flashcard tab should be here too"), not buried under Learn.
  { id: "flashcards", label: "Flashcards", emoji: "🃏", subs: [fs("flashcards", "Flashcards", "🃏", "flashcards")] },
  { id: "progress", label: "Progress", emoji: "📈", subs: [fs("progress", "Progress", "📈", "dashboard")] },
  // Additive: a new top-level Games section (not folded into Learn) so a game is exactly as easy to find, and
  // exactly as tied to "which child" via the same Level-1 (family overview, pick a child) -> Level-2 flow as every
  // other tab. GamesPanel.tsx carries the child-choice gate itself.
  { id: "games", label: "Games", emoji: "🎮", subs: [fs("games", "Games", "🎮", "games")] },
];

/** A child's own navigation (kid mode, Year 3 up): FIVE big tabs, always visible, no sideways scroll. Flashcards, Live lessons and the
 *  Starting quiz live inside "Learn"; Messages and Tools are not in the child's strip at all (they stay reachable by a direct ?tab= link —
 *  a grown-up handles messages). The panels behind every key are unchanged. Reception to Year 2 keeps its own three-icon KidIconTabs. */
export const KID_TOPS: FamTopDef[] = [
  { id: "today", label: "Home", emoji: "🏠", subs: [fs("today", "Home", "🏠", "home")] },
  { id: "learn", label: "Learn", emoji: "📚", subs: [
    fs("lessons", "Lessons", "📖", "notes"),
    fs("quizzes", "Quizzes", "🎯", "quizzes"),
    fs("flashcards", "Flashcards", "🃏", "flashcards"),
    fs("live", "Live lessons", "🎥", "live"),
    fs("starting", "Starting quiz", "🧭", "diagnostic"),
  ] },
  { id: "homework", label: "Homework", emoji: "📝", subs: [fs("homework", "Homework", "📝", "homework")] },
  { id: "games", label: "Games", emoji: "🎮", subs: [fs("games", "Games", "🎮", "games")] },
  { id: "progress", label: "My progress", emoji: "⭐", subs: [fs("progress", "My progress", "⭐", "dashboard")] },
];

const flat = (tops: FamTopDef[]) => tops.flatMap((top) => top.subs.map((sub) => ({ top, sub })));
const ALL = flat(FAMILY_TOPS);
const ALL_KID = flat(KID_TOPS);
const all = (tops?: FamTopDef[]) => (tops === KID_TOPS ? ALL_KID : ALL);
export const famSubById = (id: string | null | undefined) => ALL.find((x) => x.sub.id === id)?.sub ?? ALL_KID.find((x) => x.sub.id === id)?.sub ?? null;
/** The top a panel key belongs to (in `tops`, the family strip by default). */
export const famTopOfKey = (key: TabKey, tops?: FamTopDef[]): FamTopDef | null => all(tops).find((x) => x.sub.key === key)?.top ?? null;

/** The sub-section that shows for panel `key`: the one the URL / state names when it belongs to that panel, else the key's first sub. */
export function famSubFor(key: TabKey, sub?: string | null, tops?: FamTopDef[]): FamSubDef | null {
  const named = famSubById(sub);
  if (named && named.key === key) return named;
  return all(tops).find((x) => x.sub.key === key)?.sub ?? null;
}

const LS = (top: string) => `hub.famsub.${top}`;
/** Last sub-section used under a top, per device; null when none was stored. */
export function famRecalledSub(top: FamTopDef): FamSubDef | null {
  try {
    const d = famSubById(localStorage.getItem(LS(top.id)));
    if (d && top.subs.some((x) => x.id === d.id)) return d;
  } catch { /* private mode */ }
  return null;
}
export function famRememberSub(top: FamTopDef, sub: FamSubDef) {
  try { localStorage.setItem(LS(top.id), sub.id); } catch { /* ignore */ }
}
