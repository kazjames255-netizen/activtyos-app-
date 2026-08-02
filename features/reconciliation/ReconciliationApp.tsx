"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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

interface PayRef { child?: string; scheme?: string; ref: string; amount?: number }
interface Note { at: string; by?: string; text: string }
interface Item {
  ref: string; booker: string; email?: string; phone?: string; listing: string; listingId: string | null; child: string;
  method: string; pay: string; amount: number; amountPaid: number; outstanding: number; cardPaid: number;
  reconciled: boolean; voucherScheme: string | null; voucherReceiveBy: string | null;
  paymentRef: string | null; payRefs: PayRef[] | null; reconNotes: Note[]; nudges: number; lastNudgedAt: string | null;
  dates: string; sessions: string[]; date: string; createdAt: string | null; overdue: boolean;
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
  const [voucherSub, setVoucherSub] = useState(""); // sub-filter within Childcare vouchers (Edenred, …)
  const [nowMs] = useState(() => Date.now());
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null); // row whose full detail card is open
  const [editRef, setEditRef] = useState<string | null>(null); // booking whose payment reference is being edited
  const [refDraft, setRefDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");

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

  // Voucher schemes present, for the sub-filter chips under the Vouchers tab.
  const voucherSchemes = useMemo(() => [...new Set(items.filter((it) => methodCat(it) === "Childcare vouchers" && it.voucherScheme).map((it) => it.voucherScheme as string))].sort(), [items]);

  const filtered = useMemo(() => items.filter((it) => {
    if (cat !== "All" && methodCat(it) !== cat) return false;
    if (cat === "Childcare vouchers" && voucherSub && it.voucherScheme !== voucherSub) return false;
    if (status === "awaiting" && it.reconciled) return false;
    if (status === "reconciled" && !it.reconciled) return false;
    if (listingId && it.listingId !== listingId) return false;
    if (seasonId && (it.listingId ? listingSeason[it.listingId] : "") !== seasonId) return false;
    if (from && (!it.date || it.date < from)) return false;
    if (to && (!it.date || it.date > to)) return false;
    return true;
  }), [items, cat, voucherSub, status, listingId, seasonId, from, to, listingSeason]);

  const shownOutstanding = filtered.filter((i) => !i.reconciled).reduce((s, i) => s + i.outstanding, 0);
  const anyFilter = cat !== "All" || status !== "awaiting" || listingId || seasonId || from || to;

  async function reconcile(it: Item, undo = false) {
    setBusy(it.ref);
    try { await api(`/api/bookings/${encodeURIComponent(it.ref)}/reconcile`, { method: "POST", body: JSON.stringify(undo ? { undo: true } : { method: it.voucherScheme ? `Voucher (${it.voucherScheme})` : it.method }) }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t update"); }
    finally { setBusy(null); }
  }
  async function nudge(it: Item) {
    setBusy(it.ref);
    try { await api(`/api/bookings/${encodeURIComponent(it.ref)}/nudge`, { method: "POST", body: "{}" }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t nudge"); }
    finally { setBusy(null); }
  }
  async function saveRef(it: Item) {
    setBusy(it.ref);
    try { await api(`/api/bookings/${encodeURIComponent(it.ref)}/payment-ref`, { method: "PUT", body: JSON.stringify({ paymentRef: refDraft.trim() }) }); setEditRef(null); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save reference"); }
    finally { setBusy(null); }
  }
  async function saveNotes(it: Item) {
    if (!notesDraft.trim()) return;
    setBusy(it.ref);
    try { await api(`/api/bookings/${encodeURIComponent(it.ref)}/recon-notes`, { method: "PUT", body: JSON.stringify({ note: notesDraft.trim() }) }); setNotesDraft(""); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save note"); }
    finally { setBusy(null); }
  }
  const daysOverdue = (it: Item) => { const t = Date.parse(it.createdAt ?? ""); return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((nowMs - t) / 86400000)); };
  const stamp = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

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
          <button key={c} type="button" onClick={() => { setCat(c); setVoucherSub(""); }} className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-all duration-150 hover:-translate-y-px"
            style={cat === c ? { borderColor: "transparent", background: c === "All" ? "linear-gradient(180deg,#4f8bf5,#2f6bd8)" : (CAT_C[c] ?? "#1d3a8f"), color: "#fff", boxShadow: "0 3px 10px -2px rgba(47,107,216,.45)" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
            {c}{c !== "All" && <span className={cat === c ? "ml-1 opacity-80" : "ml-1 text-[var(--ink-3)]"}>{items.filter((it) => methodCat(it) === c).length}</span>}
          </button>
        ))}
      </div>

      {/* Voucher provider sub-filter (Edenred, Computershare, …) */}
      {cat === "Childcare vouchers" && voucherSchemes.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Provider:</span>
          {["", ...voucherSchemes].map((v) => (
            <button key={v || "all"} type="button" onClick={() => setVoucherSub(v)} className="rounded-full border px-3 py-1 text-[12px] font-bold transition-colors"
              style={voucherSub === v ? { borderColor: "transparent", background: "#7c3aed", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
              {v || "All providers"}{v && <span className={voucherSub === v ? "ml-1 opacity-80" : "ml-1 text-[var(--ink-3)]"}>{items.filter((it) => it.voucherScheme === v).length}</span>}
            </button>
          ))}
        </div>
      )}

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
        {anyFilter && <button type="button" onClick={() => { setCat("All"); setVoucherSub(""); setStatus("awaiting"); setListingId(""); setSeasonId(""); setFrom(""); setTo(""); }} className="text-[11.5px] font-bold text-[#2f6bd8]">Clear filters</button>}
        <span className="ml-auto text-[12px] text-[var(--ink-3)]">{filtered.length} shown{shownOutstanding > 0 ? ` · ${money(shownOutstanding)} outstanding` : ""}</span>
      </div>

      {cat === "Tax-Free Childcare" ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-xl text-[20px] text-white" style={{ background: GRAD.teal }}>🏦</span>
            <div>
              <div className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Tax-Free Childcare reconciles automatically</div>
              <p className="mt-1 max-w-[620px] text-[12.5px] leading-relaxed text-[var(--ink-2)]">Parents pay from their government childcare account at <span className="font-semibold">gov.uk/sign-in-childcare-account</span> using your Ofsted/regulator number. Once HMRC settles it, the booking is matched here without any manual work — so there’s nothing to reconcile by hand.</p>
              <div className="mt-3 rounded-lg border border-[#f3d98a] bg-[#fdf6e3] px-3 py-2 text-[12px] text-[#7a5a12]">
                <b>Amir — this is where Tax-Free Childcare is wired.</b> Auto-reconciliation is pending the <b>HMRC EPP (Electronic Payment Provider) integration</b> (per <code>docs/listings-backend-handoff.md</code> §S). Until it’s live, TFC payments land in the bank like any transfer; wire the EPP feed to match them to bookings and flip them to Paid here automatically.
              </div>
            </div>
          </div>
        </div>
      ) : !data ? (
        <div className="py-12 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] py-14 text-center text-[13px] text-[var(--ink-3)]">{status === "awaiting" ? "Nothing to reconcile here — all matched. 🎉" : "No bookings match these filters."}</div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="px-1 text-[11px] leading-snug text-[var(--ink-3)]">Split payments show how much was taken by card; the rest is what you reconcile here. A booking for two children may pay as two references (e.g. £50 per reference on a £100 booking) — open a row to see each one.</p>
          {filtered.map((it) => {
            const c = methodCat(it);
            const tone = CAT_C[c] ?? "#8a86a3";
            const refCount = it.payRefs?.length ?? (it.paymentRef ? 1 : 0);
            const due = it.outstanding;
            const offReceived = Math.max(0, it.amountPaid - it.cardPaid);
            const partPaid = !it.reconciled && it.amountPaid > 0 && due > 0; // some money in, balance still owed
            const isOpen = expanded === it.ref;
            return (
              <div key={it.ref} className="overflow-hidden rounded-2xl border bg-[var(--surface)] shadow-[0_1px_3px_rgba(20,30,60,.06)]" style={{ borderColor: it.overdue ? "#f6c9cc" : "var(--line)" }}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
                  <span className="w-1.5 self-stretch rounded-full" style={{ background: tone }} />
                  <button type="button" onClick={() => { const open = !isOpen; setExpanded(open ? it.ref : null); if (open) { setNotesDraft(""); setEditRef(null); } }} className="min-w-[160px] flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                      <span className="text-[var(--ink-3)]">{isOpen ? "▾" : "▸"}</span>
                      <span className="font-extrabold">#{it.ref}</span>
                      <span className="text-[var(--ink-2)]">{it.booker} · {it.child}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-[var(--ink-3)]">
                      <span>{it.listing} · {fmt(it.date)}</span>
                      {!it.reconciled && <span>· {daysOverdue(it)}d since booking</span>}
                      {refCount > 1 ? <span>· {refCount} references</span> : it.paymentRef ? <span>· Ref: <b className="text-[var(--ink-2)]">{it.paymentRef}</b></span> : null}
                    </div>
                  </button>
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white" style={{ background: tone }}>{it.voucherScheme ? `Voucher · ${it.voucherScheme}` : c}</span>
                  {it.overdue && <span className="rounded-full bg-[#fdebec] px-2 py-0.5 text-[11px] font-bold text-[#c02636]">overdue{it.voucherReceiveBy ? ` since ${fmt(it.voucherReceiveBy)}` : ""}</span>}
                  <div className="text-right">
                    <div className="text-[14px] font-extrabold tabular-nums">{it.reconciled ? money(it.amount) : `${money(due)} due`}</div>
                    {it.cardPaid > 0 && <div className="text-[10.5px] font-bold text-[#0b8446]">{money(it.cardPaid)} by card</div>}
                    {offReceived > 0 && <div className="text-[10.5px] font-bold text-[#0b8446]">{money(offReceived)} by {it.voucherScheme || it.method}</div>}
                  </div>
                  {it.reconciled ? (
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#e2f5ea] px-2.5 py-1 text-[11.5px] font-bold text-[#0b8446]">✓ Reconciled</span>
                      <button type="button" disabled={busy === it.ref} onClick={() => reconcile(it, true)} className="text-[11px] font-bold text-[var(--ink-3)] hover:text-[#c02636] disabled:opacity-50">Undo</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button type="button"
                        title={`${partPaid ? `Part-paid — nudge for the remaining ${money(due)}.` : `Nudge — remind the family ${money(due)} is still to pay.`} Emails + notifies them with the cost, dates & times.${it.nudges ? ` Reminded ${it.nudges}× · last ${fmt(it.lastNudgedAt)}.` : ""}`}
                        disabled={busy === it.ref} onClick={() => nudge(it)}
                        className="relative grid h-8 w-8 flex-none place-items-center rounded-full border text-[14px] transition-colors disabled:opacity-50"
                        style={partPaid ? { borderColor: "#e2225f", background: "#fdeef4" } : it.nudges > 0 ? { borderColor: "#f0b100", background: "#fdf6e3" } : { borderColor: "var(--line)", background: "var(--surface)" }}>
                        🔔
                        {partPaid && it.nudges === 0 && <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-[#e2225f] text-[9px] font-extrabold text-white">!</span>}
                        {it.nudges > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[9px] font-extrabold text-white" style={{ background: partPaid ? "#e2225f" : "#e88f1f" }}>{it.nudges}</span>}
                      </button>
                      <button type="button" onClick={() => setOpenRef(openRef === it.ref ? null : it.ref)} className="text-[11.5px] font-bold text-[#2f6bd8]" title="For when only part of the money has landed — e.g. a deposit, or one of two sibling vouchers">Log amount received</button>
                      <button type="button" disabled={busy === it.ref} onClick={() => reconcile(it)} className="rounded-full px-3.5 py-1.5 text-[12px] font-extrabold text-white shadow-sm transition-transform hover:-translate-y-px disabled:opacity-50" style={{ background: "linear-gradient(180deg,#22b06b,#0b8446)" }}>{busy === it.ref ? "Saving…" : "✓ Reconcile"}</button>
                    </div>
                  )}
                </div>

                {isOpen && (
                  <div className="border-t border-[var(--line)] bg-[var(--panel)] px-4 py-3.5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2 text-[12.5px]">
                        <Field label="Children">{it.child}</Field>
                        <Field label="Dates">{it.dates || fmt(it.date)}</Field>
                        <div>
                          <div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Sessions &amp; times</div>
                          <div className="mt-0.5 flex flex-col gap-0.5">{it.sessions.length ? it.sessions.map((s, i) => <span key={i}>{s}</span>) : <span className="text-[var(--ink-3)]">—</span>}</div>
                        </div>
                        {(it.email || it.phone) && <Field label="Contact">{[it.email, it.phone].filter(Boolean).join(" · ")}</Field>}
                        <Field label="Booked">{fmt(it.createdAt)} · {daysOverdue(it)}d ago</Field>
                      </div>
                      <div className="flex flex-col gap-3">
                        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-[12.5px]">
                          <div className="flex justify-between"><span className="text-[var(--ink-3)]">Total</span><b className="tabular-nums">{money(it.amount)}</b></div>
                          {it.cardPaid > 0 && <div className="flex justify-between"><span className="text-[var(--ink-3)]">Paid by card at checkout</span><b className="tabular-nums text-[#0b8446]">{money(it.cardPaid)}</b></div>}
                          {offReceived > 0 && <div className="flex justify-between"><span className="text-[var(--ink-3)]">Received by {it.voucherScheme || it.method}</span><b className="tabular-nums text-[#0b8446]">{money(offReceived)}</b></div>}
                          <div className="mt-1 flex justify-between border-t border-[var(--line)] pt-1"><span className="font-bold">{it.reconciled ? "✓ Settled" : `Still to pay by ${it.voucherScheme || it.method}`}</span><b className="tabular-nums" style={{ color: it.reconciled ? "#0b8446" : "#c02636" }}>{it.reconciled ? money(it.amount) : money(due)}</b></div>
                          {it.cardPaid > 0 && !it.reconciled && <div className="mt-1 text-[11px] text-[var(--ink-3)]">Split payment: {money(it.cardPaid)} already taken by card, {money(due)} still owed by {it.voucherScheme || it.method}.</div>}
                        </div>
                        <div>
                          <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Payment reference{refCount > 1 ? "s" : ""}</div>
                          {it.payRefs && it.payRefs.length ? (
                            <div className="flex flex-col gap-1">
                              {it.payRefs.map((r, i) => (
                                <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px]">
                                  <span className="min-w-0 truncate">{r.child ? <b>{r.child}</b> : null}{r.scheme ? ` · ${r.scheme}` : ""}</span>
                                  <span className="flex flex-none items-center gap-2"><span className="font-mono font-bold">{r.ref}</span>{r.amount != null && <span className="text-[var(--ink-3)]">{money(r.amount)}</span>}</span>
                                </div>
                              ))}
                              <p className="text-[10.5px] leading-snug text-[var(--ink-3)]">Two children on one booking can pay as two references — e.g. £50 per reference on a £100 booking — and each may land separately in your bank.</p>
                            </div>
                          ) : editRef === it.ref ? (
                            <div className="flex items-center gap-1">
                              <input value={refDraft} onChange={(e) => setRefDraft(e.target.value)} placeholder="parent’s reference" className="flex-1 rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px]" />
                              <button type="button" disabled={busy === it.ref} onClick={() => saveRef(it)} className="rounded px-2 py-1 text-[11.5px] font-bold text-white disabled:opacity-50" style={{ background: "#0f7a43" }}>Save</button>
                              <button type="button" onClick={() => setEditRef(null)} className="text-[var(--ink-3)]">✕</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => { setEditRef(it.ref); setRefDraft(it.paymentRef ?? ""); }} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] hover:bg-[var(--panel)]" title="Edit if the bank shows the reference differently — the family is notified of the change">Ref:&nbsp;<b>{it.paymentRef || "not set"}</b> <span className="text-[#2f6bd8]">✎</span></button>
                          )}
                        </div>
                        <div>
                          <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Internal notes <span className="font-normal normal-case">— only you see these, never the parent</span></div>
                          {it.reconNotes.length > 0 && (
                            <div className="mb-1.5 flex flex-col gap-1">
                              {[...it.reconNotes].reverse().map((n, i) => (
                                <div key={i} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px]">
                                  <div className="text-[10px] font-bold text-[var(--ink-3)]">{stamp(n.at)}{n.by ? ` · ${n.by}` : ""}</div>
                                  <div className="text-[var(--ink-2)]">{n.text}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          <textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={2} placeholder="Add a note — e.g. chased Edenred; parent says sent, waiting on the bank" className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] outline-none focus:border-[#3f78d8]" />
                          <button type="button" disabled={busy === it.ref || !notesDraft.trim()} onClick={() => saveNotes(it)} className="mt-1 rounded-full px-3 py-1 text-[11.5px] font-bold text-white disabled:opacity-40" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>Add note</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {openRef === it.ref && !it.reconciled && <RecordForm item={it} onDone={() => { setOpenRef(null); refresh(); }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{label}</div><div className="mt-0.5 text-[var(--ink-2)]">{children}</div></div>;
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
      <div className="mb-1.5 text-[12px] font-extrabold">Log an amount received for #{item.ref} <span className="font-normal text-[var(--ink-3)]">— use this when only part of the money has arrived (a deposit, or one of two sibling vouchers)</span></div>
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
