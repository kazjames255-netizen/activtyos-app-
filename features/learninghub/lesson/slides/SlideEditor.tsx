"use client";

import { useMemo, useState } from "react";
import { Modal } from "../../shared-assess/ui";
import { Btn } from "../lessonUi";
import type { Slide } from "./types";

// A tutor's editor for ONE slide, opened from the lesson preview: every piece of text on the slide (title, paragraphs, list
// items, card captions, questions, options, hints…) becomes a field. Only text changes — structure and the right answers
// stay as they are, so an edit can't break an activity. Inline markup: {highlight} and **bold**.

type Path = (string | number)[];
interface Field { path: Path; value: string; label: string; long: boolean }

const SKIP = new Set(["t", "kind", "answer", "col", "art", "pics", "image", "artLock", "emoji"]);
const NICE: Record<string, string> = { text: "Text", q: "Question", why: "Explanation", term: "Word", def: "Meaning", root: "Root word", add: "Ending", result: "Result", note: "Note", word: "Word", words: "Word", tips: "Reminder", title: "Title", sub: "Caption", label: "Button label", emoji: "Emoji", a: "Left", b: "Right", items: "Item", options: "Option", columns: "Column", chunks: "Chunk", pairs: "Pair" };

function collect(node: unknown, path: Path, out: Field[], block: string) {
  if (typeof node === "string") {
    const key = [...path].reverse().find((k) => typeof k === "string") as string | undefined;
    const n = typeof path[path.length - 1] === "number" ? ` ${(path[path.length - 1] as number) + 1}` : "";
    out.push({ path, value: node, label: `${block ? block + " · " : ""}${NICE[key ?? ""] ?? key ?? "Text"}${n}`, long: node.length > 60 || key === "text" || key === "def" || key === "why" });
    return;
  }
  if (Array.isArray(node)) { node.forEach((v, i) => collect(v, [...path, i], out, block)); return; }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) if (!SKIP.has(k)) collect(v, [...path, k], out, block);
  }
}
function setAt<T>(root: T, path: Path, value: string): T {
  if (!path.length) return value as unknown as T;
  const [h, ...rest] = path;
  if (Array.isArray(root)) return root.map((v, i) => (i === h ? setAt(v, rest, value) : v)) as unknown as T;
  return { ...(root as Record<string, unknown>), [h as string]: setAt((root as Record<string, unknown>)[h as string], rest, value) } as T;
}

const BLOCK_NAME: Record<string, string> = { text: "Paragraph", lead: "Big text", callout: "Highlight box", list: "List", chips: "Word chips", cards: "Picture cards", define: "Key words", formula: "Word builder", reveal: "Reveal", roots: "Root words", choice: "Question", choices: "Questions", sort: "Sorting", match: "Matching", spell: "Spelling", lcwc: "Look-cover-write-check", clap: "Clap it" };

export function SlideEditor({ slide, onSave, onClose }: { slide: Slide; onSave: (s: Slide) => Promise<void>; onClose: () => void }) {
  const [draft, setDraft] = useState<Slide>(slide);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fields = useMemo(() => {
    const out: Field[] = [];
    collect(draft.title, ["title"], out, "Slide");
    draft.blocks.forEach((b, i) => collect(b, ["blocks", i], out, BLOCK_NAME[b.t] ?? b.t));
    return out;
  }, [draft]);
  const get = (path: Path): string => { let n: unknown = draft; for (const k of path) n = (n as Record<string | number, unknown>)[k]; return String(n ?? ""); };
  const save = async () => {
    setBusy(true); setErr(null);
    try { await onSave(draft); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t save"); setBusy(false); }
  };
  return (
    <Modal title="Edit this slide" onClose={onClose} wide
      footer={<><Btn tone="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save} disabled={busy} data-testid="slide-edit-save">{busy ? "Saving…" : "Save changes"}</Btn></>}>
      <p className="m-0 mb-3 text-[13px] text-[var(--ink-2)]">Change any wording. Use <b>{"{curly brackets}"}</b> to colour part of a word and <b>**two stars**</b> for bold. The right answers stay as they are.</p>
      <div className="grid gap-2.5">
        {fields.map((f) => (
          <label key={f.path.join(".")} className="block">
            <span className="mb-1 block text-[11.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">{f.label}</span>
            {f.long
              ? <textarea rows={Math.min(5, Math.max(2, Math.ceil(f.value.length / 70)))} value={get(f.path)} onChange={(e) => setDraft((d) => setAt(d, f.path, e.target.value))} className="w-full rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--brand-2)]" />
              : <input value={get(f.path)} onChange={(e) => setDraft((d) => setAt(d, f.path, e.target.value))} className="min-h-[40px] w-full rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-3 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--brand-2)]" />}
          </label>
        ))}
      </div>
      {err && <p role="alert" className="m-0 mt-3 text-[13px] font-bold text-[var(--red)]">{err}</p>}
    </Modal>
  );
}
