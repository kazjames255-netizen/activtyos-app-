// Seed a live availability request for kazj181@gmail.com in the SPORTS DIRECT
// COMPANY tenant, so that staff member sees "your manager has requested your
// availability for <week>" on their My availability page. Idempotent.
//   npx tsx src/seedAvailabilityRequest.ts          # create/refresh the request
//   npx tsx src/seedAvailabilityRequest.ts clean     # remove it
import { db } from "./firebase";

const COMPANY = "x4goY84cslX4mBV4LNtG"; // SPORTS DIRECT COMPANY (kazjames80@gmail.co.uk)
const STAFF_EMAIL = "kazj181@gmail.com";

const iso = (d: Date) => d.toISOString().slice(0, 10);
function mondayNext(): Date {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  const m = new Date(d);
  m.setDate(d.getDate() - dow + 7); // next week's Monday
  m.setHours(0, 0, 0, 0);
  return m;
}

async function main() {
  const mon = mondayNext();
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const label = `week of ${mon.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`;
  const id = `availreq-${COMPANY}-kazj181-${iso(mon)}`;
  const ref = db.collection("availabilityRequests").doc(id);

  if (process.argv[2] === "clean") {
    await ref.delete();
    console.log("Removed availability request", id);
    process.exit(0);
  }

  await ref.set(
    {
      tenantId: COMPANY,
      staffEmail: STAFF_EMAIL,
      staffName: "Kaz James",
      window: { kind: "week", label, from: iso(mon), to: iso(sun) },
      note: "We're building next week's rota — please add the days and hours you can work.",
      status: "pending",
      createdAt: new Date().toISOString(),
      createdBy: "kazjames80@gmail.co.uk",
    },
    { merge: true },
  );
  console.log(`Seeded availability request ${id} → ${STAFF_EMAIL} · ${label} (${iso(mon)}–${iso(sun)})`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
