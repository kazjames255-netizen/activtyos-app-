"use client";

// Franchise-side royalty view — "what I owe my head office". Read-only report;
// the actual collection runs on Stripe Connect (a later milestone) — see the note.

import { useEffect, useState } from "react";
import Link from "next/link";
import { get as apiGet } from "@/lib/api";
import { money } from "@/features/bookings/helpers";
import { Card } from "@/components/ui";
import { useT, tNow } from "@/lib/i18n/provider";

// "**bold**" markers in a catalogue string -> <b>.
const boldify = (s: string) => s.split("**").map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p));

interface Settings { basis: "revenue" | "perBooking"; rate?: number; perBookingFee?: number }
interface Payload { settings: Settings; count: number; revenue: number; collected: number; fee: number }

export function FranchiseRoyaltiesApp() {
  const t = useT();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The same periods head office's Split fees page offers, so the two agree.
  const [period, setPeriod] = useState<"1m" | "3m" | "6m" | "12m" | "all">("all");
  useEffect(() => {
    apiGet<Payload>(`/api/splitfees/mine?period=${period}`).then(setData).catch((e) => setError(e instanceof Error ? e.message : tNow("franchise.couldntLoad")));
  }, [period]);

  if (error) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!data) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">{t("franchise.loading")}</div>;
  const basisLabel = data.settings.basis === "perBooking" ? t("franchise.perBooking", { amount: money(data.settings.perBookingFee ?? 0) }) : t("franchise.pctOfRevenue", { rate: data.settings.rate ?? 0 });

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[#f5f8fd] p-5 text-[#171534]">
      <div className="mx-auto max-w-[860px]">
        <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 100%)" }}>
          <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">£</span>
            {t("franchise.royalties")}
          </div>
          <p className="mt-1.5 text-[12.5px] leading-[1.5] text-white/85">{t("franchise.royaltiesLede")} <b>{basisLabel}</b>.</p>
        </div>

        <div className="mb-3 inline-flex gap-1 rounded-xl border border-[var(--line)] bg-white p-1">
          {([["1m", t("p8fr.royLastMonth")], ["3m", t("franchise.threeMonths")], ["6m", t("franchise.sixMonths")], ["12m", t("franchise.twelveMonths")], ["all", t("p8fr.finAllTime")]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setPeriod(k)} aria-pressed={period === k}
              className="rounded-lg px-3 py-1.5 text-[12px] font-extrabold" style={period === k ? { background: "#1d3a8f", color: "#fff" } : { color: "#3b4668" }}>{label}</button>
          ))}
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[[t("franchise.yourBookings"), String(data.count)], [t("franchise.yourRevenue"), money(data.revenue)], [t("franchise.collected"), money(data.collected)], [t("franchise.royaltyOwed"), money(data.fee)]].map(([k, v], i) => (
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
  const t = useT();
  return (
    <div className="rounded-xl border border-[#cfe0f7] bg-[#eef4fd] p-3.5 text-[12px] leading-relaxed text-[#1d3a8f]">
      <div className="mb-0.5 font-extrabold">{t("franchise.howRoyaltyPaid")}</div>
      {audience === "ho"
        ? <>{boldify(t("p8fr.royNoteHo"))}</>
        : <>{boldify(t("p8fr.royNoteFr"))}</>}
      {audience === "ho" && <div className="mt-1.5"><Link href="/company/getpaid" className="font-extrabold underline">{t("franchise.setupGetPaidStripe")}</Link></div>}
    </div>
  );
}
