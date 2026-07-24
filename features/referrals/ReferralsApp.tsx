"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Card } from "@/components/ui";

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

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const nameOf = (email: string) => email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const fmtAmt = (v?: number, type?: "amount" | "percent") => (type === "percent" ? `${Math.round(v ?? 0)}%` : money(v ?? 0));

export function ReferralsApp() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const portal = usePathname().split("/")[1] || "freelancer";
  const load = () => apiGet<Data>("/api/referrals").then((r) => { setD(r); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  useEffect(() => { void load(); }, []);
  useRealtime(["referrals", "bookings", "discountCodes"], load);
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
      <div className="relative mb-4 overflow-hidden rounded-2xl p-4 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
        <Link href={`/${portal}/setup?tab=refer`} className="absolute right-4 top-4 z-10 rounded-full bg-[#1d3a8f] px-3 py-1 text-[11.5px] font-extrabold text-white shadow-md transition-transform hover:-translate-y-px">⚙️ Change settings</Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[240px] flex-1">
            <div className="flex items-center gap-2 text-[19px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-[15px]">🎁</span>
              Referrals
            </div>
            <p className="mt-1 max-w-[520px] text-[12px] leading-[1.45] text-white/85">
              Families who bring you new bookings. {d?.enabled ? <>Currently <b>{fmtAmt(d.friendOff, d.type)}</b> off for the friend, <b>{fmtAmt(d.referrerReward, d.type)}</b> back for the referrer.</> : <>Referrals are <b>off</b> — switch them on in Setup.</>}
            </p>
            {d && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                <div className="rounded-lg bg-white/15 px-3 py-1.5 backdrop-blur-sm"><div className="text-[17px] font-extrabold leading-none">{d.friendsBooked}</div><div className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-white/80">Friends booked</div></div>
                <div className="rounded-lg bg-white/15 px-3 py-1.5 backdrop-blur-sm"><div className="text-[17px] font-extrabold leading-none">{money(d.referredRevenue)}</div><div className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-white/80">Brought in</div></div>
                <div className="rounded-lg bg-white/15 px-3 py-1.5 backdrop-blur-sm"><div className="text-[17px] font-extrabold leading-none">{d.leaderboard.length}</div><div className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-white/80">Referrers</div></div>
              </div>
            )}
          </div>
        </div>
      </div>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {d && d.leaderboard.length > 0 && (
        <Card className="mb-3.5 p-4">
          <div className="mb-2.5 text-[13.5px] font-extrabold">🏆 Top 5 referrers</div>
          <div className="flex flex-col">
            {d.leaderboard.slice(0, 5).map((l, i) => (
              <div key={l.email} className="flex items-center gap-3 border-b border-dashed border-[var(--line)] py-2 text-[12.5px] last:border-b-0">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#eaf0fc] text-[11px] font-extrabold text-[#1d3a8f]">{i + 1}</span>
                <div className="min-w-0 flex-1 truncate font-bold">{l.name || nameOf(l.email)}</div>
                <div className="flex-none text-right"><span className="font-extrabold tabular-nums">{l.count}</span> <span className="text-[10.5px] text-[var(--ink-3)]">{d.type === "percent" ? `code${l.count === 1 ? "" : "s"}` : `· ${money(l.reward)}`}</span></div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Impact — what referrals brought in vs what the discounts cost (£ vs %). */}
      {d && d.friendsBooked > 0 && (
        <Card className="mb-3.5 grid gap-3 p-4 sm:grid-cols-3">
          <div><div className="text-[20px] font-extrabold leading-none text-[#1d3a8f]">{money(d.referredRevenue)}</div><div className="mt-1 text-[11.5px] text-[var(--ink-3)]">bookings from referrals</div></div>
          <div><div className="text-[20px] font-extrabold leading-none text-[var(--red,#e21d27)]">−{money(d.friendDiscountTotal)}</div><div className="mt-1 text-[11.5px] text-[var(--ink-3)]">discounts given · <b>{costPct}%</b> of revenue</div></div>
          <div><div className="text-[20px] font-extrabold leading-none">{d.rewardsRedeemed}<span className="text-[14px] font-bold text-[var(--ink-3)]"> / {d.rewardsIssued}</span></div><div className="mt-1 text-[11.5px] text-[var(--ink-3)]">rewards redeemed · {d.outstandingCount} still out{d.outstandingLiability > 0 ? ` (${money(d.outstandingLiability)} owed)` : ""}</div></div>
        </Card>
      )}

      {/* Last 3 months — friends booked per month (single series, direct labels). */}
      {d && d.friendsBooked > 0 && (() => {
        const max = Math.max(1, ...d.monthly.map((m) => m.count));
        return (
          <Card className="mb-3.5 p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <div className="text-[13.5px] font-extrabold">Last 3 months</div>
              <div className="text-[11px] text-[var(--ink-3)]">friends booked · revenue</div>
            </div>
            <div className="flex items-end gap-4">
              {d.monthly.map((m) => (
                <div key={m.label} className="flex flex-1 flex-col items-center">
                  <div className="mb-1 text-[12px] font-extrabold">{m.count}</div>
                  <div className="w-full max-w-[72px] rounded-md" style={{ height: `${8 + (m.count / max) * 96}px`, background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }} title={`${m.label}: ${m.count} friend${m.count === 1 ? "" : "s"} · ${money(m.revenue)}`} />
                  <div className="mt-2 text-[11.5px] font-bold text-[var(--ink-2)]">{m.label}</div>
                  <div className="text-[10.5px] text-[var(--ink-3)]">{money(m.revenue)}</div>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      {!d ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : d.friendsBooked === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
          <div className="text-[28px]">👥</div>
          <div className="mt-1 text-[14px] font-extrabold text-[var(--ink)]">No referrals yet</div>
          <p className="mx-auto mt-1 max-w-[440px] leading-[1.6]">When a family shares their link and a friend books their first activity, it shows up here — with who referred whom and the reward issued.</p>
        </Card>
      ) : (
        <div>
          {/* Recent — full width, searchable + sortable */}
          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
              <div className="text-[13.5px] font-extrabold">Recent referrals</div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[var(--ink-3)]">🔍</span>
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or booking…" className="w-[200px] rounded-full border border-[var(--line)] bg-[var(--surface)] py-1.5 pl-7 pr-3 text-[12px] text-[var(--ink)] outline-none focus:border-[var(--brand-line,#cdddf7)]" />
                </div>
                <div className="inline-flex overflow-hidden rounded-full border border-[var(--line)] text-[11.5px] font-bold">
                  {([["recent", "Newest"], ["reward", "Top reward"], ["spend", "Top spend"]] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setSort(k)} className="px-3 py-1.5 transition-colors" style={sort === k ? { background: "#2f6bd8", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-col">
              {recentRows.length === 0 ? (
                <div className="py-6 text-center text-[12.5px] text-[var(--ink-3)]">No referrals match “{q}”.</div>
              ) : recentRows.map((r, i) => (
                <div key={i} className="flex items-center gap-2 border-b border-dashed border-[var(--line)] py-2.5 text-[12.5px] last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="truncate"><b>{r.referrerName || nameOf(r.referrerEmail)}</b> <span className="text-[var(--ink-3)]">referred</span> <b>{r.friendName || nameOf(r.friendEmail)}</b></div>
                    <div className="text-[11px] text-[var(--ink-3)]">{fmt(r.at)} · friend spent {money(r.friendSpend ?? 0)}{r.friendDiscount ? ` (saved ${money(r.friendDiscount)})` : ""}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {r.bookingRef
                        ? <Link href={`/${portal}/bookings?ref=${encodeURIComponent(r.bookingRef)}`} className="rounded-full border border-[var(--brand-line,#cdddf7)] bg-[var(--brand-soft,#eaf0fc)] px-2.5 py-0.5 text-[10.5px] font-bold text-[var(--brand-strong,#16306e)] hover:-translate-y-px">View booking {r.bookingRef} ›</Link>
                        : <span className="text-[10.5px] text-[var(--ink-3)]">no booking linked</span>}
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${r.rewardRedeemed ? "bg-[#eaf0fc] text-[#1d3a8f]" : "bg-[var(--panel)] text-[var(--ink-3)]"}`}>{r.rewardRedeemed ? "✓ Reward redeemed" : "Reward not yet used"}</span>
                    </div>
                  </div>
                  <div className="flex-none self-start text-right">
                    <span className="rounded-full bg-[#eaf0fc] px-2.5 py-1 text-[11.5px] font-extrabold text-[#1d3a8f]">{fmtAmt(r.reward ?? 0, r.type ?? d.type)}{r.cap ? ` ≤${money(r.cap)}` : ""}</span>
                    <div className="mt-0.5 text-[10px] text-[var(--ink-3)]">referrer reward</div>
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
