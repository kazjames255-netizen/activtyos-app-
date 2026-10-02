// Thin fetch wrapper for the Express API: attaches the signed-in user's
// Firebase ID token and surfaces JSON error bodies as thrown Errors.
import { firebaseAuth } from "./firebase/client";
import { translateApiMessage } from "./i18n/apiErrors";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ── Platform (HQ) "view as" impersonation ────────────────────────────────────
// When an HQ owner opens another account, we remember it here and send its uid
// on every request as `x-act-as`; the backend (platform-only) then serves that
// account's data. Cleared on Exit. `aos:actas` fires so the banner/UI react.
export interface ActAs { uid: string; label: string; portal: string; role: string }
const ACT_AS_KEY = "aos.actAs";
export function getActAs(): ActAs | null {
  if (typeof window === "undefined") return null;
  try { const v = localStorage.getItem(ACT_AS_KEY); return v ? (JSON.parse(v) as ActAs) : null; } catch { return null; }
}
export function setActAs(v: ActAs | null): void {
  if (typeof window === "undefined") return;
  if (v) localStorage.setItem(ACT_AS_KEY, JSON.stringify(v)); else localStorage.removeItem(ACT_AS_KEY);
  window.dispatchEvent(new Event("aos:actas"));
}
const actAsHeader = (): Record<string, string> => { const a = getActAs(); return a ? { "x-act-as": a.uid } : {}; };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** The parsed JSON error body when there was one — e.g. `{ code, nextAvailableAt }`. */
    public body?: unknown,
    /** The message exactly as the server sent it (English). `message` is that text in the active language; compare against rawMessage, never message. */
    public rawMessage: string = message,
  ) {
    super(translateApiMessage(message));
  }
}

// Nothing here may hang forever: a stalled auth or token refresh used to leave
// screens on "Loading…" with no way to tell why. Time every step out instead.
// 45s (not the original 15s): a cold shared-library cache rebuild (Learning Hub notes index, first
// request after a server restart) has been measured taking 36-55s — comfortably longer than 15s — so
// the old value was timing out a perfectly legitimate load, not just catching a genuine hang. This is
// a safety-net widening, not a fix for the underlying cold-start slowness itself (see hubCache.ts).
const TIMEOUT_MS = 45_000;

export function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  // `label` names an internal step ("Getting your sign-in token"), so it stays
  // out of the production message for the same reason as the fetch errors below.
  const message = process.env.NODE_ENV === "production"
    ? "That took longer than expected. Please refresh and try again."
    : `${label} timed out after ${TIMEOUT_MS / 1000}s`;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new ApiError(408, message)), TIMEOUT_MS)),
  ]);
}

// `currentUser` is null for the first moments after a page load, until Firebase
// restores the persisted session. Calling straight from a mount effect used to
// throw "Not signed in" and leave screens stuck, so wait for auth to settle.
async function signedInUser() {
  if (firebaseAuth.currentUser) return firebaseAuth.currentUser;
  await withTimeout(firebaseAuth.authStateReady(), "Signing in");
  return firebaseAuth.currentUser;
}

// ── Guided-tour demo mode ──────────────────────────────────────────────────
// A tour route (rendered in its own iframe) flips this on so api() returns
// canned fixtures instead of hitting the network — the real page component then
// renders with representative data and NO sign-in. Scoped to the tour's own
// document, so live pages are never affected.
let demoFixtures: Record<string, unknown> | null = null;
export function enableDemoMode(fixtures: Record<string, unknown>) {
  demoFixtures = fixtures;
}
export function isDemoMode() {
  return demoFixtures !== null;
}
function demoLookup(path: string): unknown {
  if (!demoFixtures) return undefined;
  const clean = path.split("?")[0];
  if (clean in demoFixtures) return demoFixtures[clean];
  const noApi = clean.replace(/^\/api/, "");
  if (noApi in demoFixtures) return demoFixtures[noApi];
  return undefined;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (demoFixtures) {
    // Writes just succeed silently; reads return the fixture, or null so a
    // page with a missing fixture degrades to its empty state rather than
    // hanging on a network call that can never resolve here.
    if (init?.method && init.method !== "GET") return (demoLookup(path) ?? {}) as T;
    const hit = demoLookup(path);
    return (hit === undefined ? null : hit) as T;
  }
  const isRead = !init || (!init.method || init.method === "GET") && !init.body && !init.headers && !init.signal;
  if (!isRead) {
    // The realtime ticket is a POST but changes no data: it must not throw away the bootstrap's parked answers (it fires right after first
    // paint, and used to make Home refetch 5 reads the bootstrap had already answered).
    if (path === "/api/events/ticket") return send<T>(path, init);
    // A write makes any read still in flight potentially stale: never let a later read join it.
    inflightReads.clear();
    primed.clear();
    return send<T>(path, init);
  }
  // Single-flight reads: identical GETs issued while one is already on the wire (the sidebar, the header, the view gate and the page
  // all ask for /api/my/providers, /api/me, /api/learning-hub/providers… on the same first paint) share ONE request. Each caller
  // still gets its own copy of the JSON, so nobody can mutate another's data. Only concurrent calls are merged — a call made after
  // the first has settled always goes to the network (realtime refetches are never answered from a stale cache).
  const key = `${getActAs()?.uid ?? ""}|${path}`;
  if (priming && (priming.any ? path.startsWith("/api/learning-hub/") && !path.startsWith("/api/learning-hub/bootstrap") : priming.paths.has(key))) await priming.done; // its answer is already on the wire inside the bootstrap: wait for it, don't ask twice
  const hit = primed.get(key);
  if (hit && hit.exp > Date.now()) return (hit.v !== null && typeof hit.v === "object" ? structuredClone(hit.v) : hit.v) as T;
  let p = inflightReads.get(key) as Promise<T> | undefined;
  if (!p) {
    p = background(path, () => send<T>(path, init)).finally(() => { if (inflightReads.get(key) === p) inflightReads.delete(key); });
    inflightReads.set(key, p);
  }
  return p.then((v) => (v !== null && typeof v === "object" ? structuredClone(v) : v));
}

const inflightReads = new Map<string, Promise<unknown>>();

// ── Bootstrap priming ───────────────────────────────────────────────────────────────────────────────────────────────
// A screen that knows the reads it is about to make (the Teaching Hub's first paint: ~15 GETs) can fetch them ALL in one
// round trip — `GET /api/learning-hub/bootstrap` runs them in parallel server-side — and park the answers here. The normal
// `get()` calls then resolve from the parked answer with no network. Short-lived (a few seconds: only the first paint reads
// are served this way, realtime refetches always go to the network) and dropped by any write. A path the bootstrap could not
// answer is simply absent, so that call goes to the network as usual and shows its own real error.
const primed = new Map<string, { v: unknown; exp: number }>();
const PRIME_TTL_MS = 8_000;
let priming: { paths: Set<string>; any: boolean; sig: string; done: Promise<void> } | null = null;
/** `paths` are full API paths ("/api/learning-hub/topics?tenantId=…") exactly as the callers will request them. */
export function primeHubReads(paths: string[], opts: { placeholders?: boolean } = {}): Promise<void> {
  const PFX = "/api/learning-hub";
  const uniq = [...new Set(paths.filter((p) => p.startsWith(PFX + "/")))];
  if (!uniq.length || demoFixtures) return Promise.resolve();
  const who = getActAs()?.uid ?? "";
  const q = uniq.map((p) => `p=${encodeURIComponent(p.slice(PFX.length))}`).join("&");
  if (priming && priming.sig === q) return priming.done; // StrictMode / a remount asking for the very same thing while it is in flight
  // With placeholders ({T}/{C}: the server fills in the provider / child) the answers' keys aren't known yet, so any hub read waits for them.
  const mine: { paths: Set<string>; any: boolean; sig: string; done: Promise<void> } = { sig: q, paths: new Set(uniq.map((p) => `${who}|${p}`)), any: !!opts.placeholders, done: Promise.resolve() };
  mine.done = send<{ responses?: Record<string, unknown> }>(`${PFX}/bootstrap?${q}`)
    .then((r) => {
      const exp = Date.now() + PRIME_TTL_MS;
      for (const [k, v] of Object.entries(r?.responses ?? {})) primed.set(`${who}|${PFX}${k}`, { v, exp });
    })
    .catch(() => { /* old server / offline: every read just goes the normal way */ })
    .finally(() => { if (priming === mine) priming = null; });
  priming = mine;
  return mine.done;
}

// Browsers open only ~6 sockets per origin to the API over HTTP/1.1, and every page's shell fires a dozen cosmetic reads at once (nav badges,
// unread counts, coupons…). On the Teaching Hub those queued in front of the hub's OWN data — its first paint waited behind them. So while
// the hub is open, everything that isn't the hub's own (or identity) goes through a 2-wide lane and leaves the rest of the sockets free.
const HOT = /^\/api\/(learning-hub\/|me$|library$|events\/ticket|my\/providers|public\/library\/)/;
const onHub = () => typeof location !== "undefined" && /\/learninghub(\/|$)/.test(location.pathname);
let laneBusy = 0;
const laneWaiting: (() => void)[] = [];
async function background<T>(path: string, run: () => Promise<T>): Promise<T> {
  if (HOT.test(path) || !onHub()) return run();
  if (laneBusy >= 2) await new Promise<void>((r) => laneWaiting.push(r));
  else laneBusy++;
  try { return await run(); } finally { const next = laneWaiting.shift(); if (next) next(); else laneBusy--; }
}

async function send<T>(path: string, init?: RequestInit): Promise<T> {
  const user = await signedInUser();
  if (!user) throw new ApiError(401, "Not signed in");
  const token = await withTimeout(user.getIdToken(), "Getting your sign-in token");
  return request<T>(path, token, init);
}

// Public storefront reads (/api/listings, /book/{id}): attach the token when
// a session exists (operators see their drafts), otherwise go anonymously.
export async function apiPublic<T>(path: string, init?: RequestInit): Promise<T> {
  // A public page must never sit waiting on sign-in. Inside another website's
  // frame (the embed) the browser blocks Firebase's storage, so "is anyone
  // signed in?" can hang for the whole timeout and the booking page stays on
  // Loading. Give it a moment, then carry on as a signed-out visitor.
  const user = await Promise.race([
    signedInUser().catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
  ]);
  const token = user ? await withTimeout(user.getIdToken(), "Getting your sign-in token").catch(() => null) : null;
  return request<T>(path, token, init);
}

async function request<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const abort = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...actAsHeader(),
      ...init?.headers,
    },
  })
    .catch((e) => {
      // Views render err.message verbatim, so these reach real users. In
      // production that must read as "try again", not as a debugging hint —
      // the API's URL is nothing a parent can act on. The diagnostic version
      // stays in development, where "is the API running?" is the answer 9
      // times out of 10.
      const timedOut = e?.name === "AbortError";
      if (process.env.NODE_ENV === "production") {
        throw timedOut
          ? new ApiError(408, "That took longer than expected. Please try again.")
          : new ApiError(0, "We can’t reach {brand} right now. Check your connection and try again in a moment.");
      }
      throw timedOut
        ? new ApiError(408, `The server didn't respond within ${TIMEOUT_MS / 1000}s (${BASE}). Is the API running?`)
        : new ApiError(0, `Couldn't reach the server at ${BASE}. Is the API running?`);
    })
    .finally(() => clearTimeout(abort));

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    let parsed: unknown;
    try {
      const body = await res.json();
      parsed = body;
      if (body?.error) message = typeof body.error === "string" ? body.error : readableIssues(body.error) ?? JSON.stringify(body.error);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message, parsed);
  }
  return res.json() as Promise<T>;
}

// The API answers a failed validation with the raw zod issue list ([{ message, path: ["date"] }, …]); showing that as JSON to a
// provider ("[{\"code\":\"custom\",\"message\":\"Not a real calendar date\"…") is unreadable. "date: Not a real calendar date" instead.
function readableIssues(err: unknown): string | null {
  if (!Array.isArray(err) || !err.length) return null;
  const parts = err.map((i) => {
    if (!i || typeof i !== "object" || typeof (i as { message?: unknown }).message !== "string") return null;
    const { message, path } = i as { message: string; path?: unknown };
    const where = Array.isArray(path) ? path.filter((p) => typeof p === "string").join(" › ") : "";
    return where ? `${where}: ${message}` : message;
  });
  return parts.every((x) => x) ? [...new Set(parts as string[])].join("; ") : null;
}

// A platform account's session-level 2FA verification (server: `attachRole`
// in server/src/middleware/role.ts, TTL 12h) can lapse while a page sits
// open. Any /api/* call then 403s with this code instead of its usual
// payload — recognizable here so a caller can show something clearer than
// the raw error, even if it's just "sign in again" rather than a full
// re-verify-in-place flow.
export const isTwoFaRequired = (e: unknown): boolean =>
  e instanceof ApiError && (e.body as { code?: string } | undefined)?.code === "2fa_required";

/** The error text as the SERVER sent it (English), for code that recognises a message: `Error.message` is shown to the user and is translated (lib/i18n/apiErrors.ts). */
export const rawErrorMessage = (e: unknown): string => (e instanceof ApiError ? e.rawMessage : e instanceof Error ? e.message : "");

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const put = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const del = <T>(path: string) => api<T>(path, { method: "DELETE" });

// Open an authenticated binary file (e.g. a child's EHCP plan at
// /api/my/files/:id) in a new tab. Every /api route needs a Bearer token, so a
// plain <a href> would 401 — we fetch with the token, then hand the browser a
// blob URL. The caller decides when it's allowed to be seen; access is still
// re-checked server-side on the fetch itself.
export async function openFile(path: string): Promise<void> {
  const url = URL.createObjectURL(await fetchBlob(path));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** An authenticated binary (a stored scan, a plan) as a Blob. Carries the
 *  view-as header too — without it HQ viewing as a provider got a 404. */
export async function fetchBlob(path: string): Promise<Blob> {
  const user = await signedInUser();
  const token = user ? await withTimeout(user.getIdToken(), "Getting your sign-in token") : null;
  const res = await fetch(`${BASE}${path}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...actAsHeader() } });
  if (!res.ok) throw new ApiError(res.status, res.status === 404 ? "That file isn't available." : `Couldn't open the file (${res.status}).`);
  return res.blob();
}
