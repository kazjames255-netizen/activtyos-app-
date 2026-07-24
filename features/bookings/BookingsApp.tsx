"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useRealtime } from "@/lib/realtime";
import { useBookingsStore } from "./store";
import { BookingsList } from "./BookingsList";
import { BookingDetail } from "./BookingDetail";
import { TakeBookingModal } from "./TakeBookingModal";

/**
 * Root of the migrated Bookings view (registered in lib/view-registry.tsx
 * for every operator portal). The API scopes the data to the signed-in
 * account's tenant — the same component works for company, franchise and
 * freelancer accounts.
 */
export function BookingsApp() {
  const refresh = useBookingsStore((s) => s.refresh);
  const loading = useBookingsStore((s) => s.loading);
  const error = useBookingsStore((s) => s.error);
  const openRef = useBookingsStore((s) => s.openRef);
  const booking = useBookingsStore((s) =>
    openRef ? s.bookings.find((b) => b.ref === openRef) : null,
  );

  useEffect(() => void refresh(), [refresh]);
  useRealtime(["bookings"], refresh);

  // Deep link (e.g. from the Referrals dashboard's "View booking"): open it.
  const open = useBookingsStore((s) => s.open);
  const searchParams = useSearchParams();
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) open(ref);
  }, [searchParams, open]);

  return (
    // Listings and Sessions & blocks each set this light palette locally, so
    // Bookings sat on the portal's near-black while its neighbours were soft
    // blue-white. Same values, same shape — until this moves to one place, a
    // fourth screen will drift the same way.
    <div
      className="-m-5 min-h-[calc(100vh-3.5rem)] p-5"
      style={
        {
          background: "var(--bg)",
          color: "var(--ink)",
          "--bg": "#f5f8fd",
          "--surface": "#ffffff",
          "--panel": "#fbf8fc",
          "--ink": "#171534",
          "--ink-2": "#4a4763",
          "--ink-3": "#8a86a3",
          "--line": "#ece6f1",
        } as React.CSSProperties
      }
    >
      {error && (
        <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">
          {error}
        </div>
      )}
      {loading ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">
          Loading bookings…
        </div>
      ) : (
        // List and pane. Opening a booking used to replace the list entirely,
        // so every look at one cost the place you were in — filter, search and
        // scroll. Now the list narrows to a rail and the booking opens beside
        // it. Below lg there isn't room for both, so the rail hides and it
        // behaves as it always did.
        <div className="flex gap-3">
          <div className={booking ? "hidden w-[264px] flex-none lg:block" : "min-w-0 flex-1"}>
            <BookingsList compact={!!booking} />
          </div>
          {booking && (
            <div className="min-w-0 flex-1">
              <BookingDetail booking={booking} />
            </div>
          )}
        </div>
      )}
      <TakeBookingModal />
    </div>
  );
}
