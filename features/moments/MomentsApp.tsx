"use client";

import { dateLocale as dl, uiDateTime, uiDate } from "@/lib/i18n/format";
import { useT, useI18n, tNow } from "@/lib/i18n/provider";
import { pickPlural } from "@/lib/i18n/plural";
import { richT } from "@/components/shell/richT";
import { isRTL } from "@/lib/i18n/config";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import type { SavedImage } from "@/lib/settings";
import { composeMomentImage, triggerDownload } from "@/lib/momentImage";
import { TourLauncher } from "@/features/common/TourLauncher";

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
const HERO = "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 100%)";
const BLUE = "#1d3a8f", PINK = "#be1259", GREEN = "#0f7a43", RED = "#c02636";
const ACT_PALETTE = ["#be1259", "#047857", "#0369a1", "#b45309", "#0e7490", "#6d28d9", "#c2410c", "#4338ca", "#b91c1c", "#7c3aed"];
const ACTS: Act[] = [
  { k: "art", n: "Arts & crafts", e: "🎨", c: "#be1259" }, { k: "sport", n: "Sports", e: "⚽", c: "#047857" },
  { k: "swim", n: "Swimming", e: "🏊", c: "#0369a1" }, { k: "food", n: "Lunch & snack", e: "🍎", c: "#b45309" },
  { k: "nature", n: "Outdoors", e: "🌳", c: "#0e7490" }, { k: "science", n: "Science", e: "🔬", c: "#6d28d9" },
  { k: "drama", n: "Drama", e: "🎭", c: "#c2410c" }, { k: "play", n: "Free play", e: "🧩", c: "#4338ca" },
];
// Default activity names are stored as typed; show the translated name for the built-in ones only.
const ACT_NAME_KEY: Record<string, string> = { "Arts & crafts": "p8ops.moActArts", Sports: "p8ops.moActSports", Swimming: "p8ops.moActSwim", "Lunch & snack": "p8ops.moActFood", Outdoors: "p8ops.moActNature", Science: "p8ops.moActScience", Drama: "p8ops.moActDrama", "Free play": "p8ops.moActPlay" };
const actLabel = (n: string) => (ACT_NAME_KEY[n] ? tNow(ACT_NAME_KEY[n]) : n);
const listNames = (xs: string[]) => { try { return new Intl.ListFormat(dl(), { style: "long", type: "conjunction" }).format(xs); } catch { return xs.join(", "); } };
const inputCls = "rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]";
const pad = (n: number) => String(n).padStart(2, "0");
const todayIso = () => { const t = new Date(); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
const when = (iso?: string) => (iso ? uiDateTime(new Date(iso), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const fmtNice = (iso?: string) => (iso ? uiDate(new Date(`${iso}T00:00:00`), { day: "numeric", month: "long", year: "numeric" }) : "");
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
const AI_KEY: Record<string, string> = { "Arts & crafts": "Art", Sports: "Sport", Swimming: "Swim", "Lunch & snack": "Food", Outdoors: "Nature", Science: "Science", Drama: "Drama", "Free play": "Play" };
// English keeps the original combinable phrases; every other language picks one of three ready-made sentences for the activity.
function aiCaption(names: string, activity: string) {
  if (dl().startsWith("en")) { const a = AICAP[activity] ?? AICAP["Free play"]; return `${pick(a.o).replace("{N}", names)}, ${pick(a.m)}${pick(AICLOSE)}`; }
  return tNow(`p8ops.moAi${AI_KEY[activity] ?? "Play"}${1 + Math.floor(Math.random() * 3)}`, { N: names });
}

// ── square cropper ───────────────────────────────────────────────────────────
function Cropper({ src, onDone, onCancel }: { src: string; onDone: (dataUrl: string) => void; onCancel: () => void }) {
  const tr = useT();
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
        <div className="mb-2 text-[13.5px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{tr("p8ops.moCrop")}</div>
        <div className="relative mx-auto overflow-hidden rounded-xl bg-black" style={{ width: FRAME, height: FRAME, touchAction: "none" }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imgRef} src={src} alt="" onLoad={onLoad} draggable={false} className="max-w-none select-none" style={{ width: dispW, height: dispH, transform: `translate(${off.x}px,${off.y}px)`, cursor: "grab" }} />
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--ink-3)]">🔍<input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => onZoom(parseFloat(e.target.value))} className="flex-1" /></div>
        <div className="mt-1 text-center text-[10.5px] text-[var(--ink-3)]">{tr("p8ops.moCropHint")}</div>
        <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">{tr("p8ops.rtCancel")}</button><button type="button" onClick={bake} className="rounded-lg bg-[#1d3a8f] px-4 py-1.5 text-[12px] font-extrabold text-white">{tr("p8ops.moUsePhoto")}</button></div>
      </div>
    </div>
  );
}

function PostForm({ activities, settings, save, listings, initialChild, onPosted, onCancel }: { activities: Act[]; settings: SettingsShape; save: SaveFn; listings: { id: string; title: string }[]; initialChild?: string; onPosted: () => void; onCancel: () => void }) {
  const tr = useT();
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

  useEffect(() => { apiGet<Taggable[]>(`/api/moments/taggable${listingId ? `?listingId=${encodeURIComponent(listingId)}` : ""}`).then((t) => { setTaggable(t); const pre = initialChild ? t.filter((x) => x.name.trim().toLowerCase() === initialChild.trim().toLowerCase() && x.photoConsent).map((x) => x.childId) : []; setTagged(pre); }).catch(() => setTaggable([])); }, [listingId, initialChild]);

  const canTag = (c: Taggable) => photoType === "work" || c.photoConsent;
  const noConsentTagged = tagged.map((id) => taggable.find((c) => c.childId === id)).filter((c): c is Taggable => !!c && !c.photoConsent);
  const nameList = (cs: Taggable[]) => listNames(cs.map((c) => c.name));
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (f) setRawPhoto(await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(f); })); }
  const writeAi = () => { const names = tagged.map((id) => taggable.find((c) => c.childId === id)?.name).filter(Boolean) as string[]; setCaption(aiCaption(names.length ? listNames(names) : tr("p8ops.moYourChildCap"), activity)); };
  async function addActivity() { const n = actName.trim(); if (!n) return; const c = ACT_PALETTE[activities.length % ACT_PALETTE.length]; const next = [...activities, { k: `a${Date.now()}`, n, e: actEmoji.trim() || "🎉", c }]; await save({ settings: { ...settings, moments: { ...settings.moments, activities: next } } }); setActivity(n); setNewAct(false); setActName(""); setActEmoji("🎉"); }

  async function post() {
    if (!preview && !caption.trim()) { setError(tr("p8ops.moNeedPhoto")); return; }
    const ids = photoType === "work" ? tagged : tagged.filter((id) => taggable.find((c) => c.childId === id)?.photoConsent);
    setBusy(true); setError(null);
    try {
      let url: string | undefined;
      if (preview) url = (await apiPost<{ url: string }>("/api/uploads", { dataUrl: preview, purpose: "private" })).url;
      await apiPost("/api/moments", { photoUrl: url, caption: caption.trim() || undefined, activity, photoType, date, listingId: listingId || undefined, childIds: ids });
      onPosted();
    } catch (e) { setError(e instanceof Error ? e.message : tr("p8ops.moCouldntPost")); setBusy(false); }
  }

  const lbl = (s: string) => <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">{s}</div>;
  return (
    <div className="mb-3.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      {rawPhoto && <Cropper src={rawPhoto} onDone={(d) => { setPreview(d); setRawPhoto(null); }} onCancel={() => setRawPhoto(null)} />}
      <div className="mb-2.5 text-[14px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{tr("p8ops.moShare")}</div>

      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">{lbl(tr("p8ops.moWhichCamp"))}<select value={listingId} onChange={(e) => setListingId(e.target.value)} className={`${inputCls} w-full`}><option value="">{tr("p8ops.tpAllMyBookings")}</option>{listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select></label>
        <label className="flex flex-col gap-1">{lbl(tr("p8ops.rgHdrDate"))}<input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} className={`${inputCls} w-full`} /></label>
      </div>

      {lbl(tr("p8ops.moPhotoSq"))}
      <div className="mb-1.5 flex gap-1.5">{(["child", "work"] as const).map((pt) => <button key={pt} type="button" onClick={() => setPhotoType(pt)} className="rounded-full border-2 px-3 py-1 text-[12px] font-bold transition-colors" style={photoType === pt ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{pt === "child" ? tr("p8ops.moChildPhoto") : tr("p8ops.moTheirWork")}</button>)}</div>
      {photoType === "work" && <div className="mb-2 rounded-lg bg-[#e7f6ee] px-3 py-1.5 text-[11.5px]" style={{ color: GREEN }}>{tr("p8ops.moWorkNote")}</div>}
      {photoType === "child" && <div className="mb-2 rounded-lg bg-[#fdf3d8] px-3 py-1.5 text-[11.5px]" style={{ color: "#9a5a00" }}>{richT(tr, "p8ops.moChildNote", { consent: <b>{tr("p8ops.moPhotoConsentB")}</b> })}</div>}
      {photoType === "work" && noConsentTagged.length > 0 && <div className="mb-2 rounded-lg border border-[#f4c4c4] bg-[#fef2f2] px-3 py-2 text-[11.5px] leading-[1.5]" style={{ color: RED }}>{richT(tr, "p8ops.moNoConsentWarn", { names: <b>{nameList(noConsentTagged)}</b>, work: <b>{tr("p8ops.moWorkOnlyB")}</b> })}</div>}
      {preview ? (
        <div className="relative mb-2.5 w-[160px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="aspect-square w-[160px] rounded-xl object-cover" />
          <button type="button" onClick={() => setPreview(null)} className="absolute end-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-[11px] text-white">✕</button>
        </div>
      ) : (
        <label className="mb-2.5 flex h-[110px] w-full cursor-pointer items-center justify-center rounded-xl border border-dashed border-[var(--line)] text-[12.5px] text-[var(--ink-3)]">{tr("p8ops.moChoosePhoto")}<input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} /></label>
      )}

      <div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">{tr("p8ops.moActivity")}</span><button type="button" onClick={() => setNewAct((v) => !v)} className="text-[11px] font-extrabold text-[#1d3a8f]">{newAct ? tr("p8ops.rtCancel") : tr("p8ops.moNewAct")}</button></div>
      {newAct ? (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2">
          <input value={actName} onChange={(e) => setActName(e.target.value)} placeholder={tr("p8ops.moActName")} className={`${inputCls} flex-1`} />
          <input value={actEmoji} onChange={(e) => setActEmoji(e.target.value)} maxLength={2} className={`${inputCls} w-14 text-center`} title={tr("p8ops.moEmoji")} />
          <button type="button" onClick={addActivity} className="rounded-md bg-[#1d3a8f] px-2.5 py-1.5 text-[12px] font-bold text-white">{tr("p8ops.moAddBtn")}</button>
        </div>
      ) : (
        <div className="mb-3 flex flex-wrap gap-1.5">{activities.map((a) => <button key={a.k} type="button" onClick={() => setActivity(a.n)} className="rounded-full border-2 px-2.5 py-1 text-[12px] font-bold transition-colors" style={activity === a.n ? { borderColor: a.c, background: `color-mix(in srgb,${a.c} 12%,var(--surface))`, color: a.c } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{a.e} {actLabel(a.n)}</button>)}</div>
      )}

      {lbl(listingId ? tr("p8ops.moWhichKidsL") : tr("p8ops.moWhichKids"))}
      {/* selected */}
      {tagged.length > 0 && <div className="mb-2 flex flex-wrap gap-1.5">{tagged.map((id) => { const c = taggable.find((x) => x.childId === id); return (
        <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[#eaf0fc] px-2.5 py-0.5 text-[12px] font-bold" style={{ color: BLUE }}>{c?.name ?? id}<button type="button" onClick={() => setTagged((tg) => tg.filter((x) => x !== id))} className="text-[#1d3a8f]/60 hover:text-[#1d3a8f]">✕</button></span>
      ); })}</div>}
      {/* search dropdown */}
      <div className="relative mb-3">
        <input value={childQuery} onChange={(e) => { setChildQuery(e.target.value); setMenuOpen(true); }} onFocus={() => setMenuOpen(true)} onBlur={() => setTimeout(() => setMenuOpen(false), 150)} placeholder={tr("p8ops.moSearchKid")} className={`${inputCls} w-full`} disabled={taggable.length === 0} />
        {taggable.length === 0 && <div className="mt-1 text-[11.5px] text-[var(--ink-3)]">{listingId ? tr("p8ops.moNoBookedL") : tr("p8ops.moNoBooked")}</div>}
        {menuOpen && taggable.length > 0 && (() => {
          const q = childQuery.trim().toLowerCase();
          const rows = taggable.filter((c) => !q || `${c.name} ${c.parentName ?? ""} ${c.email ?? ""} ${c.postcode ?? ""}`.toLowerCase().includes(q)).slice(0, 12);
          if (!rows.length) return <div className="absolute z-30 mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--ink-3)] shadow-lg">{tr("p8ops.moNoMatch")}</div>;
          return (
            <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[0_12px_28px_-12px_rgba(23,21,52,.4)]">
              {rows.map((c) => { const on = tagged.includes(c.childId), allowed = canTag(c); return (
                <button key={c.childId} type="button" disabled={!allowed} onMouseDown={(e) => { e.preventDefault(); if (allowed) setTagged((tg) => tg.includes(c.childId) ? tg.filter((x) => x !== c.childId) : [...tg, c.childId]); }}
                  className="flex w-full items-center gap-2 border-b border-[var(--line)] px-3 py-2 text-start last:border-b-0 hover:bg-[#eef4fd] disabled:cursor-not-allowed disabled:opacity-55" style={on ? { background: "#eef4fd" } : undefined}>
                  <span className="flex-1 min-w-0"><span className="text-[12.5px] font-extrabold">{on ? "✓ " : ""}{c.name}</span><span className="block truncate text-[11px] text-[var(--ink-3)]">{[c.parentName, c.postcode, c.listing].filter(Boolean).join(" · ") || c.email || "—"}</span></span>
                  <span className="flex-none rounded-full px-1.5 py-0.5 text-[9px] font-extrabold text-white" style={{ background: c.photoConsent ? GREEN : RED }}>{c.photoConsent ? tr("p8ops.moConsentOk") : tr("p8ops.moNoPhotos")}</span>
                </button>
              ); })}
            </div>
          );
        })()}
      </div>

      <div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">{tr("p8ops.moWhatHappened")}</span><button type="button" onClick={writeAi} className="rounded-full px-2.5 py-1 text-[11px] font-extrabold text-white" style={{ background: `linear-gradient(90deg,${PINK},#7c5cff)` }}>{tr("p8ops.moWriteForMe")}</button></div>
      <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} placeholder={tr("p8ops.moHighlightPh")} className={`${inputCls} w-full resize-y leading-[1.5] [field-sizing:content]`} />

      {error && <div className="mt-2 text-[12.5px] font-bold text-[var(--red,#e21d27)]">{error}</div>}
      <div className="mt-2 rounded-lg bg-[#f4f8ff] px-3 py-1.5 text-[11px] text-[var(--ink-2)]">{tr("p8ops.moPostNote")}</div>
      <div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={post} className="rounded-lg px-4 py-1.5 text-[12.5px] font-extrabold text-white disabled:opacity-60" style={{ background: "#2f5fd0" }}>{busy ? tr("p8ops.moPosting") : tr("p8ops.moPost")}</button><button type="button" onClick={onCancel} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)]">{tr("p8ops.rtCancel")}</button></div>
    </div>
  );
}

export function MomentsApp() {
  const tr = useT();
  const { locale } = useI18n();
  // Deep-link from the Register: ?child=Name opens "Share a moment" pre-tagged.
  const searchParams = useSearchParams();
  const presetChild = searchParams.get("child") ?? "";
  const { settings, save } = useSettings();
  const activities = useMemo(() => (settings.moments?.activities?.length ? settings.moments.activities : ACTS), [settings.moments?.activities]);
  const actByName = (name?: string) => activities.find((a) => a.n === name);
  const [moments, setMoments] = useState<Moment[] | null>(null);
  const [listings, setListings] = useState<{ id: string; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(!!presetChild);
  const [canManage, setCanManage] = useState(false);
  const [galMode, setGalMode] = useState<"all" | "child" | "listing">("all");
  const [galFolder, setGalFolder] = useState<string | null>(null);
  const [galWhen, setGalWhen] = useState<"all" | "today" | "week">("all");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [replyVals, setReplyVals] = useState<Record<string, string>>({});
  const [dlFor, setDlFor] = useState<string | null>(null);
  const [dlRatio, setDlRatio] = useState<"square" | "portrait" | "story">("square");
  const [dlInc, setDlInc] = useState({ caption: true, quote: true, comments: false });
  const [dlColor, setDlColor] = useState("#171534");
  const [dlFit, setDlFit] = useState<"cover" | "contain">("contain");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const refresh = useCallback(() => { apiGet<Moment[]>("/api/moments").then((m) => {
    // Years of moments pile up across a whole tenant; useRealtime re-triggers this on every
    // moments change (any staff member, any child). Bail out of the state update (keep the
    // same array reference) when the fetched payload is content-identical to what's loaded,
    // so the gallery/folder useMemos below don't re-derive over the full list for nothing.
    setMoments((prev) => {
      try { if (prev && prev.length === m.length && JSON.stringify(prev) === JSON.stringify(m)) return prev; } catch { /* fall through */ }
      return m;
    });
    setError(null);
  }).catch((e) => setError(e instanceof Error ? e.message : tr("p8ops.dbFailedLoad"))); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ id: string; title: string }[]>("/api/listings?mine=1").then((l) => setListings(l.map((x) => ({ id: x.id, title: x.title })))).catch(() => {}); }, []);
  useRealtime(["moments"], refresh);
  useEffect(() => { if (!savedMsg) return; const tm = setTimeout(() => setSavedMsg(null), 3800); return () => clearTimeout(tm); }, [savedMsg]);

  async function remove(m: Moment) { if (!confirm(tr("p8ops.moConfirmDelete"))) return; try { await api(`/api/moments/${encodeURIComponent(m.id)}`, { method: "DELETE" }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : tr("p8ops.sgDeleteFailed")); } }
  async function reply(m: Moment) { const txt = (replyVals[m.id] ?? "").trim(); if (!txt) return; try { await apiPost(`/api/moments/${encodeURIComponent(m.id)}/comment`, { text: txt }); setReplyVals((v) => ({ ...v, [m.id]: "" })); refresh(); } catch (e) { setError(e instanceof Error ? e.message : tr("p8ops.tpFailed")); } }
  // Star/unstar a parent comment as a marketing quote. Starring lets the quote be
  // shown under this moment's photo in the Email marketing area.
  async function toggleMarketing(m: Moment, idx: number) {
    try { await apiPost(`/api/moments/${encodeURIComponent(m.id)}/comment/${idx}/marketing`, {}); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : tr("p8ops.tpFailed")); }
  }

  // Resolve which caption/quotes the include-toggles bake in — shared by download
  // and "save to Email" so both produce the same banner.
  function resolveInc(m: Moment, inc: { caption: boolean; quote: boolean; comments: boolean }) {
    const parentComments = (m.comments ?? []).filter((c) => c.role === "parent");
    const chosen: Comment[] = [];
    if (inc.quote) chosen.push(...parentComments.filter((c) => c.marketing));
    if (inc.comments) for (const c of parentComments) if (!chosen.includes(c)) chosen.push(c);
    return {
      caption: inc.caption ? (m.caption ?? "") : "",
      quotes: chosen.map((c) => ({ text: c.text, byName: c.byName, marketing: c.marketing })),
    };
  }
  const momentFooter = (m: Moment) => [m.postedByName, m.childNames?.filter(Boolean).join(", "), fmtNice(m.date)].filter(Boolean).join(" · ");

  // Compose the photo with a clean caption/quote BANNER beneath it, then download.
  async function downloadComposite(m: Moment, ratio: "square" | "portrait" | "story", inc: { caption: boolean; quote: boolean; comments: boolean }, color: string, fit: "cover" | "contain") {
    if (!m.photoUrl) return;
    const { caption, quotes } = resolveInc(m, inc);
    const dataUrl = await composeMomentImage({ photoUrl: m.photoUrl, ratio, color, caption, quotes, footer: momentFooter(m), fit });
    if (dataUrl) triggerDownload(dataUrl, `${(m.childNames?.filter(Boolean)[0] ?? "moment").replace(/\s+/g, "-")}-${m.date}-${ratio}.jpg`);
    else { triggerDownload(m.photoUrl, "moment.jpg"); setError(tr("p8ops.moCouldntCompose")); }
    setDlFor(null);
  }

  // The moment's parent comments, snapshotted so the Email editor can re-toggle quotes.
  const srcComments = (m: Moment) => (m.comments ?? []).filter((c) => c.role === "parent").map((c) => ({ text: c.text, byName: c.byName, marketing: c.marketing }));

  // Build a plain photo-only saved asset (no banner) — used by "move all". Carries
  // the source caption/comments so it's still fully editable in the Email area.
  const photoOnlyAsset = (m: Moment, savedAt: string): SavedImage => ({
    id: `img_${m.id}_${savedAt}`, momentId: m.id, photoUrl: m.photoUrl!, ratio: "square", fit: "contain", color: dlColor,
    include: { caption: false, quote: false, comments: false }, sourceCaption: m.caption || undefined, sourceComments: srcComments(m),
    footer: momentFooter(m), childName: m.childNames?.filter(Boolean)[0], activity: m.activity, savedAt,
  });

  // Push a Moments image into the Email area as a re-editable snapshot.
  async function saveImageToEmail(m: Moment, ratio: "square" | "portrait" | "story", inc: { caption: boolean; quote: boolean; comments: boolean }, color: string, fit: "cover" | "contain") {
    if (!m.photoUrl) return;
    const savedAt = new Date().toISOString();
    const asset: SavedImage = {
      id: `img_${m.id}_${savedAt}`, momentId: m.id, photoUrl: m.photoUrl, ratio, fit, color,
      include: inc, sourceCaption: m.caption || undefined, sourceComments: srcComments(m), footer: momentFooter(m),
      childName: m.childNames?.filter(Boolean)[0], activity: m.activity, savedAt,
    };
    const cur = settings.emailAssets ?? {};
    await save({ settings: { ...settings, emailAssets: { ...cur, images: [asset, ...(cur.images ?? [])] } } });
    setDlFor(null); setSavedMsg(tr("p8ops.moSavedToEmail"));
  }

  // Move EVERY current photo into the Email area (photo-only, skipping any already there).
  async function saveAllPhotosToEmail() {
    const savedIds = new Set((settings.emailAssets?.images ?? []).map((im) => im.momentId));
    const missing = (moments ?? []).filter((m) => m.photoUrl && !savedIds.has(m.id));
    if (!missing.length) { setSavedMsg(tr("p8ops.moAllAlready")); return; }
    const savedAt = new Date().toISOString();
    const additions = missing.map((m) => photoOnlyAsset(m, savedAt));
    const cur = settings.emailAssets ?? {};
    await save({ settings: { ...settings, emailAssets: { ...cur, images: [...additions, ...(cur.images ?? [])] } } });
    setSavedMsg(tr("p8ops.moMovedN", { cnt: pickPlural(tr, locale, "p8ops.moPhotoN", additions.length) }));
  }

  // Toggle the "keep new photos flowing to Email" mirror.
  async function toggleAutoAdd() {
    const cur = settings.emailAssets ?? {};
    const next = !cur.autoAddPhotos;
    await save({ settings: { ...settings, emailAssets: { ...cur, autoAddPhotos: next } } });
    setSavedMsg(next ? tr("p8ops.moAutoOnMsg") : tr("p8ops.moAutoOffMsg"));
  }

  const all = useMemo(() => moments ?? [], [moments]);
  const listingName = useMemo(() => new Map(listings.map((l) => [l.id, l.title])), [listings]);
  const featured = useMemo(() => { const m = new Map<string, string>(); for (const mo of all) mo.childIds.forEach((id, i) => { const n = mo.childNames?.[i]; if (n && !m.has(id)) m.set(id, n); }); return [...m.entries()]; }, [all]);
  const photos = useMemo(() => all.filter((m) => m.photoUrl), [all]);
  const tiles: [string, number][] = [[tr("p8ops.dbToday"), all.filter((m) => m.date === todayIso()).length], [tr("p8ops.moThisWeek"), all.filter((m) => (m.date ?? "") >= weekStartIso()).length], [tr("p8ops.moPhotosTile"), photos.length], [tr("p8ops.moFeaturedTile"), featured.length]];

  const inWhen = (m: Moment) => galWhen === "all" || (galWhen === "today" ? m.date === todayIso() : (m.date ?? "") >= weekStartIso());
  const galBase = useMemo(() => photos.filter(inWhen), [photos, galWhen]); // eslint-disable-line react-hooks/exhaustive-deps
  // folders
  const childFolders = useMemo(() => featured.map(([id, n]) => ({ id, label: n, items: galBase.filter((m) => m.childIds.includes(id)) })).filter((f) => f.items.length), [featured, galBase]);
  const listingFolders = useMemo(() => {
    const m = new Map<string, Moment[]>();
    for (const p of galBase) { const k = p.listingId || "_none"; (m.get(k) ?? m.set(k, []).get(k)!).push(p); }
    return [...m.entries()].map(([k, items]) => ({ id: k, label: k === "_none" ? tr("p8ops.moNoListing") : (listingName.get(k) ?? tr("p8ops.moListingWord")), items }));
  }, [galBase, listingName, tr]);
  const openFolder = galFolder ? (galMode === "child" ? childFolders.find((f) => f.id === galFolder) : listingFolders.find((f) => f.id === galFolder)) : null;
  // The big feed below tracks the open folder — pick a child and you see only
  // that child's moments; otherwise the whole feed.
  const feed = openFolder ? openFolder.items : all;

  // Auto-add mirror: when on, any newly-posted photo not yet in the Email area
  // is pushed there (photo-only). The empty-diff guard stops it looping on its
  // own optimistic write.
  useEffect(() => {
    const ea = settings.emailAssets;
    if (!ea?.autoAddPhotos) return;
    const savedIds = new Set((ea.images ?? []).map((im) => im.momentId));
    const missing = (moments ?? []).filter((m) => m.photoUrl && !savedIds.has(m.id));
    if (!missing.length) return;
    const tm = setTimeout(() => {
      const savedAt = new Date().toISOString();
      const additions: SavedImage[] = missing.map((m) => ({
        id: `img_${m.id}_${savedAt}`, momentId: m.id, photoUrl: m.photoUrl!, ratio: "square", fit: "contain", color: "#171534",
        include: { caption: false, quote: false, comments: false }, sourceCaption: m.caption || undefined,
        sourceComments: (m.comments ?? []).filter((c) => c.role === "parent").map((c) => ({ text: c.text, byName: c.byName, marketing: c.marketing })),
        footer: [m.postedByName, m.childNames?.filter(Boolean).join(", "), fmtNice(m.date)].filter(Boolean).join(" · "),
        childName: m.childNames?.filter(Boolean)[0], activity: m.activity, savedAt,
      }));
      save({ settings: { ...settings, emailAssets: { ...ea, images: [...additions, ...(ea.images ?? [])] } } });
    }, 300);
    return () => clearTimeout(tm);
  }, [moments, settings, save]);

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-3 sm:-m-5 sm:p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), ${HERO}`, backgroundSize: "18px 18px, cover, cover, cover, cover", backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">📷</span>{tr("p8ops.moTitle")}</div>
            <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-[1.5] text-white/85">{tr("p8ops.moLede")}</p>
          </div>
          <div className="flex flex-none flex-wrap items-center gap-2">
            <TourLauncher view="moments" compact />
            {!posting && <button type="button" onClick={() => setPosting(true)} className="rounded-full bg-[var(--surface)] px-4 py-2 text-[13px] font-extrabold text-[#2f5fd0] shadow-md transition-transform hover:-translate-y-px">{tr("p8ops.moShareBtn")}</button>}
          </div>
        </div>
        {moments && <div className="mt-4 flex flex-wrap gap-2.5">{tiles.map(([label, v]) => <div key={label} className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{v}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{label}</div></div>)}</div>}
      </div>

      {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#e21d27]">{error}</div>}
      {savedMsg && <div className="mb-3 rounded-lg border border-[var(--line)] bg-[#eaf0fc] px-3 py-2 text-[12.5px] font-semibold text-[#1d3a8f]">✉️ {savedMsg}</div>}
      {posting && <PostForm activities={activities} settings={settings} save={save} listings={listings} initialChild={presetChild} onPosted={() => { setPosting(false); refresh(); }} onCancel={() => setPosting(false)} />}

      {/* gallery with folders */}
      {photos.length > 0 && (
        <div className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{tr("p8ops.moGallery")}</span>
            <div className="flex flex-wrap gap-1.5">
              {([["all", tr("p8ops.tpAll")], ["child", tr("p8ops.moByChild")], ["listing", tr("p8ops.moByListing")]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => { setGalMode(k); setGalFolder(null); }} className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold" style={galMode === k ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{l}</button>)}
              <span className="mx-0.5 text-[var(--ink-3)]">·</span>
              {([["all", tr("p8ops.moAllDates")], ["today", tr("p8ops.dbToday")], ["week", tr("p8ops.moThisWeek")]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setGalWhen(k)} className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold" style={galWhen === k ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{l}</button>)}
            </div>
          </div>
          {canManage && (() => {
            const savedCount = settings.emailAssets?.images?.length ?? 0;
            const savedIds = new Set((settings.emailAssets?.images ?? []).map((im) => im.momentId));
            const unsaved = (moments ?? []).filter((m) => m.photoUrl && !savedIds.has(m.id)).length;
            const auto = !!settings.emailAssets?.autoAddPhotos;
            return (
              <div className="mb-2.5 flex flex-wrap items-center gap-2 rounded-xl border border-[#f6e2a8] bg-[#fffdf3] px-3 py-2">
                <span className="text-[11.5px] font-bold text-[#9a5a00]">{tr("p8ops.moEmailArea")}</span>
                <button type="button" onClick={saveAllPhotosToEmail} disabled={unsaved === 0} className="rounded-full px-3 py-0.5 text-[11px] font-extrabold text-white disabled:opacity-45" style={{ background: "#9a5a00" }}>{tr("p8ops.moMoveAll")}{unsaved ? ` (${unsaved})` : ""}</button>
                <button type="button" onClick={toggleAutoAdd} className="flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[11px] font-bold" style={auto ? { borderColor: GREEN, background: "#e7f6ee", color: GREEN } : { borderColor: "var(--line)", color: "var(--ink-2)" }} title={tr("p8ops.moAutoTip")}>{auto ? tr("p8ops.moAutoOnBtn") : tr("p8ops.moAutoOff")}</button>
                <span className="text-[10.5px] text-[var(--ink-3)]">{tr("p8ops.moEmailCount", { cnt: pickPlural(tr, locale, "p8ops.moPhotoN", savedCount), status: auto ? tr("p8ops.moAutoSyncOn") : tr("p8ops.moAutoSyncOff") })}</span>
              </div>
            );
          })()}
          {galMode !== "all" && !openFolder ? (
            <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))" }}>
              {(galMode === "child" ? childFolders : listingFolders).map((f) => (
                <button key={f.id} type="button" onClick={() => setGalFolder(f.id)} className="overflow-hidden rounded-xl border border-[var(--line)] text-start">
                  <div className="relative aspect-square bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.items[0].photoUrl} alt="" className="h-full w-full object-cover" />
                    <span className="absolute bottom-1 end-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-extrabold text-white">{f.items.length}</span>
                  </div>
                  <div className="truncate px-2 py-1.5 text-[12px] font-bold">📁 {f.label}</div>
                </button>
              ))}
              {(galMode === "child" ? childFolders : listingFolders).length === 0 && <div className="text-[12px] text-[var(--ink-3)]">{tr("p8ops.moNoPhotosRange")}</div>}
            </div>
          ) : (
            <>
              {openFolder && <button type="button" onClick={() => setGalFolder(null)} className="mb-2 text-[12px] font-bold text-[#1d3a8f]">{isRTL(locale) ? tr("p8ops.moAllFolders") : tr("p8ops.moAllFolders")} <span className="text-[var(--ink)]">📁 {openFolder.label}</span></button>}
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(94px,1fr))" }}>
                {(openFolder ? openFolder.items : galBase).map((m) => (
                  <button key={m.id} type="button" onClick={() => setLightbox(m.photoUrl!)} className="relative aspect-square overflow-hidden rounded-lg bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.photoUrl} alt={m.caption ?? ""} className="h-full w-full object-cover" />
                    {m.photoType === "work" && <span className="absolute bottom-1 start-1 rounded-full px-1.5 py-0.5 text-[8.5px] font-extrabold text-white" style={{ background: "#0f7a43" }}>{tr("p8ops.moWorkTag")}</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* feed */}
      {openFolder && <div className="mb-2.5 flex items-center gap-2 text-[12.5px]"><span className="rounded-full bg-[#eef4fd] px-3 py-1 font-bold text-[#1d3a8f]">{tr("p8ops.moShowingFolder", { name: openFolder.label, cnt: pickPlural(tr, locale, "p8ops.moMomentN", feed.length) })}</span><button type="button" onClick={() => setGalFolder(null)} className="font-bold text-[var(--ink-3)] underline">{tr("p8ops.moShowAll")}</button></div>}
      {!moments ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">{tr("p8ops.shLoading")}</div>
        : all.length === 0 ? <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-12 text-center text-[13px] text-[var(--ink-3)]">{tr("p8ops.moNoMoments")}</div>
        : feed.length === 0 ? <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-12 text-center text-[13px] text-[var(--ink-3)]">{tr("p8ops.moNoMomentsFolder")}</div>
        : (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {feed.map((m) => { const a = actByName(m.activity), col = a?.c ?? PINK; return (
              <div key={m.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
                {m.photoUrl ? (
                  <button type="button" onClick={() => setLightbox(m.photoUrl!)} className="relative block aspect-square w-full bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.photoUrl} alt={m.caption ?? ""} className="h-full w-full object-cover" />
                    {a && <span className="absolute start-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-extrabold" style={{ color: col }}>{a.e} {actLabel(a.n)}</span>}
                    {m.photoType === "work" && <span className="absolute bottom-2.5 start-2.5 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold text-white" style={{ background: "#0f7a43" }}>{tr("p8ops.moTheirWork")}</span>}
                  </button>
                ) : (
                  <div className="relative flex h-[108px] items-center justify-center" style={{ background: `linear-gradient(135deg,${col},${col}cc)` }}><span className="text-[46px]">{a?.e ?? "✨"}</span>{a && <span className="absolute start-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-extrabold" style={{ color: col }}>{a.e} {actLabel(a.n)}</span>}</div>
                )}
                <div className="p-3">
                  {m.childNames?.filter(Boolean).length > 0 && <div className="mb-1.5 text-[12.5px] font-extrabold">{m.childNames.filter(Boolean).join(", ")}</div>}
                  {m.caption && <div className="text-[13px] leading-[1.5] text-[var(--ink-2)]">{m.caption}</div>}
                  {m.listingId && listingName.get(m.listingId) && <div className="mt-1 text-[11px] text-[var(--ink-3)]">📁 {listingName.get(m.listingId)}</div>}
                  <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-[var(--ink-3)]"><span className="truncate">👤 {m.postedByName} · {when(m.createdAt)}</span><span className="flex flex-none gap-2">{m.photoUrl && <button type="button" onClick={() => setDlFor(dlFor === m.id ? null : m.id)} className="font-bold" style={{ color: BLUE }}>{tr("p8ops.moDownload")}</button>}{canManage && <button type="button" onClick={() => remove(m)} className="font-bold" style={{ color: RED }}>{tr("p8ops.tpDelete")}</button>}</span></div>
                  {dlFor === m.id && m.photoUrl && (() => {
                    const nQuotes = (m.comments ?? []).filter((c) => c.role === "parent" && c.marketing).length;
                    const nParent = (m.comments ?? []).filter((c) => c.role === "parent").length;
                    const inc = (k: "caption" | "quote" | "comments") => setDlInc((v) => ({ ...v, [k]: !v[k] }));
                    return (
                      <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5 text-[11.5px]">
                        <div className="mb-1 font-bold text-[var(--ink-3)] uppercase tracking-[0.04em] text-[10px]">{tr("p8ops.moFormat")}</div>
                        <div className="mb-2 flex flex-wrap gap-1.5">{([["square", tr("p8ops.moSquare")], ["portrait", tr("p8ops.moPortrait")], ["story", tr("p8ops.moStory")]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setDlRatio(k)} className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold" style={dlRatio === k ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{l}</button>)}</div>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{tr("p8ops.moPhotoFit")}</div>
                        <div className="mb-2 flex flex-wrap gap-1.5">{([["contain", tr("p8ops.moWhole")], ["cover", tr("p8ops.moFill")]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setDlFit(k)} className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold" style={dlFit === k ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{l}</button>)}<span className="self-center text-[10.5px] text-[var(--ink-3)]">{dlFit === "contain" ? tr("p8ops.moFitContain") : tr("p8ops.moFitCover")}</span></div>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{tr("p8ops.moBannerWith")}</div>
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {([["caption", m.caption ? tr("p8ops.moCaptionLbl") : tr("p8ops.moCaptionNone"), !!m.caption], ["quote", nQuotes ? tr("p8ops.moStarredN", { n: nQuotes }) : tr("p8ops.moStarredNone"), nQuotes > 0], ["comments", nParent ? tr("p8ops.moAllParentN", { n: nParent }) : tr("p8ops.moAllParentNone"), nParent > 0]] as const).map(([k, l, avail]) => <button key={k} type="button" disabled={!avail} onClick={() => inc(k)} className="rounded-full border-2 px-2.5 py-0.5 text-[11px] font-bold transition-colors disabled:opacity-45" style={dlInc[k] && avail ? { borderColor: GREEN, background: "#e7f6ee", color: GREEN } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{dlInc[k] && avail ? "✓ " : ""}{l}</button>)}
                        </div>
                        <div className="mb-2 flex flex-wrap items-center gap-1.5"><span className="text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{tr("p8ops.moTextColour")}</span>{["#171534", "#1d3a8f", "#be1259", "#047857", "#b45309"].map((sw) => <button key={sw} type="button" onClick={() => setDlColor(sw)} className="h-5 w-5 rounded-full border-2" style={{ background: sw, borderColor: dlColor === sw ? "#171534" : "var(--line)" }} title={sw} />)}<input type="color" value={dlColor} onChange={(e) => setDlColor(e.target.value)} className="h-6 w-7 cursor-pointer rounded border border-[var(--line)]" title={tr("p8ops.moCustomColour")} /></div>
                        <div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => downloadComposite(m, dlRatio, { caption: false, quote: false, comments: false }, dlColor, dlFit)} className="rounded-md border border-[var(--line)] px-2.5 py-1 text-[11px] font-bold">{tr("p8ops.moPhotoOnly")}</button><button type="button" onClick={() => downloadComposite(m, dlRatio, dlInc, dlColor, dlFit)} className="rounded-md px-2.5 py-1 text-[11px] font-extrabold text-white" style={{ background: "#2f5fd0" }}>{tr("p8ops.moDlBanner")}</button></div>
                        {canManage && <div className="mt-2 border-t border-[var(--line)] pt-2"><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{tr("p8ops.moKeepEmail")}</div><div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => saveImageToEmail(m, dlRatio, { caption: false, quote: false, comments: false }, dlColor, dlFit)} className="rounded-md border border-[var(--line)] px-2.5 py-1 text-[11px] font-bold">{tr("p8ops.moSavePhotoOnly")}</button><button type="button" onClick={() => saveImageToEmail(m, dlRatio, dlInc, dlColor, dlFit)} className="rounded-md px-2.5 py-1 text-[11px] font-extrabold text-white" style={{ background: "#9a5a00" }}>{tr("p8ops.moSaveBanner")}</button></div></div>}
                      </div>
                    );
                  })()}
                  {((m.comments?.length ?? 0) > 0 || canManage) && (
                    <div className="mt-2 border-t border-[var(--line)] pt-2">
                      {(m.comments ?? []).map((c, idx) => (
                        <div key={idx} className="mb-1.5 text-[11.5px] leading-[1.5]">
                          <div className="flex items-start gap-1.5">
                            <span className="flex-none font-bold" style={{ color: c.role === "parent" ? BLUE : "var(--ink)" }}>{c.role === "parent" ? c.byName : tr("p8ops.moYouSuffix", { name: c.byName })}:</span>
                            <span className="flex-1 text-[var(--ink-2)]">{c.text}</span>
                          </div>
                          {canManage && c.role === "parent" && <button type="button" onClick={() => toggleMarketing(m, idx)} className="mt-0.5 rounded-full border px-2 py-0.5 text-[10px] font-extrabold" style={c.marketing ? { borderColor: "#f0b100", background: "#fffdf3", color: "#9a5a00" } : { borderColor: "var(--line)", color: "var(--ink-3)" }} title={tr("p8ops.moStarTip")}>{c.marketing ? tr("p8ops.moQuoteOn") : tr("p8ops.moQuoteUse")}</button>}
                        </div>
                      ))}
                      {canManage && <div className="mt-1 flex gap-1.5"><input value={replyVals[m.id] ?? ""} onChange={(e) => setReplyVals((v) => ({ ...v, [m.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") reply(m); }} placeholder={tr("p8ops.moReplyPh")} className="flex-1 rounded-md border border-[var(--line)] px-2 py-1 text-[11.5px] outline-none focus:border-[#1d3a8f]" /><button type="button" onClick={() => reply(m)} className="rounded-md border border-[var(--line)] px-2 py-1 text-[11px] font-bold" style={{ color: BLUE }}>{tr("p8ops.moSend")}</button></div>}
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
