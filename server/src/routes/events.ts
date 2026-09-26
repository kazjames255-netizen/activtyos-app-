import { randomBytes } from "node:crypto";
import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/auth";

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
export const events = Router();

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
  const listen = (q: FirebaseFirestore.Query, name: string) => {
    if (wanted && !wanted.has(name)) return; // page doesn't watch this — skip its reads
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

  if (role === "parent") {
    if (decoded.email)
      listen(db.collection("bookings").where("email", "==", decoded.email), "bookings");
    listen(db.collection("children").where("parentUid", "==", decoded.uid), "children");
    listen(db.collection("listings"), "listings"); // the browse marketplace
    listen(db.collection("blocks"), "blocks"); // availability changes
    listen(db.collection("posts"), "posts"); // providers' newsfeed
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
          listen(db.collection("libraries").where("tenantId", "==", tid), "library");
          // Published day plans from the family's providers.
          listen(db.collection("timetables").where("tenantId", "==", tid), "timetables");
        }
      }
    }
    listen(db.collection("mealOptions"), "mealOptions"); // a booked provider's menu
  } else if (role === "platform") {
    listen(db.collection("tenants"), "tenants");
    listen(db.collection("bookings"), "bookings");
    listen(db.collection("listings"), "listings");
    listen(db.collection("blocks"), "blocks");
    listen(db.collection("leads").where("inPipeline", "==", true), "leads"); // HQ sales pipeline (not the researched prospects)
    listen(db.collection("supportThreads"), "supportThreads"); // HQ inbox
  } else if (tenantId) {
    let bookingsQ: FirebaseFirestore.Query = db
      .collection("bookings")
      .where("tenantId", "==", tenantId);
    if ((role === "franchise" || role === "staff") && franchiseId)
      bookingsQ = bookingsQ.where("franchiseId", "==", franchiseId);
    listen(bookingsQ, "bookings");
    listen(db.collection("listings").where("tenantId", "==", tenantId), "listings");
    listen(db.collection("blocks").where("tenantId", "==", tenantId), "blocks");
    listen(db.collection("periods").where("tenantId", "==", tenantId), "periods");
    listen(db.collection("passes").where("tenantId", "==", tenantId), "passes");
    listen(db.collection("blockBundles").where("tenantId", "==", tenantId), "blockBundles");
    listen(db.collection("invites").where("tenantId", "==", tenantId), "invites");
    listen(db.collection("customers").where("tenantId", "==", tenantId), "customers");
    listen(db.collection("libraries").where("tenantId", "==", tenantId), "library");
    listen(db.collection("supportThreads").where("providerId", "==", tenantId), "supportThreads"); // Message-ActivityOS replies
    listen(db.collection("registers").where("tenantId", "==", tenantId), "registers");
    listen(db.collection("payments").where("tenantId", "==", tenantId), "payments");
    listen(db.collection("ratioGroups").where("tenantId", "==", tenantId), "ratioGroups");
    listen(db.collection("ratioBoards").where("tenantId", "==", tenantId), "ratioBoards");
    listen(db.collection("incidents").where("tenantId", "==", tenantId), "incidents");
    listen(db.collection("medications").where("tenantId", "==", tenantId), "medications");
    listen(db.collection("medicationAdmin").where("tenantId", "==", tenantId), "medicationAdmin");
    listen(db.collection("menus").where("tenantId", "==", tenantId), "menus");
    listen(db.collection("moments").where("tenantId", "==", tenantId), "moments");
    listen(db.collection("tasks").where("tenantId", "==", tenantId), "tasks");
    listen(db.collection("trips").where("tenantId", "==", tenantId), "trips");
    listen(db.collection("shifts").where("tenantId", "==", tenantId), "shifts");
    listen(db.collection("timetables").where("tenantId", "==", tenantId), "timetables");
    listen(db.collection("posts").where("tenantId", "==", tenantId), "posts");
    listen(db.collection("threads").where("tenantId", "==", tenantId), "threads");
    listen(db.collection("messages").where("tenantId", "==", tenantId), "messages");
    listen(db.collection("expenses").where("tenantId", "==", tenantId), "expenses");
    listen(db.collection("income").where("tenantId", "==", tenantId), "income");
    listen(db.collection("suppliers").where("tenantId", "==", tenantId), "suppliers");
    listen(db.collection("purchaseOrders").where("tenantId", "==", tenantId), "purchaseOrders");
    listen(db.collection("invoices").where("tenantId", "==", tenantId), "invoices");
    listen(db.collection("documents").where("tenantId", "==", tenantId), "documents");
    listen(db.collection("certifications").where("tenantId", "==", tenantId), "certifications");
    listen(db.collection("discountCodes").where("tenantId", "==", tenantId), "discountCodes");
    listen(db.collection("emails").where("tenantId", "==", tenantId), "emails");
    listen(db.collection("emailMessages").where("tenantId", "==", tenantId), "emailMessages");
    listen(db.collection("scheduledEmails").where("tenantId", "==", tenantId), "scheduledEmails");
    listen(db.collection("wallet").where("tenantId", "==", tenantId), "wallet");
    listen(db.collection("notifications").where("tenantId", "==", tenantId), "notifications");
    listen(db.collection("mealOptions").where("tenantId", "==", tenantId), "mealOptions");
    listen(db.collection("mealOrders").where("tenantId", "==", tenantId), "mealOrders");
    listen(db.collection("mealMenus").where("tenantId", "==", tenantId), "mealMenus");
    // Milestones — the head-office template is one doc per tenant; progress is
    // one doc per franchise (a franchise only ever watches its own).
    listen(db.collection("milestones").where("tenantId", "==", tenantId), "milestones");
    let progQ: FirebaseFirestore.Query = db.collection("milestoneProgress").where("tenantId", "==", tenantId);
    if (role === "franchise" && franchiseId) progQ = progQ.where("franchiseId", "==", franchiseId);
    listen(progQ, "milestoneProgress");
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
  const ping = setInterval(() => {
    void (async () => {
      try {
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
