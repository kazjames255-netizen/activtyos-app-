import { db } from "../firebase";
import { esc } from "./html";
import { sendMail } from "./mailer";
import { notifyTenantMember } from "./notify";
import { webUrl } from "./stripe";
import { franchiseForChild, libraryDocId } from "./tenantLibrary";

// ─────────────────────────────────────────────────────────────────────────
// Alert the Designated Safeguarding Lead when a concern is logged.
//
// Setup → Safeguarding names the DSL and their email ("This person is alerted
// on every concern"), but nothing read it: on a company account a coach could
// log a disclosure and the DSL heard nothing (acceptance d13s2).
//
// Who (decided by Kaz 13 Sept, backlog s13-fx5-dsl):
//   · the DSL — and the deputy DSL when Setup names one — of the CHILD's
//     franchise when it names one, else head office's; nobody named anywhere →
//     the account holder (the setting's documented default);
//   · an allegation about a member of staff ALSO goes to the account holder;
//   · an allegation about the DSL (or deputy) THEMSELVES goes to the account
//     holder ONLY — the leads aren't told and can't open it (aboutDsl);
//   · never whoever logged it (a solo provider IS the DSL).
//
// How: an in-app bell aimed at the person's own account (when one on this
// tenant has that email), plus an email to the address. The email says only
// that a concern needs attention, with a link — safeguarding details stay in
// the app, never in someone's inbox.
//
// The named leads also get full safeguarding read/write on concerns and
// allegations even on a staff account (isSafeguardingLead — used by
// routes/incidents.ts and middleware/access.ts).
// ─────────────────────────────────────────────────────────────────────────

type ConcernRec = {
  kind?: string;
  subject?: string;
  confidential?: boolean;
  aboutDsl?: boolean;
  childId?: string | null;
  childName?: string;
  franchiseId?: string | null;
  recordedBy?: string;
  recordedByName?: string;
  date?: string;
};

/** A record that goes to the DSL: a safeguarding concern, an allegation about
 *  a member of staff, or anything filed as confidential. */
export const needsDsl = (r: ConcernRec) => r.kind === "safeguarding" || r.subject === "staff" || r.confidential === true;

/** An allegation whose subject is the DSL or deputy themselves — the account
 *  holder's alone. */
export const aboutLead = (r: ConcernRec) => r.subject === "staff" && r.aboutDsl === true;

/** A record a named safeguarding lead gets full access to. */
export const leadCovers = (r: ConcernRec) => needsDsl(r) && !aboutLead(r);

type Sg = { dslEmail?: string; dslName?: string; deputyDslEmail?: string; deputyDslName?: string };
const sgIn = async (libId: string): Promise<Sg> =>
  (((await db.collection("libraries").doc(libId).get()).data()?.settings as { safeguarding?: Sg } | undefined)?.safeguarding) ?? {};
const clean = (s: unknown) => String(s ?? "").trim();
const normName = (s: unknown) => clean(s).toLowerCase().replace(/\s+/g, " ");

/** The named leads (DSL + optional deputy) for a franchise, else head office:
 *  lower-cased emails and names. A franchise that names neither falls back to
 *  head office's (a franchise library seeded from head office carries its
 *  names anyway). */
export async function safeguardingLeads(tenantId: string, franchiseId: string | null | undefined): Promise<{ emails: string[]; names: string[] }> {
  const pick = (sg: Sg) => ({
    emails: [...new Set([sg.dslEmail, sg.deputyDslEmail].map((e) => clean(e).toLowerCase()).filter((e) => e.includes("@")))],
    names: [...new Set([sg.dslName, sg.deputyDslName].map(normName).filter(Boolean))],
  });
  if (franchiseId) {
    const fr = pick(await sgIn(libraryDocId(tenantId, franchiseId)));
    if (fr.emails.length) return fr;
  }
  return pick(await sgIn(tenantId));
}

/** Is this signed-in person a named DSL / deputy DSL for their own scope? */
export async function isSafeguardingLead(auth: { tenantId: string | null; franchiseId?: string | null }, email: string | null | undefined): Promise<boolean> {
  const me = clean(email).toLowerCase();
  if (!auth.tenantId || !me) return false;
  return (await safeguardingLeads(auth.tenantId, auth.franchiseId ?? null)).emails.includes(me);
}

/** Does this allegation name one of the leads? The concern form's "this is
 *  about our safeguarding lead" tick, or the named staff member matching the
 *  DSL's / deputy's name in Setup. */
export async function namesALead(tenantId: string, franchiseId: string | null | undefined, rec: ConcernRec): Promise<boolean> {
  if (rec.subject !== "staff") return false;
  if (rec.aboutDsl === true) return true;
  const who = normName(rec.childName);
  return !!who && (await safeguardingLeads(tenantId, franchiseId)).names.includes(who);
}

/** The account holder: the franchise's own account for a franchise's concern,
 *  else the tenant's notification address / owner. */
async function accountHolder(tenantId: string, franchiseId: string | null): Promise<string> {
  if (franchiseId) {
    const q = await db.collection("users").where("tenantId", "==", tenantId).where("franchiseId", "==", franchiseId).where("role", "==", "franchise").limit(1).get();
    const e = q.empty ? "" : String(q.docs[0].get("email") ?? "");
    if (e) return e;
  }
  const t = (await db.collection("tenants").doc(tenantId).get()).data() ?? {};
  let e = String(t.notifyEmail || t.email || "");
  if (!e && t.ownerUid) e = String((await db.collection("users").doc(String(t.ownerUid)).get()).get("email") ?? "");
  return e;
}

/** The person's user account on this tenant, matched by email. */
async function dslUser(tenantId: string, email: string) {
  for (const e of [...new Set([email, email.toLowerCase()])]) {
    const q = await db.collection("users").where("tenantId", "==", tenantId).where("email", "==", e).limit(1).get();
    if (!q.empty) return q.docs[0].data() as { role?: string };
  }
  return null;
}

const PORTAL_PATH: Record<string, string> = {
  company: "/company/incidents",
  freelancer: "/freelancer/incidents",
  franchise: "/franchise/incidents",
  staff: "/staff/incident",
};

/** Fire-and-forget: an alert must never fail the record it is about. */
export async function alertDsl(tenantId: string, recordId: string, rec: ConcernRec): Promise<void> {
  try {
    if (!needsDsl(rec)) return;
    const franchiseId = (await franchiseForChild(tenantId, rec.childId)) ?? rec.franchiseId ?? null;
    const holder = clean(await accountHolder(tenantId, franchiseId)).toLowerCase();
    const leads = (await safeguardingLeads(tenantId, franchiseId)).emails;
    const recipients: { email: string; as: "lead" | "holder" }[] = aboutLead(rec)
      ? [{ email: holder, as: "holder" }]
      : [
          ...(leads.length ? leads.map((email) => ({ email, as: "lead" as const })) : [{ email: holder, as: "holder" as const }]),
          ...(rec.subject === "staff" ? [{ email: holder, as: "holder" as const }] : []),
        ];
    const me = clean(rec.recordedBy).toLowerCase();
    const seen = new Set<string>();
    // No self-alert: whoever logged it already knows.
    const to = recipients.filter((r) => r.email.includes("@") && r.email !== me && !seen.has(r.email) && !!seen.add(r.email));
    if (!to.length) return;

    const tenant = (await db.collection("tenants").doc(tenantId).get()).data() ?? {};
    const plan = String((tenant.subscription as { plan?: string } | undefined)?.plan || tenant.type || "").toLowerCase();
    const provider = String(tenant.name || "your provider");
    const what = rec.subject === "staff" ? "concern about a member of staff" : "safeguarding concern";
    for (const r of to) {
      const user = await dslUser(tenantId, r.email);
      const portal = user?.role && PORTAL_PATH[user.role] ? user.role
        : franchiseId ? "franchise" : plan.includes("freelanc") ? "freelancer" : "company";
      const href = PORTAL_PATH[portal];
      const onlyYou = aboutLead(rec) ? " It concerns your safeguarding lead, so it has come to you only." : "";
      if (user) {
        await notifyTenantMember(tenantId, r.email, {
          category: "incident",
          title: `New ${what} — needs your attention`,
          body: `Logged by ${rec.recordedByName || "a member of the team"}${rec.date ? ` for ${rec.date}` : ""}. Open the safeguarding log to read it and record your decision.${onlyYou}`,
          href,
          ref: recordId,
        });
      }
      console.log(`[dsl] ${what} ${recordId} (tenant ${tenantId}${franchiseId ? `, franchise ${franchiseId}` : ""}) → alerting ${r.email} as ${r.as}${user ? " (bell + email)" : " (email; no account with that address)"}${aboutLead(rec) ? " [about a lead — holder only]" : ""}`);
      await sendMail(
        r.email,
        `A new ${what} needs your attention`,
        `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#171534;font-size:14px;line-height:1.6">` +
          `<p>A new ${what} has been logged at <b>${esc(provider)}</b> and needs your attention as ${r.as === "lead" ? "the safeguarding lead" : "the account holder"}.</p>` +
          `<p>For confidentiality the details are only in the app.</p>` +
          `<p><a href="${webUrl}${href}" style="display:inline-block;background:#1d3a8f;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700">Open the safeguarding log</a></p>` +
          `</div>`,
        { name: provider },
      );
    }
  } catch (e) {
    console.error("[dsl] alert failed:", (e as Error).message);
  }
}
