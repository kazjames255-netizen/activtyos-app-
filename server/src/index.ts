import "dotenv/config";
import "./lib/testStackGuardRun"; // directly after dotenv, before anything touches Firebase: a TEST_STACK=1 process that is not emulator-only exits here
import { isBusyError, BUSY_MESSAGE } from "./lib/busyRetry";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import { forgetHub } from "./lib/hubCache";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { parse as parseYaml } from "yaml";
import { optionalAuth, requireAuth } from "./middleware/auth";
import { attachRole, attachRoleOptional } from "./middleware/role";
import { blockBundles, passes, periods } from "./routes/blockBundles";
import { blocks } from "./routes/blocks";
import { bookings } from "./routes/bookings";
import { customers } from "./routes/customers";
import { events } from "./routes/events";
import { invitePreview, invites } from "./routes/invites";
import { referencePublic, references } from "./routes/references";
import { library, libraryPublic } from "./routes/library";
import { listings } from "./routes/listings";
import { my } from "./routes/my";
import { stripCheckoutId, stripCheckoutIdForFamilies } from "./lib/stripCheckoutId";
import { onlineSessions } from "./routes/onlineSessions";
import { rateLimit } from "./lib/rateLimit";
import { gzipResponses } from "./lib/gzip";
import { staffAnnouncements } from "./routes/staffAnnouncements";
import { learning } from "./routes/learning";
import { learningCentre } from "./routes/learningCentre";
import { payrollRecords } from "./routes/payrollRecords";
import { media } from "./routes/mediaUploads";
import { leave } from "./routes/leave";
import { rota } from "./routes/rota";
import { timeclock } from "./routes/timeclock";
import { payroll } from "./routes/payroll";
import { accounting, accountingCallback } from "./routes/accounting";
import { payslips } from "./routes/payslips";
import { onboarding } from "./routes/onboarding";
import { credentials, credentialsPublic } from "./routes/credentials";
import { images, uploads } from "./routes/uploads";
import { invoices, invoicePublic } from "./routes/invoices";
import { income } from "./routes/income";
import { suppliers } from "./routes/suppliers";
import { incidents } from "./routes/incidents";
import { meals } from "./routes/meals";
import { moments } from "./routes/moments";
import { medications } from "./routes/medications";
import { childFiles } from "./routes/childFiles";
import { feedback } from "./routes/feedback";
import { referral, referralsAdmin } from "./routes/referral";
import { memberships, membershipsAdmin } from "./routes/memberships";
import { platform } from "./routes/platform";
import { leads, leadsPublic, warmLeads } from "./routes/leads";
import { demoSlotsPublic, demoSlotTemplates, demoSlotBlackouts } from "./routes/demoSlots";
import { ventureLakes } from "./routes/ventureLakes";
import { providersPublic } from "./routes/providers";
import { testTracker } from "./routes/testTracker";
import { analytics } from "./routes/analytics";
import { reconciliation } from "./routes/reconciliation";
import { dashboard } from "./routes/dashboard";
import { growth } from "./routes/growth";
import { discounts } from "./routes/discounts";
import { splitfees } from "./routes/splitfees";
import { hoOverview } from "./routes/hoOverview";
import { franchises } from "./routes/franchises";
import { milestones } from "./routes/milestones";
import { account } from "./routes/account";
import { privacy } from "./routes/privacy";
import { emails, emailsInbound, emailsOpen, emailsResendInbound, emailsUnsub } from "./routes/emails";
import { hubDigestPublic } from "./routes/hub/digestApi";
import { onboardingUnsub } from "./routes/onboardingUnsub";
import { mealOptions, mealOrders } from "./routes/mealsShop";
import { mealMenus } from "./routes/mealMenus";
import { documents } from "./routes/documents";
import { compliance } from "./routes/compliance";
import { expenses } from "./routes/expenses";
import { expenseClaims } from "./routes/expenseClaims";
import { appraisals } from "./routes/appraisals";
import { locationStaff } from "./routes/locationStaff";
import { purchasing } from "./routes/purchasing";
import { subscription } from "./routes/subscription";
import { wallet } from "./routes/wallet";
import { notifications } from "./routes/notifications";
import { posts } from "./routes/posts";
import { messages } from "./routes/messages";
import { shifts } from "./routes/shifts";
import { reviews } from "./routes/reviews";
import { availability } from "./routes/availability";
import { tasks } from "./routes/tasks";
import { timetables } from "./routes/timetables";
import { trips } from "./routes/trips";
import { calendarEvents } from "./routes/calendarEvents";
import { inventory } from "./routes/inventory";
import { registerRole } from "./routes/registerRole";
import { geo, tiles, recogniseHandler } from "./routes/geo";
import { ratios } from "./routes/ratios";
import { registers } from "./routes/registers";
import { kit } from "./routes/kit";
import { kitCacheInvalidator } from "./lib/kitCache";
import { children } from "./routes/children";
import { platformNotifications } from "./routes/platformNotifications";
import { payments, bookingPayPublic } from "./routes/payments";
import { me, tenants } from "./routes/tenants";
import { twoFa } from "./routes/twoFa";
import { ai } from "./routes/ai";
import { aiRateLimit } from "./lib/aiGuards";
import { stripeWebhook } from "./routes/stripeWebhook";
import { installProcessHandlers, record } from "./lib/monitor";
import { enforceSubscription } from "./middleware/subscription";
import { enforceAccess } from "./middleware/access";
import { learningHub } from "./routes/learningHub";
import { noOakResponse } from "./oak/noOakResponse";
import { platformLeads } from "./routes/platformLeads";
import { platformSupport, supportReport } from "./routes/platformSupport";
import { readStats, resetReadStats, withReadLabel } from "./lib/readMeter";
import { timingSafeEqual } from "node:crypto";
import { tfc, tfcCallback } from "./routes/tfc";

const app = express();
// Behind the host's proxy (Railway/Vercel: one hop) req.ip must be the real
// client, not the proxy — the public rate limits key on it. Override with
// TRUST_PROXY (a hop count, or "false").
app.set("trust proxy", process.env.TRUST_PROXY ? (process.env.TRUST_PROXY === "false" ? false : Number(process.env.TRUST_PROXY)) : process.env.NODE_ENV === "production" ? 1 : false);

app.use(
  cors({
    // Allow any localhost / 127.0.0.1 / *.localhost origin on any port. Sessions
    // are stored per-origin, so testing several accounts at once means opening
    // each on its own origin (localhost:3000, 127.0.0.1:3000, company.localhost:3000…).
    // CORS_ORIGIN still lists explicit extra origins for production.
    origin: (origin, cb) => {
      const allow =
        !origin ||
        /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9-]+\.localhost)(:\d+)?$/i.test(origin) ||
        (process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3000", "http://localhost:3001"]).includes(origin);
      cb(null, allow);
    },
  }),
);
// Firestore read meter (lib/readMeter.ts): attribute every read made while serving a request to its route, ids collapsed
// (`http:GET /api/hub/notes/:id`), and expose the totals at GET /internal/read-stats (loopback only, or READ_STATS_KEY header).
app.use((req, _res, next) => {
  const label = `http:${req.method} ${req.path.split("/").map((s) => (/^[A-Za-z0-9_-]{16,}$/.test(s) || /^\d+$/.test(s) ? ":id" : s)).join("/").slice(0, 80)}`;
  withReadLabel(label, next);
});
app.get("/internal/read-stats", (req, res) => {
  // With READ_STATS_KEY set (required in production): the key must match, compared in constant time. Without a key (dev only): loopback
  // callers only, and never a request that came through a proxy (x-forwarded-for present) — behind a same-host reverse proxy every
  // request would otherwise look local.
  const key = process.env.READ_STATS_KEY;
  let ok = false;
  if (key) {
    const got = Buffer.from(String(req.header("x-read-stats-key") ?? ""));
    const want = Buffer.from(key);
    ok = got.length === want.length && timingSafeEqual(got, want);
  } else if (process.env.NODE_ENV !== "production") {
    const ip = req.socket.remoteAddress ?? "";
    ok = (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1") && !req.header("x-forwarded-for");
  }
  if (!ok) { res.status(404).end(); return; }
  if (req.query.reset === "1") resetReadStats();
  res.json(readStats(Number(req.query.top) || 50));
});
// Stripe Billing webhook — must see the RAW body for signature verification,
// so it mounts before the JSON parser (its router does its own raw parsing).
app.use("/api/stripe/webhook", stripeWebhook);
// Resend inbound webhook — Svix-signed, so it needs the raw body too.
app.use("/api/emails/inbound/resend", emailsResendInbound);

// Listings now store the operator's whole draft, so the 100kb default was
// nowhere near enough — a listing with any real content 500'd on save.
// Firestore caps a document at 1MB, so anything past this can't be stored
// anyway and gets a clear error rather than a size failure.
app.use(express.json({ limit: "2mb" }));
// Any successful write empties the Add-on orders summaries cache, so the month tally can never disagree with the per-day list after a cancel.
app.use(kitCacheInvalidator);
// Families (and anyone signed out) never receive a booking's checkoutId, on any route: decided per response, once the caller's role is known.
app.use(stripCheckoutIdForFamilies);
// gzip every JSON / text response ≥ 1 KB (res.send / res.json only — the SSE stream and images are left alone).
app.use(gzipResponses);

app.get("/health", (_req, res) => res.json({ ok: true }));

// Internal only, no user auth: an offline import/migration script (server/src/oak/*.ts) writes hub content
// (hubTopics/hubNotes/hubQuestions/hubAssessments/hubFlashcards) directly to Firestore, in a SEPARATE process
// from the running API — it has no way to call this process's own in-memory hub cache (lib/hubCache.ts:
// forgetHub/patchHub). Without this, the API keeps serving its last cached copy of that tenant's assessments/
// notes/topics (up to TTL_INDEX/TTL_TOPICS, 20 min) even though the new content already exists in Firestore —
// e.g. a lesson's freshly-linked exit quiz silently missing from GET /notes/:id/lesson-questions (`quiz: null`,
// no error) until the cache happens to refresh. A script calls this once per tenant right after it finishes
// writing. Gated on HUB_CACHE_ADMIN_KEY (unset in prod by default = always refused): set it in the same shell
// a script runs from, matching the API it's pointed at.
app.post("/internal/hub-cache/forget", (req, res) => {
  const key = process.env.HUB_CACHE_ADMIN_KEY;
  if (!key || req.headers["x-admin-key"] !== key) { res.status(404).end(); return; }
  const tenantId = typeof req.body?.tenantId === "string" ? req.body.tenantId : "";
  if (!tenantId) { res.status(400).json({ error: "tenantId required" }); return; }
  forgetHub(tenantId);
  res.json({ ok: true });
});

// Interactive API docs (no auth) — spec lives in server/openapi.yaml.
const here = path.dirname(fileURLToPath(import.meta.url));
const openapi = parseYaml(fs.readFileSync(path.resolve(here, "../openapi.yaml"), "utf8"));
// Not in production: the whole API surface, readable by anyone, is a map for an
// attacker and no use to a customer. Set PUBLIC_API_DOCS=1 to serve it anyway.
if (process.env.NODE_ENV !== "production" || process.env.PUBLIC_API_DOCS === "1") {
  app.get("/openapi.json", (_req, res) => res.json(openapi));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));
}

// Public invite preview (GET /api/invites/:token) — the token is the
// secret; a prospective franchise/staff member sees it before signing up.
app.use("/api/invites", rateLimit("invite-preview", 30), invitePreview);

// Realtime stream — authenticates via ?token= itself (EventSource can't set
// headers), so it mounts before the header-based auth middleware. The limit
// only bounds reconnect storms / token guessing (the client retries every 3s).
app.use("/api/events", rateLimit("events", 120), events);

// Images are public (<img> tags can't send Authorization; ids are the
// secret). Uploading them requires an operator account — see routes/uploads.
// Generous: a storefront or gallery pulls many at once.
app.use("/api/images", rateLimit("images", 600), images);
// Email open-tracking pixel — fetched by mail clients, so it can't carry auth.
// Very generous: Gmail/Apple proxies fetch for many recipients from few IPs.
app.use("/api/emails/open", rateLimit("email-open", 1000), emailsOpen);
app.use("/api/emails/unsubscribe", rateLimit("unsubscribe", 30), emailsUnsub);
app.use("/api/public/onboarding-unsub", rateLimit("onboarding-unsub", 30), onboardingUnsub);
// Learning Hub parent digest / homework-reminder opt-out (public: signed link in the email).
app.use("/api/hub-digest", rateLimit("hub-digest-optout", 30), hubDigestPublic);
// Inbound email webhook — called by a mail platform with a shared secret.
app.use("/api/emails/inbound", rateLimit("email-inbound", 300), emailsInbound);

  // Map tiles are public (proxied so the OS key stays server-side; <img>/map
  // tags can't send auth). See routes/geo.ts. Each tile spends OS-key quota;
  // a map view loads dozens, so the limit is only against scraping.
  app.use("/api/geo/tiles", rateLimit("geo-tiles", 1200), tiles);

// Listings are the public storefront: browsing and the /book/{id} page work
// signed-out (anonymous = parent-shaped permissions — live+public feed,
// hidden by direct link, drafts 404). A token still changes what you see
// (?mine=1, own drafts) and writes still require an operator.
// Signed-out callers are rate-limited (scraping the storefront); a signed-in
// operator saving a listing isn't — a bad token is a 401 anyway.
const anonOnly = (limit: express.RequestHandler): express.RequestHandler => (req, res, next) => (req.headers.authorization ? next() : limit(req, res, next));
app.use("/api/listings", anonOnly(rateLimit("listings-public", 300)), optionalAuth, attachRoleOptional, enforceAccess, listings);

// Parent-facing settings for the signed-out booking page (see library.ts).
app.use("/api/public/library", anonOnly(rateLimit("library-public", 300)), optionalAuth, libraryPublic);

// Public invoice pay page — found by unguessable payToken, no account needed.
app.use("/api/public/invoice", rateLimit("public-invoice", 60), invoicePublic);
app.use("/api/public/booking-pay", stripCheckoutId);
app.use("/api/public/booking-pay", rateLimit("public-booking-pay", 60), bookingPayPublic);

// Employment-reference form — the referee is an outsider with no account, so
// the whole exchange rides on the unguessable token. See routes/references.ts.
app.use("/api/public/reference", rateLimit("public-reference", 30), referencePublic);

// Staff certificate "Scan to verify" QR page (/v/{ref}) — an inspector or
// anyone else with the printed cert has no account, so this rides on the
// unguessable ref, same as the two routes above. See routes/credentials.ts.
app.use("/api/public/credentials", rateLimit("public-credentials", 60), credentialsPublic);

// Marketing "Book a demo" lead capture — POST is public (the /demo form).
// The limit is for the public "Book a demo" POST — not HQ reading its own list.
const leadsLimit = rateLimit("leads", 10);
app.use("/api/leads", (req, res, next) => (req.method === "POST" ? leadsLimit(req, res, next) : next()), leadsPublic);

// The /demo page's slot picker — public read of open instances.
app.use("/api/demo-slots", demoSlotsPublic);

// Provider directory for the parent sign-up picker — a parent has no account
// yet, so this must sit above requireAuth. Name + rough location only.
app.use("/api/providers", rateLimit("providers", 120), providersPublic);
// "Is that a real UK postcode?" for the parent sign-up address form (no account exists yet, so above requireAuth). Postcode only, rate limited.
app.get("/api/postcode-recognise", rateLimit("pc-recognise", 60), recogniseHandler);
// Public "which version is running?" check: the Git commit Railway built from (when it deploys from Git) and when this process started.
const STARTED_AT = new Date().toISOString();
app.get("/api/version", (_req, res) => {
  res.json({ commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || null, startedAt: STARTED_AT });
});

// Platform 2FA: `requireAuth` only, deliberately mounted ABOVE attachRole —
// attachRole is what refuses an unverified platform account (see
// middleware/role.ts), so these must stay reachable to a signed-in platform
// user who hasn't verified yet, or verification could never happen.
app.use("/api/auth/2fa", requireAuth, rateLimit("2fa", 20), twoFa);
// HMRC's OAuth redirect after a parent signs in at GOV.UK to link their
// Tax-Free Childcare account. It arrives as a plain browser navigation with
// no Authorization header, so it must sit above requireAuth; the unguessable,
// single-use `state` is what ties it to the parent who started it
// (routes/tfc.ts).
app.use("/api/tfc/callback", rateLimit("tfc-callback", 30), tfcCallback);
// QuickBooks/Xero/Sage's OAuth redirect after a manager authorises the
// connection at the provider — same shape as the TFC callback above: no
// Authorization header, the single-use `state` is the only proof (routes/accounting.ts).
app.use("/api/accounting/callback", rateLimit("accounting-callback", 30), accountingCallback);

app.use("/api", requireAuth, attachRole);
// The subscription wall: a lapsed owner tenant (canceled / past_due / past
// its cancel date) gets 402 on everything except the endpoints that let them
// see and fix their subscription. See middleware/subscription.ts.
app.use("/api", enforceSubscription);
// Setup → Features switches and the Roles & permissions matrix, enforced
// (403 on a switched-off module / an area the staff member's role can't
// reach). See middleware/access.ts + lib/accessMap.ts.
app.use("/api", enforceAccess);
// Tenant scope is enforced inside each route from the authenticated account
// (see middleware/role.ts — the client never sends its own scope).
app.use("/api/bookings", bookings);
app.use("/api/customers", customers);
app.use("/api/blocks", blocks);
app.use("/api/periods", periods);
app.use("/api/passes", passes);
app.use("/api/block-bundles", blockBundles);
app.use("/api/library", library);
app.use("/api/payments", payments);
app.use("/api/registers", registers);
app.use("/api/kit", kit);
app.use("/api/children", children);
app.use("/api/platform/notifications", platformNotifications);
app.use("/api/leads", leads);
// Venture Cycle Project — separate lake/country-park hire feasibility list.
app.use("/api/venture-lakes", ventureLakes);
app.use("/api/ratios", ratios);
app.use("/api/incidents", incidents);
app.use("/api/medications", medications);
app.use("/api/meals", meals);
app.use("/api/moments", moments);
app.use("/api/reconciliation", reconciliation);
app.use("/api/tasks", tasks);
app.use("/api/timetables", timetables);
app.use("/api/trips", trips);
app.use("/api/calendar-events", calendarEvents);
app.use("/api/inventory", inventory);
app.use("/api/shifts", shifts);
app.use("/api/rota", rota);
app.use("/api/timeclock", timeclock);
app.use("/api/payroll", payroll);
app.use("/api/accounting", accounting);
app.use("/api/payroll", payslips); // routes/payslips.ts — real PDF payslips + email, a separate router (no path collisions with the one above)
app.use("/api/payroll", payrollRecords); // routes/payrollRecords.ts — P60/P45 + YTD reconcile/repost
app.use("/api/onboarding", onboarding);
app.use("/api/credentials", credentials);
app.use("/api/staff-announcements", staffAnnouncements);
app.use("/api/leave", leave);
app.use("/api/learning", learning);
app.use("/api/learning", learningCentre); // courses / attempts / certificates (routes/learningCentre.ts)
app.use("/api/media", media); // image+video Storage uploads — 503 unless MEDIA_STORAGE_ENABLED=true (routes/mediaUploads.ts)
app.use("/api/learning-hub", noOakResponse, learningHub);
app.use("/api/reviews", reviews);
app.use("/api/availability", availability);
app.use("/api/dashboard", dashboard);
app.use("/api/growth", growth);
app.use("/api/discounts", discounts);
app.use("/api/splitfees", splitfees);
app.use("/api/franchises", franchises);
app.use("/api/milestones", milestones);
app.use("/api/ho", hoOverview);
app.use("/api/account", account);
app.use("/api/privacy", privacy);
app.use("/api/emails", emails);
app.use("/api/meal-options", mealOptions);
app.use("/api/meal-orders", mealOrders);
app.use("/api/meal-menus", mealMenus);
app.use("/api/documents", documents);
app.use("/api/compliance", compliance);
app.use("/api/expenses", expenses);
app.use("/api/expense-claims", expenseClaims);
app.use("/api/appraisals", appraisals);
app.use("/api/location-staff", locationStaff);
app.use("/api/income", income);
app.use("/api/suppliers", suppliers);
app.use("/api/purchasing", purchasing);
app.use("/api/invoices", invoices);
app.use("/api/subscription", subscription);
app.use("/api/wallet", wallet);
app.use("/api/notifications", notifications);
app.use("/api/posts", posts);
app.use("/api/messages", messages);
app.use("/api/geo", geo);
app.use("/api/uploads", uploads);
// Before /api/my so the file routes aren't shadowed by anything there.
// Tax-Free Childcare (parent side) — mounted before /api/my so its own
// routes win. Parent-only; falls back to the manual reference when HMRC
// isn't configured (routes/tfc.ts).
// Families never see a booking's checkoutId (provider-side plumbing): strip it from everything under /api/my and the public pay link.
app.use("/api/my", stripCheckoutId);
app.use("/api/my/tfc", tfc);
app.use("/api/my/feedback", feedback);
app.use("/api/my/files", childFiles);
app.use("/api/my/referral", referral);
app.use("/api/my/memberships", memberships);
app.use("/api/my", my);
app.use("/api/online-sessions", onlineSessions);
app.use("/api/referrals", referralsAdmin);
app.use("/api/memberships", membershipsAdmin);
app.use("/api/register-role", registerRole);
app.use("/api/invites", invites);
app.use("/api/references", references);
app.use("/api/tenants", tenants);
app.use("/api/me", me);
// Before /api/platform so the general router can't shadow them.
app.use("/api/platform/leads", platformLeads);
app.use("/api/platform/demo-slot-templates", demoSlotTemplates);
app.use("/api/platform/demo-slot-blackouts", demoSlotBlackouts);
app.use("/api/platform/support", platformSupport);
app.use("/api/platform/test-tracker", testTracker);
app.use("/api/support/report", supportReport);
app.use("/api/platform", platform);
app.use("/api/analytics", analytics);
app.use("/api/ai", aiRateLimit, ai); // 20 a minute and 150 a day per user (lib/aiGuards.ts); every call can read ~21 collections and costs a model call

// Surface async route errors as JSON 500s rather than hanging the request.
// (Express identifies error middleware by its 4-arg signature, so the unused
// `next` parameter is required.)
app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    // Body-parser's own errors carry a status; "request entity too large"
    // surfaced as a bare 500 and told the operator nothing.
    const e = err as { type?: string; status?: number };
    if (e?.type === "entity.too.large") {
      res.status(413).json({ error: "That listing is too large to save — try smaller images." });
      return;
    }
    // express.json()'s body-parser throws a SyntaxError with status 400 and
    // type "entity.parse.failed" for malformed JSON — that's a bad request,
    // not a server fault, and used to fall through to the generic 500 below.
    if (e?.type === "entity.parse.failed" || e?.status === 400) {
      res.status(400).json({ error: "That request wasn't valid — please try again." });
      return;
    }
    // A malformed :id in the URL (a "/" in it, "__proto__", ".." or > 1500 bytes) makes Firestore throw INVALID_ARGUMENT before any lookup.
    // That's "no such record", not a server fault — it used to be a 500 that also raised the ops alarm for anyone typing junk in a URL.
    const fsMsg = String((err as Error)?.message ?? "");
    if (/must point to a document|not a valid resource path|longer than 1500 bytes|Resource id .* is invalid|contains a resource id/.test(fsMsg)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    // The database was busy and the retries ran out: say so plainly (503) rather than "Internal server error". Not a fault worth an alarm.
    if (isBusyError(err)) {
      res.status(503).json({ error: BUSY_MESSAGE });
      return;
    }
    // A 500 is a fault: record it and (first occurrence) raise the alarm, so
    // "how would you know at 07:00 on a Monday?" has an answer (d27s3).
    const fault = err as Error;
    void record({
      kind: "request",
      signature: `500:${_req.method} ${(_req.route?.path as string) ?? _req.path}`,
      message: fault?.message ?? String(err),
      stack: fault?.stack,
      context: { method: _req.method, path: _req.originalUrl, role: _req.auth?.role ?? "anon" },
    });
    res.status(500).json({ error: "Internal server error" });
  },
);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  warmLeads();
  // Load the hub's on-disk index snapshots into memory in the background (no Firestore reads), one file at a time, so the first
  // page after a restart is instant and a snapshot still inside its TTL never triggers a rebuild. See lib/hubCache.ts.
  // Pre-warm the two things the FIRST authenticated request otherwise pays for (measured ~4-5 s): the Google signing-cert fetch inside
  // verifyIdToken and the first Firestore round trip (gRPC channel + credentials). Both are best-effort and read nothing of substance.
  void import("./firebase").then(({ auth, db }) => { void auth.verifyIdToken("warm-up").catch(() => undefined); void db.collection("users").doc("__warmup__").get().catch(() => undefined); });
  const t0 = Date.now();
  import("./lib/hubCache").then(({ warmHubCacheFromDisk }) => warmHubCacheFromDisk()).then((n) => console.log(`[hub-cache] warmed ${n} snapshot(s) from disk in ${((Date.now() - t0) / 1000).toFixed(1)}s`)).catch(() => undefined);
});

// Time-based work (calendar reminders, medication due-times, the
// acknowledgement chase, waitlist expiry) runs on the Firestore-locked
// scheduler — safe to start on every instance; exactly one runs each sweep.
// See lib/scheduler.ts + lib/sweeps.ts.
import("./lib/sweeps").then(({ startSweeps }) => startSweeps());

// Crashes that would otherwise end the process without a trace.
installProcessHandlers();

// The watchdog. Runs on the same locked scheduler as everything else (so only
// one instance checks), with a grace period so a fresh deploy isn't reported
// as "never ran". Intervals mirror lib/sweeps.ts — the fast ones are enough to
// prove the scheduler is alive.
const STARTED = Date.now();
import("./lib/scheduler").then(({ sweep }) => {
  sweep("ops-watchdog", 15 * 60_000, async () => {
    if (Date.now() - STARTED < 20 * 60_000) return; // let the sweeps run at least once
    const { checkHeartbeats } = await import("./lib/monitor");
    await checkHeartbeats({
      "calendar-reminders": 60_000,
      "medication-due": 60_000,
      "scheduled-emails": 60_000,
      "waitlist-expiry": 5 * 60_000,
      "day-of-alerts": 10 * 60_000,
    });
  });
});

// Bootstrap the Platform (HQ) super-admin from env, if configured — so
// setting ADMIN_EMAIL / ADMIN_PASSWORD in server/.env is all it takes.
// Idempotent: an existing admin's password is never touched.
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  import("./lib/ensureAdmin")
    .then(({ ensureAdmin }) => ensureAdmin(process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!))
    .then((msg) => console.log(`[bootstrap] ${msg}`))
    .catch((e) => console.error("[bootstrap] admin bootstrap failed:", e));
}
