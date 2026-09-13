/**
 * Tax-Free Childcare — the seam between the parent-facing flow and HMRC.
 *
 * The whole journey (link an account → see the balance → pay from it) is built
 * in the checkout against THIS interface. Nothing here talks to HMRC yet: each
 * function returns a "not wired" result, and the UI degrades to the manual path
 * that HMRC's own flow falls back to anyway — the parent pays inside their HMRC
 * account and quotes a reference we capture here.
 *
 * ── For Amir ──────────────────────────────────────────────────────────────
 * Replace the three stubs below and the parent flow lights up with no UI work:
 *
 *   linkAccount()  → the GOV.UK OAuth handshake. Redirect to HMRC's authorise
 *                    URL (Developer Hub app), handle the callback, store the
 *                    tokens against the child, come back with { linked: true,
 *                    reference }. Token expiry is a real state — see
 *                    "connection-expired" below.
 *   balance()      → read the TFC account balance for a linked child. Shown as
 *                    "Current balance for this HMRC account is £X" and used to
 *                    warn before a payment that would bounce.
 *   pay()          → submit the payment request. Return one of the documented
 *                    failures rather than throwing; the UI has a screen for
 *                    each, and every one falls back to the manual path.
 *
 * Screens and copy: docs/tfc-build-spec.md (Part A). Designs: the Childcare
 * Figma file, node 96-24170.
 */

/** The failures HMRC's flow actually produces, each with a designed screen. */
export type TfcFailure =
  | "not-connected"        // we haven't wired HMRC yet — the current default
  | "insufficient-funds"   // balance won't cover the amount
  | "provider-not-added"   // the setting isn't a provider on the booker's account
  | "connection-failed"    // the link didn't complete
  | "connection-expired";  // the token has aged out — re-authorise

export const TFC_FAILURE_COPY: Record<TfcFailure, { title: string; detail: string }> = {
  "not-connected": {
    title: "Paying HMRC directly isn’t connected yet",
    detail: "Pay from your HMRC account as usual and give us your payment reference below, so we can match it to this booking when it lands.",
  },
  "insufficient-funds": {
    title: "Not enough in your HMRC account",
    detail: "Top up your Tax-Free Childcare account, or pay part of it another way.",
  },
  "provider-not-added": {
    title: "HMRC payment failed",
    detail: "This provider is not added to your HMRC account. Add them as a childcare provider, then make the payment.",
  },
  "connection-failed": {
    title: "HMRC connection failed",
    detail: "Please select ‘Login with HMRC’ to try again.",
  },
  "connection-expired": {
    title: "HMRC connection expired",
    detail: "Your link to HMRC has expired — sign in again to reconnect.",
  },
};

export interface TfcLink { linked: boolean; reference?: string; failure?: TfcFailure }

/**
 * Link one child's HMRC Tax-Free Childcare account via GOV.UK.
 *
 * Until Amir wires the OAuth handshake this SIMULATES a successful link so the
 * journey runs end to end: the row flips to linked and the flow moves on. It
 * mints a reference in HMRC's own shape (4 letters of the child's name + 5
 * digits + TFC) so the reference that reaches Reconciliation looks like the
 * real thing and can be matched.
 */
/**
 * An HMRC Tax-Free Childcare payment reference, from a child's name.
 *
 * The shape, from live references: the child's FIRST INITIAL + the first THREE
 * letters of their SURNAME + 5 digits + "TFC".
 *   Rowan Eady    → READ97040TFC
 *   Mubi Soni     → MSON94070TFC
 *   Aysan Yacoob  → AYAC14387TFC
 * A one-word name has no surname to take, so it falls back to the first four
 * letters of what there is rather than producing something malformed.
 */
export function referencePrefix(childName: string): string {
  const parts = childName.trim().split(/\s+/).filter(Boolean);
  const letters = (w: string) => w.replace(/[^a-z]/gi, "").toUpperCase();
  if (parts.length < 2) return (letters(parts[0] ?? "") + "XXXX").slice(0, 4);
  const first = letters(parts[0]).slice(0, 1);
  const last = letters(parts[parts.length - 1]).slice(0, 3);
  return (first + last + "XXXX").slice(0, 4);
}

/** What to show a parent typing their own reference in. */
export function referenceHint(childName: string): string {
  const p = referencePrefix(childName);
  return `${p}` + "•••••TFC";
}

export async function linkAccount(childName: string): Promise<TfcLink> {
  const prefix = referencePrefix(childName);
  // Deterministic from the name, so re-linking the same child is stable rather
  // than minting a new reference every click.
  let h = 0;
  for (const ch of childName) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return { linked: true, reference: `${prefix}${String(h).padStart(5, "0")}TFC` };
}

/**
 * The balance on a linked account.
 *
 * `simulated` says whether this came from HMRC or from us. While it's true the
 * UI labels the figure as an example — a number presented as a family's real
 * childcare balance, when it isn't, is the one thing in this flow that could
 * cost someone money. Amir: return { amount, simulated: false } from the real
 * account read and the label disappears on its own.
 */
export interface TfcBalance { amount: number; simulated: boolean }

export async function balance(reference: string): Promise<TfcBalance | null> {
  if (!reference.trim()) return null;
  // Deterministic from the reference so it doesn't jump around between renders.
  let h = 0;
  for (const ch of reference) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  // A spread that lands either side of a typical booking, so the
  // not-enough-funds path is reachable in a demo rather than theoretical.
  return { amount: Math.round((20 + (h % 120)) * 100) / 100, simulated: true };
}

export interface TfcPayResult { ok: boolean; failure?: TfcFailure }

/** Ask HMRC to send `amount` to this provider against `reference`. */
export async function pay(_args: { reference: string; amount: number; tenantId?: string }): Promise<TfcPayResult> {
  return { ok: false, failure: "not-connected" };
}

/** True once HMRC is actually wired — the UI uses this to decide whether to
 *  offer "Login with HMRC" as a real action or explain the manual route. */
export const HMRC_CONNECTED = false;
