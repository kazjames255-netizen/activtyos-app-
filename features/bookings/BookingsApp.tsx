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
  const listingFilter = useBookingsStore((s) => s.listingFilter);
  const dayFilter = useBookingsStore((s) => s.dayFilter);
  const rangeFilter = useBookingsStore((s) => s.rangeFilter);
  const seasonFilter = useBookingsStore((s) => s.seasonFilter);
  const booking = useBookingsStore((s) =>
    openRef ? s.bookings.find((b) => b.ref === openRef) : null,
  );

  useEffect(() => void refresh(), [refresh]);
  useRealtime(["bookings"], refresh);

  const open = useBookingsStore((s) => s.open);
  const close = useBookingsStore((s) => s.close);
  const openCreate = useBookingsStore((s) => s.openCreate);
  const setFilter = useBookingsStore((s) => s.setFilter);
  const setQuery = useBookingsStore((s) => s.setQuery);
  const setListingFilter = useBookingsStore((s) => s.setListingFilter);
  const setDayFilter = useBookingsStore((s) => s.setDayFilter);
  const setRangeFilter = useBookingsStore((s) => s.setRangeFilter);
  const setSeasonFilter = useBookingsStore((s) => s.setSeasonFilter);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Two-way sync between the store and the URL — the store owns the list's
  // filters + which booking is open; the URL is what makes Back/Forward and
  // refresh work on them. One effect, not a "read from URL" one plus a
  // "write to URL" one watching the store: with two effects, React 18
  // StrictMode's dev-only double-invoke (mount → simulate unmount → mount
  // again, with NO re-render between the two) ran the write-back effect a
  // second time using the FIRST invocation's still-stale closured store
  // values (the read effect's setState calls don't take effect until the
  // next render) — so it "wrote back" the pre-hydration empty filters over
  // whatever a deep link had just asked for, silently stripping them. One
  // effect sidesteps that: every run first asks "did the URL move since I
  // last looked, or did the store move?" and only ever acts on the one that
  // actually changed, which is well-defined even when double-invoked with
  // identical stale inputs (it's idempotent either way).
  const syncedQS = useRef<string | null>(null);
  const lastTake = useRef<string | null>(null);
  useEffect(() => {
    const urlQS = searchParams.toString();

    // The URL moved since we last resolved (mount, a deep link, Back/
    // Forward) — adopt it into the store. Each setter already no-ops when
    // the store agrees, so this is safe to run more than once for the same
    // URL (StrictMode, or just this effect's own bookkeeping).
    if (urlQS !== syncedQS.current) {
      const ref = searchParams.get("ref");
      if ((ref ?? null) !== openRef) { if (ref) open(ref); else close(); }
      const f = searchParams.get("filter");
      const nextFilter = f && (FILTER_VALUES as string[]).includes(f) ? (f as BookingFilter) : "all";
      if (nextFilter !== filter) setFilter(nextFilter);
      const q = searchParams.get("q") ?? "";
      if (q !== query) setQuery(q);
      const listing = searchParams.get("listing") ?? "";
      if (listing !== listingFilter) setListingFilter(listing);
      const day = searchParams.get("day") ?? "";
      if (day !== dayFilter) setDayFilter(day);
      const range = searchParams.get("range") ?? "";
      const nextRange = range === "today" || range === "yesterday" || range === "week" ? range : "";
      if (nextRange !== rangeFilter) setRangeFilter(nextRange);
      const season = searchParams.get("season") ?? "";
      if (season !== seasonFilter) setSeasonFilter(season);
      // ?take={listingId} — arrived from a listing card's "Book for a
      // customer": open the Take-a-booking modal with that listing
      // preselected. A one-shot trigger, not state to keep synced, so it
      // guards on the value actually changing rather than firing whenever
      // some OTHER param moves.
      const take = searchParams.get("take");
      if (take && take !== lastTake.current) { lastTake.current = take; openCreate(take); }
      // Only declare this URL "resolved" once the store's CURRENT values
      // (this render's, still closured) already match what it asked for —
      // right after mount (or a StrictMode dev double-invoke, which reruns
      // this same effect with the SAME stale closure and no render between
      // the two calls) they won't yet, because the setters above land on
      // the NEXT render, not this one. Leaving `syncedQS` unset until then
      // means the block below never mistakes "haven't caught up yet" for
      // "the user changed something" and writes the stale values back out,
      // clobbering what this branch just asked for.
      const settled =
        (ref ?? null) === openRef && nextFilter === filter && q === query &&
        listing === listingFilter && day === dayFilter && nextRange === rangeFilter && season === seasonFilter;
      if (settled) syncedQS.current = urlQS;
      return;
    }

    // The URL already reflects the last thing we resolved — so if the
    // store disagrees with it now, that's a genuine user action (a filter
    // chip, a row click, typing in search) that needs mirroring OUT. `ref`
    // is real navigable state — Back should close the booking, not leave
    // the page — so it gets its own pushable history entry; the filters are
    // just "what a refresh/Back should restore", so they replace instead of
    // spamming history on every keystroke or chip click.
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (openRef) params.set("ref", openRef); else params.delete("ref");
    if (filter && filter !== "all") params.set("filter", filter); else params.delete("filter");
    if (query.trim()) params.set("q", query); else params.delete("q");
    if (listingFilter) params.set("listing", listingFilter); else params.delete("listing");
    if (dayFilter) params.set("day", dayFilter); else params.delete("day");
    if (rangeFilter) params.set("range", rangeFilter); else params.delete("range");
    if (seasonFilter) params.set("season", seasonFilter); else params.delete("season");
    const qs = params.toString();
    if (qs === urlQS) return; // store already agrees with the URL — nothing to mirror
    const refChanged = (searchParams.get("ref") ?? null) !== openRef;
    syncedQS.current = qs;
    const next = qs ? `${pathname}?${qs}` : pathname;
    if (refChanged) router.push(next); else router.replace(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, openRef, filter, query, listingFilter, dayFilter, rangeFilter, seasonFilter]);

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
