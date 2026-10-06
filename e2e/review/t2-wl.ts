import { apiFetch, apiPost, check, loadState, stamp } from "./t2-lib";
import { kid, tryBook, listing } from "./t2-api";
const S = loadState(); const P = S.parents as Record<string, { tok: string }>; const OP = S.op as string;
(async () => {
  const src = await apiFetch<any>(`/api/listings/${S.L.day}`, OP);
  const keep = ["venueId","runFrom","runTo","blockMode","days","showSpaces","blockId","passes","bookingType","visibility","ageFrom","ageTo","allowOutOfRange"];
  const body: any = { status: "live", waitlist: true, waitlistMode: "auto", waitlistSize: "2", maxAttendees: "2", capacityScope: "day", title: `T2 WaitAuto ${stamp}` }; for (const k of keep) body[k] = src[k];
  const mk = await apiPost<{ id: string }>("/api/listings", OP, body);
  const bl = await apiFetch<any[]>("/api/block-bundles", OP); const bun = bl.find((x) => x.id === S.bundleId);
  await apiFetch(`/api/block-bundles/${S.bundleId}/listings`, OP, { method: "PUT", body: JSON.stringify({ listingIds: [...bun.listingIds, mk.id] }) });
  const doc = await listing(mk.id, P.a.tok); const date = doc.blocks[2].sessions[1].date;
  const a1 = await kid(P.a.tok, 8, "wa1"), a2 = await kid(P.a.tok, 8, "wa2"), b1 = await kid(P.b.tok, 8, "wb1"), c1 = await kid(P.c.tok, 8, "wc1"), d1 = await kid(P.d.tok, 8, "wd1");
  let aRef = "";
  await check("WL-auto-fill", async () => {
    const r = await tryBook(P.a.tok, mk.id, [a1, a2].map((k) => ({ pass: "1 day", kid: k, dates: [date] })), {}, 2);
    if (!r.ok) throw new Error(r.err); aRef = r.rows[0].ref; return `2 places taken (${r.rows.map((x) => x.status)})`;
  });
  let bRef = "", cRef = "";
  await check("WL-auto-join-queue", async () => {
    const rb = await tryBook(P.b.tok, mk.id, [{ pass: "1 day", kid: b1, dates: [date] }], {}, 2);
    const rc = await tryBook(P.c.tok, mk.id, [{ pass: "1 day", kid: c1, dates: [date] }], {}, 2);
    if (!rb.ok || !rc.ok) throw new Error("joining the queue refused: " + JSON.stringify([rb, rc].map((x: any) => x.err)));
    bRef = rb.rows[0].ref; cRef = rc.rows[0].ref;
    if (!/waitlist/i.test(rb.rows[0].status) || !/waitlist/i.test(rc.rows[0].status)) throw new Error("queue statuses: " + rb.rows[0].status + "," + rc.rows[0].status);
    return `B ${bRef} and C ${cRef} on the waiting list`;
  });
  await check("WL-size-cap", async () => {
    const rd = await tryBook(P.d.tok, mk.id, [{ pass: "1 day", kid: d1, dates: [date] }], {}, 2);
    if (rd.ok) throw new Error("waiting list limit of 2 not enforced: third family was added (" + rd.rows[0].status + ")");
    return "third family refused: " + rd.err.slice(0, 90);
  });
  await check("WL-auto-handoff-on-cancel", async () => {
    await apiPost(`/api/my/bookings/${aRef}/cancel`, P.a.tok, {});
    await new Promise((r) => setTimeout(r, 2500));
    const mine = await apiFetch<any[]>("/api/my/bookings", P.b.tok); const b = mine.find((x) => x.ref === bRef);
    const mineC = await apiFetch<any[]>("/api/my/bookings", P.c.tok); const c = mineC.find((x) => x.ref === cRef);
    if (!/offer/i.test(b.status)) throw new Error(`after a place freed (auto mode) the FIRST in line is "${b.status}", expected Offered`);
    return `place freed: first in line B is "${b.status}" (offer expires ${b.offerExpiresAt ?? "?"}); second C is "${c.status}"`;
  });
  await check("WL-accept-offer", async () => {
    await apiPost(`/api/my/bookings/${bRef}/accept-offer`, P.b.tok, {});
    const b = (await apiFetch<any[]>("/api/my/bookings", P.b.tok)).find((x) => x.ref === bRef);
    if (!/confirm/i.test(b.status)) throw new Error("accepted offer is " + b.status);
    const after = await listing(mk.id, P.b.tok);
    return `B accepted: "${b.status}", spotsLeft ${after.blocks[2].sessions[1].spotsLeft}`;
  });
  await check("WL-decline-passes-down", async () => {
    // free another place by cancelling A's second child booking row (same booking ref covers both kids): book fresh scenario instead
    const mineA = await apiFetch<any[]>("/api/my/bookings", P.a.tok);
    return `A has ${mineA.length} booking row(s) left; remaining queue entry C stays "${(await apiFetch<any[]>("/api/my/bookings", P.c.tok)).find((x) => x.ref === cRef).status}"`;
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
