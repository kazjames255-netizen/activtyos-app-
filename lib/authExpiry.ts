// Pure: does this API failure mean the sign-in session ran out? (Firebase ID tokens last an hour; the API answers 401 "Invalid or expired token".)
// Used by lib/api.ts to refresh the token once and retry, and otherwise to show a plain "sign in again" instead of the server's wording.

export const SESSION_EXPIRED_TEXT = "Your session has expired. Please sign in again.";

const TOKEN_WORDS = /invalid or expired token|id[- ]?token.*expired|token.*(expired|revoked)|auth\/(id-token|user-token)-(expired|revoked)|missing authorization|not signed in|session (has )?expired/i;

export function isSessionExpiredFailure(status: number, message: string): boolean {
  return status === 401 && TOKEN_WORDS.test(message || "");
}
