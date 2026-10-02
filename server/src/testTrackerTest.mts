// API test for the HQ test tracker: platform can record and read results, anyone else is refused, bad ids are rejected, history accumulates.
// Uses a throwaway check id and removes it afterwards.  Run: cd server && npx tsx --tsconfig ../tsconfig.json src/testTrackerTest.mts
import express from "express";
import type { AddressInfo } from "node:net";
import { db } from "./firebase";
import { testTracker } from "./routes/testTracker";

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  const role = String(req.header("x-test-role") ?? "company");
  (req as unknown as { auth: { role: string } }).auth = { role };
  (req as unknown as { user: { email: string } }).user = { email: "tester@activityos-test.com" };
  next();
});
app.use("/t", testTracker);
const srv = app.listen(0);
const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/t`;
const ID = "ZZ-9991";
let pass = 0, total = 0;
const ok = (name: string, cond: boolean) => { total++; if (cond) pass++; else console.error("FAIL:", name); };
const call = (path: string, role: string, method = "GET", body?: unknown) =>
  fetch(base + path, { method, headers: { "x-test-role": role, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

try {
  ok("company is refused (GET)", (await call("/", "company")).status === 403);
  ok("parent is refused (PUT)", (await call(`/${ID}`, "parent", "PUT", { status: "pass" })).status === 403);
  ok("bad id is rejected", (await call("/not-an-id", "platform", "PUT", { status: "pass" })).status === 400);
  ok("bad status is rejected", (await call(`/${ID}`, "platform", "PUT", { status: "great" })).status === 400);
  const put1 = await call(`/${ID}`, "platform", "PUT", { status: "fail", byAccount: { company: "fail", freelancer: "pass" }, note: "first try", bug: "button missing" });
  ok("platform can record a failure", put1.status === 200);
  const put2 = await call(`/${ID}`, "platform", "PUT", { status: "fixed", byAccount: { company: "fixed", freelancer: "pass" }, note: "retest please", bug: "button missing", fix: "added the button" });
  ok("platform can mark it fixed", put2.status === 200);
  const list = (await (await call("/", "platform")).json()) as { results: { checkId: string; status: string; fix?: string; history?: unknown[]; byAccount?: Record<string, string> }[] };
  const mine = list.results.find((r) => r.checkId === ID);
  ok("the result is stored and listed", !!mine && mine.status === "fixed" && mine.fix === "added the button");
  ok("per-account results are kept", mine?.byAccount?.company === "fixed" && mine?.byAccount?.freelancer === "pass");
  ok("history keeps both entries", (mine?.history?.length ?? 0) === 2);
} finally {
  await db.collection("testTrackerResults").doc(ID).delete().catch(() => {});
  srv.close();
}
console.log(`testTracker: ${pass}/${total} passed`);
process.exit(pass === total ? 0 : 1);
