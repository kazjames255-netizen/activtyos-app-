"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Button } from "@/components/ui";
import { HowItWorks } from "@/components/HowItWorks";

// ─────────────────────────────────────────────────────────────────────────
// Newsfeed (operator) — announcements to families, built from templates. Each
// template (announcement / event / reminder / urgent / celebration / booking)
// drives styling + which fields the post carries. See server/src/routes/posts.ts.
// ─────────────────────────────────────────────────────────────────────────

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;
const HERO = "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)";
const BLUE = "#1d3a8f";

type Tpl = "announce" | "event" | "reminder" | "urgent" | "celebrate" | "booking";
type Status = "published" | "scheduled" | "archived";
interface Cta { label: string; target?: string; url?: string }
interface Rsvp { yes: number; no: number; maybe: number }
interface Post {
  id: string; tpl?: Tpl; title?: string; body: string; photoUrl?: string;
  priority?: "normal" | "urgent"; pinned?: boolean; ackRequired?: boolean; react?: boolean;
  status?: Status; audience?: "all" | "site" | "listing"; audId?: string; audLabel?: string;
  date?: string; time?: string; location?: string; cta?: Cta | null; publishAt?: string;
  rsvp?: Rsvp | null; seen?: number; reactions?: number;
  postedByName?: string; createdAt?: string; editedAt?: string;
}

const TPL: Record<Tpl, { label: string; color: string; hint: string }> = {
  announce: { label: "Announcement", color: "#2596df", hint: "General news for families" },
  event: { label: "Event", color: "#7c5cff", hint: "Date, time + RSVP" },
  reminder: { label: "Reminder", color: "#f59e0b", hint: "Short, actionable, pinned" },
  urgent: { label: "Urgent / closure", color: "#ef4444", hint: "High priority + acknowledge" },
  celebrate: { label: "Celebration", color: "#e22295", hint: "Wins & shout-outs" },
  booking: { label: "Booking nudge", color: "#15b364", hint: "Promote a listing" },
};
const TPL_ORDER: Tpl[] = ["announce", "event", "reminder", "urgent", "celebrate", "booking"];

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

type CtaKind = "none" | "listing" | "url";
interface Draft {
  editId: string; tpl: Tpl; title: string; body: string;
  audScope: "all" | "listing"; audId: string;
  date: string; time: string; location: string;
  pinned: boolean; priority: "normal" | "urgent"; ackRequired: boolean; react: boolean;
  ctaKind: CtaKind; ctaLabel: string; ctaTarget: string; ctaUrl: string;
  when: "now" | "later"; publishAt: string;
}
const draftFor = (tpl: Tpl, listings: { id: string; title: string }[]): Draft => ({
  editId: "", tpl, title: "", body: "", audScope: "all", audId: "",
  date: "", time: "", location: "",
  pinned: tpl === "urgent" || tpl === "reminder",
  priority: tpl === "urgent" ? "urgent" : "normal",
  ackRequired: tpl === "urgent", react: true,
  ctaKind: tpl === "booking" ? "listing" : "none", ctaLabel: tpl === "booking" ? "Book now" : "", ctaTarget: tpl === "booking" ? (listings[0]?.title ?? "") : "", ctaUrl: "",
  when: "now", publishAt: "",
});

export function NewsfeedApp() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [listings, setListings] = useState<{ id: string; title: string }[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState<"all" | Tpl | "scheduled" | "archived">("all");

  const refresh = useCallback(() => {
    apiGet<Post[]>("/api/posts").then((p) => { setPosts(p); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ id: string; title?: string; name?: string }[]>("/api/listings?mine=1").then((l) => setListings(l.map((x) => ({ id: x.id, title: x.title || x.name || "Listing" })))).catch(() => {}); }, []);
  useRealtime(["posts"], refresh);

  const all = useMemo(() => posts ?? [], [posts]);
  const live = useMemo(() => all.filter((p) => (p.status ?? "published") === "published"), [all]);
  const shown = useMemo(() => {
    if (filter === "all") return all.filter((p) => (p.status ?? "published") !== "archived");
    if (filter === "scheduled") return all.filter((p) => p.status === "scheduled");
    if (filter === "archived") return all.filter((p) => p.status === "archived");
    return all.filter((p) => (p.tpl ?? "announce") === filter && (p.status ?? "published") !== "archived");
  }, [all, filter]);
  const pinnedCount = live.filter((p) => p.pinned).length;
  const scheduledCount = all.filter((p) => p.status === "scheduled").length;

  async function publish(d: Draft) {
    if (!d.title.trim() || !d.body.trim()) { setError("Add a title and a message."); return; }
    const audLabel = d.audScope === "all" ? "All families" : `Listing: ${listings.find((l) => l.id === d.audId)?.title ?? "—"}`;
    const scheduled = d.when === "later" && !!d.publishAt;
    const cta: Cta | null = d.ctaKind === "listing" && d.ctaTarget ? { label: d.ctaLabel.trim() || "Open", target: d.ctaTarget }
      : d.ctaKind === "url" && d.ctaUrl.trim() ? { label: d.ctaLabel.trim() || "Open link", url: d.ctaUrl.trim() }
      : null;
    const payload: Partial<Post> = {
      tpl: d.tpl, title: d.title.trim(), body: d.body.trim(),
      priority: d.priority, pinned: d.pinned, ackRequired: d.ackRequired, react: d.react,
      status: scheduled ? "scheduled" : "published",
      audience: d.audScope, audId: d.audScope === "listing" ? d.audId : undefined, audLabel,
      ...(d.tpl === "event" ? { date: d.date, time: d.time, location: d.location } : {}),
      cta,
      ...(scheduled ? { publishAt: d.publishAt } : {}),
    };
    try {
      if (d.editId) await api(`/api/posts/${encodeURIComponent(d.editId)}`, { method: "PUT", body: JSON.stringify(payload) });
      else await apiPost("/api/posts", payload);
      setDraft(null); setError(null); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t post"); }
  }
  const patch = async (id: string, f: Partial<Post>) => {
    setPosts((ps) => (ps ?? []).map((p) => (p.id === id ? { ...p, ...f } : p)));
    try { await api(`/api/posts/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(f) }); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); refresh(); }
  };
  async function remove(p: Post) {
    if (!confirm("Delete this post? Families will no longer see it.")) return;
    try { await api(`/api/posts/${encodeURIComponent(p.id)}`, { method: "DELETE" }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }
  const editPost = (p: Post) => setDraft({
    editId: p.id, tpl: p.tpl ?? "announce", title: p.title ?? "", body: p.body,
    audScope: p.audience === "listing" ? "listing" : "all", audId: p.audId ?? "",
    date: p.date ?? "", time: p.time ?? "", location: p.location ?? "",
    pinned: !!p.pinned, priority: p.priority ?? "normal", ackRequired: !!p.ackRequired, react: p.react !== false,
    ctaKind: p.cta?.url ? "url" : p.cta?.target ? "listing" : "none", ctaLabel: p.cta?.label ?? "", ctaTarget: p.cta?.target ?? "", ctaUrl: p.cta?.url ?? "", when: "now", publishAt: "",
  });

  if (!posts) return <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5" style={LIGHT_PALETTE}><div className="py-16 text-center text-[12.5px] text-[var(--ink-3)]">Loading the newsfeed…</div></div>;

  const kpis: [string, number][] = [["Published", live.length], ["Pinned", pinnedCount], ["Scheduled", scheduledCount]];

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#c02636]">{error}</div>}

      {/* Hero */}
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: HERO }}>
        <div className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Newsfeed</div>
        <p className="mt-1 max-w-[640px] text-[12.5px] text-white/85">Post an update and every family with a booking sees it in their app — from a quick reminder to an event with RSVPs or an urgent closure.</p>
        <div className="mt-3.5 flex flex-wrap gap-2.5">
          {kpis.map(([label, n]) => (
            <div key={label} className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>{n}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{label}</div></div>
          ))}
        </div>
      </div>

      <HowItWorks video="Picking a post template, adding an event with RSVPs or a booking nudge, scoping who sees it, pinning and scheduling." minutes="2 min">
        <p className="mb-2"><b className="text-[var(--ink-2)]">Start from a template.</b> An <b>Event</b> carries a date, time and RSVP; a <b>Booking nudge</b> adds a button to a listing; an <b>Urgent notice</b> is pinned and asks families to acknowledge it.</p>
        <p><b className="text-[var(--ink-2)]">Choose who sees it and when.</b> Send to all families or just one listing’s families, pin it to the top, and publish now or schedule it for later.</p>
      </HowItWorks>

      {canManage && (
        <div className="mb-4 rounded-2xl border border-[#dbe6fb] bg-[var(--surface)] p-3 shadow-sm">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">New post — pick a type</div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {TPL_ORDER.map((k) => (
              <button key={k} type="button" onClick={() => setDraft(draftFor(k, listings))} className="flex flex-col items-start gap-0.5 rounded-xl border p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: `${TPL[k].color}44`, background: `${TPL[k].color}0c` }}>
                <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold" style={{ background: TPL[k].color, color: "#fff" }}>{TPL[k].label}</span>
                <span className="text-[10.5px] text-[var(--ink-3)]">{TPL[k].hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {([["all", "All"], ...TPL_ORDER.map((k) => [k, TPL[k].label] as const), ["scheduled", "Scheduled"], ["archived", "Archived"]] as [typeof filter, string][]).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className="rounded-full border px-3 py-1 text-[11.5px] font-bold" style={filter === k ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{label}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-14 text-center text-[13px] text-[var(--ink-3)]">Nothing here yet — {canManage ? "pick a post type above to write your first update." : "your provider hasn’t posted yet."}</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((p) => <PostCard key={p.id} p={p} canManage={canManage} onEdit={() => editPost(p)} onPin={() => patch(p.id, { pinned: !p.pinned })} onArchive={() => patch(p.id, { status: p.status === "archived" ? "published" : "archived" })} onDelete={() => remove(p)} />)}
        </div>
      )}

      {draft && <Composer draft={draft} setDraft={setDraft} listings={listings} onClose={() => setDraft(null)} onPublish={publish} />}
    </div>
  );
}

function PostCard({ p, canManage, onEdit, onPin, onArchive, onDelete }: { p: Post; canManage: boolean; onEdit: () => void; onPin: () => void; onArchive: () => void; onDelete: () => void }) {
  const tpl = TPL[p.tpl ?? "announce"];
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
      <div className="border-l-[4px] p-3.5" style={{ borderColor: tpl.color }}>
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ background: `${tpl.color}18`, color: tpl.color }}>{tpl.label}</span>
          {p.pinned && <span className="rounded-full bg-[#fff4d6] px-2 py-0.5 text-[10px] font-extrabold text-[#8a6d1a]">Pinned</span>}
          {p.priority === "urgent" && <span className="rounded-full bg-[#fde2e4] px-2 py-0.5 text-[10px] font-extrabold text-[#c02636]">Urgent</span>}
          {p.ackRequired && <span className="rounded-full bg-[#eef4fd] px-2 py-0.5 text-[10px] font-extrabold text-[#1d3a8f]">Acknowledge</span>}
          {p.status === "scheduled" && <span className="rounded-full bg-[#efeaff] px-2 py-0.5 text-[10px] font-extrabold text-[#5b3fd8]">Scheduled {p.publishAt}</span>}
          {p.status === "archived" && <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--ink-3)]">Archived</span>}
          {p.audLabel && p.audLabel !== "All families" && <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-2)]">{p.audLabel}</span>}
        </div>
        {p.title && <div className="text-[14px] font-extrabold">{p.title}</div>}
        <div className="mt-0.5 whitespace-pre-wrap text-[13px] text-[var(--ink-2)]">{p.body}</div>

        {p.tpl === "event" && (p.date || p.time || p.location) && (
          <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-lg bg-[var(--panel)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">{[p.date, p.time, p.location].filter(Boolean).join(" · ")}</div>
        )}
        {p.cta && <div className="mt-2"><span className="inline-flex rounded-lg px-3 py-1.5 text-[12px] font-extrabold text-white" style={{ background: tpl.color }}>{p.cta.label} → {p.cta.url ?? p.cta.target}</span></div>}

        <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-[var(--ink-3)]">
          <span>{p.postedByName} · {when(p.createdAt)}{p.editedAt ? " · edited" : ""}</span>
          <span className="flex items-center gap-2.5">
            <span title="Seen / acknowledged">Seen {p.seen ?? 0}</span>
            {p.react !== false && <span title="Reactions">♥ {p.reactions ?? 0}</span>}
            {p.rsvp && <span title="RSVPs">Going {p.rsvp.yes} · Maybe {p.rsvp.maybe} · No {p.rsvp.no}</span>}
          </span>
          {canManage && (
            <span className="ml-auto flex items-center gap-1.5">
              <button type="button" onClick={onPin} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{p.pinned ? "Unpin" : "Pin"}</button>
              <button type="button" onClick={onEdit} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Edit</button>
              <button type="button" onClick={onArchive} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{p.status === "archived" ? "Restore" : "Archive"}</button>
              <button type="button" onClick={onDelete} className="rounded-md border border-[#f6c9cc] px-2 py-0.5 text-[10.5px] font-bold text-[#c02636] hover:bg-[#fdebec]">Delete</button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Composer({ draft, setDraft, listings, onClose, onPublish }: { draft: Draft; setDraft: (d: Draft) => void; listings: { id: string; title: string }[]; onClose: () => void; onPublish: (d: Draft) => void }) {
  const tpl = TPL[draft.tpl];
  const set = (f: Partial<Draft>) => setDraft({ ...draft, ...f });
  const inputCls = "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[12.5px] outline-none focus:border-[#1d3a8f]";
  const field = (name: string, node: ReactNode) => <div><div className="mb-0.5 text-[11px] font-bold text-[var(--ink-3)]">{name}</div>{node}</div>;

  // AI "help me write" — the operator gives the gist + specifics, picks a length,
  // and the model drafts the title + message (server: POST /api/ai/compose).
  const [aiNotes, setAiNotes] = useState("");
  const [aiCost, setAiCost] = useState("");
  const [aiLen, setAiLen] = useState<"short" | "medium" | "long">("medium");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState("");
  const aiPrompt: Record<Tpl, string> = {
    announce: "What’s the news? e.g. new term dates, a staffing update, a policy change…",
    event: "What’s the event, and why should families come? Fill the date/time/location below too.",
    reminder: "What should families remember, and by when? e.g. bring wellies + a packed lunch tomorrow.",
    urgent: "What’s happening and what must parents do? e.g. closing at 3pm today due to the heat — collect by 3pm.",
    celebrate: "Who or what are you celebrating? e.g. Mia’s brilliant teamwork all week.",
    booking: "What are you promoting and any hook? e.g. summer camp open, early-bird ends Sunday, limited spaces. Pick the listing below.",
  };
  async function generate() {
    if (!aiNotes.trim()) { setAiErr("Tell the AI what you want to say first."); return; }
    setAiBusy(true); setAiErr("");
    const fields: Record<string, string> = {};
    if (draft.tpl === "event") { if (draft.date) fields.date = draft.date; if (draft.time) fields.time = draft.time; if (draft.location) fields.location = draft.location; }
    if (aiCost.trim()) fields.cost = aiCost.trim();
    if (draft.ctaKind === "listing" && draft.ctaTarget) fields.listing = draft.ctaTarget;
    try {
      const r = await apiPost<{ title: string; body: string }>("/api/ai/compose", { kind: draft.tpl, notes: aiNotes.trim(), fields, length: aiLen });
      set({ title: r.title || draft.title, body: r.body || draft.body });
    } catch (e) { setAiErr(e instanceof Error ? e.message : "The writer couldn’t draft that — try again."); }
    finally { setAiBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[5vh]" onClick={onClose}>
      <div className="w-full max-w-[560px] overflow-hidden rounded-3xl bg-[var(--surface)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 text-white" style={{ background: `linear-gradient(120deg, ${tpl.color}, ${tpl.color}bb)` }}>
          <div className="text-[16px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{draft.editId ? "Edit" : "New"} · {tpl.label}</div>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-[15px] font-bold">×</button>
        </div>
        <div className="max-h-[72vh] space-y-2.5 overflow-y-auto p-4">
          <div className="flex flex-wrap gap-1.5">
            {TPL_ORDER.map((k) => <button key={k} type="button" onClick={() => set({ tpl: k })} className="rounded-full border px-2.5 py-1 text-[11px] font-bold" style={draft.tpl === k ? { borderColor: TPL[k].color, background: `${TPL[k].color}18`, color: TPL[k].color } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{TPL[k].label}</button>)}
          </div>

          {/* AI assist */}
          <div className="rounded-xl border border-[#dbe6fb] bg-[#f4f8ff] p-2.5">
            <div className="mb-1 text-[11.5px] font-extrabold text-[#1d3a8f]">✨ Help me write</div>
            <textarea value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} rows={2} placeholder={aiPrompt[draft.tpl]} className={inputCls} />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {(draft.tpl === "event" || draft.tpl === "booking") && <input value={aiCost} onChange={(e) => setAiCost(e.target.value)} placeholder="Cost (optional) e.g. £30" className="w-[150px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] outline-none" />}
              <div className="inline-flex overflow-hidden rounded-full border border-[var(--line)]">
                {(["short", "medium", "long"] as const).map((l) => <button key={l} type="button" onClick={() => setAiLen(l)} className="px-2.5 py-1 text-[11px] font-bold capitalize transition-colors" style={aiLen === l ? { background: BLUE, color: "#fff" } : { color: "var(--ink-2)" }}>{l}</button>)}
              </div>
              <button type="button" onClick={generate} disabled={aiBusy} className="ml-auto rounded-lg bg-[#1d3a8f] px-3 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-60">{aiBusy ? "Writing…" : "Write it for me"}</button>
            </div>
            {aiErr && <div className="mt-1 text-[11px] font-bold text-[#c02636]">{aiErr}</div>}
          </div>

          {field("Title", <input autoFocus value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Early pick-up today at 3pm" className={inputCls} />)}
          {field("Message", <textarea value={draft.body} onChange={(e) => set({ body: e.target.value })} rows={4} placeholder="Write the update families will see…" className={inputCls} />)}

          {draft.tpl === "event" && (
            <div className="grid grid-cols-3 gap-2.5">
              {field("Date", <input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} className={inputCls} />)}
              {field("Time", <input type="time" value={draft.time} onChange={(e) => set({ time: e.target.value })} className={inputCls} />)}
              {field("Location", <input value={draft.location} onChange={(e) => set({ location: e.target.value })} placeholder="Main field" className={inputCls} />)}
            </div>
          )}
          {field("Link (optional)", (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {([["none", "No link"], ["listing", "To a listing"], ["url", "To a web link"]] as const).map(([k, label]) => <button key={k} type="button" onClick={() => set({ ctaKind: k })} className="rounded-full border px-2.5 py-1 text-[11px] font-bold" style={draft.ctaKind === k ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{label}</button>)}
              </div>
              {draft.ctaKind !== "none" && (
                <div className="grid grid-cols-2 gap-2.5">
                  <input value={draft.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} placeholder={draft.tpl === "booking" ? "Book now" : "Button label"} className={inputCls} />
                  {draft.ctaKind === "listing"
                    ? <select value={draft.ctaTarget} onChange={(e) => set({ ctaTarget: e.target.value })} className={inputCls}><option value="">Choose a listing…</option>{listings.map((l) => <option key={l.id} value={l.title}>{l.title}</option>)}</select>
                    : <input value={draft.ctaUrl} onChange={(e) => set({ ctaUrl: e.target.value })} placeholder="https://…" className={inputCls} />}
                </div>
              )}
            </div>
          ))}

          {field("Who sees it", (
            <div className="flex flex-wrap items-center gap-2">
              {([["all", "All families"], ["listing", "One listing’s families"]] as const).map(([k, label]) => <button key={k} type="button" onClick={() => set({ audScope: k, audId: "" })} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={draft.audScope === k ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{label}</button>)}
              {draft.audScope === "listing" && <select value={draft.audId} onChange={(e) => set({ audId: e.target.value })} className="rounded-lg border border-[var(--line)] px-2 py-1 text-[12px] outline-none"><option value="">Choose a listing…</option>{listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select>}
            </div>
          ))}

          <div className="flex flex-wrap gap-1.5">
            {([["pinned", "Pin to top"], ["ackRequired", "Ask to acknowledge"], ["react", "Allow reactions"]] as const).map(([f, label]) => <button key={f} type="button" onClick={() => set({ [f]: !draft[f] } as Partial<Draft>)} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={draft[f] ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{draft[f] ? "✓ " : ""}{label}</button>)}
            <button type="button" onClick={() => set({ priority: draft.priority === "urgent" ? "normal" : "urgent" })} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={draft.priority === "urgent" ? { borderColor: "#c02636", background: "#fde2e4", color: "#c02636" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{draft.priority === "urgent" ? "✓ " : ""}High priority</button>
          </div>

          {field("When", (
            <div className="flex flex-wrap items-center gap-2">
              {([["now", "Publish now"], ["later", "Schedule"]] as const).map(([k, label]) => <button key={k} type="button" onClick={() => set({ when: k })} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold" style={draft.when === k ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{label}</button>)}
              {draft.when === "later" && <input type="datetime-local" value={draft.publishAt} onChange={(e) => set({ publishAt: e.target.value })} className="rounded-lg border border-[var(--line)] px-2 py-1 text-[12px] outline-none" />}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] px-4 py-3">
          <Button sm onClick={onClose}>Cancel</Button>
          <Button sm variant="primary" onClick={() => onPublish(draft)}>{draft.editId ? "Save changes" : draft.when === "later" ? "Schedule" : "Publish"}</Button>
        </div>
      </div>
    </div>
  );
}
