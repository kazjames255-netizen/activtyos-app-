"use client";

import { useState } from "react";
import { useBookingsStore } from "./store";
import type { Booking, Kid } from "./types";
import {
  altDates,
  attendeeCount,
  bookingKids,
  kidActiveDays,
  money,
  payTone,
  refundedTotal,
  sessionCount,
  statusTone,
} from "./helpers";
import { Badge, Button, Card, DefRow, SectionHead } from "@/components/ui";

function Tile({ big, small }: { big: string; small: string }) {
  return (
    <div className="min-w-[88px] flex-1 rounded-xl bg-[var(--brand-soft)] px-3 py-2.5">
      <div className="font-[var(--ff-display)] text-[18px] font-extrabold leading-none text-[var(--brand)]">
        {big}
      </div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.03em] text-[var(--ink-3)]">
        {small}
      </div>
    </div>
  );
}

function AttendeeCard({ booking, kid, ki }: { booking: Booking; kid: Kid; ki: number }) {
  const cancelChild = useBookingsStore((s) => s.cancelChild);
  const cancelDay = useBookingsStore((s) => s.cancelDay);
  const changeDay = useBookingsStore((s) => s.changeDay);
  const cancelChange = useBookingsStore((s) => s.cancelChange);
  const applyChangeDay = useBookingsStore((s) => s.applyChangeDay);

  const initial = (kid.name || "?").slice(0, 1);

  if (kid.cancelled) {
    return (
      <div className="mb-2 flex items-center gap-2.5 rounded-[11px] border border-[var(--line-2)] px-3 py-2.5 opacity-60">
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#eee] text-[12px] font-extrabold text-[#999]">
          {initial}
        </span>
        <div>
          <div className="text-[13px] font-extrabold text-[var(--ink-2)] line-through">
            {kid.name || `Child ${ki + 1}`}
          </div>
          <div className="mt-0.5">
            <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "#bb1620" }}>Place cancelled</Badge>
          </div>
        </div>
      </div>
    );
  }

  const active = kidActiveDays(kid);

  return (
    <div className="mb-2 rounded-[11px] border border-[var(--line-2)] px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[12px] font-extrabold text-[var(--brand)]">
          {initial}
        </span>
        <div className="flex-1">
          <div className="text-[13px] font-extrabold text-[var(--ink)]">
            {kid.name || `Child ${ki + 1}`}
          </div>
          <div className="text-[11.5px] text-[var(--ink-3)]">
            {kid.age != null ? `${kid.age} yrs` : ""}
            {kid.dob ? ` · ${kid.dob}` : ""}
          </div>
        </div>
        {active.length > 1 && (
          <button
            onClick={() => cancelChild(booking.ref, ki)}
            title={`Cancel all ${active.length} of ${kid.name || "this child"}'s days at once`}
            className="cursor-pointer whitespace-nowrap text-[11px] font-bold text-[var(--red)]"
          >
            Cancel all {active.length} days
          </button>
        )}
      </div>

      {kid.dates && kid.dates.length > 0 && (
        <div className="mt-2.5">
          <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.03em] text-[var(--ink-3)]">
            {active.length} of {kid.dates.length} days · move or cancel any of them
          </div>
          <div>
            {kid.dates.map((dt) => {
              const off = (kid.cancelledDays || []).indexOf(dt) > -1;
              if (off) {
                return (
                  <div
                    key={dt}
                    className="flex items-center gap-2 border-b border-dashed border-[var(--line)] py-[5px] text-[12px] text-[var(--red)]"
                  >
                    <span className="flex-1 line-through">{dt}</span>
                    <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "#bb1620" }}>cancelled</Badge>
                  </div>
                );
              }
              const changing = booking._chgKi === ki && booking._chgDt === dt;
              return (
                <div key={dt}>
                  <div className="flex items-center gap-2 border-b border-dashed border-[var(--line)] py-[5px] text-[12px]">
                    <span className="flex-1">{dt}</span>
                    {/* "Move" and not "Change": nothing is cancelled and no
                        money moves — they still come, on another day. */}
                    <button
                      onClick={() => changeDay(booking.ref, ki, dt)}
                      title="Keep the place, move it to another date"
                      className="cursor-pointer text-[11px] font-bold text-[var(--brand)]"
                    >
                      Move
                    </button>
                    <button
                      onClick={() => cancelDay(booking.ref, ki, dt)}
                      title="Cancel this one day and refund it"
                      className="cursor-pointer text-[11px] font-bold text-[var(--red)]"
                    >
                      Cancel this day
                    </button>
                  </div>
                  {changing && (
                    <div className="my-0.5 mb-[7px] rounded-[9px] bg-[var(--brand-soft)] px-2.5 py-2">
                      <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.03em] text-[var(--ink-3)]">
                        Move to another date
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {altDates(kid).map((nd) => (
                          <button
                            key={nd}
                            onClick={() => applyChangeDay(booking.ref, ki, dt, nd)}
                            className="cursor-pointer rounded-full border-[1.5px] border-[var(--brand-line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-bold text-[var(--brand)]"
                          >
                            {nd}
                          </button>
                        ))}
                        <button
                          onClick={() => cancelChange(booking.ref)}
                          className="cursor-pointer self-center text-[11px] text-[var(--ink-3)]"
                        >
                          cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CancelPanel({ booking }: { booking: Booking }) {
  const setRefund = useBookingsStore((s) => s.setRefund);
  const doCancel = useBookingsStore((s) => s.doCancel);
  const cancelAbort = useBookingsStore((s) => s.cancelAbort);
  const rt = booking._refundType || "full";
  const [partial, setPartial] = useState(booking.amount ? Math.round(booking.amount / 2) : 0);

  const RBtn = ({ t, label }: { t: "full" | "partial" | "none"; label: string }) => (
    <span
      onClick={() => setRefund(booking.ref, t)}
      className={
        "cursor-pointer rounded-lg border-[1.5px] px-3 py-[7px] text-[12px] font-bold " +
        (rt === t
          ? "border-[var(--cta,#e22295)] bg-[var(--cta,#e22295)] text-white"
          : "border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink-2)]")
      }
    >
      {label}
    </span>
  );

  return (
    <div className="my-3.5 rounded-xl border-[1.5px] border-[#FAD4D0] bg-[#FFF7F6] px-4 py-3.5">
      <div className="mb-1 text-[13.5px] font-extrabold text-[var(--red)]">
        {booking.past ? "Issue a refund" : "Cancel this booking?"}
      </div>
      <div className="mb-3 text-[12px] text-[var(--ink-2)]">
        You decide the refund. ActivityOS never moves money — action any refund in your own payment
        provider.
      </div>
      <div className="mb-[7px] text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
        Refund the parent?
      </div>
      <div className="flex flex-wrap gap-[7px]">
        <RBtn t="full" label={`Yes — full (${money(booking.amount)})`} />
        <RBtn t="partial" label="Partial" />
        <RBtn t="none" label="No refund" />
      </div>
      {rt === "partial" && (
        <div className="mt-2.5">
          <label className="mb-[3px] block text-[11px] font-bold text-[var(--ink-3)]">
            Refund amount (£)
          </label>
          <input
            value={partial}
            onChange={(e) => setPartial(parseFloat(e.target.value) || 0)}
            className="max-w-[160px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none"
          />
        </div>
      )}
      <div className="mt-3.5 flex gap-[7px]">
        <Button variant="primary" onClick={() => doCancel(booking.ref, partial)}>
          {booking.past ? "Issue refund" : "Confirm cancellation"}
        </Button>
        <Button onClick={() => cancelAbort(booking.ref)}>{booking.past ? "Close" : "Keep booking"}</Button>
      </div>
    </div>
  );
}

export function BookingDetail({ booking }: { booking: Booking }) {
  const close = useBookingsStore((s) => s.close);
  const act = useBookingsStore((s) => s.act);
  const cancelOpen = useBookingsStore((s) => s.cancelOpen);
  const saveNote = useBookingsStore((s) => s.saveNote);
  const [note, setNote] = useState(booking.note || "");

  const b = booking;
  const kids = bookingKids(b);

  return (
    <div>
      <div className="mb-3">
        <button
          onClick={close}
          className="cursor-pointer text-[13px] font-bold text-[var(--brand)]"
        >
          ‹ Back to bookings
        </button>
      </div>

      <Card className="px-5 py-[18px]">
        {/* Header */}
        <div className="flex flex-wrap items-start gap-2.5">
          <div className="min-w-0 flex-1">
            <h3 className="m-0 break-words font-[var(--ff-display)] text-[20px] leading-[1.15] text-[var(--ink)]">
              {b.booker}
            </h3>
            <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">
              Booking ref <b className="text-[var(--ink-2)]">{b.ref}</b> · ID {b.bid}
            </div>
            {/* When it came in — the question you ask before "and what did
                they book". Date and time, because two bookings on the same
                day are told apart by the clock. */}
            <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">
              {b.createdAt ? (
                <>
                  Booked{" "}
                  <b className="text-[var(--ink-2)]">
                    {new Date(b.createdAt).toLocaleString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </b>
                </>
              ) : (
                <span title="Bookings taken before the date was recorded">
                  Booked date not recorded
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Badge tone={statusTone(b.status)}>{b.status}</Badge>
          <Badge tone={payTone(b.pay)}>{b.pay === "Funded" ? "Funded £0" : b.pay}</Badge>
        </div>

        {/* Tiles */}
        <div className="my-3.5 mb-0.5 flex flex-wrap gap-2">
          <Tile
            big={String(attendeeCount(b))}
            small={attendeeCount(b) === 1 ? "Attendee" : "Attendees"}
          />
          <Tile big={String(sessionCount(b))} small="Sessions" />
          <Tile big={money(b.amount)} small="Total" />
        </div>

        {b._cancelling && <CancelPanel booking={b} />}

        {/* Attendees */}
        <SectionHead>Attendees</SectionHead>
        {kids.map((k, ki) => (
          <AttendeeCard key={ki} booking={b} kid={k} ki={ki} />
        ))}

        {/* Activity */}
        <SectionHead>Activity</SectionHead>
        <DefRow label="Listing" value={b.listing} />
        <DefRow label="Pass" value={b.pass} />
        <DefRow label="Booked ticket" value={b.ticket} />
        {b.addons && b.addons.length > 0 && <DefRow label="Add-ons" value={b.addons.join(", ")} />}

        {/* Contact */}
        <SectionHead>Booker contact</SectionHead>
        <DefRow label="Name" value={b.booker} />
        <DefRow
          label="Phone"
          value={<a href={`tel:${b.phone.replace(/ /g, "")}`}>{b.phone}</a>}
        />
        <DefRow label="Email" value={b.email} />

        {/* Checkout answers */}
        {b.answers && b.answers.length > 0 && (
          <>
            <SectionHead>Booker’s checkout answers</SectionHead>
            {b.answers.map((a, i) => (
              <DefRow key={i} label={a[0]} value={a[1]} />
            ))}
          </>
        )}

        {/* Sessions */}
        <SectionHead>Dates &amp; times</SectionHead>
        <div className="mb-1 text-[12px] font-bold text-[var(--ink-2)]">{b.listing}</div>
        {(b.sessions || []).map((s, i) => {
          const parts = s.split(" · ");
          return (
            <div
              key={i}
              className="flex justify-between border-b border-dashed border-[var(--line)] py-[3px] text-[12px] text-[var(--ink)]"
            >
              <span>{parts[0]}</span>
              <b>{parts[1] || ""}</b>
            </div>
          );
        })}

        {/* Payment */}
        <SectionHead>Payment</SectionHead>
        <DefRow label="Method" value={b.method} />
        <DefRow label="Total" value={money(b.amount)} />
        {b.method === "Tax-Free Childcare" && (
          <DefRow
            label="TFC reconciled"
            value={
              <span className="inline-flex items-center gap-1.5">
                <Badge
                  tone={
                    b.recon
                      ? { bg: "var(--green-soft,#e7f8ee)", fg: "#0f7a44" }
                      : { bg: "#FCE9CE", fg: "#B45309" }
                  }
                >
                  {b.recon ? "Yes" : "No"}
                </Badge>
                <a
                  onClick={() => act(b.ref, "recon")}
                  className="cursor-pointer text-[11px]"
                >
                  toggle
                </a>
              </span>
            }
          />
        )}
        {b.method === "HAF" && (
          <DefRow
            label="HAF evidence"
            value={
              b.evid ? (
                <Badge
                  tone={
                    b.evid === "Received"
                      ? { bg: "var(--green-soft,#e7f8ee)", fg: "#0f7a44" }
                      : { bg: "#FCE9CE", fg: "#B45309" }
                  }
                >
                  {b.evid}
                </Badge>
              ) : (
                "—"
              )
            }
          />
        )}

        {/* Cancellation & refund summary */}
        {b.cancel && <RefundSummary booking={b} />}

        {/* Per-day refund log */}
        {b.refundLog && b.refundLog.length > 0 && (
          <>
            <SectionHead>Cancellations &amp; refunds</SectionHead>
            <div className="rounded-[9px] border border-[#FAD4D0] bg-[#FFF3F2] px-3 py-2.5 text-[12px]">
              {b.refundLog.map((x, i) => (
                <div
                  key={i}
                  className="flex justify-between gap-2.5 border-b border-dashed border-[#FAD4D0] py-1"
                >
                  <span className="text-[var(--ink-2)]">
                    {x.label}{" "}
                    <span className="text-[10.5px] text-[var(--ink-3)]">
                      · {x.source || x.by} · {x.on}
                    </span>
                  </span>
                  <b className="whitespace-nowrap text-[var(--red)]">{money(x.amount)}</b>
                </div>
              ))}
              <div className="mt-2 flex justify-between font-extrabold">
                <span>Total to refund</span>
                <span className="text-[var(--red)]">{money(refundedTotal(b))}</span>
              </div>
              <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">
                Action these refunds in your payment provider — ActivityOS does not move money.
              </div>
            </div>
          </>
        )}

        {/* Mentor notes */}
        <SectionHead>Mentor notes</SectionHead>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => saveNote(b.ref, note)}
          placeholder="Private notes — not shared with parents…"
          className="min-h-[54px] w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] text-[var(--ink)] outline-none"
        />
        <div className="mt-[3px] text-[10.5px] text-[var(--ink-3)]">
          Only viewable by you.{" "}
          <a
            onClick={() => saveNote(b.ref, note)}
            className="cursor-pointer font-semibold"
          >
            Save note
          </a>
        </div>

        {/* Actions */}
        <div className="mt-3.5 flex flex-wrap gap-[7px] border-t border-[var(--line-2)] pt-3.5">
          {b.past === true && (
            <Badge tone={{ bg: "#eef0f6", fg: "#5b6478" }}>Activity completed</Badge>
          )}
          {b.status === "Approval needed" && (
            <>
              <Button variant="primary" onClick={() => act(b.ref, "approve")}>
                Approve
              </Button>
              <Button onClick={() => act(b.ref, "decline")}>Decline</Button>
            </>
          )}
          {b.status === "Waitlisted" && (
            <>
              <Button variant="primary" onClick={() => act(b.ref, "offer")}>
                Offer place (2h hold)
              </Button>
              <Button onClick={() => act(b.ref, "promote")} title="Seat immediately — may overbook">
                Promote now
              </Button>
            </>
          )}
          {b.status === "Offered" && (
            <>
              <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>
                Held until {b.offerExpiresAt ? new Date(b.offerExpiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "…"}
              </Badge>
              <Button onClick={() => act(b.ref, "promote")} title="Confirm without waiting for the family">
                Confirm now
              </Button>
            </>
          )}
          {b.cancel?.refund === "pending" && (
            <>
              <Button variant="primary" onClick={() => act(b.ref, "refund-approve")}>
                Approve refund{b.paymentIntentId ? " (via Stripe)" : ""}
              </Button>
              <Button onClick={() => act(b.ref, "refund-decline")}>Decline refund</Button>
            </>
          )}
          {(b.pay === "Invoice sent" || b.pay === "Unpaid") && (
            <>
              <Button onClick={() => act(b.ref, "paid")}>Mark paid</Button>
              <Button onClick={() => act(b.ref, "resend")}>Resend invoice</Button>
            </>
          )}
          {b.status !== "Cancelled" &&
            b.status !== "Declined" &&
            (b.past === true ? (
              <Button variant="cta" onClick={() => cancelOpen(b.ref)}>
                Refund
              </Button>
            ) : (
              <Button variant="danger" onClick={() => cancelOpen(b.ref)}>
                Cancel booking
              </Button>
            ))}
          <Button onClick={() => alert("Opened change-date / transfer (same-camp dates).")}>
            Change date
          </Button>
          <Button onClick={() => alert("Opened a message to the booker.")}>Message</Button>
        </div>
      </Card>
    </div>
  );
}

function RefundSummary({ booking }: { booking: Booking }) {
  const b = booking;
  const c = b.cancel!;
  let label: string;
  if (c.refund === "full") label = `Full refund · ${money(c.amount != null ? c.amount : b.amount)}`;
  else if (c.refund === "partial") label = `Partial refund · ${money(c.amount || 0)}`;
  else if (c.refund === "none") label = "No refund";
  else label = `Refund ${c.refund}`;

  return (
    <>
      <SectionHead>Cancellation &amp; refund</SectionHead>
      <div className="rounded-[9px] border border-[#FAD4D0] bg-[#FFF3F2] px-3 py-2.5 text-[12px]">
        <div className="mb-1 font-bold text-[var(--red)]">
          {c.refundOnly ? "Refund issued" : "Cancelled"}
        </div>
        <div className="text-[var(--ink-2)]">
          On {c.on} · by {c.by}
        </div>
        <div className="mt-1.5">
          <Badge tone={{ bg: "#eef0f6", fg: "#5b6478" }}>{label}</Badge>
        </div>
        <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">
          {c.refund === "pending"
            ? "The parent has asked to cancel — approve or decline the refund in the actions below."
            : b.paymentIntentId
              ? "Approved refunds go back to the parent's card automatically through your Stripe account."
              : "This booking wasn't paid by card in ActivityOS — settle any refund directly with the parent."}
        </div>
      </div>
    </>
  );
}
