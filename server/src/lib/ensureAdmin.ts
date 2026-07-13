import { auth, db } from "../firebase";

/**
 * Idempotently ensure the Platform (HQ) super-admin exists.
 *
 * - Account missing → created with the given password.
 * - Account exists → password is left ALONE (so the admin can change it via
 *   "Forgot password?" without the env var resetting it on every boot);
 *   only the platform role is (re)asserted.
 */
export async function ensureAdmin(email: string, password: string): Promise<string> {
  let user = await auth.getUserByEmail(email).catch(() => null);
  let created = false;
  if (!user) {
    user = await auth.createUser({ email, password });
    created = true;
  }
  await db
    .collection("users")
    .doc(user.uid)
    .set({ email, role: "platform", chosen: true, tenantId: null, franchiseId: null });
  return created
    ? `created Platform (HQ) admin ${email}`
    : `Platform (HQ) admin ${email} already exists — role asserted, password untouched`;
}
