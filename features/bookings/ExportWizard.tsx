"use client";

import { useMemo, useState } from "react";
import type { Booking } from "./types";
import {
  EXPORT_COLUMNS,
  EXPORT_PRESETS,
  bookingKids,
  bookingsToCsv,
  columnsFor,
  csvFilename,
  inDateRange,
  money,
  payLabel,
} from "./helpers";
import { downloadCsv, printBookings } from "./exportFile";
import { Button } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// Export wizard — narrow the bookings, choose the columns, pick a format.
//
// Three things it deliberately does. It counts as you go, so you never export
// blind; it previews the first rows, so a wrong column is obvious before the
// file lands; and its filters are its own, separate from the screen's, so
// exporting a finance report doesn't disturb the list you were working.
// ─────────────────────────────────────────────────────────────────────────

type Format = "csv" | "pdf";

const STATUSES = ["Approval needed", "Confirmed", "Waitlisted", "Offered", "Cancelled", "Declined"];
const PAYMENTS = ["Paid", "Unpaid", "Invoice sent", "Awaiting voucher payment", "Refunded", "Partially refunded", "Funded"];

/**
 * How the place was funded. Read from the payment method rather than a field
 * of its own — Tax-Free Childcare and HAF are how a family paid, and that is
 * what the booking records. Anything else is self-funded.
 */
const FUNDING = [
  { key: "tfc", label: "Tax-Free Childcare", match: (m: string) => /tax-?free/i.test(m) },
  { key: "haf", label: "HAF funded", match: (m: string) => /\bhaf\b/i.test(m) },
  {
    key: "self",
    label: "Self-funded",
    match: (m: string) => !/tax-?free/i.test(m) && !/\bhaf\b/i.test(m),
  },
];

export function ExportWizard({ bookings, onClose }: { bookings: Booking[]; onClose: () => void }) {
  const [text, setText] = useState("");
  const [listings, setListings] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [pays, setPays] = useState<string[]>([]);
  const [funds, setFunds] = useState<string[]>([]);
  const [methods, setMethods] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [keys, setKeys] = useState<string[]>(EXPORT_PRESETS[1].keys);
  const [format, setFormat] = useState<Format>("csv");

  const listingNames = useMemo(
    () => [...new Set(bookings.map((b) => b.listing).filter(Boolean))].sort(),
    [bookings],
  );
  // Taken from the bookings rather than a fixed list, so it offers what is
  // actually in use — a provider who never takes PayPal shouldn't see it.
  const methodNames = useMemo(
    () => [...new Set(bookings.map((b) => b.method).filter((m) => m && m !== "—"))].sort(),
    [bookings],
  );

  const rows = useMemo(() => {
    const q = text.trim().toLowerCase();
    const lo = min.trim() === "" ? null : parseFloat(min);
    const hi = max.trim() === "" ? null : parseFloat(max);
    return bookings.filter((b) => {
      if (q) {
        const hay = [b.booker, b.email, b.ref, b.bid, b.listing, ...bookingKids(b).map((k) => k.name)]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (listings.length && !listings.includes(b.listing)) return false;
      if (statuses.length && !statuses.includes(b.status)) return false;
      if (pays.length && !pays.includes(b.pay)) return false;
      if (methods.length && !methods.includes(b.method)) return false;
      if (funds.length) {
        const m = b.method ?? "";
        if (!funds.some((k) => FUNDING.find((f) => f.key === k)?.match(m))) return false;
      }
      if (!inDateRange(b, from, to)) return false;
      const amt = typeof b.amount === "number" ? b.amount : 0;
      if (lo !== null && Number.isFinite(lo) && amt < lo) return false;
      if (hi !== null && Number.isFinite(hi) && amt > hi) return false;
      return true;
    });
  }, [bookings, text, listings, statuses, pays, funds, methods, from, to, min, max]);

  const total = rows.reduce((s, b) => s + (typeof b.amount === "number" ? b.amount : 0), 0);
  const heads = rows.reduce((s, b) => s + bookingKids(b).length, 0);
  const cols = columnsFor(keys);
  const ordered = EXPORT_COLUMNS.filter((c) => keys.includes(c.key));

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const activeFilters =
    (text ? 1 : 0) + (listings.length ? 1 : 0) + (statuses.length ? 1 : 0) +
    (pays.length ? 1 : 0) + (funds.length ? 1 : 0) + (methods.length ? 1 : 0) +
    (from || to ? 1 : 0) + (min || max ? 1 : 0);

  const subtitle = [
    `${rows.length} booking${rows.length === 1 ? "" : "s"}`,
    `${heads} attendee${heads === 1 ? "" : "s"}`,
    from || to ? `${from || "start"} → ${to || "end"}` : null,
    listings.length ? listings.join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const run = () => {
    if (!rows.length || !keys.length) return;
    if (format === "csv") downloadCsv(csvFilename("bookings"), bookingsToCsv(rows, keys));
    else printBookings(rows, keys, "Bookings", subtitle);
    onClose();
  };

  const chip = (on: boolean) =>
    "cursor-pointer rounded-full border px-2.5 py-[3px] text-[11.5px] font-semibold transition-colors " +
    (on
      ? "border-[var(--brand)] bg-[var(--brand)] text-white"
      : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--ink-3)]");

  const field =
    "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] outline-none";
  const lab = "mb-1 block text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-[var(--ink-3)]";

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-auto bg-black/55 px-3.5 py-8"
    >
      <div className="w-full max-w-[1000px] rounded-2xl border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] shadow-[0_24px_60px_rgba(0,0,0,.5)]">
        <div className="flex items-center gap-2.5 border-b border-[var(--line)] px-5 py-3.5">
          <div>
            <h3 className="m-0 font-[var(--ff-display)] text-[17px] font-extrabold">Export bookings</h3>
            <div className="text-[11.5px] text-[var(--ink-3)]">
              Narrow them down, choose what goes in, pick a format.
            </div>
          </div>
          <span onClick={onClose} className="ml-auto cursor-pointer text-[22px] text-[var(--ink-3)]">
            ×
          </span>
        </div>

        <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
          {/* ── 1. Which bookings ─────────────────────────────────────── */}
          <div>
            <div className="mb-2 flex items-baseline gap-2">
              <b className="text-[13px]">1 · Which bookings</b>
              {activeFilters > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setText("");
                    setListings([]);
                    setStatuses([]);
                    setPays([]);
                    setFunds([]);
                    setMethods([]);
                    setFrom("");
                    setTo("");
                    setMin("");
                    setMax("");
                  }}
                  className="text-[11px] font-semibold text-[var(--ink-3)] hover:underline"
                >
                  Clear {activeFilters}
                </button>
              )}
            </div>

            <label className={lab}>Name, email, ref or listing</label>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Doyle, or APF-103"
              className={`${field} mb-3`}
            />

            <div className="mb-3 grid grid-cols-2 gap-2">
              <div>
                <label className={lab}>Runs on or after</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={field} />
              </div>
              <div>
                <label className={lab}>and on or before</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
              </div>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <div>
                <label className={lab}>Price from £</label>
                <input type="number" min={0} step="0.01" value={min} onChange={(e) => setMin(e.target.value)} placeholder="0" className={field} />
              </div>
              <div>
                <label className={lab}>up to £</label>
                <input type="number" min={0} step="0.01" value={max} onChange={(e) => setMax(e.target.value)} placeholder="any" className={field} />
              </div>
            </div>

            {listingNames.length > 1 && (
              <>
                <label className={lab}>Listings {listings.length ? `(${listings.length})` : "— all"}</label>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {listingNames.map((n) => (
                    <button key={n} type="button" onClick={() => toggle(listings, n, setListings)} className={chip(listings.includes(n))}>
                      {n}
                    </button>
                  ))}
                </div>
              </>
            )}

            <label className={lab}>Status {statuses.length ? `(${statuses.length})` : "— all"}</label>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button key={s} type="button" onClick={() => toggle(statuses, s, setStatuses)} className={chip(statuses.includes(s))}>
                  {s}
                </button>
              ))}
            </div>

            <label className={lab}>Payment {pays.length ? `(${pays.length})` : "— all"}</label>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {PAYMENTS.map((p) => (
                <button key={p} type="button" onClick={() => toggle(pays, p, setPays)} className={chip(pays.includes(p))}>
                  {payLabel(p)}
                </button>
              ))}
            </div>

            {methodNames.length > 1 && (
              <>
                <label className={lab}>Booking type {methods.length ? `(${methods.length})` : "— all"}</label>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {methodNames.map((m) => (
                    <button key={m} type="button" onClick={() => toggle(methods, m, setMethods)} className={chip(methods.includes(m))}>
                      {m}
                    </button>
                  ))}
                </div>
              </>
            )}

            <label className={lab}>Childcare funding {funds.length ? `(${funds.length})` : "— all"}</label>
            <div className="flex flex-wrap gap-1.5">
              {FUNDING.map((f) => (
                <button key={f.key} type="button" onClick={() => toggle(funds, f.key, setFunds)} className={chip(funds.includes(f.key))}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── 2. Which columns ──────────────────────────────────────── */}
          <div>
            <div className="mb-2 flex items-baseline gap-2">
              <b className="text-[13px]">2 · What goes in</b>
              <span className="text-[11px] text-[var(--ink-3)]">{keys.length} columns</span>
            </div>

            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {EXPORT_PRESETS.map((p) => {
                const on = p.keys.length === keys.length && p.keys.every((k) => keys.includes(k));
                return (
                  <button key={p.name} type="button" title={p.hint} onClick={() => setKeys(p.keys)} className={chip(on)}>
                    {p.name}
                  </button>
                );
              })}
              <button type="button" onClick={() => setKeys([])} className={chip(false)}>
                None
              </button>
            </div>

            <div className="max-h-[260px] overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5">
              {(["Booking", "Family", "Children", "Activity", "Extras", "Cancellation"] as const).map((g) => (
                <div key={g} className="mb-2 last:mb-0">
                  <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.07em] text-[var(--ink-3)]">
                    {g}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {EXPORT_COLUMNS.filter((c) => c.group === g).map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => toggle(keys, c.key, setKeys)}
                        className={chip(keys.includes(c.key))}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Preview ─────────────────────────────────────────────────── */}
        <div className="px-5 pb-1">
          <div className="mb-1.5 flex items-baseline gap-2">
            <b className="text-[13px]">3 · Check it</b>
            <span className="text-[11px] text-[var(--ink-3)]">
              first {Math.min(3, rows.length)} of {rows.length}
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]">
            {rows.length === 0 || cols.length === 0 ? (
              <div className="p-4 text-center text-[12px] text-[var(--ink-3)]">
                {cols.length === 0 ? "Choose at least one column." : "No bookings match those filters."}
              </div>
            ) : (
              <table className="w-full border-collapse text-[11.5px]">
                <thead>
                  <tr>
                    {ordered.map((c) => (
                      <th
                        key={c.key}
                        className="whitespace-nowrap border-b border-[var(--line)] px-2.5 py-1.5 text-left text-[9.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]"
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 3).map((b) => (
                    <tr key={b.ref}>
                      {ordered.map((c) => (
                        <td
                          key={c.key}
                          className="max-w-[220px] truncate border-b border-[var(--line)] px-2.5 py-1.5 text-[var(--ink)] last:border-0"
                        >
                          {String(c.get(b) ?? "") || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Format & go ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2.5 px-5 py-4">
          <div className="inline-flex rounded-full border border-[var(--line)] bg-[var(--surface)] p-0.5">
            {([
              ["csv", "CSV / Excel"],
              ["pdf", "PDF / print"],
            ] as [Format, string][]).map(([f, l]) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className="rounded-full px-3 py-1 text-[11.5px] font-bold transition-colors"
                style={format === f ? { background: "var(--brand)", color: "#fff" } : { color: "var(--ink-3)" }}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="text-[11.5px] text-[var(--ink-3)]">
            {rows.length} booking{rows.length === 1 ? "" : "s"} · {heads} attendee{heads === 1 ? "" : "s"} ·{" "}
            <b className="text-[var(--ink)]">{money(total)}</b>
          </div>

          <div className="ml-auto flex gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={!rows.length || !keys.length} onClick={run}>
              {format === "csv" ? "⬇ Download CSV" : "🖨 Open print / PDF"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
