"use client";

import { useBookingsStore } from "./store";
import { BookingsList } from "./BookingsList";
import { BookingDetail } from "./BookingDetail";
import { TakeBookingModal } from "./TakeBookingModal";

/**
 * Root of the migrated admin Bookings view. This React island replaces the
 * legacy `.pbApp` render loop for the admin portal (see app/legacy/mountBookings).
 */
export function BookingsApp() {
  const openRef = useBookingsStore((s) => s.openRef);
  const booking = useBookingsStore((s) =>
    openRef ? s.bookings.find((b) => b.ref === openRef) : null,
  );

  return (
    <div className="text-[var(--ink)]">
      {booking ? <BookingDetail booking={booking} /> : <BookingsList />}
      <TakeBookingModal />
    </div>
  );
}
