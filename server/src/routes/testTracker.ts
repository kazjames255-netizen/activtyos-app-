// HQ Test tracker results. The scenario catalogue itself lives in code (lib/testTracker/catalogue.ts); this stores what was tried and what happened,
// so Kaz, Amir and Claude all see one shared state. Platform (HQ) role only. One document per check: testTrackerResults/{checkId}.

import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";

export const testTracker = Router();

testTracker.use((req, res, next) => {
  if (req.auth?.role !== "platform") {
    res.status(403).json({ error: "HQ only" });
    return;
  }
  next();
});

const STATUS = z.enum(["todo", "pass", "fail", "blocked", "fixed", "na"]);
const ACCOUNTS = ["company", "freelancer", "franchise", "head-office", "staff", "parent", "platform"] as const;
const col = () => db.collection("testTrackerResults");
const ID = /^[A-Z]{2,3}-\d{3,4}$/;

// GET /api/platform/test-tracker — every recorded result
testTracker.get("/", async (_req, res) => {
  const snap = await col().get();
  res.json({ results: snap.docs.map((d) => ({ checkId: d.id, ...d.data() })) });
});

const putSchema = z.object({
  status: STATUS,
  byAccount: z.record(z.enum(ACCOUNTS), STATUS).optional(),
  note: z.string().trim().max(2000).optional(),
  bug: z.string().trim().max(2000).optional(),
  fix: z.string().trim().max(2000).optional(),
});

// PUT /api/platform/test-tracker/:checkId — record a result (replaces status/notes, appends to the history)
testTracker.put("/:checkId", async (req, res) => {
  const checkId = String(req.params.checkId);
  if (!ID.test(checkId)) {
    res.status(400).json({ error: "Bad check id" });
    return;
  }
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const by = req.user?.email ?? "unknown";
  const at = new Date().toISOString();
  const ref = col().doc(checkId);
  await db.runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    const history = ((cur.get("history") as unknown[] | undefined) ?? []).slice(-99);
    history.push({ at, by, status: parsed.data.status, ...(parsed.data.note ? { note: parsed.data.note } : {}) });
    tx.set(ref, {
      status: parsed.data.status,
      ...(parsed.data.byAccount ? { byAccount: parsed.data.byAccount } : { byAccount: {} }),
      note: parsed.data.note ?? "",
      bug: parsed.data.bug ?? "",
      fix: parsed.data.fix ?? "",
      updatedBy: by,
      updatedAt: at,
      history,
    });
  });
  res.json({ ok: true, checkId, updatedBy: by, updatedAt: at });
});
