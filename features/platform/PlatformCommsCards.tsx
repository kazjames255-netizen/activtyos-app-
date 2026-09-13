"use client";

// The HQ dashboard's "what's come in" row — the platform-side twin of the
// provider dashboard's cards (features/dashboard/CommsCards), built from the
// same card so both dashboards read the same way.
//
// Three cards, not four: a platform account has no tenant, so there is no
// newsfeed behind it, and no mailbox of its own either — the email card shows
// the mail landing across the PROVIDERS instead (GET /api/platform/inbox),
// which is the network-wide view only HQ can take.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { CommsCard, SHOWN, TONES, type Row } from "@/features/dashboard/CommsCards";

// The support thread fields this card shows — the full model lives in
// SupportInboxApp (backed by /api/platform/support).
interface SupportThread {
  id: string;
  name: string;
  email: string;
  providerName?: string;
  subject: string;
  kind: "message" | "bug";
  status: "open" | "resolved";
  unreadByHq: boolean;
  messages?: { from: "hq" | "them"; body: string; at: string }[];
  updatedAt: string;
}

/** Messages & support — providers and their customers waiting on HQ. */
export function SupportInboxCard() {
  const router = useRouter();
  const [threads, setThreads] = useState<SupportThread[] | null>(null);
  const load = useCallback(() => {
    apiGet<{ threads: SupportThread[] }>("/api/platform/support")
      .then((r) => setThreads(r?.threads ?? []))
      .catch(() => setThreads([]));
  }, []);
  useEffect(load, [load]);
  useRealtime(["supportThreads"], load);

  // Resolved threads are done with — the card is about what's still open.
  const open = (threads ?? []).filter((th) => th.status !== "resolved");
  const rows: Row[] | null = threads === null ? null : [...open]
    // Unread first, then most recently touched.
    .sort((a, b) => Number(!!b.unreadByHq) - Number(!!a.unreadByHq) || `${b.updatedAt}`.localeCompare(`${a.updatedAt}`))
    .slice(0, SHOWN)
    .map((th) => {
      const last = th.messages?.[th.messages.length - 1];
      const who = th.providerName && th.providerName !== th.name ? `${th.name} · ${th.providerName}` : th.name;
      const what = (last?.body ?? th.subject).replace(/\s+/g, " ").trim();
      return {
        id: th.id,
        who,
        what,
        at: th.updatedAt,
        unread: th.unreadByHq,
        // A bug report is a different job from a message — show which it is.
        glyph: th.kind === "bug" ? "🐞" : undefined,
        title: `${who} — ${th.subject}`,
      };
    });

  return (
    <CommsCard
      glyph="🎧" title="Support & messages" tone={TONES.blue}
      unread={open.filter((th) => th.unreadByHq).length}
      rows={rows}
      loading="Loading support…"
      empty="Nothing open — all answered" emptyGlyph="✅"
      actionLabel="Open support"
      onOpen={() => router.push("/platform/messages")}
      onRow={(r) => router.push(`/platform/messages?thread=${encodeURIComponent(r.id)}`)}
    />
  );
}

// The HQ bell's feed — same endpoint and glyphs as components/shell/PlatformBell.
type NType = "signup" | "cancel" | "support" | "bug" | "lead" | "task";
interface HqNotif { id: string; type: NType; title: string; body: string; href: string; at: string }
const GLYPH: Record<NType, string> = { signup: "🎉", cancel: "🚫", support: "✉️", bug: "🐛", lead: "💬", task: "✅" };

/** HQ notifications — signups, cancellations, support and bug reports. */
export function PlatformNotificationsCard() {
  const router = useRouter();
  const [data, setData] = useState<{ items: HqNotif[]; unread: number } | null>(null);
  const load = useCallback(() => {
    apiGet<{ items: HqNotif[]; unread: number }>("/api/platform/notifications")
      .then((d) => setData({ items: d?.items ?? [], unread: d?.unread ?? 0 }))
      .catch(() => setData({ items: [], unread: 0 }));
  }, []);
  // No SSE channel for this one — the bell polls it, so match its minute.
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);

  const rows: Row[] | null = data === null ? null : data.items
    .slice(0, SHOWN)
    .map((n) => ({
      id: n.id,
      who: n.title,
      what: n.body,
      at: n.at,
      // Everything in this feed is outstanding — an entry leaves the list the
      // moment it's opened (the bell dismisses it server-side), so nothing
      // sitting here has been dealt with.
      unread: true,
      href: n.href,
      glyph: GLYPH[n.type] ?? "🔔",
      title: `${n.title} — ${n.body}`,
    }));

  return (
    <CommsCard
      glyph="🔔" title="Notifications" tone={TONES.amber}
      unread={data?.unread ?? 0}
      rows={rows}
      loading="Loading notifications…"
      empty="Nothing new" emptyGlyph="🌤️"
      // These hrefs are written platform-side and already absolute
      // (/platform/support?thread=…), so they need no portal rewrite.
      onRow={(r) => { if (r.href) router.push(r.href); }}
    />
  );
}

// One inbound message from any provider's inbox — GET /api/platform/inbox.
interface NetworkMail { id: string; tenantId: string; providerName: string; from: string; fromEmail: string; subject: string; preview: string; unread: boolean; at: string }

/** Provider email, network-wide — what's landing in the inboxes HQ supports. */
export function NetworkInboxCard() {
  const router = useRouter();
  const [data, setData] = useState<{ items: NetworkMail[]; unread: number } | null>(null);
  const load = useCallback(() => {
    apiGet<{ items: NetworkMail[]; unread: number }>("/api/platform/inbox")
      .then((d) => setData({ items: d?.items ?? [], unread: d?.unread ?? 0 }))
      .catch(() => setData({ items: [], unread: 0 }));
  }, []);
  useEffect(load, [load]);
  useRealtime(["emailMessages"], load);

  const rows: Row[] | null = data === null ? null : data.items
    .slice(0, SHOWN)
    .map((m) => ({
      id: m.id,
      who: m.subject,
      // Whose mailbox it landed in is the thing HQ needs off this row — the
      // sender alone doesn't say which provider is dealing with it.
      what: `${m.providerName} · ${m.from}`,
      at: m.at,
      unread: m.unread,
      title: `${m.from}${m.fromEmail && m.fromEmail !== m.from ? ` <${m.fromEmail}>` : ""} → ${m.providerName}: ${m.subject}`,
    }));

  return (
    <CommsCard
      glyph="📬" title="New emails" tone={TONES.violet}
      unread={data?.unread ?? 0}
      rows={rows}
      loading="Loading provider mail…"
      empty="No mail in the last window" emptyGlyph="📭"
      // No HQ mailbox to open — the providers list is where you pick an account
      // to open and read it in their own Inbox.
      actionLabel="Providers"
      onOpen={() => router.push("/platform/providers")}
      onRow={() => router.push("/platform/providers")}
    />
  );
}
