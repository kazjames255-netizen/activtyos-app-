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
  const load = () =>
    apiGet<Coupon[]>("/api/my/coupons").then((r) => setCoupons(r ?? [])).catch(() => setCoupons([]));
  useEffect(() => { void load(); }, []);
  useRealtime(["discountCodes", "bookings"], load);

  if (!coupons) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading your coupons…</div>;

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Coupons &amp; discount codes</h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">
        Codes you can use — they&apos;re ready and waiting at checkout, so there&apos;s nothing to copy. Just book and tap the code to apply.
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
              <span className="rounded-lg border border-dashed border-[var(--brand-line,#cdddf7)] bg-[var(--brand-soft,#eaf0fc)] px-3 py-1.5 font-mono text-[15px] font-extrabold tracking-wider text-[var(--brand-strong,#16306e)]">
                {c.code}
              </span>
              <span className="rounded-full bg-[#e7f8ee] px-2.5 py-1 text-[12.5px] font-extrabold text-[#0f7a44]">{valueLabel(c)}</span>
              {c.reserved && <span className="rounded-full bg-[#fdeefb] px-2.5 py-1 text-[11.5px] font-bold text-[#a3238e]">🎁 Just for you</span>}
              <div className="min-w-[160px] flex-1">
                <div className="text-[11.5px] text-[var(--ink-3)]">
                  {c.listingName ? `${c.listingName} only` : "All listings"}
                  {c.minSpend ? ` · min ${money(c.minSpend)}` : ""}
                  {c.expiry ? ` · until ${fmt(c.expiry)}` : " · no expiry"}
                </div>
              </div>
              <span className="flex-none rounded-full bg-[var(--brand-soft,#eaf0fc)] px-3 py-1.5 text-[11.5px] font-bold text-[var(--brand-strong,#16306e)]">✓ Applied at checkout</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
