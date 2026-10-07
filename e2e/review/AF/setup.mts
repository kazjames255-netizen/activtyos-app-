// AF setup: throwaway freelancer provider with seeded money data on the isolated stack (API :4023). Everything @activityos-test.com.
// run (from this worktree): NEXT_PUBLIC_API_URL=http://localhost:4023 server/node_modules/.bin/tsx e2e/review/AF/setup.mts
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fbSignUp, apiPost, TEST_PASSWORD } from "../../helpers/accounts";
import { db } from "../../../server/src/firebase";
import { buildBooking } from "../../../features/bookings/mutations";
const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, "../../..");
const ts = Date.now().toString(36);
const email = `hvqa-af-${ts}-prov@activityos-test.com`;
const prov = await fbSignUp(email);
const bn = `HVQA-AF Provider ${ts}`;
const reg = await apiPost<{ tenantId: string }>("/api/register-role", prov.idToken, { role: "freelancer", businessName: bn, providerName: bn, providerNameMode: "business" });
execFileSync("npm", ["--prefix", `${ROOT}/server`, "run", "e2e-unwall", "--", reg.tenantId], { stdio: "inherit" });
const tenantId = reg.tenantId;
const now = new Date().toISOString();
const base = (n: number, o: Record<string, unknown>) => ({
  ...buildBooking({ booker: "Kaz (parent) James", email: `hvqa-af-${ts}-parent@activityos-test.com`, phone: "07700900123", child: "sally", age: 7, listing: "AF test camp", pass: "1 day pass", dates: "Mon 26 Oct 2026", method: "card", amount: 0.3 } as any, n, "AF"),
  tenantId, createdAt: now, answers: [], days: ["2026-10-26"], ...o,
});
const put = (b: Record<string, unknown>) => db.collection("bookings").doc(`${tenantId}_${b.ref}`).set(b);
const pay = (id: string, o: Record<string, unknown>) => db.collection("payments").doc(id).set({ tenantId, currency: "gbp", createdAt: now, ...o });
// 1. card booking, cancelled and refunded to the card (the APF-10330 case)
await put(base(1001, { status: "Cancelled", pay: "Refunded", amountPaid: 0.3, refundedApproved: 0.3, cancel: { on: "2026-10-07", by: "Provider", refund: "approved", amount: 0.3, refundVia: "card" }, paymentIntentId: "pi_af_1001" }));
await pay(`af-${ts}-c1`, { refs: ["AF-1001"], amount: 0.3, status: "succeeded", paymentIntentId: "pi_af_1001", method: "Card", email });
await pay(`af-${ts}-r1`, { refs: ["AF-1001"], type: "refund", amount: 0.3, status: "succeeded", paymentIntentId: "pi_af_1001", createdAt: new Date(Date.now() + 1000).toISOString() });
// 2. an ordinary paid card booking
await put(base(1002, { status: "Confirmed", pay: "Paid", amountPaid: 0.3, paymentIntentId: "pi_af_1002" }));
await pay(`af-${ts}-c2`, { refs: ["AF-1002"], amount: 0.3, status: "succeeded", paymentIntentId: "pi_af_1002", method: "Card", email });
// 3. part refund
await put(base(1003, { amount: 1, status: "Confirmed", pay: "Partially refunded", amountPaid: 1, refundedApproved: 0.4, cancel: { on: "2026-10-07", by: "Provider", refund: "approved", amount: 0.4, refundVia: "card" }, paymentIntentId: "pi_af_1003" }));
await pay(`af-${ts}-c3`, { refs: ["AF-1003"], amount: 1, status: "succeeded", paymentIntentId: "pi_af_1003", method: "Card", email });
await pay(`af-${ts}-r3`, { refs: ["AF-1003"], type: "refund", amount: 0.4, status: "succeeded", paymentIntentId: "pi_af_1003", createdAt: new Date(Date.now() + 1000).toISOString() });
// 4. a bank-transfer booking, paid (must NOT appear on the card page)
await put(base(1004, { method: "bank", status: "Confirmed", pay: "Paid", amountPaid: 0.3 }));
// 5. a plain card booking nobody has paid yet (owes £0.60): the Resend invoice / Chase target
await put(base(1005, { amount: 0.6, status: "Confirmed", pay: "Unpaid", method: "card" }));
await db.collection("tenants").doc(tenantId).update({ nextBid: 1100 }).catch(() => {});
fs.writeFileSync("/tmp/af-accounts.json", JSON.stringify({ ts, email, password: TEST_PASSWORD, tenantId, businessName: bn, parent: `hvqa-af-${ts}-parent@activityos-test.com` }, null, 2));
console.log("seeded", email, tenantId);
process.exit(0);
