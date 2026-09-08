"use client";

// Marketing strategies → a data-driven GROWTH STUDIO. It reads the provider's own
// numbers (via /api/growth) and turns them into: a headline of revenue within reach,
// a visual breakdown of WHO their families are (with advice per audience), a per-
// LISTING fill + recommendation view, and a ranked list of "plays". Every action
// deep-links to the tool that acts on it (usually the Email composer with the right
// audience + a ready-made subject). Falls back to evergreen playbooks.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { get as apiGet } from "@/lib/api";
import { useHoScope } from "@/components/franchise/HoScope";

interface Play {
  id: string; icon: string; title: string; signal: string; insight: string;
  impactLabel: string; impactValue: number; actionLabel: string; actionView: string;
  audienceId?: string; secondary?: { label: string; view: string };
}
interface Seg { key: string; label: string; count: number; tone: string }
interface AudienceRec { key: string; emoji: string; label: string; count: number; base: boolean; blurb: string; advice: string; audienceId: string; goal: string; tone: string }
interface ListingRec { id: string; title: string; nextDate: string | null; capacity: number; booked: number; spotsLeft: number; pct: number; revenueAtStake: number; health: "quiet" | "filling" | "full"; advice: string; audienceId?: string; goal?: string }
interface GrowthData {
  stats: { occupancy: number; repeatRate: number; reviews: number; listSize: number; revenueWithinReach: number };
  thresholds: { newDays: number; lapsedMonths: number; loyalMin: number };
  listingOptions: { id: string; name: string }[]; listingId: string | null;
  segments: Seg[]; audiences: AudienceRec[]; listings: ListingRec[]; plays: Play[];
}

// Operator-tunable thresholds, remembered per browser (like the Email audiences page).
const readNum = (k: string, d: number) => { if (typeof window === "undefined") return d; const v = Number(localStorage.getItem(k)); return Number.isFinite(v) && v > 0 ? v : d; };
function NumBox({ value, onChange, lo, hi }: { value: number; onChange: (n: number) => void; lo: number; hi: number }) {
  return (
    <input type="number" min={lo} max={hi} value={value}
      onChange={(e) => { const n = parseInt(e.target.value, 10); if (!isNaN(n)) onChange(Math.min(hi, Math.max(lo, n))); }}
      className="w-[46px] rounded-md border border-[#E4E9F5] bg-[var(--surface)] px-1.5 py-0.5 text-center text-[12px] font-bold text-[#2f5fd0] outline-none focus:border-[#2f6bd8]" />
  );
}

const EMOJI: Record<string, string> = { "fill-empty": "📅", lapsed: "💌", reviews: "⭐", memberships: "👑", "re-engage": "📣", midweek: "🗓️" };
const GOAL: Record<string, string> = { "fill-empty": "fill", lapsed: "winback", reviews: "review", memberships: "membership", "re-engage": "newsletter", midweek: "midweek" };
const TONE: Record<string, { bg: string; fg: string; bar: string }> = {
  blue: { bg: "#E8EEFD", fg: "#2f5fd0", bar: "#2f6bd8" },
  sky: { bg: "#E8EEFD", fg: "#2f5fd0", bar: "#38a9d4" },
  green: { bg: "#E2F6EC", fg: "#0f7a43", bar: "#16a34a" },
  red: { bg: "#FDE7EF", fg: "#C81E5E", bar: "#e24b4a" },
  amber: { bg: "#FCF1DC", fg: "#F5A524", bar: "#F5A524" },
  purple: { bg: "#EDE9FD", fg: "#2f5fd0", bar: "#5a3fd0" },
};
const HEALTH: Record<string, { label: string; bar: string; bg: string; fg: string }> = {
  quiet: { label: "Quiet", bar: "#F5A524", bg: "#FCF1DC", fg: "#F5A524" },
  filling: { label: "Filling", bar: "#2f6bd8", bg: "#E8EEFD", fg: "#2f5fd0" },
  full: { label: "Nearly full", bar: "#16a34a", bg: "#E2F6EC", fg: "#0f7a43" },
};
const gbp = (n: number) => `£${Math.round(n).toLocaleString()}`;
const niceDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");

const PLAYBOOKS: { emoji: string; title: string; body: string; view: string; cta: string }[] = [
  { emoji: "⚡", title: "Launch an early-bird", body: "Open your next season early with a limited discount — the first weeks of bookings are your best forecast.", view: "marketing", cta: "Create a code" },
  { emoji: "🎁", title: "Build a referral flywheel", body: "Reward families who bring a friend. Referred families book sooner and stay longer than any ad.", view: "referrals", cta: "Set up referrals" },
  { emoji: "⭐", title: "Make reviews a habit", body: "Ask every happy family after their last session. Social proof is the cheapest marketing you have.", view: "reviews", cta: "Ask for reviews" },
  { emoji: "📣", title: "Keep your list warm", body: "A short update every couple of weeks keeps you top-of-mind for the next booking window.", view: "newsfeed", cta: "Post an update" },
];

function Stat({ label, value, sub, hint }: { label: string; value: string; sub?: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-[#E4E9F5] bg-[var(--surface)] p-4 shadow-sm" title={hint}>
      <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">{label}</div>
      <div className="mt-1 text-[24px] font-extrabold leading-none text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{value}</div>
      {sub && <div className="mt-1 text-[10.5px] leading-tight text-[var(--ink-3)]">{sub}</div>}
    </div>
  );
}
function AudienceCard({ a, href, edit }: { a: AudienceRec; href: string | null; edit?: React.ReactNode }) {
  const t = TONE[a.tone] ?? TONE.blue;
  return (
    <div className="flex flex-col rounded-2xl border border-[#E4E9F5] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-[20px]" style={{ background: t.bg }}>{a.emoji}</span>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[22px] font-extrabold leading-none" style={{ color: t.fg, fontFamily: "var(--ff-display)" }}>{a.count}</span>
            <span className="truncate text-[13.5px] font-extrabold text-[var(--ink)]">{a.label}</span>
          </div>
          <div className="text-[11.5px] text-[var(--ink-3)]">{a.blurb}</div>
        </div>
      </div>
      <p className="mt-2.5 flex-1 text-[12.5px] leading-[1.5] text-[#2f5fd0]">{a.advice}</p>
      {href && <Link href={href} className="mt-2.5 inline-flex w-fit items-center gap-1 rounded-full px-3.5 py-1.5 text-[12px] font-bold text-white transition-opacity hover:opacity-90" style={{ background: t.fg }}>Email these {a.count} →</Link>}
      {edit}
    </div>
  );
}

function SectionTitle({ children, hint, right }: { children: React.ReactNode; hint?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-2.5 mt-1 flex items-start justify-between gap-3">
      <div>
        <div className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">{children}</div>
        {hint && <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">{hint}</div>}
      </div>
      {right && <div className="flex-none">{right}</div>}
    </div>
  );
}

export function MarketingStrategiesApp() {
  const portal = (usePathname() || "").split("/")[1] || "freelancer";
  const hoScope = useHoScope();
  const [data, setData] = useState<GrowthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The chosen live listing to focus on ("" = all). The options list is kept in
  // its own state so the dropdown stays stable while data re-loads.
  const [listingId, setListingId] = useState("");
  const [options, setOptions] = useState<{ id: string; name: string }[]>([]);
  // Tunable segment thresholds (remembered per browser).
  const [newDays, setNewDays] = useState(() => readNum("aos.growth.newDays", 30));
  const [lapsedMonths, setLapsedMonths] = useState(() => readNum("aos.growth.lapsedMonths", 3));
  const [loyalMin, setLoyalMin] = useState(() => readNum("aos.growth.loyalMin", 2));
  useEffect(() => { localStorage.setItem("aos.growth.newDays", String(newDays)); }, [newDays]);
  useEffect(() => { localStorage.setItem("aos.growth.lapsedMonths", String(lapsedMonths)); }, [lapsedMonths]);
  useEffect(() => { localStorage.setItem("aos.growth.loyalMin", String(loyalMin)); }, [loyalMin]);

  useEffect(() => {
    setError(null); // keep old data visible while re-fetching (no flicker on tweaks)
    const params = new URLSearchParams();
    if (hoScope) params.set("franchiseId", hoScope);
    if (listingId) params.set("listingId", listingId);
    params.set("newDays", String(newDays));
    params.set("lapsedMonths", String(lapsedMonths));
    params.set("loyalMin", String(loyalMin));
    apiGet<GrowthData>(`/api/growth?${params.toString()}`)
      .then((d) => { setData(d); if (d.listingOptions?.length) setOptions(d.listingOptions); })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your growth data"));
  }, [hoScope, listingId, newDays, lapsedMonths, loyalMin]);

  // The inline threshold editor shown at the bottom of the relevant base cards.
  const editorFor = (key: string): React.ReactNode => {
    const wrap = (node: React.ReactNode) => <div className="mt-2.5 flex items-center gap-1.5 border-t border-[#E4E9F5] pt-2.5 text-[11px] font-semibold text-[var(--ink-3)]">{node}</div>;
    if (key === "new") return wrap(<>First booked in the last <NumBox value={newDays} onChange={setNewDays} lo={7} hi={365} /> days</>);
    if (key === "loyal") return wrap(<><NumBox value={loyalMin} onChange={setLoyalMin} lo={2} hi={20} /> + bookings</>);
    if (key === "lapsed") return wrap(<>No booking for <NumBox value={lapsedMonths} onChange={setLapsedMonths} lo={1} hi={36} /> months+</>);
    return null;
  };

  const listQ = listingId ? `&listing=${encodeURIComponent(listingId)}` : "";
  const focusName = options.find((o) => o.id === listingId)?.name;
  const hrefAud = (audienceId?: string, goal?: string) => audienceId ? `/${portal}/email?aud=${encodeURIComponent(audienceId)}${goal ? `&goal=${goal}` : ""}${listQ}` : null;
  const hrefPlay = (p: Play) => p.audienceId ? `/${portal}/email?aud=${encodeURIComponent(p.audienceId)}${GOAL[p.id] ? `&goal=${GOAL[p.id]}` : ""}${listQ}` : `/${portal}/${p.actionView}`;

  const plays = data?.plays ?? [];
  const top = plays.slice(0, 3);
  const more = plays.slice(3);

  // A chip that makes the scope of the data-driven sections unmistakable.
  const scopeChip = focusName
    ? <span className="whitespace-nowrap rounded-full bg-[#E8EEFD] px-2.5 py-1 text-[11px] font-extrabold text-[#2f5fd0]">🎯 {focusName} only</span>
    : <span className="whitespace-nowrap rounded-full bg-[var(--panel)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-3)]">Across all listings</span>;
  const segTotal = (data?.segments ?? []).reduce((a, s) => a + s.count, 0);

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[#E8EDF9] p-5 text-[var(--ink)]">
      <div className="mx-auto max-w-[1120px]">
        {/* Hero with the headline opportunity */}
        <div className="op-hero relative mb-4 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,.5)]" style={{ background: "var(--hero-grad)" }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-[240px]">
              <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-[16px]">🎯</span>
                Grow your numbers
              </div>
              <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">Your families, your listings and your best next moves — read straight from your booking data. Every action opens the right tool, pre-filled.</p>
            </div>
            {data && data.stats.revenueWithinReach > 0 && (
              <div className="rounded-2xl bg-white/12 px-4 py-3 text-right backdrop-blur-sm" title="A rough estimate of extra revenue if you act on the plays below — potential, not guaranteed or money owed.">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/75">Revenue within reach <span className="font-normal">· estimate</span></div>
                <div className="text-[28px] font-extrabold leading-none" style={{ fontFamily: "var(--ff-display)" }}>{gbp(data.stats.revenueWithinReach)}</div>
                <div className="mt-0.5 text-[10.5px] text-white/70">potential if you act on the plays below</div>
              </div>
            )}
          </div>
        </div>

        {error && <div className="mb-3 rounded-lg border border-[#E4E9F5] bg-[#FDE7EF] px-3 py-2 text-[12.5px] text-[#C81E5E]">{error}</div>}

        {/* Where you stand */}
        <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {data ? (
            <>
              <Stat label="Occupancy" value={`${data.stats.occupancy}%`} sub="of upcoming places filled" hint="Share of your upcoming session places that are already booked." />
              <Stat label="Repeat rate" value={`${data.stats.repeatRate}%`} sub="have booked 2+ times" hint="Share of your booked families who have booked more than once." />
              <Stat label="Reviews" value={String(data.stats.reviews)} sub="collected so far" hint="Total reviews you've collected." />
              <Stat label="Families on list" value={String(data.stats.listSize)} sub="have booked before" hint="Families who have ever booked — your marketing base (enquiries are counted separately)." />
            </>
          ) : [0, 1, 2, 3].map((i) => <div key={i} className="h-[86px] animate-pulse rounded-2xl bg-white/60" />)}
        </div>

        {/* Focus on one listing — re-scopes everything below (families, advice, plays). */}
        {options.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2.5 rounded-2xl border border-[#E4E9F5] bg-[var(--surface)] px-4 py-3 shadow-sm">
            <span className="text-[12.5px] font-extrabold text-[var(--ink)]">🎯 Focus on</span>
            <select value={listingId} onChange={(e) => setListingId(e.target.value)}
              className="rounded-lg border border-[#E4E9F5] bg-[var(--surface)] px-3 py-1.5 text-[13px] font-bold text-[#2f5fd0] outline-none focus:border-[#2f6bd8]">
              <option value="">All listings</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            {focusName
              ? <span className="text-[12px] text-[var(--ink-3)]">Showing families &amp; advice for <b className="text-[var(--ink-2)]">{focusName}</b> only.<button type="button" onClick={() => setListingId("")} className="ml-2 font-bold text-[#2f5fd0] hover:underline">Clear ✕</button></span>
              : <span className="text-[12px] text-[var(--ink-3)]">Pick a listing to see who booked it, who lapsed from it, and email them specifically.</span>}
          </div>
        )}

        {!data ? (
          <div className="py-10 text-center text-[13px] text-[var(--ink-3)]">Reading your data…</div>
        ) : (
          <>
            {/* ── YOUR FAMILIES: segmentation bar + advice per audience ── */}
            {(data.audiences.length > 0 || data.segments.length > 0) && (
              <>
                <SectionTitle right={scopeChip} hint="Who's in your world right now — and the single best thing to do with each group.">Your families</SectionTitle>

                {segTotal > 0 && (
                  <div className="mb-3 rounded-2xl border border-[#E4E9F5] bg-[var(--surface)] p-4 shadow-sm">
                    <div className="mb-2 flex items-baseline justify-between">
                      <div className="text-[13px] font-extrabold">Your booked base <span className="font-bold text-[var(--ink-3)]">— everyone who&rsquo;s booked</span></div>
                      <div className="text-[12px] text-[var(--ink-3)]">{segTotal} families</div>
                    </div>
                    <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-[#E8EEFD]">
                      {data.segments.map((s) => (
                        <div key={s.key} title={`${s.label}: ${s.count}`} style={{ width: `${(s.count / segTotal) * 100}%`, background: (TONE[s.tone] ?? TONE.blue).bar }} />
                      ))}
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
                      {data.segments.map((s) => (
                        <div key={s.key} className="flex items-center gap-1.5 text-[11.5px]">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: (TONE[s.tone] ?? TONE.blue).bar }} />
                          <span className="font-bold text-[var(--ink-2)]">{s.label}</span>
                          <span className="text-[var(--ink-3)]">{s.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {data.audiences.filter((a) => a.base).map((a) => <AudienceCard key={a.key} a={a} href={hrefAud(a.audienceId, a.goal)} edit={editorFor(a.key)} />)}
                </div>

                {data.audiences.some((a) => !a.base) && (
                  <>
                    <div className="mb-2.5 flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">
                      <span className="h-px flex-1 bg-[#E8EEFD]" />
                      Not in your booked base — worth chasing too
                      <span className="h-px flex-1 bg-[#E8EEFD]" />
                    </div>
                    <div className="mb-5 grid gap-3 sm:grid-cols-2">
                      {data.audiences.filter((a) => !a.base).map((a) => <AudienceCard key={a.key} a={a} href={hrefAud(a.audienceId, a.goal)} />)}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── YOUR LISTINGS: fill + revenue at stake + advice ── */}
            {data.listings.length > 0 && (
              <>
                <SectionTitle hint="How full each open listing is. The £ = what the empty seats would bring in at your usual price (potential, not guaranteed).">Your listings</SectionTitle>
                <div className="mb-5 flex flex-col gap-2.5">
                  {data.listings.map((l) => {
                    const h = HEALTH[l.health];
                    const href = hrefAud(l.audienceId, l.goal);
                    return (
                      <div key={l.id} className="rounded-2xl border border-[#E4E9F5] bg-[var(--surface)] p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[14.5px] font-extrabold">{l.title}</span>
                              <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide" style={{ background: h.bg, color: h.fg }}>{h.label}</span>
                              {l.nextDate && <span className="text-[11.5px] text-[var(--ink-3)]">next {niceDate(l.nextDate)}</span>}
                            </div>
                          </div>
                          <div className="text-right" title="What those empty seats are worth at your typical price — the most you'd make if every spare place sold. Not guaranteed money.">
                            <div className="text-[16px] font-extrabold leading-none" style={{ color: h.fg }}>{gbp(l.revenueAtStake)}</div>
                            <div className="text-[10.5px] text-[var(--ink-3)]">empty seats, at your usual price</div>
                          </div>
                        </div>
                        {/* occupancy bar */}
                        <div className="mt-2.5 flex items-center gap-2.5">
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#E8EEFD]">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, l.pct)}%`, background: h.bar }} />
                          </div>
                          <span className="flex-none text-[12px] font-extrabold tabular-nums" style={{ color: h.fg }}>{l.pct}%</span>
                        </div>
                        <div className="mt-1 text-[11.5px] text-[var(--ink-3)]">{l.booked} of {l.capacity} places booked · <b className="text-[var(--ink-2)]">{l.spotsLeft} spaces left</b></div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="max-w-[640px] text-[12.5px] leading-[1.5] text-[#2f5fd0]">{l.advice}</p>
                          {href
                            ? <Link href={href} className="flex-none rounded-full bg-[#2f5fd0] px-3.5 py-1.5 text-[12px] font-bold text-white transition-opacity hover:opacity-90">Email active families →</Link>
                            : <Link href={`/${portal}/listings`} className="flex-none rounded-full border border-[#E4E9F5] px-3.5 py-1.5 text-[12px] font-bold text-[#2f5fd0] hover:bg-[#E8EEFD]">Manage listing →</Link>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── TOP OPPORTUNITIES (ranked plays) ── */}
            {top.length > 0 && (
              <>
                <SectionTitle right={scopeChip} hint="Ranked by what'll move the needle most, based on your numbers.">Your top opportunities</SectionTitle>
                <div className="mb-5 flex flex-col gap-3">
                  {top.map((p) => (
                    <div key={p.id} className="rounded-2xl border border-[#E4E9F5] bg-[var(--surface)] p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
                      <div className="flex items-start gap-3.5">
                        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[#E8EEFD] text-[22px]">{EMOJI[p.id] ?? "✨"}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <div className="text-[15.5px] font-extrabold text-[var(--ink)]">{p.title}</div>
                            <span title="A rough estimate of the extra revenue this play could bring — potential, not guaranteed." className="whitespace-nowrap rounded-full bg-[#E2F6EC] px-2.5 py-1 text-[12px] font-extrabold text-[#0f7a43]">{p.impactLabel}</span>
                          </div>
                          <div className="mt-1.5 text-[13px] leading-[1.5] text-[#2f5fd0]"><b className="text-[var(--ink)]">{p.signal}.</b> {p.insight}</div>
                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                            <Link href={hrefPlay(p)} className="inline-flex items-center gap-1.5 rounded-full bg-[#2f5fd0] px-4 py-2 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90">{p.actionLabel} <span aria-hidden>→</span></Link>
                            {p.secondary && <Link href={`/${portal}/${p.secondary.view}`} className="text-[12px] font-bold text-[#2f5fd0] hover:underline">{p.secondary.label}</Link>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {more.length > 0 && (
              <>
                <SectionTitle right={scopeChip}>More plays</SectionTitle>
                <div className="mb-5 overflow-hidden rounded-2xl border border-[#E4E9F5] bg-[var(--surface)] shadow-sm">
                  {more.map((p, i) => (
                    <div key={p.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-[#E4E9F5]" : ""}`}>
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#E8EEFD] text-[17px]">{EMOJI[p.id] ?? "✨"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-extrabold text-[var(--ink)]">{p.title}</div>
                        <div className="text-[12px] text-[var(--ink-3)]">{p.signal}</div>
                      </div>
                      <Link href={hrefPlay(p)} className="flex-none rounded-full border border-[#E4E9F5] px-3 py-1.5 text-[12px] font-bold text-[#2f5fd0] transition-colors hover:bg-[#E8EEFD]">{p.actionLabel} →</Link>
                    </div>
                  ))}
                </div>
              </>
            )}

            {plays.length === 0 && data.listings.length === 0 && (
              <div className="mb-5 rounded-2xl border border-[#E4E9F5] bg-[#E2F6EC] p-5 text-center">
                <div className="text-[26px]">🎉</div>
                <div className="mt-1 text-[15px] font-extrabold text-[#0f7a43]">Nothing urgent — you're running a tight ship</div>
                <p className="mx-auto mt-1 max-w-[440px] text-[12.5px] leading-snug text-[#0f7a43]">No quiet sessions, lapsed families or gaps to chase right now. Keep momentum with a playbook below.</p>
              </div>
            )}

            {/* Evergreen playbooks */}
            <SectionTitle>Playbooks</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {PLAYBOOKS.map((pb) => (
                <div key={pb.title} className="flex flex-col rounded-2xl border border-[#E4E9F5] bg-[var(--surface)] p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-[14px] font-extrabold text-[var(--ink)]"><span className="text-[18px]">{pb.emoji}</span>{pb.title}</div>
                  <p className="mt-1 flex-1 text-[12.5px] leading-[1.5] text-[#2f5fd0]">{pb.body}</p>
                  <Link href={`/${portal}/${pb.view}`} className="mt-2.5 inline-flex w-fit items-center gap-1 text-[12.5px] font-bold text-[#2f5fd0] hover:underline">{pb.cta} →</Link>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
