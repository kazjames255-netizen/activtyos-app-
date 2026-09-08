// Seed a RICH, CURATED marketing dataset into a tenant so the "Grow your numbers"
// (Marketing strategies) page looks alive: varied listing fill, a clean spread of
// audience segments (new / one-time / loyal / lapsed / waitlisted), enquiries with
// no booking, and a few reviews. Everything is realistic and internally sensible so
// the growth engine's per-audience + per-listing advice all has something to say.
//
// It first CLEARS the marketing-relevant collections for the target tenant
// (bookings, blocks, listings, customers, reviews) so old/stale seed data doesn't
// drown the picture, then writes the curated set. Only ever touches ONE tenant.
//
//   npx tsx src/seedGrowthDemo.ts                 # → the active operator tenant
//   npx tsx src/seedGrowthDemo.ts <tenantId>      # → a specific tenant
//   npx tsx src/seedGrowthDemo.ts clean           # just clear, don't reseed
import { db } from "./firebase";

const DEFAULT = "VOiiaTnDNd03MLbZaVcM"; // the freelancer operator dashboard the user reviews
const arg = process.argv[2];
const TID = !arg || arg === "clean" ? DEFAULT : arg;

function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = <T,>(r: () => number, a: T[]): T => a[Math.floor(r() * a.length)];
const round2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 86400000;
const today = new Date(); today.setUTCHours(12, 0, 0, 0);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const dayFrom = (o: number) => isoDay(new Date(today.getTime() + o * DAY));
const stampFrom = (o: number, r: () => number) => new Date(today.getTime() + o * DAY - Math.floor(r() * 10) * 3600_000).toISOString();

const FIRSTS = ["Ava", "Noah", "Leo", "Mia", "Sofia", "Jack", "Ella", "Harry", "Grace", "Oscar", "Isla", "Charlie", "Freddie", "Lily", "Arthur", "Poppy", "Theo", "Ivy", "Reggie", "Maya", "Rory", "Nula", "Kai", "Elsie", "Rex", "Nova", "Otis", "Faye", "Zane", "Immy"];
const LASTS = ["Thompson", "Green", "Brooks", "Patel", "Rossi", "Wood", "Chen", "Singh", "Adeyemi", "Bell", "Murphy", "Hughes", "Khan", "Walsh", "Owusu", "Nowak", "Ali", "Reyes", "Fraser", "Begum", "Doyle", "Clarke", "Ahmed", "Ford", "Hall", "Shaw", "Dunn", "Perry", "Boyd", "Nash"];
const PARENTS = ["Sarah", "Dan", "Marco", "Raj", "Emma", "Wei", "Amrit", "Tola", "Kate", "Ciara", "Megan", "James", "Aisha", "Paul", "Kwame", "Anna", "Yusuf", "Elena", "Tom", "Nadia", "Sean", "Priya", "Omar", "Beth", "Luke", "Hana", "Gary", "Ruth", "Femi", "Jo"];

const LISTINGS = [
  { key: "camp", name: "Summer Multi-Activity Camp", cap: 30, fill: 0.40, passes: [{ name: "Full week", price: 135 }, { name: "Day pass", price: 32 }] },
  { key: "football", name: "After-School Football Club", cap: 20, fill: 0.72, passes: [{ name: "Half-term", price: 96 }, { name: "Drop-in", price: 9 }] },
  { key: "art", name: "Holiday Art Club", cap: 24, fill: 0.88, passes: [{ name: "3-day", price: 84 }, { name: "Single day", price: 30 }] },
  { key: "swim", name: "Learn to Swim", cap: 16, fill: 0.55, passes: [{ name: "Block of 6", price: 72 }, { name: "Taster", price: 14 }] },
];
const METHODS = ["Card", "Cash", "Bank transfer", "Childcare voucher"];
const ns = (s: string) => `gdemo-${TID}-${s}`;

async function clearTenant() {
  let total = 0;
  for (const coll of ["bookings", "blocks", "listings", "customers", "reviews"]) {
    const snap = await db.collection(coll).where("tenantId", "==", TID).get();
    for (let i = 0; i < snap.docs.length; i += 400) { const b = db.batch(); snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit(); }
    total += snap.docs.length;
    console.log(`  cleared ${snap.docs.length} ${coll}`);
  }
  return total;
}

async function seed() {
  const tenant = (await db.collection("tenants").doc(TID).get()).data() as { name?: string } | undefined;
  if (!tenant) { console.error(`No tenant ${TID}.`); process.exit(1); }
  const tName = tenant.name ?? "";
  const r = rng(0x9E3779B9);

  let batch = db.batch(); let ops = 0;
  const flush = async () => { if (ops) { await batch.commit(); batch = db.batch(); ops = 0; } };
  const put = (ref: FirebaseFirestore.DocumentReference, data: Record<string, unknown>) => { batch.set(ref, data, { merge: true }); if (++ops >= 400) return flush(); };

  // ── Listings + a block each, with FUTURE sessions at a target fill level ──
  const futureDates = [3, 6, 9, 12, 17, 24, 31, 38];
  const pastDates = [-7, -14];
  for (const l of LISTINGS) {
    const listingId = ns(l.key);
    await put(db.collection("listings").doc(listingId), {
      tenantId: TID, tenantName: tName, name: l.name, passes: l.passes, status: "live", visibility: "public",
      maxAttendees: String(l.cap), capacityScope: "day", days: [1, 2, 3, 4, 5], images: [], gallery: [], categoryIds: [], addonIds: [], staffIds: [], sections: [], send: [],
    });
    const dayCounts: Record<string, number> = {};
    const sessions = [...pastDates, ...futureDates].map((o) => ({ date: dayFrom(o), start: "09:00", end: "15:00" }));
    for (const o of futureDates) dayCounts[dayFrom(o)] = Math.round(l.cap * l.fill);
    for (const o of pastDates) dayCounts[dayFrom(o)] = Math.round(l.cap * 0.9);
    await put(db.collection("blocks").doc(ns(`${l.key}-blk`)), {
      tenantId: TID, listingId, name: `${l.name} · sessions`, auto: true, open: true, capacity: l.cap, capacityScope: "day",
      startDate: dayFrom(-14), endDate: dayFrom(45), bookedCount: Math.round(l.cap * l.fill), dayCounts, sessions,
    });
  }

  // ── Families by cohort ──────────────────────────────────────────────────
  let fi = 0;
  const mkFamily = (cohort: string) => {
    const last = LASTS[fi % LASTS.length]; const first = PARENTS[fi % PARENTS.length];
    const nKids = cohort === "loyal" && r() < 0.5 ? 2 : r() < 0.2 ? 2 : 1;
    const kids = Array.from({ length: nKids }, () => { const age = 4 + Math.floor(r() * 8); return { name: `${pick(r, FIRSTS)} ${last}`, age, dob: `${today.getUTCFullYear() - age}-0${1 + Math.floor(r() * 8)}-1${Math.floor(r() * 8)}` }; });
    const fam = { id: ns(`cust${fi}`), parent: `${first} ${last}`, email: `${first.toLowerCase()}.${last.toLowerCase()}${fi}@example.com`, phone: `07700 9${String(10000 + fi).slice(-5)}`, kids, cohort };
    fi += 1; return fam;
  };
  const cohorts = [
    ...Array.from({ length: 14 }, () => mkFamily("lapsed")),
    ...Array.from({ length: 12 }, () => mkFamily("loyal")),
    ...Array.from({ length: 16 }, () => mkFamily("onetime")),
    ...Array.from({ length: 8 }, () => mkFamily("new")),
  ];

  for (const f of cohorts) await put(db.collection("customers").doc(f.id), {
    tenantId: TID, name: f.parent, email: f.email, phone: f.phone,
    children: f.kids, kids: f.kids, marketingOptIn: true, createdAt: stampFrom(-120 + Math.floor(r() * 100), r), notes: "",
  });

  // Enquiries — on the customer list, never booked (some opted in so they're reachable).
  const enquiries = Array.from({ length: 14 }, (_, i) => {
    const last = LASTS[(fi + i) % LASTS.length]; const first = PARENTS[(fi + i) % PARENTS.length];
    return { id: ns(`enq${i}`), parent: `${first} ${last}`, email: `${first.toLowerCase()}.${last.toLowerCase()}.enq${i}@example.com`, phone: `07700 8${String(10000 + i).slice(-5)}` };
  });
  for (const e of enquiries) await put(db.collection("customers").doc(e.id), {
    tenantId: TID, name: e.parent, email: e.email, phone: e.phone, children: [], kids: [],
    marketingOptIn: r() < 0.6, location: pick(r, ["", "Bedford", "Milton Keynes"]), createdAt: stampFrom(-Math.floor(r() * 40), r), notes: "Enquiry — not yet booked",
  });

  // ── Bookings per cohort ─────────────────────────────────────────────────
  let b = 0;
  const mkBooking = (f: typeof cohorts[number], createdOffset: number, sessionOffset: number, status = "Confirmed", pay = "Paid") => {
    const l = pick(r, LISTINGS); const pass = pick(r, l.passes); const kid = pick(r, f.kids);
    const seats = f.kids.length >= 2 && r() < 0.5 ? 2 : 1;
    const sDate = dayFrom(sessionOffset); const amount = round2(pass.price * seats);
    void put(db.collection("bookings").doc(ns(`bk${b}`)), {
      ref: `GD-${3000 + b}`, bid: `GD${3000 + b}`, tenantId: TID, blockId: ns(`${l.key}-blk`), listingId: ns(l.key),
      booker: f.parent, email: f.email, phone: f.phone, child: kid.name, age: kid.age, dob: kid.dob,
      kids: seats === 2 ? f.kids.slice(0, 2) : [kid], seats, listing: l.name, pass: pass.name, ticket: "09:00–15:00",
      dates: sDate, days: [sDate], sessions: [`${sDate} · 09:00 – 15:00`],
      status, pay, method: pick(r, METHODS), amount, amountPaid: pay === "Paid" ? amount : 0,
      createdAt: stampFrom(createdOffset, r), addons: [], answers: [], note: "", recon: null, evid: null, cancel: null,
    });
    b += 1;
  };
  for (const f of cohorts) {
    if (f.cohort === "lapsed") mkBooking(f, -(110 + Math.floor(r() * 100)), -(30 + Math.floor(r() * 60)));
    else if (f.cohort === "loyal") { const n = 2 + Math.floor(r() * 2); for (let k = 0; k < n; k++) mkBooking(f, -(8 + Math.floor(r() * 62)), k === 0 ? 3 + Math.floor(r() * 35) : -(3 + Math.floor(r() * 40))); }
    else if (f.cohort === "onetime") mkBooking(f, -(35 + Math.floor(r() * 50)), r() < 0.4 ? 3 + Math.floor(r() * 30) : -(3 + Math.floor(r() * 30)));
    else mkBooking(f, -(2 + Math.floor(r() * 22)), 3 + Math.floor(r() * 35)); // new → upcoming session
  }
  // Waitlisted — a handful holding for the near-full clubs.
  for (let i = 0; i < 6; i++) { const f = cohorts[(cohorts.length - 1 - i + cohorts.length) % cohorts.length]; mkBooking(f, -(2 + Math.floor(r() * 18)), 3 + Math.floor(r() * 30), "Waitlisted", "Unpaid"); }

  // ── A few reviews so the stat isn't zero ─────────────────────────────────
  const REVIEWS = [
    { rating: 5, author: "Emma Green", text: "My son came home buzzing every day — brilliant coaches.", listing: "Summer Multi-Activity Camp" },
    { rating: 5, author: "Raj Patel", text: "So well organised and the staff genuinely care.", listing: "After-School Football Club" },
    { rating: 4, author: "Kate Bell", text: "Great value and my daughter loved the art club.", listing: "Holiday Art Club" },
    { rating: 5, author: "Tom Fraser", text: "Booking was easy and pickup is really flexible.", listing: "Learn to Swim" },
    { rating: 5, author: "Aisha Khan", text: "The team went above and beyond. Highly recommend!", listing: "Summer Multi-Activity Camp" },
    { rating: 4, author: "Sean Doyle", text: "Lovely holiday camp, would book again.", listing: "Holiday Art Club" },
  ];
  REVIEWS.forEach((rv, i) => void put(db.collection("reviews").doc(ns(`rev${i}`)), {
    tenantId: TID, source: "inhouse", rating: rv.rating, author: rv.author, text: rv.text, listing: rv.listing,
    postedAt: stampFrom(-Math.floor(r() * 60), r), verified: true, reply: null, franchiseId: null,
  }));

  await flush();
  console.log(`✅ ${TID} (${tName}) seeded for marketing:`);
  console.log(`   ${cohorts.length} booked families (14 lapsed · 12 loyal · 16 one-time · 8 new) + 14 enquiries`);
  console.log(`   ${b} bookings across 4 listings (fill 40% / 72% / 88% / 55%) + 6 reviews`);
}

async function main() {
  console.log(`Clearing marketing collections for ${TID}…`);
  await clearTenant();
  if (arg === "clean") { console.log("Clean only — done."); process.exit(0); }
  console.log(`Seeding growth demo → ${TID}`);
  await seed();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
