"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { FOCUS } from "../shared-assess/ui";

// The year groups a tenant aims quizzes / placement tests at ("Year 5", "Grade 3"…).
// Chips you can add to and remove; the list order is the order of the scale, which is
// what lets "Year 5, Year 6" read as "Year 5–6". Used by Setup → Learning Hub.

export const MAX_YEAR_GROUPS = 30;
export const MAX_YEAR_LEN = 24;

export function YearGroupsEditor({ groups, onChange, defaults }: { groups: string[]; onChange: (g: string[]) => void; defaults?: string[] }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const add = () => {
    const v = text.trim().replace(/\s+/g, " ");
    if (!v) return;
    if (v.length > MAX_YEAR_LEN) return setErr(`Keep it to ${MAX_YEAR_LEN} characters.`);
    if (groups.some((g) => g.toLowerCase() === v.toLowerCase())) return setErr("That one is already in the list.");
    if (groups.length >= MAX_YEAR_GROUPS) return setErr(`You can have up to ${MAX_YEAR_GROUPS} year groups.`);
    setErr(null); setText(""); onChange([...groups, v]);
  };
  return (
    <div data-testid="hub-yeargroups-editor">
      <div className="flex flex-wrap gap-1.5" role="list" aria-label="Year groups">
        {groups.map((g) => (
          <span role="listitem" key={g} className="inline-flex items-center gap-0.5 rounded-full bg-[var(--brand-soft)] py-0.5 pl-3 pr-0.5 text-[12.5px] font-bold text-[var(--brand-strong)]">
            {g}
            <button type="button" disabled={groups.length <= 1} aria-label={`Remove ${g}`} onClick={() => onChange(groups.filter((x) => x !== g))} className={`grid h-9 w-9 place-items-center rounded-full text-[15px] hover:bg-white/70 disabled:opacity-30 ${FOCUS}`}>×</button>
          </span>
        ))}
      </div>
      <div className="mt-2.5 flex gap-2">
        <Input value={text} maxLength={MAX_YEAR_LEN + 6} onChange={(e) => { setText(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="e.g. Year 5 or Grade 3" aria-label="New year group" className="min-h-[44px] min-w-0 flex-1" />
        <Button variant="ghost" className="min-h-[44px]" onClick={add} disabled={!text.trim()}>Add</Button>
      </div>
      {err && <p role="alert" className="m-0 mt-1.5 text-[12px] font-semibold" style={{ color: "var(--red)" }}>{err}</p>}
      <p className="m-0 mt-1.5 text-[11.5px] text-[var(--ink-3)]">{groups.length} of {MAX_YEAR_GROUPS}. Keep them in age order so ranges like &ldquo;Year 5–6&rdquo; read correctly.{defaults ? <> <button type="button" onClick={() => onChange(defaults)} className={`rounded px-1 font-bold text-[var(--brand)] hover:underline ${FOCUS}`}>Restore the defaults</button></> : null}</p>
    </div>
  );
}
