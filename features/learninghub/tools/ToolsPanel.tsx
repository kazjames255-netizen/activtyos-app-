"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui";
import { FOCUS, Icon } from "../kit";
import type { PanelMeta, PanelProps } from "../panelTypes";
import { logToolEvent } from "./api";
import { REGISTRY } from "./registry";
import { ToolHost } from "./ToolHost";
import { HUE, emojiFor } from "../lesson/ToolPicker";
import { useI18n } from "@/lib/i18n/provider";
import { rich, subjectLabel, toolName } from "./toolTextB";
import { SUBJECT_ORDER, type KeyStage, type ToolMeta, type ToolSubject } from "./types";

// The Tools tab: every learning tool, by subject and key stage. Only working tools are listed; unreleased ones are hidden outright
// no longer shown: only ready tools are listed (P-08).

export const meta: PanelMeta = { key: "tools", label: "Tools", icon: "🧰", status: "live", blurb: "Rulers, protractors, number lines, science diagrams and more — pick a subject." };

const KS_LABEL: Record<KeyStage, string> = { 1: "KS1", 2: "KS2", 3: "KS3", 4: "KS4", 5: "KS5" };
const READY = REGISTRY.filter((t) => t.status === "live"); // unreleased tools are hidden, not greyed out

/** [1,2,3,4,5] → "All ages"; [2,3,4] → "KS2–KS4"; [3,5] → "KS3 · KS5". */
function ksText(ks: KeyStage[], allAges: string): string {
  const s = [...ks].sort();
  if (s.length === 5) return allAges;
  const run = s.every((k, i) => i === 0 || k === s[i - 1]! + 1);
  return s.length > 2 && run ? `${KS_LABEL[s[0]!]}–${KS_LABEL[s[s.length - 1]!]}` : s.map((k) => KS_LABEL[k]).join(" · ");
}

const azGroups = (tools: ToolMeta[], name: (t: ToolMeta) => string, locale: string): [string, ToolMeta[]][] => {
  const m = new Map<string, ToolMeta[]>();
  for (const t of tools.slice().sort((a, b) => name(a).localeCompare(name(b), locale))) { const l = (name(t).trim()[0] ?? "#").toLocaleUpperCase(locale); (m.get(l) ?? m.set(l, []).get(l)!).push(t); }
  return [...m.entries()];
};

function Card({ t, name, onOpen }: { t: ToolMeta; name: string; onOpen: (t: ToolMeta) => void }) {
  const { t: tr } = useI18n();
  const h = HUE[t.subject];
  return (
    <li>
      <button type="button" onClick={() => onOpen(t)} data-status={t.status} data-testid={`tool-${t.id}`}
        style={{ background: `hsl(${h} 90% 96%)`, borderColor: `hsl(${h} 60% 84%)` }}
        className={`flex h-full w-full items-center gap-3 rounded-2xl border p-3 text-start transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none ${FOCUS}`}>
        <span aria-hidden className="grid h-12 w-12 flex-none place-items-center rounded-xl text-[26px]" style={{ background: `hsl(${h} 85% 90%)` }}>{emojiFor(t)}</span>
        <span className="min-w-0">
          <span className="block text-[14.5px] font-extrabold leading-snug text-[var(--ink)]">{name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] font-bold" style={{ color: `hsl(${h} 45% 34%)` }}>
            <span>{subjectLabel(tr, t.subject)}</span><span aria-hidden>·</span><span>{ksText(t.keyStages, tr("hubtoolsb.tp_allAges"))}</span>
          </span>
        </span>
      </button>
    </li>
  );
}

export function Panel({ qs, childQs, goTo, mode }: PanelProps) {
  const { t: tr, locale } = useI18n();
  const nm = (x: ToolMeta) => toolName(tr, x);
  const q0 = childQs ?? qs;
  const [subject, setSubject] = useState<ToolSubject | "all">("all");
  const [ks, setKs] = useState<KeyStage | null>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState<ToolMeta | null>(null);

  const counts = useMemo(() => Object.fromEntries(SUBJECT_ORDER.map((s) => [s, READY.filter((t) => t.subject === s).length])) as Record<ToolSubject, number>, []);
  const shown = useMemo(() => {
    const w = text.trim().toLowerCase();
    return READY.filter((t) => (subject === "all" || t.subject === subject) && (!ks || t.keyStages.includes(ks)) && (!w || `${nm(t)} ${t.title} ${t.tags.join(" ")}`.toLowerCase().includes(w)))
      .sort((a, b) => Number(b.status === "live") - Number(a.status === "live") || nm(a).localeCompare(nm(b), locale));
  }, [subject, ks, text, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  const onOpen = (t: ToolMeta) => { logToolEvent(q0, t.id, "open"); setOpen(t); };
  const chip = (on: boolean) => `min-h-[40px] rounded-full border px-3.5 text-[13px] font-extrabold ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`;

  return (
    <div id="hub-tools">
      <div role="note" data-testid="tools-viewing-note" className="mb-4 flex items-start gap-3 rounded-2xl border-2 border-[var(--brand)] bg-[var(--brand-soft)] px-4 py-3">
        <span aria-hidden className="text-[22px] leading-none">👀</span>
        <p className="m-0 text-[14px] font-semibold leading-snug text-[var(--ink)]">
          {rich(tr("hubtoolsb.tp_note"))}
          {goTo && mode === "tutor" && <button type="button" data-testid="tools-go-lessons" onClick={() => goTo("notes")} className={`ms-2 inline-flex min-h-[40px] items-center rounded-full bg-[var(--brand)] px-3.5 text-[13px] font-extrabold text-white ${FOCUS}`}>{tr("hubtoolsb.tp_goLessons")} →</button>}
        </p>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1 sm:max-w-[340px]">
          <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--ink-2)]" />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={tr("hubtoolsb.tp_searchPh")} aria-label={tr("hubtoolsb.tp_searchAria")} className={`!min-h-[44px] w-full !rounded-full !ps-9 ${FOCUS}`} />
        </div>
        <span className="text-[12.5px] font-semibold text-[var(--ink-2)]" aria-live="polite">{tr("hubtoolsb.tp_count", { n: shown.length })}</span>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label={tr("hubtoolsb.tp_subject")}>
        <button type="button" aria-pressed={subject === "all"} onClick={() => setSubject("all")} className={chip(subject === "all")}>{tr("hubtoolsb.tp_all")}</button>
        {SUBJECT_ORDER.map((s) => <button key={s} type="button" aria-pressed={subject === s} onClick={() => setSubject(s)} className={chip(subject === s)}>{subjectLabel(tr, s)} <span className="opacity-70">· {counts[s]}</span></button>)}
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label={tr("hubtoolsb.tp_keyStage")}>
        {([1, 2, 3, 4, 5] as KeyStage[]).map((k) => <button key={k} type="button" aria-pressed={ks === k} onClick={() => setKs(ks === k ? null : k)} className={chip(ks === k)}>{KS_LABEL[k]}</button>)}
      </div>
      {shown.length === 0 ? <p className="m-0 rounded-2xl border border-dashed border-[var(--line)] p-6 text-center text-[14px] font-semibold text-[var(--ink-2)]">{tr("hubtoolsb.tp_none")}</p>
        : <div>{azGroups(shown, nm, locale).map(([letter, tools]) => (
            <section key={letter} className="mb-4" aria-label={tr("hubtoolsb.tp_azAria", { letter })}>
              <div className="mb-2 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--brand)] text-[13px] font-extrabold text-white">{letter}</span><span className="h-px flex-1 bg-[var(--line)]" /></div>
              <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 xl:grid-cols-3">{tools.map((t) => <Card key={t.id} t={t} name={nm(t)} onOpen={onOpen} />)}</ul>
            </section>))}</div>}
      {open && <ToolHost tool={open} qs={q0} onClose={() => setOpen(null)} note={tr("hubtoolsb.tp_hostNote")} />}
    </div>
  );
}
