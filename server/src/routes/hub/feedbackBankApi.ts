import { Router } from "express";
import { z } from "zod";
import { db } from "../../firebase";
import { requireEdit, resolveCtx } from "../../lib/hubCore";
import { nowIso } from "./teachingCommon";

// Learning Hub — a tutor's FEEDBACK BANK: the comments they type most, saved once and shown as one-tap chips in the marking dialog.
// One small document per tutor per provider (`hubFeedbackBank/{tenantId}__{uid}`), private to that tutor. Capped so it stays a shortlist.
//   GET /feedback-bank            → { snippets: string[], max, maxLen }
//   PUT /feedback-bank {snippets} → replaces the list (add / edit / delete / reorder are all "save the new list")

export const hubFeedbackBankApi = Router();
const bank = db.collection("hubFeedbackBank");
export const MAX_SNIPPETS = 30;
export const MAX_SNIPPET_LEN = 200;
const docId = (tenantId: string, uid: string) => `${tenantId}__${uid}`;

/** Trim, drop empties and repeats (keeping the first, in order), and refuse a list over the caps. */
export function cleanSnippets(list: string[]): string[] | string {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const t = raw.replace(/\s+/g, " ").trim();
    if (!t) continue;
    if (t.length > MAX_SNIPPET_LEN) return `Each comment can be up to ${MAX_SNIPPET_LEN} characters`;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); out.push(t);
  }
  if (out.length > MAX_SNIPPETS) return `You can save up to ${MAX_SNIPPETS} comments`;
  return out;
}

hubFeedbackBankApi.get("/feedback-bank", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const snap = await bank.doc(docId(ctx.tenantId, ctx.uid)).get();
  const snippets = snap.exists && Array.isArray(snap.get("snippets")) ? (snap.get("snippets") as unknown[]).filter((x): x is string => typeof x === "string") : [];
  res.json({ snippets, max: MAX_SNIPPETS, maxLen: MAX_SNIPPET_LEN });
});

const putBody = z.object({ snippets: z.array(z.string().max(2000)).max(200) });
hubFeedbackBankApi.put("/feedback-bank", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = putBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const clean = cleanSnippets(parsed.data.snippets);
  if (typeof clean === "string") { res.status(400).json({ error: clean }); return; }
  await bank.doc(docId(ctx.tenantId, ctx.uid)).set({ tenantId: ctx.tenantId, uid: ctx.uid, snippets: clean, updatedAt: nowIso() });
  res.json({ snippets: clean, max: MAX_SNIPPETS, maxLen: MAX_SNIPPET_LEN });
});
