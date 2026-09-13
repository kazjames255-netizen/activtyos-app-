import { displayName } from "@/lib/display-name";

// ─────────────────────────────────────────────────────────────────────────
// Shared task presentation rules.
//
// These started life inside TasksApp, which meant every OTHER surface that
// lists tasks — the HQ Sales board, the dashboards — quietly disagreed with
// the task manager: printing a raw email where the manager says "Me", or one
// row per date for a repeat the manager folds. Anything that renders a task
// should import from here rather than re-deciding.
// ─────────────────────────────────────────────────────────────────────────

/** The signed-in user, from /api/me. `aliases` are the person's other
 *  sign-ins (users.alsoMe) — one person with two logins is still one "Me". */
export interface Person { name: string; email: string; aliases?: string[] }

/** Every email and name that means "me". */
function meKeys(me: Person): { emails: Set<string>; names: Set<string> } {
  const lc = (s: string) => s.trim().toLowerCase();
  const all = [me.email ?? "", ...(me.aliases ?? [])].map(lc).filter(Boolean);
  const emails = new Set(all.filter((x) => x.includes("@")));
  const names = new Set([me.name ?? "", ...all.filter((x) => !x.includes("@")), ...[...emails].map((e) => displayName("", e))].map(lc).filter(Boolean));
  return { emails, names };
}

/** Only the assignee fields — deliberately loose, so any task-ish row fits. */
export interface Assigned { who?: string; whoEmail?: string }

/**
 * Is this task the given person's?
 *
 * Email wins when both sides have one: names aren't unique and people get
 * renamed, and neither should hand your tasks to someone else or take yours
 * away. `who` falls back to matching either the name or the email, because it
 * holds whatever was typed at the time.
 */
export function isMine(t: Assigned, me: Person): boolean {
  const { emails, names } = meKeys(me);
  const theirEmail = (t.whoEmail ?? "").trim().toLowerCase();
  if (theirEmail && emails.size) return emails.has(theirEmail);
  const who = (t.who ?? "").trim().toLowerCase();
  if (!who) return false;
  return names.has(who) || emails.has(who);
}

/** Has the person been given a step (subtask) on this task? A step handed to
 *  someone must reach THEIR My tasks, not only the parent's owner's (d11s8). */
export function hasMySub(t: { subs?: Assigned[] }, me: Person): boolean {
  return (t.subs ?? []).some((s) => isMine(s, me));
}

/** The assignee as a label: your own read "Me", nobody reads as a raw email. */
export function whoLabel(t: Assigned, me: Person): string {
  const who = (t.who ?? "").trim();
  if (!who && !(t.whoEmail ?? "").trim()) return "";
  if (isMine(t, me)) return "Me";
  // A `who` that IS an email goes in as the email, so it comes out name-shaped
  // instead of printing the domain.
  return who.includes("@") ? displayName("", who) : displayName(who, t.whoEmail);
}

/** The same rule for a bare assignee string, where there's no task to read. */
export function personLabel(who: string, me: Person): string {
  const w = who.trim();
  const lower = w.toLowerCase();
  const { emails, names } = meKeys(me);
  if (names.has(lower) || emails.has(lower)) return "Me";
  return w.includes("@") ? displayName("", w) : w;
}

/** Only the series field — see the note on foldRepeats. */
export interface Repeatable { seriesId?: string }

/**
 * Collapse a repeat into its first row plus the rest.
 *
 * A repeat is materialised as one task per date, so a month of a daily task is
 * 30 near-identical rows that bury everything else. Pass a list that's ALREADY
 * in the order you want to show it: the first of a series seen becomes the
 * lead, and `rest` fills by reference as the remaining dates go past.
 */
export function foldRepeats<T extends Repeatable>(list: T[]): { lead: T; rest: T[] }[] {
  const bySeries = new Map<string, T[]>();
  const out: { lead: T; rest: T[] }[] = [];
  for (const t of list) {
    if (!t.seriesId) { out.push({ lead: t, rest: [] }); continue; }
    const seen = bySeries.get(t.seriesId);
    if (seen) { seen.push(t); continue; }
    const rest: T[] = [];
    bySeries.set(t.seriesId, rest);
    out.push({ lead: t, rest });
  }
  return out;
}

/** How a repeat's frequency reads in a sentence. */
export const REPEAT_WORD: Record<string, string> = {
  daily: "every day", weekdays: "every weekday", weekly: "every week", monthly: "every month",
};
