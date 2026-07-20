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

  const unsubs: (() => void)[] = [];
  const listen = (q: FirebaseFirestore.Query, name: string) => {
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
  }

  // Keep intermediaries from closing the idle connection.
  const ping = setInterval(() => res.write(":ping\n\n"), 25_000);

  req.on("close", () => {
    clearInterval(ping);
    for (const u of unsubs) u();
  });
});
