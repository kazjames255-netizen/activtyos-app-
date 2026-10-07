// Seats: expected children-per-day from the operator's booking list vs the public listing's session counts vs the dashboard.
import { call, load, tokFor } from "./mb-lib";
(async () => {
  const S = load();
  const pt = await tokFor(S.accts.prov.email);
  const bks: any[] = (await call(pt, "GET", "/api/bookings")).json;
  const dash: any = (await call(pt, "GET", "/api/dashboard")).json;
  let bad = 0;
  for (const [key, L] of Object.entries<any>(S.listings)) {
    const pub = (await call(null, "GET", `/api/listings/${L.id}`)).json;
    const exp: Record<string, number> = {};
    for (const b of bks.filter((x) => x.listingId === L.id && x.status !== "Cancelled" && x.status !== "Declined")) {
      const kids = b.kids?.length ? b.kids : [{ name: b.child, days: b.days }];
      for (const k of kids) for (const d of k.cancelledDays?.length ? (k.days ?? b.days ?? []).filter((x: string) => !k.cancelledDays.includes(x)) : (k.days ?? b.days ?? [])) exp[d] = (exp[d] ?? 0) + 1;
    }
    const got: Record<string, number> = {};
    for (const bl of pub.blocks) for (const s of bl.sessions ?? []) got[s.date] = s.bookedCount;
    const dates = [...new Set([...Object.keys(exp), ...Object.keys(got)])].sort();
    const diffs = dates.filter((d) => (exp[d] ?? 0) !== (got[d] ?? 0));
    const dl = dash.byListing.find((x: any) => x.listingId === L.id);
    const expTotal = Object.values(exp).reduce((a, b) => a + b, 0);
    console.log(key.padEnd(9), "expected child-days", expTotal, "| public sum", Object.values(got).reduce((a, b) => a + b, 0), "| dashboard placesTaken", dl?.placesTaken, diffs.length ? "DIFF " + diffs.map((d) => `${d}: exp ${exp[d] ?? 0} got ${got[d] ?? 0}`).join("; ") : "ok");
    if (diffs.length || dl?.placesTaken !== expTotal) bad++;
  }
  console.log("listings with a difference:", bad);
  process.exit(0);
})();
