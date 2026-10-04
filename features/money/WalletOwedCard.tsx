"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { useT } from "@/lib/i18n/provider";

// Unspent store credit this provider owes its families (GET /api/wallet/summary).
// The API is manager/owner only: staff get a 403, and the card simply isn't
// shown. It also stays hidden until the figure loads, so nobody sees a £0.
export function WalletOwedCard({ className = "" }: { className?: string }) {
  const t = useT();
  const [owed, setOwed] = useState<number | null>(null);
  const load = useCallback(() => {
    apiGet<{ outstanding?: number }>("/api/wallet/summary")
      .then((r) => setOwed(typeof r?.outstanding === "number" ? r.outstanding : null))
      .catch(() => setOwed(null));
  }, []);
  useEffect(load, [load]);
  useRealtime(["wallet"], load);
  if (owed === null) return null;
  return (
    <div data-ui="wallet-owed" className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 ${className}`}>
      <div className="min-w-0">
        <div className="text-[13px] font-extrabold text-[var(--ink)]">{t("p8fin.walletOwedTitle")}</div>
        <div className="text-[11.5px] text-[var(--ink-3)]">{t("p8fin.walletOwedSub")}</div>
      </div>
      <div className="text-[20px] font-extrabold tabular-nums text-[var(--ink)]">{money(owed)}</div>
    </div>
  );
}
