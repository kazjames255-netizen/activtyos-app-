"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

// ─────────────────────────────────────────────────────────────────────────
// Moments (operator/staff) — share the day with parents: a photo (or a photo of
// their WORK, which needs no consent), an activity, who's in it and a highlight.
// Photo consent is enforced: a child photo can only tag consented children; the
// server enforces it too. Parents see the moments featuring their own child.
// ─────────────────────────────────────────────────────────────────────────

interface Moment { id: string; photoUrl?: string; caption?: string; activity?: string; photoType?: "child" | "work"; date: string; childIds: string[]; childNames: string[]; postedByName?: string; createdAt?: string }
interface Taggable { childId: string; name: string; photoConsent: boolean }

const LIGHT_PALETTE = { "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc", "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1" } as CSSProperties;
const HERO = "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)";
const BLUE = "#1d3a8f", PINK = "#be1259", GREEN = "#0f7a43", RED = "#c02636";
const inputCls = "rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]";

const ACTS = [
  { k: "art", n: "Arts & crafts", e: "🎨", c: "#be1259" }, { k: "sport", n: "Sports", e: "⚽", c: "#047857" },
  { k: "swim", n: "Swimming", e: "🏊", c: "#0369a1" }, { k: "food", n: "Lunch & snack", e: "🍎", c: "#b45309" },
  { k: "nature", n: "Outdoors", e: "🌳", c: "#0e7490" }, { k: "science", n: "Science", e: "🔬", c: "#6d28d9" },
  { k: "drama", n: "Drama", e: "🎭", c: "#c2410c" }, { k: "play", n: "Free play", e: "🧩", c: "#4338ca" },
];
const actBy = (name?: string) => ACTS.find((a) => a.n === name);

const pad = (n: number) => String(n).padStart(2, "0");
const todayIso = () => { const t = new Date(); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const weekStartIso = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

async function fileToDataUrl(file: File): Promise<string> {
  const img = document.createElement("img");
  const url = URL.createObjectURL(file);
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const scale = Math.min(1, 1280 / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = img.width * scale; canvas.height = img.height * scale;
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/jpeg", 0.82);
}

// friendly caption generator (no external AI — templated, like the manual)
const AICAP: Record<string, { o: string[]; m: string[] }> = {
  "Arts & crafts": { o: ["{N} got stuck into arts & crafts today", "{N} spent the morning being really creative"], m: ["making colourful collages", "painting a picture to bring home", "decorating masks and props"] },
  Sports: { o: ["{N} had a fantastic time on the field", "Great team spirit from {N} today"], m: ["scoring goals in our mini tournament", "practising throwing and catching", "racing in the relay games"] },
  Swimming: { o: ["{N} did brilliantly in the pool today", "{N} grew in confidence in the water"], m: ["practising floating and kicking", "swimming widths with the floats", "working hard on front crawl"] },
  "Lunch & snack": { o: ["{N} enjoyed a happy lunchtime", "Snack time was a hit for {N}"], m: ["trying everything on the plate", "chatting away with friends", "finishing a lovely healthy meal"] },
  Outdoors: { o: ["{N} loved being outdoors today", "A lovely outdoor adventure for {N}"], m: ["hunting for bugs and minibeasts", "building dens in the woodland", "spotting birds and squirrels"] },
  Science: { o: ["{N} was a brilliant little scientist today", "Lots of wow moments for {N}"], m: ["making a fizzy volcano experiment", "building and testing paper rockets", "exploring magnets and how they work"] },
  Drama: { o: ["{N} shone in drama today", "{N} loved getting into character"], m: ["acting out a story for the group", "practising funny voices and faces", "performing in our end of day show"] },
  "Free play": { o: ["{N} had a wonderful free-play session", "Lots of giggles from {N} today"], m: ["building an amazing fort", "sharing toys and taking turns", "making lovely new friends"] },
};
const AICLOSE = [" and came back beaming!", " and was so proud!", ". A really lovely day all round.", ". Such a happy afternoon!", " — a real highlight of the day."];
const pick = <T,>(x: T[]) => x[Math.floor(Math.random() * x.length)];
function aiCaption(names: string, activity: string) { const a = AICAP[activity] ?? AICAP["Free play"]; return `${pick(a.o).replace("{N}", names)}, ${pick(a.m)}${pick(AICLOSE)}`; }

function PostForm({ onPosted, onCancel }: { onPosted: () => void; onCancel: () => void }) {
  const [date, setDate] = useState(todayIso());
  const [preview, setPreview] = useState<string | null>(null);
  const [photoType, setPhotoType] = useState<"child" | "work">("child");
  const [caption, setCaption] = useState("");
  const [activity, setActivity] = useState(ACTS[0].n);
  const [taggable, setTaggable] = useState<Taggable[]>([]);
  const [tagged, setTagged] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { apiGet<Taggable[]>(`/api/moments/taggable?date=${date}`).then((t) => { setTaggable(t); setTagged([]); }).catch(() => setTaggable([])); }, [date]);

  const canTag = (c: Taggable) => photoType === "work" || c.photoConsent;
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (f) setPreview(await fileToDataUrl(f)); }
  const writeAi = () => { const names = tagged.map((id) => taggable.find((c) => c.childId === id)?.name).filter(Boolean); setCaption(aiCaption(names.length ? (names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`) : "Your child", activity)); };

  async function post() {
    if (!preview && !caption.trim()) { setError("Add a photo or a quick highlight."); return; }
    // drop any non-consented tags for a child photo (server enforces this too)
    const ids = photoType === "work" ? tagged : tagged.filter((id) => taggable.find((c) => c.childId === id)?.photoConsent);
    setBusy(true); setError(null);
    try {
      let url: string | undefined;
      if (preview) url = (await apiPost<{ url: string }>("/api/uploads", { dataUrl: preview })).url;
      await apiPost("/api/moments", { photoUrl: url, caption: caption.trim() || undefined, activity, photoType, date, childIds: ids });
      onPosted();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t post"); setBusy(false); }
  }

  const lbl = (s: string) => <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">{s}</div>;
  return (
    <div className="mb-3.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="mb-2.5 flex items-center justify-between"><div className="text-[14px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>📷 Share a moment</div><input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} className={inputCls} /></div>

      {lbl("Photo")}
      <div className="mb-1.5 flex gap-1.5">
        {(["child", "work"] as const).map((t) => <button key={t} type="button" onClick={() => setPhotoType(t)} className="rounded-full border-2 px-3 py-1 text-[12px] font-bold transition-colors" style={photoType === t ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{t === "child" ? "📷 Child photo" : "🎨 Their work"}</button>)}
      </div>
      {photoType === "work" && <div className="mb-2 rounded-lg bg-[#e7f6ee] px-3 py-1.5 text-[11.5px]" style={{ color: GREEN }}>A photo of a child&rsquo;s work has no faces — no photo consent needed, so anyone can be tagged.</div>}
      {preview ? (
        <div className="relative mb-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="max-h-[220px] w-full rounded-xl object-cover" />
          <button type="button" onClick={() => setPreview(null)} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white">✕</button>
        </div>
      ) : (
        <label className="mb-2.5 flex h-[120px] cursor-pointer items-center justify-center rounded-xl border border-dashed border-[var(--line)] text-[12.5px] text-[var(--ink-3)]">📷 Choose a photo<input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} /></label>
      )}

      {lbl("Activity")}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {ACTS.map((a) => <button key={a.k} type="button" onClick={() => setActivity(a.n)} className="rounded-full border-2 px-2.5 py-1 text-[12px] font-bold transition-colors" style={activity === a.n ? { borderColor: a.c, background: `color-mix(in srgb,${a.c} 12%,var(--surface))`, color: a.c } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{a.e} {a.n}</button>)}
      </div>

      {lbl(`Which children? (booked on ${new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })})`)}
      {taggable.length === 0 ? <div className="mb-3 text-[11.5px] text-[var(--ink-3)]">No children booked on this date.</div> : (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {taggable.map((c) => { const on = tagged.includes(c.childId), allowed = canTag(c); return (
            <button key={c.childId} type="button" disabled={!allowed} onClick={() => setTagged((t) => t.includes(c.childId) ? t.filter((x) => x !== c.childId) : [...t, c.childId])}
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-55"
              style={on ? { borderColor: "transparent", background: BLUE, color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-2)" }} title={allowed ? undefined : "No photo consent — use “their work”"}>
              {c.name}<span className="rounded-full px-1.5 py-0.5 text-[9px] font-extrabold text-white" style={{ background: c.photoConsent ? GREEN : RED }}>{c.photoConsent ? "✓" : "no photos"}</span>
            </button>
          ); })}
        </div>
      )}

      <div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">What happened?</span><button type="button" onClick={writeAi} className="rounded-full px-2.5 py-1 text-[11px] font-extrabold text-white" style={{ background: `linear-gradient(90deg,${PINK},#7c5cff)` }}>✨ Write for me</button></div>
      <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} placeholder="A quick highlight for the parents…" className={`${inputCls} w-full resize-y leading-[1.5] [field-sizing:content]`} />

      {error && <div className="mt-2 text-[12.5px] font-bold text-[var(--red,#e21d27)]">{error}</div>}
      <div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={post} className="rounded-lg px-4 py-1.5 text-[12.5px] font-extrabold text-white disabled:opacity-60" style={{ background: BLUE }}>{busy ? "Posting…" : "Post moment 🚀"}</button><button type="button" onClick={onCancel} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)]">Cancel</button></div>
    </div>
  );
}

export function MomentsApp() {
  const [moments, setMoments] = useState<Moment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [galKid, setGalKid] = useState("");
  const [galWhen, setGalWhen] = useState<"all" | "today" | "week">("all");
  const [lightbox, setLightbox] = useState<string | null>(null);

  const refresh = useCallback(() => { apiGet<Moment[]>("/api/moments").then((m) => { setMoments(m); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load")); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  useRealtime(["moments"], refresh);

  async function remove(m: Moment) { if (!confirm("Delete this moment?")) return; try { await api(`/api/moments/${encodeURIComponent(m.id)}`, { method: "DELETE" }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); } }

  const all = useMemo(() => moments ?? [], [moments]);
  const featured = useMemo(() => { const m = new Map<string, string>(); for (const mo of all) mo.childIds.forEach((id, i) => { const n = mo.childNames?.[i]; if (n && !m.has(id)) m.set(id, n); }); return [...m.entries()]; }, [all]);
  const photos = all.filter((m) => m.photoUrl);
  const tiles: [string, number][] = [["Today", all.filter((m) => m.date === todayIso()).length], ["This week", all.filter((m) => (m.date ?? "") >= weekStartIso()).length], ["Photos", photos.length], ["Children featured", featured.length]];

  const galPhotos = useMemo(() => photos.filter((m) => (!galKid || m.childIds.includes(galKid)) && (galWhen === "all" || (galWhen === "today" ? m.date === todayIso() : (m.date ?? "") >= weekStartIso()))), [photos, galKid, galWhen]);

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* hero */}
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: HERO }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">📷</span>Moments</div>
            <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-[1.5] text-white/85">Share each child&rsquo;s day with their parents — activities, highlights and photos. Only children with photo consent can be in a child photo; parents see the moments their own child is in.</p>
          </div>
          {!posting && <button type="button" onClick={() => setPosting(true)} className="rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-[#1d3a8f] shadow-md transition-transform hover:-translate-y-px">＋ Share a moment</button>}
        </div>
        {moments && <div className="mt-4 flex flex-wrap gap-2.5">{tiles.map(([label, v]) => <div key={label} className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{v}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{label}</div></div>)}</div>}
      </div>

      {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#e21d27]">{error}</div>}
      {posting && <PostForm onPosted={() => { setPosting(false); refresh(); }} onCancel={() => setPosting(false)} />}

      {/* gallery */}
      {photos.length > 0 && (
        <div className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-[13px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>🖼️ Photo gallery <span className="text-[11px] font-semibold text-[var(--ink-3)]">({galPhotos.length} of {photos.length})</span></span>
            <div className="flex gap-1.5">{([["all", "All"], ["today", "Today"], ["week", "This week"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setGalWhen(k)} className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold" style={galWhen === k ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{l}</button>)}</div>
          </div>
          {featured.length > 0 && <div className="mb-2.5 flex flex-wrap gap-1.5"><button type="button" onClick={() => setGalKid("")} className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold" style={!galKid ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>All children</button>{featured.map(([id, n]) => <button key={id} type="button" onClick={() => setGalKid(galKid === id ? "" : id)} className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold" style={galKid === id ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{n}</button>)}</div>}
          {galPhotos.length === 0 ? <div className="text-[12px] text-[var(--ink-3)]">No photos match.</div> : (
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(94px,1fr))" }}>
              {galPhotos.map((m) => (
                <button key={m.id} type="button" onClick={() => setLightbox(m.photoUrl!)} className="relative aspect-square overflow-hidden rounded-lg bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.photoUrl} alt={m.caption ?? ""} className="h-full w-full object-cover" />
                  {m.photoType === "work" && <span className="absolute bottom-1 left-1 rounded-full px-1.5 py-0.5 text-[8.5px] font-extrabold text-white" style={{ background: GREEN }}>Work</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* feed */}
      {!moments ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
        : all.length === 0 ? <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-12 text-center text-[13px] text-[var(--ink-3)]">No moments yet — share the first one.</div>
        : (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {all.map((m) => { const a = actBy(m.activity), col = a?.c ?? PINK; return (
              <div key={m.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
                {m.photoUrl ? (
                  <button type="button" onClick={() => setLightbox(m.photoUrl!)} className="relative block h-[170px] w-full bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.photoUrl} alt={m.caption ?? ""} className="h-full w-full object-cover" />
                    {a && <span className="absolute left-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-extrabold" style={{ color: col }}>{a.e} {a.n}</span>}
                    {m.photoType === "work" && <span className="absolute bottom-2.5 left-2.5 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold text-white" style={{ background: GREEN }}>🎨 Their work</span>}
                  </button>
                ) : (
                  <div className="relative flex h-[108px] items-center justify-center" style={{ background: `linear-gradient(135deg,${col},${col}cc)` }}><span className="text-[46px]">{a?.e ?? "✨"}</span>{a && <span className="absolute left-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-extrabold" style={{ color: col }}>{a.e} {a.n}</span>}</div>
                )}
                <div className="p-3">
                  {m.childNames?.filter(Boolean).length > 0 && <div className="mb-1.5 text-[12.5px] font-extrabold">{m.childNames.filter(Boolean).join(", ")}</div>}
                  {m.caption && <div className="text-[13px] leading-[1.5] text-[var(--ink-2)]">{m.caption}</div>}
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-[var(--ink-3)]"><span>👤 {m.postedByName} · {when(m.createdAt)}</span>{canManage && <button type="button" onClick={() => remove(m)} className="font-bold" style={{ color: RED }}>Delete</button>}</div>
                </div>
              </div>
            ); })}
          </div>
        )}

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-[90vh] max-w-[92vw] rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}
