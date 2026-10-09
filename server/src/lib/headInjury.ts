// A bump to the head tells the family AT ONCE (owner decision, 9 Oct 2026): bell + email, sent by the server the moment the accident report is
// saved, whatever the "tell parents about accidents" switch says and whatever the family muted. Head injuries can show symptoms hours later, so the
// message carries the standard NHS-style "watch for" advice (generic, no diagnosis). Pure on purpose (no database) so the wording is testable.
import { CATALOGS } from "../../../lib/i18n/messages/index";

/** A body-part / injury text that means the head. Word-bounded, so "headache" or "overhead" do not count. */
const HEAD_WORDS = /\b(head|forehead|scalp|skull|temple|crown|concussion|concussed)\b/i;

export interface HeadInjuryRecord { kind?: unknown; headInjury?: unknown; bodyPart?: unknown; injury?: unknown }

/** Whether an accident report records a head injury: the explicit tick, or the body part / injury text naming the head. Only accidents qualify. */
export function isHeadInjury(rec: HeadInjuryRecord): boolean {
  if (rec.kind !== "accident") return false;
  if (rec.headInjury === true) return true;
  return [rec.bodyPart, rec.injury].some((v) => typeof v === "string" && HEAD_WORDS.test(v));
}

export type Vars = Record<string, string>;
const get = (key: string): string | undefined => {
  const o = key.split(".").reduce<unknown>((a, k) => (a && typeof a === "object" ? (a as Record<string, unknown>)[k] : undefined), (CATALOGS as Record<string, unknown>).en);
  return typeof o === "string" ? o : undefined;
};
const fill = (s: string, v: Vars) => Object.entries(v).reduce((t, [k, x]) => t.split(`{${k}}`).join(x), s);

export const HEAD_TITLE_KEY = "p7shell.bellHeadTitle";
export const HEAD_BODY_KEY = "p7shell.bellHeadBody";

/** `v`: name (child), activity, when ("14:30", or the date when no time was recorded), contact (provider name and phone/email). */
export function headInjuryBell(v: Vars): { title: string; body: string; i18n: { tk: string; tv: Vars; bk: string; bv: Vars } } {
  return {
    title: fill(get(HEAD_TITLE_KEY) ?? HEAD_TITLE_KEY, v),
    body: fill(get(HEAD_BODY_KEY) ?? HEAD_BODY_KEY, v),
    i18n: { tk: HEAD_TITLE_KEY, tv: v, bk: HEAD_BODY_KEY, bv: v },
  };
}

const escH = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** English-only email (like every other email). Values are escaped. */
export function headInjuryEmail(v: Vars): { subject: string; html: string } {
  return {
    subject: `${v.name} had a bump to the head`,
    html:
      `<p><b>${escH(v.name)}</b> had a bump to the head at <b>${escH(v.activity)}</b> (${escH(v.when)}). Staff have checked them and looked after them.</p>` +
      `<p>Please contact <b>${escH(v.contact)}</b> if you have any questions.</p>` +
      `<p><b>Head injuries can show symptoms later.</b> Over the next 24 hours, watch for headache, being sick (vomiting), unusual drowsiness or confusion. ` +
      `If you notice any of these, or you are worried, get medical help straight away (NHS 111, or 999 in an emergency).</p>`,
  };
}
