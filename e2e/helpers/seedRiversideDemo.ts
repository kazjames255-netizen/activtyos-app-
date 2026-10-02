// Seeds REALISTIC DEMO DATA ("Riverside Sports Club") into the standing e2e company tenant so the product-tour video shows a believable provider.
// Idempotent: run it as often as you like (re-uses what exists, skips duplicates). Run from server/ (so dotenv + firebase-admin resolve):
//   cd server && npx tsx ../e2e/helpers/seedRiversideDemo.ts
// Uses the API (as the e2e company owner) for everything it can; the Admin SDK only for the tenant display name and for setting each block's
// booked-count/day-counts to the demo headline figures. Refuses any tenant that is not an all-@activityos-test.com tenant. All family emails are
// @activityos-test.com or example.com; MAIL_LIVE must be unset (nothing is ever sent for real). NI numbers are HMRC's reserved QQ test prefix.
import "../../server/node_modules/dotenv/config";
import { db } from "../../server/src/firebase";
import { apiFetch, apiPost, fbSignIn } from "./accounts";
import { loadAccounts, ROOT } from "./env";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

if (process.env.MAIL_LIVE === "1") throw new Error("refusing to seed with MAIL_LIVE set");

const BIZ = "Riverside Sports Club";
const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const monday = () => { const d = new Date(); const back = (d.getDay() + 6) % 7; return -back; }; // offset to this week's Monday
const tryJson = async <T>(p: Promise<T>): Promise<T | null> => p.catch((e) => { console.warn("  skip:", String(e.message).slice(0, 140)); return null; });

type Listing = { id: string; title: string; blocks?: { id: string; sessions: { date: string }[] }[] };
type Fam = { parent: string; email: string; phone: string; kids: { name: string; age: number; allergies?: string; medical?: string }[] };

const FAMILIES: Fam[] = [
  { parent: "Sarah Whitfield", email: "sarah.whitfield@example.com", phone: "07700 900101", kids: [{ name: "Oliver Whitfield", age: 8, allergies: "Peanuts (carries EpiPen)" }, { name: "Poppy Whitfield", age: 6 }] },
  { parent: "James Okafor", email: "james.okafor@example.com", phone: "07700 900102", kids: [{ name: "Daniel Okafor", age: 9 }] },
  { parent: "Priya Nair", email: "priya.nair@example.com", phone: "07700 900103", kids: [{ name: "Anika Nair", age: 7 }] },
  { parent: "Emma Hargreaves", email: "emma.hargreaves@example.com", phone: "07700 900104", kids: [{ name: "Freddie Hargreaves", age: 10 }, { name: "Isla Hargreaves", age: 8 }] },
  { parent: "Mohammed Rahman", email: "mohammed.rahman@example.com", phone: "07700 900105", kids: [{ name: "Zayn Rahman", age: 11, medical: "Asthma (inhaler in bag)" }] },
  { parent: "Claire Donovan", email: "claire.donovan@example.com", phone: "07700 900106", kids: [{ name: "Maisie Donovan", age: 6 }] },
  { parent: "Tom Pritchard", email: "tom.pritchard@example.com", phone: "07700 900107", kids: [{ name: "Alfie Pritchard", age: 9 }, { name: "Rosie Pritchard", age: 7 }] },
  { parent: "Helen Baptiste", email: "helen.baptiste@example.com", phone: "07700 900108", kids: [{ name: "Jaden Baptiste", age: 10 }] },
  { parent: "Rachel Kingston", email: "rachel.kingston@activityos-test.com", phone: "07700 900109", kids: [{ name: "Lily Kingston", age: 8 }] },
  { parent: "Andrew McAllister", email: "andrew.mcallister@example.com", phone: "07700 900110", kids: [{ name: "Ewan McAllister", age: 11 }] },
  { parent: "Fatima Hussain", email: "fatima.hussain@example.com", phone: "07700 900111", kids: [{ name: "Amina Hussain", age: 7 }] },
  { parent: "Lucy Brennan", email: "lucy.brennan@activityos-test.com", phone: "07700 900112", kids: [{ name: "Theo Brennan", age: 9 }, { name: "Grace Brennan", age: 6 }] },
];
const kid = (n: string) => FAMILIES.flatMap((f) => f.kids.map((k) => ({ ...k, fam: f }))).find((k) => k.name === n)!;

// listing, headline booked count, capacity
const LISTINGS = [
  { key: "camp", img: "company-1", policy: "standard", title: "October Half-Term Multi-Activity Camp", price: 45, cap: 50, booked: 41, from: 24, to: 28, days: [1, 2, 3, 4, 5], start: "09:00", end: "15:30", desc: "A full day of sport, crafts and games for ages 5-12." },
  { key: "football", img: "company-3", policy: "flexible", title: "After-School Football Club", price: 8, cap: 30, booked: 28, from: monday(), to: monday() + 25, days: [1, 2, 3, 4, 5], start: "15:30", end: "17:00", desc: "Coached football sessions after school." },
  { key: "art", img: "staff", policy: "standard", title: "Holiday Art Club", price: 30, cap: 30, booked: 22, from: 24, to: 28, days: [1, 2, 3, 4, 5], start: "10:00", end: "14:00", desc: "Painting, clay and collage." },
  { key: "tennis", img: "freelancer-1", policy: "strict", title: "Junior Tennis Camp", price: 40, cap: 24, booked: 17, from: 24, to: 28, days: [1, 2, 3, 4, 5], start: "09:30", end: "15:00", desc: "Coaching for beginners to improvers." },
  { key: "ballet", img: "freelancer-2", policy: "flexible", title: "Ballet & Dance", price: 12, cap: 3, booked: 3, from: monday(), to: monday() + 25, days: [5], start: "16:00", end: "17:00", desc: "Weekly ballet and street-dance class.", waitlist: true },
] as const;

// who books what: [child, listing key, paid?, method]
const BOOKINGS: [string, string, "paid" | "unpaid" | "wait", string][] = [
  ["Oliver Whitfield", "camp", "paid", "Card"], ["Poppy Whitfield", "camp", "paid", "Card"], ["Daniel Okafor", "camp", "paid", "Card"],
  ["Anika Nair", "art", "paid", "Card"], ["Freddie Hargreaves", "football", "paid", "Card"], ["Isla Hargreaves", "art", "paid", "Card"],
  ["Zayn Rahman", "football", "paid", "Card"], ["Maisie Donovan", "ballet", "paid", "Card"], ["Alfie Pritchard", "tennis", "paid", "Card"],
  ["Rosie Pritchard", "ballet", "paid", "Card"], ["Jaden Baptiste", "football", "paid", "Card"], ["Lily Kingston", "ballet", "paid", "Card"],
  ["Ewan McAllister", "tennis", "unpaid", "Bank transfer"], ["Amina Hussain", "camp", "unpaid", "Bank transfer"], ["Theo Brennan", "football", "paid", "Tax-Free Childcare"],
  ["Grace Brennan", "camp", "paid", "Tax-Free Childcare"], ["Amina Hussain", "ballet", "wait", "Card"],
];

(async () => {
  const { accounts } = loadAccounts();
  const acc = accounts.company;
  const tenantId = acc.tenantId!;
  // safety: only ever the throwaway test tenant
  const owners = await db.collection("users").where("tenantId", "==", tenantId).get();
  if (!owners.docs.length || !owners.docs.every((d) => /@activityos-test\.com$/.test(String(d.get("email") ?? "")))) throw new Error(`refusing: ${tenantId} is not an all-@activityos-test.com tenant`);
  const tok = (await fbSignIn(acc.email)).idToken;
  const A = <T>(p: string, init?: RequestInit) => apiFetch<T>(p, tok, init);
  const P = <T>(p: string, b: unknown) => apiPost<T>(p, tok, b);
  const PUT = <T>(p: string, b: unknown) => A<T>(p, { method: "PUT", body: JSON.stringify(b) });

  // ── reset: this tenant is a throwaway e2e fixture, so clear what earlier suites left behind (E2E-named junk) and any previous run of this seed.
  // Allow-list of tenant-scoped collections only; accounts, the tenant doc, library/settings, billing and the learning hub are never touched.
  const WIPE = ["absences", "availabilityPatterns", "availabilityRequests", "blockBundles", "blocks", "bookings", "broadcasts", "calendarEvents", "certifications", "childFiles", "children", "clockRecords", "credentialRecords", "customerGroups", "customers", "discountCodes", "discountRedemptions", "docFiles", "emailMessages", "emails", "expenses", "groupings", "incidents", "incidentsOps", "income", "inventory", "invoices", "learningAssignments", "learningCompletions", "listings", "memberships", "messageFolders", "messageTemplates", "messages", "milestones", "moments", "notifications", "onboardFiles", "onboardRecords", "passes", "payments", "payrollAuditLog", "payrollConfig", "payrollRuns", "payrollYtd", "payrollYtdPosts", "payslipPdfs", "periods", "posts", "purchaseOrders", "ratioBoards", "references", "referrals", "registers", "reviews", "rotaShifts", "rotas", "scheduledEmails", "staffAnnouncements", "suppliers", "tasks", "threads", "timetables", "trips", "wallet", "walletEntries", "learningCourses", "learningAttempts", "learningCertificates", "medications", "medicationAdmin"];
  let wiped = 0;
  for (const c of WIPE) {
    const snap = await db.collection(c).where("tenantId", "==", tenantId).get();
    for (let i = 0; i < snap.docs.length; i += 400) { const b = db.batch(); snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit(); }
    wiped += snap.size;
  }
  console.log("reset: removed", wiped, "old demo/e2e docs");

  // ── business identity + venue
  await db.collection("tenants").doc(tenantId).set({ name: BIZ }, { merge: true });
  const lib = ((await A<Record<string, unknown> | null>("/api/library")) ?? {}) as { venues?: { id: string }[]; settings?: Record<string, unknown> };
  const venueId = "riverside-hall";
  const venues: { id: string }[] = [];
  const settings = { ...(lib.settings ?? {}), providerName: BIZ, marketplaceListed: false, memberships: {
    enabled: true,
    tiers: [
      { id: "silver", name: "Riverside Silver", enabled: true, priceMonthly: 0, benefitType: "percent", benefitValue: 10, perks: ["10% off every booking at checkout"] },
      { id: "gold", name: "Riverside Gold", enabled: true, priceMonthly: 0, benefitType: "credit", benefitValue: 50, perks: ["GBP 50 wallet credit to spend on any booking"] },
    ],
  }, billing: { ...((lib.settings?.billing as object) ?? {}), businessName: BIZ } };
  await PUT("/api/library", { venues: [...venues, { id: venueId, name: "Riverside Sports Hall", address: "14 Mill Lane", city: "Northampton" }], settings });
  console.log("business + venue ok");

  // ── cover photos: existing marketing photos from public/images, shrunk to ~640px and uploaded through the normal /api/uploads flow
  const photoUrl: Record<string, string> = {};
  const upload = async (name: string) => {
    if (photoUrl[name]) return photoUrl[name];
    const out = path.join(os.tmpdir(), `riverside-${name}.jpg`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", path.join(ROOT, "public/images", `${name}.jpg`), "-vf", "scale=640:-2", "-q:v", "6", out]);
    const r = await P<{ url: string }>("/api/uploads", { dataUrl: `data:image/jpeg;base64,${fs.readFileSync(out).toString("base64")}`, purpose: "public" });
    return (photoUrl[name] = r.url);
  };

  // ── listings (+ blocks via bundle), reuse by title
  const existing = (await A<(Listing & { tenantId?: string })[]>("/api/listings")).filter((x) => x.tenantId === tenantId); // the endpoint also returns other tenants' public listings
  const L: Record<string, Listing> = {};
  for (const l of LISTINGS) {
    let found = existing.find((x) => x.title === l.title);
    if (!found) {
      const period = await P<{ id: string }>("/api/periods", { title: l.title.slice(0, 40), start: l.start, finish: l.end });
      const pass = await P<{ id: string }>("/api/passes", { name: "Day pass", days: 1 });
      const bundle = await P<{ id: string }>("/api/block-bundles", { name: `${l.title} blocks`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: l.price, calcOn: true });
      const created = await P<{ id: string }>("/api/listings", {
        title: l.title, venueId, runFrom: day(l.from), runTo: day(l.to), blockMode: "weekly", days: [...l.days], maxAttendees: String(l.cap), capacityScope: "listing",
        ...("waitlist" in l ? { waitlist: true, waitlistMode: "manual" } : {}), showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id,
        passes: [{ name: "Day pass", price: l.price, days: 1 }], bookingType: "auto", status: "live", visibility: "public", description: l.desc,
        images: [{ src: await upload(l.img), x: 50, y: 50, zoom: 100 }], cancellationPolicyId: l.policy,
      });
      await PUT(`/api/block-bundles/${bundle.id}/listings`, { listingIds: [created.id] });
      found = { id: created.id, title: l.title };
    }
    L[l.key] = (await A<Listing>(`/api/listings/${found.id}`));
    console.log(" listing", l.title, (L[l.key].blocks ?? []).length, "blocks");
  }

  // ── families + children
  for (const f of FAMILIES) {
    const c = await tryJson(P<{ id: string }>("/api/customers", { name: f.parent, firstName: f.parent.split(" ")[0], lastName: f.parent.split(" ").slice(1).join(" "), email: f.email, phone: f.phone, marketingOptIn: true }));
    const id = c?.id ?? ((await A<{ id: string; email: string }[]>("/api/customers")).find((x) => x.email === f.email)?.id);
    void id; // children details attach once the family signs up; the bookings carry each child
  }
  console.log("families ok");

  // ── bookings
  const refOf: Record<string, string> = {};
  const have = await A<{ ref: string; child: string; listing: string; status: string; pay?: string }[]>("/api/bookings");
  for (const [childName, key, state, method] of BOOKINGS) {
    const l = LISTINGS.find((x) => x.key === key)!;
    const k = kid(childName);
    if (have.some((b) => b.child === childName && b.listing === l.title && b.status !== "Cancelled")) continue;
    const block = L[key].blocks?.[0];
    if (!block) { console.warn("no block for", key); continue; }
    const days = block.sessions.length || 1;
    const amount = l.price * (key === "camp" || key === "tennis" || key === "art" ? days : key === "football" ? 5 : 1);
    const b = await tryJson(P<{ ref: string; status: string }>("/api/bookings", { booker: k.fam.parent, email: k.fam.email, child: childName, age: k.age, listing: l.title, pass: "Day pass", blockId: block.id, amount, method, phone: k.fam.phone }));
    if (!b) continue;
    refOf[`${childName}|${key}`] = b.ref;
    if (/Tax-Free/.test(method)) await tryJson(PUT(`/api/bookings/${b.ref}/payment-ref`, { paymentRef: `TFC-${b.ref.replace(/\D/g, "").padStart(6, "0")}-RSC` }));
    if (state === "paid" && b.status !== "Waitlisted") await tryJson(P(`/api/bookings/${b.ref}/record-payment`, { amount, method: method === "Card" ? "Card" : method, reference: method === "Card" ? "Stripe" : `TFC ${b.ref}`, confirmDuplicate: true }));
  }
  console.log("bookings ok");

  // headline figures: set each block's booked count to the demo number (the rest of the places were taken by families not shown one-by-one)
  for (const l of LISTINGS) {
    for (const d of (await db.collection("blocks").where("listingId", "==", L[l.key].id).where("tenantId", "==", tenantId).get()).docs) {
      const sessions = (d.get("sessions") as { date: string }[]) ?? [];
      const cur = Number(d.get("bookedCount") ?? 0);
      if (cur < l.booked) await d.ref.set({ bookedCount: l.booked, capacity: l.cap, dayCounts: Object.fromEntries(sessions.map((s) => [s.date, l.booked])) }, { merge: true });
    }
  }

  // ── money in (non-booking income)
  const inc = await A<{ items: { source?: string; date: string; amount: number }[] }>("/api/income");
  for (const [i, [source, category, amount, notes]] of ([
    ["Northamptonshire Holiday Activities Fund", "Grant", 1850, "HAF funded places, summer"], ["Parent donations - kit fund", "Donations", 240, ""],
    ["Cash on the door - Saturday open session", "Cash", 165, ""], ["Brightside Primary School - PE cover", "Contracts", 620, "Term contract"],
  ] as [string, string, number, string][]).entries()) {
    if (inc.items.some((x) => x.source === source)) continue;
    await tryJson(P("/api/income", { date: day(-3 - i * 4), category, amount, source, notes }));
  }

  // ── staff certificates (credentials API: DBS + paediatric first aid)
  const STAFF = [
    { id: "st-hannah", name: "Hannah Clarke", role: "Camp Lead", rate: 15.5 }, { id: "st-tom", name: "Tom Beckett", role: "Football Coach", rate: 14 },
    { id: "st-priya", name: "Priya Shah", role: "Art Tutor", rate: 13.5 }, { id: "st-callum", name: "Callum Reid", role: "Tennis Coach", rate: 16 },
    { id: "st-sophie", name: "Sophie Whitaker", role: "Dance Teacher", rate: 15 }, { id: "st-danny", name: "Danny Okafor", role: "Activity Leader", rate: 12.5 },
  ];
  for (const [i, s] of STAFF.entries()) {
    await tryJson(PUT(`/api/credentials/records/seed-dbs-${i}`, { staff: s.name, typeId: "dbs", issue: day(-400 + i * 20), expiry: day(700 - i * 30), issuer: "DBS", number: `00${1234500 + i}`, verified: "verified", dbsLevel: "Enhanced", dbsUpdate: true }));
    await tryJson(PUT(`/api/credentials/records/seed-pfa-${i}`, { staff: s.name, typeId: "pfa", issue: day(-700 + i * 30), expiry: i === 5 ? day(21) : day(400 - i * 25), issuer: "St John Ambulance", number: `PFA-${5000 + i}`, verified: "verified" }));
  }
  // the other credential types on the Compliance grid, so it is not a wall of "Missing"
  for (const [i, s] of STAFF.entries()) {
    await tryJson(PUT(`/api/credentials/records/seed-sg-${i}`, { staff: s.name, typeId: "safeguarding", issue: day(-200 + i * 10), expiry: day(500 - i * 20), issuer: "Riverside (in-house, Level 2)", number: `SG-${700 + i}`, verified: "verified" }));
    if (i % 2 === 0) await tryJson(PUT(`/api/credentials/records/seed-faw-${i}`, { staff: s.name, typeId: "faw", issue: day(-300 + i * 10), expiry: day(600 - i * 15), issuer: "St John Ambulance", number: `FAW-${300 + i}`, verified: "verified" }));
    if (i % 3 !== 2) await tryJson(PUT(`/api/credentials/records/seed-food-${i}`, { staff: s.name, typeId: "food", issue: day(-150 + i * 10), expiry: day(800 - i * 20), issuer: "Highfield", number: `FH-${900 + i}`, verified: "verified" }));
  }
  console.log("certificates ok");

  // ── published rota: this week + next at the term-time clubs, and half-term week at the camps. `listing` puts each shift under its listing on the rota board.
  const V = "Riverside Sports Hall";
  const FB = "After-School Football Club", BA = "Ballet & Dance", CA = "October Half-Term Multi-Activity Camp", AR = "Holiday Art Club", TE = "Junior Tennis Camp";
  const sites = [V];
  const shifts: Record<string, unknown>[] = [];
  const add = (date: string, staffId: string, listing: string, role: string, start: string, end: string) => shifts.push({ id: `seed-${date}-${staffId}-${start}`, staffId, site: V, listing, role, date, start, end, locked: true });
  const m0 = monday();
  for (let w = 0; w < 2; w++) for (let d = 0; d < 5; d++) {
    const date = day(m0 + w * 7 + d);
    add(date, "st-tom", FB, "Football Coach", "15:30", "17:00"); add(date, "st-hannah", FB, "Camp Lead", "15:15", "17:15"); add(date, "st-danny", FB, "Activity Leader", "15:30", "17:00");
    if (d === 4) add(date, "st-sophie", BA, "Dance Teacher", "16:00", "17:00");
  }
  for (let d = 0; d < 5; d++) { // half-term week, Mon 26 Oct
    const date = day(24 + d);
    add(date, "st-hannah", CA, "Camp Lead", "08:45", "15:45"); add(date, "st-danny", CA, "Activity Leader", "09:00", "15:30"); add(date, "st-priya", AR, "Art Tutor", "10:00", "14:00"); add(date, "st-callum", TE, "Tennis Coach", "09:30", "15:00");
  }
  await tryJson(PUT("/api/rota", { staff: STAFF, shifts, sites }));
  console.log("rota ok");

  // ── today's football register: three of the four children signed in (so the Registers screen shows a live register)
  try {
    const fbBlock = (L.football.blocks ?? []).find((b) => b.sessions.some((x) => x.date === day(0)));
    if (fbBlock) for (const n of ["Freddie Hargreaves", "Jaden Baptiste", "Zayn Rahman"]) if (refOf[`${n}|football`]) await tryJson(P(`/api/registers/${fbBlock.id}/${day(0)}/mark`, { ref: refOf[`${n}|football`], action: "in", from: "none" }));
  } catch { /* cosmetic */ }

  // ── payroll: 3 employees + a DRAFT run
  const emps = [
    { id: "st-hannah", name: "Hannah Clarke", role: "Camp Lead", op: "", basis: "year", rate: 28000, hpw: 37.5, weeks: 52, taxCode: "1257L", niCat: "A", pension: true, paidFrom: "contracted", source: "team", niNumber: "QQ123456C", startDate: "2023-04-03" },
    { id: "st-tom", name: "Tom Beckett", role: "Football Coach", op: "", basis: "hour", rate: 14, hpw: 20, weeks: 52, taxCode: "1257L", niCat: "A", pension: true, paidFrom: "contracted", source: "team", niNumber: "QQ123457C", startDate: "2024-01-08" },
    { id: "st-sophie", name: "Sophie Whitaker", role: "Dance Teacher", op: "", basis: "hour", rate: 15, hpw: 16, weeks: 52, taxCode: "1257L", niCat: "A", pension: false, paidFrom: "contracted", source: "team", niNumber: "QQ123458C", startDate: "2024-09-02" },
  ];
  await tryJson(PUT("/api/payroll/employees", { employees: emps }));
  await tryJson(P("/api/payroll/runs", {
    period: "October 2026", paidOn: "2026-10-30", freq: "monthly",
    lines: [
      { id: "st-hannah", name: "Hannah Clarke", grossM: 2333.33, payeM: 214.4, eeNiM: 120.8, erNiM: 232.6, eePenM: 93.33, erPenM: 70, netM: 1904.8 },
      { id: "st-tom", name: "Tom Beckett", grossM: 1213.33, payeM: 33.2, eeNiM: 0, erNiM: 68.0, eePenM: 48.5, erPenM: 36.4, netM: 1131.63 },
      { id: "st-sophie", name: "Sophie Whitaker", grossM: 1040, payeM: 0, eeNiM: 0, erNiM: 29.2, eePenM: 0, erPenM: 0, netM: 1040 },
    ],
  }));
  console.log("payroll ok");

  // ── team (accepted staff invites = the "team" the Compliance / Learning screens list; no sign-in accounts are created) + learning
  const invites = await db.collection("invites").where("tenantId", "==", tenantId).get();
  for (const d of invites.docs) if (d.get("role") === "staff" && (/e2e/i.test(JSON.stringify(d.data()).split(acc.email).join("")) || String(d.id).startsWith("riverside-staff-"))) await d.ref.delete();
  for (const [i, s] of STAFF.entries()) await db.collection("invites").doc(`riverside-staff-${i}`).set({ tenantId, franchiseId: null, role: "staff", createdAt: day(-90), createdBy: acc.email, usedBy: `riverside-demo-${i}`, usedAt: day(-88), sentTo: `${s.name.toLowerCase().replace(/\W+/g, ".")}@activityos-test.com`, name: s.name, jobTitle: s.role, staffRole: s.role, assignment: null, lead: i === 0 });
  const ASSIGN = (course: string, title: string, kind: "all" | "roles", roles: string[], due: string) => ({ course, title, kind, roles, staff: [] as string[], locs: [] as string[], due, required: true, version: 1 });
  await tryJson(PUT("/api/learning/assignments", { assignments: [
    ASSIGN("c1", "Safeguarding Children (Level 2)", "all", [], "2026-10-31"), ASSIGN("c10", "Fire Safety Awareness", "all", [], "2026-11-30"),
    ASSIGN("c2", "Paediatric First Aid Refresher", "roles", ["Camp Lead", "Activity Leader", "Football Coach"], "2026-11-15"), ASSIGN("c9", "Data Protection & Confidentiality (GDPR)", "roles", ["Camp Lead"], "2026-12-15"),
  ] }));
  const done: [string, string, string, number][] = [
    ["Hannah Clarke", "c1", "Safeguarding Children (Level 2)", 96], ["Hannah Clarke", "c10", "Fire Safety Awareness", 92], ["Hannah Clarke", "c2", "Paediatric First Aid Refresher", 90],
    ["Tom Beckett", "c1", "Safeguarding Children (Level 2)", 88], ["Priya Shah", "c1", "Safeguarding Children (Level 2)", 100], ["Priya Shah", "c10", "Fire Safety Awareness", 94],
    ["Callum Reid", "c10", "Fire Safety Awareness", 90], ["Sophie Whitaker", "c1", "Safeguarding Children (Level 2)", 84], ["Danny Okafor", "c10", "Fire Safety Awareness", 94],
  ];
  for (const [i, [staffName, courseId, title, score]] of done.entries()) await tryJson(P("/api/learning/completions", { staffName, courseId, title, score, date: day(-20 + i) }));
  console.log("team + learning ok");

  // ── messages
  const threads = await tryJson(A<{ items?: { parentEmail?: string }[] } | { parentEmail?: string }[]>("/api/messages/threads"));
  const tl = Array.isArray(threads) ? threads : (threads?.items ?? []);
  for (const [email, name, body] of [
    ["sarah.whitfield@example.com", "Sarah Whitfield", "Hi Sarah, thanks for booking Oliver and Poppy onto the half-term camp. A reminder that packed lunches must be nut free. See you on the 26th!"],
    ["mohammed.rahman@example.com", "Mohammed Rahman", "Hi Mohammed, just confirming Zayn's inhaler details are on his register. Coach Tom will keep it with the first-aid kit."],
    ["emma.hargreaves@example.com", "Emma Hargreaves", "Hello Emma, a place has opened on Holiday Art Club for Isla. Your booking is confirmed."],
  ] as const) {
    if (tl.some((t) => (t.parentEmail ?? "").toLowerCase() === email)) continue;
    await tryJson(P("/api/messages", { parentEmail: email, parentName: name, subject: "Your booking", body }));
  }
  console.log("messages ok");

  // ── discount codes (two live codes)
  for (const c of [
    { code: "HALFTERM10", type: "percent", value: 10, expiry: day(30), listingId: L.camp.id, usageLimit: 40 },
    { code: "WELCOME5", type: "amount", value: 5, minSpend: 20, perCustomerLimit: true },
  ]) await tryJson(P("/api/discounts", c));
  console.log("discount codes ok");

  // ── email campaigns: two past sends written straight to the history (nothing is sent; MAIL_LIVE stays unset). The draft is seeded in the browser by the spec.
  const fams = FAMILIES.map((f) => f.email);
  const now = Date.now();
  for (const [subject, body, daysAgo, opened] of [
    ["Half-term camp: places are filling fast", "Hi there, our October half-term camp has only a few places left. Book your child's days online in a couple of minutes.", 5, 8],
    ["Welcome back: your autumn club timetable", "Hello, the autumn timetable for football, ballet and art is now live. See you at the hall!", 12, 6],
  ] as [string, string, number, number][]) {
    await db.collection("emails").add({ tenantId, subject, body, audience: "all", recipientCount: fams.length, sentBy: acc.email, sentByName: "Riverside Sports Club", createdAt: new Date(now - daysAgo * 86400000).toISOString(), status: "sent", delivered: fams.length, openedBy: fams.slice(0, opened) });
  }
  console.log("email history ok");

  // ── incidents / first aid, medication, tasks, newsfeed, moments
  await tryJson(P("/api/incidents", { kind: "accident", date: day(-2), time: "11:20", childName: "Poppy Whitfield", location: "Riverside Sports Hall", description: "Tripped on the mat during the warm-up game and grazed her knee.", bodyPart: "Knee", injury: "Minor graze", treatment: "Cleaned with water, plaster applied, ice pack for 5 minutes", firstAider: "Hannah Clarke", actionTaken: "Parent told at collection" }));
  await tryJson(P("/api/incidents", { kind: "accident", date: day(-1), time: "15:50", childName: "Alfie Pritchard", location: "Court 2", description: "Took a tennis ball to the forearm during a drill.", bodyPart: "Forearm", injury: "Bruise, no swelling", treatment: "Cold compress", firstAider: "Callum Reid" }));
  await tryJson(P("/api/incidents", { kind: "incident", date: day(-3), time: "16:10", childName: "Daniel Okafor", incidentType: "Behaviour", location: "Riverside Sports Hall", description: "Disagreement over a football; both children calmed down and shook hands.", actionTaken: "Spoke with both children, reminded them of the club rules", witnesses: "Tom Beckett" }));
  const med1 = await tryJson(P<{ id: string }>("/api/medications", { childName: "Zayn Rahman", name: "Salbutamol inhaler", dose: "2 puffs", route: "Inhaler", condition: "Asthma", schedule: "As needed", instructions: "Give 2 puffs if wheezy or short of breath; call parent if a second dose is needed.", asNeeded: true, heldOnSite: true, storage: "First-aid kit", startDate: day(-30), expiryDate: day(300), consentBy: "Mohammed Rahman", consentGranted: true }));
  await tryJson(P("/api/medications", { childName: "Oliver Whitfield", name: "Adrenaline auto-injector (EpiPen)", dose: "1 injection", route: "Injection", condition: "Peanut allergy", schedule: "Emergency only", instructions: "Emergency use for anaphylaxis, then call 999.", asNeeded: true, heldOnSite: true, storage: "Camp lead bag", startDate: day(-30), expiryDate: day(200), consentBy: "Sarah Whitfield", consentGranted: true }));
  if (med1) await tryJson(P(`/api/medications/${med1.id}/administer`, { date: day(-4), time: "15:45", doseGiven: "2 puffs", given: true, witnessedBy: "Tom Beckett", notes: "Settled within a few minutes" }));
  for (const t of [
    { t: "Print and check the half-term camp registers", who: "Hannah Clarke", prio: "urgent", due: day(2), status: "todo", labels: ["Camp"], subs: [{ t: "Print registers", done: true }, { t: "Check medical notes", done: false }] },
    { t: "Order new football bibs and cones", who: "Tom Beckett", prio: "med", due: day(6), status: "prog" },
    { t: "Send paediatric first aid refresher reminders", who: "Danny Okafor", prio: "high", due: day(4), status: "todo" },
    { t: "Risk assessment for the tennis courts", who: "Callum Reid", prio: "high", due: day(8), status: "backlog" },
    { t: "Upload the new art club photos", who: "Priya Shah", prio: "low", due: day(10), status: "backlog" },
    { t: "Reconcile last week's card payments", who: "Hannah Clarke", prio: "med", due: day(-1), status: "done" },
  ]) await tryJson(P("/api/tasks", t));
  await tryJson(P("/api/posts", { tpl: "announce", title: "Half-term camp: what to bring", body: "Packed lunch (nut free please), a water bottle, trainers and a sunny-day hat. Drop-off is from 8:45am and pick-up from 3:30pm.", status: "published", pinned: true, audience: "all", priority: "normal" }));
  await tryJson(P("/api/posts", { tpl: "event", title: "Junior Tennis Camp: a few places left", body: "Coached sessions for beginners to improvers, all week at Riverside Sports Hall.", photoUrl: await upload("freelancer-1"), status: "published", audience: "all", date: day(25), time: "09:30", location: "Riverside Sports Hall" }));
  for (const [img, caption, activity, key] of [["company-1", "Sack race champions on day one of camp!", "Games", "camp"], ["freelancer-1", "Rally practice with Coach Callum", "Tennis", "tennis"], ["freelancer-2", "Rehearsing for the end-of-term showcase", "Dance", "ballet"], ["staff", "Sunny-day crafts and cheering", "Arts & crafts", "art"]] as const)
    await tryJson(P("/api/moments", { photoUrl: await upload(img), caption, activity, photoType: "work", listingId: L[key].id, childIds: [] }));
  console.log("incidents, medication, tasks, newsfeed, moments ok");
  console.log(`DONE tenant=${tenantId}`);
  process.exit(0);
})().catch((e) => { console.error("SEED FAILED:", e.message); process.exit(1); });
