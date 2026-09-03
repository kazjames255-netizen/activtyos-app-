"use client";

// "View as franchise X" — a head-office scope switcher. The HO picks a franchise
// (or "All — head office") in the header; the choice is stored app-wide and any
// page that reads useHoScope() narrows to that franchise (via ?franchiseId=).
// Company (head office) accounts only.

import { useEffect, useReducer, useState } from "react";
import Link from "next/link";
import { get as apiGet } from "@/lib/api";
import { getMe } from "@/components/auth/PortalGuard";

const KEY = "aos.ho.scope";
// Sentinel scope: the head office's OWN direct operation (listings it owns, no franchise).
export const HO_OWN = "__ho__";
let scopeId: string | null = null;
let loaded = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try { scopeId = localStorage.getItem(KEY); } catch { /* ignore */ }
}
export function getHoScopeId(): string | null { ensureLoaded(); return scopeId; }
export function setHoScopeId(id: string | null) {
  scopeId = id || null;
  try { scopeId ? localStorage.setItem(KEY, scopeId) : localStorage.removeItem(KEY); } catch { /* ignore */ }
  emit();
}
/** Subscribe to scope changes and get the current franchiseId (or null = head office). */
export function useHoScope(): string | null {
  const [, force] = useReducer((x) => x + 1, 0);
  ensureLoaded();
  useEffect(() => { subs.add(force); return () => { subs.delete(force); }; }, []);
  return scopeId;
}

export interface Franchise { franchiseId: string; name: string; area: string | null }

// Franchise list — loaded once per session for a head office.
let frCache: Franchise[] | null = null;
let frPromise: Promise<Franchise[]> | null = null;
function loadFranchises(): Promise<Franchise[]> {
  if (frCache) return Promise.resolve(frCache);
  if (!frPromise) {
    frPromise = getMe()
      .then((m) => (m.role === "company" ? apiGet<Franchise[]>("/api/franchises") : []))
      .then((xs) => { frCache = xs ?? []; return frCache; })
      .catch(() => { frCache = []; return frCache; });
  }
  return frPromise;
}
function useFranchises(): Franchise[] | null {
  const [list, setList] = useState<Franchise[] | null>(frCache);
  useEffect(() => { loadFranchises().then(setList); }, []);
  return list;
}

/** Header dropdown — only rendered for a head office with ≥1 franchise. */
export function HoScopeSwitcher({ portal }: { portal: string }) {
  const franchises = useFranchises();
  const scope = useHoScope();
  if (portal !== "company" || !franchises || franchises.length === 0) return null;
  const drilled = !!scope; // narrowed into a franchise / own locations (not the all-franchises overview)
  const accent = drilled ? "#7c3aed" : "#1d3a8f";
  // Matches the top-bar pill family (white, bold indigo) so it doesn't clash, but
  // carries a coloured eye badge + accent ring so it reads as the "what am I
  // viewing" control at a glance.
  return (
    <label
      className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-white px-2 py-1 shadow-sm transition-transform hover:-translate-y-px"
      style={{ borderColor: drilled ? "#d9cffb" : "#dbe6fb" }}
      title="Choose which part of your network you're viewing — the whole network, your own locations, or one franchise"
    >
      <span className="grid h-6 w-6 flex-none place-items-center rounded-full text-[12px] leading-none text-white" style={{ background: accent }}>👁</span>
      <select
        value={scope ?? ""}
        onChange={(e) => setHoScopeId(e.target.value || null)}
        className="max-w-[210px] cursor-pointer appearance-none truncate border-0 bg-transparent pr-1 text-[12.5px] font-extrabold outline-none"
        style={{ color: accent }}
      >
        <option value="" className="text-[var(--ink)]">Head office — all franchises</option>
        <option value={HO_OWN} className="text-[var(--ink)]">Head office — own locations</option>
        {franchises.map((f) => (
          <option key={f.franchiseId} value={f.franchiseId} className="text-[var(--ink)]">{f.name}{f.area ? ` · ${f.area}` : ""}</option>
        ))}
      </select>
      <span className="flex-none pr-1 text-[8px] leading-none" style={{ color: accent }} aria-hidden>▼</span>
    </label>
  );
}

/** Stamps <html data-ho-office="1"> only in the head-office COMBINED view (a
 *  company that has franchises, viewing "all franchises" — scope null), turning
 *  the whole chrome black (see globals.css). Cleared when the head office drills
 *  into a franchise / its own locations via the picker (back to the normal blue
 *  operator chrome), or when the account isn't a head office. */
export function HoThemeSync() {
  const scope = useHoScope();
  const [isHo, setIsHo] = useState(false);
  useEffect(() => { getMe().then((m) => setIsHo(m.role === "company" && !!m.hasFranchises)).catch(() => {}); }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isHo && !scope) document.documentElement.setAttribute("data-ho-office", "1");
    else document.documentElement.removeAttribute("data-ho-office");
    return () => document.documentElement.removeAttribute("data-ho-office");
  }, [isHo, scope]);
  return null;
}

/** Full-width scope bar under the header — the head office's persistent "what am
 *  I viewing" control. Always shown for a company that has franchises; switching
 *  it re-scopes the whole portal. Rendered by app/[portal]/layout.tsx. */
export function HoScopeBar() {
  const franchises = useFranchises();
  const scope = useHoScope();
  if (!franchises || franchises.length === 0) return null;
  const drilled = !!scope;
  const own = scope === HO_OWN;
  const fr = !own && scope ? franchises.find((x) => x.franchiseId === scope) : null;
  const label = !drilled ? "Head office — all franchises" : own ? "Head office — own locations" : fr ? `${fr.name}${fr.area ? ` · ${fr.area}` : ""}` : "This franchise";
  const accent = drilled ? "#7c3aed" : "#1d3a8f";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2" style={{ background: drilled ? "#faf6ff" : "#f3f6fd", borderColor: drilled ? "#e6d8f6" : "#dbe6fb" }}>
      <span className="text-[9.5px] font-black uppercase tracking-[0.14em]" style={{ color: accent, opacity: 0.75 }}>Viewing</span>
      <div className="relative inline-flex items-center">
        <span className="pointer-events-none absolute left-3 text-[13px] leading-none" aria-hidden>👁</span>
        <select
          value={scope ?? ""}
          onChange={(e) => setHoScopeId(e.target.value || null)}
          className="cursor-pointer appearance-none truncate rounded-lg border bg-white py-1.5 pl-9 pr-8 text-[13.5px] font-extrabold shadow-sm outline-none"
          style={{ color: accent, borderColor: drilled ? "#d9cffb" : "#cddcf7", maxWidth: "min(66vw, 340px)" }}
        >
          <option value="" className="text-[var(--ink)]">Head office — all franchises</option>
          <option value={HO_OWN} className="text-[var(--ink)]">Head office — own locations</option>
          {franchises.map((f) => (
            <option key={f.franchiseId} value={f.franchiseId} className="text-[var(--ink)]">{f.name}{f.area ? ` · ${f.area}` : ""}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 text-[9px] leading-none" style={{ color: accent }} aria-hidden>▼</span>
      </div>
      {drilled ? (
        <>
          <span className="hidden text-[12px] text-[var(--ink-3)] sm:inline">Showing <b style={{ color: accent }}>{label}</b> only — not your head-office view.</span>
          <button type="button" onClick={() => setHoScopeId(null)} className="ml-auto rounded-full px-3 py-1 text-[11.5px] font-extrabold text-white transition hover:brightness-110" style={{ background: accent }}>← Back to all franchises</button>
        </>
      ) : (
        <span className="ml-auto text-[12px] text-[var(--ink-3)]">Your whole network · {franchises.length} franchise{franchises.length === 1 ? "" : "s"}</span>
      )}
    </div>
  );
}

/** Full-width banner shown under the header while scoped into a franchise. */
export function HoScopeBanner() {
  const franchises = useFranchises();
  const scope = useHoScope();
  if (!scope || !franchises) return null;
  const own = scope === HO_OWN;
  const f = own ? null : franchises.find((x) => x.franchiseId === scope);
  if (!own && !f) return null;
  const label = own ? "Head office — own locations" : `${f!.name}${f!.area ? ` · ${f!.area}` : ""}`;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#e6d8f6] bg-[#faf6ff] px-4 py-1.5 text-[12px] font-bold text-[#7a3aa8]">
      <span>👁 Viewing as <b>{label}</b> — {own ? "you're seeing only your own directly-run locations, not your franchises." : "you're seeing this franchise's data, not your head-office view."}</span>
      <button type="button" onClick={() => setHoScopeId(null)} className="ml-auto rounded-full bg-[#7a3aa8] px-3 py-0.5 text-[11px] font-extrabold text-white hover:brightness-110">Back to head office</button>
      <Link href="/company/territories" className="rounded-full border border-[#d9c4ee] px-3 py-0.5 text-[11px] font-extrabold text-[#7a3aa8] no-underline hover:bg-white">Territories</Link>
    </div>
  );
}
