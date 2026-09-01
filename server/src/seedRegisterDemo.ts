// Seed a LIVE "today" register into real tenant(s) so the register + Photos view
// + staff attendance show real data when logged in. Idempotent — all doc ids are
// prefixed `regdemo-<tenantId>-` so tenants never collide, and set(merge) is
// re-runnable. Only touches the named tenants; safe to re-run.
//   npx tsx src/seedRegisterDemo.ts                 # both Kaz accounts
//   npx tsx src/seedRegisterDemo.ts <tenantId>      # a specific tenant
//   npx tsx src/seedRegisterDemo.ts clean           # remove ALL regdemo docs
import { db } from "./firebase";

const COMPANY = "x4goY84cslX4mBV4LNtG"; // SPORTS DIRECT COMPANY (kazjames80@gmail.co.uk)
const FREELANCER = "j2J95nc7F7xcLcrYkX1B"; // Kaz james freelancer (kazjames80@gmail.com)
const arg = process.argv[2];
const TENANTS = !arg || arg === "clean" ? [COMPANY, FREELANCER] : [arg];

const today = new Date().toISOString().slice(0, 10);
const at = (hhmm: string) => `${today}T${hhmm}:00.000Z`;

type Flags = { allergies?: string; medical?: string; dietary?: string; send?: string; sendPlanName?: string; careNotes?: string; likes?: string; dislikes?: string };
type Att = { kind: "in" | "absent" | "collected" | "none"; in?: string; out?: string; by?: string };
interface Kid { first: string; last: string; age: number; dob: string; booker: string; block: "am" | "pm"; flags: Flags; att: Att }

const KIDS: Kid[] = [
  { first: "Ava", last: "Thompson", age: 7, dob: "2019-03-14", booker: "Sarah Thompson", block: "am", flags: { allergies: "Peanuts — EpiPen in her bag", likes: "Drawing and anything with glitter", dislikes: "Loud hand dryers" }, att: { kind: "in", in: "08:31" } },
  { first: "Noah", last: "Green", age: 9, dob: "2017-06-02", booker: "Dan Green", block: "am", flags: { send: "Autism (ASD) — uses a visual timetable, needs a quiet space to regulate and warnings before transitions.", sendPlanName: "ASD support plan", careNotes: "Green card system for a break. Sensory box kept in the office.", likes: "Lego, football stickers", dislikes: "Being rushed between activities" }, att: { kind: "in", in: "08:45" } },
  { first: "Leo", last: "Brooks", age: 8, dob: "2018-01-20", booker: "Marco Brooks", block: "am", flags: { send: "Speech, language & communication (SLCN) — give processing time, use short clear instructions and visual cues.", sendPlanName: "SALT support plan", dietary: "Halal", allergies: "Dairy", likes: "Football — will play all day", dislikes: "Sitting still for long" }, att: { kind: "in", in: "08:52" } },
  { first: "Mia", last: "Patel", age: 6, dob: "2020-09-11", booker: "Raj Patel", block: "am", flags: { send: "ADHD — needs regular movement breaks and a clear, predictable structure to the session.", sendPlanName: "ADHD support plan", medical: "Asthma — blue inhaler kept with staff", likes: "Singing, dressing up", dislikes: "Getting her hands messy" }, att: { kind: "none" } },
  { first: "Sofia", last: "Rossi", age: 10, dob: "2016-05-30", booker: "Marco Rossi", block: "am", flags: { send: "Dyslexia & slower processing — allow extra time, avoid reading aloud on the spot, pair with a buddy.", sendPlanName: "Individual learning plan", medical: "Type 1 diabetes", careNotes: "Individual healthcare plan on file", likes: "Reading in a quiet corner", dislikes: "Big noisy games" }, att: { kind: "absent" } },
  { first: "Jack", last: "Wood", age: 7, dob: "2019-08-08", booker: "Emma Wood", block: "am", flags: { likes: "Building dens", dislikes: "Losing at anything" }, att: { kind: "in", in: "08:35" } },
  { first: "Ella", last: "Chen", age: 9, dob: "2017-11-03", booker: "Wei Chen", block: "am", flags: { dietary: "Vegetarian", likes: "Arts and crafts, helping tidy", dislikes: "Dogs" }, att: { kind: "collected", in: "08:40", out: "12:31", by: "Wei Chen" } },
  { first: "Harry", last: "Singh", age: 8, dob: "2018-02-17", booker: "Amrit Singh", block: "pm", flags: { likes: "Basketball, being picked first", dislikes: "Changing plans last minute" }, att: { kind: "in", in: "13:05" } },
  { first: "Grace", last: "Adeyemi", age: 7, dob: "2019-04-22", booker: "Tola Adeyemi", block: "pm", flags: { allergies: "Tree nuts", likes: "Dancing and music", dislikes: "Cold water" }, att: { kind: "in", in: "13:02" } },
  { first: "Oscar", last: "Bell", age: 6, dob: "2020-07-19", booker: "Kate Bell", block: "pm", flags: { likes: "Diggers and anything with wheels", dislikes: "Having his face wiped" }, att: { kind: "collected", in: "13:01", out: "15:58", by: "Kate Bell" } },
  { first: "Isla", last: "Murphy", age: 10, dob: "2016-12-01", booker: "Ciara Murphy", block: "pm", flags: { send: "Epilepsy with additional SEND — 1:1 support at transitions and near water, follow the seizure care plan.", sendPlanName: "Health & SEND care plan", medical: "Epilepsy — care plan with staff", likes: "Animals — knows every fact", dislikes: "Sudden loud noises" }, att: { kind: "absent" } },
  { first: "Charlie", last: "Hughes", age: 8, dob: "2018-10-05", booker: "Megan Hughes", block: "pm", flags: { likes: "Cars, racing games", dislikes: "Sharing new toys" }, att: { kind: "none" } },
];

async function seedTenant(tid: string) {
  const tenant = (await db.collection("tenants").doc(tid).get()).data() as { name?: string } | undefined;
  if (!tenant) { console.log(`  ${tid}: tenant missing, skip`); return; }
  const ns = (s: string) => `regdemo-${tid}-${s}`;
  const listingId = ns("listing");
  const blocks = {
    am: { id: ns("am"), name: "Multi-Sports · Morning", start: "08:30", end: "12:30" },
    pm: { id: ns("pm"), name: "Multi-Sports · Afternoon", start: "13:00", end: "16:00" },
  };
  const batch = db.batch();

  batch.set(db.collection("listings").doc(listingId), {
    tenantId: tid, tenantName: tenant.name ?? "", name: "Holiday Multi-Sports Camp", passes: [{ name: "Morning", price: 22 }, { name: "Afternoon", price: 22 }],
    status: "live", visibility: "public", maxAttendees: "60", capacityScope: "listing", days: [1, 2, 3, 4, 5], images: [], gallery: [], categoryIds: [], addonIds: [], staffIds: [], sections: [], send: [],
  }, { merge: true });

  for (const b of Object.values(blocks)) {
    const n = KIDS.filter((k) => k.block === (b === blocks.am ? "am" : "pm")).length;
    batch.set(db.collection("blocks").doc(b.id), {
      tenantId: tid, listingId, name: b.name, auto: true, open: true, capacity: 30, capacityScope: "listing",
      startDate: today, endDate: today, bookedCount: n, dayCounts: { [today]: n },
      sessions: [{ date: today, start: b.start, end: b.end }],
    }, { merge: true });
  }

  const entriesByBlock: Record<string, Record<string, unknown>> = { [blocks.am.id]: {}, [blocks.pm.id]: {} };
  KIDS.forEach((k, i) => {
    const childId = ns(`c${i}`);
    const ref = `RD-${1000 + i}`;
    const name = `${k.first} ${k.last}`;
    const blk = blocks[k.block];
    batch.set(db.collection("children").doc(childId), {
      tenantId: tid, name, first: k.first, last: k.last, dob: k.dob, photoConsent: true,
      emergencyName: k.booker, emergencyPhone: "07700 900000", collectionPassword: "SUNSHINE", ...k.flags,
    }, { merge: true });
    batch.set(db.collection("bookings").doc(ns(`b${i}`)), {
      ref, bid: `RD${1000 + i}`, tenantId: tid, blockId: blk.id, listingId, childId,
      booker: k.booker, email: `${k.booker.split(" ")[0].toLowerCase()}@example.com`, phone: "07700 900000",
      child: name, age: k.age, dob: k.dob, kids: [{ name, age: k.age, dob: k.dob }],
      listing: "Holiday Multi-Sports Camp", pass: k.block === "am" ? "Morning" : "Afternoon", ticket: `${blk.start}–${blk.end}`,
      dates: today, sessions: [`${today} · ${blk.start} – ${blk.end}`], status: "Confirmed", pay: "Paid", method: "Card", amount: 22,
      addons: [], answers: [], note: "", recon: null, evid: null, cancel: null,
    }, { merge: true });
    const by = "Tom Reilly", stamp = at("08:20");
    if (k.att.kind === "in") entriesByBlock[blk.id][ref] = { status: "in", inAt: at(k.att.in!), collectedAt: null, collectedBy: null, by, at: stamp };
    else if (k.att.kind === "absent") entriesByBlock[blk.id][ref] = { status: "absent", inAt: null, collectedAt: null, collectedBy: null, reason: "Off sick", by, at: stamp };
    else if (k.att.kind === "collected") entriesByBlock[blk.id][ref] = { status: "in", inAt: at(k.att.in!), collectedAt: at(k.att.out!), collectedBy: k.att.by ?? null, by, at: stamp };
  });

  for (const b of Object.values(blocks)) {
    batch.set(db.collection("registers").doc(`${b.id}_${today}`), {
      tenantId: tid, listingId, blockId: b.id, date: today, entries: entriesByBlock[b.id], takenBy: { name: "Tom Reilly", at: at("08:20") },
    }, { merge: true });
  }

  await batch.commit();
  console.log(`  ${tid} (${tenant.name}): seeded ${KIDS.length} children on ${today} across AM/PM.`);
}

// Remove every regdemo-* doc across all collections (namespaced + legacy shared ids).
async function clean() {
  for (const coll of ["listings", "blocks", "bookings", "children", "registers"]) {
    const snap = await db.collection(coll).get();
    const del = snap.docs.filter((d) => d.id.startsWith("regdemo-") || d.id.startsWith("regdemo_"));
    for (let i = 0; i < del.length; i += 400) { const b = db.batch(); del.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit(); }
    console.log(`  ${coll}: deleted ${del.length} regdemo docs`);
  }
}

async function main() {
  if (arg === "clean") { console.log("Cleaning regdemo data…"); await clean(); process.exit(0); }
  console.log("Cleaning any stale regdemo docs first…"); await clean();
  console.log(`Seeding register demo for ${today} →`, TENANTS.join(", "));
  for (const tid of TENANTS) await seedTenant(tid);
  console.log("Done. Open the Register (today) — List or Photos view.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
