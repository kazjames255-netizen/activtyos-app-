import { db } from "../firebase";

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

export async function staffPolicy(tenantId: string): Promise<StaffPolicy> {
  try {
    const lib = await db.collection("libraries").doc(tenantId).get();
    const raw = ((lib.data()?.settings as { staff?: Partial<StaffPolicy> } | undefined)?.staff ?? {});
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
export async function staffRosterBlock(tenantId: string, staffName: string): Promise<string | null> {
  const policy = await staffPolicy(tenantId);
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
