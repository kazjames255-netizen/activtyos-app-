// Seed Firestore with the dataset extracted from the legacy prototype.
// Idempotent: skips any collection that already has documents unless --force.
//
//   npm run seed            # seed empty collections
//   npm run seed -- --force # wipe + reseed everything

import "dotenv/config";
import { db } from "./firebase";
import { toDoc } from "./lib/bookingDoc";
import { seedBookings } from "../../features/bookings/data";
import type { Booking, BookingPortal } from "../../features/bookings/types";

const force = process.argv.includes("--force");

// The legacy prototype shares ONE bookings dataset across portals, so seed the
// same records into each portal's scope (admin keeps working, freelancer gets
// real data).
const PORTALS: BookingPortal[] = ["admin", "fl"];

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

async function seedBookingsCol() {
  if (force) await wipe("bookings");
  else if (!(await isEmpty("bookings"))) {
    console.log("bookings: not empty, skipping (use --force to reseed)");
    return;
  }
  const batch = db.batch();
  for (const portal of PORTALS) {
    for (const b of seedBookings) {
      const withPortal: Booking = { ...JSON.parse(JSON.stringify(b)), portal };
      batch.set(db.collection("bookings").doc(`${portal}_${b.ref}`), toDoc(withPortal));
    }
  }
  await batch.commit();
  console.log(`bookings: seeded ${seedBookings.length} records × ${PORTALS.length} portals`);
}

async function seedListingsCol() {
  if (force) await wipe("listings");
  else if (!(await isEmpty("listings"))) {
    console.log("listings: not empty, skipping");
    return;
  }
  // Names + passes as used by the take-booking form today
  // (features/bookings/TakeBookingModal.tsx).
  const listings = [
    {
      name: "Summer Holiday Camp 2027",
      passes: ["5-day week pass", "4-day pass", "1-day pass"],
      blocks: ["Week 1 · 28 Jul – 1 Aug 2027", "Week 2 · 4 – 8 Aug 2027", "Week 3 · 11 – 15 Aug 2027"],
    },
    {
      name: "Easter Football Camp",
      passes: ["5-day week pass", "4-day pass", "1-day pass"],
      blocks: ["Week 1 · 7 – 10 Apr 2027", "Week 2 · 14 – 18 Apr 2027"],
    },
    {
      name: "After-School Dance Club",
      passes: ["Term pass"],
      blocks: ["Summer term · Tue ×6"],
    },
  ];
  const batch = db.batch();
  listings.forEach((l, i) => batch.set(db.collection("listings").doc(`lst-${i + 1}`), l));
  await batch.commit();
  console.log(`listings: seeded ${listings.length}`);
}

async function seedCustomersCol() {
  if (force) await wipe("customers");
  else if (!(await isEmpty("customers"))) {
    console.log("customers: not empty, skipping");
    return;
  }
  // Derived from the bookings' booker + kids fields (the legacy prototype has
  // no separate freelancer customer seed).
  const byEmail = new Map<string, { name: string; email: string; phone: string; children: { name: string; age?: number; dob?: string }[] }>();
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
    batch.set(db.collection("customers").doc(`cust-${++i}`), c);
  await batch.commit();
  console.log(`customers: seeded ${byEmail.size}`);
}

async function main() {
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
