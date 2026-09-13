"use client";

// The dashboard's four "what's come in" cards — New emails, Messages, Newsfeed
// and Notifications — across the top of the page. Each is the same card with
// its own colour: a gradient glyph, a live count, and three rows that each open
// the thing they describe. Unread rows are tinted and railed in that colour so
// the eye lands on what's actually waiting; read ones sit back.
//
// Each shares its data with the surface it points at — the Inbox card reads the
// same GET /api/emails/messages (and the same demo fallback) as the Email page,
// the Messages card rides on the cached thread list the sidebar badge already
// fetches, and Notifications reads the same feed as the bell — so no count can
// disagree with the thing it summarises and nothing is fetched twice.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { get as apiGet, isDemoMode } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useT } from "@/lib/i18n/provider";
import { useThreadSummaries } from "@/lib/use-unread";
import { notificationHref } from "@/lib/notification-href";
import { DEMO_INBOX, inInbox, previewOf, type ServerMail } from "@/features/email/inbox-data";

// Rows per card. Three keeps all four the height of a KPI tile.
export const SHOWN = 3;

// One colour per card: the solid for rails/counts, the gradient for the glyph,
// and a tint for the background of a row that hasn't been dealt with yet.
export interface Tone { solid: string; grad: string; tint: string }
export const TONES: Record<"blue" | "green" | "violet" | "amber", Tone> = {
  blue: { solid: "#2f5fd0", grad: "linear-gradient(150deg,#4f8bf5,#1d3a8f)", tint: "rgba(47,95,208,.06)" },
  green: { solid: "#0f7a43", grad: "linear-gradient(150deg,#17c06d,#0f7a43)", tint: "rgba(15,122,67,.06)" },
  violet: { solid: "#5a3fd0", grad: "linear-gradient(150deg,#7d5fe0,#4a35a0)", tint: "rgba(90,63,208,.06)" },
  amber: { solid: "#b45309", grad: "linear-gradient(150deg,#f7c53f,#d9950a)", tint: "rgba(180,83,9,.07)" },
};

// "14:20" for today, else "31 Jul" — a row has room for one or the other.
export function shortWhen(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  return sameDay
    ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Plenty of real mail has no display name, so the sender reads
// "notifications@virginmobile.com". Show "Virgin Mobile" and keep the address
// in the tooltip — the row is for recognising who it's from at a glance.
function personName(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s.includes("@")) return s;
  const local = s.split("@")[0];
  const domain = s.split("@")[1]?.split(".")[0] ?? "";
  const base = /^(no.?reply|notifications?|info|hello|support|team|mail|news|do.?not.?reply|alerts?|updates?)$/i.test(local) ? domain : local;
  return base.replace(/[._+-]+/g, " ").replace(/\d+$/, "").trim().replace(/\b\w/g, (c) => c.toUpperCase()) || s;
}

// Two letters for the avatar disc — initials of a name, else the first letters.
const initials = (name: string) => {
  const parts = (name || "?").trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
};

export interface Row {
  id: string;
  who: string;
  what: string;
  at?: string;
  unread?: boolean;
  href?: string;
  /** Emoji shown instead of initials (notifications carry their own glyph). */
  glyph?: string;
  /** Full text for the row's tooltip, when the visible text is shortened. */
  title?: string;
}

/** The shared card: gradient glyph + live count, three rows, an "open" link.
 *  Exported so the platform dashboard can build its own pair (HQ support and
 *  the HQ bell) out of exactly the same parts. */
export function CommsCard({ glyph, title, tone, unread, rows, empty, emptyGlyph, loading, actionLabel, onOpen, onRow }: {
  glyph: string;
  title: string;
  tone: Tone;
  unread: number;
  rows: Row[] | null;      // null = still loading
  empty: string;
  emptyGlyph: string;
  loading: string;
  /** Omitted when the card has no page of its own to open (Notifications). */
  actionLabel?: string;
  onOpen?: () => void;
  onRow: (row: Row) => void;
}): ReactNode {
  return (
    // min-w-0: a grid track's floor is min-content, so without it one long
    // subject stretches the card past the viewport and the page scrolls sideways.
    <div className="group/card relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(16,32,90,.04)] transition-shadow hover:shadow-[0_12px_28px_-16px_rgba(16,32,90,.45)]">
      {/* A hairline of the card's colour along the top edge — what makes the
          four read as a set of four different things at a glance. */}
      <span aria-hidden className="h-[3px] w-full flex-none" style={{ background: tone.grad }} />
      <div className="flex min-w-0 flex-1 flex-col p-3.5 pt-3">
        {/* The heading owns its row outright — nothing shares it, so "New
            emails" is never shortened to "New em…". The way in sits at the
            bottom of the card instead. */}
        <div className="mb-2.5 flex items-center gap-2">
          <button
            type="button" onClick={onOpen} disabled={!onOpen}
            className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default"
          >
            <span
              aria-hidden
              className="flex h-7 w-7 flex-none items-center justify-center rounded-xl text-[14px] leading-none shadow-sm"
              style={{ background: tone.grad }}
            >
              {glyph}
            </span>
            <span className="truncate text-[13.5px] font-extrabold leading-tight text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{title}</span>
            {unread > 0 && (
              <span
                className="flex-none rounded-full px-1.5 py-0.5 text-[10.5px] font-extrabold tabular-nums text-white"
                style={{ background: tone.solid, boxShadow: `0 0 0 3px ${tone.tint}` }}
              >
                {unread}
              </span>
            )}
          </button>
        </div>
        {rows === null ? (
          <div className="flex flex-1 items-center justify-center py-5 text-[12px] text-[var(--ink-3)]">{loading}</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 py-4 text-center">
            <span className="text-[20px] opacity-60" aria-hidden>{emptyGlyph}</span>
            <span className="text-[12px] text-[var(--ink-3)]">{empty}</span>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-1.5">
            {rows.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onRow(r)}
                title={r.title ?? `${r.who} — ${r.what}`}
                className="flex w-full items-center gap-2 overflow-hidden rounded-xl px-2 py-1.5 text-left transition-transform hover:translate-x-[2px]"
                style={{
                  background: r.unread ? tone.tint : "transparent",
                  borderLeft: `3px solid ${r.unread ? tone.solid : "var(--line)"}`,
                }}
              >
                <span
                  aria-hidden
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[10px] font-extrabold leading-none"
                  style={r.glyph
                    ? { background: tone.tint, fontSize: 13 }
                    : { background: r.unread ? tone.grad : "var(--panel)", color: r.unread ? "#fff" : "var(--ink-3)" }}
                >
                  {r.glyph ?? initials(r.who)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[12px] ${r.unread ? "font-extrabold text-[var(--ink)]" : "font-semibold text-[var(--ink-2)]"}`}>{r.who}</span>
                  <span className="block truncate text-[11px] text-[var(--ink-3)]">{r.what}</span>
                </span>
                <span className="flex-none text-[9.5px] font-bold text-[var(--ink-3)]">{shortWhen(r.at)}</span>
              </button>
            ))}
          </div>
        )}
        {actionLabel && onOpen && (
          <button
            type="button" onClick={onOpen}
            className="mt-2.5 flex-none rounded-lg py-1 text-[11px] font-extrabold text-[var(--brand)] transition-colors hover:bg-[var(--panel)]"
          >
            {actionLabel} →
          </button>
        )}
      </div>
    </div>
  );
}

// The portal segment, for links back into the right side of the app.
const usePortal = () => (usePathname() ?? "/").split("/")[1] || "app";

/** New emails — unread count and the latest few subjects. */
export function InboxCard() {
  const t = useT();
  const router = useRouter();
  const portal = usePortal();
  const [mail, setMail] = useState<ServerMail[] | null>(null);
  // A failed load leaves the card in its quiet empty state rather than
  // shouting an error next to the day's figures.
  const load = useCallback(() => {
    apiGet<ServerMail[]>("/api/emails/messages")
      .then((m) => setMail(m && m.length ? m : isDemoMode() ? DEMO_INBOX : []))
      .catch(() => setMail([]));
  }, []);
  useEffect(load, [load]);
  useRealtime(["emailMessages"], load);

  const inbox = (mail ?? []).filter(inInbox);
  const rows: Row[] | null = mail === null ? null : [...inbox]
    // Unread first, then newest — what's waiting on them leads.
    .sort((a, b) => Number(!!b.unread) - Number(!!a.unread) || `${b.at ?? ""}`.localeCompare(`${a.at ?? ""}`))
    .slice(0, SHOWN)
    .map((m) => ({
      id: m.id,
      who: personName(m.from),
      what: m.subject || previewOf(m, 60),
      at: m.at,
      unread: m.unread,
      title: `${m.from}${m.fromEmail && m.fromEmail !== m.from ? ` <${m.fromEmail}>` : ""} — ${m.subject}`,
    }));

  return (
    <CommsCard
      glyph="📬" title={t("dashboard.emailNewEmails")} tone={TONES.blue}
      unread={inbox.filter((m) => m.unread).length}
      rows={rows}
      loading={t("dashboard.emailLoading")}
      empty={t("dashboard.emailAllCaughtUp")} emptyGlyph="✅"
      actionLabel={t("dashboard.emailOpenInbox")}
      onOpen={() => router.push(`/${portal}/email`)}
      onRow={(r) => router.push(`/${portal}/email?mail=${encodeURIComponent(r.id)}`)}
    />
  );
}

/** Messages — unread count and the families waiting on a reply. */
export function MessagesCard() {
  const t = useT();
  const router = useRouter();
  const portal = usePortal();
  const threads = useThreadSummaries();

  const rows: Row[] | null = threads === null ? null : [...threads]
    .sort((a, b) => (b.operatorUnread ?? 0) - (a.operatorUnread ?? 0) || `${b.lastAt ?? ""}`.localeCompare(`${a.lastAt ?? ""}`))
    .slice(0, SHOWN)
    .map((th) => {
      const who = th.parentName || (th.parentEmail ? personName(th.parentEmail) : t("dashboard.messagesAFamily"));
      const what = th.lastBody?.replace(/\s+/g, " ").trim() || th.subject || "";
      return { id: th.id, who, what, at: th.lastAt, unread: (th.operatorUnread ?? 0) > 0, title: `${who} — ${what}` };
    });

  return (
    <CommsCard
      glyph="💬" title={t("dashboard.messagesTitle")} tone={TONES.green}
      unread={(threads ?? []).reduce((n, th) => n + (th.operatorUnread ?? 0), 0)}
      rows={rows}
      loading={t("dashboard.messagesLoading")}
      empty={t("dashboard.messagesNone")} emptyGlyph="🙌"
      actionLabel={t("dashboard.messagesOpen")}
      onOpen={() => router.push(`/${portal}/messages`)}
      onRow={(r) => router.push(`/${portal}/messages?thread=${encodeURIComponent(r.id)}`)}
    />
  );
}

// Just the post fields this card shows — the full model lives in features/newsfeed.
interface FeedPost { id: string; tpl?: string; title?: string; body: string; status?: string; postedByName?: string; audLabel?: string; seen?: number; reactions?: number; publishAt?: string; createdAt?: string }
// The newsfeed's own template glyphs, so a post looks like what it is.
const TPL_GLYPH: Record<string, string> = {
  announce: "📢", event: "📅", reminder: "⏰", urgent: "🚨", celebrate: "🎉", booking: "🎟️", newsletter: "🗞️",
};

/** Newsfeed — what's gone out to families lately. Nothing here is "unread":
 *  these are the provider's own posts, so the card reports rather than nags. */
export function NewsfeedCard() {
  const t = useT();
  const router = useRouter();
  const portal = usePortal();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const load = useCallback(() => {
    apiGet<FeedPost[]>("/api/posts").then((p) => setPosts(p ?? [])).catch(() => setPosts([]));
  }, []);
  useEffect(load, [load]);
  useRealtime(["posts"], load);

  const live = (posts ?? []).filter((p) => (p.status ?? "published") === "published");
  const rows: Row[] | null = posts === null ? null : [...live]
    .sort((a, b) => `${b.publishAt ?? b.createdAt ?? ""}`.localeCompare(`${a.publishAt ?? a.createdAt ?? ""}`))
    .slice(0, SHOWN)
    .map((p) => {
      const body = p.body.replace(/\s+/g, " ").trim();
      const who = p.title || body.slice(0, 40) || t("dashboard.newsfeedAPost");
      // A newsletter's body usually opens with its own title — repeating it on
      // the second line says nothing, so fall back to who it went to and how
      // many have seen it.
      const repeats = !!p.title && body.toLowerCase().startsWith(p.title.trim().toLowerCase().slice(0, 18));
      const reach = [p.audLabel, p.seen ? t("dashboard.newsfeedSeenBy", { count: p.seen }) : ""].filter(Boolean).join(" · ");
      return {
        id: p.id,
        who,
        what: (p.title && !repeats ? body : reach || p.postedByName || "").slice(0, 90),
        at: p.publishAt ?? p.createdAt,
        glyph: TPL_GLYPH[p.tpl ?? ""] ?? "📣",
        title: `${who}${body ? ` — ${body}` : ""}`,
      };
    });

  return (
    <CommsCard
      glyph="📣" title={t("dashboard.newsfeedTitle")} tone={TONES.violet}
      unread={0}
      rows={rows}
      loading={t("dashboard.newsfeedLoading")}
      empty={t("dashboard.newsfeedNone")} emptyGlyph="📝"
      actionLabel={t("dashboard.newsfeedOpen")}
      onOpen={() => router.push(`/${portal}/newsfeed`)}
      onRow={() => router.push(`/${portal}/newsfeed`)}
    />
  );
}

// The bell's feed — same endpoint, same shape (components/shell/Bell.tsx).
interface Notif { id: string; category?: string; title: string; body: string; href?: string; readAt: string | null; at: string }
// Mirrors the bell's own glyphs so the same notification looks the same in both.
const CATEGORY_GLYPH: Record<string, string> = {
  accident: "🩹", incident: "⚠️", medication: "💊", booking: "📅", trip: "🚌",
  calendar: "🗓️", message: "✉️", moment: "📸", register: "📋", billing: "💳", task: "🗒️",
};

/** Notifications — the bell's latest, on the page instead of behind an icon.
 *  No "open" link: notifications have no page of their own, each row goes to
 *  wherever the thing it's about lives. */
export function NotificationsCard() {
  const t = useT();
  const router = useRouter();
  const portal = usePortal();
  const [notifs, setNotifs] = useState<Notif[] | null>(null);
  const load = useCallback(() => {
    apiGet<{ notifications: Notif[]; unread: number }>("/api/notifications")
      .then((r) => setNotifs(r?.notifications ?? []))
      .catch(() => setNotifs([]));
  }, []);
  useEffect(load, [load]);
  useRealtime(["notifications"], load);

  const list = notifs ?? [];
  const rows: Row[] | null = notifs === null ? null : [...list]
    // Unread first, then newest.
    .sort((a, b) => Number(!b.readAt) - Number(!a.readAt) || `${b.at}`.localeCompare(`${a.at}`))
    .slice(0, SHOWN)
    .map((n) => ({
      id: n.id,
      who: n.title,
      what: n.body,
      at: n.at,
      unread: !n.readAt,
      href: n.href,
      // An overdue chase reads wrong with a tick on it — clock those.
      glyph: /^overdue/i.test(n.title) ? "⏰" : CATEGORY_GLYPH[n.category ?? ""] ?? "🔔",
      title: `${n.title} — ${n.body}`,
    }));

  return (
    <CommsCard
      glyph="🔔" title={t("dashboard.notificationsTitle")} tone={TONES.amber}
      unread={list.filter((n) => !n.readAt).length}
      rows={rows}
      loading={t("dashboard.notificationsLoading")}
      empty={t("dashboard.notificationsNone")} emptyGlyph="🌤️"
      // Clicking the entry itself is the only way through — the bell's own
      // panel is where "mark all read" lives.
      onRow={(r) => { if (r.href) router.push(notificationHref(r.href, portal)); }}
    />
  );
}
