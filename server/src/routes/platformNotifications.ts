import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { ukToday } from "../lib/ukDate";

// Platform (HQ) notifications — the bell for the ActivityOS operators of the
// platform itself. There's no per-tenant `notifications` doc feeding this (HQ
// has no tenant), so it AGGREGATES the events HQ cares about on read: new
// provider signups, cancellations, support messages and bug reports. Prefs +
// last-read live in platform/notifPrefs.
export const platformNotifications = Router();
const prefsDoc = db.collection("platform").doc("notifPrefs");
const TYPES = ["signup", "cancel", "support", "bug", "lead", "task", "privacy"] as const;
type NType = (typeof TYPES)[number];

platformNotifications.use((req, res, next) => {
  if (req.auth!.role !== "platform") { res.status(403).json({ error: "Requires the platform role" }); return; }
  next();
});

async function getPrefs() {
  const d = await prefsDoc.get();
  const data = d.exists ? d.data()! : {};
  return {
    muted: (data.muted as string[] | undefined) ?? [],
    lastReadAt: (data.lastReadAt as string | undefined) ?? "1970-01-01T00:00:00Z",
    // Read/dismissed are tracked BY ID, not by a timestamp. A task reminder's
    // `at` is the moment it's due, which is in the FUTURE — so "at > lastReadAt"
    // called a task due at 11:00 unread no matter how many times you'd opened
    // the bell at 10:00, and the badge never cleared. `readIds` has no such
    // failure mode: you read the thing or you didn't.
    readIds: (data.readIds as string[] | undefined) ?? null,
    dismissedIds: (data.dismissedIds as string[] | undefined) ?? [],
  };
}

interface Item { id: string; type: NType; title: string; body: string; href: string; at: string }

async function buildItems(muted: string[]): Promise<Item[]> {
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

  if (on("lead")) {
    // Every source the PUBLIC, unauthenticated leads endpoint (server/src/
    // routes/leads.ts leadsPublic) can write — a real inbound request, not a
    // researched prospect. New sources from that form must be added here too,
    // or they silently never ring the bell (acceptance d24s3). The collection
    // now holds ~26,000 researched prospects, all created in the last 45 days,
    // so "recent leads" read every one of them on each bell refresh — minutes,
    // then a Firestore timeout, and the bell (deletion requests included)
    // never answered (acceptance d21s7). A single `in` query stays equality-
    // only, so no composite index; the date is checked below.
    const leadsSnap = await db.collection("leads").where("source", "in", ["demo", "website_build"]).get();
    for (const d of leadsSnap.docs) {
      const l = d.data() as { name?: string; business?: string; createdAt?: string; imported?: boolean; source?: string };
      // Researched prospects bulk-imported into Leads (e.g. from a directory)
      // aren't demo requests — a hundred of them mustn't ring the bell.
      if (l.imported) continue;
      if (l.createdAt && l.createdAt > cutoff) {
        items.push({
          id: `lead_${d.id}`, type: "lead",
          title: l.source === "website_build" ? "New website build request" : "New demo request",
          body: [l.name, l.business].filter(Boolean).join(" · ") || d.id,
          href: `/platform/sales`, at: l.createdAt,
        });
      }
    }
  }

  if (on("privacy")) {
    // Data deletion requests still pending — a legal clock (one month) that
    // used to run with nothing surfacing it anywhere.
    const reqs = await db.collection("deletionRequests").where("status", "==", "pending").get();
    for (const d of reqs.docs) {
      const r = d.data() as { email?: string; role?: string; requestedAt?: string; dueBy?: string };
      if (!r.requestedAt) continue;
      items.push({
        id: `privacy_${d.id}`, type: "privacy",
        title: `Data deletion request — ${r.email ?? "an account"}`,
        body: `${r.role ?? "account"} · respond by ${r.dueBy ?? "within one month"}`,
        href: `/platform/support`, at: r.requestedAt,
      });
    }
  }

  if (on("task")) {
    // HQ's own task board. This bell AGGREGATES on read rather than consuming
    // written notifications, so the task-reminder sweep — which writes into the
    // per-tenant `notifications` collection — could never surface here. Derive
    // the same two moments straight from the tasks instead.
    const today = ukToday();
    const snap = await db.collection("tasks").where("tenantId", "==", "__platform__").get();
    for (const d of snap.docs) {
      const t = d.data() as { t?: string; due?: string | null; time?: string | null; status?: string; archived?: boolean };
      if (t.archived || t.status === "done" || !t.due || t.due > today) continue;
      const overdue = t.due < today;
      items.push({
        id: `task_${d.id}_${t.due}`, type: "task",
        title: overdue ? `Overdue: ${t.t ?? "A task"}` : `Due today: ${t.t ?? "A task"}`,
        body: overdue ? `Was due ${t.due} and is still open.` : `Due today${t.time ? ` at ${t.time}` : ""}.`,
        href: `/platform/tasks?task=${d.id}`,
        // Sorted with everything else by time, so a task due at 18:27 appears
        // at 18:27 rather than jumping to the top of the bell all day.
        at: `${t.due}T${(t.time && /^\d{2}:\d{2}$/.test(t.time)) ? t.time : "08:00"}:00.000Z`,
      });
    }
  }

  items.sort((a, b) => (a.at < b.at ? 1 : -1));
  return items.slice(0, 60);
}

platformNotifications.get("/", async (_req, res) => {
  const { muted, lastReadAt, readIds, dismissedIds } = await getPrefs();
  const all = await buildItems(muted);
  const items = all.filter((i) => !dismissedIds.includes(i.id));
  // readIds null = prefs written before this existed. Fall back to the old
  // timestamp rule for that one read, rather than declaring everything unread.
  const unread = readIds
    ? items.filter((i) => !readIds.includes(i.id)).length
    : items.filter((i) => i.at > lastReadAt).length;
  res.json({ items, unread, muted });
});

// Opening the bell acknowledges everything currently in it — by id, so an entry
// whose `at` is still in the future stays acknowledged.
platformNotifications.post("/read", async (_req, res) => {
  const { muted, dismissedIds } = await getPrefs();
  const items = await buildItems(muted);
  await prefsDoc.set({
    lastReadAt: new Date().toISOString(),
    readIds: items.map((i) => i.id),
    // Prune to what still exists so these can't grow without bound.
    dismissedIds: dismissedIds.filter((id) => items.some((i) => i.id === id)),
  }, { merge: true });
  res.json({ ok: true });
});

// Clicking an entry takes you to the thing, so it's dealt with — drop it.
platformNotifications.post("/dismiss", async (req, res) => {
  const parsed = z.object({ id: z.string().min(1).max(200) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const { muted, dismissedIds, readIds } = await getPrefs();
  const items = await buildItems(muted);
  const live = (ids: string[]) => ids.filter((id) => items.some((i) => i.id === id));
  await prefsDoc.set({
    dismissedIds: [...new Set([...live(dismissedIds), parsed.data.id])],
    readIds: [...new Set([...live(readIds ?? []), parsed.data.id])],
  }, { merge: true });
  res.json({ ok: true });
});

platformNotifications.put("/prefs", async (req, res) => {
  const parsed = z.object({ muted: z.array(z.enum(TYPES)) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await prefsDoc.set({ muted: parsed.data.muted }, { merge: true });
  res.json({ muted: parsed.data.muted });
});
