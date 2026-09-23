// Thin fetch wrapper for the Express API: attaches the signed-in user's
// Firebase ID token and surfaces JSON error bodies as thrown Errors.
import { firebaseAuth } from "./firebase/client";

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
  ) {
    super(message);
  }
}

// Nothing here may hang forever: a stalled auth or token refresh used to leave
// screens on "Loading…" with no way to tell why. Time every step out instead.
const TIMEOUT_MS = 15_000;

function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
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
  const user = await signedInUser();
  if (!user) throw new ApiError(401, "Not signed in");
  const token = await withTimeout(user.getIdToken(), "Getting your sign-in token");
  return request<T>(path, token, init);
}

// Public storefront reads (/api/listings, /book/{id}): attach the token when
// a session exists (operators see their drafts), otherwise go anonymously.
export async function apiPublic<T>(path: string, init?: RequestInit): Promise<T> {
  const user = await signedInUser().catch(() => null);
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
          : new ApiError(0, "We can’t reach ActivityOS right now. Check your connection and try again in a moment.");
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
      if (body?.error) message = typeof body.error === "string" ? body.error : JSON.stringify(body.error);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message, parsed);
  }
  return res.json() as Promise<T>;
}

// A platform account's session-level 2FA verification (server: `attachRole`
// in server/src/middleware/role.ts, TTL 12h) can lapse while a page sits
// open. Any /api/* call then 403s with this code instead of its usual
// payload — recognizable here so a caller can show something clearer than
// the raw error, even if it's just "sign in again" rather than a full
// re-verify-in-place flow.
export const isTwoFaRequired = (e: unknown): boolean =>
  e instanceof ApiError && (e.body as { code?: string } | undefined)?.code === "2fa_required";

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
