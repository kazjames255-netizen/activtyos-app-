"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { withHoNet } from "@/lib/ho-net";
import { useHoScope } from "@/components/franchise/HoScope";
import { sevenDaySummary, type KitDayTally } from "@/features/bookings/addons";

// The Dashboard card's data: add-on items per day for TODAY and the next 6 days. Asked only once the provider is known to have live add-on orders
// (the card is hidden otherwise), and refreshed when bookings change.

const ukToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }); // raw-locale-ok: machine date key, not shown to anyone
const plus = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function useAddonWeek(live: boolean): ReturnType<typeof sevenDaySummary> | null {
  const hoScope = useHoScope();
  const [week, setWeek] =useState<ReturnType<typeof sevenDaySummary> | null>(null);
  const load = useCallback(() => {
    if (!live) { setWeek(null); return; }
    const today = ukToday();
    apiGet<{ days: { date: string; items: number; byName: Record<string, number> }[] }>(withHoNet(`/api/kit/days?from=${today}&to=${plus(today, 6)}`))
      .then((r) => setWeek(sevenDaySummary({ days: Object.fromEntries(r.days.map((d) => [d.date, { items: d.items, byName: d.byName } as KitDayTally])), names: [] }, today)))
      .catch(() => {});
  }, [live, hoScope]);
  useEffect(() => { load(); }, [load]);
  useRealtime(["bookings"], load);
  return week;
}
