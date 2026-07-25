"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { get as apiGet } from "@/lib/api";

const OPERATOR = new Set(["freelancer", "company", "franchise"]);
const days = (iso?: string | null) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)) : 0);
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");

/**
 * A slim bar across operator portals during a free trial (or while cancelling)
 * — nudges the operator to the Subscription page. Silent for active/none.
 */
export function TrialBanner({ portal }: { portal: string }) {
  const [c, setC] = useState<{ status: string; trialEndsAt?: string | null; cancelAt?: string | null } | null>(null);

  useEffect(() => {
    if (!OPERATOR.has(portal)) return;
    let cancelled = false;
    apiGet<{ current: { status: string; trialEndsAt?: string | null; cancelAt?: string | null } }>("/api/subscription")
      .then((d) => { if (!cancelled) setC(d.current); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [portal]);

  if (!c) return null;
  const href = `/${portal}/subscription`;

  if (c.status === "trialing") {
    const d = days(c.trialEndsAt);
    return (
      <Link href={href} className="block bg-white px-4 py-2 text-center text-[12.5px] font-bold text-[#1d3a8f]">
        Free trial — {d} day{d === 1 ? "" : "s"} left · <span className="underline">Manage plan →</span>
      </Link>
    );
  }
  if (c.status === "canceling") {
    return (
      <Link href={href} className="block bg-[#a5670a] px-4 py-2 text-center text-[12.5px] font-bold text-white">
        Cancels {fmt(c.cancelAt)} · <span className="underline">Reactivate →</span>
      </Link>
    );
  }
  return null;
}
