import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { auth as adminAuth, db } from "../firebase";
import { joinedThemselves } from "../lib/childAccess";
import { countsTowardCapacity, type BlockDoc } from "../lib/blockDomain";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";
import { bookingInSite, staffSiteScope, type SiteScope } from "../lib/siteScope";
import { realPhone } from "../../../features/bookings/helpers";

// Operator-wide child lookup — the "Find a child" popup in the portal header.
// Scoped to children booked with the caller's tenant, joined to the parent's
// name / contact / postcode so staff can find a child by who they are or where
// they live, then open the same safeguarding card the register/bookings show.
export const children = Router();

const CARD_ROLES = new Set(["company", "franchise", "freelancer", "staff", "platform"]);

/** childId → the parent contact + a representative booking ref, for this tenant.
 *  Optional franchise filter: a franchiseId, or "__ho__" for head-office-direct
 *  (bookings on listings with no franchiseId). A booking belongs to whichever
 *  franchise owns its listing (matching the rest of the attribution model). */
// joinedThemselves: see lib/childAccess (acceptance test d25s3).

async function bookedChildren(tenantId: string, franchiseId?: string | null, site?: SiteScope | null) {
  const map = new Map<string, { parentName: string; email: string; phone: string; ref: string }>();
  const [blocks, listingsSnap] = await Promise.all([
    db.collection("blocks").where("tenantId", "==", tenantId).get(),
    franchiseId ? db.collection("listings").where("tenantId", "==", tenantId).get() : Promise.resolve(null),
  ]);
  if (blocks.empty) return map;
  const listingFr = new Map<string, string | null>();
  if (listingsSnap) for (const d of listingsSnap.docs) listingFr.set(d.id, (d.data() as { franchiseId?: string }).franchiseId ?? null);
  const snaps = await Promise.all(blocks.docs.map((d) => db.collection("bookings").where("blockId", "==", d.id).get()));
  for (const s of snaps)
    for (const d of s.docs) {
      const raw = d.data() as BookingDoc & { franchiseId?: string; listingId?: string };
      const b = fromDoc(raw);
      if (!countsTowardCapacity(b.status) || b.status === "Offered") continue;
      if (site && !bookingInSite(raw, site)) continue;
      if (franchiseId) {
        const fid = raw.franchiseId ?? (raw.listingId ? (listingFr.get(raw.listingId) ?? null) : null);
        if (franchiseId === "__ho__" ? fid != null : fid !== franchiseId) continue;
      }
      const kids = b.kids?.length ? b.kids : [{ childId: b.childId }];
      for (const k of kids) {
        if (k.childId && !map.has(k.childId)) map.set(k.childId, { parentName: b.booker ?? "", email: b.email ?? "", phone: realPhone(b.phone), ref: b.ref });
        else if (k.childId && !map.get(k.childId)!.phone && realPhone(b.phone)) map.get(k.childId)!.phone = realPhone(b.phone);
      }
    }
  // No number on the booking (older bookings were stamped "—") → the one this
  // provider holds for the family on its customer record. Same tenant only.
  const needPhone = [...new Set([...map.values()].filter((x) => !x.phone && x.email).map((x) => x.email))];
  const custPhone = new Map<string, string>();
  for (let i = 0; i < needPhone.length; i += 30) {
    const cs = await db.collection("customers").where("tenantId", "==", tenantId).where("email", "in", needPhone.slice(i, i + 30)).get();
    for (const cd of cs.docs) { const ph = realPhone(cd.get("phone") as string | undefined); if (ph) custPhone.set(String(cd.get("email") ?? ""), ph); }
  }
  for (const x of map.values()) if (!x.phone && custPhone.has(x.email)) x.phone = custPhone.get(x.email)!;
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
  // Head office can scope the search to one franchise (or its own direct
  // locations) via ?franchiseId=. Company-only; ignored for other roles.
  //
  // A FRANCHISE is scoped to its own id, always — it does not get to ask. The
  // client sends no ?franchiseId for a non-company portal, so before this a
  // franchisee's Find-a-child returned every child in the head-office network.
  if (auth.role === "franchise" && !auth.franchiseId) {
    // A franchise account with no franchiseId can't be scoped, so it gets
    // nothing rather than everything.
    res.json([]);
    return;
  }
  // A franchise's STAFF carry the franchise's id and get the same lens — before
  // this they fell through to the whole network (acceptance test d22s2).
  const franchiseId =
    auth.role === "franchise" || (auth.role === "staff" && auth.franchiseId)
      ? auth.franchiseId
      : auth.role === "company" && typeof req.query.franchiseId === "string" && req.query.franchiseId
        ? req.query.franchiseId
        : null;
  // Staff assigned to certain sites (a site lead) find only those sites'
  // children (acceptance d23s5).
  const site = await staffSiteScope(auth);
  const idx = await bookedChildren(auth.tenantId, franchiseId, site);
  // Also include children a family added to their OWN account (not just booked),
  // so Find-a-child covers everyone on the operator's list. Matched customer
  // (email) → account (uid) → their children. (Skipped when scoped to a
  // franchise — an account-only child can't be attributed to one.)
  if (!franchiseId && !site) try {
    const custs = await db.collection("customers").where("tenantId", "==", auth.tenantId).get();
    // Only families who joined this provider THEMSELVES — a provider can add any
    // email as a customer, which used to hand it a stranger's children.
    await Promise.all(custs.docs.filter((cd) => joinedThemselves(cd.data())).map(async (cd) => {
      const cust = cd.data() as { name?: string; email?: string; phone?: string };
      const email = (cust.email ?? "").trim();
      if (!email.includes("@")) return;
      let uid: string;
      try { uid = (await adminAuth.getUserByEmail(email)).uid; } catch { return; }
      const kids = await db.collection("children").where("parentUid", "==", uid).get();
      kids.docs.forEach((kd) => { if (!idx.has(kd.id)) idx.set(kd.id, { parentName: cust.name ?? "", email, phone: realPhone(cust.phone), ref: "" }); });
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
  // A franchise may open a child's safeguarding record only if that child is
  // booked with THIS franchise. Bookings carry franchiseId (bookings.ts), so
  // that's what we check — without it, any franchisee could read the full
  // medical/SEND record of any child in the head-office network by id.
  // (Its staff too — they carry the franchise's id.)
  const isFranchise = (auth.role === "franchise" || auth.role === "staff") && !!auth.franchiseId;
  // Staff assigned to certain sites open only those sites' children (d23s5).
  const site = await staffSiteScope(auth);
  const bookings: { ref: string; listing: string; dates: string; pass: string; start: string; end: string; status: string }[] = [];
  for (const s of snaps)
    for (const d of s.docs) {
      const b = fromDoc(d.data() as BookingDoc);
      const has = b.kids?.length ? b.kids.some((k) => k.childId === id) : b.childId === id;
      if (!has) continue;
      const bFranchiseId = (d.data() as { franchiseId?: string | null }).franchiseId ?? null;
      if (isFranchise) {
        if (!auth.franchiseId || bFranchiseId !== auth.franchiseId) continue;
      }
      if (site && !bookingInSite(d.data(), site)) continue;
      // realPhone: older bookings carry a "—" placeholder, which used to win
      // over the family's real number further down (d10s8).
      if (!contact) contact = { parentName: b.booker ?? "", email: b.email ?? "", phone: realPhone(b.phone), ref: b.ref };
      else if (!contact.phone && realPhone(b.phone)) contact.phone = realPhone(b.phone);
      if (countsTowardCapacity(b.status) && b.status !== "Offered") { const t = timeOf(b.blockId); bookings.push({ ref: b.ref, listing: b.listing ?? "", dates: b.dates ?? "", pass: b.pass ?? "", start: t.start, end: t.end, status: b.status }); }
    }
  const doc = await db.collection("children").doc(id).get();
  if (!doc.exists) { res.status(404).json({ error: "Child not found" }); return; }
  if (!contact) {
    // The customer-of-this-tenant fallback below is tenant-wide, so it can't
    // establish that a child belongs to one franchise. A franchisee therefore
    // gets nothing here — same reasoning as the account-only children skipped
    // by the lookup above.
    if (isFranchise || site) { res.status(404).json({ error: "Child not found for this account" }); return; }
    // Not booked — allow the card only if the child's family is a customer of
    // THIS tenant (so an operator can't open a stranger's child by id).
    const puid = doc.get("parentUid") as string | undefined;
    if (puid) {
      const u = await db.collection("users").doc(puid).get();
      const pemail = (u.exists ? ((u.get("email") as string | undefined) ?? "") : "").trim();
      if (pemail) {
        for (const e of [...new Set([pemail.toLowerCase(), pemail])]) {
          const cust = await db.collection("customers").where("tenantId", "==", auth.tenantId).where("email", "==", e).get();
          const own = cust.docs.find((cd) => joinedThemselves(cd.data()));
          if (own) {
            const cd = own.data() as { name?: string; phone?: string };
            contact = { parentName: cd.name ?? "", email: pemail, phone: realPhone(cd.phone), ref: "" };
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
    // Tenant-scoped: this used to match the email across EVERY provider, handing
    // out a phone number another business holds for this family.
    const cust = await db.collection("customers").where("tenantId", "==", auth.tenantId).where("email", "==", contact.email).limit(1).get();
    if (!cust.empty) contact.phone = realPhone((cust.docs[0].data() as { phone?: string }).phone);
  }
  let postcode = "";
  if (c.parentUid) {
    const u = await db.collection("users").doc(c.parentUid as string).get();
    if (u.exists) { const ud = u.data() as { postcode?: string; phone?: string }; postcode = ud.postcode ?? ""; if (!contact.phone && realPhone(ud.phone)) contact.phone = realPhone(ud.phone); }
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

// PUT /api/children/:id — a manager amends a child's care details from the
// register (allergies, medical, dietary, SEND, care notes). The register's
// quick-edit used to save to that one browser only: an allergy "recorded" on
// one phone never reached the next shift's. Managers/owners only (staff read);
// the child must be booked with this provider (and, for a franchise, with that
// franchise). Every change is attributed and kept in careHistory.
const careSchema = z.object({
  allergies: z.string().trim().max(1_000).optional(),
  medical: z.string().trim().max(1_000).optional(),
  dietary: z.string().trim().max(1_000).optional(),
  send: z.string().trim().max(1_000).optional(),
  careNotes: z.string().trim().max(2_000).optional(),
});
children.put("/:id", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !["company", "franchise", "freelancer"].includes(auth.role)) {
    res.status(403).json({ error: "Only a manager can change a child's care details" });
    return;
  }
  const parsed = careSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const id = req.params.id;
  const bookings = await db.collection("bookings").where("tenantId", "==", auth.tenantId).where("childId", "==", id).get();
  const allTenant = bookings.empty ? await db.collection("bookings").where("tenantId", "==", auth.tenantId).get() : null;
  const mine = [...bookings.docs, ...(allTenant?.docs ?? [])].filter((d) => {
    const b = d.data() as { childId?: string; kids?: { childId?: string }[]; franchiseId?: string | null };
    const has = b.childId === id || !!b.kids?.some((k) => k.childId === id);
    const inFranchise = auth.role !== "franchise" || (b.franchiseId ?? null) === auth.franchiseId;
    return has && inFranchise;
  });
  if (!mine.length) { res.status(404).json({ error: "Child not found for this account" }); return; }
  const ref = db.collection("children").doc(id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Child not found" }); return; }
  const before = snap.data()!;
  const changed = Object.entries(parsed.data).filter(([k, v]) => v !== undefined && (before[k] ?? "") !== v);
  if (!changed.length) { res.json({ ok: true, changed: [] }); return; }
  const at = new Date().toISOString();
  const by = req.user?.email ?? req.user?.uid ?? "provider";
  await ref.set({
    ...Object.fromEntries(changed),
    careEditedAt: at,
    careEditedBy: by,
    careHistory: FieldValue.arrayUnion(...changed.map(([field, to]) => ({ at, by, field, from: String(before[field] ?? ""), to: String(to) }))),
  }, { merge: true });
  res.json({ ok: true, changed: changed.map(([k]) => k) });
});
