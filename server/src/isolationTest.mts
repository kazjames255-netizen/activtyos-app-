// Multi-tenant isolation test — the product spec's required proof that
// "Provider A cannot load Provider B's data". Run against the Firebase
// emulators + a running API:
//
//   npx firebase-tools@13 emulators:start --only auth,firestore --project demo-activityos
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//     npm run start   (or dev)
//   npm run test:isolation
//
// Exits non-zero on any failure.

const API = process.env.API_URL || "http://localhost:4000";
const AUTH_EMU = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.error(`  ✗ ${label}`, detail ?? "");
  }
}

async function signUp(email: string): Promise<string> {
  const r = await fetch(
    `http://${AUTH_EMU}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "test1234", returnSecureToken: true }),
    },
  );
  const d = (await r.json()) as { idToken?: string; error?: { message: string } };
  if (!d.idToken) throw new Error(`signUp failed for ${email}: ${d.error?.message}`);
  return d.idToken;
}

async function api(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await r.json();
  } catch {
    /* empty body */
  }
  return { status: r.status, json };
}

const run = Date.now();
const em = (n: string) => `iso-${run}-${n}@test.com`;

console.log("Provisioning tenants A and B…");
const ownerA = await signUp(em("owner-a"));
const ownerB = await signUp(em("owner-b"));
const provA = await api(ownerA, "POST", "/api/register-role", {
  role: "company",
  businessName: "Tenant A Ltd",
});
const provB = await api(ownerB, "POST", "/api/register-role", {
  role: "freelancer",
  businessName: "Tenant B Solo",
});
check("tenant A provisioned", provA.status === 201, provA);
check("tenant B provisioned", provB.status === 201, provB);

// Each creates a listing + block and a booking in their own tenant.
const listA = await api(ownerA, "POST", "/api/listings", {
  name: "A Camp",
  passes: [{ name: "Day", price: 10 }],
});
await api(ownerB, "POST", "/api/listings", {
  name: "B Camp",
  passes: [{ name: "Day", price: 20 }],
});
const blockA = await api(ownerA, "POST", "/api/blocks", {
  listingId: (listA.json as { id: string }).id,
  name: "Week 1",
  startDate: "2027-07-26",
  endDate: "2027-07-30",
  capacity: 2,
  schedule: { startTime: "09:00", endTime: "15:30" },
});
check("tenant A created a block (capacity 2)", blockA.status === 201, blockA);
const blockAId = (blockA.json as { id: string }).id;
const bookA = await api(ownerA, "POST", "/api/bookings", {
  booker: "Alice",
  email: em("parent-of-a"),
  child: "Kid A",
  age: 7,
  listing: "A Camp",
  pass: "Day",
  blockId: blockAId,
  amount: 10,
  method: "Card",
});
check("tenant A created a booking in the block", bookA.status === 201, bookA);
const refA = (bookA.json as { ref: string }).ref;

console.log("\nCross-tenant isolation…");
const listB4A = await api(ownerB, "GET", "/api/bookings");
const bBookings = listB4A.json as { ref: string; tenantId?: string }[];
check(
  "B's booking list contains none of A's data",
  listB4A.status === 200 && !bBookings.some((b) => b.ref === refA),
  bBookings,
);
const readA = await api(ownerB, "GET", `/api/bookings/${refA}`);
check("B cannot fetch A's booking by ref", readA.status === 404, readA);
const mutA = await api(ownerB, "POST", `/api/bookings/${refA}/actions`, { type: "approve" });
check("B cannot mutate A's booking", mutA.status === 404, mutA);
const bulkA = await api(ownerB, "POST", "/api/bookings/bulk", {
  refs: [refA],
  action: "cancel",
});
check(
  "B's bulk action silently skips A's refs",
  bulkA.status === 200 && (bulkA.json as unknown[]).length === 0,
  bulkA.json,
);
const custB = await api(ownerB, "GET", "/api/customers");
check(
  "B sees no customers of A",
  custB.status === 200 && (custB.json as unknown[]).length === 0,
  custB.json,
);

console.log("\nFranchise sub-isolation…");
const invF = await api(ownerA, "POST", "/api/invites", { role: "franchise" });
check("A created a franchise invite", invF.status === 201, invF);
const franToken = await signUp(em("franchise-a1"));
const accF = await api(franToken, "POST", `/api/invites/${(invF.json as { token: string }).token}/accept`, {});
check("franchise joined tenant A", accF.status === 200, accF);
const franList = await api(franToken, "GET", "/api/bookings");
check(
  "franchise sees NONE of HQ's direct bookings (own subset only)",
  franList.status === 200 && (franList.json as unknown[]).length === 0,
  franList.json,
);
const franBook = await api(franToken, "POST", "/api/bookings", {
  booker: "Fran",
  email: em("parent-of-f"),
  child: "Kid F",
  age: 8,
  listing: "A Camp",
  pass: "Day",
  dates: "Week 1",
  amount: 10,
  method: "Card",
});
check("franchise takes a booking", franBook.status === 201, franBook);
const hqList = await api(ownerA, "GET", "/api/bookings");
check(
  "HQ (company) sees the franchise's booking too",
  hqList.status === 200 &&
    (hqList.json as { ref: string }[]).some((b) => b.ref === (franBook.json as { ref: string }).ref),
);
const franMutHq = await api(franToken, "POST", `/api/bookings/${refA}/actions`, { type: "approve" });
check("franchise cannot mutate HQ's direct booking", franMutHq.status === 404, franMutHq);

console.log("\nStaff read-only…");
const invS = await api(ownerA, "POST", "/api/invites", { role: "staff" });
const staffToken = await signUp(em("staff-a1"));
await api(staffToken, "POST", `/api/invites/${(invS.json as { token: string }).token}/accept`, {});
const staffList = await api(staffToken, "GET", "/api/bookings");
check("staff reads tenant A bookings", staffList.status === 200 && (staffList.json as unknown[]).length > 0);
const staffMut = await api(staffToken, "POST", `/api/bookings/${refA}/actions`, { type: "approve" });
check("staff cannot mutate", staffMut.status === 403, staffMut);

console.log("\nParent boundaries…");
const parentT = await signUp(em("parent-x"));
await api(parentT, "POST", "/api/register-role", { role: "parent" });
const parOnOps = await api(parentT, "GET", "/api/bookings");
check("parent gets 403 on operator bookings", parOnOps.status === 403, parOnOps);
const parBook = await api(parentT, "POST", "/api/my/bookings", {
  listingId: (listA.json as { id: string }).id,
  blockId: blockAId,
  pass: "Day",
  child: "Kid X",
  age: 6,
  method: "Card",
});
check("parent books tenant A's listing/block", parBook.status === 201, parBook);
const parCancelForeign = await api(parentT, "POST", `/api/my/bookings/${refA}/cancel`, {});
check("parent cannot cancel another family's booking", parCancelForeign.status === 404, parCancelForeign);

console.log("\nBlocks: isolation + capacity + waitlist…");
const bBlocksView = await api(ownerB, "GET", "/api/blocks");
check(
  "B's block list contains none of A's blocks",
  bBlocksView.status === 200 && !(bBlocksView.json as { id: string }[]).some((x) => x.id === blockAId),
);
const bEditA = await api(ownerB, "PUT", `/api/blocks/${blockAId}`, {
  listingId: (listA.json as { id: string }).id,
  name: "Hijack",
  startDate: "2027-07-26",
  endDate: "2027-07-30",
  capacity: 99,
  schedule: { startTime: "09:00", endTime: "10:00" },
});
check("B cannot edit A's block", bEditA.status === 404, bEditA);

// Capacity 2: refA (Confirmed) + parent booking (Approval needed) fill it.
const overflow = await api(parentT, "POST", "/api/my/bookings", {
  listingId: (listA.json as { id: string }).id,
  blockId: blockAId,
  pass: "Day",
  child: "Kid Y",
  age: 5,
  method: "Card",
});
check(
  "third booking auto-waitlists when the block is full",
  overflow.status === 201 && (overflow.json as { status: string }).status === "Waitlisted",
  overflow.json,
);
const fullBlock = await api(ownerA, "GET", "/api/blocks");
const fb = (fullBlock.json as { id: string; bookedCount: number; spotsLeft: number }[]).find(
  (x) => x.id === blockAId,
);
check("bookedCount reflects only counted bookings (2)", fb?.bookedCount === 2, fb);

// Cancelling a counted booking frees a place.
await api(ownerA, "POST", `/api/bookings/${refA}/actions`, {
  type: "cancel",
  refund: "none",
});
const afterCancel = await api(ownerA, "GET", "/api/blocks");
const ac = (afterCancel.json as { id: string; spotsLeft: number }[]).find((x) => x.id === blockAId);
check("cancel frees a place (spotsLeft 1)", ac?.spotsLeft === 1, ac);

// Promoting the waitlisted booking takes the freed place.
const promo = await api(ownerA, "POST", `/api/bookings/${(overflow.json as { ref: string }).ref}/actions`, {
  type: "promote",
});
check("waitlisted booking promoted", promo.status === 200 && (promo.json as { status: string }).status === "Confirmed");
const afterPromo = await api(ownerA, "GET", "/api/blocks");
const ap = (afterPromo.json as { id: string; spotsLeft: number }[]).find((x) => x.id === blockAId);
check("promotion consumes the place again (spotsLeft 0)", ap?.spotsLeft === 0, ap);

// Deleting a block with active bookings must refuse.
const delBusy = await api(ownerA, "DELETE", `/api/blocks/${blockAId}`);
check("deleting a block with bookings → 409", delBusy.status === 409, delBusy);

// Attendees endpoint (register foundation).
const att = await api(ownerA, "GET", `/api/blocks/${blockAId}/attendees`);
const attendees = (att.json as { attendees: { children: { name: string }[] }[] }).attendees ?? [];
check(
  "attendees endpoint lists booked children",
  att.status === 200 && attendees.some((x) => x.children.some((c) => c.name === "Kid X")),
  att.json,
);
const attB = await api(ownerB, "GET", `/api/blocks/${blockAId}/attendees`);
check("B cannot read A's attendees", attB.status === 404, attB);

console.log("\nInvite hygiene…");
const reuse = await api(await signUp(em("late-staff")), "POST", `/api/invites/${(invS.json as { token: string }).token}/accept`, {});
check("used invite cannot be reused", reuse.status === 410, reuse);
const franInviteFran = await api(franToken, "POST", "/api/invites", { role: "franchise" });
check("franchise cannot invite another franchise", franInviteFran.status === 403, franInviteFran);

console.log(failures === 0 ? "\nALL ISOLATION CHECKS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
