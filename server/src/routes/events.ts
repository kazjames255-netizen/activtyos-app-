import { randomBytes } from "node:crypto";
import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/auth";
import { hubPingRef } from "../lib/hubPing";
import { createSharedListeners } from "../lib/sharedListeners";

// Realtime invalidation stream (SSE) — the first slice of the product
// spec's realtime layer. Each connected client gets Firestore listeners
// scoped EXACTLY like its REST access (same tenant/role isolation); on any
// change the client receives {collection} and refetches through the normal
// authorized endpoints. Data never flows through this channel — only
// "something you can see changed" nudges.
//
// EventSource cannot send an Authorization header, and a raw Firebase ID
// token in the URL leaks into server/proxy access logs and browser history —
// a real bearer credential sitting in plaintext logs. Instead: the client
// authenticates normally (Authorization header) against POST /ticket to mint
// a short-lived, single-use ticket, then opens the EventSource with THAT in
// the query string. The ticket is worthless after ~20s or first use, so
// logging it exposes nothing reusable.
//
// Scale note: one set of listeners per connection is fine for now; at real
// scale this becomes shared listeners + fan-out.
// Learning Hub realtime channels. Each is a tenant-scoped collection; the client
// asks for the ones its mounted views read (lib/realtime.ts). Later milestones
// append their collections HERE (content a family reads) so both sides pick them up.
//
// Two kinds of channel. SMALL collections (homework, lessons, submissions, groups, enrolments) keep a real Firestore
// listener. The BIG ones — a seeded provider has ~700 topics, ~450 notes, ~5,000 questions, ~500 assessments,
// ~4,500 flashcards and thousands of attempts — must never be streamed tenant-wide (attaching a listener reads the whole
// result set, per connection): they are PING channels, fed by one tiny per-tenant document that the hub's write routes
// stamp (lib/hubPing.ts). The client still receives {collection} and refetches through the normal authorized endpoints.
const HUB_DIRECT_CHANNELS = ["hubHomework", "hubSubmissions", "hubLessons", "hubGroups", "hubDoubts"];
const HUB_PING_CHANNELS = ["hubTopics", "hubNotes", "hubQuestions", "hubAssessments", "hubFlashcards", "hubAttempts"];
// What a FAMILY may watch tenant-wide (shared content, not per-family rows).
const HUB_FAMILY_DIRECT = ["hubHomework"];
const HUB_FAMILY_PING = ["hubTopics", "hubNotes"];
const HUB_CHANNELS = new Set(["hubEnrolments", ...HUB_DIRECT_CHANNELS, ...HUB_PING_CHANNELS]);

export const events = Router();

// Listeners whose query is fully fixed by a key (global / tenant / tenant+franchise) are SHARED across every SSE
// connection in this process (lib/sharedListeners.ts): one Firestore listener, fanned out in memory, kept ~60s after
// the last viewer leaves so a reconnect does not re-read the whole result set. Per-user queries are not keyed.
const shared = createSharedListeners(60_000);

const TICKET_TTL_MS = 20_000;
type Ticket = { uid: string; email: string | null; expiresAt: number };
const tickets = new Map<string, Ticket>();

function pruneTickets() {
  const now = Date.now();
  for (const [id, t] of tickets) if (t.expiresAt < now) tickets.delete(id);
}

// Mint a one-time SSE ticket. Authenticated the normal way (Authorization
// header) so it never rides in a URL; the ticket that DOES ride in the
// EventSource URL is short-lived and single-use, so it's not a reusable
// credential even if it ends up in a log line.
events.post("/ticket", requireAuth, (req, res) => {
  pruneTickets();
  if (tickets.size > 5_000) tickets.clear(); // defensive cap; tickets expire in 20s anyway
  const id = randomBytes(24).toString("base64url");
  tickets.set(id, { uid: req.user!.uid, email: req.user!.email ?? null, expiresAt: Date.now() + TICKET_TTL_MS });
  res.json({ ticket: id, expiresIn: TICKET_TTL_MS });
});

events.get("/", async (req, res) => {
  const ticketId = req.query.ticket;
  if (typeof ticketId !== "string" || !ticketId) {
    res.status(401).json({ error: "Missing ticket" });
    return;
  }
  const ticket = tickets.get(ticketId);
  tickets.delete(ticketId); // single-use, whether or not it was valid
  if (!ticket || ticket.expiresAt < Date.now()) {
    res.status(401).json({ error: "Invalid or expired ticket" });
    return;
  }
  const decoded = { uid: ticket.uid, email: ticket.email };
  const userSnap = await db.collection("users").doc(decoded.uid).get();
  const u = userSnap.exists ? userSnap.data()! : {};
  // A switched-off or closed account gets no live updates either — every other
  // route already refuses it (middleware/role attachRole; acceptance d26s6).
  if (u.disabled === true || u.deactivatedAt) { res.status(403).json({ error: "This account has been switched off.", code: "account_disabled" }); return; }
  const role: string = u.role === "provider" ? "freelancer" : (u.role ?? "parent");
  const tenantId: string | null = u.tenantId ?? null;
  const franchiseId: string | null = u.franchiseId ?? null;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (collection: string) => res.write(`data: ${JSON.stringify({ collection })}\n\n`);

  // The client passes ?collections=a,b,c — the collections some mounted view
  // actually watches. We attach listeners for ONLY those (each onSnapshot attach
  // reads that whole collection, so watching all ~35 on every connect is what
  // drains the Firestore read quota). Absent/empty → attach everything (a plain
  // GET of /api/events still behaves as before).
  const wanted = typeof req.query.collections === "string" && req.query.collections.trim()
    ? new Set(req.query.collections.split(",").map((s) => s.trim()).filter(Boolean))
    : null;

  const unsubs: (() => void)[] = [];
  const listen = (q: FirebaseFirestore.Query, name: string, shareKey?: string) => {
    if (wanted && !wanted.has(name)) return; // page doesn't watch this — skip its reads
    if (shareKey) {
      // onSnapshot fires once immediately with the current state — the shared hub skips it for everyone.
      unsubs.push(shared.subscribe(
        `${shareKey}|${name}`,
        (onChange, onError) => q.onSnapshot(() => onChange(), onError),
        () => send(name),
        (err) => console.error(`[events] listener error (${name}):`, err.message),
      ));
      return;
    }
    // onSnapshot fires once immediately with the current state — skip it,
    // clients already loaded their data over REST.
    let first = true;
    unsubs.push(
      q.onSnapshot(
        () => {
          if (first) {
            first = false;
            return;
          }
          send(name);
        },
        (err) => console.error(`[events] listener error (${name}):`, err.message),
      ),
    );
  };

  /** A ping channel: one listener on the tenant's `hubPings` doc; a changed field fires that collection's event. */
  const listenPing = (tid: string, names: string[]) => {
    const want = names.filter((n) => !wanted || wanted.has(n));
    if (!want.length) return;
    let last: Record<string, unknown> = {};
    let first = true;
    unsubs.push(
      hubPingRef(tid).onSnapshot(
        (snap) => {
          const d = (snap.data() ?? {}) as Record<string, unknown>;
          if (!first) for (const n of want) if (d[n] !== last[n]) send(n);
          first = false;
          last = d;
        },
        (err) => console.error("[events] hub ping listener error:", err.message),
      ),
    );
  };

  if (role === "parent") {
    if (decoded.email)
      listen(db.collection("bookings").where("email", "==", decoded.email), "bookings");
    listen(db.collection("children").where("parentUid", "==", decoded.uid), "children");
    // Accidents/incidents (routes/incidents.ts GET /) — scoped to THIS family's
    // own children, same as the REST read. Firestore's `in` operator caps at 10
    // values, so a family with more children needs one listener per chunk of 10
    // (mirrors whereInChunks in lib/firestoreIn.ts). Without this, a newly
    // logged accident never reaches a parent who already has the page open —
    // only a fresh reload (a fresh REST fetch) would ever pick it up, because no
    // Firestore listener was ever attached for this collection on a parent
    // connection (found live, 29 Sept — item 71).
    if (wanted === null || wanted.has("incidents")) {
      const kids = await db.collection("children").where("parentUid", "==", decoded.uid).get();
      const kidIds = [...new Set(kids.docs.map((d) => d.id))];
      for (let i = 0; i < kidIds.length; i += 10) {
        listen(db.collection("incidents").where("childId", "in", kidIds.slice(i, i + 10)), "incidents");
      }
    }
    listen(db.collection("hubAttempts").where("parentUid", "==", decoded.uid), "hubAttempts"); // Learning Hub: their own children's results (a tutor's marking arrives live)
    listen(db.collection("listings"), "listings", "global"); // the browse marketplace
    listen(db.collection("blocks"), "blocks", "global"); // availability changes
    listen(db.collection("posts"), "posts", "global"); // providers' newsfeed
    if (decoded.email) {
      const em = decoded.email.toLowerCase();
      listen(db.collection("threads").where("parentEmail", "==", em), "threads");
      listen(db.collection("messages").where("parentEmail", "==", em), "messages");
      listen(db.collection("mealOrders").where("parentEmail", "==", em), "mealOrders");
      listen(db.collection("wallet").where("email", "==", em), "wallet"); // store credit
      listen(db.collection("notifications").where("email", "==", em), "notifications");
      listen(db.collection("supportThreads").where("email", "==", em), "supportThreads"); // Report-a-problem replies
      // The family's provider library — so Setup → Features/Customer area toggles
      // show up live in their app (only attached if the client is watching it).
      if (wanted === null || wanted.has("library") || wanted.has("timetables")) {
        const bk = await db.collection("bookings").where("email", "==", em).get();
        const tids = [...new Set(bk.docs.map((d) => (d.data() as { tenantId?: string }).tenantId).filter(Boolean) as string[])].slice(0, 5);
        for (const tid of tids) {
          listen(db.collection("libraries").where("tenantId", "==", tid), "library", `t:${tid}`);
          // Published day plans from the family's providers.
          listen(db.collection("timetables").where("tenantId", "==", tid), "timetables", `t:${tid}`);
        }
      }
    }
    // Learning Hub: a family's hub content comes from the providers where one of
    // their children is ENROLLED (not merely booked) — see lib/hubCore.ts.
    if (wanted === null || [...HUB_CHANNELS].some((c) => wanted.has(c))) {
      const enrolQ = db.collection("hubEnrolments").where("parentUid", "==", decoded.uid);
      listen(enrolQ, "hubEnrolments");
      const enr = await enrolQ.get();
      const tids = [...new Set(enr.docs.filter((d) => d.get("active") !== false).map((d) => d.get("tenantId") as string))].slice(0, 10);
      for (const tid of tids) {
        listen(db.collection("libraries").where("tenantId", "==", tid), "library", `t:${tid}`); // the on/off switch
        // Shared content only (per-family rows are filtered below); the big collections arrive as pings.
        for (const c of HUB_FAMILY_DIRECT) listen(db.collection(c).where("tenantId", "==", tid), c, `t:${tid}`);
        listenPing(tid, HUB_FAMILY_PING);
      }
      // A family's OWN submissions and lessons only — never a whole tenant collection, so
      // another family's hand-in or lesson can't ping (or be read by) this connection.
      listen(db.collection("hubSubmissions").where("parentUid", "==", decoded.uid), "hubSubmissions");
      const kidIds = [...new Set(enr.docs.filter((d) => d.get("active") !== false).map((d) => d.get("childId") as string))].slice(0, 10);
      if (kidIds.length) listen(db.collection("hubLessons").where("childIds", "array-contains-any", kidIds), "hubLessons");
    }
    listen(db.collection("mealOptions"), "mealOptions", "global"); // a booked provider's menu
  } else if (role === "platform") {
    listen(db.collection("tenants"), "tenants", "platform");
    listen(db.collection("bookings"), "bookings", "platform");
    listen(db.collection("listings"), "listings", "global");
    listen(db.collection("blocks"), "blocks", "global");
    listen(db.collection("leads").where("inPipeline", "==", true), "leads", "platform"); // HQ sales pipeline (not the researched prospects)
    listen(db.collection("supportThreads"), "supportThreads", "platform"); // HQ inbox
  } else if (tenantId) {
    let bookingsQ: FirebaseFirestore.Query = db
      .collection("bookings")
      .where("tenantId", "==", tenantId);
    if ((role === "franchise" || role === "staff") && franchiseId)
      bookingsQ = bookingsQ.where("franchiseId", "==", franchiseId);
    listen(bookingsQ, "bookings", `t:${tenantId}:${(role === "franchise" || role === "staff") && franchiseId ? franchiseId : "*"}`);
    listen(db.collection("listings").where("tenantId", "==", tenantId), "listings", `t:${tenantId}`);
    listen(db.collection("blocks").where("tenantId", "==", tenantId), "blocks", `t:${tenantId}`);
    listen(db.collection("periods").where("tenantId", "==", tenantId), "periods", `t:${tenantId}`);
    listen(db.collection("passes").where("tenantId", "==", tenantId), "passes", `t:${tenantId}`);
    listen(db.collection("blockBundles").where("tenantId", "==", tenantId), "blockBundles", `t:${tenantId}`);
    listen(db.collection("invites").where("tenantId", "==", tenantId), "invites", `t:${tenantId}`);
    listen(db.collection("customers").where("tenantId", "==", tenantId), "customers", `t:${tenantId}`);
    listen(db.collection("libraries").where("tenantId", "==", tenantId), "library", `t:${tenantId}`);
    listen(db.collection("supportThreads").where("providerId", "==", tenantId), "supportThreads", `t:${tenantId}`); // Message-ActivityOS replies
    listen(db.collection("registers").where("tenantId", "==", tenantId), "registers", `t:${tenantId}`);
    listen(db.collection("payments").where("tenantId", "==", tenantId), "payments", `t:${tenantId}`);
    listen(db.collection("ratioGroups").where("tenantId", "==", tenantId), "ratioGroups", `t:${tenantId}`);
    listen(db.collection("ratioBoards").where("tenantId", "==", tenantId), "ratioBoards", `t:${tenantId}`);
    listen(db.collection("incidents").where("tenantId", "==", tenantId), "incidents", `t:${tenantId}`);
    listen(db.collection("medications").where("tenantId", "==", tenantId), "medications", `t:${tenantId}`);
    listen(db.collection("medicationAdmin").where("tenantId", "==", tenantId), "medicationAdmin", `t:${tenantId}`);
    listen(db.collection("menus").where("tenantId", "==", tenantId), "menus", `t:${tenantId}`);
    listen(db.collection("moments").where("tenantId", "==", tenantId), "moments", `t:${tenantId}`);
    listen(db.collection("tasks").where("tenantId", "==", tenantId), "tasks", `t:${tenantId}`);
    for (const c of ["hubEnrolments", ...HUB_DIRECT_CHANNELS]) listen(db.collection(c).where("tenantId", "==", tenantId), c, `t:${tenantId}`);
    // Learning Hub big collections: pings, not streams. The marking queue (hubAttempts) is for tenant-level accounts only.
    listenPing(tenantId, franchiseId ? HUB_PING_CHANNELS.filter((c) => c !== "hubAttempts") : HUB_PING_CHANNELS);
    listen(db.collection("trips").where("tenantId", "==", tenantId), "trips", `t:${tenantId}`);
    listen(db.collection("shifts").where("tenantId", "==", tenantId), "shifts", `t:${tenantId}`);
    listen(db.collection("timetables").where("tenantId", "==", tenantId), "timetables", `t:${tenantId}`);
    listen(db.collection("posts").where("tenantId", "==", tenantId), "posts", `t:${tenantId}`);
    listen(db.collection("threads").where("tenantId", "==", tenantId), "threads", `t:${tenantId}`);
    listen(db.collection("messages").where("tenantId", "==", tenantId), "messages", `t:${tenantId}`);
    listen(db.collection("expenses").where("tenantId", "==", tenantId), "expenses", `t:${tenantId}`);
    listen(db.collection("income").where("tenantId", "==", tenantId), "income", `t:${tenantId}`);
    listen(db.collection("suppliers").where("tenantId", "==", tenantId), "suppliers", `t:${tenantId}`);
    listen(db.collection("purchaseOrders").where("tenantId", "==", tenantId), "purchaseOrders", `t:${tenantId}`);
    listen(db.collection("invoices").where("tenantId", "==", tenantId), "invoices", `t:${tenantId}`);
    listen(db.collection("documents").where("tenantId", "==", tenantId), "documents", `t:${tenantId}`);
    listen(db.collection("certifications").where("tenantId", "==", tenantId), "certifications", `t:${tenantId}`);
    listen(db.collection("discountCodes").where("tenantId", "==", tenantId), "discountCodes", `t:${tenantId}`);
    listen(db.collection("emails").where("tenantId", "==", tenantId), "emails", `t:${tenantId}`);
    listen(db.collection("emailMessages").where("tenantId", "==", tenantId), "emailMessages", `t:${tenantId}`);
    listen(db.collection("scheduledEmails").where("tenantId", "==", tenantId), "scheduledEmails", `t:${tenantId}`);
    listen(db.collection("wallet").where("tenantId", "==", tenantId), "wallet", `t:${tenantId}`);
    listen(db.collection("notifications").where("tenantId", "==", tenantId), "notifications", `t:${tenantId}`);
    listen(db.collection("mealOptions").where("tenantId", "==", tenantId), "mealOptions", `t:${tenantId}`);
    listen(db.collection("mealOrders").where("tenantId", "==", tenantId), "mealOrders", `t:${tenantId}`);
    listen(db.collection("mealMenus").where("tenantId", "==", tenantId), "mealMenus", `t:${tenantId}`);
    // Milestones — the head-office template is one doc per tenant; progress is
    // one doc per franchise (a franchise only ever watches its own).
    listen(db.collection("milestones").where("tenantId", "==", tenantId), "milestones", `t:${tenantId}`);
    let progQ: FirebaseFirestore.Query = db.collection("milestoneProgress").where("tenantId", "==", tenantId);
    if (role === "franchise" && franchiseId) progQ = progQ.where("franchiseId", "==", franchiseId);
    listen(progQ, "milestoneProgress", `t:${tenantId}:${role === "franchise" && franchiseId ? franchiseId : "*"}`);
  }

  const close = () => {
    clearInterval(ping);
    for (const u of unsubs) u();
    unsubs.length = 0;
    res.end();
  };

  // Keep intermediaries from closing the idle connection — and re-check, on the
  // same beat, that the account is still allowed to listen. The check used to
  // run ONLY at connect, so switching someone off left their open stream
  // delivering updates indefinitely (every REST refetch 401s, but the stream
  // itself never stopped). One read per account per 25s while connected.
  // The account re-check is a billed read, so it runs on every 4th beat (~100s) rather than every 25s — still bounded,
  // and 75% fewer reads per open tab. The ":ping" keep-alive itself still goes out every 25s.
  let beats = 0;
  const ping = setInterval(() => {
    void (async () => {
      try {
        if (beats++ % 4 !== 0) { res.write(":ping\n\n"); return; }
        const snap = await db.collection("users").doc(decoded.uid).get();
        const cur = snap.exists ? snap.data()! : {};
        if (!snap.exists || cur.disabled === true || cur.deactivatedAt) {
          console.log(`[events] closing stream for ${decoded.uid} — account switched off`);
          close();
          return;
        }
      } catch { /* a transient read failure must not drop a good stream */ }
      res.write(":ping\n\n");
    })();
  }, 25_000);

  req.on("close", () => {
    clearInterval(ping);
    for (const u of unsubs) u();
  });
});
