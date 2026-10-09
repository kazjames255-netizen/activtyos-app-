"use client";
// The Price / Paid by wallet / To pay lines of a booking that used wallet credit. Used by the provider's booking page and the family's booking detail.
// Every figure comes from `b.money` (the server's walletBreakdown helper): nothing is added up here.
import { DefRow } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { money } from "./helpers";
import type { Booking } from "./types";

const isCash = (m?: string | null) => /cash/i.test(String(m ?? ""));

/** The Method line for a booking that used wallet credit: "Wallet + cash on the day", "Wallet + Card", or "Wallet" alone. */
export function useWalletMethodLabel() {
  const t = useT();
  return (b: Pick<Booking, "money" | "method">, plain: string): string => {
    const m = b.money;
    if (!m) return plain;
    if (m.paidInFullByWallet) return t("p7bd.wbMethodWallet");
    return isCash(b.method) ? t("p7bd.wbMethodWalletCash") : t("p7bd.wbMethodWalletPlus", { method: plain });
  };
}

export function WalletMoneyRows({ b, priceLabel }: { b: Pick<Booking, "money" | "method">; priceLabel?: string }) {
  const t = useT();
  const m = b.money;
  if (!m) return null;
  const cashPart = m.paidBy.find((p) => p.kind === "cash");
  return (
    <>
      <DefRow label={priceLabel ?? t("p7bd.wbPrice")} value={money(m.gross)} />
      <DefRow label={t("p7bd.wbPaidWallet")} value={`− ${money(m.walletApplied)}`} />
      {cashPart && <DefRow label={t("p7bd.wbPaid", { method: cashPart.method || "—" })} value={`− ${money(cashPart.amount)}`} />}
      {m.due > 0 ? <DefRow label={isCash(b.method) ? t("p7bd.wbToPayCash") : t("p7bd.wbToPay")} value={<b>{money(m.due)}</b>} />
        : m.paidInFullByWallet ? <DefRow label={t("p7bd.wbPaidFull")} value={<b>{money(0)}</b>} /> : null}
    </>
  );
}
