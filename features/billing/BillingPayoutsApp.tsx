"use client";

import { bankDetailsValid } from "@/lib/billingRules";
import { StepDonePrompt } from "@/features/dashboard/StepDonePrompt";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { portalOf } from "@/lib/portal-href";
import { useT } from "@/lib/i18n/provider";
import { get as apiGet, put as apiPut } from "@/lib/api";
import { Button, Card, FieldLabel, Input } from "@/components/ui";
import { SubscriptionApp } from "@/features/money/SubscriptionApp";
import { PaymentsApp } from "@/features/payments/PaymentsApp";

// ─────────────────────────────────────────────────────────────────────────
// Billing and payouts: ONE page for the two separate money flows.
//   · Your Name TBC plan  — the provider pays Name TBC (card, 7-day trial, monthly).
//   · Get paid by parents — parents pay the provider (Stripe Connect, or bank details on invoices).
// They are separate Stripe things on purpose, so the page says so up front. The old "Subscription" and "Get paid"
// routes still work; this view just puts them side by side with plain wording.
// ─────────────────────────────────────────────────────────────────────────

type Tab = "plan" | "paid";

/** `bare` = no card chrome / heading / intro, for use inside a pop-up that already explains it. */
export function BankDetailsCard({ onSaved, bare }: { onSaved?: () => void; bare?: boolean } = {}) {
  const t = useT();
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
    if (!bankDetailsValid(sortCode, accountNumber)) { setState("error"); return; }
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

  const inner = (
    <>
      {!bare && (<>
      <div className="text-[14px] font-extrabold">{t("p9tx.glBank")} <span className="ms-1 rounded-full bg-[var(--brand-soft,#e6ecff)] px-2 py-0.5 text-[11px] text-[var(--brand-ink,#1d3a8f)]">{t("p9tx.glRequired")}</span></div>
      <p className="mt-0.5 text-[12.5px] text-[var(--ink-3)]">
        {t("p9tx.glBankWhy")} {t("p9tx.bpCardSep")}
      </p>
      </>)}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div><FieldLabel htmlFor="bp-bank">{t("p9tx.bpBankName")}</FieldLabel><Input id="bp-bank" value={bankName} onChange={(e) => { setBankName(e.target.value); setState("idle"); }} placeholder={t("p9tx.bpBankNamePh")} className="w-full" /></div>
        <div><FieldLabel htmlFor="bp-sort">{t("p9tx.bpSortCode")}</FieldLabel><Input id="bp-sort" inputMode="numeric" value={sortCode} onChange={(e) => { setSortCode(e.target.value); setState("idle"); }} placeholder="00-00-00" className="w-full" /></div>
        <div><FieldLabel htmlFor="bp-acc">{t("p9tx.bpAccNo")}</FieldLabel><Input id="bp-acc" inputMode="numeric" value={accountNumber} onChange={(e) => { setAccountNumber(e.target.value); setState("idle"); }} placeholder="12345678" className="w-full" /></div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button variant="primary" onClick={() => void save()} disabled={state === "saving"}>{state === "saving" ? t("p9tx.bpSaving") : t("p9tx.bpSaveBank")}</Button>
        {state === "saved" && <span className="text-[12.5px] font-bold text-[var(--green,#0f7a43)]">{t("p9tx.glSaved")}</span>}
        {state === "error" && <span className="text-[12.5px] font-bold text-[var(--red,#e21d27)]">{t("p9tx.bpBankBad")}</span>}
      </div>
    </>
  );
  return bare ? <div>{inner}</div> : <Card className="mb-4 p-4">{inner}</Card>;
}

export function BillingPayoutsApp() {
  const t = useT();
  const portal = portalOf(usePathname());
  const isFranchise = portal === "franchise";
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "plan";
    return new URLSearchParams(window.location.search).get("tab") === "paid" ? "paid" : "plan";
  });
  // The state initialiser can't see the URL when the page is server-rendered first (it says "plan"), so a deep link like
  // /billing?tab=paid opened the wrong tab. Re-read the address once mounted, and on back/forward.
  useEffect(() => {
    const sync = () => { const q = new URLSearchParams(window.location.search).get("tab"); if (q === "paid" || q === "plan") setTab(q); };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
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
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("p9tx.bpTitle")}</h2>
      <p className="mb-3 max-w-[70ch] text-[12.5px] text-[var(--ink-3)]">
        {t("p9tx.bpIntro")}
      </p>
      {!isFranchise && (
        <div className="mb-4 flex flex-col gap-2.5 sm:flex-row">
          {tabBtn("plan", t("p9tx.bpTabPlan"), t("p9tx.bpTabPlanSub"))}
          {tabBtn("paid", t("p9tx.bpTabPaid"), t("p9tx.bpTabPaidSub"))}
        </div>
      )}
      {tab === "plan" && !isFranchise ? <SubscriptionApp /> : (
        <>
          <StepDonePrompt step="pay" />
          <BankDetailsCard />
          <p className="mb-3 text-[12.5px] text-[var(--ink-3)]">
            {t("p9tx.bpTenMin")}{" "}
            <a href="/help/get-paid" target="_blank" rel="noreferrer" className="font-bold text-[var(--brand-2,#2f6bd8)] underline">{t("p9tx.bpGuide")}</a>.
          </p>
          <PaymentsApp />
        </>
      )}
    </div>
  );
}
