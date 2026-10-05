import { Router } from "express";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "../firebase";
import { sendMail } from "../lib/mailer";
import { BRAND } from "../lib/brand";

// Mandatory email 2FA for the platform (super-admin/HQ) portal — a small,
// manually-provisioned set of accounts. Mounted with `requireAuth` ONLY (no
// `attachRole`): these two endpoints must work for a platform account that
// hasn't verified yet, which is exactly the account attachRole would
// otherwise refuse (see middleware/role.ts). Each route re-checks the role
// itself from Firestore, since req.auth isn't set at this point in the chain.
//
// The one-time code lives on the user's own `users/{uid}` doc (there's no
// existing short-lived-token collection in this codebase to mirror — signed
// links (lib/signing.ts) are stateless HMACs, not a fit for a guessable
// 6-digit code that needs server-side attempt limiting). Fields:
//   twoFaCodeHash / twoFaCodeSalt — sha256(salt + code), never the raw code.
//   twoFaCodeExpiresAt           — epoch ms; the code is void after this.
//   twoFaAttempts                — wrong guesses against the CURRENT code.
//   twoFaLastSentAt              — epoch ms; throttles resends.
//   twoFaVerifiedAt              — epoch ms of the last successful verify;
//                                  read by middleware/role.ts's attachRole,
//                                  which requires it be within TWO_FA_TTL_MS.
export const twoFa = Router();

const CODE_TTL_MS = 10 * 60_000; // 10 minutes to enter the code
const RESEND_COOLDOWN_MS = 30_000; // don't spam the inbox
const MAX_ATTEMPTS = 5;

// Fixed recipient: platform accounts are a small, manually-provisioned set —
// per the product owner, every code goes to this one admin inbox, not to
// whatever address happens to be on the signing-in account.
const TWO_FA_RECIPIENT = "kazjames255@gmail.com";

function hashCode(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

async function loadPlatformUser(uid: string) {
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists || snap.get("role") !== "platform") return null;
  return { ref, data: snap.data()! };
}

twoFa.post("/send", async (req, res) => {
  const uid = req.user!.uid;
  const found = await loadPlatformUser(uid);
  if (!found) { res.status(403).json({ error: "Two-factor codes are only issued to platform accounts.", code: "not_platform" }); return; }
  const { ref } = found;

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const salt = randomBytes(16).toString("hex");
  // Cooldown check + write in ONE transaction: parallel /send calls can't all pass the check and each mail a fresh code.
  const wait = await db.runTransaction(async (tx) => {
    const cur = (await tx.get(ref)).data() ?? {};
    const lastSentAt = Number(cur.twoFaLastSentAt) || 0;
    const now = Date.now();
    if (lastSentAt && now - lastSentAt < RESEND_COOLDOWN_MS) return RESEND_COOLDOWN_MS - (now - lastSentAt);
    tx.set(ref, { twoFaCodeHash: hashCode(code, salt), twoFaCodeSalt: salt, twoFaCodeExpiresAt: now + CODE_TTL_MS, twoFaAttempts: 0, twoFaLastSentAt: now }, { merge: true });
    return 0;
  });
  if (wait) {
    res.status(429).json({ error: `Please wait ${Math.ceil(wait / 1000)}s before requesting another code.`, code: "2fa_resend_throttled", retryAfterMs: wait });
    return;
  }

  const html = `
    <p>Your ${BRAND} platform sign-in code is:</p>
    <p style="font-size:28px;font-weight:800;letter-spacing:4px;">${code}</p>
    <p>This code expires in ${Math.round(CODE_TTL_MS / 60_000)} minutes. If you didn't request this, you can ignore this email.</p>
  `;
  const delivered = await sendMail(TWO_FA_RECIPIENT, `Your ${BRAND} platform sign-in code`, html);
  res.json({ sent: true, delivered, expiresInMs: CODE_TTL_MS });
});

const verifySchema = z.object({ code: z.string().trim().min(4).max(10) });

twoFa.post("/verify", async (req, res) => {
  const uid = req.user!.uid;
  const found = await loadPlatformUser(uid);
  if (!found) { res.status(403).json({ error: "Two-factor codes are only issued to platform accounts.", code: "not_platform" }); return; }
  const { ref } = found;

  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Enter the 6-digit code." }); return; }

  // Read, count the guess and (on a match) consume the code in ONE transaction: parallel guesses each see the previous
  // count, so the 5-attempt limit holds. The attempt is counted BEFORE the compare result is acted on.
  type Out = "locked" | "invalid" | "wrong" | "ok";
  const out: Out = await db.runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data() ?? {};
    const expiresAt = Number(data.twoFaCodeExpiresAt) || 0;
    const attempts = Number(data.twoFaAttempts) || 0;
    const hash = typeof data.twoFaCodeHash === "string" ? data.twoFaCodeHash : null;
    const salt = typeof data.twoFaCodeSalt === "string" ? data.twoFaCodeSalt : null;
    if (attempts >= MAX_ATTEMPTS) return "locked";
    if (!hash || !salt || !expiresAt || Date.now() > expiresAt) return "invalid";
    if (!safeEqual(hashCode(parsed.data.code, salt), hash)) { tx.set(ref, { twoFaAttempts: attempts + 1 }, { merge: true }); return "wrong"; }
    tx.set(ref, { twoFaVerifiedAt: Date.now(), twoFaCodeHash: null, twoFaCodeSalt: null, twoFaCodeExpiresAt: null, twoFaAttempts: 0 }, { merge: true });
    return "ok";
  });
  if (out === "locked") { res.status(429).json({ error: "Too many attempts — request a new code.", code: "2fa_locked" }); return; }
  if (out === "invalid") { res.status(400).json({ error: "Code is wrong or has expired.", code: "2fa_invalid" }); return; }
  if (out === "wrong") { res.status(401).json({ error: "Code is wrong or has expired.", code: "2fa_invalid" }); return; }
  res.json({ verified: true });
});
