import type { ComponentType } from "react";
import type { PortalKey } from "./nav/config";
import { BookingsApp } from "@/features/bookings/BookingsApp";
import { ListingsApp } from "@/features/listings/ListingsApp";
import { BrowseApp } from "@/features/parent/BrowseApp";
import { ChildrenApp } from "@/features/parent/ChildrenApp";
import { MyBookingsApp } from "@/features/parent/MyBookingsApp";
import { OverviewApp } from "@/features/platform/OverviewApp";
import { ProvidersApp } from "@/features/platform/ProvidersApp";
import { TeamApp } from "@/features/team/TeamApp";
import { TimetableApp } from "@/features/timetable/TimetableApp";

/**
 * Views that have a true React implementation. Everything else in
 * lib/nav/config.ts falls back to the legacy iframe bridge
 * (components/shell/LegacyViewFrame) until it's migrated — at which point it
 * moves from nav config into this registry, with no routing changes needed.
 *
 * Bookings is ONE component for all operator portals — the API scopes the
 * data to the signed-in account's tenant (see server/src/middleware/role.ts).
 */
export const VIEW_REGISTRY: Partial<Record<PortalKey, Record<string, ComponentType>>> = {
  company: {
    bookings: BookingsApp,
    listings: ListingsApp,
    timetable: TimetableApp,
    staff: TeamApp,
  },
  franchise: {
    bookings: BookingsApp,
    listings: ListingsApp,
    timetable: TimetableApp,
    staff: TeamApp,
  },
  freelancer: {
    bookings: BookingsApp,
    listings: ListingsApp,
    timetable: TimetableApp,
  },
  custdash: {
    browse: BrowseApp,
    bookings: MyBookingsApp,
    children: ChildrenApp,
  },
  platform: {
    dash: OverviewApp,
    providers: ProvidersApp,
  },
};

export function getRegisteredView(portal: PortalKey, view: string): ComponentType | undefined {
  return VIEW_REGISTRY[portal]?.[view];
}
