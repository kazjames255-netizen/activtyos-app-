"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";
import { MyBookingsApp } from "./MyBookingsApp";
import { PaymentsApp } from "./PaymentsApp";

// custdash/bookings — the family's bookings and payments as two tabs of one
// area. "My payments" lets a parent filter and download proof-of-purchase
// receipts. Deep-links: ?tab=payments opens Payments; ?pay=REF still opens the
// pay modal on the Bookings tab (handled inside MyBookingsApp).
export function BookingsHubApp() {
  const params = useSearchParams();
  const initial = params.get("tab") === "payments" ? "payments" : "bookings";
  const [tab, setTab] = useState<"bookings" | "payments">(initial);

  const tabs: [typeof tab, string][] = [
    ["bookings", "My bookings"],
    ["payments", "My payments"],
  ];

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            {tab === "bookings" ? "My bookings" : "My payments"}
          </h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">
            {tab === "bookings"
              ? "Your family’s places — status updates as the provider confirms."
              : "Everything your family owes and has paid — download receipts as proof of purchase."}
          </p>
        </div>
        <Link href="/custdash/browse">
          <Button variant="primary">+ Book an activity</Button>
        </Link>
      </div>

      <div className="mb-4 inline-flex gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] p-1">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 text-[12.5px] font-bold ${tab === key ? "bg-[var(--brand)] text-white" : "text-[var(--ink-2)]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "bookings" ? <MyBookingsApp hideHeader /> : <PaymentsApp hideHeader />}
    </div>
  );
}
