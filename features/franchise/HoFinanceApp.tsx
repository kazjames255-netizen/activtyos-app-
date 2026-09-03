"use client";

// ── Head-office Finance (one simple page) ──────────────────────────────────
// Everything a franchisor actually needs about money, on a single screen:
//   · the headline P&L — head office's OWN money in/out + royalty income + net
//   · a breakdown BY FRANCHISE (revenue + the royalty each one owes)
//   · a quick look at recent money in / money out and outstanding invoices
// Deliberately far simpler than the per-site operator Finance hub. Shown for the
// HO combined view via CompanyFinanceSwitch; the full ledgers stay reachable by
// direct link for when detail is needed.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { withHoMoney } from "@/lib/ho-net";
import { OperatorPage, TabStrip } from "@/components/OperatorPage";
import { Button, Card, Input } from "@/components/ui";

const gbp = (n: number) => "£" + Math.round(n || 0).toLocaleString("en-GB");
const shortDate = (d?: string) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");

interface FrRow { franchiseId: string; name: string; revenue: number; count: number; fee: number }
interface SplitPayload { franchises: FrRow[]; totals: { franchises: number; revenue: number; fee: number } }
interface MItem { id?: string; date?: string; amount?: number; category?: string; note?: string; supplier?: string; source?: string; description?: string }
interface MPayload { items: MItem[]; summary: { total: number; count: number; byCategory: Record<string, number> } }
interface Invoice { id?: string; amount?: number; status?: string; dueDate?: string; date?: string; to?: string; customer?: string; billTo?: string }

const PRESETS = [["1m", "1 month"], ["3m", "3 months"], ["6m", "6 months"], ["12m", "12 months"], ["all", "All time"]] as const;
type Period = (typeof PRESETS)[number][0];
const monthsBack: Record<Exclude<Period, "all">, number> = { "1m": 1, "3m": 3, "6m": 6, "12m": 12 };

type FinTab = "overview" | "in" | "out" | "invoices";

export function HoFinanceApp() {
  const [tab, setTab] = useState<FinTab>("overview");
  const [period, setPeriod] = useState<Period>("3m");
  const [split, setSplit] = useState<SplitPayload | null>(null);
  const [inc, setInc] = useState<MPayload | null>(null);
  const [exp, setExp] = useState<MPayload | null>(null);
  const [inv, setInv] = useState<Invoice[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiGet<SplitPayload>(`/api/splitfees?period=${period}`).then(setSplit).catch((e) => setErr(e instanceof Error ? e.message : "Couldn’t load finance."));
    apiGet<MPayload>(withHoMoney("/api/income")).then(setInc).catch(() => {});
    apiGet<MPayload>(withHoMoney("/api/expenses")).then(setExp).catch(() => {});
    apiGet<{ items: Invoice[] }>(withHoMoney("/api/invoices")).then((p) => setInv(p.items ?? [])).catch(() => {});
  }, [period]);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["income", "expenses", "invoices", "bookings"], refresh);

  // Filter head office's OWN money to the chosen window (the franchise breakdown
  // is already ranged server-side via ?period).
  const startTs = useMemo(() => { if (period === "all") return 0; const d = new Date(); d.setMonth(d.getMonth() - monthsBack[period]); return d.getTime(); }, [period]);
  const within = (d?: string) => (period === "all" ? true : d ? new Date(d).getTime() >= startTs : false);
  const incItems = (inc?.items ?? []).filter((x) => within(x.date)).sort((a, b) => `${b.date ?? ""}`.localeCompare(`${a.date ?? ""}`));
  const expItems = (exp?.items ?? []).filter((x) => within(x.date)).sort((a, b) => `${b.date ?? ""}`.localeCompare(`${a.date ?? ""}`));
  const moneyIn = incItems.reduce((s, x) => s + (x.amount || 0), 0);
  const moneyOut = expItems.reduce((s, x) => s + (x.amount || 0), 0);
  const royalty = split?.totals.fee ?? 0;
  const net = moneyIn + royalty - moneyOut;
  const franchises = split?.franchises ?? [];
  const maxRev = Math.max(1, ...franchises.map((f) => f.revenue));
  const outstanding = inv.filter((i) => (i.status ?? "").toLowerCase() !== "paid");
  const outstandingTotal = outstanding.reduce((s, i) => s + (i.amount || 0), 0);

  const KPI = ({ label, value, tone, hint }: { label: string; value: string; tone: string; hint?: string }) => (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{label}</div>
      <div className="mt-1 text-[26px] font-black leading-none" style={{ color: tone, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {hint && <div className="mt-1 text-[11px] text-[var(--ink-3)]">{hint}</div>}
    </div>
  );

  return (
    <OperatorPage title="Finance" icon="£" lede="Head office at a glance — your own money in and out, royalty income from the network, and a breakdown by franchise.">
      <TabStrip<FinTab> tabs={[["overview", "Overview"], ["in", "Money in"], ["out", "Money out"], ["invoices", "Invoices"]]} value={tab} onChange={setTab} />
      {tab === "in" && <SimpleLedger kind="in" items={inc?.items ?? []} onAdded={refresh} />}
      {tab === "out" && <SimpleLedger kind="out" items={exp?.items ?? []} onAdded={refresh} />}
      {tab === "invoices" && <InvoiceList items={inv} franchises={(split?.franchises ?? []).map((f) => f.name)} onCreated={refresh} />}
      {tab !== "overview" ? null : (<>
      {err && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#c02636]">{err}</div>}

      {/* Period */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PRESETS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setPeriod(k)} className="rounded-full border px-3 py-1 text-[12px] font-bold transition-colors" style={period === k ? { borderColor: "#2f6bd8", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{label}</button>
        ))}
      </div>

      {/* Headline P&L */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI label="Money in (own)" value={gbp(moneyIn)} tone="#0f8a4a" hint={`${incItems.length} entr${incItems.length === 1 ? "y" : "ies"}`} />
        <KPI label="Royalty income" value={gbp(royalty)} tone="#1d3a8f" hint={`from ${franchises.length} franchise${franchises.length === 1 ? "" : "s"}`} />
        <KPI label="Money out (own)" value={gbp(moneyOut)} tone="#c02636" hint={`${expItems.length} entr${expItems.length === 1 ? "y" : "ies"}`} />
        <KPI label="Net" value={gbp(net)} tone={net >= 0 ? "#0f8a4a" : "#c02636"} hint="in + royalties − out" />
      </div>

      {/* Breakdown by franchise */}
      <Card className="mt-4 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[14px] font-extrabold text-[var(--ink)]">Breakdown by franchise</div>
          <Link href="/company/splitfees" className="text-[11.5px] font-bold text-[#2f6bd8] hover:underline">Full split-fees →</Link>
        </div>
        {franchises.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] p-6 text-center text-[12.5px] text-[var(--ink-3)]">No franchise revenue in this period yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[12.5px]">
              <thead>
                <tr className="text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">
                  <th className="py-1.5 pr-3">Franchise</th>
                  <th className="py-1.5 pr-3 text-right">Bookings</th>
                  <th className="py-1.5 pr-3">Revenue</th>
                  <th className="py-1.5 text-right">Your royalty</th>
                </tr>
              </thead>
              <tbody>
                {franchises.map((f) => (
                  <tr key={f.franchiseId} className="border-t border-[var(--line)]">
                    <td className="py-2 pr-3 font-bold text-[var(--ink)]">{f.name}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[var(--ink-2)]">{f.count}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-full max-w-[160px] overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${Math.max(3, (f.revenue / maxRev) * 100)}%`, background: "linear-gradient(90deg,#2f6bd8,#4f8bf5)" }} /></div>
                        <span className="tabular-nums font-semibold text-[var(--ink-2)]">{gbp(f.revenue)}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right font-extrabold tabular-nums text-[#1d3a8f]">{gbp(f.fee)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--line)] text-[12.5px]">
                  <td className="py-2 pr-3 font-extrabold text-[var(--ink)]">Total</td>
                  <td className="py-2 pr-3" />
                  <td className="py-2 pr-3 font-extrabold tabular-nums text-[var(--ink)]">{gbp(split?.totals.revenue ?? 0)}</td>
                  <td className="py-2 text-right font-black tabular-nums text-[#1d3a8f]">{gbp(royalty)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Recent money in / out + invoices */}
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <RecentCard title="Recent money in" onOpen={() => setTab("in")} items={incItems.slice(0, 6)} tone="#0f8a4a" empty="No money in yet." labelOf={(x) => x.source || x.category || x.note || "Income"} />
        <RecentCard title="Recent money out" onOpen={() => setTab("out")} items={expItems.slice(0, 6)} tone="#c02636" empty="No spending yet." labelOf={(x) => x.supplier || x.category || x.description || x.note || "Expense"} />
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[13px] font-extrabold text-[var(--ink)]">Invoices</div>
            <button type="button" onClick={() => setTab("invoices")} className="text-[11.5px] font-bold text-[#2f6bd8] hover:underline">Open →</button>
          </div>
          <div className="rounded-xl bg-[var(--panel)] p-3">
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Outstanding</div>
            <div className="mt-0.5 text-[22px] font-black tabular-nums text-[#c02636]">{gbp(outstandingTotal)}</div>
            <div className="text-[11.5px] text-[var(--ink-3)]">{outstanding.length} unpaid · {inv.length} total</div>
          </div>
          <button type="button" onClick={() => setTab("invoices")} className="mt-3 block w-full rounded-lg bg-[#1d3a8f] px-3 py-2 text-center text-[12.5px] font-extrabold text-white transition hover:brightness-110">＋ Bill a franchise / new invoice</button>
        </Card>
      </div>
      </>)}
    </OperatorPage>
  );
}

// A plain head-office ledger — its own central money in or out. No booking
// analytics, payment-type splits or "collected so far": those are per-site
// operator numbers, not head office's own books. Just: log an entry, see the list.
function SimpleLedger({ kind, items, onAdded }: { kind: "in" | "out"; items: MItem[]; onAdded: () => void }) {
  const url = kind === "in" ? "/api/income" : "/api/expenses";
  const partyLabel = kind === "in" ? "From (optional)" : "Paid to (optional)";
  const partyKey = kind === "in" ? "source" : "supplier";
  const tone = kind === "in" ? "#0f8a4a" : "#c02636";
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [cat, setCat] = useState("");
  const [amt, setAmt] = useState("");
  const [party, setParty] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sorted = [...items].sort((a, b) => `${b.date ?? ""}`.localeCompare(`${a.date ?? ""}`));
  const total = sorted.reduce((s, x) => s + (x.amount || 0), 0);

  async function add() {
    const n = parseFloat(amt);
    if (!date || !cat.trim() || !(n >= 0)) { setErr("Add a date, a category and an amount."); return; }
    setBusy(true); setErr(null);
    try {
      await apiPost(withHoMoney(url), { date, category: cat.trim(), amount: n, ...(party.trim() ? { [partyKey]: party.trim() } : {}) });
      setCat(""); setAmt(""); setParty(""); onAdded();
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t save that."); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,320px)_1fr]">
      <Card className="h-fit p-4">
        <div className="text-[14px] font-extrabold text-[var(--ink)]">Log {kind === "in" ? "money in" : "money out"}</div>
        <div className="mb-3 mt-0.5 text-[11.5px] text-[var(--ink-3)]">Head office’s own {kind === "in" ? "income" : "spending"} — not franchise or booking money.</div>
        {err && <div className="mb-2 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12px] text-[#c02636]">{err}</div>}
        <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Date</label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mb-2.5 w-full" />
        <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Category</label>
        <Input value={cat} onChange={(e) => setCat(e.target.value)} placeholder={kind === "in" ? "e.g. Royalty top-up, grant" : "e.g. Marketing, software, rent"} className="mb-2.5 w-full" />
        <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Amount (£)</label>
        <Input type="number" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0.00" className="mb-2.5 w-full" />
        <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{partyLabel}</label>
        <Input value={party} onChange={(e) => setParty(e.target.value)} placeholder={kind === "in" ? "who it came from" : "supplier"} className="mb-3 w-full" />
        <Button variant="primary" onClick={add} disabled={busy}>{busy ? "Saving…" : `Add ${kind === "in" ? "income" : "expense"}`}</Button>
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[13px] font-extrabold text-[var(--ink)]">{kind === "in" ? "Money in" : "Money out"} ({sorted.length})</div>
          <div className="text-[13px] font-black tabular-nums" style={{ color: tone }}>{gbp(total)}</div>
        </div>
        {sorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-[12.5px] text-[var(--ink-3)]">Nothing logged yet — add your first entry on the left.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[12.5px]">
              <thead><tr className="text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]"><th className="py-1.5 pr-3">Date</th><th className="py-1.5 pr-3">Category</th><th className="py-1.5 pr-3">{kind === "in" ? "From" : "Paid to"}</th><th className="py-1.5 text-right">Amount</th></tr></thead>
              <tbody>
                {sorted.map((x, i) => (
                  <tr key={x.id ?? i} className="border-t border-[var(--line)]">
                    <td className="py-2 pr-3 tabular-nums text-[var(--ink-2)]">{shortDate(x.date)}</td>
                    <td className="py-2 pr-3 font-bold text-[var(--ink)]">{x.category || "—"}</td>
                    <td className="py-2 pr-3 text-[var(--ink-3)]">{x.source || x.supplier || "—"}</td>
                    <td className="py-2 text-right font-extrabold tabular-nums" style={{ color: tone }}>{gbp(x.amount || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function InvoiceList({ items, franchises, onCreated }: { items: Invoice[]; franchises: string[]; onCreated: () => void }) {
  const sorted = [...items].sort((a, b) => `${b.date ?? b.dueDate ?? ""}`.localeCompare(`${a.date ?? a.dueDate ?? ""}`));
  const paid = (s?: string) => (s ?? "").toLowerCase() === "paid";
  const [open, setOpen] = useState(false);
  const [billTo, setBillTo] = useState("");
  const [amt, setAmt] = useState("");
  const [due, setDue] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    const n = parseFloat(amt);
    if (!billTo.trim() || !(n > 0)) { setErr("Add who to bill and an amount."); return; }
    setBusy(true); setErr(null);
    try {
      await apiPost(withHoMoney("/api/invoices"), { customerName: billTo.trim(), amount: n, ...(due ? { dueDate: due } : {}), ...(desc.trim() ? { description: desc.trim() } : {}) });
      setBillTo(""); setAmt(""); setDue(""); setDesc(""); setOpen(false); onCreated();
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t create the invoice."); }
    finally { setBusy(false); }
  }

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[13px] font-extrabold text-[var(--ink)]">Invoices ({sorted.length})</div>
        <button type="button" onClick={() => { setOpen((o) => !o); setErr(null); }} className="rounded-lg bg-[#1d3a8f] px-3 py-1.5 text-[12px] font-extrabold text-white transition hover:brightness-110">{open ? "Close" : "＋ New invoice"}</button>
      </div>

      {open && (
        <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="mb-2 text-[12px] font-extrabold text-[var(--ink)]">Bill a franchise</div>
          {err && <div className="mb-2 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12px] text-[#c02636]">{err}</div>}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Bill to</label>
              <input list="ho-inv-franchises" value={billTo} onChange={(e) => setBillTo(e.target.value)} placeholder="Franchise name" className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" />
              <datalist id="ho-inv-franchises">{franchises.map((f) => <option key={f} value={f} />)}</datalist>
            </div>
            <div>
              <label className="mb-1 block text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Amount (£)</label>
              <input type="number" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0.00" className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" />
            </div>
            <div>
              <label className="mb-1 block text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Due date</label>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">What for (optional)</label>
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. September royalty fee" className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" />
            </div>
          </div>
          <button type="button" onClick={create} disabled={busy} className="mt-3 rounded-lg bg-[#1d3a8f] px-4 py-2 text-[12.5px] font-extrabold text-white transition hover:brightness-110 disabled:opacity-60">{busy ? "Creating…" : "Create invoice"}</button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-[12.5px] text-[var(--ink-3)]">No invoices yet. Raise one to bill a franchise their fees.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead><tr className="text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]"><th className="py-1.5 pr-3">Billed to</th><th className="py-1.5 pr-3">Due</th><th className="py-1.5 pr-3">Status</th><th className="py-1.5 text-right">Amount</th></tr></thead>
            <tbody>
              {sorted.map((iv, i) => (
                <tr key={iv.id ?? i} className="border-t border-[var(--line)]">
                  <td className="py-2 pr-3 font-bold text-[var(--ink)]">{iv.billTo || iv.customer || iv.to || "—"}</td>
                  <td className="py-2 pr-3 tabular-nums text-[var(--ink-2)]">{shortDate(iv.dueDate)}</td>
                  <td className="py-2 pr-3"><span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold" style={paid(iv.status) ? { background: "#e4f5eb", color: "#0f7a43" } : { background: "#fdecc8", color: "#8a5a00" }}>{paid(iv.status) ? "Paid" : "Outstanding"}</span></td>
                  <td className="py-2 text-right font-extrabold tabular-nums text-[var(--ink)]">{gbp(iv.amount || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function RecentCard({ title, onOpen, items, tone, empty, labelOf }: { title: string; onOpen: () => void; items: MItem[]; tone: string; empty: string; labelOf: (x: MItem) => string }) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[13px] font-extrabold text-[var(--ink)]">{title}</div>
        <button type="button" onClick={onOpen} className="text-[11.5px] font-bold text-[#2f6bd8] hover:underline">Open →</button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] p-5 text-center text-[12px] text-[var(--ink-3)]">{empty}</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((x, i) => (
            <div key={x.id ?? i} className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-2.5 py-1.5">
              <div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-bold text-[var(--ink)]">{labelOf(x)}</div><div className="text-[10.5px] text-[var(--ink-3)]">{shortDate(x.date)}</div></div>
              <span className="tabular-nums text-[12.5px] font-extrabold" style={{ color: tone }}>{gbp(x.amount || 0)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
