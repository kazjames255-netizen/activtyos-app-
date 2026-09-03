// Seed a RICH company dataset into a real tenant so kazjames80@gmail.co.uk (the
// "SPORTS DIRECT COMPANY" account) has lots to test with — families, listings,
// ~140 bookings spread over the last 100 days + upcoming, expenses (incl. a
// recurring venue-hire series) and other income. Drives the Dashboard, Bookings,
// Families, Finance/Analytics and Money in/out screens with believable numbers.
//
// Idempotent — every doc id is prefixed `cdemo-<tenantId>-` and content is
// deterministic (seeded PRNG), so re-running overwrites in place. Only ever
// touches the named tenant.
//
//   npx tsx src/seedCompanyDemo.ts                 # → SPORTS DIRECT COMPANY
//   npx tsx src/seedCompanyDemo.ts <tenantId>      # → a specific tenant
//   npx tsx src/seedCompanyDemo.ts clean           # remove ALL cdemo docs
import { db } from "./firebase";

const DEFAULT = "x4goY84cslX4mBV4LNtG"; // SPORTS DIRECT COMPANY (kazjames80@gmail.co.uk)
const arg = process.argv[2];
const TID = !arg || arg === "clean" ? DEFAULT : arg;

// Deterministic PRNG so re-runs produce identical docs (stable counts).
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = <T,>(r: () => number, a: T[]): T => a[Math.floor(r() * a.length)];
const round2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 86400000;
const today = new Date(); today.setUTCHours(12, 0, 0, 0);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const dayFrom = (offset: number) => isoDay(new Date(today.getTime() + offset * DAY));
const stampFrom = (offset: number, r: () => number) => new Date(today.getTime() + offset * DAY - Math.floor(r() * 10) * 3600_000).toISOString();

const FIRSTS = ["Ava", "Noah", "Leo", "Mia", "Sofia", "Jack", "Ella", "Harry", "Grace", "Oscar", "Isla", "Charlie", "Freddie", "Lily", "Arthur", "Poppy", "Theo", "Ivy", "Reggie", "Maya", "Rory", "Nula", "Kai", "Elsie"];
const LASTS = ["Thompson", "Green", "Brooks", "Patel", "Rossi", "Wood", "Chen", "Singh", "Adeyemi", "Bell", "Murphy", "Hughes", "Khan", "Walsh", "Owusu", "Nowak", "Ali", "Reyes", "Fraser", "Begum", "Doyle", "Clarke", "Ahmed", "Ford"];
const PARENTS = ["Sarah", "Dan", "Marco", "Raj", "Emma", "Wei", "Amrit", "Tola", "Kate", "Ciara", "Megan", "James", "Aisha", "Paul", "Kwame", "Anna", "Yusuf", "Elena", "Tom", "Nadia", "Sean", "Priya", "Omar", "Beth"];

// Two sites, so the dashboard's location line + filter have something to show.
const VENUES = [
  { key: "loughton", name: "Loughton Leisure Centre", address: "Traps Hill, Loughton IG10 1SZ", city: "Loughton" },
  { key: "buckhurst", name: "Buckhurst Hill Sports Hall", address: "Queens Rd, Buckhurst Hill IG9 5BX", city: "Buckhurst Hill" },
];
const LISTINGS = [
  { key: "camp", name: "Summer Holiday Camp", venue: "loughton", passes: [{ name: "5-day week pass", price: 150 }, { name: "Daily pass", price: 35 }], w: 5 },
  { key: "football", name: "After-School Football Club", venue: "buckhurst", passes: [{ name: "Termly", price: 120 }, { name: "Drop-in", price: 8 }], w: 4 },
  { key: "swim", name: "Learn to Swim", venue: "buckhurst", passes: [{ name: "Block of 6", price: 72 }, { name: "Single lesson", price: 14 }], w: 4 },
  { key: "parties", name: "Birthday Party Package", venue: "loughton", passes: [{ name: "Standard party", price: 180 }, { name: "Deluxe party", price: 260 }], w: 1 },
];
const STATUSES: [string, number][] = [["Confirmed", 78], ["Cancelled", 9], ["Waitlisted", 5], ["Approval needed", 5], ["Declined", 3]];
const PAYS: [string, number][] = [["Paid", 72], ["Unpaid", 14], ["Partially paid", 5], ["Refunded", 5], ["Invoice sent", 4]];
const METHODS = ["Card", "Cash", "Bank transfer", "Childcare voucher"];
const weighted = (r: () => number, pairs: [string, number][]) => { const total = pairs.reduce((s, [, n]) => s + n, 0); let x = r() * total; for (const [v, n] of pairs) { if ((x -= n) < 0) return v; } return pairs[0][0]; };

const ns = (s: string) => `cdemo-${TID}-${s}`;

async function seed() {
  const tenant = (await db.collection("tenants").doc(TID).get()).data() as { name?: string } | undefined;
  if (!tenant) { console.error(`No tenant ${TID}.`); process.exit(1); }
  const tName = tenant.name ?? "";
  const r = rng(0xC0FFEE);

  // ── Families (customers) ──────────────────────────────────────────────
  const families = Array.from({ length: 24 }, (_, i) => {
    const last = LASTS[i]; const parent = `${PARENTS[i]} ${last}`;
    const nKids = r() < 0.35 ? 2 : 1;
    const kids = Array.from({ length: nKids }, (_, k) => { const age = 4 + Math.floor(r() * 8); const yr = today.getUTCFullYear() - age; return { name: `${pick(r, FIRSTS)} ${last}`, age, dob: `${yr}-0${1 + Math.floor(r() * 8)}-1${Math.floor(r() * 8)}` }; });
    return { id: ns(`cust${i}`), parent, email: `${PARENTS[i].toLowerCase()}.${last.toLowerCase()}@example.com`, phone: `07700 9${String(10000 + i).slice(-5)}`, kids };
  });

  let batch = db.batch(); let ops = 0;
  const flush = async () => { if (ops) { await batch.commit(); batch = db.batch(); ops = 0; } };
  const put = (ref: FirebaseFirestore.DocumentReference, data: Record<string, unknown>) => { batch.set(ref, data, { merge: true }); if (++ops >= 400) return flush(); };

  for (const f of families) await put(db.collection("customers").doc(f.id), {
    tenantId: TID, name: f.parent, email: f.email, phone: f.phone,
    children: f.kids.map((k) => ({ name: k.name, dob: k.dob, age: k.age })),
    kids: f.kids.map((k) => ({ name: k.name, dob: k.dob, age: k.age })),
    createdAt: stampFrom(-100 + Math.floor(r() * 40), r), notes: "",
  });

  // ── Library venues (locations), so listings can point at a venue ──────
  await put(db.collection("libraries").doc(TID), {
    tenantId: TID,
    venues: VENUES.map((v) => ({ id: ns(`venue-${v.key}`), name: v.name, address: v.address, city: v.city })),
  });

  // ── Listings + one block each ─────────────────────────────────────────
  for (const l of LISTINGS) {
    const listingId = ns(l.key);
    await put(db.collection("listings").doc(listingId), {
      tenantId: TID, tenantName: tName, name: l.name, passes: l.passes, status: "live", visibility: "public",
      venueId: ns(`venue-${l.venue}`),
      maxAttendees: "40", capacityScope: "listing", days: [1, 2, 3, 4, 5], images: [], gallery: [], categoryIds: [], addonIds: [], staffIds: [], sections: [], send: [],
    });
    await put(db.collection("blocks").doc(ns(`${l.key}-blk`)), {
      tenantId: TID, listingId, name: `${l.name} · sessions`, auto: true, open: true, capacity: 40, capacityScope: "listing",
      startDate: dayFrom(-30), endDate: dayFrom(45), bookedCount: 0, dayCounts: {}, sessions: [{ date: dayFrom(2), start: "09:00", end: "15:00" }],
    });
  }

  // ── Bookings — ~140 spread across the last 100 days + upcoming ─────────
  const N = 140;
  for (let i = 0; i < N; i++) {
    const f = families[i % families.length];
    const kid = pick(r, f.kids);
    const l = weighted(r, LISTINGS.map((x) => [x.key, x.w])) as string;
    const listing = LISTINGS.find((x) => x.key === l)!;
    const pass = pick(r, listing.passes);
    const seats = r() < 0.15 ? 2 : 1;
    const createdOffset = -Math.floor(r() * 100); // booked within last 100 days
    const sessionOffset = createdOffset + 3 + Math.floor(r() * 40); // session after booking (some future)
    const sDate = dayFrom(sessionOffset);
    const status = weighted(r, STATUSES);
    const pay = status === "Cancelled" ? weighted(r, [["Refunded", 6], ["Unpaid", 4]]) : status === "Confirmed" ? weighted(r, PAYS) : "Unpaid";
    const amount = round2(pass.price * seats * (pay === "Partially paid" ? 1 : 1));
    const ref = `SD-${2000 + i}`;
    await put(db.collection("bookings").doc(ns(`bk${i}`)), {
      ref, bid: `SD${2000 + i}`, tenantId: TID, blockId: ns(`${l}-blk`), listingId: ns(l),
      booker: f.parent, email: f.email, phone: f.phone, child: kid.name, age: kid.age, dob: kid.dob,
      kids: seats === 2 ? f.kids.slice(0, 2).map((k) => ({ name: k.name, age: k.age, dob: k.dob })) : [{ name: kid.name, age: kid.age, dob: kid.dob }],
      seats, listing: listing.name, pass: pass.name, ticket: "09:00–15:00", dates: sDate, days: [sDate], sessions: [`${sDate} · 09:00 – 15:00`],
      status, pay, method: pick(r, METHODS), amount, amountPaid: pay === "Paid" ? amount : pay === "Partially paid" ? round2(amount / 2) : 0,
      createdAt: stampFrom(createdOffset, r), addons: [], answers: [], note: "", recon: null, evid: null, cancel: status === "Cancelled" ? { at: stampFrom(createdOffset + 1, r), by: "Office" } : null,
    });
  }

  // ── Expenses (money-out) — categories over the last 120 days ──────────
  // ── Expenses & other income — intentionally NOT seeded ────────────────
  // These were previously written at tenant level with no franchiseId, so under
  // the franchise model they counted as HEAD OFFICE's own books and made the HO
  // Money view look pre-filled. Head office should start with a clean money slate
  // (it logs its own central costs/income), so we seed none. The wipe below still
  // clears any left over from an earlier seed. Bookings still drive the network
  // revenue + royalty figures.

  await flush();
  console.log(`✅ ${TID} (${tName}) seeded: ${families.length} families · ${N} bookings · 4 listings · 0 expenses · 0 income (HO money starts blank).`);
}

async function clean() {
  for (const coll of ["customers", "listings", "blocks", "bookings", "expenses", "income"]) {
    const snap = await db.collection(coll).get();
    const del = snap.docs.filter((d) => d.id.startsWith("cdemo-"));
    for (let i = 0; i < del.length; i += 400) { const b = db.batch(); del.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit(); }
    console.log(`  ${coll}: deleted ${del.length} cdemo docs`);
  }
}

async function main() {
  if (arg === "clean") { console.log("Cleaning cdemo data…"); await clean(); process.exit(0); }
  console.log("Clearing any stale cdemo docs first…"); await clean();
  console.log(`Seeding company demo → ${TID}`);
  await seed();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
