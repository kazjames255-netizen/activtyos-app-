"use client";

import { useEffect, useState, type ReactNode } from "react";
import { FOCUS } from "../../../kit";
import { LIGHT_SCOPE } from "../../lightScope";
import { newSeed } from "../../engine/rng";
import type { Lang } from "../AccentBar";
import type { CSSProperties } from "react";
import type { TextPolicy } from "../../engine/textmark";

export const LANG_NAME: Record<Lang, string> = { es: "Spanish", fr: "French", de: "German" };
export const LANGS: Lang[] = ["es", "fr", "de"];
export const isLang = (x: unknown): x is Lang => x === "es" || x === "fr" || x === "de";
export const pillCls = (active: boolean) => `min-h-[44px] rounded-full border px-4 text-[14px] font-extrabold ${FOCUS} ${active ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`;
export const actionCls = (primary = false) => `min-h-[44px] rounded-full border px-5 text-[14px] font-extrabold disabled:opacity-40 ${FOCUS} ${primary ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`;

/** Root wrapper: light paper background, padded, phone-friendly. */
export function Shell({ testId, children }: { testId: string; children: ReactNode }) {
  return <div data-testid={testId} className="grid gap-3 rounded-2xl bg-[var(--bg)] p-3 text-[var(--ink)]" style={LIGHT_SCOPE as CSSProperties}>{children}</div>;
}
/** A row of exclusive choices (aria-pressed buttons, ≥ 44px). */
export function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)} className={pillCls(value === o.id)}>{o.label}</button>)}
    </div>
  );
}
export function LangTabs({ lang, onChange, langs = LANGS }: { lang: Lang; onChange: (l: Lang) => void; langs?: Lang[] }) {
  return <Seg label="Language" value={lang} options={langs.map((l) => ({ id: l, label: LANG_NAME[l] }))} onChange={onChange} />;
}
/** ✓ / ✗ with words as well as colour. */
export function Verdict({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <div role="status" className={`rounded-2xl border-2 p-3 text-[14px] font-semibold ${ok ? "border-[var(--green)] bg-[var(--green-soft)]" : "border-[var(--red)] bg-[var(--red-soft)]"}`}>
      <b className="text-[15px]">{ok ? "✓ Correct" : "✗ Not quite"}</b>
      <div className="mt-1 grid gap-0.5">{children}</div>
    </div>
  );
}
export const Card = ({ children, label }: { children: ReactNode; label?: string }) => <div role="region" aria-label={label} className="grid gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)]">{children}</div>;
export const Tally = ({ right, total }: { right: number; total: number }) => <p className="m-0 text-[13px] font-bold text-[var(--ink-3)]" aria-live="polite">{total === 0 ? "No pressure — no timer, no streak." : `${right} correct out of ${total}`}</p>;
export const ASSESS_SAVED = <div role="status" className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3 text-[14px] font-bold text-[var(--ink-2)]">Answer saved.</div>;

/** A seed that is fixed for the first (server) render and randomised once mounted, so there is no hydration mismatch. */
export function useSeed(): [number, () => void] {
  const [seed, setSeed] = useState(1);
  useEffect(() => { setSeed(newSeed()); }, []);
  return [seed, () => setSeed(newSeed())];
}
/** Accent policy for typed answers: assessments are strict; otherwise the pupil/tutor picks (default: accept the slip but flag it). */
export type AccentSetting = "strict" | "warn";
export const policyFor = (lang: Lang, accents: AccentSetting, assess: boolean): Partial<TextPolicy> => ({ lang, accents: assess ? "strict" : accents, ignorePunctuation: true, matchCase: false });
export const AccentPick = ({ value, onChange }: { value: AccentSetting; onChange: (v: AccentSetting) => void }) => (
  <Seg label="Accents" value={value} onChange={onChange} options={[{ id: "warn", label: "Accent slips: flag" }, { id: "strict", label: "Accents: strict" }]} />
);
