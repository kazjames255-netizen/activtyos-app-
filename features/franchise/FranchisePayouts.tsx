"use client";

// Franchise payouts. Head office takes every card payment, keeps a percentage, and pays each franchise the rest; money a franchise took itself
// owes head office the same percentage. EVERY number comes from GET /api/splitfees/payouts (one shared server helper) - this screen only
// shows it. The same cards are the franchise's own read-only statement (GET /api/splitfees/payouts/mine).
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Button, Card, FieldLabel, Input, Select } from "@/components/ui";
import { uiDate } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/provider";

interface Settlement { id: string; franchiseId: string; franchiseName: string; from: string; to: string; amount: number; direction: "hoPays" | "franchiseOwes" | "even"; settledAt: string; settledBy: { name: string } }
interface Row {
  franchiseId: string; name?: string; bookings: number; card: number; direct: number; total: number;
  hoKeepsCard: number; franchiseCard: number; hoShareDirect: number; net: number; rate: number | null; rates: number[];
  settlement: Settlement | null; overlapping?: boolean;
}
interface Range { period: string; from: string; to: string; month: string | null; today: string }
interface HoPayload { range: Range; blocked?: "perBooking"; upcoming?: { from: string; rate: number }[]; rate: number; settings: { basis: "revenue" | "perBooking"; rate: number; perBookingFee: number }; rows: Row[]; settlements: Settlement[]; canSettle: boolean }
interface MinePayload { range: Range; blocked?: "perBooking"; rate: number; row: Row | null; settlements: Settlement[] }

const monthKey = (iso: string) => iso.slice(0, 7);
const monthName = (m: string) => uiDate(new Date(`${m}-01T00:00:00Z`), { month: "long", year: "numeric", timeZone: "UTC" });
function lastMonths(today: string, n = 14): string[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
}

function useWindow() {
  const [month, setMonth] = useState<string>(""); // "" = this month (the server's default)
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const custom = !!(from && to);
  const query = custom ? `from=${from}&to=${to}` : month ? `month=${month}` : "";
  return { month, setMonth, from, setFrom, to, setTo, custom, query };
}

function PeriodPicker({ w, today }: { w: ReturnType<typeof useWindow>; today: string }) {
  const t = useT();
  const months = useMemo(() => lastMonths(today), [today]);
  return (
    <Card className="mb-3 flex flex-wrap items-end gap-3 p-3">
      <div>
        <FieldLabel>{t("fpay.month")}</FieldLabel>
        <Select value={w.custom ? "" : (w.month || monthKey(today))} onChange={(e) => { w.setMonth(e.target.value); w.setFrom(""); w.setTo(""); }} className="min-w-[10rem]">
          {w.custom && <option value="">{t("fpay.customDates")}</option>}
          {months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
        </Select>
      </div>
      <div>
        <FieldLabel>{t("fpay.customDates")}</FieldLabel>
        <div className="flex items-center gap-1.5">
          <label className="sr-only" htmlFor="fpay-from">{t("fpay.from")}</label>
          <input id="fpay-from" type="date" value={w.from} onChange={(e) => w.setFrom(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[12.5px]" />
          <span aria-hidden className="text-[var(--ink-3)]">-</span>
          <label className="sr-only" htmlFor="fpay-to">{t("fpay.to")}</label>
          <input id="fpay-to" type="date" value={w.to} onChange={(e) => w.setTo(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[12.5px]" />
        </div>
      </div>
    </Card>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{label}</div>
      <div className={"mt-0.5 tabular-nums " + (strong ? "text-[17px] font-extrabold" : "text-[15px] font-bold")}>{value}</div>
    </div>
  );
}

function PayoutCard({ row, range, canSettle, onSettled, name }: { row: Row; range: Range; canSettle: boolean; onSettled?: () => void; name?: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pct = row.rate == null ? t("fpay.mixedRates") : `${row.rate}%`;
  const rateNum = row.rate == null ? "" : String(row.rate);
  const net = row.net > 0 ? t("fpay.netPays", { amount: money(row.net) }) : row.net < 0 ? t("fpay.netOwes", { amount: money(-row.net) }) : t("fpay.netEven");
  const ended = range.to < range.today;
  const s = row.settlement;
  async function settle() {
    if (!window.confirm(t("fpay.confirmSettle"))) return;
    setBusy(true); setErr(null);
    try {
      await api("/api/splitfees/payouts/settle", { method: "POST", body: JSON.stringify({ franchiseId: row.franchiseId, from: range.from, to: range.to }) });
      onSettled?.();
    } catch (e) { setErr(e instanceof Error ? e.message : t("fpay.loadFailed")); } finally { setBusy(false); }
  }
  return (
    <Card className="mb-3 p-4" data-ui="card">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        {(name ?? row.name) ? <div className="text-[15px] font-extrabold">{name ?? row.name}</div> : <div />}
        <div className="text-[11.5px] text-[var(--ink-3)]">{t("fpay.bookings", { n: row.bookings })}</div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
        <Figure label={t("fpay.colCard")} value={money(row.card)} />
        <Figure label={t("fpay.keepsPct", { rate: rateNum || "~" }).replace("~%", pct)} value={money(row.hoKeepsCard)} />
        <Figure label={t("fpay.colGets")} value={money(row.franchiseCard)} />
        <Figure label={t("fpay.colDirect")} value={money(row.direct)} />
        <Figure label={t("fpay.colShare", { rate: rateNum || "~" }).replace("~%", pct)} value={money(row.hoShareDirect)} />
      </div>
      <div className="mt-3 rounded-lg bg-[var(--surface-2,var(--surface))] p-3">
        <div className="text-[15px] font-extrabold" style={{ color: row.net === 0 ? "var(--ink)" : row.net > 0 ? "var(--brand)" : "var(--red)" }}>{net}</div>
        <div className="mt-1 text-[11.5px] leading-snug text-[var(--ink-3)]">
          {t("fpay.sum", { card: money(row.card), keeps: money(row.hoKeepsCard), rate: pct, gets: money(row.franchiseCard), share: money(row.hoShareDirect), direct: money(row.direct), net: money(row.net) })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {s ? (
          <div className="text-[12px] font-bold text-[var(--ink-2)]">{t("fpay.settledBy", { date: uiDate(new Date(s.settledAt), { day: "numeric", month: "short", year: "numeric" }), name: s.settledBy.name, amount: money(s.amount) })}</div>
        ) : canSettle ? (
          ended
            ? <Button variant="primary" disabled={busy} onClick={settle}>{t("fpay.markSettled")}</Button>
            : <div className="text-[11.5px] text-[var(--ink-3)]">{t("fpay.settleWait")}</div>
        ) : null}
        {err && <div role="alert" className="text-[12px] text-[var(--red)]">{err}</div>}
      </div>
    </Card>
  );
}

function History({ list, showName }: { list: Settlement[]; showName: boolean }) {
  const t = useT();
  const how = (s: Settlement) => (s.direction === "hoPays" ? t("fpay.histHoPays") : s.direction === "franchiseOwes" ? t("fpay.histOwes") : t("fpay.histEven"));
  return (
    <div className="mt-5">
      <div className="mb-2 text-[13.5px] font-extrabold">{t("fpay.history")}</div>
      {list.length === 0 ? <div className="text-[12.5px] text-[var(--ink-3)]">{t("fpay.historyNone")}</div> : (
        <Card className="overflow-hidden p-0">
          {list.map((s) => (
            <div key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--line)] px-3.5 py-2 text-[12.5px] last:border-0">
              <div><b>{showName ? `${s.franchiseName} - ` : ""}{s.from} - {s.to}</b> <span className="text-[var(--ink-3)]">{how(s)} {s.direction === "even" ? "" : money(s.amount)}</span></div>
              <div className="text-[11.5px] text-[var(--ink-3)]">{uiDate(new Date(s.settledAt), { day: "numeric", month: "short", year: "numeric" })} · {s.settledBy.name}</div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/** Head office: one card per franchise, a period picker, the rate, Mark settled, and the settlement history. */
export function FranchisePayoutsPanel() {
  const t = useT();
  const w = useWindow();
  const [data, setData] = useState<HoPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const refresh = useCallback(() => {
    apiGet<HoPayload>(`/api/splitfees/payouts${w.query ? `?${w.query}` : ""}`).then((p) => { setData(p); setError(null); setRate((r) => r || String(p.rate)); }).catch((e) => setError(e instanceof Error ? e.message : t("fpay.loadFailed")));
  }, [w.query, t]);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["bookings"], refresh);

  async function saveRate() {
    if (!data) return;
    setSaving(true); setSaved(false);
    try {
      await api("/api/splitfees/settings", { method: "PUT", body: JSON.stringify({ basis: data.settings.basis, rate: Number(rate), perBookingFee: data.settings.perBookingFee }) });
      setSaved(true); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : t("fpay.loadFailed")); } finally { setSaving(false); }
  }

  if (error) return <div role="alert" className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!data) return <div className="py-6 text-center text-[12.5px] text-[var(--ink-3)]">{t("fpay.loading")}</div>;
  const rateChanged = rate !== "" && Number(rate) !== data.rate;
  async function usePercentage() {
    setSaving(true);
    try {
      await api("/api/splitfees/settings", { method: "PUT", body: JSON.stringify({ basis: "revenue", rate: data!.settings.rate, perBookingFee: data!.settings.perBookingFee }) });
      refresh();
    } catch (e) { setError(e instanceof Error ? e.message : t("fpay.loadFailed")); } finally { setSaving(false); }
  }
  if (data.blocked === "perBooking") {
    return (
      <section aria-labelledby="fpay-title" className="mb-8">
        <h2 id="fpay-title" className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("fpay.title")}</h2>
        <Card className="mt-2 flex flex-wrap items-center gap-3 p-4">
          <div role="status" className="text-[13.5px] font-bold">{t("fpay.perBookingBanner")}</div>
          {data.canSettle && <Button variant="primary" disabled={saving} onClick={usePercentage}>{t("fpay.switchToPercent")}</Button>}
        </Card>
      </section>
    );
  }
  return (
    <section aria-labelledby="fpay-title" className="mb-8">
      <h2 id="fpay-title" className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("fpay.title")}</h2>
      <p className="mb-3 mt-1 text-[12.5px] text-[var(--ink-3)]">{t("fpay.lede")}</p>

      {data.canSettle && (
        <Card className="mb-3 flex flex-wrap items-end gap-3 p-3">
          <div className="text-[15px] font-extrabold">{t("fpay.keepsPct", { rate: String(data.rate) })}</div>
          <div>
            <FieldLabel>{t("fpay.rateLabel")}</FieldLabel>
            <Input type="number" min="0" max="100" step="0.01" value={rate} onChange={(e) => { setRate(e.target.value); setSaved(false); }} className="w-28" />
          </div>
          <Button variant="primary" disabled={saving || !rateChanged} onClick={saveRate}>{t("fpay.save")}</Button>
          {saved && <span role="status" className="text-[12px] font-bold text-[var(--green,#0f9d58)]">{t("fpay.saved")}</span>}
          {(data.upcoming ?? []).map((u) => <div key={u.from} className="basis-full text-[11.5px] font-bold text-[var(--ink-2)]">{u.rate}% {t("fpay.fromDate", { date: u.from })}</div>)}
          <div className="basis-full text-[11.5px] text-[var(--ink-3)]">{t("fpay.rateNote")}</div>
        </Card>
      )}

      <PeriodPicker w={w} today={data.range.today} />
      <div className="mb-3 text-[11.5px] text-[var(--ink-3)]">{data.range.from} - {data.range.to}. {t("fpay.basis")}</div>

      {data.rows.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{t("fpay.noFranchises")}</Card>
        : data.rows.map((r) => <PayoutCard key={r.franchiseId} row={r} range={data.range} canSettle={data.canSettle} onSettled={refresh} />)}

      <div className="text-[11.5px] text-[var(--ink-3)]">{t("fpay.footnote")}</div>
      <History list={data.settlements} showName />
    </section>
  );
}

/** A franchise's own read-only statement: only its own row, never another franchise's. */
export function FranchiseStatement() {
  const t = useT();
  const w = useWindow();
  const [data, setData] = useState<MinePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiGet<MinePayload>(`/api/splitfees/payouts/mine${w.query ? `?${w.query}` : ""}`).then((p) => { setData(p); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : t("fpay.loadFailed")));
  }, [w.query, t]);
  if (error) return <div role="alert" className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!data) return <div className="py-6 text-center text-[12.5px] text-[var(--ink-3)]">{t("fpay.loading")}</div>;
  if (data.blocked || !data.row) return null;
  return (
    <section aria-labelledby="fpay-mine" className="mb-6">
      <h2 id="fpay-mine" className="mb-2 text-[18px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("fpay.yourStatement")}</h2>
      <PeriodPicker w={w} today={data.range.today} />
      <div className="mb-3 text-[11.5px] text-[var(--ink-3)]">{data.range.from} - {data.range.to}. {t("fpay.basis")}</div>
      <PayoutCard row={data.row} range={data.range} canSettle={false} name="" />
      <div className="text-[11.5px] text-[var(--ink-3)]">{t("fpay.footnote")}</div>
      <History list={data.settlements} showName={false} />
    </section>
  );
}
