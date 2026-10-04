// Blocks-builder pricing engine — the server-side source of truth for the
// formula the UI previews (spec §4): the operator sets ONE number (the full
// price of the longest pass); everything else derives from it, and any value
// can be overridden. Checkout must never trust client arithmetic, so this
// resolver runs here and its output is snapshotted onto listings on
// "send to listings".

export interface PeriodDoc {
  tenantId: string;
  franchiseId?: string | null;
  createdBy?: string | null;
  title: string;
  start: string; // "HH:MM"
  finish: string; // "HH:MM"
}

export interface PassDoc {
  tenantId: string;
  franchiseId?: string | null;
  createdBy?: string | null;
  name: string;
  days: number;
  details?: string;
}

export interface BundleDoc {
  tenantId: string;
  franchiseId?: string | null;
  createdBy?: string | null;
  name: string;
  periodIds: string[];
  passIds: string[];
  listingIds: string[];
  order: number;
  archived: boolean;
  priced: boolean;
  masterPrice: number | null;
  calcOn: boolean;
  passFlat: Record<string, number>;
  passMode: Record<string, "flat">;
  periodPrice: Record<string, number>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const mins = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const periodHours = (p: Pick<PeriodDoc, "start" | "finish">) =>
  Math.max(1, (mins(p.finish) - mins(p.start)) / 60);

export interface ResolvedPricing {
  /** Passes sorted by days DESC (the first is the master) with final prices. */
  passes: { id: string; name: string; days: number; price: number; details?: string }[];
  /** "{passId}_{periodId}" → final per-timing price. */
  timings: Record<string, number>;
  perDay: number;
}

export function resolveBundlePricing(
  bundle: BundleDoc,
  passesById: Map<string, PassDoc & { id: string }>,
  periodsById: Map<string, PeriodDoc & { id: string }>,
): ResolvedPricing {
  const passes = bundle.passIds
    .map((id) => passesById.get(id))
    .filter((p): p is PassDoc & { id: string } => !!p)
    .sort((a, b) => b.days - a.days);
  const periods = bundle.periodIds
    .map((id) => periodsById.get(id))
    .filter((p): p is PeriodDoc & { id: string } => !!p);

  // A bundle that never recorded calcOn/passMode (older docs) is "calculated", exactly as the
  // wizard reads it (calcOn !== false). Treating undefined as OFF made every timing £0 on the
  // server while the pass itself showed its base price (a £20 day pass at £0.00 at checkout).
  const calcOn = bundle.calcOn !== false;
  const passMode = bundle.passMode ?? {};
  const passFlat = bundle.passFlat ?? {};
  const periodPrice = bundle.periodPrice ?? {};
  const masterPrice = bundle.masterPrice ?? 0;
  const master = passes[0];
  const perDay = calcOn && master ? masterPrice / master.days : 0;
  const baseHours = periods.length ? Math.max(...periods.map(periodHours)) : 1;

  const priceForPass = (p: PassDoc & { id: string }, idx: number): number => {
    if (idx === 0) return masterPrice; // the master IS the price
    if (!calcOn) return passFlat[p.id] ?? 0;
    if (passMode[p.id] === "flat") return passFlat[p.id] ?? 0;
    return round2(p.days * perDay);
  };

  const resolvedPasses = passes.map((p, idx) => ({
    id: p.id,
    name: p.name,
    days: p.days,
    price: priceForPass(p, idx),
    ...(p.details ? { details: p.details } : {}),
  }));

  const timings: Record<string, number> = {};
  for (const [idx, p] of passes.entries()) {
    const passPrice = resolvedPasses[idx].price;
    for (const r of periods) {
      const key = `${p.id}_${r.id}`;
      const override = periodPrice[key];
      timings[key] =
        override !== undefined && override !== null
          ? override
          : calcOn
            ? round2((passPrice * periodHours(r)) / baseHours)
            : 0;
    }
  }

  return { passes: resolvedPasses, timings, perDay: round2(perDay) };
}
