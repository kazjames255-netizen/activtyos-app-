"use client";

import { useCallback, useEffect, useState } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Button, Card, FieldLabel, Input } from "@/components/ui";

interface Post {
  id: string;
  title?: string;
  body: string;
  photoUrl?: string;
  tenantName?: string;
  postedByName?: string;
  createdAt?: string;
}
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

export function NewsfeedApp() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const refresh = useCallback(() => {
    apiGet<Post[]>("/api/posts").then((p) => { setPosts(p); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  useRealtime(["posts"], refresh);

  async function post() {
    if (!body.trim()) return;
    setSending(true);
    try { await apiPost("/api/posts", { title: title.trim() || undefined, body }); setTitle(""); setBody(""); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t post"); }
    finally { setSending(false); }
  }
  async function remove(p: Post) {
    if (!confirm("Delete this post?")) return;
    try { await api(`/api/posts/${encodeURIComponent(p.id)}`, { method: "DELETE" }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Newsfeed</h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Post an update — every family with a booking sees it in their app.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      <Card className="mb-4 p-3.5">
        <FieldLabel>Title (optional)</FieldLabel>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Reminder for tomorrow" className="mb-2 w-full" />
        <FieldLabel>Message</FieldLabel>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Bring wellies and a packed lunch…" className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px]" />
        <div className="mt-2.5 flex justify-end"><Button variant="primary" onClick={post} disabled={sending || !body.trim()}>{sending ? "Posting…" : "Post to families"}</Button></div>
      </Card>

      {!posts ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : posts.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No posts yet — write the first above.</Card>
      : (
        <div className="flex flex-col gap-2.5">
          {posts.map((p) => (
            <Card key={p.id} className="p-3.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  {p.title && <div className="text-[13.5px] font-extrabold">{p.title}</div>}
                  <div className="whitespace-pre-wrap text-[13px] text-[var(--ink-2)]">{p.body}</div>
                  <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">{p.postedByName} · {when(p.createdAt)}</div>
                </div>
                {canManage && <button type="button" onClick={() => remove(p)} className="text-[var(--ink-3)] hover:text-[var(--red)]" aria-label="Delete">×</button>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
