import type { ComponentType } from "react";
import type { PortalKey } from "./nav/config";
import { BlocksApp } from "@/features/blocks/BlocksApp";
import { BookingsApp } from "@/features/bookings/BookingsApp";
import { CustomersApp } from "@/features/customers/CustomersApp";
import { PaymentsApp } from "@/features/payments/PaymentsApp";
import { IncidentsApp } from "@/features/incidents/IncidentsApp";
import { MedicationApp } from "@/features/medication/MedicationApp";
import { RatiosApp } from "@/features/ratios/RatiosApp";
import { RegistersApp } from "@/features/registers/RegistersApp";
import { ListingsApp } from "@/features/listings/ListingsApp";
import { SetupApp } from "@/features/setup/SetupApp";
import { FreelancerListingsApp } from "@/features/listings/FreelancerListingsApp";
import { BrowseApp } from "@/features/parent/BrowseApp";
import { ChildrenApp } from "@/features/parent/ChildrenApp";
import { MyBookingsApp } from "@/features/parent/MyBookingsApp";
import { ScheduleApp } from "@/features/parent/ScheduleApp";
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
 *
 * Setup is the same: tenant settings are tenant settings whoever is signed in.
 * Registering it for company and franchise also gives them their first real
 * settings UI — the library editors live inside the freelancer Listings
 * screen, so until now those two portals could edit none of it.
 */
export const VIEW_REGISTRY: Partial<Record<PortalKey, Record<string, ComponentType>>> = {
  company: {
    setup: SetupApp,
    bookings: BookingsApp,
    listings: ListingsApp,
    timetable: TimetableApp,
    staff: TeamApp,
    "admin-registers": RegistersApp,
    ratios: RatiosApp,
    incidents: () => <IncidentsApp kind="incident" />,
    accidents: () => <IncidentsApp kind="accident" />,
    medication: MedicationApp,
    customers: CustomersApp,
    finance: PaymentsApp,
  },
  franchise: {
    setup: SetupApp,
    bookings: BookingsApp,
    listings: ListingsApp,
    timetable: TimetableApp,
    staff: TeamApp,
    registers: RegistersApp,
    ratios: RatiosApp,
    incidents: () => <IncidentsApp kind="incident" />,
    accidents: () => <IncidentsApp kind="accident" />,
    medication: MedicationApp,
    customers: CustomersApp,
    finance: PaymentsApp,
  },
  freelancer: {
    setup: SetupApp,
    bookings: BookingsApp,
    listings: FreelancerListingsApp,
    blocks: BlocksApp,
    timetable: TimetableApp,
    registers: RegistersApp,
    ratios: RatiosApp,
    incidents: () => <IncidentsApp kind="incident" />,
    accidents: () => <IncidentsApp kind="accident" />,
    medication: MedicationApp,
    customers: CustomersApp,
    finance: PaymentsApp,
  },
  staff: {
    registers: RegistersApp,
    ratios: RatiosApp,
    incidents: () => <IncidentsApp kind="incident" />,
    accidents: () => <IncidentsApp kind="accident" />,
    medication: MedicationApp,
    customers: CustomersApp,
  },
  custdash: {
    browse: BrowseApp,
    bookings: MyBookingsApp,
    children: ChildrenApp,
    schedule: ScheduleApp,
  },
  platform: {
    dash: OverviewApp,
    providers: ProvidersApp,
  },
};

export function getRegisteredView(portal: PortalKey, view: string): ComponentType | undefined {
  return VIEW_REGISTRY[portal]?.[view];
}
