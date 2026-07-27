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
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

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
});

const round2 = (n: number) => Math.round(n * 100) / 100;
const OWES = new Set(["Unpaid", "Invoice sent", "Awaiting voucher payment", "Partially paid"]);
const outstandingOf = (b: Booking) => Math.max(0, (b.amount ?? 0) - (b.amountPaid ?? 0));
const RECEIVED = new Set(["recorded", "succeeded"]);

// ── Operator snapshot — the dashboard's numbers plus a compact booking list
// so "who's in today" and "who still owes" have names, not just totals. ──
async function tenantSnapshot(tenantId: string) {
  const [bookingsSnap, blocksSnap, listingsSnap, paymentsSnap, tasksSnap] = await Promise.all([
    db.collection("bookings").where("tenantId", "==", tenantId).get(),
    db.collection("blocks").where("tenantId", "==", tenantId).get(),
    db.collection("listings").where("tenantId", "==", tenantId).get(),
    db.collection("payments").where("tenantId", "==", tenantId).get(),
    db.collection("tasks").where("tenantId", "==", tenantId).get(),
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

  return {
    today: {
      date: today,
      sessions: sessions.filter((s) => s.date === today).map((s) => ({ listing: s.listing, start: s.start, end: s.end, booked: s.booked, capacity: s.capacity })),
      expectedChildren: inToday.slice(0, 80).map((b) => ({ child: b.child, listing: b.listing, family: b.booker })),
    },
    upcomingSessions: sessions.filter((s) => s.date >= today && s.open).slice(0, 10)
      .map((s) => ({ date: s.date, start: s.start, end: s.end, listing: s.listing, spotsLeft: s.spotsLeft })),
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
  const [bookingsSnap, childrenSnap, wallets] = await Promise.all([
    db.collection("bookings").where("email", "==", email).get(),
    db.collection("children").where("parentUid", "==", uid).get(),
    walletsForFamily(email),
  ]);
  const bookings = bookingsSnap.docs.map((d) => fromDoc(d.data() as BookingDoc));
  const tenantIds = [...new Set(bookings.map((b) => b.tenantId).filter(Boolean) as string[])].slice(0, 30);
  const tenants = tenantIds.length ? await db.getAll(...tenantIds.map((id) => db.collection("tenants").doc(id))) : [];
  const providerName = new Map(tenants.filter((t) => t.exists).map((t) => [t.id, (t.data()!.name as string) ?? "Your provider"]));

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
  if (auth.role === "parent") {
    const email = req.user?.email;
    if (!email) { res.status(400).json({ error: "Account has no email address" }); return; }
    snapshot = await familySnapshot(email, req.user!.uid);
    who = "a parent using the customer portal. The data is their own family's: their children, their bookings across providers, and their store credit. Their portal's areas are: Browse activities, My bookings, Payments (paying what's owed), Wallet (store credit), Children, Schedule, Messages.";
  } else if (auth.role === "platform") {
    snapshot = await platformSnapshot();
    who = "the ActivityOS platform super-admin. The data is platform-wide aggregates across every provider.";
  } else {
    const scope = operatorScope(req, res);
    if (!scope || !scope.tenantId) return; // operatorScope has already responded
    snapshot = await tenantSnapshot(scope.tenantId);
    who = auth.role === "staff"
      ? "a staff member at an activity provider. The data is their employer's live operational picture. Their portal's areas are: Dashboard, Timetable, Registers, Tasks, Messages."
      : "the owner/manager of a children's activity provider. The data is their business's live operational picture. Their portal's areas include: Dashboard, Bookings, Listings, Blocks & pricing, Registers, Families, Finances, Tasks, Messages.";
  }

  const today = new Date();
  const system = [
    "You are the ActivityOS assistant, embedded in a platform for children's activity providers (camps, clubs, classes).",
    `You are talking to ${who}`,
    `Today is ${today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.`,
    "Answer ONLY from the live data below. It is the complete extent of what you can see — if the answer isn't in it, say so plainly and point at the area of the app that covers it (Bookings, Registers, Finances, Messages…). Never invent names, numbers or bookings.",
    "Money is in GBP — format amounts like £42.50. Be concise and concrete: lead with the answer, then only the supporting details that matter. Plain text, no markdown tables.",
    "You are read-only: you cannot book, cancel, refund or message anyone. When an action is wanted, say where in the app to do it.",
    "",
    `LIVE DATA:\n${JSON.stringify(snapshot)}`,
  ].join("\n");

  const groqRes = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: system }, ...parsed.data.messages],
      temperature: 0.3,
      max_tokens: 700,
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
