// What a switched-off feature and a role's None/View/Edit matrix actually
// REFUSE — one table, read by both sides: the API (server/src/middleware/
// access.ts) refuses the calls, the portal (Sidebar + ViewGate) hides the
// links and refuses the typed URL. Before 13 Sept the Setup → Features switch
// and the Roles & permissions matrix only hid sidebar links: every API answered
// and every page loaded by URL (acceptance d2s2, d2s6).
//
// Pure data + functions, no imports — the server imports this file directly.

export type CapLevel = "none" | "view" | "edit";

// ── Setup → Features (settings.features, keyed by operator nav view) ─────────

/** API prefixes that belong to ONE switchable module, and the feature key(s)
 *  that switch them off (any key explicitly `false` = off). Deliberately left
 *  out, and why:
 *   · safeguarding (incidents, medication, accidents) and registers — a record
 *     about a child's safety or whereabouts must never be refused;
 *   · APIs other screens read too (rota/shifts/leave/timeclock feed the
 *     dashboard + clock, expenses/splitfees feed Finance, ratios feeds the staff
 *     home, messages/posts/emails/ai are used across comms) — switching one
 *     module off must not break a different page. Their pages are still
 *     refused by URL (see featureKeysForView), and most of them refuse
 *     CHANGES while off (FEATURE_WRITE_API below). */
export const FEATURE_API: { prefix: string; keys: string[]; label: string }[] = [
  { prefix: "/api/meals", keys: ["meals"], label: "Meals" },
  { prefix: "/api/meal-menus", keys: ["meals"], label: "Meals" },
  { prefix: "/api/meal-options", keys: ["meals"], label: "Meals" },
  { prefix: "/api/meal-orders", keys: ["meals"], label: "Meals" },
  { prefix: "/api/trips", keys: ["trips"], label: "Trips & visits" },
  { prefix: "/api/calendar-events", keys: ["calendar"], label: "Events calendar" },
  { prefix: "/api/timetables", keys: ["timetable"], label: "Activity timetable" },
  { prefix: "/api/tasks", keys: ["tasks"], label: "Task manager" },
  { prefix: "/api/discounts", keys: ["marketing"], label: "Discount codes" },
  { prefix: "/api/referrals", keys: ["referrals"], label: "Referrals" },
  { prefix: "/api/reviews", keys: ["reviews"], label: "Reviews" },
  { prefix: "/api/purchasing", keys: ["purchasing"], label: "Money in" },
  { prefix: "/api/reconciliation", keys: ["reconciliation"], label: "Reconciliation" },
  { prefix: "/api/inventory", keys: ["inventory"], label: "Inventory" },
  { prefix: "/api/documents", keys: ["documents"], label: "Documents" },
  { prefix: "/api/moments", keys: ["moments"], label: "Moments" },
];

/** Modules whose READS other screens rely on (dashboard cards, the staff home,
 *  Finance): while switched off their reads still answer, but anything that
 *  CHANGES the module is refused (any method but GET/HEAD/OPTIONS). `except` =
 *  writes that stay open. Deliberately not listed, because a page that can't
 *  be switched off writes through them:
 *   · /api/messages — the register's late-collection nudges, Bookings' "email
 *     these families" and a booking's "Message family" all send through it, and
 *     Email shares its templates;
 *   · /api/timeclock and /api/rota/clock — a staff clock-in is fire-and-forget
 *     from "My shifts & clock" (which follows Schedule, not Clock), so a refusal
 *     would silently lose a clock-in the person thinks landed; Payroll edits
 *     timesheets through PATCH /api/timeclock;
 *   · /api/expenses — Finance (Head office's Money out tab) and Purchasing
 *     (PO → expense) write money-out entries through it;
 *   · /api/ai/compose(-newsletter) — the AI drafting buttons inside Email, the
 *     newsletter and the Learning Centre course editor. */
export const FEATURE_WRITE_API: { prefix: string; keys: string[]; label: string; except?: RegExp[] }[] = [
  // Reacting / RSVPing / confirming you've read a post is reading it.
  { prefix: "/api/posts", keys: ["newsfeed"], label: "Newsfeed", except: [/^\/api\/posts\/[^/]+\/(react|rsvp|ack)\/?$/] },
  // An opt-out (do-not-email) must always be recordable (PECR).
  { prefix: "/api/emails", keys: ["email"], label: "Email", except: [/^\/api\/emails\/suppress\/?$/] },
  { prefix: "/api/ai/chat", keys: ["ai"], label: "The AI assistant" },
  { prefix: "/api/rota", keys: ["schedule"], label: "Staff schedule", except: [/^\/api\/rota\/clock\/?$/] },
  { prefix: "/api/shifts", keys: ["schedule"], label: "Staff schedule" },
  { prefix: "/api/availability", keys: ["schedule"], label: "Staff schedule" },
  { prefix: "/api/leave", keys: ["holiday"], label: "Leave & absence" },
  { prefix: "/api/splitfees", keys: ["splitfees"], label: "Split fees" },
  { prefix: "/api/ratios", keys: ["ratios"], label: "Ratios & groups" },
];

/** Views that are never refused by URL whatever the switches say: the core of
 *  running (mirrors CORE_VIEWS in lib/use-customer-area.ts) plus the
 *  safeguarding pages (see FEATURE_API). */
const NEVER_OFF = new Set([
  "dash", "dashboard", "bookings", "listings", "blocks", "locations",
  "customers", "finance", "setup", "account", "privacy", "auth", "support", "subscription",
  "incidents", "incident", "accidents", "medication",
]);

/** A staff portal view → the operator feature(s) it belongs to. */
const STAFF_VIEW_FEATURES: Record<string, string[]> = {
  ai: ["ai"], messages: ["messages"], schedule: ["schedule"], availability: ["schedule"],
  holiday: ["holiday"], tasks: ["tasks"], registers: ["registers", "admin-registers"],
  ratios: ["ratios"], timetable: ["timetable"], meals: ["meals"], trips: ["trips"],
  moments: ["moments"], documents: ["documents"], payslips: ["payroll"],
};

/** Which feature keys gate this portal view (empty = never gated). Operator
 *  portals key features by their own nav view; the company calls its register
 *  "admin-registers", the others "registers". */
export function featureKeysForView(portal: string, view: string): string[] {
  if (NEVER_OFF.has(view)) return [];
  if (portal === "staff") return STAFF_VIEW_FEATURES[view] ?? [];
  if (portal === "company" || portal === "freelancer" || portal === "franchise") {
    return view === "registers" || view === "admin-registers" ? ["registers", "admin-registers"] : [view];
  }
  return [];
}

export const firstOff = (features: Record<string, unknown> | undefined | null, keys: string[]) =>
  keys.find((k) => features?.[k] === false) ?? null;

/** Families: a customer-area section (settings.customerArea key) → the
 *  operator module(s) whose switch turns it off for families too. Read by the
 *  family nav (lib/use-customer-area.ts) and the parent APIs
 *  (server/src/lib/customerArea.ts), so hiding and refusing agree. */
export const CA_FEATURES: Record<string, string[]> = {
  messaging: ["messages"], coupons: ["marketing"], codesBanner: ["marketing"], newsfeed: ["newsfeed"],
  moments: ["moments"], meals: ["meals"], trips: ["trips"], timetable: ["timetable"],
  memberships: ["memberships"], refer: ["referrals"],
};

// ── Setup → Roles & permissions (settings.roles[].caps, per area) ─────────────

/** API prefix → the matrix area it belongs to. Applies to STAFF accounts only
 *  (owners — company, freelancer, franchise — are never gated). GET/HEAD needs
 *  View, anything else needs Edit. Not listed on purpose: a person's OWN
 *  schedule, leave, clock, learning, onboarding, expense claims and payslips
 *  (the matrix notes "non-managers see their own only"), help/support, and the
 *  Setup read every screen depends on. */
export const CAP_API: { prefix: string; area: string }[] = [
  { prefix: "/api/bookings", area: "bookings" },
  { prefix: "/api/customers", area: "customers" },
  { prefix: "/api/listings", area: "listings" },
  { prefix: "/api/blocks", area: "listings" },
  { prefix: "/api/registers", area: "registers" },
  { prefix: "/api/ratios", area: "ratios" },
  { prefix: "/api/meals", area: "meals" },
  { prefix: "/api/meal-menus", area: "meals" },
  { prefix: "/api/meal-options", area: "meals" },
  { prefix: "/api/meal-orders", area: "meals" },
  { prefix: "/api/trips", area: "trips" },
  { prefix: "/api/timetables", area: "timetable" },
  { prefix: "/api/calendar-events", area: "calendar" },
  { prefix: "/api/tasks", area: "tasks" },
  { prefix: "/api/children", area: "medical" },
  { prefix: "/api/incidents", area: "incidents" },
  { prefix: "/api/medications", area: "medication" },
  { prefix: "/api/moments", area: "moments" },
  { prefix: "/api/documents", area: "documents" },
  { prefix: "/api/analytics", area: "finances" },
  { prefix: "/api/growth", area: "finances" },
  { prefix: "/api/reconciliation", area: "finances" },
  { prefix: "/api/splitfees", area: "finances" },
  { prefix: "/api/expenses", area: "moneyops" },
  { prefix: "/api/income", area: "moneyops" },
  { prefix: "/api/invoices", area: "moneyops" },
  { prefix: "/api/purchasing", area: "moneyops" },
  { prefix: "/api/suppliers", area: "moneyops" },
  { prefix: "/api/payments", area: "moneyops" },
  { prefix: "/api/discounts", area: "marketing" },
  { prefix: "/api/referrals", area: "marketing" },
  { prefix: "/api/reviews", area: "marketing" },
  { prefix: "/api/messages", area: "messaging" },
  { prefix: "/api/posts", area: "messaging" },
  { prefix: "/api/emails", area: "email" },
  { prefix: "/api/franchises", area: "franchise" },
  { prefix: "/api/ho", area: "franchise" },
];

/** Writes allowed at View: the ones that are part of READING (confirming
 *  you've read a policy, reacting to a post), and recording a medication dose —
 *  Setup → Medication's own "who can give doses" setting (leads only / all
 *  staff, enforced in the route) decides that, not the matrix: a coach at
 *  Medication: View who is allowed to give doses can record one (decided by
 *  Kaz 13 Sept, s13-acc3). At None the medication area stays closed. */
const VIEW_LEVEL_WRITES: RegExp[] = [
  /^\/api\/documents\/library\/[^/]+\/read\/?$/,
  /^\/api\/posts\/[^/]+\/(react|rsvp|ack)\/?$/,
  /^\/api\/medications\/[^/]+\/administer\/?$/,
];
/** Never refused by the matrix: logging a safeguarding concern, an incident or
 *  an accident (anyone who works with children must be able to — one POST,
 *  kind decides), and messaging ActivityOS support. */
const NEVER_REFUSED: { method: string | null; re: RegExp }[] = [
  { method: "POST", re: /^\/api\/incidents\/?$/ },
  { method: null, re: /^\/api\/messages\/support(\/|$)/ },
];

const under = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + "/");

/** The feature entry an API call falls under, or null. A read of a
 *  FEATURE_WRITE_API module isn't gated. */
export function featureForApi(path: string, method = "GET"): { keys: string[]; label: string } | null {
  const hit = FEATURE_API.find((f) => under(path, f.prefix));
  if (hit) return hit;
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return null;
  return FEATURE_WRITE_API.find((f) => under(path, f.prefix) && !f.except?.some((re) => re.test(path))) ?? null;
}

/** The matrix area + level an API call needs, or null when it isn't gated. */
export function capForApi(path: string, method: string): { area: string; need: "view" | "edit" } | null {
  const m = method.toUpperCase();
  if (NEVER_REFUSED.some((x) => (!x.method || x.method === m) && x.re.test(path))) return null;
  const hit = CAP_API.find((c) => under(path, c.prefix));
  if (!hit) return null;
  const read = m === "GET" || m === "HEAD" || m === "OPTIONS" || VIEW_LEVEL_WRITES.some((re) => re.test(path));
  return { area: hit.area, need: read ? "view" : "edit" };
}

/** A staff portal view → its matrix area (unlisted = not gated). The staff
 *  "Report a concern" and "Accidents & first aid" pages are never gated — they
 *  are where a concern or an accident is logged (see NEVER_REFUSED); at
 *  Incidents: None the page opens and the log form works, the list is refused. */
const STAFF_VIEW_CAP: Record<string, string> = {
  customers: "customers", registers: "registers", ratios: "ratios", timetable: "timetable",
  meals: "meals", trips: "trips", tasks: "tasks", moments: "moments",
  medication: "medication", documents: "documents", messages: "messaging",
};
export function capAreaForView(portal: string, view: string): string | null {
  return portal === "staff" ? (STAFF_VIEW_CAP[view] ?? null) : null;
}

interface RoleLike { id: string; owner?: boolean; caps?: Record<string, CapLevel> }

/** The caps that bind this person, or null = not restricted (today's
 *  behaviour). Restricted only when ALL hold: the operator has actually edited
 *  the matrix in Setup (settings.rolesSetAt — Setup saves its whole settings
 *  bag, defaults included, on any change, so a stored `roles` alone doesn't
 *  mean anyone chose it), the person carries a permission role (users.permRole,
 *  else the role picked on their invite, users.staffRole), and that role exists
 *  in the matrix and isn't the owner role. */
export function resolveCaps(settings: Record<string, unknown> | null | undefined, permRole: string | null | undefined): Record<string, CapLevel> | null {
  if (!settings?.rolesSetAt || !permRole) return null;
  const roles = Array.isArray(settings.roles) ? (settings.roles as RoleLike[]) : [];
  const role = roles.find((r) => r && r.id === permRole);
  if (!role || role.owner) return null;
  return { ...(role.caps ?? {}) };
}

/** An area missing from the role's caps isn't restricted. */
export const capLevel = (caps: Record<string, CapLevel> | null | undefined, area: string): CapLevel =>
  (caps?.[area] as CapLevel | undefined) ?? "edit";
