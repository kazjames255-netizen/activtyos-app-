"use client";

import { useT } from "@/lib/i18n/provider";
import { useMemo, useState } from "react";
import { Modal } from "../../shared-assess/ui";
import { rich } from "../tRich";
import { Btn } from "../lessonUi";
import type { Slide } from "./types";

// A tutor's editor for ONE slide, opened from the lesson preview: every piece of text on the slide (title, paragraphs, list
// items, card captions, questions, options, hints…) becomes a field. Only text changes — structure and the right answers
// stay as they are, so an edit can't break an activity. Inline markup: {highlight} and **bold**.

type Path = (string | number)[];
interface Field { path: Path; value: string; label: string; long: boolean }

const SKIP = new Set(["t", "kind", "answer", "col", "art", "pics", "image", "artLock", "emoji"]);
/** i18n KEYS for a field's name. */
const NICE: Record<string, string> = { text: "hublessons.sfText", q: "hublessons.sfQuestion", why: "hublessons.sfExplanation", term: "hublessons.sfWord", def: "hublessons.sfMeaning", root: "hublessons.sfRoot", add: "hublessons.sfEnding", result: "hublessons.sfResult", note: "hublessons.sfNote", word: "hublessons.sfWord", words: "hublessons.sfWord", tips: "hublessons.sfReminder", title: "hublessons.sfTitle", sub: "hublessons.sfCaption", label: "hublessons.sfButtonLabel", emoji: "hublessons.sfEmoji", a: "hublessons.sfLeft", b: "hublessons.sfRight", items: "hublessons.sfItem", options: "hublessons.sfOption", columns: "hublessons.sfColumn", chunks: "hublessons.sfChunk", pairs: "hublessons.sfPair" };

function collect(node: unknown, path: Path, out: Field[], block: string, t: (k: string) => string) {
  if (typeof node === "string") {
    const key = [...path].reverse().find((k) => typeof k === "string") as string | undefined;
    const n = typeof path[path.length - 1] === "number" ? ` ${(path[path.length - 1] as number) + 1}` : "";
    out.push({ path, value: node, label: `${block ? block + " · " : ""}${NICE[key ?? ""] ? t(NICE[key ?? ""]!) : key ?? t("hublessons.sfText")}${n}`, long: node.length > 60 || key === "text" || key === "def" || key === "why" });
    return;
  }
  if (Array.isArray(node)) { node.forEach((v, i) => collect(v, [...path, i], out, block, t)); return; }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) if (!SKIP.has(k)) collect(v, [...path, k], out, block, t);
  }
}
function setAt<T>(root: T, path: Path, value: string): T {
  if (!path.length) return value as unknown as T;
  const [h, ...rest] = path;
  if (Array.isArray(root)) return root.map((v, i) => (i === h ? setAt(v, rest, value) : v)) as unknown as T;
  return { ...(root as Record<string, unknown>), [h as string]: setAt((root as Record<string, unknown>)[h as string], rest, value) } as T;
}

/** i18n KEYS for a block's name. */
const BLOCK_NAME: Record<string, string> = { text: "hublessons.sbParagraph", lead: "hublessons.sbBigText", callout: "hublessons.sbHighlight", list: "hublessons.sbList", chips: "hublessons.sbChips", cards: "hublessons.sbCards", define: "hublessons.keyWordsTag", formula: "hublessons.sbFormula", reveal: "hublessons.sbReveal", roots: "hublessons.sbRoots", choice: "hublessons.sfQuestion", choices: "hublessons.sbQuestions", sort: "hublessons.sbSorting", match: "hublessons.sbMatching", spell: "hublessons.sbSpelling", lcwc: "hublessons.sbLcwc", clap: "hublessons.bkClapIt" };

export function SlideEditor({ slide, onSave, onClose }: { slide: Slide; onSave: (s: Slide) => Promise<void>; onClose: () => void }) {
  const t = useT();
  const [draft, setDraft] = useState<Slide>(slide);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fields = useMemo(() => {
    const out: Field[] = [];
    collect(draft.title, ["title"], out, t("hublessons.sbSlide"), t);
    draft.blocks.forEach((b, i) => collect(b, ["blocks", i], out, BLOCK_NAME[b.t] ? t(BLOCK_NAME[b.t]!) : b.t, t));
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, t]);
  const get = (path: Path): string => { let n: unknown = draft; for (const k of path) n = (n as Record<string | number, unknown>)[k]; return String(n ?? ""); };
  const save = async () => {
    setBusy(true); setErr(null);
    try { await onSave(draft); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : t("hublessons.sdCouldntSave")); setBusy(false); }
  };
  return (
    <Modal title={t("hublessons.sdEditSlide")} onClose={onClose} wide
      footer={<><Btn tone="ghost" onClick={onClose}>{t("hublessons.cancel")}</Btn><Btn onClick={save} disabled={busy} data-testid="slide-edit-save">{busy ? t("hublessons.saving") : t("hublessons.sdSaveChanges")}</Btn></>}>
      <p className="m-0 mb-3 text-[13px] text-[var(--ink-2)]">{rich(t("hublessons.seHelp"), { curly: <b>{"{ }"}</b>, stars: <b>**</b> })}</p>
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
