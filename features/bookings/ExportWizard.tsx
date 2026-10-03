"use client";

import { useMemo, useState } from "react";
import type { Booking } from "./types";
import {
  EXPORT_COLUMNS,
  EXPORT_PRESETS,
  bookingKids,
  columnsFor,
  csvFilename,
  inDateRange,
  money,
} from "./helpers";
import { downloadCsv, printRows, localizedColumns, localizedCsv } from "./exportFile";
import { Button } from "@/components/ui";
import { useT, useWord, useI18n } from "@/lib/i18n/provider";
import { pickPlural } from "@/lib/i18n/plural";

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
const PAYMENTS = ["Paid", "Unpaid", "Invoice sent", "Awaiting voucher payment", "Refund pending", "Refunded", "Partially refunded", "Funded"];

/**
 * How the place was funded. Read from the payment method rather than a field
 * of its own — Tax-Free Childcare and HAF are how a family paid, and that is
 * what the booking records. Anything else is self-funded.
 */
const FUNDING = [
  { key: "tfc", label: "bxFundTfc", match: (m: string) => /tax-?free/i.test(m) },
  { key: "haf", label: "bxFundHaf", match: (m: string) => /\bhaf\b/i.test(m) },
  {
    key: "self",
    label: "bxFundSelf",
    match: (m: string) => !/tax-?free/i.test(m) && !/\bhaf\b/i.test(m),
  },
];

export function ExportWizard({ bookings, onClose }: { bookings: Booking[]; onClose: () => void }) {
  const t = useT();
  const w = useWord();
  const { locale } = useI18n();
  const isRTL = locale === "ar" || locale === "ur";
  const allSfx = t("p8lst.bxAllSuffix");
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
  const colLabel = (k: string, en: string) => { const r = t("p8lst.bxCol_" + k); return r === "p8lst.bxCol_" + k ? en : r; };
  const ordered = EXPORT_COLUMNS.filter((c) => keys.includes(c.key));

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const activeFilters =
    (text ? 1 : 0) + (listings.length ? 1 : 0) + (statuses.length ? 1 : 0) +
    (pays.length ? 1 : 0) + (funds.length ? 1 : 0) + (methods.length ? 1 : 0) +
    (from || to ? 1 : 0) + (min || max ? 1 : 0);

  const countsText = `${pickPlural(t, locale, "p8lst.bxBookingN", rows.length)} · ${pickPlural(t, locale, "p8lst.bxAttendeeN", heads)}`;
  const subtitle = [
    pickPlural(t, locale, "p8lst.bxBookingN", rows.length),
    pickPlural(t, locale, "p8lst.bxAttendeeN", heads),
    from || to ? `${from || t("p8lst.bxStart")} ${isRTL ? "←" : "→"} ${to || t("p8lst.bxEnd")}` : null,
    listings.length ? listings.join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const run = () => {
    if (!rows.length || !keys.length) return;
    if (format === "csv") downloadCsv(csvFilename("bookings"), localizedCsv(rows, keys));
    else printRows(rows, localizedColumns(keys), t("p8lst.bxPdfTitle"), subtitle, (b) => (typeof b.amount === "number" ? b.amount : 0));
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
            <h3 className="m-0 font-[var(--ff-display)] text-[17px] font-extrabold">{t("p8lst.bxTitle")}</h3>
            <div className="text-[11.5px] text-[var(--ink-3)]">
              {t("p8lst.bxSub")}
            </div>
          </div>
          <span onClick={onClose} className="ms-auto cursor-pointer text-[22px] text-[var(--ink-3)]">
            ×
          </span>
        </div>

        <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
          {/* ── 1. Which bookings ─────────────────────────────────────── */}
          <div>
            <div className="mb-2 flex items-baseline gap-2">
              <b className="text-[13px]">{t("p8lst.bxStep1")}</b>
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
                  {t("p8lst.bxClear", { n: activeFilters })}
                </button>
              )}
            </div>

            <label className={lab}>{t("p8lst.bxSearchLbl")}</label>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("p8lst.bxSearchPh")}
              className={`${field} mb-3`}
            />

            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className={lab}>{t("p8lst.bxFrom")}</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={field} />
              </div>
              <div>
                <label className={lab}>{t("p8lst.bxTo")}</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
              </div>
            </div>

            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className={lab}>{t("p8lst.bxPriceFrom")}</label>
                <input type="number" min={0} step="0.01" value={min} onChange={(e) => setMin(e.target.value)} placeholder="0" className={field} />
              </div>
              <div>
                <label className={lab}>{t("p8lst.bxPriceTo")}</label>
                <input type="number" min={0} step="0.01" value={max} onChange={(e) => setMax(e.target.value)} placeholder={t("p8lst.bxAny")} className={field} />
              </div>
            </div>

            {listingNames.length > 1 && (
              <>
                <label className={lab}>{t("p8lst.bxListings")} {listings.length ? `(${listings.length})` : allSfx}</label>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {listingNames.map((n) => (
                    <button key={n} type="button" onClick={() => toggle(listings, n, setListings)} className={chip(listings.includes(n))}>
                      {n}
                    </button>
                  ))}
                </div>
              </>
            )}

            <label className={lab}>{t("p8lst.bxStatus")} {statuses.length ? `(${statuses.length})` : allSfx}</label>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button key={s} type="button" onClick={() => toggle(statuses, s, setStatuses)} className={chip(statuses.includes(s))}>
                  {w(s)}
                </button>
              ))}
            </div>

            <label className={lab}>{t("p8lst.bxPayment")} {pays.length ? `(${pays.length})` : allSfx}</label>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {PAYMENTS.map((p) => (
                <button key={p} type="button" onClick={() => toggle(pays, p, setPays)} className={chip(pays.includes(p))}>
                  {p === "Awaiting voucher payment" ? w("Voucher pending") : p === "Funded" ? w("Funded") : w(p)}
                </button>
              ))}
            </div>

            {methodNames.length > 1 && (
              <>
                <label className={lab}>{t("p8lst.bxBookingType")} {methods.length ? `(${methods.length})` : allSfx}</label>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {methodNames.map((m) => (
                    <button key={m} type="button" onClick={() => toggle(methods, m, setMethods)} className={chip(methods.includes(m))}>
                      {w(m)}
                    </button>
                  ))}
                </div>
              </>
            )}

            <label className={lab}>{t("p8lst.bxFunding")} {funds.length ? `(${funds.length})` : allSfx}</label>
            <div className="flex flex-wrap gap-1.5">
              {FUNDING.map((f) => (
                <button key={f.key} type="button" onClick={() => toggle(funds, f.key, setFunds)} className={chip(funds.includes(f.key))}>
                  {t("p8lst." + f.label)}
                </button>
              ))}
            </div>
          </div>

          {/* ── 2. Which columns ──────────────────────────────────────── */}
          <div>
            <div className="mb-2 flex items-baseline gap-2">
              <b className="text-[13px]">{t("p8lst.bxStep2")}</b>
              <span className="text-[11px] text-[var(--ink-3)]">{t("p8lst.bxColumnsN", { n: keys.length })}</span>
            </div>

            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {EXPORT_PRESETS.map((p) => {
                const on = p.keys.length === keys.length && p.keys.every((k) => keys.includes(k));
                return (
                  <button key={p.name} type="button" title={t("p8lst.bxPre" + p.name + "Hint")} onClick={() => setKeys(p.keys)} className={chip(on)}>
                    {t("p8lst.bxPre" + p.name)}
                  </button>
                );
              })}
              <button type="button" onClick={() => setKeys([])} className={chip(false)}>
                {t("p8lst.bxNone")}
              </button>
            </div>

            <div className="max-h-[260px] overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5">
              {(["Booking", "Family", "Children", "Activity", "Extras", "Cancellation"] as const).map((g) => (
                <div key={g} className="mb-2 last:mb-0">
                  <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.07em] text-[var(--ink-3)]">
                    {t("p8lst.bxGrp" + g)}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {EXPORT_COLUMNS.filter((c) => c.group === g).map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => toggle(keys, c.key, setKeys)}
                        className={chip(keys.includes(c.key))}
                      >
                        {colLabel(c.key, c.label)}
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
            <b className="text-[13px]">{t("p8lst.bxStep3")}</b>
            <span className="text-[11px] text-[var(--ink-3)]">
              {t("p8lst.bxShowing", { n: Math.min(3, rows.length), total: rows.length })}
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]">
            {rows.length === 0 || cols.length === 0 ? (
              <div className="p-4 text-center text-[12px] text-[var(--ink-3)]">
                {cols.length === 0 ? t("p8lst.bxPickCol") : t("p8lst.bxNoMatch")}
              </div>
            ) : (
              <table className="w-full border-collapse text-[11.5px]">
                <thead>
                  <tr>
                    {ordered.map((c) => (
                      <th
                        key={c.key}
                        className="whitespace-nowrap border-b border-[var(--line)] px-2.5 py-1.5 text-start text-[9.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]"
                      >
                        {colLabel(c.key, c.label)}
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
              ["csv", t("p8lst.bxFmtCsv")],
              ["pdf", t("p8lst.bxFmtPdf")],
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
            {countsText} ·{" "}
            <b className="text-[var(--ink)]">{money(total)}</b>
          </div>

          <div className="ms-auto flex gap-2">
            <Button onClick={onClose}>{t("p8lst.bxCancel")}</Button>
            <Button variant="primary" disabled={!rows.length || !keys.length} onClick={run}>
              {format === "csv" ? t("p8lst.bxDownload") : t("p8lst.bxPrint")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
