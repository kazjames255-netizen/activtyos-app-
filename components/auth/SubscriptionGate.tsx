"use client";

import { dateLocale as dl } from "@/lib/i18n/format";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { get as apiGet } from "@/lib/api";
import { SubscriptionApp } from "@/features/money/SubscriptionApp";
import { useT, useI18n } from "@/lib/i18n/provider";
import { BRAND, isRTL } from "@/lib/i18n/config";

// Signup account types that own a tenant and must pick a plan. Franchise and
// staff join an existing tenant by invite, so they're never sent to the plan
// picker — but they DO follow the tenant's billing state (below).
const OWNER_PORTALS = new Set(["freelancer", "company"]);
const TEAM_PORTALS = new Set(["freelancer", "company", "franchise", "staff"]);

/** The server's grace model (server/src/middleware/subscription.ts — the
 *  header comment there is the spec): full → grace (past_due, first 14 days,
 *  everything works) → readonly (reads + safety writes) → locked (safety +
 *  billing only). GET /api/subscription/access reports it for any team member. */
type Mode = "full" | "grace" | "readonly" | "locked";
interface Access { mode: Mode; status: string; graceEndsAt: string | null; pastDueSince?: string | null; owner: boolean }

const AccessCtx = createContext<Access | null>(null);

// Views that keep working even when locked — the screens whose API the server
// leaves open (SAFETY / SAFETY_READ / OPEN there). Kept in step on purpose: a
// view the shell shows but the API refuses renders its EMPTY state, and a
// lapsed operator reads "0 bookings" as data loss rather than a billing problem.
const SAFETY_VIEWS = new Set(["registers", "admin-registers", "incidents", "incident", "accidents", "medication", "customers", "children"]);
const OPEN_VIEWS = new Set(["subscription", "account", "privacy", "support", "activityos"]);

/** The safety screens to offer from the locked panel, per portal. */
function safetyLinks(portal: string): [string, string][] {
  return [
    [portal === "company" ? "admin-registers" : "registers", "p8ops.shLinkRegisters"],
    [portal === "staff" ? "incident" : "incidents", "p8ops.shLinkConcern"],
    ["accidents", "p8ops.shLinkFirstAid"],
    ["medication", "p8ops.shLinkMedication"],
    ["customers", "p8ops.shLinkFamilies"],
  ];
}

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(dl(), { day: "numeric", month: "short" }) : "");
const daysSince = (iso?: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)) : 0);

/**
 * Outer wrapper (around the whole portal shell). Walls a fresh operator
 * behind the plan picker until they start a trial — a pre-existing tenant (no
 * `subscription` field) reports "active" and passes straight through; only
 * signups seeded `status:"none"` are gated. For every team portal it also
 * loads the tenant's billing mode for <SubscriptionLock> to act on.
 *
 * A lapsed tenant used to be walled here entirely — owner out of registers
 * and incident records mid-session while their staff carried on (acceptance
 * test d19s4). Now the shell stays up and SubscriptionLock decides per view.
 */
export function SubscriptionGate({ portal, children }: { portal: string; children: ReactNode }) {
  const t = useT();
  const team = TEAM_PORTALS.has(portal);
  // Only the owner portals can be sent to the plan picker, so only they wait
  // for the answer; staff/franchise render straight away and pick up the
  // banner when it arrives.
  const [state, setState] = useState<"loading" | "ok" | "gated">(OWNER_PORTALS.has(portal) ? "loading" : "ok");
  const [access, setAccess] = useState<Access | null>(null);

  useEffect(() => {
    if (!team) return;
    let cancelled = false;
    apiGet<Access>("/api/subscription/access")
      .then((a) => {
        if (cancelled) return;
        setAccess(a);
        setState(OWNER_PORTALS.has(portal) && (!a.status || a.status === "none") ? "gated" : "ok");
      })
      .catch(() => { if (!cancelled) setState("ok"); }); // API unreachable — don't lock the shell
    return () => { cancelled = true; };
  }, [team, portal]);

  if (state === "loading") return <div className="flex h-screen items-center justify-center text-[13px] text-[var(--ink-3)]">{t("p8ops.shLoading")}</div>;
  if (state === "gated") return <SubscriptionApp gate onStarted={() => setState("ok")} />;
  return <AccessCtx.Provider value={access}>{children}</AccessCtx.Provider>;
}

/**
 * Inner wrapper (around the page content). Grace: a payment-failed banner for
 * the owner. Read-only: a banner for the whole team (saves outside the safety
 * screens are refused by the API with the same explanation). Locked: the
 * safety and billing screens still open under a banner; anything else shows
 * a panel pointing at them.
 */
export function SubscriptionLock({ portal, children }: { portal: string; children: ReactNode }) {
  const a = useContext(AccessCtx);
  const t = useT();
  const pathname = usePathname() ?? "";
  const { locale } = useI18n();
  const isRtl = isRTL(locale);
  if (!a || a.mode === "full" || (a.mode === "grace" && !a.owner)) return <>{children}</>;

  const subHref = `/${portal}/subscription`;
  const view = pathname.split("/")[2] ?? "";
  const cta = (label: string) => a.owner && view !== "subscription"
    ? <Link href={subHref} className="ms-1.5 whitespace-nowrap underline">{label} {isRtl ? "←" : "→"}</Link>
    : null;

  const still = t("p8ops.shStill");
  let text: string;
  if (a.mode === "grace") text = t("p8ops.shGraceText", { date: fmt(a.graceEndsAt), brand: BRAND });
  else if (a.mode === "readonly") {
    text = a.owner
      ? t("p8ops.shReadonlyOwner", { days: daysSince(a.pastDueSince), still, brand: BRAND })
      : t("p8ops.shReadonlyStaff", { still, brand: BRAND });
  } else {
    text = a.owner
      ? t("p8ops.shEndedOwner", { still, brand: BRAND })
      : t("p8ops.shEndedStaff", { still, brand: BRAND });
  }
  const banner = (
    <div role="status" className="px-4 py-2 text-center text-[12.5px] font-bold leading-snug text-white" style={{ background: a.mode === "grace" ? "#a5670a" : "#c02636" }}>
      {text}{cta(a.mode === "locked" ? t("p8ops.shReactivate") : t("p8ops.shUpdateCard"))}
    </div>
  );

  if (a.mode === "locked" && !SAFETY_VIEWS.has(view) && !OPEN_VIEWS.has(view)) {
    return (
      <>
        {banner}
        <div className="p-3 sm:p-5">
          <div className="mx-auto mt-6 max-w-[560px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-[var(--ink)]">
            <div className="text-[18px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("p8ops.shPausedTitle")}</div>
            <p className="mt-1.5 text-[13px] leading-snug text-[var(--ink-2)]">
              {a.owner
                ? t("p8ops.shPausedOwner")
                : t("p8ops.shPausedStaff")}
            </p>
            <div className="mt-3.5 flex flex-wrap gap-2">
              {safetyLinks(portal).map(([v, lk]) => (
                <Link key={v} href={`/${portal}/${v}`} className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--ink)] hover:border-[#1d3a8f]">{t(lk)}</Link>
              ))}
            </div>
            {a.owner && (
              <Link href={subHref} className="mt-4 inline-block rounded-full bg-[#1d3a8f] px-4 py-2 text-[12.5px] font-bold text-white">{t("p8ops.shReactivateInSub")}</Link>
            )}
          </div>
        </div>
      </>
    );
  }
  return <>{banner}{children}</>;
}
