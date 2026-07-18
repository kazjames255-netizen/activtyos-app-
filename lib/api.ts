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
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new ApiError(408, `${label} timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS),
    ),
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

  const controller = new AbortController();
  const abort = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  })
    .catch((e) => {
      throw e?.name === "AbortError"
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
export const del = <T>(path: string) => api<T>(path, { method: "DELETE" });
