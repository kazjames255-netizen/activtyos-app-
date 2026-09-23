"use client";

// Small presentational pieces shared by the quiz, placement-test and progress
// panels. Tokens only (no hex) so the parent portal's per-tenant --brand and the
// light shell both just work.
import { useEffect, useRef, type ReactNode } from "react";
import { Icon, type IconName } from "../kit";
import { useEscapeLayer } from "../escapeLayer";
import type { Tone } from "./format";
import { useCountUp, useGrow, useReducedMotion } from "./motion";

export const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)] focus-visible:outline";
/** ≥44px touch target on every tappable control. */
export const TAP = `min-h-[44px] ${FOCUS}`;
export const display = { fontFamily: "var(--ff-display)" } as const;

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-[var(--line)] ${className}`} style={style} />;
}

/** Shape-mirroring skeleton for the assessment cards (cover band, chip, title, ring, button). */
export function CardSkeleton() {
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
      <Skeleton className="h-[60px] w-full !rounded-none" />
      <div className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-20 !rounded-full" />
          <Skeleton className="mt-3 h-4 w-3/5" />
          <Skeleton className="mt-2.5 h-3 w-4/5" />
          <div className="mt-3 flex gap-1.5"><Skeleton className="h-5 w-14" /><Skeleton className="h-5 w-16" /></div>
        </div>
        <Skeleton className="h-16 w-16 flex-none !rounded-full" />
      </div>
      <div className="flex gap-2 border-t border-[var(--line)] px-4 py-3"><Skeleton className="h-11 w-24 !rounded-full" /><Skeleton className="h-11 w-24 !rounded-full" /></div>
    </div>
  );
}

/** A grid of card skeletons (the assessment lists). */
export function CardGridSkeleton({ count = 4, label = "Loading" }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}

/** List-row skeleton: an avatar/tile, two lines and a trailing pill. */
export function ListSkeleton({ rows = 3, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="grid gap-2.5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
          <Skeleton className="h-10 w-10 flex-none !rounded-full" />
          <div className="min-w-0 flex-1"><Skeleton className="h-3.5 w-2/5" /><Skeleton className="mt-2 h-3 w-3/5" /></div>
          <Skeleton className="h-6 w-16 flex-none !rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Dismissible inline message. */
export function Notice({ tone = "error", children, onDismiss, action }: { tone?: "error" | "warn" | "ok" | "info"; children: ReactNode; onDismiss?: () => void; action?: ReactNode }) {
  const t = {
    error: { bg: "var(--red-soft)", line: "var(--red-line)", ink: "color-mix(in srgb, var(--red) 70%, var(--ink))", icon: "warning" as IconName },
    warn: { bg: "var(--gold-soft)", line: "var(--gold-line)", ink: "color-mix(in srgb, var(--gold) 25%, var(--ink))", icon: "warning" as IconName },
    ok: { bg: "var(--green-soft)", line: "var(--green-line)", ink: "color-mix(in srgb, var(--green) 45%, var(--ink))", icon: "check" as IconName },
    info: { bg: "var(--brand-soft)", line: "var(--brand-line)", ink: "var(--brand-strong)", icon: "sparkle" as IconName },
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className="flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[12.5px] font-semibold leading-snug" style={{ background: t.bg, borderColor: t.line, color: t.ink }}>
      <Icon name={t.icon} size={16} className="mt-px" />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className={`-my-1 -mr-1.5 grid h-8 w-8 flex-none place-items-center rounded-lg text-[16px] leading-none hover:bg-black/5 ${FOCUS}`}>×</button>
      )}
    </div>
  );
}

export function Chip({ tone, children, icon, className = "" }: { tone: Tone; children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-extrabold leading-[1.4] ${className}`} style={{ background: tone.soft, color: tone.ink }}>
      {icon && <span aria-hidden>{icon}</span>}
      {children}
    </span>
  );
}

const EMOJI_ICON: Record<string, IconName> = { "🧒": "users", "🧭": "compass", "✍️": "quiz", "🌱": "sparkle", "🔎": "search", "👩‍🎓": "users", "📊": "chart", "🎉": "check", "🗂️": "folder", "❓": "quiz" };

/** Friendly empty state. `icon` is a kit IconName (legacy emoji are mapped to one). */
export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body?: ReactNode; action?: ReactNode }) {
  const name = (EMOJI_ICON[icon] ?? (icon as IconName));
  return (
    <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-6 py-10 text-center">
      <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]" aria-hidden>
        <span className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full bg-[var(--gold)] opacity-80" />
        <span className="absolute -bottom-1 -left-1.5 h-2 w-2 rounded-full bg-[var(--green)] opacity-70" />
        <Icon name={name} size={28} strokeWidth={1.6} />
      </div>
      <div className="mt-3 text-[16px] font-extrabold text-[var(--ink)]" style={display}>{title}</div>
      {body && <p className="mx-auto mt-1.5 max-w-[420px] text-[13px] leading-relaxed text-[var(--ink-2)]">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function HourglassIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`flex-none ${className}`}>
      <path d="M6 3h12M6 21h12M7 3v3.5c0 1.6.8 3 2.2 4L12 12l-2.8 1.5C7.8 14.5 7 15.900 7 17.500V21M17 3v3.5c0 1.6-.8 3-2.200 4L12 12l2.800 1.500c1.400 1 2.200 2.400 2.200 4V21" />
    </svg>
  );
}

/** A medal for a best score: gold when it reached the pass mark, silver otherwise. */
export function MedalIcon({ size = 16, gold = true, className = "" }: { size?: number; gold?: boolean; className?: string }) {
  const c = gold ? "var(--gold)" : "var(--ink-3)";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={`flex-none ${className}`}>
      <path d="M8 2h3l1 5-3.500 1.500zM16 2h-3l-1 5 3.500 1.500z" fill={gold ? "var(--brand-2)" : "var(--ink-3)"} opacity="0.75" />
      <circle cx="12" cy="15" r="6.500" fill={c} />
      <circle cx="12" cy="15" r="4.500" fill="none" stroke="var(--surface)" strokeWidth="1.200" opacity="0.7" />
      <path d="m12 12.300.9 1.900 2 .3-1.500 1.400.4 2-1.800-1-1.800 1 .4-2-1.500-1.400 2-.3z" fill="var(--surface)" opacity="0.9" />
    </svg>
  );
}

/** Ring gauge. The arc fills from 0 to `pct` (stroke-dashoffset, ~700ms) and the
 *  number counts up with it; `passMark` draws a tick on the track; `glow` adds the
 *  soft halo of a passed result. `state` swaps the arc for a dashed hourglass
 *  ("pending" — awaiting marking, never a 0%) or a dashed teaser ("empty"). With
 *  prefers-reduced-motion the final values render at once. */
export function ScoreRing({ pct, size = 120, stroke = 10, tone, label, sub, passMark, glow, state, duration = 700, delay = 0, maybe, ariaLabel }: {
  pct: number; size?: number; stroke?: number; tone: Tone; label?: ReactNode; sub?: ReactNode; passMark?: number | null; glow?: boolean; state?: "pending" | "empty"; duration?: number; delay?: number;
  /** A dashed halo round the ring: the score may still change (written answers still to be marked). */
  maybe?: number; ariaLabel?: string;
}) {
  const reduced = useReducedMotion();
  const shown = useGrow(state ? 0 : pct, delay);
  const counted = useCountUp(state ? 0 : pct, duration, delay);
  const partial = !state && maybe != null && maybe > 0;
  const r = (size - stroke) / 2 - (partial ? Math.max(5, size * 0.055) : 0), c = 2 * Math.PI * r, cx = size / 2;
  const frac = Math.min(1, Math.max(0, shown / 100));
  const tick = passMark != null && passMark > 0 && passMark < 100 ? passMark : null;
  const ang = tick != null ? (tick / 100) * 2 * Math.PI : 0;
  const text = label ?? `${Math.round(counted)}%`;
  const numberSize = size * (String(text).length > 3 ? 0.215 : 0.27);
  const aria = ariaLabel ?? (state === "pending" ? "Awaiting marking" : state === "empty" ? (tick != null ? `Not attempted, pass mark ${tick} percent` : "Not attempted") : `${Math.round(pct)} percent${tick != null ? `, pass mark ${tick} percent` : ""}`);
  return (
    <div className="relative flex-none" style={{ width: size, height: size }} role="img" aria-label={aria}>
      {glow && (
        <span aria-hidden className="pointer-events-none absolute rounded-full" style={{ inset: -size * 0.16, background: `radial-gradient(circle, color-mix(in srgb, ${tone.fill} 38%, transparent) 0%, transparent 68%)`, opacity: shown > 0 ? 1 : 0, transition: reduced ? "none" : `opacity 800ms ease ${delay + duration * 0.6}ms` }} />
      )}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative -rotate-90">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--line)" strokeWidth={state ? Math.max(3, stroke * 0.5) : stroke} strokeDasharray={state ? `${Math.max(2, stroke * 0.3)} ${Math.max(6, stroke * 0.7)}` : undefined} strokeLinecap={state ? "round" : undefined} />
        {!state && (
          <circle cx={cx} cy={cx} r={r} fill="none" stroke={tone.fill} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} opacity={frac > 0.004 ? 1 : 0}
            style={{ transition: reduced ? "none" : `stroke-dashoffset ${duration}ms cubic-bezier(.22,.8,.2,1)` }} />
        )}
        {partial && (
          <circle cx={cx} cy={cx} r={size / 2 - 1.5} fill="none" stroke={tone.fill} strokeWidth={Math.max(1.5, size * 0.02)} strokeLinecap="round" strokeDasharray={`${Math.max(2, size * 0.035)} ${Math.max(4, size * 0.05)}`} opacity="0.75" data-testid="hub-ring-maybe" />
        )}
        {tick != null && (
          <line x1={cx + (r - stroke / 2 - 2) * Math.cos(ang)} y1={cx + (r - stroke / 2 - 2) * Math.sin(ang)} x2={cx + (r + stroke / 2 + 2) * Math.cos(ang)} y2={cx + (r + stroke / 2 + 2) * Math.sin(ang)} stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {state === "pending" ? (
          <><span style={{ color: tone.fill }}><HourglassIcon size={Math.round(size * 0.3)} /></span>{sub && <div className="mt-1 font-bold text-[var(--ink-3)]" style={{ fontSize: Math.max(10, size * 0.075) }}>{sub}</div>}</>
        ) : state === "empty" ? (
          <>
            <div className="font-extrabold tabular-nums leading-none text-[var(--ink-3)]" style={{ ...display, fontSize: size * 0.24 }}>{label ?? (tick != null ? `${tick}%` : "–")}</div>
            {sub && <div className="mt-1 font-bold text-[var(--ink-3)]" style={{ fontSize: Math.max(10, size * 0.14) }}>{sub}</div>}
          </>
        ) : (
          <>
            <div className="font-extrabold tabular-nums leading-none text-[var(--ink)]" style={{ ...display, fontSize: numberSize }}>{text}</div>
            {sub && <div className="mt-1 font-bold text-[var(--ink-3)]" style={{ fontSize: Math.max(10, size * 0.09) }}>{sub}</div>}
          </>
        )}
      </div>
    </div>
  );
}

/** Thin horizontal meter (track + rounded fill that grows in). `mark` draws a tick
 *  (e.g. a pass mark or a placement baseline) at that percentage. */
export function Meter({ pct, tone, height = 8, label, delay = 0, mark }: { pct: number; tone: Tone; height?: number; label?: string; delay?: number; mark?: number | null }) {
  const reduced = useReducedMotion();
  const w = useGrow(Math.min(100, Math.max(0, pct)), delay);
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label} className="relative w-full rounded-full bg-[var(--line)]" style={{ height }}>
      <div className="h-full overflow-hidden rounded-full" style={{ width: `${w}%`, background: tone.fill, transition: reduced ? "none" : "width 700ms cubic-bezier(.2,.8,.2,1)" }} />
      {mark != null && <span aria-hidden className="absolute top-1/2 w-[2px] -translate-y-1/2 rounded bg-[var(--ink)] opacity-70" style={{ left: `calc(${Math.min(99, Math.max(1, mark))}% - 1px)`, height: height + 6, boxShadow: "0 0 0 1.5px var(--surface)" }} />}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string; count?: number }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full border border-[var(--line)] bg-[var(--panel)] p-1 sm:gap-1">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.id)}
            className={`inline-flex min-h-[44px] flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12.5px] sm:px-3.5 font-bold transition-colors ${FOCUS} ${on ? "bg-[var(--surface)] text-[var(--brand)] shadow-[var(--shadow-sm)]" : "text-[var(--ink-2)] hover:text-[var(--ink)]"}`}>
            {o.label}
            {o.count != null && o.count > 0 && <span className="rounded-full bg-[var(--brand)] px-1.5 text-[11px] font-extrabold leading-[1.5] text-white">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ on, onChange, label, id }: { on: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <button id={id} type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`group inline-flex min-h-[44px] items-center gap-2.5 rounded-lg text-[13px] font-bold text-[var(--ink)] ${FOCUS}`}>
      <span className="relative h-6 w-11 flex-none rounded-full transition-colors" style={{ background: on ? "var(--brand)" : "var(--line)" }}>
        <span className="absolute top-0.5 h-5 w-5 rounded-full bg-[var(--surface)] shadow transition-all" style={{ left: on ? 22 : 2 }} />
      </span>
      {label}
    </button>
  );
}

/** Accessible modal: Esc closes, focus moves in and returns, body scroll locked,
 *  full-screen sheet on phones. */
export function Modal({ title, onClose, children, footer, wide, id, headerExtra }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; id?: string; headerExtra?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEscapeLayer(true, () => closeRef.current());
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = ref.current?.querySelector<HTMLElement>("[data-autofocus], input, textarea, select");
    (first ?? ref.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !ref.current) return;
      const f = [...ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; prev?.focus?.(); };
  }, []);
  return (
    <div className="fixed inset-0 z-[400] flex items-stretch justify-center bg-[color-mix(in_srgb,var(--ink)_45%,transparent)] md:items-center md:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} id={id} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} tabIndex={-1}
        className={`flex max-h-full w-full flex-col overflow-hidden bg-[var(--surface)] shadow-[var(--shadow-pop)] outline-none md:rounded-2xl ${wide ? "md:max-w-[880px]" : "md:max-w-[620px]"}`}>
        <div className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-[16px] font-extrabold text-[var(--ink)]" style={display}>{title}</h2>
          {headerExtra}
          <button type="button" onClick={onClose} aria-label="Close" className={`grid h-11 w-11 flex-none place-items-center rounded-xl text-[20px] leading-none text-[var(--ink-2)] hover:bg-[var(--panel)] ${FOCUS}`}>×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] bg-[var(--panel)] px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** "×3" style stat. */
export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{label}</div>
      <div className="mt-1 text-[22px] font-extrabold leading-none tabular-nums text-[var(--ink)]" style={display}>{value}</div>
      {sub && <div className="mt-1 text-[11px] font-semibold text-[var(--ink-3)]">{sub}</div>}
    </div>
  );
}

/** Scrolls itself to the top of the viewport when it mounts (opening a result from a list). */
export function ScrollTop({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollIntoView({ block: "start" }); }, []);
  return <div ref={ref} className={`scroll-mt-2 ${className}`}>{children}</div>;
}
