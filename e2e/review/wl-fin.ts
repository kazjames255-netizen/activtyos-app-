import * as L from "./wl-lib";
import { db } from "../../server/src/firebase";
import { reconcileBooking } from "../../server/src/lib/reconcileMath";
(async () => {
  const tid = L.A.pv.tenantId!;
  const bks = (await db.collection("bookings").where("tenantId", "==", tid).get()).docs.map((d) => d.data() as Record<string, any>);
  const ps = (await db.collection("payments").where("tenantId", "==", tid).get()).docs.map((d) => d.data() as Record<string, any>);
  let bad = 0, inn = 0; const byStatus: Record<string, number> = {};
  for (const b of bks) { byStatus[b.status] = (byStatus[b.status] ?? 0) + 1; const r = reconcileBooking(b, ps); if (!r.ok) { bad++; console.log("MISMATCH", b.ref, b.status, JSON.stringify(r)); } inn += r.inn; if (["Waitlisted", "Offered"].includes(b.status) && (r.inn !== 0 || (b.amountPaid ?? 0) > 0)) { bad++; console.log("MONEY ON QUEUED BOOKING", b.ref); } }
  const blocks = (await db.collection("blocks").where("tenantId", "==", tid).get()).docs;
  let drift = 0, checked = 0;
  for (const bd of blocks) {
    const b = bd.data() as any; const live = bks.filter((x) => x.blockId === bd.id && ["Confirmed", "Approval needed", "Offered"].includes(x.status));
    if (!live.length && !Object.keys(b.dayCounts ?? {}).length) continue; checked++;
    const per: Record<string, number> = {};
    for (const x of live) for (const d of x.days ?? []) per[d] = (per[d] ?? 0) + (x.seats ?? 1);
    for (const d of new Set([...Object.keys(per), ...Object.keys(b.dayCounts ?? {})])) { const want = per[d] ?? 0, have = (b.dayCounts ?? {})[d] ?? 0; if (want !== have) { drift++; console.log(`DRIFT block ${bd.id} ${d}: counts ${have} vs live bookings ${want} (listing ${b.listingId})`); } if (have > b.capacity) console.log(`OVER ${bd.id} ${d} ${have}/${b.capacity}`); }
  }
  console.log(`bookings ${bks.length} ${JSON.stringify(byStatus)} | payments ${ps.length} | income £${inn.toFixed(2)} | reconcile mismatches ${bad} | blocks checked ${checked} | seat-count drift ${drift}`);
  process.exit(0);
})();
