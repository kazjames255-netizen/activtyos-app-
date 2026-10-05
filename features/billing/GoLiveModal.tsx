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
  const [reply, setReply] = useState("");
  const [replySaved, setReplySaved] = useState(false);
  const [replyConfirmed, setReplyConfirmed] = useState(false);
  const [step, setStep] = useState<number | null>(null);
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
  async function saveReply() {
    await patchSettings((st) => { st.billing = { ...((st.billing as Record<string, unknown>) ?? {}), email: reply.trim() }; });
    setReplySaved(true);
    setReplyConfirmed(true);
  }

  const planDone = !!s?.planStarted;
  const payDone = !!s?.payChosen;
  const stepDone = [planDone, payDone, replyConfirmed];
  // One step at a time: start on the first one not done yet; Back / Next move between them.
  const firstOpen = stepDone.findIndex((d) => !d);
  const cur = step ?? (firstOpen === -1 ? 2 : firstOpen);
  const ready = goLiveReady(s);
  const dots = (
    <div className="mt-2 flex items-center gap-1.5" aria-label={`Step ${cur + 1} of 3`}>
      {[0, 1, 2].map((i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= cur ? "var(--brand,#2f4fa8)" : "var(--line)" }} />)}
    </div>
  );
  const choice = (title: string, note: string, done: boolean, action: React.ReactNode) => (
    <div className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: done ? "#12805a" : "var(--line)", background: done ? "#eefaf2" : "transparent" }}>
      <div className="min-w-0 flex-1"><div className="text-[14px] font-extrabold">{done ? "✓ " : ""}{title}</div><div className="text-[12.5px] text-[var(--ink-3)]">{note}</div></div>
      <div className="flex-none">{action}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 p-3" role="dialog" aria-modal="true" aria-label="Before you go live">
      <div className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 text-[var(--ink)] shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[20px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Before you go live</div>
            <p className="mt-0.5 text-[12.5px] text-[var(--ink-3)]">Step {cur + 1} of 3. Your listing stays saved while you do these.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[20px] leading-none text-[var(--ink-3)]">×</button>
        </div>
        {dots}

        {!s ? <p className="py-6 text-center text-[13px] text-[var(--ink-3)]">Checking…</p> : (
          <div className="mt-4">
            {cur === 0 && (
              <>
                <div className="text-[16px] font-extrabold">Start your free trial</div>
                <p className="mt-1 text-[13px] text-[var(--ink-2)]">{planDone ? "Your free trial is running." : "Add a card to start your 7-day free trial. You are not charged until it ends, and you can cancel any time."}</p>
                {!planDone && <a href={`${base}/billing`} target="_blank" rel="noreferrer"><Button variant="primary" className="mt-3">Start my free trial</Button></a>}
                {!planDone && <p className="mt-2 text-[11.5px] text-[var(--ink-3)]">It opens in a new tab. Come back here when you are done and this ticks itself.</p>}
              </>
            )}
            {cur === 1 && (
              <>
                <div className="text-[16px] font-extrabold">Your bank details <span className="ms-1 rounded-full bg-[var(--brand-soft,#e6ecff)] px-2 py-0.5 text-[11px] text-[var(--brand-ink,#1d3a8f)]">Required</span></div>
                <p className="mb-3 mt-1 text-[13px] text-[var(--ink-2)]">So parents can book and pay you. Bank transfers, Tax-Free Childcare and vouchers all pay into this account, and it is shown on your invoices.</p>
                {s.pay.bank ? (
                  <div className="rounded-xl border border-[#12805a] bg-[#eefaf2] p-3 text-[14px] font-extrabold">✓ Bank details saved</div>
                ) : (
                  <BankDetailsCard onSaved={refresh} />
                )}
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--line)] p-3">
                  <div className="min-w-0 flex-1"><div className="text-[13.5px] font-extrabold">{s.pay.stripe ? "✓ " : ""}Also take card payments <span className="font-semibold text-[var(--ink-3)]">(optional, recommended)</span></div>
                    <div className="text-[12px] text-[var(--ink-3)]">Cards, Apple Pay and Google Pay, paid straight to you. You can do this later.</div></div>
                  {s.pay.stripe ? <span className="text-[12px] font-bold text-[#12805a]">Ready</span> : <a href={`${base}/billing?tab=paid`} target="_blank" rel="noreferrer"><Button sm>Connect Stripe</Button></a>}
                </div>
              </>
            )}
            {cur === 2 && (
              <>
                <div className="text-[16px] font-extrabold">Where should parents' replies go?</div>
                <p className="mt-1 text-[13px] text-[var(--ink-2)]">When a parent replies to one of your emails, it goes here. Make sure it is an inbox you read.</p>
                <div className="mt-2 flex gap-2"><Input type="email" value={reply} onChange={(e) => { setReply(e.target.value); setReplySaved(false); setReplyConfirmed(false); }} placeholder="you@example.com" className="min-w-0 flex-1" aria-label="Reply-to email" />
                  <Button sm onClick={() => void saveReply()} disabled={!reply.includes("@")}>{replySaved ? "Saved" : "Save"}</Button></div>
              </>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div>{cur > 0 ? <Button onClick={() => setStep(cur - 1)}>Back</Button> : <Button onClick={onClose}>Not yet</Button>}</div>
          <div className="flex gap-2">
            {cur > 0 && <Button onClick={onClose}>Not yet</Button>}
            {cur < 2 ? (
              <Button variant="primary" disabled={!stepDone[cur]} onClick={() => setStep(cur + 1)}>Next</Button>
            ) : (
              <Button variant="primary" disabled={!ready || !reply.includes("@") || !!busy} onClick={() => { void saveReply().then(onGoLive); }} className="!bg-[#e9a915] !border-[#e9a915] !text-[#2a1d00]">{busy ? "Going live…" : "Go live"}</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
