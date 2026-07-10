import type { ComponentType } from "react";
import type { PortalKey } from "./nav/config";
import { BookingsApp } from "@/features/bookings/BookingsApp";
import { TimetableApp } from "@/features/timetable/TimetableApp";

/**
 * Views that have a true React implementation. Everything else in
 * lib/nav/config.ts falls back to the legacy iframe bridge
 * (components/shell/LegacyViewFrame) until it's migrated — at which point it
 * moves from nav config into this registry, with no routing changes needed.
 */

// Bookings is portal-parameterised: the same feature loads a different
// Firestore dataset per portal (see features/bookings/store.ts init()).
const AdminBookings = () => <BookingsApp portal="admin" />;
const FreelancerBookings = () => <BookingsApp portal="fl" />;

export const VIEW_REGISTRY: Partial<Record<PortalKey, Record<string, ComponentType>>> = {
  admin: {
    bookings: AdminBookings,
    timetable: TimetableApp,
  },
  franchise: {
    timetable: TimetableApp,
  },
  freelancer: {
    bookings: FreelancerBookings,
    timetable: TimetableApp,
  },
};

export function getRegisteredView(portal: PortalKey, view: string): ComponentType | undefined {
  return VIEW_REGISTRY[portal]?.[view];
}
