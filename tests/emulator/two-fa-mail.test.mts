// Behaviour test (npm run test:emu): POST /api/auth/2fa/send tells the truth when the code could not be emailed.
// The emulator API runs with MAIL_LIVE=0, so the fixed HQ inbox is "suppressed" = nothing delivered = a failed send.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { call, db, login, uniq } from "./helpers.mts";

describe("HQ 2FA send when mail cannot go out", () => {
  it("returns 502 2fa_mail_failed, does not burn the cooldown, voids the unsent code, counts the failure", async () => {
    const s = await login(`hq-${uniq()}@emu.test`);
    await db.collection("users").doc(s.uid).set({ role: "platform", email: "hq@emu.test" }, { merge: true });
    const a = await call("POST", "/api/auth/2fa/send", s.token, {});
    assert.equal(a.status, 502, JSON.stringify(a.json));
    assert.equal(a.json.code, "2fa_mail_failed");
    assert.match(a.json.error, /could not email the code/i);
    // The send DID run and reached the mailer: one mailLog row to the fixed HQ inbox, fixed subject, status suppressed (MAIL_LIVE=0 here).
    await new Promise((r) => setTimeout(r, 500));
    const rows = (await db.collection("mailLog").where("to", "==", "kazjames255@gmail.com").get()).docs.map((x) => x.data());
    assert.ok(rows.some((m) => m.subject === "Your sign-in code" && m.status === "suppressed"), JSON.stringify(rows.map((m) => [m.subject, m.status])));
    const b = await call("POST", "/api/auth/2fa/send", s.token, {}); // immediately again: NOT 429
    assert.equal(b.status, 502, JSON.stringify(b.json));
    const d = (await db.collection("users").doc(s.uid).get()).data()!;
    assert.equal(d.twoFaCodeHash, null);
    assert.equal(d.twoFaLastSentAt, 0);
    assert.equal(d.twoFaMailFailures, 2);
    assert.ok(!JSON.stringify(d.twoFaLastMailFailure).includes("@"), "no addresses/secrets in the failure note");
  });

  it("a non-platform account is still refused", async () => {
    const s = await login(`np-${uniq()}@emu.test`);
    assert.equal((await call("POST", "/api/auth/2fa/send", s.token, {})).status, 403);
  });
});
