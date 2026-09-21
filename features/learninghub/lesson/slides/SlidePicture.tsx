"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui";
import { ImageField } from "../../quiz/ImageField";
import type { Pic as UploadPic } from "../../shared-assess/api";
import { FOCUS, Modal } from "../../shared-assess/ui";
import { Btn } from "../lessonUi";
import { SlideArt, hasArt, loadLib, type Lib } from "./SlideArt";
import type { Slide } from "./types";

// Tutor preview only: the picture of ONE slide. Remove it (the slide keeps its text and the factory never re-adds art: `artLock`),
// replace / add one from the tutor's computer (the same private hub upload as a question picture — alt text required) or from the
// verified picture library (search by name; only library ids are ever stored). Saved through the deck's PATCH like a text edit.

type Mode = "menu" | "upload" | "library";

/** The slide with its art cleared and locked, ready for a new picture (or none). */
const cleared = (s: Slide): Slide => { const { art: _a, pics: _p, image: _i, ...rest } = s; void _a; void _p; void _i; return { ...rest, artLock: true }; };

function describe(s: Slide): string {
  if (s.image) return s.image.alt ? `Your picture: “${s.image.alt}”` : "Your picture";
  if (s.pics?.length) return `${s.pics.length === 1 ? "A library picture" : `${s.pics.length} library pictures`}`;
  if (s.art?.length) return "Emoji art";
  return "No picture";
}

export function SlidePicture({ slide, tint, onSave, onClose }: { slide: Slide; tint: [string, string]; onSave: (s: Slide) => Promise<void>; onClose: () => void }) {
  const [draft, setDraft] = useState<Slide>(slide);
  const [mode, setMode] = useState<Mode>("menu");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadPic | null>(null);
  const [alt, setAlt] = useState("");
  const [altErr, setAltErr] = useState(false);
  const [lib, setLib] = useState<Lib | null>(null);
  const [q, setQ] = useState("");

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

  const changed = draft !== slide;
  const save = async (s: Slide) => {
    setBusy(true); setErr(null);
    try { await onSave(s); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t save"); setBusy(false); }
  };
  const saveUpload = () => {
    if (!upload?.id) { setErr("Choose a picture first."); return; }
    if (!alt.trim()) { setAltErr(true); setErr("Describe the picture so a child using a screen reader isn’t left with a blank."); return; }
    void save({ ...cleared(slide), image: { id: upload.id, alt: alt.trim(), ...(upload.url ? { url: upload.url } : {}) } });
  };

  const tile = `${FOCUS} flex flex-col items-center gap-1 rounded-2xl border-2 border-[var(--line)] bg-[var(--surface)] p-2 text-center hover:border-[var(--brand-2)]`;
  const footer = mode === "upload"
    ? <><Btn tone="ghost" onClick={() => setMode("menu")}>Back</Btn><Btn onClick={saveUpload} disabled={busy || !upload} data-testid="slide-picture-save-upload">{busy ? "Saving…" : "Use this picture"}</Btn></>
    : mode === "library"
      ? <><Btn tone="ghost" onClick={() => setMode("menu")}>Back</Btn><Btn onClick={() => void save(draft)} disabled={busy || !changed || !draft.pics?.length} data-testid="slide-picture-save-library">{busy ? "Saving…" : "Use this picture"}</Btn></>
      : <><Btn tone="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={() => void save(draft)} disabled={busy || !changed} data-testid="slide-picture-save">{busy ? "Saving…" : "Save changes"}</Btn></>;

  return (
    <Modal title={hasArt(slide) ? "Change the picture" : "Add a picture"} onClose={onClose} wide footer={footer} id="slide-picture">
      {mode === "menu" && (
        <div className="grid gap-3">
          <p className="m-0 text-[13px] text-[var(--ink-2)]">{describe(draft)}{changed && !hasArt(draft) ? " (will be removed when you save)" : ""}. The slide’s words stay exactly as they are.</p>
          {hasArt(draft) && <div className="mx-auto w-full max-w-[300px]"><SlideArt slide={draft} tint={tint} /></div>}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Picture actions">
            <Btn tone="ghost" onClick={() => setMode("upload")} data-testid="slide-picture-upload">⬆️ {hasArt(draft) ? "Replace with my own picture" : "Upload a picture"}</Btn>
            <Btn tone="ghost" onClick={() => setMode("library")} data-testid="slide-picture-library">📚 {hasArt(draft) ? "Replace from the picture library" : "Pick from the picture library"}</Btn>
            {hasArt(draft) && <Btn tone="ghost" onClick={() => setDraft(cleared(slide))} className="!text-[var(--red)]" data-testid="slide-picture-remove">🗑 Remove picture</Btn>}
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
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pictures by name, e.g. triangle, plant cell, fraction" aria-label="Search the picture library" autoFocus className="min-h-[44px] w-full" data-testid="slide-picture-search" />
          {lib && <style>{lib.css}</style>}
          {!lib ? <p className="m-0 text-[13px] text-[var(--ink-3)]">Loading the picture library…</p>
            : !results.length ? <p className="m-0 text-[13px] text-[var(--ink-3)]">No pictures match “{q}”.</p>
              : (
                <ul className="m-0 grid max-h-[50vh] list-none grid-cols-2 gap-2 overflow-auto p-0 sm:grid-cols-3 md:grid-cols-4" aria-label="Library pictures">
                  {results.map((p) => {
                    const on = draft.pics?.length === 1 && draft.pics[0]!.id === p.id && !draft.image;
                    return (
                      <li key={p.id}>
                        <button type="button" aria-pressed={on} title={p.alt} data-testid="slide-picture-lib-pic" data-pic={p.id}
                          onClick={() => setDraft({ ...cleared(slide), pics: [{ id: p.id }] })}
                          className={`${tile} w-full ${on ? "!border-[var(--brand)] bg-[var(--brand-soft)]" : ""}`}>
                          <span aria-hidden="true" className="w-full text-[var(--ink)]" dangerouslySetInnerHTML={{ __html: p.svg }} />
                          <span className="text-[12px] font-extrabold leading-tight text-[var(--ink)]">{p.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
          {lib && results.length === 48 && <p className="m-0 text-[12px] text-[var(--ink-3)]">Showing the first 48 — type to narrow it down.</p>}
        </div>
      )}
      {err && <p role="alert" className="m-0 mt-3 text-[13px] font-bold text-[var(--red)]">{err}</p>}
    </Modal>
  );
}
