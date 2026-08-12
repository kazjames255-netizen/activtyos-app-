"use client";

import { useState } from "react";
import { Button, Input, Select } from "@/components/ui";
import { LIGHT_PALETTE } from "@/components/OperatorPage";
import { ART_KEYS } from "./CoursePlayer";
import type { Block, CourseDoc, Lesson } from "./courseContent";

// Simple, functional editor: course meta + lessons + content blocks. List-shaped
// block fields (points, steps, choices, options, tables) are edited as one item
// per line with a documented separator, to keep the editor compact.

const uid = (p: string) => p + Math.random().toString(36).slice(2, 8);
const BLOCK_KINDS: [Block["k"], string][] = [["text", "Paragraph"], ["points", "Key points"], ["callout", "Callout / warning"], ["steps", "Numbered steps"], ["scenario", "Scenario (interactive)"], ["check", "Knowledge check"], ["sort", "Drag-into-groups"], ["order", "Put-in-order"], ["match", "Match pairs"], ["reveal", "Flip cards"], ["stat", "Big stat"], ["quote", "Quote"], ["art", "Illustration"], ["table", "Table"]];

function newBlock(k: Block["k"]): Block {
  switch (k) {
    case "points": return { k, title: "Key points", items: ["First point", "Second point"] };
    case "callout": return { k, tone: "info", title: "Note", t: "Something important." };
    case "steps": return { k, title: "Steps", items: [{ h: "Step one", t: "What to do." }] };
    case "scenario": return { k, t: "Describe the situation…", choices: [{ label: "Option A", ok: true, fb: "Why it's right." }, { label: "Option B", ok: false, fb: "Why it's wrong." }] };
    case "check": return { k, q: "Your question?", opts: ["Right answer", "Wrong answer"], a: 0, fb: "Explanation." };
    case "stat": return { k, value: "100%", label: "of the time" };
    case "quote": return { k, t: "A memorable quote.", by: "Source" };
    case "art": return { k, art: "shield", caption: "Caption" };
    case "table": return { k, head: ["Column A", "Column B"], rows: [["a1", "b1"], ["a2", "b2"]] };
    case "sort": return { k, prompt: "Drag each into the right group.", buckets: ["Group A", "Group B"], items: [{ text: "Item 1", bucket: 0 }, { text: "Item 2", bucket: 1 }] };
    case "order": return { k, prompt: "Put these in order.", items: ["First", "Second", "Third"] };
    case "match": return { k, prompt: "Match the pairs.", pairs: [{ l: "Term", r: "Definition" }] };
    case "reveal": return { k, prompt: "Tap to reveal.", cards: [{ front: "Front", back: "Back" }] };
    default: return { k: "text", t: "New paragraph." };
  }
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block"><span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{label}</span>{children}</label>
);
const TA = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-[13px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]" />;

function BlockEditor({ b, onChange }: { b: Block; onChange: (b: Block) => void }) {
  if (b.k === "text") return <Field label="Paragraph"><TA rows={3} value={b.t} onChange={(e) => onChange({ ...b, t: e.target.value })} /></Field>;
  if (b.k === "quote") return <div className="grid gap-2"><Field label="Quote"><TA rows={2} value={b.t} onChange={(e) => onChange({ ...b, t: e.target.value })} /></Field><Field label="Attribution"><Input value={b.by ?? ""} onChange={(e) => onChange({ ...b, by: e.target.value })} className="w-full" /></Field></div>;
  if (b.k === "stat") return <div className="grid grid-cols-2 gap-2"><Field label="Value"><Input value={b.value} onChange={(e) => onChange({ ...b, value: e.target.value })} className="w-full" /></Field><Field label="Label"><Input value={b.label} onChange={(e) => onChange({ ...b, label: e.target.value })} className="w-full" /></Field></div>;
  if (b.k === "art") return <div className="grid grid-cols-2 gap-2"><Field label="Scene"><Select value={b.art} onChange={(e) => onChange({ ...b, art: e.target.value })} className="w-full">{ART_KEYS.map((a) => <option key={a} value={a}>{a}</option>)}</Select></Field><Field label="Caption"><Input value={b.caption ?? ""} onChange={(e) => onChange({ ...b, caption: e.target.value })} className="w-full" /></Field></div>;
  if (b.k === "callout") return <div className="grid gap-2"><div className="grid grid-cols-2 gap-2"><Field label="Tone"><Select value={b.tone} onChange={(e) => onChange({ ...b, tone: e.target.value as typeof b.tone })} className="w-full"><option value="info">Info</option><option value="warn">Warning</option><option value="tip">Tip</option><option value="law">Law / rule</option></Select></Field><Field label="Title"><Input value={b.title} onChange={(e) => onChange({ ...b, title: e.target.value })} className="w-full" /></Field></div><Field label="Text"><TA rows={2} value={b.t} onChange={(e) => onChange({ ...b, t: e.target.value })} /></Field></div>;
  if (b.k === "points") return <div className="grid gap-2"><Field label="Title (optional)"><Input value={b.title ?? ""} onChange={(e) => onChange({ ...b, title: e.target.value })} className="w-full" /></Field><Field label="Items — one per line"><TA rows={4} value={b.items.join("\n")} onChange={(e) => onChange({ ...b, items: e.target.value.split("\n").filter(Boolean) })} /></Field></div>;
  if (b.k === "steps") return <div className="grid gap-2"><Field label="Title (optional)"><Input value={b.title ?? ""} onChange={(e) => onChange({ ...b, title: e.target.value })} className="w-full" /></Field><Field label="Steps — one per line as “Heading | text”"><TA rows={5} value={b.items.map((i) => i.h + " | " + i.t).join("\n")} onChange={(e) => onChange({ ...b, items: e.target.value.split("\n").filter(Boolean).map((l) => { const [h, ...r] = l.split("|"); return { h: (h ?? "").trim(), t: r.join("|").trim() }; }) })} /></Field></div>;
  if (b.k === "scenario") return <div className="grid gap-2"><Field label="Situation"><TA rows={2} value={b.t} onChange={(e) => onChange({ ...b, t: e.target.value })} /></Field><Field label="Choices — one per line as “label | correct(y/n) | feedback”"><TA rows={4} value={b.choices.map((c) => `${c.label} | ${c.ok ? "y" : "n"} | ${c.fb}`).join("\n")} onChange={(e) => onChange({ ...b, choices: e.target.value.split("\n").filter(Boolean).map((l) => { const p = l.split("|"); return { label: (p[0] ?? "").trim(), ok: /^\s*[y1t]/i.test(p[1] ?? ""), fb: (p[2] ?? "").trim() }; }) })} /></Field></div>;
  if (b.k === "check") return <div className="grid gap-2"><Field label="Question"><TA rows={2} value={b.q} onChange={(e) => onChange({ ...b, q: e.target.value })} /></Field><Field label="Options — one per line"><TA rows={4} value={b.opts.join("\n")} onChange={(e) => onChange({ ...b, opts: e.target.value.split("\n").filter(Boolean) })} /></Field><div className="grid grid-cols-2 gap-2"><Field label="Correct option # (from 1)"><Input type="number" min={1} value={b.a + 1} onChange={(e) => onChange({ ...b, a: Math.max(0, Number(e.target.value) - 1) })} className="w-full" /></Field><Field label="Feedback"><Input value={b.fb ?? ""} onChange={(e) => onChange({ ...b, fb: e.target.value })} className="w-full" /></Field></div></div>;
  if (b.k === "table") return <div className="grid gap-2"><Field label="Header — comma separated"><Input value={b.head.join(", ")} onChange={(e) => onChange({ ...b, head: e.target.value.split(",").map((x) => x.trim()) })} className="w-full" /></Field><Field label="Rows — one per line, cells comma separated"><TA rows={4} value={b.rows.map((r) => r.join(", ")).join("\n")} onChange={(e) => onChange({ ...b, rows: e.target.value.split("\n").filter(Boolean).map((l) => l.split(",").map((c) => c.trim())) })} /></Field></div>;
  if (b.k === "sort") return <div className="grid gap-2"><Field label="Prompt"><Input value={b.prompt} onChange={(e) => onChange({ ...b, prompt: e.target.value })} className="w-full" /></Field><Field label="Groups — comma separated"><Input value={b.buckets.join(", ")} onChange={(e) => onChange({ ...b, buckets: e.target.value.split(",").map((x) => x.trim()) })} className="w-full" /></Field><Field label="Items — one per line as “text | group number (from 1)”"><TA rows={4} value={b.items.map((i) => `${i.text} | ${i.bucket + 1}`).join("\n")} onChange={(e) => onChange({ ...b, items: e.target.value.split("\n").filter(Boolean).map((l) => { const p = l.split("|"); return { text: (p[0] ?? "").trim(), bucket: Math.max(0, Number(p[1] ?? 1) - 1) }; }) })} /></Field></div>;
  if (b.k === "order") return <div className="grid gap-2"><Field label="Prompt"><Input value={b.prompt} onChange={(e) => onChange({ ...b, prompt: e.target.value })} className="w-full" /></Field><Field label="Items in the CORRECT order — one per line"><TA rows={4} value={b.items.join("\n")} onChange={(e) => onChange({ ...b, items: e.target.value.split("\n").filter(Boolean) })} /></Field></div>;
  if (b.k === "match") return <div className="grid gap-2"><Field label="Prompt"><Input value={b.prompt} onChange={(e) => onChange({ ...b, prompt: e.target.value })} className="w-full" /></Field><Field label="Pairs — one per line as “left | right”"><TA rows={4} value={b.pairs.map((p) => `${p.l} | ${p.r}`).join("\n")} onChange={(e) => onChange({ ...b, pairs: e.target.value.split("\n").filter(Boolean).map((l) => { const p = l.split("|"); return { l: (p[0] ?? "").trim(), r: (p[1] ?? "").trim() }; }) })} /></Field></div>;
  if (b.k === "reveal") return <div className="grid gap-2"><Field label="Prompt (optional)"><Input value={b.prompt ?? ""} onChange={(e) => onChange({ ...b, prompt: e.target.value })} className="w-full" /></Field><Field label="Cards — one per line as “front | back”"><TA rows={4} value={b.cards.map((c) => `${c.front} | ${c.back}`).join("\n")} onChange={(e) => onChange({ ...b, cards: e.target.value.split("\n").filter(Boolean).map((l) => { const p = l.split("|"); return { front: (p[0] ?? "").trim(), back: (p[1] ?? "").trim() }; }) })} /></Field></div>;
  return null;
}

export function CourseEditor({ course, onSave, onCancel }: { course: CourseDoc; onSave: (c: CourseDoc) => void; onCancel: () => void }) {
  const [c, setC] = useState<CourseDoc>(JSON.parse(JSON.stringify(course)));
  const [li, setLi] = useState(0);
  const lesson = c.lessons[li] ?? c.lessons[0];
  const setLesson = (fn: (l: Lesson) => Lesson) => setC({ ...c, lessons: c.lessons.map((l, i) => (i === li ? fn(l) : l)) });
  const setBlock = (bi: number, b: Block) => setLesson((l) => ({ ...l, blocks: l.blocks.map((x, i) => (i === bi ? b : x)) }));
  const moveBlock = (bi: number, dir: -1 | 1) => setLesson((l) => { const a = [...l.blocks]; const j = bi + dir; if (j < 0 || j >= a.length) return l; [a[bi], a[j]] = [a[j], a[bi]]; return { ...l, blocks: a }; });
  const delBlock = (bi: number) => setLesson((l) => ({ ...l, blocks: l.blocks.filter((_, i) => i !== bi) }));
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-[140] flex flex-col bg-[#f5f8fd]" style={LIGHT_PALETTE}>
      <div className="flex flex-none items-center gap-3 border-b border-[var(--line)] bg-white px-4 py-2.5 sm:px-6">
        <div className="text-[14px] font-extrabold text-[var(--ink)]">✏️ Edit course</div>
        <div className="ml-auto flex gap-2"><Button onClick={onCancel}>Cancel</Button><Button variant="primary" onClick={() => onSave(c)}>Save course</Button></div>
      </div>
      <div className="flex min-h-0 flex-1">
        {/* left: meta + lessons */}
        <aside className="w-[280px] flex-none overflow-y-auto border-r border-[var(--line)] bg-white p-4">
          <div className="grid gap-2.5">
            <Field label="Course title"><Input value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} className="w-full" /></Field>
            <div className="grid grid-cols-2 gap-2"><Field label="Category"><Select value={c.cat} onChange={(e) => setC({ ...c, cat: e.target.value as CourseDoc["cat"] })} className="w-full"><option>Mandatory</option><option>Recommended</option><option>Optional</option></Select></Field><Field label="Cover"><Select value={c.cover} onChange={(e) => setC({ ...c, cover: e.target.value })} className="w-full">{ART_KEYS.map((a) => <option key={a} value={a}>{a}</option>)}</Select></Field></div>
            <Field label="Short description"><TA rows={2} value={c.blurb} onChange={(e) => setC({ ...c, blurb: e.target.value })} /></Field>
          </div>
          <div className="mt-4 mb-1.5 flex items-center"><span className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Lessons</span><button type="button" onClick={() => { setC({ ...c, lessons: [...c.lessons, { id: uid("l"), title: `Lesson ${c.lessons.length + 1}`, mins: 3, blocks: [{ k: "text", t: "…" }] }] }); setLi(c.lessons.length); }} className="ml-auto text-[12px] font-extrabold text-[#1d3a8f] hover:underline">+ Add</button></div>
          {c.lessons.map((l, i) => (
            <div key={l.id} className={"mb-1 flex items-center gap-1 rounded-lg px-1 " + (i === li ? "bg-[#eef4fd]" : "")}>
              <button type="button" onClick={() => setLi(i)} className="flex-1 truncate px-2 py-2 text-left text-[12.5px] font-bold text-[var(--ink)]">{i + 1}. {l.title}</button>
              {c.lessons.length > 1 && <button type="button" onClick={() => { setC({ ...c, lessons: c.lessons.filter((_, x) => x !== i) }); setLi(0); }} className="px-1.5 text-[13px] text-[var(--ink-3)] hover:text-[#c0392b]">×</button>}
            </div>
          ))}
        </aside>
        {/* right: lesson blocks */}
        <main className="min-w-0 flex-1 overflow-y-auto p-5">
          <div className="mx-auto max-w-[680px]">
            <div className="mb-3 grid grid-cols-[1fr_auto] gap-2">
              <Field label="Lesson title"><Input value={lesson.title} onChange={(e) => setLesson((l) => ({ ...l, title: e.target.value }))} className="w-full" /></Field>
              <Field label="Minutes"><Input type="number" min={1} value={lesson.mins} onChange={(e) => setLesson((l) => ({ ...l, mins: Number(e.target.value) }))} className="w-[80px]" /></Field>
            </div>
            <div className="flex flex-col gap-2.5">
              {lesson.blocks.map((b, bi) => (
                <div key={bi} className="rounded-xl border border-[var(--line)] bg-white p-3">
                  <div className="mb-2 flex items-center gap-2"><span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{BLOCK_KINDS.find(([k]) => k === b.k)?.[1] ?? b.k}</span><div className="ml-auto flex gap-1"><button type="button" onClick={() => moveBlock(bi, -1)} className="px-1.5 text-[13px] text-[var(--ink-3)] hover:text-[var(--ink)]">↑</button><button type="button" onClick={() => moveBlock(bi, 1)} className="px-1.5 text-[13px] text-[var(--ink-3)] hover:text-[var(--ink)]">↓</button><button type="button" onClick={() => delBlock(bi)} className="px-1.5 text-[13px] text-[var(--ink-3)] hover:text-[#c0392b]">🗑</button></div></div>
                  <BlockEditor b={b} onChange={(nb) => setBlock(bi, nb)} />
                </div>
              ))}
            </div>
            <div className="relative mt-3">
              <button type="button" onClick={() => setAddOpen((v) => !v)} className="w-full rounded-xl border border-dashed border-[var(--line)] py-2.5 text-[13px] font-extrabold text-[#1d3a8f] hover:border-[#1d3a8f] hover:bg-[#eef4fd]">+ Add content block</button>
              {addOpen && <div className="absolute inset-x-0 top-[44px] z-10 grid grid-cols-2 gap-1 rounded-xl border border-[var(--line)] bg-white p-1.5 shadow-lg">{BLOCK_KINDS.map(([k, l]) => <button key={k} type="button" onClick={() => { setLesson((ls) => ({ ...ls, blocks: [...ls.blocks, newBlock(k)] })); setAddOpen(false); }} className="rounded-lg px-3 py-2 text-left text-[12.5px] font-semibold text-[var(--ink-2)] hover:bg-[var(--panel)]">{l}</button>)}</div>}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
