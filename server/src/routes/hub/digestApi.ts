import { Router } from "express";
import { db } from "../../firebase";
import { canSeeStudent, okId, requireEdit, resolveCtx } from "../../lib/hubCore";
import { buildDigest, firstName, hubLink, prefDocId, processDigests, processNudges, readToken, subKey, weekKey, type RunOpts, type TenantData } from "../../lib/hubDigest";
import { rateLimit } from "../../lib/rateLimit";
import { DIGEST_LOCALES, esc, normLocale, renderDigest, renderNudge, renderUnsubPage, type DigestData, type MailKind } from "../../lib/hubDigestEmail";
import { firestoreLog, loadTenantData, neverSend } from "../../lib/hubDigestStore";
import { tenantSender } from "../../lib/sender";

// Learning Hub — parent digest & homework nudges: tutor preview / dry-run (authed, mounted by routes/learningHub.ts)
// and the parent's public opt-out (mounted in index.ts BEFORE auth, like /api/emails/unsubscribe).
// Contract: docs/learning-hub.md → "Parent digest & homework nudges"; API: server/openapi.yaml.
// Nothing here ever sends mail. The switches live in settings.hub (parentDigest / homeworkNudges / nudgeLeadHours,
// edited through the existing PUT /api/learning-hub/config); sending itself is lib/hubDigestStore.ts (HUB_DIGEST_ENABLED=1).

export const hubDigestApi = Router();
export const hubDigestPublic = Router();

const KINDS: MailKind[] = ["digest", "nudge_before", "nudge_after"];

/** A made-up week, so a tutor can see the layout for a child who has nothing to report yet. */
const sampleDigest = (name: string, provider: string): DigestData => ({
  childName: name, provider,
  homework: [
    { title: "Fractions practice", status: "marked", dueAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), score: 9, max: 10 },
    { title: "Reading log", status: "submitted", dueAt: new Date(Date.now() - 86_400_000).toISOString() },
  ],
  quizzes: [{ title: "Times tables check", pct: 90 }], lessons: [{ title: "Live maths lesson" }], streakDays: 4, strongest: "Maths",
  celebrate: { kind: "score", title: "Fractions practice", pct: 90 },
  upcoming: [{ kind: "homework", title: "Spelling list 5", at: new Date(Date.now() + 3 * 86_400_000).toISOString() }],
});

// GET /digest/preview?childId=&kind=digest|nudge_before|nudge_after[&homeworkId=][&locale=xx] — the exact HTML a parent would get
// (tutors only, own scope). Defaults to the parent's own language; `locale=` shows any of the 11. When the child has nothing to
// report yet a SAMPLE is rendered (banner + X-Preview-Sample: 1). The opt-out link is inert here so a tutor can't click a parent out.
hubDigestApi.get("/digest/preview", rateLimit("hub-digest-preview", 20), async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const childId = String(req.query.childId ?? "");
  const kind = (String(req.query.kind ?? "digest") as MailKind);
  if (!okId(childId) || !KINDS.includes(kind)) { res.status(400).json({ error: "Pass childId and kind (digest, nudge_before or nudge_after)" }); return; }
  const td = await loadTenantData(ctx.tenantId, new Date(), { attempts: kind === "digest", onlyChildId: childId });
  const e = td.enrolments.find((x) => x.childId === childId);
  if (!e || !canSeeStudent(ctx, e.franchiseId)) { res.status(404).json({ error: "Student not found" }); return; }
  const wantLoc = typeof req.query.locale === "string" ? req.query.locale : "";
  if (wantLoc && !(DIGEST_LOCALES as string[]).includes(wantLoc)) { res.status(400).json({ error: `locale must be one of ${DIGEST_LOCALES.join(", ")}` }); return; }
  const locale = wantLoc ? normLocale(wantLoc) : td.localeOf(e.parentUid);
  const links = { hub: hubLink(childId), stop: "#preview-only" };
  const name = firstName(e.childName);
  let html: string, subject: string, sample = false;
  if (kind === "digest") {
    let d = buildDigest(td, e, new Date());
    if (!d) { d = sampleDigest(name, td.provider); sample = true; }
    ({ html, subject } = renderDigest(d, locale, links));
  } else {
    const hwId = typeof req.query.homeworkId === "string" ? req.query.homeworkId : "";
    const open = td.homework.filter((h) => h.assignedChildIds.includes(childId) && (td.submissions.get(subKey(h.id, childId))?.status ?? "assigned") === "assigned").sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const h = (hwId ? td.homework.find((x) => x.id === hwId && x.assignedChildIds.includes(childId)) : open[0]) ?? null;
    if (hwId && !h) { res.status(404).json({ error: "Homework not found for this student" }); return; }
    if (!h) sample = true;
    const due = h?.dueAt ?? new Date(Date.now() + (kind === "nudge_before" ? 20 : -30) * 3_600_000).toISOString();
    ({ html, subject } = renderNudge(kind, { childName: name, provider: td.provider, title: h?.title ?? "Fractions practice", dueAt: due }, locale, { ...links, hub: hubLink(childId, { tab: "homework", ...(h ? { hw: h.id } : {}) }) }));
  }
  if (sample) html = html.replace(/(<body[^>]*>)/, `$1<div style="background:#fff7d6;color:#7a5b00;padding:8px 14px;font:600 13px system-ui,sans-serif;text-align:center">SAMPLE — ${esc(name)} has nothing of this kind yet, so this is made-up content to show the layout.</div>`);
  res.set({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "sandbox; default-src 'none'; img-src https: data:; style-src 'unsafe-inline'", "X-Preview-Subject": encodeURIComponent(subject), "X-Preview-Locale": locale, "X-Preview-Sample": sample ? "1" : "0" }).send(html);
});

// POST /digest/run {what: "digest"|"nudges"|"both"} — DRY RUN for the caller's own students: what WOULD go out right now
// if the switches were on. Never sends, never touches the sent-log; no addresses in the answer. (Real sends: the scheduler, HUB_DIGEST_ENABLED=1.)
hubDigestApi.post("/digest/run", rateLimit("hub-digest-run", 4), async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const what = (req.body as { what?: string } | undefined)?.what ?? "both";
  if (!["digest", "nudges", "both"].includes(what)) { res.status(400).json({ error: "what must be digest, nudges or both" }); return; }
  const now = new Date();
  const full = await loadTenantData(ctx.tenantId, now, { attempts: what !== "nudges" });
  const td: TenantData = { ...full, enrolments: full.enrolments.filter((e) => canSeeStudent(ctx, e.franchiseId)) };
  const o: RunOpts = { now, dry: true, store: firestoreLog, send: neverSend, ignoreSwitch: true };
  const items = [...(what !== "nudges" ? await processDigests(td, o) : []), ...(what !== "digest" ? await processNudges(td, o) : [])];
  res.json({
    dry: true, at: now.toISOString(), week: weekKey(now),
    switches: { parentDigest: td.cfgFor(ctx.franchiseId).parentDigest, homeworkNudges: td.cfgFor(ctx.franchiseId).homeworkNudges },
    items: items.map(({ childId, childName, kind, homeworkId, locale, status, reason }) => ({ childId, childName, kind, homeworkId, locale, status, reason })),
  });
});

// DELETE /digest/opt-out/:childId?scope=digest|nudge — a tutor asks for a parent's opt-out to be put back.
// COMPLIANCE (M2): a parent's own unsubscribe is authoritative. A tutor can NEVER flip it back on, so this only reports:
//   · the parent is not opted out -> 200 {ok:true, optedOut:false} (nothing to do)
//   · the parent unsubscribed     -> 409 {code:"parent_unsubscribed"}; the request is logged (no address) and nothing is written.
// Only the parent can resubscribe (they ask the tutor to add them again through a fresh consent flow, or use the mail's own link flow).
hubDigestApi.delete("/digest/opt-out/:childId", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const scope = req.query.scope === "nudge" ? "nudge" : req.query.scope === "digest" ? "digest" : null;
  if (!scope || !okId(req.params.childId)) { res.status(400).json({ error: "scope must be digest or nudge" }); return; }
  const e = await db.collection("hubEnrolments").doc(`${ctx.tenantId}__${req.params.childId}`).get();
  if (!e.exists || e.get("tenantId") !== ctx.tenantId || !canSeeStudent(ctx, e.get("franchiseId") ?? null)) { res.status(404).json({ error: "Student not found" }); return; }
  const email = String(e.get("parentEmail") ?? "").trim().toLowerCase();
  const pref = email ? await db.collection("hubDigestPrefs").doc(prefDocId(ctx.tenantId, email)).get() : null;
  if (pref?.exists && pref.get(scope) === false) {
    console.log(`[hub-digest] tutor ${ctx.uid ?? ""} asked to re-enable ${scope} for child ${req.params.childId} in ${ctx.tenantId}: REFUSED, the parent unsubscribed themselves`);
    res.status(409).json({ code: "parent_unsubscribed", error: "This parent unsubscribed themselves, so only they can turn these emails back on." });
    return;
  }
  res.json({ ok: true, optedOut: false });
});

// ── the parent's opt-out (public: a mail client carries no auth) ────────────
// GET shows a confirm button (so a link-scanner opening the URL opts nobody out); POST does it. The signed token names the
// provider, address and which email ("digest" | "nudge") — tenant ids are public so it can't be forged.
const page = (res: import("express").Response, status: number, html: string) => { res.status(status).set({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }).send(html); };
const providerName = async (tenantId: string) => (await tenantSender(tenantId).catch(() => ({ name: "" }))).name || "your tutor";

hubDigestPublic.get("/unsubscribe", async (req, res) => {
  const loc = normLocale(req.query.l);
  const t = readToken(req.query.u);
  if (!t) { page(res, 400, renderUnsubPage(loc, { scope: "digest", provider: "", step: "bad" })); return; }
  page(res, 200, renderUnsubPage(loc, { scope: t.scope, provider: await providerName(t.tenantId), step: "confirm", action: `/api/hub-digest/unsubscribe?u=${encodeURIComponent(String(req.query.u))}&l=${loc}` }));
});
hubDigestPublic.post("/unsubscribe", async (req, res) => {
  const loc = normLocale(req.query.l);
  const t = readToken(req.query.u);
  if (!t) { page(res, 400, renderUnsubPage(loc, { scope: "digest", provider: "", step: "bad" })); return; }
  try {
    await db.collection("hubDigestPrefs").doc(prefDocId(t.tenantId, t.email)).set({ tenantId: t.tenantId, email: t.email, [t.scope]: false, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (e) { console.error("[hub-digest] opt-out failed:", (e as Error).message); page(res, 500, renderUnsubPage(loc, { scope: t.scope, provider: "", step: "bad" })); return; }
  page(res, 200, renderUnsubPage(loc, { scope: t.scope, provider: "", step: "done" }));
});
