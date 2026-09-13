import { Router, type Request } from "express";
import { z } from "zod";
import { allergenHits } from "../../../features/meals/allergens";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { franchiseListingIds } from "../lib/franchiseScope";
import { staffSiteScope } from "../lib/siteScope";
import type { BlockDoc } from "../lib/blockDomain";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";
import { onSite, registerRows } from "../lib/registerRows";
import { ukToday } from "../lib/ukDate";

// ─────────────────────────────────────────────────────────────────────────
// Meals & allergies (Pupils). Two things that only matter together:
//
//   the MENU     — what's served on a date, each meal tagged with the UK
//                  allergens it contains.
//   the BOARD    — the day's children (from bookings) with their allergies,
//                  dietary needs and medical notes resolved from their child
//                  records, and an ALERT wherever a child's allergy matches a
//                  menu allergen. This is what staff read at mealtime.
//
// Operators set the menu; staff read the board. Tenant-scoped.
// ─────────────────────────────────────────────────────────────────────────

export const meals = Router();

const menusCol = db.collection("menus");
const menuId = (tenantId: string, date: string) => `${tenantId}_${date}`;
const canWriteMenu = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const todayIso = () => ukToday();

// The 14 allergens UK food law requires to be declared.
export const UK_ALLERGENS = [
  "celery", "gluten", "crustaceans", "eggs", "fish", "lupin", "milk",
  "molluscs", "mustard", "nuts", "peanuts", "sesame", "soya", "sulphites",
] as const;

// Free-text allergy → menu allergens it likely matches. Best-effort, flagged
// as "check" not "certain": a child's `allergies` is free text ("Nuts
// (EpiPen), dairy"), so we surface a possible match for staff to verify, and
// never suppress a warning.


// The one shared list (features/meals/allergens.ts) — "nut allergy" now
// flags peanut dishes too.
function alertsFor(allergyText: string, menuAllergens: Set<string>): string[] {
  return allergenHits(allergyText, menuAllergens);
}

const tenantOf = (req: Request) => {
  const auth = req.auth!;
  if (auth.role === "platform") return typeof req.query.tenantId === "string" ? req.query.tenantId : null;
  return auth.tenantId;
};

interface MenuMeal {
  id: string;
  type: string; // breakfast / lunch / snack / tea
  description: string;
  allergens: string[];
}

// GET /api/meals?date= — the day's menu + the dietary board.
meals.get("/", async (req, res) => {
  const auth = req.auth!;
  if (auth.role === "parent") {
    res.status(403).json({ error: "Requires an operator or staff account" });
    return;
  }
  const tenantId = tenantOf(req);
  if (!tenantId) {
    res.status(auth.role === "platform" ? 400 : 403).json({ error: "No tenant" });
    return;
  }
  const date = typeof req.query.date === "string" && req.query.date ? req.query.date : todayIso();

  const [menuSnap, blocksSnap] = await Promise.all([
    menusCol.doc(menuId(tenantId, date)).get(),
    db.collection("blocks").where("tenantId", "==", tenantId).get(),
  ]);
  const menu: MenuMeal[] = menuSnap.exists ? (menuSnap.data()!.meals ?? []) : [];
  const menuAllergens = new Set<string>(menu.flatMap((m) => m.allergens ?? []));

  // A franchise only sees its OWN children's dietary board — narrow to its listings.
  const franchiseListings = (auth.role === "franchise" || auth.role === "staff") && auth.franchiseId
    ? await franchiseListingIds(tenantId, auth.franchiseId)
    : null;
  // Staff assigned to certain sites (a site lead) see only those sites' children.
  const site = await staffSiteScope(auth);
  const todays = blocksSnap.docs
    .map((d) => ({ id: d.id, block: d.data() as BlockDoc }))
    .filter(({ block }) => !franchiseListings || franchiseListings.has(block.listingId))
    .filter(({ block }) => !site || site.listings.has(block.listingId))
    .map(({ id, block }) => ({ id, block, session: block.sessions.find((s) => s.date === date) }))
    .filter((x): x is typeof x & { session: NonNullable<(typeof x)["session"]> } => !!x.session);

  if (!todays.length) {
    res.json({ date, menu, allergens: [...UK_ALLERGENS], sessions: [], summary: { children: 0, withNeeds: 0, alerts: 0 } });
    return;
  }

  const [bookingSnaps, listingSnaps] = await Promise.all([
    Promise.all(todays.map(({ id }) => db.collection("bookings").where("blockId", "==", id).get())),
    db.getAll(...[...new Set(todays.map(({ block }) => block.listingId))].map((lid) => db.collection("listings").doc(lid))),
  ]);
  const listingName = new Map(listingSnaps.map((s) => [s.id, s.exists ? ((s.data()!.name as string) ?? "") : "(deleted)"]));

  // Resolve dietary data from child records (by id), one batch.
  const childIds = new Set<string>();
  for (const snap of bookingSnaps)
    for (const d of snap.docs)
      for (const r of registerRows(fromDoc(d.data() as BookingDoc), date)) if (r.childId) childIds.add(r.childId);
  const childDocs = childIds.size ? await db.getAll(...[...childIds].map((cid) => db.collection("children").doc(cid))) : [];
  const dietById = new Map(
    childDocs.filter((d) => d.exists).map((d) => {
      const c = d.data() as Record<string, unknown>;
      return [d.id, { allergies: (c.allergies as string) ?? "", dietary: (c.dietary as string) ?? "", medical: (c.medical as string) ?? "" }];
    }),
  );

  let totalChildren = 0;
  let withNeeds = 0;
  let totalAlerts = 0;
  // The day's register marks — for children still on site after a cancellation.
  const regDocs = await db.getAll(...todays.map(({ id }) => db.collection("registers").doc(`${id}_${date}`)));
  const regEntries = regDocs.map((r) => ((r.exists ? r.get("entries") : null) ?? {}) as Record<string, { status?: string; collectedAt?: string | null }>);
  const sessions = todays.map(({ id, block, session }, i) => {
    // One row per CHILD — a sibling's nut allergy used to be dropped because
    // only the first child on a joint booking was ever looked up.
    const children = bookingSnaps[i].docs
      .flatMap((d) => registerRows(fromDoc(d.data() as BookingDoc), date))
      // Expected, OR still physically here: signed in and not collected (a
      // booking cancelled while they're on site). A ratio counts every child
      // present, and the kitchen needs their allergies either way.
      .filter((r) => r.expected || onSite(regEntries[i], r))
      .map((r) => {
        const diet = r.childId ? dietById.get(r.childId) : undefined;
        const allergies = diet?.allergies ?? "";
        const alerts = allergies ? alertsFor(allergies, menuAllergens) : [];
        totalChildren++;
        if (allergies || diet?.dietary) withNeeds++;
        totalAlerts += alerts.length;
        return {
          ref: r.key,
          name: r.name,
          allergies,
          dietary: diet?.dietary ?? "",
          medical: diet?.medical ?? "",
          alerts,
        };
      })
      // Children with needs first, so they're not missed.
      .sort((a, b) => (b.alerts.length + (b.allergies || b.dietary ? 1 : 0)) - (a.alerts.length + (a.allergies || a.dietary ? 1 : 0)) || (a.name < b.name ? -1 : 1));
    return {
      blockId: id,
      listingName: listingName.get(block.listingId) ?? "",
      blockName: block.name,
      start: session.start,
      end: session.end,
      children,
    };
  });
  sessions.sort((a, b) => (a.start < b.start ? -1 : 1));
  res.json({ date, menu, allergens: [...UK_ALLERGENS], sessions, summary: { children: totalChildren, withNeeds, alerts: totalAlerts } });
});

const menuSchema = z.object({
  meals: z
    .array(
      z.object({
        id: z.string().max(60),
        type: z.string().trim().max(40),
        description: z.string().trim().max(500),
        allergens: z.array(z.string().max(40)).max(20),
      }),
    )
    .max(20),
});

// PUT /api/meals/:date — set the day's menu (operators).
meals.put("/:date", async (req, res) => {
  const auth = req.auth!;
  if (!canWriteMenu(auth.role) || !auth.tenantId) {
    res.status(403).json({ error: "Requires an operator account with a tenant" });
    return;
  }
  const parsed = menuSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const date = req.params.date;
  await menusCol.doc(menuId(auth.tenantId, date)).set({
    tenantId: auth.tenantId,
    date,
    meals: parsed.data.meals,
    updatedAt: new Date().toISOString(),
  });
  res.json({ ok: true });
});
