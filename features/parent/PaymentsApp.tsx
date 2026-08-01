"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { money, payLabelFor, payTone, refundedTotal } from "@/features/bookings/helpers";
import type { Booking } from "@/features/bookings/types";
import { PayModal } from "@/features/payments/PayModal";
import { printReceipts, type ReceiptCtx } from "./paymentReceipt";
import { Badge, Button, Card } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// custdash — the family's money in one place, straight from their bookings:
// what's owed now (payable by card here), what's paid, and every refund.
// Parents can filter (child / activity / date range) and download a branded
// proof-of-purchase receipt per payment, or all of them at once.
// ─────────────────────────────────────────────────────────────────────────

const OWED = new Set(["Unpaid", "Invoice sent"]);

function Row({ b, action, onPay, onPdf }: { b: Booking; action?: boolean; onPay?: () => void; onPdf: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-dashed border-[var(--line)] py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold">{b.listing}</div>
        <div className="text-[11.5px] text-[var(--ink-3)]">
          {b.child} · {b.dates} · Ref {b.ref}
        </div>
      </div>
      <Badge tone={payTone(b.pay)}>{payLabelFor(b)}</Badge>
      <span className="w-[72px] text-right text-[13.5px] font-extrabold">{money(b.amount)}</span>
      <button
        onClick={onPdf}
        title="Download receipt (PDF)"
        className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-2)] hover:border-[var(--brand)]"
      >
        ↓ PDF
      </button>
      {action && (
        <Button sm variant="primary" onClick={onPay}>
          Pay now
        </Button>
      )}
    </div>
  );
}

export function PaymentsApp({ hideHeader = false }: { hideHeader?: boolean }) {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<string[] | null>(null); // refs being paid
  const [providerByTenant, setProviderByTenant] = useState<Record<string, string>>({});
  const [venueByListing, setVenueByListing] = useState<Record<string, { location?: string | null; address?: string | null }>>({});
  const [childF, setChildF] = useState("");
  const [listingF, setListingF] = useState("");
  const [fromF, setFromF] = useState("");
  const [toF, setToF] = useState("");
  const { settings } = useSettings();
  const brand = settings.providerName || settings.billing?.businessName || "";

  const refresh = useCallback(() => {
    apiGet<Booking[]>("/api/my/bookings")
      .then(setBookings)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn’t load your payments"));
  }, []);
  useEffect(refresh, [refresh]);
  useRealtime(["bookings"], refresh);

  // Provider names (for the receipt header) — a family may book several.
  useEffect(() => {
    apiGet<{ tenantId: string; name: string }[]>("/api/my/providers")
      .then((ps) => setProviderByTenant(Object.fromEntries((ps ?? []).map((p) => [p.tenantId, p.name]))))
      .catch(() => {});
  }, []);

  // Venue name/address per listing — for the Location line on receipts.
  useEffect(() => {
    const ids = [...new Set((bookings ?? []).map((b) => b.listingId).filter(Boolean) as string[])];
    ids.filter((id) => !venueByListing[id]).forEach((id) => {
      apiGet<{ library?: { venue?: { name?: string; address?: string } | null } }>(`/api/listings/${encodeURIComponent(id)}`)
        .then((l) => setVenueByListing((m) => ({ ...m, [id]: { location: l.library?.venue?.name ?? null, address: l.library?.venue?.address ?? null } })))
        .catch(() => {});
    });
  }, [bookings, venueByListing]);

  // Filter option lists (unbounded by the current filter so you can switch).
  const { childOptions, listingOptions } = useMemo(() => {
    const kids = new Set<string>();
    const listings = new Set<string>();
    for (const b of bookings ?? []) {
      if (b.kids && b.kids.length) b.kids.forEach((k) => k.name && kids.add(k.name));
      else if (b.child) kids.add(b.child);
      if (b.listing) listings.add(b.listing);
    }
    return { childOptions: [...kids].sort(), listingOptions: [...listings].sort() };
  }, [bookings]);

  const inRange = useCallback(
    (b: Booking) => {
      if (!fromF && !toF) return true;
      const ds = b.days ?? [];
      if (!ds.length) return true; // undated booking — don't hide it
      return ds.some((d) => (!fromF || d >= fromF) && (!toF || d <= toF));
    },
    [fromF, toF],
  );

  const matchF = useCallback(
    (b: Booking) =>
      (!childF || b.child === childF || (b.kids ?? []).some((k) => k.name === childF)) &&
      (!listingF || b.listing === listingF) &&
      inRange(b),
    [childF, listingF, inRange],
  );

  const { owed, paid, refunds, owedTotal, paidTotal, refundTotal } = useMemo(() => {
    const all = (bookings ?? []).filter((b) => b.status !== "Declined").filter(matchF);
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
  }, [bookings, matchF]);

  const ctx: ReceiptCtx = { brand, providerByTenant, venueByListing };
  const receiptable = useMemo(
    () => [...paid, ...owed].sort((a, b) => ((a.createdAt ?? "") < (b.createdAt ?? "") ? 1 : -1)),
    [paid, owed],
  );
  const filtersOn = !!(childF || listingF || fromF || toF);

  if (error) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!bookings) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading your payments…</div>;

  return (
    <div className="text-[var(--ink)]">
      {!hideHeader && (
        <div className="mb-4">
          <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Payments</h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">
            Everything your family owes and has paid, live from your bookings. Wallet credit lives in{" "}
            <Link href="/custdash/wallet" className="font-bold text-[var(--brand-2,#2f6bd8)]">Wallet</Link>.
          </p>
        </div>
      )}

      {/* Totals */}
      <div className="mb-3.5 flex flex-wrap gap-2.5">
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

      {/* Filters + bulk download */}
      <div className="mb-3.5 flex flex-wrap items-end gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">Child</span>
          <select value={childF} onChange={(e) => setChildF(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px]">
            <option value="">All children</option>
            {childOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">Activity</span>
          <select value={listingF} onChange={(e) => setListingF(e.target.value)} className="max-w-[200px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px]">
            <option value="">All activities</option>
            {listingOptions.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">From</span>
          <input type="date" value={fromF} onChange={(e) => setFromF(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px]" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">To</span>
          <input type="date" value={toF} onChange={(e) => setToF(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px]" />
        </label>
        {filtersOn && (
          <button onClick={() => { setChildF(""); setListingF(""); setFromF(""); setToF(""); }} className="py-1.5 text-[12px] font-bold text-[var(--ink-3)] hover:underline">
            Clear
          </button>
        )}
        <button
          onClick={() => printReceipts(receiptable, ctx)}
          disabled={!receiptable.length}
          className="ml-auto rounded-full px-3.5 py-2 text-[12px] font-bold text-white disabled:opacity-50"
          style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}
        >
          ↓ Download all ({receiptable.length}) as PDF
        </button>
      </div>

      {owed.length > 0 && (
        <Card className="mb-3 p-4" style={{ borderLeftWidth: "4px", borderLeftColor: "var(--red,#e21d27)" }}>
          <div className="mb-1.5 text-[13px] font-extrabold">Waiting on payment</div>
          {owed.map((b) => <Row key={b.ref} b={b} action onPay={() => setPaying([b.ref])} onPdf={() => printReceipts([b], ctx)} />)}
        </Card>
      )}

      <Card className="mb-3 p-4">
        <div className="mb-1.5 text-[13px] font-extrabold">Paid</div>
        {paid.length === 0 ? (
          <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">{filtersOn ? "No payments match these filters." : "No payments yet."}</div>
        ) : (
          [...paid].sort((a, b) => ((a.createdAt ?? "") < (b.createdAt ?? "") ? 1 : -1)).map((b) => <Row key={b.ref} b={b} onPdf={() => printReceipts([b], ctx)} />)
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
