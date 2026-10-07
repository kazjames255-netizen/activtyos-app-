import { db } from "../firebase";
import { esc } from "./html";
import { notify } from "./notify";
import { customerAreaOn } from "./customerArea";

// A provider's Newsfeed post -> one bell + one email per family who can SEE it (the same audience rule as GET /api/posts:
// families booked with the provider; a franchise-targeted post only that franchise's families; a "chosen families" post only
// families booked on the chosen listings). Families the provider has unsubscribed (emailSuppressions) get the bell only, and a
// family that muted the "newsfeed" category gets the bell but no email (notify() applies that). Fires once per post (notifiedAt),
// when it goes live: on publish, on a draft being published, or when a scheduled post's time arrives (lib/sweeps.ts).

type PostDoc = {
  tenantId?: string; tenantName?: string; title?: string; body?: string; tpl?: string; priority?: string;
  franchiseId?: string | null; audience?: string; audId?: string; audIds?: string[]; status?: string; notifiedAt?: string;
  newsletter?: { company?: { name?: string } } | null;
};

export async function notifyPostPublished(postId: string): Promise<number> {
  const ref = db.collection("posts").doc(postId);
  const snap = await ref.get();
  if (!snap.exists) return 0;
  const p = snap.data() as PostDoc;
  if (!p.tenantId || p.status !== "published" || p.notifiedAt) return 0;
  // Claim it first so a second trigger (publish + sweep) can't double-send.
  await ref.set({ notifiedAt: new Date().toISOString() }, { merge: true });
  if (!(await customerAreaOn(p.tenantId, "newsfeed"))) return 0;

  const listingIds = p.audience === "listing" ? new Set([...(p.audIds ?? []), ...(p.audId ? [p.audId] : [])]) : null;
  const bookings = await db.collection("bookings").where("tenantId", "==", p.tenantId).get();
  const franchiseOfListing = new Map<string, string | undefined>();
  if (p.franchiseId) {
    const need = [...new Set(bookings.docs.filter((d) => !d.get("franchiseId") && d.get("listingId")).map((d) => String(d.get("listingId"))))];
    for (let i = 0; i < need.length; i += 300) {
      for (const l of await db.getAll(...need.slice(i, i + 300).map((id) => db.collection("listings").doc(id)))) franchiseOfListing.set(l.id, l.exists ? (l.get("franchiseId") as string | undefined) : undefined);
    }
  }
  const families = new Set<string>();
  for (const d of bookings.docs) {
    const b = d.data() as { email?: string; listingId?: string; franchiseId?: string };
    const email = (b.email ?? "").trim().toLowerCase();
    if (!email.includes("@")) continue;
    if (p.franchiseId && (b.franchiseId ?? franchiseOfListing.get(b.listingId ?? "")) !== p.franchiseId) continue;
    if (listingIds && !(b.listingId && listingIds.has(b.listingId))) continue;
    families.add(email);
  }
  if (!families.size) return 0;

  const sup = await db.collection("emailSuppressions").where("tenantId", "==", p.tenantId).get();
  const unsubscribed = new Set(sup.docs.map((d) => String(d.get("email") ?? "").toLowerCase()));

  const provider = p.tenantName || "Your activity provider";
  const urgent = p.tpl === "urgent" || p.priority === "urgent";
  const headline = (p.title || p.newsletter?.company?.name || "").trim();
  const text = (p.body ?? "").replace(/\s+/g, " ").trim();
  const preview = text.length > 140 ? `${text.slice(0, 137)}…` : text;
  const title = urgent ? `Urgent from ${provider}` : `News from ${provider}`;
  const body = headline || preview || "A new update is waiting in your Newsfeed.";
  await Promise.all([...families].map((email) =>
    notify({
      tenantId: p.tenantId!,
      to: { kind: "parent", email },
      category: "newsfeed",
      title,
      body,
      subject: urgent ? `Urgent: ${headline || `a notice from ${provider}`}` : `${provider}: ${headline || "a new update"}`,
      emailHtml: `${headline ? `<p><b>${esc(headline)}</b></p>` : ""}${preview ? `<p>${esc(preview)}</p>` : ""}<p>Open your Newsfeed to read it${urgent ? " and tap “Got it”" : ""}.</p>`,
      href: "/custdash/newsfeed",
      ref: postId,
      bellOnly: unsubscribed.has(email),
    }),
  ));
  return families.size;
}
