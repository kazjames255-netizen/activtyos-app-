// Seed Firestore with a demo tenant ("APF Activity Camps" — the first
// provider from the product overview) and its dataset extracted from the
// legacy prototype. Idempotent: skips any collection that already has
// documents unless --force.
//
//   npm run seed            # seed empty collections
//   npm run seed -- --force # wipe + reseed everything

import "dotenv/config";
import { db } from "./firebase";
import { toDoc } from "./lib/bookingDoc";
import { seedBookings } from "../../features/bookings/data";
import type { Booking } from "../../features/bookings/types";

const force = process.argv.includes("--force");

export const DEMO_TENANT_ID = "apf-demo";
const DEMO_TENANT_NAME = "APF Activity Camps";

async function wipe(name: string) {
  const snap = await db.collection(name).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

async function isEmpty(name: string) {
  const snap = await db.collection(name).limit(1).get();
  return snap.empty;
}

async function seedTenant() {
  if (force) await wipe("tenants");
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
  if (force) await wipe("listings");
  else if (!(await isEmpty("listings"))) {
    console.log("listings: not empty, skipping");
    return;
  }
  const listings = [
    {
      name: "Summer Holiday Camp 2027",
      passes: [
        { name: "5-day week pass", price: 200 },
        { name: "4-day pass", price: 160 },
        { name: "1-day pass", price: 40 },
      ],
      blocks: ["Week 1 · 28 Jul – 1 Aug 2027", "Week 2 · 4 – 8 Aug 2027", "Week 3 · 11 – 15 Aug 2027"],
    },
    {
      name: "Easter Football Camp",
      passes: [
        { name: "5-day week pass", price: 200 },
        { name: "4-day pass", price: 160 },
        { name: "1-day pass", price: 40 },
      ],
      blocks: ["Week 1 · 7 – 10 Apr 2027", "Week 2 · 14 – 18 Apr 2027"],
    },
    {
      name: "After-School Dance Club",
      passes: [{ name: "Term pass", price: 72 }],
      blocks: ["Summer term · Tue ×6"],
    },
  ];
  const batch = db.batch();
  listings.forEach((l, i) =>
    batch.set(db.collection("listings").doc(`lst-${i + 1}`), {
      ...l,
      tenantId: DEMO_TENANT_ID,
      tenantName: DEMO_TENANT_NAME,
    }),
  );
  await batch.commit();
  console.log(`listings: seeded ${listings.length} for the demo tenant`);
}

async function seedCustomersCol() {
  if (force) await wipe("customers");
  else if (!(await isEmpty("customers"))) {
    console.log("customers: not empty, skipping");
    return;
  }
  // Derived from the bookings' booker + kids fields.
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
  const batch = db.batch();
  let i = 0;
  for (const c of byEmail.values())
    batch.set(db.collection("customers").doc(`cust-${++i}`), {
      ...c,
      tenantId: DEMO_TENANT_ID,
    });
  await batch.commit();
  console.log(`customers: seeded ${byEmail.size} for the demo tenant`);
}

async function main() {
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
