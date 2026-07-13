"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { get as apiGet } from "@/lib/api";
import { money, statusTone } from "@/features/bookings/helpers";
import { Badge, Card, SectionHead } from "@/components/ui";

interface Overview {
  tenants: {
    total: number;
    byType: { company: number; freelancer: number };
    recent: { id: string; name: string; type: "company" | "freelancer"; createdAt: string }[];
  };
  bookings: {
    total: number;
    byStatus: Record<string, number>;
    bookedValue: number;
    paidValue: number;
    refundsPending: number;
  };
  listings: { total: number };
  accounts: { total: number; byRole: Record<string, number> };
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
        {label}
      </div>
      <div className="mt-1 text-[26px] font-extrabold leading-none" style={{ fontFamily: "var(--ff-display)" }}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">{sub}</div>}
    </Card>
  );
}

/** platform/dash — the HQ Overview, on live platform-wide data. */
export function OverviewApp() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Overview>("/api/platform/overview")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load overview"));
  }, []);

  if (error) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!data)
    return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading overview…</div>;

  const roleOrder = ["platform", "company", "franchise", "freelancer", "staff", "parent"];

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
        Platform overview
      </h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">
        Live across every provider on the platform.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Providers"
          value={String(data.tenants.total)}
          sub={`${data.tenants.byType.company} compan${data.tenants.byType.company === 1 ? "y" : "ies"} · ${data.tenants.byType.freelancer} freelancer${data.tenants.byType.freelancer === 1 ? "" : "s"}`}
        />
        <Stat
          label="Bookings"
          value={String(data.bookings.total)}
          sub={`${data.bookings.refundsPending} refund request${data.bookings.refundsPending === 1 ? "" : "s"} pending`}
        />
        <Stat
          label="Booked value"
          value={money(data.bookings.bookedValue)}
          sub={`${money(data.bookings.paidValue)} paid`}
        />
        <Stat
          label="Accounts"
          value={String(data.accounts.total)}
          sub={`${data.listings.total} listing${data.listings.total === 1 ? "" : "s"} live`}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <SectionHead>Bookings by status</SectionHead>
          <Card className="p-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.bookings.byStatus).map(([status, n]) => (
                <span key={status} className="flex items-center gap-1.5">
                  <Badge tone={statusTone(status)}>{status}</Badge>
                  <b className="text-[13px]">{n}</b>
                </span>
              ))}
            </div>
          </Card>

          <SectionHead>Accounts by role</SectionHead>
          <Card className="p-4">
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px]">
              {roleOrder
                .filter((r) => data.accounts.byRole[r])
                .map((r) => (
                  <span key={r}>
                    <span className="text-[var(--ink-3)]">{r}</span>{" "}
                    <b>{data.accounts.byRole[r]}</b>
                  </span>
                ))}
            </div>
          </Card>
        </div>

        <div>
          <SectionHead>Newest providers</SectionHead>
          <Card className="p-0">
            {data.tenants.recent.map((t, i) => (
              <div
                key={t.id}
                className={`flex items-center justify-between px-4 py-2.5 ${i > 0 ? "border-t border-[var(--line)]" : ""}`}
              >
                <div>
                  <div className="text-[13px] font-bold">{t.name}</div>
                  <div className="text-[11px] text-[var(--ink-3)]">
                    since {t.createdAt?.slice(0, 10) ?? "—"}
                  </div>
                </div>
                <Badge
                  tone={
                    t.type === "company"
                      ? { bg: "var(--brand-soft)", fg: "var(--brand-strong)" }
                      : { bg: "var(--green-soft,#e7f8ee)", fg: "#0f7a44" }
                  }
                >
                  {t.type}
                </Badge>
              </div>
            ))}
          </Card>
          <div className="mt-2 text-right">
            <Link href="/platform/providers" className="text-[12px] font-bold text-[var(--brand-2)]">
              All providers →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
