// Trips & visits: the rules the SERVER enforces (pure, no database). The planner screen mirrors some of these to guide the
// user, but the screen is only a guide: the API refuses a trip that breaks them (ratio, sign-off, consent, cost).

export type Consent = "granted" | "pending" | "declined";
export interface RuleAttendee { n: string; childId?: string; consent?: Consent; consentBy?: string; med?: string; em?: boolean }
export interface RuleTrip {
  destination?: string; date?: string; lead?: string; transport?: string; offsiteRatio?: number;
  roster?: { n: string; r?: string; fa?: boolean }[]; staff?: string[];
  hazards?: { h: string; done?: boolean; residual?: string }[]; raSigned?: boolean;
  attendees?: RuleAttendee[];
  departTime?: string; returnTime?: string; address?: string;
}

export const consentOf = (a: RuleAttendee): Consent => a.consent ?? "pending";

/** Children with no answer yet. A DECLINED child is "not going": they never block. */
export const consentPending = (list: RuleAttendee[]): RuleAttendee[] => list.filter((a) => consentOf(a) === "pending");

/** Children who are going (consent given). */
export const going = (list: RuleAttendee[]): RuleAttendee[] => list.filter((a) => consentOf(a) === "granted");

/** The server owns this flag: every child still going has said yes, nobody is waiting, and at least one is going.
 *  A declined child does not turn it off (they are simply not on the trip). */
export const consentObtained = (list: RuleAttendee[]): boolean => consentPending(list).length === 0 && going(list).length > 0;

/** Children nobody can be asked about: no linked booking/child record (or a same-name clash), so no parent receives a request.
 *  A declined child is not counted. */
export const unlinkedChildren = (list: RuleAttendee[]): RuleAttendee[] => list.filter((a) => !a.childId && consentOf(a) !== "declined");

/** Staff needed for the children going: ceil(going / ratio), never below 1. */
export const staffNeeded = (goingCount: number, ratio: number): number => Math.max(1, Math.ceil(goingCount / Math.max(1, ratio)));

export const rosterCount = (t: Pick<RuleTrip, "roster" | "staff">): number => ((t.roster?.length ?? 0) > 0 ? t.roster!.length : (t.staff?.length ?? 0));

/** Null when the trip has the staff its ratio asks for (or has no ratio set). */
export function ratioProblem(t: RuleTrip): string | null {
  if (!t.offsiteRatio) return null;
  const n = going(t.attendees ?? []).length;
  const need = staffNeeded(n, t.offsiteRatio);
  const have = rosterCount(t);
  if (have >= need) return null;
  return `Not enough staff for the ratio: ${n} ${n === 1 ? "child is" : "children are"} going at 1:${t.offsiteRatio}, which needs ${need} staff, and ${have} ${have === 1 ? "is" : "are"} on the trip.`;
}

/** Plain-English list of what is still missing before the trip can be signed off. Empty = ready. */
export function signoffProblems(t: RuleTrip): string[] {
  const out: string[] = [];
  if (!t.destination?.trim() || !t.date || !t.lead?.trim() || !t.transport?.trim()) out.push("the trip needs a destination, date, trip lead and transport");
  const hz = t.hazards ?? [];
  if (!(hz.length > 0 && hz.every((h) => h.done && h.residual) && t.raSigned)) out.push("the risk assessment must be completed and signed");
  const r = ratioProblem(t);
  if (r) out.push(r.replace(/\.$/, "").replace(/^N/, "n"));
  const roster = t.roster ?? [];
  if (roster.length > 0 || t.offsiteRatio) {
    if (!roster.some((s) => /lead/i.test(s.r ?? ""))) out.push("the staff roster needs a trip lead");
    if (!roster.some((s) => s.fa)) out.push("the staff roster needs a first-aider");
  }
  if (going(t.attendees ?? []).length === 0) out.push("no child is going yet");
  return out;
}

export type CostCheck = { ok: true; value: string | undefined } | { ok: false; error: string };
/** The trip cost is money shown to parents ("£12.50"): blank, or a plain amount with at most 2 decimals (no words, no minus, no commas). */
export function parseCost(raw: unknown): CostCheck {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  const s = String(raw).trim().replace(/^£\s*/, "");
  if (s === "") return { ok: true, value: undefined };
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(s)) return { ok: false, error: "The cost must be an amount in pounds such as 12 or 12.50 (no words or symbols). Write 0 for a free trip." };
  return { ok: true, value: Number(s).toFixed(2) };
}

const norm = (s: unknown) => String(s ?? "").trim();
/** What the sign-off was GIVEN on: change any of this after sign-off and the sign-off no longer covers the trip. Cosmetic fields are left out. */
export function materialSnapshot(t: RuleTrip): string {
  return JSON.stringify({
    d: norm(t.destination), a: norm(t.address), date: norm(t.date), dep: norm(t.departTime), ret: norm(t.returnTime), tr: norm(t.transport),
    lead: norm(t.lead), ratio: t.offsiteRatio ?? null,
    roster: (t.roster ?? []).map((s) => [norm(s.n), norm(s.r), !!s.fa]).sort(),
    staff: (t.staff ?? []).map(norm).sort(),
    kids: (t.attendees ?? []).map((a) => [norm(a.n).toLowerCase(), a.childId ?? "", consentOf(a)]).sort(),
  });
}

/** Who may read a child's medical text on a trip: the owner/manager roles, the trip lead (organiser or named lead) and team leads. Plain staff see a flag only. */
export function viewForReader<T extends RuleAttendee>(list: T[], canSeeMedical: boolean): (T & { medFlag?: boolean })[] {
  if (canSeeMedical) return list;
  return list.map((a) => {
    const { med, consentBy, ...rest } = a as T & { consentBy?: string };
    const by = consentBy ? (/@/.test(consentBy) ? "parent" : "provider") : undefined;
    return { ...(rest as unknown as T), ...(by ? { consentBy: by } : {}), ...(med ? { medFlag: true } : {}) };
  });
}

/** The sign-off after something it covered has changed: no longer submitted, the old approval cleared, and the reason kept. */
export function reopenedSignoff(prev: { approvedBy?: string; approvedAt?: string; submitted?: boolean } | undefined, reason: string, now: string): Record<string, unknown> {
  return { ...(prev ?? {}), submitted: false, approvedBy: "", approvedAt: "", reopenedAt: now, reopenedFor: reason };
}

/** A head count was recorded: any checkpoint now carries a number that it did not carry before. */
export function headCountRecorded(before: { n: string; counted?: number | null }[] | undefined, incoming: { n: string; counted?: number | null }[] | undefined): boolean {
  if (!incoming) return false;
  const was = new Map((before ?? []).map((c) => [c.n, c.counted ?? null]));
  return incoming.some((c) => c.counted != null && was.get(c.n) !== c.counted);
}
