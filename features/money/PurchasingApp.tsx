"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { get as apiGet, post as apiPost, put as apiPut, del } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { money } from "@/features/bookings/helpers";
import { Card } from "@/components/ui";
import { LineItemsEditor, PrintableDoc, lineTotal, type LineItem } from "@/features/money/doc-shared";

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;

type Repeat = "weekly" | "fortnightly" | "monthly";
type Status = "draft" | "sent" | "received" | "paid" | "cancelled";
interface PO { id: string; supplier: string; supplierEmail?: string; reference?: string; date: string; dueDate?: string; amount: number; lineItems?: LineItem[]; status: Status; notes?: string; attachmentUrl?: string; emailedAt?: string; repeat?: Repeat; repeatUntil?: string; seriesId?: string; overdue?: boolean }
interface Payload { items: PO[]; summary: { count: number; outstanding: number; overdue: number } }

const STATUSES: Status[] = ["draft", "sent", "received", "paid", "cancelled"];
const STATUS_META: Record<Status, { label: string; bg: string; fg: string }> = {
  draft: { label: "Draft", bg: "var(--panel)", fg: "var(--ink-3)" },
  sent: { label: "Sent", bg: "#eaf0fc", fg: "#1d3a8f" },
  received: { label: "Received", bg: "#fff4e0", fg: "#a86400" },
  paid: { label: "Paid", bg: "#e7f8ee", fg: "#0f7a44" },
  cancelled: { label: "Cancelled", bg: "var(--panel)", fg: "var(--ink-3)" },
};
const OUTSTANDING = new Set<Status>(["sent", "received"]);
const REPEAT_LABEL: Record<Repeat, string> = { weekly: "week", fortnightly: "2 weeks", monthly: "month" };

const fmtDay = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const todayIso = () => new Date().toISOString().slice(0, 10);
const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

type Tab = "overview" | "ledger" | "invoices" | "suppliers";
type Range = "all" | "month" | "lastmonth" | "year";
type Flt = "all" | "outstanding" | "overdue" | "duesoon" | Status;
type Sort = "date" | "due" | "amount";
type Editor = { id?: string; supplier: string; supplierEmail: string; reference: string; date: string; dueDate: string; lineItems: LineItem[]; status: Status; notes: string; attachmentUrl: string; repeat: "none" | Repeat; repeatUntil: string; seriesId?: string };

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
function DocThumb({ url, className = "" }: { url: string; className?: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return <div className={`flex items-center justify-center bg-[var(--panel)] text-[18px] ${className}`}>🧾</div>;
  return <img src={url} alt="invoice" onError={() => setOk(false)} className={`object-cover ${className}`} />;
}

export function PurchasingApp({ embedded = false }: { embedded?: boolean } = {}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [renaming, setRenaming] = useState<{ name: string; value: string } | null>(null);

  const [q, setQ] = useState("");
  const [flt, setFlt] = useState<Flt>("all");
  const [range, setRange] = useState<Range>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<Sort>("date");
  const [iSup, setISup] = useState("all");
  const [iFrom, setIFrom] = useState("");
  const [iTo, setITo] = useState("");
  const [viewing, setViewing] = useState<PO | null>(null);
  const [emailing, setEmailing] = useState(false);

  const refresh = useCallback(() => {
    apiGet<Payload>("/api/purchasing").then((p) => { setData(p); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["purchaseOrders"], refresh);

  const { settings } = useSettings();
  // Some providers raise formal purchase orders (draft = the PO stage); many
  // just track supplier bills. Setup → Money toggles the PO stage on/off.
  const usePO = settings.money?.usePurchaseOrders ?? false;
  const visibleStatuses = useMemo(() => (usePO ? STATUSES : STATUSES.filter((s) => s !== "draft")), [usePO]);
  const newLabel = usePO ? "＋ Raise a PO" : "＋ New bill";

  const items = useMemo(() => data?.items ?? [], [data]);
  const today = todayIso();
  const in14 = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10); }, []);
  const now = useMemo(() => new Date(), []);
  const thisMonthKey = monthKeyOf(now);
  const thisYear = String(now.getFullYear());
  const isOverdue = (p: PO) => OUTSTANDING.has(p.status) && !!p.dueDate && p.dueDate < today;
  const isDueSoon = (p: PO) => OUTSTANDING.has(p.status) && !!p.dueDate && p.dueDate >= today && p.dueDate <= in14;

  // ── Analytics ──
  const outstanding = useMemo(() => items.filter((p) => OUTSTANDING.has(p.status)).reduce((s, p) => s + p.amount, 0), [items]);
  const overdueItems = useMemo(() => items.filter(isOverdue), [items, today]);
  const overdueTotal = overdueItems.reduce((s, p) => s + p.amount, 0);
  const dueSoon = useMemo(() => items.filter(isDueSoon).sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1)), [items, today, in14]);
  const paidYear = useMemo(() => items.filter((p) => p.status === "paid" && (p.date || "").slice(0, 4) === thisYear).reduce((s, p) => s + p.amount, 0), [items, thisYear]);
  const active = useMemo(() => items.filter((p) => p.status !== "cancelled"), [items]);
  const committedTotal = active.reduce((s, p) => s + p.amount, 0);

  const monthly = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { key: monthKeyOf(d), label: d.toLocaleDateString("en-GB", { month: "short" }) };
    });
    return months.map((m) => {
      const rows = active.filter((p) => (p.date || "").slice(0, 7) === m.key);
      return { ...m, total: rows.reduce((s, p) => s + p.amount, 0), count: rows.length };
    });
  }, [active, now]);

  const byStatus = useMemo(() => visibleStatuses.map((s) => { const rows = items.filter((p) => p.status === s); return { status: s, count: rows.length, total: rows.reduce((a, p) => a + p.amount, 0) }; }), [items, visibleStatuses]);

  const suppliers = useMemo(() => {
    const by: Record<string, { total: number; count: number; outstanding: number }> = {};
    for (const p of items) { (by[p.supplier] ||= { total: 0, count: 0, outstanding: 0 }); by[p.supplier].total += p.amount; by[p.supplier].count++; if (OUTSTANDING.has(p.status)) by[p.supplier].outstanding += p.amount; }
    return Object.entries(by).map(([supplier, v]) => ({ supplier, ...v })).sort((a, b) => b.total - a.total);
  }, [items]);

  const withDoc = useMemo(() => items.filter((p) => p.attachmentUrl), [items]);
  const missingDoc = useMemo(() => items.filter((p) => !p.attachmentUrl && p.status !== "cancelled"), [items]);
  const invoicesShown = useMemo(() => withDoc.filter((p) => (iSup === "all" || p.supplier === iSup) && (!iFrom || p.date >= iFrom) && (!iTo || p.date <= iTo)), [withDoc, iSup, iFrom, iTo]);

  // ── Ledger ──
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = items.filter((p) => {
      const d = p.date || "";
      if (flt === "outstanding" && !OUTSTANDING.has(p.status)) return false;
      if (flt === "overdue" && !isOverdue(p)) return false;
      if (flt === "duesoon" && !isDueSoon(p)) return false;
      if (STATUSES.includes(flt as Status) && p.status !== flt) return false;
      if (range === "month" && d.slice(0, 7) !== thisMonthKey) return false;
      if (range === "lastmonth" && d.slice(0, 7) !== monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1))) return false;
      if (range === "year" && d.slice(0, 4) !== thisYear) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (needle && !`${p.supplier} ${p.reference ?? ""} ${p.notes ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const cmp: Record<Sort, (a: PO, b: PO) => number> = {
      date: (a, b) => (a.date < b.date ? 1 : -1),
      due: (a, b) => ((a.dueDate || "9999") < (b.dueDate || "9999") ? -1 : 1),
      amount: (a, b) => b.amount - a.amount,
    };
    return [...rows].sort(cmp[sort]);
  }, [items, q, flt, range, from, to, sort, thisMonthKey, thisYear, now, today, in14]);
  const filteredTotal = filtered.reduce((s, p) => s + p.amount, 0);
  const activeFilters = (flt !== "all" ? 1 : 0) + (range !== "all" ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0) + (q.trim() ? 1 : 0);
  const clearFilters = () => { setQ(""); setFlt("all"); setRange("all"); setFrom(""); setTo(""); };

  const supplierNames = useMemo(() => suppliers.map((s) => s.supplier), [suppliers]);

  // ── Actions ──
  const openAdd = () => setEditor({ supplier: "", supplierEmail: "", reference: "", date: todayIso(), dueDate: "", lineItems: [{ description: "", qty: 1, unitPrice: 0 }], status: usePO ? "draft" : "sent", notes: "", attachmentUrl: "", repeat: "none", repeatUntil: "" });
  const openEdit = (p: PO) => setEditor({ id: p.id, supplier: p.supplier, supplierEmail: p.supplierEmail ?? "", reference: p.reference ?? "", date: p.date, dueDate: p.dueDate ?? "", lineItems: p.lineItems?.length ? p.lineItems.map((li) => ({ ...li })) : [{ description: p.notes ?? "", qty: 1, unitPrice: p.amount }], status: p.status, notes: p.notes ?? "", attachmentUrl: p.attachmentUrl ?? "", repeat: p.repeat ?? "none", repeatUntil: p.repeatUntil ?? "", seriesId: p.seriesId });
  async function emailDoc(p: PO) {
    const to = (p.supplierEmail || window.prompt("Email this purchase order to:", "") || "").trim();
    if (!to) return;
    setEmailing(true);
    try { await apiPost(`/api/purchasing/${encodeURIComponent(p.id)}/email`, { to }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Email failed"); } finally { setEmailing(false); }
  }
  async function createInvoiceFromPO(p: PO) {
    const customerName = (window.prompt("Create an invoice from this PO — who is it billed to?", "") || "").trim();
    if (!customerName) return;
    try {
      await apiPost("/api/invoices", { customerName, date: todayIso(), status: "draft", notes: `From PO ${p.reference ?? ""}`.trim(), lineItems: p.lineItems?.length ? p.lineItems : [{ description: p.notes || "Item", qty: 1, unitPrice: p.amount }] });
      setError(null); window.alert("Draft invoice created — switch to “Money in” to review and send it.");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t create invoice"); }
  }

  async function save() {
    if (!editor) return;
    const lines = editor.lineItems.filter((li) => li.description.trim() || li.unitPrice > 0);
    if (!editor.supplier.trim()) { setError("Supplier is required."); return; }
    if (lineTotal(lines) <= 0) { setError("Add at least one line with an amount."); return; }
    const isNewSeries = !editor.id && editor.repeat !== "none";
    if (isNewSeries && (!editor.repeatUntil || editor.repeatUntil <= editor.date)) { setError("For a repeat, pick an ‘until’ date after the start date."); return; }
    setSaving(true);
    const body: Record<string, unknown> = { supplier: editor.supplier.trim(), supplierEmail: editor.supplierEmail.trim() || undefined, reference: editor.reference.trim() || undefined, date: editor.date, dueDate: editor.dueDate || undefined, lineItems: lines, status: editor.status, notes: editor.notes.trim() || undefined, attachmentUrl: editor.attachmentUrl.trim() || undefined };
    if (isNewSeries) { body.repeat = editor.repeat; body.repeatUntil = editor.repeatUntil; }
    try {
      if (editor.id) await apiPut(`/api/purchasing/${encodeURIComponent(editor.id)}`, body);
      else await apiPost("/api/purchasing", body);
      setEditor(null); setError(null); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); } finally { setSaving(false); }
  }
  async function setStatus(p: PO, status: Status) { try { await apiPut(`/api/purchasing/${encodeURIComponent(p.id)}`, { status }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }
  async function onPickDoc(file: File) {
    setUploading(true); setError(null);
    try {
      const dataUrl = await readAsDataUrl(file);
      const payload = dataUrl.startsWith("data:image/") ? await compressImage(dataUrl) : dataUrl;
      const { url } = await apiPost<{ url: string }>("/api/uploads", { dataUrl: payload });
      setEditor((ed) => (ed ? { ...ed, attachmentUrl: url } : ed));
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed — try a smaller image or paste a link."); } finally { setUploading(false); }
  }
  async function remove(p: PO) {
    if (!confirm(`Delete the order for ${p.supplier} (${money(p.amount)})?`)) return;
    try { await del(`/api/purchasing/${encodeURIComponent(p.id)}`); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }
  async function deleteSeries() {
    if (!editor?.seriesId) return;
    if (!confirm("Delete every order in this repeating series?")) return;
    try { await del(`/api/purchasing/series/${encodeURIComponent(editor.seriesId)}`); setEditor(null); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }
  async function renameSupplier(oldName: string, raw: string) {
    const newName = raw.trim(); setRenaming(null);
    if (!newName || newName === oldName) return;
    const affected = items.filter((p) => p.supplier === oldName);
    try { await Promise.all(affected.map((p) => apiPut(`/api/purchasing/${encodeURIComponent(p.id)}`, { supplier: newName }))); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t rename"); }
  }
  function exportCsv() {
    const header = ["Supplier", "Reference", "Date", "Due", "Amount", "Status", "Notes", "Attachment", "Repeats", "Source"];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = filtered.map((p) => [p.supplier, p.reference ?? "", p.date, p.dueDate ?? "", p.amount, p.status, p.notes ?? "", p.attachmentUrl ?? "", p.repeat ?? "", p.seriesId ? "series" : "one-off"]);
    const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `purchasing-${flt}-${todayIso()}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  const StatusPill = ({ s }: { s: Status }) => <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: STATUS_META[s].bg, color: STATUS_META[s].fg }}>{STATUS_META[s].label}</span>;

  return (
    <div className={embedded ? "text-[var(--ink)]" : "-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]"} style={embedded ? undefined : LIGHT_PALETTE}>
      {!embedded && (
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
        <button type="button" onClick={openAdd} className="absolute right-4 top-4 z-10 rounded-full bg-[#1d3a8f] px-3.5 py-1.5 text-[12px] font-extrabold text-white shadow-md transition-transform hover:-translate-y-px">{newLabel}</button>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🧾</span>
          Purchasing &amp; invoices
        </div>
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">Purchase orders and supplier invoices — from draft to paid. Track what you owe, what’s overdue, and every invoice document in one place.</p>
        {data && (
          <div className="mt-4 flex flex-wrap gap-2.5">
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{money(outstanding)}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">Outstanding</div></div>
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="flex items-baseline gap-1.5"><div className="text-[20px] font-extrabold leading-none">{money(overdueTotal)}</div>{overdueItems.length > 0 && <span className="text-[11px] font-bold text-[#ffd2d2]">{overdueItems.length}</span>}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">Overdue</div></div>
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{money(paidYear)}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">Paid this year</div></div>
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{items.length}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">Orders</div></div>
          </div>
        )}
      </div>
      )}

      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex flex-wrap rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 text-[12.5px] font-bold">
          {([["overview", "Overview"], ["ledger", "All orders"], ["invoices", `Documents${withDoc.length ? ` · ${withDoc.length}` : ""}`], ["suppliers", "Suppliers"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className="rounded-full px-4 py-1.5 transition-colors" style={tab === k ? { background: "#1d3a8f", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
          ))}
        </div>
        {embedded && <button type="button" onClick={openAdd} className={btnPrimary}>{newLabel}</button>}
      </div>

      {!data ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : items.length === 0 ? (
        <Card className="p-8 text-center text-[13px] text-[var(--ink-3)]">
          <div className="text-[30px]">🧾</div>
          <div className="mt-1 text-[15px] font-extrabold text-[var(--ink)]">{usePO ? "No POs or bills yet" : "No bills yet"}</div>
          <p className="mx-auto mt-1 max-w-[440px] leading-[1.6]">{usePO ? "Raise a purchase order to a supplier, or log a bill you’ve received" : "Log a supplier bill you need to pay"} — with line items, track it from {usePO ? "draft PO " : ""}to paid, flag what’s overdue, and keep the invoice document attached.</p>
          <button type="button" onClick={openAdd} className={`${btnPrimary} mx-auto mt-4`}>{newLabel}</button>
        </Card>
      ) : tab === "overview" ? (
        <div className="flex flex-col gap-3.5">
          <Card className="grid gap-3 p-4 sm:grid-cols-4">
            <div><div className="text-[20px] font-extrabold leading-none">{money(outstanding)}</div><div className="mt-1 text-[11.5px] text-[var(--ink-3)]">outstanding to pay</div></div>
            <div><div className="text-[20px] font-extrabold leading-none" style={{ color: overdueTotal > 0 ? "var(--red,#e21d27)" : undefined }}>{money(overdueTotal)}</div><div className="mt-1 text-[11.5px] text-[var(--ink-3)]">overdue · {overdueItems.length}</div></div>
            <div><div className="text-[20px] font-extrabold leading-none">{money(committedTotal)}</div><div className="mt-1 text-[11.5px] text-[var(--ink-3)]">committed (excl. cancelled)</div></div>
            <div><div className="text-[20px] font-extrabold leading-none">{money(paidYear)}</div><div className="mt-1 text-[11.5px] text-[var(--ink-3)]">paid in {thisYear}</div></div>
          </Card>

          {/* Pipeline */}
          <Card className="p-4">
            <div className="mb-2.5 text-[13.5px] font-extrabold">Pipeline</div>
            <div className="flex flex-wrap gap-2">
              {byStatus.map((s) => (
                <button key={s.status} type="button" onClick={() => { setFlt(s.status); setTab("ledger"); }} className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-left transition hover:border-[var(--ink-3)]">
                  <StatusPill s={s.status} />
                  <div><div className="text-[14px] font-extrabold tabular-nums">{money(s.total)}</div><div className="text-[10.5px] text-[var(--ink-3)]">{s.count} order{s.count === 1 ? "" : "s"}</div></div>
                </button>
              ))}
            </div>
          </Card>

          {(() => {
            const max = Math.max(1, ...monthly.map((m) => m.total));
            return (
              <Card className="p-4">
                <div className="mb-3 flex items-baseline justify-between"><div className="text-[13.5px] font-extrabold">Last 6 months</div><div className="text-[11px] text-[var(--ink-3)]">ordered per month (excl. cancelled)</div></div>
                <div className="flex items-end gap-3">
                  {monthly.map((m) => (
                    <div key={m.key} className="flex flex-1 flex-col items-center" title={`${m.label}: ${money(m.total)} · ${m.count} order${m.count === 1 ? "" : "s"}`}>
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
            {/* Needs attention */}
            <Card className="p-4">
              <div className="mb-2.5 text-[13.5px] font-extrabold">Needs paying</div>
              {overdueItems.length + dueSoon.length === 0 ? <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">Nothing overdue or due soon 🎉</div> : (
                <div className="flex flex-col">
                  {[...overdueItems, ...dueSoon].slice(0, 7).map((p) => (
                    <button key={p.id} type="button" onClick={() => openEdit(p)} className="flex items-center gap-2.5 border-b border-dashed border-[var(--line)] py-2 text-left text-[12.5px] last:border-b-0">
                      <span className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold ${isOverdue(p) ? "bg-[var(--red-soft,#fdebec)] text-[var(--red,#e21d27)]" : "bg-[#fff4e0] text-[#a86400]"}`}>{isOverdue(p) ? "overdue" : "due soon"}</span>
                      <div className="min-w-0 flex-1 truncate font-bold">{p.supplier}</div>
                      <span className="flex-none text-[11px] text-[var(--ink-3)]">{fmtDay(p.dueDate)}</span>
                      <span className="flex-none font-extrabold tabular-nums">{money(p.amount)}</span>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <div className="mb-2.5 text-[13.5px] font-extrabold">Top suppliers</div>
              <div className="flex flex-col">
                {suppliers.slice(0, 6).map((s, i) => (
                  <div key={s.supplier} className="flex items-center gap-3 border-b border-dashed border-[var(--line)] py-2 text-[12.5px] last:border-b-0">
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[var(--brand-soft,#eaf0fc)] text-[11px] font-extrabold text-[var(--brand-strong,#16306e)]">{i + 1}</span>
                    <div className="min-w-0 flex-1 truncate font-bold">{s.supplier}</div>
                    <div className="flex-none text-right"><div className="font-extrabold tabular-nums">{money(s.total)}</div><div className="text-[10.5px] text-[var(--ink-3)]">{s.count} order{s.count === 1 ? "" : "s"}{s.outstanding > 0 ? ` · ${money(s.outstanding)} due` : ""}</div></div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      ) : tab === "ledger" ? (
        <div className="flex flex-col gap-3">
          <Card className="flex flex-col gap-2.5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[var(--ink-3)]">🔍</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search supplier, ref or note…" className="w-[220px] rounded-full border border-[var(--line)] bg-[var(--surface)] py-1.5 pl-7 pr-3 text-[12px] text-[var(--ink)] outline-none focus:border-[var(--brand-line,#cdddf7)]" />
              </div>
              <select value={flt} onChange={(e) => setFlt(e.target.value as Flt)} className={`${pill} rounded-full`}>
                <option value="all">All orders</option>
                <option value="outstanding">Outstanding</option>
                <option value="overdue">Overdue</option>
                <option value="duesoon">Due soon (14d)</option>
                {visibleStatuses.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
              <div className="ml-auto flex items-center gap-2">
                <button type="button" onClick={exportCsv} className={btnGhost}>⬇ Export CSV</button>
                <button type="button" onClick={openAdd} className={btnPrimary}>{newLabel}</button>
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
                {([["date", "Newest"], ["due", "Due date"], ["amount", "Largest"]] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setSort(k)} className="px-3 py-1.5 transition-colors" style={sort === k ? { background: "#2f6bd8", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
                ))}
              </div>
              {activeFilters > 0 && <button type="button" onClick={clearFilters} className="text-[11.5px] font-bold text-[#1d3a8f] hover:underline">Clear {activeFilters} filter{activeFilters === 1 ? "" : "s"} ✕</button>}
            </div>
          </Card>

          <div className="flex items-baseline justify-between px-1 text-[12px] text-[var(--ink-3)]">
            <span><b className="text-[var(--ink)]">{filtered.length}</b> of {items.length} order{items.length === 1 ? "" : "s"}</span>
            <span>showing <b className="text-[var(--ink)]">{money(filteredTotal)}</b></span>
          </div>

          {filtered.length === 0 ? <Card className="p-6 text-center text-[12.5px] text-[var(--ink-3)]">Nothing matches those filters.</Card> : (
            <div className="flex flex-col gap-1.5">
              {filtered.map((p) => (
                <Card key={p.id} className="flex flex-wrap items-center gap-2.5 p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[13px] font-bold">{p.supplier}</span>
                      {p.reference && <span className="text-[11px] text-[var(--ink-3)]">{p.reference}</span>}
                      {p.seriesId && <span className="rounded-md bg-[#eaf0fc] px-1.5 py-0.5 text-[10px] font-bold text-[#1d3a8f]" title={p.repeatUntil ? `Repeats every ${p.repeat ? REPEAT_LABEL[p.repeat] : ""} until ${fmtDay(p.repeatUntil)}` : "Repeating"}>🔁 {p.repeat ? REPEAT_LABEL[p.repeat] : ""}</span>}
                      {isOverdue(p) && <span className="rounded-full bg-[var(--red-soft,#fdebec)] px-2 py-0.5 text-[10px] font-bold text-[var(--red,#e21d27)]">overdue</span>}
                    </div>
                    <div className="text-[11px] text-[var(--ink-3)]">{fmtDay(p.date)}{p.dueDate ? ` · due ${fmtDay(p.dueDate)}` : ""}{p.notes ? ` · ${p.notes}` : ""}{p.emailedAt ? <span className="ml-1 font-bold text-[#0f7a44]">· ✉ emailed {fmtDay(p.emailedAt.slice(0, 10))}</span> : ""}</div>
                  </div>
                  {p.attachmentUrl && <a href={p.attachmentUrl} target="_blank" rel="noreferrer" className="flex-none text-[11px] font-bold text-[#1d3a8f] hover:underline">🧾 invoice</a>}
                  <span className="flex-none text-[13px] font-extrabold tabular-nums">{money(p.amount)}</span>
                  <select value={p.status} onChange={(e) => setStatus(p, e.target.value as Status)} className="flex-none rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11.5px] font-bold text-[var(--ink)] outline-none">{visibleStatuses.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}</select>
                  <button type="button" onClick={() => setViewing(p)} className="flex-none text-[var(--ink-3)] hover:text-[#1d3a8f]" title="View / download PDF" aria-label="View">📄</button>
                  <button type="button" onClick={() => emailDoc(p)} disabled={emailing} className="flex-none text-[var(--ink-3)] hover:text-[#1d3a8f] disabled:opacity-40" title="Email to supplier" aria-label="Email">✉</button>
                  <button type="button" onClick={() => createInvoiceFromPO(p)} className="flex-none text-[10.5px] font-bold text-[#1d3a8f] hover:underline" title="Create an invoice from this">→ Invoice</button>
                  <button type="button" onClick={() => openEdit(p)} className="flex-none text-[var(--ink-3)] hover:text-[#1d3a8f]" aria-label="Edit">✎</button>
                  <button type="button" onClick={() => remove(p)} className="flex-none text-[16px] leading-none text-[var(--ink-3)] hover:text-[var(--red)]" aria-label="Delete">×</button>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : tab === "invoices" ? (
        <div className="flex flex-col gap-3.5">
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="text-[13.5px] font-extrabold">{withDoc.length} of {items.length} orders have an invoice attached</div>
              <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">Keep every supplier invoice document with its order.</div>
            </div>
            <div className="h-2 w-[160px] overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full bg-[#1d3a8f]" style={{ width: `${items.length ? (withDoc.length / items.length) * 100 : 0}%` }} /></div>
          </Card>

          <Card className="flex flex-wrap items-center gap-2 p-3">
            <select value={iSup} onChange={(e) => setISup(e.target.value)} className={`${pill} rounded-full`}>
              <option value="all">All suppliers</option>
              {supplierNames.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="flex items-center gap-1 text-[11.5px] text-[var(--ink-3)]">From <input type="date" value={iFrom} onChange={(e) => setIFrom(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--ink)] outline-none" /></label>
            <label className="flex items-center gap-1 text-[11.5px] text-[var(--ink-3)]">to <input type="date" value={iTo} onChange={(e) => setITo(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--ink)] outline-none" /></label>
            {(iSup !== "all" || iFrom || iTo) && <button type="button" onClick={() => { setISup("all"); setIFrom(""); setITo(""); }} className="text-[11.5px] font-bold text-[#1d3a8f] hover:underline">Clear ✕</button>}
            <span className="ml-auto text-[12px] text-[var(--ink-3)]"><b className="text-[var(--ink)]">{invoicesShown.length}</b> shown</span>
          </Card>

          {invoicesShown.length === 0 ? <Card className="p-6 text-center text-[12.5px] text-[var(--ink-3)]">{withDoc.length === 0 ? "No invoices attached yet — open any order and attach one." : "No invoices match those filters."}</Card> : (
            <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {invoicesShown.map((p) => (
                <Card key={p.id} className="overflow-hidden">
                  <a href={p.attachmentUrl} target="_blank" rel="noreferrer" className="block"><DocThumb url={p.attachmentUrl!} className="h-[120px] w-full" /></a>
                  <div className="p-2.5">
                    <div className="flex items-baseline justify-between"><span className="truncate text-[12px] font-bold">{p.supplier}</span><span className="flex-none text-[12.5px] font-extrabold tabular-nums">{money(p.amount)}</span></div>
                    <div className="mt-0.5 flex items-center justify-between text-[11px] text-[var(--ink-3)]"><span>{p.reference || fmtDay(p.date)}</span><button type="button" onClick={() => openEdit(p)} className="font-bold text-[#1d3a8f] hover:underline">Edit</button></div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {missingDoc.length > 0 && (
            <Card className="p-4">
              <div className="mb-2 text-[13px] font-extrabold">No invoice attached · {missingDoc.length}</div>
              <div className="flex flex-col">
                {missingDoc.slice(0, 12).map((p) => (
                  <div key={p.id} className="flex items-center gap-2.5 border-b border-dashed border-[var(--line)] py-2 text-[12.5px] last:border-b-0">
                    <span className="min-w-0 flex-1 truncate font-bold">{p.supplier}</span>
                    <StatusPill s={p.status} />
                    <span className="flex-none text-[11px] text-[var(--ink-3)]">{fmtDay(p.date)}</span>
                    <span className="flex-none font-extrabold tabular-nums">{money(p.amount)}</span>
                    <button type="button" onClick={() => openEdit(p)} className={`${btnGhost} !py-1 !text-[11px]`}>＋ Attach</button>
                  </div>
                ))}
                {missingDoc.length > 12 && <div className="pt-2 text-center text-[11.5px] text-[var(--ink-3)]">+ {missingDoc.length - 12} more.</div>}
              </div>
            </Card>
          )}
        </div>
      ) : (
        // Suppliers
        <div className="flex flex-col gap-1.5">
          {suppliers.map((s) => (
            <Card key={s.supplier} className="p-3.5">
              <div className="flex items-center justify-between gap-2">
                {renaming?.name === s.supplier ? (
                  <div className="flex flex-1 items-center gap-1.5">
                    <input autoFocus value={renaming.value} onChange={(e) => setRenaming({ name: s.supplier, value: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") void renameSupplier(s.supplier, renaming.value); if (e.key === "Escape") setRenaming(null); }} className={`${fieldCls} max-w-[260px]`} />
                    <button type="button" onClick={() => void renameSupplier(s.supplier, renaming.value)} className={`${btnPrimary} !py-1.5`}>Save</button>
                    <button type="button" onClick={() => setRenaming(null)} className="text-[12px] font-bold text-[var(--ink-3)]">Cancel</button>
                  </div>
                ) : (
                  <>
                    <div className="text-[13.5px] font-extrabold">{s.supplier}</div>
                    <div className="flex items-center gap-2.5">
                      <div className="text-[15px] font-extrabold tabular-nums">{money(s.total)}</div>
                      <button type="button" onClick={() => setRenaming({ name: s.supplier, value: s.supplier })} className="text-[var(--ink-3)] hover:text-[#1d3a8f]" title="Rename supplier (updates all its orders)" aria-label="Rename">✎</button>
                    </div>
                  </>
                )}
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${Math.max(3, (s.total / (suppliers[0]?.total || 1)) * 100)}%`, background: "linear-gradient(90deg,#3f78d8,#1d3a8f)" }} /></div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 text-[11.5px] text-[var(--ink-3)]">
                <span><b className="text-[var(--ink)]">{s.count}</b> order{s.count === 1 ? "" : "s"}</span>
                {s.outstanding > 0 && <span><b className="text-[var(--red,#e21d27)]">{money(s.outstanding)}</b> outstanding</span>}
                <span>avg <b className="text-[var(--ink)]">{money(s.total / s.count)}</b></span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / edit modal */}
      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditor(null)}>
          <Card className="max-h-[92vh] w-[min(600px,94vw)] overflow-y-auto p-5" style={LIGHT_PALETTE}>
            <div onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 text-[16px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{editor.id ? (usePO ? "Edit purchase order" : "Edit bill") : usePO ? "Raise a purchase order" : "New bill"}</div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <label className="block sm:col-span-2"><span className={labelCls}>Supplier</span><input value={editor.supplier} onChange={(e) => setEditor({ ...editor, supplier: e.target.value })} placeholder="Who you’re paying" className={fieldCls} /></label>
                <label className="block"><span className={labelCls}>Reference</span><input value={editor.reference} onChange={(e) => setEditor({ ...editor, reference: e.target.value })} placeholder="PO-1234" className={fieldCls} /></label>
                <label className="block"><span className={labelCls}>Supplier email</span><input type="email" value={editor.supplierEmail} onChange={(e) => setEditor({ ...editor, supplierEmail: e.target.value })} placeholder="supplier@email.com" className={fieldCls} /></label>
                <label className="block"><span className={labelCls}>Date</span><input type="date" value={editor.date} onChange={(e) => setEditor({ ...editor, date: e.target.value })} className={fieldCls} /></label>
                <label className="block"><span className={labelCls}>Due date</span><input type="date" value={editor.dueDate} onChange={(e) => setEditor({ ...editor, dueDate: e.target.value })} className={fieldCls} /></label>
                <label className="block"><span className={labelCls}>Status</span><select value={editor.status} onChange={(e) => setEditor({ ...editor, status: e.target.value as Status })} className={fieldCls}>{visibleStatuses.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}</select></label>
              </div>
              <div className="mt-3"><span className={labelCls}>Items</span><LineItemsEditor items={editor.lineItems} onChange={(li) => setEditor({ ...editor, lineItems: li })} /></div>
              <label className="mt-2.5 block"><span className={labelCls}>Notes</span><input value={editor.notes} onChange={(e) => setEditor({ ...editor, notes: e.target.value })} placeholder="What it’s for" className={fieldCls} /></label>

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
              {!editor.id && editor.repeat !== "none" && <p className="mt-1 text-[11px] text-[var(--ink-3)]">Creates one order every {REPEAT_LABEL[editor.repeat as Repeat]} from {fmtDay(editor.date)} until the date above (due dates keep the same gap).</p>}
              {editor.id && editor.seriesId && (
                <div className="mt-2.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[11.5px] text-[var(--ink-3)]">🔁 Part of a repeating series. Saving changes only this order. <button type="button" onClick={deleteSeries} className="font-bold text-[var(--red,#e21d27)] hover:underline">Delete whole series</button></div>
              )}

              <div className="mt-2.5">
                <span className={labelCls}>Invoice document <span className="font-normal normal-case text-[var(--ink-3)]">(optional)</span></span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className={`${btnGhost} cursor-pointer !py-1.5`}>
                    {uploading ? "Uploading…" : "⬆ Upload photo"}
                    <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPickDoc(f); e.target.value = ""; }} />
                  </label>
                  <span className="text-[11px] text-[var(--ink-3)]">or paste a link</span>
                  <input value={editor.attachmentUrl} onChange={(e) => setEditor({ ...editor, attachmentUrl: e.target.value })} placeholder="https://…" className={`${fieldCls} min-w-[160px] flex-1`} />
                </div>
                {editor.attachmentUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <DocThumb url={editor.attachmentUrl} className="h-12 w-12 rounded-lg border border-[var(--line)]" />
                    <a href={editor.attachmentUrl} target="_blank" rel="noreferrer" className="text-[11.5px] font-bold text-[#1d3a8f] hover:underline">Open</a>
                    <button type="button" onClick={() => setEditor({ ...editor, attachmentUrl: "" })} className="text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[var(--red)]">Remove</button>
                  </div>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setEditor(null)} className={btnGhost}>Cancel</button>
                <button type="button" onClick={save} disabled={saving || uploading} className={btnPrimary}>{saving ? "Saving…" : editor.id ? "Save changes" : editor.repeat !== "none" ? "Create series" : "Save order"}</button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {viewing && <PrintableDoc kind="po" doc={viewing as unknown as Record<string, unknown>} billing={settings.billing} actions={[{ key: "email", label: emailing ? "Sending…" : "✉️ Email to supplier", onClick: () => emailDoc(viewing), disabled: emailing }]} onClose={() => setViewing(null)} />}
    </div>
  );
}
