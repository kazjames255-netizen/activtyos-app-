/**
 * Tax-Free Childcare — the seam between the parent-facing flow and HMRC.
 *
 * The whole journey (link an account → see the balance → pay from it) is built
 * in the checkout against THIS interface. The three functions below now call
 * our own API, which talks to HMRC's Tax-Free Childcare Payments API v1.2
 * (server/src/lib/tfc.ts + server/src/routes/tfc.ts).
 *
 * TWO SWITCHES, AND THE SERVER WINS.
 *   • NEXT_PUBLIC_HMRC_TFC=1 — set on the web app when HMRC is live. With it
 *     unset (the default) this file behaves EXACTLY as it did before the
 *     integration: a simulated link, a simulated balance, "not-connected" on
 *     pay, and not one extra network call.
 *   • The API's own HMRC credentials. If the flag is on but the server has no
 *     credentials, `/link/start` answers `configured: false` and we fall back
 *     to the same simulation — so the two can never disagree in a way that
 *     shows a family a number that isn't theirs.
 *
 * EVERY failure degrades to the manual path: the parent pays inside their HMRC
 * account and gives us the payment reference, which the checkout has always
 * captured (routes/my.ts, `tfcReference`).
 *
 * Screens and copy: docs/tfc-build-spec.md (Part A). Designs: the Childcare
 * Figma file, node 96-24170.
 */
import { ApiError, get, post } from "@/lib/api";

/**
 * The failures HMRC's flow actually produces, each with a designed screen.
 *
 * Defined in `lib/tfc.ts` and re-exported here: the API is what decides which
 * one a parent sees (it maps HMRC's error codes onto this union), so both
 * halves of the app must read the same list. Import it from either place.
 */
export type { TfcFailure } from "@/lib/tfc";
import type { TfcFailure } from "@/lib/tfc";

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

/**
 * The pre-integration link: a SIMULATED success, so the journey runs end to
 * end on a deployment with no HMRC credentials. It mints a reference in HMRC's
 * own shape (first initial + 3 surname letters + 5 digits + TFC), deterministic
 * from the name so re-linking the same child is stable rather than minting a
 * new reference every click.
 */
function simulatedLink(childName: string): TfcLink {
  const prefix = referencePrefix(childName);
  let h = 0;
  for (const ch of childName) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return { linked: true, reference: `${prefix}${String(h).padStart(5, "0")}TFC` };
}

type StartResponse = {
  configured: boolean;
  url?: string;
  state?: string;
  linked?: boolean;
  reference?: string;
  failure?: TfcFailure;
};
type StatusResponse = { done: boolean; linked?: boolean; reference?: string | null; failure?: TfcFailure };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Link one child's HMRC Tax-Free Childcare account via GOV.UK.
 *
 * The parent signs in on HMRC's own pages — never ours — in a second window,
 * and HMRC redirects to our API, which exchanges the code for tokens and makes
 * the link call. This function watches for that to finish.
 *
 * `reference` is the parent's own 12-character reference from the TFC portal.
 * HMRC needs it (with the child's date of birth) to link; when it isn't passed
 * the server uses the one already saved on the child.
 */
export async function linkAccount(childName: string, reference?: string): Promise<TfcLink> {
  if (!HMRC_CONNECTED) return simulatedLink(childName);
  // Opened BEFORE the first await: a window opened after one is a pop-up the
  // browser blocks, because the click that asked for it is no longer "current".
  const popup = typeof window === "undefined" ? null : window.open("", "aos-hmrc-tfc", "width=560,height=760");
  try {
    const started = await post<StartResponse>("/api/my/tfc/link/start", { childName, ...(reference ? { reference } : {}) });
    // The API has no HMRC credentials after all — behave exactly as an
    // unconfigured deployment does.
    if (!started.configured) { popup?.close(); return simulatedLink(childName); }
    // A family that has linked before doesn't go to GOV.UK again.
    if (started.linked && started.reference) { popup?.close(); return { linked: true, reference: started.reference }; }
    if (started.failure) { popup?.close(); return { linked: false, failure: started.failure }; }
    if (!started.url || !started.state) { popup?.close(); return { linked: false, failure: "connection-failed" }; }
    // Pop-ups blocked. Navigating this tab to GOV.UK instead would throw away
    // the basket and land the parent on a "you can close this window" page
    // with no window to close — so this failure goes to the manual path, which
    // works in every browser.
    if (!popup) return { linked: false, failure: "connection-failed" };
    popup.location.href = started.url;
    return await awaitLink(started.state, popup);
  } catch {
    // A failed call is never a link. The parent gets the "connection failed"
    // screen, which offers the manual path.
    popup?.close();
    return { linked: false, failure: "connection-failed" };
  }
}

/** Poll our API until the GOV.UK hand-off lands (or the parent gives up). */
async function awaitLink(state: string, popup: Window | null): Promise<TfcLink> {
  const deadline = Date.now() + 15 * 60_000; // matches the server's state TTL
  let closedPolls = 0;
  while (Date.now() < deadline) {
    await sleep(2_000);
    let s: StatusResponse | null = null;
    try {
      s = await get<StatusResponse>(`/api/my/tfc/link/status?state=${encodeURIComponent(state)}`);
    } catch (e) {
      // The hand-off is gone (its answer was already read, or it expired) —
      // that's an ending, not a blip. Re-linking recovers it, and a child who
      // did link comes back linked immediately.
      if (e instanceof ApiError && e.status === 404) { popup?.close(); return { linked: false, failure: "connection-failed" }; }
      // Any other blip in one poll shouldn't end a hand-off the parent is part
      // way through — keep asking until the deadline.
      continue;
    }
    if (s?.done) {
      return s.linked && s.reference ? { linked: true, reference: s.reference } : { linked: false, failure: s.failure ?? "connection-failed" };
    }
    // Window shut with nothing recorded: give the callback two more polls to
    // land (it closes itself on success) before calling it off.
    if (popup?.closed && ++closedPolls >= 2) break;
  }
  popup?.close();
  return { linked: false, failure: "connection-failed" };
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
  if (!HMRC_CONNECTED) return simulatedBalance(reference);
  try {
    // HMRC's `cleared_funds` — what can actually be spent today, which is what
    // a payment is measured against. Anything other than a clean read returns
    // null: no balance line at all is far better than the wrong one.
    const r = await post<{ ok: boolean; amount?: number }>("/api/my/tfc/balance", { reference });
    return r?.ok && typeof r.amount === "number" ? { amount: r.amount, simulated: false } : null;
  } catch {
    return null;
  }
}

/** The pre-integration balance: deterministic from the reference so it doesn't
 *  jump around between renders, and spread either side of a typical booking so
 *  the not-enough-funds path is reachable in a demo rather than theoretical.
 *  Always flagged `simulated`, which is what makes the UI label it an example. */
function simulatedBalance(reference: string): TfcBalance {
  let h = 0;
  for (const ch of reference) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return { amount: Math.round((20 + (h % 120)) * 100) / 100, simulated: true };
}

export interface TfcPayResult { ok: boolean; failure?: TfcFailure }

/** Ask HMRC to send `amount` to this provider against `reference`. */
export async function pay(args: { reference: string; amount: number; tenantId?: string }): Promise<TfcPayResult> {
  if (!HMRC_CONNECTED) return { ok: false, failure: "not-connected" };
  try {
    const r = await post<{ ok: boolean; failure?: TfcFailure }>("/api/my/tfc/pay", args);
    return r?.ok ? { ok: true } : { ok: false, failure: r?.failure ?? "connection-failed" };
  } catch {
    return { ok: false, failure: "connection-failed" };
  }
}

/** True once HMRC is actually wired — the UI uses this to decide whether to
 *  offer "Login with HMRC" as a real action or explain the manual route.
 *
 *  Compile-time (Next inlines NEXT_PUBLIC_* at build), so a deployment without
 *  it makes no HMRC-shaped calls at all. The API's credentials are the real
 *  authority; this only decides whether we bother asking it. */
export const HMRC_CONNECTED = process.env.NEXT_PUBLIC_HMRC_TFC === "1";
