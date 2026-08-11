import { Router } from "express";
import { auth as adminAuth, db } from "../firebase";
import { countsTowardCapacity, type BlockDoc } from "../lib/blockDomain";
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

async function placesFor(docs: FirebaseFirestore.DocumentSnapshot[]) {
  const uids = [...new Set(docs.filter((d) => d.exists).map((d) => (d.data() as { parentUid?: string }).parentUid).filter((u): u is string => !!u))];
  const userDocs = uids.length ? await db.getAll(...uids.map((u) => db.collection("users").doc(u))) : [];
  return new Map(userDocs.filter((u) => u.exists).map((u) => {
    const ud = u.data() as { postcode?: string; address?: string };
    // Registration captures a free-text address ("Street, town"); the town is
    // the last comma-part. No comma → we can't tell the town from the street.
    const parts = (ud.address ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const town = parts.length > 1 ? parts[parts.length - 1] : "";
    return [u.id, { postcode: ud.postcode ?? "", town }] as const;
  }));
}

// GET /api/children/lookup — the searchable list (name, parent, where they live).
children.get("/lookup", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !CARD_ROLES.has(auth.role)) { res.status(403).json({ error: "Requires an operator or staff account" }); return; }
  const idx = await bookedChildren(auth.tenantId);
  // Also include children a family added to their OWN account (not just booked),
  // so Find-a-child covers everyone on the operator's list. Matched customer
  // (email) → account (uid) → their children.
  try {
    const custs = await db.collection("customers").where("tenantId", "==", auth.tenantId).get();
    await Promise.all(custs.docs.map(async (cd) => {
      const cust = cd.data() as { name?: string; email?: string; phone?: string };
      const email = (cust.email ?? "").trim();
      if (!email.includes("@")) return;
      let uid: string;
      try { uid = (await adminAuth.getUserByEmail(email)).uid; } catch { return; }
      const kids = await db.collection("children").where("parentUid", "==", uid).get();
      kids.docs.forEach((kd) => { if (!idx.has(kd.id)) idx.set(kd.id, { parentName: cust.name ?? "", email, phone: cust.phone ?? "", ref: "" }); });
    }));
  } catch { /* booked children still returned */ }
  if (!idx.size) { res.json([]); return; }
  const ids = [...idx.keys()];
  const docs = await db.getAll(...ids.map((id) => db.collection("children").doc(id)));
  const placeOf = await placesFor(docs);
  const out = docs.filter((d) => d.exists).map((d) => {
    const c = d.data() as { name?: string; dob?: string; parentUid?: string; photo?: string };
    const p = idx.get(d.id)!;
    const place = c.parentUid ? (placeOf.get(c.parentUid) ?? { postcode: "", town: "" }) : { postcode: "", town: "" };
    return { childId: d.id, name: c.name ?? "", dob: c.dob ?? "", parentName: p.parentName, parentEmail: p.email, parentPhone: p.phone, ref: p.ref, postcode: place.postcode, town: place.town, photo: c.photo ?? "" };
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
  // The session times live on the block (its sessions each carry start/end).
  const timeOf = (blockId?: string) => {
    if (!blockId) return { start: "", end: "" };
    const blk = blocks.docs.find((d) => d.id === blockId)?.data() as BlockDoc | undefined;
    const first = blk?.sessions?.[0];
    return { start: first?.start ?? "", end: first?.end ?? "" };
  };
  const snaps = blocks.empty ? [] : await Promise.all(blocks.docs.map((d) => db.collection("bookings").where("blockId", "==", d.id).get()));
  let contact: { parentName: string; email: string; phone: string; ref: string } | null = null;
  const bookings: { ref: string; listing: string; dates: string; pass: string; start: string; end: string; status: string }[] = [];
  for (const s of snaps)
    for (const d of s.docs) {
      const b = fromDoc(d.data() as BookingDoc);
      const has = b.kids?.length ? b.kids.some((k) => k.childId === id) : b.childId === id;
      if (!has) continue;
      if (!contact) contact = { parentName: b.booker ?? "", email: b.email ?? "", phone: b.phone ?? "", ref: b.ref };
      else if (!contact.phone && b.phone) contact.phone = b.phone;
      if (countsTowardCapacity(b.status) && b.status !== "Offered") { const t = timeOf(b.blockId); bookings.push({ ref: b.ref, listing: b.listing ?? "", dates: b.dates ?? "", pass: b.pass ?? "", start: t.start, end: t.end, status: b.status }); }
    }
  const doc = await db.collection("children").doc(id).get();
  if (!doc.exists) { res.status(404).json({ error: "Child not found" }); return; }
  if (!contact) {
    // Not booked — allow the card only if the child's family is a customer of
    // THIS tenant (so an operator can't open a stranger's child by id).
    const puid = doc.get("parentUid") as string | undefined;
    if (puid) {
      const u = await db.collection("users").doc(puid).get();
      const pemail = (u.exists ? ((u.get("email") as string | undefined) ?? "") : "").trim();
      if (pemail) {
        for (const e of [...new Set([pemail.toLowerCase(), pemail])]) {
          const cust = await db.collection("customers").where("tenantId", "==", auth.tenantId).where("email", "==", e).limit(1).get();
          if (!cust.empty) {
            const cd = cust.docs[0].data() as { name?: string; phone?: string };
            contact = { parentName: cd.name ?? "", email: pemail, phone: cd.phone ?? "", ref: "" };
            break;
          }
        }
      }
    }
    if (!contact) { res.status(404).json({ error: "Child not found for this account" }); return; }
  }
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
