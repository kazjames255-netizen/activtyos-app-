// Learning Hub — pure rules (no Firestore, no Express) so they can be self-tested
// (server/src/hubSelfTest3.ts) and can't drift per route: UK year group from a
// date of birth, who an assessment is FOR (audience), the retake decision, YouTube
// link parsing, the overall attainment band and validation of editable hub settings.
// Contract: docs/learning-hub.md → "Round 3 additions".

import { SUBJECT_COLOURS_MAX, SUBJECT_PALETTE_KEYS, subjectColourKey, type HubSettings } from "../../../lib/hubConfig";

// ── Year group / age ─────────────────────────────────────────────────────────

/** A date of birth as year / 0-based month / day, or null. Accepts "2018-03-14"
 *  (read as the calendar date, no timezone shift) or anything Date can parse
 *  ("14 Mar 2018", which is how some family profiles store it). */
export function parseDob(dob: unknown): { y: number; m: number; d: number } | null {
  if (typeof dob !== "string" || !dob.trim()) return null;
  const s = dob.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(s);
  let y: number, m: number, d: number;
  if (iso) { y = +iso[1]; m = +iso[2] - 1; d = +iso[3]; }
  else {
    const t = new Date(s);
    if (Number.isNaN(t.getTime())) return null;
    y = t.getFullYear(); m = t.getMonth(); d = t.getDate();
  }
  if (m < 0 || m > 11 || d < 1 || d > 31 || y < 1900) return null;
  return { y, m, d };
}

/** Whole years old on `on` (defaults to now); null when the dob is unusable or in the future. */
export function ageInYears(dob: unknown, on: Date = new Date()): number | null {
  const b = parseDob(dob);
  if (!b) return null;
  let a = on.getFullYear() - b.y;
  if (on.getMonth() < b.m || (on.getMonth() === b.m && on.getDate() < b.d)) a--;
  return a >= 0 && a <= 120 ? a : null;
}

/** England's school-year rule: the academic year starts 1 Sept; a child's year is set by
 *  their age ON 31 AUGUST before it starts — 4 = Reception, 5 = Year 1 … 17 = Year 13. */
export function ukYearGroup(dob: unknown, on: Date = new Date()): string | null {
  const b = parseDob(dob);
  if (!b) return null;
  const startYear = on.getMonth() >= 8 ? on.getFullYear() : on.getFullYear() - 1; // year of the 1 Sept that began this academic year
  let age = startYear - b.y;
  if (b.m > 7) age--; // birthday falls after 31 Aug, so they hadn't had it yet
  const idx = age - 4;
  if (idx === 0) return "Reception";
  if (idx >= 1 && idx <= 13) return `Year ${idx}`;
  return null;
}

/** The tenant's own spelling of `label` if their list has it (case-insensitive), else null. */
export const inList = (list: string[], label: string | null | undefined): string | null => {
  if (!label) return null;
  const l = label.trim().toLowerCase();
  return list.find((x) => x.trim().toLowerCase() === l) ?? null;
};

/** The UK year group for a dob — only when the tenant's `yearGroups` contains that label. */
export const yearGroupFromDob = (dob: unknown, yearGroups: string[], on: Date = new Date()): string | null => inList(yearGroups, ukYearGroup(dob, on));

/** What is stored about a student's year group on their enrolment. `yearGroupAuto`
 *  means "filled in from the dob at enrolment" — it then keeps moving up each
 *  September instead of going stale. */
export interface YearGroupFields { yearGroup?: string | null; yearGroupAuto?: boolean }

/** The year group to treat a student as being in NOW.
 *  auto → recomputed from the dob; tutor-tagged → as tagged; explicit null → unknown;
 *  never set (an enrolment made before year groups existed) → derived from the dob. */
export function effectiveYearGroup(e: YearGroupFields, dob: unknown, yearGroups: string[], on: Date = new Date()): string | null {
  if (e.yearGroupAuto === true) return yearGroupFromDob(dob, yearGroups, on);
  if (typeof e.yearGroup === "string" && e.yearGroup.trim()) return e.yearGroup.trim();
  if (e.yearGroup === null) return null;
  return yearGroupFromDob(dob, yearGroups, on);
}

// ── Audience ─────────────────────────────────────────────────────────────────

export interface Audience { yearGroups: string[]; ageMin: number | null; ageMax: number | null }
export const everyone = (): Audience => ({ yearGroups: [], ageMin: null, ageMax: null });
export const isEveryone = (a: Audience) => !a.yearGroups.length && a.ageMin === null && a.ageMax === null;

const asAge = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(25, Math.round(v))) : null);

/** A tolerant reader for a STORED audience (older assessments have none → everyone). */
export function normAudience(raw: unknown): Audience {
  if (!raw || typeof raw !== "object") return everyone();
  const r = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const yearGroups: string[] = [];
  for (const g of Array.isArray(r.yearGroups) ? r.yearGroups : []) {
    if (typeof g !== "string" || !g.trim() || seen.has(g.trim().toLowerCase())) continue;
    seen.add(g.trim().toLowerCase());
    yearGroups.push(g.trim());
  }
  return { yearGroups, ageMin: asAge(r.ageMin), ageMax: asAge(r.ageMax) };
}

/** Canonical form for "is this the SAME audience" (order and case of year groups don't matter). */
export const audienceKey = (a: Audience) => `${[...a.yearGroups].map((g) => g.toLowerCase()).sort().join("|")}#${a.ageMin ?? ""}-${a.ageMax ?? ""}`;

export type Fit = "yes" | "no" | "unknown";

/** Does this student fit the audience? Year groups and the age range must BOTH fit
 *  where set. A fact that is unknown (no year group / no dob) never excludes — the
 *  answer is "unknown" so the assessment is shown flagged, not hidden. */
export function audienceFit(a: Audience, kid: { yearGroup: string | null; age: number | null }): Fit {
  if (isEveryone(a)) return "yes";
  let unknown = false;
  if (a.yearGroups.length) {
    if (!kid.yearGroup) unknown = true;
    else if (!inList(a.yearGroups, kid.yearGroup)) return "no";
  }
  if (a.ageMin !== null || a.ageMax !== null) {
    if (kid.age === null) unknown = true;
    else if ((a.ageMin !== null && kid.age < a.ageMin) || (a.ageMax !== null && kid.age > a.ageMax)) return "no";
  }
  return unknown ? "unknown" : "yes";
}

// ── Retakes ──────────────────────────────────────────────────────────────────

export type RetakePolicy = "unlimited" | "once" | "cooldown";
export interface RetakeResult { allowed: boolean; reason: "once" | "cooldown" | "break" | null; nextAvailableAt: string | null }

/** How many of a child's most recent FINISHED attempts at one assessment were NOT passed, back to back (newest first), and when the
 *  newest one was handed in. A pass — or a paper still with the tutor (`pending_marking`) — ends the streak. */
export function failStreak(rows: { status: string; pct: number | null; passMarkPct: number; submittedAt: string | null }[]): { count: number; lastAt: string | null } {
  const done = rows.filter((r) => r.status !== "in_progress").sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
  let count = 0;
  for (const r of done) { if (r.status === "marked" && (r.pct ?? 0) < r.passMarkPct) count++; else break; }
  return { count, lastAt: count ? done[0].submittedAt : null };
}

/** May a child start this assessment again? `finishedAt` = submittedAt of each FINISHED
 *  attempt (a running one is always resumable, decided elsewhere); `granted` = the
 *  tutor allowed one more. Never-attempted → allowed. Under "unlimited" a short break kicks in after
 *  `breakAfter` not-passed attempts in a row (`streak`), so a child can't grind through the paper hunting for the key. */
export function retakeDecision(p: { policy: RetakePolicy; cooldownHours: number; finishedAt: (string | null | undefined)[]; granted: boolean; now?: number; streak?: { count: number; lastAt: string | null }; breakAfter?: number; breakMinutes?: number }): RetakeResult {
  const ok: RetakeResult = { allowed: true, reason: null, nextAvailableAt: null };
  if (!p.finishedAt.length || p.granted) return ok;
  const now = p.now ?? Date.now();
  if (p.policy === "unlimited") {
    const after = p.breakAfter ?? 0;
    if (after > 0 && p.streak && p.streak.count >= after && p.streak.lastAt) {
      const next = (Date.parse(p.streak.lastAt) || 0) + Math.max(1, p.breakMinutes ?? 30) * 60_000;
      if (now < next) return { allowed: false, reason: "break", nextAvailableAt: new Date(next).toISOString() };
    }
    return ok;
  }
  if (p.policy === "once") return { allowed: false, reason: "once", nextAvailableAt: null };
  const last = Math.max(0, ...p.finishedAt.map((s) => (s ? Date.parse(s) || 0 : 0)));
  const next = last + Math.max(1, p.cooldownHours) * 3_600_000;
  return now >= next ? ok : { allowed: false, reason: "cooldown", nextAvailableAt: new Date(next).toISOString() };
}

/** The policy that applies: the assessment's own unless it is "inherit"/unset. */
export function effectiveRetake(asm: { retakePolicy?: string | null; retakeCooldownHours?: number | null }, cfg: Pick<HubSettings, "retakePolicy" | "retakeCooldownHours">): { policy: RetakePolicy; cooldownHours: number } {
  const own = asm.retakePolicy;
  if (own === "unlimited" || own === "once" || own === "cooldown") {
    return { policy: own, cooldownHours: own === "cooldown" && asm.retakeCooldownHours ? asm.retakeCooldownHours : cfg.retakeCooldownHours };
  }
  return { policy: cfg.retakePolicy, cooldownHours: cfg.retakeCooldownHours };
}

// ── YouTube ──────────────────────────────────────────────────────────────────

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const YT_NOCOOKIE = new Set(["youtube-nocookie.com", "www.youtube-nocookie.com"]);

/** A YouTube video id (and optional start, seconds) from the ONLY link shapes we accept:
 *  youtube.com/watch?v=ID · youtu.be/ID · youtube.com/shorts/ID · youtube.com/embed/ID ·
 *  youtube-nocookie.com/embed/ID. Anything else — other hosts, lookalikes, credentials,
 *  odd ports, non-http schemes — is null. */
export function parseYouTube(input: unknown): { id: string; start: number | null } | null {
  if (typeof input !== "string") return null;
  let s = input.trim();
  if (!s || s.length > 500) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^[a-z0-9.-]+:\d/i.test(s)) return null; // javascript:, data:, mailto: …
    s = `https://${s}`;
  }
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password || (u.port && u.port !== "80" && u.port !== "443")) return null;
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);
  let id: string | null = null;
  if (YT_HOSTS.has(host)) {
    if (parts.length === 1 && parts[0] === "watch") id = u.searchParams.get("v");
    else if (parts.length === 2 && (parts[0] === "shorts" || parts[0] === "embed")) id = parts[1];
  } else if (host === "youtu.be") {
    if (parts.length === 1) id = parts[0];
  } else if (YT_NOCOOKIE.has(host)) {
    if (parts.length === 2 && parts[0] === "embed") id = parts[1];
  }
  if (!id || !YT_ID.test(id)) return null;
  const t = u.searchParams.get("t") ?? u.searchParams.get("start");
  const m = t ? /^(\d{1,5})s?$/.exec(t) : null;
  return { id, start: m ? Math.min(86_400, +m[1]) : null };
}

export interface StoredVideo { id: string; title: string; start: number | null }
export const MAX_VIDEOS = 6;

/** Body `videos` → what is stored, or a message for a 400. */
export function cleanVideos(list: { url: string; title?: string; start?: number }[] | undefined): StoredVideo[] | string {
  if (!list?.length) return [];
  if (list.length > MAX_VIDEOS) return `Add up to ${MAX_VIDEOS} videos`;
  const out: StoredVideo[] = [];
  for (const v of list) {
    const p = parseYouTube(v.url);
    if (!p) return "Only YouTube links are supported (youtube.com/watch?v=…, youtu.be/…, /shorts/… or /embed/…)";
    const start = v.start !== undefined ? v.start : p.start;
    out.push({ id: p.id, title: (v.title ?? "").trim().slice(0, 120), start: start && start > 0 ? Math.floor(start) : null });
  }
  return out;
}

/** Stored video → what a client gets. Never emits anything but these two YouTube hosts. */
export function videoOut(v: StoredVideo) {
  const start = v.start && v.start > 0 ? Math.floor(v.start) : null;
  return {
    id: v.id, title: v.title ?? "", start,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${v.id}${start ? `?start=${start}` : ""}`,
  };
}
/** Defensive: only ids that still match the 11-char shape leave the server. */
export const videosOut = (list: StoredVideo[] | undefined) => (list ?? []).filter((v) => v && YT_ID.test(v.id)).map(videoOut);

// ── Overall attainment ───────────────────────────────────────────────────────

export interface Overall {
  masteryPct: number | null; band: string | null; bandIndex: number; bandCount: number;
  next: { label: string; min: number } | null; toNext: number | null; subjectsCounted: number;
}

/** Where the child ACTUALLY is: the mean of their attempted subjects, looked up in the
 *  tenant's bands. `bandIndex` is 0-based into the ascending band list. null = nothing attempted yet. */
export function overallAttainment(subjectPcts: (number | null)[], bands: { min: number; label: string }[]): Overall | null {
  const xs = subjectPcts.filter((x): x is number => typeof x === "number");
  if (!xs.length || !bands.length) return null;
  const sorted = [...bands].sort((a, b) => a.min - b.min);
  const pct = Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  let idx = -1;
  sorted.forEach((b, i) => { if (b.min <= pct) idx = i; });
  const next = idx >= 0 && idx + 1 < sorted.length ? sorted[idx + 1] : null;
  return {
    masteryPct: pct, band: idx >= 0 ? sorted[idx].label : null, bandIndex: Math.max(0, idx), bandCount: sorted.length,
    next: next ? { label: next.label, min: next.min } : null, toNext: next ? Math.max(0, next.min - pct) : null, subjectsCounted: xs.length,
  };
}

// ── Editable settings ────────────────────────────────────────────────────────

export const HUB_LIMITS = {
  bands: { min: 2, max: 8, labelMax: 24 }, passMarkPct: { min: 0, max: 100 }, retakeCooldownHours: { min: 1, max: 720 }, retakeBreakAfter: { min: 0, max: 10 }, retakeBreakMinutes: { min: 5, max: 720 },
  yearGroups: { max: 30, labelMax: 24 }, homeworkDueDays: { min: 1, max: 90 }, srsMinEase: { min: 1.1, max: 2.5 },
} as const;

const int = (v: unknown, lo: number, hi: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;

/** Validate a PUT /config body's `hub`. Only the keys a tutor may edit from the hub are
 *  accepted (question types are a Setup matter: renaming one changes how questions mark). */
export function validateHubPatch(raw: unknown): { ok: true; patch: Partial<HubSettings> } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Send {hub: {…}}" };
  const r = raw as Record<string, unknown>;
  const patch: Partial<HubSettings> = {};
  const L = HUB_LIMITS;
  for (const [k, v] of Object.entries(r)) {
    switch (k) {
      case "masteryBands": {
        if (!Array.isArray(v) || v.length < L.bands.min || v.length > L.bands.max) return { ok: false, error: `Use between ${L.bands.min} and ${L.bands.max} levels` };
        const out: { min: number; label: string }[] = [];
        for (const b of v) {
          const o = (b ?? {}) as Record<string, unknown>;
          const label = typeof o.label === "string" ? o.label.trim().replace(/\s+/g, " ") : "";
          if (!label || label.length > L.bands.labelMax) return { ok: false, error: `Each level needs a name of 1–${L.bands.labelMax} characters` };
          if (!int(o.min, 0, 100)) return { ok: false, error: "Each level's starting percentage must be a whole number from 0 to 100" };
          out.push({ min: o.min, label });
        }
        if (out[0].min !== 0) return { ok: false, error: "The lowest level must start at 0%" };
        for (let i = 1; i < out.length; i++) if (out[i].min <= out[i - 1].min) return { ok: false, error: "Levels must go up — each starting percentage higher than the one before" };
        if (new Set(out.map((b) => b.label.toLowerCase())).size !== out.length) return { ok: false, error: "Each level needs a different name" };
        patch.masteryBands = out;
        break;
      }
      case "passMarkPct":
        if (!int(v, L.passMarkPct.min, L.passMarkPct.max)) return { ok: false, error: "The pass mark must be a whole number from 0 to 100" };
        patch.passMarkPct = v;
        break;
      case "requireDiagnostic":
        if (typeof v !== "boolean") return { ok: false, error: "requireDiagnostic must be true or false" };
        patch.requireDiagnostic = v;
        break;
      case "revealAnswers":
        if (v !== "after_pass" && v !== "after_submit" && v !== "after_marked" && v !== "never") return { ok: false, error: "revealAnswers must be after_pass, after_submit, after_marked or never" };
        patch.revealAnswers = v;
        break;
      case "homeworkDueDays":
        if (!int(v, L.homeworkDueDays.min, L.homeworkDueDays.max)) return { ok: false, error: `Homework due days must be a whole number from ${L.homeworkDueDays.min} to ${L.homeworkDueDays.max}` };
        patch.homeworkDueDays = v;
        break;
      case "srsMinEase":
        if (typeof v !== "number" || !Number.isFinite(v) || v < L.srsMinEase.min || v > L.srsMinEase.max) return { ok: false, error: `Minimum ease must be between ${L.srsMinEase.min} and ${L.srsMinEase.max}` };
        patch.srsMinEase = v;
        break;
      case "retakePolicy":
        if (v !== "unlimited" && v !== "once" && v !== "cooldown") return { ok: false, error: "retakePolicy must be unlimited, once or cooldown" };
        patch.retakePolicy = v;
        break;
      case "retakeCooldownHours":
        if (!int(v, L.retakeCooldownHours.min, L.retakeCooldownHours.max)) return { ok: false, error: `The wait between attempts must be a whole number of hours from ${L.retakeCooldownHours.min} to ${L.retakeCooldownHours.max}` };
        patch.retakeCooldownHours = v;
        break;
      case "retakeBreakAfter":
        if (!int(v, L.retakeBreakAfter.min, L.retakeBreakAfter.max)) return { ok: false, error: `Tries before a break must be a whole number from ${L.retakeBreakAfter.min} (off) to ${L.retakeBreakAfter.max}` };
        patch.retakeBreakAfter = v;
        break;
      case "retakeBreakMinutes":
        if (!int(v, L.retakeBreakMinutes.min, L.retakeBreakMinutes.max)) return { ok: false, error: `The break must be a whole number of minutes from ${L.retakeBreakMinutes.min} to ${L.retakeBreakMinutes.max}` };
        patch.retakeBreakMinutes = v;
        break;
      case "yearGroups": {
        if (!Array.isArray(v) || !v.length || v.length > L.yearGroups.max) return { ok: false, error: `List between 1 and ${L.yearGroups.max} year groups` };
        const seen = new Set<string>();
        const out: string[] = [];
        for (const g of v) {
          const label = typeof g === "string" ? g.trim().replace(/\s+/g, " ") : "";
          if (!label || label.length > L.yearGroups.labelMax) return { ok: false, error: `Each year group needs a name of 1–${L.yearGroups.labelMax} characters` };
          if (seen.has(label.toLowerCase())) continue;
          seen.add(label.toLowerCase());
          out.push(label);
        }
        patch.yearGroups = out;
        break;
      }
      case "subjectColours": {
        // The WHOLE map (subject -> palette key); a subject left out goes back to its default colour.
        if (!v || typeof v !== "object" || Array.isArray(v)) return { ok: false, error: "subjectColours must be an object of subject -> colour" };
        const entries = Object.entries(v as Record<string, unknown>);
        if (entries.length > SUBJECT_COLOURS_MAX) return { ok: false, error: `Colour up to ${SUBJECT_COLOURS_MAX} subjects` };
        const out: Record<string, string> = {};
        for (const [name, key] of entries) {
          const k = subjectColourKey(name);
          if (!k) return { ok: false, error: "Each colour needs a subject name" };
          if (typeof key !== "string" || !(SUBJECT_PALETTE_KEYS as readonly string[]).includes(key)) return { ok: false, error: `Pick a colour from: ${SUBJECT_PALETTE_KEYS.join(", ")}` };
          out[k] = key;
        }
        patch.subjectColours = out;
        break;
      }
      case "questionKinds":
        return { ok: false, error: "Question types are set in Setup → Teaching Hub, not here" };
      default:
        return { ok: false, error: `"${k}" isn't a setting you can change here` };
    }
  }
  if (!Object.keys(patch).length) return { ok: false, error: "Nothing to change" };
  return { ok: true, patch };
}

/** The palette a group colour comes from (ids, not hex — the client maps them to theme tokens). */
export const GROUP_COLOURS = ["blue", "teal", "green", "amber", "orange", "red", "pink", "purple", "slate"] as const;
export type GroupColour = (typeof GROUP_COLOURS)[number];
