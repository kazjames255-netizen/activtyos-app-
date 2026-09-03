"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { Button } from "@/components/ui";
import { useAuth } from "@/components/auth/AuthProvider";
import { useT } from "@/lib/i18n/provider";

// The platform's own Stripe account (plan fees) — NOT a provider's connected
// account (those live in PayPage/PayModal for parents paying providers).
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null;

// The gate renders as a full-screen replacement for the portal shell, so it
// carries its own light palette (matching the operator portals) rather than
// inheriting the near-black operator surface underneath.
const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;

// Per-tier branding so each plan reads as its own thing (matches the pricing page).
const TIER: Record<string, { icon: string; c: string; grad: string }> = {
  freelancer: { icon: "⭐", c: "#e0930a", grad: "linear-gradient(120deg,#b45309 0%,#f0b100 100%)" },
  company: { icon: "🏛️", c: "#1d3a8f", grad: "linear-gradient(120deg,#16306e 0%,#3f78d8 100%)" },
  franchise: { icon: "🌐", c: "#7c3aed", grad: "linear-gradient(120deg,#5b21b6 0%,#a855f7 100%)" },
};

interface Band { id: string; label: string; price: number; staffMax?: number | null }
interface Plan { id: string; name: string; price: number; cadence: string; blurb: string; features: string[]; bands?: Band[]; perLocationPct?: number }
interface Current {
  plan: string; status: string; band?: string | null; cadence?: string;
  since: string | null; trialEndsAt?: string | null; currentPeriodEnd?: string | null; cancelAt?: string | null;
  price?: number; staffLimit?: number | null; locationLimit?: number | null; staffUsed?: number | null;
  cardLast4?: string | null; cardBrand?: string | null;
  details: Plan;
}
interface FranchiseBilling { count: number; base: number; perTotal: number; total: number; lines: { count: number; price: number }[]; tiers: { upTo: number | null; price: number }[]; nextRate: number; ownLocations: number }
interface Payload { current: Current; plans: Plan[]; billingConfigured: boolean; trialDays?: number; franchiseCount?: number | null; franchise?: FranchiseBilling | null }

const HERO = "radial-gradient(120% 160% at 12% -30%, rgba(120,170,255,.5) 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#274ba3 58%,#3f78d8 100%)";
const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;
const fmtDay = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const daysLeft = (iso?: string | null) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)) : 0);

/** Stripe's PaymentElement + confirm + POST /start, inside <Elements>. The
 *  card is captured as a SetupIntent (no charge); /start creates the real
 *  subscription — trial for a first-timer, charged now for a win-back. */
function SetupForm({ plan, band, cadence, cta, cardOnly, onDone, onError }: {
  plan: string; band?: string; cadence: string; cta: string;
  /** Just swap the card on file (POST /card) — don't start a subscription. */
  cardOnly?: boolean;
  onDone: () => void; onError: (msg: string) => void;
}) {
  const t = useT();
  const stripeJs = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!stripeJs || !elements || busy) return;
        setBusy(true);
        const { error, setupIntent } = await stripeJs.confirmSetup({ elements, redirect: "if_required" });
        if (error || !setupIntent) {
          onError(error?.message ?? t("money.subCardNotConfirmed"));
          setBusy(false);
          return;
        }
        try {
          if (cardOnly) await apiPost("/api/subscription/card", { setupIntentId: setupIntent.id });
          else await apiPost("/api/subscription/start", { plan, band, cadence, setupIntentId: setupIntent.id });
          onDone();
        } catch (err) {
          onError(err instanceof Error ? err.message : t("money.subCouldntStartSub"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <PaymentElement />
      <Button variant="primary" className="mt-3 h-11 w-full justify-center text-[14px]" disabled={busy}>
        {busy ? t("money.subConfirming") : cta}
      </Button>
    </form>
  );
}

/** Fetches the SetupIntent and mounts Stripe Elements around SetupForm. */
function CardCapture(props: { plan: string; band?: string; cadence: string; cta: string; cardOnly?: boolean; onDone: () => void; onError: (msg: string) => void }) {
  const t = useT();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const { onError } = props;
  const requested = useRef(false);
  useEffect(() => {
    // StrictMode double-mounts effects in dev — one SetupIntent is plenty.
    if (requested.current) return;
    requested.current = true;
    apiPost<{ clientSecret: string }>("/api/subscription/checkout", {})
      .then((r) => setClientSecret(r.clientSecret))
      .catch((e) => onError(e instanceof Error ? e.message : t("money.subCouldntStartCapture")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!stripePromise) return <div className="rounded-lg bg-[var(--panel)] px-3 py-2 text-[11px] text-[var(--ink-3)]">{t("money.subCardNotConfigured")}</div>;
  if (!clientSecret) return <div className="py-4 text-center text-[12px] text-[var(--ink-3)]">{t("money.subLoadingCardForm")}</div>;
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <SetupForm {...props} />
    </Elements>
  );
}

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  trialing: { label: "Free trial", bg: "#eaf0fc", fg: "#1d3a8f" },
  active: { label: "Active", bg: "#e7f6ee", fg: "#0f7a43" },
  canceling: { label: "Cancelling", bg: "#fdf0e3", fg: "#a5670a" },
  canceled: { label: "Cancelled", bg: "#fdebec", fg: "#c02636" },
  past_due: { label: "Payment due", bg: "#fdebec", fg: "#c02636" },
  none: { label: "No plan", bg: "#eef0f5", fg: "#6b6880" },
};

/**
 * Subscription / plans screen. Two modes:
 *  - in-portal (default): Money → Subscription — current plan, trial/renewal,
 *    staff-used-vs-limit, cancel / reactivate / switch plan.
 *  - gated (`gate`): the full-screen wall a fresh signup hits — the chosen plan
 *    + card capture + Start 7-day free trial. Mirrors activityos.uk/pricing.
 */
export function SubscriptionApp({ gate = false, onStarted }: { gate?: boolean; onStarted?: () => void } = {}) {
  const t = useT();
  const router = useRouter();
  const { signOutUser } = useAuth();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [annual, setAnnual] = useState(false);
  const [band, setBand] = useState<Record<string, string>>({});
  const [card, setCard] = useState({ name: "", number: "", exp: "", cvc: "" });
  // In-portal card-capture modal: set to the plan being started when the
  // tenant has no card on file yet (fresh start or a lapsed win-back).
  const [payFor, setPayFor] = useState<Plan | null>(null);
  // "Update card" modal — swaps the card on file without touching the plan.
  const [updatingCard, setUpdatingCard] = useState(false);

  const refresh = useCallback(() => {
    apiGet<Payload>("/api/subscription").then((p) => { setData(p); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : t("money.subFailedToLoad")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const bandFor = useCallback((p: Plan) => (p.bands ? (band[p.id] ?? p.bands[0].id) : undefined), [band]);
  const monthlyPrice = useCallback((p: Plan) => (!p.bands ? p.price : (p.bands.find((b) => b.id === bandFor(p))?.price ?? p.price)), [bandFor]);

  async function start(p: Plan) {
    // With Stripe live, a tenant with no card on file goes through the
    // card-capture flow (gate panel or the in-portal modal); a tenant whose
    // card is already attached just switches plan (Stripe prorates).
    if (data?.billingConfigured && !data.current.cardLast4) {
      setPayFor(p);
      return;
    }
    setSaving(p.id);
    try {
      await api("/api/subscription", { method: "PUT", body: JSON.stringify({ plan: p.id, cadence: annual ? "year" : "month", ...(p.bands ? { band: bandFor(p) } : {}) }) });
      if (gate) onStarted?.(); else refresh();
    } catch (e) { setError(e instanceof Error ? e.message : t("money.subCouldntStartPlan")); }
    finally { setSaving(null); }
  }
  async function act(path: string, key: string) {
    setActing(key);
    try { await api(`/api/subscription/${path}`, { method: "POST", body: "{}" }); refresh(); }
    catch (e) {
      // Reactivating with no usable saved card → capture one, then /start
      // takes over (no second trial server-side).
      if (path === "reactivate" && e instanceof Error && /card/i.test(e.message) && data) {
        setPayFor(data.current.details);
        return;
      }
      setError(e instanceof Error ? e.message : t("money.subActionFailed"));
    }
    finally { setActing(null); }
  }

  const shown = useMemo(() => (!data ? [] : gate ? data.plans.filter((p) => p.id === data.current.plan) : data.plans), [data, gate]);

  if (error) return <div className="p-4 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!data) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">{t("money.subLoadingPlans")}</div>;

  const toggle = (
    <div className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 text-[12px] font-bold">
      {([["month", t("money.subMonthly")], ["year", t("money.subAnnualSave")]] as const).map(([v, label]) => {
        const on = (v === "year") === annual;
        return <button key={v} type="button" onClick={() => setAnnual(v === "year")} className="rounded-full px-3 py-1 transition-colors" style={on ? { background: "#1d3a8f", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>;
      })}
    </div>
  );

  const planCard = (p: Plan, opts?: { cta?: boolean }) => {
    // Match the current plan by the resolved plan the header shows (details.id),
    // falling back to the raw id — so an out-of-sync `plan` field can't make the
    // active plan offer "Switch to …" instead of "Current plan".
    const currentId = data.current.details?.id ?? data.current.plan;
    const current = !gate && p.id === currentId && data.current.status !== "none";
    const recommended = p.id === currentId;
    const m = monthlyPrice(p);
    const annualTotal = m * 10;
    const tier = TIER[p.id] ?? TIER.company;
    return (
      <div key={p.id} className="relative flex flex-col overflow-hidden rounded-2xl border-2 bg-[var(--surface)] p-4" style={{ borderColor: recommended ? tier.c : "var(--line)", boxShadow: recommended ? "0 14px 34px -18px rgba(29,58,143,.35)" : undefined }}>
        <div className="-mx-4 -mt-4 mb-3 h-1.5" style={{ background: tier.grad }} />
        {recommended && <div className="absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white" style={{ background: tier.c }}>{gate ? t("money.subYourPlan") : t("money.subCurrentPlan")}</div>}
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl text-[15px]" style={{ background: `${tier.c}1f` }}>{tier.icon}</span>
          <span className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{p.name}</span>
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-[24px] font-extrabold">{annual ? gbp(annualTotal) : gbp(m)}</span>
          <span className="text-[12px] text-[var(--ink-3)]">{annual ? t("money.subPerYr") : t("money.subPerMo")}{p.bands ? ` ${t("money.subFrom")}` : ""}</span>
        </div>
        <div className="text-[11px] text-[var(--ink-3)]">{annual ? t("money.subAnnualPerMonthNote", { p: gbp(Math.round(annualTotal / 12)) }) : t("money.subPlusVatCancel")}</div>
        {p.id === "franchise" && data.franchise && !annual && (
          <div className="mt-1.5 rounded-lg bg-[#f5f2fe] px-2.5 py-1.5 text-[11px] font-bold text-[#6d28d9]">
            {t("money.subFranchiseEstimate", { price: gbp(data.franchise.total), count: data.franchise.count, label: data.franchise.count === 1 ? t("money.subFranchiseOne") : t("money.subFranchiseMany") })}
          </div>
        )}
        <p className="mt-2 text-[12px] leading-snug text-[var(--ink-3)]">{p.blurb}</p>
        {p.bands && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {p.bands.map((b) => {
              const on = bandFor(p) === b.id;
              return <button key={b.id} type="button" onClick={() => setBand((s) => ({ ...s, [p.id]: b.id }))} className="rounded-full border px-2.5 py-1 text-[10.5px] font-bold transition-colors" style={on ? { borderColor: tier.c, background: tier.c, color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{b.label}</button>;
            })}
          </div>
        )}
        <ul className="mt-3 flex flex-1 flex-col gap-1.5">
          {p.features.map((f, i) => <li key={i} className={`flex gap-1.5 text-[12px] ${f.endsWith(":") ? "font-bold text-[var(--ink-2)]" : "text-[var(--ink-2)]"}`}>{!f.endsWith(":") && <span style={{ color: tier.c }}>✓</span>}{f}</li>)}
        </ul>
        {opts?.cta !== false && (
          <div className="mt-3.5">
            {current ? <Button className="w-full" disabled>{t("money.subCurrentPlanBtn")}</Button>
              : <button type="button" onClick={() => start(p)} disabled={saving === p.id}
                  className="w-full rounded-full px-4 py-2.5 text-[13px] font-extrabold transition-transform hover:-translate-y-px disabled:opacity-60"
                  style={{ background: tier.c, color: p.id === "freelancer" ? "#3a2a00" : "#fff" }}>
                  {saving === p.id ? t("money.subStarting") : data.current.status === "none" || gate ? t("money.subStartFreeTrial") : t("money.subSwitchTo", { name: p.name })}
                </button>}
          </div>
        )}
      </div>
    );
  };

  const cardField = "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]";
  const chosen = shown[0];
  const paymentPanel = chosen && (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("money.subPaymentDetails")}</div>
        <span className="rounded-full bg-[#eaf0fc] px-2.5 py-0.5 text-[10.5px] font-bold text-[#1d3a8f]">{t("money.subSecuredByStripe")}</span>
      </div>
      <p className="mt-1 text-[12px] text-[var(--ink-3)]">{t("money.subFreeForDays", { n: data.trialDays ?? 7 })}</p>
      {data.billingConfigured ? (
        <div className="mt-3">
          <CardCapture
            plan={chosen.id}
            band={bandFor(chosen)}
            cadence={annual ? "year" : "month"}
            cta={t("money.subStartNDayTrial", { n: data.trialDays ?? 7 })}
            onDone={() => { if (gate) onStarted?.(); else refresh(); }}
            onError={setError}
          />
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-col gap-2.5">
            <input className={cardField} placeholder={t("money.subNameOnCard")} value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} />
            <input className={cardField} placeholder={t("money.subCardNumber")} inputMode="numeric" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} />
            <div className="flex gap-2.5">
              <input className={cardField} placeholder={t("money.subExpiry")} value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} />
              <input className={cardField} placeholder={t("money.subCvc")} inputMode="numeric" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} />
            </div>
          </div>
          <div className="mt-2 rounded-lg bg-[var(--panel)] px-3 py-2 text-[11px] text-[var(--ink-3)]">{t("money.subCardBillingConnecting")}</div>
          <Button variant="primary" className="mt-3 h-11 w-full justify-center text-[14px]" onClick={() => start(chosen)} disabled={!!saving}>
            {saving ? t("money.subStarting") : t("money.subStartNDayTrial", { n: data.trialDays ?? 7 })}
          </Button>
        </>
      )}
      <p className="mt-2 text-center text-[11px] text-[var(--ink-3)]">{t("money.subThenPriceAfterTrial", { price: gbp(monthlyPrice(chosen)), plus: chosen.bands ? " +" : "" })}</p>
    </div>
  );

  // ── Gated full-screen wall ───────────────────────────────────────────────
  if (gate) {
    return (
      <div className="min-h-screen w-full overflow-auto text-[var(--ink)]" style={{ ...LIGHT_PALETTE, background: "var(--bg)" }}>
        <div className="mx-auto max-w-[1000px] px-4 py-8">
          <div className="overflow-hidden rounded-2xl text-white" style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), ${HERO}`, backgroundSize: "18px 18px, cover, cover, cover, cover", backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat" }}>
            <div className="px-6 py-6 sm:px-8">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[19px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}><span style={{ color: "#fff" }}>Activity</span><span style={{ color: "#EE1F63" }}>OS</span></div>
                <button type="button" onClick={async () => { await signOutUser(); router.replace("/login"); }} className="rounded-full border border-white/30 bg-white/10 px-3.5 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-white/20">{t("money.subLogOut")}</button>
              </div>
              <div className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#ffd23f" }}>{t("money.subAlmostThere")}</div>
              <h1 className="mt-1 text-[26px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)", color: "#fff" }}>{t("money.subPickPlanTitle")}</h1>
              <p className="mt-1.5 max-w-[560px] text-[13px] leading-snug text-white/85">{t("money.subGateLede")}</p>
            </div>
          </div>
          <div className="mt-5 flex justify-center">{toggle}</div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>{chosen && planCard(chosen, { cta: false })}</div>
            <div>{paymentPanel}</div>
          </div>
        </div>
      </div>
    );
  }

  // ── In-portal Money → Subscription view ──────────────────────────────────
  const c = data.current;
  const sm = STATUS_META[c.status] ?? STATUS_META.none;
  const statusLabel: Record<string, string> = {
    trialing: t("money.subStatusTrialing"), active: t("money.subStatusActive"), canceling: t("money.subStatusCancelling"),
    canceled: t("money.subStatusCancelled"), past_due: t("money.subStatusPaymentDue"), none: t("money.subStatusNoPlan"),
  };
  const staffUsed = c.staffUsed ?? null;
  const overStaff = c.staffLimit != null && staffUsed != null && staffUsed >= c.staffLimit;
  // A head office is billed by network size: base console + a per-franchise fee
  // for every franchisee under it. `fb` is present for any company tenant.
  const fb = data.franchise ?? null;
  const onFranchise = c.plan === "franchise";
  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* Hero — matches the other Money pages (Expenses / Purchasing). */}
      <div className="op-hero relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), var(--hero-grad)`, backgroundSize: "18px 18px, cover, cover, cover, cover", backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">💳</span>
          {t("money.subTitle")}
        </div>
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">{t("money.subHeroLede")}</p>
      </div>

      {c.status !== "none" && (
        <div className="mb-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[16px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{c.details?.name}{c.band ? ` · ${c.band}` : ""}</span>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: sm.bg, color: sm.fg }}>{statusLabel[c.status] ?? statusLabel.none}</span>
            <span className="ml-auto text-[13px] font-bold">{onFranchise && fb ? `${gbp(fb.total)}/${c.cadence === "year" ? "yr" : "mo"}` : c.price != null ? `${gbp(c.price)}/${c.cadence === "year" ? "yr" : "mo"}` : ""}</span>
          </div>
          {c.cardLast4 && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--ink-3)]">
              <span>💳 {c.cardBrand ? c.cardBrand[0].toUpperCase() + c.cardBrand.slice(1) : t("money.subCard")} ···· {c.cardLast4}</span>
              <button type="button" className="font-bold text-[var(--brand-2,#2f6bd8)] hover:underline" onClick={() => setUpdatingCard(true)}>{t("money.subUpdateCard")}</button>
              {(c.status === "canceled" || c.status === "none") && (
                <button
                  type="button"
                  className="font-bold text-[var(--red,#c02636)] hover:underline"
                  disabled={acting === "unlink"}
                  onClick={async () => {
                    setActing("unlink");
                    try { await api("/api/subscription/card", { method: "DELETE" }); refresh(); }
                    catch (e) { setError(e instanceof Error ? e.message : t("money.subCouldntRemoveCard")); }
                    finally { setActing(null); }
                  }}
                >
                  {acting === "unlink" ? t("money.subRemoving") : t("money.subRemoveCard")}
                </button>
              )}
            </div>
          )}
          <div className="mt-2 text-[12.5px] text-[var(--ink-3)]">
            {c.status === "trialing" && c.trialEndsAt && <>{t("money.subFreeTrialDash")} <b className="text-[var(--ink)]">{t("money.subDaysLeft", { n: daysLeft(c.trialEndsAt) })}</b>{t("money.subThenBilledFrom", { date: fmtDay(c.trialEndsAt) })}</>}
            {c.status === "active" && c.currentPeriodEnd && <>{t("money.subRenewsOn", { date: fmtDay(c.currentPeriodEnd) })}</>}
            {c.status === "canceling" && c.cancelAt && <>{t("money.subCancelsOn", { date: fmtDay(c.cancelAt) })}</>}
          </div>

          {c.staffLimit != null && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11.5px] font-bold text-[var(--ink-3)]"><span>{t("money.subStaff")}</span><span>{staffUsed ?? "—"} / {c.staffLimit}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, staffUsed != null ? (staffUsed / c.staffLimit) * 100 : 0)}%`, background: overStaff ? "#c02636" : "#1d3a8f" }} /></div>
              {overStaff && <div className="mt-1 text-[11.5px] font-bold text-[#c02636]">{t("money.subStaffLimitHit")}</div>}
            </div>
          )}

          <div className="mt-3.5 flex flex-wrap gap-2">
            {(c.status === "active" || c.status === "trialing") && <Button variant="danger" sm onClick={() => act("cancel", "cancel")} disabled={acting === "cancel"}>{acting === "cancel" ? t("money.subCancelling") : t("money.subCancelSubscription")}</Button>}
            {(c.status === "canceling" || c.status === "canceled") && <Button variant="primary" sm onClick={() => act("reactivate", "react")} disabled={acting === "react"}>{acting === "react" ? t("money.subReactivating") : t("money.subReactivate")}</Button>}
          </div>
        </div>
      )}

      {/* Head-office network billing — the whole point of the Franchise plan: the
          fee scales with how many franchisees are signed up under you. */}
      {fb && (
        <div className="mb-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ede9fe] text-[14px]">🌐</span>
            <span className="text-[14px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("money.subFranchiseNetwork")}</span>
            <span className="rounded-full bg-[#ede9fe] px-2.5 py-0.5 text-[11px] font-extrabold text-[#6d28d9]">{t("money.subFranchisesSignedUp", { count: fb.count, label: fb.count === 1 ? t("money.subFranchiseOne") : t("money.subFranchiseMany") })}</span>
            {!onFranchise && <span className="ml-auto rounded-full bg-[#fdf0e3] px-2.5 py-0.5 text-[10.5px] font-bold text-[#a5670a]">{t("money.subPreviewYoureOn", { name: c.details?.name ?? "" })}</span>}
          </div>
          <div className="p-4">
            <div className="text-[11.5px] text-[var(--ink-3)]">
              {t("money.subFranchiseExplainer")}
            </div>
            {/* Mini invoice: base + graduated per-franchise lines + total. */}
            <div className="mt-3 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
              <div className="flex items-center justify-between px-3.5 py-2.5 text-[12.5px]">
                <span>{t("money.subHeadOfficeBase")} <span className="text-[var(--ink-3)]">· {t("money.subHqConsoleTools")}{fb.ownLocations > 0 ? ` ${t("money.subPlusYourOwnLocations", { n: fb.ownLocations, label: fb.ownLocations === 1 ? t("money.subLocationOne") : t("money.subLocationMany") })}` : ""}</span></span>
                <span className="font-bold tabular-nums">{gbp(fb.base)}<span className="text-[11px] font-normal text-[var(--ink-3)]">{t("money.subPerMo")}</span></span>
              </div>
              {fb.lines.map((ln, i) => {
                const from = i === 0 ? 1 : (fb.tiers[i - 1]?.upTo ?? 0) + 1;
                const to = fb.tiers[i]?.upTo;
                return (
                  <div key={i} className="flex items-center justify-between px-3.5 py-2.5 text-[12.5px]">
                    <span>{t("money.subNTimesFranchise", { count: ln.count })} <span className="text-[var(--ink-3)]">· {t("money.subEachPrice", { price: gbp(ln.price) })}{fb.tiers.length > 1 ? ` ${t("money.subNumberRange", { range: `${from}${to == null ? "+" : `–${to}`}` })}` : ""}</span></span>
                    <span className="font-bold tabular-nums">{gbp(Math.round(ln.count * ln.price * 100) / 100)}<span className="text-[11px] font-normal text-[var(--ink-3)]">{t("money.subPerMo")}</span></span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between bg-[var(--panel)] px-3.5 py-2.5 text-[13px] font-extrabold">
                <span>{onFranchise ? t("money.subTotalYouPay") : t("money.subTotalOnFranchise")}</span>
                <span className="tabular-nums text-[#6d28d9]">{gbp(fb.total)}<span className="text-[11px] font-bold text-[var(--ink-3)]">{t("money.subPerMoVat")}</span></span>
              </div>
            </div>
            {fb.tiers.length > 1 && (
              <div className="mt-2 text-[11px] text-[var(--ink-3)]">{t("money.subVolumePricing")} {fb.tiers.map((tr, i) => { const from = i === 0 ? 1 : (fb.tiers[i - 1]?.upTo ?? 0) + 1; return `${from}${tr.upTo == null ? "+" : `–${tr.upTo}`} ${gbp(tr.price)}`; }).join(" · ")}.</div>
            )}
            {/* The exact thing the operator asks: their own locations don't add to the bill. */}
            <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-[#f5f2fe] px-3 py-2 text-[11.5px] leading-snug text-[#4a4763]">
              <span className="text-[13px] leading-none">🏛️</span>
              <div><b>{t("money.subOwnLocationsIncluded")}</b>{t("money.subOwnLocationsBody", { loc: `${fb.ownLocations > 0 ? `${fb.ownLocations} ` : ""}${fb.ownLocations === 1 ? t("money.subLocationOne") : t("money.subLocationMany")}` })}<b>{t("money.subPerFranchiseRate", { rate: gbp(fb.nextRate) })}</b>{t("money.subOwnLocationsBody2")}<b>{t("money.subFranchiseeYouInvite")}</b>.</div>
            </div>
            {fb.count === 0 && <div className="mt-2.5 text-[11.5px] text-[var(--ink-3)]">{t("money.subNoFranchisesYet", { base: gbp(fb.base), rate: gbp(fb.nextRate) })}</div>}
            {!onFranchise && (
              <button type="button" onClick={() => { const fp = data.plans.find((p) => p.id === "franchise"); if (fp) start(fp); }} disabled={!!saving}
                className="mt-3 rounded-full px-4 py-2 text-[12.5px] font-extrabold text-white transition-transform hover:-translate-y-px disabled:opacity-60" style={{ background: "#6d28d9" }}>
                {saving ? t("money.subSwitching") : t("money.subSwitchToFranchise")}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-extrabold">{c.status === "none" ? t("money.subChoosePlanTitle") : t("money.subChangePlan")}</div>
        {toggle}
      </div>
      <div className="grid gap-3.5 md:grid-cols-3">{shown.map((p) => planCard(p))}</div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-[12px] text-[var(--ink-3)]">
        <span className="text-[15px]">🔒</span>
        <div>{t("money.subEveryPlanSettles1")} <b className="text-[var(--ink-2)]">{t("money.subYourOwnAccount")}</b>{t("money.subEveryPlanSettles2")}{!data.billingConfigured && t("money.subCardBillingConnected")}</div>
      </div>

      {/* Swap the card on file — plan and billing dates untouched. */}
      {updatingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setUpdatingCard(false)}>
          <div className="w-full max-w-[420px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5" style={LIGHT_PALETTE} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-[14px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("money.subUpdateYourCard")}</div>
              <button type="button" className="text-[12px] font-bold text-[var(--ink-3)]" onClick={() => setUpdatingCard(false)}>✕ {t("money.close")}</button>
            </div>
            <p className="mb-3 mt-1 text-[12px] text-[var(--ink-3)]">{t("money.subFuturePaymentsNewCard")}</p>
            <CardCapture
              plan={c.plan} cadence={c.cadence ?? "month"} cardOnly cta={t("money.subSaveCard")}
              onDone={() => { setUpdatingCard(false); refresh(); }}
              onError={(m) => { setUpdatingCard(false); setError(m); }}
            />
          </div>
        </div>
      )}

      {/* Card capture for a start/reactivation with no card on file. */}
      {payFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPayFor(null)}>
          <div className="w-full max-w-[420px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5" style={LIGHT_PALETTE} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-[14px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("money.subAddYourCard", { name: payFor.name })}</div>
              <button type="button" className="text-[12px] font-bold text-[var(--ink-3)]" onClick={() => setPayFor(null)}>✕ {t("money.close")}</button>
            </div>
            <p className="mb-3 mt-1 text-[12px] text-[var(--ink-3)]">
              {c.status === "none" ? t("money.subFreeThenPrice", { n: data.trialDays ?? 7, price: gbp(monthlyPrice(payFor)) }) : t("money.subYoullBeCharged", { price: gbp(monthlyPrice(payFor)), unit: annual ? t("money.subUnitAnnualBilling") : t("money.subMo") })}
            </p>
            <CardCapture
              plan={payFor.id}
              band={bandFor(payFor)}
              cadence={annual ? "year" : "month"}
              cta={c.status === "none" ? t("money.subStartNDayTrial", { n: data.trialDays ?? 7 }) : t("money.subSubscribePayNow")}
              onDone={() => { setPayFor(null); refresh(); }}
              onError={(m) => { setPayFor(null); setError(m); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
