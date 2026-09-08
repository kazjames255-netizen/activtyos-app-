import { Router } from "express";
import { db } from "../firebase";

/**
 * Public provider directory — the lookup behind "find your provider" on the
 * parent sign-up screen (/parent).
 *
 * Deliberately public and deliberately thin: a parent has no account yet, so
 * there is nothing to authenticate against, and the only thing they need is
 * enough to recognise their child's club. Name + rough location only — never
 * contact details, counts, or anything about the business.
 *
 * Firestore can't do case-insensitive "contains", so the directory is built in
 * memory and cached briefly. At this scale (hundreds of tenants) that's far
 * cheaper than a query per keystroke; if it ever outgrows that, this is the one
 * place to swap in a search index.
 */
export const providersPublic = Router();

type Provider = { id: string; name: string; town?: string; postcode?: string };
/** What a row can be matched on: the trading name AND the registered one. */
type Row = Provider & { terms: string[] };

const CACHE_MS = 60_000;
const MAX_TENANTS = 500;
const MAX_RESULTS = 8;

let cache: { at: number; rows: Row[] } | null = null;
let inflight: Promise<Row[]> | null = null;

const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

/**
 * Best-guess town out of the one free-text address field (postcode stripped).
 *
 * This is a PUBLIC, unauthenticated payload, so it errs heavily towards
 * returning nothing. An address written as one unpunctuated line — "12 Corris
 * Court Broughton Milton Keynes" — has no town to extract, and guessing at one
 * published a provider's street address to anyone who could type two letters.
 * A town is emitted only when the address is genuinely structured and the
 * candidate does not look like a street.
 */
function townFrom(address?: string): string | undefined {
  if (!address) return undefined;
  const parts = address
    .replace(UK_POSTCODE, "")
    .split(/[\n,]/)
    .map((p) => p.trim())
    .filter(Boolean);
  // One segment means the address was never delimited — there is no town line
  // to take, only the whole address. Say nothing rather than leak it.
  if (parts.length < 2) return undefined;
  const last = parts[parts.length - 1];
  // "12 Corris Court" / "Flat 3b" — a street, not a town.
  if (/^\d/.test(last) || last.length > 40) return undefined;
  return last;
}

/**
 * Signup fixtures ("E2E Signup Company ms…") outnumber real providers in dev
 * and must never be offered to a parent. There's no flag on the tenant doc, so
 * this goes on the name — narrow enough that a real club can't trip it.
 */
const isFixture = (name: string) => /^e2e[\s-]/i.test(name);

/** "MK109NR" as stored → "MK10 9NR" as a parent would recognise it. */
function tidyPostcode(raw?: string): string | undefined {
  const pc = (raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const m = pc.match(/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/);
  return m ? `${m[1]} ${m[2]}` : pc || undefined;
}

async function directory(): Promise<Row[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  if (inflight) return inflight;

  inflight = (async () => {
    const snap = await db.collection("tenants").limit(MAX_TENANTS).get();
    const libs = snap.docs.length
      ? await db.getAll(...snap.docs.map((d) => db.collection("libraries").doc(d.id)))
      : [];

    const rows: Row[] = [];
    const seen = new Set<string>();
    snap.docs.forEach((doc, i) => {
      const t = doc.data() as { name?: string; postcode?: string };
      const settings = (libs[i]?.data()?.settings ?? {}) as {
        providerName?: string;
        billing?: { businessName?: string; address?: string };
      };
      // Same precedence as the portal chrome (/api/me): the name the provider
      // chose to trade under wins over the tenant doc's original name.
      const trading = (settings.providerName || settings.billing?.businessName || "").trim();
      const registered = (t.name ?? "").trim();
      const name = trading || registered;
      if (!name || isFixture(name) || isFixture(registered)) return;

      // A parent may know the club by either name — the one on the door or the
      // one it signed up with — so both are searchable even though only the
      // trading name is shown.
      const terms = [name, registered].filter(Boolean).map((s) => s.toLowerCase());
      const postcode = tidyPostcode(t.postcode);

      const key = `${name.toLowerCase()}|${postcode ?? ""}`;
      if (seen.has(key)) return;
      seen.add(key);

      rows.push({ id: doc.id, name, town: townFrom(settings.billing?.address), postcode, terms });
    });

    rows.sort((a, b) => a.name.localeCompare(b.name));
    cache = { at: Date.now(), rows };
    return rows;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// GET /api/providers?q=… — type-ahead for the parent sign-up provider picker.
providersPublic.get("/", async (req, res) => {
  const q = norm(String(req.query.q ?? ""));
  if (q.length < 2) {
    res.json([]);
    return;
  }

  try {
    const rows = await directory();
    const squashed = q.replace(/\s/g, "");
    const scored = rows
      .map((r) => {
        const terms = r.terms.map(norm);
        const pc = (r.postcode ?? "").toLowerCase().replace(/\s/g, "");
        // Rank a name that STARTS with what they typed above one that merely
        // contains it — "Kick Off" should beat "Sidekick Offside" for "kick".
        if (terms.some((t) => t.startsWith(q))) return { r, score: 0 };
        if (terms.some((t) => t.includes(q))) return { r, score: 1 };
        if (pc && pc.startsWith(squashed)) return { r, score: 2 };
        if (norm(r.town ?? "").startsWith(q)) return { r, score: 3 };
        return null;
      })
      .filter((x): x is { r: Row; score: number } => x !== null)
      .sort((a, b) => a.score - b.score || a.r.name.localeCompare(b.r.name))
      .slice(0, MAX_RESULTS)
      .map(({ r }): Provider => ({ id: r.id, name: r.name, town: r.town, postcode: r.postcode }));

    res.json(scored);
  } catch (err) {
    // The picker treats a failure as "directory unavailable" rather than "your
    // club isn't here" — those are very different claims to a parent — so the
    // error must actually surface as one.
    console.error("[providers] directory lookup failed", err);
    res.status(503).json({ error: "Provider directory unavailable" });
  }
});
