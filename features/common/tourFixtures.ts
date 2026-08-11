// Demo data for the guided-tour routes (/tour/[portal]/[view]). Each view maps
// API paths → canned responses; lib/api.ts serves these instead of the network
// when demo mode is on, so the REAL page component renders populated, with no
// sign-in. Representative UK activity-camp data — the point is that the tour
// shows the actual page exactly as it looks in use.

import { GENERATED_FIXTURES } from "./tourFixtures.generated";
import { LB_FIXTURES } from "./tourExtra.generated";

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
  "/api/listings": [
    { id: "L0", seasonId: "summer26" },
    { id: "L1", seasonId: null },
  ],
  "/api/library": null,
};

// The Settings page shown at the end of every tour — the tab strip renders from
// defaults, so it only needs enough to not error.
const SETUP: Fixtures = {
  "/api/library": null,
  "/api/messages/settings": {},
  "/api/listings": [],
};

export const TOUR_FIXTURES: Record<string, Fixtures> = {
  // Agent-authored fixtures for the other pages; the hand-tuned dashboard wins.
  ...GENERATED_FIXTURES,
  ...LB_FIXTURES,
  dash: DASH,
  setup: SETUP,
};
