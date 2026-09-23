"use client";

import { useRef, useState } from "react";
import { FOCUS } from "../../kit";
import { ACCENTS, applyShortcut } from "../engine/textmark";
import type { ToolProps } from "../types";

// Accent & symbol bar (plan L-01): tap a letter to type it — works on iPad and Chromebook with no keyboard switching. Also converts typing shortcuts
// as you go (e' → é, n~ → ñ, a: → ä, ss! → ß) and never gets in the way of a normal keyboard.

export type Lang = "es" | "fr" | "de";
export const LANG_LABEL: Record<Lang, string> = { es: "Spanish", fr: "French", de: "German" };

/** The button row. `onInsert` receives the character; use it with any text field. */
export function AccentBar({ lang, onInsert, size = "md" }: { lang: Lang; onInsert: (ch: string) => void; size?: "md" | "sm" }) {
  return (
    <div role="group" aria-label={`${LANG_LABEL[lang]} letters`} className="flex flex-wrap gap-1.5">
      {ACCENTS[lang].map((ch) => (
        <button key={ch} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onInsert(ch)} aria-label={`Type ${ch}`}
          className={`grid place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] font-extrabold text-[var(--ink)] shadow-[var(--shadow-sm)] active:scale-95 motion-reduce:active:scale-100 ${FOCUS} ${size === "md" ? "h-11 min-w-[44px] px-2 text-[18px]" : "h-9 min-w-[36px] px-1.5 text-[15px]"}`}>{ch}</button>
      ))}
    </div>
  );
}

/** A text field with the accent bar and shortcuts built in — the input to use wherever a pupil types in a language. */
export function TextAnswer({ lang, value, onChange, placeholder, multiline = false, shortcuts = true, ariaLabel, id }: { lang: Lang; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; shortcuts?: boolean; ariaLabel?: string; id?: string }) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const insert = (ch: string) => {
    const el = ref.current; if (!el) { onChange(value + ch); return; }
    const a = el.selectionStart ?? value.length, b = el.selectionEnd ?? value.length, next = value.slice(0, a) + ch + value.slice(b);
    onChange(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + ch.length, a + ch.length); });
  };
  const change = (v: string) => { const conv = shortcuts && v.length > value.length ? applyShortcut(v) : null; onChange(conv ?? v); };
  const shared = { ref, id, value, placeholder, "aria-label": ariaLabel ?? "Your answer", lang, spellCheck: false, autoComplete: "off", autoCorrect: "off", autoCapitalize: "off", onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => change(e.target.value), className: `w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-[17px] font-semibold text-[var(--ink)] ${FOCUS}` } as const;
  return (
    <div className="grid gap-2">
      {multiline ? <textarea {...shared} rows={4} /> : <input {...shared} type="text" style={{ minHeight: 48 }} />}
      <AccentBar lang={lang} onInsert={insert} />
    </div>
  );
}

/** The standalone tool (plan L-01): pick a language, type freely, copy the result. */
export default function AccentTool(_: Partial<ToolProps>) {
  const [lang, setLang] = useState<Lang>("fr");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-3" data-testid="accent-tool">
      <div className="flex gap-1.5" role="tablist" aria-label="Language">
        {(Object.keys(LANG_LABEL) as Lang[]).map((l) => <button key={l} type="button" role="tab" aria-selected={lang === l} onClick={() => setLang(l)} className={`min-h-[40px] rounded-full border px-4 text-[13.5px] font-extrabold ${FOCUS} ${lang === l ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>{LANG_LABEL[l]}</button>)}
      </div>
      <TextAnswer lang={lang} value={text} onChange={(v) => { setText(v); setCopied(false); }} multiline placeholder={lang === "fr" ? "Écris ici…" : lang === "es" ? "Escribe aquí…" : "Schreib hier…"} ariaLabel="Type here" />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => { navigator.clipboard?.writeText(text).then(() => setCopied(true)).catch(() => {}); }} disabled={!text} className={`min-h-[40px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-[13px] font-extrabold text-[var(--ink)] disabled:opacity-40 ${FOCUS}`}>{copied ? "Copied ✓" : "Copy"}</button>
        <button type="button" onClick={() => setText("")} disabled={!text} className={`min-h-[40px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-[13px] font-extrabold text-[var(--ink)] disabled:opacity-40 ${FOCUS}`}>Clear</button>
      </div>
      <p className="m-0 text-[12px] font-semibold text-[var(--ink-3)]">Shortcuts: e&apos; → é · a` → à · a^ → â · c, → ç · n~ → ñ · a: → ä · ss! → ß. Tap any letter above instead if you prefer.</p>
    </div>
  );
}
