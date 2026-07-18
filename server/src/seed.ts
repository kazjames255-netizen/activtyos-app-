// Seed Firestore with a demo tenant ("APF Activity Camps" — the first
// provider from the product overview) and its dataset extracted from the
// legacy prototype. Idempotent: skips any collection that already has
// documents unless --force.
//
//   npm run seed                        # seed empty collections
//   npm run seed -- --force             # wipe + reseed the DEMO TENANT's data only
//   npm run seed -- --customers <tid>   # demo parents onto a REAL tenant (for
//                                       # testing customer search / checkout)
//
// --force only ever deletes documents belonging to the demo tenant. Real
// accounts and their tenants/listings/bookings are never touched — a reseed
// once wiped the whole `tenants` collection and orphaned live accounts
// (every listing showed "Unknown provider").

import "dotenv/config";
import { db } from "./firebase";
import { generateSessions } from "./lib/blockDomain";
import { toDoc } from "./lib/bookingDoc";
import { seedBookings } from "../../features/bookings/data";
import type { Booking } from "../../features/bookings/types";

const force = process.argv.includes("--force");

export const DEMO_TENANT_ID = "apf-demo";
const DEMO_TENANT_NAME = "APF Activity Camps";

// Delete only the demo tenant's documents in a collection.
async function wipe(name: string) {
  const snap = await db.collection(name).where("tenantId", "==", DEMO_TENANT_ID).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

async function isEmpty(name: string) {
  const snap = await db
    .collection(name)
    .where("tenantId", "==", DEMO_TENANT_ID)
    .limit(1)
    .get();
  return snap.empty;
}

async function seedTenant() {
  // No wipe here: the demo tenant doc is keyed by id and set() overwrites it.
  // Other tenants belong to real accounts and must survive a reseed.
  const ref = db.collection("tenants").doc(DEMO_TENANT_ID);
  if (!force && (await ref.get()).exists) {
    console.log("tenants: demo tenant exists, skipping");
    return;
  }
  await ref.set({
    name: DEMO_TENANT_NAME,
    type: "company",
    ownerUid: null, // no owner account — claim it with set-role if needed
    createdAt: new Date().toISOString(),
    nextBid: 10312,
  });
  console.log(`tenants: seeded demo tenant "${DEMO_TENANT_NAME}" (${DEMO_TENANT_ID})`);
}

async function seedBookingsCol() {
  if (force) await wipe("bookings");
  else if (!(await isEmpty("bookings"))) {
    console.log("bookings: not empty, skipping (use --force to reseed)");
    return;
  }
  const batch = db.batch();
  for (const b of seedBookings) {
    const withTenant: Booking = { ...JSON.parse(JSON.stringify(b)), tenantId: DEMO_TENANT_ID };
    batch.set(db.collection("bookings").doc(`${DEMO_TENANT_ID}_${b.ref}`), toDoc(withTenant));
  }
  await batch.commit();
  console.log(`bookings: seeded ${seedBookings.length} records for the demo tenant`);
}

async function seedListingsCol() {
  if (force) {
    await wipe("listings");
    await wipe("blocks");
  } else if (!(await isEmpty("listings"))) {
    console.log("listings: not empty, skipping");
    return;
  }
  const listings = [
    {
      id: "lst-1",
      name: "Summer Holiday Camp 2027",
      passes: [
        { name: "5-day week pass", price: 200 },
        { name: "4-day pass", price: 160 },
        { name: "1-day pass", price: 40 },
      ],
      blocks: [
        { name: "Week 1 · 28 Jul – 1 Aug 2027", startDate: "2027-07-28", endDate: "2027-08-01" },
        { name: "Week 2 · 4 – 8 Aug 2027", startDate: "2027-08-04", endDate: "2027-08-08" },
        { name: "Week 3 · 11 – 15 Aug 2027", startDate: "2027-08-11", endDate: "2027-08-15" },
      ],
    },
    {
      id: "lst-2",
      name: "Easter Football Camp",
      passes: [
        { name: "5-day week pass", price: 200 },
        { name: "4-day pass", price: 160 },
        { name: "1-day pass", price: 40 },
      ],
      blocks: [
        { name: "Week 1 · 7 – 10 Apr 2027", startDate: "2027-04-07", endDate: "2027-04-10" },
        { name: "Week 2 · 14 – 18 Apr 2027", startDate: "2027-04-14", endDate: "2027-04-18" },
      ],
    },
    {
      id: "lst-3",
      name: "After-School Dance Club",
      passes: [{ name: "Term pass", price: 72 }],
      blocks: [
        {
          name: "Summer term · Tue ×6",
          startDate: "2027-06-01",
          endDate: "2027-07-06",
          weekdays: [2],
          startTime: "15:30",
          endTime: "17:00",
        },
      ],
    },
  ];
  const batch = db.batch();
  let blockCount = 0;
  for (const l of listings) {
    batch.set(db.collection("listings").doc(l.id), {
      name: l.name,
      passes: l.passes,
      tenantId: DEMO_TENANT_ID,
      tenantName: DEMO_TENANT_NAME,
    });
    for (const blk of l.blocks) {
      const withDefaults = { startTime: "09:00", endTime: "15:30", weekdays: [1, 2, 3, 4, 5], ...blk };
      batch.set(db.collection("blocks").doc(`blk-${l.id}-${++blockCount}`), {
        tenantId: DEMO_TENANT_ID,
        listingId: l.id,
        name: blk.name,
        startDate: blk.startDate,
        endDate: blk.endDate,
        capacity: 24,
        bookedCount: 0,
        open: true,
        sessions: generateSessions(
          withDefaults.startDate,
          withDefaults.endDate,
          withDefaults.startTime,
          withDefaults.endTime,
          withDefaults.weekdays,
        ),
      });
    }
  }
  await batch.commit();
  console.log(`listings: seeded ${listings.length} + ${blockCount} blocks for the demo tenant`);
}

// Derived from the bookings' booker + kids fields.
function demoCustomers() {
  const byEmail = new Map<
    string,
    { name: string; email: string; phone: string; children: { name: string; age?: number; dob?: string }[] }
  >();
  for (const b of seedBookings) {
    const kids = b.kids?.length
      ? b.kids.map((k) => ({ name: k.name, age: k.age, dob: k.dob }))
      : [{ name: b.child, age: b.age, dob: b.dob }];
    const existing = byEmail.get(b.email);
    if (existing) {
      for (const k of kids)
        if (!existing.children.some((c) => c.name === k.name)) existing.children.push(k);
    } else {
      byEmail.set(b.email, { name: b.booker, email: b.email, phone: b.phone, children: kids });
    }
  }
  return [...byEmail.values()];
}

async function seedCustomersCol() {
  if (force) await wipe("customers");
  else if (!(await isEmpty("customers"))) {
    console.log("customers: not empty, skipping");
    return;
  }
  const customers = demoCustomers();
  const batch = db.batch();
  customers.forEach((c, i) =>
    batch.set(db.collection("customers").doc(`cust-${i + 1}`), { ...c, tenantId: DEMO_TENANT_ID }),
  );
  await batch.commit();
  console.log(`customers: seeded ${customers.length} for the demo tenant`);
}

// Demo parents onto a REAL tenant (idempotent — fixed doc ids per tenant), so
// an operator account has customers to search at checkout.
async function seedCustomersFor(tenantId: string) {
  const tenant = await db.collection("tenants").doc(tenantId).get();
  if (!tenant.exists) {
    console.error(`No tenant ${tenantId} — check the id (see the tenants collection).`);
    process.exit(1);
  }
  const customers = demoCustomers();
  const batch = db.batch();
  customers.forEach((c, i) =>
    batch.set(db.collection("customers").doc(`cust-${tenantId}-${i + 1}`), { ...c, tenantId }),
  );
  await batch.commit();
  console.log(`customers: seeded ${customers.length} onto "${tenant.data()!.name}" (${tenantId})`);
}

async function main() {
  const custFlag = process.argv.indexOf("--customers");
  if (custFlag !== -1) {
    const tid = process.argv[custFlag + 1];
    if (!tid) {
      console.error("Usage: npm run seed -- --customers <tenantId>");
      process.exit(1);
    }
    await seedCustomersFor(tid);
    return;
  }
  await seedTenant();
  await seedBookingsCol();
  await seedListingsCol();
  await seedCustomersCol();
  console.log("Seed complete.");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
