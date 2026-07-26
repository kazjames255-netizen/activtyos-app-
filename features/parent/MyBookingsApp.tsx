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
  const [otherReason, setOtherReason] = useState("");
  const [msg, setMsg] = useState("");
  const [refundPref, setRefundPref] = useState<"card" | "wallet">("card");
  const [cfg, setCfg] = useState<{
    policies: NamedPolicy[];
    reasons: { id: string; label: string }[];
    askReason: boolean;
    letChoose: boolean;
    noRefundCredit: boolean;
    allowPartial: boolean;
    perDayMode: "prorata" | "reprice";
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Whole booking vs a chosen set of days, and which days are ticked.
  const [scope, setScope] = useState<"all" | "days">("all");
  const [pickedDays, setPickedDays] = useState<string[]>([]);

  useEffect(() => {
    if (!booking.tenantId) return;
    apiPublic<{ settings: { cancellationPolicies?: NamedPolicy[]; cancelReasons?: { id: string; label: string }[]; askReasonParent?: boolean; allowCardRefund?: boolean; refundLetCustomerChoose?: boolean; noRefundCredit?: boolean; allowPartialCancel?: boolean; perDayRefundMode?: "prorata" | "reprice" } }>(`/api/public/library/${encodeURIComponent(booking.tenantId)}`)
      .then((r) => {
        const s = r.settings ?? {};
        const allowCard = s.allowCardRefund ?? true;
        setCfg({
          policies: s.cancellationPolicies ?? [],
          reasons: s.cancelReasons ?? [],
          askReason: !!s.askReasonParent,
          letChoose: allowCard && !!s.refundLetCustomerChoose,
          noRefundCredit: !!s.noRefundCredit,
          allowPartial: s.allowPartialCancel ?? true,
          perDayMode: s.perDayRefundMode ?? "prorata",
        });
      })
      .catch(() => {});
  }, [booking.tenantId]);

  // What the provider's policy actually gives this booking, worked out from the
  // notice to the first session — so the parent sees their entitlement, not a
  // vague "if a refund is due".
  const policy = cfg ? policyById(cfg.policies, listing?.cancellationPolicyId) ?? cfg.policies[0] ?? null : null;
  const allDays = [...(booking.days ?? [])].sort();
  const firstDay = allDays[0];
  const advice = policy ? refundFor(policy, firstDay, booking.amount, new Date().toISOString(), "parent") : null;

  // Per-day (partial) cancellation. We work in SLOTS = one (child, day) pair, so
  // a booking with several children (each on their own dates) can be cancelled
  // a child-day at a time. Each slot is valued at a pro-rata share of the total
  // paid and judged on ITS OWN start date, so a later day may refund while
  // tomorrow's doesn't. Only offered on a multi-day pass the provider allows.
  const localToday = (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; })();
  const kidsList = booking.kids && booking.kids.length ? booking.kids.filter((k) => !k.cancelled) : null;
  const daysForKid = (k: { dates?: string[] }) => (k.dates && k.dates.length ? k.dates : booking.days ?? []);
  // Total booked child-days (the denominator for a fair per-slot share).
  const totalPaidSlots = kidsList ? kidsList.reduce((n, k) => n + daysForKid(k).length, 0) : allDays.length;
  const perSlotPaid = totalPaidSlots ? (booking.amount ?? 0) / totalPaidSlots : 0;
  // The cancellable (future, not-already-cancelled) slots.
  const slots: { key: string; childName: string; childId?: string; date: string }[] = [];
  const addSlots = (name: string, childId: string | undefined, dates: string[], cancelled: string[]) => {
    for (const d of [...dates].sort()) if (d >= localToday && !cancelled.includes(d)) slots.push({ key: `${childId ?? name}|${d}`, childName: name, childId, date: d });
  };
  if (kidsList) kidsList.forEach((k) => addSlots(k.name, k.childId, daysForKid(k), k.cancelledDays ?? []));
  else addSlots(booking.child, booking.childId, allDays, []);
  const canPartial = !!cfg?.allowPartial && totalPaidSlots > 1 && slots.length > 0;
  const slotRefund = (d: string) => (policy ? refundFor(policy, d, perSlotPaid, new Date().toISOString(), "parent")?.amount ?? 0 : 0);
  const togglePick = (key: string) => setPickedDays((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));
  const pickedSlots = slots.filter((s) => pickedDays.includes(s.key));
  const pickedRefund = pickedSlots.reduce((sum, s) => sum + slotRefund(s.date), 0);
  const multiKid = !!kidsList && kidsList.length > 1;
  const partialMode = scope === "days";
  const effRefund = partialMode ? pickedRefund : advice?.amount ?? 0;
  const refundDue = effRefund > 0;
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
      const effReason = reason === "__other__" ? otherReason.trim() : reason;
      // Partial cancel: the specific days to drop. For a multi-child booking we
      // send them grouped per child; for one child, a flat days[]. Omitted =
      // whole booking.
      let partial: { days?: string[]; kids?: { name: string; childId?: string; days: string[] }[] } = {};
      if (partialMode) {
        if (kidsList) {
          const byChild = new Map<string, { name: string; childId?: string; days: string[] }>();
          for (const s of pickedSlots) {
            const k = s.childId ?? s.childName;
            const g = byChild.get(k) ?? { name: s.childName, childId: s.childId, days: [] };
            g.days.push(s.date);
            byChild.set(k, g);
          }
          partial = { kids: [...byChild.values()] };
        } else {
          partial = { days: pickedSlots.map((s) => s.date) };
        }
      }
      await apiPost<Booking>(`/api/my/bookings/${encodeURIComponent(booking.ref)}/cancel`, {
        reason: effReason || undefined,
        msg: [effReason, msg.trim()].filter(Boolean).join(" — ") || undefined,
        refundPref,
        ...partial,
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

      {/* Whole booking vs individual days (multi-day passes only). */}
      {canPartial && (
        <div className="mb-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2">
          <div className="grid grid-cols-2 gap-1.5">
            {([["all", "Whole booking"], ["days", "Choose days"]] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setScope(v)} className="rounded-lg border p-2 text-[12px] font-extrabold"
                style={scope === v ? { borderColor: "var(--brand-2)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink)" }}>{l}</button>
            ))}
          </div>
          {partialMode && (
            <div className="mt-2">
              <div className="mb-1 text-[11px] font-bold text-[var(--ink-2)]">Tick the day(s) to cancel — each is refunded on its own notice{multiKid ? ", per child" : ""}.</div>
              {(multiKid ? kidsList!.map((k) => k.name) : [null]).map((childName) => {
                const rows = slots.filter((s) => (childName === null ? true : s.childName === childName));
                if (rows.length === 0) return null;
                return (
                  <div key={childName ?? "single"} className="mb-1.5">
                    {multiKid && <div className="mb-0.5 mt-1 text-[11px] font-extrabold text-[var(--brand-ink)]">{childName}</div>}
                    <div className="flex flex-col gap-1">
                      {rows.map((s) => {
                        const on = pickedDays.includes(s.key);
                        const r = slotRefund(s.date);
                        return (
                          <label key={s.key} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-[12.5px]"
                            style={on ? { borderColor: "var(--brand-2)", background: "var(--panel)" } : { borderColor: "var(--line)" }}>
                            <span className="flex items-center gap-2"><input type="checkbox" checked={on} onChange={() => togglePick(s.key)} /><b>{fmtIso(s.date)}</b></span>
                            <span className="text-[11.5px] font-bold" style={{ color: r > 0 ? "#1d3a8f" : "var(--ink-3)" }}>{r > 0 ? `refund ${money(r)}` : "no refund"}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {cfg?.perDayMode === "reprice" && (
                <p className="mt-1.5 text-[11px] text-[var(--ink-3)]">Your provider reprices the days you keep at the single-day rate, so the final refund may differ from this estimate.</p>
              )}
              <div className="mt-1.5 border-t border-[var(--line)] pt-1.5 text-[12px] font-extrabold" style={{ color: pickedRefund > 0 ? "#1d3a8f" : "#c0392b" }}>
                {pickedSlots.length === 0 ? "Pick at least one day above." : pickedRefund > 0 ? `Refund for ${pickedSlots.length} day${pickedSlots.length > 1 ? "s" : ""}: ${money(pickedRefund)}` : `No refund for the ${pickedSlots.length} selected day${pickedSlots.length > 1 ? "s" : ""} — inside the no-refund window.`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Entitlement, stated plainly from the policy (whole booking). */}
      {!partialMode && advice && (
        <div className="mb-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12px]">
          {advice.percent >= 100 ? (
            <div className="font-extrabold text-[#1d3a8f]">✓ You&rsquo;re entitled to a full refund of {money(advice.amount)}.</div>
          ) : advice.amount > 0 ? (
            <div className="font-extrabold text-[#1d3a8f]">✓ You&rsquo;re entitled to a {advice.percent}% refund — {money(advice.amount)}.</div>
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
            <div className="mt-1 text-[11px] font-semibold text-[#1d3a8f]">👛 This provider still gives you a full-value credit note to spend on a future booking.</div>
          )}
        </div>
      )}

      {cfg?.askReason && cfg.reasons.length > 0 && (
        <>
          <select value={reason} onChange={(e) => setReason(e.target.value)}
            className="mb-2 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)]">
            <option value="">Reason for cancelling…</option>
            {cfg.reasons.map((r) => <option key={r.id} value={r.label}>{r.label}</option>)}
            <option value="__other__">Other…</option>
          </select>
          {reason === "__other__" && (
            <input value={otherReason} onChange={(e) => setOtherReason(e.target.value)} placeholder="Tell us your reason…"
              className="mb-2 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none" />
          )}
        </>
      )}

      <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Anything to add? (optional)…" rows={2}
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none" />

      {/* Card vs wallet only matters when there's a cash refund and the provider
          lets the customer choose where it goes. */}
      {refundDue && cfg?.letChoose && (
        <div className="mt-2">
          <div className="mb-1 text-[11px] font-bold text-[var(--ink-2)]">Send my {money(effRefund)} refund to</div>
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
        <Button variant="danger" sm onClick={submit} disabled={busy || (partialMode && pickedSlots.length === 0)}>
          {busy ? "Sending…" : partialMode ? (pickedSlots.length ? `Cancel ${pickedSlots.length} day${pickedSlots.length === 1 ? "" : "s"}` : "Cancel selected days") : "Send cancellation request"}
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

function BookingCard({ b, refresh, autoPay, autoAmend, autoCancel }: { b: Booking; refresh: () => void; autoPay?: boolean; autoAmend?: boolean; autoCancel?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [cancelling, setCancelling] = useState(!!autoCancel);
  const [amending, setAmending] = useState(!!autoAmend);
  useEffect(() => { if (autoAmend || autoCancel) document.getElementById(`booking-${b.ref}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [autoAmend, autoCancel, b.ref]);
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
  // Refund state, so a cancelled booking tells the family what came back.
  const refundAmt = b.cancel?.amount ?? 0;
  const refundIssued = b.pay === "Refunded" || b.pay === "Partially refunded" || b.cancel?.refund === "approved";
  const refundOwed = b.cancel?.refund === "full" || b.cancel?.refund === "partial" || b.cancel?.refund === "pending";
  // Same rule as the server: confirmed places and operator invoices. A voucher
  // booking is paid OUTSIDE the app (through the scheme), then the provider
  // marks the money in — so no in-app card "Pay" button for it.
  const payable =
    b.pay !== "Paid" && b.pay !== "Refunded" && b.pay !== "Awaiting voucher payment" &&
    (b.status === "Confirmed" || b.pay === "Invoice sent") && b.amount > 0;

  return (
    <Card id={`booking-${b.ref}`} className="p-4">
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
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-2)]">
          <span aria-hidden className="text-[#c0392b]">✕</span>
          <span>
            <b className="text-[var(--ink)]">Cancelled</b>{b.cancel?.on ? ` · requested ${b.cancel.on}` : ""}
            {refundIssued ? (
              <> — <b className="text-[#1d3a8f]">{money(refundAmt || b.amount)} refunded{isVoucher ? " via voucher" : " to your original payment"}</b>.</>
            ) : refundOwed && refundAmt > 0 ? (
              <> — a <b>{money(refundAmt)} refund</b> is due; your provider is processing it{isVoucher ? " back through your voucher scheme" : ""}.</>
            ) : (
              <> — no refund was due.</>
            )}
          </span>
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
            <div className="mt-2 rounded-lg border border-[#bfe6cd] bg-[#eaf0fc] px-3 py-2.5 text-[12.5px] font-semibold text-[#1d3a8f]">
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

type BookingFilter = "all" | "upcoming" | "past" | "cancelled";

export function MyBookingsApp() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BookingFilter>("all");

  const refresh = useCallback(() => {
    apiGet<Booking[]>("/api/my/bookings")
      .then(setBookings)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load bookings"));
  }, []);

  useEffect(refresh, [refresh]);
  useRealtime(["bookings"], refresh);
  // The payment-link email deep-links here as ?pay=REF; the schedule's
  // "Edit booking" deep-links as ?amend=REF (auto-opens the Change-dates flow).
  const params = useSearchParams();
  const payRef = params.get("pay");
  const amendRef = params.get("amend");
  const cancelRef = params.get("cancel");

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

        const todayIso = new Date().toISOString().slice(0, 10);
        const isCancelled = (b: Booking) => b.status === "Cancelled" || b.status === "Declined";
        const lastDay = (b: Booking) => [...(b.days ?? [])].sort().at(-1) ?? "";
        const isPast = (b: Booking) => !isCancelled(b) && !!lastDay(b) && lastDay(b) < todayIso;
        const isUpcoming = (b: Booking) => !isCancelled(b) && !isPast(b);
        const match = (b: Booking) =>
          filter === "all" ? true
          : filter === "upcoming" ? isUpcoming(b)
          : filter === "past" ? isPast(b)
          : isCancelled(b);

        const counts = {
          all: rest.length,
          upcoming: rest.filter(isUpcoming).length,
          past: rest.filter(isPast).length,
          cancelled: rest.filter(isCancelled).length,
        };
        const shown = rest.filter(match);
        const tabs: { key: BookingFilter; label: string }[] = [
          { key: "all", label: "All" },
          { key: "upcoming", label: "Upcoming" },
          { key: "past", label: "Past" },
          { key: "cancelled", label: "Cancelled & refunded" },
        ];

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
                <div className="mb-3.5 flex flex-wrap gap-1.5">
                  {tabs.filter((t) => t.key === "all" || counts[t.key] > 0).map((t) => {
                    const active = filter === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setFilter(t.key)}
                        className="cursor-pointer rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors"
                        style={active
                          ? { borderColor: "var(--brand-2)", background: "var(--brand-2)", color: "#fff" }
                          : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}
                      >
                        {t.label}
                        <span className={active ? "ml-1.5 opacity-80" : "ml-1.5 text-[var(--ink-3)]"}>{counts[t.key]}</span>
                      </button>
                    );
                  })}
                </div>
                {shown.length === 0 ? (
                  <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">Nothing here right now.</Card>
                ) : (
                  <div className="flex flex-col gap-3">
                    {shown.map((b) => (
                      <BookingCard key={`${b.tenantId}-${b.ref}`} b={b} refresh={refresh} autoPay={b.ref === payRef} autoAmend={b.ref === amendRef} autoCancel={b.ref === cancelRef} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        );
      })()}
    </div>
  );
}
