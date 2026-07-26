"use client";

import { useEffect, useState } from "react";
import { useBookingsStore } from "./store";
import type { Booking, Kid } from "./types";
import {
  altDates,
  attendeeCount,
  bookingKids,
  kidActiveDays,
  money,
  payLabelFor,
  payTone,
  refundedTotal,
  sessionCount,
  sessionIsoDates,
  statusTone,
  type BlockAvail,
} from "./helpers";
import { Badge, Button, Card, DefRow, Input, SectionHead, Select } from "@/components/ui";
import { useTenantSettings, reasonsFor } from "@/lib/settings";
import { refundFor, policyById } from "@/lib/cancellation";
import { post as apiPost, get as apiGet } from "@/lib/api";

interface MsgTemplate { id: string; name: string; subject?: string; body: string }

/** Message the family in the context of THIS booking — every merge field
 *  ({ChildName}, {SessionDate}, {VenueName}, {BookingRef}…) fills from it on send. */
function MessageBookingModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const [templates, setTemplates] = useState<MsgTemplate[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  useEffect(() => { apiGet<MsgTemplate[]>("/api/messages/templates").then(setTemplates).catch(() => {}); }, []);
  // Live preview of the merged text — exactly what the family will receive.
  useEffect(() => {
    if (!body.trim()) { setPreview(null); return; }
    const h = setTimeout(() => {
      apiPost<{ subject: string; body: string }>("/api/messages/from-booking", { ref: booking.ref, body: body.trim(), subject: subject.trim() || undefined, preview: true })
        .then(setPreview).catch(() => {});
    }, 400);
    return () => clearTimeout(h);
  }, [body, subject, booking.ref]);

  async function send() {
    if (!body.trim()) { setError("Write a message first."); return; }
    setBusy(true); setError(null);
    try {
      await apiPost("/api/messages/from-booking", { ref: booking.ref, subject: subject.trim() || undefined, body: body.trim() });
      setSent(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t send"); setBusy(false); }
  }

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} className="fixed inset-0 z-[9999] flex items-start justify-center overflow-auto bg-black/55 px-3.5 py-8">
      <div className="w-full max-w-[520px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-[0_24px_60px_rgba(0,0,0,.4)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <h3 className="m-0 text-[16px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Message {booking.booker}</h3>
          <button type="button" onClick={onClose} className="cursor-pointer text-[20px] leading-none text-[var(--ink-3)]">×</button>
        </div>
        {sent ? (
          <div className="px-5 py-8 text-center">
            <div className="text-[14px] font-bold text-[#1d3a8f]">✓ Message sent to {booking.booker}.</div>
            <div className="mt-3"><Button variant="primary" onClick={onClose}>Done</Button></div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 px-5 py-4">
              <div>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">Start from a template</div>
                <Select value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) { setBody(t.body); if (t.subject) setSubject(t.subject); } }} className="w-full">
                  <option value="">Blank message…</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">Subject</div>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (optional)" className="w-full" />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">Message</div>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} placeholder="Write your message…"
                  className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] leading-[1.5] text-[var(--ink)] outline-none focus:border-[var(--brand-2)]" />
              </div>
              <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[11.5px] leading-[1.5] text-[var(--ink-3)]">
                Merge fields fill from <b className="text-[var(--ink-2)]">this booking</b> on send: <code>{"{ParentName}"}</code>, <code>{"{ChildName}"}</code>, <code>{"{ListingName}"}</code>, <code>{"{SessionDate}"}</code>, <code>{"{VenueName}"}</code>, <code>{"{BookingRef}"}</code>, <code>{"{ProviderName}"}</code>.
              </div>
              {preview && (
                <div className="rounded-lg border border-[var(--brand-line,#cdddf7)] bg-[var(--brand-soft)] px-3 py-2.5">
                  <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.05em] text-[var(--brand-strong)]">Preview — what {booking.booker} will get</div>
                  {preview.subject && <div className="mb-1 text-[12.5px] text-[var(--ink)]"><b>Subject:</b> {preview.subject}</div>}
                  <div className="whitespace-pre-wrap text-[12.5px] leading-[1.5] text-[var(--ink)]">{preview.body}</div>
                </div>
              )}
              {error && <div className="text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-5 py-3.5">
              <Button onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={send} disabled={busy}>{busy ? "Sending…" : "Send message"}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

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

function AttendeeCard({ booking, kid, ki, blockAvail }: { booking: Booking; kid: Kid; ki: number; blockAvail: BlockAvail | null }) {
  const cancelChild = useBookingsStore((s) => s.cancelChild);
  const cancelDay = useBookingsStore((s) => s.cancelDay);
  const changeDay = useBookingsStore((s) => s.changeDay);
  const cancelChange = useBookingsStore((s) => s.cancelChange);
  const applyChangeDay = useBookingsStore((s) => s.applyChangeDay);

  const initial = (kid.name || "?").slice(0, 1);
  // The whole booking being cancelled cancels every day — so no per-day
  // "Move"/"Cancel this day" (there's nothing left to move or cancel).
  const bookingCancelled = booking.status === "Cancelled" || booking.status === "Declined";

  if (kid.cancelled || bookingCancelled) {
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
                        Move to another date this block runs
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {altDates(kid, blockAvail).map((nd) => (
                          <button
                            key={nd.iso}
                            onClick={() => applyChangeDay(booking.ref, ki, dt, nd.iso)}
                            className="cursor-pointer rounded-full border-[1.5px] border-[var(--brand-line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-bold text-[var(--brand)]"
                          >
                            {nd.label}
                          </button>
                        ))}
                        {altDates(kid, blockAvail).length === 0 && (
                          <span className="text-[11px] text-[var(--ink-3)]">
                            {blockAvail ? "No other dates with space on this block." : "Checking the block's dates…"}
                          </span>
                        )}
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

// Sentinel for "none of these fit" — not a reason, so it can never be
// mistaken for one in the stored value.
const OTHER = "__other__";

function CancelPanel({ booking }: { booking: Booking }) {
  const setRefund = useBookingsStore((s) => s.setRefund);
  const doCancel = useBookingsStore((s) => s.doCancel);
  const cancelAbort = useBookingsStore((s) => s.cancelAbort);
  const rt = booking._refundType || "full";
  const { settings } = useTenantSettings();
  // What the provider's own policy says is owed, given how much notice this
  // cancellation actually gives. A recommendation, not an action: it prefills
  // the partial box and shows its working, and the provider overrules it by
  // typing. Null when we can't tell — a confident wrong number about someone
  // else's money is worse than no number.
  // Who decided this — not who's clicking. An operator cancels for both
  // reasons from the same screen: their own session falling through, and a
  // parent ringing up. Nothing on the booking can tell the two apart, so it
  // has to be asked, and it changes the answer completely.
  const [initiator, setInitiator] = useState<"provider" | "parent">("parent");
  // Which policy applied to THIS booking is a question the booking can't
  // answer yet — it stores the listing's name, not its id, so there's nothing
  // to look the policy up by. Amir stamping the policy onto the booking is
  // the real fix (§O). Until then the operator confirms it, defaulting to the
  // first, and the panel says which one it's using rather than quietly
  // assuming.
  const [policyId, setPolicyId] = useState<string | undefined>(undefined);
  const [pickedReason, setPickedReason] = useState("");
  const [otherText, setOtherText] = useState("");
  const offeredReasons = reasonsFor(settings.cancellationReasons, initiator);
  // Derived, not stored: switching who cancelled swaps the list, and a reason
  // from the other side must not stay quietly selected underneath.
  const other = pickedReason === OTHER;
  const reason = other ? otherText.trim() : offeredReasons.some((r) => r.label === pickedReason) ? pickedReason : "";
  const policy = policyById(settings.cancellationPolicies, policyId);
  const advice = refundFor(
    policy ?? { bands: [] },
    // Earliest dated session, not the first listed: the notice period runs
    // from when the child was next due in, and sessions aren't guaranteed to
    // be in order. Free-text sessions ("Week 1") parse to nothing and
    // correctly leave us with no advice to give.
    sessionIsoDates(booking).sort()[0],
    booking.amount,
    new Date().toISOString(),
    initiator,
  );
  // The amount follows the advice until the operator types over it, and then
  // stays put. Held as "what they typed, or nothing yet" rather than seeded
  // once: switching who cancelled changes what's owed, and a box still showing
  // the old figure is the kind of thing that gets sent.
  const [typed, setTyped] = useState<number | null>(null);
  const partial = typed ?? advice?.amount ?? (booking.amount ? Math.round(booking.amount / 2) : 0);

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
      <div className="mb-3">
        <div className="mb-[7px] text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
          Whose decision was this?
        </div>
        <div className="flex flex-wrap gap-[7px]">
          {([
            ["parent", "The family asked", "They've changed their mind, or rung you about it. Your notice periods apply."],
            ["provider", "We cancelled it", "Venue gone, coach ill, too few booked. The family did nothing wrong, so everything goes back."],
          ] as const).map(([v, label, why]) => (
            <span
              key={v}
              title={why}
              onClick={() => setInitiator(v)}
              className={
                "cursor-pointer rounded-lg border-[1.5px] px-3 py-[7px] text-[12px] font-bold " +
                (initiator === v
                  ? "border-[var(--cta,#e22295)] bg-[var(--cta,#e22295)] text-white"
                  : "border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink-2)]")
              }
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Only worth asking when there's more than one to choose from. */}
      {initiator === "parent" && settings.cancellationPolicies.length > 1 && (
        <div className="mb-3">
          <div className="mb-[7px] text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
            Which policy applies?
          </div>
          <select
            value={policy?.id ?? ""}
            onChange={(e) => setPolicyId(e.target.value)}
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none"
          >
            {settings.cancellationPolicies.map((p) => (
              <option key={p.id} value={p.id}>{p.name || "Untitled policy"}</option>
            ))}
          </select>
        </div>
      )}

      {/* Only the reasons that belong to whoever cancelled. Switching between
          "we cancelled" and "the family asked" swaps the list — offering
          "Venue unavailable" for a family's change of mind is how a reason
          code ends up meaning nothing when you come to report on it. */}
      {settings.askReasonOperator && offeredReasons.length > 0 && (
        <div className="mb-3">
          <div className="mb-[7px] text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
            Why? <span className="font-bold normal-case tracking-normal text-[var(--ink-3)]">— optional</span>
          </div>
          <div className="flex flex-wrap gap-[7px]">
            {offeredReasons.map((r) => (
              <span
                key={r.id}
                onClick={() => setPickedReason(reason === r.label ? "" : r.label)}
                className={
                  "cursor-pointer rounded-lg border-[1.5px] px-2.5 py-[5px] text-[11.5px] font-bold " +
                  (reason === r.label
                    ? "border-[var(--cta,#e22295)] bg-[var(--cta,#e22295)] text-white"
                    : "border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink-2)]")
                }
              >
                {r.label}
              </span>
            ))}
            {/* None of the presets fit. Without this, whoever is cancelling
                either picks a reason that's nearly right — which quietly
                poisons the reporting — or leaves it blank. */}
            <span
              onClick={() => setPickedReason(other ? "" : OTHER)}
              className={
                "cursor-pointer rounded-lg border-[1.5px] px-2.5 py-[5px] text-[11.5px] font-bold " +
                (other
                  ? "border-[var(--cta,#e22295)] bg-[var(--cta,#e22295)] text-white"
                  : "border-dashed border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink-2)]")
              }
            >
              Something else
            </span>
          </div>
          {other && (
            <input
              autoFocus
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder="In your own words"
              maxLength={120}
              className="mt-2 w-full max-w-[380px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none"
            />
          )}
          <div className="mt-1.5 text-[10.5px] font-semibold text-[#8a5300]">
            &#9888; Recorded on screen only — the API has no field for a reason yet (Amir).
          </div>
        </div>
      )}

      {advice && (
        <div className="mb-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
          <div className="text-[12.5px] font-extrabold">
            Your policy says {advice.percent === 100 ? "a full refund" : advice.percent === 0 ? "no refund" : `${advice.percent}% — ${money(advice.amount)}`}
          </div>
          <div className="mt-0.5 text-[11px] leading-[1.45] text-[var(--ink-3)]">
            {advice.reason} Change it below if this one&apos;s different — it&apos;s a suggestion, not a rule.
          </div>
        </div>
      )}
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
            onChange={(e) => setTyped(parseFloat(e.target.value) || 0)}
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

// Full date-change request, repeated clearly in the opened booking so the
// provider can read every From→To and approve/deny (with an optional reason).
function DateChangePanel({ booking }: { booking: Booking }) {
  const resolveMove = useBookingsStore((s) => s.resolveMove);
  const [reason, setReason] = useState("");
  const [denying, setDenying] = useState(false);
  const req = booking.dateChangeRequest;
  if (req?.status !== "pending") return null;
  const fmt = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }); };
  return (
    <div className="mb-3 rounded-xl border-2 border-[#f0c96b] bg-[#fffaf0] p-3.5">
      <div className="text-[13px] font-extrabold text-[#8a5300]">📅 Date change requested by the family</div>
      <div className="mt-2 flex flex-col gap-1.5">
        {req.moves.map((m, i) => (
          <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg bg-white px-3 py-2 text-[13px]">
            {m.childName && <span className="font-bold text-[var(--ink)]">{m.childName}</span>}
            <span className="text-[var(--ink-3)]">From</span> <b className="text-[var(--ink)]">{fmt(m.from)}</b>
            <span className="text-[var(--ink-3)]">→ To</span> <b className="text-[#1d3a8f]">{fmt(m.to)}</b>
          </div>
        ))}
      </div>
      {denying && (
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for declining (optional) — the family sees this"
          className="mt-2.5 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#1d3a8f]" />
      )}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => resolveMove(booking.ref, true)} title="Apply the swap — dates move on the family's schedule and they're told">Approve &amp; move dates</Button>
        {denying ? (
          <Button variant="danger" onClick={() => resolveMove(booking.ref, false, reason)}>Confirm decline</Button>
        ) : (
          <Button onClick={() => setDenying(true)}>Deny…</Button>
        )}
      </div>
      <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">On approve, the family&rsquo;s schedule + booking update automatically and they&rsquo;re emailed and notified. Deny leaves the booking unchanged and tells them (with your reason).</div>
    </div>
  );
}

export function BookingDetail({ booking }: { booking: Booking }) {
  const close = useBookingsStore((s) => s.close);
  const act = useBookingsStore((s) => s.act);
  const cancelOpen = useBookingsStore((s) => s.cancelOpen);
  const saveNote = useBookingsStore((s) => s.saveNote);
  const [note, setNote] = useState(booking.note || "");
  const [messaging, setMessaging] = useState(false);
  // The block's live availability — feeds the per-day "Move" chips with the
  // dates this block really runs and has space on.
  const [blockAvail, setBlockAvail] = useState<BlockAvail | null>(null);
  useEffect(() => {
    setBlockAvail(null);
    if (!booking.blockId) return;
    apiGet<BlockAvail[]>("/api/blocks")
      .then((list) => setBlockAvail(list.find((x) => x.id === booking.blockId) ?? null))
      .catch(() => {});
  }, [booking.blockId]);

  const b = booking;
  const kids = bookingKids(b);

  // The booking's actions — rendered in one row at the top (under the status).
  const ACTION_BUTTONS = (
    <>
      {b.past === true && <Badge tone={{ bg: "#eef0f6", fg: "#5b6478" }}>Activity completed</Badge>}
      {b.status === "Approval needed" && (
        <>
          <Button variant="primary" onClick={() => act(b.ref, "approve")}>Approve</Button>
          <Button onClick={() => act(b.ref, "decline")}>Decline</Button>
        </>
      )}
      {b.status === "Waitlisted" && (
        <>
          <Button variant="primary" onClick={() => act(b.ref, "offer")}>Offer place (2h hold)</Button>
          <Button onClick={() => act(b.ref, "promote")} title="Seat immediately — may overbook">Promote now</Button>
        </>
      )}
      {b.status === "Offered" && (
        <>
          <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>Held until {b.offerExpiresAt ? new Date(b.offerExpiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "…"}</Badge>
          <Button onClick={() => act(b.ref, "promote")} title="Confirm without waiting for the family">Confirm now</Button>
        </>
      )}
      {(b.cancel?.refund === "full" || b.cancel?.refund === "partial" || b.cancel?.refund === "pending") && (() => {
        const isVoucher = !!b.voucherScheme || (b.method ?? "").toLowerCase().includes("voucher");
        return (
          <>
            {isVoucher && (
              <div className="w-full rounded-lg border border-[#f0d9a8] bg-[#fdf6e6] px-3 py-2 text-[11.5px] leading-[1.5] text-[#7a5b06]">
                Paid by <b>{b.voucherScheme ?? "voucher"}</b>, not a card — ActivityOS can&rsquo;t send this for you. If the family took <b>wallet credit</b> there&rsquo;s nothing to do. Otherwise <b>reimburse them back through {b.voucherScheme ?? "the scheme"}</b>, then click below to confirm it&rsquo;s done — the family is told straight away.
              </div>
            )}
            <Button variant="primary" onClick={() => act(b.ref, "refund-approve")}>
              {isVoucher ? "Mark refund reimbursed" : `Approve refund${b.paymentIntentId ? " (via Stripe)" : ""}`}
            </Button>
            <Button onClick={() => act(b.ref, "refund-decline")}>Decline refund</Button>
          </>
        );
      })()}
      {(b.pay === "Invoice sent" || b.pay === "Unpaid") && (
        <>
          <Button onClick={() => act(b.ref, "paid")}>Mark paid</Button>
          <Button onClick={() => act(b.ref, "resend")}>Resend invoice</Button>
        </>
      )}
      {b.pay === "Awaiting voucher payment" && (
        <Button variant="primary" onClick={() => act(b.ref, "paid")}>Mark voucher received</Button>
      )}
      {b.status !== "Cancelled" && b.status !== "Declined" && (
        b.past === true
          ? <Button variant="cta" onClick={() => cancelOpen(b.ref)}>Refund</Button>
          : <Button variant="danger" onClick={() => cancelOpen(b.ref)}>Cancel booking</Button>
      )}
    </>
  );

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

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Badge tone={statusTone(b.status)}>{b.status}</Badge>
          {/* Once cancelled/declined the payment state is moot — a cancelled
              booking isn't "awaiting" anything. */}
          {b.status !== "Cancelled" && b.status !== "Declined" && (
            <Badge tone={payTone(b.pay)}>{payLabelFor(b)}</Badge>
          )}
        </div>

        {/* All actions live up here, right under the status. */}
        <div className="mt-3 flex flex-wrap items-center gap-[7px]">
          {b.email && (
            <button
              type="button"
              onClick={() => setMessaging(true)}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold text-white shadow-sm transition-transform hover:-translate-y-px"
              style={{ background: "var(--brand-2)" }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3.5 7l8.5 6 8.5-6" /></svg>
              Message family
            </button>
          )}
          {ACTION_BUTTONS}
        </div>
        {messaging && <MessageBookingModal booking={b} onClose={() => setMessaging(false)} />}

        {/* Tiles */}
        <div className="my-3.5 mb-0.5 flex flex-wrap gap-2">
          <Tile
            big={String(attendeeCount(b))}
            small={attendeeCount(b) === 1 ? "Attendee" : "Attendees"}
          />
          <Tile big={String(sessionCount(b))} small="Sessions" />
          <Tile big={money(b.amount)} small="Total" />
        </div>

        <DateChangePanel booking={b} />

        {b._cancelling && <CancelPanel booking={b} />}

        {/* Attendees */}
        <SectionHead>Attendees</SectionHead>
        {kids.map((k, ki) => (
          <AttendeeCard key={ki} booking={b} kid={k} ki={ki} blockAvail={blockAvail} />
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
                      ? { bg: "#eaf0fc", fg: "#1d3a8f" }
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
                      ? { bg: "#eaf0fc", fg: "#1d3a8f" }
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
        {/* How much and why — the amount, its share of the total, and the
            policy working the family was shown. */}
        {c.refund !== "none" && c.amount != null && c.amount > 0 && b.amount > 0 && (
          <div className="mt-1.5 text-[11.5px] text-[var(--ink-2)]">
            <b>{money(c.amount)}</b> to refund — {Math.round((c.amount / b.amount) * 100)}% of {money(b.amount)}, under the cancellation policy.
          </div>
        )}
        {c.msg && <div className="mt-1 text-[11px] italic text-[var(--ink-3)]">“{c.msg}”</div>}
        <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">
          {c.refund === "pending" || c.refund === "full" || c.refund === "partial"
            ? "The parent asked to cancel — approve or issue the refund in the actions below."
            : b.paymentIntentId
              ? "Approved refunds go back to the parent's card automatically through your Stripe account."
              : "This booking wasn't paid by card in ActivityOS — settle any refund directly with the parent."}
        </div>
      </div>
    </>
  );
}
