"use client";

// Staff-facing "Announcements" — the STAFF side of notifications. An internal
// notice board posted by head office and managers (distinct from the
// parent-facing newsfeed). Everyone reads and marks as read — on the server
// (/api/staff-announcements), so read state follows the person, not the phone.
// Staff can't post yet: the server has no "lead" level within staff, so the
// composer only shows to managers (who normally post from Newsfeed → To staff).
import { useEffect, useMemo, useState } from "react";
import { Button, Card } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { useSettings } from "@/lib/settings";
import { fetchAnnouncements, markAnnouncementRead, postAnnouncement, type Announcement } from "./announcements";
import { getMe } from "@/components/auth/PortalGuard";
import { useI18n } from "@/lib/i18n/provider";

// Render **bold** markers from a translated string.
const rich = (s: string) => s.split("**").map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p));

export function StaffAnnouncementsApp() {
  const { t, locale: appLocale } = useI18n();
  const locale = appLocale === "en" ? "en-GB" : appLocale; // for dates — plain "en" formats US-style
  const { settings } = useSettings();
  const [role, setRole] = useState("");
  const [myName, setMyName] = useState("");
  const canPost = ["company", "franchise", "freelancer"].includes(role) && (settings.announcements?.leadsCanPost ?? true);
  const [posts, setPosts] = useState<Announcement[]>([]);
  const [read, setRead] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [important, setImportant] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    getMe().then((m) => { setRole(m.role); setMyName((m as { name?: string }).name ?? ""); }).catch(() => {});
    fetchAnnouncements().then((l) => { setPosts(l); setRead(l.filter((p) => p.read).map((p) => p.id)); }).catch((e) => setError(e instanceof Error ? e.message : "staffp.annLoadErr"));
  }, []);
  const markRead = (id: string) => { if (read.includes(id)) return; setRead([...read, id]); void markAnnouncementRead(id).catch(() => {}); };
  const markAll = () => { const unreadIds = posts.map((p) => p.id).filter((id) => !read.includes(id)); setRead(posts.map((p) => p.id)); for (const id of unreadIds) void markAnnouncementRead(id).catch(() => {}); };

  const canSend = title.trim().length > 1 && body.trim().length > 1;
  const send = async () => {
    if (!canSend) return;
    try {
      const made = await postAnnouncement({ author: myName || undefined, title: title.trim(), body: body.trim(), audienceLabel: "All staff", important, pinned });
      setPosts((p) => [made, ...p]);
      setTitle(""); setBody(""); setImportant(false); setPinned(false); setComposing(false);
      setFlash(t("staffp.annPosted"));
      setTimeout(() => setFlash(null), 4000);
    } catch (e) { setError(e instanceof Error ? e.message : t("staffp.annPostErr")); }
  };

  const ordered = useMemo(() => [...posts].sort((a, b) => (a.pinned === b.pinned ? (a.date < b.date ? 1 : -1) : a.pinned ? -1 : 1)), [posts]);
  const unread = posts.filter((p) => !read.includes(p.id)).length;

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title={t("staffp.annTitle")} icon="📣" lede={t("staffp.annLede")} actions={unread > 0 ? <button type="button" onClick={markAll} className="rounded-full bg-white/20 px-3 py-1.5 text-[12.5px] font-bold text-white">{t("staffp.annMarkAll")}</button> : undefined} />

      {error && <Card className="mb-3 border-[#f6c9cc] bg-[#fdebec] p-3 text-[12.5px] font-semibold text-[#c02636]">{error.startsWith("staffp.") ? t(error) : error}</Card>}

      {/* Manager composer */}
      {canPost && (
        <Card className="mb-3 p-4">
          {!composing ? (
            <div className="flex items-center justify-between gap-3">
              <div className="text-[12.5px] text-[var(--ink-2)]">{rich(t("staffp.annCanPost"))}</div>
              <Button variant="primary" onClick={() => setComposing(true)}>{t("staffp.annNew")}</Button>
            </div>
          ) : (
            <div>
              <div className="mb-2 text-[13px] font-extrabold text-[var(--ink)]">{t("staffp.annComposeTitle")}</div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={90} placeholder={t("staffp.annTitlePh")} className="mb-2 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13.5px]" />
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={1200} placeholder={t("staffp.annBodyPh")} className="mb-2 w-full resize-y rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13.5px] leading-[1.55]" />
              <div className="mb-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => setImportant((v) => !v)} className={"rounded-full border px-3 py-1.5 text-[12px] font-bold " + (important ? "border-[#f3c6c1] bg-[#fdedeb] text-[#c0392b]" : "border-[var(--line)] bg-white text-[var(--ink-3)]")}>{important ? t("staffp.annImportantOn") : t("staffp.annMarkImportant")}</button>
                <button type="button" onClick={() => setPinned((v) => !v)} className={"rounded-full border px-3 py-1.5 text-[12px] font-bold " + (pinned ? "border-[#b9d0f7] bg-[#eaf1fe] text-[#1d3a8f]" : "border-[var(--line)] bg-white text-[var(--ink-3)]")}>{pinned ? t("staffp.annPinnedOn") : t("staffp.annPinTop")}</button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="primary" onClick={send} disabled={!canSend}>{t("staffp.annPost")}</Button>
                <button type="button" onClick={() => setComposing(false)} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-3)]">{t("staffp.annCancel")}</button>
              </div>
            </div>
          )}
          {flash && <div className="mt-2 rounded-lg border border-[#bfe6cf] bg-[#f2fbf5] px-3 py-2 text-[12.5px] font-semibold text-[#0f7a43]">✓ {flash}</div>}
        </Card>
      )}

      {unread > 0 && <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#fff7e6] px-3 py-1 text-[12px] font-bold text-[#b45309]">📌 {t(unread > 1 ? "staffp.annUnreadMany" : "staffp.annUnreadOne", { n: unread })}</div>}

      <div className="flex flex-col gap-3">
        {ordered.map((p) => { const isRead = read.includes(p.id); return (
          <Card key={p.id} className={"p-4 " + (isRead ? "opacity-90" : "ring-1 ring-[#1d3a8f]/20")} >
            <div className="mb-1 flex items-center gap-2">
              {p.pinned && <span className="text-[13px]">📌</span>}
              {p.important && <span className="rounded-full bg-[#fdedeb] px-2 py-0.5 text-[10.5px] font-extrabold uppercase text-[#c0392b]">{t("staffp.annImportant")}</span>}
              <span className="text-[15px] font-extrabold text-[var(--ink)]">{p.title}</span>
              {!isRead && <span className="ml-auto inline-block h-2 w-2 rounded-full bg-[#1d3a8f]" />}
            </div>
            <div className="mb-2 text-[11.5px] font-semibold text-[var(--ink-3)]">{p.author} · {p.role}{p.audienceLabel ? ` · ${p.audienceLabel}` : ""} · {new Date(p.date + "T00:00:00").toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })}</div>
            <p className="text-[13.5px] leading-[1.6] text-[var(--ink-2)] whitespace-pre-wrap">{p.body}</p>
            {!isRead && <div className="mt-2.5"><button type="button" onClick={() => markRead(p.id)} className="rounded-full border border-[var(--line)] px-3 py-1 text-[12px] font-bold text-[#1d3a8f] hover:bg-[var(--panel)]">{t("staffp.annMarkRead")}</button></div>}
          </Card>
        ); })}
      </div>
    </div>
  );
}
