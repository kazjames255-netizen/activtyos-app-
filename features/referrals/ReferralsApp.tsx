"use client";

import { dateLocale as dl } from "@/lib/i18n/format";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { money } from "@/features/bookings/helpers";
import { Card } from "@/components/ui";
import { TourLauncher } from "@/features/common/TourLauncher";
import { useT } from "@/lib/i18n/provider";
import { rich } from "@/features/money/rich";

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;

type Row = { referrerEmail: string; referrerName?: string | null; friendEmail: string; friendName?: string | null; reward?: number; friendOff?: number; friendSpend?: number; friendDiscount?: number; type?: "amount" | "percent"; cap?: number | null; bookingRef?: string | null; rewardRedeemed?: boolean; at?: string; viaCode?: string };
type Data = {
  enabled: boolean;
  type: "amount" | "percent";
  friendOff: number;
  referrerReward: number;
  friendsBooked: number;
  rewardsPaid: number;
  referredRevenue: number;
  friendDiscountTotal: number;
  rewardsIssued: number;
  rewardsRedeemed: number;
  outstandingCount: number;
  outstandingLiability: number;
  monthly: { label: string; count: number; revenue: number }[];
  leaderboard: { email: string; name?: string | null; count: number; reward: number }[];
  recent: Row[];
};

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(dl(), { day: "numeric", month: "short", year: "numeric" }) : "");
const nameOf = (email: string) => email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const fmtAmt = (v?: number, type?: "amount" | "percent") => (type === "percent" ? `${Math.round(v ?? 0)}%` : money(v ?? 0));

// Inline reward-settings editor bits (moved here from Setup).
function RowEd({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-[var(--line)] pb-3 last:border-0 last:pb-0">
      <div className="min-w-0 max-w-[74%]"><div className="text-[13px] font-bold text-[var(--ink)]">{label}</div>{hint && <div className="text-[11px] leading-snug text-[var(--ink-3)]">{hint}</div>}</div>
      <div className="flex-none">{children}</div>
    </div>
  );
}
function Seg({ on, onChange, labels }: { on: boolean; onChange: (v: boolean) => void; labels: [string, string] }) {
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-[var(--line)] text-[12px] font-bold">
      <button type="button" onClick={() => onChange(true)} className="px-3.5 py-1.5 transition-colors" style={on ? { background: "#2f6bd8", color: "#fff" } : { color: "var(--ink-3)" }}>{labels[0]}</button>
      <button type="button" onClick={() => onChange(false)} className="px-3.5 py-1.5 transition-colors" style={!on ? { background: "#2f6bd8", color: "#fff" } : { color: "var(--ink-3)" }}>{labels[1]}</button>
    </div>
  );
}
function NumIn({ value, onChange, pct }: { value: number; onChange: (n: number) => void; pct?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      {!pct && <span className="text-[12px] font-bold text-[var(--ink-3)]">£</span>}
      <input type="number" min="0" max={pct ? 100 : undefined} step="1" value={String(value)} onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))} className="w-[80px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand-line,#cdddf7)]" />
      {pct && <span className="text-[12px] font-bold text-[var(--ink-3)]">%</span>}
    </span>
  );
}

export function ReferralsApp() {
  const t = useT();
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const portal = usePathname().split("/")[1] || "freelancer";
  const load = () => apiGet<Data>("/api/referrals").then((r) => { setD(r); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : t("p8fin.refLoadFailed")));
  useEffect(() => { void load(); }, []);
  useRealtime(["referrals", "bookings", "discountCodes"], load);
  // Reward settings — edited right here now (moved off Setup). Writes settings.referral
  // and reloads the stats so the hero + everything reflects it straight away.
  const { settings, save } = useSettings();
  const r = settings.referral;
  const pct = r.type === "percent";
  const [editOpen, setEditOpen] = useState(false);
  const patchR = (patch: Partial<typeof r>) => { void save({ settings: { ...settings, referral: { ...r, ...patch } } }).then(load).catch(() => {}); };
  // Discount as a share of the revenue those referrals brought in (£ vs %).
  const costPct = d && d.referredRevenue > 0 ? Math.round((d.friendDiscountTotal / d.referredRevenue) * 100) : 0;
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "reward" | "spend">("recent");
  const recentRows = (() => {
    if (!d) return [];
    const needle = q.trim().toLowerCase();
    const rows = d.recent.filter((r) => !needle
      || (r.referrerName || nameOf(r.referrerEmail)).toLowerCase().includes(needle)
      || (r.friendName || nameOf(r.friendEmail)).toLowerCase().includes(needle)
      || (r.bookingRef || "").toLowerCase().includes(needle));
    if (sort === "reward") return [...rows].sort((a, b) => (b.reward ?? 0) - (a.reward ?? 0));
    if (sort === "spend") return [...rows].sort((a, b) => (b.friendSpend ?? 0) - (a.friendSpend ?? 0));
    return rows; // "recent" — already newest-first from the server
  })();

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* Hero — kept compact: title + inline stats on the left, small leaderboard on the right */}
      <div className="relative mb-4 overflow-hidden rounded-2xl p-4 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "var(--hero-grad)" }}>
        <div className="absolute end-4 top-4 z-10 flex items-center gap-2">
          <TourLauncher view="referrals" compact />
          <button type="button" onClick={() => setEditOpen((o) => !o)} className="rounded-full bg-white/20 px-3 py-1.5 text-[12px] font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/30">{t("p8fin.refEditRewardsBtn")}</button>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[240px] flex-1">
            <div className="flex items-center gap-2 text-[19px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-[15px]">🏆</span>
              {t("p8fin.refTitle")}
            </div>
            <p className="mt-1 max-w-[520px] text-[12px] leading-[1.45] text-white/85">
              {t("p8fin.refIntro")} {r.enabled ? rich(t("p8fin.refCurrentlyOn", { friend: fmtAmt(r.friendOff, r.type), referrer: fmtAmt(r.referrerReward, r.type) })) : (() => { const [a, b] = t("p8fin.refOffNotice").split("{link}"); return <>{rich(a)}<button type="button" onClick={() => setEditOpen(true)} className="font-bold underline">{t("p8fin.refEditRewards")}</button>{rich(b ?? "")}</>; })()}
            </p>
            {d && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                <div className="rounded-lg bg-white/15 px-3 py-1.5 backdrop-blur-sm"><div className="text-[17px] font-extrabold leading-none">{d.friendsBooked}</div><div className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-white/80">{t("p8fin.refStatFriends")}</div></div>
                <div className="rounded-lg bg-white/15 px-3 py-1.5 backdrop-blur-sm"><div className="text-[17px] font-extrabold leading-none">{money(d.referredRevenue)}</div><div className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-white/80">{t("p8fin.refStatBroughtIn")}</div></div>
                <div className="rounded-lg bg-white/15 px-3 py-1.5 backdrop-blur-sm"><div className="text-[17px] font-extrabold leading-none">{d.leaderboard.length}</div><div className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-white/80">{t("p8fin.refStatReferrers")}</div></div>
              </div>
            )}
          </div>
        </div>
      </div>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#C81E5E)]">{error}</div>}

      {/* Reward settings — the inline dropdown editor (moved off Setup). */}
      <Card className="mb-3.5 overflow-hidden p-0">
        <button type="button" onClick={() => setEditOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start transition-colors hover:bg-[var(--panel)]">
          <div className="flex items-center gap-2.5">
            <span className="text-[17px]">🎁</span>
            <div>
              <div className="text-[13.5px] font-extrabold">{t("p8fin.refRewardsTitle")}</div>
              <div className="text-[11.5px] text-[var(--ink-3)]">{r.enabled ? `${t("p8fin.refSummaryOn", { friend: fmtAmt(r.friendOff, r.type), referrer: fmtAmt(r.referrerReward, r.type) })}${r.minSpend ? t("p8fin.refSummaryMin", { amount: money(r.minSpend) }) : ""}` : t("p8fin.refSummaryOff")}</div>
            </div>
          </div>
          <span className={`text-[13px] text-[var(--ink-3)] transition-transform ${editOpen ? "rotate-180" : ""}`}>▾</span>
        </button>
        {editOpen && (
          <div className="flex flex-col gap-3 border-t border-[var(--line)] px-4 py-3.5">
            <p className="text-[11.5px] leading-snug text-[var(--ink-3)]">{t("p8fin.refExplain")}</p>
            <RowEd label={t("p8fin.refReferAFriend")} hint={t("p8fin.refReferHint")}>
              <Seg on={r.enabled} onChange={(v) => patchR({ enabled: v })} labels={[t("p8fin.refOn"), t("p8fin.refOff")]} />
            </RowEd>
            <RowEd label={t("p8fin.refRewardType")} hint={t("p8fin.refRewardTypeHint")}>
              <Seg on={r.type === "amount"} onChange={(v) => patchR({ type: v ? "amount" : "percent" })} labels={[t("p8fin.refAmountOff"), t("p8fin.refPctOff")]} />
            </RowEd>
            <RowEd label={t(pct ? "p8fin.refFriendGetsPct" : "p8fin.refFriendGetsAmt")} hint={t("p8fin.refFriendGetsHint")}>
              <NumIn value={r.friendOff} onChange={(n) => patchR({ friendOff: pct ? Math.min(100, n) : n })} pct={pct} />
            </RowEd>
            <RowEd label={t(pct ? "p8fin.refReferrerEarnsPct" : "p8fin.refReferrerEarnsAmt")} hint={t("p8fin.refReferrerEarnsHint")}>
              <NumIn value={r.referrerReward} onChange={(n) => patchR({ referrerReward: pct ? Math.min(100, n) : n })} pct={pct} />
            </RowEd>
            <RowEd label={t("p8fin.refMinSpend")} hint={t("p8fin.refMinSpendHint")}>
              <NumIn value={r.minSpend} onChange={(n) => patchR({ minSpend: n })} />
            </RowEd>
            {pct && (
              <RowEd label={t("p8fin.refCapTitle")} hint={t("p8fin.refCapHint")}>
                <Seg on={r.capToFriendSpend} onChange={(v) => patchR({ capToFriendSpend: v })} labels={[t("p8fin.refOn"), t("p8fin.refOff")]} />
              </RowEd>
            )}
          </div>
        )}
      </Card>

      {d && d.leaderboard.length > 0 && (
        <Card className="mb-3.5 p-4">
          <div className="mb-2.5 text-[13.5px] font-extrabold">{t("p8fin.refTop5")}</div>
          <div className="flex flex-col">
            {d.leaderboard.slice(0, 5).map((l, i) => (
              <div key={l.email} className="flex items-center gap-3 border-b border-dashed border-[var(--line)] py-2 text-[12.5px] last:border-b-0">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#eaf0fc] text-[11px] font-extrabold text-[#1d3a8f]">{i + 1}</span>
                <div className="min-w-0 flex-1 truncate font-bold">{l.name || nameOf(l.email)}</div>
                <div className="flex-none text-end"><span className="font-extrabold tabular-nums">{l.count}</span> <span className="text-[10.5px] text-[var(--ink-3)]">{d.type === "percent" ? t(l.count === 1 ? "p8fin.refCode1" : "p8fin.refCodes") : `· ${money(l.reward)}`}</span></div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Impact — what referrals brought in vs what the discounts cost (£ vs %). */}
      {d && d.friendsBooked > 0 && (
        <Card className="mb-3.5 grid gap-3 p-4 sm:grid-cols-3">
          <div><div className="text-[20px] font-extrabold leading-none text-[#1d3a8f]">{money(d.referredRevenue)}</div><div className="mt-1 text-[11.5px] text-[var(--ink-3)]">{t("p8fin.refImpactBookings")}</div></div>
          <div><div className="text-[20px] font-extrabold leading-none text-[var(--red,#e21d27)]">−{money(d.friendDiscountTotal)}</div><div className="mt-1 text-[11.5px] text-[var(--ink-3)]">{rich(t("p8fin.refImpactDiscounts", { pct: costPct }))}</div></div>
          <div><div className="text-[20px] font-extrabold leading-none">{d.rewardsRedeemed}<span className="text-[14px] font-bold text-[var(--ink-3)]"> / {d.rewardsIssued}</span></div><div className="mt-1 text-[11.5px] text-[var(--ink-3)]">{t("p8fin.refImpactRewards", { n: d.outstandingCount })}{d.outstandingLiability > 0 ? t("p8fin.refImpactOwed", { amount: money(d.outstandingLiability) }) : ""}</div></div>
        </Card>
      )}

      {/* Last 3 months — friends booked per month (single series, direct labels). */}
      {d && d.friendsBooked > 0 && (() => {
        const max = Math.max(1, ...d.monthly.map((m) => m.count));
        return (
          <Card className="mb-3.5 p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <div className="text-[13.5px] font-extrabold">{t("p8fin.refLast3")}</div>
              <div className="text-[11px] text-[var(--ink-3)]">{t("p8fin.refFriendsRevenue")}</div>
            </div>
            <div className="flex items-end gap-4">
              {d.monthly.map((m) => (
                <div key={m.label} className="flex flex-1 flex-col items-center">
                  <div className="mb-1 text-[12px] font-extrabold">{m.count}</div>
                  <div className="w-full max-w-[72px] rounded-md" style={{ height: `${8 + (m.count / max) * 96}px`, background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }} title={t("p8fin.refMonthTip", { label: m.label, n: m.count, amount: money(m.revenue) })} />
                  <div className="mt-2 text-[11.5px] font-bold text-[var(--ink-2)]">{m.label}</div>
                  <div className="text-[10.5px] text-[var(--ink-3)]">{money(m.revenue)}</div>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      {!d ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8fin.refLoading")}</div>
      : d.friendsBooked === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
          <div className="text-[28px]">👥</div>
          <div className="mt-1 text-[14px] font-extrabold text-[var(--ink)]">{t("p8fin.refNone")}</div>
          <p className="mx-auto mt-1 max-w-[440px] leading-[1.6]">{t("p8fin.refNoneHint")}</p>
        </Card>
      ) : (
        <div>
          {/* Recent — full width, searchable + sortable */}
          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
              <div className="text-[13.5px] font-extrabold">{t("p8fin.refRecent")}</div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <span className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[var(--ink-3)]">🔍</span>
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("p8fin.refSearchPh")} className="w-[200px] rounded-full border border-[var(--line)] bg-[var(--surface)] py-1.5 ps-7 pe-3 text-[12px] text-[var(--ink)] outline-none focus:border-[var(--brand-line,#cdddf7)]" />
                </div>
                <div className="inline-flex overflow-hidden rounded-full border border-[var(--line)] text-[11.5px] font-bold">
                  {([["recent", t("p8fin.refSortNewest")], ["reward", t("p8fin.refSortReward")], ["spend", t("p8fin.refSortSpend")]] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setSort(k)} className="px-3 py-1.5 transition-colors" style={sort === k ? { background: "#2f6bd8", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-col">
              {recentRows.length === 0 ? (
                <div className="py-6 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8fin.refNoMatch", { q })}</div>
              ) : recentRows.map((r, i) => (
                <div key={i} className="flex items-center gap-2 border-b border-dashed border-[var(--line)] py-2.5 text-[12.5px] last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{rich(t("p8fin.refReferred", { referrer: `**${r.referrerName || nameOf(r.referrerEmail)}**`, friend: `**${r.friendName || nameOf(r.friendEmail)}**` }))}</div>
                    <div className="text-[11px] text-[var(--ink-3)]">{t("p8fin.refFriendSpent", { date: fmt(r.at), spent: money(r.friendSpend ?? 0) })}{r.friendDiscount ? t("p8fin.refSaved", { amount: money(r.friendDiscount) }) : ""}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {r.bookingRef
                        ? <Link href={`/${portal}/bookings?ref=${encodeURIComponent(r.bookingRef)}`} className="rounded-full border border-[var(--brand-line,#cdddf7)] bg-[var(--brand-soft,#eaf0fc)] px-2.5 py-0.5 text-[10.5px] font-bold text-[var(--brand-strong,#16306e)] hover:-translate-y-px">{t("p8fin.refViewBooking", { ref: r.bookingRef })} ›</Link>
                        : <span className="text-[10.5px] text-[var(--ink-3)]">{t("p8fin.refNoBooking")}</span>}
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${r.rewardRedeemed ? "bg-[#eaf0fc] text-[#1d3a8f]" : "bg-[var(--panel)] text-[var(--ink-3)]"}`}>{r.rewardRedeemed ? t("p8fin.refRedeemed") : t("p8fin.refNotUsed")}</span>
                    </div>
                  </div>
                  <div className="flex-none self-start text-end">
                    <span className="rounded-full bg-[#eaf0fc] px-2.5 py-1 text-[11.5px] font-extrabold text-[#1d3a8f]">{fmtAmt(r.reward ?? 0, r.type ?? d.type)}{r.cap ? ` ≤${money(r.cap)}` : ""}</span>
                    <div className="mt-0.5 text-[10px] text-[var(--ink-3)]">{t("p8fin.refReferrerReward")}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
