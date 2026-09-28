"use client";

import { useT } from "@/lib/i18n/provider";
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

function describe(s: Slide, t: (k: string, v?: Record<string, string | number>) => string): string {
  if (s.image) return s.image.alt ? t("hublessons.pcYourPictureAlt", { alt: s.image.alt }) : t("hublessons.pcYourPicture");
  if (s.pics?.length) return s.pics.length === 1 ? t("hublessons.pcLibOne") : t("hublessons.pcLibMany", { n: s.pics.length });
  if (s.art?.length) return t("hublessons.pcEmojiArt");
  return t("hublessons.pcNoPicture");
}

export function SlidePicture({ slide, tint, onSave, onClose }: { slide: Slide; tint: [string, string]; onSave: (s: Slide) => Promise<void>; onClose: () => void }) {
  const t = useT();
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
    loadLib().then((l) => { if (live) setLib(l); }).catch(() => { if (live) setErr(t("hublessons.pcCouldntLoadLib")); });
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
    try { await onSave(s); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : t("hublessons.sdCouldntSave")); setBusy(false); }
  };
  const saveUpload = () => {
    if (!upload?.id) { setErr(t("hublessons.pcChooseFirst")); return; }
    if (!alt.trim()) { setAltErr(true); setErr(t("hublessons.pcAltRequired")); return; }
    void save({ ...cleared(slide), image: { id: upload.id, alt: alt.trim(), ...(upload.url ? { url: upload.url } : {}) } });
  };

  const tile = `${FOCUS} flex flex-col items-center gap-1 rounded-2xl border-2 border-[var(--line)] bg-[var(--surface)] p-2 text-center hover:border-[var(--brand-2)]`;
  const footer = mode === "upload"
    ? <><Btn tone="ghost" onClick={() => setMode("menu")}>{t("hublessons.back")}</Btn><Btn onClick={saveUpload} disabled={busy || !upload} data-testid="slide-picture-save-upload">{busy ? t("hublessons.saving") : t("hublessons.pcUsePicture")}</Btn></>
    : mode === "library"
      ? <><Btn tone="ghost" onClick={() => setMode("menu")}>{t("hublessons.back")}</Btn><Btn onClick={() => void save(draft)} disabled={busy || !changed || !draft.pics?.length} data-testid="slide-picture-save-library">{busy ? t("hublessons.saving") : t("hublessons.pcUsePicture")}</Btn></>
      : <><Btn tone="ghost" onClick={onClose}>{t("hublessons.cancel")}</Btn><Btn onClick={() => void save(draft)} disabled={busy || !changed} data-testid="slide-picture-save">{busy ? t("hublessons.saving") : t("hublessons.sdSaveChanges")}</Btn></>;

  return (
    <Modal title={hasArt(slide) ? t("hublessons.pcChangeThe") : t("hublessons.pcAddA")} onClose={onClose} wide footer={footer} id="slide-picture">
      {mode === "menu" && (
        <div className="grid gap-3">
          <p className="m-0 text-[13px] text-[var(--ink-2)]">{changed && !hasArt(draft) ? t("hublessons.pcMenuNoteRemoved", { what: describe(draft, t) }) : t("hublessons.pcMenuNote", { what: describe(draft, t) })}</p>
          {hasArt(draft) && <div className="mx-auto w-full max-w-[300px]"><SlideArt slide={draft} tint={tint} /></div>}
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("hublessons.pcPictureActions")}>
            <Btn tone="ghost" onClick={() => setMode("upload")} data-testid="slide-picture-upload">{hasArt(draft) ? t("hublessons.pcReplaceOwn") : t("hublessons.pcUpload")}</Btn>
            <Btn tone="ghost" onClick={() => setMode("library")} data-testid="slide-picture-library">{hasArt(draft) ? t("hublessons.pcReplaceLib") : t("hublessons.pcPickLib")}</Btn>
            {hasArt(draft) && <Btn tone="ghost" onClick={() => setDraft(cleared(slide))} className="!text-[var(--red)]" data-testid="slide-picture-remove">{t("hublessons.pcRemove")}</Btn>}
          </div>
        </div>
      )}
      {mode === "upload" && (
        <div className="grid gap-2">
          <p className="m-0 text-[13px] text-[var(--ink-2)]">{t("hublessons.pcUploadHelp")}</p>
          <ImageField value={upload} alt={alt} onPic={(p) => { setUpload(p); setErr(null); }} onAlt={(a) => { setAlt(a); setAltErr(false); }} altError={altErr} />
        </div>
      )}
      {mode === "library" && (
        <div className="grid gap-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("hublessons.pcSearchPh")} aria-label={t("hublessons.pcSearchAria")} autoFocus className="min-h-[44px] w-full" data-testid="slide-picture-search" />
          {lib && <style>{lib.css}</style>}
          {!lib ? <p className="m-0 text-[13px] text-[var(--ink-3)]">{t("hublessons.pcLoadingLib")}</p>
            : !results.length ? <p className="m-0 text-[13px] text-[var(--ink-3)]">{t("hublessons.pcNoMatch", { q })}</p>
              : (
                <ul className="m-0 grid max-h-[50vh] list-none grid-cols-2 gap-2 overflow-auto p-0 sm:grid-cols-3 md:grid-cols-4" aria-label={t("hublessons.pcLibPictures")}>
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
          {lib && results.length === 48 && <p className="m-0 text-[12px] text-[var(--ink-3)]">{t("hublessons.pcFirst48")}</p>}
        </div>
      )}
      {err && <p role="alert" className="m-0 mt-3 text-[13px] font-bold text-[var(--red)]">{err}</p>}
    </Modal>
  );
}
