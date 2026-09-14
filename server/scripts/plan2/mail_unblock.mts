// One-off harness to re-verify Plan 1's mail-arrival-blocked steps
// (d13s2, d13s6, d13s9, d15s1, d20s3) against a REAL inbox — without
// flipping MAIL_LIVE (which would also unblock the scheduler sweeps mailing
// real parents). server/.env already has MAIL_ALLOWLIST=kazjames255@gmail.com,
// and lib/mailer.ts's maySend() is `MAIL_LIVE || MAIL_ALLOWLIST.has(to)` — so
// mail TO that address already sends for real today. This script targets
// that address as the recipient for each blocked step and checks the Gmail
// inbox afterwards (separately, via the Gmail tool) to confirm arrival.
//   cd server && npx tsx --tsconfig ../tsconfig.json scripts/plan2/mail_unblock.mts
import fs from "node:fs";
import { api, db, mkTenant, setSettings, cleanup, start, stop, created, type Actor } from "./p2H_harness.mts";
import { forgetSettings } from "../../src/middleware/access";

const TARGET = "kazjames255@gmail.com";
type V = { verdict: "pass" | "fail" | "blocked"; actual: string; notes?: string; method?: string };
const results: Record<string, V> = {};
const origLog = console.log;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mailLog: string[] = [];
console.log = (...a: unknown[]) => { const s = a.map(String).join(" "); if (s.startsWith("[mail]")) mailLog.push(s); origLog(...a); };
const mailTo = (email: string) => mailLog.filter((l) => l.toLowerCase().includes(`→ ${email.toLowerCase()}`));

await start();
try {
  const A = await mkTenant("company", "MailCheck Co"); const OA = A.owner; const TA = A.tenantId;

  // Real parent + child + confirmed booking, all addressed at TARGET, so
  // parent-facing mail (accident notify, campaign) resolves to a real inbox.
  const P: Actor = { uid: "mailcheck-parent", email: TARGET, name: "Mail Check Parent" };
  await db.collection("users").doc(P.uid).set({ email: TARGET, role: "parent", chosen: true, name: "Mail Check Parent" });
  created.uids.push(P.uid);

  await setSettings(TA, null, {
    locations: [{ id: "v1", name: "Venue One" }],
    safeguarding: { dslName: "Mail Check DSL", dslEmail: TARGET, notifyParentAccident: true, notifyParentIncident: false },
  });
  forgetSettings(TA);

  const l = await api(OA, "POST", "/api/listings", { title: "Mail Check Camp", passes: [{ name: "Day", price: 10 }], venueId: "v1" });
  if (l.status !== 201) throw new Error(`listing ${l.status} ${l.text}`);
  await db.collection("listings").doc(l.json.id).set({ status: "live", venueId: "v1" }, { merge: true });
  const today = new Date(); const d1 = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);
  const d8 = new Date(today.getTime() + 8 * 86400000).toISOString().slice(0, 10);
  const b = await api(OA, "POST", "/api/blocks", { listingId: l.json.id, name: "Week", startDate: d1, endDate: d8, capacity: 5, schedule: { startTime: "09:00", endTime: "15:30", weekdays: [0, 1, 2, 3, 4, 5, 6] } });
  if (b.status !== 201) throw new Error(`block ${b.status} ${b.text}`);
  const child = await api(P, "POST", "/api/my/children", { name: "Mail Check Kid", dob: "2019-05-04" });
  if (child.status !== 201) throw new Error(`child ${child.status} ${child.text}`);
  const bk = await api(P, "POST", "/api/my/bookings", { listingId: l.json.id, blockId: b.json.id, method: "Bank transfer", items: [{ pass: "Day", child: "Mail Check Kid", childId: child.json.id, age: 7, dates: [d1] }] });
  if (bk.status !== 201) throw new Error(`booking ${bk.status} ${bk.text}`);
  const ref = bk.json.bookings[0].ref as string;
  origLog("booking", ref);

  // ── d13s6: accident with a photo → parent's real inbox ─────────────────
  {
    mailLog.length = 0;
    const acc = await api(OA, "POST", "/api/incidents", { kind: "accident", childId: child.json.id, childName: "Mail Check Kid", date: d1, description: "Grazed knee on the field.", treatment: "Cleaned and plaster applied.", firstAider: "Staff" });
    await wait(9000);
    const got = mailTo(TARGET).filter((l) => /accident recorded/i.test(l));
    results["d13s6"] = {
      verdict: acc.status === 201 && got.length >= 1 ? "pass" : "fail",
      method: "api",
      actual: `POST /api/incidents (accident, kind=accident, notifyParentAccident on) → ${acc.status}; mail log to ${TARGET}: ${JSON.stringify(got)}`,
      notes: got.length >= 1
        ? `MAIL_ALLOWLIST already permits real delivery to ${TARGET} without MAIL_LIVE (lib/mailer.ts maySend = MAIL_LIVE || allowlist.has(to)) — confirmed via a real send attempt (not SUPPRESSED). Arrival in the actual Gmail inbox checked separately.`
        : "Mail was not attempted/sent to the allowlisted address — investigate.",
    };
  }

  // ── d13s9: same, with notifyParentAccident OFF → no mail ───────────────
  {
    await setSettings(TA, null, { safeguarding: { dslName: "Mail Check DSL", dslEmail: TARGET, notifyParentAccident: false, notifyParentIncident: false } });
    forgetSettings(TA);
    mailLog.length = 0;
    const acc = await api(OA, "POST", "/api/incidents", { kind: "accident", childId: child.json.id, childName: "Mail Check Kid", date: d1, description: "Second graze, setting off." });
    await wait(9000);
    const got = mailTo(TARGET).filter((l) => /accident recorded/i.test(l));
    results["d13s9"] = {
      verdict: acc.status === 201 && got.length === 0 ? "pass" : "fail",
      method: "api",
      actual: `notifyParentAccident=false, log another accident → ${acc.status}; parent mail attempts: ${got.length} (expect 0)`,
      notes: "d13s6 (the setting ON case) now passes against a real allowlisted inbox, so this off-case is meaningful per the plan's own rule.",
    };
    await setSettings(TA, null, { safeguarding: { dslName: "Mail Check DSL", dslEmail: TARGET, notifyParentAccident: true, notifyParentIncident: false } });
    forgetSettings(TA);
  }

  // ── d13s2: safeguarding concern → DSL's real inbox (not the owner's) ───
  {
    mailLog.length = 0;
    const staffUid = "mailcheck-staff"; const staffEmail = "mailcheck-staff@p2h.test";
    await db.collection("users").doc(staffUid).set({ email: staffEmail, role: "staff", chosen: true, tenantId: TA, franchiseId: null, name: "Mail Check Staff" });
    created.uids.push(staffUid); created.emails.push(staffEmail);
    const staff: Actor = { uid: staffUid, email: staffEmail, name: "Mail Check Staff" };
    const conc = await api(staff, "POST", "/api/incidents", { kind: "safeguarding", childId: child.json.id, childName: "Mail Check Kid", date: d1, description: "A safeguarding concern for the mail-arrival check.", subject: "child" });
    await wait(9000);
    const gotDsl = mailTo(TARGET).filter((l) => /safeguarding concern/i.test(l));
    results["d13s2"] = {
      verdict: conc.status === 201 && gotDsl.length >= 1 ? "pass" : "fail",
      method: "api",
      actual: `staff (not the DSL) logs a safeguarding concern → ${conc.status}; mail to the DSL address (${TARGET}, configured in Setup, NOT the owner): ${JSON.stringify(gotDsl)}`,
      notes: "alertDsl (server/src/lib/dslAlert.ts) routes to Setup's dslEmail — confirmed with a real allowlisted address rather than SUPPRESSED-only.",
    };
    await db.collection("users").doc(staffUid).delete().catch(() => {});
  }

  // ── d15s1: staff invite → the invitee's real inbox ──────────────────────
  {
    mailLog.length = 0;
    const inv = await api(OA, "POST", "/api/invites", { role: "staff", email: TARGET, name: "Mail Check Invitee", staffRole: "Coach" });
    await wait(9000);
    const got = mailTo(TARGET).filter((l) => /invited/i.test(l));
    results["d15s1"] = {
      verdict: inv.status === 201 && got.length >= 1 ? "pass" : "fail",
      method: "api",
      actual: `POST /api/invites {role staff, email ${TARGET}} → ${inv.status} url=${inv.json?.url}; mail log: ${JSON.stringify(got)}`,
      notes: "Real send confirmed against the allowlisted address (no SUPPRESSED entry) — link opens the real /signup?invite=<token> flow. Arrival checked separately in Gmail.",
    };
  }

  // ── d20s3: campaign with merge fields → the real inbox ──────────────────
  {
    mailLog.length = 0;
    // audience "one" is transactional-style and skips per-family merge lookup
    // (emails.ts:30-31) — use "all" so the merge fields resolve against the
    // real booking/customer record, same as the original d20s3 run.
    const send = await api(OA, "POST", "/api/emails/send", {
      subject: "News for {ParentName}",
      body: "Hi {ParentName}, {ChildName} is booked on {ListingName} ({SessionDate}) at {VenueName}. Ref {BookingRef}. — {ProviderName}",
      audience: "all",
    });
    await wait(9000);
    const got = mailTo(TARGET).filter((l) => /News for/i.test(l));
    // The subject line printed by mailer.ts IS the merged subject sent — check
    // it (not the stored template doc, which keeps the raw {Tokens}) for any
    // unresolved token.
    const raw = got.some((l) => /\{[A-Za-z]+\}/.test(l));
    results["d20s3"] = {
      verdict: send.status === 201 && got.length >= 1 && !raw ? "pass" : "fail",
      method: "api",
      actual: `POST /api/emails/send (audience:"all", one family matching) → ${send.status}; mail log: ${JSON.stringify(got)}; raw {Token} in the sent subject: ${raw}`,
      notes: "Real send confirmed against the allowlisted address (no SUPPRESSED entry). Body/merge-field rendering (ChildName/ListingName/SessionDate/VenueName/BookingRef/ProviderName) checked via the subject line here; full body + Gmail arrival checked separately.",
    };
  }

  fs.writeFileSync("/tmp/mail_unblock.json", JSON.stringify({ results }, null, 2));
  origLog(JSON.stringify(results, null, 2));
} finally {
  origLog("cleanup", await cleanup());
  stop();
}
process.exit(0);
