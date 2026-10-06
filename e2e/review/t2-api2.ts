import { apiFetch, apiPost, check, loadState } from "./t2-lib";
import { kid, listing, tryBook, type Row } from "./t2-api";
const S = loadState(); const P = S.parents as Record<string, { tok: string }>; const OP = S.op as string; const L = S.L as Record<string, string>;
const tk = (over: Record<string, any>) => apiFetch(`/api/listings/${L.disc}`, OP, { method: "PUT", body: JSON.stringify({ ticketOverrides: over }) });
(async () => {
  const dd = await listing(L.disc, P.a.tok); const bdd = dd.blocks[1];
  const k5 = await kid(P.d.tok, 5, "t5"), k8 = await kid(P.d.tok, 8, "t8"), k10 = await kid(P.d.tok, 10, "t10");
  await check("CAP-AGECAPS", async () => {
    const lib = (await apiFetch<any>("/api/library", OP)) as any;
    await apiFetch("/api/library", OP, { method: "PUT", body: JSON.stringify({ venues: lib.venues, settings: { ...lib.settings, ratioGroups: [{ id: "g57", name: "Cubs", colour: "#e2225f", ageFrom: 5, ageTo: 7, targetRatio: 8, maxSize: 32 }, { id: "g810", name: "Explorers", colour: "#2f6bd8", ageFrom: 8, ageTo: 10, targetRatio: 8, maxSize: 32 }] } }) });
    await apiFetch(`/api/listings/${L.hide}`, OP, { method: "PUT", body: JSON.stringify({ ageCapsOn: true, ageCaps: { g57: 1, g810: 0 } }) });
    const h = await listing(L.hide, P.a.tok); const bh = h.blocks[1];
    const date = bh.sessions[Number(process.env.AC_DAY ?? 0)].date;
    const y1 = await kid(P.a.tok, 6, "ac1"), y2 = await kid(P.b.tok, 7, "ac2"), old = await kid(P.c.tok, 9, "ac3"), free = await kid(P.c.tok, 11, "ac4");
    const r1 = await tryBook(P.a.tok, L.hide, [{ pass: "1 day", kid: y1, dates: [date] }], {}, 1);
    const r2 = await tryBook(P.b.tok, L.hide, [{ pass: "1 day", kid: y2, dates: [date] }], {}, 1);
    const r3 = await tryBook(P.c.tok, L.hide, [{ pass: "1 day", kid: old, dates: [date] }], {}, 1);
    const r4 = await tryBook(P.c.tok, L.hide, [{ pass: "1 day", kid: free, dates: [date] }], {}, 1);
    const st = (r: any) => (r.ok ? r.rows[0].status : "refused " + r.err.slice(0, 50));
    const out = `Cubs cap 1: first=${st(r1)} second=${st(r2)}; Explorers cap 0 (closed): ${st(r3)}; age 11 (no cap set): ${st(r4)}`;
    if (!(r1.ok && !/waitlist/i.test(st(r1)) && /waitlist/i.test(st(r2)))) throw new Error("Cubs cap of 1 not applied: " + out);
    if (!(r3.ok ? /waitlist/i.test(st(r3)) : true)) throw new Error("age cap 0 not applied: " + out);
    if (r4.ok && /waitlist/i.test(st(r4))) throw new Error("uncapped age group wrongly waitlisted: " + out);
    return out;
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
