"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { api, get as apiGet, post as apiPost, put as apiPut, del } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { money } from "@/features/bookings/helpers";
import { Card } from "@/components/ui";

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;

type Repeat = "weekly" | "fortnightly" | "monthly";
interface Expense { id: string; date: string; category: string; amount: number; supplier?: string; notes?: string; receiptUrl?: string; status?: "pending" | "paid"; dueDate?: string; paidAt?: string; repeat?: Repeat; repeatUntil?: string; seriesId?: string; createdByName?: string; virtual?: boolean }
interface Payload { items: Expense[]; summary: { total: number; count: number; byCategory: Record<string, number> } }
interface Sub { current: { plan: string; since: string | null; details: { name: string; price: number; cadence: string } } }
interface Supplier { id: string; name: string; email?: string; phone?: string; address?: string; notes?: string }
type SupEditor = { id?: string; name: string; email: string; phone: string; address: string; notes: string };

const CATEGORIES = ["Equipment", "Venue hire", "Staff", "Travel", "Marketing", "Insurance", "Supplies", "Training", "Software", "Utilities", "Other"];
const CAT_ICON: Record<string, string> = {
  Equipment: "🎒", "Venue hire": "🏟️", Staff: "🧑‍🏫", Travel: "🚗", Marketing: "📣", Insurance: "🛡️",
  Supplies: "📦", Training: "🎓", Software: "💻", Utilities: "💡", Other: "•",
};
const icon = (c: string) => CAT_ICON[c] ?? "•";
// Category colours (blue family) + gradient avatars, matching the booking rows.
const HUES = [
  { soft: "#eaf0fc", text: "#1d3a8f", bar: "linear-gradient(135deg,#4f8bf5,#16306e)" },
  { soft: "#ece9fd", text: "#4b3bc9", bar: "linear-gradient(135deg,#8a7bf0,#4b3bc9)" },
  { soft: "#f6e9fb", text: "#8a2fb0", bar: "linear-gradient(135deg,#c46ee0,#8a2fb0)" },
  { soft: "#fbeede", text: "#a9660a", bar: "linear-gradient(135deg,#f2b24a,#c67d12)" },
  { soft: "#e5f2fd", text: "#1f77c9", bar: "linear-gradient(135deg,#5bb3f0,#1f77c9)" },
  { soft: "#eceff4", text: "#48566e", bar: "linear-gradient(135deg,#8aa0c0,#48566e)" },
  { soft: "#e8ecfb", text: "#2f3fa8", bar: "linear-gradient(135deg,#6d84e8,#2f3fa8)" },
];
const hueFor = (label: string) => HUES[[...(label || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
const initials = (name: string) => (name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2) || "?").toUpperCase();
const REPEAT_LABEL: Record<Repeat, string> = { weekly: "week", fortnightly: "2 weeks", monthly: "month" };

const fmtDay = (iso: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const todayIso = () => new Date().toISOString().slice(0, 10);
const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

type Tab = "overview" | "ledger" | "pending" | "paid" | "receipts" | "categories" | "suppliers";
type Range = "all" | "month" | "lastmonth" | "year";
type Sort = "date" | "oldest" | "amount" | "amountAsc";
type Editor = { id?: string; date: string; category: string; amount: string; supplier: string; notes: string; receiptUrl: string; status: "pending" | "paid"; dueDate: string; repeat: "none" | Repeat; repeatUntil: string; seriesId?: string };
const statusOf = (x: Expense): "pending" | "paid" => x.status ?? "paid";

const btnPrimary = "inline-flex items-center gap-1.5 rounded-full bg-[#1d3a8f] px-3.5 py-2 text-[12.5px] font-extrabold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50";
const btnGhost = "inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink)] transition hover:border-[var(--ink-3)]";
const fieldCls = "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand-line,#cdddf7)]";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]";
const pill = "rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink)] outline-none";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error("Couldn’t read that file")); r.readAsDataURL(file); });
}
function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const max = 1600; const s = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * s), h = Math.round(img.height * s);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d"); if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);
      let q = 0.82, out = c.toDataURL("image/jpeg", q);
      while (out.length > 1_100_000 && q > 0.4) { q -= 0.12; out = c.toDataURL("image/jpeg", q); }
      resolve(out);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function ReceiptThumb({ url, className = "" }: { url: string; className?: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return <div className={`flex items-center justify-center bg-[var(--panel)] text-[18px] ${className}`}>📎</div>;
  return <img src={url} alt="receipt" onError={() => setOk(false)} className={`object-cover ${className}`} />;
}

function YesNo({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-[var(--line)] text-[12px] font-bold">
      {([["No", false], ["Yes", true]] as const).map(([label, val]) => (
        <button key={label} type="button" onClick={() => onChange(val)} className="px-4 py-1.5 transition-colors" style={on === val ? { background: val ? "#1d3a8f" : "var(--panel)", color: val ? "#fff" : "var(--ink)" } : { color: "var(--ink-3)" }}>{label}</button>
      ))}
    </div>
  );
}

export function ExpensesApp({ embedded = false }: { embedded?: boolean } = {}) {
  const [data, setData] = useState<Payload | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [newCat, setNewCat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [renaming, setRenaming] = useState<{ name: string; value: string } | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supEditor, setSupEditor] = useState<SupEditor | null>(null);

  const { settings, save: saveSettings } = useSettings();
  const registry = useMemo(() => settings.expenses?.categories ?? [], [settings]);
  const includeSub = settings.expenses?.includeSubscription ?? false;

  // Ledger controls
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [receiptFilter, setReceiptFilter] = useState<"all" | "with" | "without">("all");
  const [range, setRange] = useState<Range>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<Sort>("date");
  // Receipts-tab filters
  const [rCat, setRCat] = useState("all");
  const [rFrom, setRFrom] = useState("");
  const [rTo, setRTo] = useState("");

  const refresh = useCallback(() => {
    apiGet<Payload>("/api/expenses").then((p) => { setData(p); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    apiGet<Supplier[]>("/api/suppliers").then((s) => setSuppliers(Array.isArray(s) ? s : [])).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<Sub>("/api/subscription").then(setSub).catch(() => {}); }, []);
  useRealtime(["expenses", "suppliers"], refresh);

  // ── Suppliers directory ──
  const openSupAdd = () => setSupEditor({ name: "", email: "", phone: "", address: "", notes: "" });
  const openSupEdit = (s: Supplier) => setSupEditor({ id: s.id, name: s.name, email: s.email ?? "", phone: s.phone ?? "", address: s.address ?? "", notes: s.notes ?? "" });
  async function saveSupplier() {
    if (!supEditor) return;
    if (!supEditor.name.trim()) { setError("Give the supplier a name."); return; }
    const body = { name: supEditor.name.trim(), email: supEditor.email.trim() || undefined, phone: supEditor.phone.trim() || undefined, address: supEditor.address.trim() || undefined, notes: supEditor.notes.trim() || undefined };
    try {
      if (supEditor.id) await apiPut(`/api/suppliers/${encodeURIComponent(supEditor.id)}`, body);
      else await apiPost("/api/suppliers", body);
      setSupEditor(null); setError(null); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save supplier"); }
  }
  async function removeSupplier(s: Supplier) {
    if (!confirm(`Delete supplier “${s.name}”? Expenses that used them keep their name.`)) return;
    try { await del(`/api/suppliers/${encodeURIComponent(s.id)}`); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  const items = useMemo(() => data?.items ?? [], [data]); // real, editable expenses
  const now = useMemo(() => new Date(), []);
  const thisMonthKey = monthKeyOf(now);
  const lastMonthKey = monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const thisYear = String(now.getFullYear());

  // The operator's own ActivityOS plan fee, folded in as virtual monthly rows
  // (one per month since they subscribed) when the toggle is on. Never written
  // to the ledger — they always reflect the live plan and can't go stale.
  const subPrice = sub?.current.details.price ?? 0;
  // Months where the subscription is ALREADY a logged expense — never add a
  // virtual row for those, or the plan fee is counted twice.
  const loggedSubMonths = useMemo(() => new Set(items.filter((x) => /activityos/i.test(x.supplier ?? "") || /subscription/i.test(x.notes ?? "")).map((x) => (x.date || "").slice(0, 7))), [items]);
  const subRows = useMemo<Expense[]>(() => {
    if (!includeSub || subPrice <= 0 || !sub) return [];
    const start = sub.current.since ? sub.current.since.slice(0, 7) : monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 11, 1));
    const rows: Expense[] = [];
    let y = Number(start.slice(0, 4)), m = Number(start.slice(5, 7));
    for (let i = 0; i < 36; i++) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      if (key > thisMonthKey) break;
      if (!loggedSubMonths.has(key)) rows.push({ id: `sub-${key}`, date: `${key}-01`, category: "Software", supplier: "ActivityOS", amount: subPrice, notes: `${sub.current.details.name} plan subscription`, virtual: true });
      m++; if (m > 12) { m = 1; y++; }
    }
    return rows;
  }, [includeSub, subPrice, sub, now, thisMonthKey, loggedSubMonths]);

  const allItems = useMemo(() => (subRows.length ? [...subRows, ...items] : items), [subRows, items]);

  // ── Derived analytics (computed from real + included-subscription rows) ──
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

  const sumWhere = (pred: (x: Expense) => boolean) => allItems.filter(pred).reduce((s, x) => s + x.amount, 0);
  const thisMonthTotal = useMemo(() => sumWhere((x) => (x.date || "").slice(0, 7) === thisMonthKey), [allItems, thisMonthKey]);
  const lastMonthTotal = useMemo(() => sumWhere((x) => (x.date || "").slice(0, 7) === lastMonthKey), [allItems, lastMonthKey]);
  const yearTotal = useMemo(() => sumWhere((x) => (x.date || "").slice(0, 4) === thisYear), [allItems, thisYear]);
  const grandTotal = useMemo(() => allItems.reduce((s, x) => s + x.amount, 0), [allItems]);
  const count = allItems.length;
  const avg = count ? grandTotal / count : 0;
  const biggest = useMemo(() => allItems.reduce<Expense | null>((m, x) => (!m || x.amount > m.amount ? x : m), null), [allItems]);
  const deltaPct = lastMonthTotal > 0 ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100) : null;

  const cats = useMemo(() => {
    const by: Record<string, { total: number; count: number }> = {};
    for (const x of allItems) { const c = x.category || "Other"; (by[c] ||= { total: 0, count: 0 }); by[c].total += x.amount; by[c].count++; }
    return Object.entries(by).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.total - a.total);
  }, [allItems]);

  const topSuppliers = useMemo(() => {
    const by: Record<string, { total: number; count: number }> = {};
    for (const x of allItems) { if (!x.supplier) continue; (by[x.supplier] ||= { total: 0, count: 0 }); by[x.supplier].total += x.amount; by[x.supplier].count++; }
    return Object.entries(by).map(([supplier, v]) => ({ supplier, ...v })).sort((a, b) => b.total - a.total);
  }, [allItems]);

  // Category management operates on real expenses + the persistent registry.
  const catRows = useMemo(() => {
    const names = Array.from(new Set([...cats.map((c) => c.category), ...registry]));
    return names.map((name) => {
      const c = cats.find((x) => x.category === name);
      const realCount = items.filter((x) => (x.category || "Other") === name).length;
      return { category: name, total: c?.total ?? 0, count: c?.count ?? 0, realCount };
    }).sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
  }, [cats, registry, items]);

  const pendingItems = useMemo(() => items.filter((x) => statusOf(x) === "pending"), [items]);
  const pendingTotal = useMemo(() => pendingItems.reduce((s, x) => s + x.amount, 0), [pendingItems]);
  const paidCount = useMemo(() => items.filter((x) => statusOf(x) === "paid").length, [items]);

  const withReceipt = useMemo(() => items.filter((x) => x.receiptUrl), [items]);
  const missingReceipt = useMemo(() => items.filter((x) => !x.receiptUrl), [items]);
  const receiptsShown = useMemo(() => withReceipt.filter((x) => (rCat === "all" || (x.category || "Other") === rCat) && (!rFrom || x.date >= rFrom) && (!rTo || x.date <= rTo)), [withReceipt, rCat, rFrom, rTo]);

  // ── Ledger view (search + filters + sort) — CSV export uses this set ──
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = allItems.filter((x) => {
      const d = x.date || "";
      if (tab === "pending" && statusOf(x) !== "pending") return false;
      if (tab === "paid" && statusOf(x) !== "paid") return false;
      if (catFilter !== "all" && (x.category || "Other") !== catFilter) return false;
      if (receiptFilter === "with" && !x.receiptUrl) return false;
      if (receiptFilter === "without" && x.receiptUrl) return false;
      if (range === "month" && d.slice(0, 7) !== thisMonthKey) return false;
      if (range === "lastmonth" && d.slice(0, 7) !== lastMonthKey) return false;
      if (range === "year" && d.slice(0, 4) !== thisYear) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (needle && !`${x.supplier ?? ""} ${x.notes ?? ""} ${x.category ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const cmp: Record<Sort, (a: Expense, b: Expense) => number> = {
      date: (a, b) => (a.date < b.date ? 1 : -1), oldest: (a, b) => (a.date > b.date ? 1 : -1),
      amount: (a, b) => b.amount - a.amount, amountAsc: (a, b) => a.amount - b.amount,
    };
    return [...rows].sort(cmp[sort]);
  }, [allItems, q, catFilter, receiptFilter, range, from, to, sort, thisMonthKey, lastMonthKey, thisYear, tab]);
  const filteredTotal = filtered.reduce((s, x) => s + x.amount, 0);
  const activeFilters = (catFilter !== "all" ? 1 : 0) + (receiptFilter !== "all" ? 1 : 0) + (range !== "all" ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0) + (q.trim() ? 1 : 0);
  const clearFilters = () => { setQ(""); setCatFilter("all"); setReceiptFilter("all"); setRange("all"); setFrom(""); setTo(""); };

  const recent = useMemo(() => [...allItems].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5), [allItems]);
  const catOptions = useMemo(() => Array.from(new Set([...CATEGORIES, ...registry, ...items.map((x) => x.category)])), [registry, items]);

  // ── Actions ───────────────────────────────────────────────────────────
  const openAdd = () => { setNewCat(false); setEditor({ date: todayIso(), category: "Equipment", amount: "", supplier: "", notes: "", receiptUrl: "", status: tab === "pending" ? "pending" : "paid", dueDate: "", repeat: "none", repeatUntil: "" }); };
  const openEdit = (x: Expense) => { setNewCat(false); setEditor({ id: x.id, date: x.date, category: x.category, amount: String(x.amount), supplier: x.supplier ?? "", notes: x.notes ?? "", receiptUrl: x.receiptUrl ?? "", status: statusOf(x), dueDate: x.dueDate ?? "", repeat: x.repeat ?? "none", repeatUntil: x.repeatUntil ?? "", seriesId: x.seriesId }); };
  const patchRegistry = (next: string[]) => saveSettings({ settings: { ...settings, expenses: { ...(settings.expenses ?? {}), categories: Array.from(new Set(next)) } } });

  async function save() {
    if (!editor) return;
    const amt = Number(editor.amount);
    const catName = editor.category.trim();
    if (!catName) { setError("Pick or name a category."); return; }
    if (!amt || amt < 0) { setError("Enter a valid amount."); return; }
    const isNewSeries = !editor.id && editor.repeat !== "none";
    if (isNewSeries && (!editor.repeatUntil || editor.repeatUntil <= editor.date)) { setError("For a repeat, pick an ‘until’ date after the start date."); return; }
    setSaving(true);
    const body: Record<string, unknown> = { date: editor.date, category: catName, amount: amt, supplier: editor.supplier.trim() || undefined, notes: editor.notes.trim() || undefined, receiptUrl: editor.receiptUrl.trim() || undefined, status: editor.status, dueDate: editor.status === "pending" ? (editor.dueDate || undefined) : undefined, paidAt: editor.status === "paid" ? (editor.id ? undefined : new Date().toISOString()) : undefined };
    if (isNewSeries) { body.repeat = editor.repeat; body.repeatUntil = editor.repeatUntil; }
    try {
      if (editor.id) await apiPut(`/api/expenses/${encodeURIComponent(editor.id)}`, body);
      else await apiPost("/api/expenses", body);
      if (!CATEGORIES.includes(catName) && !registry.includes(catName)) void patchRegistry([...registry, catName]);
      setEditor(null); setError(null); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); } finally { setSaving(false); }
  }
  async function onPickReceipt(file: File) {
    setUploading(true); setError(null);
    try {
      const dataUrl = await readAsDataUrl(file);
      const payload = dataUrl.startsWith("data:image/") ? await compressImage(dataUrl) : dataUrl;
      const { url } = await apiPost<{ url: string }>("/api/uploads", { dataUrl: payload });
      setEditor((ed) => (ed ? { ...ed, receiptUrl: url } : ed));
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed — try a smaller image or paste a link."); } finally { setUploading(false); }
  }
  async function remove(x: Expense) {
    if (x.virtual || !confirm(`Delete this ${money(x.amount)} expense?`)) return;
    try { await del(`/api/expenses/${encodeURIComponent(x.id)}`); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }
  async function markPaid(x: Expense) {
    try { await apiPut(`/api/expenses/${encodeURIComponent(x.id)}`, { status: "paid", paidAt: new Date().toISOString() }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }
  async function deleteSeries() {
    if (!editor?.seriesId) return;
    if (!confirm("Delete every entry in this repeating series?")) return;
    try { await del(`/api/expenses/series/${encodeURIComponent(editor.seriesId)}`); setEditor(null); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }
  async function renameCategory(oldName: string, raw: string) {
    const newName = raw.trim(); setRenaming(null);
    if (!newName || newName === oldName) return;
    const affected = items.filter((x) => (x.category || "Other") === oldName);
    try {
      await Promise.all(affected.map((x) => apiPut(`/api/expenses/${encodeURIComponent(x.id)}`, { category: newName })));
      const nextReg = registry.filter((c) => c !== oldName);
      if (!CATEGORIES.includes(newName)) nextReg.push(newName);
      void patchRegistry(nextReg);
      refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t rename"); }
  }
  function deleteCategory(name: string) {
    if (items.some((x) => (x.category || "Other") === name)) return; // guarded in UI too
    void patchRegistry(registry.filter((c) => c !== name));
  }
  function exportCsv() {
    const header = ["Date", "Category", "Amount", "Status", "Due", "Supplier", "Notes", "Receipt", "Repeats", "Repeat until", "Source"];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = filtered.map((x) => [x.date, x.category, x.amount, statusOf(x), x.dueDate ?? "", x.supplier ?? "", x.notes ?? "", x.receiptUrl ?? "", x.repeat ?? "", x.repeatUntil ?? "", x.virtual ? "subscription" : "logged"]);
    const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `expenses-${range}${from || to ? "-custom" : ""}-${todayIso()}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className={embedded ? "text-[var(--ink)]" : "-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]"} style={embedded ? undefined : LIGHT_PALETTE}>
      {/* Hero */}
      {!embedded && (
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
        <button type="button" onClick={openAdd} className="absolute right-4 top-4 z-10 rounded-full bg-[#1d3a8f] px-3.5 py-1.5 text-[12px] font-extrabold text-white shadow-md transition-transform hover:-translate-y-px">＋ Log expense</button>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🧾</span>
          Expenses
        </div>
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">Everything your business spends — logged, categorised and totalled. Set repeats for regular costs and keep every receipt in one place.</p>
        {data && (
          <div className="mt-4 flex flex-wrap gap-2.5">
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm">
              <div className="flex items-baseline gap-1.5"><div className="text-[20px] font-extrabold leading-none">{money(thisMonthTotal)}</div>{deltaPct !== null && <span className={`text-[11px] font-bold ${deltaPct > 0 ? "text-[#ffd2d2]" : "text-[#c6f6d5]"}`}>{deltaPct > 0 ? "▲" : deltaPct < 0 ? "▼" : ""}{Math.abs(deltaPct)}%</span>}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">This month{deltaPct !== null ? " · vs last" : ""}</div>
            </div>
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{money(yearTotal)}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">This year</div></div>
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{count}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">Logged</div></div>
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{money(avg)}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">Avg / expense</div></div>
          </div>
        )}
      </div>
      )}

      {/* ActivityOS subscription include toggle */}
      {sub && (
        <Card className="mb-3.5 flex flex-wrap items-center justify-between gap-3 p-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--brand-soft,#eaf0fc)] text-[16px]">🚀</span>
            <div>
              <div className="text-[13px] font-extrabold">Include my ActivityOS subscription in expenses</div>
              <div className="text-[11.5px] text-[var(--ink-3)]">{subPrice > 0 ? <>{sub.current.details.name} plan · <b className="text-[var(--ink)]">{money(subPrice)}/month</b>{sub.current.since ? ` since ${fmtDay(sub.current.since.slice(0, 10))}` : ""}{includeSub ? " — counted below" : ""}</> : "You’re on the free Starter plan — nothing to add."}</div>
            </div>
          </div>
          {subPrice > 0 ? <YesNo on={includeSub} onChange={(v) => void saveSettings({ settings: { ...settings, expenses: { ...(settings.expenses ?? {}), includeSubscription: v } } })} /> : <span className="text-[12px] font-bold text-[var(--ink-3)]">Free</span>}
        </Card>
      )}

      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {/* Tabs */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex flex-wrap rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 text-[12.5px] font-bold">
          {([["overview", "Overview"], ["ledger", "All"], ["pending", `Pending${pendingItems.length ? ` · ${pendingItems.length}` : ""}`], ["paid", `Paid${paidCount ? ` · ${paidCount}` : ""}`], ["receipts", `Receipts${withReceipt.length ? ` · ${withReceipt.length}` : ""}`], ["categories", "Categories"], ["suppliers", `Suppliers${suppliers.length ? ` · ${suppliers.length}` : ""}`]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className="rounded-full px-4 py-1.5 transition-colors" style={tab === k ? { background: "#1d3a8f", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
          ))}
        </div>
        {embedded && <button type="button" onClick={openAdd} className={btnPrimary}>＋ Log expense</button>}
      </div>

      {!data ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : allItems.length === 0 ? (
        <Card className="p-8 text-center text-[13px] text-[var(--ink-3)]">
          <div className="text-[30px]">🧾</div>
          <div className="mt-1 text-[15px] font-extrabold text-[var(--ink)]">No expenses yet</div>
          <p className="mx-auto mt-1 max-w-[420px] leading-[1.6]">Log what your business spends — equipment, venue hire, insurance — set repeats for regular costs, and watch the totals, categories and monthly trend build up here.</p>
          <button type="button" onClick={openAdd} className={`${btnPrimary} mx-auto mt-4`}>＋ Log your first expense</button>
        </Card>
      ) : tab === "overview" ? (
        <div className="flex flex-col gap-3.5">
          <Card className="grid gap-3 p-4 sm:grid-cols-4">
            <div><div className="text-[20px] font-extrabold leading-none">{money(thisMonthTotal)}</div><div className="mt-1 text-[11.5px] text-[var(--ink-3)]">spent this month</div></div>
            <div><div className="text-[20px] font-extrabold leading-none">{money(lastMonthTotal)}</div><div className="mt-1 text-[11.5px] text-[var(--ink-3)]">last month</div></div>
            <div><div className="text-[20px] font-extrabold leading-none">{money(avg)}</div><div className="mt-1 text-[11.5px] text-[var(--ink-3)]">average / expense</div></div>
            <div><div className="text-[20px] font-extrabold leading-none">{biggest ? money(biggest.amount) : "—"}</div><div className="mt-1 truncate text-[11.5px] text-[var(--ink-3)]">biggest{biggest ? ` · ${biggest.category}` : ""}</div></div>
          </Card>

          {(() => {
            const max = Math.max(1, ...monthly.map((m) => m.total));
            return (
              <Card className="p-4">
                <div className="mb-3 flex items-baseline justify-between">
                  <div className="text-[13.5px] font-extrabold">Last 6 months</div>
                  <div className="text-[11px] text-[var(--ink-3)]">total spent per month</div>
                </div>
                <div className="flex items-end gap-3">
                  {monthly.map((m) => (
                    <div key={m.key} className="flex flex-1 flex-col items-center" title={`${m.label}: ${money(m.total)} · ${m.count} expense${m.count === 1 ? "" : "s"}`}>
                      <div className="mb-1 text-[10.5px] font-bold text-[var(--ink-2)]">{m.total > 0 ? money(m.total) : ""}</div>
                      <div className="w-full max-w-[46px] rounded-t-[4px]" style={{ height: `${8 + (m.total / max) * 96}px`, background: m.key === thisMonthKey ? "linear-gradient(180deg,#1d3a8f,#16306e)" : "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }} />
                      <div className="mt-1.5 text-[11px] font-bold text-[var(--ink-3)]">{m.label}</div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })()}

          <div className="grid gap-3.5 lg:grid-cols-2">
            <Card className="p-4">
              <div className="mb-2.5 text-[13.5px] font-extrabold">Where it goes</div>
              <div className="flex flex-col gap-2.5">
                {cats.slice(0, 8).map((c) => {
                  const h = hueFor(c.category);
                  return (
                    <div key={c.category}>
                      <div className="mb-1 flex items-baseline justify-between text-[12px]">
                        <span className="flex min-w-0 items-center gap-1.5 font-bold"><span className="h-2 w-2 flex-none rounded-full" style={{ background: h.text }} /><span className="truncate">{c.category}</span></span>
                        <span className="flex-none tabular-nums"><b>{money(c.total)}</b> <span className="text-[var(--ink-3)]">· {Math.round((c.total / (grandTotal || 1)) * 100)}%</span></span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${Math.max(3, (c.total / cats[0].total) * 100)}%`, background: h.bar }} /></div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-2.5 text-[13.5px] font-extrabold">Top suppliers</div>
              {topSuppliers.length === 0 ? <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">Add a supplier when logging to see this.</div> : (
                <div className="flex flex-col">
                  {topSuppliers.slice(0, 6).map((s, i) => (
                    <div key={s.supplier} className="flex items-center gap-3 border-b border-dashed border-[var(--line)] py-2 text-[12.5px] last:border-b-0">
                      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[var(--brand-soft,#eaf0fc)] text-[11px] font-extrabold text-[var(--brand-strong,#16306e)]">{i + 1}</span>
                      <div className="min-w-0 flex-1 truncate font-bold">{s.supplier}</div>
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
              <button type="button" onClick={() => setTab("ledger")} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">View all →</button>
            </div>
            <div className="flex flex-col gap-1.5">
              {recent.map((x) => {
                const label = x.supplier || x.category;
                const h = hueFor(x.category || "Other");
                const pending = statusOf(x) === "pending";
                return (
                  <div key={x.id} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 transition-colors hover:border-[#cdddf7] hover:bg-[#fafbfe]">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[13px] text-[14px] font-extrabold text-white shadow-[0_5px_12px_-6px_rgba(29,58,143,.7)]" style={{ background: h.bar }}>{initials(label)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-extrabold">{label}</span>
                        <span className="flex-none rounded-md px-1.5 py-[1px] text-[9px] font-extrabold uppercase tracking-[0.05em]" style={{ background: hueFor(x.category).soft, color: hueFor(x.category).text }}>{x.category}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-[var(--ink-3)]">{fmtDay(x.date)}{x.notes ? ` · ${x.notes}` : ""}</div>
                    </div>
                    {!x.virtual && (pending
                      ? <span className="flex-none rounded-full bg-[#fbeede] px-2.5 py-1 text-[10px] font-bold text-[#a9660a]">Pending</span>
                      : <span className="flex-none rounded-full bg-[#eaf0fc] px-2.5 py-1 text-[10px] font-bold text-[#1d3a8f]">Paid</span>)}
                    <span className="flex-none text-[15px] font-extrabold tabular-nums">{money(x.amount)}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      ) : (tab === "ledger" || tab === "pending" || tab === "paid") ? (
        <div className="flex flex-col gap-3">
          <Card className="flex flex-col gap-2.5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[var(--ink-3)]">🔍</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search supplier or note…" className="w-[210px] rounded-full border border-[var(--line)] bg-[var(--surface)] py-1.5 pl-7 pr-3 text-[12px] text-[var(--ink)] outline-none focus:border-[var(--brand-line,#cdddf7)]" />
              </div>
              <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={`${pill} rounded-full`}>
                <option value="all">All categories</option>
                {cats.map((c) => <option key={c.category} value={c.category}>{c.category}</option>)}
              </select>
              <select value={receiptFilter} onChange={(e) => setReceiptFilter(e.target.value as typeof receiptFilter)} className={`${pill} rounded-full`}>
                <option value="all">Any receipt</option>
                <option value="with">📎 Has receipt</option>
                <option value="without">Missing receipt</option>
              </select>
              <div className="ml-auto flex items-center gap-2">
                <button type="button" onClick={exportCsv} className={btnGhost}>⬇ Export CSV</button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex overflow-hidden rounded-full border border-[var(--line)] text-[11.5px] font-bold">
                {([["all", "All time"], ["month", "This month"], ["lastmonth", "Last month"], ["year", "This year"]] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setRange(k)} className="px-3 py-1.5 transition-colors" style={range === k ? { background: "#2f6bd8", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
                ))}
              </div>
              <label className="flex items-center gap-1 text-[11.5px] text-[var(--ink-3)]">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--ink)] outline-none" /></label>
              <label className="flex items-center gap-1 text-[11.5px] text-[var(--ink-3)]">to <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--ink)] outline-none" /></label>
              <div className="inline-flex overflow-hidden rounded-full border border-[var(--line)] text-[11.5px] font-bold">
                {([["date", "Newest"], ["oldest", "Oldest"], ["amount", "Largest"], ["amountAsc", "Smallest"]] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setSort(k)} className="px-3 py-1.5 transition-colors" style={sort === k ? { background: "#2f6bd8", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
                ))}
              </div>
              {activeFilters > 0 && <button type="button" onClick={clearFilters} className="text-[11.5px] font-bold text-[#1d3a8f] hover:underline">Clear {activeFilters} filter{activeFilters === 1 ? "" : "s"} ✕</button>}
            </div>
          </Card>

          <div className="flex items-baseline justify-between px-1 text-[12px] text-[var(--ink-3)]">
            <span><b className="text-[var(--ink)]">{filtered.length}</b> of {count} expense{count === 1 ? "" : "s"}</span>
            <span>showing <b className="text-[var(--ink)]">{money(filteredTotal)}</b></span>
          </div>

          {filtered.length === 0 ? <Card className="p-6 text-center text-[12.5px] text-[var(--ink-3)]">Nothing matches those filters.</Card> : (
            <div className="flex flex-col gap-1.5">
              {filtered.map((x) => (
                <Card key={x.id} className={`flex flex-wrap items-center gap-2.5 p-2.5 ${x.virtual ? "bg-[var(--panel)]" : ""}`}>
                  <span className="w-[104px] flex-none text-[11.5px] text-[var(--ink-3)]">{fmtDay(x.date)}</span>
                  <span className="flex-none rounded-md bg-[var(--panel)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--ink-2)]">{icon(x.category)} {x.category}</span>
                  {x.virtual ? <span className="flex-none rounded-md bg-[#eaf0fc] px-1.5 py-0.5 text-[10.5px] font-bold text-[#1d3a8f]">🚀 subscription</span> : x.seriesId ? <span className="flex-none rounded-md bg-[#eaf0fc] px-1.5 py-0.5 text-[10.5px] font-bold text-[#1d3a8f]" title={x.repeatUntil ? `Repeats every ${x.repeat ? REPEAT_LABEL[x.repeat] : ""} until ${fmtDay(x.repeatUntil)}` : "Repeating"}>🔁 {x.repeat ? REPEAT_LABEL[x.repeat] : ""}</span> : null}
                  {!x.virtual && statusOf(x) === "pending" && <span className="flex-none rounded-full bg-[#fbeede] px-2 py-0.5 text-[10px] font-bold text-[#a9660a]" title={x.dueDate ? `Due ${fmtDay(x.dueDate)}` : "Owed — not yet paid"}>Pending{x.dueDate ? ` · due ${fmtDay(x.dueDate)}` : ""}</span>}
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">{x.supplier || <span className="text-[var(--ink-3)]">—</span>}{x.notes ? <span className="text-[var(--ink-3)]"> · {x.notes}</span> : ""}</span>
                  {x.receiptUrl && <a href={x.receiptUrl} target="_blank" rel="noreferrer" className="flex-none text-[11px] font-bold text-[#1d3a8f] hover:underline">📎 receipt</a>}
                  <span className="flex-none text-[13px] font-extrabold tabular-nums">{money(x.amount)}</span>
                  {x.virtual ? <span className="flex-none text-[10.5px] text-[var(--ink-3)]">auto</span> : (
                    <>
                      {statusOf(x) === "pending" && <button type="button" onClick={() => markPaid(x)} className="flex-none rounded-full bg-[#e7f0ff] px-2.5 py-1 text-[11px] font-bold text-[#1d3a8f] transition hover:brightness-95">Mark paid</button>}
                      <button type="button" onClick={() => openEdit(x)} className="flex-none text-[var(--ink-3)] hover:text-[#1d3a8f]" aria-label="Edit">✎</button>
                      <button type="button" onClick={() => remove(x)} className="flex-none text-[16px] leading-none text-[var(--ink-3)] hover:text-[var(--red)]" aria-label="Delete">×</button>
                    </>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : tab === "receipts" ? (
        <div className="flex flex-col gap-3.5">
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="text-[13.5px] font-extrabold">{withReceipt.length} of {items.length} expenses have a receipt</div>
              <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">Attach a photo or link so you’re ready for the taxman.</div>
            </div>
            <div className="h-2 w-[160px] overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full bg-[#1d3a8f]" style={{ width: `${items.length ? (withReceipt.length / items.length) * 100 : 0}%` }} /></div>
          </Card>

          {/* Receipts filters */}
          <Card className="flex flex-wrap items-center gap-2 p-3">
            <select value={rCat} onChange={(e) => setRCat(e.target.value)} className={`${pill} rounded-full`}>
              <option value="all">All categories</option>
              {cats.map((c) => <option key={c.category} value={c.category}>{c.category}</option>)}
            </select>
            <label className="flex items-center gap-1 text-[11.5px] text-[var(--ink-3)]">From <input type="date" value={rFrom} onChange={(e) => setRFrom(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--ink)] outline-none" /></label>
            <label className="flex items-center gap-1 text-[11.5px] text-[var(--ink-3)]">to <input type="date" value={rTo} onChange={(e) => setRTo(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--ink)] outline-none" /></label>
            {(rCat !== "all" || rFrom || rTo) && <button type="button" onClick={() => { setRCat("all"); setRFrom(""); setRTo(""); }} className="text-[11.5px] font-bold text-[#1d3a8f] hover:underline">Clear ✕</button>}
            <span className="ml-auto text-[12px] text-[var(--ink-3)]"><b className="text-[var(--ink)]">{receiptsShown.length}</b> shown</span>
          </Card>

          {receiptsShown.length === 0 ? <Card className="p-6 text-center text-[12.5px] text-[var(--ink-3)]">{withReceipt.length === 0 ? "No receipts yet — open any expense and add one." : "No receipts match those filters."}</Card> : (
            <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {receiptsShown.map((x) => (
                <Card key={x.id} className="overflow-hidden">
                  <a href={x.receiptUrl} target="_blank" rel="noreferrer" className="block"><ReceiptThumb url={x.receiptUrl!} className="h-[120px] w-full" /></a>
                  <div className="p-2.5">
                    <div className="flex items-baseline justify-between"><span className="truncate text-[12px] font-bold">{x.supplier || x.category}</span><span className="flex-none text-[12.5px] font-extrabold tabular-nums">{money(x.amount)}</span></div>
                    <div className="mt-0.5 flex items-center justify-between text-[11px] text-[var(--ink-3)]"><span>{icon(x.category)} {fmtDay(x.date)}</span><button type="button" onClick={() => openEdit(x)} className="font-bold text-[#1d3a8f] hover:underline">Edit</button></div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {missingReceipt.length > 0 && (
            <Card className="p-4">
              <div className="mb-2 text-[13px] font-extrabold">Missing a receipt · {missingReceipt.length}</div>
              <div className="flex flex-col">
                {missingReceipt.slice(0, 12).map((x) => (
                  <div key={x.id} className="flex items-center gap-2.5 border-b border-dashed border-[var(--line)] py-2 text-[12.5px] last:border-b-0">
                    <span className="w-[104px] flex-none text-[11.5px] text-[var(--ink-3)]">{fmtDay(x.date)}</span>
                    <span className="flex-none rounded-md bg-[var(--panel)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--ink-2)]">{icon(x.category)} {x.category}</span>
                    <span className="min-w-0 flex-1 truncate text-[var(--ink-3)]">{x.supplier || "—"}</span>
                    <span className="flex-none font-extrabold tabular-nums">{money(x.amount)}</span>
                    <button type="button" onClick={() => openEdit(x)} className={`${btnGhost} !py-1 !text-[11px]`}>＋ Add receipt</button>
                  </div>
                ))}
                {missingReceipt.length > 12 && <div className="pt-2 text-center text-[11.5px] text-[var(--ink-3)]">+ {missingReceipt.length - 12} more — filter “Missing receipt” in All expenses.</div>}
              </div>
            </Card>
          )}
        </div>
      ) : tab === "categories" ? (
        // Categories tab — spend breakdown + rename / delete management
        <div className="flex flex-col gap-1.5">
          {catRows.map((c) => (
            <Card key={c.category} className="p-3.5">
              <div className="flex items-center justify-between gap-2">
                {renaming?.name === c.category ? (
                  <div className="flex flex-1 items-center gap-1.5">
                    <input autoFocus value={renaming.value} onChange={(e) => setRenaming({ name: c.category, value: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") void renameCategory(c.category, renaming.value); if (e.key === "Escape") setRenaming(null); }} className={`${fieldCls} max-w-[240px]`} />
                    <button type="button" onClick={() => void renameCategory(c.category, renaming.value)} className={`${btnPrimary} !py-1.5`}>Save</button>
                    <button type="button" onClick={() => setRenaming(null)} className="text-[12px] font-bold text-[var(--ink-3)]">Cancel</button>
                  </div>
                ) : (
                  <>
                    <div className="text-[13.5px] font-extrabold">{icon(c.category)} {c.category}{c.realCount === 0 && <span className="ml-1.5 rounded-full bg-[var(--panel)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--ink-3)]">unused</span>}</div>
                    <div className="flex items-center gap-2.5">
                      <div className="text-[15px] font-extrabold tabular-nums">{money(c.total)}</div>
                      <button type="button" onClick={() => setRenaming({ name: c.category, value: c.category })} className="text-[var(--ink-3)] hover:text-[#1d3a8f]" title="Rename category" aria-label="Rename">✎</button>
                      <button type="button" disabled={c.realCount > 0} onClick={() => deleteCategory(c.category)} className="text-[15px] leading-none text-[var(--ink-3)] enabled:hover:text-[var(--red)] disabled:opacity-30" title={c.realCount > 0 ? "Move or delete its expenses first" : "Delete category"} aria-label="Delete">×</button>
                    </div>
                  </>
                )}
              </div>
              {c.total > 0 && <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${Math.max(3, (c.total / (cats[0]?.total || 1)) * 100)}%`, background: "linear-gradient(90deg,#3f78d8,#1d3a8f)" }} /></div>}
              <div className="mt-1.5 flex flex-wrap gap-x-4 text-[11.5px] text-[var(--ink-3)]">
                <span><b className="text-[var(--ink)]">{grandTotal ? Math.round((c.total / grandTotal) * 100) : 0}%</b> of spend</span>
                <span><b className="text-[var(--ink)]">{c.count}</b> expense{c.count === 1 ? "" : "s"}</span>
                {c.count > 0 && <span>avg <b className="text-[var(--ink)]">{money(c.total / c.count)}</b></span>}
              </div>
            </Card>
          ))}
          <div className="flex items-baseline justify-between px-1 pt-1 text-[12.5px]"><span className="text-[var(--ink-3)]">Total across {catRows.filter((c) => c.total > 0).length} categor{catRows.filter((c) => c.total > 0).length === 1 ? "y" : "ies"}</span><span className="text-[15px] font-extrabold">{money(grandTotal)}</span></div>
        </div>
      ) : (
        // Suppliers tab — a saved contact directory reused when logging expenses
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[13px] text-[var(--ink-3)]">{suppliers.length ? `${suppliers.length} saved` : "No suppliers saved yet"} — pick them from a dropdown when logging an expense.</div>
            <button type="button" onClick={openSupAdd} className={btnPrimary}>＋ Add supplier</button>
          </div>
          {suppliers.length === 0 ? (
            <Card className="p-8 text-center text-[13px] text-[var(--ink-3)]">
              <div className="mt-1 text-[15px] font-extrabold text-[var(--ink)]">Save your suppliers</div>
              <p className="mx-auto mt-1 max-w-[420px] leading-[1.6]">Keep who you pay in one place — name, email, phone and address — then pick them from a dropdown when you log an expense.</p>
              <button type="button" onClick={openSupAdd} className={`${btnPrimary} mx-auto mt-4`}>＋ Add your first supplier</button>
            </Card>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {suppliers.map((s) => {
                const h = hueFor(s.name);
                return (
                  <Card key={s.id} className="flex items-start gap-3 p-3.5">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[13px] text-[14px] font-extrabold text-white shadow-[0_5px_12px_-6px_rgba(29,58,143,.7)]" style={{ background: h.bar }}>{initials(s.name)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-extrabold">{s.name}</div>
                      <div className="mt-0.5 flex flex-col gap-0.5 text-[11.5px] text-[var(--ink-3)]">
                        {s.email && <a href={`mailto:${s.email}`} className="truncate hover:text-[#1d3a8f]">{s.email}</a>}
                        {s.phone && <a href={`tel:${s.phone}`} className="truncate hover:text-[#1d3a8f]">{s.phone}</a>}
                        {s.address && <span className="truncate">{s.address}</span>}
                        {s.notes && <span className="truncate">{s.notes}</span>}
                        {!s.email && !s.phone && !s.address && !s.notes && <span>No contact details</span>}
                      </div>
                    </div>
                    <div className="flex flex-none flex-col items-end gap-1.5">
                      <button type="button" onClick={() => openSupEdit(s)} className="text-[var(--ink-3)] hover:text-[#1d3a8f]" title="Edit" aria-label="Edit">✎</button>
                      <button type="button" onClick={() => removeSupplier(s)} className="text-[15px] leading-none text-[var(--ink-3)] hover:text-[var(--red)]" title="Delete" aria-label="Delete">×</button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add / edit modal */}
      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditor(null)}>
          <Card className="max-h-[92vh] w-[min(560px,94vw)] overflow-y-auto p-5" style={LIGHT_PALETTE}>
            <div onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 text-[16px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{editor.id ? "Edit expense" : "Log an expense"}</div>
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
                      <button type="button" onClick={() => { setNewCat(true); setEditor({ ...editor, category: "" }); }} className="flex-none whitespace-nowrap rounded-lg border border-[var(--line)] px-2 text-[12px] font-bold text-[#1d3a8f]">＋ New</button>
                    </div>
                  )}
                </div>
                <label className="block"><span className={labelCls}>Amount (£)</span><input type="number" min="0" step="0.01" value={editor.amount} onChange={(e) => setEditor({ ...editor, amount: e.target.value })} placeholder="0.00" className={fieldCls} /></label>
                <label className="block"><span className={labelCls}>Supplier {suppliers.length > 0 && <span className="font-normal normal-case text-[var(--ink-3)]">— pick a saved one or type</span>}</span>
                  <input value={editor.supplier} onChange={(e) => setEditor({ ...editor, supplier: e.target.value })} placeholder="Who you paid" className={fieldCls} list="expenseSuppliers" autoComplete="off" />
                  <datalist id="expenseSuppliers">{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
                </label>
              </div>
              <label className="mt-2.5 block"><span className={labelCls}>Notes</span><input value={editor.notes} onChange={(e) => setEditor({ ...editor, notes: e.target.value })} placeholder="What was it for?" className={fieldCls} /></label>

              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                <div>
                  <span className={labelCls}>Status</span>
                  <div className="inline-flex overflow-hidden rounded-full border border-[var(--line)] text-[12px] font-bold">
                    {([["paid", "Paid"], ["pending", "Pending"]] as const).map(([k, label]) => (
                      <button key={k} type="button" onClick={() => setEditor({ ...editor, status: k })} className="px-4 py-1.5 transition-colors" style={editor.status === k ? { background: k === "pending" ? "#a9660a" : "#1d3a8f", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
                    ))}
                  </div>
                  <p className="mt-1 text-[10.5px] text-[var(--ink-3)]">{editor.status === "pending" ? "Money you owe — not paid yet." : "Money that's already gone out."}</p>
                </div>
                {editor.status === "pending" && <label className="block"><span className={labelCls}>Due date <span className="font-normal normal-case text-[var(--ink-3)]">(optional)</span></span><input type="date" value={editor.dueDate} onChange={(e) => setEditor({ ...editor, dueDate: e.target.value })} className={fieldCls} /></label>}
              </div>

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
              {!editor.id && editor.repeat !== "none" && <p className="mt-1 text-[11px] text-[var(--ink-3)]">Creates one entry every {REPEAT_LABEL[editor.repeat as Repeat]} from {fmtDay(editor.date)} until the date above.</p>}
              {editor.id && editor.seriesId && (
                <div className="mt-2.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[11.5px] text-[var(--ink-3)]">🔁 Part of a repeating series. Saving changes only this entry. <button type="button" onClick={deleteSeries} className="font-bold text-[var(--red,#e21d27)] hover:underline">Delete whole series</button></div>
              )}

              <div className="mt-2.5">
                <span className={labelCls}>Receipt <span className="font-normal normal-case text-[var(--ink-3)]">(optional)</span></span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className={`${btnGhost} cursor-pointer !py-1.5`}>
                    {uploading ? "Uploading…" : "⬆ Upload photo"}
                    <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPickReceipt(f); e.target.value = ""; }} />
                  </label>
                  <span className="text-[11px] text-[var(--ink-3)]">or paste a link</span>
                  <input value={editor.receiptUrl} onChange={(e) => setEditor({ ...editor, receiptUrl: e.target.value })} placeholder="https://…" className={`${fieldCls} min-w-[160px] flex-1`} />
                </div>
                {editor.receiptUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <ReceiptThumb url={editor.receiptUrl} className="h-12 w-12 rounded-lg border border-[var(--line)]" />
                    <a href={editor.receiptUrl} target="_blank" rel="noreferrer" className="text-[11.5px] font-bold text-[#1d3a8f] hover:underline">Open</a>
                    <button type="button" onClick={() => setEditor({ ...editor, receiptUrl: "" })} className="text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[var(--red)]">Remove</button>
                  </div>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setEditor(null)} className={btnGhost}>Cancel</button>
                <button type="button" onClick={save} disabled={saving || uploading} className={btnPrimary}>{saving ? "Saving…" : editor.id ? "Save changes" : editor.repeat !== "none" ? "Create series" : "Log expense"}</button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Supplier add / edit modal */}
      {supEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSupEditor(null)}>
          <Card className="max-h-[92vh] w-[min(480px,94vw)] overflow-y-auto p-5" style={LIGHT_PALETTE}>
            <div onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 text-[16px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{supEditor.id ? "Edit supplier" : "Add a supplier"}</div>
              <label className="block"><span className={labelCls}>Name</span><input autoFocus value={supEditor.name} onChange={(e) => setSupEditor({ ...supEditor, name: e.target.value })} placeholder="e.g. Riverside Sports Hall" className={fieldCls} /></label>
              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                <label className="block"><span className={labelCls}>Email</span><input type="email" value={supEditor.email} onChange={(e) => setSupEditor({ ...supEditor, email: e.target.value })} placeholder="accounts@…" className={fieldCls} /></label>
                <label className="block"><span className={labelCls}>Phone</span><input value={supEditor.phone} onChange={(e) => setSupEditor({ ...supEditor, phone: e.target.value })} placeholder="07…" className={fieldCls} /></label>
              </div>
              <label className="mt-2.5 block"><span className={labelCls}>Address</span><input value={supEditor.address} onChange={(e) => setSupEditor({ ...supEditor, address: e.target.value })} placeholder="Street, town, postcode" className={fieldCls} /></label>
              <label className="mt-2.5 block"><span className={labelCls}>Notes <span className="font-normal normal-case text-[var(--ink-3)]">(optional)</span></span><input value={supEditor.notes} onChange={(e) => setSupEditor({ ...supEditor, notes: e.target.value })} placeholder="Account ref, contact name…" className={fieldCls} /></label>
              <div className="mt-4 flex justify-between gap-2">
                {supEditor.id ? <button type="button" onClick={() => { const s = suppliers.find((x) => x.id === supEditor.id); if (s) void removeSupplier(s); setSupEditor(null); }} className="text-[12.5px] font-bold text-[var(--red,#e21d27)] hover:underline">Delete</button> : <span />}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSupEditor(null)} className={btnGhost}>Cancel</button>
                  <button type="button" onClick={saveSupplier} className={btnPrimary}>{supEditor.id ? "Save" : "Add supplier"}</button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
