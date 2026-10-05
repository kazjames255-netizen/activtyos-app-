"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { portalOf } from "@/lib/portal-href";
import { get as apiGet, put as apiPut } from "@/lib/api";
import { Button, Card, FieldLabel, Input } from "@/components/ui";
import { SubscriptionApp } from "@/features/money/SubscriptionApp";
import { PaymentsApp } from "@/features/payments/PaymentsApp";

// ─────────────────────────────────────────────────────────────────────────
// Billing and payouts: ONE page for the two separate money flows.
//   · Your Activly plan  — the provider pays ActivityOS (card, 7-day trial, monthly).
//   · Get paid by parents — parents pay the provider (Stripe Connect, or bank details on invoices).
// They are separate Stripe things on purpose, so the page says so up front. The old "Subscription" and "Get paid"
// routes still work; this view just puts them side by side with plain wording.
// ─────────────────────────────────────────────────────────────────────────

type Tab = "plan" | "paid";

export function BankDetailsCard({ onSaved }: { onSaved?: () => void } = {}) {
  const [bankName, setBankName] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [accountName, setAccountName] = useState("");

  useEffect(() => {
    apiGet<{ settings?: { billing?: { bankName?: string; sortCode?: string; accountNumber?: string; accountName?: string } } } | null>("/api/library")
      .then((lib) => {
        const b = lib?.settings?.billing;
        if (b) { setBankName(b.bankName ?? ""); setSortCode(b.sortCode ?? ""); setAccountNumber(b.accountNumber ?? ""); setAccountName(b.accountName ?? ""); }
      })
      .catch(() => {});
  }, []);

  async function save() {
    setState("saving");
    try {
      // Read-modify-write: the library PUT replaces `settings` wholesale.
      const lib = await apiGet<{ settings?: Record<string, unknown> } | null>("/api/library");
      const settings = { ...(lib?.settings ?? {}) };
      const billing: Record<string, unknown> = { ...((settings.billing as Record<string, unknown>) ?? {}), bankName: bankName.trim(), sortCode: sortCode.trim(), accountNumber: accountNumber.trim() };
      if (accountName) billing.accountName = accountName;
      settings.billing = billing;
      await apiPut("/api/library", { settings });
      setState("saved");
      onSaved?.();
    } catch { setState("error"); }
  }

  return (
    <Card className="mb-4 p-4">
      <div className="text-[14px] font-extrabold">Bank details for invoices</div>
      <p className="mt-0.5 text-[12.5px] text-[var(--ink-3)]">
        Shown on your invoices and to parents who pay by bank transfer, Tax-Free Childcare or vouchers, so they know where to send money.
        Card payments go to the account you give Stripe, below.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div><FieldLabel htmlFor="bp-bank">Bank name</FieldLabel><Input id="bp-bank" value={bankName} onChange={(e) => { setBankName(e.target.value); setState("idle"); }} placeholder="e.g. Barclays" className="w-full" /></div>
        <div><FieldLabel htmlFor="bp-sort">Sort code</FieldLabel><Input id="bp-sort" inputMode="numeric" value={sortCode} onChange={(e) => { setSortCode(e.target.value); setState("idle"); }} placeholder="00-00-00" className="w-full" /></div>
        <div><FieldLabel htmlFor="bp-acc">Account number</FieldLabel><Input id="bp-acc" inputMode="numeric" value={accountNumber} onChange={(e) => { setAccountNumber(e.target.value); setState("idle"); }} placeholder="12345678" className="w-full" /></div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button variant="primary" onClick={() => void save()} disabled={state === "saving"}>{state === "saving" ? "Saving…" : "Save bank details"}</Button>
        {state === "saved" && <span className="text-[12.5px] font-bold text-[var(--green,#0f7a43)]">Saved</span>}
        {state === "error" && <span className="text-[12.5px] font-bold text-[var(--red,#e21d27)]">Couldn't save. Try again.</span>}
      </div>
    </Card>
  );
}

export function BillingPayoutsApp() {
  const portal = portalOf(usePathname());
  const isFranchise = portal === "franchise";
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "plan";
    return new URLSearchParams(window.location.search).get("tab") === "paid" ? "paid" : "plan";
  });
  const pick = (t: Tab) => {
    setTab(t);
    try { const u = new URL(window.location.href); u.searchParams.set("tab", t); window.history.replaceState(null, "", u.toString()); } catch { /* ignore */ }
  };

  const tabBtn = (id: Tab, label: string, sub: string) => (
    <button type="button" onClick={() => pick(id)} aria-pressed={tab === id}
      className="min-w-0 flex-1 rounded-2xl border-2 px-4 py-3 text-start transition-colors"
      style={tab === id ? { borderColor: "var(--brand-2, #2f6bd8)", background: "var(--brand-soft, #e6ecff)" } : { borderColor: "var(--line)", background: "var(--surface)" }}>
      <div className="text-[14.5px] font-extrabold text-[var(--ink)]">{label}</div>
      <div className="text-[12px] text-[var(--ink-3)]">{sub}</div>
    </button>
  );

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Billing and payouts</h2>
      <p className="mb-3 max-w-[70ch] text-[12.5px] text-[var(--ink-3)]">
        Two separate things live here. You pay Activly for your plan, and parents pay you for their bookings. They use different
        accounts on purpose, so you can pay for your plan with one card and get paid into a different bank if you like.
      </p>
      {!isFranchise && (
        <div className="mb-4 flex flex-col gap-2.5 sm:flex-row">
          {tabBtn("plan", "Your Activly plan", "What you pay us: 7-day free trial, then monthly")}
          {tabBtn("paid", "Get paid by parents", "Card payments and bank details for invoices")}
        </div>
      )}
      {tab === "plan" && !isFranchise ? <SubscriptionApp /> : (
        <>
          <BankDetailsCard />
          <p className="mb-3 text-[12.5px] text-[var(--ink-3)]">
            Taking card payments takes about 10 minutes, so have your photo ID and bank details ready.{" "}
            <a href="/help/get-paid" target="_blank" rel="noreferrer" className="font-bold text-[var(--brand-2,#2f6bd8)] underline">Read the step-by-step Get paid guide</a>.
          </p>
          <PaymentsApp />
        </>
      )}
    </div>
  );
}
