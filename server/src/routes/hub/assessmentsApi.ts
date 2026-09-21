import { Router } from "express";
import { db } from "../../firebase";
import { forgetSettings } from "../../middleware/access";
import { pingHub } from "../../lib/hubPing";
import { hubConfig, libraryDocId, requireEdit, resolveCtx, scopedChildren } from "../../lib/hubCore";
import { mergeHub, type HubSettings } from "../../../../lib/hubConfig";
import { GROUP_COLOURS, HUB_LIMITS, MAX_VIDEOS, validateHubPatch } from "../../lib/hubRules";
import { hubAssessmentsCrud } from "./assessments";
import { hubAttemptsApi } from "./attempts";
import { hubMasteryApi } from "./mastery";
import { hubQuestionsApi } from "./questions";

// Learning Hub — config, questions, assessments (quiz + diagnostic), attempts &
// scoring, mastery. Mounted by routes/learningHub.ts. Contract: docs/learning-hub.md.
// Every handler starts with resolveCtx() from ../../lib/hubCore. Split by topic:
//   questions.ts    the question bank (tutors)
//   assessments.ts  quizzes + diagnostics (tutors author; families list)
//   attempts.ts     start / submit / mark / diagnostic waive + reset (server-side marking)
//   mastery.ts      dashboard data + the stored, recomputable rows
export const hubAssessmentsApi = Router();

/** Everything a screen needs to know about the hub's settings and its limits. */
const configOut = (hub: HubSettings, canEdit: boolean) => ({
  hub, canEdit,
  bands: [...hub.masteryBands].sort((a, b) => a.min - b.min),
  limits: { ...HUB_LIMITS, maxVideos: MAX_VIDEOS, age: { min: 0, max: 25 }, questionImageBytes: 750_000, groupNameMax: 60 },
  groupColours: GROUP_COLOURS,
});

// GET /config — settings.hub merged over the defaults (question kinds, pass mark,
// reveal policy, mastery bands, retake policy, year groups…), plus `bands` (sorted),
// `limits` (what PUT /config accepts) and `groupColours`. A family gets its child's franchise's config.
hubAssessmentsApi.get("/config", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  const franchiseId = ctx.canEdit ? ctx.franchiseId : scopedChildren(ctx)[0]?.franchiseId ?? null;
  res.json(configOut(await hubConfig(ctx.tenantId, franchiseId), ctx.canEdit));
});

// PUT /config {hub: Partial<HubSettings>} — a tutor edits mastery levels, pass mark, retake policy, year groups…
// without opening Setup. Validated (lib/hubRules.ts validateHubPatch), merged into the caller's OWN libraries doc
// (a franchise's Setup is separate from head office's), and the settings cache dropped so it applies at once.
// Staff need the Learning Hub area on Edit (middleware/access.ts gates every non-GET on it).
hubAssessmentsApi.put("/config", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const v = validateHubPatch((req.body as { hub?: unknown } | undefined)?.hub);
  if (!v.ok) { res.status(400).json({ error: v.error }); return; }
  const ref = db.collection("libraries").doc(libraryDocId(ctx));
  const stored = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    let data: Record<string, unknown> = snap.exists ? (snap.data() as Record<string, unknown>) : { tenantId: ctx.tenantId, ...(ctx.franchiseId ? { franchiseId: ctx.franchiseId } : {}) };
    // A franchise's library is seeded from head office's on first read (routes/library.ts) — don't pre-empt that with a near-empty doc.
    if (!snap.exists && ctx.franchiseId) {
      const ho = await tx.get(db.collection("libraries").doc(ctx.tenantId));
      if (ho.exists) data = { ...(ho.data() as Record<string, unknown>), tenantId: ctx.tenantId, franchiseId: ctx.franchiseId };
    }
    const settings = { ...((data.settings as Record<string, unknown> | undefined) ?? {}) };
    const hub = { ...((settings.hub as Partial<HubSettings> | undefined) ?? {}), ...v.patch };
    tx.set(ref, { ...data, settings: { ...settings, hub } });
    return hub;
  });
  forgetSettings(ctx.tenantId);
  // A subject colour is on every hub screen (families' too): tell open hubs to re-read (they refetch the config with the topics).
  if (v.patch.subjectColours) pingHub(ctx.tenantId, "hubTopics");
  const merged = mergeHub(stored);
  // `hub` is the merged HubSettings (same body as GET /config); its fields are also spread at the top level.
  res.json({ ...merged, ...configOut(merged, true) });
});

hubAssessmentsApi.use(hubQuestionsApi);
hubAssessmentsApi.use(hubAssessmentsCrud);
hubAssessmentsApi.use(hubAttemptsApi);
hubAssessmentsApi.use(hubMasteryApi);
