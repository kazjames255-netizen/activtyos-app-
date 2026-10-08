// Compare every place a booking's money/dates appear. Prints one block per case and flags differences.
import fs from "node:fs";
import { call, load, tokFor, mails, sleep, SCRATCH } from "./mb-lib";
const money = (t: string) => [...t.matchAll(/£\s?(\d+(?:,\d{3})*(?:\.\d{2})?)/g)].map((m) => Number(m[1].replace(/,/g, "")));
(async () => {
  const S = load();
  const pt = await tokFor(S.accts.prov.email), t1 = await tokFor(S.accts.parent.email), t2 = await tokFor(S.accts.parent2.email);
  const opList: any[] = (await call(pt, "GET", "/api/bookings")).json;
  const rec: any = (await call(pt, "GET", "/api/reconciliation")).json;
  const dash: any = (await call(pt, "GET", "/api/dashboard")).json;
  const bell: any[] = (await call(pt, "GET", "/api/notifications")).json.notifications;
  const my1: any[] = (await call(t1, "GET", "/api/my/bookings")).json, my2: any[] = (await call(t2, "GET", "/api/my/bookings")).json;
  const myAll = [...my1, ...my2];
  const ml = mails();
  const flags: string[] = [];
  const flag = (id: string, msg: string) => { flags.push(`${id}: ${msg}`); console.log("   !! " + msg); };
  for (const [id, b] of Object.entries<any>(S.bookings)) {
    if (b.status >= 300) continue;
    const c = b.case; const L = S.listings[c.l];
    console.log(`\n== ${id}  [${c.m}] ${c.kids.join("+")} ${c.pass} exp £${c.exp} refs ${b.refs.join(",")}`);
    const ops = opList.filter((x) => b.refs.includes(x.ref)), recs = rec.items.filter((x: any) => b.refs.includes(x.ref)), mys = myAll.filter((x) => b.refs.includes(x.ref));
    const sum = (a: any[], k = "amount") => Math.round(a.reduce((s, x) => s + (x[k] ?? 0), 0) * 100) / 100;
    const row = { create: sum(b.resp.bookings), operator: sum(ops), recon: sum(recs), my: sum(mys), recOut: sum(recs, "outstanding") };
    console.log("   money:", JSON.stringify(row));
    for (const [k, v] of Object.entries(row)) if (k !== "recOut" && Math.abs((v as number) - c.exp) > 0.005) flag(id, `${k} total £${v} != expected £${c.exp}`);
    if (Math.abs(row.recOut - c.exp) > 0.005) flag(id, `reconciliation outstanding £${row.recOut} != £${c.exp}`);
    const st = [...new Set(ops.map((x) => `${x.status}/${x.pay}/${x.method}`))]; console.log("   op status:", st.join(" | "));
    const mySt = [...new Set(mys.map((x) => `${x.status}/${x.pay}/${x.method}`))]; if (mySt.join() !== st.join()) flag(id, `parent view status ${mySt.join("|")} != operator ${st.join("|")}`);
    // listing price
    const lp = L.passes.find((p: any) => p.name === c.pass);
    console.log("   listing price for pass:", lp?.price, "x kids", c.kids.length);
    // emails
    const pe = ml.filter((m) => m.to.includes(c.p === "p2" ? "parent2" : "parent-r1") && b.refs.some((r: string) => m.text.includes(r) || m.html.includes(r)));
    const ve = ml.filter((m) => m.to.includes("prov") && b.refs.some((r: string) => m.subject.replace(/\s/g, "").includes(r)));
    for (const m of pe) { console.log("   parent mail:", m.subject.replace(/\s+/g, " "), "| £", money(m.text).join(",")); if (!money(m.text).includes(c.exp) && !(typeof c.exp === "number" && money(m.text).includes(Math.round(c.exp)))) flag(id, `parent email lacks total £${c.exp} (has ${money(m.text).join(",") || "none"})`); }
    if (!pe.length) flag(id, "NO parent email found for this booking");
    for (const m of ve) console.log("   provider mail:", m.subject.replace(/\s+/g, " "), "| £", money(m.text).join(","));
    const bl = bell.filter((n) => b.refs.includes(n.ref));
    for (const n of bl) { console.log("   bell:", n.title, "|", n.body); const mm = money(n.body); if (mm.length && Math.abs(mm[0] - sum(ops.filter((o) => o.ref === n.ref))) > 0.005 && !(bl.length === 1 && Math.abs(mm[0] - c.exp) < 0.005)) flag(id, `bell £${mm[0]} vs booking £${sum(ops.filter((o) => o.ref === n.ref))}`); }
    if (!bl.length) flag(id, "no provider bell");
  }
  const totalExp = Object.values<any>(S.bookings).filter((b) => b.status < 300).reduce((s, b) => s + b.case.exp, 0);
  console.log("\nTOTAL expected", totalExp, "dashboard outstanding", dash.money.outstanding, "recon outstanding", rec.summary.outstanding, "recon count", rec.summary.count);
  fs.writeFileSync(`${SCRATCH}/flags.txt`, flags.join("\n"));
  console.log("\nFLAGS:\n" + flags.join("\n"));
  process.exit(0);
})();
