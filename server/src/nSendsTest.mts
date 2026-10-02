// Focused test for lib/octSends.ts (items 22-26). Seeds a throwaway tenant on the
// dev Firestore with @activityos-test.com addresses (mailer never delivers to that
// domain), calls the real functions, asserts the notification docs, cleans up.
//   cd server && node_modules/.bin/tsx src/nSendsTest.mts
import "dotenv/config";
import { db } from "./firebase";
import { notifyTimetablePublished, notifyMealRequestDecision, catererWindow, catererDigest, parseDue, learnStage, learningChasers, notifyRotaPublished } from "./lib/octSends";

let failures = 0;
const check = (l: string, ok: boolean, d?: unknown) => { if (ok) console.log(`  ok ${l}`); else { failures++; console.error(`  FAIL ${l}`, JSON.stringify(d ?? "").slice(0, 300)); } };
const T = `n-test-${Date.now()}`;
const made: FirebaseFirestore.DocumentReference[] = [];
const add = async (c: string, data: object, id?: string) => { const r = id ? db.collection(c).doc(id) : db.collection(c).doc(); await r.set(data); made.push(r); return r; };
const notifs = async (extra?: (d: FirebaseFirestore.QueryDocumentSnapshot) => boolean) => (await db.collection("notifications").where("tenantId", "==", T).get()).docs.filter((d) => !extra || extra(d));

async function main() {
  console.log("pure helpers");
  check("catererWindow day = tomorrow", JSON.stringify(catererWindow("day", "2026-10-02")) === JSON.stringify({ from: "2026-10-03", to: "2026-10-03" }));
  check("catererWindow week only Monday", catererWindow("week", "2026-10-02") === null && catererWindow("week", "2026-10-05")?.to === "2026-10-11");
  check("parseDue", parseDue("30 Jun", "2026-10-02") === "2026-06-30" && parseDue("2026-07-01", "x") === "2026-07-01" && parseDue("soon", "2026-10-02") === null);
  check("learnStage", learnStage("2026-10-05", null, 12, "2026-10-02") === "due-soon" && learnStage("2026-10-02", null, 12, "2026-10-02") === "due-today" && learnStage("2026-09-01", null, 12, "2026-10-05") === "overdue" && learnStage("2026-09-01", null, 12, "2026-10-02") === null && learnStage("2026-09-01", "2026-09-30", 12, "2026-10-05") === null);

  console.log("22 timetable publish");
  await add("bookings", { tenantId: T, email: `a@activityos-test.com`, status: "Confirmed", listingId: "L1", days: ["2026-10-06"] });
  await add("bookings", { tenantId: T, email: `b@activityos-test.com`, status: "Cancelled", listingId: "L1", days: ["2026-10-06"] });
  await add("bookings", { tenantId: T, email: `c@activityos-test.com`, status: "Confirmed", listingId: "L2", days: ["2026-10-06"] });
  await add("bookings", { tenantId: T, email: `d@activityos-test.com`, status: "Confirmed", listingId: "L1", days: ["2027-01-01"] });
  await add("bookings", { tenantId: T, email: `e@activityos-test.com`, status: "Confirmed", listingId: "L1", franchiseId: "F1", days: ["2026-10-06"] });
  const info = { tenantId: T, timetableId: "tt1", franchiseId: null, name: "Week 1", listingId: "L1", dateFrom: "2026-10-05", dateTo: "2026-10-11", audience: "booked" as const };
  check("none when both toggles off", (await notifyTimetablePublished(info, {})) === 0);
  const n = await notifyTimetablePublished(info, { notifyEmail: true, notifyPush: true });
  const ns = await notifs((d) => d.get("ref") === "tt1");
  check("booked audience = live booking, right listing, in range (a + e)", n === 2 && ns.length === 2, { n, to: ns.map((d) => d.get("email")) });
  check("email attempted (suppressed in test domain), bell written", ns.every((d) => d.get("emailStatus") === "suppressed" && d.get("audience") === "parent"), ns.map((d) => d.get("emailStatus")));
  const nf = await notifyTimetablePublished({ ...info, franchiseId: "F1" }, { notifyPush: true });
  check("franchise timetable reaches only its own families", nf === 1);
  const bellOnly = (await notifs((d) => d.get("ref") === "tt1" && d.get("email") === "e@activityos-test.com")).filter((d) => !d.get("emailStatus"));
  check("push-only = bell without email", bellOnly.length === 1);

  console.log("23 meal decision -> parent");
  await notifyMealRequestDecision({ tenantId: T, parentEmail: "a@activityos-test.com", childName: "Kid", date: "2026-10-06", id: "mo1" }, "declined", "change");
  const m = await notifs((d) => d.get("ref") === "mo1");
  check("parent bell + email attempted", m.length === 1 && /declined/.test(m[0].get("title")) && m[0].get("emailStatus") === "suppressed", m.map((d) => d.data()));

  console.log("24 caterer digest");
  const today = (await import("./lib/scheduler")).ukNow();
  const tomorrow = (await import("./lib/ukDate")).addDays(today.date, 1);
  const lst = await add("listings", { tenantId: T, name: "Camp", mealConfig: { catererEmail: "kitchen@activityos-test.com", catererEvery: "day", catererAt: "00:00" } });
  await add("listings", { tenantId: T, name: "NoMail", mealConfig: { catererEvery: "day", catererAt: "00:00" } });
  await add("mealOrders", { tenantId: T, listingId: lst.id, date: tomorrow, status: "placed", childName: "Kid", items: [{ name: "Pasta", qty: 1 }] });
  await add("mealOrders", { tenantId: T, listingId: lst.id, date: tomorrow, status: "cancelled", childName: "Gone", items: [{ name: "Soup" }] });
  const sent = await catererDigest({ date: today.date, minutes: 600 });
  check("one digest attempted for the configured listing only", sent === 1, sent);
  check("exactly-once: second run sends nothing", (await catererDigest({ date: today.date, minutes: 700 })) === 0);
  const early = await catererDigest({ date: today.date, minutes: -1 });
  check("before catererAt nothing", early === 0);

  console.log("25 rota publish + 26 learning");
  await add("users", { tenantId: T, role: "staff", email: "s1@activityos-test.com", name: "Sam Staff", jobTitle: "Coach" }, `u-${T}-1`);
  const pc = await notifyRotaPublished(T, null, [{ id: "st1", name: "Sam Staff" }], [{ staffId: "st1", date: "2026-10-06", start: "09:00", end: "15:00" }, { staffId: null, date: "2026-10-06", start: "09:00", end: "15:00" }]);
  const rn = await notifs((d) => d.get("toEmail") === "s1@activityos-test.com" && /schedule/i.test(d.get("title")));
  check("one publish notice per staff member, emailed", pc === 1 && rn.length === 1 && rn[0].get("emailStatus") === "suppressed", { pc });
  await add("learningAssignments", { tenantId: T, franchiseId: null, assignments: [{ course: "c1", title: "Safeguarding", kind: "roles", roles: ["Coach"], due: today.date, required: true }, { course: "c2", title: "First aid", kind: "staff", staff: ["Someone Else"], due: today.date }] }, T);
  await learningChasers(today);
  const ln = await notifs((d) => d.get("toEmail") === "s1@activityos-test.com" && /Safeguarding/.test(d.get("title")));
  check("due-today chase to the covered staff member only, once", ln.length === 1 && (await notifs((d) => /First aid/.test(d.get("title")))).length === 0, ln.length);
  await learningChasers(today);
  check("re-run does not duplicate", (await notifs((d) => /Safeguarding/.test(d.get("title")))).length === 1);
  await add("learningCompletions", { key: T, tenantId: T, courseId: "c1", staffName: "Sam Staff", date: today.date }, `${T}_x`);
}

main().catch((e) => { failures++; console.error(e); }).finally(async () => {
  for (const r of made) await r.delete().catch(() => {});
  for (const c of ["notifications", "schedulerFired"]) for (const d of (await db.collection(c).where("tenantId", "==", T).get()).docs) await d.ref.delete().catch(() => {});
  console.log(failures ? `${failures} FAILED` : "ALL PASSED");
  process.exit(failures ? 1 : 0);
});
