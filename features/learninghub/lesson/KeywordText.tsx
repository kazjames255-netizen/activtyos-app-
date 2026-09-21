"use client";

import { useMemo, useState } from "react";
import type { LessonKeyword } from "./types";
import { FOCUS } from "../kit";

// A key learning point with its key words highlighted. Tap a highlighted word to see what it means — the definition opens
// in a note under the text (not a floating popover: it never runs off a 360px screen and a screen reader reads it in place).

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Split `text` into plain runs and the first occurrence of each keyword (longest keywords first, so "cell membrane" beats "cell"). */
export function splitKeywords(text: string, keywords: LessonKeyword[]): { text: string; kw?: LessonKeyword }[] {
  const parts: { text: string; kw?: LessonKeyword }[] = [{ text }];
  for (const k of [...keywords].sort((a, b) => b.keyword.length - a.keyword.length)) {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRe(k.keyword)})(?![\\p{L}\\p{N}])`, "iu");
    if (parts.some((p) => p.kw === k)) continue;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.kw) continue;
      const m = re.exec(p.text);
      if (!m) continue;
      const start = m.index + m[1].length, end = start + m[2].length;
      parts.splice(i, 1, ...[
        { text: p.text.slice(0, start) }, { text: p.text.slice(start, end), kw: k }, { text: p.text.slice(end) },
      ].filter((x) => x.text));
      break;
    }
  }
  return parts;
}

export function KeywordText({ text, keywords, className = "" }: { text: string; keywords: LessonKeyword[]; className?: string }) {
  const parts = useMemo(() => splitKeywords(text, keywords), [text, keywords]);
  const [open, setOpen] = useState<LessonKeyword | null>(null);
  const has = parts.some((p) => p.kw);
  return (
    <div>
      <p className={className}>
        {parts.map((p, i) => p.kw ? (
          <button key={i} type="button" aria-expanded={open === p.kw} onClick={() => setOpen(open === p.kw ? null : p.kw!)}
            className={`ls-kw cursor-help rounded-sm px-px font-extrabold text-[var(--ink)] ${FOCUS}`}>{p.text}</button>
        ) : <span key={i}>{p.text}</span>)}
      </p>
      {has && !open && <p className="mt-3 text-[13px] text-[var(--ink-3)]">Tap a <span className="ls-kw font-extrabold text-[var(--ink)]">highlighted word</span> to see what it means.</p>}
      {open && (
        <div role="status" className="mt-3 rounded-xl border border-l-4 border-[var(--line)] border-l-[var(--gold)] bg-[var(--panel)] px-4 py-3 text-[14px] leading-snug text-[var(--ink)]">
          <b>{open.keyword}</b>{open.description ? <> — {open.description}</> : null}
        </div>
      )}
    </div>
  );
}
