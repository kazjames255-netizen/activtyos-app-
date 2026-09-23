"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui";
import { FOCUS, Icon } from "../kit";
import type { PanelMeta, PanelProps } from "../panelTypes";
import { logToolEvent } from "./api";
import { REGISTRY } from "./registry";
import { ToolHost } from "./ToolHost";
import { SUBJECT_LABEL, SUBJECT_ORDER, type KeyStage, type ToolMeta, type ToolSubject } from "./types";

// The Tools tab: every learning tool, by subject and key stage. Only working tools are listed; unreleased ones are hidden outright
// no longer shown: only ready tools are listed (P-08).

export const meta: PanelMeta = { key: "tools", label: "Tools", icon: "🧰", status: "live", blurb: "Rulers, protractors, number lines, science diagrams and more — pick a subject." };

const KS_LABEL: Record<KeyStage, string> = { 1: "KS1", 2: "KS2", 3: "KS3", 4: "KS4", 5: "KS5" };
const READY = REGISTRY.filter((t) => t.status === "live"); // unreleased tools are hidden, not greyed out

/** [1,2,3,4,5] → "All ages"; [2,3,4] → "KS2–KS4"; [3,5] → "KS3 · KS5". */
function ksText(ks: KeyStage[]): string {
  const s = [...ks].sort();
  if (s.length === 5) return "All ages";
  const run = s.every((k, i) => i === 0 || k === s[i - 1]! + 1);
  return s.length > 2 && run ? `${KS_LABEL[s[0]!]}–${KS_LABEL[s[s.length - 1]!]}` : s.map((k) => KS_LABEL[k]).join(" · ");
}

function Card({ t, onOpen }: { t: ToolMeta; onOpen: (t: ToolMeta) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onOpen(t)} data-status={t.status} data-testid={`tool-${t.id}`}
        className={`flex h-full w-full flex-col gap-2 rounded-2xl border bg-[var(--surface)] p-3.5 text-left shadow-[var(--shadow-sm)] transition-shadow hover:shadow-md motion-reduce:transition-none ${FOCUS} border-[var(--line)]`}>
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1 text-[14.5px] font-extrabold leading-snug text-[var(--ink)]">{t.title}</span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-bold text-[var(--ink-2)]">
          <span>{SUBJECT_LABEL[t.subject]}</span><span aria-hidden>·</span><span>{ksText(t.keyStages)}</span>
        </span>
      </button>
    </li>
  );
}

export function Panel({ qs, childQs }: PanelProps) {
  const q0 = childQs ?? qs;
  const [subject, setSubject] = useState<ToolSubject | "all">("all");
  const [ks, setKs] = useState<KeyStage | null>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState<ToolMeta | null>(null);

  const counts = useMemo(() => Object.fromEntries(SUBJECT_ORDER.map((s) => [s, READY.filter((t) => t.subject === s).length])) as Record<ToolSubject, number>, []);
  const shown = useMemo(() => {
    const w = text.trim().toLowerCase();
    return READY.filter((t) => (subject === "all" || t.subject === subject) && (!ks || t.keyStages.includes(ks)) && (!w || `${t.title} ${t.tags.join(" ")}`.toLowerCase().includes(w)))
      .sort((a, b) => Number(b.status === "live") - Number(a.status === "live") || a.title.localeCompare(b.title));
  }, [subject, ks, text]);

  const onOpen = (t: ToolMeta) => { logToolEvent(q0, t.id, "open"); setOpen(t); };
  const chip = (on: boolean) => `min-h-[40px] rounded-full border px-3.5 text-[13px] font-extrabold ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`;

  return (
    <div id="hub-tools">
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1 sm:max-w-[340px]">
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-2)]" />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search tools… (e.g. angles, verbs)" aria-label="Search tools" className={`!min-h-[44px] w-full !rounded-full !pl-9 ${FOCUS}`} />
        </div>
        <span className="text-[12.5px] font-semibold text-[var(--ink-2)]" aria-live="polite">{shown.length} {shown.length === 1 ? "tool" : "tools"} ready to use</span>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Subject">
        <button type="button" aria-pressed={subject === "all"} onClick={() => setSubject("all")} className={chip(subject === "all")}>All</button>
        {SUBJECT_ORDER.map((s) => <button key={s} type="button" aria-pressed={subject === s} onClick={() => setSubject(s)} className={chip(subject === s)}>{SUBJECT_LABEL[s]} <span className="opacity-70">· {counts[s]}</span></button>)}
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Key stage">
        {([1, 2, 3, 4, 5] as KeyStage[]).map((k) => <button key={k} type="button" aria-pressed={ks === k} onClick={() => setKs(ks === k ? null : k)} className={chip(ks === k)}>{KS_LABEL[k]}</button>)}
      </div>
      {shown.length === 0 ? <p className="m-0 rounded-2xl border border-dashed border-[var(--line)] p-6 text-center text-[14px] font-semibold text-[var(--ink-2)]">No tools match that. Try a different subject or search.</p>
        : <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 xl:grid-cols-3">{shown.map((t) => <Card key={t.id} t={t} onOpen={onOpen} />)}</ul>}
      {open && <ToolHost tool={open} qs={q0} onClose={() => setOpen(null)} />}
    </div>
  );
}
