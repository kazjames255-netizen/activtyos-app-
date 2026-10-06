import { apiFetch, apiPost, check, loadState, stamp } from "./t2-lib";
const S = loadState(); const P = S.parents as Record<string, { tok: string; email: string }>; const OP = S.op as string; const L = S.L as Record<string, string>;
let kn = 0;
export async function kid(tok: string, ageYears: number, tag = "K") {
  const dob = `${2026 - ageYears}-01-15`; // birthday already passed in Oct 2026, so the age is exactly ageYears
  const name = `T2 ${tag}${++kn} ${stamp}`;
  const k = await apiPost<{ id: string }>("/api/my/children", tok, { name, dob });
  return { id: k.id, name, age: ageYears };
}
export async function listing(id: string, tok = P.a.tok) { return apiFetch<any>(`/api/listings/${id}`, tok); }
export type Row = { ref: string; status: string; amount: number; listPrice?: number; discountOff?: number; pay?: string; days?: string[]; child?: string; discountNames?: string[]; blockId?: string };
export async function tryBook(tok: string, lid: string, items: { pass: string; kid: { id: string; name: string; age: number }; dates: string[] }[], extra: Record<string, unknown> = {}, blockIdx = 0) {
  const doc = await listing(lid, tok);
  const block = doc.blocks[blockIdx];
  try {
    const r = await apiPost<{ bookings: Row[] }>("/api/my/bookings", tok, { listingId: lid, blockId: block.id, method: "card", items: items.map((x) => ({ pass: x.pass, child: x.kid.name, childId: x.kid.id, dates: x.dates })), ...extra });
    const mine = await apiFetch<Row[]>("/api/my/bookings", tok);
    return { ok: true as const, rows: r.bookings.map((b) => mine.find((m) => m.ref === b.ref) ?? b), block };
  } catch (e) { return { ok: false as const, err: (e as Error).message, block }; }
}
const dates = (block: any, n: number, from = 0) => block.sessions.slice(from, from + n).map((s: any) => s.date);
const near = (a: number, b: number, m: string) => { if (Math.abs(a - b) > 0.011) throw new Error(`${m}: got ${a} expected ${b}`); };

if (!process.env.T2_LIB) (async () => {
  const base = await listing(L.day); const blk = base.blocks[0];
  console.log("block fields", Object.keys(blk).join(","), "capacity", blk.capacity, "spotsLeft", blk.spotsLeft, "scope", blk.capacityScope, "sessions", blk.sessions.length);

  // ---- AGE GATE (listing says No) ----
  const ages: Record<number, any> = {};
  for (const a of [3, 4, 5, 8, 11, 12, 13]) ages[a] = await kid(P.a.tok, a, `age${a}`);
  for (const [a, expectOk] of [[3, false], [4, false], [5, true], [8, true], [11, true], [12, false], [13, false]] as const) {
    await check(`CAP-AGE-${a}`, async () => {
      const r = await tryBook(P.a.tok, L.day, [{ pass: "1 day", kid: ages[a], dates: dates(blk, 1, a % 3) }]);
      if (r.ok !== expectOk) throw new Error(`age ${a}: expected ${expectOk ? "booked" : "refused"}, got ${r.ok ? "booked " + r.rows[0].status : "refused: " + r.err}`);
      return r.ok ? `age ${a} booked (${r.rows[0].ref} ${r.rows[0].status})` : `age ${a} refused: ${r.err.slice(0, 90)}`;
    });
  }
  // ---- OUT OF RANGE = Yes ----
  const o = await listing(L.oor); 
  await check("CAP-OOR-yes-out", async () => {
    const r = await tryBook(P.a.tok, L.oor, [{ pass: "1 day", kid: ages[13], dates: dates(o.blocks[0], 1, 0) }]);
    if (!r.ok) throw new Error("expected a request, got refusal: " + r.err);
    if (!/approval/i.test(r.rows[0].status)) throw new Error(`out-of-range child on AUTO-confirm listing: status "${r.rows[0].status}" (expected Approval needed)`);
    return `age 13 on auto listing with allowOutOfRange: ${r.rows[0].ref} status "${r.rows[0].status}"`;
  });
  await check("CAP-OOR-yes-in", async () => {
    const r = await tryBook(P.a.tok, L.oor, [{ pass: "1 day", kid: ages[8], dates: dates(o.blocks[0], 1, 1) }]);
    if (!r.ok) throw new Error(r.err);
    if (/approval/i.test(r.rows[0].status)) throw new Error("in-range child wrongly needs approval: " + r.rows[0].status);
    return `age 8 in range: ${r.rows[0].ref} "${r.rows[0].status}"`;
  });
  // operator approves the request
  await check("CAP-OOR-approve", async () => {
    const mine = await apiFetch<Row[]>("/api/bookings", OP);
    const req = mine.find((b) => /approval/i.test(b.status));
    if (!req) throw new Error("operator does not see the request");
    await apiPost(`/api/bookings/${req.ref}/actions`, OP, { type: "approve" });
    const after = (await apiFetch<Row[]>("/api/bookings", OP)).find((b) => b.ref === req.ref)!;
    return `operator approved ${req.ref}: now "${after.status}"`;
  });

  // ---- PER-DAY CAPACITY 10, race for last place ----
  const d = await listing(L.day, P.b.tok); const bd = d.blocks[1];
  const day = bd.sessions[2].date; // an untouched day in week 2
  const fill: any[] = []; for (let i = 0; i < 9; i++) fill.push({ pass: "1 day", kid: await kid(P.b.tok, 8, `f${i}`), dates: [day] });
  await check("CAP-DAY-fill9", async () => {
    const r = await tryBook(P.b.tok, L.day, fill, {}, 1);
    if (!r.ok) throw new Error(r.err);
    const after = await listing(L.day, P.b.tok);
    const s = after.blocks[1].sessions.find((x: any) => x.date === day);
    return `9 booked on ${day}: statuses ${[...new Set(r.rows.map((x) => x.status))].join("/")}; session spotsLeft=${s?.spotsLeft} (cap per day 10)`;
  });
  const c1 = await kid(P.c.tok, 8, "race"), d1 = await kid(P.d.tok, 8, "race");
  await check("CAP-DAY-race", async () => {
    const [r1, r2] = await Promise.all([
      tryBook(P.c.tok, L.day, [{ pass: "1 day", kid: c1, dates: [day] }], {}, 1),
      tryBook(P.d.tok, L.day, [{ pass: "1 day", kid: d1, dates: [day] }], {}, 1),
    ]);
    const st = [r1, r2].map((r) => (r.ok ? r.rows[0].status : "refused:" + r.err.slice(0, 40)));
    const placed = st.filter((s) => /^(Confirmed|Pending|Booked|Approval needed|Awaiting)/i.test(s) || (!/waitlist|refused/i.test(s))).length;
    const wl = st.filter((s) => /waitlist/i.test(s)).length;
    if (placed !== 1 || wl !== 1) throw new Error(`race for last place: statuses ${JSON.stringify(st)} (expected exactly one placed and one waitlisted)`);
    return `two parents, last place: ${JSON.stringify(st)}`;
  });
  await check("CAP-DAY-soldout", async () => {
    const x = await kid(P.a.tok, 8, "late");
    const r = await tryBook(P.a.tok, L.day, [{ pass: "1 day", kid: x, dates: [day] }], {}, 1);
    if (!r.ok) throw new Error(r.err);
    if (!/waitlist/i.test(r.rows[0].status)) throw new Error("sold-out day did not waitlist: " + r.rows[0].status);
    const after = await listing(L.day, P.a.tok);
    const s = after.blocks[1].sessions.find((q: any) => q.date === day);
    return `day full -> "${r.rows[0].status}" ${r.rows[0].ref}; spotsLeft ${s?.spotsLeft}; owes £${r.rows[0].amount}`;
  });
  // cancel one placed booking -> number goes up; manual waitlist hand-off
  await check("CAP-DAY-cancel-handoff", async () => {
    const mine = await apiFetch<Row[]>("/api/my/bookings", P.b.tok);
    const target = mine.find((b) => b.days?.includes(day) && !/waitlist|cancel/i.test(b.status));
    if (!target) throw new Error("no placed booking to cancel");
    await apiPost(`/api/my/bookings/${target.ref}/cancel`, P.b.tok, {});
    const after = await listing(L.day, P.b.tok);
    const s = after.blocks[1].sessions.find((q: any) => q.date === day);
    const wl = (await apiFetch<Row[]>("/api/bookings", OP)).filter((b) => /waitlist|offer/i.test(b.status) && b.days?.includes(day));
    return `cancelled ${target.ref}: spotsLeft now ${s?.spotsLeft}; waitlist/offered rows: ${wl.map((w) => w.ref + ":" + w.status).join(", ")}`;
  });
  await check("CAP-DAY-offer", async () => {
    const w = (await apiFetch<Row[]>("/api/bookings", OP)).find((b) => /^waitlisted$/i.test(b.status) && b.days?.includes(day));
    if (!w) throw new Error("no waitlisted booking to offer");
    await apiPost(`/api/bookings/${w.ref}/actions`, OP, { type: "offer" });
    const o2 = (await apiFetch<Row[]>("/api/bookings", OP)).find((b) => b.ref === w.ref)!;
    const owner = [P.a, P.c, P.d].find(async () => false);
    return `operator offered ${w.ref}: status "${o2.status}"`;
  });

  // ---- WHOLE LISTING CAPACITY 6 ----
  const w = await listing(L.whole, P.a.tok); const bw = w.blocks[0];
  console.log("whole-listing block capacity", bw.capacity, "spotsLeft", bw.spotsLeft, "scope", bw.capacityScope);
  await check("CAP-WHOLE-count", async () => {
    const ks = []; for (let i = 0; i < 3; i++) ks.push(await kid(P.a.tok, 8, `w${i}`));
    const r = await tryBook(P.a.tok, L.whole, ks.map((k) => ({ pass: "1 day", kid: k, dates: dates(bw, 1, 0) })));
    if (!r.ok) throw new Error(r.err);
    const after = await listing(L.whole, P.a.tok);
    return `3 children x 1 day on a whole-listing cap of 6: spotsLeft ${bw.spotsLeft} -> ${after.blocks[0].spotsLeft}; statuses ${[...new Set(r.rows.map((x) => x.status))]}`;
  });
  await check("CAP-WHOLE-full", async () => {
    const ks = []; for (let i = 0; i < 4; i++) ks.push(await kid(P.b.tok, 8, `wf${i}`));
    const r = await tryBook(P.b.tok, L.whole, ks.map((k) => ({ pass: "1 day", kid: k, dates: dates(bw, 1, 1) })));
    if (!r.ok) throw new Error(r.err);
    const after = await listing(L.whole, P.b.tok);
    return `4 more: statuses ${r.rows.map((x) => x.status).join(",")}; spotsLeft ${after.blocks[0].spotsLeft}`;
  });

  // ---- TICKET OVERRIDES ----
  const tk = (over: Record<string, any>) => apiFetch(`/api/listings/${L.disc}`, OP, { method: "PUT", body: JSON.stringify({ ticketOverrides: over }) });
  const dd = await listing(L.disc, P.a.tok); const bdd = dd.blocks[0];
  await check("CAP-TICKET-close", async () => {
    await tk({ "5 days": { capacity: "0" } });
    const r = await tryBook(P.a.tok, L.disc, [{ pass: "5 days", kid: ages[8], dates: dates(bdd, 5, 0) }]);
    if (r.ok) throw new Error("a CLOSED ticket was booked: " + r.rows[0].ref);
    return "closed 5-day ticket refused: " + r.err.slice(0, 80);
  });
  await check("CAP-TICKET-passcap", async () => {
    await tk({ "1 day": { capacity: "2" } });
    const ks = []; for (let i = 0; i < 3; i++) ks.push(await kid(P.c.tok, 8, `pc${i}`));
    const r = await tryBook(P.c.tok, L.disc, ks.map((k) => ({ pass: "1 day", kid: k, dates: [bdd.sessions[3].date] })));
    if (!r.ok) throw new Error(r.err);
    return `1-day ticket cap 2/day, 3 children: ${r.rows.map((x) => x.status).join(",")}`;
  });
  await check("CAP-TICKET-hidden-server", async () => {
    await tk({ "3 days": { hidden: true } });
    const r = await tryBook(P.d.tok, L.disc, [{ pass: "3 days", kid: ages[8], dates: dates(bdd, 3, 0) }]);
    if (r.ok) throw new Error("a HIDDEN ticket can still be booked straight through the API (ref " + r.rows[0].ref + ")");
    return "hidden ticket refused by server";
  });
  await check("CAP-TICKET-age-override", async () => {
    await tk({ "1 day": { ageFrom: "9", ageTo: "10" } });
    const r = await tryBook(P.d.tok, L.disc, [{ pass: "1 day", kid: ages[5], dates: [bdd.sessions[7].date] }]);
    if (r.ok) throw new Error(`per-ticket age override 9-10 on '1 day' is NOT enforced: age-5 child booked ${r.rows[0].ref} (${r.rows[0].status})`);
    return "per-ticket age range enforced: " + r.err.slice(0, 80);
  });
  await tk({});
  // ---- AGE CAPS ----
  await check("CAP-AGECAPS", async () => {
    const lib = (await apiFetch<any>("/api/library", OP)) as any;
    await apiFetch("/api/library", OP, { method: "PUT", body: JSON.stringify({ venues: lib.venues, settings: { ...lib.settings, ratioGroups: [{ id: "g57", name: "Cubs", colour: "#e2225f", ageFrom: 5, ageTo: 7, targetRatio: 8, maxSize: 32 }, { id: "g810", name: "Explorers", colour: "#2f6bd8", ageFrom: 8, ageTo: 10, targetRatio: 8, maxSize: 32 }] } }) });
    await apiFetch(`/api/listings/${L.hide}`, OP, { method: "PUT", body: JSON.stringify({ ageCapsOn: true, ageCaps: { g57: 1, g810: 0 } }) });
    const h = await listing(L.hide, P.a.tok); const bh = h.blocks[0];
    const young = [await kid(P.a.tok, 6, "ac1"), await kid(P.a.tok, 7, "ac2")];
    const r1 = await tryBook(P.a.tok, L.hide, young.map((k) => ({ pass: "1 day", kid: k, dates: [bh.sessions[0].date] })));
    const older = await kid(P.a.tok, 9, "ac3");
    const r2 = await tryBook(P.a.tok, L.hide, [{ pass: "1 day", kid: older, dates: [bh.sessions[1].date] }]);
    const s1 = r1.ok ? r1.rows.map((x) => x.status).join(",") : "refused " + r1.err.slice(0, 50);
    const s2 = r2.ok ? r2.rows[0].status : "refused " + r2.err.slice(0, 60);
    if (!(r1.ok && /waitlist/i.test(r1.rows[1]?.status ?? "") && !/waitlist/i.test(r1.rows[0].status))) throw new Error(`age cap 1 for Cubs: two 5-7 children -> ${s1} (expected first placed, second waitlisted)`);
    if (r2.ok && !/waitlist/.test(r2.rows[0].status.toLowerCase())) throw new Error(`age cap 0 (closed) for 8-10: child aged 9 -> ${s2}`);
    return `cap 1 Cubs: ${s1}; cap 0 Explorers: ${s2}`;
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
