import { isPlaceholderName } from "../../../lib/placeholderName";

// WHO a record says did something ("took the register", "recorded the incident", "gave the medicine").
//
// Staff and managers stamp their own account name, as before. A provider who works ALONE (a freelancer, or a company owner) often has no personal
// name on the account: the Firebase display name is missing or a mailbox word such as "support", and the old stamp then fell back to the sign-in EMAIL.
// A register that says "taken by support@theircompany.com" is wrong for the provider and for the parent who reads it. For an owner the stamp is now,
// in order: a real personal name (profile, then sign-in), else the provider's public name (Setup display name, business name, tenant name), else "Provider".
// Never an email, never a role word.

const OWNER_ROLES = new Set(["company", "freelancer"]);

export interface ActorInput {
  role: string;
  tokenName?: string | null;
  userDocName?: string | null;
  email?: string | null;
  publicName?: string | null;
}

/** Pure decision. `fallback` is what the old code printed when there was no name and no email ("Staff"). */
export function pickActorName(i: ActorInput, fallback = "Staff"): string {
  if (!OWNER_ROLES.has(i.role)) return (i.tokenName ?? "").trim() || (i.email ?? "").trim() || fallback;
  const email = i.email ?? null;
  const real = [i.userDocName, i.tokenName].map((n) => (n ?? "").trim()).find((n) => n && !isPlaceholderName(n, email));
  if (real) return real;
  const pub = (i.publicName ?? "").trim();
  if (pub && !isPlaceholderName(pub, email)) return pub;
  return "Provider";
}

/** Does this account need to be asked for a real name? Owners only: staff names come from their invite. */
export function ownerNeedsRealName(i: Pick<ActorInput, "role" | "tokenName" | "userDocName" | "email">): boolean {
  if (!OWNER_ROLES.has(i.role)) return false;
  const email = i.email ?? null;
  return ![i.userDocName, i.tokenName].some((n) => (n ?? "").trim() && !isPlaceholderName(n, email));
}

/** Can this account take a register (attendance in/out, absent, head counts, notes)? Owners (freelancer / company) always can, with no staff record, no
 *  assignment and no rota entry needed: that is what lets a freelancer working alone run their own registers. */
export function canTakeRegister(role: string, hasTenant: boolean): boolean {
  return hasTenant && (role === "staff" || role === "company" || role === "freelancer" || role === "franchise");
}
