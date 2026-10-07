"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Card } from "@/components/ui";
import { ManualLegal } from "./ManualLegal";

/**
 * platform/manual — the HQ manual. Content-array driven: add a page by pushing another entry onto MANUAL_PAGES.
 * English only (internal team doc). Colours come from the app's CSS variables; tints are mixed from the surface so
 * they read in light and dark. Screenshots live in /public/manual/onboarding (taken from the real app, brand-neutral); card-hold screenshots in /public/manual/hold.
 * The page never names the product: it says "the platform".
 */

const display: CSSProperties = { fontFamily: "var(--ff-display)" };
const tint = (c: string, pct = 14) => `color-mix(in srgb, ${c} ${pct}%, var(--surface))`;

// One colour per stage, used everywhere that stage appears (diagram, section band, number badge).
const C = {
  signup: "#2f6bd8",
  checklist: "#1d3a8f",
  venue: "#0e9f8e",
  block: "#12805a",
  listing: "#c47a00",
  golive: "#e0357a",
  billing: "#6d4bd8",
  cancel: "#e0702a",
  open: "#0f7a43",
};

const IMG = "/manual/onboarding";
/** A bare name is an onboarding screenshot; a path starting with / is used as given (for example /manual/emails/01-welcome-desktop). */
const shotUrl = (src: string) => (src.startsWith("/") ? `${src}.jpg` : `${IMG}/${src}.jpg`);

/* ---------- small building blocks ---------- */

function Pill({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-bold" style={{ background: tint(color, 16), color }}>
      {children}
    </span>
  );
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mb-1 mt-0 text-[24px] font-extrabold leading-tight text-[var(--ink)] sm:text-[28px]" style={display}>{children}</h2>;
}
function Lede({ children }: { children: ReactNode }) {
  return <p className="mb-3 mt-1 max-w-[70ch] text-[14.5px] leading-relaxed text-[var(--ink-2)]">{children}</p>;
}
function Section({ children }: { children: ReactNode }) {
  return <section className="mt-12">{children}</section>;
}

type ShotDef = { src: string; alt: string; caption?: string };

/** Swipe left/right on touch screens. */
function useSwipe(go: (d: number) => void) {
  const x0 = useRef<number | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => { x0.current = e.touches[0].clientX; },
    onTouchEnd: (e: React.TouchEvent) => {
      if (x0.current == null) return;
      const dx = e.changedTouches[0].clientX - x0.current;
      x0.current = null;
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    },
  };
}

function RoundBtn({ label, onClick, children, className = "", style }: { label: string; onClick: () => void; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <button type="button" aria-label={label} onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`grid h-11 w-11 place-items-center rounded-full border-0 text-[22px] font-bold leading-none shadow-md transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
      style={style}>
      {children}
    </button>
  );
}

/** Full-size viewer: Esc closes, arrow keys and swipe move, Tab stays inside, focus returns to the thumbnail it came from. */
function Lightbox({ shots, index, setIndex, onClose, color }: { shots: ShotDef[]; index: number; setIndex: (i: number) => void; onClose: () => void; color: string }) {
  const box = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const n = shots.length;
  const go = useCallback((d: number) => setIndex((index + d + n) % n), [index, n, setIndex]);
  const swipe = useSwipe(go);

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    return () => { document.body.style.overflow = prevOverflow; back?.focus?.(); };
  }, []);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key === "ArrowLeft" && n > 1) { e.preventDefault(); go(-1); return; }
    if (e.key === "ArrowRight" && n > 1) { e.preventDefault(); go(1); return; }
    if (e.key === "Tab") {
      const f = Array.from(box.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  const s = shots[index];
  return createPortal(
    <div ref={box} role="dialog" aria-modal="true" aria-label={`Screenshot viewer: ${s.alt}`} onKeyDown={onKey} onClick={onClose}
      className="fixed inset-0 z-[10000] flex flex-col bg-black/95 p-3 sm:p-6" {...swipe}>
      <div className="flex items-center justify-between gap-3 text-white">
        <span className="min-w-0 text-[14px] font-bold" aria-live="polite">{index + 1} / {n}{s.caption ? ` · ${s.caption}` : ""}<span className="block text-[11.5px] font-semibold text-white/70 sm:hidden">Drag the picture to see all of it</span></span>
        <button ref={closeBtn} type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close viewer"
          className="rounded-full bg-white px-4 py-2 text-[14px] font-extrabold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color }}>Close (Esc)</button>
      </div>
      {/* On a phone the picture is shown at a readable size and can be dragged sideways; on wider screens it fits the window. */}
      <div className="relative flex min-h-0 flex-1 items-start overflow-auto py-3 sm:items-center sm:justify-center sm:overflow-hidden" onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shotUrl(s.src)} alt={s.alt} onClick={(e) => e.stopPropagation()} className="h-auto w-[900px] max-w-none flex-none rounded-xl bg-white shadow-2xl sm:max-h-full sm:w-auto sm:max-w-full sm:object-contain" />
      </div>
      {n > 1 && (
        <div className="flex items-center justify-center gap-4 pb-1">
          <RoundBtn label="Previous screenshot" onClick={() => go(-1)} className="bg-white" style={{ color }}>&#8249;</RoundBtn>
          <div className="flex gap-1.5" aria-hidden="true">{shots.map((_, i) => <i key={i} className="block h-2 w-2 rounded-full" style={{ background: i === index ? "#fff" : "rgba(255,255,255,.4)" }} />)}</div>
          <RoundBtn label="Next screenshot" onClick={() => go(1)} className="bg-white" style={{ color }}>&#8250;</RoundBtn>
        </div>
      )}
    </div>,
    document.body,
  );
}

/** A real screenshot in a browser-style frame, with prev/next, thumbnails, arrow keys and swipe. Click the picture for full size. */
function Gallery({ shots, color }: { shots: ShotDef[]; color: string }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const n = shots.length;
  const go = useCallback((d: number) => setI((x) => (x + d + n) % n), [n]);
  const swipe = useSwipe(go);
  const s = shots[i];
  const many = n > 1;
  return (
    <figure className="m-0 min-w-0" role="group" aria-roledescription="carousel" aria-label={s.alt}
      tabIndex={many ? 0 : undefined}
      onKeyDown={(e) => { if (!many) return; if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); } else if (e.key === "ArrowRight") { e.preventDefault(); go(1); } }}>
      <div className="relative overflow-hidden rounded-[14px] border-2 bg-[var(--surface)] shadow-[var(--shadow-sm)]" style={{ borderColor: tint(color, 45) }} {...swipe}>
        <div className="flex items-center gap-[5px] px-2.5 py-2" style={{ background: tint(color, 18) }} aria-hidden="true">
          {[0, 1, 2].map((k) => <i key={k} className="block h-[9px] w-[9px] rounded-full" style={{ background: color, opacity: 0.55 }} />)}
          {many && <span className="ml-auto text-[11.5px] font-bold" style={{ color }}>{i + 1} / {n}</span>}
        </div>
        <button type="button" onClick={() => setOpen(true)} aria-label={`Enlarge: ${s.alt}`} className="block w-full cursor-zoom-in border-0 bg-transparent p-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shotUrl(s.src)} alt={s.alt} className="block h-auto w-full" />
        </button>
        {many && (
          <>
            <RoundBtn label="Previous screenshot" onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-[var(--surface)]" style={{ color, border: `2px solid ${tint(color, 45)}` }}>&#8249;</RoundBtn>
            <RoundBtn label="Next screenshot" onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-[var(--surface)]" style={{ color, border: `2px solid ${tint(color, 45)}` }}>&#8250;</RoundBtn>
          </>
        )}
      </div>
      <figcaption className="mt-2 flex items-start justify-between gap-3 text-[13px] leading-snug text-[var(--ink-2)]" aria-live="polite">
        <span className="min-w-0 font-bold">{s.caption ?? s.alt}</span>
        <span className="flex-none text-[12px] text-[var(--ink-3)]">Click to enlarge</span>
      </figcaption>
      {many && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Choose a screenshot">
          {shots.map((t, k) => (
            <button key={t.src} type="button" role="tab" aria-selected={k === i} aria-label={`Show screenshot ${k + 1}: ${t.caption ?? t.alt}`} onClick={() => setI(k)}
              className="relative w-[88px] flex-none overflow-hidden rounded-lg border-2 bg-[var(--surface)] p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ borderColor: k === i ? color : "var(--line)", opacity: k === i ? 1 : 0.7 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shotUrl(t.src)} alt="" loading="lazy" className="block h-auto w-full" />
              <span className="absolute bottom-0 left-0 rounded-tr-md px-1.5 text-[11px] font-extrabold text-white" style={{ background: color }}>{k + 1}</span>
            </button>
          ))}
        </div>
      )}
      {open && <Lightbox shots={shots} index={i} setIndex={setI} onClose={() => setOpen(false)} color={color} />}
    </figure>
  );
}

/** What the provider sees / does / what ticks it / the green prompt / mistakes — the same shape for every stage. */
function Facts({ color, rows }: { color: string; rows: { k: string; v: ReactNode }[] }) {
  return (
    <dl className="m-0 grid content-start gap-2">
      {rows.map((r) => (
        <div key={r.k} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5" style={{ borderLeft: `4px solid ${color}` }}>
          <dt className="text-[11.5px] font-extrabold uppercase tracking-wider" style={{ color }}>{r.k}</dt>
          <dd className="m-0 mt-0.5 text-[14px] leading-relaxed text-[var(--ink-2)]">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One stage of onboarding: coloured band with number + title, facts on the left, screenshots on the right. */
function Stage({ n, color, title, tag, facts, shots, visual }: {
  n: string; color: string; title: string; tag: string;
  facts: { k: string; v: ReactNode }[];
  shots?: ShotDef[];
  /** A diagram shown in place of screenshots. */
  visual?: ReactNode;
}) {
  return (
    <Section>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3.5 text-white" style={{ background: `linear-gradient(120deg, ${color}, color-mix(in srgb, ${color} 62%, #0b1f5c))` }}>
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-white text-[18px] font-extrabold" style={{ color }}>{n}</span>
        <div className="min-w-[12rem] flex-1">
          <h2 className="m-0 text-[22px] font-extrabold leading-tight sm:text-[25px]" style={display}>{title}</h2>
        </div>
        <span className="rounded-full bg-white/20 px-3 py-1 text-[12px] font-bold">{tag}</span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-5 min-[900px]:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
        <Facts color={color} rows={facts} />
        <div className="min-w-0 min-[900px]:sticky min-[900px]:top-4 min-[900px]:self-start">{visual ?? (shots && shots.length > 0 ? <Gallery shots={shots} color={color} /> : null)}</div>
      </div>
    </Section>
  );
}


/* ---------- 6 Oct additions: status ladder, refund routes, emails table ---------- */

/** Confirmed / Paid / Reconciled: three different things on a booking. */
function StatusLadder() {
  const steps = [
    { t: "Confirmed", d: "The place is held. Says nothing about money.", c: C.block },
    { t: "Paid", d: "The money is in: card paid, or the provider pressed Mark paid.", c: C.billing },
    { t: "Reconciled", d: "Matched to a real payment and stamped by who did it.", c: C.open },
  ];
  return (
    <div className="grid gap-2">
      {steps.map((x, i) => (
        <div key={x.t} className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5" style={{ borderLeft: `4px solid ${x.c}` }}>
          <span className="grid h-7 w-7 flex-none place-items-center rounded-full text-[13px] font-extrabold text-white" style={{ background: x.c }}>{i + 1}</span>
          <div><div className="text-[14px] font-extrabold" style={{ color: x.c }}>{x.t}</div><div className="text-[13.5px] leading-snug text-[var(--ink-2)]">{x.d}</div></div>
        </div>
      ))}
      <p className="m-0 text-[12.5px] text-[var(--ink-3)]">A bank transfer booking is Confirmed and Unpaid until the provider presses Mark paid.</p>
    </div>
  );
}

/** Where a refund goes, by how the booking was paid. */
function RefundRoutes() {
  const rows: { paid: string; choice: string; how: string; c: string }[] = [
    { paid: "Card", choice: "Wallet, or back to my card", how: "On approval the platform refunds through Stripe (card) or adds wallet credit.", c: C.billing },
    { paid: "Bank transfer", choice: "Wallet, or back to my bank account", how: "Parent types name, sort code, account number. Provider pays it back from their own bank, then approves.", c: C.golive },
    { paid: "Cash", choice: "Wallet, or refunded by the provider", how: "Settled directly between provider and parent. Approving records it.", c: C.cancel },
    { paid: "Voucher / Tax-Free Childcare", choice: "Returned through the scheme", how: "Not refunded to a bank. The provider returns it through the scheme.", c: C.listing },
  ];
  return (
    <div className="grid gap-2">
      {rows.map((r) => (
        <div key={r.paid} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5" style={{ borderLeft: `4px solid ${r.c}` }}>
          <div className="flex flex-wrap items-center gap-2"><Pill color={r.c}>Paid by {r.paid}</Pill><span className="text-[13px] font-bold text-[var(--ink)]">{r.choice}</span></div>
          <div className="mt-1 text-[13.5px] leading-snug text-[var(--ink-2)]">{r.how}</div>
        </div>
      ))}
    </div>
  );
}

/** Which email goes to whom, and when. */
function EmailsTable() {
  const rows: { who: string; c: string; what: string; when: string }[] = [
    { who: "Parent", c: C.block, what: "Booking confirmed", when: "Straight after booking, for bank transfer, cash, free and voucher bookings. Bank transfer shows the provider's bank details and the booking reference. NOT sent for a card booking." },
    { who: "Parent", c: C.block, what: "Payment received", when: "Card: once the card has gone through (this is the only confirmation, nothing is sent before it). Bank transfer: when the provider presses Mark paid." },
    { who: "Parent", c: C.block, what: "We've got your booking request (card held)", when: "Manual-approval listing paid by card, sent once the card has been put on hold. It says: your card has NOT been charged, the amount is held, the payment is taken only if the provider approves, and if they decline or don't reply within 7 days the hold is released and you pay nothing." },
    { who: "Parent", c: C.block, what: "Booking approved and payment received", when: "When the provider approves a held booking. ONE message (email and bell): the booking is approved and the held amount has now been taken. No separate \"You're booked in\" email and no second receipt." },
    { who: "Parent", c: C.block, what: "Your booking request was declined", when: "When the provider declines. For a held card it says: nothing was taken from your account, the held amount has been released, and the bank may keep showing it as pending for a few days before it disappears. Any message the provider typed is included." },
    { who: "Parent", c: C.block, what: "Waiting list", when: "When they join the waiting list. Nothing is charged while they wait." },
    { who: "Parent", c: C.block, what: "A place is yours", when: "When a place opens for them: held for 2 hours, with one Accept and pay button. They pay only if they accept." },
    { who: "Parent", c: C.block, what: "Sorry, you missed out", when: "If the 2 hours run out. They are put back on the waiting list automatically (at the back of the queue), nothing charged, and told so." },
    { who: "Parent", c: C.block, what: "Refund approved", when: "When the provider approves a refund (or wallet credit). Declined has its own email." },
    { who: "Parent", c: C.block, what: "Session reminder", when: "Once per booking, before its first booked day. A 30-day camp sends one, not 30. A single-day booking still gets its own." },
    { who: "Provider", c: C.billing, what: "New booking", when: "Each new booking, with every child, allergies and notes. Card bookings say \"awaiting card payment\"; bank transfer says \"awaiting bank transfer payment\", and the booking shows a Pending payment box." },
    { who: "Provider", c: C.billing, what: "Booking request: approve or decline by [date]", when: "Manual-approval booking with a held card, bell and email, sent once the card is held. It shows the amount held and the deadline (7 days after the card was held) and warns: if you have not answered by then, Stripe cancels the hold, nothing is taken and the booking is cancelled automatically." },
    { who: "Provider", c: C.billing, what: "Last chance to answer", when: "One reminder, bell and email, when about 48 hours are left to approve or decline a held booking." },
    { who: "Provider", c: C.billing, what: "Request expired", when: "Bell only, when a held booking ran out of time and was cancelled automatically." },
    { who: "Provider", c: C.billing, what: "A place has opened up", when: "Manual waiting list only: when a cancellation frees a place and a family is waiting. Bell and email, linking to that booking and its Offer place button. Can be switched off in Setup, Email, Automatic emails, with a warning that you must then check the list yourself. An Automatic waiting list offers the place itself and needs no alert." },
    { who: "Provider", c: C.billing, what: "Cancellation request", when: "When a parent cancels. Short wording: the refund asked for, where it goes, and only the parent's own reason." },
    { who: "Provider", c: C.billing, what: "Moved their dates", when: "When a parent moves their own dates (if the setting is on)." },
  ];
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <table className="w-full border-collapse text-[13.5px]">
        <thead><tr>{["To", "Email", "When it is sent"].map((h) => <th key={h} className="px-3 py-2 text-start text-[11.5px] font-extrabold uppercase tracking-wider text-[var(--ink-2)]">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.what + r.who} className="border-t border-[var(--line)] align-top">
              <td className="px-3 py-2"><Pill color={r.c}>{r.who}</Pill></td>
              <td className="px-3 py-2 font-bold text-[var(--ink)]">{r.what}</td>
              <td className="px-3 py-2 leading-relaxed text-[var(--ink-2)]">{r.when}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- 1. the journey diagram ---------- */

const JOURNEY: { n: string; label: string; sub: string; color: string }[] = [
  { n: "1", label: "Sign up", sub: "5 short steps", color: C.signup },
  { n: "2", label: "Checklist", sub: "5 jobs, in order", color: C.checklist },
  { n: "3", label: "Add venue", sub: "checklist 1", color: C.venue },
  { n: "4", label: "Create block", sub: "checklist 2", color: C.block },
  { n: "5", label: "Create listing", sub: "checklist 3", color: C.listing },
  { n: "6", label: "Go live", sub: "3-step pop-up", color: C.golive },
  { n: "7", label: "Billing", sub: "checklist 4", color: C.billing },
  { n: "8", label: "Cancellations", sub: "checklist 5", color: C.cancel },
  { n: "9", label: "Parents book", sub: "set up done", color: C.open },
];

function Journey() {
  const w = 940, step = w / JOURNEY.length;
  return (
    <>
      {/* wide screens: one road with nine stops */}
      <svg viewBox={`0 0 ${w} 150`} className="hidden w-full min-[760px]:block" role="img" aria-label="Journey from sign-up to parents booking: sign up, dashboard checklist, add venue, create block, create listing, go live pop-up, billing, cancellation policy, parents book">
        <defs>
          <linearGradient id="road" x1="0" x2="1">
            {JOURNEY.map((j, i) => <stop key={j.n} offset={`${(i / (JOURNEY.length - 1)) * 100}%`} stopColor={j.color} />)}
          </linearGradient>
        </defs>
        <rect x={step / 2} y="44" width={w - step} height="10" rx="5" fill="url(#road)" />
        {JOURNEY.map((j, i) => {
          const cx = step / 2 + i * step;
          return (
            <g key={j.n}>
              <circle cx={cx} cy="49" r="24" fill={j.color} stroke="var(--surface)" strokeWidth="4" />
              <text x={cx} y="56" textAnchor="middle" fontSize="20" fontWeight="800" fill="#fff">{j.n}</text>
              <text x={cx} y="98" textAnchor="middle" fontSize="13.5" fontWeight="800" fill="var(--ink)">{j.label}</text>
              <text x={cx} y="116" textAnchor="middle" fontSize="11.5" fill="var(--ink-3)">{j.sub}</text>
            </g>
          );
        })}
      </svg>
      {/* phones: the same road, standing up */}
      <ol className="m-0 list-none p-0 min-[760px]:hidden">
        {JOURNEY.map((j, i) => (
          <li key={j.n} className="relative flex items-center gap-3 pb-4 last:pb-0">
            {i < JOURNEY.length - 1 && <span className="absolute left-[19px] top-10 h-[calc(100%-26px)] w-[3px] rounded" style={{ background: `linear-gradient(${j.color}, ${JOURNEY[i + 1].color})` }} />}
            <span className="relative grid h-10 w-10 flex-none place-items-center rounded-full text-[17px] font-extrabold text-white" style={{ background: j.color }}>{j.n}</span>
            <span><b className="block text-[14.5px] text-[var(--ink)]">{j.label}</b><span className="text-[12.5px] text-[var(--ink-3)]">{j.sub}</span></span>
          </li>
        ))}
      </ol>
    </>
  );
}

/* ---------- 2. set-up progress graph ---------- */

const CHECKS = [
  { label: "Add venue", color: C.venue, ticks: "a venue is saved" },
  { label: "Create block", color: C.block, ticks: "a block is saved" },
  { label: "Create listing", color: C.listing, ticks: "a listing exists" },
  { label: "Get paid", color: C.billing, ticks: "bank details are saved" },
  { label: "Cancellations", color: C.cancel, ticks: "the policy is saved or reviewed" },
];

function ProgressGraph() {
  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between gap-2">
        <b className="text-[15px] text-[var(--ink)]">The checklist bar fills one fifth at a time</b>
        <span className="text-[12.5px] text-[var(--ink-3)]">0 of 5 &rarr; 5 of 5</span>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1.5" role="img" aria-label="Progress bar split into five coloured segments: venue, block, listing, get paid, cancellations">
        {CHECKS.map((c, i) => (
          <div key={c.label} className="min-w-0">
            <div className="h-5 rounded-md" style={{ background: c.color, opacity: 0.35 + i * 0.13 }} />
            <div className="mt-1 text-[11.5px] font-extrabold leading-tight" style={{ color: c.color }}>{i + 1}. {c.label}</div>
            <div className="hidden text-[11.5px] leading-snug text-[var(--ink-3)] min-[560px]:block">ticks when {c.ticks}</div>
          </div>
        ))}
      </div>
      <p className="m-0 mt-3 text-[13px] leading-relaxed text-[var(--ink-2)]">
        The checklist hides for good once a listing exists <b>and</b> a booking has come in, or when the provider presses Hide. The top banner on every page shows the same count and the next job. Company and franchise accounts get a sixth job, Invite your team.
      </p>
    </Card>
  );
}

/* ---------- 3. money pictures ---------- */

function MoneyFlow() {
  const box = (x: number, y: number, w: number, color: string, t1: string, t2: string) => (
    <g>
      <rect x={x} y={y} width={w} height="64" rx="14" fill={tint(color, 18)} stroke={color} strokeWidth="2" />
      <text x={x + w / 2} y={y + 28} textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--ink)">{t1}</text>
      <text x={x + w / 2} y={y + 48} textAnchor="middle" fontSize="11.5" fill="var(--ink-3)">{t2}</text>
    </g>
  );
  const arrow = (x1: number, y1: number, x2: number, y2: number, color: string, label: string, ly: number) => (
    <g>
      <defs><marker id={`ah-${color.slice(1)}`} markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9z" fill={color} /></marker></defs>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="3.5" strokeLinecap="round" markerEnd={`url(#ah-${color.slice(1)})`} />
      <text x={(x1 + x2) / 2} y={ly} textAnchor="middle" fontSize="12" fontWeight="700" fill={color}>{label}</text>
    </g>
  );
  return (
    <Card className="overflow-x-auto p-3 sm:p-4">
      <svg viewBox="0 0 900 336" className="w-full min-w-[640px]" role="img" aria-label="Who pays whom: the provider pays the platform a monthly plan after a seven day free trial; parents pay the provider directly by card to the provider's Stripe account, or by bank transfer, Tax-Free Childcare or vouchers into the provider's bank account">
        {box(30, 30, 190, C.billing, "Provider", "pays for the plan")}
        {box(680, 30, 190, C.checklist, "The platform", "never holds booking money")}
        {arrow(228, 62, 672, 62, C.billing, "from £29 a month + VAT, after a 7-day free trial", 48)}

        {box(30, 230, 190, C.venue, "Parents", "book and pay")}
        {box(340, 160, 230, C.golive, "Provider's own Stripe", "cards, Apple Pay, Google Pay")}
        {box(340, 262, 230, C.block, "Provider's bank account", "bank transfer, Tax-Free Childcare, vouchers")}
        {arrow(228, 250, 332, 200, C.golive, "card", 212)}
        {arrow(228, 270, 332, 292, C.block, "bank / benefits", 322)}
        <text x="745" y="205" textAnchor="middle" fontSize="12.5" fontWeight="800" fill="var(--ink)">No cut of bookings</text>
        <text x="745" y="224" textAnchor="middle" fontSize="12" fill="var(--ink-3)">The provider pays only</text>
        <text x="745" y="241" textAnchor="middle" fontSize="12" fill="var(--ink-3)">Stripe&apos;s own card fees</text>
      </svg>
    </Card>
  );
}

function PayMethods() {
  const col = (color: string, title: string, pay: string, items: string[], dest: string) => (
    <div className="rounded-2xl border-2 p-4" style={{ borderColor: tint(color, 50), background: tint(color, 7) }}>
      <div className="text-[17px] font-extrabold text-[var(--ink)]" style={display}>{title}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">{items.map((i) => <Pill key={i} color={color}>{i}</Pill>)}</div>
      <p className="m-0 mt-3 text-[14px] leading-relaxed text-[var(--ink-2)]">{pay}</p>
      <p className="m-0 mt-2 text-[12.5px] font-bold" style={{ color }}>Lands in: {dest}</p>
    </div>
  );
  return (
    <div className="grid grid-cols-1 gap-3 min-[720px]:grid-cols-2">
      {col(C.golive, "Card payments", "Parents see the card form once the provider has finished card set-up. Apple Pay and Google Pay appear automatically on phones and browsers that support them.", ["Cards", "Apple Pay", "Google Pay"], "the provider's own Stripe account, then their bank")}
      {col(C.block, "Bank and benefits", "For bank transfer, parents see the details on the confirmation screen straight after booking, in their booking email and in My bookings, quoting their booking reference. Tax-Free Childcare and vouchers show the details set in Setup, Childcare vouchers. The bank details are never shown on a public pay link, and the provider marks the payment received. This is why bank details are compulsory. These options show when the provider has switched them on, per listing in the editor or by default under Setup, Payments.", ["Bank transfer", "Tax-Free Childcare", "Vouchers"], "the provider's bank account")}
    </div>
  );
}

/** Trial and billing timeline: days 0 to 21, then the failed-payment path underneath. */
function PlanTimeline() {
  const x = (d: number) => 50 + d * 30; // day -> px
  return (
    <Card className="overflow-x-auto p-3 sm:p-4">
      <svg viewBox="0 0 880 250" className="w-full min-w-[640px]" role="img" aria-label="Plan timeline. Days 0 to 7 are the free trial, with no charge. On day 7 the first monthly charge is taken. If a payment fails there is a 14 day grace period, then the account becomes read-only while data and safety records are kept">
        <text x="50" y="22" fontSize="13" fontWeight="800" fill="var(--ink)">A normal month</text>
        <rect x={x(0)} y="34" width={x(7) - x(0)} height="34" rx="8" fill={C.open} />
        <text x={(x(0) + x(7)) / 2} y="56" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">7-day free trial · no charge</text>
        <rect x={x(7) + 3} y="34" width={x(21) - x(7) - 3} height="34" rx="8" fill={C.billing} />
        <text x={(x(7) + x(21)) / 2} y="56" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">Paid plan · from £29 + VAT a month</text>
        {[0, 7, 14, 21].map((d) => (
          <g key={d}>
            <line x1={x(d)} y1="72" x2={x(d)} y2="82" stroke="var(--ink-3)" />
            <text x={x(d)} y="97" textAnchor="middle" fontSize="12" fill="var(--ink-3)">{d === 0 ? "Go live" : `Day ${d}`}</text>
          </g>
        ))}
        <text x={x(7)} y="115" textAnchor="middle" fontSize="12" fontWeight="800" fill={C.billing}>first charge</text>

        <text x="50" y="150" fontSize="13" fontWeight="800" fill="var(--ink)">If a payment fails</text>
        <rect x={x(7)} y="162" width={x(21) - x(7)} height="34" rx="8" fill={C.cancel} />
        <text x={(x(7) + x(21)) / 2} y="184" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">14-day grace · everything still works</text>
        <rect x={x(21) + 3} y="162" width={830 - x(21) - 3} height="34" rx="8" fill="#b3261e" />
        <text x={(x(21) + 3 + 830) / 2} y="184" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">Read-only · data kept</text>
        <text x={x(7)} y="218" textAnchor="middle" fontSize="12" fill="var(--ink-3)">payment fails</text>
        <text x="830" y="218" textAnchor="end" fontSize="12" fill="var(--ink-3)">paying again unlocks it</text>
        <text x="830" y="236" textAnchor="end" fontSize="12" fill="var(--ink-3)">safety records stay open throughout</text>
      </svg>
    </Card>
  );
}

/* ---------- 4. emails ---------- */

const EMAILS: { when: string; what: string; skip: string; color: string }[] = [
  { when: "Straight after sign-up", what: "Welcome and the four first jobs", skip: "Sent once", color: C.signup },
  { when: "Day 1", what: "Build your first listing", skip: "Skipped if a listing exists", color: C.venue },
  { when: "Day 3", what: "Your checklist, open steps only", skip: "Skipped if a listing exists and payment is set up", color: C.listing },
  { when: "Day 5", what: "You are nearly live: only what is left", skip: "Skipped if a listing is live", color: C.golive },
  { when: "3 days before the trial ends", what: "Trial ending, card will be charged", skip: "Only while a trial is running", color: C.billing },
  { when: "Each payment", what: "One receipt, in the provider's name", skip: "The card processor's own receipt is off", color: C.open },
];

function EmailTimeline() {
  return (
    <ol className="m-0 grid list-none gap-0 p-0 min-[820px]:grid-cols-6">
      {EMAILS.map((e) => (
        <li key={e.when} className="relative min-w-0 border-t-[4px] pb-2 pr-3 pt-3 min-[820px]:pr-2" style={{ borderTopColor: e.color }}>
          <span className="absolute -top-[9px] left-0 h-[14px] w-[14px] rounded-full border-2 border-[var(--surface)]" style={{ background: e.color }} />
          <b className="block text-[13.5px] leading-tight text-[var(--ink)]">{e.when}</b>
          <span className="mt-0.5 block text-[13px] leading-snug text-[var(--ink-2)]">{e.what}</span>
          <span className="mt-1.5 inline-block rounded-md px-1.5 py-0.5 text-[11.5px] font-bold leading-tight" style={{ background: tint(e.color, 14), color: e.color }}>{e.skip}</span>
        </li>
      ))}
    </ol>
  );
}

/* ---------- the page ---------- */

function Page1() {
  return (
    <>
      <div className="overflow-hidden rounded-3xl px-5 py-7 text-white sm:px-8 sm:py-9" style={{ background: "linear-gradient(120deg, #1d3a8f, #2f6bd8 55%, #6d4bd8)" }}>
        <div className="text-[12px] font-extrabold uppercase tracking-[.14em] text-white/70">HQ manual · page 1</div>
        <h1 className="m-0 mt-1 text-[30px] font-extrabold leading-tight sm:text-[40px]" style={display}>How a new provider gets set up</h1>
        <p className="m-0 mt-2 max-w-[62ch] text-[15.5px] leading-relaxed text-white/85">
          From the first sign-up screen to parents booking: every screen a provider sees, in the real order, with what to do, what ticks the step off and the mistakes to watch for.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["5 sign-up steps", "5 checklist jobs", "3-step Go live pop-up", "7-day free trial"].map((t) => (
            <span key={t} className="rounded-full bg-white/18 px-3 py-1 text-[13px] font-bold">{t}</span>
          ))}
        </div>
      </div>

      <Section>
        <H2>The whole journey on one line</H2>
        <Lede>Each colour is one stage, and the same colour is used for its section below.</Lede>
        <Card className="p-3 sm:p-5"><Journey /></Card>
        <div className="mt-4"><ProgressGraph /></div>
      </Section>

      <Stage n="1" color={C.signup} title="Sign up" tag="5 short steps · no money questions"
        facts={[
          { k: "What they see", v: "A card with a progress bar: choose Freelancer, Company or Franchise Head Office; business details; how parents see them; how they heard about us; then email and password." },
          { k: "What to do", v: "Fill each step and press Continue. The how-did-you-hear step needs one pick. Tick the terms box on the last step and press Create account." },
          { k: "What happens next", v: "They land on the dashboard with the set-up checklist. No card, no bank details and no Stripe at sign-up." },
          { k: "Common mistakes", v: "Franchise branches do not sign up here: the head office sends them an invite link. A parent picks the small \"I'm a parent\" link instead." },
        ]}
        shots={[
          { src: "signup-1-type", alt: "Sign-up step 1: choose how you will use the platform", caption: "Step 1 · who you are" },
          { src: "signup-2-business", alt: "Sign-up step 2: about your business", caption: "Step 2 · business details" },
          { src: "signup-3-how-parents-see-you", alt: "Sign-up step 3: how parents see you", caption: "Step 3 · name and logo" },
          { src: "signup-4-how-did-you-hear", alt: "Sign-up step 4: how did you hear about us", caption: "Step 4 · how they heard" },
          { src: "signup-5-your-login", alt: "Sign-up step 5: your login", caption: "Step 5 · email and password" },
        ]} />

      <Stage n="2" color={C.checklist} title="The dashboard checklist" tag="Five jobs, in order"
        facts={[
          { k: "What they see", v: "\"Get set up to take bookings\" with a progress bar and five numbered jobs. The next job has a blue outline and a button." },
          { k: "What to do", v: "Press the button on the highlighted job. Every job ticks itself when the real thing is saved, so there is nothing to tick by hand." },
          { k: "Stays with them", v: "A slim banner on every page shows the count and the next job, with a Continue button. It can be hidden for the day." },
          { k: "Hides when", v: "A listing exists and a booking has come in, or the provider presses Hide." },
          { k: "Companies and franchises", v: "They see a sixth job, Invite your team. Freelancers do not." },
        ]}
        shots={[{ src: "dashboard-0-of-5", alt: "Dashboard checklist showing 0 of 5 done", caption: "A brand-new provider: 0 of 5" }]} />

      <Stage n="3" color={C.venue} title="Add your venue" tag="Checklist job 1"
        facts={[
          { k: "What they see", v: "Blocks & listings opens on the Locations tab with the add-a-venue form already open." },
          { k: "What to do", v: "Type a postcode or address and press Find. The venue name fills in from the address and can be edited. Press Add." },
          { k: "What ticks it", v: "One venue saved. Online-only providers can use Add online instead." },
          { k: "The green prompt", v: "\"Venue added. Ready for the next step: Create a block?\" Press the gold button to move on, or \"Not yet, I want to add more venues\" to stay and add another. Not yet hides the box for that visit only." },
          { k: "Common mistakes", v: "Skipping the address search, so the map pin is missing. Typing the venue name before searching is fine: it is never overwritten." },
        ]}
        shots={[
          { src: "venue-add-form", alt: "Add a venue form", caption: "The form opens ready to use" },
          { src: "venue-added-prompt", alt: "Venue added, with the next-step prompt", caption: "After saving: next step, or add more" },
        ]} />

      <Stage n="4" color={C.block} title="Create a block" tag="Checklist job 2"
        facts={[
          { k: "What they see", v: "Three columns: make your periods, make your passes, build your blocks. A block is the dates, passes and prices built once and reused." },
          { k: "What to do", v: "Add a period (for example Full day, 9:00 to 15:30), add a pass (for example Day pass, 1 day), press Add to block on each, name the block and Move to Block Library. Set the prices with the pricing calculator." },
          { k: "What ticks it", v: "One block in the Block Library." },
          { k: "The green prompt", v: "\"Block created. Ready for the next step: Create and publish your first listing?\" or \"Not yet, I want to add more blocks\"." },
          { k: "Common mistakes", v: "A block with no priced passes: the listing then cannot be published." },
        ]}
        shots={[
          { src: "blocks-empty", alt: "Blocks tab with periods, passes and blocks", caption: "Periods, then passes, then blocks" },
          { src: "block-created-prompt", alt: "Block created, with the next-step prompt", caption: "After the first block" },
        ]} />

      <Stage n="5" color={C.listing} title="Create and publish a listing" tag="Checklist job 3 · 13 steps"
        facts={[
          { k: "What they see", v: "An empty Listings tab, then a 13-step guided editor with a progress bar. Step 1 opens with a box, \"What you need before you publish\", listing the venue and a block with priced passes." },
          { k: "What to do", v: "Step 1 Basics: title and photo. Step 2 Details: the venue (and which payment methods this listing accepts). Step 7 When it runs: the dates. Step 8 Tickets & pricing: press Use this block, which brings its passes and prices. Everything else (capacity, content, safety, discounts, add-ons, staff) can be filled in now or later. Step 13 Policy & publish has the Publish button." },
          { k: "What stops Publish", v: "The Publish button shows how many things are left, for example Publish (4). Step 13 opens with a box, \"Before this can be published\", listing each missing item with a link to its step. A title, a venue, the dates and a block with passes are required. Capacity is optional." },
          { k: "What ticks it", v: "A listing exists. It counts once saved, even as a draft, but parents only see it after Publish." },
          { k: "The green prompt", v: "Appears on the Listings tab when the listing job is done and shows the next job." },
          { k: "Common mistakes", v: "Choosing no block: the editor says \"Pick a block so the listing has passes and prices\" and the link in that box jumps to step 8." },
          { k: "Dates on My listings", v: "Each listing card shows its dates on the left. The year is added whenever it is not this year, for example Aug 2006, so a mistyped year stands out straight away. Listings in the current year show just the day and month. A listing whose dates are all in the past is not shown to parents." },
          { k: "Home visits", v: "If the listing is delivered by home visit, the travel area is set on step 2: see stage 7f, Home visits." },
        ]}
        shots={[
          { src: "listings-empty", alt: "Empty listings tab", caption: "New listing starts here" },
          { src: "listing-wizard-step-1", alt: "Listing editor, step 1 of 13", caption: "Step 1 of 13 · basics and what is needed" },
          { src: "listing-step-2-details", alt: "Listing editor, step 2: details and venue", caption: "Step 2 · pick the venue" },
          { src: "listing-step-7-when-it-runs", alt: "Listing editor, step 7: when it runs", caption: "Step 7 · dates and days" },
          { src: "listing-step-8-tickets-and-block", alt: "Listing editor, step 8: tickets and pricing with the block chosen", caption: "Step 8 · choose the block" },
          { src: "listing-step-13-policy-and-publish", alt: "Listing editor, step 13: policy and publish", caption: "Step 13 · policy and Publish" },
        ]} />

      <Stage n="6" color={C.golive} title="Go live: three single steps" tag="New providers only"
        facts={[
          { k: "When it appears", v: "When a new provider presses Publish and the plan or bank details are not done yet. Once both are done, Publish goes straight through. Accounts that predate this flow, and franchise branches (which ride on head office's plan), are never held up." },
          { k: "Step 1 · free trial", v: "Add a card to start the 7-day free trial. It opens in a new tab and ticks itself when they return. Nothing is charged until the trial ends." },
          { k: "Step 2 · bank details (required)", v: "Bank name, sort code and account number. Parents who choose bank transfer are shown them after they book, and they are printed on invoices (see \"When parents see your bank details\", under Billing & payouts). Below it, card payments through Stripe are optional and recommended, and can be done later." },
          { k: "Step 3 · reply-to", v: "Where parents' replies go. It is filled in from their login email. They press Save, then Go live." },
          { k: "Enforced by the server", v: "Publishing without a started plan or saved bank details is refused, so no other screen can skip this." },
          { k: "Common mistakes", v: "Closing the pop-up with Not yet: the listing stays saved as a draft and the pop-up returns at the next Publish." },
        ]}
        shots={[
          { src: "golive-1-free-trial", alt: "Go live pop-up, step 1: start your free trial", caption: "Step 1 · free trial card" },
          { src: "golive-2-bank-details", alt: "Go live pop-up, step 2: bank details", caption: "Step 2 · bank details, with optional card payments" },
          { src: "golive-3-reply-to", alt: "Go live pop-up, step 3: where replies go", caption: "Step 3 · reply-to, then Go live" },
        ]} />

      <Stage n="6b" color={C.golive} title="Where parents' replies go" tag="Go live step 3 · welcome email item 3"
        facts={[
          { k: "What it is", v: "When a parent replies to any email the platform sends in the provider's name (booking confirmation, receipts, reminders, messages), the reply goes to this one address, not to a no-reply box." },
          { k: "Where it comes from", v: "It is the contact email saved on the account. It starts as the provider's login email at sign-up, and they confirm it in Go live step 3. If that is ever empty, the platform falls back to an address on the provider record, and last of all to the owner's login email, so a reply never goes nowhere." },
          { k: "How to change it", v: "Type a new address in Go live step 3 and press Save, or later in Setup, Company setup, in the Email field. It applies to every email sent from then on." },
          { k: "Why we ask", v: "It must be an inbox the provider actually reads. A parent who asks a question or cancels by replying to an email is writing to this address, so a dead address means missed families." },
          { k: "Where the provider is reminded", v: "Go live step 3, and item 3 of the welcome email (\"Check where replies go\")." },
        ]}
        shots={[
          { src: "golive-3-reply-to", alt: "Go live pop-up, step 3: where replies go", caption: "Go live step 3 · the address is filled in, press Save" },
          { src: "/manual/emails/01-welcome-desktop.jpg", alt: "Welcome email with the Check where replies go item", caption: "Welcome email · item 3, Check where replies go" },
        ]} />

      <Stage n="7" color={C.billing} title="Billing & payouts" tag="Checklist job 4"
        facts={[
          { k: "What they see", v: "One page, two tabs. \"Your plan\" is what they pay the platform. \"Get paid by parents\" is how parents pay them." },
          { k: "Get paid by parents", v: "Bank details at the top (required). Then Connect Stripe for cards, Apple Pay and Google Pay. Stripe's own page opens, they enter identity, business and bank details, and they come back here." },
          { k: "What ticks it", v: "Bank details saved. Connecting Stripe is optional for the tick but is what makes the card option appear for parents." },
          { k: "The green prompt", v: "\"Payments set up. Ready for the next step: Set your cancellation policy?\" or \"Not yet, I want to change something here\"." },
          { k: "Your plan tab", v: "Shows the free trial, the current plan and price, change plan and cancel. A plan can be started here any time before Go live." },
          { k: "Have ready for Stripe", v: "Photo ID, business details and a bank account in the owner's own name. It takes about ten minutes." },
        ]}
        shots={[
          { src: "billing-get-paid", alt: "Billing and payouts, get paid by parents tab", caption: "Get paid by parents" },
          { src: "billing-your-plan", alt: "Billing and payouts, your plan tab", caption: "Your plan" },
        ]} />

      <Stage n="7b" color={C.billing} title="When parents see your bank details" tag="Billing & payouts · bank transfer"
        facts={[
          { k: "1 · Before they choose", v: "Never. The public booking page only learns yes or no: can this provider take bank transfers. Bank transfer appears under How you'll pay only when bank details are saved and Bank transfer is switched on for the provider and the listing. The numbers are not sent to the page." },
          { k: "2 · When they pick Bank transfer", v: "Still not on the screen. The button reads Confirm booking, the amount, to pay by bank transfer. The details come after the booking exists, because that is when the booking reference exists to quote." },
          { k: "3 · Straight after they confirm", v: "The confirmation screen shows bank name, account name, sort code, account number and their own booking reference. It does not show for a booking waiting for the provider's approval or for a waiting-list place." },
          { k: "4 · In the confirmation email", v: "The same panel is in the Booking confirmed email sent when the booking is confirmed. If the provider approves bookings by hand, the later approved email does not repeat the numbers; the parent finds them in My bookings." },
          { k: "5 · In My bookings", v: "On that booking, any time until it is paid. It goes once the booking is paid, cancelled, declined or waitlisted. Only the signed-in parent who made the booking sees it." },
          { k: "Invoices", v: "Invoices the provider sends print the bank details at the foot." },
          { k: "Never on a pay link", v: "The public pay link says the details are in the booking email and under My bookings, and shows only the reference to quote. Anyone holding the link sees no account numbers." },
          { k: "Tax-Free Childcare and vouchers", v: "These do not use this panel. They show the account, Ofsted and reference details the provider enters in Setup, Childcare vouchers, in the same places (confirmation screen and email)." },
        ]}
        shots={[
          { src: "bank-1-method-choice", alt: "Checkout, How you'll pay: Bank transfer chosen, no bank details yet", caption: "2 · Pay step with Bank transfer chosen: no account numbers yet" },
          { src: "bank-2-confirmation", alt: "Confirmation screen showing the bank details and reference", caption: "3 · Straight after Confirm booking: details and the parent's own reference" },
          { src: "bank-4-email", alt: "Booking confirmed email with the bank transfer panel", caption: "4 · The Booking confirmed email carries the same panel" },
          { src: "bank-3-my-bookings", alt: "My bookings showing the bank details on the unpaid booking", caption: "5 · My bookings, on the unpaid booking, until it is paid" },
          { src: "bank-5-pay-link", alt: "Public pay link page: reference only, no account numbers", caption: "Never · the public pay link shows the reference only" },
        ]} />

      <Stage n="7c" color={C.listing} title="Put booking on your website" tag="Optional · Blocks & listings, Embed button"
        facts={[
          { k: "What it does", v: "A provider pastes one line of code into their own website (Wix, WordPress, Squarespace or plain HTML). Visitors book and pay without leaving it. Payments still go to the provider's own account." },
          { k: "Two kinds of code", v: "Whole storefront: one code that shows every live listing as a grid. Individual listing: one code per live listing, for a Book button on just that activity. Each can be a button that opens booking in a window, or booking shown on the page." },
          { k: "Live listings only", v: "The panel offers a code only for listings that are live: not drafts, not ended, not archived. A draft shows one line, \"Publish a listing to get its embed code\"." },
          { k: "It updates by itself", v: "The storefront code reads the live listings every time a visitor loads the page, so a listing appears the moment it goes live and disappears when it ends or is unpublished. Nobody pastes it again. A listing's own code starts working the moment that listing goes live; before then, and after it ends, visitors see a friendly \"This booking isn't open right now\" message, not an error." },
          { k: "Where to find it", v: "Blocks & listings, the Embed button at the top for the storefront, or the Embed option on a listing's menu (it opens the same panel on that listing). Choose button text and colour, press Copy code, and use \"Test it on a sample page\" to see it working before pasting." },
          { k: "What parents see", v: "A button (or the booking page) on the provider's site. They sign in or create an account inside the window, pick dates and pay with the methods the provider has switched on, including Apple Pay and Google Pay where available." },
        ]}
        shots={[
          { src: "embed-panel", alt: "The Add booking to your website panel", caption: "The panel: style options, the storefront code and a Copy button" },
          { src: "embed-panel-listing", alt: "The panel opened on one live listing", caption: "One code per live listing; opened from the listing's own Embed option" },
          { src: "embed-host-button", alt: "A Book now button on a provider's website", caption: "On the provider's website: the button" },
          { src: "embed-overlay-listing", alt: "The booking page opened over the website", caption: "Pressing it opens the real booking page over the site" },
          { src: "embed-overlay-store", alt: "The storefront grid inside the window", caption: "The storefront code: every live listing" },
          { src: "embed-inline-store", alt: "The storefront shown directly on the page", caption: "Booking shown on the page, sized to fit" },
          { src: "embed-not-open", alt: "The friendly not-open message", caption: "A draft or ended listing shows a kind message, not an error" },
        ]} />

      <Stage n="8" color={C.cancel} title="Set your cancellation policy" tag="Checklist job 5"
        facts={[
          { k: "What they see", v: "Not the full editor. The first visit from the checklist opens a short screen: \"We've chosen a common cancellation policy for you\". It shows the Standard policy as two coloured chips and one plain sentence: full refund a week ahead, half back at 48 hours, nothing after. Standard is also what a new listing starts on." },
          { k: "What to do", v: "Press Keep this and move on, and that is it. They can change it now (Change it now opens the full editor with four ready-made policies: Standard, Flexible, Strict and No refunds), or at any time later in Setup, Cancellations & refunds." },
          { k: "What ticks it", v: "Keep this and move on counts the checklist job as done and takes them to the next job, or back to the dashboard when none are left. Opening the editor and saving a policy ticks it too." },
          { k: "Good to know", v: "When a family cancels, the platform works out what they are owed from this policy and shows it. The provider always approves a refund. A card refund then goes back through Stripe; bank and cash refunds are settled directly by the provider (see Cancellations and refunds). Each listing can use a different policy." },
        ]}
        shots={[
          { src: "cancel-welcome", alt: "First visit to cancellations: a common policy has been chosen", caption: "First visit · the chosen policy, with Keep this and move on" },
          { src: "cancel-editor", alt: "Cancellations and refunds editor", caption: "After Change it now · the full editor, any time from Setup" },
        ]} />

      <Stage n="7d" color={C.billing} title="Paying by bank transfer, end to end" tag="Parent books · provider marks paid"
        visual={<StatusLadder />}
        facts={[
          { k: "1 · Parent books", v: "They pick Bank transfer. The booking is Confirmed straight away but Unpaid. They see the provider's bank details and their own reference, and get the Booking confirmed email with the same panel." },
          { k: "2 · Provider is told", v: "The new booking email and bell say \"awaiting bank transfer payment\". Inside the booking is a Pending payment box with the reference to look for on the bank statement." },
          { k: "3 · Money arrives, press Mark paid", v: "On Bookings there is a big green Mark paid button on the unpaid booking card itself, and the same button inside the booking. Pressing it asks to confirm, then the booking is Paid and the parent gets one Payment received email." },
          { k: "Finding them", v: "Bookings, Unpaid/invoiced, then the chips under it: Bank transfer, Card, Cash, vouchers and so on. The same chips sit under Unreconciled." },
          { k: "Reconciliation", v: "A bank transfer booking appears in Reconciliation under Bank transfer. Reconcile it there, or Undo if it was a mistake: the booking goes back to Unpaid and no email is sent." },
          { k: "Confirmed, Paid, Reconciled", v: "Three different things, shown on the right. Confirmed is the place. Paid is the money. Reconciled is someone matching it to a real payment." },
        ]} />

      <Stage n="7e" color={C.billing} title="Manual approval and card holds" tag="Money does not leave the parent until you approve"
        shots={[
          { src: "/manual/hold/01-request-received-page", alt: "What the parent sees after booking", caption: "The parent's confirmation: Request received, and a green box saying the card is held and nothing has been charged." },
          { src: "/manual/hold/03-request-received-email", alt: "Request received email (to the parent)", caption: "The email the parent gets once the card is held: your card has not been charged, and what happens if the provider declines or does not reply." },
          { src: "/manual/hold/02-provider-bell", alt: "The provider's bell", caption: "The provider's bell and email: the amount held and the deadline, with the warning that Stripe cancels the hold and the booking if nobody answers." },
        ]}
        facts={[
          { k: "Which bookings", v: "A listing set to Manual approval (Setup step: Booking approval), paid by card. A booking can also need approval on an auto-confirm listing, for example a child outside the age range: the same card hold applies. Bank transfer, cash, vouchers and free places are unchanged." },
          { k: "1 · Parent books", v: "A card form opens straight away with a yellow note: the card is held, not charged. The button says Hold £X on my card. Nothing is taken. The place is kept while the request waits." },
          { k: "2 · Provider is told", v: "Only once the card is really held. A bell and email say who, how much is held, and the deadline: approve or decline within 7 days. Until the card is entered the booking shows Waiting for card and cannot be approved." },
          { k: "3a · Provider approves", v: "The payment is taken from the held card, the booking becomes Confirmed and Paid, and the parent gets ONE message: booking approved and payment received. If Stripe says the hold has expired, nothing is taken and the booking goes back to Approval needed with a clear error." },
          { k: "3b · Provider declines or cancels", v: "The hold is released. Nothing is taken. The parent's email says nothing was taken from their account, and that their bank may show it as pending for a few days. A parent who cancels while it is held releases it too." },
          { k: "3c · Nobody answers", v: "Stripe only keeps a card hold for about 7 days. The provider gets a reminder with about 48 hours left. After that the hold is cancelled, no money moves, the booking is declined automatically, the place is freed and the family is told." },
          { k: "Card never entered", v: "If the family never enters their card, the request is cancelled automatically after 24 hours. It is never shown as approvable in the meantime." },
          { k: "Two children, one card", v: "One basket is one card and one hold, with one booking row per child. Approving takes the amount for the booking you approve. Stripe can only take a held payment once, so any other child still waiting loses the hold: when you approve that child later, the family pays the ordinary way (a pay link). Approve both together (or use bulk approve) to take everything in one go." },
          { k: "What you see on Bookings", v: "The status shows Approval needed with a Card held badge (or Waiting for card), and a yellow box with the amount and the deadline. Mark paid and Resend invoice are hidden while a card is held, because the payment is taken when you press Approve. Mark paid is also refused by the server for a held booking." },
          { k: "In Stripe", v: "A held card shows as Uncaptured, then Succeeded after approval. A declined or expired hold shows as Canceled with a net of £0.00. The payment lands in the provider's own Stripe account, so Stripe fees apply as normal on approval." },
        ]} />

      <Stage n="7f" color={C.billing} title="Home visits" tag="Travel area · who can see it · the family's address"
        facts={[
          { k: "Setting it up", v: "On the listing's Where & when step choose How sessions are delivered: Home visits (or Both, which is a venue plus home visits). A Coverage area box appears. Choose Postcode list (comma-separated districts you travel to, for example MK10, NW1, SW1 or TW9 1) or Radius from base (a base postcode and a number of miles). The listing cannot be published without a travel area." },
          { k: "Recognised as you type", v: "Each postcode you type shows a line under it: a green tick and the place, for example Recognised: Camden, Westminster, or a red cross with We can't find that postcode, please check it. A comma now stays where you type it, so a list like MK10, NW1 works as expected." },
          { k: "Your base postcode is private", v: "Parents never see your home address or your base postcode. They only ever see that the visit is a home visit." },
          { k: "Who can see the listing", v: "A signed-in parent whose saved postcode is outside your travel area does not see the listing at all: not in browse or search, not by its direct link, QR code or shared booking link. To them it behaves as if it does not exist. A parent with no saved postcode, or someone not signed in, still sees it and is refused at checkout if their address is outside the area. A family who already booked it can still open their own booking." },
          { k: "At checkout: the visit address", v: "The family is asked Is this the address you want us to come to? and shown the address saved on their account, with Yes and No buttons. Yes uses that address. No lets them type a different postcode, which is recognised live, for example Recognised: MK10 9NR · Broughton and Milton Keynes. If the saved or new address is outside your area they see Sorry, [your name] doesn't travel to this address, it's outside the area they cover, and they cannot pay. A family with no saved address goes straight to typing a postcode." },
          { k: "Notes for the visit", v: "An optional box asks Anything we should know to find you? (how to get there, parking, door or gate codes, pets). It is capped at 500 characters and only the provider sees it, including any codes the family type. It is not put in the family's own emails." },
          { k: "What you see", v: "The new-booking email, the bell, the booking, the Bookings list and the registers all show Home visit at [address], [postcode] · [area], plus the family's note (shortened in the list). The booking is checked again on the server, so a postcode outside your area is refused even if the screen was bypassed." },
          { k: "How it is labelled", v: "Every place a listing appears says how it is delivered. Online listings show 💻 Online. Home visits show 🏠 At your home to parents (🏠 Home visits on your My listings page), and Both shows 🏠 At your home or 📍 followed by the venue. Ordinary venue listings keep showing the venue. This covers the browse cards, the listing page, My bookings and the emails: online emails say Online and give the joining details, home-visit emails say At your home with the address. Dates also show the year when it is not this year." },
          { k: "Common mistakes", v: "Dates in the wrong year (the listing shows no sessions to parents), a radius too small for the base postcode, or a postcode list that starts with a space or a full postcode when you meant the district. If a parent says they cannot find your listing, check their saved postcode is inside your area." },
        ]} />

      <Stage n="8b" color={C.cancel} title="Cancellations and refunds" tag="Parent cancels · provider approves"
        visual={<RefundRoutes />}
        facts={[
          { k: "Parent's cancel screen", v: "It shows what they get back under the provider's policy: full, 50% or nothing, worked out by the server. They pick a reason, may add a note, and choose where a refund goes." },
          { k: "Refund choice", v: "Wallet credit, or back to how they paid. Paid by card: Back to my card. Paid by bank transfer: Back to my bank account. Paid by cash: Refunded by the provider. The send button is full width on phones." },
          { k: "Bank-paid bookings", v: "If a refund is due and they chose the bank, they must type account name, sort code and account number. It is required." },
          { k: "Provider is told", v: "A bell and email: the parent, the booking, the refund asked for and where it goes. It shows only the parent's own reason, not the platform's wording." },
          { k: "Provider approves or declines", v: "A card refund is made through Stripe on approval. Bank and cash refunds are settled directly: the provider pays the parent back themselves, then approves to record it. Wallet credit is added at once. The parent gets a Refund approved or Declined email." },
          { k: "If it was a mistake", v: "A wrong Mark paid or reconcile can be undone with Undo. It puts the booking back to Unpaid." },
          { k: "Bank details privacy", v: "The parent's bank details are stored in a separate record, never on the booking, and never in an email. The booking only carries the last 4 digits. The provider presses Reveal bank details: they show for 30 seconds, then are deleted. They are deleted on reveal and when the refund is approved or declined. Ones nobody opened are deleted after 30 days. If the provider misses them, they ask the parent again." },
        ]} />

      <Stage n="8c" color={C.cancel} title="Parents moving dates, and other notes" tag="Settings and small things"
        facts={[
          { k: "Let parents move their own dates", v: "Setup, Cancellations & refunds, Amending dates. It sits under Offer date changes at all and is ON by default. A move is only to another running date of the same listing with space. The provider gets a \"moved their dates\" notice. Switch it off and parents have to ask." },
          { k: "Payments go to the provider", v: "Card payments land in the provider's own Stripe account, not the platform's. Stripe takes the card, the platform never holds booking money." },
          { k: "A blocked first live payment", v: "A first live card payment on a new Stripe account can be blocked by Stripe itself, before the platform sees it. The checkout then says nothing was charged and to try again or use another card. If it keeps happening, check the account in Stripe." },
          { k: "Shared booking links", v: "A signed-out visitor who opens a shared booking link gets a Sign in / Create account pop-up up front, so they can book after." },
          { k: "Top bar", v: "A Listings tab sits next to Families and Contact." },
          { k: "Replies", v: "A parent's reply to any email goes to the provider's contact email (Reply-To). The sender parents see is the platform's own address until the rename." },
        ]} />

      <Stage n="9" color={C.open} title="Set up done: parents can book" tag="Checklist 5 of 5"
        facts={[
          { k: "What they see", v: "All five jobs ticked. The checklist and the top banner disappear after the first booking." },
          { k: "What parents see", v: "The published listing on Browse and on the provider's own link. The card option shows once Stripe is ready. Bank transfer, Tax-Free Childcare and vouchers show when the provider has switched them on, per listing in the editor or by default under Setup, Payments." },
          { k: "If something is open", v: "The checklist stays and the top banner keeps naming the next job." },
        ]}
        shots={[{ src: "dashboard-4-of-5", alt: "Dashboard checklist with four jobs done", caption: "Four of five done, one to go" }]} />

      <Section>
        <H2>Who pays whom</H2>
        <Lede>Two separate money flows that never mix. The provider pays the platform for the plan. Parents pay the provider directly, and the platform never holds booking money or takes a cut.</Lede>
        <MoneyFlow />
      </Section>

      <Section>
        <H2>What parents can pay with</H2>
        <PayMethods />
      </Section>

      <Section>
        <H2>The plan: trial, charge and grace</H2>
        <Lede>Nothing is charged for the first 7 days. After that the plan is charged monthly. A failed payment starts a 14-day grace period; after that the account becomes read-only, never deleted. If the plan is cancelled, or Stripe gives up collecting, the account locks and only the safety records stay open: registers, incidents, medication and child files.</Lede>
        <PlanTimeline />
      </Section>

      <Section>
        <H2>The emails a new provider gets</H2>
        <Lede>The day 1, 3 and 5 emails go to freelancer and company owners in their first six days. Every one checks at send time and is skipped if the provider has already done the thing, so a reminder never arrives after the action it reminds about, and the series stops once a listing is live. Each has an unsubscribe link; billing emails are always sent.</Lede>
        <Card className="p-4"><EmailTimeline /></Card>
        <H2>Which emails parents and providers get</H2>
        <Lede>All sent in the provider&apos;s name. A card booking is never confirmed by email before the card has gone through, and a held card is never described as paid: the parent is told it is held, not charged, until the provider approves.</Lede>
        <EmailsTable />
        <div className="h-4" />
        <H2>What the emails look like</H2>
        <Lede>The real templates, filled with example details. Flick through them, or click one to see it full size. The brand name shown inside these emails comes from one setting on the server and will change with the rename.</Lede>
        <div className="max-w-[760px]"><Gallery color={C.billing} shots={[
          { src: "/manual/emails/01-welcome-desktop", alt: "Welcome (to the provider)", caption: "Sent once, straight after sign-up. Lists the four first jobs." },
          { src: "/manual/emails/02-day1-desktop", alt: "Day 1: build your first listing", caption: "Day 1 after sign-up. Skipped if a listing already exists." },
          { src: "/manual/emails/03-day3-desktop", alt: "Day 3: your set-up checklist", caption: "Day 3. Shows only what is still open. Skipped if a listing exists and bank details are saved." },
          { src: "/manual/emails/04-day5-desktop", alt: "Day 5: you are nearly live", caption: "Day 5. Only if no listing is live yet, and only the steps that are left." },
          { src: "/manual/emails/05-trial-ending-desktop", alt: "Trial ending in 3 days", caption: "3 days before the trial ends, only while a trial is running. Also appears in the bell." },
          { src: "/manual/emails/06-payment-received-desktop", alt: "Payment received (to the parent)", caption: "One email per card payment, in the provider's name. The card processor's own receipt is off." },
          { src: "/manual/emails/07-booking-confirmed-desktop", alt: "Booking confirmed (to the parent)", caption: "Bank transfer, cash, free and voucher bookings, straight away. Unpaid bank transfers show the bank details and reference. Not sent for card bookings." },
        ]} /></div>
        <div className="mt-3 grid grid-cols-1 gap-3 min-[720px]:grid-cols-2">
          <Card className="p-3.5">
            <h3 className="m-0 mb-1 text-[16px] font-extrabold text-[var(--ink)]" style={display}>Where parents&apos; replies go</h3>
            <p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">To the reply-to address confirmed in Go live step 3, filled in from the provider&apos;s login email. Emails are sent from the platform&apos;s own verified address under the provider&apos;s business name, so there is nothing to set up. Parents see the platform&apos;s address as the sender until the rename.</p>
          </Card>
          <Card className="p-3.5">
            <h3 className="m-0 mb-1 text-[16px] font-extrabold text-[var(--ink)]" style={display}>One receipt per payment</h3>
            <p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">A parent gets one &quot;Payment received&quot; email per card payment, from the platform in the provider&apos;s name. The card processor&apos;s own receipt is switched off for bookings.</p>
          </Card>
        </div>
      </Section>
    </>
  );
}

/** Add future manual pages here. */
const MANUAL_PAGES: { id: string; label: string; render: () => ReactNode }[] = [
  { id: "provider-onboarding", label: "Page 1 · Provider onboarding", render: () => <Page1 /> },
  { id: "legal", label: "Page 2 · Legal documents", render: () => <ManualLegal /> },
];

export function ManualApp() {
  const [id, setId] = useState(MANUAL_PAGES[0].id);
  const page = MANUAL_PAGES.find((p) => p.id === id) ?? MANUAL_PAGES[0];
  return (
    <div className="min-w-0 pb-10 text-[var(--ink)]">
      <nav aria-label="Manual pages" className="mx-auto mb-5 flex max-w-[1240px] gap-2 overflow-x-auto pb-1">
        {MANUAL_PAGES.map((p) => {
          const on = p.id === page.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setId(p.id)}
              aria-current={on ? "page" : undefined}
              className="whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition-colors"
              style={on ? { background: C.checklist, borderColor: C.checklist, color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-2)", background: "var(--surface)" }}
            >
              {p.label}
            </button>
          );
        })}
      </nav>
      <article className="mx-auto max-w-[1240px]">{page.render()}</article>
    </div>
  );
}
