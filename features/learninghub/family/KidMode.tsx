"use client";

import { useEffect } from "react";
import { FOCUS, Icon } from "../kit";
import { useT } from "@/lib/i18n/provider";
import { hubT } from "./hubT";

// Kid mode ("Hand over to Ava"): the hub becomes a full-screen layer (the hub root itself goes `fixed inset-0`, so the portal's
// sidebar, top bar and bell are covered), scoped to ONE child: no provider / child pickers, no Progress table, no Live lessons list,
// no settings. The way out is the parent gate. The mode lives in sessionStorage so a refresh stays in it.

const KEY = "aos.hub.kid";
// "diagnostic" (the placement test) is here so a quiz that is locked behind one can be unlocked from kid mode: the same runner, the same
// child chip, and the same forced child (there is no picker), just worded as the "Starting quiz" for a child.
// Same tab set as the parent's own view of this child — nothing hidden or held back (Kaz: "I don't want two
// different pages, this is getting confusing"). KID_STRIP_HIDDEN is kept (now empty) so a re-add later is a
// one-line change, not a rewrite.
export const KID_TABS = ["home", "notes", "quizzes", "diagnostic", "homework", "flashcards", "questions", "live", "dashboard", "tools", "games"] as const;
export const KID_STRIP_HIDDEN: readonly string[] = [];
/** The tenant's default level names in a child's words. A tutor's own names (anything else) are left exactly as written. */
const KID_BAND_KEY: Record<string, string> = { learning: "bandLearning", developing: "bandDeveloping", secure: "bandSecure" };
export const kidBand = (label: string | null | undefined, kid: boolean): string => {
  if (label == null) return "";
  const k = kid ? KID_BAND_KEY[label.trim().toLowerCase()] : undefined;
  return k ? hubT(`hubfam.${k}`) : bandName(label);
};
const LVL_KEY: Record<string, string> = { learning: "lvlLearning", developing: "lvlDeveloping", secure: "lvlSecure" };
/** Display-time name for the tenant's DEFAULT level names (Learning / Developing / Secure) in the active language; anything else is shown as authored. */
export const bandName = (label: string | null | undefined): string => {
  if (label == null) return "";
  const k = LVL_KEY[label.trim().toLowerCase()];
  const r = k ? hubT(`hubfam.${k}`) : "";
  return r && r !== `hubfam.${k}` ? r : label;
};
/** What a tab is called on a child's screen (the rest keep their names). */
// Getters so the names follow the active language (read by LearningHubApp outside hubfam).
export const KID_TAB_LABEL: Record<string, string> = {
  get diagnostic() { return hubT("hubfam.tabStarting"); },
  get dashboard() { return hubT("hubfam.tabDash"); },
  get questions() { return hubT("hubfam.tabMsgs"); },
};

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
  const t = useT();
  // One consistent header everywhere a child's page opens, whether that's a parent clicking through from "All
  // children" or a child using a handed-over device: same plain back-link style, no separate card/avatar/lock
  // treatment (Kaz: "I don't want two different pages, this is getting confusing" — the content was already
  // identical; only this chrome differed).
  return (
    // Tucked to the top-right (out of a child's way, so they don't tap it by accident) but a clear, bordered 48px button a grown-up can find.
    <div className="mb-2 flex justify-end">
      <button type="button" onClick={onExit} data-testid="hub-kid-bar" aria-label={t("hubfam.gateTitle")}
        className={`inline-flex min-h-[48px] items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-[13px] font-extrabold text-[var(--brand)] shadow-[var(--shadow-sm)] ${FOCUS}`}>
        <Icon name="arrowLeft" size={16} strokeWidth={2.6} />{t("hubfam.gateTitle")}
      </button>
    </div>
  );
}
