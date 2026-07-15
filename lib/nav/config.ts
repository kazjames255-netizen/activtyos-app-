// Auto-derived from the legacy prototype's LIVE-RENDERED sidebar DOM (not the
// static pre-JS HTML — the legacy app rebuilds its sidebar at runtime into a
// collapsible, icon-driven accordion; see public/legacy/prototype.html's
// sidebar-grouping script). Used by components/shell/Sidebar.tsx and
// app/[portal]/[view]/page.tsx.
//
// Note: admin is the only portal where the legacy default leaves some items
// (Bookings, Timetable, Staff, Tasks, Payroll, Registers, Calendar, ...)
// outside any group ("loose", some hidden) — a demo decluttering default.
// We fold those into a synthesized "More" group here so every view stays
// reachable from the sidebar, matching this app's full-navigability goal.

export type PortalKey = "company" | "franchise" | "freelancer" | "staff" | "custdash" | "platform";

export type NavIcon = { type: "glyph"; value: string } | { type: "svg"; markup: string };

export interface NavItem {
  /** Clean route slug used in our URLs: /[portal]/[view] */
  view: string;
  /** The legacy data-view value, used by the LegacyViewFrame bridge */
  legacyView: string;
  label: string;
  icon: NavIcon | null;
  badge: string | null;
}

export interface NavGroup {
  /** null for the pinned top item and the footer (account/log-out) group */
  label: string | null;
  pinned: boolean;
  footer: boolean;
  items: NavItem[];
}

export const PORTALS: PortalKey[] = ["company", "franchise", "freelancer", "staff", "custdash", "platform"];

// The legacy prototype's internal portal ids (its kiosk mode expects these —
// it predates the admin→company rename).
export const LEGACY_PORTAL_ID: Record<PortalKey, string> = {
  company: "admin",
  franchise: "franchise",
  freelancer: "freelancer",
  staff: "staff",
  custdash: "custdash",
  platform: "platform",
};

export const PORTAL_LABELS: Record<PortalKey, string> = {
  company: "Company / Head Office",
  franchise: "Franchise",
  freelancer: "Freelancer",
  staff: "Staff",
  custdash: "Parent dashboard",
  platform: "Platform (HQ)",
};

export const NAV_GROUPS: Record<PortalKey, NavGroup[]> = {
  company: [
    {
      label: null,
      pinned: true,
      footer: false,
      items: [
        { view: "dashboard", legacyView: "dashboard", label: "Dashboard", icon: { type: "glyph", value: "▦" }, badge: null },
      ],
    },
    {
      label: "Run the day",
      pinned: false,
      footer: false,
      items: [
        { view: "ratios", legacyView: "admin-ratios", label: "Ratios & groups", icon: { type: "glyph", value: "⚖" }, badge: null },
        { view: "trips", legacyView: "admin-trips", label: "Trips & visits", icon: { type: "glyph", value: "🚌" }, badge: null },
        { view: "admin-registers", legacyView: "admin-registers", label: "Registers", icon: { type: "glyph", value: "☰" }, badge: null },
      ],
    },
    {
      label: "Marketing",
      pinned: false,
      footer: false,
      items: [
        { view: "marketing", legacyView: "admin-marketing", label: "Marketing", icon: { type: "glyph", value: "◎" }, badge: null },
      ],
    },
    {
      label: "Support",
      pinned: false,
      footer: false,
      items: [
        { view: "ho-framework", legacyView: "ho-framework", label: "Franchise Support Framework", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"5\" y=\"3.5\" width=\"14\" height=\"17\" rx=\"2\"></rect><path d=\"M9 3.5V6h6V3.5M8.5 11l1.6 1.6L13 9.5M8.5 16l1.6 1.6L13 14.5\"></path></svg>" }, badge: null },
      ],
    },
    {
      label: "Pupils",
      pinned: false,
      footer: false,
      items: [
        { view: "incidents", legacyView: "admin-incidents", label: "Incidents", icon: { type: "glyph", value: "⚑" }, badge: null },
        { view: "medication", legacyView: "admin-medication", label: "Medication", icon: { type: "glyph", value: "💊" }, badge: null },
        { view: "accidents", legacyView: "admin-accidents", label: "Accidents", icon: { type: "glyph", value: "⛑" }, badge: null },
        { view: "children", legacyView: "admin-children", label: "Children", icon: { type: "glyph", value: "☺" }, badge: null },
        { view: "moments", legacyView: "admin-moments", label: "Moments", icon: { type: "glyph", value: "📷" }, badge: null },
      ],
    },
    {
      label: "Documents",
      pinned: false,
      footer: false,
      items: [
        { view: "documents", legacyView: "admin-documents", label: "Documents", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 3h6l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z\"></path><path d=\"M14 3v6h5\"></path><path d=\"M9.5 13h6M9.5 16.5h6\"></path></svg>" }, badge: null },
      ],
    },
    {
      label: "Money",
      pinned: false,
      footer: false,
      items: [
        { view: "finance", legacyView: "finance", label: "Finances", icon: { type: "glyph", value: "£" }, badge: "1" },
        { view: "reconciliation", legacyView: "admin-reconciliation", label: "Reconciliation", icon: { type: "glyph", value: "⇄" }, badge: null },
        { view: "expenses", legacyView: "admin-expenses", label: "Central expenses", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><path d=\"M6 2.8h9l4 4V21l-2.2-1.3L14.6 21l-2.6-1.5L9.4 21l-2.2-1.3L5 21V4.3A1.5 1.5 0 0 1 6 2.8z\"></path><path d=\"M9 8h6M9 11.4h6M9 14.8h4\"></path></svg>" }, badge: null },
        { view: "purchasing", legacyView: "admin-purchasing", label: "PO & invoices", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><path d=\"M4.5 6.5h15l-1.2 8.5a2 2 0 0 1-2 1.7H7.7a2 2 0 0 1-2-1.7z\"></path><path d=\"M4.5 6.5 3.4 3.4H1.8M9 20.2h.01M15.5 20.2h.01\"></path></svg>" }, badge: null },
        { view: "splitfees", legacyView: "admin-splitfees", label: "Split fees", icon: { type: "glyph", value: "％" }, badge: null },
      ],
    },
    {
      label: "Settings",
      pinned: false,
      footer: false,
      items: [
        { view: "company-setup", legacyView: "company-setup", label: "Company setup", icon: { type: "glyph", value: "⬡" }, badge: null },
        { view: "setup", legacyView: "admin-setup", label: "Setup & features", icon: { type: "glyph", value: "◐" }, badge: null },
        { view: "account", legacyView: "account", label: "Onboarding info", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><circle cx=\"12\" cy=\"12\" r=\"3\"></circle><path d=\"M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3\"></path></svg>" }, badge: null },
        { view: "support", legacyView: "support", label: "Support", icon: { type: "glyph", value: "?" }, badge: null },
        { view: "privacy", legacyView: "admin-privacy", label: "Data & privacy", icon: { type: "glyph", value: "🛡" }, badge: null },
      ],
    },
    {
      label: "Communication",
      pinned: false,
      footer: false,
      items: [
        { view: "newsfeed", legacyView: "admin-newsfeed", label: "Newsfeed", icon: { type: "glyph", value: "📢" }, badge: null },
        { view: "moments2", legacyView: "admin-moments2", label: "Moments", icon: { type: "glyph", value: "📷" }, badge: null },
      ],
    },
    {
      label: null,
      pinned: false,
      footer: true,
      items: [
        { view: "auth", legacyView: "admin-auth", label: "Log out", icon: { type: "glyph", value: "⏏" }, badge: null },
      ],
    },
    {
      label: "More",
      pinned: false,
      footer: false,
      items: [
        { view: "blocks", legacyView: "admin-blocks", label: "Blocks", icon: { type: "glyph", value: "▥" }, badge: null },
        { view: "locations", legacyView: "admin-locations", label: "Locations", icon: { type: "glyph", value: "◉" }, badge: null },
        { view: "listings", legacyView: "listings", label: "Listings", icon: { type: "glyph", value: "▤" }, badge: null },
        { view: "customers", legacyView: "admin-customers", label: "Parents", icon: { type: "glyph", value: "◉" }, badge: null },
        { view: "messages", legacyView: "messages", label: "Messages", icon: { type: "glyph", value: "▧" }, badge: "2" },
        { view: "email", legacyView: "admin-email", label: "Email", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"></rect><path d=\"M3.5 7l8.5 6 8.5-6\"></path></svg>" }, badge: null },
        { view: "tasks", legacyView: "tasks", label: "Tasks", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 11l3 3 9-9\"></path><path d=\"M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10\"></path></svg>" }, badge: "7" },
        { view: "staff", legacyView: "admin-staff", label: "Staff", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"15\" height=\"15\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"9\" cy=\"8\" r=\"3\"></circle><path d=\"M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6\"></path><path d=\"M16 6.4a3 3 0 0 1 0 5.8M21 20c0-2.4-1.4-4.5-3.5-5.5\"></path></svg>" }, badge: "1" },
        { view: "bookings", legacyView: "bookings", label: "Bookings", icon: { type: "glyph", value: "◷" }, badge: "3" },
        { view: "calendar", legacyView: "cal-admin", label: "Calendar", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"4.5\" width=\"18\" height=\"16\" rx=\"2\"></rect><path d=\"M3 9.5h18M8 3v3M16 3v3\"></path></svg>" }, badge: null },
        { view: "timetable", legacyView: "timetable", label: "Activity timetable", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"></rect><path d=\"M3 9h18M9 3v18\"></path></svg>" }, badge: null },
        { view: "registers", legacyView: "registers", label: "Registers", icon: { type: "glyph", value: "✓" }, badge: "1" },
        { view: "meals", legacyView: "admin-meals", label: "Meals", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><circle cx=\"12\" cy=\"13\" r=\"5\"></circle><path d=\"M4.5 4v6M4.5 10v10M19.5 4c1 2 1 5 0 7v9\"></path></svg>" }, badge: null },
        { view: "payroll", legacyView: "payroll", label: "Payroll", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><rect x=\"2.5\" y=\"6\" width=\"19\" height=\"12\" rx=\"2\"></rect><circle cx=\"12\" cy=\"12\" r=\"2.4\"></circle><path d=\"M6 9.2v5.6M18 9.2v5.6\"></path></svg>" }, badge: null },
        { view: "compliance", legacyView: "compliance", label: "Learning Centre3", icon: { type: "glyph", value: "◎" }, badge: null },
        { view: "subscription", legacyView: "subscription", label: "Subscription", icon: { type: "glyph", value: "◈" }, badge: null },
        { view: "ai", legacyView: "ai", label: "AI Assistant", icon: { type: "glyph", value: "✦" }, badge: null },
      ],
    },
  ],
  franchise: [
    {
      label: null,
      pinned: true,
      footer: false,
      items: [
        { view: "dash", legacyView: "franchise-dash", label: "Dashboard", icon: { type: "glyph", value: "▦" }, badge: null },
      ],
    },
    {
      label: "Sell & take bookings",
      pinned: false,
      footer: false,
      items: [
        { view: "listings", legacyView: "franchise-listings", label: "Listings", icon: { type: "glyph", value: "▤" }, badge: null },
        { view: "blocks", legacyView: "franchise-blocks", label: "Blocks", icon: { type: "glyph", value: "▥" }, badge: null },
        { view: "bookings", legacyView: "franchise-bookings", label: "Bookings", icon: { type: "glyph", value: "◷" }, badge: "2" },
        { view: "customers", legacyView: "franchise-customers", label: "Parents", icon: { type: "glyph", value: "◉" }, badge: null },
      ],
    },
    {
      label: "Run the day",
      pinned: false,
      footer: false,
      items: [
        { view: "ratios", legacyView: "fr-ratios", label: "Ratios & groups", icon: { type: "glyph", value: "⚖" }, badge: null },
        { view: "trips", legacyView: "franchise-trips", label: "Trips & visits", icon: { type: "glyph", value: "🚌" }, badge: null },
        { view: "locations", legacyView: "franchise-locations", label: "Locations & setup", icon: { type: "glyph", value: "◉" }, badge: null },
        { view: "schedule", legacyView: "franchise-schedule", label: "Schedule", icon: { type: "glyph", value: "▦" }, badge: null },
        { view: "calendar", legacyView: "cal-franchise", label: "Calendar", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"4.5\" width=\"18\" height=\"16\" rx=\"2\"></rect><path d=\"M3 9.5h18M8 3v3M16 3v3\"></path></svg>" }, badge: null },
        { view: "timetable", legacyView: "franchise-timetable", label: "Activity timetable", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"></rect><path d=\"M3 9h18M9 3v18\"></path></svg>" }, badge: null },
        { view: "tasks", legacyView: "franchise-tasks", label: "Tasks", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 11l3 3 9-9\"></path><path d=\"M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10\"></path></svg>" }, badge: "7" },
      ],
    },
    {
      label: "Your team",
      pinned: false,
      footer: false,
      items: [
        { view: "staff", legacyView: "franchise-staff", label: "Staff", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block\"><circle cx=\"9\" cy=\"8\" r=\"3\"></circle><path d=\"M3.5 19a5.5 5.5 0 0 1 11 0\"></path><path d=\"M16 5.5a3 3 0 0 1 0 5.8M20.5 19a5.5 5.5 0 0 0-4-5.3\"></path></svg>" }, badge: null },
        { view: "payroll", legacyView: "franchise-payroll", label: "Payroll", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><rect x=\"2.5\" y=\"6\" width=\"19\" height=\"12\" rx=\"2\"></rect><circle cx=\"12\" cy=\"12\" r=\"2.4\"></circle><path d=\"M6 9.2v5.6M18 9.2v5.6\"></path></svg>" }, badge: null },
        { view: "compliance", legacyView: "franchise-compliance", label: "Learning Centre1", icon: { type: "glyph", value: "◎" }, badge: null },
      ],
    },
    {
      label: "Marketing",
      pinned: false,
      footer: false,
      items: [
        { view: "marketing", legacyView: "franchise-marketing", label: "Marketing", icon: { type: "glyph", value: "◎" }, badge: null },
      ],
    },
    {
      label: "Money & growth",
      pinned: false,
      footer: false,
      items: [
        { view: "finance", legacyView: "franchise-finance", label: "Finance & analytics", icon: { type: "glyph", value: "£" }, badge: null },
        { view: "expenses", legacyView: "franchise-expenses", label: "Expenses", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><path d=\"M6 2.8h9l4 4V21l-2.2-1.3L14.6 21l-2.6-1.5L9.4 21l-2.2-1.3L5 21V4.3A1.5 1.5 0 0 1 6 2.8z\"></path><path d=\"M9 8h6M9 11.4h6M9 14.8h4\"></path></svg>" }, badge: null },
        { view: "purchasing", legacyView: "franchise-purchasing", label: "Purchasing & invoices", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><path d=\"M4.5 6.5h15l-1.2 8.5a2 2 0 0 1-2 1.7H7.7a2 2 0 0 1-2-1.7z\"></path><path d=\"M4.5 6.5 3.4 3.4H1.8M9 20.2h.01M15.5 20.2h.01\"></path></svg>" }, badge: null },
        { view: "reconciliation", legacyView: "franchise-reconciliation", label: "Reconciliation", icon: { type: "glyph", value: "⇄" }, badge: null },
        { view: "subscription", legacyView: "franchise-subscription", label: "Subscription", icon: { type: "glyph", value: "◈" }, badge: null },
        { view: "ai", legacyView: "franchise-ai", label: "AI assistant", icon: { type: "glyph", value: "✦" }, badge: null },
      ],
    },
    {
      label: "Settings",
      pinned: false,
      footer: false,
      items: [
        { view: "setup", legacyView: "franchise-setup", label: "Setup & features", icon: { type: "glyph", value: "◐" }, badge: null },
        { view: "account", legacyView: "franchise-account", label: "Onboarding info", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><circle cx=\"12\" cy=\"12\" r=\"3\"></circle><path d=\"M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3\"></path></svg>" }, badge: null },
        { view: "support", legacyView: "franchise-support", label: "Support", icon: { type: "glyph", value: "?" }, badge: null },
        { view: "privacy", legacyView: "franchise-privacy", label: "Data & privacy", icon: { type: "glyph", value: "🛡" }, badge: null },
      ],
    },
    {
      label: "Pupils",
      pinned: false,
      footer: false,
      items: [
        { view: "registers", legacyView: "franchise-registers", label: "Registers", icon: { type: "glyph", value: "✓" }, badge: "1" },
        { view: "incidents", legacyView: "franchise-incidents", label: "Incidents", icon: { type: "glyph", value: "⚑" }, badge: null },
        { view: "medication", legacyView: "franchise-medication", label: "Medication", icon: { type: "glyph", value: "💊" }, badge: null },
        { view: "accidents", legacyView: "franchise-accidents", label: "Accidents", icon: { type: "glyph", value: "⛑" }, badge: null },
        { view: "meals", legacyView: "franchise-meals", label: "Meals", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><circle cx=\"12\" cy=\"13\" r=\"5\"></circle><path d=\"M4.5 4v6M4.5 10v10M19.5 4c1 2 1 5 0 7v9\"></path></svg>" }, badge: null },
        { view: "moments", legacyView: "franchise-moments", label: "Moments", icon: { type: "glyph", value: "📷" }, badge: null },
      ],
    },
    {
      label: "Communication",
      pinned: false,
      footer: false,
      items: [
        { view: "newsfeed", legacyView: "franchise-newsfeed", label: "Newsfeed", icon: { type: "glyph", value: "📢" }, badge: null },
        { view: "messages", legacyView: "franchise-messages", label: "Messages", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"></rect><path d=\"M4 7.5l8 5.5 8-5.5\"></path></svg>" }, badge: "2" },
        { view: "email", legacyView: "franchise-email", label: "Email", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"></rect><path d=\"M3.5 7l8.5 6 8.5-6\"></path></svg>" }, badge: null },
        { view: "moments2", legacyView: "franchise-moments2", label: "Moments", icon: { type: "glyph", value: "📷" }, badge: null },
      ],
    },
    {
      label: null,
      pinned: false,
      footer: true,
      items: [
        { view: "auth", legacyView: "franchise-auth", label: "Log out", icon: { type: "glyph", value: "⏏" }, badge: null },
      ],
    },
  ],
  freelancer: [
    {
      label: null,
      pinned: true,
      footer: false,
      items: [
        { view: "dash", legacyView: "freelancer-dash", label: "Dashboard", icon: { type: "glyph", value: "▦" }, badge: null },
      ],
    },
    {
      label: "Sell & take bookings",
      pinned: false,
      footer: false,
      items: [
        { view: "listings", legacyView: "freelancer-listings", label: "Listings", icon: { type: "glyph", value: "▤" }, badge: null },
        { view: "blocks", legacyView: "freelancer-blocks", label: "Sessions & blocks", icon: { type: "glyph", value: "▥" }, badge: null },
        { view: "bookings", legacyView: "freelancer-bookings", label: "Bookings", icon: { type: "glyph", value: "◷" }, badge: "1" },
        { view: "customers", legacyView: "freelancer-customers", label: "Parents", icon: { type: "glyph", value: "◉" }, badge: null },
      ],
    },
    {
      label: "Run the day",
      pinned: false,
      footer: false,
      items: [
        { view: "ratios", legacyView: "freelancer-ratios", label: "Ratios & groups", icon: { type: "glyph", value: "⚖" }, badge: null },
        { view: "trips", legacyView: "freelancer-trips", label: "Trips & visits", icon: { type: "glyph", value: "🚌" }, badge: null },
        { view: "locations", legacyView: "freelancer-locations", label: "Locations & setup", icon: { type: "glyph", value: "◉" }, badge: null },
        { view: "schedule", legacyView: "freelancer-schedule", label: "Schedule", icon: { type: "glyph", value: "▦" }, badge: null },
        { view: "calendar", legacyView: "cal-freelancer", label: "Calendar", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"4.5\" width=\"18\" height=\"16\" rx=\"2\"></rect><path d=\"M3 9.5h18M8 3v3M16 3v3\"></path></svg>" }, badge: null },
        { view: "timetable", legacyView: "freelancer-timetable", label: "Activity timetable", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"></rect><path d=\"M3 9h18M9 3v18\"></path></svg>" }, badge: null },
        { view: "tasks", legacyView: "freelancer-tasks", label: "Tasks", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 11l3 3 9-9\"></path><path d=\"M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10\"></path></svg>" }, badge: "4" },
      ],
    },
    {
      label: "Marketing",
      pinned: false,
      footer: false,
      items: [
        { view: "marketing", legacyView: "freelancer-marketing", label: "Marketing", icon: { type: "glyph", value: "◎" }, badge: null },
      ],
    },
    {
      label: "Money",
      pinned: false,
      footer: false,
      items: [
        { view: "finance", legacyView: "freelancer-finance", label: "Finance & analytics", icon: { type: "glyph", value: "£" }, badge: "1" },
        { view: "expenses", legacyView: "freelancer-expenses", label: "Expenses", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><path d=\"M6 2.8h9l4 4V21l-2.2-1.3L14.6 21l-2.6-1.5L9.4 21l-2.2-1.3L5 21V4.3A1.5 1.5 0 0 1 6 2.8z\"></path><path d=\"M9 8h6M9 11.4h6M9 14.8h4\"></path></svg>" }, badge: null },
        { view: "purchasing", legacyView: "freelancer-purchasing", label: "Purchasing & invoices", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><path d=\"M4.5 6.5h15l-1.2 8.5a2 2 0 0 1-2 1.7H7.7a2 2 0 0 1-2-1.7z\"></path><path d=\"M4.5 6.5 3.4 3.4H1.8M9 20.2h.01M15.5 20.2h.01\"></path></svg>" }, badge: null },
        { view: "reconciliation", legacyView: "freelancer-reconciliation", label: "Reconciliation", icon: { type: "glyph", value: "⇄" }, badge: null },
        { view: "subscription", legacyView: "freelancer-subscription", label: "Subscription", icon: { type: "glyph", value: "◈" }, badge: null },
      ],
    },
    {
      label: "AI",
      pinned: false,
      footer: false,
      items: [
        { view: "ai", legacyView: "freelancer-ai", label: "AI assistant", icon: { type: "glyph", value: "✦" }, badge: null },
      ],
    },
    {
      label: "Settings",
      pinned: false,
      footer: false,
      items: [
        { view: "setup", legacyView: "freelancer-setup", label: "Setup & features", icon: { type: "glyph", value: "◐" }, badge: null },
        { view: "account", legacyView: "freelancer-account", label: "Onboarding info", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><circle cx=\"12\" cy=\"12\" r=\"3\"></circle><path d=\"M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3\"></path></svg>" }, badge: null },
        { view: "compliance", legacyView: "freelancer-compliance", label: "My certifications", icon: { type: "glyph", value: "◎" }, badge: null },
        { view: "support", legacyView: "freelancer-support", label: "Support", icon: { type: "glyph", value: "?" }, badge: null },
        { view: "privacy", legacyView: "freelancer-privacy", label: "Data & privacy", icon: { type: "glyph", value: "🛡" }, badge: null },
      ],
    },
    {
      label: "Pupils",
      pinned: false,
      footer: false,
      items: [
        { view: "registers", legacyView: "freelancer-registers", label: "Register", icon: { type: "glyph", value: "✓" }, badge: null },
        { view: "incidents", legacyView: "freelancer-incidents", label: "Incidents", icon: { type: "glyph", value: "⚑" }, badge: null },
        { view: "medication", legacyView: "freelancer-medication", label: "Medication", icon: { type: "glyph", value: "💊" }, badge: null },
        { view: "accidents", legacyView: "freelancer-accidents", label: "Accidents", icon: { type: "glyph", value: "⛑" }, badge: null },
        { view: "meals", legacyView: "freelancer-meals", label: "Meals", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><circle cx=\"12\" cy=\"13\" r=\"5\"></circle><path d=\"M4.5 4v6M4.5 10v10M19.5 4c1 2 1 5 0 7v9\"></path></svg>" }, badge: null },
        { view: "moments", legacyView: "freelancer-moments", label: "Moments", icon: { type: "glyph", value: "📷" }, badge: null },
      ],
    },
    {
      label: "Communication",
      pinned: false,
      footer: false,
      items: [
        { view: "newsfeed", legacyView: "freelancer-newsfeed", label: "Newsfeed", icon: { type: "glyph", value: "📢" }, badge: null },
        { view: "messages", legacyView: "freelancer-messages", label: "Messages", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"></rect><path d=\"M4 7.5l8 5.5 8-5.5\"></path></svg>" }, badge: "1" },
        { view: "email", legacyView: "freelancer-email", label: "Email", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"></rect><path d=\"M3.5 7l8.5 6 8.5-6\"></path></svg>" }, badge: null },
        { view: "moments2", legacyView: "freelancer-moments2", label: "Moments", icon: { type: "glyph", value: "📷" }, badge: null },
      ],
    },
    {
      label: null,
      pinned: false,
      footer: true,
      items: [
        { view: "auth", legacyView: "freelancer-auth", label: "Log out", icon: { type: "glyph", value: "⏏" }, badge: null },
      ],
    },
  ],
  staff: [
    {
      label: null,
      pinned: true,
      footer: false,
      items: [
        { view: "dash", legacyView: "staff-dash", label: "Dashboard", icon: { type: "glyph", value: "▦" }, badge: null },
      ],
    },
    {
      label: "My week",
      pinned: false,
      footer: false,
      items: [
        { view: "schedule", legacyView: "staff-schedule", label: "My schedule", icon: { type: "glyph", value: "▦" }, badge: "2" },
        { view: "availability", legacyView: "staff-availability", label: "My availability", icon: { type: "glyph", value: "⏱" }, badge: "1" },
        { view: "holiday", legacyView: "staff-holiday", label: "My holiday", icon: { type: "glyph", value: "🏖" }, badge: null },
        { view: "tasks", legacyView: "staff-tasks", label: "Tasks", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 11l3 3 9-9\"></path><path d=\"M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10\"></path></svg>" }, badge: "4" },
      ],
    },
    {
      label: "On shift",
      pinned: false,
      footer: false,
      items: [
        { view: "ratios", legacyView: "staff-ratios", label: "Ratios & groups", icon: { type: "glyph", value: "⚖" }, badge: null },
        { view: "trips", legacyView: "staff-trips", label: "Trips & visits", icon: { type: "glyph", value: "🚌" }, badge: null },
        { view: "children", legacyView: "staff-children", label: "Child profiles", icon: { type: "glyph", value: "◉" }, badge: null },
        { view: "timetable", legacyView: "staff-timetable", label: "Timetable", icon: { type: "glyph", value: "▦" }, badge: null },
      ],
    },
    {
      label: "People",
      pinned: false,
      footer: false,
      items: [
        { view: "customers", legacyView: "staff-customers", label: "My parents", icon: { type: "glyph", value: "◑" }, badge: null },
      ],
    },
    {
      label: "Resources",
      pinned: false,
      footer: false,
      items: [
        { view: "training", legacyView: "staff-training", label: "Learning Centre", icon: { type: "glyph", value: "◎" }, badge: "1" },
        { view: "documents", legacyView: "staff-documents", label: "Documents", icon: { type: "glyph", value: "▤" }, badge: "3" },
        { view: "ai", legacyView: "staff-ai", label: "AI assistant", icon: { type: "glyph", value: "✦" }, badge: null },
      ],
    },
    {
      label: "Account",
      pinned: false,
      footer: false,
      items: [
        { view: "expenses", legacyView: "staff-expenses", label: "My expenses", icon: { type: "glyph", value: "🧾" }, badge: null },
        { view: "account", legacyView: "staff-account", label: "Onboarding info", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><circle cx=\"12\" cy=\"12\" r=\"3\"></circle><path d=\"M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3\"></path></svg>" }, badge: null },
        { view: "privacy", legacyView: "staff-privacy", label: "Data & privacy", icon: { type: "glyph", value: "🛡" }, badge: null },
      ],
    },
    {
      label: "Coming soon",
      pinned: false,
      footer: false,
      items: [
        { view: "pay", legacyView: "staff-pay", label: "My pay", icon: { type: "glyph", value: "£" }, badge: null },
      ],
    },
    {
      label: "Pupils",
      pinned: false,
      footer: false,
      items: [
        { view: "registers", legacyView: "staff-registers", label: "Registers", icon: { type: "glyph", value: "✓" }, badge: null },
        { view: "incident", legacyView: "staff-incident", label: "Incidents", icon: { type: "glyph", value: "⚑" }, badge: null },
        { view: "medication", legacyView: "staff-medication", label: "Medication", icon: { type: "glyph", value: "💊" }, badge: null },
        { view: "accidents", legacyView: "staff-accidents", label: "Accidents", icon: { type: "glyph", value: "⛑" }, badge: null },
        { view: "meals", legacyView: "staff-meals", label: "Meals", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><circle cx=\"12\" cy=\"13\" r=\"5\"></circle><path d=\"M4.5 4v6M4.5 10v10M19.5 4c1 2 1 5 0 7v9\"></path></svg>" }, badge: null },
        { view: "moments", legacyView: "staff-moments", label: "Moments", icon: { type: "glyph", value: "📷" }, badge: null },
      ],
    },
    {
      label: "Communication",
      pinned: false,
      footer: false,
      items: [
        { view: "messages", legacyView: "staff-messages", label: "Messages", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"></rect><path d=\"M4 7.5l8 5.5 8-5.5\"></path></svg>" }, badge: "1" },
        { view: "moments2", legacyView: "staff-moments2", label: "Moments", icon: { type: "glyph", value: "📷" }, badge: null },
      ],
    },
    {
      label: null,
      pinned: false,
      footer: true,
      items: [
        { view: "auth", legacyView: "staff-auth", label: "Log out", icon: { type: "glyph", value: "⏏" }, badge: null },
      ],
    },
  ],
  custdash: [
    {
      label: null,
      pinned: true,
      footer: false,
      items: [
        { view: "dash", legacyView: "custdash-dash", label: "Dashboard", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"></rect><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"></rect><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"></rect><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"></rect></svg>" }, badge: null },
      ],
    },
    {
      label: "My child",
      pinned: false,
      footer: false,
      items: [
        { view: "children", legacyView: "custdash-children", label: "My children", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"9\" cy=\"8\" r=\"3\"></circle><path d=\"M3 20a6 6 0 0 1 12 0\"></path><path d=\"M16 7a3 3 0 0 1 0 6\"></path><path d=\"M18 20a6 6 0 0 0-3-5\"></path></svg>" }, badge: null },
        { view: "moments", legacyView: "custdash-moments", label: "My child's day", icon: { type: "glyph", value: "📷" }, badge: null },
        { view: "newsfeed", legacyView: "custdash-newsfeed", label: "Newsfeed", icon: { type: "glyph", value: "📢" }, badge: null },
        { view: "medication", legacyView: "custdash-medication", label: "Medication", icon: { type: "glyph", value: "💊" }, badge: null },
        { view: "meals", legacyView: "custdash-meals", label: "Meals", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><circle cx=\"12\" cy=\"13\" r=\"5\"></circle><path d=\"M4.5 4v6M4.5 10v10M19.5 4c1 2 1 5 0 7v9\"></path></svg>" }, badge: null },
        { view: "accidents", legacyView: "custdash-accidents", label: "Accidents", icon: { type: "glyph", value: "🩹" }, badge: "1" },
      ],
    },
    {
      label: "Activities",
      pinned: false,
      footer: false,
      items: [
        { view: "browse", legacyView: "custdash-browse", label: "Browse activities", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"11\" cy=\"11\" r=\"7\"></circle><path d=\"M21 21l-4.3-4.3\"></path></svg>" }, badge: null },
        { view: "bookings", legacyView: "custdash-bookings", label: "My bookings", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 8h18M7 3v4M17 3v4\"></path><rect x=\"3\" y=\"6\" width=\"18\" height=\"15\" rx=\"2\"></rect></svg>" }, badge: "2" },
        { view: "schedule", legacyView: "custdash-schedule", label: "My schedule", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"></rect><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"></rect><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"></rect><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"></rect></svg>" }, badge: null },
      ],
    },
    {
      label: "Payments",
      pinned: false,
      footer: false,
      items: [
        { view: "payments", legacyView: "custdash-payments", label: "Payments", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"2\"></rect><path d=\"M2 10h20M6 15h4\"></path></svg>" }, badge: "1" },
        { view: "memberships", legacyView: "custdash-memberships", label: "Memberships", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9z\"></path></svg>" }, badge: null },
        { view: "wallet", legacyView: "custdash-wallet", label: "Wallet", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2\" y=\"6\" width=\"20\" height=\"13\" rx=\"2\"></rect><path d=\"M16 12h.01M2 10h20\"></path></svg>" }, badge: null },
        { view: "coupons", legacyView: "custdash-coupons", label: "Coupons", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M19 5L5 19\"></path><circle cx=\"6.5\" cy=\"6.5\" r=\"2.5\"></circle><circle cx=\"17.5\" cy=\"17.5\" r=\"2.5\"></circle></svg>" }, badge: null },
      ],
    },
    {
      label: "Account",
      pinned: false,
      footer: false,
      items: [
        { view: "messages", legacyView: "custdash-messages", label: "Messages", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"></rect><path d=\"M3 7l9 6 9-6\"></path></svg>" }, badge: "1" },
        { view: "ai", legacyView: "custdash-ai", label: "AI assistant", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 3v6M12 15v6M3 12h6M15 12h6M5.6 5.6l3 3M15.4 15.4l3 3M18.4 5.6l-3 3M8.6 15.4l-3 3\"></path></svg>" }, badge: null },
        { view: "account", legacyView: "custdash-account", label: "My account", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"8\" r=\"4\"></circle><path d=\"M4 21a8 8 0 0 1 16 0\"></path></svg>" }, badge: null },
        { view: "account", legacyView: "custdash-account", label: "Onboarding info", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"3\"></circle><path d=\"M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 13.4H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 5 6.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.1V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 .9 2.7H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z\"></path></svg>" }, badge: null },
        { view: "privacy", legacyView: "custdash-privacy", label: "Data & privacy", icon: { type: "glyph", value: "🛡" }, badge: null },
        { view: "help", legacyView: "custdash-help", label: "Help & support", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3.2M12 17h.01\"></path></svg>" }, badge: null },
        { view: "refer", legacyView: "custdash-refer", label: "Refer a friend", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 7h11l-3-3M17 17H6l3 3\"></path></svg>" }, badge: null },
      ],
    },
    {
      label: null,
      pinned: false,
      footer: true,
      items: [
        { view: "auth", legacyView: "custdash-auth", label: "Log out", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9\"></path></svg>" }, badge: null },
      ],
    },
  ],
  platform: [
    {
      label: null,
      pinned: true,
      footer: false,
      items: [
        { view: "dash", legacyView: "platform-dash", label: "Overview", icon: { type: "glyph", value: "▦" }, badge: null },
      ],
    },
    {
      label: "Tenants",
      pinned: false,
      footer: false,
      items: [
        { view: "providers", legacyView: "platform-providers", label: "Providers", icon: { type: "glyph", value: "▣" }, badge: "1" },
        { view: "features", legacyView: "platform-features", label: "Provider features", icon: { type: "glyph", value: "◐" }, badge: null },
      ],
    },
    {
      label: "Oversight",
      pinned: false,
      footer: false,
      items: [
        { view: "billing", legacyView: "platform-billing", label: "Billing", icon: { type: "glyph", value: "£" }, badge: "1" },
        { view: "support", legacyView: "platform-support", label: "Support", icon: { type: "glyph", value: "?" }, badge: "2" },
        { view: "ai", legacyView: "platform-ai", label: "AI assistant", icon: { type: "glyph", value: "✦" }, badge: null },
        { view: "privacy", legacyView: "platform-privacy", label: "Data & privacy", icon: { type: "glyph", value: "🛡" }, badge: null },
      ],
    },
    {
      label: "Communication",
      pinned: false,
      footer: false,
      items: [
        { view: "messages", legacyView: "platform-messages", label: "Messages", icon: { type: "glyph", value: "▧" }, badge: null },
        { view: "email", legacyView: "platform-email", label: "Email", icon: { type: "svg", markup: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"width:1em;height:1em;vertical-align:-.14em;display:inline-block;flex:none\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"></rect><path d=\"M3.5 7l8.5 6 8.5-6\"></path></svg>" }, badge: null },
      ],
    },
    {
      label: null,
      pinned: false,
      footer: true,
      items: [
        { view: "auth", legacyView: "platform-auth", label: "Log out", icon: { type: "glyph", value: "⏏" }, badge: null },
      ],
    },
  ],
};

// Flat view of NAV_GROUPS, for lookups that don't care about grouping.
export const NAV_CONFIG: Record<PortalKey, NavItem[]> = Object.fromEntries(
  PORTALS.map((p) => [p, NAV_GROUPS[p].flatMap((g) => g.items)]),
) as Record<PortalKey, NavItem[]>;

export function getDefaultView(portal: PortalKey): string {
  return NAV_CONFIG[portal][0].view;
}

export function findNavItem(portal: PortalKey, view: string): NavItem | undefined {
  return NAV_CONFIG[portal].find((item) => item.view === view);
}
