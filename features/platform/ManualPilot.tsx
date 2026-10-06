"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Card } from "@/components/ui";

/**
 * HQ manual page 3: the real-money pilot. The first 10 to 20 real bookings through APF Activity Camps on the live Stripe account,
 * each one checked by server/tools/assure/pilot-check.ts. The page never names the product ("the platform").
 * The tracker ticks are saved in this browser only (localStorage, wrapped in try/catch).
 */

const display: CSSProperties = { fontFamily: "var(--ff-display)" };
const tint = (c: string, pct = 14) => `color-mix(in srgb, ${c} ${pct}%, var(--surface))`;
const COL = { before: "#1d3a8f", plan: "#6d4bd8", tool: "#0e9f8e", refund: "#e0702a", wrong: "#c0392b", done: "#0f7a43" };

interface Pilot { n: string; title: string; kaz: string; stripe: string; tool: string; shot: string; tag?: string }

const PILOTS: Pilot[] = [
  { n: "P1", title: "Card, one day, one child", tag: "The basic one",
    kaz: "As a new parent on your phone, book one day of October half term, pay the £0.30 pass by card, and do not close the page until it says paid.",
    stripe: "Payments: one £0.30 payment, status Succeeded, on the APF connected account (not on the platform account). No receipt email sent by Stripe.",
    tool: "Booking confirmed, payment record, payment intent, amount arithmetic, capacity, exactly one 'Payment received' email and none earlier.",
    shot: "The Stripe payment page and the confirmation email in your inbox." },
  { n: "P2", title: "Card, several days, one pass", tag: "Multi-day",
    kaz: "Book a 3-day (or 5-day) pass. Pick days in one week. Pay by card.",
    stripe: "One payment for the whole pass, not one per day.",
    tool: "Amount equals list price, capacity counts go up on every picked day, still one payment email.",
    shot: "My bookings showing every day, and the receipt." },
  { n: "P3", title: "Card, two children", tag: "Siblings",
    kaz: "Book two children on the same day in one checkout. Pay by card.",
    stripe: "One payment covering both children.",
    tool: "Seats = 2, capacity counts include both, a multi-person discount if the listing has one is applied once.",
    shot: "The checkout total, the email, and the booking in the provider view." },
  { n: "P4", title: "Discount code", tag: "Discounts",
    kaz: "Make a 50% code in the provider portal, then book using it.",
    stripe: "The charge is the discounted amount, not the list price.",
    tool: "Amount = list price - discount. The discount reason is on the booking and in the email.",
    shot: "Checkout showing the code applied, and the email wording." },
  { n: "P5", title: "Bank transfer", tag: "No card",
    kaz: "Book and choose Bank transfer. Look at the bank details panel, then pay it yourself from a bank app and mark it paid in the provider portal.",
    stripe: "Nothing appears in Stripe. This one never touches it.",
    tool: "Booking confirmed, no card checks run, bank details shown only after booking, a Booking confirmed email, then one Payment received email once marked paid.",
    shot: "The bank panel on the confirmation screen and in My bookings." },
  { n: "P6", title: "Cash on the day", tag: "No card",
    kaz: "Book choosing Cash on the day. Then mark it paid in the provider portal when you 'receive' it.",
    stripe: "Nothing in Stripe.",
    tool: "Status moves Unpaid to Paid with no payment record problem, finance figures agree.",
    shot: "The booking before and after you mark it paid." },
  { n: "P7", title: "Wallet credit", tag: "Credit",
    kaz: "Using the refund from P10 (or a goodwill credit you add), book again paying with wallet credit.",
    stripe: "No card payment, or only the top-up remainder.",
    tool: "Wallet amount is sensible, nothing double counted in finance.",
    shot: "The wallet before and after." },
  { n: "P8", title: "Date change", tag: "Amend",
    kaz: "Move a paid booking to another day yourself from My bookings.",
    stripe: "No new payment, no refund (same price).",
    tool: "Capacity counts: old day down, new day up. Status still Confirmed, still one payment.",
    shot: "The 'date change approved' message." },
  { n: "P9", title: "Waiting list", tag: "Full day",
    kaz: "Make a day full (set the capacity to 1), have a second parent join the waiting list, cancel the first booking, and accept the offer.",
    stripe: "The second parent pays only after accepting. Nothing while queued.",
    tool: "Queued booking owes nothing, one offer email, capacity never over.",
    shot: "The queue position and the offer email." },
  { n: "P10", title: "Cancel and refund", tag: "Money back",
    kaz: "Cancel P1 from My bookings, approve the refund in the provider portal, then check Stripe.",
    stripe: "Payment shows a refund of the right amount. Funds go back to the card, or to the wallet if you chose credit.",
    tool: "Run with --after-refund: refund record, amounts agree, no more refunded than paid, one refund email.",
    shot: "The Stripe refund and the refund email." },
];

const BEFORE: { t: string; d: string }[] = [
  { t: "Stripe live keys", d: "The website's public key ends Yu7m (your activityos.uk account). The server's secret key is from the same account. Check on the Stripe API keys page in live mode." },
  { t: "Vercel key", d: "Ask Amir to confirm NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY on Production ends Yu7m. Load the live site and open any card form: it must appear." },
  { t: "Railway brand name", d: "BRAND_NAME is deleted or set to the name you want parents to see in emails. Book once and read the email footer." },
  { t: "Apple Pay domain", d: "PAY_DOMAINS on Railway lists the website's host. After the first card payment, the tool reports whether the domain is registered on APF's Stripe account." },
  { t: "Bank and Stripe set up", d: "APF has bank details saved, Stripe connected (charges enabled), and one published listing for 26 to 30 October." },
];

const KEY = "aos.pilot.ticks.v1";

function Pill({ color, children }: { color: string; children: ReactNode }) {
  return <span className="inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-bold uppercase tracking-wider" style={{ background: tint(color, 16), color }}>{children}</span>;
}

function Row({ k, v, color }: { k: string; v: string; color: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="text-[11.5px] font-extrabold uppercase tracking-wider" style={{ color }}>{k}</div>
      <div className="mt-0.5 text-[14px] leading-relaxed text-[var(--ink-2)]">{v}</div>
    </div>
  );
}

export function ManualPilot() {
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [refs, setRefs] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) { const o = JSON.parse(raw) as { t?: Record<string, boolean>; r?: Record<string, string> }; setTicks(o.t ?? {}); setRefs(o.r ?? {}); }
    } catch { /* storage blocked: the tracker just starts empty */ }
  }, []);
  const save = (t: Record<string, boolean>, r: Record<string, string>) => {
    setTicks(t); setRefs(r);
    try { window.localStorage.setItem(KEY, JSON.stringify({ t, r })); } catch { /* ignore */ }
  };
  const done = PILOTS.filter((p) => ticks[`${p.n}:paid`] && ticks[`${p.n}:tool`]).length;

  return (
    <>
      <div className="mb-5 overflow-hidden rounded-2xl p-6 text-white" style={{ background: "linear-gradient(120deg, #0f7a43, #0e9f8e 55%, #1d3a8f)" }}>
        <div className="text-[12px] font-extrabold uppercase tracking-wider opacity-80">Page 3</div>
        <h1 className="m-0 mt-1 text-[28px] font-extrabold" style={display}>Pilot: your first real bookings</h1>
        <p className="m-0 mt-2 max-w-[66ch] text-[15px] leading-relaxed opacity-95">Ten real bookings on APF Activity Camps, on the live Stripe account, each one checked line by line by a tool that only reads and never changes anything. Do them in order. Stop at the first thing that looks wrong.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="h-3 w-full max-w-[360px] overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuemin={0} aria-valuemax={PILOTS.length} aria-valuenow={done}><div className="h-full rounded-full bg-white" style={{ width: `${(done / PILOTS.length) * 100}%` }} /></div>
          <span className="text-[14px] font-bold">{done} of {PILOTS.length} verified</span>
        </div>
      </div>

      <h2 className="mb-2 text-[22px] font-extrabold" style={display}>Before you start</h2>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {BEFORE.map((b, i) => (
          <Card key={b.t} className="p-3.5">
            <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full text-[13px] font-extrabold text-white" style={{ background: COL.before }}>{i + 1}</span><h3 className="m-0 text-[15.5px] font-extrabold text-[var(--ink)]" style={display}>{b.t}</h3></div>
            <p className="m-0 mt-1.5 text-[14px] leading-relaxed text-[var(--ink-2)]">{b.d}</p>
          </Card>
        ))}
      </div>

      <h2 className="mb-1 mt-8 text-[22px] font-extrabold" style={display}>How each booking is checked</h2>
      <Card className="p-4">
        <ol className="m-0 grid list-decimal gap-1.5 pl-5 text-[14px] leading-relaxed text-[var(--ink-2)]">
          <li>Make the booking as described below. Write down its reference (it starts with APF-).</li>
          <li>Open a terminal in the project folder and run the checker for that reference:
            <pre className="mt-1.5 overflow-x-auto rounded-lg p-2.5 text-[12.5px]" style={{ background: tint(COL.tool, 10) }}><code>server/node_modules/.bin/tsx server/tools/assure/pilot-check.ts APF-10312</code></pre></li>
          <li>It prints PASS, FAIL or WARN for each line, then <b>NEXT:</b> telling you the one thing to do. A WARN means it could not verify that line (for example it has no live Stripe key), so check that line by hand in Stripe.</li>
          <li>To check every pilot booking at once: <code>... pilot-check.ts --all-since 2026-10-06T00:00:00Z</code></li>
        </ol>
      </Card>

      <h2 className="mb-1 mt-8 text-[22px] font-extrabold" style={display}>The ten bookings</h2>
      <div className="grid gap-3">
        {PILOTS.map((p) => (
          <Card key={p.n} className="p-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="grid h-9 min-w-9 place-items-center rounded-full px-2 text-[14px] font-extrabold text-white" style={{ background: COL.plan }}>{p.n}</span>
              <h3 className="m-0 text-[18px] font-extrabold text-[var(--ink)]" style={display}>{p.title}</h3>
              {p.tag && <Pill color={COL.plan}>{p.tag}</Pill>}
            </div>
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              <Row k="What you do" v={p.kaz} color={COL.plan} />
              <Row k="Look at in Stripe" v={p.stripe} color={COL.before} />
              <Row k="What the tool checks" v={p.tool} color={COL.tool} />
              <Row k="Screenshot" v={p.shot} color={COL.done} />
            </div>
          </Card>
        ))}
      </div>

      <h2 className="mb-1 mt-8 text-[22px] font-extrabold" style={display}>Tracker</h2>
      <p className="m-0 mb-2 text-[13px] text-[var(--ink-3)]">Ticks and references are saved in this browser only.</p>
      <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
        <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
          <thead><tr className="text-start" style={{ background: tint(COL.plan, 12) }}>
            {["", "Booking", "Reference", "Paid", "Tool passed", "Refunded"].map((h) => <th key={h} className="px-3 py-2 text-start text-[11.5px] font-extrabold uppercase tracking-wider text-[var(--ink-2)]">{h}</th>)}
          </tr></thead>
          <tbody>
            {PILOTS.map((p) => (
              <tr key={p.n} className="border-t border-[var(--line)]">
                <td className="px-3 py-2 font-extrabold" style={{ color: COL.plan }}>{p.n}</td>
                <td className="px-3 py-2 text-[var(--ink)]">{p.title}</td>
                <td className="px-3 py-2"><input aria-label={`${p.n} reference`} value={refs[p.n] ?? ""} onChange={(e) => save(ticks, { ...refs, [p.n]: e.target.value })} placeholder="APF-…" className="w-[120px] rounded-md border border-[var(--line)] bg-transparent px-2 py-1 text-[13px] text-[var(--ink)]" /></td>
                {(["paid", "tool", "refunded"] as const).map((k) => (
                  <td key={k} className="px-3 py-2">
                    <input type="checkbox" aria-label={`${p.n} ${k}`} className="h-5 w-5 cursor-pointer" checked={!!ticks[`${p.n}:${k}`]} onChange={(e) => save({ ...ticks, [`${p.n}:${k}`]: e.target.checked }, refs)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 mt-8 text-[22px] font-extrabold" style={display}>Refunding a pilot booking</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4" >
          <Pill color={COL.refund}>In the platform</Pill>
          <ol className="m-0 mt-2 grid list-decimal gap-1 pl-5 text-[14px] leading-relaxed text-[var(--ink-2)]">
            <li>Parent: My bookings, Cancel booking, choose the reason.</li>
            <li>Provider: Bookings, open the booking, approve the refund (card or wallet credit).</li>
            <li>Run the checker again with <code>--after-refund</code>.</li>
          </ol>
        </Card>
        <Card className="p-4">
          <Pill color={COL.refund}>In Stripe, if needed</Pill>
          <ol className="m-0 mt-2 grid list-decimal gap-1 pl-5 text-[14px] leading-relaxed text-[var(--ink-2)]">
            <li>Stripe dashboard, live mode, open the payment on the APF connected account.</li>
            <li>Press Refund, choose the amount and a reason.</li>
            <li>The platform records it from Stripe's message within a minute. Then run the checker with <code>--after-refund</code>.</li>
          </ol>
        </Card>
      </div>

      <h2 className="mb-2 mt-8 text-[22px] font-extrabold" style={display}>If something is wrong</h2>
      <div className="rounded-2xl p-4" style={{ background: tint(COL.wrong, 10), border: `2px solid ${COL.wrong}` }}>
        <ol className="m-0 grid list-decimal gap-1.5 pl-5 text-[14.5px] font-semibold leading-relaxed text-[var(--ink)]">
          <li><b>Stop.</b> Do not do the next pilot booking.</li>
          <li>Write down the reference and copy the failed lines the checker printed.</li>
          <li>Take a screenshot of the screen, the email, and the Stripe payment.</li>
          <li>Do not refund or edit the booking yet, so nothing is lost. Send it all through and wait.</li>
          <li>Real money is involved: if a card was charged and the booking is not confirmed, note the Stripe payment id so it can be refunded by hand.</li>
        </ol>
      </div>
    </>
  );
}
