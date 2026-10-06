import { apiFetch, apiPost, check, fbSignUp, iso, loadState, stamp } from "./t2-lib";
const S = loadState(); const OP = S.op as string; const LID = (S.L as Record<string, string>).disc;
const ukToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const ukPlus = (n: number) => { const d = new Date(ukToday() + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const rule = (r: any) => ({ id: `r${Math.random().toString(36).slice(2, 8)}`, name: "", passNames: [], enabled: true, appliesTo: "all", moreThan: 1, beforeDate: "", ...r });
const setRules = (rs: any[]) => apiFetch(`/api/listings/${LID}`, OP, { method: "PUT", body: JSON.stringify({ discounts: rs.map(rule) }) });
let n = 700 + (Date.now() % 200);
async function fam(nk = 1) { const email = `e2e-t2-g${++n}-${stamp}@activityos-test.com`; const s = await fbSignUp(email); await apiPost("/api/register-role", s.idToken, { role: "parent", postcode: "NN5 7EA", firstName: "G", lastName: String(n) }); await apiPost("/api/me/welcome", s.idToken, {}); const kids: any[] = []; for (let k = 0; k < nk; k++) { const name = `T2 G${n}k${k} ${stamp}`; kids.push({ ...(await apiPost<{ id: string }>("/api/my/children", s.idToken, { name, dob: "2018-05-14" })), name }); } return { tok: s.idToken, kids, email }; }
let dc = 4;
async function book(f: any, passes: string[], extra: any = {}, blockOff = dc++ % 3) {
  const doc = await apiFetch<any>(`/api/listings/${LID}`, f.tok); const blk = [...doc.blocks].sort((a: any, b: any) => b.spotsLeft - a.spotsLeft)[blockOff % 2]; // the emptiest weeks: earlier rounds filled some days
  const DAYS: any = { "1 day": 1, "3 days": 3, "5 days": 5 };
  const items = passes.map((p, i) => ({ pass: p, child: f.kids[i].name, childId: f.kids[i].id, dates: [...blk.sessions].sort((a: any, b: any) => b.spotsLeft - a.spotsLeft).slice(0, DAYS[p]).map((x: any) => x.date).sort() }));
  const r = await apiPost<{ bookings: any[] }>("/api/my/bookings", f.tok, { listingId: LID, blockId: blk.id, method: "card", items, ...extra });
  const mine = await apiFetch<any[]>("/api/my/bookings", f.tok); const rows = r.bookings.map((b: any) => mine.find((m) => m.ref === b.ref) ?? b);
  return { amt: Math.round(rows.reduce((s: number, b: any) => s + Number(b.amount ?? 0), 0) * 100) / 100, off: Math.round(rows.reduce((s: number, b: any) => s + Number(b.discountOff ?? 0), 0) * 100) / 100, names: [...new Set(rows.flatMap((b: any) => b.discountNames ?? []))] as string[], rows };
}
(async () => {
  // D1 fixed GBP early bird: once per family per season
  await setRules([{ kind: "early", method: "subtract", value: 10, beforeDate: ukPlus(30) }]);
  await check("DISC-EARLYFIXED-once-per-family", async () => {
    const f = await fam(2);
    const a = await book(f, ["1 day"]); const b = await book(f, ["1 day"].concat([]).slice(0, 1).map(() => "1 day"), {}, dc);
    // second basket must use a different child on different day; reuse kid 1
    f.kids = [f.kids[1]]; const c = await book(f, ["1 day"], {}, dc + 1);
    if (a.off !== 10) throw new Error("first fixed early bird not given: off " + a.off);
    if (c.off !== 0) throw new Error(`second booking by the SAME family still got the fixed £10 early bird (off £${c.off}, charged £${c.amt})`);
    return `family 1st booking off £${a.off} (£${a.amt}); 2nd booking off £${c.off} (£${c.amt}) -> once per family per season`;
  });
  await check("DISC-EARLYFIXED-race-claim-lock", async () => {
    const f = await fam(2);
    const fk = (k: any) => ({ tok: f.tok, kids: [k] });
    const [x, y] = await Promise.allSettled([book(fk(f.kids[0]), ["1 day"], {}, 1), book(fk(f.kids[1]), ["1 day"], {}, 2)]);
    const offs = [x, y].map((r) => (r.status === "fulfilled" ? r.value.off : `err:${(r.reason as Error).message.slice(0, 60)}`));
    const given = offs.filter((o) => o === 10).length;
    if (given > 1) throw new Error("two simultaneous checkouts by one family BOTH got the fixed £10 early bird: " + JSON.stringify(offs));
    return `two simultaneous checkouts, same family: offs ${JSON.stringify(offs)} (at most one £10)`;
  });
  await setRules([{ kind: "early", method: "percent", value: 10 }]);
  await check("DISC-EARLYPCT-repeats", async () => {
    const f = await fam(2);
    const a = await book(f, ["1 day"]); f.kids = [f.kids[1]]; const b = await book(f, ["1 day"], {}, dc);
    if (a.off !== 2 || b.off !== 2) throw new Error(`percentage early bird should repeat for the same family: ${a.off}, ${b.off}`);
    return `percent early bird repeats: £${a.off} then £${b.off}`;
  });
  await setRules([{ kind: "early", method: "percent", value: 10, beforeDate: ukToday() }]);
  await check("DISC-EARLY-boundary-today", async () => {
    const f = await fam(1); const a = await book(f, ["1 day"]);
    if (a.off !== 2) throw new Error("book-by date = today should still give the discount, got off " + a.off);
    return "book-by date = today (inclusive): discount given";
  });
  // D3 person fixed GBP refused
  await check("DISC-PERSON-fixed-refused", async () => {
    try { await setRules([{ kind: "person", method: "subtract", value: 5 }]); } catch (e) { return "fixed £ multi-person rule refused: " + (e as Error).message.slice(0, 110); }
    throw new Error("a NEW fixed-£ multi-person rule was accepted");
  });
  // D5 discount codes alongside rules
  await setRules([{ kind: "person", method: "percent", value: 10 }]);
  const mk = (o: any) => apiPost("/api/discounts", OP, { active: true, ...o });
  await mk({ code: `T2PCT${stamp}`.slice(0, 14).toUpperCase(), type: "percent", value: 10 }).catch(() => null);
  await mk({ code: `T2GBP${stamp}`.slice(0, 14).toUpperCase(), type: "amount", value: 5 }).catch(() => null);
  const C1 = `T2PCT${stamp}`.slice(0, 14).toUpperCase(), C2 = `T2GBP${stamp}`.slice(0, 14).toUpperCase();
  await check("DISC-CODE-after-rules", async () => {
    const f = await fam(2); const r = await book(f, ["3 days", "3 days"], { discountCode: C1 });
    // rules first: 108 -> 97.2 ; then 10% code of 97.2 = 9.72 -> 87.48
    if (Math.abs(r.amt - 87.48) > 0.02) throw new Error(`2 kids 3-day, 10% sibling then 10% code: expected £87.48 got £${r.amt} (off £${r.off}) [${r.names}]`);
    return `rule then code: £${r.amt}, total off £${r.off}; names: ${r.names.join("; ")}`;
  });
  await check("DISC-CODE-two-codes-stack", async () => {
    const f = await fam(2); const r = await book(f, ["3 days", "3 days"], { discountCodes: [C1, C2] });
    const addExp = 97.2 - 9.72 - 5; const seqExp = Math.round((97.2 * 0.9 - 5) * 100) / 100;
    return `10% + £5 codes on £97.20 (after sibling): charged £${r.amt} (additive ${addExp.toFixed(2)}; sequential ${seqExp.toFixed(2)}) names: ${r.names.join("; ")}`;
  });
  await setRules([]);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
