"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Badge, Button, Card } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// Finance — v1 is the payments slice: connect the tenant's own Stripe
// account (Express onboarding — the money always lands with the provider,
// never ActivityOS) and the tenant's payment & refund records. Analytics,
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
  refs: string[];
  email?: string;
  amount: number;
  type?: string; // "refund" for refunds; absent for payments
  status: string;
  platformFallback?: boolean;
  createdAt: string;
  error?: string;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function PaymentsApp() {
  const [status, setStatus] = useState<Status | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    apiGet<Status>("/api/payments/status").then(setStatus).catch((e) => setError(e.message));
    apiGet<PaymentRecord[]>("/api/payments").then(setPayments).catch((e) => setError(e.message));
  }, []);
  useEffect(() => refresh(), [refresh]);
  useRealtime(["payments", "tenants"], refresh);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await apiPost<{ url: string }>("/api/payments/connect", {});
      window.location.href = url; // Stripe-hosted Express onboarding
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start Stripe onboarding");
      setBusy(false);
    }
  }

  const ready = status?.connected && status.chargesEnabled;

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
        Finance — payments
      </h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">
        Card payments land directly in your own Stripe account — ActivityOS never holds your money.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">
          {error}
        </div>
      )}

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[14px] font-extrabold">
              {ready ? "✅ Stripe connected — you can take card payments" : status?.connected ? "⚠️ Stripe onboarding not finished" : "Connect your Stripe account"}
            </div>
            <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">
              {ready
                ? `Payouts ${status?.payoutsEnabled ? "enabled" : "pending"} · account ${status?.accountId}`
                : status?.connected
                  ? "Stripe still needs some details before you can take payments — resume below."
                  : "A few minutes with Stripe: identity, business details and where payouts go."}
              {status?.platformFallback && !ready && (
                <span className="ml-1 font-bold text-[#9a5a00]">
                  (Dev mode: test payments still work meanwhile via the platform account.)
                </span>
              )}
            </div>
          </div>
          {!ready && (
            <Button variant="primary" disabled={busy || !status} onClick={connect}>
              {busy ? "Opening Stripe…" : status?.connected ? "Resume onboarding" : "Connect Stripe"}
            </Button>
          )}
        </div>
      </Card>

      <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
        Payments &amp; refunds
      </div>
      {!payments ? (
        <div className="py-8 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : payments.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
          No payments yet — they appear here the moment a parent pays.
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
                {p.type === "refund" ? "Refund · " : ""}
                {p.refs.join(", ")}
                {p.email ? ` · ${p.email}` : ""}
              </span>
              {p.platformFallback && <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>test fallback</Badge>}
              <Badge
                tone={
                  p.status === "succeeded"
                    ? { bg: "#eaf0fc", fg: "#1d3a8f" }
                    : p.status === "failed"
                      ? { bg: "var(--red-soft,#fdebec)", fg: "#bb1620" }
                      : { bg: "var(--panel)", fg: "var(--ink-3)" }
                }
              >
                {p.status}
              </Badge>
              <span className="text-[11.5px] text-[var(--ink-3)]">{when(p.createdAt)}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
