import { Router } from "express";
import { db } from "../firebase";
import { countsTowardCapacity } from "../lib/blockDomain";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";

// Operator-wide child lookup — the "Find a child" popup in the portal header.
// Scoped to children booked with the caller's tenant, joined to the parent's
// name / contact / postcode so staff can find a child by who they are or where
// they live, then open the same safeguarding card the register/bookings show.
export const children = Router();

const CARD_ROLES = new Set(["company", "franchise", "freelancer", "staff", "platform"]);

/** childId → the parent contact + a representative booking ref, for this tenant. */
async function bookedChildren(tenantId: string) {
  const map = new Map<string, { parentName: string; email: string; phone: string; ref: string }>();
  const blocks = await db.collection("blocks").where("tenantId", "==", tenantId).get();
  if (blocks.empty) return map;
  const snaps = await Promise.all(blocks.docs.map((d) => db.collection("bookings").where("blockId", "==", d.id).get()));
  for (const s of snaps)
    for (const d of s.docs) {
      const b = fromDoc(d.data() as BookingDoc);
      if (!countsTowardCapacity(b.status) || b.status === "Offered") continue;
      const kids = b.kids?.length ? b.kids : [{ childId: b.childId }];
      for (const k of kids) {
        if (k.childId && !map.has(k.childId)) map.set(k.childId, { parentName: b.booker ?? "", email: b.email ?? "", phone: b.phone ?? "", ref: b.ref });
      }
    }
  return map;
}

async function postcodesFor(docs: FirebaseFirestore.DocumentSnapshot[]) {
  const uids = [...new Set(docs.filter((d) => d.exists).map((d) => (d.data() as { parentUid?: string }).parentUid).filter((u): u is string => !!u))];
  const userDocs = uids.length ? await db.getAll(...uids.map((u) => db.collection("users").doc(u))) : [];
  return new Map(userDocs.filter((u) => u.exists).map((u) => [u.id, (u.data() as { postcode?: string }).postcode ?? ""] as const));
}

// GET /api/children/lookup — the searchable list (name, parent, where they live).
children.get("/lookup", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !CARD_ROLES.has(auth.role)) { res.status(403).json({ error: "Requires an operator or staff account" }); return; }
  const idx = await bookedChildren(auth.tenantId);
  if (!idx.size) { res.json([]); return; }
  const ids = [...idx.keys()];
  const docs = await db.getAll(...ids.map((id) => db.collection("children").doc(id)));
  const postcodeOf = await postcodesFor(docs);
  const out = docs.filter((d) => d.exists).map((d) => {
    const c = d.data() as { name?: string; dob?: string; parentUid?: string };
    const p = idx.get(d.id)!;
    return { childId: d.id, name: c.name ?? "", dob: c.dob ?? "", parentName: p.parentName, parentEmail: p.email, parentPhone: p.phone, ref: p.ref, postcode: c.parentUid ? (postcodeOf.get(c.parentUid) ?? "") : "" };
  }).sort((a, b) => (a.name < b.name ? -1 : 1));
  res.json(out);
});

// GET /api/children/:id — the full safeguarding record for the card, tenant-gated
// (the child must be booked with the caller's tenant).
children.get("/:id", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !CARD_ROLES.has(auth.role)) { res.status(403).json({ error: "Requires an operator or staff account" }); return; }
  const idx = await bookedChildren(auth.tenantId);
  const p = idx.get(req.params.id);
  if (!p) { res.status(404).json({ error: "Child not found for this account" }); return; }
  const doc = await db.collection("children").doc(req.params.id).get();
  if (!doc.exists) { res.status(404).json({ error: "Child not found" }); return; }
  const c = doc.data() as Record<string, unknown>;
  let postcode = "";
  if (c.parentUid) { const u = await db.collection("users").doc(c.parentUid as string).get(); postcode = u.exists ? ((u.data() as { postcode?: string }).postcode ?? "") : ""; }
  res.json({
    childId: doc.id, name: (c.name as string) ?? "",
    parentName: p.parentName, parentEmail: p.email, parentPhone: p.phone, ref: p.ref, postcode,
    record: {
      photo: c.photo, dob: c.dob, school: c.school, allergies: c.allergies, medical: c.medical, dietary: c.dietary,
      send: c.send, sendPlanName: c.sendPlanName, careNotes: c.careNotes, collectionPassword: c.collectionPassword,
      emergencyName: c.emergencyName, emergencyPhone: c.emergencyPhone, photoConsent: c.photoConsent,
      likes: c.likes, dislikes: c.dislikes, swimming: c.swimming, sex: c.sex,
      suncreamConsent: c.suncreamConsent, firstAidConsent: c.firstAidConsent, walkHomeConsent: c.walkHomeConsent, answers: c.answers,
    },
  });
});
