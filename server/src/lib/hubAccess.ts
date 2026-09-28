import type { HubCtx } from "./hubCore";
import { childDobs, effectiveYearGroup, hubConfig, scopedChildren } from "./hubCore";
import { childAssignedNoteIds, tenantRoster, type NoteRow } from "./hubIndex";

// Which lessons a FAMILY may open, decided by the provider's `lessonAccess` setting (Setup → Teaching Hub):
//   "all"      — every published lesson in the library (default), so a child can work at their own pace;
//   "year"     — lessons for the child's own year group, plus anything the tutor has set for them;
//   "assigned" — only lessons the tutor has set (via homework).
// Anything a tutor has set is always available. Returns null when there is no restriction (a tutor, or "all").
const yearNo = (g: string | null | undefined) => { const m = /(\d{1,2})/.exec(g ?? ""); return m ? Number(m[1]) : /^reception$/i.test((g ?? "").trim()) ? 0 : null; };

export type LessonAccess = "all" | "year" | "assigned";
/** Pure rule for ONE child: may they open note `n` under `mode`? (`assigned` = note ids the tutor set, `year` = their year number.) */
export const childMayOpen = (mode: LessonAccess, n: Pick<NoteRow, "id" | "lessonYear">, assigned: ReadonlySet<string>, year: number | null): boolean =>
  mode === "all" || assigned.has(n.id) || (mode === "year" && n.lessonYear != null && year !== null && n.lessonYear === year);

export async function familyNoteRule(ctx: HubCtx): Promise<((n: NoteRow) => boolean) | null> {
  if (ctx.canEdit) return null;
  const kids = scopedChildren(ctx);
  if (!kids.length) return () => false;
  // Resolved PER CHILD (their own provider franchise may set a different rule); a note opens if ANY child in scope may open it.
  // A tenant that never set `lessonAccess` gets "assigned" (lib/hubConfig.ts default), i.e. only what the tutor set.
  // One config read per child (was two: once for the mode and again for the year list) — reused below.
  const cfgs = await Promise.all(kids.map((c) => hubConfig(ctx.tenantId, c.franchiseId)));
  const modes = cfgs.map((cfg) => cfg.lessonAccess as LessonAccess);
  if (modes.includes("all")) return null;
  const sets = await Promise.all(kids.map((c) => childAssignedNoteIds(ctx.tenantId, c.childId)));
  const roster = modes.includes("year") ? await tenantRoster(ctx.tenantId) : [];
  // The year they are in NOW: an automatic year follows the dob and a hand-set one moves up each September, so the stored value alone goes stale.
  const dobs = modes.includes("year") ? await childDobs(kids.map((c) => c.childId)) : new Map<string, string | null>();
  const years = kids.map((c, i) => { const e = roster.find((r) => r.childId === c.childId); return yearNo(e ? effectiveYearGroup(e, dobs.get(c.childId) ?? null, cfgs[i]!.yearGroups, new Date(), cfgs[i]!.yearAutoAdvance) : null); });
  return (n) => kids.some((_, i) => childMayOpen(modes[i]!, n, sets[i]!, years[i]!));
}
