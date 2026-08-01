"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { money, payLabelFor, payTone, refundedTotal } from "@/features/bookings/helpers";
import type { Booking } from "@/features/bookings/types";
import { PayModal } from "@/features/payments/PayModal";
import { downloadReceipts, type ReceiptCtx } from "./paymentReceipt";
import { Badge, Button, Card } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// custdash — the family's money in one place, straight from their bookings.
// Filter (child / activity / date range), and download a branded, colour,
// proof-of-purchase PDF receipt — per payment, a multi-select batch, or the
// lot. Receipts are only offered once a payment has actually been made
// (card paid, or a provider marked another method paid).
// ─────────────────────────────────────────────────────────────────────────

const OWED = new Set(["Unpaid", "Invoice sent"]);
const methodOf = (b: Booking) => (b.method && b.method !== "—" ? b.method : "Card");

function Row({ b, action, onPay, onPdf, selectable, selected, onToggleSelect }: {
  b: Booking;
  action?: boolean;
  onPay?: () => void;
  onPdf?: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-dashed border-[var(--line)] py-2 last:border-b-0">
      {selectable && (
        <input type="checkbox" checked={!!selected} onChange={onToggleSelect} className="h-4 w-4 flex-none accent-[var(--brand)]" title="Select for batch download" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold">{b.listing}</div>
        <div className="text-[11.5px] text-[var(--ink-3)]">
          {b.child} · {b.dates} · Ref {b.ref}
        </div>
      </div>
      <span className="hidden w-[92px] text-right text-[11.5px] text-[var(--ink-3)] sm:inline">{methodOf(b)}</span>
      <Badge tone={payTone(b.pay)}>{payLabelFor(b)}</Badge>
      <span className="w-[72px] text-right text-[13.5px] font-extrabold">{money(b.amount)}</span>
      {onPdf ? (
        <button
          onClick={onPdf}
          title="Download receipt (PDF)"
          className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-2)] hover:border-[var(--brand)]"
        >
          ↓ PDF
        </button>
      ) : (
        <span className="w-[52px] text-right text-[10.5px] text-[var(--ink-3)]">receipt after payment</span>
      )}
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
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

  // Provider names (receipt header) — a family may book several.
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
      if (!ds.length) return true;
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
    const paid = all.filter((b) => b.pay === "Paid" || b.pay === "Funded")
      .sort((a, b) => ((a.createdAt ?? "") < (b.createdAt ?? "") ? 1 : -1));
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

  const ctx: ReceiptCtx = { brand, providerByTenant, venueByListing, logoUrl: settings.billing?.logoUrl };
  const filtersOn = !!(childF || listingF || fromF || toF);

  const toggleSel = (ref: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(ref)) n.delete(ref);
      else n.add(ref);
      return n;
    });
  const paidRefs = paid.map((b) => b.ref);
  const selectedShown = paidRefs.filter((r) => selected.has(r));
  const allSelected = paidRefs.length > 0 && selectedShown.length === paidRefs.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(paidRefs));
  const downloadSelected = () => void downloadReceipts(paid.filter((b) => selected.has(b.ref)), ctx);

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

      {/* Filters */}
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
      </div>

      {owed.length > 0 && (
        <Card className="mb-3 p-4" style={{ borderLeftWidth: "4px", borderLeftColor: "var(--red,#e21d27)" }}>
          <div className="mb-1.5 text-[13px] font-extrabold">Waiting on payment</div>
          {owed.map((b) => <Row key={b.ref} b={b} action onPay={() => setPaying([b.ref])} />)}
        </Card>
      )}

      <Card className="mb-3 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[13px] font-extrabold">Paid</div>
          {paid.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] font-bold text-[var(--ink-2)]">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-[var(--brand)]" />
                Select all
              </label>
              <button
                onClick={downloadSelected}
                disabled={!selectedShown.length}
                className="rounded-full px-3.5 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}
              >
                ↓ Download {selectedShown.length ? `${selectedShown.length} selected` : "selected"} (PDF)
              </button>
            </div>
          )}
        </div>
        {paid.length === 0 ? (
          <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">{filtersOn ? "No payments match these filters." : "No payments yet."}</div>
        ) : (
          paid.map((b) => (
            <Row
              key={b.ref}
              b={b}
              selectable
              selected={selected.has(b.ref)}
              onToggleSelect={() => toggleSel(b.ref)}
              onPdf={() => void downloadReceipts([b], ctx)}
            />
          ))
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
