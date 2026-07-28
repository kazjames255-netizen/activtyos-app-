import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";

// Platform (HQ) notifications — the bell for the ActivityOS operators of the
// platform itself. There's no per-tenant `notifications` doc feeding this (HQ
// has no tenant), so it AGGREGATES the events HQ cares about on read: new
// provider signups, cancellations, support messages and bug reports. Prefs +
// last-read live in platform/notifPrefs.
export const platformNotifications = Router();
const prefsDoc = db.collection("platform").doc("notifPrefs");
const TYPES = ["signup", "cancel", "support", "bug"] as const;
type NType = (typeof TYPES)[number];

platformNotifications.use((req, res, next) => {
  if (req.auth!.role !== "platform") { res.status(403).json({ error: "Requires the platform role" }); return; }
  next();
});

async function getPrefs() {
  const d = await prefsDoc.get();
  const data = d.exists ? d.data()! : {};
  return { muted: (data.muted as string[] | undefined) ?? [], lastReadAt: (data.lastReadAt as string | undefined) ?? "1970-01-01T00:00:00Z" };
}

interface Item { id: string; type: NType; title: string; body: string; href: string; at: string }

platformNotifications.get("/", async (_req, res) => {
  const { muted, lastReadAt } = await getPrefs();
  const on = (t: NType) => !muted.includes(t);
  const cutoff = new Date(Date.now() - 45 * 86_400_000).toISOString();
  const items: Item[] = [];

  if (on("signup") || on("cancel")) {
    const tenants = await db.collection("tenants").get();
    for (const d of tenants.docs) {
      const t = d.data() as { name?: string; type?: string; createdAt?: string; subscription?: { status?: string; canceledAt?: string } };
      if (on("signup") && t.createdAt && t.createdAt > cutoff) {
        items.push({ id: `signup_${d.id}`, type: "signup", title: `New ${t.type === "company" ? "company" : "freelancer"} signed up`, body: t.name ?? d.id, href: `/platform/providers`, at: t.createdAt });
      }
      const sub = t.subscription;
      if (on("cancel") && sub?.status === "canceled" && sub.canceledAt && sub.canceledAt > cutoff) {
        items.push({ id: `cancel_${d.id}`, type: "cancel", title: `${t.name ?? d.id} cancelled their plan`, body: "Subscription cancelled", href: `/platform/providers`, at: sub.canceledAt });
      }
    }
  }

  if (on("support") || on("bug")) {
    const threads = await db.collection("supportThreads").get();
    for (const d of threads.docs) {
      const th = d.data() as { kind?: string; providerName?: string; subject?: string; createdAt?: string; messages?: { body?: string; at?: string }[] };
      const type: NType = th.kind === "bug" ? "bug" : "support";
      if (!on(type)) continue;
      const last = (th.messages ?? []).at(-1);
      const at = last?.at ?? th.createdAt;
      if (!at || at <= cutoff) continue;
      items.push({
        id: `sup_${d.id}`, type,
        title: type === "bug" ? `Bug report${th.providerName ? ` — ${th.providerName}` : ""}` : `New support message${th.providerName ? ` — ${th.providerName}` : ""}`,
        body: th.subject || last?.body || "", href: `/platform/messages?thread=${d.id}`, at,
      });
    }
  }

  items.sort((a, b) => (a.at < b.at ? 1 : -1));
  const trimmed = items.slice(0, 60);
  res.json({ items: trimmed, unread: trimmed.filter((i) => i.at > lastReadAt).length, muted });
});

platformNotifications.post("/read", async (_req, res) => {
  await prefsDoc.set({ lastReadAt: new Date().toISOString() }, { merge: true });
  res.json({ ok: true });
});

platformNotifications.put("/prefs", async (req, res) => {
  const parsed = z.object({ muted: z.array(z.enum(TYPES)) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await prefsDoc.set({ muted: parsed.data.muted }, { merge: true });
  res.json({ muted: parsed.data.muted });
});
