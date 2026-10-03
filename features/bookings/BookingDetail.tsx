"use client";

import { dateLocale as dl } from "@/lib/i18n/format";
import { useEffect, useState } from "react";
import { useT, useWord, useI18n } from "@/lib/i18n/provider";
import { Rich } from "@/components/i18n/Rich";
import { useBookingsStore } from "./store";
import type { Booking, Kid } from "./types";
import {
  altDates,
  attendeeCount,
  bookingKids,
  kidActiveDays,
  money,
  payLabelFor,
  pendingPayActionT,
  payTone,
  waitingForPlace,
  realPhone,
  refundedTotal,
  sessionCount,
  sessionIsoDates,
  statusTone,
  type BlockAvail,
} from "./helpers";
import { Badge, Button, Card, DefRow, Input, SectionHead, Select } from "@/components/ui";
import { useTenantSettings, reasonsFor } from "@/lib/settings";
import { refundFor, policyById, adviceReasonT } from "@/lib/cancellation";
import { post as apiPost, get as apiGet } from "@/lib/api";
import { ChildCard, type ChildInfo } from "@/features/registers/ChildCard";

interface MsgTemplate { id: string; name: string; subject?: string; body: string }

/** Message the family in the context of THIS booking — every merge field
 *  ({ChildName}, {SessionDate}, {VenueName}, {BookingRef}…) fills from it on send. */
function MessageBookingModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const t = useT();
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
    if (!body.trim()) { setError(t("p7bd.writeFirst")); return; }
    setBusy(true); setError(null);
    try {
      await apiPost("/api/messages/from-booking", { ref: booking.ref, subject: subject.trim() || undefined, body: body.trim() });
      setSent(true);
    } catch (e) { setError(e instanceof Error ? e.message : t("p7bd.couldntSend")); setBusy(false); }
  }

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} className="fixed inset-0 z-[9999] flex items-start justify-center overflow-auto bg-black/55 px-3.5 py-8">
      <div className="w-full max-w-[520px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-[0_24px_60px_rgba(0,0,0,.4)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <h3 className="m-0 text-[16px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("p7bd.msgTitle", { name: booking.booker })}</h3>
          <button type="button" onClick={onClose} className="cursor-pointer text-[20px] leading-none text-[var(--ink-3)]">×</button>
        </div>
        {sent ? (
          <div className="px-5 py-8 text-center">
            <div className="text-[14px] font-bold text-[#1d3a8f]">{t("p7bd.msgSent", { name: booking.booker })}</div>
            <div className="mt-3"><Button variant="primary" onClick={onClose}>{t("p7bd.done")}</Button></div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 px-5 py-4">
              <div>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">{t("p7bd.startTpl")}</div>
                <Select value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) { setBody(t.body); if (t.subject) setSubject(t.subject); } }} className="w-full">
                  <option value="">{t("p7bd.blankMsg")}</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">{t("p7bd.subjectLbl")}</div>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("p7bd.subjectOpt")} className="w-full" />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">{t("p7bd.messageLbl")}</div>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} placeholder={t("p7bd.writePh")}
                  className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] leading-[1.5] text-[var(--ink)] outline-none focus:border-[var(--brand-2)]" />
              </div>
              <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[11.5px] leading-[1.5] text-[var(--ink-3)]">
                <Rich text={t("p7bd.mergeLead")} bClass="text-[var(--ink-2)]" /> <code>{"{ParentName}"}</code>, <code>{"{ChildName}"}</code>, <code>{"{ListingName}"}</code>, <code>{"{SessionDate}"}</code>, <code>{"{VenueName}"}</code>, <code>{"{BookingRef}"}</code>, <code>{"{ProviderName}"}</code>.
              </div>
              {preview && (
                <div className="rounded-lg border border-[var(--brand-line,#cdddf7)] bg-[var(--brand-soft)] px-3 py-2.5">
                  <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.05em] text-[var(--brand-strong)]">{t("p7bd.previewOf", { name: booking.booker })}</div>
                  {preview.subject && <div className="mb-1 text-[12.5px] text-[var(--ink)]"><b>{t("p7bd.subjectColon")}</b> {preview.subject}</div>}
                  <div className="whitespace-pre-wrap text-[12.5px] leading-[1.5] text-[var(--ink)]">{preview.body}</div>
                </div>
              )}
              {error && <div className="text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-5 py-3.5">
              <Button onClick={onClose}>{t("common.cancel")}</Button>
              <Button variant="primary" onClick={send} disabled={busy}>{busy ? t("p7shell.bugSending") : t("p7bd.sendMessage")}</Button>
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
  const t = useT();
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
            {kid.name || t("p7bd.childN", { n: ki + 1 })}
          </div>
          <div className="mt-0.5">
            <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "#bb1620" }}>{t("p7bd.placeCancelled")}</Badge>
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
            {kid.name || t("p8lst.bsChildN", { n: ki + 1 })}
          </div>
          <div className="text-[11.5px] text-[var(--ink-3)]">
            {kid.age != null ? t("p7bd.ageYrs", { n: kid.age }) : ""}
            {kid.dob ? ` · ${kid.dob}` : ""}
          </div>
        </div>
        {active.length > 1 && (
          <button
            onClick={() => cancelChild(booking.ref, ki)}
            title={t("p7bd.cancelAllTip", { n: active.length, name: kid.name || t("p7bd.thisChild") })}
            className="cursor-pointer whitespace-nowrap text-[11px] font-bold text-[var(--red)]"
          >
            {t("p7bd.cancelAllDays", { n: active.length })}
          </button>
        )}
      </div>

      {kid.dates && kid.dates.length > 0 && (
        <div className="mt-2.5">
          <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.03em] text-[var(--ink-3)]">
            {t("p7bd.daysOfN", { a: active.length, b: kid.dates.length })}
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
                    <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "#bb1620" }}>{t("p7bd.cancelledLower")}</Badge>
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
                      title={t("p7bd.moveTip")}
                      className="cursor-pointer text-[11px] font-bold text-[var(--brand)]"
                    >
                      {t("p7bd.moveWord")}
                    </button>
                    <button
                      onClick={() => cancelDay(booking.ref, ki, dt)}
                      title={t("p7bd.cancelDayTip")}
                      className="cursor-pointer text-[11px] font-bold text-[var(--red)]"
                    >
                      {t("p7bd.cancelThisDay")}
                    </button>
                  </div>
                  {changing && (
                    <div className="my-0.5 mb-[7px] rounded-[9px] bg-[var(--brand-soft)] px-2.5 py-2">
                      <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.03em] text-[var(--ink-3)]">
                        {t("p7bd.moveToAnother")}
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
                            {blockAvail ? t("p7bd.noOtherBlockDates") : t("p7bd.checkingBlock")}
                          </span>
                        )}
                        <button
                          onClick={() => cancelChange(booking.ref)}
                          className="cursor-pointer self-center text-[11px] text-[var(--ink-3)]"
                        >
                          {t("p7bd.cancelLower")}
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
  const t = useT();
  const { locale } = useI18n();
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
        {booking.past ? t("p7bd.issueRefundHead") : t("p7bd.cancelThisBooking")}
      </div>
      <div className="mb-3 text-[12px] text-[var(--ink-2)]">
        {t("p7bd.youDecide")}
      </div>
      <div className="mb-3">
        <div className="mb-[7px] text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
          {t("p7bd.whoseDecision")}
        </div>
        <div className="flex flex-wrap gap-[7px]">
          {([
            ["parent", t("p7bd.familyAsked"), t("p7bd.familyAskedWhy")],
            ["provider", t("p7bd.weCancelled"), t("p7bd.weCancelledWhy")],
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
            {t("p7bd.whichPolicy")}
          </div>
          <select
            value={policy?.id ?? ""}
            onChange={(e) => setPolicyId(e.target.value)}
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none"
          >
            {settings.cancellationPolicies.map((p) => (
              <option key={p.id} value={p.id}>{p.name || t("p7bd.untitledPolicy")}</option>
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
            {t("p7bd.whyQ")} <span className="font-bold normal-case tracking-normal text-[var(--ink-3)]">{t("p7bd.optionalDash")}</span>
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
              {t("p7bd.somethingElse")}
            </span>
          </div>
          {other && (
            <input
              autoFocus
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder={t("p7bd.ownWords")}
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
            {t("p7bd.policySays", { what: advice.percent === 100 ? t("p7bd.adviceFull") : advice.percent === 0 ? t("p7bd.adviceNone") : t("p7bd.advicePct", { pct: advice.percent, amt: money(advice.amount) }) })}
          </div>
          <div className="mt-0.5 text-[11px] leading-[1.45] text-[var(--ink-3)]">
            {adviceReasonT(t, locale, advice)} {t("p7bd.adviceSuffix")}
          </div>
        </div>
      )}
      <div className="mb-[7px] text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
        {t("p7bd.refundParentQ")}
      </div>
      <div className="flex flex-wrap gap-[7px]">
        <RBtn t="full" label={t("p7bd.yesFull", { amt: money(booking.amount) })} />
        <RBtn t="partial" label={t("p7bd.partialLbl")} />
        <RBtn t="none" label={t("p7bd.noRefundBtn")} />
      </div>
      {rt === "partial" && (
        <div className="mt-2.5">
          <label className="mb-[3px] block text-[11px] font-bold text-[var(--ink-3)]">
            {t("p7bd.refundAmountGbp")}
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
          {booking.past ? t("p7bd.issueRefundBtn") : t("p7bd.confirmCancellation")}
        </Button>
        <Button onClick={() => cancelAbort(booking.ref)}>{booking.past ? t("p7bd.closeBtn") : t("p7bd.keepBooking")}</Button>
      </div>
    </div>
  );
}

// Full date-change request, repeated clearly in the opened booking so the
// provider can read every From→To and approve/deny (with an optional reason).
function DateChangePanel({ booking }: { booking: Booking }) {
  const t = useT();
  const resolveMove = useBookingsStore((s) => s.resolveMove);
  const req = booking.dateChangeRequest;
  // Every swap starts ticked (bulk-approve). Untick any you won't allow.
  const [picked, setPicked] = useState<number[]>(() => (req?.moves ?? []).map((_, i) => i));
  const [reason, setReason] = useState("");
  if (req?.status !== "pending") return null;
  const fmt = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(dl(), { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }); };
  const toggle = (i: number) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  const multiChild = new Set(req.moves.map((m) => m.childName).filter(Boolean)).size > 1;
  const approveN = picked.length;
  const declineN = req.moves.length - approveN;
  // Row index within req.moves (grouping is display-only; checkboxes act on the
  // real index).
  let idx = -1;
  const byChild = new Map<string, { m: typeof req.moves[number]; i: number }[]>();
  for (const m of req.moves) { idx++; const k = m.childName ?? ""; byChild.set(k, [...(byChild.get(k) ?? []), { m, i: idx }]); }
  return (
    <div className="mb-3 rounded-xl border-2 border-[#f0c96b] bg-[#fffaf0] p-3.5">
      <div className="text-[13px] font-extrabold text-[#8a5300]">{t("p7bd.dcTitle")}</div>
      <div className="mt-0.5 text-[11px] text-[var(--ink-3)]">{t("p7bd.dcTick")}</div>
      <div className="mt-2 flex flex-col gap-2">
        {[...byChild.entries()].map(([child, rows]) => (
          <div key={child || "one"}>
            {multiChild && child && <div className="mb-1 text-[12px] font-extrabold text-[var(--ink)]">{child}</div>}
            <div className="flex flex-col gap-1">
              {rows.map(({ m, i }) => {
                const on = picked.includes(i);
                return (
                  <label key={i} className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border bg-white px-3 py-2 text-[13px]" style={{ borderColor: on ? "#0f7a43" : "#f0d9a8", opacity: on ? 1 : 0.65 }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(i)} className="me-1" />
                    <span className="text-[var(--ink-3)]">{t("p7bkl.fromLbl")}</span> <b className="text-[var(--ink)]">{fmt(m.from)}</b>
                    <span className="text-[var(--ink-3)]">{t("p7bkl.toLbl")}</span> <b className="text-[#1d3a8f]">{fmt(m.to)}</b>
                    {!on && <span className="ms-auto text-[11px] font-bold text-[#c0392b]">{t("p7bd.wontApprove")}</span>}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {/* Always available — an operator can add a reason whether they decline
          everything or just some. Shown to the family on declined dates. */}
      <input value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder={
          declineN > 0
            ? (declineN === 1 ? t("p7bd.dcWhyOne") : t("p7bd.dcWhyMany"))
            : t("p7bd.dcReasonDecline")
        }
        className="mt-2.5 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#1d3a8f]" />
      <div className="mt-2.5 flex flex-wrap gap-2">
        {approveN > 0 && (
          <Button variant="primary" onClick={() => resolveMove(booking.ref, true, reason, declineN > 0 ? picked : undefined)}
            title={t("p7bd.approveMoveTip")}>
            {declineN > 0 ? t("p7bd.approveND", { a: approveN, d: declineN }) : req.moves.length === 1 ? t("p7bd.approveMoveDate") : t("p7bd.approveMoveDates")}
          </Button>
        )}
        <Button variant="danger" onClick={() => resolveMove(booking.ref, false, reason)}>{req.moves.length === 1 ? t("p7bd.declineWord") : t("p7bd.declineAll")}</Button>
      </div>
      <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">{t("p7bd.dcFoot")}</div>
    </div>
  );
}

export function BookingDetail({ booking }: { booking: Booking }) {
  const t = useT();
  const w = useWord();
  const close = useBookingsStore((s) => s.close);
  const act = useBookingsStore((s) => s.act);
  const cancelOpen = useBookingsStore((s) => s.cancelOpen);
  const saveNote = useBookingsStore((s) => s.saveNote);
  const [note, setNote] = useState(booking.note || "");
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [messaging, setMessaging] = useState(false);
  const [tab, setTab] = useState<"booking" | "children">("booking");
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
      {b.past === true && <Badge tone={{ bg: "#eef0f6", fg: "#5b6478" }}>{t("p7bd.activityCompleted")}</Badge>}
      {b.status === "Approval needed" && (
        <>
          <Button variant="primary" onClick={() => act(b.ref, "approve")}>{t("p7bd.approveBtn")}</Button>
          <Button onClick={() => { setDeclineReason(""); setDeclining(true); }}>{t("p7bd.declineWord")}</Button>
        </>
      )}
      {b.status === "Waitlisted" && (
        <>
          <Button variant="primary" onClick={() => act(b.ref, "offer")}>{t("p7bd.offerPlace")}</Button>
          <Button onClick={() => act(b.ref, "promote")} title={t("p7bd.seatTip")}>{t("p7bd.promoteNow")}</Button>
        </>
      )}
      {b.status === "Offered" && (
        <>
          <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>{t("p7bd.heldUntil", { time: b.offerExpiresAt ? new Date(b.offerExpiresAt).toLocaleTimeString(dl(), { hour: "2-digit", minute: "2-digit" }) : "…" })}</Badge>
          <Button onClick={() => act(b.ref, "promote")} title={t("p7bd.confirmNowTip")}>{t("p7bd.confirmNow")}</Button>
        </>
      )}
      {(b.cancel?.refund === "full" || b.cancel?.refund === "partial" || b.cancel?.refund === "pending") && (() => {
        const isVoucher = !!b.voucherScheme || (b.method ?? "").toLowerCase().includes("voucher");
        const dest = b.cancel?.refundTo;
        return (
          <>
            {dest && (
              <div className="w-full rounded-lg border border-[#c9dcff] bg-[#eef4ff] px-3 py-2 text-[11.5px] font-semibold leading-[1.5] text-[#1d3a8f]">
                <Rich text={dest === "wallet" ? t("p7bd.refAskWallet") : isVoucher ? t("p7bd.refAskVoucher", { scheme: b.voucherScheme ?? t("p7bd.theirScheme") }) : t("p7bd.refAskCard")} />
              </div>
            )}
            {b.cancel?.amount != null && b.cancel.amount > 0 && (
              <div className="w-full text-[12px] font-semibold leading-[1.5] text-[var(--ink)]">
                Refund requested: {money(b.cancel.amount)}
                {b.amount > 0 && <> of {money(b.amount)} paid ({Math.round((b.cancel.amount / b.amount) * 100)}%)</>}
                {b.cancel.msg && <span className="font-normal text-[var(--ink-2)]"> · {b.cancel.msg}</span>}
              </div>
            )}
            {isVoucher && (
              <div className="w-full rounded-lg border border-[#f0d9a8] bg-[#fdf6e6] px-3 py-2 text-[11.5px] leading-[1.5] text-[#7a5b06]">
                <Rich text={t("p7bd.voucherBox", { scheme: b.voucherScheme ?? t("p7bd.voucherWord"), scheme2: b.voucherScheme ?? t("p7bk.schemeThe") })} />
              </div>
            )}
            <Button variant="primary" onClick={() => act(b.ref, "refund-approve")}>
              {dest === "wallet"
                ? t("p7bd.acceptWallet")
                : dest === "card"
                  ? t("p7bd.acceptBank")
                  : isVoucher ? t("p7bd.markReimbursed") : t("p7bd.approveRefundBtn") + (b.paymentIntentId ? " " + t("p7bd.viaStripe") : "")}
            </Button>
            <Button onClick={() => act(b.ref, "refund-decline")}>{t("p7bd.declineRefund")}</Button>
          </>
        );
      })()}
      {/* A cancelled booking with no refund waiting has nothing left to action: say so, and don't offer to chase a payment for it. */}
      {b.status === "Cancelled" && !(b.cancel?.refund === "full" || b.cancel?.refund === "partial" || b.cancel?.refund === "pending") && (
        <div className="w-full rounded-lg border border-[#e0e3ee] bg-[#f6f7fb] px-3 py-2 text-[12px] font-semibold leading-[1.5] text-[#4a4763]">
          {t("p7bd.cancelledNothingToDo")}
          {(b.pay === "Invoice sent" || b.pay === "Unpaid") && <> {t("p7bd.cancelledNoPayment")}</>}
        </div>
      )}
      {(b.pay === "Invoice sent" || b.pay === "Unpaid") && b.status !== "Cancelled" && b.status !== "Declined" && !waitingForPlace(b.status) && (
        <>
          <Button onClick={() => act(b.ref, "paid")}>{t("p7bd.markPaid")}</Button>
          <Button onClick={() => act(b.ref, "resend")}>{t("p7bd.resendInvoice")}</Button>
        </>
      )}
      {b.pay === "Awaiting voucher payment" && b.status !== "Cancelled" && b.status !== "Declined" && !waitingForPlace(b.status) && (
        <Button variant="primary" onClick={() => act(b.ref, "paid")}>{pendingPayActionT(t, w, b)}</Button>
      )}
      {b.status !== "Cancelled" && b.status !== "Declined" && (
        b.past === true
          ? <Button variant="cta" onClick={() => cancelOpen(b.ref)}>{t("p7bd.refundBtn")}</Button>
          : <Button variant="danger" onClick={() => cancelOpen(b.ref)}>{t("p7bd.cancelBookingBtn")}</Button>
      )}
    </>
  );

  return (
    <div>
      {declining && (
        <div
          onClick={(e) => e.target === e.currentTarget && setDeclining(false)}
          className="fixed inset-0 z-[9999] flex items-start justify-center overflow-auto bg-black/55 px-3.5 py-8"
        >
          <Card className="w-full max-w-[440px] px-5 py-[18px]">
            <h3 className="m-0 font-[var(--ff-display)] text-[18px] leading-tight text-[var(--ink)]">{t("p7bd.declineDlgTitle")}</h3>
            <p className="mt-1.5 mb-3 text-[13px] text-[var(--ink-3)]">
              {t("p7bd.declineDlgBody", { name: b.booker })}
            </p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              maxLength={300}
              rows={3}
              autoFocus
              placeholder={t("p7bd.declineDlgPh")}
              className="w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand)]"
            />
            <div className="mt-1 text-end text-[11px] text-[var(--ink-3)]">{declineReason.length}/300</div>
            <div className="mt-2 flex justify-end gap-2">
              <Button onClick={() => setDeclining(false)}>{t("common.cancel")}</Button>
              <Button
                variant="danger"
                onClick={() => { act(b.ref, "decline", declineReason.trim() || undefined); setDeclining(false); }}
              >
                {t("p7bd.declineBookingBtn")}
              </Button>
            </div>
          </Card>
        </div>
      )}
      <div className="mb-3">
        <button
          onClick={close}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--brand)] bg-[var(--brand)] px-4 py-2 text-[13px] font-extrabold text-white shadow-sm transition hover:-translate-y-px hover:opacity-95"
        >
          <span className="text-[15px] leading-none">‹</span> {t("p7bd.backToBookings")}
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
              <Rich text={t("p7bd.bookingRef", { ref: b.ref })} bClass="text-[var(--ink-2)]" />
              {(() => {
                // The reference the FAMILY entered at checkout (voucher account /
                // TFC payment ref) — what the provider matches the money against.
                // Show that rather than our internal booking id when it exists.
                const custRefs = [...new Set([
                  ...((b.payRefs ?? []).map((r) => r.ref)),
                  ...(b.paymentRef ? [b.paymentRef] : []),
                ].map((s) => s?.trim()).filter(Boolean))] as string[];
                return custRefs.length > 0
                  ? <> · <Rich text={t("p7bd.paymentRefLine", { refs: custRefs.join(", ") })} bClass="text-[var(--ink-2)]" /></>
                  : <> · {t("p7bd.idLine", { bid: b.bid })}</>;
              })()}
            </div>
            {/* When it came in — the question you ask before "and what did
                they book". Date and time, because two bookings on the same
                day are told apart by the clock. */}
            <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">
              {b.createdAt ? (
                <>
                  <Rich text={t("p7bd.bookedAtLine", { when: new Date(b.createdAt).toLocaleString(dl(), {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }) })} bClass="text-[var(--ink-2)]" />
                </>
              ) : (
                <span title={t("p7bd.bookedNotRecordedTip")}>
                  {t("p7bd.bookedNotRecorded")}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Badge tone={statusTone(b.status)}>{w(b.status)}</Badge>
          {/* Once cancelled/declined the payment state is moot — a cancelled
              booking isn't "awaiting" anything. */}
          {b.status !== "Cancelled" && b.status !== "Declined" && (
            <Badge tone={payTone(b.pay, b.status)}>{w(payLabelFor(b))}</Badge>
          )}
          {b.cardFailed && b.status !== "Cancelled" && b.status !== "Declined" && (
            <Badge tone={{ bg: "#fdebec", fg: "#c02636" }}>{t("p7bd.cardFailedBadge")}</Badge>
          )}
        </div>

        {b.cardFailed && b.status !== "Cancelled" && b.status !== "Declined" && (
          <div className="mt-2.5 rounded-xl border border-[#f6c9cc] bg-[#fdebec] px-3.5 py-2.5 text-[12.5px] text-[#c02636]">
            <Rich text={t("p7bd.cardFailedBody")} />
          </div>
        )}

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
              {t("p8lst.bsMessageFamily")}
            </button>
          )}
          {ACTION_BUTTONS}
        </div>
        {messaging && <MessageBookingModal booking={b} onClose={() => setMessaging(false)} />}

        {/* Tiles */}
        <div className="my-3.5 mb-0.5 flex flex-wrap gap-2">
          <Tile
            big={String(attendeeCount(b))}
            small={attendeeCount(b) === 1 ? t("p7bd.attendee_one") : t("p7bd.attendee_other")}
          />
          <Tile big={String(sessionCount(b))} small={t("p7bd.sessionsTile")} />
          <Tile big={money(b.amount)} small={t("p7bd.totalLbl")} />
        </div>

        {/* Tabs — the booking, or the same child card as the register */}
        <div className="mt-3 flex gap-1.5 border-b border-[var(--line)]">
          {(["booking", "children"] as const).map((tb) => (
            <button key={tb} type="button" onClick={() => setTab(tb)} className="-mb-px border-b-2 px-3 py-2 text-[12.5px] font-extrabold transition-colors" style={tab === tb ? { borderColor: "#1d3a8f", color: "#1d3a8f" } : { borderColor: "transparent", color: "var(--ink-3)" }}>
              {tb === "booking" ? t("p7bd.tabBooking") : t("p7bd.tabChild")}
            </button>
          ))}
        </div>

        {tab === "children" && <div className="mt-3"><ChildCardsPane key={b.ref} booking={b} /></div>}

        {tab === "booking" && (<>
        <div className="mt-3" />
        <DateChangePanel booking={b} />

        {b._cancelling && <CancelPanel booking={b} />}

        {/* Attendees */}
        <SectionHead>{t("p7bd.attendee_other")}</SectionHead>
        {kids.map((k, ki) => (
          <AttendeeCard key={ki} booking={b} kid={k} ki={ki} blockAvail={blockAvail} />
        ))}

        {/* Activity */}
        <SectionHead>{t("p7bd.secActivity")}</SectionHead>
        <DefRow label={t("p7bd.lblListing")} value={b.listing} />
        <DefRow label={t("p7bd.lblPass")} value={b.pass} />
        <DefRow label={t("p7bd.lblTicket")} value={b.ticket} />
        {b.addons && b.addons.length > 0 && <DefRow label={t("p7bd.lblAddons")} value={b.addons.join(", ")} />}

        {/* Contact */}
        <SectionHead>{t("p7bd.secContact")}</SectionHead>
        <DefRow label={t("p7bd.lblName")} value={b.booker} />
        <DefRow
          label={t("p7bd.lblPhone")}
          value={realPhone(b.phone) ? <a href={`tel:${realPhone(b.phone).replace(/ /g, "")}`}>{realPhone(b.phone)}</a> : <span className="text-[var(--ink-3)]">{t("p7bd.noPhone")}</span>}
        />
        <DefRow label={t("p7bd.lblEmail")} value={b.email} />

        {/* Checkout answers */}
        {b.answers && b.answers.length > 0 && (
          <>
            <SectionHead>{t("p7bd.secAnswers")}</SectionHead>
            {b.answers.map((a, i) => (
              <DefRow key={i} label={a[0]} value={a[1]} />
            ))}
          </>
        )}

        {/* Sessions */}
        <SectionHead>{t("p7bd.secDates")}</SectionHead>
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
        <SectionHead>{t("p7bd.secPayment")}</SectionHead>
        <DefRow label={t("p7bd.lblMethod")} value={methodLabel(b.method)} />
        {/bank|transfer/i.test(String(b.method ?? "")) && b.pay !== "Paid" && b.status !== "Cancelled" && (
          <div className="my-1.5 rounded-lg border border-[#c9d7f5] bg-[#eef3ff] px-3 py-2 text-[12.5px] text-[#171534]">
            <b>Waiting for a bank transfer.</b> The family was told to quote the reference <b>{b.ref}</b>. Look for that reference on your bank statement, then press <b>Mark paid</b>.
          </div>
        )}
        {(b.discountOff ?? 0) > 0 && b.listPrice != null && (
          <>
            <DefRow label="Price before discount" value={money(b.listPrice)} />
            <DefRow label={`Discount${b.discountNames?.length ? ` (${b.discountNames.join(", ")})` : ""}`} value={`− ${money(b.discountOff ?? 0)}`} />
          </>
        )}
        <DefRow label={t("p7bd.totalLbl")} value={money(b.amount)} />
        {(/tax.?free|\btfc\b/i.test(b.method ?? "") || /tax.?free|\btfc\b/i.test(b.voucherScheme ?? "")) && (
          <DefRow
            label={t("p7bd.lblTfcRecon")}
            value={
              <span className="inline-flex items-center gap-1.5">
                <Badge
                  tone={
                    b.recon
                      ? { bg: "#eaf0fc", fg: "#1d3a8f" }
                      : { bg: "#FCE9CE", fg: "#B45309" }
                  }
                >
                  {b.recon ? t("p7bd.yesWord") : t("p7bd.noWord")}
                </Badge>
                <a
                  onClick={() => act(b.ref, "recon")}
                  className="cursor-pointer text-[11px]"
                >
                  {t("p7bd.toggleWord")}
                </a>
              </span>
            }
          />
        )}
        {b.method === "HAF" && (
          <DefRow
            label={t("p7bd.lblHafEvidence")}
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
            <SectionHead>{t("p7bd.secCancelRefunds")}</SectionHead>
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
                <span>{t("p7bd.totalToRefund")}</span>
                <span className="text-[var(--red)]">{money(refundedTotal(b))}</span>
              </div>
              <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">
                {t("p7bd.actionRefunds")}
              </div>
            </div>
          </>
        )}

        {/* Mentor notes */}
        <SectionHead>{t("p7bd.secMentorNotes")}</SectionHead>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => saveNote(b.ref, note)}
          placeholder={t("p7bd.notesPh")}
          className="min-h-[54px] w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] text-[var(--ink)] outline-none"
        />
        <div className="mt-[3px] text-[10.5px] text-[var(--ink-3)]">
          {t("p7bd.onlyYou")}{" "}
          <a
            onClick={() => saveNote(b.ref, note)}
            className="cursor-pointer font-semibold"
          >
            {t("p7bd.saveNote")}
          </a>
        </div>
        </>)}

      </Card>
    </div>
  );
}

// The register's child card, shown in the booking detail — one per kid on the
// booking, fed by GET /api/bookings/:ref/children (full child record).
function ChildCardsPane({ booking }: { booking: Booking }) {
  const t = useT();
  const { settings, questions } = useTenantSettings();
  const card = settings.registers?.card ?? {};
  const fields = settings.registers?.fields ?? {};
  const [infos, setInfos] = useState<ChildInfo[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    // Keyed by booking.ref so it mounts fresh per booking — no synchronous reset.
    apiGet<{ booker: string; email: string; phone: string; ref: string; note: string; children: { name: string; childId: string | null; record: Record<string, unknown> | null }[] }>(`/api/bookings/${encodeURIComponent(booking.ref)}/children`)
      .then((d) => {
        const ageOf = (dob?: string) => { if (!dob) return undefined; const bd = new Date(dob); if (isNaN(+bd)) return undefined; const n = new Date(); let a = n.getFullYear() - bd.getFullYear(); const m = n.getMonth() - bd.getMonth(); if (m < 0 || (m === 0 && n.getDate() < bd.getDate())) a--; return a >= 0 && a < 120 ? a : undefined; };
        setInfos(d.children.map((ch) => {
          const r = (ch.record ?? {}) as Record<string, string | boolean | Record<string, string> | undefined>;
          return {
            name: ch.name, age: ageOf(r.dob as string | undefined), dob: r.dob as string | undefined, sex: r.sex as string | undefined, photo: r.photo as string | undefined,
            allergies: r.allergies as string | undefined, medical: r.medical as string | undefined, dietary: r.dietary as string | undefined, send: r.send as string | undefined, sendPlanName: r.sendPlanName as string | undefined, sendPlanId: r.sendPlanId as string | undefined, swimming: r.swimming as string | undefined,
            careNotes: r.careNotes as string | undefined, likes: r.likes as string | undefined, dislikes: r.dislikes as string | undefined, answers: r.answers as Record<string, string> | undefined,
            photoConsent: r.photoConsent as boolean | undefined, suncreamConsent: r.suncreamConsent as boolean | undefined, firstAidConsent: r.firstAidConsent as boolean | undefined, walkHomeConsent: r.walkHomeConsent as boolean | undefined,
            collectionPassword: r.collectionPassword as string | undefined, emergencyName: r.emergencyName as string | undefined, emergencyPhone: r.emergencyPhone as string | undefined, school: r.school as string | undefined,
            contactName: d.booker, contactPhone: d.phone, contactEmail: d.email, bookingRef: d.ref, bookingNotes: d.note,
          } as ChildInfo;
        }));
      })
      .catch((e) => setErr(e instanceof Error ? e.message : t("p7bd.errChildDetails")));
  }, [booking.ref]);
  if (err) return <div className="rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#c02636]">{err}</div>;
  if (!infos) return <div className="py-8 text-center text-[12.5px] text-[var(--ink-3)]">{t("p7bd.loadingChild")}</div>;
  if (infos.length === 0) return <div className="py-8 text-center text-[12.5px] text-[var(--ink-3)]">{t("p7bd.noChildLinked")}</div>;
  return <div className="space-y-4">{infos.map((info, i) => <ChildCard key={i} info={info} card={card} questions={questions} fields={fields} inline />)}</div>;
}

/** Friendly label for the stored payment method (display only). */
function methodLabel(m?: string | null): string {
  const v = String(m ?? "");
  if (/bank|transfer/i.test(v)) return "Bank transfer";
  if (/tax.?free/i.test(v)) return "Tax-Free Childcare";
  if (/voucher/i.test(v)) return "Childcare vouchers";
  if (/haf/i.test(v)) return "HAF funded";
  if (/cash/i.test(v)) return "Cash on the day";
  if (/card|stripe/i.test(v)) return "Card";
  return v;
}

function RefundSummary({ booking }: { booking: Booking }) {
  const t = useT();
  const w = useWord();
  const b = booking;
  const c = b.cancel!;
  let label: string;
  if (c.refund === "full") label = t("p7bd.fullRefundAmt", { amt: money(c.amount != null ? c.amount : b.amount) });
  else if (c.refund === "partial") label = t("p7bd.partialRefundAmt", { amt: money(c.amount || 0) });
  else if (c.refund === "none") label = t("p7bd.noRefundBtn");
  else label = t("p7bd.refundState", { state: w(c.refund) });

  return (
    <>
      <SectionHead>{t("p7bd.secCancelRefund")}</SectionHead>
      <div className="rounded-[9px] border border-[#FAD4D0] bg-[#FFF3F2] px-3 py-2.5 text-[12px]">
        <div className="mb-1 font-bold text-[var(--red)]">
          {!c.refundOnly ? t("p7bd.statusCancelled") : c.refund === "pending" ? t("p7bd.refundRequested") : t("p7bd.refundIssued")}
        </div>
        <div className="text-[var(--ink-2)]">
          {t("p7bd.onBy", { on: c.on, by: c.by })}
        </div>
        <div className="mt-1.5">
          <Badge tone={{ bg: "#eef0f6", fg: "#5b6478" }}>{label}</Badge>
        </div>
        {/* How much and why — the amount, its share of the total, and the
            policy working the family was shown. */}
        {c.refund !== "none" && c.amount != null && c.amount > 0 && b.amount > 0 && (
          <div className="mt-1.5 text-[11.5px] text-[var(--ink-2)]">
            <Rich text={t("p7bd.refundShare", { amt: money(c.amount), pct: Math.round((c.amount / b.amount) * 100), total: money(b.amount) })} />
          </div>
        )}
        {c.msg && <div className="mt-1 text-[11px] italic text-[var(--ink-3)]">“{c.msg}”</div>}
        <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">
          {c.refund === "pending" || c.refund === "full" || c.refund === "partial"
            ? t("p7bd.parentAsked")
            : b.paymentIntentId
              ? t("p7bd.stripeAuto")
              : t("p7bd.notCardPaid")}
        </div>
      </div>
    </>
  );
}
