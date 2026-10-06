"use client";

import { usePathname } from "next/navigation";
import { portalOf } from "@/lib/portal-href";
import { dateLocale as dl } from "@/lib/i18n/format";
import { useCallback, useEffect, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Badge, Button, Card } from "@/components/ui";
import { useT, useWord } from "@/lib/i18n/provider";
import { EmbeddedOnboarding } from "./EmbeddedOnboarding";

// ─────────────────────────────────────────────────────────────────────────
// Finance — v1 is the payments slice: connect the tenant's own Stripe
// account (Express onboarding — the money always lands with the provider,
// never Name TBC) and the tenant's payment & refund records. Analytics,
// payouts and reconciliation come in later milestones; Kaz will restyle.
// ─────────────────────────────────────────────────────────────────────────

interface Status {
  connected: boolean;
  accountId?: string;
  chargesEnabled?: boolean;
  detailsSubmitted?: boolean;
  payoutsEnabled?: boolean;
  platformFallback?: boolean;
}
interface PaymentRecord {
  id: string;
  /** Booking refs — absent on invoice pay-link records (kind: "invoice"). */
  refs?: string[];
  kind?: string;
  email?: string;
  amount: number;
  type?: string; // "refund" for refunds; absent for payments
  status: string;
  platformFallback?: boolean;
  createdAt: string;
  error?: string;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(dl(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function PaymentsApp() {
  const t = useT();
  const w = useWord();
  const [status, setStatus] = useState<Status | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [embedded, setEmbedded] = useState(false);

  const refresh = useCallback(() => {
    apiGet<Status>("/api/payments/status").then(setStatus).catch((e) => setError(e.message));
    apiGet<PaymentRecord[]>("/api/payments").then(setPayments).catch((e) => setError(e.message));
  }, []);
  useEffect(() => refresh(), [refresh]);
  useRealtime(["payments", "tenants"], refresh);

  // Stripe's hosted onboarding page is the default. The embedded form (EmbeddedOnboarding) is built but off:
  // Stripe refused to authenticate full-dashboard accounts inside it. Flip USE_EMBEDDED to try it again.
  const USE_EMBEDDED = false;
  async function connect() {
    setError(null);
    if (USE_EMBEDDED) { setEmbedded(true); return; }
    setBusy(true);
    try {
      const { url } = await apiPost<{ url: string }>("/api/payments/connect", {});
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : t("p8lst.payStartFail"));
      setBusy(false);
    }
  }

  const ready = status?.connected && status.chargesEnabled;
  // A franchise shares head office's payout (Stripe) account and can't connect its own (POST /api/payments/connect is
  // refused for it) — so it sees who owns that account instead of a Connect button that can only fail.
  const isFranchisePortal = portalOf(usePathname()) === "franchise";

  return (
    <div className="text-[var(--ink)]">
      {embedded && <EmbeddedOnboarding onClose={() => setEmbedded(false)} onExit={() => { setEmbedded(false); refresh(); }} />}
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
        {t("p8lst.payTitle")}
      </h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">
        {t("p8lst.payIntro")}
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">
          {error}
        </div>
      )}

      {isFranchisePortal ? (
        <Card className="mb-4 p-4 text-[12.5px] text-[var(--ink-2)]">
          <div className="text-[14px] font-extrabold text-[var(--ink)]">{t("p8lst.payHeadOfficeTitle")}</div>
          <div className="mt-0.5">{t("p8lst.payHeadOfficeBody")}</div>
        </Card>
      ) : (
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[14px] font-extrabold">
              {ready ? t("p8lst.payConnectedTitle") : status?.connected ? t("p8lst.payOnbIncomplete") : t("p8lst.payConnectTitle")}
            </div>
            <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">
              {ready
                ? t(status?.payoutsEnabled ? "p8lst.payPayoutsEnabled" : "p8lst.payPayoutsPending", { id: status?.accountId ?? "" })
                : status?.connected
                  ? t("p8lst.payResumeNote")
                  : t("p8lst.payConnectNote")}
              {status?.platformFallback && !ready && (
                <span className="ms-1 font-bold text-[#9a5a00]">
                  {t("p8lst.payDevMode")}
                </span>
              )}
            </div>
          </div>
          {!ready && (
            <Button variant="primary" disabled={busy || !status} onClick={connect}>
              {busy ? t("p8lst.payOpening") : status?.connected ? t("p8lst.payResume") : t("p8lst.payConnect")}
            </Button>
          )}
        </div>
      </Card>
      )}

      <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
        {t("p8lst.paySection")}
      </div>
      {!payments ? (
        <div className="py-8 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8lst.payLoading")}</div>
      ) : payments.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
          {t("p8lst.payNone")}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          {payments.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-4 py-2.5 text-[12.5px] last:border-b-0">
              <span className="w-[120px] font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                {p.type === "refund" ? "−" : ""}
                {money(p.amount)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[var(--ink-2)]">
                {p.type === "refund" ? t("p8lst.payRefundPrefix") : ""}
                {/* Invoice pay-link records carry no booking refs — say what
                    they are instead of crashing the whole Finance page. */}
                {p.refs?.length ? p.refs.join(", ") : p.kind === "invoice" ? t("p8lst.payInvoice") : "—"}
                {p.email ? ` · ${p.email}` : ""}
              </span>
              {p.platformFallback && <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>{t("p8lst.payTestFallback")}</Badge>}
              <Badge
                tone={
                  p.status === "succeeded"
                    ? { bg: "#eaf0fc", fg: "#1d3a8f" }
                    : p.status === "failed"
                      ? { bg: "var(--red-soft,#fdebec)", fg: "#bb1620" }
                      : { bg: "var(--panel)", fg: "var(--ink-3)" }
                }
              >
                {p.status === "succeeded" ? t("p8lst.pmSucceeded") : p.status === "failed" ? t("p8lst.pmFailed") : w(p.status)}
              </Badge>
              <span className="text-[11.5px] text-[var(--ink-3)]">{when(p.createdAt)}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
