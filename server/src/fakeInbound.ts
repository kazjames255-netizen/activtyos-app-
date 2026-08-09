import "dotenv/config";

// Drop a pretend "parent reply" into a provider's Inbox, so the whole inbound
// feature can be exercised without a mail provider, a tunnel or a webhook.
//
//   npm run fake-inbound --prefix server -- <to-address|tenantId> [subject]
//
// <to-address> is the provider's own ActivityOS address, the one shown in
// Email → Settings (e.g. amir-coaching@your-id.resend.app). A raw tenant id
// works too, for when inbound isn't configured and no address is shown.
//
// This posts to the same endpoint a mail platform would, and lands in the same
// place real mail does — so replies, links, folders and the setup panel all
// behave exactly as they would in production.

const API = process.env.API_URL || "http://localhost:4000";
const SECRET = process.env.INBOUND_EMAIL_SECRET || "dev-inbound";

const [target, ...rest] = process.argv.slice(2);
if (!target) {
  console.error(
    "Usage: npm run fake-inbound --prefix server -- <to-address|tenantId> [subject]\n"
    + "  e.g. npm run fake-inbound --prefix server -- amir-coaching@your-id.resend.app",
  );
  process.exit(1);
}

const subject = rest.join(" ") || `Question about next week (${new Date().toISOString().slice(11, 19)})`;

// Deliberately multi-line and link-bearing: that's what shook out the reader
// bugs (collapsed newlines, dead URLs) the first time round.
const text = `Hi,

Quick question — is there still space on the 12th for my daughter Amelia? She's 7.

I booked through https://activityos.uk/store/demo last time. You can also reach
me on parent.test@example.com.

Thanks,
Jane`;

const body = target.includes("@")
  ? { to: target.toLowerCase(), from: "Jane Patel", fromEmail: "jane.patel@example.com", subject, text }
  : { tenantId: target, from: "Jane Patel", fromEmail: "jane.patel@example.com", subject, text };

const res = await fetch(`${API}/api/emails/inbound`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-inbound-secret": SECRET },
  body: JSON.stringify(body),
});

const payload = (await res.json().catch(() => ({}))) as { id?: string; error?: unknown };

if (res.status === 201) {
  console.log(`✓ delivered to ${target} — open Email → Inbox, it should appear without a refresh (message ${payload.id})`);
} else if (res.status === 404) {
  console.error(`✗ no provider matches "${target}".`);
  console.error("  Use the address from Email → Settings, or pass the tenant id instead.");
  process.exit(1);
} else if (res.status === 401) {
  console.error("✗ wrong inbound secret. This script reads INBOUND_EMAIL_SECRET from server/.env —");
  console.error("  it has to match the running API, which reads it from the same place.");
  process.exit(1);
} else {
  console.error(`✗ ${res.status}:`, JSON.stringify(payload.error ?? payload));
  process.exit(1);
}
