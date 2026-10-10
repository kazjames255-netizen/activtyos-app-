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
  /** A diagram shown above the screenshots. */
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
        <div className="min-w-0 min-[900px]:sticky min-[900px]:top-4 min-[900px]:self-start">{visual}{visual && shots && shots.length > 0 ? <div className="mt-4" /> : null}{shots && shots.length > 0 ? <Gallery shots={shots} color={color} /> : null}</div>
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
    { paid: "Bank transfer", choice: "Wallet, or ask the provider to send it by bank transfer", how: "The parent types name, sort code, account number. Approving records the refund. The provider sends it, then presses I've sent the refund.", c: C.golive },
    { paid: "Cash", choice: "Wallet, or ask for cash back", how: "Approving records it. Hand the cash back, then press I've sent the refund.", c: C.cancel },
    { paid: "Voucher / Tax-Free Childcare", choice: "Wallet, or ask for the voucher back", how: "Never goes to a bank. The provider returns it through the scheme, then presses I've sent the refund.", c: C.listing },
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
    { who: "Parent", c: C.block, what: "You're booked in ✓ — payment received (card)", when: "An automatic-confirm booking paid by card: ONE message once the card has gone through, saying the booking is confirmed AND paid (nothing is sent before it). A bank-transfer booking gets the ordinary \"Payment received\" when the provider presses Mark paid." },
    { who: "Parent", c: C.block, what: "We've got your booking request (card held)", when: "Manual-approval listing paid by card, sent once the card has been put on hold. It says: your card has NOT been charged, the amount is held, the payment is taken only if the provider approves, and if they decline or don't reply within 7 days the hold is released and you pay nothing." },
    { who: "Parent", c: C.block, what: "Booking approved and payment received", when: "When the provider approves a held booking. ONE message (email and bell): the booking is approved and the held amount has now been taken. No separate \"You're booked in\" email and no second receipt." },
    { who: "Parent", c: C.block, what: "Your booking request was declined", when: "When the provider declines. For a held card it says: nothing was taken from your account, the held amount has been released, and the bank may keep showing it as pending for a few days before it disappears. Any message the provider typed is included." },
    { who: "Parent", c: C.block, what: "Waiting list", when: "When they join the waiting list. Nothing is charged while they wait." },
    { who: "Parent", c: C.block, what: "A place is yours", when: "When a place opens for them: held for 2 hours, with one Accept and pay button. They pay only if they accept." },
    { who: "Parent", c: C.block, what: "Sorry, you missed out", when: "If the 2 hours run out. They are put back on the waiting list automatically (at the back of the queue), nothing charged, and told so." },
    { who: "Parent", c: C.block, what: "Booking cancelled (bell)", when: "When the provider (or the family) cancels. The bell reads \"Booking cancelled · APF-10330\" and says which activity, child and date, who cancelled and what happens to the money; the email carries the same details. A bulk cancel by the provider sends it to every family too." },
    { who: "Parent", c: C.block, what: "Refund approved, recorded, sent", when: "Card and wallet: one email when you approve. Bank, cash and voucher: \"Refund recorded, the provider will send it\", then a second email and bell when the provider presses I've sent the refund. Declined has its own email." },
    { who: "Parent", c: C.block, what: "Session reminder", when: "Once per booking, before its first booked day. A 30-day camp sends one, not 30. A single-day booking still gets its own." },
    { who: "Provider", c: C.billing, what: "New booking", when: "Each new booking, with every child, allergies and notes. Card bookings say \"awaiting card payment\"; bank transfer says \"awaiting bank transfer payment\", and the booking shows a Pending payment box." },
    { who: "Provider", c: C.block, what: "Cancellation request (bell and email)", when: "When a family cancels a booking: the bell reads \"Cancel request · APF-10330\" with the payment type and the refund asked for (for example \"Card · £0.30 refund\"); the email names the activity, the child, the day and the reason, with the Approve / Decline refund prompt." },
    { who: "Provider", c: C.billing, what: "Paid ✓ (bell and email)", when: "When a family's card payment lands: a bell and a short email, after the new-booking notice. The bell reads \"Paid ✓ · APF-10330\" with \"Card · £0.30 · Confirmed\"; the email adds the booker, activity and child. Not sent for a held card you approve." },
    { who: "Provider", c: C.billing, what: "Booking request: approve or decline by [date]", when: "Manual-approval booking with a held card: bell and email once the card is held. Shows the amount held and the deadline (7 days after the hold). If you have not answered by then, Stripe cancels the hold, nothing is taken and the booking is cancelled automatically." },
    { who: "Provider", c: C.billing, what: "Last chance to answer", when: "One reminder, bell and email, when about 48 hours are left to approve or decline a held booking. The bell reads \"Answer by · APF-10329\" with \"Card held · £0.30 · 14 Oct\"." },
    { who: "Provider", c: C.block, what: "Every provider bell is short and clean", when: "A bell is a fixed label plus the booking reference (\"New booking · APF-10334\"), then at most three short facts: payment type, cost, and one tag (Online, Home visit, \"2 extras\" or a date). Listing, children, notes and deadlines live in the email and on the booking." },
    { who: "Provider", c: C.billing, what: "Request expired", when: "Bell only, when a held booking ran out of time and was cancelled automatically." },
    { who: "Provider", c: C.billing, what: "A place has opened up", when: "Manual waiting list only: bell and email when a cancellation frees a place, linking to the booking and its Offer place button. Can be switched off in Setup, Email, Automatic emails; you must then check the list yourself. An Automatic waiting list needs no alert." },
    { who: "Provider", c: C.billing, what: "Cancellation request", when: "When a parent cancels. Short wording: the refund asked for, where it goes, and only the parent's own reason." },
    { who: "Provider", c: C.billing, what: "Refund to send (bell)", when: "Every 3 days until you press I've sent the refund. Names the method: Send £0.50 by bank transfer." },
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
      {col(C.block, "Bank and benefits", "Bank transfer details show on the confirmation screen, in the booking email and in My bookings, with the booking reference. Tax-Free Childcare and vouchers show the details from Setup, Childcare vouchers. Never on a public pay link. The provider marks the payment received. Shown when switched on, per listing or under Setup, Payments.", ["Bank transfer", "Tax-Free Childcare", "Vouchers"], "the provider's bank account")}
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
          { k: "What to do", v: "Step 1 Basics: title and photo. Step 2 Details: venue and payment methods. Step 7: the dates. Step 8: press Use this block for its passes and prices. The rest (capacity, safety, discounts, add-ons, staff) can wait. Step 13 has the Publish button." },
          { k: "What stops Publish", v: "The Publish button shows how many things are left, for example Publish (4). Step 13 opens with a box, \"Before this can be published\", listing each missing item with a link to its step. A title, a venue, the dates and a block with passes are required. Capacity is optional." },
          { k: "What ticks it", v: "A listing exists. It counts once saved, even as a draft, but parents only see it after Publish." },
          { k: "The green prompt", v: "Appears on the Listings tab when the listing job is done and shows the next job." },
          { k: "Common mistakes", v: "Choosing no block: the editor says \"Pick a block so the listing has passes and prices\" and the link in that box jumps to step 8." },
          { k: "Setup: Tax-Free Childcare provider details", v: "Setup, Childcare vouchers, starts with a Tax-Free Childcare card: registered name, regulator (Ofsted, CIW, Care Inspectorate or Other), registration number and registered postcode. HMRC needs these to pay you, so no childcare registration means no Tax-Free Childcare. Until complete, parents are not offered it at checkout." },
          { k: "Registers for a freelancer working alone", v: "A freelancer or owner takes registers as themselves: no staff record, rota entry or assignment, and you are not in Team, rota or payroll. Every register, incident and medicine entry says who took it. If your account name is only a login word like \"support\", Registers asks once for your real name." },
          { k: "Accidents: a bump to the head", v: "Choose \"Bump to the head\" (or name the head) on an accident report and the family is told at once by bell and email, with what to watch for: headache, vomiting, drowsiness, confusion. Sent once per report, even if you edit it. Only if the child is linked to a family account." },
          { k: "Medicines and confidential records", v: "Changing a consented medicine's name, dose or route clears the consent and asks the parent again; no doses until they agree. Two identical dose taps record one dose. A confidential record is never shared with the parent: a confidential accident tells them only that a record was made. A plan file cannot be changed once uploaded; a new upload needs a new booking before you can read it." },
          { k: "Parent data download", v: "Data & privacy > Download shows a parent what their own screens show, no more. A shared safeguarding concern keeps the lead's log, outcome and the child's own words out; medicines and doses leave out team emails and private notes; your own notes on a family stay with you." },
          { k: "Deleting a child: photos and plan access", v: "When a parent deletes a child, their photos and moments are removed within 30 days (a shared photo is removed too, other children stay tagged). Accident, safeguarding, register and medication records are kept. A provider can read a child's plan file until 90 days after the family's last confirmed place with them (waiting list, pending, cancelled or refunded bookings do not count); booking again restores it." },
          { k: "Incident reports: what families and files show", v: "A family sees only the text you chose to share, never who recorded a concern, the lead's log or outcome. Photos must be your own private uploads. Sending the same report twice in a minute saves it once. A case file needs the record linked to a child profile: it never matches by name. Notes on a confidential record send no text by email." },
          { k: "Staff onsite: you are listed first", v: "You are always listed first, with a bio you write once and reuse on every listing. A freelancer is assigned by default and can untick. If your name is just a role word like \"support\", add your real name first. Parents see name and bio, never your email." },
          { k: "Sharing a listing: the Link button", v: "The Link button on My listings offers two links, each with Copy and Open. Storefront is the full listing page. Quick book goes straight to the booking form. The QR button asks the same choice. A signed-out parent signs in first, then returns to the same link." },
          { k: "Running separate weeks", v: "Press \"+ Add another period\" to run, say, one week now and another in six months. Each period has its own From and To; nothing is created in between. The week list shows what will be created: tick or untick weeks, or Select all / none." },
          { k: "Dates must be in the future", v: "The date boxes on Where & when accept dates from today to three years ahead. Type the year in full; two digits become 20xx. A past date shows a red warning and Publish stays locked. The live service also refuses a listing whose dates have all passed." },
          { k: "Your business name on the page", v: "The preview and live page show Setup > Display name, then your business name, never your sign-in name. If neither is set, the preview says \"Your business\" with a link to Setup." },
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
          { k: "Where it comes from", v: "The contact email saved on the account. It starts as the login email and is confirmed in Go live step 3. If empty, the platform falls back to the provider record, then the owner's login email, so a reply never goes nowhere." },
          { k: "How to change it", v: "Type a new address in Go live step 3 and press Save, or later in Setup, Company setup, in the Email field. It applies to every email sent from then on." },
          { k: "Why we ask", v: "It must be an inbox the provider actually reads. A parent who asks a question or cancels by replying to an email is writing to this address, so a dead address means missed families." },
          { k: "Where the provider is reminded", v: "Go live step 3, and item 3 of the welcome email (\"Check where replies go\")." },
        ]}
        shots={[
          { src: "golive-3-reply-to", alt: "Go live pop-up, step 3: where replies go", caption: "Go live step 3 · the address is filled in, press Save" },
          { src: "/manual/emails/01-welcome-desktop", alt: "Welcome email with the Check where replies go item", caption: "Welcome email · item 3, Check where replies go" },
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
          { k: "Tax-Free Childcare: HMRC says no", v: "Every HMRC refusal becomes a plain screen with no error code; the booking stays Awaiting voucher payment, never marked paid. Covers: no account, blocked account, wrong reference or date of birth, provider not usable (check registration number and postcode in Setup), not enough funds. The parent can pay another way." },
          { k: "Tax-Free Childcare: paying at checkout", v: "When the platform is connected to HMRC, checkout asks HMRC to pay the provider straight after booking. The amount comes from the booking. A waiting-list place owes nothing, and nothing is sent twice. The booking shows HMRC's payment reference and expected date, and stays Awaiting voucher payment until the money arrives." },
          { k: "Pay by card instead", v: "A booking paid by bank transfer, cash, voucher or Tax-Free Childcare shows a 'Pay by card instead' button on My bookings and on the Payments page, because it opens a card form. A card booking just says Pay." },
          { k: "Money in and Expenses: monthly bars", v: "Both pages show month-by-month bars with a £ axis, gridlines and value labels. On Money in, the dashed bar is what was booked and the solid bar is what was collected, so the gap is money still to come." },
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
          { k: "It updates by itself", v: "The storefront code reads the live listings each time the page loads, so a listing appears when it goes live and disappears when it ends. Nobody pastes it again. A listing's own code works once that listing is live; before and after, visitors see \"This booking isn't open right now\", not an error." },
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
          { k: "Good to know", v: "When a family cancels, the platform works out what they are owed from this policy and shows it. The provider always approves a refund. A card refund goes back through Stripe; bank, cash and voucher refunds are only recorded, and the provider sends them (see Cancellations and refunds). Each listing can use a different policy." },
          { k: "Money in: refunded bookings stay in the list", v: "Money in > All income lists every booking that received money, including ones refunded to £0, so the list explains the Refunded tile. Each row has a status chip (Paid, Part refunded, Refunded, Refund awaiting transfer). The Show filter and Export CSV follow the same view, and net always equals the tile." },
        ]}
        shots={[
          { src: "cancel-welcome", alt: "First visit to cancellations: a common policy has been chosen", caption: "First visit · the chosen policy, with Keep this and move on" },
          { src: "cancel-editor", alt: "Cancellations and refunds editor", caption: "After Change it now · the full editor, any time from Setup" },
        ]} />

      <Stage n="7d" color={C.billing} title="Paying by bank transfer, end to end" tag="Parent books · provider marks paid"
        visual={<StatusLadder />}
        shots={[
          { src: "/manual/money/02-reconciliation-part-refunded", alt: "Reconciliation rows with a Part refunded chip", caption: "Reconciliation: a part-refunded booking shows a Part refunded chip with the amount." },
        ]}
        facts={[
          { k: "1 · Parent books", v: "They pick Bank transfer. The booking is Confirmed straight away but Unpaid. They see the provider's bank details and their own reference, and get the Booking confirmed email with the same panel." },
          { k: "2 · Provider is told", v: "The new booking email and bell say \"awaiting bank transfer payment\". Inside the booking is a Pending payment box with the reference to look for on the bank statement." },
          { k: "3 · Money arrives, press Mark paid", v: "On Bookings there is a big green Mark paid button on the unpaid booking card itself, and the same button inside the booking. Pressing it asks to confirm, then the booking is Paid and the parent gets one Payment received email." },
          { k: "Finding them", v: "Bookings, Unpaid/invoiced, then the chips under it: Bank transfer, Card, Cash, vouchers and so on. The same chips sit under Unreconciled." },
          { k: "Reconciliation: refunds", v: "Refunded bookings are listed too, with a status chip. Hide refunded removes them from the list, tab counts and Refunds panel, and is kept in the page address. The Refunds panel follows the method tab and filters. Refunded-only bookings never count as payments still to reconcile." },
          { k: "Reconciliation: money already handed back", v: "Money already handed back (wallet credit, a refund waiting to be sent, a refund made in Stripe) is not shown as overpaid. One cancelled day with the rest still held is Partially refunded and counts as settled." },
          { k: "Refunds made in Stripe", v: "A card refund made straight in Stripe shows on the booking as Refunded in Stripe, is netted off in Finance, and sends you one alert. The booking is not cancelled and no wallet credit is given. For older refunds press Check Stripe for refunds on Reconciliation. If you also approve the same refund, Approve asks first." },
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
          { k: "Two children, one card", v: "One basket is one card and one hold, with a booking row per child. Stripe can take a held payment only once, so approving one child releases the hold for the other: approve them later and the family pays by pay link. Approve both together, or bulk approve, to take everything at once." },
          { k: "What the family sees before and after", v: "The button reads \"Request a place, hold X on my card\", with a note that nothing is taken if you decline or do not reply. My bookings shows \"Card held, waiting for approval\", or Declined with nothing taken. A bank-transfer family gets Pay by card instead." },
          { k: "The request you receive", v: "The email and bell carry everything a normal new booking does (date, children, notes, address, money) plus the approve-by deadline. Approving twice takes the money once. A second child not yet paid gets \"Your booking is approved, please pay\". Recording a payment by hand against a held card is refused." },
          { k: "What you see on Bookings", v: "Approval needed with a Card held (or Waiting for card) badge, and a yellow box with the amount and deadline. Mark paid and Resend invoice are hidden while a card is held, because approving takes the payment; the server refuses Mark paid too." },
          { k: "In Stripe", v: "A held card shows as Uncaptured, then Succeeded after approval. A declined or expired hold shows as Canceled with a net of £0.00. The payment lands in the provider's own Stripe account, so Stripe fees apply as normal on approval." },
        ]} />

      <Stage n="7f" color={C.billing} title="Home visits" tag="Travel area · who can see it · the family's address"
        shots={[
          { src: "/manual/addons/01-provider-booking-extras", alt: "Booking page with the Extras block and an extra request", caption: "Booking page: the Extras block, and a family's request to change an extra." },
          { src: "/manual/addons/02-add-on-orders-day", alt: "Add-on orders day list", caption: "Add-on orders: one day, grouped by add-on, tick each when ready." },
          { src: "/manual/money/01-franchise-payouts-statement", alt: "Franchise payouts statement", caption: "Franchise payouts: the one-line sum behind what is owed." },
        ]}
        facts={[
          { k: "Setting it up", v: "On the listing's Where & when step choose Home visits (or Both). In Coverage area use a Postcode list (districts such as MK10, NW1) or a Radius from a base postcode and miles. The listing cannot be published without a travel area." },
          { k: "Recognised as you type", v: "Each postcode you type shows a line under it: a green tick and the place, for example Recognised: Camden, Westminster, or a red cross with We can't find that postcode, please check it. A comma now stays where you type it, so a list like MK10, NW1 works as expected." },
          { k: "Your base postcode is private", v: "Parents never see your home address or your base postcode. They only ever see that the visit is a home visit." },
          { k: "Who can see the listing", v: "A signed-in parent whose saved postcode is outside your area does not see the listing in browse or search. A direct link shows \"doesn't cover your area\", never your base postcode or radius. Signed-out parents still see it and are refused at checkout. Existing bookings stay open." },
          { k: "At checkout: the visit address", v: "The family is asked \"Is this the address you want us to come to?\" with their saved address. Yes uses it. No lets them type another: postcode (recognised live) plus house number or name and street. An address outside your area is refused and they cannot pay." },
          { k: "The family's full address is compulsory", v: "A parent cannot sign up or save their profile without a full home address: house number or name, street, town and a recognised postcode. Older accounts without a house number are not locked out: they get a weekly reminder, and the home-visit checkout asks for the missing part." },
          { k: "Notes for the visit", v: "An optional box asks Anything we should know to find you? (how to get there, parking, door or gate codes, pets). It is capped at 500 characters and only the provider sees it, including any codes the family type. It is not put in the family's own emails." },
          { k: "What you see", v: "The new-booking email, the bell, the booking, the Bookings list and the registers all show Home visit at [address], [postcode] · [area], plus the family's note (shortened in the list). The booking is checked again on the server, so a postcode outside your area is refused even if the screen was bypassed." },
          { k: "The date and the family's note stand out", v: "Every booking opens with a banner showing the real date and time, how far away it is, and \"at their home\" for a home visit; multi-day bookings list every day. The family's note (pets, parking, gate code) sits in a yellow box under the date." },
          { k: "The home-visit area must be real postcodes", v: "Every postcode in your travel area must be recognised: green Recognised or red \"can't find that postcode\". An unrecognised one blocks Publish, here and on the live service. Switching between the postcode list and the radius clears the other. Publishing with things missing saves a draft and lists what is missing." },
          { k: "Add-ons (extras): where they show", v: "An add-on is anything a family adds: a T-shirt with a size, a lunch. Providers see an Extras block per child on the booking, a chip on the Bookings list, the new-booking email and bell. Families see them in the confirmation email, My bookings and the receipt." },
          { k: "Add-ons on a listing", v: "The add-ons step has one switch: Offered on this listing or Not offered. When on, parents see an Extras available line. The banner Every day ticks every day of every pass. A size is needed for each day, or Same for all days. Quick book offers the same extras." },
          { k: "Quick book scope", v: "A franchise, and its staff, can only Quick book its own listings. Head office and sibling listings are refused." },
          { k: "Analytics: Gender split and how families add it", v: "Money > Analytics > Insights shows a Gender split of children who booked, each counted once. Families add it optionally on the child profile or at checkout. Never guessed, never emailed. A count under 5 shows as \"<5\"; when one is hidden a second is hidden too and the totals are withheld, so no single child can be picked out. The Setup switch \"collect gender\" is on by default." },
          { k: "Closed accounts and support view", v: "A parent who closes their account gets no marketing, reminders or provider-message emails and drops off every email list. Refund, payment and cancellation notices still reach them. Support opening an account as a family cannot download their data or file a deletion request, and every page it opens is logged." },
          { k: "Add-on orders: the day-by-day list", v: "Lists what to prepare, once there are live orders. Day tab: pick a day, filter by add-on or listing, tick items, Print. A one-off extra is due on day one, a daily extra every day. Month tab: counts per day. Message buttons contact families. The day-before reminder is on by default." },
          { k: "Finding bookings by date", v: "The Bookings list has two date filters. BOOKED is when the booking came in (Today, Yesterday, Last 7 days). EVENT DATE is when the child attends (Today, Tomorrow, This week, Next 7 or 30 days, one date, or a range). They combine; Reset clears both." },
          { k: "Money in: Awaiting payment", v: "The panel lists unpaid invoices you sent, plus bookings that hold a place, owe money and have a payment request out. Each row has Chase (reminder email) and View. If nothing was sent but a family owes, it links to Who owes you in Finance." },
          { k: "How it is labelled", v: "Every listing says how it is delivered: Online, At your home, or the venue. Browse shows a badge on the photo and a delivery filter (All types, At a location, At my home, Online); At my home or Online never hides listings for having no venue. Emails say the same." },
          { k: "Online sessions: how families join", v: "Choose how families join: the platform video room (default) or your own https:// link such as Zoom (Publish stays locked until it is). The Join button appears 10 minutes before the start, once the booking is paid and the host has started. Times are UK time." },
          { k: "Online sessions: who can join", v: "Only a paid booking unlocks the join link (Paid, a £0 funded place, or part-released after paying). Unpaid, invoice-sent, awaiting-voucher and part-paid stay locked; a bank-transfer family can use Pay by card instead. Attendance is recorded only inside the join window. If video rooms are not switched on, choose My own link." },
          { k: "Franchise payouts (head office)", v: "Money > Franchise payouts is a cash statement: money received and refunds given in the period. Head office keeps a percentage of card money and pays the franchise the rest; money the franchise took itself owes head office that percentage. Stripe fees are not deducted. Mark settled after the period ends; it cannot be edited. Franchises see only their own." },
          { k: "Common mistakes", v: "Dates in the wrong year (the listing shows no sessions to parents), a radius too small for the base postcode, or a postcode list that starts with a space or a full postcode when you meant the district. If a parent says they cannot find your listing, check their saved postcode is inside your area." },
        ]} />

      <Stage n="8b" color={C.cancel} title="Cancellations and refunds" tag="Parent cancels · provider approves"
        visual={<RefundRoutes />}
        shots={[
          { src: "/manual/money/05-checkout-wallet-credit-choice", alt: "Checkout asking whether to use wallet credit", caption: "Checkout: three choices for wallet credit." },
          { src: "/manual/money/04-parent-cancel-refund-choice", alt: "Cancel panel with the refund destination choice", caption: "Cancelling: wallet credit, or the original payment method." },
          { src: "/manual/money/03-refunds-to-send", alt: "Refunds to send list on Finance, Debts", caption: "Finance, Debts: Refunds to send, naming the method." },
          { src: "/manual/addons/03-parent-change-extras", alt: "Family panel to change or cancel an extra", caption: "My bookings: a family asks to change or cancel an extra." },
        ]}
        facts={[
          { k: "Parent's cancel screen", v: "It shows what they get back under the provider's policy: full, 50% or nothing, worked out by the server. They pick a reason, may add a note, and choose where a refund goes." },
          { k: "Wallet credit at checkout", v: "If a family has credit with a provider, checkout ASKS before using it: 'Use my credit', 'Don't use it, keep it for later' or 'Use part of it'. Nothing is applied until they choose and the Pay button stays off until then. A provider booking on behalf of a family never spends the family's credit." },
          { k: "Refund choice", v: "Wallet credit, or back the way they paid. Card: Back to my card. Cash, bank transfer or voucher: the choice names the method, for example \"Ask Acme to hand me my £5.00 cash back\". Wallet is pre-selected only if the provider runs a wallet and nothing was paid by card." },
          { k: "Refund on a part-wallet booking", v: "A refund is shared in proportion to what each source paid. Paid £30 wallet and £70 card, refund £50: £15 goes back to the wallet at once and £35 to the card. The policy sets the total. A refund the family takes as wallet credit stays all wallet." },
          { k: "Wallet shown on a booking", v: "A booking paid partly with wallet credit shows Price, Paid by wallet and To pay: on the booking, the list, My bookings, Payments, the email, the receipt and the CSV. Staff do not see it." },
          { k: "Bank-paid bookings", v: "If a refund is due and they chose the bank, they must type account name, sort code and account number. It is required." },
          { k: "Provider is told", v: "A bell and email: the parent, the booking, the refund asked for and where it goes. It shows only the parent's own reason, not the platform's wording." },
          { k: "Provider approves or declines", v: "A card refund goes back through Stripe when you approve. Wallet credit is added at once. A bank, cash or voucher refund is only recorded when you approve: send the money yourself, then press I've sent the refund. The family gets a Refund approved or Declined email." },
          { k: "Bank transfer refunds", v: "The app cannot send bank, cash or voucher refunds. Approving only records it: the booking shows \"Refund recorded, awaiting your transfer\" and the family is told. Send the money, then press \"I've sent the refund\" (or choose \"I've already sent it\" when approving). A bell reminds you every 3 days. Card and wallet refunds are instant." },
          { k: "Cash, bank transfer and voucher refunds name the method", v: "The booking, Refunds to send, the reminder bell and the confirm panel say how to send it: \"Send £0.50 by bank transfer\", \"Refund £0.50 owed: paid in cash\". A mix names each method. It counts as refunded only after you press I've sent the refund. Card and wallet refunds never show this." },
          { k: "If it was a mistake", v: "A wrong Mark paid or reconcile can be undone with Undo. It puts the booking back to Unpaid." },
          { k: "Changing or cancelling an extra", v: "A family asks from My bookings; you approve or decline, separate from cancelling the booking. Approving a cancel removes the extra and you choose refund, wallet credit or no refund. A size or colour change never changes the price. Requests close N days before the session (default 3, Setup > Cancellations & refunds > Amending dates); give one extra its own number in the listing editor, Add-ons step (off follows Setup)." },
          { k: "Extras when a booking is cancelled", v: "Extras go back only with a full refund or one that covers the whole booking (a day cancel: only the last day). Otherwise they are kept. The cancel screen does not ask yes or no yet." },
          { k: "Bank details privacy", v: "Stored in a separate record, never on the booking or in an email; the booking carries only the last 4 digits. Press Reveal bank details: they show for 30 seconds, then are deleted. They are also deleted when the refund is declined or sent. Unopened ones go after 30 days; if missed, ask the parent again." },
          { k: "Money: Card payouts (Stripe)", v: "Finance, Card payouts (Stripe) shows Stripe card payments only. Tiles: on the way (last 7 days), in your bank, estimated fees (about 1.4% + 20p per payment, kept even on refund) and card money kept. Refunded payments are struck through and count as £0. All figures are estimates, not your Stripe balance." },
          { k: "Reminders: Resend invoice and Chase", v: "Every reminder (Resend invoice, Chase on Finance > Debts, or automatic) goes in one log on the booking, so counts agree. The email numbers the reminder and the family's bell says Payment reminder. The booking shows \"Reminder sent 2x\". A second send within 30 seconds is refused; chasing within 24 hours asks you to confirm." },
        ]} />

      <Stage n="8c" color={C.cancel} title="Parents moving dates, and other notes" tag="Settings and small things"
        shots={[
          { src: "/manual/trips/01-trip-card-consent-warning", alt: "Trip card with consent pending and unlinked children", caption: "Trips: consent pending, and children not linked to a booking." },
        ]}
        facts={[
          { k: "Let parents move their own dates", v: "Setup, Cancellations & refunds, Amending dates. It sits under Offer date changes at all and is ON by default. A move is only to another running date of the same listing with space. The provider gets a \"moved their dates\" notice. Switch it off and parents have to ask." },
          { k: "Payments go to the provider", v: "Card payments land in the provider's own Stripe account, not the platform's. Stripe takes the card, the platform never holds booking money." },
          { k: "A blocked first live payment", v: "A first live card payment on a new Stripe account can be blocked by Stripe itself, before the platform sees it. The checkout then says nothing was charged and to try again or use another card. If it keeps happening, check the account in Stripe." },
          { k: "Shared booking links", v: "A signed-out visitor who opens a shared booking link gets a Sign in / Create account pop-up up front, so they can book after." },
          { k: "Trips: consent and sign-off", v: "A trip cannot be signed off, head-counted or marked returned while any child has not answered (a declined child is just not going). Sign-off also needs the ratio, a signed risk assessment, and a roster with the named lead and a first-aider. A changed answer reopens it. Cancelling tells families; no trip payment is taken." },
          { k: "Staff see no prices", v: "Staff see no prices anywhere: not on listings, passes, periods or block bundles, not on add-ons, and no Not paid yet flag. Owners and managers see everything as before." },
          { k: "Top bar", v: "A Listings tab sits next to Families and Contact." },
          { k: "Replies", v: "A parent's reply to any email goes to the provider's contact email (Reply-To). The sender parents see is the platform's own address until the rename." },
        ]} />

      <Stage n="8d" color={C.listing} title="Teaching Hub: who sees a child's learning" tag="Children's data"
        facts={[
          { k: "Staff see the whole business for now", v: "Once Roles and permissions is set up, a role on View or Edit for the Teaching Hub sees every child's learning record in that business (a franchise's staff, only that franchise). No 'only my students' option yet. Set None to hide it; no role or a deleted role sees nothing. Before roles are set up, all staff see it." },
          { k: "Families see their own child only", v: "A parent sees only their own child's results. On a shared lesson whiteboard they see the tutor's work and their own child's drawings, never another child's. A tutor saving a board that someone else saved first is told to reload; nothing is overwritten." },
          { k: "How long learning data is kept", v: "While the child is enrolled, and for 12 months after the enrolment ends. Erased at once, with game and quiz progress, if the parent deletes the child; the data download includes it. No automatic clean-up yet." },
          { k: "Limits and live lessons", v: "A child can start a quiz 30 times an hour, and draft saves are capped. Until a video key is added on the server, live lessons show 'Live lessons are not switched on yet' and the tutor shares another way to join." },
        ]} />

      <Stage n="7g" color={C.billing} title="AI assistant: limits and safety" tag="Rate limit · links · who can ask what"
        facts={[
          { k: "Limit", v: "Each person can ask 20 questions a minute and 150 a day (owners, staff and parents alike). Past that they see a friendly wait message." },
          { k: "Answers", v: "Answers only link to screens inside the app, never to web addresses. Names and notes typed by families are treated as plain data, not instructions. Figures can be up to a minute old." },
          { k: "Staff", v: "Staff get no money answers and cannot use the AI writer for posts or newsletters; only the account owner can." },
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
        <H2>Providers and billing page</H2>
        <Lede>Tabs with counts: All, Trial, Ending soon (7 days), Trial ended, Active, Payment failed, Cancelled, No card. Search by name, email or id; sort by newest, trial end, name or value. Test accounts (a test email address, or a name starting QA) are hidden by default: use the switch. Tabs stay in the page address.</Lede>
      </Section>

      <Section>
        <H2>The emails a new provider gets</H2>
        <Lede>The day 1, 3 and 5 emails go to freelancer and company owners in their first six days. Each is skipped if the provider has already done the thing, and the series stops once a listing is live. Each has an unsubscribe link; billing emails are always sent.</Lede>
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

/** Page 3: things to think about before launch. Not a task and not a gate. */
function Page3() {
  const li = "text-[14px] leading-relaxed text-[var(--ink-2)]";
  return (
    <>
      <Section>
        <H2>Food for thought at launch</H2>
        <Lede>Not a task and not a gate. Questions to decide before the platform opens to the public. Nothing here changes how the platform works today.</Lede>
        <Card className="p-4">
          <h3 className="m-0 mb-2 text-[18px] font-extrabold text-[var(--ink)]" style={display}>Provider vetting: decide before launch</h3>
          <ul className="m-0 grid gap-2 pl-5">
            <li className={li}>Today any signed-up user can become a company or freelancer provider and appear on the marketplace without HQ approval. To go live they only need a started plan and a way to be paid.</li>
            <li className={li}>
              Eequ, for comparison, does not vet providers. Its safeguarding FAQ says the safety details on a listing are &quot;a declaration by education providers&quot; and &quot;not verified by us&quot;, and puts the responsibility on parents. Source:{" "}
              <a href="https://help.eequ.org/en/articles/221010-safeguarding-faqs" target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--brand)] underline">Eequ safeguarding FAQs</a>.
            </li>
          </ul>
          <h4 className="m-0 mb-1 mt-4 text-[14px] font-extrabold uppercase tracking-wider text-[var(--ink-3)]">Options to decide at launch</h4>
          <ol className="m-0 grid gap-2 pl-5">
            <li className={li}><b>Minimum.</b> State clearly on listings and in the terms that provider details are self-declared, and ask for DBS and insurance at sign-up.</li>
            <li className={li}><b>Stronger.</b> HQ checks DBS (including the barred list), public liability insurance and a safeguarding lead before listings go live, and shows a &quot;Verified&quot; badge. This would set the platform apart from Eequ and fits what councils expect for HAF provision.</li>
          </ol>
          <p className="m-0 mt-3 text-[13.5px] font-bold text-[var(--ink-2)]">Owner decision. No code change now.</p>
        </Card>
        <Card className="mt-4 p-4">
          <h3 className="m-0 mb-2 text-[18px] font-extrabold text-[var(--ink)]" style={display}>Privacy tidy-ups: a few weeks after launch</h3>
          <ul className="m-0 grid gap-2 pl-5">
            <li className={li}>The founder&apos;s old home address (12 Corris Court, Milton Keynes, MK10 9NR) is still used as sample data in the test scripts (e2e/review/*) and the address unit tests, and the repository is public. The public privacy and terms pages still show the Companies House registered office (12 Corris Court) until the service address is filed and confirmed; switch them then. Decision for later: replace it with a made-up address in the test files. It stays in the old git history unless the history is rewritten or the repository is made private.</li>
            <li className={li}>The privacy and terms pages show a personal Gmail address as the data-protection contact. Move it to an address on the company&apos;s own domain once the domain exists (for example privacy@).</li>
            <li className={li}>Both pages still carry the draft banner and the placeholder product name. Have a data-protection adviser or solicitor review them, then remove the banner.</li>
          </ul>
          <p className="m-0 mt-3 text-[13.5px] font-bold text-[var(--ink-2)]">Owner decision. No code change now.</p>
        </Card>
        <Card className="mt-4 p-4">
          <h3 className="m-0 mb-2 text-[18px] font-extrabold text-[var(--ink)]" style={display}>Who pays the card fee?</h3>
          <ul className="m-0 grid gap-2 pl-5">
            <li className={li}>Today the provider pays Stripe&apos;s card fee. The platform takes no cut of bookings.</li>
            <li className={li}>Providers cannot pass it on or add a surcharge. That would be a new feature and needs a proper check first, as UK rules limit card surcharging.</li>
            <li className={li}>Options later: absorb it (today), fold it into the price, or a platform fee.</li>
          </ul>
          <p className="m-0 mt-3 text-[13.5px] font-bold text-[var(--ink-2)]">Owner decision. No code change now.</p>
        </Card>
        <Card className="mt-4 p-4">
          <h3 className="m-0 mb-2 text-[18px] font-extrabold text-[var(--ink)]" style={display}>Later: split card payments for franchises (Option B)</h3>
          <ul className="m-0 grid gap-2 pl-5">
            <li className={li}>Today (Option A): head office receives all franchise card money and pays each franchise a percentage from a payout screen.</li>
            <li className={li}>Option B, after everything else is built: each franchisee has its own Stripe account under head office. Card payments split automatically: royalty to head office, the rest to the franchisee, who bears Stripe&apos;s fee. Refunds take the royalty back proportionally.</li>
            <li className={li}>Cash, bank, vouchers and Tax-Free Childcare still need the payout screen. Franchisees must finish Stripe ID checks.</li>
          </ul>
          <p className="m-0 mt-3 text-[13.5px] font-bold text-[var(--ink-2)]">Owner decision. No code change now.</p>
        </Card>
      </Section>
    </>
  );
}

/** Add future manual pages here. */
const MANUAL_PAGES: { id: string; label: string; render: () => ReactNode }[] = [
  { id: "provider-onboarding", label: "Page 1 · Provider onboarding", render: () => <Page1 /> },
  { id: "legal", label: "Page 2 · Legal documents", render: () => <ManualLegal /> },
  { id: "launch-thoughts", label: "Page 3 · Food for thought at launch", render: () => <Page3 /> },
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
