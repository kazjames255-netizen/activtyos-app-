"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { Booking } from "@/features/bookings/types";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { Tile, GRAD } from "@/features/money/finance-kit";

// Marketing → Marketing strategies. Playbooks that turn our existing tools
// (discount codes, groups, email, referrals, newsfeed, bookings) into concrete
// campaigns — surfaced next to live "opportunities" computed from the tenant's
// own bookings so the page tells the operator what to do *now*.

interface DashListing { listing: string; capacity: number; booked: number; spotsLeft: number; pct: number }
interface Dash { byListing: DashListing[] }
interface Code { id: string; active?: boolean; expiry?: string; usageLimit?: number; usedCount?: number }

type Cat = "fill" | "retain" | "grow" | "revenue";
const CATS: [Cat | "all", string, string][] = [
  ["all", "All plays", "🎯"], ["fill", "Fill empty spaces", "🎟️"], ["retain", "Win back & keep", "🔁"], ["grow", "Grow your audience", "📣"], ["revenue", "Boost revenue", "💷"],
];

interface Play {
  id: string; icon: string; title: string; goal: string; grad: string; cats: Cat[];
  effort: "Low" | "Medium"; impact: "Medium" | "High"; channel: string; audience?: string;
  steps: string[]; cta: { label: string; view: string }; secondary?: { label: string; view: string };
}
const PLAYS: Play[] = [
  {
    id: "earlybird", icon: "⏰", title: "Early-bird launch", goal: "Sell out a new run before it even starts.", grad: GRAD.blue, cats: ["fill", "revenue"],
    effort: "Low", impact: "High", channel: "Codes + Email",
    steps: ["Pick the upcoming listing you want to fill", "Create a time-limited % code (e.g. 15% off)", "Set an expiry 1–2 weeks out so it feels urgent", "Email your families the offer is live"],
    cta: { label: "Create the code", view: "marketing" }, secondary: { label: "Email families", view: "email" },
  },
  {
    id: "fill-session", icon: "🎟️", title: "Fill this session", goal: "Rescue a half-empty session that runs soon.", grad: GRAD.teal, cats: ["fill"],
    effort: "Low", impact: "Medium", channel: "Codes + Email",
    steps: ["Spot the sessions under half full (see opportunities above)", "Make a small last-minute code scoped to that listing", "Broadcast it to your list", "Watch the spaces fill in Bookings"],
    cta: { label: "Make a session code", view: "marketing" }, secondary: { label: "Message families", view: "email" },
  },
  {
    id: "siblings", icon: "👨‍👩‍👧", title: "Sibling & group offer", goal: "Win the whole family — no code needed.", grad: GRAD.violet, cats: ["fill", "revenue"],
    effort: "Low", impact: "Medium", channel: "Automatic discount", audience: "Multi-child families",
    steps: ["Turn on an automatic multi-person discount", "Set £ or % off from the 2nd child", "Choose which listings it applies to", "Siblings get it automatically at checkout"],
    cta: { label: "Set up auto discount", view: "marketing" },
  },
  {
    id: "winback", icon: "🔁", title: "Win back lapsed families", goal: "Bring back families who’ve gone quiet.", grad: GRAD.pink, cats: ["retain"],
    effort: "Medium", impact: "High", channel: "Groups + Email", audience: "Lapsed families",
    steps: ["Find families who haven’t booked in 60+ days", "Save them together as a parent group", "Reserve a welcome-back code for that group", "Follow up with a friendly email"],
    cta: { label: "Build the group", view: "marketing" }, secondary: { label: "Email them", view: "email" },
  },
  {
    id: "referral", icon: "📣", title: "Refer-a-friend drive", goal: "Turn happy parents into your sales team.", grad: GRAD.green, cats: ["grow"],
    effort: "Low", impact: "High", channel: "Referrals",
    steps: ["Switch on referral rewards", "Set the reward (credit, % off or a free add-on)", "Announce it to your families", "Track invited → joined → rewarded"],
    cta: { label: "Open referrals", view: "referrals" }, secondary: { label: "Announce it", view: "email" },
  },
  {
    id: "announce", icon: "🆕", title: "Announce new listings", goal: "Get eyes on what you’ve just launched.", grad: GRAD.blue, cats: ["grow"],
    effort: "Low", impact: "Medium", channel: "Newsfeed + Email",
    steps: ["Publish the new listing", "Post it to your newsfeed", "Send a campaign to your audience", "Pin it so it stays top of mind"],
    cta: { label: "Post an update", view: "newsfeed" }, secondary: { label: "Email a campaign", view: "email" },
  },
  {
    id: "waitlist", icon: "📝", title: "Convert your waitlist", goal: "Fill freed-up places with people already keen.", grad: GRAD.amber, cats: ["fill", "revenue"],
    effort: "Low", impact: "High", channel: "Bookings",
    steps: ["Check who’s waitlisted (see opportunities above)", "Free a space or open another session", "Offer waitlisted families first refusal", "Hold their place for 24h to decide"],
    cta: { label: "Go to bookings", view: "bookings" },
  },
  {
    id: "loyalty", icon: "🏅", title: "Reward loyal families", goal: "Keep your best customers coming back.", grad: GRAD.teal, cats: ["retain", "revenue"],
    effort: "Medium", impact: "Medium", channel: "Groups + Email", audience: "Repeat families",
    steps: ["Spot repeat bookers (Dashboard → repeat customers)", "Reserve a thank-you code for them as a group", "Send a personal note with it", "Invite them to book next season first"],
    cta: { label: "Reserve a code", view: "marketing" }, secondary: { label: "Say thanks", view: "email" },
  },
  {
    id: "enquiries", icon: "📩", title: "Chase your enquiries", goal: "Turn interested-but-never-booked into first bookings.", grad: GRAD.violet, cats: ["grow", "fill"],
    effort: "Low", impact: "High", channel: "Email", audience: "Enquiries",
    steps: ["Open the Enquiries audience — people who asked but never booked", "Send a warm nudge with a first-timer code", "Point them at a session that still has space", "They drop off this list automatically once they book"],
    cta: { label: "Email enquiries", view: "email" }, secondary: { label: "Make a welcome code", view: "marketing" },
  },
  {
    id: "welcome-new", icon: "👋", title: "Welcome new families", goal: "Turn a first booking into a second.", grad: GRAD.green, cats: ["retain", "revenue"],
    effort: "Low", impact: "Medium", channel: "Email", audience: "New this season",
    steps: ["Open the New-this-season audience", "Send a friendly welcome and what to expect", "Suggest the next block or a sibling place", "Ask for a review after their first session"],
    cta: { label: "Email new families", view: "email" },
  },
  {
    id: "next-block", icon: "⏭️", title: "Sell the next block", goal: "Re-book families before their sessions end.", grad: GRAD.blue, cats: ["revenue", "retain", "fill"],
    effort: "Low", impact: "High", channel: "Email", audience: "Ending soon",
    steps: ["Open the Ending-soon audience — a session in the next couple of weeks", "Email them the next block is open", "Offer a returning-family perk", "Make re-booking one tap"],
    cta: { label: "Email them", view: "email" }, secondary: { label: "Create a perk code", view: "marketing" },
  },
];

const PLAY_BY_ID: Record<string, Play> = Object.fromEntries(PLAYS.map((p) => [p.id, p]));

// A ready-made 6-week run — which plays fire when, and why in that order.
interface Week { theme: string; focus: string; why: string; playIds: string[]; grad: string }
const CAMPAIGN: Week[] = [
  { theme: "Launch & get seen", focus: "Awareness", grad: GRAD.blue, why: "Open loud: put the new season in front of everyone and reward the fastest bookers.", playIds: ["announce", "earlybird"] },
  { theme: "Spread the word", focus: "Growth", grad: GRAD.green, why: "While the early-bird buzz is live, grow reach — referrals plus a nudge to everyone who enquired but never booked.", playIds: ["referral", "enquiries"] },
  { theme: "Grow the basket", focus: "Value", grad: GRAD.violet, why: "Nudge families to book more than one child, and warmly welcome your first-timers.", playIds: ["siblings", "welcome-new"] },
  { theme: "Mid-run push", focus: "Fill spaces", grad: GRAD.teal, why: "Half-way check: target lagging sessions and re-book anyone whose place is ending soon.", playIds: ["fill-session", "next-block"] },
  { theme: "Re-engage quiet families", focus: "Retention", grad: GRAD.pink, why: "Reach the families who’ve gone quiet with a warm welcome-back.", playIds: ["winback"] },
  { theme: "Close strong", focus: "Convert & keep", grad: GRAD.amber, why: "Mop up the keen ones on the waitlist and thank your loyal regulars.", playIds: ["waitlist", "loyalty"] },
];

const bookerKey = (b: Booking) => (b.email || b.booker || "").trim().toLowerCase();
const isCancelled = (b: Booking) => b.status === "Cancelled" || b.status === "Declined";

export function MarketingStrategiesApp() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [dash, setDash] = useState<Dash | null>(null);
  const [codes, setCodes] = useState<Code[]>([]);
  const [cat, setCat] = useState<Cat | "all">("all");
  const [view, setView] = useState<"plays" | "campaign">("plays");
  const [nowMs] = useState(() => Date.now());
  const router = useRouter();
  const portal = (usePathname() ?? "/").split("/")[1] || "app";
  const go = (view: string) => router.push(`/${portal}/${view}`);

  const load = useCallback(() => {
    apiGet<Booking[]>("/api/bookings").then((b) => setBookings(Array.isArray(b) ? b : [])).catch(() => setBookings([]));
    apiGet<Dash>("/api/dashboard").then(setDash).catch(() => {});
    apiGet<Code[]>("/api/discounts").then((c) => setCodes(Array.isArray(c) ? c : [])).catch(() => {});
  }, []);
  useEffect(load, [load]);
  useRealtime(["bookings", "discountCodes", "blocks"], load);

  // Live opportunities — the "what to do now" signals from the tenant's data.
  const ops = useMemo(() => {
    const list = (bookings ?? []).filter((b) => !isCancelled(b));
    const lastByFamily = new Map<string, number>();
    let waitlisted = 0;
    for (const b of list) {
      if (b.status === "Waitlisted") waitlisted++;
      const bk = bookerKey(b); if (!bk) continue;
      const t = Date.parse((b.createdAt || "").length === 10 ? `${b.createdAt}T00:00:00Z` : b.createdAt || "");
      if (!Number.isNaN(t)) lastByFamily.set(bk, Math.max(lastByFamily.get(bk) ?? 0, t));
    }
    const cutoff = nowMs - 60 * 86400000;
    const lapsed = [...lastByFamily.values()].filter((t) => t < cutoff).length;
    const lowFill = (dash?.byListing ?? []).filter((l) => l.spotsLeft > 0 && l.pct < 50);
    const spacesToFill = lowFill.reduce((s, l) => s + l.spotsLeft, 0);
    const activeCodes = codes.filter((c) => c.active !== false).length;
    return { lapsed, waitlisted, lowFillCount: lowFill.length, spacesToFill, activeCodes };
  }, [bookings, dash, codes, nowMs]);

  const plays = cat === "all" ? PLAYS : PLAYS.filter((p) => p.cats.includes(cat));
  const loading = bookings === null;

  // Week date ranges for the campaign, starting this week's Monday, rolling forward.
  const weeks = useMemo(() => {
    const d = new Date(nowMs);
    const dow = (d.getUTCDay() + 6) % 7;
    const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow);
    const fmt = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    return CAMPAIGN.map((c, i) => { const start = monday + i * 7 * 86400000; return { ...c, label: `${fmt(start)} – ${fmt(start + 6 * 86400000)}` }; });
  }, [nowMs]);

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <PageHero
        icon="🎯"
        title="Marketing strategies"
        lede="Ready-to-run playbooks that fill your sessions and keep families coming back — each one launches straight into the tool that does it."
      />

      {/* Live opportunities from your own data */}
      <div className="mb-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Spaces to fill" icon="🎟️" grad={GRAD.blue} value={loading ? "…" : String(ops.spacesToFill)} sub={`${ops.lowFillCount} session${ops.lowFillCount === 1 ? "" : "s"} under half full`} />
        <Tile label="Families to win back" icon="🔁" grad={ops.lapsed > 0 ? GRAD.pink : GRAD.teal} value={loading ? "…" : String(ops.lapsed)} sub="no booking in 60+ days" />
        <Tile label="On the waitlist" icon="📝" grad={GRAD.amber} value={loading ? "…" : String(ops.waitlisted)} sub="keen and waiting" />
        <Tile label="Active offers" icon="🏷️" grad={GRAD.green} value={loading ? "…" : String(ops.activeCodes)} sub="codes running now" />
      </div>

      {/* View toggle — browse all plays, or see them sequenced into a 6-week run */}
      <div className="mb-4 inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 text-[12.5px] font-bold">
        {([["plays", "🃏 Playbooks"], ["campaign", "🗓️ 6-week campaign"]] as const).map(([v, label]) => (
          <button key={v} type="button" onClick={() => setView(v)} className="rounded-full px-3.5 py-1.5 transition-colors" style={view === v ? { background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
        ))}
      </div>

      {view === "campaign" ? (
        <div className="flex flex-col">
          <p className="mb-4 max-w-[640px] text-[12.5px] leading-[1.5] text-[var(--ink-3)]">A proven order to run the plays in — six weeks from this Monday. Do one focus a week; each step launches straight into the tool. Dates roll forward automatically.</p>
          {weeks.map((w, i) => (
            <div key={i} className="relative flex gap-3 sm:gap-4">
              <div className="flex flex-none flex-col items-center">
                <div className="grid h-11 w-11 flex-none place-items-center rounded-full text-[15px] font-extrabold text-white shadow-[0_6px_16px_-8px_rgba(20,30,80,.6)]" style={{ background: w.grad }}>{i + 1}</div>
                {i < weeks.length - 1 && <div className="my-1 w-0.5 flex-1 bg-[var(--line)]" />}
              </div>
              <div className="mb-4 flex-1 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_3px_rgba(20,30,60,.06)]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[14px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Week {i + 1} <span className="font-normal text-[var(--ink-3)]">· {w.theme}</span></div>
                    <div className="text-[11.5px] text-[var(--ink-3)]">{w.label}</div>
                  </div>
                  <Chip label={w.focus} tone="#2f6bd8" />
                </div>
                <div className="px-4 py-3">
                  <p className="mb-3 text-[12px] leading-snug text-[var(--ink-2)]">{w.why}</p>
                  <div className="flex flex-col gap-2">
                    {w.playIds.map((pid) => { const p = PLAY_BY_ID[pid]; if (!p) return null; return (
                      <div key={pid} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
                        <span className="grid h-8 w-8 flex-none place-items-center rounded-lg text-[16px] text-white" style={{ background: p.grad }}>{p.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-extrabold">{p.title}</div>
                          <div className="truncate text-[11.5px] text-[var(--ink-3)]">{p.goal}</div>
                        </div>
                        <button type="button" onClick={() => go(p.cta.view)} className="flex-none rounded-full px-3.5 py-1.5 text-[12px] font-bold text-white transition-transform hover:-translate-y-px" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>{p.cta.label} →</button>
                      </div>
                    ); })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
      <>
      {/* Category filter */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {CATS.map(([v, label, ic]) => (
          <button key={v} type="button" onClick={() => setCat(v)}
            className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-all duration-150 hover:-translate-y-px"
            style={cat === v ? { borderColor: "transparent", background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", color: "#fff", boxShadow: "0 3px 10px -2px rgba(47,107,216,.55)" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
            <span className="mr-1">{ic}</span>{label}
          </button>
        ))}
      </div>

      {/* Playbook cards */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {plays.map((p) => (
          <div key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_3px_rgba(20,30,60,.06)]">
            <div className="flex items-center gap-2.5 px-4 py-3 text-white" style={{ background: p.grad }}>
              <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-white/15 text-[18px]">{p.icon}</span>
              <div className="min-w-0">
                <div className="truncate text-[14.5px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{p.title}</div>
                <div className="truncate text-[11.5px] text-white/85">{p.goal}</div>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-4">
              <div className="mb-3 flex flex-wrap gap-1.5">
                {p.audience && <Chip label={`👪 ${p.audience}`} tone="#c81e77" />}
                <Chip label={`Effort: ${p.effort}`} tone={p.effort === "Low" ? "#0f7a43" : "#a85f08"} />
                <Chip label={`Impact: ${p.impact}`} tone={p.impact === "High" ? "#1d3a8f" : "#4a4763"} />
                <Chip label={p.channel} tone="#5b3fd8" />
              </div>
              <ol className="mb-4 flex flex-1 flex-col gap-1.5">
                {p.steps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-[var(--ink-2)]">
                    <span className="mt-px grid h-[18px] w-[18px] flex-none place-items-center rounded-full bg-[var(--panel)] text-[10px] font-extrabold text-[var(--ink-3)]">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-auto flex flex-wrap gap-2">
                <button type="button" onClick={() => go(p.cta.view)} className="rounded-full px-4 py-2 text-[12.5px] font-extrabold text-white shadow-sm transition-transform hover:-translate-y-px" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>{p.cta.label} →</button>
                {p.secondary && <button type="button" onClick={() => go(p.secondary!.view)} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-[12.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{p.secondary.label}</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
      </>
      )}
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: string }) {
  return <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: `${tone}18`, color: tone }}>{label}</span>;
}
