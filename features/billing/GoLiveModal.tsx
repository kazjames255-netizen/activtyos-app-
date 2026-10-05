"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { portalOf } from "@/lib/portal-href";
import { get as apiGet, put as apiPut } from "@/lib/api";
import { Button, Input } from "@/components/ui";
import { BankDetailsCard } from "@/features/billing/BillingPayoutsApp";

// The "Before you go live" pop-up shown when a NEW provider presses Go live on their first listing. Three things, each ticked off as
// it is done: (1) the plan (starts the 7-day trial), (2) at least one way for parents to pay (Stripe cards, bank details, or an
// explicit "I only take cash"), (3) the address replies to their emails go to. The plan and Stripe steps open Billing & payouts in a
// new tab (the listing draft is safe in this tab) and the pop-up re-checks whenever the tab regains focus.

interface Status { planStarted: boolean; payChosen: boolean; pay: { stripe: boolean; bank: boolean; cashOnly: boolean }; replyTo: string }

export async function fetchGoLive(): Promise<Status | null> {
  try { return await apiGet<Status>("/api/subscription/go-live"); } catch { return null; }
}
export const goLiveReady = (s: Status | null) => !s || (s.planStarted && s.payChosen);

export function GoLiveModal({ onClose, onGoLive, busy }: { onClose: () => void; onGoLive: () => void; busy?: boolean }) {
  const portal = portalOf(usePathname());
  const [s, setS] = useState<Status | null>(null);
  const [showBank, setShowBank] = useState(false);
  const [reply, setReply] = useState("");
  const [replySaved, setReplySaved] = useState(false);
  const base = `/${portal === "franchise" ? "company" : portal}`;

  const refresh = useCallback(() => { void fetchGoLive().then((x) => { if (x) { setS(x); setReply((r) => r || x.replyTo); } }); }, []);
  useEffect(() => {
    refresh();
    const f = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", f);
    window.addEventListener("focus", refresh);
    return () => { document.removeEventListener("visibilitychange", f); window.removeEventListener("focus", refresh); };
  }, [refresh]);

  async function patchSettings(fn: (settings: Record<string, unknown>) => void) {
    const lib = await apiGet<{ settings?: Record<string, unknown> } | null>("/api/library");
    const settings = { ...(lib?.settings ?? {}) };
    fn(settings);
    await apiPut("/api/library", { settings });
  }
  async function setCashOnly(v: boolean) { await patchSettings((st) => { st.cashOnly = v; }); refresh(); }
  async function saveReply() {
    await patchSettings((st) => { st.billing = { ...((st.billing as Record<string, unknown>) ?? {}), email: reply.trim() }; });
    setReplySaved(true);
  }

  const tick = (ok: boolean) => (
    <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-[12px] font-bold" style={ok ? { background: "#12805a", color: "#fff" } : { border: "2px solid var(--line)", color: "transparent" }}>✓</span>
  );
  const ready = goLiveReady(s);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 p-3" role="dialog" aria-modal="true" aria-label="Before you go live">
      <div className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 text-[var(--ink)] shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[20px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Before you go live</div>
            <p className="mt-0.5 text-[12.5px] text-[var(--ink-3)]">Two quick things, so parents can book and pay you. Your listing stays saved while you do them.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[20px] leading-none text-[var(--ink-3)]">×</button>
        </div>

        {!s ? <p className="py-6 text-center text-[13px] text-[var(--ink-3)]">Checking…</p> : (
          <>
            <div className="mt-4 flex gap-3 rounded-xl border border-[var(--line)] p-3">
              {tick(s.planStarted)}
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-extrabold">1 · Your plan <span className="ms-1 rounded-full bg-[var(--brand-soft,#e6ecff)] px-2 py-0.5 text-[11px] text-[var(--brand-ink,#1d3a8f)]">Required</span></div>
                <p className="text-[12.5px] text-[var(--ink-3)]">{s.planStarted ? "Your free trial is running." : "Add a card to start your 7-day free trial. You are not charged until it ends, and you can cancel any time."}</p>
                {!s.planStarted && <a href={`${base}/billing`} target="_blank" rel="noreferrer"><Button variant="primary" className="mt-2">Start my free trial</Button></a>}
              </div>
            </div>

            <div className="mt-3 flex gap-3 rounded-xl border border-[var(--line)] p-3">
              {tick(s.payChosen)}
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-extrabold">2 · How will parents pay you? <span className="ms-1 rounded-full bg-[var(--brand-soft,#e6ecff)] px-2 py-0.5 text-[11px] text-[var(--brand-ink,#1d3a8f)]">Choose at least one</span></div>
                <div className="mt-2 flex flex-col gap-2 text-[13px]">
                  <div className="flex items-center justify-between gap-2"><span>{s.pay.stripe ? "✓ " : ""}Cards, Apple Pay and Google Pay</span>
                    {s.pay.stripe ? <span className="text-[12px] font-bold text-[#12805a]">Ready</span> : <a href={`${base}/billing?tab=paid`} target="_blank" rel="noreferrer"><Button sm>Connect Stripe</Button></a>}</div>
                  <div className="flex items-center justify-between gap-2"><span>{s.pay.bank ? "✓ " : ""}Bank transfer</span>
                    {s.pay.bank ? <span className="text-[12px] font-bold text-[#12805a]">Bank details added</span> : <Button sm onClick={() => setShowBank((v) => !v)}>{showBank ? "Hide" : "Add bank details"}</Button>}</div>
                  {showBank && !s.pay.bank && <BankDetailsCard onSaved={() => { setShowBank(false); refresh(); }} />}
                  <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={s.pay.cashOnly} onChange={(e) => void setCashOnly(e.target.checked)} className="h-4 w-4" /> I only take cash</label>
                </div>
              </div>
            </div>

            <div className="mt-3 flex gap-3 rounded-xl border border-[var(--line)] p-3">
              {tick(replySaved || !!s.replyTo)}
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-extrabold">3 · Where should parents' replies go?</div>
                <p className="text-[12.5px] text-[var(--ink-3)]">When a parent replies to one of your emails, it goes here. Make sure it is an inbox you read.</p>
                <div className="mt-1.5 flex gap-2"><Input type="email" value={reply} onChange={(e) => { setReply(e.target.value); setReplySaved(false); }} placeholder="you@example.com" className="min-w-0 flex-1" aria-label="Reply-to email" />
                  <Button sm onClick={() => void saveReply()} disabled={!reply.includes("@")}>{replySaved ? "Saved" : "Save"}</Button></div>
              </div>
            </div>
          </>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <Button onClick={onClose}>Not yet</Button>
          <Button variant="primary" disabled={!ready || !!busy} onClick={onGoLive} className="!bg-[#e9a915] !border-[#e9a915] !text-[#2a1d00]">{busy ? "Going live…" : "Go live"}</Button>
        </div>
      </div>
    </div>
  );
}
