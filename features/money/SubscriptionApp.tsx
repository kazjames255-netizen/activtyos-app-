"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { Button } from "@/components/ui";
import { useAuth } from "@/components/auth/AuthProvider";

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
interface Payload { current: Current; plans: Plan[]; billingConfigured: boolean; trialDays?: number }

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
          onError(error?.message ?? "Your card wasn't confirmed — try again.");
          setBusy(false);
          return;
        }
        try {
          if (cardOnly) await apiPost("/api/subscription/card", { setupIntentId: setupIntent.id });
          else await apiPost("/api/subscription/start", { plan, band, cadence, setupIntentId: setupIntent.id });
          onDone();
        } catch (err) {
          onError(err instanceof Error ? err.message : "Couldn't start the subscription");
        } finally {
          setBusy(false);
        }
      }}
    >
      <PaymentElement />
      <Button variant="primary" className="mt-3 h-11 w-full justify-center text-[14px]" disabled={busy}>
        {busy ? "Confirming…" : cta}
      </Button>
    </form>
  );
}

/** Fetches the SetupIntent and mounts Stripe Elements around SetupForm. */
function CardCapture(props: { plan: string; band?: string; cadence: string; cta: string; cardOnly?: boolean; onDone: () => void; onError: (msg: string) => void }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const { onError } = props;
  const requested = useRef(false);
  useEffect(() => {
    // StrictMode double-mounts effects in dev — one SetupIntent is plenty.
    if (requested.current) return;
    requested.current = true;
    apiPost<{ clientSecret: string }>("/api/subscription/checkout", {})
      .then((r) => setClientSecret(r.clientSecret))
      .catch((e) => onError(e instanceof Error ? e.message : "Couldn't start card capture"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!stripePromise) return <div className="rounded-lg bg-[var(--panel)] px-3 py-2 text-[11px] text-[var(--ink-3)]">Card billing isn't configured (missing publishable key).</div>;
  if (!clientSecret) return <div className="py-4 text-center text-[12px] text-[var(--ink-3)]">Loading secure card form…</div>;
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
    apiGet<Payload>("/api/subscription").then((p) => { setData(p); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
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
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t start that plan"); }
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
      setError(e instanceof Error ? e.message : "Action failed");
    }
    finally { setActing(null); }
  }

  const shown = useMemo(() => (!data ? [] : gate ? data.plans.filter((p) => p.id === data.current.plan) : data.plans), [data, gate]);

  if (error) return <div className="p-4 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!data) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading plans…</div>;

  const toggle = (
    <div className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 text-[12px] font-bold">
      {([["month", "Monthly"], ["year", "Annual · save 2 months"]] as const).map(([v, label]) => {
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
    const t = TIER[p.id] ?? TIER.company;
    return (
      <div key={p.id} className="relative flex flex-col overflow-hidden rounded-2xl border-2 bg-[var(--surface)] p-4" style={{ borderColor: recommended ? t.c : "var(--line)", boxShadow: recommended ? "0 14px 34px -18px rgba(29,58,143,.35)" : undefined }}>
        <div className="-mx-4 -mt-4 mb-3 h-1.5" style={{ background: t.grad }} />
        {recommended && <div className="absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white" style={{ background: t.c }}>{gate ? "Your plan" : "Current plan"}</div>}
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl text-[15px]" style={{ background: `${t.c}1f` }}>{t.icon}</span>
          <span className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{p.name}</span>
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-[24px] font-extrabold">{annual ? gbp(annualTotal) : gbp(m)}</span>
          <span className="text-[12px] text-[var(--ink-3)]">{annual ? "/yr" : "/mo"}{p.bands ? " from" : ""}</span>
        </div>
        <div className="text-[11px] text-[var(--ink-3)]">{annual ? `≈ ${gbp(Math.round(annualTotal / 12))}/mo · 2 months free` : "+ VAT · cancel anytime"}</div>
        <p className="mt-2 text-[12px] leading-snug text-[var(--ink-3)]">{p.blurb}</p>
        {p.bands && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {p.bands.map((b) => {
              const on = bandFor(p) === b.id;
              return <button key={b.id} type="button" onClick={() => setBand((s) => ({ ...s, [p.id]: b.id }))} className="rounded-full border px-2.5 py-1 text-[10.5px] font-bold transition-colors" style={on ? { borderColor: t.c, background: t.c, color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{b.label}</button>;
            })}
          </div>
        )}
        <ul className="mt-3 flex flex-1 flex-col gap-1.5">
          {p.features.map((f, i) => <li key={i} className={`flex gap-1.5 text-[12px] ${f.endsWith(":") ? "font-bold text-[var(--ink-2)]" : "text-[var(--ink-2)]"}`}>{!f.endsWith(":") && <span style={{ color: t.c }}>✓</span>}{f}</li>)}
        </ul>
        {opts?.cta !== false && (
          <div className="mt-3.5">
            {current ? <Button className="w-full" disabled>✓ Current plan</Button>
              : <button type="button" onClick={() => start(p)} disabled={saving === p.id}
                  className="w-full rounded-full px-4 py-2.5 text-[13px] font-extrabold transition-transform hover:-translate-y-px disabled:opacity-60"
                  style={{ background: t.c, color: p.id === "freelancer" ? "#3a2a00" : "#fff" }}>
                  {saving === p.id ? "Starting…" : data.current.status === "none" || gate ? "Start free trial" : `Switch to ${p.name}`}
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
        <div className="text-[14px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Payment details</div>
        <span className="rounded-full bg-[#eaf0fc] px-2.5 py-0.5 text-[10.5px] font-bold text-[#1d3a8f]">🔒 Secured by Stripe</span>
      </div>
      <p className="mt-1 text-[12px] text-[var(--ink-3)]">Free for {data.trialDays ?? 7} days — we won’t charge you until then, and you can cancel anytime.</p>
      {data.billingConfigured ? (
        <div className="mt-3">
          <CardCapture
            plan={chosen.id}
            band={bandFor(chosen)}
            cadence={annual ? "year" : "month"}
            cta={`Start ${data.trialDays ?? 7}-day free trial`}
            onDone={() => { if (gate) onStarted?.(); else refresh(); }}
            onError={setError}
          />
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-col gap-2.5">
            <input className={cardField} placeholder="Name on card" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} />
            <input className={cardField} placeholder="Card number" inputMode="numeric" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} />
            <div className="flex gap-2.5">
              <input className={cardField} placeholder="MM / YY" value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} />
              <input className={cardField} placeholder="CVC" inputMode="numeric" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} />
            </div>
          </div>
          <div className="mt-2 rounded-lg bg-[var(--panel)] px-3 py-2 text-[11px] text-[var(--ink-3)]">Card billing is being connected — your trial starts now and you’ll confirm your card before it ends.</div>
          <Button variant="primary" className="mt-3 h-11 w-full justify-center text-[14px]" onClick={() => start(chosen)} disabled={!!saving}>
            {saving ? "Starting…" : `Start ${data.trialDays ?? 7}-day free trial`}
          </Button>
        </>
      )}
      <p className="mt-2 text-center text-[11px] text-[var(--ink-3)]">Then {gbp(monthlyPrice(chosen))}/mo{chosen.bands ? " +" : ""} after your trial. Cancel anytime.</p>
    </div>
  );

  // ── Gated full-screen wall ───────────────────────────────────────────────
  if (gate) {
    return (
      <div className="min-h-screen w-full overflow-auto text-[var(--ink)]" style={{ ...LIGHT_PALETTE, background: "var(--bg)" }}>
        <div className="mx-auto max-w-[1000px] px-4 py-8">
          <div className="overflow-hidden rounded-2xl text-white" style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), ${HERO}`, backgroundSize: "18px 18px, cover", backgroundRepeat: "repeat, no-repeat" }}>
            <div className="px-6 py-6 sm:px-8">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[19px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}><span style={{ color: "#fff" }}>Activity</span><span style={{ color: "#EE1F63" }}>OS</span></div>
                <button type="button" onClick={async () => { await signOutUser(); router.replace("/login"); }} className="rounded-full border border-white/30 bg-white/10 px-3.5 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-white/20">Log out</button>
              </div>
              <div className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#ffd23f" }}>Almost there</div>
              <h1 className="mt-1 text-[26px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)", color: "#fff" }}>Pick a plan to start your free trial</h1>
              <p className="mt-1.5 max-w-[560px] text-[13px] leading-snug text-white/85">A flat monthly fee — never a cut of your bookings. Every plan settles payments to your own account. Cancel anytime.</p>
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
  const staffUsed = c.staffUsed ?? null;
  const overStaff = c.staffLimit != null && staffUsed != null && staffUsed >= c.staffLimit;
  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* Hero — matches the other Money pages (Expenses / Purchasing). */}
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)`, backgroundSize: "18px 18px, cover", backgroundRepeat: "repeat, no-repeat" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">💳</span>
          Subscription
        </div>
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">Your ActivityOS plan — see what you’re on, switch plans, or cancel anytime.</p>
      </div>

      {c.status !== "none" && (
        <div className="mb-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[16px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{c.details?.name}{c.band ? ` · ${c.band}` : ""}</span>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: sm.bg, color: sm.fg }}>{sm.label}</span>
            <span className="ml-auto text-[13px] font-bold">{c.price != null ? `${gbp(c.price)}/${c.cadence === "year" ? "yr" : "mo"}` : ""}</span>
          </div>
          {c.cardLast4 && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--ink-3)]">
              <span>💳 {c.cardBrand ? c.cardBrand[0].toUpperCase() + c.cardBrand.slice(1) : "Card"} ···· {c.cardLast4}</span>
              <button type="button" className="font-bold text-[var(--brand-2,#2f6bd8)] hover:underline" onClick={() => setUpdatingCard(true)}>Update card</button>
              {(c.status === "canceled" || c.status === "none") && (
                <button
                  type="button"
                  className="font-bold text-[var(--red,#c02636)] hover:underline"
                  disabled={acting === "unlink"}
                  onClick={async () => {
                    setActing("unlink");
                    try { await api("/api/subscription/card", { method: "DELETE" }); refresh(); }
                    catch (e) { setError(e instanceof Error ? e.message : "Couldn't remove the card"); }
                    finally { setActing(null); }
                  }}
                >
                  {acting === "unlink" ? "Removing…" : "Remove card"}
                </button>
              )}
            </div>
          )}
          <div className="mt-2 text-[12.5px] text-[var(--ink-3)]">
            {c.status === "trialing" && c.trialEndsAt && <>Free trial — <b className="text-[var(--ink)]">{daysLeft(c.trialEndsAt)} days left</b>, then billed from {fmtDay(c.trialEndsAt)}.</>}
            {c.status === "active" && c.currentPeriodEnd && <>Renews {fmtDay(c.currentPeriodEnd)}.</>}
            {c.status === "canceling" && c.cancelAt && <>Cancels {fmtDay(c.cancelAt)} — you keep access until then.</>}
          </div>

          {c.staffLimit != null && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11.5px] font-bold text-[var(--ink-3)]"><span>Staff</span><span>{staffUsed ?? "—"} / {c.staffLimit}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, staffUsed != null ? (staffUsed / c.staffLimit) * 100 : 0)}%`, background: overStaff ? "#c02636" : "#1d3a8f" }} /></div>
              {overStaff && <div className="mt-1 text-[11.5px] font-bold text-[#c02636]">You’ve hit your staff limit — upgrade a band to add more.</div>}
            </div>
          )}

          <div className="mt-3.5 flex flex-wrap gap-2">
            {(c.status === "active" || c.status === "trialing") && <Button variant="danger" sm onClick={() => act("cancel", "cancel")} disabled={acting === "cancel"}>{acting === "cancel" ? "Cancelling…" : "Cancel subscription"}</Button>}
            {(c.status === "canceling" || c.status === "canceled") && <Button variant="primary" sm onClick={() => act("reactivate", "react")} disabled={acting === "react"}>{acting === "react" ? "Reactivating…" : "Reactivate"}</Button>}
          </div>
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-extrabold">{c.status === "none" ? "Choose a plan to start your free trial" : "Change plan"}</div>
        {toggle}
      </div>
      <div className="grid gap-3.5 md:grid-cols-3">{shown.map((p) => planCard(p))}</div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-[12px] text-[var(--ink-3)]">
        <span className="text-[15px]">🔒</span>
        <div>Every plan settles parents’ payments to <b className="text-[var(--ink-2)]">your own account</b> — this fee is what you pay ActivityOS, never a cut of your bookings.{!data.billingConfigured && " Card billing is being connected."}</div>
      </div>

      {/* Swap the card on file — plan and billing dates untouched. */}
      {updatingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setUpdatingCard(false)}>
          <div className="w-full max-w-[420px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5" style={LIGHT_PALETTE} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-[14px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Update your card</div>
              <button type="button" className="text-[12px] font-bold text-[var(--ink-3)]" onClick={() => setUpdatingCard(false)}>✕ Close</button>
            </div>
            <p className="mb-3 mt-1 text-[12px] text-[var(--ink-3)]">Future payments use the new card. Your plan and billing dates don't change.</p>
            <CardCapture
              plan={c.plan} cadence={c.cadence ?? "month"} cardOnly cta="Save card"
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
              <div className="text-[14px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Add your card — {payFor.name}</div>
              <button type="button" className="text-[12px] font-bold text-[var(--ink-3)]" onClick={() => setPayFor(null)}>✕ Close</button>
            </div>
            <p className="mb-3 mt-1 text-[12px] text-[var(--ink-3)]">
              {c.status === "none" ? `Free for ${data.trialDays ?? 7} days, then ${gbp(monthlyPrice(payFor))}/mo. Cancel anytime.` : `You'll be charged ${gbp(monthlyPrice(payFor))}/${annual ? "yr — annual billing" : "mo"} now.`}
            </p>
            <CardCapture
              plan={payFor.id}
              band={bandFor(payFor)}
              cadence={annual ? "year" : "month"}
              cta={c.status === "none" ? `Start ${data.trialDays ?? 7}-day free trial` : "Subscribe & pay now"}
              onDone={() => { setPayFor(null); refresh(); }}
              onError={(m) => { setPayFor(null); setError(m); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
