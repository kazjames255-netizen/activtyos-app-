// Post-fix re-check: an unpaid booking cancelled by the parent must record "no refund" (not "pending").
import { call, load, tokFor, sleep } from "./mb-lib";
(async () => {
  const S = load();
  const t1 = await tokFor(S.accts.parent.email), pt = await tokFor(S.accts.prov.email);
  const L = S.listings.home; const k = S.kids.Ben;
  const block = L.blocks.find((b: any) => b.startDate <= "2026-11-19" && "2026-11-19" <= b.endDate);
  const r = await call(t1, "POST", "/api/my/bookings", { listingId: L.id, blockId: block.id, method: "Cash on the day", items: [{ pass: "Single visit", dates: ["2026-11-19"], child: k.name, childId: k.id, age: k.age }], serviceAddress: { address: "5 Home Road, Northampton", postcode: "NN5 7EA" }, phone: "07700900999" });
  const ref = r.json?.bookings?.[0]?.ref; console.log("booked", r.status, ref, r.json?.total);
  const c = await call(t1, "POST", `/api/my/bookings/${ref}/cancel`, { msg: "QA post-fix cancel" });
  console.log("cancel", c.status, JSON.stringify(c.json?.cancel), c.json?.pay);
  await sleep(3000);
  const bell = (await call(pt, "GET", "/api/notifications")).json.notifications.slice(0, 2); for (const n of bell) console.log("bell:", n.title, "|", n.body);
  process.exit(0);
})();
