import { Router } from "express";
import { db } from "../firebase";

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
  const out: Record<string, unknown> = {
    account: {
      email: req.user?.email ?? null,
      name: (userDoc.data()?.name as string) ?? req.user?.name ?? "",
      phone: (userDoc.data()?.phone as string) ?? "",
      marketingConsent: userDoc.data()?.marketingConsent ?? false,
      role: auth.role,
    },
  };
  if (auth.role === "parent") {
    const kids = await db.collection("children").where("parentUid", "==", uid).get();
    const childIds = kids.docs.map((d) => d.id).slice(0, 10);
    const [bookings, orders] = await Promise.all([
      email ? db.collection("bookings").where("email", "==", email).get() : Promise.resolve({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }),
      db.collection("mealOrders").where("parentEmail", "==", email).get(),
    ]);
    const [meds, moments] = childIds.length
      ? await Promise.all([
          db.collection("medications").where("childId", "in", childIds).get(),
          db.collection("moments").where("childIds", "array-contains-any", childIds).get(),
        ])
      : [{ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }, { docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }];
    const strip = (d: FirebaseFirestore.QueryDocumentSnapshot) => ({ id: d.id, ...d.data() });
    out.children = kids.docs.map(strip);
    out.bookings = bookings.docs.map(strip);
    out.mealOrders = orders.docs.map(strip);
    out.medications = meds.docs.map(strip);
    out.moments = moments.docs.map(strip);
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
  await db.collection("deletionRequests").add({
    uid,
    email: req.user?.email ?? null,
    role: req.auth!.role,
    reason,
    status: "pending",
    requestedAt: new Date().toISOString(),
  });
  res.status(201).json({ ok: true });
});
