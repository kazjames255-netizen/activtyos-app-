"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { useReadOnlyPortal } from "@/lib/portal-href";
import { Button } from "@/components/ui";
import { useBookingsStore } from "./store";
import { money, refundableSoFar } from "./helpers";
import { pendingAddonRequests, requestTargets } from "./addonRequests";
import { newRequestWording, renderFull } from "./addonWording";
import { formatDay } from "@/lib/i18n/format";
import type { AddonRequest, Booking } from "./types";

// The provider's side of a family's REQUEST to change or cancel one extra (size, colour, a meal...). Never automatic and separate from cancelling
// the booking: the provider approves or declines each one, and chooses what happens to the money. Nothing moves until they choose.

/** What the request asks, as one plain sentence in the viewer's language ("Child B asked to change tshirty size from xl to m (booking APF-1)."). */
function useAsk(booking: Booking, r: AddonRequest): string {
  const t = useT();
  return renderFull(t, newRequestWording(r, { ref: booking.ref }).body, (d) => formatDay(d, { weekday: "short", day: "numeric", month: "short" }));
}
function ReadOnlyAsk({ booking, r }: { booking: Booking; r: AddonRequest }) {
  return <>{useAsk(booking, r)}</>;
}

function RequestCard({ booking, r }: { booking: Booking; r: AddonRequest }) {
  const t = useT();
  const resolveAddon = useBookingsStore((s) => s.resolveAddon);
  const paid = refundableSoFar(booking) > 0.004;
  const diff = Math.round((r.priceDiff ?? 0) * 100) / 100;
  const cancel = r.kind === "cancel";
  // The money choice: a cancelled extra is refunded / credited / kept; a changed one only has a question if its price differs.
  const needsMoney = cancel ? paid : Math.abs(diff) > 0.004;
  const [resolution, setResolution] = useState<string>(cancel ? "refund" : diff > 0 ? "charge" : diff < 0 ? "refund" : "none");
  const amt = cancel ? r.price : Math.abs(diff);
  const targets = cancel ? requestTargets(r) : [];
  const bulk = targets.length > 1;
  const dayText = (d: string) => formatDay(d, { weekday: "short", day: "numeric", month: "short" });
  const ask = useAsk(booking, r);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const opts: [string, string][] = cancel
    ? [["refund", t("p8lst.arvRefund", { amt: money(amt) })], ["wallet", t("p8lst.arvWallet", { amt: money(amt) })], ["none", t("p8lst.arvNone")]]
    : diff > 0
      ? [["charge", t("p8lst.arvCharge", { amt: money(amt) })], ["waive", t("p8lst.arvWaive")]]
      : [["refund", t("p8lst.arvRefund", { amt: money(amt) })], ["wallet", t("p8lst.arvWallet", { amt: money(amt) })], ["waive", t("p8lst.arvWaive")]];
  return (
    <div className="rounded-xl border border-[var(--violet)] bg-[var(--violet-soft)] px-3.5 py-3" data-testid="addon-request">
      <div className="text-[13.5px] font-extrabold text-[var(--violet)]" data-testid="addon-request-sentence">{ask}</div>
      {cancel && (bulk || targets[0].days?.length) ? (
        <ul className="mt-1.5 space-y-1 text-[12.5px] text-[var(--ink-2)]" data-testid="addon-request-targets">
          {targets.map((x) => (
            <li key={x.key}>
              <b>{x.label}</b> <span className="text-[var(--ink-3)]">· {x.child.trim()}{paid ? ` · ${money(x.price)}` : ""}</span>
              {x.days?.length ? <div className="text-[12px] text-[var(--ink-3)]">{t("p8lst.arDaysList", { days: x.days.map(dayText).join(", ") })}</div> : null}
            </li>
          ))}
          {bulk && paid && <li className="font-extrabold text-[var(--ink)]">{t("p8lst.arvTotal", { amt: money(r.price) })}</li>}
        </ul>
      ) : null}
      {r.note && <div className="mt-1 text-[12.5px] text-[var(--ink-2)]">{t("p8lst.arvNote", { note: r.note })}</div>}
      {needsMoney ? (
        <div className="mt-2.5" role="radiogroup" aria-label={t("p8lst.arvMoney")}>
          <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8lst.arvMoney")}</div>
          {opts.map(([k, label]) => (
            <label key={k} className="flex cursor-pointer items-center gap-2 py-[3px] text-[13px]">
              <input type="radio" name={`addon-money-${r.id}`} checked={resolution === k} onChange={() => setResolution(k)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      ) : cancel ? (
        <div className="mt-2 text-[12px] text-[var(--ink-3)]">{t("p8lst.arvUnpaid")}</div>
      ) : null}
      <div className="mt-2 text-[11.5px] text-[var(--ink-3)]">{t("p8lst.arvSeparate")}</div>
      {!declining ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => resolveAddon(booking.ref, r.id, { approve: true, ...(needsMoney ? { resolution } : {}), ...(needsMoney && cancel && resolution !== "none" ? { amount: r.price } : {}) })}>{t("p7bd.approveBtn")}</Button>
          <Button onClick={() => setDeclining(true)}>{t("p7bd.declineWord")}</Button>
        </div>
      ) : (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("p8lst.arvDeclineReason")} maxLength={300}
            className="min-w-[220px] flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] text-[var(--ink)]" />
          <Button onClick={() => resolveAddon(booking.ref, r.id, { approve: false, reason })}>{t("p7bd.declineWord")}</Button>
          <Button onClick={() => { setDeclining(false); setReason(""); }}>{t("p8lst.arBack")}</Button>
        </div>
      )}
    </div>
  );
}

export function AddonRequestsPanel({ booking }: { booking: Booking }) {
  const t = useT();
  const { readOnly } = useReadOnlyPortal();
  const pending = pendingAddonRequests(booking);
  if (!pending.length) return null;
  // Read-only accounts (staff, HQ) see WHAT was asked, but get no Approve / Decline (the server would refuse with 403) and, for staff, no money.
  if (readOnly) {
    return (
      <div className="mb-3 space-y-2" data-testid="addon-requests">
        <div className="text-[12px] font-extrabold uppercase tracking-wide text-[#6b3fb3]">🎁 {t("p8lst.arvTitle")} · {pending.length}</div>
        {pending.map((r) => (
          <div key={r.id} className="rounded-xl border border-[#d9c7f2] bg-[#faf6ff] px-3.5 py-3" data-testid="addon-request">
            <div className="text-[13.5px] font-extrabold text-[#4c2a85]"><ReadOnlyAsk booking={booking} r={r} /></div>
            {r.note && <div className="mt-1 text-[12.5px] text-[var(--ink-2)]">{t("p8lst.arvNote", { note: r.note })}</div>}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="mb-3 space-y-2" data-testid="addon-requests">
      <div className="text-[12px] font-extrabold uppercase tracking-wide text-[var(--violet)]">🎁 {t("p8lst.arvTitle")} · {pending.length}</div>
      {pending.map((r) => <RequestCard key={r.id} booking={booking} r={r} />)}
    </div>
  );
}
