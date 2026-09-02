"use client";

import { useEffect, useState, type ReactNode } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useT } from "@/lib/i18n/provider";
import { Card, Button } from "@/components/ui";

// custdash/memberships — a family joins one of their provider's monthly tiers.
// A CREDIT tier drops £X into their wallet each month; a PERCENT tier gives Y%
// off every booking (auto-applied at checkout, stacking with any coupon).
// Phase 1: joining delivers the benefit immediately; recurring billing is Stripe
// (backend). GET/POST /api/my/memberships.

interface Tier {
  id: string;
  name: string;
  priceMonthly: number;
  benefitType: "credit" | "percent";
  benefitValue: number;
  perks?: string[];
  blurb?: string;
}
interface Current { tierId: string; benefitType: "credit" | "percent"; benefitValue: number; priceMonthly: number; startedAt?: string; renewsAt?: string }
interface Payload { enabled: boolean; provider?: string; tenantId?: string; tiers?: Tier[]; current?: Current | null; reason?: string }

const money = (n?: number) => `£${(n ?? 0) % 1 === 0 ? Math.round(n ?? 0) : (n ?? 0).toFixed(2)}`;
/** The headline + supporting line for a tier's benefit — the star of the card. */
const benefit = (t: { benefitType: "credit" | "percent"; benefitValue: number }) =>
  t.benefitType === "credit"
    ? { emoji: "👛", headline: `${money(t.benefitValue)} in your wallet`, sub: "topped up every month — yours to spend on any booking" }
    : { emoji: "🎟️", headline: `${t.benefitValue}% off, every time`, sub: "applied automatically at checkout, stacking on top of any coupons" };
const benefitShort = (t: { benefitType: "credit" | "percent"; benefitValue: number }) =>
  t.benefitType === "credit" ? `${money(t.benefitValue)}/mo wallet credit` : `${t.benefitValue}% off every booking`;
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
// The benefit (wallet credit / % off) is already the card's hero, so a perk that
// merely restates it — "5% off every booking", "£70 credit every month" — is
// noise (and often stale/contradictory). Only show genuine EXTRA perks.
const extraPerk = (s: string) => !!s && !/\b\d+\s*%\s*off\b/i.test(s) && !/£\s*\d/.test(s) && !/\bwallet\b/i.test(s);

/** One membership tier card — the SINGLE source of truth for how a tier looks,
 *  used by the family's Memberships page AND the operator's Setup preview so the
 *  two are always identical. `footer` is the call-to-action (Join / Current plan
 *  / a static preview pill). */
export function MembershipTierCard({ tier, footer, highlight }: {
  tier: { name: string; blurb?: string; priceMonthly: number; benefitType: "credit" | "percent"; benefitValue: number; perks?: string[] };
  footer?: ReactNode;
  highlight?: boolean;
}) {
  const tr = useT();
  const bn = benefit(tier);
  const perks = (tier.perks ?? []).filter(extraPerk);
  return (
    <Card className={`flex flex-col px-5 py-5 ${highlight ? "ring-2 ring-[#15b364]" : ""}`}>
      <div className="text-[15px] font-extrabold text-[var(--ink)]">{tier.name}</div>
      {tier.blurb && <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">{tier.blurb}</div>}
      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-[var(--ff-display)] text-[30px] leading-none text-[var(--ink)]">{money(tier.priceMonthly)}</span>
        <span className="text-[12.5px] text-[var(--ink-3)]">{tr("parent.perMonth")}</span>
      </div>
      <div className="mt-3 rounded-xl bg-gradient-to-br from-[#eef4ff] to-[#e4ecff] px-3.5 py-3">
        <div className="text-[15.5px] font-extrabold leading-tight text-[#1d3a8f]">{bn.emoji} {bn.headline}</div>
        <div className="mt-1 text-[11.5px] leading-snug text-[#516099]">{bn.sub}</div>
      </div>
      {perks.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {perks.map((perk, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px] text-[var(--ink-2)]">
              <span className="mt-[1px] text-[#15b364]">✓</span><span>{perk}</span>
            </li>
          ))}
        </ul>
      )}
      {footer && <div className="mt-4 pt-1">{footer}</div>}
    </Card>
  );
}

export function MembershipsApp() {
  const tr = useT();
  const [p, setP] = useState<Payload | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => apiGet<Payload>("/api/my/memberships").then(setP).catch(() => setP({ enabled: false }));
  useEffect(() => { void load(); }, []);
  useRealtime(["memberships", "wallet"], load);

  async function join(tenantId: string, tierId: string) {
    setBusy(tierId); setError(null);
    try { await apiPost("/api/my/memberships/join", { tenantId, tierId }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : tr("parent.errCouldntJoin")); }
    finally { setBusy(null); }
  }
  async function cancel(tenantId: string) {
    if (!confirm(tr("parent.cancelMembershipConfirm"))) return;
    setBusy("cancel"); setError(null);
    try { await apiPost("/api/my/memberships/cancel", { tenantId }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : tr("parent.errCouldntCancel")); }
    finally { setBusy(null); }
  }

  if (!p) return <div className="p-4 text-[13px] text-[var(--ink-3)]">{tr("parent.loading")}</div>;

  if (!p.enabled) {
    return (
      <Card className="mx-auto max-w-[640px] px-5 py-8 text-center">
        <div className="text-[40px]">⭐</div>
        <h2 className="mt-1 font-[var(--ff-display)] text-[20px] text-[var(--ink)]">{tr("parent.membershipsTitle")}</h2>
        <p className="mx-auto mt-1 max-w-[420px] text-[13.5px] leading-relaxed text-[var(--ink-3)]">
          {p.reason ?? tr("parent.membershipsNotOn")}
        </p>
      </Card>
    );
  }

  const tiers = p.tiers ?? [];
  const current = p.current ?? null;
  const tenantId = p.tenantId ?? "";

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-4">
        <h2 className="m-0 font-[var(--ff-display)] text-[22px] text-[var(--ink)]">{tr("parent.providerMemberships", { provider: p.provider ?? "" })}</h2>
        <p className="mt-1 text-[13.5px] text-[var(--ink-3)]">{tr("parent.membershipsSubtitle")}</p>
      </div>

      {error && <div className="mb-3 rounded-lg bg-[#fdecec] px-3 py-2 text-[12.5px] font-semibold text-[#c0392b]">{error}</div>}

      {current && (() => {
        const t = tiers.find((x) => x.id === current.tierId);
        return (
          <Card className="mb-4 border-l-4 border-[#15b364] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#0f7a43]">{tr("parent.yourMembership")}</div>
                <div className="mt-0.5 text-[16px] font-extrabold text-[var(--ink)]">{t?.name ?? tr("parent.memberFallback")} · {money(current.priceMonthly)}/mo</div>
                <div className="text-[12.5px] text-[var(--ink-2)]">{benefit(current).emoji} {benefitShort(current)}{current.renewsAt ? ` · renews ${fmtDate(current.renewsAt)}` : ""}</div>
              </div>
              <Button variant="ghost" sm onClick={() => cancel(tenantId)} disabled={busy === "cancel"}>{busy === "cancel" ? tr("parent.cancelling") : tr("parent.cancelMembership")}</Button>
            </div>
          </Card>
        );
      })()}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiers.map((t) => {
          const isCurrent = current?.tierId === t.id;
          const isSwitch = !!current && !isCurrent;
          return (
            <MembershipTierCard key={t.id} tier={t} highlight={isCurrent}
              footer={isCurrent
                ? <div className="rounded-full bg-[#e6f6ec] py-2 text-center text-[12.5px] font-extrabold text-[#0f7a43]">{tr("parent.currentPlan")}</div>
                : <Button variant="primary" className="w-full justify-center" onClick={() => join(tenantId, t.id)} disabled={!!busy}>
                    {busy === t.id ? tr("parent.joining") : isSwitch ? tr("parent.switchTo", { name: t.name }) : tr("parent.joinTier", { name: t.name })}
                  </Button>}
            />
          );
        })}
      </div>

      <p className="mt-4 text-center text-[11.5px] text-[var(--ink-3)]">
        {tr("parent.membershipsFooter")}
      </p>
    </div>
  );
}
