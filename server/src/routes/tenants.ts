import { Router } from "express";
import { db } from "../firebase";

export const tenants = Router();

// GET /api/tenants — the platform (super-admin) view of every provider.
tenants.get("/", async (req, res) => {
  if (req.auth!.role !== "platform") {
    res.status(403).json({ error: "Requires the platform role" });
    return;
  }
  const snap = await db.collection("tenants").orderBy("createdAt", "desc").get();
  res.json(
    snap.docs.map((d) => {
      const { name, type, createdAt } = d.data();
      return { id: d.id, name, type, createdAt };
    }),
  );
});

// GET /api/me — who am I (for the frontend and API consumers).
export const me = Router();

me.get("/", async (req, res) => {
  const auth = req.auth!;
  let tenantName: string | null = null;
  let logoUrl: string | null = null;
  if (auth.tenantId) {
    const [t, lib] = await Promise.all([
      db.collection("tenants").doc(auth.tenantId).get(),
      db.collection("libraries").doc(auth.tenantId).get(),
    ]);
    tenantName = t.exists ? t.data()!.name : null;
    // The operator's own logo, so their portal chrome (sidebar) wears their
    // brand — not just their customer emails/pages.
    logoUrl = ((lib.data()?.settings as { billing?: { logoUrl?: string } } | undefined)?.billing?.logoUrl) || null;
  }
  // The parent's postcode, captured at signup, so the browse can locate them.
  const userSnap = await db.collection("users").doc(req.user!.uid).get();
  const postcode = (userSnap.data()?.postcode as string | undefined) ?? null;
  // The PERSON's name (not the business) — dashboards greet by first name.
  const name = ((userSnap.data()?.name as string | undefined) || req.user!.name || "").trim();
  // Whether the parent has seen the first-login welcome popup (add-your-kids).
  const welcomed = !!(userSnap.data()?.welcomedAt);
  res.json({
    email: req.user!.email ?? null,
    name,
    role: auth.role,
    tenantId: auth.tenantId,
    tenantName,
    logoUrl,
    postcode,
    welcomed,
    franchiseId: auth.franchiseId,
  });

  // A parent hitting /api/me IS in the platform — mark any customer record a
  // provider created for them as 'joined', so an invited family flips from
  // "Invited" to "Customer" the moment they sign in (before any booking).
  // Fire-and-forget: never delay or fail /api/me over it.
  if (auth.role === "parent" && req.user!.email) void markCustomerJoined(req.user!.email);
});

// POST /api/me/welcome — the parent has seen the first-login welcome popup;
// stamp it so it never shows again. Idempotent.
me.post("/welcome", async (req, res) => {
  await db.collection("users").doc(req.user!.uid).set({ welcomedAt: new Date().toISOString() }, { merge: true });
  res.json({ ok: true });
});

/** Stamp joinedAt on this email's customer records (across providers) the first
 *  time we see them signed in. Idempotent — skips any already stamped. */
async function markCustomerJoined(email: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    for (const e of [...new Set([email, email.toLowerCase()])]) {
      const snap = await db.collection("customers").where("email", "==", e).get();
      await Promise.all(snap.docs.filter((d) => !d.data().joinedAt).map((d) => d.ref.update({ joinedAt: now })));
    }
  } catch (err) {
    console.error("[me] mark customer joined failed:", (err as Error).message);
  }
}
