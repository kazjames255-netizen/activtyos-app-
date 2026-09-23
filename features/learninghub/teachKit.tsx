"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Ico, type IcoName } from "./teachIcons";
import { useEscapeLayer } from "./escapeLayer";

// Shared building blocks for the three teaching panels (Live lessons, Homework,
// Flashcards). Kept in its own file so the shell/notes owners can reshape kit.tsx
// without touching these. Everything is styled with CSS variables only.

// ── tokens ───────────────────────────────────────────────────────────────────
export type Tone = "brand" | "green" | "gold" | "red" | "violet" | "neutral";
export const TONES: Record<Tone, { bg: string; fg: string; line: string }> = {
  brand: { bg: "var(--brand-soft)", fg: "var(--brand-strong)", line: "var(--brand-line)" },
  green: { bg: "var(--green-soft)", fg: "var(--hub-green-ink)", line: "var(--green-line)" },
  gold: { bg: "var(--gold-soft)", fg: "var(--brand-ink)", line: "var(--gold-line)" },
  red: { bg: "var(--red-soft)", fg: "var(--red)", line: "var(--red-line)" },
  violet: { bg: "var(--violet-soft)", fg: "var(--violet)", line: "var(--brand-line)" },
  neutral: { bg: "var(--panel)", fg: "var(--ink-2)", line: "var(--line)" },
};

/** Keyboard-focus ring that works on any surface. */
export const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-2)]";

/** The brand-aware "hero" gradient (rebrands per tenant in the parent portal). */
export const HERO_BG: CSSProperties = {
  backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1.6px), linear-gradient(125deg, var(--brand-strong) 0%, var(--brand) 55%, var(--brand-2) 130%)",
  backgroundSize: "18px 18px, cover",
};

export const DISPLAY: CSSProperties = { fontFamily: "var(--ff-display)" };

// ── time ─────────────────────────────────────────────────────────────────────
/** Re-renders on an interval so countdowns and join windows stay live. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

const MIN = 60_000;
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
export const fmtClock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
export const fmtDayTime = (iso: string) => `${fmtDay(iso)} · ${fmtClock(iso)}`;
/** The viewer's local timezone label, e.g. "BST" or "GMT+1". */
export const tzLabel = () => {
  try { return new Date().toLocaleTimeString("en-GB", { timeZoneName: "short" }).split(" ").pop() ?? ""; } catch { return ""; }
};
export const endOf = (startsAt: string, mins: number) => new Date(new Date(startsAt).getTime() + mins * MIN).toISOString();

/** "3 days", "2 h 10 min", "45 min" — coarse, for chips and copy. */
export function humanSpan(ms: number): string {
  const a = Math.abs(ms);
  const days = Math.floor(a / 86_400_000);
  if (days >= 2) return `${days} days`;
  const h = Math.floor(a / 3_600_000);
  const m = Math.round((a % 3_600_000) / MIN);
  if (h >= 1) return m && h < 24 ? `${h} h ${m} min` : `${h} h`;
  return `${Math.max(1, Math.round(a / MIN))} min`;
}

/** "Today" / "Tomorrow" / "Wed 23 Sep". */
export function relDay(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const today = new Date(now);
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((b - a) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return fmtDay(iso);
}

/** Value for <input type="datetime-local"> in the viewer's local time. */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function toLocalDateInput(d: Date): string {
  return toLocalInput(d).slice(0, 10);
}

// ── files ────────────────────────────────────────────────────────────────────
/** POST /api/uploads caps a PDF at ~750KB and an image at 900KB. */
export const MAX_FILE = 700_000;
export const ACCEPT_FILES = "application/pdf,image/png,image/jpeg,image/webp,image/gif";
export const readAsDataUrl = (f: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(new Error("Couldn't read that file"));
  r.readAsDataURL(f);
});

/** Append extra query params to a `qs` that may be "" or "?tenantId=…". */
export const withQs = (qs: string, extra: Record<string, string | null | undefined>) => {
  const p = new URLSearchParams(qs.replace(/^\?/, ""));
  for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const initials = (name: string) => (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

// ── primitives ───────────────────────────────────────────────────────────────
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-[var(--line)]/70 ${className}`} />;
}

export function Pill({ tone = "neutral", icon, children, className = "", title }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string; title?: string }) {
  const t = TONES[tone];
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11px] font-bold leading-[1.4] ${className}`} style={{ background: t.bg, color: t.fg, borderColor: t.line }}>
      {icon}{children}
    </span>
  );
}

export function Avatar({ name, size = 28, tone = "brand" }: { name: string; size?: number; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <span aria-hidden className="inline-grid flex-none place-items-center rounded-full font-extrabold" style={{ width: size, height: size, fontSize: size * 0.38, background: t.bg, color: t.fg, border: `1px solid ${t.line}` }}>
      {initials(name)}
    </span>
  );
}

/** A dismissible error strip, local to a panel (panels also bubble to props.onError). */
export function Notice({ tone = "red", children, onClose }: { tone?: Tone; children: ReactNode; onClose?: () => void }) {
  const t = TONES[tone];
  return (
    <div role={tone === "red" ? "alert" : "status"} className="flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[12.5px] font-semibold" style={{ background: t.bg, color: t.fg, borderColor: t.line }}>
      <span className="min-w-0 flex-1 break-words">{children}</span>
      {onClose && <button type="button" aria-label="Dismiss" onClick={onClose} className={`-mr-1 grid h-6 w-6 flex-none place-items-center rounded-md hover:bg-black/5 ${FOCUS}`}><Ico name="close" size={14} /></button>}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--brand-line)] bg-[var(--surface)] px-6 py-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[26px] text-[var(--brand)]" aria-hidden>{icon}</div>
      <div className="mt-3 text-[16px] font-extrabold text-[var(--ink)]" style={DISPLAY}>{title}</div>
      <p className="mx-auto mt-1.5 max-w-[420px] text-[13px] leading-relaxed text-[var(--ink-2)]">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Pill-style tab switcher with optional counts. */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { v: T; label: string; count?: number; icon?: string }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-1">
      {options.map((o) => {
        const on = o.v === value;
        return (
          <button key={o.v} type="button" role="tab" aria-selected={on} onClick={() => onChange(o.v)}
            className={`inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 text-[12.5px] font-bold transition-colors ${FOCUS} ${on ? "bg-[var(--surface)] text-[var(--brand)] shadow-[var(--shadow-sm)]" : "text-[var(--ink-3)] hover:text-[var(--ink)]"}`}>
            {o.icon && <span aria-hidden>{o.icon}</span>}{o.label}
            {o.count !== undefined && o.count > 0 && (
              <span className={`rounded-full px-1.5 py-px text-[11px] font-extrabold ${on ? "bg-[var(--brand)] text-white" : "bg-[var(--line)] text-[var(--ink-2)]"}`}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ProgressBar({ pct, tone = "brand", label }: { pct: number; tone?: "brand" | "green"; label?: string }) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label} className="h-2 w-full overflow-hidden rounded-full bg-[var(--brand-soft)] ring-1 ring-inset ring-[var(--brand-line)]">
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${v}%`, background: tone === "green" ? "var(--green)" : "linear-gradient(90deg, var(--brand), var(--brand-2))" }} />
    </div>
  );
}

// ── dialog ───────────────────────────────────────────────────────────────────
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Modal dialog: bottom sheet on phones, centred card on desktop. Esc closes,
 *  focus is trapped inside and restored on close, body scroll is locked. */
export function Dialog({ title, subtitle, onClose, children, footer, size = "md", id }: { title: string; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: "md" | "lg" | "xl"; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);
  useEffect(() => { closeRef.current = onClose; });
  useEscapeLayer(ready, () => closeRef.current());
  useEffect(() => {
    if (!ready) return;
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = node?.querySelector<HTMLElement>("[data-autofocus],input,textarea,select");
    if (first) first.focus({ preventScroll: true }); else node?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !node) return;
      const els = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!els.length) return;
      const first = els[0]!, last = els[els.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("keydown", onKey, true); document.body.style.overflow = overflow; prev?.focus?.({ preventScroll: true }); };
  }, [ready]);
  const width = size === "xl" ? "sm:max-w-[920px]" : size === "lg" ? "sm:max-w-[680px]" : "sm:max-w-[520px]";
  return (
    <FullscreenPortal onReady={markReady}>
    <div className="hub-layer fixed inset-0 z-[400] flex items-end justify-center sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} id={id} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className={`hub-sheet flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl outline-none sm:max-h-[90dvh] sm:rounded-3xl ${width}`}>
        <div className="hub-sheet-head flex items-start gap-3 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="m-0 truncate text-[17px] font-extrabold text-[var(--ink)]" style={DISPLAY}>{title}</h2>
            {subtitle && <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid h-10 w-10 flex-none place-items-center rounded-xl text-[15px] text-[var(--ink-3)] hover:bg-[var(--hub-warm-2)] ${FOCUS}`}><Ico name="close" size={16} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="hub-sheet-foot flex flex-wrap items-center justify-end gap-2 px-5 py-3">{footer}</div>}
      </div>
    </div>
    </FullscreenPortal>
  );
}

/** Multi-select of students as toggle chips. With more than a handful it gains a name search, a year-group filter and
 *  "select all shown" (so "everyone in Year 5 except two" is: filter, select shown, untick two). `flags` marks students
 *  the thing being set can't reach (childId → why): they stay tickable but carry a warning marker. */
export function StudentPicker({ students, value, onChange, idPrefix = "student", flags }: { students: { childId: string; childName: string; yearGroup?: string | null }[]; value: string[]; onChange: (ids: string[]) => void; idPrefix?: string; flags?: Record<string, string> }) {
  const [q, setQ] = useState("");
  const [yg, setYg] = useState("");
  const set = new Set(value);
  const toggle = (id: string) => onChange(set.has(id) ? value.filter((x) => x !== id) : [...value, id]);
  if (!students.length) return <p className="rounded-xl border border-dashed border-[var(--line)] px-3 py-3 text-[12.5px] text-[var(--ink-3)]">No students enrolled yet — add students in the roster first.</p>;
  const years = [...new Set(students.map((s) => s.yearGroup).filter((y): y is string => !!y))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const needle = q.trim().toLowerCase();
  const shown = students.filter((s) => (!needle || s.childName.toLowerCase().includes(needle)) && (!yg || s.yearGroup === yg));
  const filtering = !!needle || !!yg;
  const allShown = shown.length > 0 && shown.every((s) => set.has(s.childId));
  const searchable = students.length > 8;
  const toggleShown = () => {
    if (allShown) { const drop = new Set(shown.map((s) => s.childId)); onChange(value.filter((x) => !drop.has(x))); }
    else onChange([...new Set([...value, ...shown.map((s) => s.childId)])]);
  };
  return (
    <div>
      {(searchable || years.length > 1) && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {searchable && (
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students…" aria-label="Search students" id={`${idPrefix}-search`}
              className={`min-h-[40px] min-w-[140px] flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand)] ${FOCUS}`} />
          )}
          {years.length > 1 && (
            <select value={yg} onChange={(e) => setYg(e.target.value)} aria-label="Filter by year group" className={`min-h-[40px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-[13px] text-[var(--ink)] ${FOCUS}`}>
              <option value="">All year groups</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>
      )}
      <div className="flex max-h-[210px] flex-wrap gap-1.5 overflow-y-auto" role="group" aria-label="Students">
        {shown.length === 0 && <p className="px-1 py-2 text-[12.5px] text-[var(--ink-3)]">No students match.</p>}
        {shown.map((s) => {
          const on = set.has(s.childId);
          const flag = flags?.[s.childId];
          return (
            <button key={s.childId} type="button" id={`${idPrefix}-${s.childId}`} aria-pressed={on} onClick={() => toggle(s.childId)} title={flag}
              className={`inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-bold transition-colors ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand)]"}`}>
              <span aria-hidden className={`grid h-4 w-4 place-items-center rounded-full ${on ? "bg-[var(--brand)] text-white" : "border border-[var(--line)]"}`}>{on ? <Ico name="check" size={11} strokeWidth={3} /> : null}</span>
              {s.childName}
              {flag && <span aria-label="Can't open this" className="text-[var(--gold)]">⚠</span>}
            </button>
          );
        })}
      </div>
      {students.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3">
          <button type="button" onClick={toggleShown} disabled={shown.length === 0} className={`min-h-[44px] lg:min-h-[32px] rounded-md px-1 text-[12px] font-bold text-[var(--brand)] hover:underline ${FOCUS}`}>
            {allShown ? (filtering ? "Clear those shown" : "Clear all") : filtering ? `Select all ${shown.length} shown` : "Select everyone"}
          </button>
          {students.length > 8 && <span className="text-[11.5px] text-[var(--ink-3)]">{value.length} of {students.length} selected</span>}
        </div>
      )}
    </div>
  );
}

/** Small uppercase overline used over lists/sections. */
export function Overline({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-1 flex items-center gap-2">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{children}</div>
      <div className="h-px flex-1 bg-[var(--line)]" />
      {right}
    </div>
  );
}

/** Ask the hub shell to switch tab (panels can't change it directly). Tries the
 *  shell's tab buttons; returns false when there's nothing to click, so callers
 *  can still print "open the X tab" guidance. */
export function goToTab(key: string, label: RegExp): boolean {
  if (typeof document === "undefined") return false;
  const el = document.querySelector<HTMLElement>(`[data-panel="${key}"]`)
    ?? [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find((b) => label.test(b.textContent ?? ""));
  if (!el) return false;
  el.click();
  try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* ignore */ }
  return true;
}


// ── motion ───────────────────────────────────────────────────────────────────
/** True when the viewer asked for reduced motion (server / first paint: false). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia("(prefers-reduced-motion: reduce)"); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/** Eases a number up from 0 over `ms`; reduced-motion viewers get the final value at once. */
export function useCountUp(target: number, ms = 700): number {
  const reduced = usePrefersReducedMotion();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduced]);
  return reduced ? target : v;
}

// ── overflow menu ────────────────────────────────────────────────────────────
/** A "⋯" button opening a small menu of actions (≥44px targets). Closes on Esc,
 *  outside click and after an item runs. Never clip it with overflow-hidden parents. */
export function MoreMenu({ label, children, className = "" }: { label: string; children: (close: () => void) => ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent | TouchEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("touchstart", down);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("touchstart", down); };
  }, [open]);
  useEscapeLayer(open, () => { setOpen(false); btn.current?.focus(); });
  return (
    <span ref={wrap} className={`relative inline-flex ${className}`}>
      <button ref={btn} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open}
        onClick={() => { if (!open && btn.current) setUp(btn.current.getBoundingClientRect().bottom + 190 > window.innerHeight); setOpen((o) => !o); }}
        className={`grid h-11 w-11 place-items-center rounded-xl border border-transparent text-[var(--ink-2)] transition-colors hover:border-[var(--line)] hover:bg-[var(--panel)] hover:text-[var(--ink)] ${FOCUS} ${open ? "border-[var(--line)] bg-[var(--panel)]" : ""}`}>
        <Ico name="more" size={20} />
      </button>
      {open && (
        <div role="menu" aria-label={label} className={`hub-pop absolute right-0 z-40 min-w-[196px] rounded-xl p-1 ${up ? "bottom-full mb-1" : "top-full mt-1"}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </span>
  );
}

export function MenuItem({ icon, tone = "neutral", onClick, children, disabled }: { icon?: IcoName; tone?: "neutral" | "danger"; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onClick}
      className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 text-left text-[13px] font-bold disabled:opacity-50 ${FOCUS} ${tone === "danger" ? "text-[var(--red)] hover:bg-[var(--red-soft)]" : "text-[var(--ink)] hover:bg-[var(--hub-warm-2)]"}`}>
      {icon && <Ico name={icon} size={16} />}{children}
    </button>
  );
}


// ── full-screen layers ───────────────────────────────────────────────────────
const THEME_VARS = ["--bg", "--surface", "--panel", "--ink", "--ink-2", "--ink-3", "--line", "--brand", "--brand-2", "--brand-strong", "--brand-ink", "--brand-soft", "--brand-line"];

function Ready({ onReady }: { onReady?: () => void }) {
  useEffect(() => { onReady?.(); }, [onReady]);
  return null;
}

/** Render a full-screen layer (call room, lobby, dialog) INSIDE the hub's root
 *  element (`#learning-hub`, which has no transform). The hub's tab panel plays
 *  an entrance animation that leaves it a containing block, which would trap
 *  `position: fixed` children; and the page's light palette + a tenant's
 *  --brand rebrand live on ancestors of the hub, so anything portalled to
 *  <body> would fall back to the app's DARK :root tokens. Portalling into the
 *  hub root keeps every inherited token. (Fallback to <body> copies the theme
 *  variables across.) */
export function FullscreenPortal({ children, onReady }: { children: ReactNode; onReady?: () => void }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [target, setTarget] = useState<{ host: HTMLElement; vars: CSSProperties | null } | null>(null);
  useEffect(() => {
    const a = anchor.current;
    const parent = a?.parentElement;
    if (!a || !parent) return;
    const hub = a.closest<HTMLElement>("#learning-hub");
    if (hub) { setTarget({ host: hub, vars: null }); return; }
    const cs = getComputedStyle(parent);
    const v: Record<string, string> = {};
    for (const n of THEME_VARS) { const x = cs.getPropertyValue(n).trim(); if (x) v[n] = x; }
    setTarget({ host: document.body, vars: v as CSSProperties });
  }, []);
  return (
    <>
      <span ref={anchor} hidden />
      {target && createPortal(<div className="contents" style={target.vars ?? undefined}>{children}<Ready onReady={onReady} /></div>, target.host)}
    </>
  );
}
