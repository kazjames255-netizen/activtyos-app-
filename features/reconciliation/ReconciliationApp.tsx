"use client";

import { uiDate, uiDateTime } from "@/lib/i18n/format";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { CollapsibleStats, LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { Tile, GRAD, money } from "@/features/money/finance-kit";
import { useI18n, useT, useWord } from "@/lib/i18n/provider";
import { isRTL } from "@/lib/i18n/config";
import { rich } from "@/features/money/rich";
import { seasonDisplayName } from "@/lib/seasons";
import { catCountsOf, filterItems, methodCat, parseFilterParams, refundPanelRows, withFilterParams, type RefundState, type StatusFilter } from "./refundFilters";

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
  // Refund position (server/src/lib/refundRows.ts refundSummaryOf): drives the chips and the Refunded / Hide refunded filters.
  refundedAmount?: number; refundState?: RefundState; refundAwaitingAmount?: number; refundedAt?: string | null; refundedOnly?: boolean;
}
interface RefundRow { ref: string; booker: string; listing: string; listingId: string | null; method: string; via: "card" | "wallet" | "offline" | null; kind: "cancellation" | "released"; label: string; amount: number; date: string | null }
interface Recon {
  items: Item[];
  refunds?: RefundRow[];
  summary: { count: number; reconciledCount: number; outstanding: number; overdue: number; awaitingVoucher: number; byMethod: Record<string, { count: number; outstanding: number }>; refunds?: { count: number; total: number; todayCount: number; today: number };
    overpaid?: { count: number; total: number }; needsRefund?: { count: number; total: number } };
}
interface ListingLite { id: string; title?: string; name?: string; seasonId?: string | null }

const fmt = (iso?: string | null) => (iso ? uiDate(new Date(`${iso.slice(0, 10)}T00:00:00Z`), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—");

const PREF_ORDER = ["Card", "Childcare vouchers", "Tax-Free Childcare", "Cash", "Bank transfer", "HAF / funded", "Other"];
type TFn = (key: string, vars?: Record<string, string | number>) => string;
// Display label for a canonical payment-route bucket (the bucket string itself stays English: it drives filtering).
function catDisp(t: TFn, c: string): string {
  switch (c) {
    case "All": return t("p8fin.recStatusAll");
    case "Card": return t("p8fin.recMCard");
    case "Childcare vouchers": return t("p8fin.recMVouchers");
    case "Cash": return t("p8fin.recMCash");
    case "Bank transfer": return t("p8fin.recMBank");
    case "HAF / funded": return t("p8fin.recMHaf");
    case "Other": return t("p8fin.catOther");
    default: return c; // "Tax-Free Childcare" and provider-typed routes stay as they are
  }
}
const CAT_C: Record<string, string> = { Card: "#1d3a8f", "Childcare vouchers": "#7c3aed", "Tax-Free Childcare": "#0ea5a0", Cash: "#0f7a43", "Bank transfer": "#3f78d8", "HAF / funded": "#e88f1f", Other: "#8a86a3" };

export function ReconciliationApp() {
  const t = useT();
  const w = useWord();
  const { settings, save } = useSettings();
  const [data, setData] = useState<Recon | null>(null);
  const [listings, setListings] = useState<ListingLite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [cat, setCat] = useState("All");
  const [status, setStatus] = useState<StatusFilter>("awaiting");
  const [hideRefunded, setHideRefunded] = useState(false);
  const [refundsOpen, setRefundsOpen] = useState(true);
  const [urlReady, setUrlReady] = useState(false);
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
  const [stripeSync, setStripeSync] = useState<{ busy: boolean; msg: string | null }>({ busy: false, msg: null });

  const refresh = useCallback(() => {
    apiGet<Recon>("/api/reconciliation").then((r) => { setData(r); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : t("p8fin.gLoadFailed")));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<ListingLite[]>("/api/listings?mine=1").then((l) => setListings(Array.isArray(l) ? l : [])).catch(() => {}); }, []);
  useRealtime(["bookings", "payments"], refresh);

  // The two refund controls live in the page URL (?status=refunded&hideRefunded=1) and the Refunds panel's open/closed state is remembered per browser.
  useEffect(() => {
    const q = parseFilterParams(window.location.search);
    if (q.status) setStatus(q.status);
    if (q.hideRefunded) setHideRefunded(true);
    try { if (window.localStorage.getItem("aos.recon.refundsOpen") === "0") setRefundsOpen(false); } catch { /* storage blocked: stays open */ }
    setUrlReady(true);
  }, []);
  useEffect(() => {
    if (!urlReady) return;
    const next = withFilterParams(window.location.search, status, hideRefunded);
    if (next !== window.location.search) window.history.replaceState(null, "", `${window.location.pathname}${next}${window.location.hash}`);
  }, [urlReady, status, hideRefunded]);
  const toggleRefundsOpen = () => setRefundsOpen((o) => { try { window.localStorage.setItem("aos.recon.refundsOpen", o ? "0" : "1"); } catch { /* ignore */ } return !o; });

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
  // Tab counts follow the Hide refunded toggle (and never count a refunded-only row the status chip would hide).
  const catCounts = useMemo(() => catCountsOf(items, status, hideRefunded), [items, status, hideRefunded]);
  const voucherCounts = useMemo(() => { const m = new Map<string, number>(); for (const it of items) if (it.voucherScheme && methodCat(it) === "Childcare vouchers") m.set(it.voucherScheme, (m.get(it.voucherScheme) ?? 0) + 1); return m; }, [items]);

  const filtered = useMemo(
    () => filterItems(items, { cat, status, hideRefunded, voucherSub, listingId, seasonId, from, to }, listingSeason),
    [items, cat, voucherSub, status, hideRefunded, listingId, seasonId, from, to, listingSeason],
  );
  // The Refunds panel follows the same hide rule and the same tab / listing / season / date filters as the list.
  const panelRows = useMemo(
    () => refundPanelRows(data?.refunds ?? [], items, { cat, status, hideRefunded, voucherSub, listingId, seasonId, from, to }, listingSeason),
    [data, items, cat, status, hideRefunded, voucherSub, listingId, seasonId, from, to, listingSeason],
  );

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
  const anyFilter = cat !== "All" || status !== "awaiting" || hideRefunded || listingId || seasonId || from || to;

  // Pulls refunds made outside the app (e.g. in the Stripe dashboard) into the books. Read-only on Stripe, safe to run repeatedly.
  async function checkStripeRefunds() {
    setStripeSync({ busy: true, msg: null });
    try {
      const r = await api<{ recorded: number }>("/api/payments/sync-refunds", { method: "POST", body: JSON.stringify({ ...(from ? { from } : {}), ...(to ? { to } : {}) }) });
      setStripeSync({ busy: false, msg: r.recorded > 0 ? `${t("p8fin.recStripeSyncFound")} ${r.recorded}` : t("p8fin.recStripeSyncNone") });
      refresh();
    } catch (e) { setStripeSync({ busy: false, msg: e instanceof Error ? e.message : t("p8fin.recErrUpdate") }); }
  }

  async function reconcile(it: Item, undo = false) {
    setBusy(it.ref);
    try { await api(`/api/bookings/${encodeURIComponent(it.ref)}/reconcile`, { method: "POST", body: JSON.stringify(undo ? { undo: true } : { method: it.voucherScheme ? `Voucher (${it.voucherScheme})` : it.method }) }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : t("p8fin.recErrUpdate")); }
    finally { setBusy(null); }
  }
  async function nudge(it: Item) {
    setBusy(it.ref);
    try { await api(`/api/bookings/${encodeURIComponent(it.ref)}/nudge`, { method: "POST", body: "{}" }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : t("p8fin.recErrNudge")); }
    finally { setBusy(null); }
  }
  async function saveRef(it: Item) {
    setBusy(it.ref);
    try { await api(`/api/bookings/${encodeURIComponent(it.ref)}/payment-ref`, { method: "PUT", body: JSON.stringify({ paymentRef: refDraft.trim() }) }); setEditRef(null); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : t("p8fin.recErrRef")); }
    finally { setBusy(null); }
  }
  async function saveScheme(it: Item, scheme: string) {
    setBusy(it.ref);
    try { await api(`/api/bookings/${encodeURIComponent(it.ref)}/voucher-scheme`, { method: "PUT", body: JSON.stringify({ voucherScheme: scheme }) }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : t("p8fin.recErrScheme")); }
    finally { setBusy(null); }
  }
  async function saveNotes(it: Item) {
    if (!notesDraft.trim()) return;
    setBusy(it.ref);
    try { await api(`/api/bookings/${encodeURIComponent(it.ref)}/recon-notes`, { method: "PUT", body: JSON.stringify({ note: notesDraft.trim() }) }); setNotesDraft(""); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : t("p8fin.recErrNote")); }
    finally { setBusy(null); }
  }
  const daysOverdue = (it: Item) => { const ts = Date.parse(it.createdAt ?? ""); return Number.isNaN(ts) ? 0 : Math.max(0, Math.floor((nowMs - ts) / 86400000)); };
  const stamp = (iso: string) => uiDateTime(new Date(iso), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <PageHero icon="⇄" title={t("p8fin.recTitle")} lede={t("p8fin.recLede")} />

      {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#c02636]">{error}</div>}

      <CollapsibleStats id="reconciliation">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label={t("p8fin.recTileAwaiting")} icon="⏳" grad={(data?.summary.count ?? 0) > 0 ? GRAD.pink : GRAD.green} value={data ? String(data.summary.count) : "…"} sub={t("p8fin.recTileAwaitingSub")} />
        <Tile label={t("p8fin.recTileOutstanding")} icon="💷" grad={GRAD.blue} value={data ? money(data.summary.outstanding) : "…"} sub={t("p8fin.recTileOutstandingSub")} />
        <Tile label={t("p8fin.recTileReconciled")} icon="✅" grad={GRAD.green} value={data ? String(data.summary.reconciledCount) : "…"} sub={t("p8fin.recTileReconciledSub")} />
        <Tile label={t("p8fin.recTileOverdue")} icon="⚠️" grad={(data?.summary.overdue ?? 0) > 0 ? GRAD.amber : GRAD.teal} value={data ? String(data.summary.overdue) : "…"} sub={t("p8fin.recTileOverdueSub")} />
      </div>
      </CollapsibleStats>

      {/* Method tabs */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button key={c} type="button" onClick={() => { setCat(c); setVoucherSub(""); }} className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-all duration-150 hover:-translate-y-px"
            style={cat === c ? { borderColor: "transparent", background: c === "All" ? "linear-gradient(180deg,#4f8bf5,#2f6bd8)" : (CAT_C[c] ?? "#1d3a8f"), color: "#fff", boxShadow: "0 3px 10px -2px rgba(47,107,216,.45)" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
            {catDisp(t, c)}{c !== "All" && <span className={cat === c ? "ms-1 opacity-80" : "ms-1 text-[var(--ink-3)]"}>{catCounts.get(c) ?? 0}</span>}
          </button>
        ))}
      </div>

      {/* Voucher provider sub-filter (Edenred, Computershare, …) */}
      {cat === "Childcare vouchers" && voucherSchemes.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("p8fin.recProvider")}</span>
          {["", ...voucherSchemes].map((v) => (
            <button key={v || "all"} type="button" onClick={() => setVoucherSub(v)} className="rounded-full border px-3 py-1 text-[12px] font-bold transition-colors"
              style={voucherSub === v ? { borderColor: "transparent", background: "#7c3aed", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
              {v || t("p8fin.recAllProviders")}{v && <span className={voucherSub === v ? "ms-1 opacity-80" : "ms-1 text-[var(--ink-3)]"}>{voucherCounts.get(v) ?? 0}</span>}
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
            <span className="text-[13.5px] font-extrabold text-white">🧾 {cat === "Tax-Free Childcare" ? "Tax-Free Childcare" : cat === "Childcare vouchers" ? t("p8fin.recMVouchers") : t("p8fin.recChildcarePayments")}</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white">{t("p8fin.recBookingsN", { n: childcare.items.length })}</span>
            {cat !== "Childcare vouchers" && (
              <button type="button" onClick={() => setCcSettings((v) => !v)} className="ms-auto rounded-full bg-white/20 px-2.5 py-1 text-[11.5px] font-bold text-white hover:bg-white/30">
                {ccSettings ? t("p8fin.recHideSettings") : t("p8fin.recSettingsBtn")}
              </button>
            )}
          </div>

          <div className="grid gap-2.5 p-3 sm:grid-cols-3">
            {[
              [t("p8fin.recStatGross"), money(childcare.gross), t("p8fin.recBookingsN", { n: childcare.items.length }), "#0e7490"],
              [t("p8fin.recStatConfirmed"), money(childcare.confirmed), t("p8fin.recBookersN", { n: childcare.confirmedBookers }), "#0f7a43"],
              [t("p8fin.recStatUnconfirmed"), money(childcare.unconfirmed), t("p8fin.recBookersN", { n: childcare.unconfirmedBookers }), "#b45309"],
              [t("p8fin.recTileReconciled"), money(childcare.reconciled), t("p8fin.recMatchedBank", { n: childcare.reconciledCount }), "#0f7a43"],
              [t("p8fin.recStatUnreconciled"), money(childcare.unreconciled), t("p8fin.recStillToMatch", { n: childcare.unreconciledCount }), "#c02636"],
              [t("p8fin.recStatMissingRef"), String(childcare.noRef), t("p8fin.recStatNoRefSub"), childcare.noRef ? "#c02636" : "#8a86a3"],
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
              <p className="mb-2.5 text-[12px] text-[var(--ink-2)]">{rich(t("p8fin.recTfcSettingsExplain"))}</p>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {([["settingName", t("p8fin.recSettingName"), "APF ACTIVITY CAMPS"], ["registrationNumber", t("p8fin.recRegNumber"), "1234567"], ["postcode", t("p8fin.recPostcode"), "MK1 1AA"]] as const).map(([k, label, ph]) => (
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
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("p8fin.recVoucherCompanies")}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(settings.voucherProviders ?? []).map((v) => (
                    <span key={v.id} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[12px] font-bold text-[var(--ink-2)]">{v.name}</span>
                  ))}
                  <span className="text-[11.5px] text-[var(--ink-3)]">{t("p8fin.recVoucherCompaniesNote")}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Refunds — every refund on the bookings list, dated, so today's can be
          totalled against it (d9s7). Honours the listing/season/date filters. */}
      {data && (data.refunds?.length ?? 0) > 0 && (hideRefunded ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-[12.5px] text-[var(--ink-3)]">
          <span>↩️ {t("p8fin.recRefundsHiddenBar")}</span>
          <button type="button" onClick={() => setHideRefunded(false)} className="font-bold text-[#2f6bd8]">{t("p8fin.recShowRefundsBtn")}</button>
        </div>
      ) : (
        <RefundsPanel rows={panelRows} from={from} to={to} open={refundsOpen} onToggle={toggleRefundsOpen} />
      ))}

      <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--ink-3)]">
        <button type="button" disabled={stripeSync.busy} onClick={checkStripeRefunds} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12px] font-bold text-[var(--ink)] disabled:opacity-50">{stripeSync.busy ? t("p8fin.gSaving") : t("p8fin.recStripeSyncBtn")}</button>
        {stripeSync.msg && <span role="status">{stripeSync.msg}</span>}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="inline-flex items-center gap-0.5 rounded-full border border-[var(--line)] p-0.5 text-[11.5px] font-bold">
          {([["all", t("p8fin.recStatusAll")], ["awaiting", t("p8fin.recTileAwaiting")], ["reconciled", t("p8fin.recTileReconciled")], ["refunded", t("p8fin.recStatusRefunded")]] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setStatus(v)} className="rounded-full px-2.5 py-1 transition-colors" style={status === v ? { background: "#1d3a8f", color: "#fff" } : { color: "var(--ink-3)" }}>{l}</button>
          ))}
        </div>
        <button type="button" aria-pressed={hideRefunded} onClick={() => setHideRefunded((v) => !v)} className="rounded-full border px-3 py-1 text-[11.5px] font-bold transition-colors"
          style={hideRefunded ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>
          {hideRefunded ? "✓ " : ""}{t("p8fin.recHideRefunded")}
        </button>
        <select value={listingId} onChange={(e) => setListingId(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px]">
          <option value="">{t("p8fin.recAllListings")}</option>
          {listings.map((l) => <option key={l.id} value={l.id}>{l.title || l.name || t("p8fin.recListingFallback")}</option>)}
        </select>
        {seasons.length > 0 && (
          <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px]">
            <option value="">{t("p8fin.recAllSeasons")}</option>
            {seasons.map((s) => <option key={s.id} value={s.id}>{seasonDisplayName(t, s.name)}</option>)}
          </select>
        )}
        <label className="flex items-center gap-1 text-[11.5px] text-[var(--ink-3)]">{t("p8fin.recFrom")} <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[12.5px]" /></label>
        <label className="flex items-center gap-1 text-[11.5px] text-[var(--ink-3)]">{t("p8fin.recTo")} <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[12.5px]" /></label>
        {anyFilter && <button type="button" onClick={() => { setCat("All"); setVoucherSub(""); setStatus("awaiting"); setHideRefunded(false); setListingId(""); setSeasonId(""); setFrom(""); setTo(""); }} className="text-[11.5px] font-bold text-[#2f6bd8]">{t("p8fin.recClearFilters")}</button>}
        <span className="ms-auto text-[12px] text-[var(--ink-3)]">{shownOutstanding > 0 ? t("p8fin.recShownOut", { n: filtered.length, amount: money(shownOutstanding) }) : t("p8fin.recShown", { n: filtered.length })}</span>
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
              <div className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("p8fin.recTfcAutoTitle")}</div>
              <p className="mt-1 max-w-[620px] text-[12.5px] leading-relaxed text-[var(--ink-2)]">{rich(t("p8fin.recTfcAutoBody"))}</p>
              <div className="mt-3 rounded-lg border border-[#f3d98a] bg-[#fdf6e3] px-3 py-2 text-[12px] text-[#7a5a12]">
                {rich(t("p8fin.recTfcAmirNote"))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!data ? (
        <div className="py-12 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8fin.gLoading")}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] py-14 text-center text-[13px] text-[var(--ink-3)]">{status === "awaiting" ? t("p8fin.recNothingToDo") : t("p8fin.recNoMatch")}</div>
      ) : (
        <div className="flex flex-col gap-2">
          {((data.summary.overpaid?.count ?? 0) + (data.summary.needsRefund?.count ?? 0)) > 0 && (
            <div className="rounded-xl border border-[#f3d98a] bg-[#fdf6e3] px-3.5 py-2.5 text-[12.5px] text-[#7a5a12]">
              <b>{t("p8fin.recMoneyBack")}</b>{" "}
              {[
                data.summary.overpaid?.count ? t("p8fin.recOverpaidN", { n: data.summary.overpaid.count, amount: money(data.summary.overpaid.total) }) : null,
                data.summary.needsRefund?.count ? t("p8fin.recCancelledN", { n: data.summary.needsRefund.count, amount: money(data.summary.needsRefund.total) }) : null,
              ].filter(Boolean).join(" · ")}. {t("p8fin.recRefundHint")}
            </div>
          )}
          <p className="px-1 text-[11px] leading-snug text-[var(--ink-3)]">{t("p8fin.recSplitNote")}</p>
          {filtered.map((it) => {
            if (it.refundedOnly) return <RefundedRow key={it.ref} it={it} />;
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
                  <button type="button" onClick={() => { const open = !isOpen; setExpanded(open ? it.ref : null); if (open) { setNotesDraft(""); setEditRef(null); } }} className="min-w-[160px] flex-1 text-start">
                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                      <span className="text-[var(--ink-3)]">{isOpen ? "▾" : "▸"}</span>
                      <span className="font-extrabold" title={t("p8fin.recOurRefTip")}>#{it.ref}</span>
                      <span className="text-[var(--ink-2)]">{it.booker} · {it.child}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-[var(--ink-3)]">
                      <span>{it.listing} · {fmt(it.date)}</span>
                      {!it.reconciled && <span>· {t("p8fin.recDaysSince", { n: daysOverdue(it) })}</span>}
                      {/* "Ref" on its own read as the booking reference, which is the
                          #ID to its left. This is the PARENT'S payment reference —
                          what they quote to HMRC/the voucher company so the
                          transfer that lands can be matched back here. */}
                      {refCount > 1 ? <span title={t("p8fin.recPayRefsTip")}>{t("p8fin.recPayRefsN", { n: refCount })}</span>
                        : it.paymentRef ? <span title={t("p8fin.recPayRefTip")}>{t("p8fin.recPayRefLbl")}<b className="text-[var(--ink-2)]">{it.paymentRef}</b></span> : null}
                    </div>
                  </button>
                  {c === "Childcare vouchers" && !it.voucherScheme ? (
                    // A voucher with no provider named can't be told apart from
                    // any other when you're matching the bank — so ask, right
                    // where you'd notice, instead of showing a generic label.
                    <select value="" disabled={busy === it.ref} onChange={(e) => { if (e.target.value) void saveScheme(it, e.target.value); }}
                      title={t("p8fin.recWhichProviderTip")}
                      className="cursor-pointer rounded-full border border-dashed px-2.5 py-0.5 text-[11px] font-bold outline-none"
                      style={{ borderColor: tone, color: tone, background: "var(--surface)" }}>
                      <option value="">{t("p8fin.recWhichProvider")}</option>
                      {[...new Set([...(settings.voucherProviders ?? []).map((v) => v.name), ...voucherSchemes])].filter((v) => !/tax.?free/i.test(v)).map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  ) : (
                    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white" style={{ background: tone }}>{it.voucherScheme ? t("p8fin.recVoucherScheme", { scheme: it.voucherScheme }) : catDisp(t, c)}</span>
                  )}
                  <RefundChip it={it} />
                  {it.overdue && <span className="rounded-full bg-[#fdebec] px-2 py-0.5 text-[11px] font-bold text-[#c02636]">{it.voucherReceiveBy ? t("p8fin.recOverdueSince", { date: fmt(it.voucherReceiveBy) }) : t("p8fin.recOverdueBadge")}</span>}
                  {(it.overpaid ?? 0) > 0 && <span title={t("p8fin.recOverpaidTip")} className="rounded-full bg-[#fdf6e3] px-2 py-0.5 text-[11px] font-bold text-[#7a5a12] ring-1 ring-[#f3d98a]">{t("p8fin.recOverpaidBadge", { amount: money(it.overpaid!) })}</span>}
                  {(it.needsRefund ?? 0) > 0 && <span title={t("p8fin.recNeedsRefundTip")} className="rounded-full bg-[#fdebec] px-2 py-0.5 text-[11px] font-bold text-[#c02636]">{t("p8fin.recNeedsRefundBadge", { status: w(it.status ?? "Cancelled"), amount: money(it.needsRefund!) })}</span>}
                  <div className="text-end">
                    <div className="text-[14px] font-extrabold tabular-nums">{it.reconciled ? money(it.amount) : giveBack ? t("p8fin.recToGiveBack", { amount: money((it.overpaid ?? 0) + (it.needsRefund ?? 0)) }) : t("p8fin.recDue", { amount: money(due) })}</div>
                    {it.cardPaid > 0 && <div className="text-[10.5px] font-bold text-[#0b8446]">{t("p8fin.recByCard", { amount: money(it.cardPaid) })}</div>}
                    {offReceived > 0 && <div className="text-[10.5px] font-bold text-[#0b8446]">{t("p8fin.recByMethod", { amount: money(offReceived), method: w(it.voucherScheme || it.method) })}</div>}
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
                        const label = !r ? t("p8fin.recReconciledNone") : r.auto ? t("p8fin.recReconciledAuto") : t("p8fin.recReconciledHand");
                        const title = !r ? t("p8fin.recTipBefore")
                          : r.auto ? t("p8fin.recTipAuto", { when: stamp(r.at) }) : t("p8fin.recTipHand", { by: r.by, when: stamp(r.at) });
                        return (
                          <span title={title} className="rounded-full px-2.5 py-1 text-[11.5px] font-bold"
                            style={r?.auto ? { background: "#e6f0fd", color: "#1d3a8f" } : { background: "#e2f5ea", color: "#0b8446" }}>
                            {label}{r && !r.auto ? <span className="font-semibold opacity-70"> · {r.by.split(" ")[0]}</span> : null}
                          </span>
                        );
                      })()}
                      <button type="button" disabled={busy === it.ref} onClick={() => reconcile(it, true)} className="text-[11px] font-bold text-[var(--ink-3)] hover:text-[#c02636] disabled:opacity-50">{t("p8fin.recUndo")}</button>
                    </div>
                  ) : giveBack ? (
                    <span className="max-w-[220px] text-end text-[11.5px] text-[var(--ink-3)]">{t("p8fin.recGiveBackNote")}</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button type="button"
                        title={`${partPaid ? t("p8fin.recNudgePart", { amount: money(due) }) : t("p8fin.recNudgeFull", { amount: money(due) })}${t("p8fin.recNudgeTail")}${it.nudges ? t("p8fin.recNudgedN", { n: it.nudges, date: fmt(it.lastNudgedAt) }) : ""}`}
                        disabled={busy === it.ref} onClick={() => nudge(it)}
                        className="relative grid h-8 w-8 flex-none place-items-center rounded-full border text-[14px] transition-colors disabled:opacity-50"
                        style={partPaid ? { borderColor: "#e2225f", background: "#fdeef4" } : it.nudges > 0 ? { borderColor: "#f0b100", background: "#fdf6e3" } : { borderColor: "var(--line)", background: "var(--surface)" }}>
                        🔔
                        {partPaid && it.nudges === 0 && <span className="absolute -end-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-[#e2225f] text-[9px] font-extrabold text-white">!</span>}
                        {it.nudges > 0 && <span className="absolute -end-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[9px] font-extrabold text-white" style={{ background: partPaid ? "#e2225f" : "#e88f1f" }}>{it.nudges}</span>}
                      </button>
                      <button type="button" onClick={() => setOpenRef(openRef === it.ref ? null : it.ref)} className="text-[11.5px] font-bold text-[#2f6bd8]" title={t("p8fin.recLogAmountTip")}>{t("p8fin.recLogAmount")}</button>
                      <button type="button" disabled={busy === it.ref} onClick={() => reconcile(it)} className="rounded-full px-3.5 py-1.5 text-[12px] font-extrabold text-white shadow-sm transition-transform hover:-translate-y-px disabled:opacity-50" style={{ background: "linear-gradient(180deg,#22b06b,#0b8446)" }}>{busy === it.ref ? t("p8fin.gSaving") : t("p8fin.recReconcileBtn")}</button>
                    </div>
                  )}
                </div>

                {isOpen && (
                  <div className="border-t border-[var(--line)] bg-[var(--panel)] px-4 py-3.5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2 text-[12.5px]">
                        <Field label={t("p8fin.recFChildren")}>{it.child}</Field>
                        <Field label={t("p8fin.recFDates")}>{it.dates || fmt(it.date)}</Field>
                        <div>
                          <div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("p8fin.recFSessions")}</div>
                          <div className="mt-0.5 flex flex-col gap-0.5">{it.sessions.length ? it.sessions.map((s, i) => <span key={i}>{s}</span>) : <span className="text-[var(--ink-3)]">—</span>}</div>
                        </div>
                        {(it.email || it.phone) && <Field label={t("p8fin.recFContact")}>{[it.email, it.phone].filter(Boolean).join(" · ")}</Field>}
                        <Field label={t("p8fin.recFBooked")}>{t("p8fin.recBookedAgo", { date: fmt(it.createdAt), n: daysOverdue(it) })}</Field>
                      </div>
                      <div className="flex flex-col gap-3">
                        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-[12.5px]">
                          <div className="flex justify-between"><span className="text-[var(--ink-3)]">{t("p8fin.gTotal")}</span><b className="tabular-nums">{money(it.amount)}</b></div>
                          {it.cardPaid > 0 && <div className="flex justify-between"><span className="text-[var(--ink-3)]">{t("p8fin.recPaidCard")}</span><b className="tabular-nums text-[#0b8446]">{money(it.cardPaid)}</b></div>}
                          {offReceived > 0 && <div className="flex justify-between"><span className="text-[var(--ink-3)]">{t("p8fin.recReceivedBy", { method: w(it.voucherScheme || it.method) })}</span><b className="tabular-nums text-[#0b8446]">{money(offReceived)}</b></div>}
                          <div className="mt-1 flex justify-between border-t border-[var(--line)] pt-1"><span className="font-bold">{it.reconciled ? t("p8fin.recSettled") : t("p8fin.recStillToPay", { method: w(it.voucherScheme || it.method) })}</span><b className="tabular-nums" style={{ color: it.reconciled ? "#0b8446" : "#c02636" }}>{it.reconciled ? money(it.amount) : money(due)}</b></div>
                          {it.cardPaid > 0 && !it.reconciled && <div className="mt-1 text-[11px] text-[var(--ink-3)]">{t("p8fin.recSplitDetail", { card: money(it.cardPaid), due: money(due), method: w(it.voucherScheme || it.method) })}</div>}
                        </div>
                        <div>
                          <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{refCount > 1 ? t("p8fin.recPayRefsHead") : t("p8fin.recPayRefHead")}</div>
                          {it.payRefs && it.payRefs.length ? (
                            <div className="flex flex-col gap-1">
                              {it.payRefs.map((r, i) => (
                                <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px]">
                                  <span className="min-w-0 truncate">{r.child ? <b>{r.child}</b> : null}{r.scheme ? ` · ${r.scheme}` : ""}</span>
                                  <span className="flex flex-none items-center gap-2"><span className="font-mono font-bold">{r.ref}</span>{r.amount != null && <span className="text-[var(--ink-3)]">{money(r.amount)}</span>}</span>
                                </div>
                              ))}
                              <p className="text-[10.5px] leading-snug text-[var(--ink-3)]">{t("p8fin.recTwoChildrenNote")}</p>
                            </div>
                          ) : editRef === it.ref ? (
                            <div className="flex items-center gap-1">
                              <input value={refDraft} onChange={(e) => setRefDraft(e.target.value)} placeholder={t("p8fin.recParentRefPh")} className="flex-1 rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px]" />
                              <button type="button" disabled={busy === it.ref} onClick={() => saveRef(it)} className="rounded px-2 py-1 text-[11.5px] font-bold text-white disabled:opacity-50" style={{ background: "#0f7a43" }}>{t("p8fin.gSave")}</button>
                              <button type="button" onClick={() => setEditRef(null)} className="text-[var(--ink-3)]">✕</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => { setEditRef(it.ref); setRefDraft(it.paymentRef ?? ""); }} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] hover:bg-[var(--panel)]" title={t("p8fin.recRefEditTip")}>{t("p8fin.recRefLbl")}&nbsp;<b>{it.paymentRef || t("p8fin.recNotSet")}</b> <span className="text-[#2f6bd8]">✎</span></button>
                          )}
                        </div>
                        <div>
                          <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("p8fin.recNotesHead")} <span className="font-normal normal-case">{t("p8fin.recNotesSub")}</span></div>
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
                          <textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={2} placeholder={t("p8fin.recNotePh")} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] outline-none focus:border-[#3f78d8]" />
                          <button type="button" disabled={busy === it.ref || !notesDraft.trim()} onClick={() => saveNotes(it)} className="mt-1 rounded-full px-3 py-1 text-[11.5px] font-bold text-white disabled:opacity-40" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>{t("p8fin.recAddNote")}</button>
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

const VIA_KEY: Record<string, string> = { card: "p8fin.recViaCard", wallet: "p8fin.recViaWallet", offline: "p8fin.recViaOffline" };

// Refunds by day. Today by default; "All" lists every one. When the page's
// From/To dates are set, those win — the same range as the ledger below.
function RefundsPanel({ rows, from, to, open, onToggle }: { rows: RefundRow[]; from: string; to: string; open: boolean; onToggle: () => void }) {
  const t = useT();
  const arrow = isRTL(useI18n().locale) ? "←" : "→";
  const w = useWord();
  const [all, setAll] = useState(false);
  // The UK day, like the server's "today".
  const [today] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())); // raw-locale-ok: machine date key, not shown to anyone
  const ranged = !!(from || to);
  const shown = rows.filter((r) => ranged
    ? !!r.date && (!from || r.date >= from) && (!to || r.date <= to)
    : all || r.date === today);
  const total = shown.reduce((s, r) => s + r.amount, 0);
  const todayRows = rows.filter((r) => r.date === today);
  return (
    <div data-ui="refunds" className="mb-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-4 py-2.5">
        <span className="text-[13.5px] font-extrabold">{t("p8fin.recRefunds")}</span>
        <span className="rounded-full bg-[#fdf1e2] px-2 py-0.5 text-[11px] font-bold text-[#b45309]">{t("p8fin.recTodaySum", { amount: money(todayRows.reduce((s, r) => s + r.amount, 0)), n: todayRows.length })}</span>
        <button type="button" onClick={onToggle} aria-expanded={open} className="ms-auto text-[11.5px] font-bold text-[#2f6bd8]">{open ? t("p8fin.recRefundsListHide") : t("p8fin.recRefundsListShow")}</button>
        {!ranged && open && (
          <div className="inline-flex items-center gap-0.5 rounded-full border border-[var(--line)] p-0.5 text-[11.5px] font-bold">
            {([[false, t("p8fin.recToday")], [true, t("p8fin.recStatusAll")]] as const).map(([v, l]) => (
              <button key={l} type="button" onClick={() => setAll(v)} className="rounded-full px-2.5 py-1 transition-colors" style={all === v ? { background: "#1d3a8f", color: "#fff" } : { color: "var(--ink-3)" }}>{l}</button>
            ))}
          </div>
        )}
        {ranged && open && <span className="text-[11.5px] text-[var(--ink-3)]">{fmt(from || null)} – {fmt(to || null)}</span>}
      </div>
      {!open ? null : shown.length ? (
        <div className="flex flex-col divide-y divide-[var(--line)]">
          {shown.slice(0, 50).map((r, i) => (
            <div key={`${r.ref}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 text-[12.5px]">
              <span className="w-[92px] text-[11.5px] text-[var(--ink-3)]">{r.date ? fmt(r.date) : t("p8fin.recUndated")}</span>
              <span className="min-w-0 flex-1 truncate"><b>#{r.ref}</b> <span className="text-[var(--ink-2)]">{r.booker}</span><span className="text-[var(--ink-3)]"> · {w(r.label)}{r.listing ? ` · ${r.listing}` : ""}</span></span>
              <span className="text-[11px] text-[var(--ink-3)]">{w(r.method)}{r.via ? ` ${arrow} ${t(VIA_KEY[r.via])}` : ""}</span>
              <span className="w-20 text-end font-extrabold tabular-nums text-[#b45309]">−{money(r.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between bg-[var(--panel)] px-4 py-2 text-[12.5px]">
            <span className="font-bold">{t("p8fin.recRefundsN", { n: shown.length })}{shown.length > 50 ? t("p8fin.recShowing50") : ""}</span>
            <b className="tabular-nums">−{money(total)}</b>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 text-[12px] text-[var(--ink-3)]">{ranged ? t("p8fin.recNoRefundsRange") : all ? t("p8fin.recNoRefundsAll") : t("p8fin.recNoRefundsToday")}</div>
      )}
    </div>
  );
}

/** The refund chip on a ledger row: Refunded / Part refunded £x / Refund awaiting transfer (a bank refund that is only recorded so far). */
function RefundChip({ it }: { it: Item }) {
  const t = useT();
  const st = it.refundState ?? "none";
  if (st === "none") return null;
  if (st === "awaiting") return <span title={t("p8fin.recRefundOfflineTip")} className="rounded-full bg-[#fdf6e3] px-2 py-0.5 text-[11px] font-bold text-[#7a5a12] ring-1 ring-[#f3d98a]">{t("p8fin.recChipRefundAwaiting")}</span>;
  if (st === "part") return <span className="rounded-full bg-[#fdf1e2] px-2 py-0.5 text-[11px] font-bold text-[#b45309]">{t("p8fin.recChipPartRefunded", { amount: money(it.refundedAmount ?? 0) })}</span>;
  return <span className="rounded-full bg-[#fdf1e2] px-2 py-0.5 text-[11px] font-bold text-[#b45309]">{t("p8fin.recChipRefunded")}</span>;
}

/** A booking that is on the list only because money went back (cancelled / card): muted, nothing to reconcile. */
function RefundedRow({ it }: { it: Item }) {
  const t = useT();
  const w = useWord();
  const c = methodCat(it);
  return (
    <div data-ui="refunded-row" className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] opacity-80">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
        <span className="w-1.5 self-stretch rounded-full bg-[#d9b99b]" />
        <div className="min-w-[160px] flex-1 text-start">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-extrabold">#{it.ref}</span>
            <span className="text-[var(--ink-2)]">{it.booker} · {it.child}</span>
          </div>
          <div className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">{it.listing} · {fmt(it.date)} · {w(it.voucherScheme || it.method || c)}</div>
        </div>
        <RefundChip it={it} />
        <div className="text-end">
          <div className="text-[13px] font-extrabold tabular-nums text-[var(--ink-3)] line-through">{money(it.amountPaid || it.amount)}</div>
          <div className="text-[10.5px] font-bold text-[#b45309]">{t("p8fin.recReceivedRefunded", { paid: money(it.amountPaid), refunded: money(it.refundedAmount ?? 0) })}</div>
        </div>
        <span className="max-w-[220px] text-end text-[11.5px] text-[var(--ink-3)]">{t("p8fin.recRefundedOnlyNote")}</span>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{label}</div><div className="mt-0.5 text-[var(--ink-2)]">{children}</div></div>;
}

// Partial / manual amount entry — for when only some of the money has arrived.
function RecordForm({ item, onDone }: { item: Item; onDone: () => void }) {
  const t = useT();
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
    if (!amt || amt <= 0) { setError(t("p8fin.recEnterAmount")); return; }
    setBusy(true); setError(null);
    try { await api(`/api/bookings/${encodeURIComponent(item.ref)}/record-payment`, { method: "POST", body: JSON.stringify({ amount: amt, method, reference, ...(confirmDuplicate ? { confirmDuplicate: true } : {}) }) }); onDone(); }
    catch (e) {
      setError(e instanceof Error ? e.message : t("p8fin.recCouldntRecord")); setBusy(false);
      setDupAsk(e instanceof ApiError && e.status === 409 && !confirmDuplicate);
    }
  }
  return (
    <div className="border-t border-[var(--line)] bg-[var(--panel)] p-3.5">
      <div className="mb-1.5 text-[12px] font-extrabold">{t("p8fin.recLogFor", { ref: item.ref })} <span className="font-normal text-[var(--ink-3)]">{t("p8fin.recLogForHint")}</span></div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("p8fin.recAmountGbp")}<input type="number" value={amount} onChange={(e) => { setAmount(e.target.value); setDupAsk(false); }} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px]" /></label>
        <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("p8fin.recMethod")}<input value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px]" /></label>
        <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("p8fin.recReference")}<input value={reference} onChange={(e) => { setReference(e.target.value); setDupAsk(false); }} placeholder={t("p8fin.recRefPh")} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px]" /></label>
      </div>
      {error && <div className="mt-1.5 text-[12px] font-bold text-[#c02636]">{error}</div>}
      <div className="mt-2 flex gap-2">
        {dupAsk
          ? <button type="button" disabled={busy} onClick={() => void save(true)} className="rounded-full bg-[#b45309] px-3.5 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-50">{busy ? t("p8fin.recRecording") : t("p8fin.recSecondPay")}</button>
          : <button type="button" disabled={busy} onClick={() => void save()} className="rounded-full px-3.5 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-50" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>{busy ? t("p8fin.recRecording") : t("p8fin.recRecordPart")}</button>}
        <button type="button" onClick={onDone} className="rounded-full border border-[var(--line)] px-3.5 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">{t("p8fin.gCancel")}</button>
      </div>
    </div>
  );
}

