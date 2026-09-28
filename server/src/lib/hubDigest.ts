import { sign, verify } from "./signing";
import { normLocale, renderDigest, renderNudge, type Celebrate, type DigestData, type MailKind, type Rendered } from "./hubDigestEmail";
import type { LocaleCode } from "../../../lib/i18n/config";

// Learning Hub parent communication — PURE logic (no Firestore, no mail transport, so it self-tests:
// hubDigest.selftest.ts). The Firestore side (loading, the sent-log, the sweeps) is lib/hubDigestStore.ts;
// the HTTP side is routes/hub/digestApi.ts. Contract: docs/learning-hub.md → "Parent digest & homework nudges".
//
//   FEATURE 1  weekly digest  — one per child per week (key digest:<tenant>:<child>:<sunday>)
//   FEATURE 2  homework nudge — "before" (default 24 h ahead) + a gentle "after", at most 2 per homework per child,
//              only while the child has NOT handed it in
//   Both: tenant switch OFF by default (settings.hub.parentDigest / homeworkNudges), a per-parent opt-out link,
//   the parent's own language (users/{uid}.locale, else English), muted "learning" emails respected, first name +
//   the child's own homework only, and every send goes through a sent-log claim so a rerun can never double-send.

export const MAX_DIGESTS_PER_WEEK = 1;
export const MAX_NUDGES_PER_HOMEWORK = 2;
/** A nudge never goes out in the evening / night (UK time). */
export const QUIET_FROM_MIN = 21 * 60;
export const QUIET_TO_MIN = 8 * 60;
/** The "not handed in yet" follow-up waits a day past the due date and is dropped after a week (stale = noise). */
export const AFTER_DELAY_H = 24;
export const AFTER_WINDOW_D = 7;
export const DIGEST_DOW = 0;            // Sunday
export const DIGEST_FROM_MIN = 17 * 60; // 17:00 UK
const H = 3_600_000, D = 24 * H;

export const apiBase = () => process.env.API_URL || "http://localhost:4000";
export const webBase = () => process.env.WEB_URL || "http://localhost:3000";

// ── opt-out tokens ─────────────────────────────────────────────────────────
// base64url(JSON [tenantId, email, scope]) + "." + HMAC — tamper-evident (tenant ids are public), no expiry (an
// opt-out link must keep working).
export type Scope = "digest" | "nudge";
export function makeToken(tenantId: string, email: string, scope: Scope): string {
  const body = Buffer.from(JSON.stringify([tenantId, email.trim().toLowerCase(), scope])).toString("base64url");
  return `${body}.${sign(`hubdigest:${body}`)}`;
}
export function readToken(t: unknown): { tenantId: string; email: string; scope: Scope } | null {
  if (typeof t !== "string") return null;
  const i = t.lastIndexOf(".");
  if (i < 1) return null;
  const body = t.slice(0, i);
  if (!verify(`hubdigest:${body}`, t.slice(i + 1))) return null;
  try {
    const [tenantId, email, scope] = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as [unknown, unknown, unknown];
    if (typeof tenantId !== "string" || typeof email !== "string" || (scope !== "digest" && scope !== "nudge")) return null;
    return { tenantId, email, scope };
  } catch { return null; }
}
export const unsubUrl = (tenantId: string, email: string, scope: Scope, locale: LocaleCode = "en") => `${apiBase()}/api/hub-digest/unsubscribe?u=${encodeURIComponent(makeToken(tenantId, email, scope))}&l=${locale}`;
export const prefDocId = (tenantId: string, email: string) => `${tenantId}__${email.trim().toLowerCase()}`;

/** /custdash/learninghub?tab=…&child=…&open=hw:<id> — the shape the hub reads (features/learninghub/family/link.ts). */
export function hubLink(childId: string, o?: { tab?: string; hw?: string }): string {
  const q = new URLSearchParams();
  if (o?.tab) q.set("tab", o.tab);
  q.set("child", childId);
  if (o?.hw) q.set("open", `hw:${o.hw}`);
  return `${webBase()}/custdash/learninghub?${q}`;
}

// ── time helpers (UK wall clock, like every other sweep) ───────────────────
export function ukParts(d: Date): { date: string; minutes: number; dow: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const date = `${String(g("year")).padStart(4, "0")}-${String(g("month")).padStart(2, "0")}-${String(g("day")).padStart(2, "0")}`;
  return { date, minutes: g("hour") * 60 + g("minute"), dow: new Date(`${date}T12:00:00Z`).getUTCDay() };
}
/** The UK date of the Sunday that starts this digest's week (the most recent Sunday, today included). */
export function weekKey(now: Date): string {
  const { date, dow } = ukParts(now);
  return new Date(new Date(`${date}T12:00:00Z`).getTime() - dow * D).toISOString().slice(0, 10);
}
export const inQuietHours = (now: Date) => { const m = ukParts(now).minutes; return m >= QUIET_FROM_MIN || m < QUIET_TO_MIN; };
/** Is it the digest slot? Sunday from 17:00 UK (the key stops a second send in the same week). */
export function digestDue(now: Date): boolean { const u = ukParts(now); return u.dow === DIGEST_DOW && u.minutes >= DIGEST_FROM_MIN; }
const day = (iso: string | null | undefined) => (iso ? ukParts(new Date(iso)).date : "");

// ── data shapes (already loaded; see hubDigestStore.ts) ────────────────────
export interface HwRow { id: string; title: string; dueAt: string; createdAt: string; assignedChildIds: string[]; franchiseId: string | null }
export interface SubRow { status: "assigned" | "submitted" | "marked"; submittedAt: string | null; mark: { score: number; max: number; markedAt?: string } | null }
export interface AttemptRow { title: string; subject: string; pct: number | null; passMarkPct: number; status: string; type: string; submittedAt: string | null }
export interface LessonRow { id: string; title: string; startsAt: string; status: string; childIds: string[]; attendance: Record<string, string> }
export interface EnrolRow { childId: string; childName: string; parentUid: string; parentEmail: string; franchiseId: string | null; active: boolean }
export interface Cfg { parentDigest: boolean; homeworkNudges: boolean; nudgeLeadHours: number }
export interface TenantData {
  tenantId: string;
  provider: string;
  enrolments: EnrolRow[];
  cfgFor: (franchiseId: string | null) => Cfg;
  localeOf: (parentUid: string) => LocaleCode;
  homework: HwRow[];
  submissions: Map<string, SubRow>;          // `${homeworkId}__${childId}`
  attempts: Map<string, AttemptRow[]>;       // childId → attempts
  lessons: LessonRow[];
  /** `${scope}:${email}` the parent switched off. */
  optOut: Set<string>;
  /** Lower-cased emails that muted "learning" mail in their notification prefs. */
  muted: Set<string>;
}
export const subKey = (hwId: string, childId: string) => `${hwId}__${childId}`;

// ── the digest (pure) ───────────────────────────────────────────────────────
const pctOf = (a: AttemptRow) => (typeof a.pct === "number" ? Math.round(a.pct) : null);

/** What happened to this child in the 7 days to `now`, and what is coming in the next 7. Empty week → null (no email). */
export function buildDigest(td: TenantData, e: EnrolRow, now: Date): DigestData | null {
  const from = now.getTime() - 7 * D, to = now.getTime() + 7 * D, nowMs = now.getTime();
  const inWeek = (iso: string | null | undefined) => { const t = iso ? Date.parse(iso) : NaN; return t >= from && t <= nowMs; };
  const mine = td.homework.filter((h) => h.assignedChildIds.includes(e.childId));

  const homework: DigestData["homework"] = [];
  for (const h of mine) {
    const s = td.submissions.get(subKey(h.id, e.childId));
    const status = s?.status ?? "assigned";
    const touched = inWeek(h.createdAt) || inWeek(s?.submittedAt) || inWeek(s?.mark?.markedAt) || (status === "assigned" && Date.parse(h.dueAt) >= from && Date.parse(h.dueAt) <= to);
    if (!touched) continue;
    homework.push({ title: h.title, status, dueAt: h.dueAt, ...(status === "marked" && s?.mark ? { score: s.mark.score, max: s.mark.max } : {}) });
  }
  homework.sort((a, b) => a.title.localeCompare(b.title));

  const done = (td.attempts.get(e.childId) ?? []).filter((a) => a.status !== "in_progress" && inWeek(a.submittedAt));
  const quizzes = done.map((a) => ({ title: a.title, pct: pctOf(a) })).slice(0, 8);
  const lessonsIn = td.lessons.filter((l) => l.status !== "cancelled" && l.childIds.includes(e.childId) && inWeek(l.attendance[e.childId]));
  const lessons = lessonsIn.map((l) => ({ title: l.title })).slice(0, 5);

  // Streak: consecutive UK days, ending today or yesterday, with any finished quiz or attended live lesson.
  const active = new Set<string>();
  for (const a of td.attempts.get(e.childId) ?? []) if (a.status !== "in_progress" && a.submittedAt) active.add(day(a.submittedAt));
  for (const l of td.lessons) if (l.attendance[e.childId]) active.add(day(l.attendance[e.childId]));
  let streakDays = 0;
  for (let i = 0, t = nowMs; i < 60; i++, t -= D) {
    const d = ukParts(new Date(t)).date;
    if (active.has(d)) streakDays++;
    else if (i > 0) break; // today may simply not have happened yet
  }

  // Strongest subject this week = best average % across ≥1 finished quiz.
  const bySub = new Map<string, number[]>();
  for (const a of done) if (a.subject && typeof a.pct === "number") bySub.set(a.subject, [...(bySub.get(a.subject) ?? []), a.pct]);
  let strongest: string | null = null, best = -1;
  for (const [s, v] of bySub) { const avg = v.reduce((x, y) => x + y, 0) / v.length; if (avg > best) { best = avg; strongest = s; } }

  const upcoming: DigestData["upcoming"] = [
    ...mine.filter((h) => td.submissions.get(subKey(h.id, e.childId))?.status !== "submitted" && td.submissions.get(subKey(h.id, e.childId))?.status !== "marked" && Date.parse(h.dueAt) > nowMs && Date.parse(h.dueAt) <= to).map((h) => ({ kind: "homework" as const, title: h.title, at: h.dueAt })),
    ...td.lessons.filter((l) => l.status !== "cancelled" && l.childIds.includes(e.childId) && Date.parse(l.startsAt) > nowMs && Date.parse(l.startsAt) <= to).map((l) => ({ kind: "lesson" as const, title: l.title, at: l.startsAt })),
  ].sort((a, b) => a.at.localeCompare(b.at)).slice(0, 6);

  if (!homework.length && !quizzes.length && !lessons.length && !upcoming.length) return null;

  return { childName: firstName(e.childName), provider: td.provider, homework, quizzes, lessons, streakDays, strongest, upcoming, celebrate: pickCelebration({ done, homework, streakDays, lessonCount: lessonsIn.length }) };
}

/** First name only — the ONLY part of a child's name that ever leaves the platform in these emails. */
export const firstName = (n: string) => (n || "").trim().split(/\s+/)[0] || "your child";

/** Positive-first: the best real thing we can say, in a fixed priority; a warm generic line only if nothing else is true. */
export function pickCelebration(x: { done: AttemptRow[]; homework: DigestData["homework"]; streakDays: number; lessonCount: number }): Celebrate {
  const scored = [
    ...x.done.filter((a) => typeof a.pct === "number" && a.pct >= a.passMarkPct).map((a) => ({ title: a.title, pct: Math.round(a.pct as number) })),
    ...x.homework.filter((h) => h.status === "marked" && h.max && (h.score ?? 0) / h.max >= 0.7).map((h) => ({ title: h.title, pct: Math.round(((h.score ?? 0) / (h.max as number)) * 100) })),
  ].sort((a, b) => b.pct - a.pct)[0];
  if (scored) return { kind: "score", ...scored };
  if (x.streakDays >= 3) return { kind: "streak", n: x.streakDays };
  if (x.homework.length && x.homework.every((h) => h.status !== "assigned")) return { kind: "allin" };
  if (x.done.length) return { kind: "quizzes", n: x.done.length };
  if (x.lessonCount) return { kind: "lessons", n: x.lessonCount };
  return { kind: "keep" };
}

// ── nudge decision (pure) ───────────────────────────────────────────────────
/** Which nudge (if any) is right for an OPEN (not handed in) homework at `now`. `sent` = kinds already sent for this child+homework. */
export function nudgeDecision(o: { dueAt: string; now: Date; leadHours: number; sent: ReadonlySet<string> }): "nudge_before" | "nudge_after" | null {
  if (o.sent.size >= MAX_NUDGES_PER_HOMEWORK) return null;
  const due = Date.parse(o.dueAt), now = o.now.getTime();
  if (Number.isNaN(due) || inQuietHours(o.now)) return null;
  if (now < due) return now >= due - o.leadHours * H && !o.sent.has("nudge_before") ? "nudge_before" : null;
  if (now >= due + AFTER_DELAY_H * H && now < due + AFTER_WINDOW_D * D && !o.sent.has("nudge_after")) return "nudge_after";
  return null;
}

// ── sent-log + sending, injected so tests never touch Firestore or the network ──
export interface ClaimMeta { tenantId: string; childId: string; kind: MailKind; homeworkId?: string | null; capKey: string; cap: number }
export interface LogStore {
  /** Atomically reserve `key`. False = already reserved (a rerun) OR the cap for `capKey` is used up. */
  claim(key: string, meta: ClaimMeta): Promise<boolean>;
  /** Give the reservation back (the send failed) so the next sweep retries. */
  release(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  /** Kinds already sent for this cap key (e.g. "nudge:<hw>:<child>"). */
  sentKinds(capKey: string): Promise<Set<string>>;
}
/** true = accepted; false = refused; "not_live" = mail is not live for this address (dev: MAIL_LIVE / MAIL_ALLOWLIST) — nothing was sent and the log is NOT burned. */
export type SendFn = (to: string, subject: string, html: string, providerName: string, headers?: Record<string, string>) => Promise<boolean | "not_live">;

export interface Item { childId: string; childName: string; kind: MailKind; homeworkId?: string; locale: LocaleCode; status: "sent" | "dry" | "skipped" | "failed"; reason?: string; file?: string }

export interface RunOpts {
  now: Date;
  /** Render + report, never claim the log, never send. */
  dry: boolean;
  store: LogStore;
  send: SendFn;
  /** Dry runs only: called with each rendered email (the CLI writes it to a file). */
  onRender?: (r: Rendered & { childId: string; kind: MailKind; homeworkId?: string }) => string | void;
  /** Also process tenants/children whose tenant switch is OFF (a tutor's dry-run "what would go out if I turned it on"). */
  ignoreSwitch?: boolean;
  onlyChildId?: string;
}

async function deliver(o: RunOpts, key: string, meta: ClaimMeta, to: string, r: Rendered, it: Omit<Item, "status">, provider: string, stopUrl?: string): Promise<Item> {
  if (o.dry) {
    const file = o.onRender?.({ ...r, childId: it.childId, kind: it.kind, homeworkId: it.homeworkId }) || undefined;
    const already = await o.store.has(key);
    return { ...it, status: "dry", ...(already ? { reason: "already_sent" } : {}), ...(file ? { file } : {}) };
  }
  if (!(await o.store.claim(key, meta))) return { ...it, status: "skipped", reason: "already_sent_or_capped" };
  try {
    // RFC 8058 one-click: the POST to the same signed link opts the parent out (the public route already does exactly that on POST).
    const headers = stopUrl ? { "List-Unsubscribe": `<${stopUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined;
    const ok = await o.send(to, r.subject, r.html, provider, headers);
    if (ok === "not_live") { await o.store.release(key); return { ...it, status: "skipped", reason: "mail_not_live" }; }
    if (!ok) throw new Error("transport refused");
    return { ...it, status: "sent" };
  } catch (e) {
    await o.store.release(key).catch(() => {});
    return { ...it, status: "failed", reason: (e as Error).message };
  }
}

/** The weekly digest for one tenant's enrolled children. */
export async function processDigests(td: TenantData, o: RunOpts): Promise<Item[]> {
  const out: Item[] = [];
  const wk = weekKey(o.now);
  for (const e of td.enrolments) {
    if (!e.active || !e.parentEmail || (o.onlyChildId && e.childId !== o.onlyChildId)) continue;
    const cfg = td.cfgFor(e.franchiseId);
    if (!cfg.parentDigest && !o.ignoreSwitch) continue;
    const email = e.parentEmail.trim().toLowerCase();
    const locale = td.localeOf(e.parentUid);
    const it = { childId: e.childId, childName: firstName(e.childName), kind: "digest" as const, locale };
    if (td.optOut.has(`digest:${email}`)) { out.push({ ...it, status: "skipped", reason: "parent_opted_out" }); continue; }
    if (td.muted.has(email)) { out.push({ ...it, status: "skipped", reason: "parent_muted_learning_emails" }); continue; }
    const data = buildDigest(td, e, o.now);
    if (!data) { out.push({ ...it, status: "skipped", reason: "nothing_to_report" }); continue; }
    const r = renderDigest(data, locale, { hub: hubLink(e.childId), stop: unsubUrl(td.tenantId, email, "digest", locale) });
    const key = `digest:${td.tenantId}:${e.childId}:${wk}`;
    out.push(await deliver(o, key, { tenantId: td.tenantId, childId: e.childId, kind: "digest", capKey: `digest:${td.tenantId}:${e.childId}:${wk}`, cap: MAX_DIGESTS_PER_WEEK }, email, r, it, td.provider, unsubUrl(td.tenantId, email, "digest", locale)));
  }
  return out;
}

/** Homework reminders for one tenant. */
export async function processNudges(td: TenantData, o: RunOpts): Promise<Item[]> {
  const out: Item[] = [];
  const byChild = new Map(td.enrolments.filter((e) => e.active && e.parentEmail).map((e) => [e.childId, e]));
  for (const h of td.homework) {
    for (const childId of h.assignedChildIds) {
      const e = byChild.get(childId);
      if (!e || (o.onlyChildId && childId !== o.onlyChildId)) continue;
      const st = td.submissions.get(subKey(h.id, childId))?.status ?? "assigned";
      if (st !== "assigned") continue; // handed in (or marked): never nudge
      const cfg = td.cfgFor(e.franchiseId);
      if (!cfg.homeworkNudges && !o.ignoreSwitch) continue;
      const email = e.parentEmail.trim().toLowerCase();
      const capKey = `nudge:${h.id}:${childId}`;
      // Pure timing check first (no I/O): only a homework that is actually in a nudge window reaches the sent-log query.
      if (!nudgeDecision({ dueAt: h.dueAt, now: o.now, leadHours: cfg.nudgeLeadHours, sent: new Set() })) continue;
      const kind = nudgeDecision({ dueAt: h.dueAt, now: o.now, leadHours: cfg.nudgeLeadHours, sent: await o.store.sentKinds(capKey) });
      if (!kind) continue;
      const locale = td.localeOf(e.parentUid);
      const it = { childId, childName: firstName(e.childName), kind, homeworkId: h.id, locale };
      if (td.optOut.has(`nudge:${email}`)) { out.push({ ...it, status: "skipped", reason: "parent_opted_out" }); continue; }
      if (td.muted.has(email)) { out.push({ ...it, status: "skipped", reason: "parent_muted_learning_emails" }); continue; }
      const r = renderNudge(kind, { childName: firstName(e.childName), provider: td.provider, title: h.title, dueAt: h.dueAt }, locale, { hub: hubLink(childId, { tab: "homework", hw: h.id }), stop: unsubUrl(td.tenantId, email, "nudge", locale) });
      out.push(await deliver(o, `${capKey}:${kind}`, { tenantId: td.tenantId, childId, kind, homeworkId: h.id, capKey, cap: MAX_NUDGES_PER_HOMEWORK }, email, r, it, td.provider, unsubUrl(td.tenantId, email, "nudge", locale)));
    }
  }
  return out;
}

export { normLocale };
