"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useRealtime } from "@/lib/realtime";
import { useBookingsStore } from "./store";
import type { BookingFilter } from "./types";
import { BookingsList } from "./BookingsList";
import { BookingDetail } from "./BookingDetail";
import { TakeBookingModal } from "./TakeBookingModal";
import { BulkEmailModal } from "./BulkEmailModal";

const FILTER_VALUES: BookingFilter[] = ["all", "approval", "confirmed", "waitlisted", "unpaid", "unreconciled", "cancelled", "requests", "refunds"];

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
  const filter = useBookingsStore((s) => s.filter);
  const query = useBookingsStore((s) => s.query);
  const booking = useBookingsStore((s) =>
    openRef ? s.bookings.find((b) => b.ref === openRef) : null,
  );

  useEffect(() => void refresh(), [refresh]);
  useRealtime(["bookings"], refresh);

  const open = useBookingsStore((s) => s.open);
  const openCreate = useBookingsStore((s) => s.openCreate);
  const setFilter = useBookingsStore((s) => s.setFilter);
  const setQuery = useBookingsStore((s) => s.setQuery);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Deep link (e.g. from the Referrals dashboard's "View booking", or this
  // exact URL reached by a refresh / Back): adopt the URL's state once, on
  // mount — the write-back effects below then keep it in sync from here.
  const restoredFromUrl = useRef(false);
  useEffect(() => {
    if (restoredFromUrl.current) return;
    restoredFromUrl.current = true;
    const ref = searchParams.get("ref");
    if (ref) open(ref);
    const f = searchParams.get("filter");
    if (f && (FILTER_VALUES as string[]).includes(f)) setFilter(f as BookingFilter);
    const q = searchParams.get("q");
    if (q) setQuery(q);
    // ?take={listingId} — arrived from a listing card's "Book for a customer":
    // open the Take-a-booking modal with that listing preselected.
    const take = searchParams.get("take");
    if (take) openCreate(take);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opening a booking row used to touch neither the route nor browser history
  // — Back from a booking skipped the Bookings page entirely (it landed
  // wherever the browser was before Bookings loaded), and refreshing lost
  // which booking/filter was open. `ref` is real navigable state (Back
  // should close the booking, not leave the page) — push it, once per open/
  // close. The filter/search are just "what a refresh should restore" —
  // replace, so typing into search doesn't spam history.
  const lastPushedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!restoredFromUrl.current || lastPushedRef.current === openRef) return;
    lastPushedRef.current = openRef;
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (openRef) params.set("ref", openRef); else params.delete("ref");
    const qs = params.toString();
    const next = qs ? `${pathname}?${qs}` : pathname;
    const current = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    if (next !== current) router.push(next); // already matches (e.g. restoring THIS ref from the URL) — nothing to push
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRef]);

  useEffect(() => {
    if (!restoredFromUrl.current) return;
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (filter && filter !== "all") params.set("filter", filter); else params.delete("filter");
    if (query.trim()) params.set("q", query); else params.delete("q");
    const qs = params.toString();
    const next = qs ? `${pathname}?${qs}` : pathname;
    const current = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    if (next !== current) router.replace(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, query]);

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
      <BulkEmailModal />
    </div>
  );
}
