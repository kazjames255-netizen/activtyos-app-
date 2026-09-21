"use client";

import { useCallback, useSyncExternalStore } from "react";
import { FOCUS } from "./teachKit";

// "Mine / Everyone" — the per-tutor view for a business with more than one tutor (F11). A student carries the tutor
// who teaches them and a lesson the tutor who scheduled it (`tutorUid`); a tutor sees just their own by default and can
// flip to Everyone. Owners and managers keep the full view: nothing is ever hidden, only defaulted. Purely a view choice —
// the server still decides what each login may read and write. One choice for the whole hub: a module store, so the
// Home, Students and Live lessons tabs (all mounted at once) switch together.

export type Scope = "mine" | "all";
const KEY = "aos.hub.scope";
let chosen: Scope | null | undefined; // undefined = not read yet
const subs = new Set<() => void>();
const load = (): Scope | null => {
  if (chosen === undefined) { try { const v = localStorage.getItem(KEY); chosen = v === "mine" || v === "all" ? v : null; } catch { chosen = null; } }
  return chosen;
};
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/** The scope in force: the tutor's own choice (remembered), else `fallback`. */
export function useScope(fallback: Scope): [Scope, (s: Scope) => void] {
  const saved = useSyncExternalStore(subscribe, load, () => null);
  const set = useCallback((s: Scope) => { chosen = s; try { localStorage.setItem(KEY, s); } catch { /* private mode */ } subs.forEach((f) => f()); }, []);
  return [saved ?? fallback, set];
}

export function ScopeToggle({ scope, onChange, mine, all, what }: { scope: Scope; onChange: (s: Scope) => void; mine: number; all: number; what: string }) {
  const opt = (v: Scope, label: string, n: number) => (
    <button key={v} type="button" aria-pressed={scope === v} data-testid={`hub-scope-${v}`} onClick={() => onChange(v)}
      className={`inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[12.5px] font-extrabold transition ${FOCUS} ${scope === v ? "text-white" : "text-[var(--ink-2)] hover:text-[var(--ink)]"}`}
      style={scope === v ? { background: "linear-gradient(180deg, var(--brand-2), var(--brand))" } : undefined}>
      {label}<span className={`rounded-full px-1.5 py-px text-[11px] font-extrabold ${scope === v ? "bg-white/25" : "bg-[var(--line)] text-[var(--ink-2)]"}`}>{n}</span>
    </button>
  );
  return (
    <div role="group" aria-label={`Show ${what}`} className="inline-flex max-w-full overflow-x-auto rounded-full border border-[var(--line)] bg-[var(--surface)] p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {opt("mine", `My ${what}`, mine)}{opt("all", "Everyone", all)}
    </div>
  );
}
