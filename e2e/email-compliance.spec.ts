import { test, expect } from "@playwright/test";
import { API_URL, loadAccounts } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, apiFetch, apiPost, fbSignIn } from "./helpers/accounts";

// The email send engine's legal & delivery guarantees, asserted at the API
// layer (no UI): the UK PECR consent split (booked families are soft opt-in,
// never-booked contacts need explicit opt-in, suppression always wins), the
// one-click unsubscribe loop, delivery/open-pixel recording on the history
// doc, the recipient cap, and the scheduled-send sweep actually firing.
//
// dryRun: POST /api/emails/send { dryRun: true } resolves the recipient set
// exactly like a real send (same marketBlock filter) without sending — that's
// what makes consent filtering assertable without inspecting a mailbox.
// Rendered per-recipient content (merge fields) goes only to the SMTP
// transport (Ethereal in dev), so content itself is NOT assertable here; the
// merge path is exercised by sending a tokened body and asserting delivery.

interface DryRun { dryRun: boolean; recipientCount: number; sample: string[] }
interface HistoryDoc { id: string; status: string; delivered: number; openedBy?: string[]; recipientCount: number; scheduledId?: string; subject: string; fromName?: string; replyTo?: string }
interface Segment { id: string; name: string; emails: string[] }
interface SenderIdentity { fromName: string; fromAddress: string; replyTo: string | null }
interface MsgSettings { notifyEmail: string; accountEmail: string }

const em = (tag: string, stamp: string) => `e2e-${tag}-${stamp}@${TEST_EMAIL_DOMAIN}`;

/** A customer record (never booked) with explicit consent state. */
const addCustomer = (token: string, stamp: string, tag: string, optIn?: boolean) =>
  apiPost("/api/customers", token, {
    name: `E2E ${tag} ${stamp}`,
    email: em(tag, stamp),
    ...(optIn === undefined ? {} : { marketingOptIn: optIn }),
  });

/** A booked family: the operator's manual phone-booking flow — a real
 *  bookings doc, which is what grants the marketing soft opt-in. */
const addBookedFamily = (token: string, stamp: string, tag: string, booker = "E2E Parent") =>
  apiPost("/api/bookings", token, {
    booker: `${booker} ${stamp}`,
    email: em(tag, stamp),
    child: `E2E Kid ${stamp}`,
    age: 8,
    listing: `E2E Consent Camp ${stamp}`,
    pass: "Day pass",
    dates: "Phone booking",
    amount: 0,
    method: "cash",
  });

const dryRun = (token: string, recipients: string[]) =>
  apiPost<DryRun>("/api/emails/send", token, {
    subject: "E2E consent dry-run",
    body: "Who would this reach?",
    audience: "all",
    recipients,
    dryRun: true,
  });

test.describe("email compliance & send engine (API)", () => {
  let token: string;
  let tenantId: string;
  let tenantName: string;
  let companyEmail: string;

  test.beforeEach(async () => {
    const accounts = loadAccounts();
    companyEmail = accounts.accounts.company.email;
    token = (await fbSignIn(companyEmail)).idToken;
    tenantId = accounts.accounts.company.tenantId!; // operator accounts always provision a tenant
    tenantName = accounts.accounts.company.tenantName!; // seeded as settings.providerName too
  });

  test("marketing sends obey the PECR consent split; transactional mail is exempt", async () => {
    const stamp = Date.now().toString(36);
    await addBookedFamily(token, stamp, "booked");
    await addCustomer(token, stamp, "optin", true);
    await addCustomer(token, stamp, "silent");        // never booked, no consent field
    await addCustomer(token, stamp, "optout", false);

    const all = ["booked", "optin", "silent", "optout"].map((t) => em(t, stamp));
    const r = await dryRun(token, all);
    // Booked → soft opt-in; explicit opt-in → yes. Silent and opted-out
    // never-booked contacts must be dropped.
    expect(r.recipientCount).toBe(2);
    expect(r.sample).toContain(em("booked", stamp));
    expect(r.sample).toContain(em("optin", stamp));
    expect(r.sample).not.toContain(em("silent", stamp));
    expect(r.sample).not.toContain(em("optout", stamp));

    // A booked family who explicitly opts OUT is blocked despite the booking.
    await apiPost("/api/customers", token, { name: `E2E BookedOut ${stamp}`, email: em("booked", stamp), marketingOptIn: false });
    const afterOptOut = await dryRun(token, [em("booked", stamp), em("optin", stamp)]);
    expect(afterOptOut.recipientCount).toBe(1);
    expect(afterOptOut.sample).toEqual([em("optin", stamp)]);

    // Transactional ("one") mail ignores marketing consent entirely.
    const oneOff = await apiPost<DryRun>("/api/emails/send", token, {
      subject: "E2E transactional dry-run", body: "Your booking details.",
      audience: "one", to: em("silent", stamp), dryRun: true,
    });
    expect(oneOff.recipientCount).toBe(1);
  });

  test("one-click unsubscribe suppresses future marketing and drops them from audiences", async () => {
    const stamp = Date.now().toString(36);
    const target = em("unsub", stamp);
    await addBookedFamily(token, stamp, "unsub");

    // Booked → reachable today.
    expect((await dryRun(token, [target])).recipientCount).toBe(1);

    // The footer's unsubscribe link is GET /api/emails/unsubscribe?u=<token>,
    // where the token is base64url("tenantId:email") — same encoding the
    // footer builds. Public endpoint: a mail client carries no auth.
    const tok = Buffer.from(`${tenantId}:${target}`).toString("base64url");
    const page = await fetch(`${API_URL}/api/emails/unsubscribe?u=${tok}`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("unsubscribed");

    // Suppression beats the booking's soft opt-in: the resolver now filters
    // them to zero and refuses the send outright.
    await expect(dryRun(token, [target])).rejects.toThrow(/No families to email/);

    // And every marketing audience stops listing them.
    const segs = await apiFetch<Segment[]>("/api/emails/audiences", token);
    for (const s of segs) expect(s.emails, `segment ${s.id}`).not.toContain(target);
  });

  test("delivery, the merge path and the open pixel are recorded on the history doc", async () => {
    const stamp = Date.now().toString(36);
    const target = em("deliver", stamp);
    const subject = `E2E delivery ${stamp}`;
    await addBookedFamily(token, stamp, "deliver", "Mergey Parent");

    // A tokened body forces the per-recipient merge pass; content can't be
    // read back (it goes to the transport), but a send that resolves tokens
    // and still hands off cleanly proves the path doesn't break delivery.
    const sent = await apiPost<HistoryDoc>("/api/emails/send", token, {
      subject,
      body: "Hi {ParentName} — about {ListingName} on {SessionDate}.",
      audience: "all",
      recipients: [target],
    });
    expect(sent.recipientCount).toBe(1);

    // Delivery settles in the background; the history doc records it.
    await expect.poll(async () => {
      const list = await apiFetch<HistoryDoc[]>("/api/emails", token);
      return list.find((h) => h.id === sent.id)?.status;
    }, { timeout: 30_000 }).toBe("sent");
    const doc = (await apiFetch<HistoryDoc[]>("/api/emails", token)).find((h) => h.id === sent.id)!;
    expect(doc.delivered).toBe(1);

    // The recipient "opens" it: their client fetches the tracking pixel.
    const gif = await fetch(`${API_URL}/api/emails/open/${sent.id}?r=${encodeURIComponent(target)}`);
    expect(gif.status).toBe(200);
    expect(gif.headers.get("content-type")).toContain("image/gif");
    await expect.poll(async () => {
      const list = await apiFetch<HistoryDoc[]>("/api/emails", token);
      return list.find((h) => h.id === sent.id)?.openedBy ?? [];
    }, { timeout: 15_000 }).toContain(target);
  });

  // Per-provider sending identity (openapi v0.32.0). The envelope address is
  // the platform's for every tenant, so what has to be proven is that the
  // PROVIDER's name and reply address are the ones each send actually carries
  // — and that the history doc records them, which is the only place the
  // identity is readable back (the headers themselves reach only the SMTP
  // transport, same limitation as rendered content above).
  test("a send carries the provider's name and reply address, and records both", async () => {
    const stamp = Date.now().toString(36);
    const subject = `E2E identity ${stamp}`;

    const identity = await apiFetch<SenderIdentity>("/api/emails/sender", token);
    // THIS run's provider name (global.setup seeds settings.providerName with
    // it), never the platform's — a bare "not ActivityOS" would pass on any
    // tenant and prove nothing.
    expect(identity.fromName).toBe(tenantName);
    expect(identity.fromAddress).toContain("@");
    // A provider must always have a reply address — null would mean families
    // replying into a void, and would also make the round-trip below vacuous.
    expect(identity.replyTo).toBeTruthy();

    const sent = await apiPost<HistoryDoc>("/api/emails/send", token, {
      subject, body: "Who am I from?", audience: "one", to: em("identity", stamp),
    });
    await expect.poll(async () => {
      const list = await apiFetch<HistoryDoc[]>("/api/emails", token);
      return list.find((h) => h.id === sent.id)?.status;
    }, { timeout: 30_000 }).toBe("sent");

    const doc = (await apiFetch<HistoryDoc[]>("/api/emails", token)).find((h) => h.id === sent.id)!;
    expect(doc.fromName).toBe(identity.fromName);
    expect(doc.replyTo ?? null).toBe(identity.replyTo);
  });

  test("Reply-To follows the tenant's notification address, falling back to its contact email", async () => {
    const stamp = Date.now().toString(36);
    const nominated = em("replyto", stamp);
    const before = await apiFetch<MsgSettings>("/api/messages/settings", token);
    const put = (notifyEmail: string) =>
      apiFetch<MsgSettings>("/api/messages/settings", token, { method: "PUT", body: JSON.stringify({ notifyEmail }) });

    try {
      // Setup → the address a provider nominates for operational mail wins…
      await put(nominated);
      await expect.poll(
        async () => (await apiFetch<SenderIdentity>("/api/emails/sender", token)).replyTo,
        { timeout: 15_000 },
      ).toBe(nominated);

      // …and clearing it falls back to the tenant's contact email rather than
      // going empty (a reply must always reach a human). Signup seeds that
      // contact from the login email, so for this run it's the operator's own
      // account — NOT `accountEmail`, which reads a top-level tenants.email
      // that signup never writes (see lib/sender.ts).
      await put("");
      await expect.poll(
        async () => (await apiFetch<SenderIdentity>("/api/emails/sender", token)).replyTo,
        { timeout: 15_000 },
      ).toBe(companyEmail.toLowerCase());
    } finally {
      // Shared tenant state — always hand it back as we found it, or every
      // later send in this run inherits a throwaway reply address.
      await put(before.notifyEmail).catch(() => {});
    }
  });

  test("oversized blasts are rejected at the recipient cap", async () => {
    const stamp = Date.now().toString(36);
    const horde = Array.from({ length: 2001 }, (_, i) => `e2e-cap-${i}-${stamp}@${TEST_EMAIL_DOMAIN}`);
    await expect(apiPost("/api/emails/send", token, {
      subject: "E2E cap", body: "Too many.", audience: "all", recipients: horde, dryRun: true,
    })).rejects.toThrow(/2000|Too many/);
  });

  test("a scheduled send fires through the sweep at its minute", async () => {
    // Schedule 2 UK-wall-clock minutes out; the sweep polls every 60s, so the
    // send lands within ~3 minutes. Generous timeout, slow poll.
    test.setTimeout(300_000);
    const stamp = Date.now().toString(36);
    const subject = `E2E sweep-fire ${stamp}`;

    const ukStamp = (plusMinutes: number) => {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false,
      }).formatToParts(new Date(Date.now() + plusMinutes * 60_000));
      const g = (t: string) => parts.find((p) => p.type === t)!.value;
      return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
    };

    const sched = await apiPost<{ id: string }>("/api/emails/schedule", token, {
      subject, body: "See you soon.", audience: "one",
      to: em("sweep", stamp), sendAt: ukStamp(2),
    });

    // The queue doc flips to "sent" when the sweep fires it…
    await expect.poll(async () => {
      const q = await apiFetch<{ id: string; status: string }[]>("/api/emails/scheduled", token);
      return q.find((s) => s.id === sched.id)?.status;
    }, { timeout: 240_000, intervals: [5_000] }).toBe("sent");

    // …and the send lands in the history with full provenance and delivery.
    const hist = await apiFetch<HistoryDoc[]>("/api/emails", token);
    const doc = hist.find((h) => h.scheduledId === sched.id);
    expect(doc, "history doc linked via scheduledId").toBeTruthy();
    expect(doc!.subject).toBe(subject);
    await expect.poll(async () => {
      const list = await apiFetch<HistoryDoc[]>("/api/emails", token);
      return list.find((h) => h.scheduledId === sched.id)?.delivered;
    }, { timeout: 30_000 }).toBe(1);
  });
});
