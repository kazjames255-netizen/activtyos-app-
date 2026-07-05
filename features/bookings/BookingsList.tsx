"use client";

import { useBookingsStore } from "./store";
import {
  FILTER_TABS,
  attendeeCount,
  matchesFilter,
  matchesSearch,
  money,
  payLabel,
  payTone,
  sessionCount,
  statusTone,
} from "./helpers";
import { Badge, Btn, Card } from "./ui";

export function BookingsList() {
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
  const openCreate = useBookingsStore((s) => s.openCreate);

  const selCount = Object.keys(selected).filter((k) => selected[k]).length;
  const list = bookings.filter((b) => matchesFilter(b, filter) && matchesSearch(b, query));

  return (
    <div>
      {/* Header */}
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
          <Btn
            onClick={() =>
              alert("Export wizard: pick listings / sessions / dataset / fields / CSV·Excel·PDF.")
            }
          >
            ⬇ Export
          </Btn>
          <Btn variant="primary" onClick={openCreate}>
            ＋ Take a booking
          </Btn>
        </div>
      </div>

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

      {/* Bulk bar */}
      {selCount > 0 && (
        <div className="mb-2.5 flex flex-wrap items-center gap-2 rounded-[9px] border border-[var(--brand-line)] bg-[var(--brand-soft)] px-3 py-[7px] text-[12px]">
          <b className="text-[var(--ink)]">{selCount} selected</b>
          <Btn sm variant="primary" onClick={() => bulk("approve")}>
            Approve
          </Btn>
          <Btn sm onClick={() => bulk("email")}>
            Email
          </Btn>
          <Btn sm onClick={() => bulk("waitlist")}>
            Waitlist
          </Btn>
          <Btn sm onClick={() => bulk("cancel")}>
            Cancel
          </Btn>
          <Btn sm onClick={() => bulk("export")}>
            Export
          </Btn>
          <Btn sm onClick={clearSel}>
            Clear
          </Btn>
        </div>
      )}

      {/* Table */}
      {list.length === 0 ? (
        <Card className="p-5 text-center text-[12.5px] text-[var(--ink-2)]">
          No bookings match this view.
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="text-left">
                  {["", "Parent", "Activity", "Dates", "Attendees", "Sessions", "Status", "Payment"].map(
                    (h, i) => (
                      <th
                        key={i}
                        className="border-b border-[var(--line)] px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]"
                      >
                        {h}
                      </th>
                    ),
                  )}
                  <th className="border-b border-[var(--line)] px-3 py-2.5 text-right text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((b) => {
                  const on = !!selected[b.ref];
                  const att = attendeeCount(b);
                  const refundPending = b.cancel && b.cancel.refund === "pending";
                  return (
                    <tr
                      key={b.ref}
                      onClick={() => open(b.ref)}
                      className="cursor-pointer border-b border-[var(--line-2)] text-[12.5px] text-[var(--ink)] last:border-0 hover:bg-[var(--panel)]/40"
                    >
                      <td className="w-[26px] px-3 py-3">
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSel(b.ref);
                          }}
                          className={
                            "inline-block h-4 w-4 rounded border-[1.5px] " +
                            (on
                              ? "border-[var(--cta,#e22295)] bg-[var(--cta,#e22295)]"
                              : "border-[var(--line-2)]")
                          }
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-extrabold">{b.booker}</div>
                        <div className="text-[var(--ink-3)]">Ref {b.ref}</div>
                      </td>
                      <td className="px-3 py-3">
                        {b.listing}
                        <div className="text-[var(--ink-3)]">{b.pass}</div>
                      </td>
                      <td className="px-3 py-3">{b.dates}</td>
                      <td className="px-3 py-3">{att > 1 ? `${att} children` : "1 child"}</td>
                      <td className="px-3 py-3">{sessionCount(b)} sessions</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                          {refundPending && <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "#bb1620" }}>Refund pending</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={payTone(b.pay)}>{payLabel(b.pay)}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        <b>{money(b.amount)}</b>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
