"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money, payLabelFor, payTone, refundedTotal } from "@/features/bookings/helpers";
import type { Booking } from "@/features/bookings/types";
import { PayModal } from "@/features/payments/PayModal";
import { Badge, Button, Card } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// custdash/payments — the family's money in one place, straight from their
// bookings: what's owed now (payable by card right here), what's been paid,
// and every refund that's come back. Replaces the legacy prototype iframe.
// ─────────────────────────────────────────────────────────────────────────

const OWED = new Set(["Unpaid", "Invoice sent"]);

export function PaymentsApp() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<string[] | null>(null); // refs being paid

  const refresh = useCallback(() => {
    apiGet<Booking[]>("/api/my/bookings")
      .then(setBookings)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn’t load your payments"));
  }, []);
  useEffect(refresh, [refresh]);
  useRealtime(["bookings"], refresh);

  const { owed, paid, refunds, owedTotal, paidTotal, refundTotal } = useMemo(() => {
    const all = (bookings ?? []).filter((b) => b.status !== "Declined");
    const owed = all.filter((b) => b.status !== "Cancelled" && OWED.has(b.pay) && b.amount > 0);
    const paid = all.filter((b) => b.pay === "Paid" || b.pay === "Funded");
    const refunds = all.flatMap((b) => (b.refundLog ?? []).map((r) => ({ ...r, ref: b.ref, listing: b.listing })));
    return {
      owed,
      paid,
      refunds,
      owedTotal: owed.reduce((s, b) => s + b.amount, 0),
      paidTotal: paid.reduce((s, b) => s + b.amount - refundedTotal(b), 0),
      refundTotal: refunds.reduce((s, r) => s + (r.amount || 0), 0),
    };
  }, [bookings]);

  if (error) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!bookings) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading your payments…</div>;

  const Row = ({ b, action }: { b: Booking; action?: boolean }) => (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-dashed border-[var(--line)] py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold">{b.listing}</div>
        <div className="text-[11.5px] text-[var(--ink-3)]">
          {b.child} · {b.dates} · Ref {b.ref}
        </div>
      </div>
      <Badge tone={payTone(b.pay)}>{payLabelFor(b)}</Badge>
      <span className="w-[72px] text-right text-[13.5px] font-extrabold">{money(b.amount)}</span>
      {action && (
        <Button sm variant="primary" onClick={() => setPaying([b.ref])}>
          Pay now
        </Button>
      )}
    </div>
  );

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-4">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Payments</h2>
        <p className="text-[12.5px] text-[var(--ink-3)]">
          Everything your family owes and has paid, live from your bookings. Wallet credit lives in{" "}
          <Link href="/custdash/wallet" className="font-bold text-[var(--brand-2,#2f6bd8)]">Wallet</Link>.
        </p>
      </div>

      {/* Totals */}
      <div className="mb-4 flex flex-wrap gap-2.5">
        {[
          { big: money(owedTotal), small: "To pay now", hot: owedTotal > 0 },
          { big: money(paidTotal), small: "Paid to date" },
          { big: money(refundTotal), small: "Refunded back" },
        ].map((t) => (
          <div key={t.small} className="min-w-[120px] flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3">
            <div className="text-[20px] font-extrabold leading-none" style={{ fontFamily: "var(--ff-display)", color: t.hot ? "var(--red,#e21d27)" : "var(--brand)" }}>{t.big}</div>
            <div className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t.small}</div>
          </div>
        ))}
      </div>

      {owed.length > 0 && (
        <Card className="mb-3 p-4" style={{ borderLeftWidth: "4px", borderLeftColor: "var(--red,#e21d27)" }}>
          <div className="mb-1.5 text-[13px] font-extrabold">Waiting on payment</div>
          {owed.map((b) => <Row key={b.ref} b={b} action />)}
        </Card>
      )}

      <Card className="mb-3 p-4">
        <div className="mb-1.5 text-[13px] font-extrabold">Paid</div>
        {paid.length === 0 ? (
          <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">No payments yet.</div>
        ) : (
          [...paid].sort((a, b) => ((a.createdAt ?? "") < (b.createdAt ?? "") ? 1 : -1)).map((b) => <Row key={b.ref} b={b} />)
        )}
      </Card>

      {refunds.length > 0 && (
        <Card className="p-4">
          <div className="mb-1.5 text-[13px] font-extrabold">Refunds</div>
          {refunds.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-dashed border-[var(--line)] py-2 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-bold">{r.label}</div>
                <div className="text-[11.5px] text-[var(--ink-3)]">{r.listing} · Ref {r.ref} · {r.on}</div>
              </div>
              <span className="text-[13px] font-extrabold text-[#3f78d8]">+{money(r.amount || 0)}</span>
            </div>
          ))}
        </Card>
      )}

      {paying && <PayModal refs={paying} onClose={() => setPaying(null)} onPaid={refresh} />}
    </div>
  );
}
