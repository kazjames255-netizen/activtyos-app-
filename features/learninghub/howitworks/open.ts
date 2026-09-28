import type { HowBand, HowRole } from "./types";

export interface OpenDetail { role?: HowRole; /** Child explainer band (ks1 = the extra-simple one). */ band?: HowBand; /** Which topic video (tutor library: roster, lessons, tools, live, homework, quizzes, progress; parent / child: homework). Tutors with no topic get the chooser. */ topic?: string; /** Scene id to start on. */ scene?: string; /** Start playing straight away (a page's Watch button): no second play press. */ autoplay?: boolean }
export const hiwEvent = "aos:how-it-works";
// The window itself is lazy-loaded: a click that lands before it has mounted is remembered for a few seconds and replayed by the host on mount.
let pending: { d: OpenDetail; t: number } | null = null;
export const takePending = (): OpenDetail | null => { const p = pending; pending = null; return p && Date.now() - p.t < 8000 ? p.d : null; };
export const clearPending = (): void => { pending = null; };
/** Open the in-app How it works window (the mounted HowItWorksHost answers). Safe to call from anywhere on the client. */
export function openHowItWorks(d: OpenDetail = {}): void {
  if (typeof window !== "undefined") { pending = { d, t: Date.now() }; window.dispatchEvent(new CustomEvent(hiwEvent, { detail: d })); }
}

/** "Try it now": ask the mounted tutor hub to jump to a sub-tab (tabGroups.ts id; action sub-tabs open their form). */
export const hubGotoEvent = "aos:hub-goto";
export function hubGoto(sub: string): void { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(hubGotoEvent, { detail: { sub } })); }
