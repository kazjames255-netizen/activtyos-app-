"use client";

import { useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Card } from "@/components/ui";

// custdash/refer — "Refer a friend". The family shares a personal link; a friend
// gets £X off their first booking, and this family earns a £Y code once that
// booking goes through. Read-only: it just shows the code/link + running total
// (GET /api/my/referral); the rewards are minted server-side at checkout.

type Referral = {
  enabled: boolean;
  code?: string;
  link?: string;
  provider?: string;
  type?: "amount" | "percent";
  friendOff?: number;
  referrerReward?: number;
  minSpend?: number;
  capToFriendSpend?: boolean;
  booked?: number;
  earned?: number;
  reason?: string;
};

const money = (n?: number) => `£${Math.round(n ?? 0)}`;

export function ReferApp() {
  const [r, setR] = useState<Referral | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const load = () => apiGet<Referral>("/api/my/referral").then(setR).catch(() => setR({ enabled: false }));
  useEffect(() => { void load(); }, []);
  useRealtime(["referrals", "bookings"], load);

  const copy = async (what: "code" | "link", text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied((c) => (c === what ? null : c)), 1600); } catch { /* still shown */ }
  };
  const share = async () => {
    if (!r?.link) return;
    const off = r.type === "percent" ? `${Math.round(r.friendOff ?? 0)}% off` : `${money(r.friendOff)} off`;
    const text = `Come to ${r.provider} and get ${off} your first booking! Use code ${r.code} at checkout: ${r.link}`;
    if (typeof navigator !== "undefined" && navigator.share) { try { await navigator.share({ title: "Refer a friend", text, url: r.link }); return; } catch { /* cancelled → fall through to copy */ } }
    void copy("link", r.link);
  };

  const isPct = r?.type === "percent";
  const fmt = (v?: number) => (isPct ? `${Math.round(v ?? 0)}%` : money(v));

  if (!r) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>;

  if (!r.enabled) {
    return (
      <div className="text-[var(--ink)]">
        <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Refer a friend</h2>
        <Card className="p-6 text-center">
          <div className="text-[30px]">🎁</div>
          <div className="mt-1 text-[14px] font-extrabold">Not available yet</div>
          <p className="mx-auto mt-1 max-w-[420px] text-[12.5px] leading-[1.6] text-[var(--ink-3)]">{r.reason ?? "Your provider hasn’t switched on referrals yet — check back soon."}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Refer a friend</h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Share the love — and you both win.</p>

      {/* Hero */}
      <div className="overflow-hidden rounded-2xl p-6 text-white shadow-[0_12px_34px_-14px_rgba(29,58,143,.6)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#2f6bd8 55%,#7c4dd6 100%)" }}>
        <div className="text-[26px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>Give {fmt(r.friendOff)}, get {fmt(r.referrerReward)}</div>
        <p className="mt-1.5 max-w-[520px] text-[13px] leading-[1.5] text-white/85">
          Share your link. Your friend gets <b>{fmt(r.friendOff)} off</b> their first booking with {r.provider}
          {r.minSpend ? ` (on ${money(r.minSpend)}+)` : ""}, and you get <b>{fmt(r.referrerReward)}</b> in your Coupons the moment they book.
        </p>

        {/* Code + actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={() => copy("code", r.code!)} title="Copy code" className="rounded-xl border border-dashed border-white/45 bg-white/15 px-4 py-2 font-mono text-[17px] font-extrabold tracking-[0.15em] backdrop-blur-sm transition-colors hover:bg-white/25">
            {r.code}
          </button>
          <button type="button" onClick={share} className="rounded-full bg-white px-5 py-2.5 text-[13px] font-extrabold text-[#1d3a8f] shadow-sm transition-transform hover:-translate-y-px">📣 Share your link</button>
          <button type="button" onClick={() => copy("link", r.link!)} className="rounded-full bg-white/15 px-4 py-2.5 text-[12.5px] font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/25">{copied === "link" ? "Link copied ✓" : "Copy link"}</button>
          {copied === "code" && <span className="text-[12px] font-bold text-white/90">Code copied ✓</span>}
        </div>
      </div>

      {/* Rewards tracker */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[var(--brand-soft,#eaf0fc)] text-[20px]">👥</div>
          <div><div className="text-[22px] font-extrabold leading-none">{r.booked ?? 0}</div><div className="text-[11.5px] text-[var(--ink-3)]">friend{(r.booked ?? 0) === 1 ? "" : "s"} booked with your link</div></div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#e7f8ee] text-[20px]">🎉</div>
          <div><div className="text-[22px] font-extrabold leading-none text-[#0f7a44]">{isPct ? (r.booked ?? 0) : money(r.earned)}</div><div className="text-[11.5px] text-[var(--ink-3)]">{isPct ? "reward codes earned" : "earned in rewards so far"}</div></div>
        </Card>
      </div>

      {/* How it works */}
      <Card className="mt-4 p-4">
        <div className="mb-2.5 text-[13.5px] font-extrabold">How it works</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { n: "1", t: "Share your link", d: "Send it to friends by WhatsApp, text or email." },
            { n: "2", t: "They book", d: `Your friend gets ${fmt(r.friendOff)} off their first booking.` },
            { n: "3", t: "You’re rewarded", d: `${fmt(r.referrerReward)} lands in your Coupons, ready at checkout.` },
          ].map((s) => (
            <div key={s.n} className="flex gap-2.5">
              <div className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[var(--brand-2,#2f6bd8)] text-[12px] font-extrabold text-white">{s.n}</div>
              <div><div className="text-[12.5px] font-bold">{s.t}</div><div className="text-[11.5px] leading-[1.4] text-[var(--ink-3)]">{s.d}</div></div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-[1.5] text-[var(--ink-3)]">Rewards are for brand-new families only, and you can’t use your own link. {fmt(r.referrerReward)} per friend who books.{isPct && r.capToFriendSpend ? " Your reward is capped to what your friend spends on their first booking." : ""}</p>
      </Card>
    </div>
  );
}
