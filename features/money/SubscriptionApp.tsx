"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { api, get as apiGet } from "@/lib/api";
import { Button } from "@/components/ui";
import { useAuth } from "@/components/auth/AuthProvider";

// The gate renders as a full-screen replacement for the portal shell, so it
// carries its own light palette (matching the operator portals) rather than
// inheriting the near-black operator surface underneath.
const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;

interface Band { id: string; label: string; price: number; staffMax?: number | null }
interface Plan { id: string; name: string; price: number; cadence: string; blurb: string; features: string[]; bands?: Band[]; perLocationPct?: number }
interface Current {
  plan: string; status: string; band?: string | null; cadence?: string;
  since: string | null; trialEndsAt?: string | null; currentPeriodEnd?: string | null; cancelAt?: string | null;
  price?: number; staffLimit?: number | null; locationLimit?: number | null; staffUsed?: number | null;
  details: Plan;
}
interface Payload { current: Current; plans: Plan[]; billingConfigured: boolean; trialDays?: number }

const HERO = "radial-gradient(120% 160% at 12% -30%, rgba(120,170,255,.5) 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#274ba3 58%,#3f78d8 100%)";
const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;
const fmtDay = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const daysLeft = (iso?: string | null) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)) : 0);

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

  const refresh = useCallback(() => {
    apiGet<Payload>("/api/subscription").then((p) => { setData(p); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const bandFor = useCallback((p: Plan) => (p.bands ? (band[p.id] ?? p.bands[0].id) : undefined), [band]);
  const monthlyPrice = useCallback((p: Plan) => (!p.bands ? p.price : (p.bands.find((b) => b.id === bandFor(p))?.price ?? p.price)), [bandFor]);

  async function start(p: Plan) {
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
    catch (e) { setError(e instanceof Error ? e.message : "Action failed"); }
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
    const current = !gate && p.id === data.current.plan && data.current.status !== "none";
    const recommended = p.id === data.current.plan;
    const m = monthlyPrice(p);
    const annualTotal = m * 10;
    return (
      <div key={p.id} className={`relative flex flex-col rounded-2xl border-2 bg-[var(--surface)] p-4 ${recommended ? "border-[#1d3a8f] shadow-[0_14px_34px_-18px_rgba(29,58,143,.55)]" : "border-[var(--line)]"}`}>
        {recommended && <div className="absolute -top-2.5 left-4 rounded-full bg-[#1d3a8f] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">{gate ? "Your plan" : "Most popular"}</div>}
        <div className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{p.name}</div>
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
              return <button key={b.id} type="button" onClick={() => setBand((s) => ({ ...s, [p.id]: b.id }))} className="rounded-full border px-2.5 py-1 text-[10.5px] font-bold transition-colors" style={on ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{b.label}</button>;
            })}
          </div>
        )}
        <ul className="mt-3 flex flex-1 flex-col gap-1.5">
          {p.features.map((f, i) => <li key={i} className={`flex gap-1.5 text-[12px] ${f.endsWith(":") ? "font-bold text-[var(--ink-2)]" : "text-[var(--ink-2)]"}`}>{!f.endsWith(":") && <span className="text-[#1d3a8f]">✓</span>}{f}</li>)}
        </ul>
        {opts?.cta !== false && (
          <div className="mt-3.5">
            {current ? <Button className="w-full" disabled>Your plan</Button>
              : <Button variant="primary" className="w-full justify-center" onClick={() => start(p)} disabled={saving === p.id}>{saving === p.id ? "Starting…" : data.current.status === "none" || gate ? "Start free trial" : `Switch to ${p.name}`}</Button>}
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
      <div className="mt-3 flex flex-col gap-2.5">
        <input className={cardField} placeholder="Name on card" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} />
        <input className={cardField} placeholder="Card number" inputMode="numeric" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} />
        <div className="flex gap-2.5">
          <input className={cardField} placeholder="MM / YY" value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} />
          <input className={cardField} placeholder="CVC" inputMode="numeric" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} />
        </div>
      </div>
      {!data.billingConfigured && <div className="mt-2 rounded-lg bg-[var(--panel)] px-3 py-2 text-[11px] text-[var(--ink-3)]">Card billing is being connected — your trial starts now and you’ll confirm your card before it ends.</div>}
      <Button variant="primary" className="mt-3 h-11 w-full justify-center text-[14px]" onClick={() => start(chosen)} disabled={!!saving}>
        {saving ? "Starting…" : `Start ${data.trialDays ?? 7}-day free trial`}
      </Button>
      <p className="mt-2 text-center text-[11px] text-[var(--ink-3)]">Then {gbp(monthlyPrice(chosen))}/mo{chosen.bands ? " +" : ""} after your trial. Cancel anytime.</p>
    </div>
  );

  // ── Gated full-screen wall ───────────────────────────────────────────────
  if (gate) {
    return (
      <div className="min-h-screen w-full overflow-auto text-[var(--ink)]" style={{ ...LIGHT_PALETTE, background: "var(--bg)" }}>
        <div className="mx-auto max-w-[1000px] px-4 py-8">
          <div className="overflow-hidden rounded-2xl text-white" style={{ background: HERO }}>
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
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Subscription</h2>

      {c.status !== "none" && (
        <div className="mb-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[16px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{c.details?.name}{c.band ? ` · ${c.band}` : ""}</span>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: sm.bg, color: sm.fg }}>{sm.label}</span>
            <span className="ml-auto text-[13px] font-bold">{c.price != null ? `${gbp(c.price)}/${c.cadence === "year" ? "yr" : "mo"}` : ""}</span>
          </div>
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
    </div>
  );
}
