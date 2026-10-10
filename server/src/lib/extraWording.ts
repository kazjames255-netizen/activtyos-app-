// Server side of the extra-request wording (features/bookings/addonWording.ts): English text for the stored fallback / emails, and the key + data
// the bell stores so the viewer reads it in their own language. Pure: no database.
import { CATALOGS } from "../../../lib/i18n/messages/index";
import type { LocaleCode } from "../../../lib/i18n/config";
import type { AddonRequest, AddonRequestTarget } from "../../../features/bookings/types";
import { enDay, renderFull, renderWordingBody, renderWordingTitle, type Msg, type Tr, type Wording } from "../../../features/bookings/addonWording";

const lookup = (lang: LocaleCode, key: string): string | undefined => {
  const o = key.split(".").reduce<unknown>((a, k) => (a && typeof a === "object" ? (a as Record<string, unknown>)[k] : undefined), CATALOGS[lang] as unknown);
  return typeof o === "string" ? o : undefined;
};
/** A translator for one language, falling back to English then to the key. */
export const trFor = (lang: LocaleCode = "en"): Tr => (key, vars = {}) =>
  Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), lookup(lang, key) ?? lookup("en", key) ?? key);

/** Plain English for a message (the stored bell text and the emails). */
export const englishOf = (m: Msg): string => renderFull(trFor("en"), m, enDay);
export const englishTitle = (w: Wording): string => renderWordingTitle(trFor("en"), w, enDay);
export const englishBody = (w: Wording): string => renderWordingBody(trFor("en"), w, enDay);

/** The same wording in another language (used by tests; the browser does this itself from the stored key + data). */
export const titleIn = (w: Wording, lang: LocaleCode, fmt: (iso: string) => string = enDay): string => renderWordingTitle(trFor(lang), w, fmt);
export const bodyIn = (w: Wording, lang: LocaleCode, fmt: (iso: string) => string = enDay): string => renderWordingBody(trFor(lang), w, fmt);

export interface BellText {
  title: string;
  body: string;
  i18n: { tk: string; tv: Record<string, string>; bk: string; bv: Record<string, string>; more?: { k: string; v: Record<string, string> }[] };
}
/** The fields a bell stores: English title + body, and the key + data for every language. */
export function bellText(w: Wording): BellText {
  return {
    title: englishTitle(w),
    body: englishBody(w),
    i18n: { tk: w.title.key, tv: w.title.vars, bk: w.body.key, bv: w.body.vars, ...(w.more.length ? { more: w.more.map((x) => ({ k: x.key, v: x.vars })) } : {}) },
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
/** The provider's email for a NEW request: the same plain sentence as the bell, then what it covers. Money appears for a cancel only. */
export function requestEmail(
  r: AddonRequest,
  b: { ref: string; listing?: string },
  w: Wording,
  showMoney: boolean,
): { subject: string; html: string } {
  const ts: AddonRequestTarget[] = r.targets?.length ? r.targets : [{ key: r.key, child: r.child, label: r.label, price: r.price }];
  const list = r.kind === "cancel" && (ts.length > 1 || ts[0].days?.length)
    ? `<ul>${ts.map((t) => `<li>${esc(t.name ?? t.label)} · ${esc(t.child)}${t.days?.length ? ` · ${t.days.map(enDay).join(", ")}` : ""}${showMoney ? ` · £${t.price.toFixed(2)}` : ""}</li>`).join("")}</ul>` : "";
  return {
    subject: `${englishTitle(w)} (${b.ref})`,
    html: `<p>${esc(englishBody(w))}</p>${list}<p>${esc(b.listing ?? "")} · booking ${esc(b.ref)}${r.note ? ` · note: ${esc(r.note)}` : ""}</p><p>Nothing changes until you approve or decline it. It is separate from cancelling the booking.</p>`,
  };
}
