"use client";

// Staff-facing "Announcements" — the STAFF side of notifications. An internal
// notice board posted by head office, managers and site leads (distinct from the
// parent-facing newsfeed). Everyone reads and marks as read; leads/managers also
// get a composer to post to their team. Demo store (shared with the operator
// "To staff" composer); server-side site/role scoping + push delivery are Amir's.
import { useEffect, useMemo, useState } from "react";
import { Button, Card } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { useSettings } from "@/lib/settings";
import { addAnnouncement, loadAnnouncements, loadRead, saveRead, type Announcement } from "./announcements";

// Demo identity (per-user identity is Amir's) — a Lead, so the composer shows.
const ME = "Marcus Bell";
const ME_ROLE = "Camp Lead";
const isLeadish = /lead|manager|owner/i.test(ME_ROLE);

export function StaffAnnouncementsApp() {
  const { settings } = useSettings();
  const canPost = isLeadish && (settings.announcements?.leadsCanPost ?? true);
  const [posts, setPosts] = useState<Announcement[]>([]);
  const [read, setRead] = useState<string[]>([]);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [important, setImportant] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => { setPosts(loadAnnouncements()); setRead(loadRead()); }, []);
  const markRead = (id: string) => { if (read.includes(id)) return; const r = [...read, id]; setRead(r); saveRead(r); };
  const markAll = () => { const r = posts.map((p) => p.id); setRead(r); saveRead(r); };

  const canSend = title.trim().length > 1 && body.trim().length > 1;
  const send = () => {
    if (!canSend) return;
    const next = addAnnouncement({ author: ME, role: ME_ROLE, title: title.trim(), body: body.trim(), audienceLabel: "All staff on site", important, pinned });
    setPosts(next);
    setTitle(""); setBody(""); setImportant(false); setPinned(false); setComposing(false);
    setFlash("Posted to all staff on your site.");
    setTimeout(() => setFlash(null), 4000);
  };

  const ordered = useMemo(() => [...posts].sort((a, b) => (a.pinned === b.pinned ? (a.date < b.date ? 1 : -1) : a.pinned ? -1 : 1)), [posts]);
  const unread = posts.filter((p) => !read.includes(p.id)).length;

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="Announcements" icon="📣" lede="Notices from head office and your manager. Keep an eye here for the things you need to know." actions={unread > 0 ? <button type="button" onClick={markAll} className="rounded-full bg-white/20 px-3 py-1.5 text-[12.5px] font-bold text-white">Mark all read</button> : undefined} />

      {/* Lead / manager composer */}
      {canPost && (
        <Card className="mb-3 p-4">
          {!composing ? (
            <div className="flex items-center justify-between gap-3">
              <div className="text-[12.5px] text-[var(--ink-2)]">You’re a lead — you can post an announcement to <b>all staff on your site</b>.</div>
              <Button variant="primary" onClick={() => setComposing(true)}>＋ New announcement</Button>
            </div>
          ) : (
            <div>
              <div className="mb-2 text-[13px] font-extrabold text-[var(--ink)]">Post to all staff on your site</div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={90} placeholder="Title — e.g. Early start tomorrow" className="mb-2 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13.5px]" />
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={1200} placeholder="Write your notice to the team…" className="mb-2 w-full resize-y rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13.5px] leading-[1.55]" />
              <div className="mb-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => setImportant((v) => !v)} className={"rounded-full border px-3 py-1.5 text-[12px] font-bold " + (important ? "border-[#f3c6c1] bg-[#fdedeb] text-[#c0392b]" : "border-[var(--line)] bg-white text-[var(--ink-3)]")}>{important ? "★ Important" : "Mark important"}</button>
                <button type="button" onClick={() => setPinned((v) => !v)} className={"rounded-full border px-3 py-1.5 text-[12px] font-bold " + (pinned ? "border-[#b9d0f7] bg-[#eaf1fe] text-[#1d3a8f]" : "border-[var(--line)] bg-white text-[var(--ink-3)]")}>{pinned ? "📌 Pinned" : "Pin to top"}</button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="primary" onClick={send} disabled={!canSend}>Post</Button>
                <button type="button" onClick={() => setComposing(false)} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-3)]">Cancel</button>
              </div>
            </div>
          )}
          {flash && <div className="mt-2 rounded-lg border border-[#bfe6cf] bg-[#f2fbf5] px-3 py-2 text-[12.5px] font-semibold text-[#0f7a43]">✓ {flash}</div>}
        </Card>
      )}

      {unread > 0 && <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#fff7e6] px-3 py-1 text-[12px] font-bold text-[#b45309]">📌 {unread} unread announcement{unread > 1 ? "s" : ""}</div>}

      <div className="flex flex-col gap-3">
        {ordered.map((p) => { const isRead = read.includes(p.id); return (
          <Card key={p.id} className={"p-4 " + (isRead ? "opacity-90" : "ring-1 ring-[#1d3a8f]/20")} >
            <div className="mb-1 flex items-center gap-2">
              {p.pinned && <span className="text-[13px]">📌</span>}
              {p.important && <span className="rounded-full bg-[#fdedeb] px-2 py-0.5 text-[10.5px] font-extrabold uppercase text-[#c0392b]">Important</span>}
              <span className="text-[15px] font-extrabold text-[var(--ink)]">{p.title}</span>
              {!isRead && <span className="ml-auto inline-block h-2 w-2 rounded-full bg-[#1d3a8f]" />}
            </div>
            <div className="mb-2 text-[11.5px] font-semibold text-[var(--ink-3)]">{p.author} · {p.role}{p.audienceLabel ? ` · ${p.audienceLabel}` : ""} · {new Date(p.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
            <p className="text-[13.5px] leading-[1.6] text-[var(--ink-2)] whitespace-pre-wrap">{p.body}</p>
            {!isRead && <div className="mt-2.5"><button type="button" onClick={() => markRead(p.id)} className="rounded-full border border-[var(--line)] px-3 py-1 text-[12px] font-bold text-[#1d3a8f] hover:bg-[var(--panel)]">Mark as read</button></div>}
          </Card>
        ); })}
      </div>
    </div>
  );
}
