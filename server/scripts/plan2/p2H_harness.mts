// Plan-2 test harness (agent H — days 5-8). Builds the SAME express chain as
// src/index.ts (attachRole → enforceSubscription → enforceAccess → routers)
// but replaces requireAuth with an injected user (x-test-uid / x-test-email
// headers), so the real route code runs in-process against a THROWAWAY tenant.
// Nothing here touches real tenants; cleanup() deletes every doc the run made.
//
//   cd server && npx tsx _t_p2H_<script>.mts
import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { db, auth as fbAuth } from "../../src/firebase";
import { attachRole, attachRoleOptional } from "../../src/middleware/role";
import { enforceSubscription } from "../../src/middleware/subscription";
import { enforceAccess } from "../../src/middleware/access";
import { blockBundles, passes, periods } from "../../src/routes/blockBundles";
import { blocks } from "../../src/routes/blocks";
import { bookings } from "../../src/routes/bookings";
import { customers } from "../../src/routes/customers";
import { invitePreview, invites } from "../../src/routes/invites";
import { referencePublic, references } from "../../src/routes/references";
import { library, libraryPublic } from "../../src/routes/library";
import { listings } from "../../src/routes/listings";
import { my } from "../../src/routes/my";
import { staffAnnouncements } from "../../src/routes/staffAnnouncements";
import { learning } from "../../src/routes/learning";
import { leave } from "../../src/routes/leave";
import { rota } from "../../src/routes/rota";
import { timeclock } from "../../src/routes/timeclock";
import { payroll } from "../../src/routes/payroll";
import { onboarding } from "../../src/routes/onboarding";
import { credentials } from "../../src/routes/credentials";
import { images, uploads } from "../../src/routes/uploads";
import { invoices, invoicePublic } from "../../src/routes/invoices";
import { income } from "../../src/routes/income";
import { suppliers } from "../../src/routes/suppliers";
import { incidents } from "../../src/routes/incidents";
import { meals } from "../../src/routes/meals";
import { moments } from "../../src/routes/moments";
import { medications } from "../../src/routes/medications";
import { childFiles } from "../../src/routes/childFiles";
import { feedback } from "../../src/routes/feedback";
import { referral, referralsAdmin } from "../../src/routes/referral";
import { memberships, membershipsAdmin } from "../../src/routes/memberships";
import { platform } from "../../src/routes/platform";
import { leads, leadsPublic } from "../../src/routes/leads";
import { providersPublic } from "../../src/routes/providers";
import { analytics } from "../../src/routes/analytics";
import { reconciliation } from "../../src/routes/reconciliation";
import { dashboard } from "../../src/routes/dashboard";
import { growth } from "../../src/routes/growth";
import { discounts } from "../../src/routes/discounts";
import { splitfees } from "../../src/routes/splitfees";
import { hoOverview } from "../../src/routes/hoOverview";
import { franchises } from "../../src/routes/franchises";
import { account } from "../../src/routes/account";
import { privacy } from "../../src/routes/privacy";
import { emails } from "../../src/routes/emails";
import { mealOptions, mealOrders } from "../../src/routes/mealsShop";
import { mealMenus } from "../../src/routes/mealMenus";
import { documents } from "../../src/routes/documents";
import { compliance } from "../../src/routes/compliance";
import { expenses } from "../../src/routes/expenses";
import { expenseClaims } from "../../src/routes/expenseClaims";
import { appraisals } from "../../src/routes/appraisals";
import { locationStaff } from "../../src/routes/locationStaff";
import { purchasing } from "../../src/routes/purchasing";
import { subscription } from "../../src/routes/subscription";
import { wallet } from "../../src/routes/wallet";
import { notifications } from "../../src/routes/notifications";
import { posts } from "../../src/routes/posts";
import { messages } from "../../src/routes/messages";
import { shifts } from "../../src/routes/shifts";
import { reviews } from "../../src/routes/reviews";
import { availability } from "../../src/routes/availability";
import { tasks } from "../../src/routes/tasks";
import { timetables } from "../../src/routes/timetables";
import { trips } from "../../src/routes/trips";
import { calendarEvents } from "../../src/routes/calendarEvents";
import { inventory } from "../../src/routes/inventory";
import { registerRole } from "../../src/routes/registerRole";
import { ratios } from "../../src/routes/ratios";
import { registers } from "../../src/routes/registers";
import { children } from "../../src/routes/children";
import { platformNotifications } from "../../src/routes/platformNotifications";
import { payments } from "../../src/routes/payments";
import { me, tenants } from "../../src/routes/tenants";
import { platformLeads } from "../../src/routes/platformLeads";
import { platformSupport, supportReport } from "../../src/routes/platformSupport";

export { db, fbAuth };

export interface Actor { uid: string; email: string; name?: string }

function injectUser(req: Request, res: Response, next: NextFunction) {
  const uid = req.header("x-test-uid");
  if (!uid) { res.status(401).json({ error: "Missing Authorization bearer token" }); return; }
  req.user = { uid, email: req.header("x-test-email") || undefined, name: req.header("x-test-name") || undefined, auth_time: Math.floor(Date.now() / 1000) } as never;
  next();
}
function injectOptional(req: Request, _res: Response, next: NextFunction) {
  const uid = req.header("x-test-uid");
  if (uid) req.user = { uid, email: req.header("x-test-email") || undefined, auth_time: Math.floor(Date.now() / 1000) } as never;
  next();
}

export function buildApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/invites", invitePreview);
  app.use("/api/images", images);
  app.use("/api/listings", injectOptional, attachRoleOptional, enforceAccess, listings);
  app.use("/api/public/library", injectOptional, libraryPublic);
  app.use("/api/public/invoice", invoicePublic);
  app.use("/api/public/reference", referencePublic);
  app.use("/api/leads", leadsPublic);
  app.use("/api/providers", providersPublic);
  app.use("/api", injectUser, attachRole);
  app.use("/api", enforceSubscription);
  app.use("/api", enforceAccess);
  app.use("/api/bookings", bookings);
  app.use("/api/customers", customers);
  app.use("/api/blocks", blocks);
  app.use("/api/periods", periods);
  app.use("/api/passes", passes);
  app.use("/api/block-bundles", blockBundles);
  app.use("/api/library", library);
  app.use("/api/payments", payments);
  app.use("/api/registers", registers);
  app.use("/api/children", children);
  app.use("/api/platform/notifications", platformNotifications);
  app.use("/api/leads", leads);
  app.use("/api/ratios", ratios);
  app.use("/api/incidents", incidents);
  app.use("/api/medications", medications);
  app.use("/api/meals", meals);
  app.use("/api/moments", moments);
  app.use("/api/reconciliation", reconciliation);
  app.use("/api/tasks", tasks);
  app.use("/api/timetables", timetables);
  app.use("/api/trips", trips);
  app.use("/api/calendar-events", calendarEvents);
  app.use("/api/inventory", inventory);
  app.use("/api/shifts", shifts);
  app.use("/api/rota", rota);
  app.use("/api/timeclock", timeclock);
  app.use("/api/payroll", payroll);
  app.use("/api/onboarding", onboarding);
  app.use("/api/credentials", credentials);
  app.use("/api/staff-announcements", staffAnnouncements);
  app.use("/api/leave", leave);
  app.use("/api/learning", learning);
  app.use("/api/reviews", reviews);
  app.use("/api/availability", availability);
  app.use("/api/dashboard", dashboard);
  app.use("/api/growth", growth);
  app.use("/api/discounts", discounts);
  app.use("/api/splitfees", splitfees);
  app.use("/api/franchises", franchises);
  app.use("/api/ho", hoOverview);
  app.use("/api/account", account);
  app.use("/api/privacy", privacy);
  app.use("/api/emails", emails);
  app.use("/api/meal-options", mealOptions);
  app.use("/api/meal-orders", mealOrders);
  app.use("/api/meal-menus", mealMenus);
  app.use("/api/documents", documents);
  app.use("/api/compliance", compliance);
  app.use("/api/expenses", expenses);
  app.use("/api/expense-claims", expenseClaims);
  app.use("/api/appraisals", appraisals);
  app.use("/api/location-staff", locationStaff);
  app.use("/api/income", income);
  app.use("/api/suppliers", suppliers);
  app.use("/api/purchasing", purchasing);
  app.use("/api/invoices", invoices);
  app.use("/api/subscription", subscription);
  app.use("/api/wallet", wallet);
  app.use("/api/notifications", notifications);
  app.use("/api/posts", posts);
  app.use("/api/messages", messages);
  app.use("/api/uploads", uploads);
  app.use("/api/my/feedback", feedback);
  app.use("/api/my/files", childFiles);
  app.use("/api/my/referral", referral);
  app.use("/api/my/memberships", memberships);
  app.use("/api/my", my);
  app.use("/api/referrals", referralsAdmin);
  app.use("/api/memberships", membershipsAdmin);
  app.use("/api/register-role", registerRole);
  app.use("/api/invites", invites);
  app.use("/api/references", references);
  app.use("/api/tenants", tenants);
  app.use("/api/me", me);
  app.use("/api/platform/leads", platformLeads);
  app.use("/api/platform/support", platformSupport);
  app.use("/api/support/report", supportReport);
  app.use("/api/platform", platform);
  app.use("/api/analytics", analytics);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const e = err as { type?: string; message?: string };
    if (e?.type === "entity.too.large") { res.status(413).json({ error: "too large" }); return; }
    console.error("[harness 500]", e?.message ?? err);
    res.status(500).json({ error: "Internal server error", detail: e?.message });
  });
  return app;
}

let base = "";
let server: import("node:http").Server | null = null;
export async function start(): Promise<string> {
  if (base) return base;
  const app = buildApp();
  await new Promise<void>((r) => { server = app.listen(0, "127.0.0.1", () => r()); });
  const addr = server!.address() as { port: number };
  base = `http://127.0.0.1:${addr.port}`;
  return base;
}
export function stop() { server?.close(); }

export interface Res { status: number; json: any; text?: string }
export async function api(actor: Actor | null, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> {
  if (!base) await start();
  const h: Record<string, string> = { "Content-Type": "application/json", ...headers };
  if (actor) { h["x-test-uid"] = actor.uid; h["x-test-email"] = actor.email; if (actor.name) h["x-test-name"] = actor.name; }
  const r = await fetch(`${base}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, json, text };
}

// ── Throwaway world ──────────────────────────────────────────────────────
export const RUN = `p2h${Date.now().toString(36)}`;
export const created = { tenants: [] as string[], uids: [] as string[], emails: [] as string[] };

export async function mkTenant(type: "company" | "freelancer", name: string): Promise<{ tenantId: string; owner: Actor }> {
  const ref = db.collection("tenants").doc();
  const uid = `${RUN}-own-${ref.id.slice(0, 6)}`;
  const email = `${uid}@p2h.test`.toLowerCase();
  await ref.set({ name, type, ownerUid: uid, createdAt: new Date().toISOString(), nextBid: 10312, subscription: { status: "active", plan: type === "company" ? "franchise" : "freelancer", since: new Date().toISOString() }, _p2h: RUN });
  await db.collection("users").doc(uid).set({ email, role: type, chosen: true, tenantId: ref.id, name: `${name} owner` });
  await db.collection("libraries").doc(ref.id).set({ tenantId: ref.id, settings: { providerName: name, providerNameMode: "business", billing: { businessName: name, email } } });
  created.tenants.push(ref.id); created.uids.push(uid); created.emails.push(email);
  return { tenantId: ref.id, owner: { uid, email, name: `${name} owner` } };
}

export async function mkFranchise(tenantId: string, name: string): Promise<{ franchiseId: string; actor: Actor }> {
  const uid = `${RUN}-fr-${Math.random().toString(36).slice(2, 8)}`;
  const email = `${uid}@p2h.test`;
  await db.collection("users").doc(uid).set({ email, role: "franchise", chosen: true, tenantId, franchiseId: uid, franchiseName: name, name, franchiseArea: `${name} area` });
  created.uids.push(uid); created.emails.push(email);
  return { franchiseId: uid, actor: { uid, email, name } };
}

export async function mkStaff(tenantId: string, opts: { franchiseId?: string | null; name: string; lead?: boolean; staffRole?: string; permRole?: string; assignment?: { mode: string; ids: string[] } | null; jobTitle?: string }): Promise<Actor> {
  const uid = `${RUN}-st-${Math.random().toString(36).slice(2, 8)}`;
  const email = `${uid}@p2h.test`;
  await db.collection("users").doc(uid).set({ email, role: "staff", chosen: true, tenantId, franchiseId: opts.franchiseId ?? null, name: opts.name, lead: opts.lead === true, ...(opts.staffRole ? { staffRole: opts.staffRole } : {}), ...(opts.permRole ? { permRole: opts.permRole } : {}), ...(opts.jobTitle ? { jobTitle: opts.jobTitle } : {}), ...(opts.assignment ? { assignment: opts.assignment } : {}) });
  created.uids.push(uid); created.emails.push(email);
  return { uid, email, name: opts.name };
}

export async function mkParent(name: string): Promise<Actor> {
  const uid = `${RUN}-pa-${Math.random().toString(36).slice(2, 8)}`;
  const email = `${uid}@p2h.test`;
  await db.collection("users").doc(uid).set({ email, role: "parent", chosen: true, name });
  created.uids.push(uid); created.emails.push(email);
  return { uid, email, name };
}

export async function mkPlatform(): Promise<Actor> {
  const uid = `${RUN}-hq`;
  const email = `${uid}@p2h.test`;
  await db.collection("users").doc(uid).set({ email, role: "platform", chosen: true, name: "HQ test" });
  created.uids.push(uid); created.emails.push(email);
  return { uid, email, name: "HQ test" };
}

/** Set the Setup bag for a tenant (or a franchise's own copy). */
export async function setSettings(tenantId: string, franchiseId: string | null, patch: Record<string, unknown>) {
  const id = franchiseId ? `${tenantId}__fr__${franchiseId}` : tenantId;
  await db.collection("libraries").doc(id).set({ tenantId, settings: patch }, { merge: true });
  const { forgetSettings } = await import("../../src/middleware/access");
  forgetSettings(tenantId);
}

async function deleteDocs(refs: FirebaseFirestore.DocumentReference[]) {
  for (let i = 0; i < refs.length; i += 400) {
    const b = db.batch();
    refs.slice(i, i + 400).forEach((r) => b.delete(r));
    await b.commit();
  }
}

/** Delete everything the run created: any doc carrying one of our tenantIds,
 *  any doc whose id starts with one, our users, and notifications/prefs
 *  addressed to our emails/uids. */
export async function cleanup(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const cols = await db.listCollections();
  const tids = created.tenants;
  const emails = created.emails.map((e) => e.toLowerCase());
  const uids = created.uids;
  for (const c of cols) {
    const refs: FirebaseFirestore.DocumentReference[] = [];
    const seen = new Set<string>();
    const add = (d: FirebaseFirestore.QueryDocumentSnapshot) => { if (!seen.has(d.id)) { seen.add(d.id); refs.push(d.ref); } };
    for (let i = 0; i < tids.length; i += 30) {
      const chunk = tids.slice(i, i + 30);
      if (!chunk.length) continue;
      try { (await c.where("tenantId", "in", chunk).get()).docs.forEach(add); } catch { /* */ }
      for (const t of chunk) {
        try { (await c.where("__name__", ">=", c.doc(t)).where("__name__", "<", c.doc(`${t}`)).get()).docs.forEach(add); } catch { /* */ }
      }
    }
    for (const field of ["email", "toEmail", "uid", "ownerUid", "userUid", "createdBy", "parentUid", "referrerUid", "byUid"]) {
      const list = field === "email" || field === "toEmail" ? emails : uids;
      for (let i = 0; i < list.length; i += 30) {
        const chunk = list.slice(i, i + 30);
        if (!chunk.length) continue;
        try { (await c.where(field, "in", chunk).get()).docs.forEach(add); } catch { /* no such field / index */ }
      }
    }
    if (c.id === "users") for (const u of uids) { if (!seen.has(u)) { seen.add(u); refs.push(c.doc(u)); } }
    if (refs.length) { await deleteDocs(refs); counts[c.id] = refs.length; }
  }
  return counts;
}

export function log(label: string, r: Res | unknown) {
  const s = typeof r === "object" && r && "status" in (r as Res) ? `${(r as Res).status} ${JSON.stringify((r as Res).json)?.slice(0, 500)}` : JSON.stringify(r)?.slice(0, 800);
  console.log(`  · ${label}: ${s}`);
}

export const iso = (d: Date) => d.toISOString();
export const ymd = (d: Date) => d.toISOString().slice(0, 10);
export const daysFromNow = (n: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d; };
