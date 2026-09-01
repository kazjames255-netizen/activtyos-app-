import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { operatorScope } from "../middleware/role";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";
import { blockSummary, type BlockDoc } from "../lib/blockDomain";
import { walletsForFamily } from "../lib/wallet";
import type { Booking } from "../../../features/bookings/types";

// ─────────────────────────────────────────────────────────────────────────
// AI assistant — answers plain-English questions from the account's LIVE
// data. Pure read: the route assembles a role-scoped snapshot (the same
// aggregates the dashboard/overview screens show), hands it to the model as
// context, and returns the answer. The model never gets tools or write
// access, and the Groq key never leaves the server.
//
// Scoping mirrors the rest of the API: operators see their tenant, parents
// see their own family, platform sees platform-wide aggregates. Whatever
// the model is asked, it can only ever "know" what that account may read.
// ─────────────────────────────────────────────────────────────────────────
export const ai = Router();

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// How-to knowledge base — where each job is done in the app, so the assistant
// can give clear step-by-step guidance for "how do I…" questions.
const HOWTO: Record<"operator" | "staff" | "parent" | "platform", string> = {
  operator: [
    "Take a register: Registers → choose the date and session at the top → tap a child to mark them In, Absent or Collected. Use “Roll call” for a quick head-count, “Message all attending” to text every parent at once, and tap a child's name to open their full care card (allergies, medical, SEND, collection password).",
    "Add a new activity/listing: Blocks & listings → Listings tab → “+ New listing” → work through the wizard (details & photos, when it runs, tickets & pricing) → Publish. It then appears on the parents' Browse page.",
    "Set dates & sessions: Blocks & listings → Blocks → create a Block with its sessions/dates and attach it to a listing. Capacity and one-per-day rules live on the block; prices live on the listing's tickets.",
    "Approve or decline a booking: Bookings → the “Approval needed” filter → open it → Approve or Decline.",
    "Take payment / refund / mark paid: Bookings → open the booking → use the payment actions (mark paid, send a payment link, or refund).",
    "Chase money owed: Finance & analytics → Debts, or Bookings filtered by unpaid — each shows the family and amount; message or send a payment link from there.",
    "Message parents: Messages, or from a Register (“Message all attending”), or from an individual booking. Templates and merge fields are in the ✉️ Messages area.",
    "Add a discount code: Marketing → Coupons → create a code (percentage or fixed, all listings or a specific one, optional per-family limit or reserved group).",
    "Log an accident/incident: Registers or the Incidents area → Log accident → child, what happened, first aid given, and whether to notify the parent (they get a copy in their portal).",
    "See finances: Finance & analytics (revenue, payouts, debts, customers). Money in / Money out for income and expenses. Payroll for staff pay.",
    "Add a team member: Team & invites → invite by email and choose their role; they join via the invite link. Rotas/shifts are set in Schedule.",
    "Record an expense / bills: Money out (expenses) — add a bill or expense and mark it Paid or Pending; Purchasing for purchase orders. Set the accounting basis (cash vs accrual) in Setup → Money.",
    "Reconcile takings: Reconciliation — match payments received against bookings and invoices.",
    "Set up refer-a-friend: Setup → Refer a friend — turn it on, set the friend discount and the referrer reward; families then get a Refer a friend page.",
    "Memberships: Setup → Memberships — turn it on and define up to 3 tiers (a % discount or £ wallet credit per month).",
    "Run payroll / see timesheets: Payroll for pay runs (it uses clocked hours); Clock in/out & timesheets for the hours themselves.",
    "Split fees with a partner or coach: the Split fees page.",
    "Change your ActivityOS plan: Subscription.",
    "Set up the business: Setup & features (seasons, child questions, consents, safeguarding options, roles & permissions, and which modules families see).",
  ].join("\n• "),
  staff: [
    "Take a register: Registers → today's session → tap each child to mark them In, Absent or Collected. Use “Roll call” for a head-count. Tap a child's name to see their care card (allergies, medical, SEND, collection password).",
    "Clock in / out: the Clock in/out page → Clock in when you arrive, Take a break, and Clock out when you finish. Your hours feed your timesheet.",
    "Log an accident: Registers/Incidents → Log accident → child, what happened and any first aid; a manager and (if set) the parent are notified.",
    "Your tasks: Tasks → tick one off or change its status. Team tasks are shared.",
    "Who's in / who has SEND or allergies: Registers → the child cards show attendance and every care flag.",
    "Time off & your shifts: My time off to request leave; My shifts & clock in/out for your rota.",
    "Set your availability: My availability — mark when you can and can't work.",
    "Your pay & claims: Payslips for your payslips; My expenses to submit an expense claim (attach a receipt).",
    "Your training & certificates: Certificates & courses — your required and optional courses and cert expiry.",
    "Finish onboarding: the Onboarding page — complete your joining details to get cleared to start.",
  ].join("\n• "),
  parent: [
    "Pay what you owe: Payments → pay outstanding invoices/bookings (card, or store credit in your Wallet).",
    "Book an activity: Browse → pick the activity and dates → checkout. Discount codes and wallet credit apply at checkout.",
    "Change or cancel: My bookings → open the booking (cancellation follows the provider's cut-off).",
    "Update your child's details: Children → edit allergies, medical, dietary, SEND/EHCP plan, consents and collection password.",
    "Messages & updates: Messages for chats; Newsfeed for the provider's news; Moments for your child's photos.",
    "Discount codes & memberships: the Coupons & discount codes page shows codes you can use; the Memberships page shows tiers you can join.",
    "Refer a friend: the Refer a friend page has your link and what you earn.",
    "Trips & consent: the Trips & consent page — give consent for a trip; Medication to record your child's medication for the provider.",
  ].join("\n• "),
  platform: [
    "Providers: the Providers area lists every tenant, their plan and activity.",
    "Money & growth: Sales, Analytics and Engagement dashboards aggregate across all providers.",
    "Support: the Support inbox holds provider queries and bug reports.",
  ].join("\n• "),
};

// Deep-link map — page label → view slug, per portal. URL = /${portal}/${slug}.
// So the assistant can link users straight to the exact screen.
const NAV: Record<string, [string, string][]> = {
  company: [["Dashboard", "dashboard"], ["Bookings", "bookings"], ["Blocks & listings", "listings"], ["Registers", "admin-registers"], ["Families", "customers"], ["Ratios & groups", "ratios"], ["Activity timetable", "timetable"], ["Events calendar", "calendar"], ["Meals", "meals"], ["Trips & visits", "trips"], ["Task manager", "tasks"], ["Discount codes", "marketing"], ["Referrals", "referrals"], ["Finance & analytics", "finance"], ["Money in", "purchasing"], ["Money out", "expenses"], ["Invoices", "invoices"], ["Reconciliation", "reconciliation"], ["Inventory", "inventory"], ["Staff", "staff"], ["Staff schedule", "schedule"], ["Leave & absence", "holiday"], ["Clock in/out & timesheets", "timesheets"], ["Payroll", "payroll"], ["Learning Centre", "learning"], ["Compliance & certificates", "credentials"], ["Documents", "documents"], ["Milestones", "ho-framework"], ["Messages", "messages"], ["Newsfeed", "newsfeed"], ["Moments", "moments"], ["Email", "email"], ["Subscription", "subscription"], ["Setup & features", "setup"], ["AI assistant", "ai"]],
  freelancer: [["Dashboard", "dash"], ["Bookings", "bookings"], ["Blocks & listings", "listings"], ["Registers", "registers"], ["Families", "customers"], ["Ratios & groups", "ratios"], ["Activity timetable", "timetable"], ["Events calendar", "calendar"], ["Meals", "meals"], ["Trips & visits", "trips"], ["Task manager", "tasks"], ["Discount codes", "marketing"], ["Referrals", "referrals"], ["Finance & analytics", "finance"], ["Money in", "purchasing"], ["Money out", "expenses"], ["Invoices", "invoices"], ["Reconciliation", "reconciliation"], ["Inventory", "inventory"], ["Leave & absence", "holiday"], ["Clock in/out & timesheets", "timesheets"], ["Messages", "messages"], ["Newsfeed", "newsfeed"], ["Moments", "moments"], ["Email", "email"], ["Subscription", "subscription"], ["Setup & features", "setup"], ["AI assistant", "ai"]],
  staff: [["Dashboard", "dash"], ["My shifts & clock in/out", "schedule"], ["My availability", "availability"], ["Time off", "holiday"], ["My tasks", "tasks"], ["Register", "registers"], ["Ratios & groups", "ratios"], ["Activity timetable", "timetable"], ["Meals", "meals"], ["Trips", "trips"], ["Moments", "moments"], ["Report a concern", "incident"], ["Accidents & first aid", "accidents"], ["Medication", "medication"], ["Certificates & courses", "certificates"], ["Documents", "documents"], ["Payslips", "payslips"], ["My expenses", "expenses"], ["Appraisals", "appraisals"], ["Onboarding", "onboarding"], ["Announcements", "announcements"], ["Messages", "messages"], ["Families", "customers"], ["Account settings", "account"], ["Ask AI", "ai"]],
  custdash: [["Browse activities", "browse"], ["My bookings", "bookings"], ["Payments", "payments"], ["Wallet", "wallet"], ["Coupons & discount codes", "coupons"], ["Memberships", "memberships"], ["Refer a friend", "refer"], ["Child & details", "children"], ["Moments", "moments"], ["Newsfeed", "newsfeed"], ["Meals", "meals"], ["Trips & consent", "trips"], ["Activity timetable", "timetable"], ["Medication", "medication"], ["First aid & incidents", "accidents"], ["Messages", "messages"], ["My account", "account"], ["Data & privacy", "privacy"], ["Help & support", "activityos"], ["AI assistant", "ai"]],
  platform: [["Analytics", "analytics"], ["Providers & billing", "providers"], ["Page engagement", "engagement"], ["At risk", "at-risk"], ["Sales pipeline", "sales"], ["Provider features", "features"], ["Messages & support", "messages"], ["AI assistant", "ai"]],
};
// franchise mirrors freelancer's slugs.
NAV.franchise = NAV.freelancer;

// Every Setup tab — deep-linked as /${portal}/setup?tab=<id>. Operator-only.
const SETUP_TABS: [string, string][] = [
  ["Notifications", "notifications"], ["Features — turn modules on/off & what families see", "features"], ["Company setup — name, contact, address", "company"], ["Branding — logo & colour", "branding"], ["Seasons", "seasons"], ["Child questions & consents", "people"], ["Staff & workforce — DBS, ratios, job roles", "staff"], ["Roles & permissions (company only)", "roles"], ["Learning & certificates", "learning"], ["Meals", "meals"], ["Medication", "medication"], ["Safeguarding — DSL, contacts, protocol", "safeguarding"], ["Register — what shows on a child's card", "registers"], ["Trips & visits", "trips"], ["Calendar", "calendar"], ["Inventory", "inventory"], ["Age groups & rooms (ratios)", "groups"], ["Cancellations & refunds", "cancel"], ["New listing defaults", "defaults"], ["Payments & pay methods", "bookings"], ["Money — invoices, bank details, accounting basis", "money"], ["Childcare vouchers", "vouchers"], ["Marketplace listing", "marketplace"], ["Refer a friend", "refer"], ["Memberships", "memberships"],
];

function navRef(portal: string): string {
  const pages = NAV[portal] ?? NAV.company;
  const lines = pages.map(([label, slug]) => `- ${label}: /${portal}/${slug}`);
  if (portal !== "staff" && portal !== "custdash" && portal !== "platform") {
    lines.push(`- Settings live under Setup — deep-link the exact tab as /${portal}/setup?tab=<id>:`);
    for (const [label, tab] of SETUP_TABS) lines.push(`    · ${label} → /${portal}/setup?tab=${tab}`);
    lines.push(`- Scheduling defaults (first day, break length, shift notifications, co-worker visibility) are on the Staff schedule page's Settings tab: /${portal}/schedule`);
  }
  return lines.join("\n");
}
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20),
  // The portal segment the user is in (company/freelancer/franchise/staff/
  // custdash/platform) — so deep links use the right URL prefix + slugs.
  portal: z.enum(["company", "freelancer", "franchise", "staff", "custdash", "platform"]).optional(),
});

const round2 = (n: number) => Math.round(n * 100) / 100;
const OWES = new Set(["Unpaid", "Invoice sent", "Awaiting voucher payment", "Partially paid"]);
const outstandingOf = (b: Booking) => Math.max(0, (b.amount ?? 0) - (b.amountPaid ?? 0));
const RECEIVED = new Set(["recorded", "succeeded"]);

// ── Operator snapshot — the dashboard's numbers plus a compact booking list
// so "who's in today" and "who still owes" have names, not just totals. ──
async function tenantSnapshot(tenantId: string, forStaff = false) {
  const [bookingsSnap, blocksSnap, listingsSnap, paymentsSnap, tasksSnap, childrenSnap, invitesSnap, incidentsSnap] = await Promise.all([
    db.collection("bookings").where("tenantId", "==", tenantId).get(),
    db.collection("blocks").where("tenantId", "==", tenantId).get(),
    db.collection("listings").where("tenantId", "==", tenantId).get(),
    db.collection("payments").where("tenantId", "==", tenantId).get(),
    db.collection("tasks").where("tenantId", "==", tenantId).get(),
    db.collection("children").where("tenantId", "==", tenantId).get(),
    db.collection("invites").where("tenantId", "==", tenantId).get(),
    db.collection("incidents").where("tenantId", "==", tenantId).get(),
  ]);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const title = new Map(listingsSnap.docs.map((d) => [d.id, (d.data() as { title?: string }).title ?? "Untitled"]));

  type Sess = { date: string; start: string; end: string; capacity: number; booked: number; spotsLeft: number; listing: string; open: boolean };
  const sessions: Sess[] = [];
  let openCapacity = 0, openBooked = 0;
  for (const d of blocksSnap.docs) {
    const doc = d.data() as BlockDoc;
    const sum = blockSummary(d.id, doc);
    const listing = title.get(doc.listingId) ?? "Untitled";
    if (sum.open && sum.sessions.some((s) => s.date >= today)) { openCapacity += sum.capacity; openBooked += sum.bookedCount; }
    for (const s of sum.sessions) sessions.push({ date: s.date, start: s.start, end: s.end, capacity: s.capacity, booked: s.bookedCount, spotsLeft: s.spotsLeft, listing, open: sum.open });
  }
  sessions.sort((a, b) => (`${a.date} ${a.start}` < `${b.date} ${b.start}` ? -1 : 1));

  const bookings = bookingsSnap.docs.map((d) => {
    const b = fromDoc(d.data() as BookingDoc);
    return { ...b, createdAt: b.createdAt ?? d.createTime?.toDate().toISOString() ?? "" };
  });
  const live = bookings.filter((b) => b.status !== "Cancelled" && b.status !== "Declined");

  // Expected today: bookings holding a place whose chosen days include today
  // (bookings without `days` cover every session of their block).
  const inToday = live
    .filter((b) => b.status === "Confirmed" && (!b.days || b.days.includes(today)))
    .filter((b) => sessions.some((s) => s.date === today && s.listing === b.listing));

  // Care flags (SEND/allergy/medical/dietary) from the child records, and who's
  // actually signed in from today's registers — so the assistant can answer
  // "any children with allergies in?", "who's not arrived?", "who has SEND?".
  type CDoc = { name?: string; send?: string; sendPlanId?: string; sendPlanName?: string; allergies?: string; medical?: string; dietary?: string };
  const childByName = new Map(childrenSnap.docs.map((d) => [((d.data() as CDoc).name ?? "").trim().toLowerCase(), d.data() as CDoc]));
  const registersSnap = await db.collection("registers").where("tenantId", "==", tenantId).where("date", "==", today).get();
  const attByRef = new Map<string, string>();
  registersSnap.docs.forEach((d) => {
    const entries = (d.data() as { entries?: Record<string, { status?: string; collectedAt?: string | null }> }).entries ?? {};
    for (const [ref, v] of Object.entries(entries)) attByRef.set(ref, v.collectedAt ? "collected" : (v.status ?? ""));
  });
  const statusWord = (s?: string) => (s === "in" ? "signed in" : s === "collected" ? "collected" : s === "absent" ? "absent" : "not signed in yet");
  const childrenTodayDetailed = inToday.slice(0, 80).map((b) => {
    const c = childByName.get((b.child ?? "").trim().toLowerCase()) ?? {};
    const care: string[] = [];
    if (c.send || c.sendPlanId || c.sendPlanName) care.push("SEND");
    if (c.allergies) care.push(`allergy: ${c.allergies}`);
    if (c.medical) care.push(`medical: ${c.medical}`);
    if (c.dietary) care.push(`dietary: ${c.dietary}`);
    return { child: b.child, listing: b.listing, family: b.booker, status: statusWord(attByRef.get(b.ref)), care };
  });
  const attendance = {
    expected: childrenTodayDetailed.length,
    signedIn: childrenTodayDetailed.filter((k) => k.status === "signed in").length,
    collected: childrenTodayDetailed.filter((k) => k.status === "collected").length,
    absent: childrenTodayDetailed.filter((k) => k.status === "absent").length,
    notSignedInYet: childrenTodayDetailed.filter((k) => k.status === "not signed in yet").length,
  };
  const sendChildrenToday = childrenTodayDetailed.filter((k) => k.care.includes("SEND")).map((k) => k.child);

  const owing = live.filter((b) => OWES.has(b.pay) && outstandingOf(b) > 0);
  const takenThisWeek = round2(
    paymentsSnap.docs
      .map((d) => d.data() as { amount?: number; status?: string; type?: string; createdAt?: string })
      .filter((p) => p.type !== "refund" && RECEIVED.has(p.status ?? "") && (p.createdAt ?? "") >= weekAgo)
      .reduce((s, p) => s + (p.amount ?? 0), 0),
  );

  const openTasks = tasksSnap.docs
    .map((d) => d.data() as { title?: string; done?: boolean; dueDate?: string })
    .filter((t) => !t.done)
    .slice(0, 15)
    .map((t) => ({ title: t.title, due: t.dueDate ?? null }));

  const compact = (b: Booking) => ({
    ref: b.ref, child: b.child, family: b.booker, listing: b.listing,
    dates: b.dates, status: b.status, pay: b.pay, amount: b.amount,
    outstanding: round2(outstandingOf(b)),
  });

  // Team roster — invited accounts (NOT the live day rota, which lives client-side).
  const team = invitesSnap.docs.map((d) => d.data() as { name?: string; email?: string; role?: string; status?: string })
    .map((t) => ({ name: t.name || t.email || "—", role: t.role || "staff", status: t.status || "invited" })).slice(0, 50);

  // Recent accidents / incidents / safeguarding records.
  const incidents = incidentsSnap.docs.map((d) => d.data() as { kind?: string; childName?: string; severity?: string; date?: string; description?: string })
    .sort((a, b) => ((a.date ?? "") < (b.date ?? "") ? 1 : -1)).slice(0, 12)
    .map((r) => ({ kind: r.kind || "incident", child: r.childName, severity: r.severity, date: r.date, summary: (r.description || "").slice(0, 160) }));

  // Care-flag totals across ALL of the setting's children (not just today's).
  const allChildren = childrenSnap.docs.map((d) => d.data() as CDoc);
  const childrenSummary = {
    total: allChildren.length,
    withSEND: allChildren.filter((c) => c.send || c.sendPlanId || c.sendPlanName).length,
    withAllergies: allChildren.filter((c) => c.allergies).length,
    withMedical: allChildren.filter((c) => c.medical).length,
    withDietary: allChildren.filter((c) => c.dietary).length,
  };

  // Listings, with how full each one is right now.
  const fillByListing = new Map<string, { cap: number; booked: number }>();
  for (const d of blocksSnap.docs) {
    const doc = d.data() as BlockDoc; const sum = blockSummary(d.id, doc);
    const nm = title.get(doc.listingId) ?? "Untitled";
    const f = fillByListing.get(nm) ?? { cap: 0, booked: 0 };
    if (sum.open) { f.cap += sum.capacity; f.booked += sum.bookedCount; }
    fillByListing.set(nm, f);
  }
  const listings = listingsSnap.docs.map((d) => {
    const l = d.data() as { title?: string; name?: string; status?: string; visibility?: string };
    const nm = l.title || l.name || "Untitled"; const f = fillByListing.get(nm);
    return { name: nm, status: l.status || "live", visibility: l.visibility || "public", fillPct: f && f.cap ? Math.round((f.booked / f.cap) * 100) : null };
  }).slice(0, 50);

  // Families — unique bookers, and who spends the most.
  const spendByFamily = new Map<string, number>();
  for (const b of live) spendByFamily.set(b.booker, (spendByFamily.get(b.booker) ?? 0) + (b.amount ?? 0));
  const families = {
    total: spendByFamily.size,
    topBySpend: [...spendByFamily.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([family, gbp]) => ({ family, spentGBP: round2(gbp) })),
  };

  const todayBlock = {
    date: today,
    sessions: sessions.filter((s) => s.date === today).map((s) => ({ listing: s.listing, start: s.start, end: s.end, booked: s.booked, capacity: s.capacity })),
    attendance,
    childrenWithSEND: sendChildrenToday,
    children: childrenTodayDetailed, // each: child, listing, family, status (signed in / not signed in yet / absent / collected), care[] (SEND, allergy, medical, dietary)
  };
  const upcomingSessions = sessions.filter((s) => s.date >= today && s.open).slice(0, 10)
    .map((s) => ({ date: s.date, start: s.start, end: s.end, listing: s.listing, spotsLeft: s.spotsLeft }));

  // Front-line staff get an OPERATIONAL view only — who's in, sessions, tasks —
  // never money, booking approvals or owing families. Those are the manager's,
  // and handing them to a coach would be wrong (and a data-minimisation issue).
  if (forStaff) {
    return { today: todayBlock, upcomingSessions, openTasks, incidents, childrenSummary, team };
  }

  // ── Operator-only: money, marketing & wider ops (staff never reach here) ──
  const year = today.slice(0, 4);
  const monthKey = today.slice(0, 7);
  const [incomeSnap, expensesSnap, invoicesSnap, couponsSnap, membersSnap, referralsSnap, poSnap, inventorySnap, threadsSnap, postsSnap, momentsSnap, customersSnap] = await Promise.all([
    db.collection("income").where("tenantId", "==", tenantId).get(),
    db.collection("expenses").where("tenantId", "==", tenantId).get(),
    db.collection("invoices").where("tenantId", "==", tenantId).get(),
    db.collection("discountCodes").where("tenantId", "==", tenantId).get(),
    db.collection("memberships").where("tenantId", "==", tenantId).get(),
    db.collection("referrals").where("tenantId", "==", tenantId).get(),
    db.collection("purchaseOrders").where("tenantId", "==", tenantId).get(),
    db.collection("inventory").where("tenantId", "==", tenantId).get(),
    db.collection("threads").where("tenantId", "==", tenantId).get(),
    db.collection("posts").where("tenantId", "==", tenantId).get(),
    db.collection("moments").where("tenantId", "==", tenantId).get(),
    db.collection("customers").where("tenantId", "==", tenantId).get(),
  ]);
  const sumBy = <T,>(rows: T[], amt: (r: T) => number, keep: (r: T) => boolean) => round2(rows.filter(keep).reduce((s, r) => s + amt(r), 0));

  // Payments received (from the base paymentsSnap), income ledger, expenses, invoices.
  const payRows = paymentsSnap.docs.map((d) => d.data() as { amount?: number; status?: string; type?: string; createdAt?: string });
  const gotIn = (from: string) => sumBy(payRows, (p) => p.amount ?? 0, (p) => p.type !== "refund" && RECEIVED.has(p.status ?? "") && (p.createdAt ?? "") >= from);
  const incomeRows = incomeSnap.docs.map((d) => d.data() as { date?: string; category?: string; amount?: number });
  const expRows = expensesSnap.docs.map((d) => d.data() as { date?: string; category?: string; amount?: number; supplier?: string; status?: string });
  const invRows = invoicesSnap.docs.map((d) => d.data() as { customerName?: string; amount?: number; status?: string; dueDate?: string });
  const groupSum = (rows: { category?: string; amount?: number }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.category || "Uncategorised", (m.get(r.category || "Uncategorised") ?? 0) + (r.amount ?? 0));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([category, gbp]) => ({ category, gbp: round2(gbp) }));
  };
  const finances = {
    receivedThisWeekGBP: takenThisWeek,
    receivedThisMonthGBP: gotIn(`${monthKey}-01T00:00:00`),
    receivedThisYearGBP: gotIn(`${year}-01-01T00:00:00`),
    otherIncome: { thisMonthGBP: sumBy(incomeRows, (r) => r.amount ?? 0, (r) => (r.date ?? "").slice(0, 7) === monthKey), thisYearGBP: sumBy(incomeRows, (r) => r.amount ?? 0, (r) => (r.date ?? "").slice(0, 4) === year), byCategory: groupSum(incomeRows) },
    expenses: { thisMonthGBP: sumBy(expRows, (r) => r.amount ?? 0, (r) => (r.date ?? "").slice(0, 7) === monthKey), thisYearGBP: sumBy(expRows, (r) => r.amount ?? 0, (r) => (r.date ?? "").slice(0, 4) === year), pendingGBP: sumBy(expRows, (r) => r.amount ?? 0, (r) => r.status === "pending"), byCategory: groupSum(expRows) },
    invoices: { outstandingGBP: sumBy(invRows, (i) => i.amount ?? 0, (i) => i.status === "sent"), overdueCount: invRows.filter((i) => i.status === "sent" && (i.dueDate ?? "9999") < today).length, topOutstanding: invRows.filter((i) => i.status === "sent").sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)).slice(0, 8).map((i) => ({ customer: i.customerName, amountGBP: round2(i.amount ?? 0), dueDate: i.dueDate ?? null, overdue: (i.dueDate ?? "9999") < today })) },
  };

  // Marketing: coupons, memberships, referrals.
  const codes = couponsSnap.docs.map((d) => d.data() as { code?: string; type?: string; value?: number; usedCount?: number; active?: boolean; expiry?: string; membership?: boolean; referral?: boolean; referralReward?: boolean });
  const mktCodes = codes.filter((c) => !c.membership && !c.referral && !c.referralReward);
  const coupons = { activeCodes: mktCodes.filter((c) => c.active).length, totalRedemptions: mktCodes.reduce((s, c) => s + (c.usedCount ?? 0), 0), topCodes: [...mktCodes].sort((a, b) => (b.usedCount ?? 0) - (a.usedCount ?? 0)).slice(0, 8).map((c) => ({ code: c.code, type: c.type, value: c.value, usedCount: c.usedCount ?? 0, expiry: c.expiry ?? null })) };
  const memRows = membersSnap.docs.map((d) => d.data() as { tierName?: string; priceMonthly?: number; status?: string });
  const memberships = { activeMembers: memRows.filter((m) => m.status === "active").length, mrrGBP: sumBy(memRows, (m) => m.priceMonthly ?? 0, (m) => m.status === "active") };
  const refRows = referralsSnap.docs.map((d) => d.data() as { referrerEmail?: string; friendSpend?: number; reward?: number });
  const referrals = { friendsBooked: refRows.length, referredRevenueGBP: round2(refRows.reduce((s, r) => s + (r.friendSpend ?? 0), 0)), rewardsPaidGBP: round2(refRows.reduce((s, r) => s + (r.reward ?? 0), 0)) };

  // Ops: purchase orders, inventory, messages, newsfeed, moments, customers.
  const poRows = poSnap.docs.map((d) => d.data() as { supplier?: string; amount?: number; status?: string; dueDate?: string });
  const purchaseOrders = { outstandingGBP: sumBy(poRows, (p) => p.amount ?? 0, (p) => p.status === "sent" || p.status === "received"), overdueCount: poRows.filter((p) => (p.status === "sent" || p.status === "received") && (p.dueDate ?? "9999") < today).length };
  const invItems = inventorySnap.docs.map((d) => d.data() as { name?: string; quantity?: number; minQty?: number; location?: string });
  const inventory = { items: invItems.length, lowStock: invItems.filter((i) => typeof i.quantity === "number" && typeof i.minQty === "number" && (i.quantity as number) <= (i.minQty as number)).slice(0, 12).map((i) => ({ name: i.name, quantity: i.quantity, minQty: i.minQty, location: i.location })) };
  const threads = threadsSnap.docs.map((d) => d.data() as { parentName?: string; subject?: string; lastFrom?: string; lastAt?: string; operatorUnread?: number });
  const messages = { threads: threads.length, unreadThreads: threads.filter((t) => (t.operatorUnread ?? 0) > 0).length, unreadMessages: threads.reduce((s, t) => s + (t.operatorUnread ?? 0), 0), recent: [...threads].filter((t) => (t.operatorUnread ?? 0) > 0).sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "")).slice(0, 6).map((t) => ({ parent: t.parentName, subject: t.subject, from: t.lastFrom, unread: t.operatorUnread })) };
  const postRows = postsSnap.docs.map((d) => d.data() as { title?: string; status?: string; createdAt?: string });
  const newsfeed = { published: postRows.filter((p) => p.status === "published").length, drafts: postRows.filter((p) => p.status === "draft").length, scheduled: postRows.filter((p) => p.status === "scheduled").length, recent: postRows.filter((p) => p.status === "published").sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, 5).map((p) => ({ title: p.title, createdAt: p.createdAt })) };
  const weekAgoDate = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const momentRows = momentsSnap.docs.map((d) => d.data() as { createdAt?: string });
  const moments = { total: momentRows.length, last7d: momentRows.filter((m) => (m.createdAt ?? "") >= weekAgoDate).length };
  const customersCount = customersSnap.size;

  return {
    today: todayBlock,
    upcomingSessions,
    listings,
    families: { ...families, records: customersCount },
    childrenSummary,
    team,
    incidents,
    finances,
    coupons,
    memberships,
    referrals,
    purchaseOrders,
    inventory,
    messages,
    newsfeed,
    moments,
    occupancy: { booked: openBooked, capacity: openCapacity, pct: openCapacity ? Math.round((openBooked / openCapacity) * 100) : 0 },
    bookings: {
      live: live.length,
      waitlist: live.filter((b) => b.status === "Waitlisted").length,
      approvalNeeded: live.filter((b) => b.status === "Approval needed").length,
      newThisWeek: bookings.filter((b) => (b.createdAt ?? "") >= weekAgo).length,
      recent: [...bookings].sort((a, b) => ((a.createdAt ?? "") < (b.createdAt ?? "") ? 1 : -1)).slice(0, 10).map(compact),
    },
    money: {
      takenThisWeekGBP: takenThisWeek,
      outstandingGBP: round2(owing.reduce((s, b) => s + outstandingOf(b), 0)),
      owingFamilies: [...owing].sort((a, b) => outstandingOf(b) - outstandingOf(a)).slice(0, 20).map(compact),
    },
    openTasks,
    counts: { listings: listingsSnap.size, activeBlocks: blocksSnap.docs.filter((d) => (d.data() as BlockDoc).open).length },
  };
}

// ── Parent snapshot — the family's own world: bookings, children, credit. ──
async function familySnapshot(email: string, uid: string) {
  const [bookingsSnap, childrenSnap, wallets, threadsSnap, memSnap] = await Promise.all([
    db.collection("bookings").where("email", "==", email).get(),
    db.collection("children").where("parentUid", "==", uid).get(),
    walletsForFamily(email),
    db.collection("threads").where("parentEmail", "==", email).get(),
    db.collection("memberships").where("email", "==", email).get(),
  ]);
  const bookings = bookingsSnap.docs.map((d) => fromDoc(d.data() as BookingDoc));
  const tenantIds = [...new Set(bookings.map((b) => b.tenantId).filter(Boolean) as string[])].slice(0, 30);
  const tenants = tenantIds.length ? await db.getAll(...tenantIds.map((id) => db.collection("tenants").doc(id))) : [];
  const providerName = new Map(tenants.filter((t) => t.exists).map((t) => [t.id, (t.data()!.name as string) ?? "Your provider"]));
  // Recent provider news (Firestore `in` caps at 10 tenants).
  const provTids = tenantIds.slice(0, 10);
  const postsSnap = provTids.length ? await db.collection("posts").where("tenantId", "in", provTids).get() : null;
  const posts = (postsSnap?.docs ?? []).map((d) => d.data() as { tenantId?: string; title?: string; status?: string; createdAt?: string })
    .filter((p) => p.status === "published").sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, 5);
  const threads = threadsSnap.docs.map((d) => d.data() as { tenantName?: string; subject?: string; lastFrom?: string; parentUnread?: number });
  const memRows = memSnap.docs.map((d) => d.data() as { tenantId?: string; tierName?: string; status?: string; benefitType?: string; benefitValue?: number });

  return {
    children: childrenSnap.docs.map((d) => {
      const c = d.data() as { name?: string; age?: number; dob?: string };
      return { name: c.name, age: c.age ?? null };
    }),
    bookings: bookings.slice(0, 60).map((b) => ({
      ref: b.ref, child: b.child, activity: b.listing,
      provider: providerName.get(b.tenantId ?? "") ?? null,
      dates: b.dates, upcomingDays: (b.days ?? []).filter((d) => d >= new Date().toISOString().slice(0, 10)),
      status: b.status, pay: b.pay, amount: b.amount,
      outstanding: round2(outstandingOf(b)),
      cancelled: b.status === "Cancelled" ? { refund: b.cancel?.refund ?? null, amount: b.cancel?.amount ?? null } : null,
    })),
    storeCredit: wallets.map((w) => ({ provider: w.provider, balanceGBP: w.balance })),
    memberships: memRows.filter((m) => m.status === "active").map((m) => ({ provider: providerName.get(m.tenantId ?? "") ?? null, tier: m.tierName, benefit: m.benefitType, value: m.benefitValue })),
    messages: { unread: threads.reduce((s, t) => s + (t.parentUnread ?? 0), 0), recent: threads.filter((t) => (t.parentUnread ?? 0) > 0).slice(0, 5).map((t) => ({ provider: t.tenantName, subject: t.subject, from: t.lastFrom })) },
    recentNews: posts.map((p) => ({ provider: providerName.get(p.tenantId ?? "") ?? null, title: p.title, date: p.createdAt })),
  };
}

// ── Platform snapshot — the HQ overview aggregates. ──
async function platformSnapshot() {
  const [tenantsSnap, bookingsSnap, listingsSnap, usersSnap] = await Promise.all([
    db.collection("tenants").get(),
    db.collection("bookings").get(),
    db.collection("listings").get(),
    db.collection("users").get(),
  ]);
  const tenants = tenantsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as { name: string; type: string; createdAt?: string }) }));
  const byType: Record<string, number> = {};
  for (const t of tenants) byType[t.type] = (byType[t.type] ?? 0) + 1;
  const byStatus: Record<string, number> = {};
  let bookedValue = 0, paidValue = 0, refundsPending = 0;
  for (const d of bookingsSnap.docs) {
    const b = d.data() as BookingDoc;
    byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
    bookedValue += b.amount || 0;
    if (b.pay === "Paid") paidValue += b.amount || 0;
    if (b.cancel?.refund === "pending") refundsPending++;
  }
  const byRole: Record<string, number> = {};
  for (const d of usersSnap.docs) {
    const role = (d.data().role as string) || "parent";
    byRole[role] = (byRole[role] ?? 0) + 1;
  }
  return {
    providers: {
      total: tenants.length, byType,
      recent: [...tenants].sort((a, b) => ((a.createdAt ?? "") < (b.createdAt ?? "") ? 1 : -1)).slice(0, 8).map((t) => ({ name: t.name, type: t.type, createdAt: t.createdAt ?? null })),
    },
    bookings: { total: bookingsSnap.size, byStatus, bookedValueGBP: round2(bookedValue), paidValueGBP: round2(paidValue), refundsPending },
    listings: { total: listingsSnap.size },
    accounts: { total: usersSnap.size, byRole },
  };
}

ai.post("/chat", async (req, res) => {
  if (!process.env.GROQ_API_KEY) {
    res.status(503).json({ error: "The AI assistant isn't configured on this server (GROQ_API_KEY is missing)." });
    return;
  }
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Send { messages: [{ role, content }] }" });
    return;
  }

  const auth = req.auth!;
  let snapshot: unknown;
  let who: string;
  let howtoKey: keyof typeof HOWTO = "operator";
  if (auth.role === "parent") {
    const email = req.user?.email;
    if (!email) { res.status(400).json({ error: "Account has no email address" }); return; }
    snapshot = await familySnapshot(email, req.user!.uid);
    howtoKey = "parent";
    who = "a parent using the customer portal. The data is their own family's: their children, their bookings across providers, and their store credit. Their portal's areas are: Browse activities, My bookings, Payments (paying what's owed), Wallet (store credit), Children, Schedule, Messages.";
  } else if (auth.role === "platform") {
    snapshot = await platformSnapshot();
    howtoKey = "platform";
    who = "the ActivityOS platform super-admin. The data is platform-wide aggregates across every provider.";
  } else {
    const scope = operatorScope(req, res);
    if (!scope || !scope.tenantId) return; // operatorScope has already responded
    const isStaff = auth.role === "staff";
    snapshot = await tenantSnapshot(scope.tenantId, isStaff);
    howtoKey = isStaff ? "staff" : "operator";
    who = isStaff
      ? "a front-line staff member (e.g. a coach or activity leader) at an activity provider. The data is TODAY's operational picture only — the sessions running, the children expected in, and the team's tasks. You do NOT have their finances, revenue, who owes money, or booking approvals: those are the manager's, not a staff member's. If they ask about money, payments, owing families or approving bookings, say that's handled by their manager and you can't see it. Their portal's areas are: Dashboard, Timetable, Registers, Tasks, Messages."
      : "the owner/manager of a children's activity provider. The data is their business's live operational picture. Their portal's areas include: Dashboard, Bookings, Listings, Blocks & pricing, Registers, Families, Finances, Tasks, Messages.";
  }

  // Resolve the portal (for correct deep-link URLs). Trust the client's value
  // when it's consistent with the role; else fall back to the role's home.
  const roleDefaultPortal = auth.role === "parent" ? "custdash" : auth.role === "platform" ? "platform" : auth.role === "staff" ? "staff" : "company";
  const portal = parsed.data.portal ?? roleDefaultPortal;

  const today = new Date();
  const system = [
    "You are the ActivityOS assistant, embedded in a platform for children's activity providers (camps, clubs, classes).",
    `You are talking to ${who}`,
    `Today is ${today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" })}, and the current UK time is ${today.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" })}. Use this time to judge which of today's sessions are running now, still to come, or already finished.`,
    "You are an expert on this platform and genuinely helpful. There are two kinds of question and you handle BOTH well:",
    "1) DATA questions ('who's in today?', 'how much have I taken?', 'any allergies in?', 'how full is X?', 'what are my biggest expenses?', 'which coupons are live?', 'am I owed on invoices?', 'anything low on stock?', 'any unread messages?') — answer from the LIVE DATA below. Read it ALL carefully; the answer is very often in there: today's attendance & care flags (SEND/allergy/medical/dietary), sessions, bookings & approvals, listings with fill, families, team roster, incidents, and — for operators — finances (received this week/month/year, other income, expenses by category, invoices outstanding/overdue), marketing (coupons, memberships/MRR, referrals), inventory low-stock, messages unread, newsfeed & moments counts. Never invent names, numbers or bookings, and never state a figure that isn't derivable from the data.",
    "WHAT YOU CANNOT SEE (these live in the browser, not your data): the live day-rota / who is physically working today, clock-in & timesheets, staff holiday/absence, appraisals, learning/course completions & DBS/credential expiry, payroll, staff availability, the policy documents library, and milestone progress. If asked about any of these, say plainly you can't see it here and link the user to the right screen (use the NAVIGATION paths) — e.g. Schedule for the rota, Compliance & certificates for DBS, Learning Centre for training, Documents for policies. Do not guess.",
    "2) HOW-TO questions ('how do I take a register?', 'how do I add a listing / refund / message parents?') — answer from the HOW-TO GUIDE below with clear, numbered, step-by-step instructions naming the exact screens.",
    "NEVER reply with a bare 'I don't know' or 'I don't have that.' Always give the most useful answer you can: answer from the data if it's there; if a specific record genuinely isn't in the data, say what you CAN see and then tell them precisely where in the app to find or do the rest (and, if it's a how-to, give the steps). Be confident and practical.",
    "The ONE thing you cannot see is the live day-rota (who is physically working today) — that's held in the Schedule screen, not your data. If asked who's working today, say so and point to Schedule/Timetable; you CAN still name the team roster from the data.",
    "Money is in GBP — format amounts like £42.50. Be concise and concrete: lead with the answer, then only the supporting details that matter. Plain text, short paragraphs or simple bullet lists, no markdown tables.",
    "You are read-only: you cannot book, cancel, refund or message anyone yourself. When an action is wanted, give the steps and where to do it.",
    "",
    "LINKS — you can send the user straight to any screen. Whenever you tell them where to go, include a markdown link with the EXACT path from the NAVIGATION list below, e.g. [Discount codes](/" + portal + "/marketing) or [Setup → Payments](/" + portal + "/setup?tab=bookings). Use only paths from that list; never invent a path. Prefer ONE precise link per answer.",
    "ADVICE & CROSS-REFERENCING — when a question needs two things joined (e.g. children with allergies who haven't signed in; top families who also owe money; a fast-filling listing to add a session to), do the cross-reference yourself from the data. For 'should I…' questions, give a clear recommendation grounded in the numbers, and label it as a suggestion. If a list in the data is capped (e.g. top-N families/children) and the exact record isn't shown, say you're showing the busiest/top items and link to the full screen.",
    "TIME/TRENDS LIMIT — the data is a live snapshot (mostly today + this week). You do NOT have historical trends or last-month figures. If asked to compare periods or show a trend, say so briefly and link to Finance & analytics; don't invent past numbers.",
    "",
    `HOW-TO GUIDE (where things are done in the app):\n• ${HOWTO[howtoKey]}`,
    "",
    `NAVIGATION (exact deep-link paths for this user's portal):\n${navRef(portal)}`,
    "",
    `LIVE DATA (everything you can see — read it all before answering):\n${JSON.stringify(snapshot)}`,
  ].join("\n");

  const groqRes = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: system }, ...parsed.data.messages],
      temperature: 0.3,
      // gpt-oss are reasoning models: give headroom so the answer survives the
      // reasoning budget, and keep that reasoning light so replies stay snappy.
      max_tokens: MODEL.includes("gpt-oss") ? 1600 : 700,
      ...(MODEL.includes("gpt-oss") ? { reasoning_effort: "low" as const } : {}),
    }),
  });
  if (!groqRes.ok) {
    const detail = await groqRes.text().catch(() => "");
    console.error(`[ai] Groq ${groqRes.status}: ${detail.slice(0, 500)}`);
    res.status(502).json({ error: "The assistant couldn't reach its model just now — try again in a moment." });
    return;
  }
  const data = (await groqRes.json()) as { choices?: { message?: { content?: string } }[] };
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    res.status(502).json({ error: "The assistant returned an empty answer — try again." });
    return;
  }
  res.json({ reply });
});

// POST /api/ai/compose — draft a newsfeed post from a template + a few details.
// Unlike /chat (read-only Q&A over live data), this WRITES: the operator gives
// the gist and the specifics, picks a length, and gets back {title, body}.
const TPL_GUIDE: Record<string, string> = {
  announce: "A general announcement to families. Informative and warm.",
  event: "An event invitation. Lead with what/where/when, mention it's great to see families there, and that they can RSVP in the app.",
  reminder: "A short, actionable reminder. One or two sentences, clear about what to do and by when.",
  urgent: "An urgent notice (e.g. a closure or early pick-up). Be calm, clear and reassuring; state exactly what is happening and what the parent must do. Do NOT be alarmist.",
  celebrate: "A warm celebration or shout-out. Upbeat and positive; name achievements if given.",
  booking: "A friendly nudge to book a listing. Create light urgency (limited spaces / early-bird) only if that's given, and end pointing at the booking button.",
};
const composeSchema = z.object({
  kind: z.enum(["announce", "event", "reminder", "urgent", "celebrate", "booking"]),
  notes: z.string().trim().min(1).max(1_500),                 // "what do you want to tell parents"
  fields: z.record(z.string(), z.string().max(300)).optional(), // date/time/cost/location/listing…
  length: z.enum(["short", "medium", "long"]).optional(),
});
ai.post("/compose", async (req, res) => {
  if (!process.env.GROQ_API_KEY) { res.status(503).json({ error: "The AI writer isn't configured on this server (GROQ_API_KEY is missing)." }); return; }
  const auth = req.auth!;
  if (!(auth.role === "company" || auth.role === "freelancer" || auth.role === "franchise" || auth.role === "staff")) { res.status(403).json({ error: "Operators only" }); return; }
  const parsed = composeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Send { kind, notes, fields?, length? }" }); return; }
  const { kind, notes, fields, length } = parsed.data;
  const len = length ?? "medium";
  const lenGuide = len === "short" ? "1 short sentence (under 25 words)." : len === "long" ? "a warm short paragraph (about 4-6 sentences)." : "2-3 clear sentences.";
  const detail = fields && Object.keys(fields).length ? Object.entries(fields).filter(([, v]) => v && v.trim()).map(([k, v]) => `- ${k}: ${v}`).join("\n") : "(none given)";
  const system = [
    "You write announcements from a UK children's activity provider (camp/club/class) to parents, shown in the parents' app.",
    `This is a ${kind} post. ${TPL_GUIDE[kind]}`,
    `Length of the message body: ${lenGuide}`,
    "Voice: warm, clear, professional, British English. Money in GBP like £30. Use ONLY the facts given — never invent dates, prices, names or numbers. Do not use hashtags. Avoid emojis unless it is a celebration, and then at most one.",
    "Respond with ONLY a compact JSON object of the form {\"title\":\"…\",\"body\":\"…\"} — a short punchy title and the message body. No markdown, no code fences, no commentary.",
  ].join("\n");
  const userMsg = `What the provider wants to say:\n${notes}\n\nSpecifics to include:\n${detail}`;
  const groqRes = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: system }, { role: "user", content: userMsg }], temperature: 0.6, max_tokens: 500, response_format: { type: "json_object" } }),
  });
  if (!groqRes.ok) { const d = await groqRes.text().catch(() => ""); console.error(`[ai] compose Groq ${groqRes.status}: ${d.slice(0, 300)}`); res.status(502).json({ error: "The writer couldn't reach its model just now — try again." }); return; }
  const data = (await groqRes.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
  try {
    const obj = JSON.parse(raw) as { title?: string; body?: string };
    if (!obj.body) throw new Error("empty");
    res.json({ title: (obj.title ?? "").slice(0, 160), body: obj.body.slice(0, 4_000) });
  } catch { res.json({ title: "", body: raw.slice(0, 4_000) }); } // model didn't return clean JSON — use the text
});

// POST /api/ai/compose-newsletter — fill a whole newsletter from one short brief.
// The client sends the ordered text-bearing blocks (index + type); the model
// returns content per index, which the client drops into each slot.
const nlComposeSchema = z.object({
  brief: z.string().trim().min(1).max(2_000),
  company: z.string().trim().max(120).optional(),
  blocks: z.array(z.object({ i: z.number().int().nonnegative(), t: z.string().max(20) })).min(1).max(40),
});
ai.post("/compose-newsletter", async (req, res) => {
  if (!process.env.GROQ_API_KEY) { res.status(503).json({ error: "The AI writer isn't configured on this server (GROQ_API_KEY is missing)." }); return; }
  const auth = req.auth!;
  if (!(auth.role === "company" || auth.role === "freelancer" || auth.role === "franchise" || auth.role === "staff")) { res.status(403).json({ error: "Operators only" }); return; }
  const parsed = nlComposeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Send { brief, company?, blocks:[{i,t}] }" }); return; }
  const { brief, company, blocks } = parsed.data;
  const system = [
    "You write a parents' newsletter for a UK children's activity provider (camp/club/class), filling a fixed set of content blocks from the provider's brief.",
    company ? `The provider is called ${company}.` : "",
    "For each block index, return content suited to its TYPE:",
    "- hero: { heading (a punchy title, ≤8 words), body (one warm sentence) }",
    "- heading: { heading (a short section title, ≤6 words) }",
    "- text: { body (2-3 clear sentences) }",
    "- columns: { left (a short item, 1-2 sentences), right (a second short item) }",
    "- quote: { body (a short uplifting quote), heading (who said it, e.g. '— Mrs Smith') }",
    "- discount: { code (an UPPERCASE code ≤12 chars), codeDesc (one line on the offer) }",
    "Voice: warm, clear, British English. Money in GBP like £30. Use ONLY facts in the brief — never invent prices, dates, names or numbers; leave specifics general if not given.",
    "Respond with ONLY a JSON object whose keys are the block index numbers (as strings) and whose values are the field objects above. No prose, no code fences.",
  ].filter(Boolean).join("\n");
  const userMsg = `Brief:\n${brief}\n\nBlocks to fill:\n${blocks.map((b) => `- index ${b.i}: ${b.t}`).join("\n")}`;
  const groqRes = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: system }, { role: "user", content: userMsg }], temperature: 0.6, max_tokens: 1_200, response_format: { type: "json_object" } }),
  });
  if (!groqRes.ok) { const d = await groqRes.text().catch(() => ""); console.error(`[ai] nl Groq ${groqRes.status}: ${d.slice(0, 300)}`); res.status(502).json({ error: "The writer couldn't reach its model just now — try again." }); return; }
  const data = (await groqRes.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content?.trim() ?? "{}";
  try { res.json({ blocks: JSON.parse(raw) as Record<string, Record<string, string>> }); }
  catch { res.status(502).json({ error: "The writer returned something unexpected — try again." }); }
});
