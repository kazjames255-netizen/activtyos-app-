// Moments + Newsfeed API isolation scenario (QA, 8 Oct). Run:
//   NEXT_PUBLIC_API_URL=http://localhost:4012 server/node_modules/.bin/tsx e2e/review/mn-api.mts
// Throwaway @activityos-test.com accounts only. Writes e2e/review/.mn-fixture.json for the screenshot pass.
import fs from "node:fs";
import { loadAccounts } from "../helpers/env";
import { apiFetch, apiPost, fbSignIn, fbSignUp, TEST_EMAIL_DOMAIN } from "../helpers/accounts";
import { bookViaApi, createParentChild, provisionLiveListing } from "../helpers/tenantData";

const stamp = Date.now().toString(36);
let fails = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; };
const rejects = async (p: Promise<unknown>, re: RegExp, m: string) => { try { await p; ok(false, `${m} (was allowed)`); } catch (e) { ok(re.test((e as Error).message), `${m} -> ${(e as Error).message.slice(0, 90)}`); } };
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const { accounts } = loadAccounts();
const F = accounts.freelancer, C = accounts.company, S = accounts.staff, P1 = accounts.parent;
const f = await fbSignIn(F.email), c = await fbSignIn(C.email), s = await fbSignIn(S.email), p1 = await fbSignIn(P1.email);
const mkParent = async (tag: string) => {
  const email = `e2e-mn-${tag}-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const x = await fbSignUp(email);
  await apiPost("/api/register-role", x.idToken, { role: "parent", postcode: "NN5 7EA" });
  return { acct: { role: "parent" as const, email, uid: x.uid, tenantId: null, tenantName: null }, tok: x.idToken };
};
const P2 = await mkParent("p2"), P3 = await mkParent("p3");
const LA = await provisionLiveListing(F, { title: `MN Camp A ${stamp}`, price: 0, startToday: true });
const LA2 = await provisionLiveListing(F, { title: `MN Camp A2 ${stamp}`, price: 0, startToday: true });
const LB = await provisionLiveListing(C, { title: `MN Camp B ${stamp}`, price: 0, startToday: true });
const k1 = await createParentChild(P1, { name: `Kia ${stamp}`, photoConsent: true });
const k2 = await createParentChild(P1, { name: `Noconsent ${stamp}`, photoConsent: false });
const k3 = await createParentChild(P2.acct, { name: `Theo ${stamp}`, photoConsent: true });
const k4 = await createParentChild(P3.acct, { name: `Zed ${stamp}`, photoConsent: true });
await bookViaApi(P1, LA, { child: `Kia ${stamp}` });
await bookViaApi(P1, LA, { child: `Noconsent ${stamp}` });
await bookViaApi(P2.acct, LA, { child: `Theo ${stamp}` });
await bookViaApi(P3.acct, LB, { child: `Zed ${stamp}` });
// P2 is also booked on A2? no: only P1 on A2 so a "chosen families" post to A2 reaches P1 only.
await createParentChild(P1, { name: `Kia2 ${stamp}`, photoConsent: true }).then((id) => { void id; });
await bookViaApi(P1, LA2, { child: `Kia2 ${stamp}` });

// ── photo upload
const up = await apiPost<{ url: string }>("/api/uploads", f.idToken, { dataUrl: PNG, purpose: "private" });
ok(!!up.url, "operator can upload a private photo");
const stUp = await apiPost<{ url: string }>("/api/uploads", s.idToken, { dataUrl: PNG, purpose: "private" });
ok(!!stUp.url, "staff can upload a private photo");
await rejects(apiPost("/api/uploads", s.idToken, { dataUrl: PNG, purpose: "public" }), /operator/i, "staff cannot upload a PUBLIC image");
await rejects(apiPost("/api/uploads", p1.idToken, { dataUrl: PNG, purpose: "private" }), /operator/i, "parent cannot upload");
await rejects(apiPost("/api/uploads", f.idToken, { dataUrl: "data:image/png;base64," + Buffer.from("<svg onload=alert(1)>").toString("base64"), purpose: "private" }), /./, "fake PNG (svg bytes) rejected");

// ── moments: posting + consent
await rejects(apiPost("/api/moments", f.idToken, { photoUrl: up.url, childIds: [k2], photoType: "child" }), /consent/i, "child photo tagging a no-consent child blocked");
const mWork = await apiPost<{ id: string }>("/api/moments", f.idToken, { photoUrl: up.url, childIds: [k2], photoType: "work", caption: "Noconsent's painting" });
ok(!!mWork.id, "work photo of a no-consent child allowed");
await rejects(apiPost("/api/moments", f.idToken, { photoUrl: up.url, childIds: [k4], photoType: "work" }), /booked with you/i, "freelancer cannot tag another provider's child (Zed)");
const mOne = await apiPost<{ id: string }>("/api/moments", f.idToken, { photoUrl: up.url, childIds: [k1], caption: "Kia only", activity: "Swimming" });
const mGroup = await apiPost<{ id: string }>("/api/moments", f.idToken, { photoUrl: up.url, childIds: [k1, k3], caption: "Group shot", activity: "Arts & crafts" });
await rejects(apiPost("/api/moments", p1.idToken, { photoUrl: up.url, childIds: [k1] }), /operator|staff/i, "parent cannot post a moment");
await rejects(apiPost("/api/moments", f.idToken, { childIds: [] }), /./, "empty moment rejected");
await rejects(apiPost("/api/moments", f.idToken, { caption: "x", date: "2026-13-45" }), /./, "bad date rejected");
// staff of company C posting about F's child
await rejects(apiPost("/api/moments", s.idToken, { photoUrl: stUp.url, childIds: [k1] }), /booked with you/i, "company staff cannot tag a child of another tenant");
const mB = await apiPost<{ id: string }>("/api/moments", s.idToken, { photoUrl: stUp.url, childIds: [k4], caption: "Zed at B" });

// ── moments: who sees what
const list = async (tok: string) => apiFetch<any[]>("/api/moments", tok);
const l1 = await list(p1.idToken), l2 = await list(P2.tok), l3 = await list(P3.tok);
ok(l1.some((m) => m.id === mOne.id) && l1.some((m) => m.id === mGroup.id) && l1.some((m) => m.id === mWork.id), "P1 sees their own 3 moments");
ok(!l1.some((m) => m.id === mB.id), "P1 does not see tenant B's moment of Zed");
ok(l2.length === 1 && l2[0].id === mGroup.id, "P2 sees only the group shot");
ok(l3.length === 1 && l3[0].id === mB.id, "P3 sees only Zed's moment");
const g2 = l2[0], g1 = l1.find((m) => m.id === mGroup.id);
ok(JSON.stringify(g2).indexOf("Kia") < 0, "P2's copy of the group shot does not leak Kia's name/id");
ok(JSON.stringify(g1).indexOf("Theo") < 0, "P1's copy of the group shot does not leak Theo's name/id");
ok(!JSON.stringify(l1).includes("@"), "parent payload has no email address (postedBy stripped)");
// comments
await apiPost(`/api/moments/${mGroup.id}/comment`, p1.idToken, { text: "P1 says hi" });
await apiPost(`/api/moments/${mGroup.id}/comment`, f.idToken, { text: "Team reply" });
await rejects(apiPost(`/api/moments/${mGroup.id}/comment`, P3.tok, { text: "intruder" }), /can't comment/i, "P3 cannot comment on a moment of someone else's child");
await rejects(apiPost(`/api/moments/${mGroup.id}/comment`, s.idToken, { text: "other-tenant staff" }), /can't comment/i, "other tenant's staff cannot comment");
const g2b = (await list(P2.tok))[0];
ok(!JSON.stringify(g2b.comments).includes("P1 says hi") && JSON.stringify(g2b.comments).includes("Team reply"), "P2 sees the team's comment but not P1's reply");
const cr = await apiPost<any>(`/api/moments/${mGroup.id}/comment`, p1.idToken, { text: "again" });
ok(!JSON.stringify(cr).includes("@"), "comment response to a parent has no email");
// isolation edit/delete
await rejects(apiFetch(`/api/moments/${mOne.id}`, s.idToken, { method: "PUT", body: JSON.stringify({ caption: "hijack" }) }), /not found/i, "other tenant's staff cannot edit");
await rejects(apiFetch(`/api/moments/${mOne.id}`, c.idToken, { method: "DELETE" }), /not found/i, "other tenant's company cannot delete");
await rejects(apiFetch(`/api/moments/${mOne.id}`, p1.idToken, { method: "DELETE" }), /./, "parent cannot delete");
const opList = await apiFetch<any[]>("/api/moments", f.idToken);
ok(opList.length >= 3 && !opList.some((m) => m.id === mB.id), "operator list scoped to own tenant");
const tg = await apiFetch<any[]>("/api/moments/taggable", f.idToken);
ok(tg.some((t) => t.childId === k2 && t.photoConsent === false) && !tg.some((t) => t.childId === k4), "taggable list: has no-consent flag, excludes other tenant's child");
// consent withdrawn afterwards
await apiFetch(`/api/my/children/${k1}`, p1.idToken, { method: "PUT", body: JSON.stringify({ name: `Kia ${stamp}`, dob: "2018-05-14", photoConsent: false }) }).catch((e) => console.log("child PUT:", (e as Error).message));
const after = await list(p1.idToken);
ok(!after.some((m) => m.id === mOne.id), "after consent withdrawn, Kia's photo moment is hidden from P1");
ok((await apiFetch<any[]>("/api/moments", f.idToken)).find((m) => m.id === mOne.id)?.consentWithdrawn === true, "operator sees it flagged consentWithdrawn");
await apiFetch(`/api/my/children/${k1}`, p1.idToken, { method: "PUT", body: JSON.stringify({ name: `Kia ${stamp}`, dob: "2018-05-14", photoConsent: true }) }).catch(() => {});

// ── newsfeed
const mk = (tok: string, body: any) => apiPost<any>("/api/posts", tok, body);
const pAll = await mk(f.idToken, { title: "All families", body: "Hello all", audience: "all" });
const pA2 = await mk(f.idToken, { title: "Only A2", body: "Chosen families", audience: "listing", audIds: [LA2.id], audLabel: "Listings: A2" });
const pDraft = await mk(f.idToken, { title: "Draft", body: "draft body", status: "draft" });
const pEvent = await mk(f.idToken, { tpl: "event", title: "Event", body: "come", capacity: 1, date: "2026-12-01" });
const pUrgent = await mk(f.idToken, { tpl: "urgent", title: "Urgent", body: "ack me", ackRequired: true, pinned: true, priority: "urgent" });
const now = new Date(Date.now() - 3600_000);
const ukLocal = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/London", dateStyle: "short", timeStyle: "short" }).format(now).replace(" ", "T");
const pSched = await mk(f.idToken, { title: "Scheduled past", body: "should go live", status: "scheduled", publishAt: ukLocal });
const pFuture = await mk(f.idToken, { title: "Scheduled future", body: "not yet", status: "scheduled", publishAt: "2099-01-01T09:00" });
const pB = await mk(s.idToken, { title: "From B staff", body: "tenant B" });
await rejects(apiPost("/api/posts", p1.idToken, { body: "parent post" }), /operator|staff/i, "parent cannot post to the newsfeed");
await rejects(apiPost("/api/posts", f.idToken, { body: "x", cta: { label: "go", url: "javascript:alert(1)" } }), /./, "javascript: link rejected");
await rejects(apiPost("/api/posts", f.idToken, { body: "" }), /./, "empty body rejected");
const t = (arr: any[], id: string) => arr.some((p) => p.id === id);
const n1 = await apiFetch<any[]>("/api/posts", p1.idToken), n2 = await apiFetch<any[]>("/api/posts", P2.tok), n3 = await apiFetch<any[]>("/api/posts", P3.tok);
ok(t(n1, pAll.id) && t(n2, pAll.id), "P1/P2 see the all-families post");
ok(t(n1, pA2.id) && !t(n2, pA2.id), "'Chosen families' post (A2) reaches P1 (booked A2) but not P2");
ok(!t(n1, pDraft.id) && !t(n1, pSched.id) && !t(n1, pFuture.id), "drafts / scheduled hidden from families");
ok(!t(n3, pAll.id) && t(n3, pB.id) && !t(n1, pB.id), "P3 sees only tenant B's post; P1 does not see B's");
ok(!JSON.stringify(n1).includes("reactedBy") && !JSON.stringify(n1).includes(P2.acct.uid) && !JSON.stringify(n1).includes("@"), "no uid maps / emails in parent feed");
ok(n1[0].id === pUrgent.id, "pinned urgent post sorts first");
await rejects(apiPost(`/api/posts/${pAll.id}/react`, P3.tok, { on: true }), /can't see/i, "P3 cannot react to tenant A's post");
await rejects(apiPost(`/api/posts/${pA2.id}/react`, P2.tok, { on: true }), /can't see/i, "P2 cannot react to a post aimed at other families");
await apiPost(`/api/posts/${pAll.id}/react`, p1.idToken, { on: true }); await apiPost(`/api/posts/${pAll.id}/react`, p1.idToken, { on: true });
const r1 = (await apiFetch<any[]>("/api/posts", p1.idToken)).find((p) => p.id === pAll.id);
ok(r1.reactions === 1 && r1.mine.reacted === true, "react is idempotent and 'mine' comes back from the server");
await apiPost(`/api/posts/${pEvent.id}/rsvp`, p1.idToken, { choice: "yes" });
await rejects(apiPost(`/api/posts/${pEvent.id}/rsvp`, P2.tok, { choice: "yes" }), /full/i, "event capacity enforced");
await apiPost(`/api/posts/${pEvent.id}/rsvp`, P2.tok, { choice: "maybe" });
await apiPost(`/api/posts/${pUrgent.id}/ack`, p1.idToken, { });
ok((await apiFetch<any[]>("/api/posts", p1.idToken)).find((p) => p.id === pUrgent.id).mine.acked === true, "ack remembered server-side");
await rejects(apiFetch(`/api/posts/${pAll.id}`, s.idToken, { method: "PUT", body: JSON.stringify({ title: "hijack" }) }), /./, "other tenant's staff cannot edit a post");
await rejects(apiFetch(`/api/posts/${pAll.id}`, p1.idToken, { method: "DELETE" }), /./, "parent cannot delete a post");
const fOps = await apiFetch<any[]>("/api/posts", f.idToken);
ok(fOps.length >= 7 && !t(fOps, pB.id), "operator feed scoped to own tenant, includes drafts/scheduled");
console.log("waiting 70s for the scheduled-post sweep...");
await new Promise((r) => setTimeout(r, 70_000));
const n1b = await apiFetch<any[]>("/api/posts", p1.idToken);
ok(t(n1b, pSched.id) && !t(n1b, pFuture.id), "past-due scheduled post went live; future one did not");

fs.writeFileSync(new URL("./.mn-fixture.json", import.meta.url), JSON.stringify({ stamp, P2: P2.acct, P3: P3.acct, LA, LA2, LB }, null, 2));
console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
