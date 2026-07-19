"use client";

import { useState } from "react";
import { useBookingsStore } from "./store";
import {
  FILTER_TABS,
  attendeeCount,
  avatarColour,
  bookingKids,
  matchesFilter,
  matchesSearch,
  money,
  payLabel,
  payTone,
  runsOn,
  sessionCount,
  statusTone,
} from "./helpers";
import { Badge, Button, Card } from "@/components/ui";
import { Pill, PillSelect } from "@/features/listings/FreelancerListingsApp";
import { ExportWizard } from "./ExportWizard";

/**
 * The list. With a booking open it becomes the left rail of a split view:
 * same filters and search, rows compressed to a name, an activity and an
 * amount, because the detail beside it is showing everything else.
 */
export function BookingsList({ compact = false }: { compact?: boolean }) {
  const bookings = useBookingsStore((s) => s.bookings);
  const filter = useBookingsStore((s) => s.filter);
  const query = useBookingsStore((s) => s.query);
  const selected = useBookingsStore((s) => s.selected);

  const setFilter = useBookingsStore((s) => s.setFilter);
  const setQuery = useBookingsStore((s) => s.setQuery);
  const toggleSel = useBookingsStore((s) => s.toggleSel);
  const clearSel = useBookingsStore((s) => s.clearSel);
  const bulk = useBookingsStore((s) => s.bulk);
  const open = useBookingsStore((s) => s.open);
  const openRef = useBookingsStore((s) => s.openRef);
  const openCreate = useBookingsStore((s) => s.openCreate);

  // Local, not in the store: a listing and a day are how you narrow the list
  // while working, not a view worth remembering between visits.
  const [listing, setListing] = useState("");
  const [day, setDay] = useState("");
  const [exporting, setExporting] = useState(false);

  const selCount = Object.keys(selected).filter((k) => selected[k]).length;
  const list = bookings.filter(
    (b) =>
      matchesFilter(b, filter) &&
      matchesSearch(b, query) &&
      (!listing || b.listing === listing) &&
      runsOn(b, day),
  );

  // Counts come from what the status tab and search already left, so a
  // listing showing "(3)" means three you can actually get to.
  const inScope = bookings.filter((b) => matchesFilter(b, filter) && matchesSearch(b, query));
  const listingOpts = [...new Set(inScope.map((b) => b.listing).filter(Boolean))]
    .sort()
    .map((name) => ({ name, n: inScope.filter((b) => b.listing === name).length }));

  return (
    <div>
      {/* Header — the page title belongs to the page, not to a 264px rail. */}
      {!compact && (
      <div className="mb-2.5 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="m-0 font-[var(--ff-display)] text-[20px] leading-tight text-[var(--ink)]">
            Bookings
          </h3>
          <div className="mt-0.5 text-[12.5px] text-[var(--ink-3)]">
            {bookings.length} bookings · one place for approvals, waitlist, payments, refunds &
            manual bookings
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={bookings.length === 0}
            title={bookings.length ? "Choose bookings, columns and a format" : "Nothing to export"}
            onClick={() => setExporting(true)}
          >
            ⬇ Export
          </Button>
          <Button variant="primary" onClick={openCreate}>
            ＋ Take a booking
          </Button>
        </div>
      </div>
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
                ["", "Listing"],
                ...listingOpts.map((l) => [l.name, `${l.name} (${l.n})`] as [string, string]),
              ]}
            />
          </Pill>

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

          {(listing || day) && (
            <>
              <span className="text-[11.5px] text-[var(--ink-3)]">
                {list.length} of {inScope.length}
              </span>
              <button
                type="button"
                onClick={() => {
                  setListing("");
                  setDay("");
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
          {list.map((b) => {
            const on = !!selected[b.ref];
            const kids = bookingKids(b);
            const lead = kids[0]?.name?.trim() || b.child?.trim() || b.booker;
            const att = attendeeCount(b);
            const refundPending = b.cancel && b.cancel.refund === "pending";
            const off = b.status === "Cancelled";
            return (
              <div
                key={b.ref}
                onClick={() => open(b.ref)}
                className={
                  "flex cursor-pointer items-center gap-3.5 rounded-2xl border bg-[var(--surface)] px-4 py-3 transition-all " +
                  "hover:-translate-y-px hover:shadow-[0_8px_20px_-14px_rgba(9,20,44,.55)] " +
                  (on ? "border-[var(--brand-2)]" : "border-[var(--line)]") +
                  (off ? " opacity-65" : "")
                }
              >
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSel(b.ref);
                  }}
                  className={
                    "h-4 w-4 flex-none rounded border-[1.5px] " +
                    (on ? "border-[var(--brand-2)] bg-[var(--brand-2)]" : "border-[var(--line)]")
                  }
                />
                {/* The child's initial, not the payer's — a photo goes here
                    once a booking carries the child's id (handoff §I). */}
                <span
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[14px] font-extrabold text-white"
                  style={{ background: avatarColour(lead) }}
                >
                  {lead.charAt(0).toUpperCase()}
                </span>

                <span className="min-w-0 flex-1">
                  {/* The child leads. A provider's list of bookings that names
                      only the payer can't answer "is Sophie in on Thursday" —
                      and a family booking three children read as three
                      identical rows. */}
                  <span className="block truncate text-[13.5px] font-extrabold text-[var(--ink)]">
                    {kids.map((k) => k.name).filter(Boolean).join(", ") || b.child || "—"}
                  </span>
                  <span className="block truncate text-[11px] text-[var(--ink-3)]">
                    Booked by {b.booker} · {b.listing} · {b.pass}
                  </span>
                </span>

                <span className="hidden min-w-0 flex-1 sm:block">
                  <span className="block truncate text-[12.5px] text-[var(--ink)]">{b.dates}</span>
                  <span className="block truncate text-[11px] text-[var(--ink-3)]">
                    {att > 1 ? `${att} children` : "1 child"} · {sessionCount(b)} sessions · Ref {b.ref}
                  </span>
                </span>

                <span className="hidden flex-none flex-wrap justify-end gap-1 md:flex">
                  <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                  <Badge tone={payTone(b.pay)}>{payLabel(b.pay)}</Badge>
                  {refundPending && (
                    <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "#bb1620" }}>Refund pending</Badge>
                  )}
                </span>

                <b className="flex-none text-right text-[16px] tabular-nums text-[var(--ink)]">
                  {money(b.amount)}
                </b>
              </div>
            );
          })}
        </div>
      )}

      {exporting && <ExportWizard bookings={bookings} onClose={() => setExporting(false)} />}
    </div>
  );
}
