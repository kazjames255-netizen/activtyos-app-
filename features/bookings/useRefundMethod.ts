"use client";
// The screens' handle on the offline-refund wording (features/bookings/refundMethod.ts): the reader's translator and list joiner, bound once.
import { useI18n, useT } from "@/lib/i18n/provider";
import { joinList } from "@/lib/i18n/listFormat";
import { askLabel, methodHow, methodNames, owedLine, recordedLine, sendLine, unsentKinds, type OfflineKind } from "./refundMethod";
import type { Booking } from "./types";

export function useRefundMethod() {
  const t = useT();
  const { locale } = useI18n();
  const join = (items: string[]) => joinList(items, locale);
  const tr = (key: string, vars?: Record<string, string>) => t(key, vars);
  return {
    t,
    names: (k: readonly OfflineKind[]) => methodNames(k, tr, join),
    how: (k: readonly OfflineKind[]) => methodHow(k, tr, join),
    ask: (k: readonly OfflineKind[], provider: string, amt: string) => askLabel(k, provider || t("rfm.yourProv"), amt, tr, join),
    owed: (k: readonly OfflineKind[], amt: string) => owedLine(k, amt, tr, join),
    send: (k: readonly OfflineKind[], amt: string) => sendLine(k, amt, tr, join),
    recorded: (k: readonly OfflineKind[], provider: string, amt: string) => recordedLine(k, provider || t("rfm.yourProv"), amt, tr, join),
    /** The provider's "recorded, still to send" chip: names the method ("Refund recorded — cash to send"). */
    chip: (b: Booking, amt?: string) => {
      const k = unsentKinds(b);
      if (k.length) return t(amt ? "rfm.chipAmt" : "rfm.chip", { methods: methodNames(k, tr, join), ...(amt ? { amt } : {}) });
      return amt ? t("p8lst.rfaChipAmt", { amt }) : t("p8lst.rfaChip");
    },
    /** "Refunded on 3 Oct (cash)". */
    sentChip: (b: Booking, date: string) => {
      const k = unsentKinds(b);
      return k.length ? t("rfm.sentChip", { date, methods: methodNames(k, tr, join) }) : t(/bank|transfer|bacs/i.test(b.method ?? "") ? "p8lst.rfaSentChipBank" : "p8lst.rfaSentChip", { date });
    },
  };
}
