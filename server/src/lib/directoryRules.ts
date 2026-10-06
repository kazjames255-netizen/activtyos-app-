// PURE rules for what the public provider directory, the account profile and Stripe product lookup may say (extracted, behaviour unchanged).

/** "sam.taylor@riverside.co.uk" -> "sa***@riverside.co.uk": enough to tell two similarly named providers apart, never the usable address. */
export function maskEmail(e?: string): string | undefined {
  const m = /^([^@\s]+)@([^@\s]+\.[^@\s]+)$/.exec((e ?? "").trim());
  if (!m) return undefined;
  const local = m[1];
  return `${local.slice(0, Math.min(2, Math.max(1, local.length - 1)))}***@${m[2].toLowerCase()}`;
}

/** The full address is shown in parent sign-up search ONLY when the provider ticked 'show my address when parents search'. Default: never. */
export function publicFullAddress(billing: { address?: string; showAddressPublicly?: boolean } | undefined): string | undefined {
  return billing?.showAddressPublicly === true ? (billing.address ?? "").replace(/\s+/g, " ").trim() || undefined : undefined;
}

/** Profile > Name for someone who never gave a personal name: the name parents see (trading name, then business name, then the tenant name). */
export function displayNameFallback(settings: { providerName?: string; billing?: { businessName?: string } } | undefined, tenantName?: string): string {
  return (settings?.providerName || settings?.billing?.businessName || tenantName || "").trim();
}

/** Stripe objects made with test keys do not exist under live keys (and vice versa): ids are kept per mode. */
export const stripeMode = (secretKey: string | undefined): "live" | "test" => ((secretKey ?? "").startsWith("sk_live") ? "live" : "test");
