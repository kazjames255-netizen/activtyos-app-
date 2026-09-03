"use client";

// Franchise-side royalty view — "what I owe my head office". Read-only report;
// the actual collection runs on Stripe Connect (a later milestone) — see the note.

import { useEffect, useState } from "react";
import Link from "next/link";
import { get as apiGet } from "@/lib/api";
import { money } from "@/features/bookings/helpers";
import { Card } from "@/components/ui";

interface Settings { basis: "revenue" | "perBooking"; rate?: number; perBookingFee?: number }
interface Payload { settings: Settings; count: number; revenue: number; collected: number; fee: number }

export function FranchiseRoyaltiesApp() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiGet<Payload>("/api/splitfees/mine").then(setData).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load"));
  }, []);

  if (error) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!data) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>;
  const basisLabel = data.settings.basis === "perBooking" ? `${money(data.settings.perBookingFee ?? 0)} per booking` : `${data.settings.rate ?? 0}% of revenue`;

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[#f5f8fd] p-5 text-[#171534]">
      <div className="mx-auto max-w-[860px]">
        <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 100%)" }}>
          <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">£</span>
            Royalties
          </div>
          <p className="mt-1.5 text-[12.5px] leading-[1.5] text-white/85">What you owe your head office on your bookings — currently <b>{basisLabel}</b>.</p>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[["Your bookings", String(data.count)], ["Your revenue", money(data.revenue)], ["Collected", money(data.collected)], ["Royalty owed", money(data.fee)]].map(([k, v], i) => (
            <Card key={k} className="p-4">
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{k}</div>
              <div className={"mt-1 text-[22px] font-extrabold " + (i === 3 ? "text-[var(--brand,#1d3a8f)]" : "")} style={{ fontFamily: "var(--ff-display)" }}>{v}</div>
            </Card>
          ))}
        </div>

        <MoneyMovesNote audience="franchise" />
      </div>
    </div>
  );
}

// Shared "how the royalty actually pays out" note — used on both the HO Split
// fees page and this franchise Royalties page so everyone is clear.
export function MoneyMovesNote({ audience }: { audience: "ho" | "franchise" }) {
  return (
    <div className="rounded-xl border border-[#cfe0f7] bg-[#eef4fd] p-3.5 text-[12px] leading-relaxed text-[#1d3a8f]">
      <div className="mb-0.5 font-extrabold">💳 How the royalty is paid</div>
      {audience === "ho"
        ? <>This page is the <b>report</b> of what each franchise owes. Collection runs on <b>Stripe Connect</b>: each franchise connects its own Stripe account (<b>Get paid</b>), and the royalty is taken automatically from their takings. <b>Auto-collection is coming</b> — until it&rsquo;s switched on, settle these amounts with your franchises as you do now.</>
        : <>This is what you owe head office, calculated from your bookings. Once you connect your Stripe account (<b>Get paid</b>), the royalty is taken automatically from your takings via <b>Stripe Connect</b>. <b>Auto-collection is coming</b> — until then it&rsquo;s settled with your head office as agreed.</>}
      <div className="mt-1.5"><Link href={audience === "ho" ? "/company/getpaid" : "/franchise/getpaid"} className="font-extrabold underline">Set up Get paid (Stripe) →</Link></div>
    </div>
  );
}
