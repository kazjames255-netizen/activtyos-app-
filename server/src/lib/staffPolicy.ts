import { db } from "../firebase";
import { loadSettings } from "./tenantLibrary";

// Settings → Staff & workforce, enforced. The certifications register
// (Documents & compliance) is matched by STAFF NAME — certs carry no staff
// id, so the name on the shift is the join key (trimmed, case-insensitive).

export interface StaffPolicy {
  assignByLeads: boolean;
  requireDBS: boolean;
  requireCompliance: boolean;
  defaultRatioTarget: number;
  inviteMessage: string;
}

const DEFAULTS: StaffPolicy = { assignByLeads: false, requireDBS: true, requireCompliance: true, defaultRatioTarget: 8, inviteMessage: "" };

/** Pass the franchiseId when the rota being built is a franchise's — it keeps
 *  its own Setup → Staff & workforce, and the compliance gate must be its. */
export async function staffPolicy(tenantId: string, franchiseId?: string | null): Promise<StaffPolicy> {
  try {
    const raw = (((await loadSettings(tenantId, franchiseId)) as { staff?: Partial<StaffPolicy> }).staff ?? {});
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Certificate types requireCompliance watches: rostering is blocked while
 *  one of these is on file but past its expiry (a missing cert doesn't block
 *  — only DBS is required to EXIST, via requireDBS). */
const KEY_CERTS = ["first aid", "safeguarding"];

/** Why this person can't be rostered right now — or null when they can.
 *  A tenant not using the compliance register (no certs at all, requireDBS
 *  off) is never blocked. */
/** A returned reference that raised a safeguarding concern nobody has
 *  reviewed yet. Safer recruitment: until a named person has looked at it,
 *  the candidate can't be cleared to start or rostered — whatever the
 *  DBS/compliance settings say. (It used to be a disabled button on one screen;
 *  the API let a manager clear them and put them on the rota.) */
export async function unresolvedReferenceConcern(tenantId: string, staffName: string): Promise<boolean> {
  const name = staffName.trim().toLowerCase();
  if (!name) return false;
  const snap = await db.collection("references").where("tenantId", "==", tenantId).get();
  return snap.docs.some((d) => String(d.get("staffName") ?? "").trim().toLowerCase() === name && d.get("concern") === true && !d.get("concernResolved"));
}

export async function staffRosterBlock(tenantId: string, staffName: string, franchiseId?: string | null): Promise<string | null> {
  // Someone whose account has been switched off has left the team — they
  // can't be put on new shifts (acceptance test d16s6).
  const people = await db.collection("users").where("tenantId", "==", tenantId).get();
  const who = staffName.trim().toLowerCase();
  if (people.docs.some((u) => String(u.get("name") ?? "").trim().toLowerCase() === who && (u.get("disabled") === true || u.get("deactivatedAt"))))
    return `${staffName}'s account is switched off — they're no longer on the team. Switch them back on in Team & invites to roster them.`;
  if (await unresolvedReferenceConcern(tenantId, staffName))
    return `${staffName} has a reference that raised a safeguarding concern nobody has reviewed yet — a named person must review it in Team → References before they can be rostered.`;
  const policy = await staffPolicy(tenantId, franchiseId);
  if (!policy.requireDBS && !policy.requireCompliance) return null;

  const name = staffName.trim().toLowerCase();
  const snap = await db.collection("certifications").where("tenantId", "==", tenantId).get();
  // Nothing in the register at all = the tenant isn't tracking compliance
  // here; the policy only bites once they've started recording certificates.
  if (snap.empty) return null;
  const today = new Date().toISOString().slice(0, 10);
  const mine = snap.docs
    .map((d) => d.data() as { staffName?: string; type?: string; expiry?: string })
    .filter((c) => (c.staffName ?? "").trim().toLowerCase() === name);

  if (policy.requireDBS) {
    const dbs = mine.filter((c) => /dbs/i.test(c.type ?? ""));
    if (!dbs.length)
      return `${staffName} has no DBS on file — add it in Documents & compliance, or turn off "Require a valid DBS" in Settings → Staff & workforce.`;
    if (!dbs.some((c) => (c.expiry ?? "") >= today))
      return `${staffName}'s DBS has expired — renew it in Documents & compliance before rostering them.`;
  }

  if (policy.requireCompliance) {
    for (const key of KEY_CERTS) {
      const certs = mine.filter((c) => (c.type ?? "").toLowerCase().includes(key));
      if (certs.length && !certs.some((c) => (c.expiry ?? "") >= today))
        return `${staffName}'s ${certs[0].type} certificate is out of date — renew it in Documents & compliance before rostering them.`;
    }
  }
  return null;
}
