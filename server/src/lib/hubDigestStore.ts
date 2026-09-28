import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "../firebase";
import { hubConfig } from "./hubCore";
import { mailIsLiveFor, sendMail } from "./mailer";
import { tenantSender } from "./sender";
import { sweep } from "./scheduler";
import { normLocale } from "./hubDigestEmail";
import {
  digestDue, prefDocId, processDigests, processNudges, subKey,
  type AttemptRow, type ClaimMeta, type Cfg, type EnrolRow, type HwRow, type Item, type LessonRow, type LogStore, type RunOpts, type SendFn, type SubRow, type TenantData,
} from "./hubDigest";

// Firestore + mail side of the parent digest / homework nudges (the pure rules are lib/hubDigest.ts).
//   hubDigestLog/{key}   the sent-log (idempotency + caps); ids + times only, no email content, no addresses
//   hubDigestPrefs/{tenant__email}  a parent's opt-outs {digest:false | nudge:false}
// Scheduling is OFF unless HUB_DIGEST_ENABLED=1. HUB_DIGEST_DRY=1 renders to HUB_DIGEST_OUT (default <tmp>/hub-digest) instead of sending.

const log = () => db.collection("hubDigestLog");
const prefs = () => db.collection("hubDigestPrefs");
const safeId = (k: string) => k.replace(/[\/\s]/g, "_");

export const firestoreLog: LogStore = {
  async claim(key: string, m: ClaimMeta) {
    const sent = await this.sentKinds(m.capKey);
    if (sent.size >= m.cap) return false;
    try {
      // create() fails if the doc exists — the atomic "first one wins" that makes a rerun (or two instances) safe.
      await log().doc(safeId(key)).create({ tenantId: m.tenantId, childId: m.childId, kind: m.kind, homeworkId: m.homeworkId ?? null, capKey: m.capKey, at: new Date().toISOString() });
      return true;
    } catch { return false; }
  },
  async release(key) { await log().doc(safeId(key)).delete(); },
  async has(key) { return (await log().doc(safeId(key)).get()).exists; },
  async sentKinds(capKey) {
    const snap = await log().where("capKey", "==", capKey).select("kind").get();
    return new Set(snap.docs.map((d) => d.get("kind") as string));
  },
};

/** The real sender: the provider's own name on the From line, and NEVER to an address mail isn't live for (dev). */
export function liveSender(tenantId: string): SendFn {
  let sender: Awaited<ReturnType<typeof tenantSender>> | undefined;
  return async (to, subject, html, _provider, headers) => {
    if (!mailIsLiveFor(to)) { console.log(`[hub-digest] "${subject}" → ${to} NOT SENT (mail not live for this address)`); return "not_live"; }
    sender ??= await tenantSender(tenantId);
    return sendMail(to, subject, html, sender, headers ? { headers } : undefined);
  };
}
/** Placeholder for dry runs: the pipeline is called with it but `dry` short-circuits before it is ever reached. */
export const neverSend: SendFn = async () => { throw new Error("dry run must never send"); };

const chunk10 = <T,>(xs: T[]) => Array.from({ length: Math.ceil(xs.length / 10) }, (_, i) => xs.slice(i * 10, i * 10 + 10));

/** Load everything a run for ONE tenant needs. `attempts` only when the digest is wanted (it is the heavy part).
 *  Cost guards (H3): enrolments + the per-franchise switches are read FIRST; with `skipIfOff` and no switch on the run
 *  returns an empty, inert TenantData without touching homework / submissions / lessons / attempts. `onlyChildId`
 *  loads one child's rows only (tutor preview) instead of the whole tenant. */
export async function loadTenantData(tenantId: string, now: Date, o: { attempts: boolean; onlyChildId?: string; skipIfOff?: "digest" | "nudges" | "either" }): Promise<TenantData> {
  const only = o.onlyChildId;
  const enrSnap = await db.collection("hubEnrolments").where("tenantId", "==", tenantId).get();
  const enrolments: EnrolRow[] = enrSnap.docs.map((d) => ({
    childId: d.get("childId"), childName: d.get("childName") ?? "", parentUid: d.get("parentUid") ?? "", parentEmail: d.get("parentEmail") ?? "",
    franchiseId: d.get("franchiseId") ?? null, active: d.get("active") !== false,
  }));

  const cfgs = new Map<string, Cfg>();
  for (const f of new Set(enrolments.map((e) => e.franchiseId ?? ""))) {
    const c = await hubConfig(tenantId, f || null);
    cfgs.set(f, { parentDigest: c.parentDigest, homeworkNudges: c.homeworkNudges, nudgeLeadHours: c.nudgeLeadHours });
  }
  const cfgFor = (f: string | null) => cfgs.get(f ?? "") ?? { parentDigest: false, homeworkNudges: false, nudgeLeadHours: 24 };
  if (o.skipIfOff) {
    const want = (c: Cfg) => (o.skipIfOff === "digest" ? c.parentDigest : o.skipIfOff === "nudges" ? c.homeworkNudges : c.parentDigest || c.homeworkNudges);
    if (![...cfgs.values()].some(want)) {
      return { tenantId, provider: "", enrolments: [], homework: [], submissions: new Map(), attempts: new Map(), lessons: [], optOut: new Set(), muted: new Set(), cfgFor, localeOf: () => normLocale(undefined) };
    }
  }
  const scoped = (col: string, arrayField?: string) => {
    let q: FirebaseFirestore.Query = db.collection(col).where("tenantId", "==", tenantId);
    if (only) q = arrayField ? q.where(arrayField, "array-contains", only) : q.where("childId", "==", only);
    return q.get();
  };
  const [hwSnap, subSnap, lessonSnap, prefSnap, provider] = await Promise.all([
    scoped("hubHomework", "assignedChildIds"),
    scoped("hubSubmissions"),
    scoped("hubLessons", "childIds"),
    prefs().where("tenantId", "==", tenantId).get(),
    tenantSender(tenantId).then((s) => s.name || "Your tutor").catch(() => "Your tutor"),
  ]);

  const cutoff = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const homework: HwRow[] = hwSnap.docs.filter((d) => String(d.get("dueAt") ?? "") >= cutoff).map((d) => ({
    id: d.id, title: d.get("title") ?? "", dueAt: d.get("dueAt"), createdAt: d.get("createdAt") ?? "", assignedChildIds: d.get("assignedChildIds") ?? [], franchiseId: d.get("franchiseId") ?? null,
  }));
  const hwIds = new Set(homework.map((h) => h.id));
  const submissions = new Map<string, SubRow>();
  for (const d of subSnap.docs) {
    const hid = d.get("homeworkId") as string;
    if (!hwIds.has(hid)) continue;
    const m = d.get("mark") as { score?: number; max?: number; markedAt?: string } | null;
    submissions.set(subKey(hid, d.get("childId")), { status: d.get("status"), submittedAt: d.get("submittedAt") ?? null, mark: m && typeof m.score === "number" && typeof m.max === "number" ? { score: m.score, max: m.max, markedAt: m.markedAt } : null });
  }
  const lcut = new Date(now.getTime() - 70 * 86_400_000).toISOString();
  const lessons: LessonRow[] = lessonSnap.docs.filter((d) => String(d.get("startsAt") ?? "") >= lcut).map((d) => ({
    id: d.id, title: d.get("title") ?? "", startsAt: d.get("startsAt"), status: d.get("status") ?? "", childIds: d.get("childIds") ?? [], attendance: d.get("attendance") ?? {},
  }));

  const attempts = new Map<string, AttemptRow[]>();
  if (o.attempts) {
    const acut = lcut;
    await Promise.all(enrolments.filter((e) => e.active && (!only || e.childId === only)).map(async (e) => {
      const base = db.collection("hubAttempts").where("tenantId", "==", tenantId).where("childId", "==", e.childId);
      const cols = ["assessmentTitle", "subject", "pct", "passMarkPct", "status", "assessmentType", "submittedAt"] as const;
      // The range read needs the composite index hubAttempts(tenantId, childId, submittedAt) (firestore.indexes.json). Until it is deployed
      // Firestore answers FAILED_PRECONDITION: degrade to the equality-only read (no composite index needed) and filter by date below.
      const s = await base.where("submittedAt", ">=", acut).select(...cols).get().catch((err: unknown) => {
        if (!/FAILED_PRECONDITION|requires an index|\b9 /i.test(String((err as { code?: unknown })?.code ?? "") + " " + String((err as Error)?.message ?? ""))) throw err;
        return base.select(...cols).get();
      });
      attempts.set(e.childId, s.docs.filter((d) => String(d.get("submittedAt") ?? "") >= acut).map((d) => ({
        title: d.get("assessmentTitle") ?? "", subject: d.get("subject") ?? "", pct: typeof d.get("pct") === "number" ? d.get("pct") : null, passMarkPct: d.get("passMarkPct") ?? 70,
        status: d.get("status"), type: d.get("assessmentType"), submittedAt: d.get("submittedAt") ?? null,
      })));
    }));
  }

  const optOut = new Set<string>();
  for (const d of prefSnap.docs) { const em = d.get("email") as string; if (d.get("digest") === false) optOut.add(`digest:${em}`); if (d.get("nudge") === false) optOut.add(`nudge:${em}`); }

  const emails = [...new Set(enrolments.map((e) => e.parentEmail.trim().toLowerCase()).filter(Boolean))];
  const muted = new Set<string>();
  for (const c of chunk10(emails)) {
    const snaps = await db.getAll(...c.map((e) => db.collection("notificationPrefs").doc(e)), { fieldMask: ["muted"] });
    for (const s of snaps) if ((s.get("muted") as Record<string, boolean> | undefined)?.learning) muted.add(s.id);
  }
  const uids = [...new Set(enrolments.map((e) => e.parentUid).filter(Boolean))];
  const locales = new Map<string, string>();
  for (let i = 0; i < uids.length; i += 200) {
    const snaps = await db.getAll(...uids.slice(i, i + 200).map((u) => db.collection("users").doc(u)), { fieldMask: ["locale"] });
    for (const s of snaps) if (s.exists) locales.set(s.id, s.get("locale"));
  }

  return {
    tenantId, provider, enrolments, homework, submissions, attempts, lessons, optOut, muted,
    cfgFor,
    localeOf: (uid) => normLocale(locales.get(uid)),
  };
}

/** Tenants that have at least one active enrolment (the only ones that can have parents to email). */
export async function tenantsWithStudents(): Promise<string[]> {
  const s = await db.collection("hubEnrolments").where("active", "==", true).select("tenantId").get();
  return [...new Set(s.docs.map((d) => d.get("tenantId") as string).filter(Boolean))];
}

export const HUB_DIGEST_ENABLED = () => process.env.HUB_DIGEST_ENABLED === "1";
export const outDir = () => process.env.HUB_DIGEST_OUT || join(tmpdir(), "hub-digest");

/** onRender for dry runs: write the rendered HTML to `dir` and return the path. */
export function fileWriter(dir: string, tenantId: string): NonNullable<RunOpts["onRender"]> {
  mkdirSync(dir, { recursive: true });
  return (r) => {
    const f = join(dir, safeId(`${tenantId}__${r.kind}__${r.childId}${r.homeworkId ? `__${r.homeworkId}` : ""}__${r.locale}.html`));
    writeFileSync(f, r.html);
    return f;
  };
}

export async function runTenant(tenantId: string, what: { digest?: boolean; nudges?: boolean }, o: { now?: Date; dry: boolean; dir?: string; ignoreSwitch?: boolean; onlyChildId?: string }): Promise<Item[]> {
  const now = o.now ?? new Date();
  const td = await loadTenantData(tenantId, now, { attempts: !!what.digest, onlyChildId: o.onlyChildId, skipIfOff: o.ignoreSwitch ? undefined : what.digest && what.nudges ? "either" : what.digest ? "digest" : "nudges" });
  const ro: RunOpts = { now, dry: o.dry, store: firestoreLog, send: o.dry ? neverSend : liveSender(tenantId), ignoreSwitch: o.ignoreSwitch, onlyChildId: o.onlyChildId, ...(o.dry && o.dir ? { onRender: fileWriter(o.dir, tenantId) } : {}) };
  return [...(what.digest ? await processDigests(td, ro) : []), ...(what.nudges ? await processNudges(td, ro) : [])];
}

/** Scheduler hooks. Nothing is registered unless HUB_DIGEST_ENABLED=1 (default: the whole feature is inert). */
export function startDigestSweeps(): void {
  if (!HUB_DIGEST_ENABLED()) return;
  const dry = process.env.HUB_DIGEST_DRY === "1";
  console.log(`[hub-digest] ENABLED (${dry ? `DRY → ${outDir()}` : "sending"}): weekly digest Sun 17:00 UK, nudges hourly`);
  const run = (what: { digest?: boolean; nudges?: boolean }) => async () => {
    if (what.digest && !digestDue(new Date())) return;
    for (const t of await tenantsWithStudents()) {
      try {
        const items = await runTenant(t, what, { dry, dir: dry ? outDir() : undefined });
        const n = items.filter((i) => i.status === "sent" || i.status === "dry").length;
        if (n) console.log(`[hub-digest] ${t}: ${n} ${dry ? "rendered" : "sent"}`);
      } catch (e) { console.error(`[hub-digest] ${t} failed:`, (e as Error).message); }
    }
  };
  sweep("hub-digest", 30 * 60_000, run({ digest: true }));
  sweep("hub-nudges", 60 * 60_000, run({ nudges: true }));
}
