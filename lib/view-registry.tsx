import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import type { PortalKey } from "./nav/config";
import { planned } from "@/features/planned/PlannedApp";
const BlocksApp = dynamic(() => import("@/features/blocks/BlocksApp").then((m) => m.BlocksApp));
const BookingsApp = dynamic(() => import("@/features/bookings/BookingsApp").then((m) => m.BookingsApp));
const CustomersApp = dynamic(() => import("@/features/customers/CustomersApp").then((m) => m.CustomersApp));
const FinanceAnalyticsApp = dynamic(() => import("@/features/money/FinanceAnalyticsApp").then((m) => m.FinanceAnalyticsApp));
const IncidentsApp = dynamic(() => import("@/features/incidents/IncidentsApp").then((m) => m.IncidentsApp));
const LogConcernApp = dynamic(() => import("@/features/incidents/LogConcernApp").then((m) => m.LogConcernApp));
const MealsApp = dynamic(() => import("@/features/meals/MealsApp").then((m) => m.MealsApp));
const ParentMealsApp = dynamic(() => import("@/features/meals/ParentMealsApp").then((m) => m.ParentMealsApp));
const MomentsApp = dynamic(() => import("@/features/moments/MomentsApp").then((m) => m.MomentsApp));
const ParentMomentsApp = dynamic(() => import("@/features/moments/ParentMomentsApp").then((m) => m.ParentMomentsApp));
const MedicationApp = dynamic(() => import("@/features/medication/MedicationApp").then((m) => m.MedicationApp));
const ParentMedicationApp = dynamic(() => import("@/features/medication/ParentMedicationApp").then((m) => m.ParentMedicationApp));
const AccountApp = dynamic(() => import("@/features/account/AccountApp").then((m) => m.AccountApp));
const PrivacyApp = dynamic(() => import("@/features/privacy/PrivacyApp").then((m) => m.PrivacyApp));
const ParentAccidentsApp = dynamic(() => import("@/features/incidents/ParentAccidentsApp").then((m) => m.ParentAccidentsApp));
const RatiosApp = dynamic(() => import("@/features/ratios/RatiosApp").then((m) => m.RatiosApp));
const ReconciliationApp = dynamic(() => import("@/features/reconciliation/ReconciliationApp").then((m) => m.ReconciliationApp));
const DashboardApp = dynamic(() => import("@/features/dashboard/DashboardApp").then((m) => m.DashboardApp));
const CompanyDashboardSwitch = dynamic(() => import("@/features/franchise/CompanyDashboardSwitch").then((m) => m.CompanyDashboardSwitch));
const CompanyStaffSwitch = dynamic(() => import("@/features/franchise/CompanyStaffSwitch").then((m) => m.CompanyStaffSwitch));
const CompanyFinanceSwitch = dynamic(() => import("@/features/franchise/CompanyFinanceSwitch").then((m) => m.CompanyFinanceSwitch));
const FranchiseInvitesApp = dynamic(() => import("@/features/franchise/FranchiseInvitesApp").then((m) => m.FranchiseInvitesApp));
const StaffDashApp = dynamic(() => import("@/features/dashboard/StaffDashApp").then((m) => m.StaffDashApp));
const StaffCertsApp = dynamic(() => import("@/features/learning/StaffCertsApp").then((m) => m.StaffCertsApp));
const ParentPaymentsApp = dynamic(() => import("@/features/parent/PaymentsApp").then((m) => m.PaymentsApp));
const MarketingApp = dynamic(() => import("@/features/marketing/MarketingApp").then((m) => m.MarketingApp));
const MarketingStrategiesApp = dynamic(() => import("@/features/marketing/MarketingStrategiesApp").then((m) => m.MarketingStrategiesApp));
const ReferralsApp = dynamic(() => import("@/features/referrals/ReferralsApp").then((m) => m.ReferralsApp));
const ReviewsApp = dynamic(() => import("@/features/reviews/ReviewsApp").then((m) => m.ReviewsApp));
const EmailApp = dynamic(() => import("@/features/email/EmailApp").then((m) => m.EmailApp));
const DocumentsApp = dynamic(() => import("@/features/documents/DocumentsApp").then((m) => m.DocumentsApp));
const StaffDocsApp = dynamic(() => import("@/features/documents/StaffDocsApp").then((m) => m.StaffDocsApp));
const StaffPayslipsApp = dynamic(() => import("@/features/payroll/StaffPayslipsApp").then((m) => m.StaffPayslipsApp));
const HolidayApp = dynamic(() => import("@/features/holiday/HolidayApp").then((m) => m.HolidayApp));
const MyHolidayApp = dynamic(() => import("@/features/holiday/MyHolidayApp").then((m) => m.MyHolidayApp));
const MyAppraisalsApp = dynamic(() => import("@/features/appraisals/MyAppraisalsApp").then((m) => m.MyAppraisalsApp));
const MilestonesApp = dynamic(() => import("@/features/milestones/MilestonesApp").then((m) => m.MilestonesApp));
const TimeClockApp = dynamic(() => import("@/features/timeclock/TimeClockApp").then((m) => m.TimeClockApp));
const TimesheetsApp = dynamic(() => import("@/features/timeclock/TimesheetsApp").then((m) => m.TimesheetsApp));
const PayrollApp = dynamic(() => import("@/features/payroll/PayrollApp").then((m) => m.PayrollApp));
const ComplianceApp = dynamic(() => import("@/features/compliance/ComplianceApp").then((m) => m.ComplianceApp));
const LearningCentreApp = dynamic(() => import("@/features/learning/LearningCentreApp").then((m) => m.LearningCentreApp));
const CredentialsApp = dynamic(() => import("@/features/learning/CredentialsApp").then((m) => m.CredentialsApp));
const MoneyOutApp = dynamic(() => import("@/features/money/MoneyOutApp").then((m) => m.MoneyOutApp));
const MoneyInApp = dynamic(() => import("@/features/money/MoneyInApp").then((m) => m.MoneyInApp));
const SubscriptionApp = dynamic(() => import("@/features/money/SubscriptionApp").then((m) => m.SubscriptionApp));
const SplitFeesApp = dynamic(() => import("@/features/money/SplitFeesApp").then((m) => m.SplitFeesApp));
const FranchiseTerritoriesApp = dynamic(() => import("@/features/franchise/FranchiseTerritoriesApp").then((m) => m.FranchiseTerritoriesApp));
const FranchiseOverviewApp = dynamic(() => import("@/features/franchise/FranchiseOverviewApp").then((m) => m.FranchiseOverviewApp));
const FranchiseFeaturesApp = dynamic(() => import("@/features/franchise/FranchiseFeaturesApp").then((m) => m.FranchiseFeaturesApp));
const CompanyIncidents = dynamic(() => import("@/features/franchise/OversightSwitch").then((m) => m.CompanyIncidents));
const CompanyAccidents = dynamic(() => import("@/features/franchise/OversightSwitch").then((m) => m.CompanyAccidents));
const CompanyMedication = dynamic(() => import("@/features/franchise/OversightSwitch").then((m) => m.CompanyMedication));
const FranchiseRoyaltiesApp = dynamic(() => import("@/features/franchise/FranchiseRoyaltiesApp").then((m) => m.FranchiseRoyaltiesApp));
const PaymentsApp = dynamic(() => import("@/features/payments/PaymentsApp").then((m) => m.PaymentsApp));
const NewsfeedApp = dynamic(() => import("@/features/newsfeed/NewsfeedApp").then((m) => m.NewsfeedApp));
const ParentNewsfeedApp = dynamic(() => import("@/features/newsfeed/ParentNewsfeedApp").then((m) => m.ParentNewsfeedApp));
const MessagesApp = dynamic(() => import("@/features/messages/MessagesApp").then((m) => m.MessagesApp));
const TasksApp = dynamic(() => import("@/features/tasks/TasksApp").then((m) => m.TasksApp));
const TripsApp = dynamic(() => import("@/features/trips/TripsApp").then((m) => m.TripsApp));
const ParentTripsApp = dynamic(() => import("@/features/trips/ParentTripsApp").then((m) => m.ParentTripsApp));
const RotaApp = dynamic(() => import("@/features/schedule/ScheduleApp").then((m) => m.ScheduleApp));
const MyScheduleApp = dynamic(() => import("@/features/schedule/MyScheduleApp").then((m) => m.MyScheduleApp));
const StaffExpensesApp = dynamic(() => import("@/features/staff/StaffExpensesApp").then((m) => m.StaffExpensesApp));
const StaffAnnouncementsApp = dynamic(() => import("@/features/staff/StaffAnnouncementsApp").then((m) => m.StaffAnnouncementsApp));
const StaffOnboardingApp = dynamic(() => import("@/features/staff/StaffOnboardingApp").then((m) => m.StaffOnboardingApp));
const AvailabilityApp = dynamic(() => import("@/features/schedule/AvailabilityApp").then((m) => m.AvailabilityApp));
const CalendarApp = dynamic(() => import("@/features/calendar/CalendarApp").then((m) => m.CalendarApp));
const InventoryApp = dynamic(() => import("@/features/inventory/InventoryApp").then((m) => m.InventoryApp));
const LocationsApp = dynamic(() => import("@/features/locations/LocationsApp").then((m) => m.LocationsApp));
const RegistersApp = dynamic(() => import("@/features/registers/RegistersApp").then((m) => m.RegistersApp));
const SetupApp = dynamic(() => import("@/features/setup/SetupApp").then((m) => m.SetupApp));
const SupportApp = dynamic(() => import("@/features/support/SupportApp").then((m) => m.SupportApp));
const TemplatesApp = dynamic(() => import("@/features/templates/TemplatesApp").then((m) => m.TemplatesApp));
const FreelancerListingsApp = dynamic(() => import("@/features/listings/FreelancerListingsApp").then((m) => m.FreelancerListingsApp));
const BrowseApp = dynamic(() => import("@/features/parent/BrowseApp").then((m) => m.BrowseApp));
const WalletApp = dynamic(() => import("@/features/parent/WalletApp").then((m) => m.WalletApp));
const CouponsApp = dynamic(() => import("@/features/parent/CouponsApp").then((m) => m.CouponsApp));
const ReferApp = dynamic(() => import("@/features/parent/ReferApp").then((m) => m.ReferApp));
const MembershipsApp = dynamic(() => import("@/features/parent/MembershipsApp").then((m) => m.MembershipsApp));
const FeedbackApp = dynamic(() => import("@/features/parent/FeedbackApp").then((m) => m.FeedbackApp));
const ChildrenApp = dynamic(() => import("@/features/parent/ChildrenApp").then((m) => m.ChildrenApp));
const BookingsHubApp = dynamic(() => import("@/features/parent/BookingsHub").then((m) => m.BookingsHubApp));
const ProvidersApp = dynamic(() => import("@/features/platform/ProvidersApp").then((m) => m.ProvidersApp));
const PlatformAnalyticsApp = dynamic(() => import("@/features/platform/PlatformAnalyticsApp").then((m) => m.PlatformAnalyticsApp));
const PlatformEngagementApp = dynamic(() => import("@/features/platform/PlatformEngagementApp").then((m) => m.PlatformEngagementApp));
const PlatformFeaturesApp = dynamic(() => import("@/features/platform/PlatformFeaturesApp").then((m) => m.PlatformFeaturesApp));
const PlatformAtRiskApp = dynamic(() => import("@/features/platform/PlatformAtRiskApp").then((m) => m.PlatformAtRiskApp));
const SalesApp = dynamic(() => import("@/features/platform/SalesApp").then((m) => m.SalesApp));
const TestingApp = dynamic(() => import("@/features/testing/TestingApp").then((m) => m.TestingApp));
const LeadsApp = dynamic(() => import("@/features/platform/LeadsApp").then((m) => m.LeadsApp));
const VentureLakesApp = dynamic(() => import("@/features/platform/VentureLakesApp").then((m) => m.VentureLakesApp));
const InternationalExpansionApp = dynamic(() => import("@/features/platform/InternationalExpansionApp").then((m) => m.InternationalExpansionApp));
const ActivlySiteApp = dynamic(() => import("@/features/platform/ActivlySiteApp").then((m) => m.ActivlySiteApp));
const MyMoneyApp = dynamic(() => import("@/features/platform/MyMoneyApp").then((m) => m.MyMoneyApp));
const SupportInboxApp = dynamic(() => import("@/features/platform/SupportInboxApp").then((m) => m.SupportInboxApp));
const SupportReviewApp = dynamic(() => import("@/features/platform/SupportReviewApp").then((m) => m.SupportReviewApp));
const TeamApp = dynamic(() => import("@/features/team/TeamApp").then((m) => m.TeamApp));
const TimetableApp = dynamic(() => import("@/features/timetable/TimetableApp").then((m) => m.TimetableApp));
const StaffTimetableApp = dynamic(() => import("@/features/timetable/PublishedTimetable").then((m) => m.StaffTimetableApp));
const ParentTimetableApp = dynamic(() => import("@/features/timetable/ParentTimetable").then((m) => m.ParentTimetableApp));
const AiAssistant = dynamic(() => import("@/features/ai/AiApp").then((m) => m.AiAssistant));

// Roadmap areas — honest "Planned" pages until the real feature lands
// (never the old prototype's canned data). Swap for a real component here
// when built; the nav item needs no change.
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
export const VIEW_REGISTRY: Partial<Record<PortalKey, Record<string, ComponentType<any>>>> = {
  company: {
    dashboard: CompanyDashboardSwitch,
    setup: SetupApp,
    bookings: BookingsApp,
    listings: FreelancerListingsApp,
    blocks: BlocksApp,
    timetable: TimetableApp,
    staff: CompanyStaffSwitch,
    "admin-registers": RegistersApp,
    ratios: RatiosApp,
    // In the HO combined view these become read-only network oversight; drilled
    // into a franchise (or a plain company) they render the normal operator page.
    incidents: CompanyIncidents,
    accidents: CompanyAccidents,
    medication: CompanyMedication,
    meals: MealsApp,
    moments: MomentsApp,
    customers: CustomersApp,
    finance: CompanyFinanceSwitch,
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
    getpaid: PaymentsApp,
    documents: DocumentsApp,
    compliance: ComplianceApp,
    marketing: MarketingApp,
    "marketing-strategies": MarketingStrategiesApp,
    referrals: ReferralsApp,
    reviews: ReviewsApp,
    splitfees: SplitFeesApp,
    territories: FranchiseTerritoriesApp,
    "franchise-overview": FranchiseOverviewApp,
    "franchise-features": FranchiseFeaturesApp,
    "franchise-invites": FranchiseInvitesApp,
    email: EmailApp,
    account: AccountApp,
    privacy: PrivacyApp,
    ai: () => <AiAssistant kind="operator" />,
    payroll: PayrollApp,
    holiday: HolidayApp,
    timesheets: TimesheetsApp,
    learning: LearningCentreApp,
    credentials: CredentialsApp,
    schedule: RotaApp,
    "ho-framework": () => <MilestonesApp mode="ho" />,
    // Routable aliases so old links don't 404 — the sidebar shows only the
    // canonical item, but the slug still resolves to the real view.
    registers: RegistersApp,
    children: CustomersApp,
    "company-setup": SetupApp,
    moments2: MomentsApp,
  },
  franchise: {
    dash: DashboardApp,
    royalties: FranchiseRoyaltiesApp,
    setup: SetupApp,
    bookings: BookingsApp,
    listings: FreelancerListingsApp,
    blocks: BlocksApp,
    timetable: TimetableApp,
    staff: TeamApp,
    milestones: () => <MilestonesApp mode="franchise" />,
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
    getpaid: PaymentsApp,
    compliance: ComplianceApp,
    marketing: MarketingApp,
    "marketing-strategies": MarketingStrategiesApp,
    referrals: ReferralsApp,
    reviews: ReviewsApp,
    email: EmailApp,
    account: AccountApp,
    privacy: PrivacyApp,
    ai: () => <AiAssistant kind="operator" />,
    payroll: PayrollApp,
    holiday: HolidayApp,
    timesheets: TimesheetsApp,
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
    getpaid: PaymentsApp,
    compliance: ComplianceApp,
    marketing: MarketingApp,
    "marketing-strategies": MarketingStrategiesApp,
    referrals: ReferralsApp,
    reviews: ReviewsApp,
    email: EmailApp,
    account: AccountApp,
    privacy: PrivacyApp,
    ai: () => <AiAssistant kind="operator" />,
    moments2: MomentsApp,
  },
  staff: {
    dash: StaffDashApp,
    certificates: StaffCertsApp,
    documents: StaffDocsApp,
    payslips: StaffPayslipsApp,
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
    schedule: MyScheduleApp,
    announcements: StaffAnnouncementsApp,
    onboarding: StaffOnboardingApp,
    messages: () => <MessagesApp mode="operator" />,
    templates: TemplatesApp,
    compliance: ComplianceApp,
    account: AccountApp,
    ai: () => <AiAssistant kind="staff" />,
    availability: AvailabilityApp,
    holiday: MyHolidayApp,
    appraisals: MyAppraisalsApp,
    clockinout: TimeClockApp,
    expenses: StaffExpensesApp,
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
    feedback: FeedbackApp,
    dash: BrowseApp, // routable alias — parents' home is Browse
  },
  platform: {
    testing: TestingApp,
    tasks: TasksApp,
    dash: PlatformAnalyticsApp, // Overview retired — /platform/dash lands on Analytics
    providers: ProvidersApp,
    analytics: PlatformAnalyticsApp,
    engagement: PlatformEngagementApp,
    "at-risk": PlatformAtRiskApp,
    sales: SalesApp,
    leads: LeadsApp,
    "venture-lakes": VentureLakesApp,
    "international-expansion": InternationalExpansionApp,
    "activly-site": ActivlySiteApp,
    "my-money": MyMoneyApp,
    // Platform tooling on the roadmap — these need PLATFORM-scoped
    // backends (a platform account has no tenant, so the operator
    // components can't run here).
    features: PlatformFeaturesApp,
    billing: ProvidersApp, // merged into Providers & billing
    pricing: ProvidersApp, // Pricing is now a tab on Providers & billing
    support: SupportInboxApp,
    messages: SupportInboxApp,
    "support-review": SupportReviewApp,
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

export function getRegisteredView(portal: PortalKey, view: string): ComponentType<any> | undefined {
  return VIEW_REGISTRY[portal]?.[view];
}
