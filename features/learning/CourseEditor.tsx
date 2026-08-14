"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { post } from "@/lib/api";
import { Button, Input, Select } from "@/components/ui";
import { LIGHT_PALETTE } from "@/components/OperatorPage";
import { ART_KEYS, CoursePlayer, BlockView } from "./CoursePlayer";
import { CourseBanner } from "./CourseBanner";
import { COURSE_PALETTES, coursePaletteOf, SECTIONS, SECTION_GROUPS, BLOCK_GROUPS, blockMeta } from "./courseTheme";
import type { Section } from "./courseTheme";
import type { Block, CourseDoc, Lesson, QuizQ } from "./courseContent";

// Simple, functional editor: course meta + lessons + content blocks. List-shaped
// block fields (points, steps, choices, options, tables) are edited as one item
// per line with a documented separator, to keep the editor compact.

const uid = (p: string) => p + Math.random().toString(36).slice(2, 8);
const TOPIC_CATS: [string, string][] = [["saf", "Safeguarding & child protection"], ["inclusion", "Inclusion & culture"], ["send", "SEND & wellbeing"], ["medical", "Medical awareness"], ["health", "Health & safety"], ["digital", "Digital & data"], ["together", "Working together"]];

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
    case "image": return { k, src: "", caption: "" };
    case "video": return { k, src: "", caption: "" };
    default: return { k: "text", t: "New paragraph." };
  }
}

const Field = ({ label, children, ai }: { label: string; children: React.ReactNode; ai?: React.ReactNode }) => (
  <label className="block"><span className="mb-1 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{label}{ai && <span className="ml-auto normal-case">{ai}</span>}</span>{children}</label>
);

// Reusable "✨ AI" helper — drafts or polishes a text field via the existing
// /api/ai/compose endpoint, framed for e-learning (staff training) content.
function AiBtn({ value, hint, onResult }: { value: string; hint: string; onResult: (t: string) => void }) {
  const [busy, setBusy] = useState(false);
  const run = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const draft = value.trim();
      const notes = `You are helping write content for an ONLINE STAFF TRAINING course (e-learning for people who work with children) — this is NOT a message to parents. Task: ${hint}. ${draft ? `Improve and polish this draft while keeping its meaning:\n"""${draft}"""` : "Write it from scratch with a sensible, realistic example."} Keep it warm, clear, concise and professional, in British English. Return ONLY the finished text — no title, no preamble, no quotation marks.`;
      const r = await post<{ title: string; body: string }>("/api/ai/compose", { kind: "announce", notes, length: "short" });
      const out = (r.body || r.title || "").trim().replace(/^["“]+|["”]+$/g, "").trim();
      if (out) onResult(out);
    } catch { /* leave the text as-is on any error */ }
    setBusy(false);
  };
  return (
    <button type="button" onClick={run} disabled={busy} title="Get AI help writing this" className="inline-flex items-center gap-1 rounded-md border border-[#d9cdf5] bg-[#faf7ff] px-1.5 py-0.5 text-[10.5px] font-bold text-[#6d28d9] transition-colors hover:border-[#6d28d9] disabled:opacity-60">{busy ? "✨ Writing…" : "✨ AI"}</button>
  );
}
const TA = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-[13px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]" />;
const Lbl = ({ children }: { children: React.ReactNode }) => <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{children}</div>;
const AddBtn = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onClick} className="mt-0.5 rounded-lg border border-dashed border-[#c7d6f5] bg-[#f5f8ff] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f] transition-colors hover:border-[#1d3a8f] hover:bg-[#eaf1fd]">{children}</button>
);
const DelBtn = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick} title="Remove" aria-label="Remove" className="grid h-7 w-7 flex-none place-items-center rounded-lg text-[13px] text-[var(--ink-3)] transition-colors hover:bg-[#fdecea] hover:text-[#c0392b]">🗑</button>
);

function BlockEditor({ b, onChange }: { b: Block; onChange: (b: Block) => void }) {
  if (b.k === "text") return <Field label="Paragraph" ai={<AiBtn value={b.t} hint="write a clear, engaging teaching paragraph for this lesson" onResult={(t) => onChange({ ...b, t })} />}><TA rows={3} value={b.t} onChange={(e) => onChange({ ...b, t: e.target.value })} /></Field>;
  if (b.k === "quote") return <div className="grid gap-2"><Field label="Quote" ai={<AiBtn value={b.t} hint="write a short, memorable quote or principle relevant to this training" onResult={(t) => onChange({ ...b, t })} />}><TA rows={2} value={b.t} onChange={(e) => onChange({ ...b, t: e.target.value })} /></Field><Field label="Attribution"><Input value={b.by ?? ""} onChange={(e) => onChange({ ...b, by: e.target.value })} className="w-full" /></Field></div>;
  if (b.k === "stat") return <div className="grid grid-cols-2 gap-2"><Field label="Value"><Input value={b.value} onChange={(e) => onChange({ ...b, value: e.target.value })} className="w-full" /></Field><Field label="Label"><Input value={b.label} onChange={(e) => onChange({ ...b, label: e.target.value })} className="w-full" /></Field></div>;
  if (b.k === "art") return <div className="grid grid-cols-2 gap-2"><Field label="Scene"><Select value={b.art} onChange={(e) => onChange({ ...b, art: e.target.value })} className="w-full">{ART_KEYS.map((a) => <option key={a} value={a}>{a}</option>)}</Select></Field><Field label="Caption"><Input value={b.caption ?? ""} onChange={(e) => onChange({ ...b, caption: e.target.value })} className="w-full" /></Field></div>;
  if (b.k === "callout") return <div className="grid gap-2"><div className="grid grid-cols-2 gap-2"><Field label="Tone"><Select value={b.tone} onChange={(e) => onChange({ ...b, tone: e.target.value as typeof b.tone })} className="w-full"><option value="info">Info</option><option value="warn">Warning</option><option value="tip">Tip</option><option value="law">Law / rule</option></Select></Field><Field label="Title"><Input value={b.title} onChange={(e) => onChange({ ...b, title: e.target.value })} className="w-full" /></Field></div><Field label="Text" ai={<AiBtn value={b.t} hint="write a short, punchy callout note for this lesson" onResult={(t) => onChange({ ...b, t })} />}><TA rows={2} value={b.t} onChange={(e) => onChange({ ...b, t: e.target.value })} /></Field></div>;
  if (b.k === "points") return <div className="grid gap-2">
    <Field label="Heading (optional)"><Input value={b.title ?? ""} onChange={(e) => onChange({ ...b, title: e.target.value })} className="w-full" /></Field>
    <div><Lbl>Bullet points</Lbl>
      {b.items.map((it, i) => (
        <div key={i} className="mb-1.5 flex items-center gap-1.5">
          <span className="flex-none text-[15px] leading-none text-[#1d3a8f]">•</span>
          <Input value={it} onChange={(e) => onChange({ ...b, items: b.items.map((x, j) => (j === i ? e.target.value : x)) })} placeholder="Write a point…" className="w-full" />
          <DelBtn onClick={() => onChange({ ...b, items: b.items.filter((_, j) => j !== i) })} />
        </div>
      ))}
      <AddBtn onClick={() => onChange({ ...b, items: [...b.items, ""] })}>+ Add point</AddBtn>
    </div>
  </div>;
  if (b.k === "steps") return <div className="grid gap-2">
    <Field label="Heading (optional)"><Input value={b.title ?? ""} onChange={(e) => onChange({ ...b, title: e.target.value })} className="w-full" /></Field>
    <div><Lbl>Steps</Lbl>
      {b.items.map((it, i) => (
        <div key={i} className="mb-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2">
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-[#1d3a8f] text-[10px] font-extrabold text-white">{i + 1}</span>
            <Input value={it.h} onChange={(e) => onChange({ ...b, items: b.items.map((x, j) => (j === i ? { ...x, h: e.target.value } : x)) })} placeholder="Step heading" className="w-full font-semibold" />
            <DelBtn onClick={() => onChange({ ...b, items: b.items.filter((_, j) => j !== i) })} />
          </div>
          <TA rows={2} value={it.t} onChange={(e) => onChange({ ...b, items: b.items.map((x, j) => (j === i ? { ...x, t: e.target.value } : x)) })} placeholder="What happens in this step…" />
        </div>
      ))}
      <AddBtn onClick={() => onChange({ ...b, items: [...b.items, { h: "", t: "" }] })}>+ Add step</AddBtn>
    </div>
  </div>;
  if (b.k === "scenario") return <div className="grid gap-2">
    <Field label="The situation" ai={<AiBtn value={b.t} hint="describe a realistic workplace scenario for the learner to respond to" onResult={(t) => onChange({ ...b, t })} />}><TA rows={2} value={b.t} onChange={(e) => onChange({ ...b, t: e.target.value })} placeholder="Describe what's happening…" /></Field>
    <div><Lbl>Answer options — tick the correct one(s)</Lbl>
      {b.choices.map((ch, i) => (
        <div key={i} className={"mb-2 rounded-xl border p-2 " + (ch.ok ? "border-[#8fd6a9] bg-[#f2fbf5]" : "border-[var(--line)] bg-[var(--surface)]")}>
          <div className="mb-1.5 flex items-center gap-2">
            <label className="flex flex-none cursor-pointer items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-bold text-[var(--ink-2)]"><input type="checkbox" checked={ch.ok} onChange={(e) => onChange({ ...b, choices: b.choices.map((x, j) => (j === i ? { ...x, ok: e.target.checked } : x)) })} /> {ch.ok ? "✅ Correct" : "Correct?"}</label>
            <Input value={ch.label} onChange={(e) => onChange({ ...b, choices: b.choices.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Answer the learner can pick" className="w-full" />
            <DelBtn onClick={() => onChange({ ...b, choices: b.choices.filter((_, j) => j !== i) })} />
          </div>
          <Input value={ch.fb} onChange={(e) => onChange({ ...b, choices: b.choices.map((x, j) => (j === i ? { ...x, fb: e.target.value } : x)) })} placeholder="💬 Feedback shown when they pick this" className="w-full" />
        </div>
      ))}
      <AddBtn onClick={() => onChange({ ...b, choices: [...b.choices, { label: "", ok: false, fb: "" }] })}>+ Add option</AddBtn>
    </div>
  </div>;
  if (b.k === "check") return <div className="grid gap-2">
    <Field label="Question" ai={<AiBtn value={b.q} hint="write a clear multiple-choice knowledge-check question for this lesson" onResult={(t) => onChange({ ...b, q: t })} />}><TA rows={2} value={b.q} onChange={(e) => onChange({ ...b, q: e.target.value })} placeholder="Ask a question…" /></Field>
    <div><Lbl>Options — select the correct answer</Lbl>
      {b.opts.map((o, i) => (
        <div key={i} className={"mb-1.5 flex items-center gap-2 rounded-lg border px-2 py-1 " + (b.a === i ? "border-[#8fd6a9] bg-[#f2fbf5]" : "border-[var(--line)] bg-[var(--surface)]")}>
          <label className="flex flex-none cursor-pointer items-center gap-1 text-[11px] font-bold text-[var(--ink-2)]" title="Mark as the correct answer"><input type="radio" name={"chk-" + b.q.slice(0, 6)} checked={b.a === i} onChange={() => onChange({ ...b, a: i })} /> {b.a === i ? "✅" : ""}</label>
          <Input value={o} onChange={(e) => onChange({ ...b, opts: b.opts.map((x, j) => (j === i ? e.target.value : x)) })} placeholder={"Option " + (i + 1)} className="w-full" />
          <DelBtn onClick={() => { const opts = b.opts.filter((_, j) => j !== i); onChange({ ...b, opts, a: Math.min(b.a, Math.max(opts.length - 1, 0)) }); }} />
        </div>
      ))}
      <AddBtn onClick={() => onChange({ ...b, opts: [...b.opts, ""] })}>+ Add option</AddBtn>
    </div>
    <Field label="Feedback (optional)"><Input value={b.fb ?? ""} onChange={(e) => onChange({ ...b, fb: e.target.value })} placeholder="Explain the answer…" className="w-full" /></Field>
  </div>;
  if (b.k === "table") return <div className="grid gap-2">
    <div><Lbl>Columns</Lbl>
      <div className="flex flex-wrap items-center gap-1.5">
        {b.head.map((h, i) => (
          <div key={i} className="flex items-center gap-0.5">
            <Input value={h} onChange={(e) => onChange({ ...b, head: b.head.map((x, j) => (j === i ? e.target.value : x)) })} placeholder={"Column " + (i + 1)} className="w-[130px] font-semibold" />
            <button type="button" onClick={() => onChange({ ...b, head: b.head.filter((_, j) => j !== i), rows: b.rows.map((r) => r.filter((_, j) => j !== i)) })} title="Remove column" className="text-[13px] text-[var(--ink-3)] hover:text-[#c0392b]">×</button>
          </div>
        ))}
        <button type="button" onClick={() => onChange({ ...b, head: [...b.head, ""], rows: b.rows.map((r) => [...r, ""]) })} className="rounded-lg border border-dashed border-[#c7d6f5] bg-[#f5f8ff] px-2.5 py-1.5 text-[12px] font-bold text-[#1d3a8f] hover:border-[#1d3a8f]">+ Column</button>
      </div>
    </div>
    <div><Lbl>Rows</Lbl>
      {b.rows.map((r, ri) => (
        <div key={ri} className="mb-1.5 flex items-center gap-1">
          <span className="w-4 flex-none text-center text-[10px] font-bold text-[var(--ink-3)]">{ri + 1}</span>
          {b.head.map((_, ci) => (
            <Input key={ci} value={r[ci] ?? ""} onChange={(e) => onChange({ ...b, rows: b.rows.map((row, j) => (j === ri ? row.map((cell, k) => (k === ci ? e.target.value : cell)) : row)) })} className="w-full" />
          ))}
          <DelBtn onClick={() => onChange({ ...b, rows: b.rows.filter((_, j) => j !== ri) })} />
        </div>
      ))}
      <AddBtn onClick={() => onChange({ ...b, rows: [...b.rows, b.head.map(() => "")] })}>+ Add row</AddBtn>
    </div>
  </div>;
  if (b.k === "sort") return <div className="grid gap-2">
    <Field label="Instruction for the learner"><Input value={b.prompt} onChange={(e) => onChange({ ...b, prompt: e.target.value })} placeholder="e.g. Sort each item into the right group" className="w-full" /></Field>
    <div><Lbl>Groups</Lbl>
      {b.buckets.map((bk, i) => (
        <div key={i} className="mb-1.5 flex items-center gap-1.5">
          <span className="grid h-5 w-5 flex-none place-items-center rounded-lg bg-[#eef2ff] text-[10px] font-extrabold text-[#4338ca]">{String.fromCharCode(65 + i)}</span>
          <Input value={bk} onChange={(e) => onChange({ ...b, buckets: b.buckets.map((x, j) => (j === i ? e.target.value : x)) })} placeholder="Group name" className="w-full" />
          <DelBtn onClick={() => { if (b.buckets.length <= 1) return; const buckets = b.buckets.filter((_, j) => j !== i); const items = b.items.map((it) => ({ ...it, bucket: it.bucket === i ? 0 : it.bucket > i ? it.bucket - 1 : it.bucket })); onChange({ ...b, buckets, items }); }} />
        </div>
      ))}
      <AddBtn onClick={() => onChange({ ...b, buckets: [...b.buckets, ""] })}>+ Add group</AddBtn>
    </div>
    <div><Lbl>Items — choose which group each belongs to</Lbl>
      {b.items.map((it, i) => (
        <div key={i} className="mb-1.5 flex items-center gap-1.5">
          <Input value={it.text} onChange={(e) => onChange({ ...b, items: b.items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} placeholder="Item" className="w-full" />
          <span className="flex-none text-[var(--ink-3)]">→</span>
          <Select value={it.bucket} onChange={(e) => onChange({ ...b, items: b.items.map((x, j) => (j === i ? { ...x, bucket: Number(e.target.value) } : x)) })} className="max-w-[150px]">{b.buckets.map((bk, bi) => <option key={bi} value={bi}>{bk || "Group " + (bi + 1)}</option>)}</Select>
          <DelBtn onClick={() => onChange({ ...b, items: b.items.filter((_, j) => j !== i) })} />
        </div>
      ))}
      <AddBtn onClick={() => onChange({ ...b, items: [...b.items, { text: "", bucket: 0 }] })}>+ Add item</AddBtn>
    </div>
  </div>;
  if (b.k === "order") return <div className="grid gap-2">
    <Field label="Instruction for the learner"><Input value={b.prompt} onChange={(e) => onChange({ ...b, prompt: e.target.value })} placeholder="e.g. Put these steps in the right order" className="w-full" /></Field>
    <div><Lbl>Steps in the correct order (learners see them shuffled)</Lbl>
      {b.items.map((it, i) => (
        <div key={i} className="mb-1.5 flex items-center gap-1.5">
          <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-[#6d28d9] text-[10px] font-extrabold text-white">{i + 1}</span>
          <Input value={it} onChange={(e) => onChange({ ...b, items: b.items.map((x, j) => (j === i ? e.target.value : x)) })} placeholder="Describe this step" className="w-full" />
          <button type="button" onClick={() => { if (i === 0) return; const a = [...b.items]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; onChange({ ...b, items: a }); }} title="Move up" className="px-1 text-[13px] text-[var(--ink-3)] hover:text-[var(--ink)]">↑</button>
          <button type="button" onClick={() => { if (i === b.items.length - 1) return; const a = [...b.items]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; onChange({ ...b, items: a }); }} title="Move down" className="px-1 text-[13px] text-[var(--ink-3)] hover:text-[var(--ink)]">↓</button>
          <DelBtn onClick={() => onChange({ ...b, items: b.items.filter((_, j) => j !== i) })} />
        </div>
      ))}
      <AddBtn onClick={() => onChange({ ...b, items: [...b.items, ""] })}>+ Add step</AddBtn>
    </div>
  </div>;
  if (b.k === "match") return <div className="grid gap-2">
    <Field label="Instruction for the learner"><Input value={b.prompt} onChange={(e) => onChange({ ...b, prompt: e.target.value })} placeholder="e.g. Match each term to its meaning" className="w-full" /></Field>
    <div><Lbl>Pairs to match</Lbl>
      {b.pairs.map((p, i) => (
        <div key={i} className="mb-1.5 flex items-center gap-1.5">
          <Input value={p.l} onChange={(e) => onChange({ ...b, pairs: b.pairs.map((x, j) => (j === i ? { ...x, l: e.target.value } : x)) })} placeholder="Left" className="w-full" />
          <span className="flex-none text-[var(--ink-3)]">↔</span>
          <Input value={p.r} onChange={(e) => onChange({ ...b, pairs: b.pairs.map((x, j) => (j === i ? { ...x, r: e.target.value } : x)) })} placeholder="Right (its match)" className="w-full" />
          <DelBtn onClick={() => onChange({ ...b, pairs: b.pairs.filter((_, j) => j !== i) })} />
        </div>
      ))}
      <AddBtn onClick={() => onChange({ ...b, pairs: [...b.pairs, { l: "", r: "" }] })}>+ Add pair</AddBtn>
    </div>
  </div>;
  if (b.k === "reveal") return <div className="grid gap-2">
    <Field label="Prompt (optional)"><Input value={b.prompt ?? ""} onChange={(e) => onChange({ ...b, prompt: e.target.value })} placeholder="e.g. Tap each card to reveal" className="w-full" /></Field>
    <div><Lbl>Flip cards</Lbl>
      {b.cards.map((c, i) => (
        <div key={i} className="mb-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2">
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="flex-none rounded bg-[#eef2ff] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#4338ca]">Front</span>
            <Input value={c.front} onChange={(e) => onChange({ ...b, cards: b.cards.map((x, j) => (j === i ? { ...x, front: e.target.value } : x)) })} placeholder="What shows first" className="w-full font-semibold" />
            <DelBtn onClick={() => onChange({ ...b, cards: b.cards.filter((_, j) => j !== i) })} />
          </div>
          <div className="flex items-start gap-1.5">
            <span className="mt-1.5 flex-none rounded bg-[#f0f7f2] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#15803d]">Back</span>
            <TA rows={2} value={c.back} onChange={(e) => onChange({ ...b, cards: b.cards.map((x, j) => (j === i ? { ...x, back: e.target.value } : x)) })} placeholder="Revealed when tapped" />
          </div>
        </div>
      ))}
      <AddBtn onClick={() => onChange({ ...b, cards: [...b.cards, { front: "", back: "" }] })}>+ Add card</AddBtn>
    </div>
  </div>;
  if (b.k === "image") return <div className="grid gap-2">
    <Field label="Image"><div className="flex flex-wrap items-center gap-2">
      <label className="cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">⬆ Upload image<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => onChange({ ...b, src: String(r.result) }); r.readAsDataURL(f); }} /></label>
      {b.src && <img src={b.src} alt="" className="h-10 w-16 rounded border border-[var(--line)] object-cover" />}
      {b.src && <button type="button" onClick={() => onChange({ ...b, src: "" })} className="text-[12px] font-semibold text-[var(--ink-3)] hover:text-[#c0392b]">Remove</button>}
    </div></Field>
    <Field label="…or paste an image URL"><Input value={b.src.startsWith("data:") ? "" : b.src} onChange={(e) => onChange({ ...b, src: e.target.value })} placeholder="https://…" className="w-full" /></Field>
    <Field label="Caption (optional)"><Input value={b.caption ?? ""} onChange={(e) => onChange({ ...b, caption: e.target.value })} className="w-full" /></Field>
  </div>;
  if (b.k === "video") return <div className="grid gap-2">
    <Field label="Video URL — YouTube, Vimeo or an .mp4 link"><Input value={b.src} onChange={(e) => onChange({ ...b, src: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" className="w-full" /></Field>
    <Field label="Caption (optional)"><Input value={b.caption ?? ""} onChange={(e) => onChange({ ...b, caption: e.target.value })} className="w-full" /></Field>
  </div>;
  return null;
}

const TABS: [Tab, string][] = [["design", "🎨 Design"], ["content", "📝 Content"], ["quiz", "🎓 Quiz"], ["preview", "👁 Preview"]];
type Tab = "design" | "content" | "quiz" | "preview";
const DIFFICULTY: [CourseDoc["cat"], string][] = [["Mandatory", "Mandatory"], ["Recommended", "Recommended"], ["Optional", "Optional"]];

export function CourseEditor({ course, onSave, onCancel }: { course: CourseDoc; onSave: (c: CourseDoc) => void; onCancel: () => void }) {
  const [c, setC] = useState<CourseDoc>(JSON.parse(JSON.stringify(course)));
  const [li, setLi] = useState(0);
  const [tab, setTab] = useState<Tab>("design");
  const [addOpen, setAddOpen] = useState(false);
  const [sectionPreview, setSectionPreview] = useState<Section | null>(null);
  const lesson = c.lessons[li] ?? c.lessons[0];
  const setLesson = (fn: (l: Lesson) => Lesson) => setC({ ...c, lessons: c.lessons.map((l, i) => (i === li ? fn(l) : l)) });
  const setBlock = (bi: number, b: Block) => setLesson((l) => ({ ...l, blocks: l.blocks.map((x, i) => (i === bi ? b : x)) }));
  const moveBlock = (bi: number, dir: -1 | 1) => setLesson((l) => { const a = [...l.blocks]; const j = bi + dir; if (j < 0 || j >= a.length) return l; [a[bi], a[j]] = [a[j], a[bi]]; return { ...l, blocks: a }; });
  const dupBlock = (bi: number) => setLesson((l) => ({ ...l, blocks: l.blocks.flatMap((x, i) => (i === bi ? [x, JSON.parse(JSON.stringify(x)) as Block] : [x])) }));
  const delBlock = (bi: number) => setLesson((l) => ({ ...l, blocks: l.blocks.filter((_, i) => i !== bi) }));
  const addLesson = () => { setC({ ...c, lessons: [...c.lessons, { id: uid("l"), title: `Lesson ${c.lessons.length + 1}`, mins: 3, blocks: [{ k: "text", t: "…" }] }] }); setLi(c.lessons.length); };
  const quiz = c.quiz ?? [];
  const setQ = (qi: number, fn: (q: QuizQ) => QuizQ) => setC({ ...c, quiz: quiz.map((x, i) => (i === qi ? fn(x) : x)) });
  const addQ = () => setC({ ...c, quiz: [...quiz, { q: "", opts: ["", ""], a: 0, fb: "" }] });
  const delQ = (qi: number) => setC({ ...c, quiz: quiz.filter((_, i) => i !== qi) });
  const addSection = (s: Section) => { setLesson((l) => ({ ...l, blocks: [...l.blocks, ...s.blocks()] })); setSectionPreview(null); setAddOpen(false); if (tab !== "content") setTab("content"); };
  const pal = coursePaletteOf(c.theme);
  const themeVars = { "--accent": pal.accent, "--accent-2": pal.accent2, "--accent-soft": pal.soft, "--accent-grad": pal.grad, "--art-grad": pal.grad } as React.CSSProperties;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const previewBlocks = useMemo(() => (sectionPreview ? sectionPreview.blocks() : []), [sectionPreview]);

  // A true, fully-interactive preview — the real player, themed with the chosen palette.
  if (tab === "preview") return <CoursePlayer course={c} onClose={() => setTab("content")} />;

  // The section preview popup — renders the fully-built example exactly as a learner sees it.
  const sectionModal = sectionPreview && createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4" onClick={() => setSectionPreview(null)}>
      <div className="flex max-h-[90vh] w-[min(760px,96vw)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ ...LIGHT_PALETTE, ...themeVars }} onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-none items-center gap-3 border-b border-[var(--line)] px-5 py-3">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-xl text-[18px]" style={{ background: pal.soft }}>{sectionPreview.icon}</span>
          <div className="min-w-0"><div className="truncate text-[14px] font-extrabold text-[var(--ink)]">{sectionPreview.name}</div><div className="text-[11.5px] text-[var(--ink-3)]">{sectionPreview.group} · previewing exactly as learners see it</div></div>
          <button type="button" onClick={() => setSectionPreview(null)} className="ml-auto grid h-8 w-8 place-items-center rounded-full text-[16px] text-[var(--ink-3)] hover:bg-[var(--panel)]">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbfcfe] px-6 py-6">
          <article className="mx-auto max-w-[600px]">{previewBlocks.map((b, i) => <BlockView key={i} b={b} />)}</article>
        </div>
        <div className="flex flex-none items-center gap-2 border-t border-[var(--line)] px-5 py-3">
          <span className="text-[11.5px] text-[var(--ink-3)]">Adds {previewBlocks.length} block{previewBlocks.length === 1 ? "" : "s"} to the end of your lesson — stack as many sections as you like.</span>
          <div className="ml-auto flex gap-2"><Button onClick={() => setSectionPreview(null)}>Close</Button><Button variant="primary" onClick={() => addSection(sectionPreview)}>+ Add to Lesson {li + 1}</Button></div>
        </div>
      </div>
    </div>,
    document.body,
  );

  const header = (
    <div className="flex flex-none flex-wrap items-center gap-3 border-b border-[var(--line)] bg-white px-4 py-2.5 sm:px-6">
      <div className="text-[14px] font-extrabold text-[var(--ink)]">🎨 Course builder</div>
      <div className="mx-auto flex gap-0.5 rounded-full border border-[var(--line)] bg-[var(--panel)] p-0.5">
        {TABS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => { setTab(k); setAddOpen(false); }} className={"rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors " + (tab === k ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--ink-3)] hover:text-[var(--ink-2)]")}>{l}{k === "quiz" && quiz.length > 0 && <span className="ml-1 rounded-full bg-[#f3effe] px-1.5 text-[10px] font-extrabold text-[#6d28d9]">{quiz.length}</span>}</button>
        ))}
      </div>
      <div className="flex gap-2"><Button onClick={onCancel}>Cancel</Button><Button variant="primary" onClick={() => onSave(c)}>Save course</Button></div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[140] flex flex-col bg-[#f5f8fd]" style={{ ...LIGHT_PALETTE, ...themeVars }}>
      {header}

      {/* ——— DESIGN ——— */}
      {tab === "design" && (
        <main className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8">
          <div className="mx-auto grid max-w-[880px] gap-5">
            {/* live-themed hero preview */}
            <div className="overflow-hidden rounded-2xl border border-[var(--line)] shadow-sm">
              <CourseBanner pal={pal} styleId="bubbles" logo={c.logo} subtitle={`${c.cat} course`} title={c.title || "Untitled course"} pills={<>
                {c.blurb && <div className="mt-1.5 max-w-[560px] text-[13.5px] leading-relaxed text-white/90">{c.blurb}</div>}
                <div className="mt-3.5 flex flex-wrap gap-2 text-[11.5px] font-bold text-white">
                  <span className="rounded-full bg-black/20 px-2.5 py-1">{c.lessons.length} lesson{c.lessons.length === 1 ? "" : "s"}</span>
                  <span className="rounded-full bg-black/20 px-2.5 py-1">{quiz.length} quiz question{quiz.length === 1 ? "" : "s"}</span>
                  <span className="rounded-full bg-black/20 px-2.5 py-1">~{c.lessons.reduce((s, l) => s + (l.mins || 0), 0)} min</span>
                </div>
              </>} />
            </div>

            {/* colour theme */}
            <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
              <h3 className="text-[13px] font-extrabold text-[var(--ink)]">Colour theme</h3>
              <p className="mb-3 text-[12px] text-[var(--ink-3)]">Pick a palette — it colours the whole course for your learners.</p>
              <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-8">
                {COURSE_PALETTES.map((p) => {
                  const on = (c.theme ?? COURSE_PALETTES[0].id) === p.id;
                  return (
                    <button key={p.id} type="button" title={p.name} onClick={() => setC({ ...c, theme: p.id })} className={"group flex flex-col items-center gap-1 rounded-xl border p-1.5 transition-all " + (on ? "border-transparent ring-2 ring-offset-1" : "border-[var(--line)] hover:border-[var(--ink-3)]")} style={on ? ({ "--tw-ring-color": p.accent } as React.CSSProperties) : undefined}>
                      <span className="h-9 w-full rounded-lg" style={{ background: p.grad }} />
                      <span className="truncate text-[10px] font-bold text-[var(--ink-3)]">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* course details */}
            <section className="grid gap-3 rounded-2xl border border-[var(--line)] bg-white p-4">
              <h3 className="text-[13px] font-extrabold text-[var(--ink)]">Course details</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Course title"><Input value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} className="w-full" /></Field>
                <Field label="How important is it?"><Select value={c.cat} onChange={(e) => setC({ ...c, cat: e.target.value as CourseDoc["cat"] })} className="w-full">{DIFFICULTY.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
              </div>
              <Field label="Category — pick one or type a new name"><Input list="aos-cat-suggest" value={c.category ?? ""} onChange={(e) => setC({ ...c, category: e.target.value })} placeholder="e.g. Safeguarding, or your own category" className="w-full" /><datalist id="aos-cat-suggest">{TOPIC_CATS.map(([, l]) => <option key={l} value={l} />)}</datalist></Field>
              <Field label="Certificate renews every"><Select value={c.renewMonths ?? 0} onChange={(e) => setC({ ...c, renewMonths: Number(e.target.value) })} className="w-full sm:w-56"><option value={0}>Never expires</option><option value={6}>6 months</option><option value={12}>12 months (annual)</option><option value={24}>2 years</option><option value={36}>3 years</option></Select><span className="mt-1 block text-[11px] text-[var(--ink-3)]">This sets the certificate’s expiry date (completed + this interval) and the default renewal reminder.</span></Field>
              <Field label="Short description" ai={<AiBtn value={c.blurb} hint={`write a short 1–2 sentence description for a training course titled "${c.title || "this course"}", shown on the course card`} onResult={(t) => setC({ ...c, blurb: t })} />}><TA rows={2} value={c.blurb} onChange={(e) => setC({ ...c, blurb: e.target.value })} placeholder="One or two sentences shown on the course card…" /></Field>
              <Field label="Company logo (optional)"><div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:border-[var(--accent)]">⬆ Upload logo<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setC({ ...c, logo: String(r.result) }); r.readAsDataURL(f); }} /></label>
                {c.logo && <img src={c.logo} alt="" className="h-8 w-auto rounded border border-[var(--line)] object-contain" />}
                {c.logo && <button type="button" onClick={() => setC({ ...c, logo: undefined })} className="text-[12px] font-semibold text-[var(--ink-3)] hover:text-[#c0392b]">Remove</button>}
              </div></Field>
            </section>

            {/* ready-made sections */}
            <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
              <h3 className="text-[13px] font-extrabold text-[var(--ink)]">Add a ready-made section</h3>
              <p className="mb-3 text-[12px] text-[var(--ink-3)]">Click a section to <b>preview a fully-built example</b>, then add it to <b>Lesson {li + 1} — {lesson.title}</b>. Sections stack onto the page, so mix and match as many as you like — just like the email builder.</p>
              {SECTION_GROUPS.map((grp) => {
                const items = SECTIONS.filter((s) => s.group === grp);
                if (!items.length) return null;
                return (
                  <div key={grp} className="mb-4 last:mb-0">
                    <div className="mb-2 flex items-center gap-2"><span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{grp}</span><span className="h-px flex-1 bg-[var(--line)]" /></div>
                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((s) => (
                        <div key={s.id} className="group flex items-start gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 transition-all hover:border-[var(--accent)] hover:shadow-md">
                          <button type="button" onClick={() => setSectionPreview(s)} className="grid h-9 w-9 flex-none place-items-center rounded-lg text-[18px]" style={{ background: pal.soft }} title="Preview this section">{s.icon}</button>
                          <div className="min-w-0 flex-1">
                            <button type="button" onClick={() => setSectionPreview(s)} className="block w-full text-left"><span className="block text-[12.5px] font-extrabold text-[var(--ink)]">{s.name}</span><span className="block text-[11px] leading-snug text-[var(--ink-3)]">{s.desc}</span></button>
                            <div className="mt-1.5 flex gap-1.5">
                              <button type="button" onClick={() => setSectionPreview(s)} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)] hover:border-[var(--accent)]">👁 Preview</button>
                              <button type="button" onClick={() => addSection(s)} className="rounded-md px-2 py-0.5 text-[10.5px] font-bold text-white" style={{ background: pal.accent }}>+ Add</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          </div>
        </main>
      )}

      {/* ——— CONTENT ——— */}
      {tab === "content" && (
        <div className="flex min-h-0 flex-1">
          <aside className="w-[248px] flex-none overflow-y-auto border-r border-[var(--line)] bg-white p-3">
            <div className="mb-1.5 flex items-center px-1"><span className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Lessons</span><button type="button" onClick={addLesson} className="ml-auto text-[12px] font-extrabold text-[var(--accent)] hover:underline">+ Add</button></div>
            {c.lessons.map((l, i) => (
              <div key={l.id} className={"mb-1 flex items-center gap-1 rounded-lg px-1 " + (i === li ? "bg-[var(--accent-soft)]" : "")}>
                <button type="button" onClick={() => setLi(i)} className={"flex-1 truncate px-2 py-2 text-left text-[12.5px] font-bold " + (l.hidden ? "text-[var(--ink-3)] line-through opacity-70" : i === li ? "text-[var(--accent)]" : "text-[var(--ink)]")}>{i + 1}. {l.title}{l.hidden && <span className="ml-1 rounded-full bg-[#eef1f6] px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-[#64748b] no-underline">Hidden</span>}</button>
                <button type="button" title={l.hidden ? "Hidden from learners — click to show" : "Hide from learners (keeps the content, doesn't delete it)"} aria-label={l.hidden ? `Show lesson ${i + 1} to learners` : `Hide lesson ${i + 1} from learners`} aria-pressed={l.hidden} onClick={() => setC({ ...c, lessons: c.lessons.map((x, idx) => (idx === i ? { ...x, hidden: !x.hidden } : x)) })} className={"px-1.5 text-[13px] " + (l.hidden ? "text-[#c0392b] hover:text-[#0f7a43]" : "text-[var(--ink-3)] hover:text-[var(--accent)]")}>{l.hidden ? "🚫" : "👁"}</button>
              </div>
            ))}
            <p className="mt-1 px-2 text-[10.5px] leading-snug text-[var(--ink-3)]">Use 👁 to hide a lesson from learners without deleting it.</p>
          </aside>
          <main className="min-w-0 flex-1 overflow-y-auto p-5">
            <div className="mx-auto max-w-[680px]">
              <div className="mb-3 grid grid-cols-[1fr_auto] gap-2">
                <Field label="Lesson title"><Input value={lesson.title} onChange={(e) => setLesson((l) => ({ ...l, title: e.target.value }))} className="w-full" /></Field>
                <Field label="Minutes"><Input type="number" min={1} value={lesson.mins} onChange={(e) => setLesson((l) => ({ ...l, mins: Number(e.target.value) }))} className="w-[80px]" /></Field>
              </div>
              <div className="flex flex-col gap-2.5">
                {lesson.blocks.map((b, bi) => { const m = blockMeta(b.k); return (
                  <div key={bi} className="rounded-xl border border-[var(--line)] bg-white p-3" style={{ borderLeft: `3px solid ${m.tint}` }}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide" style={{ background: m.tint + "18", color: m.tint }}>{m.icon} {m.label}</span>
                      <div className="ml-auto flex gap-0.5">
                        <button type="button" title="Move up" onClick={() => moveBlock(bi, -1)} className="px-1.5 text-[13px] text-[var(--ink-3)] hover:text-[var(--ink)]">↑</button>
                        <button type="button" title="Move down" onClick={() => moveBlock(bi, 1)} className="px-1.5 text-[13px] text-[var(--ink-3)] hover:text-[var(--ink)]">↓</button>
                        <button type="button" title="Duplicate" onClick={() => dupBlock(bi)} className="px-1.5 text-[13px] text-[var(--ink-3)] hover:text-[var(--accent)]">⧉</button>
                        <button type="button" title="Remove" onClick={() => delBlock(bi)} className="px-1.5 text-[13px] text-[var(--ink-3)] hover:text-[#c0392b]">🗑</button>
                      </div>
                    </div>
                    <BlockEditor b={b} onChange={(nb) => setBlock(bi, nb)} />
                  </div>
                ); })}
                {lesson.blocks.length === 0 && <p className="rounded-xl bg-[var(--panel)] px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">Empty lesson — add a block below, or apply a template from the Design tab.</p>}
              </div>
              <div className="relative mt-3">
                <button type="button" onClick={() => setAddOpen((v) => !v)} className="w-full rounded-xl border border-dashed border-[var(--line)] py-2.5 text-[13px] font-extrabold text-[var(--accent)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">+ Add to lesson</button>
                {addOpen && (
                  <div className="absolute inset-x-0 top-[46px] z-10 max-h-[460px] overflow-y-auto rounded-xl border border-[var(--line)] bg-white p-2 shadow-xl">
                    <div className="mb-1 px-1 text-[10px] font-extrabold uppercase tracking-wide text-[#6d28d9]">✨ Ready-made sections</div>
                    {SECTION_GROUPS.map((grp) => {
                      const items = SECTIONS.filter((s) => s.group === grp);
                      if (!items.length) return null;
                      return (
                        <div key={grp} className="mb-1.5">
                          <div className="mb-0.5 px-1 text-[9.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{grp}</div>
                          {items.map((s) => (
                            <div key={s.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--panel)]">
                              <span className="grid h-6 w-6 flex-none place-items-center rounded-lg text-[13px]" style={{ background: pal.soft }}>{s.icon}</span>
                              <div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-bold text-[var(--ink)]">{s.name}</div><div className="truncate text-[10.5px] text-[var(--ink-3)]">{s.desc}</div></div>
                              <button type="button" title="Preview" onClick={() => setSectionPreview(s)} className="flex-none rounded-md border border-[var(--line)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)] hover:border-[var(--accent)]">👁</button>
                              <button type="button" onClick={() => addSection(s)} className="flex-none rounded-md px-2 py-0.5 text-[10.5px] font-bold text-white" style={{ background: pal.accent }}>+ Add</button>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    <div className="my-2 flex items-center gap-2 px-1"><span className="h-px flex-1 bg-[var(--line)]" /><span className="text-[9.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">or a single block</span><span className="h-px flex-1 bg-[var(--line)]" /></div>
                    {BLOCK_GROUPS.map((g) => (
                      <div key={g.group} className="mb-1.5 last:mb-0">
                        <div className="mb-0.5 px-1 text-[9.5px] font-bold uppercase tracking-wide" style={{ color: g.tint }}>{g.group}</div>
                        <div className="grid grid-cols-2 gap-1">
                          {g.kinds.map((m) => (
                            <button key={m.k} type="button" onClick={() => { setLesson((ls) => ({ ...ls, blocks: [...ls.blocks, newBlock(m.k)] })); setAddOpen(false); }} className="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-[12.5px] font-semibold text-[var(--ink-2)] hover:bg-[var(--panel)]">
                              <span className="grid h-6 w-6 flex-none place-items-center rounded-lg text-[13px]" style={{ background: g.tint + "18", color: g.tint }}>{m.icon}</span>{m.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      )}

      {/* ——— QUIZ ——— */}
      {tab === "quiz" && (
        <main className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8">
          <div className="mx-auto max-w-[680px]">
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white p-4">
              <div className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#f3effe] text-[20px]">🎓</div>
              <div><div className="text-[15px] font-extrabold text-[var(--ink)]">Final quiz</div><div className="text-[12px] text-[var(--ink-3)]">Learners take this after finishing the lessons.</div></div>
              <div className="ml-auto"><Field label="Pass mark %"><Input type="number" min={1} max={100} value={c.pass ?? 80} onChange={(e) => setC({ ...c, pass: Number(e.target.value) })} className="w-[84px]" /></Field></div>
            </div>
            <div className="flex flex-col gap-2.5">
              {quiz.map((qq, qi) => (
                <div key={qi} className="rounded-xl border border-[var(--line)] bg-white p-3">
                  <div className="mb-2 flex items-center gap-2"><span className="rounded-full bg-[#f3effe] px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[#6d28d9]">Question {qi + 1}</span><button type="button" title="Remove question" onClick={() => delQ(qi)} className="ml-auto px-1.5 text-[13px] text-[var(--ink-3)] hover:text-[#c0392b]">🗑</button></div>
                  <div className="grid gap-2">
                    <Field label="Question" ai={<AiBtn value={qq.q} hint="write a clear final-quiz question that tests the key learning of this course" onResult={(t) => setQ(qi, (x) => ({ ...x, q: t }))} />}><TA rows={2} value={qq.q} onChange={(e) => setQ(qi, (x) => ({ ...x, q: e.target.value }))} placeholder="Ask a question…" /></Field>
                    <div><Lbl>Options — select the correct answer</Lbl>
                      {qq.opts.map((o, oi) => (
                        <div key={oi} className={"mb-1.5 flex items-center gap-2 rounded-lg border px-2 py-1 " + (qq.a === oi ? "border-[#8fd6a9] bg-[#f2fbf5]" : "border-[var(--line)] bg-[var(--surface)]")}>
                          <label className="flex flex-none cursor-pointer items-center gap-1 text-[11px] font-bold text-[var(--ink-2)]" title="Mark as the correct answer"><input type="radio" name={"quiz-" + qi} checked={qq.a === oi} onChange={() => setQ(qi, (x) => ({ ...x, a: oi }))} /> {qq.a === oi ? "✅" : ""}</label>
                          <Input value={o} onChange={(e) => setQ(qi, (x) => ({ ...x, opts: x.opts.map((y, j) => (j === oi ? e.target.value : y)) }))} placeholder={"Option " + (oi + 1)} className="w-full" />
                          <DelBtn onClick={() => setQ(qi, (x) => { const opts = x.opts.filter((_, j) => j !== oi); return { ...x, opts, a: Math.min(x.a, Math.max(opts.length - 1, 0)) }; })} />
                        </div>
                      ))}
                      <AddBtn onClick={() => setQ(qi, (x) => ({ ...x, opts: [...x.opts, ""] }))}>+ Add option</AddBtn>
                    </div>
                    <Field label="Feedback (optional)"><Input value={qq.fb ?? ""} onChange={(e) => setQ(qi, (x) => ({ ...x, fb: e.target.value }))} placeholder="Shown after they answer…" className="w-full" /></Field>
                  </div>
                </div>
              ))}
              {quiz.length === 0 && <p className="rounded-xl bg-[var(--panel)] px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">No questions yet — add your first below.</p>}
            </div>
            <button type="button" onClick={addQ} className="mt-3 w-full rounded-xl border border-dashed border-[var(--line)] py-2.5 text-[13px] font-extrabold text-[#6d28d9] hover:border-[#6d28d9] hover:bg-[#f3effe]">+ Add question</button>
          </div>
        </main>
      )}

      {sectionModal}
    </div>
  );
}
