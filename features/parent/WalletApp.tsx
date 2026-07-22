"use client";

import { useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Card } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// custdash/wallet — the parent's store credit.
//
// A wallet holds credit the family has WITH a provider: a cancellation refund
// they took as credit, a no-refund credit note, or a cheaper-amend difference.
// It's spend-only (never withdrawn to a card) and scoped per provider, so
// credit from one provider is only ever spent with that provider — the whole
// point being that money stays in the business and is instant to reuse.
//
// The balance + ledger are server-authoritative (money-adjacent), so this only
// READS them. Until the backend endpoint lands it reads empty, showing the
// "no credit yet" state. See the backend handoff, §Z.
// ─────────────────────────────────────────────────────────────────────────

type WalletTxn = {
  id: string;
  /** ISO timestamp. */
  at: string;
  /** Positive = credit added, negative = spent. In pounds. */
  delta: number;
  /** Plain-English reason — "Refund from Summer Camp", "Spent on Football Camp". */
  reason: string;
  /** The booking it relates to, when there is one. */
  ref?: string;
};

type WalletBalance = {
  tenantId: string;
  provider: string;
  balance: number;
  transactions: WalletTxn[];
};

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export function WalletApp() {
  const [balances, setBalances] = useState<WalletBalance[] | null>(null);

  const load = () =>
    apiGet<{ balances: WalletBalance[] }>("/api/my/wallet")
      .then((r) => setBalances(r?.balances ?? []))
      .catch(() => setBalances([])); // endpoint not built yet → show empty state
  useEffect(() => {
    void load();
  }, []);
  useRealtime(["wallet", "bookings"], load);

  if (!balances) {
    return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading your wallet…</div>;
  }

  const funded = balances.filter((b) => b.balance > 0 || b.transactions.length > 0);
  const total = funded.reduce((n, b) => n + b.balance, 0);

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
        Wallet
      </h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">
        Credit you can spend on future bookings — it stays with your provider and applies at checkout.
      </p>

      {funded.length === 0 ? (
        <Card className="p-6 text-center">
          <div className="text-[30px]">👛</div>
          <div className="mt-1 text-[14px] font-extrabold">No credit yet</div>
          <p className="mx-auto mt-1 max-w-[420px] text-[12.5px] leading-[1.6] text-[var(--ink-3)]">
            When a booking is cancelled and you choose <b>wallet credit</b> — or a provider gives you a credit note —
            it lands here, ready to spend on your next booking with them.
          </p>
        </Card>
      ) : (
        <>
          {/* Total across providers, up top. */}
          <div className="mb-4 rounded-2xl px-5 py-4 text-white" style={{ background: "linear-gradient(120deg,#1d3a8f,#2f6bd8)" }}>
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#cdddf7]">Credit to spend</div>
            <div className="text-[30px] font-extrabold leading-tight">{money(total)}</div>
            <div className="text-[11.5px] text-[#cdddf7]">
              across {funded.length} provider{funded.length === 1 ? "" : "s"} · applied automatically at checkout
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {funded.map((b) => (
              <Card key={b.tenantId} className="overflow-hidden p-0">
                <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
                  <div className="text-[14px] font-extrabold">{b.provider}</div>
                  <div className="text-right">
                    <div className="text-[16px] font-extrabold text-[#0f7a44]">{money(b.balance)}</div>
                    <div className="text-[10.5px] text-[var(--ink-3)]">to spend</div>
                  </div>
                </div>
                <div className="px-4 py-1.5">
                  {b.transactions.length === 0 ? (
                    <div className="py-2 text-[12px] text-[var(--ink-3)]">No activity yet.</div>
                  ) : (
                    b.transactions.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-3 border-b border-dashed border-[var(--line)] py-2 text-[12.5px] last:border-b-0">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{t.reason}</div>
                          <div className="text-[11px] text-[var(--ink-3)]">{fmtWhen(t.at)}{t.ref ? ` · Ref ${t.ref}` : ""}</div>
                        </div>
                        <div className={`flex-none font-extrabold tabular-nums ${t.delta >= 0 ? "text-[#0f7a44]" : "text-[var(--ink-2)]"}`}>
                          {t.delta >= 0 ? "+" : "−"}{money(Math.abs(t.delta))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
