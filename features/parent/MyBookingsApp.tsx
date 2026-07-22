"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { get as apiGet, post as apiPost, apiPublic } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money, payLabelFor, payTone, statusTone } from "@/features/bookings/helpers";
import { PayModal } from "@/features/payments/PayModal";
import type { Booking } from "@/features/bookings/types";
import { filledDetails, type VoucherProvider } from "@/lib/settings";
import { refundFor, policyById, policyWording, type NamedPolicy } from "@/lib/cancellation";
import { Badge, Button, Card, DefRow, SectionHead } from "@/components/ui";

function CancelRequest({ booking, listing, onDone }: { booking: Booking; listing: AmendListing | null; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [refundPref, setRefundPref] = useState<"card" | "wallet">("card");
  const [cfg, setCfg] = useState<{
    policies: NamedPolicy[];
    reasons: { id: string; label: string }[];
    askReason: boolean;
    letChoose: boolean;
    noRefundCredit: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!booking.tenantId) return;
    apiPublic<{ settings: { cancellationPolicies?: NamedPolicy[]; cancelReasons?: { id: string; label: string }[]; askReasonParent?: boolean; allowCardRefund?: boolean; refundLetCustomerChoose?: boolean; noRefundCredit?: boolean } }>(`/api/public/library/${encodeURIComponent(booking.tenantId)}`)
      .then((r) => {
        const s = r.settings ?? {};
        const allowCard = s.allowCardRefund ?? true;
        setCfg({
          policies: s.cancellationPolicies ?? [],
          reasons: s.cancelReasons ?? [],
          askReason: !!s.askReasonParent,
          letChoose: allowCard && !!s.refundLetCustomerChoose,
          noRefundCredit: !!s.noRefundCredit,
        });
      })
      .catch(() => {});
  }, [booking.tenantId]);

  // What the provider's policy actually gives this booking, worked out from the
  // notice to the first session — so the parent sees their entitlement, not a
  // vague "if a refund is due".
  const policy = cfg ? policyById(cfg.policies, listing?.cancellationPolicyId) ?? cfg.policies[0] ?? null : null;
  const firstDay = [...(booking.days ?? [])].sort()[0];
  const advice = policy ? refundFor(policy, firstDay, booking.amount, new Date().toISOString(), "parent") : null;
  const refundDue = !!advice && advice.amount > 0;
  // A voucher was paid outside the app — a refund can't go "back to card"; it
  // goes back through the scheme (slow) or into the wallet (instant).
  const scheme = booking.voucherScheme;
  const isVoucher = !!scheme || (booking.method ?? "").toLowerCase().includes("voucher");
  // Nudge voucher refunds toward the wallet — reimbursing a voucher is slow.
  useEffect(() => {
    if (isVoucher) setRefundPref("wallet");
  }, [isVoucher]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await apiPost<Booking>(`/api/my/bookings/${encodeURIComponent(booking.ref)}/cancel`, {
        reason: reason || undefined,
        msg: [reason, msg.trim()].filter(Boolean).join(" — ") || undefined,
        refundPref,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] p-3">
      <div className="mb-1.5 text-[12.5px] font-bold text-[var(--red,#e21d27)]">Request cancellation</div>

      {/* Entitlement, stated plainly from the policy. */}
      {advice && (
        <div className="mb-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12px]">
          {advice.percent >= 100 ? (
            <div className="font-extrabold text-[#0f7a44]">✓ You&rsquo;re entitled to a full refund of {money(advice.amount)}.</div>
          ) : advice.amount > 0 ? (
            <div className="font-extrabold text-[#0f7a44]">✓ You&rsquo;re entitled to a {advice.percent}% refund — {money(advice.amount)}.</div>
          ) : (
            <div className="font-extrabold text-[#c0392b]">✗ No refund is due — this is inside the provider&rsquo;s no-refund window.</div>
          )}
          <div className="mt-0.5 text-[11px] leading-[1.5] text-[var(--ink-3)]">{advice.reason}</div>
          {policy && (
            <div className="mt-1.5 border-t border-[var(--line)] pt-1.5 text-[11px] leading-[1.5] text-[var(--ink-3)]">
              <span className="font-semibold text-[var(--ink-2)]">{policy.name} policy:</span> {policyWording(policy)}
            </div>
          )}
          {advice.amount === 0 && cfg?.noRefundCredit && (
            <div className="mt-1 text-[11px] font-semibold text-[#0f7a44]">👛 This provider still gives you a full-value credit note to spend on a future booking.</div>
          )}
        </div>
      )}

      {cfg?.askReason && cfg.reasons.length > 0 && (
        <select value={reason} onChange={(e) => setReason(e.target.value)}
          className="mb-2 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)]">
          <option value="">Reason for cancelling…</option>
          {cfg.reasons.map((r) => <option key={r.id} value={r.label}>{r.label}</option>)}
        </select>
      )}

      <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Anything to add? (optional)…" rows={2}
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none" />

      {/* Card vs wallet only matters when there's a cash refund and the provider
          lets the customer choose where it goes. */}
      {refundDue && cfg?.letChoose && (
        <div className="mt-2">
          <div className="mb-1 text-[11px] font-bold text-[var(--ink-2)]">Send my {money(advice!.amount)} refund to</div>
          <div className="grid grid-cols-2 gap-2">
            {([
              ["wallet", "👛 Wallet credit"],
              ["card", isVoucher ? `↩︎ Back via ${scheme ?? "voucher"}` : "💳 Back to card"],
            ] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setRefundPref(v)} className="rounded-lg border bg-[var(--surface)] p-2 text-[12px] font-extrabold"
                style={refundPref === v ? { borderColor: "var(--brand-2)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink)" }}>
                {l}
              </button>
            ))}
          </div>
          {isVoucher && (
            <p className="mt-1.5 text-[11px] leading-[1.5] text-[var(--ink-3)]">
              💡 <b>Wallet credit is instant</b> and ready to spend on your next booking. A refund back through {scheme ?? "your voucher scheme"} has to be handled by your provider and can take a while.
            </p>
          )}
        </div>
      )}

      {error && <div className="mt-1 text-[12px] text-[var(--red)]">{error}</div>}
      <div className="mt-2 flex gap-2">
        <Button variant="danger" sm onClick={submit} disabled={busy}>
          {busy ? "Sending…" : "Send cancellation request"}
        </Button>
      </div>
      <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">
        Cancelling is a request your provider reviews. {advice ? "The refund above is what their policy gives — they confirm and issue it." : "They confirm the refund under their cancellation policy."}
      </div>
    </div>
  );
}

type AmendPolicy = {
  amendSelfService: boolean;
  amendNoticeHours: number;
  amendFee: number;
  amendAllowCheaper: boolean;
  allowCardRefund: boolean;
  refundLetCustomerChoose: boolean;
};

const AMEND_FALLBACK: AmendPolicy = { amendSelfService: true, amendNoticeHours: 48, amendFee: 0, amendAllowCheaper: true, allowCardRefund: true, refundLetCustomerChoose: true };
const noticeLabel = (h: number) => (h % 24 === 0 && h >= 24 ? `${h / 24} day${h / 24 === 1 ? "" : "s"}` : `${h} hours`);
const fmtIso = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
};

// Parent-facing "move my dates" flow. Presents the provider's rules (fetched
// from the public settings) and either changes the dates or sends a request,
// depending on the provider's self-service setting. Enforcement is server-side
// (handoff §U) — this collects the intent and posts it.
// The slice of the listing the amend flow needs: which dates run with space,
// and each pass's booking rule ("week" = all days in one Mon–Sun week,
// "listing" = any week it runs, "blocks" = fixed block, moved as a whole).
type AmendListing = {
  blocks?: { id: string; sessions?: { date: string; spotsLeft: number }[] }[];
  bookRules?: Record<string, string>;
  location?: string | null;
  address?: string | null;
  city?: string | null;
  /** Which cancellation policy this listing uses — to state the refund due. */
  cancellationPolicyId?: string;
};
// Monday of an ISO date's week — the key a "one week" pass rule groups by.
const weekKey = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

function AmendModal({ booking, listing, onDone }: { booking: Booking; listing: AmendListing | null; onDone: (changed: boolean) => void }) {
  const [policy, setPolicy] = useState<AmendPolicy>(AMEND_FALLBACK);
  const [moves, setMoves] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [refundTo, setRefundTo] = useState<"card" | "wallet">("card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const days = booking.days ?? [];

  useEffect(() => {
    if (!booking.tenantId) return;
    apiPublic<{ settings: Partial<AmendPolicy> }>(`/api/public/library/${encodeURIComponent(booking.tenantId)}`)
      .then((r) => setPolicy({ ...AMEND_FALLBACK, ...r.settings }))
      .catch(() => {});
  }, [booking.tenantId]);

  const setMove = (oldIso: string, newIso: string) =>
    setMoves((m) => { const n = { ...m }; if (newIso) n[oldIso] = newIso; else delete n[oldIso]; return n; });

  const selfService = policy.amendSelfService;
  const hasChanges = Object.keys(moves).length > 0 || !!msg.trim();
  // Where any money back goes, mirroring the provider's Money-back settings.
  const letChoose = policy.amendAllowCheaper && policy.allowCardRefund && policy.refundLetCustomerChoose;
  const cheaper = policy.amendAllowCheaper
    ? !policy.allowCardRefund
      ? "credited to your wallet"
      : policy.refundLetCustomerChoose
        ? "yours to take as a card refund or wallet credit"
        : "refunded to your card"
    : null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/my/bookings/${encodeURIComponent(booking.ref)}/amend`, {
        moves,
        message: msg.trim() || undefined,
        ...(letChoose ? { refundTo } : {}),
      });
      onDone(true);
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      // The amend endpoint isn't live yet (§U) — 404s. Say so plainly rather
      // than surfacing a raw "404 Not Found".
      setError(
        /404|not found/i.test(m)
          ? "Date changes aren’t switched on for this provider yet — nothing was changed."
          : m || "Couldn’t submit — try again",
      );
      setBusy(false);
    }
  }

  // Only listed dates with a space, in the future — the pool a move can go to.
  const todayIso = new Date().toISOString().slice(0, 10);
  const available = (() => {
    const set = new Set<string>();
    for (const bk of listing?.blocks ?? [])
      for (const s of bk.sessions ?? []) if (s.spotsLeft > 0 && s.date > todayIso) set.add(s.date);
    return [...set].sort();
  })();
  const rule = (listing?.bookRules ?? {})[booking.pass] ?? "listing";
  const fixed = rule === "blocks";
  // A move within the same pass keeps the same day-count and price, so nothing
  // comes back. Only a cheaper pass/day change (not offered in this modal yet)
  // would set this true; until then the refund-destination question stays off.
  const moneyBack = false;
  const keptWeeks = new Set(days.filter((iso) => !moves[iso]).map(weekKey));
  const resultDates = days.map((iso) => moves[iso] ?? iso);
  const weekOk = rule !== "week" || new Set(resultDates.map(weekKey)).size <= 1;
  const optionsFor = (iso: string) => {
    const others = new Set(days.filter((d2) => d2 !== iso).map((d2) => moves[d2] ?? d2));
    return available.filter((dt) => {
      if (others.has(dt)) return false; // don't let two days land on the same date
      if (rule === "week" && keptWeeks.size === 1 && weekKey(dt) !== [...keptWeeks][0]) return false;
      return true;
    });
  };

  return (
    <div onClick={(e) => e.target === e.currentTarget && onDone(false)} className="fixed inset-0 z-[9999] flex items-start justify-center overflow-auto bg-black/55 px-3.5 py-8">
      <div className="w-full max-w-[460px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-[0_24px_60px_rgba(0,0,0,.5)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <h3 className="m-0 text-[16px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            {selfService ? "Change your dates" : "Request a date change"}
          </h3>
          <button type="button" onClick={() => onDone(false)} className="cursor-pointer text-[20px] leading-none text-[var(--ink-3)]" aria-label="Close">×</button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <div className="text-[12px] text-[var(--ink-3)]">{booking.listing} · {booking.child} · {booking.pass}</div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-[11.5px] leading-[1.6] text-[var(--ink-2)]">
            <div>• A date can be moved up to <b>{noticeLabel(policy.amendNoticeHours)}</b> before it — closer than that it&rsquo;s locked.</div>
            <div>• A move only goes to another running date with space.</div>
            {policy.amendFee > 0 && <div>• A <b>£{policy.amendFee}</b> admin fee applies to each change.</div>}
            {cheaper ? <div>• Moving to something cheaper: the difference is <b>{cheaper}</b>.</div> : <div>• Moves must be to the same price or higher.</div>}
            {!selfService && <div className="mt-1 text-[var(--ink-3)]">Your provider reviews change requests before they&rsquo;re applied.</div>}
          </div>

          {days.length > 0 ? (
            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">Your dates</div>
              {fixed ? (
                <div className="rounded-lg border border-[#f0d9a8] bg-[#fdf6e6] px-3 py-2.5 text-[11.5px] leading-[1.5] text-[#7a5b06]">
                  This pass is a <b>fixed block</b> — its dates move together, not one at a time. To change them, cancel and rebook, or message your provider.
                </div>
              ) : listing && available.length === 0 ? (
                <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-[11.5px] text-[var(--ink-3)]">No other dates with a space to move to right now.</div>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    {days.map((iso) => {
                      const opts = optionsFor(iso);
                      return (
                        <div key={iso} className="flex items-center gap-2 text-[12.5px]">
                          <span className="w-[120px] font-semibold">{fmtIso(iso)}</span>
                          <span className="text-[var(--ink-3)]">→</span>
                          <select value={moves[iso] ?? ""} onChange={(e) => setMove(iso, e.target.value)}
                            className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12.5px]" aria-label={`Move ${fmtIso(iso)} to`}>
                            <option value="">Keep this date</option>
                            {opts.map((dt) => <option key={dt} value={dt}>{fmtIso(dt)}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--ink-3)]">
                    Only dates this listing runs with a space are shown.{" "}
                    {rule === "week" ? "All of this child’s days must stay within one week." : "Pick from any week it runs."}
                  </div>
                  {!weekOk && <div className="mt-1 text-[11px] font-bold text-[#c0392b]">Those dates span more than one week — this pass keeps every day inside a single week.</div>}
                </>
              )}
            </div>
          ) : (
            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">What change would you like?</div>
              <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} placeholder="e.g. move the Wednesday session to the following Monday"
                className="w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] text-[var(--ink)] outline-none" />
            </div>
          )}

          {/* Only ask where money goes when a move actually returns some. A
              same-pass date move keeps the price, so this only appears when the
              new dates come out cheaper (the difference is refundable). */}
          {letChoose && moneyBack && (
            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">If money comes back, send it to</div>
              <div className="grid grid-cols-2 gap-2">
                {([["card", "💳 My card"], ["wallet", "👛 Wallet credit"]] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setRefundTo(v)} className="rounded-xl border p-2.5 text-[12.5px] font-extrabold"
                    style={refundTo === v ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink)" }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <div className="text-[12.5px] text-[var(--red)]">{error}</div>}
          <Button variant="primary" disabled={busy || !hasChanges || !weekOk} onClick={submit} className="w-full justify-center">
            {busy ? "Sending…" : selfService ? "Confirm change" : "Send request"}
          </Button>
          <div className="rounded-full bg-[#fff3e0] px-3 py-1 text-center text-[10.5px] font-extrabold text-[#8a5300]">Applied once the backend is built (§U)</div>
        </div>
      </div>
    </div>
  );
}

function BookingCard({ b, refresh, autoPay }: { b: Booking; refresh: () => void; autoPay?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [amending, setAmending] = useState(false);
  // The payment-link email lands on ?pay=REF — open that card's payment.
  const [paying, setPaying] = useState(!!autoPay);
  const [offerBusy, setOfferBusy] = useState(false);
  // The listing this booking is on — matched by its block — for the venue in
  // the detail and the live schedule + pass rules the amend modal needs.
  const [info, setInfo] = useState<AmendListing | null>(null);
  useEffect(() => {
    if (!(expanded || amending || cancelling) || info || !b.tenantId) return;
    apiPublic<AmendListing[]>(`/api/listings?tenantId=${encodeURIComponent(b.tenantId)}`)
      .then((ls) => setInfo((ls ?? []).find((l) => (l.blocks ?? []).some((bk) => bk.id === b.blockId)) ?? null))
      .catch(() => {});
  }, [expanded, amending, cancelling, info, b.tenantId, b.blockId]);

  // For a voucher booking, the scheme's reference details (Edenred account
  // number etc.) the provider entered — what the parent quotes to pay.
  const isVoucher = !!b.voucherScheme || (b.method ?? "").toLowerCase().includes("voucher");
  const [vScheme, setVScheme] = useState<VoucherProvider | null>(null);
  useEffect(() => {
    if (!expanded || vScheme || !b.tenantId || !isVoucher) return;
    apiPublic<{ settings: { voucherProviders?: VoucherProvider[] } }>(`/api/public/library/${encodeURIComponent(b.tenantId)}`)
      .then((r) => {
        const schemes = r.settings?.voucherProviders ?? [];
        setVScheme(schemes.find((v) => v.name === b.voucherScheme) ?? schemes.find((v) => (b.method ?? "").includes(v.name)) ?? null);
      })
      .catch(() => {});
  }, [expanded, vScheme, isVoucher, b.tenantId, b.voucherScheme, b.method]);
  const answerOffer = async (action: "accept-offer" | "decline-offer") => {
    setOfferBusy(true);
    try {
      await apiPost(`/api/my/bookings/${encodeURIComponent(b.ref)}/${action}`, {});
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Something went wrong");
    }
    setOfferBusy(false);
  };
  const cancelled = b.status === "Cancelled" || b.status === "Declined";
  // Same rule as the server: confirmed places and operator invoices. A voucher
  // booking is paid OUTSIDE the app (through the scheme), then the provider
  // marks the money in — so no in-app card "Pay" button for it.
  const payable =
    b.pay !== "Paid" && b.pay !== "Refunded" && b.pay !== "Awaiting voucher payment" &&
    (b.status === "Confirmed" || b.pay === "Invoice sent") && b.amount > 0;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[14.5px] font-extrabold">{b.listing}</div>
          <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">
            {b.child} · {b.pass} · {b.dates} · Ref {b.ref}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge tone={statusTone(b.status)}>{b.status}</Badge>
          {b.cancel?.refund === "pending" && (
            <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "#bb1620" }}>Refund pending</Badge>
          )}
          {!cancelled && <Badge tone={payTone(b.pay)}>{payLabelFor(b)}</Badge>}
          <span className="ml-1 text-[14px] font-extrabold">{money(b.amount)}</span>
        </div>
      </div>

      {cancelled && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-2)]">
          <span aria-hidden className="text-[#c0392b]">✕</span>
          <span><b className="text-[var(--ink)]">Cancelled</b>{b.cancel?.on ? ` · requested ${b.cancel.on}` : ""} — nothing more to pay.</span>
        </div>
      )}

      <div className="mt-2 flex gap-2">
        {payable && (
          <Button sm variant="primary" onClick={() => setPaying(true)}>
            Pay {money(b.amount)}
          </Button>
        )}
        <Button sm onClick={() => setExpanded((x) => !x)}>
          {expanded ? "Hide details" : "Details"}
        </Button>
        {b.status === "Confirmed" && (
          <Button sm onClick={() => setAmending(true)}>
            Change dates…
          </Button>
        )}
        {!cancelled && (
          <Button sm variant="cta" onClick={() => setCancelling((x) => !x)}>
            Cancel booking…
          </Button>
        )}
      </div>

      {amending && <AmendModal booking={b} listing={info} onDone={(changed) => { setAmending(false); if (changed) refresh(); }} />}

      {b.status === "Offered" && (
        <div className="mt-2 rounded-lg border border-[#fde3a7] bg-[#fdf3d8] px-3 py-2.5 text-[12.5px] text-[#7a5200]">
          <b>A place has opened up!</b> It&apos;s held for you
          {b.offerExpiresAt ? ` until ${new Date(b.offerExpiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""} —
          accept to take it, or it passes to the next family.
          <div className="mt-2 flex gap-2">
            <Button sm variant="primary" disabled={offerBusy} onClick={() => answerOffer("accept-offer")}>
              Accept the place
            </Button>
            <Button sm disabled={offerBusy} onClick={() => answerOffer("decline-offer")}>
              Give it up
            </Button>
          </div>
        </div>
      )}

      {paying && <PayModal refs={[b.ref]} onClose={() => setPaying(false)} onPaid={refresh} />}

      {expanded && (
        <div className="mt-2">
          <SectionHead>Booking</SectionHead>
          <DefRow label="Child" value={b.child} />
          <DefRow label="Pass" value={b.pass} />
          {b.timing && <DefRow label="Timing" value={b.timing} />}
          {(info?.location || info?.address) && (
            <>
              <SectionHead>Where</SectionHead>
              {info.location && <div className="py-[4px] text-[12.5px] font-semibold">📍 {info.location}</div>}
              {(info.address || info.city) && (
                <div className="pb-[4px] text-[12px] text-[var(--ink-3)]">{[info.address, info.city].filter(Boolean).join(" · ")}</div>
              )}
            </>
          )}
          <SectionHead>Sessions</SectionHead>
          {(b.sessions || []).map((s, i) => (
            <div key={i} className="border-b border-dashed border-[var(--line)] py-[4px] text-[12.5px]">
              {s}
            </div>
          ))}
          <SectionHead>Payment</SectionHead>
          <DefRow label="Method" value={b.method} />
          <DefRow label="Total" value={money(b.amount)} />
          {/* Voucher payment received — the provider reconciled the money. */}
          {!cancelled && isVoucher && b.pay === "Paid" && (
            <div className="mt-2 rounded-lg border border-[#bfe6cd] bg-[var(--green-soft,#e7f8ee)] px-3 py-2.5 text-[12.5px] font-semibold text-[#0f7a44]">
              ✓ Voucher payment received{vScheme ? ` via ${vScheme.name}` : ""} — your booking is paid in full.
            </div>
          )}
          {/* Still awaiting the voucher money — how to pay it. */}
          {!cancelled && b.pay === "Awaiting voucher payment" && vScheme && filledDetails(vScheme).length > 0 && (
            <div className="mt-2 rounded-lg border border-[var(--brand-line,#cdddf7)] bg-[var(--brand-soft,#eaf0fc)] p-3">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--brand-ink,#1d3a8f)]">Pay by {vScheme.name}</div>
              <div className="mt-0.5 text-[11.5px] leading-[1.5] text-[var(--ink-2)]">
                Send <b>{money(b.amount)}</b> through {vScheme.name} using the details below — there&rsquo;s no card payment here. Your place is confirmed; it shows as <b>paid</b> once your provider receives the money.
              </div>
              <div className="mt-1.5 flex flex-col gap-1">
                {filledDetails(vScheme).map((d) => (
                  <div key={d.id} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                    <span className="text-[var(--ink-3)]">{d.label}</span>
                    <span className="font-extrabold tabular-nums">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {b.cancel && (
            <>
              <SectionHead>Cancellation</SectionHead>
              <DefRow label="Requested" value={b.cancel.on} />
              <DefRow label="Refund" value={b.cancel.refund ?? "—"} />
              {b.cancel.msg && <DefRow label="Message" value={b.cancel.msg} />}
            </>
          )}
        </div>
      )}

      {cancelling && !cancelled && (
        <CancelRequest
          booking={b}
          listing={info}
          onDone={() => {
            setCancelling(false);
            refresh();
          }}
        />
      )}
    </Card>
  );
}

/** custdash/bookings — the signed-in parent's own bookings. */
// A waitlisted place, shown up front so a parent can see exactly which dates
// and times they're queued for — not buried in the general list.
function WaitlistCard({ b, refresh }: { b: Booking; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const leave = async () => {
    if (!confirm(`Leave the waiting list for ${b.listing}?`)) return;
    setBusy(true);
    try {
      await apiPost(`/api/my/bookings/${encodeURIComponent(b.ref)}/cancel`, {});
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn’t leave the waiting list");
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border border-[#fed7aa] bg-[#fff7ed] p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[14px] font-extrabold text-[#9a3412]">{b.listing}</div>
          <div className="text-[12px] text-[#b45309]">{b.child} · {b.pass}</div>
        </div>
        <Badge tone={{ bg: "#fed7aa", fg: "#9a3412" }}>On the waiting list</Badge>
      </div>
      {/* The exact dates + timings — each session string already carries both. */}
      <div className="mt-2 rounded-lg bg-white/70 px-2.5 py-1.5">
        <div className="text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[#b45309]">Waiting for</div>
        {(b.sessions && b.sessions.length ? b.sessions : [b.dates]).map((s, i) => (
          <div key={i} className="text-[12.5px] font-semibold text-[#7c2d12]">{s}</div>
        ))}
      </div>
      <div className="mt-2 text-[11px] leading-[1.5] text-[#b45309]">
        We&rsquo;ll email you the moment a place comes up. Nothing to pay unless you take it.
      </div>
      <Button sm className="mt-2" disabled={busy} onClick={leave}>{busy ? "Leaving…" : "Leave waiting list"}</Button>
    </div>
  );
}

export function MyBookingsApp() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiGet<Booking[]>("/api/my/bookings")
      .then(setBookings)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load bookings"));
  }, []);

  useEffect(refresh, [refresh]);
  useRealtime(["bookings"], refresh);
  // The payment-link email deep-links here as ?pay=REF.
  const payRef = useSearchParams().get("pay");

  if (error) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!bookings)
    return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading your bookings…</div>;

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            My bookings
          </h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">
            Your family’s places — status updates as the provider confirms.
          </p>
        </div>
        <Link href="/custdash/browse">
          <Button variant="primary">+ Book an activity</Button>
        </Link>
      </div>
      {(() => {
        const waiting = bookings.filter((b) => b.status === "Waitlisted");
        const rest = bookings.filter((b) => b.status !== "Waitlisted");
        if (bookings.length === 0)
          return (
            <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
              No bookings yet —{" "}
              <Link href="/custdash/browse" className="font-bold text-[var(--brand-2)]">browse activities</Link> to get started.
            </Card>
          );
        return (
          <>
            {waiting.length > 0 && (
              <div className="mb-5">
                <SectionHead>My waiting list</SectionHead>
                <p className="mb-2 text-[12px] text-[var(--ink-3)]">Dates you&rsquo;re queued for — we&rsquo;ll be in touch the moment a place frees up.</p>
                <div className="flex flex-col gap-2.5">
                  {waiting.map((b) => <WaitlistCard key={`${b.tenantId}-${b.ref}`} b={b} refresh={refresh} />)}
                </div>
              </div>
            )}
            {rest.length > 0 && (
              <>
                {waiting.length > 0 && <SectionHead>My bookings</SectionHead>}
                <div className="flex flex-col gap-3">
                  {rest.map((b) => (
                    <BookingCard key={`${b.tenantId}-${b.ref}`} b={b} refresh={refresh} autoPay={b.ref === payRef} />
                  ))}
                </div>
              </>
            )}
          </>
        );
      })()}
    </div>
  );
}
