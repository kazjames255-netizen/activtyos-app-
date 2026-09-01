// Demo data for the guided-tour routes (/tour/[portal]/[view]). Each view maps
// API paths → canned responses; lib/api.ts serves these instead of the network
// when demo mode is on, so the REAL page component renders populated, with no
// sign-in. Representative UK activity-camp data — the point is that the tour
// shows the actual page exactly as it looks in use.

import { GENERATED_FIXTURES } from "./tourFixtures.generated";
import { LB_FIXTURES } from "./tourExtra.generated";
import { TOILET_QUESTION } from "@/lib/settings";

type Fixtures = Record<string, unknown>;

// ── Dashboard ───────────────────────────────────────────────────────────────
// Bookings spread across Apr–Aug 2026 so the analytics charts (income by month,
// status/payment donuts, funnel, repeat customers) all populate. Deterministic
// — no Date.now()/random — so the demo is identical every render.
const LISTINGS = [
  "Summer Multi-Sports Camp",
  "After-school Football Club",
  "Gymnastics Stars",
  "Forest School Adventures",
  "Saturday Basketball",
  "Easter Holiday Camp",
];
const CHILDREN = [
  "Sophie Khan", "Aarav Patel", "Ella Thompson", "Noah Williams", "Ava Chen",
  "Jack O'Brien", "Mia Hussain", "Leo Rossi", "Freya Nguyen", "Oscar Bell",
  "Isla Murphy", "Harry Singh", "Grace Adeyemi", "Charlie Wood", "Lily Zhang",
];
const BOOKERS = [
  "Priya Khan", "Raj Patel", "Sarah Thompson", "Dan Williams", "Wei Chen",
  "Aoife O'Brien", "Zara Hussain", "Marco Rossi", "Mai Nguyen", "Kate Bell",
  "Ciara Murphy", "Amrit Singh", "Tola Adeyemi", "Emma Wood", "Ling Zhang",
];
const MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08"];
const PAY = ["Paid", "Paid", "Paid", "Funded", "Unpaid", "Invoice sent", "Paid", "Paid"];
const STATUS = ["Confirmed", "Confirmed", "Confirmed", "Confirmed", "Approval needed", "Waitlisted", "Cancelled", "Confirmed"];
const AMOUNTS = [96, 48, 60, 120, 45, 84, 72, 54];

const DASH_BOOKINGS = Array.from({ length: 42 }, (_, i) => {
  const month = MONTHS[i % MONTHS.length];
  const day = String(((i * 7) % 27) + 1).padStart(2, "0");
  const created = `${month}-${day}`;
  const status = STATUS[i % STATUS.length];
  const pay = status === "Cancelled" ? "Refunded" : PAY[i % PAY.length];
  const amount = AMOUNTS[i % AMOUNTS.length];
  const received = pay === "Paid" || pay === "Funded" ? amount : pay === "Refunded" ? amount : 0;
  return {
    ref: `AC-${2100 + i}`,
    bid: `b${i}`,
    tenantId: "demo",
    status,
    pay,
    amount,
    amountPaid: received,
    createdAt: `${created}T09:15:00.000Z`,
    days: [`${created}`],
    listing: LISTINGS[i % LISTINGS.length],
    listingId: `L${i % LISTINGS.length}`,
    child: CHILDREN[i % CHILDREN.length],
    booker: BOOKERS[i % BOOKERS.length],
    email: `${BOOKERS[i % BOOKERS.length].split(" ")[0].toLowerCase()}@example.com`,
    customer: BOOKERS[i % BOOKERS.length],
    time: "Full day",
    ...(status === "Cancelled" ? { cancel: { on: `${created}T10:00:00.000Z`, by: "operator", refund: "approved", amount } } : {}),
  };
});

// Today's register for the dashboard's "On site now" card. Dates are stamped at
// module load so the card is always populated whenever the tour is taken —
// a fixed date would leave it empty from the day after it was written.
const DASH_TODAY = new Date().toISOString().slice(0, 10);
const DASH_KIDS = ["Freya Walsh", "Amelia Bennett", "Oliver Bennett", "Jack Thompson", "Noah Clarke", "Harry Patel", "Sophia Reid"];
const dashAttendee = (i: number, status: "in" | "absent" | null) => ({
  ref: `DASH-${i}`,
  children: [{ name: DASH_KIDS[i] }],
  child: null,
  attendance: status ? { status } : null,
});
const DASH_REGISTERS = [
  {
    blockId: "dash-am", date: DASH_TODAY, start: "08:30", end: "12:30",
    blockName: "Multi-Sports (AM)", listingId: "lst-summer-camp", listingName: "Summer Multi-Sports Camp",
    attendees: [dashAttendee(0, "in"), dashAttendee(1, "in"), dashAttendee(2, "in"), dashAttendee(3, null), dashAttendee(4, "absent")],
    counts: { expected: 5, present: 3, notArrived: 1, absent: 1, collected: 0 },
    heads: [], takenBy: null,
  },
  {
    blockId: "dash-pm", date: DASH_TODAY, start: "15:30", end: "16:30",
    blockName: "After-school", listingId: "lst-football", listingName: "After-school Football Club",
    attendees: [dashAttendee(5, "in"), dashAttendee(6, null)],
    counts: { expected: 2, present: 1, notArrived: 1, absent: 0, collected: 0 },
    heads: [], takenBy: null,
  },
];

const DASH: Fixtures = {
  "/api/dashboard": {
    today: {
      date: "2026-08-11",
      booked: 21,
      sessions: [
        { listing: "After-school Football Club", start: "15:30", end: "16:30", booked: 12, capacity: 16 },
        { listing: "Summer Multi-Sports Camp · morning", start: "09:00", end: "12:00", booked: 9, capacity: 24 },
      ],
    },
    next: { date: "2026-08-12", start: "09:00", end: "15:00", listing: "Summer Multi-Sports Camp" },
    upcoming: [
      { date: "2026-08-12", start: "09:00", end: "15:00", listing: "Summer Multi-Sports Camp", spotsLeft: 6 },
      { date: "2026-08-15", start: "10:00", end: "11:00", listing: "Saturday Basketball", spotsLeft: 2 },
    ],
    byListing: [
      { listing: "Summer Multi-Sports Camp", capacity: 24, booked: 18, spotsLeft: 6, pct: 75, nextDate: "2026-08-12" },
      { listing: "Saturday Basketball", capacity: 20, booked: 18, spotsLeft: 2, pct: 90, nextDate: "2026-08-15" },
      { listing: "After-school Football Club", capacity: 16, booked: 12, spotsLeft: 4, pct: 75, nextDate: "2026-08-11" },
      { listing: "Gymnastics Stars", capacity: 18, booked: 18, spotsLeft: 0, pct: 100, nextDate: "2026-08-20" },
      { listing: "Forest School Adventures", capacity: 16, booked: 7, spotsLeft: 9, pct: 44, nextDate: "2026-08-18" },
    ],
    bookings: { live: 47, newThisWeek: 6, waitlist: 3 },
    occupancy: { booked: 73, capacity: 94, pct: 78 },
    money: { takenThisWeek: 1840, outstanding: 320, overdueVouchers: 0, awaitingVoucher: 1 },
    counts: { listings: 12, activeBlocks: 5 },
  },
  "/api/bookings": DASH_BOOKINGS,
  "/api/tasks": [
    { id: "t1", t: "Confirm minibus for Forest School trip", status: "todo", time: "10:00", due: "2026-08-11", link: { k: "Trip", v: "Forest School", href: "/freelancer/trips" } },
    { id: "t2", t: "Chase unpaid balance — Williams family", status: "prog", time: "14:00", due: "2026-08-11", link: { k: "Family", v: "Dan Williams", href: "/freelancer/customers" } },
    { id: "t3", t: "Print registers for tomorrow", status: "todo", due: "2026-08-11", link: null },
  ],
  // The dashboard's "On site now" card joins children (register) to staff
  // (clock store) via the listing's VENUE, so these three have to agree:
  // venue names must match the demo clock records' `op` values.
  "/api/listings": [
    { id: "L0", seasonId: "summer26" },
    { id: "L1", seasonId: null },
    { id: "lst-summer-camp", seasonId: "s-summer-hols", venueId: "v-mk" },
    { id: "lst-football", seasonId: "s-autumn-1", venueId: "v-bed" },
  ],
  "/api/library": {
    venues: [
      { id: "v-mk", name: "Milton Keynes" },
      { id: "v-bed", name: "Bedford" },
    ],
  },
  "/api/registers": DASH_REGISTERS,
};

// ── Staff dashboard ──────────────────────────────────────────────────────────
// The staff member's own landing page (StaffDashApp) — a different component to
// the operator dashboard, so it reads different endpoints: today's ratios/
// registers (children in vs due in, safeguarding watch list) + the team's tasks.
const STAFF_DASH: Fixtures = {
  "/api/me": { tenantName: "Riverside Sports Club" },
  "/api/ratios": {
    date: "today",
    bands: [],
    sessions: [
      { blockId: "b1", start: "09:00", end: "15:30", blockName: "Summer Multi-Sports Camp", listingName: "Riverside Holiday Camp", totalChildren: 22, sendCount: 2, requiredStaff: 3, staffAssigned: 3, met: true },
      { blockId: "b2", start: "15:30", end: "16:30", blockName: "After-school Football", listingName: "Riverside Football Club", totalChildren: 12, sendCount: 1, requiredStaff: 2, staffAssigned: 1, met: false },
    ],
  },
  "/api/registers": [
    {
      blockId: "b1", start: "09:00", end: "15:30", blockName: "Summer Multi-Sports Camp", listingName: "Riverside Holiday Camp",
      counts: { expected: 22, present: 14, notArrived: 7, absent: 1, collected: 0 },
      attendees: [
        { ref: "r1", children: [{ name: "Ava Thompson", age: 7 }], child: { allergies: "Peanuts — EpiPen in her bag" }, attendance: { status: "in" } },
        { ref: "r2", children: [{ name: "Noah Green", age: 9 }], child: { send: "1", sendPlanName: "ASD support plan" }, attendance: { status: "in" } },
        { ref: "r3", children: [{ name: "Leo Brooks", age: 8 }], child: { dietary: "Halal", allergies: "Dairy" }, attendance: { status: "in" } },
        { ref: "r4", children: [{ name: "Mia Patel", age: 6 }], child: { medical: "Asthma — blue inhaler with staff" }, attendance: null },
      ],
    },
    {
      blockId: "b2", start: "15:30", end: "16:30", blockName: "After-school Football", listingName: "Riverside Football Club",
      counts: { expected: 12, present: 0, notArrived: 12, absent: 0, collected: 0 },
      attendees: [
        { ref: "r5", children: [{ name: "Sofia Rossi", age: 10 }], child: { medical: "Type 1 diabetes", careNotes: "Individual healthcare plan on file" }, attendance: null },
      ],
    },
  ],
  "/api/tasks": [
    { id: "t1", title: "Set out the football cones before the 3:30 club", done: false, priority: "normal", dueDate: "Today" },
    { id: "t2", title: "Sign off the morning register", done: false, priority: "high" },
    { id: "t3", title: "Restock the first-aid kit — plasters running low", done: false },
  ],
  "/api/timetables/published": [],
};

// The Settings page shown at the end of every tour — the tab strip renders from
// defaults, so it only needs enough to not error.
const SETUP: Fixtures = {
  "/api/library": null,
  "/api/messages/settings": {},
  "/api/listings": [],
};

// A sample block so the listings walkthrough's Tickets step has one to pull in
// (its passes & prices become the listing's tickets) instead of erroring.
const DEMO_BLOCK: Fixtures = {
  "/api/periods": [{ id: "p-fullday", title: "Full day", start: "09:00", finish: "15:30" }],
  "/api/passes": [
    { id: "pass-5day", name: "5-day week", days: 5 },
    { id: "pass-day", name: "Day pass", days: 1 },
  ],
  "/api/block-bundles": [
    {
      id: "blk-summer", name: "Summer Holiday Camp — full week & days",
      periodIds: ["p-fullday"], passIds: ["pass-5day", "pass-day"], listingIds: [],
      order: 0, archived: false, priced: true, masterPrice: 175, calcOn: true,
      passFlat: {}, passMode: {}, periodPrice: {},
      resolved: {
        passes: [
          { id: "pass-5day", name: "5-day week", days: 5, price: 175 },
          { id: "pass-day", name: "Day pass", days: 1, price: 38 },
        ],
        timings: {}, perDay: 35,
      },
    },
  ],
};

// Keep the blocks builder short — just a few periods & passes — so the block
// being built (column 3) and the pricing calculator are visible without
// scrolling. The library block's own resolved passes still drive the calculator.
const BLOCKS_TRIM: Fixtures = {
  "/api/periods": [
    { id: "per-fullday", title: "Full day", start: "09:00", finish: "15:30" },
    { id: "per-morning", title: "Morning only", start: "09:00", finish: "12:30" },
    { id: "per-late", title: "Late pick-up", start: "15:30", finish: "17:30" },
  ],
  "/api/passes": [
    { id: "pass-5day", name: "5-day week pass", days: 5, details: "Monday to Friday — our best-value full week." },
    { id: "pass-3day", name: "3-day pass", days: 3 },
    { id: "pass-1day", name: "Single day pass", days: 1 },
  ],
};

export const TOUR_FIXTURES: Record<string, Fixtures> = {
  // Agent-authored fixtures for the other pages; the hand-tuned dashboard wins.
  ...GENERATED_FIXTURES,
  ...LB_FIXTURES,
  // Give the listings tour a block to pull into the Tickets step.
  listings: { ...LB_FIXTURES.listings, ...DEMO_BLOCK },
  // Fewer periods/passes so the built block + calculator fit on screen.
  blocks: { ...LB_FIXTURES.blocks, ...BLOCKS_TRIM },
  dash: DASH,
  // Give the register tour a toilet-training question plus one child who isn't
  // trained, so the nappy tag and change log actually appear in the walkthrough.
  registers: (() => {
    const base = (GENERATED_FIXTURES.registers ?? {}) as Fixtures;
    const sessions = (base["/api/registers"] as { attendees?: { child?: Record<string, unknown> | null }[] }[] | undefined) ?? [];
    return {
      ...base,
      "/api/library": { childQuestions: [TOILET_QUESTION] },
      "/api/registers": sessions.map((s, si) => ({
        ...s,
        attendees: (s.attendees ?? []).map((a, ai) =>
          si === 0 && ai < 2 && a.child ? { ...a, child: { ...a.child, answers: { "q-toilet": "No" } } } : a),
      })),
    };
  })(),
  // Staff portal's own dashboard (StaffDashApp) — portal-keyed so it doesn't
  // clash with the operator "dash" fixture above. Served for /tour/staff/dash.
  "staff/dash": STAFF_DASH,
  setup: SETUP,
  // The Team & Deployment page reads venues, listings, seasons and the plan's
  // staff seats — the generated fixtures predate all that, so top them up here
  // and the live walkthrough drives the CURRENT page fully populated.
  staff: {
    ...GENERATED_FIXTURES.staff,
    "/api/me": { role: "company", tenantName: "Sunrise Active Camps" },
    "/api/subscription": { current: { plan: "Company", staffLimit: 10, staffUsed: 6, details: { name: "Company" } } },
    "/api/library": {
      venues: [
        { id: "v-mk", name: "Loughton Manor First School" },
        { id: "v-bl", name: "Bletchley Leisure Centre" },
      ],
      settings: {
        seasons: [
          { id: "s-sum1", name: "Summer 1", from: "2026-07-20", to: "2026-08-14", kind: "holiday" },
          { id: "s-aut", name: "Autumn term", from: "2026-09-01", to: "2026-10-24", kind: "term" },
        ],
      },
      childQuestions: [],
    },
    "/api/listings": [
      { id: "l1", title: "Summer camp — Loughton Manor", venueId: "v-mk", seasonId: "s-sum1", status: "live", visibility: "public" },
      { id: "l2", title: "Holiday club — Bletchley", venueId: "v-bl", seasonId: "s-sum1", status: "live", visibility: "public" },
      { id: "l3", title: "After-school club", venueId: "v-mk", seasonId: "s-aut", status: "live", visibility: "public" },
    ],
  },
  // The rota reads the same venues, listings and seasons; ScheduleApp then
  // auto-seeds sample staff + shifts in demo mode so the walkthrough is populated.
  schedule: {
    "/api/me": { role: "company", tenantName: "Sunrise Active Camps" },
    "/api/library": {
      venues: [
        { id: "v-mk", name: "Loughton Manor First School" },
        { id: "v-bl", name: "Bletchley Leisure Centre" },
      ],
      settings: {
        seasons: [
          { id: "s-sum1", name: "Summer 1", from: "2026-07-20", to: "2026-08-14", kind: "holiday" },
          { id: "s-aut", name: "Autumn term", from: "2026-09-01", to: "2026-10-24", kind: "term" },
        ],
      },
      childQuestions: [],
    },
    "/api/listings": [
      { id: "l1", title: "Summer camp — Loughton Manor", venueId: "v-mk", seasonId: "s-sum1", status: "live", visibility: "public" },
      { id: "l2", title: "Holiday club — Bletchley", venueId: "v-bl", seasonId: "s-sum1", status: "live", visibility: "public" },
    ],
  },
};
