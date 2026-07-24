"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { get as apiGet, post as apiPost, put as apiPut, del } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Card } from "@/components/ui";

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;

type Repeat = "weekly" | "fortnightly" | "monthly";
interface Income { id: string; date: string; category: string; amount: number; source?: string; notes?: string; repeat?: Repeat; repeatUntil?: string; seriesId?: string; virtual?: boolean }
interface Payload { items: Income[]; summary: { total: number; count: number; byCategory: Record<string, number> } }
interface Invoice { id: string; customerName: string; reference?: string; amount: number; date: string; status: string; paidAt?: string }
interface InvPayload { items: Invoice[] }

const CATEGORIES = ["Sessions", "Camps", "Memberships", "Merchandise", "Grants", "Fundraising", "Deposits", "Other"];
const INVOICE_CAT = "Invoices";
const CAT_ICON: Record<string, string> = {
  Sessions: "🎟️", Camps: "⛺", Memberships: "💳", Merchandise: "🧢", Grants: "🏛️",
  Fundraising: "🎗️", Deposits: "🐷", Invoices: "📄", Other: "•",
};
const icon = (c: string) => CAT_ICON[c] ?? "•";
const REPEAT_LABEL: Record<Repeat, string> = { weekly: "week", fortnightly: "2 weeks", monthly: "month" };

const fmtDay = (iso: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const todayIso = () => new Date().toISOString().slice(0, 10);
const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

type Tab = "overview" | "ledger" | "categories";
type Range = "all" | "month" | "lastmonth" | "year";
type Sort = "date" | "oldest" | "amount" | "amountAsc";
type Editor = { id?: string; date: string; category: string; amount: string; source: string; notes: string; repeat: "none" | Repeat; repeatUntil: string; seriesId?: string };

// Money section house style — navy blue, matching Expenses and Invoices.
const ACCENT = "#1d3a8f", ACCENT_DK = "#16306e";
const btnPrimary = "inline-flex items-center gap-1.5 rounded-full bg-[#1d3a8f] px-3.5 py-2 text-[12.5px] font-extrabold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50";
const btnGhost = "inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink)] transition hover:border-[var(--ink-3)]";
const fieldCls = "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none focus:border-[#cdddf7]";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]";
const pill = "rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink)] outline-none";

export function IncomeApp({ embedded = false }: { embedded?: boolean } = {}) {
  const [data, setData] = useState<Payload | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [newCat, setNewCat] = useState(false);
  const [saving, setSaving] = useState(false);

  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [range, setRange] = useState<Range>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<Sort>("date");

  const refresh = useCallback(() => {
    apiGet<Payload>("/api/income").then((p) => { setData(p); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    apiGet<InvPayload>("/api/invoices").then((p) => setInvoices(p.items ?? [])).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["income", "invoices"], refresh);

  const logged = useMemo(() => data?.items ?? [], [data]); // real, editable income
  const now = useMemo(() => new Date(), []);
  const thisMonthKey = monthKeyOf(now);
  const lastMonthKey = monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const thisYear = String(now.getFullYear());

  // Paid invoices ARE money in — folded in as read-only rows so Income shows the
  // whole picture without you re-keying them. Dated by when they were paid.
  const invoiceRows = useMemo<Income[]>(() => invoices
    .filter((v) => v.status === "paid")
    .map((v) => ({ id: `inv-${v.id}`, date: (v.paidAt || v.date || "").slice(0, 10), category: INVOICE_CAT, amount: v.amount, source: v.customerName, notes: v.reference ? `Invoice ${v.reference}` : "Invoice", virtual: true })), [invoices]);

  const allItems = useMemo(() => [...invoiceRows, ...logged], [invoiceRows, logged]);

  // ── Analytics ──
  const monthly = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { key: monthKeyOf(d), label: d.toLocaleDateString("en-GB", { month: "short" }) };
    });
    return months.map((m) => {
      const rows = allItems.filter((x) => (x.date || "").slice(0, 7) === m.key);
      return { ...m, total: rows.reduce((s, x) => s + x.amount, 0), count: rows.length };
    });
  }, [allItems, now]);

  const sumWhere = (pred: (x: Income) => boolean) => allItems.filter(pred).reduce((s, x) => s + x.amount, 0);
  const thisMonthTotal = useMemo(() => sumWhere((x) => (x.date || "").slice(0, 7) === thisMonthKey), [allItems, thisMonthKey]);
  const lastMonthTotal = useMemo(() => sumWhere((x) => (x.date || "").slice(0, 7) === lastMonthKey), [allItems, lastMonthKey]);
  const yearTotal = useMemo(() => sumWhere((x) => (x.date || "").slice(0, 4) === thisYear), [allItems, thisYear]);
  const grandTotal = useMemo(() => allItems.reduce((s, x) => s + x.amount, 0), [allItems]);
  const count = allItems.length;
  const avg = count ? grandTotal / count : 0;
  const biggest = useMemo(() => allItems.reduce<Income | null>((m, x) => (!m || x.amount > m.amount ? x : m), null), [allItems]);
  const deltaPct = lastMonthTotal > 0 ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100) : null;

  const cats = useMemo(() => {
    const by: Record<string, { total: number; count: number }> = {};
    for (const x of allItems) { const c = x.category || "Other"; (by[c] ||= { total: 0, count: 0 }); by[c].total += x.amount; by[c].count++; }
    return Object.entries(by).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.total - a.total);
  }, [allItems]);

  const sources = useMemo(() => {
    const by: Record<string, { total: number; count: number }> = {};
    for (const x of allItems) { if (!x.source) continue; (by[x.source] ||= { total: 0, count: 0 }); by[x.source].total += x.amount; by[x.source].count++; }
    return Object.entries(by).map(([source, v]) => ({ source, ...v })).sort((a, b) => b.total - a.total);
  }, [allItems]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = allItems.filter((x) => {
      const d = x.date || "";
      if (catFilter !== "all" && (x.category || "Other") !== catFilter) return false;
      if (range === "month" && d.slice(0, 7) !== thisMonthKey) return false;
      if (range === "lastmonth" && d.slice(0, 7) !== lastMonthKey) return false;
      if (range === "year" && d.slice(0, 4) !== thisYear) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (needle && !`${x.source ?? ""} ${x.notes ?? ""} ${x.category ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const cmp: Record<Sort, (a: Income, b: Income) => number> = {
      date: (a, b) => (a.date < b.date ? 1 : -1), oldest: (a, b) => (a.date > b.date ? 1 : -1),
      amount: (a, b) => b.amount - a.amount, amountAsc: (a, b) => a.amount - b.amount,
    };
    return [...rows].sort(cmp[sort]);
  }, [allItems, q, catFilter, range, from, to, sort, thisMonthKey, lastMonthKey, thisYear]);
  const filteredTotal = filtered.reduce((s, x) => s + x.amount, 0);
  const activeFilters = (catFilter !== "all" ? 1 : 0) + (range !== "all" ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0) + (q.trim() ? 1 : 0);
  const clearFilters = () => { setQ(""); setCatFilter("all"); setRange("all"); setFrom(""); setTo(""); };

  const recent = useMemo(() => [...allItems].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5), [allItems]);
  const catOptions = useMemo(() => Array.from(new Set([...CATEGORIES, ...logged.map((x) => x.category)])), [logged]);

  // ── Actions ──
  const openAdd = () => { setNewCat(false); setEditor({ date: todayIso(), category: "Sessions", amount: "", source: "", notes: "", repeat: "none", repeatUntil: "" }); };
  const openEdit = (x: Income) => { setNewCat(false); setEditor({ id: x.id, date: x.date, category: x.category, amount: String(x.amount), source: x.source ?? "", notes: x.notes ?? "", repeat: x.repeat ?? "none", repeatUntil: x.repeatUntil ?? "", seriesId: x.seriesId }); };

  async function save() {
    if (!editor) return;
    const amt = Number(editor.amount);
    const catName = editor.category.trim();
    if (!catName) { setError("Pick or name a category."); return; }
    if (!amt || amt < 0) { setError("Enter a valid amount."); return; }
    const isNewSeries = !editor.id && editor.repeat !== "none";
    if (isNewSeries && (!editor.repeatUntil || editor.repeatUntil <= editor.date)) { setError("For a repeat, pick an ‘until’ date after the start date."); return; }
    setSaving(true);
    const body: Record<string, unknown> = { date: editor.date, category: catName, amount: amt, source: editor.source.trim() || undefined, notes: editor.notes.trim() || undefined };
    if (isNewSeries) { body.repeat = editor.repeat; body.repeatUntil = editor.repeatUntil; }
    try {
      if (editor.id) await apiPut(`/api/income/${encodeURIComponent(editor.id)}`, body);
      else await apiPost("/api/income", body);
      setEditor(null); setError(null); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); } finally { setSaving(false); }
  }
  async function remove(x: Income) {
    if (x.virtual || !confirm(`Delete this ${money(x.amount)} income entry?`)) return;
    try { await del(`/api/income/${encodeURIComponent(x.id)}`); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }
  async function deleteSeries() {
    if (!editor?.seriesId) return;
    if (!confirm("Delete every entry in this repeating series?")) return;
    try { await del(`/api/income/series/${encodeURIComponent(editor.seriesId)}`); setEditor(null); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }
  function exportCsv() {
    const header = ["Date", "Category", "Amount", "Source", "Notes", "Source type"];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = filtered.map((x) => [x.date, x.category, x.amount, x.source ?? "", x.notes ?? "", x.virtual ? "paid invoice" : "logged"]);
    const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `income-${range}-${todayIso()}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className={embedded ? "text-[var(--ink)]" : "-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]"} style={embedded ? undefined : LIGHT_PALETTE}>
      {!embedded && (
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#16306e 0%,#3f78d8 60%,#ffffff 100%)" }}>
        <button type="button" onClick={openAdd} className="absolute right-4 top-4 z-10 rounded-full bg-[#16306e] px-3.5 py-1.5 text-[12px] font-extrabold text-white shadow-md transition-transform hover:-translate-y-px">＋ Log income</button>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">💰</span>
          Income
        </div>
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">Every pound coming in — paid invoices fold in automatically, and you can log cash takings, grants and anything else here.</p>
      </div>
      )}

      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {/* Tabs */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex flex-wrap rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 text-[12.5px] font-bold">
          {([["overview", "Overview"], ["ledger", "All income"], ["categories", "Categories"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className="rounded-full px-4 py-1.5 transition-colors" style={tab === k ? { background: ACCENT, color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
          ))}
        </div>
        <button type="button" onClick={openAdd} className={btnPrimary}>＋ Log income</button>
      </div>

      {!data ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : allItems.length === 0 ? (
        <Card className="p-8 text-center text-[13px] text-[var(--ink-3)]">
          <div className="text-[30px]">💰</div>
          <div className="mt-1 text-[15px] font-extrabold text-[var(--ink)]">No income yet</div>
          <p className="mx-auto mt-1 max-w-[420px] leading-[1.6]">Paid invoices land here automatically. Log cash on the door, a grant or any other takings to see your money-in totals, categories and monthly trend build up.</p>
          <button type="button" onClick={openAdd} className={`${btnPrimary} mx-auto mt-4`}>＋ Log your first income</button>
        </Card>
      ) : tab === "overview" ? (
        <div className="flex flex-col gap-3.5">
          <Card className="grid gap-3 p-4 sm:grid-cols-4">
            <div><div className="text-[20px] font-extrabold leading-none">{money(thisMonthTotal)}</div><div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-[var(--ink-3)]">in this month{deltaPct !== null && <span className={`font-bold ${deltaPct >= 0 ? "text-[#1d3a8f]" : "text-[#d0693b]"}`}>{deltaPct >= 0 ? "▲" : "▼"}{Math.abs(deltaPct)}%</span>}</div></div>
            <div><div className="text-[20px] font-extrabold leading-none">{money(lastMonthTotal)}</div><div className="mt-1 text-[11.5px] text-[var(--ink-3)]">last month</div></div>
            <div><div className="text-[20px] font-extrabold leading-none">{money(yearTotal)}</div><div className="mt-1 text-[11.5px] text-[var(--ink-3)]">in {thisYear}</div></div>
            <div><div className="text-[20px] font-extrabold leading-none">{biggest ? money(biggest.amount) : "—"}</div><div className="mt-1 truncate text-[11.5px] text-[var(--ink-3)]">biggest{biggest ? ` · ${biggest.category}` : ""}</div></div>
          </Card>

          {(() => {
            const max = Math.max(1, ...monthly.map((m) => m.total));
            return (
              <Card className="p-4">
                <div className="mb-3 flex items-baseline justify-between"><div className="text-[13.5px] font-extrabold">Last 6 months</div><div className="text-[11px] text-[var(--ink-3)]">money in per month</div></div>
                <div className="flex items-end gap-3">
                  {monthly.map((m) => (
                    <div key={m.key} className="flex flex-1 flex-col items-center" title={`${m.label}: ${money(m.total)} · ${m.count} entr${m.count === 1 ? "y" : "ies"}`}>
                      <div className="mb-1 text-[10.5px] font-bold text-[var(--ink-2)]">{m.total > 0 ? money(m.total) : ""}</div>
                      <div className="w-full max-w-[46px] rounded-t-[4px]" style={{ height: `${8 + (m.total / max) * 96}px`, background: m.key === thisMonthKey ? `linear-gradient(180deg,${ACCENT},${ACCENT_DK})` : "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }} />
                      <div className="mt-1.5 text-[11px] font-bold text-[var(--ink-3)]">{m.label}</div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })()}

          <div className="grid gap-3.5 lg:grid-cols-2">
            <Card className="p-4">
              <div className="mb-2.5 text-[13.5px] font-extrabold">Where it comes from</div>
              <div className="flex flex-col gap-2">
                {cats.slice(0, 8).map((c) => (
                  <div key={c.category}>
                    <div className="mb-0.5 flex items-baseline justify-between text-[12px]">
                      <span className="truncate font-bold">{icon(c.category)} {c.category}</span>
                      <span className="flex-none tabular-nums"><b>{money(c.total)}</b> <span className="text-[var(--ink-3)]">· {Math.round((c.total / grandTotal) * 100)}%</span></span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${Math.max(3, (c.total / cats[0].total) * 100)}%`, background: `linear-gradient(90deg,#4f8bf5,${ACCENT_DK})` }} /></div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-2.5 text-[13.5px] font-extrabold">Top sources</div>
              {sources.length === 0 ? <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">Add a source when logging to see this.</div> : (
                <div className="flex flex-col">
                  {sources.slice(0, 6).map((s, i) => (
                    <div key={s.source} className="flex items-center gap-3 border-b border-dashed border-[var(--line)] py-2 text-[12.5px] last:border-b-0">
                      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#eaf0fc] text-[11px] font-extrabold text-[#16306e]">{i + 1}</span>
                      <div className="min-w-0 flex-1 truncate font-bold">{s.source}</div>
                      <div className="flex-none text-right"><div className="font-extrabold tabular-nums">{money(s.total)}</div><div className="text-[10.5px] text-[var(--ink-3)]">{s.count}×</div></div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card className="p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="text-[13.5px] font-extrabold">Recent</div>
              <button type="button" onClick={() => setTab("ledger")} className="text-[12px] font-bold text-[#16306e] hover:underline">View all →</button>
            </div>
            <div className="flex flex-col">
              {recent.map((x) => (
                <div key={x.id} className="flex items-center gap-2.5 border-b border-dashed border-[var(--line)] py-2 text-[12.5px] last:border-b-0">
                  <span className="w-[92px] flex-none text-[11.5px] text-[var(--ink-3)]">{fmtDay(x.date)}</span>
                  <span className="flex-none rounded-md bg-[var(--panel)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--ink-2)]">{icon(x.category)} {x.category}</span>
                  {x.virtual ? <span className="flex-none text-[11px]" title="Paid invoice">📄</span> : x.seriesId ? <span className="flex-none text-[11px]" title={`Repeats every ${x.repeat ? REPEAT_LABEL[x.repeat] : ""}`}>🔁</span> : null}
                  <span className="min-w-0 flex-1 truncate text-[var(--ink-3)]">{x.source || "—"}{x.notes ? ` · ${x.notes}` : ""}</span>
                  <span className="flex-none font-extrabold tabular-nums">{money(x.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : tab === "ledger" ? (
        <div className="flex flex-col gap-3">
          <Card className="flex flex-col gap-2.5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[var(--ink-3)]">🔍</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search source or note…" className="w-[210px] rounded-full border border-[var(--line)] bg-[var(--surface)] py-1.5 pl-7 pr-3 text-[12px] text-[var(--ink)] outline-none focus:border-[#cdddf7]" />
              </div>
              <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={`${pill} rounded-full`}>
                <option value="all">All categories</option>
                {cats.map((c) => <option key={c.category} value={c.category}>{c.category}</option>)}
              </select>
              <div className="ml-auto flex items-center gap-2">
                <button type="button" onClick={exportCsv} className={btnGhost}>⬇ Export CSV</button>
                <button type="button" onClick={openAdd} className={btnPrimary}>＋ Log income</button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex overflow-hidden rounded-full border border-[var(--line)] text-[11.5px] font-bold">
                {([["all", "All time"], ["month", "This month"], ["lastmonth", "Last month"], ["year", "This year"]] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setRange(k)} className="px-3 py-1.5 transition-colors" style={range === k ? { background: ACCENT, color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
                ))}
              </div>
              <label className="flex items-center gap-1 text-[11.5px] text-[var(--ink-3)]">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--ink)] outline-none" /></label>
              <label className="flex items-center gap-1 text-[11.5px] text-[var(--ink-3)]">to <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--ink)] outline-none" /></label>
              <div className="inline-flex overflow-hidden rounded-full border border-[var(--line)] text-[11.5px] font-bold">
                {([["date", "Newest"], ["oldest", "Oldest"], ["amount", "Largest"], ["amountAsc", "Smallest"]] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setSort(k)} className="px-3 py-1.5 transition-colors" style={sort === k ? { background: ACCENT, color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
                ))}
              </div>
              {activeFilters > 0 && <button type="button" onClick={clearFilters} className="text-[11.5px] font-bold text-[#16306e] hover:underline">Clear {activeFilters} filter{activeFilters === 1 ? "" : "s"} ✕</button>}
            </div>
          </Card>

          <div className="flex items-baseline justify-between px-1 text-[12px] text-[var(--ink-3)]">
            <span><b className="text-[var(--ink)]">{filtered.length}</b> of {count} entr{count === 1 ? "y" : "ies"}</span>
            <span>showing <b className="text-[var(--ink)]">{money(filteredTotal)}</b></span>
          </div>

          {filtered.length === 0 ? <Card className="p-6 text-center text-[12.5px] text-[var(--ink-3)]">Nothing matches those filters.</Card> : (
            <div className="flex flex-col gap-1.5">
              {filtered.map((x) => (
                <Card key={x.id} className={`flex flex-wrap items-center gap-2.5 p-2.5 ${x.virtual ? "bg-[var(--panel)]" : ""}`}>
                  <span className="w-[104px] flex-none text-[11.5px] text-[var(--ink-3)]">{fmtDay(x.date)}</span>
                  <span className="flex-none rounded-md bg-[var(--panel)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--ink-2)]">{icon(x.category)} {x.category}</span>
                  {x.virtual ? <span className="flex-none rounded-md bg-[#eaf0fc] px-1.5 py-0.5 text-[10.5px] font-bold text-[#16306e]">📄 invoice</span> : x.seriesId ? <span className="flex-none rounded-md bg-[#eaf0fc] px-1.5 py-0.5 text-[10.5px] font-bold text-[#16306e]" title={x.repeatUntil ? `Repeats every ${x.repeat ? REPEAT_LABEL[x.repeat] : ""} until ${fmtDay(x.repeatUntil)}` : "Repeating"}>🔁 {x.repeat ? REPEAT_LABEL[x.repeat] : ""}</span> : null}
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">{x.source || <span className="text-[var(--ink-3)]">—</span>}{x.notes ? <span className="text-[var(--ink-3)]"> · {x.notes}</span> : ""}</span>
                  <span className="flex-none text-[13px] font-extrabold tabular-nums">{money(x.amount)}</span>
                  {x.virtual ? <span className="flex-none text-[10.5px] text-[var(--ink-3)]">auto</span> : (
                    <>
                      <button type="button" onClick={() => openEdit(x)} className="flex-none text-[var(--ink-3)] hover:text-[#16306e]" aria-label="Edit">✎</button>
                      <button type="button" onClick={() => remove(x)} className="flex-none text-[16px] leading-none text-[var(--ink-3)] hover:text-[var(--red)]" aria-label="Delete">×</button>
                    </>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {cats.map((c) => (
            <Card key={c.category} className="p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13.5px] font-extrabold">{icon(c.category)} {c.category}{c.category === INVOICE_CAT && <span className="ml-1.5 rounded-full bg-[#eaf0fc] px-1.5 py-0.5 text-[10px] font-bold text-[#16306e]">auto</span>}</div>
                <div className="text-[15px] font-extrabold tabular-nums">{money(c.total)}</div>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${Math.max(3, (c.total / (cats[0]?.total || 1)) * 100)}%`, background: `linear-gradient(90deg,#4f8bf5,${ACCENT_DK})` }} /></div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 text-[11.5px] text-[var(--ink-3)]">
                <span><b className="text-[var(--ink)]">{grandTotal ? Math.round((c.total / grandTotal) * 100) : 0}%</b> of income</span>
                <span><b className="text-[var(--ink)]">{c.count}</b> entr{c.count === 1 ? "y" : "ies"}</span>
                {c.count > 0 && <span>avg <b className="text-[var(--ink)]">{money(c.total / c.count)}</b></span>}
              </div>
            </Card>
          ))}
          <div className="flex items-baseline justify-between px-1 pt-1 text-[12.5px]"><span className="text-[var(--ink-3)]">Total across {cats.length} categor{cats.length === 1 ? "y" : "ies"}</span><span className="text-[15px] font-extrabold">{money(grandTotal)}</span></div>
        </div>
      )}

      {/* Add / edit modal */}
      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditor(null)}>
          <Card className="max-h-[92vh] w-[min(540px,94vw)] overflow-y-auto p-5" style={LIGHT_PALETTE}>
            <div onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 text-[16px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{editor.id ? "Edit income" : "Log income"}</div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <label className="block"><span className={labelCls}>Date</span><input type="date" value={editor.date} onChange={(e) => setEditor({ ...editor, date: e.target.value })} className={fieldCls} /></label>
                <div className="block">
                  <span className={labelCls}>Category</span>
                  {newCat ? (
                    <div className="flex gap-1">
                      <input autoFocus value={editor.category} onChange={(e) => setEditor({ ...editor, category: e.target.value })} placeholder="New category name" className={fieldCls} />
                      <button type="button" onClick={() => { setNewCat(false); setEditor({ ...editor, category: catOptions[0] ?? "Other" }); }} className="flex-none rounded-lg border border-[var(--line)] px-2 text-[12px] font-bold text-[var(--ink-3)]" title="Pick existing">↩</button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <select value={editor.category} onChange={(e) => setEditor({ ...editor, category: e.target.value })} className={fieldCls}>{catOptions.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                      <button type="button" onClick={() => { setNewCat(true); setEditor({ ...editor, category: "" }); }} className="flex-none whitespace-nowrap rounded-lg border border-[var(--line)] px-2 text-[12px] font-bold text-[#16306e]">＋ New</button>
                    </div>
                  )}
                </div>
                <label className="block"><span className={labelCls}>Amount (£)</span><input type="number" min="0" step="0.01" value={editor.amount} onChange={(e) => setEditor({ ...editor, amount: e.target.value })} placeholder="0.00" className={fieldCls} /></label>
                <label className="block"><span className={labelCls}>Source</span><input value={editor.source} onChange={(e) => setEditor({ ...editor, source: e.target.value })} placeholder="Who it came from" className={fieldCls} /></label>
              </div>
              <label className="mt-2.5 block"><span className={labelCls}>Notes</span><input value={editor.notes} onChange={(e) => setEditor({ ...editor, notes: e.target.value })} placeholder="What was it for?" className={fieldCls} /></label>

              {!editor.id && (
                <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                  <label className="block"><span className={labelCls}>Repeat</span>
                    <select value={editor.repeat} onChange={(e) => setEditor({ ...editor, repeat: e.target.value as Editor["repeat"] })} className={fieldCls}>
                      <option value="none">One-off</option>
                      <option value="weekly">Every week</option>
                      <option value="fortnightly">Every 2 weeks</option>
                      <option value="monthly">Every month</option>
                    </select>
                  </label>
                  {editor.repeat !== "none" && <label className="block"><span className={labelCls}>Repeat until</span><input type="date" min={editor.date} value={editor.repeatUntil} onChange={(e) => setEditor({ ...editor, repeatUntil: e.target.value })} className={fieldCls} /></label>}
                </div>
              )}
              {editor.id && editor.seriesId && (
                <div className="mt-2.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[11.5px] text-[var(--ink-3)]">🔁 Part of a repeating series. Saving changes only this entry. <button type="button" onClick={deleteSeries} className="font-bold text-[var(--red,#e21d27)] hover:underline">Delete whole series</button></div>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setEditor(null)} className={btnGhost}>Cancel</button>
                <button type="button" onClick={save} disabled={saving} className={btnPrimary}>{saving ? "Saving…" : editor.id ? "Save changes" : editor.repeat !== "none" ? "Create series" : "Log income"}</button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
