"use client";

// Marketing strategies → a data-driven GROWTH STUDIO. It reads the provider's own
// numbers (via /api/growth) and turns them into: a headline of revenue within reach,
// a visual breakdown of WHO their families are (with advice per audience), a per-
// LISTING fill + recommendation view, and a ranked list of "plays". Every action
// deep-links to the tool that acts on it (usually the Email composer with the right
// audience + a ready-made subject). Falls back to evergreen playbooks.

import { dateLocale as dl } from "@/lib/i18n/format";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { get as apiGet } from "@/lib/api";
import { useHoScope } from "@/components/franchise/HoScope";
import { useI18n, useT } from "@/lib/i18n/provider";
import { isRTL } from "@/lib/i18n/config";
import { rich } from "@/features/money/rich";
import { audienceView, listingAdvice, playView, segmentLabel } from "./growthI18n";

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
  quiet: { label: "p8fin.grHealthQuiet", bar: "#F5A524", bg: "#FCF1DC", fg: "#F5A524" },
  filling: { label: "p8fin.grHealthFilling", bar: "#2f6bd8", bg: "#E8EEFD", fg: "#2f5fd0" },
  full: { label: "p8fin.grHealthFull", bar: "#16a34a", bg: "#E2F6EC", fg: "#0f7a43" },
};
const gbp = (n: number) => `£${Math.round(n).toLocaleString(dl())}`;
const niceDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(dl(), { day: "numeric", month: "short" }) : "");

const PLAYBOOKS: { emoji: string; title: string; body: string; view: string; cta: string }[] = [
  { emoji: "⚡", title: "p8fin.grPb1Title", body: "p8fin.grPb1Body", view: "marketing", cta: "p8fin.grPb1Cta" },
  { emoji: "🎁", title: "p8fin.grPb2Title", body: "p8fin.grPb2Body", view: "referrals", cta: "p8fin.grPb2Cta" },
  { emoji: "⭐", title: "p8fin.grPb3Title", body: "p8fin.grPb3Body", view: "reviews", cta: "p8fin.grPb3Cta" },
  { emoji: "📣", title: "p8fin.grPb4Title", body: "p8fin.grPb4Body", view: "newsfeed", cta: "p8fin.grPb4Cta" },
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
  const t = useT();
  const tn = TONE[a.tone] ?? TONE.blue;
  const av = audienceView(t, a);
  return (
    <div className="flex flex-col rounded-2xl border border-[#E4E9F5] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-[20px]" style={{ background: tn.bg }}>{a.emoji}</span>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[22px] font-extrabold leading-none" style={{ color: tn.fg, fontFamily: "var(--ff-display)" }}>{a.count}</span>
            <span className="truncate text-[13.5px] font-extrabold text-[var(--ink)]">{av.label}</span>
          </div>
          <div className="text-[11.5px] text-[var(--ink-3)]">{av.blurb}</div>
        </div>
      </div>
      <p className="mt-2.5 flex-1 text-[12.5px] leading-[1.5] text-[#2f5fd0]">{av.advice}</p>
      {href && <Link href={href} className="mt-2.5 inline-flex w-fit items-center gap-1 rounded-full px-3.5 py-1.5 text-[12px] font-bold text-white transition-opacity hover:opacity-90" style={{ background: tn.fg }}>{t("p8fin.grEmailThese", { n: a.count })}</Link>}
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
  const t = useT();
  const arrow = isRTL(useI18n().locale) ? "←" : "→";
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
      .catch((e) => setError(e instanceof Error ? e.message : t("p8fin.grLoadErr")));
  }, [hoScope, listingId, newDays, lapsedMonths, loyalMin]);

  // The inline threshold editor shown at the bottom of the relevant base cards.
  const editorFor = (key: string): React.ReactNode => {
    const wrap = (node: React.ReactNode) => <div className="mt-2.5 flex items-center gap-1.5 border-t border-[#E4E9F5] pt-2.5 text-[11px] font-semibold text-[var(--ink-3)]">{node}</div>;
    const withBox = (tpl: string, box: React.ReactNode) => { const [a, b] = tpl.split("{box}"); return <>{a}{box}{b ?? ""}</>; };
    if (key === "new") return wrap(withBox(t("p8fin.grEdNew"), <NumBox value={newDays} onChange={setNewDays} lo={7} hi={365} />));
    if (key === "loyal") return wrap(withBox(t("p8fin.grEdLoyal"), <NumBox value={loyalMin} onChange={setLoyalMin} lo={2} hi={20} />));
    if (key === "lapsed") return wrap(withBox(t("p8fin.grEdLapsed"), <NumBox value={lapsedMonths} onChange={setLapsedMonths} lo={1} hi={36} />));
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
    ? <span className="whitespace-nowrap rounded-full bg-[#E8EEFD] px-2.5 py-1 text-[11px] font-extrabold text-[#2f5fd0]">{t("p8fin.grScopeOnly", { name: focusName })}</span>
    : <span className="whitespace-nowrap rounded-full bg-[var(--panel)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-3)]">{t("p8fin.grAcrossAll")}</span>;
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
                {t("p8fin.grTitle")}
              </div>
              <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">{t("p8fin.grIntro")}</p>
            </div>
            {data && data.stats.revenueWithinReach > 0 && (
              <div className="rounded-2xl bg-white/12 px-4 py-3 text-end backdrop-blur-sm" title={t("p8fin.grReachTip")}>
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/75">{t("p8fin.grReachLabel")} <span className="font-normal">{t("p8fin.grEstimate")}</span></div>
                <div className="text-[28px] font-extrabold leading-none" style={{ fontFamily: "var(--ff-display)" }}>{gbp(data.stats.revenueWithinReach)}</div>
                <div className="mt-0.5 text-[10.5px] text-white/70">{t("p8fin.grReachSub")}</div>
              </div>
            )}
          </div>
        </div>

        {error && <div className="mb-3 rounded-lg border border-[#E4E9F5] bg-[#FDE7EF] px-3 py-2 text-[12.5px] text-[#C81E5E]">{error}</div>}

        {/* Where you stand */}
        <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {data ? (
            <>
              <Stat label={t("p8fin.grStatOccupancy")} value={`${data.stats.occupancy}%`} sub={t("p8fin.grStatOccupancySub")} hint={t("p8fin.grStatOccupancyHint")} />
              <Stat label={t("p8fin.grStatRepeat")} value={`${data.stats.repeatRate}%`} sub={t("p8fin.grStatRepeatSub")} hint={t("p8fin.grStatRepeatHint")} />
              <Stat label={t("p8fin.grStatReviews")} value={String(data.stats.reviews)} sub={t("p8fin.grStatReviewsSub")} hint={t("p8fin.grStatReviewsHint")} />
              <Stat label={t("p8fin.grStatList")} value={String(data.stats.listSize)} sub={t("p8fin.grStatListSub")} hint={t("p8fin.grStatListHint")} />
            </>
          ) : [0, 1, 2, 3].map((i) => <div key={i} className="h-[86px] animate-pulse rounded-2xl bg-white/60" />)}
        </div>

        {/* Focus on one listing — re-scopes everything below (families, advice, plays). */}
        {options.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2.5 rounded-2xl border border-[#E4E9F5] bg-[var(--surface)] px-4 py-3 shadow-sm">
            <span className="text-[12.5px] font-extrabold text-[var(--ink)]">{t("p8fin.grFocusOn")}</span>
            <select value={listingId} onChange={(e) => setListingId(e.target.value)}
              className="rounded-lg border border-[#E4E9F5] bg-[var(--surface)] px-3 py-1.5 text-[13px] font-bold text-[#2f5fd0] outline-none focus:border-[#2f6bd8]">
              <option value="">{t("p8fin.recAllListings")}</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            {focusName
              ? <span className="text-[12px] text-[var(--ink-3)]">{rich(t("p8fin.grShowingFor", { name: focusName }))}<button type="button" onClick={() => setListingId("")} className="ms-2 font-bold text-[#2f5fd0] hover:underline">{t("p8fin.grClear")}</button></span>
              : <span className="text-[12px] text-[var(--ink-3)]">{t("p8fin.grPickListing")}</span>}
          </div>
        )}

        {!data ? (
          <div className="py-10 text-center text-[13px] text-[var(--ink-3)]">{t("p8fin.grReading")}</div>
        ) : (
          <>
            {/* ── YOUR FAMILIES: segmentation bar + advice per audience ── */}
            {(data.audiences.length > 0 || data.segments.length > 0) && (
              <>
                <SectionTitle right={scopeChip} hint={t("p8fin.grFamiliesHint")}>{t("p8fin.grFamilies")}</SectionTitle>

                {segTotal > 0 && (
                  <div className="mb-3 rounded-2xl border border-[#E4E9F5] bg-[var(--surface)] p-4 shadow-sm">
                    <div className="mb-2 flex items-baseline justify-between">
                      <div className="text-[13px] font-extrabold">{t("p8fin.grBookedBase")} <span className="font-bold text-[var(--ink-3)]">{t("p8fin.grBookedBaseSub")}</span></div>
                      <div className="text-[12px] text-[var(--ink-3)]">{t("p8fin.grFamiliesN", { n: segTotal })}</div>
                    </div>
                    <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-[#E8EEFD]">
                      {data.segments.map((s) => (
                        <div key={s.key} title={`${segmentLabel(t, s.key, s.label)}: ${s.count}`} style={{ width: `${(s.count / segTotal) * 100}%`, background: (TONE[s.tone] ?? TONE.blue).bar }} />
                      ))}
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
                      {data.segments.map((s) => (
                        <div key={s.key} className="flex items-center gap-1.5 text-[11.5px]">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: (TONE[s.tone] ?? TONE.blue).bar }} />
                          <span className="font-bold text-[var(--ink-2)]">{segmentLabel(t, s.key, s.label)}</span>
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
                      {t("p8fin.grNotInBase")}
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
                <SectionTitle hint={t("p8fin.grListingsHint")}>{t("p8fin.grListings")}</SectionTitle>
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
                              <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide" style={{ background: h.bg, color: h.fg }}>{t(h.label)}</span>
                              {l.nextDate && <span className="text-[11.5px] text-[var(--ink-3)]">{t("p8fin.grNextDate", { date: niceDate(l.nextDate) })}</span>}
                            </div>
                          </div>
                          <div className="text-end" title={t("p8fin.grEmptyTip")}>
                            <div className="text-[16px] font-extrabold leading-none" style={{ color: h.fg }}>{gbp(l.revenueAtStake)}</div>
                            <div className="text-[10.5px] text-[var(--ink-3)]">{t("p8fin.grEmptySeats")}</div>
                          </div>
                        </div>
                        {/* occupancy bar */}
                        <div className="mt-2.5 flex items-center gap-2.5">
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#E8EEFD]">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, l.pct)}%`, background: h.bar }} />
                          </div>
                          <span className="flex-none text-[12px] font-extrabold tabular-nums" style={{ color: h.fg }}>{l.pct}%</span>
                        </div>
                        <div className="mt-1 text-[11.5px] text-[var(--ink-3)]">{rich(t("p8fin.grPlacesBooked", { booked: l.booked, cap: l.capacity, left: l.spotsLeft }))}</div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="max-w-[640px] text-[12.5px] leading-[1.5] text-[#2f5fd0]">{listingAdvice(t, l.health, l.advice)}</p>
                          {href
                            ? <Link href={href} className="flex-none rounded-full bg-[#2f5fd0] px-3.5 py-1.5 text-[12px] font-bold text-white transition-opacity hover:opacity-90">{t("p8fin.grEmailActive")}</Link>
                            : <Link href={`/${portal}/listings`} className="flex-none rounded-full border border-[#E4E9F5] px-3.5 py-1.5 text-[12px] font-bold text-[#2f5fd0] hover:bg-[#E8EEFD]">{t("p8fin.grManageListing")}</Link>}
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
                <SectionTitle right={scopeChip} hint={t("p8fin.grTopOppHint")}>{t("p8fin.grTopOpp")}</SectionTitle>
                <div className="mb-5 flex flex-col gap-3">
                  {top.map((p) => { const pv = playView(t, p); return (
                    <div key={p.id} className="rounded-2xl border border-[#E4E9F5] bg-[var(--surface)] p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
                      <div className="flex items-start gap-3.5">
                        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[#E8EEFD] text-[22px]">{EMOJI[p.id] ?? "✨"}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <div className="text-[15.5px] font-extrabold text-[var(--ink)]">{pv.title}</div>
                            <span title={t("p8fin.grPlayTip")} className="whitespace-nowrap rounded-full bg-[#E2F6EC] px-2.5 py-1 text-[12px] font-extrabold text-[#0f7a43]">{pv.impact}</span>
                          </div>
                          <div className="mt-1.5 text-[13px] leading-[1.5] text-[#2f5fd0]"><b className="text-[var(--ink)]">{pv.signal}.</b> {pv.insight}</div>
                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                            <Link href={hrefPlay(p)} className="inline-flex items-center gap-1.5 rounded-full bg-[#2f5fd0] px-4 py-2 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90">{pv.action} <span aria-hidden>{arrow}</span></Link>
                            {p.secondary && <Link href={`/${portal}/${p.secondary.view}`} className="text-[12px] font-bold text-[#2f5fd0] hover:underline">{pv.secondary ?? p.secondary.label}</Link>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ); })}
                </div>
              </>
            )}

            {more.length > 0 && (
              <>
                <SectionTitle right={scopeChip}>{t("p8fin.grMorePlays")}</SectionTitle>
                <div className="mb-5 overflow-hidden rounded-2xl border border-[#E4E9F5] bg-[var(--surface)] shadow-sm">
                  {more.map((p, i) => { const pv = playView(t, p); return (
                    <div key={p.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-[#E4E9F5]" : ""}`}>
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#E8EEFD] text-[17px]">{EMOJI[p.id] ?? "✨"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-extrabold text-[var(--ink)]">{pv.title}</div>
                        <div className="text-[12px] text-[var(--ink-3)]">{pv.signal}</div>
                      </div>
                      <Link href={hrefPlay(p)} className="flex-none rounded-full border border-[#E4E9F5] px-3 py-1.5 text-[12px] font-bold text-[#2f5fd0] transition-colors hover:bg-[#E8EEFD]">{pv.action} {arrow}</Link>
                    </div>
                  ); })}
                </div>
              </>
            )}

            {plays.length === 0 && data.listings.length === 0 && (
              <div className="mb-5 rounded-2xl border border-[#E4E9F5] bg-[#E2F6EC] p-5 text-center">
                <div className="text-[26px]">🎉</div>
                <div className="mt-1 text-[15px] font-extrabold text-[#0f7a43]">{t("p8fin.grNothingTitle")}</div>
                <p className="mx-auto mt-1 max-w-[440px] text-[12.5px] leading-snug text-[#0f7a43]">{t("p8fin.grNothingBody")}</p>
              </div>
            )}

            {/* Evergreen playbooks */}
            <SectionTitle>{t("p8fin.grPlaybooks")}</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {PLAYBOOKS.map((pb) => (
                <div key={pb.title} className="flex flex-col rounded-2xl border border-[#E4E9F5] bg-[var(--surface)] p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-[14px] font-extrabold text-[var(--ink)]"><span className="text-[18px]">{pb.emoji}</span>{t(pb.title)}</div>
                  <p className="mt-1 flex-1 text-[12.5px] leading-[1.5] text-[#2f5fd0]">{t(pb.body)}</p>
                  <Link href={`/${portal}/${pb.view}`} className="mt-2.5 inline-flex w-fit items-center gap-1 text-[12.5px] font-bold text-[#2f5fd0] hover:underline">{t(pb.cta)} {arrow}</Link>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
