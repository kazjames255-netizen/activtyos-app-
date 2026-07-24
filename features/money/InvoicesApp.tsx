"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { get as apiGet, post as apiPost, put as apiPut, del } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { money } from "@/features/bookings/helpers";
import { LineItemsEditor, PrintableDoc, lineTotal, type LineItem } from "@/features/money/doc-shared";
import { Card } from "@/components/ui";

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;

type Status = "draft" | "sent" | "paid" | "cancelled";
interface Invoice { id: string; customerName: string; customerEmail?: string; customerAddress?: string; bookingRef?: string; reference?: string; poNumber?: string; accountRef?: string; description?: string; amount: number; lineItems?: LineItem[]; taxRate?: number; date: string; dueDate?: string; status: Status; notes?: string; payToken?: string; emailedAt?: string; overdue?: boolean }
interface Payload { items: Invoice[]; summary: { count: number; outstanding: number; collected: number; overdue: number } }

const STATUSES: Status[] = ["draft", "sent", "paid", "cancelled"];
const STATUS_META: Record<Status, { label: string; bg: string; fg: string }> = {
  draft: { label: "Draft", bg: "var(--panel)", fg: "var(--ink-3)" },
  sent: { label: "Sent", bg: "#eaf0fc", fg: "#1d3a8f" },
  paid: { label: "Paid", bg: "#e7f8ee", fg: "#0f7a44" },
  cancelled: { label: "Cancelled", bg: "var(--panel)", fg: "var(--ink-3)" },
};
const OWED = new Set<Status>(["sent"]);

const fmtDay = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const todayIso = () => new Date().toISOString().slice(0, 10);
const addDaysIso = (iso: string, n: number) => { const d = new Date(`${iso || todayIso()}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const DUE_PRESETS = [3, 5, 7, 10];
const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

type Tab = "overview" | "ledger" | "customers";
type Range = "all" | "today" | "month" | "lastmonth" | "year";
type Flt = "all" | "outstanding" | "overdue" | Status;
type Sort = "date" | "oldest" | "due" | "amount";
type Cust = { id: string; name: string; email?: string; children?: { name?: string }[] };
type Editor = { id?: string; customerName: string; customerEmail: string; customerAddress: string; reference: string; poNumber: string; accountRef: string; hasBooking: boolean; bookingRef: string; description: string; lineItems: LineItem[]; taxRate: string; date: string; dueDate: string; status: Status; notes: string; payToken?: string };
// Next consecutive invoice number from what's already been used (editable).
function nextInvoiceNo(items: { reference?: string }[]): string {
  let best: { prefix: string; num: number; width: number } | null = null;
  for (const it of items) {
    const m = /^(.*?)(\d+)\s*$/.exec(it.reference ?? "");
    if (!m) continue;
    const num = parseInt(m[2], 10);
    if (!best || num > best.num) best = { prefix: m[1], num, width: m[2].length };
  }
  if (!best) return "1";
  return best.prefix + String(best.num + 1).padStart(best.width, "0");
}

const btnPrimary = "inline-flex items-center gap-1.5 rounded-full bg-[#1d3a8f] px-3.5 py-2 text-[12.5px] font-extrabold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50";
const btnGhost = "inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink)] transition hover:border-[var(--ink-3)]";
const fieldCls = "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand-line,#cdddf7)]";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]";
const pill = "rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink)] outline-none";
const iconBtn = "flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[14px] text-[var(--ink-2)] transition-colors hover:border-[#1d3a8f] hover:bg-[#eef4fd] hover:text-[#1d3a8f]";
const menuItem = "flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] font-bold text-[var(--ink)] transition-colors hover:bg-[var(--panel)]";

export function InvoicesApp({ embedded = false }: { embedded?: boolean } = {}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [flt, setFlt] = useState<Flt>("all");
  const [range, setRange] = useState<Range>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<Sort>("date");
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [emailing, setEmailing] = useState(false);
  const [sendFor, setSendFor] = useState<string | null>(null);
  const { settings } = useSettings();
  const tf = settings.billing?.fields ?? {}; // which optional invoice fields to show
  // Look up an existing parent/customer on the system (by name, email or child).
  const [finder, setFinder] = useState(false);
  const [custs, setCusts] = useState<Cust[] | null>(null);
  const [cq, setCq] = useState("");
  const openFinder = () => { setFinder((v) => !v); if (!custs) apiGet<Cust[]>("/api/customers").then(setCusts).catch(() => setCusts([])); };
  const custMatches = useMemo(() => {
    const n = cq.trim().toLowerCase();
    const list = custs ?? [];
    return (n ? list.filter((c) => `${c.name} ${c.email ?? ""} ${(c.children ?? []).map((k) => k.name ?? "").join(" ")}`.toLowerCase().includes(n)) : list).slice(0, 25);
  }, [custs, cq]);

  const refresh = useCallback(() => {
    apiGet<Payload>("/api/invoices").then((p) => { setData(p); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["invoices"], refresh);

  const items = useMemo(() => data?.items ?? [], [data]);
  const today = todayIso();
  const now = useMemo(() => new Date(), []);
  const thisMonthKey = monthKeyOf(now);
  const thisYear = String(now.getFullYear());
  const isOverdue = (p: Invoice) => OWED.has(p.status) && !!p.dueDate && p.dueDate < today;

  const outstanding = useMemo(() => items.filter((p) => OWED.has(p.status)).reduce((s, p) => s + p.amount, 0), [items]);
  const overdueItems = useMemo(() => items.filter(isOverdue), [items, today]);
  const overdueTotal = overdueItems.reduce((s, p) => s + p.amount, 0);
  const collected = data?.summary.collected ?? 0;

  const monthly = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1); return { key: monthKeyOf(d), label: d.toLocaleDateString("en-GB", { month: "short" }) }; });
    return months.map((m) => { const rows = items.filter((p) => p.status !== "cancelled" && (p.date || "").slice(0, 7) === m.key); return { ...m, total: rows.reduce((s, p) => s + p.amount, 0), count: rows.length }; });
  }, [items, now]);
  const byStatus = useMemo(() => STATUSES.map((s) => { const rows = items.filter((p) => p.status === s); return { status: s, count: rows.length, total: rows.reduce((a, p) => a + p.amount, 0) }; }), [items]);
  const customers = useMemo(() => {
    const by: Record<string, { total: number; count: number; outstanding: number }> = {};
    for (const p of items) { (by[p.customerName] ||= { total: 0, count: 0, outstanding: 0 }); by[p.customerName].total += p.amount; by[p.customerName].count++; if (OWED.has(p.status)) by[p.customerName].outstanding += p.amount; }
    return Object.entries(by).map(([customer, v]) => ({ customer, ...v })).sort((a, b) => b.total - a.total);
  }, [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = items.filter((p) => {
      const d = p.date || "";
      if (flt === "outstanding" && !OWED.has(p.status)) return false;
      if (flt === "overdue" && !isOverdue(p)) return false;
      if (STATUSES.includes(flt as Status) && p.status !== flt) return false;
      if (range === "today" && d !== today) return false;
      if (range === "month" && d.slice(0, 7) !== thisMonthKey) return false;
      if (range === "lastmonth" && d.slice(0, 7) !== monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1))) return false;
      if (range === "year" && d.slice(0, 4) !== thisYear) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (needle && !`${p.customerName} ${p.bookingRef ?? ""} ${p.description ?? ""} ${p.notes ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const cmp: Record<Sort, (a: Invoice, b: Invoice) => number> = { date: (a, b) => (a.date < b.date ? 1 : -1), oldest: (a, b) => (a.date > b.date ? 1 : -1), due: (a, b) => ((a.dueDate || "9999") < (b.dueDate || "9999") ? -1 : 1), amount: (a, b) => b.amount - a.amount };
    return [...rows].sort(cmp[sort]);
  }, [items, q, flt, range, from, to, sort, thisMonthKey, thisYear, now, today]);
  const filteredTotal = filtered.reduce((s, p) => s + p.amount, 0);
  const activeFilters = (flt !== "all" ? 1 : 0) + (range !== "all" ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0) + (q.trim() ? 1 : 0);
  const clearFilters = () => { setQ(""); setFlt("all"); setRange("all"); setFrom(""); setTo(""); };

  const payLink = (p: Invoice) => (p.payToken && typeof window !== "undefined" ? `${window.location.origin}/pay/${p.payToken}` : "");
  async function copyLink(p: Invoice) {
    const link = payLink(p); if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(p.id); setTimeout(() => setCopied((c) => (c === p.id ? null : c)), 1800); } catch { setError("Couldn’t copy — link: " + link); }
  }

  const openAdd = () => setEditor({ customerName: "", customerEmail: "", customerAddress: "", reference: nextInvoiceNo(items), poNumber: "", accountRef: "", hasBooking: false, bookingRef: "", description: "", lineItems: [{ description: "", qty: 1, unitPrice: 0 }], taxRate: String(settings.billing?.defaultTaxRate ?? ""), date: todayIso(), dueDate: "", status: "draft", notes: "" });
  const openEdit = (p: Invoice) => setEditor({ id: p.id, customerName: p.customerName, customerEmail: p.customerEmail ?? "", customerAddress: p.customerAddress ?? "", reference: p.reference ?? "", poNumber: p.poNumber ?? "", accountRef: p.accountRef ?? "", hasBooking: !!p.bookingRef, bookingRef: p.bookingRef ?? "", description: p.description ?? "", lineItems: p.lineItems?.length ? p.lineItems.map((li) => ({ ...li })) : [{ description: p.description ?? "", qty: 1, unitPrice: p.amount }], taxRate: p.taxRate != null ? String(p.taxRate) : "", date: p.date, dueDate: p.dueDate ?? "", status: p.status, notes: p.notes ?? "", payToken: p.payToken });
  // mode "link" = email the PDF with the online pay-link; "bank" = bank details only.
  async function emailDoc(p: Invoice, mode: "link" | "bank" = "link") {
    const to = (p.customerEmail || window.prompt("Email this invoice to:", "") || "").trim();
    if (!to) return;
    setEmailing(true);
    try { await apiPost(`/api/invoices/${encodeURIComponent(p.id)}/email`, { to, link: mode !== "bank" }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Email failed"); } finally { setEmailing(false); }
  }
  function whatsApp(p: Invoice) {
    const link = payLink(p);
    const biz = settings.billing?.businessName || "us";
    const msg = `Hi${p.customerName ? ` ${p.customerName}` : ""}, here's your invoice${p.reference ? ` ${p.reference}` : ""} for ${money(p.amount)} from ${biz}.${link ? ` Pay here: ${link}` : ""}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  async function save() {
    if (!editor) return;
    const lines = editor.lineItems.filter((li) => li.description.trim() || li.unitPrice > 0);
    if (!editor.customerName.trim()) { setError("Customer name is required."); return; }
    if (lineTotal(lines) <= 0) { setError("Add at least one line with an amount."); return; }
    setSaving(true);
    const body: Record<string, unknown> = { customerName: editor.customerName.trim(), customerEmail: editor.customerEmail.trim() || undefined, customerAddress: editor.customerAddress.trim() || undefined, reference: editor.reference.trim() || undefined, poNumber: editor.poNumber.trim() || undefined, accountRef: editor.accountRef.trim() || undefined, bookingRef: editor.hasBooking ? editor.bookingRef.trim() || undefined : undefined, description: editor.description.trim() || undefined, lineItems: lines, taxRate: editor.taxRate.trim() ? Number(editor.taxRate) : undefined, date: editor.date, dueDate: editor.dueDate || undefined, status: editor.status, notes: editor.notes.trim() || undefined };
    try {
      if (editor.id) { await apiPut(`/api/invoices/${encodeURIComponent(editor.id)}`, body); setEditor(null); }
      else { const created = await apiPost<Invoice>("/api/invoices", body); setEditor(null); setViewing(created); } // straight to the draft, ready to send
      setError(null); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); } finally { setSaving(false); }
  }
  async function setStatus(p: Invoice, status: Status) { try { await apiPut(`/api/invoices/${encodeURIComponent(p.id)}`, { status }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }
  async function remove(p: Invoice) {
    if (!confirm(`Delete the invoice for ${p.customerName} (${money(p.amount)})?`)) return;
    try { await del(`/api/invoices/${encodeURIComponent(p.id)}`); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }
  function exportCsv() {
    const header = ["Customer", "Email", "Booking", "Description", "Date", "Due", "Amount", "Status"];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = filtered.map((p) => [p.customerName, p.customerEmail ?? "", p.bookingRef ?? "", p.description ?? "", p.date, p.dueDate ?? "", p.amount, p.status]);
    const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `invoices-${flt}-${todayIso()}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  const StatusPill = ({ s }: { s: Status }) => <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: STATUS_META[s].bg, color: STATUS_META[s].fg }}>{STATUS_META[s].label}</span>;

  return (
    <div className={embedded ? "text-[var(--ink)]" : "-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]"} style={embedded ? undefined : LIGHT_PALETTE}>
      {!embedded && (
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
        <button type="button" onClick={openAdd} className="absolute right-4 top-4 z-10 rounded-full bg-[#1d3a8f] px-3.5 py-1.5 text-[12px] font-extrabold text-white shadow-md transition-transform hover:-translate-y-px">＋ New invoice</button>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">📨</span>
          Invoices
        </div>
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">Money coming in — bill a customer and send a pay-link. Track what’s owed, overdue and collected.</p>
        {data && (
          <div className="mt-4 flex flex-wrap gap-2.5">
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{money(outstanding)}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">To collect</div></div>
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="flex items-baseline gap-1.5"><div className="text-[20px] font-extrabold leading-none">{money(overdueTotal)}</div>{overdueItems.length > 0 && <span className="text-[11px] font-bold text-[#ffd2d2]">{overdueItems.length}</span>}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">Overdue</div></div>
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{money(collected)}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">Collected {thisYear}</div></div>
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{items.length}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">Invoices</div></div>
          </div>
        )}
      </div>
      )}

      <div className="mb-3 rounded-lg border border-[#cde3f7] bg-[#eef6fd] px-3 py-2 text-[12px] text-[#1d3a8f]">🔗 Pay-links are live pages on your system. <b>Online card payment is being connected</b> — until then the pay page shows your amount + your pay methods, and you mark an invoice paid when the money lands.</div>

      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex flex-wrap rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 text-[12.5px] font-bold">
          {([["overview", "Overview"], ["ledger", "All invoices"], ["customers", "Customers"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className="rounded-full px-4 py-1.5 transition-colors" style={tab === k ? { background: "#1d3a8f", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
          ))}
        </div>
        {embedded && <button type="button" onClick={openAdd} className={btnPrimary}>＋ New invoice</button>}
      </div>

      {!data ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : items.length === 0 ? (
        <Card className="p-8 text-center text-[13px] text-[var(--ink-3)]">
          <div className="text-[30px]">📨</div>
          <div className="mt-1 text-[15px] font-extrabold text-[var(--ink)]">No invoices yet</div>
          <p className="mx-auto mt-1 max-w-[440px] leading-[1.6]">Bill a customer for an amount — a deposit, a balance, or anything ad-hoc. If it’s a parent, look them up on the system; then send the pay-link.</p>
          <button type="button" onClick={openAdd} className={`${btnPrimary} mx-auto mt-4`}>＋ New invoice</button>
        </Card>
      ) : tab === "overview" ? (
        <div className="flex flex-col gap-3.5">
          <Card className="grid gap-3 p-4 sm:grid-cols-4">
            <div><div className="text-[20px] font-extrabold leading-none">{money(outstanding)}</div><div className="mt-1 text-[11.5px] text-[var(--ink-3)]">to collect</div></div>
            <div><div className="text-[20px] font-extrabold leading-none" style={{ color: overdueTotal > 0 ? "var(--red,#e21d27)" : undefined }}>{money(overdueTotal)}</div><div className="mt-1 text-[11.5px] text-[var(--ink-3)]">overdue · {overdueItems.length}</div></div>
            <div><div className="text-[20px] font-extrabold leading-none">{money(collected)}</div><div className="mt-1 text-[11.5px] text-[var(--ink-3)]">collected in {thisYear}</div></div>
            <div><div className="text-[20px] font-extrabold leading-none">{money(byStatus.find((s) => s.status === "draft")?.total ?? 0)}</div><div className="mt-1 text-[11.5px] text-[var(--ink-3)]">in draft (not sent)</div></div>
          </Card>

          <Card className="p-4">
            <div className="mb-2.5 text-[13.5px] font-extrabold">Pipeline</div>
            <div className="flex flex-wrap gap-2">
              {byStatus.map((s) => (
                <button key={s.status} type="button" onClick={() => { setFlt(s.status); setTab("ledger"); }} className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-left transition hover:border-[var(--ink-3)]">
                  <StatusPill s={s.status} />
                  <div><div className="text-[14px] font-extrabold tabular-nums">{money(s.total)}</div><div className="text-[10.5px] text-[var(--ink-3)]">{s.count} invoice{s.count === 1 ? "" : "s"}</div></div>
                </button>
              ))}
            </div>
          </Card>

          {(() => {
            const max = Math.max(1, ...monthly.map((m) => m.total));
            return (
              <Card className="p-4">
                <div className="mb-3 flex items-baseline justify-between"><div className="text-[13.5px] font-extrabold">Last 6 months</div><div className="text-[11px] text-[var(--ink-3)]">invoiced per month</div></div>
                <div className="flex items-end gap-3">
                  {monthly.map((m) => (
                    <div key={m.key} className="flex flex-1 flex-col items-center" title={`${m.label}: ${money(m.total)} · ${m.count} invoice${m.count === 1 ? "" : "s"}`}>
                      <div className="mb-1 text-[10.5px] font-bold text-[var(--ink-2)]">{m.total > 0 ? money(m.total) : ""}</div>
                      <div className="w-full max-w-[46px] rounded-t-[4px]" style={{ height: `${8 + (m.total / max) * 96}px`, background: m.key === thisMonthKey ? "linear-gradient(180deg,#1d3a8f,#16306e)" : "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }} />
                      <div className="mt-1.5 text-[11px] font-bold text-[var(--ink-3)]">{m.label}</div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })()}

          <Card className="p-4">
            <div className="mb-2.5 text-[13.5px] font-extrabold">Awaiting payment</div>
            {items.filter((p) => OWED.has(p.status)).length === 0 ? <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">Nothing outstanding 🎉</div> : (
              <div className="flex flex-col">
                {items.filter((p) => OWED.has(p.status)).sort((a, b) => ((a.dueDate || "9999") < (b.dueDate || "9999") ? -1 : 1)).slice(0, 8).map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-2.5 border-b border-dashed border-[var(--line)] py-2 text-[12.5px] last:border-b-0">
                    {isOverdue(p) && <span className="flex-none rounded-full bg-[var(--red-soft,#fdebec)] px-2 py-0.5 text-[10px] font-bold text-[var(--red,#e21d27)]">overdue</span>}
                    <div className="min-w-0 flex-1 truncate font-bold">{p.customerName}{p.description ? <span className="font-normal text-[var(--ink-3)]"> · {p.description}</span> : ""}</div>
                    <span className="flex-none text-[11px] text-[var(--ink-3)]">{p.dueDate ? `due ${fmtDay(p.dueDate)}` : ""}</span>
                    <span className="flex-none font-extrabold tabular-nums">{money(p.amount)}</span>
                    <button type="button" onClick={() => copyLink(p)} className="flex-none text-[11px] font-bold text-[#1d3a8f] hover:underline">{copied === p.id ? "✓ copied" : "🔗 pay-link"}</button>
                    <button type="button" onClick={() => setStatus(p, "paid")} className="flex-none rounded-full bg-[#e7f8ee] px-2.5 py-1 text-[11px] font-bold text-[#0f7a44]">Mark paid</button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : tab === "ledger" ? (
        <div className="flex flex-col gap-3">
          <Card className="flex flex-col gap-2.5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[var(--ink-3)]">🔍</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer, booking or note…" className="w-[230px] rounded-full border border-[var(--line)] bg-[var(--surface)] py-1.5 pl-7 pr-3 text-[12px] text-[var(--ink)] outline-none focus:border-[var(--brand-line,#cdddf7)]" />
              </div>
              <select value={flt} onChange={(e) => setFlt(e.target.value as Flt)} className={`${pill} rounded-full`}>
                <option value="all">All invoices</option>
                <option value="outstanding">Awaiting payment</option>
                <option value="overdue">Overdue</option>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
              <div className="ml-auto flex items-center gap-2">
                <button type="button" onClick={exportCsv} className={btnGhost}>⬇ Export CSV</button>
                <button type="button" onClick={openAdd} className={btnPrimary}>＋ New invoice</button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex overflow-hidden rounded-full border border-[var(--line)] text-[11.5px] font-bold">
                {([["all", "All time"], ["today", "Today"], ["month", "This month"], ["lastmonth", "Last month"], ["year", "This year"]] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setRange(k)} className="px-3 py-1.5 transition-colors" style={range === k ? { background: "#2f6bd8", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
                ))}
              </div>
              <label className="flex items-center gap-1 text-[11.5px] text-[var(--ink-3)]">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--ink)] outline-none" /></label>
              <label className="flex items-center gap-1 text-[11.5px] text-[var(--ink-3)]">to <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--ink)] outline-none" /></label>
              <div className="inline-flex overflow-hidden rounded-full border border-[var(--line)] text-[11.5px] font-bold">
                {([["date", "Newest"], ["oldest", "Oldest"], ["due", "Due date"], ["amount", "Largest"]] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setSort(k)} className="px-3 py-1.5 transition-colors" style={sort === k ? { background: "#2f6bd8", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
                ))}
              </div>
              {activeFilters > 0 && <button type="button" onClick={clearFilters} className="text-[11.5px] font-bold text-[#1d3a8f] hover:underline">Clear {activeFilters} filter{activeFilters === 1 ? "" : "s"} ✕</button>}
            </div>
          </Card>

          <div className="flex items-baseline justify-between px-1 text-[12px] text-[var(--ink-3)]">
            <span><b className="text-[var(--ink)]">{filtered.length}</b> of {items.length} invoice{items.length === 1 ? "" : "s"}</span>
            <span>showing <b className="text-[var(--ink)]">{money(filteredTotal)}</b></span>
          </div>

          {filtered.length === 0 ? <Card className="p-6 text-center text-[12.5px] text-[var(--ink-3)]">Nothing matches those filters.</Card> : (
            <div className="flex flex-col gap-1.5">
              {filtered.map((p) => (
                <Card key={p.id} className="flex flex-wrap items-center gap-2.5 p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[13px] font-bold">{p.customerName}</span>
                      {p.bookingRef && <span className="rounded-md bg-[var(--panel)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)]">🎟 {p.bookingRef}</span>}
                      {isOverdue(p) && <span className="rounded-full bg-[var(--red-soft,#fdebec)] px-2 py-0.5 text-[10px] font-bold text-[var(--red,#e21d27)]">overdue</span>}
                    </div>
                    <div className="text-[11px] text-[var(--ink-3)]">{fmtDay(p.date)}{p.dueDate ? ` · due ${fmtDay(p.dueDate)}` : ""}{p.description ? ` · ${p.description}` : ""}{p.emailedAt ? <span className="ml-1 font-bold text-[#0f7a44]">· ✉ emailed {fmtDay(p.emailedAt.slice(0, 10))}</span> : ""}</div>
                  </div>
                  <span className="flex-none text-[14px] font-extrabold tabular-nums">{money(p.amount)}</span>
                  <select value={p.status} onChange={(e) => setStatus(p, e.target.value as Status)} className="flex-none rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[11.5px] font-bold outline-none" style={{ background: STATUS_META[p.status].bg, color: STATUS_META[p.status].fg }}>{STATUSES.map((s) => <option key={s} value={s} style={{ background: "#fff", color: "var(--ink)" }}>{STATUS_META[s].label}</option>)}</select>
                  <div className="flex flex-none items-center gap-1">
                    <button type="button" onClick={() => setViewing(p)} className={iconBtn} title="View / download PDF" aria-label="View">📄</button>
                    <div className="relative">
                      <button type="button" onClick={() => setSendFor(sendFor === p.id ? null : p.id)} className={`${iconBtn} ${sendFor === p.id ? "border-[#1d3a8f] bg-[#eef4fd] text-[#1d3a8f]" : ""}`} title="Send" aria-label="Send">✉️</button>
                      {sendFor === p.id && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setSendFor(null)} />
                          <div className="absolute right-0 top-full z-40 mt-1 w-52 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[0_12px_30px_-8px_rgba(29,58,143,.35)]">
                            <button type="button" onClick={() => { setSendFor(null); void emailDoc(p, "link"); }} className={menuItem}>✉️ Email + pay-link</button>
                            <button type="button" onClick={() => { setSendFor(null); void emailDoc(p, "bank"); }} className={menuItem}>🏦 Email (bank details only)</button>
                            <button type="button" onClick={() => { setSendFor(null); whatsApp(p); }} className={menuItem}>💬 WhatsApp</button>
                            {p.payToken && p.status !== "paid" && <button type="button" onClick={() => { setSendFor(null); copyLink(p); }} className={menuItem}>{copied === p.id ? "✓ Copied" : "🔗 Copy pay-link"}</button>}
                          </div>
                        </>
                      )}
                    </div>
                    <button type="button" onClick={() => openEdit(p)} className={iconBtn} title="Edit" aria-label="Edit">✏️</button>
                    <button type="button" onClick={() => remove(p)} className={`${iconBtn} hover:border-[var(--red)] hover:bg-[var(--red-soft,#fdebec)] hover:text-[var(--red)]`} title="Delete" aria-label="Delete">🗑️</button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {customers.map((c) => (
            <Card key={c.customer} className="p-3.5">
              <div className="flex items-center justify-between"><div className="text-[13.5px] font-extrabold">{c.customer}</div><div className="text-[15px] font-extrabold tabular-nums">{money(c.total)}</div></div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${Math.max(3, (c.total / (customers[0]?.total || 1)) * 100)}%`, background: "linear-gradient(90deg,#3f78d8,#1d3a8f)" }} /></div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 text-[11.5px] text-[var(--ink-3)]">
                <span><b className="text-[var(--ink)]">{c.count}</b> invoice{c.count === 1 ? "" : "s"}</span>
                {c.outstanding > 0 && <span><b className="text-[#a86400]">{money(c.outstanding)}</b> awaiting payment</span>}
                <span>avg <b className="text-[var(--ink)]">{money(c.total / c.count)}</b></span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditor(null)}>
          <Card className="max-h-[92vh] w-[min(600px,94vw)] overflow-hidden p-0" style={LIGHT_PALETTE}>
            <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] overflow-y-auto">
              <div className="relative flex flex-wrap items-center justify-between gap-2 overflow-hidden p-4 text-white" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 70%,#5b95e8 100%)" }}>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-[18px]">🧾</span>
                  <div>
                    <div className="text-[17px] font-extrabold leading-none" style={{ fontFamily: "var(--ff-display)" }}>{editor.id ? "Edit invoice" : "New invoice"}</div>
                    <div className="mt-0.5 text-[11px] font-bold text-white/80">Total {money(lineTotal(editor.lineItems) * (1 + (Number(editor.taxRate) || 0) / 100))}</div>
                  </div>
                </div>
                <button type="button" onClick={openFinder} className="rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f] shadow-sm hover:brightness-105">🔎 Find a parent</button>
              </div>
              <div className="p-5">
              {finder && (
                <div className="mb-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5">
                  <input autoFocus value={cq} onChange={(e) => setCq(e.target.value)} placeholder="Search by parent name, email or child’s name…" className={fieldCls} />
                  <div className="mt-2 flex max-h-[190px] flex-col overflow-y-auto">
                    {custs === null ? <div className="px-2 py-2 text-[12px] text-[var(--ink-3)]">Loading…</div>
                    : custMatches.length === 0 ? <div className="px-2 py-2 text-[12px] text-[var(--ink-3)]">No matches.</div>
                    : custMatches.map((c) => (
                      <button key={c.id} type="button" onClick={() => { setEditor({ ...editor, customerName: c.name, customerEmail: c.email ?? "" }); setFinder(false); setCq(""); }} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-[var(--surface)]">
                        <span className="min-w-0 truncate"><b>{c.name}</b>{c.children?.length ? <span className="text-[var(--ink-3)]"> · {c.children.map((k) => k.name).filter(Boolean).join(", ")}</span> : ""}</span>
                        <span className="flex-none text-[11px] text-[var(--ink-3)]">{c.email}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid gap-2.5 sm:grid-cols-2">
                <label className="block"><span className={labelCls}>Customer name</span><input value={editor.customerName} onChange={(e) => setEditor({ ...editor, customerName: e.target.value })} placeholder="Customer or business name" className={fieldCls} /></label>
                <label className="block"><span className={labelCls}>Email</span><input type="email" value={editor.customerEmail} onChange={(e) => setEditor({ ...editor, customerEmail: e.target.value })} placeholder="customer@email.com" className={fieldCls} /></label>
                <label className="block"><span className={labelCls}>Invoice no. <span className="font-normal normal-case text-[var(--ink-3)]">(auto)</span></span><input value={editor.reference} onChange={(e) => setEditor({ ...editor, reference: e.target.value })} placeholder="INV-1001" className={fieldCls} /></label>
                <label className="block"><span className={labelCls}>Invoice date</span><input type="date" value={editor.date} onChange={(e) => setEditor({ ...editor, date: e.target.value })} className={fieldCls} /></label>
                {tf.poNumber && <label className="block"><span className={labelCls}>Customer PO no.</span><input value={editor.poNumber} onChange={(e) => setEditor({ ...editor, poNumber: e.target.value })} placeholder="4200075991" className={fieldCls} /></label>}
                {tf.accountRef && <label className="block"><span className={labelCls}>Account ref</span><input value={editor.accountRef} onChange={(e) => setEditor({ ...editor, accountRef: e.target.value })} placeholder="LOND001" className={fieldCls} /></label>}
                {tf.vat && <label className="block"><span className={labelCls}>VAT %</span><input type="number" min="0" step="0.5" value={editor.taxRate} onChange={(e) => setEditor({ ...editor, taxRate: e.target.value })} placeholder="20" className={fieldCls} /></label>}
                <label className="block"><span className={labelCls}>Due date</span>
                  <input type="date" value={editor.dueDate} onChange={(e) => setEditor({ ...editor, dueDate: e.target.value })} className={fieldCls} />
                  <div className="mt-1 flex flex-wrap gap-1">
                    {DUE_PRESETS.map((n) => { const iso = addDaysIso(editor.date, n); const on = editor.dueDate === iso; return (
                      <button key={n} type="button" onClick={() => setEditor({ ...editor, dueDate: iso })} className="rounded-full border px-2 py-0.5 text-[10.5px] font-bold transition-colors" style={on ? { background: "#1d3a8f", color: "#fff", borderColor: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{n === 7 ? "⭐ " : ""}+{n}d</button>
                    ); })}
                  </div>
                </label>
              </div>
              {tf.address && <label className="mt-2.5 block"><span className={labelCls}>Bill-to address</span><textarea value={editor.customerAddress} onChange={(e) => setEditor({ ...editor, customerAddress: e.target.value })} rows={2} placeholder="Street, town, postcode" className={`${fieldCls} w-full resize-none`} /></label>}
              <div className="mt-3"><span className={labelCls}>Items</span><LineItemsEditor items={editor.lineItems} onChange={(li) => setEditor({ ...editor, lineItems: li })} /></div>
              <label className="mt-2.5 block"><span className={labelCls}>Description <span className="font-normal normal-case text-[var(--ink-3)]">(short summary, optional)</span></span><input value={editor.description} onChange={(e) => setEditor({ ...editor, description: e.target.value })} placeholder="e.g. Summer camp balance" className={fieldCls} /></label>

              <label className="mt-2.5 block"><span className={labelCls}>Notes <span className="font-normal normal-case text-[var(--ink-3)]">(private)</span></span><input value={editor.notes} onChange={(e) => setEditor({ ...editor, notes: e.target.value })} className={fieldCls} /></label>

              {editor.id && editor.payToken && editor.status !== "paid" && (
                <div className="mt-2.5 rounded-lg border border-[#cde3f7] bg-[#eef6fd] px-3 py-2 text-[11.5px] text-[#1d3a8f]">🔗 Pay-link ready. Close and use <b>“pay-link”</b> on the row to copy it for this customer.</div>
              )}

              {error && <div className="mt-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setEditor(null)} className={btnGhost}>Cancel</button>
                <button type="button" onClick={save} disabled={saving} className={btnPrimary}>{saving ? "Saving…" : editor.id ? "Save changes" : "Save & view →"}</button>
              </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {viewing && <PrintableDoc kind="invoice" doc={viewing as unknown as Record<string, unknown>} billing={settings.billing} payUrl={viewing.status !== "paid" ? payLink(viewing) : undefined} actions={[
        { key: "link", label: emailing ? "Sending…" : "✉️ Email + pay-link", onClick: () => emailDoc(viewing, "link"), disabled: emailing },
        { key: "bank", label: "🏦 Email (bank details only)", onClick: () => emailDoc(viewing, "bank"), disabled: emailing },
        { key: "wa", label: "💬 WhatsApp", onClick: () => whatsApp(viewing) },
      ]} note="✓ Saved as a draft — send it below, or download the PDF. No need to save again." onClose={() => setViewing(null)} />}
    </div>
  );
}
