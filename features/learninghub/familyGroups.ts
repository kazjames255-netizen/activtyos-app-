import type { PanelMeta } from "./panelTypes";

// The FAMILY (parent) hub's grouped navigation: max 4 top-level sections (owner correction on top of the
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
    fs("flashcards", "Flashcards", "🃏", "flashcards"),
  ] },
  { id: "progress", label: "Progress", emoji: "📈", subs: [fs("progress", "Progress", "📈", "dashboard")] },
  // Additive: a new top-level Games section (not folded into Learn) so a game is exactly as easy to find, and
  // exactly as tied to "which child" via the same Level-1 (family overview, pick a child) -> Level-2 flow as every
  // other tab. GamesPanel.tsx carries the child-choice gate itself.
  { id: "games", label: "Games", emoji: "🎮", subs: [fs("games", "Games", "🎮", "games")] },
];

const ALL = FAMILY_TOPS.flatMap((top) => top.subs.map((sub) => ({ top, sub })));
export const famSubById = (id: string | null | undefined) => ALL.find((x) => x.sub.id === id)?.sub ?? null;
/** The top a panel key belongs to. */
export const famTopOfKey = (key: TabKey): FamTopDef | null => ALL.find((x) => x.sub.key === key)?.top ?? null;

/** The sub-section that shows for panel `key`: the one the URL / state names when it belongs to that panel, else the key's first sub. */
export function famSubFor(key: TabKey, sub?: string | null): FamSubDef | null {
  const named = famSubById(sub);
  if (named && named.key === key) return named;
  return ALL.find((x) => x.sub.key === key)?.sub ?? null;
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
