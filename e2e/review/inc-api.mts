// INC API probe: permissions, validation, notifications. run: NEXT_PUBLIC_API_URL=http://localhost:4011 tsx e2e/review/inc-api.mts <acc.json>
import fs from "node:fs";
import { fbSignIn } from "../helpers/accounts";

const A = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const API = "http://localhost:4011";
const call = async (path: string, tok: string, method = "GET", body?: unknown) => {
  const r = await fetch(API + path, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j: any; try { j = JSON.parse(t); } catch { j = t; }
  return { s: r.status, j };
};
const tok = async (e: string) => (await fbSignIn(e)).idToken;
const [CA, CB, S1, S2, P] = await Promise.all([A.A.email, A.B.email, A.staff1.email, A.staff2.email, A.parent.email].map(tok));
const today = new Date().toISOString().slice(0, 10);
const base = { date: today, time: "10:15", childName: A.kids.booked, childId: A.kidIds.booked, description: "Fell off the climbing frame and grazed knee", severity: "moderate" };
const log = (k: string, v: unknown) => console.log(k.padEnd(46), JSON.stringify(v));

const acc = await call("/api/incidents", CA, "POST", { ...base, kind: "accident", injury: "Graze", bodyPart: "Knee", treatment: "Cleaned; plaster", firstAider: "Sam", location: "Hall", bodyMap: [{ view: "front", x: 40, y: 70, note: "left knee" }], parentNotified: true, followUp: "Check tomorrow" });
log("company POST accident", acc.s);
const s1 = await call("/api/incidents", S1, "POST", { ...base, kind: "incident", incidentType: "Behaviour", description: "Pushed another child", actionTaken: "Talked it through" });
log("staff1 POST incident (internal)", s1.s);
const s1s = await call("/api/incidents", S1, "POST", { ...base, kind: "incident", incidentType: "Behaviour", description: "Shared one", shareWithParent: true });
log("staff1 POST incident (shared)", s1s.s);
await new Promise((r) => setTimeout(r, 2500));
const pl = await call("/api/incidents", P);
log("parent GET kinds", pl.j.map((x: any) => `${x.kind}:${x.description.slice(0, 12)}`));
log("auto-notified stamp on company list", (await call("/api/incidents?kind=accident", CA)).j.map((x: any) => `${x.parentNotified}:${x.parentNotifiedHow}`));
const bell = await call("/api/notifications", P);
log("parent bell", bell.j.notifications?.map((n: any) => n.title));
const tbell = await call("/api/notifications", CA);
log("company bell", tbell.j.notifications?.map((n: any) => n.title));

log("staff2 PUT staff1 record (expect 403)", (await call(`/api/incidents/${s1.j.id}`, S2, "PUT", { description: "hacked" })).s);
log("staff1 PUT own record", (await call(`/api/incidents/${s1.j.id}`, S1, "PUT", { description: "Pushed another child (edited)" })).s);
log("staff1 PUT accident by company (403)", (await call(`/api/incidents/${acc.j.id}`, S1, "PUT", { description: "x" })).s);
log("staff1 DELETE own (403)", (await call(`/api/incidents/${s1.j.id}`, S1, "DELETE")).s);
log("staff2 GET list count", (await call("/api/incidents", S2)).j.length);
log("company B GET list", (await call("/api/incidents", CB)).j.length);
log("company B PUT A record (404)", (await call(`/api/incidents/${acc.j.id}`, CB, "PUT", { description: "x" })).s);
log("company B DELETE A record (404)", (await call(`/api/incidents/${acc.j.id}`, CB, "DELETE")).s);
log("company B POST A's child (403)", (await call("/api/incidents", CB, "POST", { ...base, kind: "accident" })).s);
log("company B POST walk-in no childId", (await call("/api/incidents", CB, "POST", { ...base, childId: undefined, childName: "Walk In", kind: "accident" })).s);
log("company B note on A rec (404)", (await call(`/api/incidents/${acc.j.id}/note`, CB, "POST", { text: "hi" })).s);
log("company B dossier A rec (404)", (await call(`/api/incidents/${acc.j.id}/dossier`, CB)).s);
log("parent POST (403)", (await call("/api/incidents", P, "POST", { ...base, kind: "accident" })).s);
log("parent PUT (404/403)", (await call(`/api/incidents/${acc.j.id}`, P, "PUT", { description: "x" })).s);
log("parent DELETE", (await call(`/api/incidents/${acc.j.id}`, P, "DELETE")).s);
log("parent ack", (await call(`/api/incidents/${acc.j.id}/acknowledge`, P, "POST", {})).s);
log("parent note", (await call(`/api/incidents/${acc.j.id}/note`, P, "POST", { text: "Thanks, is she OK?" })).s);
log("parent note on internal incident (leak?)", (await call(`/api/incidents/${s1.j.id}/note`, P, "POST", { text: "peek" })).s);
log("company acknowledge (403)", (await call(`/api/incidents/${acc.j.id}/acknowledge`, CA, "POST", {})).s);
log("company note", (await call(`/api/incidents/${acc.j.id}/note`, CA, "POST", { text: "She is fine" })).s);
log("bad date", (await call("/api/incidents", CA, "POST", { ...base, kind: "accident", date: "2026-02-31" })).s);
log("future date accepted?", (await call("/api/incidents", CA, "POST", { ...base, kind: "accident", date: "2030-01-01" })).s);
log("empty description", (await call("/api/incidents", CA, "POST", { ...base, kind: "accident", description: "  " })).s);
log("bad kind", (await call("/api/incidents", CA, "POST", { ...base, kind: "nope" })).s);
log("html in description", (await call("/api/incidents", CA, "POST", { ...base, kind: "accident", description: "<script>alert(1)</script>" })).s);
log("edit w/ notifyParentOfEdit", (await call(`/api/incidents/${acc.j.id}`, CA, "PUT", { treatment: "Plaster", notifyParentOfEdit: true })).s);
log("edit quiet", (await call(`/api/incidents/${acc.j.id}`, CA, "PUT", { followUp: "quiet change", notifyParentOfEdit: false })).s);
await new Promise((r) => setTimeout(r, 2000));
log("parent bell after", (await call("/api/notifications", P)).j.notifications?.map((n: any) => n.title));
log("company bell after", (await call("/api/notifications", CA)).j.notifications?.map((n: any) => n.title));
log("company DELETE accident", (await call(`/api/incidents/${acc.j.id}`, CA, "DELETE")).s);
log("parent list after delete", (await call("/api/incidents", P)).j.length);
fs.writeFileSync(process.argv[2].replace(".json", "-recs.json"), JSON.stringify({ s1: s1.j.id, s1s: s1s.j.id }));
process.exit(0);
