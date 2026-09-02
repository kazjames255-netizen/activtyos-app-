// Seed a live availability request for kazj181@gmail.com in the SPORTS DIRECT
// COMPANY tenant, so that staff member sees "your manager has requested your
// availability for <week>" on their My availability page. Idempotent.
//   npx tsx src/seedAvailabilityRequest.ts          # create/refresh the request
//   npx tsx src/seedAvailabilityRequest.ts clean     # remove it
import { db } from "./firebase";

const COMPANY = "x4goY84cslX4mBV4LNtG"; // SPORTS DIRECT COMPANY (kazjames80@gmail.co.uk)
const STAFF_EMAIL = "kazj181@gmail.com";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
function mondayNext(): Date {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  const m = new Date(d);
  m.setDate(d.getDate() - dow + 7); // next week's Monday
  m.setHours(0, 0, 0, 0);
  return m;
}

const WEEKS = 6;
// Real listing/venue/hours pulled from the company's Summer Holiday Camp
// (sessions 09:00–15:00 at Loughton Leisure Centre).
const CAMP = { listingName: "Summer Holiday Camp", location: "Loughton Leisure Centre", address: "Traps Hill, Loughton IG10 1SZ", payRate: 12.5, open: "09:00", close: "15:00", weeks: WEEKS };

async function main() {
  const mon = mondayNext();
  const end = new Date(mon);
  end.setDate(mon.getDate() + WEEKS * 7 - 1); // last day of the 6-week block
  const label = `Summer Holiday Camp · ${WEEKS} weeks`;
  const id = `availreq-${COMPANY}-kazj181-camp-${iso(mon)}`;
  const ref = db.collection("availabilityRequests").doc(id);

  // Remove the earlier single-week seed if present, so there's just the camp one.
  await db.collection("availabilityRequests").doc(`availreq-${COMPANY}-kazj181-${iso(mon)}`).delete().catch(() => {});

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
      window: { kind: "camp", label, from: iso(mon), to: iso(end) },
      // Week 1 Mon–Wed already rostered → locked (they can only request time off).
      camp: { ...CAMP, startDate: iso(mon), assignedDates: [iso(mon), iso(addDays(mon, 1)), iso(addDays(mon, 2))] },
      note: "You've been assigned to this camp — please add the days and hours you can work across the 6 weeks.",
      status: "pending",
      createdAt: new Date().toISOString(),
      createdBy: "kazjames80@gmail.co.uk",
      createdByName: "SPORTS DIRECT COMPANY",
    },
    { merge: true },
  );
  console.log(`Seeded camp availability request ${id} → ${STAFF_EMAIL} · ${CAMP.listingName} @ ${CAMP.location} · ${WEEKS} weeks (${iso(mon)}–${iso(end)}) · ${CAMP.open}–${CAMP.close}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
