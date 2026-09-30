// Shows the API's English error messages in the active language. The server's responses are unchanged: lib/api.ts passes the message it
// received through translateApiMessage() before the UI renders err.message (the original stays on ApiError.rawMessage).
// Catalogue: area "p8api", keyed by apiErrorKey(english message). Template messages ("Please wait {v1}s before requesting another code.")
// are matched with a regex built from the English template, and the captured parts are re-inserted into the translated template.
import { CATALOGS } from "./messages";
import { currentLocaleCode } from "./format";
import { apiErrorKey } from "./apiErrorKey";
import { BRAND } from "./config";

type Dict = Record<string, string>;
let templates: { re: RegExp; key: string }[] | null = null;
function loadTemplates() {
  if (templates) return templates;
  const en = ((CATALOGS.en as unknown as Record<string, Dict>).p8api ?? {}) as Dict;
  templates = Object.entries(en).filter(([, v]) => /\{v\d+\}/.test(v)).map(([key, v]) => ({
    key,
    re: new RegExp("^" + v.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{v\d+\}/g, "(.+?)") + "$", "s"),
  }));
  return templates;
}

export function translateApiMessage(message: string): string {
  if (!message) return message;
  const loc = currentLocaleCode();
  if (loc === "en") return message.split("{brand}").join(BRAND);
  const cat = (CATALOGS[loc] as unknown as Record<string, Dict>).p8api ?? {};
  const direct = cat[apiErrorKey(message)];
  if (direct && !/\{v\d+\}/.test(direct)) return direct.split("{brand}").join(BRAND);
  for (const { re, key } of loadTemplates()) {
    const m = re.exec(message);
    const tpl = m && cat[key];
    if (m && tpl) return tpl.replace(/\{v(\d+)\}/g, (_, n) => m[Number(n)] ?? "").split("{brand}").join(BRAND);
  }
  return message;
}
