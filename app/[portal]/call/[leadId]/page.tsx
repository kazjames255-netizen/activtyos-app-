"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { get, post } from "@/lib/api";
import { BIZ_TYPE_LABEL, type Lead, type Activity } from "@/features/platform/SalesApp";

// A dedicated portal page for a booked call — NOT a modal, NOT an external
// tab. Lives under /[portal]/call/[leadId] so it inherits the normal portal
// shell (sidebar, header, auth guard — app/[portal]/layout.tsx), and the
// Jitsi room is embedded directly in the page body: no link ever takes HQ
// out of the app. Call notes live right alongside it, so a note can be
// jotted mid-call without leaving.
//
// Only ever reached from the Sales board (a lead with a videoRoom) — if the
// lead has none, or doesn't exist, this just says so rather than guessing.
//
// Daily.co, not Jitsi's public meet.jit.si — that free public server
// auto-disconnects any *embedded* (iframe) call after 5 minutes, fine for a
// demo, useless for a real call. `lead.videoRoom` is the full Daily room URL
// (server/src/lib/emails.ts's ensureLeadVideoUrl creates it via Daily's REST
// API with enable_prejoin_ui/enable_knocking off) — it embeds straight, no
// masking hacks needed the way Jitsi's lobby UI required.
//
// Embedded via the daily-js SDK's createFrame(), not a plain <iframe src>,
// specifically for its `theme` option: Daily's default UI is a near-black
// charcoal that clashed with the rest of this blue-themed portal, and
// `theme` (brand colours) is a client-side createFrame/setTheme option —
// confirmed it's NOT a REST API room property (the API rejects it outright).

// Portal blues (--brand family) for Daily's prebuilt UI.
const DAILY_THEME = {
  colors: {
    accent: "#2f6bd8",
    accentText: "#ffffff",
    background: "#16306e",
    backgroundAccent: "#1d3a8f",
    baseText: "#ffffff",
    border: "#3a5bb0",
    mainAreaBg: "#0f2354",
    mainAreaBgAccent: "#1d3a8f",
    mainAreaText: "#ffffff",
    supportiveText: "#b9c8ee",
  },
};

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const DEMO_PORTALS: { v: "freelancer" | "company" | "franchise" | "staff" | "custdash"; label: string }[] = [
  { v: "company", label: "Company / Head office" },
  { v: "freelancer", label: "Freelancer" },
  { v: "franchise", label: "Franchise" },
  { v: "staff", label: "Staff" },
  { v: "custdash", label: "Parent" },
];

function CardHead({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="mb-1.5 flex w-full items-center justify-between text-left">
      <span className="text-[11px] font-extrabold uppercase tracking-wide text-[#1d3a8f]">{title}</span>
      <span className={`text-[11px] text-[var(--ink-3)] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
    </button>
  );
}

export default function CallRoomPage() {
  const params = useParams<{ leadId: string; portal: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteShare, setNoteShare] = useState(false);
  const [noteBusy, setNoteBusy] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(true);
  const [commsOpen, setCommsOpen] = useState(true);
  const [demoPortalHint, setDemoPortalHint] = useState(false);
  const [demoPortalKind, setDemoPortalKind] = useState<"freelancer" | "company" | "franchise" | "staff" | "custdash">("company");

  // Leads created outside the board (e.g. the public demo form) can lack the
  // embedded activities array — normalise so the page never crashes on it.
  const withActivities = (l: Lead): Lead => ({ ...l, activities: l.activities ?? [] });
  const frameHost = useRef<HTMLDivElement>(null);
  const videoRoom = lead?.videoRoom;
  useEffect(() => {
    const host = frameHost.current;
    if (!videoRoom || !host) return;
    let cancelled = false;
    let call: { destroy: () => Promise<void> } | null = null;
    // Client-only import: daily-js is a browser UMD bundle and breaks SSR.
    import("@daily-co/daily-js").then(({ default: Daily }) => {
      if (cancelled) return;
      const frame = Daily.createFrame(host, {
        theme: DAILY_THEME,
        showLeaveButton: true,
        iframeStyle: { width: "100%", height: "100%", border: "0" },
      });
      call = frame;
      // Daily's REST API can't set a redirect on this plan, so show our own end screen.
      frame.on("left-meeting", () => { if (!cancelled) router.push("/call-ended"); });
      void frame.join({ url: videoRoom });
    });
    return () => {
      cancelled = true;
      void call?.destroy();
    };
  }, [videoRoom]);

  const load = () => {
    get<Lead>(`/api/platform/leads/${params.leadId}`).then((l) => setLead(withActivities(l))).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load this call"));
  };
  useEffect(load, [params.leadId]);

  const saveCallNote = async () => {
    const text = noteDraft.trim();
    if (!text || noteBusy || !lead) return;
    setNoteBusy(true);
    try {
      const saved = await post<Lead>(`/api/platform/leads/${lead.id}/activities`, { type: "note", note: text, shared: noteShare });
      setLead(withActivities(saved));
      setNoteDraft("");
      setNoteShare(false);
    } finally {
      setNoteBusy(false);
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-[#f2c4c9] bg-[#fdf0f1] px-4 py-3 text-[13px] font-semibold text-[#c02636]">{error}</div>
        <button type="button" onClick={() => router.back()} className="mt-3 rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-bold text-[var(--ink-2)]">← Back</button>
      </div>
    );
  }
  if (!lead) return <div className="p-6 text-[13px] text-[var(--ink-3)]">Loading…</div>;
  if (!lead.videoRoom) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-[13px] text-[var(--ink-2)]">No call booked for {lead.business} yet.</div>
        <button type="button" onClick={() => router.back()} className="mt-3 rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-bold text-[var(--ink-2)]">← Back</button>
      </div>
    );
  }

  return (
    <div
      className="min-h-[calc(100vh-64px)] p-5"
      style={{
        backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1.6px), linear-gradient(120deg,#16306e 0%,#274ba3 58%,#3f78d8 100%)",
        backgroundSize: "18px 18px, cover",
        backgroundRepeat: "repeat, no-repeat",
      }}
    >
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => router.back()} className="rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-[12.5px] font-bold text-white backdrop-blur-sm hover:bg-white/20">← Back to Sales pipeline</button>
          <div className="min-w-0">
            <div className="truncate text-[18px] font-extrabold text-white">📹 Call with {lead.business}</div>
            <div className="truncate text-[12.5px] text-white/70">{lead.contactName}{lead.slotAt ? ` · ${fmtDay(lead.slotAt)}` : ""}</div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[2.1fr_0.75fr]">
          <div className="overflow-hidden rounded-2xl border border-white/15 bg-black shadow-[0_10px_40px_rgba(10,20,60,0.35)]" style={{ height: "min(78vh, 720px)" }}>
            <div ref={frameHost} className="h-full w-full" />
          </div>

          <div className="flex flex-col gap-4">
          {/* Placeholder for now — no real demo portal exists yet. The point is to
              have this call-room entry point already in place for whenever one
              gets built: a live walkthrough switchable between every portal
              (parent/staff/freelancer/company/franchise) without leaving the call. */}
          <div className="overflow-hidden rounded-2xl border border-white/15 bg-[var(--surface)] shadow-[0_10px_40px_rgba(10,20,60,0.25)]">
            <div className="border-b border-[#e4e9f5] bg-gradient-to-r from-[#eef2fd] to-[#f7f9ff] px-3.5 py-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#1d3a8f]">✨ Demo portal</div>
              <p className="mt-0.5 text-[11px] text-[var(--ink-3)]">Show them the product live, without leaving this call.</p>
            </div>
            <div className="p-3.5">
              <label className="block">
                <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">View as</span>
                <select
                  value={demoPortalKind}
                  onChange={(e) => setDemoPortalKind(e.target.value as typeof demoPortalKind)}
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[12.5px] font-bold text-[var(--ink)] outline-none focus:border-[#1d3a8f]"
                >
                  {DEMO_PORTALS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setDemoPortalHint(true)}
                className="mt-2.5 w-full rounded-lg bg-[#1d3a8f] px-4 py-2.5 text-[12.5px] font-extrabold text-white shadow-sm transition hover:brightness-110"
              >
                Run demo portal →
              </button>
              {demoPortalHint && (
                <p className="mt-2 text-[11px] leading-snug text-[var(--ink-3)]">Coming soon — a live {DEMO_PORTALS.find((p) => p.v === demoPortalKind)?.label} walkthrough, right here on the call.</p>
              )}
            </div>
          </div>
          {(lead.contactName || lead.email || lead.phone || lead.businessTypes?.length || lead.interestedFeatures?.length || lead.message) && (
            <div className="rounded-2xl border border-white/15 bg-[var(--surface)] p-3.5 shadow-[0_10px_40px_rgba(10,20,60,0.25)]">
              <CardHead title={`👤 About ${lead.contactName || "them"}`} open={aboutOpen} onToggle={() => setAboutOpen((v) => !v)} />
              {aboutOpen && (
                <>
                  <div className="text-[12.5px] leading-relaxed text-[var(--ink-2)]">
                    {lead.email && <div className="truncate">{lead.email}</div>}
                    {lead.phone && <div>{lead.phone}</div>}
                  </div>
                  {!!lead.businessTypes?.length && (
                    <div className="mt-2.5 text-[12.5px] text-[var(--ink-2)]">
                      <span className="font-bold text-[var(--ink-3)]">Runs:</span> {lead.businessTypes.map((t) => BIZ_TYPE_LABEL[t] || t).join(", ")}
                    </div>
                  )}
                  {!!lead.interestedFeatures?.length && (
                    <div className="mt-2.5">
                      <div className="text-[11.5px] font-bold text-[var(--ink-3)]">Wants to see (ticked on the demo page):</div>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12.5px] text-[var(--ink)]">
                        {lead.interestedFeatures.map((x) => <li key={x}>{x}</li>)}
                      </ul>
                    </div>
                  )}
                  {lead.message && (
                    <div className="mt-2.5 rounded-lg border-l-[3px] border-[#1d3a8f] bg-[var(--panel)] px-3 py-2 text-[12.5px] leading-relaxed text-[var(--ink)]">{lead.message}</div>
                  )}
                </>
              )}
            </div>
          )}
          {(() => {
            const thread = lead.activities.filter((a) => a.type === "email" && a.direction).slice().reverse();
            if (!thread.length && !lead.message) return null;
            return (
              <div className="rounded-2xl border border-white/15 bg-[var(--surface)] p-3.5 shadow-[0_10px_40px_rgba(10,20,60,0.25)]">
                <CardHead title="💬 Communications" open={commsOpen} onToggle={() => setCommsOpen((v) => !v)} />
                {commsOpen && (
                  <div className="flex max-h-[260px] flex-col gap-2 overflow-y-auto">
                    {lead.message && (
                      <div className="max-w-[92%] rounded-xl border border-[#bfe6cf] bg-[#eafaf0] px-3 py-2 text-[12.5px] leading-relaxed text-[#0f5132]">
                        <div className="mb-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[#127a3e]">Them</div>
                        {lead.message}
                      </div>
                    )}
                    {thread.map((a) => (
                      <div key={a.id} className={`max-w-[92%] rounded-xl px-3 py-2 text-[12.5px] leading-relaxed ${a.direction === "out" ? "ml-auto bg-[#1d3a8f] text-white" : "border border-[#bfe6cf] bg-[#eafaf0] text-[#0f5132]"}`}>
                        <div className={`mb-0.5 text-[10.5px] font-bold uppercase tracking-wide ${a.direction === "out" ? "text-white/70" : "text-[#127a3e]"}`}>
                          {a.direction === "out" ? "You" : "Them"} · {fmtDay(a.at)}
                        </div>
                        {a.note}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          <div className="rounded-2xl border border-white/15 bg-[var(--surface)] p-3.5 shadow-[0_10px_40px_rgba(10,20,60,0.25)]">
          <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#1d3a8f]">📝 Call notes</div>
          <p className="mb-2 text-[11.5px] text-[var(--ink-3)]">Jot notes as you go — saved straight to {lead.business}&rsquo;s record. Share a note by email, or keep it internal.</p>
          {lead.activities.filter((a) => a.type === "note").length > 0 && (
            <div className="mb-3 flex max-h-[220px] flex-col gap-1.5 overflow-y-auto">
              {lead.activities.filter((a) => a.type === "note").map((a: Activity) => (
                <div key={a.id} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[12.5px] text-[var(--ink)]">
                  <div className="mb-0.5 flex items-center gap-1.5 text-[10.5px] font-bold text-[var(--ink-3)]">
                    {a.by} · {fmtDay(a.at)}
                    {a.shared ? <span className="rounded-full bg-[#eafaf0] px-1.5 py-0.5 font-extrabold text-[#127a3e]">✓ Shared</span> : <span className="rounded-full bg-[var(--surface)] px-1.5 py-0.5 font-extrabold text-[var(--ink-3)]">Internal</span>}
                  </div>
                  {a.note}
                </div>
              ))}
            </div>
          )}
          <textarea rows={4} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Notes from the call — what was said, what's next…"
            className="w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-[13px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[11.5px] font-bold text-[var(--ink-3)]">Share with them?</span>
            <button type="button" onClick={() => setNoteShare(false)} className={`rounded-full border px-3 py-1 text-[11.5px] font-bold ${!noteShare ? "border-[#1d3a8f] bg-[#eaf0fc] text-[#1d3a8f]" : "border-[var(--line)] text-[var(--ink-2)]"}`}>No</button>
            <button type="button" onClick={() => setNoteShare(true)} className={`rounded-full border px-3 py-1 text-[11.5px] font-bold ${noteShare ? "border-[#127a3e] bg-[#eafaf0] text-[#127a3e]" : "border-[var(--line)] text-[var(--ink-2)]"}`}>Yes</button>
            <button type="button" onClick={() => void saveCallNote()} disabled={!noteDraft.trim() || noteBusy} className="ml-auto rounded-lg bg-[#1d3a8f] px-4 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-40">
              {noteBusy ? "Saving…" : "Save note"}
            </button>
          </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
