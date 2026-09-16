"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { CollapsibleStats, LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
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
  reconciled: boolean; reconciledBy: { at: string; by: string; auto?: boolean } | null; voucherScheme: string | null; voucherReceiveBy: string | null;
  paymentRef: string | null; payRefs: PayRef[] | null; reconNotes: Note[]; nudges: number; lastNudgedAt: string | null;
  dates: string; sessions: string[]; date: string; createdAt: string | null; overdue: boolean;
  // Money to hand back or credit (server/src/routes/reconciliation.ts, d8s7/d8s8):
  // more logged than the booking costs, or logged after it was cancelled.
  status?: string; overpaid?: number; needsRefund?: number;
}
interface RefundRow { ref: string; booker: string; listing: string; listingId: string | null; method: string; via: "card" | "wallet" | "offline" | null; kind: "cancellation" | "released"; label: string; amount: number; date: string | null }
interface Recon {
  items: Item[];
  refunds?: RefundRow[];
  summary: { count: number; reconciledCount: number; outstanding: number; overdue: number; awaitingVoucher: number; byMethod: Record<string, { count: number; outstanding: number }>; refunds?: { count: number; total: number; todayCount: number; today: number };
    overpaid?: { count: number; total: number }; needsRefund?: { count: number; total: number } };
}
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
  const { settings, save } = useSettings();
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
    // Tax-Free Childcare always gets a tab, even at zero. Tabs were built purely
    // from what's in the data, so a provider with no TFC bookings yet had no TFC
    // tab at all — and read the vouchers tab as though it covered both. An empty
    // tab is a much smaller problem than an invisible one.
    present.add("Tax-Free Childcare");
    return ["All", ...PREF_ORDER.filter((c) => present.has(c)), ...[...present].filter((c) => !PREF_ORDER.includes(c))];
  }, [items]);

  // Voucher schemes present, for the sub-filter chips under the Vouchers tab.
  const voucherSchemes = useMemo(() => [...new Set(items.filter((it) => methodCat(it) === "Childcare vouchers" && it.voucherScheme).map((it) => it.voucherScheme as string))].sort(), [items]);

  // The category tabs and voucher-provider chips each used to re-filter the WHOLE
  // ledger once per button on every render (a growing off-platform ledger, not a
  // handful of rows) just to show its count — one pass per dimension instead.
  const catCounts = useMemo(() => { const m = new Map<string, number>(); for (const it of items) { const c = methodCat(it); m.set(c, (m.get(c) ?? 0) + 1); } return m; }, [items]);
  const voucherCounts = useMemo(() => { const m = new Map<string, number>(); for (const it of items) if (it.voucherScheme && methodCat(it) === "Childcare vouchers") m.set(it.voucherScheme, (m.get(it.voucherScheme) ?? 0) + 1); return m; }, [items]);

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

  // ── Childcare roll-up ─────────────────────────────────────────────────────
  // Two independent axes, deliberately not merged:
  //   confirmed / unconfirmed  — has the FAMILY paid (their promise, our ledger)
  //   reconciled / unreconciled — have WE matched it in the bank
  // A payment can be confirmed but unreconciled for weeks; that gap is what an
  // operator is chasing, and collapsing them into one number hides it.
  const childcare = useMemo(() => {
    // Scoped to the category on screen: on the TFC page these are TFC figures,
    // on the vouchers tab they're voucher figures. Showing a combined total
    // above a filtered list is how you end up reading voucher money as TFC.
    const inScope = (c: string) => (cat === "Tax-Free Childcare" || cat === "Childcare vouchers")
      ? c === cat
      : c === "Tax-Free Childcare" || c === "Childcare vouchers";
    const cc = items.filter((it) => inScope(methodCat(it)));
    const bookers = (list: Item[]) => new Set(list.map((i) => (i.email || i.booker || i.ref).trim().toLowerCase())).size;
    const paid = cc.filter((i) => i.amountPaid > 0);
    const unpaid = cc.filter((i) => i.outstanding > 0);
    const done = cc.filter((i) => i.reconciled);
    const todo = cc.filter((i) => !i.reconciled);
    return {
      items: cc,
      gross: cc.reduce((s, i) => s + i.amount, 0),
      confirmed: paid.reduce((s, i) => s + i.amountPaid, 0), confirmedBookers: bookers(paid),
      unconfirmed: unpaid.reduce((s, i) => s + i.outstanding, 0), unconfirmedBookers: bookers(unpaid),
      reconciled: done.reduce((s, i) => s + i.amountPaid, 0), reconciledCount: done.length,
      unreconciled: todo.reduce((s, i) => s + i.outstanding, 0), unreconciledCount: todo.length,
      // Parents type these by hand and get them wrong — one live example read
      // "Caelan" instead of a reference. Anything without one can never be
      // matched automatically, so it's worth counting on its own.
      noRef: cc.filter((i) => !(i.paymentRef ?? "").trim() && !(i.payRefs ?? []).some((r) => (r.ref ?? "").trim())).length,
    };
  }, [items, cat]);

  const cc = settings.childcare ?? {};
  const [ccSettings, setCcSettings] = useState(false);
  const [schemeDraft, setSchemeDraft] = useState("");
  const saveChildcare = (patch: Partial<NonNullable<typeof settings.childcare>>) =>
    void save({ settings: { ...settings, childcare: { ...cc, ...patch } } });

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
  async function saveScheme(it: Item, scheme: string) {
    setBusy(it.ref);
    try { await api(`/api/bookings/${encodeURIComponent(it.ref)}/voucher-scheme`, { method: "PUT", body: JSON.stringify({ voucherScheme: scheme }) }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save the scheme"); }
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

      <CollapsibleStats id="reconciliation">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Awaiting" icon="⏳" grad={(data?.summary.count ?? 0) > 0 ? GRAD.pink : GRAD.green} value={data ? String(data.summary.count) : "…"} sub="payments to match" />
        <Tile label="Outstanding" icon="💷" grad={GRAD.blue} value={data ? money(data.summary.outstanding) : "…"} sub="still to come in" />
        <Tile label="Reconciled" icon="✅" grad={GRAD.green} value={data ? String(data.summary.reconciledCount) : "…"} sub="fully matched" />
        <Tile label="Overdue" icon="⚠️" grad={(data?.summary.overdue ?? 0) > 0 ? GRAD.amber : GRAD.teal} value={data ? String(data.summary.overdue) : "…"} sub="vouchers past due" />
      </div>
      </CollapsibleStats>

      {/* Method tabs */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button key={c} type="button" onClick={() => { setCat(c); setVoucherSub(""); }} className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-all duration-150 hover:-translate-y-px"
            style={cat === c ? { borderColor: "transparent", background: c === "All" ? "linear-gradient(180deg,#4f8bf5,#2f6bd8)" : (CAT_C[c] ?? "#1d3a8f"), color: "#fff", boxShadow: "0 3px 10px -2px rgba(47,107,216,.45)" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
            {c}{c !== "All" && <span className={cat === c ? "ml-1 opacity-80" : "ml-1 text-[var(--ink-3)]"}>{catCounts.get(c) ?? 0}</span>}
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
              {v || "All providers"}{v && <span className={voucherSub === v ? "ml-1 opacity-80" : "ml-1 text-[var(--ink-3)]"}>{voucherCounts.get(v) ?? 0}</span>}
            </button>
          ))}
        </div>
      )}

      {/* ── Childcare payments ──────────────────────────────────────────────
          Tax-Free Childcare and vouchers answer two DIFFERENT questions, and
          the gap between them is the whole problem: "confirmed" is what the
          family says they've paid, "reconciled" is what we've matched in the
          bank. Shown only when there is childcare money in the ledger.
          See docs/tfc-build-spec.md. */}
      {childcare.items.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-2xl border border-[#cfe7e4] bg-[var(--surface)]">
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5" style={{ background: "linear-gradient(120deg,#0e7490,#0ea5a0)" }}>
            <span className="text-[13.5px] font-extrabold text-white">🧾 {cat === "Tax-Free Childcare" ? "Tax-Free Childcare" : cat === "Childcare vouchers" ? "Childcare vouchers" : "Childcare payments"}</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white">{childcare.items.length} booking{childcare.items.length === 1 ? "" : "s"}</span>
            {cat !== "Childcare vouchers" && (
              <button type="button" onClick={() => setCcSettings((v) => !v)} className="ml-auto rounded-full bg-white/20 px-2.5 py-1 text-[11.5px] font-bold text-white hover:bg-white/30">
                {ccSettings ? "Hide settings" : "⚙ Settings"}
              </button>
            )}
          </div>

          <div className="grid gap-2.5 p-3 sm:grid-cols-3">
            {[
              ["Gross childcare bookings", money(childcare.gross), `${childcare.items.length} bookings`, "#0e7490"],
              ["Confirmed by booker", money(childcare.confirmed), `${childcare.confirmedBookers} booker${childcare.confirmedBookers === 1 ? "" : "s"}`, "#0f7a43"],
              ["Unconfirmed by booker", money(childcare.unconfirmed), `${childcare.unconfirmedBookers} booker${childcare.unconfirmedBookers === 1 ? "" : "s"}`, "#b45309"],
              ["Reconciled", money(childcare.reconciled), `${childcare.reconciledCount} matched to bank`, "#0f7a43"],
              ["Unreconciled", money(childcare.unreconciled), `${childcare.unreconciledCount} still to match`, "#c02636"],
              ["Missing a reference", String(childcare.noRef), "can't be matched by ref", childcare.noRef ? "#c02636" : "#8a86a3"],
            ].map(([label, value, sub, colour]) => (
              <div key={label} className="rounded-xl border border-[var(--line)] px-3 py-2.5">
                <div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{label}</div>
                <div className="mt-0.5 text-[19px] font-extrabold tabular-nums" style={{ color: colour }}>{value}</div>
                <div className="text-[11px] text-[var(--ink-3)]">{sub}</div>
              </div>
            ))}
          </div>

          {ccSettings && (
            <div className="border-t border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="mb-2.5 text-[12px] text-[var(--ink-2)]">
                A parent has to add you to their HMRC Tax-Free Childcare account before they can pay.
                These are the details they search for — <b>they must match exactly</b>, or their payment fails with
                &ldquo;provider not added to your HMRC account&rdquo;.
              </p>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {([["settingName", "Setting name", "APF ACTIVITY CAMPS"], ["registrationNumber", "Ofsted / registration number", "1234567"], ["postcode", "Postcode", "MK1 1AA"]] as const).map(([k, label, ph]) => (
                  <label key={k} className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{label}</span>
                    <input value={cc[k] ?? ""} placeholder={ph}
                      onChange={(e) => saveChildcare({ [k]: e.target.value })}
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#0e7490]" />
                  </label>
                ))}
              </div>
              {/* The voucher COMPANIES are settings.voucherProviders — the same
                  list the parent picks from at checkout. Shown here read-only so
                  the two can't drift; edited in Setup. */}
              <div className="mt-3">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Voucher companies you accept</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(settings.voucherProviders ?? []).map((v) => (
                    <span key={v.id} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[12px] font-bold text-[var(--ink-2)]">{v.name}</span>
                  ))}
                  <span className="text-[11.5px] text-[var(--ink-3)]">— parents choose one of these at checkout · edit in Setup</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Refunds — every refund on the bookings list, dated, so today's can be
          totalled against it (d9s7). Honours the listing/season/date filters. */}
      {data && (data.refunds?.length ?? 0) > 0 && (
        <RefundsPanel rows={(data.refunds ?? []).filter((r) =>
          (!listingId || r.listingId === listingId)
          && (!seasonId || (r.listingId ? listingSeason[r.listingId] : "") === seasonId))}
          from={from} to={to} />
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

      {/* TFC explainer — a BANNER, not a replacement for the list. This used to
          be rendered instead of the bookings, so a TFC payment could never be
          seen at all: you got the "nothing to do by hand" note whether you had
          one TFC booking or a hundred. Auto-matching still means you want to
          look at them. */}
      {cat === "Tax-Free Childcare" && (
        <div className="mb-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
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
      )}

      {!data ? (
        <div className="py-12 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] py-14 text-center text-[13px] text-[var(--ink-3)]">{status === "awaiting" ? "Nothing to reconcile here — all matched. 🎉" : "No bookings match these filters."}</div>
      ) : (
        <div className="flex flex-col gap-2">
          {((data.summary.overpaid?.count ?? 0) + (data.summary.needsRefund?.count ?? 0)) > 0 && (
            <div className="rounded-xl border border-[#f3d98a] bg-[#fdf6e3] px-3.5 py-2.5 text-[12.5px] text-[#7a5a12]">
              <b>Money to hand back or credit:</b>{" "}
              {[
                data.summary.overpaid?.count ? `${data.summary.overpaid.count} overpaid booking${data.summary.overpaid.count === 1 ? "" : "s"} (${money(data.summary.overpaid.total)} over)` : null,
                data.summary.needsRefund?.count ? `${data.summary.needsRefund.count} cancelled booking${data.summary.needsRefund.count === 1 ? "" : "s"} with money received (${money(data.summary.needsRefund.total)})` : null,
              ].filter(Boolean).join(" · ")}. Refund it, or add it to the family&rsquo;s wallet as credit, from the booking.
            </div>
          )}
          <p className="px-1 text-[11px] leading-snug text-[var(--ink-3)]">Split payments show how much was taken by card; the rest is what you reconcile here. A booking for two children may pay as two references (e.g. £50 per reference on a £100 booking) — open a row to see each one.</p>
          {filtered.map((it) => {
            const c = methodCat(it);
            const tone = CAT_C[c] ?? "#8a86a3";
            const refCount = it.payRefs?.length ?? (it.paymentRef ? 1 : 0);
            const due = it.outstanding;
            const offReceived = Math.max(0, it.amountPaid - it.cardPaid);
            const partPaid = !it.reconciled && it.amountPaid > 0 && due > 0; // some money in, balance still owed
            // Nothing to collect on these — money to give back instead.
            const giveBack = (it.overpaid ?? 0) > 0 || (it.needsRefund ?? 0) > 0;
            const isOpen = expanded === it.ref;
            return (
              <div key={it.ref} className="overflow-hidden rounded-2xl border bg-[var(--surface)] shadow-[0_1px_3px_rgba(20,30,60,.06)]" style={{ borderColor: it.overdue ? "#f6c9cc" : "var(--line)" }}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
                  <span className="w-1.5 self-stretch rounded-full" style={{ background: tone }} />
                  <button type="button" onClick={() => { const open = !isOpen; setExpanded(open ? it.ref : null); if (open) { setNotesDraft(""); setEditRef(null); } }} className="min-w-[160px] flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                      <span className="text-[var(--ink-3)]">{isOpen ? "▾" : "▸"}</span>
                      <span className="font-extrabold" title="Our booking reference">#{it.ref}</span>
                      <span className="text-[var(--ink-2)]">{it.booker} · {it.child}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-[var(--ink-3)]">
                      <span>{it.listing} · {fmt(it.date)}</span>
                      {!it.reconciled && <span>· {daysOverdue(it)}d since booking</span>}
                      {/* "Ref" on its own read as the booking reference, which is the
                          #ID to its left. This is the PARENT'S payment reference —
                          what they quote to HMRC/the voucher company so the
                          transfer that lands can be matched back here. */}
                      {refCount > 1 ? <span title="This booking is paid under more than one reference — open it to see each">· {refCount} payment references</span>
                        : it.paymentRef ? <span title="The reference the parent pays under, so the money can be matched to this booking">· Payment ref: <b className="text-[var(--ink-2)]">{it.paymentRef}</b></span> : null}
                    </div>
                  </button>
                  {c === "Childcare vouchers" && !it.voucherScheme ? (
                    // A voucher with no provider named can't be told apart from
                    // any other when you're matching the bank — so ask, right
                    // where you'd notice, instead of showing a generic label.
                    <select value="" disabled={busy === it.ref} onChange={(e) => { if (e.target.value) void saveScheme(it, e.target.value); }}
                      title="Which voucher provider paid?"
                      className="cursor-pointer rounded-full border border-dashed px-2.5 py-0.5 text-[11px] font-bold outline-none"
                      style={{ borderColor: tone, color: tone, background: "var(--surface)" }}>
                      <option value="">Which provider?</option>
                      {[...new Set([...(settings.voucherProviders ?? []).map((v) => v.name), ...voucherSchemes])].filter((v) => !/tax.?free/i.test(v)).map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  ) : (
                    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white" style={{ background: tone }}>{it.voucherScheme ? `Voucher · ${it.voucherScheme}` : c}</span>
                  )}
                  {it.overdue && <span className="rounded-full bg-[#fdebec] px-2 py-0.5 text-[11px] font-bold text-[#c02636]">overdue{it.voucherReceiveBy ? ` since ${fmt(it.voucherReceiveBy)}` : ""}</span>}
                  {(it.overpaid ?? 0) > 0 && <span title="More has been logged than this booking costs — refund the difference or keep it as wallet credit" className="rounded-full bg-[#fdf6e3] px-2 py-0.5 text-[11px] font-bold text-[#7a5a12] ring-1 ring-[#f3d98a]">Overpaid {money(it.overpaid!)} — refund or credit</span>}
                  {(it.needsRefund ?? 0) > 0 && <span title="Money was logged after this booking was cancelled — it isn't paying for a place" className="rounded-full bg-[#fdebec] px-2 py-0.5 text-[11px] font-bold text-[#c02636]">{it.status ?? "Cancelled"} — {money(it.needsRefund!)} needs refund / credit</span>}
                  <div className="text-right">
                    <div className="text-[14px] font-extrabold tabular-nums">{it.reconciled ? money(it.amount) : giveBack ? `${money((it.overpaid ?? 0) + (it.needsRefund ?? 0))} to give back` : `${money(due)} due`}</div>
                    {it.cardPaid > 0 && <div className="text-[10.5px] font-bold text-[#0b8446]">{money(it.cardPaid)} by card</div>}
                    {offReceived > 0 && <div className="text-[10.5px] font-bold text-[#0b8446]">{money(offReceived)} by {it.voucherScheme || it.method}</div>}
                  </div>
                  {it.reconciled ? (
                    <div className="flex items-center gap-2">
                      {(() => {
                        // Say HOW it was settled. Machine-matched and
                        // hand-ticked are different facts, and "Reconciled"
                        // alone let a manual tick pass for an automatic match.
                        // No stamp = settled before we recorded this, so the
                        // badge claims nothing rather than guessing.
                        const r = it.reconciledBy;
                        const label = !r ? "✓ Reconciled" : r.auto ? "✓ Auto-reconciled" : "✓ Reconciled by hand";
                        const title = !r ? "Settled before we recorded who reconciled it"
                          : `${r.auto ? "Matched automatically" : `Ticked off by ${r.by}`} · ${stamp(r.at)}`;
                        return (
                          <span title={title} className="rounded-full px-2.5 py-1 text-[11.5px] font-bold"
                            style={r?.auto ? { background: "#e6f0fd", color: "#1d3a8f" } : { background: "#e2f5ea", color: "#0b8446" }}>
                            {label}{r && !r.auto ? <span className="font-semibold opacity-70"> · {r.by.split(" ")[0]}</span> : null}
                          </span>
                        );
                      })()}
                      <button type="button" disabled={busy === it.ref} onClick={() => reconcile(it, true)} className="text-[11px] font-bold text-[var(--ink-3)] hover:text-[#c02636] disabled:opacity-50">Undo</button>
                    </div>
                  ) : giveBack ? (
                    <span className="max-w-[220px] text-right text-[11.5px] text-[var(--ink-3)]">Refund it or credit the family&rsquo;s wallet from the booking — it isn&rsquo;t owed to you.</span>
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

const VIA_LABEL: Record<string, string> = { card: "Back to card", wallet: "Wallet credit", offline: "Paid back by hand" };

// Refunds by day. Today by default; "All" lists every one. When the page's
// From/To dates are set, those win — the same range as the ledger below.
function RefundsPanel({ rows, from, to }: { rows: RefundRow[]; from: string; to: string }) {
  const [all, setAll] = useState(false);
  // The UK day, like the server's "today".
  const [today] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
  const ranged = !!(from || to);
  const shown = rows.filter((r) => ranged
    ? !!r.date && (!from || r.date >= from) && (!to || r.date <= to)
    : all || r.date === today);
  const total = shown.reduce((s, r) => s + r.amount, 0);
  const todayRows = rows.filter((r) => r.date === today);
  return (
    <div data-ui="refunds" className="mb-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-4 py-2.5">
        <span className="text-[13.5px] font-extrabold">↩️ Refunds</span>
        <span className="rounded-full bg-[#fdf1e2] px-2 py-0.5 text-[11px] font-bold text-[#b45309]">Today {money(todayRows.reduce((s, r) => s + r.amount, 0))} · {todayRows.length}</span>
        {!ranged && (
          <div className="ml-auto inline-flex items-center gap-0.5 rounded-full border border-[var(--line)] p-0.5 text-[11.5px] font-bold">
            {([[false, "Today"], [true, "All"]] as const).map(([v, l]) => (
              <button key={l} type="button" onClick={() => setAll(v)} className="rounded-full px-2.5 py-1 transition-colors" style={all === v ? { background: "#1d3a8f", color: "#fff" } : { color: "var(--ink-3)" }}>{l}</button>
            ))}
          </div>
        )}
        {ranged && <span className="ml-auto text-[11.5px] text-[var(--ink-3)]">{fmt(from || null)} – {fmt(to || null)}</span>}
      </div>
      {shown.length ? (
        <div className="flex flex-col divide-y divide-[var(--line)]">
          {shown.slice(0, 50).map((r, i) => (
            <div key={`${r.ref}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 text-[12.5px]">
              <span className="w-[92px] text-[11.5px] text-[var(--ink-3)]">{r.date ? fmt(r.date) : "undated"}</span>
              <span className="min-w-0 flex-1 truncate"><b>#{r.ref}</b> <span className="text-[var(--ink-2)]">{r.booker}</span><span className="text-[var(--ink-3)]"> · {r.label}{r.listing ? ` · ${r.listing}` : ""}</span></span>
              <span className="text-[11px] text-[var(--ink-3)]">{r.method}{r.via ? ` → ${VIA_LABEL[r.via]}` : ""}</span>
              <span className="w-20 text-right font-extrabold tabular-nums text-[#b45309]">−{money(r.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between bg-[var(--panel)] px-4 py-2 text-[12.5px]">
            <span className="font-bold">{shown.length} refund{shown.length === 1 ? "" : "s"}{shown.length > 50 ? " (showing 50)" : ""}</span>
            <b className="tabular-nums">−{money(total)}</b>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 text-[12px] text-[var(--ink-3)]">{ranged ? "No refunds in these dates." : all ? "No refunds yet." : "No refunds today."}</div>
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
  // The server spotted what looks like the same payment already logged (same
  // amount + reference on this booking, within a day) — ask before counting it
  // twice (d8s5).
  const [dupAsk, setDupAsk] = useState(false);
  async function save(confirmDuplicate = false) {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Enter an amount."); return; }
    setBusy(true); setError(null);
    try { await api(`/api/bookings/${encodeURIComponent(item.ref)}/record-payment`, { method: "POST", body: JSON.stringify({ amount: amt, method, reference, ...(confirmDuplicate ? { confirmDuplicate: true } : {}) }) }); onDone(); }
    catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t record"); setBusy(false);
      setDupAsk(e instanceof ApiError && e.status === 409 && !confirmDuplicate);
    }
  }
  return (
    <div className="border-t border-[var(--line)] bg-[var(--panel)] p-3.5">
      <div className="mb-1.5 text-[12px] font-extrabold">Log an amount received for #{item.ref} <span className="font-normal text-[var(--ink-3)]">— use this when only part of the money has arrived (a deposit, or one of two sibling vouchers)</span></div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Amount £<input type="number" value={amount} onChange={(e) => { setAmount(e.target.value); setDupAsk(false); }} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px]" /></label>
        <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Method<input value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px]" /></label>
        <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Reference<input value={reference} onChange={(e) => { setReference(e.target.value); setDupAsk(false); }} placeholder="e.g. bank ref" className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px]" /></label>
      </div>
      {error && <div className="mt-1.5 text-[12px] font-bold text-[#c02636]">{error}</div>}
      <div className="mt-2 flex gap-2">
        {dupAsk
          ? <button type="button" disabled={busy} onClick={() => void save(true)} className="rounded-full bg-[#b45309] px-3.5 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-50">{busy ? "Recording…" : "It's a second payment — record it"}</button>
          : <button type="button" disabled={busy} onClick={() => void save()} className="rounded-full px-3.5 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-50" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>{busy ? "Recording…" : "Record part payment"}</button>}
        <button type="button" onClick={onDone} className="rounded-full border border-[var(--line)] px-3.5 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">Cancel</button>
      </div>
    </div>
  );
}

