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
interface Income { id: string; date: string; category: string; amount: number; source?: string; notes?: string; method?: string; repeat?: Repeat; repeatUntil?: string; seriesId?: string; virtual?: boolean }
interface Payload { items: Income[]; summary: { total: number; count: number; byCategory: Record<string, number> } }
interface Invoice { id: string; customerName: string; reference?: string; amount: number; date: string; dueDate?: string; status: string; paidAt?: string; paidVia?: "link" | "manual"; overdue?: boolean }
interface InvPayload { items: Invoice[] }
interface Booking { ref?: string; pay?: string; method?: string; amount?: number; amountPaid?: number; createdAt?: string; booker?: string; listing?: string }

const CATEGORIES = ["Sessions", "Camps", "Memberships", "Merchandise", "Grants", "Fundraising", "Deposits", "Other"];
const INVOICE_CAT = "Invoices";
const BOOKINGS_CAT = "Bookings";
const CAT_ICON: Record<string, string> = {
  Bookings: "🎟️", Invoices: "📄", Sessions: "🏃", Camps: "⛺", Memberships: "💳", Merchandise: "🧢", Grants: "🏛️",
  Fundraising: "🎗️", Deposits: "🐷", Other: "•",
};
const icon = (c: string) => CAT_ICON[c] ?? "•";
// Payment "type" for the by-method breakdown. Normalises the many booking
// method strings + invoice/manual sources into a tidy, icon-led set.
const METHOD_ICON: Record<string, string> = {
  Card: "💳", "Bank transfer": "🏦", "Tax-Free Childcare": "🧸", "Childcare vouchers": "🎟️",
  "HAF (funded £0)": "🍎", "Free place": "🎗️", Cash: "💵", PayPal: "🅿️", Invoice: "📄", "Store credit": "👛", Other: "•",
};
const methodIcon = (m: string) => METHOD_ICON[m] ?? "💰";
// Fold the assorted raw method labels down to the tidy set above.
function normaliseMethod(raw?: string): string {
  const m = (raw || "").trim();
  if (!m || m === "—") return "Other";
  if (/cash/i.test(m)) return "Cash";
  if (/paypal/i.test(m)) return "PayPal";
  if (/tax.?free|tfc/i.test(m)) return "Tax-Free Childcare";
  if (/voucher/i.test(m)) return "Childcare vouchers";
  if (/haf/i.test(m)) return "HAF (funded £0)";
  if (/free/i.test(m)) return "Free place";
  if (/bank|transfer/i.test(m)) return "Bank transfer";
  if (/card/i.test(m)) return "Card";
  return m;
}
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
// A tasteful multi-hue palette (blue family + gold/violet, no green/red) so the
// payment-type breakdown reads fancy without leaving the blue house style.
const HUES = [
  { soft: "#eaf0fc", text: "#1d3a8f", bar: "linear-gradient(90deg,#4f8bf5,#16306e)" },
  { soft: "#ece9fd", text: "#4b3bc9", bar: "linear-gradient(90deg,#8a7bf0,#4b3bc9)" },
  { soft: "#f6e9fb", text: "#8a2fb0", bar: "linear-gradient(90deg,#c46ee0,#8a2fb0)" },
  { soft: "#fbeede", text: "#a9660a", bar: "linear-gradient(90deg,#f2b24a,#c67d12)" },
  { soft: "#e5f2fd", text: "#1f77c9", bar: "linear-gradient(90deg,#5bb3f0,#1f77c9)" },
  { soft: "#eceff4", text: "#48566e", bar: "linear-gradient(90deg,#8aa0c0,#48566e)" },
  { soft: "#e8ecfb", text: "#2f3fa8", bar: "linear-gradient(90deg,#6d84e8,#2f3fa8)" },
];
// Stable hue per label so a category always gets the same colour.
const hueFor = (label: string) => HUES[[...label].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
// Up-to-two-letter initials for a name, for tidy avatar chips.
const initials = (name: string) => (name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2) || "?").toUpperCase();
// Refined monochrome line icons for the at-a-glance tiles (classy, not emoji).
const statSvg = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const IcCoins = () => <svg {...statSvg}><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" /><path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" /></svg>;
const IcTrend = () => <svg {...statSvg}><path d="M3 17l6-6 4 4 7-7" /><path d="M17 7h4v4" /></svg>;
const IcBars = () => <svg {...statSvg}><path d="M6 20v-6M12 20V9M18 20v-9" /></svg>;
const IcAward = () => <svg {...statSvg}><circle cx="12" cy="9" r="5" /><path d="M9 13.4 8 22l4-2.2L16 22l-1-8.6" /></svg>;
const btnPrimary = "inline-flex items-center gap-1.5 rounded-full bg-[#1d3a8f] px-3.5 py-2 text-[12.5px] font-extrabold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50";
const btnGhost = "inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink)] transition hover:border-[var(--ink-3)]";
const fieldCls = "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none focus:border-[#cdddf7]";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]";
const pill = "rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink)] outline-none";

export function IncomeApp({ embedded = false }: { embedded?: boolean } = {}) {
  const [data, setData] = useState<Payload | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [newCat, setNewCat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAllAwaiting, setShowAllAwaiting] = useState(false);
  const [trendMode, setTrendMode] = useState<"7d" | "month" | "6m" | "9m" | "year">("6m");
  // Overview breakdowns can be scoped to a period (independent of the ledger).
  const [ovRange, setOvRange] = useState<Range>("all");
  const [ovFrom, setOvFrom] = useState("");
  const [ovTo, setOvTo] = useState("");

  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [range, setRange] = useState<Range>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<Sort>("date");

  const refresh = useCallback(() => {
    apiGet<Payload>("/api/income").then((p) => { setData(p); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    apiGet<InvPayload>("/api/invoices").then((p) => setInvoices(p.items ?? [])).catch(() => {});
    apiGet<Booking[]>("/api/bookings").then((b) => setBookings(Array.isArray(b) ? b : [])).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["income", "invoices", "bookings"], refresh);

  const logged = useMemo(() => data?.items ?? [], [data]); // real, editable income
  const now = useMemo(() => new Date(), []);
  const thisMonthKey = monthKeyOf(now);
  const lastMonthKey = monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const thisYear = String(now.getFullYear());

  // Money in from bookings taken through the platform — read-only rows, tagged
  // with the payment method so the by-type breakdown works. Dated by when the
  // booking was taken; amountPaid wins over the headline amount.
  const bookingRows = useMemo<Income[]>(() => bookings
    .map((b) => {
      const paid = b.amountPaid != null ? b.amountPaid : (b.pay === "Paid" ? (b.amount ?? 0) : 0);
      return { b, paid };
    })
    .filter(({ paid }) => paid > 0)
    .map(({ b, paid }) => ({ id: `bk-${b.ref}`, date: (b.createdAt || "").slice(0, 10), category: BOOKINGS_CAT, amount: paid, source: b.booker || b.listing, notes: [b.listing, b.ref].filter(Boolean).join(" · "), method: normaliseMethod(b.method), virtual: true })), [bookings]);

  // Paid invoices ARE money in — folded in as read-only rows so Income shows the
  // whole picture without you re-keying them. Dated by when they were paid.
  const invoiceRows = useMemo<Income[]>(() => invoices
    .filter((v) => v.status === "paid")
    .map((v) => ({ id: `inv-${v.id}`, date: (v.paidAt || v.date || "").slice(0, 10), category: INVOICE_CAT, amount: v.amount, source: v.customerName, notes: v.reference ? `Invoice ${v.reference}` : "Invoice", method: "Invoice", virtual: true })), [invoices]);

  const allItems = useMemo(() => [...bookingRows, ...invoiceRows, ...logged], [bookingRows, invoiceRows, logged]);

  // ── Analytics ──
  // Trend chart — daily buckets for the short windows, monthly for the long ones.
  const trend = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    if (trendMode === "7d" || trendMode === "month") {
      const days = trendMode === "7d" ? 7 : 30;
      const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      return Array.from({ length: days }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - i));
        const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const rows = allItems.filter((x) => (x.date || "") === key);
        return { key, label: trendMode === "7d" ? d.toLocaleDateString("en-GB", { weekday: "short" }) : String(d.getDate()), total: rows.reduce((s, x) => s + x.amount, 0), count: rows.length, current: key === todayKey };
      });
    }
    const months = trendMode === "6m" ? 6 : trendMode === "9m" ? 9 : 12;
    return Array.from({ length: months }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      const key = monthKeyOf(d);
      const rows = allItems.filter((x) => (x.date || "").slice(0, 7) === key);
      return { key, label: d.toLocaleDateString("en-GB", { month: "short" }), total: rows.reduce((s, x) => s + x.amount, 0), count: rows.length, current: key === thisMonthKey };
    });
  }, [allItems, trendMode, now, thisMonthKey]);

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

  // (Booking payment-type split is computed per selected period below — see ovByMethod.)

  // Money still owed you — unpaid invoices, largest first.
  const awaiting = useMemo(() => invoices
    .filter((v) => v.status === "sent")
    .sort((a, b) => b.amount - a.amount), [invoices]);
  const awaitingTotal = useMemo(() => awaiting.reduce((s, v) => s + v.amount, 0), [awaiting]);
  const overdueCount = useMemo(() => awaiting.filter((v) => v.overdue).length, [awaiting]);

  // This year at a glance — best month, run-rate, biggest single payment.
  const yearStats = useMemo(() => {
    const rows = allItems.filter((x) => (x.date || "").slice(0, 4) === thisYear);
    const byMonth: Record<string, number> = {};
    for (const x of rows) { const k = (x.date || "").slice(0, 7); if (k) byMonth[k] = (byMonth[k] ?? 0) + x.amount; }
    const months = Object.entries(byMonth).sort((a, b) => b[1] - a[1]);
    const collected = rows.reduce((s, x) => s + x.amount, 0);
    return { collected, best: months[0] as [string, number] | undefined, activeMonths: months.length, avg: months.length ? collected / months.length : 0, largest: rows.reduce((m, x) => Math.max(m, x.amount), 0) };
  }, [allItems, thisYear]);
  const monthLabel = (key: string) => key ? new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "";

  // Period-scoped set that drives the two overview breakdown cards.
  const ovItems = useMemo(() => allItems.filter((x) => {
    const d = x.date || "";
    if (ovRange === "month" && d.slice(0, 7) !== thisMonthKey) return false;
    if (ovRange === "lastmonth" && d.slice(0, 7) !== lastMonthKey) return false;
    if (ovRange === "year" && d.slice(0, 4) !== thisYear) return false;
    if (ovFrom && d < ovFrom) return false;
    if (ovTo && d > ovTo) return false;
    return true;
  }), [allItems, ovRange, ovFrom, ovTo, thisMonthKey, lastMonthKey, thisYear]);
  const ovTotal = useMemo(() => ovItems.reduce((s, x) => s + x.amount, 0), [ovItems]);
  const ovCats = useMemo(() => {
    const by: Record<string, { total: number; count: number }> = {};
    for (const x of ovItems) { const c = x.category || "Other"; (by[c] ||= { total: 0, count: 0 }); by[c].total += x.amount; by[c].count++; }
    return Object.entries(by).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.total - a.total);
  }, [ovItems]);
  const ovBookingsTotal = useMemo(() => ovItems.filter((x) => x.category === BOOKINGS_CAT).reduce((s, x) => s + x.amount, 0), [ovItems]);
  const ovByMethod = useMemo(() => {
    const by: Record<string, { total: number; count: number }> = {};
    for (const x of ovItems) { if (x.category !== BOOKINGS_CAT) continue; const m = x.method || "Other"; (by[m] ||= { total: 0, count: 0 }); by[m].total += x.amount; by[m].count++; }
    return Object.entries(by).map(([method, v]) => ({ method, ...v })).sort((a, b) => b.total - a.total);
  }, [ovItems]);
  const ovActive = ovRange !== "all" || !!ovFrom || !!ovTo;
  const ovRangeLabel = ovRange === "month" ? "this month" : ovRange === "lastmonth" ? "last month" : ovRange === "year" ? thisYear : ovFrom || ovTo ? "custom range" : "all time";

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
    const header = ["Date", "Category", "Amount", "Source", "Payment type", "Notes", "Source type"];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = filtered.map((x) => [x.date, x.category, x.amount, x.source ?? "", x.method ?? "", x.notes ?? "", x.category === BOOKINGS_CAT ? "booking" : x.virtual ? "paid invoice" : "logged"]);
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
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">Every pound coming in — paid bookings and invoices fold in automatically (by payment type), and you can log cash takings, grants and anything else here.</p>
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
            const max = Math.max(1, ...trend.map((m) => m.total));
            const isDaily = trendMode === "7d" || trendMode === "month";
            const title = trendMode === "7d" ? "Last 7 days" : trendMode === "month" ? "Last 30 days" : trendMode === "6m" ? "Last 6 months" : trendMode === "9m" ? "Last 9 months" : "Last 12 months";
            const header = (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[13.5px] font-extrabold">{title}</div>
                <div className="inline-flex overflow-hidden rounded-full border border-[var(--line)] text-[11px] font-bold">
                  {([["7d", "7 days"], ["month", "Month"], ["6m", "6 months"], ["9m", "9 months"], ["year", "Year"]] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setTrendMode(k)} className="px-2.5 py-1 transition-colors" style={trendMode === k ? { background: ACCENT, color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
                  ))}
                </div>
              </div>
            );
            if (isDaily) {
              const W = 600, H = 132, PAD = 16, n = trend.length;
              const px = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
              const py = (t: number) => H - PAD - (t / max) * (H - PAD * 2);
              const pts = trend.map((m, i) => ({ x: px(i), y: py(m.total), m, i }));
              const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
              const area = `${line} L${W},${H} L0,${H} Z`;
              const peak = pts.reduce((a, b) => (b.m.total > a.m.total ? b : a), pts[0]);
              const labelIdx = trend.map((_, i) => i).filter((i) => i === 0 || i === n - 1 || i % Math.max(1, Math.round(n / 6)) === 0);
              return (
                <Card className="p-4">
                  {header}
                  <div className="relative pt-4">
                    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 132, display: "block", overflow: "visible" }}>
                      <defs><linearGradient id="incArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3f78d8" stopOpacity="0.26" /><stop offset="1" stopColor="#3f78d8" stopOpacity="0" /></linearGradient></defs>
                      {[0.25, 0.5, 0.75].map((f) => { const y = PAD + f * (H - 2 * PAD); return <line key={f} x1="0" x2={W} y1={y} y2={y} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />; })}
                      <path d={area} fill="url(#incArea)" />
                      <path d={line} fill="none" stroke="#1d3a8f" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    </svg>
                    {peak.m.total > 0 && <>
                      <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-[#1d3a8f] px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm" style={{ left: `${(peak.x / W) * 100}%`, top: `calc(${(peak.y / H) * 100}% - 4px)` }}>{money(peak.m.total)}</div>
                      <span className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#1d3a8f] shadow-sm" style={{ left: `${(peak.x / W) * 100}%`, top: `${(peak.y / H) * 100}%` }} />
                    </>}
                  </div>
                  <div className="relative mt-2 h-3.5 text-[10px] font-bold text-[var(--ink-3)]">
                    {labelIdx.map((i) => <span key={i} className="absolute -translate-x-1/2 tabular-nums" style={{ left: `${Math.min(97, Math.max(3, (pts[i].x / W) * 100))}%` }}>{trend[i].label}</span>)}
                  </div>
                </Card>
              );
            }
            return (
              <Card className="p-4">
                {header}
                <div className="flex items-end gap-3">
                  {trend.map((m) => (
                    <div key={m.key} className="flex flex-1 flex-col items-center" title={`${m.label}: ${money(m.total)} · ${m.count} entr${m.count === 1 ? "y" : "ies"}`}>
                      <div className="mb-1 text-[10.5px] font-bold text-[var(--ink-2)]">{m.total > 0 ? money(m.total) : ""}</div>
                      <div className="w-full max-w-[42px] rounded-t-[3px]" style={{ height: `${6 + (m.total / max) * 98}px`, background: m.current ? `linear-gradient(180deg,${ACCENT},${ACCENT_DK})` : "linear-gradient(180deg,#6f9beb,#3f78d8)" }} />
                      <div className="mt-1.5 text-[11px] font-bold text-[var(--ink-3)]">{m.label}</div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })()}

          {/* Where it comes from — scoped to a period (presets + custom range) */}
          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13.5px] font-extrabold">Where it comes from</div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex overflow-hidden rounded-full border border-[var(--line)] text-[11px] font-bold">
                  {([["all", "All time"], ["month", "This month"], ["lastmonth", "Last month"], ["year", "This year"]] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setOvRange(k)} className="px-2.5 py-1 transition-colors" style={ovRange === k ? { background: ACCENT, color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
                  ))}
                </div>
                <label className="flex items-center gap-1 text-[11px] text-[var(--ink-3)]">From <input type="date" value={ovFrom} onChange={(e) => setOvFrom(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-1.5 py-1 text-[11.5px] text-[var(--ink)] outline-none" /></label>
                <label className="flex items-center gap-1 text-[11px] text-[var(--ink-3)]">to <input type="date" value={ovTo} onChange={(e) => setOvTo(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-1.5 py-1 text-[11.5px] text-[var(--ink)] outline-none" /></label>
                {ovActive && <button type="button" onClick={() => { setOvRange("all"); setOvFrom(""); setOvTo(""); }} className="text-[11px] font-bold text-[#16306e] hover:underline">Clear ✕</button>}
              </div>
            </div>
            <div className="mb-2 text-[11px] text-[var(--ink-3)]"><b className="text-[var(--ink)]">{money(ovTotal)}</b> in · {ovRangeLabel}</div>
            {ovCats.length === 0 ? <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">No income in this period.</div> : (
              <div className="flex flex-col gap-2.5">
                {ovCats.slice(0, 8).map((c) => {
                  const h = hueFor(c.category);
                  return (
                    <div key={c.category}>
                      <div className="mb-1 flex items-baseline justify-between text-[12px]">
                        <span className="flex min-w-0 items-center gap-1.5 font-bold"><span className="h-2 w-2 flex-none rounded-full" style={{ background: h.text }} /><span className="truncate">{c.category}</span></span>
                        <span className="flex-none tabular-nums"><b>{money(c.total)}</b> <span className="text-[var(--ink-3)]">· {Math.round((c.total / (ovTotal || 1)) * 100)}%</span></span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${Math.max(3, (c.total / ovCats[0].total) * 100)}%`, background: h.bar }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Bookings by payment type — same scoped period */}
          {ovByMethod.length > 0 && (
          <Card className="p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <div className="text-[13.5px] font-extrabold">Bookings by payment type</div>
              <div className="text-[11px] text-[var(--ink-3)]">{ovRangeLabel} · {money(ovBookingsTotal)}</div>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {ovByMethod.map((m, i) => {
                const hue = HUES[i % HUES.length];
                return (
                  <div key={m.method} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[16px]" style={{ background: hue.soft }}>{methodIcon(m.method)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 text-[12px]">
                        <span className="truncate font-bold">{m.method}</span>
                        <span className="flex-none tabular-nums"><b>{money(m.total)}</b> <span className="text-[var(--ink-3)]">· {Math.round((m.total / (ovBookingsTotal || 1)) * 100)}%</span></span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${Math.max(4, (m.total / ovByMethod[0].total) * 100)}%`, background: hue.bar }} /></div>
                        <span className="flex-none text-[10.5px] text-[var(--ink-3)]">{m.count}×</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          )}

          <div className="grid gap-3.5 lg:grid-cols-2">
            {/* Awaiting payment — money you're still owed (unpaid invoices) */}
            <Card className="p-4">
              <div className="mb-0.5 flex items-baseline justify-between">
                <div className="text-[13.5px] font-extrabold">Awaiting payment</div>
                <div className="text-[12px] font-extrabold tabular-nums">{money(awaitingTotal)}{overdueCount > 0 && <span className="ml-1.5 rounded-full bg-[#fdebec] px-1.5 py-0.5 text-[10px] font-bold text-[#c02532]">{overdueCount} overdue</span>}</div>
              </div>
              <div className="mb-2 text-[10.5px] text-[var(--ink-3)]">Customer invoices you’ve sent but not yet been paid. Excludes unpaid bookings — and isn’t counted in your income totals until paid.</div>
              {awaiting.length === 0 ? <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">You’re all paid up — no invoices outstanding. 🎉</div> : (
                <div className="flex flex-col gap-1">
                  {(showAllAwaiting ? awaiting : awaiting.slice(0, 5)).map((v) => (
                    <div key={v.id} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-[var(--panel)]">
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-extrabold" style={v.overdue ? { background: "#fdebec", color: "#c02532" } : { background: "#eaf0fc", color: "#16306e" }}>{initials(v.customerName)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-bold">{v.customerName}</div>
                        <div className="flex items-center gap-1.5 text-[10.5px] text-[var(--ink-3)]">
                          {v.reference && <span className="truncate">{v.reference}</span>}
                          {v.dueDate ? (v.overdue ? <span className="rounded-full bg-[#fdebec] px-1.5 py-px font-bold text-[#c02532]">overdue · {fmtDay(v.dueDate)}</span> : <span>due {fmtDay(v.dueDate)}</span>) : <span>no due date</span>}
                        </div>
                      </div>
                      <div className="flex-none text-[13px] font-extrabold tabular-nums">{money(v.amount)}</div>
                    </div>
                  ))}
                  {awaiting.length > 5 && (
                    <button type="button" onClick={() => setShowAllAwaiting((v) => !v)} className="mt-1 flex items-center justify-center gap-1 rounded-lg border border-[var(--line)] py-1.5 text-[11.5px] font-bold text-[#16306e] transition hover:bg-[var(--panel)]">
                      {showAllAwaiting ? "Show less ▴" : `Show ${awaiting.length - 5} more ▾`}
                    </button>
                  )}
                </div>
              )}
            </Card>

            {/* This year at a glance — classy stat tiles */}
            <Card className="p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <div className="text-[13.5px] font-extrabold">{thisYear} at a glance</div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">Year to date</div>
              </div>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--line)]">
                {([
                  { Ic: IcCoins, big: money(yearStats.collected), lab: "Collected so far", sub: `${yearStats.activeMonths || 0} month${yearStats.activeMonths === 1 ? "" : "s"} active` },
                  { Ic: IcTrend, big: yearStats.best ? money(yearStats.best[1]) : "—", lab: "Best month", sub: yearStats.best ? monthLabel(yearStats.best[0]) : "—" },
                  { Ic: IcBars, big: money(yearStats.avg), lab: "Avg / month", sub: "across active months" },
                  { Ic: IcAward, big: yearStats.largest ? money(yearStats.largest) : "—", lab: "Biggest payment", sub: "single receipt" },
                ]).map((t) => (
                  <div key={t.lab} className="bg-[var(--surface)] p-3.5">
                    <div className="mb-2.5 flex items-center gap-1.5 text-[var(--ink-3)]">
                      <t.Ic />
                      <span className="text-[9.5px] font-semibold uppercase tracking-[0.09em]">{t.lab}</span>
                    </div>
                    <div className="text-[21px] font-extrabold leading-none tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{t.big}</div>
                    <div className="mt-1.5 truncate text-[10.5px] text-[var(--ink-3)]">{t.sub}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="text-[13.5px] font-extrabold">Recent</div>
              <button type="button" onClick={() => setTab("ledger")} className="text-[12px] font-bold text-[#16306e] hover:underline">View all →</button>
            </div>
            <div className="flex flex-col gap-1.5">
              {recent.map((x) => {
                const hue = hueFor(x.category || "Other");
                return (
                  <div key={x.id} className="group flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 transition-colors hover:border-[#cdddf7] hover:bg-[#fafbfe]">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-[15px] font-extrabold text-white" style={{ background: hue.bar, boxShadow: `0 6px 14px -6px ${hue.text}` }}>{(x.category || "?").charAt(0).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-extrabold">{x.source || x.category}</span>
                        <span className="flex-none rounded-md px-1.5 py-[1px] text-[9px] font-extrabold uppercase tracking-[0.05em]" style={{ background: hue.soft, color: hue.text }}>{x.category}</span>
                        {x.seriesId && !x.virtual && <span className="flex-none rounded-md bg-[var(--panel)] px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">Repeats</span>}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-[var(--ink-3)]">{fmtDay(x.date)}{x.method ? ` · ${x.method}` : ""}{x.notes ? ` · ${x.notes}` : ""}</div>
                    </div>
                    <div className="flex flex-none items-baseline gap-0.5 text-[var(--ink)]">
                      <span className="text-[11px] font-semibold text-[var(--ink-3)]">+</span>
                      <span className="text-[15px] font-extrabold tabular-nums">{money(x.amount)}</span>
                    </div>
                  </div>
                );
              })}
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
                  {x.category === BOOKINGS_CAT ? <span className="flex-none rounded-md bg-[#eaf0fc] px-1.5 py-0.5 text-[10.5px] font-bold text-[#16306e]">🎟️ {x.method ?? "booking"}</span> : x.virtual ? <span className="flex-none rounded-md bg-[#eaf0fc] px-1.5 py-0.5 text-[10.5px] font-bold text-[#16306e]">📄 invoice</span> : x.seriesId ? <span className="flex-none rounded-md bg-[#eaf0fc] px-1.5 py-0.5 text-[10.5px] font-bold text-[#16306e]" title={x.repeatUntil ? `Repeats every ${x.repeat ? REPEAT_LABEL[x.repeat] : ""} until ${fmtDay(x.repeatUntil)}` : "Repeating"}>🔁 {x.repeat ? REPEAT_LABEL[x.repeat] : ""}</span> : null}
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
