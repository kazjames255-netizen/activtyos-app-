import type { Request } from "express";
import { db } from "../firebase";
import { loadSettings } from "./tenantLibrary";
import { displayNameFallback } from "./directoryRules";
import { pickActorName } from "./actorNamePure";

export { pickActorName, ownerNeedsRealName, canTakeRegister, type ActorInput } from "./actorNamePure";

const OWNER_ROLES = new Set(["company", "freelancer"]);

const publicNameCache = new Map<string, { at: number; name: string }>();
const userNameCache = new Map<string, { at: number; name: string }>();
const TTL = 60_000;

async function publicNameOf(tenantId: string): Promise<string> {
  const hit = publicNameCache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL) return hit.name;
  let name = "";
  try {
    const [settings, t] = await Promise.all([loadSettings(tenantId, null), db.collection("tenants").doc(tenantId).get()]);
    name = displayNameFallback(settings as { providerName?: string; billing?: { businessName?: string } }, t.get("name") as string | undefined);
  } catch { /* the stamp falls back to "Provider" */ }
  publicNameCache.set(tenantId, { at: Date.now(), name });
  return name;
}

async function userDocNameOf(uid: string): Promise<string> {
  const hit = userNameCache.get(uid);
  if (hit && Date.now() - hit.at < TTL) return hit.name;
  let name = "";
  try { name = String((await db.collection("users").doc(uid).get()).get("name") ?? "").trim(); } catch { /* ignore */ }
  userNameCache.set(uid, { at: Date.now(), name });
  return name;
}

/** Forget the cached names (called when a name is saved, so the next stamp is right at once). */
export function forgetActorName(uid?: string, tenantId?: string | null): void {
  if (uid) userNameCache.delete(uid);
  if (tenantId) publicNameCache.delete(tenantId);
}

/** The name to stamp on a record made by this request's account. Staff and parents cost no extra reads. */
export async function actorName(req: Request, fallback = "Staff"): Promise<string> {
  const role = req.auth?.role ?? "parent";
  if (!OWNER_ROLES.has(role)) return pickActorName({ role, tokenName: req.user?.name, email: req.user?.email }, fallback);
  const [userDocName, publicName] = await Promise.all([
    req.user?.uid ? userDocNameOf(req.user.uid) : Promise.resolve(""),
    req.auth?.tenantId ? publicNameOf(req.auth.tenantId) : Promise.resolve(""),
  ]);
  return pickActorName({ role, tokenName: req.user?.name, userDocName, email: req.user?.email, publicName }, fallback);
}

