import { apiFetch, apiPost, check, loadState } from "./t2-lib";
import { kid, tryBook, listing } from "./t2-api";
const S = loadState(); const P = S.parents as Record<string, { tok: string }>; const L = S.L as Record<string, string>;
(async () => {
  const d = await listing(L.oor, P.d.tok); const blk = d.blocks[2]; const date = blk.sessions[3].date; const date2 = blk.sessions[4].date;
  const k1 = await kid(P.d.tok, 8, "cc1"), k2 = await kid(P.d.tok, 8, "cc2");
  const spots = async () => (await listing(L.oor, P.d.tok)).blocks[2].sessions.filter((s: any) => s.date === date)[0].spotsLeft;
  let ref = "", before = 0;
  await check("CAP-CANCEL-child", async () => {
    before = await spots();
    const r = await tryBook(P.d.tok, L.oor, [k1, k2].map((k) => ({ pass: "1 day", kid: k, dates: [date] })), {}, 2);
    if (!r.ok) throw new Error(r.err); ref = (r.rows.find((x: any) => String(x.child ?? "").includes(k1.name) || (x.kids ?? []).some((q: any) => q.name === k1.name)) ?? r.rows[0]).ref; console.log('   rows:', r.rows.map((x: any) => x.ref + ':' + (x.child ?? '')).join(' | '));
    const afterBook = await spots();
    if (afterBook !== before - 2) throw new Error(`booking 2 children took ${before - afterBook} place(s), expected 2`);
    await apiPost(`/api/my/bookings/${ref}/cancel`, P.d.tok, { kids: [{ name: k1.name, childId: k1.id, days: [date] }], resolution: "refund" });
    const afterCancel = await spots();
    if (afterCancel !== before - 1) throw new Error(`cancelling ONE of two children: spotsLeft ${before} -> ${afterBook} -> ${afterCancel} (expected ${before - 1})`);
    return `2 children booked (spotsLeft ${before}->${afterBook}); cancel one child -> ${afterCancel}`;
  });
  await check("CAP-CANCEL-whole", async () => {
    await apiPost(`/api/my/bookings/${ref}/cancel`, P.d.tok, {});
    const a = await spots();
    if (a !== before) throw new Error(`after cancelling the whole booking spotsLeft is ${a}, expected back to ${before}`);
    return `whole booking cancelled -> spotsLeft back to ${a}`;
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
