// Display-only names for the onboarding checklist. The field model (ids, labels, options) is English and is what gets STORED
// (option values, custom fields a provider typed, status words), so nothing here changes stored data: each helper looks the English
// text up in the p8wf catalogue and falls back to the original when there is no translation (custom fields, provider-typed text).
type T = (key: string, vars?: Record<string, string | number>) => string;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48);
const pick = (t: T, key: string, fallback: string): string => { const r = t(key); return r !== key ? r : fallback; };

export const obSection = (t: T, sid: string, fallback: string) => pick(t, "p8wf.obs_" + sid, fallback);
export const obLabel = (t: T, f: { id: string; label: string; custom?: boolean }) => (f.custom ? f.label : pick(t, "p8wf.obl_" + f.id, f.label));
export const obHint = (t: T, f: { id: string; hint?: string; custom?: boolean }) => (!f.hint || f.custom ? f.hint : pick(t, "p8wf.obh_" + f.id, f.hint));
/** An option's DISPLAY text; the stored value stays the English string. */
export const obOpt = (t: T, o: string) => pick(t, "p8wf.obo_" + slug(o), o);
const STATUS_KEY: Record<string, string> = { todo: "obStTodo", requested: "obStRequested", received: "obStReceived", verified: "obStVerified" };
export const obStatus = (t: T, st: string) => t("p8wf." + (STATUS_KEY[st] ?? "obStTodo"));
/** Short day / slot names for the availability grid (stored keys stay "Mon".."Sun", "AM"/"PM"/"Eve"). */
export const obDay = (t: T, d: string) => pick(t, "p8wf.obD" + d, d);
export const obSlot = (t: T, s: string) => pick(t, "p8wf.obS" + s, s);
