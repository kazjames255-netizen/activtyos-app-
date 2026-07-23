"use client";

import { useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Card } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// custdash/coupons — "Coupons & discount codes".
//
// The public codes ("anyone can use it") from every provider the family has
// booked with, plus any code a provider has reserved for this family. Read-only
// discovery: the family copies a code and types it into the checkout box. The
// server (GET /api/my/coupons) only ever returns usable codes — active, not
// expired, not fully used — so nothing shown here is a dead end.
// ─────────────────────────────────────────────────────────────────────────

type Coupon = {
  id: string;
  code: string;
  type: "percent" | "amount" | "perAttendee";
  value: number;
  minSpend: number | null;
  expiry: string | null;
  listingId: string | null;
  listingName: string | null;
  provider: string;
  reserved: boolean;
};

const fmt = (iso?: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";

const valueLabel = (c: Coupon) =>
  c.type === "percent" ? `${c.value}% off` : c.type === "perAttendee" ? `${money(c.value)} off per child` : `${money(c.value)} off`;

export function CouponsApp() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = () =>
    apiGet<Coupon[]>("/api/my/coupons").then((r) => setCoupons(r ?? [])).catch(() => setCoupons([]));
  useEffect(() => { void load(); }, []);
  useRealtime(["discountCodes", "bookings"], load);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1800);
    } catch { /* clipboard blocked — the code is still shown to type manually */ }
  }

  if (!coupons) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading your coupons…</div>;

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Coupons &amp; discount codes</h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">
        Codes from your providers — copy one and enter it at checkout to save on your next booking.
      </p>

      {coupons.length === 0 ? (
        <Card className="p-6 text-center">
          <div className="text-[30px]">🏷️</div>
          <div className="mt-1 text-[14px] font-extrabold">No codes right now</div>
          <p className="mx-auto mt-1 max-w-[420px] text-[12.5px] leading-[1.6] text-[var(--ink-3)]">
            When a provider you&apos;ve booked with runs a discount — or sends you a personal code — it&apos;ll appear here, ready to use at checkout.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {coupons.map((c) => (
            <Card key={c.id} className="flex flex-wrap items-center gap-3 p-4">
              <button
                type="button"
                onClick={() => copy(c.code)}
                title="Copy code"
                className="rounded-lg border border-dashed border-[var(--brand-line,#cdddf7)] bg-[var(--brand-soft,#eaf0fc)] px-3 py-1.5 font-mono text-[15px] font-extrabold tracking-wider text-[var(--brand-strong,#16306e)] transition-colors hover:bg-[var(--brand-soft2,#dbe6fb)]"
              >
                {c.code}
              </button>
              <span className="rounded-full bg-[#e7f8ee] px-2.5 py-1 text-[12.5px] font-extrabold text-[#0f7a44]">{valueLabel(c)}</span>
              {c.reserved && <span className="rounded-full bg-[#fdeefb] px-2.5 py-1 text-[11.5px] font-bold text-[#a3238e]">🎁 Just for you</span>}
              <div className="min-w-[160px] flex-1">
                <div className="text-[13px] font-bold">{c.provider}</div>
                <div className="text-[11.5px] text-[var(--ink-3)]">
                  {c.listingName ? `${c.listingName} only` : "All listings"}
                  {c.minSpend ? ` · min ${money(c.minSpend)}` : ""}
                  {c.expiry ? ` · until ${fmt(c.expiry)}` : " · no expiry"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => copy(c.code)}
                className="flex-none rounded-full bg-[var(--brand-2,#2f6bd8)] px-3.5 py-1.5 text-[12.5px] font-bold text-white transition-transform hover:-translate-y-px"
              >
                {copied === c.code ? "Copied ✓" : "Copy code"}
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
