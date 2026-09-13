import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// HMAC signing for anything the server hands out as a URL that must not be
// forgeable or permanent: private image links (children's photos, injury
// photos, receipts) and email unsubscribe links.
//
// The key is URL_SIGNING_SECRET. Without it we derive one from the service
// account (stable across restarts, never sent anywhere), so dev and a staging
// box without the var still sign consistently. Set URL_SIGNING_SECRET in
// production so rotating it is a deliberate act.

function deriveSecret(): string {
  const explicit = process.env.URL_SIGNING_SECRET?.trim();
  if (explicit) return explicit;
  // Same places firebase.ts finds its credentials, in the same order.
  let material = process.env.FIREBASE_SERVICE_ACCOUNT ?? "";
  for (const file of [process.env.GOOGLE_APPLICATION_CREDENTIALS, path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../serviceAccountKey.json")]) {
    if (material || !file) continue;
    try { material = readFileSync(file, "utf8"); } catch { /* try the next */ }
  }
  if (!material) {
    // A key compiled into the source is a key anyone can read: never in
    // production. There, fall back to a random per-process key — links stop
    // working on restart, but nobody can forge one.
    if (process.env.NODE_ENV === "production") {
      console.error("[signing] URL_SIGNING_SECRET is not set — using a random key; signed links break on every restart. Set it.");
      return randomBytes(32).toString("hex");
    }
    console.warn("[signing] URL_SIGNING_SECRET is not set and no service account to derive from — using a dev-only key.");
    material = "activityos-dev-only-signing-key";
  }
  return createHash("sha256").update(`url-signing:${material}`).digest("hex");
}

const SECRET = deriveSecret();

export function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function verify(payload: string, sig: string | undefined | null): boolean {
  if (!sig) return false;
  const want = Buffer.from(sign(payload));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

// ── Private images ─────────────────────────────────────────────────────────

/** How long a signed image link works. Long enough for a screen to sit open
 *  through a session; short enough that a forwarded link dies. Lists re-sign
 *  on every load, so a fresh page always has a working link. */
export const IMAGE_LINK_TTL_S = 6 * 60 * 60;

const imgPayload = (id: string, exp: number) => `img:${id}:${exp}`;

/** Re-sign an /api/images/<id> URL (dropping any old signature). Anything that
 *  isn't one of ours comes back untouched. */
export function signImageUrl(url: unknown, ttlS = IMAGE_LINK_TTL_S): unknown {
  if (typeof url !== "string") return url;
  const m = url.match(/^(.*\/api\/images\/)([A-Za-z0-9_-]+)(?:\?.*)?$/);
  if (!m) return url;
  // Round expiry up to the hour so a page reloaded a few times reuses the same
  // URL — and the browser's cache with it.
  const exp = Math.ceil((Date.now() / 1000 + ttlS) / 3600) * 3600;
  return `${m[1]}${m[2]}?exp=${exp}&sig=${sign(imgPayload(m[2], exp))}`;
}

export function verifyImage(id: string, exp: unknown, sig: unknown): boolean {
  const e = Number(exp);
  if (!Number.isFinite(e) || e * 1000 < Date.now()) return false;
  return verify(imgPayload(id, e), typeof sig === "string" ? sig : null);
}

/** Strip any signature before storing: records keep the bare /api/images/<id>
 *  URL and are re-signed each time they're read. */
export function bareImageUrl<T>(url: T): T {
  if (typeof url !== "string") return url;
  return (/\/api\/images\/[A-Za-z0-9_-]+\?/.test(url) ? url.slice(0, url.indexOf("?")) : url) as T;
}
