// Online sessions end-to-end test (local stack, throwaway accounts). Run: server/node_modules/.bin/tsx e2e/review/online-test.ts
import fs from "node:fs";
import path from "node:path";
import { fbSignUp, fbSignIn, apiPost, apiFetch, TEST_PASSWORD, TEST_EMAIL_DOMAIN } from "../helpers/accounts";
import { ROOT, WEB_URL, API_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require("/Users/kazjames/Downloads/activtyos-app-/server/node_modules/firebase-admin");

const OUT = path.join(ROOT, "e2e/review/shots/online");
admin.initializeApp({ credential: admin.credential.cert(require("/Users/kazjames/Downloads/activtyos-app-/server/serviceAccountKey.json")) });
const fs_ = admin.firestore();
const stamp = Date.now().toString(36);
const em = (n: string) => `e2e-os-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`;
const results: { id: string; ok: boolean; note: string }[] = [];
const T = (id: string, ok: boolean, note = "") => { results.push({ id, ok, note }); console.log(`${ok ? "PASS" : "FAIL"} ${id} ${note}`); };
let shotN = 0;
const shot = async (page: any, name: string) => { await page.waitForTimeout(900); const f = `${String(++shotN).padStart(2, "0")}-${name}.png`; await page.screenshot({ path: path.join(OUT, f) }); return f; };

const call = async (tok: string, method: string, url: string, body?: unknown) => {
  const r = await fetch(`${API_URL}${url}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  let json: any = null; try { json = await r.json(); } catch { /* empty */ }
  return { status: r.status, json };
};
const ukParts = (d: Date) => Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((p) => [p.type, p.value]));
const hhmm = (d: Date) => { const p = ukParts(d); return `${p.hour}:${p.minute}`; };
const ymd = (d: Date) => { const p = ukParts(d); return `${p.year}-${p.month}-${p.day}`; };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // ── accounts ──
  const prov = await fbSignUp(em("prov"));
  const reg = await apiPost<{ tenantId: string }>("/api/register-role", prov.idToken, { role: "freelancer", businessName: "Online Test Tutors", providerName: "Online Test Tutors", providerNameMode: "business", ownerName: "Sam Tutor" });
  const tid = reg.tenantId;
  await fs_.collection("tenants").doc(tid).set({ subscription: { status: "trialing", plan: "freelancer" } }, { merge: true });
  const lib0 = ((await apiFetch<any>("/api/library", prov.idToken)) ?? {}) as any;
  await apiFetch("/api/library", prov.idToken, { method: "PUT", body: JSON.stringify({ venues: [{ id: "online-v", name: "Online", address: "", kind: "online", directions: "Have a pen and paper ready" }], settings: { ...(lib0.settings ?? {}), billing: { ...(lib0.settings?.billing ?? {}), sortCode: "20-57-44", accountNumber: "63437582", bankName: "Test" }, features: { ...(lib0.settings?.features ?? {}), learninghub: true } } }) });
  const parents: Record<string, { tok: string; uid: string; email: string }> = {};
  for (const n of ["a", "b", "d"]) { const s = await fbSignUp(em(n)); await apiPost("/api/register-role", s.idToken, { role: "parent", firstName: n.toUpperCase() + "ndy", lastName: "Parent" }); parents[n] = { tok: s.idToken, uid: s.uid, email: em(n) }; }
  T("setup", true, `tenant ${tid}`);

  // ── a period that starts in 5 minutes (UK time), a pass, a bundle, and two online listings ──
  const now = new Date();
  const start = new Date(now.getTime() + 5 * 60_000);
  const end = new Date(start.getTime() + 60 * 60_000);
  const per = await apiPost<{ id: string }>("/api/periods", prov.idToken, { title: "Session", start: hhmm(start), finish: hhmm(end) });
  const pass = await apiPost<{ id: string }>("/api/passes", prov.idToken, { name: "Single session", days: 1 });
  const bundle = await apiPost<{ id: string }>("/api/block-bundles", prov.idToken, { name: "Online block", periodIds: [per.id], passIds: [pass.id], priced: true, masterPrice: 10, calcOn: true });
  const today = ymd(now), tomorrow = ymd(new Date(now.getTime() + 24 * 3600_000)), runTo = ymd(new Date(now.getTime() + 14 * 24 * 3600_000));
  const mk = (title: string, extra: Record<string, unknown>) => apiPost<{ id: string }>("/api/listings", prov.idToken, { title, venueId: "online-v", runFrom: today, runTo, blockMode: "custom", days: [0, 1, 2, 3, 4, 5, 6], maxAttendees: "16", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id, passes: [{ name: "Single session", price: 10, days: 1 }], bookingType: "auto", status: "live", visibility: "public", deliveryMode: "venue", ...extra });
  let L1: { id: string }, L2: { id: string };
  try {
    L1 = await mk("Online Maths with Sam", { videoMode: "platform", maxJoiners: "" });
    L2 = await mk("Own-link Fitness Class", { videoMode: "own", ownLink: "https://example.org/room-secret-abc", showLinkNow: false });
    T("listings", true, `${L1.id} ${L2.id}`);
  } catch (e) { T("listings", false, (e as Error).message.slice(0, 200)); process.exit(1); }

  // ── seed bookings straight into Firestore (a real card payment needs a connected Stripe account, which the local stack does not have) ──
  const mkBooking = async (ref: string, email: string, listingId: string, listingName: string, status: string, pay: string, kid: { name: string; childId: string }, days: string[]) => {
    await fs_.collection("bookings").doc(ref).set({ ref, bid: ref, tenantId: tid, listingId, blockId: `blk-${listingId}`, seats: 1, days, timing: "Session", booker: "Test Parent", email: email.toLowerCase(), phone: "07000000000", child: kid.name, childId: kid.childId, kids: [{ name: kid.name, childId: kid.childId, dates: days }], listing: listingName, pass: "Single session", ticket: "Single session", dates: days.join(", "), sessions: days, status, pay, method: "Card", amount: 10, addons: [], answers: [], note: "", recon: null, evid: null, cancel: null, createdAt: new Date().toISOString() });
  };
  await mkBooking(`OS-A1-${stamp}`, parents.a.email, L1.id, "Online Maths with Sam", "Confirmed", "Paid", { name: "Ava Parent", childId: "c-ava" }, [today, tomorrow]);
  await mkBooking(`OS-A2-${stamp}`, parents.a.email, L2.id, "Own-link Fitness Class", "Confirmed", "Paid", { name: "Ava Parent", childId: "c-ava" }, [today, tomorrow]);
  await mkBooking(`OS-B1-${stamp}`, parents.b.email, L1.id, "Online Maths with Sam", "Cancelled", "Refunded", { name: "Ben Parent", childId: "c-ben" }, [today]);
  await fs_.collection("hubEnrolments").doc(`${tid}__c-ava`).set({ tenantId: tid, franchiseId: null, childId: "c-ava", childName: "Ava Parent", parentUid: parents.a.uid, parentEmail: parents.a.email, subjects: [], tutorUid: null, tutorName: "", active: true, createdAt: new Date().toISOString() });
  T("seeded bookings", true);

  const A = parents.a.tok, B = parents.b.tok, D = parents.d.tok, P = prov.idToken;
  const sess = (l: string, d: string) => ({ listingId: l, date: d });

  // ── parent list + disabled states ──
  const mine = await call(A, "GET", "/api/online-sessions/mine");
  const m1t = (mine.json as any[]).find((x) => x.listingId === L1.id && x.date === today);
  const m1n = (mine.json as any[]).find((x) => x.listingId === L1.id && x.date === tomorrow);
  const m2t = (mine.json as any[]).find((x) => x.listingId === L2.id && x.date === today);
  const m2n = (mine.json as any[]).find((x) => x.listingId === L2.id && x.date === tomorrow);
  T("mine lists today (open) and tomorrow (early)", mine.status === 200 && m1t?.state === "open" && m1n?.state === "early", JSON.stringify({ today: m1t?.state, tomorrow: m1n?.state }));
  T("host not started -> hostLive false", m1t?.hostLive === false);
  T("own link: shown in the window", m2t?.link === "https://example.org/room-secret-abc");
  T("own link: NOT shown before the window", m2n && !m2n.link, JSON.stringify(m2n?.link));
  const early = await call(A, "POST", "/api/online-sessions/join", sess(L1.id, tomorrow));
  T("join tomorrow refused (early)", early.status === 409 && early.json?.code === "early", `${early.status} ${early.json?.code}`);
  const wait = await call(A, "POST", "/api/online-sessions/join", sess(L1.id, today));
  T("join before host starts refused (waiting_for_host)", wait.status === 409 && wait.json?.code === "waiting_for_host", `${wait.status} ${wait.json?.code}`);
  const ownEarly = await call(A, "POST", "/api/online-sessions/join", sess(L2.id, tomorrow));
  T("own link join tomorrow refused", ownEarly.status === 409 && !JSON.stringify(ownEarly.json).includes("room-secret"), `${ownEarly.status}`);
  const ownNow = await call(A, "POST", "/api/online-sessions/join", sess(L2.id, today));
  T("own link join inside window returns the link", ownNow.status === 200 && ownNow.json?.link === "https://example.org/room-secret-abc");
  const dJoin = await call(D, "POST", "/api/online-sessions/join", sess(L1.id, today));
  T("a parent with no booking cannot join", dJoin.status === 404, String(dJoin.status));
  const bJoin = await call(B, "POST", "/api/online-sessions/join", sess(L1.id, today));
  T("a cancelled booking cannot join", bJoin.status === 404, String(bJoin.status));
  const dOwn = await call(D, "POST", "/api/online-sessions/join", sess(L2.id, today));
  T("no booking cannot get the own link", dOwn.status === 404 && !JSON.stringify(dOwn.json).includes("room-secret"));

  // ── privacy: the own link never appears in public listing responses ──
  const pubList = await fetch(`${API_URL}/api/listings`).then((r) => r.text()).catch(() => "");
  const pubOne = await fetch(`${API_URL}/api/listings/${L2.id}`).then((r) => r.text()).catch(() => "");
  const asParent = JSON.stringify((await call(A, "GET", `/api/listings/${L2.id}`)).json);
  const asOwner = JSON.stringify((await call(P, "GET", `/api/listings/${L2.id}`)).json);
  T("ownLink hidden from anonymous list/detail and from parents", !pubList.includes("room-secret") && !pubOne.includes("room-secret") && !asParent.includes("room-secret"));
  T("ownLink visible to the owning provider", asOwner.includes("room-secret"));
  T("no address anywhere on the online listing", !/"address":"[^"]+"/.test(asParent), "");

  // ── host starts: our own video room (real Daily room) ──
  const hostJoin = await call(P, "POST", "/api/online-sessions/join", sess(L1.id, today));
  const hostOk = hostJoin.status === 200 && hostJoin.json?.mode === "platform" && !!hostJoin.json?.token && hostJoin.json?.isOwner === true;
  T("host starts the session and gets a room + owner token", hostOk, hostOk ? `room ${hostJoin.json.roomName}` : `${hostJoin.status} ${JSON.stringify(hostJoin.json).slice(0, 200)}`);
  if (hostOk) {
    const famJoin = await call(A, "POST", "/api/online-sessions/join", sess(L1.id, today));
    T("family joins once the host is in (not an owner, first name only)", famJoin.status === 200 && famJoin.json?.isOwner === false && famJoin.json?.userName === "Ava", `${famJoin.status} ${famJoin.json?.userName}`);
    T("same room for host and family", famJoin.json?.roomName === hostJoin.json.roomName);
    const dJoin2 = await call(D, "POST", "/api/online-sessions/join", sess(L1.id, today));
    T("another parent still cannot join after the host started", dJoin2.status === 404);
    const att = await call(A, "POST", "/api/online-sessions/attended", sess(L1.id, today));
    T("attendance recorded", att.status === 200);
    const reg = await fs_.collection("registers").doc(`blk-${L1.id}_${today}`).get();
    T("register shows the child present (marked from the join)", reg.exists && (reg.data().entries?.[`OS-A1-${stamp}`]?.status === "in"), JSON.stringify(reg.data()?.entries ?? {}).slice(0, 160));
    const hub = await fs_.collection("hubLessons").doc(`${L1.id}_${today}`).get();
    T("Hub mirror: lesson created for the enrolled child with the same id (same room)", hub.exists && (hub.data().childIds ?? []).includes("c-ava") && hub.data().attendance?.["c-ava"] !== undefined, hub.exists ? JSON.stringify({ childIds: hub.data().childIds, att: hub.data().attendance }) : "missing");
    const todayRows = await call(P, "GET", "/api/online-sessions/today");
    const tr = (todayRows.json as any[]).find((x) => x.listingId === L1.id);
    T("host today list shows booked 1, joined 1, live", tr?.booked === 1 && tr?.joined === 1 && tr?.status === "live", JSON.stringify(tr));
    const ext = await call(P, "POST", "/api/online-sessions/extend", sess(L1.id, today));
    T("host can extend (+15 min)", ext.status === 200 || ext.json?.code === "extension_limit", `${ext.status}`);
  }

  // ── UI ──
  const b = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
  const login = async (ctx: any, email: string) => { const p = await ctx.newPage(); await p.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 }); await p.getByPlaceholder("you@example.com").waitFor({ timeout: 120_000 }); for (let i = 0; i < 4; i++) { await p.waitForTimeout(1500); await p.getByPlaceholder("you@example.com").fill(email); } await p.locator('input[type="password"]').fill(TEST_PASSWORD); await p.getByRole("button", { name: "Sign in", exact: true }).click(); await p.waitForURL((u: URL) => !u.pathname.startsWith("/login"), { timeout: 90_000 }); await p.waitForTimeout(2500); return p; };

  // parent on a phone
  const pctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ["camera", "microphone"] });
  const pp = await login(pctx, parents.a.email);
  // a brand-new family sees a one-off welcome card: dismiss it the way a person would ("I'll do it later")
  await call(parents.a.tok, "POST", "/api/me/welcome", {});
  await pp.goto(`${WEB_URL}/custdash/bookings`, { waitUntil: "load" }); await pp.waitForTimeout(4000);
  if (await pp.locator('[aria-labelledby="welcome-title"]').count()) { await pp.getByRole("button", { name: /later/i }).first().click().catch(() => undefined); await pp.waitForTimeout(800); }
  const panel = pp.getByTestId("online-sessions-panel");
  T("UI phone: online sessions panel visible in My bookings", await panel.count() > 0);
  await shot(pp, "parent-phone-my-bookings");
  const txt = (await panel.innerText().catch(() => "")) || "";
  T("UI phone: panel shows no address or map", !/map|directions|road|street/i.test(txt) && /Online/.test(txt));
  T("UI phone: a Join button is shown for today's live session and 'Opens' for tomorrow", (await pp.getByTestId("os-join").count()) >= 1 && (await pp.getByTestId("os-opens-later").count()) >= 1);
  const noScroll = await pp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  T("UI phone: no sideways scroll", noScroll);
  await pp.getByTestId("os-join").first().click();
  await pp.waitForURL(/custdash\/session/, { timeout: 30_000 }).catch(() => undefined);
  await pp.waitForTimeout(9000);
  const roomUp = (await pp.getByTestId("os-room").count()) > 0;
  const frame = (await pp.locator("iframe").count()) > 0;
  T("UI phone: room page opens with the video frame", roomUp && frame, `room=${roomUp} iframe=${frame}`);
  await shot(pp, "parent-phone-in-room");
  await pctx.close();

  // before the host starts (a second family seen as the waiting state): use the cancelled parent? use parent D with no booking -> panel hidden
  // provider on desktop
  const hctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const hp = await login(hctx, em("prov"));
  await hp.goto(`${WEB_URL}/freelancer`, { waitUntil: "load" }); await hp.waitForTimeout(5000);
  T("UI provider: Online sessions today card on the dashboard", (await hp.getByTestId("host-sessions-card").count()) > 0);
  await shot(hp, "provider-dashboard-today-card");
  await hp.goto(`${WEB_URL}/freelancer/listings`, { waitUntil: "load" }); await hp.waitForTimeout(4500);
  await hp.locator('[data-ui="card"]').filter({ hasText: "Own-link Fitness Class" }).first().getByRole("button", { name: /^Edit$|^Resume$/ }).first().click();
  await hp.getByText(/^Step 1 of 13/).waitFor({ timeout: 45_000 });
  await hp.getByRole("button", { name: /^Next/ }).click(); await hp.waitForTimeout(1500);
  await shot(hp, "provider-wizard-online-own-link");
  T("UI provider: wizard shows the video-mode choice with the own link filled in", (await hp.locator("#wiz-own-link").count()) > 0 && (await hp.locator("#wiz-own-link").inputValue()) === "https://example.org/room-secret-abc");
  await hctx.close();
  await b.close();

  fs.writeFileSync(path.join(OUT, "email-ctx.json"), JSON.stringify({ L1: L1.id, tid, bundle: bundle.id, tomorrow }));

  // ── end session: families cannot rejoin ──
  if (hostOk) {
    const end = await call(P, "POST", "/api/online-sessions/end", sess(L1.id, today));
    const after = await call(A, "POST", "/api/online-sessions/join", sess(L1.id, today));
    T("after the host ends the session families cannot rejoin", end.status === 200 && after.status === 409 && after.json?.code === "waiting_for_host", `${end.status} ${after.status} ${after.json?.code}`);
  }
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ tenantId: tid, accounts: [em("prov"), em("a"), em("b"), em("d")], results }, null, 2));
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
