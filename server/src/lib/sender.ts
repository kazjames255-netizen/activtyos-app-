import { db } from "../firebase";

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
  return { ...(name ? { name } : {}), ...(replyTo?.includes("@") ? { replyTo } : {}) };
}
