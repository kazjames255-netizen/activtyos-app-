import { db } from "../firebase";
import { fromDomain } from "./mailer";

// Per-provider sending identity — the interim before full white-label.
//
// The envelope address stays the PLATFORM's: one authenticated domain, one
// SPF/DKIM record, nothing for a provider to set up. What varies per tenant is
//   • the From display name  — families see "Sunshine Camps", not "ActivityOS"
//   • Reply-To               — a reply reaches the provider, not a no-reply box
// which is exactly the pair a mailbox is allowed to vary without owning the
// domain (Gmail SMTP included: it pins the address, never the display name).
//
// Per-provider sending DOMAINS (their own DKIM/SPF, From: @theirdomain) remain
// the white-label milestone — see README "Transactional email".

export interface Sender {
  /** From display name. Falls back to MAIL_FROM's own name when absent. */
  name?: string;
  replyTo?: string;
  /** Full From address. Only ever a per-tenant LOCAL PART on our own
   *  authenticated domain — see sendingAddress() below. */
  address?: string;
}

// ── Per-tenant local part (opt-in) ────────────────────────────────────────
// `bookings@` reads as a robot; `sunshine-camps@` reads as the provider — and
// since the DOMAIN is still ours, DKIM/SPF/DMARC are satisfied either way.
// It also gives each tenant a distinct address the inbound router can match
// on (routes/emails.ts resolves a tenant from the To: address).
//
// OFF unless MAIL_PER_TENANT_FROM=1, because it CANNOT work on Gmail SMTP:
// Gmail rewrites From to the authenticated account, so the slug would be
// silently discarded. Turn it on only on an ESP with domain authentication.
const PER_TENANT_FROM = process.env.MAIL_PER_TENANT_FROM === "1";

/** Addresses the platform reserves for itself — a tenant must never be able
 *  to send as one of these, whatever they call their business. */
const RESERVED = new Set([
  "no-reply", "noreply", "support", "help", "hello", "hi", "admin", "root",
  "postmaster", "abuse", "webmaster", "mailer-daemon", "bounce", "bounces",
  "reply", "inbound", "billing", "accounts", "security", "info", "contact",
]);

/** Business name → a safe email local part. */
export const slugify = (name: string): string =>
  name
    .normalize("NFKD").replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/, "");

/** The tenant's stable sending local part, assigned once and then never
 *  changed — a From address that drifts hurts recognition and breaks the
 *  inbound match. Returns undefined when the feature is off. */
async function sendingSlug(
  tenantId: string,
  tenant: FirebaseFirestore.DocumentSnapshot,
  name?: string,
): Promise<string | undefined> {
  if (!PER_TENANT_FROM) return undefined;
  const existing = (tenant.get("sendingSlug") as string | undefined)?.trim();
  if (existing) return existing;

  const base = slugify(name ?? "") || "provider";
  // A reserved word, or a slug another tenant already owns, gets a short
  // tenant-derived suffix rather than silently colliding.
  const taken = RESERVED.has(base)
    || !(await db.collection("tenants").where("sendingSlug", "==", base).limit(1).get()).empty;
  const slug = taken ? `${base}-${tenantId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6)}` : base;
  await db.collection("tenants").doc(tenantId).set({ sendingSlug: slug }, { merge: true });
  return slug;
}

/** Resolve a tenant's sending identity. Costs two doc reads, so callers that
 *  fan out over recipients must resolve ONCE and reuse — never per-recipient. */
export async function tenantSender(tenantId?: string, nameOverride?: string): Promise<Sender> {
  if (!tenantId) return nameOverride ? { name: nameOverride } : {};
  const [tenant, lib] = await Promise.all([
    db.collection("tenants").doc(tenantId).get(),
    db.collection("libraries").doc(tenantId).get(),
  ]);
  // Same precedence the send engine already uses for {ProviderName}: the
  // trading name from Setup wins over the account's tenant name.
  const settings = (lib.data()?.settings ?? {}) as { providerName?: string; billing?: { email?: string } };
  const name =
    nameOverride?.trim()
    || settings.providerName?.trim()
    || (tenant.get("name") as string | undefined)?.trim()
    || undefined;
  // Reply-To precedence:
  //   1. notifyEmail — the address a provider explicitly nominated for
  //      operational mail (Messages → notification settings).
  //   2. settings.billing.email — the contact address every signup seeds from
  //      the login email (routes/registerRole.ts), so there's essentially
  //      always one.
  //   3. tenants.email — a top-level field that signup does NOT write. Kept
  //      because older/hand-made tenant docs carry it, and because the inbound
  //      router still matches on it.
  //   4. the owner's login email — last resort, and the same fallback
  //      lib/notify.ts `tenantContact` uses, so the two can't disagree about
  //      where a given tenant's replies go.
  let replyTo =
    ((tenant.get("notifyEmail") as string | undefined)
      || settings.billing?.email
      || (tenant.get("email") as string | undefined)
      || "")
      .trim()
      .toLowerCase() || undefined;
  if (!replyTo) {
    const ownerUid = tenant.get("ownerUid") as string | undefined;
    if (ownerUid) {
      const owner = await db.collection("users").doc(ownerUid).get();
      replyTo = ((owner.get("email") as string | undefined) ?? "").trim().toLowerCase() || undefined;
    }
  }
  const slug = await sendingSlug(tenantId, tenant, name);
  return {
    ...(name ? { name } : {}),
    ...(replyTo?.includes("@") ? { replyTo } : {}),
    ...(slug ? { address: `${slug}@${fromDomain}` } : {}),
  };
}
