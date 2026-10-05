"use client";

import { useState, type ReactNode, type CSSProperties } from "react";
import { Card } from "@/components/ui";

/**
 * platform/manual — the HQ manual. Content-array driven: add a page by
 * pushing another entry onto MANUAL_PAGES. English only (internal team doc).
 * Colours come from the app's CSS variables; "soft" tints are mixed from the
 * surface so they read in light and dark.
 */

const ACC = "var(--brand-2)";
const soft = (c: string) => `color-mix(in srgb, ${c} 15%, var(--surface))`;
const GOOD = "var(--green)";
const WARN = "#c47a00";

const display: CSSProperties = { fontFamily: "var(--ff-display)" };

type PillKind = "req" | "opt" | "new";
const PILL: Record<PillKind, { bg: string; fg: string }> = {
  req: { bg: soft(ACC), fg: ACC },
  opt: { bg: soft(GOOD), fg: GOOD },
  new: { bg: soft(WARN), fg: WARN },
};
function Pill({ kind, children }: { kind: PillKind; children: ReactNode }) {
  return (
    <span className="mr-1.5 inline-block rounded-full px-2.5 py-0.5 text-[12px] font-bold" style={{ background: PILL[kind].bg, color: PILL[kind].fg }}>
      {children}
    </span>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full px-2.5 py-[3px] text-[11.5px] font-bold uppercase tracking-wider" style={{ background: soft(WARN), color: WARN }}>
      {children}
    </span>
  );
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mb-1 mt-2 text-[22px] font-extrabold text-[var(--ink)] sm:text-[26px]" style={display}>{children}</h2>;
}
function Lede({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 mt-0 max-w-[68ch] text-[14.5px] leading-relaxed text-[var(--ink-2)]">{children}</p>;
}
function Rule() {
  return <hr className="my-9 border-0 border-t border-[var(--line)]" />;
}
function Muted({ children }: { children: ReactNode }) {
  return <p className="mb-0 mt-2 text-[13px] leading-relaxed text-[var(--ink-2)]">{children}</p>;
}

function Branch({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-3.5">
      <h3 className="mb-1.5 mt-0 text-[16.5px] font-extrabold text-[var(--ink)]" style={display}>{title}</h3>
      <div className="text-[14px] leading-relaxed text-[var(--ink-2)]">{children}</div>
    </Card>
  );
}
function Bullets({ items }: { items: string[] }) {
  return <ul className="m-0 list-disc space-y-1 pl-[18px]">{items.map((t) => <li key={t}>{t}</li>)}</ul>;
}
function Two({ children }: { children: ReactNode }) {
  return <div className="mt-2 grid grid-cols-1 gap-4 min-[720px]:grid-cols-2">{children}</div>;
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]" tabIndex={0}>
      <table className="w-full min-w-[560px] border-collapse text-[13.5px]">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="border-b border-[var(--line)] px-3 py-2.5 text-left align-top text-[11.5px] font-bold uppercase tracking-wider text-[var(--ink-3)]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-2.5 align-top ${i < rows.length - 1 ? "border-b border-[var(--line)]" : ""} ${j === 0 ? "font-semibold text-[var(--ink)]" : "text-[var(--ink-2)]"}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- screen sketches ---------- */

function Screen({ children, side }: { children: ReactNode; side?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[14px] border-[1.5px] border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]" aria-hidden="true">
      <div className="flex gap-[5px] border-b border-[var(--line)] bg-[var(--panel)] px-2.5 py-2">
        {[0, 1, 2].map((i) => <i key={i} className="block h-[9px] w-[9px] rounded-full bg-[var(--line)]" />)}
      </div>
      {side ? (
        <div className="grid min-h-[200px] grid-cols-[96px_1fr]">
          {side}
          <div className="p-3.5 text-[13px] text-[var(--ink)]">{children}</div>
        </div>
      ) : (
        <div className="p-3.5 text-[13px] text-[var(--ink)]">{children}</div>
      )}
    </div>
  );
}
function SH({ children, mt }: { children: ReactNode; mt?: boolean }) {
  return <h3 className={`mb-2 text-[16px] font-extrabold text-[var(--ink)] ${mt ? "mt-3" : "mt-0"}`} style={display}>{children}</h3>;
}
function Field({ children, right, mt }: { children: ReactNode; right?: ReactNode; mt?: boolean }) {
  return (
    <div className={`my-1.5 flex min-h-[28px] items-center justify-between rounded-[7px] border border-[var(--line)] px-[9px] py-1 text-[12.5px] text-[var(--ink-3)] ${mt ? "mt-2" : ""}`}>
      <span>{children}</span>{right}
    </div>
  );
}
function Btn({ kind = "solid", children, style }: { kind?: "solid" | "ghost" | "big"; children: ReactNode; style?: CSSProperties }) {
  const base = "inline-block whitespace-nowrap rounded-full font-bold";
  if (kind === "ghost") return <span className={`${base} border-[1.5px] px-4 py-1.5 text-[12.5px]`} style={{ borderColor: ACC, color: ACC, ...style }}>{children}</span>;
  if (kind === "big") return <span className={`${base} px-6 py-[11px] text-[15px]`} style={{ background: "var(--gold)", color: "#2a1d00", boxShadow: "0 8px 20px -10px rgba(233,169,21,.9)", ...style }}>{children}</span>;
  return <span className={`${base} px-4 py-1.5 text-[12.5px]`} style={{ background: ACC, color: "#fff", ...style }}>{children}</span>;
}
function Check({ done, children, last }: { done?: boolean; children: ReactNode; last?: boolean }) {
  return (
    <div className={`flex items-center gap-2 py-1.5 text-[12.5px] ${last ? "" : "border-b border-[var(--line)]"}`}>
      <span className="h-[15px] w-[15px] flex-none rounded-[4px] border-[1.5px]" style={done ? { background: GOOD, borderColor: GOOD } : { borderColor: "var(--ink-3)" }} />
      {children}
    </div>
  );
}
function Panel2({ children }: { children: ReactNode }) {
  return <div className="mt-2 rounded-[10px] border-[1.5px] border-dashed border-[var(--line)] px-[11px] py-[9px]">{children}</div>;
}
function Chip({ on, children }: { on?: boolean; children: ReactNode }) {
  return (
    <div className="min-w-[88px] flex-1 rounded-[10px] border-[1.5px] px-2.5 py-2 text-[12.5px] font-bold" style={on ? { borderColor: ACC, background: soft(ACC) } : { borderColor: "var(--line)" }}>{children}</div>
  );
}

function Step({ n, title, flip, pill, children, screen }: { n: number; title: string; flip?: boolean; pill?: ReactNode; children: ReactNode; screen: ReactNode }) {
  const note = (
    <div className={flip ? "min-[720px]:order-2" : ""}>
      <div className="mb-1.5 grid h-[30px] w-[30px] place-items-center rounded-full text-[14px] font-extrabold" style={{ background: ACC, color: "#fff" }}>{n}</div>
      <h2 className="mb-1 mt-0 text-[21px] font-extrabold text-[var(--ink)]" style={display}>{title}</h2>
      <div className="flex flex-col gap-[.6em] text-[14.5px] leading-relaxed text-[var(--ink-2)]">{children}</div>
      {pill && <div className="mt-2">{pill}</div>}
    </div>
  );
  return (
    <div className="mt-2 grid grid-cols-1 items-center gap-[22px] min-[720px]:grid-cols-2">
      {note}
      <div className={flip ? "min-[720px]:order-1" : ""}>{screen}</div>
    </div>
  );
}
function Arrow() {
  return (
    <div className="my-3.5 flex justify-center" style={{ color: ACC }} aria-hidden="true">
      <svg viewBox="0 0 26 34" width="26" height="34" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M13 2v26M5 21l8 9 8-9" /></svg>
    </div>
  );
}

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-[min(210px,100%)] overflow-hidden rounded-[26px] border-[5px] border-[var(--ink)] bg-[var(--surface)]" aria-hidden="true">
      <div className="flex gap-[5px] border-b border-[var(--line)] bg-[var(--panel)] px-2.5 py-2">
        {[0, 1, 2].map((i) => <i key={i} className="block h-[9px] w-[9px] rounded-full bg-[var(--line)]" />)}
      </div>
      <div className="p-3 text-[13px] text-[var(--ink)]">{children}</div>
    </div>
  );
}
function Pay({ off, a, b }: { off?: boolean; a: string; b: string }) {
  return (
    <div className={`my-[5px] flex justify-between rounded-lg border border-[var(--line)] px-[9px] py-[7px] text-[12px] font-bold ${off ? "line-through opacity-45" : ""}`}>
      <span>{a}</span><span>{b}</span>
    </div>
  );
}

/* ---------- money timeline (inline SVG-free CSS flow) ---------- */

function Timeline({ items }: { items: { t: string; d: string; alt?: boolean }[] }) {
  return (
    <div className="mt-4 flex overflow-x-auto pb-1.5" tabIndex={0}>
      {items.map((it) => {
        const c = it.alt ? "var(--gold)" : ACC;
        return (
          <div key={it.t} className="relative flex-[1_0_150px] border-t-[3px] pr-2.5 pt-2.5" style={{ borderTopColor: c }}>
            <span className="absolute -top-2 left-0 h-[13px] w-[13px] rounded-full" style={{ background: c }} />
            <b className="block text-[13px] text-[var(--ink)]">{it.t}</b>
            <span className="text-[12.5px] text-[var(--ink-2)]">{it.d}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- page 1 ---------- */

function Page1() {
  return (
    <>
      <Tag>HQ manual · page 1</Tag>
      <h1 className="mb-1.5 mt-2 text-[clamp(28px,5vw,40px)] font-extrabold leading-[1.1] text-[var(--ink)]" style={{ ...display, textWrap: "balance" }}>Provider onboarding</h1>
      <Lede>The journey from sign-up to the first card payment, the emails that go with it, and how email and payments are set up. The name is a placeholder because the brand is changing. Screens are sketches.</Lede>
      <div className="mb-1 mt-3 flex flex-wrap gap-3.5 text-[13px] text-[var(--ink-2)]">
        <Pill kind="req">Required</Pill><Pill kind="opt">Optional</Pill><Pill kind="new">New</Pill>
      </div>

      <Rule />
      <Step n={1} title="Sign up"
        screen={
          <Screen>
            <SH>What are you?</SH>
            <div className="flex flex-wrap gap-2"><Chip on>Freelancer</Chip><Chip>Company</Chip><Chip>Franchise</Chip></div>
            <SH mt>Your login</SH>
            <Field>you@example.com</Field>
            <Field right={<b style={{ color: ACC }}>Show</b>}>Password</Field>
            <Btn>Create account</Btn>
          </Screen>
        }>
        <p className="m-0">Three short steps: who you are, your business and branding, then a login.</p>
        <p className="m-0">No money questions at all. The login step has a Show/Hide password button and the terms tick.</p>
      </Step>

      <Arrow />
      <Step n={2} title="Straight into the dashboard" flip pill={<Pill kind="new">New: no card at this point</Pill>}
        screen={
          <Screen side={
            <div className="flex flex-col gap-[7px] p-2.5 text-[11.5px]" style={{ background: "var(--brand)", color: "#fff" }}>
              <b>Brand</b><span className="opacity-80">Dashboard</span><span className="opacity-80">Blocks &amp; listings</span><span className="opacity-80">Settings</span>
            </div>
          }>
            <SH>Welcome. Let&apos;s get you set up</SH>
            <Check>Add a venue</Check><Check>Build a block</Check><Check>Create your first listing</Check><Check last>Choose a cancellation policy</Check>
          </Screen>
        }>
        <p className="m-0">No payment wall. The checklist walks them through a venue, a block and a first listing, so they see the product working before anything is asked of them.</p>
      </Step>

      <Arrow />
      <Step n={3} title="Build the first listing"
        screen={
          <Screen>
            <SH>Summer camp</SH>
            <Check done>Details</Check><Check done>Tickets and prices</Check><Check done last>Dates</Check>
            <div className="mt-3.5 text-center"><Btn kind="big">Go live</Btn></div>
          </Screen>
        }>
        <p className="m-0">They can save drafts, preview the booking page and edit freely, with no card.</p>
        <p className="m-0">When it&apos;s ready, the last step shows one big button.</p>
      </Step>

      <Arrow />
      <Step n={4} title="One pop-up before Go live" flip pill={<Pill kind="new">New</Pill>}
        screen={
          <Screen>
            <SH>Before you go live</SH>
            <Panel2>
              <b className="block text-[13px]">Part 1 · Your plan <Pill kind="req">Required</Pill></b>
              <span className="text-[var(--ink-2)]">7-day free trial, then monthly. Cancel any time.</span>
              <Field>Card number</Field>
            </Panel2>
            <Panel2>
              <b className="block text-[13px]">Part 2 · How will parents pay you? <Pill kind="req">Choose at least one</Pill></b>
              <Check><span className="flex-1">Cards, Apple Pay, Google Pay</span><Btn>Connect Stripe</Btn></Check>
              <Check><span className="flex-1">Bank transfer</span><span className="text-[var(--ink-3)]">add bank details</span></Check>
              <Check last>I only take cash</Check>
            </Panel2>
            <Panel2>
              <b className="block text-[13px]">Part 3 · Where should parents&apos; replies go?</b>
              <Field>name@example.com</Field>
            </Panel2>
            <div className="mt-2.5 flex flex-wrap items-center gap-2"><Btn kind="big" style={{ fontSize: 13, padding: "8px 18px" }}>Start free trial and go live</Btn><Btn kind="ghost">Not yet</Btn></div>
          </Screen>
        }>
        <p className="m-0">The plan card starts the trial. At least one way to get paid must be chosen, so a listing can never go live with no way for parents to pay. Cash only is allowed, but only as a deliberate tick.</p>
        <p className="m-0">Part 3 shows the address that replies to emails will go to, already filled in from the login email, so they confirm it is an inbox they read.</p>
      </Step>

      <Rule />
      <Two>
        <Branch title="If they chose bank transfer and cash">
          <p className="m-0 mb-2">Parents see only the methods that work. Card is hidden until Stripe is ready.</p>
          <Phone><b>How will you pay?</b><Pay a="Bank transfer" b="✓" /><Pay a="Cash" b="✓" /><Pay off a="Card" b="hidden" /></Phone>
        </Branch>
        <Branch title="Once Stripe is ready">
          <p className="m-0 mb-2">Card appears by itself, with Apple Pay and Google Pay on supported phones.</p>
          <Phone>
            <b>How will you pay?</b><Pay a="Card" b="✓" />
            <div className="mt-1.5 rounded-lg bg-black p-[7px] text-center text-[12.5px] font-bold text-white">Pay</div>
            <Pay a="Bank transfer" b="✓" />
          </Phone>
        </Branch>
      </Two>

      <Arrow />
      <Step n={5} title="Connect Stripe inside the portal" pill={<Pill kind="new">New: embedded form, with a redirect as the fallback</Pill>}
        screen={
          <Screen>
            <SH>Get paid by parents</SH>
            <Check done>Business type: sole trader</Check><Check done>Photo ID</Check><Check>Bank account</Check><Check last>Phone code</Check>
            <Field mt>Sort code</Field>
            <Btn>Continue</Btn>
          </Screen>
        }>
        <p className="m-0">When they choose card payments, Stripe&apos;s form appears on our own page, so they never feel they&apos;ve left. Stripe still checks identity, which can include a photo ID.</p>
        <p className="m-0">A step-by-step guide sits next to it, listing what to have ready.</p>
      </Step>

      <Rule />
      <h2 className="m-0 text-[24px] font-extrabold text-[var(--ink)]" style={display}>The money timeline</h2>
      <Lede>Nothing is charged before the trial ends. If they never press Go live, a gentle reminder asks for the plan card by day 5, so no one uses it free for ever.</Lede>
      <Timeline items={[
        { t: "Day 0", d: "Account created. No card." },
        { t: "First listing", d: "Go live. Card entered. Trial starts." },
        { t: "Day 5 after sign-up", d: "Reminder if they haven't gone live.", alt: true },
        { t: "7 days after Go live", d: "Trial ends. Plan charged monthly." },
        { t: "Any time", d: "Connect Stripe. Card appears for parents." },
      ]} />

      <Rule />
      <Tag>Emails</Tag>
      <H2>The emails a new provider receives</H2>
      <Lede>Rule for every email in this table: <b className="text-[var(--ink)]">check at send time, and skip it if the provider has already done the thing.</b> A reminder never arrives after the action it reminds about.</Lede>
      <Table head={["When", "Who sends it", "What it says", "Skipped if"]} rows={[
        ["Straight after sign-up", "Platform", "Welcome. First three jobs: add a listing, choose how you get paid, set where replies go.", "Never skipped, sent once"],
        ["Day 1", "Platform", "Build your first listing, with a link straight to it.", "A listing already exists"],
        ["Day 3", "Platform", "Your checklist, showing only the steps still open.", "Every checklist step is done"],
        ["Day 5", "Platform", "You have not gone live yet. What is left: plan card and a way to get paid.", "The listing is live, or the trial has started"],
        ["3 days before the trial ends", "Payment provider, via our app", "Your trial ends soon and your card will be charged. Cancel before then if it is not for you.", "No trial running, or already cancelled"],
        ["Each monthly charge", "Payment provider", "Receipt or failed-payment notice. A failed payment starts a 14-day grace period.", "Not applicable"],
        ["Stripe account needs attention", "Payment provider, direct to the provider", "Stripe asks for a document, or says a check failed.", "Not applicable. We do not control these"],
      ]} />
      <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
        <Branch title={'How "skipped if" works'}>Each nudge reads the live facts when it is due, never a stored guess. A sent-flag stops a repeat, and the whole series stops the moment the provider goes live.</Branch>
        <Branch title="Stop and pause">Every nudge has an unsubscribe link and a &quot;pause onboarding emails&quot; switch in Setup. Security and billing emails are always sent.</Branch>
        <Branch title="One receipt">A parent gets one receipt for a booking payment: the platform&apos;s own &quot;Payment received&quot; email, in the provider&apos;s name. The payment provider&apos;s receipt is switched off for booking payments.</Branch>
      </div>

      <Rule />
      <Tag>Email set-up</Tag>
      <H2>How a provider&apos;s emails reach parents</H2>
      <Lede>A provider needs no email or domain set-up to start. Everything below works from day one.</Lede>
      <Two>
        <Branch title="What works with no set-up">
          <Bullets items={[
            "Booking confirmations, payment receipts, waiting-list and reminder emails",
            "Messages to families, and campaigns from the Email area",
            "All sent from the platform's own verified address, so they reach inboxes reliably",
            "The sender name parents see is the provider's business name",
          ]} />
        </Branch>
        <Branch title="Where replies go">
          <p className="m-0 mb-1.5">Replies go to the provider&apos;s own contact address, which is filled in from their login email when they sign up, so it is never blank. In practice it is the inbox they signed up with.</p>
          <p className="m-0">The risk is a provider who signed up with an address they rarely read. So the Go live pop-up asks them to confirm it.</p>
        </Branch>
      </Two>
      <Two>
        <Branch title="What they cannot do yet">
          <Bullets items={[
            "Send from their own address, for example info@theirclub.co.uk. That needs their own domain verified, and is a later milestone",
            'Show their own domain in the "From" line',
          ]} />
        </Branch>
        <Branch title="Optional: replies into the in-app inbox">
          <p className="m-0">Providers can forward their email to a platform address so parents&apos; replies appear in the in-app Inbox. It needs the server&apos;s inbound mail setting to be switched on.</p>
        </Branch>
      </Two>
      <Muted>Set-up notes: the sending domain is the platform&apos;s own until a provider-owned domain is added later, and the reply-to address is confirmed in the Go live pop-up.</Muted>

      <Rule />
      <Tag>Payments set-up</Tag>
      <H2>Cards, Apple Pay and Google Pay</H2>
      <Lede>Two separate payment relationships exist, and each has its own set-up. The provider pays the platform for their plan. Parents pay the provider for bookings.</Lede>
      <Two>
        <Branch title="Plan payments (provider to platform)">
          <Bullets items={[
            "Card entered in the Go live pop-up, which starts the 7-day trial",
            "Charged monthly after the trial. A failed payment gives a 14-day grace period, then read-only. Safety records stay open",
            "Prices: freelancer 29 pounds a month, company from 49, franchise from 99",
          ]} />
        </Branch>
        <Branch title="Booking payments (parent to provider)">
          <Bullets items={[
            "Money goes straight to the provider's own account, never held by the platform",
            "The platform takes no cut of bookings. The provider pays the card processor's fees",
            "Card only shows to parents once the provider's account can take charges",
            "Parents get one receipt: the platform's own \"Payment received\" email. The processor's receipt is switched off for bookings",
          ]} />
        </Branch>
      </Two>
      <Table head={["Step", "Who", "When"]} rows={[
        ["Switch Apple Pay on in the payment settings", "Platform owner", "Once"],
        ["Register the web address the app is served from, and later the new domain", "Platform owner", "Once per domain"],
        ["Set the list of pay domains on the server", "Developer", "Once per domain"],
        ["Register those domains on the provider's own account", "Automatic", "When the provider can first take cards, and again when a new domain is added"],
        ["Test on a real iPhone, in Safari, with a card in Wallet", "Platform owner", "After the live keys are in"],
      ]} />
      <Muted>Parents see an Apple Pay button above the card form on supported phones and Macs. Google Pay does the same in Chrome. There is nothing for the provider to switch on.</Muted>

      <Rule />
      <Tag>Payment methods</Tag>
      <H2>What parents can pay with</H2>
      <Lede>Set once in the payment provider&apos;s Connect settings, under Payment methods, &quot;For your connected accounts&quot;. It applies to every provider. Providers on the full dashboard can turn a method on or off only if it is not blocked.</Lede>
      <Table head={["Method", "Setting", "Why"]} rows={[
        ["Cards", "On by default", "Covers almost every parent"],
        ["Apple Pay", "On by default", "One tap on iPhone and Mac. Needs the domain registered, which is automatic per provider"],
        ["Google Pay", "On by default", "Same on Android and Chrome"],
        ["Buy now pay later (Klarna, Afterpay, Clearpay, Zip, Affirm)", "Off", "Unusual for a 20 pound booking, adds fees and money-owed complaints"],
        ["PayPal, Amazon Pay, Revolut Pay", "Off", "Extra fees and harder refunds. Can be added later if providers ask"],
        ["Pay by Bank, Stripe bank transfers", "Off", "Unfamiliar to parents and harder to reconcile. Revisit later"],
        ["Crypto and regional methods", "Off or blocked", "Not relevant to UK providers"],
      ]} />
      <Muted>Cards, bank transfer, vouchers, Tax-Free Childcare and cash are what a provider offers inside the platform. The list above is only what the card form shows.</Muted>

      <Rule />
      <Tag>Going live with real payments</Tag>
      <H2>Switching from test to live</H2>
      <Table head={["Item", "Where", "Note"]} rows={[
        ["Business type and identity", "Payment provider account", "Sole trader or company. Identity check with photo ID. A non-director may act as representative but the real directors must be listed"],
        ["Phone verification and payout bank account", "Payment provider account", "Phone code by text. Bank in the owner's own name"],
        ["Two webhooks", "Payment provider account", "One for the platform's account, one for connected accounts. Both point at the API, with seven events each"],
        ["Four values: secret key, publishable key, two signing secrets", "API host and web host", "Entered by the developer. Never pasted into chat or documents. Rotate any key that has been exposed"],
        ["Test accounts", "Provider records", "An account created in test mode does not exist in live mode. Providers reconnect through Get paid. Saved customer ids are recreated automatically"],
        ["First real payment", "Everyone", "A 30p booking with a real card, then refund it"],
      ]} />

      <Rule />
      <Tag>Brand name</Tag>
      <H2>The name is going to change</H2>
      <Lede>The product name appears in about 98 files and in many emails. A checklist is kept so the rename is done in one pass: one name setting for the web and one for the server, then the domain items (sender address, payment provider account name and statement descriptor, Apple Pay domain, public pages, webhook and login settings).</Lede>
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
    <div className="min-w-0 text-[var(--ink)]">
      <nav aria-label="Manual pages" className="mx-auto mb-5 flex max-w-[940px] gap-2 overflow-x-auto pb-1">
        {MANUAL_PAGES.map((p) => {
          const on = p.id === page.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setId(p.id)}
              aria-current={on ? "page" : undefined}
              className="whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition-colors"
              style={on ? { background: ACC, borderColor: ACC, color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-2)", background: "var(--surface)" }}
            >
              {p.label}
            </button>
          );
        })}
      </nav>
      <article className="mx-auto max-w-[940px]">{page.render()}</article>
    </div>
  );
}
