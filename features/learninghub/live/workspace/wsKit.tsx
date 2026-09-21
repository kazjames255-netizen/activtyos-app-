"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FOCUS } from "../../teachKit";
import { Ico, type IcoName } from "../../teachIcons";

// Shared bits for the in-call workspace: the "how is this being shown" context
// (present mode / hide names / large type), the attendee model, and a few
// small light-warm surfaces.

export interface WsView {
  /** Screen-share mode: bigger type, tutor-only controls hidden. */
  present: boolean;
  /** Hide other children's names (Student A, B…) and scores. */
  hideNames: boolean;
  /** Large-type reading size. */
  big: boolean;
  /** Tutor workspace (false = the lighter family one). */
  isTutor: boolean;
}
export const WsViewCtx = createContext<WsView>({ present: false, hideNames: false, big: false, isTutor: true });
export const useWsView = () => useContext(WsViewCtx);

export interface Attendee {
  childId: string;
  name: string;
  yearGroup?: string | null;
  /** ISO — first time this child's family joined (tutor lesson rows). */
  joinedAt?: string | null;
}

/** "Student A" … for a shared screen. */
export const maskName = (i: number) => `Student ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ""}`;
export function useShownName(): (a: Attendee, i: number) => string {
  const { hideNames } = useWsView();
  return (a, i) => (hideNames ? maskName(i) : a.name);
}

/** Type scale: `big` lifts every reading size for a shared screen. */
export const txt = (big: boolean, base: string, large: string) => (big ? large : base);

export function WsSection({ title, icon, aside, children, className = "" }: { title: string; icon?: IcoName; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={`rounded-2xl border border-[var(--hub-warm-line)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-sm)] ${className}`}>
      <div className="mb-2.5 flex items-center gap-2">
        {icon && <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]"><Ico name={icon} size={15} /></span>}
        <h3 className="m-0 min-w-0 flex-1 truncate text-[13px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-2)]">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function WsEmpty({ icon, title, body, action }: { icon: IcoName; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--hub-warm-line)] px-4 py-8 text-center" style={{ background: "var(--hub-warm)" }}>
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]" aria-hidden><Ico name={icon} size={22} /></div>
      <div className="mt-2 text-[14px] font-extrabold text-[var(--ink)]">{title}</div>
      {body && <p className="mx-auto mt-1 max-w-[320px] text-[12.5px] leading-relaxed text-[var(--ink-3)]">{body}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

export function WsButton({ children, onClick, icon, variant = "ghost", disabled, className = "", ariaLabel, title, id }: {
  children: ReactNode; onClick?: () => void; icon?: IcoName; variant?: "solid" | "ghost" | "soft"; disabled?: boolean; className?: string; ariaLabel?: string; title?: string; id?: string;
}) {
  const cls = variant === "solid"
    ? "border-transparent text-white shadow-[var(--shadow-sm)] hover:brightness-110"
    : variant === "soft"
      ? "border-[var(--brand-line)] bg-[var(--brand-soft)] text-[var(--brand-strong)] hover:border-[var(--brand)]"
      : "border-[var(--hub-warm-line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand)] hover:text-[var(--brand)]";
  return (
    <button type="button" id={id} onClick={onClick} disabled={disabled} aria-label={ariaLabel} title={title}
      className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3.5 text-[13px] font-extrabold transition-colors disabled:opacity-55 motion-reduce:transition-none ${cls} ${FOCUS} ${className}`}
      style={variant === "solid" ? { background: "linear-gradient(180deg, var(--brand-2), var(--brand))" } : undefined}>
      {icon && <Ico name={icon} size={15} />}{children}
    </button>
  );
}

/** The workspace pane's overlay layer: a drawer, a reading view or the card deck renders INTO the pane
 *  (not over the whole call), so the video and the room's controls stay put. */
export const OverlayHostCtx = createContext<HTMLElement | null>(null);
export function PaneOverlay({ children }: { children: ReactNode }) {
  const host = useContext(OverlayHostCtx);
  return host ? createPortal(children, host) : <>{children}</>;
}
