"use client";

import { kidInitials } from "@/lib/uiRules";
import { OnlineSessionsPanel } from "@/features/onlinesessions/OnlineSessionsPanel";
import { dateLocale as dl } from "@/lib/i18n/format";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { get as apiGet, post as apiPost, apiPublic, rawErrorMessage } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useI18n, useT, useWord, tNow } from "@/lib/i18n/provider";
import { pickPlural } from "@/lib/i18n/plural";
import { Rich } from "@/components/i18n/Rich";
import { visitAddressLabel, addonLinesFor, bookingDateSummary, money, owedOf, paidSoFar, payLabelFor, payTone, refundableSoFar } from "@/features/bookings/helpers";
import { PayModal } from "@/features/payments/PayModal";
import type { Booking } from "@/features/bookings/types";
import { filledDetails, type VoucherProvider } from "@/lib/settings";
import { refundFor, effectiveRefundDate, policyById, policyWordingT, adviceReasonT, aPct, type NamedPolicy } from "@/lib/cancellation";
import { Badge, Button, Card, DefRow, SectionHead } from "@/components/ui";

// Boy → blue, Girl → pink, unknown → house grey. Same convention as the
// registers gender chips and the old schedule's per-child pills.
function genderTone(sex?: string): { bg: string; fg: string; on: string } {
  const s = (sex ?? "").toLowerCase();
  if (s.startsWith("b") || s === "male" || s === "m") return { bg: "#eaf0fc", fg: "var(--brand)", on: "var(--brand)" };
  if (s.startsWith("g") || s === "female" || s === "f") return { bg: "#fdeaf3", fg: "#b0186a", on: "#c81e77" };
  return { bg: "var(--panel)", fg: "var(--ink-2)", on: "var(--ink-2)" };
}

// Booking-card hero colours — same palette as the operator bookings list
// (Confirmed = deep blue, Waitlisted/Offered = deep green, etc.).
const PHERO_GRAD: Record<string, string> = {
  "Confirmed": "linear-gradient(140deg,#3d7fe6,#1749a8)",
  "Approval needed": "linear-gradient(140deg,#f2a231,#cf7208)",
  "Waitlisted": "linear-gradient(140deg,#25ad68,#0b8446)",
  "Offered": "linear-gradient(140deg,#25ad68,#0b8446)",
  "Cancelled": "linear-gradient(140deg,#ee6d6d,#c93030)",
  "Declined": "linear-gradient(140deg,#ee6d6d,#c93030)",
};
const pHeroGrad = (s: string) => PHERO_GRAD[s] || "linear-gradient(140deg,#4f78e0,#2140a0)";
const PHERO_TONE: Record<string, { bg: string; fg: string }> = {
  "Confirmed": { bg: "#e1eafb", fg: "#1749a8" },
  "Approval needed": { bg: "#fbe6c6", fg: "#a85f08" },
  "Waitlisted": { bg: "#dbf2e6", fg: "#0b8446" },
  "Offered": { bg: "#dbf2e6", fg: "#0b8446" },
  "Cancelled": { bg: "#fbdede", fg: "#c53030" },
  "Declined": { bg: "#fbdede", fg: "#c53030" },
};
const pHeroTone = (s: string) => PHERO_TONE[s] || { bg: "#e4e9fa", fg: "#2140a0" };
// A labelled fixed-width column, matching the operator row.
function PCol({ label, w, children }: { label: string; w: string; children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-0.5 ${w}`}>
      <span className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)] sm:text-[8.5px]">{label}</span>
      <div>{children}</div>
    </div>
  );
}

// A month calendar that shows, at a glance, which dates a booking can move to:
// green = a running date with space (clickable), blue = the one chosen, faint =
// nothing on / already taken. Beats a native date input, which looks identical
// whether a date is bookable or not.
const monthKey = (iso: string) => { const [y, m] = iso.split("-").map(Number); return y * 12 + (m - 1); };
function AvailabilityCalendar({ available, taken, value, onPick }: { available: string[]; taken?: string[]; value?: string; onPick: (iso: string) => void }) {
  const t = useT();
  const avail = new Set(available);
  const blocked = new Set(taken ?? []);
  const anchor = value || available[0] || new Date().toISOString().slice(0, 10);
  const [ym, setYm] = useState(() => { const [y, m] = anchor.split("-").map(Number); return { y, m: m - 1 }; });
  const curKey = ym.y * 12 + ym.m;
  const canPrev = available.some((s) => monthKey(s) < curKey);
  const canNext = available.some((s) => monthKey(s) > curKey);
  const step = (dir: number) => setYm((v) => { let m = v.m + dir, y = v.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } return { y, m }; });
  const daysIn = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(ym.y, ym.m, 1)).getUTCDay() + 6) % 7; // Mon = 0
  const label = new Date(Date.UTC(ym.y, ym.m, 1)).toLocaleDateString(dl(), { month: "long", year: "numeric", timeZone: "UTC" });
  const iso = (d: number) => `${ym.y}-${String(ym.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <button type="button" disabled={!canPrev} onClick={() => step(-1)} className="rounded-md px-2 py-0.5 text-[15px] font-bold text-[var(--brand-2)] disabled:opacity-25"><span className="inline-block rtl:-scale-x-100">‹</span></button>
        <span className="text-[12.5px] font-extrabold text-[var(--ink)]">{label}</span>
        <button type="button" disabled={!canNext} onClick={() => step(1)} className="rounded-md px-2 py-0.5 text-[15px] font-bold text-[var(--brand-2)] disabled:opacity-25"><span className="inline-block rtl:-scale-x-100">›</span></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] font-bold text-[var(--ink-3)]">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="mt-0.5 grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const s = iso(d);
          const sel = value === s;
          const isTaken = blocked.has(s);
          const free = avail.has(s) && !isTaken;
          return (
            <button key={i} type="button" disabled={!free} onClick={() => onPick(s)}
              className="flex h-8 items-center justify-center rounded-md text-[12px] font-bold transition-transform enabled:hover:-translate-y-px"
              title={free ? t("parent.availablePick") : isTaken ? t("parent.alreadyPicked") : t("parent.notRunningFull")}
              style={sel ? { background: "var(--brand)", color: "#fff", boxShadow: "0 2px 6px -1px rgba(29,58,143,.5)" }
                : free ? { background: "#e7f6ee", color: "#0f7a43" }
                : isTaken ? { background: "#fdebec", color: "#c0392b" }
                : { color: "var(--ink-3)", opacity: 0.35 }}>{d}</button>
          );
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--ink-3)]">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded" style={{ background: "#e7f6ee" }} /> {t("parent.availableWord")}</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded" style={{ background: "var(--brand)" }} /> {t("parent.chosenWord")}</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded" style={{ background: "#fdebec" }} /> {t("parent.takenWord")}</span>
      </div>
    </div>
  );
}

function CancelRequest({ booking, listing, hasPendingMove, onDone }: { booking: Booking; listing: AmendListing | null; hasPendingMove?: boolean; onDone: () => void }) {
  const t = useT();
  const { locale } = useI18n();
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [msg, setMsg] = useState("");
  const [refundPref, setRefundPref] = useState<"card" | "wallet">("card");
  const [bk, setBk] = useState({ accountName: "", sortCode: "", accountNumber: "" });
  const [cfg, setCfg] = useState<{
    policies: NamedPolicy[];
    reasons: { id: string; label: string }[];
    askReason: boolean;
    letChoose: boolean;
    walletEnabled: boolean;
    noRefundCredit: boolean;
    allowPartial: boolean;
    partRefund: boolean;
    partWallet: boolean;
    partChangeDate: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Whole booking vs a chosen set of days, which days are ticked, and what to
  // do with the released day(s) — refund / wallet / change date.
  const [scope, setScope] = useState<"all" | "days">("all");
  const [pickedDays, setPickedDays] = useState<string[]>([]);
  const [resolution, setResolution] = useState<"refund" | "wallet" | "changedate" | null>(null);
  const [moveTo, setMoveTo] = useState<Record<string, string>>({}); // slot key → replacement ISO date

  useEffect(() => {
    if (!booking.tenantId) return;
    apiPublic<{ settings: { cancellationPolicies?: NamedPolicy[]; cancelReasons?: { id: string; label: string }[]; askReasonParent?: boolean; allowCardRefund?: boolean; refundLetCustomerChoose?: boolean; noRefundCredit?: boolean; allowPartialCancel?: boolean; partialAllowRefund?: boolean; partialAllowWallet?: boolean; partialAllowChangeDate?: boolean; customerArea?: { wallet?: boolean } } }>(`/api/public/library/${encodeURIComponent(booking.tenantId)}${booking.listingId ? `?listingId=${encodeURIComponent(booking.listingId)}` : ""}`)
      .then((r) => {
        const s = r.settings ?? {};
        const allowCard = s.allowCardRefund ?? true;
        setCfg({
          policies: s.cancellationPolicies ?? [],
          reasons: s.cancelReasons ?? [],
          askReason: !!s.askReasonParent,
          letChoose: allowCard && (s.refundLetCustomerChoose ?? true),
          walletEnabled: s.customerArea?.wallet ?? true,
          noRefundCredit: !!s.noRefundCredit,
          allowPartial: s.allowPartialCancel ?? true,
          partRefund: s.partialAllowRefund ?? true,
          partWallet: s.partialAllowWallet ?? true,
          partChangeDate: s.partialAllowChangeDate ?? false,
        });
      })
      .catch(() => {});
  }, [booking.tenantId]);

  // What the provider's policy actually gives this booking, worked out from the
  // notice to the first session — so the parent sees their entitlement, not a
  // vague "if a refund is due".
  const policy = cfg ? policyById(cfg.policies, listing?.cancellationPolicyId) ?? cfg.policies[0] ?? null : null;
  const allDays = [...bookingDays(booking)].sort(); // phone-made bookings carry only session labels, not days
  const firstDay = allDays[0];
  // What could actually come back: the money RECEIVED (less anything already refunded) — the server values a refund the same way,
  // never against the price. An unpaid booking used to be told "You're entitled to a full refund of £20.00".
  const paidNow = refundableSoFar(booking);
  const advice = policy ? refundFor(policy, effectiveRefundDate(booking.origFirstDate, firstDay), paidNow, new Date().toISOString(), "parent") : null;

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
  const perSlotPaid = totalPaidSlots ? paidSoFar(booking) / totalPaidSlots : 0;
  // The cancellable (future, not-already-cancelled) slots.
  const slots: { key: string; childName: string; childId?: string; date: string }[] = [];
  const addSlots = (name: string, childId: string | undefined, dates: string[], cancelled: string[]) => {
    for (const d of [...dates].sort()) if (d >= localToday && !cancelled.includes(d)) slots.push({ key: `${childId ?? name}|${d}`, childName: name, childId, date: d });
  };
  if (kidsList) kidsList.forEach((k) => addSlots(k.name, k.childId, daysForKid(k), k.cancelledDays ?? []));
  else addSlots(booking.child, booking.childId, allDays, []);
  // Which resolutions the provider offers for a released day.
  const resOptions = ([
    cfg?.partChangeDate ? "changedate" : null,
    cfg?.partWallet ? "wallet" : null,
    cfg?.partRefund ? "refund" : null,
  ].filter(Boolean)) as ("refund" | "wallet" | "changedate")[];
  const canPartial = !!cfg?.allowPartial && totalPaidSlots > 1 && slots.length > 0 && resOptions.length > 0;
  const slotRefund = (d: string) => (policy ? refundFor(policy, effectiveRefundDate(booking.dayOrigin?.[d], d), perSlotPaid, new Date().toISOString(), "parent")?.amount ?? 0 : 0);
  const togglePick = (key: string) => setPickedDays((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));
  const pickedSlots = slots.filter((s) => pickedDays.includes(s.key));
  // Refund = pro-rata, per policy, per day. Wallet = full pro-rata value (stays
  // in-house, no policy cut). Change date = no money moves.
  const pickedRefund = pickedSlots.reduce((sum, s) => sum + slotRefund(s.date), 0);
  const pickedWallet = pickedSlots.length * perSlotPaid;
  const res = resolution && resOptions.includes(resolution) ? resolution : resOptions[0] ?? null;
  const multiKid = !!kidsList && kidsList.length > 1;
  // Dates a released day could move TO — the listing's future sessions with
  // space that the child isn't already booked on.
  const bookedSet = new Set(allDays);
  const moveDates = [...new Set((listing?.blocks ?? []).flatMap((b) => (b.sessions ?? []).filter((se) => se.spotsLeft > 0).map((se) => se.date)))]
    .filter((d) => d >= localToday && !bookedSet.has(d)).sort();
  const moveTargets = pickedSlots.map((s) => moveTo[s.key]);
  const movesReady = res !== "changedate" || (pickedSlots.every((s) => moveTo[s.key] && moveDates.includes(moveTo[s.key])) && new Set(moveTargets).size === moveTargets.length);
  const partialMode = scope === "days";
  const effRefund = partialMode ? (res === "refund" ? pickedRefund : 0) : advice?.amount ?? 0;
  const refundDue = effRefund > 0;
  // A voucher / Tax-Free Childcare payment was made outside the app — that money
  // can NEVER be refunded to a bank card. The only place it can land is the
  // family's wallet (store credit), and only if the provider runs one.
  const scheme = booking.voucherScheme;
  const noBankRefund = !!scheme || /voucher|tax.?free|childcare|\btfc\b/i.test(booking.method ?? "");
  const isVoucher = noBankRefund;
  // Paid by bank transfer or cash: there is no card to refund to, so don't offer "Back to card".
  const paidByBank = !noBankRefund && /bank|transfer/i.test(booking.method ?? "");
  const paidOffline = !noBankRefund && !paidByBank && /cash|other/i.test(booking.method ?? "") && !/card/i.test(booking.method ?? "");
  const walletOn = cfg?.walletEnabled ?? false;
  // A bank-transfer booking refunded to the bank (not wallet): we need the family's account details.
  const needBank = paidByBank && refundDue && refundPref === "card";
  const bankOk = bk.accountName.trim().length >= 2 && /^\d{2}[- ]?\d{2}[- ]?\d{2}$/.test(bk.sortCode.trim()) && /^\d{6,8}$/.test(bk.accountNumber.trim());
  // A voucher/TFC refund can only go to the wallet — force it there when the
  // provider offers store credit (otherwise the provider reimburses via the
  // scheme; there's nothing for the family to choose).
  useEffect(() => {
    if (noBankRefund) setRefundPref(walletOn ? "wallet" : "card");
  }, [noBankRefund, walletOn]);

  async function submit() {
    if (needBank && !bankOk) { setError(t("p7bk.bankRefundNeed")); return; }
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
      // Change-date is a MOVE, not a cancellation — it goes to the amend
      // endpoint and leaves the booking Confirmed. The booking then shows
      // "change of date requested · pending" until the provider approves (at
      // which point the swap applies automatically from the structured moves).
      if (partialMode && res === "changedate") {
        const moves = pickedSlots.map((s) => ({ childName: s.childName, childId: s.childId, from: s.date, to: moveTo[s.key] }));
        try {
          const out = await apiPost<{ amendApplied?: boolean; amendFee?: number }>(`/api/my/bookings/${encodeURIComponent(booking.ref)}/amend${booking.tenantId ? `?tenantId=${encodeURIComponent(booking.tenantId)}` : ""}`, { moves, msg: msg.trim() || undefined });
        } catch (e) {
          // Amend endpoint isn't live yet (§U) — record the intent locally so
          // it still shows as pending. Any other error is real.
          if (!/404|not found/i.test(rawErrorMessage(e))) throw e;
        }
        try { localStorage.setItem(`aos.pendingMove.${booking.tenantId ?? ""}.${booking.ref}`, JSON.stringify({ moves, at: new Date().toISOString() })); } catch { /* ignore */ }
        onDone();
        return;
      }
      // Refund / wallet / whole cancel — the cancel endpoint (releases days).
      await apiPost<Booking>(`/api/my/bookings/${encodeURIComponent(booking.ref)}/cancel${booking.tenantId ? `?tenantId=${encodeURIComponent(booking.tenantId)}` : ""}`, {
        reason: effReason || undefined,
        msg: [effReason, msg.trim()].filter(Boolean).join(" — ") || undefined,
        refundPref,
        ...(needBank ? { refundBank: bk } : {}),
        resolution: partialMode ? res ?? undefined : undefined,
        ...partial,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("parent.errRequestFailed"));
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] p-3">
      <div className="mb-1.5 text-[12.5px] font-bold text-[var(--red,#e21d27)]">{t("parent.requestCancellation")}</div>

      {hasPendingMove && (
        <div className="mb-2 rounded-lg border border-[#fde3a7] bg-[#fdf3d8] px-3 py-2 text-[11.5px] font-semibold text-[#8a5300]">
          {t("parent.cancelWithdrawsMove")}
        </div>
      )}

      {/* Whole booking vs individual days (multi-day passes only). */}
      {canPartial && (
        <div className="mb-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2">
          <div className="grid grid-cols-2 gap-1.5">
            {([["all", t("parent.wholeBooking")], ["days", t("parent.chooseDays")]] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setScope(v)} className="rounded-lg border p-2 text-[12px] font-extrabold"
                style={scope === v ? { borderColor: "var(--brand-2)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink)" }}>{l}</button>
            ))}
          </div>
          {partialMode && (
            <div className="mt-2">
              <div className="mb-1 text-[11px] font-bold text-[var(--ink-2)]">{multiKid ? t("p7bk.tickDaysKid") : t("p7bk.tickDays")}</div>
              <div className="mb-1.5 rounded-md bg-[var(--panel)] px-2.5 py-1.5 text-[11px] leading-[1.5] text-[var(--ink-3)]">
                <Rich text={t("p7bk.dayWorth", { each: money(perSlotPaid), n: totalPaidSlots, total: money(paidSoFar(booking)) })} bClass="text-[var(--ink-2)]" />
              </div>
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
                            <span className="text-[11px] font-semibold" style={{ color: r > 0 ? "var(--brand)" : "var(--ink-3)" }}>{money(perSlotPaid)}{r === 0 ? " · " + t("p7bk.noCashClose") : perSlotPaid - r > 0.005 ? " · " + t("p7bk.ifRefunded", { amt: money(r) }) : ""}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* What to do with the released day(s) — one choice for all. */}
              {pickedSlots.length > 0 && (
                <div className="mt-2">
                  <div className="mb-1 text-[11px] font-bold text-[var(--ink-2)]">{pickedSlots.length === 1 ? t("p7bk.whatToDo_one") : t("p7bk.whatToDo_other")}</div>
                  <div className="flex flex-col gap-1.5">
                    {resOptions.map((o) => {
                      const on = res === o;
                      const label = o === "refund" ? t("parent.refundOption") : o === "wallet" ? t("parent.walletCreditOption") : t("parent.moveToAnotherDate");
                      const detail = o === "refund"
                        ? (pickedRefund > 0 ? t("p7bk.detailRefund", { amt: money(pickedRefund), each: money(perSlotPaid) }) : t("p7bk.detailNoCash"))
                        : o === "wallet" ? t("p7bk.detailWallet", { amt: money(pickedWallet), each: money(perSlotPaid) })
                        : moveDates.length ? t("p7bk.detailMovePick") : t("p7bk.detailMoveNone");
                      return (
                        <button key={o} type="button" onClick={() => setResolution(o)} disabled={o === "changedate" && moveDates.length === 0} className="rounded-lg border p-2 text-start disabled:opacity-50"
                          style={on ? { borderColor: "var(--brand-2)", background: "var(--panel)" } : { borderColor: "var(--line)" }}>
                          <div className="text-[12.5px] font-extrabold" style={{ color: on ? "var(--brand-ink)" : "var(--ink)" }}>{on ? "◉ " : "○ "}{label}</div>
                          <div className="text-[11px] text-[var(--ink-3)]">{detail}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Structured calendar pick — a concrete from→to per day, so a
                      provider approval applies the move automatically (no free
                      text to interpret). */}
                  {res === "changedate" && (
                    <div className="mt-2 rounded-lg border border-[var(--line)] p-2">
                      <div className="mb-1.5 text-[11px] font-bold text-[var(--ink-2)]">{t("p7bk.pickNewDate")}</div>
                      <div className="flex flex-col gap-2.5">
                        {pickedSlots.map((s) => {
                          const taken = pickedSlots.filter((ps) => ps.key !== s.key).map((ps) => moveTo[ps.key]).filter(Boolean) as string[];
                          const chosen = moveTo[s.key];
                          return (
                            <div key={s.key}>
                              <div className="mb-1 text-[12px] font-semibold">
                                {multiKid && <span className="text-[var(--ink-3)]">{s.childName}: </span>}
                                {t("p7bk.moveWord")} <b>{fmtIso(s.date)}</b>{chosen ? <> <span className="inline-block rtl:-scale-x-100">→</span> <b className="text-[var(--brand)]">{fmtIso(chosen)}</b></> : <span className="text-[var(--ink-3)]"> <span className="inline-block rtl:-scale-x-100">→</span> {t("p7bk.chooseBelow")}</span>}
                              </div>
                              <AvailabilityCalendar available={moveDates} taken={taken} value={chosen} onPick={(iso) => setMoveTo((m) => ({ ...m, [s.key]: iso }))} />
                            </div>
                          );
                        })}
                      </div>
                      {moveDates.length === 0 && <div className="mt-1.5 text-[11px] font-bold text-[#c0392b]">{t("p7bk.noOtherDates")}</div>}
                      {!movesReady && moveDates.length > 0 && <div className="mt-1.5 text-[11px] font-bold text-[#c0392b]">{t("p7bk.pickEveryDay")}</div>}
                      <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">{t("p7bk.swapAuto")}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Entitlement, stated plainly from the policy (whole booking). */}
      {!partialMode && advice && (
        <div className="mb-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12px]">
          {paidNow <= 0 ? (
            <div className="font-extrabold text-[var(--ink-2)]">{t("p7bk.nothingPaid")}</div>
          ) : advice.percent >= 100 ? (
            <div className="font-extrabold text-[var(--brand)]">{t("p7bk.entitledFull", { amt: money(advice.amount) })}</div>
          ) : advice.amount > 0 ? (
            <div className="font-extrabold text-[var(--brand)]">{t("p7bk.entitledPct", { pct: advice.percent, aPct: aPct(advice.percent), amt: money(advice.amount) })}</div>
          ) : (
            <div className="font-extrabold text-[#c0392b]">{t("p7bk.noRefundDue")}</div>
          )}
          {paidNow > 0 && <div className="mt-0.5 text-[11px] leading-[1.5] text-[var(--ink-3)]">{adviceReasonT(t, locale, advice)}</div>}
          {policy && (
            <div className="mt-1.5 border-t border-[var(--line)] pt-1.5 text-[11px] leading-[1.5] text-[var(--ink-3)]">
              <span className="font-semibold text-[var(--ink-2)]">{t("p7bk.policyName", { name: policy.name })}</span> {policyWordingT(t, locale, policy)}
            </div>
          )}
          {advice.amount === 0 && paidNow > 0 && cfg?.noRefundCredit && cfg.walletEnabled && (
            <div className="mt-1 text-[11px] font-semibold text-[var(--brand)]">{t("p7bk.creditNote")}</div>
          )}
        </div>
      )}

      {cfg?.askReason && cfg.reasons.length > 0 && (
        <>
          <select value={reason} onChange={(e) => setReason(e.target.value)}
            className="mb-2 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)]">
            <option value="">{t("parent.reasonForCancelling")}</option>
            {cfg.reasons.map((r) => <option key={r.id} value={r.label}>{r.label}</option>)}
            <option value="__other__">{t("parent.otherOption")}</option>
          </select>
          {reason === "__other__" && (
            <input value={otherReason} onChange={(e) => setOtherReason(e.target.value)} placeholder={t("parent.tellUsReason")}
              className="mb-2 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none" />
          )}
        </>
      )}

      <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t("parent.anythingToAdd")} rows={2}
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none" />

      {/* Where a refund goes. Voucher / Tax-Free Childcare money can never return
          to a bank card, so those bookings are only ever offered the wallet (and
          only when the provider runs store credit). Everyone else may choose
          card vs wallet when the provider lets them. */}
      {refundDue && (cfg?.letChoose || noBankRefund || paidByBank) && (() => {
        const options: readonly (readonly ["wallet" | "card", string])[] = noBankRefund
          ? (walletOn ? [["wallet", t("parent.walletCreditBtn")]] : [])
          : [
              ...(walletOn ? ([["wallet", t("parent.walletCreditBtn")]] as const) : []),
              ["card", paidByBank ? t("p7bk.backToBank") : paidOffline ? t("p7bk.refundFromProvider") : t("parent.backToCard")],
            ];
        return (
          <div className="mt-3 border-t border-[var(--line)] pt-3">
            <div className="mb-1.5 text-[12.5px] font-extrabold text-[var(--ink)]">{t("p7bk.sendRefundTo", { amt: money(effRefund) })}</div>
            {options.length > 0 && (
              <div className={`grid ${options.length === 1 ? "grid-cols-1" : "grid-cols-2"} gap-2`}>
                {options.map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setRefundPref(v)} className="min-h-[44px] rounded-lg border-2 bg-[var(--surface)] px-2 py-2.5 text-[13px] font-extrabold"
                    style={refundPref === v ? { borderColor: "var(--brand-2)", color: "var(--brand-ink)", boxShadow: "inset 0 0 0 1px var(--brand-2)" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>
                    {refundPref === v ? "\u2713 " : ""}{l}
                  </button>
                ))}
              </div>
            )}
            {needBank && (
              <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
                <div className="text-[12.5px] font-extrabold text-[var(--ink)]">{t("p7bk.bankRefundTitle")}</div>
                <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--ink-3)]">{t("p7bk.bankRefundNote")}</p>
                <div className="mt-2 grid gap-2">
                  {([["accountName", "p7pub.accountName", "name", "text"], ["sortCode", "p7pub.sortCode", "off", "text"], ["accountNumber", "p7pub.accountNumber", "off", "text"]] as const).map(([k, lab, ac, ty]) => (
                    <label key={k} className="block text-[11.5px] font-bold text-[var(--ink-2)]">{t(lab)}
                      <input value={bk[k]} onChange={(e) => setBk((x) => ({ ...x, [k]: k === "accountName" ? e.target.value : e.target.value.replace(/[^\d -]/g, "") }))} autoComplete={ac} type={ty} inputMode={k === "accountName" ? "text" : "numeric"}
                        placeholder={k === "sortCode" ? "12-34-56" : k === "accountNumber" ? "12345678" : ""}
                        className="mt-0.5 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[14px] font-semibold text-[var(--ink)] outline-none" />
                    </label>
                  ))}
                </div>
              </div>
            )}
            {noBankRefund && (
              <p className="mt-1.5 text-[11px] leading-[1.5] text-[var(--ink-3)]">
                <Rich text={t("p7bk.voucherNote", { scheme: scheme ?? t("p7bk.schemeDefault") })} />{" "}
                {walletOn
                  ? <><Rich text={t("p7bk.voucherWallet")} /></>
                  : <>{t("p7bk.voucherReimburse", { scheme: scheme ?? t("p7bk.schemeThe") })}</>}
              </p>
            )}
          </div>
        );
      })()}

      {error && <div className="mt-1 text-[12px] text-[var(--red)]">{error}</div>}
      <div className="mt-4 flex gap-2 [&>button]:w-full [&>button]:min-h-[44px] sm:[&>button]:w-auto">
        <Button variant="danger" sm onClick={submit} disabled={busy || (partialMode && (pickedSlots.length === 0 || !movesReady))}>
          {busy ? t("parent.sending") : !partialMode ? t("p7bk.btnSendCancel")
            : !pickedSlots.length ? t("p7bk.btnChooseDays")
            : res === "changedate" ? t("p7bk.btnMoveDays", { days: pickPlural(t, locale, "p7bk.dayN", pickedSlots.length) })
            : res === "wallet" ? t("p7bk.btnWalletDays", { days: pickPlural(t, locale, "p7bk.dayN", pickedSlots.length) })
            : t("p7bk.btnCancelDays", { days: pickPlural(t, locale, "p7bk.dayN", pickedSlots.length) })}
        </Button>
      </div>
      <div className="mt-2.5 text-[12px] leading-[1.5] text-[var(--ink-3)]">
        {t("p7bk.reviewNote")} {advice ? t("p7bk.adviceYes") : t("p7bk.adviceNo")}
      </div>
    </div>
  );
}

type AmendPolicy = {
  allowDateChanges: boolean;
  amendSelfService: boolean;
  amendNoticeHours: number;
  amendFee: number;
  amendAllowCheaper: boolean;
  allowCardRefund: boolean;
  refundLetCustomerChoose: boolean;
};

const AMEND_FALLBACK: AmendPolicy = { allowDateChanges: true, amendSelfService: true, amendNoticeHours: 48, amendFee: 0, amendAllowCheaper: true, allowCardRefund: true, refundLetCustomerChoose: true };

// POST /api/my/bookings/:ref/amend is live — it records the request on the
// booking so the operator sees it and can approve (applies the swap) or deny.
const DATE_CHANGES_LIVE = true;

const fmtIso = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(dl(), { weekday: "short", day: "numeric", month: "short" });
};
// Recover an ISO date from a session display string like
// "Mon 27 Jul 2026 · 09:00 – 15:30" → "2026-07-27". Some bookings only carry
// these strings (no ISO `days`), so the amend flow parses them as a fallback.
const isoFromSession = (s: string): string | null => {
  const m = s.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
  if (!m) return null;
  const d = new Date(`${m[1]} ${m[2]} ${m[3]}`);
  return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// Every ISO date a booking actually occupies, from whichever field holds it:
// booking.days, then per-child kids[].dates, then parsed from session strings.
const bookingDays = (b: Booking): string[] => {
  if (b.days && b.days.length) return b.days;
  const kidDays = [...new Set((b.kids ?? []).flatMap((k) => k.dates ?? []))];
  if (kidDays.length) return kidDays.sort();
  return [...new Set((b.sessions ?? []).map(isoFromSession).filter(Boolean) as string[])].sort();
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
  /** The block bundle's defined timings (periods) — the ONLY timings a booking
   * can move to. A parent picks from these, never a free time. */
  bundle?: { periods?: { id?: string; title: string; start?: string; finish?: string }[] } | null;
};
// Monday of an ISO date's week — the key a "one week" pass rule groups by.
const weekKey = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

function AmendModal({ booking, listing, onDone }: { booking: Booking; listing: AmendListing | null; onDone: (changed: boolean) => void }) {
  const t = useT();
  const { locale } = useI18n();
  const [policy, setPolicy] = useState<AmendPolicy>(AMEND_FALLBACK);
  const [moves, setMoves] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [refundTo, setRefundTo] = useState<"card" | "wallet">("card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Every ISO date the booking occupies (booking.days, per-child dates, or
  // parsed from session strings) — so the per-date "Your dates" layout shows
  // instead of the single preferred-date fallback whenever dates exist.
  const days = bookingDays(booking);
  // Which child the change applies to ("" = all). Multi-child bookings can move
  // just one child's dates/times without touching the others.
  const kidsList = (booking.kids ?? []).map((k) => k.name).filter(Boolean);
  const [who, setWho] = useState<string>("");
  // A new timing — ONLY the block bundle's listed periods, never a free time.
  const periods = listing?.bundle?.periods ?? [];
  const [newTiming, setNewTiming] = useState<string>(""); // "" = keep current

  useEffect(() => {
    if (!booking.tenantId) return;
    apiPublic<{ settings: Partial<AmendPolicy> }>(`/api/public/library/${encodeURIComponent(booking.tenantId)}`)
      .then((r) => setPolicy({ ...AMEND_FALLBACK, ...r.settings }))
      .catch(() => {});
  }, [booking.tenantId]);

  const setMove = (oldIso: string, newIso: string) =>
    setMoves((m) => { const n = { ...m }; if (newIso) n[oldIso] = newIso; else delete n[oldIso]; return n; });

  const selfService = policy.amendSelfService;
  const [applied, setApplied] = useState<{ fee: number } | null>(null);
  const hasChanges = Object.keys(moves).length > 0 || !!preferredDate || !!newTiming || !!msg.trim();
  // Voucher / Tax-Free Childcare money can never go back to a bank card, so a
  // cheaper-date difference can only ever land in the wallet — never offer card.
  const noBankRefund = !!booking.voucherScheme || /voucher|tax.?free|childcare|\btfc\b/i.test(booking.method ?? "");
  useEffect(() => { if (noBankRefund) setRefundTo("wallet"); }, [noBankRefund]);
  // Where any money back goes, mirroring the provider's Money-back settings.
  const letChoose = policy.amendAllowCheaper && policy.allowCardRefund && policy.refundLetCustomerChoose;
  const cheaper = policy.amendAllowCheaper
    ? !policy.allowCardRefund
      ? t("p8par.mbCheaperWallet")
      : policy.refundLetCustomerChoose
        ? t("p8par.mbCheaperChoice")
        : t("p8par.mbCheaperCard")
    : null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const out = await apiPost<{ amendApplied?: boolean; amendFee?: number }>(`/api/my/bookings/${encodeURIComponent(booking.ref)}/amend${booking.tenantId ? `?tenantId=${encodeURIComponent(booking.tenantId)}` : ""}`, {
        // Per-child moves carry the child's name; a whole-booking change sends
        // the plain oldISO→newISO map.
        moves: who ? Object.entries(moves).map(([from, to]) => ({ from, to, childName: who })) : moves,
        preferredDate: preferredDate || undefined,
        // A timing change is one of the pass's listed periods; scoped to `who`.
        timing: newTiming || undefined,
        child: who || undefined,
        message: msg.trim() || undefined,
        ...(letChoose ? { refundTo } : {}),
      });
      // The provider lets families move their own dates and this passed every rule: it is already done — say so
      // (and any admin fee now owing) instead of closing as though a request had been sent.
      if (out?.amendApplied) { setApplied({ fee: out.amendFee ?? 0 }); setBusy(false); return; }
      onDone(true);
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      // The amend endpoint isn't live yet (§U) — 404s. Say so plainly rather
      // than surfacing a raw "404 Not Found".
      setError(
        /404|not found/i.test(m)
          ? t("p7bk.errNotLive")
          : m || t("p7bk.errSubmit"),
      );
      setBusy(false);
    }
  }

  // Only listed dates with a space, in the future — the pool a move can go to.
  const todayIso = new Date().toISOString().slice(0, 10);
  const available = (() => {
    const set = new Set<string>();
    // The server only moves a booking within its OWN block (a weekly listing has one block per week), so only offer those.
    const own = (listing?.blocks ?? []).filter((bk) => !booking.blockId || bk.id === booking.blockId);
    for (const bk of own.length ? own : listing?.blocks ?? [])
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
      if (dt === iso) return false; // its own date — that's "Keep this date"
      if (days.includes(dt)) return false; // a date already on this booking
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
            {selfService ? t("parent.changeYourDates") : t("parent.requestDateChange")}
          </h3>
          <button type="button" onClick={() => onDone(false)} className="cursor-pointer text-[20px] leading-none text-[var(--ink-3)]" aria-label={t("parent.close")}>×</button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <div className="text-[12px] text-[var(--ink-3)]">{booking.listing} · {booking.child} · {booking.pass}</div>

          {applied ? (
            <>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-3 text-[12.5px] leading-[1.6] text-[var(--ink)]">
                <b>{t("p9tx.mbDatesChanged")}</b> {t("p9tx.mbDatesChangedBody")}
                {applied.fee > 0 && <> {t("p9tx.mbAdminFee", { fee: money(applied.fee) })}</>}
              </div>
              <div className="flex justify-end"><Button variant="primary" onClick={() => onDone(true)}>{t("parent.closeText")}</Button></div>
            </>
          ) : !policy.allowDateChanges || !DATE_CHANGES_LIVE ? (
            <>
              <div className="rounded-xl border border-[#f0d9a8] bg-[#fdf6e6] px-3.5 py-3 text-[12.5px] leading-[1.6] text-[#7a5b06]">
                {!policy.allowDateChanges
                  ? <Rich text={t("p7bk.noDateChanges", { name: booking.listing })} />
                  : <Rich text={t("p7bk.datesNotOnline", { name: booking.listing })} />}
              </div>
              <div className="flex justify-end">
                <Button onClick={() => onDone(false)}>{t("parent.closeText")}</Button>
              </div>
            </>
          ) : (
          <>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-[11.5px] leading-[1.6] text-[var(--ink-2)]">
            <div><Rich text={t("p7bk.ruleNotice", { notice: policy.amendNoticeHours % 24 === 0 && policy.amendNoticeHours >= 24 ? pickPlural(t, locale, "p7pol.dy", policy.amendNoticeHours / 24) : pickPlural(t, locale, "p7pol.hr", policy.amendNoticeHours) })} /></div>
            <div>{t("p7bk.ruleSpace")}</div>
            {policy.amendFee > 0 && <div><Rich text={t("p7bk.ruleFee", { fee: policy.amendFee })} /></div>}
            {cheaper ? <div><Rich text={t("p7bk.ruleCheaper", { diff: cheaper })} /></div> : <div>{t("p7bk.ruleSamePrice")}</div>}
            {!selfService && <div className="mt-1 text-[var(--ink-3)]">{t("p7bk.providerReviews")}</div>}
          </div>

          {/* Whose booking to change — multi-child bookings can move just one. */}
          {kidsList.length > 1 && (
            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">{t("parent.changeThisFor")}</div>
              <div className="flex flex-wrap gap-1.5">
                {[["", t("parent.allChildren")], ...kidsList.map((n) => [n, n] as [string, string])].map(([val, label]) => {
                  const on = who === val;
                  return (
                    <button key={val || "all"} type="button" onClick={() => setWho(val)}
                      className="rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors"
                      style={on ? { borderColor: "var(--brand-2)", background: "var(--brand-2)", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1 text-[11px] text-[var(--ink-3)]">{who ? t("p7bk.onlyChild", { name: who }) : t("p7bk.allChildren")}</div>
            </div>
          )}

          {days.length > 0 ? (
            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">{t("parent.yourDates")}</div>
              {fixed ? (
                <div className="rounded-lg border border-[#f0d9a8] bg-[#fdf6e6] px-3 py-2.5 text-[11.5px] leading-[1.5] text-[#7a5b06]">
                  <Rich text={t("p7bk.fixedBlock")} />
                </div>
              ) : listing && available.length === 0 ? (
                <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-[11.5px] text-[var(--ink-3)]">{t("p7bk.noOtherDates")}</div>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    {days.map((iso) => {
                      const opts = optionsFor(iso);
                      return (
                        <div key={iso} className="flex items-center gap-2 text-[12.5px]">
                          <span className="w-[120px] font-semibold">{fmtIso(iso)}</span>
                          <span className="text-[var(--ink-3)] inline-block rtl:-scale-x-100">→</span>
                          <select value={moves[iso] ?? ""} onChange={(e) => setMove(iso, e.target.value)}
                            className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12.5px]" aria-label={t("parent.moveDateTo", { date: fmtIso(iso) })}>
                            <option value="">{t("parent.keepThisDate")}</option>
                            {opts.map((dt) => <option key={dt} value={dt}>{fmtIso(dt)}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--ink-3)]">
                    {t("p7bk.onlyRunning")}{" "}
                    {rule === "week" ? t("p7bk.weekOne") : t("p7bk.anyWeek")}
                  </div>
                  {!weekOk && <div className="mt-1 text-[11px] font-bold text-[#c0392b]">{t("p7bk.weekSpan")}</div>}
                </>
              )}
            </div>
          ) : (
            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">{t("parent.whichDate")}</div>
              {available.length > 0 ? (
                <select value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] text-[var(--ink)]" aria-label={t("parent.preferredDate")}>
                  <option value="">{t("parent.pickADate")}</option>
                  {available.map((dt) => <option key={dt} value={dt}>{fmtIso(dt)}</option>)}
                </select>
              ) : (
                <input type="date" min={todayIso} value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] text-[var(--ink)]" />
              )}
              <div className="mt-1 text-[11px] text-[var(--ink-3)]">{t("p7bk.pickDateNote")} {available.length > 0 ? t("p7bk.onlySpace") : t("p7bk.datesNotSet")}</div>
            </div>
          )}

          {/* Timing — ONLY the pass's listed periods, never a free time. */}
          {periods.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">{t("parent.timing")}{who ? ` · ${who}` : ""}</div>
              <select value={newTiming} onChange={(e) => setNewTiming(e.target.value)}
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] text-[var(--ink)]" aria-label={t("parent.timing")}>
                <option value="">{t("parent.keepCurrent")}{booking.timing ? ` (${booking.timing})` : ""}</option>
                {periods.filter((p) => p.title !== booking.timing).map((p) => (
                  <option key={p.id ?? p.title} value={p.title}>{p.title}{p.start && p.finish ? ` · ${p.start}–${p.finish}` : ""}</option>
                ))}
              </select>
              <div className="mt-1 text-[11px] text-[var(--ink-3)]">{t("p7bk.timingsNote")}</div>
            </div>
          )}

          {/* Only ask where money goes when a move actually returns some. A
              same-pass date move keeps the price, so this only appears when the
              new dates come out cheaper (the difference is refundable). */}
          {(letChoose || noBankRefund) && moneyBack && (
            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">{t("parent.ifMoneyComesBack")}</div>
              <div className={`grid ${noBankRefund ? "grid-cols-1" : "grid-cols-2"} gap-2`}>
                {(noBankRefund ? ([["wallet", t("parent.walletCreditBtn")]] as const) : ([["card", t("parent.myCard")], ["wallet", t("parent.walletCreditBtn")]] as const)).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setRefundTo(v)} className="rounded-xl border p-2.5 text-[12.5px] font-extrabold"
                    style={refundTo === v ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink)" }}>
                    {l}
                  </button>
                ))}
              </div>
              {noBankRefund && (
                <p className="mt-1.5 text-[11px] leading-[1.5] text-[var(--ink-3)]"><Rich text={t("p7bk.voucherAmend", { scheme: booking.voucherScheme ?? t("p7bk.schemeDefault") })} /></p>
              )}
            </div>
          )}

          {error && <div className="text-[12.5px] text-[var(--red)]">{error}</div>}
          {policy.amendFee > 0 && hasChanges && (
            <div className="text-center text-[12px] font-bold text-[var(--ink-2)]">{t("p7bk.amendFeeAdded", { fee: money(policy.amendFee) })}</div>
          )}
          <Button variant="primary" disabled={busy || !hasChanges || !weekOk} onClick={submit} className="w-full justify-center">
            {busy ? t("parent.sending") : selfService ? t("parent.confirmChange") : t("parent.sendRequest")}
          </Button>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

/** An unpaid bank-transfer booking: where to send the money and what to quote, always findable. */
function BankTransferBox({ b }: { b: Booking }) {
  const tt = useT();
  const [bank, setBank] = useState<{ bankName?: string; accountName?: string; sortCode?: string; accountNumber?: string; reference: string; amount?: number } | null>(null);
  const wanted = /bank|transfer/i.test(String(b.method ?? "")) && b.pay !== "Paid" && b.status !== "Cancelled" && b.status !== "Declined" && b.status !== "Waitlisted";
  useEffect(() => {
    if (!wanted) return;
    let alive = true;
    apiGet<{ bank: typeof bank }>(`/api/my/bank-details?ref=${encodeURIComponent(b.ref)}`).then((r) => { if (alive) setBank(r?.bank ?? null); }).catch(() => {});
    return () => { alive = false; };
  }, [wanted, b.ref]);
  if (!wanted || !bank) return null;
  return (
    <div className="mt-2 rounded-xl border-2 border-[#1d3a8f] bg-[#eef3ff] p-3 text-[12.5px]">
      <div className="font-extrabold uppercase tracking-wide text-[#1d3a8f]">{tt("p7pub.bankTitle")} · {money(bank.amount ?? b.amount)}</div>
      <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[#171534]">
        {bank.bankName && (<><span className="text-[#6a6785]">{tt("p7pub.bankName")}</span><b>{bank.bankName}</b></>)}
        {bank.accountName && (<><span className="text-[#6a6785]">{tt("p7pub.accountName")}</span><b>{bank.accountName}</b></>)}
        {bank.sortCode && (<><span className="text-[#6a6785]">{tt("p7pub.sortCode")}</span><b>{bank.sortCode}</b></>)}
        {bank.accountNumber && (<><span className="text-[#6a6785]">{tt("p7pub.accountNumber")}</span><b>{bank.accountNumber}</b></>)}
        <span className="text-[#6a6785]">{tt("p9tx.ckBankRefLbl")}</span><b>{bank.reference}</b>
      </div>
    </div>
  );
}

function BookingCard({ b, refresh, autoPay, autoAmend, autoCancel, autoOpen, clash, listingInfo, venue, mealOrders = [] }: { b: Booking; refresh: () => void; autoPay?: boolean; autoAmend?: boolean; autoCancel?: boolean; autoOpen?: boolean; clash?: boolean; listingInfo?: AmendListing | null; venue?: { location?: string | null; address?: string | null; city?: string | null; online?: boolean; joinInfo?: string | null }; mealOrders?: MealOrder[] }) {
  const t = useT();
  const w = useWord();
  const { locale } = useI18n();
  const [expanded, setExpanded] = useState(!!(autoAmend || autoCancel || autoPay || autoOpen));
  // Meals on this booking: those bought at checkout (b.mealItems) + any ordered
  // later from the Meals area (matched orders). "later" ones are tagged.
  const mealRows = useMemo(() => {
    const rows: { name: string; date: string; price: number; child?: string; later?: boolean }[] = [];
    for (const m of (b.mealItems ?? [])) rows.push({ name: m.name, date: m.date, price: m.price });
    for (const o of mealOrders) for (const it of (o.items ?? [])) for (let q = 0; q < (it.qty ?? 1); q++) rows.push({ name: it.name, date: o.date, price: it.price, child: o.childName, later: true });
    return rows.sort((a, c) => a.date.localeCompare(c.date));
  }, [b.mealItems, mealOrders]);
  const mealTotal = mealRows.reduce((s, m) => s + m.price, 0);
  const [cancelling, setCancelling] = useState(!!autoCancel);
  const [withdrawing, setWithdrawing] = useState(false);
  const [amending, setAmending] = useState(!!autoAmend);
  useEffect(() => { if (autoAmend || autoCancel || autoOpen) document.getElementById(`booking-${b.ref}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [autoAmend, autoCancel, autoOpen, b.ref]);
  // The payment-link email lands on ?pay=REF — open that card's payment.
  // An offer link (?pay=REF) lands on a booking that is only OFFERED, not payable yet: open the card so Accept is visible, not a "not ready to pay" error.
  const [paying, setPaying] = useState(!!autoPay && b.status !== "Offered" && b.status !== "Waitlisted");
  const [offerBusy, setOfferBusy] = useState(false);
  // The listing this booking is on (venue/address for the row + the live
  // schedule + pass rules the amend modal needs) — fetched once at list level.
  const info = listingInfo ?? null;

  // Concrete times + staff onsite — the extra detail the old schedule showed.
  const [detail, setDetail] = useState<{ staff: { name: string }[]; periods: { title: string; start?: string; finish?: string }[] } | null>(null);
  useEffect(() => {
    if (!expanded || detail || !b.listingId) return;
    apiGet<{ library?: { staff?: { name: string }[] }; bundle?: { periods?: { title: string; start?: string; finish?: string }[] } }>(`/api/listings/${encodeURIComponent(b.listingId)}`)
      .then((l) => setDetail({ staff: l.library?.staff ?? [], periods: l.bundle?.periods ?? [] }))
      .catch(() => {});
  }, [expanded, detail, b.listingId]);
  const period = detail?.periods.find((p) => p.title === b.timing) ?? (detail?.periods.length === 1 ? detail.periods[0] : undefined);
  const times = period?.start && period?.finish ? `${period.start}–${period.finish}` : null;

  // Today's register mark, if this booking has a child expected today (d10s10:
  // there was no parent-facing read of the staff attendance mark at all).
  const cancelledStatus = b.status === "Cancelled" || b.status === "Declined";
  const [attend, setAttend] = useState<{ status: "in" | "absent" | "not_arrived"; inAt?: string | null; collectedAt?: string | null } | null>(null);
  useEffect(() => {
    if (cancelledStatus) { setAttend(null); return; }
    let live = true;
    apiGet<{ bookingRef: string; status: "in" | "absent" | "not_arrived"; inAt?: string | null; collectedAt?: string | null }[]>("/api/my/attendance")
      .then((rows) => { if (live) setAttend(rows.find((r) => r.bookingRef === b.ref) ?? null); })
      .catch(() => {});
    return () => { live = false; };
  }, [cancelledStatus, b.ref]);
  const attendLabel = attend?.status === "in"
    ? (attend.collectedAt ? t("p7bk.collectedAt", { time: new Date(attend.collectedAt).toLocaleTimeString(dl(), { hour: "numeric", minute: "2-digit" }) }) : (attend.inAt ? t("p7bk.signedInAt", { time: new Date(attend.inAt).toLocaleTimeString(dl(), { hour: "numeric", minute: "2-digit" }) }) : t("p7bk.signedIn")))
    : attend?.status === "absent" ? t("p7bk.markedAbsent")
    : attend ? t("p7bk.notSignedIn") : null;

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
  async function withdrawMove() {
    setWithdrawing(true);
    try {
      await apiPost(`/api/my/bookings/${encodeURIComponent(b.ref)}/amend/withdraw${b.tenantId ? `?tenantId=${encodeURIComponent(b.tenantId)}` : ""}`, {});
      try { localStorage.removeItem(`aos.pendingMove.${b.tenantId ?? ""}.${b.ref}`); } catch { /* ignore */ }
      refresh();
    } catch (e) { alert(e instanceof Error ? e.message : t("parent.errCancelDateChange")); }
    finally { setWithdrawing(false); }
  }
  const answerOffer = async (action: "accept-offer" | "decline-offer") => {
    setOfferBusy(true);
    try {
      await apiPost(`/api/my/bookings/${encodeURIComponent(b.ref)}/${action}${b.tenantId ? `?tenantId=${encodeURIComponent(b.tenantId)}` : ""}`, {});
      refresh();
      // The email and bell say "accept and pay": once accepted, go straight to paying.
      if (action === "accept-offer" && (b.amount ?? 0) > 0) setPaying(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : t("parent.errSomethingWrong"));
    }
    setOfferBusy(false);
  };
  const cancelled = b.status === "Cancelled" || b.status === "Declined";
  // The date-change request — pending / approved / denied. Backend is
  // authoritative; a local marker bridges "pending" only while that endpoint is
  // being built (§U). Returns the moves so the card shows the actual swaps.
  type Move = { childName?: string; from: string; to: string; approved?: boolean };
  const dateChange = useMemo<{ moves: Move[]; status: "pending" | "approved" | "denied"; reason?: string } | null>(() => {
    const be = (b as Booking & { dateChangeRequest?: { status?: "pending" | "approved" | "denied"; moves?: Move[]; reason?: string } }).dateChangeRequest;
    if (be?.status) return { moves: be.moves ?? [], status: be.status, reason: be.reason };
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(`aos.pendingMove.${b.tenantId ?? ""}.${b.ref}`);
        if (raw) return { moves: (JSON.parse(raw).moves ?? []) as Move[], status: "pending" };
      } catch { /* ignore */ }
    }
    return null;
  }, [b]);
  // Once the provider has resolved it, drop the local optimistic marker.
  useEffect(() => {
    const st = (b as Booking & { dateChangeRequest?: { status?: string } }).dateChangeRequest?.status;
    if (st && st !== "pending") { try { localStorage.removeItem(`aos.pendingMove.${b.tenantId ?? ""}.${b.ref}`); } catch { /* ignore */ } }
  }, [b]);
  const pendingMove = dateChange?.status === "pending";
  // Only prefix the child name on each swap line when the booking has more than
  // one child (otherwise it's the same name repeated).
  const dcMultiChild = !!dateChange && new Set(dateChange.moves.map((m) => m.childName).filter(Boolean)).size > 1;
  // Refund state, so a cancelled booking tells the family what came back.
  const refundAmt = b.cancel?.amount ?? 0;
  const refundIssued = b.pay === "Refunded" || b.pay === "Partially refunded" || b.cancel?.refund === "approved";
  const refundOwed = b.cancel?.refund === "full" || b.cancel?.refund === "partial" || b.cancel?.refund === "pending";
  // Same rule as the server: confirmed places and operator invoices. A voucher
  // booking is paid OUTSIDE the app (through the scheme), then the provider
  // marks the money in — so no in-app card "Pay" button for it.
  const payable =
    b.pay !== "Paid" && b.pay !== "Refund pending" && b.pay !== "Refunded" && b.pay !== "Awaiting voucher payment" &&
    (b.status === "Confirmed" || b.pay === "Invoice sent") && owedOf(b) > 0.005;

  const kidNames = (b.kids && b.kids.length ? b.kids.map((k) => k.name) : [b.child]).filter(Boolean);
  // A basket of many children used to build "T & T & T & T …": a wide badge that squeezed the names column to one letter per line. Show two initials and "+N".
  const initials = kidInitials(kidNames);
  const loc = { location: venue?.location ?? info?.location ?? null, address: venue?.address ?? info?.address ?? null, city: venue?.city ?? info?.city ?? null };
  const sessCount = b.sessions?.length || b.days?.length || 0;
  const childCount = b.kids?.length || 1;

  return (
    <Card id={`booking-${b.ref}`} className="overflow-hidden p-0" style={{ boxShadow: "0 12px 28px -18px rgba(20,35,90,.4)" }}>
      {/* Identity hero row — colour = booking status (matches operator list) */}
      <div className="flex flex-col items-stretch sm:flex-row">
        <div onClick={() => setExpanded((x) => !x)} className="relative flex w-full flex-none cursor-pointer items-center gap-2.5 p-3 text-white sm:w-[210px] sm:p-2.5" style={{ background: pHeroGrad(b.status) }}>
          <span className={`flex h-9 min-w-9 flex-none items-center justify-center rounded-xl bg-white/25 px-1.5 font-extrabold ring-1 ring-white/25 ${kidNames.length > 1 ? "text-[11px]" : "text-[15px]"}`} style={{ textShadow: "0 1px 2px rgba(0,0,0,.3)" }}>
            {initials}
          </span>
          <div className="min-w-0">
            <div className="text-[16px] font-extrabold leading-[1.15] [overflow-wrap:anywhere] sm:text-[13.5px]" style={{ fontFamily: "var(--ff-display)", textShadow: "0 1px 3px rgba(0,0,0,.3)" }}>{kidNames.join(" & ") || "—"}</div>
            <div className="truncate text-[12px] text-white/85 sm:text-[10px]" style={{ textShadow: "0 1px 2px rgba(0,0,0,.25)" }}>{t("p8par.mbRef", { ref: b.ref })}</div>
          </div>
        </div>
        <div onClick={() => setExpanded((x) => !x)} className="flex flex-1 cursor-pointer flex-wrap items-center gap-x-4 gap-y-2.5 overflow-hidden px-4 py-3 hover:bg-[var(--panel)] sm:gap-y-1 sm:py-2">
          <PCol label={t("parent.listingCol")} w="w-full min-w-[120px] sm:w-auto sm:flex-1">
            <span className="block text-[15px] font-extrabold leading-tight text-[var(--ink)] [overflow-wrap:anywhere] sm:text-[12.5px]" title={b.listing}>{b.listing || "—"}</span>
            {b.serviceAddress?.address || b.serviceAddress?.postcode ? (
              <span className="block text-[11px] font-semibold text-[var(--ink-2)]">{t("p8par.mbComeToYou", { addr: visitAddressLabel(b.serviceAddress) })}</span>
            ) : (<>
              {loc.location && <span className="block text-[11px] font-semibold text-[var(--ink-2)]">📍 {loc.location}</span>}
              {(loc.address || loc.city) && <span className="block text-[10.5px] text-[var(--ink-3)]">{[loc.address, loc.city].filter(Boolean).join(", ")}</span>}
            </>)}
          </PCol>
          <PCol label={t("parent.datesCol")} w="w-[150px]"><span className="text-[12.5px] font-extrabold text-[var(--ink)]">{bookingDateSummary(b, (date) => tNow("p7parent.startsOn", { date }))}</span><span className="block text-[10.5px] font-semibold text-[var(--ink-3)]">{pickPlural(t, locale, "p7bk.sessN", sessCount)} · {pickPlural(t, locale, "p7bk.kidN", childCount)}{sessCount > 1 ? " · " + t("p7bk.tapViewAll") : ""}</span></PCol>
          <PCol label={t("parent.statusCol")} w="w-[104px]"><span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-extrabold" style={pendingMove ? { background: "#fdf3d8", color: "#8a5300" } : { background: pHeroTone(b.status).bg, color: pHeroTone(b.status).fg }}>{pendingMove ? t("parent.dateChangeStatus") : w(b.status)}</span></PCol>
          {!cancelled && <PCol label={t("parent.paymentCol")} w="w-[104px]"><span className="inline-flex max-w-full whitespace-normal rounded-xl px-2.5 py-[3px] text-[11px] font-extrabold leading-tight" style={{ background: payTone(b.pay).bg, color: payTone(b.pay).fg }}>{w(payLabelFor(b))}</span></PCol>}
          {attendLabel && <PCol label={t("p7bk.todayCol")} w="w-[130px]"><span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-extrabold" style={attend?.status === "in" ? { background: "#dcfce7", color: "#166534" } : attend?.status === "absent" ? { background: "#fee2e2", color: "#991b1b" } : { background: "var(--panel)", color: "var(--ink-3)" }}>{attendLabel}</span></PCol>}
          <div className="ms-auto flex-none text-end">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)] sm:text-[8.5px]">{t("parent.amountCol")}</div>
            <div className="text-[18px] sm:text-[15px] font-extrabold text-[var(--ink)]">{money(b.amount)}</div>
            {mealRows.length > 0 && <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-[#fff3e0] px-2 py-[2px] text-[10.5px] font-extrabold text-[#96631a]">🍽 {pickPlural(t, locale, "p7bk.mealN", mealRows.length)} · {money(mealTotal)}</div>}
          </div>
          <span className={`flex-none text-[13px] text-[var(--ink-3)] transition-transform ${expanded ? "rotate-180" : ""}`} title={expanded ? t("parent.close") : t("p7bk.openWord")}>▾</span>
        </div>
      </div>

      <div className="px-4 pb-4 pt-1">
      {clash && !cancelled && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12px] font-semibold text-[#c0392b]">
          <span aria-hidden>⚠️</span>
          <span>{t("parent.clashWarning", { child: b.child })}</span>
        </div>
      )}

      {dateChange?.status === "pending" && (
        <div className="mt-2 rounded-lg border border-[#fde3a7] bg-[#fdf3d8] px-3 py-2 text-[12px] text-[#8a5300]">
          <div className="font-bold">{t("parent.dateChangePending")}</div>
          {dateChange.moves.length > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5">
              {dateChange.moves.map((m, i) => (
                <li key={i} className="font-semibold">{dcMultiChild && m.childName ? `${m.childName}: ` : ""}<Rich text={t("p8par.mbMoveFromTo", { from: fmtIso(m.from), to: fmtIso(m.to) })} /></li>
              ))}
            </ul>
          )}
          <div className="mt-1 text-[11px] text-[#8a5300]/80">{pickPlural(t, locale, "p8par.mbOnceApprove", dateChange.moves.length)}</div>
        </div>
      )}

      {dateChange?.status === "approved" && (() => {
        // A request can be partly approved — some dates moved, some declined.
        const approved = dateChange.moves.filter((m) => m.approved !== false);
        const declined = dateChange.moves.filter((m) => m.approved === false);
        return (
          <div className="mt-2 rounded-lg border border-[#cfe9d8] bg-[#eef8f1] px-3 py-2 text-[12px] text-[#0f7a43]">
            <div className="font-bold">✓ {declined.length ? t("parent.someDatesMoved") : t("parent.dateChangeApproved")}</div>
            {approved.length > 0 && (
              <ul className="mt-1 flex flex-col gap-0.5">
                {approved.map((m, i) => (
                  <li key={i} className="font-semibold">{dcMultiChild && m.childName ? `${m.childName}: ` : ""}{fmtIso(m.from)} <span className="inline-block rtl:-scale-x-100">→</span> <b>{fmtIso(m.to)}</b></li>
                ))}
              </ul>
            )}
            {declined.length > 0 && (
              <div className="mt-1.5 border-t border-[#cfe9d8] pt-1.5 text-[#8a5300]">
                <div className="font-bold">{t("parent.notMoved")}</div>
                <ul className="flex flex-col gap-0.5">
                  {declined.map((m, i) => <li key={i} className="font-semibold">{dcMultiChild && m.childName ? `${m.childName}: ` : ""}{t("p8par.mbKept", { date: fmtIso(m.from) })}</li>)}
                </ul>
                {dateChange.reason && <div className="mt-0.5 text-[11.5px]">{t("p8par.mbReason", { reason: dateChange.reason })}</div>}
              </div>
            )}
          </div>
        );
      })()}

      {dateChange?.status === "denied" && (
        <div className="mt-2 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12px] text-[#c0392b]">
          <div className="font-bold">{t("parent.dateChangeDeclined")}</div>
          {dateChange.reason && <div className="mt-0.5 text-[11.5px] text-[#8a3a3a]">{t("p8par.mbReason", { reason: dateChange.reason })}</div>}
        </div>
      )}

      {cancelled && !pendingMove && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-2)]">
          <span aria-hidden className="text-[#c0392b]">✕</span>
          <span>
            <b className="text-[var(--ink)]">{w("Cancelled")}</b>{b.cancel?.on ? " · " + t("p7bk.requestedOn", { date: b.cancel.on }) : ""}
            {refundIssued ? (
              <> — <b className="text-[var(--brand)]">{isVoucher ? t("p7bk.refundedVoucher", { amt: money(refundAmt || b.amount) }) : b.cancel?.refundTo === "wallet" ? t("p7bk.refundedWallet", { amt: money(refundAmt || b.amount) }) : t("p7bk.refundedCard", { amt: money(refundAmt || b.amount) })}</b>.{!isVoucher && b.cancel?.refundTo !== "wallet" && <> {t("p7bk.refundTiming")}</>}</>
            ) : refundOwed && refundAmt > 0 ? (
              <> — <Rich text={isVoucher ? t("p7bk.refundDueVoucher", { amt: money(refundAmt) }) : t("p7bk.refundDueCard", { amt: money(refundAmt) })} />{!isVoucher && b.cancel?.refundTo !== "wallet" && <> {t("p7bk.refundTiming")}</>}</>
            ) : (
              <> — {t("p7bk.noRefundWasDue")}</>
            )}
          </span>
        </div>
      )}

      <BankTransferBox b={b} />

      <div className="mt-2 flex flex-wrap gap-2 max-sm:[&_button]:min-h-[44px] max-sm:[&_button]:text-[14px]">
        {payable && (
          <Button sm variant="primary" className="max-sm:w-full" onClick={() => setPaying(true)}>
            {t("parent.payAmount", { amount: money(owedOf(b)) })}
          </Button>
        )}
        <Button sm onClick={() => setExpanded((x) => !x)}>
          {expanded ? t("parent.hideDetails") : t("parent.details")}
        </Button>
        {(b.status === "Confirmed" || b.status === "Approval needed") && (
          <Button sm onClick={() => setAmending(true)}>
            {pendingMove ? t("parent.editDateChange") : t("parent.changeDatesBtn")}
          </Button>
        )}
        {pendingMove && (
          <Button sm disabled={withdrawing} onClick={withdrawMove}>
            {withdrawing ? t("parent.cancelling") : t("parent.cancelDateChange")}
          </Button>
        )}
        {!cancelled && (
          <Button sm variant="cta" onClick={() => setCancelling((x) => !x)}>
            {t("parent.cancelBookingBtn")}
          </Button>
        )}
      </div>
      {pendingMove && !cancelling && (
        <div className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">{t("parent.pendingMoveNote")}</div>
      )}

      {amending && <AmendModal booking={b} listing={info} onDone={(changed) => { setAmending(false); if (changed) refresh(); }} />}

      {b.status === "Offered" && (
        <div className="mt-2 rounded-lg border border-[#fde3a7] bg-[#fdf3d8] px-3 py-2.5 text-[12.5px] text-[#7a5200]">
          <b>{t("parent.placeOpenedUp")}</b> {t("parent.placeHeldFor")}
          {b.offerExpiresAt ? ` ${t("parent.until", { time: new Date(b.offerExpiresAt).toLocaleTimeString(dl(), { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) })}` : ""} —
          {t("parent.acceptOrPasses")}
          <div className="mt-2 flex gap-2">
            <Button sm variant="primary" disabled={offerBusy} onClick={() => answerOffer("accept-offer")}>
              {t("parent.acceptPlace")}
            </Button>
            <Button sm disabled={offerBusy} onClick={() => answerOffer("decline-offer")}>
              {t("parent.giveItUp")}
            </Button>
          </div>
        </div>
      )}

      {paying && <PayModal refs={[b.ref]} tenantId={b.tenantId} onClose={() => setPaying(false)} onPaid={refresh} />}

      {expanded && (
        <div className="mt-2">
          <SectionHead>{t("parent.bookingSection")}</SectionHead>
          <DefRow label={t("parent.childDefLabel")} value={b.child} />
          <DefRow label={t("parent.passLabel")} value={b.pass} />
          {b.timing && <DefRow label={t("parent.timing")} value={b.timing} />}
          {(loc.location || loc.address || times || b.serviceAddress || (detail?.staff && detail.staff.length > 0)) && (
            <>
              <SectionHead>{t("parent.whereWhen")}</SectionHead>
              {b.serviceAddress?.address || b.serviceAddress?.postcode ? (
                <div className="py-[4px] text-[12.5px] font-semibold">{t("p8par.mbComeToYou", { addr: visitAddressLabel(b.serviceAddress) })}</div>
              ) : (<>
                {loc.location && <div className="py-[4px] text-[12.5px] font-semibold">{venue?.online ? "💻" : "📍"} {loc.location}</div>}
                {venue?.online && (
                  <div className="my-1 rounded-xl border-2 border-[#2f6bd8] bg-[#eef4ff] p-3 text-[12.5px]">
                    <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#1d3a8f]">{t("p7pg.howToJoin")}</div>
                    <div className="mt-1 whitespace-pre-line font-semibold text-[var(--ink)]">{venue.joinInfo || t("p9tx.joinLater")}</div>
                  </div>
                )}
                {!venue?.online && (loc.address || loc.city) && (
                  <div className="pb-[4px] text-[12px] text-[var(--ink-3)]">{[loc.address, loc.city].filter(Boolean).join(" · ")}</div>
                )}
              </>)}
              {(b.sessions ?? []).length > 0 && (
                <div className="py-[2px] text-[12.5px] font-semibold">📅 {(b.sessions ?? []).length === 1 ? (b.sessions ?? [])[0].split(" · ")[0] : `${(b.sessions ?? [])[0].split(" · ")[0]} to ${(b.sessions ?? [])[(b.sessions ?? []).length - 1].split(" · ")[0]}`}</div>
              )}
              {times && <div className="py-[2px] text-[12.5px]">🕒 {times}</div>}
              {detail?.staff && detail.staff.length > 0 && (
                <div className="py-[2px] text-[12.5px]">👤 {t("parent.staffOnsite")} {detail.staff.map((s) => s.name).join(", ")}</div>
              )}
            </>
          )}
          <SectionHead>{t("parent.sessionsSection")}</SectionHead>
          {(b.sessions || []).map((s, i) => (
            <div key={i} className="border-b border-dashed border-[var(--line)] py-[4px] text-[12.5px]">
              {s}
            </div>
          ))}
          {/* Extras — the true add-ons (meal lines are pulled out into their
              own section below so they don't double up). */}
          {(() => { const extras = addonLinesFor(b).filter((a) => !a.startsWith("🍽")); return extras.length > 0 && (
            <>
              <SectionHead>{t("parent.addOns")}</SectionHead>
              {extras.map((a, i) => <div key={i} className="border-b border-dashed border-[var(--line)] py-[4px] text-[12.5px]">{a}</div>)}
            </>
          ); })()}
          {mealRows.length > 0 && (
            <>
              <SectionHead>{t("parent.mealsSection")}</SectionHead>
              {mealRows.map((m, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2 border-b border-dashed border-[var(--line)] py-[4px] text-[12.5px]">
                  <span>
                    <span className="me-1">🍽</span><b>{m.name}</b>
                    <span className="text-[var(--ink-3)]"> · {new Date(`${m.date}T00:00:00Z`).toLocaleDateString(dl(), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}{m.child ? ` · ${m.child}` : ""}</span>
                    {m.later && <span className="ms-1 rounded bg-[#eef4fd] px-1 py-[0.5px] text-[9.5px] font-bold uppercase tracking-[0.03em] text-[var(--brand-2)]">{t("parent.addedLater")}</span>}
                  </span>
                  {m.price > 0 && <span className="tabular-nums text-[var(--ink-2)]">{money(m.price)}</span>}
                </div>
              ))}
            </>
          )}
          <SectionHead>{t("parent.paymentSection")}</SectionHead>
          <DefRow label={t("parent.methodLabel")} value={b.method} />
          {(b.discountOff ?? 0) > 0 && b.listPrice != null && (
            <>
              <DefRow label={t("p9tx.ckPriceBefore")} value={money(b.listPrice)} />
              <DefRow label={b.discountNames?.length ? t("p9tx.ckDiscountWith", { names: b.discountNames.join(", ") }) : t("p9tx.ckDiscount")} value={`− ${money(b.discountOff ?? 0)}`} />
            </>
          )}
          <DefRow label={t("parent.totalLabel")} value={money(b.amount)} />
          {/* Voucher payment received — the provider reconciled the money. */}
          {!cancelled && isVoucher && b.pay === "Paid" && (
            <div className="mt-2 rounded-lg border border-[#bfe6cd] bg-[#eaf0fc] px-3 py-2.5 text-[12.5px] font-semibold text-[var(--brand)]">
              {vScheme ? t("p8par.mbVoucherPaidVia", { scheme: vScheme.name }) : t("p8par.mbVoucherPaid")}
            </div>
          )}
          {/* Still awaiting the voucher money — how to pay it. */}
          {!cancelled && b.pay === "Awaiting voucher payment" && vScheme && filledDetails(vScheme).length > 0 && (
            <div className="mt-2 rounded-lg border border-[var(--brand-line,#cdddf7)] bg-[var(--brand-soft,#eaf0fc)] p-3">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--brand-ink,var(--brand))]">{t("p8par.mbPayBy", { scheme: vScheme.name })}</div>
              <div className="mt-0.5 text-[11.5px] leading-[1.5] text-[var(--ink-2)]">
                <Rich text={t("p8par.mbVoucherSend", { amount: money(b.amount), scheme: vScheme.name })} />
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
              <SectionHead>{t("parent.cancellationSection")}</SectionHead>
              <DefRow label={t("parent.requestedLabel")} value={b.cancel.on} />
              <DefRow label={t("parent.refundLabel")} value={b.cancel.refund ?? "—"} />
              {b.cancel.msg && <DefRow label={t("parent.messageLabel")} value={b.cancel.msg} />}
            </>
          )}
        </div>
      )}

      {cancelling && !cancelled && (
        <CancelRequest
          booking={b}
          listing={info}
          hasPendingMove={pendingMove}
          onDone={() => {
            setCancelling(false);
            refresh();
          }}
        />
      )}
      </div>
    </Card>
  );
}

/** custdash/bookings — the signed-in parent's own bookings. */
// 1 -> "1st", 2 -> "2nd" (English); other languages get "#2".
const placeInLine = (n: number) => {
  if (!dl().toLowerCase().startsWith("en")) return `#${n}`;
  const v = n % 100;
  return `${n}${["th", "st", "nd", "rd"][(v - 20) % 10] ?? ["th", "st", "nd", "rd"][v] ?? "th"}`;
};

// A waitlisted place, shown up front so a parent can see exactly which dates
// and times they're queued for — not buried in the general list.
function WaitlistCard({ b, refresh, focus }: { b: Booking; refresh: () => void; focus?: boolean }) {
  const t = useT();
  // Arrived from the home page / a notification for THIS booking: bring it into view and ring it.
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (focus) cardRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [focus]);
  const [busy, setBusy] = useState(false);
  const leave = async () => {
    if (!confirm(t("parent.leaveWaitlistConfirm", { listing: b.listing }))) return;
    setBusy(true);
    try {
      await apiPost(`/api/my/bookings/${encodeURIComponent(b.ref)}/cancel${b.tenantId ? `?tenantId=${encodeURIComponent(b.tenantId)}` : ""}`, {});
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : t("parent.errLeaveWaitlist"));
      setBusy(false);
    }
  };
  return (
    <div ref={cardRef} data-ui="card" className="rounded-xl border border-[#fed7aa] bg-[#fff7ed] p-3.5" style={focus ? { boxShadow: "0 0 0 3px #f59e0b", scrollMarginTop: 80 } : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[14px] font-extrabold text-[#9a3412]">{b.listing}</div>
          <div className="text-[12px] text-[#b45309]">{b.child} · {b.pass}</div>
        </div>
        <Badge tone={{ bg: "#fed7aa", fg: "#9a3412" }}>{t("parent.onWaitingList")}</Badge>
      </div>
      {/* The exact dates + timings — each session string already carries both. */}
      <div className="mt-2 rounded-lg bg-white/70 px-2.5 py-1.5">
        <div className="text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[#b45309]">{t("parent.waitingFor")}</div>
        {(b.sessions && b.sessions.length ? b.sessions : [b.dates]).map((s, i) => (
          <div key={i} className="text-[12.5px] font-semibold text-[#7c2d12]">{s}</div>
        ))}
      </div>
      {b.waitlist && b.waitlist.length > 0 && (
        <div className="mt-2 rounded-lg bg-white/70 px-2.5 py-1.5">
          {b.waitlist.map((w) => (
            <div key={w.date} className="text-[12.5px] font-extrabold text-[#7c2d12]">{t("parent.queueLine", { place: placeInLine(w.position), date: fmtIso(w.date) })}</div>
          ))}
          <div className="mt-0.5 text-[11px] leading-[1.5] text-[#b45309]">{b.waitlistMode === "auto" ? t("parent.queueAuto") : t("parent.queueManual")}</div>
        </div>
      )}
      <div className="mt-2 text-[11px] leading-[1.5] text-[#b45309]">
        {t("parent.waitlistNote")}
      </div>
      <Button sm className="mt-2" disabled={busy} onClick={leave}>{busy ? t("parent.leaving") : t("parent.leaveWaitlist")}</Button>
    </div>
  );
}

const PARENT_TAB_TONE: Record<string, string> = { all: "#1d3a8f", topay: "#c2410c", upcoming: "#15803d", past: "#0e7490", cancelled: "#b91c1c" };
type BookingFilter = "all" | "topay" | "upcoming" | "past" | "cancelled";

// Meals ordered from the Meals area after booking — folded back onto the
// booking they belong to (same listing, a booked day, one of its children).
interface MealOrder { id: string; listingId?: string; childName: string; date: string; status?: string; items?: { name: string; price: number; qty: number }[] }
const splitKidNames = (s?: string) => (s ?? "").split(/,|&/).map((x) => x.trim()).filter(Boolean);

export function MyBookingsApp({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const tr = useT();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [mealOrders, setMealOrders] = useState<MealOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  // The dashboard's "to pay" card links here with ?filter=topay so the family lands on just what is still owing.
  const [filter, setFilter] = useState<BookingFilter>(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("filter") === "topay" ? "topay" : "all"));
  const [waitOpen, setWaitOpen] = useState<boolean | null>(null); // null = automatic: collapsed above other bookings, open when the waiting list is all the family has
  const [childF, setChildF] = useState("");
  const [listingF, setListingF] = useState("");
  const [fromF, setFromF] = useState("");
  const [toF, setToF] = useState("");
  const [kidsSex, setKidsSex] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    apiGet<Booking[]>("/api/my/bookings")
      .then(setBookings)
      .catch((e) => setError(e instanceof Error ? e.message : tr("p7bk.errLoadBookings")));
    apiGet<MealOrder[]>("/api/meal-orders").then(setMealOrders).catch(() => {});
  }, []);

  // Attach each live meal order to the one booking it belongs to (same listing,
  // a day that booking covers, one of its children). An order lands on a single
  // booking — first match wins.
  const ordersByRef = useMemo(() => {
    const live = mealOrders.filter((o) => o.status !== "cancelled");
    const map = new Map<string, MealOrder[]>();
    for (const o of live) {
      const b = (bookings ?? []).find((bk) => bk.listingId && bk.listingId === o.listingId && (bk.days ?? []).includes(o.date) && new Set([...splitKidNames(bk.child), ...((bk.kids ?? []).map((k) => k.name))]).has(o.childName));
      if (!b) continue;
      const a = map.get(b.ref) ?? []; a.push(o); map.set(b.ref, a);
    }
    return map;
  }, [mealOrders, bookings]);

  useEffect(refresh, [refresh]);
  useRealtime(["bookings", "mealOrders"], refresh);
  // The family's children, coloured by gender for the per-child pill filter.
  useEffect(() => {
    apiGet<{ name: string; sex?: string }[]>("/api/my/children")
      .then((cs) => setKidsSex(Object.fromEntries((cs ?? []).map((c) => [c.name.trim(), (c.sex ?? "").toLowerCase()]))))
      .catch(() => {});
  }, []);
  // The full listing detail per booked listing (matched by listingId — reliable,
  // and it carries the blocks+session availability the amend flow needs plus the
  // venue for the row). Blocks live in a separate collection, so ?tenantId= list
  // rows don't have them — /api/listings/:id (withBlocks) does, even for
  // archived listings.
  type ListingDetail = AmendListing & { library?: { venue?: { name?: string; address?: string; city?: string } | null } };
  const [detailById, setDetailById] = useState<Record<string, ListingDetail>>({});
  // Each listing is asked for ONCE, live bookings' listings first, four at a time. This effect used to depend on `detailById` too, so every
  // response re-ran it and re-requested every listing still in flight: a family with ~65 past listings fired hundreds of GETs, filled the
  // browser's 6 sockets per origin, and the refetch after "Accept the place" queued behind them for 15s+ (the card kept showing the offer).
  const askedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const live = (b: Booking) => b.status !== "Cancelled" && b.status !== "Declined";
    const ordered = [...(bookings ?? [])].sort((a, b) => Number(live(b)) - Number(live(a)));
    const ids = [...new Set(ordered.map((b) => b.listingId).filter(Boolean) as string[])].filter((id) => !askedRef.current.has(id));
    ids.forEach((id) => askedRef.current.add(id));
    const queue = [...ids];
    const worker = async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        try { const l = await apiGet<ListingDetail>(`/api/listings/${encodeURIComponent(id)}`); setDetailById((m) => ({ ...m, [id]: l })); }
        catch { askedRef.current.delete(id); /* a later bookings refresh may try again */ }
      }
    };
    for (let i = 0; i < Math.min(4, ids.length); i++) void worker();
  }, [bookings]);
  const listingOf = (b: Booking): AmendListing | null => (b.listingId ? detailById[b.listingId] ?? null : null);
  const venueOf = (b: Booking) => {
    const v = b.listingId ? detailById[b.listingId]?.library?.venue : null;
    const ex = v as unknown as { kind?: string; directions?: string } | null;
    return v ? { location: v.name ?? null, address: v.address ?? null, city: v.city ?? null, ...(ex?.kind === "online" ? { online: true, joinInfo: (ex.directions ?? "").trim() || null } : {}) } : undefined;
  };
  // The payment-link email deep-links here as ?pay=REF; the schedule's
  // "Edit booking" deep-links as ?amend=REF (auto-opens the Change-dates flow).
  const params = useSearchParams();
  const payRef = params.get("pay");
  const amendRef = params.get("amend");
  const cancelRef = params.get("cancel");
  const openRef = params.get("open"); // deep-link from a notification — just open the card

  if (error) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!bookings)
    return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">{tr("parent.loadingBookings")}</div>;

  return (
    <div className="text-[var(--ink)]">
      <OnlineSessionsPanel />
      {!hideHeader && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
              {tr("parent.myBookings")}
            </h2>
            <p className="text-[12.5px] text-[var(--ink-3)]">
              {tr("parent.myBookingsLede")}
            </p>
          </div>
          <Link href="/custdash/browse">
            <Button variant="primary">{tr("parent.bookActivity")}</Button>
          </Link>
        </div>
      )}
      {(() => {
        const waiting = bookings.filter((b) => b.status === "Waitlisted");
        const rest = bookings.filter((b) => b.status !== "Waitlisted");
        if (bookings.length === 0)
          return (
            <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
              {tr("parent.noBookingsYet")}{" "}
              <Link href="/custdash/browse" className="font-bold text-[var(--brand-2)]">{tr("parent.browseActivitiesLink")}</Link> {tr("parent.toGetStarted")}
            </Card>
          );

        // Opened from the home page's waiting-list card (or a notification): show THAT waiting-list place on its own, not the whole bookings page.
        const focusWait = openRef ? waiting.find((b) => b.ref === openRef) : undefined;
        if (focusWait)
          return (
            <div className="flex flex-col gap-3">
              <WaitlistCard key={`${focusWait.tenantId}-${focusWait.ref}`} b={focusWait} refresh={refresh} />
              <Link href="/custdash/bookings" className="text-[13px] font-bold text-[var(--brand-2)]">&larr; {tr("parent.myBookings")}</Link>
            </div>
          );

        const todayIso = new Date().toISOString().slice(0, 10);
        const isCancelled = (b: Booking) => b.status === "Cancelled" || b.status === "Declined";
        const lastDay = (b: Booking) => [...(b.days ?? [])].sort().at(-1) ?? "";
        const isPast = (b: Booking) => !isCancelled(b) && !!lastDay(b) && lastDay(b) < todayIso;
        const isUpcoming = (b: Booking) => !isCancelled(b) && !isPast(b);
        // Still to pay: a live (not cancelled, not waitlisted) booking with money owing.
        const isToPay = (b: Booking) => !isCancelled(b) && (b.status === "Confirmed" || b.pay === "Invoice sent") && owedOf(b) > 0.005;
        const match = (b: Booking) =>
          filter === "all" ? true
          : filter === "topay" ? isToPay(b)
          : filter === "upcoming" ? isUpcoming(b)
          : filter === "past" ? isPast(b)
          : isCancelled(b);

        // Child / activity / date-range filters (shared shape with Payments).
        const childOptions = [...new Set(bookings.flatMap((b) => (b.kids && b.kids.length ? b.kids.map((k) => k.name) : [b.child])).filter(Boolean) as string[])].sort();
        const listingOptions = [...new Set(bookings.map((b) => b.listing).filter(Boolean))].sort();
        const inRange = (b: Booking) => {
          if (!fromF && !toF) return true;
          const ds = b.days ?? [];
          if (!ds.length) return true;
          return ds.some((d) => (!fromF || d >= fromF) && (!toF || d <= toF));
        };
        const passF = (b: Booking) =>
          (!childF || b.child === childF || (b.kids ?? []).some((k) => k.name === childF)) &&
          (!listingF || b.listing === listingF) &&
          inRange(b);
        const filtersOn = !!(childF || listingF || fromF || toF);
        const restF = rest.filter(passF);

        // Flag a child double-booked on the same day (across all bookings, not
        // just the filtered view) — the schedule's overlap warning, per card.
        const clashRefs = new Set<string>();
        {
          const byChildDay = new Map<string, string[]>();
          for (const bk of rest) {
            if (isCancelled(bk)) continue;
            const names = bk.kids && bk.kids.length ? bk.kids.map((k) => k.name) : [bk.child];
            for (const nm of names) for (const day of bk.days ?? []) {
              const key = `${nm}|${day}`;
              byChildDay.set(key, [...(byChildDay.get(key) ?? []), bk.ref]);
            }
          }
          for (const refs of byChildDay.values()) if (new Set(refs).size > 1) refs.forEach((r) => clashRefs.add(r));
        }

        const counts = {
          all: restF.length,
          topay: restF.filter(isToPay).length,
          upcoming: restF.filter(isUpcoming).length,
          past: restF.filter(isPast).length,
          cancelled: restF.filter(isCancelled).length,
        };
        const shown = restF.filter(match);
        const tabs: { key: BookingFilter; label: string }[] = [
          { key: "all", label: tr("parent.tabAll") },
          { key: "topay", label: tr("p9tx.mbStillToPay") },
          { key: "upcoming", label: tr("parent.tabUpcoming") },
          { key: "past", label: tr("parent.tabPast") },
          { key: "cancelled", label: tr("parent.tabCancelledRefunded") },
        ];

        const waitShown = waitOpen ?? rest.length === 0;
        return (
          <>
            {waiting.length > 0 && (
              <div className="mb-5 overflow-hidden rounded-2xl border border-[var(--brand-line,#cdddf7)] shadow-[0_1px_3px_rgba(20,30,60,.06)]">
                <button
                  type="button"
                  onClick={() => setWaitOpen(!waitShown)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start text-white"
                  style={{ background: "radial-gradient(120% 140% at 12% -20%, #4f8bf5 0%, transparent 55%), linear-gradient(120deg,var(--brand-strong) 0%,var(--brand-2) 100%)" }}
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white/20 text-[14px]">⏳</span>
                    <span>
                      <span className="block text-[14px] font-extrabold">{tr("parent.myWaitingList")}</span>
                      <span className="block text-[11px] text-white/85">{tr("parent.waitlistHeaderSub")}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-[12px] font-bold">
                    <span className="rounded-full bg-white/20 px-2 py-0.5">{waiting.length}</span>
                    <span className={`transition-transform ${waitShown ? "rotate-180" : ""}`}>▾</span>
                  </span>
                </button>
                {waitShown && (
                  <div className="flex flex-col gap-2.5 bg-[var(--surface)] p-3">
                    {waiting.map((b) => <WaitlistCard key={`${b.tenantId}-${b.ref}`} b={b} refresh={refresh} focus={b.ref === openRef} />)}
                  </div>
                )}
              </div>
            )}
            {rest.length > 0 && (
              <>
                {waiting.length > 0 && <SectionHead>{tr("parent.myBookings")}</SectionHead>}
                {childOptions.length > 1 && (
                  <div className="mb-3 -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&_button]:shrink-0 [&_button]:whitespace-nowrap">
                    <button type="button" onClick={() => setChildF("")} className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
                      style={!childF ? { borderColor: "var(--brand)", background: "var(--brand)", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
                      {tr("parent.allChildren")}
                    </button>
                    {childOptions.map((name) => {
                      const t = genderTone(kidsSex[name]);
                      const on = childF === name;
                      return (
                        <button key={name} type="button" onClick={() => setChildF(on ? "" : name)} className="rounded-full border-2 px-3.5 py-1.5 text-[12.5px] font-extrabold transition-colors"
                          style={on ? { borderColor: t.on, background: t.on, color: "#fff" } : { borderColor: t.bg, background: t.bg, color: t.fg }}>
                          {name}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="mb-3 grid grid-cols-2 items-end gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 sm:flex sm:flex-wrap">
                  <label className="col-span-2 flex flex-col gap-1 sm:col-auto">
                    <span className="text-[12px] sm:text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{tr("parent.activityFilterLabel")}</span>
                    <select value={listingF} onChange={(e) => setListingF(e.target.value)} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[14px] sm:w-auto sm:max-w-[190px] sm:py-1.5 sm:text-[12.5px]">
                      <option value="">{tr("parent.allActivities")}</option>
                      {listingOptions.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)] sm:text-[10px]">{tr("parent.fromLabel")}</span>
                    <input type="date" value={fromF} onChange={(e) => setFromF(e.target.value)} className="w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[14px] sm:w-auto sm:py-1.5 sm:text-[12.5px]" />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)] sm:text-[10px]">{tr("parent.toLabel")}</span>
                    <input type="date" value={toF} onChange={(e) => setToF(e.target.value)} className="w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[14px] sm:w-auto sm:py-1.5 sm:text-[12.5px]" />
                  </label>
                  {filtersOn && (
                    <button onClick={() => { setChildF(""); setListingF(""); setFromF(""); setToF(""); }} className="col-span-2 py-2 sm:col-auto sm:py-1.5 text-[12px] font-bold text-[var(--ink-3)] hover:underline">
                      {tr("parent.clearBtn")}
                    </button>
                  )}
                </div>
                <div className="mb-3.5 -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&_button]:shrink-0 [&_button]:whitespace-nowrap">
                  {tabs.filter((t) => t.key === "all" || counts[t.key] > 0).map((t) => {
                    const active = filter === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setFilter(t.key)}
                        className="cursor-pointer rounded-full border-2 px-3.5 py-1.5 text-[13px] font-extrabold transition-colors hover:brightness-95"
                        style={active
                          ? { borderColor: PARENT_TAB_TONE[t.key], background: PARENT_TAB_TONE[t.key], color: "#fff", boxShadow: `0 4px 12px ${PARENT_TAB_TONE[t.key]}55` }
                          : { borderColor: PARENT_TAB_TONE[t.key], background: `${PARENT_TAB_TONE[t.key]}12`, color: PARENT_TAB_TONE[t.key] }}
                      >
                        {t.label}
                        <span className={active ? "ms-1.5 opacity-80" : "ms-1.5 text-[var(--ink-3)]"}>{counts[t.key]}</span>
                      </button>
                    );
                  })}
                </div>
                {shown.length === 0 ? (
                  <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{filtersOn ? tr("parent.noBookingsMatch") : tr("parent.nothingHereRightNow")}</Card>
                ) : (
                  <div className="flex flex-col gap-3">
                    {shown.map((b) => (
                      <BookingCard key={`${b.tenantId}-${b.ref}`} b={b} refresh={refresh} autoPay={b.ref === payRef} autoAmend={b.ref === amendRef} autoCancel={b.ref === cancelRef} autoOpen={b.ref === openRef} clash={clashRefs.has(b.ref)} listingInfo={listingOf(b)} venue={venueOf(b)} mealOrders={ordersByRef.get(b.ref) ?? []} />
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
