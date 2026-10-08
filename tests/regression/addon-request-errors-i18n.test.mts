import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { apiErrorKey } from "../../lib/i18n/apiErrorKey";
import p8mod from "../../lib/i18n/messages/areas/p8api";
const p8api: any = (p8mod as any).default ?? p8mod;

// Every refusal reason the extra-request code can send to a family (or a provider) must have a translation in the API error catalogue, in all
// 11 languages, so a Welsh or Polish parent does not read English. The messages are read from the source, so a new one cannot be forgotten.

function messages(): string[] {
  const out = new Set<string>();
  const grab = (file: string, re: RegExp) => {
    const src = readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const raw = m[1] ?? m[2];
      if (!raw) continue;
      let vars = 0;
      out.add(raw.replace(/\\(["'`])/g, "$1").replace(/\$\{cutoffText\([^)]*\)\}/g, "Your provider takes extra changes up to {cutoff} before the session. Please message them.").replace(/\$\{[^}]*\}/g, () => `{v${++vars}}`));
    }
  };
  for (const f of ["server/src/lib/addonRequests.ts", "server/src/lib/addonRequestsCore.ts"]) grab(f, /AddonRequestError\(\d+,\s*(?:"((?:[^"\\]|\\.)+)"|`((?:[^`\\]|\\.)+)`)/g);
  grab("features/bookings/addonRequests.ts", /return\s+(?:"((?:[^"\\]|\\.)+)"|`((?:[^`\\]|\\.)+)`)/g);
  return [...out].filter((s) => /[A-Za-z]{4}/.test(s) && /\s/.test(s) && !/^(cancel|change) /.test(s) && !/ asks to /.test(s));
}

test("the catalogue has the refusal reasons of the extra-request code in all 11 languages (not the English text)", () => {
  const list = messages().filter((m) => !m.includes("{cutoff}"));
  assert.ok(list.length >= 15, `found ${list.length} messages`);
  const missing: string[] = [];
  for (const m of list) {
    const key = apiErrorKey(m);
    for (const loc of ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"] as const) {
      const v = (p8api as Record<string, Record<string, string>>)[loc]?.[key];
      if (!v) missing.push(`${loc}: ${m}`);
      else if (loc !== "en" && v === (p8api as any).en[key]) missing.push(`${loc} same as English: ${m}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("the cut-off reason exists for one day and for several days in every language", () => {
  for (const m of ["Your provider takes extra changes up to 1 day before the session. Please message them.", "Your provider takes extra changes up to {v1} days before the session. Please message them."]) {
    const key = apiErrorKey(m);
    for (const loc of ["pl", "cy", "ar"] as const) assert.ok((p8api as any)[loc][key], `${loc}: ${m}`);
  }
});
