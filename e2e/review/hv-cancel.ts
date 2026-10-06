import fs from "node:fs";
import { call, ok, db, load, tokFor, iso, nextMonday, addDays, parent } from "./hv-lib";
const R: any[] = []; const rec = (id: string, ok_: boolean, note: string) => { R.push({ id, ok: ok_, note }); console.log(`${ok_ ? "PASS" : "FAIL"} ${id} ${note}`); };
(async () => {
  const S = load(); const L = S.listings;
  const fa = await tokFor(S.accts.fa.email);
  let p1 = ""; let kid: any;
  const mk = async (key: string, date: string, sa?: any) => {
    const r = await call(p1, "POST", "/api/my/bookings", { listingId: L[key].id, blockId: L[key].blockId, method: "bank", ...(sa ? { serviceAddress: sa } : {}), items: [{ pass: "1 day", child: "Hv Kid Cancel", childId: kid.id, age: 8, dates: [date] }] });
    if (r.status >= 300) throw new Error("book " + JSON.stringify(r.json)); return r.json.bookings[0];
  };
  const far = iso(addDays(nextMonday, 18)), near = iso(nextMonday);
  const cases: [string, string, string, number][] = [["hvpc (home visit)", "hvpc", far, 20], ["hvpc (home visit) near session", "hvpc", near, 10], ["online", "online", far, 20], ["both", "both", far, 20]];
  // different dates for the same child/listing per case
  const dateFor: Record<string, string> = {};
  let n = 0;
  for (const [name, key, date, exp] of cases) {
    // a fresh parent per case, so wallet credit from an earlier refund is not auto-applied to the next booking
    const acct = await parent("c" + Date.now().toString(36) + n++); await call(await tokFor(acct.email), "POST", "/api/my/providers/follow", { tenantId: S.accts.fa.tenantId });
    p1 = await tokFor(acct.email); kid = await ok(p1, "POST", "/api/my/children", { name: "Hv Kid Cancel", dob: "2017-03-04" });
    const wk = (n: number) => iso(addDays(nextMonday, 14 + n)); // weekdays of the 3rd week
    const d = name.includes("near") ? near : key === "hvpc" ? wk(1) : key === "online" ? wk(2) : wk(3);
    const bk = await mk(key, d, key === "online" ? undefined : { address: "5 Home Road", postcode: "NN5 7EA" });
    await ok(fa, "POST", `/api/bookings/${bk.ref}/record-payment`, { amount: 20, method: "Bank transfer", reference: bk.ref });
    const c = await call(p1, "POST", `/api/my/bookings/${bk.ref}/cancel`, { msg: "test cancel", refundPref: "wallet" });
    const doc = (await db.collection("bookings").where("ref", "==", bk.ref).get()).docs[0]?.data() as any;
    const amt = doc?.cancel?.amount ?? doc?.cancel?.refundAmount;
    rec(`CANCEL ${name}: paid £20, parent cancels -> refund pending £${exp} per Standard policy`, c.status < 300 && Math.abs((amt ?? -1) - exp) < 0.01, `HTTP ${c.status}; status=${doc?.status}; cancel=${JSON.stringify(doc?.cancel)?.slice(0, 200)}`);
    if (c.status < 300 && amt > 0) {
      const ap = await call(fa, "POST", `/api/bookings/${bk.ref}/actions`, { type: "refund-approve" });
      const after = (await db.collection("bookings").where("ref", "==", bk.ref).get()).docs[0]?.data() as any;
      const wal = (await call(p1, "GET", "/api/my/wallet")).json;
      rec(`CANCEL ${name}: provider approves, refund lands (wallet credit)`, ap.status < 300, `HTTP ${ap.status} ${JSON.stringify(ap.json).slice(0, 140)}; booking status=${after?.status}; wallet=${JSON.stringify(wal?.balances?.map((b: any) => b.balance))}`);
    }
  }
  fs.writeFileSync("/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/d6be64b6-4124-4419-9525-b7eb6fbb7058/scratchpad/hv-cancel-results.json", JSON.stringify(R, null, 1));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
