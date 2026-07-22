"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Button, Card, FieldLabel, Input, Select } from "@/components/ui";

interface Doc { id: string; title: string; category: string; url: string; fileType?: string; notes?: string; uploadedByName?: string; createdAt?: string }
const CATEGORIES = ["Policies", "Risk assessments", "Insurance", "Certificates", "Procedures", "Other"];
const when = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(file); });
}

export function DocumentsApp() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Policies");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    apiGet<Doc[]>("/api/documents").then((d) => { setDocs(d); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  useRealtime(["documents"], refresh);

  async function pickFile(file: File) {
    setBusy(true); setError(null);
    try {
      const dataUrl = await readDataUrl(file);
      const { url: uploaded } = await apiPost<{ url: string }>("/api/uploads", { dataUrl });
      setUrl(uploaded);
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed (file may be too large)"); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!title.trim() || !url.trim()) { setError("A title and a file or link are required."); return; }
    try {
      await apiPost("/api/documents", { title, category, url, notes: notes || undefined });
      setTitle(""); setUrl(""); setNotes(""); setCategory("Policies"); setOpen(false); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); }
  }
  async function remove(d: Doc) { if (!confirm(`Delete “${d.title}”?`)) return; try { await api(`/api/documents/${encodeURIComponent(d.id)}`, { method: "DELETE" }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Documents</h2>
        {canManage && !open && <Button variant="primary" onClick={() => setOpen(true)}>＋ Add a document</Button>}
      </div>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Policies, risk assessments and certificates — the paperwork in one place.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {open && (
        <Card className="mb-3.5 p-4">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div><FieldLabel>Title</FieldLabel><Input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full" /></div>
            <div><FieldLabel>Category</FieldLabel><Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full">{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select></div>
          </div>
          <div className="mt-2.5"><FieldLabel>File or link</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />
              <Button onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? "Uploading…" : "Choose file"}</Button>
              <span className="text-[11.5px] text-[var(--ink-3)]">or paste a link:</span>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="min-w-[200px] flex-1" />
            </div>
            {url && <div className="mt-1 truncate text-[11px] text-[var(--brand)]">{url}</div>}
          </div>
          <div className="mt-2.5"><FieldLabel>Notes</FieldLabel><Input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full" /></div>
          <div className="mt-3 flex gap-2"><Button variant="primary" onClick={save} disabled={busy}>Save</Button><Button onClick={() => setOpen(false)}>Cancel</Button></div>
        </Card>
      )}

      {!docs ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : docs.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No documents yet.</Card>
      : (
        <div className="flex flex-col gap-1.5">
          {docs.map((d) => (
            <Card key={d.id} className="flex flex-wrap items-center gap-2 p-2.5">
              <Badge tone={{ bg: "var(--panel)", fg: "var(--ink-2)" }}>{d.category}</Badge>
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--ink)] hover:text-[var(--brand)] hover:underline">{d.title}</a>
              {d.notes && <span className="hidden text-[11.5px] text-[var(--ink-3)] sm:inline">{d.notes}</span>}
              <span className="text-[11px] text-[var(--ink-3)]">{when(d.createdAt)}</span>
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-bold text-[var(--brand)]">Open</a>
              {canManage && <button type="button" onClick={() => remove(d)} className="text-[var(--ink-3)] hover:text-[var(--red)]" aria-label="Delete">×</button>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
