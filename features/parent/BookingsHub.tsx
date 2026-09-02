"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/provider";
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
  const t = useT();
  const params = useSearchParams();
  const q = params.get("tab");
  const initial: Tab = q === "payments" ? "payments" : q === "timetable" ? "timetable" : "bookings";
  const [tab, setTab] = useState<Tab>(initial);

  const meta: Record<Tab, { label: string; lede: string }> = {
    bookings: { label: t("parent.myBookings"), lede: t("parent.bookingsLede") },
    timetable: { label: t("parent.scheduleLabel"), lede: t("parent.timetableLede") },
    payments: { label: t("parent.myPayments"), lede: t("parent.paymentsLede") },
  };
  const tabs: [Tab, string][] = [
    ["bookings", t("parent.myBookings")],
    ["timetable", t("parent.scheduleLabel")],
    ["payments", t("parent.myPayments")],
  ];

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={{ background: "var(--bg)", color: "var(--ink)" }}>
      <PageHero
        title={meta[tab].label}
        lede={meta[tab].lede}
        icon="🎟️"
        actions={
          <Link href="/custdash/browse">
            <Button variant="primary">{t("parent.bookActivity")}</Button>
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
