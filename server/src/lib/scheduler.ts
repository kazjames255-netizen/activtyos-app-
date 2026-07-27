import { db } from "../firebase";

// ─────────────────────────────────────────────────────────────────────────
// The scheduler — time-based work on plain Firestore, no extra infra.
//
// The old pattern (a bare setInterval in index.ts) fires on EVERY instance,
// so two API processes would send every reminder twice. Everything here is
// safe to run on any number of instances because coordination happens in
// Firestore transactions:
//
//   sweep(name, everyMs, fn)   — a recurring scan. All instances poll, but a
//     transactional lock (schedulerLocks/{name}) lets exactly one run each
//     interval; the rest skip. A crashed winner just means the next poll wins.
//
//   fireOnce(key, meta, fn)    — exactly-once delivery inside a sweep. The
//     first caller claims schedulerFired/{key} in a transaction and runs fn;
//     every later caller (this instance or another, this sweep or the next)
//     sees the marker and skips. If fn throws, the marker is released so the
//     next sweep retries; if the process dies mid-run, the lease expires and
//     the next sweep reclaims it.
//
// Sweeps SCAN state and decide what's due (the handover's "scans upcoming
// starts and fires once"); fireOnce makes the firing idempotent. There is no
// per-job queue to keep in sync with edits — moving a calendar event simply
// changes what the next scan sees.
// ─────────────────────────────────────────────────────────────────────────

const locks = () => db.collection("schedulerLocks");
const fired = () => db.collection("schedulerFired");

/** How long a fireOnce claim survives a crashed process before another
 *  instance may retry the delivery. */
const LEASE_MS = 5 * 60_000;

/** All instances poll frequently; this lock decides which one actually runs
 *  the interval. Returns true for the single winner. */
async function claimSweep(name: string, everyMs: number): Promise<boolean> {
  const now = Date.now();
  try {
    return await db.runTransaction(async (tx) => {
      const ref = locks().doc(name);
      const snap = await tx.get(ref);
      const nextAt = snap.exists ? Date.parse((snap.get("nextRunAt") as string) ?? "") || 0 : 0;
      if (now < nextAt) return false;
      tx.set(ref, {
        nextRunAt: new Date(now + everyMs).toISOString(),
        lastRunAt: new Date(now).toISOString(),
      });
      return true;
    });
  } catch {
    // Transaction contention means another instance claimed it — that's the
    // mechanism working, not an error.
    return false;
  }
}

const timers: NodeJS.Timeout[] = [];

/** Run `fn` roughly every `everyMs`, on exactly one instance per interval.
 *  A sweep that throws logs and waits for its next slot — it must never take
 *  the process down. */
export function sweep(name: string, everyMs: number, fn: () => Promise<void>): void {
  const tick = async () => {
    if (!(await claimSweep(name, everyMs))) return;
    try {
      await fn();
    } catch (e) {
      console.error(`[scheduler] sweep "${name}" failed:`, (e as Error).message);
    }
  };
  void tick();
  // Poll at least once a minute regardless of interval so a freshly started
  // instance picks up a due slot quickly; the lock keeps runs on schedule.
  timers.push(setInterval(() => void tick(), Math.min(everyMs, 60_000)));
}

/** Deliver exactly once across all instances and sweeps. `key` must be
 *  deterministic for the delivery (e.g. `cal_{eventId}_{date}`). Returns true
 *  when THIS call performed the delivery. `meta.tenantId` scopes the marker
 *  so e2e cleanup can wipe a test tenant's markers with its data. */
export async function fireOnce(
  key: string,
  meta: { tenantId?: string },
  fn: () => Promise<void>,
): Promise<boolean> {
  const ref = fired().doc(key);
  const now = Date.now();
  const claimed = await db
    .runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) {
        const status = snap.get("status") as string;
        const lease = Date.parse((snap.get("leaseUntil") as string) ?? "") || 0;
        if (status === "done" || now < lease) return false;
      }
      tx.set(ref, {
        status: "running",
        leaseUntil: new Date(now + LEASE_MS).toISOString(),
        at: new Date(now).toISOString(),
        ...(meta.tenantId ? { tenantId: meta.tenantId } : {}),
      });
      return true;
    })
    .catch(() => false);
  if (!claimed) return false;

  try {
    await fn();
    await ref.set({ status: "done", doneAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (e) {
    // Release the claim so the next sweep retries the delivery.
    await ref.delete().catch(() => {});
    throw e;
  }
}

/** The platform's wall clock is UK time (providers are UK businesses; every
 *  session/event time in the app is entered as UK local). The server may run
 *  anywhere, so never compare against the process's own timezone. */
export function ukNow(d = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/** "HH:MM" → minutes since midnight, or null when unparseable. */
export function toMinutes(hhmm: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec((hhmm ?? "").trim());
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 0 && v < 1440 ? v : null;
}
