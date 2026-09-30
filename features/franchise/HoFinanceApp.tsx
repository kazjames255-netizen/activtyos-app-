"use client";

// ── Head-office Finance (one simple page) ──────────────────────────────────
// Everything a franchisor actually needs about money, on a single screen:
//   · the headline P&L — head office's OWN money in/out + royalty income + net
//   · a breakdown BY FRANCHISE (revenue + the royalty each one owes)
//   · a quick look at recent money in / money out and outstanding invoices
// Deliberately far simpler than the per-site operator Finance hub. Shown for the
// HO combined view via CompanyFinanceSwitch; the full ledgers stay reachable by
// direct link for when detail is needed.
import { dateLocale as dl } from "@/lib/i18n/format";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useT, tNow } from "@/lib/i18n/provider";
import { withHoMoney } from "@/lib/ho-net";
import { OperatorPage, TabStrip } from "@/components/OperatorPage";
import { Button, Card, Input } from "@/components/ui";

const gbp = (n: number) => "£" + Math.round(n || 0).toLocaleString(dl());
const shortDate = (d?: string) => (d ? new Date(d).toLocaleDateString(dl(), { day: "numeric", month: "short" }) : "");

interface FrRow { franchiseId: string; name: string; revenue: number; count: number; fee: number }
interface SplitPayload { franchises: FrRow[]; totals: { franchises: number; revenue: number; fee: number } }
interface MItem { id?: string; status?: string; date?: string; amount?: number; category?: string; note?: string; supplier?: string; source?: string; description?: string }
interface MPayload { items: MItem[]; summary: { total: number; count: number; byCategory: Record<string, number> } }
interface Invoice { id?: string; amount?: number; status?: string; dueDate?: string; date?: string; to?: string; customer?: string; billTo?: string }

const PRESETS = [["1m", "finOneMonth"], ["3m", "franchise.threeMonths"], ["6m", "franchise.sixMonths"], ["12m", "franchise.twelveMonths"], ["all", "finAllTime"]] as const;
const presetKey = (k: string) => (k.startsWith("franchise.") ? k : `p8fr.${k}`);
type Period = (typeof PRESETS)[number][0];
const monthsBack: Record<Exclude<Period, "all">, number> = { "1m": 1, "3m": 3, "6m": 6, "12m": 12 };

type FinTab = "overview" | "in" | "out" | "invoices";

export function HoFinanceApp() {
  const t = useT();
  const [tab, setTab] = useState<FinTab>("overview");
  const [period, setPeriod] = useState<Period>("3m");
  const [split, setSplit] = useState<SplitPayload | null>(null);
  const [inc, setInc] = useState<MPayload | null>(null);
  const [exp, setExp] = useState<MPayload | null>(null);
  const [inv, setInv] = useState<Invoice[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiGet<SplitPayload>(`/api/splitfees?period=${period}`).then(setSplit).catch((e) => setErr(e instanceof Error ? e.message : tNow("p8fr.finLoadErr")));
    apiGet<MPayload>(withHoMoney("/api/income")).then(setInc).catch(() => {});
    apiGet<MPayload>(withHoMoney("/api/expenses")).then(setExp).catch(() => {});
    apiGet<{ items: Invoice[] }>(withHoMoney("/api/invoices")).then((p) => setInv(p.items ?? [])).catch(() => {});
  }, [period]);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["income", "expenses", "invoices", "bookings"], refresh);

  // Filter head office's OWN money to the chosen window (the franchise breakdown
  // is already ranged server-side via ?period).
  const startTs = useMemo(() => { if (period === "all") return 0; const d = new Date(); d.setMonth(d.getMonth() - monthsBack[period]); return d.getTime(); }, [period]);
  // Money that has actually moved: dated on or before today. A recurring receipt/expense is created up front as one row per future date, and
  // those rows were being totalled as if they had already happened (a monthly £100 bill through December showed as £400 spent today).
  const todayStr = (() => { const n = new Date(); const p = (v: number) => String(v).padStart(2, "0"); return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`; })();
  const within = (d?: string) => !!d && d.slice(0, 10) <= todayStr && (period === "all" ? true : new Date(d).getTime() >= startTs);
  const incItems = (inc?.items ?? []).filter((x) => within(x.date)).sort((a, b) => `${b.date ?? ""}`.localeCompare(`${a.date ?? ""}`));
  const expItems = (exp?.items ?? []).filter((x) => within(x.date)).sort((a, b) => `${b.date ?? ""}`.localeCompare(`${a.date ?? ""}`));
  const moneyIn = incItems.reduce((s, x) => s + (x.amount || 0), 0);
  // Money out counts what has been PAID (the Money out page's default cash basis); a Pending bill is owed, not spent yet.
  const moneyOut = expItems.filter((x) => x.status !== "pending").reduce((s, x) => s + (x.amount || 0), 0);
  const royalty = split?.totals.fee ?? 0;
  const net = moneyIn + royalty - moneyOut;
  const franchises = split?.franchises ?? [];
  const maxRev = Math.max(1, ...franchises.map((f) => f.revenue));
  // Owed = sent and unpaid (the server's own definition): a draft was never issued and a cancelled invoice is not owed.
  const outstanding = inv.filter((i) => (i.status ?? "").toLowerCase() === "sent");
  const outstandingTotal = outstanding.reduce((s, i) => s + (i.amount || 0), 0);

  const KPI = ({ label, value, tone, hint }: { label: string; value: string; tone: string; hint?: string }) => (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{label}</div>
      <div className="mt-1 text-[26px] font-black leading-none" style={{ color: tone, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {hint && <div className="mt-1 text-[11px] text-[var(--ink-3)]">{hint}</div>}
    </div>
  );

  return (
    <OperatorPage title={t("p8fr.finTitle")} icon="£" lede={t("p8fr.finLede")}>
      <TabStrip<FinTab> tabs={[["overview", t("p8fr.finTabOverview")], ["in", t("p8fr.finTabIn")], ["out", t("p8fr.finTabOut")], ["invoices", t("p8fr.finTabInvoices")]]} value={tab} onChange={setTab} />
      {tab === "in" && <SimpleLedger kind="in" items={inc?.items ?? []} onAdded={refresh} />}
      {tab === "out" && <SimpleLedger kind="out" items={exp?.items ?? []} onAdded={refresh} />}
      {tab === "invoices" && <InvoiceList items={inv} franchises={(split?.franchises ?? []).map((f) => f.name)} onCreated={refresh} />}
      {tab !== "overview" ? null : (<>
      {err && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#c02636]">{err}</div>}

      {/* Period */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PRESETS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setPeriod(k)} className="rounded-full border px-3 py-1 text-[12px] font-bold transition-colors" style={period === k ? { borderColor: "#2f6bd8", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{t(presetKey(label))}</button>
        ))}
      </div>

      {/* Headline P&L */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI label={t("p8fr.finKpiIn")} value={gbp(moneyIn)} tone="#0f8a4a" hint={t(incItems.length === 1 ? "p8fr.finEntryOne" : "p8fr.finEntryOther", { count: incItems.length })} />
        <KPI label={t("p8fr.finKpiRoyalty")} value={gbp(royalty)} tone="#1d3a8f" hint={t(franchises.length === 1 ? "p8fr.finFromFranchiseOne" : "p8fr.finFromFranchiseOther", { count: franchises.length })} />
        <KPI label={t("p8fr.finKpiOut")} value={gbp(moneyOut)} tone="#c02636" hint={t(expItems.length === 1 ? "p8fr.finEntryOne" : "p8fr.finEntryOther", { count: expItems.length })} />
        <KPI label={t("p8fr.finKpiNet")} value={gbp(net)} tone={net >= 0 ? "#0f8a4a" : "#c02636"} hint={t("p8fr.finNetHint")} />
      </div>

      {/* Breakdown by franchise */}
      <Card className="mt-4 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[14px] font-extrabold text-[var(--ink)]">{t("p8fr.finBreakdown")}</div>
          <Link href="/company/splitfees" className="text-[11.5px] font-bold text-[#2f6bd8] hover:underline">{t("p8fr.finFullSplit")}</Link>
        </div>
        {franchises.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] p-6 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8fr.finNoFranchiseRev")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-start text-[12.5px]">
              <thead>
                <tr className="text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">
                  <th className="py-1.5 pe-3">{t("p8fr.finColFranchise")}</th>
                  <th className="py-1.5 pe-3 text-end">{t("franchise.bookings")}</th>
                  <th className="py-1.5 pe-3">{t("franchise.revenue")}</th>
                  <th className="py-1.5 text-end">{t("p8fr.finYourRoyalty")}</th>
                </tr>
              </thead>
              <tbody>
                {franchises.map((f) => (
                  <tr key={f.franchiseId} className="border-t border-[var(--line)]">
                    <td className="py-2 pe-3 font-bold text-[var(--ink)]">{f.name}</td>
                    <td className="py-2 pe-3 text-end tabular-nums text-[var(--ink-2)]">{f.count}</td>
                    <td className="py-2 pe-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-full max-w-[160px] overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${Math.max(3, (f.revenue / maxRev) * 100)}%`, background: "linear-gradient(90deg,#2f6bd8,#4f8bf5)" }} /></div>
                        <span className="tabular-nums font-semibold text-[var(--ink-2)]">{gbp(f.revenue)}</span>
                      </div>
                    </td>
                    <td className="py-2 text-end font-extrabold tabular-nums text-[#1d3a8f]">{gbp(f.fee)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--line)] text-[12.5px]">
                  <td className="py-2 pe-3 font-extrabold text-[var(--ink)]">{t("franchise.total")}</td>
                  <td className="py-2 pe-3" />
                  <td className="py-2 pe-3 font-extrabold tabular-nums text-[var(--ink)]">{gbp(split?.totals.revenue ?? 0)}</td>
                  <td className="py-2 text-end font-black tabular-nums text-[#1d3a8f]">{gbp(royalty)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Recent money in / out + invoices */}
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <RecentCard title={t("p8fr.finRecentIn")} onOpen={() => setTab("in")} items={incItems.slice(0, 6)} tone="#0f8a4a" empty={t("p8fr.finNoIn")} labelOf={(x) => x.source || x.category || x.note || t("p8fr.finIncomeWord")} />
        <RecentCard title={t("p8fr.finRecentOut")} onOpen={() => setTab("out")} items={expItems.slice(0, 6)} tone="#c02636" empty={t("p8fr.finNoOut")} labelOf={(x) => x.supplier || x.category || x.description || x.note || t("p8fr.finExpenseWord")} />
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[13px] font-extrabold text-[var(--ink)]">{t("p8fr.finTabInvoices")}</div>
            <button type="button" onClick={() => setTab("invoices")} className="text-[11.5px] font-bold text-[#2f6bd8] hover:underline">{t("franchise.openArrow")}</button>
          </div>
          <div className="rounded-xl bg-[var(--panel)] p-3">
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8fr.finOutstanding")}</div>
            <div className="mt-0.5 text-[22px] font-black tabular-nums text-[#c02636]">{gbp(outstandingTotal)}</div>
            <div className="text-[11.5px] text-[var(--ink-3)]">{t("p8fr.finUnpaidTotal", { unpaid: outstanding.length, total: inv.length })}</div>
          </div>
          <button type="button" onClick={() => setTab("invoices")} className="mt-3 block w-full rounded-lg bg-[#1d3a8f] px-3 py-2 text-center text-[12.5px] font-extrabold text-white transition hover:brightness-110">{t("p8fr.finBillBtn")}</button>
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
  const t = useT();
  const url = kind === "in" ? "/api/income" : "/api/expenses";
  const partyLabel = kind === "in" ? t("p8fr.finFromOpt") : t("p8fr.finPaidToOpt");
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
    if (!date || !cat.trim() || !(n >= 0)) { setErr(t("p8fr.finNeedDateCatAmt")); return; }
    setBusy(true); setErr(null);
    try {
      await apiPost(withHoMoney(url), { date, category: cat.trim(), amount: n, ...(party.trim() ? { [partyKey]: party.trim() } : {}) });
      setCat(""); setAmt(""); setParty(""); onAdded();
    } catch (e) { setErr(e instanceof Error ? e.message : t("p8fr.finSaveFail")); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,320px)_1fr]">
      <Card className="h-fit p-4">
        <div className="text-[14px] font-extrabold text-[var(--ink)]">{kind === "in" ? t("p8fr.finLogIn") : t("p8fr.finLogOut")}</div>
        <div className="mb-3 mt-0.5 text-[11.5px] text-[var(--ink-3)]">{kind === "in" ? t("p8fr.finOwnIncomeNote") : t("p8fr.finOwnSpendNote")}</div>
        {err && <div className="mb-2 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12px] text-[#c02636]">{err}</div>}
        <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8fr.finLblDate")}</label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mb-2.5 w-full" />
        <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8fr.finLblCategory")}</label>
        <Input value={cat} onChange={(e) => setCat(e.target.value)} placeholder={kind === "in" ? t("p8fr.finPhCatIn") : t("p8fr.finPhCatOut")} className="mb-2.5 w-full" />
        <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8fr.finLblAmount")}</label>
        <Input type="number" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0.00" className="mb-2.5 w-full" />
        <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{partyLabel}</label>
        <Input value={party} onChange={(e) => setParty(e.target.value)} placeholder={kind === "in" ? t("p8fr.finPhFrom") : t("p8fr.finPhSupplier")} className="mb-3 w-full" />
        <Button variant="primary" onClick={add} disabled={busy}>{busy ? t("franchise.saving") : kind === "in" ? t("p8fr.finAddIncome") : t("p8fr.finAddExpense")}</Button>
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[13px] font-extrabold text-[var(--ink)]">{kind === "in" ? t("p8fr.finTabIn") : t("p8fr.finTabOut")} ({sorted.length})</div>
          <div className="text-[13px] font-black tabular-nums" style={{ color: tone }}>{gbp(total)}</div>
        </div>
        {sorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8fr.finNothingLogged")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-start text-[12.5px]">
              <thead><tr className="text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]"><th className="py-1.5 pe-3">{t("p8fr.finLblDate")}</th><th className="py-1.5 pe-3">{t("p8fr.finLblCategory")}</th><th className="py-1.5 pe-3">{kind === "in" ? t("p8fr.finColFrom") : t("p8fr.finColPaidTo")}</th><th className="py-1.5 text-end">{t("p8fr.finColAmount")}</th></tr></thead>
              <tbody>
                {sorted.map((x, i) => (
                  <tr key={x.id ?? i} className="border-t border-[var(--line)]">
                    <td className="py-2 pe-3 tabular-nums text-[var(--ink-2)]">{shortDate(x.date)}</td>
                    <td className="py-2 pe-3 font-bold text-[var(--ink)]">{x.category || "—"}</td>
                    <td className="py-2 pe-3 text-[var(--ink-3)]">{x.source || x.supplier || "—"}</td>
                    <td className="py-2 text-end font-extrabold tabular-nums" style={{ color: tone }}>{gbp(x.amount || 0)}</td>
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
  const t = useT();
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
    if (!billTo.trim() || !(n > 0)) { setErr(t("p8fr.finNeedBillTo")); return; }
    setBusy(true); setErr(null);
    try {
      await apiPost(withHoMoney("/api/invoices"), { customerName: billTo.trim(), amount: n, ...(due ? { dueDate: due } : {}), ...(desc.trim() ? { description: desc.trim() } : {}) });
      setBillTo(""); setAmt(""); setDue(""); setDesc(""); setOpen(false); onCreated();
    } catch (e) { setErr(e instanceof Error ? e.message : t("p8fr.finCreateFail")); }
    finally { setBusy(false); }
  }

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[13px] font-extrabold text-[var(--ink)]">{t("p8fr.finTabInvoices")} ({sorted.length})</div>
        <button type="button" onClick={() => { setOpen((o) => !o); setErr(null); }} className="rounded-lg bg-[#1d3a8f] px-3 py-1.5 text-[12px] font-extrabold text-white transition hover:brightness-110">{open ? t("p8fr.finClose") : t("p8fr.finNewInvoice")}</button>
      </div>

      {open && (
        <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="mb-2 text-[12px] font-extrabold text-[var(--ink)]">{t("p8fr.finBillAFranchise")}</div>
          {err && <div className="mb-2 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12px] text-[#c02636]">{err}</div>}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8fr.finLblBillTo")}</label>
              <input list="ho-inv-franchises" value={billTo} onChange={(e) => setBillTo(e.target.value)} placeholder={t("p8fr.finPhFranchiseName")} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" />
              <datalist id="ho-inv-franchises">{franchises.map((f) => <option key={f} value={f} />)}</datalist>
            </div>
            <div>
              <label className="mb-1 block text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8fr.finLblAmount")}</label>
              <input type="number" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0.00" className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" />
            </div>
            <div>
              <label className="mb-1 block text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8fr.finLblDue")}</label>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8fr.finLblWhatFor")}</label>
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("p8fr.finPhWhatFor")} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[#2f6bd8]" />
            </div>
          </div>
          <button type="button" onClick={create} disabled={busy} className="mt-3 rounded-lg bg-[#1d3a8f] px-4 py-2 text-[12.5px] font-extrabold text-white transition hover:brightness-110 disabled:opacity-60">{busy ? t("franchise.creating") : t("p8fr.finCreateInvoice")}</button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8fr.finNoInvoices")}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-start text-[12.5px]">
            <thead><tr className="text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]"><th className="py-1.5 pe-3">{t("p8fr.finColBilledTo")}</th><th className="py-1.5 pe-3">{t("p8fr.finColDue")}</th><th className="py-1.5 pe-3">{t("p8fr.finColStatus")}</th><th className="py-1.5 text-end">{t("p8fr.finColAmount")}</th></tr></thead>
            <tbody>
              {sorted.map((iv, i) => (
                <tr key={iv.id ?? i} className="border-t border-[var(--line)]">
                  <td className="py-2 pe-3 font-bold text-[var(--ink)]">{iv.billTo || iv.customer || iv.to || "—"}</td>
                  <td className="py-2 pe-3 tabular-nums text-[var(--ink-2)]">{shortDate(iv.dueDate)}</td>
                  <td className="py-2 pe-3"><span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold" style={paid(iv.status) ? { background: "#e4f5eb", color: "#0f7a43" } : { background: "#fdecc8", color: "#8a5a00" }}>{paid(iv.status) ? t("p8fr.finStatusPaid") : (iv.status ?? "").toLowerCase() === "draft" ? t("p8fr.finStatusDraft") : (iv.status ?? "").toLowerCase() === "cancelled" ? t("p8fr.finStatusCancelled") : t("p8fr.finOutstanding")}</span></td>
                  <td className="py-2 text-end font-extrabold tabular-nums text-[var(--ink)]">{gbp(iv.amount || 0)}</td>
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
  const t = useT();
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[13px] font-extrabold text-[var(--ink)]">{title}</div>
        <button type="button" onClick={onOpen} className="text-[11.5px] font-bold text-[#2f6bd8] hover:underline">{t("franchise.openArrow")}</button>
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
