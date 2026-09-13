import { Router } from "express";
import { z } from "zod";
import { readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { db } from "../firebase";

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
  source: z.string().trim().max(60).optional().default("demo"),
});

export const leadsPublic = Router();

leadsPublic.post("/", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const ref = db.collection("leads").doc();
  // A demo request is a live sales conversation: it goes on the HQ Sales board.
  const doc = { ...parsed.data, status: "new", inPipeline: true, createdAt: new Date().toISOString() };
  await ref.set(doc);
  if (cache) { cache.items.unshift({ id: ref.id, ...doc }); rev++; }
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
  "region", "county", "nation", "emailFrom", "phoneFrom", "haf", "hafFrom", "hafPaid", "hafLocalAuthority", "bookingUrl", "bookingFrom", "hafText", "websiteParked", "webShop", "hafProgramme", "bookingChecked", "websiteDown", "comingSoonWhy",
  // A site that matches their name but couldn't be confirmed as theirs (no contacts taken from it).
  "websiteCandidate", "websiteCandidateWhy",
  // Activities / HAF read from their own website.
  "activityTypes", "haf"];
const FRESH_MS = 3 * 60_000;
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
  inflight ??= db.collection("leads").select(...LIST_FIELDS).get()
    .then((snap) => {
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
/** At start-up: serve the saved copy straight away, then read the latest. */
export function warmLeads() {
  // Only re-read Firestore if the saved copy is stale — the API restarts on every
  // code change in dev, and 26k reads per restart kept the page from loading.
  readFile(DISK, "utf8").then((t) => { if (!cache) cache = JSON.parse(t); }).catch(() => {})
    .finally(() => { if (!cache || Date.now() - cache.at > FRESH_MS) refresh().catch(() => {}); });
}

leads.get("/", async (req, res) => {
  if (cache) {
    if (req.query.fresh === "1" || Date.now() - cache.at > FRESH_MS) refresh().catch(() => {});
    const body = () => JSON.stringify({ leads: cache!.items, asOf: new Date(cache!.at).toISOString(), refreshing: !!inflight });
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
