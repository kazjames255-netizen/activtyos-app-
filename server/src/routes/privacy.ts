import { Router } from "express";
import { db } from "../firebase";
import { notify } from "../lib/notify";
import { familyBooking } from "../lib/familyView";
import { exportChildLearning } from "../lib/hubPrivacy";
import { ukTodayPlus } from "../lib/ukDate";
import { decryptSensitive, ownName } from "./onboarding";
import { parentIncidentView, parentMedicationView, parentDoseView, parentMomentView, parentCustomerView } from "../lib/parentViews";
import { forViewing } from "./moments";
import { whereEmail } from "../lib/emailCase";

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
  // Case-insensitive (one `in` query over the usual spellings): rows stored as "Pa@Example.com" belong to pa@example.com too.
  const byEmail = (col: string, field = "email") => (email ? whereEmail(db, col, field, email) : Promise.resolve(none));
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
    byEmail("notifications", auth.role === "parent" ? "email" : "toEmail"),
    db.collection("deletionRequests").where("uid", "==", uid).get(),
  ]);
  out.notifications = bell.docs.map((d) => { const n = d.data(); return { id: d.id, tenantId: n.tenantId, category: n.category, title: n.title, body: n.body, ref: n.ref ?? null, at: n.at, readAt: n.readAt ?? null }; });
  out.deletionRequests = delReqs.docs.map(strip);
  if (auth.role === "staff" && auth.tenantId) {
    // A member of staff's OWN records with the provider — what their own
    // screens already show them (My shifts/timesheet, leave, expenses,
    // availability, learning, documents read, appraisals, onboarding).
    const key = auth.franchiseId ? `${auth.tenantId}__fr__${auth.franchiseId}` : auth.tenantId;
    // Matched the way the onboarding API matches: by name, but ONLY when no other account in the same pay scope carries it
    // (ownName returns "" then). Two staff called the same must never read each other's bank details / NI number.
    const myName = (await ownName(uid)).trim().toLowerCase();
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
    // decryptSensitive: it's their own record (same access rule as the API),
    // so the export shows the real bank/NI values rather than ciphertext.
    out.onboarding = onboard.docs.filter((d) => same(d.get("staff"))).map((d) => decryptSensitive({ id: d.id, values: (d.get("values") ?? {}) as Record<string, Record<string, unknown>>, extra: d.get("extra") ?? [], submittedAt: d.get("submittedAt") ?? null, updatedAt: d.get("updatedAt") ?? null }));
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
    out.bookings = bookings.docs.map((d) => familyBooking(strip(d) as never)); // the family's own view of its bookings (no internal refund bookkeeping)
    out.payments = payments.docs.map(strip);
    out.mealOrders = orders.docs.map(strip);
    out.medications = meds.map((d) => parentMedicationView(strip(d)));
    out.medicationDoses = doses.map((d) => parentDoseView(strip(d)));
    out.register = register;
    // As the Moments feed shows them (a photo whose consent has since been withdrawn is hidden; only this family's own child is named).
    out.moments = (await forViewing(moments.map(strip) as (Record<string, unknown> & { childIds?: string[] })[], "parent")).map((m) => parentMomentView(m, childIds, uid));
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
      if (x.confidential === true) return false; // confidential ALWAYS wins over sharing (health run H50)
      if (x.shareWithParent === true) return true;
      return x.kind === "accident" && !x.confidential && x.subject !== "staff";
    }).map((r) => parentIncidentView(r as Record<string, unknown>)); // the same allow-list the parent's list uses: a shared concern's DSL internals stay with the provider
    // An alert that was sent about a confidential record carries no text in the export either (older ones were sent with the record's wording).
    const confidentialIds = new Set(incidents.filter((d) => d.get("confidential") === true).map((d) => d.id));
    if (confidentialIds.size && Array.isArray(out.notifications)) {
      out.notifications = (out.notifications as { ref?: string | null }[]).map((n) => (n.ref && confidentialIds.has(n.ref) ? { ...n, title: "A record was made", body: "" } : n));
    }
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
    out.providerFamilyRecords = customers.docs.map((d) => parentCustomerView(strip(d))); // not the provider's private notes
    out.feedback = feedback.docs.map(strip);
    // Referrals they made or came in through — the other family's email is theirs, not this one's.
    out.referrals = [
      ...referred.docs.map((d) => ({ as: "referrer", tenantId: d.get("tenantId"), reward: d.get("reward") ?? null, bookingRef: d.get("bookingRef") ?? null, at: d.get("at") ?? null })),
      ...referredBy.docs.map((d) => ({ as: "friend", tenantId: d.get("tenantId"), discount: d.get("friendDiscount") ?? d.get("friendOff") ?? null, bookingRef: d.get("bookingRef") ?? null, at: d.get("at") ?? null })),
    ];
    out.emailPreferences = prefs?.exists ? prefs.data() : null;
    // Learning Hub: enrolments, homework hand-ins + marks, flashcard progress, quiz attempts, mastery, lesson attendance.
    Object.assign(out, await exportChildLearning(uid, childIds));
  }
  return out;
}

const counts = (data: Record<string, unknown>) => {
  const c: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) if (Array.isArray(v)) c[k] = v.length;
  return c;
};

// HQ "acting as" a family must not download that family's full personal data or file a deletion request in their name: both are the
// account holder's own act (UK GDPR rights). Refused with a plain message; the attempt is still in the impersonation audit log.
function refuseWhileImpersonating(req: import("express").Request, res: import("express").Response): boolean {
  if (!req.impersonating) return false;
  res.status(403).json({ error: "You're viewing this account as support. Only the account holder can download their data or ask for it to be deleted.", code: "impersonating" });
  return true;
}

// GET /api/privacy — what we hold (a summary of counts).
privacy.get("/", async (req, res) => {
  const data = await gather(req);
  res.json({ role: req.auth!.role, summary: counts(data) });
});

// GET /api/privacy/export — the full download of the caller's data.
privacy.get("/export", async (req, res) => {
  if (refuseWhileImpersonating(req, res)) return;
  const data = await gather(req);
  res.json({ generatedAt: new Date().toISOString(), ...data });
});

// POST /api/privacy/delete-request — log a deletion request (does not wipe).
privacy.post("/delete-request", async (req, res) => {
  if (refuseWhileImpersonating(req, res)) return;
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
    const bs = await whereEmail(db, "bookings", "email", email);
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
