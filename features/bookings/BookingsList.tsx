"use client";

import { useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useBookingsStore } from "./store";
import {
  FILTER_TABS,
  attendeeCount,
  bookingKids,
  matchesFilter,
  matchesSearch,
  money,
  payLabel,
  payLabelFor,
  payTone,
  bookedOn,
  byNewest,
  rangeDays,
  runsOn,
  sessionCount,
  statusTone,
} from "./helpers";
import { Button, Card } from "@/components/ui";
import { Pill, PillSelect } from "@/features/listings/FreelancerListingsApp";
import { useSettings } from "@/lib/settings";
import { ExportWizard } from "./ExportWizard";
import { PageHero } from "@/components/OperatorPage";
import { HowItWorks } from "@/components/HowItWorks";

// Status → identity-panel gradient. Same hue family as the status pill, but a
// brighter, friendlier version (with a text shadow so white stays legible).
const HERO_GRAD: Record<string, string> = {
  "Confirmed": "linear-gradient(140deg,#37cf83,#13a35f)",        // fresh green (matches green pill)
  "Approval needed": "linear-gradient(140deg,#ffc25a,#e88f1f)",  // sunny amber
  "Waitlisted": "linear-gradient(140deg,#63b0f2,#2278c0)",       // sky blue (matches blue pill)
  "Offered": "linear-gradient(140deg,#63b0f2,#2278c0)",
  "Cancelled": "linear-gradient(140deg,#ff9a9a,#e05555)",        // soft coral (matches red pill)
  "Declined": "linear-gradient(140deg,#ff9a9a,#e05555)",
};
const heroGrad = (s: string) => HERO_GRAD[s] || "linear-gradient(140deg,#7fa8ff,#3f66d8)";

// A fixed-width labelled column, so every row's cells line up down the page.
function Col({ label, w, children }: { label: string; w: string; children: React.ReactNode }) {
  return (
    <span className={"flex flex-col justify-center " + w}>
      <span className="text-[8px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">{label}</span>
      <span className="mt-[3px] block leading-[1.2]">{children}</span>
    </span>
  );
}

/**
 * The list. With a booking open it becomes the left rail of a split view:
 * same filters and search, rows compressed to a name, an activity and an
 * amount, because the detail beside it is showing everything else.
 */
/** "today", "yesterday", or "12 Jul" — the shape you'd say out loud. */
// Short "Mon 27 Jul" for a date-change swap shown on the row.
const fmtRowDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
};

function prettyBookedOn(b: { createdAt?: string }): string {
  const d = bookedOn(b as never);
  if (!d) return "";
  const today = new Date().toISOString().slice(0, 10);
  const y = new Date();
  y.setUTCDate(y.getUTCDate() - 1);
  if (d === today) return "today";
  if (d === y.toISOString().slice(0, 10)) return "yesterday";
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function BookingsList({ compact = false }: { compact?: boolean }) {
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

  // Local, not in the store: a listing and a day are how you narrow the list
  // while working, not a view worth remembering between visits.
  const [listing, setListing] = useState("");
  const [day, setDay] = useState("");
  const [range, setRange] = useState<"" | "today" | "yesterday" | "week">("");
  const [season, setSeason] = useState("");
  const [exporting, setExporting] = useState(false);

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
  const list = bookings
    .filter(
      (b) =>
        matchesFilter(b, filter) &&
        matchesSearch(b, query) &&
        (!listing || b.listing === listing) &&
        // A booking is "in" a season when its listing's seasonId matches.
        (!seasonObj || (!!b.listingId && listingSeason[b.listingId] === seasonObj.id)) &&
        (!bounds || (bookedOn(b) >= bounds.from && bookedOn(b) <= bounds.to)) &&
        runsOn(b, day),
    )
    // Newest first, always — the one that just came in is the one you haven't
    // seen. Sorted here rather than relying on whatever order the API returns.
    .sort(byNewest);

  // Counts come from what the status tab and search already left, so a
  // listing showing "(3)" means three you can actually get to.
  const inScope = bookings.filter((b) => matchesFilter(b, filter) && matchesSearch(b, query));
  // Anything taken before bookings recorded a date. A range filter can't judge
  // these, so it says how many it had to leave out rather than pretending the
  // answer is "none".
  const undated = inScope.filter((b) => !b.createdAt).length;
  const listingOpts = [...new Set(inScope.map((b) => b.listing).filter(Boolean))]
    .sort()
    .map((name) => ({ name, n: inScope.filter((b) => b.listing === name).length }));

  return (
    <div>
      {/* Header — the page title belongs to the page, not to a 264px rail. */}
      {!compact && (
      <PageHero
        title="Bookings"
        lede={`${bookings.length} bookings · newest first · approvals, waitlist, payments, refunds and manual bookings`}
        icon="🎟️"
        actions={<>
          <Button
            disabled={bookings.length === 0}
            title={bookings.length ? "Choose bookings, columns and a format" : "Nothing to export"}
            onClick={() => setExporting(true)}
          >
            ⬇ Export
          </Button>
          <Button variant="primary" onClick={openCreate} className="!bg-[#1d3a8f] !border-[#1d3a8f] !text-white">
            ＋ Take a booking
          </Button>
        </>}
      />
      )}

      {!compact && (
        <HowItWorks
          video="Approving, chasing an unpaid booking, taking one over the phone, cancelling and refunding."
          minutes="3 min"
        >
          <p className="mb-2">
            Every booking you&rsquo;ve taken, however it came in. The tabs are the jobs:{" "}
            <b className="text-[var(--ink-2)]">Approval needed</b> waits on you,{" "}
            <b className="text-[var(--ink-2)]">Unpaid / invoiced</b> is money owed, and{" "}
            <b className="text-[var(--ink-2)]">Waitlisted</b> is who&rsquo;s queuing for a place.
          </p>
          <p>
            Open one to approve, mark it paid, move a day, cancel or refund. <b>Take a booking</b>{" "}
            does the same as a parent&rsquo;s checkout, for a phone booking.
          </p>
        </HowItWorks>
      )}

      {/* Filter chips */}
      <div className="mb-2.5 flex flex-wrap gap-[7px]">
        {FILTER_TABS.map(([key, label]) => {
          const count = bookings.filter((b) => matchesFilter(b, key)).length;
          const on = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-[5px] text-[12px] font-semibold transition-colors " +
                (on
                  ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                  : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--ink-3)]")
              }
            >
              {label} <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-2.5">
        <div className="flex items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Search booker, child, ref, booking ID, email, listing…"
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
              title="Filter by listing"
              options={[
                ["", "All listings"],
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
                title="Filter by season"
                options={[
                  ["", "📅 All seasons"],
                  ...seasons.map((s) => [s.id, s.name] as [string, string]),
                ]}
              />
            </Pill>
          )}

          {/* When the booking was TAKEN, not when the child is in — that's
              what "anything come in yesterday?" means. Attendance by date is
              the "On this day" picker beside it, and the register. */}
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--ink-3)]">
            Booked
          </span>
          {(
            [
              ["today", "Today"],
              ["yesterday", "Yesterday"],
              ["week", "Last 7 days"],
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
              On this day
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
                {list.length} of {inScope.length}
                {range && undated > 0 && (
                  <span title="Bookings taken before we started recording the date can't answer this">
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
                Reset
              </button>
            </>
          )}
        </div>
      )}

      {/* Bulk bar */}
      {selCount > 0 && (
        <div className="mb-2.5 flex flex-wrap items-center gap-2 rounded-[9px] border border-[var(--brand-line)] bg-[var(--brand-soft)] px-3 py-[7px] text-[12px]">
          <b className="text-[var(--ink)]">{selCount} selected</b>
          <Button sm variant="primary" onClick={() => bulk("approve")}>
            Approve
          </Button>
          <Button sm onClick={() => bulk("email")}>
            Email
          </Button>
          <Button sm onClick={() => bulk("waitlist")}>
            Waitlist
          </Button>
          <Button sm onClick={() => bulk("cancel")}>
            Cancel
          </Button>
          <Button sm onClick={() => bulk("export")}>
            Export
          </Button>
          <Button sm onClick={clearSel}>
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      {list.length === 0 ? (
        <Card className="p-5 text-center text-[12.5px] text-[var(--ink-2)]">
          No bookings match this view.
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
                    "rounded-[10px] px-2.5 py-2 text-left transition-colors " +
                    (on ? "bg-[var(--brand)] text-white" : "text-[var(--ink)] hover:bg-[var(--panel)]")
                  }
                >
                  <div className="flex items-baseline gap-2">
                    <b className="min-w-0 flex-1 truncate text-[12.5px]">{b.booker}</b>
                    <b className="flex-none text-[12px] tabular-nums">{money(b.amount)}</b>
                  </div>
                  <div
                    className={
                      "truncate text-[10.5px] " + (on ? "text-white/75" : "text-[var(--ink-3)]")
                    }
                  >
                    {b.listing} · {payLabel(b.pay)}
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
                {allOn ? `All ${list.length} selected` : someOn ? `${selCount} selected — tick to select all ${list.length}` : `Select all ${list.length}`}
              </label>
            );
          })()}
          {list.map((b) => {
            const on = !!selected[b.ref];
            const kids = bookingKids(b);
            const lead = kids[0]?.name?.trim() || b.child?.trim() || b.booker;
            const att = attendeeCount(b);
            // A refund is owed and not yet actioned (the cancel sets full /
            // partial; approve/decline clear it). "pending" too, for safety.
            const refundPending = !!b.cancel && ["full", "partial", "pending"].includes(b.cancel.refund ?? "");
            const isVoucherBk = !!b.voucherScheme || (b.method ?? "").toLowerCase().includes("voucher");
            const moveReq = b.dateChangeRequest?.status === "pending" ? b.dateChangeRequest : null;
            const off = b.status === "Cancelled" && !moveReq;
            return (
              <div
                key={b.ref}
                className={
                  "overflow-hidden rounded-2xl border bg-[var(--surface)] transition-all " +
                  (on ? "border-[var(--brand-2)]" : "border-[var(--line)]") +
                  (off ? " opacity-60" : "")
                }
                style={{ boxShadow: "0 12px 28px -18px rgba(20,35,90,.4)" }}
              >
              <div className="flex items-stretch">
                {/* Identity hero — colour = booking status */}
                <div onClick={() => open(b.ref)} className="relative flex w-[150px] flex-none cursor-pointer items-center gap-2.5 p-2.5 pr-5 text-white sm:w-[236px]" style={{ background: heroGrad(b.status) }}>
                  <span onClick={(e) => { e.stopPropagation(); toggleSel(b.ref); }} className={"absolute right-2 top-2 h-3.5 w-3.5 rounded border-[1.5px] " + (on ? "border-white bg-white/90" : "border-white/45")} />
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white/25 text-[15px] font-extrabold ring-1 ring-white/25" style={{ textShadow: "0 1px 2px rgba(0,0,0,.3)" }}>{lead.charAt(0).toUpperCase()}</span>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-extrabold leading-[1.15] [overflow-wrap:anywhere]" style={{ fontFamily: "var(--ff-display)", textShadow: "0 1px 3px rgba(0,0,0,.3)" }}>{kids.map((k) => k.name).filter(Boolean).join(" & ") || b.child || "—"}</div>
                    <div className="truncate text-[10px] text-white/85" style={{ textShadow: "0 1px 2px rgba(0,0,0,.25)" }}>Ref {b.ref}{b.createdAt ? ` · ${prettyBookedOn(b)}` : ""}</div>
                  </div>
                </div>

                {/* Detail columns — fixed widths so every row lines up */}
                <div onClick={() => open(b.ref)} className="flex flex-1 cursor-pointer items-center gap-4 overflow-hidden px-4 py-1.5 hover:bg-[var(--panel)]">
                  <Col label="🎟 Listing" w="min-w-0 flex-1"><span className="block text-[12.5px] font-extrabold leading-tight text-[var(--ink)] [overflow-wrap:anywhere]" title={b.listing}>{b.listing || "—"}</span></Col>
                  <Col label="📅 Season" w="w-[124px]">{seasonNameOf(b.listingId) ? <span className="whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-extrabold text-white" style={{ background: "linear-gradient(120deg,#2f9fb8,#12586e)" }}>{seasonNameOf(b.listingId)}</span> : <span className="text-[12px] text-[var(--ink-3)]">—</span>}</Col>
                  <Col label="📆 Dates" w="w-[158px]"><span className="num text-[12.5px] font-extrabold text-[var(--ink)]">{b.dates}</span><span className="block text-[10.5px] font-semibold text-[var(--ink-3)]">{sessionCount(b)} sessions · {att > 1 ? `${att} children` : "1 child"}</span></Col>
                  <Col label="Status" w="w-[108px]"><span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-extrabold" style={{ background: statusTone(b.status).bg, color: statusTone(b.status).fg }}>{b.status}</span></Col>
                  <Col label="Payment" w="w-[108px]"><span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-extrabold" style={{ background: payTone(b.pay).bg, color: payTone(b.pay).fg }}>{payLabelFor(b)}</span></Col>

                  {b.pay === "Awaiting voucher payment" && !off && (
                    <button onClick={(e) => { e.stopPropagation(); act(b.ref, "paid"); }} title="Confirm the voucher money has arrived — marks it paid and tells the family"
                      className="flex-none whitespace-nowrap rounded-full bg-[#1d3a8f] px-3 py-[5px] text-[11px] font-bold text-white hover:brightness-110">Mark voucher received</button>
                  )}
                  {refundPending && (
                    <button onClick={(e) => { e.stopPropagation(); act(b.ref, "refund-approve"); }} title={isVoucherBk ? "Send the refund back through the scheme, then confirm — the family is told" : "Approve and issue the refund"}
                      className="flex-none whitespace-nowrap rounded-full bg-[var(--brand-2,#2f6bd8)] px-3 py-[5px] text-[11px] font-bold text-white hover:brightness-110">{isVoucherBk ? "Mark refund sent" : "Approve refund"}{b.cancel?.amount ? ` ${money(b.cancel.amount)}` : ""}</button>
                  )}
                  {!refundPending && b.cancel?.amount != null && b.cancel.amount > 0 && b.cancel.refund !== "none" && (
                    <span title={b.amount > 0 ? `${money(b.cancel.amount)} — ${Math.round((b.cancel.amount / b.amount) * 100)}% of ${money(b.amount)}` : undefined}
                      className="flex-none whitespace-nowrap rounded-full bg-[#fdebec] px-2.5 py-[3px] text-[11px] font-bold text-[#c0392b]">Refund {money(b.cancel.amount)}</span>
                  )}

                  <div className="ml-auto flex-none text-right">
                    <div className="text-[8.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">Amount</div>
                    <b className="text-[18px] tabular-nums text-[var(--ink)]">{money(b.amount)}</b>
                  </div>
                </div>
              </div>

              {/* Date-change request on its own full-width line so nothing is
                  cramped — the exact swap, then approve/deny without opening. */}
              {moveReq && (
                <div onClick={() => open(b.ref)} className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 border-t border-[#f5e2b8] bg-[#fffaf0] px-4 py-2.5 hover:bg-[#fdf3d8]">
                  <span className="text-[12px] font-extrabold text-[#8a5300]">📅 Date change requested</span>
                  {moveReq.moves.length === 1 ? (
                    <span className="text-[12.5px] text-[var(--ink)]">
                      <span className="text-[var(--ink-3)]">From</span> <b>{fmtRowDate(moveReq.moves[0].from)}</b> <span className="text-[var(--ink-3)]">→ To</span> <b>{fmtRowDate(moveReq.moves[0].to)}</b>
                    </span>
                  ) : (
                    <span className="text-[12.5px] text-[var(--ink)]">{moveReq.moves.length} date changes — <span className="font-semibold text-[var(--brand-2)]">open to view all</span></span>
                  )}
                  <span className="ml-auto flex items-center gap-1.5">
                    <button onClick={(e) => { e.stopPropagation(); act(b.ref, "move-approve"); }} title="Approve all — dates move and the family is told"
                      className="whitespace-nowrap rounded-full bg-[#0f7a43] px-3.5 py-[6px] text-[11.5px] font-bold text-white hover:brightness-110">Approve{moveReq.moves.length > 1 ? " all" : ""}</button>
                    <button onClick={(e) => { e.stopPropagation(); act(b.ref, "move-deny"); }} title="Decline — the booking is unchanged and the family is told"
                      className="whitespace-nowrap rounded-full border border-[#e6b3b3] bg-white px-3.5 py-[6px] text-[11.5px] font-bold text-[#c0392b] hover:bg-[#fdebec]">Deny</button>
                  </span>
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
