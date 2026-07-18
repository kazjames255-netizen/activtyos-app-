import type { ComponentType } from "react";
import type { PortalKey } from "./nav/config";
import { BlocksApp } from "@/features/blocks/BlocksApp";
import { BookingsApp } from "@/features/bookings/BookingsApp";
import { RegistersApp } from "@/features/registers/RegistersApp";
import { ListingsApp } from "@/features/listings/ListingsApp";
import { FreelancerListingsApp } from "@/features/listings/FreelancerListingsApp";
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
    "admin-registers": RegistersApp,
  },
  franchise: {
    bookings: BookingsApp,
    listings: ListingsApp,
    timetable: TimetableApp,
    staff: TeamApp,
    registers: RegistersApp,
  },
  freelancer: {
    bookings: BookingsApp,
    listings: FreelancerListingsApp,
    blocks: BlocksApp,
    timetable: TimetableApp,
    registers: RegistersApp,
  },
  staff: {
    registers: RegistersApp,
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
