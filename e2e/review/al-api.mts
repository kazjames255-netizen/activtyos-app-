import { fbSignIn, apiFetch } from "../helpers/accounts";
import fs from "node:fs";
const acc = JSON.parse(fs.readFileSync(`${process.cwd()}/docs/home-visit-qa/AL/accounts.json`, "utf8"));
const tok = (await fbSignIn(acc.provider.email)).idToken;
const r: any = await apiFetch("/api/reconciliation", tok);
for (const it of r.items) console.log(it.ref, it.method, it.pay, "reconciled=" + it.reconciled, "refundState=" + it.refundState, "refunded=" + it.refundedAmount, "only=" + it.refundedOnly);
console.log("summary:", JSON.stringify({ count: r.summary.count, reconciledCount: r.summary.reconciledCount, outstanding: r.summary.outstanding, refunds: r.summary.refunds }));
console.log("refund rows:", r.refunds.map((x: any) => `${x.ref} ${x.method} ${x.via} ${x.amount}`).join(" | "));
process.exit(0);
