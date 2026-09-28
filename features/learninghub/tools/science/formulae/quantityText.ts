// Re-words the (English) feedback of engine/quantity's checkQuantity in the pupil's language, from its structured log — display only.
import type { CheckResult } from "../../engine/marking";
import type { Tr } from "../tr";

interface Part { label: string; ok: boolean; note?: string }

export function translateQuantityFeedback(r: CheckResult, t: Tr): string[] {
  const parts = (r.log as { parts?: Part[] } | undefined)?.parts;
  if (!parts) return r.feedback;
  return parts.map((p) => {
    let label = p.label, note = p.note;
    let m: RegExpExecArray | null;
    if (p.label === "Give a number") label = t("hubtoolsb.sc_fc_q_num");
    else if (p.label === "Correct value") { label = t("hubtoolsb.sc_fc_q_value"); if ((m = /^you gave (.+)$/.exec(p.note ?? ""))) note = t("hubtoolsb.sc_fc_q_gave", { v: m[1]! }); }
    else if ((m = /^Unit (.+)$/.exec(p.label))) {
      label = t("hubtoolsb.sc_fc_q_unit", { u: m[1]! });
      if (p.note === "no unit") note = t("hubtoolsb.sc_fc_q_noUnit");
      else if ((m = /^you wrote “(.+)”$/.exec(p.note ?? ""))) note = t("hubtoolsb.sc_fc_q_wrote", { u: m[1]! });
    } else if ((m = /^(\d+) significant figures$/.exec(p.label))) {
      label = t("hubtoolsb.sc_fc_q_sf", { n: m[1]! });
      if ((m = /^you gave (.+)$/.exec(p.note ?? ""))) note = t("hubtoolsb.sc_fc_q_gave", { v: m[1]! });
    }
    return `${p.ok ? "✓" : "✗"} ${label}${note ? ` — ${note}` : ""}`;
  });
}
