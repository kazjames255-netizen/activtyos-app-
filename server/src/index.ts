import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
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
import { library, libraryPublic } from "./routes/library";
import { listings } from "./routes/listings";
import { my } from "./routes/my";
import { images, uploads } from "./routes/uploads";
import { invoices, invoicePublic } from "./routes/invoices";
import { income } from "./routes/income";
import { suppliers } from "./routes/suppliers";
import { incidents } from "./routes/incidents";
import { meals } from "./routes/meals";
import { moments } from "./routes/moments";
import { medications } from "./routes/medications";
import { childFiles } from "./routes/childFiles";
import { referral, referralsAdmin } from "./routes/referral";
import { platform } from "./routes/platform";
import { analytics } from "./routes/analytics";
import { reconciliation } from "./routes/reconciliation";
import { dashboard } from "./routes/dashboard";
import { discounts } from "./routes/discounts";
import { splitfees } from "./routes/splitfees";
import { account } from "./routes/account";
import { privacy } from "./routes/privacy";
import { emails } from "./routes/emails";
import { mealOptions, mealOrders } from "./routes/mealsShop";
import { documents } from "./routes/documents";
import { compliance } from "./routes/compliance";
import { expenses } from "./routes/expenses";
import { purchasing } from "./routes/purchasing";
import { subscription } from "./routes/subscription";
import { wallet } from "./routes/wallet";
import { notifications } from "./routes/notifications";
import { posts } from "./routes/posts";
import { messages } from "./routes/messages";
import { shifts } from "./routes/shifts";
import { tasks } from "./routes/tasks";
import { timetables } from "./routes/timetables";
import { trips } from "./routes/trips";
import { calendarEvents } from "./routes/calendarEvents";
import { inventory } from "./routes/inventory";
import { registerRole } from "./routes/registerRole";
import { geo, tiles } from "./routes/geo";
import { ratios } from "./routes/ratios";
import { registers } from "./routes/registers";
import { payments } from "./routes/payments";
import { me, tenants } from "./routes/tenants";
import { ai } from "./routes/ai";
import { stripeWebhook } from "./routes/stripeWebhook";
import { enforceSubscription } from "./middleware/subscription";
import { platformLeads } from "./routes/platformLeads";
import { platformSupport, supportReport } from "./routes/platformSupport";

const app = express();

app.use(
  cors({
    // 3001 included because Next falls back to it when 3000 is taken.
    origin: process.env.CORS_ORIGIN?.split(",") ?? [
      "http://localhost:3000",
      "http://localhost:3001",
    ],
  }),
);
// Stripe Billing webhook — must see the RAW body for signature verification,
// so it mounts before the JSON parser (its router does its own raw parsing).
app.use("/api/stripe/webhook", stripeWebhook);

// Listings now store the operator's whole draft, so the 100kb default was
// nowhere near enough — a listing with any real content 500'd on save.
// Firestore caps a document at 1MB, so anything past this can't be stored
// anyway and gets a clear error rather than a size failure.
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Interactive API docs (no auth) — spec lives in server/openapi.yaml.
const here = path.dirname(fileURLToPath(import.meta.url));
const openapi = parseYaml(fs.readFileSync(path.resolve(here, "../openapi.yaml"), "utf8"));
app.get("/openapi.json", (_req, res) => res.json(openapi));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));

// Public invite preview (GET /api/invites/:token) — the token is the
// secret; a prospective franchise/staff member sees it before signing up.
app.use("/api/invites", invitePreview);

// Realtime stream — authenticates via ?token= itself (EventSource can't set
// headers), so it mounts before the header-based auth middleware.
app.use("/api/events", events);

// Images are public (<img> tags can't send Authorization; ids are the
// secret). Uploading them requires an operator account — see routes/uploads.
app.use("/api/images", images);

  // Map tiles are public (proxied so the OS key stays server-side; <img>/map
  // tags can't send auth). See routes/geo.ts.
  app.use("/api/geo/tiles", tiles);

// Listings are the public storefront: browsing and the /book/{id} page work
// signed-out (anonymous = parent-shaped permissions — live+public feed,
// hidden by direct link, drafts 404). A token still changes what you see
// (?mine=1, own drafts) and writes still require an operator.
app.use("/api/listings", optionalAuth, attachRoleOptional, listings);

// Parent-facing settings for the signed-out booking page (see library.ts).
app.use("/api/public/library", optionalAuth, libraryPublic);

// Public invoice pay page — found by unguessable payToken, no account needed.
app.use("/api/public/invoice", invoicePublic);

app.use("/api", requireAuth, attachRole);
// The subscription wall: a lapsed owner tenant (canceled / past_due / past
// its cancel date) gets 402 on everything except the endpoints that let them
// see and fix their subscription. See middleware/subscription.ts.
app.use("/api", enforceSubscription);
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
app.use("/api/dashboard", dashboard);
app.use("/api/discounts", discounts);
app.use("/api/splitfees", splitfees);
app.use("/api/account", account);
app.use("/api/privacy", privacy);
app.use("/api/emails", emails);
app.use("/api/meal-options", mealOptions);
app.use("/api/meal-orders", mealOrders);
app.use("/api/documents", documents);
app.use("/api/compliance", compliance);
app.use("/api/expenses", expenses);
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
app.use("/api/my/files", childFiles);
app.use("/api/my/referral", referral);
app.use("/api/my", my);
app.use("/api/referrals", referralsAdmin);
app.use("/api/register-role", registerRole);
app.use("/api/invites", invites);
app.use("/api/tenants", tenants);
app.use("/api/me", me);
// Before /api/platform so the general router can't shadow them.
app.use("/api/platform/leads", platformLeads);
app.use("/api/platform/support", platformSupport);
app.use("/api/support/report", supportReport);
app.use("/api/platform", platform);
app.use("/api/analytics", analytics);
app.use("/api/ai", ai);

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
    res.status(500).json({ error: "Internal server error" });
  },
);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`ActivityOS API listening on http://localhost:${port}`);
});

// Time-based work (calendar reminders, medication due-times, the
// acknowledgement chase, waitlist expiry) runs on the Firestore-locked
// scheduler — safe to start on every instance; exactly one runs each sweep.
// See lib/scheduler.ts + lib/sweeps.ts.
import("./lib/sweeps").then(({ startSweeps }) => startSweeps());

// Bootstrap the Platform (HQ) super-admin from env, if configured — so
// setting ADMIN_EMAIL / ADMIN_PASSWORD in server/.env is all it takes.
// Idempotent: an existing admin's password is never touched.
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  import("./lib/ensureAdmin")
    .then(({ ensureAdmin }) => ensureAdmin(process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!))
    .then((msg) => console.log(`[bootstrap] ${msg}`))
    .catch((e) => console.error("[bootstrap] admin bootstrap failed:", e));
}
