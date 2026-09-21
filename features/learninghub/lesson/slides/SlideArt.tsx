"use client";

import { useEffect, useState } from "react";
import type { Pic } from "../../../../server/src/oak/factory/art/types";
import { QImage } from "../../shared-assess/QuestionImage";
import type { Slide } from "./types";

// The picture panel of a slide. Only VERIFIED art ever reaches a slide (server/src/oak/factory/art): library diagrams referenced by id
// (drawn inline so they follow the light/dark theme, with alt text + a caption) and allow-listed literal emoji — plus, when the tutor
// chose one in the preview, their own uploaded picture (`slide.image`, shown through the short-lived signed URL the API adds, exactly
// like a question's picture). A slide with no art has NO panel at all (SlideDeck lays out single-column), never an empty box.
// The library is loaded on demand so it stays out of the main chunk.

export type Lib = { byId: Record<string, Pic>; all: Pic[]; css: string };
let libPromise: Promise<Lib> | null = null;
/** The verified picture library + its theme CSS, loaded once (shared by the slide panel and the tutor's picture picker). */
export const loadLib = () => (libPromise ??= Promise.all([import("../../../../server/src/oak/factory/art/library"), import("../../../../server/src/oak/factory/art/style")]).then(([l, s]) => ({ byId: l.PIC_BY_ID, all: l.PICS, css: s.PIC_CSS })));

export const hasArt = (s: Pick<Slide, "art" | "pics" | "image">) => !!(s.image || s.pics?.length || s.art?.length);

export function SlideArt({ slide, tint }: { slide: Pick<Slide, "art" | "pics" | "image">; tint: [string, string] }) {
  const [lib, setLib] = useState<Lib | null>(null);
  const wantsLib = !slide.image && !!slide.pics?.length;
  useEffect(() => {
    if (!wantsLib) return;
    let live = true;
    loadLib().then((l) => { if (live) setLib(l); }).catch(() => { /* no library: the panel just shows no pictures */ });
    return () => { live = false; };
  }, [wantsLib]);
  const [a, b] = tint;
  const pics = slide.image ? [] : (slide.pics ?? []).map((p) => lib?.byId[p.id]).filter((p): p is Pic => !!p);
  const emoji = slide.image ? [] : slide.art ?? [];
  if (!slide.image && !pics.length && !emoji.length && !wantsLib) return null;
  const POS = ["-translate-x-2", "translate-x-3"];
  return (
    <aside data-testid="slide-art" className={`flex flex-col items-center gap-3 self-start rounded-3xl px-3 py-4 ${slide.image || pics.length || wantsLib ? "mx-auto w-full max-w-[300px] md:mx-0 md:max-w-none" : "hidden md:flex"}`}
      style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${b} 16%, var(--surface)), color-mix(in srgb, ${a} 10%, var(--surface)))`, border: `2px solid color-mix(in srgb, ${b} 25%, var(--line))` }}>
      {lib && <style>{lib.css}</style>}
      {slide.image && (
        <figure data-testid="slide-image" data-image={slide.image.id} className="m-0 w-full">
          <QImage pic={{ id: slide.image.id, url: slide.image.url, alt: slide.image.alt }} alt={slide.image.alt} fit="wide" />
        </figure>
      )}
      {pics.map((p) => (
        <figure key={p.id} data-testid="slide-pic" data-pic={p.id} className="m-0 w-full">
          <div role="img" aria-label={p.alt} className="w-full text-[var(--ink)]" dangerouslySetInnerHTML={{ __html: p.svg }} />
          <figcaption className="mt-1 text-center text-[12px] font-extrabold leading-tight text-[var(--ink-2)]">{p.caption}</figcaption>
        </figure>
      ))}
      {!pics.length && wantsLib && <div aria-hidden="true" className="w-full" style={{ aspectRatio: "240 / 170" }} />}
      {emoji.map((e, k) => <span key={k} aria-hidden="true" className={`ls-float text-[52px] leading-none drop-shadow-sm ${POS[k % POS.length]}`} style={{ animationDelay: `${k * 0.6}s`, ["--r" as string]: `${k % 2 ? 4 : -4}deg` }}>{e}</span>)}
    </aside>
  );
}
