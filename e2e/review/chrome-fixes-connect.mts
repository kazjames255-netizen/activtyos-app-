// Calls POST /api/payments/connect as the throwaway provider and prints what the provider would see. API :4014.
// run: NEXT_PUBLIC_API_URL=http://localhost:4014 server/node_modules/.bin/tsx e2e/review/chrome-fixes-connect.mts
import fs from "node:fs";
import { fbSignIn } from "../helpers/accounts";

const A = JSON.parse(fs.readFileSync(process.cwd() + "/e2e/review/chrome-fixes-accounts.json", "utf8"));
const s = await fbSignIn(A.email);
const r = await fetch("http://localhost:4014/api/payments/connect", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.idToken}` }, body: "{}" });
console.log(r.status, await r.text());
