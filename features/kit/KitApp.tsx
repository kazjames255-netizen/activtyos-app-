"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import { useRealtime } from "@/lib/realtime";
import { Button, Card } from "@/components/ui";
import { ADDON_ICON } from "@/features/bookings/addons";

// ─────────────────────────────────────────────────────────────────────────
// KIT TO PREPARE — the extras (T-shirts, bottles, lunches...) to get ready for ONE day, grouped by item and choice, each child a line with a
// tick. No prices: money lives in Money and the Dashboard. The server (routes/kit.ts) decides what is due on the day; this screen only draws it
// and records the ticks.
// ─────────────────────────────────────────────────────────────────────────

interface KitChild { key: string; ref: string; child: string; qty: number; done: boolean; by?: string; pending?: "change" | "cancel" }
interface KitGroup { id: string; name: string; choiceValue: string; choice: string; meal: boolean; total: number; children: KitChild[] }
interface KitDay { date: string; canTick: boolean; groups: KitGroup[]; ticked: number; total: number }

const ukToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const shift = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const longDay = (iso: string, locale?: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function KitApp() {
  const t = useT();
  const [date, setDate] = useState(ukToday());
  const [data, setData] = useState<KitDay | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<KitDay>(`/api/kit?date=${date}`).then((d) => { setData(d); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load"));
  }, [date]);
  useEffect(() => { setData(null); load(); }, [load]);
  useRealtime(["bookings"], load);

  async function tick(g: KitGroup, c: KitChild) {
    if (!data?.canTick) return;
    const done = !c.done;
    // Optimistic: the tick shows at once, and is put back if the server refuses.
    const apply = (val: boolean) => setData((d) => d && ({ ...d, ticked: d.ticked + (val ? 1 : -1), groups: d.groups.map((x) => x.id !== g.id ? x : { ...x, children: x.children.map((y) => y.key === c.key ? { ...y, done: val } : y) }) }));
    apply(done);
    try { await apiPost("/api/kit/tick", { key: c.key, ref: c.ref, date, done }); }
    catch (e) { apply(!done); setError(e instanceof Error ? e.message : "Couldn't save"); }
  }

  return (
    <div className="mx-auto max-w-[900px] p-4">
      <style>{`@media print { body * { visibility: hidden !important; } #kit-print, #kit-print * { visibility: visible !important; } #kit-print { position: absolute; left: 0; top: 0; width: 100%; } .kit-noprint { display: none !important; } }`}</style>
      <div className="kit-noprint mb-3 flex flex-wrap items-center gap-2">
        <h1 className="me-auto text-[20px] font-extrabold">{ADDON_ICON} {t("p8lst.kitTitle")}</h1>
        <Button onClick={() => setDate((d) => shift(d, -1))} aria-label={t("p8lst.kitPrev")}>‹</Button>
        <input type="date" value={date} min="2020-01-01" max={shift(ukToday(), 366 * 3)} onChange={(e) => /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) && setDate(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] font-bold" aria-label={t("p8lst.kitTitle")} />
        <Button onClick={() => setDate((d) => shift(d, 1))} aria-label={t("p8lst.kitNext")}>›</Button>
        <Button onClick={() => setDate(ukToday())}>{t("p8lst.kitToday")}</Button>
        <Button variant="primary" onClick={() => window.print()}>🖨 {t("p8lst.kitPrint")}</Button>
      </div>
      <div id="kit-print">
        <div className="mb-1 text-[16px] font-extrabold">{longDay(date)}</div>
        <p className="kit-noprint mb-3 text-[13px] text-[var(--ink-3)]">{t("p8lst.kitSub")}</p>
        {error && <div className="mb-3 rounded-lg bg-[#fdebec] px-3 py-2 text-[13px] font-bold text-[#c02636]">{error}</div>}
        {data && data.total > 0 && <div className="mb-3 text-[13px] font-extrabold text-[var(--brand-ink,#1d3a8f)]" data-testid="kit-progress">{t("p8lst.kitProgress", { n: String(data.ticked), m: String(data.total) })}</div>}
        {data && !data.canTick && data.total > 0 && <div className="kit-noprint mb-3 text-[12px] text-[var(--ink-3)]">{t("p8lst.kitReadOnly")}</div>}
        {data && data.groups.length === 0 && <Card className="p-6 text-center text-[14px] text-[var(--ink-3)]">{t("p8lst.kitNone")}</Card>}
        <div className="grid gap-3">
          {(data?.groups ?? []).map((g) => (
            <Card key={g.id} className="overflow-hidden p-0" data-testid="kit-group">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-2.5" style={{ background: "var(--brand-soft, #eaf0fc)" }}>
                <div className="text-[15px] font-extrabold">{g.meal ? "🍽" : ADDON_ICON} {g.name}{g.choiceValue ? <span className="font-bold text-[var(--ink-2)]"> · {g.choiceValue}</span> : null}</div>
                <div className="rounded-full bg-[var(--brand,#1d3a8f)] px-3 py-0.5 text-[13px] font-extrabold text-white">{g.total}</div>
              </div>
              <ul>
                {g.children.map((c) => (
                  <li key={c.key} className="border-b border-[var(--line)] last:border-0">
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-[14px]">
                      <input type="checkbox" checked={c.done} disabled={!data?.canTick} onChange={() => void tick(g, c)} className="h-5 w-5 flex-none accent-[#15b364]" data-testid="kit-tick" />
                      <span className="font-bold" style={c.done ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>{c.child}</span>
                      {c.pending && <span className="rounded-full bg-[#faf6ff] px-2 py-[1px] text-[11px] font-extrabold text-[#6b3fb3] ring-1 ring-[#d9c7f2]" data-testid="kit-pending">{c.pending === "cancel" ? t("p8lst.kitPendingCancel") : t("p8lst.kitPendingChange")}</span>}
                      <span className="ms-auto text-[12px] text-[var(--ink-3)]">{c.ref}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
