// Finance reconcile for the live co-testing: every booking on a tenant (or one listing) against its payment records and the dashboard's own
// income helper. Run from the repo root:  server/node_modules/.bin/tsx server/tools/reconcile.ts [listingId]
// Default = Amir Coaching's Standard test camp. Read-only.
import { db } from "../src/firebase";
import { collectedNet } from "../../features/bookings/helpers";

const TENANT = process.env.TENANT_ID ?? "VOiiaTnDNd03MLbZaVcM"; // Amir Coaching
const LISTING = process.argv[2] ?? "0FcHqQHPy8arkS4OdZRe"; // Standard test camp

(async () => {
  const bs = (await db.collection("bookings").where("listingId", "==", LISTING).get()).docs.map((d) => d.data() as Record<string, any>);
  const ps = (await db.collection("payments").where("tenantId", "==", TENANT).get()).docs.map((d) => d.data() as Record<string, any>);
  let inSum = 0, refSum = 0, bad = 0;
  for (const b of bs.sort((a, c) => String(a.ref).localeCompare(String(c.ref)))) {
    const mine = ps.filter((p) => (p.refs ?? []).includes(b.ref));
    const inn = mine.filter((p) => p.type !== "refund" && (p.status === "succeeded" || p.status === "recorded")).reduce((s, p) => s + (p.amount ?? 0), 0);
    const ref = mine.filter((p) => p.type === "refund" && (p.status === "succeeded" || p.status === "recorded")).reduce((s, p) => s + (p.amount ?? 0), 0);
    const net = Math.round((inn - ref) * 100) / 100;
    const helper = collectedNet(b as never);
    const ok = Math.abs(net - helper) < 0.005;
    if (!ok) bad++;
    inSum += inn; refSum += ref;
    console.log(`${b.ref} ${String(b.status).padEnd(9)} ${String(b.pay).padEnd(18)} amt ${String(b.amount).padStart(6)} list ${String(b.listPrice ?? "-").padStart(5)} off ${String(b.discountOff ?? "-").padStart(4)} | in ${inn.toFixed(2).padStart(7)} refunds ${ref.toFixed(2).padStart(6)} net ${net.toFixed(2).padStart(7)} | dashboard ${helper.toFixed(2).padStart(7)} ${ok ? "OK" : "<<< MISMATCH"}`);
  }
  const blocks = (await db.collection("blocks").where("listingId", "==", LISTING).get()).docs.map((d) => d.data() as Record<string, any>);
  const over = blocks.flatMap((b) => Object.entries(b.dayCounts ?? {}).filter(([, n]) => (n as number) > (b.capacity ?? 0)).map(([d, n]) => `${d}: ${n}/${b.capacity}`));
  console.log(`TOTAL in ${inSum.toFixed(2)} refunds ${refSum.toFixed(2)} net ${(inSum - refSum).toFixed(2)} | mismatches ${bad} | days over capacity: ${over.length ? over.join(", ") : "none"}`);
  process.exit(0);
})();
