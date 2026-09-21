"use client";

import { useState } from "react";
import { Ico } from "./teachIcons";
import { FOCUS, tint } from "./kit";
import type { HubVideo, VideoInput } from "./types";

// YouTube videos on notes, homework and lesson notes (contract §8).
//
//  • Tutor side  — <VideoEditor>: paste a link, see it validated + a thumbnail preview instantly,
//    optional title and start time, reorder / remove, max 6.
//  • Viewer side — <VideoEmbeds>: a click-to-load facade, then a sandboxed youtube-nocookie iframe.
//    We only ever render ids / URLs the SERVER returned (and re-check their shape), never a URL
//    built from raw user text. Nothing is requested from YouTube until the viewer presses play.

export const MAX_VIDEOS = 6;
const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const EMBED_RE = /^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}(\?start=\d{1,6})?$/;
const WATCH_RE = /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/;

/** "1:05" / "65" / "1m5s" → seconds (0 when blank / unreadable). */
export function parseStart(raw: string): number {
  const t = raw.trim().toLowerCase();
  if (!t) return 0;
  const hms = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (hms && (hms[1] || hms[2] || hms[3])) return (+(hms[1] ?? 0)) * 3600 + (+(hms[2] ?? 0)) * 60 + (+(hms[3] ?? 0));
  const parts = t.split(":").map((x) => Number(x));
  if (parts.length >= 2 && parts.length <= 3 && parts.every((n) => Number.isInteger(n) && n >= 0)) return parts.reduce((a, n) => a * 60 + n, 0);
  return 0;
}
export function fmtStart(sec: number | null | undefined): string {
  if (!sec || sec < 0) return "";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** Client-side mirror of the server's parser — for INSTANT feedback and the thumbnail preview only.
 *  The server re-parses and is the authority. Returns the 11-char id (+ a ?t= start) or null. */
export function parseYouTube(raw: string): { id: string; start: number } | null {
  const text = raw.trim();
  if (!text || text.length > 300) return null;
  let u: URL;
  try { u = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else { const m = u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/); id = m?.[1] ?? null; }
  } else if (host === "youtube-nocookie.com") { const m = u.pathname.match(/^\/embed\/([^/]+)/); id = m?.[1] ?? null; }
  if (!id || !ID_RE.test(id)) return null;
  const t = u.searchParams.get("t") ?? u.searchParams.get("start") ?? "";
  return { id, start: parseStart(t) };
}

/** Server videos → editable inputs (the canonical watch link is safe to resend). */
export const videosToInputs = (v?: HubVideo[] | null): VideoInput[] => (v ?? []).map((x) => ({ url: x.url, title: x.title || undefined, start: x.start || undefined }));
/** Editable inputs → request body. */
export const videoPayload = (v: VideoInput[]): VideoInput[] => v.map((x) => ({ url: x.url, ...(x.title?.trim() ? { title: x.title.trim().slice(0, 120) } : {}), ...(x.start ? { start: x.start } : {}) }));

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

/** Thumbnail with a graceful fallback tile (the editor is the only place we ask YouTube for a picture). */
function Thumb({ id, className = "" }: { id: string; className?: string }) {
  const [bad, setBad] = useState(false);
  return (
    <span className={`relative block overflow-hidden rounded-xl ${className}`} style={{ background: tint("var(--brand)", 10), aspectRatio: "16 / 9" }}>
      {!bad && (
        // eslint-disable-next-line @next/next/no-img-element -- a tiny remote preview; next/image would need a remote pattern
        <img src={thumb(id)} alt="" loading="lazy" onError={() => setBad(true)} className="absolute inset-0 h-full w-full object-cover" />
      )}
      <span className="absolute inset-0 grid place-items-center"><span className="grid h-8 w-8 place-items-center rounded-full text-[var(--brand)] shadow-[var(--shadow-sm)]" style={{ background: "color-mix(in srgb, var(--surface) 92%, transparent)" }}><Ico name="play" size={13} /></span></span>
    </span>
  );
}

// ── tutor: editor ────────────────────────────────────────────────────────────
export function VideoEditor({ value, onChange, idPrefix = "hub-video", hint }: { value: VideoInput[]; onChange: (v: VideoInput[]) => void; idPrefix?: string; hint?: string }) {
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [startTxt, setStartTxt] = useState("");
  const parsed = link.trim() ? parseYouTube(link) : null;
  const invalid = !!link.trim() && !parsed;
  const full = value.length >= MAX_VIDEOS;
  const dup = !!parsed && value.some((v) => parseYouTube(v.url)?.id === parsed.id && (v.start ?? 0) === (parseStart(startTxt) || parsed.start));

  const add = () => {
    if (!parsed || full || dup) return;
    const start = parseStart(startTxt) || parsed.start;
    onChange([...value, { url: `https://www.youtube.com/watch?v=${parsed.id}`, ...(title.trim() ? { title: title.trim().slice(0, 120) } : {}), ...(start ? { start } : {}) }]);
    setLink(""); setTitle(""); setStartTxt("");
  };
  const move = (i: number, d: -1 | 1) => { const n = [...value]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j]!, n[i]!]; onChange(n); };
  const patch = (i: number, p: Partial<VideoInput>) => onChange(value.map((v, k) => (k === i ? { ...v, ...p } : v)));

  return (
    <div data-video-editor className="@container">
      {value.length > 0 && (
        <ul className="mb-3 grid gap-2" aria-label="Videos on this item">
          {value.map((v, i) => {
            const p = parseYouTube(v.url);
            return (
              <li key={`${v.url}-${i}`} data-video-row className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2">
                {p ? <Thumb id={p.id} className="w-[72px] flex-none @[380px]:w-[104px] @[520px]:w-[128px]" /> : <span className="grid w-[104px] flex-none place-items-center rounded-xl bg-[var(--panel)] text-[var(--ink-3)]" style={{ aspectRatio: "16 / 9" }}><Ico name="video" size={18} /></span>}
                <div className="min-w-0 flex-1">
                  <input value={v.title ?? ""} onChange={(e) => patch(i, { title: e.target.value })} maxLength={120} placeholder="Add a title (optional)" aria-label={`Title for video ${i + 1}`}
                    className="min-h-[40px] w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[13px] font-bold text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
                  <div className="mt-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--ink-3)]"><Ico name="clock" size={12} />{v.start ? `Starts at ${fmtStart(v.start)}` : "Plays from the start"}</div>
                </div>
                <div className="flex flex-none flex-col @[420px]:flex-row">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move video ${i + 1} up`} className={`grid h-11 w-9 place-items-center rounded-lg text-[var(--ink-2)] hover:bg-[var(--panel)] disabled:opacity-30 sm:w-10 ${FOCUS}`}><Ico name="chevronDown" size={16} className="rotate-180" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label={`Move video ${i + 1} down`} className={`grid h-11 w-9 place-items-center rounded-lg text-[var(--ink-2)] hover:bg-[var(--panel)] disabled:opacity-30 sm:w-10 ${FOCUS}`}><Ico name="chevronDown" size={16} /></button>
                  <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} aria-label={`Remove video ${i + 1}`} className={`grid h-11 w-9 place-items-center rounded-lg text-[var(--red)] hover:bg-[var(--red-soft)] sm:w-10 ${FOCUS}`}><Ico name="trash" size={16} /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {full ? (
        <p className="rounded-xl border border-dashed border-[var(--line)] px-3 py-2.5 text-[12.5px] font-semibold text-[var(--ink-2)]">That&rsquo;s the maximum of {MAX_VIDEOS} videos here. Remove one to add another.</p>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--hub-warm-line)] p-3" style={{ background: "var(--hub-warm)" }}>
          <label htmlFor={`${idPrefix}-link`} className="mb-1.5 flex items-center gap-1.5 text-[12px] font-extrabold text-[var(--ink)]"><Ico name="video" size={14} />Add a YouTube video</label>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Ico name="link" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" />
              <input id={`${idPrefix}-link`} value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
                inputMode="url" autoComplete="off" spellCheck={false} placeholder="Paste a YouTube link…" aria-invalid={invalid} aria-describedby={`${idPrefix}-msg`}
                className={`min-h-[44px] w-full rounded-full border pl-9 pr-3 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand)] ${invalid ? "border-[var(--red)]" : "border-[var(--line)]"}`} />
            </div>
          </div>
          <p id={`${idPrefix}-msg`} role={invalid ? "alert" : undefined} className={`mt-1.5 text-[11.5px] font-semibold ${invalid ? "text-[var(--red)]" : "text-[var(--ink-3)]"}`}>
            {invalid ? "That doesn't look like a YouTube link. Use a youtube.com/watch, youtu.be, /shorts or /embed link." : (hint ?? "Students watch it right here, on the privacy-friendly YouTube player.")}
          </p>
          {parsed && (
            <div data-video-preview className="mt-3 grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
              <Thumb id={parsed.id} />
              <div className="grid content-start gap-2">
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Title (optional)" aria-label="Video title"
                  className="min-h-[44px] w-full rounded-lg border border-[var(--line)] px-3 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
                <input value={startTxt} onChange={(e) => setStartTxt(e.target.value)} placeholder={parsed.start ? `Start at ${fmtStart(parsed.start)}` : "Start at (optional) e.g. 1:30"} aria-label="Start time"
                  className="min-h-[44px] w-full rounded-lg border border-[var(--line)] px-3 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
                <button type="button" onClick={add} disabled={dup} data-video-add
                  className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full px-5 text-[13px] font-extrabold text-white disabled:opacity-50 ${FOCUS}`} style={{ background: "linear-gradient(180deg, var(--brand-2), var(--brand))" }}>
                  <Ico name="plus" size={15} strokeWidth={2.4} />{dup ? "Already added" : "Add video"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">{value.length}/{MAX_VIDEOS} videos</div>
    </div>
  );
}

// ── viewer: embeds ───────────────────────────────────────────────────────────
function withAutoplay(embed: string): string {
  try { const u = new URL(embed); u.searchParams.set("autoplay", "1"); u.searchParams.set("rel", "0"); u.searchParams.set("modestbranding", "1"); return u.toString(); } catch { return embed; }
}

function Embed({ v, index }: { v: HubVideo; index: number }) {
  const [playing, setPlaying] = useState(false);
  // Trust nothing that isn't exactly the shape the server promises.
  if (!ID_RE.test(v.id) || !EMBED_RE.test(v.embedUrl)) return null;
  const title = v.title?.trim() || `Video ${index + 1}`;
  const watchOk = WATCH_RE.test(v.url);
  return (
    <figure data-video-embed className="m-0 min-w-0">
      <div className="relative w-full overflow-hidden rounded-2xl border border-[var(--line)] shadow-[var(--shadow-sm)]" style={{ aspectRatio: "16 / 9", background: tint("var(--brand)", 8) }}>
        {playing ? (
          <iframe src={withAutoplay(v.embedUrl)} title={title} loading="lazy" className="absolute inset-0 h-full w-full border-0 bg-black"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} aria-label={`Play video: ${title}`} data-video-play
            className={`group absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center transition ${FOCUS}`}
            style={{ background: "radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--gold) 20%, var(--surface)), transparent 60%), linear-gradient(135deg, color-mix(in srgb, var(--brand) 12%, var(--surface)), color-mix(in srgb, var(--brand-2) 22%, var(--surface)))" }}>
            <span className="grid h-16 w-16 place-items-center rounded-full text-white shadow-[var(--shadow)] transition group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100" style={{ background: "linear-gradient(140deg, var(--brand-2), var(--brand))" }}>
              <Ico name="play" size={26} className="translate-x-0.5" />
            </span>
            <span className="max-w-full truncate text-[14px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{title}</span>
            <span className="text-[11.5px] font-bold text-[var(--ink-2)]">Press play{v.start ? ` · starts at ${fmtStart(v.start)}` : ""}</span>
          </button>
        )}
      </div>
      <figcaption className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[12px]">
        {watchOk && (
          <a href={v.url} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-[44px] items-center gap-1 rounded-md font-bold text-[var(--brand)] hover:underline sm:min-h-[32px] ${FOCUS}`}>
            Open on YouTube<Ico name="external" size={13} />
          </a>
        )}
      </figcaption>
    </figure>
  );
}

/** The videos of a note / homework / lesson, as a responsive grid of click-to-load players. */
export function VideoEmbeds({ videos, heading = "Videos", className = "" }: { videos?: HubVideo[] | null; heading?: string | null; className?: string }) {
  const list = (videos ?? []).filter((v) => ID_RE.test(v.id) && EMBED_RE.test(v.embedUrl));
  if (!list.length) return null;
  return (
    <section aria-label={heading ?? "Videos"} data-video-embeds className={className}>
      {heading && <div className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]"><Ico name="video" size={14} />{heading}<span className="rounded-full bg-[var(--panel)] px-1.5 py-px text-[11px] text-[var(--ink-2)]">{list.length}</span></div>}
      <div className={`grid gap-4 ${list.length > 1 ? "md:grid-cols-2" : "max-w-[760px]"}`}>
        {list.map((v, i) => <Embed key={`${v.id}-${v.start}-${i}`} v={v} index={i} />)}
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-snug text-[var(--ink-3)]"><Ico name="shield" size={13} className="mt-px" />Plays from YouTube&rsquo;s privacy-enhanced player. Nothing is loaded from YouTube until you press play.</p>
    </section>
  );
}

/** A small "Video" / "2 videos" chip for cards. */
export function VideoChip({ count, className = "" }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span data-video-chip className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-px text-[11px] font-extrabold ${className}`} style={{ background: "var(--violet-soft)", color: "var(--violet)", borderColor: "var(--brand-line)" }}>
      <Ico name="video" size={11} strokeWidth={2.2} />{count > 1 ? `${count} videos` : "Video"}
    </span>
  );
}
