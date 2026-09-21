import { Router } from "express";
import { db } from "../firebase";
import { notify } from "../lib/notify";
import { ukTodayPlus } from "../lib/ukDate";

// Data & privacy (shared, every portal) — the user's GDPR surface: see what's
// held, download it, and request deletion. Deletion is a RECORDED REQUEST, not
// an immediate cascade wipe (a parent's data is spread across providers and
// bound up with safeguarding records a provider must retain) — the request is
// logged for the platform/provider to action lawfully.
export const privacy = Router();

// Gather the caller's own personal data. Parents have the richest footprint
// (children + everything attached to them); operators mostly have their account
// (their tenant's data is the business's, handled separately).
async function gather(req: import("express").Request) {
  const auth = req.auth!;
  const uid = req.user!.uid;
  const email = (req.user?.email ?? "").toLowerCase();
  const userDoc = await db.collection("users").doc(uid).get();
  type Snap = FirebaseFirestore.QueryDocumentSnapshot;
  const none = { docs: [] as Snap[] };
  const strip = (d: Snap) => ({ id: d.id, ...d.data() });
  const byEmail = (col: string, field = "email") => (email ? db.collection(col).where(field, "==", email).get() : Promise.resolve(none));
  const out: Record<string, unknown> = {
    account: {
      email: req.user?.email ?? null,
      name: (userDoc.data()?.name as string) ?? req.user?.name ?? "",
      phone: (userDoc.data()?.phone as string) ?? "",
      marketingConsent: userDoc.data()?.marketingConsent ?? false,
      role: auth.role,
    },
    // Everything else on the account record (address, preferences, the
    // details given at sign-up, when it was closed/reopened …) — the export
    // used to stop at name/phone. Credentials and internal keys aren't personal
    // data about them and stay out.
    profile: Object.fromEntries(Object.entries(userDoc.data() ?? {}).filter(([k]) => !/token|secret|hash|password|stripe|fcm|^caps$/i.test(k))),
  };
  // Every portal: the alerts sent to them and any deletion request they made.
  const [bell, delReqs] = await Promise.all([
    email ? db.collection("notifications").where(auth.role === "parent" ? "email" : "toEmail", "==", email).get() : Promise.resolve(none),
    db.collection("deletionRequests").where("uid", "==", uid).get(),
  ]);
  out.notifications = bell.docs.map((d) => { const n = d.data(); return { id: d.id, tenantId: n.tenantId, category: n.category, title: n.title, body: n.body, at: n.at, readAt: n.readAt ?? null }; });
  out.deletionRequests = delReqs.docs.map(strip);
  if (auth.role === "staff" && auth.tenantId) {
    // A member of staff's OWN records with the provider — what their own
    // screens already show them (My shifts/timesheet, leave, expenses,
    // availability, learning, documents read, appraisals, onboarding).
    const key = auth.franchiseId ? `${auth.tenantId}__fr__${auth.franchiseId}` : auth.tenantId;
    const myName = String(userDoc.get("name") ?? req.user?.name ?? "").trim().toLowerCase();
    const same = (v: unknown) => !!myName && String(v ?? "").trim().toLowerCase() === myName;
    const [clock, absences, claims, avail, reads, learning, appraisals, onboard] = await Promise.all([
      db.collection("clockRecords").where("uid", "==", uid).get(),
      byEmail("absences", "staffEmail"), db.collection("expenseClaims").where("staffUid", "==", uid).get(),
      byEmail("availabilityRequests", "staffEmail"), byEmail("docReads", "staffEmail"),
      db.collection("learningCompletions").where("key", "==", key).get(),
      byEmail("appraisalReviews", "staffEmail"),
      db.collection("onboardRecords").where("key", "==", key).get(),
    ]);
    out.timeclock = clock.docs.map(strip);
    out.leave = absences.docs.map(strip);
    out.expenseClaims = claims.docs.map(strip);
    out.availability = avail.docs.map(strip);
    out.documentsRead = reads.docs.map(strip);
    out.learning = learning.docs.filter((d) => d.get("uid") === uid || same(d.get("staffName"))).map(strip);
    // As My appraisals shows it: the appraiser's working notes aren't theirs
    // until the review is put to them (routes/appraisals.ts).
    out.appraisals = appraisals.docs.map((d) => {
      const r = (d.get("review") ?? {}) as { status?: string };
      return { id: d.id, review: r.status === "signoff" || r.status === "complete" ? r : { ...r, manager: { ratings: [] } } };
    });
    // Their onboarding record. Referees' replies are held in `references` and
    // aren't part of it — a confidential reference is exempt from a self-serve copy.
    out.onboarding = onboard.docs.filter((d) => same(d.get("staff"))).map((d) => ({ id: d.id, values: d.get("values") ?? {}, extra: d.get("extra") ?? [], submittedAt: d.get("submittedAt") ?? null, updatedAt: d.get("updatedAt") ?? null }));
  }
  if (auth.role === "parent") {
    // Everything held about the family, across every provider they've used.
    // The export used to cover five collections, and `.slice(0, 10)` silently
    // dropped an 11th child onwards (Firestore's `in` limit) — so it's now
    // chunked, and covers payments, messages, accidents/incidents, trip
    // consents, uploaded plans, memberships, wallet credit and the family
    // record each provider keeps.
    const kids = await db.collection("children").where("parentUid", "==", uid).get();
    const childIds = kids.docs.map((d) => d.id);
    const chunks = <T,>(xs: T[], n = 10) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
    const byChildren = async (col: string, field: string, op: "in" | "array-contains-any") =>
      (await Promise.all(chunks(childIds).map((c) => db.collection(col).where(field, op, c).get()))).flatMap((q) => q.docs);
    const [bookings, orders, payments, threads, memberships, wallets, walletEntries, customers, files, feedback, referred, referredBy, prefs] = await Promise.all([
      byEmail("bookings"), byEmail("mealOrders", "parentEmail"), byEmail("payments"), byEmail("threads", "parentEmail"),
      byEmail("memberships"), byEmail("wallet"), byEmail("walletEntries"), byEmail("customers"),
      db.collection("childFiles").where("ownerUid", "==", uid).get(),
      byEmail("feedback"), byEmail("referrals", "referrerEmail"), byEmail("referrals", "friendEmail"),
      email ? db.collection("notificationPrefs").doc(email).get() : Promise.resolve(null),
    ]);
    const [meds, doses, moments, incidents, trips] = await Promise.all([
      byChildren("medications", "childId", "in"),
      // The MAR — every dose given to their child (what, when, how much, by whom).
      byChildren("medicationAdmin", "childId", "in"),
      byChildren("moments", "childIds", "array-contains-any"),
      byChildren("incidents", "childId", "in"),
      byChildren("trips", "childIds", "array-contains-any"),
    ]);
    const threadIds = threads.docs.map((d) => d.id);
    const messages = (await Promise.all(chunks(threadIds).map((c) => db.collection("messages").where("threadId", "in", c).get()))).flatMap((q) => q.docs);
    const kidSet = new Set(childIds);
    // Register attendance for their bookings: signed in / absent / collected
    // (and by whom), nappy changes, and the notes staff shared with them. A
    // note staff kept internal stays with the provider — like a confidential
    // concern, it's for a formal request, not an automatic download.
    // Keyed block + booking ref (a register entry is `ref`, or `ref#child` for siblings).
    const myRefs = new Set(bookings.docs.filter((d) => d.get("ref") && d.get("blockId")).map((d) => `${d.get("blockId")}|${d.get("ref")}`));
    const blockIds = [...new Set(bookings.docs.map((d) => d.get("blockId") as string | undefined).filter((x): x is string => !!x))];
    const regs = (await Promise.all(chunks(blockIds).map((c) => db.collection("registers").where("blockId", "in", c).get()))).flatMap((q) => q.docs);
    const register: Record<string, unknown>[] = [];
    for (const r of regs) {
      const g = r.data() as { tenantId?: string; listingId?: string; blockId?: string; date?: string; entries?: Record<string, Record<string, unknown>>; notes?: Record<string, { text?: string; at?: string; archived?: boolean; shareParent?: boolean }>; nappies?: Record<string, { at?: string }[]> };
      const ours = (key: string) => myRefs.has(`${g.blockId}|${key.split("#")[0]}`);
      const keys = new Set([...Object.keys(g.entries ?? {}), ...Object.keys(g.nappies ?? {}), ...Object.keys(g.notes ?? {})].filter(ours));
      for (const k of keys) {
        const e = g.entries?.[k];
        const note = g.notes?.[k];
        register.push({
          tenantId: g.tenantId, listingId: g.listingId, blockId: g.blockId, date: g.date, booking: k,
          ...(e ? { status: e.status ?? null, signedInAt: e.inAt ?? null, collectedAt: e.collectedAt ?? null, collectedBy: e.collectedBy ?? null, absentReason: e.reason ?? null } : {}),
          nappyChanges: (g.nappies?.[k] ?? []).map((n) => n.at),
          ...(note && note.shareParent && !note.archived ? { note: { text: note.text, at: note.at } } : {}),
        });
      }
    }
    register.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    out.children = kids.docs.map(strip);
    out.bookings = bookings.docs.map(strip);
    out.payments = payments.docs.map(strip);
    out.mealOrders = orders.docs.map(strip);
    out.medications = meds.map(strip);
    out.medicationDoses = doses.map(strip);
    out.register = register;
    out.moments = moments.map(strip);
    // Accidents and incidents about their child. A confidential safeguarding
    // concern is withheld from a self-serve export (disclosure can put a child
    // at risk — it's a decision for the provider's DSL, not an automatic
    // download); its existence is not hidden from a formal request made to
    // the provider.
    // Exactly what the parent's own Accidents screen shows (incidents.ts):
    // accidents; behaviour incidents and safeguarding only when staff shared
    // them; nothing marked confidential unless shared.
    out.incidents = incidents.map(strip).filter((r) => {
      const x = r as { kind?: string; shareWithParent?: boolean; confidential?: boolean; subject?: string };
      if (x.shareWithParent === true) return true;
      return x.kind === "accident" && !x.confidential && x.subject !== "staff";
    });
    out.tripConsents = trips.map((d) => {
      const t = d.data() as { destination?: string; date?: string; tenantId?: string; attendees?: { childId?: string; n?: string; consent?: string; consentAt?: string; consentBy?: string }[] };
      return { tripId: d.id, tenantId: t.tenantId, destination: t.destination, date: t.date, children: (t.attendees ?? []).filter((a) => a.childId && kidSet.has(a.childId)) };
    });
    out.uploadedFiles = files.docs.map((d) => { const f = d.data() as { name?: string; contentType?: string; bytes?: number; createdAt?: string }; return { id: d.id, name: f.name, contentType: f.contentType, bytes: f.bytes, createdAt: f.createdAt }; });
    out.messageThreads = threads.docs.map(strip);
    out.messages = messages.map(strip);
    out.memberships = memberships.docs.map(strip);
    out.wallet = wallets.docs.map(strip);
    out.walletEntries = walletEntries.docs.map(strip);
    out.providerFamilyRecords = customers.docs.map(strip);
    out.feedback = feedback.docs.map(strip);
    // Referrals they made or came in through — the other family's email is theirs, not this one's.
    out.referrals = [
      ...referred.docs.map((d) => ({ as: "referrer", tenantId: d.get("tenantId"), reward: d.get("reward") ?? null, bookingRef: d.get("bookingRef") ?? null, at: d.get("at") ?? null })),
      ...referredBy.docs.map((d) => ({ as: "friend", tenantId: d.get("tenantId"), discount: d.get("friendDiscount") ?? d.get("friendOff") ?? null, bookingRef: d.get("bookingRef") ?? null, at: d.get("at") ?? null })),
    ];
    out.emailPreferences = prefs?.exists ? prefs.data() : null;
  }
  return out;
}

const counts = (data: Record<string, unknown>) => {
  const c: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) if (Array.isArray(v)) c[k] = v.length;
  return c;
};

// GET /api/privacy — what we hold (a summary of counts).
privacy.get("/", async (req, res) => {
  const data = await gather(req);
  res.json({ role: req.auth!.role, summary: counts(data) });
});

// GET /api/privacy/export — the full download of the caller's data.
privacy.get("/export", async (req, res) => {
  const data = await gather(req);
  res.json({ generatedAt: new Date().toISOString(), ...data });
});

// POST /api/privacy/delete-request — log a deletion request (does not wipe).
privacy.post("/delete-request", async (req, res) => {
  const uid = req.user?.uid;
  if (!uid) { res.status(400).json({ error: "No account" }); return; }
  const existing = await db.collection("deletionRequests").where("uid", "==", uid).where("status", "==", "pending").limit(1).get();
  if (!existing.empty) { res.json({ ok: true, alreadyRequested: true }); return; }
  const reason = typeof (req.body as { reason?: unknown })?.reason === "string" ? (req.body as { reason: string }).reason.slice(0, 1000) : null;
  const requestedAt = new Date().toISOString();
  // UK GDPR: one month to respond, from receipt. Counted in UK days — a UTC
  // day is yesterday's until 1am BST, which would shorten the clock by a day.
  const dueBy = ukTodayPlus(30);
  const reqRef = await db.collection("deletionRequests").add({
    uid,
    email: req.user?.email ?? null,
    role: req.auth!.role,
    reason,
    status: "pending",
    requestedAt,
    dueBy,
  });
  res.status(201).json({ ok: true });

  // Somebody has to be told. The request used to be written to a collection
  // nothing ever read — the statutory clock ran with nobody counting. Every
  // provider the family has booked with gets it on their bell (and email), and
  // it shows in HQ's bell (routes/platformNotifications.ts reads the pending ones).
  void (async () => {
    const email = (req.user?.email ?? "").toLowerCase();
    if (!email) return;
    const bs = await db.collection("bookings").where("email", "==", email).get();
    // Each provider the family booked with — and, inside a company, each
    // franchise that took the booking (its own bell and inbox).
    const pairs = [...new Set(bs.docs.map((d) => `${d.get("tenantId") ?? ""}|${d.get("franchiseId") ?? ""}`))].filter((p) => !p.startsWith("|"));
    for (const pair of pairs) {
      const [tenantId, fr] = pair.split("|");
      await notify({
        tenantId,
        franchiseId: fr || null,
        to: { kind: "tenant" },
        category: "message",
        title: `Data deletion request from ${req.user?.name ?? email}`,
        body: `${email} has asked for their personal data to be deleted. You must respond within one month (by ${new Date(`${dueBy}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC" })}). Safeguarding and legally required records are kept — decide what can go, and reply to the family.`,
        href: "/company/customers",
        ref: reqRef.id,
      });
    }
  })().catch((e) => console.error("[privacy] deletion notify:", (e as Error).message));
});
