import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// AES-256-GCM field-level encryption for sensitive personal data at rest —
// today just employee NI numbers (server/src/routes/payroll.ts). Mirrors
// lib/signing.ts's key derivation: FIELD_ENCRYPTION_SECRET wins; else the
// same service-account material signing.ts falls back to (stable across
// restarts, never sent anywhere, same search order/files); else a dev-only
// key so a laptop with no service account still runs.
//
// One deliberate difference from signing.ts: signing's production fallback
// is a random per-process key, which is fine because a signed URL is
// ephemeral (a broken link on restart is a papercut). A random key here
// would silently brick every stored NI number on the next restart — there is
// no "reissue a new link" for someone's National Insurance number — so
// production with neither an explicit secret nor service-account material
// fails loudly at startup instead.

function deriveKey(): Buffer {
  const explicit = process.env.FIELD_ENCRYPTION_SECRET?.trim();
  let material = explicit || process.env.FIREBASE_SERVICE_ACCOUNT || "";
  for (const file of [process.env.GOOGLE_APPLICATION_CREDENTIALS, path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../serviceAccountKey.json")]) {
    if (material || !file) continue;
    try { material = readFileSync(file, "utf8"); } catch { /* try the next */ }
  }
  if (!material) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[fieldCrypto] FIELD_ENCRYPTION_SECRET is not set and no service-account material to derive a key from — " +
        "refusing to encrypt sensitive fields under a key that would not survive a restart. Set FIELD_ENCRYPTION_SECRET.",
      );
    }
    console.warn("[fieldCrypto] FIELD_ENCRYPTION_SECRET is not set and no service account to derive from — using a dev-only key.");
    material = "activityos-dev-only-field-crypto-key";
  }
  return createHash("sha256").update(`field-crypto:${material}`).digest();
}

const KEY = deriveKey();
const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

/** Encrypt a plaintext string field for storage. Returns a single
 *  self-contained base64url string (iv ‖ authTag ‖ ciphertext) — store it
 *  as-is, e.g. in `niNumberEnc`. Never store the plaintext alongside it. */
export function encryptField(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

/** Decrypt a value produced by encryptField. Throws if the value is
 *  malformed or was encrypted under a different key (tampering, or the key
 *  rotated) — callers should treat a throw as "cannot be read", not as ""'. */
export function decryptField(stored: string): string {
  const buf = Buffer.from(stored, "base64url");
  if (buf.length <= IV_LEN + TAG_LEN) throw new Error("fieldCrypto: ciphertext too short");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
