"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { Tile, GRAD, money } from "@/features/money/finance-kit";

// ─────────────────────────────────────────────────────────────────────────
// Reconciliation — the full off-platform payment ledger. Card that settled
// online is already reconciled; vouchers, Tax-Free Childcare, cash, bank
// transfers and manually-entered card payments are matched here. Marking a
// booking reconciled settles it, updates the booking, and emails + notifies
// the family so it shows in their bookings & payments area.
// ─────────────────────────────────────────────────────────────────────────

interface Item {
  ref: string; booker: string; email?: string; listing: string; listingId: string | null; child: string;
  method: string; pay: string; amount: number; amountPaid: number; outstanding: number;
  reconciled: boolean; voucherScheme: string | null; voucherReceiveBy: string | null; date: string; createdAt: string | null; overdue: boolean;
}
interface Recon { items: Item[]; summary: { count: number; reconciledCount: number; outstanding: number; overdue: number; awaitingVoucher: number; byMethod: Record<string, { count: number; outstanding: number }> } }
interface ListingLite { id: string; title?: string; name?: string; seasonId?: string | null }

const fmt = (iso?: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—");

// Bucket a booking's payment route into a tidy category for the tabs.
const PREF_ORDER = ["Card", "Childcare vouchers", "Tax-Free Childcare", "Cash", "Bank transfer", "HAF / funded", "Other"];
function methodCat(it: Item): string {
  const m = (it.method || "").toLowerCase();
  if (it.voucherScheme || /voucher/.test(m)) return "Childcare vouchers";
  if (/tax.?free|tfc/.test(m)) return "Tax-Free Childcare";
  if (/cash/.test(m)) return "Cash";
  if (/bank|transfer/.test(m)) return "Bank transfer";
  if (/haf|funded/.test(m) || it.pay === "Funded") return "HAF / funded";
  if (/card/.test(m)) return "Card";
  return it.method || "Other";
}
const CAT_C: Record<string, string> = { Card: "#1d3a8f", "Childcare vouchers": "#7c3aed", "Tax-Free Childcare": "#0ea5a0", Cash: "#0f7a43", "Bank transfer": "#3f78d8", "HAF / funded": "#e88f1f", Other: "#8a86a3" };

export function ReconciliationApp() {
  const { settings } = useSettings();
  const [data, setData] = useState<Recon | null>(null);
  const [listings, setListings] = useState<ListingLite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [cat, setCat] = useState("All");
  const [status, setStatus] = useState<"all" | "awaiting" | "reconciled">("awaiting");
  const [listingId, setListingId] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openRef, setOpenRef] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiGet<Recon>("/api/reconciliation").then((r) => { setData(r); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<ListingLite[]>("/api/listings?mine=1").then((l) => setListings(Array.isArray(l) ? l : [])).catch(() => {}); }, []);
  useRealtime(["bookings", "payments"], refresh);

  const seasons = settings.seasons ?? [];
  const listingSeason = useMemo(() => Object.fromEntries(listings.filter((l) => l.seasonId).map((l) => [l.id, l.seasonId as string])), [listings]);

  const items = useMemo(() => data?.items ?? [], [data]);
  // Categories present, in a sensible order, for the method tabs.
  const cats = useMemo(() => {
    const present = new Set(items.map(methodCat));
    return ["All", ...PREF_ORDER.filter((c) => present.has(c)), ...[...present].filter((c) => !PREF_ORDER.includes(c))];
  }, [items]);

  const filtered = useMemo(() => items.filter((it) => {
    if (cat !== "All" && methodCat(it) !== cat) return false;
    if (status === "awaiting" && it.reconciled) return false;
    if (status === "reconciled" && !it.reconciled) return false;
    if (listingId && it.listingId !== listingId) return false;
    if (seasonId && (it.listingId ? listingSeason[it.listingId] : "") !== seasonId) return false;
    if (from && (!it.date || it.date < from)) return false;
    if (to && (!it.date || it.date > to)) return false;
    return true;
  }), [items, cat, status, listingId, seasonId, from, to, listingSeason]);

  const shownOutstanding = filtered.filter((i) => !i.reconciled).reduce((s, i) => s + i.outstanding, 0);
  const anyFilter = cat !== "All" || status !== "awaiting" || listingId || seasonId || from || to;

  async function reconcile(it: Item, undo = false) {
    setBusy(it.ref);
    try { await api(`/api/bookings/${encodeURIComponent(it.ref)}/reconcile`, { method: "POST", body: JSON.stringify(undo ? { undo: true } : { method: it.voucherScheme ? `Voucher (${it.voucherScheme})` : it.method }) }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t update"); }
    finally { setBusy(null); }
  }

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <PageHero icon="⇄" title="Reconciliation" lede="Match the money that lands off-platform — vouchers, Tax-Free Childcare, cash and manual card payments. Marking one reconciled settles the booking and lets the family know." />

      {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#c02636]">{error}</div>}

      <div className="mb-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Awaiting" icon="⏳" grad={(data?.summary.count ?? 0) > 0 ? GRAD.pink : GRAD.green} value={data ? String(data.summary.count) : "…"} sub="payments to match" />
        <Tile label="Outstanding" icon="💷" grad={GRAD.blue} value={data ? money(data.summary.outstanding) : "…"} sub="still to come in" />
        <Tile label="Reconciled" icon="✅" grad={GRAD.green} value={data ? String(data.summary.reconciledCount) : "…"} sub="fully matched" />
        <Tile label="Overdue" icon="⚠️" grad={(data?.summary.overdue ?? 0) > 0 ? GRAD.amber : GRAD.teal} value={data ? String(data.summary.overdue) : "…"} sub="vouchers past due" />
      </div>

      {/* Method tabs */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-all duration-150 hover:-translate-y-px"
            style={cat === c ? { borderColor: "transparent", background: c === "All" ? "linear-gradient(180deg,#4f8bf5,#2f6bd8)" : (CAT_C[c] ?? "#1d3a8f"), color: "#fff", boxShadow: "0 3px 10px -2px rgba(47,107,216,.45)" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
            {c}{c !== "All" && <span className={cat === c ? "ml-1 opacity-80" : "ml-1 text-[var(--ink-3)]"}>{items.filter((it) => methodCat(it) === c).length}</span>}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="inline-flex items-center gap-0.5 rounded-full border border-[var(--line)] p-0.5 text-[11.5px] font-bold">
          {([["all", "All"], ["awaiting", "Awaiting"], ["reconciled", "Reconciled"]] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setStatus(v)} className="rounded-full px-2.5 py-1 transition-colors" style={status === v ? { background: "#1d3a8f", color: "#fff" } : { color: "var(--ink-3)" }}>{l}</button>
          ))}
        </div>
        <select value={listingId} onChange={(e) => setListingId(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px]">
          <option value="">All listings</option>
          {listings.map((l) => <option key={l.id} value={l.id}>{l.title || l.name || "Listing"}</option>)}
        </select>
        {seasons.length > 0 && (
          <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px]">
            <option value="">All seasons</option>
            {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <label className="flex items-center gap-1 text-[11.5px] text-[var(--ink-3)]">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[12.5px]" /></label>
        <label className="flex items-center gap-1 text-[11.5px] text-[var(--ink-3)]">to <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[12.5px]" /></label>
        {anyFilter && <button type="button" onClick={() => { setCat("All"); setStatus("awaiting"); setListingId(""); setSeasonId(""); setFrom(""); setTo(""); }} className="text-[11.5px] font-bold text-[#2f6bd8]">Clear filters</button>}
        <span className="ml-auto text-[12px] text-[var(--ink-3)]">{filtered.length} shown{shownOutstanding > 0 ? ` · ${money(shownOutstanding)} outstanding` : ""}</span>
      </div>

      {!data ? (
        <div className="py-12 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] py-14 text-center text-[13px] text-[var(--ink-3)]">{status === "awaiting" ? "Nothing to reconcile here — all matched. 🎉" : "No bookings match these filters."}</div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((it) => {
            const c = methodCat(it);
            const tone = CAT_C[c] ?? "#8a86a3";
            return (
              <div key={it.ref} className="overflow-hidden rounded-2xl border bg-[var(--surface)] shadow-[0_1px_3px_rgba(20,30,60,.06)]" style={{ borderColor: it.overdue ? "#f6c9cc" : "var(--line)" }}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
                  <span className="w-1.5 self-stretch rounded-full" style={{ background: tone }} />
                  <div className="min-w-[150px] flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                      <span className="font-extrabold">#{it.ref}</span>
                      <span className="text-[var(--ink-2)]">{it.booker} · {it.child}</span>
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">{it.listing} · {fmt(it.date)}</div>
                  </div>
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white" style={{ background: tone }}>{it.voucherScheme ? `Voucher · ${it.voucherScheme}` : c}</span>
                  {it.overdue && <span className="rounded-full bg-[#fdebec] px-2 py-0.5 text-[11px] font-bold text-[#c02636]">overdue{it.voucherReceiveBy ? ` since ${fmt(it.voucherReceiveBy)}` : ""}</span>}
                  <div className="text-right">
                    <div className="text-[14px] font-extrabold tabular-nums">{it.reconciled ? money(it.amount) : `${money(it.outstanding)} due`}</div>
                    {!it.reconciled && it.amountPaid > 0 && <div className="text-[10.5px] text-[var(--ink-3)]">{money(it.amountPaid)} of {money(it.amount)} paid</div>}
                  </div>
                  {it.reconciled ? (
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#e2f5ea] px-2.5 py-1 text-[11.5px] font-bold text-[#0b8446]">✓ Reconciled</span>
                      <button type="button" disabled={busy === it.ref} onClick={() => reconcile(it, true)} className="text-[11px] font-bold text-[var(--ink-3)] hover:text-[#c02636] disabled:opacity-50">Undo</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setOpenRef(openRef === it.ref ? null : it.ref)} className="text-[11.5px] font-bold text-[#2f6bd8]">Part payment</button>
                      <button type="button" disabled={busy === it.ref} onClick={() => reconcile(it)} className="rounded-full px-3.5 py-1.5 text-[12px] font-extrabold text-white shadow-sm transition-transform hover:-translate-y-px disabled:opacity-50" style={{ background: "linear-gradient(180deg,#22b06b,#0b8446)" }}>{busy === it.ref ? "Saving…" : "✓ Reconcile"}</button>
                    </div>
                  )}
                </div>
                {openRef === it.ref && !it.reconciled && <RecordForm item={it} onDone={() => { setOpenRef(null); refresh(); }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Partial / manual amount entry — for when only some of the money has arrived.
function RecordForm({ item, onDone }: { item: Item; onDone: () => void }) {
  const [amount, setAmount] = useState(String(item.outstanding));
  const [method, setMethod] = useState(item.voucherScheme ? `Voucher (${item.voucherScheme})` : item.method);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Enter an amount."); return; }
    setBusy(true); setError(null);
    try { await api(`/api/bookings/${encodeURIComponent(item.ref)}/record-payment`, { method: "POST", body: JSON.stringify({ amount: amt, method, reference }) }); onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t record"); setBusy(false); }
  }
  return (
    <div className="border-t border-[var(--line)] bg-[var(--panel)] p-3.5">
      <div className="mb-1.5 text-[12px] font-extrabold">Record a part payment for #{item.ref}</div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Amount £<input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px]" /></label>
        <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Method<input value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px]" /></label>
        <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Reference<input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. bank ref" className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px]" /></label>
      </div>
      {error && <div className="mt-1.5 text-[12px] font-bold text-[#c02636]">{error}</div>}
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={busy} onClick={save} className="rounded-full px-3.5 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-50" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>{busy ? "Recording…" : "Record part payment"}</button>
        <button type="button" onClick={onDone} className="rounded-full border border-[var(--line)] px-3.5 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">Cancel</button>
      </div>
    </div>
  );
}
