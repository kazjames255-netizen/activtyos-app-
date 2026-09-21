"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, FOCUS } from "../../teachKit";
import { fmtKb, IMAGE_ACCEPT, imageFrom, MAX_IMAGE_BYTES, prepareImage, uploadHubImage } from "../../shared-assess/imageUtil";
import { errMsg } from "../../types";
import { BIcon } from "./boardIcons";
import { loadHubPictures, type HubPic } from "./exportBoard";

// "Picture…" on the board: upload a new one (shrunk in the browser to fit the
// 750 KB hub limit, like the question editor) or pick one already in the
// tutor's hub (the image attachments of their notes).

function measure(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 400, h: img.naturalHeight || 300 });
    img.onerror = () => resolve({ w: 400, h: 300 });
    img.src = url;
  });
}

export function ImagePicker({ qs, onClose, onPick }: { qs: string; onClose: () => void; onPick: (p: { id: string; url: string; w: number; h: number }) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pics, setPics] = useState<HubPic[] | null>(null);
  const [over, setOver] = useState(false);
  useEffect(() => { let dead = false; loadHubPictures(qs).then((p) => { if (!dead) setPics(p); }).catch(() => { if (!dead) setPics([]); }); return () => { dead = true; }; }, [qs]);

  const upload = async (f: Blob | null | undefined) => {
    if (!f) return;
    setErr(null); setBusy("Getting it ready…");
    try {
      const prep = await prepareImage(f);
      setBusy("Adding to your hub…");
      const up = await uploadHubImage(prep.dataUrl);
      onPick({ id: up.id, url: up.url, w: prep.width, h: prep.height });
    } catch (e) { setErr(errMsg(e, `Couldn't add that picture (limit ${fmtKb(MAX_IMAGE_BYTES)}).`)); setBusy(null); }
  };
  const choose = async (p: HubPic) => { setBusy("Placing it…"); const m = await measure(p.url); onPick({ id: p.id, url: p.url, w: m.w, h: m.h }); };

  return (
    <Dialog title="Add a picture to the board" subtitle="It appears in the middle of the view — drag it where you want it." onClose={onClose} size="lg">
      <input ref={input} type="file" accept={IMAGE_ACCEPT} className="sr-only" tabIndex={-1} aria-label="Choose a picture file" data-testid="board-image-input" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
      <button type="button" disabled={!!busy} onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); void upload(imageFrom(e.dataTransfer)); }}
        className={`flex min-h-[112px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-5 text-center transition-colors ${FOCUS} ${over ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--hub-warm-line)] bg-[var(--hub-warm)] hover:border-[var(--brand)]"}`}>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface)] text-[var(--brand)] shadow-[var(--shadow-sm)]"><BIcon name="image" size={20} /></span>
        <span className="text-[13px] font-extrabold text-[var(--ink)]">{busy ?? "Upload a picture"}</span>
        <span className="text-[12px] leading-snug text-[var(--ink-3)]">Drag one here or choose a file. Big photos are shrunk for you (up to {fmtKb(MAX_IMAGE_BYTES)}).</span>
      </button>
      {err && <p role="alert" className="m-0 mt-2 text-[12.5px] font-semibold text-[var(--red)]">{err}</p>}

      <h3 className="m-0 mb-2 mt-5 text-[12px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">From your lessons</h3>
      {pics === null ? <p className="m-0 text-[12.5px] text-[var(--ink-3)]">Looking…</p>
        : !pics.length ? <p className="m-0 text-[12.5px] leading-relaxed text-[var(--ink-3)]">No pictures in your lessons yet. Pictures you attach to a lesson in the Lessons tab show up here.</p>
          : (
            <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-4" data-testid="board-hub-pictures">
              {pics.map((p) => (
                <li key={p.id}>
                  <button type="button" disabled={!!busy} onClick={() => void choose(p)} title={`${p.name} — ${p.from}`} className={`block w-full overflow-hidden rounded-xl border border-[var(--hub-warm-line)] bg-[var(--surface)] text-left hover:border-[var(--brand)] ${FOCUS}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.name} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                    <span className="block truncate px-2 py-1 text-[11px] font-bold text-[var(--ink-2)]">{p.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
    </Dialog>
  );
}
