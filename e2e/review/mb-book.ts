// Mass-bookings QA: the parent books every listing by bank transfer and cash; records what each screen/API says.
import { call, load, save, tokFor, sleep } from "./mb-lib";

const BANK = "Bank transfer", CASH = "Cash on the day";
const wk = (a: string[]) => a;
const CASES: any[] = [
  // key, listing, method, kids, pass, dates, expected total (my own arithmetic from the spec)
  { id: "oneoff-bank-1", l: "oneoff", m: BANK, kids: ["Ava"], pass: "Single session", dates: ["2026-10-28"], exp: 12 },
  { id: "oneoff-cash-2", l: "oneoff", p: "p2", m: CASH, kids: ["Ava", "Ben"], pass: "Single session", dates: ["2026-10-28"], exp: 24 },
  { id: "camp-bank-1", l: "camp", m: BANK, kids: ["Ava"], pass: "Full week", dates: wk(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"]), exp: 150 },
  { id: "camp-cash-2", l: "camp", p: "p2", m: CASH, kids: ["Ava", "Ben"], pass: "Full week", dates: wk(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"]), code: "QAF5OFF", exp: 295 },
  { id: "camp-code-bank-1", l: "camp", m: BANK, kids: ["Ben"], pass: "Full week", dates: wk(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"]), code: "QAF5OFF", exp: 145 },
  { id: "term-bank-1", l: "term", m: BANK, kids: ["Ava"], pass: "Full term", dates: ["2026-11-04", "2026-11-11", "2026-11-18", "2026-11-25", "2026-12-02", "2026-12-09"], exp: 84 },
  { id: "term-cash-2", l: "term", p: "p2", m: CASH, kids: ["Ava", "Ben"], pass: "Single week", dates: ["2026-11-11"], exp: 32 },
  { id: "passes-bank-1", l: "passes", m: BANK, kids: ["Ava"], pass: "3-day pass", dates: ["2026-11-02", "2026-11-03", "2026-11-04"], exp: 54 },
  { id: "passes-cash-2", l: "passes", p: "p2", m: CASH, kids: ["Ava", "Ben"], pass: "10-day pass", dates: ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"], exp: 300 },
  { id: "addons-bank-1", l: "addons", m: BANK, kids: ["Ava"], pass: "Full week", dates: ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"], addons: [{ id: "ao-tshirt", answers: { "q-size": "M" } }, { id: "ao-lunch" }], exp: 172.5 },
  { id: "addons-cash-2", l: "addons", p: "p2", m: CASH, kids: ["Ava", "Ben"], pass: "Single day", dates: ["2026-11-10"], addons: [{ id: "ao-tshirt", answers: { "q-size": "S" } }, { id: "ao-lunch" }], exp: 93 },
  { id: "sibling-bank-1", l: "sibling", m: BANK, kids: ["Ava"], pass: "Full month", dates: ["2026-11-03", "2026-11-10", "2026-11-17", "2026-11-24"], exp: 70 },
  { id: "sibling-cash-2", l: "sibling", p: "p2", m: CASH, kids: ["Ava", "Ben"], pass: "Single week", dates: ["2026-11-03"], exp: 36 },
  { id: "multiday-bank-1", l: "multiday", m: BANK, kids: ["Ava"], pass: "Full week", dates: ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"], exp: 127.5 },
  { id: "multiday-cash-2", l: "multiday", p: "p2", m: CASH, kids: ["Ava", "Ben"], pass: "Full week", dates: ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"], exp: 255 },
  { id: "online-bank-1", l: "online", m: BANK, kids: ["Ava"], pass: "4-session course", dates: ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"], exp: 90 },
  { id: "online-cash-2", l: "online", p: "p2", m: CASH, kids: ["Ava", "Ben"], pass: "Single session", dates: ["2026-11-09"], exp: 50 },
  { id: "home-bank-1", l: "home", m: BANK, kids: ["Ava"], pass: "Single visit", dates: ["2026-11-05"], exp: 40, home: true },
  { id: "home-cash-2", l: "home", p: "p2", m: CASH, kids: ["Ava", "Ben"], pass: "Single visit", dates: ["2026-11-12"], exp: 80, home: true },
];

(async () => {
  const S = load(); S.bookings ??= {};
  const only = process.argv[2];
  const toks: any = { p1: await tokFor(S.accts.parent.email), p2: await tokFor(S.accts.parent2.email) };
  for (const c of CASES) {
    if (only && !c.id.startsWith(only)) continue;
    if (S.bookings[c.id]) continue;
    const L = S.listings[c.l];
    const block = L.blocks.find((b: any) => b.startDate <= c.dates[0] && c.dates[0] <= b.endDate) ?? L.blocks[0];
    const K = c.p === "p2" ? S.kids2 : S.kids;
    const tok = toks[c.p ?? "p1"];
    const items = c.kids.map((k: string) => ({ pass: c.pass, dates: c.dates, child: K[k].name, childId: K[k].id, age: K[k].age, ...(c.addons ? { addons: c.addons } : {}) }));
    const body: any = { listingId: L.id, blockId: block.id, method: c.m, items, ...(c.code ? { discountCode: c.code } : {}), ...(c.home ? { serviceAddress: { address: "5 Home Road, Northampton", postcode: "NN5 7EA" } } : {}), phone: "07700900999" };
    const r = await call(tok, "POST", "/api/my/bookings", body);
    const refs = (r.json?.bookings ?? []).map((b: any) => b.ref);
    const sum = (r.json?.bookings ?? []).reduce((s: number, b: any) => s + (b.amount ?? 0), 0);
    const flag = c.exp === "REFUSED" ? (r.status >= 400 ? "OK-REFUSED" : "BUG-ACCEPTED") : (r.status < 300 && Math.abs((r.json?.total ?? -1) - c.exp) < 0.005 && Math.abs(sum - c.exp) < 0.005 ? "OK" : "MISMATCH");
    console.log(flag.padEnd(12), c.id.padEnd(22), r.status, "exp", c.exp, "total", r.json?.total, "sumBookings", sum, "refs", refs.join(","), r.status >= 400 ? JSON.stringify(r.json).slice(0, 200) : "");
    S.bookings[c.id] = { case: c, status: r.status, resp: r.json, refs, flag };
    save(S);
    await sleep(600);
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
