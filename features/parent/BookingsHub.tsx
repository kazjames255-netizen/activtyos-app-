"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";
import { MyBookingsApp } from "./MyBookingsApp";
import { PaymentsApp } from "./PaymentsApp";

// custdash — the family's bookings and payments as two tabs of one area. The
// old "My schedule" page is gone; its detail (venue, times, staff, overlap
// warnings, edit/cancel) now lives on the booking cards themselves.
// ?tab=payments opens Payments; otherwise Bookings.
type Tab = "bookings" | "payments";

export function BookingsHubApp() {
  const params = useSearchParams();
  const initial: Tab = params.get("tab") === "payments" ? "payments" : "bookings";
  const [tab, setTab] = useState<Tab>(initial);

  const meta: Record<Tab, { label: string; lede: string }> = {
    bookings: { label: "My bookings", lede: "Your family’s places, days and details — status updates as the provider confirms." },
    payments: { label: "My payments", lede: "Everything your family owes and has paid — download receipts as proof of purchase." },
  };
  const tabs: Tab[] = ["bookings", "payments"];

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            {meta[tab].label}
          </h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">{meta[tab].lede}</p>
        </div>
        <Link href="/custdash/browse">
          <Button variant="primary">+ Book an activity</Button>
        </Link>
      </div>

      <div className="mb-4 inline-flex gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] p-1">
        {tabs.map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 text-[12.5px] font-bold ${tab === key ? "bg-[var(--brand)] text-white" : "text-[var(--ink-2)]"}`}
          >
            {meta[key].label}
          </button>
        ))}
      </div>

      {tab === "bookings" ? <MyBookingsApp hideHeader /> : <PaymentsApp hideHeader />}
    </div>
  );
}
