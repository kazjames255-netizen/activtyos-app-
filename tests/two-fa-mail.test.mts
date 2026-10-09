// Pure tests: HQ sign-in code email rules (server/src/lib/twoFaMail.ts). No network, no Firestore.
import test from "node:test";
import assert from "node:assert/strict";
import { deliverTwoFaCode, parseFallbackEmails, TWO_FA_SUBJECT, twoFaHtml } from "../server/src/lib/twoFaMail.ts";
import type { MailOutcome } from "../server/src/lib/mailer.ts";

const P = "kazjames255@gmail.com";
const fake = (plan: Record<string, MailOutcome>) => {
  const calls: string[] = [];
  return { calls, send: async (to: string) => { calls.push(to); return plan[to] ?? { status: "sent" as const }; } };
};

test("subject is fixed and never carries the brand", () => {
  assert.equal(TWO_FA_SUBJECT, "Your sign-in code");
  assert.ok(!/Name TBC/.test(TWO_FA_SUBJECT));
  assert.match(twoFaHtml("123456", 10, "Acme"), /Acme platform sign-in code[\s\S]*123456/);
});

test("fallback list: default off, parsed, deduped, primary and junk dropped", () => {
  assert.deepEqual(parseFallbackEmails(undefined, P), []);
  assert.deepEqual(parseFallbackEmails("", P), []);
  assert.deepEqual(parseFallbackEmails(" A@x.com, b@y.org ;a@x.com, nope, KAZJAMES255@gmail.com", P), ["a@x.com", "b@y.org"]);
});

test("primary sent => delivered, fallbacks NOT mailed", async () => {
  const f = fake({});
  const r = await deliverTwoFaCode(f.send, P, ["b@y.org"], "s", "h");
  assert.equal(r.delivered, true);
  assert.equal(r.via, "primary");
  assert.deepEqual(f.calls, [P]);
});

test("primary failed, no fallbacks => not delivered, reason kept (default behaviour)", async () => {
  const f = fake({ [P]: { status: "failed", error: "resend 403: domain not verified" } });
  const r = await deliverTwoFaCode(f.send, P, [], "s", "h");
  assert.equal(r.delivered, false);
  assert.equal(r.via, null);
  assert.equal(r.primary, "failed");
  assert.match(r.errorKind!, /^resend 403/);
  assert.deepEqual(f.calls, [P]);
});

test("suppressed is NOT a delivery", async () => {
  const f = fake({ [P]: { status: "suppressed" } });
  const r = await deliverTwoFaCode(f.send, P, [], "s", "h");
  assert.equal(r.delivered, false);
  assert.equal(r.primary, "suppressed");
  assert.match(r.errorKind!, /MAIL_LIVE/);
});

test("primary failed + fallback set => fallback gets it; fallback failing too => not delivered", async () => {
  const ok = fake({ [P]: { status: "failed", error: "x" } });
  const r = await deliverTwoFaCode(ok.send, P, ["b@y.org", "c@y.org"], "s", "h");
  assert.equal(r.delivered, true);
  assert.equal(r.via, "fallback");
  assert.deepEqual(ok.calls, [P, "b@y.org", "c@y.org"]);
  const bad = fake({ [P]: { status: "failed", error: "x" }, "b@y.org": { status: "failed", error: "y" } });
  assert.equal((await deliverTwoFaCode(bad.send, P, ["b@y.org"], "s", "h")).delivered, false);
});
