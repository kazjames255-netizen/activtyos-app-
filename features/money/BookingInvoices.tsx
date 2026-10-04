"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { getMe } from "@/components/auth/PortalGuard";
import { money } from "@/features/bookings/helpers";
import type { Booking } from "@/features/bookings/types";
import { Button, Card } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { InvoicesApp } from "@/features/money/InvoicesApp";

/** A provider-made booking still waiting on its invoice / pay-link to be paid. */
export function isAwaitingInvoicePayment(b: Pick<Booking, "status" | "pay" | "method">): boolean {
  if (b.status !== "Confirmed") return false;
  if (b.pay === "Invoice sent") return true;
  return b.pay === "Unpaid" && /invoice|link/i.test(b.method ?? "");
}

const actionsUrl = (ref: string) => `/api/bookings/${encodeURIComponent(ref)}/actions`;

function BookingInvoicesList() {
  const t = useT();
  const [rows, setRows] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiGet<Booking[]>("/api/bookings")
      .then((b) => { setRows(Array.isArray(b) ? b : []); setError(null); })
      .catch((e) => { setError(e instanceof Error ? e.message : String(e)); setRows((p) => p ?? []); });
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["bookings"], refresh);

  const list = useMemo(() => (rows ?? []).filter(isAwaitingInvoicePayment), [rows]);
  const total = list.reduce((s, b) => s + (b.amount - (b.amountPaid ?? 0) > 0 ? b.amount - (b.amountPaid ?? 0) : 0), 0);

  async function run(b: Booking, type: "resend" | "paid") {
    setBusy(`${b.ref}:${type}`); setNote(null); setError(null);
    try {
      await apiPost<Booking>(actionsUrl(b.ref), { type });
      setNote(type === "resend" ? t("p8fin.bkInvResent") : t("p8fin.bkInvPaid"));
      refresh();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="booking-invoices">
      <p className="m-0 text-[12.5px] text-[var(--ink-3)]">{t("p8fin.bkInvIntro")}{list.length > 0 && <> <b className="text-[var(--ink)]">{money(total)}</b></>}</p>
      {error && <div className="rounded-lg border border-[#f5c2c7] bg-[#fdecee] px-3 py-2 text-[12.5px] font-semibold text-[#9b1c2c]">{error}</div>}
      {note && <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[12.5px] font-semibold text-[var(--ink)]">{note}</div>}
      {rows && list.length === 0 && <Card className="px-4 py-6 text-center text-[13px] text-[var(--ink-3)]">{t("p8fin.bkInvEmpty")}</Card>}
      {list.map((b) => (
        <Card key={b.ref} data-ui="card" className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <div className="min-w-[110px]">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t("p8fin.bkInvRef")}</div>
            <div className="text-[13px] font-extrabold text-[var(--ink)]">{b.ref}</div>
          </div>
          <div className="min-w-[160px] flex-1">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t("p8fin.bkInvFamily")}</div>
            <div className="text-[13px] font-bold text-[var(--ink)]">{b.booker}</div>
            <div className="text-[11.5px] text-[var(--ink-3)]">{b.child} · {b.listing}</div>
          </div>
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t("p8fin.bkInvAmount")}</div>
            <div className="text-[13px] font-extrabold text-[var(--ink)]">{money(b.amount)}</div>
          </div>
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t("p8fin.bkInvStatus")}</div>
            <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-[10.5px] font-bold text-[#9a3412]">{b.pay === "Invoice sent" ? t("p8fin.bkInvSent") : t("p8fin.bkInvAwaiting")}</span>
          </div>
          <div className="ms-auto flex gap-2">
            <Button sm disabled={busy !== null || !b.email.includes("@")} title={b.email.includes("@") ? undefined : t("p8fin.bkInvNoEmail")} onClick={() => run(b, "resend")}>{t("p8fin.bkInvResend")}</Button>
            <Button sm variant="primary" disabled={busy !== null} onClick={() => run(b, "paid")}>{t("p8fin.bkInvMarkPaid")}</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

/** The Invoices screen: manual invoices (unchanged) + the bookings waiting on an invoice / pay-link. Managers and owners get the second tab. */
export function InvoicesWithBookings({ embedded = false }: { embedded?: boolean }) {
  const t = useT();
  const [tab, setTab] = useState<"invoices" | "bookings">("invoices");
  const [canSee, setCanSee] = useState(false);
  useEffect(() => { getMe().then((m) => setCanSee(m.role !== "staff")).catch(() => {}); }, []);
  return (
    <div className="flex flex-col gap-3">
      {canSee && (
        <div role="tablist" className="inline-flex w-fit gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1">
          {([["invoices", t("p8fin.bkInvTabInvoices")], ["bookings", t("p8fin.bkInvTabBookings")]] as const).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className="rounded-xl px-4 py-1.5 text-[12.5px] font-bold transition-colors" style={tab === k ? { background: "#1d3a8f", color: "#fff" } : { color: "#1d3a8f" }}>{label}</button>
          ))}
        </div>
      )}
      {tab === "bookings" && canSee ? <BookingInvoicesList /> : <InvoicesApp embedded={embedded} />}
    </div>
  );
}
