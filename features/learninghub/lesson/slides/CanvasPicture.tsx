"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui";
import { ImageField } from "../../quiz/ImageField";
import type { Pic as UploadPic } from "../../shared-assess/api";
import { Modal } from "../../shared-assess/ui";
import { FOCUS } from "../../shared-assess/ui";
import { Btn } from "../lessonUi";
import { loadLib, type Lib } from "./SlideArt";
import type { CanvasBlock, CanvasEl, CanvasImg } from "./types";

// Tutor preview only: change ONE picture of a canvas slide (a real Oak slide) — or add another. Same three routes as the summary
// slides' SlidePicture dialog: Remove it, Replace / Add from the tutor's computer (the private hub upload every question picture
// uses — alt text required, big photos are shrunk in the browser), or from the verified picture library (search by name).
// Every other element of the slide (the text, the other pictures) stays exactly as it is. Saved through the deck's PATCH.

export type PictureTarget = { mode: "replace"; index: number } | { mode: "add" };
type Mode = "menu" | "upload" | "library";

/** Natural aspect ratio (w/h) of an image URL, or 4/3 when it can't be measured. */
function aspectOf(url: string | undefined): Promise<number> {
  return new Promise((resolve) => {
    if (!url) { resolve(4 / 3); return; }
    const im = new Image();
    im.onload = () => resolve(im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 4 / 3);
    im.onerror = () => resolve(4 / 3);
    im.src = url;
  });
}

/** Where a NEW picture goes: centred, a third of the slide wide (never taller than 60%), on top of everything. */
function fresh(block: CanvasBlock, aspect: number): Pick<CanvasImg, "x" | "y" | "w" | "h"> {
  let w = 0.32, h = (w * block.w) / aspect / block.h;
  if (h > 0.6) { h = 0.6; w = (h * block.h * aspect) / block.w; }
  return { x: Math.round(((1 - w) / 2) * 10000) / 10000, y: Math.round(((1 - h) / 2) * 10000) / 10000, w: Math.round(w * 10000) / 10000, h: Math.round(h * 10000) / 10000 };
}

export function CanvasPicture({ block, target, onSave, onClose }: { block: CanvasBlock; target: PictureTarget; onSave: (els: CanvasEl[]) => Promise<void>; onClose: () => void }) {
  const current = target.mode === "replace" ? block.els[target.index] : undefined;
  const cur = current && current.k === "img" ? current : undefined;
  const [mode, setMode] = useState<Mode>(target.mode === "add" ? "menu" : "menu");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadPic | null>(null);
  const [alt, setAlt] = useState("");
  const [altErr, setAltErr] = useState(false);
  const [lib, setLib] = useState<Lib | null>(null);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "library" || lib) return;
    let live = true;
    loadLib().then((l) => { if (live) setLib(l); }).catch(() => { if (live) setErr("The picture library couldn’t load."); });
    return () => { live = false; };
  }, [mode, lib]);
  const results = useMemo(() => {
    if (!lib) return [];
    const needle = q.trim().toLowerCase();
    const list = needle ? lib.all.filter((p) => p.title.toLowerCase().includes(needle) || p.id.includes(needle) || p.caption.toLowerCase().includes(needle) || p.concepts.some((c) => c.includes(needle))) : lib.all;
    return list.slice(0, 48);
  }, [lib, q]);

  const save = async (els: CanvasEl[]) => {
    setBusy(true); setErr(null);
    try { await onSave(els); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t save"); setBusy(false); }
  };
  /** Put `src` in place: the replaced picture's box (position, size, rotation, reveal step) or a fresh one. */
  const place = async (src: Partial<CanvasImg> & { alt: string }, aspect: number): Promise<CanvasEl[]> => {
    if (target.mode === "replace" && cur) {
      const { x, y, w, h, rot, step } = cur;
      const el: CanvasImg = { k: "img", x, y, w, h, ...(rot ? { rot } : {}), ...(step ? { step } : {}), ...src };
      return block.els.map((e, i) => (i === target.index ? el : e));
    }
    return [...block.els, { k: "img", ...fresh(block, aspect), ...src } as CanvasImg];
  };
  const useUpload = async () => {
    if (!upload?.id) { setErr("Choose a picture first."); return; }
    if (!alt.trim()) { setAltErr(true); setErr("Describe the picture so a child using a screen reader isn’t left with a blank."); return; }
    setBusy(true);
    const els = await place({ alt: alt.trim(), imageId: upload.id, ...(upload.url ? { url: upload.url } : {}) }, await aspectOf(upload.url));
    setBusy(false);
    void save(els);
  };
  const useLibrary = async () => {
    const p = pick ? lib?.byId[pick] : undefined;
    if (!p) { setErr("Choose a picture first."); return; }
    const vb = p.svg.match(/viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"/);
    void save(await place({ alt: p.alt, picId: p.id }, vb ? Number(vb[1]) / Number(vb[2]) : 4 / 3));
  };

  const tile = `${FOCUS} flex flex-col items-center gap-1 rounded-2xl border-2 border-[var(--line)] bg-[var(--surface)] p-2 text-center hover:border-[var(--brand-2)]`;
  const footer = mode === "upload"
    ? <><Btn tone="ghost" onClick={() => setMode("menu")}>Back</Btn><Btn onClick={() => void useUpload()} disabled={busy || !upload} data-testid="canvas-picture-save-upload">{busy ? "Saving…" : "Use this picture"}</Btn></>
    : mode === "library"
      ? <><Btn tone="ghost" onClick={() => setMode("menu")}>Back</Btn><Btn onClick={() => void useLibrary()} disabled={busy || !pick} data-testid="canvas-picture-save-library">{busy ? "Saving…" : "Use this picture"}</Btn></>
      : <Btn tone="ghost" onClick={onClose}>Cancel</Btn>;

  return (
    <Modal title={target.mode === "add" ? "Add a picture" : "Change this picture"} onClose={onClose} wide footer={footer} id="canvas-picture">
      {mode === "menu" && (
        <div className="grid gap-3">
          <p className="m-0 text-[13px] text-[var(--ink-2)]">
            {target.mode === "add" ? "The new picture goes in the middle of the slide. Everything else on the slide stays as it is." : cur?.alt ? `Now: “${cur.alt}”. The slide’s words and its other pictures stay exactly as they are.` : "The slide’s words and its other pictures stay exactly as they are."}
          </p>
          {cur && (cur.url || cur.picId) && (
            <div className="mx-auto flex max-h-[180px] w-full max-w-[280px] items-center justify-center overflow-hidden rounded-xl border border-[var(--line)] bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {cur.url ? <img src={cur.url} alt={cur.alt} className="max-h-[164px] w-auto object-contain" /> : <span className="text-[12px] text-[var(--ink-3)]">Library picture</span>}
            </div>
          )}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Picture actions">
            <Btn tone="ghost" onClick={() => setMode("upload")} data-testid="canvas-picture-upload">⬆️ {target.mode === "add" ? "Upload a picture" : "Replace with my own picture"}</Btn>
            <Btn tone="ghost" onClick={() => setMode("library")} data-testid="canvas-picture-library">📚 {target.mode === "add" ? "Pick from the picture library" : "Replace from the picture library"}</Btn>
            {target.mode === "replace" && <Btn tone="ghost" onClick={() => void save(block.els.filter((_, i) => i !== target.index))} disabled={busy} className="!text-[var(--red)]" data-testid="canvas-picture-remove">🗑 Remove picture</Btn>}
          </div>
        </div>
      )}
      {mode === "upload" && (
        <div className="grid gap-2">
          <p className="m-0 text-[13px] text-[var(--ink-2)]">PNG, JPEG or WebP from your computer. Big photos are shrunk for you.</p>
          <ImageField value={upload} alt={alt} onPic={(p) => { setUpload(p); setErr(null); }} onAlt={(a) => { setAlt(a); setAltErr(false); }} altError={altErr} />
        </div>
      )}
      {mode === "library" && (
        <div className="grid gap-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pictures by name, e.g. triangle, plant cell, fraction" aria-label="Search the picture library" autoFocus className="min-h-[44px] w-full" data-testid="canvas-picture-search" />
          {lib && <style>{lib.css}</style>}
          {!lib ? <p className="m-0 text-[13px] text-[var(--ink-3)]">Loading the picture library…</p>
            : !results.length ? <p className="m-0 text-[13px] text-[var(--ink-3)]">No pictures match “{q}”.</p>
              : (
                <ul className="m-0 grid max-h-[50vh] list-none grid-cols-2 gap-2 overflow-auto p-0 sm:grid-cols-3 md:grid-cols-4" aria-label="Library pictures">
                  {results.map((p) => (
                    <li key={p.id}>
                      <button type="button" aria-pressed={pick === p.id} title={p.alt} data-testid="canvas-picture-lib-pic" data-pic={p.id} onClick={() => setPick(p.id)}
                        className={`${tile} w-full ${pick === p.id ? "!border-[var(--brand)] bg-[var(--brand-soft)]" : ""}`}>
                        <span aria-hidden="true" className="w-full text-[var(--ink)]" dangerouslySetInnerHTML={{ __html: p.svg }} />
                        <span className="text-[12px] font-extrabold leading-tight text-[var(--ink)]">{p.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
        </div>
      )}
      {err && <p role="alert" className="m-0 mt-3 text-[13px] font-bold text-[var(--red)]">{err}</p>}
    </Modal>
  );
}
