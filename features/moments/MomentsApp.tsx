"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";

// ─────────────────────────────────────────────────────────────────────────
// Moments (operator/staff) — share the day with parents: a square-cropped photo
// (or a photo of their WORK, which needs no consent), an activity, who's in it
// and a highlight. Photo consent is enforced. The gallery organises photos into
// folders by child and by listing. Parents see moments featuring their child
// (the parent-side email/notification + deep link is Amir's).
// ─────────────────────────────────────────────────────────────────────────

interface Comment { by: string; byName: string; role: "parent" | "staff"; text: string; at: string; marketing?: boolean }
interface Moment { id: string; photoUrl?: string; caption?: string; activity?: string; photoType?: "child" | "work"; date: string; listingId?: string; childIds: string[]; childNames: string[]; postedByName?: string; createdAt?: string; comments?: Comment[] }
interface Taggable { childId: string; name: string; photoConsent: boolean; parentName?: string; email?: string; listing?: string; postcode?: string }
interface Act { k: string; n: string; e: string; c: string }
type SettingsShape = ReturnType<typeof useSettings>["settings"];
type SaveFn = ReturnType<typeof useSettings>["save"];

const LIGHT_PALETTE = { "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc", "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1" } as CSSProperties;
const HERO = "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)";
const BLUE = "#1d3a8f", PINK = "#be1259", GREEN = "#0f7a43", RED = "#c02636";
const ACT_PALETTE = ["#be1259", "#047857", "#0369a1", "#b45309", "#0e7490", "#6d28d9", "#c2410c", "#4338ca", "#b91c1c", "#7c3aed"];
const ACTS: Act[] = [
  { k: "art", n: "Arts & crafts", e: "🎨", c: "#be1259" }, { k: "sport", n: "Sports", e: "⚽", c: "#047857" },
  { k: "swim", n: "Swimming", e: "🏊", c: "#0369a1" }, { k: "food", n: "Lunch & snack", e: "🍎", c: "#b45309" },
  { k: "nature", n: "Outdoors", e: "🌳", c: "#0e7490" }, { k: "science", n: "Science", e: "🔬", c: "#6d28d9" },
  { k: "drama", n: "Drama", e: "🎭", c: "#c2410c" }, { k: "play", n: "Free play", e: "🧩", c: "#4338ca" },
];
const inputCls = "rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]";
const pad = (n: number) => String(n).padStart(2, "0");
const todayIso = () => { const t = new Date(); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const weekStartIso = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

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

// ── square cropper ───────────────────────────────────────────────────────────
function Cropper({ src, onDone, onCancel }: { src: string; onDone: (dataUrl: string) => void; onCancel: () => void }) {
  const FRAME = 264, OUT = 900;
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const baseS = nat.w && nat.h ? Math.max(FRAME / nat.w, FRAME / nat.h) : 1;
  const s = baseS * zoom;
  const dispW = nat.w * s, dispH = nat.h * s;
  const clampWith = (o: { x: number; y: number }, w: number, h: number) => ({ x: Math.min(0, Math.max(FRAME - w, o.x)), y: Math.min(0, Math.max(FRAME - h, o.y)) });

  const onLoad = () => { const im = imgRef.current!; const w = im.naturalWidth, h = im.naturalHeight; const bs = Math.max(FRAME / w, FRAME / h); setNat({ w, h }); setOff({ x: (FRAME - w * bs) / 2, y: (FRAME - h * bs) / 2 }); setZoom(1); };
  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }; (e.target as Element).setPointerCapture(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { if (!drag.current) return; const d = drag.current; setOff(clampWith({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) }, dispW, dispH)); };
  const onUp = () => { drag.current = null; };
  const onZoom = (z: number) => { const ns = baseS * z; setZoom(z); setOff((o) => clampWith(o, nat.w * ns, nat.h * ns)); };
  const bake = () => { const im = imgRef.current!; const f = OUT / FRAME; const c = document.createElement("canvas"); c.width = OUT; c.height = OUT; const ctx = c.getContext("2d")!; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, OUT, OUT); ctx.drawImage(im, off.x * f, off.y * f, dispW * f, dispH * f); onDone(c.toDataURL("image/jpeg", 0.85)); };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={onCancel}>
      <div className="w-full max-w-[320px] rounded-2xl bg-[var(--surface)] p-4" onClick={(e) => e.stopPropagation()} style={LIGHT_PALETTE}>
        <div className="mb-2 text-[13.5px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Crop to square</div>
        <div className="relative mx-auto overflow-hidden rounded-xl bg-black" style={{ width: FRAME, height: FRAME, touchAction: "none" }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imgRef} src={src} alt="" onLoad={onLoad} draggable={false} className="max-w-none select-none" style={{ width: dispW, height: dispH, transform: `translate(${off.x}px,${off.y}px)`, cursor: "grab" }} />
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--ink-3)]">🔍<input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => onZoom(parseFloat(e.target.value))} className="flex-1" /></div>
        <div className="mt-1 text-center text-[10.5px] text-[var(--ink-3)]">Drag to reposition · zoom with the slider</div>
        <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">Cancel</button><button type="button" onClick={bake} className="rounded-lg bg-[#1d3a8f] px-4 py-1.5 text-[12px] font-extrabold text-white">Use photo</button></div>
      </div>
    </div>
  );
}

function PostForm({ activities, settings, save, listings, onPosted, onCancel }: { activities: Act[]; settings: SettingsShape; save: SaveFn; listings: { id: string; title: string }[]; onPosted: () => void; onCancel: () => void }) {
  const [date, setDate] = useState(todayIso());
  const [listingId, setListingId] = useState("");
  const [rawPhoto, setRawPhoto] = useState<string | null>(null); // pre-crop
  const [preview, setPreview] = useState<string | null>(null); // cropped square
  const [photoType, setPhotoType] = useState<"child" | "work">("child");
  const [caption, setCaption] = useState("");
  const [activity, setActivity] = useState(activities[0]?.n ?? "");
  const [taggable, setTaggable] = useState<Taggable[]>([]);
  const [tagged, setTagged] = useState<string[]>([]);
  const [newAct, setNewAct] = useState(false);
  const [actName, setActName] = useState(""), [actEmoji, setActEmoji] = useState("🎉");
  const [childQuery, setChildQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { apiGet<Taggable[]>(`/api/moments/taggable${listingId ? `?listingId=${encodeURIComponent(listingId)}` : ""}`).then((t) => { setTaggable(t); setTagged([]); }).catch(() => setTaggable([])); }, [listingId]);

  const canTag = (c: Taggable) => photoType === "work" || c.photoConsent;
  const noConsentTagged = tagged.map((id) => taggable.find((c) => c.childId === id)).filter((c): c is Taggable => !!c && !c.photoConsent);
  const nameList = (cs: Taggable[]) => (cs.length === 1 ? cs[0].name : `${cs.slice(0, -1).map((c) => c.name).join(", ")} and ${cs[cs.length - 1].name}`);
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (f) setRawPhoto(await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(f); })); }
  const writeAi = () => { const names = tagged.map((id) => taggable.find((c) => c.childId === id)?.name).filter(Boolean) as string[]; setCaption(aiCaption(names.length ? (names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`) : "Your child", activity)); };
  async function addActivity() { const n = actName.trim(); if (!n) return; const c = ACT_PALETTE[activities.length % ACT_PALETTE.length]; const next = [...activities, { k: `a${Date.now()}`, n, e: actEmoji.trim() || "🎉", c }]; await save({ settings: { ...settings, moments: { ...settings.moments, activities: next } } }); setActivity(n); setNewAct(false); setActName(""); setActEmoji("🎉"); }

  async function post() {
    if (!preview && !caption.trim()) { setError("Add a photo or a quick highlight."); return; }
    const ids = photoType === "work" ? tagged : tagged.filter((id) => taggable.find((c) => c.childId === id)?.photoConsent);
    setBusy(true); setError(null);
    try {
      let url: string | undefined;
      if (preview) url = (await apiPost<{ url: string }>("/api/uploads", { dataUrl: preview })).url;
      await apiPost("/api/moments", { photoUrl: url, caption: caption.trim() || undefined, activity, photoType, date, listingId: listingId || undefined, childIds: ids });
      onPosted();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t post"); setBusy(false); }
  }

  const lbl = (s: string) => <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">{s}</div>;
  return (
    <div className="mb-3.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      {rawPhoto && <Cropper src={rawPhoto} onDone={(d) => { setPreview(d); setRawPhoto(null); }} onCancel={() => setRawPhoto(null)} />}
      <div className="mb-2.5 text-[14px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>📷 Share a moment</div>

      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">{lbl("Which camp / club?")}<select value={listingId} onChange={(e) => setListingId(e.target.value)} className={`${inputCls} w-full`}><option value="">All my bookings</option>{listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select></label>
        <label className="flex flex-col gap-1">{lbl("Date")}<input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} className={`${inputCls} w-full`} /></label>
      </div>

      {lbl("Photo (cropped to a square)")}
      <div className="mb-1.5 flex gap-1.5">{(["child", "work"] as const).map((t) => <button key={t} type="button" onClick={() => setPhotoType(t)} className="rounded-full border-2 px-3 py-1 text-[12px] font-bold transition-colors" style={photoType === t ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{t === "child" ? "📷 Child photo" : "🎨 Their work"}</button>)}</div>
      {photoType === "work" && <div className="mb-2 rounded-lg bg-[#e7f6ee] px-3 py-1.5 text-[11.5px]" style={{ color: GREEN }}>A photo of a child&rsquo;s work has no faces — no consent needed, so anyone can be tagged.</div>}
      {photoType === "child" && <div className="mb-2 rounded-lg bg-[#fdf3d8] px-3 py-1.5 text-[11.5px]" style={{ color: "#9a5a00" }}>Only children whose family gave <b>photo consent</b> can be tagged in a child photo — the others are greyed out below.</div>}
      {photoType === "work" && noConsentTagged.length > 0 && <div className="mb-2 rounded-lg border border-[#f4c4c4] bg-[#fef2f2] px-3 py-2 text-[11.5px] leading-[1.5]" style={{ color: RED }}>⚠ <b>{nameList(noConsentTagged)}</b> {noConsentTagged.length > 1 ? "have" : "has"} no photo consent on file. Keep this to a photo of their <b>work only</b> — no faces or children in shot — so it can safely be shared with their family.</div>}
      {preview ? (
        <div className="relative mb-2.5 w-[160px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="aspect-square w-[160px] rounded-xl object-cover" />
          <button type="button" onClick={() => setPreview(null)} className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-[11px] text-white">✕</button>
        </div>
      ) : (
        <label className="mb-2.5 flex h-[110px] w-full cursor-pointer items-center justify-center rounded-xl border border-dashed border-[var(--line)] text-[12.5px] text-[var(--ink-3)]">📷 Choose a photo — you&rsquo;ll crop it to a square<input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} /></label>
      )}

      <div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">Activity</span><button type="button" onClick={() => setNewAct((v) => !v)} className="text-[11px] font-extrabold text-[#1d3a8f]">{newAct ? "Cancel" : "＋ New activity"}</button></div>
      {newAct ? (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2">
          <input value={actName} onChange={(e) => setActName(e.target.value)} placeholder="Activity name" className={`${inputCls} flex-1`} />
          <input value={actEmoji} onChange={(e) => setActEmoji(e.target.value)} maxLength={2} className={`${inputCls} w-14 text-center`} title="Emoji" />
          <button type="button" onClick={addActivity} className="rounded-md bg-[#1d3a8f] px-2.5 py-1.5 text-[12px] font-bold text-white">Add</button>
        </div>
      ) : (
        <div className="mb-3 flex flex-wrap gap-1.5">{activities.map((a) => <button key={a.k} type="button" onClick={() => setActivity(a.n)} className="rounded-full border-2 px-2.5 py-1 text-[12px] font-bold transition-colors" style={activity === a.n ? { borderColor: a.c, background: `color-mix(in srgb,${a.c} 12%,var(--surface))`, color: a.c } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{a.e} {a.n}</button>)}</div>
      )}

      {lbl(listingId ? "Which children? (search everyone on this listing)" : "Which children? (search everyone you've booked)")}
      {/* selected */}
      {tagged.length > 0 && <div className="mb-2 flex flex-wrap gap-1.5">{tagged.map((id) => { const c = taggable.find((x) => x.childId === id); return (
        <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[#eaf0fc] px-2.5 py-0.5 text-[12px] font-bold" style={{ color: BLUE }}>{c?.name ?? id}<button type="button" onClick={() => setTagged((t) => t.filter((x) => x !== id))} className="text-[#1d3a8f]/60 hover:text-[#1d3a8f]">✕</button></span>
      ); })}</div>}
      {/* search dropdown */}
      <div className="relative mb-3">
        <input value={childQuery} onChange={(e) => { setChildQuery(e.target.value); setMenuOpen(true); }} onFocus={() => setMenuOpen(true)} onBlur={() => setTimeout(() => setMenuOpen(false), 150)} placeholder="Search child, parent or email…" className={`${inputCls} w-full`} disabled={taggable.length === 0} />
        {taggable.length === 0 && <div className="mt-1 text-[11.5px] text-[var(--ink-3)]">No booked children found{listingId ? " on this listing" : ""} yet.</div>}
        {menuOpen && taggable.length > 0 && (() => {
          const q = childQuery.trim().toLowerCase();
          const rows = taggable.filter((c) => !q || `${c.name} ${c.parentName ?? ""} ${c.email ?? ""} ${c.postcode ?? ""}`.toLowerCase().includes(q)).slice(0, 12);
          if (!rows.length) return <div className="absolute z-30 mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--ink-3)] shadow-lg">No match.</div>;
          return (
            <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[0_12px_28px_-12px_rgba(23,21,52,.4)]">
              {rows.map((c) => { const on = tagged.includes(c.childId), allowed = canTag(c); return (
                <button key={c.childId} type="button" disabled={!allowed} onMouseDown={(e) => { e.preventDefault(); if (allowed) setTagged((t) => t.includes(c.childId) ? t.filter((x) => x !== c.childId) : [...t, c.childId]); }}
                  className="flex w-full items-center gap-2 border-b border-[var(--line)] px-3 py-2 text-left last:border-b-0 hover:bg-[#eef4fd] disabled:cursor-not-allowed disabled:opacity-55" style={on ? { background: "#eef4fd" } : undefined}>
                  <span className="flex-1 min-w-0"><span className="text-[12.5px] font-extrabold">{on ? "✓ " : ""}{c.name}</span><span className="block truncate text-[11px] text-[var(--ink-3)]">{[c.parentName, c.postcode, c.listing].filter(Boolean).join(" · ") || c.email || "—"}</span></span>
                  <span className="flex-none rounded-full px-1.5 py-0.5 text-[9px] font-extrabold text-white" style={{ background: c.photoConsent ? GREEN : RED }}>{c.photoConsent ? "consent ✓" : "no photos"}</span>
                </button>
              ); })}
            </div>
          );
        })()}
      </div>

      <div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">What happened?</span><button type="button" onClick={writeAi} className="rounded-full px-2.5 py-1 text-[11px] font-extrabold text-white" style={{ background: `linear-gradient(90deg,${PINK},#7c5cff)` }}>✨ Write for me</button></div>
      <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} placeholder="A quick highlight for the parents…" className={`${inputCls} w-full resize-y leading-[1.5] [field-sizing:content]`} />

      {error && <div className="mt-2 text-[12.5px] font-bold text-[var(--red,#e21d27)]">{error}</div>}
      <div className="mt-2 rounded-lg bg-[#f4f8ff] px-3 py-1.5 text-[11px] text-[var(--ink-2)]">📨 Once posted, the tagged children&rsquo;s parents are notified and emailed a direct link to view it in their area. Photos also land in the gallery, filed under each child and the listing.</div>
      <div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={post} className="rounded-lg px-4 py-1.5 text-[12.5px] font-extrabold text-white disabled:opacity-60" style={{ background: BLUE }}>{busy ? "Posting…" : "Post moment 🚀"}</button><button type="button" onClick={onCancel} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)]">Cancel</button></div>
    </div>
  );
}

export function MomentsApp() {
  const { settings, save } = useSettings();
  const activities = useMemo(() => (settings.moments?.activities?.length ? settings.moments.activities : ACTS), [settings.moments?.activities]);
  const actByName = (name?: string) => activities.find((a) => a.n === name);
  const [moments, setMoments] = useState<Moment[] | null>(null);
  const [listings, setListings] = useState<{ id: string; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [galMode, setGalMode] = useState<"all" | "child" | "listing">("all");
  const [galFolder, setGalFolder] = useState<string | null>(null);
  const [galWhen, setGalWhen] = useState<"all" | "today" | "week">("all");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [replyVals, setReplyVals] = useState<Record<string, string>>({});

  const refresh = useCallback(() => { apiGet<Moment[]>("/api/moments").then((m) => { setMoments(m); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load")); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ id: string; title: string }[]>("/api/listings?mine=1").then((l) => setListings(l.map((x) => ({ id: x.id, title: x.title })))).catch(() => {}); }, []);
  useRealtime(["moments"], refresh);

  async function remove(m: Moment) { if (!confirm("Delete this moment?")) return; try { await api(`/api/moments/${encodeURIComponent(m.id)}`, { method: "DELETE" }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); } }
  async function reply(m: Moment) { const t = (replyVals[m.id] ?? "").trim(); if (!t) return; try { await apiPost(`/api/moments/${encodeURIComponent(m.id)}/comment`, { text: t }); setReplyVals((v) => ({ ...v, [m.id]: "" })); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }
  async function toggleMarketing(m: Moment, idx: number) { try { await apiPost(`/api/moments/${encodeURIComponent(m.id)}/comment/${idx}/marketing`, {}); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }

  const all = useMemo(() => moments ?? [], [moments]);
  const listingName = useMemo(() => new Map(listings.map((l) => [l.id, l.title])), [listings]);
  const featured = useMemo(() => { const m = new Map<string, string>(); for (const mo of all) mo.childIds.forEach((id, i) => { const n = mo.childNames?.[i]; if (n && !m.has(id)) m.set(id, n); }); return [...m.entries()]; }, [all]);
  const photos = useMemo(() => all.filter((m) => m.photoUrl), [all]);
  const marketingQuotes = useMemo(() => all.flatMap((m) => (m.comments ?? []).filter((c) => c.marketing).map((c) => ({ m, c }))), [all]);
  const tiles: [string, number][] = [["Today", all.filter((m) => m.date === todayIso()).length], ["This week", all.filter((m) => (m.date ?? "") >= weekStartIso()).length], ["Photos", photos.length], ["Children featured", featured.length]];

  const inWhen = (m: Moment) => galWhen === "all" || (galWhen === "today" ? m.date === todayIso() : (m.date ?? "") >= weekStartIso());
  const galBase = useMemo(() => photos.filter(inWhen), [photos, galWhen]); // eslint-disable-line react-hooks/exhaustive-deps
  // folders
  const childFolders = useMemo(() => featured.map(([id, n]) => ({ id, label: n, items: galBase.filter((m) => m.childIds.includes(id)) })).filter((f) => f.items.length), [featured, galBase]);
  const listingFolders = useMemo(() => {
    const m = new Map<string, Moment[]>();
    for (const p of galBase) { const k = p.listingId || "_none"; (m.get(k) ?? m.set(k, []).get(k)!).push(p); }
    return [...m.entries()].map(([k, items]) => ({ id: k, label: k === "_none" ? "No listing" : (listingName.get(k) ?? "Listing"), items }));
  }, [galBase, listingName]);
  const openFolder = galFolder ? (galMode === "child" ? childFolders.find((f) => f.id === galFolder) : listingFolders.find((f) => f.id === galFolder)) : null;

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
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
      {posting && <PostForm activities={activities} settings={settings} save={save} listings={listings} onPosted={() => { setPosting(false); refresh(); }} onCancel={() => setPosting(false)} />}

      {/* marketing quotes — parent comments the operator starred */}
      {marketingQuotes.length > 0 && (
        <div className="mb-4 rounded-2xl border border-[#f6e2a8] bg-[#fffdf3] p-3.5">
          <div className="mb-2 text-[13px] font-extrabold" style={{ color: "#9a5a00", fontFamily: "var(--ff-display)" }}>⭐ Marketing quotes <span className="text-[11px] font-semibold text-[var(--ink-3)]">— starred parent comments you can reuse</span></div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{marketingQuotes.map(({ m, c }, i) => (
            <blockquote key={i} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-[12.5px] italic leading-[1.5] text-[var(--ink-2)]">“{c.text}”<div className="mt-1.5 text-[11px] not-italic text-[var(--ink-3)]">— {c.byName}{m.childNames?.filter(Boolean)[0] ? `, parent of ${m.childNames.filter(Boolean)[0]}` : ""}</div></blockquote>
          ))}</div>
        </div>
      )}

      {/* gallery with folders */}
      {photos.length > 0 && (
        <div className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>🖼️ Photo gallery</span>
            <div className="flex flex-wrap gap-1.5">
              {([["all", "All"], ["child", "By child"], ["listing", "By listing"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => { setGalMode(k); setGalFolder(null); }} className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold" style={galMode === k ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{l}</button>)}
              <span className="mx-0.5 text-[var(--ink-3)]">·</span>
              {([["all", "All dates"], ["today", "Today"], ["week", "This week"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setGalWhen(k)} className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold" style={galWhen === k ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{l}</button>)}
            </div>
          </div>
          {galMode !== "all" && !openFolder ? (
            <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))" }}>
              {(galMode === "child" ? childFolders : listingFolders).map((f) => (
                <button key={f.id} type="button" onClick={() => setGalFolder(f.id)} className="overflow-hidden rounded-xl border border-[var(--line)] text-left">
                  <div className="relative aspect-square bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.items[0].photoUrl} alt="" className="h-full w-full object-cover" />
                    <span className="absolute bottom-1 right-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-extrabold text-white">{f.items.length}</span>
                  </div>
                  <div className="truncate px-2 py-1.5 text-[12px] font-bold">📁 {f.label}</div>
                </button>
              ))}
              {(galMode === "child" ? childFolders : listingFolders).length === 0 && <div className="text-[12px] text-[var(--ink-3)]">No photos in this range.</div>}
            </div>
          ) : (
            <>
              {openFolder && <button type="button" onClick={() => setGalFolder(null)} className="mb-2 text-[12px] font-bold text-[#1d3a8f]">← All folders · <span className="text-[var(--ink)]">📁 {openFolder.label}</span></button>}
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(94px,1fr))" }}>
                {(openFolder ? openFolder.items : galBase).map((m) => (
                  <button key={m.id} type="button" onClick={() => setLightbox(m.photoUrl!)} className="relative aspect-square overflow-hidden rounded-lg bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.photoUrl} alt={m.caption ?? ""} className="h-full w-full object-cover" />
                    {m.photoType === "work" && <span className="absolute bottom-1 left-1 rounded-full px-1.5 py-0.5 text-[8.5px] font-extrabold text-white" style={{ background: GREEN }}>Work</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* feed */}
      {!moments ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
        : all.length === 0 ? <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-12 text-center text-[13px] text-[var(--ink-3)]">No moments yet — share the first one.</div>
        : (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {all.map((m) => { const a = actByName(m.activity), col = a?.c ?? PINK; return (
              <div key={m.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
                {m.photoUrl ? (
                  <button type="button" onClick={() => setLightbox(m.photoUrl!)} className="relative block aspect-square w-full bg-black">
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
                  {m.listingId && listingName.get(m.listingId) && <div className="mt-1 text-[11px] text-[var(--ink-3)]">📁 {listingName.get(m.listingId)}</div>}
                  <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-[var(--ink-3)]"><span className="truncate">👤 {m.postedByName} · {when(m.createdAt)}</span><span className="flex flex-none gap-2">{m.photoUrl && <a href={m.photoUrl} download={`${(m.childNames?.filter(Boolean)[0] ?? "moment")}-${m.date}.jpg`} className="font-bold" style={{ color: BLUE }}>⬇ Download</a>}{canManage && <button type="button" onClick={() => remove(m)} className="font-bold" style={{ color: RED }}>Delete</button>}</span></div>
                  {((m.comments?.length ?? 0) > 0 || canManage) && (
                    <div className="mt-2 border-t border-[var(--line)] pt-2">
                      {(m.comments ?? []).map((c, idx) => (
                        <div key={idx} className="mb-1 flex items-start gap-1.5 text-[11.5px] leading-[1.5]">
                          <span className="flex-none font-bold" style={{ color: c.role === "parent" ? BLUE : "var(--ink)" }}>{c.byName}{c.role === "parent" ? "" : " (you)"}:</span>
                          <span className="flex-1 text-[var(--ink-2)]">{c.text}</span>
                          {canManage && <button type="button" onClick={() => toggleMarketing(m, idx)} title={c.marketing ? "Starred for marketing" : "Use as marketing"} className="flex-none text-[14px] leading-none" style={{ color: c.marketing ? "#f0b100" : "var(--ink-3)" }}>{c.marketing ? "★" : "☆"}</button>}
                        </div>
                      ))}
                      {canManage && <div className="mt-1 flex gap-1.5"><input value={replyVals[m.id] ?? ""} onChange={(e) => setReplyVals((v) => ({ ...v, [m.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") reply(m); }} placeholder="Reply…" className="flex-1 rounded-md border border-[var(--line)] px-2 py-1 text-[11.5px] outline-none focus:border-[#1d3a8f]" /><button type="button" onClick={() => reply(m)} className="rounded-md border border-[var(--line)] px-2 py-1 text-[11px] font-bold" style={{ color: BLUE }}>Send</button></div>}
                    </div>
                  )}
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
