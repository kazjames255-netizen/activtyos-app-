"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Card } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// Parent Meals — view-only. Meals are bought at checkout (they ride the
// booking basket and are paid with the booking); this area shows "what's
// being served" on the family's booked days. Whether a day appears is set by
// the provider's menu-sharing rule (all booked families, or only those who
// bought a meal that day) — the server decides via the `served` flag.
// ─────────────────────────────────────────────────────────────────────────

interface MenuItem { id: string; name: string; price: number; allergens?: string[]; description?: string }
interface MealDay { tenantId: string; tenantName: string; listingId: string; listingName: string; date: string; children: string[]; menu: { id: string; name: string; items: MenuItem[] }; served: boolean }

const fmtDay = (iso: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }) : "");

export function ParentMealsApp() {
  const [days, setDays] = useState<MealDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<MealDay[]>("/api/my/meal-days").then(setDays).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtime(["listings", "bookings"], load);

  const served = (days ?? []).filter((d) => d.served);

  return (
    <div className="text-[var(--ink)]">
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🍽️</span>Meals
        </div>
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">What’s on the menu on your child’s booked days. You add meals when you book — allergens are shown on every item.</p>
      </div>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {!days ? <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">Loading…</div>
      : served.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No menus to show yet — the day’s menu appears here for camps your provider offers meals on. You can add meals when you book.</Card>
      ) : (
        <div className="flex flex-col gap-3">
          {served.map((d) => (
            <Card key={`${d.listingId}__${d.date}`} className="p-3.5">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[14px] font-extrabold">{fmtDay(d.date)}</span>
                <span className="text-[12px] text-[var(--ink-3)]">{d.listingName} · {d.tenantName}</span>
                <span className="ml-auto rounded-full bg-[#eef4fd] px-2 py-[2px] text-[11px] font-bold text-[#1d3a8f]">{d.menu.name}</span>
              </div>
              <div className="mt-2 flex flex-col gap-1">
                {d.menu.items.map((it) => (
                  <div key={it.id} className="flex flex-wrap items-baseline gap-2 text-[12.5px]">
                    <span className="font-bold">{it.name}</span>
                    <span className="tabular-nums text-[var(--ink-2)]">{money(it.price)}</span>
                    {(it.allergens?.length ?? 0) > 0 && <span className="rounded-full bg-[var(--red-soft,#fdebec)] px-1.5 py-[1px] text-[10px] font-bold capitalize text-[var(--red,#e21d27)]">⚠ {it.allergens!.join(", ")}</span>}
                    {it.description && <span className="text-[11px] text-[var(--ink-3)]">{it.description}</span>}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
