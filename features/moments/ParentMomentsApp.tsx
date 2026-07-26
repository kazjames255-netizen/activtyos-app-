"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Card } from "@/components/ui";

// The parent's view — "My child's day". Moments featuring their own children,
// across every provider. Only consented children ever appear (enforced when the
// moment is posted). Two folders — photos of my child, and their work — and the
// parent can reply to each (their comment goes back to the provider's photo
// area, where a lovely one can be reused as marketing).

interface Comment { by: string; byName: string; role: "parent" | "staff"; text: string; at: string; marketing?: boolean }
interface Moment { id: string; photoUrl?: string; caption?: string; activity?: string; photoType?: "child" | "work"; date: string; childNames: string[]; postedByName?: string; createdAt?: string; comments?: Comment[] }

const BLUE = "#1d3a8f", GREEN = "#0f7a43";
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

export function ParentMomentsApp() {
  const [moments, setMoments] = useState<Moment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folder, setFolder] = useState<"all" | "child" | "work">("all");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [replyVals, setReplyVals] = useState<Record<string, string>>({});

  const refresh = useCallback(() => { apiGet<Moment[]>("/api/moments").then((m) => { setMoments(m); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load")); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["moments", "children"], refresh);

  async function reply(m: Moment) { const t = (replyVals[m.id] ?? "").trim(); if (!t) return; try { await apiPost(`/api/moments/${encodeURIComponent(m.id)}/comment`, { text: t }); setReplyVals((v) => ({ ...v, [m.id]: "" })); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t send"); } }

  const all = useMemo(() => moments ?? [], [moments]);
  const counts = { child: all.filter((m) => m.photoUrl && m.photoType !== "work").length, work: all.filter((m) => m.photoType === "work").length };
  const shown = useMemo(() => all.filter((m) => (folder === "all" ? true : folder === "work" ? m.photoType === "work" : m.photoType !== "work")), [all, folder]);

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>My child&rsquo;s day</h2>
      <p className="mb-3 text-[12.5px] text-[var(--ink-3)]">Photos and highlights your provider has shared. You&rsquo;ll be notified whenever a new one arrives. Say something back — they love hearing it.</p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {([["all", `All (${all.length})`], ["child", `📷 Photos of my child (${counts.child})`], ["work", `🎨 Their work (${counts.work})`]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFolder(k)} className="rounded-full border px-3 py-1 text-[12px] font-bold transition-colors" style={folder === k ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{l}</button>
        ))}
      </div>

      {error && <div className="mb-3 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}
      {!moments ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
        : shown.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{all.length === 0 ? "No moments yet — they’ll appear here when your provider shares one." : "Nothing in this folder yet."}</Card>
        : (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((m) => (
              <Card key={m.id} className="overflow-hidden p-0">
                {m.photoUrl && (
                  <button type="button" onClick={() => setLightbox(m.photoUrl!)} className="relative block aspect-square w-full bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.photoUrl} alt={m.caption ?? ""} className="h-full w-full object-cover" />
                    {m.photoType === "work" && <span className="absolute bottom-2.5 left-2.5 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold text-white" style={{ background: GREEN }}>🎨 Their work</span>}
                  </button>
                )}
                <div className="p-3">
                  {m.caption && <div className="text-[13px] leading-[1.5]">{m.caption}</div>}
                  <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">{m.postedByName} · {when(m.createdAt)}</div>
                  {(m.comments?.length ?? 0) > 0 && (
                    <div className="mt-2 border-t border-[var(--line)] pt-2">
                      {(m.comments ?? []).map((c, idx) => (
                        <div key={idx} className="mb-1 flex items-start gap-1.5 text-[11.5px] leading-[1.5]"><span className="flex-none font-bold" style={{ color: c.role === "parent" ? BLUE : "var(--ink)" }}>{c.role === "parent" ? "You" : c.byName}:</span><span className="flex-1 text-[var(--ink-2)]">{c.text}</span></div>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex gap-1.5">
                    <input value={replyVals[m.id] ?? ""} onChange={(e) => setReplyVals((v) => ({ ...v, [m.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") reply(m); }} placeholder="Reply to your provider…" className="flex-1 rounded-md border border-[var(--line)] px-2 py-1 text-[11.5px] outline-none focus:border-[#1d3a8f]" />
                    <button type="button" onClick={() => reply(m)} className="rounded-md px-2.5 py-1 text-[11px] font-extrabold text-white" style={{ background: BLUE }}>Send</button>
                  </div>
                </div>
              </Card>
            ))}
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
