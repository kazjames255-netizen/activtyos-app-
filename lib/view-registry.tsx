import type { ComponentType } from "react";
import type { PortalKey } from "./nav/config";
import { BlocksApp } from "@/features/blocks/BlocksApp";
import { BookingsApp } from "@/features/bookings/BookingsApp";
import { CustomersApp } from "@/features/customers/CustomersApp";
import { FinanceAnalyticsApp } from "@/features/money/FinanceAnalyticsApp";
import { IncidentsApp } from "@/features/incidents/IncidentsApp";
import { LogConcernApp } from "@/features/incidents/LogConcernApp";
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
import { MarketingStrategiesApp } from "@/features/marketing/MarketingStrategiesApp";
import { ReferralsApp } from "@/features/referrals/ReferralsApp";
import { EmailApp } from "@/features/email/EmailApp";
import { DocumentsApp } from "@/features/documents/DocumentsApp";
import { ComplianceApp } from "@/features/compliance/ComplianceApp";
import { MoneyOutApp } from "@/features/money/MoneyOutApp";
import { MoneyInApp } from "@/features/money/MoneyInApp";
import { SubscriptionApp } from "@/features/money/SubscriptionApp";
import { SplitFeesApp } from "@/features/money/SplitFeesApp";
import { NewsfeedApp } from "@/features/newsfeed/NewsfeedApp";
import { ParentNewsfeedApp } from "@/features/newsfeed/ParentNewsfeedApp";
import { MessagesApp } from "@/features/messages/MessagesApp";
import { TasksApp } from "@/features/tasks/TasksApp";
import { TripsApp } from "@/features/trips/TripsApp";
import { ParentTripsApp } from "@/features/trips/ParentTripsApp";
import { ScheduleApp as RotaApp } from "@/features/schedule/ScheduleApp";
import { CalendarApp } from "@/features/calendar/CalendarApp";
import { InventoryApp } from "@/features/inventory/InventoryApp";
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
import { MembershipsApp } from "@/features/parent/MembershipsApp";
import { ChildrenApp } from "@/features/parent/ChildrenApp";
import { BookingsHubApp } from "@/features/parent/BookingsHub";
import { ProvidersApp } from "@/features/platform/ProvidersApp";
import { PlatformAnalyticsApp } from "@/features/platform/PlatformAnalyticsApp";
import { PlatformEngagementApp } from "@/features/platform/PlatformEngagementApp";
import { PlatformFeaturesApp } from "@/features/platform/PlatformFeaturesApp";
import { PlatformAtRiskApp } from "@/features/platform/PlatformAtRiskApp";
import { SalesApp } from "@/features/platform/SalesApp";
import { SupportInboxApp } from "@/features/platform/SupportInboxApp";
import { TeamApp } from "@/features/team/TeamApp";
import { TimetableApp } from "@/features/timetable/TimetableApp";
import { StaffTimetableApp } from "@/features/timetable/PublishedTimetable";
import { ParentTimetableApp } from "@/features/timetable/ParentTimetable";
import { planned } from "@/features/planned/PlannedApp";
import { AiAssistant } from "@/features/ai/AiApp";

// Roadmap areas — honest "Planned" pages until the real feature lands
// (never the old prototype's canned data). Swap for a real component here
// when built; the nav item needs no change.
const PayrollPlanned = (portal: string, scheduleView: string) =>
  planned({
    title: "Payroll",
    blurb: "Hours from the rota, rates per role, and a run-ready payroll export each month.",
    links: [
      { href: `/${portal}/${scheduleView}`, label: portal === "company" ? "Team & invites" : "Schedule", hint: "who works, and when" },
      { href: `/${portal}/finance`, label: "Finances", hint: "money in and out today" },
    ],
  });

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
    incidents: () => <LogConcernApp />,
    accidents: () => <IncidentsApp kind="accident" />,
    medication: MedicationApp,
    meals: MealsApp,
    moments: MomentsApp,
    customers: CustomersApp,
    finance: FinanceAnalyticsApp,
    reconciliation: ReconciliationApp,
    tasks: TasksApp,
    trips: TripsApp,
    calendar: CalendarApp,
    inventory: InventoryApp,
    locations: LocationsApp,
    newsfeed: NewsfeedApp,
    messages: () => <MessagesApp mode="operator" />,
    activityos: SupportApp,
    support: SupportApp,
    templates: TemplatesApp,
    expenses: MoneyOutApp,
    purchasing: MoneyInApp,
    invoices: MoneyInApp,
    subscription: SubscriptionApp,
    documents: DocumentsApp,
    compliance: ComplianceApp,
    marketing: MarketingApp,
    "marketing-strategies": MarketingStrategiesApp,
    referrals: ReferralsApp,
    splitfees: SplitFeesApp,
    email: EmailApp,
    account: AccountApp,
    privacy: PrivacyApp,
    ai: () => <AiAssistant kind="operator" />,
    payroll: PayrollPlanned("company", "staff"),
    schedule: planned({
      title: "Staff schedule",
      blurb: "Who's on shift, where — build the rota across your sites, then it feeds registers, ratios and payroll.",
      links: [
        { href: "/company/staff", label: "Staff", hint: "your team & invites" },
        { href: "/company/payroll", label: "Payroll", hint: "hours become pay" },
      ],
    }),
    "ho-framework": planned({
      title: "Franchise Support Framework",
      blurb: "The head-office playbook per franchise: support visits, standards checks and improvement plans in one place.",
      links: [{ href: "/company/staff", label: "Team & invites", hint: "your franchises live here" }],
    }),
    // Routable aliases so old links don't 404 — the sidebar shows only the
    // canonical item, but the slug still resolves to the real view.
    registers: RegistersApp,
    children: CustomersApp,
    "company-setup": SetupApp,
    moments2: MomentsApp,
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
    incidents: () => <LogConcernApp />,
    accidents: () => <IncidentsApp kind="accident" />,
    medication: MedicationApp,
    meals: MealsApp,
    moments: MomentsApp,
    customers: CustomersApp,
    finance: FinanceAnalyticsApp,
    reconciliation: ReconciliationApp,
    tasks: TasksApp,
    trips: TripsApp,
    schedule: RotaApp,
    calendar: CalendarApp,
    inventory: InventoryApp,
    locations: LocationsApp,
    newsfeed: NewsfeedApp,
    messages: () => <MessagesApp mode="operator" />,
    activityos: SupportApp,
    support: SupportApp,
    templates: TemplatesApp,
    expenses: MoneyOutApp,
    purchasing: MoneyInApp,
    invoices: MoneyInApp,
    subscription: SubscriptionApp,
    compliance: ComplianceApp,
    marketing: MarketingApp,
    "marketing-strategies": MarketingStrategiesApp,
    referrals: ReferralsApp,
    email: EmailApp,
    account: AccountApp,
    privacy: PrivacyApp,
    ai: () => <AiAssistant kind="operator" />,
    payroll: PayrollPlanned("franchise", "schedule"),
    moments2: MomentsApp,
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
    incidents: () => <LogConcernApp />,
    accidents: () => <IncidentsApp kind="accident" />,
    medication: MedicationApp,
    meals: MealsApp,
    moments: MomentsApp,
    customers: CustomersApp,
    finance: FinanceAnalyticsApp,
    reconciliation: ReconciliationApp,
    tasks: TasksApp,
    trips: TripsApp,
    schedule: RotaApp,
    calendar: CalendarApp,
    inventory: InventoryApp,
    locations: LocationsApp,
    newsfeed: NewsfeedApp,
    messages: () => <MessagesApp mode="operator" />,
    activityos: SupportApp,
    support: SupportApp,
    templates: TemplatesApp,
    expenses: MoneyOutApp,
    purchasing: MoneyInApp,
    invoices: MoneyInApp,
    subscription: SubscriptionApp,
    compliance: ComplianceApp,
    marketing: MarketingApp,
    "marketing-strategies": MarketingStrategiesApp,
    referrals: ReferralsApp,
    email: EmailApp,
    account: AccountApp,
    privacy: PrivacyApp,
    ai: () => <AiAssistant kind="operator" />,
    moments2: MomentsApp,
  },
  staff: {
    dash: StaffDashApp,
    timetable: StaffTimetableApp,
    registers: RegistersApp,
    ratios: RatiosApp,
    // Staff nav uses the singular slug — keyed to match, or the real
    // component is unreachable and the legacy iframe shows instead.
    incident: () => <LogConcernApp />,
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
    ai: () => <AiAssistant kind="staff" />,
    availability: planned({
      title: "My availability",
      blurb: "Tell your organiser which days and hours you can work; the rota builds around it.",
      links: [{ href: "/staff/schedule", label: "Schedule", hint: "your shifts as they stand" }],
    }),
    holiday: planned({
      title: "My holiday",
      blurb: "Request time off and see what's approved, with the rota kept in step automatically.",
      links: [{ href: "/staff/schedule", label: "Schedule", hint: "your shifts as they stand" }],
    }),
    expenses: planned({
      title: "My expenses",
      blurb: "Snap a receipt, claim it back, and track what's been reimbursed.",
      links: [{ href: "/staff/messages", label: "Messages", hint: "send receipts to your organiser today" }],
    }),
    pay: planned({
      title: "My pay",
      blurb: "Payslips, hours worked and what's landing this month — once payroll is built.",
      links: [{ href: "/staff/schedule", label: "Schedule", hint: "your hours live here" }],
    }),
    training: planned({
      title: "Learning Centre",
      blurb: "Required training, refreshers and certificates, tracked per staff member.",
      links: [{ href: "/staff/documents", label: "Documents", hint: "policies and handbooks today" }],
    }),
    children: CustomersApp, // routable alias of Families
    moments2: MomentsApp, // routable alias of Moments
  },
  custdash: {
    browse: BrowseApp,
    timetable: ParentTimetableApp,
    payments: ParentPaymentsApp,
    wallet: WalletApp,
    coupons: CouponsApp,
    refer: ReferApp,
    bookings: BookingsHubApp,
    children: ChildrenApp,
    moments: ParentMomentsApp,
    schedule: BookingsHubApp,
    newsfeed: ParentNewsfeedApp,
    messages: () => <MessagesApp mode="parent" />,
    activityos: SupportApp,
    meals: ParentMealsApp,
    medication: ParentMedicationApp,
    accidents: ParentAccidentsApp,
    trips: ParentTripsApp,
    account: AccountApp,
    privacy: PrivacyApp,
    ai: () => <AiAssistant kind="parent" />,
    memberships: MembershipsApp,
    dash: BrowseApp, // routable alias — parents' home is Browse
  },
  platform: {
    dash: PlatformAnalyticsApp, // Overview retired — /platform/dash lands on Analytics
    providers: ProvidersApp,
    analytics: PlatformAnalyticsApp,
    engagement: PlatformEngagementApp,
    "at-risk": PlatformAtRiskApp,
    sales: SalesApp,
    // Platform tooling on the roadmap — these need PLATFORM-scoped
    // backends (a platform account has no tenant, so the operator
    // components can't run here).
    features: PlatformFeaturesApp,
    billing: ProvidersApp, // merged into Providers & billing
    pricing: ProvidersApp, // Pricing is now a tab on Providers & billing
    support: SupportInboxApp,
    messages: SupportInboxApp,
    email: planned({
      title: "Email",
      blurb: "Platform-level email campaigns to providers, with delivery tracking.",
    }),
    privacy: planned({
      title: "Data & privacy",
      blurb: "Platform-wide data-subject requests, retention rules and audit trail.",
    }),
    ai: () => <AiAssistant kind="platform" />,
  },
};

export function getRegisteredView(portal: PortalKey, view: string): ComponentType | undefined {
  return VIEW_REGISTRY[portal]?.[view];
}
