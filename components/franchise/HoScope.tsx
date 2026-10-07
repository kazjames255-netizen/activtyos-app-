"use client";

// "View as franchise X" — a head-office scope switcher. The HO picks a franchise
// (or "All — head office") in the header; the choice is stored app-wide and any
// page that reads useHoScope() narrows to that franchise (via ?franchiseId=).
// Company (head office) accounts only.

import { useEffect, useReducer, useState } from "react";
import Link from "next/link";
import { get as apiGet } from "@/lib/api";
import { getMe } from "@/components/auth/PortalGuard";
import { useT } from "@/lib/i18n/provider";

// "**bold**" markers in a catalogue string -> <b>.
const boldify = (s: string, color?: string) => s.split("**").map((p, i) => (i % 2 ? <b key={i} style={color ? { color } : undefined}>{p}</b> : p));

const KEY = "aos.ho.scope";
// The scope also rides in the URL under this query param — see below.
const PARAM = "hoScope";
// Sentinel scope: the head office's OWN direct operation (listings it owns, no franchise).
export const HO_OWN = "__ho__";
let scopeId: string | null = null;
let loaded = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function readUrlScope(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(PARAM);
}

// Keep the address bar in step with the scope, WITHOUT going through
// next/navigation (this module is a plain singleton reachable from anywhere,
// not a hook) — a query-only pushState/replaceState doesn't touch the route,
// so it doesn't fight the app router. `push` adds a Back-able entry; use it
// for a genuine scope CHANGE. A page just adopting its already-remembered
// scope on load uses replace, so it doesn't leave a no-op entry in history.
function writeUrlScope(id: string | null, push: boolean) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (id) url.searchParams.set(PARAM, id); else url.searchParams.delete(PARAM);
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return;
  if (push) window.history.pushState({}, "", next);
  else window.history.replaceState({}, "", next);
}

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    const fromUrl = readUrlScope();
    if (fromUrl) {
      scopeId = fromUrl;
      localStorage.setItem(KEY, fromUrl);
    } else {
      scopeId = localStorage.getItem(KEY);
      // A remembered-from-last-time scope with no `?hoScope=` on THIS load
      // (a fresh tab, or a page reached by a plain nav link) — reflect it in
      // the address bar too, so refreshing from here still agrees, without
      // spending a history entry on it.
      if (scopeId) writeUrlScope(scopeId, false);
    }
  } catch { /* ignore */ }
  // Back/Forward: the URL is the source of truth for what you were just
  // looking at — HQ's franchise drill-in used to never touch the URL at all
  // (same route throughout, no history entry), so Back left the portal
  // unchanged instead of returning to the combined view.
  if (typeof window !== "undefined") {
    window.addEventListener("popstate", () => {
      const fromUrl = readUrlScope();
      if (fromUrl === scopeId) return;
      scopeId = fromUrl;
      try { fromUrl ? localStorage.setItem(KEY, fromUrl) : localStorage.removeItem(KEY); } catch { /* ignore */ }
      emit();
    });
  }
}
export function getHoScopeId(): string | null { ensureLoaded(); return scopeId; }
export function setHoScopeId(id: string | null) {
  ensureLoaded();
  const next = id || null;
  if (next === scopeId) return;
  scopeId = next;
  try { scopeId ? localStorage.setItem(KEY, scopeId) : localStorage.removeItem(KEY); } catch { /* ignore */ }
  writeUrlScope(scopeId, true);
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
export function useFranchises(): Franchise[] | null {
  const [list, setList] = useState<Franchise[] | null>(frCache);
  useEffect(() => { loadFranchises().then(setList); }, []);
  return list;
}

/** Header dropdown — only rendered for a head office with ≥1 franchise. */
export function HoScopeSwitcher({ portal }: { portal: string }) {
  const t = useT();
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
      className="inline-flex min-w-0 shrink cursor-pointer items-center gap-2 rounded-full border bg-white px-2 py-1 shadow-sm transition-transform hover:-translate-y-px"
      style={{ borderColor: drilled ? "#d9cffb" : "#dbe6fb" }}
      title={t("p8fr.scopeTitle")}
    >
      <span className="grid h-6 w-6 flex-none place-items-center rounded-full text-[12px] leading-none text-white" style={{ background: accent }}>👁</span>
      <select
        value={scope ?? ""}
        onChange={(e) => setHoScopeId(e.target.value || null)}
        className="min-w-0 max-w-[110px] cursor-pointer appearance-none truncate sm:max-w-[160px] border-0 bg-transparent pe-1 text-[12.5px] font-extrabold outline-none min-[1440px]:max-w-[210px]"
        style={{ color: accent }}
      >
        <option value="" className="text-[var(--ink)]">{t("p8fr.scopeAll")}</option>
        <option value={HO_OWN} className="text-[var(--ink)]">{t("p8fr.scopeOwn")}</option>
        {franchises.map((f) => (
          <option key={f.franchiseId} value={f.franchiseId} className="text-[var(--ink)]">{f.name}{f.area ? ` · ${f.area}` : ""}</option>
        ))}
      </select>
      <span className="flex-none pe-1 text-[8px] leading-none" style={{ color: accent }} aria-hidden>▼</span>
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
  const t = useT();
  const franchises = useFranchises();
  const scope = useHoScope();
  if (!franchises || franchises.length === 0) return null;
  const drilled = !!scope;
  const own = scope === HO_OWN;
  const fr = !own && scope ? franchises.find((x) => x.franchiseId === scope) : null;
  const label = !drilled ? t("p8fr.scopeAll") : own ? t("p8fr.scopeOwn") : fr ? `${fr.name}${fr.area ? ` · ${fr.area}` : ""}` : t("p8fr.scopeThisFranchise");
  const accent = drilled ? "#7c3aed" : "#1d3a8f";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2" style={{ background: drilled ? "#faf6ff" : "#f3f6fd", borderColor: drilled ? "#e6d8f6" : "#dbe6fb" }}>
      <span className="text-[9.5px] font-black uppercase tracking-[0.14em]" style={{ color: accent, opacity: 0.75 }}>{t("p8fr.scopeViewing")}</span>
      <div className="relative inline-flex items-center">
        <span className="pointer-events-none absolute start-3 text-[13px] leading-none" aria-hidden>👁</span>
        <select
          value={scope ?? ""}
          onChange={(e) => setHoScopeId(e.target.value || null)}
          className="cursor-pointer appearance-none truncate rounded-lg border bg-white py-1.5 ps-9 pe-8 text-[13.5px] font-extrabold shadow-sm outline-none"
          style={{ color: accent, borderColor: drilled ? "#d9cffb" : "#cddcf7", maxWidth: "min(66vw, 340px)" }}
        >
          <option value="" className="text-[var(--ink)]">{t("p8fr.scopeAll")}</option>
          <option value={HO_OWN} className="text-[var(--ink)]">{t("p8fr.scopeOwn")}</option>
          {franchises.map((f) => (
            <option key={f.franchiseId} value={f.franchiseId} className="text-[var(--ink)]">{f.name}{f.area ? ` · ${f.area}` : ""}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute end-3 text-[9px] leading-none" style={{ color: accent }} aria-hidden>▼</span>
      </div>
      {drilled ? (
        <>
          <span className="hidden text-[12px] text-[var(--ink-3)] sm:inline">{boldify(t("p8fr.scopeShowing", { label }), accent)}</span>
          <button type="button" onClick={() => setHoScopeId(null)} className="ms-auto rounded-full px-3 py-1 text-[11.5px] font-extrabold text-white transition hover:brightness-110" style={{ background: accent }}>{t("p8fr.scopeBackAll")}</button>
        </>
      ) : (
        <span className="ms-auto text-[12px] text-[var(--ink-3)]">{t(franchises.length === 1 ? "p8fr.scopeNetworkOne" : "p8fr.scopeNetworkOther", { count: franchises.length })}</span>
      )}
    </div>
  );
}

/** Full-width banner shown under the header while scoped into a franchise. */
export function HoScopeBanner() {
  const t = useT();
  const franchises = useFranchises();
  const scope = useHoScope();
  if (!scope || !franchises) return null;
  const own = scope === HO_OWN;
  const f = own ? null : franchises.find((x) => x.franchiseId === scope);
  if (!own && !f) return null;
  const label = own ? t("p8fr.scopeOwn") : `${f!.name}${f!.area ? ` · ${f!.area}` : ""}`;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#e6d8f6] bg-[#faf6ff] px-4 py-1.5 text-[12px] font-bold text-[#7a3aa8]">
      <span>{boldify(t(own ? "p8fr.scopeBannerOwn" : "p8fr.scopeBannerFr", { label }))}</span>
      <button type="button" onClick={() => setHoScopeId(null)} className="ms-auto rounded-full bg-[#7a3aa8] px-3 py-0.5 text-[11px] font-extrabold text-white hover:brightness-110">{t("p8fr.scopeBackHo")}</button>
      <Link href="/company/territories" className="rounded-full border border-[#d9c4ee] px-3 py-0.5 text-[11px] font-extrabold text-[#7a3aa8] no-underline hover:bg-white">{t("p8fr.scopeTerritories")}</Link>
    </div>
  );
}
