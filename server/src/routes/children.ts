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
// (the child must be booked with the caller's tenant). Also returns the parent's
// resolved phone (booking → customer record fallback) and the child's bookings.
children.get("/:id", async (req, res) => {
  const auth = req.auth!;
  const id = req.params.id;
  if (!auth.tenantId || !CARD_ROLES.has(auth.role)) { res.status(403).json({ error: "Requires an operator or staff account" }); return; }
  // One pass over the tenant's bookings: parent contact + this child's bookings.
  const blocks = await db.collection("blocks").where("tenantId", "==", auth.tenantId).get();
  const snaps = blocks.empty ? [] : await Promise.all(blocks.docs.map((d) => db.collection("bookings").where("blockId", "==", d.id).get()));
  let contact: { parentName: string; email: string; phone: string; ref: string } | null = null;
  const bookings: { ref: string; listing: string; dates: string; pass: string; status: string }[] = [];
  for (const s of snaps)
    for (const d of s.docs) {
      const b = fromDoc(d.data() as BookingDoc);
      const has = b.kids?.length ? b.kids.some((k) => k.childId === id) : b.childId === id;
      if (!has) continue;
      if (!contact) contact = { parentName: b.booker ?? "", email: b.email ?? "", phone: b.phone ?? "", ref: b.ref };
      else if (!contact.phone && b.phone) contact.phone = b.phone;
      if (countsTowardCapacity(b.status) && b.status !== "Offered") bookings.push({ ref: b.ref, listing: b.listing ?? "", dates: b.dates ?? "", pass: b.pass ?? "", status: b.status });
    }
  if (!contact) { res.status(404).json({ error: "Child not found for this account" }); return; }
  const doc = await db.collection("children").doc(id).get();
  if (!doc.exists) { res.status(404).json({ error: "Child not found" }); return; }
  const c = doc.data() as Record<string, unknown>;
  // Phone fallback: the booking often has none — the number lives on the customer
  // record (operator directory / parent account). Postcode comes off the user doc.
  if (!contact.phone && contact.email) {
    const cust = await db.collection("customers").where("email", "==", contact.email).limit(1).get();
    if (!cust.empty) contact.phone = ((cust.docs[0].data() as { phone?: string }).phone ?? "");
  }
  let postcode = "";
  if (c.parentUid) {
    const u = await db.collection("users").doc(c.parentUid as string).get();
    if (u.exists) { const ud = u.data() as { postcode?: string; phone?: string }; postcode = ud.postcode ?? ""; if (!contact.phone && ud.phone) contact.phone = ud.phone; }
  }
  res.json({
    childId: doc.id, name: (c.name as string) ?? "",
    parentName: contact.parentName, parentEmail: contact.email, parentPhone: contact.phone, ref: contact.ref, postcode,
    bookings,
    record: {
      photo: c.photo, dob: c.dob, school: c.school, allergies: c.allergies, medical: c.medical, dietary: c.dietary,
      send: c.send, sendPlanName: c.sendPlanName, careNotes: c.careNotes, collectionPassword: c.collectionPassword,
      emergencyName: c.emergencyName, emergencyPhone: c.emergencyPhone, photoConsent: c.photoConsent,
      likes: c.likes, dislikes: c.dislikes, swimming: c.swimming, sex: c.sex,
      suncreamConsent: c.suncreamConsent, firstAidConsent: c.firstAidConsent, walkHomeConsent: c.walkHomeConsent, answers: c.answers,
    },
  });
});
