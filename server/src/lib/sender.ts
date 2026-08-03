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

/** The tenant's stable mail slug, assigned once and then never changed.
 *
 *  Assigned for EVERY tenant regardless of MAIL_PER_TENANT_FROM, because the
 *  inbound address (`<slug>@<INBOUND_EMAIL_DOMAIN>`) depends on it too — a
 *  provider's forwarding rule points at that address forever, so it must not
 *  appear or change with an outbound feature flag. */
export async function tenantSlug(
  tenantId: string,
  tenant?: FirebaseFirestore.DocumentSnapshot,
  name?: string,
): Promise<string> {
  const snap = tenant ?? (await db.collection("tenants").doc(tenantId).get());
  const existing = (snap.get("sendingSlug") as string | undefined)?.trim();
  if (existing) return existing;

  const base = slugify(name ?? (snap.get("name") as string | undefined) ?? "") || "provider";
  // A reserved word, or a slug another tenant already owns, gets a short
  // tenant-derived suffix rather than silently colliding.
  const taken = RESERVED.has(base)
    || !(await db.collection("tenants").where("sendingSlug", "==", base).limit(1).get()).empty;
  const slug = taken ? `${base}-${tenantId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6)}` : base;
  await db.collection("tenants").doc(tenantId).set({ sendingSlug: slug }, { merge: true });
  return slug;
}

// ── Inbound (mailbox redirect) ────────────────────────────────────────────
// A provider adds ONE redirect rule in Outlook/Gmail pointing at their
// ActivityOS address; their parent mail then appears in the in-app Inbox.
// This is a SEPARATE domain from sending: its MX records point at the
// inbound-parse provider, whereas the sending domain's don't.
const INBOUND_DOMAIN = (process.env.INBOUND_EMAIL_DOMAIN ?? "").trim().toLowerCase();
/** False until an inbound domain is configured — the UI must say so rather
 *  than show providers an address that silently swallows their mail. */
export const inboundConfigured = !!INBOUND_DOMAIN;
export const inboundDomain = INBOUND_DOMAIN;

/** Where this tenant's redirected mail should be sent, or null when no
 *  inbound domain is configured yet. */
export async function inboundAddress(tenantId: string): Promise<string | null> {
  if (!INBOUND_DOMAIN) return null;
  return `${await tenantSlug(tenantId)}@${INBOUND_DOMAIN}`;
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
  // The slug is assigned either way (inbound needs it); it only becomes the
  // From address when per-tenant sending is switched on. Derive it from the
  // tenant's own name, NOT `name` — that may carry a per-send override, and
  // the slug has to stay stable forever.
  const slug = await tenantSlug(tenantId, tenant, settings.providerName);
  return {
    ...(name ? { name } : {}),
    ...(replyTo?.includes("@") ? { replyTo } : {}),
    ...(PER_TENANT_FROM ? { address: `${slug}@${fromDomain}` } : {}),
  };
}
