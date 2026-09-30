// The default roadmap (features/milestones/data.ts seedTemplate) is stored English
// content that head office can edit. While a title/detail still equals the shipped
// default we show its translation; edited text is shown as typed.
import { tNow } from "@/lib/i18n/provider";

export const ml = (text?: string): string => {
  if (!text) return text ?? "";
  const k = "p8wf.mst_" + text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  const r = tNow(k);
  return r !== k ? r : text;
};
