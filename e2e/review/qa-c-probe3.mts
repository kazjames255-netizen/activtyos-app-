import { loadAccounts } from "../helpers/env";
import { fbSignIn } from "../helpers/accounts";
const a = loadAccounts().accounts;
const API = "http://localhost:4013";
async function call(tok: string, method: string, path: string, body?: unknown) {
  const r = await fetch(API + path, { method, headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text(); let j: any; try { j = JSON.parse(txt); } catch { j = txt; }
  return { s: r.status, j };
}
const tok = async (k: keyof typeof a) => (await fbSignIn(a[k].email)).idToken;
const [co, fr, fl, st, pa] = await Promise.all([tok("company"), tok("franchise"), tok("freelancer"), tok("staff"), tok("parent")]);
const log = (n: string, x: { s: number; j: any }) => console.log(n.padEnd(48), x.s, JSON.stringify(x.j).slice(0, 140));

const trips = (await call(co, "GET", "/api/trips")).j as any[];
const trip = trips[0]; const childId = trip.attendees[0].childId;
log("freelancer GET trips (other tenant)", await call(fl, "GET", "/api/trips"));
log("freelancer PUT company trip", await call(fl, "PUT", `/api/trips/${trip.id}`, { notes: "x" }));
log("freelancer DELETE company trip", await call(fl, "DELETE", `/api/trips/${trip.id}`));
log("franchise GET trips (hides HQ trip?)", await call(fr, "GET", "/api/trips"));
log("staff DELETE trip", await call(st, "DELETE", `/api/trips/${trip.id}`));
log("staff PUT askConsent=false", await call(st, "PUT", `/api/trips/${trip.id}`, { askConsent: false }));
log("parent GET /api/trips (operator route)", await call(pa, "GET", "/api/trips"));
log("parent consent bogus child", await call(pa, "POST", `/api/my/trips/${trip.id}/consent`, { childId: "nope", decision: "granted" }));
log("freelancer-as-parent? operator /my/trips consent", await call(fl, "POST", `/api/my/trips/${trip.id}/consent`, { childId, decision: "granted" }));
log("complete trip with pending consent", await call(co, "PUT", `/api/trips/${trip.id}`, { status: "completed" }));
log("operator forges granted", await call(co, "PUT", `/api/trips/${trip.id}`, { attendees: [{ ...trip.attendees[0], consent: "granted" }] }));
log("parent declines", await call(pa, "POST", `/api/my/trips/${trip.id}/consent`, { childId, decision: "declined" }));
log("operator overrides decline", await call(co, "PUT", `/api/trips/${trip.id}`, { attendees: [{ ...trip.attendees[0], consent: "granted" }] }));
log("parent grants", await call(pa, "POST", `/api/my/trips/${trip.id}/consent`, { childId, decision: "granted" }));
log("complete now", await call(co, "PUT", `/api/trips/${trip.id}`, { status: "completed" }));
log("trip bad date", await call(co, "POST", "/api/trips", { destination: "x", date: "2026-02-31" }));
log("trip XSS dest", await call(co, "POST", "/api/trips", { destination: "<img src=x onerror=alert(1)>", date: "2026-11-01", childNames: [] }));
// messages
const th = (await call(co, "GET", "/api/messages/threads")).j as any;
const threads = th.threads ?? th; const t0 = threads[0];
log("company threads", { s: 200, j: { n: threads.length, id: t0?.id, unread: t0?.unreadOperator ?? t0?.unread } });
log("freelancer GET company thread", await call(fl, "GET", `/api/messages/threads/${t0.id}`));
log("franchise GET HQ thread", await call(fr, "GET", `/api/messages/threads/${t0.id}`));
log("staff GET thread", await call(st, "GET", `/api/messages/threads/${t0.id}`));
const pth = (await call(pa, "GET", "/api/messages/threads")).j as any; const pthreads = pth.threads ?? pth;
log("parent threads", { s: 200, j: pthreads.map((x: any) => ({ id: x.id, unread: x.unreadParent ?? x.unread })) });
log("parent msg to unbooked tenant", await call(pa, "POST", "/api/messages", { tenantId: a.freelancer.tenantId, subject: "hi", body: "hello" }));
log("parent reads own thread", await call(pa, "GET", `/api/messages/threads/${pthreads[0].id}`));
log("parent threads after read", { s: 200, j: ((await call(pa, "GET", "/api/messages/threads")).j.threads ?? (await call(pa, "GET", "/api/messages/threads")).j).map((x: any) => ({ id: x.id, unread: x.unreadParent ?? x.unread })) });
log("empty body", await call(pa, "POST", "/api/messages", { tenantId: a.company.tenantId, subject: "s", body: "   " }));
log("body 20k chars", await call(pa, "POST", "/api/messages", { tenantId: a.company.tenantId, subject: "s", body: "a".repeat(20000) }));
log("operator msg to non-customer", await call(co, "POST", "/api/messages", { parentEmail: "nobody@activityos-test.com", body: "hi" }));
log("freelancer broadcast to company listing", await call(fl, "POST", "/api/messages/broadcast", { listingIds: ["x"], body: "hi" }));
