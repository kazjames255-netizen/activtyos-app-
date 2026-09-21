"use client";

import { useEffect, useState } from "react";
import { Avatar, FOCUS } from "../kit";
import { Ico } from "../teachIcons";
import { ParentGate } from "./ParentGate";

// Kid mode ("Hand over to Ava"): the hub becomes a full-screen layer (the hub root itself goes `fixed inset-0`, so the portal's
// sidebar, top bar and bell are covered), scoped to ONE child: no provider / child pickers, no Progress table, no Live lessons list,
// no settings. The way out is the parent gate. The mode lives in sessionStorage so a refresh stays in it.

const KEY = "aos.hub.kid";
// "diagnostic" (the placement test) is here so a quiz that is locked behind one can be unlocked from kid mode: the same runner, the same
// child chip, and the same forced child (there is no picker), just worded as the "Starting quiz" for a child.
export const KID_TABS = ["home", "notes", "quizzes", "diagnostic", "homework", "flashcards"] as const;
/** The tenant's default level names in a child's words. A tutor's own names (anything else) are left exactly as written. */
const KID_BAND: Record<string, string> = { learning: "Getting started", developing: "Getting there", secure: "Got it!" };
export const kidBand = (label: string | null | undefined, kid: boolean): string => (label == null ? "" : kid ? KID_BAND[label.trim().toLowerCase()] ?? label : label);
/** What a tab is called on a child's screen (the rest keep their names). */
export const KID_TAB_LABEL: Record<string, string> = { diagnostic: "Starting quiz", dashboard: "How I'm doing" };

export interface KidStore { t: string; c: string }
export function readKid(): KidStore | null {
  try { const r = sessionStorage.getItem(KEY); const v = r ? JSON.parse(r) : null; return v && typeof v.t === "string" && typeof v.c === "string" ? v : null; } catch { return null; }
}
export function writeKid(v: KidStore | null) {
  try { if (v) sessionStorage.setItem(KEY, JSON.stringify(v)); else sessionStorage.removeItem(KEY); } catch { /* private mode */ }
}

/** While kid mode is on: lock page scroll (the layer scrolls itself) and keep the Back button inside the hub. Two same-URL history
 *  entries are kept above the page we came from, so Back (or the Android gesture) can never reach the parent portal; opened lessons
 *  and quizzes still close on Back because they are pushed on top (family/link.ts). */
export function useKidGuards(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const GUARD = "aosKidGuard";
    const st = () => ({ ...(window.history.state ?? {}), [GUARD]: true });
    const url = window.location.href;
    try { window.history.pushState(st(), "", url); } catch { /* ignore */ }
    const onPop = () => {
      if ((window.history.state as Record<string, unknown> | null)?.[GUARD]) return; // still on a guard entry
      if (window.location.pathname !== new URL(url).pathname) return; // already navigating elsewhere (nothing we can do)
      try { window.history.pushState(st(), "", window.location.href); } catch { /* ignore */ }
    };
    window.addEventListener("popstate", onPop);
    return () => { window.removeEventListener("popstate", onPop); document.body.style.overflow = prev; };
  }, [on]);
}

export function KidBar({ name, onExit }: { name: string; onExit: () => void }) {
  const [gate, setGate] = useState(false);
  const first = name.trim().split(/\s+/)[0] || name;
  return (
    <>
      <div id="hub-kid-bar" data-testid="hub-kid-bar" className="mb-3 flex min-h-[56px] items-center gap-3 rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-soft)] px-3 py-1.5">
        <Avatar name={name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-extrabold text-[var(--brand-strong)]" style={{ fontFamily: "var(--ff-display)" }}>{first}&apos;s learning</div>
        </div>
        <button type="button" onClick={() => setGate(true)} data-testid="kid-exit" aria-label="Grown-ups: leave kid mode"
          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[12.5px] font-extrabold text-[var(--ink-2)] hover:border-[var(--brand)] ${FOCUS}`}>
          <Ico name="lock" size={15} />Grown-ups
        </button>
      </div>
      {gate && <ParentGate name={first} onClose={() => setGate(false)} onUnlock={() => { setGate(false); onExit(); }} />}
    </>
  );
}
