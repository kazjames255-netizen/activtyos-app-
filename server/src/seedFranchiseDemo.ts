// Demo data for the APF ACTIVITY CAMPS franchise (support@apfactivitycamps.com)
// so its dashboard — and the "On site now" card in particular — has something
// to show.
//
// Why a separate script from seedRegisterDemo: that one seeds the same tenant
// but stamps NO franchiseId, and a franchise only ever sees listings where
// `listings.franchiseId === its own id` (server/src/lib/franchiseScope.ts). Its
// data therefore belongs to head office and is invisible to this login.
//
// The card joins children (register — server, seeded below) to STAFF, which do
// not live in Firestore at all: the clock store is localStorage
// (`aos.timeclock.v1`) and auto-seeds demo staff on first read, keyed to a
// VENUE name (`op`) — Aisha Rahman and Tom Lewis are both on "Milton Keynes".
// So the venue below is deliberately named to match: listing.venueId → the
// library's venue name → the clock record's `op` is the whole join, and if the
// name doesn't match, staff fall into "Elsewhere / unassigned" instead.
//
// Idempotent: every doc id is prefixed `frdemo-`, writes are set(merge), and a
// `clean` run removes them all. Only touches this one franchise's data.
//   npx tsx src/seedFranchiseDemo.ts          # seed (cleans stale docs first)
//   npx tsx src/seedFranchiseDemo.ts clean    # remove every frdemo-* doc
import { db } from "./firebase";

const TENANT = "x4goY84cslX4mBV4LNtG";                  // SPORTS DIRECT COMPANY (head office)
const FRANCHISE = "rCOAaqxJ6Ed5ULet7ftAmkiOvNC3";       // APF ACTIVITY CAMPS
const LIB_DOC = `${TENANT}__fr__${FRANCHISE}`;          // franchise libraries are namespaced

const ns = (s: string) => `frdemo-${s}`;
const LISTING = ns("listing-camp");
const VENUE_ID = ns("venue-apf");
const VENUE_NAME = "Milton Keynes";                     // MUST match a DEMO_STAFF `op` (features/learning/credentials.tsx)
const BLOCKS = {
  am: { id: ns("block-am"), name: "Morning camp", start: "08:30", end: "12:30" },
  pm: { id: ns("block-pm"), name: "Afternoon camp", start: "13:00", end: "16:30" },
};
// Past bookings hang off their OWN block. The register counts a session's
// expected heads by blockId, not by date, so parking history on the AM block
// made every past booking a phantom no-show on today's register (17 expected
// for 7 children).
const PAST_BLOCK = ns("block-past");

const today = new Date().toISOString().slice(0, 10);
const at = (hhmm: string) => `${today}T${hhmm}:00.000Z`;
const dayIso = (back: number) => new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10);

type Att = { kind: "in" | "absent" | "collected" | "none"; in?: string; out?: string; by?: string };
interface Kid { first: string; last: string; age: number; dob: string; booker: string; block: "am" | "pm"; att: Att; flags?: Record<string, string> }

// A believable mix: most in, one still to arrive, one off sick, one already
// collected — so every state on the card is exercised rather than a wall of green.
const KIDS: Kid[] = [
  { first: "Ruby", last: "Fletcher", age: 7, dob: "2019-02-11", booker: "Hannah Fletcher", block: "am", att: { kind: "in", in: "08:33" }, flags: { allergies: "Peanuts — EpiPen in her bag" } },
  { first: "Theo", last: "Okafor", age: 9, dob: "2017-05-09", booker: "Ada Okafor", block: "am", att: { kind: "in", in: "08:36" } },
  { first: "Maisie", last: "Hughes", age: 6, dob: "2020-04-02", booker: "Megan Hughes", block: "am", att: { kind: "in", in: "08:41" }, flags: { medical: "Asthma — blue inhaler with staff" } },
  { first: "Arlo", last: "Bennett", age: 8, dob: "2018-08-27", booker: "Chris Bennett", block: "am", att: { kind: "in", in: "08:44" } },
  { first: "Nina", last: "Kaur", age: 10, dob: "2016-01-30", booker: "Simran Kaur", block: "am", att: { kind: "none" } },
  { first: "Felix", last: "Moreau", age: 7, dob: "2019-11-15", booker: "Claire Moreau", block: "am", att: { kind: "absent" } },
  { first: "Iris", last: "Campbell", age: 9, dob: "2017-03-08", booker: "Fiona Campbell", block: "am", att: { kind: "collected", in: "08:30", out: "11:55", by: "Fiona Campbell" } },
  { first: "Rowan", last: "Doyle", age: 8, dob: "2018-06-19", booker: "Paul Doyle", block: "pm", att: { kind: "in", in: "13:04" } },
  { first: "Lena", last: "Novak", age: 6, dob: "2020-10-23", booker: "Petra Novak", block: "pm", att: { kind: "in", in: "13:07" }, flags: { dietary: "Vegetarian" } },
  { first: "Kai", last: "Robinson", age: 9, dob: "2017-09-05", booker: "Dean Robinson", block: "pm", att: { kind: "in", in: "13:02" } },
  { first: "Sana", last: "Iqbal", age: 7, dob: "2019-07-12", booker: "Yasmin Iqbal", block: "pm", att: { kind: "none" } },
  { first: "Otis", last: "Wallace", age: 10, dob: "2016-12-14", booker: "Grant Wallace", block: "pm", att: { kind: "in", in: "13:11" } },
];

async function seed() {
  // ── The venue. The card attributes staff to a listing via listing.venueId →
  //    the library's venue NAME → the clock record's `op`, so this name has to
  //    match what the browser snippet writes. Read-modify-write rather than a
  //    blind set: this library is the franchise's real one.
  const libRef = db.collection("libraries").doc(LIB_DOC);
  const libSnap = await libRef.get();
  const lib = libSnap.exists ? libSnap.data()! : {};
  const venues = ((lib.venues as { id: string; name: string }[] | undefined) ?? []).slice();
  if (!venues.some((v) => v.id === VENUE_ID)) {
    venues.push({ id: VENUE_ID, name: VENUE_NAME, address: "Unit 4, Kingsway", city: "Milton Keynes" } as never);
  }
  await libRef.set({ ...lib, tenantId: TENANT, franchiseId: FRANCHISE, venues }, { merge: true });

  const batch = db.batch();

  // ── The listing. franchiseId is what makes every read below visible to this
  //    account and invisible to the other franchises.
  batch.set(db.collection("listings").doc(LISTING), {
    tenantId: TENANT, franchiseId: FRANCHISE, venueId: VENUE_ID,
    name: "APF Holiday Camp", title: "APF Holiday Camp",
    passes: [{ name: "Morning", price: 24 }, { name: "Afternoon", price: 24 }],
    status: "live", visibility: "public", maxAttendees: "40", capacityScope: "listing",
    days: [1, 2, 3, 4, 5], images: [], gallery: [], categoryIds: [], addonIds: [], staffIds: [], sections: [], send: [],
  }, { merge: true });

  for (const key of ["am", "pm"] as const) {
    const b = BLOCKS[key];
    const n = KIDS.filter((k) => k.block === key).length;
    batch.set(db.collection("blocks").doc(b.id), {
      tenantId: TENANT, franchiseId: FRANCHISE, listingId: LISTING, name: b.name,
      auto: true, open: true, capacity: 20, capacityScope: "listing",
      startDate: today, endDate: today, bookedCount: n, dayCounts: { [today]: n },
      sessions: [{ date: today, start: b.start, end: b.end }],
    }, { merge: true });
  }

  batch.set(db.collection("blocks").doc(PAST_BLOCK), {
    tenantId: TENANT, franchiseId: FRANCHISE, listingId: LISTING, name: "Earlier camps",
    auto: true, open: false, capacity: 20, capacityScope: "listing",
    startDate: dayIso(35), endDate: dayIso(3), bookedCount: 10,
    sessions: [3, 7, 10, 14, 18, 21, 25, 28, 31, 35].map((b) => ({ date: dayIso(b), start: "08:30", end: "12:30" })),
  }, { merge: true });

  // ── Children, today's bookings, and the register entry each one implies.
  const entries: Record<string, Record<string, unknown>> = { [BLOCKS.am.id]: {}, [BLOCKS.pm.id]: {} };
  KIDS.forEach((k, i) => {
    const name = `${k.first} ${k.last}`;
    const ref = `APF-${2400 + i}`;
    const blk = BLOCKS[k.block];
    batch.set(db.collection("children").doc(ns(`child-${i}`)), {
      tenantId: TENANT, franchiseId: FRANCHISE, name, first: k.first, last: k.last, dob: k.dob,
      photoConsent: true, emergencyName: k.booker, emergencyPhone: "07700 900000",
      collectionPassword: "APFDEMO", ...(k.flags ?? {}),
    }, { merge: true });
    batch.set(db.collection("bookings").doc(ns(`booking-${i}`)), {
      ref, bid: `APF${2400 + i}`, tenantId: TENANT, franchiseId: FRANCHISE,
      blockId: blk.id, listingId: LISTING, childId: ns(`child-${i}`),
      booker: k.booker, email: `${k.booker.split(" ")[0].toLowerCase()}@example.com`, phone: "07700 900000",
      child: name, age: k.age, dob: k.dob, kids: [{ name, age: k.age, dob: k.dob }],
      listing: "APF Holiday Camp", pass: k.block === "am" ? "Morning" : "Afternoon",
      ticket: `${blk.start}–${blk.end}`, dates: today, sessions: [`${today} · ${blk.start} – ${blk.end}`],
      status: "Confirmed", pay: "Paid", method: "Card", amount: 24, amountPaid: 24,
      createdAt: `${dayIso(2)}T09:15:00.000Z`,
      addons: [], answers: [], note: "", recon: null, evid: null, cancel: null,
    }, { merge: true });

    const by = "Priya Shah", stamp = at("08:20");
    if (k.att.kind === "in") entries[blk.id][ref] = { status: "in", inAt: at(k.att.in!), collectedAt: null, collectedBy: null, by, at: stamp };
    else if (k.att.kind === "absent") entries[blk.id][ref] = { status: "absent", inAt: null, collectedAt: null, collectedBy: null, reason: "Off sick", by, at: stamp };
    else if (k.att.kind === "collected") entries[blk.id][ref] = { status: "in", inAt: at(k.att.in!), collectedAt: at(k.att.out!), collectedBy: k.att.by ?? null, by, at: stamp };
    // "none" writes nothing — that's what "not arrived yet" IS.
  });

  for (const key of ["am", "pm"] as const) {
    const b = BLOCKS[key];
    batch.set(db.collection("registers").doc(`${b.id}_${today}`), {
      tenantId: TENANT, franchiseId: FRANCHISE, listingId: LISTING, blockId: b.id, date: today,
      entries: entries[b.id], takenBy: { name: "Priya Shah", at: at("08:20") },
    }, { merge: true });
  }

  // ── A few weeks of past bookings so the dashboard's trend charts and money
  //    figures aren't flat lines under today's twelve.
  const HISTORY = [3, 7, 10, 14, 18, 21, 25, 28, 31, 35];
  HISTORY.forEach((back, i) => {
    const d = dayIso(back);
    batch.set(db.collection("bookings").doc(ns(`hist-${i}`)), {
      ref: `APF-${2300 + i}`, bid: `APFH${2300 + i}`, tenantId: TENANT, franchiseId: FRANCHISE,
      blockId: PAST_BLOCK, listingId: LISTING, childId: null,
      booker: ["Hannah Fletcher", "Ada Okafor", "Simran Kaur", "Paul Doyle", "Yasmin Iqbal"][i % 5],
      email: "parent@example.com", phone: "07700 900000",
      child: ["Ruby Fletcher", "Theo Okafor", "Nina Kaur", "Rowan Doyle", "Sana Iqbal"][i % 5],
      listing: "APF Holiday Camp", pass: "Morning", ticket: "08:30–12:30",
      dates: d, sessions: [`${d} · 08:30 – 12:30`],
      status: "Confirmed", pay: i % 4 === 0 ? "Unpaid" : "Paid", method: "Card",
      amount: 24, amountPaid: i % 4 === 0 ? 0 : 24, createdAt: `${d}T10:05:00.000Z`,
      addons: [], answers: [], note: "", recon: null, evid: null, cancel: null,
    }, { merge: true });
  });

  // ── Childcare payments, for the Reconciliation ledger ────────────────────
  // These are what the childcare roll-up and the TFC work are about: money the
  // family pays OUTSIDE the platform (HMRC Tax-Free Childcare or a voucher
  // scheme) that we then have to match in the bank. `method` drives the ledger's
  // category tabs; "Awaiting voucher payment" + amountPaid 0 = unreconciled.
  // One row deliberately carries a junk reference and one carries none at all —
  // parents type these by hand and get them wrong, and the UI has to cope.
  const CHILDCARE: { name: string; booker: string; scheme: string; method: string; amount: number; paid: number; pay: string; ref: string | null; back: number }[] = [
    { name: "Ruby Fletcher", booker: "Hannah Fletcher", scheme: "", method: "Tax-Free Childcare", amount: 96, paid: 96, pay: "Paid", ref: "RFLE29104TFC", back: 21 },
    { name: "Theo Okafor", booker: "Ada Okafor", scheme: "", method: "Tax-Free Childcare", amount: 224, paid: 224, pay: "Paid", ref: "TOKA14387TFC", back: 18 },
    { name: "Nina Kaur", booker: "Simran Kaur", scheme: "", method: "Tax-Free Childcare", amount: 72, paid: 0, pay: "Awaiting voucher payment", ref: "NKAU55021TFC", back: 9 },
    { name: "Rowan Doyle", booker: "Paul Doyle", scheme: "", method: "Tax-Free Childcare", amount: 48, paid: 0, pay: "Awaiting voucher payment", ref: "Rowan", back: 6 },
    { name: "Sana Iqbal", booker: "Yasmin Iqbal", scheme: "", method: "Tax-Free Childcare", amount: 120, paid: 0, pay: "Awaiting voucher payment", ref: null, back: 4 },
    { name: "Otis Wallace", booker: "Grant Wallace", scheme: "Edenred", method: "Childcare voucher", amount: 60, paid: 60, pay: "Paid", ref: "EDN-88213", back: 27 },
    { name: "Lena Novak", booker: "Petra Novak", scheme: "Fideliti", method: "Childcare voucher", amount: 84, paid: 0, pay: "Awaiting voucher payment", ref: "FID-40192", back: 11 },
    { name: "Arlo Bennett", booker: "Chris Bennett", scheme: "Care-4", method: "Childcare voucher", amount: 36, paid: 0, pay: "Awaiting voucher payment", ref: "C4-77310", back: 3 },
  ];
  CHILDCARE.forEach((c, i) => {
    const d = dayIso(c.back);
    batch.set(db.collection("bookings").doc(ns(`cc-${i}`)), {
      ref: `APF-${2500 + i}`, bid: `APFC${2500 + i}`, tenantId: TENANT, franchiseId: FRANCHISE,
      blockId: PAST_BLOCK, listingId: LISTING, childId: null,
      booker: c.booker, email: `${c.booker.split(" ")[0].toLowerCase()}@example.com`, phone: "07700 900000",
      child: c.name, kids: [{ name: c.name }],
      listing: "APF Holiday Camp", pass: "Morning", ticket: "08:30–12:30",
      dates: d, days: [d], sessions: [`${d} · 08:30 – 12:30`],
      status: "Confirmed", pay: c.pay, method: c.method,
      ...(c.scheme ? { voucherScheme: c.scheme, voucherReceiveBy: dayIso(c.back - 28) } : {}),
      ...(c.ref ? { paymentRef: c.ref } : {}),
      amount: c.amount, amountPaid: c.paid, createdAt: `${d}T09:30:00.000Z`,
      addons: [], answers: [], note: "", recon: null, evid: null, cancel: null,
    }, { merge: true });
  });

  await batch.commit();
  console.log(`Seeded ${KIDS.length} children on ${today} (AM/PM) + ${HISTORY.length} past + ${CHILDCARE.length} childcare bookings for APF ACTIVITY CAMPS.`);
}

async function clean() {
  for (const coll of ["listings", "blocks", "bookings", "children", "registers"]) {
    const snap = await db.collection(coll).get();
    const del = snap.docs.filter((d) => d.id.startsWith("frdemo-"));
    for (let i = 0; i < del.length; i += 400) {
      const b = db.batch(); del.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit();
    }
    console.log(`  ${coll}: deleted ${del.length} frdemo docs`);
  }
  // The venue lives inside the franchise's real library doc, so pull just ours
  // out rather than deleting the document.
  const libRef = db.collection("libraries").doc(LIB_DOC);
  const snap = await libRef.get();
  if (snap.exists) {
    const venues = ((snap.data()!.venues as { id: string }[] | undefined) ?? []).filter((v) => v.id !== VENUE_ID);
    await libRef.set({ venues }, { merge: true });
    console.log("  libraries: removed the frdemo venue");
  }
}

async function main() {
  if (process.argv[2] === "clean") { console.log("Cleaning frdemo data…"); await clean(); process.exit(0); }
  console.log("Cleaning any stale frdemo docs first…"); await clean();
  await seed();
  console.log(`
Open the franchise dashboard as support@apfactivitycamps.com. "On site now"
should show the children above, with Aisha Rahman (in) and Tom Lewis (on break)
attributed to the camp — they come from the browser's own clock store, which
seeds itself and keys on the venue name "${VENUE_NAME}".`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
