import * as L from "./wl-lib";
const { A, call, ok, check, eq, must, book, firstBooking, mkListing, sd, kid, snap, pageFor, opAction, myBooking, opBooking } = L;

(async () => {
  await L.signupOperator("pv", "WL Test Camps");
  for (const p of ["pa", "pb", "pc", "pd", "pe"]) await L.signupParent(p);
  console.log("accounts", Object.fromEntries(Object.entries(A).filter(([k]) => k !== "__stamp").map(([k, v]: any) => [k, v.email])));
  const S: any = {};
  S.L1 = await mkListing("pv", "WL Camp manual", { waitlistSize: "3" });
  console.log("L1", S.L1.id, S.L1.blockId, "blocks", S.L1.blocks.length);
  require("node:fs").writeFileSync(L.SHOTS + "/state-a.json", JSON.stringify(S));

  const mon = sd(0, 0), tue = sd(0, 1);
  // W01 fill the day
  let ra: any, rb: any, rc: any, rd: any;
  await check("W01-fill-day", "join", async () => {
    ra = await book("pa", S.L1, [mon], "1 day"); rb = await book("pb", S.L1, [mon], "1 day");
    eq(ra.status, 201, "pa status"); eq(rb.status, 201, "pb status");
    eq(firstBooking(ra).status, "Confirmed", "pa booking"); eq(firstBooking(rb).status, "Confirmed", "pb booking");
    return `pa ${firstBooking(ra).ref} + pb ${firstBooking(rb).ref} Confirmed (capacity 2/day)`;
  });
  await check("W02-join-waitlist-single-day", "join", async (shots) => {
    rc = await book("pc", S.L1, [mon], "1 day");
    eq(rc.status, 201, "pc status");
    const b = firstBooking(rc);
    eq(b.status, "Waitlisted", "pc booking status");
    must(b.waitlist?.length, "position data"); eq(b.waitlist[0].position, 1, "position");
    return `pc ${b.ref} Waitlisted pos ${b.waitlist[0].position} on ${b.waitlist[0].date}; amount £${b.amount}, pay=${b.pay}, amountPaid=${b.amountPaid ?? 0}, status=${b.status}`;
  });
  await check("W03-second-in-queue", "join", async () => {
    rd = await book("pd", S.L1, [mon], "1 day");
    const b = firstBooking(rd); eq(b.status, "Waitlisted", "pd status"); eq(b.waitlist[0].position, 2, "pd position");
    return `pd ${b.ref} pos 2`;
  });
  await check("W04-size-limit", "join", async () => {
    // size 3: pc, pd, then pa-second child 3rd OK, 4th refused
    const r3 = await book("pa", S.L1, [mon], "1 day");
    const b3 = firstBooking(r3); eq(b3?.status, "Waitlisted", "3rd waiting");
    const r4 = await book("pb", S.L1, [mon], "1 day");
    return `3rd waiting ok (pos ${b3.waitlist?.[0]?.position}); 4th -> HTTP ${r4.status} ${JSON.stringify(r4.json).slice(0, 160)}`;
  });
  await check("W05-duplicate-join", "join", async () => {
    // pc same child same day again
    const first = firstBooking(rc);
    const kidName = first.child;
    const r = await book("pc", S.L1, [mon], "1 day", {}, kidName);
    return `duplicate join same child -> HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`;
  });
  console.log("done A"); await L.closeAll(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
