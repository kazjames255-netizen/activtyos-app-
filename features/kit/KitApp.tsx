"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { get as apiGet, post as apiPost, api } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import { dateLocale } from "@/lib/i18n/format";
import { useRealtime } from "@/lib/realtime";
import { Button, Card } from "@/components/ui";
import { usePortalHref, useReadOnlyPortal } from "@/lib/portal-href";
import { ADDON_ICON, daysWithOrders, monthGrid, monthRange, nextDayWith, type KitDayTally } from "@/features/bookings/addons";

// ─────────────────────────────────────────────────────────────────────────
// ADD-ON ORDERS (was "Kit to prepare") — the extras (T-shirts, bottles, lunches...) families have ordered. A DAY view (grouped by item and choice,
// each child a line with a tick), a MONTH view (how many items each day), a strip of the days that actually HAVE orders, a filter by add-on name,
// "Message" buttons to the booker, and the "remind me the day before" switch. Quantities only: money lives in Money and the Dashboard.
// The server (routes/kit.ts) decides what is due; this screen draws it and records the ticks.
// ─────────────────────────────────────────────────────────────────────────

interface KitChild { key: string; ref: string; child: string; qty: number; done: boolean; by?: string; pending?: "change" | "cancel"; booker?: string; email?: string }
interface KitGroup { id: string; name: string; choiceValue: string; choice: string; meal: boolean; total: number; children: KitChild[] }
interface KitDay { date: string; canTick: boolean; groups: KitGroup[]; ticked: number; total: number }
interface DaysResp { from: string; to: string; days: { date: string; items: number; byName: Record<string, number> }[]; names: string[]; listings: { id: string; name: string }[]; total: number; totals: Record<string, number>; canTick: boolean; canRemind: boolean; reminder: boolean }

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ukToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const shift = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(dateLocale(), { ...o, timeZone: "UTC" });
const longDay = (iso: string) => fmt(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDay = (iso: string) => fmt(iso, { weekday: "short", day: "numeric", month: "short" });

/** Keep the screen's state in the address (day, add-on, view) so a reload, a bell link or a shared link lands on the same place. */
function setQuery(patch: Record<string, string | null>) {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  for (const [k, v] of Object.entries(patch)) { if (v) u.searchParams.set(k, v); else u.searchParams.delete(k); }
  window.history.replaceState(null, "", u.toString());
}

export function KitApp() {
  const t = useT();
  const sp = useSearchParams();
  const pathname = usePathname();
  const portalHref = usePortalHref();
  const today = ukToday();
  const [view, setView] = useState<"day" | "month">(sp.get("view") === "month" ? "month" : "day");
  const [date, setDate] = useState(() => (ISO.test(sp.get("date") ?? "") ? (sp.get("date") as string) : today));
  const [name, setName] = useState(sp.get("name") ?? "");
  const [listingId, setListingId] = useState(sp.get("listing") ?? "");
  // Listings seen so far (id -> name), so the picked one keeps its name when a different range does not list it.
  const [knownListings, setKnownListings] = useState<Record<string, string>>({});
  const [onlyDays, setOnlyDays] = useState(true);
  const [month, setMonth] = useState(() => { const d = ISO.test(sp.get("date") ?? "") ? (sp.get("date") as string) : today; return { y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)) - 1 }; });
  const [data, setData] = useState<KitDay | null>(null);
  const [strip, setStrip] = useState<DaysResp | null>(null);
  const [monthData, setMonthData] = useState<DaysResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remindBusy, setRemindBusy] = useState(false);
  const [reminder, setReminder] = useState<boolean | null>(null);
  // Staff cannot change the "Remind me the day before" switch (owners only), so they are not shown it at all.
  const useStaffView = useReadOnlyPortal().staff;

  const nameQ = `${name ? `&name=${encodeURIComponent(name)}` : ""}${listingId ? `&listingId=${encodeURIComponent(listingId)}` : ""}`;
  // The strip covers a week back to about two months ahead of the chosen day (one request, at most 93 days on the server).
  const range = useMemo(() => ({ from: shift(date, -7), to: shift(date, 60) }), [date]);
  const [loaded, setLoaded] = useState<{ from: string; to: string } | null>(null);

  const rememberListings = (ls: { id: string; name: string }[] | undefined) => {
    if (ls?.length) setKnownListings((k) => (ls.every((l) => k[l.id] === l.name) ? k : { ...k, ...Object.fromEntries(ls.map((l) => [l.id, l.name])) }));
  };

  const loadDay = useCallback(() => {
    apiGet<KitDay>(`/api/kit?date=${date}${nameQ}`).then((d) => { setData(d); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load"));
  }, [date, nameQ]);
  const loadStrip = useCallback(() => {
    // Re-use the loaded range while the chosen day is still inside it (the arrows and chips move within it without a new request).
    const r = loaded && date >= loaded.from && date <= shift(loaded.to, -7) ? loaded : range;
    apiGet<DaysResp>(`/api/kit/days?from=${r.from}&to=${r.to}${nameQ}`).then((d) => { setStrip(d); rememberListings(d.listings); setLoaded({ from: d.from, to: d.to }); setReminder((x) => (x === null ? d.reminder : x)); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, range, nameQ]);
  const loadMonth = useCallback(() => {
    const r = monthRange(month.y, month.m);
    apiGet<DaysResp>(`/api/kit/days?from=${r.from}&to=${r.to}${nameQ}`).then((d) => { setMonthData(d); rememberListings(d.listings); }).catch(() => {});
  }, [month, nameQ]);

  useEffect(() => { setData(null); loadDay(); }, [loadDay]);
  useEffect(() => { loadStrip(); }, [loadStrip]);
  useEffect(() => { if (view === "month") loadMonth(); }, [view, loadMonth]);
  useRealtime(["bookings"], () => { loadDay(); loadStrip(); if (view === "month") loadMonth(); });
  useEffect(() => { setQuery({ date: date === today ? null : date, name: name || null, listing: listingId || null, view: view === "month" ? "month" : null }); }, [date, name, listingId, view, today]);

  const withOrders = useMemo(() => daysWithOrders({ days: Object.fromEntries((strip?.days ?? []).map((d) => [d.date, { items: d.items, byName: d.byName } as KitDayTally])), names: [] }), [strip]);
  const dayDates = withOrders.map((d) => d.date);
  const goPrev = () => setDate((d) => (onlyDays ? nextDayWith(dayDates, d, -1) ?? d : shift(d, -1)));
  const goNext = () => setDate((d) => (onlyDays ? nextDayWith(dayDates, d, 1) ?? d : shift(d, 1)));
  const canPrev = !onlyDays || nextDayWith(dayDates, date, -1) !== null;
  const canNext = !onlyDays || nextDayWith(dayDates, date, 1) !== null;
  const names = strip?.names ?? monthData?.names ?? [];
  // The dropdown shows what the server lists for the range on screen (only listings this account may see), plus any listing already picked.
  const listingOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of [...(strip?.listings ?? []), ...(monthData?.listings ?? [])]) m.set(l.id, l.name);
    if (listingId && !m.has(listingId)) m.set(listingId, knownListings[listingId] ?? t("p8lst.kitUnknownListing"));
    return [...m].map(([id, nm]) => ({ id, name: nm })).sort((a, c) => a.name.localeCompare(c.name));
  }, [strip, monthData, listingId, knownListings, t]);
  const listingName = listingId ? listingOptions.find((l) => l.id === listingId)?.name ?? "" : "";
  const canTick = data?.canTick ?? strip?.canTick ?? false;
  const nothingAtAll = strip !== null && strip.total === 0 && strip.names.length === 0 && !name && !listingId && (data?.total ?? 0) === 0;

  async function tick(g: KitGroup, c: KitChild) {
    if (!data?.canTick) return;
    const done = !c.done;
    // Optimistic: the tick shows at once, and is put back if the server refuses.
    const apply = (val: boolean) => setData((d) => d && ({ ...d, ticked: d.ticked + (val ? 1 : -1), groups: d.groups.map((x) => x.id !== g.id ? x : { ...x, children: x.children.map((y) => y.key === c.key ? { ...y, done: val } : y) }) }));
    apply(done);
    try { await apiPost("/api/kit/tick", { key: c.key, ref: c.ref, date, done }); }
    catch (e) { apply(!done); setError(e instanceof Error ? e.message : "Couldn't save"); }
  }

  async function toggleReminder() {
    if (!strip?.canRemind || remindBusy) return;
    const on = !(reminder ?? strip.reminder);
    setRemindBusy(true);
    setReminder(on);
    try { await api(`/api/kit/reminder`, { method: "PUT", body: JSON.stringify({ on }) }); }
    catch (e) { setReminder(!on); setError(e instanceof Error ? e.message : "Couldn't save"); }
    setRemindBusy(false);
  }

  const itemLabel = (e: KitGroup, c?: KitChild) => `${e.name}${e.choiceValue ? ` (${e.choiceValue})` : ""}${c ? "" : ""}`;
  const msgHref = (g: KitGroup, c: KitChild) => portalHref(`/messages?compose=1&emails=${encodeURIComponent(c.email ?? "")}&subject=${encodeURIComponent(`${itemLabel(g)} · ${shortDay(date)}`)}&body=${encodeURIComponent(t("p8lst.kitMsgBody", { name: (c.booker ?? "").split(" ")[0] || "", item: itemLabel(g), child: c.child, date: shortDay(date) }))}`);
  const msgAllHref = (g: KitGroup) => {
    const emails = [...new Set(g.children.map((c) => (c.email ?? "").toLowerCase()).filter(Boolean))];
    return emails.length ? portalHref(`/messages?compose=1&emails=${encodeURIComponent(emails.join(","))}&subject=${encodeURIComponent(`${itemLabel(g)} · ${shortDay(date)}`)}&body=${encodeURIComponent(t("p8lst.kitMsgBodyAll", { item: itemLabel(g), date: shortDay(date) }))}`) : null;
  };
  const chipText = (iso: string, n: number) => (n === 1 ? t("p8lst.kitChipOne", { day: shortDay(iso) }) : t("p8lst.kitChipMany", { day: shortDay(iso), n }));
  const remindOn = reminder ?? strip?.reminder ?? true;
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => fmt(`2024-01-0${i + 1}`, { weekday: "short" })), []);
  const monthLabel = fmt(`${month.y}-${String(month.m + 1).padStart(2, "0")}-01`, { month: "long", year: "numeric" });
  const mTally = monthData ? Object.fromEntries(monthData.days.map((d) => [d.date, d])) : {};
  const shiftMonth = (n: number) => setMonth((x) => { const d = new Date(Date.UTC(x.y, x.m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  const portalSeg = pathname?.split("/")[1] ?? "";

  return (
    <div className="mx-auto max-w-[900px] p-4" data-portal={portalSeg}>
      <style>{`@media print { body * { visibility: hidden !important; } #kit-print, #kit-print * { visibility: visible !important; } #kit-print { position: absolute; left: 0; top: 0; width: 100%; } .kit-noprint { display: none !important; } }`}</style>

      <div className="kit-noprint mb-3 flex flex-wrap items-center gap-2">
        <h1 className="me-auto text-[20px] font-extrabold">{ADDON_ICON} {t("p8lst.kitTitle")}</h1>
        {strip && !useStaffView && (
          <button type="button" onClick={() => void toggleReminder()} disabled={!strip.canRemind || remindBusy} aria-pressed={remindOn} data-testid="kit-remind"
            title={!strip.canRemind ? t("p8lst.kitRemindReadOnly") : remindOn ? t("p8lst.kitRemindOn") : t("p8lst.kitRemindOff")}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-extrabold disabled:opacity-60">
            <span aria-hidden>🔔</span> {t("p8lst.kitRemind")}
            <span className="relative inline-block h-[18px] w-[32px] flex-none rounded-full transition-colors" style={{ background: remindOn ? "#15b364" : "#c9cfdc" }} aria-hidden>
              <span className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all" style={{ insetInlineStart: remindOn ? 16 : 2 }} />
            </span>
          </button>
        )}
      </div>

      <div className="kit-noprint mb-3 flex flex-wrap items-center gap-2">
        <div role="tablist" className="inline-flex rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 text-[12.5px] font-extrabold">
          {(["day", "month"] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} data-testid={`kit-tab-${v}`} onClick={() => { setView(v); if (v === "month") setMonth({ y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)) - 1 }); }}
              className="rounded-full px-3.5 py-1" style={view === v ? { background: "var(--brand,#1d3a8f)", color: "#fff" } : { color: "var(--ink-2)" }}>
              {v === "day" ? t("p8lst.kitTabDay") : t("p8lst.kitTabMonth")}
            </button>
          ))}
        </div>
        <select value={name} onChange={(e) => setName(e.target.value)} aria-label={t("p8lst.kitAllAddons")} data-testid="kit-name-filter"
          className="min-w-0 max-w-full rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-bold">
          <option value="">{ADDON_ICON} {t("p8lst.kitAllAddons")}</option>
          {names.map((n) => <option key={n} value={n}>{n}</option>)}
          {name && !names.includes(name) && <option value={name}>{name}</option>}
        </select>
        {(listingOptions.length > 0 || listingId) && (
          <select value={listingId} onChange={(e) => setListingId(e.target.value)} aria-label={t("p8lst.kitFilterListing")} data-testid="kit-listing-filter"
            className="min-w-0 max-w-full rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-bold">
            <option value="">{t("p8lst.kitAllListings")}</option>
            {listingOptions.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        <span className="ms-auto" />
        <Button variant="primary" onClick={() => window.print()}>🖨 {t("p8lst.kitPrint")}</Button>
      </div>

      {error && <div className="kit-noprint mb-3 rounded-lg bg-[#fdebec] px-3 py-2 text-[13px] font-bold text-[#c02636]">{error}</div>}

      {nothingAtAll && <Card className="mb-3 p-6 text-center text-[14px] text-[var(--ink-3)]" data-testid="kit-empty">{t("p8lst.kitEmpty")}</Card>}

      {view === "day" && (
        <>
          <div className="kit-noprint mb-3 flex flex-wrap items-center gap-2">
            <Button onClick={goPrev} disabled={!canPrev} aria-label={onlyDays ? t("p8lst.kitPrevOrder") : t("p8lst.kitPrev")} title={onlyDays ? t("p8lst.kitPrevOrder") : t("p8lst.kitPrev")} data-testid="kit-prev">‹</Button>
            <input type="date" value={date} min="2020-01-01" max={shift(today, 366 * 3)} onChange={(e) => ISO.test(e.target.value) && setDate(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] font-bold" aria-label={t("p8lst.kitTitle")} />
            <Button onClick={goNext} disabled={!canNext} aria-label={onlyDays ? t("p8lst.kitNextOrder") : t("p8lst.kitNext")} title={onlyDays ? t("p8lst.kitNextOrder") : t("p8lst.kitNext")} data-testid="kit-next">›</Button>
            <Button onClick={() => setDate(today)}>{t("p8lst.kitToday")}</Button>
            <label className="ms-auto inline-flex cursor-pointer items-center gap-2 text-[12.5px] font-bold text-[var(--ink-2)]">
              <input type="checkbox" checked={onlyDays} onChange={(e) => setOnlyDays(e.target.checked)} className="h-4 w-4 accent-[#1d3a8f]" data-testid="kit-only-days" /> {t("p8lst.kitOnlyDays")}
            </label>
          </div>

          <div className="kit-noprint mb-4" data-testid="kit-strip">
            <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8lst.kitDaysStrip")}</div>
            {withOrders.length === 0 ? (
              <div className="text-[12.5px] text-[var(--ink-3)]">{strip ? t("p8lst.kitNoDays") : ""}</div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {withOrders.map((d) => (
                  <button key={d.date} type="button" onClick={() => setDate(d.date)} data-testid="kit-chip" aria-pressed={d.date === date}
                    className="flex-none whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] font-extrabold"
                    style={d.date === date ? { background: "var(--brand,#1d3a8f)", color: "#fff", borderColor: "var(--brand,#1d3a8f)" } : { background: "var(--surface)", borderColor: "var(--line)", color: d.date === today ? "var(--brand,#1d3a8f)" : "var(--ink-2)" }}>
                    {chipText(d.date, d.items)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div id="kit-print">
            <div className="mb-1 text-[16px] font-extrabold">{longDay(date)}{name ? ` · ${name}` : ""}{listingName ? ` · ${listingName}` : ""}</div>
            <p className="kit-noprint mb-3 text-[13px] text-[var(--ink-3)]">{t("p8lst.kitSub")}</p>
            {data && data.total > 0 && <div className="mb-3 text-[13px] font-extrabold text-[var(--brand-ink,#1d3a8f)]" data-testid="kit-progress">{t("p8lst.kitProgress", { n: String(data.ticked), m: String(data.total) })}</div>}
            {data && !data.canTick && data.total > 0 && <div className="kit-noprint mb-3 text-[12px] text-[var(--ink-3)]">{t("p8lst.kitReadOnly")}</div>}
            {data && data.groups.length === 0 && !nothingAtAll && <Card className="p-6 text-center text-[14px] text-[var(--ink-3)]" data-testid="kit-none">{listingId && strip && strip.total === 0 ? t("p8lst.kitNoneListing") : t("p8lst.kitNone")}</Card>}
            <div className="grid gap-3">
              {(data?.groups ?? []).map((g) => {
                const all = msgAllHref(g);
                return (
                  <Card key={g.id} className="overflow-hidden p-0" data-testid="kit-group">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-2.5" style={{ background: "var(--brand-soft, #eaf0fc)" }}>
                      <div className="text-[15px] font-extrabold">{g.meal ? "🍽" : ADDON_ICON} {g.name}{g.choiceValue ? <span className="font-bold text-[var(--ink-2)]"> · {g.choiceValue}</span> : null}</div>
                      <div className="flex items-center gap-2">
                        {all && <a href={all} className="kit-noprint rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-0.5 text-[12px] font-extrabold text-[var(--brand-ink,#1d3a8f)] no-underline" data-testid="kit-msg-all">✉ {t("p8lst.kitMessageAll")}</a>}
                        <div className="rounded-full bg-[var(--brand,#1d3a8f)] px-3 py-0.5 text-[13px] font-extrabold text-white">{g.total}</div>
                      </div>
                    </div>
                    <ul>
                      {g.children.map((c) => (
                        <li key={c.key} className="border-b border-[var(--line)] last:border-0">
                          <div className="flex items-center gap-3 px-4 py-2.5 text-[14px]">
                            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                              <input type="checkbox" checked={c.done} disabled={!data?.canTick} onChange={() => void tick(g, c)} className="h-5 w-5 flex-none accent-[#15b364]" data-testid="kit-tick" />
                              <span className="font-bold" style={c.done ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>{c.child}</span>
                              {c.pending && <span className="rounded-full bg-[#faf6ff] px-2 py-[1px] text-[11px] font-extrabold text-[#6b3fb3] ring-1 ring-[#d9c7f2]" data-testid="kit-pending">{c.pending === "cancel" ? t("p8lst.kitPendingCancel") : t("p8lst.kitPendingChange")}</span>}
                            </label>
                            {c.email && <a href={msgHref(g, c)} className="kit-noprint flex-none rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[11.5px] font-extrabold text-[var(--brand-ink,#1d3a8f)] no-underline" data-testid="kit-msg">✉ {t("p8lst.kitMessage")}</a>}
                            <span className="flex-none text-[12px] text-[var(--ink-3)]">{c.ref}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}

      {view === "month" && (
        <div id="kit-print" data-testid="kit-month">
          <div className="kit-noprint mb-3 flex flex-wrap items-center gap-2">
            <Button onClick={() => shiftMonth(-1)} aria-label={t("p8lst.kitPrevMonth")} title={t("p8lst.kitPrevMonth")}>‹</Button>
            <div className="min-w-[150px] text-center text-[16px] font-extrabold">{monthLabel}</div>
            <Button onClick={() => shiftMonth(1)} aria-label={t("p8lst.kitNextMonth")} title={t("p8lst.kitNextMonth")}>›</Button>
            <Button onClick={() => setMonth({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 })}>{t("p8lst.kitToday")}</Button>
          </div>
          <div className="hidden text-[16px] font-extrabold print:block">{monthLabel}{name ? ` · ${name}` : ""}{listingName ? ` · ${listingName}` : ""}</div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">
            {weekdays.map((w, i) => <div key={i}>{w}</div>)}
          </div>
          <div className="mt-1.5 grid gap-1.5">
            {monthGrid(month.y, month.m).map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1.5">
                {week.map((d, di) => {
                  if (!d) return <div key={di} />;
                  const v = mTally[d] as { items: number; byName: Record<string, number> } | undefined;
                  const n = v?.items ?? 0;
                  const minis = !name && v ? Object.entries(v.byName).sort((a, c) => c[1] - a[1]).slice(0, 2) : [];
                  return (
                    <button key={d} type="button" onClick={() => { setDate(d); setView("day"); }} data-testid="kit-cell" data-date={d} data-items={n}
                      aria-label={n ? chipText(d, n) : shortDay(d)}
                      className="flex min-h-[64px] flex-col items-start gap-0.5 rounded-xl border p-1.5 text-start"
                      style={n ? { background: "var(--brand-soft,#eaf0fc)", borderColor: "var(--brand,#1d3a8f)" } : { background: "var(--surface)", borderColor: "var(--line)", opacity: 0.75 }}>
                      <span className="flex w-full items-center justify-between text-[12px] font-extrabold" style={{ color: d === today ? "var(--brand,#1d3a8f)" : "var(--ink-2)" }}>
                        {Number(d.slice(8))}
                        {n > 0 && <span className="rounded-full bg-[var(--brand,#1d3a8f)] px-1.5 text-[11px] font-extrabold text-white">{n}</span>}
                      </span>
                      {minis.map(([nm, c]) => <span key={nm} className="w-full truncate text-[10.5px] font-semibold text-[var(--ink-2)]">{nm} ×{c}</span>)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {monthData && listingId && monthData.total === 0 && <Card className="kit-noprint mt-3 p-4 text-center text-[13.5px] text-[var(--ink-3)]" data-testid="kit-none">{t("p8lst.kitNoneListing")}</Card>}
          {monthData && (
            <div className="mt-4" data-testid="kit-month-totals">
              <div className="mb-1 text-[14px] font-extrabold">{t("p8lst.kitMonthTotal", { n: monthData.total })}</div>
              {Object.keys(monthData.totals).length > 0 && (
                <>
                  <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8lst.kitMonthByAddon")}</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(monthData.totals).sort((a, c) => c[1] - a[1]).map(([nm, c]) => (
                      <span key={nm} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[12.5px] font-extrabold">{ADDON_ICON} {nm} × {c}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
