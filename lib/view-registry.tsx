import type { ComponentType } from "react";
import type { PortalKey } from "./nav/config";
import { BlocksApp } from "@/features/blocks/BlocksApp";
import { BookingsApp } from "@/features/bookings/BookingsApp";
import { CustomersApp } from "@/features/customers/CustomersApp";
import { PaymentsApp } from "@/features/payments/PaymentsApp";
import { IncidentsApp } from "@/features/incidents/IncidentsApp";
import { MealsApp } from "@/features/meals/MealsApp";
import { ParentMealsApp } from "@/features/meals/ParentMealsApp";
import { MomentsApp } from "@/features/moments/MomentsApp";
import { ParentMomentsApp } from "@/features/moments/ParentMomentsApp";
import { MedicationApp } from "@/features/medication/MedicationApp";
import { ParentMedicationApp } from "@/features/medication/ParentMedicationApp";
import { AccountApp } from "@/features/account/AccountApp";
import { PrivacyApp } from "@/features/privacy/PrivacyApp";
import { ParentAccidentsApp } from "@/features/incidents/ParentAccidentsApp";
import { RatiosApp } from "@/features/ratios/RatiosApp";
import { ReconciliationApp } from "@/features/reconciliation/ReconciliationApp";
import { DashboardApp } from "@/features/dashboard/DashboardApp";
import { StaffDashApp } from "@/features/dashboard/StaffDashApp";
import { PaymentsApp as ParentPaymentsApp } from "@/features/parent/PaymentsApp";
import { MarketingApp } from "@/features/marketing/MarketingApp";
import { ReferralsApp } from "@/features/referrals/ReferralsApp";
import { EmailApp } from "@/features/email/EmailApp";
import { DocumentsApp } from "@/features/documents/DocumentsApp";
import { ComplianceApp } from "@/features/compliance/ComplianceApp";
import { ExpensesApp } from "@/features/money/ExpensesApp";
import { MoneyApp } from "@/features/money/MoneyApp";
import { SubscriptionApp } from "@/features/money/SubscriptionApp";
import { SplitFeesApp } from "@/features/money/SplitFeesApp";
import { NewsfeedApp } from "@/features/newsfeed/NewsfeedApp";
import { ParentNewsfeedApp } from "@/features/newsfeed/ParentNewsfeedApp";
import { MessagesApp } from "@/features/messages/MessagesApp";
import { TasksApp } from "@/features/tasks/TasksApp";
import { TripsApp } from "@/features/trips/TripsApp";
import { ScheduleApp as RotaApp } from "@/features/schedule/ScheduleApp";
import { CalendarApp } from "@/features/calendar/CalendarApp";
import { LocationsApp } from "@/features/locations/LocationsApp";
import { RegistersApp } from "@/features/registers/RegistersApp";
import { SetupApp } from "@/features/setup/SetupApp";
import { SupportApp } from "@/features/support/SupportApp";
import { TemplatesApp } from "@/features/templates/TemplatesApp";
import { FreelancerListingsApp } from "@/features/listings/FreelancerListingsApp";
import { BrowseApp } from "@/features/parent/BrowseApp";
import { WalletApp } from "@/features/parent/WalletApp";
import { CouponsApp } from "@/features/parent/CouponsApp";
import { ReferApp } from "@/features/parent/ReferApp";
import { ChildrenApp } from "@/features/parent/ChildrenApp";
import { MyBookingsApp } from "@/features/parent/MyBookingsApp";
import { ScheduleApp } from "@/features/parent/ScheduleApp";
import { OverviewApp } from "@/features/platform/OverviewApp";
import { ProvidersApp } from "@/features/platform/ProvidersApp";
import { TeamApp } from "@/features/team/TeamApp";
import { TimetableApp } from "@/features/timetable/TimetableApp";
import { StaffTimetableApp } from "@/features/timetable/PublishedTimetable";

/**
 * Views that have a true React implementation — which is now ALL of them:
 * every slug in lib/nav/config.ts must be registered here (an unregistered
 * slug 404s; the legacy prototype iframe fallback is gone). A new view
 * ships by adding its component here and its nav item there.
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
    dashboard: DashboardApp,
    setup: SetupApp,
    bookings: BookingsApp,
    listings: FreelancerListingsApp,
    blocks: BlocksApp,
    timetable: TimetableApp,
    staff: TeamApp,
    "admin-registers": RegistersApp,
    ratios: RatiosApp,
    incidents: () => <IncidentsApp kind="incident" />,
    accidents: () => <IncidentsApp kind="accident" />,
    medication: MedicationApp,
    meals: MealsApp,
    moments: MomentsApp,
    customers: CustomersApp,
    finance: PaymentsApp,
    reconciliation: ReconciliationApp,
    tasks: TasksApp,
    trips: TripsApp,
    calendar: CalendarApp,
    locations: LocationsApp,
    newsfeed: NewsfeedApp,
    messages: () => <MessagesApp mode="operator" />,
    activityos: SupportApp,
    support: SupportApp,
    templates: TemplatesApp,
    expenses: ExpensesApp,
    purchasing: MoneyApp,
    invoices: MoneyApp,
    subscription: SubscriptionApp,
    documents: DocumentsApp,
    compliance: ComplianceApp,
    marketing: MarketingApp,
    referrals: ReferralsApp,
    splitfees: SplitFeesApp,
    email: EmailApp,
    account: AccountApp,
    privacy: PrivacyApp,
  },
  franchise: {
    dash: DashboardApp,
    setup: SetupApp,
    bookings: BookingsApp,
    listings: FreelancerListingsApp,
    blocks: BlocksApp,
    timetable: TimetableApp,
    staff: TeamApp,
    registers: RegistersApp,
    ratios: RatiosApp,
    incidents: () => <IncidentsApp kind="incident" />,
    accidents: () => <IncidentsApp kind="accident" />,
    medication: MedicationApp,
    meals: MealsApp,
    moments: MomentsApp,
    customers: CustomersApp,
    finance: PaymentsApp,
    reconciliation: ReconciliationApp,
    tasks: TasksApp,
    trips: TripsApp,
    schedule: RotaApp,
    calendar: CalendarApp,
    locations: LocationsApp,
    newsfeed: NewsfeedApp,
    messages: () => <MessagesApp mode="operator" />,
    activityos: SupportApp,
    support: SupportApp,
    templates: TemplatesApp,
    expenses: ExpensesApp,
    purchasing: MoneyApp,
    invoices: MoneyApp,
    subscription: SubscriptionApp,
    compliance: ComplianceApp,
    marketing: MarketingApp,
    referrals: ReferralsApp,
    email: EmailApp,
    account: AccountApp,
    privacy: PrivacyApp,
  },
  freelancer: {
    dash: DashboardApp,
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
    meals: MealsApp,
    moments: MomentsApp,
    customers: CustomersApp,
    finance: PaymentsApp,
    reconciliation: ReconciliationApp,
    tasks: TasksApp,
    trips: TripsApp,
    schedule: RotaApp,
    calendar: CalendarApp,
    locations: LocationsApp,
    newsfeed: NewsfeedApp,
    messages: () => <MessagesApp mode="operator" />,
    activityos: SupportApp,
    support: SupportApp,
    templates: TemplatesApp,
    expenses: ExpensesApp,
    purchasing: MoneyApp,
    invoices: MoneyApp,
    subscription: SubscriptionApp,
    compliance: ComplianceApp,
    marketing: MarketingApp,
    referrals: ReferralsApp,
    email: EmailApp,
    account: AccountApp,
    privacy: PrivacyApp,
  },
  staff: {
    dash: StaffDashApp,
    timetable: StaffTimetableApp,
    registers: RegistersApp,
    ratios: RatiosApp,
    // Staff nav uses the singular slug — keyed to match, or the real
    // component is unreachable and the legacy iframe shows instead.
    incident: () => <IncidentsApp kind="incident" />,
    accidents: () => <IncidentsApp kind="accident" />,
    medication: MedicationApp,
    meals: MealsApp,
    moments: MomentsApp,
    customers: CustomersApp,
    tasks: TasksApp,
    trips: TripsApp,
    schedule: RotaApp,
    messages: () => <MessagesApp mode="operator" />,
    documents: DocumentsApp,
    compliance: ComplianceApp,
    account: AccountApp,
    privacy: PrivacyApp,
  },
  custdash: {
    browse: BrowseApp,
    payments: ParentPaymentsApp,
    wallet: WalletApp,
    coupons: CouponsApp,
    refer: ReferApp,
    bookings: MyBookingsApp,
    children: ChildrenApp,
    moments: ParentMomentsApp,
    schedule: ScheduleApp,
    newsfeed: ParentNewsfeedApp,
    messages: () => <MessagesApp mode="parent" />,
    activityos: SupportApp,
    meals: ParentMealsApp,
    medication: ParentMedicationApp,
    accidents: ParentAccidentsApp,
    account: AccountApp,
    privacy: PrivacyApp,
  },
  platform: {
    dash: OverviewApp,
    providers: ProvidersApp,
  },
};

export function getRegisteredView(portal: PortalKey, view: string): ComponentType | undefined {
  return VIEW_REGISTRY[portal]?.[view];
}
