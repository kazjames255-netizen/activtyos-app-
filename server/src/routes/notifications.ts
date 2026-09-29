// The in-app bell. Parents see notifications addressed to their email;
// operators and staff see the ones addressed to their tenant's team. Which
// list you get is decided by your role here, never by a query parameter.

import { Router, type Request } from "express";
import { z } from "zod";
import { capsFor } from "../middleware/access";
import { capLevel } from "../../../lib/accessMap";
import { staffSiteScope } from "../lib/siteScope";
import {
  getPrefs,
  markRead,
  notificationsForParent,
  notificationsForTenant,
  setMuted,
  type NotifyCategory,
} from "../lib/notify";

export const notifications = Router();

const CATEGORIES = ["accident", "incident", "medication", "booking", "trip", "calendar", "message", "moment", "billing", "learning"] as const;

/** Who is asking, and therefore which bell they get. Operators without a
 *  tenant (platform admins) have no bell of their own. */
function audienceFor(req: Request) {
  const auth = req.auth!;
  const isParent = auth.role === "parent";
  return {
    isParent,
    email: isParent ? (req.user?.email ?? "").toLowerCase() : "",
    // The team member's own email — lets a tenant read filter staff-targeted alerts.
    memberEmail: isParent ? "" : (req.user?.email ?? "").toLowerCase(),
    tenantId: isParent ? null : auth.tenantId,
    viewer: { role: auth.role, franchiseId: auth.franchiseId },
  };
}

// GET /api/notifications — the caller's bell, newest first, with the count the
// header badge needs.
notifications.get("/", async (req, res) => {
  const who = audienceFor(req);
  const items = who.isParent
    ? who.email
      ? await notificationsForParent(who.email)
      : []
    : who.tenantId
      ? await notificationsForTenant(who.tenantId, 100, who.memberEmail, who.viewer)
      : [];
  // A staff role set to None on an area (Setup → Roles & permissions) must not read that area's alerts off the team bell either: the
  // medication / accident / trip / moment / task rows carry child and family names the same role is refused everywhere else.
  // Alerts aimed at the person by name (toEmail) always show.
  let shown = items;
  if (req.auth!.role === "staff") {
    const caps = await capsFor(req).catch(() => null);
    const AREA: Record<string, string> = { accident: "incidents", incident: "incidents", medication: "medication", trip: "trips", calendar: "calendar", moment: "moments", register: "registers", task: "tasks" };
    // …and a member of staff assigned to certain sites must not read child alerts (accident / medication / trip / moment) from the other
    // sites either — they name the child and the parent's email, and the records themselves are site-scoped everywhere else.
    const siteScoped = !!(await staffSiteScope(req.auth!).catch(() => null));
    const CHILD_ALERT = new Set(["accident", "incident", "medication", "trip", "moment"]);
    shown = items.filter((n) => (n as { toEmail?: string }).toEmail
      || ((!AREA[n.category] || capLevel(caps, AREA[n.category]) !== "none") && !(siteScoped && CHILD_ALERT.has(n.category))));
  }
  res.json({ notifications: shown, unread: shown.filter((n) => !n.readAt).length });
});

// POST /api/notifications/read — mark some (or all) as read.
const readSchema = z.object({ ids: z.array(z.string().max(60)).max(500).optional() });
notifications.post("/read", async (req, res) => {
  const parsed = readSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const who = audienceFor(req);
  if (who.isParent && !who.email) { res.status(400).json({ error: "Account has no email address" }); return; }
  if (!who.isParent && !who.tenantId) { res.status(403).json({ error: "Your account has no tenant" }); return; }
  const marked = await markRead(
    who.isParent ? { email: who.email } : { tenantId: who.tenantId!, memberEmail: who.memberEmail, viewer: who.viewer },
    parsed.data.ids,
  );
  res.json({ marked });
});

// GET /api/notifications/prefs — which categories this family has muted.
// Muting silences the EMAIL; the bell still records it, so nothing is hidden
// from a parent who chose to check the app in their own time.
notifications.get("/prefs", async (req, res) => {
  const email = (req.user?.email ?? "").toLowerCase();
  if (!email) { res.status(400).json({ error: "Account has no email address" }); return; }
  res.json(await getPrefs(email));
});

// PUT /api/notifications/prefs — mute or unmute one category.
const prefsSchema = z.object({ category: z.enum(CATEGORIES), muted: z.boolean() });
notifications.put("/prefs", async (req, res) => {
  const parsed = prefsSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const email = (req.user?.email ?? "").toLowerCase();
  if (!email) { res.status(400).json({ error: "Account has no email address" }); return; }
  res.json(await setMuted(email, parsed.data.category as NotifyCategory, parsed.data.muted));
});
