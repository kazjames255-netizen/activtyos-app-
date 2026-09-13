// TFC demo bookings for the Amir Coaching freelancer tenant, so the
// (Booking refs are AC-* — NOT TFC-*, which read as the payment scheme.)
// Tax-Free Childcare tab on Reconciliation has something to lay out.
// Idempotent: ids are prefixed `tfcdemo-`; re-running replaces them.
//   npx tsx src/seedTfcDemo.ts          # seed
//   npx tsx src/seedTfcDemo.ts clean    # remove
import { db } from "./firebase";

const TENANT = "VOiiaTnDNd03MLbZaVcM";   // amircoaching@gmail.com (freelancer)
const ns = (s: string) => `tfcdemo-${s}`;
const dayIso = (back: number) => new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10);

// A believable spread: HMRC has settled some (Paid), some are still promised by
// the parent (Awaiting voucher payment), one is part-paid with the balance on
// card — the split-payment case from the Step 4 design.
const ROWS: { child: string; booker: string; listing: string; amount: number; paid: number; card: number; pay: string; ref: string | null; back: number }[] = [
  { child: "Amara Osei", booker: "Grace Osei", listing: "After-School Football Club", amount: 96, paid: 96, card: 0, pay: "Paid", ref: "AOSE41207TFC", back: 24 },
  { child: "Bilal Ahmed", booker: "Nadia Ahmed", listing: "Holiday Multi-Sports Camp", amount: 180, paid: 180, card: 0, pay: "Paid", ref: "BAHM70318TFC", back: 19 },
  { child: "Cora Whitfield", booker: "Sarah Whitfield", listing: "After-School Football Club", amount: 64, paid: 64, card: 0, pay: "Paid", ref: "CWHI22940TFC", back: 15 },
  { child: "Dylan Price", booker: "Hannah Price", listing: "Holiday Multi-Sports Camp", amount: 120, paid: 60, card: 60, pay: "Partially paid", ref: "DPRI55106TFC", back: 11 },
  { child: "Esme Fletcher", booker: "Tom Fletcher", listing: "Gymnastics Stars", amount: 72, paid: 0, card: 0, pay: "Awaiting voucher payment", ref: "EFLE18823TFC", back: 8 },
  { child: "Farid Hussain", booker: "Zara Hussain", listing: "After-School Football Club", amount: 48, paid: 0, card: 0, pay: "Awaiting voucher payment", ref: "FHUS90471TFC", back: 5 },
  { child: "Gracie Bell", booker: "Kate Bell", listing: "Holiday Multi-Sports Camp", amount: 150, paid: 0, card: 0, pay: "Awaiting voucher payment", ref: "Gracie", back: 3 },   // hand-typed junk ref
  { child: "Hugo Nguyen", booker: "Mai Nguyen", listing: "Gymnastics Stars", amount: 90, paid: 0, card: 0, pay: "Awaiting voucher payment", ref: null, back: 2 },              // no ref at all
];

async function clean() {
  const snap = await db.collection("bookings").get();
  const del = snap.docs.filter((d) => d.id.startsWith("tfcdemo-"));
  for (let i = 0; i < del.length; i += 400) { const b = db.batch(); del.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit(); }
  console.log(`bookings: deleted ${del.length} tfcdemo docs`);
}

async function main() {
  await clean();
  if (process.argv[2] === "clean") process.exit(0);
  const batch = db.batch();
  ROWS.forEach((r, i) => {
    const d = dayIso(r.back);
    batch.set(db.collection("bookings").doc(ns(String(i))), {
      ref: `AC-${3100 + i}`, bid: `AC${3100 + i}`, tenantId: TENANT, franchiseId: null,
      listingId: null, blockId: null, childId: null,
      booker: r.booker, email: `${r.booker.split(" ")[0].toLowerCase()}@example.com`, phone: "07700 900000",
      child: r.child, kids: [{ name: r.child }],
      listing: r.listing, pass: "Standard", ticket: "15:30–16:30",
      dates: d, days: [d], sessions: [`${d} · 15:30 – 16:30`],
      status: "Confirmed", pay: r.pay,
      // `method` is what drives the ledger's category tabs.
      method: "Tax-Free Childcare",
      ...(r.ref ? { paymentRef: r.ref } : {}),
      amount: r.amount, amountPaid: r.paid, cardPaid: r.card,
      createdAt: `${d}T10:15:00.000Z`,
      addons: [], answers: [], note: "", recon: null, evid: null, cancel: null,
    }, { merge: true });
  });
  await batch.commit();
  console.log(`Seeded ${ROWS.length} Tax-Free Childcare bookings into ${TENANT}.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
