"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";
import { PageHero, TabStrip } from "@/components/OperatorPage";
import { MyBookingsApp } from "./MyBookingsApp";
import { MyTimetableApp } from "./MyTimetableApp";
import { PaymentsApp } from "./PaymentsApp";

// custdash — the family's bookings, timetable and payments as tabs of one area,
// styled like the operator booking area (blue gradient hero + gradient tab
// strip). The old "My schedule" page is gone; its detail (venue, times, staff,
// overlap warnings, edit/cancel) now lives on the booking cards, and the
// day-by-day view is the Timetable tab. ?tab=payments / ?tab=timetable open those.
type Tab = "bookings" | "timetable" | "payments";

export function BookingsHubApp() {
  const params = useSearchParams();
  const q = params.get("tab");
  const initial: Tab = q === "payments" ? "payments" : q === "timetable" ? "timetable" : "bookings";
  const [tab, setTab] = useState<Tab>(initial);

  const meta: Record<Tab, { label: string; lede: string }> = {
    bookings: { label: "My bookings", lede: "Your family’s places, days and details — status updates as the provider confirms." },
    timetable: { label: "Schedule", lede: "Your child’s sessions day by day — what, when, where and who." },
    payments: { label: "My payments", lede: "Everything your family owes and has paid — download receipts as proof of purchase." },
  };
  const tabs: [Tab, string][] = [
    ["bookings", "My bookings"],
    ["timetable", "Schedule"],
    ["payments", "My payments"],
  ];

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={{ background: "var(--bg)", color: "var(--ink)" }}>
      <PageHero
        title={meta[tab].label}
        lede={meta[tab].lede}
        icon="🎟️"
        actions={
          <Link href="/custdash/browse">
            <Button variant="primary">+ Book an activity</Button>
          </Link>
        }
      />
      <TabStrip tabs={tabs} value={tab} onChange={setTab} />

      {tab === "bookings" && <MyBookingsApp hideHeader />}
      {tab === "timetable" && <MyTimetableApp />}
      {tab === "payments" && <PaymentsApp hideHeader />}
    </div>
  );
}
