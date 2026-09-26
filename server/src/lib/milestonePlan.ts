// The model + roll-up maths are shared with the front end (lib/milestones.ts) —
// the same precedent as middleware/access.ts importing lib/accessMap.ts. One
// definition of "how complete is a phase" for both sides.
import type { MPhase } from "../../../lib/milestones";

// The default Milestones plan a tenant starts with — the head office then edits
// it (PUT /api/milestones/template) and every franchise follows it.
//
// Ported from the front end's `features/milestones/data.ts seedTemplate()`, with
// one deliberate change: the ids are STABLE SLUGS, not crypto.randomUUID().
// Progress is keyed by step/action id, so a per-browser random seed meant head
// office's plan and a franchise's plan shared no ids at all — nothing a
// franchise ticked could ever line up with what head office wrote. Fixed ids
// make the seed idempotent and the two sides comparable.
//
// Fixed ids are also what lets head office re-order or rename a phase without
// wiping a franchise's progress (acceptance p2-l11) — keep them when editing.

const step = (
  id: string,
  title: string,
  detail: string,
  links: { label: string; href: string }[] = [],
  actions: string[] = [],
) => ({
  id,
  title,
  detail,
  links,
  actions: actions.map((t, i) => ({ id: `${id}-a${i + 1}`, title: t })),
});

export function defaultPhases(): MPhase[] {
  return [
    { id: "setup", title: "Get set up", subtitle: "One-time launch — do these once to open your doors.", when: "setup", recurring: false, icon: "🚀", steps: [
      step("setup-company", "Register your company & insurance", "Business details, public liability and employer's liability in place.", [{ label: "Setup", href: "/franchise/setup" }]),
      step("setup-safeguarding", "Safeguarding & DBS", "DBS checks and safeguarding training for you and every staff member.", [{ label: "Compliance", href: "/franchise/compliance" }]),
      step("setup-branding", "Add your branding & provider name", "Logo, colours and the name parents will see.", [{ label: "Setup", href: "/franchise/setup" }]),
      step("setup-first-listing", "Create your first venue & listing", "Add the venue and publish your first camp listing.", [{ label: "Listings", href: "/franchise/listings" }, { label: "Locations", href: "/franchise/locations" }]),
      step("setup-pricing", "Set pricing & payments", "Prices, deposits and connect your payout account.", [{ label: "Setup", href: "/franchise/setup" }]),
      step("setup-staff", "Recruit & invite your first staff", "Send invites and set each person's role.", [{ label: "Team & invites", href: "/franchise/staff" }]),
    ] },
    { id: "before", title: "Plan the season", subtitle: "The weeks before a holiday camp — get everything ready and packed.", when: "before", recurring: true, icon: "📦", steps: [
      step("before-open", "Open bookings & publish the timetable", "Build blocks and put the timetable live for parents.", [{ label: "Blocks", href: "/franchise/blocks" }, { label: "Timetable", href: "/franchise/timetable" }]),
      step("before-rota", "Build the staff rota & check ratios", "Roster staff to sessions and confirm you're within ratios.", [{ label: "Schedule", href: "/franchise/schedule" }, { label: "Ratios", href: "/franchise/ratios" }]),
      step("before-risk", "Complete risk assessments", "Venue and activity risk assessments signed off.", [{ label: "Compliance", href: "/franchise/compliance" }]),
      step("before-kit", "Order & pack kit and resources", "Stock-check, order what's short and pack the camp boxes.", [{ label: "Inventory", href: "/franchise/inventory" }], ["Run a stock-check against the kit list", "Order anything short", "Pack a box per group", "Load first-aid kits & spill kit", "Check the equipment is safe & clean"]),
      step("before-registers", "Print registers", "Registers ready for each group and day.", [{ label: "Registers", href: "/franchise/registers" }]),
      step("before-parents", "Send parents pre-camp info", "What to bring, drop-off/pick-up and key info.", [{ label: "Messages", href: "/franchise/messages" }, { label: "Email", href: "/franchise/email" }]),
      step("before-meals", "Confirm meals & allergens", "Menu set and allergens cross-checked against bookings.", [{ label: "Meals", href: "/franchise/meals" }]),
    ] },
    { id: "during", title: "Camp week — on the ground", subtitle: "During the camp — the daily running rhythm.", when: "during", recurring: true, icon: "⛺", steps: [
      step("during-signin", "Take sign-in on the register", "Mark children in at drop-off and track who's present.", [{ label: "Registers", href: "/franchise/registers" }], ["Greet each family at the door", "Mark the child present", "Confirm collection password", "Note allergies & medication", "Flag any no-shows to the office"]),
      step("during-ratios", "Keep ratios right on the day", "Adjust staffing live if numbers change.", [{ label: "Ratios", href: "/franchise/ratios" }]),
      step("during-log", "Log medication & incidents", "Record any medication given and any accidents/incidents.", [{ label: "Medication", href: "/franchise/medication" }, { label: "Incidents", href: "/franchise/incidents" }]),
      step("during-moments", "Share moments with parents", "Post photos and highlights during the day.", [{ label: "Moments", href: "/franchise/moments" }]),
      step("during-close", "Close the register each day", "Sign children out and close the day's register.", [{ label: "Registers", href: "/franchise/registers" }]),
    ] },
    { id: "after", title: "Wrap & review", subtitle: "After the season — close it out and learn from it.", when: "after", recurring: true, icon: "📊", steps: [
      step("after-reconcile", "Reconcile income & expenses", "Match takings and costs; check the season's numbers.", [{ label: "Reconciliation", href: "/franchise/reconciliation" }, { label: "Finance", href: "/franchise/finance" }]),
      step("after-payroll", "Run payroll", "Approve hours and pay your team.", [{ label: "Payroll", href: "/franchise/payroll" }]),
      step("after-survey", "Send a parent feedback survey", "Gather reviews and NPS while it's fresh.", [{ label: "Email", href: "/franchise/email" }]),
      step("after-debrief", "Staff debrief & appraisals", "What went well, what to fix; log feedback for reviews.", [{ label: "Team", href: "/franchise/staff" }]),
      step("after-restock", "Restock inventory", "Note what ran out and reorder for next time.", [{ label: "Inventory", href: "/franchise/inventory" }]),
    ] },
    { id: "clubs", title: "After-school clubs", subtitle: "Setting up a term-time club — a parallel track to camps.", when: "clubs", recurring: false, icon: "🏫", steps: [
      step("clubs-school", "Secure the school & agreement", "Confirm the venue, dates and any hire agreement.", [{ label: "Locations", href: "/franchise/locations" }]),
      step("clubs-timetable", "Build the club timetable", "Weekly sessions and capacity per club.", [{ label: "Blocks", href: "/franchise/blocks" }]),
      step("clubs-enrol", "Enrol children & set fees", "Open enrolment and set termly or weekly fees.", [{ label: "Listings", href: "/franchise/listings" }]),
      step("clubs-weekly", "Weekly run sheet & registers", "A repeatable weekly routine and registers per club.", [{ label: "Registers", href: "/franchise/registers" }]),
    ] },
  ];
}
