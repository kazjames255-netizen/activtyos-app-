import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// ── Reviews hub ─────────────────────────────────────────────────────────────
// Blends IN-HOUSE feedback with EXTERNAL platforms into one model + a blended
// rating. Compliance: no review gating — the "invite to Google" is offered to
// everyone regardless of score; we never hide low ratings.
//   Sources: in-house (feedback collection, ours) · Google (Places API live,
//   Business Profile connect) · Trustpilot (Service Reviews API).
// External connectors activate only when platform credentials exist; without
// them the endpoints degrade gracefully (in-house still works).
export const reviews = Router();
const canManage = (r: Role) => r === "company" || r === "franchise" || r === "freelancer";

interface NormReview { source: "inhouse" | "google" | "trustpilot"; rating: number; author: string; text: string; postedAt: string; url?: string; listing?: string | null; verified: boolean; reply?: { text: string; at: string } | null; id?: string }

async function tenantReviewCfg(tenantId: string) {
  const lib = await db.collection("libraries").doc(tenantId).get();
  return (lib.data()?.settings?.reviews ?? {}) as {
    googlePlaceId?: string; googleReviewUrl?: string; showGoogleRating?: boolean;
    inviteToGoogle?: boolean; googleConnected?: boolean; trustpilotBusinessUnitId?: string; publicWidget?: boolean;
  };
}

// In-house reviews (our feedback collection).
async function inhouseReviews(tenantId: string): Promise<NormReview[]> {
  const snap = await db.collection("feedback").where("tenantId", "==", tenantId).get();
  return snap.docs.map((d) => {
    const f = d.data() as { rating?: number; comment?: string; name?: string | null; email?: string; listing?: string | null; createdAt?: string; reply?: { text: string; at: string } };
    const author = f.name?.trim() || (f.email ? `${f.email.split("@")[0]}` : "A parent");
    return { source: "inhouse" as const, rating: Number(f.rating) || 0, author, text: f.comment ?? "", postedAt: f.createdAt ?? "", listing: f.listing ?? null, verified: true, reply: f.reply ?? null, id: d.id };
  }).sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1));
}

// Google via the Places API — live, not stored (per Google's terms). Needs a
// platform Maps key + the tenant's Place ID.
async function googleLive(placeId?: string): Promise<{ rating: number | null; count: number; reviews: NormReview[] } | null> {
  const key = process.env.GOOGLE_PLACES_KEY;
  if (!key || !placeId) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&reviews_sort=newest&fields=rating,user_ratings_total,reviews&key=${key}`;
    const r = await fetch(url);
    const j = (await r.json()) as { status?: string; result?: { rating?: number; user_ratings_total?: number; reviews?: { rating: number; author_name: string; text: string; time: number; author_url?: string }[] } };
    if (j.status !== "OK" || !j.result) return null;
    const reviews: NormReview[] = (j.result.reviews ?? []).slice(0, 5).map((rv) => ({ source: "google", rating: rv.rating, author: rv.author_name, text: rv.text, postedAt: new Date((rv.time || 0) * 1000).toISOString(), url: rv.author_url, verified: true }));
    return { rating: j.result.rating ?? null, count: j.result.user_ratings_total ?? 0, reviews };
  } catch { return null; }
}

// Trustpilot Service Reviews — needs a platform API key + the tenant's Business Unit ID.
async function trustpilotLive(businessUnitId?: string): Promise<{ rating: number | null; count: number; reviews: NormReview[] } | null> {
  const key = process.env.TRUSTPILOT_API_KEY;
  if (!key || !businessUnitId) return null;
  try {
    const url = `https://api.trustpilot.com/v1/business-units/${encodeURIComponent(businessUnitId)}/reviews?apikey=${key}&perPage=5&orderBy=createdat.desc`;
    const r = await fetch(url);
    const j = (await r.json()) as { reviews?: { stars: number; consumer?: { displayName?: string }; text?: string; title?: string; createdAt?: string }[]; numberOfReviews?: { total?: number }; score?: { trustScore?: number } };
    const reviews: NormReview[] = (j.reviews ?? []).map((rv) => ({ source: "trustpilot", rating: rv.stars, author: rv.consumer?.displayName ?? "A customer", text: rv.text || rv.title || "", postedAt: rv.createdAt ?? "", verified: true }));
    return { rating: j.score?.trustScore ?? null, count: j.numberOfReviews?.total ?? reviews.length, reviews };
  } catch { return null; }
}

function blend(parts: { avg: number | null; count: number }[]) {
  const usable = parts.filter((p) => p.avg != null && p.count > 0) as { avg: number; count: number }[];
  const count = usable.reduce((n, p) => n + p.count, 0);
  if (!count) return { rating: null as number | null, count: 0 };
  const rating = usable.reduce((n, p) => n + p.avg * p.count, 0) / count;
  return { rating: Math.round(rating * 10) / 10, count };
}

async function buildSummary(tenantId: string) {
  const cfg = await tenantReviewCfg(tenantId);
  const inhouse = await inhouseReviews(tenantId);
  const inAvg = inhouse.length ? inhouse.reduce((n, r) => n + r.rating, 0) / inhouse.length : null;
  const google = cfg.showGoogleRating !== false ? await googleLive(cfg.googlePlaceId) : null;
  const trustpilot = await trustpilotLive(cfg.trustpilotBusinessUnitId);
  const summary = blend([
    { avg: inAvg, count: inhouse.length },
    { avg: google?.rating ?? null, count: google?.count ?? 0 },
    { avg: trustpilot?.rating ?? null, count: trustpilot?.count ?? 0 },
  ]);
  const bySource = {
    inhouse: { rating: inAvg ? Math.round(inAvg * 10) / 10 : null, count: inhouse.length },
    google: google ? { rating: google.rating, count: google.count } : null,
    trustpilot: trustpilot ? { rating: trustpilot.rating, count: trustpilot.count } : null,
  };
  const items = [...inhouse, ...(google?.reviews ?? []), ...(trustpilot?.reviews ?? [])].sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1));
  return { summary, bySource, items, cfg };
}

// operator → the whole hub
reviews.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const { summary, bySource, items } = await buildSummary(auth.tenantId);
  res.json({ summary, bySource, items, googleConnectConfigured: !!process.env.GOOGLE_BP_CLIENT_ID, trustpilotConfigured: !!process.env.TRUSTPILOT_API_KEY });
});

// operator → reply to an in-house review
const replySchema = z.object({ text: z.string().trim().min(1).max(2000) });
reviews.post("/inhouse/:id/reply", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const p = replySchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.issues }); return; }
  const ref = db.collection("feedback").doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) { res.status(404).json({ error: "Not found" }); return; }
  const reply = { text: p.data.text, at: new Date().toISOString() };
  await ref.set({ reply }, { merge: true });
  res.json({ ok: true, reply });
});

// public → for the embeddable widget + AggregateRating schema (in-house only)
reviews.get("/public/:tenantId", async (req, res) => {
  const tenantId = req.params.tenantId;
  const cfg = await tenantReviewCfg(tenantId);
  if (!cfg.publicWidget) { res.status(404).json({ error: "Public reviews are off for this provider" }); return; }
  const inhouse = (await inhouseReviews(tenantId)).slice(0, 8).map(({ source, rating, author, text, postedAt }) => ({ source, rating, author, text, postedAt }));
  const inAvg = inhouse.length ? inhouse.reduce((n, r) => n + r.rating, 0) / inhouse.length : null;
  res.json({ rating: inAvg ? Math.round(inAvg * 10) / 10 : null, count: inhouse.length, reviews: inhouse });
});

// parent/public → the compliant "also review us on Google" link (shown to
// EVERYONE after in-house feedback — never gated on the score).
reviews.get("/invite/:tenantId", async (req, res) => {
  const cfg = await tenantReviewCfg(req.params.tenantId);
  const url = cfg.inviteToGoogle === false ? null
    : cfg.googleReviewUrl?.trim() || (cfg.googlePlaceId ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(cfg.googlePlaceId)}` : null);
  res.json({ url });
});

// ── Google Business Profile connect (P2) ────────────────────────────────────
// Real OAuth scaffolding — active only once the platform sets the client creds
// AND our project is approved for the Business Profile API.
reviews.get("/google/connect", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const clientId = process.env.GOOGLE_BP_CLIENT_ID;
  const redirect = process.env.GOOGLE_BP_REDIRECT;
  if (!clientId || !redirect) { res.status(501).json({ error: "Google connect isn't set up on the platform yet.", needsPlatformSetup: true }); return; }
  const scope = encodeURIComponent("https://www.googleapis.com/auth/business.manage");
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&access_type=offline&prompt=consent&scope=${scope}&state=${auth.tenantId}`;
  res.json({ authUrl });
});
