"use client";

// The provider's money actions never fire on one click. "Cancel this day", "Cancel all N days", a child's
// whole place, "Mark paid" and "Mark refund sent" each open THIS inline panel first, which says in plain words
// what will happen (with the amount) and only then acts. Not window.confirm: it sits in the booking, in the theme.

import { useRefundMethod } from "./useRefundMethod";
import { refundMethodInfo, unsentKinds } from "./refundMethod";
import { useEffect, useRef, useState } from "react";
import { useT, useI18n } from "@/lib/i18n/provider";
import { localizeDateLabels } from "@/lib/i18n/format";
import { Button } from "@/components/ui";
import { useTenantSettings } from "@/lib/settings";
import { refundFor, effectiveRefundDate, policyById, adviceReasonT } from "@/lib/cancellation";
import { useBookingsStore } from "./store";
import type { Booking } from "./types";
import {
  bookingKids,
  dayIso,
  kidActiveDays,
  money,
  payMethodLabel,
  cashReceivedOf,
  refundableSoFar,
  refundButtonKind,
  refundOwedOf,
  refundTransferAmount,
  releaseValue,
  sessionDayLabel,
} from "./helpers";
import type { ReleaseResolution } from "./mutations";
import { walletShareFor } from "./refundSplit";

const round2 = (n: number) => Math.round(n * 100) / 100;
const shell = "my-3 rounded-xl border-[1.5px] border-[#FAD4D0] bg-[#FFF7F6] px-4 py-3.5";
const head = "mb-1 text-[13.5px] font-extrabold text-[var(--red)]";
const chip = (on: boolean) =>
  "cursor-pointer rounded-lg border-[1.5px] px-3 py-[7px] text-[12px] font-bold " +
  (on ? "border-[var(--cta,#e22295)] bg-[var(--cta,#e22295)] text-white" : "border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink-2)]");

export function MoneyConfirm({ booking }: { booking: Booking }) {
  const confirm = useBookingsStore((s) => s.confirm);
  const stripeWarn = useBookingsStore((s) => s.stripeWarn);
  const box = useRef<HTMLDivElement>(null);
  const live = !!confirm && confirm.ref === booking.ref;
  // The click that opened this was further down the page (a day row) or in the list — bring the question into view.
  useEffect(() => { if (live) box.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }); }, [live, confirm]);
  if (!confirm || !live) return null;
  const { intent } = confirm;
  return (
    <div ref={box}>
      {intent.kind === "refund-approve" && stripeWarn?.ref === booking.ref ? <StripeAlreadyRefundedConfirm booking={booking} />
        : intent.kind === "paid" ? <PaidConfirm booking={booking} />
        : intent.kind === "refund-approve" ? <RefundSentConfirm booking={booking} />
        : intent.kind === "refund-sent" ? <RefundTransferConfirm booking={booking} />
        : <ReleaseConfirm key={`${intent.kind}-${intent.ki}-${intent.kind === "cancel-day" ? intent.dt : ""}`} booking={booking} ki={intent.ki} dt={intent.kind === "cancel-day" ? intent.dt : undefined} />}
    </div>
  );
}

function PaidConfirm({ booking: b }: { booking: Booking }) {
  const t = useT();
  const act = useBookingsStore((s) => s.act);
  const clear = useBookingsStore((s) => s.clearConfirm);
  const amt = money(round2(Math.max(0, (b.amount ?? 0) - cashReceivedOf(b))));
  return (
    <div className={shell} data-ui="money-confirm" data-kind="paid">
      <div className={head}>{t("p7bd.cfPaidHead", { amt, method: payMethodLabel(b) })}</div>
      <div className="mb-3 text-[12px] text-[var(--ink-2)]">{t("p7bd.cfPaidBody", { amt, ref: b.ref })}</div>
      <div className="flex gap-[7px]">
        <Button variant="primary" onClick={() => act(b.ref, "paid")}>{t("p7bd.cfPaidYes")}</Button>
        <Button onClick={clear}>{t("p7bd.cfNotYet")}</Button>
      </div>
    </div>
  );
}

function RefundSentConfirm({ booking: b }: { booking: Booking }) {
  const t = useT();
  const act = useBookingsStore((s) => s.act);
  const clear = useBookingsStore((s) => s.clearConfirm);
  const kind = refundButtonKind(b);
  const rmw = useRefundMethod();
  const amt = money(refundOwedOf(b) || b.cancel?.amount || 0);
  const stripe = kind === "stripe";
  // A booking paid partly with wallet credit: that share of the refund goes back to the family's wallet at once (one rule, refundSplit.ts); the rest goes the way they paid.
  const owedNow = Math.min(refundOwedOf(b) || b.cancel?.amount || 0, refundableSoFar(b));
  const walletBack = kind === "wallet" ? 0 : walletShareFor(b, owedNow);
  const splitNote = walletBack > 0.004 ? <div className="mb-3 text-[12px] font-semibold text-[var(--ink)]" data-ui="refund-split">{t("p7bd.cfSplit", { wallet: money(walletBack), rest: money(round2(owedNow - walletBack)) })}</div> : null;
  // A bank transfer / cash / voucher refund cannot be sent by the app: approving only RECORDS it ("awaiting your transfer"); the provider confirms
  // the transfer afterwards with "I've sent the refund" (or says up front that they already sent it).
  const mi = refundMethodInfo(b);
  if (kind !== "stripe" && kind !== "wallet") {
    return (
      <div className={shell} data-ui="money-confirm" data-kind="refund-record">
        <div className={head}>{t("p8lst.rfaApproveHead", { amt })}</div>
        <div className="mb-3 text-[12px] text-[var(--ink-2)]">{mi.kinds.length && !mi.hasCard ? t("rfm.apprBody", { amt: money(round2(Math.max(0, owedNow - walletBack))), name: b.booker, how: rmw.how(mi.kinds), methods: rmw.names(mi.kinds) }) : t("p8lst.rfaApproveBody", { amt, name: b.booker })}</div>
        {splitNote}
        <div className="flex flex-wrap gap-[7px]">
          <Button variant="primary" onClick={() => act(b.ref, "refund-approve")}>{t("p8lst.rfaApproveYes")}</Button>
          <Button onClick={() => act(b.ref, "refund-approve", undefined, { alreadySent: true })}>{t("p8lst.rfaApproveSentYes")}</Button>
          <Button onClick={clear}>{t("p7bd.cfNotYet")}</Button>
        </div>
      </div>
    );
  }
  const body = kind === "wallet" ? t("p7bd.cfRefWallet", { amt }) : stripe ? t("p7bd.cfRefStripe", { amt }) : t("p7bd.cfRefManual", { amt, name: b.booker });
  return (
    <div className={shell} data-ui="money-confirm" data-kind="refund-sent">
      <div className={head}>{t("p7bd.cfRefHead", { amt })}</div>
      <div className="mb-3 text-[12px] text-[var(--ink-2)]">{body}</div>
      {splitNote}
      <div className="flex gap-[7px]">
        <Button variant="primary" onClick={() => act(b.ref, "refund-approve")}>{stripe ? t("p7bd.cfRefYesStripe") : t("p7bd.cfRefYes")}</Button>
        <Button onClick={clear}>{t("p7bd.cfNotYet")}</Button>
      </div>
    </div>
  );
}

/** Approve was refused because this refund's money was also refunded in the Stripe dashboard: nothing changed; refunding more is the provider's deliberate choice. */
function StripeAlreadyRefundedConfirm({ booking: b }: { booking: Booking }) {
  const t = useT();
  const act = useBookingsStore((s) => s.act);
  const warn = useBookingsStore((s) => s.stripeWarn);
  const clear = useBookingsStore((s) => s.clearConfirm);
  if (!warn) return null;
  return (
    <div className={shell} data-ui="money-confirm" data-kind="refund-already-in-stripe">
      <div className={head}>{t("p8lst.rfaStripeHead", { stripe: money(warn.stripeRefunded), pending: money(warn.pending) })}</div>
      <div className="flex flex-wrap gap-[7px]">
        <Button variant="primary" onClick={() => act(b.ref, "refund-approve", undefined, { alreadySent: warn.alreadySent, confirmAlreadyRefunded: true })}>{t("p8lst.rfaStripeYes")}</Button>
        <Button onClick={clear}>{t("p8lst.rfaStripeNo")}</Button>
      </div>
    </div>
  );
}

/** The provider confirms they have SENT a recorded offline refund. */
function RefundTransferConfirm({ booking: b }: { booking: Booking }) {
  const t = useT();
  const act = useBookingsStore((s) => s.act);
  const clear = useBookingsStore((s) => s.clearConfirm);
  const rmw = useRefundMethod();
  const amt = money(refundTransferAmount(b));
  const kinds = unsentKinds(b);
  return (
    <div className={shell} data-ui="money-confirm" data-kind="refund-transfer-sent">
      <div className={head}>{kinds.length ? t("rfm.confHead", { amt, how: rmw.how(kinds) }) : t("p8lst.rfaConfirmHead", { amt })}</div>
      <div className="mb-3 text-[12px] text-[var(--ink-2)]">{kinds.length ? t("rfm.confBody", { amt, name: b.booker, methods: rmw.names(kinds) }) : t("p8lst.rfaConfirmBody", { amt, name: b.booker })}</div>
      <div className="flex gap-[7px]">
        <Button variant="primary" onClick={() => act(b.ref, "refund-sent")}>{t("p8lst.rfaConfirmYes")}</Button>
        <Button onClick={clear}>{t("p7bd.cfNotYet")}</Button>
      </div>
    </div>
  );
}

/** Cancel one day (dt) or a child's whole remaining place (dt undefined): what the money does is the provider's call. */
function ReleaseConfirm({ booking: b, ki, dt }: { booking: Booking; ki: number; dt?: string }) {
  const t = useT();
  const { locale } = useI18n();
  const { settings } = useTenantSettings();
  const cancelDay = useBookingsStore((s) => s.cancelDay);
  const cancelChild = useBookingsStore((s) => s.cancelChild);
  const clear = useBookingsStore((s) => s.clearConfirm);

  const kid = bookingKids(b)[ki];
  const name = kid?.name || t("p7bd.thisChild");
  const days = dt ? [dt] : kid ? kidActiveDays(kid) : [];
  // The share of what has actually been PAID, and the most that can still go back.
  const share = releaseValue(b, ki, dt ? [dt] : undefined);
  const room = round2(Math.max(0, refundableSoFar(b) - (b.cancel?.refundOnly && b.cancel.refund === "pending" ? b.cancel.amount ?? 0 : 0)));
  const worth = round2(Math.min(share, room));

  // Who decided changes the answer completely (see CancelPanel): a provider cancelling refunds in full.
  const [initiator, setInitiator] = useState<"provider" | "parent">("parent");
  const policy = policyById(settings.cancellationPolicies, undefined);
  const now = new Date().toISOString();
  const slot = days.length ? share / days.length : 0;
  const advices = policy ? days.map((d) => refundFor(policy, effectiveRefundDate(b.dayOrigin?.[dayIso(d) ?? ""], dayIso(d)), slot, now, initiator)) : [];
  const usable = advices.length > 0 && advices.every((a) => a != null);
  const suggested = usable ? round2(Math.min(worth, advices.reduce((n, a) => n + (a?.amount ?? 0), 0))) : worth;
  const advice = dt && usable ? advices[0] : null;

  const [picked, setPicked] = useState<ReleaseResolution | null>(null);
  const [typed, setTyped] = useState<number | null>(null);
  const resolution: ReleaseResolution = worth <= 0 ? "none" : picked ?? (suggested > 0 ? "refund" : "none");
  // Wallet credit is full value by design (the trade for keeping the money in the business); a refund follows the policy.
  const start = resolution === "wallet" ? worth : suggested;
  const amount = resolution === "none" ? 0 : Math.min(typed ?? start, worth);

  const dayText = dt ? (/^\d{4}-\d{2}-\d{2}$/.test(dt) ? sessionDayLabel(dt) : localizeDateLabels(dt)) : "";
  const opts = { resolution, amount: round2(amount) };
  const go = () => (dt ? cancelDay(b.ref, ki, dt, opts) : cancelChild(b.ref, ki, opts));

  return (
    <div className={shell} data-ui="money-confirm" data-kind={dt ? "cancel-day" : "cancel-child"}>
      <div className={head}>{dt ? t("p7bd.cfDayHead", { day: dayText, name }) : t("p7bd.cfChildHead", { n: days.length, name })}</div>
      <div className="mb-3 text-[12px] text-[var(--ink-2)]">
        {worth > 0 ? t("p7bd.cfShare", { name, amt: money(worth) }) : t("p7bd.cfShareNone")}
      </div>

      {worth > 0 && (
        <>
          <div className="mb-3">
            <div className="mb-[7px] text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t("p7bd.whoseDecision")}</div>
            <div className="flex flex-wrap gap-[7px]">
              {([["parent", t("p7bd.familyAsked")], ["provider", t("p7bd.weCancelled")]] as const).map(([v, label]) => (
                <span key={v} onClick={() => { setInitiator(v); setTyped(null); setPicked(null); }} className={chip(initiator === v)}>{label}</span>
              ))}
            </div>
          </div>
          {advice && (
            <div className="mb-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
              <div className="text-[12.5px] font-extrabold">
                {t("p7bd.policySays", { what: advice.percent === 100 ? t("p7bd.adviceFull") : advice.percent === 0 ? t("p7bd.adviceNone") : t("p7bd.advicePct", { pct: advice.percent, amt: money(advice.amount) }) })}
              </div>
              <div className="mt-0.5 text-[11px] leading-[1.45] text-[var(--ink-3)]">{adviceReasonT(t, locale, advice)} {t("p7bd.adviceSuffix")}</div>
            </div>
          )}
          <div className="mb-[7px] text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t("p7bd.cfChoose")}</div>
          <div className="flex flex-col gap-[7px]">
            {([
              ["refund", t("p7bd.cfOptRefund", { amt: money(amount || start || worth) }), t("p7bd.cfOptRefundSub")],
              ...(settings.partialAllowWallet !== false ? [["wallet", t("p7bd.cfOptWallet", { amt: money(amount || start || worth) }), t("p7bd.cfOptWalletSub")] as const] : []),
              ["none", t("p7bd.cfOptNone"), t("p7bd.cfOptNoneSub")],
            ] as const).map(([v, label, sub]) => (
              <span key={v} onClick={() => { setPicked(v as ReleaseResolution); setTyped(null); }} data-choice={v} className={chip(resolution === v) + " block"}>
                <span className="block">{label}</span>
                <span className={"block text-[11px] font-normal " + (resolution === v ? "text-white/85" : "text-[var(--ink-3)]")}>{sub}</span>
              </span>
            ))}
          </div>
          {resolution !== "none" && (
            <div className="mt-2.5">
              <label className="mb-[3px] block text-[11px] font-bold text-[var(--ink-3)]">{t("p7bd.cfAmount")}</label>
              <input
                aria-label={t("p7bd.cfAmount")}
                value={typed ?? start}
                onChange={(e) => setTyped(Math.min(Math.max(0, parseFloat(e.target.value) || 0), worth))}
                className="max-w-[160px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none"
              />
              <div className="mt-1 text-[11px] text-[var(--ink-3)]">{t("p7bd.cfCap", { amt: money(worth) })}</div>
            </div>
          )}
        </>
      )}

      <div className="mt-3 text-[12px] font-semibold text-[var(--ink)]">
        {resolution === "refund" && amount > 0 ? t("p7bd.cfWillRefund", { amt: money(amount) }) : resolution === "wallet" && amount > 0 ? t("p7bd.cfWillWallet", { amt: money(amount) }) : t("p7bd.cfWillNone")}
      </div>
      <div className="mt-3 flex gap-[7px]">
        <Button variant="danger" onClick={go}>{t("p7bd.cfYesCancel")}</Button>
        <Button onClick={clear}>{t("p7bd.cfNoKeep")}</Button>
      </div>
    </div>
  );
}
