"use client";

import { useCallback, useEffect, useState } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Button, Card, Input } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// Moments (operator/staff) — share photos of the day. Only children WITH
// photo consent can be tagged; the picker offers just those (the server
// enforces it too). Parents see the moments featuring their own children.
// Simple by design — Kaz can restyle.
// ─────────────────────────────────────────────────────────────────────────

interface Moment {
  id: string;
  photoUrl: string;
  caption?: string;
  date: string;
  childIds: string[];
  childNames: string[];
  postedByName?: string;
  createdAt?: string;
}
interface Taggable { childId: string; name: string }

const todayIso = () => {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
};
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

// File → compressed data URL (max 1280px, JPEG) so it fits the image store.
async function fileToDataUrl(file: File): Promise<string> {
  const img = document.createElement("img");
  const url = URL.createObjectURL(file);
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const maxW = 1280;
  const scale = Math.min(1, maxW / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function PostForm({ onPosted, onCancel }: { onPosted: () => void; onCancel: () => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [taggable, setTaggable] = useState<Taggable[]>([]);
  const [tagged, setTagged] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { apiGet<Taggable[]>(`/api/moments/taggable?date=${todayIso()}`).then(setTaggable).catch(() => {}); }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPreview(await fileToDataUrl(f));
  }
  async function post() {
    if (!preview) { setError("Add a photo first."); return; }
    setBusy(true);
    setError(null);
    try {
      const { url } = await apiPost<{ url: string }>("/api/uploads", { dataUrl: preview });
      await apiPost("/api/moments", { photoUrl: url, caption, childIds: tagged });
      onPosted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t post");
      setBusy(false);
    }
  }
  return (
    <Card className="mb-3.5 p-4">
      <div className="mb-2 text-[13.5px] font-extrabold">Share a moment</div>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="mb-2 max-h-[220px] w-full rounded-lg object-cover" />
      ) : (
        <label className="mb-2 flex h-[120px] cursor-pointer items-center justify-center rounded-lg border border-dashed border-[var(--line)] text-[12.5px] text-[var(--ink-3)]">
          📷 Choose a photo
          <input type="file" accept="image/*" className="hidden" onChange={onFile} />
        </label>
      )}
      <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Say something about the day…" className="w-full" />
      <div className="mt-2.5">
        <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">Tag children (only those with photo consent appear)</div>
        {taggable.length === 0 ? (
          <div className="text-[11.5px] text-[var(--ink-3)]">No consented children in today’s sessions to tag.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {taggable.map((c) => (
              <button key={c.childId} type="button" onClick={() => setTagged((t) => t.includes(c.childId) ? t.filter((x) => x !== c.childId) : [...t, c.childId])}
                className="rounded-full border px-2.5 py-[3px] text-[11.5px] font-bold transition-colors"
                style={tagged.includes(c.childId) ? { borderColor: "transparent", background: "var(--brand,#2f6bd8)", color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <div className="mt-2 text-[12.5px] font-bold text-[var(--red)]">{error}</div>}
      <div className="mt-3 flex gap-2"><Button variant="primary" disabled={busy || !preview} onClick={post}>{busy ? "Posting…" : "Post moment"}</Button><Button onClick={onCancel}>Cancel</Button></div>
    </Card>
  );
}

export function MomentsApp() {
  const [moments, setMoments] = useState<Moment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [canManage, setCanManage] = useState(false);

  const refresh = useCallback(() => {
    apiGet<Moment[]>("/api/moments").then((m) => { setMoments(m); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  useRealtime(["moments"], refresh);

  async function remove(m: Moment) {
    if (!confirm("Delete this moment?")) return;
    try { await api(`/api/moments/${encodeURIComponent(m.id)}`, { method: "DELETE" }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
  }

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Moments</h2>
        {!posting && <Button variant="primary" onClick={() => setPosting(true)}>＋ Share a moment</Button>}
      </div>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Photos of the day — families see the moments their own child is in.</p>

      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {posting && <PostForm onPosted={() => { setPosting(false); refresh(); }} onCancel={() => setPosting(false)} />}

      {!moments ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : moments.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No moments yet — share the first.</Card>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {moments.map((m) => (
            <Card key={m.id} className="overflow-hidden p-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.photoUrl} alt={m.caption ?? ""} className="h-[180px] w-full object-cover" />
              <div className="p-3">
                {m.caption && <div className="text-[13px]">{m.caption}</div>}
                {m.childNames?.filter(Boolean).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {m.childNames.filter(Boolean).map((n, i) => <Badge key={i} tone={{ bg: "var(--panel)", fg: "var(--ink-2)" }}>{n}</Badge>)}
                  </div>
                )}
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-[var(--ink-3)]">
                  <span>{m.postedByName} · {when(m.createdAt)}</span>
                  {canManage && <button type="button" onClick={() => remove(m)} className="font-bold text-[var(--red)]">Delete</button>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
