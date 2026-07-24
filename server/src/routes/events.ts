import { Router } from "express";
import { auth as fbAuth, db } from "../firebase";

// Realtime invalidation stream (SSE) — the first slice of the product
// spec's realtime layer. Each connected client gets Firestore listeners
// scoped EXACTLY like its REST access (same tenant/role isolation); on any
// change the client receives {collection} and refetches through the normal
// authorized endpoints. Data never flows through this channel — only
// "something you can see changed" nudges.
//
// EventSource cannot send an Authorization header, so the Firebase ID token
// arrives as ?token= (verified exactly like the header variant).
//
// Scale note: one set of listeners per connection is fine for now; at real
// scale this becomes shared listeners + fan-out.
export const events = Router();

events.get("/", async (req, res) => {
  const token = req.query.token;
  if (typeof token !== "string" || !token) {
    res.status(401).json({ error: "Missing token" });
    return;
  }
  let decoded;
  try {
    decoded = await fbAuth.verifyIdToken(token);
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  const userSnap = await db.collection("users").doc(decoded.uid).get();
  const u = userSnap.exists ? userSnap.data()! : {};
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
  } else if (tenantId) {
    let bookingsQ: FirebaseFirestore.Query = db
      .collection("bookings")
      .where("tenantId", "==", tenantId);
    if (role === "franchise" && franchiseId)
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
    listen(db.collection("purchaseOrders").where("tenantId", "==", tenantId), "purchaseOrders");
    listen(db.collection("invoices").where("tenantId", "==", tenantId), "invoices");
    listen(db.collection("documents").where("tenantId", "==", tenantId), "documents");
    listen(db.collection("certifications").where("tenantId", "==", tenantId), "certifications");
    listen(db.collection("discountCodes").where("tenantId", "==", tenantId), "discountCodes");
    listen(db.collection("emails").where("tenantId", "==", tenantId), "emails");
    listen(db.collection("mealOptions").where("tenantId", "==", tenantId), "mealOptions");
    listen(db.collection("mealOrders").where("tenantId", "==", tenantId), "mealOrders");
  }

  // Keep intermediaries from closing the idle connection.
  const ping = setInterval(() => res.write(":ping\n\n"), 25_000);

  req.on("close", () => {
    clearInterval(ping);
    for (const u of unsubs) u();
  });
});
