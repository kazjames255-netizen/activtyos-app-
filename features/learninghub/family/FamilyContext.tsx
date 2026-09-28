"use client";

import { useI18n, useT } from "@/lib/i18n/provider";
import { syncHubLocale } from "./hubT";
import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import { cleanSupport, type SupportProfile } from "../support";
import { Avatar, FOCUS } from "../kit";

// The family (parent) side of the hub knows WHICH child a screen is for, and says so out loud. The same child id a runner
// posts results with is the id it looks up its name chip from, so what is shown and what is recorded cannot drift apart.
// Outside a family hub (a tutor) there is no provider: every helper here renders nothing.

export interface FamilyKid { childId: string; childName: string }
export interface FamilyCtx {
  /** false = no family context (tutor / preview): helpers render nothing and never block. */
  active: boolean;
  kids: FamilyKid[];
  /** The child the hub currently shows. */
  childId: string | null;
  /** The parent has 2+ children with this provider (so "who is this?" matters). */
  multi: boolean;
  /** The child was picked on purpose (tapped, arrived by a link naming the child, remembered) rather than defaulted to the first. */
  confirmed: boolean;
  /** Kid mode: the parent handed the device over; chrome is hidden and wording is child-friendly. */
  kid: boolean;
  /** True on a Level 2/3 route (/[portal]/learninghub/[childId]…): a child was named by the URL itself, not
   *  picked from the Level 1 family overview — Home should show that child's Today directly, never the overview. */
  routed?: boolean;
  providerName: string;
  tenantId: string;
  /** Choose (and confirm) a child. */
  pick: (childId: string) => void;
  /** Hand the device to a child: full-screen kid mode scoped to them. */
  handOver: (childId: string) => void;
  /** Where "Ask your tutor" goes (the parent's messages, pre-addressed to this provider). */
  messageHref: string | null;
  /** R-5: this child's tutor-set support profile (defaults when none). */
  support?: SupportProfile;
}

const OFF: FamilyCtx = { active: false, kids: [], childId: null, multi: false, confirmed: true, kid: false, providerName: "", tenantId: "", pick: () => undefined, handOver: () => undefined, messageHref: null };
const Ctx = createContext<FamilyCtx>(OFF);
export const FamilyProvider = ({ value, children }: { value: FamilyCtx; children: ReactNode }) => {
  syncHubLocale(useI18n().locale); // lets non-hook copy tables (kidCopy/parentCopy getters) follow the active language
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
export const useFamily = () => useContext(Ctx);
/** The chosen child's support profile (R-5); the defaults outside a family hub. */
export const useSupport = (): SupportProfile => cleanSupport(useContext(Ctx).support);

/** May a runner start for `childId`? False while a multi-child family has not said who is learning. */
export function useChildGate(childId: string | null): { ok: boolean; name: string | null } {
  const f = useFamily();
  const name = f.kids.find((k) => k.childId === childId)?.childName ?? null;
  return { ok: !f.active || !f.multi || f.confirmed, name };
}

/** A small "who is this for" pill: the child's avatar and first name. Renders nothing outside a family hub. */
export function ChildChip({ childId, tone = "soft", className = "" }: { childId: string | null; tone?: "soft" | "dark"; className?: string }) {
  const t = useT();
  const { name } = useChildGate(childId);
  const f = useFamily();
  if (!f.active || !name) return null;
  const first = name.trim().split(/\s+/)[0] || name;
  return (
    <span data-testid="hub-child-chip" data-child-id={childId ?? ""} aria-label={t("hubfam.fmLearningAs", { name })} title={name}
      className={`inline-flex min-h-[32px] max-w-[46vw] flex-none items-center gap-1.5 rounded-full py-0.5 ps-0.5 pe-3 text-[12.5px] font-extrabold ${tone === "dark" ? "bg-white/20 text-white" : "border border-[var(--brand-line)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"} ${className}`}>
      <Avatar name={name} size={26} /><span className="truncate">{first}</span>
    </span>
  );
}

/** The intro-screen line above a Start button. One child: "Ava is doing this". Two or more: the child's chip plus a one-tap
 *  "Not Ava? Switch", and — until somebody has said who is learning — a big "Who's learning?" picker (Start stays off). */
export function WhoIsLearning({ childId, tone = "soft" }: { childId: string | null; tone?: "soft" | "dark" }) {
  const t = useT();
  const f = useFamily();
  const [open, setOpen] = useState(false);
  if (!f.active || !f.kids.length) return null;
  const name = f.kids.find((k) => k.childId === childId)?.childName ?? null;
  const dark = tone === "dark";
  // Kid mode: the child is fixed by the grown-up who handed the device over. Say who this is for, offer no way to become a sibling.
  if (!f.multi || f.kid) return name ? <div className="mb-3 flex items-center gap-2" data-testid="hub-who-line"><ChildChip childId={childId} tone={tone} /><span className={`text-[12.5px] font-semibold ${dark ? "text-white/85" : "text-[var(--ink-2)]"}`}>{t("hubfam.fmDoingThis")}</span></div> : null;

  const asking = !f.confirmed || open;
  if (!asking) {
    return (
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1" data-testid="hub-who-line">
        <ChildChip childId={childId} tone={tone} />
        <span className={`text-[12.5px] font-semibold ${dark ? "text-white/85" : "text-[var(--ink-2)]"}`}>{t("hubfam.fmDoingThisDot")}</span>
        <button type="button" onClick={() => setOpen(true)} data-testid="hub-who-switch"
          className={`inline-flex min-h-[44px] items-center rounded-lg px-2 text-[12.5px] font-extrabold underline underline-offset-2 ${dark ? "text-white" : "text-[var(--brand)]"} ${FOCUS}`}>
          {t("hubfam.fmNotSwitch", { name: (name ?? t("hubfam.fmNotThem")).split(/\s+/)[0]! })}
        </button>
      </div>
    );
  }
  return (
    <div role="group" aria-label={t("hubfam.fmWho")} data-testid="hub-who-picker" className={`mb-4 rounded-2xl border p-3 ${dark ? "border-white/25 bg-white/10 text-white" : "border-[var(--brand-line)] bg-[var(--brand-soft)] text-[var(--ink)]"}`}>
      <div className="mb-2 text-[13px] font-extrabold">{t("hubfam.fmWho")}</div>
      <div className="flex flex-wrap gap-2">
        {f.kids.map((k) => {
          const on = k.childId === childId && f.confirmed;
          return (
            <button key={k.childId} type="button" aria-pressed={on} data-testid="hub-who-kid" onClick={() => { f.pick(k.childId); setOpen(false); }}
              className={`inline-flex min-h-[52px] items-center gap-2 rounded-2xl border-2 ps-1.5 pe-4 text-[14px] font-extrabold ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--surface)] text-[var(--brand-strong)]" : "border-transparent bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--brand)]"}`}>
              <Avatar name={k.childName} size={38} />{k.childName}
            </button>
          );
        })}
      </div>
      {!f.confirmed && <p className={`m-0 mt-2 text-[12px] font-semibold ${dark ? "text-white/80" : "text-[var(--ink-2)]"}`}>{t("hubfam.fmPickNote")}</p>}
    </div>
  );
}

// FamilyBar (the "Hand over to…" strip) is removed — Kaz: "remove the handover function completely and just have it
// on front page very simple". The front page IS simple now: the child-switcher pills in the hero banner, that's it.

/** Level 2 child switcher (redesign brief §1): avatar chips for every child, the current one highlighted, plus a
 *  link back to the Level 1 family overview. Switching a chip keeps the current section (it just swaps :childId
 *  in the URL, leaving ?tab=&sub= exactly as they are) — LearningHubApp re-seeds Home from the new child's own
 *  data the same way a fresh route load does. Renders nothing for a single-child family (nothing to switch to) —
 *  they never see the family overview either, so there is nothing to link back to. */
export function ChildSwitcher({ portal }: { portal: string }) {
  const t = useT();
  const f = useFamily();
  if (!f.active || f.kid || !f.multi || !f.routed) return null;
  // Strip any `?child=` the CURRENT page carries (LearningHubApp writes one back for its own bookmark/refresh
  // support — see its `setLinkParams({ child: hub.childId })` effect): left in, it would override the new
  // :childId path segment the moment the target page reads its own URL (useHubData's `urlChild` prefers a
  // `?child=` query param over the `initialChildId` prop precisely so an explicit link like this one still wins
  // over a stale remembered pick) and land you back on the child you just clicked away from.
  const qp = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  qp.delete("child");
  const search = qp.toString() ? `?${qp.toString()}` : "";
  return (
    <nav aria-label={t("hubshell.hm_switchChild")} data-testid="hub-child-switcher" className="mb-3 -mx-3 flex snap-x snap-proximity gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:-mx-5 sm:px-5 [&::-webkit-scrollbar]:hidden">
      {f.kids.map((k) => {
        const on = k.childId === f.childId;
        // next/link (client-side transition), not a full navigation: a real page load re-runs the whole provider
        // fetch from cold, which — on the App Router reusing this same [childId] route — briefly reads `providers`
        // as if genuinely empty rather than "still loading" (real bug hit live: the "None of your providers have
        // switched on the Learning Hub" empty state flashed for an instant on every switch). A plain client
        // transition never resets that state at all; only useHubData.ts's own effect re-derives the child.
        return (
          <Link key={k.childId} href={`/${portal}/learninghub/${encodeURIComponent(k.childId)}${search}`} data-testid="hub-child-switcher-chip" data-child-id={k.childId}
            aria-current={on ? "true" : undefined} aria-label={t("hubshell.hm_switchToChild", { name: k.childName })} title={k.childName}
            className={`inline-flex min-h-[44px] flex-none snap-start items-center gap-2 rounded-full border-2 py-0.5 ps-0.5 pe-3.5 text-[13px] font-extrabold ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-transparent bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--line)]"}`}>
            <Avatar name={k.childName} size={32} /><span className="max-w-[26vw] truncate sm:max-w-none">{k.childName.trim().split(/\s+/)[0]}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** "Ask your tutor" as an inline text link (retake / year-group dead ends). Nothing outside a family hub or in kid mode. */
export function AskTutorLink({ children, subject, className = "" }: { children?: ReactNode; subject?: string; className?: string }) {
  const t = useT();
  const f = useFamily();
  if (!f.active || f.kid || !f.messageHref) return null;
  const href = subject ? `${f.messageHref}&subject=${encodeURIComponent(subject)}` : f.messageHref;
  return <Link href={href} data-testid="hub-ask-tutor-link" className={`inline-flex min-h-[44px] items-center rounded-lg px-1 text-[12.5px] font-extrabold text-[var(--brand)] underline underline-offset-2 ${FOCUS} ${className}`}>{children ?? t("hubfam.fmAsk")}</Link>;
}
