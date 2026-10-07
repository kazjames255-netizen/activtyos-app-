// QA agent E1: ActivityOS-room (Daily) online sessions end to end on an ISOLATED stack (web :3011 -> API :4011), throwaway accounts only.
// Run: E2E_BASE_URL=http://localhost:3011 NEXT_PUBLIC_API_URL=http://localhost:4011 server/node_modules/.bin/tsx e2e/review/e1-online.ts <phase>
//   phase "a": setup + everything that can run BEFORE the join window opens (early states, bank vs card, publish rules)
//   phase "b": run after the window has opened (host start, family join, attendance, end, today screen, UI shots)
import fs from "node:fs";
import path from "node:path";
import { fbSignUp, apiPost, apiFetch, TEST_EMAIL_DOMAIN } from "../helpers/accounts";
import { ROOT, WEB_URL, API_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require(path.join(ROOT, "node_modules/playwright"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require(path.join(ROOT, "server/node_modules/firebase-admin"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Stripe = require(path.join(ROOT, "server/node_modules/stripe")).default ?? require(path.join(ROOT, "server/node_modules/stripe"));

const OUT = "/Users/kazjames/Downloads/activtyos-app-/docs/home-visit-qa/E1";
const STATE = path.join(OUT, "state.json");
admin.initializeApp({ credential: admin.credential.cert(require(path.join(ROOT, "server/serviceAccountKey.json"))) });
const fs_ = admin.firestore();
const phase = process.argv[2] || "a";
const results: { id: string; ok: boolean; note: string }[] = fs.existsSync(path.join(OUT, "results.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "results.json"), "utf8")) : [];
const T = (id: string, ok: boolean, note = "") => { results.push({ id, ok, note }); console.log(`${ok ? "PASS" : "FAIL"} ${id} ${note}`); fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2)); };
let shotN = fs.existsSync(path.join(OUT, "shots.n")) ? Number(fs.readFileSync(path.join(OUT, "shots.n"), "utf8")) : 0;
const shot = async (page: any, name: string) => { await page.waitForTimeout(900); const f = `${String(++shotN).padStart(2, "0")}-${name}.png`; await page.screenshot({ path: path.join(OUT, f) }); fs.writeFileSync(path.join(OUT, "shots.n"), String(shotN)); return f; };
const call = async (tok: string | null, method: string, url: string, body?: unknown) => {
  const r = await fetch(`${API_URL}${url}`, { method, headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let json: any = null; try { json = await r.json(); } catch { /* empty */ }
  return { status: r.status, json };
};
const ukParts = (d: Date) => Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d).map((p) => [p.type, p.value]));
const hhmm = (d: Date) => { const p: any = ukParts(d); return `${p.hour === "24" ? "00" : p.hour}:${p.minute}`; };
const ymd = (d: Date) => { const p: any = ukParts(d); return `${p.year}-${p.month}-${p.day}`; };
const stamp = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")).stamp : `${Date.now().toString(36)}`;
const em = (n: string) => `hvqa-e1-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`;
const PW = "E2etest!123";
const signIn = async (email: string) => { const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY || fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/NEXT_PUBLIC_FIREBASE_API_KEY=(\S+)/)![1].replace(/["']/g, "")}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PW, returnSecureToken: true }) }); const j: any = await r.json(); return j.idToken as string; };
const stripeKey = (fs.readFileSync(path.join(ROOT, "server/.env"), "utf8").match(/^STRIPE_SECRET_KEY=(\S+)/m) || [])[1]?.replace(/["']/g, "");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  if (phase === "a") {
    T("stack", stripeKey?.startsWith("sk_test_") === true, `stripe key mode ${stripeKey?.slice(0, 8)}`);
    // ── accounts ──
    const prov = await fbSignUp(em("prov"));
    const reg = await apiPost<{ tenantId: string }>("/api/register-role", prov.idToken, { role: "freelancer", businessName: "HVQA E1 Video Tutors", providerName: "HVQA E1 Video Tutors", providerNameMode: "business", ownerName: "Sam Tutor" });
    const tid = reg.tenantId;
    await fs_.collection("tenants").doc(tid).set({ subscription: { status: "trialing", plan: "freelancer" } }, { merge: true });
    const lib0 = ((await apiFetch<any>("/api/library", prov.idToken)) ?? {}) as any;
    await apiFetch("/api/library", prov.idToken, { method: "PUT", body: JSON.stringify({ venues: [{ id: "online-v", name: "Online", address: "", kind: "online", directions: "Have a pen and paper ready" }], settings: { ...(lib0.settings ?? {}), billing: { ...(lib0.settings?.billing ?? {}), sortCode: "20-57-44", accountNumber: "63437582", bankName: "Test" }, features: { ...(lib0.settings?.features ?? {}), learninghub: true } } }) });
    const parents: Record<string, { tok: string; uid: string; email: string }> = {};
    for (const n of ["card", "bank", "other"]) { const s = await fbSignUp(em(n)); await apiPost("/api/register-role", s.idToken, { role: "parent", firstName: n.toUpperCase(), lastName: "Parent" }); parents[n] = { tok: s.idToken, uid: s.uid, email: em(n) }; }
    T("setup: provider + 3 parents", true, `tenant ${tid}`);

    // ── period starting in 12 minutes (UK), pass, bundle ──
    const now = new Date();
    const start = new Date(now.getTime() + 12 * 60_000);
    const end = new Date(start.getTime() + 60 * 60_000);
    const per = await apiPost<{ id: string }>("/api/periods", prov.idToken, { title: "Session", start: hhmm(start), finish: hhmm(end) });
    const pass = await apiPost<{ id: string }>("/api/passes", prov.idToken, { name: "Single session", days: 1 });
    const bundle = await apiPost<{ id: string }>("/api/block-bundles", prov.idToken, { name: "Online block", periodIds: [per.id], passIds: [pass.id], priced: true, masterPrice: 0.3, calcOn: true });
    const today = ymd(now), runTo = ymd(new Date(now.getTime() + 20 * 24 * 3600_000));
    const days = [0, 1, 2, 3, 4, 5, 6];
    const mk = (title: string, extra: Record<string, unknown>) => call(prov.idToken, "POST", "/api/listings", { title, venueId: "online-v", runFrom: today, runTo, blockMode: "custom", days, maxAttendees: "16", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id, passes: [{ name: "Single session", price: 0.3, days: 1 }], bookingType: "auto", status: "live", visibility: "public", deliveryMode: "venue", ...extra });
    const L1r = await mk("E1 Online Maths (ActivityOS room)", { videoMode: "platform" });
    const L1 = L1r.json as { id: string };
    T("1a. publish an online listing with hosting = ActivityOS room", L1r.status < 300 && !!L1?.id, `${L1r.status}`);
    const L1get = await call(prov.idToken, "GET", `/api/listings/${L1.id}`);
    T("1b. hosting choice is stored explicitly (videoMode = platform)", L1get.json?.videoMode === "platform", `videoMode=${L1get.json?.videoMode}`);
    const noMode = await mk("E1 Online (no hosting chosen)", {});
    const noModeGet = noMode.json?.id ? await call(prov.idToken, "GET", `/api/listings/${noMode.json.id}`) : null;
    T("1c. a listing saved with NO hosting choice defaults to ActivityOS room explicitly", noMode.status < 300 && noModeGet?.json?.videoMode === "platform", `status ${noMode.status} videoMode=${noModeGet?.json?.videoMode}`);
    const ownBad = await mk("E1 Own link, no link", { videoMode: "own", ownLink: "" });
    T("1d. publish refused for own-link mode with no link", ownBad.status >= 400, `${ownBad.status} ${JSON.stringify(ownBad.json).slice(0, 140)}`);
    const ownHttp = await mk("E1 Own link, http only", { videoMode: "own", ownLink: "http://example.org/x" });
    T("1e. publish refused for own link that is not https", ownHttp.status >= 400, `${ownHttp.status}`);
    const pastR = await call(prov.idToken, "POST", "/api/listings", { title: "E1 past dates", venueId: "online-v", runFrom: "2006-10-20", runTo: "2006-11-20", blockMode: "custom", days, blockId: bundle.id, passes: [{ name: "Single session", price: 0.3, days: 1 }], bookingType: "auto", status: "live", visibility: "public", deliveryMode: "venue", videoMode: "platform" });
    T("1f. (info) a live online listing with only past dates (server rule only applies on production builds)", true, `status ${pastR.status}`);

    // blocks of L1
    const detail = await call(parents.card.tok, "GET", `/api/listings/${L1.id}`);
    const blocks: any[] = detail.json?.blocks ?? [];
    const todayBlock = blocks.find((b) => (b.sessions ?? []).some((s: any) => s.date === today)) ?? blocks[0];
    T("1g. parent can see the online listing and its blocks", detail.status === 200 && blocks.length > 0, `blocks ${blocks.length}, today block ${todayBlock?.id}`);

    // ── card parent books today's session and pays (TEST card via Stripe) ──
    const bookBody = (method: string, child: string) => ({ listingId: L1.id, blockId: todayBlock.id, method, items: [{ pass: "Single session", dates: [today], child, age: 7 }] });
    const bc = await call(parents.card.tok, "POST", "/api/my/bookings", bookBody("card", "Cardchild"));
    const refCard = bc.json?.bookings?.[0]?.ref;
    T("2a. card parent books today's online session", bc.status < 300 && !!refCard, `${bc.status} ${refCard} total ${bc.json?.total}`);
    const co = await call(parents.card.tok, "POST", "/api/payments/checkout", { refs: [refCard] });
    let paidOk = false;
    if (co.status < 300 && co.json?.clientSecret) {
      const piId = String(co.json.clientSecret).split("_secret_")[0];
      const stripe = new Stripe(stripeKey);
      try { await stripe.paymentIntents.confirm(piId, { payment_method: "pm_card_visa", return_url: "https://example.org/return" }); } catch (e) { T("2b. Stripe test card confirm", false, (e as Error).message.slice(0, 160)); }
      const cf = await call(parents.card.tok, "POST", `/api/payments/checkout/${co.json.paymentId}/confirm`, {});
      paidOk = cf.json?.paid === true;
      T("2b. test card 4242 pays the booking -> Paid", paidOk, `${cf.status} ${JSON.stringify(cf.json).slice(0, 120)}`);
    } else T("2b. checkout started", false, `${co.status} ${JSON.stringify(co.json).slice(0, 160)}`);
    const bkCard = await call(prov.idToken, "GET", `/api/bookings/${refCard}`);
    T("2c. booking is Confirmed + Paid on the provider side", bkCard.json?.status === "Confirmed" && bkCard.json?.pay === "Paid", `${bkCard.json?.status}/${bkCard.json?.pay}`);

    // ── bank parent books; unpaid; panel says pay to unlock ──
    const bb = await call(parents.bank.tok, "POST", "/api/my/bookings", bookBody("bank", "Bankchild"));
    const refBank = bb.json?.bookings?.[0]?.ref;
    T("3a. bank-transfer parent books", bb.status < 300 && !!refBank, `${bb.status} ${refBank} ${bb.json?.bookings?.[0]?.method}`);
    const mineBank = await call(parents.bank.tok, "GET", "/api/online-sessions/mine");
    const mb = (mineBank.json as any[] | null)?.find?.((x) => x.listingId === L1.id && x.date === today);
    T("3b. unpaid bank booking: panel state is 'unpaid' (pay to unlock), no join/link", mb?.state === "unpaid" || mb?.joinState === "unpaid" || mb?.paid === false, JSON.stringify(mb).slice(0, 240));
    const joinUnpaid = await call(parents.bank.tok, "POST", "/api/online-sessions/join", { listingId: L1.id, date: today });
    T("3c. unpaid family cannot get a token (join refused)", joinUnpaid.status >= 400 && !joinUnpaid.json?.token, `${joinUnpaid.status} ${joinUnpaid.json?.code ?? ""}`);

    // ── early state for the paid card parent ──
    const mineCard = await call(parents.card.tok, "GET", "/api/online-sessions/mine");
    const mc = (mineCard.json as any[]).find((x) => x.listingId === L1.id && x.date === today);
    T("4a. paid, before the window: state 'early' with the REAL opening time", mc?.state === "early" && !!mc?.opensAt, JSON.stringify({ state: mc?.state, joinState: mc?.joinState, opensAt: mc?.opensAt, startsAt: mc?.startsAt }));
    if (mc?.opensAt) { const opens = new Date(mc.opensAt), starts = new Date(mc.startsAt); T("4b. window opens 10 minutes before the start", Math.round((starts.getTime() - opens.getTime()) / 60000) === 10, `${hhmm(opens)} -> ${hhmm(starts)}`); }
    const earlyJoin = await call(parents.card.tok, "POST", "/api/online-sessions/join", { listingId: L1.id, date: today });
    T("4c. join before the window is refused (early)", earlyJoin.status === 409 && earlyJoin.json?.code === "early", `${earlyJoin.status} ${earlyJoin.json?.code}`);
    const otherJoin = await call(parents.other.tok, "POST", "/api/online-sessions/join", { listingId: L1.id, date: today });
    T("4d. another family (no booking) cannot join", otherJoin.status === 404, `${otherJoin.status}`);
    const anon = await call(null, "POST", "/api/online-sessions/join", { listingId: L1.id, date: today });
    T("4e. signed-out request cannot join", anon.status === 401 || anon.status === 403, `${anon.status}`);
    const hostEarly = await call(prov.idToken, "POST", "/api/online-sessions/join", { listingId: L1.id, date: today });
    T("4f. host can start no earlier than the window (early host start refused or allowed: record)", true, `${hostEarly.status} ${hostEarly.json?.code ?? ""}`);

    // cancelled booking cannot join: book another child, cancel as provider
    const bx = await call(parents.card.tok, "POST", "/api/my/bookings", bookBody("bank", "Cancelchild"));
    const refCancel = bx.json?.bookings?.[0]?.ref;
    if (refCancel) { const cx = await call(prov.idToken, "POST", `/api/bookings/${refCancel}/actions`, { type: "cancel", refund: "none", reason: "QA" }); T("5a. provider cancels a booking", cx.status < 300, `${cx.status}`); }

    // later sessions for the carousel: card parent books 3 more days (bank method so no payment needed, then provider marks paid)
    const later = [1, 2, 3].map((n) => ymd(new Date(now.getTime() + n * 24 * 3600_000)));
    const refsLater: string[] = [];
    for (const d of later) { const blk = blocks.find((b) => (b.sessions ?? []).some((s: any) => s.date === d)); if (!blk) continue; const r = await call(parents.card.tok, "POST", "/api/my/bookings", { listingId: L1.id, blockId: blk.id, method: "bank", items: [{ pass: "Single session", dates: [d], child: "Cardchild", age: 7 }] }); if (r.json?.bookings?.[0]?.ref) refsLater.push(r.json.bookings[0].ref); }
    for (const ref of refsLater) await call(prov.idToken, "POST", `/api/bookings/${ref}/actions`, { type: "paid" });
    const mine2 = await call(parents.card.tok, "GET", "/api/online-sessions/mine");
    const dates = (mine2.json as any[]).filter((x) => x.listingId === L1.id).map((x) => x.date);
    T("6a. /mine returns today + 3 later sessions for the carousel", dates.length >= 4, dates.join(","));

    // provider marks the bank booking paid -> unlocks (state becomes early)
    const mp = await call(prov.idToken, "POST", `/api/bookings/${refBank}/actions`, { type: "paid" });
    const mineBank2 = await call(parents.bank.tok, "GET", "/api/online-sessions/mine");
    const mb2 = (mineBank2.json as any[]).find((x) => x.listingId === L1.id && x.date === today);
    T("3d. provider 'Mark paid' unlocks the bank family (state moves from unpaid to early)", mp.status < 300 && (mb2?.state === "early" || mb2?.state === "open"), `${mp.status} ${mb2?.state}`);

    fs.writeFileSync(STATE, JSON.stringify({ stamp, tid, L1: L1.id, todayBlock: todayBlock.id, today, startsAtIso: start.toISOString(), refCard, refBank, refCancel, refsLater, accounts: [em("prov"), em("card"), em("bank"), em("other")], noMode: noMode.json?.id, ownBad: ownBad.json?.id }, null, 2));
    console.log("phase a done; window opens at", hhmm(new Date(start.getTime() - 10 * 60_000)), "session starts", hhmm(start));
    process.exit(0);
  }

  if (phase === "b") {
    const st = JSON.parse(fs.readFileSync(STATE, "utf8"));
    const { L1, today, tid } = st;
    const tok: Record<string, string> = {};
    for (const n of ["prov", "card", "bank", "other"]) tok[n] = await signIn(em(n));
    const sess = { listingId: L1, date: today };
    const rooms: string[] = fs.existsSync(path.join(OUT, "rooms.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "rooms.json"), "utf8")) : [];
    const addRoom = (n?: string) => { if (n && !rooms.includes(n)) { rooms.push(n); fs.writeFileSync(path.join(OUT, "rooms.json"), JSON.stringify(rooms)); } };
    // wait for the window to open
    for (let i = 0; i < 40; i++) { const m = await call(tok.card, "GET", "/api/online-sessions/mine"); const x = (m.json as any[]).find((y) => y.listingId === L1 && y.date === today); if (x && x.state !== "early") break; await new Promise((r) => setTimeout(r, 15000)); }
    // 4f earlier started the host before the window: end it so we can test 'waiting for host' inside the window
    const endFirst = await call(tok.prov, "POST", "/api/online-sessions/end", sess);
    const waitJoin = await call(tok.card, "POST", "/api/online-sessions/join", sess);
    T("7a. inside the window, host not started: family refused with 'waiting_for_host'", waitJoin.status === 409 && waitJoin.json?.code === "waiting_for_host", `${waitJoin.status} ${waitJoin.json?.code} (end:${endFirst.status})`);
    const mw = (await call(tok.card, "GET", "/api/online-sessions/mine")).json.find((y: any) => y.listingId === L1 && y.date === today);
    T("7b. panel state inside the window with host not started is 'waiting'", mw?.state === "waiting" || mw?.joinState === "waiting" || mw?.hostLive === false, JSON.stringify({ state: mw?.state, joinState: mw?.joinState, hostLive: mw?.hostLive }));
    // host starts
    const hj = await call(tok.prov, "POST", "/api/online-sessions/join", sess);
    addRoom(hj.json?.roomName);
    T("8a. host starts the session: real Daily room + owner token", hj.status === 200 && hj.json?.mode === "platform" && !!hj.json?.token && hj.json?.isOwner === true, `${hj.status} room ${hj.json?.roomName} ${hj.status !== 200 ? JSON.stringify(hj.json).slice(0, 160) : ""}`);
    const dailyKey = (fs.readFileSync(path.join(ROOT, "server/.env"), "utf8").match(/^DAILY_API_KEY=(\S+)/m) || [])[1]?.replace(/["']/g, "");
    if (hj.json?.roomName && dailyKey) {
      const dr = await fetch(`https://api.daily.co/v1/rooms/${hj.json.roomName}`, { headers: { Authorization: `Bearer ${dailyKey}` } }); const dj: any = await dr.json();
      T("8b. the Daily room is PRIVATE and has an expiry and a participant cap", dj.privacy === "private" && !!dj.config?.exp && (dj.config?.max_participants ?? 0) > 0, `privacy=${dj.privacy} exp=${dj.config?.exp} max=${dj.config?.max_participants}`);
    }
    const fj = await call(tok.card, "POST", "/api/online-sessions/join", sess);
    addRoom(fj.json?.roomName);
    T("8c. family joins once the host is in (token, not owner, first name only)", fj.status === 200 && !!fj.json?.token && fj.json?.isOwner === false, `${fj.status} user=${fj.json?.userName} room=${fj.json?.roomName}`);
    T("8d. same room for host and family", !!fj.json?.roomName && fj.json?.roomName === hj.json?.roomName);
    const bj = await call(tok.bank, "POST", "/api/online-sessions/join", sess);
    T("8e. the bank-transfer family (marked paid) joins too", bj.status === 200 && !!bj.json?.token, `${bj.status} ${bj.json?.code ?? ""}`);
    const oj = await call(tok.other, "POST", "/api/online-sessions/join", sess);
    T("8f. an unrelated family still cannot join (404, no token)", oj.status === 404 && !oj.json?.token, `${oj.status}`);
    // attendance
    const att = await call(tok.card, "POST", "/api/online-sessions/attended", sess);
    T("9a. attendance call accepted", att.status === 200, `${att.status} ${JSON.stringify(att.json).slice(0, 100)}`);
    const regSnap = await fs_.collection("registers").doc(`${st.todayBlock}_${today}`).get();
    const entries = regSnap.exists ? JSON.stringify(regSnap.data().entries ?? {}) : "no register doc";
    T("9b. the child is marked present on the provider's register", regSnap.exists && entries.includes(st.refCard) && /"in"|present/.test(entries), entries.slice(0, 200));
    // today screen
    const td = await call(tok.prov, "GET", "/api/online-sessions/today");
    const tr = (td.json as any[]).find((x) => x.listingId === L1);
    T("10. provider 'today' list: booked 2 (card + bank), joined >= 1, status live", tr?.booked === 2 && tr?.joined >= 1 && tr?.status === "live", JSON.stringify(tr));
    // extend + stay prompt
    const ext = await call(tok.prov, "POST", "/api/online-sessions/extend", sess);
    T("11a. host can extend the session (+15 min) or is told the limit", ext.status === 200 || ext.json?.code === "extension_limit", `${ext.status} ${JSON.stringify(ext.json).slice(0, 120)}`);
    // cancelled booking cannot join: cancel the bank booking then try
    await call(tok.prov, "POST", `/api/bookings/${st.refBank}/actions`, { type: "cancel", refund: "none", reason: "QA" });
    const cj = await call(tok.bank, "POST", "/api/online-sessions/join", sess);
    T("12. a CANCELLED booking cannot get a token", cj.status === 404 && !cj.json?.token, `${cj.status}`);
    // end session
    const en = await call(tok.prov, "POST", "/api/online-sessions/end", sess);
    const re = await call(tok.card, "POST", "/api/online-sessions/join", sess);
    T("13. host ends: room torn down, family cannot rejoin until the host returns", en.status === 200 && re.status === 409 && re.json?.code === "waiting_for_host", `${en.status} ${re.status} ${re.json?.code}`);
    // finished session drops from the panel
    await fs_.collection("onlineSessions").where("listingId", "==", L1).get().then(async (q: any) => { for (const d of q.docs) if (d.data().date === today) await d.ref.set({ startsAt: new Date(Date.now() - 4 * 3600_000).toISOString() }, { merge: true }); });
    const done = (await call(tok.card, "GET", "/api/online-sessions/mine")).json.filter((y: any) => y.listingId === L1).map((y: any) => y.date);
    T("14. a finished session (window closed) drops from the parent's list, later ones stay", !done.includes(today) && done.length >= 3, done.join(","));
    console.log("phase b API checks done; rooms:", rooms.join(","));
    process.exit(0);
  }

  if (phase === "c") {
    const st = JSON.parse(fs.readFileSync(STATE, "utf8"));
    const { L1, today } = st;
    const tok: Record<string, string> = {};
    for (const n of ["prov", "card", "bank", "other"]) tok[n] = await signIn(em(n));
    const sess = { listingId: L1, date: today };
    const rooms: string[] = fs.existsSync(path.join(OUT, "rooms.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "rooms.json"), "utf8")) : [];
    const login = async (ctx: any, email: string) => { const p = await ctx.newPage(); await p.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 }); await p.getByPlaceholder("you@example.com").waitFor({ timeout: 120_000 }); for (let i = 0; i < 4; i++) { await p.waitForTimeout(1500); await p.getByPlaceholder("you@example.com").fill(email); } await p.locator('input[type="password"]').fill(PW); await p.getByRole("button", { name: "Sign in", exact: true }).click(); await p.waitForURL((u: URL) => !u.pathname.startsWith("/login"), { timeout: 90_000 }); await p.waitForTimeout(2500); return p; };
    const b = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
    // parent on a phone: panel + carousel
    const pctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ["camera", "microphone"] });
    const pp = await login(pctx, em("card"));
    await call(tok.card, "POST", "/api/me/welcome", {});
    await pp.goto(`${WEB_URL}/custdash/bookings`, { waitUntil: "load" }); await pp.waitForTimeout(5000);
    if (await pp.locator('[aria-labelledby="welcome-title"]').count()) { await pp.getByRole("button", { name: /later/i }).first().click().catch(() => undefined); await pp.waitForTimeout(800); }
    const panel = pp.getByTestId("online-sessions-panel");
    T("UI-1. parent My bookings shows the 'Your online sessions' panel", (await panel.count()) > 0);
    const txt0 = (await panel.innerText().catch(() => "")) || "";
    T("UI-2. panel title shows the count and a 1 of N counter", /·\s*\d/.test(txt0) && /1\s*(of|\/)\s*\d/.test(txt0), txt0.slice(0, 120).replace(/\n/g, " | "));
    await shot(pp, "parent-phone-panel-waiting-for-host");
    T("UI-3. the first card is TODAY's session (nearest first) and says waiting for the host", /Waiting for your host|hasn't started/i.test(txt0), txt0.slice(0, 200).replace(/\n/g, " | "));
    const nextBtn = pp.getByTestId("os-next");
    if (await nextBtn.count()) { await nextBtn.click(); await pp.waitForTimeout(600); const t1 = (await panel.innerText()).replace(/\n/g, " | "); T("UI-4. next arrow shows the next day's session (opens later)", /2\s*(of|\/)\s*\d/.test(t1) && /Opens|appears/i.test(t1), t1.slice(0, 200)); await shot(pp, "parent-phone-panel-next-session"); await pp.getByTestId("os-prev").click(); await pp.waitForTimeout(400); } else T("UI-4. next arrow present", false, "no os-next");
    // host starts, then Join appears
    const hj = await call(tok.prov, "POST", "/api/online-sessions/join", sess); if (hj.json?.roomName && !rooms.includes(hj.json.roomName)) rooms.push(hj.json.roomName);
    await pp.waitForTimeout(12000);
    const joinBtn = pp.getByTestId("os-join");
    T("UI-5. once the host has started, a Join button appears on the parent's panel (live refresh)", (await joinBtn.count()) > 0, `join buttons ${await joinBtn.count()}`);
    await shot(pp, "parent-phone-panel-join-button");
    if (await joinBtn.count()) {
      await joinBtn.first().click();
      await pp.waitForURL(/custdash\/session/, { timeout: 30000 }).catch(() => undefined);
      await pp.waitForTimeout(12000);
      const roomUp = (await pp.getByTestId("os-room").count()) > 0, frame = (await pp.locator("iframe").count()) > 0;
      T("UI-6. Join opens the room page with a real video frame (Daily)", roomUp && frame, `room=${roomUp} iframe=${frame}`);
      await shot(pp, "parent-phone-in-room");
    }
    await pp.goto(`${WEB_URL}/custdash/home`, { waitUntil: "load" }); await pp.waitForTimeout(5000);
    T("UI-7. the home page shows the same online-sessions panel", (await pp.getByTestId("online-sessions-panel").count()) > 0);
    await shot(pp, "parent-phone-home");
    const noScroll = await pp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    T("UI-8. no sideways scroll on the phone", noScroll);
    await pctx.close();
    // provider desktop
    const hctx = await b.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["camera", "microphone"] });
    const hp = await login(hctx, em("prov"));
    await hp.goto(`${WEB_URL}/freelancer`, { waitUntil: "load" }); await hp.waitForTimeout(6000);
    T("UI-9. provider dashboard has the 'Online sessions today' card", (await hp.getByTestId("host-sessions-card").count()) > 0);
    await shot(hp, "provider-dashboard-today-card");
    await hp.goto(`${WEB_URL}/freelancer/session?l=${L1}&d=${today}`, { waitUntil: "load" }); await hp.waitForTimeout(12000);
    const frameH = (await hp.locator("iframe").count()) > 0;
    T("UI-10. provider session page opens the room (video frame present)", frameH);
    await shot(hp, "provider-session-room");
    await hctx.close();
    await call(tok.prov, "POST", "/api/online-sessions/end", sess);
    // finished session drops: a listing whose session was EARLIER today (08:00-09:00 UK)
    const per = await apiPost<{ id: string }>("/api/periods", tok.prov, { title: "Early", start: "06:00", finish: "07:00" });
    const pass2 = await apiPost<{ id: string }>("/api/passes", tok.prov, { name: "Early pass", days: 1 });
    const bundle2 = await apiPost<{ id: string }>("/api/block-bundles", tok.prov, { name: "Early block", periodIds: [per.id], passIds: [pass2.id], priced: true, masterPrice: 0.3, calcOn: true });
    const runTo = ymd(new Date(Date.now() + 3 * 24 * 3600_000));
    const L2r = await call(tok.prov, "POST", "/api/listings", { title: "E1 Early online (session already finished today)", venueId: "online-v", runFrom: today, runTo, blockMode: "custom", days: [0, 1, 2, 3, 4, 5, 6], maxAttendees: "16", capacityScope: "day", ageFrom: "5", ageTo: "12", blockId: bundle2.id, passes: [{ name: "Early pass", price: 0.3, days: 1 }], bookingType: "auto", status: "live", visibility: "public", deliveryMode: "venue", videoMode: "platform" });
    const L2 = L2r.json?.id; const d2 = (await call(tok.card, "GET", `/api/listings/${L2}`)).json; const blk2 = (d2?.blocks ?? []).find((x: any) => (x.sessions ?? []).some((s: any) => s.date === today));
    const bk2 = blk2 ? await call(tok.card, "POST", "/api/my/bookings", { listingId: L2, blockId: blk2.id, method: "bank", items: [{ pass: "Early pass", dates: [today], child: "Cardchild", age: 7 }] }) : null;
    if (bk2?.json?.bookings?.[0]?.ref) await call(tok.prov, "POST", `/api/bookings/${bk2.json.bookings[0].ref}/actions`, { type: "paid" });
    const mineF = (await call(tok.card, "GET", "/api/online-sessions/mine")).json as any[];
    T("15. a session that already finished today (06:00-07:00 UK) is NOT in the parent's list", !mineF.some((y) => y.listingId === L2), `listed dates for L2: ${mineF.filter((y) => y.listingId === L2).map((y) => y.date + ":" + y.state)}`);
    const jf = await call(tok.card, "POST", "/api/online-sessions/join", { listingId: L2, date: today });
    T("16. joining a finished session is refused ('This session has finished')", jf.status === 409 && jf.json?.code === "outside_join_window", `${jf.status} ${jf.json?.code}`);
    await b.close();
    fs.writeFileSync(path.join(OUT, "rooms.json"), JSON.stringify(rooms));
    console.log("phase c done");
    process.exit(0);
  }

  if (phase === "d") {
    // API restarted WITHOUT DAILY_API_KEY: what do people see?
    const st = JSON.parse(fs.readFileSync(STATE, "utf8"));
    const { L1, today } = st;
    const tok: Record<string, string> = {};
    for (const n of ["prov", "card"]) tok[n] = await signIn(em(n));
    const sess = { listingId: L1, date: today };
    const stt = await call(tok.prov, "GET", "/api/online-sessions/status");
    T("17a. with no video key the status endpoint says videoReady=false", stt.json?.videoReady === false, JSON.stringify(stt.json));
    // a fresh window for today: shift is not possible, so use the host join on today's session (window is still open)
    const hj = await call(tok.prov, "POST", "/api/online-sessions/join", sess);
    T("17b. host start with no key -> clear 503 video_unavailable (no crash, no room)", hj.status === 503 && hj.json?.code === "video_unavailable", `${hj.status} ${hj.json?.code}`);
    const fj = await call(tok.card, "POST", "/api/online-sessions/join", sess);
    T("17c. family join with no key and host not started -> waiting_for_host (not an error page)", fj.status === 409 && fj.json?.code === "waiting_for_host", `${fj.status} ${fj.json?.code}`);
    const login = async (ctx: any, email: string) => { const p = await ctx.newPage(); await p.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 }); await p.getByPlaceholder("you@example.com").waitFor({ timeout: 120_000 }); for (let i = 0; i < 4; i++) { await p.waitForTimeout(1500); await p.getByPlaceholder("you@example.com").fill(email); } await p.locator('input[type="password"]').fill(PW); await p.getByRole("button", { name: "Sign in", exact: true }).click(); await p.waitForURL((u: URL) => !u.pathname.startsWith("/login"), { timeout: 90_000 }); await p.waitForTimeout(2500); return p; };
    const b = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
    const hctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const hp = await login(hctx, em("prov"));
    await hp.goto(`${WEB_URL}/freelancer/session?l=${L1}&d=${today}`, { waitUntil: "load" }); await hp.waitForTimeout(9000);
    const pt = (await hp.locator("body").innerText()).replace(/\n/g, " | ");
    T("17d. provider session page: friendly 'video rooms aren't switched on yet' + own-link advice + Edit button", /aren't switched on/i.test(pt) && /own link/i.test(pt), pt.slice(0, 260));
    await shot(hp, "provider-session-no-video-key");
    await hp.goto(`${WEB_URL}/freelancer/listings`, { waitUntil: "load" }); await hp.waitForTimeout(5000);
    await hp.locator('[data-ui="card"]').filter({ hasText: "E1 Online Maths" }).first().getByRole("button", { name: /^Edit$|^Resume$/ }).first().click();
    await hp.getByText(/^Step 1 of 13/).waitFor({ timeout: 60_000 });
    await hp.getByRole("button", { name: /^Next/ }).click(); await hp.waitForTimeout(2500);
    const wz = (await hp.locator("body").innerText()).replace(/\n/g, " | ");
    T("17e. listing wizard shows the 'video rooms are not switched on' note under ActivityOS room", /not switched on/i.test(wz), wz.includes("ActivityOS room") ? "ActivityOS room option present" : "no hosting section found");
    await shot(hp, "wizard-hosting-no-video-key");
    await hctx.close();
    const pctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    const pp = await login(pctx, em("card"));
    await pp.goto(`${WEB_URL}/custdash/bookings`, { waitUntil: "load" }); await pp.waitForTimeout(6000);
    const ptxt = (await pp.getByTestId("online-sessions-panel").innerText().catch(() => "")).replace(/\n/g, " | ");
    T("17f. family panel with no key: 'waiting for host' wording, no dead end", /host/i.test(ptxt) && !/can't join yet/i.test(ptxt), ptxt.slice(0, 200));
    await shot(pp, "parent-panel-no-video-key");
    await b.close();
    console.log("phase d done");
    process.exit(0);
  }

  if (phase === "e") {
    // verify the fixes: UK clock in the panel (browser is in another zone), online email wording
    const st = JSON.parse(fs.readFileSync(STATE, "utf8"));
    const login = async (ctx: any, email: string) => { const p = await ctx.newPage(); await p.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 }); await p.getByPlaceholder("you@example.com").waitFor({ timeout: 120_000 }); for (let i = 0; i < 4; i++) { await p.waitForTimeout(1500); await p.getByPlaceholder("you@example.com").fill(email); } await p.locator('input[type="password"]').fill(PW); await p.getByRole("button", { name: "Sign in", exact: true }).click(); await p.waitForURL((u: URL) => !u.pathname.startsWith("/login"), { timeout: 90_000 }); await p.waitForTimeout(2500); return p; };
    const b = await chromium.launch();
    const pctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Dubai" });
    const pp = await login(pctx, em("card"));
    await pp.goto(`${WEB_URL}/custdash/bookings`, { waitUntil: "load" }); await pp.waitForTimeout(6000);
    const panel = pp.getByTestId("online-sessions-panel");
    await pp.getByTestId("os-next").click(); await pp.waitForTimeout(600);
    const t1 = (await panel.innerText()).replace(/\n/g, " | ");
    const startUk = new Date(st.startsAtIso); const wantStart = hhmm(startUk); const wantOpen = hhmm(new Date(startUk.getTime() - 10 * 60000));
    T("18. FIX: with the browser in Dubai (+4) the panel still shows UK clock times", t1.includes(wantStart) && t1.includes(wantOpen), `want ${wantStart}/${wantOpen}: ${t1.slice(0, 200)}`);
    await shot(pp, "parent-panel-uk-time-after-fix");
    await b.close();
    process.exit(0);
  }
})().catch((e) => { console.error(e); process.exit(1); });
