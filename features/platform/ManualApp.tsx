"use client";

import { useState, type ReactNode, type CSSProperties } from "react";
import { Card } from "@/components/ui";

/**
 * platform/manual — the HQ manual. Content-array driven: add a page by pushing another entry onto MANUAL_PAGES.
 * English only (internal team doc). Colours come from the app's CSS variables; tints are mixed from the surface so
 * they read in light and dark. Screenshots live in /public/manual/onboarding (taken from the real app, brand-neutral).
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

/** A real screenshot in a browser-style frame. Tap to open full size. */
function Shot({ src, alt, caption, color }: { src: string; alt: string; caption?: string; color: string }) {
  return (
    <figure className="m-0 min-w-0">
      <a href={`${IMG}/${src}.jpg`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[14px] border-2 bg-[var(--surface)] shadow-[var(--shadow-sm)]" style={{ borderColor: tint(color, 45) }}>
        <div className="flex items-center gap-[5px] px-2.5 py-2" style={{ background: tint(color, 18) }} aria-hidden="true">
          {[0, 1, 2].map((i) => <i key={i} className="block h-[9px] w-[9px] rounded-full" style={{ background: color, opacity: 0.55 }} />)}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${IMG}/${src}.jpg`} alt={alt} loading="lazy" className="block h-auto w-full" />
      </a>
      {caption && <figcaption className="mt-1.5 text-[12.5px] leading-snug text-[var(--ink-3)]">{caption}</figcaption>}
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
function Stage({ n, color, title, tag, facts, shots }: {
  n: string; color: string; title: string; tag: string;
  facts: { k: string; v: ReactNode }[];
  shots: { src: string; alt: string; caption?: string }[];
}) {
  return (
    <Section>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3.5 text-white" style={{ background: `linear-gradient(120deg, ${color}, color-mix(in srgb, ${color} 62%, #0b1f5c))` }}>
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-white text-[18px] font-extrabold" style={{ color }}>{n}</span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[22px] font-extrabold leading-tight sm:text-[25px]" style={display}>{title}</h2>
        </div>
        <span className="rounded-full bg-white/20 px-3 py-1 text-[12px] font-bold">{tag}</span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-5 min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Facts color={color} rows={facts} />
        <div className={`grid min-w-0 content-start gap-3 ${shots.length >= 3 ? "min-[560px]:grid-cols-2" : shots.length === 2 ? "min-[560px]:grid-cols-2 min-[900px]:grid-cols-1" : ""}`}>
          {shots.map((s) => <Shot key={s.src} src={s.src} alt={s.alt} caption={s.caption} color={color} />)}
        </div>
      </div>
    </Section>
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
  { label: "Cancellations", color: C.cancel, ticks: "a cancellation policy is saved" },
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
        The checklist hides for good once a listing is published <b>and</b> a booking exists, or when the provider presses Hide. The top banner on every page shows the same count and the next job.
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
        {arrow(228, 62, 672, 62, C.billing, "£29 a month + VAT, after a 7-day free trial", 48)}

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
      {col(C.block, "Bank and benefits", "Parents are shown the provider's bank details, and the provider marks the payment received. This is why bank details are compulsory.", ["Bank transfer", "Tax-Free Childcare", "Vouchers"], "the provider's bank account")}
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
        <text x={(x(7) + x(21)) / 2} y="56" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">Paid plan · £29 + VAT a month</text>
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
  { when: "Straight after sign-up", what: "Welcome and the first three jobs", skip: "Sent once", color: C.signup },
  { when: "Day 1", what: "Build your first listing", skip: "Skipped if a listing exists", color: C.venue },
  { when: "Day 3", what: "Your checklist, open steps only", skip: "Skipped if every step is done", color: C.listing },
  { when: "Day 5", what: "You have not gone live yet", skip: "Skipped if live or trial started", color: C.golive },
  { when: "3 days before the trial ends", what: "Trial ending, card will be charged", skip: "Skipped if cancelled", color: C.billing },
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
          { k: "Hides when", v: "A listing is published and a booking exists, or the provider presses Hide." },
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
          { k: "Common mistakes", v: "Leaving a block without prices: the listing then cannot be published." },
        ]}
        shots={[
          { src: "blocks-empty", alt: "Blocks tab with periods, passes and blocks", caption: "Periods, then passes, then blocks" },
          { src: "block-created-prompt", alt: "Block created, with the next-step prompt", caption: "After the first block" },
        ]} />

      <Stage n="5" color={C.listing} title="Create and publish a listing" tag="Checklist job 3 · 13 steps"
        facts={[
          { k: "What they see", v: "An empty Listings tab, then a 13-step guided editor with a progress bar. A box at the start lists what is needed before publishing." },
          { k: "What to do", v: "Give the listing a title and photo, pick the venue and the block (step 8 attaches the block, which brings the passes and prices), set age range, capacity and policy. Publish is at step 13." },
          { k: "What ticks it", v: "A listing exists. It counts once saved, even as a draft, but parents only see it after Publish." },
          { k: "The green prompt", v: "Appears on the Listings tab when the listing job is done and shows the next job." },
          { k: "Common mistakes", v: "Publishing with no block: the editor shows \"Pick a block so the listing has passes and prices\" and Publish stays disabled until it is fixed." },
        ]}
        shots={[
          { src: "listings-empty", alt: "Empty listings tab", caption: "New listing starts here" },
          { src: "listing-wizard-step-1", alt: "Listing editor, step 1 of 13", caption: "Step 1 of 13 · basics" },
        ]} />

      <Stage n="6" color={C.golive} title="Go live: three single steps" tag="New providers only"
        facts={[
          { k: "When it appears", v: "When a new provider presses Publish on a listing for the first time. Providers who already have a plan and bank details go straight through." },
          { k: "Step 1 · free trial", v: "Add a card to start the 7-day free trial. It opens in a new tab and ticks itself when they return. Nothing is charged until the trial ends." },
          { k: "Step 2 · bank details (required)", v: "Bank name, sort code and account number. Bank transfers, Tax-Free Childcare and vouchers pay into this account and it is shown on invoices. Below it, card payments through Stripe are optional and recommended, and can be done later." },
          { k: "Step 3 · reply-to", v: "Where parents' replies go. It is filled in from their login email. They press Save, then Go live." },
          { k: "Enforced by the server", v: "Publishing without a started plan or saved bank details is refused, so no other screen can skip this." },
          { k: "Common mistakes", v: "Closing the pop-up with Not yet: the listing stays saved as a draft and the pop-up returns at the next Publish." },
        ]}
        shots={[
          { src: "golive-1-free-trial", alt: "Go live pop-up, step 1: start your free trial", caption: "Step 1 · free trial card" },
          { src: "golive-2-bank-details", alt: "Go live pop-up, step 2: bank details", caption: "Step 2 · bank details, with optional card payments" },
          { src: "golive-3-reply-to", alt: "Go live pop-up, step 3: where replies go", caption: "Step 3 · reply-to, then Go live" },
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

      <Stage n="8" color={C.cancel} title="Set your cancellation policy" tag="Checklist job 5"
        facts={[
          { k: "What they see", v: "Setup, Cancellations & refunds, with a ready-made Standard policy: full refund a week ahead, half back at 48 hours, nothing after." },
          { k: "What to do", v: "Edit the notice periods and percentages, rename it if they like, and press Done. The wording parents read writes itself from the rows." },
          { k: "What ticks it", v: "Pressing Set my policy marks it as reviewed, and saving a policy ticks it too. Keeping the standard policy is fine." },
          { k: "Good to know", v: "The platform works out what is owed when someone cancels and shows it. The provider decides whether to send the refund." },
        ]}
        shots={[{ src: "cancellation-policy", alt: "Cancellations and refunds setup", caption: "The standard policy, ready to edit" }]} />

      <Stage n="9" color={C.open} title="Set up done: parents can book" tag="Checklist 5 of 5"
        facts={[
          { k: "What they see", v: "All five jobs ticked. The checklist and the top banner disappear after the first booking." },
          { k: "What parents see", v: "The published listing on Browse and on the provider's own link. Cards show once Stripe is ready. Bank transfer, Tax-Free Childcare and vouchers show from day one." },
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
        <Lede>Nothing is charged for the first 7 days. After that the plan is charged monthly. A failed payment starts a 14-day grace period; after that the account becomes read-only, never deleted.</Lede>
        <PlanTimeline />
      </Section>

      <Section>
        <H2>The emails a new provider gets</H2>
        <Lede>Every nudge checks at send time and is skipped if the provider has already done the thing, so a reminder never arrives after the action it reminds about. Each has an unsubscribe link; billing and security emails are always sent.</Lede>
        <Card className="p-4"><EmailTimeline /></Card>
        <div className="mt-3 grid grid-cols-1 gap-3 min-[720px]:grid-cols-2">
          <Card className="p-3.5">
            <h3 className="m-0 mb-1 text-[16px] font-extrabold text-[var(--ink)]" style={display}>Where parents&apos; replies go</h3>
            <p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">To the reply-to address confirmed in Go live step 3, filled in from the provider&apos;s login email. Emails are sent from the platform&apos;s own verified address under the provider&apos;s business name, so there is nothing to set up.</p>
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
];

export function ManualApp() {
  const [id, setId] = useState(MANUAL_PAGES[0].id);
  const page = MANUAL_PAGES.find((p) => p.id === id) ?? MANUAL_PAGES[0];
  return (
    <div className="min-w-0 pb-10 text-[var(--ink)]">
      <nav aria-label="Manual pages" className="mx-auto mb-5 flex max-w-[1040px] gap-2 overflow-x-auto pb-1">
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
      <article className="mx-auto max-w-[1040px]">{page.render()}</article>
    </div>
  );
}
