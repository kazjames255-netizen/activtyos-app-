import { Router } from "express";
import { z } from "zod";
import { readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { db } from "../firebase";
import { emailWebsiteAddonAck, emailDemoBooked } from "../lib/emails";

// Marketing-site "Book a demo" lead capture.
// - POST is PUBLIC: the /demo form on the site posts here with no login.
// - GET/PATCH are HQ-only: the platform "Leads" list works the pipeline.
// New leads surface on the HQ bell too — see platformNotifications ("lead"),
// which aggregates the `leads` collection on read.

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).optional().default(""),
  business: z.string().trim().max(160).optional().default(""),
  size: z.string().trim().max(60).optional().default(""),
  interest: z.string().trim().max(60).optional().default(""),
  message: z.string().trim().max(2000).optional().default(""),
  // The demo page's "What would you like us to cover?" checkboxes — lets
  // whoever runs the call see what the person actually wants to see, rather
  // than everyone getting the same generic tour.
  interestedFeatures: z.array(z.string().trim().max(80)).max(20).optional().default([]),
  // The chosen call time (ISO, UTC), if they booked a slot from the demo
  // page's picker — see routes/demoSlots.ts. Not re-validated as a real open
  // slot here: the picker only ever offers real ones, and a race (two people
  // grabbing the same slot moments apart) is rare enough to handle by hand
  // rather than adding transactional locking for a low-volume form.
  slotAt: z.string().trim().max(40).optional(),
  source: z.string().trim().max(60).optional().default("demo"),
  // Which of the three plans the submitter says they are — a real signal
  // when the form asks (e.g. the pricing-page website-design add-on), rather
  // than the Sales board silently defaulting every inbound lead to "company".
  plan: z.enum(["freelancer", "company", "franchise"]).optional(),
  // Same taxonomy as the Leads (prospect research) page's TYPE constant, so a
  // self-reported business type lines up with the researched-prospect data.
  // Single-value — the /demo page's role picker. The pricing-page add-on
  // form is genuinely multi-select (a lot of providers run more than one
  // kind of thing), so it sends businessTypes instead.
  businessType: z.enum(["holiday", "wraparound", "activity", "tuition", "preschool", "nursery", "childminder", "school", "other"]).optional(),
  businessTypes: z.array(z.enum(["holiday", "wraparound", "activity", "tuition", "preschool", "nursery", "childminder", "school", "other"])).max(8).optional(),
  // The website-design add-on's own two questions, beyond the shared
  // name/email/phone/business fields — whether they already have a site
  // (so the build starts from scratch or a migration) and, if so, its address.
  hasWebsite: z.enum(["yes", "no"]).optional(),
  currentWebsite: z.string().trim().max(300).optional(),
});

export const leadsPublic = Router();

leadsPublic.post("/", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const ref = db.collection("leads").doc();
  // This route serves two different forms with two different meanings:
  //  - The /demo page: every submission IS a booked call, so it starts
  //    straight in the Sales board's "Demo" column.
  //  - The pricing page's "Website design & maintenance" add-on (source
  //    "website_build"): its "Add website design & maintenance" path now
  //    books a real slot from the SAME shared pool as /demo (see
  //    routes/demoSlots.ts — one `leads`-wide slotAt query keeps the two
  //    from ever double-booking a slot), so a booked one lands in "Demo"
  //    too — it's a real meeting, just about the website rather than the
  //    platform. "Ask a question first" never books a slot, so it starts in
  //    "Lead" like any other cold prospect nobody's spoken to yet.
  const isWebsiteAddon = parsed.data.source === "website_build";
  const status = isWebsiteAddon ? (parsed.data.slotAt ? "demo" : "new") : "demo";
  const doc = { ...parsed.data, status, inPipeline: true, createdAt: new Date().toISOString() };
  await ref.set(doc);
  if (cache) { cache.items.unshift({ id: ref.id, ...doc }); rev++; }
  // Acknowledge immediately — the pricing-page add-on form has no other
  // confirmation beyond an inline "Sent" message, and both its buttons
  // ("Add…" / "Ask a question first") capture email/phone this early, so
  // this is the first real touchpoint. Fire-and-forget: email never blocks
  // the response.
  if (isWebsiteAddon) {
    emailWebsiteAddonAck({
      to: parsed.data.email,
      name: parsed.data.name,
      kind: parsed.data.interest === "website-design-question" ? "question" : "signup",
      message: parsed.data.message,
      slotAt: parsed.data.slotAt,
      leadId: ref.id,
    });
  } else if (parsed.data.slotAt) {
    // A real /demo booking with a chosen slot — the page's own copy
    // ("we'll email a confirmation shortly") had nothing behind it until
    // now; this is that confirmation, with a working video-call link.
    emailDemoBooked({ to: parsed.data.email, name: parsed.data.name, slotAt: parsed.data.slotAt, leadId: ref.id });
  }
  res.json({ ok: true, id: ref.id });
});

export const leads = Router();

leads.use((req, res, next) => {
  if (req.auth!.role !== "platform") {
    res.status(403).json({ error: "Requires the platform role" });
    return;
  }
  next();
});

// The list is a few thousand researched prospects: reading them all from
// Firestore takes ~10s, so the page is served from a trimmed in-memory copy
// (only the fields the cards show) and refreshed in the background.
const LIST_FIELDS = ["name", "email", "phone", "business", "size", "message", "source", "status", "createdAt", "updatedAt",
  "website", "location", "kind", "legalForm", "companyNumber", "charityNumber", "bookingSystem", "sourceUrl",
  "confidence", "listingsOnSource", "plan", "planReason", "personalContact", "sport",
  // Cross-source tracking: every directory the provider is on, with the listing links.
  "sources", "sourceRefs", "onSources", "duplicateOf", "excluded",
  // A "coming soon" website (likely no booking platform yet) · Ofsted venue count.
  "comingSoon", "ofstedSites",
  // What kind of provider (Ofsted-classified) and whether it's part of a franchise / group.
  "providerTypes", "providerType", "network", "networkKind", "networkOperators", "ofstedRegions",
  // Where they are (from postcode / town via ONS data) and where each contact detail was read.
  "region", "county", "nation", "emailFrom", "phoneFrom", "haf", "hafFrom", "hafPaid", "hafLocalAuthority", "bookingUrl", "bookingFrom", "hafText", "websiteParked", "webShop", "hafProgramme", "bookingChecked", "socialUrl", "websiteSearchedAt", "duplicateOf", "websiteDown", "comingSoonWhy",
  // A site that matches their name but couldn't be confirmed as theirs (no contacts taken from it).
  "websiteCandidate", "websiteCandidateWhy",
  // Activities / HAF read from their own website.
  "activityTypes", "haf",
  // Confirmed-dead website tracking (was missing from the list — the UI's "website opportunity" badge needs these).
  "websiteDead", "websiteDeadAt", "websiteDeadWhy", "websiteDeadCategory",
  // Manual-booking-language classification: for a confirmed site with no detected booking system, did we find
  // explicit "call/email to book" wording (a great lead — no incumbent system) or check and find neither?
  "bookingMethod", "bookingMethodEvidence",
  // Companies House SIC-code sweep leads: name-only classifier tier, plus the registered-address fields
  // those leads carry instead of the usual `location` (was missing — every filter/count using these read 0).
  "reviewTier", "needsHumanReview", "postcode", "regAddress",
  // Free secondary-contact pass (council HAF page / re-read source page) for leads with no direct channel.
  "secondaryContact", "secondaryContactType", "secondaryContactNote",
  // DfE GIAS independent-schools import: school-type classification, boarding flag, age range, and the register id
  // for clean re-runs (dedupe by URN). "postcode" is already listed above. Club-language enrichment
  // (enrich_schools.mjs) writes into the existing providerTypes/bookingSystem/email/phone fields above.
  // giasSchoolName is the register's own name for the school — shown when a lead is a club/nursery/committee
  // that GIAS's own dedupe (by postcode+name or website host) linked to a DIFFERENT-named school, so the UI can
  // say which school that link is about instead of leaving it implicit.
  "giasUrn", "giasSchoolName", "schoolType", "boarding", "ageLow", "ageHigh",
  // DfE GIAS state-funded-schools import (import_gias_state.mjs): phase of education and governance
  // (MAT/SAT/LA-maintained/free school), plus the trust name when linked to one. Shares giasUrn/ageLow/ageHigh
  // with the independent import above.
  "schoolPhase", "schoolGovernance", "trustName",
  // Named role-contacts (headteacher, pupil premium lead, inclusion lead, SENDCo) read from a school's own
  // staff/key-staff page (enrich_schools.mjs) — best-effort name/email pairs, not a substitute for the main
  // email/phone fields above.
  "roleContacts"];
const FRESH_MS = 3 * 60_000;
// The newest N leads, not all 71k: the whole collection doesn't fit in a normal
// container's memory, and re-reading it is a five-figure Firestore bill in
// reads every time it goes stale. The board shows the newest first anyway.
// Raise it where there's memory to spare; the response says when it's capped.
const CACHE_MAX = Number(process.env.LEADS_CACHE_MAX ?? 5000);
let truncated = false;
type Row = Record<string, unknown> & { id: string; createdAt?: string };
let cache: { at: number; items: Row[] } | null = null;
let inflight: Promise<Row[]> | null = null;
// Tens of thousands of leads is tens of MB of JSON: send it gzipped, zipped once
// per version of the list (rev bumps when a lead changes in the cache).
let rev = 0;
let zipped: { key: string; buf: Buffer } | null = null;
// A copy on disk (outside the repo) so a restart serves the list at once
// instead of making the page wait a minute for thousands of reads.
const DISK = join(tmpdir(), "aos-leads-list-cache.json");
function refresh(): Promise<Row[]> {
  inflight ??= db.collection("leads").select(...LIST_FIELDS).orderBy("createdAt", "desc").limit(CACHE_MAX).get()
    .then((snap) => {
      truncated = snap.size >= CACHE_MAX;
      const items = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Row)
        // The card shows two lines of the description; a long Ofsted site list
        // would otherwise make the whole list tens of MB.
        .map((r) => (typeof r.message === "string" && r.message.length > 400 ? { ...r, message: `${r.message.slice(0, 400)}…` } : r))
        // The same provider found on two directories is one lead; the folded
        // copy (duplicateOf) isn't listed twice.
        .filter((r) => !r.duplicateOf && !r.excluded)
        .sort((a, b) => (String(a.createdAt) < String(b.createdAt) ? 1 : -1));
      cache = { at: Date.now(), items };
      // Write-then-rename, so a restart mid-write can't leave a broken copy.
      const tmp = `${DISK}.${process.pid}.tmp`;
      writeFile(tmp, JSON.stringify(cache)).then(() => rename(tmp, DISK)).catch(() => {});
      return items;
    })
    .finally(() => { inflight = null; });
  return inflight;
}
/** At start-up: serve the saved copy if there is one.
 *
 *  It used to also READ THE WHOLE COLLECTION on every boot. At 71k leads that
 *  is ~200 MB of live objects plus a JSON string plus the gzip buffer, which
 *  killed the container on Railway — and because the container then restarted,
 *  it did it again, burning ~71k Firestore reads a go against a 50k/day cap.
 *
 *  So the boot read is opt-in (LEADS_WARM=1, for a big dev box) and the cache
 *  is capped (LEADS_CACHE_MAX). Nothing warms on a cold start in production:
 *  the first HQ request fills the cache instead. */
export function warmLeads() {
  readFile(DISK, "utf8").then((t) => { if (!cache) cache = JSON.parse(t); }).catch(() => {})
    .finally(() => {
      if (process.env.LEADS_WARM !== "1") return;
      if (!cache || Date.now() - cache.at > FRESH_MS) refresh().catch(() => {});
    });
}

leads.get("/", async (req, res) => {
  if (cache) {
    if (req.query.fresh === "1" || Date.now() - cache.at > FRESH_MS) refresh().catch(() => {});
    const body = () => JSON.stringify({ leads: cache!.items, asOf: new Date(cache!.at).toISOString(), refreshing: !!inflight, truncated, cap: CACHE_MAX });
    if (!/\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""))) { res.type("json").send(body()); return; }
    const key = `${cache.at}|${!!inflight}|${rev}`;
    if (zipped?.key !== key) zipped = { key, buf: gzipSync(body()) };
    res.set({ "Content-Type": "application/json; charset=utf-8", "Content-Encoding": "gzip", Vary: "Accept-Encoding" }).send(zipped.buf);
    return;
  }
  // Nothing read yet (first start): say so rather than hold the request past
  // the browser's timeout; the page asks again in a few seconds.
  refresh().catch(() => {});
  res.status(202).json({ leads: [], warming: true });
});

leads.patch("/:id", async (req, res) => {
  const parsed = z
    .object({
      status: z.enum(["new", "contacted", "won", "lost"]).optional(),
      notes: z.string().max(4000).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  // Working a researched prospect (contacted / won / lost) puts it on the HQ
  // Sales board; its pipeline stage follows unless the board already has it further on.
  const ref = db.collection("leads").doc(req.params.id);
  const extra: Record<string, unknown> = {};
  if (parsed.data.status && parsed.data.status !== "new") {
    extra.inPipeline = true;
    const stage = ((await ref.get()).get("stage") as string | undefined) ?? "new";
    if (parsed.data.status !== "contacted" || stage === "new") extra.stage = parsed.data.status;
  }
  await ref.set({ ...parsed.data, ...extra, updatedAt: new Date().toISOString() }, { merge: true });
  const row = cache?.items.find((l) => l.id === req.params.id);
  if (row && parsed.data.status) { row.status = parsed.data.status; rev++; }
  res.json({ ok: true });
});
