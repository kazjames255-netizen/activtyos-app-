// Two short parent bells for children's health data (health run, 10 Oct 2026). Pure on purpose (no database) so the wording is testable.
//   medReask:  a provider changed a consented medicine's name, dose or route, so the consent was cleared and the parent is asked again.
//   recordMade: a confidential record was made about the child (an accident marked confidential). Says THAT a record exists and who to
//               contact, never what it says - confidential always wins over sharing.
import { CATALOGS } from "../../../lib/i18n/messages/index";

export type Vars = Record<string, string>;
const get = (key: string): string | undefined => {
  const o = key.split(".").reduce<unknown>((a, k) => (a && typeof a === "object" ? (a as Record<string, unknown>)[k] : undefined), (CATALOGS as Record<string, unknown>).en);
  return typeof o === "string" ? o : undefined;
};
const fill = (s: string, v: Vars) => Object.entries(v).reduce((t, [k, x]) => t.split(`{${k}}`).join(x), s);
const escH = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const MED_REASK_KEYS = { title: "p7shell.bellMedReaskTitle", body: "p7shell.bellMedReaskBody" } as const;
export const RECORD_MADE_KEYS = { title: "p7shell.bellRecordTitle", body: "p7shell.bellRecordBody" } as const;

function bell(keys: { title: string; body: string }, v: Vars) {
  return {
    title: fill(get(keys.title) ?? keys.title, v),
    body: fill(get(keys.body) ?? keys.body, v),
    i18n: { tk: keys.title, tv: v, bk: keys.body, bv: v },
  };
}

/** `v`: name (child), med (medicine name), provider. */
export function medReaskBell(v: Vars) {
  return bell(MED_REASK_KEYS, v);
}
export function medReaskEmail(v: Vars): { subject: string; html: string } {
  return {
    subject: `Please confirm ${v.med} for ${v.name} again`,
    html:
      `<p><b>${escH(v.provider)}</b> changed the details of <b>${escH(v.med)}</b> for <b>${escH(v.name)}</b>.</p>` +
      `<p>Your earlier consent no longer applies, so no doses will be given until you have checked the new details and given your consent again in your account.</p>`,
  };
}

/** `v`: name (child), provider. Carries NO text from the record. */
export function recordMadeBell(v: Vars) {
  return bell(RECORD_MADE_KEYS, v);
}
export function recordMadeEmail(v: Vars): { subject: string; html: string } {
  return {
    subject: `${v.name}: a record was made`,
    html: `<p>A record was made about <b>${escH(v.name)}</b>. Please contact <b>${escH(v.provider)}</b> for details.</p>`,
  };
}
