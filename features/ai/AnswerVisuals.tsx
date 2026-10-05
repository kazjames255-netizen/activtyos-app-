"use client";

import type { CSSProperties, ReactNode } from "react";

// Small, theme-aware visuals the assistant can attach to an answer. The server
// appends a `[[visual:ID]]` tag line; the chat strips it from the displayed text
// (splitVisuals) and renders <AnswerVisual id=…/> under the bubble. Unknown ids
// are dropped. Pure CSS/inline SVG, colours from the app's CSS variables only.

const KNOWN = ["journey", "money-flows", "go-live", "payment-methods", "stripe-steps", "email-timeline", "reply-to"] as const;
type VisualId = (typeof KNOWN)[number];
const isKnown = (s: string): s is VisualId => (KNOWN as readonly string[]).includes(s);

const TAG_RE = /\[\[\s*visual\s*:\s*([a-z0-9_-]+)\s*\]\]/gi;

/** Remove every [[visual:ID]] tag from the text; return the known, de-duplicated ids in order. */
export function splitVisuals(text: string): { text: string; visuals: string[] } {
  const visuals: string[] = [];
  const clean = (text ?? "").replace(TAG_RE, (_m, id: string) => {
    const k = id.toLowerCase();
    if (isKnown(k) && !visuals.includes(k)) visuals.push(k);
    return "";
  }).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text: clean, visuals };
}

// ── Shared building blocks ──────────────────────────────────────────────────
const BRAND = "var(--brand, #1d3a8f)";
const BRAND2 = "var(--brand-2, #2f6bd8)";
const OK = "var(--green, #15b364)";

function Frame({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <div role="img" aria-label={label} className="mt-1.5 w-full max-w-[420px] overflow-hidden rounded-xl border"
      style={{ borderColor: "var(--line)", background: "var(--panel, var(--surface))", color: "var(--ink)", padding: "9px 10px" }}>
      <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em]" style={{ color: "var(--ink-3)" }}>{title}</div>
      {children}
    </div>
  );
}

function Num({ n, done }: { n: number | string; done?: boolean }) {
  return (
    <span aria-hidden className="flex h-[20px] w-[20px] flex-none items-center justify-center rounded-full text-[10.5px] font-extrabold text-white"
      style={{ background: done ? OK : BRAND2 }}>{n}</span>
  );
}

const box: CSSProperties = { border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 8 };
const small: CSSProperties = { fontSize: 11, lineHeight: 1.3, color: "var(--ink-2)" };

function Arrow({ down = true, label }: { down?: boolean; label?: string }) {
  return (
    <div aria-hidden className="flex items-center justify-center gap-1.5" style={{ color: BRAND2, flexDirection: down ? "column" : "row" }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={down ? "" : "-rotate-90 rtl:rotate-90"}>
        <path d="M7 2v9M3 7.5L7 11.5l4-4" />
      </svg>
      {label && <span className="text-[10.5px] font-bold" style={{ color: "var(--ink-2)" }}>{label}</span>}
    </div>
  );
}

// ── 1. journey ──────────────────────────────────────────────────────────────
function Journey() {
  const steps = ["Sign up", "Dashboard + checklist", "Build your first listing", "Go live pop-up: plan, how parents pay, reply address", "Parents book", "Connect Stripe to take cards"];
  return (
    <Frame title="Your journey" label={`Your journey in order: ${steps.join(", then ")}.`}>
      <ol className="m-0 list-none p-0">
        {steps.map((s, i) => (
          <li key={s} className="relative flex items-center gap-2 py-[3px]">
            {i < steps.length - 1 && <span aria-hidden className="absolute start-[9.5px] top-[23px] h-[calc(100%-14px)] w-[1.5px]" style={{ background: "var(--brand-line, var(--line))" }} />}
            <Num n={i + 1} done={i === 3} />
            <span className="min-w-0 text-[12px] font-semibold leading-tight" style={{ color: "var(--ink)" }}>{s}</span>
          </li>
        ))}
      </ol>
    </Frame>
  );
}

// ── 2. money-flows ──────────────────────────────────────────────────────────
function Node({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex min-h-[34px] flex-1 items-center justify-center px-1 py-1 text-center text-[10.5px] font-bold leading-tight"
      style={strong ? { ...box, background: BRAND, borderColor: BRAND, color: "#fff" } : { ...box, color: "var(--ink)" }}>{children}</div>
  );
}
function Flow({ nodes, arrows }: { nodes: string[]; arrows: string[] }) {
  return (
    <div className="flex items-stretch gap-0.5">
      {nodes.map((n, i) => (
        <div key={n} className="flex min-w-0 flex-1 items-stretch gap-0.5" style={{ flex: i === nodes.length - 1 ? "1 1 0" : "1 1 0" }}>
          <Node strong={i === nodes.length - 1 && nodes.length === 3 && n === "The platform"}>{n}</Node>
          {i < nodes.length - 1 && (
            <div className="flex w-[46px] flex-none flex-col items-center justify-center text-center" aria-hidden>
              <span className="text-[9px] font-bold leading-[1.1]" style={{ color: "var(--ink-2)" }}>{arrows[i]}</span>
              <svg width="26" height="10" viewBox="0 0 26 10" fill="none" stroke={BRAND2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rtl:-scale-x-100"><path d="M1 5h22M19 1.5L23.5 5 19 8.5" /></svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
function MoneyFlows() {
  return (
    <Frame title="Where the money goes"
      label="Two money flows. Provider pays the platform for the plan by card, with a 7-day trial then monthly. Parent pays for a booking by card, Apple Pay, Google Pay, bank transfer, cash or vouchers, straight into the provider's own account and then the provider's bank. The platform takes no cut of bookings.">
      <div className="mb-1 text-[11px] font-extrabold" style={{ color: BRAND2 }}>Your plan</div>
      <Flow nodes={["You", "The platform"]} arrows={["card"]} />
      <div className="mt-1" style={small}>7-day free trial, then monthly.</div>
      <div className="mb-1 mt-2.5 text-[11px] font-extrabold" style={{ color: BRAND2 }}>Parent bookings</div>
      <Flow nodes={["Parent", "Your account", "Your bank"]} arrows={["pays", "paid out"]} />
      <div className="mt-1" style={small}>Card, Apple Pay, Google Pay, bank transfer, cash or vouchers.</div>
      <div className="mt-1.5 rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: "var(--green-soft, #e7f8ee)", color: "#0b6b3a", border: "1px solid var(--green-line, #bfe9d2)" }}>
        The platform takes no cut of bookings.
      </div>
    </Frame>
  );
}

// ── 3. go-live ──────────────────────────────────────────────────────────────
function GoLive() {
  const rows: { t: string; tag: string; sub: string }[] = [
    { t: "Your plan", tag: "Required", sub: "Start the 7-day free trial." },
    { t: "How parents pay", tag: "Choose at least one", sub: "Stripe cards, bank transfer, or I only take cash." },
    { t: "Where replies go", tag: "Your contact address", sub: "Parent replies to your emails land here." },
  ];
  return (
    <Frame title="Before you go live"
      label="Three things before you go live. One, your plan, required. Two, how parents pay: choose at least one of Stripe cards, bank transfer, or I only take cash. Three, where replies go.">
      <div className="flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <div key={r.t} className="flex items-start gap-2 px-2 py-1.5" style={box}>
            <Num n={i + 1} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="text-[12px] font-extrabold" style={{ color: "var(--ink)" }}>{r.t}</span>
                <span className="rounded-full px-1.5 py-px text-[9.5px] font-bold" style={{ background: "var(--brand-soft, #eaf0fc)", color: BRAND }}>{r.tag}</span>
              </div>
              <div style={small}>{r.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// ── 4. payment-methods ──────────────────────────────────────────────────────
function Chip({ children, on }: { children: ReactNode; on: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-bold"
      style={on
        ? { background: "var(--green-soft, #e7f8ee)", color: "#0b6b3a", border: "1px solid var(--green-line, #bfe9d2)" }
        : { background: "transparent", color: "var(--ink-3)", border: "1px dashed var(--line)", textDecoration: "line-through" }}>
      <span aria-hidden style={{ textDecoration: "none" }}>{on ? "✓" : "✕"}</span>{children}
    </span>
  );
}
function PaymentMethods() {
  return (
    <Frame title="What parents can pay with"
      label="At checkout parents see Cards, Apple Pay and Google Pay. Klarna, PayPal and Amazon Pay are switched off. You can also accept bank transfer, vouchers, Tax-Free Childcare and cash yourself.">
      <div className="text-[10.5px] font-bold" style={{ color: "var(--ink-2)" }}>At checkout</div>
      <div className="mt-1 flex flex-wrap gap-1">
        <Chip on>Cards</Chip><Chip on>Apple Pay</Chip><Chip on>Google Pay</Chip>
        <Chip on={false}>Klarna</Chip><Chip on={false}>PayPal</Chip><Chip on={false}>Amazon Pay</Chip>
      </div>
      <div className="mt-2 text-[10.5px] font-bold" style={{ color: "var(--ink-2)" }}>You record these yourself</div>
      <div className="mt-1 flex flex-wrap gap-1">
        <Chip on>Bank transfer</Chip><Chip on>Vouchers</Chip><Chip on>Tax-Free Childcare</Chip><Chip on>Cash</Chip>
      </div>
    </Frame>
  );
}

// ── 5. stripe-steps ─────────────────────────────────────────────────────────
function StripeSteps() {
  const steps = [["Business type", "Individual or company"], ["Identity", "Your name and a photo ID"], ["Bank account", "Where payouts land"], ["Phone code", "A text to confirm it is you"], ["Approval", "Usually within minutes"]];
  return (
    <Frame title="Connect Stripe in 5 steps"
      label={`Have ready: photo ID, home address, bank details, phone. Then: ${steps.map((s) => s[0]).join(", ")}.`}>
      <div className="mb-1.5 flex flex-wrap items-center gap-1 rounded-md px-2 py-1" style={{ background: "var(--gold-soft, #fdf3d8)", border: "1px solid var(--gold-line, #f0deac)", color: "#6b4e00" }}>
        <span className="text-[10.5px] font-extrabold">Have ready:</span>
        {["Photo ID", "Home address", "Bank details", "Phone"].map((h) => <span key={h} className="text-[10.5px] font-semibold">{h}{h !== "Phone" ? " ·" : ""}</span>)}
      </div>
      <ol className="m-0 list-none p-0">
        {steps.map(([t, s], i) => (
          <li key={t} className="flex items-center gap-2 py-[2.5px]">
            <Num n={i + 1} done={i === 4} />
            <span className="text-[12px] font-bold" style={{ color: "var(--ink)" }}>{t}</span>
            <span className="min-w-0 truncate text-[11px]" style={{ color: "var(--ink-3)" }}>{s}</span>
          </li>
        ))}
      </ol>
    </Frame>
  );
}

// ── 6. email-timeline ───────────────────────────────────────────────────────
function EmailTimeline() {
  const rows: [string, string, boolean][] = [["Welcome", "Right after sign-up", false], ["Day 1", "Set-up nudge", true], ["Day 3", "Set-up nudge", true], ["Day 5", "Set-up nudge", true], ["3 days before trial ends", "Heads-up", false], ["Monthly receipt", "Each billing date", false]];
  return (
    <Frame title="Emails you will get"
      label="Email timeline: Welcome at sign-up; Day 1, Day 3 and Day 5 set-up emails, each skipped if that step is already done; a reminder 3 days before your trial ends; then a monthly receipt.">
      <ol className="m-0 list-none p-0">
        {rows.map(([t, s, skip], i) => (
          <li key={t} className="relative flex items-start gap-2 py-[3px]">
            {i < rows.length - 1 && <span aria-hidden className="absolute start-[4.5px] top-[14px] h-[calc(100%-6px)] w-[1.5px]" style={{ background: "var(--brand-line, var(--line))" }} />}
            <span aria-hidden className="mt-[5px] h-[10px] w-[10px] flex-none rounded-full" style={{ background: BRAND2, boxShadow: "0 0 0 2px var(--panel, var(--surface))" }} />
            <div className="min-w-0 flex-1 text-[12px] leading-tight">
              <span className="font-extrabold" style={{ color: "var(--ink)" }}>{t}</span>
              <span style={{ color: "var(--ink-3)" }}> · {s}</span>
              {skip && <span className="ms-1.5 inline-block whitespace-nowrap rounded-full px-1.5 py-px text-[9.5px] font-bold" style={{ background: "var(--brand-soft, #eaf0fc)", color: BRAND }}>skipped if already done</span>}
            </div>
          </li>
        ))}
      </ol>
    </Frame>
  );
}

// ── 7. reply-to ─────────────────────────────────────────────────────────────
function ReplyTo() {
  return (
    <Frame title="When a parent replies"
      label="A parent replies to one of your emails. The reply goes to your contact address, which is filled in from your login email. Optionally, forward those replies into the in-app inbox.">
      <div className="flex flex-col items-stretch gap-0.5">
        <div className="px-2 py-1.5 text-[11.5px] font-bold" style={{ ...box, color: "var(--ink)" }}>Parent replies to an email</div>
        <Arrow />
        <div className="px-2 py-1.5 text-[11.5px]" style={{ ...box, borderColor: BRAND2, color: "var(--ink)" }}>
          <b>Your contact address</b> <span style={{ color: "var(--ink-3)" }}>(filled in from your login email)</span>
        </div>
        <Arrow label="optional" />
        <div className="px-2 py-1.5 text-[11.5px] font-bold" style={{ ...box, borderStyle: "dashed", color: "var(--ink-2)" }}>Forward into the in-app inbox</div>
      </div>
    </Frame>
  );
}

const MAP: Record<VisualId, () => ReactNode> = {
  journey: () => <Journey />,
  "money-flows": () => <MoneyFlows />,
  "go-live": () => <GoLive />,
  "payment-methods": () => <PaymentMethods />,
  "stripe-steps": () => <StripeSteps />,
  "email-timeline": () => <EmailTimeline />,
  "reply-to": () => <ReplyTo />,
};

export function AnswerVisual({ id }: { id: string }) {
  const k = id.toLowerCase();
  return isKnown(k) ? <>{MAP[k]()}</> : null;
}
