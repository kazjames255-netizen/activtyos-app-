// Server-side page titles for the public "How it works" routes, in the visitor's language. The explainers' own translations live in
// features/learninghub/howitworks/i18n/<locale>.json ({ ui, scripts }); this reads just the script titles + the hub name from them.
import type { LocaleCode } from "@/lib/i18n/config";
import type { HowScript } from "@/features/learninghub/howitworks/types";

interface Overlay { ui?: Record<string, string>; scripts?: Record<string, { title?: string }> }
const LOADERS: Record<Exclude<LocaleCode, "en">, () => Promise<{ default: unknown }>> = {
  pl: () => import("@/features/learninghub/howitworks/i18n/pl.json"), ro: () => import("@/features/learninghub/howitworks/i18n/ro.json"),
  ur: () => import("@/features/learninghub/howitworks/i18n/ur.json"), pa: () => import("@/features/learninghub/howitworks/i18n/pa.json"),
  bn: () => import("@/features/learninghub/howitworks/i18n/bn.json"), ar: () => import("@/features/learninghub/howitworks/i18n/ar.json"),
  pt: () => import("@/features/learninghub/howitworks/i18n/pt.json"), es: () => import("@/features/learninghub/howitworks/i18n/es.json"),
  fr: () => import("@/features/learninghub/howitworks/i18n/fr.json"), cy: () => import("@/features/learninghub/howitworks/i18n/cy.json"),
};

async function overlay(locale: LocaleCode): Promise<Overlay | null> {
  if (locale === "en") return null;
  try { return (await LOADERS[locale]()).default as Overlay; } catch { return null; }
}

/** "<video title> — <Teaching Hub>" in the visitor's language (falls back to the English title per part). */
export async function howTitle(locale: LocaleCode, script: HowScript | undefined): Promise<string> {
  const ov = await overlay(locale);
  const hub = ov?.ui?.hubTeaching ?? "Teaching Hub";
  if (!script) return ov?.ui?.sheetTitle ?? "How it works";
  const key = `${script.role}:${script.band ?? "std"}:${script.topic ?? "main"}`;
  return `${ov?.scripts?.[key]?.title ?? script.title} — ${hub}`;
}
