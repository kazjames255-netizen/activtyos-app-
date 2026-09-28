"use client";
// Localisation of the How it works explainers. The English scripts (./scripts/*) stay the source of truth (byte-identical); a locale is an
// OVERLAY (./<locale>.json: {ui, scripts, scenes}) generated from ./template.json by scripts/how-i18n-template.cjs and checked with `--check`.
// An overlay is applied per scene and only when it is internally consistent (every cue / key phrase found in the translated narration),
// otherwise that scene quietly stays English: a broken translation can never break the film's timing.
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { LocaleCode } from "@/lib/i18n/config";
import { keyParts, posIn, type HowScript, type Scene } from "../types";
import { EN_UI } from "./ui";

interface Overlay { ui?: Record<string, string>; scripts?: Record<string, Partial<HowScript>>; scenes?: Record<string, Record<string, unknown>> }
const cache: Partial<Record<LocaleCode, Overlay | null>> = {};
const pending: Partial<Record<LocaleCode, Promise<Overlay | null>>> = {};

const LOADERS: Record<Exclude<LocaleCode, "en">, () => Promise<{ default: Overlay }>> = {
  pl: () => import("./pl.json"), ro: () => import("./ro.json"), ur: () => import("./ur.json"), pa: () => import("./pa.json"), bn: () => import("./bn.json"),
  ar: () => import("./ar.json"), pt: () => import("./pt.json"), es: () => import("./es.json"), fr: () => import("./fr.json"), cy: () => import("./cy.json"),
};
function load(locale: LocaleCode): Promise<Overlay | null> {
  if (locale === "en") return Promise.resolve(null);
  return (pending[locale] ??= LOADERS[locale]().then((m) => (cache[locale] = m.default as Overlay)).catch(() => (cache[locale] = null)));
}

/** BCP-47 tag handed to speechSynthesis for each locale. */
export const SPEECH_LANG: Record<LocaleCode, string> = { en: "en-GB", pl: "pl-PL", ro: "ro-RO", ur: "ur-PK", pa: "pa-IN", bn: "bn-BD", ar: "ar-SA", pt: "pt-PT", es: "es-ES", fr: "fr-FR", cy: "cy-GB" };

const isStr = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
/** The translated scene, or null when it is not consistent with the English cues. */
function sceneOverlay(s: Scene, o: Record<string, unknown> | undefined): Scene | null {
  if (!o || !isStr(o.say) || !isStr(o.title) || !isStr(o.chapter)) return null;
  const say = o.say;
  const arr = (k: string) => (Array.isArray(o[k]) ? (o[k] as Record<string, unknown>[]) : undefined);
  const out: Scene = { ...s, say, title: o.title, chapter: o.chapter };
  const keys = Array.isArray(o.keys) ? (o.keys as unknown[]) : null;
  if (keys?.length !== s.keys.length || keys.some((k) => !isStr(k) || posIn(say, keyParts(k)[1]) < 0)) return null;
  out.keys = keys as string[];
  const cues = ["shots", "cam", "rings", "cursor", "callouts", "nodes"] as const;
  for (const g of cues) {
    const en = s[g] as (Record<string, unknown> & { on: string; off?: string })[] | undefined; if (!en) continue;
    const tr = arr(g); if (!tr || tr.length !== en.length) return null;
    const merged = en.map((c, n) => {
      const t = tr[n]; const r: Record<string, unknown> = { ...c };
      for (const f of ["on", "off"] as const) if (c[f] !== undefined) { if (c[f] === "") r[f] = ""; else if (isStr(t[f]) && posIn(say, t[f] as string) >= 0) r[f] = t[f]; else return null; }
      for (const f of ["text", "title", "sub"]) if (c[f] !== undefined) r[f] = isStr(t[f]) ? t[f] : c[f];
      return r;
    });
    if (merged.some((m) => m === null)) return null;
    (out as unknown as Record<string, unknown>)[g] = merged;
  }
  if (s.links) { const tr = arr("links"); if (tr?.length === s.links.length) out.links = s.links.map((l, n) => ({ ...l, label: isStr(tr[n].label) ? (tr[n].label as string) : l.label })); }
  return out;
}

const scriptKey = (s: HowScript) => `${s.role}:${s.band ?? "std"}:${s.topic ?? "main"}`;
const sceneKey = (s: HowScript, id: string) => `${s.role}:${s.band ?? "std"}:${id}`;
const memo = new WeakMap<HowScript, Map<LocaleCode, HowScript>>();
export function localizeScript(script: HowScript, locale: LocaleCode, ov: Overlay | null): HowScript {
  if (locale === "en" || !ov) return script;
  let m = memo.get(script); if (!m) memo.set(script, (m = new Map()));
  const hit = m.get(locale); if (hit && (hit as unknown as { __ov?: Overlay }).__ov === ov) return hit;
  const o = ov.scripts?.[scriptKey(script)] ?? {};
  const out: HowScript = { ...script, scenes: script.scenes.map((sc) => sceneOverlay(sc, ov.scenes?.[sceneKey(script, sc.id)]) ?? sc) };
  for (const f of ["title", "tagline", "audience", "viewLabel", "blurb"] as const) if (isStr(o[f]) && script[f] !== undefined) out[f] = o[f] as string;
  Object.defineProperty(out, "__ov", { value: ov, enumerable: false });
  m.set(locale, out);
  return out;
}

export interface HowText {
  locale: LocaleCode; lang: string; dir: "ltr" | "rtl"; ready: boolean;
  ui: (key: keyof typeof EN_UI | string, vars?: Record<string, string | number>) => string;
  script: (s: HowScript) => HowScript;
}
/** Everything a How it works component needs to speak the viewer's language. English is instant; other locales load their overlay lazily (English until it arrives). */
export function useHowText(): HowText {
  const { locale } = useI18n();
  const [ov, setOv] = useState<Overlay | null>(cache[locale] ?? null);
  useEffect(() => {
    let live = true; setOv(cache[locale] ?? null); // eslint-disable-line react-hooks/set-state-in-effect -- switching locale swaps the overlay
    if (locale !== "en") void load(locale).then((o) => { if (live) setOv(o); });
    return () => { live = false; };
  }, [locale]);
  return useMemo<HowText>(() => {
    const table = (locale === "en" ? null : ov?.ui) ?? null;
    return {
      locale, lang: locale, dir: locale === "ar" || locale === "ur" ? "rtl" : "ltr", ready: locale === "en" || !!ov,
      ui: (key, vars) => (table?.[key] || EN_UI[key] || key).replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? String(vars[k]) : m)),
      script: (s) => localizeScript(s, locale, ov),
    };
  }, [locale, ov]);
}
