"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Card } from "@/components/ui";

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;

type Row = { referrerEmail: string; referrerName?: string | null; friendEmail: string; friendName?: string | null; reward?: number; friendOff?: number; friendSpend?: number; type?: "amount" | "percent"; cap?: number | null; at?: string; viaCode?: string };
type Data = {
  enabled: boolean;
  type: "amount" | "percent";
  friendOff: number;
  referrerReward: number;
  friendsBooked: number;
  rewardsPaid: number;
  leaderboard: { email: string; name?: string | null; count: number; reward: number }[];
  recent: Row[];
};

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const nameOf = (email: string) => email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const fmtAmt = (v?: number, type?: "amount" | "percent") => (type === "percent" ? `${Math.round(v ?? 0)}%` : money(v ?? 0));

export function ReferralsApp() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => apiGet<Data>("/api/referrals").then((r) => { setD(r); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  useEffect(() => { void load(); }, []);
  useRealtime(["referrals"], load);

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* Hero */}
      <div className="mb-4 rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#2f6bd8 55%,#7c4dd6 100%)" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🎁</span>
          Referrals
        </div>
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">
          Families who bring you new bookings. {d?.enabled ? <>Currently <b>{fmtAmt(d.friendOff, d.type)}</b> off for the friend, <b>{fmtAmt(d.referrerReward, d.type)}</b> back for the referrer — change the amounts in Setup → Refer a friend.</> : <>Referrals are <b>off</b> — switch them on in Setup → Refer a friend.</>}
        </p>
        {d && (
          <div className="mt-4 flex flex-wrap gap-2.5">
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{d.friendsBooked}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">Friends booked</div></div>
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{d.type === "percent" ? d.friendsBooked : money(d.rewardsPaid)}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{d.type === "percent" ? "Reward codes" : "Rewards issued"}</div></div>
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{d.leaderboard.length}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">Referrers</div></div>
          </div>
        )}
      </div>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {!d ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : d.friendsBooked === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
          <div className="text-[28px]">👥</div>
          <div className="mt-1 text-[14px] font-extrabold text-[var(--ink)]">No referrals yet</div>
          <p className="mx-auto mt-1 max-w-[440px] leading-[1.6]">When a family shares their link and a friend books their first activity, it shows up here — with who referred whom and the reward issued.</p>
        </Card>
      ) : (
        <div className="grid gap-3.5 lg:grid-cols-2">
          {/* Leaderboard */}
          <Card className="p-4">
            <div className="mb-2.5 text-[13.5px] font-extrabold">🏆 Top referrers</div>
            <div className="flex flex-col">
              {d.leaderboard.map((l, i) => (
                <div key={l.email} className="flex items-center gap-3 border-b border-dashed border-[var(--line)] py-2 text-[12.5px] last:border-b-0">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[var(--brand-soft,#eaf0fc)] text-[11px] font-extrabold text-[var(--brand-strong,#16306e)]">{i + 1}</span>
                  <div className="min-w-0 flex-1"><div className="truncate font-bold">{l.name || nameOf(l.email)}</div><div className="truncate text-[11px] text-[var(--ink-3)]">{l.email}</div></div>
                  <div className="flex-none text-right"><div className="font-extrabold">{l.count}</div><div className="text-[10.5px] text-[var(--ink-3)]">{d.type === "percent" ? `${l.count} code${l.count === 1 ? "" : "s"}` : `${money(l.reward)} back`}</div></div>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent */}
          <Card className="p-4">
            <div className="mb-2.5 text-[13.5px] font-extrabold">Recent referrals</div>
            <div className="flex flex-col">
              {d.recent.map((r, i) => (
                <div key={i} className="flex items-center gap-2 border-b border-dashed border-[var(--line)] py-2.5 text-[12.5px] last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="truncate"><b>{r.referrerName || nameOf(r.referrerEmail)}</b> <span className="text-[var(--ink-3)]">referred</span> <b>{r.friendName || nameOf(r.friendEmail)}</b></div>
                    <div className="text-[11px] text-[var(--ink-3)]">{fmt(r.at)} · friend spent {money(r.friendSpend ?? 0)} · got {fmtAmt(r.friendOff, r.type ?? d.type)} off</div>
                  </div>
                  <div className="flex-none text-right">
                    <span className="rounded-full bg-[#e7f8ee] px-2.5 py-1 text-[11.5px] font-extrabold text-[#0f7a44]">{fmtAmt(r.reward ?? 0, r.type ?? d.type)}{r.cap ? ` ≤${money(r.cap)}` : ""}</span>
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
