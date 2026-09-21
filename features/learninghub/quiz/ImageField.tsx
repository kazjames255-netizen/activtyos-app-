"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FieldLabel, Input } from "@/components/ui";
import { Icon } from "../kit";
import type { Pic } from "../shared-assess/api";
import { fmtKb, IMAGE_ACCEPT, imageFrom, MAX_IMAGE_BYTES, prepareImage, uploadHubImage } from "../shared-assess/imageUtil";
import { Lightbox } from "../shared-assess/QuestionImage";
import { errMsg } from "../types";
import { FOCUS, TAP } from "../shared-assess/ui";

// The picture slot on a question (and, compact, on each answer option). Drag a file
// on, paste one, or pick one: it is shrunk in the browser to fit the 750 KB limit,
// uploaded as a private hub file and attached by id. Alt text is REQUIRED for the
// question picture so a child using a screen reader isn't left with a blank.

/** Shared uploader: handles the shrink → upload steps and reports friendly errors. */
export function useImageUpload(onDone: (p: Pic) => void) {
  const [busy, setBusy] = useState<null | "shrinking" | "uploading">(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const run = async (file: Blob) => {
    setError(null); setNote(null); setBusy("shrinking");
    try {
      const prep = await prepareImage(file);
      setBusy("uploading");
      const up = await uploadHubImage(prep.dataUrl);
      setNote(prep.resized ? `Shrunk to ${fmtKb(prep.bytes)} so it fits.` : null);
      onDone({ id: up.id, url: up.url });
    } catch (e) {
      setError(errMsg(e, `Couldn't add that picture (limit ${fmtKb(MAX_IMAGE_BYTES)}).`));
    } finally { setBusy(null); }
  };
  return { busy, error, note, setError, run };
}

export function ImageField({ value, alt, onPic, onAlt, altError, pasted, onPastedTaken }: {
  value: Pic | null; alt: string; onPic: (p: Pic | null) => void; onAlt: (a: string) => void; altError?: boolean;
  /** A file pasted anywhere in the form; picked up once, then acknowledged. */
  pasted?: File | null; onPastedTaken?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [zoom, setZoom] = useState(false);
  const altId = useId();
  const up = useImageUpload((p) => onPic(p));
  useEffect(() => { if (pasted) { void up.run(pasted); onPastedTaken?.(); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasted]);
  const pick = () => inputRef.current?.click();
  const take = (f: File | null | undefined) => { if (f) void up.run(f); };

  return (
    <div data-testid="hub-image-field">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Picture <span className="normal-case tracking-normal">· optional</span></span>
      </div>
      <input ref={inputRef} type="file" accept={IMAGE_ACCEPT} className="sr-only" tabIndex={-1} aria-label="Choose a picture file" data-testid="hub-image-input"
        onChange={(e) => { take(e.target.files?.[0]); e.target.value = ""; }} />

      {!value ? (
        <button type="button" onClick={pick} disabled={!!up.busy}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); take(imageFrom(e.dataTransfer)); }}
          className={`flex min-h-[112px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-5 text-center transition-colors ${FOCUS} ${over ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-[var(--panel)] hover:border-[var(--brand)]"}`}>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface)] text-[var(--brand)] shadow-[var(--shadow-sm)]"><Icon name={up.busy ? "sparkle" : "image"} size={20} strokeWidth={1.8} /></span>
          <span className="text-[13px] font-extrabold text-[var(--ink)]">{up.busy === "shrinking" ? "Getting it ready…" : up.busy === "uploading" ? "Uploading…" : "Add a picture"}</span>
          <span className="text-[12px] leading-snug text-[var(--ink-3)]">Drag one here, paste it, or choose a file. Big photos are shrunk for you (up to {fmtKb(MAX_IMAGE_BYTES)}).</span>
        </button>
      ) : (
        <div className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3 sm:grid-cols-[168px_1fr]">
          <div className="relative">
            <PicPreview pic={value} alt={alt} />
            {value.url && <button type="button" onClick={() => setZoom(true)} aria-label="Zoom in on the picture" className={`absolute bottom-1.5 right-1.5 grid h-11 w-11 place-items-center rounded-full bg-[var(--surface)]/95 text-[var(--ink)] shadow-[var(--shadow-sm)] ${FOCUS}`}><Icon name="search" size={16} strokeWidth={2.2} /></button>}
          </div>
          <div className="grid content-start gap-2">
            <div>
              <FieldLabel htmlFor={altId}>Describe it <span className="normal-case tracking-normal text-[var(--red)]">(required)</span></FieldLabel>
              <Input id={altId} value={alt} onChange={(e) => onAlt(e.target.value)} placeholder="e.g. A right-angled triangle with sides 3, 4 and 5" maxLength={300} aria-invalid={altError || undefined} aria-describedby={`${altId}-h`}
                className={`min-h-[44px] w-full ${altError ? "!border-[var(--red)]" : ""}`} data-testid="hub-image-alt" />
              <p id={`${altId}-h`} className="m-0 mt-1 text-[11.5px] leading-snug" style={{ color: altError ? "var(--red)" : "var(--ink-3)" }}>Read aloud to a child who can&apos;t see the picture, so describe what matters for the question.</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={pick} disabled={!!up.busy} className={`${TAP} rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[12.5px] font-bold text-[var(--ink)] hover:border-[var(--brand)]`}>{up.busy ? (up.busy === "uploading" ? "Uploading…" : "Getting it ready…") : "Replace"}</button>
              <button type="button" onClick={() => onPic(null)} className={`${TAP} rounded-lg px-3.5 text-[12.5px] font-bold text-[var(--red)] hover:bg-[var(--red-soft)]`} data-testid="hub-image-remove">Remove</button>
            </div>
          </div>
        </div>
      )}
      {up.error && <p role="alert" className="m-0 mt-1.5 text-[12px] font-semibold" style={{ color: "var(--red)" }}>{up.error}</p>}
      {up.note && !up.error && <p role="status" className="m-0 mt-1.5 text-[11.5px] font-semibold text-[var(--ink-3)]">{up.note}</p>}
      {zoom && value?.url && <Lightbox url={value.url} alt={alt} onClose={() => setZoom(false)} />}
    </div>
  );
}

function PicPreview({ pic, alt }: { pic: Pic; alt: string }) {
  const [bad, setBad] = useState(false);
  if (!pic.url || bad) return <div className="grid aspect-[4/3] w-full place-items-center rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)] text-center text-[11.5px] font-semibold text-[var(--ink-3)]"><span><Icon name="image" size={22} strokeWidth={1.5} className="mx-auto mb-1" />Picture attached</span></div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={pic.url} alt={alt} onError={() => setBad(true)} className="aspect-[4/3] w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] object-contain" />;
}

/** A compact 44px picture button for one answer option. */
export function OptionPic({ value, label, onPic }: { value: Pic | null | undefined; label: string; onPic: (p: Pic | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const up = useImageUpload((p) => onPic(p));
  const [bad, setBad] = useState(false);
  return (
    <span className="relative flex-none">
      <input ref={inputRef} type="file" accept={IMAGE_ACCEPT} className="sr-only" tabIndex={-1} aria-label={`${label}: choose a picture file`} onChange={(e) => { const f = e.target.files?.[0]; if (f) void up.run(f); e.target.value = ""; }} />
      {value?.id ? (
        <span className="relative block">
          <button type="button" onClick={() => inputRef.current?.click()} aria-label={`${label}: replace picture`} title={up.error ?? "Replace picture"} className={`grid h-11 w-11 place-items-center overflow-hidden rounded-xl border-2 bg-[var(--panel)] ${FOCUS} ${up.error ? "border-[var(--red)]" : "border-[var(--brand-line)]"}`}>
            {value.url && !bad
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={value.url} alt="" onError={() => setBad(true)} className="h-full w-full object-cover" />
              : <Icon name="image" size={18} />}
          </button>
          <button type="button" onClick={() => onPic(null)} aria-label={`${label}: remove picture`} className={`absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[var(--ink)] text-[13px] leading-none text-[var(--surface)] shadow ${FOCUS}`}>×</button>
        </span>
      ) : (
        <button type="button" disabled={!!up.busy} onClick={() => inputRef.current?.click()} aria-label={`${label}: add a picture`} title={up.error ?? "Add a picture to this answer"}
          className={`grid h-11 w-11 place-items-center rounded-xl border border-dashed text-[var(--ink-3)] hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-60 ${FOCUS} ${up.error ? "border-[var(--red)] text-[var(--red)]" : "border-[var(--line)]"}`}>
          <Icon name={up.busy ? "sparkle" : "image"} size={18} strokeWidth={1.7} />
        </button>
      )}
    </span>
  );
}
