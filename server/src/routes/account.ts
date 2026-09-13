import { Router } from "express";
import { z } from "zod";
import { auth as authAdmin, db } from "../firebase";
import { forgetRevocation } from "../middleware/auth";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";
import { syncAccountEmail } from "../lib/emailSync";

// Account (shared, every portal) — the signed-in user's own profile. Email and
// the base identity come from the verified Firebase token; the editable extras
// (display name, phone, marketing consent) live on the users doc. Password and
// sign-out are Firebase client operations — the UI does those directly.
export const account = Router();

const putSchema = z.object({
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(300).optional(),
  postcode: z.string().trim().max(16).optional(),
  marketingConsent: z.boolean().optional(),
  // A family-level emergency contact — the same across all their children, so
  // it's captured once here rather than re-typed on every child profile.
  emergencyName: z.string().trim().max(120).optional(),
  emergencyPhone: z.string().trim().max(40).optional(),
  // UI language preference (follows the user across devices).
  locale: z.string().trim().max(8).optional(),
  // Franchise only — the franchise's own business name + territory (e.g. "London").
  franchiseName: z.string().trim().max(120).optional(),
  franchiseArea: z.string().trim().max(120).optional(),
  // Franchise territory map — one or more drawn areas + an agreed/draft status.
  // Points are {lat,lng} OBJECTS, not [lat,lng] tuples: Firestore forbids nested
  // arrays, so a polygon ring can't be an array-of-arrays.
  franchiseTerritory: z.object({
    areas: z.array(z.object({
      id: z.string().max(40),
      name: z.string().max(80),
      color: z.string().max(16),
      rings: z.array(z.object({ lat: z.number(), lng: z.number() })).max(4000),
    })).max(50),
    // draft = still drawing · proposed = submitted, awaiting the other party · agreed = signed off.
    status: z.enum(["draft", "proposed", "agreed"]).optional(),
    // Who proposed the current border: "franchise" (head office agrees) or "ho"
    // (the franchise approves). Set server-side; client value is ignored.
    by: z.enum(["ho", "franchise"]).optional(),
  }).optional(),
});
type Territory = { areas: { id: string; name: string; color: string; rings: { lat: number; lng: number }[] }[]; status?: "draft" | "proposed" | "agreed"; by?: "ho" | "franchise"; agreedAt?: string; agreedBy?: string };
type UserProfile = { name?: string; phone?: string; address?: string; postcode?: string; marketingConsent?: boolean; emergencyName?: string; emergencyPhone?: string; locale?: string; franchiseName?: string; franchiseArea?: string; franchiseTerritory?: Territory };

account.get("/", async (req, res) => {
  const auth = req.auth!;
  const uid = req.user?.uid;
  if (!uid) { res.status(400).json({ error: "No account" }); return; }
  // A just-verified sign-in email change moves the family's records across.
  await syncAccountEmail(req).catch((e) => console.error("[account] email sync failed:", (e as Error).message));
  const doc = await db.collection("users").doc(uid).get();
  const u = (doc.exists ? doc.data()! : {}) as UserProfile & { pendingEmail?: string | null };
  res.json({
    email: req.user?.email ?? null,
    // A change of sign-in email that's waiting for its verification link.
    pendingEmail: u.pendingEmail && u.pendingEmail !== (req.user?.email ?? "").toLowerCase() ? u.pendingEmail : null,
    name: u.name ?? req.user?.name ?? "",
    phone: u.phone ?? "",
    address: u.address ?? "",
    postcode: u.postcode ?? "",
    marketingConsent: u.marketingConsent ?? false,
    emergencyName: u.emergencyName ?? "",
    emergencyPhone: u.emergencyPhone ?? "",
    locale: u.locale ?? "en",
    franchiseName: u.franchiseName ?? "",
    franchiseArea: u.franchiseArea ?? "",
    franchiseTerritory: u.franchiseTerritory ?? null,
    role: auth.role,
    tenantId: auth.tenantId ?? null,
  });
});

account.put("/", async (req, res) => {
  const auth = req.auth!;
  const uid = req.user?.uid;
  if (!uid) { res.status(400).json({ error: "No account" }); return; }
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const data = parsed.data;
  // A franchise drawing/editing its own border always re-opens negotiation: the
  // status becomes proposed (has areas) or draft (none), stamped "by franchise"
  // so head office is the one who signs it off. A franchise can never mark its own
  // border "agreed" here — approving a HEAD-OFFICE-proposed border is a separate,
  // explicit action (POST /territory/approve below).
  if (auth.role === "franchise" && data.franchiseTerritory) {
    data.franchiseTerritory.status = data.franchiseTerritory.areas.length ? "proposed" : "draft";
    data.franchiseTerritory.by = "franchise";
  }
  // A staff member's name is what links them to their shifts, certificates,
  // onboarding and training (those records carry the name the manager used).
  // Renaming themselves to a colleague would hand them the colleague's DBS
  // and onboarding file (acceptance test d24s5), so their manager sets it.
  // A first name on an account that has none is allowed, unless it's taken.
  let nameLocked = false;
  if (auth.role === "staff" && data.name !== undefined) {
    const cur = String((await db.collection("users").doc(uid).get()).get("name") ?? "").trim();
    const want = data.name.trim();
    if (want.toLowerCase() !== cur.toLowerCase()) {
      const taken = !cur && want && auth.tenantId
        ? (await db.collection("users").where("tenantId", "==", auth.tenantId).get()).docs
            .some((d) => d.id !== uid && String(d.get("name") ?? "").trim().toLowerCase() === want.toLowerCase())
        : true;
      if (cur || taken || !want) { delete data.name; nameLocked = true; }
    }
  }
  await db.collection("users").doc(uid).set({ ...data, profileUpdatedAt: new Date().toISOString() }, { merge: true });
  const doc = await db.collection("users").doc(uid).get();
  const u = doc.data()! as UserProfile;
  res.json({ name: u.name ?? "", phone: u.phone ?? "", address: u.address ?? "", postcode: u.postcode ?? "", marketingConsent: u.marketingConsent ?? false, ...(nameLocked ? { nameLocked: true } : {}) });
});

// POST /api/account/email-change — the account page has just asked Firebase
// to email a verification link to a NEW sign-in address (verifyBeforeUpdateEmail,
// client-side). Recorded here so the change can be recognised and the family's
// records moved when they next sign in with it (lib/emailSync). Nothing moves
// until Firebase has actually switched the login to that address.
const emailChangeSchema = z.object({ newEmail: z.string().trim().toLowerCase().email().max(160) });
account.post("/email-change", async (req, res) => {
  const uid = req.user?.uid;
  if (!uid || req.impersonating) { res.status(403).json({ error: "Only the account holder can change their sign-in email" }); return; }
  const parsed = emailChangeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Enter a valid email address" }); return; }
  const next = parsed.data.newEmail;
  if (next === (req.user?.email ?? "").toLowerCase()) { res.status(400).json({ error: "That's already your sign-in email" }); return; }
  await db.collection("users").doc(uid).set({ pendingEmail: next, pendingEmailAt: new Date().toISOString() }, { merge: true });
  res.json({ ok: true, pendingEmail: next });
});

// POST /api/account/signout-everywhere — end every session on every device:
// Firebase stops refreshing them, and the API refuses any token already issued
// (middleware/auth verifyFresh). This device signs out straight after.
account.post("/signout-everywhere", async (req, res) => {
  const uid = req.user?.uid;
  if (!uid) { res.status(400).json({ error: "No account" }); return; }
  // HQ "viewing as" someone must not end THEIR sessions from the preview
  // (req.user is swapped to the target) — same guard as email-change.
  if (req.impersonating) { res.status(403).json({ error: "Only the account holder can sign out their devices" }); return; }
  await authAdmin.revokeRefreshTokens(uid);
  forgetRevocation(uid);
  res.json({ ok: true });
});

// POST /api/account/territory/approve — a franchise accepts the territory their
// HEAD OFFICE proposed (drawn on the invite). Only valid when there's an
// HO-proposed border waiting; marks it agreed. (The mirror — head office agreeing
// a FRANCHISE-proposed border — lives in franchises.ts.)
account.post("/territory/approve", async (req, res) => {
  const auth = req.auth!;
  const uid = req.user?.uid;
  if (auth.role !== "franchise" || !uid) { res.status(403).json({ error: "Franchise only" }); return; }
  const doc = await db.collection("users").doc(uid).get();
  const cur = (doc.data()?.franchiseTerritory ?? null) as Territory | null;
  if (!cur?.areas?.length || cur.by !== "ho") {
    res.status(400).json({ error: "There's no head-office territory waiting for your approval." });
    return;
  }
  const next: Territory = { ...cur, status: "agreed", agreedAt: new Date().toISOString(), agreedBy: req.user?.email ?? "franchise" };
  await db.collection("users").doc(uid).set({ franchiseTerritory: next }, { merge: true });
  res.json({ ok: true, status: "agreed" });
});

// POST /api/account/deactivate — parent self-service soft close. Records the
// intent, stops marketing, and hard-GATES on outstanding money server-side (the
// client gate is UX only — never trust it). Memberships are cancelled by the
// client first (existing /api/my/memberships/cancel per provider).
//   OWED (Amir), see docs/account-deactivation-handoff.md: actually BLOCK login
//   (admin.auth().updateUser(uid,{disabled:true})), reactivate-on-sign-in within
//   a 30-day grace window, wallet forfeiture/refund policy, and record retention.
// GET /api/account/reactivate — was this account closed, and when? The sign-in
// page asks first ("Your account was closed on … — reopen it?") instead of
// reopening it just because someone signed in. (Reachable while closed, like
// the POST — middleware/role.ts lets /api/account/reactivate through.)
account.get("/reactivate", async (req, res) => {
  const uid = req.user?.uid;
  if (!uid) { res.status(400).json({ error: "No account" }); return; }
  const u = await db.collection("users").doc(uid).get();
  const closedAt = (u.get("deactivatedAt") as string | null | undefined) || null;
  res.json({ closed: !!closedAt, closedAt });
});

// POST /api/account/reactivate { confirm: true } — a parent reopens an account
// they closed. Only on an explicit yes: signing in used to reopen it silently.
// (Not an account a provider switched off — that's `disabled`, and only the
// provider can undo it.)
account.post("/reactivate", async (req, res) => {
  const uid = req.user?.uid;
  if (!uid) { res.status(400).json({ error: "No account" }); return; }
  // HQ viewing as someone mustn't reopen their account for them.
  if (req.impersonating) { res.status(403).json({ error: "Only the account holder can reopen their account" }); return; }
  const u = await db.collection("users").doc(uid).get();
  if (u.get("disabled") === true) { res.status(403).json({ error: "This account was switched off by the provider — contact them to restore it." }); return; }
  if (!u.get("deactivatedAt")) { res.json({ ok: true, reopened: false }); return; }
  if ((req.body as { confirm?: unknown } | undefined)?.confirm !== true) {
    res.status(400).json({ error: "Confirm you want to reopen this account.", code: "confirm_required", closedAt: u.get("deactivatedAt") });
    return;
  }
  await u.ref.set({ deactivatedAt: null, reactivatedAt: new Date().toISOString() }, { merge: true });
  res.json({ ok: true, reopened: true });
});

account.post("/deactivate", async (req, res) => {
  const uid = req.user?.uid;
  const email = req.user?.email;
  if (!uid || !email) { res.status(400).json({ error: "No account" }); return; }
  // Outstanding balance = live (not cancelled/declined) bookings that aren't paid.
  const snap = await db.collection("bookings").where("email", "==", email).get();
  const unpaid = snap.docs
    .map((d) => fromDoc(d.data() as BookingDoc))
    .filter((b) => b.status !== "Cancelled" && b.status !== "Declined" && b.pay !== "Paid" && (b.amount ?? 0) > 0);
  if (unpaid.length) {
    const total = unpaid.reduce((n, b) => n + (b.amount ?? 0), 0);
    res.status(409).json({ error: "Please settle your outstanding balance before closing your account.", outstanding: Math.round(total * 100) / 100, count: unpaid.length });
    return;
  }
  // An active membership must be cancelled first. The screen does that, but
  // swallowed any failure and closed the account anyway — leaving a live
  // membership (and, once Stripe billing lands, a live charge) on an account
  // nobody can sign in to.
  const mems = await db.collection("memberships").where("email", "==", email.toLowerCase()).where("status", "==", "active").get();
  if (!mems.empty) {
    res.status(409).json({ error: "You still have an active membership. Cancel it first, then close your account.", memberships: mems.docs.map((d) => ({ tenantId: d.get("tenantId"), tier: d.get("tierName") })) });
    return;
  }
  const reason = typeof (req.body as { reason?: unknown })?.reason === "string" ? (req.body as { reason: string }).reason.trim().slice(0, 500) : "";
  await db.collection("users").doc(uid).set({
    // Enforced from here on: middleware/role.ts refuses a deactivated account.
    deactivatedAt: new Date().toISOString(),
    deactivationReason: reason || null,
    marketingConsent: false, // stop all marketing immediately
  }, { merge: true });
  res.json({ ok: true });
});
