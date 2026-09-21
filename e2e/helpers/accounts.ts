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
  // Firebase rate-limits password verification per project (QUOTA_EXCEEDED / TOO_MANY_ATTEMPTS_TRY_LATER) — several
  // suites sharing the dev project can trip it, so back off and retry instead of failing the test on a transient limit.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${IDENTITY}/${endpoint}?key=${FIREBASE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { idToken?: string; localId?: string; error?: { message?: string } };
    if (res.ok && json.idToken) return { idToken: json.idToken, uid: json.localId! };
    const msg = json.error?.message || String(res.status);
    if (attempt < 8 && /QUOTA_EXCEEDED|TOO_MANY_ATTEMPTS/.test(msg)) {
      await new Promise((r) => setTimeout(r, 5_000 * (attempt + 1)));
      continue;
    }
    throw new Error(`${endpoint} failed: ${msg}`);
  }
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
