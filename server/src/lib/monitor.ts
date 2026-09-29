import { db } from "../firebase";
import { sendMailDetailed } from "./mailer";
import { ukToday } from "./ukDate";

// ─────────────────────────────────────────────────────────────────────────
// Knowing something broke, without waiting for a customer to ring.
//
// Acceptance d27s3 asks: "how would you find out that something broke in
// production at 07:00 on a Monday?" The honest answer was "a customer will
// call" — nothing recorded a fault and nothing told anyone. This is the
// smallest thing that changes that answer, using only what the product
// already has (Firestore + a working mailer). It is NOT a replacement for a
// real APM; it is the floor.
//
// Three parts:
//   • record(): every unhandled 500, crash and failed sweep lands in
//     `incidentsOps` with its message, stack and context.
//   • alert():  the first occurrence of a given fault emails OPS_ALERT_EMAIL
//     immediately, then that signature is muted for MUTE_MS so a crash-loop
//     sends one email, not ten thousand.
//   • heartbeat: sweeps stamp `opsHeartbeat/{name}` when they run; the
//     watchdog compares each against its expected interval and raises a
//     "sweeps have stopped" fault — which is what a silent scheduler, a
//     blown Firestore quota or a dead instance looks like from the outside.
// ─────────────────────────────────────────────────────────────────────────

/** Where alerts go. Unset = record only, no mail (the dev default). */
const TO = process.env.OPS_ALERT_EMAIL?.trim();
/** One email per distinct fault per hour, however often it recurs. */
const MUTE_MS = Number(process.env.OPS_ALERT_MUTE_MINUTES ?? 60) * 60_000;

const lastSent = new Map<string, number>();

export type FaultKind = "request" | "crash" | "sweep" | "heartbeat";

export interface Fault {
  kind: FaultKind;
  /** Stable across recurrences of the SAME fault — this is what mutes. */
  signature: string;
  message: string;
  stack?: string;
  /** Route, sweep name, tenant — whatever makes it findable. */
  context?: Record<string, unknown>;
}

/** Record a fault and, the first time it appears, tell someone. */
export async function record(f: Fault): Promise<void> {
  const at = new Date().toISOString();
  try {
    await db.collection("incidentsOps").add({
      kind: f.kind,
      signature: f.signature,
      message: f.message.slice(0, 2000),
      stack: (f.stack ?? "").slice(0, 8000),
      context: f.context ?? {},
      at,
      ukDay: ukToday(),
    });
  } catch (e) {
    // If even recording fails, the log is all that's left.
    console.error("[ops] could not record fault:", (e as Error).message);
  }
  console.error(`[ops] ${f.kind}: ${f.signature} — ${f.message}`);

  if (!TO) return;
  const last = lastSent.get(f.signature) ?? 0;
  if (Date.now() - last < MUTE_MS) return;
  lastSent.set(f.signature, Date.now());
  const ctx = Object.entries(f.context ?? {}).map(([k, v]) => `${k}: ${String(v)}`).join("<br>");
  await sendMailDetailed(
    TO,
    `ActivityOS ${f.kind} fault — ${f.signature}`,
    `<p><b>${escapeHtml(f.message)}</b></p>${ctx ? `<p>${ctx}</p>` : ""}`
      + `<p style="color:#666">${at} — UK day ${ukToday()}</p>`
      + (f.stack ? `<pre style="font:12px/1.4 monospace;white-space:pre-wrap">${escapeHtml(f.stack.slice(0, 3000))}</pre>` : "")
      + `<p style="color:#666">Further reports of this same fault are muted for ${Math.round(MUTE_MS / 60000)} minutes.</p>`,
  ).catch(() => { /* never let alerting throw */ });
}

const escapeHtml = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A sweep ran. Cheap: one write per sweep per run. */
export async function beat(sweep: string): Promise<void> {
  await db.collection("opsHeartbeat").doc(sweep).set({ at: new Date().toISOString(), sweep }, { merge: true })
    .catch(() => { /* a missed beat is not worth failing the sweep for */ });
}

/**
 * Has anything stopped? Compares each sweep's last beat against the interval
 * it claims to run on, with generous slack — a late sweep is normal, a sweep
 * that hasn't run in several of its own intervals is not.
 */
export async function checkHeartbeats(expected: Record<string, number>): Promise<string[]> {
  const stale: string[] = [];
  const snap = await db.collection("opsHeartbeat").get();
  const seen = new Map(snap.docs.map((d) => [d.id, String(d.get("at") ?? "")]));
  for (const [name, everyMs] of Object.entries(expected)) {
    const at = seen.get(name);
    // Never-run is only a fault once the process has been up long enough to
    // have run it — startup is handled by the caller's grace period.
    if (!at) { stale.push(`${name} (never)`); continue;
    }
    const age = Date.now() - Date.parse(at);
    if (age > Math.max(everyMs * 4, 15 * 60_000)) stale.push(`${name} (${Math.round(age / 60_000)}m ago)`);
  }
  if (stale.length) {
    await record({
      kind: "heartbeat",
      signature: "sweeps-stalled",
      message: `Background jobs have stopped running: ${stale.join(", ")}. Reminders, alerts and billing sync are not going out.`,
      context: { stale: stale.join(", ") },
    });
  }
  return stale;
}

/** Catch what would otherwise kill the process silently. */
export function installProcessHandlers(): void {
  process.on("uncaughtException", (e) => {
    void record({ kind: "crash", signature: `uncaught:${e.name}`, message: e.message, stack: e.stack });
  });
  process.on("unhandledRejection", (reason) => {
    const e = reason instanceof Error ? reason : new Error(String(reason));
    void record({ kind: "crash", signature: `unhandled:${e.name}`, message: e.message, stack: e.stack });
  });
}
