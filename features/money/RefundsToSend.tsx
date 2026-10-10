"use client";

// "Refunds to send": offline (bank transfer / cash / voucher) refunds the provider has RECORDED but not yet transferred. The app cannot send that
// money, so this list is the provider's to-do: open the booking for the family's bank details, send the money, then press "I've sent it".

import { useRefundMethod } from "../bookings/useRefundMethod";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { post as apiPost } from "@/lib/api";
import { dateLocale as dl } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/provider";
import { Empty, Panel, money } from "./finance-kit";

import { daysWaiting, type RefundToSend } from "./refundsToSendRows";

export function RefundsToSend({ rows, onSent }: { rows: RefundToSend[]; onSent: () => void }) {
  const t = useT();
  const rmw = useRefundMethod();
  const router = useRouter();
  const portal = (usePathname() ?? "/").split("/")[1] || "app";
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());
  const total = rows.reduce((s, r) => s + r.amount, 0);

  async function sent(ref: string) {
    setBusy(ref); setErr(null);
    try { await apiPost(`/api/bookings/${encodeURIComponent(ref)}/actions`, { type: "refund-sent" }); setConfirming(null); onSent(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not mark it sent"); }
    setBusy(null);
  }

  return (
    <Panel title={t("p8lst.rfaToSendTitle")} right={rows.length ? <span className="text-[11px] font-bold text-[var(--ink-3)]">{rows.length} · {money(total)}</span> : undefined}>
      <div className="mb-2 text-[11.5px] text-[var(--ink-3)]">{t("p8lst.rfaToSendSub")}</div>
      {rows.length ? (
        <div className="flex flex-col divide-y divide-[var(--line)]" data-ui="refunds-to-send">
          {rows.map((r) => {
            const d = daysWaiting(r.since, nowMs);
            return (
              <div key={r.ref} className="py-2.5 text-[12.5px]" data-ref={r.ref}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="min-w-0 flex-1 truncate"><b>{r.name}</b>{r.listing && <span className="text-[var(--ink-3)]"> · {r.listing}</span>} <span className="text-[var(--ink-3)]">· {r.ref}</span></span>
                  <span className="whitespace-nowrap text-[11px] font-semibold" style={{ color: d >= 3 ? "#c02636" : "var(--ink-3)" }}>{t("p8lst.rfaDaysWaiting", { n: d })}</span>
                  {r.kinds?.length ? <span className="text-[11px] font-bold text-[#7a5b06]" data-ui="refund-send-line">{rmw.send(r.kinds, money(r.amount))}</span> : null}
                  <span className="w-16 text-end font-extrabold tabular-nums text-[#9a5a00]">{money(r.amount)}</span>
                  <button type="button" onClick={() => router.push(`/${portal}/bookings?ref=${encodeURIComponent(r.ref)}`)} className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--ink-2)]">{t("p8lst.rfaView")}</button>
                  <button type="button" onClick={() => setConfirming(confirming === r.ref ? null : r.ref)} className="rounded-full bg-[#1d3a8f] px-3 py-1 text-[11px] font-extrabold text-white hover:brightness-110">{t("p8lst.rfaBtnSent")}</button>
                </div>
                {confirming === r.ref && (
                  <div className="mt-2 rounded-lg border border-[#FAD4D0] bg-[#FFF7F6] px-3 py-2.5">
                    <div className="mb-1 text-[12.5px] font-extrabold text-[var(--red)]">{r.kinds?.length ? t("rfm.confHead", { amt: money(r.amount), how: rmw.how(r.kinds) }) : t("p8lst.rfaConfirmHead", { amt: money(r.amount) })}</div>
                    <div className="mb-2 text-[11.5px] text-[var(--ink-2)]">{r.kinds?.length ? t("rfm.confBody", { amt: money(r.amount), name: r.name, methods: rmw.names(r.kinds) }) : t("p8lst.rfaConfirmBody", { amt: money(r.amount), name: r.name })}</div>
                    <div className="flex gap-2">
                      <button type="button" disabled={busy === r.ref} onClick={() => void sent(r.ref)} className="rounded-full bg-[#1d3a8f] px-3 py-1 text-[11.5px] font-extrabold text-white disabled:opacity-60">{t("p8lst.rfaConfirmYes")}</button>
                      <button type="button" onClick={() => setConfirming(null)} className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[11.5px] font-bold text-[var(--ink-2)]">{t("p7bd.cfNotYet")}</button>
                    </div>
                    {err && <div className="mt-1 text-[11.5px] font-semibold text-[#c02636]">{err}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : <Empty>{t("p8lst.rfaToSendEmpty")}</Empty>}
    </Panel>
  );
}
