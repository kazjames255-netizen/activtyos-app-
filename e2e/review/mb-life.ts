// Lifecycle: provider records payments, parents cancel (one cash, one bank), code re-use check. Then dumps every view for the touched bookings.
import { call, load, save, tokFor, mails, sleep } from "./mb-lib";
(async () => {
  const S = load();
  const pt = await tokFor(S.accts.prov.email), t1 = await tokFor(S.accts.parent.email), t2 = await tokFor(S.accts.parent2.email);
  const ref = (id: string) => S.bookings[id].refs[0];
  const log: any = {};
  const before = mails().length;
  // 1 payments
  log.payFull = await call(pt, "POST", `/api/bookings/${ref("camp-bank-1")}/record-payment`, { amount: 150, method: "Bank transfer", reference: ref("camp-bank-1") });
  log.payPartial = await call(pt, "POST", `/api/bookings/${ref("addons-bank-1")}/record-payment`, { amount: 100, method: "Bank transfer", reference: ref("addons-bank-1") });
  log.payCash = await call(pt, "POST", `/api/bookings/${ref("sibling-cash-2")}/record-payment`, { amount: 36, method: "Cash on the day" });
  log.overpay = await call(pt, "POST", `/api/bookings/${ref("oneoff-bank-1")}/record-payment`, { amount: 99, method: "Bank transfer" });
  // 2 cancels
  log.cancelBank = await call(t1, "POST", `/api/my/bookings/${ref("oneoff-bank-1")}/cancel`, { msg: "QA cancel (bank)" });
  log.cancelCash = await call(t2, "POST", `/api/my/bookings/${ref("term-cash-2")}/cancel`, { msg: "QA cancel (cash)" });
  // cancel a paid one too (bank, paid in full) to see refund wording
  log.cancelPaid = await call(t1, "POST", `/api/my/bookings/${ref("camp-bank-1")}/cancel`, { msg: "QA cancel paid", refundBank: { accountName: "Pat Parent", sortCode: "20-57-44", accountNumber: "63437582" } });
  // 3 code re-use
  log.codeP1 = await call(t1, "POST", "/api/discounts/validate", { tenantId: S.accts.prov.tenantId, code: "QAF5OFF", subtotal: 150 });
  log.codeP2 = await call(t2, "POST", "/api/discounts/validate", { tenantId: S.accts.prov.tenantId, code: "QAF5OFF", subtotal: 150 });
  await sleep(4000);
  for (const [k, v] of Object.entries<any>(log)) console.log(k, v.status, JSON.stringify(v.json).slice(0, 700));
  console.log("\nNEW MAILS");
  for (const m of mails().slice(before)) console.log("-", m.to, "|", m.subject.replace(/\s+/g, " "), "\n   ", m.text.replace(/^.*?Content-Transfer-Encoding: quoted-printable/, "").slice(0, 900));
  const bell = (await call(pt, "GET", "/api/notifications")).json.notifications.slice(0, 8);
  console.log("\nPROVIDER BELL"); for (const n of bell) console.log("-", n.title, "|", n.body);
  const pb = (await call(t1, "GET", "/api/notifications")).json.notifications?.slice(0, 6) ?? [];
  console.log("\nPARENT1 BELL"); for (const n of pb) console.log("-", n.title, "|", n.body);
  for (const id of ["camp-bank-1", "oneoff-bank-1", "term-cash-2", "addons-bank-1", "sibling-cash-2"]) {
    const r = ref(id); const op = (await call(pt, "GET", `/api/bookings/${r}`)).json;
    console.log("\nOP", id, r, JSON.stringify({ status: op.status, pay: op.pay, amount: op.amount, amountPaid: op.amountPaid, cancel: op.cancel }));
  }
  const rec = (await call(pt, "GET", "/api/reconciliation")).json, dash = (await call(pt, "GET", "/api/dashboard")).json;
  console.log("\nRECON summary", JSON.stringify(rec.summary).slice(0, 900));
  console.log("DASH money", JSON.stringify(dash.money));
  for (const x of rec.items.filter((i: any) => ["camp-bank-1", "oneoff-bank-1", "term-cash-2", "addons-bank-1", "sibling-cash-2"].some((id) => S.bookings[id].refs.includes(i.ref)))) console.log("RECON item", x.ref, x.status, x.pay, "amt", x.amount, "paid", x.amountPaid, "out", x.outstanding, "refund", x.refundedAmount, x.refundState, "needsRefund", x.needsRefund);
  const inc = (await call(pt, "GET", "/api/income")).json; console.log("INCOME", JSON.stringify(inc.summary));
  const reg = (await call(pt, "GET", `/api/registers?date=2026-10-28`)).json;
  console.log("REGISTER 28 Oct:", JSON.stringify(reg.map((b: any) => ({ l: b.listingName, a: b.attendees.map((x: any) => `${x.bookingRef}:${x.children.map((c: any) => c.name).join("+")}:${x.bookingStatus}`) }))));
  const reg2 = (await call(pt, "GET", `/api/registers?date=2026-11-11`)).json;
  console.log("REGISTER 11 Nov:", JSON.stringify(reg2.map((b: any) => ({ l: b.listingName, a: b.attendees.map((x: any) => `${x.bookingRef}:${x.children.map((c: any) => c.name).join("+")}:${x.bookingStatus}`) }))));
  S.life = Object.fromEntries(Object.entries<any>(log).map(([k, v]) => [k, v.status]));
  save(S); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
