// Thin fetch wrapper for the Express API: attaches the signed-in user's
// Firebase ID token and surfaces JSON error bodies as thrown Errors.
import { firebaseAuth } from "./firebase/client";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
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

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
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
    try {
      const body = await res.json();
      if (body?.error) message = typeof body.error === "string" ? body.error : JSON.stringify(body.error);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

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
  const user = await signedInUser();
  const token = user ? await withTimeout(user.getIdToken(), "Getting your sign-in token") : null;
  const res = await fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, res.status === 404 ? "That file isn't available." : `Couldn't open the file (${res.status}).`);
  const url = URL.createObjectURL(await res.blob());
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
