"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import { cleanSupport, type SupportProfile } from "../support";
import { Avatar, FOCUS } from "../kit";
import { Ico } from "../teachIcons";

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
export const FamilyProvider = ({ value, children }: { value: FamilyCtx; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
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
  const { name } = useChildGate(childId);
  const f = useFamily();
  if (!f.active || !name) return null;
  const first = name.trim().split(/\s+/)[0] || name;
  return (
    <span data-testid="hub-child-chip" data-child-id={childId ?? ""} aria-label={`Learning as ${name}`} title={name}
      className={`inline-flex min-h-[32px] max-w-[46vw] flex-none items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-3 text-[12.5px] font-extrabold ${tone === "dark" ? "bg-white/20 text-white" : "border border-[var(--brand-line)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"} ${className}`}>
      <Avatar name={name} size={26} /><span className="truncate">{first}</span>
    </span>
  );
}

/** The intro-screen line above a Start button. One child: "Ava is doing this". Two or more: the child's chip plus a one-tap
 *  "Not Ava? Switch", and — until somebody has said who is learning — a big "Who's learning?" picker (Start stays off). */
export function WhoIsLearning({ childId, tone = "soft" }: { childId: string | null; tone?: "soft" | "dark" }) {
  const f = useFamily();
  const [open, setOpen] = useState(false);
  if (!f.active || !f.kids.length) return null;
  const name = f.kids.find((k) => k.childId === childId)?.childName ?? null;
  const dark = tone === "dark";
  // Kid mode: the child is fixed by the grown-up who handed the device over. Say who this is for, offer no way to become a sibling.
  if (!f.multi || f.kid) return name ? <div className="mb-3 flex items-center gap-2" data-testid="hub-who-line"><ChildChip childId={childId} tone={tone} /><span className={`text-[12.5px] font-semibold ${dark ? "text-white/85" : "text-[var(--ink-2)]"}`}>is doing this</span></div> : null;

  const asking = !f.confirmed || open;
  if (!asking) {
    return (
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1" data-testid="hub-who-line">
        <ChildChip childId={childId} tone={tone} />
        <span className={`text-[12.5px] font-semibold ${dark ? "text-white/85" : "text-[var(--ink-2)]"}`}>is doing this.</span>
        <button type="button" onClick={() => setOpen(true)} data-testid="hub-who-switch"
          className={`inline-flex min-h-[44px] items-center rounded-lg px-2 text-[12.5px] font-extrabold underline underline-offset-2 ${dark ? "text-white" : "text-[var(--brand)]"} ${FOCUS}`}>
          Not {(name ?? "them").split(/\s+/)[0]}? Switch
        </button>
      </div>
    );
  }
  return (
    <div role="group" aria-label="Who's learning?" data-testid="hub-who-picker" className={`mb-4 rounded-2xl border p-3 ${dark ? "border-white/25 bg-white/10 text-white" : "border-[var(--brand-line)] bg-[var(--brand-soft)] text-[var(--ink)]"}`}>
      <div className="mb-2 text-[13px] font-extrabold">Who&apos;s learning?</div>
      <div className="flex flex-wrap gap-2">
        {f.kids.map((k) => {
          const on = k.childId === childId && f.confirmed;
          return (
            <button key={k.childId} type="button" aria-pressed={on} data-testid="hub-who-kid" onClick={() => { f.pick(k.childId); setOpen(false); }}
              className={`inline-flex min-h-[52px] items-center gap-2 rounded-2xl border-2 pl-1.5 pr-4 text-[14px] font-extrabold ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--surface)] text-[var(--brand-strong)]" : "border-transparent bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--brand)]"}`}>
              <Avatar name={k.childName} size={38} />{k.childName}
            </button>
          );
        })}
      </div>
      {!f.confirmed && <p className={`m-0 mt-2 text-[12px] font-semibold ${dark ? "text-white/80" : "text-[var(--ink-2)]"}`}>Results are saved for the child you pick, so choose before you start.</p>}
    </div>
  );
}

/** Parent-only strip under the hub tabs: who the hub is showing, "Hand over" (kid mode) and "Ask your tutor". */
export function FamilyBar() {
  const f = useFamily();
  const [choose, setChoose] = useState(false);
  if (!f.active || f.kid || !f.kids.length) return null;
  const cur = f.kids.find((k) => k.childId === f.childId) ?? null;
  const first = (n: string) => n.trim().split(/\s+/)[0] || n;
  return (
    <div id="hub-family-bar" className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 shadow-[var(--shadow-sm)]">
      {cur && <ChildChip childId={cur.childId} />}
      <span className="hidden min-w-0 flex-1 basis-[140px] text-[12.5px] font-semibold text-[var(--ink-2)] sm:block">Want them to work on their own? Hand the device over: no menus, and it needs a grown-up to leave.</span>
      <div className="flex flex-wrap items-center gap-2">
        {(() => {
          const list = f.multi ? f.kids : cur ? [cur] : [];
          const pill = (k: FamilyKid) => (
            <button key={k.childId} type="button" onClick={() => f.handOver(k.childId)} data-testid="hub-hand-over" data-child-id={k.childId}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[13px] font-extrabold text-white ${FOCUS}`} style={{ background: "linear-gradient(180deg, var(--brand-2), var(--brand))" }}>
              <Ico name="lock" size={15} />Hand over to {first(k.childName)}
            </button>
          );
          // Two children or fewer: one pill each. More: ONE "Hand over" control that opens a child chooser, so a big family doesn't push the tabs down the page.
          if (list.length <= 2) return list.map(pill);
          return (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setChoose((v) => !v)} aria-expanded={choose} aria-controls="hub-hand-over-list" data-testid="hub-hand-over-toggle"
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[13px] font-extrabold text-white ${FOCUS}`} style={{ background: "linear-gradient(180deg, var(--brand-2), var(--brand))" }}>
                <Ico name="lock" size={15} />Hand over to…
              </button>
              {choose && <div id="hub-hand-over-list" role="group" aria-label="Hand over to" className="flex max-h-[168px] w-full flex-wrap gap-2 overflow-y-auto">{list.map(pill)}</div>}
            </div>
          );
        })()}
        {f.messageHref && (
          <Link href={f.messageHref} data-testid="hub-ask-tutor" className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-[13px] font-extrabold text-[var(--ink)] hover:border-[var(--brand)] ${FOCUS}`}>
            <Ico name="send" size={15} />Ask your tutor
          </Link>
        )}
      </div>
    </div>
  );
}

/** "Ask your tutor" as an inline text link (retake / year-group dead ends). Nothing outside a family hub or in kid mode. */
export function AskTutorLink({ children = "Ask your tutor", subject, className = "" }: { children?: ReactNode; subject?: string; className?: string }) {
  const f = useFamily();
  if (!f.active || f.kid || !f.messageHref) return null;
  const href = subject ? `${f.messageHref}&subject=${encodeURIComponent(subject)}` : f.messageHref;
  return <Link href={href} data-testid="hub-ask-tutor-link" className={`inline-flex min-h-[44px] items-center rounded-lg px-1 text-[12.5px] font-extrabold text-[var(--brand)] underline underline-offset-2 ${FOCUS} ${className}`}>{children}</Link>;
}
