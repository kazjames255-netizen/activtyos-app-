"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { Booking } from "@/features/bookings/types";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { Tile, GRAD } from "@/features/money/finance-kit";

// Marketing → Marketing strategies. Two halves:
//  • Playbooks — a palette of ready marketing moves (data-aware opportunities up top).
//  • Campaigns — build a plan for a listing (or set of listings): drop dated
//    activities (email, social, text, print, ads, events…) into a visual timeline.

interface Listing { id: string; title?: string; name?: string }
interface DashListing { listing: string; capacity: number; booked: number; spotsLeft: number; pct: number }
interface Dash { byListing: DashListing[] }
interface Code { id: string; active?: boolean }

type Cat = "fill" | "retain" | "grow" | "revenue";
const CATS: [Cat | "all", string, string][] = [
  ["all", "All plays", "🎯"], ["fill", "Fill empty spaces", "🎟️"], ["retain", "Win back & keep", "🔁"], ["grow", "Grow your audience", "📣"], ["revenue", "Boost revenue", "💷"],
];

interface Play {
  id: string; icon: string; title: string; goal: string; grad: string; cats: Cat[];
  effort: "Low" | "Medium"; impact: "Medium" | "High"; channel: string; audience?: string; chan: string;
  steps: string[]; cta: { label: string; view: string }; secondary?: { label: string; view: string };
}
const PLAYS: Play[] = [
  { id: "earlybird", icon: "⏰", title: "Early-bird launch", goal: "Sell out a new run before it even starts.", grad: GRAD.blue, cats: ["fill", "revenue"], effort: "Low", impact: "High", channel: "Codes + Email", chan: "email",
    steps: ["Pick the upcoming listing you want to fill", "Create a time-limited % code (e.g. 15% off)", "Set an expiry 1–2 weeks out so it feels urgent", "Email your families the offer is live"],
    cta: { label: "Create the code", view: "marketing" }, secondary: { label: "Email families", view: "email" } },
  { id: "fill-session", icon: "🎟️", title: "Fill this session", goal: "Rescue a half-empty session that runs soon.", grad: GRAD.teal, cats: ["fill"], effort: "Low", impact: "Medium", channel: "Codes + Email", chan: "email",
    steps: ["Spot the sessions under half full (see opportunities above)", "Make a small last-minute code scoped to that listing", "Broadcast it to your list", "Watch the spaces fill in Bookings"],
    cta: { label: "Make a session code", view: "marketing" }, secondary: { label: "Message families", view: "email" } },
  { id: "siblings", icon: "👨‍👩‍👧", title: "Sibling & group offer", goal: "Win the whole family — no code needed.", grad: GRAD.violet, cats: ["fill", "revenue"], effort: "Low", impact: "Medium", channel: "Automatic discount", audience: "Multi-child families", chan: "email",
    steps: ["Turn on an automatic multi-person discount", "Set £ or % off from the 2nd child", "Choose which listings it applies to", "Siblings get it automatically at checkout"],
    cta: { label: "Set up auto discount", view: "marketing" } },
  { id: "winback", icon: "🔁", title: "Win back lapsed families", goal: "Bring back families who’ve gone quiet.", grad: GRAD.pink, cats: ["retain"], effort: "Medium", impact: "High", channel: "Groups + Email", audience: "Lapsed families", chan: "email",
    steps: ["Find families who haven’t booked in 60+ days", "Save them together as a parent group", "Reserve a welcome-back code for that group", "Follow up with a friendly email"],
    cta: { label: "Build the group", view: "marketing" }, secondary: { label: "Email them", view: "email" } },
  { id: "referral", icon: "📣", title: "Refer-a-friend drive", goal: "Turn happy parents into your sales team.", grad: GRAD.green, cats: ["grow"], effort: "Low", impact: "High", channel: "Referrals", chan: "social",
    steps: ["Switch on referral rewards", "Set the reward (credit, % off or a free add-on)", "Announce it to your families", "Track invited → joined → rewarded"],
    cta: { label: "Open referrals", view: "referrals" }, secondary: { label: "Announce it", view: "email" } },
  { id: "announce", icon: "🆕", title: "Announce new listings", goal: "Get eyes on what you’ve just launched.", grad: GRAD.blue, cats: ["grow"], effort: "Low", impact: "Medium", channel: "Newsfeed + Email", chan: "social",
    steps: ["Publish the new listing", "Post it to your newsfeed", "Send a campaign to your audience", "Pin it so it stays top of mind"],
    cta: { label: "Post an update", view: "newsfeed" }, secondary: { label: "Email a campaign", view: "email" } },
  { id: "waitlist", icon: "📝", title: "Convert your waitlist", goal: "Fill freed-up places with people already keen.", grad: GRAD.amber, cats: ["fill", "revenue"], effort: "Low", impact: "High", channel: "Bookings", chan: "event",
    steps: ["Check who’s waitlisted (see opportunities above)", "Free a space or open another session", "Offer waitlisted families first refusal", "Hold their place for 24h to decide"],
    cta: { label: "Go to bookings", view: "bookings" } },
  { id: "loyalty", icon: "🏅", title: "Reward loyal families", goal: "Keep your best customers coming back.", grad: GRAD.teal, cats: ["retain", "revenue"], effort: "Medium", impact: "Medium", channel: "Groups + Email", audience: "Repeat families", chan: "email",
    steps: ["Spot repeat bookers (Dashboard → repeat customers)", "Reserve a thank-you code for them as a group", "Send a personal note with it", "Invite them to book next season first"],
    cta: { label: "Reserve a code", view: "marketing" }, secondary: { label: "Say thanks", view: "email" } },
  { id: "enquiries", icon: "📩", title: "Chase your enquiries", goal: "Turn interested-but-never-booked into first bookings.", grad: GRAD.violet, cats: ["grow", "fill"], effort: "Low", impact: "High", channel: "Email", audience: "Enquiries", chan: "email",
    steps: ["Open the Enquiries audience — people who asked but never booked", "Send a warm nudge with a first-timer code", "Point them at a session that still has space", "They drop off this list automatically once they book"],
    cta: { label: "Email enquiries", view: "email" }, secondary: { label: "Make a welcome code", view: "marketing" } },
  { id: "welcome-new", icon: "👋", title: "Welcome new families", goal: "Turn a first booking into a second.", grad: GRAD.green, cats: ["retain", "revenue"], effort: "Low", impact: "Medium", channel: "Email", audience: "New this season", chan: "email",
    steps: ["Open the New-this-season audience", "Send a friendly welcome and what to expect", "Suggest the next block or a sibling place", "Ask for a review after their first session"],
    cta: { label: "Email new families", view: "email" } },
  { id: "next-block", icon: "⏭️", title: "Sell the next block", goal: "Re-book families before their sessions end.", grad: GRAD.blue, cats: ["revenue", "retain", "fill"], effort: "Low", impact: "High", channel: "Email", audience: "Ending soon", chan: "email",
    steps: ["Open the Ending-soon audience — a session in the next couple of weeks", "Email them the next block is open", "Offer a returning-family perk", "Make re-booking one tap"],
    cta: { label: "Email them", view: "email" }, secondary: { label: "Create a perk code", view: "marketing" } },
  { id: "social-post", icon: "📱", title: "Social media post", goal: "Show up in the feed where parents already are.", grad: GRAD.pink, cats: ["grow"], effort: "Low", impact: "Medium", channel: "Social", chan: "social",
    steps: ["Grab a great photo or a Moment", "Write a short, warm caption with the key details", "Add a booking link", "Post across your channels and pin it"],
    cta: { label: "Grab a Moment", view: "moments" } },
  { id: "flyers", icon: "🖨️", title: "Flyers & posters", goal: "Reach local families offline.", grad: GRAD.amber, cats: ["grow", "fill"], effort: "Medium", impact: "Medium", channel: "Print", chan: "print",
    steps: ["Design a simple flyer with a QR to the listing", "Drop at schools, cafés and libraries", "Ask a few venues to display a poster", "Track a code so you know it worked"],
    cta: { label: "Make a tracking code", view: "marketing" } },
];
const PLAY_BY_ID: Record<string, Play> = Object.fromEntries(PLAYS.map((p) => [p.id, p]));

// Channels an activity can be — a campaign is multi-channel, not just email.
const CHANNELS = [
  { k: "email", label: "Email", icon: "✉️", grad: GRAD.blue },
  { k: "social", label: "Social media", icon: "📱", grad: GRAD.pink },
  { k: "sms", label: "Text / SMS", icon: "💬", grad: GRAD.green },
  { k: "print", label: "Print / flyers", icon: "🖨️", grad: GRAD.amber },
  { k: "paid", label: "Paid ads", icon: "📢", grad: GRAD.violet },
  { k: "event", label: "Event / in-person", icon: "🤝", grad: GRAD.teal },
  { k: "other", label: "Other", icon: "⭐", grad: GRAD.blue },
] as const;
const chanOf = (k: string) => CHANNELS.find((c) => c.k === k) ?? CHANNELS[CHANNELS.length - 1];

interface Activity { id: string; title: string; channelKey: string; icon: string; grad: string; when: string; note?: string; playId?: string; done?: boolean }
interface Campaign { id: string; name: string; listingIds: string[]; createdAt: string; activities: Activity[] }

const LS = "aos.marketing.campaigns.v1";
function readLS<T>(k: string, fb: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fb; } catch { return fb; } }
function writeLS(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } }
const fmtWhen = (s: string) => { const [d, t] = s.split("T"); if (!d) return ""; const dd = new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }); return t ? `${dd} · ${t}` : dd; };

const bookerKey = (b: Booking) => (b.email || b.booker || "").trim().toLowerCase();
const isCancelled = (b: Booking) => b.status === "Cancelled" || b.status === "Declined";

export function MarketingStrategiesApp() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [dash, setDash] = useState<Dash | null>(null);
  const [codes, setCodes] = useState<Code[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [cat, setCat] = useState<Cat | "all">("all");
  const [view, setView] = useState<"plays" | "campaigns">("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => readLS<Campaign[]>(LS, []));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [nowMs] = useState(() => Date.now());
  const seq = useRef(0);
  const router = useRouter();
  const portal = (usePathname() ?? "/").split("/")[1] || "app";
  const go = (v: string) => router.push(`/${portal}/${v}`);
  const listingName = (id: string) => { const l = listings.find((x) => x.id === id); return l ? (l.title || l.name || "Listing") : "Listing"; };

  const load = useCallback(() => {
    apiGet<Booking[]>("/api/bookings").then((b) => setBookings(Array.isArray(b) ? b : [])).catch(() => setBookings([]));
    apiGet<Dash>("/api/dashboard").then(setDash).catch(() => {});
    apiGet<Code[]>("/api/discounts").then((c) => setCodes(Array.isArray(c) ? c : [])).catch(() => {});
    apiGet<Listing[]>("/api/listings?mine=1").then((l) => setListings(Array.isArray(l) ? l : [])).catch(() => {});
  }, []);
  useEffect(load, [load]);
  useRealtime(["bookings", "discountCodes", "blocks"], load);

  const persist = (next: Campaign[]) => { setCampaigns(next); writeLS(LS, next); };
  const uid = (p: string) => `${p}-${nowMs}-${seq.current++}`;
  const createCampaign = (name: string, listingIds: string[]) => { const c: Campaign = { id: uid("c"), name, listingIds, createdAt: new Date(nowMs).toISOString(), activities: [] }; persist([c, ...campaigns]); setSelectedId(c.id); setCreating(false); };
  const deleteCampaign = (id: string) => { persist(campaigns.filter((c) => c.id !== id)); if (selectedId === id) setSelectedId(null); };
  const addActivity = (id: string, a: Omit<Activity, "id">) => persist(campaigns.map((c) => (c.id === id ? { ...c, activities: [...c.activities, { ...a, id: uid("a") }] } : c)));
  const removeActivity = (id: string, actId: string) => persist(campaigns.map((c) => (c.id === id ? { ...c, activities: c.activities.filter((x) => x.id !== actId) } : c)));
  const toggleDone = (id: string, actId: string) => persist(campaigns.map((c) => (c.id === id ? { ...c, activities: c.activities.map((x) => (x.id === actId ? { ...x, done: !x.done } : x)) } : c)));

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
    return { lapsed, waitlisted, lowFillCount: lowFill.length, spacesToFill: lowFill.reduce((s, l) => s + l.spotsLeft, 0), activeCodes: codes.filter((c) => c.active !== false).length };
  }, [bookings, dash, codes, nowMs]);

  const plays = cat === "all" ? PLAYS : PLAYS.filter((p) => p.cats.includes(cat));
  const loading = bookings === null;
  const selected = campaigns.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <PageHero icon="🎯" title="Marketing strategies" lede="Plan and run everything you do to fill a listing — email, social, text, print and more — from one place." />

      <div className="mb-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Spaces to fill" icon="🎟️" grad={GRAD.blue} value={loading ? "…" : String(ops.spacesToFill)} sub={`${ops.lowFillCount} session${ops.lowFillCount === 1 ? "" : "s"} under half full`} />
        <Tile label="Families to win back" icon="🔁" grad={ops.lapsed > 0 ? GRAD.pink : GRAD.teal} value={loading ? "…" : String(ops.lapsed)} sub="no booking in 60+ days" />
        <Tile label="On the waitlist" icon="📝" grad={GRAD.amber} value={loading ? "…" : String(ops.waitlisted)} sub="keen and waiting" />
        <Tile label="Active offers" icon="🏷️" grad={GRAD.green} value={loading ? "…" : String(ops.activeCodes)} sub="codes running now" />
      </div>

      <div className="mb-4 inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 text-[12.5px] font-bold">
        {([["campaigns", "📋 Campaigns"], ["plays", "🃏 Playbook"]] as const).map(([v, label]) => (
          <button key={v} type="button" onClick={() => { setView(v); setSelectedId(null); }} className="rounded-full px-3.5 py-1.5 transition-colors" style={view === v ? { background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
        ))}
      </div>

      {view === "plays" ? (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {CATS.map(([v, label, ic]) => (
              <button key={v} type="button" onClick={() => setCat(v)} className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-all duration-150 hover:-translate-y-px"
                style={cat === v ? { borderColor: "transparent", background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)", color: "#fff", boxShadow: "0 3px 10px -2px rgba(47,107,216,.55)" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
                <span className="mr-1">{ic}</span>{label}
              </button>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {plays.map((p) => (
              <div key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_3px_rgba(20,30,60,.06)]">
                <div className="flex items-center gap-2.5 px-4 py-3 text-white" style={{ background: p.grad }}>
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-white/15 text-[18px]">{p.icon}</span>
                  <div className="min-w-0"><div className="truncate text-[14.5px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{p.title}</div><div className="truncate text-[11.5px] text-white/85">{p.goal}</div></div>
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
                      <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-[var(--ink-2)]"><span className="mt-px grid h-[18px] w-[18px] flex-none place-items-center rounded-full bg-[var(--panel)] text-[10px] font-extrabold text-[var(--ink-3)]">{i + 1}</span><span>{s}</span></li>
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
      ) : selected ? (
        <CampaignBoard campaign={selected} listingName={listingName} onBack={() => setSelectedId(null)} onDelete={() => deleteCampaign(selected.id)}
          onAdd={(a) => addActivity(selected.id, a)} onRemove={(actId) => removeActivity(selected.id, actId)} onToggle={(actId) => toggleDone(selected.id, actId)} />
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-[13px] font-extrabold text-[var(--ink-2)]">{campaigns.length} campaign{campaigns.length === 1 ? "" : "s"}</div>
            <button type="button" onClick={() => setCreating(true)} className="rounded-full px-4 py-2 text-[12.5px] font-extrabold text-white shadow-sm transition-transform hover:-translate-y-px" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>＋ Create new campaign</button>
          </div>
          {creating && <CreateCampaign listings={listings} onCancel={() => setCreating(false)} onCreate={createCampaign} />}
          {campaigns.length === 0 && !creating ? (
            <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] py-14 text-center">
              <div className="text-[30px]">📋</div>
              <div className="mt-1 text-[14px] font-extrabold">No campaigns yet</div>
              <div className="mx-auto mt-1 max-w-[360px] text-[12px] text-[var(--ink-3)]">Create a campaign for a listing, then drop in the marketing moves you’ll run — across email, social, text and more.</div>
              <button type="button" onClick={() => setCreating(true)} className="mt-3 rounded-full px-4 py-2 text-[12.5px] font-extrabold text-white" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>＋ Create your first campaign</button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
              {campaigns.map((c, i) => {
                const next = [...c.activities].filter((a) => !a.done).sort((a, b) => a.when.localeCompare(b.when))[0];
                const chans = [...new Set(c.activities.map((a) => a.channelKey))];
                return (
                  <button key={c.id} type="button" onClick={() => setSelectedId(c.id)} className={`flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-[var(--panel)] ${i ? "border-t border-[var(--line)]" : ""}`}>
                    <div className="min-w-[160px] flex-1">
                      <div className="text-[13.5px] font-extrabold">{c.name}</div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {c.listingIds.length ? c.listingIds.slice(0, 3).map((id) => <span key={id} className="rounded-full bg-[#eef2fb] px-2 py-0.5 text-[10.5px] font-bold text-[#1d3a8f]">{listingName(id)}</span>) : <span className="text-[11px] text-[var(--ink-3)]">All listings</span>}
                        {c.listingIds.length > 3 && <span className="text-[10.5px] text-[var(--ink-3)]">+{c.listingIds.length - 3}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">{chans.slice(0, 5).map((k) => <span key={k} title={chanOf(k).label} className="grid h-6 w-6 place-items-center rounded-md text-[12px] text-white" style={{ background: chanOf(k).grad }}>{chanOf(k).icon}</span>)}</div>
                    <div className="w-[92px] text-center"><div className="text-[15px] font-extrabold tabular-nums">{c.activities.length}</div><div className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">activities</div></div>
                    <div className="w-[150px] text-right text-[11.5px]"><div className="font-bold text-[var(--ink-2)]">{next ? fmtWhen(next.when) : "—"}</div><div className="text-[10px] uppercase tracking-wide text-[var(--ink-3)]">next up</div></div>
                    <span className="text-[16px] text-[var(--ink-3)]">›</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: string }) {
  return <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: `${tone}18`, color: tone }}>{label}</span>;
}

// ── Create-campaign panel ───────────────────────────────────────────────────
function CreateCampaign({ listings, onCancel, onCreate }: { listings: Listing[]; onCancel: () => void; onCreate: (name: string, listingIds: string[]) => void }) {
  const [name, setName] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const toggle = (id: string) => setIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <div className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="mb-3 text-[14px] font-extrabold">New campaign</div>
      <label className="block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Campaign name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer Camp — August push" className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] outline-none focus:border-[#3f78d8]" />
      <div className="mb-1 mt-3 flex items-baseline justify-between">
        <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Which listing(s)? <span className="font-normal normal-case">— {ids.length || "all"} selected</span></label>
        {listings.length > 0 && <button type="button" onClick={() => setIds(ids.length === listings.length ? [] : listings.map((l) => l.id))} className="text-[11px] font-bold text-[#2f6bd8]">{ids.length === listings.length ? "Clear" : "Select all"}</button>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {listings.length === 0 && <span className="text-[12px] text-[var(--ink-3)]">No listings found — the campaign will cover all listings.</span>}
        {listings.map((l) => { const on = ids.includes(l.id); return (
          <button key={l.id} type="button" onClick={() => toggle(l.id)} className="rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors" style={on ? { borderColor: "transparent", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>{on ? "✓ " : ""}{l.title || l.name || "Listing"}</button>
        ); })}
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" disabled={!name.trim()} onClick={() => onCreate(name.trim(), ids)} className="rounded-full px-4 py-2 text-[12.5px] font-extrabold text-white disabled:opacity-40" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>Create campaign</button>
        <button type="button" onClick={onCancel} className="rounded-full border border-[var(--line)] px-4 py-2 text-[12.5px] font-bold text-[var(--ink-2)]">Cancel</button>
      </div>
    </div>
  );
}

// ── Campaign board — the visual plan ────────────────────────────────────────
function CampaignBoard({ campaign, listingName, onBack, onDelete, onAdd, onRemove, onToggle }: { campaign: Campaign; listingName: (id: string) => string; onBack: () => void; onDelete: () => void; onAdd: (a: Omit<Activity, "id">) => void; onRemove: (actId: string) => void; onToggle: (actId: string) => void }) {
  const [adding, setAdding] = useState(false);
  const acts = [...campaign.activities].sort((a, b) => a.when.localeCompare(b.when));
  const chans = [...new Set(acts.map((a) => a.channelKey))];
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="text-[12.5px] font-bold text-[#2f6bd8]">‹ All campaigns</button>
        <button type="button" onClick={() => { if (confirm(`Delete campaign “${campaign.name}”?`)) { onDelete(); } }} className="text-[12px] font-bold text-[#c02636]">Delete</button>
      </div>
      <div className="overflow-hidden rounded-2xl text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#16306e 0%,#3f78d8 60%,#8b5cf6 100%)" }}>
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-white/70">Campaign</div>
            <div className="text-[21px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{campaign.name}</div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {campaign.listingIds.length ? campaign.listingIds.map((id) => <span key={id} className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold">{listingName(id)}</span>) : <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold">All listings</span>}
            </div>
          </div>
          <div className="flex gap-2 text-right">
            <div className="rounded-xl bg-white/12 px-3 py-2"><div className="text-[19px] font-extrabold leading-none">{acts.length}</div><div className="mt-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white/75">activities</div></div>
            <div className="rounded-xl bg-white/12 px-3 py-2"><div className="text-[19px] font-extrabold leading-none">{chans.length}</div><div className="mt-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white/75">channels</div></div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[13px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>📋 Your marketing plan</div>
          {!adding && <button type="button" onClick={() => setAdding(true)} className="rounded-full px-3.5 py-1.5 text-[12px] font-extrabold text-white" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>＋ Add activity</button>}
        </div>
        {adding && <AddActivity onCancel={() => setAdding(false)} onAdd={(a) => { onAdd(a); setAdding(false); }} />}

        {acts.length === 0 && !adding ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] py-10 text-center text-[12.5px] text-[var(--ink-3)]">Nothing planned yet. Drop your first marketing move into the plan.</div>
        ) : (
          <div className="flex flex-col">
            {acts.map((a, i) => { const ch = chanOf(a.channelKey); return (
              <div key={a.id} className="flex gap-3">
                <div className="flex flex-none flex-col items-center">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-xl text-[18px] text-white shadow-[0_6px_16px_-8px_rgba(20,30,80,.6)]" style={{ background: a.grad || ch.grad, opacity: a.done ? 0.45 : 1 }}>{a.icon || ch.icon}</span>
                  {i < acts.length - 1 && <div className="my-1 w-0.5 flex-1 bg-[var(--line)]" />}
                </div>
                <div className={`mb-3 flex-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3.5 py-2.5 ${a.done ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[var(--surface)] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[var(--ink-2)]">{fmtWhen(a.when)}</span>
                    <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white" style={{ background: ch.grad }}>{ch.label}</span>
                    <span className={`text-[13px] font-extrabold ${a.done ? "line-through" : ""}`}>{a.title}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <button type="button" onClick={() => onToggle(a.id)} className="text-[11px] font-bold text-[#0f7a43]">{a.done ? "Undo" : "✓ Done"}</button>
                      <button type="button" onClick={() => onRemove(a.id)} className="text-[13px] text-[var(--ink-3)] hover:text-[#c02636]">✕</button>
                    </div>
                  </div>
                  {a.note && <div className="mt-1 text-[11.5px] leading-snug text-[var(--ink-3)]">{a.note}</div>}
                </div>
              </div>
            ); })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add-activity panel — pick a strategy or build your own, stamp a date ─────
function AddActivity({ onCancel, onAdd }: { onCancel: () => void; onAdd: (a: Omit<Activity, "id">) => void }) {
  const [playId, setPlayId] = useState<string>("");
  const [channelKey, setChannelKey] = useState("email");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const pick = (p: Play) => { setPlayId(p.id); setTitle(p.title); setNote(p.goal); setChannelKey(p.chan); };
  const ch = chanOf(channelKey);
  const canAdd = title.trim() && date;
  const submit = () => {
    if (!canAdd) return;
    const p = playId ? PLAY_BY_ID[playId] : null;
    onAdd({ title: title.trim(), channelKey, icon: p?.icon ?? ch.icon, grad: p?.grad ?? ch.grad, when: `${date}${time ? `T${time}` : ""}`, note: note.trim() || undefined, playId: playId || undefined });
  };
  return (
    <div className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3.5">
      <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Start from a strategy</div>
      <div className="-mx-1 mt-1.5 flex gap-2 overflow-x-auto px-1 pb-1">
        {PLAYS.map((p) => (
          <button key={p.id} type="button" onClick={() => pick(p)} className="flex w-[150px] flex-none flex-col gap-1 rounded-xl border p-2 text-left transition-colors" style={playId === p.id ? { borderColor: "#2f6bd8", background: "#eef2fb" } : { borderColor: "var(--line)", background: "var(--surface)" }}>
            <span className="grid h-7 w-7 place-items-center rounded-lg text-[15px] text-white" style={{ background: p.grad }}>{p.icon}</span>
            <span className="text-[12px] font-extrabold leading-tight">{p.title}</span>
            <span className="line-clamp-2 text-[10.5px] leading-tight text-[var(--ink-3)]">{p.goal}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Channel</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {CHANNELS.map((c) => (
          <button key={c.k} type="button" onClick={() => setChannelKey(c.k)} className="rounded-full px-2.5 py-1 text-[11.5px] font-bold text-white transition-transform hover:-translate-y-px" style={{ background: c.grad, opacity: channelKey === c.k ? 1 : 0.45 }}>{c.icon} {c.label}</button>
        ))}
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">What are you doing?</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`e.g. ${ch.label} post about the camp`} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] outline-none focus:border-[#3f78d8]" /></div>
        <div><label className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] outline-none focus:border-[#3f78d8]" /></div>
        <div><label className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Time <span className="font-normal normal-case text-[var(--ink-3)]">(optional)</span></label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] outline-none focus:border-[#3f78d8]" /></div>
        <div className="sm:col-span-2"><label className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Note <span className="font-normal normal-case text-[var(--ink-3)]">(optional)</span></label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any detail to remember" className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] outline-none focus:border-[#3f78d8]" /></div>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={!canAdd} onClick={submit} className="rounded-full px-4 py-2 text-[12.5px] font-extrabold text-white disabled:opacity-40" style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}>Add to plan</button>
        <button type="button" onClick={onCancel} className="rounded-full border border-[var(--line)] px-4 py-2 text-[12.5px] font-bold text-[var(--ink-2)]">Cancel</button>
      </div>
    </div>
  );
}
