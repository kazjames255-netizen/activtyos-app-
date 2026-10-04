/**
 * Age rules for a child who may have NO date of birth (provider set DOB to Optional).
 * A child with no known age is allowed through every age rule: it is never judged out of
 * range and never counted in (or blocked by) a per-age place cap. Pure.
 */
export interface AgeGroup { id: string; ageFrom: number; ageTo: number }

/** The age to judge, or undefined when nothing tells us (the stored 0 is a placeholder, not an infant). */
export function judgedAge(c: { age?: number; ageKnown?: boolean }): number | undefined {
  return c.ageKnown === false || typeof c.age !== "number" || !Number.isFinite(c.age) ? undefined : c.age;
}

/** The per-age cap group a child falls in; undefined for an unknown age (skips the cap). */
export function ageCapGroup(c: { age?: number; ageKnown?: boolean }, groups: AgeGroup[]): string | undefined {
  const a = judgedAge(c);
  return a === undefined ? undefined : groups.find((g) => a >= g.ageFrom && a <= g.ageTo)?.id;
}

/** Outside the listing's [from, to] range; false for an unknown age. */
export function outsideAgeRange(c: { age?: number; ageKnown?: boolean }, from: number, to: number): boolean {
  const a = judgedAge(c);
  return a !== undefined && ((Number.isFinite(from) && a < from) || (Number.isFinite(to) && a > to));
}
