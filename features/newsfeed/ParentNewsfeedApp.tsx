"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Card } from "@/components/ui";

interface Post {
  id: string;
  title?: string;
  body: string;
  photoUrl?: string;
  tenantName?: string;
  createdAt?: string;
}
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

/** custdash/newsfeed — the parent's view: updates from every provider they've booked. */
export function ParentNewsfeedApp() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiGet<Post[]>("/api/posts").then((p) => { setPosts(p); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["posts"], refresh);

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Newsfeed</h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Updates from the providers you’ve booked with.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {!posts ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : posts.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No updates yet.</Card>
      : (
        <div className="flex flex-col gap-2.5">
          {posts.map((p) => (
            <Card key={p.id} className="p-3.5">
              <div className="mb-1 flex items-center gap-2">
                <Badge tone={{ bg: "color-mix(in srgb, var(--brand) 14%, transparent)", fg: "var(--brand)" }}>{p.tenantName ?? "Provider"}</Badge>
                <span className="ml-auto text-[11px] text-[var(--ink-3)]">{when(p.createdAt)}</span>
              </div>
              {p.title && <div className="text-[13.5px] font-extrabold">{p.title}</div>}
              <div className="whitespace-pre-wrap text-[13px] text-[var(--ink-2)]">{p.body}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
