"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { FOCUS } from "../shared-assess/ui";
import { useHubI18n } from "../family/hubT";

// The year groups a tenant aims quizzes / placement tests at ("Year 5", "Grade 3"…).
// Chips you can add to and remove; the list order is the order of the scale, which is
// what lets "Year 5, Year 6" read as "Year 5–6". Used by Setup → Learning Hub.

export const MAX_YEAR_GROUPS = 30;
export const MAX_YEAR_LEN = 24;

export function YearGroupsEditor({ groups, onChange, defaults }: { groups: string[]; onChange: (g: string[]) => void; defaults?: string[] }) {
  const { t } = useHubI18n();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const add = () => {
    const v = text.trim().replace(/\s+/g, " ");
    if (!v) return;
    if (v.length > MAX_YEAR_LEN) return setErr(t("hubfam.qzYgMaxLen", { n: MAX_YEAR_LEN }));
    if (groups.some((g) => g.toLowerCase() === v.toLowerCase())) return setErr(t("hubfam.qzYgDup"));
    if (groups.length >= MAX_YEAR_GROUPS) return setErr(t("hubfam.qzYgMaxCount", { n: MAX_YEAR_GROUPS }));
    setErr(null); setText(""); onChange([...groups, v]);
  };
  return (
    <div data-testid="hub-yeargroups-editor">
      <div className="flex flex-wrap gap-1.5" role="list" aria-label={t("hubfam.qzYgList")}>
        {groups.map((g) => (
          <span role="listitem" key={g} className="inline-flex items-center gap-0.5 rounded-full bg-[var(--brand-soft)] py-0.5 ps-3 pe-0.5 text-[12.5px] font-bold text-[var(--brand-strong)]">
            {g}
            <button type="button" disabled={groups.length <= 1} aria-label={t("hubfam.qzRemoveX", { name: g })} onClick={() => onChange(groups.filter((x) => x !== g))} className={`grid h-9 w-9 place-items-center rounded-full text-[15px] hover:bg-white/70 disabled:opacity-30 ${FOCUS}`}>×</button>
          </span>
        ))}
      </div>
      <div className="mt-2.5 flex gap-2">
        <Input value={text} maxLength={MAX_YEAR_LEN + 6} onChange={(e) => { setText(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={t("hubfam.qzYgPlaceholder")} aria-label={t("hubfam.qzYgNew")} className="min-h-[44px] min-w-0 flex-1" />
        <Button variant="ghost" className="min-h-[44px]" onClick={add} disabled={!text.trim()}>{t("hubfam.qzAdd")}</Button>
      </div>
      {err && <p role="alert" className="m-0 mt-1.5 text-[12px] font-semibold" style={{ color: "var(--red)" }}>{err}</p>}
      <p className="m-0 mt-1.5 text-[11.5px] text-[var(--ink-3)]">{t("hubfam.qzYgCount", { n: groups.length, max: MAX_YEAR_GROUPS })}{defaults ? <> <button type="button" onClick={() => onChange(defaults)} className={`rounded px-1 font-bold text-[var(--brand)] hover:underline ${FOCUS}`}>{t("hubfam.qzRestoreDefaults")}</button></> : null}</p>
    </div>
  );
}
