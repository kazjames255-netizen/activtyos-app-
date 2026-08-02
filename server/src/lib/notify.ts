// Notifications — one call raises the in-app bell AND sends the email.
//
// Two audiences, and the distinction matters for both addressing and privacy:
//   · "parent" — one family, matched by email. Only they ever see it.
//   · "tenant" — the provider's team. Any operator/staff on that tenant sees it.
// Every notification carries a tenantId regardless, so the realtime channel and
// the e2e cleanup can scope by provider.
//
// Who decides whether a notification is sent:
//   · The PROVIDER's Setup toggles are the caller's business — the route
//     already has the settings loaded and knows which flag governs it.
//   · The PARENT's own mute is handled here, centrally, so no caller can
//     forget it. A muted family still gets the record written to their bell
//     (they asked not to be chased, not to be kept in the dark) — it's the
//     email that's suppressed.

import { db } from "../firebase";
import { sendMail, type MailAttachment } from "./mailer";
import { webUrl } from "./stripe";

const col = () => db.collection("notifications");
const prefsCol = () => db.collection("notificationPrefs");

/** What a notification is about. Doubles as the mute key a parent can set. */
export type NotifyCategory =
  | "accident"
  | "incident"
  | "medication"
  | "booking"
  | "trip"
  | "calendar"
  | "message"
  | "moment"
  | "register"
  | "billing";

export interface NotificationDoc {
  tenantId: string;
  audience: "parent" | "tenant";
  /** Lowercased recipient email — set for parent-addressed notifications. */
  email?: string;
  category: NotifyCategory;
  title: string;
  body: string;
  /** Deep link into the app, relative ("/custdash/accidents"). */
  href?: string;
  /** The record this is about, so a client can jump straight to it. */
  ref?: string;
  readAt: string | null;
  at: string;
}

export interface ParentNotifyPrefs {
  email: string;
  /** Categories the family has asked not to be emailed about. */
  muted: Partial<Record<NotifyCategory, boolean>>;
  updatedAt: string;
}

const key = (email: string) => email.trim().toLowerCase();

/** Has this family muted emails about this kind of thing? */
export async function isMuted(email: string, category: NotifyCategory): Promise<boolean> {
  if (!email) return false;
  const snap = await prefsCol().doc(key(email)).get();
  return Boolean(snap.exists && (snap.get("muted") as Record<string, boolean> | undefined)?.[category]);
}

export async function getPrefs(email: string): Promise<ParentNotifyPrefs> {
  const snap = await prefsCol().doc(key(email)).get();
  return {
    email: key(email),
    muted: (snap.exists ? (snap.get("muted") as ParentNotifyPrefs["muted"]) : {}) ?? {},
    updatedAt: (snap.exists ? (snap.get("updatedAt") as string) : "") || "",
  };
}

export async function setMuted(email: string, category: NotifyCategory, muted: boolean): Promise<ParentNotifyPrefs> {
  const ref = prefsCol().doc(key(email));
  await ref.set(
    { email: key(email), muted: { [category]: muted }, updatedAt: new Date().toISOString() },
    { merge: true },
  );
  return getPrefs(email);
}

/** The address a provider wants operational mail on, falling back to the
 *  account address. Mirrors what routes/messages.ts already does. */
async function tenantContact(tenantId: string): Promise<{ email?: string; name: string; portal?: string }> {
  const t = await db.collection("tenants").doc(tenantId).get();
  if (!t.exists) return { name: "Your activity provider" };
  // The tenant's operator portal (freelancer / company / franchise), from its
  // plan/type — so notification links point at the portal this team uses.
  const plan = ((t.get("subscription") as { plan?: string } | undefined)?.plan || (t.get("type") as string) || "").toLowerCase();
  const portal = plan.includes("freelanc") ? "freelancer" : plan.includes("franchis") ? "franchise" : plan.includes("company") ? "company" : undefined;
  let email = (t.get("notifyEmail") as string) || (t.get("email") as string) || undefined;
  // Many tenants never set notifyEmail — fall back to the owner's account email
  // so operator notifications still reach someone.
  if (!email) {
    const ownerUid = t.get("ownerUid") as string | undefined;
    if (ownerUid) {
      const u = await db.collection("users").doc(ownerUid).get();
      email = (u.exists ? (u.get("email") as string) : undefined) || undefined;
    }
  }
  return {
    email,
    name: (t.get("name") as string) || "Your activity provider",
    portal,
  };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function layout(heading: string, body: string, href?: string, footer?: string): string {
  const link = href ? (href.startsWith("http") ? href : `${webUrl}${href}`) : null;
  return `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#171534">
    <div style="padding:18px 0 10px;border-bottom:2px solid #1d3a8f">
      <strong style="font-size:18px">${escapeHtml(heading)}</strong>
      <span style="color:#8a86a3;font-size:12px"> · via ActivityOS</span>
    </div>
    <div style="font-size:14px;line-height:1.6;margin:18px 0">${body}</div>
    ${link ? `<p><a href="${link}" style="display:inline-block;background:#1d3a8f;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px">Open in ActivityOS</a></p>` : ""}
    <p style="color:#8a86a3;font-size:11.5px;margin-top:22px">${escapeHtml(footer ?? "You're receiving this because of your account on ActivityOS.")}</p>
  </div>`;
}

export interface NotifyInput {
  tenantId: string;
  /** A family's email, or the provider's whole team. */
  to: { kind: "parent"; email: string } | { kind: "tenant" };
  category: NotifyCategory;
  /** Bell headline — short. */
  title: string;
  /** Bell body, and the email's opening line unless `emailHtml` overrides it. */
  body: string;
  href?: string;
  ref?: string;
  /** Defaults to `title`. */
  subject?: string;
  /** Richer email body; plain `body` is used when absent. */
  emailHtml?: string;
  /** A FULLY-composed email (own header, layout, button) — bypasses the
   *  standard `layout()` wrapper entirely. Any `{{VIEW_URL}}` token in it is
   *  replaced with the resolved absolute, portal-correct deep link. */
  emailFullHtml?: string;
  /** Files to attach to the email (e.g. a child's EHCP plan). */
  attachments?: MailAttachment[];
  /** Bell only — no email regardless of mute (e.g. low-value chatter). */
  bellOnly?: boolean;
}

/** Raise the bell and send the email. Fire-and-forget: a notification must
 *  never fail the thing it is reporting on. */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const parentEmail = input.to.kind === "parent" ? key(input.to.email) : undefined;
    if (input.to.kind === "parent" && !parentEmail) return;

    const provider = await tenantContact(input.tenantId);
    // Point operator links at the portal this team actually uses (a freelancer
    // tenant's link shouldn't say /company/). Parent links (/custdash/) are left
    // alone. The in-app bell still re-maps per viewer; this fixes the email too.
    const href =
      input.href && input.to.kind === "tenant" && provider.portal
        ? input.href.replace(/^\/(company|franchise|freelancer|staff)\//, `/${provider.portal}/`)
        : input.href;

    await col().add({
      tenantId: input.tenantId,
      audience: input.to.kind,
      ...(parentEmail ? { email: parentEmail } : {}),
      category: input.category,
      title: input.title,
      body: input.body,
      ...(href ? { href } : {}),
      ...(input.ref ? { ref: input.ref } : {}),
      readAt: null,
      at: new Date().toISOString(),
    } satisfies NotificationDoc);

    if (input.bellOnly) return;

    let to: string | undefined;
    let footer: string | undefined;
    if (parentEmail) {
      if (await isMuted(parentEmail, input.category)) return; // bell yes, email no
      to = parentEmail;
      footer = `You're receiving this because your child attends with ${provider.name}. You can turn these off in your account.`;
    } else {
      to = provider.email;
      footer = "You're receiving this because you're on this provider's team on ActivityOS.";
    }
    if (!to?.includes("@")) return;

    // A fully-composed email brings its own header/layout/button; we only
    // resolve its {{VIEW_URL}} into the absolute, portal-correct deep link.
    // Otherwise wrap the (plain or rich) body in the standard layout.
    const link = href ? (href.startsWith("http") ? href : `${webUrl}${href}`) : "";
    const html = input.emailFullHtml
      ? input.emailFullHtml.replace(/\{\{VIEW_URL\}\}/g, link)
      : layout(provider.name, input.emailHtml ?? `<p>${escapeHtml(input.body)}</p>`, href, footer);

    await sendMail(
      to,
      input.subject ?? input.title,
      html,
      // The provider's name on the From line either way. Reply-To only for
      // family mail — pointing the team's own notification back at itself
      // would just loop.
      { name: provider.name, ...(parentEmail && provider.email ? { replyTo: provider.email } : {}) },
      input.attachments?.length ? { attachments: input.attachments } : undefined,
    );
  } catch (e) {
    console.error("[notify] failed:", (e as Error).message);
  }
}

/** The email of the parent a child record belongs to. Safeguarding and
 *  medication both need it, and both must fail quietly: an unlinked child (a
 *  walk-in with no booking) simply has nobody to tell. */
export async function parentEmailForChild(childId?: string): Promise<string | null> {
  if (!childId) return null;
  const child = await db.collection("children").doc(childId).get();
  const uid = child.exists ? (child.get("parentUid") as string | undefined) : undefined;
  if (!uid) return null;
  const user = await db.collection("users").doc(uid).get();
  const email = user.exists ? (user.get("email") as string | undefined) : undefined;
  return email ? key(email) : null;
}

/** A family's bell, newest first. */
export async function notificationsForParent(email: string, limit = 100) {
  const snap = await col().where("email", "==", key(email)).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as NotificationDoc) }))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

/** A provider team's bell, newest first. Parent-addressed notifications carry
 *  the same tenantId but are the family's business, not the team's. */
export async function notificationsForTenant(tenantId: string, limit = 100) {
  const snap = await col().where("tenantId", "==", tenantId).where("audience", "==", "tenant").get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as NotificationDoc) }))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

/** Mark specific notifications read, or every one the caller can see. */
export async function markRead(
  scope: { email?: string; tenantId?: string },
  ids?: string[],
): Promise<number> {
  const mine = scope.email
    ? await notificationsForParent(scope.email, 500)
    : scope.tenantId
      ? await notificationsForTenant(scope.tenantId, 500)
      : [];
  const targets = mine.filter((n) => !n.readAt && (!ids?.length || ids.includes(n.id)));
  if (!targets.length) return 0;
  const at = new Date().toISOString();
  const batch = db.batch();
  for (const n of targets) batch.update(col().doc(n.id), { readAt: at });
  await batch.commit();
  return targets.length;
}
