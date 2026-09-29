import { db } from "../firebase";

// ─────────────────────────────────────────────────────────────────────────
// subscriptionEvents — the provider lifecycle as HISTORY, not as a guess.
//
// The tenant's `subscription` record is CURRENT STATE: it is overwritten on
// every transition, and reactivating clears `canceledAt` outright. Anything
// derived from it therefore rewrites itself — HQ's Fall-off chart re-counted
// last quarter's cancellations every time a provider came back (backlog 46a,
// acceptance p2-m35). Two smaller symptoms of the same cause: a provider
// sitting at `cancel_at_period_end` had no date at all, so the month they
// gave notice was invisible until the term ended.
//
// So every transition is APPENDED here, once, at the moment it happens, and
// never touched again:
//
//   { tenantId, type, state, at, month, seq, plan, band, mrr, cadence,
//     subscriptionId, source, recordedAt }
//
//   type   — the EDGE that was crossed, i.e. what happened:
//            trial_started | started | canceling | canceled | reactivated
//   state  — the lifecycle bucket the tenant landed in (trialing | active |
//            canceling | canceled). The edge is derived from the previous
//            event's state plus this one, which is what makes "reactivated"
//            distinguishable from a plain "started".
//   at     — when it happened in the real world. Stripe's own timestamps
//            where it has them (canceled_at, trial_end, start_date), else
//            now. Clamped to be >= the previous event so the log is always
//            in order, whatever order we learn things in.
//   seq    — per-tenant sequence number, 0-based. Also the doc id's middle
//            part, which is what makes the append idempotent (below).
//   mrr    — monthly recurring value at that moment, from the tenant's
//            snapshotted price (annual bills 10 months, so ÷12 of ×10).
//
// IDEMPOTENCY. The same real-world transition must never append two rows,
// and it is reached from four directions: the Stripe webhook, the
// subscription routes, the webhook's retry, and the sync sweep (which
// re-syncs every billed tenant on a timer). Two independent guards:
//
//   1. State guard — an append only happens when the tenant's newest event
//      has a DIFFERENT state. A sweep that sees nothing new writes nothing.
//   2. Deterministic id — `{tenantId}__{seq}__{type}`, created with
//      tx.create(). A replay computes the same seq, so the create collides
//      and is refused; two racing writers collide on the same id, so
//      exactly one wins and the loser's retry sees the winner's row and
//      falls out at guard 1.
//
// Nothing here ever updates or deletes a row, and there is no route that
// writes to this collection — the record is made by the code that already
// knows (lib/billing.ts syncFromStripe, plus the record-only paths in
// routes/subscription.ts for dev without Stripe keys).
// ─────────────────────────────────────────────────────────────────────────

export type SubEventType = "trial_started" | "started" | "canceling" | "canceled" | "reactivated";
/** The lifecycle bucket an event lands the tenant in. */
export type SubState = "trialing" | "active" | "canceling" | "canceled";
/** Who noticed the transition — diagnostics only, never logic. */
export type SubEventSource = "webhook" | "route" | "sweep" | "backfill";

export interface SubscriptionEvent {
  tenantId: string;
  type: SubEventType;
  state: SubState;
  at: string;
  month: string;
  seq: number;
  plan: string | null;
  band: string | null;
  cadence: string;
  mrr: number;
  subscriptionId: string | null;
  source: SubEventSource;
  recordedAt: string;
}

const events = () => db.collection("subscriptionEvents");
const monthOf = (iso: string) => iso.slice(0, 7);
const nowIso = () => new Date().toISOString();

/** The lifecycle bucket a local subscription status belongs to. past_due /
 *  unpaid are NOT transitions: the provider has a card problem, they haven't
 *  left, and the grace clock already lives on the tenant record. "none" is a
 *  signup that never chose a plan — nothing has happened yet. */
export function stateForStatus(status: string | null | undefined): SubState | null {
  switch (status) {
    case "trialing": return "trialing";
    case "active": return "active";
    case "canceling": return "canceling";
    case "canceled": return "canceled";
    default: return null;
  }
}

/** Which edge was crossed, from the state we were in to the one we're in. */
function edgeFor(prev: SubState | null, next: SubState): SubEventType {
  if (next === "canceling") return "canceling";
  if (next === "canceled") return "canceled";
  // Coming back from the exit — the thing the old chart could not see.
  if (prev === "canceling" || prev === "canceled") return "reactivated";
  return next === "trialing" ? "trial_started" : "started";
}

/** Monthly recurring value of a snapshotted price. Annual bills 10 months in
 *  one charge, so its monthly worth is price × 10 ÷ 12. */
function mrrOf(price: number, cadence: string): number {
  const m = cadence === "year" ? (price * 10) / 12 : price;
  return Math.round(m * 100) / 100;
}

async function eventsForTenant(
  tenantId: string,
  tx?: FirebaseFirestore.Transaction,
): Promise<SubscriptionEvent[]> {
  // Equality-only query — no composite index needed, and a tenant's whole
  // lifecycle is a handful of rows, so it's ordered here rather than by
  // Firestore.
  const q = events().where("tenantId", "==", tenantId);
  const snap = tx ? await tx.get(q) : await q.get();
  return snap.docs
    .map((d) => d.data() as SubscriptionEvent)
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
}

/** Append the transition this status represents, if it IS a transition.
 *  Returns the type appended, or null when there was nothing new to record.
 *  Never throws for a caller's benefit — a failed history write must not
 *  fail a billing operation. */
export async function recordSubscriptionEvent(opts: {
  tenantId: string;
  /** The tenant's LOCAL status after the change (see stateForStatus). */
  status: string | null | undefined;
  /** When it happened, if the source knows better than "now". */
  at?: string | null;
  /** The Stripe subscription this is about, when there is one. */
  subscriptionId?: string | null;
  source: SubEventSource;
}): Promise<SubEventType | null> {
  const next = stateForStatus(opts.status);
  if (!next) return null;
  try {
    // Cheap pre-check: the sweep re-syncs every billed tenant on a timer and
    // almost always finds nothing changed, so don't open a transaction for it.
    const seen = await eventsForTenant(opts.tenantId);
    if (seen[seen.length - 1]?.state === next) return null;

    const t = await db.collection("tenants").doc(opts.tenantId).get();
    const sub = (t.get("subscription") as Record<string, unknown> | undefined) ?? {};
    // A webhook for a SUPERSEDED subscription (e.g. the old one /start
    // cancelled while replacing it) is not this tenant's history — it would
    // book a cancellation against a provider who only switched plan.
    const liveId = (sub.stripeSubscriptionId as string | undefined) ?? null;
    if (opts.subscriptionId && liveId && liveId !== opts.subscriptionId) return null;

    const plan = (sub.plan as string | undefined) ?? null;
    const band = (sub.band as string | undefined) ?? null;
    const cadence = (sub.cadence as string | undefined) ?? "month";
    const mrr = mrrOf(Number(sub.price) || 0, cadence);

    const appended = await db.runTransaction(async (tx) => {
      const prior = await eventsForTenant(opts.tenantId, tx);
      const last = prior[prior.length - 1] ?? null;
      if (last?.state === next) return null;
      const type = edgeFor(last?.state ?? null, next);
      // Stripe has no "notice given at" and no "un-cancelled at", so those
      // two are stamped now; everything else prefers Stripe's own clock.
      const hinted = type === "reactivated" || type === "canceling" ? null : opts.at;
      let at = hinted && !Number.isNaN(Date.parse(hinted)) ? new Date(hinted).toISOString() : nowIso();
      if (last && at < last.at) at = last.at; // the log is always in order
      const seq = prior.length;
      const row: SubscriptionEvent = {
        tenantId: opts.tenantId,
        type, state: next, at, month: monthOf(at), seq,
        plan, band, cadence, mrr,
        subscriptionId: opts.subscriptionId ?? liveId,
        source: opts.source,
        recordedAt: nowIso(),
      };
      tx.create(events().doc(`${opts.tenantId}__${String(seq).padStart(4, "0")}__${type}`), row);
      return type;
    });
    return appended;
  } catch (e) {
    const code = (e as { code?: number | string }).code;
    // ALREADY_EXISTS — a replay or a racing writer got there first. That is
    // the guard doing its job, not a failure.
    if (code === 6 || code === "already-exists") {
      console.log(`[sub-events] ${opts.tenantId} → ${next} already recorded — ignoring the duplicate`);
      return null;
    }
    console.error(`[sub-events] ${opts.tenantId} → ${next} not recorded:`, (e as Error).message);
    return null;
  }
}

// ── The aggregate HQ reads ───────────────────────────────────────────────

export interface ChurnMonth {
  /** "YYYY-MM" (UTC). */
  month: string;
  /** Short month name, e.g. "Sep" — for the chart's axis. */
  label: string;
  /** Providers on the books when the month opened. */
  base: number;
  /** Providers who gave notice (or ended outright) during the month. */
  canceled: number;
  /** canceled ÷ base, as a percentage. */
  pct: number;
}

const monthStart = (key: string) => `${key}-01T00:00:00.000Z`;

/** Churn per calendar month, from the event log alone — so a month's number
 *  can never change once the month is over.
 *
 *  A cancellation is counted in the month NOTICE was given (the `canceling`
 *  event), not the month the term happened to end; a `canceled` event that
 *  follows its own notice is the term expiring, already counted. A
 *  subscription that ends outright with no notice counts at its `canceled`.
 *
 *  The base is who was actually on the books when the month opened: replay
 *  each tenant's events up to that instant and keep the ones that hadn't
 *  cancelled. Tenants with no events at all are pre-billing providers (no
 *  `subscription` field — treated as active everywhere else, so counted here
 *  too from their signup date); a signup that never chose a plan
 *  (status "none") is not a subscriber and stays out of the denominator. */
export async function churnByMonth(months: number): Promise<{ months: ChurnMonth[] }> {
  const [evSnap, tenantsSnap] = await Promise.all([
    events().get(),
    db.collection("tenants").get(),
  ]);

  // A deleted provider's history is not the network's churn — an e2e
  // throwaway account's cancellation would otherwise sit in the chart for
  // ever. The log is never edited; it is simply read against live tenants.
  const live = new Set(tenantsSnap.docs.map((d) => d.id));
  const byTenant = new Map<string, SubscriptionEvent[]>();
  for (const d of evSnap.docs) {
    const e = d.data() as SubscriptionEvent;
    if (!e.tenantId || !e.at || !live.has(e.tenantId)) continue;
    const list = byTenant.get(e.tenantId) ?? [];
    list.push(e);
    byTenant.set(e.tenantId, list);
  }
  for (const list of byTenant.values()) list.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));

  const tenants = tenantsSnap.docs.map((d) => {
    const sub = (d.get("subscription") as Record<string, unknown> | undefined) ?? null;
    return {
      id: d.id,
      // createdAt is stamped at creation and backfilled, but the document's
      // own create time is always there — so a missing field can never land
      // a tenant in every month's denominator again (backlog 46a).
      createdAt: (d.get("createdAt") as string | undefined)
        ?? d.createTime?.toDate().toISOString()
        ?? null,
      neverSubscribed: !!sub && ((sub.status as string | undefined) ?? "none") === "none",
    };
  });

  const now = new Date();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  // Every churn moment in the log, bucketed by the month it happened in.
  const lost: Record<string, number> = {};
  for (const list of byTenant.values()) {
    list.forEach((e, i) => {
      const churned = e.type === "canceling"
        || (e.type === "canceled" && list[i - 1]?.type !== "canceling");
      if (churned) lost[monthOf(e.at)] = (lost[monthOf(e.at)] ?? 0) + 1;
    });
  }

  const rows = keys.map((key) => {
    const opened = monthStart(key);
    let base = 0;
    for (const t of tenants) {
      const list = byTenant.get(t.id);
      if (list?.length) {
        const before = list.filter((e) => e.at < opened);
        if (!before.length) continue;                              // joined later
        if (before[before.length - 1].state === "canceled") continue; // already gone
        base++;
      } else {
        if (t.neverSubscribed) continue;                           // never a subscriber
        if (!t.createdAt || t.createdAt >= opened) continue;        // joined later
        base++;
      }
    }
    const canceled = lost[key] ?? 0;
    return {
      month: key,
      label: new Date(opened).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
      base,
      canceled,
      pct: base ? Math.round((canceled / base) * 10000) / 100 : 0,
    };
  });

  return { months: rows };
}
