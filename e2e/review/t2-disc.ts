import { apiFetch, apiPost, check, fbSignIn, fbSignUp, iso, loadState, results, saveResults, stamp, TEST_PASSWORD } from "./t2-lib";
import fs from "node:fs"; import path from "node:path";
import { OUT } from "./t2-lib";
const S = loadState(); const OP = S.op as string; const L = S.L as Record<string, string>; const LID = L.disc;
const ukToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const ukPlus = (n: number) => { const d = new Date(ukToday() + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
type Rule = { kind: "person" | "session" | "early"; moreThan?: number; method: "subtract" | "percent"; value: number; passNames?: string[]; beforeDate?: string };
const PRICE: Record<string, number> = { "1 day": 20, "3 days": 54, "5 days": 90 }; const DAYS: Record<string, number> = { "1 day": 1, "3 days": 3, "5 days": 5 };
type It = { pass: string; week: number; kidIdx: number };
const r2 = (n: number) => Math.round(n * 100) / 100;
// ---- INDEPENDENT ORACLE written from the product rules, NOT from applyDiscounts ----
function oracle(rules: Rule[], items: It[], fixedUsed: boolean) {
  const kids = new Set(items.map((i) => i.kidIdx)).size;           // distinct children in the WHOLE checkout
  const lines = items.map((i) => ({ pass: i.pass, price: PRICE[i.pass], days: DAYS[i.pass] }));
  const gross = lines.reduce((s, l) => s + l.price, 0);
  const covers = (r: Rule, p: string) => !r.passNames?.length || r.passNames.includes(p);
  let running = gross;
  // 1 multi-person: best single rule; percent of each covered line, only when kids > moreThan
  let bestP = 0;
  for (const r of rules.filter((x) => x.kind === "person")) if (kids > (r.moreThan ?? 1)) bestP = Math.max(bestP, lines.filter((l) => covers(r, l.pass)).reduce((s, l) => s + (l.price * r.value) / 100, 0));
  running -= bestP;
  const share = (r: Rule) => (gross > 0 ? lines.filter((l) => covers(r, l.pass)).reduce((s, l) => s + l.price, 0) / gross : 0);
  const take = (r: Rule, unit: number) => (r.method === "percent" ? (unit * r.value) / 100 : Math.min(unit, r.value));
  // 2 multi-session
  let bestS = 0;
  for (const r of rules.filter((x) => x.kind === "session")) { const sessions = lines.filter((l) => covers(r, l.pass)).reduce((s, l) => s + l.days, 0); if (sessions > (r.moreThan ?? 3)) bestS = Math.max(bestS, take(r, running * share(r))); }
  running -= bestS;
  // 3 early bird: date still open (or blank); fixed-GBP only once per family per season
  let bestE = 0;
  for (const r of rules.filter((x) => x.kind === "early")) { if (r.beforeDate && ukToday() > r.beforeDate) continue; if (fixedUsed && r.method !== "percent") continue; bestE = Math.max(bestE, take(r, running * share(r))); }
  running -= bestE;
  return { total: r2(Math.max(0, running)), off: r2(gross - Math.max(0, running)), gross: r2(gross) };
}
const RULESETS: Record<string, Rule[]> = {
  R0_none: [],
  R1_person10: [{ kind: "person", moreThan: 1, method: "percent", value: 10 }],
  R2_person20_over2: [{ kind: "person", moreThan: 2, method: "percent", value: 20 }],
  R3_session10_over3: [{ kind: "session", moreThan: 3, method: "percent", value: 10 }],
  R4_session5pound_over5: [{ kind: "session", moreThan: 5, method: "subtract", value: 5 }],
  R5_early10pct_open: [{ kind: "early", method: "percent", value: 10 }],
  R6_early10pound_future: [{ kind: "early", method: "subtract", value: 10, beforeDate: ukPlus(10) }],
  R7_early_expired: [{ kind: "early", method: "percent", value: 20, beforeDate: ukPlus(-3) }],
  R8_stack: [{ kind: "person", moreThan: 1, method: "percent", value: 10 }, { kind: "session", moreThan: 3, method: "percent", value: 10 }, { kind: "early", method: "percent", value: 5 }],
  R9_two_person: [{ kind: "person", moreThan: 1, method: "percent", value: 10 }, { kind: "person", moreThan: 2, method: "percent", value: 20 }],
  R10_person_3day_only: [{ kind: "person", moreThan: 1, method: "percent", value: 15, passNames: ["3 days"] }],
  R11_session_1day_only: [{ kind: "session", moreThan: 2, method: "percent", value: 25, passNames: ["1 day"] }],
};
const BASKETS: Record<string, It[]> = {
  B1_one_child_1day: [{ pass: "1 day", week: 0, kidIdx: 0 }],
  B2_two_kids_3day_same_week: [{ pass: "3 days", week: 0, kidIdx: 0 }, { pass: "3 days", week: 0, kidIdx: 1 }],
  B3_three_kids_1day: [{ pass: "1 day", week: 0, kidIdx: 0 }, { pass: "1 day", week: 0, kidIdx: 1 }, { pass: "1 day", week: 0, kidIdx: 2 }],
  B4_siblings_different_weeks: [{ pass: "3 days", week: 0, kidIdx: 0 }, { pass: "3 days", week: 1, kidIdx: 1 }],
  B5_mixed_5day_and_1day: [{ pass: "5 days", week: 1, kidIdx: 0 }, { pass: "1 day", week: 2, kidIdx: 1 }],
  B6_one_child_two_weeks: [{ pass: "3 days", week: 0, kidIdx: 0 }, { pass: "3 days", week: 1, kidIdx: 0 }],
};
let fam = process.env.ONLY ? 500 + (Date.now() % 400) : 0;
async function newFamily(nKids: number) {
  const email = `e2e-t2-f${++fam}-${stamp}@activityos-test.com`;
  const s = await fbSignUp(email);
  await apiPost("/api/register-role", s.idToken, { role: "parent", postcode: "NN5 7EA", firstName: "Fam", lastName: String(fam) });
  await apiPost("/api/me/welcome", s.idToken, {});
  const kids: { id: string; name: string }[] = [];
  for (let k = 0; k < nKids; k++) { const name = `T2 D${fam}k${k} ${stamp}`; kids.push({ ...(await apiPost<{ id: string }>("/api/my/children", s.idToken, { name, dob: "2018-05-14" })), name }); }
  return { tok: s.idToken, kids, email };
}
let dayCursor = process.env.ONLY ? Number(process.env.DC ?? 2) : 0;
async function runBasket(tok: string, kids: { id: string; name: string }[], items: It[]) {
  const doc = await apiFetch<any>(`/api/listings/${LID}`, tok);
  // spread scenarios across all days so no day passes 30 and a child is never double-booked on a day
  const off = dayCursor % 3; dayCursor++;
  const body = items.map((it) => {
    const blk = doc.blocks[(it.week + off) % doc.blocks.length];
    return { pass: it.pass, child: kids[it.kidIdx].name, childId: kids[it.kidIdx].id, dates: blk.sessions.slice(0, DAYS[it.pass]).map((x: any) => x.date) };
  });
  const r = await apiPost<{ bookings: any[] }>("/api/my/bookings", tok, { listingId: LID, blockId: doc.blocks[off % doc.blocks.length].id, method: "card", items: body });
  const mine = await apiFetch<any[]>("/api/my/bookings", tok);
  const rows = r.bookings.map((b) => mine.find((m) => m.ref === b.ref) ?? b);
  const amt = r2(rows.reduce((s, b) => s + Number(b.amount ?? 0), 0));
  const offT = r2(rows.reduce((s, b) => s + Number(b.discountOff ?? 0), 0));
  const names = [...new Set(rows.flatMap((b) => b.discountNames ?? []))];
  return { amt, off: offT, names, rows };
}
const setRules = (rs: Rule[]) => apiFetch(`/api/listings/${LID}`, OP, { method: "PUT", body: JSON.stringify({ discounts: rs.map((r, i) => ({ id: `r${i}x${Date.now()}`, kind: r.kind, name: "", passNames: r.passNames ?? [], enabled: true, appliesTo: "all", moreThan: r.moreThan ?? (r.kind === "session" ? 3 : 1), method: r.method, value: r.value, beforeDate: r.beforeDate ?? "" })) }) });
(async () => {
  const table: string[] = []; let n = 0, bad = 0;
  const combos: [string, string][] = [];
  for (const rs of Object.keys(RULESETS)) for (const bk of Object.keys(BASKETS)) combos.push([rs, bk]);
  // 12 x 6 = 72 scenarios; take all that make sense (skip none)
  for (const rs of Object.keys(RULESETS)) {
    if (process.env.ONLY && !rs.includes(process.env.ONLY.split('-')[0].replace('DISC_',''))) continue;
    await setRules(RULESETS[rs]); await new Promise((r) => setTimeout(r, 400));
    for (const bk of Object.keys(BASKETS)) {
      const id = `DISC-${rs}-${bk}`; if (process.env.ONLY && !id.includes(process.env.ONLY)) continue; n++;
      await check(id, async () => {
        const items = BASKETS[bk]; const nKids = Math.max(...items.map((i) => i.kidIdx)) + 1;
        const f = await newFamily(nKids);
        const exp = oracle(RULESETS[rs], items, false);
        const got = await runBasket(f.tok, f.kids, items);
        table.push(`${id}\tgross ${exp.gross}\texpected ${exp.total} (off ${exp.off})\tAPI ${got.amt} (off ${got.off})\t${got.names.join("; ")}`);
        if (Math.abs(got.amt - exp.total) > 0.02 || Math.abs(got.off - exp.off) > 0.02) { bad++; throw new Error(`expected £${exp.total} (off £${exp.off}) but the API charged £${got.amt} (off £${got.off}) [${got.names.join("; ")}]`); }
        return `gross £${exp.gross}: expected £${exp.total}, API £${got.amt}, off £${got.off} ${got.names.length ? "[" + got.names.join("; ") + "]" : ""}`;
      });
    }
  }
  fs.writeFileSync(path.join(OUT, "disc-sweep.tsv"), table.join("\n"));
  console.log(`SWEEP DONE: ${n} scenarios, ${bad} mismatches`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
