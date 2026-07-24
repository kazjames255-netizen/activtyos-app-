import { API_URL, FIREBASE_API_KEY } from "./env";

// Throwaway-account convention (see AGENTS.md / PROD-READINESS): everything
// e2e creates lives on @activityos-test.com and is fully deleted afterwards
// by `npm run e2e:cleanup` (server/src/e2eCleanup.ts).
export const TEST_EMAIL_DOMAIN = "activityos-test.com";
export const TEST_PASSWORD = "E2etest!123";

const IDENTITY = "https://identitytoolkit.googleapis.com/v1";

interface FbSession {
  idToken: string;
  uid: string;
}

async function identityCall(endpoint: string, body: unknown): Promise<FbSession> {
  const res = await fetch(`${IDENTITY}/${endpoint}?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { idToken?: string; localId?: string; error?: { message?: string } };
  if (!res.ok || !json.idToken) {
    throw new Error(`${endpoint} failed: ${json.error?.message || res.status}`);
  }
  return { idToken: json.idToken, uid: json.localId! };
}

export const fbSignUp = (email: string, password = TEST_PASSWORD) =>
  identityCall("accounts:signUp", { email, password, returnSecureToken: true });

export const fbSignIn = (email: string, password = TEST_PASSWORD) =>
  identityCall("accounts:signInWithPassword", { email, password, returnSecureToken: true });

export const fbTrySignIn = (email: string, password = TEST_PASSWORD) =>
  fbSignIn(email, password).catch(() => null);

/** Authenticated call against the Express API, mirroring lib/api.ts. */
export async function apiFetch<T>(path: string, idToken: string | null, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (body?.error) message = typeof body.error === "string" ? body.error : JSON.stringify(body.error);
    } catch {
      /* non-JSON body */
    }
    throw new Error(`${path} → ${message}`);
  }
  return res.json() as Promise<T>;
}

export const apiPost = <T>(path: string, idToken: string | null, body: unknown) =>
  apiFetch<T>(path, idToken, { method: "POST", body: JSON.stringify(body) });
