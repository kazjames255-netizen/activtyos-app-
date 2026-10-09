"use client";

// Manager view of staff expense claims (/api/expense-claims): approve, decline,
// or mark paid. Approving adds the claim to Money out as an expense, so the
// Expenses list refreshes after. Only renders when there's something to show.
import { dateLocale as dl, uiDate } from "@/lib/i18n/format";
import { useCallback, useEffect, useState } from "react";
import { get as apiGet, api } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import { catLabel } from "./finI18n";

interface Claim { id: string; staffName?: string; date: string; category: string; amount: number; note?: string; receiptUrl?: string; receiptName?: string; status: "submitted" | "approved" | "paid" | "declined"; submittedAt: string }

const gbp = (n: number) => "£" + (n || 0).toLocaleString(dl(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TONE: Record<Claim["status"], { bg: string; ink: string; label: string }> = {
  submitted: { bg: "#fff7e6", ink: "#b45309", label: "p8fin.scWaiting" },
  approved: { bg: "#eaf4ff", ink: "#1d6fb8", label: "p8fin.scApprovedToPay" },
  paid: { bg: "#eafaf0", ink: "#0f7a43", label: "p8fin.gPaid" },
  declined: { bg: "#fdecec", ink: "#c0392b", label: "p8fin.scDeclined" },
};

export function StaffClaimsPanel({ onChanged }: { onChanged?: () => void }) {
  const t = useT();
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const load = useCallback(() => apiGet<Claim[]>("/api/expense-claims").then((c) => setClaims(Array.isArray(c) ? c : [])).catch(() => setClaims([])), []);
  useEffect(() => { void load(); }, [load]);
  if (!claims || claims.length === 0) return null;

  const open = claims.filter((c) => c.status === "submitted" || c.status === "approved");
  const done = claims.filter((c) => c.status === "paid" || c.status === "declined");
  const act = async (c: Claim, status: "approved" | "declined" | "paid") => {
    if (status === "declined" && !window.confirm(c.staffName ? t("p8fin.scConfirmDeclineNamed", { name: c.staffName, amount: gbp(c.amount) }) : t("p8fin.scConfirmDeclineThis", { amount: gbp(c.amount) }))) return;
    setBusy(c.id);
    try { await api(`/api/expense-claims/${c.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); onChanged?.(); } catch { /* shown by the list staying as it was */ }
    setBusy(null);
  };
  const rows = showDone ? [...open, ...done] : open;

  return (
    <div className="mb-3.5 rounded-2xl border border-[var(--line)] bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[14px] font-extrabold text-[var(--ink)]">{t("p8fin.scTitle")}</span>
        {open.length > 0 && <span className="rounded-full bg-[#fff7e6] px-2 py-0.5 text-[11px] font-extrabold text-[#b45309]">{t("p8fin.scToDeal", { n: open.length, amount: gbp(open.reduce((n, c) => n + c.amount, 0)) })}</span>}
        {done.length > 0 && <button type="button" onClick={() => setShowDone((v) => !v)} className="ms-auto text-[11.5px] font-bold text-[#1d3a8f] hover:underline">{showDone ? t("p8fin.scHideFinished") : t("p8fin.scShowFinished", { n: done.length })}</button>}
      </div>
      {rows.length === 0 ? <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8fin.scNothing")}</div> : (
        <ul className="divide-y divide-[var(--line)]">
          {rows.map((c) => { const tone = TONE[c.status]; return (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><b className="text-[13.5px] text-[var(--ink)]">{c.staffName ?? t("p8fin.scStaff")}</b><span className="text-[12.5px] text-[var(--ink-2)]">{catLabel(t, c.category)}</span>
                  <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: tone.bg, color: tone.ink }}>{t(tone.label)}</span></div>
                <div className="text-[12px] text-[var(--ink-3)]">{uiDate(new Date(c.date + "T00:00:00"), { day: "numeric", month: "short", year: "numeric" })}{c.note ? ` · ${c.note}` : ""}{c.receiptUrl ? <> · <a href={c.receiptUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-[#1d3a8f] hover:underline">📎 {c.receiptName || t("p8fin.exReceiptLink")}</a></> : ` · ${t("p8fin.scNoReceipt")}`}</div>
              </div>
              <b className="text-[14px] tabular-nums text-[var(--ink)]">{gbp(c.amount)}</b>
              <div className="flex gap-1.5">
                {c.status === "submitted" && <>
                  <button type="button" disabled={busy === c.id} onClick={() => void act(c, "approved")} className="rounded-lg bg-[#1d3a8f] px-2.5 py-1.5 text-[11.5px] font-extrabold text-white disabled:opacity-50">{t("p8fin.scApprove")}</button>
                  <button type="button" disabled={busy === c.id} onClick={() => void act(c, "declined")} className="rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[11.5px] font-extrabold text-[#c0392b] disabled:opacity-50">{t("p8fin.scDecline")}</button>
                </>}
                {c.status === "approved" && <button type="button" disabled={busy === c.id} onClick={() => void act(c, "paid")} className="rounded-lg bg-[#0f7a43] px-2.5 py-1.5 text-[11.5px] font-extrabold text-white disabled:opacity-50">{t("p8fin.exMarkPaid")}</button>}
              </div>
            </li>
          ); })}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-[var(--ink-3)]">{t("p8fin.scFooter")}</p>
    </div>
  );
}
