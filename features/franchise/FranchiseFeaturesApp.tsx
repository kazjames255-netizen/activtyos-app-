"use client";

// Head-office feature control — a simple matrix to turn each main feature (page)
// ON/OFF per franchise, or for ALL of them at once. It writes the franchise's OWN
// `settings.features`, so a franchise can still change its features itself later
// in its Setup — this is just the HO's quick network-wide switch.

import { useEffect, useMemo, useState } from "react";
import { get as apiGet, api } from "@/lib/api";
import { Card } from "@/components/ui";
import { NAV_GROUPS } from "@/lib/nav/config";
import { CORE_VIEWS } from "@/lib/use-customer-area";

interface FrFeatures { franchiseId: string; name: string; features: Record<string, boolean> }

// Plain-English explainer for each togglable feature, keyed by nav view.
// Shown on the ⓘ hover next to the feature name so head office knows exactly
// what each switch turns on or off for a franchise.
const FEATURE_INFO: Record<string, string> = {
  listings: "Create and sell camps, clubs and classes — the listings and multi-week blocks parents book onto.",
  customers: "The families directory: every parent and child who has booked, with contact details and history.",
  ratios: "Set staff-to-child ratios and organise children into groups or rooms for each session.",
  trips: "Plan off-site trips and visits with consent forms, registers and headcounts.",
  schedule: "Rota staff onto shifts and sessions across the week.",
  calendar: "A shared events calendar for key dates, INSET days and one-off activities.",
  timetable: "Build the daily activity timetable that parents and staff can see.",
  tasks: "Assign, track and tick off jobs for the team — with a board, calendar and milestones.",
  staff: "Your team directory — invite staff, hold their records and manage onboarding.",
  payroll: "Run monthly pay, estimate PAYE/NI/pension and issue branded payslips.",
  holiday: "Staff request time off; approve or decline and see who's away and who needs covering.",
  timesheets: "Staff clock in and out with breaks; hours flow through to timesheets and pay.",
  compliance: "The Learning Centre — assign CPD courses and track staff completions.",
  marketing: "Create discount codes and offers to promote bookings.",
  referrals: "Reward families for referring friends who then book.",
  reviews: "Collect, moderate and showcase parent reviews and ratings.",
  "marketing-strategies": "Guided marketing playbooks and campaign ideas to grow bookings.",
  finance: "The money dashboard — revenue, spend and profit with charts and franchise breakdowns.",
  expenses: "Record and categorise outgoings, bills and purchase orders.",
  purchasing: "Log income and other money coming in beyond bookings.",
  reconciliation: "Match payments to bookings and reconcile the books.",
  royalties: "See royalty and fee splits owed to head office.",
  milestones: "A step-by-step operational timeline tracking each franchise's set-up progress.",
  ai: "The AI assistant that answers questions and drafts content from the franchise's own data.",
  support: "Raise support tickets and get help from head office.",
  registers: "Take daily attendance — sign children in and out with a live on-site count.",
  incidents: "Log safeguarding or behaviour concerns and share them with the right people.",
  medication: "Record medicines held, doses given and parent consent.",
  accidents: "Record first aid and accidents, and alert parents.",
  meals: "Plan menus and manage meal choices, allergens and orders.",
  moments: "Share photos and highlights of a child's day with their parents.",
  newsfeed: "Post announcements and updates to parents and staff.",
  messages: "Direct-message parents and staff, one-to-one or in groups.",
  email: "Send branded emails and newsletters to your audiences.",
};

// The togglable "main pages" a franchise has — the franchise nav minus the
// always-on essentials and non-feature views (mirrors Setup → Features).
const SKIP = new Set(["dash", "dashboard", "auth", "setup", "account", "subscription", "getpaid", "privacy"]);
function featureList(): { view: string; label: string }[] {
  const seen = new Set<string>();
  return (NAV_GROUPS.franchise ?? [])
    .flatMap((g) => g.items)
    .filter((it) => !it.hidden && !SKIP.has(it.view) && !CORE_VIEWS.has(it.view))
    .filter((it) => (seen.has(it.view) ? false : (seen.add(it.view), true)))
    .map((it) => ({ view: it.view, label: it.label ?? it.view }));
}

function Switch({ on, onChange, busy }: { on: boolean; onChange: (v: boolean) => void; busy?: boolean }) {
  return (
    <button type="button" disabled={busy} onClick={() => onChange(!on)} aria-pressed={on}
      className="relative inline-flex h-[22px] w-[38px] flex-none items-center rounded-full transition-colors disabled:opacity-50"
      style={{ background: on ? "#0f9d58" : "#cbd2de" }}>
      <span className="absolute h-[16px] w-[16px] rounded-full bg-[var(--surface)] shadow transition-transform" style={{ transform: on ? "translateX(19px)" : "translateX(3px)" }} />
    </button>
  );
}

export function FranchiseFeaturesApp() {
  const [rows, setRows] = useState<FrFeatures[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tip, setTip] = useState<{ label: string; text: string; x: number; y: number } | null>(null);
  const features = useMemo(featureList, []);

  function showTip(el: HTMLElement, ft: { view: string; label: string }) {
    const r = el.getBoundingClientRect();
    setTip({ label: ft.label, text: FEATURE_INFO[ft.view] ?? "Turns this feature on or off for the franchise.", x: r.right + 8, y: r.top + r.height / 2 });
  }

  useEffect(() => { apiGet<FrFeatures[]>("/api/franchises/features").then(setRows).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load")); }, []);

  const isOn = (f: FrFeatures, view: string) => f.features[view] !== false;
  const allOn = (view: string) => (rows ?? []).length > 0 && (rows ?? []).every((f) => isOn(f, view));

  async function toggle(fid: string, view: string, on: boolean) {
    setBusy(`${fid}:${view}`); setError(null);
    setRows((rs) => (rs ?? []).map((f) => (f.franchiseId === fid ? { ...f, features: { ...f.features, [view]: on } } : f)));
    try { await api(`/api/franchises/${fid}/features`, { method: "PUT", body: JSON.stringify({ view, on }) }); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't save"); apiGet<FrFeatures[]>("/api/franchises/features").then(setRows).catch(() => {}); }
    finally { setBusy(null); }
  }
  async function toggleAll(view: string, on: boolean) {
    setBusy(`__all__:${view}`); setError(null);
    setRows((rs) => (rs ?? []).map((f) => ({ ...f, features: { ...f.features, [view]: on } })));
    try { await api(`/api/franchises/__all__/features`, { method: "PUT", body: JSON.stringify({ view, on }) }); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't save"); apiGet<FrFeatures[]>("/api/franchises/features").then(setRows).catch(() => {}); }
    finally { setBusy(null); }
  }

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[#f6f6f8] p-5 text-[#171534]">
      <div className="max-w-[1600px]">
        <div className="op-hero relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,.5)]" style={{ background: "var(--hero-grad)" }}>
          <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-[16px]">🎛️</span>
            Feature control
          </div>
          <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-[1.5] text-white/80">Turn each feature on or off per franchise, or for the whole network at once. Franchises can still change their own features in their Setup — this is your quick master switch.</p>
        </div>

        {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#e21d27]">{error}</div>}
        {!rows ? (
          <div className="py-16 text-center text-[13px] text-[var(--ink-3)]">Loading…</div>
        ) : rows.length === 0 ? (
          <Card className="p-10 text-center text-[13px] text-[var(--ink-3)]">No franchises yet — invite one from <b>Invite franchises</b>.</Card>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#E4E9F5] bg-[var(--surface)] shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-auto border-collapse text-[12.5px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 w-[240px] min-w-[220px] border-b border-[#E4E9F5] bg-[var(--surface)] px-4 py-3 text-left text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-[#5F6A88] shadow-[6px_0_10px_-8px_rgba(20,35,90,.14)]">Feature</th>
                    <th className="w-[104px] border-b border-[#eef1f6] bg-[#faf9fe] px-2 py-3 text-center text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[#8a7fbf]">All</th>
                    {rows.map((f) => <th key={f.franchiseId} className="w-[116px] border-b border-[#eef1f6] px-3 py-3 text-center text-[11px] font-extrabold text-[#4a4763]"><div className="mx-auto max-w-[100px] truncate" title={f.name}>{f.name}</div></th>)}
                  </tr>
                </thead>
                <tbody>
                  {features.map((ft) => (
                    <tr key={ft.view} className="group">
                      <td className="sticky left-0 z-10 w-[240px] min-w-[220px] border-b border-[#E4E9F5] bg-[var(--surface)] px-4 py-3 font-bold text-[var(--ink)] shadow-[6px_0_10px_-8px_rgba(20,35,90,.12)] transition-colors group-hover:bg-[#E8EEFD]">
                        <span className="inline-flex items-center gap-1.5">
                          {ft.label}
                          <button type="button" aria-label={`What is ${ft.label}?`}
                            onMouseEnter={(e) => showTip(e.currentTarget, ft)} onMouseLeave={() => setTip(null)}
                            onFocus={(e) => showTip(e.currentTarget, ft)} onBlur={() => setTip(null)}
                            className="flex h-[15px] w-[15px] flex-none cursor-help items-center justify-center rounded-full border border-[#E4E9F5] text-[9.5px] font-bold leading-none text-[#2f5fd0] transition-colors hover:border-[#8a7fbf] hover:bg-[#E8EEFD] hover:text-[#2f5fd0]">
                            i
                          </button>
                        </span>
                      </td>
                      <td className="border-b border-[#E4E9F5] bg-[#E8EEFD] px-2 py-3 transition-colors group-hover:bg-[#E8EEFD]">
                        <div className="flex justify-center"><Switch on={allOn(ft.view)} busy={busy === `__all__:${ft.view}`} onChange={(v) => toggleAll(ft.view, v)} /></div>
                      </td>
                      {rows.map((f) => (
                        <td key={f.franchiseId} className="border-b border-[#f2f4f9] px-3 py-3 transition-colors group-hover:bg-[#fafbff]"><div className="flex justify-center"><Switch on={isOn(f, ft.view)} busy={busy === `${f.franchiseId}:${ft.view}`} onChange={(v) => toggle(f.franchiseId, ft.view, v)} /></div></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <p className="mt-3 text-[11.5px] text-[var(--ink-3)]">Turning a feature off removes it from that franchise&rsquo;s dashboard entirely. The always-on essentials (listings, finance, setup) can&rsquo;t be switched off.</p>
      </div>

      {tip && (
        <div role="tooltip"
          className="pointer-events-none fixed z-[200] w-[250px] -translate-y-1/2 rounded-xl border border-[#E4E9F5] bg-[var(--surface)] p-3 shadow-[0_16px_40px_-12px_rgba(30,25,70,.35)]"
          style={{ left: tip.x, top: tip.y }}>
          <div className="mb-1 text-[12px] font-extrabold text-[var(--ink)]">{tip.label}</div>
          <div className="text-[11.5px] leading-[1.5] text-[#44506F]">{tip.text}</div>
        </div>
      )}
    </div>
  );
}
