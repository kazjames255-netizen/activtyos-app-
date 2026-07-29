"use client";
/* eslint-disable @next/next/no-img-element -- post images are arbitrary operator-uploaded URLs; next/image doesn't fit. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Card } from "@/components/ui";
import { NewsletterView, type Newsletter } from "./newsletter";

// The parent's newsfeed — updates from every provider they've booked with.
// Events can be RSVP'd, urgent notices acknowledged, and posts reacted to. Since
// per-parent state isn't stored server-side yet (see docs/newsfeed-handoff.md),
// this device remembers the parent's own choices in localStorage and bumps the
// shared counters through the /react /rsvp /ack endpoints.

type Tpl = "announce" | "event" | "reminder" | "urgent" | "celebrate" | "booking" | "newsletter";
interface Cta { label: string; target?: string; url?: string }
interface Rsvp { yes: number; no: number; maybe: number }
interface Post {
  id: string; tpl?: Tpl; title?: string; body: string; photoUrl?: string;
  pinned?: boolean; priority?: "normal" | "urgent"; ackRequired?: boolean; react?: boolean;
  date?: string; time?: string; location?: string; cta?: Cta | null; rsvp?: Rsvp | null;
  seen?: number; reactions?: number; tenantName?: string; createdAt?: string; newsletter?: Newsletter | null;
}
type Mine = { rsvp?: "yes" | "no" | "maybe"; acked?: boolean; reacted?: boolean };

const TPL: Record<Tpl, { label: string; color: string }> = {
  announce: { label: "Announcement", color: "#2596df" }, event: { label: "Event", color: "#7c5cff" },
  reminder: { label: "Reminder", color: "#f59e0b" }, urgent: { label: "Urgent", color: "#ef4444" },
  celebrate: { label: "Celebration", color: "#e22295" }, booking: { label: "Booking", color: "#15b364" },
  newsletter: { label: "Newsletter", color: "#1d3a8f" },
};
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const LS = "aos.news.mine.v1";
const readMine = (): Record<string, Mine> => { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; } };

/** custdash/newsfeed — the parent's view. */
export function ParentNewsfeedApp() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<Record<string, Mine>>(() => (typeof window === "undefined" ? {} : readMine()));
  const router = useRouter();

  const refresh = useCallback(() => {
    apiGet<Post[]>("/api/posts").then((p) => { setPosts(p); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["posts"], refresh);

  const saveMine = (id: string, m: Mine) => { setMine((cur) => { const next = { ...cur, [id]: { ...cur[id], ...m } }; try { localStorage.setItem(LS, JSON.stringify(next)); } catch { /* private mode */ } return next; }); };

  const react = (p: Post) => { const on = !mine[p.id]?.reacted; saveMine(p.id, { reacted: on }); setPosts((ps) => (ps ?? []).map((x) => (x.id === p.id ? { ...x, reactions: Math.max(0, (x.reactions ?? 0) + (on ? 1 : -1)) } : x))); apiPost(`/api/posts/${encodeURIComponent(p.id)}/react`, { on }).catch(() => {}); };
  const rsvp = (p: Post, choice: "yes" | "no" | "maybe") => { const prev = mine[p.id]?.rsvp ?? null; if (prev === choice) return; saveMine(p.id, { rsvp: choice }); setPosts((ps) => (ps ?? []).map((x) => { if (x.id !== p.id || !x.rsvp) return x; const r = { ...x.rsvp }; r[choice] += 1; if (prev) r[prev] = Math.max(0, r[prev] - 1); return { ...x, rsvp: r }; })); apiPost(`/api/posts/${encodeURIComponent(p.id)}/rsvp`, { choice, prev }).catch(() => {}); };
  const ack = (p: Post) => { if (mine[p.id]?.acked) return; saveMine(p.id, { acked: true }); setPosts((ps) => (ps ?? []).map((x) => (x.id === p.id ? { ...x, seen: (x.seen ?? 0) + 1 } : x))); void api(`/api/posts/${encodeURIComponent(p.id)}/ack`, { method: "POST", body: "{}" }).catch(() => {}); };
  const cta = (p: Post) => { saveMine(p.id, { acked: true }); if (p.cta?.url) window.open(p.cta.url, "_blank", "noopener,noreferrer"); else router.push("/custdash/browse"); };

  const list = useMemo(() => posts ?? [], [posts]);

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Newsfeed</h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Updates from the providers you’ve booked with — RSVP to events, and tap “Got it” on anything that asks.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {!posts ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : list.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No updates yet.</Card>
      : (
        <div className="flex flex-col gap-2.5">
          {list.map((p) => {
            const t = TPL[p.tpl ?? "announce"];
            const m = mine[p.id] ?? {};
            if (p.tpl === "newsletter" && p.newsletter) {
              return (
                <Card key={p.id} className="overflow-hidden !p-0">
                  <div className="flex items-center gap-1.5 px-3 pt-2.5">
                    {p.pinned && <span className="rounded-full bg-[#fff4d6] px-2 py-0.5 text-[10px] font-extrabold text-[#8a6d1a]">Pinned</span>}
                    <Badge tone={{ bg: "color-mix(in srgb, var(--brand) 14%, transparent)", fg: "var(--brand)" }}>{p.tenantName ?? "Provider"}</Badge>
                    <span className="ml-auto text-[11px] text-[var(--ink-3)]">{when(p.createdAt)}</span>
                  </div>
                  <div className="p-3 pt-2"><NewsletterView data={p.newsletter} /></div>
                  {(p.ackRequired || p.react !== false) && (
                    <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
                      {p.ackRequired && <button type="button" onClick={() => ack(p)} disabled={m.acked} className="rounded-full px-3 py-1 text-[11.5px] font-extrabold" style={m.acked ? { background: "#e7f6ee", color: "#0f8a4a" } : { background: "#1d3a8f", color: "#fff" }}>{m.acked ? "✓ Got it" : "Got it"}</button>}
                      {p.react !== false && <button type="button" onClick={() => react(p)} className="ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={m.reacted ? { borderColor: "#e22295", background: "#fdeaf4", color: "#e22295" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{m.reacted ? "♥" : "♡"} {p.reactions ?? 0}</button>}
                    </div>
                  )}
                </Card>
              );
            }
            return (
              <Card key={p.id} className="overflow-hidden !p-0">
                <div className="border-l-[4px] p-3.5" style={{ borderColor: t.color }}>
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ background: `${t.color}18`, color: t.color }}>{t.label}</span>
                    {p.pinned && <span className="rounded-full bg-[#fff4d6] px-2 py-0.5 text-[10px] font-extrabold text-[#8a6d1a]">Pinned</span>}
                    <Badge tone={{ bg: "color-mix(in srgb, var(--brand) 14%, transparent)", fg: "var(--brand)" }}>{p.tenantName ?? "Provider"}</Badge>
                    <span className="ml-auto text-[11px] text-[var(--ink-3)]">{when(p.createdAt)}</span>
                  </div>
                  {p.title && <div className="text-[14px] font-extrabold">{p.title}</div>}
                  <div className="mt-0.5 whitespace-pre-wrap text-[13px] text-[var(--ink-2)]">{p.body}</div>
                  {p.photoUrl && <img src={p.photoUrl} alt="" className="mt-2 max-h-64 w-full rounded-lg object-cover" />}

                  {p.tpl === "event" && (p.date || p.time || p.location) && (
                    <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-lg bg-[var(--panel,#f4f2f8)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">{[p.date, p.time, p.location].filter(Boolean).join(" · ")}</div>
                  )}

                  {/* Interactions */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {p.tpl === "event" && p.rsvp && (
                      <div className="inline-flex overflow-hidden rounded-full border border-[var(--line)]">
                        {([["yes", "Going"], ["maybe", "Maybe"], ["no", "Can’t"]] as const).map(([k, label]) => (
                          <button key={k} type="button" onClick={() => rsvp(p, k)} className="px-3 py-1 text-[11.5px] font-bold transition-colors" style={m.rsvp === k ? { background: t.color, color: "#fff" } : { color: "var(--ink-2)" }}>{label}</button>
                        ))}
                      </div>
                    )}
                    {p.ackRequired && (
                      <button type="button" onClick={() => ack(p)} disabled={m.acked} className="rounded-full px-3 py-1 text-[11.5px] font-extrabold" style={m.acked ? { background: "#e7f6ee", color: "#0f8a4a" } : { background: "#1d3a8f", color: "#fff" }}>{m.acked ? "✓ Got it" : "Got it"}</button>
                    )}
                    {p.cta && (
                      <button type="button" onClick={() => cta(p)} className="rounded-full px-3 py-1 text-[11.5px] font-extrabold text-white" style={{ background: t.color }}>{p.cta.label}</button>
                    )}
                    {p.react !== false && (
                      <button type="button" onClick={() => react(p)} className="ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={m.reacted ? { borderColor: "#e22295", background: "#fdeaf4", color: "#e22295" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{m.reacted ? "♥" : "♡"} {p.reactions ?? 0}</button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
