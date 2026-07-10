"use client";

import { useEffect } from "react";
import type { BookingPortal } from "./types";
import { useBookingsStore } from "./store";
import { BookingsList } from "./BookingsList";
import { BookingDetail } from "./BookingDetail";
import { TakeBookingModal } from "./TakeBookingModal";

/**
 * Root of the migrated Bookings view (registered per portal in
 * lib/view-registry.tsx). Data comes from the Express API / Firestore —
 * `portal` selects which portal's dataset is loaded.
 */
export function BookingsApp({ portal }: { portal: BookingPortal }) {
  const init = useBookingsStore((s) => s.init);
  const loading = useBookingsStore((s) => s.loading);
  const error = useBookingsStore((s) => s.error);
  const openRef = useBookingsStore((s) => s.openRef);
  const booking = useBookingsStore((s) =>
    openRef ? s.bookings.find((b) => b.ref === openRef) : null,
  );

  useEffect(() => init(portal), [init, portal]);

  return (
    <div className="text-[var(--ink)]">
      {error && (
        <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">
          {error}
        </div>
      )}
      {loading ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">
          Loading bookings…
        </div>
      ) : booking ? (
        <BookingDetail booking={booking} />
      ) : (
        <BookingsList />
      )}
      <TakeBookingModal />
    </div>
  );
}
