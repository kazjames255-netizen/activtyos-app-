"use client";

import { dateLocale as dl } from "@/lib/i18n/format";
import { useEffect, useMemo, useState } from "react";
import { useI18n, useT, useWord, tNow } from "@/lib/i18n/provider";
import { pickPlural } from "@/lib/i18n/plural";
import { get as apiGet } from "@/lib/api";
import { useBookingsStore } from "./store";
import {
  FILTER_TABS,
  attendeeCount,
  bookingKids,
  matchesFilter,
  payMethodCat,
  matchesSearch,
  money,
  payLabel,
  payLabelFor,
  pendingPayActionT,
  payMethodLabel,
  payTone,
  waitingForPlace,
  bookedOn,
  byNewest,
  rangeDays,
  runsOn,
  sessionCount,
  bookingDateSummary,
} from "./helpers";
import { Button, Card } from "@/components/ui";
import { Pill, PillSelect } from "@/features/listings/FreelancerListingsApp";
import { useSettings } from "@/lib/settings";
import { ExportWizard } from "./ExportWizard";
import { PageHero } from "@/components/OperatorPage";
import { seasonDisplayName } from "@/lib/seasons";

// Status → identity-panel gradient. Same hue family as the status pill, but a
// brighter, friendlier version (with a text shadow so white stays legible).
const HERO_GRAD: Record<string, string> = {
  "Confirmed": "linear-gradient(140deg,#3d7fe6,#1749a8)",        // deep blue (matches blue pill)
  "Approval needed": "linear-gradient(140deg,#f2a231,#cf7208)",  // deep amber
  "Waitlisted": "linear-gradient(140deg,#25ad68,#0b8446)",       // deep green (matches green pill)
  "Offered": "linear-gradient(140deg,#25ad68,#0b8446)",
  "Cancelled": "linear-gradient(140deg,#ee6d6d,#c93030)",        // deep coral (matches red pill)
  "Declined": "linear-gradient(140deg,#ee6d6d,#c93030)",
};
const heroGrad = (s: string) => HERO_GRAD[s] || "linear-gradient(140deg,#4f78e0,#2140a0)";
// The Status pill wears the SAME colour as the hero, so blue hero ⇢ blue pill.
const HERO_TONE: Record<string, { bg: string; fg: string }> = {
  "Confirmed": { bg: "#e1eafb", fg: "#1749a8" },
  "Approval needed": { bg: "#fbe6c6", fg: "#a85f08" },
  "Waitlisted": { bg: "#dbf2e6", fg: "#0b8446" },
  "Offered": { bg: "#dbf2e6", fg: "#0b8446" },
  "Cancelled": { bg: "#fbdede", fg: "#c53030" },
  "Declined": { bg: "#fbdede", fg: "#c53030" },
};
const heroTone = (s: string) => HERO_TONE[s] || { bg: "#e4e9fa", fg: "#2140a0" };

/**
 * The list. With a booking open it becomes the left rail of a split view:
 * same filters and search, rows compressed to a name, an activity and an
 * amount, because the detail beside it is showing everything else.
 */
/** "today", "yesterday", or "12 Jul" — the shape you'd say out loud. */
// Short "Mon 27 Jul" for a date-change swap shown on the row.
const fmtRowDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(dl(), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
};

function prettyBookedOn(b: { createdAt?: string }, t: (k: string) => string): string {
  const d = bookedOn(b as never);
  if (!d) return "";
  const today = new Date().toISOString().slice(0, 10);
  const y = new Date();
  y.setUTCDate(y.getUTCDate() - 1);
  if (d === today) return t("p7bkl.whenToday");
  if (d === y.toISOString().slice(0, 10)) return t("p7bkl.whenYesterday");
  return new Date(`${d}T00:00:00Z`).toLocaleDateString(dl(), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** One accent per Bookings tab, so the row isn't a wall of identical pills. */
const TAB_TONE: Record<string, string> = {
  all: "#1d3a8f", approval: "#d97706", confirmed: "#15803d", waitlisted: "#0e7490", unpaid: "#c2410c",
  unreconciled: "#7c3aed", cancelled: "#b91c1c", requests: "#be185d", refunds: "#4338ca",
};

export function BookingsList({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const w = useWord();
  const { locale } = useI18n();
  const bookings = useBookingsStore((s) => s.bookings);
  const filter = useBookingsStore((s) => s.filter);
  const query = useBookingsStore((s) => s.query);
  const selected = useBookingsStore((s) => s.selected);

  const setFilter = useBookingsStore((s) => s.setFilter);
  const setQuery = useBookingsStore((s) => s.setQuery);
  const toggleSel = useBookingsStore((s) => s.toggleSel);
  const clearSel = useBookingsStore((s) => s.clearSel);
  const selectMany = useBookingsStore((s) => s.selectMany);
  const bulk = useBookingsStore((s) => s.bulk);
  const open = useBookingsStore((s) => s.open);
  const openRef = useBookingsStore((s) => s.openRef);
  const openCreate = useBookingsStore((s) => s.openCreate);
  const act = useBookingsStore((s) => s.act);
  const askConfirm = useBookingsStore((s) => s.askConfirm);
  const resolveMove = useBookingsStore((s) => s.resolveMove);
  // Which request row has its "reason for declining" box open, and its text.
  const [denyingRef, setDenyingRef] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const submitDeny = (ref: string) => { resolveMove(ref, false, denyReason.trim() || undefined); setDenyingRef(null); setDenyReason(""); };

  // A listing / day / date-range / season narrow the list further, on top of
  // the status tab and search. Lives in the store (not local state) so
  // BookingsApp can mirror it into the URL — a refresh or Back used to reset
  // these silently.
  const listing = useBookingsStore((s) => s.listingFilter);
  const setListing = useBookingsStore((s) => s.setListingFilter);
  const day = useBookingsStore((s) => s.dayFilter);
  const setDay = useBookingsStore((s) => s.setDayFilter);
  const range = useBookingsStore((s) => s.rangeFilter);
  const setRange = useBookingsStore((s) => s.setRangeFilter);
  const season = useBookingsStore((s) => s.seasonFilter);
  const setSeason = useBookingsStore((s) => s.setSeasonFilter);
  const [exporting, setExporting] = useState(false);
  // Sub-filter by how they are paying, under the "Unpaid / invoiced" and "Unreconciled" tabs.
  const [payCat, setPayCat] = useState("");
  useEffect(() => { setPayCat(""); }, [filter]);

  const { settings } = useSettings();
  const seasons = settings.seasons ?? [];
  const seasonObj = seasons.find((s) => s.id === season);
  // Each listing carries its seasonId (set in the listing builder); map it so a
  // booking's season is its listing's season.
  const [listingSeason, setListingSeason] = useState<Record<string, string>>({});
  useEffect(() => { apiGet<{ id: string; seasonId?: string | null }[]>("/api/listings?mine=1").then((ls) => setListingSeason(Object.fromEntries(ls.filter((l) => l.seasonId).map((l) => [l.id, l.seasonId as string])))).catch(() => {}); }, []);
  const seasonNameOf = (listingId?: string) => { const id = listingId ? listingSeason[listingId] : undefined; return id ? seasons.find((s) => s.id === id)?.name : undefined; };

  const selCount = Object.keys(selected).filter((k) => selected[k]).length;
  const bounds = range ? rangeDays(range) : null;
  const list = useMemo(() => bookings
    .filter(
      (b) =>
        matchesFilter(b, filter) &&
        matchesSearch(b, query) &&
        (!payCat || payMethodCat(b) === payCat) &&
        (!listing || b.listing === listing) &&
        // A booking is "in" a season when its listing's seasonId matches.
        (!seasonObj || (!!b.listingId && listingSeason[b.listingId] === seasonObj.id)) &&
        (!bounds || (bookedOn(b) >= bounds.from && bookedOn(b) <= bounds.to)) &&
        runsOn(b, day),
    )
    // Newest first, always — the one that just came in is the one you haven't
    // seen. Sorted here rather than relying on whatever order the API returns.
    .sort(byNewest),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [bookings, filter, query, payCat, listing, seasonObj, listingSeason, bounds, day]);

  // Counts come from what the status tab and search already left, so a
  // listing showing "(3)" means three you can actually get to.
  const inScope = useMemo(() => bookings.filter((b) => matchesFilter(b, filter) && matchesSearch(b, query)),
    [bookings, filter, query]);
  // Anything taken before bookings recorded a date, and the per-listing counts
  // for the picker: one pass over `inScope` for both (this used to be a
  // `.filter().length` per distinct listing — a full re-scan of inScope for
  // EVERY listing name, on every render — the same "N scans instead of one"
  // shape as the leads dropdown-count bug).
  const { undated, listingOpts } = useMemo(() => {
    let undatedN = 0;
    const counts = new Map<string, number>();
    for (const b of inScope) {
      if (!b.createdAt) undatedN++;
      if (b.listing) counts.set(b.listing, (counts.get(b.listing) ?? 0) + 1);
    }
    const opts = [...counts.keys()].sort().map((name) => ({ name, n: counts.get(name)! }));
    return { undated: undatedN, listingOpts: opts };
  }, [inScope]);
  // One pass over `bookings` for every filter tab's count (not one full scan
  // of `bookings` per tab — FILTER_TABS has 9 entries, so this used to be 9
  // re-scans of the whole list on every render, including every keystroke).
  const tabCounts = useMemo(() => {
    const c: Record<string, number> = Object.fromEntries(FILTER_TABS.map(([key]) => [key, 0]));
    for (const b of bookings) for (const [key] of FILTER_TABS) if (matchesFilter(b, key)) c[key]++;
    return c;
  }, [bookings]);

  return (
    <div>
      {/* Header — the page title belongs to the page, not to a 264px rail. */}
      {!compact && (
      <PageHero
        title={t("p7nav.bookings")}
        lede={t("p7bkl.lede", { n: bookings.length })}
        icon="🎟️"
        actions={<>
          <Button
            disabled={bookings.length === 0}
            title={bookings.length ? t("p7bkl.exportTip") : t("p7bkl.nothingExport")}
            onClick={() => setExporting(true)}
          >
            {t("p7bkl.export")}
          </Button>
          <Button variant="primary" onClick={() => openCreate()} className="!bg-[#1d3a8f] !border-[#1d3a8f] !text-white">
            {t("p7bkl.takeBooking")}
          </Button>
        </>}
      />
      )}

      {/* Filter chips */}
      <div className="mb-2.5 flex flex-wrap gap-[7px]">
        {FILTER_TABS.map(([key, label]) => {
          const count = tabCounts[key] ?? 0;
          const on = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              // Each tab has its own colour so they are told apart at a glance:
              // outlined and tinted when idle, solid with a shadow when chosen.
              style={on
                ? { background: TAB_TONE[key], borderColor: TAB_TONE[key], color: "#fff", boxShadow: `0 4px 12px ${TAB_TONE[key]}55` }
                : { borderColor: TAB_TONE[key], color: TAB_TONE[key], background: `${TAB_TONE[key]}12` }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-2 px-3.5 py-[6px] text-[12.5px] font-extrabold transition-colors hover:brightness-95"
            >
              {t("p7bkl.tab_" + key)} <span className={on ? "opacity-80" : "rounded-full bg-white/70 px-1.5 text-[11px]"}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* How are they paying? Only where money is still owed / unmatched. */}
      {(filter === "unpaid" || filter === "unreconciled") && (() => {
        const base = bookings.filter((b) => matchesFilter(b, filter));
        const counts = new Map<string, number>();
        for (const b of base) counts.set(payMethodCat(b), (counts.get(payMethodCat(b)) ?? 0) + 1);
        const order = ["Bank transfer", "Card", "Cash", "Childcare vouchers", "Tax-Free Childcare", "HAF / funded", "Other"];
        const label = (c: string) => c === "Bank transfer" ? t("p8fin.recMBank") : c === "Card" ? t("p8fin.recMCard") : c === "Cash" ? t("p8fin.recMCash") : c === "Childcare vouchers" ? t("p8fin.recMVouchers") : c === "HAF / funded" ? t("p8fin.recMHaf") : c === "Other" ? t("p8fin.catOther") : c;
        const chips: [string, string, number][] = [["", t("p8fin.recStatusAll"), base.length], ...order.filter((c) => counts.has(c)).map((c) => [c, label(c), counts.get(c)!] as [string, string, number])];
        return (
          <div className="mb-2.5 flex flex-wrap items-center gap-[6px]">
            {chips.map(([key, text, n]) => (
              <button key={key || "all"} onClick={() => setPayCat(key)}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-[4px] text-[12px] font-bold ${payCat === key ? "border-[var(--brand-2)] bg-[var(--brand-2)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]"}`}>
                {text} <span className={payCat === key ? "opacity-80" : "text-[var(--ink-3)]"}>{n}</span>
              </button>
            ))}
          </div>
        );
      })()}

      {/* Search */}
      <div className="mb-2.5">
        <div className="flex items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("p7bkl.searchPh")}
            className="w-full border-0 bg-transparent text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-3)]"
          />
        </div>
      </div>

      {/* Which listing, and which day — the same two controls as the Listings
          tab, in the same components, so they can't drift apart. */}
      {!compact && bookings.length > 0 && (
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <Pill active={!!listing} onClear={() => setListing("")}>
            <PillSelect
              active={!!listing}
              value={listing}
              onChange={setListing}
              title={t("p7bkl.filterListing")}
              options={[
                ["", t("p7bkl.allListings")],
                ...listingOpts.map((l) => [l.name, `${l.name} (${l.n})`] as [string, string]),
              ]}
            />
          </Pill>

          {seasons.length > 0 && (
            <Pill active={!!season} onClear={() => setSeason("")}>
              <PillSelect
                active={!!season}
                value={season}
                onChange={setSeason}
                title={t("p7bkl.filterSeason")}
                options={[
                  ["", t("p7bkl.allSeasons")],
                  ...seasons.map((s) => [s.id, seasonDisplayName(t, s.name)] as [string, string]),
                ]}
              />
            </Pill>
          )}

          {/* When the booking was TAKEN, not when the child is in — that's
              what "anything come in yesterday?" means. Attendance by date is
              the "On this day" picker beside it, and the register. */}
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--ink-3)]">
            {t("p7bkl.bookedLbl")}
          </span>
          {(
            [
              ["today", t("p7bkl.today")],
              ["yesterday", t("p7bkl.yesterday")],
              ["week", t("p7bkl.last7")],
            ] as ["today" | "yesterday" | "week", string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setRange(range === k ? "" : k)}
              className="h-8 rounded-full border px-3 text-[12.5px] font-semibold transition-colors"
              style={
                range === k
                  ? { background: "var(--brand)", borderColor: "var(--brand)", color: "#fff" }
                  : { background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink)" }
              }
            >
              {label}
            </button>
          ))}

          <Pill active={!!day} onClear={() => setDay("")}>
            <span
              className="whitespace-nowrap text-[12.5px] font-semibold"
              style={{ color: day ? "#fff" : "var(--ink)" }}
            >
              {t("p7bkl.onThisDay")}
            </span>
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="h-full w-[112px] border-0 bg-transparent text-[12.5px] font-semibold outline-none"
              style={{ color: day ? "#fff" : "var(--ink)", colorScheme: day ? "dark" : "light" }}
            />
          </Pill>

          {(listing || day || range || season) && (
            <>
              <span className="text-[11.5px] text-[var(--ink-3)]">
                {t("p7bkl.ofN", { a: list.length, b: inScope.length })}
                {range && undated > 0 && (
                  <span title={t("p7bkl.undatedTip")}>
                    {" "}· {undated} undated
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  setListing("");
                  setDay("");
                  setRange("");
                  setSeason("");
                }}
                className="h-8 px-1 text-[11.5px] font-semibold text-[var(--ink-3)] hover:text-[var(--ink)] hover:underline"
              >
                {t("p7bkl.reset")}
              </button>
            </>
          )}
        </div>
      )}

      {/* Bulk bar */}
      {selCount > 0 && (
        <div className="mb-2.5 flex flex-wrap items-center gap-2 rounded-[9px] border border-[var(--brand-line)] bg-[var(--brand-soft)] px-3 py-[7px] text-[12px]">
          <b className="text-[var(--ink)]">{t("p7bkl.selectedN", { n: selCount })}</b>
          <Button sm variant="primary" onClick={() => bulk("approve")}>
            {t("p7bkl.bulkApprove")}
          </Button>
          <Button sm onClick={() => bulk("email")}>
            {t("p7bkl.bulkEmail")}
          </Button>
          <Button sm onClick={() => bulk("waitlist")}>
            {t("p7bkl.bulkWaitlist")}
          </Button>
          <Button sm onClick={() => bulk("cancel")}>
            {t("common.cancel")}
          </Button>
          <Button sm onClick={() => bulk("export")}>
            {t("p7bkl.bulkExport")}
          </Button>
          <Button sm onClick={clearSel}>
            {t("p7bkl.bulkClear")}
          </Button>
        </div>
      )}

      {/* Table */}
      {list.length === 0 ? (
        <Card className="p-5 text-center text-[12.5px] text-[var(--ink-2)]">
          {t("p7bkl.noMatch")}
        </Card>
      ) : compact ? (
        <Card className="p-1.5">
          <div className="flex max-h-[calc(100vh-15rem)] flex-col gap-0.5 overflow-y-auto">
            {list.map((b) => {
              const on = b.ref === openRef;
              return (
                <button
                  key={b.ref}
                  type="button"
                  onClick={() => open(b.ref)}
                  className={
                    "rounded-[10px] px-2.5 py-2 text-start transition-colors " +
                    (on ? "bg-[var(--brand)] text-white" : "text-[var(--ink)] hover:bg-[var(--panel)]")
                  }
                >
                  <div className="flex items-baseline gap-2">
                    <b className="min-w-0 flex-1 truncate text-[12.5px]">{b.booker}</b>
                    <b className="flex-none text-[12px] tabular-nums" style={waitingForPlace(b.status) ? { opacity: 0.5 } : undefined}>{money(b.amount)}</b>
                  </div>
                  <div
                    className={
                      "truncate text-[10.5px] " + (on ? "text-white/75" : "text-[var(--ink-3)]")
                    }
                  >
                    {b.listing} · {w(waitingForPlace(b.status) ? payLabelFor(b) : payLabel(b.pay))}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      ) : (
        // Rows, not a spreadsheet. The family leads with their initial in
        // their own colour, the money is the biggest thing on the line, and
        // what a row says depends on where the booking has got to — an unpaid
        // one offers a chase, a cancelled one steps back out of the way.
        <div className="flex flex-col gap-2">
          {/* Select-all for the visible list, so a whole filter can be bulk-actioned. */}
          {(() => {
            const allOn = list.length > 0 && list.every((b) => selected[b.ref]);
            const someOn = list.some((b) => selected[b.ref]);
            return (
              <label className="flex items-center gap-2.5 px-1 text-[12.5px] font-bold text-[var(--ink-2)]">
                <span
                  onClick={() => (allOn ? clearSel() : selectMany(list.map((b) => b.ref)))}
                  className={"flex h-4 w-4 flex-none items-center justify-center rounded border-[1.5px] text-[10px] text-white " + (allOn || someOn ? "border-[var(--brand-2)] bg-[var(--brand-2)]" : "border-[var(--line)]")}
                >{allOn ? "✓" : someOn ? "–" : ""}</span>
                {allOn ? t("p7bkl.allSelectedN", { n: list.length }) : someOn ? t("p7bkl.tickAllN", { sel: selCount, n: list.length }) : t("p7bkl.selectAllN", { n: list.length })}
              </label>
            );
          })()}
          {list.map((b) => {
            const on = !!selected[b.ref];
            const kids = bookingKids(b);
            // Types say booker/child are always set; Firestore disagrees (older
            // seeded rows carry neither, and kids[] is then synthesised from the
            // missing child). Fall back to the same "—" the name line uses.
            const lead = kids[0]?.name?.trim() || b.child?.trim() || b.booker?.trim() || "—";
            const att = attendeeCount(b);
            // A refund is owed and not yet actioned (the cancel sets full /
            // partial; approve/decline clear it). "pending" too, for safety.
            const refundPending = !!b.cancel && ["full", "partial", "pending"].includes(b.cancel.refund ?? "");
            const isVoucherBk = !!b.voucherScheme || (b.method ?? "").toLowerCase().includes("voucher");
            const moveReq = b.dateChangeRequest?.status === "pending" ? b.dateChangeRequest : null;
            // a cancelled row fades back, unless it still needs the provider to act (a refund to approve), which must stand out
            const off = b.status === "Cancelled" && !moveReq && !refundPending;
            return (
              <div
                key={b.ref}
                className={
                  "overflow-hidden rounded-2xl border bg-[var(--surface)] transition-all " +
                  (on ? "border-[var(--brand-2)]" : refundPending ? "border-[#f59e0b] border-2" : "border-[var(--line)]") +
                  (off ? " opacity-60" : "")
                }
                style={{ boxShadow: "0 12px 28px -18px rgba(20,35,90,.4)" }}
              >
              {/* Two-tier chip card: headline row (who · status · amount),
                  then the details as light chips underneath. */}
              <div className="p-3 sm:p-3.5">
                {/* Tier 1 — who it's for, status, amount */}
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <span onClick={(e) => { e.stopPropagation(); toggleSel(b.ref); }}
                    className={"flex h-4 w-4 flex-none cursor-pointer items-center justify-center rounded border-[1.5px] text-[10px] text-white " + (on ? "border-[var(--brand-2)] bg-[var(--brand-2)]" : "border-[var(--line)] hover:border-[var(--ink-3)]")}>{on ? "✓" : ""}</span>
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[14px] font-extrabold text-white ring-1 ring-black/5" style={{ background: heroGrad(b.status), textShadow: "0 1px 2px rgba(0,0,0,.3)" }}>{lead.charAt(0).toUpperCase()}</span>
                  <div onClick={() => open(b.ref)} className="min-w-0 flex-1 cursor-pointer">
                    <div className="truncate text-[14.5px] font-extrabold leading-tight text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }} title={kids.map((k) => k.name).filter(Boolean).join(" & ")}>{kids.map((k) => k.name).filter(Boolean).join(" & ") || b.child || "—"}</div>
                    <div className="truncate text-[11.5px] text-[var(--ink-3)]">{t("p7bkl.refN", { ref: b.ref })}{b.createdAt ? " · " + t("p7bkl.bookedWhen", { when: prettyBookedOn(b, t) }) : ""}</div>
                  </div>
                  <span className="flex-none whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-extrabold" style={{ background: heroTone(b.status).bg, color: heroTone(b.status).fg }}>{w(b.status)}</span>
                  <div className="flex-none ps-1 text-end">
                    <div className="text-[8.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">{waitingForPlace(b.status) ? t("p9tx.ifOffered") : t("p7bkl.amountLbl")}</div>
                    <b className="text-[18px] tabular-nums text-[var(--ink)]" style={waitingForPlace(b.status) ? { opacity: 0.5 } : undefined}>{money(b.amount)}</b>
                  </div>
                </div>

                {/* Tier 2 — listing, season, dates, payment as chips */}
                <div onClick={() => open(b.ref)} className="mt-2.5 flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-dashed border-[var(--line)] pt-2.5 hover:opacity-90">
                  <span className="text-[12.5px] font-extrabold text-[var(--ink)]" title={b.listing}>🎟 {b.listing || "—"}</span>
                  {seasonNameOf(b.listingId) && (
                    <span className="whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-extrabold text-white" style={{ background: "linear-gradient(120deg,#2f9fb8,#12586e)" }}>{seasonNameOf(b.listingId)}</span>
                  )}
                  <span className="text-[var(--ink-3)]">·</span>
                  <span className="text-[12.5px] font-semibold text-[var(--ink-2)]"><span className="num font-extrabold text-[var(--ink)]">{bookingDateSummary(b, (date) => tNow("p7parent.startsOn", { date }))}</span> <span className="text-[var(--ink-3)]">· {pickPlural(t, locale, "p7bk.sessN", sessionCount(b))} · {pickPlural(t, locale, "p7bk.kidN", att)}</span></span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-extrabold" style={{ background: payTone(b.pay, b.status).bg, color: payTone(b.pay, b.status).fg }}>{w(payLabelFor(b))}</span>
                    <span className="text-[11px] font-semibold text-[var(--ink-3)]">{w(payMethodLabel(b))}</span>
                  </span>
                  {b.status === "Waitlisted" && b.waitlist && b.waitlist.length > 0 && (
                    <span className="rounded-full bg-[#fff1d6] px-2.5 py-[3px] text-[11px] font-extrabold text-[#9a5a00]">{b.waitlist.map((x) => `${t("p9tx.wlPlace", { n: x.position })} · ${x.date.slice(8)}/${x.date.slice(5, 7)}`).join("  ")}</span>
                  )}

                  {b.serviceAddress && (b.serviceAddress.address || b.serviceAddress.postcode) && (
                    <span className="basis-full text-[12.5px] font-bold text-[#0b5a3f]">🚗 {t("p9tx.hvVisitAt")} {[b.serviceAddress.address, b.serviceAddress.postcode].filter(Boolean).join(", ")}</span>
                  )}
                  {/* Contextual actions, pushed to the right */}
                  <span className="ms-auto flex flex-wrap items-center justify-end gap-1.5">
                    {b.pay === "Awaiting voucher payment" && !off && !waitingForPlace(b.status) && (
                      <button onClick={(e) => { e.stopPropagation(); askConfirm(b.ref, { kind: "paid" }); }} title={t("p7bkl.confirmVoucherTip")}
                        className="flex-none whitespace-nowrap rounded-full bg-[#1d3a8f] px-3 py-[5px] text-[11px] font-bold text-white hover:brightness-110">{pendingPayActionT(t, w, b)}</button>
                    )}
                    {refundPending && (
                      <button onClick={(e) => { e.stopPropagation(); askConfirm(b.ref, { kind: "refund-approve" }); }} title={isVoucherBk ? t("p7bkl.refundSchemeTip") : t("p7bkl.approveIssueTip")}
                        className="flex-none whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-extrabold text-white shadow-[0_10px_22px_-10px_rgba(194,100,0,.7)] hover:brightness-110" style={{ background: "linear-gradient(120deg,#d97706,#f59e0b)" }}>↩ {isVoucherBk ? t("p7bkl.markSent") : t("p7bkl.approveRefund")}{b.cancel?.amount ? ` ${money(b.cancel.amount)}` : ""}</button>
                    )}
                    {!refundPending && b.cancel?.amount != null && b.cancel.amount > 0 && b.cancel.refund !== "none" && (
                      <span title={b.amount > 0 ? `${money(b.cancel.amount)} — ${Math.round((b.cancel.amount / b.amount) * 100)}% of ${money(b.amount)}` : undefined}
                        className="flex-none whitespace-nowrap rounded-full bg-[#fdebec] px-2.5 py-[3px] text-[11px] font-bold text-[#c0392b]">{t("p7bkl.refundChip", { amt: money(b.cancel.amount) })}</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Date-change request on its own full-width line so nothing is
                  cramped — the exact swap, then approve/deny without opening. */}
              {moveReq && (
                <div className="border-t border-[#f5e2b8] bg-[#fffaf0] px-4 py-2.5">
                  <div onClick={() => open(b.ref)} className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 hover:opacity-90">
                    <span className="text-[12px] font-extrabold text-[#8a5300]">{t("p7bkl.dateChangeReq")}</span>
                    {moveReq.moves.length === 1 ? (
                      <span className="text-[12.5px] text-[var(--ink)]">
                        <span className="text-[var(--ink-3)]">{t("p7bkl.fromLbl")}</span> <b>{fmtRowDate(moveReq.moves[0].from)}</b> <span className="text-[var(--ink-3)]">{t("p7bkl.toLbl")}</span> <b>{fmtRowDate(moveReq.moves[0].to)}</b>
                      </span>
                    ) : (
                      <span className="text-[12.5px] text-[var(--ink)]">{t("p9tx.blDateChanges", { n: String(moveReq.moves.length) })} <span className="font-semibold text-[var(--brand-2)]">{t("p7bkl.openViewAll")}</span></span>
                    )}
                    {denyingRef !== b.ref && (
                      <span className="ms-auto flex items-center gap-1.5">
                        <button onClick={(e) => { e.stopPropagation(); act(b.ref, "move-approve"); }} title={t("p7bkl.approveAllTip")}
                          className="whitespace-nowrap rounded-full bg-[#0f7a43] px-3.5 py-[6px] text-[11.5px] font-bold text-white hover:brightness-110">{moveReq.moves.length > 1 ? t("p7bkl.approveAll") : t("p7bkl.approveWord")}</button>
                        <button onClick={(e) => { e.stopPropagation(); setDenyingRef(b.ref); setDenyReason(""); }} title={t("p7bkl.denyTip")}
                          className="whitespace-nowrap rounded-full border border-[#e6b3b3] bg-white px-3.5 py-[6px] text-[11.5px] font-bold text-[#c0392b] hover:bg-[#fdebec]">{t("p7bkl.deny")}</button>
                      </span>
                    )}
                  </div>
                  {denyingRef === b.ref && (
                    <div onClick={(e) => e.stopPropagation()} className="mt-2.5 flex flex-wrap items-center gap-2">
                      <input
                        autoFocus
                        value={denyReason}
                        onChange={(e) => setDenyReason(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") submitDeny(b.ref); if (e.key === "Escape") { setDenyingRef(null); setDenyReason(""); } }}
                        placeholder={t("p7bkl.denyReasonPh")}
                        className="min-w-[220px] flex-1 rounded-lg border border-[#e6b3b3] bg-white px-3 py-1.5 text-[12.5px] text-[var(--ink)] outline-none focus:border-[#c0392b]"
                      />
                      <button onClick={() => submitDeny(b.ref)} className="whitespace-nowrap rounded-full bg-[#c0392b] px-3.5 py-[6px] text-[11.5px] font-bold text-white hover:brightness-110">{t("p7bkl.confirmDecline")}</button>
                      <button onClick={() => { setDenyingRef(null); setDenyReason(""); }} className="whitespace-nowrap rounded-full border border-[var(--line)] bg-white px-3 py-[6px] text-[11.5px] font-bold text-[var(--ink-3)]">{t("common.cancel")}</button>
                    </div>
                  )}
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}

      {exporting && <ExportWizard bookings={bookings} onClose={() => setExporting(false)} />}
    </div>
  );
}
